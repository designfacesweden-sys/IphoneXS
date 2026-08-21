export async function lookupProduct(barcode) {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;

  const p = data.product;
  return {
    name: p.product_name || p.generic_name || 'Unknown product',
    brand: p.brands || '',
    imageUrl: p.image_front_small_url || p.image_url || '',
    categories: p.categories || '',
    nutriScore: (p.nutriscore_grade || '').toUpperCase() || null,
  };
}

export async function fetchRecipes(items, preferences) {
  const res = await fetch('/api/recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, preferences }),
  });
  if (!res.ok) throw new Error('Recipe request failed');
  return res.json();
}
