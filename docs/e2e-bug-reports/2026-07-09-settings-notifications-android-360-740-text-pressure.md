# E2E Bug Report: Notification nudge switch peeks at 360 x 740 text pressure

Severity: Medium
Surface: Expo web
Environment: Headless Chrome, Expo web, 360 x 740 viewport, 200% text pressure
Feature: Settings notification preferences
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Run the text-pressure route audit with `TEXT_PRESSURE_VIEWPORT_WIDTH=360`, `TEXT_PRESSURE_VIEWPORT_HEIGHT=740`, and `TEXT_PRESSURE_SCALE=2`.
2. Open `/settings/notifications`.
3. Inspect visible controls in the first viewport.

## Expected Result

Visible notification controls are complete 44 px+ targets, and lower-priority nudge controls either fit fully or start below the first viewport.

## Actual Result

The `Replenishment` switch started at y=736 in a 740 px viewport, leaving only a 4 px visible strip at the bottom edge. The audit flagged it as both a clipped visible control and a sub-44 visible target.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-740-current/settings-notifications.png`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-740-current/settings-notifications.json`
- Run summary: `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-740-current/summary.json`
- Terminal transcript: `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-740-current/report.md`

## Frequency

- Always

## Scope

- Affected route/screen: `/settings/notifications`
- Affected account or fixture: Local notification preferences fixture
- External service involved: No
- Destructive action involved: No

## Suspected Cause

Notification Settings had compact spacing guards for sub-700 px supported text-pressure heights and 780-839 px iPhone-class heights, but the 700-779 px 360-wide Android band did not push lower-priority gentle nudge controls below the first viewport.

## Minimal Fix Recommendation

Add a 360/390-width, 700-779 px text-pressure band that moves the Gentle Nudges section below the first viewport while preserving the primary morning/evening reminder controls.

## Verification Flow After Fix

1. Run `/settings/notifications` only at 360 x 740 / 200% text pressure.
2. Run the full 49-route text-pressure audit at the same viewport and scale.
3. Confirm zero clipped controls, zero sub-44 visible controls, zero blocked hit centers, zero horizontal overflow, and zero disallowed browser logs.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-740-notifications-postfix/settings-notifications.png`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-740-notifications-postfix/settings-notifications.json`
- Full rerun summary: `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-740-postfix/summary.json`
- Full rerun report: `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-740-postfix/report.md`

## Remaining Risk

- Untested branches: Native iOS/Android Dynamic Type, safe-area, screen-reader, and notification permission/scheduling behavior.
- Missing fixtures: Physical device builds.
- Follow-up needed: Native Phase 5 device QA.
