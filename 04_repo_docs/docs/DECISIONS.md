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

### 2026-07-14 - Use iOS-Specific Commerce And Honest Deletion-Timing Copy

- Decision: On iOS, purchase, cancellation, restore, and subscription-management copy
  names Apple or the App Store only; it does not mention a marketplace that is outside the
  iOS release. Account-deletion recovery says completion can take up to 29 days while
  providers verify erasure. An unresolved native purchase/restore is surfaced from the
  durable transaction journal with a do-not-buy-again/restore-first recovery path instead
  of a false success or a second charge attempt.
- Type: Product / Privacy / Legal / Launch
- Alternatives: reuse cross-platform marketplace copy, imply immediate provider erasure,
  hide ambiguous native transactions, or permit another purchase before reconciliation.
- Criteria: truthful marketplace semantics, no misleading erasure timing, charge safety,
  durable recovery, and an auditable App Review surface.
- Evidence: `storefrontCopy.ts`, `accountDeletionCopy.ts`,
  `storeTransactionNotice.ts`, their focused tests, and the 2026-07-14 source checkpoint.
- Risk: source copy and tests are not Apple, legal, or privacy approval. Exact App Store
  metadata, policy/support/privacy-report URLs, counsel review, sandbox/TestFlight proof,
  non-expiring demo review access, and App Review remain open.
- Status: Accepted for source behavior; external approval remains gated.

### 2026-07-15 - Keep Source Hardening Separate From Launch Clearance

- Decision: Do not treat local migration, server, mobile, or repository tests as proof of
  hosted/provider behavior or legal/App Store acceptance. Launch remains blocked on a
  reviewed non-destructive health-consent withdrawal flow; the complete Sign in with Apple
  authorization-code, state/nonce, encrypted rotating token-vault, daily validation,
  canonical signed server-notification, and authoritative session-access lifecycle; exact
  privacy-report and policy/support URLs; stable non-expiring demo access; live-service and
  provider evidence; physical-iPhone QA; professional signoff; and App Review.
- Type: Privacy / Legal / Launch
- Alternatives: declare launch readiness from source coverage, use account deletion as a
  substitute for consent withdrawal, or infer Apple/legal acceptance from fail-closed code.
- Criteria: truthful evidence boundaries, purpose-limited consent, revocation completeness,
  reviewer reproducibility, and no unsupported compliance claim.
- Evidence: the 52-migration/two-reset checkpoint, focused server/mobile suites, integrated
  repository verification, and the remaining blockers recorded in the launch-readiness
  documents. Apple `TRANSFERRED` now fails closed as `credential_transferred`; that is a
  safety control, not an approved transfer/migration policy.
- Risk: the app cannot be submitted honestly until the external owners and live candidate
  close these gates against exact evidence.
- Status: Accepted.

### 2026-07-15 - Require A Server-Attested Apple Credential Lifecycle

- Decision: Treat a Supabase Apple identity or issued access JWT as
  insufficient account authority on its own. Native Apple sign-in must bind an
  exact state echo and raw nonce, authenticate/link with the ID token without
  giving the one-use authorization code to Supabase, and complete a composite
  server capture before the session can publish. The server verifies the token
  and nonce, matches the exact Apple identity and Supabase session, exchanges
  the code once, and stores only an AES-GCM refresh-token envelope. A
  one-minute scheduled worker performs no-more-than-daily refresh-token
  validation; signed Apple account events and native credential invalidation
  retire the lifecycle and sessions. RLS, photo Storage, authenticated Edge
  Functions, writes, and direct authenticated helper RPCs enforce the same
  exact-session account-access decision. Terminal signed events can exact-match
  an existing Apple Auth identity before lifecycle capture, while a terminal
  event that precedes the identity is stored only as audience-bound keyed
  evidence and reconciled by first capture before code exchange. No Apple retry
  is required for that closure, and the raw subject is never persisted.
- Type: Architecture / Privacy / Security / Launch
- Alternatives: trust Supabase's Apple ID-token session alone; pass the
  authorization code to Supabase and lose the lifecycle exchange; store the
  refresh token in plaintext; rely only on device credential state; or process
  unsigned/unpersisted provider callbacks.
- Criteria: one code consumer, nonce/state replay resistance, owner and subject
  binding, encrypted provider credentials, daily validity evidence, durable
  terminal events, no-retry pre-identity reconciliation, stale-JWT denial,
  deletion continuity, and bounded outage behavior.
- Evidence: migration `20260715000055_apple_auth_lifecycle.sql`, the
  `apple-auth-lifecycle`, `apple-account-events`, and `apple-auth-worker`
  functions, mobile composite permit/capture and invalidation clients, the
  shared account-access fence, focused source tests, and
  `docs/phase-9/apple-auth-lifecycle-operations-runbook.md`. The current local
  gate includes two clean resets, exact 54/0055 history, the full structural
  suite plus 114 Apple pgTAP assertions, schema lint, empty shadow diff,
  temporary type generation, 20 focused event/lifecycle Edge tests, and the
  47-test Apple auth work lane.
- Risk: migration cutover blocks an existing Apple account until it completes
  fresh capture. Subject-HMAC and vault keyrings support at most three
  overlapping versions. Each successful daily validation atomically moves the
  subject digest and a freshly sealed refresh-token envelope to the current
  versions; dormant, deferred, or failing rows do not advance from configuration
  alone, so old-key retirement still requires zero-row evidence, recapture, or
  fail-closed reauthentication. Unresolved terminal `unknown_subject` evidence
  also pins its subject-key version until reconciliation or reviewed
  disposition. Code/event HMACs are single-key boundaries and
  require a separately reviewed rotation plan. Hosted deployment, live Apple
  event delivery, Cron/Vault continuity, physical-iPhone/TestFlight,
  privacy/security/legal review, transfer policy, and App Review remain open.
- Status: Accepted and locally verified for source architecture; production
  rollout and external acceptance remain gated.
- Owner: Engineering for source and operations; named reviewers and Apple for
  external decisions/outcomes.
- Review date: Before hosted migration 0055 and after the first complete
  rotation/rollback drill.

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

### 2026-07-11 - Make Shelf Freshness Provenance-Derived And Replenishment Opt-In

