# Shelf Local-Date Boundary

Date: 2026-07-25

## Finding

Shelf freshness dates are user-local calendar dates, but the original database
constraint compared `opened_at` with PostgreSQL `current_date`. That value
depends on the database session time zone and is UTC today in the deployed
server contract.

A user east of UTC can therefore open or replenish a product after local
midnight while the server is still on the previous UTC date. The client accepts
that legitimate local date, but the Shelf outbox RPC caught the database check
violation and returned a permanent validation result. The row could not recover
automatically when UTC reached midnight.

`reAddProduct()` also derived its Shelf dates with `toISOString().slice(0, 10)`,
which is a UTC date despite the local-calendar field contract.

## Change

Forward migration
`supabase/migrations/20260726000056_shelf_local_date_boundary.sql` installs a
replacement opened-state check that:

- keeps opened rows paired with a non-null date and unopened rows paired with a
  null date;
- compares against the explicit UTC statement date, independent of session
  `TimeZone`;
- permits UTC tomorrow, the maximum legitimate local-calendar lead across
  supported world time zones;
- continues to reject UTC+2 and later dates;
- adds and validates the replacement before dropping the old constraint, then
  restores the canonical constraint name.

The client now captures one `Date` for replenishment. It derives the local
calendar identity once for `openedAt`, `finishedAt`, and freshness
normalization, while the same instant supplies UTC `createdAt` and `updatedAt`
timestamps.

## Executable PostgreSQL Proof

`scripts/optimization/shelf-local-date-postgres-replay.mjs` starts an isolated
PostgreSQL 15.18 container, installs the original Shelf invariant and
authenticated outbox RPC, reproduces the failure, applies the forward
migration, and verifies the result.

The proof observed:

```text
before: [applied, permanent, permanent, applied]
after Honolulu: [applied, applied, permanent, applied]
after Kiritimati: [applied, applied, permanent, applied]
exact replay: [duplicate, duplicate, permanent, duplicate]
```

Direct constraint checks under UTC, Pacific/Honolulu, and
Pacific/Kiritimati each accepted UTC today, UTC tomorrow, and a coherent
unopened row. Each rejected UTC+2, opened-without-date, and
unopened-with-date rows with SQLSTATE `23514` and the canonical constraint.
The two mixed RPC batches retained exactly six products, six mirror versions,
and six receipts; rejected rows created none. Reapplying the migration kept the
validated constraint definition unchanged.

## Verification

```text
node scripts/optimization/shelf-local-date-postgres-replay.mjs
npm.cmd --workspace apps/mobile exec vitest run src/features/shelf/freshnessMigration.test.ts src/features/shelf/store.test.ts src/features/shelf/freshness.test.ts src/lib/offline/outbox.pure.test.ts src/lib/offline/outbox.test.ts
npm.cmd --workspace apps/mobile run typecheck
npm.cmd --workspace apps/mobile exec eslint -- --max-warnings=0 src/features/shelf/freshnessMigration.test.ts src/features/shelf/store.ts src/features/shelf/store.test.ts
npm.cmd --workspace apps/mobile test
git diff --check
```

Results:

- PostgreSQL 15.18 boundary/replay harness: passed.
- Focused integration matrix: 5 files / 144 tests passed.
- Mobile type-check: passed.
- Exact changed-file lint with zero warnings: passed.
- Full mobile run: 359 of 361 files and 4,319 of 4,323 tests passed. The same
  four unrelated dirty-worktree failures remain in Shelf provenance and the
  notification behavioural snapshot; the failure set is unchanged.
- Patch whitespace validation: passed.

Human-simulated E2E is not applicable because this corrects local persistence
and database synchronization contracts without changing a user-visible flow.

## Remaining Evidence

Hosted migration/RPC execution and signed-device proof across real date-line
travel remain open.
