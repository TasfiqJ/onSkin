# Campaign45 immutable source implementation plan

Authorization: M1X-V2-C05-OWNER-PLAN-VERSIONS45-SOURCE-CANDIDATE-01. Latest instruction: RESUME CAMPAIGN45 with externally issued original anchors. Codex implements; only independent Brain may accept. This plan is frozen in the first commit; no source edits share that commit.

## Authenticated inputs and source

- Original ZIP SHA256: b1cdacf453d22ea2f29d3ad45097c68f7dd99e8e6c477e932d4963e8c46e5a2a
- Authoritative FULL_CODEX_PROMPT.md SHA256: e97308356a9c7adef4ccd1f6bd881001d4979bc9a787b7b4aa98a3f3fd435a50
- Manifest SHA256: a47475305ac74a09fe9953b7880307cf9f6f55eebc15fa3c2fa5341c1ab9db76
- Verifier SHA256: f4d5e6e82c74273b620b1331bb36a30ca5aa36285e87cfeb40bd7cbdbad6f745
- Raw anchor matched before extraction. New empty extraction validated all 17 members/192887 uncompressed bytes, bounded sizes/count/ratios, canonical noncolliding relative Windows-safe paths, regular 0644 modes, UTF8/text signatures and CRC; no executable binary/link payloads. Authorized verifier returned C45_CONTEXT_VERIFIED, entries=14, exact authoritative prompt hash. References/red originals remain read-only.
- Chat paste and packet have Markdown formatting differences; substantive instructions agree. The latest founder/Brain instruction explicitly authenticates and directs use of the externally hashed original full prompt. That authoritative external hash governs the implementation; formatting differences are disclosed, never represented as byte identity of the rendered chat.
- GitHub authority: TasfiqJ/onSkin, PR45 open/draft/unmerged at 3865cdd8f610d2c715bd1f3f304ab3c756ca4fbc, tree c02c58151aa2c23090712494bb8b758f1feb7dab.
- PR44 head/base ancestry: 302e2b83216e7d100e7da3b3f579ee33db8dc5af, tree 075ee95de6e23282bdaf40890bf7bc5ed8aa7c18. Exact four-commit PR45 chain: 5387a7a2b3b0c5d5f7f04191b74bdaf474d40ab8 -> 80b43a41273b6502bb5f1be816d2074d17fddda9 -> 3802dd386928a966226e0fd3ec5fa678c561b6a6 -> 3865cdd8f610d2c715bd1f3f304ab3c756ca4fbc.
- main remains 53a84d921d14dbff1d2e9b8f1b3bb27e10dcede6. Live PR/ref checks agree; no proposed branch/PR conflict. Fresh HTTPS clone, no alternate/hardlinked parent object store; local autocrlf=false and repository LF attributes retained.
- Only new branch stage/m1-owner-plan-history45, stacked on PR45; never rebase or alter prior branches/main. At completion only one open unmerged draft PR, maintainer edits/auto-merge off, no merge/deploy.

## Bounded schema and API

Implement one fixed encrypted key layerwell.routinePlanHistory.v1. Strict schemaVersion=1 envelope binds exact ownerUserId and immutable versions. Each version carries UUID id, contiguous monotonic sequence starting at 1, canonical millisecond UTC createdAt, 64-lowercase-hex sourceHash, ordered AM/PM factual productId/name pairs. Exact object fields, bounded trimmed identifiers/names, no controls, bounded period counts/encoded bytes, duplicate IDs and invalid dates/sequences rejected. Choose capacity 100; enforce a documented byte/step ceiling as well. Refuse capacity, never evict; check exact idempotent retry before capacity; same id with changed factual payload refuses. Do not persist source profile, pregnancy, conclusions, advice, photos, leases or cloud state.

Preserve immutable old records across ordinary source edits. Invalid/legacy/future/oversized/wrong-owner records and authentication/content-key failures refuse without rewrite or empty fallback. No automatic save/activation/restoration. Explicit owner press is required.

Extend the private C44 proof adapter only as needed: fixed history destination, exact original snapshot object/WeakMap proof and original admitted lease, synchronous restricted destination transform. Reserve sorted union of the original five keys plus history; compare full plaintext/absence/sourceHash and exact owner/account/health/grant/expiry under lock before native invocation. Preserve C44 savePlanOrderWithSource44 signature and semantics. Keep lock through canonical encrypted readback and compensation. No cache event or unlocked read certifies a write; no global mutex or reentrant reserved-key writes.

