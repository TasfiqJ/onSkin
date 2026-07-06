# E2E Bug Report: Recommendation budget chip clips at compact phone height

Severity: Medium
Surface: Expo web
Environment: `npm --workspace apps/mobile run web -- --port 8088`, 320 x 568 viewport
Feature: Personalized Recommendations preferences
Date: 2026-07-06
Tester: Codex

## Reproduction Steps

1. Start Expo web.
2. Open `/recommendations/preferences` at a 320 x 568 phone viewport.
3. Inspect the budget filter row.

## Expected Result

`Drugstore`, `Mid-range`, and `Premium` budget chips should be readable, fully visible, and at least 44 pt tall. The first viewport should not expose a half-clipped tappable chip.

## Actual Result

The `Premium` budget chip started at y=565.9 and extended to y=613.9, so the user saw and could tap a partially clipped control at the bottom of the viewport.

## Evidence

- Before screenshot: `test-results/human-e2e/2026-07-06/next-compact-route-audit/recommendations-preferences.png`
- Before geometry: `test-results/human-e2e/2026-07-06/next-compact-route-audit/recommendations-preferences.json`
- Route sweep summary: `test-results/human-e2e/2026-07-06/next-compact-route-audit/summary.json`

## Frequency

- Always in the tested direct-entry preferences state at 320 x 568 before the fix.

## Scope

- Affected route/screen: `/recommendations/preferences`
- Affected account or fixture: local default recommendation preferences
- External service involved: No
- Destructive action involved: No

## Suspected Cause

The budget chips used the same wrapped chip layout as longer values and texture filters. At 320 px width the third budget option wrapped to a second row, and the row began just inside the bottom edge of the initial viewport.

## Minimal Fix Recommendation

Render the three budget-band chips as equal-width compact controls in a single row while preserving 48 px height and one-line readable labels.

## Verification Flow After Fix

1. Reload `/recommendations/preferences` at 320 x 568.
2. Confirm `Drugstore`, `Mid-range`, and `Premium` are all visible on one row.
3. Confirm there are no clipped controls, no small controls, no horizontal overflow, and no ellipsized budget labels.
4. Tap `Premium` and confirm the chip remains a unique, tappable budget option.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/recommendation-preferences-budget-fit/preferences-320.png`
- Geometry: `test-results/human-e2e/2026-07-06/recommendation-preferences-budget-fit/preferences-320-geometry.json`
- Tap state: `test-results/human-e2e/2026-07-06/recommendation-preferences-budget-fit/preferences-premium-selected-320.json`
- Console: `test-results/human-e2e/2026-07-06/recommendation-preferences-budget-fit/preferences-console.json`
- Result: `clippedControls=[]`, `smallTargets=[]`, `hasHorizontalOverflow=false`, `hasEllipsisText=false`, and the three budget buttons are each 85.47 x 48 px.

## Remaining Risk

- Native iOS and Android Dynamic Type still need device QA for the compact equal-width budget row.
