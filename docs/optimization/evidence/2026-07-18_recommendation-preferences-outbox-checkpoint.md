# Recommendation Preferences Outbox Checkpoint — 2026-07-18

## Scope

This checkpoint adopts authenticated recommendation-preference synchronization into PERF-P0-007 / OPT-010's encrypted transactional outbox. It removes the detached best-effort Supabase mirror while retaining signed-out local-only preferences.

The implementation adds:

- one serialized, crash-recoverable private-KV transaction that commits the complete sanitized recommendation preference snapshot and its owner-bound outbox operation;
- strict values, budget, and format payload validation with no user ID or arbitrary fields;
- deterministic hashed-owner stream identity, monotonic owner-scoped revisions, operation-idempotency keys, semantic no-op byte preservation, and exact ambiguous-commit confirmation;
- a version-2 outbox envelope that migrates version-1 revision floors without allowing two owners with the same entity UUID to interfere;
- obsolete dead-row pruning plus settlement fencing, so an older failed or leased state snapshot cannot overwrite or keep warning after a newer snapshot exists;
- an awaitable single-flight driver whose direct callers share one promise, whose wake requests cannot be lost at terminal publication, and whose returned counts cover all coalesced passes;
- an authenticated, security-definer recommendation batch RPC that derives ownership from `auth.uid()`, validates exact bounded payloads, writes last-arrival-wins owner preferences, and records operation receipts in the same subtransaction;
- a narrow content-free recommendation sync leaf with saved-local, syncing, and needs-attention states plus current-owner retry.

## Local Verification

- Focused Vitest matrix: 10 files and 156 tests passed across outbox pure/runtime, recommendation store/route/status/migration, Shelf migration compatibility, query keys, and account/request inventories.
- Mobile typecheck passed after the focused matrix.
- Full root Vitest passed: 342 files and 4,045 tests.
- Root typecheck passed for mobile and shared types; root zero-warning lint passed.
- Prettier and `git diff --check` passed for the checkpoint files.

## Human-Simulated E2E

Surface: actual Expo web development builds in the Codex in-app browser, requested 390 x 844 viewport (observed 390 x 845).

Observed results:

- `Saved locally` rendered one polite live status; selecting `Vegan` survived a full reload.
- `Syncing recommendation choices` rendered one named progress bar.
- `Recommendation sync needs attention` rendered one alert and an enabled 308.37 x 55.99 px retry action.
- Every fully visible Back/value control measured 48 px; post-fix runs had zero partial controls, sub-44 controls, blocked center hit tests, horizontal overflow, or JavaScript dialogs.
- The run found and fixed a first-viewport clearance regression where 3.18 px of the budget controls peeked below the syncing status.

Evidence: `test-results/human-e2e/2026-07-18/recommendation-outbox-status-current/` and `docs/e2e-bug-reports/2026-07-18-recommendation-sync-status-partial-controls.md`.

The fixture retry proves presentation and interaction only. The runtime outbox suite proves actual current-owner dead-row retry.

## Evidence Boundary

Expo web proves presentation, local usability, reload persistence, accessibility naming, and control geometry. It does not prove signed-native process-kill durability, protected-storage interruption, physical account switching, native offline/reconnect or duplicate-worker execution, or hosted RPC replay/RLS. Completion history remains outside this entity contract until authoritative server routine/step UUID mapping exists.
