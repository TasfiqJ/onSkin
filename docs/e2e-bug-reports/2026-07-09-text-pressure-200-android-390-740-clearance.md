# E2E Bug Report: 390x740 200% notification and upsell controls clipped

Severity: Medium
Surface: Expo web
Environment: Headless Chrome Expo web, 390 x 740 viewport, 200% text pressure
Feature: Settings Notifications and direct contextual upsell paywall
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Run the text-pressure route audit at 390 x 740 with `TEXT_PRESSURE_SCALE=2`.
2. Inspect `/settings/notifications` and `/paywall/upsell?feature=full_routine`.
3. Check visible controls for partial clipping, sub-44 visible targets, and blocked center hit-tests.

## Expected Result

Visible controls remain complete, readable, 44 px or taller where applicable, and center-hit-testable. Lower-priority controls may move below the first viewport, but no switch or purchase CTA should appear as a partial bottom-edge target.

## Actual Result

`/settings/notifications` exposed only 1 px of the `Streak & adherence` switch at the first viewport bottom. After the notification fix, the full rerun exposed `/paywall/upsell?feature=full_routine` `Start free trial` as a 19 px partial target whose center hit the surrounding paywall wrapper.

## Evidence

- UI snapshots: `test-results/human-e2e/2026-07-09/text-pressure-200-android-390-740-current/settings-notifications.json`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-390-740-postfix/paywall-upsell-feature-full-routine.json`
- Screenshots: `test-results/human-e2e/2026-07-09/text-pressure-200-android-390-740-current/settings-notifications.png`, `test-results/human-e2e/2026-07-09/text-pressure-200-android-390-740-postfix/paywall-upsell-feature-full-routine.png`
- Terminal transcript: `npm run e2e:text-pressure`

## Frequency

Always at 390 x 740 / 200% text pressure before the fix.

## Scope

- Affected route/screen: `/settings/notifications`, `/paywall/upsell?feature=full_routine`
- Affected account or fixture: local preview fixtures
- External service involved: no live external service; store pricing intentionally unavailable in preview
- Destructive action involved: none

## Suspected Cause

The existing 360/390-wide 700-779 px notification spacer was tuned closely enough that 390-wide text wrapping still let the first lower-priority nudge switch start at the viewport edge. The direct upsell sheet only treated raw heights below 600 px as short, but 390 x 740 at 200% text pressure needs the same compact paywall treatment to keep the primary CTA fully visible.

## Minimal Fix Recommendation

Increase the 700-779 px notification spacer for the 360/390-wide text-pressure band. Add a 390-wide 700-779 px direct-upsell text-pressure breakpoint that uses the existing short paywall layout with header compliance and compact action spacing.

## Verification Flow After Fix

1. Re-run `/settings/notifications` at 390 x 740 / 200%.
2. Re-run `/paywall/upsell?feature=full_routine` at 390 x 740 / 200%.
3. Re-run the full 49-route sweep at 390 x 740 / 200%.
4. Re-run the full 49-route sweep at 360 x 740 / 200% as a regression check for the shared width band.

## Post-Fix Evidence

- Focused notification pass: `test-results/human-e2e/2026-07-09/text-pressure-200-android-390-740-notifications-postfix`
- Focused upsell pass: `test-results/human-e2e/2026-07-09/text-pressure-200-android-390-740-upsell-postfix`
- Full 390 x 740 pass: `test-results/human-e2e/2026-07-09/text-pressure-200-android-390-740-postfix2`
- Full 360 x 740 regression pass: `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-740-regression-postfix`

## Remaining Risk

- Untested branches: native iOS/Android Dynamic Type, safe-area, screen-reader, notification permission, and native store-sheet behavior.
- Missing fixtures: physical device builds and real RevenueCat sandbox purchase sheets.
- Follow-up needed: keep Phase 5/6 native QA as final proof for platform-specific rendering and billing behavior.
