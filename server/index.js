import 'dotenv/config';
import express from 'express';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import * as tv from './tvControl.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const CERTS_DIR = path.join(__dirname, 'certs');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const app = express();
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Must be served inline (no Content-Disposition: attachment) so Safari
// recognizes it as an installable profile instead of just downloading it.
app.get('/ca.pem', (_req, res) => {
  const certPath = path.join(CERTS_DIR, 'cert.pem');
  if (!fs.existsSync(certPath)) return res.status(404).send('No dev cert generated yet.');
  res.setHeader('Content-Type', 'application/x-x509-ca-cert');
  res.send(fs.readFileSync(certPath));
});

app.post('/api/recipes', async (req, res) => {
  const { items = [], preferences = '' } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No fridge items provided.' });
  }

  const itemLines = items
    .map((it) => {
      const days = it.daysUntilExpiry;
      const urgency =
        typeof days === 'number'
          ? days < 0
            ? 'EXPIRED'
            : days === 0
            ? 'expires today'
            : `expires in ${days}d`
          : 'no expiry set';
      return `- ${it.name}${it.brand ? ` (${it.brand})` : ''} — ${urgency}`;
    })
    .join('\n');

  const prompt = `You are the recipe brain for a kitchen fridge display. Here is what's currently in the fridge:

${itemLines}

Dietary preferences / constraints: ${preferences || 'none specified'}

Suggest 3 recipes that primarily use what's already in the fridge, prioritizing items that expire soonest. It's fine to assume common pantry staples (salt, oil, flour, basic spices) even if not listed. Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly this shape:

{
  "recipes": [
    {
      "title": "string",
      "usesExpiringSoon": ["item names this recipe rescues"],
      "estimatedMinutes": 0,
      "ingredients": ["string"],
      "steps": ["string"]
    }
  ]
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { recipes: [] };
    }

    res.json(parsed);
  } catch (err) {
    console.error('Recipe generation failed:', err);
    res.status(500).json({ error: 'Recipe generation failed.' });
  }
});

// TV control — only meaningful when this server is running on the home LAN
// (the Render deployment can't reach these devices, so these routes are
// simply never called there).
app.get('/api/tv', (_req, res) => {
  res.json({ tvs: tv.listTVs() });
});

app.post('/api/tv', (req, res) => {
  const { name, host, mac } = req.body || {};
  if (!name || !host) return res.status(400).json({ error: 'name and host are required.' });
  res.json(tv.addTV({ name, host, mac }));
});

app.delete('/api/tv/:id', (req, res) => {
  tv.removeTV(req.params.id);
  res.json({ ok: true });
});

app.post('/api/tv/:id/connect', async (req, res) => {
  try {
    await tv.testConnect(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post('/api/tv/:id/power-on', async (req, res) => {
  try {
    await tv.powerOn(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post('/api/tv/:id/power-off', async (req, res) => {
  try {
    await tv.powerOff(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post('/api/tv/:id/volume', async (req, res) => {
  try {
    await tv.setVolume(req.params.id, req.body?.delta || 1);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post('/api/tv/:id/mute', async (req, res) => {
  try {
    await tv.mute(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post('/api/tv/:id/button', async (req, res) => {
  try {
    await tv.pressButton(req.params.id, req.body?.name);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post('/api/tv/:id/input', async (req, res) => {
  try {
    await tv.switchInput(req.params.id, req.body?.inputId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Fridge server running on http://localhost:${PORT}`);
});

const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const keyPath = path.join(CERTS_DIR, 'key.pem');
const certPath = path.join(CERTS_DIR, 'cert.pem');
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  https
    .createServer({ key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }, app)
    .listen(HTTPS_PORT, () => {
      console.log(`Fridge server also running on https://localhost:${HTTPS_PORT}`);
    });
} else {
  console.log('No dev certs found in server/certs — HTTPS server not started.');
}
