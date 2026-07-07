# E2E Bug Report: Progress Capture Not Now Low Contrast

Severity: Medium
Surface: Expo web phone viewport
Environment: Expo web at `http://localhost:8094`, 320x568 viewport
Feature: Progress photo capture consent
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Start Expo web with `npm --workspace apps/mobile run web -- --port 8094`.
2. Open `/progress/capture` at a 320x568 phone viewport with no saved `photo_capture` consent.
3. Inspect the first-use consent copy and the secondary `Not now` action below `Take photos. On device only`.

## Expected Result

The photo-consent screen should keep every privacy decision readable on the dark capture surface. `Not now` must be visually clear as an intentional secondary exit, not faint text over the camera/ghost overlay.

## Actual Result

`Not now` used low-opacity night text with no secondary action surface, making it barely readable at the bottom of the 320px consent screen. The privacy footnote and skin-prep line also used low-opacity copy on the same dark surface.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/current-compact-ux-sweep/progress-capture-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/current-compact-ux-sweep/progress-capture-audit.json`
- Terminal transcript: Expo web session on port `8094`

## Frequency

- Always on first-use `/progress/capture` at compact phone height with no saved photo consent.

## Scope

- Affected route/screen: `/progress/capture`
- Affected account or fixture: Local first-use photo-consent state
- External service involved: None
- Destructive action involved: No

## Suspected Cause

The dark capture gates used `rgba(244,239,231,0.6)` for secondary `Not now` actions and no background affordance. On the 320px capture-consent layout, the action sits low over the dark preview/overlay and reads as ghost text.

## Minimal Fix Recommendation

Use a shared dark-surface secondary action treatment with a subtle translucent pill and stronger night text. Raise footnote and skin-prep copy contrast enough to remain readable without overpowering the primary privacy consent.

## Verification Flow After Fix

1. Reopen `/progress/capture` at 320x568 with no saved `photo_capture` consent.
2. Confirm the consent title, privacy copy, footnote, skin-prep guidance, primary CTA, and `Not now` are readable.
3. Confirm `Not now` remains a 48px tappable secondary action, the page has no horizontal overflow, and tapping it returns to `/progress`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/progress-capture-not-now-contrast/progress-capture-after-contrast-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/progress-capture-not-now-contrast/progress-capture-after-contrast-320x568-state.json`
- Exit screenshot: `test-results/human-e2e/2026-07-07/progress-capture-not-now-contrast/progress-capture-after-not-now-320x568.png`
- Exit state: `test-results/human-e2e/2026-07-07/progress-capture-not-now-contrast/progress-capture-after-not-now-state.json`

## Remaining Risk

- Untested branches: Native iOS and Android camera/permission prompts still need simulator/device QA.
- Missing fixtures: Expo web cannot exercise native camera permission UI.
- Follow-up needed: Add durable native E2E coverage for first-use photo consent once the mobile E2E harness is selected.
