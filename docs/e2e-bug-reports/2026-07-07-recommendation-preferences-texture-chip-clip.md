# E2E Bug Report: Recommendation texture chips clip on compact phones

Severity: Medium
Surface: Expo web
Environment: Expo web, 390 x 568 and 320 x 568 phone viewports
Feature: Recommendation preferences
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Start Expo web and open `/recommendations/preferences`.
2. Set the viewport to 390 x 568.
3. Inspect the Texture chip row without scrolling.
4. Repeat at 320 x 568 and then tap `Oil` after the route scrolls it into view.

## Expected Result

Preference chips remain readable, fully visible, and at least 44 pt in both dimensions. The first viewport should not expose half-clipped tappable texture controls.

## Actual Result

At 390 x 568, the `Gel`, `Cream`, `Fluid`, and `Balm` texture chips rendered partly below the viewport with a negative bottom gap. After the first compact spacing adjustment, `Oil` still peeked from a second row and the dense chip became too narrow.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/compact-route-audit-19122-current/390-recommendations-preferences.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/compact-route-audit-19122-current/run-summary.json`
- Reproduction screenshot: `test-results/human-e2e/2026-07-07/recommendation-preferences-texture-clearance/390-preferences-initial.png`
- Reproduction UI snapshot: `test-results/human-e2e/2026-07-07/recommendation-preferences-texture-clearance/recommendation-preferences-texture-summary.json`

## Frequency

- Always on the tested 390 x 568 preference route before the final fix.

## Scope

- Affected route/screen: `/recommendations/preferences`
- Affected account or fixture: Local default recommendation preferences
- External service involved: None
- Destructive action involved: None

## Suspected Cause

The route used the same section spacing and normal chip density at compact heights. On a 390 px wide short phone, four texture chips were pushed just below the viewport; making spacing denser revealed the fifth chip as a second-row peek unless texture chips also used compact horizontal density.

## Minimal Fix Recommendation

Apply compact-height spacing to recommendation preferences, increase bottom scroll padding, and use compact-only dense texture chips that still enforce a 48 px minimum width.

## Verification Flow After Fix

1. Reopen `/recommendations/preferences` at 390 x 568.
2. Confirm `Gel`, `Cream`, `Fluid`, `Balm`, and `Oil` are all fully visible in one row with 48 px or larger touch geometry.
3. Confirm no horizontal overflow and no clipped controls.
4. Reopen at 320 x 568, confirm the budget row keeps a 34 px bottom buffer.
5. Tap `Oil` and confirm the texture chips remain reachable as 48 px controls.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/recommendation-preferences-texture-clearance/390-preferences-initial.png`
- Screenshot: `test-results/human-e2e/2026-07-07/recommendation-preferences-texture-clearance/390-preferences-oil-after-click.png`
- Screenshot: `test-results/human-e2e/2026-07-07/recommendation-preferences-texture-clearance/320-preferences-initial.png`
- Screenshot: `test-results/human-e2e/2026-07-07/recommendation-preferences-texture-clearance/320-preferences-oil-after-click.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/recommendation-preferences-texture-clearance/recommendation-preferences-texture-summary.json`
- Focused test: `npm --workspace apps/mobile run test -- src/features/recommendations/recommendationRoutes.test.ts`

## Remaining Risk

- Untested branches: Native iOS and Android Dynamic Type/text-scale rendering.
- Missing fixtures: Durable native preference-screen visual regression harness.
- Follow-up needed: Add recommendation preferences to the eventual native compact-phone E2E suite.
