import { getAllTransactions, addTransaction, deleteTransaction } from './db.js';

const screens = document.querySelectorAll('.screen');
const tabs = document.querySelectorAll('.tab');
const clockEl = document.getElementById('clock');

const today = new Date();
let viewedMonth = { year: today.getFullYear(), month: today.getMonth() }; // month: 0-11
let viewedYear = today.getFullYear();

// ---- navigation ----
function showScreen(name) {
  screens.forEach((s) => s.classList.toggle('active', s.id === `screen-${name}`));
  tabs.forEach((t) => t.classList.toggle('active', t.dataset.screen === name));
  if (name === 'month') renderMonth();
  if (name === 'yearly') renderYearly();
  if (name === 'add') {
    document.getElementById('entry-date').value = new Date().toISOString().slice(0, 10);
  }
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => showScreen(tab.dataset.screen));
});

// ---- clock ----
function tickClock() {
  const now = new Date();
  clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
tickClock();
setInterval(tickClock, 15000);

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatKr(amount) {
  return `${Math.round(amount).toLocaleString('sv-SE')} kr`;
}

// ---- month screen ----
async function renderMonth() {
  const label = new Date(viewedMonth.year, viewedMonth.month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  document.getElementById('month-label').textContent = label;

  const all = await getAllTransactions();
  const entries = all
    .filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === viewedMonth.year && d.getMonth() === viewedMonth.month;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const total = entries.reduce((sum, t) => sum + (t.amount || 0), 0);
  document.getElementById('month-total').textContent = formatKr(total);

  const list = document.getElementById('tx-list');
  const empty = document.getElementById('month-empty');
  empty.hidden = entries.length > 0;

  list.innerHTML = entries
    .map(
      (t) => `
    <li class="tx-item">
      <div class="info">
        <div class="name">${escapeHtml(t.name)}</div>
        <div class="date">${new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
      </div>
      <div class="amount">${formatKr(t.amount)}</div>
      <button class="remove" data-id="${t.id}">×</button>
    </li>`
    )
    .join('');

  list.querySelectorAll('.remove').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await deleteTransaction(btn.dataset.id);
      renderMonth();
    });
  });
}

document.getElementById('prev-month').addEventListener('click', () => {
  const d = new Date(viewedMonth.year, viewedMonth.month - 1, 1);
  viewedMonth = { year: d.getFullYear(), month: d.getMonth() };
  renderMonth();
});
document.getElementById('next-month').addEventListener('click', () => {
  const d = new Date(viewedMonth.year, viewedMonth.month + 1, 1);
  viewedMonth = { year: d.getFullYear(), month: d.getMonth() };
  renderMonth();
});

// ---- add screen ----
document.getElementById('save-entry').addEventListener('click', async () => {
  const name = document.getElementById('entry-name').value.trim();
  const amount = Number(document.getElementById('entry-amount').value);
  const date = document.getElementById('entry-date').value;

  if (!name || !amount || !date) {
    return;
  }

  await addTransaction({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    amount,
    date,
  });

  document.getElementById('entry-name').value = '';
  document.getElementById('entry-amount').value = '';

  const d = new Date(date);
  viewedMonth = { year: d.getFullYear(), month: d.getMonth() };
  showScreen('month');
});

// ---- yearly screen ----
async function renderYearly() {
  document.getElementById('year-label').textContent = String(viewedYear);

  const all = await getAllTransactions();
  const inYear = all.filter((t) => new Date(t.date).getFullYear() === viewedYear);

  const monthTotals = new Array(12).fill(0);
  inYear.forEach((t) => {
    monthTotals[new Date(t.date).getMonth()] += t.amount || 0;
  });

  const yearTotal = monthTotals.reduce((a, b) => a + b, 0);
  document.getElementById('year-total').textContent = formatKr(yearTotal);
  document.getElementById('year-average').textContent = formatKr(yearTotal / 12);

  const maxMonth = Math.max(...monthTotals, 1);
  const now = new Date();

  document.getElementById('year-breakdown').innerHTML = monthTotals
    .map((amount, i) => {
      const isCurrent = viewedYear === now.getFullYear() && i === now.getMonth();
      const monthName = new Date(viewedYear, i, 1).toLocaleDateString('en-US', { month: 'long' });
      const pct = Math.round((amount / maxMonth) * 100);
      return `
        <div class="year-row ${isCurrent ? 'is-current' : ''}">
          <div class="yr-top">
            <span class="yr-month">${monthName}</span>
            <span class="yr-amount">${formatKr(amount)}</span>
          </div>
          <div class="year-bar-track"><div class="year-bar-fill" style="width:${pct}%"></div></div>
        </div>`;
    })
    .join('');
}

document.getElementById('prev-year').addEventListener('click', () => {
  viewedYear -= 1;
  renderYearly();
});
document.getElementById('next-year').addEventListener('click', () => {
  viewedYear += 1;
  renderYearly();
});

// ---- init ----
renderMonth();
