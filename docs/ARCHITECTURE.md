# Architecture

## Selected Architecture

[Decision under uncertainty] Continue with the current Expo React Native monorepo, Supabase/Postgres backend, RevenueCat subscriptions, PostHog analytics, and Sentry crash reporting.

This decision is based on product fit and current repo momentum, not loyalty to a stack. Any future replacement must use the Master Plan Update Patch process.

## Alternatives Considered

| Architecture                       | Strengths                                                                                   | Weaknesses                                                           | Verdict     |
| ---------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------- |
| Expo RN + Supabase + RevenueCat    | Fast mobile shipping, existing repo fit, strong TypeScript reuse, good subscription tooling | Native camera/OCR/widgets require custom build QA                    | Keep        |
| Native Swift/Kotlin + Postgres API | Best native camera/device control                                                           | Too slow and costly for solo/small team                              | Avoid now   |
| Flutter + Supabase                 | Good cross-platform option                                                                  | Rewrite cost, smaller current repo fit                               | Backup only |
| Firebase + RN                      | Fast auth/storage                                                                           | Weak fit for relational catalog/rules graph, per-operation cost risk | Avoid       |
| Web/PWA first                      | Cheap iteration                                                                             | Poor native camera/IAP/App Store fit                                 | Avoid       |

## Decision Records

### A-001: Keep Mobile-First App

- Decision: mobile app remains primary surface.
- Criteria: camera, photo progress, reminders, subscriptions, store discovery.
- Risk: native QA burden.
- Status: active.

### A-002: Deterministic Safety Logic

- Decision: ingredient/routine/safety rules must be deterministic and reviewed.
- Criteria: liability, trust, explainability.
- Risk: slower rule expansion.
- Status: active.

### A-003: Local-First Sensitive Data

- Decision: shelf, completion, profile, cycle/ramp, and photos work locally; photos are device-only in the current build. Native content keys stay in SecureStore, encrypted reads never rotate missing/invalid keys or delete ciphertext, and failed-read snapshots block fallback overwrites. Private-KV envelope validation excludes only known Supabase auth-storage keys; malformed or unsupported app-owned envelopes block before app content mounts, remain byte-identical, count as orphaned ciphertext, and cannot be replaced after a concurrent snapshot change. Same-key mutations serialize, queued mutations remain inside account-boundary draining, and private read/write/removal APIs reject Supabase auth and content-key namespaces. Opt-in app lock fails closed while its encrypted preference is unreadable; a malformed preference can be removed only through an explicit device-authenticated reset that deletes that setting alone. One foreground-scoped photo-timeline unlock gates the Progress tab plus direct capture, review, and detail entries. After that unlock, every data-bearing Progress route must complete a successful encrypted metadata read before route content or photo mutations mount; read failure renders shared non-destructive recovery, never an empty or missing-photo fallback. Account changes unmount this data-bearing tree, verify a hashed local owner, persist a cleanup-required control across partial deletion, block/drain account-scoped private reads and mutations, clear query memory before and after registered cleanup, and fail closed before publishing the latest target session. Account export composes the owner-scoped server bundle with a sanitized snapshot of every registered local private-data record. One cancellable account-generation lease covers owner capture through temporary plaintext deletion; a real account boundary aborts the Edge request, blocks new exports, drains active export cleanup, and rejects stale writes or shares before the next session can publish.
- Criteria: privacy, trust, offline bathroom use.
- Risk: multi-device sync and key recovery are delayed; genuine OS key loss makes local-only ciphertext unrecoverable.
- Status: active.

### A-004: Feature Flags For Risky Surfaces

- Decision: cloud Ask, trend insights, commerce, community posting, widgets,
  Live Activities, and advanced recommendations remain fail-closed until ready,
  but each is required in the iOS launch binary and must pass its complete
  enabled-state gate before submission. A flag is an incident control, not a
  substitute for implementation.
- Criteria: app review, safety, privacy, trust.
- Risk: full-product ambition appears incomplete externally.
- Status: active.

### A-006: iOS-Only All-Features Release Contract

