# E2E Bug Report: Supported-phone 120% text-pressure clearance

Severity: High
Surface: Expo web
Environment: Headless Chrome, Expo web, 320 x 568, 320 x 480, 390 x 844, and 430 x 932 viewports, 120% text pressure
Feature: Supported-phone text-pressure layout across Shelf recovery, Shelf manual add, Settings Privacy, Settings Notifications, Skin Notes, and Recommendation Preferences
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Run the Expo web text-pressure route audit with `TEXT_PRESSURE_SCALE=1.2`.
2. Sweep the current 49 direct-entry routes at 320 x 568, the 320 x 480 launch support floor, and modern supported-phone viewports.
3. Inspect visible controls for clipping, sub-44 px visible targets, blocked center hit-tests, horizontal overflow, and disallowed browser logs.

## Expected Result

Visible controls remain complete, readable, 44 px or taller where applicable, and center-hit-testable. Lower-priority controls can start below the first viewport, but no button, chip, switch, recovery row, or policy row should peek as a partial bottom-edge target.

## Actual Result

The follow-up 120% supported-phone sweeps reproduced first-viewport clearance issues in `/shelf/no-match`, `/settings/notifications`, `/settings/privacy`, `/shelf/manual`, `/community`, and `/recommendations/preferences`.

## Evidence

- Default compact audit: `test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/`
- Support-floor audit: `test-results/human-e2e/2026-07-09/text-pressure-120-support-floor-480-postfix/`
- Modern 430 px audit: `test-results/human-e2e/2026-07-09/text-pressure-120-modern-430-postfix/`
- Modern 390 px audit: `test-results/human-e2e/2026-07-09/text-pressure-120-modern-390-postfix/`

## Minimal Fix

- Shelf no-match lifts the compact manual recovery row so `Add it by hand` is not clipped at the support floor.
- Shelf manual add moves optional Ingredients below the sticky Continue footer on compact and split-short text-pressure phones.
- Settings Notifications moves the lower promotional switch section below the first viewport on short supported phones.
- Settings Privacy keeps direct-entry policy/data rows below the floating tab bar on narrow and modern supported phones.
- Skin Notes applies modern-phone spacing so the later Sunscreen section does not peek as a partial target.
- Recommendation Preferences moves the Texture chip group below the first 390 x 844 / 120% viewport.

## Verification Flow After Fix

1. Run focused source-contract tests for Shelf, Settings, Community, and Recommendation Preferences.
2. Re-run the 49-route text-pressure audit at 320 x 568 / 120%.
3. Re-run the same audit at 320 x 480 / 120%, 390 x 844 / 120%, and 430 x 932 / 120%.

## Post-Fix Evidence

- `npm --workspace apps/mobile run test -- src/features/settings/settingsRoutes.test.ts src/features/shelf/shelfRoutes.test.ts src/features/community/communityRoutes.test.ts`
- `npm --workspace apps/mobile run test -- src/features/recommendations/recommendationRoutes.test.ts`
- `test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/report.md`
- `test-results/human-e2e/2026-07-09/text-pressure-120-support-floor-480-postfix/report.md`
- `test-results/human-e2e/2026-07-09/text-pressure-120-modern-430-postfix/report.md`
- `test-results/human-e2e/2026-07-09/text-pressure-120-modern-390-postfix/report.md`

All four final sweeps passed 49 / 49 routes with zero clipped visible controls, zero sub-44 px visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs.

## Remaining Risk

- Native iOS/Android Dynamic Type, VoiceOver, TalkBack, keyboard behavior, camera hardware, and hardware safe-area rendering remain device QA.
