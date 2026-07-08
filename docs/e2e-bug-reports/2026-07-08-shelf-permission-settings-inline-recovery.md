# Shelf Permission Settings Inline Recovery

## Summary

- Date: 2026-07-08
- Severity: Important
- Area: Shelf Product Add, scan/OCR camera permission recovery
- Status: Fixed locally and verified on Expo web

## Reproduction

1. Inspect `/shelf/scan` or `/shelf/ocr` before this fix.
2. Reach a camera permission denied/no-retry state.
3. Tap `Open settings` when Settings cannot open.

## Expected

The route shows stable in-app `Camera settings unavailable` recovery, opens no duplicate native/browser alert, and keeps search/OCR/manual or manual-text fallback paths available.

## Actual

Shelf scan/OCR used the shared settings opener without a route-owned failure state, so Settings failure could fall back to a native/browser alert and the denied/no-retry state could not be exercised through Expo web.

## Fix

- Added shared Shelf camera Settings failure copy.
- Added `EXPO_PUBLIC_E2E_SHELF_CAMERA_PERMISSION=denied_no_retry` for dev-only web E2E.
- Updated `/shelf/scan` and `/shelf/ocr` to call `openAppSettings({ alertOnFailure: false })` and render inline recovery on failure.
- Kept fallback controls visible and at least 48 px tall.

## Verification

- Focused Vitest route contracts passed.
- Codex in-app browser Expo web at 320 x 568 verified `/shelf/scan` and `/shelf/ocr` with `EXPO_PUBLIC_E2E_SHELF_CAMERA_PERMISSION=denied_no_retry` and `EXPO_PUBLIC_E2E_APP_SETTINGS_FAILURE=1`.
- Evidence: `test-results/human-e2e/2026-07-08/shelf-camera-permission-denied-current/`.

## Remaining Risk

Physical iOS/Android must still verify real OS permission denial/no-retry, real Settings handoff success/failure, barcode camera, OCR camera, and screen-reader traversal.
