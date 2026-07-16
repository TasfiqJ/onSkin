# Recommendation-Preference Atomic No-Op Checkpoint

Date: 2026-07-16

Branch: `optimization`

Checkpoint parent: `77c2434257a12060fb94aa152256149fdc776b50`

Items: `PERF-P0-005`, `OPT-007`, `OPT-008`

## Invariant

Recommendation preference saves are complete user-selected snapshots. Every
snapshot must validate before storage, serialize under the same private-key
transform, and publish in invocation order. Saving a semantically identical
current or installed legacy snapshot must preserve the exact prior bytes and
must not enqueue a best-effort server mirror.

## Baseline Finding

Current preference snapshots were strict, bounded, owner-scoped, atomic, and
exact current duplicates were true no-ops. The installed legacy object was
decoded without read-time repair, but saving its already-durable semantic state
rewrote it as a current envelope and enqueued a mirror. Dismissed suggestions
already had 100 distinct-writer proof; the preference half of the same private
domain had no 100-writer last-writer ordering proof.

## Implementation

- No-op comparison now uses the strictly decoded semantic preferences for both
  current and legacy formats.
- An identical legacy save returns the exact input payload from
  `updatePrivateItem`, records zero durable writes, and queues no mirror.
- The versioned current writer, bounds, strict mutation validator, owner lease,
  and explicit mutation-only legacy migration remain unchanged.
- Added 100 simultaneous complete-snapshot saves. Because the form submits all
  fields as one user intent, the contract is invocation-order last-writer-wins,
  not field-by-field merge.

## Deterministic Evidence

Focused matrix:

```text
npm.cmd --workspace @onskin/mobile test -- --run \
  src/features/recommendations/store.test.ts \
  src/features/recommendations/dismissalMutation.test.ts \
  src/lib/storage/privateKV.test.ts \
  src/lib/storage/privateStringSet.test.ts

4 files / 108 tests PASS
```

The focused tests prove:

- identical current and legacy snapshots retain exact bytes and perform zero
  durable writes;
- the legacy no-op enqueues no Supabase mirror;
- all 100 simultaneous complete preference saves write in invocation order and
  the final durable envelope equals snapshot 100;
- all 100 best-effort mirror evaluations are queued after their local commits;
- 100 distinct dismissed IDs remain present, while repeated dismissal is a
  true no-op; and
- malformed, oversized, unavailable, and future preference/dismissal bytes
  remain preserved behind typed failures.

Repository verification:

```text
npm.cmd run typecheck
2 workspaces PASS

npm.cmd run lint
2 workspaces PASS, zero warnings

npm.cmd test
316 files / 3,924 tests PASS

git diff --check
PASS
```

## Named PERF-P0-005 Store Audit Result

The named compact/high-value mutation stores now all have deterministic 100-way
same-key proof in their store suites: Shelf, completion history, Ramp, routine
order, notification preferences, notification sent ledger, recommendation
preferences, recommendation dismissals, milestones, Community reactions, and
the completion queue. Their strict codecs, typed reads, bounds, exact no-ops,
and byte-preserving failure behavior remain covered by the focused and registry
matrices. This closes the local named-store proof audit; it does not implement
OPT-010's cross-domain transactional outbox or substitute for native fault and
process-death evidence.

## Result And Tradeoffs

An identical legacy save no longer upgrades schema merely because the user
pressed Save. A genuinely changed legacy preference still migrates atomically
to the current envelope. Concurrent saves retain full-snapshot semantics: the
last invoked complete form wins, which matches the executable preference UI and
avoids merging fields from different user intents.

No component, copy, navigation, or interaction changed, so this checkpoint does
not claim new human-simulated E2E. Existing recommendation read/write recovery
evidence remains the UI acceptance packet.

## Rollback Trigger

Rollback or repair if an identical legacy/current save changes bytes or mirrors,
the final state of 100 ordered snapshot saves is not the last invocation,
malformed/future data is rewritten, or unreadable preferences reach a consumer
as defaults. Do not restore read-time or semantic-no-op migration.
