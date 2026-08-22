// The main hub lives on Render; this page runs locally (TVs are only
// reachable over the home LAN). Point Home back at the canonical hub so
// Fridge/Economy/Chores data stays consistent with everyday use.
const HUB_URL = 'https://iphonexs-hub.onrender.com/';
document.getElementById('home-link').href = HUB_URL;

const screens = document.querySelectorAll('.screen');
const tabs = document.querySelectorAll('.tab');
const clockEl = document.getElementById('clock');

let tvs = [];
let selectedId = null;

function showScreen(name) {
  screens.forEach((s) => s.classList.toggle('active', s.id === `screen-${name}`));
  tabs.forEach((t) => t.classList.toggle('active', t.dataset.screen === name));
  if (name === 'setup') renderSetup();
  if (name === 'control') renderControl();
}
tabs.forEach((tab) => tab.addEventListener('click', () => showScreen(tab.dataset.screen)));

function tickClock() {
  clockEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
tickClock();
setInterval(tickClock, 15000);

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function fetchTVs() {
  const res = await fetch('/api/tv');
  const data = await res.json();
  tvs = data.tvs || [];
  return tvs;
}

async function callTV(id, path, body) {
  const res = await fetch(`/api/tv/${id}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

// ---- control screen ----
async function renderControl() {
  await fetchTVs();
  const select = document.getElementById('tv-select');
  const empty = document.getElementById('control-empty');
  const body = document.getElementById('control-body');

  if (tvs.length === 0) {
    select.innerHTML = '';
    empty.hidden = false;
    body.hidden = true;
    return;
  }
  empty.hidden = true;
  body.hidden = false;

  if (!selectedId || !tvs.some((t) => t.id === selectedId)) {
    selectedId = tvs[0].id;
  }

  select.innerHTML = tvs
    .map(
      (t) => `<button class="tv-chip ${t.id === selectedId ? 'active' : ''}" data-id="${t.id}">${escapeHtml(t.name)}</button>`
    )
    .join('');

  select.querySelectorAll('.tv-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedId = btn.dataset.id;
      renderControl();
    });
  });
}

const status = document.getElementById('control-status');
function setStatus(text) {
  status.textContent = text;
}

async function runAction(path, body) {
  if (!selectedId) return;
  try {
    setStatus('Sending…');
    await callTV(selectedId, path, body);
    setStatus('');
  } catch (err) {
    setStatus(err.message || String(err));
  }
}

document.getElementById('power-on').addEventListener('click', () => runAction('/power-on'));
document.getElementById('power-off').addEventListener('click', () => runAction('/power-off'));
document.getElementById('vol-up').addEventListener('click', () => runAction('/volume', { delta: 1 }));
document.getElementById('vol-down').addEventListener('click', () => runAction('/volume', { delta: -1 }));
document.getElementById('vol-mute').addEventListener('click', () => runAction('/mute'));

document.querySelectorAll('[data-btn]').forEach((btn) => {
  btn.addEventListener('click', () => runAction('/button', { name: btn.dataset.btn }));
});

// ---- setup screen ----
async function renderSetup() {
  await fetchTVs();
  const list = document.getElementById('tv-list');
  list.innerHTML = tvs
    .map(
      (t) => `
    <li class="simple-item">
      <div>
        <div class="name">${escapeHtml(t.name)}</div>
        <div class="host">${escapeHtml(t.host)}${t.mac ? ` · ${escapeHtml(t.mac)}` : ''}</div>
      </div>
      <button class="test" data-id="${t.id}">Test</button>
      <button class="remove" data-id="${t.id}">×</button>
    </li>`
    )
    .join('');

  list.querySelectorAll('.test').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.textContent = '…';
      try {
        const res = await fetch(`/api/tv/${btn.dataset.id}/connect`, { method: 'POST' });
        const data = await res.json();
        btn.textContent = res.ok ? 'OK' : 'Failed';
        if (!res.ok) console.error(data.error);
      } catch {
        btn.textContent = 'Failed';
      }
      setTimeout(() => {
        btn.textContent = 'Test';
      }, 2000);
    });
  });

  list.querySelectorAll('.remove').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await fetch(`/api/tv/${btn.dataset.id}`, { method: 'DELETE' });
      renderSetup();
    });
  });
}

document.getElementById('add-tv').addEventListener('click', async () => {
  const name = document.getElementById('tv-name').value.trim();
  const host = document.getElementById('tv-host').value.trim();
  const mac = document.getElementById('tv-mac').value.trim();
  if (!name || !host) return;

  await fetch('/api/tv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, host, mac: mac || null }),
  });

  document.getElementById('tv-name').value = '';
  document.getElementById('tv-host').value = '';
  document.getElementById('tv-mac').value = '';
  renderSetup();
});

// ---- init ----
renderControl();
