# E2E Bug Report: Community support-floor partial note cards

Severity: Medium
Surface: Expo web
Environment: Codex in-app browser, Expo web on `http://localhost:8255`, 390 x 844 and 320 x 480 viewports
Feature: Skin Notes community hub
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Start Expo web and open `/community`.
2. Set the viewport to 390 x 844.
3. Inspect the first viewport around the lower Skin Notes topic sections.
4. Repeat at the 320 x 480 launch support-floor viewport.

## Expected Result

Visible Skin Notes cards are complete, readable, 44 px or taller, and center-hit-testable. Lower-priority cards may move below the first viewport, but they must not appear as partially clipped targets at the bottom edge.

## Actual Result

At 390 x 844, the first Sunscreen note card started at the bottom edge and was clipped. At 320 x 480, the first Sensitive Skin note card missed the viewport bottom by less than a pixel and still failed the geometry gate as a clipped visible control.

## Evidence

- Screenshot/UI snapshot: `test-results/human-e2e/2026-07-09/routine-analytics-layout-current/19-final-community-390x844.jpg`
- Screenshot/UI snapshot: `test-results/human-e2e/2026-07-09/routine-analytics-layout-current/20-final-community-320x480-floor.jpg`

## Frequency

Always in the tested Community hub viewports before the fix.

## Scope

- Affected route/screen: `/community`
- Affected account or fixture: local seeded Skin Notes copy
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The existing compact-section spacer only applied to narrow compact screens or short screens. A 390 x 844 modern-phone viewport did not receive the sunscreen-section spacer, and the narrow support-floor spacer left the next card just beyond the viewport edge.

## Minimal Fix Recommendation

Apply the sunscreen-section spacer to modern phone heights below 900 px and slightly tighten the narrow compact section spacer so the first supported-floor next-section card is complete.

## Verification Flow After Fix

1. Re-open `/community` at 390 x 844.
2. Re-open `/community` at 320 x 480.
3. Re-run the combined support-floor route sweep.

## Post-Fix Evidence

- Screenshot/UI snapshot: `test-results/human-e2e/2026-07-09/routine-analytics-layout-current/21-final-community-390x844-rerun.jpg`
- Screenshot/UI snapshot: `test-results/human-e2e/2026-07-09/routine-analytics-layout-current/22-final-community-320x480-floor-rerun.jpg`
- Final focused summary: `test-results/human-e2e/2026-07-09/routine-analytics-layout-current/support-floor-summary-final.json`

## Remaining Risk

- Untested branches: native iOS/Android Dynamic Type, VoiceOver/TalkBack traversal, and hardware safe-area combinations.
- Missing fixtures: physical supported iOS 17+ and Android 10+ devices.
- Follow-up needed: keep Phase 5 native device QA as the final proof for platform-specific rendering.
