# E2E Bug Report: Onboarding Product Category Picker Safe Area

Severity: Medium
Surface: Expo web verified; iOS / Android risk
Environment: Codex in-app browser, Expo web through the first-run onboarding path, 320 x 480 compact viewport
Feature: First-run onboarding product intake
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start at `/onboarding/goals` on a compact phone surface.
2. Select one goal, grant health-data consent, complete the quiz, and reach `/onboarding/products`.
3. Enter a product name and tap `Choose product category`.

## Expected Result

The category picker behaves like the shared hardened bottom sheets: it preserves compact web spacing, adds native bottom-inset padding when a real iOS or Android gesture inset exists, keeps at least a 48 px outside dismiss target, exposes exactly one named modal dialog, and keeps category options scrollable on short screens or large text settings.

## Actual Result

The picker used a fixed `pb-10` bottom padding with a height value passed from the parent. That kept the compact Expo web baseline, but it did not add native bottom-inset clearance and did not own a local dismiss-reserve contract. The category list was a non-scrollable wrapped block, so large text or additional categories could push options into the native home-indicator area. A first patch also exposed nested web dialog nodes through React Native `Modal`, so the final fix moved the compact picker to the route-local overlay pattern already used by the hardened Shelf picker.

## Evidence

- Initial source-verified UI snapshot: `test-results/human-e2e/2026-07-08/onboarding-product-category-picker-safe-area/01-products-compact-state.json`
- Post-fix evidence: `test-results/human-e2e/2026-07-08/onboarding-product-category-picker-320x480-postfix/`
- Key screenshots: `14-category-sheet-open-overlay.png`, `15-category-selected-overlay.png`, `16-product-added-overlay.png`
- Audit: `test-results/human-e2e/2026-07-08/onboarding-product-category-picker-320x480-postfix/audit.json`

## Frequency

- Always in source before the fix for native bottom-inset devices and compact web dialog semantics.

## Scope

- Affected route/screen: `/onboarding/products`
- Affected account or fixture: first-run local product intake
- External service involved: No
- Destructive action involved: No

## Suspected Cause

`CategoryPickerSheet` was a local `Modal` implementation rather than the route-local hardened overlay pattern, so it missed native safe-area and scrollable-content hardening and could expose nested dialog semantics on web.

## Minimal Fix Recommendation

Move the sheet-height and safe-area contract into `CategoryPickerSheet`: use `useWindowDimensions()` and `useSafeAreaInsets()`, render a route-local absolute overlay only while visible, cap the sheet at `viewportHeight - 52`, keep the existing 40 px compact web baseline, add `insets.bottom + 24` only when a real bottom inset exists, expose one named modal dialog on web, hide the covered route content from the accessibility tree while the dialog is open, and wrap category chips in a shrinkable `ScrollView`.

## Verification Flow After Fix

1. Start Expo web and complete goals, consent, and quiz to reach `/onboarding/products` at 320 x 480.
2. Verify the compact route shows a collapsed `Choose product category` control, zero horizontal overflow, and visible 48 px controls.
3. Enter a product name and open the category picker.
4. Verify one named modal dialog, named dismiss/close targets, 48 px category chips, zero horizontal overflow, and scrollable options.
5. Select `SPF`, add the product, and confirm the product row plus remove control are visible.

## Post-Fix Evidence

- Human E2E: `test-results/human-e2e/2026-07-08/onboarding-product-category-picker-320x480-postfix/`
- Focused regression: `npm --workspace apps/mobile run test -- onboardingRoutes.test.ts productCategories.test.ts`
- Typecheck: `npm --workspace apps/mobile run typecheck`
- Lint: `npm --workspace apps/mobile run lint`

## Remaining Risk

- Native iOS/Android home-indicator, Dynamic Type, VoiceOver, and TalkBack traversal still require device QA.
