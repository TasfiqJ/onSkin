# Photo deletion outbox checkpoint — 2026-07-26

## Outcome

Authenticated canonical photo deletion now commits one encrypted local deletion journal and one owner-bound `photo_delete` outbox tombstone atomically before any encrypted file moves. The same random UUID identifies both authorities. Offline use, process interruption, request timeout, and response loss can therefore recover/replay without inventing a second operation or losing the server cleanup intent.

Signed-out deletion and authenticated legacy non-UUID IDs remain strictly local-only. The original durability checkpoint left Progress unchanged; the follow-up now adds one aggregate current-owner recovery leaf inside entitled, timeline-unlocked, storage-readable Progress content.

## Client durability contract

- `usePhotoActions` passes the published AuthProvider owner ID and the current owner generation into the store. The store never rediscovers the current user after accepting the photo ID.
- The prepared photo envelope removes the target from `items`, retains the exact record for file recovery, and shares its operation UUID with a delete/null/tombstone outbox row.
- `[onskin.photos.v1, onskin.outbox.v1]` commits through one crash-recoverable private-KV transaction. Malformed/future outbox state, capacity failure, a stale owner generation, or a transaction conflict fails before file quarantine.
- Startup photo recovery finishes the existing prepared/metadata-committed file journal. It does not synthesize or duplicate an outbox row; the atomic prepare already made the intent durable.
- The shared worker gives `photo_delete` highest privacy lease priority, sends it only through `apply_photo_delete_outbox_batch`, and retains ready/leased/dead commands. Applied, duplicate, or stale settlement removes the terminal row and its otherwise-unneeded revision fence.
- Current-owner content-free status and manual retry APIs cover terminal photo deletion rows and feed the non-blocking Progress recovery leaf.

## Bounded storage changes

The private-KV transaction journal is now schema V2 while retaining strict V1 decoding and real V1 roll-forward:

- V2 stores a domain-separated SHA-256 fingerprint of each prior encrypted target instead of embedding the complete prior ciphertext.
- V1 keeps its original 4 MiB per-value and 12 MiB aggregate admission limits; V2 does not reinterpret previously invalid V1 bytes.
- V2 admits the exact maximum pending photo envelope plus the explicit 6 MiB outbox envelope under a 16 MiB logical aggregate bound.
- Photo envelope recovery overhead is allowed only for delete/clear journals whose eventual settled `items` authority remains within the original 8 MiB cap. Legacy arrays and add journals retain the original cap.
- The local private-data registry declares current journal V2 with legacy V1 recovery.

The outbox is schema V6 with V1–V5 read compatibility and rejects a photo row mislabeled as a legacy version. Ordinary producers retain their 512-row/1,024-revision limits. A separate 128-row/128-revision photo-delete reserve raises only the total bounds to 640/1,152, so an already-full V5 queue can still accept a privacy deletion and non-photo producers cannot consume the reserve. Dead photo tombstones are never reclaimed.

## Server contract

Migration `20260726000058_photo_delete_outbox_rpc.sql`:

- extends the receipt registry to the exact seven outbox entities;
- exposes only an authenticated, owner-derived, `security definer`, empty-search-path RPC;
- accepts at most 25 exact seven-field operations with UUID identity, `photo_delete`, `delete`, JSON null payload, safe revision, and `photo_delete:<operation UUID>` idempotency;
- deletes only `photos.id = entity_id AND photos.user_id = auth.uid()`;
- treats an absent row as applied and makes exact sequential/concurrent replay return duplicate;
- serializes with the account-deletion advisory lock before even an empty/absent target can create a receipt;
- revokes the old direct authenticated photo DELETE path;
- treats an applied receipt as a terminal owner/photo metadata tombstone;
- serializes authenticated photo INSERT/UPDATE with the same account-then-photo lock order and rejects stale insertion or primary-key rewrite to a tombstoned UUID;
- indexes the terminal tombstone lookup by owner and entity ID.

