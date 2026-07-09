# E2E Bug Report: You tab routine rows blocked by floating tab bar at high text pressure

Severity: High
Surface: Expo web
Environment: Headless Chrome Expo web, 360 x 640 and 430 x 932 supported phone profiles, 200% text pressure
Feature: Settings account controls / You tab
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Start Expo web through `npm run e2e:text-pressure`.
2. Set `TEXT_PRESSURE_SCALE=2` and `TEXT_PRESSURE_ROUTES='/you,/you?section=privacy,/you?section=security,/you?section=commerce,/you?section=support,/you?section=accountDeletion,/settings/privacy'`.
3. Run at 360 x 640 and 430 x 932 supported phone profiles.

## Expected Result

Visible You-tab controls remain complete and center-hit-testable above the floating tab bar. Lower-priority routine rows may move below the first viewport until the user scrolls.

## Actual Result

The You tab exposed routine rows in the floating tab-bar hit zone. On 360 x 640, `Edit the order` was visible with its center blocked by the tab bar. On 430 x 932, the `More routine` card exposed `Edit the order` and a partial `Retinoid ramp` row at the bottom edge.

## Evidence

- Screenshot/UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-you-sections-360-640-current/`
- Screenshot/UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-you-sections-430-932-postfix/`
- Terminal transcript: `npm run e2e:text-pressure` failed with 6 routes at 360 x 640, then 6 routes at 430 x 932 before the tall-phone fix.

## Frequency

- Always under the tested supported-phone text-pressure profiles.

## Scope

- Affected route/screen: `/you`, `/you?section=privacy`, `/you?section=security`, `/you?section=commerce`, `/you?section=support`, `/you?section=accountDeletion`
- Affected account or fixture: local Expo web fixture, signed-in/fixture account state
- External service involved: none
- Destructive action involved: no

## Suspected Cause

The compact You-tab density only split routine rows for short phones and used a smaller secondary-row offset. At high text pressure on supported phones, the primary and secondary routine cards could still enter the floating tab-bar hit zone.

## Minimal Fix Recommendation

Add a high-text You-tab density band that keeps only `Your plan` in the first routine card, pushes secondary routine rows below the first viewport on compact and tall supported phones, and guards it with route-contract tests.

## Verification Flow After Fix

1. Re-run the same 7-route You/settings route set at 360 x 640 / 200%.
2. Re-run at 375 x 667 / 200%, 390 x 844 / 200%, and 430 x 932 / 200%.
3. Confirm zero clipped controls, sub-44 visible controls, blocked hit centers, horizontal overflow, text overflow, or disallowed browser logs.

## Post-Fix Evidence

- Screenshot/UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-you-sections-360-640-postfix4/`
- Screenshot/UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-you-sections-375-667-postfix2/`
- Screenshot/UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-you-sections-390-844-postfix2/`
- Screenshot/UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-you-sections-430-932-postfix4/`
- Terminal transcript: focused `settingsRoutes.test.ts` passed after the route-contract update.

## Remaining Risk

- Untested branches: native iOS/Android Dynamic Type, VoiceOver/TalkBack traversal, and real safe-area behavior.
- Missing fixtures: live signed-in settings/account service state.
- Follow-up needed: keep Phase 5 native device QA as final proof for platform-specific rendering.
