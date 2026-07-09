# E2E Bug Report: 430x640 support-band text-pressure controls

Severity: Medium
Surface: Expo web
Environment: Headless Chrome Expo web, 430 x 640 viewport, 200% text pressure
Feature: Recommendation Preferences, Skin Notes, Settings Privacy, and Shelf Scan
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Run the full text-pressure route audit at 430 x 640 with `TEXT_PRESSURE_SCALE=2`.
2. Inspect `/recommendations/preferences`, `/community`, `/settings/privacy`, and `/shelf/scan`.
3. Check visible controls for partial clipping, sub-44 visible targets, and blocked center hit-tests.

## Expected Result

Visible controls remain complete, readable, 44 px or taller where applicable, center-hit-testable, free of horizontal overflow, and free of unexpected browser logs. Lower-priority controls may start below the first viewport until the user scrolls.

## Actual Result

The initial current-source sweep failed three routes:

- `/recommendations/preferences` exposed the Texture chips (`Gel`, `Cream`, `Fluid`, `Balm`, `Oil`) as 24 px partial bottom-edge targets.
- `/community` exposed the second Sensitive Skin note as an 18 px partial bottom-edge target.
- `/settings/privacy` exposed `Privacy policy` as a 16 px visible row whose center was blocked by underlying You-tab content.

After the first fix, the full rerun exposed `/recommendations/preferences` lower value chips (`Non-comedogenic`, `Sustainable`) as 8 px partial bottom-edge targets. After the second fix, the next full rerun exposed `/shelf/scan` with `Scan ingredient label` fully visible but center-hit-tested to the camera-helper copy layer.

## Evidence

- Initial failure summary: `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-640-current/failures.json`
- Initial UI snapshots: `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-640-current/recommendations-preferences.json`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-640-current/community.json`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-640-current/settings-privacy.json`
- Follow-up preference failure: `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-640-postfix/failures.json`
- Follow-up scan failure: `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-640-postfix2/failures.json`
- Terminal transcript: `npm run e2e:text-pressure`

## Frequency

Always at 430 x 640 / 200% text pressure before the fixes.

## Scope

- Affected route/screen: `/recommendations/preferences`, `/community`, `/settings/privacy`, `/shelf/scan`
- Affected account or fixture: local preview fixtures
- External service involved: no live external service
- Destructive action involved: none

## Suspected Cause

Several support-floor text-pressure guards were capped at 390 px width, even though the accepted launch envelope includes wider 430 px phones with 640 px usable height. Settings Privacy also only applied the 430-wide policy-card spacer from 700 px height upward, leaving the 640 px floor uncovered. Recommendation Preferences needed an additional wide support-floor spacer because the long title/subtitle state in the full route sequence still let the deferred lower value chips peek into the first viewport.

## Minimal Fix Recommendation

Extend the support-floor text-pressure guards for Recommendation Preferences, Skin Notes, and Shelf Scan through 430 px width. Extend the 430-wide Settings Privacy direct-entry policy spacer down to 640 px height. Add a wider support-floor deferred value-chip spacer for Recommendation Preferences.

## Verification Flow After Fix

1. Re-run the focused source-contract tests for Recommendation, Community, Settings, and Shelf routes.
2. Re-run the focused 430 x 640 / 200% route audit for `/recommendations/preferences`, `/community`, and `/settings/privacy`.
3. Re-run focused follow-ups for `/recommendations/preferences` and `/shelf/scan`.
4. Re-run the full 49-route 430 x 640 / 200% sweep.
5. Re-run affected routes at 390 x 640 / 200% as a regression check.

## Post-Fix Evidence

- Focused first-failure rerun: `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-640-focused-postfix`
- Focused preference rerun: `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-640-preferences-postfix2`
- Focused scan rerun: `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-640-scan-postfix`
- Full 430 x 640 pass: `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-640-postfix3`
- 390 x 640 affected-route regression pass: `test-results/human-e2e/2026-07-09/text-pressure-200-android-390-640-affected-regression-postfix`
- Terminal transcript: `npm run e2e:text-pressure`

## Remaining Risk

- Untested branches: native iOS/Android Dynamic Type, safe-area, camera permission sheets, screen-reader traversal, and keyboard states.
- Missing fixtures: physical device builds and OS-level accessibility settings.
- Follow-up needed: keep native Phase 5/6/7 QA as final proof for platform-specific rendering and camera behavior.
