export const CATALOG_SEARCH_PRODUCT_SELECT =
  'id, barcode, name, brand, category, region, default_pao_months, source, catalog_source_id:source_id, source_ref, source_url, source_snapshot_date, quality_grade, review_status, data_quality_score, ingredient_parse_status, ingredient_parse_confidence, catalog_sources:source_id(id, display_name, source_key, attribution_text, attribution_url), product_pao_expiry(pao_months, pao_source, expiry_date, expiry_source, region, source_id, review_status, created_at)' as const;

export const REVIEWED_CATALOG_FRESHNESS_FILTER = {
  column: 'product_pao_expiry.review_status',
  value: 'reviewed',
} as const;

export const CATALOG_SEARCH_RPC = 'search_catalog_products' as const;
export const CATALOG_SEARCH_MIN_QUERY_LENGTH = 2;
export const CATALOG_SEARCH_MAX_QUERY_LENGTH = 80;
export const CATALOG_SEARCH_DEFAULT_LIMIT = 10;
export const CATALOG_SEARCH_MAX_LIMIT = 20;

/** Preserve the public query contract while keeping PostgREST/LIKE grammar out
 * of the database predicate. The RPC repeats this normalization defensively. */
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

export function catalogSearchLimit(value: unknown): number {
  if (value === null || value === undefined) {
    return CATALOG_SEARCH_DEFAULT_LIMIT;
  }
  if (typeof value !== 'number' && typeof value !== 'string') {
    return CATALOG_SEARCH_DEFAULT_LIMIT;
  }
  if (typeof value === 'string' && value.trim().length === 0) {
    return CATALOG_SEARCH_DEFAULT_LIMIT;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return CATALOG_SEARCH_DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(parsed), 1), CATALOG_SEARCH_MAX_LIMIT);
}
