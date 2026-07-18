# Decisions

## Decision Log Format

Use this format for every significant product, architecture, pricing, privacy, or launch decision:

```markdown
## YYYY-MM-DD - Decision Title

- Decision:
- Type: Product / Architecture / Stack / Pricing / Privacy / Growth / Legal / Launch
- Alternatives:
- Criteria:
- Evidence:
- Risk:
- Status: Proposed / Accepted / Rejected / Superseded
- Owner:
- Review date:
```

## Product Decisions

### 2026-07-06 - Rebrand Before Launch

- Decision: Do not launch publicly as `OnSkin` unless counsel gives strong written clearance.
- Alternatives: keep name, add modifier, acquire/coordinate with incumbent, full rebrand.
- Criteria: customer confusion, App Store search, support, trademark risk, rework cost.
- Evidence: existing public OnSkin app/site in same category with scanner language and claimed 8M users/2M products.
- Risk: rebrand delays launch, but keeping name is higher risk.
- Status: Accepted.

### 2026-07-06 - Position As Shelf And Routine, Not Scanner

- Decision: The primary promise is "Add your skincare shelf. Get a routine that knows what not to mix."
- Alternatives: beauty scanner, AI skin analysis, ingredient safety app, shopping assistant.
- Criteria: differentiation, trust, daily use, subscription retention.
- Evidence: scanner competitors are crowded; repo has stronger shelf/routine/progress loop.
- Risk: users still search for scanner terms, so ASO must include them without leading with them.
- Status: Accepted.

### 2026-07-06 - Keep Full Product, Gate Public Exposure

- Decision: Superseded on 2026-07-12. Keep the full feature set in code and
  require every indexed feature for the iOS launch; expose/market only reviewed
  production-real behavior and do not count a hidden surface as complete.
- Alternatives: cut to the prior V1, launch unreviewed scaffolds, freeze
  advanced surfaces, or require every feature behind strict gates.
- Criteria: founder preference, safety, app review, trust.
- Evidence: existing repo already contains many surfaces and launch gates.
- Risk: feature complexity can dilute focus.
- Status: Superseded by the 2026-07-12 iOS all-features decision.

### 2026-07-12 - Launch All Indexed Features On iOS

- Decision: Release on iOS only with all feature IDs 1-20 and every Phase 7/8
  surface in `docs/hugeToDo/launch-contract.json` production-real and enabled
  in the approved build. Android release evidence is not applicable. Google
  Sign-In remains in scope for the iPhone app. Existing safety, privacy,
  professional-review, live-service, physical-iPhone, production, and App Store
  gates remain mandatory.
- Type: Product / Architecture / Launch
- Alternatives: the smaller cross-platform V1; staged post-launch features;
  simultaneous iOS/Android all-features release.
- Criteria: explicit founder directive, one auditable scope, no simulated
  completion, and no fabricated Android evidence.
- Evidence: accepted update patch at
  `docs/hugeToDo/2026-07-12-ios-all-features-master-plan-update.md`, execution
  charter, and machine-readable launch contract.
- Risk: broader scope increases time, cost, native work, professional review,
  moderation/support staffing, and the number of launch failure modes.
- Status: Accepted.
- Owner: Founder for scope; Codex for all executable delivery work.
- Review date: After all-features TestFlight exit review or an explicit founder
  scope-change directive.

### 2026-07-09 - Launch Device Support Floor

- Decision: Superseded on 2026-07-12 for release-platform evidence. Launch
  support is iPhone on iOS 17.0+; launch-blocking layout QA starts at 375 x 667
  for the compact iPhone-class envelope. Android and 360-wide Android-class
  checks remain source-health/resilience inputs but are not release gates.
- Alternatives: support Expo's lower Android 7+ default, require Android 12+, keep the earlier 320 x 480 browser floor as launch-blocking, or drop compact Android phones entirely.
- Criteria: paid consumer market reach, QA burden, current Expo SDK support, App Store/Play submission requirements, camera/photo reliability, accessibility, and launch speed.
- Evidence: Expo SDK 56 supports iOS 16.4+ and Android compile/target SDK 36; Apple and Google current submission rules require modern build SDK/target API; the repo has passing 360 x 640, 360 x 740, 375 x 667/812, 390 x 844, 412 x 915, and 430 x 932 evidence plus extensive 320-wide stress evidence.
- Risk: iOS 16 users cannot install; iPad and Android are outside this release;
  smaller browser/device states can still reveal resilience bugs without
  becoming launch blockers unless reproduced on supported iPhone hardware or
  required by App Review/accessibility.
- Status: Accepted.

### 2026-07-09 - Fail Closed Before Unreviewed Production Builds

- Decision: Production Expo config requires `PHASE3_RELEASE_CLEARANCE=cleared`; development and staging remain available for implementation and reviewer QA.
- Alternatives: rely only on runtime content filters, reuse brand clearance, or allow production builds while Phase 3 copy/review findings remain open.
- Criteria: prevent placeholder consent copy from reaching a store artifact, preserve a practical reviewer workflow, separate brand identity approval from health/privacy/content approval, and keep the release condition auditable.
- Evidence: Phase 3 currently reports unresolved legal, privacy, clinical, chemistry, and IP findings; runtime filters already withhold unreviewed conflict, cadence, and medical-adjacent recommendation content but do not block core draft consent copy.
- Risk: production builds remain blocked until Tas obtains real named signoff against a clean exact-source-hash packet and the strict copy audit passes.
- Status: Accepted.

### 2026-07-09 - Bind Phase 3 Decisions To Detached Item Snapshots