- Decision: Normalize every Shelf lifecycle write through one freshness contract. A PAO clock exists only when `opened_at` is a valid, non-future device-local calendar date; unopened units keep `opened_at=null`. Actionable `printed` dates must be explicitly entered or reconfirmed from the exact physical package. A product-level catalog row has no lot/package binding and never populates Shelf `expiryDate`; historical catalog-linked dates are retained only in a non-actionable legacy-unverified quarantine pending separate package reconfirmation and are never silently promoted, deleted, or used for time-pressure/recommendation state. `expirySource` follows the actual winning trusted date candidate, with the earlier of physical-package printed expiry and opened date plus PAO controlling the surfaced state and an exact tie resolving to printed. Shelf `label` is reserved for direct product-label entry; reviewed catalog-delivered `label`, `brand_label`, or `catalog` rows persist as Shelf `catalog`, while the catalog retains the finer evidence origin. Historical v1 `label` rows may be actor-ambiguous, so downstream copy describes the recorded product-label PAO without claiming who entered it. Ambiguous, unreviewed, stale, source-mismatched, or region-mismatched catalog PAO evidence degrades to unknown instead of becoming a default. Current category-only intake and v1 upgrade also fail closed until an exact server-attested category marker is retained locally and both database and named chemistry-review gates pass. Re-add requires an explicit choice of opened today, exact past opened date, or unopened; it archives the prior package, creates an operation-UUID-backed new unit, preserves the immutable `replacementRootId`, records `replacesProductId`, preserves eligible product-level PAO provenance, and clears package-specific printed expiry. Authenticated canonical v1 bytes remain unchanged on read or failed mutation and are emitted as v2 only after a successful authorized atomic mutation. Replenishment uses only trusted tracked label/catalog PAO, physical-package printed-expiry state, or an unsuperseded user-marked-finished unit; category estimates, legacy-unverified dates, and unknown states are non-actionable, and notification preferences default off and require explicit Settings opt-in.
- Type: Architecture
- Alternatives: infer an opened date from add/replacement time, import product-level catalog expiry as a physical-package date, discard or silently trust ambiguous historical dates, treat category defaults or catalog-delivered evidence as direct label entry, preserve any stored `expirySource`, accept unreviewed catalog PAO rows, reuse a Shelf row on repurchase, rewrite authenticated v1 bytes on read, infer depletion from elapsed time, or default replenishment notifications on.
- Criteria: truthful provenance, deterministic calendar behavior, no fabricated scarcity, local/server consistency, reversible package history, reviewed catalog boundaries, privacy-respecting notification consent, and testable migration invariants.
- Evidence: central freshness/store/PAO/catalog/replenishment tests; migrations `20260711000038_shelf_freshness_invariants.sql`, `20260711000039_replenishment_alert_opt_in.sql`, and `20260718000060_cat07_truthful_freshness.sql`; the CAT-07 pgTAP/static/rehearsal contracts; and reviewed Edge response contracts. The supported-phone packet in `test-results/human-e2e/2026-07-11/shelf-freshness-provenance-current/` is historical and explicitly stale for the current replacement, v2-lineage, and non-actionable-estimate contract.
- Risk: a green integrated source checkpoint, fresh local/hosted migration and RLS proof, reviewed region-matched live catalog data, notification delivery, native encrypted-storage relaunch, accessibility, qualified cosmetic-chemistry/legal review, and Apple replenishment-commerce classification remain external release gates.
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

- Decision: The encrypted local skin profile is the exact v2 quiz-contract status authority, and personal profile use/write requires a granted health-consent record with the exact current version and SHA-256 text hash. A usable local receipt must bind the pinned content, scoring, output-schema, combined hash, launch-blocked review status, integer basis-point projections, DSPT tie rule, canonical sensitivities, and one or two approved goals; it retains no raw answers or answer hash. Legacy, contract-mismatched, malformed, future, or unreadable local data is preserved and blocks server fallback. If and only if the local profile is genuinely absent, a server row may provide non-safety axes/goals after the reader applies every exact v2 provenance filter and independently validates the complete tuple; its pregnancy status is always unknown, so a stale server `none` cannot clear caution. One reader feeds Shelf, Plan, scheduler, Today, recommendations, and conflicts. Only explicit current local `none` clears caution; affirmative, prefer-not, unknown, missing, and unavailable states remain cautious without an inferred pregnancy claim. Exclusions come from the launch-gated docs/02 rule records: production accepts only rules with review metadata; development/staging may exercise starter rules. Eligible rules remove retinoid and hydroquinone plus BHA unless every threshold-bearing active percentage is unambiguously tag-associated and confirmed low. Filtering precedes sequence/cycle/ramp/replacement recommendations/Today; a closed cadence-review gate withholds treatment and exfoliant placement instead of turning actives into daily steps. Status writes persist locally first, lock competing choices while pending, and invalidate every dependent cache.
- Alternatives: preserve separate server/local readers, trust a server-only `none`, accept any historic consent grant, parse the first percentage in a product name, duplicate an unreviewed safety table, leave unassigned PM actives daily, or infer affirmative pregnancy for caution copy.
- Criteria: deterministic reviewed medical-adjacent behavior, no fail-open default, no contradictory Plan/Today routine, no false health-status claim, consent integrity, offline operation, and explicit non-destructive recovery.
- Evidence: focused tests cover consent version/hash, local read states, stale server `none`, all statuses, reviewed/unreviewed rules, retinoid/hydroquinone/BHA, adversarial multi-percentage names, cadence closure, replacement suppression, conflict semantics, and cache invalidation. Supported-phone Expo web drives `none -> pregnant/trying -> breastfeeding -> prefer_not -> none`, one-shot profile and consent write failures with retry, encrypted reload, legacy-consent regrant, missing-profile recovery, Plan/Today consistency, and 200% text pressure at 360 x 640 and 390 x 844 in `test-results/human-e2e/2026-07-10/pregnancy-safety-status-current/`.
- Risk: labels, exclusions, cadence, quiz content/scoring, age policy, and consent copy remain unreviewed starter positions until named clinical, cosmetic-chemistry, IP, and legal/privacy signoff is attached to the exact hashes through Phase 3. V2 has no reviewed status-refresh interval or transactional server reconciliation, so multi-device freshness remains open.
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

