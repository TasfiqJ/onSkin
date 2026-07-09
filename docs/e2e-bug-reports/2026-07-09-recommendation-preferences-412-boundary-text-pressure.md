# E2E Bug Report: Recommendation Preferences 412 Boundary Budget Chips

Severity: Medium
Surface: Expo web
Environment: Headless Chrome Expo web, 412 x 844 viewport, 200% text pressure
Feature: Recommendation Preferences
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Open `/recommendations/preferences`.
2. Run the text-pressure route audit at 412 x 844 with `TEXT_PRESSURE_SCALE=2`.
3. Inspect visible controls at the first viewport bottom.

## Expected Result

Visible preference chips should be complete, 44 px or taller, center-hit-testable,
and free of horizontal overflow. Lower-priority groups may start below the first
viewport, but they must not peek in as partial targets.

## Actual Result

`Drugstore` and `Mid-range` budget chips started at y=818 and extended below the
844 px viewport, leaving only 26 px visible. The route reported four issues:
two tiny targets and two partial clips.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-09/text-pressure-200-boundary-412-844-preferences-current/recommendations-preferences.png`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-boundary-412-844-preferences-current/recommendations-preferences.json`
- Logs: `test-results/human-e2e/2026-07-09/text-pressure-200-boundary-412-844-preferences-current/report.md`

## Frequency

- Always at 412 x 844 / 200% before the fix.

## Scope

- Affected route/screen: `/recommendations/preferences`
- Affected account or fixture: local Expo web fixture
- External service involved: no
- Destructive action involved: no

## Suspected Cause

Recommendation Preferences treated the 412 x 844 text-pressure boundary like the
standard modern-phone density tier. The budget group began in the first viewport
after the value chip groups instead of being deferred fully below the fold.

## Minimal Fix Recommendation

Apply the stronger text-pressure spacer to the supported 700-979 px high
modern/tall phone envelope so visible value chips remain complete and
lower-priority budget chips start below the first viewport.

## Verification Flow After Fix

1. Run `npm --workspace apps/mobile run test -- recommendationRoutes.test.ts`.
2. Re-run `/recommendations/preferences` at 412 x 844 with
   `TEXT_PRESSURE_SCALE=2`.
3. Confirm zero clipped visible controls, zero sub-44 visible controls, zero
   blocked center hit-tests, zero horizontal overflow, and zero disallowed
   browser logs.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-09/text-pressure-200-boundary-412-844-preferences-postfix3/recommendations-preferences.png`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-boundary-412-844-preferences-postfix3/recommendations-preferences.json`
- Logs: `test-results/human-e2e/2026-07-09/text-pressure-200-boundary-412-844-preferences-postfix3/report.md`

## Remaining Risk

- Untested branches: native iOS/Android Dynamic Type, VoiceOver, TalkBack,
  keyboard, and hardware safe-area behavior.
- Missing fixtures: physical supported iOS 17+ and Android 10+ devices.
- Follow-up needed: keep the 412 x 844 boundary route in supported-phone
  text-pressure sweeps when the route set is refreshed.
