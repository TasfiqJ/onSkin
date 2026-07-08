# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Verify ultra-short Smart Shelf intake fallbacks
- App surface: Expo web in Codex in-app browser
- Build/start command: `EXPO_PUBLIC_E2E_SHELF_OCR_CAPTURE_FAILURE=once EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro npm --workspace apps/mobile run web -- --port 8260`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 440 and 320 x 430 viewports
- Feature tested: `/shelf/manual`, `/shelf/ocr`, `/shelf/no-match`
- Overall verdict: Pass with native-device follow-up

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Shelf manual add | 320 x 440 direct entry | Pass | `manual-flow-audit.json`, `01`-`06` screenshots | Product/brand/category/ingredients and Continue fit without clipped or blocked controls; route continued to `/shelf/opened`. |
| Manual category sheet | 320 x 440 lower option scroll | Pass after fix | `manual-picker-active-audit-after-padding.json`, `10`-`12` screenshots | Added ultra-short sheet bottom padding; `Something else` is fully visible and hit-test clean after scroll. |
| Shelf OCR | 320 x 440 capture failure/manual text | Pass | `ocr-flow-audit.json`, `13`-`16` screenshots | Inline failure, editable INCI text, parser feedback, and `Looks right. Continue` work; ingredients carry into `/shelf/manual`. |
| Shelf no-match | 320 x 430 fallback recovery | Pass | `no-match-current-labeled-320x430.json`, `19` screenshot | Search, OCR, and manual rows are 48 px, visible, and hit-test clean; rows now expose explicit accessibility labels. |
| No-match manual fallback | 320 x 430 tap-through | Pass | `no-match-labeled-add-by-hand-result-320x430.json`, `20` screenshot | Labeled `Add it by hand. Always works, even offline` routes to `/shelf/manual`. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| `shelf-ultrashort-picker-bottom-padding` | Medium | Scroll manual category sheet at 320 x 440 to `Something else` | Last category row fully visible before tap | Row was tappable but only partially visible | `manual-picker-active-audit.json`, `08-picker-after-scroll-320x440.png` |

## Tests Added or Updated

- `apps/mobile/src/features/shelf/shelfRoutes.test.ts`
- Covers ultra-short manual picker padding, manual footer density, OCR compact layout, no-match ultra-compact density, and no-match accessibility labels.

## Commands Run

```bash
npm --workspace apps/mobile run web -- --port 8260
```

## Remaining Risk

- Native iOS/Android safe-area, Dynamic Type, screen-reader traversal, barcode camera, and real OCR/camera permission behavior remain Phase 5 device QA items.
- The broad 320 x 430 route sweep has separate non-Shelf compact-height failures in other app areas; those remain for later slices.
