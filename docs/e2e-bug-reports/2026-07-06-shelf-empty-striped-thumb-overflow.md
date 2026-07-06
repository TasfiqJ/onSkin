# E2E Bug Report: Empty Shelf illustration creates horizontal overflow

Severity: Medium
Surface: Expo web
Environment: `npm --workspace apps/mobile run web -- --port 8086`, 320 x 568 viewport
Feature: Smart Shelf empty state
Date: 2026-07-06
Tester: Codex

## Reproduction Steps

1. Start Expo web.
2. Open `/shelf` as a user with no active shelf products at a 320 x 568 phone viewport.
3. Inspect horizontal overflow and visible element geometry.

## Expected Result

The empty-state bottle illustration, headline, helper copy, `Scan a barcode`, `Add by hand`, and floating tab bar should stay within the 320 px viewport with no horizontal page overflow or side-scroll.

## Actual Result

The empty-state bottle illustration used `StripedThumb`, whose web implementation drew diagonal hatching with rotated absolutely positioned child views. Geometry showed visible decorative `div` children extending outside the viewport, including x=-34 and x=-16.09.

## Evidence

- Before screenshot: `test-results/human-e2e/2026-07-06/fresh-compact-scan/shelf-320.png`
- Before geometry: `test-results/human-e2e/2026-07-06/fresh-compact-scan/shelf-320-state.json`
- Compact route summary: `test-results/human-e2e/2026-07-06/fresh-compact-scan/summary.json`

## Frequency

- Always in the tested empty Shelf state at 320 x 568 on Expo web.

## Scope

- Affected route/screen: `/shelf`
- Affected account or fixture: local empty active shelf
- External service involved: No
- Destructive action involved: No

## Suspected Cause

React Native Web still counted transformed, offscreen hatch child views toward visible overflow geometry even though the thumbnail wrapper clipped them visually.

## Minimal Fix Recommendation

Render `StripedThumb` hatching as a single clipped CSS repeating gradient on web, and keep the existing composed child-stripe fallback for native iOS and Android.

## Verification Flow After Fix

1. Reload `/shelf` at 320 x 568.
2. Confirm no visible element extends left or right of the viewport.
3. Confirm the empty-state illustration still appears as the same light diagonal-hatch bottles.
4. Confirm the two empty-state actions and floating tab bar remain visible and tappable.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/shelf-empty-overflow/shelf-320.png`
- Geometry: `test-results/human-e2e/2026-07-06/shelf-empty-overflow/shelf-320-geometry.json`
- Console: `test-results/human-e2e/2026-07-06/shelf-empty-overflow/shelf-320-console.json`
- Result: `hasHorizontalOverflow=false`, `horizontalOverflowers=[]`, both `Scan a barcode` and `Add by hand` resolve as unique buttons, and tapping `Add by hand` opens `/shelf/manual` before Back returns to `/shelf`.

## Remaining Risk

- Native iOS and Android thumbnail rendering still need simulator/device visual QA, because the native path intentionally keeps the composed stripe fallback.
