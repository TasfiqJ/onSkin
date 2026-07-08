# E2E Bug Report: Onboarding Goals Footer Overlap At 320x390

Severity: High
Surface: Expo web
Environment: Codex in-app browser, Expo web dev server on localhost:8156, viewport 320 x 390
Feature: First-run onboarding goal selection
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with `EXPO_PUBLIC_E2E_LOCAL_RESET=1`.
2. Open `/?e2eReset=local` at 320 x 390.
3. Reach `/onboarding/goals`.
4. Inspect or tap the bottom goal row.

## Expected Result

All six goal cards are readable and their tap centers resolve to their own cards before the fixed Continue action.

## Actual Result

Before the fix, the Sensitivity and Barrier repair cards were visible at the bottom of the viewport but their centers were intercepted by the fixed Continue footer.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/onboarding-first-session-390-current/03-after-age.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/onboarding-first-session-390-current/03-after-age.json`

## Frequency

- Always at 320 x 390 before the fix.

## Scope

- Affected route/screen: `/onboarding/goals`
- Affected account or fixture: local first-session onboarding fixture
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The compact goals grid was tuned for 320 x 480, but the 320 x 390 split-short viewport still used 74 px cards plus normal compact spacing. The third row painted into the fixed Continue footer area.

## Minimal Fix Recommendation

Add a split-short density band below 420 px height that tightens the goals heading spacing and uses still-tappable 60 px compact cards with one-line title/subtitle text.

## Verification Flow After Fix

1. Reopen `/?e2eReset=local` at 320 x 390.
2. Reach `/onboarding/goals`.
3. Verify all six goal cards and Continue have no clipped, sub-44, or center-blocked controls.
4. Tap the formerly blocked Sensitivity card.
5. Tap Continue and verify the flow advances to health-data consent.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/onboarding-first-session-390-current/11-postfix-goals-320x390.png`
- Screenshot: `test-results/human-e2e/2026-07-08/onboarding-first-session-390-current/12-postfix-sensitivity-selected-320x390.png`
- Screenshot: `test-results/human-e2e/2026-07-08/onboarding-first-session-390-current/13-postfix-after-goals-continue-320x390.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/onboarding-first-session-390-current/summary.json`
- Recheck: `test-results/human-e2e/2026-07-08/onboarding-goals-split-short-390-current/`

## Remaining Risk

- Untested branches: native iOS/Android Dynamic Type and physical-device safe-area behavior remain device QA.
- Missing fixtures: none for this Expo web reproduction.
- Follow-up needed: include this 320 x 390 onboarding branch in future human-E2E manifest coverage if the manifest is expanded.
