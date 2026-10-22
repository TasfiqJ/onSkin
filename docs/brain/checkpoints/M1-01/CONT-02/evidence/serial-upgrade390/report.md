# Human-Simulated E2E Run Report

## Summary

- Date: 2026-10-20
- Codex task: Anonymous account-upgrade recovery run
- App surface: Headless Chrome Expo web
- Build/start command: `EXPO_NO_DOTENV=1 EXPO_PUBLIC_APP_ENV=development EXPO_PUBLIC_E2E_FIRST_SESSION_AUTH=anonymous_owner EXPO_PUBLIC_E2E_ACCOUNT_UPGRADE=email_same_user EXPO_PUBLIC_E2E_LOCAL_RESET=1 npm --workspace apps/mobile run web -- --port 8450 --host localhost`
- Browser/device/simulator/OS: Headless Chrome or Edge, 390 x 844
- Feature or PR tested: Identity-preserving account upgrade UI
- Overall verdict: Pass

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| First-run onboarding | Invalid email code and successful recovery | pass | `docs/brain/checkpoints/M1-01/CONT-02/evidence/serial-upgrade390` | Recovered from an invalid deterministic email code, completed the account route with the valid code, then continued honestly to Today on the free plan. |

## Bugs Found

None in this pass.

## Commands Run

```bash
npm run e2e:onboarding-account-upgrade
```

## Remaining Risk

- The development-only fixture proves route interaction and recovery, not live Supabase email delivery or identity mutation.
- Native iOS/Android onboarding still needs simulator or physical-device QA for OS prompts and platform text settings.
