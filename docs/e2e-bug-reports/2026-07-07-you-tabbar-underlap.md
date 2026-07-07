# E2E Bug Report: You routine row under floating tab bar

Severity: High
Surface: Expo web
Environment: Expo web on localhost:8082, 320 x 568 compact phone viewport
Feature: Floating bottom tab navigation / You tab
Date: 2026-07-07
Tester: Codex human-simulated E2E

## Reproduction Steps

1. Start the mobile app on Expo web.
2. Set the browser viewport to 320 x 568.
3. Open `/you` and inspect the first viewport around the floating bottom tab bar.

## Expected Result

No non-tab control should intersect the floating tab bar touch zone.

## Actual Result

The `Retinoid ramp` routine button extended into the floating tab bar zone on the You route.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/compact-ui-sweep-3/you-320.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/compact-ui-sweep-3/compact-ui-sweep-320.json`

## Frequency

- Always on the tested 320 x 568 viewport before the fix.

## Scope

- Affected route/screen: `/you`
- Affected account or fixture: local seeded Expo web state
- External service involved: none
- Destructive action involved: no

## Suspected Cause

The secondary routine card used fixed `mt-12` spacing, which was not enough after the floating tab bar polish compressed the first viewport on very short phones.

## Minimal Fix Recommendation

Use short-phone-aware secondary routine spacing so lower routine rows move below the first viewport on 320 x 568 while preserving the 390 px compact layout.

## Verification Flow After Fix

1. Reopen `/you` at 320 x 568.
2. Confirm the floating tab bar remains visible.
3. Confirm no non-tab button intersects the tab bar bounding box.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/compact-ui-sweep-3/you-320-after.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/compact-ui-sweep-3/you-320-after-metrics.json`

## Remaining Risk

- Untested branches: native iOS and Android simulator renders for the same viewport class.
- Missing fixtures: none for this visual layout case.
- Follow-up needed: run native-device sweeps when the simulator/device queue is available.
