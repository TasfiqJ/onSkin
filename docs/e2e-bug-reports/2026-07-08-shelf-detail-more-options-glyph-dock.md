# E2E Bug Report: Shelf detail More options and lifecycle dock polish

Severity: Medium
Surface: Expo web
Environment: Codex in-app browser, Expo web dev server on localhost, 320 x 568 viewport
Feature: Shelf product detail
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Add a product through Shelf manual intake.
2. Open the product detail from `/shelf`.
3. Inspect the top-right More options control and the freshness controls near the bottom lifecycle row.
4. Tap More options.

## Expected Result

More options should read as an intentional icon while keeping the accessible name `More options`. Visible lifecycle/freshness controls should not sit under the bottom action row, and the manage sheet should open as a named route-owned dialog with 48 px+ controls.

## Actual Result

The source rendered the More options affordance as literal `...`, which looked like placeholder text. The first detail pass also found `Set printed best-before date` positioned across the bottom lifecycle row hit zone on a 320 px phone viewport.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/shelf-detail-more-options-glyph-current/06-product-detail-more-options.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/shelf-detail-more-options-glyph-current/06-product-detail-more-options.json`

## Frequency

- Always on the tested 320 x 568 Expo web surface before the fix.

## Scope

- Affected route/screen: `/shelf/[id]`
- Affected account or fixture: Local Expo web shelf fixture
- External service involved: None
- Destructive action involved: None

## Suspected Cause

The header control used text presentation instead of a glyph component. The detail route also let the scroll content reach the same boundary as the fixed lifecycle row without the route-local flex/min-height scroll contract used elsewhere in the app.

## Minimal Fix Recommendation

Replace the literal ellipsis text with an accessibility-hidden dot glyph inside the existing 48 px Pressable. Wrap product-detail scroll content in a shrinkable `flex-1 overflow-hidden` container, keep the `ScrollView` `flex-1`, and add bottom content padding.

## Verification Flow After Fix

1. Re-open the product detail at 320 x 568.
2. Confirm More options is a 48 x 48 accessible target and raw `...` is not visible.
3. Scroll the detail content and confirm `Set printed best-before date` becomes fully reachable.
4. Tap More options and confirm the `Remove from shelf?` sheet opens with 48 px+ controls and no JavaScript dialog.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/shelf-detail-more-options-glyph-current/09-product-detail-clipped-visibility-initial.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/shelf-detail-more-options-glyph-current/09-product-detail-clipped-visibility-initial.json`
- Screenshot: `test-results/human-e2e/2026-07-08/shelf-detail-more-options-glyph-current/10-product-detail-scrolled-best-before.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/shelf-detail-more-options-glyph-current/10-product-detail-scrolled-best-before.json`
- Screenshot: `test-results/human-e2e/2026-07-08/shelf-detail-more-options-glyph-current/11-more-options-manage-sheet.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/shelf-detail-more-options-glyph-current/11-more-options-manage-sheet.json`

## Remaining Risk

- Native iOS/Android safe-area, Dynamic Type, and screen-reader traversal remain covered by the native QA gate.
