# E2E Bug Report: Shelf manual category picker needs sheet treatment

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
4. Scroll the picker area toward the lower category options.
5. Try to select the lower `Something else` option through normal user input.

## Expected Result

The category picker behaves like a premium mobile control on compact phones:
rows remain large, lower options are reachable through a normal scroll, visible
row centers are tappable, and the fixed Continue footer never competes with the
picker.

## Actual Result

The previous inline picker remained inside the page scroller. On a 320 x 568
viewport, the lower visible category rows had ambiguous hit targets because the
fixed Continue footer and outer scroll content competed with the picker. The
`Something else` option could be forced with a DOM click, but it was not reliable
as a real user interaction.

## Evidence

- Pre-fix screenshots and snapshots:
  - `test-results/human-e2e/2026-07-07/shelf-manual-category-picker-current/03-picker-open-top.png`
  - `test-results/human-e2e/2026-07-07/shelf-manual-category-picker-current/04-picker-scrolled-bottom.png`
  - `test-results/human-e2e/2026-07-07/shelf-manual-category-picker-current/04-picker-scrolled-bottom.json`
- Post-fix screenshots and snapshots:
  - `test-results/human-e2e/2026-07-07/shelf-manual-category-picker-current/07-fixed-picker-open-top.png`
  - `test-results/human-e2e/2026-07-07/shelf-manual-category-picker-current/08-fixed-picker-scrolled-bottom.png`
  - `test-results/human-e2e/2026-07-07/shelf-manual-category-picker-current/08-fixed-picker-scrolled-bottom.json`
  - `test-results/human-e2e/2026-07-07/shelf-manual-category-picker-current/09-fixed-selected-other.png`
  - `test-results/human-e2e/2026-07-07/shelf-manual-category-picker-current/09-fixed-selected-other.json`
  - `test-results/human-e2e/2026-07-07/shelf-manual-category-picker-current/10-fixed-opened-route.png`
  - `test-results/human-e2e/2026-07-07/shelf-manual-category-picker-current/10-fixed-opened-route.json`
  - `test-results/human-e2e/2026-07-07/shelf-manual-category-picker-current/11-final-overflow-hidden-sheet-geometry.json`

## Frequency

- Reproduced on compact phone web viewport when opening the manual category picker
  before selecting a lower category.

## Scope

- Affected route/screen: `/shelf/manual`
- Affected account or fixture: Any user adding a product by hand on a compact
  phone
- External service involved: None
- Destructive action involved: No

## Suspected Cause

The category choices were rendered as an inline nested list inside the same
scroll surface as the form while the Continue footer remained visually fixed at
the bottom of the screen.

## Fix

Move the manual category choices into a transparent modal bottom sheet with a
dim backdrop, a visible Close action, a height-aware max sheet height, and 52 px
category rows. Keep the main form footer outside the picker sheet.

## Verification Flow After Fix

1. Open `/shelf/manual` at 320 x 568.
2. Enter `Barrier Balm` and `RoutineKind Test`.
3. Open the category picker.
4. Scroll the sheet to `Something else`.
5. Confirm the `Something else` row is visible and center-tappable.
6. Select it and confirm the collapsed category field reads `Other`.
7. Tap Continue and confirm `/shelf/opened` opens.

## Post-Fix Result

The post-fix run verifies `Something else` owns its center hit target after a
normal sheet scroll, the collapsed field updates to `Other`, Continue remains a
56 px target, horizontal overflow is zero, and the route advances to the
opened-date sheet.

## Tests

- `npm --workspace apps/mobile run test -- shelfRoutes`
- `npm --workspace apps/mobile run typecheck`

## Remaining Risk

- Native iOS/Android gesture feel, keyboard interaction, and platform Dynamic
  Type still need device QA.
