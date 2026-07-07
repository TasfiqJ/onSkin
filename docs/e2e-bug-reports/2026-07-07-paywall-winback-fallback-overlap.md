# E2E Bug Report: Win-Back Fallback Reason Overlapped CTA Area

Severity: Medium
Surface: Expo web
Environment: Local development, 320 x 568 viewport, native RevenueCat win-back offer unavailable
Feature: Subscription win-back paywall
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Start Expo web locally.
2. Open `/paywall/winback` at 320 x 568.
3. Inspect the unavailable native-offer fallback copy and fixed actions.

## Expected Result

The fallback reason is readable, does not collide with the offer card or CTA, and clearly explains why the user sees `See current Pro plan` instead of a native welcome-back purchase.

## Actual Result

Before the fix, the unavailable-offer reason rendered in the scroll body low enough that the fixed action area clipped and visually overlapped it on a short phone.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/paywall-winback-current-plan-fallback/winback-320.png`
- Screenshot: `test-results/human-e2e/2026-07-07/paywall-winback-current-plan-fallback/winback-320-after.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/paywall-winback-current-plan-fallback/winback-320-after-state.json`

## Frequency

Always on a 320 x 568 viewport when the native win-back offer is unavailable.

## Scope

- Affected route/screen: `/paywall/winback`
- Affected account or fixture: Local preview or any account without a native win-back offer
- External service involved: RevenueCat offer eligibility only; no live purchase attempted
- Destructive action involved: No

## Suspected Cause

The fallback explanation lived inside the scroll body while the action footer stayed fixed, so the compact layout allowed scroll content to bleed underneath the footer on web.

## Minimal Fix Recommendation

Move the unavailable-offer explanation into the action footer, add compact-height layout rules, clip the scroll body, and keep the footer background opaque.

## Verification Flow After Fix

1. Open `/paywall/winback` at 320 x 568.
2. Confirm the fallback reason is readable above `See current Pro plan` with no offer-card overlap.
3. Tap `See current Pro plan` and confirm it opens `/paywall/upsell?feature=full_routine`.
4. Open `/paywall/winback` in a fresh tab, tap `No thanks`, and confirm the app returns to Today.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/paywall-winback-current-plan-fallback/winback-320-final.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/paywall-winback-current-plan-fallback/winback-320-final-state.json`
- Screenshot: `test-results/human-e2e/2026-07-07/paywall-winback-current-plan-fallback/current-plan-destination.png`
- Screenshot: `test-results/human-e2e/2026-07-07/paywall-winback-current-plan-fallback/decline-destination.png`

## Remaining Risk

- Untested branches: Native iOS/Android win-back offer sheet and purchase result states
- Missing fixtures: RevenueCat sandbox account eligible for a real win-back offer
- Follow-up needed: Founder/device QA for B-REVENUECAT once products and win-back offers are configured
