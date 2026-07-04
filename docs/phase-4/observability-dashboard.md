# Phase 4 Catalog Observability Dashboard

Date: 2026-07-04

## Required Metrics

| Metric | Source | Launch threshold |
| --- | --- | --- |
| Barcode match rate | `catalog_lookup_events` | beta trend improving; category-specific misses reviewed |
| Search success rate | `catalog_lookup_events` | no major product-category dead zone |
| Manual fallback rate | shelf `added_via=manual` | acceptable only if users still complete shelf setup |
| OCR parse confidence | parser result / `product_ingredient_lists` | low-confidence rows routed to review |
| Unknown ingredient token rate | parser result | no silent drops; top unknowns curated |
| Wrong-match reports | `catalog_corrections` | all open/triaged rows block rec eligibility |
| Missing-product reports | `catalog_corrections` | feed curation priority |
| Recommendation-eligible products | products quality model | visible by category and routine role |
| OBF queue status | `obf_contribution_queue` | no user promise until live |
| Import QA blockers | `catalog_quality_reports` | zero blockers before launch batch |

## Events

Client/server events should use content-minimal properties:

- `catalog_barcode_lookup`
- `catalog_search`
- `catalog_lookup_no_match`
- `catalog_manual_fallback_started`
- `catalog_manual_fallback_saved`
- `catalog_correction_reported`
- `ingredient_parse_completed`

Do not send full ingredient lists, product photos, user notes, or health profile values to analytics.

## Alerts

- Barcode match rate drops below beta baseline.
- Wrong-match reports exceed 2% of matched scans.
- Parser unknown-token rate exceeds 15% for a launch category.
- Any product with `quality_grade` lower than `usable` is used in a product-specific recommendation.
- OBF import uses API search/bulk calls instead of export artifacts.

