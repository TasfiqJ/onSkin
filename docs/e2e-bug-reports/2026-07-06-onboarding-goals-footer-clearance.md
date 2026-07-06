# E2E Bug Report: onboarding goals footer clearance

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

Goal cards remain readable and tappable above the fixed footer, and hidden lower goals can be reached by a normal
scroll without the footer covering active content.

## Actual Result

The fixed `Continue` footer overlapped the lower goal cards on first load. The `Sensitivity` card rendered underneath
the footer region, making the route feel cramped and reducing confidence that every option was reachable on short
phones.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/onboarding-goals-footer-clearance/before-320.png`
- UI snapshot: `Continue` y `497`, bottom `552.9`; `Sensitivity` y `504.9`, bottom `579.7`
- Terminal transcript: targeted route and geometry checks from the human-simulated E2E run

## Frequency

- Always at 320 x 568 before the fix

## Scope

- Affected route/screen: `/onboarding/goals`
- Affected account or fixture: first-run onboarding, local browser state
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The route used fixed footer positioning without enough scroll content clearance for a short-phone viewport. The goal
cards also used full-size vertical spacing, leaving insufficient vertical room before the persistent footer.

## Minimal Fix Recommendation

Add explicit scroll flexing and bottom clearance, reduce short-phone-only vertical density on the goals route, and keep
the footer visually separated from scroll content with a small top pad.

## Verification Flow After Fix

1. Reopen `/onboarding/goals` at 320 x 568.
2. Confirm the first five goal cards render fully above the fixed footer with no horizontal overflow.
3. Scroll normally to reveal `Barrier repair`.
4. Select `Barrier repair`.
5. Tap `Continue` and confirm navigation reaches `/onboarding/consent`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/onboarding-goals-footer-clearance/after-compact-cards-320.png`
- Screenshot: `test-results/human-e2e/2026-07-06/onboarding-goals-footer-clearance/after-scroll-barrier-320.png`
- Screenshot: `test-results/human-e2e/2026-07-06/onboarding-goals-footer-clearance/after-select-barrier-320.png`
- Screenshot: `test-results/human-e2e/2026-07-06/onboarding-goals-footer-clearance/after-continue-consent-320.png`
- UI snapshot: visible compact goal card height `63.9`; `Sensitivity` bottom `493.2`; `Continue` y `497`

## Remaining Risk

- Untested branches: native iOS Simulator and Android emulator geometry for this same route
- Missing fixtures: none for this route
- Follow-up needed: run the same first-run onboarding branch on native devices before final launch acceptance