- Decision: Require one source-controlled JSON signoff for every `Approved` or `Deferred` Phase 3 item, bound to a deterministic digest of its review context and exact source hashes.
- Alternatives: trust only the Markdown row, reference the self-changing overall packet manifest, accept one global clearance boolean, or store reviewer assertions only in environment variables.
- Criteria: explicit credentials and conditions, stale-evidence invalidation, no circular packet hash, independent production verification, and a workable external-review handoff.
- Evidence: the prior worklist verified names, dates, dispositions, and source hashes but did not represent the approval template's credential or conditions fields and could not re-read a detached decision artifact.
- Risk: machine validation cannot authenticate reviewer identity, credential, authority, or judgment; Tas must verify those externally and retain the original signed artifact under a non-secret evidence reference.
- Status: Accepted.

## Architecture Decisions

### 2026-07-18 - Stage And Atomically Promote Versioned Catalog Imports

- Decision: Import production Open Beauty Facts artifacts with a service-role-only, two-pass streaming worker. Bind every run to the source revision, complete artifact SHA-256, importer version, durable server checkpoint, idempotent per-batch receipt, content-free rejection manifest, and an optional mode-0600 local checkpoint. Normalize into version-isolated staging, deduplicate canonical GTIN identity by latest source line, and expose no staged row to clients. Only a complete, count-reconciled version from a production-approved source may atomically update source-owned catalog rows, retire missing rows, switch the active pointer, and retain the predecessor and prior staged rows for rollback reconstruction.
- Type: Architecture
- Alternatives: load the entire export into memory, write directly into client-readable products while parsing, crawl the public API for the bulk seed, retry batches without receipts, or replace curated rows on barcode conflict.
- Criteria: bounded memory, deterministic provenance, safe restart after worker/process/transport failure, no partial visibility, exact replay semantics, curated-source precedence, and auditable rollback metadata.
- Evidence: migration `20260718000045_catalog_import_pipeline.sql`; `catalog-import-core.mjs`; `import-obf-production.mjs`; deterministic restart/promotion smoke; and `docs/optimization/evidence/2026-07-18_restartable-catalog-ingestion-checkpoint.md`.
- Risk: hosted migration syntax/RLS, full-scale import duration/storage, realistic search plans, and an operator rollback drill remain unverified until a production-like staging project and approved artifact are available.
- Status: Accepted
- Owner: Engineering and catalog operations
- Review date: 2026-08-18

### 2026-07-11 - Make Shelf Freshness Provenance-Derived And Replenishment Opt-In

- Decision: Normalize every Shelf lifecycle write through one freshness contract. A PAO clock exists only when `opened_at` is a valid, non-future local date; unopened units keep `opened_at=null`. `expirySource` follows the actual winning date candidate, with the earlier of printed expiry and opened date plus PAO controlling the surfaced state. PAO provenance becomes `label` only after the user explicitly confirms months printed beside the open-jar symbol. Ambiguous, unreviewed, stale, or region-mismatched catalog freshness evidence degrades to unknown instead of becoming a default. Re-add archives the prior package, creates a new UUID opened today, preserves product-level PAO provenance, and clears package-specific printed expiry. Replenishment uses only tracked PAO/printed-expiry state or an unsuperseded user-marked-finished unit; notification preferences default off and require explicit Settings opt-in.
- Type: Architecture
- Alternatives: infer an opened date from add time, treat category defaults as label evidence, preserve any stored `expirySource`, accept unreviewed catalog PAO/expiry rows, reuse a Shelf row on repurchase, infer depletion from elapsed time, or default replenishment notifications on.
- Criteria: truthful provenance, deterministic calendar behavior, no fabricated scarcity, local/server consistency, reversible package history, reviewed catalog boundaries, privacy-respecting notification consent, and testable migration invariants.
- Evidence: central freshness/store/PAO/catalog/replenishment tests; migrations `20260711000038_shelf_freshness_invariants.sql` and `20260711000039_replenishment_alert_opt_in.sql`; reviewed Edge response contracts; and supported-phone human evidence in `test-results/human-e2e/2026-07-11/shelf-freshness-provenance-current/`.
- Risk: live migration/RLS, reviewed region-matched catalog data, notification delivery, native encrypted-storage relaunch, accessibility, and cosmetic-chemistry approval remain external release gates.
- Status: Accepted
- Owner: Product and engineering
- Review date: 2026-08-11

### 2026-07-10 - Use One Canonical Product Schedule And Withhold Undefined Cadence

- Decision: `scheduler/orchestrate` is the only product-night authority for real Plan, Today, cycle, and product-detail surfaces. AHA, BHA, and retinoids enter that cycle; benzoyl peroxide uses the current documented AM default; treatment/exfoliant role labels alone never create cadence. Hydroquinone, copper peptide, and any other classified active without an explicit reviewed placement stay out of AM/PM check-offs and are surfaced as timing not set. Plan groups every canonical product with all assigned night numbers, Today combines stable basics with exactly tonight's canonical active, and the compact strip shows the canonical seven-night projection rather than compressing the full cycle. Same-class ties use product ID so shelf ordering cannot change the schedule.
- Alternatives: keep the legacy generic-role Night 1/Night 2 template, schedule every generic treatment like a retinoid, allow unsupported actives to become daily PM rows, silently drop unsupported products, or let Plan and Today build separate schedules.
- Criteria: no invented medical-adjacent timing, deterministic output, complete multi-active visibility, Plan/Today/product-detail consistency, readable supported-phone presentation, and an explicit path for future reviewed cadence.
- Evidence: generator/orchestrator/projection and cross-model tests cover multiple retinoids/acids, BP, hydroquinone, copper peptide, category-only intake, permutation stability, and canonical summaries. The 360 x 640 and 390 x 844 browser pass in `test-results/human-e2e/2026-07-10/multi-active-plan-today-current/` verifies all canonical cycle products, BP AM placement, two withheld products, exactly one PM active, persisted completion, product-detail nights, and post-fix phone geometry.
- Risk: BP phase and every withheld active's future cadence/co-use rules still require named clinical and cosmetic-chemistry review. Physical-iPhone Dynamic Type and accessibility evidence remains external.
- Status: Accepted.

