# Store Privacy Inventory Draft

Date: 2026-07-26

This is an engineering draft for Apple App Privacy under the current iOS-only
launch contract. Google Play Data Safety is not a release requirement unless
Android is explicitly restored to scope. Counsel must review this inventory
against the final policies and actual production configuration before App Store
submission.

## iOS Privacy Source Evidence Boundary

The current deterministic installed-source audit reports `archive_required`:
72 native npm packages, 23/23 source-valid privacy manifests, 23 manifest-
resource source bindings still requiring archive verification, 228 podspecs,
16 XCFramework candidates, no standalone framework
or `.a`/`.dylib` candidates, ten exact Apple SDK-list intersections, zero
errors, and 24 warnings. It also verifies the exact-hash repair for the invalid
empty `NSPrivacyAccessedAPITypes` array in the reviewed
`react-native-view-shot` source.

This result is an engineering input to this inventory, not a store answer. Ruby
podspec tokens are source candidates rather than evaluated CocoaPods or archive
proof. The audit excludes first-party/linked source, generated Expo prebuild,
resolved CocoaPods/SPM output, and the production archive; first-party sources
have separate validators and the other surfaces remain gates.

Before App Privacy answers are completed, reconcile the exact production
`.xcarchive.zip` or IPA, build identity/hash, resolved `Podfile.lock`/SPM record, merged
privacy report, manifest and required-API ledgers, SDK signatures,
signing/entitlements/symbols/processing results, and observed network/storage
behavior to every category, purpose, linkage, tracking, sharing, and retention
answer. Named privacy/legal and supported-device signoffs must reference that
same release evidence and the final published URLs. Source-valid does not mean
archive-valid, label-complete, legally compliant, Apple-approved, or
commercially successful.

The typed RC evidence index now hash-binds those inputs to the exact EAS build
UUID/source SHA/log, release identity, candidate-local artifact paths, one
tracked evidence commit, and named privacy/release approval metadata. No completed
production index or underlying archive/report set exists. Index validation
does not machine-interpret opaque reports or replace the field-by-field privacy
and legal review required here.

## Data Categories

