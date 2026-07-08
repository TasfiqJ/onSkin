# E2E Bug Report: Empty Shelf archive action covered on compact phones

Severity: High
Surface: Expo web
Environment: In-app browser, 320 x 568 viewport, `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`, `EXPO_PUBLIC_E2E_SHELF_SCAN_RESULT=offline`, `EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT=no_match`
Feature: Shelf Product Add / active Shelf empty with archive history
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Open `/shelf` at 320 x 568 with one active product.
2. Open the product detail and tap `Mark finished`.
3. Return to the empty Shelf with one archived product.

## Expected Result

The empty Shelf shows `View archive (1)` as a visible 44 pt+ recovery action above the floating tab bar, and tapping it opens `/shelf/archive`.

## Actual Result

The DOM contained `View archive (1)`, but the floating tab bar covered the action in the compact viewport, so the screenshot did not show a reliably visible or tappable archive affordance.

## Evidence

- Screenshot: `11-empty-shelf-with-archive-pre-fix.png`
- UI snapshot: `11-empty-shelf-with-archive-pre-fix.json`
- Logs: `browser-warn-error-logs.json`

## Frequency

- Always on the 320 x 568 empty-Shelf archive state before the fix.

## Scope

- Affected route/screen: `/shelf`
- Affected account or fixture: Local shelf state with no active products and at least one archived product.
- External service involved: None. Supabase is placeholder-only in this local run.
- Destructive action involved: Local test product was marked finished in browser-local state.

## Suspected Cause

The compact empty-state vertical spacing placed the archive action at the bottom of the phone viewport without accounting for the floating tab bar overlay.

## Minimal Fix Recommendation

When the Shelf is compact and has archived products, tighten the empty-state top padding, illustration spacing, and action-stack spacing so the 48 px archive action renders fully above the floating tab bar.

## Verification Flow After Fix

1. Reopen `/shelf` at 320 x 568 with no active products and one archived product.
2. Confirm `View archive (1)` is visible above the floating tab bar with zero horizontal overflow.
3. Tap `View archive (1)` and confirm `/shelf/archive` opens with `E2E Archive Balm` visible.

## Post-Fix Evidence

- Screenshot: `12-empty-shelf-with-archive-fixed.png`
- UI snapshot: `12-empty-shelf-with-archive-fixed.json`
- Archive screenshot: `13-archive-product-visible.png`
- Archive UI snapshot: `13-archive-product-visible.json`

## Remaining Risk

- Native iOS/Android home-indicator and TalkBack/VoiceOver traversal still require device QA.
- This Expo web pass does not prove live Supabase `shelf_scans` insert behavior.
