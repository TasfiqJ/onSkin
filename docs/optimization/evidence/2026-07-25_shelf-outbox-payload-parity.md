# Shelf Outbox Payload Parity

Date: 2026-07-25

## Finding

The Shelf producer emitted the RPC's intended 17-field projection, but the
client outbox admitted any bounded JSON object. Locally valid values could
therefore exceed the server's text bounds, contain non-UUID catalog IDs, use a
PAO value above 1,200 months, or otherwise fail the RPC after the local commit.
Those rows became permanent validation failures instead of being rejected at
the transaction boundary.

## Invariant

An authenticated Shelf upsert may commit only when its outbox payload satisfies
the complete client-provable RPC contract:

- the exact 17 keys and existing 64 KiB/secret-field protections;
- 1–512 UTF-8 bytes for name and optional brand;
- 1–128 UTF-8 bytes for an optional barcode;
- nullable UUID catalog identifiers;
- exact quality, PAO, expiry, intake, and status enums;
- real nullable `YYYY-MM-DD` calendar dates;
- nullable integer PAO months from 1 through 1,200;
- a boolean opened flag;
- a nullable canonical disclosure timestamp.

Authentication, foreign-key existence, server time, revision locking, receipt
uniqueness, and idempotency collision handling remain server-authoritative.

## Change

- Added the typed `ShelfProductOutboxPayload` and ordered
  `SHELF_PRODUCT_OUTBOX_PAYLOAD_KEYS` contract to the outbox codec.
- Replaced generic Shelf-upsert JSON admission with exact field, type, byte,
  UUID, enum, date, integer, and timestamp validation.
- Typed `shelfProductOutboxPayload()` and its transactional change object to the
  exact projection.
- Canonicalized parseable disclosure timestamps during Shelf decoding so
  equivalent legacy offset/short-UTC forms cannot be falsely rejected later.
- Bound the client key list to the migration's required payload-key array.
- Added valid-boundary, missing/extra key, multibyte text, UUID, enum, impossible
  date, PAO, timestamp, and atomic no-write tests.

This intentionally changes invalid authenticated mutations from
commit-then-dead-letter to fail-before-commit. Valid Shelf payload bytes and the
server schema are unchanged.

## Verification

```text
npm.cmd --workspace apps/mobile exec vitest run src/lib/offline/outboxEntities.test.ts src/lib/offline/outbox.pure.test.ts src/lib/offline/outbox.test.ts src/features/shelf/store.test.ts src/features/shelf/shelfAvailability.test.ts src/features/shelf/mutations.test.ts src/features/shelf/mutations.addIdempotency.test.ts src/features/intelligence/overrides.test.ts
node --test scripts/phase9/shelf-outbox-rpc-contract.test.mjs
npm.cmd --workspace apps/mobile run typecheck
npm.cmd --workspace apps/mobile exec eslint -- --max-warnings=0 src/lib/offline/outbox.pure.ts src/lib/offline/outbox.pure.test.ts src/lib/offline/outbox.test.ts src/lib/offline/outboxEntities.test.ts src/features/shelf/store.ts src/features/shelf/store.test.ts src/features/intelligence/overrides.test.ts
npm.cmd --workspace apps/mobile test
git diff --check
```

Results:

- Focused mobile matrix: 8 files / 182 tests passed.
- Shelf RPC source contract: 3 tests passed.
- Mobile type-check: passed.
- Exact changed-file lint with zero warnings: passed.
- Full mobile run: 359 of 361 files and 4,310 of 4,314 tests passed. The same
  four unrelated dirty-worktree failures remain in Shelf provenance and the
  notification behavioural snapshot; the failure set is unchanged from the
  pre-slice baseline.
- Patch whitespace validation: passed.

Human-simulated E2E is not applicable because this is a persisted-contract
admission fix with no UI change. The transaction-path test exercises the actual
authenticated Shelf write boundary.

## Remaining Evidence

Hosted RPC replay/RLS/concurrency and signed-device offline, reconnect,
process-kill, duplicate-worker, and presentation proof remain open. Immutable
event clock skew and device-clock rollback scheduling are separate contracts
and are not claimed by this slice.
