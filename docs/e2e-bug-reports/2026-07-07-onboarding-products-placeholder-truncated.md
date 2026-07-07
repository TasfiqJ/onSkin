# E2E Bug Report: Onboarding product placeholder truncates on compact phones

Severity: Low
Surface: Expo web
Environment: `npm --workspace apps/mobile run web -- --port 8097 --host localhost`, 320 x 568 browser viewport
Feature: First-run onboarding product intake
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/onboarding/products` at a 320 x 568 phone viewport.
2. Inspect the product-name input placeholder.

## Expected Result

The placeholder should communicate the expected front-label product entry without clipping or truncation inside the input.

## Actual Result

The previous placeholder, `e.g. Retinol 0.3% Night Serum`, was too long for the compact input width.

## Evidence

- Post-fix screenshots: `test-results/human-e2e/2026-07-07/onboarding-products-placeholder/products-initial-320x568.png`, `products-before-add-320x568.png`, `products-after-add-320x568.png`
- UI snapshots: `test-results/human-e2e/2026-07-07/onboarding-products-placeholder/products-initial-state.json`, `products-after-add-state.json`

## Frequency

Always on compact phone widths before the fix.

## Scope

- Affected route/screen: `/onboarding/products`
- Affected account or fixture: direct-entry local onboarding state
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The placeholder used a detailed product example that exceeded the compact input's visible text width.

## Minimal Fix Recommendation

Use a shorter front-label example and guard it with the onboarding route contract.

## Verification Flow After Fix

1. Open `/onboarding/products` at 320 x 568.
2. Confirm the placeholder is `e.g. Retinol serum` and the input remains readable.
3. Select `Serum`, enter `Retinol serum`, tap `Add to shelf`, then continue.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/onboarding-products-placeholder/products-initial-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-07/onboarding-products-placeholder/products-after-add-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/onboarding-products-placeholder/products-after-continue-state.json`

## Remaining Risk

- Native iOS and Android physical-device verification remains part of Phase 5/Phase 9 external QA.
