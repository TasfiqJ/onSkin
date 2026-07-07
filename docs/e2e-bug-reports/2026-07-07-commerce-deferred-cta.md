# E2E Bug Report: Deferred Commerce CTA Lacks Destination

Severity: Low
Surface: Expo web phone viewport
Environment: `npm --workspace apps/mobile run web -- --port 8109`, 320 x 568 browser viewport
Feature: Commerce route direct entry
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/commerce/stacks` directly while commerce is launch-gated.
2. Observe the deferred where-to-buy surface.
3. Inspect and tap the bottom escape control.

## Expected Result

The deferred commerce route should make the no-history recovery destination explicit and return the user to the You tab.

## Actual Result

The route correctly recovered to You, but the visible CTA used generic `Back` copy. On a direct-entry trust surface with no meaningful history, that copy was weaker than the route contract.

## Evidence

- Pre-fix screenshot: `test-results/human-e2e/2026-07-07/commerce-routes/01-commerce-stacks-deferred-before-320.png`
- Pre-fix route snapshot: `test-results/human-e2e/2026-07-07/commerce-routes/01-commerce-stacks-deferred-before-320.json`
- Post-tap route snapshot: `test-results/human-e2e/2026-07-07/commerce-routes/02-commerce-stacks-after-back-320.json`

## Frequency

- Always while commerce is disabled and a `/commerce/*` route is opened directly.

## Scope

- Affected route/screen: deferred commerce routes under `/commerce`.
- Affected account or fixture: local Expo web fixture, commerce launch gate disabled.
- External service involved: none.
- Destructive action involved: no.

## Suspected Cause

`commerce/_layout.tsx` passed the correct `APP_YOU_ROUTE` fallback into `DeferredSurface`, but did not provide a route-specific fallback label. The shared deferred copy defaults to `Back`.

## Minimal Fix Recommendation

Pass `fallbackLabel="Back to You"` from the commerce layout while preserving `APP_YOU_ROUTE` as the safe fallback.

## Verification Flow After Fix

1. Reopen `/commerce/stacks` at 320 x 568.
2. Confirm the visible CTA says `Back to You` and is exposed as exactly one button.
3. Tap `Back to You`.
4. Confirm the app lands on `/you` with no horizontal overflow, clipped controls, or small targets.

## Post-Fix Evidence

- Screenshot before tap: `test-results/human-e2e/2026-07-07/commerce-routes/03-commerce-stacks-deferred-fixed-before-320.png`
- Snapshot before tap: `test-results/human-e2e/2026-07-07/commerce-routes/03-commerce-stacks-deferred-fixed-before-320.json`
- Screenshot after tap: `test-results/human-e2e/2026-07-07/commerce-routes/04-commerce-stacks-after-back-to-you-320.png`
- Snapshot after tap: `test-results/human-e2e/2026-07-07/commerce-routes/04-commerce-stacks-after-back-to-you-320.json`
- Console warnings: `test-results/human-e2e/2026-07-07/commerce-routes/browser-console-warnings-8109-fixed.json`
- Contract test: `npm --workspace apps/mobile run test -- src/features/commerce/commerceRoutes.test.ts`

## Remaining Risk

- Untested branches: native iOS and Android direct-entry checks.
- Missing fixtures: commerce-enabled stack and consent branch remain launch-gated by final domain, catalog, legal, and review gates.
- Follow-up needed: run the live consent sheet and stack item handoff on native devices after the commerce gate is intentionally enabled.