- Decision: the release platform is iOS and every feature ID 1-20 plus every
  Phase 7/8 surface in `docs/hugeToDo/launch-contract.json` is required.
  Android code may remain healthy, but Android credentials, builds, device or
  store evidence, payments, links, performance, beta, and release approval are
  not launch gates. Google OAuth remains required for Google Sign-In on iPhone.
- Criteria: founder directive, one auditable scope, no fake Android evidence,
  and no hidden/inert feature counted as complete.
- Risk: the larger launch surface expands native, backend, privacy, review,
  moderation, reliability, and operational dependencies.
- Status: active.

### A-007: Server-Attested Sign in with Apple Lifecycle

- Decision: Apple-backed Supabase sessions are usable only after one exact
  native authorization has passed state/nonce checks, its one-use code has
  been exchanged by the lifecycle server, and the resulting refresh token has
  been stored in an owner/subject/client-bound AES-GCM envelope. A scheduled
  worker validates the retained refresh token daily, signed Apple account
  events can terminate authorization, and the database/Storage/Edge access
  fence rejects stale or unvalidated Apple sessions. A terminal event can
  transiently exact-match one existing Apple Auth identity before lifecycle
  capture; if the identity itself is not present yet, first capture reconciles
  the audience-bound keyed event before code exchange and remains terminal.
- Criteria: one code consumer, replay resistance, exact-session authority,
  durable revocation/deletion, no plaintext provider token at rest, and
  bounded access when the worker or Apple is unavailable.
- Risk: existing Apple users require fresh capture at cutover; referenced
  subject/vault key versions cannot be retired until zero-row evidence exists.
  Each successful daily validation atomically advances the current subject
  digest and freshly seals the token under the current vault key; dormant,
  deferred, or failing rows do not advance from configuration alone. Unresolved
  terminal `unknown_subject` evidence also pins its subject-key version until
  capture reconciliation or reviewed disposition. Hosted
  Apple delivery, Cron/Vault, physical-iPhone, legal/privacy, and App Review
  evidence remain open.
- Status: locally verified source; production rollout gated.

### A-008: Reviewed, Transactional Catalog Promotion

- Decision: source approval and record approval are separate gates. Approved
  offline OBF/CosIng transforms enter sealed staging first; exact hashes,
  reviewer dispositions, dedupe conflicts, immutable lineage, and one atomic
  promotion are recorded before any projection row exists. Runtime API roles
  cannot approve, promote, roll back, or directly mutate the global catalog.
  Rollback withdraws only the affected batch and blocks its orphaned
  projection rows instead of deleting catalog identities referenced by a
  user's shelf, correction history, or lookup history.
- Criteria: fixture exclusion, complete production-row traceability,
  response-loss-safe idempotency, deterministic conflict handling,
  transaction isolation, and fail-closed source withdrawal.
- Risk: the deliberately conservative insert-only path sends cross-source or
  natural-key collisions to review rather than merging them automatically.
  CAT-08 operators now record immutable recommendations only;
  approval/promotion/rollback intentionally stay migration-owner-only. Real source approvals,
  hosted concurrency/rollback evidence, and the curated beta catalog remain
  launch gates.
- Status: implementation candidate; production rollout gated.

### A-009: Signed Launch Curation Is A Positive Serving Authority

