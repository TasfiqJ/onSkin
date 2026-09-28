# Human-Simulated E2E Run Report

## Summary

- Date: 2026-09-27
- Codex task: First-session onboarding 430 x 932 run
- App surface: Headless Chrome Expo web
- Build/start command: `EXPO_PUBLIC_E2E_COMPLETION_COMMIT_DELAY_MS=1200 EXPO_PUBLIC_E2E_LOCAL_RESET=1 npm --workspace apps/mobile run web -- --port 8297 --host localhost`
- Browser/device/simulator/OS: Headless Chrome or Edge, 430 x 932
- Feature or PR tested: First-run onboarding activation path
- Overall verdict: Pass

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| First-run onboarding | Happy path / launch-floor phone viewport | pass | `test-results/human-e2e/2026-09-27/handoff-integration/onboarding-430-final-layout` | Completed onboarding through Continue free to Today, same-rectangle double-touch AM/PM check-offs, disabled AM saving state, append-only repeat, AM reload persistence, and PM cycle completion. |

## Bugs Found

None in this pass.

## Commands Run

```bash
npm run e2e:onboarding-first-session
```

## Remaining Risk

- Expo web verifies the supported phone geometry and flow logic; it does not replace native iPhone evidence.
- Native iOS/Android onboarding still needs simulator or physical-device QA for OS prompts and platform text settings.