If native write is ambiguous, preserve exact previous ciphertext; where rollback cannot be proved, close authority and establish explicit recovery quarantine using the existing owned cleanup-marker protocol. Never overwrite a foreign ambiguous value, claim success or expose tentative history. Preserve ordinary writers and all existing account/private/photo drains and recovery ownership. No new persistent recovery key.

History reads retain exact owner/health/account authority around awaits and before render, and serialize against append/compensation. Export uses the existing owner-verified purpose-limited account lane and strict decoder; export rights remain available without processing consent. Register history in both existing full-private and health-purpose registries; reuse actual full/dev/account/selective cleanup rather than invent policy.

## Existing-screen UI

Small accessible panel in existing /routine/plan, including history-only unavailable-current-source states. Save this plan action, bounded Saved plans list/inline dated details, honest snapshot/not-current-advice copy. Retain original lease and source proof references (disable Query structural sharing if used). Require strict local profile, nonempty real active Shelf, current confirmed queries, original authority and exact ordered factual agreement with displayed plan. No Maya/error/loading/stale/expired save. Fresh capture on explicit refresh/retry, never silent replacement of the pressed plan or refresh of stale authority. Success only follows committed canonical readback. Hide predecessor data synchronously on any authority transition and reject old pending handlers. Empty/loading/error/retry/capacity/compact layout covered, >=44px controls. Keep 94 routes and Today/Shelf/manual/F09/Reorder behavior intact.

Generic repo instructions to update USER_FLOW_TREE/readiness/handoff outside the finite grant are superseded by this user authority: put the C45 flow map/evidence in granted TASK/release doc and external return packet. Do not alter protected docs/tests/packages/lockfiles/fixtures/workflows.

## Adversarial schedule and evidence

Use real privateKV XChaCha20-Poly1305, native content-key adapter, C44 fence/domain decoders, original admission/account generation and real deletion boundary. Only native storage/files/timers/router ports may be synthetic; no mocked store/cache proof. Use controlled Promise barriers and queue windows, not timing luck. Preserve raw failing candidates then fix/retest; unresolved safety red/flaky means stop without push/PR/seal.

A: one encrypted current-owner save, immutable facts, exact retry/reload and no filler/egress.
B: wrong/successor owner, late callback, account close/reopen, withdrawal/regrant, expiration/grant change, cross-owner cache, forged/copied snapshot/original-lease refusal; zero leak.
C: actual removal/status/ingredient/irrelevant whole-key metadata/profile/pregnancy/conflict/consent/order changes during capture/preparation/preappend; history ciphertext absent/exact old on refusal. Reproduce authentic C42 orderings as new successor tests; preserve original red bytes.
D: two simultaneous appends plus ordinary source writers, contiguous sequences/no loss/duplicate, exact lock/readback/rollback ordering, unrelated-key progress/no global starvation/self-deadlock. Writers queued after reservation may commit later.
E: pending append crossed by real full/dev reset, native multiRemove, owner/account cleanup, selective withdrawal, photo key creation/deletion, held/failed/removing markers and independent outer releases. Cleanup wins; no history/content/photo resurrection or lost marker/early owner-proof removal. Preserve original C44 tests unchanged.
F: commit-then-reject, reject-before, omitted native write, stale readback, foreign concurrent ambiguity and rollback failure; exact preservation or explicit recovery quarantine, never success.
G: malformed/oversized/future/wrong-owner/duplicate-id/bad-UTC/reordered-sequence/bad-period/envelope corruption/missing-key; no rewrite/leak/empty; capacity100 and identical retry at capacity.
H: strict export/read/deletion roundtrips, React/native UI states and actual Expo browser compact375x812-or-smaller flows when available; no route/cloud/provider/analytics addition; F09 and original C44 safety regressions retained. Web/native-port evidence is not a physical iPhone or signed native acceptance.

Run normal npm ci hooks with Node22.21.0/npm11.20.0, postinstall:check, focused genuine encrypted/owner/cleanup/UI tests, forced full root npm test/typecheck/lint, current C44 regressions and original protected core04/core06 (expected24/26, two OPEN failures). Initial pre-install core command encountered missing TypeScript; preserve raw setup failure and rerun after install; do not report its counts as baseline. Historical authenticated44->41->...->29 replay runs in fresh exact parent checkout with genuine installs, original consumers untouched. Audit G97/38 obligations/18 gates and source/route/key/no-egress/scope invariants.

