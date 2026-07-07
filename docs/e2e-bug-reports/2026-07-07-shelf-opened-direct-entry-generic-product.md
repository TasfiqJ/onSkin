# E2E Bug Report: Shelf opened-date direct entry can save generic product

Severity: High
Surface: Expo web
Environment: Expo web at `http://localhost:8100`, browser viewport target 320 x 568
Feature: Shelf intake direct-entry recovery
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/shelf/opened` directly without first entering product details.
2. Leave the default opened-date selection as `Just opened it`.
3. Tap `Add to shelf`.

## Expected Result

The route should recover to manual product entry, or show a clear recovery action, because there is no product draft to save.

## Actual Result

The save path allowed an empty intake draft and would write a generic shelf row named `Product`.

## Evidence

- Source inspection: `apps/mobile/src/app/shelf/opened.tsx` previously used `name: draft.name || 'Product'`.
- Post-fix recovery screenshot: `test-results/human-e2e/2026-07-07/shelf-opened-direct-entry-guard/opened-direct-entry-recovery-320x568.png`
- Post-fix recovery UI state: `test-results/human-e2e/2026-07-07/shelf-opened-direct-entry-guard/opened-direct-entry-recovery-320x568-state.json`
- Post-fix manual-entry screenshot: `test-results/human-e2e/2026-07-07/shelf-opened-direct-entry-guard/after-add-by-hand-manual-320x568.png`
- Post-fix manual-entry UI state: `test-results/human-e2e/2026-07-07/shelf-opened-direct-entry-guard/after-add-by-hand-manual-320x568-state.json`

## Frequency

- Always from direct `/shelf/opened` entry with an empty in-memory intake draft.

## Scope

- Affected route/screen: `/shelf/opened`
- Affected account or fixture: Any user/session with no active intake draft.
- External service involved: None.
- Destructive action involved: Yes, it could create a bad local shelf row.

## Suspected Cause

The opened-date route assumed it was only reachable after scan/search/OCR/manual intake and used a generic fallback name when the draft was empty.

## Minimal Fix Recommendation

Guard the route when no draft product exists, show a clear manual-add recovery action, and refuse blank product names in the save handler.

## Verification Flow After Fix

1. Open `/shelf/opened` directly.
2. Confirm the recovery sheet is visible with `Add by hand` and `Close`.
3. Tap `Add by hand`.
4. Confirm the app navigates to `/shelf/manual`.
5. Run the Shelf route contract tests.

## Post-Fix Evidence

- Human-simulated E2E: Expo web at `http://localhost:8098/shelf/opened`, viewport 320 x
  568 target.
- Browser proof: `test-results/human-e2e/2026-07-07/shelf-opened-direct-entry/opened-recovery-320x568.png`
  and `opened-recovery-state.json`.
- Recovery branch: `/shelf/opened` showed `Add product details first.` with one `Add by hand`
  recovery action measured at 264 x 48, one visible `Close` control measured at 48 x 48, and no
  `Add to shelf` action.
- Navigation branch: tapping `Add by hand` navigated to `/shelf/manual` with blank Product name,
  Brand, and Ingredients fields.
- Close fallback branch: reopening `/shelf/opened` and tapping `Close` navigated to `/shelf`.
- Browser logs: only known local Supabase placeholder warnings and the Expo web notifications
  warning.
- Automated contract passed: `npm --workspace apps/mobile run test -- src/features/shelf/shelfRoutes.test.ts`

## Remaining Risk

- Native iOS and Android direct-entry sheet QA remains required for final device approval.
