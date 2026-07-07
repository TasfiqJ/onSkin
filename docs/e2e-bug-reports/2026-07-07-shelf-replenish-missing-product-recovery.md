# E2E Bug Report: Missing Replenishment Product Recovery

Severity: Medium
Surface: Expo web
Environment: Compact direct-entry route at 320 x 568; local source audit
Feature: Shelf replenishment
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open a stale replenishment URL such as `/shelf/replenish?id=missing-replenish-e2e`.
2. Inspect the missing-product state.
3. Try to recover without relying on browser or native navigation history.

## Expected Result

The user sees calm copy explaining that the replacement prompt is no longer active, no stale freshness or shopping prompt is reused, and explicit recovery actions return to Shelf or open manual product add.

## Actual Result

Before the fix, the route rendered `This product is no longer on your shelf.` with a generic `Close` action. That was technically recoverable, but it read like an internal fallback and did not offer the add-product recovery path.

## Evidence

- Source route: `apps/mobile/src/app/shelf/replenish.tsx`
- User-flow branch: `docs/USER_FLOW_TREE.md` Shelf intake and direct-route exits

## Frequency

- Always when the current shelf does not contain the requested replenishment `id`.

## Scope

- Affected route/screen: `/shelf/replenish`
- Affected account or fixture: Local shelf users opening stale, removed, or archived replenishment links
- External service involved: None
- Destructive action involved: No

## Suspected Cause

The replenishment route treated a missing product as a minimal dismissal state instead of a full direct-entry recovery state.

## Minimal Fix Recommendation

Use a polished replacement-prompt unavailable state with explicit `Back to Shelf` and `Add a product` actions, keep all compact-phone controls visible, and guard it in the Shelf route contract.

## Verification Flow After Fix

1. Open `/shelf/replenish?id=missing-replenish-e2e` at 320 x 568.
2. Confirm the sheet says `This replacement prompt is no longer active.` and explains that stale freshness or shopping prompts are not reused.
3. Confirm `Back to Shelf` routes to `/shelf`.
4. Reopen the stale replenish URL and confirm `Add a product` routes to `/shelf/manual`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/shelf-replenish-missing-product-recovery/shelf-replenish-missing-320x568.png`
- Geometry audit: `test-results/human-e2e/2026-07-07/shelf-replenish-missing-product-recovery/shelf-replenish-missing-audit.json`
- Click evidence: `test-results/human-e2e/2026-07-07/shelf-replenish-missing-product-recovery/shelf-replenish-missing-clicks.json`
- Screenshot: `test-results/human-e2e/2026-07-07/shelf-replenish-missing-product-recovery/shelf-replenish-missing-state.png`
- Screenshot: `test-results/human-e2e/2026-07-07/shelf-replenish-missing-product-recovery/back-to-shelf-result.png`
- Screenshot: `test-results/human-e2e/2026-07-07/shelf-replenish-missing-product-recovery/add-product-result.png`
- Logs and layout audit: `test-results/human-e2e/2026-07-07/shelf-replenish-missing-product-recovery/layout-and-console.json`
- Run report: `test-results/human-e2e/2026-07-07/shelf-replenish-missing-product-recovery/report.md`

## Remaining Risk

- Native iOS and Android device rendering still need the final release-device pass.