### 2026-07-10 - Make Pregnancy Safety One Fail-Closed Local-First Contract

- Decision: The encrypted local skin profile is the V1 status authority, and personal profile use/write requires a granted health-consent record with the exact current version and SHA-256 text hash. Malformed or unreadable local profile/consent data is preserved and blocks server fallback. If the local profile is genuinely absent, a server row may provide non-safety axes/goals but its status is always unknown, so a stale server `none` cannot clear caution. One reader feeds Shelf, Plan, scheduler, Today, recommendations, and conflicts. Only explicit local `none` clears caution; affirmative, prefer-not, unknown, missing, and unavailable states remain cautious without an inferred pregnancy claim. Exclusions come from the launch-gated docs/02 rule records: production accepts only rules with review metadata; development/staging may exercise starter rules. Eligible rules remove retinoid and hydroquinone plus BHA unless every threshold-bearing active percentage is unambiguously tag-associated and confirmed low. Filtering precedes sequence/cycle/ramp/replacement recommendations/Today; a closed cadence-review gate withholds treatment and exfoliant placement instead of turning actives into daily steps. Status writes persist locally first, lock competing choices while pending, and invalidate every dependent cache.
- Alternatives: preserve separate server/local readers, trust a server-only `none`, accept any historic consent grant, parse the first percentage in a product name, duplicate an unreviewed safety table, leave unassigned PM actives daily, or infer affirmative pregnancy for caution copy.
- Criteria: deterministic reviewed medical-adjacent behavior, no fail-open default, no contradictory Plan/Today routine, no false health-status claim, consent integrity, offline operation, and explicit non-destructive recovery.
- Evidence: focused tests cover consent version/hash, local read states, stale server `none`, all statuses, reviewed/unreviewed rules, retinoid/hydroquinone/BHA, adversarial multi-percentage names, cadence closure, replacement suppression, conflict semantics, and cache invalidation. Supported-phone Expo web drives `none -> pregnant/trying -> breastfeeding -> prefer_not -> none`, one-shot profile and consent write failures with retry, encrypted reload, legacy-consent regrant, missing-profile recovery, Plan/Today consistency, and 200% text pressure at 360 x 640 and 390 x 844 in `test-results/human-e2e/2026-07-10/pregnancy-safety-status-current/`.
- Risk: labels, exclusions, cadence, and consent copy remain unreviewed starter positions until named clinical, cosmetic-chemistry, and legal/privacy signoff is attached through Phase 3. V1 has no reviewed status-refresh interval or transactional server mirror, so multi-device freshness/reconciliation remain open.
- Status: Accepted.

### 2026-07-10 - Reconcile Cycle Disruptions As One Atomic State Machine

- Decision: The encrypted local cycle configuration is the V1 authority for pause, skip, recovery, variant, anchor, and phased-introduction choices. Every user mutation runs as one serialized private-key read/transform/write; the prior query is cancelled before the write, the committed value replaces the current local-day query only after persistence, and success analytics/navigation happen afterward. Pause and recovery are mutually exclusive. Starting either state settles the elapsed predecessor into the anchor; resume shifts by elapsed pause days; early recovery completion shifts by elapsed recovery days; expiry shifts by the configured recovery interval exactly once; skip never shifts the anchor. For legacy records containing both states, the later start date wins and only non-overlapping days are counted, with same-date open-ended pause retained as the conservative default. The cycle query is keyed by local date and refreshes at local midnight or foreground so long-lived sessions reconcile expiry. Irritation starts recovery before changing ramp cadence, and an already irritation-paused ramp cannot de-escalate again on retry.
- Alternatives: keep best-effort unlocked writes, allow pause and recovery to overlap, clear recovery without re-anchoring, derive expiry only in UI, invalidate after navigation, let every retry lower cadence again, or wait for server cycle authority.
- Criteria: resume where the user left off, no lost concurrent choices, no stale cache frame, non-destructive write recovery, deterministic local-day behavior, safety-preserving irritation handling, offline operation, and one projection across Today/Plan/Week/settings.
- Evidence: cycle store/calendar tests cover pause, resume, early/expired recovery, both legacy overlap orders, write failure, skip cleanup, and bulk staging; route contracts cover query cancellation, local-day rollover, pending dismissal, Start Today, and irritation ordering. Supported-phone human evidence is in `test-results/human-e2e/2026-07-10/cycle-disruption-reconciliation-current/`.
- Risk: native process-death, keychain/keystore failure, app foreground, timezone/DST changes, modal gestures, Dynamic Type, and VoiceOver/TalkBack still require the Tas-owned release-device run. Server cycle history and cross-device reconciliation remain `B-ROUTINE-PERSIST`, and cadence/recovery policy remains blocked on `B-DERM-REVIEW`.
- Status: Accepted.

### 2026-07-10 - Project Authored Cycles Through Safety And Cadence Authority

