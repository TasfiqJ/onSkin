# E2E Bug Report: Widgets deferred route used generic Back copy

Severity: Low
Surface: Expo route recovery, source-audited
Environment: Local source audit; Expo web start verified on localhost:8100
Feature: Routine widgets deferred native surface
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Inspect `apps/mobile/src/app/routine/widgets.tsx`.
2. Follow the disabled-widget branch while `phase7Flags.widgets` is false.
3. Check the `DeferredSurface` fallback label and route.

## Expected Result

The unavailable widget route should keep native widgets honestly deferred and use a destination-specific `Back to Today` CTA that returns to the Today tab on direct entry.

## Actual Result

The route correctly deferred native widgets, but it relied on the shared generic `Back` copy and implicit default fallback route.

## Evidence

- Source review: `apps/mobile/src/app/routine/widgets.tsx`
- User-flow branch: `docs/USER_FLOW_TREE.md` Pro direct-entry route exits
- Focused route contract: `npm.cmd --workspace apps/mobile run test -- src/features/subscription/proGatedRoutes.test.ts`

## Frequency

- Always for Pro or reverse-trial users entering `/routine/widgets` while `phase7Flags.widgets` is false.

## Scope

- Affected route/screen: `/routine/widgets`
- Affected account or fixture: Pro or reverse-trial account with native widgets disabled
- External service involved: None
- Destructive action involved: No

## Suspected Cause

`DeferredSurface` defaults to generic `Back` copy unless the route passes `fallbackLabel`, and the widgets route did not override it.

## Minimal Fix Recommendation

Pass `fallbackRoute={APP_HOME_ROUTE}` and `fallbackLabel="Back to Today"` from the widgets deferred branch.

## Verification Flow After Fix

1. Open `/routine/widgets` while native widgets are disabled.
2. Confirm the deferred surface CTA reads `Back to Today`.
3. Tap the CTA and confirm the app lands on the Today tab.

## Post-Fix Evidence

- Focused route contract: `npm.cmd --workspace apps/mobile run test -- src/features/subscription/proGatedRoutes.test.ts`
- Source evidence: `fallbackRoute={APP_HOME_ROUTE}` and `fallbackLabel="Back to Today"` are present in `apps/mobile/src/app/routine/widgets.tsx`.

## Remaining Risk

- App-surface automation was unavailable in this session because the bundled Browser plugin is missing the documented `scripts/browser-client.mjs`, no Chrome-control tool was exposed, and Playwright is not installed in the repo.
- Native iOS and Android rendering for the deferred widgets surface still needs simulator/device QA.
