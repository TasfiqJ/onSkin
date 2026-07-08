# E2E Bug Report: Trend consent failure used duplicate native alert

Severity: Medium
Surface: Expo web
Environment: Expo web at 320 x 568, `EXPO_PUBLIC_PHASE7_TREND_ENABLED=true`, `EXPO_PUBLIC_E2E_TREND_CONSENT_FAILURE=grant_once,revoke_once`, `EXPO_PUBLIC_E2E_TREND_CONSENT_LEDGER=local_only`
Feature: Photo Trend Insights opt-in consent
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with the Trend consent failure fixtures.
2. Open `/trend/optin`.
3. Tap `Read my progress`.

## Expected Result

The failed save remains on the route with persistent, accessible recovery copy, no raw backend/provider error, and no blocking system dialog over the compact-phone layout.

## Actual Result

The route already rendered persistent `Choice not saved` copy, but the failure handler also called `Alert.alert`, creating a duplicate blocking native/system dialog on top of the polished route-owned recovery state.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/trend-consent-failure-inline-feedback/02-grant-failure-inline-alert.png`
- Screenshot: `test-results/human-e2e/2026-07-08/trend-consent-failure-inline-feedback/04-revoke-failure-inline-alert.png`
- Logs: `test-results/human-e2e/2026-07-08/trend-consent-failure-inline-feedback/console-warn-error.json`
- UI snapshot: browser evaluation confirmed `role="alert"` copy, `tab.getJsDialog()` was `null` after the fix, and the switch remained 52 x 48.

## Frequency

- Always when the Trend consent ledger save/withdrawal handler failed.

## Scope

- Affected route/screen: `/trend/optin`
- Affected account or fixture: Trend-enabled local fixture with failed grant or revoke
- External service involved: None; local-only ledger fixture
- Destructive action involved: None

## Suspected Cause

The route had been upgraded with an inline accessible failure region, but the legacy native alert call was left in the same `onFailure` handler.

## Minimal Fix Recommendation

Remove the `Alert.alert` call and unused import. Keep the route-owned `accessibilityRole="alert"` panel and update the route contract test to reject native alerts in this failure path.

## Verification Flow After Fix

1. Open `/trend/optin` with the grant/revoke failure fixtures.
2. Tap `Read my progress`; confirm inline failure copy appears, the switch remains off, and no dialog appears.
3. Tap `Read my progress` again; confirm the switch turns on and the inline alert clears.
4. Tap the switch off; confirm inline failure copy appears, the switch remains on, and no dialog appears.
5. Tap the switch off again; confirm the switch turns off and the inline alert clears.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/trend-consent-failure-inline-feedback/01-initial-optin.png`
- Screenshot: `test-results/human-e2e/2026-07-08/trend-consent-failure-inline-feedback/02-grant-failure-inline-alert.png`
- Screenshot: `test-results/human-e2e/2026-07-08/trend-consent-failure-inline-feedback/03-grant-retry-success.png`
- Screenshot: `test-results/human-e2e/2026-07-08/trend-consent-failure-inline-feedback/04-revoke-failure-inline-alert.png`
- Screenshot: `test-results/human-e2e/2026-07-08/trend-consent-failure-inline-feedback/05-revoke-retry-success.png`
- Logs: `test-results/human-e2e/2026-07-08/trend-consent-failure-inline-feedback/console-warn-error.json`

## Remaining Risk

- Untested branches: Native iOS/Android consent animation and local-auth/app-lock interplay.
- Missing fixtures: None for this Expo-web route branch.
- Follow-up needed: Ask consent and Recommendation preferences still have native alert failure paths to harden in later slices.
