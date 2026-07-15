# Owner-Bound Storage And Progress Checkpoint

Date: 2026-07-14 (America/Toronto)
Branch: `optimization`
Implementation SHA: `da398ed022770076ee9c7304f67822ccdd4fe2c7`
Evidence class: `command`, `e2e`, and `decision`

This sanitized checkpoint hardens destructive local-storage control records, binds photo content-key history to the exact key, and makes Profile, Shelf, and Progress reads account-generation aware. It also implements OPT-112's local-once/parallel-server-read contract. It does not claim that every account-scoped read is inventoried, that a truly hung private-KV read can no longer pin isolation, or that the latest recovery-proof UI revision has fresh surface evidence.

## Implemented Contract

- Owner markers accept only the exact current `v1:<64 lowercase SHA-256>` form plus the read-only legacy hash. Cleanup markers accept only exact current `v1:required` and legacy `1`. Malformed and future forms fail closed and retain their bytes.
- Cleanup-marker writes/removals and owner-marker writes require exact readback. A new owner claim first persists a verified 256-bit random nonce, then a SHA-256 commitment over a fixed domain, that nonce, and the intended owner hash. A bare nonce remains resumable and owner-neutral; an intent is usable only for the committed owner.
- The frozen registry contains 46 entries, including four internal metadata records for the photo-key and owner-isolation controls.
- First photo content-key creation writes a pending SHA-256 key fingerprint before SecureStore, verifies the SecureStore write, then commits `v1:created:<fingerprint>`. Legacy `1` and transitional `v1:created` markers remain explicitly readable/migratable. A valid key that disagrees with committed history blocks later encryption with `PHOTO_CONTENT_KEY_MARKER_KEY_MISMATCH`.
- Profile local/Supabase reads, Shelf aggregation, and Progress aggregation run under account-generation leases and use the lease abort signal for Supabase work.
- Progress reads `getCompletionSummary()` once and starts that local read plus its two independent server reads together. `settleOwnerQueryOperations` gives siblings a shared child signal, aborts them after the first strict failure, keeps the parent registered through settlement, and asserts currency immediately before each deferred factory begins.

## Commands And Results

| Command or action | Result |
| --- | --- |
| Final focused owner/storage/progress Vitest selection | Pass, 11 files / 182 tests |
| `npm --workspace @onskin/mobile run typecheck` | Pass |
| `npm --workspace @onskin/mobile run lint` | Pass, zero warnings |
| `npm test` | Pass, 249 files / 3,163 tests |
| `npm run typecheck` | Pass, 2 workspaces |
| `npm run lint` | Pass, 2 workspaces, zero warnings |
| Scoped `git diff --check` | Pass |

Independent scoped storage and adversarial owner-boundary reviews found no P0/P1 in the versions and scopes they examined after the identified nonce/intent binding, marker readback, fingerprint history, and sibling-cancellation races were corrected. The final immediate pre-factory account-generation assertion was added after that review and directly regression-tested. The separate cross-cutting truly hung private-KV drain issue remains open.

## Human-Simulated Evidence Boundary

The retained Expo-web run used `EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION=owner_marker_future`. It began from the ordinary signed-out app, seeded an unsupported owner marker plus the registered representative sentinel `onskin.ageVerified`, reported both as preserved before retry, and demonstrated that the compact fail-closed gate remained operable and locked after a user retry. It did not independently reread the raw marker/sentinel after retry. The 375 x 667 target produced a browser-reported 376 x 668 layout viewport, no document overflow, an approximately 320 x 56 retry target, and zero operator-observed browser-console errors; no separate console export was retained.

Evidence retained under `test-results/human-e2e/2026-07-14/owner-marker-recovery-current/`:

- `report.md`
- `03-compact-375x667-recovery.png`

That screenshot predates the final dev-only proof revision. The final code clears the old proof, displays a checking state, and rereads the owner marker, representative sentinel, and cleanup-marker absence after retry. A fresh surface capture of that exact revision is still required before this UI branch is called complete. Native iOS/Android and physical account-switch timing are not claimed by the web artifact.

## Open Follow-Up

1. Re-run and capture the exact current recovery fixture, including raw localStorage/control-marker snapshots where the evidence remains content-free; then exercise malformed, signed-in alternate-owner, signed-out, and native branches on supported targets.
2. Prevent a truly hung private-KV read from remaining in the destructive-boundary drain forever without allowing stale owner work to escape tracking.
3. Add executable delayed account-A to account-B Shelf coverage; the current source/contract proof is not a substitute for the runtime matrix.
4. Continue the repository-wide inventory of account-scoped local/server reads and writes, including onboarding, trend, routine-order, and recommendation paths.
5. Capture native operation counts and latency for OPT-112 before changing its status from `implemented` to `verified`.
