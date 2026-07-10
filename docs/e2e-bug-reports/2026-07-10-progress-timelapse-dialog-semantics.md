# E2E Bug Report: Progress time-lapse lacked explicit dialog semantics

Severity: Medium
Surface: Expo web
Environment: Bundled Chromium at 390 x 844, normal and reduced-motion contexts
Feature: Photo Progress local time-lapse
Date: 2026-07-10
Tester: Codex

## Reproduction Steps

1. Start Expo web with Pro, populated-photo, and app-lock-disabled E2E fixtures.
2. Open `/progress`, select Timeline, and open the local time-lapse.
3. Inspect the visible accessibility roles while the player covers the route.

## Expected Result

The full-screen player exposes one named modal dialog boundary while retaining
native modal accessibility behavior.

## Actual Result

The player was visually modal, but the opening normal-motion web snapshot
exposed zero `dialog` roles until React Native web completed the fade. Reduced
motion exposed the framework dialog immediately. Adding a second dialog to the
content would create nested duplicate modal boundaries after the fade.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-10/progress-timelapse-current/02-player-start-390x844.png`
- UI snapshot: `test-results/human-e2e/2026-07-10/progress-timelapse-current/02-player-start-390x844.json`
- Terminal transcript: initial E2E summary recorded `verdict: fail` before the semantic fix

## Frequency

- Always in the normal-motion pre-fix web snapshot

## Scope

- Affected route/screen: `/progress` Timeline time-lapse
- Affected account or fixture: local Pro and populated-photo fixture
- External service involved: None
- Destructive action involved: None

## Suspected Cause

The framework-owned web dialog was attached after the fade transition, leaving
a transient semantic gap at open. The content already used
`accessibilityViewIsModal`, and the outer `Modal` already had its accessible
name.

## Minimal Fix Recommendation

Use a non-animated full-screen `Modal` so its single named dialog boundary is
available immediately. Keep `accessibilityViewIsModal` on the content and do
not add a nested web dialog.

## Verification Flow After Fix

1. Repeat normal playback from Timeline and require exactly one named dialog.
2. Pause, step to completion, replay, and close back to Timeline.
3. Repeat with reduced motion and require manual-only frame controls.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-10/progress-timelapse-current/02-player-start-390x844.png`
- Reduced-motion screenshot: `test-results/human-e2e/2026-07-10/progress-timelapse-current/06-reduced-motion-manual-390x844.png`
- UI snapshots: adjacent JSON files in the same evidence folder
- Logs: `browser-problem-logs.json` and `browser-disallowed-logs.json`

## Remaining Risk

- VoiceOver and TalkBack traversal still require native-device verification.
