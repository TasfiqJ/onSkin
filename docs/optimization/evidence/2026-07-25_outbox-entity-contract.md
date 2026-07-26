# Transactional Outbox Entity Contract

Date: 2026-07-25

## Finding

The client codec, lease scheduler, worker, diagnostics, receipt constraint, and
six RPCs currently agreed on the same six outbox entities, but that agreement
was duplicated. In particular, the worker's nested RPC ternary routed any
future unhandled entity to the recommendation-preferences RPC. A new entity
could therefore compile while silently missing one or more validator, priority,
routing, counter, or schema updates.

## Invariant

One typed runtime registry must define every admitted entity's:

- permitted operation modes;
- immutable-event classification;
- lease priority;
- authenticated batch RPC;
- content-free flush-counter key.

The schema-head receipt constraint must contain exactly that entity set. Every
mapped RPC must exist, derive the owner from `auth.uid()`, accept at most 25
operations, require the exact seven client wire fields, enforce its own entity
literal and operation modes, and require revision one for immutable events.

## Change

- Added `outboxEntities.ts` as the dependency-free entity registry.
- Derived the public entity and operation types from the registry.
- Replaced the codec's entity validator, operation admission,
  immutable-event branch, and priority map with registry lookups.
- Replaced the worker's fallback RPC ternary, manual entity loop, and six
  independent flush-counter paths with registry-derived behavior.
- Added an executable client/RPC/schema parity test against migrations 46
  through 51 and the final migration's receipt constraint.

No persisted bytes, schema, RPC behavior, retry policy, user-visible state, or
UI changed in this slice.

## Verification

```text
npm.cmd --workspace apps/mobile exec vitest run src/lib/offline/outboxEntities.test.ts src/lib/offline/outbox.pure.test.ts src/lib/offline/outbox.test.ts src/features/notifications/notificationOutboxMigration.test.ts src/features/notifications/notificationDeliveryOutboxMigration.test.ts src/features/recommendations/recommendationOutboxMigration.test.ts src/features/shelf/shelfScanOutboxMigration.test.ts src/features/intelligence/conflictChoiceOutboxMigration.test.ts
node --test scripts/phase9/shelf-outbox-rpc-contract.test.mjs
npm.cmd --workspace apps/mobile run typecheck
npm.cmd --workspace apps/mobile exec eslint -- --max-warnings=0 src/lib/offline/outboxEntities.ts src/lib/offline/outboxEntities.test.ts src/lib/offline/outbox.pure.ts src/lib/offline/outbox.ts
git diff --check
```

Results:

- Focused mobile matrix: 8 files / 79 tests passed.
- Shelf RPC source contract: 3 tests passed.
- Mobile type-check: passed.
- Exact changed-file lint with zero warnings: passed.
- Patch whitespace validation: passed.

Human-simulated E2E is not applicable because this is a behavior-neutral
runtime/schema contract refactor with no UI change.

## Remaining Evidence

Hosted RPC replay/RLS/concurrency and signed-device offline, reconnect,
process-kill, duplicate-worker, and presentation proof remain open. The Shelf
payload boundary and future-event clock-skew policy are separate behavioral
contracts and are not claimed by this registry refactor.
