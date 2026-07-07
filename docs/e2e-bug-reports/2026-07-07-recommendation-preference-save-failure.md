# E2E Bug Report: Recommendation preference save failure lacked visible recovery

Severity: Medium
Surface: Expo web
Environment: 320 x 568 viewport, local Expo web on port 8122 with `EXPO_PUBLIC_E2E_RECOMMENDATION_PREFERENCES_FAILURE=once`
Feature: Personalized Recommendations preferences
Date: 2026-07-07
Tester: Codex human-simulated E2E

## Reproduction Steps

1. Start Expo web with `EXPO_PUBLIC_E2E_RECOMMENDATION_PREFERENCES_FAILURE=once`.
2. Open `/recommendations/preferences` at 320 x 568.
3. Tap an unselected preference chip.

## Expected Result

The preference is not visibly applied until local private persistence succeeds. On failure, the user sees stable recovery copy and can retry.

## Actual Result

The preference failed closed, but Expo web did not expose a visible `Alert.alert` dialog, leaving no stable on-screen explanation after the first failed tap.

## Evidence

- Initial failed branch screenshot: `test-results/human-e2e/2026-07-07/recommendation-preference-save-failure/02-after-forced-failure-alert-dismissed-320.png`
- Initial failed branch result: `test-results/human-e2e/2026-07-07/recommendation-preference-save-failure/result.json`

## Suspected Cause

The failure path relied on native alert presentation only. That is not durable enough for Expo web E2E and gives the user no persistent visible recovery state if the alert surface is unavailable.

## Fix

Added a dev-only one-shot failure fixture, `EXPO_PUBLIC_E2E_RECOMMENDATION_PREFERENCES_FAILURE=once`, and persistent inline `Preference not saved` recovery copy with `role="alert"`. The route still keeps native `Alert.alert` for platforms that display it.

## Verification

1. Open `/recommendations/preferences` with the failure fixture enabled.
2. Tap `Vegan`.
3. Confirm `Vegan` stays unselected and inline `Preference not saved` copy appears.
4. Tap `Vegan` again.
5. Confirm the chip becomes selected, the alert copy clears, horizontal overflow is zero, and visible controls remain at least 44 px.

## Post-Fix Evidence

- Failure screenshot: `test-results/human-e2e/2026-07-07/recommendation-preference-save-failure/05-inline-after-forced-failure-320.png`
- Retry screenshot: `test-results/human-e2e/2026-07-07/recommendation-preference-save-failure/06-inline-after-retry-saved-320.png`
- Result summary: `test-results/human-e2e/2026-07-07/recommendation-preference-save-failure/inline-result.json`

## Remaining Risk

- Native iOS and Android alert presentation still needs simulator/device QA.
- The fixture is development-only and does not replace real private storage failure testing on native devices.