- Decision: Sign-out, a changed Supabase user ID, a cold-start local-owner mismatch, or an interrupted authorized cleanup unmounts the complete data-bearing app tree before cleanup. A domain-separated hash, never the raw user ID, binds local records to their owner. The boundary validates the complete cleanup/owner/retained/quarantine proof tuple rather than trusting one key. A retained owner stays quarantined across signed-out restore, exact-owner reauthentication consumes that proof, and a different login wipes before publication. A private-cleanup control is written before deletion and survives until every authoritative store succeeds, preventing partial cleanup from becoming an unclaimed device. A separate auth-derived-cleanup control is committed before any recovery-forced sign-out and survives until query, notification, analytics, image-memory, and vendor cleanup all succeed. Rapid auth events serialize and publish the latest same-user session; explicit sign-out removes encrypted persisted auth; private-KV reads/writes/removals and encrypted-photo mutations/marker writes are blocked or drained; TanStack Query is cancelled and cleared before and after registered persisted cleanup; native key/file/notification and vendor-reset failures stay closed; and the next session plus route are published only after cleanup and owner claim succeed. Account deletion uses the same root-owned cleanup primitives from the pre-Auth recovery gate: exact-owner ambiguous intake retains only the verified Supabase session for one idempotent retry while isolated/vendor/query cleanup runs, accepted or pending intake clears that session too, and terminal completion retries cleanup idempotently instead of deferring one attempt until server hard deletion. Session-restore or cleanup failure keeps both accounts behind one retryable gate. Same-user refresh and verified anonymous in-place upgrade do not clear data.
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

### 2026-07-26 - Replay Shelf Before Completion And Preserve Correctable Intent

- Decision: Use strict encrypted v3 Shelf and completion records with stable
  lowercase UUID v4 identities, append-only journals, FIFO outboxes, governed
  terminal receipts, and no invented replay work from historical schemas. One
  Today check-off writes visible completion and its replay event in the same
  private-KV transform before success publication. The offline coordinator
  drains Shelf before completion. A missing server product identity remains
  retryable. If the local Shelf record proves an unresolved terminal operation
  for that product and no pending correction, atomically move the exact
  completion and its remaining same-routine/date group through the routine-day
  marker to the FIFO tail. Keep every original event replayable after a
  corrective Shelf operation. Only an exact remote-terminal completion enters
  the terminal lane; every same-routine/date routine-day marker then enters a
  dependency-terminal lane instead of being dispatched.
- Alternatives: dispatch completions ahead of Shelf, permanently reject a
  completion when a Shelf upsert is terminal, quarantine all product-dependent
  completion work, let a routine-day marker overtake an earlier step, drop the
  head to unblock unrelated work, or retry the same blocked head forever.
- Criteria: persistence-before-success, stable idempotency, FIFO causality,
  recovery after correctable product data, no head-of-line deadlock, no
  unsupported routine-day claim, bounded replay work, owner/account/health
  isolation, and exportable retained intent.
- Evidence: `completionSync.ts`, `completionsStore.ts`,
  `completionQueue.ts`, `shelfMirrorQueue.ts`, `OfflineSync.tsx`, the focused
  Vitest suites, and the mandatory
  `scripts/core05/adherence-source-contract.test.mjs`.
- Risk: local-source and mock-RPC results do not prove native durability,
  response-loss recovery, or two-device delivery order. Hosted two-user/
  two-session replay, physical-iPhone process death, account switching,
  withdrawal, and exact-current human-simulated E2E remain release gates.
- Status: Accepted as an `in_progress` source boundary; not launch-cleared.

### 2026-07-26 - Keep Minimal Deletion-Wins Identity And Export Subject Receipts

- Decision: Separate mutable Shelf content from
  `shelf_product_identities`. A delete of a missing same-owner identity creates
  a minimal tombstone, prevents resurrection, preserves validation of a queued
  completion at or before the effective cutoff, and makes a later completion
  terminal. Keep private Shelf/completion replay ledgers with only owner,
  operation/event identity, a domain-separated request digest, bounded
  disposition, and timestamps—never raw request payloads. Expose stable
  identity/tombstone fields and receipt state/result/timestamps only through
  three authenticated, nonanonymous, `auth.uid()`-derived keyset export RPCs;
  direct table grants remain revoked. Server export schema v4 pins the initial
  health read epoch into every health-fenced read, performs two exact
  count/checksum/owner/column-guarded passes, and rechecks lifecycle before
  delivery. Exclude `request_sha256` from the subject receipt because it can be
  tested against guessed deleted payloads and does not explain the disposition.
  With no safe protocol replay horizon, retain tombstones and minimized
  receipts only for the active account/health-purpose lifetime, then erase them
  on health withdrawal or account/Auth deletion.
- Alternatives: cascade-delete product identity and historical routine
  references, resurrect a late upsert, retain raw replay bodies, grant direct
  client/service-role table reads, omit the new records from access export,
  export request fingerprints, or impose an uncoordinated TTL on a suspended
  device's replay authority.
- Criteria: deletion-wins, historical evidence integrity, cross-owner safety,
  payload minimization, data portability, stable export completeness,
  withdrawal/account erasure, and no silent health-RLS omission.
- Evidence: migrations
  `20260726000068_routine_adherence_authority.sql` and
  `20260726000069_routine_completion_sync_bridge.sql`, the `0069` database/
  upgrade tests, `healthSyncExportCore.ts`, `exportRegistry.ts`, data-export
  tests, and the CORE-05 source contract.
- Risk: active-purpose lifetime is an engineering necessity until a versioned
  replay expiry exists, not an approved legal retention period. Counsel must
  approve the legal basis/duration, final notices, backup treatment, access
  scope, and `request_sha256` exclusion. Hosted export concurrency, withdrawal/
  deletion zero residue, App Privacy labels, security review, and App Review
  remain open.
- Status: Accepted as a minimized source design; privacy/legal approval pending.

### 2026-07-26 - Make Recommendation Admission Positive And Product-Specific Mode Empty

- Decision: CORE-06A recognizes only `type_first` and `shelf_context`
  recommendation provenance. Product-specific mode starts closed, admits an
  empty catalog set, and has no current `catalog_product` producer. Goal-active
  output requires all of the Phase 7 flag, the exact current health-consent and
  profile boundary, exact current goal provenance, and a positive current
  recommendation-review clearance; the clearance set starts empty. Commerce
  cannot attach where-to-buy behavior to either current provenance kind and
  cannot participate in need detection or ranking; current commerce admission
  returns `false` unconditionally. The production engine does not accept a
  caller-supplied recommendation-type collection. Unavailable profiles and
  unreadable preference/dismissal records withhold suggestions. Migration
  `0071` purges all legacy recommendation-cache rows and revokes all unused
  runtime table privileges; retained owner/export reads and the exact
  preference-writer RPC do not create recommendation authority.
- Type: Product / Architecture / Privacy / Legal / Launch
- Alternatives: trust a mutable `reviewedBy` field, infer authority from catalog
  quality or correction counts, let a flag expose goal actives, render a generic
  product card before provenance exists, preserve authenticated direct cache
  writes, or rely on disclosure while allowing commission fields into ranking.
