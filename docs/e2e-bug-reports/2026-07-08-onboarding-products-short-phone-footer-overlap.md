# E2E Bug Report: Onboarding Products Short-Phone Footer Overlap

Severity: Medium
Surface: Expo web
Environment: Codex in-app browser, Expo web at 320 x 480, port 8173
Feature: Onboarding product intake
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web and open `/onboarding/products`.
2. Set the app viewport to 320 x 480.
3. Inspect visible product-intake controls and the fixed footer.

## Expected Result

The product-name input, optional category picker, and fixed footer action should not occupy the same visible pixels. Optional category selection should remain reachable by scrolling and should open a usable picker sheet.

## Actual Result

The category picker trigger sat at `top=425.8 bottom=475.7` while the fixed `Skip for now` footer sat at `top=408.6 bottom=464.6`. On the short viewport, the optional category trigger could be treated as visible and partially in the footer zone instead of being cleanly clipped into the scrollable content.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/short-phone-480-route-audit/onboarding-products.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/short-phone-480-route-audit/summary.json`
- Post-fix screenshots and geometry: `test-results/human-e2e/2026-07-08/onboarding-products-short-phone-footer-fix/`

## Frequency

- Always at 320 x 480 before the fix.

## Scope

- Affected route/screen: `/onboarding/products`
- Affected account or fixture: local onboarding state
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The onboarding product intake has a scroll region above a fixed footer. On short web viewports, the scroll region needed an explicit shrink constraint so overflow content did not visually compete with the footer zone.

## Minimal Fix Recommendation

Add `minHeight: 0` to the compact product-intake scroll wrapper so the ScrollView clips and scrolls above the fixed footer.

## Verification Flow After Fix

1. Open `/onboarding/products` at 320 x 480.
2. Confirm the initial screen shows the product-name input and fixed `Skip for now` footer without visible overlap.
3. Scroll the content, confirm `Choose category` becomes fully reachable above the footer, and open the category picker.
4. Choose `Serum`, enter `Retinol serum`, tap `Add to shelf`, and confirm `1 ON YOUR SHELF` renders with compact footer actions.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/onboarding-products-short-phone-footer-fix/initial.png`
- Screenshot: `test-results/human-e2e/2026-07-08/onboarding-products-short-phone-footer-fix/scrolled-category.png`
- Screenshot: `test-results/human-e2e/2026-07-08/onboarding-products-short-phone-footer-fix/category-picker-open.png`
- Screenshot: `test-results/human-e2e/2026-07-08/onboarding-products-short-phone-footer-fix/after-add.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/onboarding-products-short-phone-footer-fix/scrolled-category-geometry.json`
- UI snapshot: `test-results/human-e2e/2026-07-08/onboarding-products-short-phone-footer-fix/after-add-geometry.json`

## Remaining Risk

- Native iOS/Android keyboard, Dynamic Type, and home-indicator safe-area behavior still need device/simulator QA.
