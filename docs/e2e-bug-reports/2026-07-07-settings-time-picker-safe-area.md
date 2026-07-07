# E2E Bug Report: Settings time picker ignored native bottom safe area

Severity: Medium
Surface: Expo web phone-width proxy for iOS and Android
Environment: Expo web at `http://127.0.0.1:8123/settings/timing`
Feature: Settings reminder timing
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/settings/timing`.
2. Tap the Morning reminder time pill.
3. Inspect the hand-built bottom time-picker sheet.
4. Repeat in a compact observed viewport where the sheet nearly fills the
   screen.

## Expected Result

The time-picker sheet should preserve the compact zero-inset web layout while adding bottom safe-area clearance on native iOS and Android devices with a home indicator or gesture navigation.
The named outside dismiss target should also stay at least 44 px high when the
sheet is capped in a short viewport.

## Actual Result

Source review showed the sheet used fixed `pb-10` padding only and did not read `useSafeAreaInsets()`, unlike the hardened shared `Sheet` component. That left native bottom-inset clearance dependent on a fixed physical-edge padding value.
Follow-up compact E2E showed the outside dismiss backdrop could collapse below
44 px when the sheet nearly filled the viewport.

## Suspected Cause

`/settings/timing` owns a local `Modal` bottom sheet instead of using the shared `Sheet` component, so the shared safe-area hardening did not apply.

## Minimal Fix

Import `useSafeAreaInsets()`, compute `sheetPaddingBottom` as `Math.max(40, insets.bottom + 24)` only when `insets.bottom > 0`, and apply it through the sheet style prop. Cap the sheet at `viewportHeight - 44` and shrink the internal time list before the outside dismiss target collapses. This keeps current zero-inset web density while adding native home-indicator clearance and preserving a 44 px named dismiss target.

## Post-Fix Evidence

- Evidence folder: `test-results/human-e2e/2026-07-07/settings-time-picker-safe-area-current/`
- Focused regression: `npm --workspace apps/mobile run test -- settingsRoutes.test.ts`
- Summary: `test-results/human-e2e/2026-07-07/settings-time-picker-safe-area-current/summary.json`
- Screenshot: `test-results/human-e2e/2026-07-07/settings-time-picker-safe-area-current/02-time-picker-dialog-320x568.png`
- Completion screenshot: `test-results/human-e2e/2026-07-07/settings-time-picker-safe-area-current/04-time-picker-selected-8am-320x568.png`
- UI snapshots:
  - `test-results/human-e2e/2026-07-07/settings-time-picker-safe-area-current/01-settings-timing-route-state.json`
  - `test-results/human-e2e/2026-07-07/settings-time-picker-safe-area-current/02-time-picker-dialog-state.json`
  - `test-results/human-e2e/2026-07-07/settings-time-picker-safe-area-current/03-time-picker-dismissed-state.json`
  - `test-results/human-e2e/2026-07-07/settings-time-picker-safe-area-current/04-time-picker-selected-8am-state.json`

## Remaining Risk

- Native iOS/Android device QA is still needed to verify the real nonzero bottom inset, VoiceOver/TalkBack traversal, and OS notification scheduling behavior.