- Decision: CAT-02 promotion creates traceable, non-servable source projections;
  it does not authorize launch use. CAT-03 uses a separately signed target policy,
  a privacy-minimized beta-shelf coverage corpus, an untouched holdout, exact
  CAT-01/CAT-02 lineage, signed four-scope membership proofs, per-field provenance,
  independent reviews, and a full-record decision witnessed before holdout access.
  One and only one contributing artifact may match the target policy's CAT-02
  lineage; barcode identity, category, and regulatory memberships must bind that
  primary artifact and its exact staged product record. CAT-03 v1 serves only the
  reviewed primary barcode. Alias serving requires a later versioned membership
  contract and migration.
  At least 2,000 reviewed/eligible records, all required-category floors, and at
  least 100 demand-prioritized eligible records are hard release gates. Per-product
  authorizations stage without serving; one exact-set territory campaign release
  atomically changes the current catalog. Final clearance requires an independently
  signed, point-in-time database readback of that release. A later retirement,
  successor, dependency withdrawal, or review expiry makes that receipt historical
  until a new exact campaign and readback pass. Every catalog read path must positively
  find the current global campaign and its campaign-scoped product authority.
  Mutable quality/review flags, a beta demand signal, or the absence of a correction
  can never grant eligibility. The RLS-bypassing service role receives no direct
  catalog-table lane and uses narrow guarded RPCs; authenticated direct reads are
  limited to explicitly granted safe relations with positive serving RLS.
  Legacy active-row policies do not publish unreviewed `conflict_rules`,
  `sequencing_rules`, `creator_stacks`, or `creator_stack_items` to any API role.
  Their production publication is a separate, evidence-bound B-DERM authority;
  the app's bundled copies remain filtered to reviewed content in production and
  are not part of a CAT-03 product root.
  Outcome reviewers sign a pre-activation body before the activation operator;
  their exact four-role signature-set root is then bound into the operator's
  authorization, whose timestamp must follow every review and the planned time.
  Live product and dependency roots cover every client-readable field and the
  exact sorted set of every readable child row, so a mutation, insertion, or
  deletion fails serving closed. Record insertion and campaign release take the
  same global-then-campaign transaction advisory locks before checking lifecycle
  state, preventing a record from entering a released campaign.
  Every mutation of sealed served state appends an immutable per-product event
  while holding the same global lock, including reviewed correction holds,
  production/legal source withdrawal, and promoted-batch retirement. Correction-
  hold evidence uses one bounded reporter-independent serving projection (hold/
  product ID, state, bounded reason, server-opened time, and current mutation
  root); correction/report identity, user identity, barcode, free text,
  arbitrary JSON, assignment/resolution content, and ambient timestamps never
  enter the permanent CAT-03 digest chain. Product/dependency
  snapshot functions and mutation capture fix `TimeZone` to UTC before whole-row
  JSON canonicalization.
  Outcome reviewers sign the current mutation root. Exact byte restoration, closing the
  hold, reapproving the source, or restoring the batch cannot resurrect that
  authorization; recovery requires a newly reviewed current-root record,
  successor campaign, atomic release, and current signed readback.
  Retirement, source withdrawal, projection drift, an active correction hold, an
  incomplete reviewed ingredient dependency, or a required sunscreen/US-OTC
  review gap closes serving without deleting user references.
- Criteria: no self-attested launch evidence, no beta-derived product facts,
  complete dependency proof, role separation, independently witnessed prospective
  commitments, replay-safe staging plus exact-set atomic campaign release, signed
  readback, privacy-safe aggregate evidence, and immediate fail-closed retirement.
- Risk: a self-selected beta corpus describes only the defined tester shelves and
  cannot substantiate population or market-representativeness claims. Real consented
  beta data, approved source artifacts, qualified catalog/regulatory reviewers,
  hosted concurrency/readback evidence, and counsel-approved market-specific policy
  remain launch gates.
- Status: source implementation candidate; production activation gated.

### A-010: Dedicated Operator Identity Cannot Become Catalog Authority

- Decision: CAT-08 uses a separate internal console and six bounded RPCs, never
  a generic table editor. Browser API roles cannot execute the RPCs directly.
  Edge signature-verifies the exact nonanonymous `aal2` bearer, then passes
  its signed Auth-session UUID and exact deployment tuple through six hardcoded
  functions in a non-Data-API gateway schema. A constrained, nonsuperuser,
  membership/ownership-free `LOGIN NOINHERIT NOBYPASSRLS` role connects through
  the transaction pooler with CA and hostname verification; service-role
  transport is absent. Postgres derives the confirmed normalized
  email, actor, and verified TOTP factor from the live Auth session. Every
  action also requires an active immutable grant/capability binding and a
  database-open runtime row matching environment, source revision, Edge
  deployment ID, and monotonic control generation, plus a ten-minute operator
  work session. A separately committed, grant-free admission preflight spends
  a per-actor global budget before every action; successful action transactions
  spend a bounded class budget. Session renewal and actions use one advisory-
  then-grant-lock order, immediate server-derived revocations, and a fresh
  post-lock wall clock. Queue mutations require a five-minute
  database-clock lease,
  UUIDv4 idempotency receipt, advisory lock, and compare-and-swap version.
  Triage, disposition, CAT-02/CAT-03 repair attestation, and release are
  capability-separated. Triage opens a reporter-independent product hold;
  accepting, rejecting, closing, withdrawing, or erasing the correction cannot
  release it. A third person may attest only exact current CAT-01/CAT-02
  authority plus a signed staged CAT-03 successor over the active-hold mutation
  root. A fourth distinct person releases; release advances the root and never
  activates serving. CAT-03 owners must complete a fresh post-release record,
  campaign release/activation, and readback. Source/import review actions are immutable
  recommendations only and never receive migration-owner CAT-02/CAT-03
  promotion/release authority.