| Category                        | Current app use                                                                                                                                                                                                                                                                                                           | Shared with                                                                                                                        | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account identifiers             | Supabase user ID, email/Apple/Google auth when linked                                                                                                                                                                                                                                                                     | Supabase, Apple/Google auth providers                                                                                              | Anonymous-first account exists before sign-in.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Purchase data                   | RevenueCat subscriber/customer info, product ID, entitlement, renewal state                                                                                                                                                                                                                                               | RevenueCat, Apple App Store, Supabase entitlement mirror                                                                           | App gates on `pro` entitlement; no client writes entitlements. Google Play Billing is outside the current release contract.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Local store-safety journal      | Domain-separated owner binding, state (`in_flight` or `unconfirmed`), reason (`completion_unconfirmed` or `payment_pending`), creation timestamp, and payment-pending review timestamp                                                                                                                                    | Local device only                                                                                                                  | Contains no raw Auth/RevenueCat/StoreKit user ID, product, action, acknowledgement, receipt, order, or transaction ID and is excluded from account-private cleanup so a possible charge cannot be silently forgotten. Generic exact-owner records remain until verified recovery or terminal deletion. Payment-pending records have an original-timestamp-anchored 30-day review marker that never clears checkout from device time alone. Terminal deletion replaces a matching exact record with one ownerless bit containing only fresh `kind`, `createdAt`, and `expiresAt`; that field is also a review marker rather than an automatic retention maximum. Foreign UI collapses all detail to one generic device-safety state. Resolution-bound retention and disclosure require counsel approval.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Product shelf data              | Product names, brands, optional normalized package barcodes, opened dates, PAO/expiry state; owner-free local v3 pending/terminal mirror operations                                                                                                                                                                       | Supabase only through the owner-derived health/account-fenced sync RPC                                                             | A reviewed catalog or reconnect candidate changes the Shelf only after explicit confirmation and never silently overwrites user-entered identity, ingredients, or freshness fields. Product identity can imply health concerns. The local purpose-limited export includes `shelf_and_sync_state`; final category/purpose/linkage, hosted convergence, retention, and policy treatment remain open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Catalog lookup and recovery     | Search phrase or normalized barcode in a real-time first-party request; encrypted owner/health-bound pending or reviewed retry candidate; bounded owner-linked lookup type/result event                                                                                                                                   | Supabase only; never a request-time OBF/CosIng, general analytics, crash, or AI recipient                                          | Source does not persist request identity in application tables or telemetry. Migration `0059` purges and prohibits query, barcode, matched-product, source, and quality identity in `catalog_lookup_events`, and purges/read-seals legacy `shelf_scans`. Offline retry is opt-in, encrypted on device, capped at 64, and becomes logically ineligible after seven days. Physical byte purge occurs on the next activation, queue read/maintenance, local export, or account/consent lifecycle cleanup; it is not guaranteed at the wall-clock deadline while the OS suspends or terminates the app. When an account owner is verified, export filters to that owner before reading the queue snapshot; a verified unclaimed local store preserves validated live records. A ready item is removed only after explicit rejection or after an explicitly accepted Shelf mutation succeeds. Hosted Edge/gateway/observability logs must separately prove request bodies and URLs are not retained. Final App Privacy, notice, retention, export/deletion/withdrawal, hosted-RLS, and professional review remain launch gates.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Catalog correction reports      | Owner ID, correction type/status, product ID and/or normalized barcode/product identity, bounded sanitized description (current UI uses fixed strings), allowlisted proposed catalog fields/client context, internal assignment/resolution audit, internal content-free retry ID/health epoch/body digest, and timestamps | Supabase and authorized catalog operations/review only; external contribution-back remains disabled                                | The user must explicitly choose `Report missing product`, `Not this product`, or a named product-detail issue. Reports intentionally retain actionable product identity and are not anonymous or analytics. Direct API-role reads and mutations are revoked; the Edge/RPC path is account/health-fenced and rejects malformed or identity-free missing/wrong reports. The random retry ID is bound to the exact owner, health epoch, and sanitized body so response-loss retry returns one receipt; that ID, epoch, and digest are internal security controls excluded from the reporter-facing export. Account portability uses the authenticated nonanonymous caller's `auth.uid()`-bound, `account_access_allowed()`-gated owner keyset RPC and omits assignee, reviewer alias, resolution note/time, and other internal operator fields; `service_role` has neither raw correction-table `SELECT` nor export-RPC execution. The Edge accepts only matching exact counts and checksums from two complete keyset passes, but the reads are nontransactional and do not establish a point-in-time database snapshot; hosted concurrent-mutation and retry proof remains open. CAT08 operator requests use ephemeral one-hour database buckets containing only operator UUID, budget class, window, count, and expiry; no report/product/payload/session/IP data enters those buckets. Exact retention/preservation, hosted limiter/load proof, operator access, user-facing status, hosted export/deletion/withdrawal, backup, notice, and App Privacy classification remain launch gates. |
| Beta catalog-curation evidence  | Source-candidate design for separately consented cohort counts, participant-capped quality outcomes, category aggregates, and release/cohort-domain-separated keyed product-demand commitments; no genuine corpus exists                                                                                                  | Proposed restricted first-party/Supabase processing and authorized internal catalog/privacy review only                            | Launch-blocked. The optional purpose is unbundled from health, account, analytics, and general beta participation. Raw user/shelf identifiers, barcodes, product names, labels, and free text cannot enter Git, release packets, general analytics, catalog sources, or AI providers. Withdrawal/deletion, backup treatment, finite retention, privacy/legal review, and App Privacy category/purpose/linkage decisions remain open; keyed commitments are not proof of anonymity.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Catalog reviewer/operator audit | Source-candidate design for professional/workforce IDs, roles, independence groups, qualification-evidence hashes, signatures, catalog decisions, and timestamps; no real signed packet exists                                                                                                                            | Proposed sealed Supabase CAT-03 authority and restricted offline evidence; authorized catalog/release/privacy/legal reviewers only | Distinct from participant data and consent. Hashes and signatures may still be personal data. Legal basis/notice, access/export rights, role-restricted access, retention or justified preservation, and Apple privacy-label treatment remain launch-blocked pending privacy/legal/workforce review.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

