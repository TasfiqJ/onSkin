# E2E Bug Report: Missing Commerce Stack Recovery

Severity: Medium
Surface: Expo web
Environment: Compact direct-entry route at 320 x 568 with `EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED=true` and `EXPO_PUBLIC_FINAL_BRAND_DOMAIN=https://routinekind.app`
Feature: Commerce stack detail
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Start Expo web with commerce enabled for the local E2E run.
2. Open `/commerce/stack/missing-stack-e2e`.
3. Try to recover without relying on browser or native navigation history.
4. Tap `Back to stacks`.
5. Reopen `/commerce/stack/missing-stack-e2e` and tap `How paid links work`.

## Expected Result

When commerce is enabled, the stack detail route shows calm unavailable copy, explains the stack may have changed during disclosure or product-availability review, and offers `Back to stacks` plus `How paid links work`. The actions route to `/commerce/stacks` and `/commerce/transparency` without exposing retailer links.

## Actual Result

The route implementation previously had only a one-line unavailable state with no explicit stack-library or transparency recovery.

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
2. Start Expo web with `EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED=true` and `EXPO_PUBLIC_FINAL_BRAND_DOMAIN=https://routinekind.app`.
3. Open `/commerce/stack/missing-stack-e2e` at 320 x 568.
4. Confirm `Stack unavailable` copy, no horizontal overflow, no clipped controls, and no visible sub-44 px controls.
5. Tap `Back to stacks` and confirm `/commerce/stacks`.
6. Reopen the missing route, tap `How paid links work`, and confirm `/commerce/transparency`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/commerce-missing-stack-recovery/commerce-missing-stack-320x568-viewport.png`
- Screenshot: `test-results/human-e2e/2026-07-07/commerce-missing-stack-recovery/commerce-missing-stack-back-to-stacks-viewport.png`
- Screenshot: `test-results/human-e2e/2026-07-07/commerce-missing-stack-recovery/commerce-missing-stack-transparency-viewport.png`
- Logs and layout audit: `test-results/human-e2e/2026-07-07/commerce-missing-stack-recovery/commerce-missing-stack-clicks.json`
- Run report: `test-results/human-e2e/2026-07-07/commerce-missing-stack-recovery/report.md`

## Remaining Risk

- Default beta runtime still correctly defers commerce unless Phase 7 commerce and final-domain evidence are enabled.
- Native iOS and Android device rendering still need the final release-device pass.
