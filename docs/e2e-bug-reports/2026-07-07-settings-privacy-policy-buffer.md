# E2E Bug Report: Settings privacy policies clipped under floating tab bar

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
4. Inspect the bottom of the first viewport around the floating tab bar.

## Expected Result

The direct-entry privacy view should show complete privacy controls above the floating tab bar, then leave a clean buffer. Policy rows should require a deliberate scroll before becoming readable or tappable.

## Actual Result

After the privacy scroll nudge was restored, the next `POLICIES` card still started too close to the privacy card. At 320 px, `Consumer health privacy` overlapped the tab-bar zone. At 390 px, `Terms` and then `Privacy policy` could enter the bottom/tab-bar zone depending on the calibrated nudge.

## Evidence

- Before screenshot: `test-results/human-e2e/2026-07-07/compact-route-audit-19122-current/320-settings-privacy.png`
- Before screenshot: `test-results/human-e2e/2026-07-07/compact-route-audit-19122-current/390-settings-privacy.png`
- Before audit summary: `test-results/human-e2e/2026-07-07/compact-route-audit-19122-current/run-summary.json`

## Frequency

- Always on the tested compact phone viewports before the fix.

## Scope

- Affected route/screen: `/settings/privacy` redirecting to `/you?section=privacy`
- Affected account or fixture: local Expo web preview state
- External service involved: none
- Destructive action involved: no

## Suspected Cause

The privacy card anchor was correct, but the next `POLICIES` card kept the normal `mt-4` margin. On compact direct entry, that allowed policy controls to become partially visible and tappable beneath the floating tab bar even though the privacy controls themselves were now clear.

## Minimal Fix Recommendation

Keep the privacy-card scroll calibration, and add a compact direct-entry-only spacer before the `POLICIES` card so the first viewport ends cleanly after the privacy controls.

## Verification Flow After Fix

1. Reopen `/settings/privacy` at 320 x 568.
2. Confirm the route lands on `/you?section=privacy`.
3. Confirm `Withdraw health-data consent` remains above the tab bar.
4. Confirm `POLICIES` and policy controls start below the viewport.
5. Repeat at 390 x 568.

## Post-Fix Evidence

- After screenshot: `test-results/human-e2e/2026-07-07/settings-privacy-policy-buffer/320-settings-privacy-policy-buffer.png`
- After screenshot: `test-results/human-e2e/2026-07-07/settings-privacy-policy-buffer/390-settings-privacy-policy-buffer.png`
- Geometry summary: `test-results/human-e2e/2026-07-07/settings-privacy-policy-buffer/settings-privacy-policy-buffer-summary.json`

The focused rerun passed at 320 x 568 and 390 x 568. `POLICIES` starts below the viewport, no non-tab policy controls enter the floating tab-bar zone, horizontal overflow is zero, and the privacy withdrawal control remains above the tab bar.

## Remaining Risk

- Untested branches: native iOS and Android simulator rendering for this exact direct-entry layout.
- Missing fixtures: none for this visual layout case.
- Follow-up needed: include `/settings/privacy` in the next native small-device QA sweep.
