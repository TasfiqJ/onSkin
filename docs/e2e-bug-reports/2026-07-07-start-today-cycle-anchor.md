# E2E Bug Report: Start Today Does Not Reset Saved Cycle

Severity: Medium
Surface: Expo web
Environment: Expo web at `http://localhost:8092`, compact viewport 320x568
Feature: First-session shelf-to-routine core loop
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Have an existing saved cycle config with an old anchor, pause state, or same-day skip.
2. Open `/routine/plan`.
3. Tap `Start today`.

## Expected Result

Today opens with the routine cycle anchored to the current day, not paused or skipped, so the first visible check-off matches the plan handoff.

## Actual Result

`Start today` wrote only the legacy `cycleAnchor` key. If `layerwell.cycle.v1` already existed, Today ignored that legacy key and kept the old cycle config.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/core-loop-start-today/02-routine-plan-before-start-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-07/core-loop-start-today/03-today-after-start-before-checkoff-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-07/core-loop-start-today/04-today-after-first-checkoff-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/core-loop-start-today/summary.json`

## Frequency

- Always when a saved `layerwell.cycle.v1` config exists and conflicts with the legacy anchor.

## Scope

- Affected route/screen: `/routine/plan` -> `/today`
- Affected account or fixture: Users with prior local cycle config, pause, or same-day skip state
- External service involved: None
- Destructive action involved: None

## Suspected Cause

The plan CTA called `setCycleAnchor()`, but Today reads `loadCycleConfig()` from `cycleStore.ts`. The legacy anchor is only consulted when no cycle config exists.

## Minimal Fix Recommendation

Call `startCycleToday()` from the plan CTA. In the store helper, re-anchor to today, clear pause state, and remove today's skip while preserving older cycle preferences.

## Verification Flow After Fix

1. Run the focused scheduler store and route-contract tests.
2. Add three products through onboarding intake at 320x568.
3. Open `/routine/plan`, tap `Start today`, and complete the first visible Today PM check-off.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/core-loop-start-today/02-routine-plan-before-start-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-07/core-loop-start-today/03-today-after-start-before-checkoff-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-07/core-loop-start-today/04-today-after-first-checkoff-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/core-loop-start-today/summary.json`
- Unit/contract tests: `npm --workspace apps/mobile run test -- src/features/scheduler/cycleStore.test.ts src/features/subscription/proGatedRoutes.test.ts`

## Remaining Risk

- Untested branches: native iOS/Android storage behavior and a live RevenueCat/Supabase entitlement path.
- Missing fixtures: browser storage seeding was unavailable in the in-app browser evaluate scope, so stale-cycle storage proof is covered by unit test.
- Follow-up needed: native simulator E2E for the same flow once the mobile E2E harness/device target is available.
