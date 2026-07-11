export const CATALOG_LOOKUP_PRODUCT_SELECT =
  'id, name, brand, category, region, default_pao_months, source, catalog_source_id:source_id, source_ref, source_url, source_snapshot_date, quality_grade, review_status, data_quality_score, ingredient_parse_status, ingredient_parse_confidence, catalog_sources:source_id(id, display_name, source_key, attribution_text, attribution_url), product_pao_expiry(pao_months, pao_source, expiry_date, expiry_source, region, source_id, review_status, created_at)' as const;

export const REVIEWED_CATALOG_FRESHNESS_FILTER = {
  column: 'product_pao_expiry.review_status',
  value: 'reviewed',
} as const;

export function externalCatalogProvenance(barcode: string, snapshotDate: string | null) {
  return {
    region: null,
    default_pao_months: null,
    source: 'open_beauty_facts' as const,
    catalog_source_id: null,
    catalog_sources: null,
    source_ref: barcode,
    source_url: `https://world.openbeautyfacts.org/product/${barcode}`,
    source_snapshot_date: snapshotDate,
    product_pao_expiry: [],
  };
}
