# E2E Bug Report: Ask consent deferred route used generic Back copy

Severity: Low
Surface: Expo web direct-entry recovery
Environment: Expo web on localhost, 320 x 568 viewport
Feature: Ask cloud-consent deferred route
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/ask/consent` directly while cloud Ask is disabled.
2. Inspect the deferred surface CTA at a 320 x 568 phone viewport.
3. Tap the CTA.

## Expected Result

The deferred screen keeps cloud Ask honestly unavailable and uses a route-specific `Back to Ask` CTA that returns to `/ask` on direct entry.

## Actual Result

The screen correctly deferred cloud Ask and returned to `/ask`, but the CTA used generic `Back` copy, which was weaker than the direct-entry destination contract.

## Evidence

- Source review: `apps/mobile/src/app/ask/consent.tsx`
- User-flow branch: `docs/USER_FLOW_TREE.md` Ask Layerwell Deterministic Advisor / cloud consent direct route while cloud Ask is disabled

## Frequency

- Always for direct `/ask/consent` entries while `phase7Flags.cloudAsk` is false.

## Scope

- Affected route/screen: `/ask/consent`
- Affected account or fixture: Any user entering the unavailable cloud Ask consent route
- External service involved: None
- Destructive action involved: No

## Suspected Cause

`DeferredSurface` defaults to its generic CTA label unless a route supplies `fallbackLabel`.

## Minimal Fix Recommendation

Pass `fallbackLabel="Back to Ask"` from the Ask consent deferred branch while preserving `APP_ASK_ROUTE` as the safe fallback route.

## Verification Flow After Fix

1. Open `/ask/consent` directly at 320 x 568.
2. Confirm the CTA reads `Back to Ask`, has at least a 44 px touch target, and no horizontal overflow.
3. Tap `Back to Ask`.
4. Confirm `/ask` renders the deterministic Ask advisor.

## Post-Fix Evidence

- Screenshot:
  - `test-results/human-e2e/2026-07-07/ask-consent-deferred-cta/post-fix-ask-consent-deferred-320x568.png`
  - `test-results/human-e2e/2026-07-07/ask-consent-deferred-cta/post-fix-back-to-ask-320x568.png`
- UI snapshot:
  - `test-results/human-e2e/2026-07-07/ask-consent-deferred-cta/post-fix-ask-consent-deferred-state.json`
  - `test-results/human-e2e/2026-07-07/ask-consent-deferred-cta/post-fix-back-to-ask-state.json`
- Logs: `test-results/human-e2e/2026-07-07/ask-consent-deferred-cta/post-fix-browser-warn-error-logs.json`
- Focused route contract: `npm --workspace apps/mobile run test -- src/features/ask/routeContract.test.ts`

## Remaining Risk

- Untested branches: Native iOS and Android visual rendering for the same deferred route.
- Missing fixtures: Cloud Ask enabled state remains intentionally gated until vendor/legal evidence exists.
- Follow-up needed: Include `/ask/consent` direct-entry recovery in the durable mobile E2E suite.