CAT08 operator-rate `expires_at` is a logical one-hour eligibility boundary.
Requests perform bounded opportunistic deletion, but an idle hosted database
still needs a scheduled purge. Retained job evidence, backup/restore treatment,
and workforce-privacy approval are required before the buckets can be described
as physically deleted after one hour.
| CAT-03 mutation audit | Mutation-event ID; product ID; generation; bounded mutation kind; source relation/row key; INSERT/UPDATE/DELETE operation; observation time; before/after row digests; prior root; event digest; advanced root. A correction digest contains only correction/product ID, status, UTC review time, and reviewer/note-presence booleans | Sealed Supabase CAT-03 authority; database owner and authorized internal governance only | No campaign ID, curation-record ID, or free-form reason is stored. The ledger is append-only and excluded from every direct API-role/client/general-analytics lane. Reporter identity, barcode, free text, arbitrary JSON, assignment/resolution content, and ambient timestamps are excluded from the permanent correction digest. A row reference may remain indirectly linkable, so the event is not anonymous and needs counsel-reviewed legal basis, access/export handling, retention/preservation, and App Privacy classification before production. It permanently advances the reviewer-bound served-state root. |
| Routine behavior | AM/PM product-ID order preferences, cycle/ramp choices, completion history, stable local routine/step/event identities, pending/terminal completion sync state, routine-day adherence attestations, absorbed dates, and current/best streak | Encrypted local device; owner-scoped Supabase only through the completion/adherence RPCs | Current-device order and local v3 completion/sync state are exportable and removed on health/account cleanup. A routine-day row is user attestation, not objective proof. Server sync exists as a source candidate, but hosted two-device convergence is not a launch claim. |
| Health/wellness inferences | Skin profile answers, goals, sensitivities, pregnancy/trying-to-become-pregnant/breastfeeding status if provided | Encrypted local V1 profile; Supabase if account/sync writes succeed | Requires an explicit current version/hash health-data grant in app before personal profile use/write. |
| Photos | Progress photos and coarse capture-quality metadata | Encrypted local device storage; explicit single-photo share only | Phase 5 encrypts progress photo files locally. Post-capture face bounds are transient; no face template, landmark set, image, quality verdict, or automatic photo metadata enters analytics/Supabase. Cloud backup is unavailable until encrypted upload, restore, deletion, consent, and device QA ship together. |
| Camera capture | Barcode frames, label temp photos, progress photo temp files | Local device by default | Barcode frames are not stored. A label photo is moved to an app-managed temporary cache file; Back, Continue, retake, and capture-failure paths await idempotent deletion, unmount requests cleanup, and a bounded next-launch scavenger recovers managed files left by interruption or termination. It is never uploaded. Progress temp files are analyzed locally, a temporary 64 px lighting sample is deleted, and the original temp file is deleted after encryption or discard. |
| Usage analytics | Funnel events, feature events, non-content properties | PostHog | Do not send health/photo content. Person deletion must run on account deletion. |
| Crash diagnostics | Error events, release/build metadata, device/runtime diagnostics | Sentry | Config disables default PII, screenshots, view hierarchy, and failed requests. |
| Notifications | Exact reminder times, purpose toggles, timezone, routine quiet hours, local notification schedule, and rolling scheduling-attempt reservations | Encrypted local device only in the current mobile source | Every purpose defaults off. The current mobile client does not read or write `notification_preferences` or `notification_log`, and notification decisions do not emit analytics. Existing database tables remain inside withdrawal/export/residue controls but are not current mobile collection authority. Remote sync, cross-device caps, delivery/open measurement, privacy-label decisions, and physical-device QA remain closed launch gates. |
| Commerce clicks | Opaque click token and destination metadata if commerce ships | Commerce rail and Supabase attribution logs | No skin/goal/pregnancy/photo fields may leave the app in affiliate URLs. |
| Community/Ask | Consent-gated participation/audit metadata | Supabase if features ship | Cloud Ask remains launch-blocked until vendor/privacy/legal gates clear. |

