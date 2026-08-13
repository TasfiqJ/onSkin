# Routine-Order Atomic Phase-Patch Checkpoint

Date: 2026-07-16 (America/Toronto)
Branch: `optimization`
Checkpoint parent SHA: `e874c932d4cdb42ecb180721c47293fd195844c7`
Optimization items: PERF-P0-005, OPT-007
Evidence class: command, automated concurrency/failure, and Expo-web human-simulated E2E

## Finding

Routine-order persistence already called `updatePrivateItem`, so same-key calls were serialized. The domain updater nevertheless replaced the complete `{ am, pm }` snapshot computed by the route. Two editors saving different phases from older snapshots could therefore serialize successfully while the later full replacement erased the other phase.

The write API also normalized an invalid runtime payload to an empty record. Although typed callers should not produce that payload, this was not an acceptable private-data boundary because malformed input could remove valid prior bytes.

## Invariant And Acceptance

- A caller mutates only the AM or PM phase it actually edited.
- A concurrent write to the other phase survives.
- Current, malformed, and future persisted bytes are parsed inside the atomic transform.
- Invalid patch input is rejected before private storage is invoked.
- An identical current patch returns the exact current string so private KV performs zero persistence writes.
- A successful save returns the complete post-transform record for exact owner-scoped cache publication.
- The real populated route saves, exits, reloads, and preserves an untouched phase.

## Implementation

- `apps/mobile/src/features/routine/orderStore.ts`
  - replaces whole-record persistence with strict `saveRoutineOrderOverridePatch`;
  - validates patch keys and canonical product IDs without I/O;
  - decodes current bytes and composes only supplied phases inside `updatePrivateItem`;
  - returns current bytes for a semantic current-version no-op.
- `apps/mobile/src/app/routine/reorder.tsx`
  - sends AM and PM only when that phase changed;
  - continues awaiting durable persistence before cache publication, analytics, haptics, and navigation.
- `apps/mobile/src/features/routine/orderStore.test.ts`
  - adds malformed-input byte preservation, no-op write counting, and 100 simultaneous phase patches.
- `apps/mobile/src/features/routine/orderRoutes.test.ts`
  - updates the route ordering contract for the phase-patch API.

## Evidence

| Check | Result |
| --- | --- |
| Focused routine/private-KV matrix | Pass, 4 files / 92 tests |
| Mobile lint | Pass, zero warnings |
| Root typecheck | Pass, 2 workspaces |
| Root lint | Pass, 2 workspaces, zero warnings |
| Root test | Pass, 316 files / 3,895 tests |
| `git diff --check` for slice files | Pass |
| Human-E2E manifest check | Existing fail: generated manifest predates a broad committed source/evidence set; already-dirty generated outputs preserved |
| Populated `/routine/reorder` at 390 x 844 | Pass |
| Save Morning while Evening remains untouched | Pass |
| Direct reload: Morning changed, Evening canonical | Pass |
| Responsive/accessibility audit | 390 px client/scroll width, controls 48-56 px, zero dialogs |
| Browser warning/error buffer | Empty |

Human evidence: `test-results/human-e2e/2026-07-16/routine-order-atomic-current/`

## Tradeoffs And Rollback

- No schema or installed-data migration is required; the persisted version-1 envelope remains unchanged.
- Two conflicting edits to the same phase retain serialized desired-state semantics. The final writer for that phase wins, while a different phase can no longer be erased incidentally.
- Rollback is source-only: restore the former whole-record API and route call. Existing bytes remain readable by either implementation.

## Remaining Boundary

This checkpoint closes the routine-order whole-snapshot lost-update gap. PERF-P0-005 remains `investigating` because other compact-store proof, native protected-storage faults, deliberately hung writes, photo process death, StoreReview timing, and notification delivery are not proved by Expo web or local unit tests.
