# E2E Bug Report: Reverse Trial Opens Store Subscription Management

Severity: High
Surface: Expo web phone viewport
Environment: Expo web at `http://localhost:8094`, 390x844 and 320x568 viewport checks
Feature: Settings subscription management
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Seed an active app-granted reverse-trial entitlement.
2. Open `/settings/subscription`.
3. Tap the Pro options row.

## Expected Result

The row opens an in-app Pro keep/options surface. Because the reverse trial is app-granted and no-card, it must not open App Store or Google Play subscription management, must not imply cancellation is available or required, and must not show expired-trial copy while the reverse trial is active.

## Actual Result

The row label changed to `Review Pro options`, but the row still called the same `openStore` handler used for store-backed subscriptions. That handler tracks generic subscription management, attempts native subscription management, and falls back to App Store or Google Play subscription settings.

During the fix verification pass, the support note below the row was also found to reuse App Store cancellation copy for the no-card reverse trial.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/settings-subscription-reverse-trial/03-settings-reverse-trial-390x844.png`
- Video: N/A
- Trace: N/A
- Logs: Expo web session on port `8094`
- UI snapshot: `test-results/human-e2e/2026-07-07/settings-subscription-reverse-trial/03-settings-reverse-trial-state.json`
- Terminal transcript: Source inspection of `apps/mobile/src/app/settings/subscription.tsx`

## Frequency

- Always for active `app_granted` entitlement state before the fix

## Scope

- Affected route/screen: `/settings/subscription`
- Affected account or fixture: Active app-granted reverse-trial entitlement
- External service involved: None for the bug; OS billing handoff would be attempted on native surfaces
- Destructive action involved: No

## Suspected Cause

The UI changed the row label for `app_granted` access but did not split the row action. All Pro states still reused the store-backed `openStore` subscription-management path.

## Minimal Fix Recommendation

Route active reverse-trial users to an in-app keep-options paywall, route other app-granted options to an in-app Pro options surface, and leave OS subscription management only for store-backed subscriptions.

Use no-card reverse-trial support copy in settings instead of cancellation copy while the entitlement is active and app-granted.

## Verification Flow After Fix

1. Seed an active app-granted reverse-trial entitlement.
2. Open `/settings/subscription` and confirm the reverse-trial state plus keep-Pro row.
3. Tap the row and confirm the in-app keep-options surface appears with active reverse-trial copy.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/settings-subscription-reverse-trial/04-settings-reverse-trial-fixed-390x844.png`
- Screenshot: `test-results/human-e2e/2026-07-07/settings-subscription-reverse-trial/08-keep-options-active-390x844-viewport.png`
- Screenshot: `test-results/human-e2e/2026-07-07/settings-subscription-reverse-trial/06-settings-reverse-trial-fixed-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-07/settings-subscription-reverse-trial/07-keep-options-active-320x568.png`
- Video: N/A
- Trace: N/A
- Logs: Expo web session on port `8094`
- UI snapshot: `test-results/human-e2e/2026-07-07/settings-subscription-reverse-trial/04-settings-reverse-trial-fixed-state.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/settings-subscription-reverse-trial/08-keep-options-active-390x844-viewport-state.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/settings-subscription-reverse-trial/06-settings-reverse-trial-fixed-320x568-state.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/settings-subscription-reverse-trial/07-keep-options-active-320x568-state.json`
- Screenshot: `test-results/human-e2e/2026-07-07/reverse-trial-subscription-options/02-settings-no-card-note-fixed.png`
- Screenshot: `test-results/human-e2e/2026-07-07/reverse-trial-subscription-options/04-keep-options-paywall-viewport-clipped.png`
- Screenshot: `test-results/human-e2e/2026-07-07/reverse-trial-subscription-options/05-after-decline-you.png`
- Logs: `test-results/human-e2e/2026-07-07/reverse-trial-subscription-options/browser-console-warn-error.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/reverse-trial-subscription-options/visible-text.txt`
- Terminal transcript: Focused Vitest runs for settings/paywall/cancel-intent contracts

## Remaining Risk

- Untested branches: Native iOS and Android OS billing handoff still need device QA.
- Missing fixtures: Durable mobile E2E fixture reset for subscription states is still open.
- Follow-up needed: Add the chosen native E2E harness before store-submission subscription QA.