- Criteria: no shared or caller-selected identity, no browser service secret,
  no raw API-role protected-table access, short immutable work sessions fenced
  on every request by revocable Auth/TOTP/grant authority, all-action admission
  and class rate budgets, linearizable renewal/revocation ordering, bounded
  cursor/lease/CAS behavior, immutable minimized audit, reporter erasure without
  risk resurrection, and per-product separation of duties.
- Risk: local migration, Edge, and console source cannot prove hosted Auth/MFA,
  revocation, concurrent sessions, deployment isolation, staffing, retention,
  credential rotation, verified pooler TLS, runtime freeze/rollback, incident
  response, human E2E, professional review, or Apple acceptance. Production
  acceptance requires independent hosted proof of the dedicated gateway role's
  exact ACL/membership/ownership state, full TLS verification, concurrency/rate
  behavior, and the frozen runtime/deployment receipt.
- Status: `in_progress` source candidate; CAT-07 and external acceptance gates
  remain open.

### A-011: Separate Local Completion Intent, Stable Product Identity, And Server Adherence

- Decision: Today and Shelf use strict encrypted v3 local records. A Today
  mutation persists its visible check-off and append-only replay event in one
  private-KV transform; the Shelf record retains its own owner-free FIFO and
  terminal operations. The offline coordinator drains Shelf before completion
  replay. Server product content is separable from the minimum stable
  owner/product identity required by a delayed completion. Delete therefore
  creates or advances a deletion-wins tombstone without erasing historical
  routine references. Missing identity is retryable. If the client has an
  unresolved terminal Shelf fact and no corrective Shelf work, it reversibly
  moves the exact completion dependency group through its routine-day marker
  to the outbox tail; it does not permanently reject the completion. An exact
  remote-terminal step instead creates a terminal receipt and terminally
  cascades its routine-day marker. The server admits owner-derived
  Shelf/completion RPCs, makes routine-day rows the only adherence input, and
  projects the timezone-bound two-total-missed-day algorithm. Private replay
  ledgers retain only a domain-separated request digest and bounded
  disposition, never the raw payload.
- Criteria: persistence-before-success, stable idempotency, no completion
  overtaking missing product identity, no permanent head-of-line deadlock,
  deletion-wins without resurrection, immutable historical evidence,
  server/client adherence parity, health/account fencing, purpose-limited
  export, and withdrawal/account erasure.
- Risk: no protocol replay horizon exists, so an arbitrary TTL could destroy
  the only delayed-device idempotency or tombstone fact. The minimized
  identities and receipts remain for the active account/health-purpose
  lifetime and are erased on health withdrawal or account deletion. Final
  retention/legal basis, the `request_sha256` access exclusion, hosted
  two-device convergence, native process-death behavior, archive privacy
  declarations, and App Review remain open.
- Status: `in_progress` source candidate through migrations `0068` and `0069`.

### A-005: One Fail-Closed Pregnancy-Safety Profile Contract

