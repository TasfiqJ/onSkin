# Conflict Choice Outbox Checkpoint - 2026-07-18

## Scope

This checkpoint adopts authenticated conflict-choice publication into PERF-P0-007 / OPT-010's encrypted transactional outbox. It removes the detached best-effort `routine_conflicts` mirror without changing the local-first choice semantics, conflict copy, conservative routine invariant, or signed-out behavior.

The implementation adds:

- a strict outbox v5 envelope that still reads v1-v4 and adds one coalescing conflict state entity whose deterministic UUID, idempotency key, and payload are bound to canonical rule/product identity and SHA-256 commitments;
- one crash-recoverable encrypted transaction across conflict choices, Shelf state, and outbox state. It commits the exact choice and queues sanitized current snapshots for both referenced products before the conflict projection;
- immutable caller snapshots and account-generation assertions before/after hashing, inside the transaction, during commit-response-loss reconciliation, and before scheduling convergence;
- Shelf-first, dependency-aware leasing that leaves a conflict at attempt zero while either referenced product has ready, leased, backed-off, or dead work;
- atomic deletion pruning for any conflict projection whose referenced Shelf product is removed, while retaining its revision high-water mark as a late-worker replay fence;
- Shelf-scoped saved-local/syncing/needs-attention aggregation and retry for both product and conflict rows;
- an owner-derived security-definer RPC that recomputes canonical hashes, serializes each owner/entity in deterministic batch order, key-share-locks both owner products, verifies the current eligible rule and version, returns missing products as `retry/dependency`, stores exact replay evidence, and rejects replaced direct authenticated table DML.

## Ordering, Failure Isolation, And Replay

Conflict rows cannot lease merely because their product rows are in backoff: any same-owner Shelf row for either referenced UUID blocks them. After an unrelated Shelf endpoint failure, a conflict whose own product dependencies are already absent from the queue is still dispatched, so failure isolation does not become global starvation.

The SQL batch sorts operations by entity and operation UUID before taking per-owner/entity advisory locks. Product locks are also taken in UUID order. This avoids opposite-order lock acquisition inside concurrent batches while the per-entity lock closes the first-projection revision race. Missing products remain retriable rather than being dead-lettered as invalid input.

Deleting either local Shelf product and queueing its tombstone first discards all ready, leased, backed-off, or dead conflict projections for that product in the same encrypted transaction. The retained local revision and server-side owner/entity revision record prevent already-sent or late replay from resetting the stream. The server projection still follows product deletion through existing foreign-key behavior.

## Local Verification

- Focused mobile Vitest matrix: 10 files and 170 tests passed across pure/runtime outbox, conflict storage/routes/integration, Shelf storage, scan migration compatibility, request-policy inventory, and account-scope inventory.
- Mobile typecheck passed after the final dependency and UUID-canonicalization changes.
- Full root Vitest passed with 344 files and 4,094 tests; root typecheck and zero-warning lint passed.
- Phase 9 static RLS/data-rights gates classify the three internal coordination tables, require explicit export exclusion/deletion documentation, and require the live harness to deny direct conflict DML and exercise the owner-derived RPC.
- The credentialed live Supabase harness was updated but not run without hosted staging credentials.

Adversarial coverage includes immutable input snapshots across delayed hashing, exact three-key transaction membership, corrupt/future Shelf or outbox preservation, 100 concurrent choice writes, commit-response loss, account replacement, canonical UUID casing, payload/identity tampering, state supersession, long dependency backoff without attempt consumption, unrelated Shelf failure liveness, delete pruning with replay-fence retention, stable SQL lock ordering, direct-DML revocation, missing-product dependency responses, and current-rule eligibility.

## Human-Simulated E2E

Codex in-app browser opened Expo web at 390 x 844. Through `/shelf/manual`, it added Optimization Retinol Serum with `retinol` and Optimization Glycolic Toner with `glycolic acid`. Shelf generated the exact-pair advisory; Review conflict opened the route with both product UUIDs. Tapping Use together anyway returned to Shelf with the advisory absent, and a full reload preserved that suppression.

This proves the visible local-first save/dismiss/reload path. The run was intentionally signed out because an authenticated account-isolation fixture had previously made local cleanup unavailable; authenticated atomic queue behavior is instead covered by the focused storage/runtime tests. This is not proof of hosted RPC replay, native protected storage, background reconnect, or process death.

## Independent Review

Two agents independently audited candidate selection and the implemented durability/security slice. Their findings drove immutable input snapshots, dependency-gated leasing across Retry-After, unrelated-failure liveness, deterministic advisory-lock ordering, UUID canonicalization, deletion pruning, first-projection serialization, direct-DML live-harness correction, and explicit classification of internal outbox coordination tables. The final follow-up audit, including the pure-export dynamic-import correction, reported no unresolved P0/P1 issue.

## Evidence Boundary

Local tests prove encrypted transaction composition, owner fencing, ordering, queue behavior, failure isolation, replay inputs, strict decoding, and the migration's static SQL contract. They do not execute PostgreSQL, RLS, grants, concurrent hosted transactions, provider networking, or native process termination.

Conflict client revisions are device-local. A fresh install or second device cannot yet supersede an already higher server revision, so cross-device convergence needs an authoritative revision policy before it may be claimed. The bounded 1,024-entry revision index also needs long-lived scale evidence or a governed compaction/migration policy. Those P1 design debts, plus hosted and signed-device evidence, keep OPT-010 in progress rather than verified.
