# E2E Bug Report: Progress Time-Lapse Placeholder Used A Blocking Alert

Severity: Low
Surface: Expo web
Environment: Codex in-app browser, Expo web, 320 x 568 viewport, populated Progress fixture
Feature: Progress Timeline
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`, `EXPO_PUBLIC_E2E_PROGRESS_PHOTOS=populated`, and app lock disabled.
2. Open `/progress`.
3. Switch from Compare to Timeline.
4. Tap `Play`.

## Expected Result

The time-lapse affordance gives stable in-screen feedback when the flip-through is not available yet, keeps the dated timeline usable, keeps no-score/no-autoplay positioning clear, and opens no native or JavaScript dialog.

## Actual Result

Before this fix, `Play` called `Alert.alert('Quiet time-lapse', ...)`. On Expo web that can become a blocking browser dialog or an unobservable native-alert bridge; on native it creates OS chrome for a non-destructive preview placeholder instead of polished timeline-owned copy.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/progress-timelapse-inline-recovery-current/01-progress-compare-start.png`
- Screenshot: `test-results/human-e2e/2026-07-08/progress-timelapse-inline-recovery-current/02-timeline-before-play.png`
- Screenshot: `test-results/human-e2e/2026-07-08/progress-timelapse-inline-recovery-current/03-timelapse-inline-feedback.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/progress-timelapse-inline-recovery-current/summary.json`
- Logs: `test-results/human-e2e/2026-07-08/progress-timelapse-inline-recovery-current/browser-warn-error-logs.json`
- Terminal transcript: focused Progress route contract, mobile typecheck, and mobile lint passed.

## Frequency

- Always when populated Progress Timeline users tap `Play`.

## Scope

- Affected route/screen: `/progress`, Timeline mode.
- Affected account or fixture: populated local Progress fixture, Pro entitlement.
- External service involved: None.
- Destructive action involved: None.

## Suspected Cause

The time-lapse play affordance was wired as a placeholder alert while the actual flip-through frames wait for the on-device capture implementation. That left a core premium Progress surface using platform dialog chrome for a normal, non-error explanatory state.

## Minimal Fix Recommendation

Replace the native alert with persistent route-owned feedback near the Play control, keep the button retryable, and contract-test that the Progress tab no longer contains the time-lapse `Alert.alert` path.

## Verification Flow After Fix

1. Run the focused Progress route contract, typecheck, and lint.
2. Start Expo web with populated Progress photos and Pro entitlement.
3. Open `/progress`, switch to Timeline, tap `Play`, and verify inline feedback, no dialog, 44 pt+ controls, no raw/native alert title, and zero horizontal overflow.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/progress-timelapse-inline-recovery-current/03-timelapse-inline-feedback.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/progress-timelapse-inline-recovery-current/summary.json`
- Logs: `test-results/human-e2e/2026-07-08/progress-timelapse-inline-recovery-current/browser-warn-error-logs.json`
- Terminal transcript: `npm --workspace apps/mobile run test -- src/features/photos/progressRoutes.test.ts` passed 13 tests.
- Terminal transcript: `npm --workspace apps/mobile run typecheck` passed.
- Terminal transcript: `npm --workspace apps/mobile run lint` passed.

## Remaining Risk

- Native iOS/Android screen-reader announcement and Dynamic Type layout still need device QA.
- The actual animated time-lapse remains deferred until on-device capture frames are implemented.
