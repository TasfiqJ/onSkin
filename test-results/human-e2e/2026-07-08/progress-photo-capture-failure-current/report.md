# Progress Photo Capture Failure Recovery E2E

Date: 2026-07-08
Surface: Expo web through Codex in-app browser
Viewport: 320 x 568
Route: `/progress/capture`
Fixture: `EXPO_PUBLIC_E2E_PROGRESS_CAPTURE_FAILURE=once`, `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`

## Coverage

- Opened Progress capture directly with photo capture consent already present on the local test origin.
- Verified the capture surface exposes one enabled `Capture photo` control.
- Forced one still-photo capture rejection.
- Verified no JavaScript/native-style dialog opened.
- Verified route-owned `Photo wasn't captured` recovery copy with an alert region.
- Verified foreground `Try photo again` and `Not now` controls remain visible at 320 x 568, with 56 px and 48 px targets.
- Verified the underlying capture button is disabled while failure recovery is foregrounded.
- Tapped `Try photo again` and verified the fixture was consumed, revealing the normal web camera-permission gate.
- Verified the wrapped camera-permission heading renders with readable line height after the compact typography fix.
- Tapped `Not now` and verified navigation back to `/progress`.
- Verified the raw fixture error string is not visible and current-origin browser logs are empty.

## Evidence Files

- `01-initial.state.json`
- `01-initial-viewport.png`
- `02-after-consent-capture-ready.state.json`
- `02-after-consent-capture-ready-viewport.png`
- `03-dialog-after-capture.json`
- `03-inline-capture-failure.state.json`
- `03-inline-capture-failure-viewport.png`
- `03-layout-audit.json`
- `04-after-retry-permission-gate.state.json`
- `04-after-retry-permission-gate-viewport.png`
- `04-permission-heading-audit.json`
- `05-returned-progress.state.json`
- `05-returned-progress-viewport.png`
- `browser-logs-current-origin.json`

## Result

Passed after the route-owned capture-failure overlay and compact permission-heading line-height fix.

## Remaining Risk

This web fixture proves the route fallback and compact layout. It does not replace physical iOS/Android camera mount failure, real `takePictureAsync` rejection, camera permission denial, encrypted image persistence, or native safe-area QA.
