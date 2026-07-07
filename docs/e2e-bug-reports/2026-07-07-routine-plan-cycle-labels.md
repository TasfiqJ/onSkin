# E2E Bug Report: Routine plan cycle rows used terse night labels

Severity: Low
Surface: Expo web, source-audited
Environment: Local Expo web at `http://localhost:8081`, Codex in-app browser, 390 x 844 viewport
Feature: Routine plan skin-cycling card
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Inspect `apps/mobile/src/app/routine/plan.tsx`.
2. Review the skin-cycling evening rows rendered by `/routine/plan`.
3. Check the night labels and ramp cadence suffix.

## Expected Result

The plan should explain the generated cycle in plain phone-readable copy: `Night 1`, `Night 2`, `Nights 3-4`, and `2 times/week to start`.

## Actual Result

The route used terse labels such as `N1`, `N2`, `N3-4`, and `2x/week to start`. Those are compact, but they read like internal shorthand on a high-trust onboarding moment.

## Evidence

- Source review: `apps/mobile/src/app/routine/plan.tsx`
- User-flow branch: `docs/USER_FLOW_TREE.md` Pro direct-entry route exits / projected cycle-night labels
- Focused route contract: `npm.cmd --workspace apps/mobile run test -- src/features/subscription/proGatedRoutes.test.ts`
- Post-fix screenshot: `test-results/human-e2e/2026-07-07/routine-plan-ascii-copy.png`

## Frequency

- Always when the generated plan includes a skin-cycling PM routine.

## Scope

- Affected route/screen: `/routine/plan`
- Affected account or fixture: Users with generated active/cycling plans
- External service involved: None
- Destructive action involved: No

## Suspected Cause

The compact design used internal cycle shorthand to save horizontal space, and the source audit had already started replacing fragile symbols without expanding the user-facing labels.

## Minimal Fix Recommendation

Use readable ASCII labels, widen the cycle-label column, and keep the row name flexible so compact phones still wrap gracefully.

## Verification Flow After Fix

1. Open `/routine/plan` with a cycling fixture.
2. Confirm the PM card uses `Evening skin cycling`.
3. Confirm the cycle rows read `Night 1`, `Night 2`, and `Nights 3-4`.
4. Confirm the retinoid ramp suffix reads `times/week to start`.

## Post-Fix Evidence

- Focused route contract: `npm.cmd --workspace apps/mobile run test -- src/features/subscription/proGatedRoutes.test.ts`
- Expo web app-surface screenshot: `test-results/human-e2e/2026-07-07/routine-plan-ascii-copy.png`

## Remaining Risk

- Native iOS and Android rendering still need simulator/device QA through the Phase 5/7 device gates.
- Browser DOM snapshot failed with a browser-runtime method mismatch, so screenshot evidence was used for the visible app state.
