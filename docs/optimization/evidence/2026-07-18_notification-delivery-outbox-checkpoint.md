# Notification Delivery Outbox Checkpoint - 2026-07-18

## Scope

This checkpoint adopts content-free immediate notification-delivery telemetry into PERF-P0-007 / OPT-010's encrypted transactional outbox. It removes the former optional direct `notification_log` insert without changing local notification eligibility, native scheduling, recurring reminders, or visible settings UI.

The implementation adds:

- a strict sent-ledger v2 format with immutable event UUIDs and `reserved` / `delivered` state, plus read compatibility for unversioned and v1 records;
- reservation of the conservative frequency-cap slot and preallocation of both event and operation identities before any immediate native schedule request;
- one encrypted two-key transaction after OS schedule acceptance that marks the exact event delivered and appends one authenticated content-free outbox event;
- signed-out local-only behavior, repeated owner assertions before hashing and inside the transaction, exact commit-response-loss readback, and no server event after native failure;
- a strict outbox v3 envelope that reads v1/v2 data, validates the exact seven notification kind/tier pairs, binds idempotency to operation/kind/canonical timestamp, never coalesces immutable delivery events, and reclaims successful event revisions so more than 1,024 sequential events cannot exhaust the shared bound;
- shared-worker routing and content-free per-entity success counts without a misleading user-visible delivery-sync state;
- an authenticated security-definer RPC that derives `user_id` from `auth.uid()`, accepts exact bounded fields, rejects future timestamps, receipts telemetry older than 30 days as stale, reconciles exact concurrent receipt/primary-key races, and isolates poison rows;
- removal of the legacy authenticated direct-insert policy and privilege, so mobile clients cannot bypass the RPC validation/idempotency contract.

## Local Verification

- Focused mobile Vitest matrix: 8 files and 124 tests passed across the sent ledger, immediate delivery, lifecycle trigger, pure/runtime outbox, migration contract, account-scope inventory, and request-policy inventory.
- The pure suite settles 1,025 sequential immutable delivery events and finishes with zero rows and zero revision entries.
- Adversarial coverage includes v0/v1 migration, malformed/future/oversized bytes, 100 concurrent sent-ledger appends, reserved-cap counting, pre-native RNG/storage failure, native rejection, post-native transaction failure, ambiguous commit readback, signed-out behavior, stale-owner fencing before hash and inside the transaction, an account boundary during confirmation, payload-mismatched replay rejection, and mixed-domain RPC dispatch.
- Mobile typecheck passed after the focused matrix.
- Full root Vitest passed: 343 files and 4,066 tests.
- Root typecheck passed for mobile and shared types; root zero-warning lint passed.
- Prettier and `git diff --check` passed for the checkpoint files.

## Independent Review

A read-only agent review found and the checkpoint corrected four durability issues before completion:

- the outbox envelope needed a v3 bump so older binaries reject the new entity as unsupported while current code still reads v1/v2 data;
- successful immutable events retained revision entries indefinitely and could exhaust the 1,024-entry bound;
- operation identity allocation after native acceptance could unnecessarily strand a reservation when secure randomness failed;
- concurrent primary-key replay, payload-mismatched replay, and the legacy direct-insert policy weakened the server contract.

## Human-Simulated E2E Decision

No new visible UI was added. Existing Notification Settings and Timing saved-local/syncing/needs-attention presentation evidence remains applicable to preference state, but it is not reused as proof of immediate delivery telemetry. The new path runs only on native background lifecycle work; Expo web cannot exercise the native notification schedule boundary. No unsupported browser fixture is claimed as notification-delivery E2E.

## Evidence Boundary

The local tests prove code ordering, encrypted local/outbox atomicity, boundedness, owner fencing, worker routing, and the migration's static SQL contract. A resolved Expo native scheduling call proves only that the OS accepted the schedule request; it does not prove that a banner was presented. Static migration inspection does not execute PostgreSQL, RLS, grants, stale-event settlement, or concurrent replay. Signed supported-iOS offline/reconnect/process-kill/account-switch/presentation evidence and hosted RPC/RLS/concurrency proof remain open, so OPT-010 remains `investigating` rather than `verified`.
