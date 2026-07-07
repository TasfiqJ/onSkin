# E2E Bug Report: Onboarding product intake lost the three-product target

Severity: Medium
Surface: Expo web
Environment: Phone-width onboarding product intake at 390 x 844
Feature: Onboarding product intake
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/onboarding/products` with an empty first-run shelf.
2. Add one current product.
3. Inspect the footer and product-count guidance before continuing.

## Expected Result

The screen keeps the documented three-product first-insight target visible, nudges the user to add the next product, and still leaves a clear path to continue early.

## Actual Result

After the first product, the primary footer became `Continue`. The flow technically worked, but it made a one-product shelf feel complete even though the first routine insight is materially stronger with three products.

## Evidence

- Source route: `apps/mobile/src/app/onboarding/products.tsx`
- User-flow branch: `docs/USER_FLOW_TREE.md` Onboarding product intake category metadata

## Frequency

- Always after at least one onboarding product was added before the fix.

## Scope

- Affected route/screen: `/onboarding/products`
- Affected account or fixture: First-run users building the initial shelf
- External service involved: None
- Destructive action involved: No

## Suspected Cause

The footer only distinguished between zero products and any products. It did not encode the roadmap target that three products gives the first routine enough context for stronger timing and gap notes.

## Minimal Fix Recommendation

Add a non-blocking 0-of-3 progress cue, keep the primary action focused on the next product until three are added, and keep a secondary continue path for users who choose to proceed early.

## Verification Flow After Fix

1. Open `/onboarding/products` with an empty first-run shelf.
2. Confirm the empty state says `0 OF 3 PRODUCTS`.
3. Add `Retinol 0.3% Night Serum` as Treatment and confirm `1 OF 3 PRODUCTS`, `Add 2 more`, and `Continue with 1 product`.
4. Add `Mineral SPF 50` as SPF and confirm `2 OF 3 PRODUCTS`, `Add 1 more`, and `Continue with 2 products`.
5. Add `Ceramide Moisturiser` as Moisturiser and confirm `3 OF 3 PRODUCTS` plus primary `Continue`.
6. Tap `Continue` and confirm the app proceeds to the next guarded onboarding surface.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/onboarding-products-three-target.png`
- UI snapshot: Browser-visible text showed `2 OF 3 PRODUCTS`, `Add 1 more`, and `Continue with 2 products`, then `3 OF 3 PRODUCTS` and `Continue`.
- Route after Continue: `/onboarding/consent`, because this browser profile still needed the health-data consent gate.
- Focused route contract: `npm.cmd --workspace apps/mobile run test -- src/features/onboarding/onboardingRoutes.test.ts`

## Remaining Risk

- Native iOS and Android rendering still need the final release-device pass.
