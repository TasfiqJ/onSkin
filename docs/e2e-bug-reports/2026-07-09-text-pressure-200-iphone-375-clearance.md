# E2E Bug Report: 375 x 812 200% iPhone text-pressure clearance

Severity: High
Surface: Expo web
Environment: 375 x 812 viewport, 200% text-pressure route audit
Feature: Recommendation Preferences and Notification Settings
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Run the Expo web text-pressure route audit with `TEXT_PRESSURE_SCALE=2`, `TEXT_PRESSURE_VIEWPORT_WIDTH=375`, and `TEXT_PRESSURE_VIEWPORT_HEIGHT=812`.
2. Inspect the default 49-route sweep for visible partial controls and sub-44 px visible targets.
3. Re-run the same viewport after the fix.

## Expected Result

Every visible control on this supported iPhone-class viewport remains fully visible, 44 px or larger, center-hit-testable, free of horizontal overflow, and free of unexpected browser logs.

## Actual Result

The first sweep failed `/recommendations/preferences` and `/settings/notifications`. Recommendation Preferences exposed only the top 24 px of the `Oil` texture chip at the bottom edge. Notification Settings exposed only 23 px of the `Progress-photo nudge` switch at the bottom edge.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-812-current/recommendations-preferences.png`
- Screenshot: `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-812-current/settings-notifications.png`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-812-current/failures.json`
- Terminal transcript: `npm run e2e:text-pressure`

## Frequency

Always with the listed viewport and text-pressure scale before the fix.

## Scope

- Affected route/screen: `/recommendations/preferences` and `/settings/notifications`
- Affected account or fixture: local Expo web fixtures used by `scripts/e2e/text-pressure-route-audit.mjs`
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The 375 pt width reduced wrapping enough to pull lower-priority groups upward compared with narrower 360 px evidence. Recommendation Preferences still allowed the lower texture group to start in the first viewport, and Notification Settings rendered the third gentle-nudge switch in the same first-viewport card on a height band that is not compact but still fails under 200% text pressure.

## Minimal Fix Recommendation

Move lower-priority texture chips below the first viewport for the 375-class supported text-pressure tier, and reuse the deferred capture-nudge card pattern for 375-class Notification Settings so the first viewport shows only complete utility reminders and complete first-priority gentle nudges.

## Verification Flow After Fix

1. Run focused route-contract tests for recommendation and settings routes.
2. Run focused text-pressure E2E for `/recommendations/preferences` and `/settings/notifications` at 375 x 812 / 200%.
3. Run the full 49-route Expo web text-pressure audit at 375 x 812 / 200%.

## Post-Fix Evidence

- Focused screenshot/report set: `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-812-focused-postfix/`
- Full screenshot/report set: `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-812-postfix/`
- Summary: `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-812-postfix/summary.json`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-812-postfix/recommendations-preferences.json`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-812-postfix/settings-notifications.json`
- Terminal transcript: `npm run e2e:text-pressure`

## Remaining Risk

- Untested branches: native iOS Dynamic Type, hardware safe areas, and VoiceOver traversal
- Missing fixtures: native device/simulator text-size and screen-reader passes
- Follow-up needed: native iOS/Android Dynamic Type and accessibility QA