- Decision: A V1 Custom cycle is a schema-versioned record inside the encrypted current-owner cycle configuration. It stores a 1-14-night ordered list whose entries are either one stable shelf-product ID or recovery, plus the existing variant and anchor. The editor is an explicit Save/Cancel transaction; one private-key mutation persists the whole definition and any selected phased-introduction override before cache publication, analytics, or navigation. Visible controls and route removal remain locked while that write is pending; only the committed success path may leave. Structural edits preserve the existing anchor. Preset variants regenerate without deleting the saved Custom definition; the first Custom edit starts from an Auto recommendation rather than treating Custom as a generated preset, and returning to Custom restores the saved definition. Current cycle state lives at the isolated `routinekind.cycle.v2` private key; a valid `onskin.cycle.v1` record migrates one way and remains isolated for downgrade/account-cleanup safety. Current v2 requires its explicit schema; unreadable, malformed, missing-schema, or future-schema current data is preserved and fails closed instead of being deleted or replaced with defaults. Device export includes v2 as `cycle_configuration` and labels the retained old value `legacy_cycle_configuration` rather than exporting stale state as authoritative.
- Reconciliation: Safety filtering, reviewed cadence eligibility, and the current ramp run before an authored slot can project. A closed global cadence-review gate withholds both generated and Custom projection; it never reclassifies known authored IDs as missing. One product per slot makes same-night potent collisions impossible. At least one recovery slot is required. Requested frequency is derived from authored occurrences and displayed as an approximate weekly cadence; it does not mutate `active_ramp`. Generated and Custom cycles share the length-aware occurrence budget `floor(max_per_week * length / 7)`, while retaining one recovery slot. If a later profile/ramp/safety change lowers that budget, earliest authored occurrences remain and excess or ineligible slots project as recovery without erasing intent or blocking an unrelated Save/length edit. Every Custom projection records the authored product identity and one exact applied-state reason: authored recovery, missing shelf product, safety exclusion, staged introduction, cadence cap, or applied. New shelf actives are not silently inserted. Missing shelf IDs project as recovery and prune on the next explicit save; known but temporarily safety-ineligible IDs and cadence-excess occurrences remain retained for later restoration. Same-class adjacency is advisory and may be saved after a calm spacing nudge.
- Alternatives: commit every control immediately, re-anchor every edit to Night 1, mutate ramp state from the cycle editor, silently auto-insert new products, erase safety-filtered intent, allow an authored schedule to bypass caps, store invalid intent without an applied-state distinction, or wait for server cycle history.
- Criteria: deterministic and idempotent recompute; no safety restoration; no silent cadence escalation; stable product identity; exact Plan/Today/Week/Why Tonight agreement; offline operation; reversible editing; and non-destructive failed-write recovery.
- Evidence: Pure customization tests cover bounds, assignment/frequency edits, weekly cap/recovery enforcement, permutation, shelf/safety/ramp reconciliation, provenance, and idempotence. Store/export/route tests cover isolated migration, downgrade writes, future/missing schemas, concurrent disruption, authoritative device export, analytics order, review-gate closure, and pending route removal. Supported-phone Expo web evidence at 390 x 844 and 360 x 640 covers Save/Cancel, assignment, cadence-safe extension, retained excess intent, reload, preset round trip, one-shot failure, browser Back during persistence, retry, closed-gate behavior, cross-surface projection, accessibility names, and geometry in `test-results/human-e2e/2026-07-10/cycle-customization-current/`.
- Risk: frequency and recovery policy remain hidden in production until named dermatologist and cosmetic-chemistry review closes `B-DERM-REVIEW`. Native secure-storage, process-death, timezone/DST, Dynamic Type, VoiceOver/TalkBack, and physical-device cross-surface proof remain Tas-owned. Server history and cross-device reconciliation remain `B-ROUTINE-PERSIST`.
- Status: Accepted.

### 2026-07-10 - Preserve Identity During Anonymous Account Upgrades

- Decision: An active anonymous Supabase user upgrades in place. Native Apple/Google tokens use `linkIdentity`; email uses `updateUser({ email })` followed by `verifyOtp(..., type: 'email_change')` when confirmation is required. If Supabase auto-confirms that same-user update, the route completes immediately instead of entering code mode. Every successful upgrade must return the original user ID and a non-anonymous identity. Linking errors fail closed without a `signInWithIdToken` fallback. Sessions that are not anonymous keep the normal provider/email sign-in path.
- Alternatives: call `signInWithIdToken` or `signInWithOtp` for every account action, rely on automatic email matching, switch to an existing account and wipe device data, or build a server-side merge before launch.
- Criteria: preserve the plan created before signup, avoid silent local-private-data deletion at the value moment, follow the current installed Supabase contract, make conflicts explicit, and keep returning-user sign-in available.
- Evidence: `accountUpgrade.ts` asserts same-user and permanent-identity invariants; focused tests cover provider linking, email-change OTP, immediate auto-confirm completion, returning-user sign-in, link failure without fallback, stale sessions, user-ID mismatch, and incomplete conversion. Real Apple/Google/email staging proof remains `B-VERIFY-AUTH-LINKING`.
- Risk: manual identity linking and email templates must be configured in each Supabase project; a provider/email already owned by another account cannot be merged automatically and remains a safe recovery path until a reviewed merge policy exists.
- Status: Accepted.

### 2026-07-10 - Isolate Every Account Transition Before Rendering

- Decision: Sign-out, a changed Supabase user ID, a signed-out restore with retained owner metadata, or a cold-start local-owner mismatch unmounts the complete data-bearing app tree before cleanup. A domain-separated hash, never the raw user ID, binds local records to their owner. A separate cleanup-required control is written before deletion and survives until every authoritative store succeeds, preventing partial cleanup from becoming an unclaimed device. Rapid auth events serialize and publish the latest same-user session; explicit sign-out removes encrypted persisted auth; private-KV reads/writes/removals and encrypted-photo mutations/marker writes are blocked or drained; TanStack Query is cancelled and cleared before and after registered persisted cleanup; native key/file/notification and vendor-reset failures stay closed; and the next session plus route are published only after cleanup and owner claim succeed. Account deletion calls this root boundary once after server deletion. Session-restore or cleanup failure keeps both accounts behind one retryable gate. Same-user refresh and verified anonymous in-place upgrade do not clear data.
- Alternatives: clear only AsyncStorage/files, rely on account-agnostic query keys to refetch, key every query by user without clearing local stores, publish account B while cleanup runs, or sign out permanently when one cleanup backend fails.
- Criteria: no cross-account health/photo/shelf disclosure, no late account A write after deletion, no false empty-state flash, deterministic recovery, preservation of same-user guest value, cold-start mismatch detection, and no raw owner identifier at rest.
- Evidence: hashed-owner, durable-cleanup-control, partial-retry, and boundary-decision tests, including a signed-out cold start; delayed private-KV read/write/removal and encrypted-photo write/marker tests; strict multi-store deletion tests; serialized provider, persisted-auth, and restore-retry contracts; root-owned account deletion integration; and the 360 x 640 failure/retry plus signed-out direct-route pass in `test-results/human-e2e/2026-07-10/onboarding-account-isolation-current/`.
- Risk: local proof does not replace live Supabase sign-out, token-expiry, cold-start, and A-to-B testing on supported iPhone builds. A genuine cleanup failure intentionally blocks app data access until retry succeeds.
- Status: Accepted.

