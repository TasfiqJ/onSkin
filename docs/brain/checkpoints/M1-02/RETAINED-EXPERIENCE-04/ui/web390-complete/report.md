# Human-Simulated E2E Run Report

## Summary

- Date: 2026-10-24
- Codex task: First-session onboarding 390 x 844 run
- App surface: Headless Chrome Expo web
- Build/start command: `EXPO_NO_DOTENV=1 EXPO_PUBLIC_APP_ENV=development EXPO_PUBLIC_E2E_FIRST_SESSION_AUTH=anonymous_owner EXPO_PUBLIC_E2E_LOCAL_RESET=1 npm --workspace apps/mobile run web -- --port 8369 --host localhost`
- Browser/device/simulator/OS: Headless Chrome or Edge, 390 x 844
- Feature or PR tested: First-run onboarding activation path
- Overall verdict: Pass

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| First-run onboarding | Happy path plus age re-verification downgrade / launch-floor phone viewport | pass | `docs/brain/checkpoints/M1-02/RETAINED-EXPERIENCE-04/ui/web390-complete` | Completed onboarding through the truthful free-plan path to Today without granting Pro, then proved an under-threshold re-verification immediately closed protected providers and remained closed across direct Today navigation and reload. |

## Bugs Found

None in this pass.

## Commands Run

```bash
npm run e2e:onboarding-first-session
```

## Remaining Risk

- Expo web verifies the supported phone geometry and flow logic; it does not replace native iPhone evidence.
- Native iOS/Android onboarding still needs simulator or physical-device QA for OS prompts and platform text settings.
