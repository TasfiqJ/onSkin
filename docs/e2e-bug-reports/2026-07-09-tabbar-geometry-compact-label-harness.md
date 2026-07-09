# E2E Bug Report: Tab Bar Geometry Harness Expected Stale Progress Label

Severity: Low
Surface: Expo web
Environment: Headless Chrome via `npm run e2e:tabbar-geometry`
Feature: Bottom tab navigation
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Run `npm run e2e:tabbar-geometry`.
2. Let the script start Expo web, open Chrome CDP, and inspect the 320 x 568 tab bar.

## Expected Result

The runner should accept the compact visible `Prog.` label through the 414 px
compact-phone band while still requiring the full `Progress tab` accessibility
label.

## Actual Result

The app rendered the intended compact `Prog.` label, but the runner initially
still looked for visible `Progress` text and failed with `320x568: Progress
label is not rendered directly`. A follow-up 412 px pass also exposed that the
snapshot validation omitted each tab's route, so validation could fall back to
the stale full-label expectation after the browser snapshot found `Prog.`.

## Evidence

- UI snapshot: `test-results/human-e2e/2026-07-09/navigation-tabbar-geometry-current/320x568-today.json`
- Follow-up summary: `test-results/human-e2e/2026-07-09/navigation-tabbar-412-compact-current/summary.json`
- Screenshot: `test-results/human-e2e/2026-07-09/navigation-tabbar-412-compact-current/412x915-progress.png`
- Logs: `test-results/human-e2e/2026-07-09/navigation-tabbar-412-compact-current/expo-web.log`
- Terminal transcript: `npm run e2e:tabbar-geometry`

## Frequency

- Always

## Scope

- Affected route/screen: `(tabs)` bottom tab bar through the 414 px compact-phone width band
- Affected account or fixture: local Expo web, Pro fixture entitlement
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The tab bar was updated to abbreviate only the visible Progress label on compact
phone geometry, but the durable tab bar E2E script still asserted the previous
full visible label. The snapshot schema also failed to carry `route` into
validation, which made the route-specific compact-label expectation fragile.

## Minimal Fix Recommendation

Teach `scripts/e2e/tabbar-geometry.mjs` to distinguish the stable tab identity
from the viewport-specific visible label, and preserve each tab's route in the
captured snapshot before validation. Keep asserting the full accessibility label
so screen readers still expose `Progress tab`.

## Verification Flow After Fix

1. Run `npm run e2e:tabbar-geometry`.
2. Confirm 320 x 568, 390 x 568, and 412 x 915 snapshots pass for Today,
   Progress, Shelf, and You.
3. Confirm the Progress tab records visible `Prog.` and aria `Progress tab`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-09/navigation-tabbar-412-compact-current/412x915-progress.png`
- UI snapshot: `test-results/human-e2e/2026-07-09/navigation-tabbar-412-compact-current/summary.json`
- Logs: `test-results/human-e2e/2026-07-09/navigation-tabbar-412-compact-current/browser-warn-error-logs.json`

## Remaining Risk

- Untested branches: native iOS/Android Dynamic Type and screen-reader traversal
- Missing fixtures: native accessibility tree snapshots
- Follow-up needed: device QA for hardware safe areas and platform text settings