Quality: replace only first current-campaign finite preflight with genuine45 source consumer; retain every downstream DB/PG15/17/export validation and original Security/candidate29 workflows. Independently authenticate pinned44 audit programs/commits/source, inspect new39-path source and plan-first/seal-last ancestry, live PR/event identity; no fake environment success. Run old44 current-source guards in exact PR45 historical clone, not incorrectly against changed45.

Make runtime/test source commits and complete all required docs before frozen source proof. After real success, only the two granted generated worklists change in last separate seal commit, with both parents/source bytes verified. Push only new branch, create one stacked draft PR, collect every final-head Quality/DB/PG/export/iOS/Security/candidate29 job URL/status honestly. Missing/skipped/failed remains so.

Return compact authenticated ZIP/report with exact source diff/changed files/Git identities, preimages/hashes/manifests/verifier, raw RED and fixed successor logs, forced root/type/lint/CI receipts, historical replay and qualified actual browser/native evidence. Upload downloadable artifacts via authorized connector, issue external final hashes and freshly download/verify raw ZIP and members. No source candidate acceptance by Codex.

## Preserved NO_GO boundaries

C44 CAMPAIGN44_ACCEPTED_SCOPED is only storage source prerequisite. Original Security/candidate29 remain failures; core04/core06 two original failures remain OPEN; G97 FAIL; all38 obligations incomplete/all18 owner gates unadmitted. No full-app/owner/security/native/clinical/professional/provider/Apple/TestFlight/payment/subscription/release acceptance. Successful result SUBMITTED_REVIEW_REQUIRED / NO_GO; unresolved blocker PARTIAL_BLOCKED / NO_GO, no push/PR/seal. Stop for Brain; no Campaign46.

## Exact grant and pinned PR45 preimages

Only these39 potentially writable paths. Null means absent in pinned parent; scope plan itself is new. Optional existing files change only for an observed implementation/test need and receive a specific justification in TASK/report. All other tracked source is read-only; runtime installation/test outputs and external evidence are not source edits.

