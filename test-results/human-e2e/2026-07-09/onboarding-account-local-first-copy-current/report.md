# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-09
- Codex task: B-ROUTINE-PERSIST account-copy honesty pass
- App surface: Expo web through Codex in-app browser
- Build/start command: `npm --workspace apps/mobile run web -- --port 8195`
- Browser/device/simulator/OS: Codex in-app browser, 360 x 640 viewport
- Feature or PR tested: `/onboarding/account` account creation copy
- Overall verdict: Pass

## Tool Inventory

- Expo CLI: Used through `npm --workspace apps/mobile run web -- --port 8195`
- iOS Simulator: Not used for this copy-only Expo-web-compatible pass
- Android emulator: Not used for this copy-only Expo-web-compatible pass
- Expo web: Used
- Playwright: Used through the Codex in-app browser runtime
- Playwright MCP: Not used
- Codex Computer Use: Not used
- Other: Vitest focused onboarding route contract test

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Onboarding | Account creation local-first copy | Pass | `account-local-first-copy.png`, `account-local-first-copy.json`, `browser-warn-error-logs.json` | Verified `local-first on this device` is visible, the old cross-device routine/progress claim is absent, the route stays at `/onboarding/account`, the `Not now` button is 312 x 48, and horizontal overflow is 0 px. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| None | n/a | n/a | n/a | n/a | n/a |

## Tests Added or Updated

- Test file: `apps/mobile/src/features/onboarding/onboardingRoutes.test.ts`
- What it covers: Prevents the account screen from reintroducing the unsupported `routine and progress are yours on any device` claim and requires local-first routine copy.
- Why this should be automated: B-ROUTINE-PERSIST leaves routine checks local-first for beta, so account copy must stay honest until server-backed routine sync is implemented and tested.

## Commands Run

```bash
git fetch origin
git status --short --branch --ahead-behind
npm --workspace apps/mobile run test -- src/features/onboarding/onboardingRoutes.test.ts
npm --workspace apps/mobile run web -- --port 8195
```

## Remaining Risk

- Native iOS and Android safe-area, Dynamic Type, and screen-reader evidence are still separate device QA gates.
- Supabase auth remains unavailable in this local run, so the route intentionally shows the account-unavailable state.
- Browser DOM snapshot failed on this Expo page with the current in-app browser runtime; evidence uses screenshot plus bounded visible-text/geometry JSON instead.
