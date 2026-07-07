# E2E Bug Report: Onboarding Profile Save Failure Test Hook

Severity: Medium
Surface: Expo web
Environment: 320 x 568 viewport, local dev server
Feature: Onboarding analyzing/reveal
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Review the documented `profile save failure before reveal` branch in `docs/USER_FLOW_TREE.md`.
2. Try to execute the branch through the app surface without monkeypatching local storage internals.
3. Complete onboarding to `/onboarding/analyzing`.

## Expected Result

A controlled local fixture can force the first skin-profile save attempt to reject, so the real UI can prove that the app stays on the error state, preserves quiz answers, and reaches reveal after retry.

## Actual Result

The production behavior was already fail-closed, but the branch only had source-level coverage. There was no practical app-surface trigger for human-simulated E2E.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/onboarding-profile-save-failure/01-profile-save-error.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/onboarding-profile-save-failure/01-profile-save-error-text.txt`
- Terminal transcript: focused route test and mobile typecheck output

## Frequency

Always

## Scope

- Affected route/screen: `/onboarding/analyzing`
- Affected account or fixture: local dev onboarding session
- External service involved: none
- Destructive action involved: no

## Suspected Cause

The failure branch depended on storage-level rejection, but the app had no stable dev fixture to trigger that rejection through the actual UI.

## Minimal Fix Recommendation

Add a development-only one-shot fixture, `EXPO_PUBLIC_E2E_PROFILE_SAVE_FAILURE=once`, that makes the first `/onboarding/analyzing` profile-save attempt reject and lets retry call the real persistence path.

## Verification Flow After Fix

1. Start Expo web with `EXPO_PUBLIC_E2E_PROFILE_SAVE_FAILURE=once`.
2. Complete onboarding through age, goals, consent, quiz, and product skip.
3. Confirm `/onboarding/analyzing` shows the save-error retry state.
4. Tap `Try again`.
5. Confirm `/onboarding/reveal` shows the quiz-derived profile.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/onboarding-profile-save-failure/02-profile-reveal-after-retry.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/onboarding-profile-save-failure/02-profile-reveal-after-retry-text.txt`
- Logs: `test-results/human-e2e/2026-07-07/onboarding-profile-save-failure/browser-warn-error-logs.json`

## Remaining Risk

- Native device pass remains open for release QA.
- This fixture is dev-only; production storage failures still depend on actual storage rejection.
