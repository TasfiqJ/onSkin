# E2E Bug Report: Tab Bar Width Buffer Below Contract

Severity: Low
Surface: Expo web phone-width proxy for iOS and Android
Environment: Expo web at `http://localhost:19006`, 320x568 viewport
Feature: Bottom tab navigation
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Apply the lighter floating-tab active treatment with 12 px side margins and 4 px horizontal padding.
2. Run the tab-bar route contract.
3. Open `/today` at 320x568 and inspect tab geometry while switching Today, Progress, Shelf, and You.

## Expected Result

The 320 px floating tab bar keeps one-line labels with a practical width buffer, no horizontal overflow, and tab targets well above the 44 pt floor.

## Actual Result

The source contract failed because the new constants allowed only 72 px of usable width per tab. Browser geometry later measured about 73.6 px per tab, which was functional but below the intended 74 px buffer.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/navigation-tabbar-light-active/320-today.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/navigation-tabbar-light-active/summary.json`
- Unit/contract test: `npm --workspace apps/mobile run test -- src/features/navigation/tabBar.test.ts`

## Frequency

- Always with the tested constants at 320 px.

## Scope

- Affected route/screen: `(tabs)` floating tab bar
- Affected account or fixture: local development reverse-trial state
- External service involved: None
- Destructive action involved: None

## Suspected Cause

The active treatment was visually lighter, but the updated side margin and horizontal padding narrowed the four tab slots too much on the smallest supported phone width.

## Minimal Fix Recommendation

Keep the lighter active tab treatment, but reduce the floating bar side margin to preserve at least 74 px of measured browser width per tab at 320 px.

## Verification Flow After Fix

1. Run `npm --workspace apps/mobile run test -- src/features/navigation/tabBar.test.ts`.
2. Open `/today` at 320x568.
3. Switch Today -> Progress -> Shelf -> You -> Today.
4. Reopen `/today` at 390x844.
5. Confirm one selected tab, no horizontal overflow, 44 pt-plus targets, and readable labels.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/navigation-tabbar-light-active/320-today-final.png`
- Screenshot: `test-results/human-e2e/2026-07-07/navigation-tabbar-light-active/320-progress-after-click-final.png`
- Screenshot: `test-results/human-e2e/2026-07-07/navigation-tabbar-light-active/320-shelf-after-click-final.png`
- Screenshot: `test-results/human-e2e/2026-07-07/navigation-tabbar-light-active/320-you-after-click-final.png`
- Screenshot: `test-results/human-e2e/2026-07-07/navigation-tabbar-light-active/390-today-final.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/navigation-tabbar-light-active/summary.json`
- Unit/contract test: `npm --workspace apps/mobile run test -- src/features/navigation/tabBar.test.ts`

## Remaining Risk

- Untested branches: native iOS/Android Dynamic Type and keyboard-hide behavior.
- Missing fixtures: no live account or external service fixtures needed for this local navigation pass.
- Follow-up needed: native simulator/device tab-bar QA before final launch acceptance.
