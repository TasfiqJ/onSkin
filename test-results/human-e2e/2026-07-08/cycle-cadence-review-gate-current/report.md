# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Verify unreviewed cycle-cadence production gate for Pro users.
- App surface: Expo web, Codex in-app browser.
- Build/start command: `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE=closed npm --workspace apps/mobile run web -- --port 8149 --host localhost --clear`
- Browser/device/simulator/OS: In-app browser at 320 x 568 viewport.
- Feature or PR tested: `/cycle/week`, `/cycle/settings`, and `/cycle/why-tonight` review-gated cadence surfaces.
- Overall verdict: Pass.

## Tool Inventory

- Expo CLI: Used on localhost port 8149.
- iOS Simulator: Not used.
- Android emulator: Not used.
- Expo web: Used.
- Playwright: Used through the in-app browser.
- Codex Computer Use: Not used.
- Other: Browser screenshots, DOM state JSON, console log capture.

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Direct cycle week | Unreviewed cadence gate, active Pro fixture | Pass | `01-cycle-week-review-gate.png`, `01-cycle-week-review-gate.json` | Shows review-gate copy, stable AM row, no Settings action, no cycle night rows, no pause/recovery banner. |
| Direct cycle settings | Unreviewed cadence gate, active Pro fixture | Pass | `02-cycle-settings-review-gate.png`, `02-cycle-settings-review-gate.json` | Shows review-gate copy and hides variant/night controls. |
| Direct why-tonight | Unreviewed cadence gate, active Pro fixture | Pass | `03-cycle-why-tonight-review-gate.png`, `03-cycle-why-tonight-review-gate.json` | Shows only the review-gate explanation plus `Got it`; no cadence trace rows. |
| Sheet exit | Direct modal recovery | Pass | `04-after-why-tonight-got-it.png`, `04-after-why-tonight-got-it.json` | `Got it` returns to `/today`, so the user is not stranded on a direct modal route. |

## Bugs Found

None.

## Tests Added or Updated

- `apps/mobile/src/features/routine/reviewGate.test.ts`: covers dev-only closed-gate E2E fixture and confirms the fixture cannot open unreviewed cadence outside dev.
- `apps/mobile/src/features/scheduler/cycleWeekRoute.test.ts`: requires the review-gate fixture and closed-cadence screen wiring.

## Commands Run

```bash
npm --workspace apps/mobile run test -- src/features/routine/reviewGate.test.ts src/features/scheduler/cycleWeekRoute.test.ts src/features/scheduler/orchestrate.test.ts src/features/routine/generate.test.ts
```

Result: 4 files passed, 48 tests passed.

## Remaining Risk

- Expo web proves route/UI behavior only. It does not replace native iOS/Android bottom-sheet, safe-area, screen-reader, or beta-device QA.
- The dermatologist/cosmetic-chemist cadence review gate remains closed until external reviewer signoff exists.
- This pass used a dev-only fixture to force production-like cadence closure in Expo web; production behavior is still governed by `ROUTINE_CADENCE_REVIEWED`.
