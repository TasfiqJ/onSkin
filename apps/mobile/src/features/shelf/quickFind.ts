/** A transient scan of the admitted device Shelf, preserving its existing order.
 * No ingredients, clinical tags, provider lookup, persistence or query telemetry. */
export function findSavedProducts<T extends { name: string; brand: string | null }>(
  products: readonly T[],
  query: string,
): readonly T[] {
  const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const words = normalize(query).trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return products;
  return products.filter((product) => {
    const text = normalize(`${product.name} ${product.brand ?? ''}`);
    return words.every((word) => text.includes(word));
  });
}
