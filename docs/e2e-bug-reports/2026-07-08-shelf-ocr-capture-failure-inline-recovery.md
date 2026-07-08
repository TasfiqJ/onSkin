# E2E Bug Report: Shelf OCR Capture Failure Inline Recovery

Severity: High
Surface: Expo web fixture, with native iOS/Android device follow-up required
Environment: Codex in-app browser, Expo web, 320 x 568 viewport, `EXPO_PUBLIC_E2E_SHELF_OCR_CAPTURE_FAILURE=once`
Feature: Smart Shelf OCR label intake
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with `EXPO_PUBLIC_E2E_SHELF_OCR_CAPTURE_FAILURE=once`.
2. Open `/shelf/ocr` at 320 x 568.
3. Tap `Capture label`.
4. Inspect the failure state and compact layout.
5. Enter manual ingredient text and continue.

## Expected Result

Shelf OCR capture failure should stay route-owned: no duplicate native/system alert, stable `Label wasn't captured` copy, a tappable retry action, manual ingredient text entry, and a final Continue action that does not overlap the manual review controls on a short phone.

## Actual Result

Before the fix, label capture failure returned to the camera state and relied on `Alert.alert`, leaving no durable route-owned recovery state. During the first post-fix E2E pass, the new inline alert was below the OCR info card, which put `Try label photo again` under the bottom `Looks right. Continue` CTA at 320 x 568.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/shelf-ocr-capture-failure-current/02-inline-capture-failure-viewport.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/shelf-ocr-capture-failure-current/02-inline-capture-failure.state.json`
- Layout audit: `test-results/human-e2e/2026-07-08/shelf-ocr-capture-failure-current/02-layout-audit.json`
- Logs: `test-results/human-e2e/2026-07-08/shelf-ocr-capture-failure-current/browser-logs-current-origin.json`

## Frequency

Always with the forced capture-failure fixture before the fix.

## Scope

- Affected route/screen: `/shelf/ocr`
- Affected account or fixture: local E2E capture-failure fixture
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The capture catch block used an ephemeral alert and reset to camera instead of transitioning into review/manual fallback. The first inline recovery card was inserted too low in the scroll content for a 320 x 568 viewport with a bottom CTA.

## Minimal Fix Recommendation

Keep capture and camera-mount failures in the OCR route state, remove Shelf OCR native alert calls, expose an `accessibilityRole="alert"` recovery region with retry/manual copy, and place the recovery region above the OCR info card so retry stays outside the bottom CTA zone.

## Verification Flow After Fix

1. Open `/shelf/ocr` with `EXPO_PUBLIC_E2E_SHELF_OCR_CAPTURE_FAILURE=once`.
2. Tap `Capture label`.
3. Confirm no JS dialog appears and inline recovery copy is visible.
4. Confirm `Try label photo again`, the manual text field, and `Looks right. Continue` have no overlap at 320 x 568.
5. Enter manual ingredient text and tap `Looks right. Continue`.
6. Confirm `/shelf/manual` opens with the ingredient text carried forward.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/shelf-ocr-capture-failure-current/02-inline-capture-failure-viewport.png`
- Screenshot: `test-results/human-e2e/2026-07-08/shelf-ocr-capture-failure-current/03-manual-text-entered-viewport.png`
- Screenshot: `test-results/human-e2e/2026-07-08/shelf-ocr-capture-failure-current/04-manual-route-after-continue-viewport.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/shelf-ocr-capture-failure-current/04-manual-route-after-continue.state.json`
- Layout audit: `test-results/human-e2e/2026-07-08/shelf-ocr-capture-failure-current/02-layout-audit.json`
- Logs: `test-results/human-e2e/2026-07-08/shelf-ocr-capture-failure-current/browser-logs-current-origin.json`

## Remaining Risk

- Untested branches: physical iOS/Android camera mount failure, permission-denied states, and real `takePictureAsync` rejection.
- Missing fixtures: native simulator/device camera error injection.
- Follow-up needed: run native device QA before clearing the camera/OCR launch gate.
