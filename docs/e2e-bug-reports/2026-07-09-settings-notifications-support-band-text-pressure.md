# E2E Bug Report: Settings Notifications nudge switch peeks at 390 x 640 text pressure

Severity: Medium
Surface: Expo web
Environment: 390 x 640 viewport, 170% text-pressure route audit
Feature: Settings Notifications
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Run `npm run e2e:text-pressure` with `TEXT_PRESSURE_SCALE=1.7`, `TEXT_PRESSURE_VIEWPORT_WIDTH=390`, and `TEXT_PRESSURE_VIEWPORT_HEIGHT=640`.
2. Open `/settings/notifications`.
3. Inspect visible controls for clipping, sub-44 visible targets, blocked centers, horizontal overflow, and browser warnings.

## Expected Result

Lower-priority nudge switches either render completely in the first viewport or begin fully below it. No partial switch should be visible at the bottom edge.

## Actual Result

The `Streak & adherence` switch started at y=609.59 and ended at y=657.59, leaving only 30.41 px visible in the 640 px viewport. The route failed with one `tinyTarget` and one `partialClip` issue.

## Evidence

- Summary: `test-results/human-e2e/2026-07-09/text-pressure-170-support-band-390-640-notifications-current/summary.json`
- Route snapshot: `test-results/human-e2e/2026-07-09/text-pressure-170-support-band-390-640-notifications-current/settings-notifications.json`
- Screenshot: `test-results/human-e2e/2026-07-09/text-pressure-170-support-band-390-640-notifications-current/settings-notifications.png`

## Minimal Fix

Increase the Settings Notifications support-band nudge spacer so the `Streak & adherence` switch starts below the first 390 x 640 / 170% viewport instead of peeking as a partial target.

## Verification Flow After Fix

1. Rerun the same 390 x 640 / 170% route audit.
2. Confirm `/settings/notifications` reports zero clipped controls, zero sub-44 visible targets, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs.

## Post-Fix Evidence

- Summary: `test-results/human-e2e/2026-07-09/text-pressure-170-support-band-390-640-notifications-postfix/summary.json`
- Route snapshot: `test-results/human-e2e/2026-07-09/text-pressure-170-support-band-390-640-notifications-postfix/settings-notifications.json`
- Screenshot: `test-results/human-e2e/2026-07-09/text-pressure-170-support-band-390-640-notifications-postfix/settings-notifications.png`

The post-fix 49-route audit passed with zero failed routes.

## Remaining Risk

Native iOS/Android Dynamic Type, safe-area, and screen-reader traversal remain physical-device QA.
