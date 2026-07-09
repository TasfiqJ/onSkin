# E2E Bug Report: Recommendation preference chips peek at 360 x 600 text pressure

Severity: Medium
Surface: Expo web
Environment: Headless Chrome, Expo web, 360 x 600 viewport, 200% text pressure
Feature: Recommendation preferences
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Run the text-pressure route audit with `TEXT_PRESSURE_VIEWPORT_WIDTH=360`, `TEXT_PRESSURE_VIEWPORT_HEIGHT=600`, and `TEXT_PRESSURE_SCALE=2`.
2. Open `/recommendations/preferences`.
3. Inspect visible controls in the first viewport.

## Expected Result

Visible preference chips are complete 44 px+ targets, and lower-priority values, budget, and texture controls either fit fully or start below the first viewport.

## Actual Result

The first 360 x 600 sweep showed `Sustainable` as a partially visible 24 px target at the bottom edge. After deferring the lower values group, the full rerun exposed `Drugstore`, `Mid-range`, and `Premium` as 8 px partial targets at the same bottom edge.

## Evidence

- Initial screenshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-600-current/recommendations-preferences.png`
- Initial UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-600-current/recommendations-preferences.json`
- Follow-up failing summary: `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-600-postfix/summary.json`
- Terminal transcript: `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-600-current/report.md`

## Frequency

- Always

## Scope

- Affected route/screen: `/recommendations/preferences`
- Affected account or fixture: Local recommendation preferences fixture
- External service involved: No
- Destructive action involved: No

## Suspected Cause

The route treated exactly 600 px tall screens as compact but not split-short, so all value chips entered the first viewport under 200% text pressure. After lower value chips moved below the fold, the budget group still lacked the same 600-639 px text-pressure deferral.

## Minimal Fix Recommendation

Add a 600-639 px supported text-pressure band for 414 px-and-narrower phones. In that band, keep the first three values chips complete and defer lower values plus budget controls below the first viewport.

## Verification Flow After Fix

1. Run `/recommendations/preferences` only at 360 x 600 / 200% text pressure.
2. Run the full 49-route text-pressure audit at the same viewport and scale.
3. Confirm zero clipped controls, zero sub-44 visible controls, zero blocked hit centers, zero horizontal overflow, and zero disallowed browser logs.

## Post-Fix Evidence

- Focused screenshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-600-preferences-postfix2/recommendations-preferences.png`
- Focused UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-600-preferences-postfix2/recommendations-preferences.json`
- Full rerun summary: `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-600-postfix2/summary.json`
- Full rerun report: `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-600-postfix2/report.md`

## Remaining Risk

- Untested branches: Native iOS/Android Dynamic Type, keyboard, safe-area, and screen-reader traversal.
- Missing fixtures: Physical device builds.
- Follow-up needed: Native Phase 5 device QA.
