# Phase 4 Open Beauty Facts Source Memo

Date: 2026-07-04

## Source

Open Beauty Facts is the cosmetic/personal-care sibling of Open Food Facts.

- Open Beauty Facts API wiki: https://wiki.openfoodfacts.org/API/OpenBeautyFacts
- Product Opener API documentation: https://openfoodfacts.github.io/openfoodfacts-server/api/
- Intended use in OnSkin: barcode lookup, product identity, brand/name/category, ingredient text when available, and correction/contribution workflow if approved.

## Verified Facts

- Product Opener documentation describes an open database model with ODbL/database-content/image licensing distinctions.
- Product Opener requires a custom User-Agent for API reads.
- Product Opener warns bulk users to use exports rather than API crawling.
- Search-as-you-type and bulk API import are disallowed for OnSkin until explicit permission exists.
- Product data is community-maintained and must be treated as possibly incomplete or inaccurate.

## Allowed Product Behavior

Allowed before legal signoff:

- Fixture import from local sample data.
- Exact barcode lookup behind a configured custom User-Agent.
- Source/last-updated/quality disclosure on product detail.
- Wrong-match and missing-product reports.

Blocked before legal/compliance signoff:

- Bulk production import.
- Product images.
- Public claims that Open Beauty Facts data is complete or always accurate.
- Contribution-back promises unless `OBF_CONTRIBUTION_ENABLED=true`, account credentials exist, and the queue job has passed QA.
- Search-as-you-type API calls.

## Implementation Notes

Schema support exists in `catalog_sources`, `catalog_import_batches`, `products`, `product_barcodes`, `product_ingredient_lists`, `catalog_corrections`, and `obf_contribution_queue`.

The seeded `open_beauty_facts` source is `production_approved=false`, `requires_attribution=true`, `requires_share_alike=true`, and `allows_images=false`.

## Exit Criteria

- Legal approves ODbL/database contents/image posture.
- Final app name, version, contact email, and attribution URL exist.
- Bulk import runs from export artifacts, never API crawling.
- QA report proves category filtering, barcode quality, parser confidence, and unresolved-correction gates.
- Attribution and report-issue UI are visible before product-level recommendations use OBF-derived rows.
