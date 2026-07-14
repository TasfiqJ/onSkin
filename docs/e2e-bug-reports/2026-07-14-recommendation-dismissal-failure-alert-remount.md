# E2E Bug Report: Recommendation dismissal failure alert lost on query remount

Severity: Medium
Surface: Expo web
Environment: Codex in-app browser, 390 x 844, local Expo development server
Feature: Today recommendation SPF prompt
Date: 2026-07-14
Tester: Codex

## Reproduction Steps

1. Build and activate a real routine with a cleanser and no SPF.
2. Start Expo web with `EXPO_PUBLIC_E2E_RECOMMENDATION_DISMISS_FAILURE=once`, open Today, and choose `Not now` on the SPF prompt.
3. Wait for the strict recommendation query reset/read to finish.

## Expected Result

The failed action must not look successful. `Suggestion not dismissed` should remain visible with the still-actionable SPF prompt until the user explicitly reloads or tries the dismissal again.

## Actual Result

The alert appeared briefly, then disappeared after the strict query reset remounted `RecommendationsTeaser`. The SPF prompt returned without any failure explanation.

## Evidence

- UI snapshot: transient alert was present immediately after the failed write and absent after the query-reset wait
- Terminal transcript: Expo server and in-app browser interaction in the current Codex task
- Post-fix folder: `test-results/human-e2e/2026-07-14/recommendation-typed-state-current/`

## Frequency

- Always with the one-shot failure fixture before the fix

## Scope

- Affected route/screen: `/today`
- Affected account or fixture: local isolated browser origin, `EXPO_PUBLIC_E2E_RECOMMENDATION_DISMISS_FAILURE=once`
- External service involved: no
- Destructive action involved: no; the first fixture failure performs no write

## Suspected Cause

Dismissal-failure state was owned inside `RecommendationsTeaser`. The fail-closed query reset temporarily changed the recommendation observer state and remounted the child, resetting its local React state.

## Minimal Fix Recommendation

Own the dismissal-failure flag in `TodayScreenContent` and pass controlled state callbacks into `RecommendationsTeaser`, so a strict cache reread cannot erase the route-level user feedback.

## Verification Flow After Fix

1. Repeat the exact cleanser/no-SPF routine and one-shot failure fixture.
2. Choose `Not now` and wait 4.8 seconds.
3. Confirm the alert and SPF prompt both remain.
4. Choose `Reload suggestion`; confirm only the alert clears.
5. Choose `Not now` again; confirm the committed dismissal removes the prompt.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-14/recommendation-typed-state-current/12-today-dismissal-failure-persistent-390x844.png`
- UI snapshot: `test-results/human-e2e/2026-07-14/recommendation-typed-state-current/ui-snapshots.md`
- Automated contracts: `apps/mobile/src/features/recommendations/RecommendationsTeaser.test.ts`, `apps/mobile/src/features/today/todayRoute.test.ts`
- Browser error count: zero
- JavaScript dialogs: none

## Remaining Risk

- Untested branches: native iOS app lifecycle and VoiceOver announcement timing
- Missing fixtures: native protected-storage interruption
- Follow-up needed: promote the stable Expo-web failure branch to durable browser automation when the repository selects its long-term harness
