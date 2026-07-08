# E2E Bug Report: 320 x 390 130% text-pressure route clearance

Severity: Medium
Surface: Expo web
Environment: Headless Chrome, Expo web, 320 x 390 viewport, 130% text pressure
Feature: Split-short phone paywalls, Shelf scan fallback, and subscription settings
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start the Expo web-compatible text-pressure route audit at 320 x 390.
2. Set text pressure to 130%.
3. Inspect all 49 direct-entry routes for clipped visible controls, sub-44 px visible targets, blocked center hit-tests, horizontal overflow, and disallowed browser logs.

## Expected Result

Visible controls remain complete, readable, 44 px or taller where applicable, and center-hit-testable. Lower-priority explanatory copy can be omitted on split-short phones, but visible controls must not peek under fixed chrome or beyond the viewport.

## Actual Result

The harsher 320 x 390 / 130% audit exposed split-short density gaps:

- `/progress`: the locked photo-timeline paywall kept the primary CTA partly inside the floating tab bar pointer zone.
- `/shelf/scan`: the third fallback row clipped below the viewport after text scaling.
- `/paywall/upsell?feature=full_routine`: the split-short header let `Maybe later` block the `Restore` hit center.
- `/settings/subscription`: the free-plan `Privacy` row peeked below the viewport.

## Evidence

- Initial failing sweep: `test-results/human-e2e/2026-07-08/text-pressure-130-split-short-390-audit-current/`
- Final passing sweep: `test-results/human-e2e/2026-07-08/text-pressure-130-split-short-390-postfix-4/`
- Terminal transcript: `npm run e2e:text-pressure`

## Frequency

- Always in the affected 320 x 390 / 130% route audit before the split-short density fixes.

## Scope

- Affected route/screen: `/progress`, `/shelf/scan`, `/paywall/upsell?feature=full_routine`, `/settings/subscription`.
- Affected account or fixture: Local Expo web fixtures used by `scripts/e2e/text-pressure-route-audit.mjs`.
- External service involved: None.
- Destructive action involved: No.

## Suspected Cause

Several split-short layouts were tuned for 120% text pressure. At 130%, secondary explanatory copy and full-width text dismiss controls consumed enough vertical or horizontal room for lower controls to clip or overlap.

## Minimal Fix Recommendation

Prioritize complete controls over secondary copy on split-short phones:

- Use a compact icon dismiss for split-short Progress and contextual upsell headers.
- Hide lower-priority Progress paywall body copy only on the split-short tabbed Progress paywall.
- Hide Shelf scan fallback subtitles only on split-short fallback rows while preserving full accessibility labels.
- Omit the subscription free-plan body below 410 px so Restore, Terms, and Privacy remain complete.

## Verification Flow After Fix

1. Run focused subscription, shelf, and settings route contract tests.
2. Re-run the full 49-route text-pressure audit at 320 x 390 / 130%.
3. Run mobile typecheck and lint before commit.

## Post-Fix Evidence

- Screenshot/report set: `test-results/human-e2e/2026-07-08/text-pressure-130-split-short-390-postfix-4/`
- UI report: `test-results/human-e2e/2026-07-08/text-pressure-130-split-short-390-postfix-4/report.md`
- Terminal transcript:
  - `npm --workspace apps/mobile run test -- src/features/settings/settingsRoutes.test.ts src/features/subscription/paywallMobileContracts.test.ts src/features/shelf/shelfRoutes.test.ts`
  - `npm run e2e:text-pressure`

The final audit passed 49 / 49 routes with zero clipped visible controls, zero sub-44 px visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs.

## Remaining Risk

- Untested branches: Native iOS/Android Dynamic Type, VoiceOver, TalkBack, keyboard behavior, camera hardware, and hardware safe-area rendering.
- Missing fixtures: Live RevenueCat, App Store, Google Play, native camera, notifications, and live Supabase.
- Follow-up needed: Repeat the split-short high-text-pressure paywall and Shelf scan flows on physical iOS and Android devices once native device QA is running.
