# E2E Bug Report: Bottom tab selected state too subtle

Severity: Medium
Surface: Expo web phone-width proxy for iOS and Android
Environment: Expo web, 320x568 and 390x844 viewports, localhost
Feature: Bottom tab navigation
Date: 2026-07-06
Tester: Codex

## Reproduction Steps

1. Open `/today` in a 320x568 phone viewport.
2. Inspect the floating bottom tab bar on the dark Today surface.
3. Switch to Progress, Shelf, You, then back to Today.

## Expected Result

The floating tab bar should feel like a premium mobile control. The selected tab should be immediately legible, the label should not look clipped, and all four tabs should remain large enough to tap on the smallest supported phone width.

## Actual Result

The prior selected state used a tiny active rail under the label. The labels fit, but the selected treatment looked underpowered on the dark routine surface and made the bar feel less integrated with the rest of the app polish.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/navigation-tabbar-floating-refresh/pre-today-320.png`
- UI snapshot: `test-results/human-e2e/2026-07-06/navigation-tabbar-floating-refresh/pre-today-320-geometry.json`

## Frequency

- Always on the tested 320x568 viewport before the fix

## Scope

- Affected route/screen: `(tabs)` floating tab bar
- Affected account or fixture: local development reverse-trial state
- External service involved: No
- Destructive action involved: No

## Suspected Cause

The custom floating bar had a premium capsule shell, but the active state was still a small underline instead of a full selected tab treatment. That left the selected tab visually weak and easy to read as clipped or unfinished.

## Minimal Fix Recommendation

Replace the tiny active rail with a rounded selected pill, use high-contrast selected icon/label color, keep one-line label fitting, and retain the 52 px-plus tab hit target on 320 px phones.

## Verification Flow After Fix

1. Open `/today` at 320x568.
2. Confirm the active tab is a dark rounded pill and the label remains readable.
3. Switch Today -> Progress -> Shelf -> You -> Today.
4. Reopen `/today` at 390x844 and confirm the tab geometry remains clear.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/navigation-tabbar-floating-refresh/post-today-320.png`
- Screenshot: `test-results/human-e2e/2026-07-06/navigation-tabbar-floating-refresh/post-progress-320.png`
- Screenshot: `test-results/human-e2e/2026-07-06/navigation-tabbar-floating-refresh/post-shelf-320.png`
- Screenshot: `test-results/human-e2e/2026-07-06/navigation-tabbar-floating-refresh/post-you-320.png`
- Screenshot: `test-results/human-e2e/2026-07-06/navigation-tabbar-floating-refresh/post-return-today-320.png`
- Screenshot: `test-results/human-e2e/2026-07-06/navigation-tabbar-floating-refresh/post-today-390.png`
- UI snapshot: `test-results/human-e2e/2026-07-06/navigation-tabbar-floating-refresh/post-today-320-geometry.json`
- UI snapshot: `test-results/human-e2e/2026-07-06/navigation-tabbar-floating-refresh/post-today-390-geometry.json`

## Remaining Risk

- Untested branches: native iOS and Android Dynamic Type, platform font rendering, and keyboard-hide behavior.
- Missing fixtures: none for this local navigation pass.
- Follow-up needed: native simulator pass before final launch acceptance.
