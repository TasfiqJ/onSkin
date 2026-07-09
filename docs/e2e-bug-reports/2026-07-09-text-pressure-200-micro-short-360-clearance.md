# E2E Bug Report: 320 x 360 200% text-pressure route clearance

Severity: High
Surface: Expo web
Environment: Headless Chrome, Expo web, 320 x 360 viewport, 200% text pressure
Feature: Micro-short phone layout across paywalls, settings privacy, Shelf recovery, Recommendation detail, and notification density
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Run the Expo web text-pressure route audit at 320 x 390 and 200% text pressure.
2. Repeat at 320 x 360 and 200% text pressure.
3. Inspect all 49 direct-entry routes for clipped visible controls, sub-44 px visible targets, blocked center hit-tests, horizontal overflow, and disallowed browser logs.

## Expected Result

Visible controls are complete, readable, 44 px or taller where applicable, and center-hit-testable. Controls that cannot fit in the first viewport move fully below the first viewport instead of appearing as tiny partial targets behind fixed chrome.

## Actual Result

The 320 x 390 / 200% sweep passed, but the 320 x 360 / 200% sweep initially failed 12 routes. The failures centered on:

- Contextual ProGate and direct upsell CTAs peeking into fixed chrome or resolving center hits to surrounding containers.
- `/settings/privacy` showing `Withdraw health-data consent` in the floating tab-bar hit zone.
- `/settings/notifications` exposing lower-priority nudge switches as partial targets.
- `/shelf/no-match` exposing secondary recovery rows as bottom slivers.
- `/recommendations/stale-local-rec` allowing the compact header label to overflow under text pressure.
- `/shelf` compact filter labels crowding the 320 px filter row.

## Evidence

- 320 x 390 passing audit: `test-results/human-e2e/2026-07-08/text-pressure-200-split-short-390-audit-current/`
- Initial 320 x 360 failing audit: `test-results/human-e2e/2026-07-08/text-pressure-200-micro-short-360-audit-current/`
- Final 320 x 360 passing audit: `test-results/human-e2e/2026-07-08/text-pressure-200-micro-short-360-postfix-8/`
- Terminal transcript: `npm run e2e:text-pressure`

## Suspected Cause

The previous micro-short density bands were tuned for 130-170% text pressure and taller compact heights. At 200% text pressure on a 360 px tall viewport, several layouts either kept too much primary copy in the first viewport or relied on height-specific spacing that did not consistently match the Expo web route timing.

## Minimal Fix

- Contextual ProGate and direct upsell sheets now use micro-short title/price fitting and one-line CTA text while keeping compliance controls reachable.
- Direct upsell store-unavailable CTAs stay tappable so route-owned feedback can run instead of showing a dead disabled control.
- Settings Privacy defers the destructive health-data withdrawal row below the first viewport on narrow direct privacy entries.
- Settings Notifications moves lower-priority nudge rows fully below the first viewport on sub-380 px screens.
- Shelf no-match defers secondary recovery rows below the first viewport while keeping Search catalog visible and the other recovery actions scroll-reachable.
- Stale recommendation detail headers shrink to one line instead of creating horizontal overflow.
- Shelf compact filters use the shorter visible `7d` label while preserving the full Expiring accessibility label.

## Verification Flow After Fix

1. Run focused source contracts for Shelf, Settings, Recommendations, and paywalls.
2. Re-run the full 49-route text-pressure audit at 320 x 360 / 200%.

## Post-Fix Evidence

- Focused contracts: `npm --workspace apps/mobile run test -- shelfRoutes.test.ts settingsRoutes.test.ts paywallMobileContracts.test.ts recommendationRoutes.test.ts`
- Final screenshot/report set: `test-results/human-e2e/2026-07-08/text-pressure-200-micro-short-360-postfix-8/`
- Final UI report: `test-results/human-e2e/2026-07-08/text-pressure-200-micro-short-360-postfix-8/report.md`

The final audit passed 49 / 49 routes with zero clipped visible controls, zero sub-44 px visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs.

## Remaining Risk

- Native iOS/Android Dynamic Type, VoiceOver, TalkBack, keyboard behavior, camera hardware, RevenueCat store sheets, and hardware safe-area rendering remain device QA.
