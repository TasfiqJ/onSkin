# E2E Bug Report: Supported-phone 170% text-pressure clearance

Severity: High
Surface: Expo web
Environment: Headless Chrome, Expo web, 320 x 568, 320 x 480, and 390 x 844 viewports, 170% text pressure
Feature: Supported-phone text-pressure layout across Settings Privacy and Today empty routine
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Run the Expo web text-pressure route audit with `TEXT_PRESSURE_SCALE=1.7`.
2. Sweep the current 49 direct-entry routes at 320 x 568 and the 320 x 480 launch support floor.
3. Inspect visible controls for clipping, sub-44 px visible targets, blocked center hit-tests, horizontal overflow, and disallowed browser logs.

## Expected Result

Visible controls remain complete, readable, 44 px or taller where applicable, and center-hit-testable. Lower-priority rows can start below the first viewport, but no button or settings row should peek into the floating tab-bar hit zone.

## Actual Result

- `/settings/privacy` at 320 x 568 exposed the unrelated `Reminders & notifications` row as a bottom-edge sliver.
- `/settings/privacy` at 320 x 480 exposed `Withdraw health-data consent` with its center blocked by the floating tab bar.
- `/today?routine=PM` at 320 x 568 placed the empty-routine `Add products` CTA under the floating tab bar.
- `/shelf/no-match` emitted a transient Expo web reconnect warning in one run and cleared on the next full rerun.

## Evidence

- Initial compact audit: `test-results/human-e2e/2026-07-09/text-pressure-170-compact-568-current/`
- Initial support-floor audit: `test-results/human-e2e/2026-07-09/text-pressure-170-support-floor-480-postfix/`
- Follow-up compact audit: `test-results/human-e2e/2026-07-09/text-pressure-170-compact-568-postfix-2/`

## Minimal Fix

- Settings Privacy direct entries omit the unrelated Reminders card so direct privacy recovery starts on the privacy surface only.
- Settings Privacy adds a support-floor-only withdraw margin so destructive health-data consent actions stay fully below the first 320 x 480 viewport until the user scrolls.
- Today empty-routine cards add a short-phone density tier that keeps the title and `Add products` CTA, drops only the secondary helper sentence, and trims CTA spacing while preserving a 52 px minimum button height.

## Verification Flow After Fix

1. Run focused source-contract tests for Today and Settings.
2. Re-run the 49-route text-pressure audit at 320 x 568 / 170%.
3. Re-run the same audit at 320 x 480 / 170% and 390 x 844 / 170%.

## Post-Fix Evidence

- `npm --workspace apps/mobile run test -- src/features/today/todayRoute.test.ts`
- `npm --workspace apps/mobile run test -- src/features/settings/settingsRoutes.test.ts`
- `test-results/human-e2e/2026-07-09/text-pressure-170-compact-568-postfix-3/report.md`
- `test-results/human-e2e/2026-07-09/text-pressure-170-support-floor-480-postfix-3/report.md`
- `test-results/human-e2e/2026-07-09/text-pressure-170-modern-390-postfix-3/report.md`

All three final sweeps passed 49 / 49 routes with zero clipped visible controls, zero sub-44 px visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs.

## Remaining Risk

- Native iOS/Android Dynamic Type, VoiceOver, TalkBack, keyboard behavior, camera hardware, and hardware safe-area rendering remain device QA.
