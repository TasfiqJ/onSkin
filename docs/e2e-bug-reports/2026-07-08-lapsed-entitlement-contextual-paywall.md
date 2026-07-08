# E2E Bug Report: Lapsed Contextual Paywalls Used First-Trial Framing

Severity: Medium
Surface: Expo web
Environment: System Chrome, Expo web, 320 x 568 viewport, `EXPO_PUBLIC_E2E_ENTITLEMENT=expired_store`
Feature: Contextual Pro paywall entitlement lifecycle
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Seed an expired store-backed entitlement.
2. Open `/routine/plan` directly.
3. Inspect the contextual paywall copy and visible controls.

## Expected Result

The lapsed paid user sees contextual paid recovery framing with data-preserving renewal copy, no no-card reverse-trial CTA, no first-trial CTA, and no Pro routine content behind the gate.

## Actual Result

Before the fix, contextual Pro gates blocked `Explore first` for expired users but still used the first-trial primary CTA and intro framing. That could imply another free trial for a previously paid/lapsed account.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/lapsed-entitlement-contextual-paywall/routine-plan-lapsed-paid-renewal-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/lapsed-entitlement-contextual-paywall/summary.json`
- Logs: `test-results/human-e2e/2026-07-08/lapsed-entitlement-contextual-paywall/browser-logs.json`
- Terminal transcript: Playwright run passed 1/1 test.

## Frequency

- Always with the expired paid entitlement fixture.

## Scope

- Affected route/screen: contextual Pro gates, verified on `/routine/plan`
- Affected account or fixture: `EXPO_PUBLIC_E2E_ENTITLEMENT=expired_store`
- External service involved: RevenueCat state simulated locally; live RevenueCat not used.
- Destructive action involved: None.

## Suspected Cause

The contextual gate had first-time reverse-trial eligibility logic but no separate display copy for lapsed entitlement states.

## Minimal Fix Recommendation

Add lapsed entitlement display branching in `ProGate`: keep no-card `Explore first` only for never-subscribed free users, and use renewal/re-offer CTA language for expired store or reverse-trial entitlement fixtures.

## Verification Flow After Fix

1. Run focused typecheck and subscription route contract tests.
2. Start Expo web with `EXPO_PUBLIC_E2E_ENTITLEMENT=expired_store`.
3. Open `/routine/plan` at 320 x 568 and confirm `Restore Pro for`, `Renew Pro`, no `Explore first`, no `Start free trial`, no routine-plan content, 48 px+ controls, and zero horizontal overflow.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/lapsed-entitlement-contextual-paywall/routine-plan-lapsed-paid-renewal-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/lapsed-entitlement-contextual-paywall/summary.json`
- Terminal transcript: `npm --workspace apps/mobile run test -- src/features/subscription/paywallMobileContracts.test.ts src/features/photos/progressRoutes.test.ts src/features/subscription/entitlement.test.ts` passed 36 tests.
- Terminal transcript: Playwright E2E passed 1 test.

## Remaining Risk

- Untested branches: live RevenueCat expiration/refund, native StoreKit/Play purchase restoration after expiry, expired reverse-trial native rendering.
- Missing fixtures: real App Store/Play sandbox accounts and RevenueCat lifecycle events.
- Follow-up needed: Phase 6 native RevenueCat lifecycle QA remains tracked in `docs/FOR_TAS_TO_DO.md`.
