# E2E Bug Report: 200 percent compact text-pressure controls clipped

Severity: Medium
Surface: Expo web
Environment: Headless Chrome via `npm run e2e:text-pressure`, 320 x 568 viewport, text pressure scale 2.0
Feature: Compact-phone Dynamic Type and floating-tab clearance
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Set `TEXT_PRESSURE_VIEWPORT_WIDTH=320`, `TEXT_PRESSURE_VIEWPORT_HEIGHT=568`, and `TEXT_PRESSURE_SCALE=2.0`.
2. Run `npm run e2e:text-pressure`.
3. Inspect failed route evidence for clipped controls, blocked centers, text overflow, horizontal overflow, and browser logs.

## Expected Result

All 49 route entries keep visible controls complete, 44 px or larger, center-hit-testable, and within the 320 px viewport under 200 percent text pressure.

## Actual Result

The first audit failed `/recommendations/preferences`, `/settings/notifications`, and `/settings/privacy`. The `Non-comedogenic` value chip and `Progress-photo nudge` switch peeked into the viewport as partial controls. The direct privacy entry scrolled the `Withdraw health-data consent` row so its center was blocked by the floating tab bar.

## Evidence

- Screenshot packet: `test-results/human-e2e/2026-07-08/text-pressure-200-compact-568-audit-current/`
- UI snapshot: `test-results/human-e2e/2026-07-08/text-pressure-200-compact-568-audit-current/failures.json`
- Terminal transcript: `npm run e2e:text-pressure` failed with `3 text-pressure route(s) failed.`

## Frequency

- Always at 320 x 568 with 200 percent text pressure before the compact threshold fixes.

## Scope

- Affected route/screen: `/recommendations/preferences`, `/settings/notifications`, and `/settings/privacy`.
- Affected account or fixture: local Expo web route fixtures used by `scripts/e2e/text-pressure-route-audit.mjs`.
- External service involved: none.
- Destructive action involved: none.

## Suspected Cause

The prior split/deferred thresholds covered sub-460 px and 170 percent pressure, but 200 percent text expands controls enough that 568 px compact screens need the same lower-priority deferral. The privacy direct-entry scroll target also did not account for the floating tab bar stealing the hit center of a tall destructive row.

## Minimal Fix Recommendation

Extend the existing split/deferred patterns through the full compact-short band below 600 px, and add a short-narrow privacy direct-entry scroll nudge so data-rights actions stay above the floating tab bar.

## Verification Flow After Fix

1. Run focused route contract tests for Settings and Recommendations.
2. Re-run the same 320 x 568 / 200 percent route sweep.
3. Confirm 49 routes pass with zero failed routes, zero disallowed logs, and zero visible control issues.

## Post-Fix Evidence

- Screenshot packet: `test-results/human-e2e/2026-07-08/text-pressure-200-compact-568-postfix/`
- UI snapshot: `test-results/human-e2e/2026-07-08/text-pressure-200-compact-568-postfix/summary.json`
- Terminal transcript: `npm run e2e:text-pressure` passed and printed the final evidence path.

## Remaining Risk

- Untested branches: real native iOS and Android Dynamic Type rendering, keyboard behavior, VoiceOver/TalkBack traversal, and hardware safe-area combinations.
- Missing fixtures: physical device builds with real OS text settings.
- Follow-up needed: keep Phase 5 native-device QA as the source of truth for iOS/Android Dynamic Type and accessibility proof.