- Criteria: zero product admission by default, closed-set rejection reasons,
  explicit and exhaustively handled current provenance, exact upstream
  freshness, independent ranking, no commerce fetch before product admission,
  a purged and sealed legacy cache, and truthful no-product recovery. The
  current goal-provenance envelope is deliberately not treated as an
  unforgeable authorization receipt. A successor must bind exact SKU, market,
  and admission receipt and use server-minted, server-verified goal receipts
  bound to the exact account, health-processing lifecycle, profile completion,
  goal set, review scope, and expiry.
- Evidence: the CORE-06A recommendation-admission source checkpoint, bounded
  mobile tests, database seal contract, and
  `scripts/core06/recommendation-admission-source-contract.test.mjs`.
- Risk: source controls do not supply an approved product corpus, exact claims,
  market classification, qualified clinical/cosmetic-chemistry/regulatory
  review, hosted database or retailer proof, current affiliate terms approval,
  native/accessibility/network evidence, final policy/App Privacy answers,
  counsel clearance, Apple acceptance, product-market fit, or revenue.
- Status: Accepted for the zero-product-admission source architecture;
  CORE-06A and production rollout remain gated.
- Owner: Product, clinical content, catalog, commerce, privacy, and release
  owners share the downstream gates.
- Review date: Before any product-specific recommendation, goal-active
  suggestion, retailer fetch, or App Store submission candidate.

### 2026-07-29 - Make Conflict Sharing A Separate Zero-Admission Authority

- Decision: CORE-07A separates private clinical-conflict admission, share
  publication, and public-link resolution. The current share and public-link
  admissions are literal `false`; there is no receipt issuer or token service.
  A flag, final domain, `reviewedBy` string, exact owned pair, or QA evidence
  cannot grant authority. The share UI may receive only a deliberately
  constructed sanitized allowlist projection, never the raw private conflict
  object, and denial occurs before capture, file, URL, network, native-share,
  or analytics work. Any valid-looking public ID resolves to the same neutral
  unavailable state as malformed, unknown, expired, revoked, or deleted input.
- Type: Product / Architecture / Privacy / Growth / Legal / Launch
- Alternatives: infer shareability from admitted conflict content, reuse the
  final domain as authority, expose a client-generated opaque ID, sanitize only
  analytics, show a record-looking fallback for valid IDs, or rely on a generic
  confirmation after the share sheet opens.
- Criteria: independently reviewable authorities, exact allowlist, unknown-key
  rejection, zero private/raw fields, zero pre-admission side effects, no token
  existence oracle, and explicit confirmation of the exact future image/text/
  link/destination before native export.
- Evidence:
  `docs/hugeToDo/CORE-07-SHARE-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md`,
  `scripts/core07/share-admission-source-contract.test.mjs`, focused mobile
  tests, the machine launch contract, and Phase 3/7/8/9 packet bindings.
- Risk: this refusal boundary does not supply positive publication or legal
  authority. A successor needs an immutable issuer and token lifecycle,
  exact-source `REV-02` through `REV-06` professional decisions, `REV-07`
  detached signoffs, final policies/domain, content rights, hosted privacy/
  security/deletion/abuse proof, physical-iPhone and signed-archive evidence,
  and Apple review.
- Status: Accepted for the zero-admission source architecture; CORE-07 remains
  `in_progress` and launch-blocked.
- Owner: Product, clinical, chemistry, regulatory, privacy/security,
  IP/content-rights, growth, and release owners.
- Review date: Before any conflict-card capture, public token issuance, native
  share-sheet invocation, public record implication, or App Store candidate.

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

- Decision: When app lock is enabled, the app tree does not mount until its encrypted preference resolves; an unreadable preference fails closed as enabled and locked. A malformed or unsupported app-lock preference does not auto-prompt, rewrite to disabled, or strand the user behind a retry-only gate: the lock explains the exact setting-level recovery, and only an explicit successful device authentication removes that one malformed preference before app content can mount. Key-access or authentication failures remain non-destructive and do not offer this reset. The app-wide unlock must finish before the separate photo-timeline prompt can start. Progress tab, capture, review, and single-photo detail all use one provider-owned timeline unlock inside their Pro gates; navigation reuses that unlock only while the app remains active, and every non-active AppState transition clears it. The generic no-score explainer remains outside the second lock.
- Alternatives: keep a tab-local gallery gate, authenticate independently on every nested screen, put the timeline gate outside entitlement checks, treat unreadable lock preference as disabled, or rely only on the app-wide overlay.
- Criteria: direct-link privacy, no pre-lock content mount/flash, prompt ordering, usable in-session navigation, background relock, free-user paywall ordering, and deterministic browser/native verification.
- Evidence: `PhotoTimelineLockGate.tsx`, `AppLockProvider.tsx`, app-lock and Progress route contracts, plus 360 x 640 and 390 x 844 direct-route/session evidence in `test-results/human-e2e/2026-07-10/progress-direct-route-lock-current/`. A real malformed web preference stays unchanged behind the lock and then recovers through the named authenticated reset in `test-results/human-e2e/2026-07-10/private-envelope-corruption-current/`.
- Risk: Expo web proves routing, mounting, geometry, and state transitions but not native biometric security. Physical-iPhone LocalAuthentication ordering, background transitions, cancellation, and VoiceOver focus restoration remain release QA.
- Status: Accepted.

### 2026-07-10 - Treat Progress Read Failure As Blocked, Never Empty

- Decision: After entitlement and any configured biometric gates pass, the Progress tab, capture, review, and single-photo detail must still complete one successful encrypted photo-metadata query before route content or photo mutations mount. Pending reads show a neutral privacy state. Failed reads show one shared, non-destructive recovery surface with a real query retry; direct routes also expose `Back to Progress`. Empty-timeline and missing-photo UI are valid only after a successful read proves those states.
- Alternatives: let each route interpret `undefined` as empty, catch storage failure in the store and return `[]`, show route-specific errors while still mounting content, or permit capture/save against cached defaults.
- Criteria: preserve ciphertext, avoid false deletion/loss signals, prevent stale/default overwrites, keep camera/review/detail content private, make transient SecureStore/Keychain/Keystore failure recoverable, and keep route behavior consistent.
- Evidence: `PhotoStorageGate.tsx`, `usePhotos.ts`, photo store and route contracts, plus persistent and one-shot supported-phone evidence in `test-results/human-e2e/2026-07-10/progress-storage-recovery-current/`.
- Risk: Expo web proves query state, content gating, retry, layout, and network absence but cannot inject real native Keychain faults. Physical-iPhone staging builds must prove ciphertext remains byte-identical and retry succeeds after key access returns.
- Status: Accepted.

