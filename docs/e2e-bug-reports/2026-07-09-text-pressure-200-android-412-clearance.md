# E2E Bug Report: Android 412px text-pressure tab and privacy clearance

Severity: Medium
Surface: Expo web
Environment: Headless Chrome, Expo web, 412 x 915 viewport, 200% text pressure
Feature: Floating tab bar and Settings privacy direct entry
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Run the 49-route text-pressure audit at 412 x 915 with `TEXT_PRESSURE_SCALE=2`.
2. Open `/settings/privacy` through the route sweep.
3. Inspect visible text overflow and visible control hit-test results.

## Expected Result

All 49 direct-entry routes should have zero clipped visible controls, zero blocked hit centers, zero text overflow, zero horizontal overflow, and zero disallowed browser logs.

## Actual Result

The first sweep failed `/settings/privacy` because the floating tab bar rendered the visible `Progress` label at full length, overflowing its label box by 3 px. After the compact label fix, the full route sequence exposed a second `/settings/privacy` issue where `Withdraw health-data consent` could land partly under the floating tab bar after route-order scroll state.

## Evidence

- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-412-915-current/settings-privacy.json`
- Screenshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-412-915-current/settings-privacy.png`
- Follow-up failure: `test-results/human-e2e/2026-07-09/text-pressure-200-android-412-915-postfix/failures.json`
- Terminal transcript: `npm run e2e:text-pressure`

## Frequency

- Always for the tab label on the first 412 x 915 / 200% sweep.
- Reproducible for the privacy row during the full multi-route sequence before the scroll-anchor fix.

## Scope

- Affected route/screen: `/settings/privacy`, floating bottom tab bar.
- Affected account or fixture: local Expo web E2E fixture.
- External service involved: none.
- Destructive action involved: none.

## Suspected Cause

The tab bar compact-label breakpoint stopped at 390 px, leaving 412 px Android-class phones with a 98.5 px tab slot where `Progress` overflowed under 200% text pressure. Separately, the privacy direct-entry scroll relied on an effect that could run before the currently measured privacy card Y was available during a multi-route sequence.

## Minimal Fix Recommendation

Use the compact visible `Prog.` label through 414 px while preserving the full `Progress tab` accessibility label. Re-scroll privacy direct entries from the freshly measured privacy card layout Y so stale route-order scroll state cannot leave destructive privacy actions under the floating bar.

## Verification Flow After Fix

1. Re-run `/settings/privacy` at 412 x 915 / 200% text pressure.
2. Re-run the full 49-route 412 x 915 / 200% text-pressure audit.
3. Re-run the tab bar geometry E2E harness with the new 412 x 915 viewport.

## Post-Fix Evidence

- Focused privacy route: `test-results/human-e2e/2026-07-09/text-pressure-200-android-412-915-privacy-postfix/`
- Full 49-route pass: `test-results/human-e2e/2026-07-09/text-pressure-200-android-412-915-postfix2/`
- Tab bar geometry pass: `test-results/human-e2e/2026-07-09/navigation-tabbar-geometry-412-current/`

## Remaining Risk

- Native iOS/Android Dynamic Type, screen-reader, keyboard, safe-area, camera, notification, and store-sheet QA remain device gates.
