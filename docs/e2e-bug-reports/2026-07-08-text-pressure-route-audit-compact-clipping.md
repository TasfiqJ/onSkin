# E2E Bug Report: Compact text-pressure route audit clipped visible controls

Severity: Medium
Surface: Expo web
Environment: local Expo web, headless Chrome, 320 x 568 phone viewport, 120% text pressure
Feature: compact-phone route layout
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Run `npm run e2e:text-pressure`.
2. Let the audit open the 49 current Expo web-compatible routes at 320 x 568.
3. Apply the 120% text-pressure mutation and inspect visible controls for clipping, sub-44 px visible targets, blocked center hit-tests, horizontal overflow, and unexpected browser logs.

## Expected Result

All visible user-facing controls should remain fully readable, 44 px or larger, and center-hit-testable. A control should not peek partially below the viewport or under the floating tab bar.

## Actual Result

The first audit passes found compact-phone pressure issues on settings, shelf, paywall, and recommendation routes:

- `/settings/notifications`: the Progress-photo nudge switch was partially clipped.
- `/settings/privacy`: Withdraw health-data consent sat in the floating-tabbar hit zone.
- `/shelf/no-match` and redirected `/shelf/scan`: no-match recovery rows could clip at the bottom edge.
- `/paywall/upsell?feature=full_routine` and redirected `/paywall/success`: bottom paywall actions/compliance rows clipped.
- `/recommendations/preferences`: budget and texture chips (`Premium`, then `Oil`) could become partially visible at the fold.

## Evidence

- Failed-route screenshots and JSON from the exploratory reruns: `test-results/human-e2e/2026-07-08/text-pressure-120-route-audit-current/`
- Passing full-route report: `test-results/human-e2e/2026-07-08/text-pressure-120-route-audit-current/report.md`
- Passing summary: `test-results/human-e2e/2026-07-08/text-pressure-120-route-audit-current/summary.json`

## Suspected Cause

Several compact layouts only switched to their shortest-phone density below 520 px or 460 px height. At 320 x 568 with larger text, those screens still used standard spacing, so bottom-edge controls became half-visible even though the viewport was a real small-phone size.

## Fix

- Added `npm run e2e:text-pressure` as a repeatable no-new-dependency Expo web route audit.
- Raised compact density thresholds to cover 568 px text-pressure cases for notification settings, privacy rows, shelf no-match recovery, contextual paywalls, and Recommendation Preferences.
- Moved short paywall compliance/actions into header treatment instead of leaving duplicate bottom controls at the fold.
- Kept controls at 48 px+ while trimming spacing, copy length, chip gaps, and nonessential helper text.

## Verification

- `npm --workspace apps/mobile run test -- src/features/settings/settingsRoutes.test.ts src/features/shelf/shelfRoutes.test.ts src/features/subscription/paywallMobileContracts.test.ts src/features/recommendations/recommendationRoutes.test.ts`
- `npm --workspace apps/mobile run typecheck`
- `npm --workspace apps/mobile run lint`
- `npm run e2e:text-pressure`

Post-fix `npm run e2e:text-pressure` passed all 49 audited routes at 320 x 568 with 120% text pressure: zero failed routes, zero clipped controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs.

## Remaining Risk

Native iOS/Android Dynamic Type, VoiceOver, TalkBack, keyboard, and hardware safe-area behavior still require device QA.
