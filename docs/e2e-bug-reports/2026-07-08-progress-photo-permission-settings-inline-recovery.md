# E2E Bug Report: Progress Permission Settings Inline Recovery

Severity: High
Surface: Expo web
Environment: Codex in-app browser, Expo web, 320 x 568 viewport, `EXPO_PUBLIC_E2E_PROGRESS_CAMERA_PERMISSION=denied_no_retry`, `EXPO_PUBLIC_E2E_APP_SETTINGS_FAILURE=1`, `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`
Feature: Progress photo capture permission recovery
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with the permission-denied and app-settings-failure fixtures.
2. Open `/progress/capture?e2e=progress-permission-denied`.
3. Pass the first-use local photo consent gate.
4. Tap `Open settings` on the camera permission recovery gate.

## Expected Result

The route shows stable inline `Camera settings unavailable` recovery copy, keeps `Open settings` and `Not now` tappable, does not show raw fixture errors, does not open a duplicate native/browser alert, and does not expose inert capture controls behind the permission gate.

## Actual Result

Before the fix, Settings handoff failure was only handled through the shared app-settings native alert fallback, and the denied-permission gate could leave capture chrome exposed behind the overlay. That made the route less testable and risked an inert-looking permission state on compact screens.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/progress-photo-permission-denied-current/03-settings-failure-inline-viewport.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/progress-photo-permission-denied-current/03-settings-failure-inline.state.json`
- Layout audit: `test-results/human-e2e/2026-07-08/progress-photo-permission-denied-current/03-layout-audit.json`
- Logs: `test-results/human-e2e/2026-07-08/progress-photo-permission-denied-current/browser-logs-current-origin.json`

## Frequency

- Always with the dev fixtures.

## Scope

- Affected route/screen: `/progress/capture`
- Affected account or fixture: Progress photo capture with camera permission denied/no retry and Settings handoff failure.
- External service involved: None.
- Destructive action involved: No.

## Suspected Cause

The shared `openAppSettings` helper always owned the native alert fallback, and the Progress capture route rendered the capture footer before deciding whether the permission recovery gate owned the foreground state.

## Minimal Fix Recommendation

Allow `openAppSettings` callers to suppress the shared native alert and return `false`, then let `/progress/capture` render a route-owned inline alert. Gate capture chrome behind `canAttemptCapture` so permission recovery is the only active foreground UI.

## Verification Flow After Fix

1. Open `/progress/capture?e2e=progress-permission-denied`.
2. Tap `Take photos. On device only`.
3. Verify one `Open settings` action, one `Not now` action, no `Capture photo` control, and no JavaScript dialog.
4. Tap `Open settings`.
5. Verify inline `Camera settings unavailable` alert, no JavaScript dialog, no raw fixture text, no horizontal overflow, and 44 px+ visible controls.
6. Tap `Not now` and verify return to `/progress`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/progress-photo-permission-denied-current/03-settings-failure-inline-viewport.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/progress-photo-permission-denied-current/03-settings-failure-inline.state.json`
- Logs: `test-results/human-e2e/2026-07-08/progress-photo-permission-denied-current/browser-logs-current-origin.json`

## Remaining Risk

- Native iOS and Android OS permission denial, Settings handoff success/failure, and real safe-area rendering still need device QA.
