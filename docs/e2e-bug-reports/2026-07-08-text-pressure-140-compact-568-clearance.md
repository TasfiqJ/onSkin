# E2E Bug Report: 140% compact text-pressure controls clipped

Severity: High
Surface: Expo web
Environment: Headless Chrome via `npm run e2e:text-pressure`, 320 x 568 viewport, 140% text pressure
Feature: Subscription paywalls and recommendation preferences
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Run the 49-route text-pressure audit at 320 x 568 with `TEXT_PRESSURE_SCALE=1.4`.
2. Inspect `/paywall/upsell?feature=full_routine`, Pro-gated routine routes, and `/recommendations/preferences`.
3. Check visible controls for clipping, blocked hit centers, sub-44 px visible targets, text overflow, and horizontal overflow.

## Expected Result

All visible controls are complete, readable, at least 44 pt in both dimensions, and center-hit-testable. Lower-priority controls should either be fully visible or deliberately below the first viewport until scroll.

## Actual Result

The first sweep clipped the direct upsell `Start free trial` CTA below the viewport. Follow-up sweeps exposed `/recommendations/preferences` budget/texture chips peeking as partial controls and ProGate routine paywalls where `Maybe later` blocked `Restore` and the monthly-equivalent price overflowed.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/text-pressure-140-compact-568-audit-current/paywall-upsell-feature-full-routine.png`
- Screenshot: `test-results/human-e2e/2026-07-08/text-pressure-140-compact-568-postfix-2/routine-plan.png`
- Screenshot: `test-results/human-e2e/2026-07-08/text-pressure-140-compact-568-postfix-2/recommendations-preferences.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/text-pressure-140-compact-568-audit-current/paywall-upsell-feature-full-routine.json`
- UI snapshot: `test-results/human-e2e/2026-07-08/text-pressure-140-compact-568-postfix-2/failures.json`
- Terminal transcript: `npm run e2e:text-pressure`

## Frequency

- Always under the 320 x 568 / 140% text-pressure profile before the fixes.

## Scope

- Affected route/screen: `/paywall/upsell?feature=full_routine`, Pro-gated routine routes such as `/routine/plan` and `/routine/tolerance`, and `/recommendations/preferences`.
- Affected account or fixture: Expo web E2E fixture with local preview entitlement/store data.
- External service involved: None.
- Destructive action involved: No.

## Suspected Cause

The compact paywall density handled 120-130% and ultra-short heights, but a normal 320 x 568 phone at 140% text scale still rendered nonessential body copy, monthly-equivalent pricing, and a text dismiss action in the first viewport. Recommendation Preferences also allowed lower chip groups to begin at the viewport edge instead of starting fully below the fold.

## Minimal Fix Recommendation

Add a narrow-short density tier for 320 px short paywalls: use an icon dismiss, omit nonessential body copy, hide monthly-equivalent labels, keep the annual price and primary CTA tight and one-line where needed, and move lower Recommendation Preferences chip groups fully below the first viewport without stretching visible chip hit targets.

## Verification Flow After Fix

1. Re-run the same 49-route audit at 320 x 568 with `TEXT_PRESSURE_SCALE=1.4`.
2. Confirm direct upsell, ProGate routine paywalls, and recommendation preference chips no longer report clipped controls, blocked centers, sub-44 targets, or text overflow.
3. Run focused route-contract tests for subscription paywalls and recommendations.

## Post-Fix Evidence

- Screenshot/UI snapshots: `test-results/human-e2e/2026-07-08/text-pressure-140-compact-568-postfix-3/`
- Report: `test-results/human-e2e/2026-07-08/text-pressure-140-compact-568-postfix-3/report.md`
- Latest screenshot/UI snapshots: `test-results/human-e2e/2026-07-08/text-pressure-140-compact-568-postfix-7/`
- Latest report: `test-results/human-e2e/2026-07-08/text-pressure-140-compact-568-postfix-7/report.md`
- Terminal transcript: `npm --workspace apps/mobile run test -- src/features/subscription/paywallMobileContracts.test.ts src/features/recommendations/recommendationRoutes.test.ts`

## Remaining Risk

- Native iOS/Android Dynamic Type, VoiceOver, TalkBack, keyboard, StoreKit/Play Billing, and hardware safe-area behavior still require device QA.
