# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-10
- Codex task: Local Photo Progress time-lapse
- App surface: Expo web
- Build/start command: `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro EXPO_PUBLIC_E2E_PROGRESS_PHOTOS=populated EXPO_PUBLIC_E2E_APP_LOCK_ENABLED=disabled npm --workspace apps/mobile run web -- --port 8210`
- Browser/device/simulator/OS: Bundled Playwright Chromium, 390 x 844 supported-phone viewport
- Feature tested: Timeline local-photo playback, completion, close recovery, and reduced motion
- Overall verdict: Pass

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Progress Timeline | Finite local playback | pass | `02-player-start-390x844.png` through `05-close-returns-to-timeline-390x844.png` | Bitmap frames, pause stability, final-frame stop, replay, and close recovery. |
| Progress Timeline | Reduced motion | pass | `06-reduced-motion-manual-390x844.png` | No automatic advancement; previous/next remain available. |

## Bugs Found

- Medium: the opening fade briefly delayed React Native web's named modal
  dialog boundary. The player now uses one non-animated framework-owned dialog
  from its first frame, without a nested duplicate. Recorded and reverified in
  `docs/e2e-bug-reports/2026-07-10-progress-timelapse-dialog-semantics.md`.

## Tests Added Or Updated

- `apps/mobile/src/features/photos/timelapse.test.ts`: deterministic local-frame order, bounded stepping, and progress.
- `apps/mobile/src/features/photos/progressRoutes.test.ts`: route wiring, production fixture guard, accessibility, reduced-motion, foreground, and no-analytics contracts.

## Remaining Risk

- Expo web proves UI behavior and bitmap rendering, not physical iOS/Android encrypted-file decryption performance.
- VoiceOver/TalkBack adjustable actions and OS background transitions still require native device QA.
