# E2E Bug Report: Routine Plan Unclassified Product Placement

Severity: High
Surface: Expo web
Environment: Codex in-app browser, Expo web at 320 x 568, port 8163
Feature: Routine plan generation
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Add a shelf product with a name, no explicit category, and no ingredient clue, such as `Mystery drops`.
2. Open `/routine/plan`.
3. Inspect the generated first insight, AM/PM rows, and fixed `Start today` footer.

## Expected Result

The routine generator should not fabricate a safe default routine role for an unknown shelf item. The plan should explain that the product needs more detail, keep the unknown product out of AM/PM rows, keep `Start today` reachable, and avoid clipped note text under the fixed footer.

## Actual Result

Unknown shelf products could be treated as a generic hydrating serum by default. During verification of the unplaced-product fix, the product-specific note was also visible as a clipped sliver near the fixed footer on a compact phone viewport.

## Evidence

- Post-fix screenshot: `test-results/human-e2e/2026-07-08/routine-plan-unplaced-product/routine-plan-unplaced-product.png`
- Post-fix UI snapshot: `test-results/human-e2e/2026-07-08/routine-plan-unplaced-product/routine-plan-unplaced-product.json`
- Start Today screenshot: `test-results/human-e2e/2026-07-08/routine-plan-unplaced-product/today-after-start.png`

## Frequency

- Always for unclassified shelf items before the fix.

## Scope

- Affected route/screen: `/routine/plan`
- Affected account or fixture: local shelf with unknown manual/onboarding product
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The sequencing role classifier returned `hydrating_serum` as a safe default when a product had no recognized tags, category, or name keyword. That made unknown products look placed instead of asking the user for more product detail.

## Minimal Fix Recommendation

Return `null` for unclassified products, track them as `unplacedProducts`, keep them out of AM/PM sequencing and recommendation ranking, and surface product-specific guidance in the first insight card.

## Verification Flow After Fix

1. Add `Mystery drops` with no category through `/shelf/manual`.
2. Open `/routine/plan`.
3. Confirm the first insight says `Product needs details` and names `Mystery drops` as needing a category or ingredient clue.
4. Confirm `Mystery drops` is not in Morning or Evening rows.
5. Confirm `Start today` remains visible, with no clipped product-note sliver, horizontal overflow, raw error text, or JavaScript dialog.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/routine-plan-unplaced-product/routine-plan-unplaced-product.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/routine-plan-unplaced-product/routine-plan-unplaced-product.json`
- Start Today screenshot: `test-results/human-e2e/2026-07-08/routine-plan-unplaced-product/today-after-start.png`
- Unit tests: `npm --workspace apps/mobile run test -- src/features/routine/generate.test.ts src/features/routine/firstInsight.test.ts src/features/intelligence/tags.test.ts src/features/shelf/categories.test.ts src/features/recommendations/engine.test.ts src/features/onboarding/onboardingRoutes.test.ts src/features/subscription/proGatedRoutes.test.ts`

## Remaining Risk

- Native iOS/Android Dynamic Type and screen-reader order remain device QA follow-up.
