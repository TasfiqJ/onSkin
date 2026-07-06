# E2E Bug Report: Floating tab bar phone clearance

Severity: Medium
Surface: Expo web phone-width proxy for iOS and Android
Environment: Expo web, 320x568 and 390x844 viewports, localhost
Feature: Bottom tab navigation
Date: 2026-07-06
Tester: Codex

## Reproduction Steps

1. Open `/today` in a 320x568 phone viewport.
2. Inspect the floating tab bar labels and the contextual SPF prompt above it.
3. Switch to Progress, Shelf, and You from the tab bar.
4. Reopen `/today` in a 390x844 phone viewport and inspect the lower recommendation area above the floating tab bar.

## Expected Result

The floating tab bar should feel like a premium mobile control: all four labels render on one line with spare width, all tabs remain at least 44 px targets, and contextual controls above the bar do not sit partially underneath the floating bar or its shadow.

## Actual Result

At 320 px the longest tab label had essentially no spare width, making the nav text fragile across platform font rendering. The compact Today SPF prompt also crowded the floating bar, and at 390 px the lower recommendation card entered the tab bar zone.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/navigation-tabbar-polish/pre-today-320.png`
- Screenshot: `test-results/human-e2e/2026-07-06/navigation-tabbar-polish/pre-progress-320.png`
- Screenshot: `test-results/human-e2e/2026-07-06/navigation-tabbar-polish/pre-today-390.png`
- UI snapshot: `test-results/human-e2e/2026-07-06/navigation-tabbar-polish/pre-today-320-geometry.json`

## Frequency

- Always on the tested 320x568 and 390x844 viewports before the fix

## Scope

- Affected route/screen: `(tabs)` floating tab bar and Today contextual recommendations
- Affected account or fixture: local routine/recommendation fixture
- External service involved: No
- Destructive action involved: No

## Suspected Cause

The floating tab bar used tight side margins, inner padding, and 13 px labels, leaving the 320 px `Progress` label with no practical width buffer. Today also reused the richer recommendation presentation on standard phone heights, which let lower controls render into the floating tab bar zone.

## Minimal Fix Recommendation

Give the floating bar more usable width, slightly tighten label typography while preserving 52 px tab targets, use the compact contextual recommendation prompt on standard phone heights, and shorten the compact SPF prompt display title.

## Verification Flow After Fix

1. Open `/today` at 320x568.
2. Verify tab labels, tap targets, and the contextual SPF prompt above the floating bar.
3. Switch Today -> Progress -> Shelf -> You -> Today at 320x568.
4. Reopen `/today` at 390x844 and verify no CTA overlaps the floating bar.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/navigation-tabbar-polish/post-accepted-today-320.png`
- Screenshot: `test-results/human-e2e/2026-07-06/navigation-tabbar-polish/post-accepted-progress-320.png`
- Screenshot: `test-results/human-e2e/2026-07-06/navigation-tabbar-polish/post-switch-shelf-320.png`
- Screenshot: `test-results/human-e2e/2026-07-06/navigation-tabbar-polish/post-switch-you-320.png`
- Screenshot: `test-results/human-e2e/2026-07-06/navigation-tabbar-polish/post-accepted-today-390.png`
- UI snapshot: `test-results/human-e2e/2026-07-06/navigation-tabbar-polish/post-accepted-today-320-geometry.json`
- UI snapshot: `test-results/human-e2e/2026-07-06/navigation-tabbar-polish/post-accepted-progress-320-geometry.json`
- UI snapshot: `test-results/human-e2e/2026-07-06/navigation-tabbar-polish/post-accepted-today-390-geometry.json`

## Remaining Risk

- Untested branches: native iOS and Android font rendering with large Dynamic Type
- Missing fixtures: none for the local routine/recommendation state
- Follow-up needed: native simulator pass for text scale and keyboard-hide behavior before final launch acceptance
