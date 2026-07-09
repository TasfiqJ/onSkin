# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-09
- Codex task: Settings privacy support-floor withdraw spacing
- App surface: Expo web in Codex in-app browser
- Build/start command: `npm --workspace apps/mobile run web -- --port 8255`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 480 launch support-floor viewport
- Feature tested: Direct `/settings/privacy` entry into the You tab privacy section
- Overall verdict: Pass

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Direct privacy entry | First support-floor viewport | Pass | `01-support-floor-first-viewport.png`, `01-support-floor-first-viewport.json` | Marketing and photo privacy controls stay complete; the destructive withdraw row starts below the first viewport instead of peeking under the floating tab bar. |
| Direct privacy entry | Scroll to destructive action | Pass | `02-support-floor-scrolled-withdraw.png`, `02-support-floor-scrolled-withdraw.json` | User scroll reaches a complete 232 x 72 px `Withdraw health-data consent` button with no blocked center or horizontal overflow. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| --- | -------- | ------------ | -------- | ------ | -------- |
| None after fix | - | - | - | - | - |

## Commands Run

```bash
npm --workspace apps/mobile run web -- --port 8255
# Browser-driven route check through Codex in-app browser
```

## Remaining Risk

- Native iOS/Android safe-area and Dynamic Type rendering still need physical-device QA.
