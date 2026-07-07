# E2E Bug Report: Trend consent failure recovery

Severity: Critical
Surface: Expo web
Environment: `EXPO_PUBLIC_PHASE7_TREND_ENABLED=true`, `EXPO_PUBLIC_E2E_TREND_CONSENT_FAILURE=grant_once,revoke_once`, `EXPO_PUBLIC_E2E_TREND_CONSENT_LEDGER=local_only`
Feature: Photo Trend Insights opt-in
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Start Expo web and open `/trend/optin` at 320 x 568.
2. Toggle `Read my progress` on with the one-shot grant failure fixture enabled.
3. Retry the grant, then toggle off with the one-shot withdrawal failure fixture enabled.
4. Retry the withdrawal.

## Expected Result

The failed grant/revoke attempts leave the switch on the last saved value, re-enable the switch, show stable `Choice not saved` copy in a persistent alert region, hide raw provider errors, and allow successful retries to clear the alert.

## Actual Result

Before the fix, failure recovery depended on transient alert behavior and was not durable enough for web E2E. During verification, the first implementation also kept the switch disabled while `invalidateQueries` waited on the Supabase-backed consent read in the local placeholder environment.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/trend-consent-failure/02-grant-failure-320.png`
- Screenshot: `test-results/human-e2e/2026-07-07/trend-consent-failure/04-revoke-failure-320.png`
- Logs: `test-results/human-e2e/2026-07-07/trend-consent-failure/browser-warn-error-logs.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/trend-consent-failure/run-summary.json`

## Frequency

- Always with the forced one-shot failure fixture.

## Scope

- Affected route/screen: `/trend/optin`
- Affected account or fixture: dev E2E failure fixture and local-only ledger fixture
- External service involved: Supabase consent ledger for production verification
- Destructive action involved: No

## Suspected Cause

The screen had no durable in-route failure affordance, and `applyTrendConsentChoice` awaited visible-state invalidation even when the save result was already known. In a placeholder Supabase environment, that refresh could keep the retry control disabled.

## Minimal Fix Recommendation

Add persistent `role="alert"` failure copy, keep the switch fail-closed on the last saved value, make visible-state invalidation non-blocking, update the local query cache immediately after successful saves, and keep the Supabase-free ledger stub strictly dev-only for E2E.

## Verification Flow After Fix

1. Open `/trend/optin` at 320 x 568 with the env values listed above.
2. Toggle on and confirm the grant failure shows `Choice not saved`, switch off, switch enabled.
3. Retry grant and confirm switch on, alert cleared.
4. Toggle off and confirm the withdrawal failure shows `Choice not saved`, switch on, switch enabled.
5. Retry withdrawal and confirm switch off, alert cleared.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/trend-consent-failure/03-grant-retry-success-320.png`
- Screenshot: `test-results/human-e2e/2026-07-07/trend-consent-failure/05-revoke-retry-success-320.png`
- Logs: `test-results/human-e2e/2026-07-07/trend-consent-failure/browser-warn-error-logs.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/trend-consent-failure/run-summary.json`

## Remaining Risk

- Untested branches: native iOS/Android Trend opt-in with real authenticated Supabase consent ledger.
- Missing fixtures: staging/production Supabase credentials and authenticated test account.
- Follow-up needed: Tas must attach live-auth/RLS evidence for `photo_trend_insights` grant and withdrawal rows.
