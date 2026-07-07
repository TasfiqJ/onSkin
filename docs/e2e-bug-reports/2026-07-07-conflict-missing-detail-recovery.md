# E2E Bug Report: Missing conflict detail looked like stale guidance

Severity: Medium
Surface: Expo web
Environment: Compact direct-entry route at 320 x 568; local source audit
Feature: Shelf conflict detail
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open a stale conflict detail URL such as `/conflict/missing-rule-e2e`.
2. Inspect the missing-conflict state.
3. Try to recover without relying on browser or native navigation history.

## Expected Result

The user sees calm copy explaining the timing note is no longer active, no stale routine advice is reused, and explicit recovery actions return to Shelf or open manual product add.

## Actual Result

The route rendered `This conflict is no longer on your shelf.` with a generic `Close` action. That was technically recoverable, but it did not explain why the guidance disappeared or provide a clear add-product recovery path.

## Evidence

- Source route: `apps/mobile/src/app/conflict/[ruleId].tsx`
- User-flow branch: `docs/USER_FLOW_TREE.md` Shelf Conflict Checks And Share Cards missing or unshareable conflict

## Frequency

- Always when the current shelf does not produce the requested `ruleId`.

## Scope

- Affected route/screen: `/conflict/[ruleId]`
- Affected account or fixture: Local shelf users opening stale or removed conflict links
- External service involved: None
- Destructive action involved: No

## Suspected Cause

The route treated a missing detected conflict as a minimal dismissal state instead of a full direct-entry recovery state.

## Minimal Fix Recommendation

Use a polished timing-note unavailable state with explicit `Back to Shelf` and `Add a product` actions, keep all compact-phone controls visible, and guard it in the conflict route contract.

## Verification Flow After Fix

1. Open `/conflict/missing-rule-e2e`.
2. Confirm the sheet says `This timing note is no longer active.` and explains old links never reuse stale routine advice.
3. Confirm `Back to Shelf` routes to `/shelf`.
4. Reopen the stale detail URL and confirm `Add a product` routes to `/shelf/manual`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/conflict-missing-detail-recovery/conflict-missing-detail-320x568.png`
- Geometry audit: `test-results/human-e2e/2026-07-07/conflict-missing-detail-recovery/conflict-missing-detail-audit.json`
- Click evidence: `test-results/human-e2e/2026-07-07/conflict-missing-detail-recovery/conflict-missing-detail-clicks.json`
- Focused route contract: `npm.cmd --workspace apps/mobile run test -- src/features/intelligence/conflictRoutes.test.ts`

## Remaining Risk

- Native iOS and Android device rendering still need the final release-device pass.
