# E2E Bug Report: Floating tab bar selected state lacks premium contrast

Severity: Medium
Surface: Expo web phone-width proxy for iOS and Android
Environment: Expo web, 320x568 and 390x844 viewports, localhost
Feature: Bottom tab navigation
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/today` in a 320x568 phone viewport.
2. Inspect the floating bottom tab bar and active Today tab.
3. Switch to Progress, Shelf, You, then back to Today.

## Expected Result

The floating bottom tab bar should read like a premium mobile control: all four labels stay visible on compact phones,
the selected destination is immediately obvious, and the bar keeps enough width buffer for iOS and Android font
rendering.

## Actual Result

The current floating shell worked, but the selected tab used a low-contrast greige pill and 12 px side margins left each
tab at roughly 73.6 px on a 320 px phone. The labels rendered, but the active state looked softer than the rest of the app
and the longest label had little platform-font buffer.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/navigation-tabbar-wealthsimple-refresh/before-today-320.png`
- Screenshot: `test-results/human-e2e/2026-07-07/navigation-tabbar-wealthsimple-refresh/before-progress-320.png`
- Screenshot: `test-results/human-e2e/2026-07-07/navigation-tabbar-wealthsimple-refresh/before-shelf-320.png`
- Screenshot: `test-results/human-e2e/2026-07-07/navigation-tabbar-wealthsimple-refresh/before-you-320.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/navigation-tabbar-wealthsimple-refresh/before-today-320.json`

## Frequency

- Always on the tested 320x568 viewport before the fix

## Scope

- Affected route/screen: `(tabs)` floating tab bar
- Affected account or fixture: local development state
- External service involved: No
- Destructive action involved: No

## Suspected Cause

The active tab used the same soft neutral palette as inactive surfaces instead of a high-contrast selected treatment. The
floating shell also kept conservative 12 px side margins, which narrowed all four tab slots on the smallest phone width.

## Minimal Fix Recommendation

Use a dark selected pill with white active icon and label colors, tighten the floating shell side margin on compact phones,
and keep the existing 52 px-plus tap target geometry.

## Verification Flow After Fix

1. Open `/today` at 320x568 and inspect the active Today tab.
2. Switch Today -> Progress -> Shelf -> You -> Today at 320x568.
3. Reopen `/today` at 390x844 and confirm no horizontal overflow or label clipping.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/navigation-tabbar-wealthsimple-refresh/after-today-320.png`
- Screenshot: `test-results/human-e2e/2026-07-07/navigation-tabbar-wealthsimple-refresh/after-progress-320.png`
- Screenshot: `test-results/human-e2e/2026-07-07/navigation-tabbar-wealthsimple-refresh/after-shelf-320.png`
- Screenshot: `test-results/human-e2e/2026-07-07/navigation-tabbar-wealthsimple-refresh/after-you-320.png`
- Screenshot: `test-results/human-e2e/2026-07-07/navigation-tabbar-wealthsimple-refresh/after-today-390.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/navigation-tabbar-wealthsimple-refresh/after-today-320.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/navigation-tabbar-wealthsimple-refresh/after-today-390.json`

## Remaining Risk

- Untested branches: native iOS and Android Dynamic Type/font rendering, keyboard-hide behavior.
- Missing fixtures: none for this local navigation pass.
- Follow-up needed: native simulator pass before final launch acceptance.
