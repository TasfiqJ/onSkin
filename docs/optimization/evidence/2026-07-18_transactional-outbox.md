# Transactional Outbox Evidence

Date: 2026-07-18 (America/Toronto)

Branch: `optimization`

Decision: OPT-DEC-003 / Architecture A-009

## Implemented Boundary

- Encrypted private-KV transactions use a bounded encrypted intent journal and roll every committed target forward before ordinary private reads or writes.
- Authenticated Shelf add, edit, lifecycle, delete, and replenish mutations commit the unchanged Shelf v3 value and `layerwell.outbox.v1` together.
- Outbox payloads exclude raw owner identity, credentials, ingredients, and local paths. Owner binding is a domain-separated SHA-256 hash plus account generation.
- Ready Shelf mirrors coalesce per entity. Leased and dead-letter rows remain. Revisions and operation/idempotency identities are monotonic and persisted.
- The worker is single-flight, account-generation fenced, foreground/reconnect/mutation triggered, lease based, limited to 25 rows per batch and four batches per wake, and persists full-jitter backoff plus bounded `Retry-After`.
- The authenticated batch RPC derives the owner from `auth.uid()`, records operation receipts, serializes per-entity revision, and isolates permanent validation failures from independent rows.
- Local diagnostics expose only ready/in-flight/dead counts and a content-free last-sync result.

## Local Automated Proof

Focused suites cover:

- two-key transaction success, partial-target interruption recovery, response-loss recovery, and 100 concurrent transactions;
- strict current/future/corrupt outbox codecs and forbidden identity/credential payload fields;
- state coalescing, revision increments, expired duplicate-worker takeover, stale settlement rejection, permanent poison isolation, and persisted Retry-After;
- runtime single flight, raw-owner exclusion from RPC payloads, applied/duplicate convergence, reconnect drain, account-generation cancellation, and bounded 25-row multi-batch delivery;
- authenticated Shelf transaction/enqueue, uncertain add recovery, owner change, delete/replenish paths, and worker scheduling;
- account-cleanup registry coverage, request-policy inventory, lifecycle triggers, and diagnostics normalization.

Verified locally on 2026-07-18:

- `npm.cmd run typecheck`: 2/2 workspace tasks passed.
- `npm.cmd run lint`: 2/2 workspace tasks passed with zero warnings.
- `npm.cmd test`: 336/336 files and 4,005/4,005 tests passed.
- The focused outbox/storage/Shelf/request/diagnostics run passed 12/12 files and 194/194 tests.
- `node --test scripts/phase9/shelf-outbox-rpc-contract.test.mjs`: 3/3 contracts passed.
- `node scripts/phase9/supabase-policy-lint.mjs`: passed code gates.

## Rollback

- The Shelf v3 codec and local Shelf key are unchanged.
- The outbox key, transaction journal, server receipt/version tables, and RPC are additive.
- An older client can continue using existing owner-RLS Shelf APIs. Pending encrypted intents may remain dormant after client rollback but local Shelf state remains authoritative and account cleanup still removes registered private data.
- Do not remove server receipt/version state during a client rollback; it is harmless to older clients and preserves deduplication if the optimized client returns.

## Remaining Release Evidence

- Apply the migration to hosted staging and prove authenticated duplicate, reordered, mixed poison/success, and response-loss calls against Postgres.
- Force-kill a supported iPhone after journal commit and after each target write, then prove automatic roll-forward and byte preservation.
- Prove background cancellation, reconnect, account A-to-B cleanup, and bounded drain on a signed release build.
- Add the reviewed user-facing saved-locally/syncing/needs-attention presentation before claiming the full PERF-P0-007 experience complete.
- Completion history remains on the legacy isolated queue until real server routine/step UUIDs are authoritative; when migrated it must use a non-coalescing immutable-event contract.
