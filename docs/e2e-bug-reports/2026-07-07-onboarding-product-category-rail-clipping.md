# E2E Bug Report: Onboarding product category rail clipping on compact phones

Severity: Medium
Surface: Expo web
Environment: Expo web in-app browser on localhost, 320 x 568 and 390 x 568 compact phone viewports
Feature: Onboarding product intake
Date: 2026-07-07
Tester: Codex human-simulated E2E

## Reproduction Steps

1. Start the mobile app on Expo web.
2. Set the browser viewport to 320 x 568 or 390 x 568.
3. Open `/onboarding/products`.
4. Inspect the optional product category selector and try selecting `SPF`.

## Expected Result

The category selector should feel native on short phones: no clipped labels, no hidden touch targets, no horizontal rail that requires a hard-to-discover gesture, and no controls falling under the fixed footer.

## Actual Result

The compact category rail showed partially clipped offscreen chips. Clicking an offscreen category could auto-scroll the rail into a selected state, but neighboring chips remained clipped and the control felt inconsistent with the rest of the polished mobile layout.

## Evidence

- Before screenshot: `test-results/human-e2e/2026-07-07/compact-route-audit-next/320-onboarding-products.png`
- Before screenshot: `test-results/human-e2e/2026-07-07/compact-route-audit-next/390-onboarding-products.png`
- Before geometry: `test-results/human-e2e/2026-07-07/compact-route-audit-next/run-summary.json`
- Terminal transcript: compact route audit and focused onboarding verifier output in the Codex thread

## Frequency

- Always on the tested compact phone viewports before the fix.

## Scope

- Affected route/screen: `/onboarding/products`
- Affected account or fixture: local Expo web preview state
- External service involved: none
- Destructive action involved: no

## Suspected Cause

The compact layout used a horizontal chip rail inside a narrow card above the fixed footer. The rail exposed partial categories at the viewport edge and did not provide a clear enough small-phone category-selection pattern.

## Minimal Fix Recommendation

Replace the compact horizontal rail with a single collapsed selector that opens a dimmed bottom sheet. Keep the full wrapped chip list on non-compact layouts.

## Verification Flow After Fix

1. Reopen `/onboarding/products` at 320 x 568.
2. Confirm the collapsed selector is fully visible and at least 48 px tall.
3. Tap `Choose category`.
4. Confirm the bottom sheet opens with every category chip visible and at least 48 px tall.
5. Tap `SPF` and confirm the sheet closes back to a full-width `SPF` selector.
6. Repeat at 390 x 568.

## Post-Fix Evidence

- After screenshot: `test-results/human-e2e/2026-07-07/onboarding-product-category-sheet/320-onboarding-products-current.png`
- After screenshot: `test-results/human-e2e/2026-07-07/onboarding-product-category-sheet/320-onboarding-products-category-open.png`
- After screenshot: `test-results/human-e2e/2026-07-07/onboarding-product-category-sheet/320-onboarding-products-spf-selected.png`
- After screenshot: `test-results/human-e2e/2026-07-07/onboarding-product-category-sheet/390-onboarding-products-category-open.png`
- After screenshot: `test-results/human-e2e/2026-07-07/onboarding-product-category-sheet/390-onboarding-products-spf-selected.png`
- Geometry summary: `test-results/human-e2e/2026-07-07/onboarding-product-category-sheet/geometry-summary.json`
- In-app browser screenshot: `test-results/human-e2e/2026-07-07/onboarding-product-category-sheet/320-iab-category-open.png`
- In-app browser screenshot: `test-results/human-e2e/2026-07-07/onboarding-product-category-sheet/320-iab-product-added.png`
- In-app browser screenshot: `test-results/human-e2e/2026-07-07/onboarding-product-category-sheet/390-iab-category-open.png`
- In-app browser screenshot: `test-results/human-e2e/2026-07-07/onboarding-product-category-sheet/390-iab-product-added.png`
- In-app browser geometry summary: `test-results/human-e2e/2026-07-07/onboarding-product-category-sheet/iab-flow-summary.json`
- Terminal transcript: focused verifier and in-app browser run confirmed 320 and 390 px chooser, expanded-chip, selected-state, and product-added geometry.

The rerun passed at 320 x 568 and 390 x 568. The collapsed selector measured 50 px tall, all expanded chips measured 48 px tall, selecting `SPF` collapsed the sheet back into a full-width selected field, and adding the product preserved the 44 px touch-target floor without horizontal overflow or footer collision.

## Remaining Risk

- Untested branches: native iOS and Android simulator rendering of the modal sheet.
- Missing fixtures: none for this visual layout case.
- Follow-up needed: include the same flow in the next native small-device QA sweep.
