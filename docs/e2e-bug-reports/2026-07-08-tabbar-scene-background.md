# E2E Bug Report: Today tab bar floated over mismatched background

Severity: Medium
Surface: Expo web
Environment: Headless Chrome at 320 x 568 and 390 x 568, Expo web on localhost
Feature: Bottom tab navigation
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web for `apps/mobile`.
2. Open `/today` during the PM routine state at 320 x 568.
3. Inspect the floating bottom tab bar and the reserved bottom area around it.

## Expected Result

The floating tab bar should feel integrated with the current tab surface. On PM Today, the area around and beneath the bar should use the dark Today background, while light tabs should keep the paper background.

## Actual Result

The reserved scene padding behind the floating tab bar stayed light on PM Today. The dark Today screen stopped above the bar, leaving a white bottom band that made the tab bar feel pasted onto a mismatched surface.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/navigation-tabbar-polish/tabbar-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/navigation-tabbar-polish/tabbar-320x568.json`
- Screenshot: `test-results/human-e2e/2026-07-08/navigation-tabbar-polish/tabbar-390x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/navigation-tabbar-polish/tabbar-390x568.json`

## Frequency

- Always on PM Today when the floating tab bar clearance is visible.

## Scope

- Affected route/screen: `/(tabs)/today`
- Affected account or fixture: local PM routine state
- External service involved: No
- Destructive action involved: No

## Suspected Cause

The tab layout reserved bottom clearance through `sceneStyle` outside the `Screen` component. `Screen tone="night"` painted the PM Today surface, but the scene padding behind the floating tab bar kept the default light background.

## Minimal Fix Recommendation

Make the tab scene background route-aware. Today should use the PM night background when `currentRoutineType()` is `PM`; all light tabs should keep the paper background.

## Verification Flow After Fix

1. Reload `/today` at 320 x 568 and 390 x 568.
2. Confirm all tab labels are visible and all tab centers hit the expected target.
3. Confirm the bottom samples outside the floating tab bar are dark on PM Today and paper on Progress, Shelf, and You.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/navigation-tabbar-polish/tabbar-320x568-after.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/navigation-tabbar-polish/tabbar-320x568-after.json`
- Screenshot: `test-results/human-e2e/2026-07-08/navigation-tabbar-polish/tabbar-390x568-after.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/navigation-tabbar-polish/tabbar-390x568-after.json`

## Remaining Risk

- Untested branches: native iOS/Android keyboard-hide behavior and platform text-scale rendering.
- Missing fixtures: no native simulator/device screenshot in this slice.
- Follow-up needed: verify the floating bar on physical iOS/Android devices with large text enabled.
