# E2E Bug Report: Recommendation Preferences Budget Chips Clipped At 430 x 700

Date: 2026-07-09
Environment: Headless Chrome Expo web, 430 x 700 viewport, 200% text pressure
Feature: Recommendation Preferences

## Reproduction

1. Run the text-pressure route audit at 430 x 700 with `TEXT_PRESSURE_SCALE=2`.
2. Open `/recommendations/preferences`.
3. Inspect visible controls for clipping, sub-44 px targets, blocked center hit-tests, overflow, and browser logs.

## Actual Result

The route failed with 1 affected route and 6 geometry issues. The `Drugstore`, `Mid-range`, and `Premium` budget chips started at y=664 and ended at y=712, leaving only 36 px visible in a 700 px viewport.

Evidence:

- Pre-fix evidence: `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-700-current/`
- Screenshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-700-current/recommendations-preferences.png`
- Failure JSON: `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-700-current/failures.json`

## Expected Result

Budget chips should either be fully visible and hit-testable above the floating tab bar or begin fully below the first viewport until the user scrolls.

## Suspected Cause

The Recommendation Preferences support-floor text-pressure guard covered 640-699 px heights. Exactly 700 px fell into the taller boundary layout, where the lower-priority budget group could peek into the first viewport under 200% text pressure.

## Minimal Fix

Extend `supportFloorTextPressurePreferences` through height 700 so the exact support-floor boundary defers lower-priority value and budget controls below the first viewport.

## Verification

- Focused route contract: `npm --workspace apps/mobile run test -- src/features/recommendations/recommendationRoutes.test.ts`
- Post-fix E2E: `TEXT_PRESSURE_SCALE=2`, `TEXT_PRESSURE_VIEWPORT_WIDTH=430`, `TEXT_PRESSURE_VIEWPORT_HEIGHT=700`, `npm run e2e:text-pressure`

Post-fix result: 49 routes passed, 0 failed routes, 0 clipped visible controls, 0 sub-44 px visible controls, 0 blocked center hit-tests, 0 horizontal overflow, and 0 disallowed browser logs.

Post-fix evidence:

- `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-700-postfix/`

## Remaining Risk

Native iOS/Android Dynamic Type, screen-reader, keyboard, and hardware safe-area behavior still require device QA.