### 2026-07-13 - Fail Closed On Service-Only Account Erasure

- Decision: Account deletion must call one service-role-only transactional RPC for service-owned commerce, legacy-held OBF contribution, and RevenueCat rows and accept only an exact, zero-residue result. Click tokens are globally unique and order attribution tokens become null when their owner click is deleted. Any legacy-held OBF contribution payload requires a live Auth owner, is deleted by the RPC, and cascades on direct Auth deletion after migration removes legacy null-owner rows; the launch architecture has no writer or external-publication path for that table. Account-only subscription events are deleted; shared events remove the deleting Auth user from all seven scalar/alias/transfer fields while preserving another live Auth owner and non-identity audit fields. Legacy payload identity keys are removed at migration time, and no deterministic post-erasure user hash is retained as a provider audit row.
- Alternatives: ignore individual PostgREST errors, blank every shared row, retain account-only event handles after nulling owner columns, trust provider click tokens without a live owner lookup, or keep a bare SHA-256 account-deletion marker.
- Criteria: fail-closed deletion, cross-account preservation, no orphan attribution, no recomputable post-erasure correlator, database-RPC idempotent retry, explicit database postconditions, and executable local/live contracts.
- Evidence: migrations `20260713000046_account_service_row_scrub.sql` and `20260713000047_account_obf_contribution_erasure.sql`; account scrub, provider-deletion, and order-attribution tests; static data-rights/policy gates; and the production-shaped SQL rehearsal for A-only, repeated-A, shared A/B, unchanged B-only, canonical owner writes, legacy recovery, OBF orphan purge, idempotent scrub, and direct Auth cascade. The real migrations and RPC pass fresh disposable PostgreSQL 15 and 17 execution. The bounded synchronous helper accepts only an exact attested RevenueCat `200`; the durable executor subsequently introduced by migrations `0048`-`0052` treats exact `200`, `202`, or `404` deletion outcomes as nonterminal, requires claim-distinct full-family absence after publication drain/settling, persists PostHog async status plus two absence observations, and reports Apple `revoked` only after exact subject-bound exchange and revoke-`200` proof. The final local harness also covers fourteen-wide maximum-family reconciliation in 60 seconds at the enforced ten-second request maximum, write-ahead interrupted-probe reset, whole-body fetch timeout, the installed Supabase/PostgREST RPC envelope, maximum provider backoff, credential-bound database-global 225/25 domain budgets, and exact-claim capacity deferral without spending an attempt on PostgreSQL 15 and 17. A complete Supabase reset plus hosted provider and concurrency evidence are still absent.
- Risk: this transaction alone covers only rows visible inside the scrub. Migrations `0048`-`0052` subsequently add the bounded deletion barrier, durable provider-step state, PostHog polling, account-owned rate-limit cleanup, guarded service writers, late RevenueCat webhook tombstones, durable mobile status/manual-notice recovery, and an exact-session publication lease with drain/settling proof. The database source does not prove that every real Edge/mobile RevenueCat path complies or prevent old/tampered clients from bypassing the updated binary. The 64-alias ceiling is an application fail-closed bound, not a RevenueCat-published maximum. An approved provider block, enforceable mandatory-version gate, or continuing re-deletion control, written alias/recreation confirmation or reviewed manual procedure, cross-owner community-handle cleanup, bounded unfinished-operation/key-rotation procedures, any applicable Apple server-to-server `consent-revoked` path, and live provider/device/professional proof remain launch gates.
- Status: Accepted for the bounded scrub invariant; overall DB-10 remains in progress.

### 2026-07-13 - Bind Mobile Deletion Recovery To One Verified Owner And Keep Live Publication Proof Open

- Decision: A mobile deletion request captures one Supabase session, verifies the captured bearer against Auth, derives a domain-separated SHA-256 owner binding, and persists two independent 256-bit capabilities plus that binding before sending `begin` with only the captured bearer. A v2 record can be retried or authorize private cleanup only for that exact owner. Every authenticated `preflight=clear|active` carries the Auth-derived subject in the same bounded response, avoiding a second-lookup proof-loss race; the client rejects a mutable cached-session subject mismatch and uses the response subject for local/vendor publication or owner-conditional cleanup. Cleanup authority is derived from one canonical validation of the private-cleanup, owner, retained-owner, and ownerless-quarantine tuple. Before a foreign session is removed, the current pseudonymous owner proof is copied to a durable retained-owner marker: signed-out cold restore preserves it, only exact-owner reauthentication reopens it, and a different login performs the normal pre-publication wipe. Ownerless data receives a durable no-adoption quarantine before forced sign-out, so every later login must wipe before claiming it. A separate auth-derived-cleanup marker is committed before session removal and cleared only after session storage, queries, notifications, analytics, image memory, and vendor identities are reset; cold restore retries it before reading or publishing Auth. Matching-owner cleanup removes ownership proofs only after every sensitive cleanup stage succeeds. Transient/unclassified owner-storage or Auth proof failures hold the pre-Auth gate and retain retry authority; only an exact verified foreign subject, authoritative missing session, or lane-specific Auth rejection consumes it. Ownerless nonterminal v1 records are support-only. Cross-device `preflight` remains required before session publication. The 2026-07-14 source candidate additionally routes authenticated Supabase requests through one exact-session remote-admission gate, binds controlled refresh to the retained opaque refresh token, closes Supabase and RevenueCat publication synchronously, and drains admitted child work before account replacement or deletion handoff.
- Alternatives: reuse ownerless tokens, let the Supabase singleton choose the bearer after persistence, erase all local data whenever any account has an active barrier, trust a candidate session's mutable user object without server verification, or describe one preflight as race-free admission.
- Criteria: no A-to-B deletion dispatch, no token overwrite, no immediate or deferred foreign-account erasure, no temporary Auth outage consuming retry authority, crash-retry authority, exact-owner cleanup, bounded response handling, synchronous closure, child-request settlement, and honest separation between source proof and live provider proof.
- Evidence: owner-bound client-state, intake, recovery, cleanup-order, and root-gate tests; cross-account interruption tests before persistence, during Apple lookup, and before dispatch; the central remote-admission and RevenueCat publication-controller suites; durable deletion 215/215; the focused mobile server contract 2/2; PostgreSQL 15/17 rehearsals; the two-reset 52-migration local gate; and static release/security contracts.
- Risk: the exact source candidate covers process death, configure-in-flight, lost release, caller detachment, quarantine, and child-request settlement, but hosted multi-device/Cron/Vault/provider behavior is unproven. Old/tampered clients still require an approved provider block, enforceable mandatory-version/zero-installed-cohort proof, or continuing re-deletion control. Live Supabase/RevenueCat, provider interruption/recreation, physical-iPhone, professional, privacy/legal, and App Review evidence remains external.
- Status: Accepted for the source publication invariant; end-to-end DB-10 remains in progress and is not described as race-free.

