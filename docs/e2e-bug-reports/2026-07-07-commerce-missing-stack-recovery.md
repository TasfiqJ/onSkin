# E2E Bug Report: Missing Commerce Stack Recovery

Severity: Medium
Surface: Expo web plus source route contract
Environment: Compact direct-entry route at 320 x 568; commerce surface deferred by Phase 7 flags
Feature: Commerce stack detail
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open a stale or unavailable stack route such as `/commerce/stack/missing-stack-e2e`.
2. Inspect the route implementation and the currently reachable app surface.
3. Try to recover without relying on browser or native navigation history.

## Expected Result

When commerce is enabled, the stack detail route shows calm unavailable copy, explains the stack may have changed during disclosure or product-availability review, and offers `Back to stacks` plus `How paid links work`. While commerce is deferred, the direct route shows the beta commerce-deferred state and returns to You.

## Actual Result

The route implementation previously had only a one-line unavailable state with no explicit stack-library or transparency recovery. In the current beta runtime, the Phase 7 commerce gate hides that route body and correctly shows the deferred commerce state.

## Evidence

- Source route: `apps/mobile/src/app/commerce/stack/[slug].tsx`
- Route contract: `apps/mobile/src/features/commerce/commerceRoutes.test.ts`
- User-flow branch: `docs/USER_FLOW_TREE.md` unavailable stack and direct-entry commerce exits
- E2E evidence: `test-results/human-e2e/2026-07-07/commerce-missing-stack-recovery/`

## Frequency

- Always when commerce is enabled and the requested stack slug is absent or no longer shippable.

## Scope

- Affected route/screen: `/commerce/stack/[slug]`
- Affected account or fixture: Commerce-enabled builds with stale stack links
- External service involved: None for the missing-state route; real paid links remain blocked by `B-SHOPMY`, `B-CATALOG-SEED`, and legal/privacy gates
- Destructive action involved: No

## Suspected Cause

The missing-stack branch was treated as a minimal empty state instead of a full direct-entry recovery state.

## Minimal Fix Recommendation

Render a polished stack-unavailable state with an explicit stack-library return action, a transparency action, compact-phone layout constraints, and route-contract coverage.

## Verification Flow After Fix

1. Run the commerce route contract test.
2. Open `/commerce/stack/missing-stack-e2e` at 320 x 568.
3. Confirm current beta builds show the commerce-deferred state with one `Back to You` action.
4. Confirm `Back to You` routes to `/you`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/commerce-missing-stack-recovery/commerce-missing-stack-state.png`
- Screenshot: `test-results/human-e2e/2026-07-07/commerce-missing-stack-recovery/back-to-you-result.png`
- Logs and layout audit: `test-results/human-e2e/2026-07-07/commerce-missing-stack-recovery/layout-and-console.json`
- Run report: `test-results/human-e2e/2026-07-07/commerce-missing-stack-recovery/report.md`

## Remaining Risk

- The stack-unavailable body is currently hidden by `phase7Flags.commerce`; it remains source-contract verified until the commerce gate is enabled with final-domain evidence.
- Native iOS and Android device rendering still need the final release-device pass.
