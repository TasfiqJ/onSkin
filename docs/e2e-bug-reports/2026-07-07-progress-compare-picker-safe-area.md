# E2E Bug Report: Progress Compare Picker Safe Area

Severity: Medium
Surface: Expo web verified; iOS / Android risk
Environment: Codex in-app browser, Expo web at `http://127.0.0.1:8124/progress`, fixture flag `EXPO_PUBLIC_E2E_PROGRESS_PHOTOS=populated`
Feature: Progress comparison photo picker
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Inspect the hand-built `PairPicker` modal in `apps/mobile/src/app/(tabs)/progress.tsx`.
2. Open a populated Progress timeline on a compact phone surface.
3. Tap the first comparison date chip to open the picker.

## Expected Result

The picker sheet keeps compact web spacing while adding enough bottom padding for native iOS and Android home-indicator / gesture-navigation insets. The named outside dismiss target also remains at least 44 px when the sheet is capped in compact viewports.

## Actual Result

The sheet used a fixed `pb-10` bottom padding only. That preserves Expo web density, but on native phones with a real bottom inset the photo options could sit too close to the home indicator. The source also did not enforce a viewport-height cap that protects the outside dismiss target if the sheet grows.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/progress-compare-picker-safe-area-current/02-photo-picker-dialog-compact.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/progress-compare-picker-safe-area-current/02-photo-picker-dialog-state.json`
- Logs: `test-results/human-e2e/2026-07-07/progress-compare-picker-safe-area-current/browser-warn-error-logs.json`
- Terminal transcript: focused Vitest and Expo web run in Codex terminal

## Frequency

- Always in source before the fix for native bottom-inset devices.

## Scope

- Affected route/screen: `/progress`, comparison date picker modal
- Affected account or fixture: Populated local photo timeline
- External service involved: No
- Destructive action involved: No

## Suspected Cause

`PairPicker` is a local `Modal` implementation rather than the shared `Sheet`, so it missed the shared native safe-area padding hardening.

## Minimal Fix Recommendation

Use `useSafeAreaInsets()` inside `PairPicker`, keep the existing `pb-10` compact web baseline, only override bottom padding when `insets.bottom > 0`, and cap the sheet at `viewportHeight - 44` so the outside dismiss target does not collapse below the touch-target floor.

## Verification Flow After Fix

1. Start Expo web with populated Progress fixtures.
2. Open `/progress` at 320 x 568.
3. Enter the local Pro preview if the contextual paywall appears.
4. Tap the first comparison date chip.
5. Verify the picker opens with one named dialog, a named dismiss target, contextual photo tile labels, no horizontal overflow, and 40 px compact web bottom padding.
6. Dismiss the picker once, then reopen it.
7. Select a different photo and verify the picker dismisses and the date chip updates.

## Post-Fix Evidence

- Evidence folder: `test-results/human-e2e/2026-07-07/progress-compare-picker-safe-area-current/`
- Summary: `test-results/human-e2e/2026-07-07/progress-compare-picker-safe-area-current/summary.json`
- Screenshot: `test-results/human-e2e/2026-07-07/progress-compare-picker-safe-area-current/02-photo-picker-dialog-compact.png`
- Completion screenshot: `test-results/human-e2e/2026-07-07/progress-compare-picker-safe-area-current/04-photo-picker-selected-may12-compact.png`
- UI snapshots:
  - `test-results/human-e2e/2026-07-07/progress-compare-picker-safe-area-current/01-progress-compare-route-state.json`
  - `test-results/human-e2e/2026-07-07/progress-compare-picker-safe-area-current/02-photo-picker-dialog-state.json`
  - `test-results/human-e2e/2026-07-07/progress-compare-picker-safe-area-current/03-photo-picker-dismissed-state.json`
  - `test-results/human-e2e/2026-07-07/progress-compare-picker-safe-area-current/04-photo-picker-selected-may12-state.json`
- Focused regression: `npm --workspace apps/mobile run test -- src/features/photos/progressRoutes.test.ts`

## Remaining Risk

- Native iOS/Android device verification is still required to observe the real home-indicator inset.
- Native VoiceOver/TalkBack traversal and real encrypted photo thumbnail rendering still need physical-device QA.
