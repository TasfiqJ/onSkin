# E2E Bug Report: Onboarding Goals Footer Clearance

Severity: High
Surface: Expo web, 320 x 568 phone viewport
Environment: Expo web dev server on localhost, onboarding route `/onboarding/goals`
Feature: First-run onboarding goal selection
Date: 2026-07-06
Tester: Codex

## Reproduction Steps

1. Start the Expo mobile web surface.
2. Open `/onboarding/goals` in a 320 x 568 phone viewport.
3. Inspect the lower goal cards and fixed `Continue` footer before scrolling.

## Expected Result

Goal cards remain readable, tappable, and scrollable without being visibly covered by the fixed footer. The user can
reach every goal, select one or two, and continue to the health-data consent screen.

## Actual Result

The fixed `Continue` footer overlapped the lower goal cards on first load. In the captured geometry, `Continue`
occupied y `497-552.9` while the `Sensitivity` card occupied y `504.9-579.7`, creating a visible overlap in the
first-run funnel and making the route feel cramped on short phones.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/onboarding-goals-footer-clearance/before-320.png`
- UI snapshot: `Sensitivity` card `504.9-579.7`, `Continue` footer `497-552.9`, horizontal overflow `0`
- Terminal transcript: targeted route and geometry checks from the human-simulated E2E run

## Frequency

- Always on the tested 320 x 568 direct onboarding-goals route before the fix

## Scope

- Affected route/screen: `/onboarding/goals`
- Affected account or fixture: first-run onboarding, local browser state
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The fixed-footer onboarding screens used scroll buffers, but the goal list still consumed too much vertical space on
short phones. The footer also lacked enough visual and scroll separation from active content.

## Minimal Fix Recommendation

Use a short-phone compact density for the goal-selection list, keep option cards above 44 px, bound fixed-footer scroll
views, and give fixed footers an opaque paper buffer with enough bottom clearance.

## Verification Flow After Fix

1. Reload `/onboarding/goals` at 320 x 568.
2. Confirm five complete goal cards render above the footer with no visible overlap and no horizontal overflow.
3. Scroll normally to reveal `Barrier repair`.
4. Select `Barrier repair`.
5. Tap `Continue` and confirm navigation reaches `/onboarding/consent`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/onboarding-goals-footer-clearance/after-compact-cards-320.png`
- Screenshot: `test-results/human-e2e/2026-07-06/onboarding-goals-footer-clearance/after-scroll-barrier-320.png`
- Screenshot: `test-results/human-e2e/2026-07-06/onboarding-goals-footer-clearance/after-select-barrier-320.png`
- Screenshot: `test-results/human-e2e/2026-07-06/onboarding-goals-footer-clearance/after-continue-consent-320.png`
- UI snapshot: visible compact goal cards are `63.9` px tall, `Sensitivity` ends at `493.2`, `Continue` starts at
  `497`, horizontal overflow `0`
- Interaction: scrolling exposed `Barrier repair`, selecting it enabled `Continue`, and tapping `Continue` opened
  `/onboarding/consent`

## Remaining Risk

- Untested branches: native iOS Simulator, Android emulator, and physical-device rendering for this same route
- Missing fixtures: standard local reset command for fresh first-run onboarding
- Follow-up needed: promote the first-run onboarding small-phone branch to durable native E2E after the mobile harness
  is selected