- Decision: the encrypted local skin profile is the V1 authority for pregnancy/breastfeeding status, and it can be read or changed only with a granted consent record whose version and SHA-256 text hash match the current health-data copy. Malformed or unreadable local profile/consent records are preserved and fail closed; they never trigger a server fallback. When no local profile exists, the newest server profile may supply non-safety axes/goals, but its pregnancy status is always treated as unknown because a local V1 edit may be newer. Shelf, Plan, scheduler, Today, recommendations, and conflict explanations consume the shared `ProfileBits` reader. Only a successfully read explicit local `none` clears caution; affirmative, prefer-not, unknown, missing, and unavailable states remain cautious without an inferred pregnancy claim. Exclusions are derived from the launch-gated docs/02 safety rules, not a parallel table: production accepts only rules carrying recorded review metadata, while development/staging can exercise starter rules for review. Eligible reviewed rules remove retinoids and hydroquinone and remove BHA unless every threshold-bearing active percentage is unambiguously tag-associated and confirmed low, before sequence, cadence, cycle, ramp, replacement recommendations, or Today. If the separate cadence review gate is closed, all treatment/exfoliant placement is withheld instead of becoming an unassigned daily step. Writes persist locally first, disable competing selection input while pending, and invalidate every dependent query.
- Criteria: no contradictory Plan/Today output, no fail-open default, no inferred health status, offline determinism, and one explainable exclusion path.
- Risk: V1 does not yet define a clinically reviewed status-refresh interval or transactional server mirror; multi-device status reconciliation remains deferred. No production release may mark the starter exclusion/cadence data reviewed without the detached Phase 3 signoff process.
- Status: active.

## System Architecture

```text
apps/mobile
  UI routes and feature modules
  local-first stores
  encrypted Shelf/completion v3 journals and FIFO outboxes
  Shelf-first offline replay with reversible completion-dependency deferral
  deterministic client mirrors
  central exact-session remote admission and controlled refresh
  composite Apple ID-token authentication plus lifecycle capture permit
  durable owner-aware store transaction journal

Supabase
  Auth
  Postgres
  RLS
  Edge Functions
  catalog/rules/routine data
  sealed catalog staging, reviews, revisions, promotion, and rollback evidence
  entitlements (RevenueCat projection)
  reverse_trial_grants (independent no-card grant)
  account publication leases and deletion barriers
  sealed Apple lifecycle, one-use capture, and signed-event state
  server-owned adherence projection and minimized Shelf/completion replay receipts

Apple
  native authorization -> identity token + one-use authorization code
  token/JWKS endpoints -> server verification, exchange, daily validation, revoke
  signed account events -> public-signature-verified Edge ingress

RevenueCat
  IAP purchases
  offerings
  ordered webhook -> Supabase entitlement projection
  authenticated reconciliation -> provider request_date watermark

External data
  Reviewed Open Beauty Facts offline artifacts (request-time API disabled)
  CosIng ingredient data

Observability
  PostHog events, consented/scrubbed
  Sentry crash reports, scrubbed
```

## Database Model

Core tables:

- `profiles`
- `skin_profiles`
- `consents`
- `user_products`
- `shelf_product_identities`
- `products`
- `ingredients`
- `product_ingredients`
- `conflict_rules`
- `routine_conflicts`
- `routines`
- `routine_steps`
- `routine_completions`
- `photos`
- `notification_preferences`
- `entitlements`
- `reverse_trial_grants`
- `subscription_events`
- `account_publication_leases`
- `catalog_reports`
- `catalog_import_batches`
- private catalog staging, review, revision, effect, and promotion ledgers
- `apple_auth_lifecycles`
- `apple_auth_capture_operations`
- `apple_auth_server_events`
- private `shelf_sync_operations`
- private `routine_completion_sync_operations`

## API Structure

Supabase Edge Functions:

- catalog lookup/search/report
- account deletion
- data export
- consent withdrawal
- RevenueCat webhook
- subscription grants
- subscription reconciliation
- Apple authorization capture / native credential invalidation
- signed Apple account-event ingress
- scheduled Apple refresh-token validation
- public waitlist/support/share routes

Owner-derived Postgres RPC boundaries:

- `sync_shelf_product`
- `record_routine_completion`
- `set_routine_adherence_timezone`
- `refresh_routine_adherence`
- `export_shelf_product_identities_for_subject`
- `export_shelf_sync_receipts_for_subject`
- `export_routine_completion_sync_receipts_for_subject`

Account deletion uses a service-role-only transactional RPC for database rows that
cannot be safely erased through caller RLS. Commerce click-token ownership is unique;
deleting a click nulls its order-attribution token. Any legacy-held OBF contribution
payload rows require a live Auth owner, are deleted inside the same scrub, and cascade on
direct Auth deletion; legacy null-owner payloads are purged by migration. The launch
architecture has no writer or external-publication path for that table. Account-only subscription events are
deleted, while shared events retain another live Auth owner and remove the deleting user
from every scalar, alias, and transfer field. The Edge caller accepts only an exact
zero-residue RPC attestation.

