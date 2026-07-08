# E2E Bug Report: 320 x 370 / 360 130% text-pressure route clearance

Severity: Medium
Surface: Expo web
Environment: Headless Chrome, Expo web, 320 x 370 and 320 x 360 viewports, 130% text pressure
Feature: Settings notifications/timing, Shelf recovery/manual add, Skin Notes, contextual ProGate, direct upsell, Recommendation Preferences
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Run the Expo web text-pressure route audit at 320 x 370.
2. Set text pressure to 130%.
3. Inspect all 49 direct-entry routes for clipped visible controls, sub-44 px visible targets, blocked center hit-tests, horizontal overflow, and disallowed browser logs.
4. Repeat at 320 x 360 to stress the same sub-380 px breakpoint.

## Expected Result

Visible controls remain complete, readable, 44 px or taller where applicable, and center-hit-testable. Lower-priority optional controls may move below the first viewport, but they must not peek as tiny partial targets.

## Actual Result

The first 320 x 370 / 130% sweep found two failures:

- `/settings/notifications`: the `Progress-photo nudge` switch peeked by about 4 px at the viewport bottom.
- `/shelf/manual`: the optional `Ingredients` textarea peeked under the fixed Continue footer and its hit center resolved to `Continue`.

The harder 320 x 360 / 130% follow-up also exposed first-viewport partial targets in `/settings/timing`, `/shelf/no-match`, contextual ProGate routes, `/paywall/upsell`, `/recommendations/preferences`, and `/community`.

## Evidence

- Initial failing sweep: `test-results/human-e2e/2026-07-08/text-pressure-130-micro-short-370-current/`
- Final passing sweep: `test-results/human-e2e/2026-07-08/text-pressure-130-micro-short-370-postfix/`
- Harder final passing sweep: `test-results/human-e2e/2026-07-08/text-pressure-130-ultra-short-360-postfix-4/`
- Latest direct-upsell passing sweep: `test-results/human-e2e/2026-07-08/text-pressure-130-ultra-short-360-postfix-5/`
- Latest Recommendation Preferences passing sweep: `test-results/human-e2e/2026-07-08/text-pressure-130-ultra-short-360-postfix-6/`
- Terminal transcript: `npm run e2e:text-pressure`

## Frequency

- Always in the affected 320 x 370 / 130% route audit before the micro-short density fixes.

## Scope

- Affected route/screen: `/settings/notifications`, `/settings/timing`, `/shelf/manual`, `/shelf/no-match`, contextual ProGate routes, `/paywall/upsell`, `/recommendations/preferences`, `/community`.
- Affected account or fixture: Local Expo web fixtures used by `scripts/e2e/text-pressure-route-audit.mjs`.
- External service involved: None.
- Destructive action involved: No.

## Suspected Cause

The previous split-short spacing was tuned down to 320 x 390. At 320 x 370 with 130% text pressure, lower-priority controls were pushed just far enough to become tiny partial visible targets at the viewport bottom.

## Minimal Fix

- Added a micro-short notifications band below 380 px that tightens the header, section labels, and scroll padding, keeps visible switches complete, and moves `Progress-photo nudge` fully below the first viewport.
- Added a micro-short timing density so quiet-hours controls stay complete.
- Increased the split-short Shelf manual spacing before the optional Ingredients textarea so the fixed Continue footer no longer intercepts the textarea center.
- Tightened Shelf no-match recovery so lower-priority manual fallback no longer peeks as a partial target.
- Tightened sub-380 px contextual ProGate paywalls by dropping nonessential body copy and reducing price/CTA spacing while preserving compliance and the 48 px CTA.
- Tightened the direct contextual upsell sheet below 360 px width by dropping nonessential body copy/monthly-equivalent price, scaling the annual price, and preserving the compact compliance/header controls plus 48 px CTA.
- Pushed short-height Recommendation Preferences budget and texture sections below the first viewport so visible value chips stay complete and lower-priority chips do not peek as partial targets.
- Pushed later Skin Notes topic sections below the first viewport on micro-short screens.

## Verification Flow After Fix

1. Run focused settings, shelf, community, recommendation, and subscription route contract tests.
2. Re-run the full 49-route text-pressure audit at 320 x 360 / 130%.
3. Re-run the full 49-route text-pressure audit at 320 x 370 / 130%.

## Post-Fix Evidence

- Focused contracts: `npm --workspace apps/mobile run test -- communityRoutes settingsRoutes shelfRoutes recommendationRoutes paywallMobileContracts`
- Screenshot/report set: `test-results/human-e2e/2026-07-08/text-pressure-130-micro-short-370-postfix/`
- UI report: `test-results/human-e2e/2026-07-08/text-pressure-130-micro-short-370-postfix/report.md`
- Harder screenshot/report set: `test-results/human-e2e/2026-07-08/text-pressure-130-ultra-short-360-postfix-4/`
- Harder UI report: `test-results/human-e2e/2026-07-08/text-pressure-130-ultra-short-360-postfix-4/report.md`
- Direct-upsell screenshot/report set: `test-results/human-e2e/2026-07-08/text-pressure-130-ultra-short-360-postfix-5/`
- Direct-upsell UI report: `test-results/human-e2e/2026-07-08/text-pressure-130-ultra-short-360-postfix-5/report.md`
- Recommendation Preferences screenshot/report set: `test-results/human-e2e/2026-07-08/text-pressure-130-ultra-short-360-postfix-6/`
- Recommendation Preferences UI report: `test-results/human-e2e/2026-07-08/text-pressure-130-ultra-short-360-postfix-6/report.md`

The final audits passed 49 / 49 routes with zero clipped visible controls, zero sub-44 px visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs.

## Remaining Risk

- Native iOS/Android Dynamic Type, VoiceOver, TalkBack, keyboard behavior, camera hardware, and hardware safe-area rendering remain device QA.
