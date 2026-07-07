# E2E Bug Report: Deferred Trend CTA Lacks Destination

Severity: Low
Surface: Expo web phone viewport
Environment: `npm --workspace apps/mobile run web -- --port 8110`, 320 x 568 browser viewport
Feature: Photo trend route direct entry
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/trend/optin` directly while photo trend insights are launch-gated.
2. Observe the deferred photo trend surface.
3. Inspect and tap the bottom escape control.

## Expected Result

The deferred Trend route should make the no-history recovery destination explicit and return the user to the Progress tab.

## Actual Result

The route correctly recovered to Progress, but the visible CTA used generic `Back` copy. On a direct-entry phone flow, that copy made the exit feel less deliberate than the route contract.

## Evidence

- Pre-fix screenshot: `test-results/human-e2e/2026-07-07/trend-routes/01-trend-optin-deferred-before-320.png`
- Pre-fix route snapshot: `test-results/human-e2e/2026-07-07/trend-routes/01-trend-optin-deferred-before-320.json`
- Post-tap route snapshot: `test-results/human-e2e/2026-07-07/trend-routes/02-trend-optin-after-generic-back-320.json`

## Frequency

- Always while photo trend insights are disabled and a `/trend/*` route is opened directly.

## Scope

- Affected route/screen: deferred photo trend routes under `/trend`.
- Affected account or fixture: local Expo web fixture, Trend launch gate disabled.
- External service involved: none.
- Destructive action involved: no.

## Suspected Cause

`trend/_layout.tsx` passed the correct `APP_PROGRESS_ROUTE` fallback into `DeferredSurface`, but did not provide a route-specific fallback label. The shared deferred copy defaults to `Back`.

## Minimal Fix Recommendation

Pass `fallbackLabel="Back to Progress"` from the Trend layout while preserving `APP_PROGRESS_ROUTE` as the safe fallback.

## Verification Flow After Fix

1. Reopen `/trend/optin` at 320 x 568.
2. Confirm the visible CTA says `Back to Progress` and is exposed as exactly one button.
3. Tap `Back to Progress`.
4. Confirm the app lands on `/progress` with no horizontal overflow, clipped controls, or small targets.

## Post-Fix Evidence

- Screenshot before tap: `test-results/human-e2e/2026-07-07/trend-routes/03-trend-optin-deferred-fixed-before-320.png`
- Snapshot before tap: `test-results/human-e2e/2026-07-07/trend-routes/03-trend-optin-deferred-fixed-before-320.json`
- Screenshot after tap: `test-results/human-e2e/2026-07-07/trend-routes/04-trend-optin-after-back-to-progress-320.png`
- Snapshot after tap: `test-results/human-e2e/2026-07-07/trend-routes/04-trend-optin-after-back-to-progress-320.json`
- Console warnings: `test-results/human-e2e/2026-07-07/trend-routes/browser-console-warnings-8110-fixed.json`
- Contract test: `npm --workspace apps/mobile run test -- src/features/trend/trendRoutes.test.ts`

## Remaining Risk

- Untested branches: native iOS and Android direct-entry checks.
- Missing fixtures: trend-enabled consent toggle, fairness cohorts, and failure branches remain launch-gated and need native/device validation.
- Follow-up needed: run native photo/toggle confirmation after the Trend gate is intentionally enabled.
