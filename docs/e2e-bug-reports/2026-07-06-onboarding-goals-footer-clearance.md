# E2E Bug Report: Onboarding Goals Footer Covers Goal Cards

Severity: Medium
Surface: Expo web
Environment: Expo web at 320 x 568 phone viewport, July 6, 2026
Feature: First-run onboarding / goal selection
Date: 2026-07-06
Tester: Codex

## Reproduction Steps

1. Start Expo web for the mobile app.
2. Open `http://localhost:8086/onboarding/goals` at a 320 x 568 viewport.
3. Inspect the goal cards and fixed `Continue` footer before selecting a goal.

## Expected Result

Goal cards remain large, readable, and scrollable without being visibly covered by the fixed footer. The user can reach every goal, select one or two, and continue to the health-data consent screen.

## Actual Result

The fixed `Continue` footer rendered over the lower goal list on first view. `Continue` occupied `497-552.9` while the `Sensitivity` card occupied `504.9-579.7`, creating a visible overlap in the first-run funnel.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/onboarding-goals-footer-clearance/before-320.png`
- UI snapshot: `Sensitivity` card `504.9-579.7`, `Continue` footer `497-552.9`, horizontal overflow `0`.

## Frequency

- Always on the tested 320 x 568 direct onboarding-goals route.

## Scope

- Affected route/screen: `/onboarding/goals`
- Affected account or fixture: First-run onboarding state
- External service involved: None
- Destructive action involved: None

## Suspected Cause

The fixed-footer onboarding screens used scroll buffers but the goal list still consumed too much vertical space on short phones. The footer also had no explicit paper background, so lower content could visually compete with the CTA area.

## Minimal Fix Recommendation

Use a short-phone compact density for the goal-selection list, keep option cards above 44 px, bound fixed-footer scroll views, and give fixed footers an opaque paper buffer.

## Verification Flow After Fix

1. Reload `/onboarding/goals` at 320 x 568.
2. Confirm five complete goal cards render above the footer with no visible overlap and no horizontal overflow.
3. Scroll to `Barrier repair`, select it, and tap `Continue`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/onboarding-goals-footer-clearance/after-compact-cards-320.png`
- Screenshot: `test-results/human-e2e/2026-07-06/onboarding-goals-footer-clearance/after-scroll-barrier-320.png`
- Screenshot: `test-results/human-e2e/2026-07-06/onboarding-goals-footer-clearance/after-select-barrier-320.png`
- Screenshot: `test-results/human-e2e/2026-07-06/onboarding-goals-footer-clearance/after-continue-consent-320.png`
- UI snapshot: visible goal cards are `63.9` px tall, `Sensitivity` ends at `493.2`, `Continue` starts at `497`, horizontal overflow `0`.
- Interaction: scrolling exposed `Barrier repair` at `63.9` px high, selecting it enabled `Continue`, and tapping `Continue` opened `/onboarding/consent`.

## Remaining Risk

- Untested branches: Native iOS and Android physical-device rendering.
- Missing fixtures: Standard local reset command for fresh first-run onboarding.
- Follow-up needed: Promote the first-run onboarding small-phone branch to durable native E2E after the mobile harness is selected.
