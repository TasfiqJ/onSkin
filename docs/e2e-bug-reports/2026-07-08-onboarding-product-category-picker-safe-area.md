# E2E Bug Report: Onboarding Product Category Picker Safe Area

Severity: Medium
Surface: Expo web source-verified; iOS / Android risk
Environment: Codex in-app browser, Expo web at `/onboarding/products`, 320 px compact viewport
Feature: First-run onboarding product intake
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Inspect the hand-built `CategoryPickerSheet` modal in `apps/mobile/src/app/onboarding/products.tsx`.
2. Open `/onboarding/products` on a compact phone surface.
3. Tap `Choose product category`.

## Expected Result

The category picker behaves like the shared hardened bottom sheets: it preserves compact web spacing, adds native bottom-inset padding when a real iOS or Android gesture inset exists, keeps at least a 44 px outside dismiss target, exposes a named modal dialog, and keeps category options scrollable on short screens or large text settings.

## Actual Result

The picker used a fixed `pb-10` bottom padding with a height value passed from the parent. That kept the compact Expo web baseline, but it did not add native bottom-inset clearance and did not own a local 44 px dismiss-reserve contract. The category list was a non-scrollable wrapped block, so large text or additional categories could push options into the native home-indicator area.

## Evidence

- UI snapshot: `test-results/human-e2e/2026-07-08/onboarding-product-category-picker-safe-area/01-products-compact-state.json`
- Terminal transcript: focused onboarding route tests, mobile typecheck, mobile lint, and Expo web run in Codex terminal
- Browser limitation: the in-app browser confirmed `/onboarding/products` at 320 px with no horizontal overflow, then timed out repeatedly before the modal-open click could be captured. Screenshot capture also returned `Unable to capture screenshot`.

## Frequency

- Always in source before the fix for native bottom-inset devices.

## Scope

- Affected route/screen: `/onboarding/products`
- Affected account or fixture: first-run local product intake
- External service involved: No
- Destructive action involved: No

## Suspected Cause

`CategoryPickerSheet` is a local `Modal` implementation rather than the shared `Sheet`, so it missed the shared native safe-area and scrollable-content hardening.

## Minimal Fix Recommendation

Move the sheet-height and safe-area contract into `CategoryPickerSheet`: use `useWindowDimensions()` and `useSafeAreaInsets()`, cap the sheet at `viewportHeight - 44`, keep the existing 40 px compact web baseline, add `insets.bottom + 24` only when a real bottom inset exists, mark the sheet as a modal dialog on web, and wrap category chips in a shrinkable `ScrollView`.

## Verification Flow After Fix

1. Start Expo web and open `/onboarding/products` at 320 x 568.
2. Verify the compact route shows a collapsed `Choose product category` control, zero horizontal overflow, and visible 44+ px controls.
3. Enter a product name and open the category picker.
4. Verify one named modal dialog, named dismiss/close targets, 48 px category chips, zero horizontal overflow, and scrollable options.
5. Select `SPF`, add the product, and confirm the product row plus remove control are visible.

## Post-Fix Evidence

- UI snapshot: `test-results/human-e2e/2026-07-08/onboarding-product-category-picker-safe-area/01-products-compact-state.json`
- Focused regression: `npm --workspace apps/mobile run test -- onboardingRoutes.test.ts productCategories.test.ts`
- Typecheck: `npm --workspace apps/mobile run typecheck`
- Lint: `npm --workspace apps/mobile run lint`

## Remaining Risk

- Modal-open browser evidence is incomplete because the in-app browser plugin timed out after the compact route snapshot.
- Native iOS/Android home-indicator, Dynamic Type, VoiceOver, and TalkBack traversal still require device QA.
