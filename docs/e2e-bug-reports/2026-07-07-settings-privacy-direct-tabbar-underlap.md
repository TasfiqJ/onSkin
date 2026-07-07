# E2E Bug Report: Privacy direct-entry policy row under floating tab bar

Severity: High
Surface: Expo web
Environment: Expo web on localhost, 320 x 568 and 390 x 568 compact phone viewports
Feature: Settings privacy direct entry
Date: 2026-07-07
Tester: Codex human-simulated E2E

## Reproduction Steps

1. Start the mobile app on Expo web.
2. Set the browser viewport to 320 x 568 or 390 x 568.
3. Open `/settings/privacy`, which redirects to `/you?section=privacy`.
4. Inspect the first viewport around the floating bottom tab bar.

## Expected Result

The privacy direct-entry view lands inside the You tab privacy surface and ends on complete rows with a clear buffer above the floating tab bar.

## Actual Result

Policy rows were visible underneath the floating tab bar on compact phones. At 320 x 568 the `Privacy policy` row was partially covered, and at 390 x 568 the `Consumer health privacy` row was partially covered.

## Evidence

- Before screenshot: `test-results/human-e2e/2026-07-07/compact-route-audit-next/320-settings-privacy.png`
- Before screenshot: `test-results/human-e2e/2026-07-07/compact-route-audit-next/390-settings-privacy.png`
- Audit summary: `test-results/human-e2e/2026-07-07/compact-route-audit-next/run-summary.json`

## Frequency

- Always on the tested compact phone viewports before the fix.

## Scope

- Affected route/screen: `/settings/privacy` redirecting to `/you?section=privacy`
- Affected account or fixture: local Expo web preview state
- External service involved: none
- Destructive action involved: no

## Suspected Cause

The direct-entry scroll target anchored the privacy card at a fixed top offset. On short phones, that placed policy rows exactly where the floating tab bar overlays the scene.

## Minimal Fix Recommendation

Nudge the compact-phone direct-entry scroll target down enough that the policy row boundary aligns above the floating tab bar while keeping the privacy controls visible.

## Verification Flow After Fix

1. Reopen `/settings/privacy` at 320 x 568.
2. Confirm the route lands on `/you?section=privacy`.
3. Confirm the floating tab bar is visible and no policy row text sits underneath it.
4. Repeat at 390 x 568.

## Post-Fix Evidence

- After screenshot: `test-results/human-e2e/2026-07-07/settings-direct-entry-privacy/11-settings-privacy-final-320-nudge.png`
- After screenshot: `test-results/human-e2e/2026-07-07/settings-direct-entry-privacy/12-settings-privacy-final-390-nudge.png`
- Geometry summary: `test-results/human-e2e/2026-07-07/settings-direct-entry-privacy/geometry-summary.json`

The focused rerun passed at 320 x 568 and 390 x 568. No non-tab control crosses the floating tab-bar bounding box, the route lands on `/you?section=privacy`, horizontal overflow is zero, and visible controls are at least 44 px.

## Remaining Risk

- Untested branches: native iOS and Android simulator renders for the same viewport class.
- Missing fixtures: none for this visual layout case.
- Follow-up needed: run native-device sweeps when simulator/device queue is available.
