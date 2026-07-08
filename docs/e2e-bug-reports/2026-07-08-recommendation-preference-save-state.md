# E2E Bug Report: Recommendation Preference Chips Did Not Expose Saved State On Web

Severity: Medium
Surface: Expo web
Environment: 320 x 568 viewport, local Expo web on port 19166 with `EXPO_PUBLIC_E2E_RECOMMENDATION_PREFERENCES_FAILURE=once` and `EXPO_PUBLIC_E2E_RECOMMENDATION_PREFERENCES_DELAY_MS=1200`
Feature: Personalized Recommendations preferences
Date: 2026-07-08
Tester: Codex human-simulated E2E

## Reproduction Steps

1. Start Expo web with the one-shot recommendation preference failure fixture and delayed-save fixture.
2. Open `/recommendations/preferences` at 320 x 568.
3. Tap `Vegan`.
4. Confirm the forced save fails closed and the inline recovery copy appears.
5. Tap `Vegan` again and wait for the retry to save.

## Expected Result

The chip stays unselected and disabled while each save is pending, failure leaves stable route-owned recovery copy without a blocking native dialog, retry applies the selected state only after persistence succeeds, and reload preserves the saved state.

## Actual Result

The behavioral save path was correct, but Expo web did not expose the selected chip state through `aria-selected` after retry. The browser E2E could not verify the saved selected state from accessibility attributes even though the chip was visually active.

## Evidence

- Failed rerun artifact: `web-build/playwright-output-recommendation-preference-save-failure/`
- Current post-fix evidence folder: `test-results/human-e2e/2026-07-08/recommendation-preference-save-failure-current/`
- Failure state screenshot: `test-results/human-e2e/2026-07-08/recommendation-preference-save-failure-current/03-after-forced-failure.png`
- Retry success screenshot: `test-results/human-e2e/2026-07-08/recommendation-preference-save-failure-current/05-after-retry-saved.png`
- Reload persistence snapshot: `test-results/human-e2e/2026-07-08/recommendation-preference-save-failure-current/06-after-reload-persisted.json`

## Suspected Cause

React Native `accessibilityState={{ selected: active }}` was not emitted as `aria-selected` by Expo web for this `Pressable` button. The web surface therefore lost a verifiable accessibility state that native still received through React Native props.

## Fix

Added explicit `aria-selected={active}` to the recommendation preference chip while keeping the existing React Native `accessibilityState`. Added a clamped delayed-save E2E fixture so the disabled saving state is observable and contract-tested. Removed the legacy `Alert.alert` call so the failure path relies on the persistent route-owned alert region instead of showing duplicate native feedback.

## Verification

- `npm --workspace apps/mobile run typecheck`
- `npm --workspace apps/mobile run test -- src/features/recommendations/recommendationRoutes.test.ts src/features/recommendations/applyPreferences.test.ts src/features/recommendations/store.test.ts`
- `npm exec --yes --package=@playwright/test -- playwright test scripts/tmp-e2e/recommendation-preference-save-failure.spec.js --reporter=list --output=web-build/playwright-output-recommendation-preference-save-failure`

Post-fix E2E verified:

- `Vegan` remains `aria-selected=false` and disabled while the forced failed save is pending.
- The route shows stable `Preference not saved` copy after rejection and opens no JS/system dialog.
- Retry disables the chip again before persistence succeeds.
- `Vegan` becomes `aria-selected=true` only after the successful save.
- Reload preserves `aria-selected=true`.
- Horizontal overflow is zero and visible controls remain 48 px tall.

## Remaining Risk

- Native iOS and Android private-storage failure behavior still needs simulator/device QA through the Phase 5 and Phase 7 device gates.
- This fixture proves local persistence failure handling; it does not replace live encrypted storage failure or device-level accessibility QA.
