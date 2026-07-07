# E2E Bug Report: Settings time picker ignored native bottom safe area

Severity: Medium
Surface: Expo web phone-width proxy for iOS and Android
Environment: Expo web at `http://localhost:19136`, 320 x 568 viewport
Feature: Settings reminder timing
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/settings/timing`.
2. Tap the Morning reminder time pill.
3. Inspect the hand-built bottom time-picker sheet.

## Expected Result

The time-picker sheet should preserve the compact zero-inset web layout while adding bottom safe-area clearance on native iOS and Android devices with a home indicator or gesture navigation.

## Actual Result

Source review showed the sheet used fixed `pb-10` padding only and did not read `useSafeAreaInsets()`, unlike the hardened shared `Sheet` component. That left native bottom-inset clearance dependent on a fixed physical-edge padding value.

## Suspected Cause

`/settings/timing` owns a local `Modal` bottom sheet instead of using the shared `Sheet` component, so the shared safe-area hardening did not apply.

## Minimal Fix

Import `useSafeAreaInsets()`, compute `sheetPaddingBottom` as `Math.max(40, insets.bottom + 24)` only when `insets.bottom > 0`, and apply it through the sheet style prop. This keeps current zero-inset web density while adding native home-indicator clearance.

## Post-Fix Evidence

- Evidence folder: `test-results/human-e2e/2026-07-07/settings-time-picker-safe-area/`
- Focused regression: `npm --workspace apps/mobile run test -- settingsRoutes.test.ts`
- Screenshot: `test-results/human-e2e/2026-07-07/settings-time-picker-safe-area/morning-picker-320x568.png`
- Completion screenshot: `test-results/human-e2e/2026-07-07/settings-time-picker-safe-area/after-select-6am-320x568.png`

## Remaining Risk

- Native iOS/Android device QA is still needed to verify the real nonzero bottom inset, VoiceOver/TalkBack traversal, and OS notification scheduling behavior.
