# E2E Bug Report: Slow Entitlement Gate Lacked Visible Holding State

Severity: Medium
Surface: Expo web
Environment: System Chrome, Expo web, 320 x 568 viewport, `EXPO_PUBLIC_E2E_ENTITLEMENT=expired_store`, `EXPO_PUBLIC_E2E_ENTITLEMENT_DELAY_MS=2200`
Feature: Contextual Pro gate entitlement loading
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Add a slow entitlement fixture.
2. Open `/routine/plan` directly.
3. Inspect the screen before the entitlement query resolves.

## Expected Result

The user sees a neutral loading state, and no Pro-only routine content appears until the entitlement decision is confirmed.

## Actual Result

Before the fix, the contextual gate returned an empty `Screen` while entitlement data was loading. That was safe from a content-flash perspective but created a blank route during slow checks and had no repeatable E2E fixture to prove the no-flash branch.

## Evidence

- Loading screenshot: `test-results/human-e2e/2026-07-08/slow-entitlement-no-flash/01-loading-entitlement-320x568.png`
- Resolved screenshot: `test-results/human-e2e/2026-07-08/slow-entitlement-no-flash/02-resolved-contextual-paywall-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/slow-entitlement-no-flash/summary.json`
- Logs: `test-results/human-e2e/2026-07-08/slow-entitlement-no-flash/browser-logs.json`
- Terminal transcript: Playwright run passed 1/1 test after targeting installed system Chrome.

## Frequency

- Always when entitlement resolution is artificially delayed before the fix; intermittently possible on slow storage/server checks.

## Scope

- Affected route/screen: contextual Pro gates, verified on `/routine/plan`
- Affected account or fixture: `EXPO_PUBLIC_E2E_ENTITLEMENT=expired_store` plus delayed entitlement fixture
- External service involved: RevenueCat state simulated locally; live RevenueCat not used.
- Destructive action involved: None.

## Suspected Cause

The gate prioritized hiding children while loading but rendered an empty placeholder instead of a user-visible, non-revealing holding state.

## Minimal Fix Recommendation

Render a neutral entitlement-check state before the locked/unlocked branch, and add a clamped local E2E entitlement-delay fixture so the no-flash path can be verified repeatably.

## Verification Flow After Fix

1. Run focused typecheck and subscription route contract tests.
2. Start Expo web with `EXPO_PUBLIC_E2E_ENTITLEMENT=expired_store` and `EXPO_PUBLIC_E2E_ENTITLEMENT_DELAY_MS=2200`.
3. Open `/routine/plan` at 320 x 568.
4. Confirm `Checking your access` appears during the delay, premium routine-plan text never appears before resolution, and the route resolves to the lapsed paid renewal paywall.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/slow-entitlement-no-flash/01-loading-entitlement-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-08/slow-entitlement-no-flash/02-resolved-contextual-paywall-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/slow-entitlement-no-flash/summary.json`
- Terminal transcript: `npm --workspace apps/mobile run test -- src/features/subscription/paywallMobileContracts.test.ts src/features/subscription/entitlement.test.ts src/features/subscription/proGatedRoutes.test.ts` passed 36 tests.
- Terminal transcript: Playwright E2E passed 1 test.

## Remaining Risk

- Untested branches: native iOS/Android offline cache restoration, live RevenueCat slow-network behavior, app background/resume during an in-flight entitlement check.
- Missing fixtures: native network link conditioner or RevenueCat sandbox latency injection.
- Follow-up needed: Phase 6 native RevenueCat lifecycle QA remains tracked in `docs/FOR_TAS_TO_DO.md`.
