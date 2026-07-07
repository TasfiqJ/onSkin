# E2E Bug Report: Sparse shelf fabricated a night cycle

Severity: High
Surface: Expo web
Environment: Expo web on localhost:8102, 320 x 568 viewport, PM local clock
Feature: Routine plan / Today PM
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Add only `Mineral SPF 50` through `/shelf/manual` and `/shelf/opened`.
2. Open `/routine/plan` and unlock through the contextual no-card `Explore first` path.
3. Inspect the evening card, tap `Start today`, and inspect Today PM.

## Expected Result

The routine stays honest to the user's shelf. Morning shows `Mineral SPF 50`; evening does not claim skin cycling, recovery nights, or ceramide-only guidance until a real night active or barrier product exists.

## Actual Result

Pre-fix, `/routine/plan` always rendered `Evening · skin cycling`, a `Recover` row, and `ceramide only` copy even when the generated plan had no PM steps and no cycle. Today also kept fallback cycle UI for a missing cycle.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/routine-plan-sparse-shelf/routine-plan-viewport-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-07/routine-plan-sparse-shelf/today-pm-viewport-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-07/routine-plan-sparse-shelf/shelf-viewport-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/routine-plan-sparse-shelf/routine-plan-visible-text.txt`
- UI snapshot: `test-results/human-e2e/2026-07-07/routine-plan-sparse-shelf/today-pm-visible-text.txt`
- Logs: `test-results/human-e2e/2026-07-07/routine-plan-sparse-shelf/browser-console-warnings.json`

## Frequency

- Always for a sparse daytime-only shelf.

## Scope

- Affected route/screen: `/routine/plan`, `/today` PM
- Affected account or fixture: one local shelf product, `Mineral SPF 50`
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The generator correctly returned `cycle: null`, empty PM steps, and no ramp for the SPF-only shelf, but the presentation layer still had hardcoded cycle/recovery copy and fallback PM cycle labels.

## Minimal Fix Recommendation

Gate cycle copy on `plan.cycle`, render real PM steps only when they exist, show an explicit no-night-steps empty state for sparse shelves, and hide Today cycle affordances when `useCycle()` has no cycle.

## Verification Flow After Fix

1. Add only `Mineral SPF 50` through the real shelf intake.
2. Unlock `/routine/plan` through `Explore first`.
3. Confirm the plan text includes `BUILT FROM YOUR SHELF`, `Mineral SPF 50`, and `No night steps yet.`
4. Confirm the plan and Today PM text do not include `skin cycling`, `Recover`, `ceramide`, or `Week ahead`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/routine-plan-sparse-shelf/routine-plan-viewport-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-07/routine-plan-sparse-shelf/today-pm-viewport-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/routine-plan-sparse-shelf/routine-plan-checks.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/routine-plan-sparse-shelf/today-pm-checks.json`
- Terminal transcript: `npm --workspace apps/mobile run test -- src/features/routine/generate.test.ts src/features/subscription/proGatedRoutes.test.ts src/features/today/todayRoute.test.ts`

## Remaining Risk

- Untested branches: native iOS/Android visual pass for the same sparse-shelf state.
- Missing fixtures: catalog-backed SPF product with richer metadata.
- Follow-up needed: automate the sparse shelf branch after the human-simulated E2E harness is formalized.