### 2026-07-14 - Separate Store And App-Grant Entitlement Authorities

- Decision: Keep `entitlements` exclusively as the RevenueCat projection and `reverse_trial_grants` as the independent local no-card grant. Return both through one no-argument `auth.uid()` RPC. Preserve exact webhook ordering; classify old rows without trusted provider order as fail-closed `legacy_unknown` until a bounded authenticated server fetch supplies RevenueCat v1 `request_date` as a snapshot watermark.
- Alternatives: continue last-writer-wins in one row, add source to the existing primary key, fabricate a migration cursor, or let clients submit a user ID/snapshot.
- Criteria: a local grant cannot overwrite/revoke a purchase, provider events cannot erase local grant history, no caller-selected owner, deterministic delayed-event handling, data minimization, deletion/export continuity, and forward-only rollout.
- Evidence: migration `20260714000053_entitlement_authority_lanes.sql`, authenticated `subscription-reconciliation`, PostgreSQL 15/17 rehearsal, Edge/parser contracts, and `docs/hugeToDo/PAY-06-ENTITLEMENT-AUTHORITY-LANES-2026-07-14.md`.
- Risk: old binaries that read `entitlements` directly cannot see the app lane after relaunch. Database rollout requires the updated reader or a mandatory-version/zero-installed-cohort proof. Hosted RevenueCat, sandbox/TestFlight, device, privacy/legal, and App Review evidence remain open.
- Status: Accepted for the source invariant; production rollout remains gated.

### 2026-07-14 - Journal Native Store Transactions Before Re-Admission

- Decision: Before a native purchase or restore can outlive its initiating call, persist an
  owner-aware, device-global transaction journal. Promote confirmation atomically; if
  durable persistence, ownership, or provider confirmation is ambiguous, keep Store
  admission closed, show recovery, and require reconciliation/restore before another
  purchase. Device time alone cannot clear the journal.
- Alternatives: track the transaction only in component state, clear ambiguity on relaunch,
  allow repeat purchase after a timeout, or infer owner from the next signed-in session.
- Criteria: no duplicate-charge encouragement, process-death recovery, account isolation,
  monotonic evidence, truthful UI, and deterministic support recovery.
- Evidence: `storeTransactionNotice.ts`, `StoreTransactionNoticeHost.tsx`, owner-aware
  purchase/restore entry points, and the focused transaction/publication tests.
- Risk: source tests do not prove StoreKit/App Store sandbox delivery, interrupted native
  callbacks, reinstall behavior, or physical-iPhone UX. Those remain release gates.
- Status: Accepted for source behavior; live StoreKit proof remains gated.

### 2026-07-06 - Keep Expo/Supabase/RevenueCat

- Decision: Continue current stack unless beta/device/compliance evidence says otherwise.
- Alternatives: native apps, Flutter, Firebase, custom backend.
- Criteria: speed, current repo fit, camera/IAP support, TypeScript reuse, RLS.
- Evidence: current implementation and docs already use Expo, Supabase, RevenueCat.
- Risk: native camera/OCR and widgets require custom build QA.
- Status: Accepted.

### 2026-07-17 - Separate Catalog Source Approval, Row Review, And Promotion

- Decision: An approved offline source transform is not a reviewed catalog
  row. Production ingestion uses a sealed, hash-bound staging lifecycle;
  explicit per-record dispositions and exact-key conflict review; one
  transactionally locked insert-only promotion; immutable batch-to-record
  lineage; and non-destructive batch withdrawal. Shared runtime roles may
  stage and verify bounded evidence but cannot approve, promote, roll back, or
  directly write the global catalog. CAT-08 deliberately gives identity-bound
  operators recommendation authority only; approval, promotion, rollback, and
  CAT-03 activation remain migration-owner-only.
- Type: Architecture / Privacy / Legal / Launch
- Alternatives: direct service-role upserts, automatic fuzzy merges,
  source-approval-as-row-approval, hard-delete rollback, or source-wide
  withdrawal for every bad batch.
- Criteria: fixture exclusion, exact provenance for every production row,
  least privilege, retry-safe idempotency, collision safety, preservation of
  shelf/correction references, and fail-closed serving.
- Evidence: migration `20260717000057_catalog_import_lifecycle.sql`, its pgTAP
  contract, the Phase 4 promotion-envelope contract, and the CAT-02 runbook.
- Risk: the conservative path creates a human review queue and does not solve
  launch coverage. Real dual-signed source approvals, dedicated operators,
  genuine consented beta-corpus evidence with honest sampling limits, hosted concurrency/rollback drills, and
  professional review remain external gates.
- Status: Accepted for the source architecture; production rollout gated.

### 2026-07-17 - Require Signed Curation Before Catalog Serving

