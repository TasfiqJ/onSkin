# E2E Bug Report: Shelf catalog search fallback exposes backend wording

Severity: Low
Surface: Expo web
Environment: Expo web on localhost, 320 x 568 viewport
Feature: Smart Shelf catalog search
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/shelf/search` without a configured Supabase catalog backend.
2. Enter a valid search query such as `retinol`.
3. Tap `Search`.

## Expected Result

The search failure copy should be calm and user-facing, explain that the product catalog is unavailable, and keep `Add by hand` visible.

## Actual Result

The offline search message used implementation wording: `Catalog search needs the backend. Add this product by hand for now.`

## Evidence

- Source review: `apps/mobile/src/app/shelf/search.tsx`
- User-flow branch: `docs/USER_FLOW_TREE.md` Shelf Product Add search branch

## Frequency

- Always when catalog search is unavailable before live Supabase setup.

## Scope

- Affected route/screen: `/shelf/search`
- Affected account or fixture: Local/dev environment without configured Supabase catalog
- External service involved: Supabase is intentionally placeholder-blocked locally
- Destructive action involved: No

## Suspected Cause

The route treated the local offline catalog state as an implementation/backend condition instead of a user-facing catalog availability state.

## Minimal Fix Recommendation

Replace the backend-specific fallback with catalog-facing copy and use the same message for offline and search-error states.

## Verification Flow After Fix

1. Open `/shelf/search` at 320 x 568.
2. Search for `retinol`.
3. Confirm the message says `Couldn't reach the product catalog. Add this product by hand for now.`
4. Confirm the visible UI does not contain `backend` and the manual fallback remains visible.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/shelf-search-offline-copy/search-offline-copy-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/shelf-search-offline-copy/search-offline-copy-320x568-state.json`
- Logs: `test-results/human-e2e/2026-07-07/shelf-search-offline-copy/browser-console-warn-error.json`

## Remaining Risk

- Untested branches: live Supabase search errors from a real deployed catalog function.
- Missing fixtures: a durable local mocked catalog-error state for automated browser E2E.
- Follow-up needed: native-device search and barcode no-match verification after Supabase/catalog staging exists.