Current V1 does not upload photo bytes. This RPC deletes optional server metadata, not Supabase Storage objects; any future cloud-photo feature requires a separate reviewed storage-object deletion protocol.

## Verification

- Focused mobile: 13 files / 332 tests passed.
- Mobile typecheck: passed.
- Full mobile lint with zero warnings: passed.
- Changed-file Prettier and `git diff --check`: passed.
- Disposable PostgreSQL replay: PostgreSQL 15.18, migration applied twice with byte-identical function definitions.
- PostgreSQL cases passed: own delete, absent delete, cross-owner isolation, sequential response-loss replay, two concurrent identical calls (`applied` + `duplicate`), operation-UUID intent drift, poison-row isolation, 26-row rejection, unauthenticated rejection, claim-first account-deletion race on an absent target, direct DELETE denial, same-owner INSERT denial, same-owner UUID-rewrite denial, foreign-owner UUID scope, RPC/helper grants, security-definer/search-path metadata, and partial-index catalog shape.
- Independent architecture and final adversarial reviews found and drove fixes for large transaction envelopes, terminal revision leakage, photo-cap starvation, legacy-version provenance, pending-add/legacy envelope widening, account-deletion receipt races, stale metadata resurrection, UUID-rewrite bypass, unindexed tombstone checks, registry codec drift, and terminal retry observability. Final review found no remaining local correctness or security blocker.
- Full mobile suite: 368 files / 4,515 tests; 4,511 passed. The four failures are the pre-existing unrelated notification behavioural-snapshot expectation and three user-edited Shelf metadata/provenance expectations.

### Progress recovery presentation follow-up

- The UI/status focused matrix passed 5 files / 81 tests, including a behavioral coordinator proving duplicate retry activation joins one promise and that completion or failure permits a later attempt.
- The fresh root suite ran 370 files / 4,534 tests; 4,530 passed. The four failures remain the same unrelated user-edited notification behavioral-snapshot expectation and three Shelf metadata/provenance expectations. Root typecheck and zero-warning lint passed.
- Codex in-app browser Expo web rendered saved-local, syncing, and needs-attention in both empty Progress at a requested 360 x 640 viewport and populated Progress at a requested 390 x 844 viewport.
- All six presentations had zero horizontal overflow, partial visible controls, sub-44 visible controls, forbidden UUID/date/filename/raw-error content, or JavaScript dialogs. Syncing exposed exactly one named progressbar; attention exposed exactly one alert and a 55.99 px-high retry action.
- The first narrow attention run found a partially off-viewport primary capture action. Reusing the existing compact first-run layout below 700 px fixed it, and the exact rerun kept both actions fully visible above the floating tab bar.
- Evidence, exact viewport/capture dimensions, accessibility snapshots, expected local warnings, and the bug report are in `test-results/human-e2e/2026-07-26/progress-photo-delete-recovery-current/`.

The development-web fixtures prove presentation and visible interaction only; they disable the live status query. Runtime outbox tests prove current-owner status/retry and account-generation fences, and the behavioral coordinator test proves retry single-flight. This follow-up does not claim an authenticated server delete or outbox transition from the browser fixture.

## Evidence still required

- Signed iOS process-kill runs at private transaction commit, each target roll-forward, file quarantine, metadata commit, irreversible cleanup, worker lease, server commit, and local settlement.
- Signed iOS memory/storage evidence for the bounded worst-case V2 transaction journal; encrypted hex representation can approach roughly 32 MiB.
- Hosted Supabase migration/RLS/concurrency replay.
- Release compatibility/minimum-build evidence before revoking the old best-effort direct DELETE path for any installed production build.
- Long-lived offline testing through the 128-command privacy reserve and manual terminal retry.
- Actual unreadable-queue `Check again` fault injection and authenticated offline-delete/reconnect/manual-retry presentation.
- Supported-iOS VoiceOver, Dynamic Type, safe-area, and recovery interaction evidence.

This closes the local durable photo-metadata deletion gap. It does not mark OPT-010 verified while hosted, native process-kill, long-lived capacity, and cross-device evidence remain open.
