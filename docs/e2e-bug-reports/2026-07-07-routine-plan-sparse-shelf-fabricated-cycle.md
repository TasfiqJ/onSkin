# E2E Bug Report: Sparse shelf fabricated a night cycle

Severity: High
Surface: Expo web
Environment: Local Expo web on `http://localhost:8113`, desktop browser surface, PM local clock
Feature: Routine plan first value / Today PM routine
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Start from a clean local app state.
2. Open `/onboarding/products` and add only `Mineral SPF 50`.
3. Unlock through the no-card Explore path and open `/routine/plan`.
4. Inspect the evening card, tap `Start today`, and inspect Today during PM.

## Expected Result

The plan remains built from the user's shelf, the morning card includes `Mineral SPF 50`, and the plan plus Today PM do not claim `skin cycling`, `Recover`, or `ceramide only` until the generated plan has a real night active or barrier product.

## Actual Result

The routine plan always labeled the evening card as `Evening · skin cycling` and rendered a `Recover` row with `ceramide only`. Today PM also rendered a fallback skin-cycling strip with Exfoliate / Retinoid / Recover / Recover even though the generated plan had no cycle and no PM steps.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/routine-plan-sparse-shelf/routine-plan-sparse-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-07/routine-plan-sparse-shelf/today-after-start-320x568.png`
- Logs: `test-results/human-e2e/2026-07-07/routine-plan-sparse-shelf/browser-warnings-errors.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/routine-plan-sparse-shelf/routine-plan-sparse-state.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/routine-plan-sparse-shelf/today-after-start-state.json`
- Terminal transcript: focused Vitest runs for routine generation, Pro route contracts, and Today route contracts

## Frequency

- Always for a sparse daytime-only shelf during PM.

## Scope

- Affected route/screen: `/routine/plan`, `/today`
- Affected account or fixture: local-first onboarding shelf with only SPF
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The generator correctly returned an AM-only plan with `cycle: null`, but `/routine/plan` and `/today` rendered hardcoded fallback skin-cycling UI instead of gating that UI on the generated cycle.

## Minimal Fix Recommendation

Render the plan's skin-cycling rows only when `plan.cycle` exists, render Today's skin-cycling strip only when a cycle exists, and show an honest empty evening state for generated plans with no PM steps.

## Verification Flow After Fix

1. Add only `Mineral SPF 50` from `/onboarding/products`.
2. Open `/routine/plan` and verify the evening card says `No night steps yet.` with no skin-cycling, Recover, or ceramide-only copy.
3. Tap `Start today` and verify Today PM says `No evening steps yet.` with no skin-cycling strip.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/routine-plan-sparse-shelf/routine-plan-sparse-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-07/routine-plan-sparse-shelf/today-after-start-320x568.png`
- Logs: `test-results/human-e2e/2026-07-07/routine-plan-sparse-shelf/browser-warnings-errors.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/routine-plan-sparse-shelf/routine-plan-sparse-state.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/routine-plan-sparse-shelf/today-after-start-state.json`
- Terminal transcript: `npm --workspace apps/mobile run test -- src/features/routine/generate.test.ts src/features/subscription/proGatedRoutes.test.ts src/features/today/todayRoute.test.ts`

## Remaining Risk

- Untested branches: native iOS/Android visual pass for the same sparse-shelf state.
- Missing fixtures: none for the deterministic local generator.
- Follow-up needed: automate the sparse shelf branch after the human-simulated E2E harness is formalized.
