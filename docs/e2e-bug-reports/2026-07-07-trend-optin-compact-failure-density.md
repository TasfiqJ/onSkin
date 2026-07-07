# E2E Bug Report: Trend opt-in failure state crowded compact phones

Date: 2026-07-07
Environment: Expo web on localhost:8118, 320 x 568 compact phone viewport, `EXPO_PUBLIC_PHASE7_TREND_ENABLED=true`, `EXPO_PUBLIC_E2E_TREND_CONSENT_FAILURE=grant_once,revoke_once`, `EXPO_PUBLIC_E2E_TREND_CONSENT_LEDGER=local_only`
Feature: Photo trend opt-in consent failure recovery
Priority: Critical
Status: Fixed

## Steps To Reproduce

1. Start Expo web with Trend enabled and local-only consent ledger failure hooks.
2. Open `/trend/optin` at 320 x 568.
3. Toggle `Read my progress` on to force the one-shot grant failure.
4. Inspect the failure alert, switch, and secondary fairness row.

## Expected

The failure state keeps the switch retryable, shows persistent `Choice not saved` copy, and does not expose clipped or partially visible secondary controls on compact phones.

## Actual

The failure alert rendered correctly, but the secondary fairness row remained visible at the bottom edge and extended out of the compact viewport.

## Root Cause

The compact opt-in layout used the same secondary-link stack after a persistent failure alert. The alert consumes enough vertical space that the fairness row becomes a clipped visible control on 320 x 568.

## Fix

Add short-phone density to the Trend opt-in card and failure alert, and hide secondary fairness/footer links while a compact failure alert is active. Successful retries restore the secondary links.

## Verification

- Initial compact render: `test-results/human-e2e/2026-07-07/trend-optin-compact-layout/03-initial-after-alert-density-fix.png`
- Grant failure after fix: `test-results/human-e2e/2026-07-07/trend-optin-compact-layout/06-grant-failure-final.png`
- Grant retry success: `test-results/human-e2e/2026-07-07/trend-optin-compact-layout/07-grant-retry-success.png`
- Revoke failure after fix: `test-results/human-e2e/2026-07-07/trend-optin-compact-layout/08-revoke-failure-final.png`
- Revoke retry success: `test-results/human-e2e/2026-07-07/trend-optin-compact-layout/09-revoke-retry-success.png`
- Browser logs: `test-results/human-e2e/2026-07-07/trend-optin-compact-layout/browser-warn-error-logs.json`
- Focused contract: `npm --workspace apps/mobile run test -- src/features/trend/trendRoutes.test.ts`

## Follow-Up

Native iOS/Android Trend opt-in still needs physical-device verification with the real authenticated Supabase consent ledger.
