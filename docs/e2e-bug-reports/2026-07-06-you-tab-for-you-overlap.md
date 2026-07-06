# E2E Bug Report: You Tab For You Row Under Floating Tab Bar

Severity: Critical
Surface: Expo web
Environment: `npm --workspace apps/mobile run web`, 390 x 844 viewport
Feature: Bottom tab navigation / You tab
Date: 2026-07-06
Tester: Codex

## Reproduction Steps

1. Open `/today` in Expo web at 390 x 844.
2. Switch through the bottom tabs to `You`.
3. Inspect visible button geometry against the floating bottom tab bar.

## Expected Result

Visible controls should either sit fully above the floating tab bar or require a deliberate scroll into view.

## Actual Result

The `Recommendations` row started behind the floating tab bar at scrollY `0`, with its top at about `795.81` and the tab bar spanning about `775.67` to `829.66`.

## Evidence

- UI snapshot: `test-results/human-e2e/2026-07-06/tab-bar-active-state/390-you-direct-clearance-before-screenshot.json`
- Screenshot: `test-results/human-e2e/2026-07-06/tab-bar-active-state/390-you-direct.png`

## Frequency

- Always in the tested 390 x 844 Expo web viewport with the current You-tab content density.

## Scope

- Affected route/screen: `/you`
- Affected account or fixture: local test state with Pro/reverse-trial entitlement and default You-tab sections
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The compact You-tab layout hid only the first three routine rows in the primary section, but the lower `For You` card still started high enough to enter the first viewport behind the absolute floating tab bar.

## Minimal Fix Recommendation

Give the `For You` card a larger compact-phone top margin so it requires deliberate scroll after the `More Routine` section.

## Verification Flow After Fix

1. Reopen `/you` at 390 x 844.
2. Confirm no non-tab controls overlap the floating tab bar.
3. Switch between all four tabs at 320 x 568 and 390 x 844 to confirm labels and selected state remain stable.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/navigation-tabbar-floating-refresh/post-you-390-final.png`
- UI snapshot: `test-results/human-e2e/2026-07-06/navigation-tabbar-floating-refresh/post-you-390-final-geometry.json`
- Result: `nonTabOverlaps` is empty; `Recommendations` starts below the first viewport instead of inside the floating tab bar zone.

## Remaining Risk

- Native iOS and Android tab-bar rendering still need simulator/device QA.
