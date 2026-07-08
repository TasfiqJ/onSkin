# E2E Bug Report: Progress Photo Capture Failure Inline Recovery

Severity: High
Surface: Expo web fixture, with native iOS/Android device follow-up required
Environment: Codex in-app browser, Expo web, 320 x 568 viewport, `EXPO_PUBLIC_E2E_PROGRESS_CAPTURE_FAILURE=once`, `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`
Feature: Guided Progress photo capture
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with `EXPO_PUBLIC_E2E_PROGRESS_CAPTURE_FAILURE=once` and Pro entitlement.
2. Open `/progress/capture` with photo capture consent already present, or save the local-only consent first.
3. Tap `Capture photo`.
4. Inspect the failure state, retry path, and compact permission gate.

## Expected Result

Still-photo capture failure should stay route-owned: no duplicate native/system alert, stable `Photo wasn't captured` copy, a tappable retry action, a visible `Not now` exit, unchanged timeline state, no raw fixture error, and no inert foreground shutter. Compact permission recovery headings should not overlap when they wrap.

## Actual Result

Before the fix, `takePictureAsync` rejection called `Alert.alert` and returned to the camera surface, leaving the recovery state ephemeral and platform-dependent. During the post-fix E2E pass, the wrapped web permission-heading line height overlapped on a 320 x 568 viewport after retry consumed the fixture.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/progress-photo-capture-failure-current/03-inline-capture-failure-viewport.png`
- Screenshot: `test-results/human-e2e/2026-07-08/progress-photo-capture-failure-current/04-after-retry-permission-gate-viewport.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/progress-photo-capture-failure-current/03-inline-capture-failure.state.json`
- Layout audit: `test-results/human-e2e/2026-07-08/progress-photo-capture-failure-current/03-layout-audit.json`
- Logs: `test-results/human-e2e/2026-07-08/progress-photo-capture-failure-current/browser-logs-current-origin.json`

## Frequency

Always with the forced still-capture failure fixture before the fix.

## Scope

- Affected route/screen: `/progress/capture`
- Affected account or fixture: local E2E capture-failure fixture
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The capture catch block used a platform alert instead of a durable route-owned failure state. The permission and failure overlay headings did not set explicit line height for wrapped serif text on compact web viewports.

## Minimal Fix Recommendation

Add a dev-only one-shot still-capture failure fixture, convert capture rejection to route state, render a `Photo wasn't captured` alert overlay with retry and exit actions, disable the background shutter while failure recovery is foregrounded, and set explicit line height on Progress capture recovery headings.

## Verification Flow After Fix

1. Open `/progress/capture` with `EXPO_PUBLIC_E2E_PROGRESS_CAPTURE_FAILURE=once`.
2. Reach the capture surface after local photo consent.
3. Tap `Capture photo`.
4. Confirm no dialog opens and the inline failure overlay appears.
5. Confirm `Try photo again` and `Not now` are visible and at least 44 px tall.
6. Tap `Try photo again` and confirm the normal permission gate appears with readable heading layout.
7. Tap `Not now` and confirm `/progress` opens.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/progress-photo-capture-failure-current/03-inline-capture-failure-viewport.png`
- Screenshot: `test-results/human-e2e/2026-07-08/progress-photo-capture-failure-current/04-after-retry-permission-gate-viewport.png`
- Screenshot: `test-results/human-e2e/2026-07-08/progress-photo-capture-failure-current/05-returned-progress-viewport.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/progress-photo-capture-failure-current/05-returned-progress.state.json`
- Logs: `test-results/human-e2e/2026-07-08/progress-photo-capture-failure-current/browser-logs-current-origin.json`

## Remaining Risk

- Untested branches: physical iOS/Android camera mount failure, real native `takePictureAsync` rejection, OS permission denial, encrypted image save/restart/delete.
- Missing fixtures: native simulator/device camera error injection.
- Follow-up needed: run native device QA before clearing the Progress photo capture launch gate.
