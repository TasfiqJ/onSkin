# E2E Bug Report: today compact routine copy truncation

Severity: Medium
Surface: Expo web, 320 x 568 phone viewport
Environment: Expo web dev server on localhost, route `/today`
Feature: Today routine habit loop
Date: 2026-07-06
Tester: Codex

## Reproduction Steps

1. Start the Expo mobile web surface.
2. Open `/today` in a 320 x 568 phone viewport.
3. Inspect the Morning routine card above the contextual SPF prompt.

## Expected Result

Each routine row shows a complete, claim-safe instruction line without visual ellipses, and the SPF prompt remains
clear of the floating tab bar.

## Actual Result

The compact Morning routine card truncated routine instructions with ellipses, including the vitamin C instruction.
The habit card was still functional, but the visible copy looked cramped on the smallest phone viewport.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/navigation-final-sweep/before-today-320.png`
- Geometry: `test-results/human-e2e/2026-07-06/navigation-final-sweep/before-today-320-geometry.json`

## Frequency

- Always at 320 x 568 before the fix

## Scope

- Affected route/screen: `/today`
- Affected account or fixture: local example routine
- External service involved: none
- Destructive action involved: none

## Suspected Cause

Compact phone rows forced the generated instruction copy into one line. Longer safe instructions competed with the
checkbox, row title, and `NEXT` badge, so React Native web visually ellipsized the text.

## Minimal Fix Recommendation

Keep generated plan copy unchanged, but render concise display-only instruction variants for compact phone rows.

## Verification Flow After Fix

1. Reopen `/today` at 320 x 568.
2. Confirm the routine rows show complete compact instructions.
3. Confirm the SPF prompt and tab bar still have clear vertical separation.
4. Reopen `/today` at 360 x 640 and confirm the full routine copy still fits without overflow.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/navigation-final-sweep/after-today-320.png`
- Geometry: `test-results/human-e2e/2026-07-06/navigation-final-sweep/after-today-320-geometry.json`
- Screenshot: `test-results/human-e2e/2026-07-06/navigation-final-sweep/after-today-360x640.png`
- Geometry: `test-results/human-e2e/2026-07-06/navigation-final-sweep/after-today-360x640-geometry.json`

## Remaining Risk

- Untested branches: native iOS and Android text rendering under platform font scaling
- Missing fixtures: none for the default local routine
- Follow-up needed: verify the same compact copy under native Dynamic Type before final launch acceptance
