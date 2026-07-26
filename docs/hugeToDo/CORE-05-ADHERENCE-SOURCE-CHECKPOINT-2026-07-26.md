# CORE-05 Today Adherence and Notification Source Checkpoint — 2026-07-26

## Status

`CORE-05` is `in_progress`. The current source candidate makes local Today
check-offs durable before success publication, gives Shelf changes and routine
completions owner-derived replay lanes, and makes the server the authority for
forgiving-streak projection. It also keeps every notification purpose off until
an explicit purpose-specific choice.

This checkpoint does not establish hosted deployment, two-device convergence,
native encrypted-storage durability, notification delivery, an
archive-identical App Privacy declaration, legal clearance, App Review
acceptance, product-market fit, or revenue.

`CORE-04` remains an upstream dependency. Its private-KV persistence controls
support this work, but physical-iPhone, archive-identical, process-death,
backup, account-lifecycle, and legal acceptance gates remain open.

### Supersession of the earlier local-v2 boundary

The first 2026-07-26 revision of this checkpoint described a completion schema
v2 containing `days` and `completedDays` and correctly demoted the older strict
server streak cache. That history is preserved as predecessor design evidence,
not current source truth. The current completion envelope is v3 and adds stable
remote identities, journal, outbox, terminal, and unsynced state. Migrations
`0068` and `0069` now supply the source-level server parity and replay bridge
that were open in the earlier revision. Hosted/native/two-device proof remains
open, so the predecessor's caution does not become production clearance.

## Current Authorities

| Concern | Current authority | What is not claimed |
| --- | --- | --- |
| Visible Today completion | Encrypted local completion envelope after the awaited private-KV transform | A tap or animation alone is not completion evidence |
| Shelf content and pending mirror work | Encrypted local Shelf v3 envelope until an exact server disposition is processed | The server is not a complete cross-device Shelf UI authority yet |
| Server product identity | `shelf_product_identities`, separate from mutable/deletable product content | A tombstone is not product content and is not anonymous |
| Server completion evidence | Immutable `routine_completions` admitted by `record_routine_completion` | A routine-day row is user attestation, not objective proof that skincare occurred |
| Current/best streak and absorbed dates | Migration `0068` server projection from routine-day completion rows | The historical client/server streak cache is not trusted without refresh |
| Notification preferences and attempt caps | Encrypted current-device records plus observed OS authorization | No remote notification preference/log authority, push delivery, or cross-device cap is claimed |

## Local V3 Completion And Shelf Records

The current completion record is strict schema v3. It contains the visible
day/step history and a bounded sync structure with stable routine IDs, stable
step IDs, an append-only operation journal, a FIFO outbox, governed terminal
receipts, and explicit unsynced recovery records. A Today mutation writes the
visible check-off and its replay operation in the same private-KV transform.
Today publishes cache state, haptic success, analytics, milestones, or review
moments only after that transform succeeds.

Legacy, v1, and v2 completion records do not invent server IDs, timestamps,
routine-day evidence, or replay work. A legacy raw-owner pending queue is
obsolete and is removed without reading its content under the exact current
health/account lease. A completion that could not construct a canonical
timezone-bound event remains visible in an explicit encrypted `unsynced` lane;
recovery promotes the original event only after a canonical current timezone
is available.

The current Shelf record is also strict schema v3. Its owner-free encrypted
envelope contains canonical products, a FIFO mirror outbox, complete terminal
operations with bounded server codes, and explicit incompatibility records.
New operation and product identities are lowercase UUID v4 values. Legacy/v2
upgrade does not fabricate a missing delete. Canonical v2 products may acquire
idempotent upserts only when the current health/account write boundary permits
the upgrade; incompatible legacy identifiers, names, brands, or barcodes remain
repair-required rather than being silently rewritten into server work.

These are source controls over the private-KV abstraction. Physical-iPhone
Keychain class, backup/restore, process death, storage pressure, write
ambiguity, relaunch, and account-switch behavior remain release evidence gates.

## Qualification And Adherence Semantics

AM and partial PM check-offs never create adherence. One local routine day is
inserted only when every step in the currently projected PM or recovery routine
is durably complete. It is inserted once and journaled immediately after the
final qualifying step with the same routine, local date, completion instant,
and timezone.

Migration
[`20260726000068_routine_adherence_authority.sql`](../../supabase/migrations/20260726000068_routine_adherence_authority.sql)
makes routine-level completion rows (`step_id is null`) the server adherence
input. It:

