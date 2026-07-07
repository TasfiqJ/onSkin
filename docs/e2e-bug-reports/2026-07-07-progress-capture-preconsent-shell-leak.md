# E2E Bug Report: Progress capture chrome rendered before photo consent

Severity: High
Surface: Expo web
Environment: Expo web on localhost, 320 x 568 viewport
Feature: Photo Progress capture consent
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Unlock the local no-card Pro preview path so `/progress/capture` is reachable.
2. Clear local `photo_capture` consent for the browser session.
3. Open `/progress/capture` at a 320 x 568 phone viewport.
4. Inspect the visible consent gate and the page text exposed in the DOM.

## Expected Result

Before `photo_capture` consent is saved, the app should render only the consent gate or loading gate. Capture-frame labels, shutter copy, camera-preview chrome, and camera activation should remain unavailable until the consent flag is true.

## Actual Result

The route rendered the full capture shell first, then overlaid the consent gate. The visible screen looked like the consent gate, but DOM/a11y text still included `Front · weekly`, ghost alignment copy, lighting state, shutter copy, and on-device capture microcopy before consent.

## Evidence

- Pre-fix screenshot: `test-results/human-e2e/2026-07-07/progress-capture-preconsent-shell-leak/pre-fix-consent-gate-after-pro-320x568.png`
- Pre-fix UI snapshot: `test-results/human-e2e/2026-07-07/progress-capture-preconsent-shell-leak/pre-fix-consent-gate-after-pro-state.json`
- Post-fix screenshot: `test-results/human-e2e/2026-07-07/progress-capture-preconsent-shell-leak/post-fix-consent-gate-320x568.png`
- Post-fix UI snapshot: `test-results/human-e2e/2026-07-07/progress-capture-preconsent-shell-leak/post-fix-consent-gate-state.json`
- Logs: `test-results/human-e2e/2026-07-07/progress-capture-preconsent-shell-leak/post-fix-browser-warn-error-logs.json`

## Frequency

- Always when the route is reached without saved photo consent.

## Scope

- Affected route/screen: `/progress/capture`
- Affected account or fixture: Any Pro-entitled or no-card preview user without saved `photo_capture` consent
- External service involved: None for Expo web verification
- Destructive action involved: No

## Suspected Cause

`CaptureScreenContent` always rendered the capture header, ghost frame, lighting row, and shutter shell, then conditionally placed `ConsentGate` as an absolute overlay. `canShowCamera` also did not include `consented === true`, so a previously granted camera permission could make the camera eligible before the route had proven photo consent.

## Minimal Fix Recommendation

Return the consent/loading gate before rendering the capture shell whenever `consented !== true`, and include `consented === true` in `canShowCamera`.

## Verification Flow After Fix

1. Open `/progress/capture` without saved photo consent at 320 x 568.
2. Confirm the consent copy includes on-device, no-faceprint, cloud-backup-separate, and lost-phone tradeoff language.
3. Confirm only `Take photos. On device only` and `Not now` buttons are exposed.
4. Confirm the visible text does not include capture-shell strings such as `Front · weekly`, `Lighting`, `auto ready`, or ghost alignment copy.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/progress-capture-preconsent-shell-leak/post-fix-consent-gate-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/progress-capture-preconsent-shell-leak/post-fix-consent-gate-state.json`
- Focused route contract: `npm --workspace apps/mobile run test -- progressRoutes.test.ts`

## Remaining Risk

- Untested branches: Native iOS/Android camera permission prompts after consent save.
- Missing fixtures: Durable native E2E harness for camera permission and capture failure branches.
- Follow-up needed: Verify on real devices that no native camera prompt appears before local consent persistence succeeds.
