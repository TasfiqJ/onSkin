# Outbox Persisted-Deadline Scheduler

Date: 2026-07-26

## Finding

The encrypted outbox persisted `nextAttemptAt` and `leaseExpiresAt`, but the
worker had no timer for either deadline. It drained at most four 25-row batches
and then ran again only after an external mount, foreground, reconnect, or
mutation trigger.

That left three healthy foreground cases stranded:

- a rate-limit, server, or timeout retry could remain ready after its deadline;
- a normal orphan lease observed before expiry could remain leased after
  expiry;
- row 101 and later could remain ready after the 100-row per-drain budget.

## Change

`nextOutboxWakeAt()` is a pure owner-scoped selector shared with lease
preparation. It returns the exact earliest persisted deadline, or the explicit
current time for due work and impossible/expired scheduling horizons. It
mirrors latest-ready compaction, leased-identity fencing, and Shelf dependency
blocking.

The selector deliberately returns no timer for:

- dead rows;
- request-level validation failures;
- offline and authentication failures, which wait for their existing external
  recovery signals;
- conflict rows still blocked by a Shelf operation.

The runtime now owns one replaceable timer. It:

- arms only after releasing the single-flight drain;
- uses a generation token so a cleared but already-queued callback cannot
  interfere with a replacement;
- wakes at exact retry and lease boundaries;
- uses a zero-delay next-tick wake for immediately due backlog beyond 100 rows;
- performs a lightweight 30-second clock check while waiting, without touching
  storage or the network under a normal clock, and recomputes after forward or
  backward wall-clock shifts;
- re-runs authenticated owner capture and hashing on every wake;
- derives pending diagnostics and dead counts from the final authenticated
  owner's rows rather than cumulative attempts or another retained owner.

`OfflineSync` activates scheduling only while the app is active. Background
mount, connectivity recovery, producer scheduling, timer callbacks, and
unmounted work are suppressed; foreground activation performs the existing
reconciliation drain.

## Verification

```text
npm.cmd --workspace apps/mobile exec vitest run src/lib/offline/outbox.pure.test.ts src/lib/offline/outbox.test.ts src/lib/offline/OfflineSync.test.ts
npm.cmd --workspace apps/mobile run typecheck
npm.cmd --workspace apps/mobile exec eslint -- --max-warnings=0 src/lib/offline/outbox.pure.ts src/lib/offline/outbox.pure.test.ts src/lib/offline/outbox.ts src/lib/offline/outbox.test.ts src/lib/offline/OfflineSync.tsx src/lib/offline/OfflineSync.test.ts
npm.cmd exec prettier -- --check apps/mobile/src/lib/offline/outbox.pure.ts apps/mobile/src/lib/offline/outbox.pure.test.ts apps/mobile/src/lib/offline/outbox.ts apps/mobile/src/lib/offline/outbox.test.ts apps/mobile/src/lib/offline/OfflineSync.tsx apps/mobile/src/lib/offline/OfflineSync.test.ts
npm.cmd --workspace apps/mobile test
git diff --check
```

Results:

- Focused pure/runtime/lifecycle matrix: 3 files / 108 tests passed.
- Mobile type-check: passed.
- Exact changed-file lint with zero warnings: passed.
- Prettier and patch whitespace checks: passed.
- Full mobile run: 359 of 361 files and 4,341 of 4,345 tests passed. The same
  four unrelated dirty-worktree failures remain in Shelf provenance and the
  notification behavioural snapshot; the failure set is unchanged.
- Independent final adversarial review: no remaining P0/P1 finding.

The focused matrix proves exact Retry-After and lease-expiry wakes, no work at
one millisecond before the boundary, restart-style persisted lease recovery,
the 100-row public result followed by a next-tick row-101 drain, validation /
offline / authentication suppression, dependency quiet time, token-fenced
timer replacement, normal-clock storage silence, forward/rollback
recomputation, owner re-resolution, owner-scoped dead counts and diagnostics,
and worker reset cleanup.

Human-simulated E2E is not applicable because this changes background
scheduling and synchronization infrastructure without changing a visible user
flow.

## Remaining Evidence

Signed-device process death, native background/foreground delivery, clock
changes, and connectivity recovery remain required. The source-level lifecycle
contract intentionally treats `AppState.currentState === null` as inactive
until React Native emits an active transition. An explicit drain already in
flight may finish after backgrounding; new producer and timer work is
suppressed.
