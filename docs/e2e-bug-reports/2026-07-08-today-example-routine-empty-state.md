# E2E Bug Report: Today exposed example routine as real empty-state check-off

Severity: High
Surface: Expo web, with native parity risk
Environment: Expo web on `localhost:19172`, System Chrome, 320 x 568 phone viewport
Feature: Today routine completion
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with no local shelf/profile routine data.
2. Open `/today?routine=AM`.
3. Inspect the routine card.
4. Seed a six-night PM cycle state and open `/today?routine=PM` at 320 px wide.

## Expected Result

Today should not present the routine-plan example preview as real check-off work. Empty state should provide a clear next action. The PM skin-cycling strip should keep Exfoliate, Retinoid, and Recover readable without ellipses or clipped glyphs.

## Actual Result

Before the fix, Today consumed `usePlan()` directly, including its empty-shelf example plan. That allowed example products such as `Cream cleanser` to appear as checkable Today rows when the user had no real routine. The compact six-night PM strip also rendered one-line labels that visually ellipsized at 320 px.

## Evidence

- E2E evidence folder: `test-results/human-e2e/2026-07-08/today-empty-and-cycle-current/`
- Screenshot: `01-empty-today.png`
- Screenshot: `03-pm-cycle-labels.png`
- UI snapshots: `01-empty-today.json`, `02-empty-add-products-route.json`, `03-pm-cycle-labels.json`
- Browser logs: `empty-today-browser-logs.json`, `pm-cycle-labels-browser-logs.json`

## Frequency

- Always when Today is opened with no real shelf routine.
- Always for compact six-night cycle labels at 320 px before the label fix.

## Scope

- Affected route/screen: `/today`
- Affected account or fixture: Empty local shelf/profile state; local six-night PM cycle fixture
- External service involved: None
- Destructive action involved: None

## Suspected Cause

The routine-plan screen deliberately uses an example plan for empty shelf previews, but Today used that same plan object without checking `isExample`. The PM strip depended on one-line shrink-to-fit labels inside six equal-width segments, which was not enough horizontal space at 320 px.

## Minimal Fix Recommendation

Gate Today check-off rows, recommendation prompts, and the AM tonight teaser behind a real non-example plan. Show a route-owned empty state for the example/no-routine case. Render compact cycle labels as stable two-line visual labels while preserving full accessibility labels.

## Verification Flow After Fix

1. Open `/today?routine=AM` with empty local state.
2. Confirm `No routine yet`, `Build a routine from your shelf.`, and `Add products` render with no example check-off rows.
3. Tap `Add products` and confirm `/shelf/manual`.
4. Seed local shelf/profile state that produces a six-night cycle.
5. Open `/today?routine=PM` at 320 px and confirm Exfoliate/Retinoid/Recover labels are readable, overflow is zero, and visible controls are 44 px or taller.

## Post-Fix Evidence

- Playwright System Chrome pass: `scripts/tmp-e2e/today-empty-and-cycle.spec.js` before cleanup.
- Evidence folder: `test-results/human-e2e/2026-07-08/today-empty-and-cycle-current/`
- Focused tests: `npm --workspace apps/mobile run test -- src/features/today/todayRoute.test.ts src/features/routine/usePlan.test.ts src/features/routine/generate.test.ts src/features/scheduler/projection.test.ts src/features/scheduler/orchestrate.test.ts`

## Remaining Risk

- Native iOS/Android rendering and Dynamic Type still need device QA.
- The E2E run uses web localStorage payloads accepted by the same local-first store readers; native secure-storage behavior still needs device coverage.
