# E2E Bug Report: Shelf Manual Category Picker Safe Area

Severity: Medium
Surface: Expo web source-verified; iOS / Android risk
Environment: Codex in-app browser, Expo web at `/shelf/manual`, 320 x 568 and 320 x 480 compact viewports
Feature: Shelf manual product intake
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Inspect the hand-built `CategoryPickerSheet` modal in `apps/mobile/src/app/shelf/manual.tsx`.
2. Open `/shelf/manual` on a compact phone surface.
3. Tap the `Category` field.

## Expected Result

The category picker keeps the existing compact bottom-sheet behavior while matching the native safe-area contract used by the hardened shared sheets: the sheet reserves an outside dismiss area, adds extra bottom padding only when a real iOS or Android bottom inset exists, exposes a stable named modal dialog on web, keeps scrollable category rows away from gesture bars and fixed footers, and keeps the collapsed field's accessible label aligned with the visible compact label.

## Actual Result

The picker originally passed a parent-owned `sheetMaxHeight` value into the local sheet and kept a fixed `pb-10` bottom padding. A follow-up 320 x 480 modal-open pass found the route-local sheet still needed a stricter shortest-phone reserve and accessible-name polish: the dialog's computed name fell back to concatenated sheet text, the outside dismiss strip could measure below 44 px on the actual 481 px browser viewport, and selecting the visible compact `Other` field still announced `Category, Something else`.

## Evidence

- UI snapshot: `test-results/human-e2e/2026-07-08/shelf-manual-category-picker-safe-area/01-manual-screen-compact-state.json`
- Run report: `test-results/human-e2e/2026-07-08/shelf-manual-category-picker-safe-area/report.md`
- Terminal transcript: focused Shelf route test, mobile typecheck, and Expo web run in Codex terminal
- Follow-up evidence: `test-results/human-e2e/2026-07-08/shelf-manual-category-picker-current-320x480/` captured the modal-open accessible-name and shortest-phone reserve issues before the follow-up fix.

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

Move the height and safe-area contract into `CategoryPickerSheet`: use `useWindowDimensions()` and `useSafeAreaInsets()` locally, cap the sheet at `viewportHeight - 48`, keep the existing 40 px compact web baseline when there is no bottom inset, add `insets.bottom + 24` only for real bottom insets, expose `role="dialog"` plus `aria-modal` and a stable dialog label on the sheet body, add bottom padding to the internal category list, and use the same compact category label for the collapsed field's visible and accessible text.

## Verification Flow After Fix

1. Start Expo web and open `/shelf/manual` at 320 x 568.
2. Verify the compact route shows the collapsed `Category` field, zero horizontal overflow, and visible 44+ px controls.
3. Fill product name and brand, then open the category picker.
4. Verify one named modal dialog, named dismiss/close targets, 48+ px category rows, zero horizontal overflow, and reachable lower options.
5. Select `Something else`, confirm the collapsed field reads `Other`, and continue to `/shelf/opened`.

## Post-Fix Evidence

- Modal-open and full-flow evidence: `test-results/human-e2e/2026-07-08/shelf-manual-category-picker-320x480-postfix/`
- Summary: `test-results/human-e2e/2026-07-08/shelf-manual-category-picker-320x480-postfix/summary.json`
- Report: `test-results/human-e2e/2026-07-08/shelf-manual-category-picker-320x480-postfix/report.md`
- Current two-viewport recheck:
  `test-results/human-e2e/2026-07-08/shelf-manual-category-sheet-current/`
- Focused regression: `npm --workspace apps/mobile run test -- shelfRoutes.test.ts`

## Remaining Risk

- Native iOS/Android home-indicator, Dynamic Type, VoiceOver, and TalkBack traversal still require device QA.
