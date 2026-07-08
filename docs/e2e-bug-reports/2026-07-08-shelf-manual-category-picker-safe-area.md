# E2E Bug Report: Shelf Manual Category Picker Safe Area

Severity: Medium
Surface: Expo web source-verified; iOS / Android risk
Environment: Codex in-app browser, Expo web at `/shelf/manual`, 320 x 568 compact viewport
Feature: Shelf manual product intake
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Inspect the hand-built `CategoryPickerSheet` modal in `apps/mobile/src/app/shelf/manual.tsx`.
2. Open `/shelf/manual` on a compact phone surface.
3. Tap the `Category` field.

## Expected Result

The category picker keeps the existing compact bottom-sheet behavior while matching the native safe-area contract used by the hardened shared sheets: the sheet reserves an outside dismiss area, adds extra bottom padding only when a real iOS or Android bottom inset exists, exposes modal-dialog semantics on web, and keeps scrollable category rows away from gesture bars and fixed footers.

## Actual Result

The picker passed a parent-owned `sheetMaxHeight` value into the local sheet and kept a fixed `pb-10` bottom padding. That preserved the compact web baseline, but it did not add native home-indicator clearance and used `Math.max(320, height - 48)`, which can preserve a 320 px sheet even when a very short viewport needs more outside dismiss reserve. The sheet body also lacked web `role="dialog"` / `aria-modal` semantics.

## Evidence

- UI snapshot: `test-results/human-e2e/2026-07-08/shelf-manual-category-picker-safe-area/01-manual-screen-compact-state.json`
- Run report: `test-results/human-e2e/2026-07-08/shelf-manual-category-picker-safe-area/report.md`
- Terminal transcript: focused Shelf route test, mobile typecheck, and Expo web run in Codex terminal
- Browser limitation: the in-app browser confirmed the collapsed `/shelf/manual` route at 320 px with zero horizontal overflow and visible 50+ px controls, but timed out on both role-locator and coordinate clicks before modal-open evidence could be captured. The final forced-click retry reset the browser control kernel.

## Frequency

- Always in source before the fix for native bottom-inset devices and very short phone heights.

## Scope

- Affected route/screen: `/shelf/manual`
- Affected account or fixture: local manual product intake
- External service involved: No
- Destructive action involved: No

## Suspected Cause

`CategoryPickerSheet` is a route-local bottom-sheet implementation rather than the shared `Sheet`, so it missed the newer native safe-area and web modal-semantics contract.

## Minimal Fix Recommendation

Move the height and safe-area contract into `CategoryPickerSheet`: use `useWindowDimensions()` and `useSafeAreaInsets()` locally, cap the sheet at `viewportHeight - 44`, keep the existing 40 px compact web baseline when there is no bottom inset, add `insets.bottom + 24` only for real bottom insets, and expose `role="dialog"` plus `aria-modal` on the sheet body.

## Verification Flow After Fix

1. Start Expo web and open `/shelf/manual` at 320 x 568.
2. Verify the compact route shows the collapsed `Category` field, zero horizontal overflow, and visible 44+ px controls.
3. Fill product name and brand, then open the category picker.
4. Verify one named modal dialog, named dismiss/close targets, 48+ px category rows, zero horizontal overflow, and reachable lower options.
5. Select `Something else`, confirm the collapsed field reads `Other`, and continue to `/shelf/opened`.

## Post-Fix Evidence

- UI snapshot: `test-results/human-e2e/2026-07-08/shelf-manual-category-picker-safe-area/01-manual-screen-compact-state.json`
- Focused regression: `npm --workspace apps/mobile run test -- shelfRoutes.test.ts`
- Typecheck: `npm --workspace apps/mobile run typecheck`

## Remaining Risk

- Modal-open browser evidence is incomplete because the in-app Browser plugin could observe the route but failed to dispatch input for this Expo web surface.
- Native iOS/Android home-indicator, very short physical screens, Dynamic Type, VoiceOver, and TalkBack traversal still require device QA.
