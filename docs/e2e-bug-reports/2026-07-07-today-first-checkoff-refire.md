# E2E Bug Report: Today first check-off activation could re-fire after undo

Severity: Medium
Surface: CLI/source audit
Environment: Local Vitest storage fixture; no live services
Feature: Today routine check-off activation analytics
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Start with no local completion log.
2. Toggle a Today routine step on.
3. Toggle the same step off so the completion log becomes empty.
4. Toggle the same step on again.

## Expected Result

`first_checkoff_completed` should be eligible to fire only once for the install or account, even if the user undoes every completed step and later checks one off again.

## Actual Result

The completion store derived `firstEver` only from the current completion log. If the log returned to empty after an undo, a later re-check could return `firstEver: true` again.

## Evidence

- Source review: `apps/mobile/src/features/today/completionsStore.ts`
- Focused regression: `npm.cmd --workspace apps/mobile run test -- src/features/today/completionsStore.test.ts`
- Privacy registry regression: `npm.cmd --workspace apps/mobile run test -- src/features/settings/localPrivateDataKeys.test.ts`

## Frequency

- Always when a user checked off their first step, undid all completions, and then checked off a step again.

## Scope

- Affected route/screen: Today tab check-off flow
- Affected account or fixture: Local completion state with no durable first-completion marker
- External service involved: Analytics sink only when the event is emitted
- Destructive action involved: No

## Suspected Cause

The activation calculation used `Object.values(log).some(...)` as the only first-completion guard, so undoing all completions removed the evidence that activation had already happened.

## Minimal Fix Recommendation

Persist a durable local first-completion marker, backfill it for legacy completion logs, clear it only through the test/seed reset path, and include the marker in the local private data registry.

## Verification Flow After Fix

1. Run the focused completion-store regression.
2. Confirm first check-off returns `firstEver: true`.
3. Confirm undo returns `firstEver: false`.
4. Confirm re-check returns `firstEver: false`.
5. Confirm legacy logs are marked as already activated before future toggles.

## Post-Fix Evidence

- Focused completion-store regression passed.
- Focused local private data registry regression passed.
- Full mobile test suite passed.
- Repo-level typecheck, lint, test, and brand audit passed.

## Remaining Risk

- Untested branches: Actual app-surface analytics dispatch through the Today tab was not re-run in a simulator or browser for this logic-only slice.
- Missing fixtures: No live analytics destination or seeded app profile was used.
- Follow-up needed: Add durable E2E coverage for first check-off only after the repo selects a mobile or Expo-web-compatible E2E harness.
