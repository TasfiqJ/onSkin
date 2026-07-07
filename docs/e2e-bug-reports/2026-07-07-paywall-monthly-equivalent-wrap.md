# E2E Bug Report: Paywall monthly equivalent wraps awkwardly on compact phones

Severity: Low
Surface: Expo web
Environment: Expo web, 320 x 568 phone viewport
Feature: Subscriptions and contextual paywalls
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Start Expo web and open `/progress` as a free user.
2. Set the viewport to 320 x 568.
3. Inspect the price card on the contextual photo-timeline paywall.
4. Repeat with `/routine/plan`, `/onboarding/paywall`, and `/paywall/upsell?feature=full_routine`.

## Expected Result

The annual billed amount remains the most conspicuous price, and the secondary monthly equivalent reads as a compact, one-line helper label without awkward line breaks on phone-width layouts.

## Actual Result

Before the fix, contextual paywalls rendered the secondary monthly equivalent with an explicit newline before `/mo`, producing a cramped `$4.16 /mo` two-line block on 320 px phones. The annual price was still visible, but the secondary label looked low-polish in a high-intent purchase surface.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/current-compact-sweep-19128/progress.png`
- Screenshot: `test-results/human-e2e/2026-07-07/current-compact-sweep-19128/routine-plan.png`

## Frequency

- Always on the tested compact contextual paywalls before the fix.

## Scope

- Affected route/screen: `/progress`, `/routine/plan`, `/onboarding/paywall`, `/paywall/upsell?feature=full_routine`
- Affected account or fixture: Local free-user paywall state with fallback RevenueCat pricing
- External service involved: None for the local repro
- Destructive action involved: None

## Suspected Cause

`ProGate`, the direct upsell sheet, and the onboarding paywall hardcoded newline-separated monthly equivalent labels such as `${pricePerMonthLabel}\n/mo` or `just\n${monthlyEquivalent}/mo`, forcing `/mo` onto its own line regardless of available width.

## Minimal Fix Recommendation

Render the monthly equivalent as a one-line, shrinkable secondary label such as `$4.16/mo`, while keeping the annual billed amount larger and more prominent for compliance.

## Verification Flow After Fix

1. Reopen `/progress` at 320 x 568.
2. Confirm the price card shows `$4.16/mo` on one line.
3. Confirm zero horizontal overflow and no visible sub-44 px controls.
4. Repeat for `/routine/plan`, `/onboarding/paywall`, and `/paywall/upsell?feature=full_routine`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/paywall-monthly-equivalent-compact-line/progress.png`
- Screenshot: `test-results/human-e2e/2026-07-07/paywall-monthly-equivalent-compact-line/routine-plan.png`
- Screenshot: `test-results/human-e2e/2026-07-07/paywall-monthly-equivalent-compact-line/onboarding-paywall.png`
- Screenshot: `test-results/human-e2e/2026-07-07/paywall-monthly-equivalent-compact-line/upsell-full-routine.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/paywall-monthly-equivalent-compact-line/summary.json`
- Logs: `test-results/human-e2e/2026-07-07/paywall-monthly-equivalent-compact-line/browser-warnings.json`
- Focused test: `npm --workspace apps/mobile run test -- src/features/subscription/paywallMobileContracts.test.ts`

## Remaining Risk

- Untested branches: Native iOS and Android Dynamic Type/text-scale rendering; localized non-USD monthly equivalent labels.
- Missing fixtures: Durable native visual regression for compact paywalls.
- Follow-up needed: Include localized RevenueCat price strings in native compact-paywall QA.
