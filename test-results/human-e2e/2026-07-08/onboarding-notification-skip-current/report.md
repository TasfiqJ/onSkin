# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: First-run onboarding notification soft-ask skip branch
- App surface: Expo web through Codex in-app browser
- Build/start command: `npm --workspace apps/mobile run web -- --port 8182 --host localhost`
- Browser/device/simulator/OS: In-app browser, 320 x 568 viewport
- Feature tested: `/onboarding/notifications` skip path and later notification settings state
- Overall verdict: Pass for Expo web skip branch

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| First-Run Onboarding | notification permission denied / skip setup | Pass | `01-soft-ask-skip-visible-viewport.png`, `02-after-skip-account-viewport.png`, `03-settings-routine-reminders-off-viewport-rerun.png`, `geometry-and-state.json` | Native OS denial still requires iOS/Android device QA. |

## Assertions

- `/onboarding/notifications` rendered `A gentle nudge at your routine times?` and exactly one `Not now` button.
- Tapping `Not now` routed to `/onboarding/account`.
- Reopening `/settings/notifications` in the same session rendered one `Morning routine` switch and one `Evening · tonight's step` switch.
- Both routine switches were off: `aria-checked=false`.
- Visible switch targets were 52 x 48 px.
- Horizontal overflow was `0`.
- No JavaScript dialog was open.
- Browser warn logs were limited to expected local placeholders: missing Supabase env and Expo web notification listener support.

## Tests

- `npm --workspace apps/mobile run test -- src/features/notifications/onboarding.test.ts`

## Commands Run

```bash
npm --workspace apps/mobile run test -- src/features/notifications/onboarding.test.ts
npm --workspace apps/mobile run web -- --port 8182 --host localhost
```

## Remaining Risk

- Native iOS/Android OS notification prompt denial is not covered by Expo web.
- Real scheduled-notification delivery/cancel behavior remains native device QA.
- Browser storage was not directly exposed by the in-app browser runtime; the app-surface proof is same-session notification settings state plus the focused source contract.