- validates an exact IANA timezone and derives the server reference day from
  that timezone;
- excludes future-tolerance rows from the projection;
- treats the not-yet-completed reference day as neutral;
- absorbs at most two total missed interior/trailing days in one run, including
  two separated one-day gaps;
- counts completed routine days, not absorbed dates, toward current and best;
- preserves the historical best while recomputing current state;
- materializes absorbed dates in one deterministic newest-to-oldest order;
- makes health-derived profile streak fields and freezes server-owned;
- makes completion rows immutable outside governed erasure; and
- clears the derived cache and freeze rows synchronously when health withdrawal
  begins.

The client additionally filters future dates before current/best calculations,
refreshes long-lived Today clocks at 17:00, midnight, foreground, and timezone
changes, and fails closed on unreadable completion state. Milestone copy
describes checked-off routines; it does not claim treatment efficacy or
physical performance.

Today, Streak, and Welcome Back do not convert unreadable or unsupported state
into an empty, zero, or lapsed result. Today renders a named retry surface and
disables check-offs while loading, unreadable, or mutating. A rejected or
unconfirmed private write publishes no route success haptic, cache state,
milestone, review prompt, or success navigation. The private-KV unit boundary
models commit ambiguity, but exact-current native rendered proof for
commit-then-reject and rollback-failure behavior remains open.

The timezone tolerance admits only the bounded original-event window; future
rows stay excluded from current, best, lapse, weekly, and heat-map calculations
through today. A future-only set cannot create a lapse or personal best.
Node/Vitest clock cases do not establish physical-device DST, live travel,
suspension, or manual clock-change behavior.

## Shelf-First Replay And Liveness

The offline coordinator drains the Shelf mirror FIFO before it dispatches any
completion. Both replay lanes derive the owner from the exact current Auth,
account-generation, and health-processing lease. Network, authorization,
thrown-RPC, and malformed-response ambiguity retains the head. Only an exact
four-field `accepted` or `idempotent` response acknowledges an operation.

Migration
[`20260726000069_routine_completion_sync_bridge.sql`](../../supabase/migrations/20260726000069_routine_completion_sync_bridge.sql)
adds the two authenticated scalar-parameter RPCs:

- `sync_shelf_product` for bounded Shelf upsert/delete replay; and
- `record_routine_completion` for canonical step or PM routine-day evidence.

The RPCs hold the account-deletion advisory lock, require the current health
session and active health processing, enforce account access, validate
lowercase UUID v4 identities and canonical timestamps before casts, derive the
owner only from `auth.uid()`, and return versioned bounded dispositions. Direct
API-role mutation of products, stable identities, routines, steps, and
completions is revoked.

A completion whose product identity is not present receives the retryable
`COMPLETION_PRODUCT_RETRY_LATER` result. The client normally leaves that FIFO
head in place. If the encrypted Shelf record proves both an unresolved terminal
Shelf operation for that exact product and no pending corrective Shelf
operation, the client atomically moves the exact completion step and the
remaining same-routine/date pending group through its routine-day marker to the
durable outbox tail. This is reversible tail deferral, not a permanent
dependency rejection or quarantine: all original event IDs and journal
evidence remain replayable after a corrected Shelf upsert or delete. A bounded
per-flush replay budget prevents a defer loop while unrelated work drains.

An exact remote-terminal completion is different. The original operation moves
to the local terminal receipt lane. Any later routine-day marker for the same
routine/date is removed from pending replay and gets a local
`COMPLETION_DEPENDENCY_TERMINAL` receipt listing the terminal step event IDs.
This marker cascade applies whether the terminal step was the final scheduled
step or became terminal before the marker was appended. The app never sends a
routine-day claim that depends on a terminal step.

## Stable Product Identity And Deletion-Wins

`shelf_product_identities` stores only product ID, owner ID, creation time, and
optional effective/received deletion times. It stores no product name, brand,
barcode, catalog source, PAO, or expiry content. Active product content remains
in `user_products`; routine steps reference the stable identity so deleting
content cannot erase already-recorded routine evidence.

Delete is authoritative even if a prior upsert never reached the server or was
terminal. A same-owner delete of a missing identity creates the minimal
tombstone and is idempotent. A later upsert cannot resurrect it. A queued
completion at or before the effective deletion cutoff can still reconcile;
one after the cutoff is durably terminal. Cross-owner UUID reuse or a race is a
bounded ownership conflict, never a payload acceptance.

