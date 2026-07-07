# E2E Bug Report: Shelf manual category picker overlapped by footer

Severity: Medium
Surface: Expo web
Environment: Expo web on localhost, 320 x 568 viewport
Feature: Smart Shelf manual add
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/shelf/manual` at a 320 x 568 phone viewport.
2. Enter a product name and brand.
3. Open the category picker.
4. Inspect the visible picker row geometry against the fixed Continue footer.

## Expected Result

Category rows remain at least 48 px targets, visible rows are not covered by the fixed Continue footer, and lower category options remain reachable by scrolling.

## Actual Result

The picker expanded as one long list inside the page scroll. On a 320 x 568 viewport, lower visible rows such as `Serum` overlapped the fixed Continue footer, so taps near the lower picker area could be intercepted or visually ambiguous.

## Evidence

- Pre-fix screenshot: `test-results/human-e2e/2026-07-07/shelf-manual-category-picker-footer-overlap/pre-fix-picker-overlap-320x568.png`
- Pre-fix UI snapshot: `test-results/human-e2e/2026-07-07/shelf-manual-category-picker-footer-overlap/pre-fix-picker-overlap-state.json`

## Frequency

- Always on compact phone viewports when the category picker opens before the user scrolls.

## Scope

- Affected route/screen: `/shelf/manual`
- Affected account or fixture: Any user adding a product by hand on a compact phone
- External service involved: None
- Destructive action involved: No

## Suspected Cause

The category picker rendered all category rows directly in the outer scroll content while the Continue footer remained fixed at the bottom of the screen.

## Minimal Fix Recommendation

Cap the category picker height and make the category list internally scrollable, preserving 48 px row targets and the fixed Continue footer.

## Verification Flow After Fix

1. Open `/shelf/manual` at 320 x 568.
2. Enter product and brand.
3. Open the category picker.
4. Confirm visible picker rows end above the Continue footer and lower options can be reached by scrolling the picker.
5. Select `Something else` and confirm the collapsed category field updates.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/shelf-manual-category-picker-footer-overlap/post-fix-picker-capped-320x568.png`
- Rerun screenshots:
  - `test-results/human-e2e/2026-07-07/shelf-manual-category-picker-footer-overlap/post-fix-rerun-picker-capped-320x568.png`
  - `test-results/human-e2e/2026-07-07/shelf-manual-category-picker-footer-overlap/post-fix-rerun-selected-something-else-320x568.png`
- UI snapshots:
  - `test-results/human-e2e/2026-07-07/shelf-manual-category-picker-footer-overlap/post-fix-picker-capped-state.json`
  - `test-results/human-e2e/2026-07-07/shelf-manual-category-picker-footer-overlap/post-fix-picker-select-something-else-state.json`
  - `test-results/human-e2e/2026-07-07/shelf-manual-category-picker-footer-overlap/post-fix-opened-step-state.json`
  - `test-results/human-e2e/2026-07-07/shelf-manual-category-picker-footer-overlap/post-fix-rerun-picker-capped-state.json`
  - `test-results/human-e2e/2026-07-07/shelf-manual-category-picker-footer-overlap/post-fix-rerun-selected-something-else-state.json`
- Logs: `test-results/human-e2e/2026-07-07/shelf-manual-category-picker-footer-overlap/post-fix-browser-warn-error-logs.json`
- Focused route contract: `npm --workspace apps/mobile run test -- src/features/shelf/shelfRoutes.test.ts`

## Remaining Risk

- Untested branches: Native iOS/Android nested scroll feel.
- Missing fixtures: Native gesture E2E for nested picker scrolling inside the manual-add form.
- Follow-up needed: Verify on physical devices during Phase 5 device QA.