### CORE-05 stable identity, replay receipt, and export note

Migration `0069` adds one content-free stable Shelf identity/tombstone record:
`id`, `user_id`, `created_at`, `deleted_effective_at`, and
`deleted_received_at`. It also adds sealed Shelf and completion replay receipts
with operation/event ID, owner, internal `request_sha256`, bounded state/result,
and timestamps. The raw Shelf payload and completion body are not retained.
These records are linked to the user and can reveal health-purpose activity;
they are not anonymous, operational-only exemptions, or analytics.

Direct API-role table access remains revoked. Server export schema v4 exposes
the five identity fields and the subject-facing receipt fields through three
authenticated-nonanonymous, `auth.uid()`-derived, account/health-fenced keyset
RPCs. The Edge pins the epoch derived from the initial health lifecycle into
each health-fenced read, runs two owner/count/checksum/column-guarded passes,
and rechecks lifecycle. Stable withdrawn/never-active state must produce exact
empty health sources under a deny epoch; nonactive residue fails closed, and
withdrawing or changed state aborts.

The subject receipt excludes `request_sha256`: the domain-separated
fingerprint can be tested against guessed deleted payloads and is not needed to
interpret the result. Counsel must approve that access/export exclusion. A
digest is not proof of anonymization.

No safe replay horizon currently coordinates a finite TTL across suspended
devices. Stable identities and minimized replay receipts therefore remain only
for the active account and active health-data purpose and are erased on
health-consent withdrawal or account/Auth deletion. A finite retention period
requires a versioned expiry/terminal protocol, backup treatment, policy and
App Privacy updates, and privacy/legal approval.

The installed health disclosure is still `draft-v1` / `draft_blocked`.
Production new grants fail closed. It must not be promoted unless the exact
review receipt covers off-device Supabase Shelf and completion/adherence
processing, the stable identity/tombstone and minimized receipt fields, each
processor/recipient role, active-consent/account-lifetime retention, combined
export, and withdrawal/account-deletion erasure.

### CAT-05 native label recognition note

The staging-only CAT-05 source candidate processes the temporary label photo,
recognized transcript, alternatives, geometry, and confidence-ranking signals
on device for editable review. The current direct mobile analytics transport is
disabled. If a separately approved transport is later activated, the
recognition-completion boundary permits only `result`, a coarse
`latency_bucket`, and `on_device: true`. After explicit Continue, the separate
parser event permits `source: label_capture`, parser result, bounded token count,
and the native-enabled Boolean. Photo bytes, paths, request IDs,
transcript/ingredient content, candidates, confidence, exact timing, product
identity, and raw failure detail are prohibited.

Apple's App Privacy guidance says data processed only on device is not
"collected," while derived data transmitted off device must be considered
separately. Accordingly, the local image/transcript flow and the two minimized
derived analytics flows must receive separate field-by-field answers. This draft does
not decide their category, purpose, linkage, tracking, retention, or consumer-
health treatment. Production remains disabled pending exact signed-binary
traffic/storage inspection and named privacy/legal review.

The cleanup design deletes app-managed label photos on normal exits, snapshots
canonical Expo Camera cache children at app boot for bounded cold-relaunch
recovery, and uses Expo Image `cachePolicy="none"`. Both Shelf label and
Progress shutters await the shared startup drain. A failed initial listing may
retry only while both remain gated; the first successful snapshot is immutable
and later retries never relist post-boot captures. These are source controls,
not cleanup evidence. The exact build must be inspected by path, image digest,
and recognizable signature across the managed cache, Expo Camera cache, and
Expo Image/SDWebImage caches after Continue, Retake, Leave, failure, bounded
retry, and cold relaunch.

## Store Review Inputs Needed

