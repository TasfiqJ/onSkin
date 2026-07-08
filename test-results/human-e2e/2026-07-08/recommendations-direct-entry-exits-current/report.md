# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Recommendations direct-entry exits current evidence
- App surface: Expo web through Codex in-app browser
- Build/start command: `npm --workspace apps/mobile run web -- --port 8192 --host localhost`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 568 phone viewport
- Feature tested: Personalized Recommendations direct-entry route recovery
- Overall verdict: Pass

## Tool Inventory

- Expo CLI: Used through `npm --workspace apps/mobile run web -- --port 8192 --host localhost`
- iOS Simulator: Not used for this web-compatible route-recovery branch
- Android emulator: Not used for this web-compatible route-recovery branch
- Expo web: Used
- Playwright: Used through the in-app browser control API
- Codex Computer Use: Not used

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Personalized Recommendations | Direct `/recommendations` exit | Pass | `01-hub-direct-initial.png`, `02-hub-back-after-click.png`, `geometry-and-state.json` | 48 px Back returns to `/you`; Preferences is 101.47 x 48 px. |
| Personalized Recommendations | Direct `/recommendations/preferences` exit | Pass | `03-preferences-direct-initial.png`, `04-preferences-back-after-click.png`, `geometry-and-state.json` | Back returns to `/recommendations`; visible chips are 48 px tall or larger. |
| Personalized Recommendations | Stale detail direct entry | Pass | `05-stale-detail-direct-initial.png`, `06-stale-back-to-for-you-after-click.png`, `geometry-and-state.json` | `Back to For you` is 113.59 x 48 px and returns to `/recommendations`. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| None | N/A | N/A | N/A | N/A | N/A |

## Tests Added or Updated

- Test file: `apps/mobile/src/features/recommendations/recommendationRoutes.test.ts`
- What it covers: Existing route contracts guard direct-entry fallback routes and phone touch target classes.
- Result: `npm --workspace apps/mobile run test -- src/features/recommendations/recommendationRoutes.test.ts` passed with 9 tests.

## Commands Run

```bash
git status --short --branch
npm --workspace apps/mobile run test -- src/features/recommendations/recommendationRoutes.test.ts
npm --workspace apps/mobile run web -- --port 8192 --host localhost
```

## Evidence Summary

- Viewport: 320 x 568
- Routes checked: `/recommendations`, `/recommendations/preferences`, `/recommendations/stale-local-rec`
- Horizontal overflow: 0 in all measured states
- Sub-44 visible controls: 0 in all measured states
- JavaScript dialog: none
- Browser warn/error logs: expected local Supabase placeholder warnings and expected Expo web notification listener warning only

## Remaining Risk

- Native iOS/Android rendering remains a separate device QA follow-up.
- The Today SPF gap prompt branch is still documented separately and still needs current evidence.
