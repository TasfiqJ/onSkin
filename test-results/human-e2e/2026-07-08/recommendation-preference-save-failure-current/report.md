# Recommendation Preference Save Failure Current Run

Date: 2026-07-08
Surface: System Chrome against Expo web
Viewport: 320 x 568
Route: `/recommendations/preferences`

## Fixture

- `EXPO_PUBLIC_E2E_RECOMMENDATION_PREFERENCES_FAILURE=once`
- `EXPO_PUBLIC_E2E_RECOMMENDATION_PREFERENCES_DELAY_MS=1200`
- `E2E_BASE_URL=http://localhost:8098` for the no-native-alert rerun

## Result

Passed. The latest rerun verified that `Vegan` starts unselected, stays unselected and disabled while the forced save failure is pending, shows persistent `Preference not saved` copy after rejection with no JS/system dialog, disables again during retry, becomes selected only after the successful save, and remains selected after reload.

## Evidence Files

- `01-before-save.png` / `01-before-save.json`
- `02-saving-disabled-before-failure.png` / `02-saving-disabled-before-failure.json`
- `03-after-forced-failure.png` / `03-after-forced-failure.json`
- `04-saving-disabled-before-retry-success.png` / `04-saving-disabled-before-retry-success.json`
- `05-after-retry-saved.png` / `05-after-retry-saved.json`
- `06-after-reload-persisted.png` / `06-after-reload-persisted.json`
- `browser-logs.json`
- `07-no-native-alert-before-save.png`
- `08-no-native-alert-saving-disabled-before-failure.png`
- `09-no-native-alert-after-forced-failure.png`
- `10-no-native-alert-saving-disabled-before-retry-success.png`
- `11-no-native-alert-after-retry-saved.png`
- `12-no-native-alert-after-reload-persisted.png`
- `no-native-alert-summary.json`
- `browser-logs-8098-filtered.json`

## Browser Logs

The current `localhost:8098` rerun had zero filtered warn/error logs. Older `browser-logs.json` entries are expected development warnings from a prior `localhost:8097` dev-server tab.

## Remaining Risk

Native iOS and Android private-storage failure handling and assistive technology output still need device QA through the Phase 5 and Phase 7 gates.