### 2026-07-10 - Compose Account Exports From Both Data Authorities

- Decision: The mobile account export wraps the required owner-scoped Supabase export and an exhaustive, path-sanitized snapshot of the current device's encrypted private records. Progress image files and thumbnails remain excluded; sanitized Progress metadata and decrypted notes are included when available. Configured server failures abort instead of returning a partial bundle, while backend-free builds identify their bundle as device-only.
- Alternatives: export only Supabase, silently fall back to local-only data on a configured server failure, mirror every local store before launch, or export raw encrypted storage envelopes.
- Criteria: literal data-portability claims, offline-first architecture, no silent omissions, readable output, credential/key isolation, and current launch scope.
- Evidence: local shelf/profile/cycle/ramp/completion stores are V1 authorities and their server mirrors are best effort or deferred; `localDeviceExport.ts` has a registry-coverage test against `LOCAL_PRIVATE_DATA_KEYS` plus media-path/ciphertext redaction tests.
- Risk: the same device must perform the export to include its local-first records; multi-device reconciliation remains deferred, and native share/cache behavior still requires physical-device staging evidence.
- Status: Accepted.

### 2026-07-11 - Bind Each Export to One Account Generation

- Decision: One cancellable account-generation lease now owns the complete combined-export operation: trusted authenticated-user capture, encrypted local snapshot, owner-scoped Edge request, response validation, JSON construction, temporary plaintext write, share availability, native sharing, and unconditional deletion. The server `user_id` must exactly match the initiating authenticated user. Sign-out, cold-start owner replacement, or A-to-B change increments the generation, aborts the Edge request, blocks new exports, and waits for the full operation plus temporary-file cleanup before destructive local cleanup or next-session publication. A stale generation cannot write or share. Nested cleanup boundaries remain blocked until the outermost boundary ends; same-user refresh does not invalidate a current export.
- Alternatives: bind only the local read, let Edge/cache/share work continue after sign-out, trust any non-empty server `user_id`, clear generated cache without draining writers, disable sign-out while export runs, or cancel every token refresh as if it were an account change.
- Criteria: no prior-owner plaintext created or shared after a new account publishes, exact server/local owner composition, prompt sign-out cancellation, deterministic cleanup/retry, device-only export support, and no false cancellation on same-user refresh.
- Evidence: `accountGeneration.test.ts`, `actions.test.ts`, `localAccountIsolation.test.ts`, and `accountSessionIsolationContracts.test.ts` cover delayed abort/drain, nested boundaries, stale leases, same-generation validity, exact owner mismatch, post-write invalidation, deletion, and root-boundary integration. Supported-phone UI evidence is in `test-results/human-e2e/2026-07-11/data-export-account-generation-current/`.
- Risk: `getUser`, real Edge cancellation, native share-sheet lifetime, and cache semantics still require configured Supabase plus supported physical-iPhone proof. A native share sheet already opened by account A intentionally keeps the next account gated until it closes and cleanup settles.
- Status: Accepted.

### 2026-07-10 - Persist Conflict Choices Without Weakening The Reviewed Schedule

- Decision: V1 stores each cosmetic timing choice in encrypted private KV under the canonical unordered product pair, conflict rule ID, and rule version. Both `accept_suggested_timing` and `use_together` suppress repeat advisory prompts for only that current-version pair across Shelf, Plan, Recommendations, Ask, and schedule explanations; legacy `keep_alternate_nights` values migrate to the generic accepted-timing value. Writes complete before success analytics or navigation; unreadable storage and unsupported future schemas fail closed without replacing prior data. The owner-RLS `routine_conflicts` mirror uses one canonical unique identity and remains best effort until routine sync is authoritative. `use_together` acknowledges the user's preference but does not auto-co-locate potent actives: one potent active per night, retinoid-exfoliant separation, pregnancy exclusions, frequency caps, phased introduction, and the cadence-review gate remain authoritative. Safety and reassurance rows are not eligible for a timing override.
- Alternatives: keep a string-only override set, key by rule alone, delete Keep decisions, auto-co-locate on Use together, let a preference restore safety-excluded products, trust analytics before persistence, or require live server sync for an offline choice.
- Criteria: exact-pair determinism, no repeat nagging, no stale-rule inheritance, no harm-relevant schedule bypass, honest UI semantics, offline persistence, idempotent mirror writes, privacy-safe analytics, explicit recovery, and downstream consistency.
- Evidence: pure persistence/eligibility, scheduler, Plan, recommendation, route-identity, migration source-contract, and integration tests cover both choices, legacy migration, future-schema preservation, rule-version changes, safety/reassurance exclusion, pregnancy suppression, exact recommendation/share routes, canonical upsert identity, and one-potent-active output. Supported-phone human evidence is retained in `test-results/human-e2e/2026-07-10/conflict-choice-schedule-current/`; live Postgres migration execution remains part of the risk below.
- Risk: the current co-use boundary is conservative product policy, not clinical approval. Named clinical and cosmetic-chemistry reviewers must approve any pair-specific same-session rule before the scheduler can weaken separation. The Supabase mirror and cross-device reconciliation remain blocked on deployed migration/live RLS evidence and `B-ROUTINE-PERSIST`; native encrypted-storage and assistive-technology behavior still require release-device QA.
- Status: Accepted.

