# Shelf Scan Outbox Checkpoint - 2026-07-18

## Scope

This checkpoint adopts authenticated Shelf-scan intake into PERF-P0-007 / OPT-010's encrypted transactional outbox. It replaces the former best-effort direct `shelf_scans` insert without changing catalog lookup, scan-result copy, analytics meaning, camera behavior, or the offline recovery paths.

The implementation adds:

- a strict outbox v4 envelope that still reads v1-v3, represents every scan as an immutable revision-one event, and binds its idempotency key to the operation UUID plus a SHA-256 commitment over the exact canonical payload;
- a 128-row Shelf-scan cap inside the 512-row global queue, state-first leasing/dispatch, and operation-scoped settlement so scan telemetry cannot fill the queue, jump ahead of state mirrors, or back off unrelated leased rows when its endpoint fails;
- locally published authenticated owner input, account-generation fencing through hash and encrypted same-key append, exact commit-response-loss readback, and flush scheduling only after a confirmed write;
- a 6-14 digit numeric barcode boundary, a true-match-only internal product UUID, and analytics that contain result metadata but no raw barcode;
- an authenticated security-definer RPC that derives the owner from `auth.uid()`, validates exact bounded fields, recomputes the canonical SHA-256 commitment, stores only that commitment in receipts, atomically applies scan plus receipt, and marks telemetry older than 30 days stale;
- removal of authenticated direct INSERT and UPDATE policy/privileges, plus a `FOR KEY SHARE` catalog-reference lock so concurrent product deletion cannot poison a valid replay.

## Failure Isolation And Replay

The worker settles each leased entity group against an explicit unique operation-ID scope. A Shelf, notification-preference, recommendation-preference, notification-delivery, or Shelf-scan request failure backs off only that group's rows; later groups are still attempted, and the worker stops only after the complete leased batch is settled. Crash, storage, and account-boundary interruptions retain the existing lease-expiry recovery path.

The RPC's inner PL/pgSQL exception block keeps scan and receipt writes in one subtransaction. Exact operation/idempotency/hash/entity/revision receipts converge committed-response loss and concurrent replay; unrelated collisions remain permanent validation failures. Receipts never retain the raw barcode.

## Local Verification

- Focused mobile Vitest matrix: 7 files and 111 tests passed across pure/runtime outbox, scan intake, RPC migration, route, request-policy inventory, and account-scope inventory.
- Independent durability follow-up: 4 files and 65 tests passed with no unresolved P0/P1 issue.
- Full root Vitest: 344 files and 4,087 tests passed.
- Root typecheck passed for mobile and shared types; root zero-warning lint passed.
- Prettier and `git diff --check` passed for the checkpoint files.

Adversarial coverage includes v1-v4 decoding, malformed/future bytes, 15+ digit rejection, a 128-event telemetry cap, state-first leasing, scoped mixed-entity failure settlement, 100 concurrent distinct scan events, owner loss during hashing, invalid/external product binding, corrupt-state preservation, stale owner scopes, committed-write response loss, payload/hash mismatch rejection, receipt collisions, missing/deleting catalog products, and direct table privilege removal.

## Human-Simulated E2E

Codex in-app browser opened Expo web `/shelf/scan` at 390 x 844 with `EXPO_PUBLIC_E2E_SHELF_SCAN_RESULT=offline` and barcode `012345678905`. The route showed the offline catalog message and all three recovery controls. User-like taps reached `/shelf/ocr`, `/shelf/search`, and `/shelf/manual`; Close returned to `/shelf`.

Close measured 48 px high and each recovery row measured about 76 px high. Every visible control's center hit-test resolved to itself. The document measured 390 px wide inside a 390 px viewport with no horizontal overflow, and route-level warning/error logs were empty. Native camera, real barcode decoding, background/relaunch, and protected-storage behavior remain device QA.

## Independent Review

Two read-only agents audited the implemented slice. The checkpoint corrected five P1 risk areas before completion: cross-entity failure isolation with state-before-telemetry dispatch; authenticated post-insert mutation; a catalog-deletion race; committed-write response-loss scheduling; and an over-broad barcode bound. Both follow-up reviews returned with no unresolved P0/P1 issue.

## Rejected Adjacent Candidate

A proposed consent-ledger retry/idempotency slice was fully discarded before this checkpoint. A terminal client timeout can still be followed by a late server commit; rolling back the local grant while that server ledger later enables cloud health-data enforcement would be unsafe. No consent file or behavior is included in this checkpoint. A future protocol needs an authoritative terminal reconciliation model before retry bounding or outbox adoption.

## Evidence Boundary

Local tests prove ordering, encrypted append behavior, queue bounds, owner fencing, failure isolation, canonical hashing, and the migration's static SQL contract. They do not execute PostgreSQL, RLS, grants, concurrent transactions, or production networking. Hosted replay/RLS/concurrency proof and signed supported-iOS offline/reconnect/process-kill/account-switch evidence remain open, so OPT-010 remains `investigating` rather than `verified`.
