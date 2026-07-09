# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-09
- Codex task: First-session onboarding 320 x 430 stress run
- App surface: Headless Chrome Expo web
- Build/start command: `EXPO_PUBLIC_E2E_LOCAL_RESET=1 npm --workspace apps/mobile run web -- --port 8285 --host localhost`
- Browser/device/simulator/OS: Headless Chrome or Edge, 320 x 430
- Feature or PR tested: First-run onboarding activation path
- Overall verdict: Pass

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| First-run onboarding | Happy path / stress viewport | pass | `test-results/human-e2e/2026-07-09/onboarding-first-session-430-current` | Completed onboarding through Explore first, routine plan, Start today, AM check-off, and PM cycle check-off. |

## Bugs Found

None in this pass.

## Commands Run

```bash
npm run e2e:onboarding-first-session
```

## Remaining Risk

- 320 x 430 is resilience evidence below the accepted launch web floor.
- Native iOS/Android onboarding still needs simulator or physical-device QA for OS prompts and platform text settings.
