// Weeks run Monday–Sunday. weekIndex is a stable, ever-increasing counter so
// rotation is deterministic and needs no stored history — it flips exactly
// at every Monday.
const EPOCH = new Date(2020, 0, 6); // a Monday

export function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekIndex(date) {
  const start = getWeekStart(date);
  return Math.floor((start - EPOCH) / (7 * 86400000));
}

export function weekLabel(date) {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts = { day: 'numeric', month: 'short' };
  return `${start.toLocaleDateString('en-GB', opts)} – ${end.toLocaleDateString('en-GB', opts)}`;
}

// Shifts by one chore per week so nobody repeats the same chore two weeks
// running, and (when chores.length <= people.length) nobody double-books
// within the same week.
export function assignChore(chores, people, weekIndex, choreIndex) {
  if (people.length === 0) return null;
  return people[(weekIndex + choreIndex) % people.length];
}