Migrations `20260713000048` through `20260713000052` add a bounded durable lifecycle
around that scrub: authenticated owner-derived `begin`, authenticated opaque
`preflight`, capability-only `status`, and worker-secret-only `work` lanes; sealed
operation, encrypted provider-step, receipt, recovery-audit, and RevenueCat-tombstone
state; per-account locks and barriers; account-owned rate-limit cleanup; guarded service
writers; reconciliation instead of blind provider redispatch; and at-most-once Auth hard
deletion after locked local re-attestation. Migration 0052 also session-binds intake and
preflight, seals short-lived publication capabilities, atomically drains them at deletion
intake, gates local erasure on exact authority end, and gates RevenueCat completion on a
five-minute settle plus two claim-distinct full-family absence rounds. RevenueCat calls
consume credential-bound database-global Customer Information/Project Configuration
budgets of 225/25 per fixed UTC minute, honor the maximum valid provider backoff, and
defer capacity without spending an attempt. Full-family customer reads are fourteen-wide,
capped to ten seconds each, and the subsequent aliases read keeps the maximum accepted
family within 60 seconds in the deterministic bound. Identity state is capped at
64 aliases as a local fail-closed/manual-review bound and protected by write-ahead probe
state so an interrupted scan resets absence evidence. The Cron worker is authoritative;
`EdgeRuntime.waitUntil` is only an intake accelerator.

Provider erasure remains fail-closed at its attestation boundary. RevenueCat REST API v2
treats exact `200`, `202`, or `404` deletion outcomes only as nonterminal dispatch
evidence and requires full read-only identity-family absence reconciliation before
completion; no bare `404` is terminal proof. Provider timeouts remain armed through the
bounded response-body read, and an ambiguous DELETE is never redispatched. Required-mode
PostHog deletion persists the
exact target set and provider status, then requires two interval-separated absence
observations. Apple is `revoked` only after subject-bound token exchange and Apple's
exact `200` no-body revoke response. Missing or failed automatic proof records a durable
manual-revocation outcome instead of withholding account deletion or claiming success.
The mobile client observes Apple's native revoke event, checks credential state before
restored-session publication and on foreground, and retains owner-bound recovery and
manual instructions until safe cleanup or explicit acknowledgement. A transferred Apple
credential now fails closed as `credential_transferred`; the product does not treat that
state as a valid credential or claim that transfer handling is complete.

Migration `0052` supplies the database publication fence. The 2026-07-15 source candidate
routes authenticated Supabase traffic through one exact-session remote-admission gate,
uses one controlled refresh path bound to the retained opaque refresh token, closes new
Supabase and RevenueCat publication synchronously, and drains already-admitted work before
account replacement or deletion publication. The deletion handoff, RevenueCat publication
controller, and central remote gate have focused process-death, configure-in-flight,
lost-release, caller-detachment, and child-request-settlement coverage. This is source
evidence, not proof of a race-free hosted lifecycle.

Migration `20260714000053_entitlement_authority_lanes.sql` separates commerce authority:
`entitlements` is the ordered RevenueCat
projection, while `reverse_trial_grants` is the independent app-issued no-card lane. An
owner-derived, no-argument `auth.uid()` projection RPC returns both without accepting a
caller-selected user ID. Authenticated reconciliation performs a bounded RevenueCat v1
read and accepts the provider's fresh snake-case `request_date` as the snapshot watermark;
it never fabricates provider order. The mobile store durably journals native transaction
admission before purchase or restore can be repeated, and keeps unresolved ownership or
confirmation state visible and fail-closed.

