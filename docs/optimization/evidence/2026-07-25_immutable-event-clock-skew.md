# Immutable Event Clock-Skew Contract

Date: 2026-07-25

## Finding

Notification-delivery and Shelf-scan producers use device wall time for both
the immutable payload timestamp and enqueue time. The client admitted canonical
ISO values, while both RPCs classified timestamps more than five minutes ahead
of the server as permanent validation failures. A skewed device could therefore
create silent dead rows; Shelf-scan dead rows also consumed the bounded
128-event client capacity.

## Decision

Do not clamp the event time and do not make persisted decoding depend on the
current clock:

- clamping would fabricate telemetry and change the meaning of a payload-bound
  event;
- retrying would exhaust the bounded retry budget under material clock skew;
- time-dependent decoding would make the same encrypted bytes alternate
  between valid and invalid.

A structurally valid event beyond the five-minute future allowance is instead a
terminal no-op. The RPC persists its exact replay receipt with status `stale`,
inserts no notification/scan domain row, and returns a successful terminal
result that the worker removes. Duplicate lookup stays before time disposition,
so the exact raw payload/idempotency identity always replays as `duplicate`.

## Change

- Added forward migration
  `20260726000055_immutable_event_clock_skew.sql`.
- Used exact, fail-closed `pg_get_functiondef` transforms so the two established
  concurrency/idempotency bodies are not copied or allowed to drift.
- Removed only the future timestamp from structural validation and added it to
  the existing receipt-backed stale branch.
- Added postconditions and idempotent reapplication handling for both function
  definitions.
- Tightened the client event grammar to the RPC's four-digit millisecond UTC
  form and required payload time to equal `enqueuedAt`.
- Added worker coverage proving `stale` settles both event types as successful
  content-free convergence.
- Added a disposable PostgreSQL replay harness over the exact predecessor and
  forward migrations.

## PostgreSQL Replay

The PostgreSQL 15.18 harness first applies migrations 49 and 50 and observes
this ordered status vector for both RPCs:

```text
29-day past     -> applied
31-day past     -> stale
4-minute future -> applied
6-minute future -> permanent
```

After applying migration 55 twice, the same inputs produce:

```text
29-day past     -> applied
31-day past     -> stale
4-minute future -> applied
6-minute future -> stale
```

An exact second send returns four `duplicate` results for each RPC. The final
database contains two notification rows, two Shelf-scan rows, four notification
receipts, and four scan receipts. The replay also proves:

- both functions remain `SECURITY DEFINER` with an empty `search_path`;
- only `authenticated` retains execute permission;
- anonymous execution and direct authenticated domain inserts remain denied;
- a second forward-migration application leaves the combined function
  definition hash unchanged.

## Verification

```text
npm.cmd --workspace apps/mobile exec vitest run src/lib/offline/outbox.pure.test.ts src/lib/offline/outbox.test.ts src/features/notifications/notificationDeliveryOutboxMigration.test.ts src/features/shelf/shelfScanOutboxMigration.test.ts
node scripts/optimization/outbox-event-clock-skew-postgres-replay.mjs
npm.cmd --workspace apps/mobile run typecheck
npm.cmd --workspace apps/mobile exec eslint -- --max-warnings=0 src/lib/offline/outbox.pure.ts src/lib/offline/outbox.pure.test.ts src/lib/offline/outbox.test.ts src/features/notifications/notificationDeliveryOutboxMigration.test.ts src/features/shelf/shelfScanOutboxMigration.test.ts
node --check scripts/optimization/outbox-event-clock-skew-postgres-replay.mjs
npm.cmd --workspace apps/mobile test
git diff --check
```

Results:

- Focused mobile matrix: 4 files / 94 tests passed.
- Strict disposable PostgreSQL 15.18 replay: passed.
- Mobile type-check: passed.
- Exact changed-file lint with zero warnings: passed.
- Replay harness syntax check: passed.
- Full mobile run: 359 of 361 files and 4,314 of 4,318 tests passed. The same
  four unrelated dirty-worktree failures remain in Shelf provenance and the
  notification behavioural snapshot; the failure set is unchanged.
- Patch whitespace validation: passed.

Human-simulated E2E is not applicable because this changes server disposition
and persisted contract validation without a UI surface.

## Remaining Evidence

Hosted RPC replay/RLS/concurrency and signed-device offline, reconnect,
process-kill, duplicate-worker, and presentation proof remain open. Existing
already-dead rows are not resurrected. The analogous Shelf local-date/server-day
boundary and manual device-clock rollback scheduling remain separate follow-up
contracts.
