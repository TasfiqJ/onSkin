# E2E Bug Report: Recommendation preference failure used duplicate native alert

Severity: Medium
Surface: Expo web
Environment: 320 x 568 viewport, Expo web with `EXPO_PUBLIC_E2E_RECOMMENDATION_PREFERENCES_FAILURE=once` and `EXPO_PUBLIC_E2E_RECOMMENDATION_PREFERENCES_DELAY_MS=1200`
Feature: Personalized Recommendations preferences
Date: 2026-07-08
Tester: Codex human-simulated E2E

## Reproduction Steps

1. Start Expo web with the recommendation preference failure and delayed-save fixtures.
2. Open `/recommendations/preferences`.
3. Tap `Vegan`.

## Expected Result

The route keeps the preference unsaved, shows persistent `Preference not saved` recovery copy, and does not open a blocking native/system dialog over the compact-phone layout.

## Actual Result

The route already rendered persistent inline recovery copy, but the same failure handler also called `Alert.alert`, creating duplicate blocking feedback on platforms that display the native alert.

## Evidence

- Current evidence folder: `test-results/human-e2e/2026-07-08/recommendation-preference-save-failure-current/`
- Failure screenshot: `test-results/human-e2e/2026-07-08/recommendation-preference-save-failure-current/03-after-forced-failure.png`
- Logs: `test-results/human-e2e/2026-07-08/recommendation-preference-save-failure-current/browser-logs.json`

## Frequency

- Always when recommendation preference persistence failed.

## Scope

- Affected route/screen: `/recommendations/preferences`
- Affected account or fixture: Recommendation preference failure fixture
- External service involved: None
- Destructive action involved: None

## Suspected Cause

The route had been upgraded with persistent inline recovery copy, but the older native alert call remained in the `onFailure` handler.

## Minimal Fix Recommendation

Remove the `Alert.alert` call and unused import. Keep the inline `accessibilityRole="alert"` recovery panel and update the route contract so this path cannot regress to native-alert-only or duplicate feedback.

## Verification Flow After Fix

1. Open `/recommendations/preferences` with the failure and delayed-save fixtures.
2. Tap `Vegan` and confirm it remains unselected and disabled while saving.
3. Confirm failed save shows persistent `Preference not saved` copy with no JS/system dialog.
4. Retry `Vegan` and confirm it becomes selected only after save succeeds.
5. Reload and confirm the selected state persists.

## Remaining Risk

- Native iOS and Android still need simulator/device QA for private-storage failures and assistive technology output.
