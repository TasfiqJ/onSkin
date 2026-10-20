# Human-Simulated E2E Run Report

## Summary

- Date: 2026-10-20
- Codex task: Account sign-out isolation and cleanup recovery run
- App surface: Headless Chrome Expo web
- Build/start command: `EXPO_NO_DOTENV=1 EXPO_PUBLIC_APP_ENV=development EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION=signout_clear_retry EXPO_PUBLIC_E2E_LOCAL_RESET=1 npm --workspace apps/mobile run web -- --port 8442 --host localhost`
- Browser/device/simulator/OS: Headless Chrome or Edge, 430 x 932
- Feature or PR tested: Account-boundary private-data isolation
- Overall verdict: Pass

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| First-run onboarding | Cleanup failure, retry, and signed-out direct routes | pass | `docs/brain/checkpoints/M1-01/CONT-02/evidence/sealed-recovery430` | Completed onboarding on the free plan, failed two account cleanups behind usable recovery, retried successfully, signed out, and proved direct Shelf and Today routes could not expose account A data. |

## Bugs Found

None in this pass.

## Commands Run

```bash
npm run e2e:onboarding-account-isolation
```

## Remaining Risk

- The development-only fixture proves local cache/storage isolation and recovery; live Supabase A-to-B switching remains staging QA.
- Native iOS/Android onboarding still needs simulator or physical-device QA for OS prompts and platform text settings.
