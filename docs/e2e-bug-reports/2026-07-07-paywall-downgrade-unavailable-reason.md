# E2E Bug Report: Paid-Expiry Renewal Disabled Without Reason

Severity: Medium
Surface: Expo web
Environment: Local development, 320 x 568 viewport, RevenueCat/native store checkout unavailable by design
Feature: Subscription lifecycle paywall
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Start Expo web locally.
2. Open `/paywall/downgrade` at 320 x 568.
3. Inspect the paid-expiry lifecycle paywall while local store checkout is unavailable.

## Expected Result

The disabled renewal action explains why purchase is unavailable, without exposing infrastructure details or leaving the user with an inert-looking CTA.

## Actual Result

Before the fix, `Renew Pro` was disabled on the paid-expiry downgrade screen but the route did not render the store-unavailable reason shown by the other purchase-capable paywall surfaces.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/paywall-downgrade-unavailable-reason/downgrade-320.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/paywall-downgrade-unavailable-reason/downgrade-320-state.json`
- Logs: `test-results/human-e2e/2026-07-07/paywall-downgrade-unavailable-reason/console-warn-error.json`

## Frequency

Always in local web preview or any environment where the offering status disables purchase.

## Scope

- Affected route/screen: `/paywall/downgrade`
- Affected account or fixture: Paid-expiry lifecycle route with unavailable store checkout
- External service involved: RevenueCat/native store checkout state only; no live purchase attempted
- Destructive action involved: No

## Suspected Cause

`/paywall/reoffer`, `/paywall/upsell`, onboarding paywall, and contextual Pro gates rendered `offering.data.reason` for unavailable store states, but `/paywall/downgrade` only disabled the CTA.

## Minimal Fix Recommendation

Render the shared offering reason near the disabled renewal action and pin it with a lifecycle paywall contract test.

## Verification Flow After Fix

1. Open `/paywall/downgrade` at 320 x 568.
2. Confirm the disabled `Renew Pro` action has the store-unavailable explanation visible nearby.
3. Scroll the body and confirm lifecycle details plus Terms, Privacy, and Restore remain reachable with 48 px controls.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/paywall-downgrade-unavailable-reason/downgrade-320.png`
- Screenshot: `test-results/human-e2e/2026-07-07/paywall-downgrade-unavailable-reason/downgrade-320-scrolled.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/paywall-downgrade-unavailable-reason/downgrade-320-state.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/paywall-downgrade-unavailable-reason/downgrade-320-scrolled-state.json`

## Remaining Risk

- Untested branches: Native iOS/Android RevenueCat purchase sheet, restore receipts, sandbox billing
- Missing fixtures: Live RevenueCat offering and sandbox entitlement account
- Follow-up needed: Founder/device QA for B-REVENUECAT once App Store Connect and Google Play products are configured
