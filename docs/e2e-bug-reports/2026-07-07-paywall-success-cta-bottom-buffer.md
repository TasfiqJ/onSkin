# E2E Bug Report: Paywall success CTA sat flush with compact viewport bottom

Date: 2026-07-07
Environment: Expo web on localhost:8117, 320 x 568 compact phone viewport
Feature: Paywall purchase success confirmation
Priority: Important
Status: Fixed

## Steps To Reproduce

1. Start Expo web.
2. Set the browser viewport to 320 x 568.
3. Open `/paywall/success`.
4. Inspect the primary `See tonight's routine` action geometry.

## Expected

The success badge, title, renewal terms, and renewal metadata remain readable, and the primary Today CTA stays visible with a deliberate bottom buffer.

## Actual

The CTA was visible but its bottom edge landed flush with the viewport bottom on the compact web surface, making the purchase confirmation feel cramped and easy to mis-tap.

## Root Cause

The route rendered the final CTA directly at the bottom of the `Screen` without an explicit short-phone action buffer. The safe-area edge is not enough on Expo web's 320 x 568 viewport.

## Fix

Wrap the CTA in a bottom action buffer, using a larger compact-phone padding while preserving the existing success copy and metadata layout.

## Verification

- Pre-fix route audit: `test-results/human-e2e/2026-07-07/route-audit-next-slice/paywall_success.png`
- Post-fix screenshot: `test-results/human-e2e/2026-07-07/paywall-success-cta-buffer/paywall-success-fixed-320x568.png`
- Post-fix geometry: `test-results/human-e2e/2026-07-07/paywall-success-cta-buffer/paywall-success-fixed-geometry.json`
- Focused contract: `npm --workspace apps/mobile run test -- src/features/subscription/paywallMobileContracts.test.ts`

## Follow-Up

Repeat purchase-success rendering on native iOS and Android once RevenueCat/store sandbox evidence is available.
