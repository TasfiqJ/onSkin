# E2E Bug Report: Cycle cadence review gate direct-route leak

Severity: High
Surface: Expo web production-mode bundle; applies to iOS and Android production builds
Environment: `expo start --web --no-dev --minify --port 8103` with 320 x 568 phone viewport
Feature: Actives scheduler / cycle cadence review gate
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Keep `ROUTINE_CADENCE_REVIEWED` false.
2. Open `/cycle/week`, `/cycle/settings`, and `/cycle/why-tonight` in a non-dev build with a cycle-capable local state.
3. Inspect whether any cadence-specific variant rows, cycle-night assignments, settings actions, or why-tonight explanation trace is visible.

## Expected Result

Production builds should show review-gate copy for unreviewed cadence/ramp guidance, keep daily AM/PM routine context available, and hide cadence-specific controls and explanations until dermatologist and cosmetic-chemist review opens the gate.

## Actual Result

The pending gate slice hid the week/settings cadence surface, but `/cycle/why-tonight` still read `data?.cycle` and `data?.tonight` before applying the review gate. With cached cycle data, that direct route could still render the cadence explanation trace in production.

## Evidence

- Post-fix screenshot: `test-results/human-e2e/2026-07-07/cycle-cadence-review-gate/01-cycle-week-production-gate-320.png`
- Post-fix screenshot: `test-results/human-e2e/2026-07-07/cycle-cadence-review-gate/02-cycle-settings-production-gate-320.png`
- Post-fix screenshot: `test-results/human-e2e/2026-07-07/cycle-cadence-review-gate/03-why-tonight-production-gate-320.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/cycle-cadence-review-gate/01-cycle-week-production-gate-320.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/cycle-cadence-review-gate/02-cycle-settings-production-gate-320.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/cycle-cadence-review-gate/03-why-tonight-production-gate-320.json`
- Logs: `test-results/human-e2e/2026-07-07/cycle-cadence-review-gate/browser-console-warnings-errors.json`

## Frequency

- Always when non-dev `why-tonight` has cached cycle data before the fix.

## Scope

- Affected route/screen: `/cycle/why-tonight`; verified related gates on `/cycle/week` and `/cycle/settings`.
- Affected account or fixture: Any Pro/reverse-trial state with cycle data while cadence review is closed.
- External service involved: None.
- Destructive action involved: No.

## Suspected Cause

The route applied `canUseRoutineCadence()` only to fallback copy. The `cycle` and `tonight` values remained sourced directly from `useCycle()`, so the guarded empty-state branch would not run if cached cycle data existed.

## Minimal Fix Recommendation

Gate the data itself, not just the copy: derive `cycle` and `tonight` as `null` when `canUseRoutineCadence()` is false, and pin the route contract with a regression test.

## Verification Flow After Fix

1. Run focused route and gate tests.
2. Start Expo web with `--no-dev --minify` on a 320 x 568 phone viewport.
3. Open `/cycle/week`, `/cycle/settings`, and `/cycle/why-tonight` directly.
4. Confirm each surface shows review-gate copy and no cadence-specific controls or explanation trace.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/cycle-cadence-review-gate/01-cycle-week-production-gate-320.png`
- Screenshot: `test-results/human-e2e/2026-07-07/cycle-cadence-review-gate/02-cycle-settings-production-gate-320.png`
- Screenshot: `test-results/human-e2e/2026-07-07/cycle-cadence-review-gate/03-why-tonight-production-gate-320.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/cycle-cadence-review-gate/01-cycle-week-production-gate-320.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/cycle-cadence-review-gate/02-cycle-settings-production-gate-320.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/cycle-cadence-review-gate/03-why-tonight-production-gate-320.json`

## Remaining Risk

- Untested branches: Native iOS/Android production binary visual pass.
- Missing fixtures: No live Pro account; local reverse-trial/dev entitlement state was used for route access.
- Follow-up needed: Repeat the same direct-route pass on native release candidates before launch.
