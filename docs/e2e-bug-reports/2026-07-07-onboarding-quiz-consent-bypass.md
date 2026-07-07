# E2E Bug Report: Onboarding quiz direct-entry consent bypass

Severity: Critical
Surface: Expo web
Environment: Expo web dev server, in-app browser, 320 x 568 viewport, Windows host
Feature: First-run onboarding health-data consent gate
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Start Expo web.
2. Open `/onboarding/quiz` directly with no local health-data collection grant.
3. Inspect the visible route before taking any consent action.

## Expected Result

The quiz questions do not render until a granted local health-data collection consent exists. Missing, declined, malformed, or unreadable consent state recovers to `/onboarding/consent`.

## Actual Result

The quiz route could render quiz content when opened directly instead of enforcing the dedicated consent screen first.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/onboarding-direct-quiz-consent/direct-quiz-redirect-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/onboarding-direct-quiz-consent/direct-quiz-redirect-state.json`
- Terminal transcript: `npm --workspace apps/mobile run web -- --port 8083 --host localhost`

## Frequency

- Always

## Scope

- Affected route/screen: `/onboarding/quiz`
- Affected account or fixture: fresh or consent-missing local state
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The normal onboarding path asked for health-data collection consent before pushing to the quiz, but the quiz route itself did not verify the local consent record before rendering its questions.

## Minimal Fix Recommendation

Read the local health-data collection consent on quiz mount. Render only a short privacy-check state while loading, allow the quiz only when `granted === true`, and redirect all other states to `/onboarding/consent`.

## Verification Flow After Fix

1. Open `/onboarding/quiz` directly with no local consent grant.
2. Confirm the route recovers to `/onboarding/consent` and no quiz progress or `Next` CTA is visible.
3. Refresh the recovered route and confirm it remains on consent.
4. Tap `I agree. Continue` and confirm the quiz renders.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/onboarding-direct-quiz-consent/direct-quiz-redirect-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-07/onboarding-direct-quiz-consent/reload-consent-recovery-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-07/onboarding-direct-quiz-consent/agree-to-quiz-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/onboarding-direct-quiz-consent/direct-quiz-redirect-state.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/onboarding-direct-quiz-consent/reload-consent-recovery-state.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/onboarding-direct-quiz-consent/agree-to-quiz-state.json`

## Remaining Risk

- Untested branches: native iOS and Android secure-storage timing for the same direct-entry route.
- Missing fixtures: no standard local reset fixture for onboarding consent state yet.
- Follow-up needed: promote this branch to a durable web or native E2E test after OnSkin chooses an E2E harness.
