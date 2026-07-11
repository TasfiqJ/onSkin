# E2E Bug Report: Compact Shelf scan action covers product content

Severity: High
Surface: Expo web
Environment: RoutineKind local Expo web, 360 x 640, `EXPO_PUBLIC_E2E_LOCAL_RESET=1`
Feature: Shelf list and barcode entry
Date: 2026-07-11
Tester: Codex

## Reproduction Steps

1. Open `/shelf` with one active product and one archived product.
2. Set the supported compact viewport to 360 x 640.

## Expected Result

The barcode action remains reachable without obscuring a product, archive action, or bottom navigation.

## Actual Result

The floating `Scan a barcode` action covered the active product card because the web viewport reported 641 CSS pixels and missed the prior height-only `< 640` compact cutoff.

## Evidence

- Screenshot: `bug-002-before-scan-overlap-360x640.png`
- UI snapshot: product card, archive action, scan action, and bottom tabs were all mounted in the first viewport.
- Geometry: 360px client width, 360px scroll width, 641px client height.

## Frequency

- Always

## Scope

- Affected route/screen: `/shelf`
- Affected account or fixture: local state with active and archived products
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The scan-action layout used only `height < 640`, while the browser's 360 x 640 emulation produced a 641px layout viewport.

## Minimal Fix Recommendation

Render the scan action inline after Shelf content on every nonempty layout so it never overlays product or archive controls.

## Verification Flow After Fix

1. Reload `/shelf` at 360 x 640.
2. Confirm the scan action is absent from the visible product-card region.
3. Scroll and confirm the inline scan action remains reachable.
4. Confirm horizontal scroll width still equals client width.

## Post-Fix Evidence

- Before: `bug-002-before-scan-overlap-360x640.png`
- Fixed top state: `11-shelf-replacement-360x640.png`
- Fixed scrolled state: `11-shelf-inline-scan-360x640.png`
- Geometry: `geometry-360x640.json`
- Scan action top after scroll: 348.74px; bottom tabs begin at 560.80px
- Horizontal overflow: 0px

## Remaining Risk

- Native safe-area geometry still requires supported iOS/Android device QA.
