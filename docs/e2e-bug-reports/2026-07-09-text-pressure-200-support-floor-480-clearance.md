# E2E Bug Report: 320 x 480 200% support-floor text-pressure clearance

Severity: High
Surface: Expo web
Environment: Headless Chrome, Expo web, 320 x 480 viewport, 200% and 170% text pressure
Feature: Launch-floor accessibility text layout across settings, recommendations, Ask, Shelf, and community recovery routes
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Run the Expo web text-pressure route audit at 320 x 480 with `TEXT_PRESSURE_SCALE=2`.
2. Inspect all 49 direct-entry routes for clipped visible controls, sub-44 px visible targets, blocked center hit-tests, horizontal overflow, and disallowed browser logs.
3. Re-run the same route set at `TEXT_PRESSURE_SCALE=1.7` after fixes to catch shared support-floor regressions.

## Expected Result

Visible controls remain complete, readable, 44 px or taller where applicable, and center-hit-testable at the accepted launch floor. Lower-priority actions may move below the first viewport, but no visible row, chip, prompt, or recovery action should appear as a partial bottom-edge target.

## Actual Result

The current-source sweeps repeatedly exposed support-floor pressure in `/settings/privacy`, `/settings/subscription`, `/recommendations/preferences`, `/ask`, `/shelf/no-match`, `/community/note/missing-note-e2e`, and `/recommendations/stale-local-rec`. Failures included privacy direct-entry rows peeking into the floating tab-bar zone, subscription policy rows clipped below the viewport, value chips peeking at the bottom edge, oversized Ask prompt copy, stacked Shelf no-match actions, and missing-note or recommendation headers that spent too much first-viewport height.

## Evidence

- Intermediate 200% failing sweeps: `test-results/human-e2e/2026-07-09/text-pressure-200-support-floor-480-postfix-9/` and `test-results/human-e2e/2026-07-09/text-pressure-200-support-floor-480-postfix-11/`
- Intermediate 170% failing sweeps: `test-results/human-e2e/2026-07-09/text-pressure-170-support-floor-480-postfix-12/` and `test-results/human-e2e/2026-07-09/text-pressure-170-support-floor-480-postfix-14/`
- UI snapshots: route JSON files, PNGs, and `failures.json` in the evidence directories above.

## Frequency

- Always on the affected route and text-pressure combination before the fix.

## Scope

- Affected route/screen: `/settings/privacy`, `/settings/subscription`, `/recommendations/preferences`, `/recommendations/stale-local-rec`, `/ask`, `/shelf/no-match`, and `/community/note/missing-note-e2e`
- Affected account or fixture: seeded local Expo web fixtures used by `scripts/e2e/text-pressure-route-audit.mjs`
- External service involved: No
- Destructive action involved: No

## Suspected Cause

The existing compact branches had been tuned for 320 x 568 and taller modern phones. At the accepted 320 x 480 floor with 170% to 200% text pressure, full visible labels, subtitles, hints, three-action recovery stacks, and long headers consumed too much first-viewport height, turning secondary controls into partial or blocked bottom-edge targets.

## Minimal Fix Recommendation

- Use exact support-floor branches for copy and spacing instead of broad compact-phone branches.
- Keep full accessibility labels while shortening visible support-floor labels where text pressure would otherwise wrap into multiple rows.
- Suppress nonessential hints and subtitles at the launch floor.
- Keep legal, restore, privacy, and destructive account actions complete and hit-testable, or fully below the first viewport until scroll.
- Lock the behavior with focused route-contract tests for Ask, Settings, Shelf, Recommendations, and Community.

## Verification Flow After Fix

1. Run focused route contracts for Ask, Settings, Shelf, Recommendation Preferences, and Community.
2. Re-run the full 49-route text-pressure audit at 320 x 480 / 200%.
3. Re-run the full 49-route text-pressure audit at 320 x 480 / 170%.

## Post-Fix Evidence

- Focused contracts: `npm --workspace apps/mobile run test -- src/features/ask/routeContract.test.ts src/features/settings/settingsRoutes.test.ts src/features/shelf/shelfRoutes.test.ts src/features/recommendations/recommendationRoutes.test.ts src/features/community/communityRoutes.test.ts`
- Final 200% screenshot/report set: `test-results/human-e2e/2026-07-09/text-pressure-200-support-floor-480-postfix-12/`
- Final 170% screenshot/report set: `test-results/human-e2e/2026-07-09/text-pressure-170-support-floor-480-postfix-16/`

Both final audits passed 49 / 49 routes with zero clipped visible controls, zero sub-44 px visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs.

## Remaining Risk

- Native iOS/Android Dynamic Type, VoiceOver, TalkBack, keyboard behavior, camera hardware, store sheets, and hardware safe-area rendering remain device QA.
