# Phase 4 First Curated Product Batch

Date: 2026-07-04

## Status

Not production populated.

The repository includes `scripts/phase4/fixtures/curated-products.sample.json` as a structure-only fixture. It is not a reviewed launch batch and must not be used as production product data.

## Why This Is Blocked

A real first batch requires:

- approved source routes;
- brand/legal attribution decisions;
- beta shelf input;
- product identity review;
- ingredient-list review;
- sunscreen/OTC-adjacent handling;
- import QA with zero blockers.

Creating 2,000 unverified rows locally would make the product look complete while lowering trust. That is the opposite of the Phase 4 requirement.

## Batch Acceptance Criteria

Each production row must have:

- source and source reference;
- snapshot date;
- brand/name/category;
- barcode when available;
- raw ingredient text if the row can drive product-level guidance;
- parser version and confidence;
- quality grade;
- review status;
- unresolved correction count of zero for recommendable rows.

## Next Action

Use the beta shelf intake list and approved source exports to create the first import artifact, then run:

```bash
npm run phase4:import-obf-fixture
npm run phase4:qa-report
```

For production, pass the approved export path into `scripts/phase4/import-obf-snapshot.mjs` and attach the generated QA outputs to the launch review packet.
