# E2E Bug Report: Missing Shelf product detail looked like a dead end

Severity: Medium
Surface: Expo web
Environment: Compact direct-entry route at 320 x 568; local source audit
Feature: Shelf product detail
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open a stale product detail URL such as `/shelf/missing-product`.
2. Inspect the missing-product state.
3. Try to recover without relying on browser or native navigation history.

## Expected Result

The user sees clear product-unavailable copy and explicit recovery actions for returning to Shelf or adding a replacement product.

## Actual Result

The route rendered `This product is no longer on your shelf.` as a centered muted sentence with only the top Back icon. That is technically recoverable, but it reads like a broken inventory dead end.

## Evidence

- Source route: `apps/mobile/src/app/shelf/[id].tsx`
- User-flow branch: `docs/USER_FLOW_TREE.md` Shelf direct-entry, back/close, and no-history recovery

## Frequency

- Always when the local active/archive shelf does not contain the requested `id`.

## Scope

- Affected route/screen: `/shelf/[id]`
- Affected account or fixture: Local shelf users opening stale or removed product links
- External service involved: None
- Destructive action involved: No

## Suspected Cause

The route treated the missing product as a minimal internal fallback instead of a full direct-entry recovery state.

## Minimal Fix Recommendation

Use a polished product-unavailable state with explicit `Back to Shelf` and `Add a product` actions, keep the route scrollable on short phones, and guard it in the Shelf route contract.

## Verification Flow After Fix

1. Open `/shelf/missing-product-e2e`.
2. Confirm the screen says `Product unavailable` and explains the product is no longer on the shelf.
3. Confirm `Back to Shelf` routes to `/shelf`.
4. Reopen the stale detail URL and confirm `Add a product` routes to `/shelf/manual`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/shelf-missing-product-recovery/shelf-missing-product-320x568.png`
- Geometry audit: `test-results/human-e2e/2026-07-07/shelf-missing-product-recovery/shelf-missing-product-audit.json`
- Click evidence: `test-results/human-e2e/2026-07-07/shelf-missing-product-recovery/shelf-missing-product-clicks.json`
- Focused route contract: `npm.cmd --workspace apps/mobile run test -- src/features/shelf/shelfRoutes.test.ts`

## Remaining Risk

- Native iOS and Android device rendering still need the final release-device pass.
