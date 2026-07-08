# E2E Bug Report: Progress ProGate legal controls under floating tab bar at text pressure

Severity: Medium
Surface: Expo web
Environment: Codex in-app browser / local Expo web, 320 x 568 compact phone viewport
Feature: Progress contextual photo paywall
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web and open `/progress` as a free user.
2. Set the viewport to 320 x 568.
3. Apply the local 118% text-pressure audit and inspect visible user-facing controls.

## Expected Result

Terms, Privacy, Restore, Maybe later, Start free trial, Explore first, and the floating tab bar should all remain readable and tappable. No visible paywall control should have its center hit-test intercepted by the floating tab bar.

## Actual Result

The `/progress` paywall kept Terms, Privacy, and Restore in the bottom compliance row. Under 118% text pressure, those controls rendered at y=484-533, directly inside the floating tab bar hit zone. Their centers hit `Progress tab Progress`, `TodayProgressShelfYou`, and `Shelf tab Shelf` instead of their own buttons.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/text-scale-120-compact-audit/progress.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/text-scale-120-compact-audit/failures.json`
- Summary: `test-results/human-e2e/2026-07-08/text-scale-120-compact-audit/summary.json`

## Frequency

- Always in the 320 x 568 / 118% text-pressure audit before the fix.

## Scope

- Affected route/screen: `/progress` contextual photo-timeline ProGate.
- Affected account or fixture: free user / local preview store-unavailable state.
- External service involved: none.
- Destructive action involved: none.

## Suspected Cause

`ProGate` only moved compliance links into the compact header for `shortPaywall` viewports below 520 px. The 320 x 568 progress paywall is compact, but not short, so it kept bottom compliance. Increased text pressure pushed that bottom row into the fixed floating tab bar zone.

## Minimal Fix Recommendation

Promote compact progress photo paywalls to the same header-compliance treatment as short paywalls. Keep the 48 px Terms, Privacy, Restore, and Maybe later controls in the top action band, and suppress the duplicate bottom compliance row for that compact progress state.

## Verification Flow After Fix

1. Re-open `/progress`, `/progress/capture`, and `/progress/review` at 320 x 568.
2. Confirm Terms, Privacy, Restore, Maybe later, Start free trial, and Explore first are visible and center-hit-test to themselves.
3. Run the subscription paywall mobile source contract test.

## Post-Fix Evidence

- Screenshots: `test-results/human-e2e/2026-07-08/progress-progate-text-pressure-postfix/`
- UI snapshots: `test-results/human-e2e/2026-07-08/progress-progate-text-pressure-postfix/summary.json`
- Test: `npm --workspace apps/mobile run test -- src/features/subscription/paywallMobileContracts.test.ts`

## Remaining Risk

- Untested branches: native iOS/Android Dynamic Type, hardware safe-area/home-indicator, and screen-reader traversal.
- Missing fixtures: native simulator/device text scaling.
- Follow-up needed: run physical iOS/Android Dynamic Type and TalkBack/VoiceOver QA before release.
