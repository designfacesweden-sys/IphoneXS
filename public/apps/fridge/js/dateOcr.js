let workerPromise = null;

function getWorker() {
  if (!workerPromise) {
    workerPromise = import('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js').then(
      ({ createWorker }) => createWorker('eng')
    );
  }
  return workerPromise;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function monthFromAbbr(abbr) {
  return MONTHS.indexOf(abbr.toUpperCase().slice(0, 3)) + 1;
}

function makeDate(day, month, year) {
  const y = String(year).length === 2 ? `20${year}` : String(year);
  const d = new Date(Number(y), Number(month) - 1, Number(day));
  if (Number.isNaN(d.getTime())) return null;
  // Sanity check: printed shelf dates are never more than ~5 years out.
  const fiveYearsFromNow = new Date();
  fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);
  if (d < new Date(2020, 0, 1) || d > fiveYearsFromNow) return null;
  return d.toISOString().slice(0, 10);
}

// Ordered by specificity — more distinctive patterns (month names) first, so
// a "20 JAN 2027" isn't misread by a looser numeric-only pattern.
const DATE_PATTERNS = [
  {
    re: /(\d{1,2})\s*[.\-\/]?\s*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\S*\s*(\d{2,4})/i,
    parse: (m) => makeDate(m[1], monthFromAbbr(m[2]), m[3]),
  },
  {
    re: /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/,
    parse: (m) => makeDate(m[3], m[2], m[1]),
  },
  {
    re: /(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/,
    parse: (m) => makeDate(m[1], m[2], m[3]),
  },
];

export function parseDateFromText(text) {
  for (const { re, parse } of DATE_PATTERNS) {
    const match = text.match(re);
    if (match) {
      const date = parse(match);
      if (date) return date;
    }
  }
  return null;
}

export async function readDateFromCanvas(canvas) {
  const worker = await getWorker();
  const {
    data: { text },
  } = await worker.recognize(canvas);
  return parseDateFromText(text || '');
}
