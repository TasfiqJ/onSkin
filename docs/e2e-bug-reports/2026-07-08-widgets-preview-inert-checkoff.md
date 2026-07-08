# E2E Bug Report: Widget check-off preview looked tappable but was inert

Date: 2026-07-08
Feature: Reminders, streaks, and widgets / native-widget preview
Environment: Source inspection plus Codex in-app browser Expo web at 320 x 568

## Summary

The `/routine/widgets` one-tap check-off preview showed a `TAP` affordance on the next routine step, but that row was rendered as a static `View`. For a premium widgets surface, a visible tap affordance with no response makes the preview feel broken and undermines the home-screen widget value prop.

## Reproduction

1. Enable the widgets surface and open `/routine/widgets` with Pro entitlement.
2. Inspect the `ONE-TAP CHECK-OFF` preview.
3. Tap the `Ceramide moisturizer` row marked `TAP`.

## Expected

Every row that looks tappable should be a real, accessible control. Tapping it should update the preview or clearly explain that the action is only available in the native widget build.

## Actual

The `TAP` row was static route content with no `Pressable`, no checkbox state, and no inline feedback.

## Cause

The preview mixed static widget mockup markup with action copy. The row label promised an interaction while the route did not wire an in-app preview state.

## Fix

Convert the preview rows to 48 px checkbox-style `Pressable` controls, update the preview completion count, remove the fake `TAP` label, and show route-owned feedback that the real home-screen check-off still requires the native widget build.

## Verification

- `npm --workspace apps/mobile run test -- src/features/subscription/proGatedRoutes.test.ts` passes.
- Codex in-app browser Expo web at 320 x 568 with `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro` and `EXPO_PUBLIC_PHASE7_WIDGETS_ENABLED=true` opened `/routine/widgets`, tapped `Ceramide moisturizer` and `Mineral SPF 50`, confirmed the count advances to `4 of 4`, confirmed inline feedback says the real home-screen check-off still needs the native widget build, confirmed checkbox state changes to checked, found zero horizontal overflow, found zero visible controls below 44 px, saw no JavaScript dialog, and recorded zero current-route unexpected browser logs.
- Evidence: `test-results/human-e2e/2026-07-08/widgets-preview-checkoff-current/`.
