# E2E Bug Report: 320 x 370 130% text-pressure route clearance

Severity: Medium
Surface: Expo web
Environment: Headless Chrome, Expo web, 320 x 370 viewport, 130% text pressure
Feature: Settings notifications and Shelf manual add
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Run the Expo web text-pressure route audit at 320 x 370.
2. Set text pressure to 130%.
3. Inspect all 49 direct-entry routes for clipped visible controls, sub-44 px visible targets, blocked center hit-tests, horizontal overflow, and disallowed browser logs.

## Expected Result

Visible controls remain complete, readable, 44 px or taller where applicable, and center-hit-testable. Lower-priority optional controls may move below the first viewport, but they must not peek as tiny partial targets.

## Actual Result

The first 320 x 370 / 130% sweep found two failures:

- `/settings/notifications`: the `Progress-photo nudge` switch peeked by about 4 px at the viewport bottom.
- `/shelf/manual`: the optional `Ingredients` textarea peeked under the fixed Continue footer and its hit center resolved to `Continue`.

## Evidence

- Initial failing sweep: `test-results/human-e2e/2026-07-08/text-pressure-130-micro-short-370-current/`
- Final passing sweep: `test-results/human-e2e/2026-07-08/text-pressure-130-micro-short-370-postfix/`
- Terminal transcript: `npm run e2e:text-pressure`

## Frequency

- Always in the affected 320 x 370 / 130% route audit before the micro-short density fixes.

## Scope

- Affected route/screen: `/settings/notifications`, `/shelf/manual`.
- Affected account or fixture: Local Expo web fixtures used by `scripts/e2e/text-pressure-route-audit.mjs`.
- External service involved: None.
- Destructive action involved: No.

## Suspected Cause

The previous split-short spacing was tuned down to 320 x 390. At 320 x 370 with 130% text pressure, lower-priority controls were pushed just far enough to become tiny partial visible targets at the viewport bottom.

## Minimal Fix

- Added a micro-short notifications band below 380 px that tightens the header, section labels, and scroll padding, keeps visible switches complete, and moves `Progress-photo nudge` fully below the first viewport.
- Increased the split-short Shelf manual spacing before the optional Ingredients textarea so the fixed Continue footer no longer intercepts the textarea center.

## Verification Flow After Fix

1. Run focused settings and shelf route contract tests.
2. Re-run the full 49-route text-pressure audit at 320 x 370 / 130%.

## Post-Fix Evidence

- Focused contracts: `npm --workspace apps/mobile run test -- settingsRoutes shelfRoutes`
- Screenshot/report set: `test-results/human-e2e/2026-07-08/text-pressure-130-micro-short-370-postfix/`
- UI report: `test-results/human-e2e/2026-07-08/text-pressure-130-micro-short-370-postfix/report.md`

The final audit passed 49 / 49 routes with zero clipped visible controls, zero sub-44 px visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs.

## Remaining Risk

- Native iOS/Android Dynamic Type, VoiceOver, TalkBack, keyboard behavior, camera hardware, and hardware safe-area rendering remain device QA.
