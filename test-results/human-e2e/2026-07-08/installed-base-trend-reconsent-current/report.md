# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Installed-base Trend reconsent gate
- App surface: Expo web in Codex in-app browser
- Build/start commands:
  - `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro EXPO_PUBLIC_PHASE7_TREND_ENABLED=true EXPO_PUBLIC_E2E_PROGRESS_PHOTOS=populated EXPO_PUBLIC_E2E_TREND_CONSENT_LEDGER=local_only npm --workspace apps/mobile run web -- --port 8151 --host localhost --clear`
  - `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro EXPO_PUBLIC_PHASE7_TREND_ENABLED=true EXPO_PUBLIC_E2E_PROGRESS_PHOTOS=populated EXPO_PUBLIC_E2E_TREND_CONSENT_LEDGER=local_only npm --workspace apps/mobile run web -- --port 8152 --host localhost`
- Browser/device/simulator/OS: Codex in-app browser at 320 x 568
- Feature or PR tested: Returning Progress photo user with no `photo_trend_insights` consent
- Overall verdict: Pass

## Tool Inventory

- Expo CLI: used through `npm --workspace apps/mobile run web`
- iOS Simulator: not used; Expo web-compatible consent gate
- Android emulator: not used; Expo web-compatible consent gate
- Expo web: used on localhost:8151 and clean-origin localhost:8152
- Playwright: used through the in-app browser API
- Codex Computer Use: not used
- Other: browser console log capture

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Progress photo history before trend consent | installed-base reconsent | Pass | `01-progress-before-optin.png`, `01-progress-before-optin.json` | Clean origin `localhost:8152`; populated photo history rendered; trend insight hidden; controls 48 px; zero overflow. |
| No-score refusal surface | installed-base reconsent | Pass | `02-progress-about-refusal-link.png`, `02-progress-about-refusal-link.json` | Preserved refusal surface shows optional, on-device, off-by-default opt-in copy; no trend result. |
| Trend opt-in default state | installed-base reconsent | Pass | `03-trend-optin-switch-off.png`, `03-trend-optin-switch-off.json` | Separate consent and off-by-default copy visible; switch starts off. |
| Explicit opt-in | installed-base reconsent | Pass | `04-trend-optin-switch-on.png`, `04-trend-optin-switch-on.json` | One user click sets `Read my progress` to `aria-checked=true`; no failure alert. |
| Progress after explicit opt-in | installed-base reconsent | Pass | `05-progress-after-explicit-optin.png`, `05-progress-after-explicit-optin.json`, `05-progress-after-explicit-optin-trend-card.json` | `localhost:8151`; trend card appears only after opt-in; scoped output has no score, grade, skin age, or percentage; controls 48 px; zero overflow. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| None | - | - | - | - | - |

## Tests Added or Updated

- Test file: `apps/mobile/src/features/trend/consent.test.ts`
- What it covers: configured ledger with old `photo_capture` but no `photo_trend_insights` fails closed; explicit trend consent row unlocks; local-first fallback still works when backend is not configured.
- Why this should be automated: prevents silent installed-base enrollment if a future consent refactor reuses photo capture or stale local state.

## Commands Run

```bash
npm --workspace apps/mobile run test -- src/features/trend/consent.test.ts src/features/trend/trendRoutes.test.ts src/features/trend/claimsafety.test.ts src/features/trend/trend.test.ts
EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro EXPO_PUBLIC_PHASE7_TREND_ENABLED=true EXPO_PUBLIC_E2E_PROGRESS_PHOTOS=populated EXPO_PUBLIC_E2E_TREND_CONSENT_LEDGER=local_only npm --workspace apps/mobile run web -- --port 8151 --host localhost --clear
EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro EXPO_PUBLIC_PHASE7_TREND_ENABLED=true EXPO_PUBLIC_E2E_PROGRESS_PHOTOS=populated EXPO_PUBLIC_E2E_TREND_CONSENT_LEDGER=local_only npm --workspace apps/mobile run web -- --port 8152 --host localhost
```

## Remaining Risk

- Browser read-only evaluation did not expose the private storage backend after opt-in; app-visible switch state and post-navigation trend rendering were captured instead, and the local-first fallback is covered by unit tests.
- Native iOS/Android biometric app-lock, secure storage, and screen-reader behavior remain device QA.
- Live Supabase immutable ledger rows for `photo_trend_insights` remain blocked on Tas-owned credentials and are already tracked in `docs/FOR_TAS_TO_DO.md`.
