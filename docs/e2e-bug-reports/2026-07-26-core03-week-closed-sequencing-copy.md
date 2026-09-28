# E2E Bug Report: Closed Cycle Week exposed unreviewed sequencing copy

- Severity: High
- Surface: Expo web
- Environment: Pro fixture with routine cadence admission forced closed
- Feature: CORE-03 Cycle Week direct entry
- Date: 2026-07-26
- Tester: Codex in-app browser

## Reproduction Steps

1. Start Expo web with `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro` and
   `EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE=closed`.
2. Open `/cycle/week` directly.
3. Inspect the closed-state morning card.

## Expected Result

The closed state exposes neutral availability copy only. It must not publish an
application order while the sequencing corpus has zero production admission.

## Actual Result

The card displayed `moisturizer → SPF`, an unreviewed sequencing instruction.

## Evidence

- Pre-fix visual observation during the calibrated route pass; the pre-fix
  screenshot was replaced and is not retained.
- Post-fix screenshot:
  `test-results/human-e2e/2026-07-26/core03-routine-cadence-review-gate-current/375x666-cycle-week.png`

## Frequency

Always when Cycle Week was opened with cadence admission closed.

## Scope

- Affected route: `/cycle/week`
- Affected fixture: current Pro/reverse-trial user with closed cadence admission
- External service involved: none
- Destructive action involved: no

## Suspected Cause

The earlier review gate hid night-cycle controls but reused `amSummary` for the
closed morning card, crossing the separate zero-admission sequencing boundary.

## Minimal Fix Recommendation

Render only neutral availability state in the closed component and statically
prohibit `amSummary`, `moisturizer`, and `SPF` there.

## Verification Flow After Fix

1. Open `/cycle/week` at 375 x 666, 390 x 844, and 430 x 932.
2. Confirm the card says `DAILY ROUTINE`, `Available from Today`, and
   `unchanged`.
3. Confirm no product order, cycle settings, night rows, or active-cadence copy
   appears.
4. Refresh and confirm the route remains closed.

## Post-Fix Evidence

- Calibrated Cycle Week screenshots in the CORE-03 evidence folder.
- `apps/mobile/src/features/scheduler/cycleWeekRoute.test.ts`
- `scripts/core03/routine-guidance-source-contract.test.mjs`

## Remaining Risk

- Exact 375 x 667 and native iPhone/Dynamic Type/VoiceOver evidence remain open.
- Professionally reviewed admitted sequencing content has not been tested
  because the production corpus correctly admits zero rules.