Migration `20260715000054_health_consent_withdrawal_lifecycle.sql` brings the current chain
to the prior fully verified 53-migration checkpoint. It adds a non-account-deleting health-consent lifecycle, processing-epoch
write barrier, service-only durable worker claims, relational/Storage absence attestation,
and cross-owner community-evidence detachment. The combined local checkpoint passed two
clean resets, 261 pgTAP assertions (46 schema + 215 health-consent lifecycle), database lint,
and an empty shadow diff; all 77 public tables had RLS enabled, with 54 classified as private
(40 directly queryable and 14 sealed from direct API-role access).
Phase 9 health-consent verification passed 104 Deno tests plus 7 evidence tests, and the
mobile workspace passed typecheck, lint, and 3,026 tests across 266 files. The
publication/entitlement lane rehearsals pass
on PostgreSQL 15 and 17. Hosted clean-reset, Cron/Vault/concurrency, live RevenueCat and App Store sandbox,
provider interruption and recreation, physical-iPhone, professional, privacy/security/
legal, and App Review evidence remain required. Old or tampered clients still require an
approved provider block, enforceable mandatory-version/zero-installed-cohort proof, or
continuing re-deletion control. The Sign in with Apple authorization-code capture and
state/nonce binding, encrypted versioned token vault, daily token validation, canonical
signed server-notification ingress, and authoritative session-access fence are implemented
in the subsequent source candidate, migration
`20260715000055_apple_auth_lifecycle.sql`, and the three Apple Edge Functions. The vault
and subject-HMAC keyrings retain at most three overlapping versions. Successful daily
validation atomically re-derives the current subject digest and freshly seals the token
under the current vault key; dormant or failing rows still need zero-old-key evidence,
user recapture/reauthorization, or lifecycle retirement before an old key can be removed.
Hosted cutover, live Apple event delivery, Cron/Vault continuity, stale-JWT denial, and
physical-iPhone proof remain open.
The post-0055 local gate passed two clean resets, exact 54-migration history, the full
structural pgTAP suite plus 114 Apple lifecycle assertions, schema lint, an empty shadow
diff, temporary type generation, 20 focused event/lifecycle Edge tests, and the 47-test
Apple auth work lane. These results do not replace hosted or device evidence.
Hosted non-destructive health-consent worker/Storage/backup and physical-iPhone proof,
approved final consent copy, the exact privacy report, policy/support URLs, and non-expiring
demo review access are also launch blockers.

Migrations `20260726000068_routine_adherence_authority.sql` and
`20260726000069_routine_completion_sync_bridge.sql` establish the current
CORE-05 source boundary. `0068` makes validated-IANA-timezone routine-day rows
the adherence input, projects one current/best/freeze result under the account/
health locks, keeps profile streak fields server-owned, and erases the derived
state at health withdrawal. `0069` separates active Shelf content from stable
identity/tombstone state, keeps routine-step ownership as a database invariant,
and seals direct product/routine/step/completion writes behind owner-derived,
active-health/account-fenced RPCs. Delete wins even when an upsert never
arrived; a delayed completion at or before the effective cutoff can reconcile,
while a later completion is terminal.

The `0069` private ledgers store operation/event identity, owner, a
domain-separated request digest, bounded result, and timestamps—not raw Shelf
or completion payloads. Direct access stays revoked. Three authenticated,
nonanonymous, `auth.uid()`-derived, health-lifecycle-fenced keyset export RPCs
expose only the subject identity/tombstone fields and receipt state/result/
timestamps. Server export
schema v4 performs two count/checksum/owner/column-guarded passes. It pins the
initial health-lifecycle epoch into every health-fenced caller read and
rechecks the final lifecycle; stable withdrawn/never-active state uses a valid
deny epoch and must return exact empty health sources, any nonactive residue
fails closed, and withdrawing or changed state aborts. Internal
`request_sha256` is excluded because it is a
guessable deleted-payload fingerprint, subject to counsel approval of that
rights decision. With no agreed replay horizon, identities/receipts persist
only for the active account and active health purpose and are erased on
withdrawal or account/Auth deletion. These source controls are not hosted,
native, legal, privacy-label, or App Review evidence.

Client APIs:

- feature modules call local stores first where privacy/offline matters
- Shelf replay drains before completion replay; an unresolved terminal Shelf
  fact may move only the exact pending same-routine/date completion group
  through its marker to the FIFO tail, preserving every original event for
  corrective replay
- authenticated Supabase requests use the central exact-session admission gate and its
  controlled refresh path; a closed gate cannot be bypassed by feature code
- entitlement readers call the owner-derived projection RPC and combine, rather than
  overwrite, the RevenueCat and no-card grant lanes
- native purchase and restore admission is serialized through the durable transaction
  journal; unresolved transactions block repeat purchase attempts

