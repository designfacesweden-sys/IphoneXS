import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import LGTV from 'lgtv2';
import wol from 'wake_on_lan';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, 'tv-config.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return { tvs: [] };
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return { tvs: [] };
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

const connections = new Map(); // tv id -> lgtv2 instance
const connectedIds = new Set(); // tv ids currently connected, tracked via events

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function listTVs() {
  return loadConfig().tvs.map(({ id, name, host, mac }) => ({ id, name, host, mac }));
}

export function addTV({ name, host, mac }) {
  const config = loadConfig();
  const tv = { id: makeId(), name, host, mac: mac || null, clientKey: null };
  config.tvs.push(tv);
  saveConfig(config);
  return { id: tv.id, name: tv.name, host: tv.host, mac: tv.mac };
}

export function removeTV(id) {
  const config = loadConfig();
  config.tvs = config.tvs.filter((tv) => tv.id !== id);
  saveConfig(config);
  const conn = connections.get(id);
  if (conn) {
    conn.disconnect();
    connections.delete(id);
  }
}

function getConnection(id) {
  if (connections.has(id)) return connections.get(id);

  const config = loadConfig();
  const tv = config.tvs.find((t) => t.id === id);
  if (!tv) throw new Error('Unknown TV.');

  const lgtv = LGTV({
    url: `ws://${tv.host}:3000`,
    reconnect: 3000,
    clientKey: tv.clientKey || undefined,
    saveKey: (key, callback) => {
      const cfg = loadConfig();
      const entry = cfg.tvs.find((t) => t.id === id);
      if (entry) {
        entry.clientKey = key;
        saveConfig(cfg);
      }
      callback();
    },
  });

  lgtv.on('connect', () => connectedIds.add(id));
  lgtv.on('close', () => connectedIds.delete(id));
  lgtv.on('error', () => connectedIds.delete(id));

  connections.set(id, lgtv);
  return lgtv;
}

// Waits for the connection to be ready (or fails — including while the TV is
// showing its one-time pairing prompt, which the caller should surface).
function whenConnected(lgtv, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Timed out connecting to TV — check it is on, reachable, and (first time) accept the pairing prompt on the TV screen.'));
      }
    }, timeoutMs);

    lgtv.once('connect', () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve();
      }
    });
    lgtv.once('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  });
}

async function withTV(id, fn) {
  const lgtv = getConnection(id);
  if (!connectedIds.has(id)) {
    await whenConnected(lgtv);
  }
  return fn(lgtv);
}

export async function powerOn(id) {
  const config = loadConfig();
  const tv = config.tvs.find((t) => t.id === id);
  if (!tv) throw new Error('Unknown TV.');
  if (!tv.mac) throw new Error('No MAC address saved for this TV — cannot wake it from off.');
  return new Promise((resolve, reject) => {
    wol.wake(tv.mac, (err) => (err ? reject(err) : resolve()));
  });
}

export async function powerOff(id) {
  return withTV(id, (lgtv) => lgtv.request('ssap://system/turnOff'));
}

// Triggers connection (and the one-time on-screen pairing prompt) without
// changing anything on the TV — used by the Setup screen.
export async function testConnect(id) {
  return withTV(id, () => true);
}

export async function setVolume(id, delta) {
  return withTV(id, (lgtv) => lgtv.request(delta > 0 ? 'ssap://audio/volumeUp' : 'ssap://audio/volumeDown'));
}

export async function mute(id) {
  return withTV(id, async (lgtv) => {
    const status = await lgtv.request('ssap://audio/getStatus');
    return lgtv.request('ssap://audio/setMute', { mute: !status?.mute });
  });
}

export async function pressButton(id, name) {
  return withTV(id, async (lgtv) => {
    const sock = await lgtv.getSocket('ssap://com.webos.service.networkinput/getPointerInputSocket');
    sock.send('button', { name });
  });
}

export async function switchInput(id, inputId) {
  return withTV(id, (lgtv) => lgtv.request('ssap://tv/switchInput', { inputId }));
}
