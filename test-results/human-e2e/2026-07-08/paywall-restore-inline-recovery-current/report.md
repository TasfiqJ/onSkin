# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Paywall restore recovery should stay route-owned with no duplicate native/system dialog.
- App surface: Expo web through Codex in-app browser.
- Build/start command: `npm --workspace apps/mobile run web -- --port 8099`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 568 viewport.
- Feature tested: `/paywall/upsell?feature=full_routine` restore recovery.
- Overall verdict: Pass with native-device follow-up.

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Direct upsell paywall | Start state | Pass | `01-upsell-paywall-start.png`, `02-start-state.json` | Start free trial, Terms, Privacy, Restore, and Maybe later were visible with 48 px+ controls and zero horizontal overflow. |
| Restore purchases | Empty restore recovery | Pass | `03-after-restore.png`, `04-after-restore-state.json` | Tapping Restore rendered one inline `role="alert"` message and no JavaScript dialog. |
| Console review | Browser warnings/errors | Pass with known local warnings | `05-browser-warn-error-logs.json` | Only known Supabase placeholder and web-notification warnings appeared. |

## Commands Run

```bash
npm --workspace apps/mobile run test -- src/features/subscription/paywallMobileContracts.test.ts src/lib/navigation/externalOpen.test.ts
npm --workspace apps/mobile run typecheck
npm --workspace apps/mobile run lint
npm --workspace apps/mobile run web -- --port 8099
```

## Remaining Risk

- Native iOS/Android RevenueCat restore, purchase failure, and StoreKit/Play sheet behavior still require Phase 6 device QA.
- Live RevenueCat product/offering setup was not used.
