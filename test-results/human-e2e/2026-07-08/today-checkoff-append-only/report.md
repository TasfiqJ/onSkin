# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Today check-off append-only/idempotent completion verification
- App surface: Expo web in Codex in-app browser
- Build/start command: `EXPO_PUBLIC_E2E_ENTITLEMENT=pro EXPO_PUBLIC_APP_DISPLAY_NAME=RoutineKind npm --workspace apps/mobile run web -- --port 8170`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 568 viewport
- Feature tested: Today AM routine check-off repeat-tap and reload persistence
- Overall verdict: Pass

## Tool Inventory

- Expo CLI: Used
- Expo web: Used on `http://localhost:8170`
- Codex in-app browser: Used
- Playwright-style browser control: Used for visible DOM, clicks, screenshots, and log capture

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Today Routine Completion | Happy path | Pass | `01-before-checkoff.png`, `02-after-first-checkoff.png`, `03-after-repeat-tap.png`, `04-after-reload.png` | Manual shelf fixture added through UI: `Fixture` `Cream cleanser`, category `Cleanser`. |
| Today Routine Completion | Repeat completed row | Pass | `03-after-repeat-tap.json` | Row stayed `aria-checked=true`; visible counter stayed `1 of 1`. |
| Today Routine Completion | Reload persistence | Pass | `04-after-reload.json` | Row stayed `aria-checked=true`; visible counter stayed `1 of 1`. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| --- | --- | --- | --- | --- | --- |
| TODAY-APPEND-ONLY-2026-07-08 | Medium | Source/test review showed repeated `toggleCompletion` deleted an existing completion. | Repeat tap preserves the completion. | Store previously toggled it off. | `docs/e2e-bug-reports/2026-07-08-today-checkoff-repeat-tap.md` |

## Tests Added or Updated

- Test file: `apps/mobile/src/features/today/completionsStore.test.ts`
- What it covers: repeated completion preserves the row; legacy completion logs mark first activation without deleting the legacy row; focused test clock is fixed.
- Why this should be automated: check-off is the activation and retention path.

## Commands Run

```bash
npm --workspace apps/mobile run test -- src/features/today/completionsStore.test.ts
npm --workspace apps/mobile run test -- src/features/today/todayRoute.test.ts
npm --workspace apps/mobile run test -- src/features/routine/useProgress.test.ts
npm --workspace apps/mobile run test -- src/features/today
```

## Remaining Risk

- Native iOS/Android secure-storage timing and haptic behavior were not covered in this web pass.
- Offline queue/backend sync idempotency still needs native/device and Supabase-backed QA.
- Current-origin browser warning/error logs were empty; expected placeholder Supabase warnings from older localhost sessions were excluded from the current-origin summary.