The delete cutoff is the later of the queued delete instant and any already
stored completion for the product. This protects accepted historical evidence
without turning the tombstone into indefinite product content. The identity
and receipt lifetime is still governed as health-purpose retention below.

## Minimized Replay Receipts And Data Access

The private `shelf_sync_operations` and
`routine_completion_sync_operations` ledgers retain only owner, operation/event
identity, a domain-separated SHA-256 request fingerprint, bounded state/result,
and receipt timestamps. They never retain the raw Shelf payload or completion
body and remain sealed from direct API roles.

The server account export is schema v4 and adds three narrow,
authenticated-nonanonymous, `auth.uid()`-derived, account-open,
health-lifecycle-fenced keyset RPC sources:

- `shelf_product_identities`: `id`, `user_id`, `created_at`,
  `deleted_effective_at`, and `deleted_received_at`;
- `shelf_sync_receipts`: `operation_id`, `user_id`, `state`, `result_code`,
  `created_at`, and `finalized_at`; and
- `routine_completion_sync_receipts`: `event_id`, `user_id`, `state`,
  `result_code`, `created_at`, and `finalized_at`.

The Edge exporter derives the export read epoch from the initially captured
health lifecycle and pins that epoch into the dedicated caller client's header
for every health-fenced table and RPC read. It then performs two complete
ordered passes for each source and fails closed on owner mismatch,
unexpected/missing columns, count changes, duplicate/non-monotonic cursors, row
limits, checksum instability, or a changed final lifecycle. A stable withdrawn
or never-active lifecycle uses a syntactically valid deny-by-policy epoch and
must produce exact empty health sources; any synthetic nonactive residue is an
error rather than a silent omission. Withdrawing or changing lifecycle state
aborts the export.
Direct table grants remain revoked.

`request_sha256` is excluded from the subject-facing receipt. It is an internal
replay-integrity fingerprint that can be tested against guessed deleted
payloads and is unnecessary to understand the disposition. That exclusion is
an engineering/security decision pending counsel approval; it is not a claim
that a digest is anonymous or categorically outside an access right.

The current-device export separately exposes the local completion and Shelf
v3 state in purpose-limited `completion_and_sync_state` and
`shelf_and_sync_state` sections, including pending and terminal records, while
the existing redaction boundary removes local paths, credentials, encryption
keys, and protected security capabilities.

No safe protocol replay horizon exists yet: a suspended device can retain an
old outbox without an agreed expiry/terminal response. Consequently, stable
identity tombstones and minimized replay receipts are retained only for the
lifetime of the active account and active health-data purpose. Health-consent
withdrawal and account/Auth deletion erase them. Adding an arbitrary TTL now
could destroy the only idempotency or deletion-wins fact required by a delayed
device. Any future finite TTL requires a versioned client/server replay
horizon, an explicit expired terminal disposition, migration behavior, backup
treatment, policy updates, and privacy/legal approval.

This retention choice is narrower than retaining raw payloads but is not legal
clearance. Final notices, App Privacy answers, access/portability treatment,
backup treatment, and the legal basis and duration still require named review.

The installed mobile health copy remains `draft-v1` / `draft_blocked`.
Production correctly refuses new grants for that tuple; server health-epoch and
RPC admission require the current approved version/hash. The draft must not be
promoted unless the retained review evidence explicitly covers off-device
Supabase processing of Shelf products, routine completion/adherence history,
stable product tombstone identities, minimized idempotency receipts, every
processor/recipient role, active-consent/account-lifetime retention, export,
and withdrawal/account-deletion erasure. Review of older generic
profile/routine wording does not cover these additions.

Migration `0070` only aligns the changed Ask grant text from one
`draft_blocked` tuple to another. The exact successor remains current but
unreleased, and the prior draft remains immutable noncurrent history.
`public.health_consent_copy_staging_events` is sealed, immutable
migration/operator metadata for that draft-to-draft transition; it contains no
user/account identifier or health payload. It is neither legal/privacy review
nor release approval and is not a data-subject export source.

## Notification Boundary

Every notification purpose defaults off. The onboarding soft ask states the
proposed 7:30 AM and 9:30 PM times before requesting OS authorization and
enables only those two routine-reminder purposes after a deliverable OS result.
Settings render stored choices effectively off when current authorization is
unavailable or denied and refresh that observation on foreground.

