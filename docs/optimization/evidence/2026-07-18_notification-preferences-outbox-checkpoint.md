# Notification Preferences Outbox Checkpoint — 2026-07-18

## Scope

This checkpoint adopts authenticated notification-preference cloud sync into PERF-P0-007 / OPT-010's encrypted transactional outbox. It replaces the detached best-effort Supabase mirror without changing local notification scheduling semantics.

The implementation adds:

- one crash-recoverable private-KV transaction that commits the complete sanitized preference snapshot and its owner-generation-bound outbox operation;
- strict notification payload validation with no user ID, owner hash, push token, content, or arbitrary fields;
- deterministic hashed-owner preference-stream identity, monotonic revisions, unique operation-idempotency keys, semantic no-op byte preservation, and exact ambiguous-commit confirmation;
- restart-durable owner selection with cross-account coalescing and lease-block prevention;
- entity-scoped leases, selectors, and dead-row retry so notification rows cannot change Shelf presentation or retry behavior;
- same-stream lease serialization and expired-work compaction to the latest complete snapshot;
- independent Shelf and notification settlement inside the existing bounded single-flight foreground/reconnect worker;
- an authenticated, security-definer notification batch RPC that derives ownership from `auth.uid()`, isolates invalid rows, writes receipts in the same subtransaction, and does not overwrite `push_token`;
- owner-bound propagation through Settings, Timing, onboarding, and hooks while preserving native scheduling as a separate foreground outcome;
- a narrow content-free notification sync leaf with saved-local, syncing, and needs-attention states plus current-owner retry.

## Local verification

- Focused Vitest matrix: 12 files and 132 tests passed across outbox pure/runtime, OfflineSync invalidation, notification preference/delivery/onboarding/status/migration, owner/request inventories, private-data registry, and query keys.
- Full root Vitest passed: 340 files and 4,027 tests.
- Root typecheck passed for both mobile and shared types.
- Root zero-warning lint passed.
- Prettier and `git diff --check` passed for the checkpoint files.

## Human-simulated E2E

Surface: actual Expo web development builds in the Codex in-app browser, requested 390 x 844 viewport (observed 390 x 845).

Observed results:

- `Saved locally`: exactly one calm status, zero alerts, zero progress bars, and zero horizontal overflow.
- `Syncing notification settings`: exactly one named progress bar, zero alerts, and zero horizontal overflow.
- `Notification sync needs attention`: exactly one alert, zero progress bars, and a 316 x 56 px `Try sync again` action that responds without a JavaScript dialog.
- A real Morning notification switch changed from off to on and remained on after reload.
- Timing rendered the same saved-local state with zero overflow; turning quiet hours off changed the control to `Turn on quiet hours` and remained off after reload.
- All visible notification switches measured 52 x 48 px.

Evidence: `test-results/human-e2e/2026-07-18/notification-outbox-status-current/`.

## Evidence boundary

Expo web proves presentation, local usability, and reload persistence. It does not prove signed native process-kill durability, background/foreground delivery, OS scheduling, protected-storage interruption, physical account switch, or hosted RPC replay. Those release-device and hosted-environment gates remain open. Completion history also remains outside this entity contract until authoritative server routine/step UUID mapping exists.
