# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-10
- Codex task: Anonymous account-upgrade recovery run
- App surface: Headless Chrome Expo web
- Build/start command: `EXPO_PUBLIC_E2E_ACCOUNT_UPGRADE=email_same_user EXPO_PUBLIC_E2E_LOCAL_RESET=1 npm --workspace apps/mobile run web -- --port 8285 --host localhost`
- Browser/device/simulator/OS: Headless Chrome or Edge, 360 x 640
- Feature or PR tested: Identity-preserving account upgrade UI
- Overall verdict: Pass

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| First-run onboarding | Invalid email code and successful recovery | pass | `test-results/human-e2e/2026-07-10/onboarding-account-upgrade-current` | Recovered from an invalid deterministic email code, completed the account route with the valid code, then finished activation through AM and PM check-offs. |

## Bugs Found

None in this pass.

## Commands Run

```bash
npm run e2e:onboarding-account-upgrade
```

## Remaining Risk

- The development-only fixture proves route interaction and recovery, not live Supabase email delivery or identity mutation.
- Native iOS/Android onboarding still needs simulator or physical-device QA for OS prompts and platform text settings.