Not-determined, denied, authorized, provisional, and ephemeral authorization
states remain distinct, including whether another OS request is possible.
Authorization reads reconcile the native schedule: revocation cancels it and a
later explicit grant rebuilds only purposes whose stored choices remain
enabled. Routine, trial, and event-triggered scheduling serialize through the
current consent/health admission boundary.

Routine quiet hours shift scheduled routine and weekly-photo reminders and skip
immediate event-triggered suggestions; they do not claim to move App Store
billing reminders. Event-triggered scheduling reserves a rolling seven-day
device slot before native scheduling so a failed native call cannot evade the
three-behavioural/one-promotional attempt cap. Reminder times, purpose toggles,
timezone, quiet hours, scheduled inventory, and reservation ledgers remain
device-local. The current mobile source does not read or write
`notification_preferences` or `notification_log` and emits no notification
decision analytics, including no `notification_prompt_shown`,
`notification_prompt_granted`, or `notification_prompt_denied` events.

## Verification Boundary

The mandatory structural contract is
[`scripts/core05/adherence-source-contract.test.mjs`](../../scripts/core05/adherence-source-contract.test.mjs).
It is wired into Phase 3 and launch verification. Focused mobile tests and the
`0068`/`0069` database/upgrade contracts exercise the executable behavior.
Passing those checks proves only the tested source and local database.

The mandatory contract separately binds:

1. strict completion schema v3 and non-inventing historical reads;
2. complete projected PM/recovery qualification;
3. persistence-before-success and unreadable-state fail closure;
4. bounded replay dispositions and the durable Shelf dependency barrier;
5. future-row exclusion and live routine-boundary clocks;
6. fail-closed streak and Welcome Back routes;
7. neutral, check-off-only milestone claims;
8. exact-time, authorization-aware, local-only notification behavior;
9. server-owned adherence plus atomic Shelf/completion replay through head
   migration `0069`;
10. the hashed client/SQL parity corpus; and
11. cleanup/export registration and blocking verification wiring.

The retained 2026-07-26 Expo-web notification observation at
`test-results/human-e2e/2026-07-26/core05-notification-local-contract/` verifies
the exact proposed times, `Not now`, effective-off browser state, quiet-hours
scope, and the fix for a web-only native Settings handoff crash. Its screenshots
are 1279 x 720 rasters and are not retained CSS-viewport proof. It does not
exercise the new server replay/export bridge, native notification APIs,
two-device behavior, or physical-iPhone storage.

Three current-source human-simulated packets now retain the full local
onboarding-to-Today path at supported phone geometries:

- `test-results/human-e2e/2026-07-26/core05-onboarding-375x667/`;
- `test-results/human-e2e/2026-07-26/core05-onboarding-390x844/`; and
- `test-results/human-e2e/2026-07-26/core05-onboarding-430x932/`.

Each headless-Chrome Expo-web run used the deterministic anonymous-owner local
fixture, completed age and health-consent gates, selected goals, answered the
quiz, added Retinol 0.3% serum, Glycolic 7% toner, and Mineral SPF 50, and
continued only after the reveal and plan showed exactly one of a reviewed
insight or the truthful `Pair review in progress` state. All three runs observed
the latter; the harness does not treat an unreviewed interaction as an insight.
The route then reached the generated plan, used `Start today`, and moved both
the forced AM SPF and PM glycolic routines from 0 of 1 to 1 of 1. A subsequent
under-threshold age re-verification immediately closed the protected app tree;
direct Today navigation and a reload remained at the age gate.

The 375 x 667 first pass found a real fixed-footer overlap on the onboarding
Shelf intake. After a product was added, a remove control could remain behind
the footer. The bounded fix performs a post-add, non-animated
`scrollToEnd`; the targeted onboarding route regression passed 20 of 20,
mobile typecheck passed, and the rerun's second- and third-product snapshots
each report `issueCount: 0`. The retained report is
`test-results/human-e2e/2026-07-26/core05-bugs/E2E-BUG-onboarding-shelf-footer-overlap.md`.
The 390 x 844 and 430 x 932 full reruns also passed with zero visible-control
issues. The harness follows the responsive product UI instead of assuming one
layout: smaller phone widths use the compact category sheet, while 430 x 932
uses the direct inline category buttons.

These are local deterministic-fixture Expo-web observations. They do not
execute native encrypted storage, hosted Supabase RPC/RLS/export behavior, a
real account, two devices, native notification APIs, or an archive-identical
iOS build. They therefore advance only the bounded local UI evidence and do not
close the native/live matrix below.

