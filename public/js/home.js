// Add new apps here as they're built — the grid lays itself out, 3 per row.
const apps = [
  {
    name: 'Fridge',
    href: '/apps/fridge/',
    gradient: 'linear-gradient(160deg, #3fbf6a, #1f8f4a)',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2.5"/>
      <line x1="5" y1="9" x2="19" y2="9"/>
      <line x1="16.5" y1="4.5" x2="16.5" y2="7"/>
      <line x1="16.5" y1="11.5" x2="16.5" y2="14"/>
    </svg>`,
  },
  {
    name: 'Economy',
    href: '/apps/economy/',
    gradient: 'linear-gradient(160deg, #4a9eff, #1f5fbf)',
    icon: `<svg viewBox="0 0 24 24" fill="white">
      <rect x="4" y="13" width="4" height="8" rx="1"/>
      <rect x="10" y="8" width="4" height="13" rx="1"/>
      <rect x="16" y="3" width="4" height="18" rx="1"/>
    </svg>`,
  },
  {
    name: 'Chores',
    href: '/apps/chores/',
    gradient: 'linear-gradient(160deg, #ff9f4a, #cc5f1f)',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="4 6 6 8 9 4"/>
      <line x1="12" y1="6" x2="20" y2="6"/>
      <polyline points="4 13 6 15 9 11"/>
      <line x1="12" y1="13" x2="20" y2="13"/>
      <line x1="4" y1="19" x2="9" y2="19"/>
      <line x1="12" y1="19" x2="20" y2="19"/>
    </svg>`,
  },
];

const grid = document.getElementById('app-grid');
grid.innerHTML = apps
  .map(
    (app) => `
    <a class="app-icon" href="${app.href}">
      <span class="glyph" style="background:${app.gradient}">${app.icon}</span>
      <span class="label">${app.name}</span>
    </a>`
  )
  .join('');

function tickClock() {
  const now = new Date();
  document.getElementById('clock').textContent = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}
tickClock();
setInterval(tickClock, 15000);
