import { getPeople, addPerson, removePerson, getChores, addChore, removeChore, getCompletions, setCompletion } from './db.js';
import { getWeekIndex, weekLabel, assignChore } from './rotation.js';

const screens = document.querySelectorAll('.screen');
const tabs = document.querySelectorAll('.tab');
const clockEl = document.getElementById('clock');

let viewedDate = new Date();

function showScreen(name) {
  screens.forEach((s) => s.classList.toggle('active', s.id === `screen-${name}`));
  tabs.forEach((t) => t.classList.toggle('active', t.dataset.screen === name));
  if (name === 'week') renderWeek();
  if (name === 'people') renderPeople();
  if (name === 'chores') renderChores();
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => showScreen(tab.dataset.screen));
});

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

// ---- this week ----
async function renderWeek() {
  document.getElementById('week-label').textContent = weekLabel(viewedDate);

  const [people, chores, completions] = await Promise.all([getPeople(), getChores(), getCompletions()]);
  const weekIndex = getWeekIndex(viewedDate);
  const doneSet = new Set(completions.filter((c) => c.done).map((c) => c.id));

  const list = document.getElementById('week-list');
  const empty = document.getElementById('week-empty');

  if (people.length === 0 || chores.length === 0) {
    list.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  list.innerHTML = chores
    .map((chore, i) => {
      const person = assignChore(chores, people, weekIndex, i);
      const completionId = `${weekIndex}-${chore.id}`;
      const done = doneSet.has(completionId);
      return `
        <li class="chore-item ${done ? 'done' : ''}" data-completion-id="${completionId}">
          <span class="check">✓</span>
          <div class="info">
            <div class="chore-name">${escapeHtml(chore.name)}</div>
            <div class="assignee">${escapeHtml(person?.name || 'Unassigned')}</div>
          </div>
        </li>`;
    })
    .join('');

  list.querySelectorAll('.chore-item').forEach((el) => {
    el.addEventListener('click', async () => {
      const id = el.dataset.completionId;
      const nowDone = !el.classList.contains('done');
      el.classList.toggle('done', nowDone);
      await setCompletion(id, nowDone);
    });
  });
}

document.getElementById('prev-week').addEventListener('click', () => {
  viewedDate = new Date(viewedDate.getTime() - 7 * 86400000);
  renderWeek();
});
document.getElementById('next-week').addEventListener('click', () => {
  viewedDate = new Date(viewedDate.getTime() + 7 * 86400000);
  renderWeek();
});

// ---- people ----
async function renderPeople() {
  const people = await getPeople();
  const list = document.getElementById('people-list');
  list.innerHTML = people
    .map(
      (p) => `
    <li class="simple-item">
      <span class="name">${escapeHtml(p.name)}</span>
      <button class="remove" data-id="${p.id}">×</button>
    </li>`
    )
    .join('');

  list.querySelectorAll('.remove').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await removePerson(btn.dataset.id);
      renderPeople();
    });
  });
}

document.getElementById('add-person').addEventListener('click', async () => {
  const input = document.getElementById('person-name');
  const name = input.value.trim();
  if (!name) return;
  await addPerson(name);
  input.value = '';
  renderPeople();
});

// ---- chores management ----
async function renderChores() {
  const chores = await getChores();
  const list = document.getElementById('chores-list');
  list.innerHTML = chores
    .map(
      (c) => `
    <li class="simple-item">
      <span class="name">${escapeHtml(c.name)}</span>
      <button class="remove" data-id="${c.id}">×</button>
    </li>`
    )
    .join('');

  list.querySelectorAll('.remove').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await removeChore(btn.dataset.id);
      renderChores();
    });
  });
}

document.getElementById('add-chore').addEventListener('click', async () => {
  const input = document.getElementById('chore-name');
  const name = input.value.trim();
  if (!name) return;
  await addChore(name);
  input.value = '';
  renderChores();
});

// ---- init ----
renderWeek();