## Primary-Source Boundaries

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
  1.4.1, 1.6, and 5.1 keep health accuracy, data security, privacy-policy,
  retention/deletion, consent, purpose limitation, and health-data handling in
  the release gate. A source design cannot predict reviewer acceptance.
- [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)
  and [App Store Connect privacy management](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
  require the submitted app-level answers to represent the exact app and
  integrated third-party behavior.
- [Apple notification authorization guidance](https://developer.apple.com/documentation/usernotifications/asking-permission-to-use-notifications)
  supports rechecking mutable OS authorization before scheduling. Source
  inspection does not prove the prompt, Settings return, delivery, or
  cancellation on a supported iPhone.
- [FTC mobile-health security guidance](https://www.ftc.gov/business-guidance/resources/mobile-health-app-developers-ftc-best-practices)
  supports minimization, access limits, security-by-design, and deletion when a
  legitimate need ends. The
  [FTC Health Breach Notification Rule guidance](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0)
  remains a counsel/classification and incident-readiness gate for identifiable
  health-app records.
- [FTC Health Products Compliance Guidance](https://www.ftc.gov/business-guidance/resources/health-products-compliance-guidance)
  requires prior substantiation for express and implied objective health
  claims. Removing unsupported outcome copy is a control, not a legal
  conclusion.
- [Washington My Health My Data Act, chapter 19.373 RCW](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373&full=true)
  section 19.373.020 requires the health-policy categories, sources, purposes,
  affiliates, processors/recipients, and rights to match the actual processing
  and requires affirmative consent for added collection categories or
  undisclosed purposes. Section 19.373.040 separately addresses withdrawal,
  deletion, recipient propagation, and backup handling. Coverage and
  exceptions remain counsel questions.
- [Office of the Privacy Commissioner of Canada meaningful-consent guidance](https://www.priv.gc.ca/en/privacy-topics/business-privacy/collecting-personal-information/consent/gl_omc_201805/)
  calls for prominent disclosure of the personal information, parties,
  purposes, meaningful risks, and withdrawal consequences, with fresh consent
  when significant purposes, parties, or risks change. Applicability and the
  exact Canadian retention/consent treatment remain counsel questions.

## Remaining Acceptance Gates

CORE-05 cannot become `complete` until the accepted release revision has
retained evidence for:

- a clean current-head migration replay and exact `0067 -> 0068 -> 0069 -> 0070`
  upgrade path, all current pgTAP/source/RLS/lint/drift/type gates, and the same
  gates against the intended hosted staging candidate;
- authenticated hosted Shelf/completion RPC, exact response-loss replay,
  deletion-wins, cross-owner denial, account/Apple denial, health-epoch denial,
  withdrawal erasure, account deletion, and schema-v4 export;
- two real users and two sessions/devices covering reordered delivery, missing
  upsert then delete, delayed pre/post-delete completion, concurrent UUID race,
  stale writer, offline recovery, response loss, and corrective Shelf replay;
- current-source human-simulated Today/Shelf branches beyond the retained local
  onboarding-to-AM/PM happy path, including partial, terminal, retryable,
  tail-deferral, completion relaunch, export, withdrawal, and account-switch
  behavior without inventing a production credential or destructive fixture;
- supported physical-iPhone encrypted-storage relaunch, force quit/process
  death, background/foreground, storage failure, timezone travel, DST, and
  accessibility behavior;
- supported-iPhone notification authorization, provisional/denied/revoked
  states, Settings return, scheduled inventory, quiet hours, caps, failure,
  relaunch, DST/timezone, lock-screen copy, VoiceOver, and Dynamic Type;
- exact-archive network/storage inspection, privacy manifests,
  required-reason API/SDK review, App Privacy reconciliation, export-compliance
  review, and signed-build identity;
- final user-facing privacy/health/retention/export copy and URLs, plus named
  privacy, security, regulatory, and launch-country counsel review of the exact
  source and evidence. The approved consent receipt must bind copy that
  explicitly covers the off-device Shelf/completion/adherence, tombstone,
  minimized receipt, processor/recipient, retention, export, withdrawal, and
  account-deletion behavior above; the present `draft-v1` /
  `draft_blocked` tuple cannot be promoted without that evidence; and
- App Review of the submitted binary and metadata.

No code, test, policy draft, or review packet can guarantee legal compliance,
Apple acceptance, product-market fit, or a seven-figure outcome.
