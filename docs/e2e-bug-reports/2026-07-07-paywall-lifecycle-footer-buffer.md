# E2E Bug Report: Lifecycle paywall footer buffer on compact phones

Severity: Medium
Surface: Expo web
Environment: Expo web, 320 x 568 and 390 x 568 phone viewports
Feature: Subscription lifecycle paywalls
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/paywall/downgrade` at a 320 x 568 phone viewport.
2. Inspect the fixed action footer and the Terms / Privacy / Restore compliance row.
3. Repeat the route at 390 x 568.
4. Open `/paywall/reoffer` at the same compact viewports and inspect the decline footer.

## Expected Result

Lifecycle paywall bodies scroll above fixed actions. Terms, Privacy, Restore, and decline controls remain reachable, 44 pt or larger, and visually buffered from the bottom edge on compact phones.

## Actual Result

The compact route audit showed `/paywall/downgrade` ending with the decline action too close to the bottom edge. The `Keep using free` control had only an 8 px bottom gap, and the compliance row could land at the lower edge instead of having enough scroll clearance from the fixed action area.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/paywall-upsell-widgets-dismiss-buffer/320-paywall-downgrade.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/paywall-upsell-widgets-dismiss-buffer/pro-paywall-direct-entry-current-summary.json`

## Frequency

- Always in the tested compact downgrade route before the fix.

## Scope

- Affected route/screen: `/paywall/downgrade`, `/paywall/reoffer`
- Affected account or fixture: Local Expo web development state with store checkout unavailable
- External service involved: None
- Destructive action involved: None

## Suspected Cause

The lifecycle paywalls used the standard scroll and footer padding regardless of viewport height. On short phones, the body needed extra scroll clearance and the fixed footer needed an explicit compact bottom cushion.

## Minimal Fix Recommendation

Use the rendered window height to apply compact-only scroll bottom padding and footer bottom padding on lifecycle paywalls while preserving the existing copy, actions, and unavailable-store state.

## Verification Flow After Fix

1. Open `/paywall/downgrade` and `/paywall/reoffer` at 320 x 568 and 390 x 568.
2. Confirm visible controls are not clipped and remain 48 px or taller.
3. Scroll each paywall body and confirm Terms, Privacy, and Restore are reachable above the fixed footer.
4. Tap `Keep using free` and `Continue on free` at 320 x 568.
5. Confirm both actions route to `/today`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/paywall-lifecycle-bottom-buffer/320-paywall-downgrade-initial.png`
- Screenshot: `test-results/human-e2e/2026-07-07/paywall-lifecycle-bottom-buffer/320-paywall-downgrade-scrolled.png`
- Screenshot: `test-results/human-e2e/2026-07-07/paywall-lifecycle-bottom-buffer/320-paywall-reoffer-scrolled.png`
- Screenshot: `test-results/human-e2e/2026-07-07/paywall-lifecycle-bottom-buffer/320-paywall-downgrade-decline-after-click.png`
- Screenshot: `test-results/human-e2e/2026-07-07/paywall-lifecycle-bottom-buffer/320-paywall-reoffer-decline-after-click.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/paywall-lifecycle-bottom-buffer/in-app-browser-paywall-lifecycle-summary.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/paywall-lifecycle-bottom-buffer/in-app-browser-paywall-lifecycle-clicks.json`
- Focused test: `npm --workspace apps/mobile run test -- src/features/subscription/paywallMobileContracts.test.ts`

## Remaining Risk

- Untested branches: Native iOS and Android safe-area rendering for the same lifecycle paywalls.
- Missing fixtures: Live RevenueCat purchase, restore, and native billing sheet evidence.
- Follow-up needed: Add these compact lifecycle paywalls to the eventual native-device visual regression harness.
