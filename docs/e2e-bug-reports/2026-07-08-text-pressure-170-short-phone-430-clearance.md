# E2E Bug Report: 170 percent short-phone controls clipped

Severity: Medium
Surface: Expo web
Environment: Headless Chrome via `npm run e2e:text-pressure`, 320 x 430 viewport, text pressure scale 1.7
Feature: Short-phone Dynamic Type and first-viewport clearance
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Set `TEXT_PRESSURE_VIEWPORT_WIDTH=320`, `TEXT_PRESSURE_VIEWPORT_HEIGHT=430`, and `TEXT_PRESSURE_SCALE=1.7`.
2. Run `npm run e2e:text-pressure`.
3. Inspect failed route evidence for clipped controls, blocked centers, text overflow, horizontal overflow, and browser logs.

## Expected Result

All 49 route entries keep visible controls complete, 44 px or larger, center-hit-testable, and within the 320 px viewport under extreme text pressure on a short phone.

## Actual Result

The first audit failed `/community` and `/settings/notifications`. The Skin Notes second topic card peeked into the bottom of the viewport as a 26 px visible target, and the `Progress-photo nudge` switch was only partially visible. A follow-up rerun exposed `/recommendations/preferences`, where the `Non-comedogenic` value chip was visible for only about 18 px at the viewport bottom.

## Evidence

- Screenshot packet: `test-results/human-e2e/2026-07-08/text-pressure-170-short-phone-430-audit-current/`
- UI snapshot: `test-results/human-e2e/2026-07-08/text-pressure-170-short-phone-430-audit-current/failures.json`
- Follow-up failed snapshot: `test-results/human-e2e/2026-07-08/text-pressure-170-short-phone-430-postfix/failures.json`
- Terminal transcript: `npm run e2e:text-pressure` first failed with `2 text-pressure route(s) failed.`, then failed with `1 text-pressure route(s) failed.` during the intermediate rerun.

## Frequency

- Always at 320 x 430 with 170 percent text pressure before the short-phone threshold fixes.

## Scope

- Affected route/screen: `/community`, `/settings/notifications`, and `/recommendations/preferences`.
- Affected account or fixture: local Expo web route fixtures used by `scripts/e2e/text-pressure-route-audit.mjs`.
- External service involved: none.
- Destructive action involved: none.

## Suspected Cause

The 170 percent compact sweep at 320 x 568 did not cover this shorter first viewport. Several sub-460 px layouts still used the less aggressive split/deferred thresholds, allowing the next low-priority row or card to peek into the visible region.

## Minimal Fix Recommendation

Extend the existing ultra-short split/deferred patterns to the 320 x 430 pressure band: push later Skin Notes sections below the fold on ultra-short narrow phones, move the third notification nudge row below the fold below 460 px, and split Recommendation Preferences value chips below 460 px.

## Verification Flow After Fix

1. Run focused route contract tests for Community, Settings Notifications, and Recommendations.
2. Re-run the same 320 x 430 / 170 percent route sweep.
3. Confirm 49 routes pass with zero failed routes, zero disallowed logs, and zero visible control issues.

## Post-Fix Evidence

- Screenshot packet: `test-results/human-e2e/2026-07-08/text-pressure-170-short-phone-430-postfix-2/`
- UI snapshot: `test-results/human-e2e/2026-07-08/text-pressure-170-short-phone-430-postfix-2/summary.json`
- Terminal transcript: `npm run e2e:text-pressure` passed and printed the final evidence path.

## Remaining Risk

- Untested branches: real native iOS and Android Dynamic Type rendering, keyboard behavior, VoiceOver/TalkBack traversal, and hardware safe-area combinations.
- Missing fixtures: physical device builds with real OS text settings.
- Follow-up needed: keep Phase 5 native-device QA as the source of truth for iOS/Android Dynamic Type and accessibility proof.
