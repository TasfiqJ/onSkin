# E2E Bug Report: 430x740 privacy policy row blocked by floating tab bar

Severity: Medium
Surface: Expo web
Environment: Headless Chrome Expo web, 430 x 740 viewport, 200% text pressure
Feature: Settings Privacy direct entry
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Run the text-pressure route audit at 430 x 740 with `TEXT_PRESSURE_SCALE=2`.
2. Inspect `/settings/privacy`, which resolves to `/you?section=privacy`.
3. Check visible controls for partial clipping, sub-44 visible targets, and blocked center hit-tests.

## Expected Result

The first viewport keeps privacy controls complete, readable, 44 px or taller where applicable, and center-hit-testable. Lower-priority policy rows may start below the first viewport until the user scrolls, but no policy row should sit under the floating tab bar.

## Actual Result

`/settings/privacy` exposed the `Privacy policy` row from y=624 to y=770. Its center at y=697 was inside the floating tab bar zone and hit-tested to the Shelf tab instead of the policy row.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-740-current/settings-privacy.png`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-740-current/settings-privacy.json`
- Failure summary: `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-740-current/failures.json`
- Terminal transcript: `npm run e2e:text-pressure`

## Frequency

Always at 430 x 740 / 200% text pressure before the fix.

## Scope

- Affected route/screen: `/settings/privacy`
- Affected account or fixture: local preview fixtures
- External service involved: no live external service
- Destructive action involved: none

## Suspected Cause

The privacy direct-entry layout treated 430 px wide, 740 px tall phones as non-compact because the compact breakpoint used `width < 430`. That left the policy card close enough to the first viewport that the first policy row became visible behind the floating tab bar.

## Minimal Fix Recommendation

Add a targeted 430-wide, 700-779 px direct privacy-entry guard that uses a dedicated policy-card top margin. Preserve the existing compact and tall 430-wide privacy behavior.

## Verification Flow After Fix

1. Re-run `/settings/privacy` at 430 x 740 / 200%.
2. Re-run the full 49-route sweep at 430 x 740 / 200%.
3. Re-run `/settings/privacy` at 430 x 932 / 200% as a tall-width regression check.

## Post-Fix Evidence

- Focused privacy pass: `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-740-privacy-postfix`
- Full 430 x 740 pass: `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-740-postfix`
- Focused 430 x 932 privacy regression pass: `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-932-privacy-regression-postfix`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-430-740-privacy-postfix/settings-privacy.json`
- Terminal transcript: `npm run e2e:text-pressure`

## Remaining Risk

- Untested branches: native iOS/Android Dynamic Type, safe-area, and screen-reader behavior.
- Missing fixtures: physical device builds and OS-level accessibility settings.
- Follow-up needed: keep native Phase 5/6 QA as final proof for platform-specific rendering.
