# E2E Bug Report: Today completed row could be unchecked by a repeat tap

Severity: Medium
Surface: Expo web / local-first store
Environment: `http://localhost:8170`, 320 x 568 viewport
Feature: Today routine check-off
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start with a real routine row on Today.
2. Tap the row once to complete it.
3. Tap the completed row again.

## Expected Result

The completion is append-only/idempotent: the row remains checked, the counter remains complete, and the first check-off activation path cannot re-fire.

## Actual Result

Before this fix, `toggleCompletion` deleted an existing `(date, stepKey)` pair on a repeat tap, allowing the visible row to return to incomplete.

## Evidence

- Source review: `apps/mobile/src/features/today/completionsStore.ts`
- Focused regression: `npm --workspace apps/mobile run test -- src/features/today/completionsStore.test.ts`
- Post-fix E2E: `test-results/human-e2e/2026-07-08/today-checkoff-append-only/`

## Frequency

- Always when the same completed row was submitted to `toggleCompletion` a second time.

## Scope

- Affected route/screen: Today AM/PM check-off rows and future widget/live-activity check-off entry points using the same store
- Affected account or fixture: Any local completion log
- External service involved: None for local-first v1 behavior
- Destructive action involved: Local completion removal only

## Suspected Cause

The store function was still implemented as a true toggle while the product docs and row component contract define check-offs as append-only completions.

## Minimal Fix Recommendation

Make repeated `toggleCompletion` calls return `{ done: true, firstEver: false }` without deleting the stored step. Prevent already-completed Today rows from invoking the completion handler again so repeat taps do not duplicate analytics.

## Verification Flow After Fix

1. Add a local manual shelf cleanser.
2. Open `/today?routine=AM`.
3. Complete the cleanser row and verify `1 of 1`.
4. Tap the completed row again and verify it remains `1 of 1`.
5. Reload Today and verify it remains `1 of 1`.

## Post-Fix Evidence

- Screenshot sequence: `test-results/human-e2e/2026-07-08/today-checkoff-append-only/01-before-checkoff.png` through `04-after-reload.png`
- UI snapshots: matching `.json` files in the same evidence folder
- Logs: `browser-current-origin-warn-error-logs.json`

## Remaining Risk

- Native iOS/Android haptics, secure storage, and offline sync need device QA.
