# Community-Reaction Atomic No-Op Checkpoint

Date: 2026-07-16

Branch: `optimization`

Checkpoint parent: `ef779d29f0d8cf517a58859c158e1ca4ce7cf3b5`

Items: `PERF-P0-005`, `OPT-007`, `OPT-008`

## Invariant

The encrypted local `This helped` set must accept only a strict, bounded
versioned string-set record (plus the installed strict legacy array), compose
every mutation inside `updatePrivateItem`, and retain exact bytes when a
desired state is already durable. Missing is the only state that means empty;
unavailable, malformed, future-version, and over-limit state must remain
distinct and must never be repaired, evicted, or rewritten implicitly.

## Baseline Finding

The shared string-set codec already enforced a versioned top-level envelope,
strict legacy arrays, trimmed non-empty IDs, and uniqueness. The Community
domain had no record, collection, or ID ceiling, however. A thrown native read
also escaped without the store's typed unavailable result. Existing tests used
three concurrent writers and did not measure persisted writes, so they did not
prove the plan's 100-writer or exact no-op gates.

## Implementation

- Added a pure Community-domain decoder around the shared codec with defensive
  ceilings of 524,288 encoded characters, 4,096 note IDs, and 256 characters
  per note ID.
- These are storage-safety limits, not retention policy: no existing reaction
  is evicted to admit another one. A full set rejects the add and retains the
  exact prior record.
- Oversized input is rejected before private-storage I/O.
- Thrown native reads map to typed `unavailable`; malformed, over-limit, and
  future-version payloads remain non-destructive typed failures.
- Desired states already present in either the current envelope or strict
  legacy array return the exact input payload from the atomic transform.
- The schema version and private-KV encryption format are unchanged; no
  migration, read-time repair, or destructive recovery was added.

## Deterministic Evidence

Focused matrix:

```text
npm.cmd --workspace @layerwell/mobile test -- --run \
  src/features/community/reactionStore.test.ts \
  src/lib/storage/privateStringSet.test.ts \
  src/lib/storage/privateKV.test.ts \
  src/features/community/useCommunity.test.ts

4 files / 84 tests PASS
```

The focused tests prove:

- exact current and legacy no-op reactions perform zero persisted writes and
  preserve exact bytes;
- all 100 simultaneous distinct reactions remain present in invocation order;
- malformed, future, oversized-record, and over-limit-collection bytes remain
  unchanged;
- a full valid set refuses a new add without eviction or a durable write;
- oversized IDs stop before read/update I/O;
- a thrown native read becomes typed unavailable, not valid-empty;
- commit-response-loss retry is idempotent and performs no second write; and
- the production private-KV suite continues to prove atomic same-key
  serialization, ciphertext no-op behavior, and account-boundary fencing.

Repository verification:

```text
npm.cmd run typecheck
2 workspaces PASS

npm.cmd run lint
2 workspaces PASS, zero warnings

npm.cmd test
316 files / 3,913 tests PASS

git diff --check
PASS
```

## Result And Tradeoffs

The observed proof delta is three simultaneous writers to 100, with all 100
IDs retained. Identical current and legacy desired states now have explicit
zero-write evidence. Previously accepted records above the defensive ceilings
now classify as corrupt and remain untouched; the writer has never emitted an
unbounded batch, so this is fail-closed domain validation rather than a format
migration.

No UI component, copy, navigation, or interaction changed, so this checkpoint
does not claim new human-simulated E2E. The existing Community reaction
failure/retry E2E remains the interaction evidence for restoring the exact
durable selection.

## Rollback Trigger

Rollback or repair if the shipped writer emits a record rejected by these
bounds, a duplicate desired state changes bytes, any of 100 distinct concurrent
reactions disappears, a full set evicts an older ID, a malformed/future payload
is rewritten, or an unavailable read reaches consumers as an empty set. Any
repair must preserve strict atomic mutation and non-destructive failure rules.
