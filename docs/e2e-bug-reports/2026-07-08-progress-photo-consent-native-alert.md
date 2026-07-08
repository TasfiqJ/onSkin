# E2E Bug Report: Progress photo consent failure kept a native alert path

Severity: High
Surface: Expo web phone-width proxy plus source audit for native behavior
Environment: Expo web at 320 x 568, `EXPO_PUBLIC_E2E_PHOTO_CONSENT_FAILURE=once`, `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`, local development server on port 8142
Feature: Progress photo capture consent gate
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with `EXPO_PUBLIC_E2E_PHOTO_CONSENT_FAILURE=once` and `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`.
2. Open `/progress/capture` on a fresh localhost origin at 320 x 568.
3. Tap `Take photos. On device only`.
4. Inspect the failure UI and the route failure handler.

## Expected Result

The consent state must fail closed, the camera and permission path must stay closed until consent is saved, the route must show persistent inline `Photo choice not saved` recovery copy, retry and `Not now` must remain reachable on a compact phone, and native platforms should not add a blocking system alert on top of the route-owned recovery.

## Actual Result

The Expo web run failed closed with the inline alert, but the route failure handler still called `Alert.alert(PHOTO_COPY.capture.consentFailedTitle, ...)`. On iOS and Android that would add a platform alert to a privacy-sensitive branch that already has durable in-route recovery, increasing the risk of duplicate or blocking recovery behavior.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/progress-photo-consent-failure-current/02-pre-fix-failure.png`
- Logs: `test-results/human-e2e/2026-07-08/progress-photo-consent-failure-current/02-pre-fix-browser-logs.json`
- UI snapshot: `test-results/human-e2e/2026-07-08/progress-photo-consent-failure-current/02-pre-fix-failure.state.json`
- Dialog check: `test-results/human-e2e/2026-07-08/progress-photo-consent-failure-current/02-pre-fix-dialog.json`

## Frequency

- Always in source when the first-use photo consent save failed.

## Scope

- Affected route/screen: `/progress/capture`
- Affected account or fixture: Pro-entitled/local preview user with no prior `photo_capture` consent and forced local consent-save failure
- External service involved: No
- Destructive action involved: No

## Suspected Cause

The route had been fixed to render persistent `accessibilityRole="alert"` feedback but retained the earlier `Alert.alert` call in the `applyPhotoCaptureConsent` failure callback. That left the route with two recovery channels for the same privacy-gate failure.

## Minimal Fix Recommendation

Remove `Alert.alert` from the photo consent persistence failure callback and keep the existing route-owned alert, fail-closed state, disabled saving state, retry CTA, and `Not now` exit. Keep the separate camera-capture failure alert unchanged.

## Verification Flow After Fix

1. Run the focused photo consent and route tests.
2. Reload `/progress/capture` at 320 x 568 with the one-shot failure fixture.
3. Tap `Take photos. On device only` and confirm no dialog, inline alert, no camera permission copy, no capture path, 52 px retry CTA, 48 px `Not now`, and zero horizontal overflow.
4. Tap `Take photos. On device only` again and confirm the one-shot failure is consumed and the normal camera-permission path opens.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/progress-photo-consent-failure-current/04-post-fix-inline-failure.png`
- Screenshot: `test-results/human-e2e/2026-07-08/progress-photo-consent-failure-current/05-post-fix-retry-permission-path.png`
- Logs: `test-results/human-e2e/2026-07-08/progress-photo-consent-failure-current/05-post-fix-browser-logs-current-origin.json`
- UI snapshot: `test-results/human-e2e/2026-07-08/progress-photo-consent-failure-current/04-post-fix-inline-failure.state.json`
- UI snapshot: `test-results/human-e2e/2026-07-08/progress-photo-consent-failure-current/05-post-fix-retry-permission-path.state.json`
- Dialog check: `test-results/human-e2e/2026-07-08/progress-photo-consent-failure-current/04-post-fix-dialog.json`
- Terminal transcript: focused photo consent and route tests passed with 25 tests.

## Remaining Risk

- Untested branches: native iOS and Android system alert behavior, OS camera permission sheets, real camera startup, and device safe-area rendering.
- Missing fixtures: no physical device or native simulator camera fixture was available in this Expo web pass.
- Follow-up needed: native Progress photo consent failure/retry QA must verify no system dialog, no camera/permission prompt before saved consent, retry into permission/capture, and persisted consent after restart.
