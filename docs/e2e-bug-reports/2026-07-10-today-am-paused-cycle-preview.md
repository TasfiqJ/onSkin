# E2E Bug Report: Today AM preview ignores paused cycle

Severity: Medium
Surface: Expo web
Environment: In-app browser, 390 x 844, `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`, `EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE=open`
Feature: Cycle disruption and deterministic resume
Date: 2026-07-10
Tester: Codex

## Reproduction Steps

1. Open `/cycle/disruption`, pause the routine, and complete the persisted retry.
2. Return to `/today` while the morning routine is selected.

## Expected Result

The cycle preview states that the cycle is paused and does not describe a cycle night as currently running.

## Actual Result

The morning Today preview still renders `Tonight · Cycling night 4` and its scheduled slot description while the same persisted cycle state exposes `Resume my routine` on `/cycle/disruption`.

## Evidence

- UI snapshot: `test-results/human-e2e/2026-07-10/cycle-disruption-reconciliation-current/pre-fix-today-am-paused-contradiction-390x844-dom.txt`
- Browser logs: Pending final run summary.

## Frequency

- Always while the cycle is paused and Today is on the AM surface.

## Scope

- Affected route/screen: `/today?routine=AM`
- Affected account or fixture: Local Pro cycle configuration with `pausedFrom` set
- External service involved: None
- Destructive action involved: No

## Suspected Cause

The AM cycle preview branches on recovery and skip state but omits `cycleData.paused`; the PM surface already handles the paused state.

## Minimal Fix Recommendation

Add paused title and description branches to the existing AM cycle preview using the same canonical `cycleData.paused` value that suppresses PM actives.

## Verification Flow After Fix

1. Pause from `/cycle/disruption` and return to AM Today.
2. Verify the preview says `Tonight · Paused` with no running-night claim.
3. Reload, reopen `/cycle/disruption`, resume, and verify the normal projected cycle-night preview returns.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-10/cycle-disruption-reconciliation-current/12-today-am-paused-corrected-390x844.png`
- UI snapshot: `test-results/human-e2e/2026-07-10/cycle-disruption-reconciliation-current/12-today-am-paused-corrected-390x844-dom.txt`
- Geometry: `test-results/human-e2e/2026-07-10/cycle-disruption-reconciliation-current/12-today-am-paused-corrected-390x844-geometry.json`
- Logs: `test-results/human-e2e/2026-07-10/cycle-disruption-reconciliation-current/browser-unexpected-logs.json` contains zero entries.

## Remaining Risk

- Native screen-reader announcement and timezone rollover remain release-device QA.
