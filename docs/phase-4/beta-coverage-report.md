# Phase 4 Beta Coverage Report

Date: 2026-07-04

## Current Status

No closed beta catalog coverage data exists yet. This remains a launch blocker.
`npm run phase4:beta-coverage-report` now generates
`docs/phase-4/generated/beta-coverage-report.{json,md}` from a real beta export
when `PHASE4_BETA_COVERAGE_INPUT` is set, or from
`docs/phase-4/beta-coverage-input.json` by default. Non-strict mode records a
blocked packet when the input is missing. Strict mode must fail until real beta
evidence, dashboard links, and a named signoff are attached.

## Required Beta Inputs

- 50-100 user closed beta cohort.
- Shelf products added by barcode/search/OCR/manual.
- Per-category match rate.
- Top no-match barcodes and product names.
- Wrong-match reports.
- Ingredient parser unknown-token top list.
- Products users expected recommendations for.
- Support tickets involving trust, accuracy, or source confusion.
- Real catalog/beta, analytics, and support dashboard URLs.
- Source export hash and named beta coverage signoff.

## Pass Conditions

Phase 4 can support a seven-figure thesis only if beta shows:

- users can add their real shelf without giving up;
- the app can recognize enough common products to feel credible;
- manual fallback is fast enough when catalog matching fails;
- wrong-match reporting is obvious;
- product detail source and quality disclosure reduces confusion;
- recommendation product rows are restricted to `verified` or `usable` data.
- wrong-match reports stay at or below the 2% alert threshold;
- parser unknown-token rate stays at or below the 15% alert threshold;
- open P0/P1 support issues and open wrong-match reports are resolved before
  the packet is used for launch decisions.

## Current Blockers

- `B-CLOSED-BETA`
- `B-CATALOG-SOURCE-REVIEW`
- `B-ODBL-REVIEW`
- `B-CURATED-CATALOG`
- `B-CATALOG-COVERAGE`
