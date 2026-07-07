# E2E Bug Report: Progress photo consent save failure could not prove fail-closed recovery

Severity: High
Surface: Expo web phone-width proxy for iOS and Android
Environment: Expo web, 320x568 viewport, local development server on port 19116, `EXPO_PUBLIC_E2E_PHOTO_CONSENT_FAILURE=once`
Feature: Progress photo capture consent gate
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Start Expo web with `EXPO_PUBLIC_E2E_PHOTO_CONSENT_FAILURE=once`.
2. Open `/progress/capture` at 320x568 without prior `photo_capture` consent.
3. Tap `Explore first. 7 days of Pro` if the local Pro preview gate appears.
4. Tap `Take photos. On device only`.

## Expected Result

The app must save photo-capture consent before opening the camera or asking for camera permission. If the consent proof cannot be saved, the camera path stays closed, a stable inline failure appears, and both retry and cancel actions remain reachable on the shortest supported phone viewport.

## Actual Result

The branch lacked a deterministic E2E fixture and persistent inline recovery proof for the local consent-save failure. During verification, the compact failure recovery also left the secondary `Not now` action at the bottom edge of the 320x568 viewport until the compact layout was tightened.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/progress-photo-consent-save-failure/03-consent-save-failure.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/progress-photo-consent-save-failure/03-consent-save-failure-audit.json`

## Frequency

- Always with the forced one-shot failure fixture before the compact layout polish.

## Scope

- Affected route/screen: `/progress/capture`
- Affected account or fixture: local Pro preview / reverse trial, no prior `photo_capture` consent, forced consent-save failure
- External service involved: No
- Destructive action involved: No

## Suspected Cause

The capture route previously moved through the consent flow without a repeatable local failure hook that proved the camera/permission path stayed closed when the consent write failed. The compact failure state also reused all first-read consent copy plus the new failure alert and both actions, which overfilled a 320x568 viewport.

## Minimal Fix Recommendation

Save a local photo-capture consent proof before requesting camera permission, keep the remote consent ledger best-effort for local-only capture, add a dev-only one-shot failure fixture, surface a persistent `role="alert"` failure message, and tighten the compact failure state so retry and cancel controls both fit.

## Verification Flow After Fix

1. Run `npm --workspace apps/mobile run test -- src/features/photos/consent.test.ts src/features/photos/applyCaptureConsent.test.ts src/features/photos/progressRoutes.test.ts`.
2. Start Expo web with `EXPO_PUBLIC_E2E_PHOTO_CONSENT_FAILURE=once`.
3. Open `/progress/capture` at 320x568, enter the local Pro preview if needed, and tap `Take photos. On device only`.
4. Confirm the inline failure appears, no camera permission copy appears, no controls are clipped or sub-44 px, and `Not now` remains visible.
5. Tap `Take photos. On device only` again and confirm the normal camera-permission gate appears.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/progress-photo-consent-save-failure-fix/02-consent-save-failure-320.png`
- Screenshot: `test-results/human-e2e/2026-07-07/progress-photo-consent-save-failure-fix/03-retry-normal-path-320.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/progress-photo-consent-save-failure-fix/02-consent-save-failure-320-audit.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/progress-photo-consent-save-failure-fix/03-retry-normal-path-320-audit.json`
- Logs: `test-results/human-e2e/2026-07-07/progress-photo-consent-save-failure-fix/browser-logs.json`
- Terminal transcript: focused photo route and consent contract tests passed with 14 tests.

## Remaining Risk

- Untested branches: native iOS and Android OS camera permission sheets, actual device camera startup, and Dynamic Type.
- Missing fixtures: no native simulator/device camera fixture was used in this Expo web pass.
- Follow-up needed: native Progress capture pass before launch acceptance.
