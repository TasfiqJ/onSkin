# E2E Bug Report: 170 percent compact text-pressure controls clipped

Severity: Medium
Surface: Expo web
Environment: Headless Chrome via `npm run e2e:text-pressure`, 320 x 568 viewport, text pressure scale 1.7
Feature: Compact-phone Dynamic Type and first-viewport clearance
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Set `TEXT_PRESSURE_VIEWPORT_WIDTH=320`, `TEXT_PRESSURE_VIEWPORT_HEIGHT=568`, and `TEXT_PRESSURE_SCALE=1.7`.
2. Run `npm run e2e:text-pressure`.
3. Inspect failed route evidence for clipped controls, blocked centers, text overflow, and horizontal overflow.

## Expected Result

All 49 route entries keep visible controls complete, 44 px or larger, center-hit-testable, and within the 320 px viewport under extreme text pressure.

## Actual Result

The first audit failed 6 routes. The floating tab bar's visible `Progress` label overflowed, Shelf's `Expiring` filter clipped, and Shelf no-match exposed a tiny partial fallback row. Follow-up reruns also exposed compact edge cases in Shelf scan fallback rows, Shelf manual optional Ingredients under the fixed Continue footer, the compact Ask header, and Skin Notes lower-card and missing-note recovery clearance.

## Evidence

- Screenshot packet: `test-results/human-e2e/2026-07-08/text-pressure-170-compact-568-audit-current/`
- UI snapshot: `test-results/human-e2e/2026-07-08/text-pressure-170-compact-568-audit-current/failures.json`
- Terminal transcript: `npm run e2e:text-pressure` failed with `6 text-pressure route(s) failed.`

## Frequency

- Always at 320 x 568 with 170 percent text pressure before the compact-density fixes.

## Scope

- Affected route/screen: `/today`, `/today?routine=PM`, `/progress`, `/settings/privacy`, `/shelf`, `/shelf/no-match`; follow-up reruns covered `/shelf/scan`, `/shelf/manual`, `/ask`, `/community`, and `/community/note/missing-note-e2e`.
- Affected account or fixture: local Expo web route fixtures used by `scripts/e2e/text-pressure-route-audit.mjs`.
- External service involved: none.
- Destructive action involved: none.

## Suspected Cause

Several compact layouts were tuned for 120 to 150 percent pressure but not the 170 percent line-height expansion. Lower-priority actions were still allowed to peek into the first viewport, and some compact labels used full desktop copy inside fixed-width controls.

## Minimal Fix Recommendation

Use compact visible labels while preserving full accessibility labels, move optional/lower-priority controls fully below the first viewport under narrow compact pressure, and tighten missing-state recovery layouts so the primary exit remains complete.

## Verification Flow After Fix

1. Run focused route contract tests for Ask, Community, Shelf, navigation, and chips.
2. Re-run the same 320 x 568 / 170 percent route sweep.
3. Confirm 49 routes pass with zero failed routes, zero disallowed logs, and zero visible control issues.

## Post-Fix Evidence

- Screenshot packet: `test-results/human-e2e/2026-07-08/text-pressure-170-compact-568-postfix-9/`
- UI snapshot: `test-results/human-e2e/2026-07-08/text-pressure-170-compact-568-postfix-9/summary.json`
- Terminal transcript: `npm run e2e:text-pressure` passed and printed the final evidence path.

## Remaining Risk

- Untested branches: real native iOS and Android Dynamic Type rendering, keyboard behavior, VoiceOver/TalkBack traversal, and hardware safe-area combinations.
- Missing fixtures: physical device builds with real OS text settings.
- Follow-up needed: keep Phase 5 native-device QA as the source of truth for iOS/Android Dynamic Type and accessibility proof.
