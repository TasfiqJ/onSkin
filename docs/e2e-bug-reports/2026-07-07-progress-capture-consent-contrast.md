# E2E Bug Report: Progress photo consent copy competed with preview chrome

Severity: Medium
Surface: Expo web
Environment: Expo web on localhost:8082, 320 x 568 compact phone viewport
Feature: Progress photo capture consent gate
Date: 2026-07-07
Tester: Codex human-simulated E2E

## Reproduction Steps

1. Start the mobile app on Expo web.
2. Set the browser viewport to 320 x 568.
3. Open `/progress/capture` without prior `photo_capture` consent.

## Expected Result

The first-use consent gate should clearly explain that photos stay on-device, that no faceprint or biometric template is stored, and that cloud backup is separate. The Take photos and Not now controls should remain readable and tappable.

## Actual Result

The consent copy was technically readable, but the translucent overlay let the capture guide/preview chrome show through the disclosure area. On a short phone this made the privacy explanation feel cramped and less premium than the rest of the app.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/direct-entry-compact-sweep/progress-capture-320.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/direct-entry-compact-sweep/progress-capture-320.json`

## Frequency

- Always on the tested 320 x 568 viewport before the fix.

## Scope

- Affected route/screen: `/progress/capture`
- Affected account or fixture: local Expo web state with no photo capture consent
- External service involved: none
- Destructive action involved: no

## Suspected Cause

The first-use consent gate used a semi-transparent night overlay and lower-contrast disclosure text, so the underlying capture guide remained visible behind dense legal/privacy copy.

## Minimal Fix Recommendation

Use an opaque night overlay for the first-use consent gate and raise disclosure text contrast while preserving the existing dark capture visual system and button geometry.

## Verification Flow After Fix

1. Reopen `/progress/capture` at 320 x 568.
2. Confirm the consent gate uses the opaque night background.
3. Confirm Take photos and Not now remain fully visible and at least 44 pt tall.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/direct-entry-compact-sweep/progress-capture-320-after.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/direct-entry-compact-sweep/progress-capture-320-after.json`

## Remaining Risk

- Untested branches: native camera permission prompt and real camera feed on iOS/Android.
- Missing fixtures: no native device camera fixture in this run.
- Follow-up needed: verify the same first-use consent gate on Android emulator/device and iOS Simulator/device when available.