### 2026-07-10 - Persist Routine Application Order By Shelf Product ID

- Decision: V1 stores separate Morning and Evening application-order preferences as versioned arrays of stable local shelf-product IDs in encrypted private KV. Generation remains authoritative for phase membership, safety/cadence exclusion, and canonical cycle nights; the preference can only reorder currently eligible `PlanStep` objects and their numeric application rank. Recompute retains surviving user-relative order, inserts newly eligible products deterministically beside canonical neighbours, preserves active-shelf IDs that are temporarily excluded, and prunes removed or replenished unit IDs on the next save. Example IDs are never stored. A save is successful only after persistence, then updates the shared plan query and analytics. The record is registered for current-device export and account-boundary cleanup.
- Alternatives: persist product names, keep route-local state, snapshot the generated plan, let order overrides control cycle nights, or require server routine authority before making the V1 editor honest.
- Criteria: duplicate-name safety, deterministic offline recompute, no safety/cadence bypass, no cycle split-brain, explicit save failure, current-owner privacy isolation, data portability, and compatibility with deferred cross-device sync.
- Evidence: `orderStore.test.ts`, `orderRoutes.test.ts`, local private-data registry/export tests, and the supported-phone human flow under `test-results/human-e2e/2026-07-10/routine-order-persistence-current/`.
- Risk: local shelf IDs are not cross-device identities, and replenishment intentionally creates a new unit ID. Server sync/remapping remains `B-ROUTINE-PERSIST`; native storage, assistive-technology, and relaunch behavior still require release-device proof.
- Status: Accepted.

### 2026-07-10 - Fail Closed On Unreadable Device Encryption Keys

- Decision: Native private-record keys remain SecureStore-only, except for read-only migration of an existing legacy fallback; Expo web uses its explicit AsyncStorage path. Missing, malformed, unavailable, or non-authenticating keys never delete ciphertext or create replacement key material on a read. Private-KV parsing distinguishes complete current envelopes from legacy values and applies malformed/future-envelope blocking only to app-owned keys; only known Supabase auth-storage keys are excluded as a separate authority. Malformed and unsupported app-owned envelopes remain byte-identical, count as orphaned ciphertext, and block replacement. A failed encrypted read blocks a same-snapshot fallback write until the record is read successfully or explicitly removed. Same-key mutations serialize, queued mutations are tracked by account-boundary draining, every write rechecks the stored snapshot immediately before commit, and generic private APIs reject Supabase auth and private content-key namespaces. Progress writes require a persisted non-sensitive key-history marker, scan legacy encrypted photo files before first-key creation, reject malformed or previously lost keys, and share one in-flight key creation across concurrent first writes.
- Alternatives: delete unreadable envelopes and return defaults, rotate keys automatically, write new native keys into AsyncStorage when SecureStore fails, rely on every feature store to distinguish storage failures, or add cloud key recovery before launch.
- Criteria: no silent local data loss, native key confidentiality, deterministic recovery, concurrency safety, backwards-compatible web and legacy-key behavior, explicit user deletion, and testability without claiming unavailable OS evidence.
- Evidence: `privateKVContentKey.test.ts`, `privateKV.test.ts`, `encryptedStorage.test.ts`, and `store.test.ts` cover native/web storage boundaries, legacy migration, missing/invalid/wrong keys, malformed/truncated/future envelopes, foreign/reserved-authority isolation, transient read failure, failed-marker persistence, same-key serialization, queued-boundary rejection, stale/concurrent-write refusal, ciphertext preservation, Progress note propagation, and concurrent first writes. Expo web corruption/recovery evidence is in `test-results/human-e2e/2026-07-10/private-envelope-corruption-current/`.
- Risk: ciphertext is unrecoverable after genuine OS key loss because the release intentionally has no cloud backup or recovery escrow. Physical-iPhone Keychain, reinstall, restore, locked-device, and storage-pressure behavior still requires staging-device evidence; the app must surface retry/recovery rather than claim recovery it cannot perform.
- Status: Accepted.

### 2026-07-10 - Gate Every Sensitive Progress Entry With Shared App-Lock State

