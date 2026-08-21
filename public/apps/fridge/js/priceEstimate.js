// Rough, offline guesses for common Swedish grocery categories — a fast
// stand-in so scanning never blocks on typing a price or expiry date.
// [match pattern, price in SEK, typical shelf life in days from purchase]
const RULES = [
  [/mjölk|milk|fil\b|yoghurt|yogurt/i, 18, 7],
  [/ost\b|cheese|halloumi/i, 65, 21],
  [/smör|butter|margarin/i, 38, 60],
  [/ägg|egg/i, 48, 21],
  [/bröd|bread|fralla|baguette/i, 32, 5],
  [/pasta|spaghetti|makaron/i, 20, 365],
  [/ris\b|rice|couscous|bulgur/i, 26, 365],
  [/kyckling|chicken/i, 65, 2],
  [/nötkött|biff|beef|fläsk|pork|köttfärs|korv|sausage/i, 75, 3],
  [/lax|salmon|fisk|fish|räkor|shrimp/i, 90, 2],
  [/äpple|banan|apple|banana|frukt|fruit|apelsin|orange|citron|lemon/i, 14, 7],
  [/potatis|potato|tomat|tomato|gurka|cucumber|sallad|lettuce|grönsak|vegetable|lök|onion|paprika/i, 18, 7],
  [/läsk|soda|juice|dricka|drink/i, 22, 180],
  [/kaffe|coffee/i, 55, 270],
  [/te\b|tea\b/i, 35, 365],
  [/glass|ice cream/i, 28, 120],
  [/choklad|chocolate|godis|candy|kex|cookie/i, 28, 180],
  [/chips|snacks|nötter|nuts/i, 30, 90],
  [/fryst|frozen/i, 42, 180],
  [/konserv|can\b|burk/i, 18, 730],
  [/krydda|kryddor|spice/i, 22, 365],
  [/olja|oil|vinäger|vinegar/i, 35, 365],
  [/mjöl|flour|socker|sugar/i, 20, 365],
];

const DEFAULT_PRICE = 25;
const DEFAULT_SHELF_LIFE_DAYS = 10;

function matchRule({ name = '', categories = '' } = {}) {
  const haystack = `${name} ${categories}`.toLowerCase();
  return RULES.find(([pattern]) => pattern.test(haystack));
}

export function estimatePrice(product) {
  const match = matchRule(product);
  return match ? match[1] : DEFAULT_PRICE;
}

export function estimateExpiryDate(product) {
  const match = matchRule(product);
  const days = match ? match[2] : DEFAULT_SHELF_LIFE_DAYS;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10); // YYYY-MM-DD, matches <input type="date">
}
