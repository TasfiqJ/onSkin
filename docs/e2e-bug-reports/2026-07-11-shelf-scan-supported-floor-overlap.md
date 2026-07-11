# E2E Bug Report: Shelf Scan Supported-Floor Overlap

Severity: High
Surface: Expo web
Feature: Shelf list and barcode entry
Date: 2026-07-11
Status: Fixed and rerun

## Reproduction

1. Open `/shelf` with active and archived products.
2. Use the supported 360 x 640 viewport.

Expected: the barcode action remains reachable without obscuring product,
archive, or navigation controls.

Actual: the floating scan action covered the active product card.

## Cause And Fix

The overlay depended on a height-only React Native breakpoint, while the browser
reported a 641px layout viewport for 360 x 640 emulation. The nonempty Shelf now
renders the scan action in document flow after archive content on every layout.

## Post-Fix Evidence

- Before: `test-results/human-e2e/2026-07-11/shelf-freshness-provenance-current/bug-002-before-scan-overlap-360x640.png`
- Fixed top: `test-results/human-e2e/2026-07-11/shelf-freshness-provenance-current/11-shelf-replacement-360x640.png`
- Fixed scrolled: `test-results/human-e2e/2026-07-11/shelf-freshness-provenance-current/11-shelf-inline-scan-360x640.png`
- Geometry: scan bottom 400.71px after scroll; bottom tabs start at 560.80px; horizontal overflow 0px

## Remaining Risk

Native safe-area and gesture-navigation geometry still requires supported iOS and Android QA.