## Auth Model

- Anonymous-first onboarding.
- Apple/Google native ID tokens link to an active anonymous session with
  `linkIdentity`; email attaches with `updateUser` and completes with an
  `email_change` OTP. If a development project auto-confirms that same-user
  email update, the route completes immediately instead of asking for a code
  that was never sent.
- Native Apple authentication creates independent CSPRNG state and raw nonce
  values, sends the nonce digest to Apple, and requires the exact state echo.
  The raw nonce accompanies the ID token to Supabase while the authorization
  code is reserved for the lifecycle server. One composite permit prevents the
  resulting session from publishing until the server has verified the token,
  exchanged the code, and sealed the refresh token. Ambiguous exchange requires
  a new user-authorized code; it is never blindly retried.
- Verified terminal Apple events pass a raw subject only transiently to the
  service-only RPC. The value is not persisted. A pre-identity terminal event
  leaves audience-bound keyed evidence that first capture must reconcile under
  the owner lock before code dispatch; duplicate delivery is not required for
  closure.
- Provider and email account upgrades assert that the Supabase user ID remains
  unchanged and that the resulting identity is permanent.
- A linking conflict fails closed. The app never falls back to a normal sign-in
  while preserving anonymous-session data because that fallback can switch the
  user ID and trigger local-private-data cleanup.
- Normal Apple/Google/email sign-in remains available when there is no active
  anonymous session to preserve.
- Sign-out, a changed user ID, a cold-start owner mismatch, or an interrupted
  authorized cleanup cannot render account data until prior queries, registered
  local records, vendor identities, and in-flight private-record/photo writes
  are isolated and cleared. A signed-out restore with a valid retained-owner
  proof preserves the quarantined records without mounting them; exact-owner
  reauthentication consumes that proof, while any different login clears the
  records before publication. Explicit sign-out also removes persisted auth;
  account deletion delegates to this root boundary once. Rapid auth events
  serialize, a durable private-cleanup control forces retry after partial
  deletion, and a separate auth-derived-cleanup control survives a forced
  sign-out until query, notification, analytics, image-memory, and vendor resets
  all succeed. Session restore or cleanup failure remains behind a retry gate.
  Owner decisions validate the complete cleanup/owner/retained/quarantine proof
  tuple; a domain-separated owner hash is stored instead of the raw Supabase
  user ID.
- Supabase user ID becomes stable app user identity.
- RevenueCat `appUserID` bound to Supabase user ID.
- Owner-scoped RLS on user tables.
- Session candidates are server-verified before central remote admission. Controlled
  refresh atomically rotates the candidate lineage, and sign-out, owner change, deletion,
  invalid Apple credential state, or lease failure closes publication synchronously.
- Apple-backed access additionally requires the exact JWT session to remain in
  `auth.sessions` and an active lifecycle validated within 72 hours. Native
  invalidation and terminal signed Apple events retire the vault, increment the
  generation, delete sessions, and keep remote authority closed.

## Deployment Notes

Environments:

- local: placeholders allowed, no production claims
- staging: live Supabase/RevenueCat/Sentry/PostHog, test stores
- production: final brand, final policies, reviewed rules, release candidate evidence

Release validators and packet builders must read
`docs/hugeToDo/launch-contract.json`. Platform-specific evidence is required
only for a platform listed in that contract; every cross-platform service used
by the iOS app remains fully in scope.

The coherent Apple deployment, event registration, one-minute worker,
monitoring, key-rotation, deletion, and rollback procedure is
`docs/phase-9/apple-auth-lifecycle-operations-runbook.md`. Migration 0055 must
not be applied separately from compatible functions, mobile recovery, and an
existing-account recapture/mandatory-version plan.

## Open Technical Questions

- [Open Question] Final brand and package identifiers.
- [Open Question] First launch countries and privacy law scope.
- [Open Question] Exact catalog seed source and size.
- [Open Question] Which production iOS OCR module best satisfies the required
  accuracy, privacy, binary, and device-performance gates.
- [Open Question] Whether professional/B2B workflow needs separate tenant model.
- [Open Question] Which reviewed no-transfer or app/team-transfer migration
  policy applies to Apple `TRANSFERRED` accounts.