- Final privacy policy URL.
- Final consumer health data privacy policy URL, if separate.
- Terms URL.
- Support URL.
- Account deletion instructions URL.
- Data export instructions URL.
- In-app account export scope copy describes the combined account/device scope.
  The mobile JSON wrapper includes every registered local private-data record,
  including `shelf_and_sync_state` and `completion_and_sync_state` pending/
  terminal records, plus owner-scoped server schema-v4 data. Its
  `local_media_note` and the server JSON `local_only_photo_note` disclose that
  device-only Progress image files/thumbnails are excluded. Sanitized local
  Progress metadata and decrypted notes are included when available; any
  server-side `photos` rows remain separately covered.
- Counsel-approved subject-access treatment for the three stable-identity/
  replay-receipt projections and the excluded `request_sha256` fingerprints.
- Counsel-approved active-account/health-purpose retention for minimal
  tombstones/receipts until a versioned replay horizon exists, including hosted
  backup/restore and withdrawal/account-erasure treatment.
- Plain-English data retention/deletion policy.
- Confirmation that analytics/crash tools do not collect sensitive content.
- Confirmation that current V1 photos are device-only unless the user explicitly
  shares one; cloud backup and automatic photo-metadata sync are unavailable.
- Exact-build CAT-05 network and filesystem evidence confirming that label
  photos/transcripts are not uploaded or logged, plus a separate decision for
  the categorical/coarse recognition and downstream parse analytics events.
- Counsel-approved disclosure and retention basis for the device-only store
  safety journal, including its pseudonymous owner binding, generic-record
  recovery retention, resolution-bound payment-pending/ownerless records, and
  device-clock 30-day review markers.
- Field-by-field App Privacy, policy, consent, withdrawal/deletion, processor,
  backup, and retention decisions for optional beta catalog-curation evidence.
- Separate professional/workforce legal-basis, notice, rights, access, and
  retention decisions for CAT-03 reviewer/operator audit records.
- Field-level App Privacy, notice, operator-access, retention/preservation,
  export/deletion/withdrawal, and backup decisions for owner-linked catalog
  correction reports.

## Current Engineering Safeguards

- Separate env vars for public bundle values versus server secrets.
- Phase 2, Phase 9, Phase 10, and Phase 11 readiness gates reject secret-looking `EXPO_PUBLIC_*` keys and private-looking values assigned to public keys.
- PostHog session replay is disabled.
- Sentry default PII, screenshots, view hierarchy, and failed request capture are
  disabled.
- Supabase RLS smoke script verifies owner-only access before release.
- RevenueCat is bound to Supabase user IDs to preserve entitlement continuity.
- Every purchase/Restore call uses an owner-aware coordinator. A durable journal
  is committed immediately before native invocation; storage failure stops the
  SDK call. Pre-sheet configuration/offering/admission failures create no false
  record. Checkout remains device-wide fail-closed after possible invocation.
- Server-verified terminal account deletion removes the owner correlation before
  local cleanup and leaves only a fresh ownerless commerce-safety bit when one is
  needed. Manage subscription/Support handoffs never count as resolution.
- Native photo files are encrypted locally with authenticated encryption before storage.
- Native content keys remain in SecureStore; temporary/missing/invalid key reads preserve ciphertext and cannot silently rotate keys or rewrite the failed record with fallback state.
- Opt-in app lock fails closed while its encrypted preference is unreadable; every sensitive Progress direct route shares a foreground-only timeline unlock and relocks after backgrounding.
- Data-bearing Progress routes require a successful encrypted metadata read after entitlement/app-lock checks; read failure blocks route content and writes behind non-destructive retry instead of presenting an empty or missing-photo state.
- Analytics sanitization drops sensitive keys such as barcodes, OCR text, notes,
  photo paths, product IDs/names, receipts, and image/file paths.
- CAT-05 recognition analytics use closed property allowlists and coarse
  latency buckets. The downstream parse event is limited to source, parser
  result, bounded count, and native-enabled state; recognized text, ingredient
  identities, candidates, confidence, photo paths, exact timing, and raw errors
  do not cross either boundary in source.
- CAT-05 is enabled only in the internal staging EAS profile. Development and
  production remain disabled until exact-build native/privacy/accessibility/
  performance evidence and professional review pass.
