# E2E Bug Report: Deferred Share Conflict CTA Lacks Destination

Severity: Low
Surface: Expo web phone viewport
Environment: `npm --workspace apps/mobile run web -- --port 8106`, 320 x 568 browser viewport
Feature: Shelf conflict share-card direct entry
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/share/conflict/not-on-shelf` directly while share cards are launch-gated.
2. Observe the deferred share-card surface.
3. Inspect the bottom escape control.

## Expected Result

The direct-entry deferred surface should make the recovery destination explicit and return the user to Shelf, because there may be no meaningful browser or native navigation history.

## Actual Result

The surface showed a generic `Back` CTA. It worked, but the copy was weaker than the direct-entry recovery contract because the route-specific fallback is Shelf.

## Evidence

- Pre-fix screenshot: `test-results/human-e2e/2026-07-07/conflict-routes/03-share-conflict-missing-before-320.png`
- Pre-fix route snapshot: `test-results/human-e2e/2026-07-07/conflict-routes/03-share-conflict-missing-before-320.json`

## Frequency

- Always while share cards are disabled and the route is opened directly.

## Scope

- Affected route/screen: `/share/conflict/[ruleId]` when `shareCard` is launch-gated.
- Affected account or fixture: local Expo web fixture, missing shelf conflict.
- External service involved: none.
- Destructive action involved: no.

## Suspected Cause

`DeferredSurface` only supported the shared deferred-surface CTA copy. The share-conflict route correctly passed `APP_SHELF_ROUTE`, but it could not override the generic `Back` label with the known fallback destination.

## Minimal Fix Recommendation

Allow deferred surfaces to receive an optional fallback label, and pass `Back to Shelf` from the share-conflict deferred route.

## Verification Flow After Fix

1. Reopen `/share/conflict/not-on-shelf` at 320 x 568.
2. Confirm the visible CTA says `Back to Shelf` and is exposed as exactly one button.
3. Tap `Back to Shelf`.
4. Confirm the app lands on `/shelf` without horizontal overflow.

## Post-Fix Evidence

- Screenshot before tap: `test-results/human-e2e/2026-07-07/conflict-routes/05-share-conflict-missing-before-fixed-320.png`
- Snapshot before tap: `test-results/human-e2e/2026-07-07/conflict-routes/05-share-conflict-missing-before-fixed-320.json`
- Screenshot after tap: `test-results/human-e2e/2026-07-07/conflict-routes/06-share-conflict-missing-after-back-to-shelf-320.png`
- Snapshot after tap: `test-results/human-e2e/2026-07-07/conflict-routes/06-share-conflict-missing-after-back-to-shelf-320.json`
- Console warnings: `test-results/human-e2e/2026-07-07/conflict-routes/06-share-conflict-missing-console-after-back-to-shelf.json`
- Contract test: `npm --workspace apps/mobile run test -- src/features/intelligence/conflictRoutes.test.ts`

## Remaining Risk

- Untested branches: native iOS and Android simulator direct-entry checks.
- Missing fixtures: no reviewed, shareable conflict fixture in this web pass.
- Follow-up needed: verify the native share sheet branch after share cards are enabled by launch gates.
