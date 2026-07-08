# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Progress Timeline time-lapse recovery
- App surface: Expo web
- Build/start command: `npm --workspace apps/mobile run web -- --port 8101`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 568 viewport
- Feature tested: Progress Timeline `Play` time-lapse affordance
- Overall verdict: Pass with native device follow-up

## Tool Inventory

- Expo CLI: Used through `npm --workspace apps/mobile run web -- --port 8101`
- Expo web: Used
- Codex in-app browser: Used
- Playwright API: Used through Browser plugin
- iOS Simulator / Android emulator: Not used in this slice

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| `/progress` populated fixture | Compare start state | Pass | `01-progress-compare-start.png`, `summary.json` | Progress loaded with populated local photos and zero horizontal overflow |
| Timeline mode | Before tapping Play | Pass | `02-timeline-before-play.png`, `summary.json` | Timeline visible, no feedback yet, Play was 82 x 48 px |
| Timeline Play | Time-lapse unavailable | Pass | `03-timelapse-inline-feedback.png`, `summary.json` | Inline copy rendered, no JS/native dialog, no raw alert title, zero overflow |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| 2026-07-08-progress-timelapse-native-alert | Low | Timeline `Play` on populated Progress route | Timeline-local feedback, no dialog | Source previously used `Alert.alert` placeholder | `docs/e2e-bug-reports/2026-07-08-progress-timelapse-native-alert.md` |

## Tests Added Or Updated

- `apps/mobile/src/features/photos/progressRoutes.test.ts`: rejects the time-lapse native alert and requires timeline-owned unavailable feedback.

## Commands Run

```bash
npm --workspace apps/mobile run test -- src/features/photos/progressRoutes.test.ts
npm --workspace apps/mobile run typecheck
npm --workspace apps/mobile run lint
npm --workspace apps/mobile run web -- --port 8101
```

## Remaining Risk

- Native iOS/Android screen-reader announcement and Dynamic Type layout were not exercised in this slice.
- Browser warn/error logs contain expected placeholder Supabase warnings and an Expo web notifications warning.