- Decision: When app lock is enabled, the app tree does not mount until its encrypted preference resolves; an unreadable preference fails closed as enabled and locked. The preference reader returns typed absent, available current/legacy, unavailable, corrupt, and unsupported outcomes without read-time repair. A malformed or unsupported app-lock preference does not auto-prompt or rewrite to disabled: the lock explains the exact setting-level recovery, and only an explicit successful device authentication removes that one malformed preference before app content can mount. Missing/conflicting key material, decryption failure, and transient storage failure instead expose a real non-destructive reread and never offer setting reset. Every preference reread temporarily locks and disables actions, advances a preference generation, and invalidates older work. The initiating account-generation lease plus the exact provider interaction covers readiness, serialized native authentication, optional reset or strict atomic write, and React-state publication, so a delayed account-A prompt or stale provider cannot present over, touch, or unlock account B. Device PIN/passcode fallback remains enabled. The exact first OS-owned non-active hop for the presented prompt may survive iOS `inactive` or Android API 29 credential fallback; it cannot publish before `active`, a second non-active event hard-invalidates it, and a missing foreground event times out after ten seconds. Real background/non-prompt transitions clear the photo-timeline session and relock globally. The app-wide unlock must finish before the separate photo-timeline prompt can start. Progress tab, capture, review, and single-photo detail all use one provider-owned timeline unlock inside their Pro gates; navigation reuses that unlock only while the app remains active. The generic no-score explainer remains outside the second lock.
- Alternatives: keep a tab-local gallery gate, authenticate independently on every nested screen, put the timeline gate outside entitlement checks, treat unreadable lock preference as disabled, or rely only on the app-wide overlay.
- Criteria: direct-link privacy, no pre-lock content mount/flash, prompt ordering, usable in-session navigation, background relock, free-user paywall ordering, and deterministic browser/native verification.
- Evidence: `PhotoTimelineLockGate.tsx`, `AppLockProvider.tsx`, typed preference/decision tests, delayed account-generation and interaction-lifecycle tests, app-lock and Progress route contracts, plus 360 x 640 and 390 x 844 direct-route/session evidence in `test-results/human-e2e/2026-07-10/progress-direct-route-lock-current/`. A real malformed web preference stays unchanged behind the lock and then recovers through the named authenticated reset in `test-results/human-e2e/2026-07-10/private-envelope-corruption-current/`. Persistent and one-shot typed reread behavior is recorded in `test-results/human-e2e/2026-07-14/app-lock-typed-preference-current/`.
- Risk: Expo web proves routing, mounting, geometry, retry/relaunch, and state transitions but not native authentication security. Physical iPhone and API-29 Android LocalAuthentication ordering, A-to-B prompt interruption, true background/cancellation timing, VoiceOver/TalkBack focus restoration, and real Keychain/Keystore failure/recovery remain release QA.
- Status: Accepted.

### 2026-07-10 - Treat Progress Read Failure As Blocked, Never Empty

- Decision: After entitlement and any configured biometric gates pass, the Progress tab, capture, review, and single-photo detail must still complete one successful encrypted photo-metadata query before route content or photo mutations mount. Pending reads show a neutral privacy state. Failed reads show one shared, non-destructive recovery surface with a real query retry; direct routes also expose `Back to Progress`. Empty-timeline and missing-photo UI are valid only after a successful read proves those states.
- Alternatives: let each route interpret `undefined` as empty, catch storage failure in the store and return `[]`, show route-specific errors while still mounting content, or permit capture/save against cached defaults.
- Criteria: preserve ciphertext, avoid false deletion/loss signals, prevent stale/default overwrites, keep camera/review/detail content private, make transient SecureStore/Keychain/Keystore failure recoverable, and keep route behavior consistent.
- Evidence: `PhotoStorageGate.tsx`, `usePhotos.ts`, photo store and route contracts, plus persistent and one-shot supported-phone evidence in `test-results/human-e2e/2026-07-10/progress-storage-recovery-current/`.
- Risk: Expo web proves query state, content gating, retry, layout, and network absence but cannot inject real native Keychain faults. Physical-iPhone staging builds must prove ciphertext remains byte-identical and retry succeeds after key access returns.
- Status: Accepted.

### 2026-07-06 - Keep Expo/Supabase/RevenueCat

- Decision: Continue current stack unless beta/device/compliance evidence says otherwise.
- Alternatives: native apps, Flutter, Firebase, custom backend.
- Criteria: speed, current repo fit, camera/IAP support, TypeScript reuse, RLS.
- Evidence: current implementation and docs already use Expo, Supabase, RevenueCat.
- Risk: native camera/OCR and widgets require custom build QA.
- Status: Accepted.

### 2026-07-06 - Deterministic Rules Over AI For Safety

- Decision: Conflict, pregnancy, routine sequencing, PAO, and safety guidance must be deterministic and reviewer-backed.
- Alternatives: GPT-generated guidance, cloud RAG only, broad AI advisor.
- Criteria: liability, explainability, repeatability, testability.
- Evidence: competitor AI claims are crowded; repo already gates rules with `reviewedBy`.
- Risk: slower content expansion.
- Status: Accepted.

## Stack Decisions

### 2026-07-06 - Local-First Photos And Shelf

- Decision: Keep privacy-sensitive data local by default.
- Alternatives: cloud sync first, cloud photo analysis.
- Criteria: privacy differentiation, MHMDA/privacy risk, trust.
- Evidence: repo and positioning already emphasize photos stay on device.
- Risk: multi-device sync and backup deferred.
- Status: Accepted.

## Pricing Decisions

### 2026-07-06 - Annual-First Subscription

- Decision: Test $49.99/year annual Pro with monthly anchor and no weekly plan.
- Alternatives: $29.99/year, $59.99/year, weekly subscription, one-time purchase.
- Criteria: $30k/month target, competitor pricing, retention, subscription norms.
- Evidence: HadaBuddy publicly lists $29.99/year; Think Dirty premium reported at $59.99/year; RevenueCat reports subscription conversion is unforgiving and first-session value matters.
- Risk: premium price must be justified by trust and retention.
- Status: Proposed.

### 2026-07-06 - Reverse Trial

- Decision: Use a no-card reverse trial after value, then downgrade to useful free tier.
- Alternatives: hard paywall, carded trial only, freemium only.
- Criteria: discovery-channel fit, trust, first-session value.
- Evidence: RevenueCat reports hard paywalls convert better but first-session aha is critical; this category benefits from experiencing value.
- Risk: if users do not engage during the trial, value is given away.
- Status: Proposed.

## Appearance Decisions

### 2026-07-17 - Ship An Explicit Light-Only UI With Route-Owned Night Contrast

- Decision: V1 launches with `userInterfaceStyle` fixed to `light`, one light
  splash configuration, and dark status icons on paper surfaces. The existing
  intentionally dark product surfaces remain dark and mount light status icons
  only while visible: PM Today, onboarding reveal, commerce transparency, cycle
  week, Shelf scan, Progress capture/review/detail, win-back, and the safety
  conflict variant. Shared `Screen` owns paper/night contrast; direct dark roots
  use the same two-tone policy. Transparent sheets inherit the underlying route
  status style because their sheet tone does not fill the status-bar area.
