# E2E Bug Report: Cycle night labels use terse copy

Severity: Medium
Surface: Expo web
Environment: In-app browser, Expo web dev server, 320 x 568 viewport
Feature: Pro scheduler week overview and cycle settings
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Start Expo web and open `/cycle/week` at 320 x 568 as a free user.
2. Start the local no-card reverse trial from the scheduler paywall.
3. Add `Retinol 0.3% Night Serum` and `Glycolic 7% Toner` through the real manual shelf flow.
4. Reopen `/cycle/week` and `/cycle/settings`.

## Expected Result

Cycle-night rows use user-facing labels such as `Night 1`, `Night 2`, etc. on compact phones, with no horizontal overflow, clipped controls, or sub-44 px visible controls.

## Actual Result

`/cycle/week` and `/cycle/settings` showed terse customer-facing labels such as `N1`, `N2`, `N3`, and `N4`.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/cycle-night-labels-current/07-cycle-week-with-actives-320.png`
- Screenshot: `test-results/human-e2e/2026-07-07/cycle-night-labels-current/08-cycle-settings-with-actives-320.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/cycle-night-labels-current/07-cycle-week-with-actives-320.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/cycle-night-labels-current/08-cycle-settings-with-actives-320.json`

## Frequency

- Always with a local reverse-trial entitlement and shelf actives that form a cycle.

## Scope

- Affected route/screen: `/cycle/week`, `/cycle/settings`
- Affected account or fixture: Local reverse-trial/Pro state with retinoid and exfoliating-acid shelf products
- External service involved: None
- Destructive action involved: None

## Suspected Cause

Both screens built visible labels directly from the one-based cycle index using `N${cycleNightNumber}` or `N{cycleNightNumber}`. The accessibility labels were clearer, but the visible copy stayed implementation-like.

## Minimal Fix Recommendation

Format the visible cycle-night label as `Night ${cycleNightNumber}` on both screens and keep compact sizing constrained so the longer label does not create horizontal overflow.

## Verification Flow After Fix

1. Reopen `/cycle/week` at 320 x 568 with the same local reverse-trial and shelf-actives state.
2. Reopen `/cycle/settings` at 320 x 568.
3. Confirm both routes show full `Night #` labels, contain no `N#` visible labels, and keep zero horizontal overflow with no clipped or sub-44 px visible controls.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/cycle-night-labels-current/12-cycle-week-fixed-delayed-viewport.png`
- Screenshot: `test-results/human-e2e/2026-07-07/cycle-night-labels-current/11-cycle-settings-fixed-delayed-viewport.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/cycle-night-labels-current/12-cycle-week-fixed-delayed-viewport.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/cycle-night-labels-current/10-cycle-settings-fixed-320.json`
- Console logs: Browser warn/error logs contained only existing local Supabase placeholder and expo-notifications web warnings.

## Remaining Risk

- Untested branches: Native iOS/Android rendering, Dynamic Type/font-scale, other cycle variants after manual variant switching.
- Missing fixtures: None for this compact Expo web reproduction.
- Follow-up needed: Native simulator/device scheduler pass before public release.