- Decision: promoted catalog rows remain non-servable until an immutable CAT-03
  release binds the predeclared target policy, minimized beta coverage corpus,
  untouched holdout results, exact CAT-01 source approvals, exact CAT-02 projection
  lineage and field-scope memberships, field provenance, complete reviewed
  dependencies, independent reviewer roles, and a full-record decision witnessed
  before holdout access. The released campaign must contain at least 2,000 reviewed/
  eligible records, satisfy every signed category floor, and include at least 100
  demand-prioritized eligible records. Product authorization is non-serving staging;
  one exact-set global campaign flip changes serving atomically, and an independent
  signed, point-in-time database readback is required for final clearance; any later
  retirement, successor, dependency withdrawal, or review expiry makes it historical
  until a new exact campaign/readback passes. Beta demand can prioritize
  independently sourced products but cannot create or modify a product fact. Mutable
  product flags and correction-count refreshes cannot grant serving authority.
  Exactly one contributing artifact must match the target CAT-02 lineage, and all
  barcode/category/regulatory memberships must bind its exact staged product row.
  CAT-03 v1 authorizes only the reviewed primary barcode; aliases stay unavailable
  until a versioned per-alias evidence contract exists. Four outcome reviewers sign
  before activation, their exact signature-set root is part of the activation
  authorization, and the independent operator signs only after every review and the
  planned activation time. Every client-readable product/dependency field and exact
  readable child-row set is sealed into the live roots. Drift fails closed, and the
  record-insert guard uses the release path's global-then-campaign lock order before
  rechecking state.
  Every mutation of sealed served state appends a permanent per-product event
  under that same global lock, including reviewed correction holds, production/
  legal source withdrawal, and promoted-batch retirement. Correction evidence
  uses only a bounded reporter-independent serving projection in that chain:
  hold and product IDs, state, bounded reason, server-opened time, and current
  mutation root. Correction/report identity, user identity, barcode, free text,
  arbitrary JSON, assignment/resolution content, and ambient timestamps are
  excluded. Whole-row snapshot and capture boundaries
  canonicalize `timestamptz` values under UTC.
  Outcome reviewers bind the current mutation root. Exact restoration, later closing the hold,
  reapproving the source, or restoring the batch cannot resurrect the old
  authorization; recovery requires a newly reviewed current-root record and
  successor campaign/readback.
  Market-specific sunscreen/OTC rows require dated classification, label/expiry
  evidence, and a qualified regulatory review. Service-role catalog access is
  RPC-only because that role bypasses RLS.
  Unreviewed `conflict_rules`, `sequencing_rules`, `creator_stacks`, and
  `creator_stack_items` have no API-role read policy or table privilege. They are
  not product dependencies: future publication requires a separate B-DERM-reviewed,
  evidence-bound authority, while production mobile bundles continue filtering out
  content without review metadata.
- Type: Architecture / Privacy / Legal / Launch
- Alternatives: treat CAT-02 promotion as approval, accept a self-attested beta
  dashboard packet, infer quality from mutable flags, use beta shelf labels as product
  truth, or withdraw by deleting referenced catalog rows.
- Criteria: exact lineage, least privilege, privacy minimization, externally witnessed
  prospective targets/decisions, confidence-bound holdout evaluation, complete
  dependency proof, role separation, exact-set atomic campaign release/retirement,
  signed database readback, and fail-closed serving across every lookup path.
- Evidence: `catalog-curation-contract.mjs`, the CAT-03 coverage-quality contract,
  migration `20260717000058_catalog_launch_curation.sql`, its adversarial pgTAP
  contract, and the Phase 4 curation release runbook.
- Risk: source controls cannot make a self-selected beta cohort representative of a
  market or replace consent, professional judgment, hosted database proof, legal
  clearance, Apple review, or real launch data.
- Status: Accepted for the source architecture; production activation gated.

### 2026-07-22 - Separate Operator Workflow From Catalog Publication Authority

- Decision: CAT-08 exposes six bounded RPCs and a separate internal-console
  source candidate, not a general database editor. Browser API roles cannot
  invoke the RPCs. Edge signature-verifies the exact nonanonymous `aal2`
  bearer and passes its signed Auth-session UUID plus an exact deployment tuple
  to six hardcoded functions in a non-Data-API gateway schema. A constrained,
  nonsuperuser, membership/ownership-free transaction-pooler login with full
  CA/hostname verification replaces service-role transport. The database
  derives the confirmed normalized email, actor, and verified TOTP factor from
  the live Auth session and requires an exact open runtime-control generation,
  immutable active grant/capability binding,
  ten-minute operator session, an all-action separately committed global
  admission budget, per-action class budgets, immediate server-derived grant
  revocation, and a common advisory/grant-lock ordering. Queue mutations use a five-minute lease,
  UUIDv4 idempotency receipt, advisory lock, and CAS version. Triage,
  disposition, repair attestation, and release are separate capabilities and
  people for a held product. Triage creates a reporter-independent product hold
  that survives report/consent/account erasure. No correction disposition can
  release it. A third person may attest only exact current CAT-01/CAT-02
  authority plus a signed staged CAT-03 successor over the active-hold mutation
  root. A fourth distinct person releases; release advances the root and never
  activates serving. CAT-03 owners must complete a fresh post-release record,
  campaign release/activation, and readback. Source/import review records are immutable recommendations and
  never inherit migration-owner promotion/release authority.
- Type: Architecture / Privacy / Security / Launch
- Alternatives: browser-visible/shared service-role console, direct table editor, caller-
  supplied reviewer aliases, long-lived browser sessions, last-write-wins queue
  handling, correction-row-coupled holds, or acceptance/rejection as automatic
  serving release.
- Criteria: least privilege, attributable named actors, rapid revocation,
  separation of duties, bounded concurrency, immutable minimized audit,
  reporter erasure without risk resurrection, and current exact publication
  authority before release.
- Risk: local source cannot prove the hosted pooler ACL/TLS, credential rotation,
  freeze/rollback operation, concurrent renewal/revocation behavior, rate-limit
  operations, or absence of inherited/public privilege drift.
  Production acceptance requires hosted proof that `catalog_operator_edge` has
  only gateway usage/execute, no role membership/ownership or
  table/sequence/Auth/control authority, and a verified-full transport.
- Evidence: migration `20260722000063_catalog_operator_authority.sql`, the
  CAT-08 pgTAP and source contracts, the bounded `catalog-operator` Edge
  surface, the separate `apps/catalog-operator-console/` source, and the Phase 4
  operator runbook.
- Risk: source tests do not prove hosted deployment, MFA/session revocation,
  two-session races, console isolation, staffing, retention/deletion operations,
  human-simulated E2E, professional review, App Review, or legal compliance.
- Status: Accepted for the source architecture; CAT-08 remains `in_progress`
  and production rollout is gated.

### 2026-07-06 - Deterministic Rules Over AI For Safety

- Decision: Conflict, pregnancy, routine sequencing, PAO, and safety guidance must be deterministic and reviewer-backed.
- Alternatives: GPT-generated guidance, cloud RAG only, broad AI advisor.
- Criteria: liability, explainability, repeatability, testability.
- Evidence: competitor AI claims are crowded; repo already gates rules with `reviewedBy`.
- Risk: slower content expansion.
- Status: Accepted.

### 2026-07-29 - Admit No Trend Result Until A Real Exact-Build Issuer Exists

