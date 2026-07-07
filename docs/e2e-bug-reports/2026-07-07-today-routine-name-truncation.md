# E2E Bug Report: Today Routine Product Name Truncation

Severity: Medium
Surface: Expo web phone viewport
Environment: Expo web at `http://localhost:8094`, 320x568 viewport
Feature: Today routine completion
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Start Expo web with `npm --workspace apps/mobile run web -- --port 8094`.
2. Open `/today` at a 320x568 phone viewport with a seeded routine product named `Final Sweep Cleanser`.
3. Inspect the Evening routine row next to the `NEXT` affordance.

## Expected Result

Routine product names remain readable on compact phones. A normal product name should wrap cleanly when needed instead of being visually ellipsized.

## Actual Result

The compact Today row limited the product name to one line, so `Final Sweep Cleanser` rendered as `Final Sweep Clean...` beside `NEXT`.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/current-compact-ux-sweep/today-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/current-compact-ux-sweep/today-audit.json`
- Terminal transcript: Expo web session on port `8094`

## Frequency

- Always when a compact routine row has a product name that exceeds the one-line space left by the check circle and `NEXT` label.

## Scope

- Affected route/screen: `/today`
- Affected account or fixture: Local routine fixture with a longer product name
- External service involved: None
- Destructive action involved: No

## Suspected Cause

`CheckRow` used `numberOfLines={compact ? 1 : undefined}` for the product name as well as the compact instruction line. The instruction line has concise compact copy, but product names need more room.

## Minimal Fix Recommendation

Allow compact product names to use two lines while keeping compact instruction copy to one line.

## Verification Flow After Fix

1. Reopen `/today` at 320x568 with the same routine state.
2. Confirm `Final Sweep Cleanser` renders fully without an ellipsis.
3. Confirm the row still clears the floating tab bar and has no horizontal overflow.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/today-routine-name-wrap/today-after-name-wrap-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/today-routine-name-wrap/today-after-name-wrap-320x568-state.json`

## Remaining Risk

- Untested branches: Native iOS and Android Dynamic Type still need simulator/device QA.
- Missing fixtures: The web pass reused current local routine state rather than a durable E2E fixture reset command.
- Follow-up needed: Promote the Today compact-row flow to the chosen durable mobile E2E harness once selected.
