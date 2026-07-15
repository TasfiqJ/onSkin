# Phase 4 Open Beauty Facts Source Memo

Date: 2026-07-04

## Source

Open Beauty Facts is the cosmetic/personal-care sibling of Open Food Facts.

- Open Beauty Facts API wiki: https://wiki.openfoodfacts.org/API/OpenBeautyFacts
- Product Opener API documentation: https://openfoodfacts.github.io/openfoodfacts-server/api/
- Source-candidate use in OnSkin: reviewed offline catalog artifacts for product identity, brand/name/category, and ingredient text. Request-time lookup and contribution are disabled unless a later reviewed processor/inventory change explicitly approves them.

## Verified Facts

- Product Opener documentation describes an open database model with ODbL/database-content/image licensing distinctions.
- Product Opener requires a custom User-Agent for API reads.
- Product Opener warns bulk users to use exports rather than API crawling.
- Search-as-you-type and bulk API import are disallowed for OnSkin until explicit permission exists.
- Product data is community-maintained and must be treated as possibly incomplete or inaccurate.
- A user's exact barcode/product lookup is product-interest data and may be health-inferential. Sending it to Open Beauty Facts would create a live recipient that the current empty external-health-processor inventory, sharing notice, retention/deletion plan, and provider evidence do not cover.

## Allowed Product Behavior

Allowed before legal signoff:

- Fixture import from local sample data.
- Exact barcode lookup against reviewed rows already stored in the local Supabase catalog.
- Reviewed offline snapshot/export transformation with no user request attached and no runtime provider call.
- Source/last-updated/quality disclosure on product detail.
- Wrong-match and missing-product reports.

Blocked before legal/compliance signoff:

- Bulk production import.
- Product images.
- Request-time Open Beauty Facts API calls, including exact barcode lookup. The retired `OBF_API_ENABLED` flag cannot enable transport.
- Public claims that Open Beauty Facts data is complete or always accurate.
- Contribution-back promises. `OBF_CONTRIBUTION_ENABLED` is intentionally inert until the enqueue RPC accepts an expected health-processing epoch and atomically proves active, current-copy consent in the same transaction.
- Search-as-you-type API calls.

## Implementation Notes

Schema support exists in `catalog_sources`, `catalog_import_batches`, `products`, `product_barcodes`, `product_ingredient_lists`, `catalog_corrections`, and `obf_contribution_queue`.

Correction reporting remains enabled, but `catalog-report` does not enqueue contribution-back jobs. A server-side status preflight cannot close the withdrawal race between that check and a service-role enqueue call; contribution-back may be restored only after the enqueue RPC owns the active-consent and expected-epoch assertion atomically. Setting `OBF_CONTRIBUTION_ENABLED=true` currently emits a stable suppression warning for eligible reports and does not create a queue row.

`catalog-lookup` queries only reviewed Supabase catalog rows. It contains no Open Beauty Facts origin, request helper, response parser, live API flag, or external-candidate response; a miss records owner-scoped `no_match` telemetry and returns the manual-entry fallback. Development/UI fixtures and offline import mappers are explicitly non-network and use non-routable `.invalid` provenance in app source.

The seeded `open_beauty_facts` source is `production_approved=false`, `requires_attribution=true`, `requires_share_alike=true`, and `allows_images=false`.

## Exit Criteria

- Legal approves ODbL/database contents/image posture.
- Final app name, version, contact email, and attribution URL exist.
- Bulk import runs from export artifacts, never API crawling.
- Any proposal for live lookup or contribution issues a new health-processor inventory version and supplies reviewed sharing purpose/consent, provider terms/DPA, retention, deletion/reconciliation, policy, and release-network evidence before code or configuration can enable it.
- QA report proves category filtering, barcode quality, parser confidence, and unresolved-correction gates.
- Attribution and report-issue UI are visible before product-level recommendations use OBF-derived rows.
