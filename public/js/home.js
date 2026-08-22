// Add new apps here as they're built — sidebar list + card grid both render
// from this one array.
const apps = [
  {
    name: 'Fridge',
    href: '/apps/fridge/',
    color: '#1f8f4a',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2.5"/>
      <line x1="5" y1="9" x2="19" y2="9"/>
      <line x1="16.5" y1="4.5" x2="16.5" y2="7"/>
      <line x1="16.5" y1="11.5" x2="16.5" y2="14"/>
    </svg>`,
    status: statFridge,
  },
  {
    name: 'Economy',
    href: '/apps/economy/',
    color: '#1f5fbf',
    icon: `<svg viewBox="0 0 24 24" fill="white">
      <rect x="4" y="13" width="4" height="8" rx="1"/>
      <rect x="10" y="8" width="4" height="13" rx="1"/>
      <rect x="16" y="3" width="4" height="18" rx="1"/>
    </svg>`,
    status: statEconomy,
  },
  {
    name: 'Chores',
    href: '/apps/chores/',
    color: '#cc5f1f',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="4 6 6 8 9 4"/>
      <line x1="12" y1="6" x2="20" y2="6"/>
      <polyline points="4 13 6 15 9 11"/>
      <line x1="12" y1="13" x2="20" y2="13"/>
      <line x1="4" y1="19" x2="9" y2="19"/>
      <line x1="12" y1="19" x2="20" y2="19"/>
    </svg>`,
    status: statChores,
  },
  {
    name: 'Remote',
    // Runs on the local LAN server, not Render — TVs are only reachable
    // from a device on the same home WiFi, never from the internet.
    href: 'http://192.168.1.181:3000/apps/remote/',
    color: '#6a2fbf',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="7" y="2" width="10" height="20" rx="3"/>
      <circle cx="12" cy="6.5" r="1.1" fill="white" stroke="none"/>
      <line x1="9.5" y1="11" x2="14.5" y2="11"/>
      <line x1="9.5" y1="14.5" x2="14.5" y2="14.5"/>
      <line x1="9.5" y1="18" x2="14.5" y2="18"/>
    </svg>`,
    status: async () => 'Control your TVs',
  },
];

// ---- shared cross-app IndexedDB read helpers ----
function openDbReadOnly(name) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllSafe(dbName, storeName) {
  try {
    const db = await openDbReadOnly(dbName);
    if (!db.objectStoreNames.contains(storeName)) {
      db.close();
      return [];
    }
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

async function statFridge() {
  const items = await getAllSafe('fridge-db', 'items');
  if (items.length === 0) return 'Nothing scanned yet';
  return `${items.length} item${items.length === 1 ? '' : 's'}`;
}

async function statEconomy() {
  const txns = await getAllSafe('economy-db', 'transactions');
  const now = new Date();
  const total = txns
    .filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  return `${Math.round(total).toLocaleString('sv-SE')} kr this month`;
}

function getWeekIndex(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + ((day === 0 ? -6 : 1) - day));
  d.setHours(0, 0, 0, 0);
  const epoch = new Date(2020, 0, 6);
  return Math.floor((d - epoch) / (7 * 86400000));
}

async function statChores() {
  const [people, chores, completions] = await Promise.all([
    getAllSafe('chores-db', 'people'),
    getAllSafe('chores-db', 'chores'),
    getAllSafe('chores-db', 'completions'),
  ]);
  if (people.length === 0 || chores.length === 0) return 'Add people & chores';

  const weekIndex = getWeekIndex(new Date());
  const doneIds = new Set(completions.filter((c) => c.done).map((c) => c.id));
  const doneCount = chores.filter((c) => doneIds.has(`${weekIndex}-${c.id}`)).length;
  return `${doneCount}/${chores.length} done this week`;
}

// ---- render ----
function iconChip(app) {
  return `<span class="chip-icon" style="background:${app.color}">${app.icon}</span>`;
}

const sidebarEl = document.getElementById('sidebar-apps');
const chipRowEl = document.getElementById('chip-row');
const cardGridEl = document.getElementById('card-grid');

sidebarEl.innerHTML = apps
  .map(
    (app) => `
    <a class="sidebar-item" href="${app.href}">
      ${app.icon.replace('fill="white"', 'fill="currentColor"').replace('stroke="white"', 'stroke="currentColor"')}
      <span>${app.name}</span>
    </a>`
  )
  .join('');

chipRowEl.innerHTML = apps
  .map(
    (app) => `
    <a class="chip" href="${app.href}">
      ${iconChip(app)}
      <span class="chip-text">
        <span class="chip-label">${app.name}</span>
        <span class="chip-value" id="chip-value-${app.name}">…</span>
      </span>
    </a>`
  )
  .join('');

cardGridEl.innerHTML = apps
  .map(
    (app) => `
    <a class="app-card" href="${app.href}">
      <span class="card-icon" style="background:${app.color}">${app.icon}</span>
      <div class="card-name">${app.name}</div>
      <div class="card-status" id="card-status-${app.name}">…</div>
    </a>`
  )
  .join('');

apps.forEach(async (app) => {
  const text = await app.status();
  const chipEl = document.getElementById(`chip-value-${app.name}`);
  const cardEl = document.getElementById(`card-status-${app.name}`);
  if (chipEl) chipEl.textContent = text;
  if (cardEl) cardEl.textContent = text;
});

function tickClock() {
  document.getElementById('clock').textContent = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}
tickClock();
setInterval(tickClock, 15000);
