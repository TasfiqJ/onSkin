# Completion-Queue Atomic No-Op Checkpoint

Date: 2026-07-16

Branch: `optimization`

Checkpoint parent: `46e24f7c325413541691eee2ea05b3131a19fbe4`

Items: `PERF-P0-005`, `OPT-007`, `OPT-008`

## Invariant

The encrypted completion queue must accept only a strict current application
schema while retaining the installed legacy-array reader. Invalid input must
not enter private storage. A duplicate enqueue or a flush that removes nothing
must retain the exact prior payload and perform zero durable writes. Distinct
same-key enqueues must compose inside `updatePrivateItem` without dropping any
writer. Unreadable or future bytes must remain preserved and cannot become an
empty queue.

This checkpoint hardens the existing deferred completion queue. It does not
claim the transactional, owner-bound, retry/backoff outbox required by
`PERF-P0-007` / `OPT-010`.

## Baseline Finding

The current v1 decoder accepted extra envelope fields, duplicate completion
identities, noncanonical IDs/timestamps, and extra row fields, then normalized
or deduplicated them silently. A later mutation could therefore rewrite bytes
that the current schema should have classified as corrupt.

`enqueueCompletion` always entered `updatePrivateItem`. An invalid completion
over an absent key encoded and persisted an empty v1 queue. An identical
completion over the legacy array re-encoded that array as a v1 envelope even
though no new work was added. A transient flush with no removable rows likewise
rewrote a valid legacy array. The concurrency test exercised only 40 writers,
below the plan's required 100-way proof.

## Implementation

- Current envelopes now require exactly `version` and `items`.
- Every current row requires exactly `userId`, `routineId`, `stepId`,
  `completedDate`, and `enqueuedAt`, with canonical values and ISO timestamp.
- Duplicate identities in current v1 data are corruption; the legacy-array
  reader still normalizes and deduplicates without read-time repair.
- Invalid enqueue payloads return before `updatePrivateItem`.
- Duplicate enqueues return the exact current payload, including legacy bytes.
- Flush reconciliation returns the exact current payload when no identities
  are removable or when no current row matches the removal set.
- The schema version and encryption format are unchanged; no migration or
  destructive recovery was introduced.

## Deterministic Evidence

Focused matrix:

```text
npm.cmd --workspace @layerwell/mobile test -- --run \
  src/lib/offline/completionQueue.test.ts \
  src/lib/storage/privateKV.test.ts \
  src/features/today/completionsStore.test.ts \
  src/lib/auth/accountGeneration.test.ts

4 files / 124 tests PASS
```

The focused tests prove:

- exact current-envelope and current-row validation;
- corrupt, unavailable, and future bytes remain intact;
- invalid inputs perform no private-store call and create no empty record;
- identical legacy and current enqueues retain exact bytes with zero persisted
  writes;
- a transient legacy flush with no removable row retains exact bytes with zero
  persisted writes;
- a concurrent enqueue arriving during a flush survives reconciliation;
- an account boundary aborts owner-A network work and retains owner-A bytes;
- all 100 simultaneous distinct enqueues remain present, with 100 intentional
  durable writes under the serialized mock;
- the production private-KV suite continues to prove same-key serialization,
  account-boundary fencing, and ciphertext preservation.

Repository verification:

```text
npm.cmd run typecheck
2 workspaces PASS

npm.cmd run lint
2 workspaces PASS, zero warnings

npm.cmd test
316 files / 3,906 tests PASS

git diff --check
PASS
```

## Result And Tradeoffs

Deterministic persisted-write counts changed as follows:

- invalid enqueue on an absent key: 1 -> 0;
- duplicate enqueue over legacy bytes: 1 -> 0;
- transient no-removal flush over legacy bytes: 1 -> 0;
- 100 distinct enqueues: 100 -> 100, with no lost identity.

Strict current decoding can expose bytes written by an unsupported
noncanonical writer as corrupt instead of silently accepting them. The shipped
writer already emits the canonical shape, and the separate legacy-array reader
remains compatible, so this is fail-closed schema enforcement rather than a
storage-format migration.

No UI component, copy, navigation, or interaction changed, so this checkpoint
does not claim new human-simulated E2E. The live completion source of truth and
Today UI remain covered by their existing E2E; activating this queue as a real
sync path still depends on the reviewed OPT-010 outbox architecture.

## Rollback Trigger

Rollback or repair if a queue emitted by the shipped writer is rejected, a
duplicate or transient no-removal path changes durable bytes, any of 100
distinct concurrent enqueues disappears, an account-A flush mutates account-B
state, or unreadable data reaches consumers as an empty queue. A rollback must
retain the rule that invalid input cannot create or rewrite a private record.
