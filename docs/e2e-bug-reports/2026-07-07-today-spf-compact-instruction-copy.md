# E2E Bug Report: Today SPF compact instruction is too long

Severity: Medium
Surface: Expo web in-app browser
Environment: Local Expo web server, 320 x 568 compact phone viewport
Feature: Today routine check-off
Date: 2026-07-07
Tester: Codex human-simulated E2E

## Reproduction Steps

1. Seed a local AM routine with `Mineral SPF 50`.
2. Open `/today?routine=AM` at 320 x 568.
3. Complete the SPF step and inspect the compact routine card.

## Expected Result

The compact routine instruction should stay concise, readable, and fully contained inside the card without forcing a cramped two-line advisory on the shortest supported phone viewport.

## Actual Result

The SPF instruction displayed as a clipped single line: `Always the last morning s...`.

## Evidence

- Before screenshot: `test-results/human-e2e/2026-07-07/today-checkoff-persistence/05-after-reload.png`
- Before evidence: `test-results/human-e2e/2026-07-07/today-checkoff-persistence/today-checkoff-summary.json`
- Terminal transcript: Today check-off persistence run in the Codex thread

## Frequency

- Always when the tested local routine contains the SPF instruction on compact phones.

## Scope

- Affected route/screen: `/today`
- Affected account or fixture: local shelf/routine fixture with `Mineral SPF 50`
- External service involved: none
- Destructive action involved: no

## Suspected Cause

The compact routine copy mapper shortened several common instructions but did not include the SPF reapplication sentence.

## Minimal Fix Recommendation

Map the SPF instruction to a shorter compact-only display string while preserving the underlying routine step and completion key.

## Verification Flow After Fix

1. Reopen `/today?routine=AM` at 320 x 568 with the local SPF routine fixture.
2. Confirm the completed SPF row shows `Last step. Reapply later.`
3. Confirm the old full sentence is absent, horizontal overflow is zero, and visible controls remain at least 44 px tall.

## Post-Fix Evidence

- After screenshot: `test-results/human-e2e/2026-07-07/today-spf-compact-instruction/01-after-copy-fix.png`
- Geometry/copy summary: `test-results/human-e2e/2026-07-07/today-spf-compact-instruction/copy-summary.json`

The rerun confirmed the new compact copy is present, the old copy is absent, `copyClientWidth` equals `copyScrollWidth`, horizontal overflow is zero, and visible controls are at least 48 px tall.

## Remaining Risk

- Untested branches: native iOS and Android text rendering for the same compact copy.
- Missing fixtures: none for this local routine case.
- Follow-up needed: include Today compact routine rows in the next native small-device QA sweep.