- `docs/brain/task-specs/M1X-45/SCOPE_PLAN.md` — ABSENT
- `docs/brain/task-specs/M1X-45/TASK.md` — ABSENT
- `apps/mobile/src/features/routine/planHistory45.ts` — ABSENT
- `apps/mobile/src/features/routine/planHistory45.test.ts` — ABSENT
- `apps/mobile/src/features/routine/planHistory45Encrypted.test.ts` — ABSENT
- `apps/mobile/src/features/routine/PlanHistoryPanel45.tsx` — ABSENT
- `apps/mobile/src/features/routine/PlanHistoryPanel45.test.tsx` — ABSENT
- `apps/mobile/src/features/routine/planSourceFence44.ts` — SHA256 bf839dc99f068da5a18ded6c14bc2e283e02302eee368122fc2e2a560fe477cd; 7095 bytes
- `apps/mobile/src/features/routine/planSourceFence44.test.ts` — SHA256 1ec61b14e6d73cbc66223e996e12fd010108b692e0607cfa82c87a6dbe159659; 17677 bytes
- `apps/mobile/src/features/routine/usePlan.ts` — SHA256 d10920c965d1355c02f00f37483d3ebd8075e30ddef483866d9e193de8f0d236; 15396 bytes
- `apps/mobile/src/features/routine/usePlan.test.ts` — SHA256 145de2acd477a3bf601dedefbd57c2490ff024de472c2389a434b6f8e72670ec; 3208 bytes
- `apps/mobile/src/features/routine/orderStore.ts` — SHA256 3b08983c188287434cda96444cfed91d23c3d653952aec2cbf1a2ab92f0d656d; 10854 bytes
- `apps/mobile/src/features/routine/orderStore.test.ts` — SHA256 bf9de584a71261637865333b6fb6fee3b8953bbd98f64d8711ffbc11a8906189; 17192 bytes
- `apps/mobile/src/features/routine/planRecovery.test.ts` — SHA256 c1c478d6b840ad3296b1e9088c467d89b73480d128c638919a3a52f093cd9be9; 40742 bytes
- `apps/mobile/src/features/routine/PlanSourceNotice.tsx` — SHA256 5db80afc3ac7aaee9dfa25a3132934b7645283187582af98239ca7c9d3b05bca; 3012 bytes
- `apps/mobile/src/app/routine/plan.tsx` — SHA256 b6f6b40fedeac6581fb6be601e5a5220c5e7c25c558f720939001dc4540b2a17; 22885 bytes
- `apps/mobile/src/features/routine/orderRoutes.test.ts` — SHA256 8f6c171d5b738a3eb77afd9ea8aac49a4cff30b419bf14fec17f624b9bbe640e; 4017 bytes
- `apps/mobile/src/lib/storage/privateKV.ts` — SHA256 0c8fa288274a91e022a09c694e6584ede48164189e6e7efd14db4ac9e9aaedac; 37947 bytes
- `apps/mobile/src/lib/storage/privateKVSourceFence44.test.ts` — SHA256 b6d68f5bf5cb97edf1dc94031d6ace694e1d9f42c12ac040a651e66bffad82ef; 13628 bytes
- `apps/mobile/src/lib/consent/healthDataWriteAdmission.ts` — SHA256 8896b82049d3fd11c6311f43674b7a0aad463ccf146624d40b7d9b4a2aaff3ee; 6075 bytes
- `apps/mobile/src/lib/consent/healthDataWriteAdmission.test.ts` — SHA256 f46c362e5be316aec7477354006d1d8f0ca8c0ed6313a32a42d5436eb5e5d3e4; 6607 bytes
- `apps/mobile/src/features/settings/localPrivateDataKeys.ts` — SHA256 655b37913289061b639d37514c14fad6d2f91e2b897c2e575e9c2fd20b869717; 4536 bytes
- `apps/mobile/src/features/settings/localPrivateDataKeys.test.ts` — SHA256 70f5b7d115042e6d6c95eac621e7058289de1f86fa10ee91b24844a078291acc; 5000 bytes
- `apps/mobile/src/features/settings/localPrivateData.ts` — SHA256 82b7e2ce6f315e9e14cff5f3bc6f8f7ef2162c3e3635040bd8ace37daf9715be; 8004 bytes
- `apps/mobile/src/features/settings/localPrivateData.test.ts` — SHA256 32c17ed335d912a04942de3e8ee8e27a9f71ad4c9c2501f072f662a4a081cd3d; 13878 bytes
- `apps/mobile/src/features/settings/localPrivateDataFence44.test.ts` — SHA256 e3dca2caf2df468ab9202e49b3498e1e050b8ff4ad3e40bd113609c4da66de52; 47609 bytes
- `apps/mobile/src/lib/consent/withdrawal.ts` — SHA256 31ed34e8ea092d1aa265714b633158a95cb1682c19f03c89123bebe087ec4688; 10781 bytes
- `apps/mobile/src/lib/consent/withdrawal.test.ts` — SHA256 55313acd71925fb94df433c553ff056c3bfb7836575c5b069e5dc7029274fa16; 13620 bytes
- `apps/mobile/src/features/settings/localDeviceExport.ts` — SHA256 855a31247f8c3f70920f1ee349f49691f53de2d0a6e0ad99e468e3241dd9ebbd; 13874 bytes
- `apps/mobile/src/features/settings/localDeviceExport.test.ts` — SHA256 8b629d87112f2114cda65af72ad6577545b3bc6b1b4a8301e55e8b976b41e220; 18614 bytes
- `apps/mobile/src/features/settings/mobileDataExportWriter.ts` — SHA256 59fb2caca02885131d4f8652252da15f2a741c4af0b71e47f35be9395f99ad94; 2543 bytes
- `docs/release/full-app-j01/owner-plan-history45.md` — ABSENT
- `scripts/release/full-app-j01/main_integration45.py` — ABSENT
- `scripts/release/full-app-j01/main_integration45.test.py` — ABSENT
- `scripts/release/full-app-j01/source_consumer45.test.py` — ABSENT
- `.github/workflows/quality.yml` — SHA256 0ea1bbe82006df100ec489d49c575fd61ee5cb9858772584419a5c2933675ec5; 16985 bytes
- `PROGRESS.md` — SHA256 9aafe432348ab16bf7a308cb42f5e2e7943ef80c9b5045db49a4adf49f4e46db; 560656 bytes
- `docs/phase-4/generated/source-worklist.json` — SHA256 898cbdcf6c07b4164a874c3e606f1e5db27f036b0e11f4d4a5c1f9d9989b111c; 142034 bytes
- `docs/phase-4/generated/source-worklist.md` — SHA256 88c314ac14631ea405b95e7895199e1c35377d3f079223a185a3d234dedf7d11; 84773 bytes
