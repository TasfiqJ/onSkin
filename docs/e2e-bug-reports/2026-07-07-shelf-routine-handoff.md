# E2E Bug Report: Shelf missing first-routine handoff

Severity: Medium
Surface: Expo web
Environment: `npm --workspace apps/mobile run web -- --port 8082`, 320 x 568 viewport
Feature: Shelf Product Add
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/shelf` on a 320 px phone viewport.
2. Add a real product through the visible `Add by hand` path.
3. Return to the populated Shelf.

## Expected Result

The populated Shelf exposes a clear, phone-sized handoff into the first routine plan so a user who has added products can continue the core activation loop.

## Actual Result

The populated Shelf only listed products and scan/add affordances. A user could add products but had no clear Shelf-local path into routine generation.

## Evidence

- UI snapshot: source audit of `apps/mobile/src/app/(tabs)/shelf.tsx` before the fix showed no first-routine handoff component.
- Terminal transcript: `npm --workspace apps/mobile run test -- src/features/shelf/shelfRoutes.test.ts`

## Frequency

- Always when the Shelf had one or more active products.

## Scope

- Affected route/screen: `/shelf`
- Affected account or fixture: Local Shelf state with at least one active product
- External service involved: None
- Destructive action involved: None

## Suspected Cause

The Shelf implementation stopped at product management and freshness actions. It did not surface the docs/03 activation handoff once the shelf became useful input for routine generation.

## Minimal Fix Recommendation

Render a compact, claim-safe `First routine` card above the product list whenever the active Shelf has products, with a 52 px `Build my routine` CTA to `/routine/plan`.

## Verification Flow After Fix

1. Start Expo web and open `/shelf` at 320 x 568.
2. Use the real manual-add path to create `E2E Routine Handoff Cream`.
3. Confirm the populated Shelf shows `First routine`, sparse-shelf honest copy, and a 56 px `Build my routine` button.
4. Tap `Build my routine` and confirm `/routine/plan` renders the saved product.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/shelf-routine-handoff/shelf-handoff-320.png`
- Screenshot: `test-results/human-e2e/2026-07-07/shelf-routine-handoff/build-my-routine-destination-320.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/shelf-routine-handoff/shelf-handoff-320.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/shelf-routine-handoff/build-my-routine-click-320.json`
- Terminal transcript: `npm --workspace apps/mobile run test -- src/features/shelf/shelfRoutes.test.ts`

## Remaining Risk

- Untested branches: Native iOS/Android rendering of the new card.
- Missing fixtures: Durable seeded Shelf fixture for repeatable populated-Shelf E2E.
- Follow-up needed: Promote this branch to durable E2E after the mobile harness is chosen.