- Decision: Keep `phase7Capabilities.trendEngine` and `phase7Flags.trend`
  literal `false` and remove every simulated-result path. A classifier, copy
  catalogue, default delta, environment/development/E2E setting, caller consent,
  positive metric, Monk tone, fixture, legacy row, final domain, or QA boolean
  is not a Trend engine or publication authority. Progress retains the private
  photo timeline and no-score explanation; direct Trend routes expose only
  truthful unavailable recovery. A positive Trend-consent grant refuses before
  mutation, processing, or analytics. Explicit withdrawal cleanup may erase
  legacy state but cannot activate the feature.
- Decision crosswalk: docs/12 `D-046` through `D-050` deliberately map to root
  `D-068` through `D-072`. This decision does not renumber them. It supersedes
  only the former root `D-069` implementation note that a conservative stub
  could render `consistent`; the governing on-device-only rule remains.
- Alternatives: keep a reassuring `consistent` default; expose consent before
  an engine exists; treat Apple Vision face/capture-quality output or vImage
  operations as a validated skin measurement; trust an environment flag;
  preserve the enabled fixture as a production path; or call a cloud/general
  multimodal service.
- Criteria: truthful feature/metadata claims, no fabricated health inference,
  no pre-authority sensitive processing or content analytics, installed-base
  privacy cleanup, a versioned positive successor, independently reviewable
  fairness and claim evidence, and exact archive/network/device proof.
- Evidence: the source boundary and current primary-source implications are
  recorded in
  [`PHOTO-05-TREND-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md`](./hugeToDo/PHOTO-05-TREND-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md).
  Apple Vision/vImage documentation establishes useful image-processing
  primitives, not a validated skincare engine. Current Apple review/privacy,
  FDA general-wellness, FTC health-claim/HBNR, Washington MHMDA, and California
  privacy sources support conservative review questions but do not decide
  compliance or approval.
- Risk: zero admission is not PHOTO-05 completion. `B-AI-ONDEVICE`,
  `B-AI-FAIRNESS`, and `B-AI-LEGAL` remain independent launch blockers, followed
  by PHOTO-06/07, exact professional review, human-simulated/native/archive/
  network/performance evidence, and Apple's actual review.
- Status: Accepted for the zero-admission source architecture; Trend remains
  `in_progress` and launch-blocked.

### 2026-07-29 - Admit No Commerce Until A Reviewed Rail And Publication Authority Exist

- Decision: COM-01A establishes **literal zero admission** for commerce. Current
  commerce authority, affiliate or retailer rail availability, publication
  authority, reviewed catalog and Stack availability, positive commerce-consent
  grant, provider/order polling, catalog or attribution reads, click/order
  recording, external purchase navigation, and commerce analytics are
  unconditionally `false` or inert. A flag, environment, development build,
  final domain, fixture, demo retailer, caller consent, opaque token, partner
  credential, existing row, or positive recommendation cannot admit them.
  Explicit refusal, withdrawal, cleanup, and deletion may remain so legacy state
  can be removed without creating a positive path. Any older positive commerce,
  Where-to-buy, replenishment, creator-Stack, or partner-polling text is a future
  requirement only.
- Alternatives: admit a demo/development catalog; let a final domain and
  credential activate a provider; collect consent before authority exists;
  preserve read-only retailer links; treat disclosure or an opaque token as a
  privacy safe harbor; use photo, Trend, profile, health, or recommendation
  output to choose or attribute a commercial item; or permit commission to
  affect ranking.
- Criteria: one immutable admission truth; no pre-authority commercial data
  flow or analytics; commission-independent ranking; retained withdrawal and
  deletion; exact, reviewable provider, recipient, catalog, Stack, disclosure,
  reconciliation, privacy-label, and ATT boundaries; and a positive successor
  that cannot be created by runtime configuration alone.
- Evidence: Apple's
  [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
  §5.1.2(vi) prohibit using data gathered from depth/facial-mapping tools,
  including Camera and Photo APIs, for marketing, advertising, or use-based
  data mining, including by third parties. Product selection, retailer choice,
  replenishment, attribution, or paid-link output derived from that data must
  therefore remain closed unless qualified counsel and Apple review the exact
  release; consent or an opaque token does not cure prohibited upstream use.
  Section 2.5.18 separately prohibits targeted or behavioral display
  advertising based on sensitive health/medical data. Apple's
  [App Privacy details](https://developer.apple.com/app-store/app-privacy-details/)
  and
  [User Privacy and Data Use](https://developer.apple.com/app-store/user-privacy-and-data-use/)
  require exact collection/purpose answers and an ATT determination for
  cross-company tracking or advertising measurement.
- Evidence: the
  [FTC Endorsement Guides Q&A](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking)
  requires clear and conspicuous material-connection disclosure close to the
  affiliate recommendation and explains that “affiliate link” or “buy now”
  alone may be inadequate. The FTC's
  [native-advertising guidance](https://www.ftc.gov/business-guidance/resources/native-advertising-guide-businesses)
  requires commercial content to be identifiable; independent-ranking and
  health/product claims still need truthful substantiation. The
  [FTC Health Breach Notification Rule guidance](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0)
  makes unauthorized disclosure a potential breach for covered health apps.
  Exact data flows and entity/applicability facts also require review under
  [Washington RCW 19.373](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373&full=true),
  [Nevada NRS 603A.400-.550](https://www.leg.state.nv.us/nrs/nrs-603a.html),
  and, when applicable,
  [California Civil Code § 1798.140](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.140.).
  Those statutes can reach inferred or derived health data, distinct sharing
  consent, sale authorization, product interactions, sensitive data, and
  commercial inferences.
- Risk: COM-01A is a source checkpoint only. Before any positive successor,
  COM-01 through COM-07 still require executed provider terms, reviewed rail and
  publication authority, reviewed catalog/Stacks, documented first- and
  third-party data flows and contracts, App Privacy/ATT decisions, adjacent
  disclosure and native-ad treatment, ranking isolation, claims/HBNR and
  Washington/Nevada/applicable-California review, live reconciliation,
  deletion/withdrawal proof, abuse/security controls, and exact archive,
  network, accessibility, performance, supported-iPhone, and App Review
  evidence.
- Status: Accepted for the literal-zero commerce source architecture; COM-01
  through COM-07 remain incomplete and launch-blocked.
- Owner: Product, commerce, catalog, privacy, legal, security, data-rights, and
  release owners share the downstream gates.
- Review date: Before any commerce consent grant, catalog/Stack fetch, affiliate
  or retailer link, provider poll, attribution write, external purchase
  navigation, commerce analytics, TestFlight claim, or App Store submission
  candidate.
- Assurance boundary: This decision does not guarantee App Store acceptance,
  legal compliance, safety, product-market fit, or revenue.

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
