# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Fix Ask short-phone prompt/composer overlap
- App surface: Expo web
- Build/start command: `npm --workspace apps/mobile run web -- --port 8182 --host localhost`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 480 viewport
- Feature or PR tested: Ask RoutineKind deterministic advisor
- Overall verdict: Pass after fix

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| `/ask` empty shelf | Shortest phone empty state | Pass after fix | `02-after-clearance.png`, `02-after-clearance.json` | Two visible prompt buttons sit above the composer, both have owned center hit-tests. |
| `/ask` first suggested prompt | Shortest phone first answer | Pass after fix | `03-after-first-prompt.png`, `03-after-first-prompt.json` | Empty-shelf answer, report control, input, and Send are hit-testable with no overlap. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| ASK-480-001 | Medium | Open `/ask` at 320 x 480 before the fix | Prompt buttons stay above the fixed composer | Lower prompt buttons were intercepted by the composer/input layer | `01-before-overlap.png`, `01-before-overlap.json` |

## Tests Added or Updated

- Test file: `apps/mobile/src/features/ask/routeContract.test.ts`
- What it covers: shortest-phone prompt ordering, hidden decorative pills, denser prompt rhythm, and denser first-answer/report spacing.
- Why this should be automated: the bug is a route layout contract and can regress without changing Ask business logic.

## Commands Run

```bash
npm --workspace apps/mobile run test -- src/features/ask/routeContract.test.ts
```

## Remaining Risk

- Native iOS/Android keyboard, Dynamic Type, and home-indicator safe-area QA remain open.
- Browser logs contain expected local placeholder Supabase and web-notification warnings only.
