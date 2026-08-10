# E2E Bug Report: Shelf barcode no-match missing catalog search recovery

Severity: Medium
Surface: Expo web
Environment: Expo web on localhost, 320 x 568 viewport
Feature: Smart Shelf product intake
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/shelf/no-match` from a barcode lookup miss or direct-entry route.
2. Inspect the available recovery actions.
3. Try to recover by searching the reviewed catalog by product name or brand.

## Expected Result

The barcode no-match sheet should not dead-end. It should expose Search catalog, Scan the ingredient list, and Add it by hand recovery actions, with privacy-safe product-add analytics for each route.

## Actual Result

The no-match recovery path did not expose catalog search as a first-class recovery action, forcing users toward OCR or manual add even when a typed name or brand search is the most natural next step. The new search recovery also needed a matching `miss_search` analytics source to keep typed event metadata valid.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/shelf-no-match-search-fallback/no-match-320x568-viewport.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/shelf-no-match-search-fallback/no-match-state.json`
- Logs: `test-results/human-e2e/2026-07-07/shelf-no-match-search-fallback/browser-console-warn-error.json`

## Frequency

- Always

## Scope

- Affected route/screen: `/shelf/no-match`
- Affected account or fixture: Any barcode miss or direct-entry no-match state
- External service involved: None for Expo web verification; real barcode lookup may depend on catalog or Supabase-backed scan logging
- Destructive action involved: No

## Suspected Cause

The scan-first intake funnel already supported search from the scan screen, but the no-match sheet only carried the OCR/manual recovery framing from the earlier edge-case copy. Adding the route action required keeping the analytics source union in sync.

## Minimal Fix Recommendation

Add a Search catalog row to `/shelf/no-match`, route it to `/shelf/search` with `addedVia: 'search'`, track `product_add_started` with `miss_search`, and align the Smart Shelf spec and static route contract. Keep the compact sheet tall enough that Search, OCR, and manual add remain visible on a 320 x 568 phone viewport.

## Verification Flow After Fix

1. Open `/shelf/no-match` at 320 x 568.
2. Confirm Search catalog, Scan the ingredient list, and Add it by hand are visible and at least 44 px tall.
3. Tap each recovery action and confirm it routes to `/shelf/search`, `/shelf/ocr`, and `/shelf/manual`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/shelf-no-match-search-fallback/no-match-320x568-viewport.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/shelf-no-match-search-fallback/no-match-state.json`
- Destination screenshots:
  - `test-results/human-e2e/2026-07-07/shelf-no-match-search-fallback/search-destination.png`
  - `test-results/human-e2e/2026-07-07/shelf-no-match-search-fallback/ocr-destination.png`
  - `test-results/human-e2e/2026-07-07/shelf-no-match-search-fallback/manual-destination.png`
- Destination snapshots:
  - `test-results/human-e2e/2026-07-07/shelf-no-match-search-fallback/search-destination-state.json`
  - `test-results/human-e2e/2026-07-07/shelf-no-match-search-fallback/ocr-destination-state.json`
  - `test-results/human-e2e/2026-07-07/shelf-no-match-search-fallback/manual-destination-state.json`
- Logs: `test-results/human-e2e/2026-07-07/shelf-no-match-search-fallback/browser-console-warn-error.json`

## Remaining Risk

- Untested branches: Native camera barcode miss on iOS and Android.
- Missing fixtures: A durable seeded barcode no-match fixture for native simulator E2E.
- Follow-up needed: Promote the barcode no-match recovery flow into the selected native mobile E2E harness once Layerwell standardizes one.
