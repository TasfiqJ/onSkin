export const CATALOG_SEARCH_MIN_QUERY_LENGTH = 2;
export const CATALOG_SEARCH_MAX_QUERY_LENGTH = 80;

export function normalizeCatalogSearchQuery(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CATALOG_SEARCH_MAX_QUERY_LENGTH);
}

export function catalogSearchTerm(value: unknown): string {
  return normalizeCatalogSearchQuery(value)
    .replace(/[%_,()\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isCatalogSearchQueryEligible(value: unknown): boolean {
  return catalogSearchTerm(value).length >= CATALOG_SEARCH_MIN_QUERY_LENGTH;
}
