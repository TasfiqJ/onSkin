# E2E Bug Report: Reverse Trial Keep Options Hide Billing Context On Compact Phones

Severity: High
Surface: Expo web phone viewport
Environment: Expo web at `http://localhost:19133`, 320 x 568 viewport
Feature: Settings subscription management / reverse-trial keep options
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Seed or retain an active app-granted reverse-trial entitlement.
2. Open `/settings/subscription` at 320 x 568.
3. Tap `Keep Pro after your week`.

## Expected Result

The keep-options paywall uses active no-card reverse-trial copy, does not show expired-trial copy, and shows the annual price plus the store-unavailable reason before the keep-Pro CTA on the compact phone viewport. Terms, Privacy, and Restore remain reachable without clipped controls.

## Actual Result

The keep-options screen opened with the fixed footer CTA visible before the annual price, store-unavailable reason, and compliance row. A user could see and attempt the disabled keep-Pro action before seeing the billing context.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/reverse-trial-keep-options-current/02-keep-options-initial-320.png`
- Video: N/A
- Trace: N/A
- Logs: Expo web session on port `19133`
- UI snapshot: `test-results/human-e2e/2026-07-07/reverse-trial-keep-options-current/02-keep-options-initial-320-state.json`
- Terminal transcript: Focused source inspection of `apps/mobile/src/app/paywall/reoffer.tsx`

## Frequency

- Always for the active reverse-trial keep-options route at 320 x 568 before the fix.

## Scope

- Affected route/screen: `/settings/subscription`, `/paywall/reoffer`
- Affected account or fixture: Active app-granted reverse-trial entitlement
- External service involved: None for the local preview; native RevenueCat/store purchase remains external QA.
- Destructive action involved: No

## Suspected Cause

`/paywall/reoffer` only added compact scroll padding while keeping the action footer outside the scroll body. On short phones, the annual price and store-unavailable reason stayed in the scroll body below the initial scroll viewport, while the fixed purchase footer remained visible.

## Minimal Fix Recommendation

Move the annual price summary and store-unavailable reason into the compact footer above the purchase CTA, while keeping the taller-screen layout unchanged and preserving scroll access to Terms, Privacy, and Restore.

## Verification Flow After Fix

1. Open `/settings/subscription` with the active reverse trial.
2. Tap `Keep Pro after your week`.
3. Confirm `/paywall/reoffer` shows active no-card copy, no expired-trial copy, the annual price and store-unavailable reason before the CTA, no horizontal overflow, no clipped visible controls, and scroll-reachable Terms/Privacy/Restore controls.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/reverse-trial-keep-options-current/04-keep-options-fixed-initial-320.png`
- Screenshot: `test-results/human-e2e/2026-07-07/reverse-trial-keep-options-current/05-keep-options-fixed-after-scroll-320.png`
- Screenshot: `test-results/human-e2e/2026-07-07/reverse-trial-keep-options-current/06-settings-postfix-320.png`
- Screenshot: `test-results/human-e2e/2026-07-07/reverse-trial-keep-options-current/07-settings-to-keep-options-fixed-320.png`
- Video: N/A
- Trace: N/A
- Logs: Expo web session on port `19133`
- UI snapshot: `test-results/human-e2e/2026-07-07/reverse-trial-keep-options-current/04-keep-options-fixed-initial-320-state.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/reverse-trial-keep-options-current/05-keep-options-fixed-after-scroll-320-state.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/reverse-trial-keep-options-current/07-settings-to-keep-options-fixed-320-state.json`
- Terminal transcript: `npm --workspace apps/mobile run test -- paywallMobileContracts`

## Remaining Risk

- Untested branches: Native iOS and Android purchase sheet, restore, and OS billing-management handoff.
- Missing fixtures: Durable native E2E reset for subscription entitlement states.
- Follow-up needed: Native device QA for RevenueCat localized prices and store dialogs.
