# E2E Bug Report: Onboarding short-phone footer focus

Severity: Medium
Surface: Expo web
Environment: Codex in-app browser, Expo web at 320 x 480, port 8181
Feature: First-run onboarding goals and product intake
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web and set the browser viewport to 320 x 480.
2. Open `/onboarding/goals` and inspect the goal cards near the fixed Continue footer.
3. Open `/onboarding/products` and inspect the empty product-intake state.
4. Enter a product name and inspect the optional category picker path.

## Expected Result

Goal cards and optional product controls should not sit underneath fixed footer actions. Every visible control should be at least 44 px, center hit-tests should resolve to the intended control, and optional category selection should remain visible and intentional on very short phones.

## Actual Result

The short-phone audit found `/onboarding/goals` still had goal cards whose centers hit the fixed Continue footer, and `/onboarding/products` still had an optional category trigger geometrically under `Skip for now` even though it was clipped from view.

## Evidence

- Reproduction screenshots and geometry: `test-results/human-e2e/2026-07-08/short-phone-480-route-audit-2/`
- Post-fix evidence folder: `test-results/human-e2e/2026-07-08/onboarding-short-phone-480-footer-recheck/`
- Post-fix summary: `test-results/human-e2e/2026-07-08/onboarding-short-phone-480-footer-recheck/summary.json`

## Frequency

- Always in the tested 320 x 480 Expo web viewport before the fix.

## Scope

- Affected route/screen: `/onboarding/goals`, `/onboarding/products`
- Affected account or fixture: local first-run onboarding state
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The goals route used a vertical compact list that still exceeded the usable area above the fixed footer on the shortest phone viewport. The products route clipped the compact category trigger visually, but the trigger still existed in the scroll content behind the fixed footer and remained part of the interactive tree.

## Minimal Fix Recommendation

Use an explicit short-phone two-column goal card layout that fits above the footer, keep the goals scroll wrapper shrinkable with `minHeight: 0`, and move the compact product category selector into the visible footer only after a product name exists.

## Verification Flow After Fix

1. Open `/onboarding/goals` at 320 x 480 and confirm all six goal cards plus Continue are visible with no hit-blocked controls.
2. Open `/onboarding/products` at 320 x 480 and confirm the empty state shows Product name plus `Skip for now` with no hidden category trigger.
3. Type `Retinol serum`, confirm exactly one visible `Choose product category` footer action appears above `Add to shelf`, open the picker, choose `Serum`, and confirm the footer shows `Category, Serum` plus `Add to shelf`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/onboarding-short-phone-480-footer-recheck/onboarding-goals-after-plain-width.png`
- Screenshot: `test-results/human-e2e/2026-07-08/onboarding-short-phone-480-footer-recheck/onboarding-products.png`
- Screenshot: `test-results/human-e2e/2026-07-08/onboarding-short-phone-480-footer-recheck/onboarding-products-name-entered.png`
- Screenshot: `test-results/human-e2e/2026-07-08/onboarding-short-phone-480-footer-recheck/onboarding-products-category-sheet.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/onboarding-short-phone-480-footer-recheck/summary.json`

## Remaining Risk

- Native iOS/Android keyboard, Dynamic Type, VoiceOver/TalkBack, and home-indicator safe-area behavior still need simulator/device QA.
