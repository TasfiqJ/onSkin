# E2E Bug Report: Routine Plan Compact Note Overlaps CTA

Severity: Medium
Surface: Expo web
Environment: Expo web at `http://localhost:19006`, compact viewport 320x568
Feature: Routine Plan First Value
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/routine/plan` at a 320x568 web viewport.
2. Inspect the lower gap note and fixed `Start today` CTA.
3. Attempt to scroll to the lower note.

## Expected Result

The lower plan note is fully visible above the fixed CTA, or the scroll body gives enough clearance to reach it without overlap.

## Actual Result

The lower note was partially covered by the fixed `Start today` CTA, and the route reported no useful remaining scroll range.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/routine-plan-start-today-cycle/routine-plan-320-first-viewport.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/routine-plan-start-today-cycle/summary.json`
- Terminal transcript: Expo web run on `http://localhost:19006`

## Frequency

- Always at the tested 320x568 viewport before the fix.

## Scope

- Affected route/screen: `/routine/plan`
- Affected account or fixture: Local Expo web fixture with generated shelf routine
- External service involved: None
- Destructive action involved: None

## Suspected Cause

The route relied on `contentContainerClassName="pb-[112px]"` for fixed-footer clearance, but the web surface did not provide enough effective scroll-body clearance at 320x568. The compact gap above the note also left the note too close to the fixed CTA.

## Minimal Fix Recommendation

Use explicit `contentContainerStyle` bottom padding for the `ScrollView`, keep flex growth on the content container, and tighten the compact note spacing so the note can sit above the CTA on short phones.

## Verification Flow After Fix

1. Open `/routine/plan` at 320x568.
2. Confirm the lower note is fully visible above `Start today`.
3. Attempt a user scroll and confirm the note remains reachable.
4. Tap `Start today` and confirm Today opens.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/routine-plan-start-today-cycle/routine-plan-320-first-viewport-fixed.png`
- Screenshot: `test-results/human-e2e/2026-07-07/routine-plan-start-today-cycle/routine-plan-320-after-scroll-fixed.png`
- Screenshot: `test-results/human-e2e/2026-07-07/routine-plan-start-today-cycle/today-320-after-start-fixed.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/routine-plan-start-today-cycle/summary.json`
- Unit/contract tests: `npm --workspace apps/mobile run test -- src/features/scheduler/cycleStore.test.ts src/features/subscription/proGatedRoutes.test.ts`

## Remaining Risk

- Untested branches: native iOS/Android safe-area rendering for the same footer clearance.
- Missing fixtures: live entitlement and production Supabase state are intentionally not used in this local run.
- Follow-up needed: repeat the routine plan compact branch on native simulator/device when the project selects a durable mobile E2E harness.
