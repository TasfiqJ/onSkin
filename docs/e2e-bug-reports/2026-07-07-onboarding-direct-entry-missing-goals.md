# E2E Bug Report: Onboarding direct-entry missing goals recovery

Severity: Medium
Surface: Expo web
Environment: Expo web, 320 x 568 phone viewport, `EXPO_PUBLIC_E2E_PROFILE_SAVE_FAILURE=once`
Feature: First-run onboarding
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/onboarding/consent` directly instead of entering through `/onboarding/goals`.
2. Grant health-data collection consent, complete the quiz, and skip product intake.
3. Let the profile-save-failure fixture show the retry state, then tap `Try again`.

## Expected Result

Onboarding should not invent a default goal or strand the user. If a completed quiz has no selected goal, the app should recover to Goals, then resume the completed onboarding path after the user selects a goal.

## Actual Result

Before the fix, the direct-entry path could reach profile persistence with complete quiz answers but no selected goals. The local profile store rejects records with no approved onboarding goals, so retry stayed on `/onboarding/analyzing` instead of reaching Reveal.

## Evidence

- UI snapshot: initial failed automation observed `/onboarding/analyzing` after retry timeout.
- Post-fix evidence folder: `test-results/human-e2e/2026-07-07/onboarding-direct-no-goals-recovery/`

## Frequency

- Always for the tested direct consent/quiz path with no selected goals before the fix.

## Scope

- Affected route/screen: `/onboarding/products`, `/onboarding/analyzing`, `/onboarding/goals`
- Affected account or fixture: Local Expo web onboarding context with no selected goals
- External service involved: None
- Destructive action involved: None

## Suspected Cause

The normal route order requires Goals before consent/quiz, but direct route entry allowed Products and Analyzing to proceed without checking that goal context existed. Persistence correctly rejected an empty goals array, but the UI had no recovery path.

## Minimal Fix Recommendation

Guard Products and Analyzing when `goals.length === 0` by routing to `/onboarding/goals`. If the quiz is already complete, Goals should route back to Products after a goal is selected instead of forcing the full quiz to restart.

## Verification Flow After Fix

1. Open `/onboarding/consent` directly with the profile-save-failure fixture enabled.
2. Complete consent, quiz, and product skip without goals.
3. Verify the app recovers to Goals.
4. Select `Hydration`, tap Continue, and verify Products opens without losing quiz completion.
5. Skip products, verify the profile-save-failure retry state, tap `Try again`, and verify Reveal opens.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/onboarding-direct-no-goals-recovery/04-recovered-goals-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-07/onboarding-direct-no-goals-recovery/06-back-to-products-after-goal-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-07/onboarding-direct-no-goals-recovery/08-reveal-after-direct-recovery-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/onboarding-direct-no-goals-recovery/onboarding-direct-no-goals-recovery-summary.json`
- Focused tests: `npm --workspace apps/mobile run test -- src/features/onboarding/onboardingRoutes.test.ts src/features/onboarding/quizSelection.test.ts src/features/onboarding/healthConsent.test.ts src/features/onboarding/skinProfileStore.test.ts`

## Remaining Risk

- Untested branches: Native iOS and Android navigation stack behavior for the same direct-entry sequence.
- Missing fixtures: Native keyboard/accessibility focus evidence.
- Follow-up needed: Add this direct-entry branch to the eventual durable onboarding E2E suite.
