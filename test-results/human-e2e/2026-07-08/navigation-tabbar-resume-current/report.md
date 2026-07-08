# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Resume active UX bug-fixing goal and re-check the floating bottom tab bar.
- App surface: Expo web through the Codex in-app browser.
- Build/start command: `npm --workspace apps/mobile run web -- --port 8171 --host localhost`
- Browser/device/simulator/OS: In-app browser at 320 x 568 and 390 x 568 phone viewports.
- Feature tested: Wealthsimple-style floating bottom tab navigation.
- Overall verdict: Pass.

## Environment

- `EXPO_PUBLIC_E2E_APP_LOCK_ENABLED=false`
- `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`
- `EXPO_PUBLIC_E2E_TODAY_ROUTINE=pm`

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Bottom tab navigation | 320 x 568 main tab switching | Pass | `01-today-320.png`, `02-click-progress-320.png`, `02-click-shelf-320.png`, `02-click-you-320.png`, `02-click-today-320.png`, `summary-320.json` | Today, Progress, Shelf, and You each selected with one tap. Exactly one selected tab after each switch. |
| Bottom tab navigation | 390 x 568 main tab switching | Pass | `03-today-390.png`, `04-click-progress-390.png`, `04-click-shelf-390.png`, `04-click-you-390.png`, `04-click-today-390.png`, `summary-390.json` | Each tab stayed 53.99 px tall, center hit-tests resolved to the intended tab, and horizontal overflow stayed zero. |
| Bottom tab navigation | Dialog/log hygiene | Pass with expected local warnings | `browser-warn-error-logs.json` | Logs contain expected placeholder Supabase warnings and Expo notifications web-support warnings only. No JavaScript dialog opened. |

## Bugs Found

None in the rendered tab bar pass.

## Commands Run

```bash
npm --workspace apps/mobile run web -- --port 8171 --host localhost
npm --workspace apps/mobile run typecheck
npm --workspace apps/mobile run lint
npm --workspace apps/mobile run test
npm --workspace apps/mobile run test -- src/features/navigation/dialogContracts.test.ts src/features/navigation/tabBar.test.ts
```

## Remaining Risk

- Native iOS/Android keyboard show/hide behavior is source-covered but still needs simulator/device evidence because desktop Expo web does not emit native React Native keyboard events.
- Native Dynamic Type/text scale verification remains device QA.
