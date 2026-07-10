# Phase 4 CosIng Source Memo

Date: 2026-07-04

## Source

CosIng is the European Commission cosmetic ingredient database:

- Source URL: https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database_en
- Intended use in OnSkin: ingredient dictionary baseline, INCI names, synonyms where allowed, regulatory-reference flags, and reviewer workflow support.

## Verified Facts

- CosIng is maintained by the European Commission for cosmetic substances and ingredients in the EU cosmetics framework.
- The Commission describes CosIng as informative. It is not a substitute for legal review.
- An ingredient appearing in CosIng must not be presented as "approved", "safe", or "recommended" by OnSkin.
- Annex status for colorants, preservatives, and UV filters is not equivalent to product-level safety or legality in every market.

## Allowed Product Behavior

Allowed before legal signoff:

- Store source metadata and review status.
- Import a fixture-sized dictionary for parser tests if the source path and reuse posture are documented.
- Preserve unknown tokens and low-confidence matches.
- Show ingredient names as data, not as safety claims.

Blocked before legal/compliance signoff:

- Production bulk import.
- Any "CosIng-approved" wording.
- Any safety, pregnancy, medical, or product-recommendation claim based only on CosIng presence.
- Treating EU regulatory data as U.S. product clearance.

## Implementation Notes

Schema support exists in `catalog_sources`, `ingredients`, `ingredient_synonyms`, `ingredient_tag_assignments`, and `catalog_import_batches`.

The seeded `cosing` source is `production_approved=false` and `review_status=pending`.

## Exit Criteria

- Counsel records reuse/attribution obligations.
- Cosmetic-chemist reviewer signs the ingredient-tag taxonomy.
- Import artifact hash, snapshot date, parser version, and QA report are attached to a `catalog_import_batches` record.
- Product UI copy continues to describe CosIng as a source, not as an endorsement.