- Catalog Edge telemetry stores only owner-linked lookup type and bounded
  result. Database constraint `catalog_lookup_events_minimized_identity`
  prohibits raw search, barcode, product, source, and quality identity, while
  legacy `shelf_scans` is purged and unavailable to every API role.
- CAT-03 release evidence is designed to retain participant-capped aggregates
  and domain-separated keyed commitments rather than raw beta shelf content;
  this source control is not live intake/deletion proof or an anonymity claim.
- CORE-05 direct product/routine/step/completion mutation grants are revoked.
  Shelf and completion writes derive owner from Auth, require current health/
  account admission, and return bounded versioned dispositions. Delete wins
  over a missing upsert without restoring content; withdrawal/account deletion
  erases stable identities and minimized receipt ledgers.
- Server export schema v4 reads every health-fenced source under the epoch
  derived from the initial lifecycle, performs two exact count/checksum/owner/
  column-guarded passes for the new sources, and aborts on lifecycle change.

## Open Legal Questions

- Which jurisdictions are in launch scope.
- Whether the final policy set needs a standalone consumer health data policy.
- Whether any analytics event counts as consumer health data under launch-state
  laws.
- Whether product shelf, ingredient concerns, and pregnancy status require
  additional consent wording beyond current in-app consent.
- Which Apple App Privacy category, purpose, linkage, health/consumer-health,
  and retention answers apply to optional beta catalog-curation intake,
  aggregate/commitment evidence, and professional reviewer/operator audit data.
- Which legal basis, notice, rights workflow, and retention or preservation rule
  applies to professional/workforce reviewer and operator identities,
  qualification evidence, signatures, decisions, and timestamps.
- Which retention/preservation period, App Privacy category/purpose, operator
  access, and user-rights workflow applies to owner-linked catalog correction
  reports that intentionally contain the minimum product identity needed for
  investigation.
- Whether active-account/active-health-purpose lifetime is the approved legal
  basis and disclosed duration for content-free Shelf tombstones and minimized
  replay receipts until a safe versioned expiry protocol exists.
- Whether excluding the internal `request_sha256` guessing-oracle fingerprint
  from subject access/export is correct in every launch jurisdiction, and what
  security/legal review must authorize that exclusion.
- Which exact Apple App Privacy data type, purpose, linkage, retention, and
  deletion answers apply to stable Shelf identity/tombstone fields, replay
  receipt fields, and local pending/terminal sync state.
- Whether commerce links launch in V1 or remain hidden until after beta.
- Whether the exact store-safety journal and ownerless tombstone are described
  correctly in the final privacy/retention notices for every launch jurisdiction;
  counsel must approve the resolution-bound retention, review-marker semantics,
  and deletion-finalization treatment.
- Whether production is constrained to one App Store subscription group and the
  tested RevenueCat transfer/alias policy; physical-device Ask-to-Buy approval,
  decline, review-marker, and resolution evidence remains mandatory.
- How a persistent malformed or unavailable local store journal can preserve a
  device-wide commerce block without preventing in-app account deletion or
  terminal local cleanup; the current fail-closed intake/finalization behavior
  needs Apple/counsel approval and a tested recovery path.

## Store-safety retention rationale (engineering draft)

Apple requires in-app account deletion to remove the account and associated data
that is not legally required, while also telling subscription users how billing
continues and how to manage it. Immediate deletion must remain available:
https://developer.apple.com/support/offering-account-deletion-in-your-app.
Accordingly, a valid unresolved transaction never blocks the deletion request;
terminal completion strips the owner link and resets the device-only safety bit's
review marker. FTC health-app guidance recommends data minimization and deletion when a
legitimate business need ends:
https://www.ftc.gov/business-guidance/resources/mobile-health-app-developers-ftc-best-practices.
The actionless/productless/ownerless bit and its 30-day review marker are
engineering minimization controls motivated by those principles. The marker does
not auto-delete or reopen checkout because mutable device time is not sufficient
provider proof. This is not a claim of anonymization, a legal-retention conclusion,
or proof of App Store acceptance; counsel must approve the resolution-bound
retention and any future trusted-time/provider release rule.
