# E2E Bug Report: You tab first-viewport tab clearance

Severity: Medium
Surface: Expo web, 320 x 568 phone viewport
Environment: Expo web dev server on localhost, route `/you`
Feature: You tab settings and routine navigation rows
Date: 2026-07-06
Tester: Codex

## Reproduction Steps

1. Start the Expo mobile web surface.
2. Open `/you` in a 320 x 568 phone viewport.
3. Inspect the first viewport around the `YOUR ROUTINE` card and floating tab bar.

## Expected Result

The first viewport should end on complete navigation rows with a visible buffer above the floating tab bar. Additional
routine rows should be reachable by normal scrolling and should not appear partially tappable behind the tab bar.

## Actual Result

The compact You tab allowed lower routine rows to enter the tab bar zone. Before the fix, `Streak & adherence` started
at `y=483.87` while the floating tab bar started at `y=486.94`, and `Weekly check-in` was mostly underneath the bar.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/you-first-viewport-tab-clearance/before-you-320.png`
- UI snapshot: `test-results/human-e2e/2026-07-06/you-first-viewport-tab-clearance/before-you-320-geometry.json`

## Frequency

- Always at 320 x 568 before the fix

## Scope

- Affected route/screen: `/you`
- Affected account or fixture: local signed-in placeholder state
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The compact You tab still used larger card padding and vertical spacing above the routine card. That pushed the lower
routine rows into the floating tab bar area on short phones.

## Minimal Fix Recommendation

Use tighter card padding and margins for phone-width You-tab cards while preserving 48 px row targets and the
larger-phone layout.

## Verification Flow After Fix

1. Reopen `/you` at 320 x 568.
2. Confirm `Retinoid ramp` is complete and hit-testable above the floating tab bar.
3. Confirm `Streak & adherence` and `Weekly check-in` do not receive accidental hits while covered by the tab bar.
4. Scroll normally and confirm `Streak & adherence`, `Weekly check-in`, and `Recent changes` become fully visible and
   hit-testable above the tab bar.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/you-first-viewport-tab-clearance/after-final-you-320.png`
- UI snapshot: `test-results/human-e2e/2026-07-06/you-first-viewport-tab-clearance/after-final-you-320-geometry.json`
- Screenshot: `test-results/human-e2e/2026-07-06/you-first-viewport-tab-clearance/after-final-you-390x844.png`
- UI snapshot: `test-results/human-e2e/2026-07-06/you-first-viewport-tab-clearance/after-final-you-390x844-geometry.json`
- UI snapshot: `test-results/human-e2e/2026-07-06/you-first-viewport-tab-clearance/after-spacing-you-320-hit-test.json`
- Screenshot: `test-results/human-e2e/2026-07-06/you-first-viewport-tab-clearance/after-scroll-routine-rows-320.png`
- UI snapshot: `test-results/human-e2e/2026-07-06/you-first-viewport-tab-clearance/after-scroll-routine-rows-320-geometry.json`

## Remaining Risk

- Untested branches: native iOS and Android text scaling for the same You-tab route
- Missing fixtures: none for the local placeholder account state
- Follow-up needed: verify this route on native devices before final launch acceptance