- Alternatives: advertise full automatic dark mode without a complete semantic
  token/route/accessibility pass; remove intentional night surfaces; or let each
  route choose untyped literal icon styles.
- Criteria: deterministic launch appearance, readable system-icon contrast,
  no unreviewed palette selected by device appearance, minimal route-specific
  code, and a reversible path to a future full dark-mode review.
- Evidence: the resolved Expo public config reports `userInterfaceStyle=light`;
  a source/config contract covers the root default, shared `Screen`, direct
  full-night routes, dynamic safety conflict, light-only splash, and retained
  Android back flag. See
  `docs/optimization/evidence/2026-07-17_theme-system-bar-and-predictive-back-scope.md`.
- Risk: native status icons and launch-screen transitions cannot be proven by
  Expo web. Supported-iPhone screenshots in both device appearance settings,
  including gated and back-navigation transitions, remain release-device QA.
  Full dark mode requires a new reviewed semantic-token, route, Dynamic Type,
  contrast, VoiceOver, screenshot, and rollback matrix.
- Status: Accepted.

## Release Delivery Decisions

### 2026-07-18 - Use An Encrypted Owner-Bound Transactional Outbox For Local Sync

- Decision: Replace fire-and-forget Shelf, notification-preference, recommendation-preference, and immediate notification-delivery mirrors with one encrypted, bounded `onskin.outbox.v1` state machine. Authenticated state mutations append sanitized intent through crash-recoverable encrypted private-KV transactions without changing their source codecs. Immediate delivery reserves its encrypted cap event before the native call and, only after OS schedule acceptance, atomically marks that exact event delivered plus appends a unique content-free outbox row; signed-out delivery remains local-only. Each row carries an operation UUID, domain-separated owner hash, captured account generation, stable entity UUID, revision/payload-bound idempotency key, enqueue/retry/lease state, and safe error class. Raw user IDs, credentials, notification content, health data, ingredients, and device paths are invalid payload data. Ready state mirrors may coalesce, obsolete state snapshots are pruned/fenced, and immutable delivery events never coalesce; settled delivery revision entries are reclaimed. One account-generation-fenced worker drains bounded batches after mutation, reconnect, and foreground, with expired-lease takeover, full-jitter backoff, bounded `Retry-After`, duplicate/stale success, and poison-row isolation. Authenticated Postgres RPCs derive ownership from `auth.uid()`, own receipt/revision serialization, reject direct notification-log inserts, and never trust client-supplied ownership.
- Alternatives: retain best-effort direct writes; retry individual requests in memory; store raw owner IDs in a plaintext queue; put server sync fields inside each source codec; coalesce immutable event history; log before native acceptance; allocate replay identity after native acceptance; or adopt a new native database before proving the protocol.
- Criteria: offline bathroom use, atomic local durability, response-loss safety, duplicate/reordered convergence, bounded work and storage, content-free diagnostics, account A-to-B isolation, rollback compatibility, and an extensible but strictly versioned protocol.
- Evidence: `apps/mobile/src/lib/storage/privateKVTransactionCore.ts`, `apps/mobile/src/lib/offline/outbox.pure.ts`, `apps/mobile/src/lib/offline/outbox.ts`, the Shelf/notification/recommendation stores and migrations, and the five dated transactional-outbox checkpoint files in `docs/optimization/evidence/`.
- Risk: completion history remains on its legacy isolated path until authoritative server routine/step IDs exist; it must become a non-coalescing event entity rather than borrowing Shelf semantics. Private KV rewrites a bounded JSON snapshot, so the separately governed encrypted local-database decision remains open. A process kill between OS acceptance and the confirmation transaction can conservatively leave a reserved cap row without telemetry; it cannot create a false server delivery. Hosted Supabase replay/RLS/concurrency and supported-iPhone process-kill/offline/reconnect/presentation evidence remain release gates.
- Status: Accepted as the technical architecture; locally implemented, release verification pending.

### 2026-07-17 - Ship Client Changes Only In Store-Bundled Binaries

- Decision: V1 client JavaScript, assets, native code, plugins, permissions,
  entitlements, privacy configuration, and app configuration ship only in
  reviewed App Store binaries. EAS Build and Submit remain supported, while
  EAS Update is disabled, is not a direct mobile dependency, has no update URL
  or build-profile channel, and is not an incident rollback path. The
  `runtimeVersion` fingerprint remains an artifact and migration compatibility
  identity, not proof of OTA capability.
- Alternatives: fully adopt EAS Update with governed runtime compatibility,
  immutable update identity, staged rollout, rollback/forward-fix exercises,
  prior-runtime migration testing, named ownership, and production monitoring;
  or leave ambiguous channel and OTA claims in release documentation.
- Criteria: shipped behavior must match repository configuration; recovery must
  not bypass store-reviewed privacy/native changes; encrypted-storage and
  native migrations must remain binary-compatible; no unavailable capability
  may appear in launch, incident, or compliance claims.
- Evidence: `docs/UPDATE_DELIVERY_POLICY.md`, `docs/ARCHITECTURE.md` A-007,
  `apps/mobile/app.base.json`, `apps/mobile/eas.json`, and
  `scripts/optimization/store-only-release-audit.mjs`.
- Risk: client fixes require a new binary and store rollout, so incident
  response must emphasize rollout halt, server/flag/provider containment when
  appropriate, and a reviewed hotfix. Future EAS Update adoption requires the
  complete reactivation gate in `docs/UPDATE_DELIVERY_POLICY.md` and cannot be
  inferred from the fingerprint policy.
- Status: Accepted.
