# Outbox Clock-Rollback Repair

Date: 2026-07-25

## Finding

The outbox persists absolute wall-clock scheduling fields. If a device clock is
corrected backward after enqueue, settlement, or leasing, a ready row can remain
behind a future `nextAttemptAt`, and an orphaned leased row can remain behind a
future `leaseExpiresAt`. A sufficiently large correction can strand work for
months or years even though the worker is healthy.

The protocol already defines the maximum legal future horizons:

- `OUTBOX_MAX_RETRY_MS`: five minutes;
- `OUTBOX_LEASE_MS`: 30 seconds.

A timestamp beyond those horizons relative to an explicit flush time cannot
have been produced by a valid current retry or lease.

## Change

`leaseReadyOutboxRows()` now repairs only those impossible owner-scoped values
before ordinary compaction and selection:

- a ready `nextAttemptAt` more than five minutes ahead is rebased to the
  caller-supplied `now`;
- a leased `leaseExpiresAt` more than 30 seconds ahead is reclaimed to ready,
  its old lease fields are cleared, and normal leasing can assign a new owner.

The repair does not change envelope schema, persisted decoding, `enqueuedAt`,
immutable payload timestamps, idempotency keys, client revisions, or normal
retry delays. Exact five-minute and 30-second boundaries are preserved. A
forward clock jump continues through the existing expired-lease path, with
owner and server-idempotency fencing unchanged.

## Verification

```text
npm.cmd --workspace apps/mobile exec vitest run src/lib/offline/outbox.pure.test.ts src/lib/offline/outbox.test.ts
npm.cmd --workspace apps/mobile run typecheck
npm.cmd --workspace apps/mobile exec eslint -- --max-warnings=0 src/lib/offline/outbox.pure.ts src/lib/offline/outbox.pure.test.ts
npm.cmd --workspace apps/mobile test
git diff --check
```

Results:

- Focused outbox matrix: 2 files / 85 tests passed.
- Mobile type-check: passed.
- Exact changed-file lint with zero warnings: passed.
- Full mobile run: 359 of 361 files and 4,316 of 4,320 tests passed. The same
  four unrelated dirty-worktree failures remain in Shelf provenance and the
  notification behavioural snapshot; the failure set is unchanged.
- Patch whitespace validation: passed.

The focused matrix proves far-future ready-row recovery, orphan lease
reassignment, stale-owner settlement rejection, exact-boundary preservation,
owner scoping, normal attempt accounting, unchanged schema, and unchanged
immutable event identity.

Human-simulated E2E is not applicable because this is a pure scheduling and
lease-fencing correction with no UI change.

## Remaining Evidence

Signed-device manual clock changes, process death during a lease, and physical
offline/reconnect proof remain open. The separate Shelf local-date/server-date
boundary still requires its forward database constraint.
