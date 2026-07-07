# E2E Bug Report: Settings privacy direct entry regressed to negative scroll nudge

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
4. Inspect the privacy-control rows around the floating bottom tab bar.

## Expected Result

The direct-entry privacy surface should land on complete privacy rows with a visible buffer above the floating tab bar. Covered lower rows should require a deliberate scroll before becoming readable or tappable.

## Actual Result

The route landed too low on compact phones. The `Withdraw health-data consent` row extended underneath the floating tab bar at both 320 px and 390 px widths, making legal/privacy controls look partially covered.

## Evidence

- Before screenshot: `test-results/human-e2e/2026-07-07/compact-route-audit-19121/320-settings-privacy.png`
- Before screenshot: `test-results/human-e2e/2026-07-07/compact-route-audit-19121/390-settings-privacy.png`
- Before audit summary: `test-results/human-e2e/2026-07-07/compact-route-audit-19121/run-summary.json`

## Frequency

- Always on the tested compact phone viewports before the fix.

## Scope

- Affected route/screen: `/settings/privacy` redirecting to `/you?section=privacy`
- Affected account or fixture: local Expo web preview state
- External service involved: none
- Destructive action involved: no

## Suspected Cause

The width-aware privacy direct-entry scroll constants were inverted to negative values. That reduced the scroll amount, placed the privacy card lower on short phones, and pushed the final privacy control into the floating tab-bar zone.

## Minimal Fix Recommendation

Restore the positive calibrated scroll nudges for compact and narrow phones, and pin the route contract so negative nudges cannot be reintroduced silently.

## Verification Flow After Fix

1. Reopen `/settings/privacy` at 320 x 568.
2. Confirm the route lands on `/you?section=privacy`.
3. Confirm `Marketing emails`, `Photos & the no-AI-score promise`, `Withdraw health-data consent`, and `Privacy policy` do not cross the safe tab-bar boundary.
4. Repeat at 390 x 568.

## Post-Fix Evidence

- After screenshot: `test-results/human-e2e/2026-07-07/settings-privacy-positive-nudge-regression/320-settings-privacy-after.png`
- After screenshot: `test-results/human-e2e/2026-07-07/settings-privacy-positive-nudge-regression/390-settings-privacy-after.png`
- Geometry summary: `test-results/human-e2e/2026-07-07/settings-privacy-positive-nudge-regression/geometry-summary.json`

The focused rerun passed at 320 x 568 and 390 x 568. No visible privacy control crosses the safe tab-bar boundary, the route lands on `/you?section=privacy`, and all measured privacy controls remain at least 44 px tall.

## Remaining Risk

- Untested branches: native iOS and Android simulator rendering for the same viewport class.
- Missing fixtures: none for this visual layout case.
- Follow-up needed: include settings direct entries in the next native small-device QA sweep.
