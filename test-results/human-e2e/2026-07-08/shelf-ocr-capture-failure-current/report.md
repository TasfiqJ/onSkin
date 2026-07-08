# Shelf OCR Capture Failure Recovery E2E

Date: 2026-07-08
Surface: Expo web through Codex in-app browser
Viewport: 320 x 568
Route: `/shelf/ocr`
Fixture: `EXPO_PUBLIC_E2E_SHELF_OCR_CAPTURE_FAILURE=once`

## Coverage

- Opened Shelf OCR directly on the local Expo web route.
- Verified the starting capture state exposes one `Capture label` action.
- Forced one label photo capture failure.
- Verified no JavaScript/native-style dialog opened.
- Verified route-owned recovery copy: `Label wasn't captured` and `Use manual text for now, or try the label photo again.`
- Verified `Try label photo again` remains a visible 48 px action and does not overlap the bottom `Looks right. Continue` CTA at 320 x 568.
- Entered `Aqua, Glycerin, Niacinamide` in the labeled `Ingredient label text` field.
- Verified the manual text field does not overlap the final CTA after scroll/focus.
- Tapped `Looks right. Continue` and verified navigation to `/shelf/manual`.
- Verified the manual route carried the ingredient text into the `Ingredients` field.
- Verified current-origin browser logs are empty and the raw fixture error string is not visible to the user.

## Evidence Files

- `01-initial-capture-fixture.state.json`
- `02-dialog-after-capture.json`
- `02-inline-capture-failure.state.json`
- `02-inline-capture-failure-viewport.png`
- `02-layout-audit.json`
- `03-manual-text-entered.state.json`
- `03-manual-text-entered-viewport.png`
- `03-layout-audit.json`
- `04-manual-route-after-continue.state.json`
- `04-manual-route-after-continue-viewport.png`
- `browser-logs-current-origin.json`

## Result

Passed after the inline recovery and compact-layout fix.

## Remaining Risk

This web fixture proves the route fallback and compact layout. It does not replace native iOS/Android camera-start failure, denied-permission, or real label-capture device QA.
