# E2E Bug Report: Onboarding category chip clipped under footer

Severity: Medium
Surface: Expo web
Environment: Expo web at `http://localhost:8098`, browser viewport 320 x 568
Feature: Onboarding products intake
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/onboarding/products` on a 320 x 568 phone viewport.
2. Inspect the category chips above the fixed bottom action.
3. Try to reach the last category, `Oil / balm`.

## Expected Result

The category controls stay fully visible and tappable above the fixed footer, with every category reachable on compact phones.

## Actual Result

The lower `Oil / balm` chip was half-visible at the bottom of the card, visually colliding with the fixed footer area.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/current-compact-ux-sweep/onboarding-products-320x568.png`

## Frequency

- Always on the captured 320 x 568 products intake state.

## Scope

- Affected route/screen: `/onboarding/products`
- Affected account or fixture: Local Expo web state.
- External service involved: None.
- Destructive action involved: None.

## Suspected Cause

The compact Products screen rendered the optional categories as a wrapped chip grid. Seven 48 px chips plus the product input and fixed footer exceeded the first compact viewport, leaving the final row partially hidden.

## Minimal Fix Recommendation

Use a compact horizontal chip rail for the optional category selector while preserving 48 px chip targets. Keep the wrapped grid for larger screens.

## Verification Flow After Fix

1. Open `/onboarding/products` at 320 x 568.
2. Confirm the initial category row is fully above the fixed footer.
3. Horizontally scroll the category rail to `Oil / balm`.
4. Select `Oil / balm`, enter `Squalane Oil`, and tap `Add to shelf`.
5. Confirm the added item and remove control are visible above the fixed `Continue` footer.
6. Tap `Continue` and confirm the onboarding flow recovers to a safe next route.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/onboarding-products-category-rail/products-category-rail-initial-320x568.png`
- UI snapshot/state: `test-results/human-e2e/2026-07-07/onboarding-products-category-rail/products-category-rail-initial-320x568-state.json`
- Screenshot: `test-results/human-e2e/2026-07-07/onboarding-products-category-rail/products-category-rail-scrolled-320x568.png`
- UI snapshot/state: `test-results/human-e2e/2026-07-07/onboarding-products-category-rail/products-category-rail-scrolled-320x568-state.json`
- Screenshot: `test-results/human-e2e/2026-07-07/onboarding-products-category-rail/products-category-rail-added-320x568.png`
- UI snapshot/state: `test-results/human-e2e/2026-07-07/onboarding-products-category-rail/products-category-rail-added-320x568-state.json`
- UI snapshot/state: `test-results/human-e2e/2026-07-07/onboarding-products-category-rail/products-category-rail-after-continue-state.json`
- Logs: `test-results/human-e2e/2026-07-07/onboarding-products-category-rail/products-category-rail-browser-logs.json`

## Remaining Risk

- Native iOS and Android visual QA remains required for final device approval.
