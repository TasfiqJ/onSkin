# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Re-run the full 320 x 430 direct-route sweep after clearing the remaining failures.
- App surface: Expo web in Codex in-app browser
- Build/start command: `npm --workspace apps/mobile run web -- --port 8231`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 430 viewport
- Feature or PR tested: Current main direct-route compact-phone coverage
- Overall verdict: Pass

## Tool Inventory

- Expo CLI: available, served at `http://localhost:8231`
- iOS Simulator: not used
- Android emulator: not used
- Expo web: used
- Playwright: used through Codex in-app browser
- Playwright MCP: not used
- Codex Computer Use: not used
- Other: Browser geometry audit script

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| 49 direct-entry routes | 320 x 430 static geometry sweep | Pass | `summary.json`, `failures.json`, per-route `.json` and `.png` files | Zero failed routes |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| None in post-fix full sweep | - | - | - | - | `failures.json` shows `failedRouteCount: 0` |

## Tests Added or Updated

- See focused run report in `test-results/human-e2e/2026-07-08/remaining-short-phone-430-clearance/report.md`.

## Commands Run

```bash
npm --workspace apps/mobile run web -- --port 8231
```

## Remaining Risk

- Sweep uses Expo web direct-entry rendering, not native iOS/Android.
- Native camera, notification, purchase, safe-area, Dynamic Type, and screen-reader behavior remain external QA where noted in `LAUNCH_READINESS.md`.
