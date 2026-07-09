# E2E Bug Report: 430 x 932 200% supported modern-phone clearance

Severity: High
Surface: Expo web
Environment: Headless Chrome, Expo web, 430 x 932 and 390 x 844 viewports, 200% text pressure
Feature: Supported modern-phone accessibility text layout across paywalls, Skin Notes, Settings Privacy, Recommendation Preferences, and Shelf recovery
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Run the Expo web text-pressure route audit at 430 x 932 with `TEXT_PRESSURE_SCALE=2`.
2. Inspect all 49 direct-entry routes for clipped visible controls, sub-44 px visible targets, blocked center hit-tests, horizontal overflow, and disallowed browser logs.
3. Re-run the same 200% sweep at 390 x 844 after fixes that touch shared modern-phone branches.

## Expected Result

Visible controls remain complete, readable, 44 px or taller where applicable, and center-hit-testable. Lower-priority controls can move below the first viewport, but no button, chip, policy row, note card, or paywall action should appear as a partial bottom-edge target.

## Actual Result

The initial 430 x 932 current-source sweep failed contextual ProGate routes where `Restore`, `Maybe later`, or the primary CTA intersected the first-viewport bottom zone. Follow-up reruns exposed partial Skin Notes, Settings Privacy policy rows, Recommendation Preferences budget chips, and Shelf no-match manual fallback controls at the same 200% text pressure. The 390 x 844 regression sweep also caught a `Premium` budget chip peeking after the first round of fixes.

## Evidence

- Initial failing 430 audit: `test-results/human-e2e/2026-07-09/text-pressure-200-modern-430-current/`
- 430 follow-up audits: `test-results/human-e2e/2026-07-09/text-pressure-200-modern-430-postfix/`, `test-results/human-e2e/2026-07-09/text-pressure-200-modern-430-postfix-3/`, and `test-results/human-e2e/2026-07-09/text-pressure-200-modern-430-postfix-4/`
- 390 regression audit: `test-results/human-e2e/2026-07-09/text-pressure-200-modern-390-postfix-5/`
- UI snapshots: route JSON files and `failures.json` in the evidence directories above.

## Frequency

- Always on the affected viewport and text-pressure combination before the fix.

## Scope

- Affected route/screen: `/progress`, `/routine/tolerance`, `/cycle/disruption`, `/cycle/why-tonight`, `/community`, `/settings/privacy`, `/recommendations/preferences`, and `/shelf/no-match`
- Affected account or fixture: seeded local Expo web fixtures used by `scripts/e2e/text-pressure-route-audit.mjs`
- External service involved: No
- Destructive action involved: No

## Suspected Cause

The existing compact layout branches covered smaller short phones and 390 x 844 200% pressure, but 430 x 932 at 200% exposes a taller first viewport where lower-priority controls can appear as bottom slivers instead of remaining complete or starting fully below the fold.

## Minimal Fix Recommendation

- Add a dense tall text-pressure paywall tier for contextual ProGate routes.
- Defer lower-priority Skin Notes, Recommendation Preferences, and Shelf no-match recovery controls below the first viewport on tall modern text-pressure phones.
- Add direct-entry Settings Privacy spacing for the Consumer Health Privacy policy row.
- Lock the behavior with focused route-contract tests for subscription, community, settings, recommendations, and shelf.

## Verification Flow After Fix

1. Run focused route contracts for Subscription, Community, Settings, Recommendation Preferences, and Shelf.
2. Re-run the full 49-route text-pressure audit at 430 x 932 / 200%.
3. Re-run the full 49-route text-pressure audit at 390 x 844 / 200% for shared modern-phone regressions.

## Post-Fix Evidence

- Focused contracts: `npm --workspace apps/mobile run test -- src/features/subscription/paywallMobileContracts.test.ts src/features/subscription/proGatedRoutes.test.ts`
- Focused contracts: `npm --workspace apps/mobile run test -- src/features/community/communityRoutes.test.ts src/features/settings/settingsRoutes.test.ts src/features/recommendations/recommendationRoutes.test.ts src/features/shelf/shelfRoutes.test.ts`
- Final 430 screenshot/report set: `test-results/human-e2e/2026-07-09/text-pressure-200-modern-430-postfix-5/`
- Final 390 screenshot/report set: `test-results/human-e2e/2026-07-09/text-pressure-200-modern-390-postfix-7/`

Both final audits passed 49 / 49 routes with zero clipped visible controls, zero sub-44 px visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs.

## Remaining Risk

- Native iOS/Android Dynamic Type, VoiceOver, TalkBack, keyboard behavior, RevenueCat store sheets, camera hardware, and hardware safe-area rendering remain device QA.
