# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-09
- Codex task: Today empty routine support-floor compact layout
- App surface: Expo web in Codex in-app browser
- Build/start command: `npm --workspace apps/mobile run web -- --port 8255`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 480 launch support-floor viewport
- Feature tested: Empty routine card and Add products handoff from `/today?routine=AM`
- Overall verdict: Pass

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Empty routine | First support-floor viewport | Pass | `01-today-empty-first-viewport.png`, `01-today-empty-first-viewport.json` | Compact helper copy is hidden on the short support floor; `Add products` renders as a complete 238 x 56 px button with 196 px clearance above the tab bar. |
| Empty routine | Add products handoff | Pass | `02-add-products-manual-route.png`, `02-add-products-manual-route.json` | Tapping `Add products` routes to `/shelf/manual` with zero horizontal overflow. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| --- | -------- | ------------ | -------- | ------ | -------- |
| None | - | - | - | - | - |

## Commands Run

```bash
npm --workspace apps/mobile run web -- --port 8255
# Browser-driven route check through Codex in-app browser
```

## Remaining Risk

- Native iOS/Android safe-area and Dynamic Type rendering still need physical-device QA.
