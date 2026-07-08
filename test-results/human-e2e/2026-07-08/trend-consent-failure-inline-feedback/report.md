# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Remove duplicate native alert from Trend consent save/withdrawal failure recovery
- App surface: Expo web
- Build/start command: `EXPO_PUBLIC_PHASE7_TREND_ENABLED=true EXPO_PUBLIC_E2E_TREND_CONSENT_FAILURE=grant_once,revoke_once EXPO_PUBLIC_E2E_TREND_CONSENT_LEDGER=local_only npm --workspace apps/mobile run web -- --port 8097`
- Browser/device/simulator/OS: In-app browser, 320 x 568 viewport
- Feature tested: Photo Trend Insights `/trend/optin`
- Overall verdict: Pass

## Tool Inventory

- Expo CLI: Used through `npm --workspace apps/mobile run web`
- iOS Simulator: Not used for this web-compatible route branch
- Android emulator: Not used for this web-compatible route branch
- Expo web: Used
- Playwright: Used through the in-app browser API
- Playwright MCP: Not used separately
- Codex Computer Use: Not needed
- Other: Browser console warning/error capture

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Trend consent opt-in | Initial direct entry | Pass | `01-initial-optin.png` | Heading and opt-in copy visible; switch off; zero horizontal overflow. |
| Trend consent opt-in | Grant failure | Pass | `02-grant-failure-inline-alert.png` | Inline `Choice not saved` alert rendered; switch stayed off; no JS/system dialog; no raw error text. |
| Trend consent opt-in | Grant retry | Pass | `03-grant-retry-success.png` | Switch turned on and failure copy cleared. |
| Trend consent opt-in | Revoke failure | Pass | `04-revoke-failure-inline-alert.png` | Inline alert rendered; switch stayed on; no JS/system dialog; no raw error text. |
| Trend consent opt-in | Revoke retry | Pass | `05-revoke-retry-success.png` | Switch turned off and failure copy cleared. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| --- | -------- | ------------ | -------- | ------ | -------- |
| `2026-07-08-trend-consent-native-alert` | Medium | Fail Trend consent grant/revoke on `/trend/optin` | Route-owned persistent recovery copy without blocking dialog | Legacy native alert duplicated the inline recovery state | `docs/e2e-bug-reports/2026-07-08-trend-consent-native-alert.md` |

## Tests Added Or Updated

- Test file: `apps/mobile/src/features/trend/trendRoutes.test.ts`
- What it covers: The Trend opt-in route keeps retryable inline failure handling and rejects `Alert.alert` in this failure path.
- Why this should be automated: Consent failure recovery is a critical privacy branch and should not regress to a blocking native dialog.

## Commands Run

```bash
npm --workspace apps/mobile run test -- trendRoutes.test.ts consent.test.ts
EXPO_PUBLIC_PHASE7_TREND_ENABLED=true EXPO_PUBLIC_E2E_TREND_CONSENT_FAILURE=grant_once,revoke_once EXPO_PUBLIC_E2E_TREND_CONSENT_LEDGER=local_only npm --workspace apps/mobile run web -- --port 8097
```

## Remaining Risk

- Native iOS and Android switch animation and platform accessibility should still be sampled during broader device QA.
- Ask consent and Recommendation preferences still have native alert failure paths and should be hardened in later slices.
