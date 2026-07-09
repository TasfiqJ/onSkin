# E2E Bug Report: Onboarding paywall compliance row clips at 430 x 932 text pressure

Severity: High
Surface: Expo web
Environment: Headless Chrome via `npm run e2e:text-pressure`, viewport 430 x 932, text scale 200%
Feature: Onboarding paywall, skipped/direct-entry route audit
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Set `TEXT_PRESSURE_VIEWPORT_WIDTH=430`, `TEXT_PRESSURE_VIEWPORT_HEIGHT=932`, and `TEXT_PRESSURE_SCALE=2`.
2. Run the skipped-route text-pressure audit against `/onboarding/paywall` and `/paywall/winback`.
3. Inspect visible paywall controls in the first viewport.

## Expected Result

Terms, Privacy, Restore, primary purchase controls, and the no-card trial path remain complete, 44 px or larger where visible, and center-hit-testable. Lower-priority content can move below the first viewport instead of peeking at the bottom edge.

## Actual Result

`/onboarding/paywall` rendered Terms, Privacy, and Restore at y=906-954 on a 932 px viewport, leaving only 26 px visible. The audit flagged each compliance control as a tiny partial target.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-430-932-current/onboarding-paywall.png`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-430-932-current/onboarding-paywall.json`
- Follow-up failed UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-430-932-paywall-postfix2/onboarding-paywall.json`
- Terminal transcript: `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-430-932-current/report.md`

## Frequency

- Always on the reproduced 430 x 932 / 200% skipped-route profile before the final fix.

## Scope

- Affected route/screen: `/onboarding/paywall`
- Affected account or fixture: Local Expo web E2E fixture with preview checkout unavailable
- External service involved: None
- Destructive action involved: No

## Suspected Cause

The onboarding paywall could enter compact density without satisfying the tall text-pressure guard used to move compliance links into the header. In that compact render path, the bottom compliance row stayed after the reverse-trial card and landed at the viewport edge.

## Minimal Fix Recommendation

Use header compliance for every compact onboarding paywall render, not only the tall-height guard. Keep Terms, Privacy, and Restore present and functional, but move them away from the first-viewport bottom edge when the screen is compressed.

## Verification Flow After Fix

1. Re-run focused `/onboarding/paywall,/paywall/winback` at 430 x 932 / 200%.
2. Re-run the full 21-route skipped/direct-entry set at 430 x 932 / 200%.
3. Confirm zero clipped controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, zero text overflow, and zero disallowed browser logs.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-430-932-paywall-postfix3/onboarding-paywall.png`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-430-932-paywall-postfix3/onboarding-paywall.json`
- Full sweep: `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-430-932-postfix/summary.json`
- Terminal transcript: `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-430-932-postfix/report.md`

## Remaining Risk

- Untested branches: Native iOS/Android Dynamic Type, safe-area, screen-reader, and live store-sheet behavior.
- Missing fixtures: Live RevenueCat purchase/restore fixtures.
- Follow-up needed: Covered by Phase 5/6 native device QA gates.
