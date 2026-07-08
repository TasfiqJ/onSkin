# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Paywall/subscription recovery stays inline instead of opening native alerts.
- App surface: Codex in-app browser, Expo web.
- Build/start command: `EXPO_PUBLIC_APP_DISPLAY_NAME=RoutineKind EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro EXPO_PUBLIC_E2E_EXTERNAL_OPEN_FAILURE=all npm --workspace apps/mobile run web -- --port 8156 --localhost`
- Browser/device/simulator/OS: in-app browser at 320 x 568 viewport on Windows host.
- Feature tested: `/paywall/upsell?feature=full_routine` compliance recovery and `/settings/subscription` manage/policy/restore recovery.
- Overall verdict: Pass with scoped native-store risk.

## Tool Inventory

- Expo CLI: used through `npm --workspace apps/mobile run web`.
- iOS Simulator: not used.
- Android emulator: not used.
- Expo web: used.
- Playwright/browser control: used through Codex in-app browser.
- Other: focused Vitest subscription/external-open contract checks.

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Paywall upsell | Compliance Terms and Restore recovery | Pass | `01-upsell-before.png`, `02-upsell-compliance-inline-feedback.png`, `summary.json` | Start free trial is intentionally disabled in web preview without live RevenueCat; Terms and Restore remain reachable, open no dialog, and Restore renders one `role="alert"` message. |
| Subscription settings | Manage in App Store handoff failure | Pass | `03-subscription-before.png`, `04-subscription-manage-inline-feedback.png`, `summary.json` | Forced external handoff failure renders row-local feedback and keeps the route on `/settings/subscription`. |
| Subscription settings | Terms policy handoff failure | Pass | `05-subscription-policy-inline-feedback.png`, `summary.json` | Forced policy failure renders `Link unavailable...` inline with no JavaScript dialog. |
| Subscription settings | Restore purchases result | Pass | `06-subscription-restore-inline-feedback.png`, `summary.json` | Restore renders `No active subscription was found for this account.` inline with no JavaScript dialog. |

## Bugs Found

None in the covered Expo web branches.

## Tests Added or Updated

- `apps/mobile/src/features/subscription/paywallMobileContracts.test.ts`: verifies paywall/subscription recovery stays route-owned and avoids native `Alert.alert` for purchase/restore recovery.
- `apps/mobile/src/lib/navigation/externalOpen.test.ts`: verifies `alertOnFailure: false` suppresses native alerts for screens that own inline failure UI.

## Commands Run

```bash
npm --workspace apps/mobile run typecheck
npm --workspace apps/mobile run lint
npm --workspace apps/mobile run test -- src/features/subscription/paywallMobileContracts.test.ts src/lib/navigation/externalOpen.test.ts
npm run phase9:evidence-normalization-smoke
git diff --check
EXPO_PUBLIC_APP_DISPLAY_NAME=RoutineKind EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro EXPO_PUBLIC_E2E_EXTERNAL_OPEN_FAILURE=all npm --workspace apps/mobile run web -- --port 8156 --localhost
```

## Remaining Risk

- Native iOS/Android RevenueCat purchase-sheet failure, RevenueCat restore, and OS subscription-management sheet behavior remain device QA because Expo web disables purchase when live store configuration is unavailable.
- Supabase credentials remain local placeholders and are unrelated to this recovery branch.
