# Phase 9 Data Inventory

This inventory is the source for export, deletion, App Store privacy labels, Google Play Data safety, support escalation, and incident response. It must be rechecked for every release candidate.

## Sign in with Apple Lifecycle Data

Migration `20260715000055_apple_auth_lifecycle.sql` adds three fully sealed
tables. Direct table access is revoked from `anon`, `authenticated`, and
`service_role`; narrow security-definer RPCs are the only application path.

- `apple_auth_lifecycles` holds the Auth user UUID while the account exists, a
  versioned HMAC of the Apple subject, client ID, lifecycle state/generation,
  an owner/subject/client-bound AES-GCM refresh-token envelope and key version
  while active, validation/lease timestamps and failure code, and keyed relay
  email state. No plaintext Apple subject, relay email, or refresh token is
  stored.
- `apple_auth_capture_operations` holds one-use capture metadata: operation,
  Auth user/session, code HMAC, versioned subject HMAC, client ID,
  state/failure, and bounded timestamps. It never stores the authorization code
  or identity token. Nonterminal rows expire after ten minutes; terminal rows
  become purgeable after 24 hours.
- `apple_auth_server_events` holds keyed JTI, payload, subject, and optional
  relay-email digests plus verified client ID, event type/time, bounded
  disposition, receipt time, and the Auth user UUID while it still exists. The
  raw compact JWS and raw Apple subject are not retained. Auth deletion nulls
  the user UUID but currently retains the keyed event record; exact retention,
  export/access-rights treatment, and eventual purge require named privacy/
  legal/security approval before launch.

Only a signature-verified terminal event transiently forwards its raw subject
to the service-only RPC. The RPC can exact-match one Apple `auth.identities`
row; the subject must equal both `provider_id` and `identity_data.sub`. If no
identity exists yet, only the paired subject HMAC/key version, verified client
ID, event metadata, and replay/relay digests are stored. A later first capture
reconciles matching keyed terminal evidence under the owner lock before marking
or exchanging the authorization code. This processing path makes database
parameter/error-log minimization part of the production privacy review; it does
not turn the keyed event ledger into anonymous data.

The lifecycle worker opens a refresh token only in memory for Apple validation
and clears its string reference afterward. Account deletion may open the same
envelope in memory and immediately re-seal the token under the separate
deletion-step key; after durable deletion intake, the reusable lifecycle vault
is cleared. Vault and subject-HMAC keyrings support one to three overlapping
versions. Every successful daily validation atomically re-derives the current
subject digest and freshly seals the token under the current vault key. Dormant,
deferred, or failing rows do not advance from configuration alone, and an old
version cannot be retired until zero-row evidence exists or affected users
recapture/reauthorize and old lifecycles are retired. Subject-key retirement
also requires zero unresolved terminal `unknown_subject` events for that
version, or a reviewed reconciliation/disposition; those keyed rows are the
only no-retry link to a later first capture.

These sealed operational tables are intentionally absent from the current
user-facing export. That exclusion is a source boundary, not a legal conclusion;
the final access/export policy and disclosure must be reviewed against launch
jurisdictions and the exact production retention schedule.

## Exported From Supabase

The `data-export` Edge Function exports the caller-scoped tables listed in `CALLER_RLS_EXPORT_TABLES` and the service-role filtered exports listed in `SERVICE_ROLE_FILTERED_EXPORTS`.

Caller-scoped coverage includes account profile, skin profile, shelf, routines, completions, conflicts, active ramp, scans, cycles, reminders, consent ledger, photos, entitlements, recommendations, catalog corrections/lookups, commerce click events, community participation, photo trend metadata, Ask metadata, and Ask safety audit rows.

`reverse_trial_grants` remains service-only under RLS and is now exported only through the separate backend service-role client, with an exact `user_id` filter resolved from `auth.getUser()` rather than request data. Its output is allowlisted to `user_id`, grant/expiry timestamps, source, and reviewed metadata. The executable registry rejects every canonical service-only table if it is inserted into the caller-RLS set; the caller registry now exactly matches all 30 owner-client private tables.

Cloud photo export links are generated only when the photo metadata path is a well-formed object path under the caller's user ID storage prefix. Malformed, cross-user, dot-segment, empty-segment, query/fragment, or control-character legacy paths are reported as `INVALID_STORAGE_PATH` omissions and are not signed. Signed links default to and are capped at 60 seconds. Already issued links cannot be revoked; live evidence must prove they work before expiry and fail afterward.

Granular consent withdrawal is handled by the JWT-gated, POST-only
`consent-withdrawal` Edge Function. It accepts only the exact six-field
type/copy/idempotency/epoch/generation request, delegates the false receipt to
the authenticated 0054 RPC, and cleans prior data for photo backup/capture, the
server-side Ask graph, photo trend, community participation, and commerce data
sharing. Non-photo cleanup may complete in the authenticated call. Photo
capture/backup remains truthfully `202` pending until the scheduled worker uses
the database-attested ownership lease to delete Storage and reach terminal
absence; the caller never deletes a trusted prefix by itself. Deployed evidence
from `phase9:live-consent-withdrawal:strict` is accepted only when its clean Git
revision, canonical staging host, 0054 schema/harness/copy hashes, timestamp,
and exact check manifest validate; the boolean pass flag is not a substitute.

Base health-data consent withdrawal is a separate, non-destructive account lifecycle. Migration `20260715000054_health_consent_withdrawal_lifecycle.sql` is the source candidate for an authoritative processing-epoch barrier, durable database/Storage cleanup work, and a terminal withdrawn state; the mobile flow must pause health-purpose reads and writes before server cleanup while preserving Auth, billing, entitlements, and the store-safety journal. The exact source-candidate scope, processor classification, and unresolved retention rules are recorded in `docs/hugeToDo/HEALTH-CONSENT-WITHDRAWAL-PROCESSOR-RETENTION-MATRIX-2026-07-15.md` and the hash-bound `docs/hugeToDo/health-processor-inventory-v1.json`. Supabase is the primary infrastructure processor reconciled by the database and Storage steps; the separately reconciled external-processor array is currently empty and must not be interpreted as “no processor.” Source tests do not replace live-project worker/Storage zero-residue, backup/restore, physical-iPhone, professional review, privacy-policy, or App Review evidence.

The empty separate-provider array also depends on the catalog boundary remaining local to Supabase. `catalog-lookup` performs no request-time Open Beauty Facts call and cannot be enabled by the retired `OBF_API_ENABLED` flag; a miss returns manual fallback. Open Beauty Facts data may enter only through reviewed offline artifacts without an attached user request. Development/UI fixtures are non-network. Any live OBF origin in release traffic is a P0 inventory mismatch and requires a new processor inventory version plus sharing, retention, deletion/reconciliation, contract, policy, and consent review before enablement.

Service-role filtered coverage includes reverse-trial grants, subscription webhook events, OBF contribution queue rows tied to the user, and order attribution rows matched by the user's opaque commerce click tokens. Subscription event matching covers all retained scalar, alias, and transfer owner identifiers, while the export omits those identity fields and internal processing/security columns to avoid disclosing another account involved in a transfer event.

Migrations `20260713000046_account_service_row_scrub.sql` and `20260713000047_account_obf_contribution_erasure.sql` plus the account-deletion helper close the bounded synchronous service-row paths they cover: the service-role-only RPC is transactional, rejects residual identity, deletes account-only subscription events, the caller's commerce clicks, and the caller's OBF contribution payloads, detaches matching order attribution tokens, and removes only the deleting user from all seven scalar/alias/transfer owner fields on a shared event. Migration `0046` repairs legacy missing event IDs, canonicalizes live UUIDs found in old webhook payload owner keys, replaces every historical payload with a typed allowlist, makes click-token ownership unique, and tolerates legacy UUID case/whitespace during deletion. Migration `0047` purges legacy OBF rows with no owner, makes `user_id` mandatory, and changes the Auth FK from `SET NULL` to validated `CASCADE`, so direct Auth deletion cannot strand barcode/payload data. The current official ShopMy report exposes no correlation field, so its adapter always persists `click_token = null`; the known-token lookup and foreign-key path remain a fail-closed invariant for a future provider-approved rail. Strict result-shape validation prevents database errors or malformed attestations from being reported as deletion success. The real migrations pass disposable PostgreSQL 15 and 17 rehearsals, including idempotent RPC retry and direct Auth cascade, but this does not replace a complete Supabase migration reset or live concurrency/provider-interruption evidence.

Migrations `20260713000048` through `20260713000052` and the durable Edge
runtime close the bounded server-lifecycle gaps listed below that the earlier
synchronous flow could not close. A service-only barrier and account advisory lock suppress
owner and guarded service writes; account-owned rate-limit rows carry the Auth
owner and are scrubbed; six ordered steps persist bounded attempt/lease state;
Apple, RevenueCat, and PostHog payloads are encrypted at rest; ambiguous
provider mutations enter reconciliation instead of blind redispatch; Storage
and the service-row scrub are re-attested under the account lock immediately
before terminal receipt creation; Auth hard delete is attempted at most once
and then reconciled through read-only lookup; and only a pseudonymous HMAC,
key version, manual-Apple flag, capability digest, stable state, and finite
timestamps enter the terminal receipt.

The deletion Edge boundary also exposes one authenticated, opaque mobile
session preflight. It derives the owner and exact session only from the verified
bearer and calls a service-role-only security-definer RPC under the same account advisory lock;
the only successful states are `clear` and `active`, each paired with the same
canonical authenticated subject. Mobile rejects a cached-session subject
mismatch and keeps restored and newly authenticated sessions unpublished until
exact owner-bound `clear`, so RevenueCat and the authenticated product tree
cannot mount first.

The canonical local owner proof is the complete ordered tuple of
cleanup-required, owner binding, retained-owner binding, and ownerless
quarantine. The two markers accept only exact `1`; owner values must be
canonical lowercase 64-hex bindings; a retained binding must exactly equal the
owner; and quarantine cannot coexist with owner or retained state. The tuple is
read as one storage batch. Malformed, inconsistent, reordered, incomplete, or
unreadable proof fails closed before sign-out, cleanup, adoption, or Auth
publication. No cleanup decision reads the raw owner key in isolation.

Exact `active` authorizes registered owner-bound records, encrypted
photos/keys, and generated-cache cleanup only when its authenticated subject
exactly matches the owner binding, or resumes a destructive boundary already
marked cleanup-required. A foreign owner binding is copied to the durable
retained field before forced sign-out and remains preserved through a signed-out
cold restore; only exact-owner reauthentication consumes it, while a different
account wipes before claim. Ownerless records receive the mutually exclusive
quarantine marker before sign-out and cannot be adopted by any later account;
the destructive boundary must finish before a new owner can be claimed. Partial
cleanup keeps the tuple gated for retry.

Forced invalidation also uses the separate durable exact-`1`
`routinekind.authDerivedCleanupRequired.v1` control. It is committed before
Auth sign-out, is not removed by ordinary private-data cleanup, and is cleared
only after session/persisted-session removal, write settling, any authorized
private cleanup, and auth-derived query/notification/analytics/image-memory and
vendor resets all succeed. Cold restore reads it before `getSession` or Auth
publication and retries the resets; malformed or unreadable control state holds
the pre-Auth gate. The control is crash-retry authority for those resets, not
owner-data deletion authority.

Only exact HTTP
`401 {"error":"ACCOUNT_DELETION_SESSION_REJECTED"}` proves that the candidate
bearer is rejected, so the owner is retained or ownerless data is quarantined
before durable persisted-Auth and auth-derived/vendor cleanup finishes signed
out. It does not infer deletion or erase unattested owner-bound records.
Transport, malformed-response, `5xx`, and other unknown outcomes stay behind
retry rather than being treated as clear. The database RPC is not executable
by `anon` or `authenticated`, and no operation ID, capability, provider phase,
or timestamp crosses this API.

Migration 0052 adds a two-phase reserve/activate/renew/release publication lease
under that same account lock. It binds reserve, activation, renewal, preflight,
intake rate consumption, and begin to the exact live Auth session; deletion
removes reservations and drains active authority without extending its
deadline. Local erasure waits for exact authority end. RevenueCat completion
also waits five minutes and requires two full-family absence observations under
distinct claims at least 60 seconds apart. The database source closes the
bounded admission race for compliant clients, but hosted Edge/mobile evidence
and an approved old/tampered-client residual-risk control remain release
blockers. The exact design and external provider limits are tracked in
`docs/phase-9/account-deletion-operations-runbook.md`.

The active lifecycle retains the raw Auth UUID only while work is unfinished,
with an operation lifetime of 29 days and a database ceiling of 30 days.
Completed capability receipts are visible for 29 days and retained for at most
seven additional purge-grace days. Operator recovery audit rows retain digests,
stable reason/result codes, and finite timestamps, not command tokens or
provider payloads. The canonical Cron work lane also purges expired lifecycle,
rate-limit, and RevenueCat tombstone artifacts.

RevenueCat deletion now uses REST API v2 preflight, exact project/customer
identity evidence, a durable request-started boundary, and read-only
reconciliation. A V2 secret is mandatory because RevenueCat states that V1
keys do not work with REST API v2. Migration `0051` stores only versioned HMACs
of the complete observed identity family, never raw aliases, and the webhook
computes lookup candidates across every overlapping key version so a late
event cannot silently recreate the deleted identity. New tombstones are
configured for 824 days under a 825-day database ceiling; that is an
engineering bound, not an approved production retention policy. RevenueCat
must confirm alias/restore/recreation behavior and privacy counsel must approve
the finite duration and rotation overlap.

PostHog required-mode deletion now persists the exact target person set,
dispatch cutoff, provider event-status observations, and two durable absence
observations separated by the configured interval. It reports terminal success
only after the EU project response set satisfies those checks and a real
capture-shutdown/no-recordings audit. Development can record a typed
not-required state only when the environment and all deletion signals prove
PostHog was unused.

For an Apple-linked account, initial native authentication now binds independent
CSPRNG state/raw nonce values to the ID token and keeps the one-use code for the
lifecycle server. The fixed-origin token exchange must bind the returned token
identity to the authenticated Apple subject before capture or revocation.
Only the exact successful token contract followed by Apple's exact `200`
no-body revoke contract reports automatic revocation. A missing/unusable code,
missing or mismatched configuration, subject mismatch, exchange/no-token
failure, or revoke failure records a stable manual-revocation outcome instead
of falsely claiming automatic success. The iOS client source observes Apple's
credential-revoked notification and checks credential state before publishing a
restored session and again at foreground. Unknown/error results stay behind the
retryable session gate; confirmed invalid Apple sessions are durably quarantined
before sign-out without erasing unrelated owner-bound local-first records. A
supported physical iPhone must still prove that notification/state path,
quarantine recovery, and same-owner/different-owner behavior. The source now includes signed
server-to-server ingress for relay-email changes, `consent-revoked`, and
`account-deleted`; terminal events close sessions and create or reuse the same
durable six-step deletion operation. If the event predates the Auth identity,
first capture reconciles its audience-bound keyed record and returns `blocked`
before code exchange without relying on Apple replay. Exact primary-App-ID
registration and real Apple delivery remain external gates.

The current local 0055 gate passed two clean resets, exact 54/0055 history, the
full structural suite plus 114/114 Apple lifecycle pgTAP, schema lint, an empty
shadow diff, temporary types, 20/20 focused event/lifecycle Edge tests, and the
47-test Apple auth work lane.

These are bounded local source/rehearsal properties, not proof of a race-free
production system. Hosted clean-reset, A/B stale-session/preflight races,
publication-lease process-death/configure-in-flight/lost-release checks,
Cron/Vault continuity, Apple event delivery, provider
interruption and lost-response recovery, RevenueCat 200/202 and renewal/restore
recreation behavior, PostHog async completion, Apple native revocation,
Storage residue, mobile relaunch/status recovery, and reviewed staging and
production runs remain required. The exact deployment, environment, rotation,
monitoring, containment, and external-gate contract is in
`docs/phase-9/account-deletion-operations-runbook.md`.

The exhaustive orphan audit also found launch-significant policy/data-model gaps outside migration `0047`: Sentry receives a deterministic account pseudonym but has no remote erasure/retention attestation; waitlist email and growth share identifiers have no verified account-purpose link or deletion path; community moderation/report cascades currently erase other people's shared safety evidence when an author deletes; and staff/reviewer/access identities lack a dedicated principal namespace and retention contract. These require separate migrations and named Privacy/Legal/Trust-and-Safety/HR/Clinical decisions rather than being silently deleted or retained. OBF migration `0047` remains intentionally narrow and must not be described as closing those gates.

## RLS And Photo Storage Inventory

The migration-derived public schema has 80 RLS-enabled tables: 30 owner-client private, 10 directly service-only private, 17 fully sealed service-only lifecycle/tombstone/publication/copy tables, and 23 authenticated catalog/editorial tables. The sealed tables added by migrations `0048`, `0051`, `0052`, `0054`, and `0055` revoke direct table access even from `service_role`; they are reachable only through narrowly granted security-definer RPCs. The DB-09 hosted matrix must register all 57 private tables exactly once, apply row-positive isolation probes to the 40 directly queryable private tables, prove direct denial for every role on the 17 sealed tables, and distinguish cross-user permanent accounts, a real signed-anonymous account, and a publishable-key client with no session. Disposable PostgreSQL rehearsals and local pgTAP provide source evidence for sealed state that PostgREST is deliberately unable to inspect directly; hosted proof remains open.

Photo metadata and `photos` bucket objects require an owner-prefixed path plus current `photo_cloud_backup` consent. Migration `20260713000045_anonymous_photo_storage_guard.sql` additionally denies insert/update of cloud photo bytes to signed-anonymous accounts, including an anonymous account that can create its own consent row. Owner-prefixed select/delete remains available so existing legacy objects can still be accessed or removed. This source posture is not release evidence until a reviewed reset and the hosted adversarial matrix pass with unchanged-object and residue-free-cleanup postconditions.

External handoffs are guarded before opening or caching: commerce retailer links, policy links, and subscription management URLs must normalize to HTTPS, cannot contain embedded credentials or control characters, and fragments are stripped. Unsafe commerce links are filtered before rendering and do not receive click tokens or write click events.

Notification exports include preferences and content-free delivery log metadata only. OS notification payloads use generic lock-screen copy; `lockscreen_discreet` is forced true in mobile code and constrained true in Supabase.

## Mobile Composition And Local Exclusions

The Settings action writes a mobile schema-version-1 wrapper containing `server_account_data` and `local_device_data`. When Supabase is configured, the owner-scoped Edge Function result is required and labeled `included`; a server error aborts before a plaintext file is written, so account-held data cannot be omitted silently. With no configured backend, the artifact is still useful for local-first users and labels the absent server scope `backend_not_configured`.

The local collector is registry-driven and tested against every entry in `LOCAL_PRIVATE_DATA_KEYS`. It batch-reads the encrypted private records with one content-key lookup; read paths do not create replacement key material if the original key is missing. It includes stored profile/onboarding state, shelf products, AM/PM routine-order overrides, cycle/ramp choices, completion history and pending sync rows, conflict choices, consents, notification/recommendation preferences, app activity state, entitlement cache metadata, and sanitized Progress metadata plus decrypted notes when available. Conflict choices are versioned records keyed by conflict rule plus canonical unordered local shelf-product IDs; each contains the exact pair, rule version, and `accept_suggested_timing` or `use_together` decision. Legacy `keep_alternate_nights` values normalize to the generic accepted-timing value. The legacy export field name `conflict_overrides` is retained for schema-version-1 compatibility even though it now includes both decisions. The owner-scoped `routine_conflicts` table is a best-effort server mirror with the same canonical identity; local encrypted state remains authoritative until routine sync/reconciliation closes. The collector recursively removes known shelf/photo device-path fields and never reads Progress image bytes.

Native private-record content keys are written only to SecureStore; AsyncStorage is an explicit Expo web path and a read-only migration source for keys written by older native builds. SecureStore unavailable/missing results, malformed keys, and authentication failures preserve the original encrypted envelope. A failed encrypted read records the exact ciphertext snapshot and blocks a feature store from replacing that snapshot with an empty/default value until a successful read or explicit deletion occurs. First writes share one in-flight key creation, and missing-key creation scans all app storage for existing private envelopes before generating anything.

Progress image/note key reads are also non-creating. A non-sensitive AsyncStorage marker records that Progress key material has existed; write paths require that marker to persist, and an upgrade-time encrypted-file scan prevents a missing key from being silently replaced when older `.onskinphoto` files exist. The marker is cleanup metadata, is excluded from account export, and is removed with local private data. Genuine OS key loss remains unrecoverable in V1 because cloud backup/key escrow is intentionally unavailable.

Every data-bearing Progress route consumes that failure boundary after entitlement and biometric unlock. The tab, capture, review, and detail remain unmounted behind shared recovery until one encrypted metadata query succeeds; retry performs a real reread, and an unreadable store cannot become an empty-timeline or missing-photo state.

Local Progress image files and thumbnails, shelf thumbnail paths, OS share-cache files, SecureStore keys, Supabase auth credentials, note ciphertext, and device file paths are excluded. The wrapper `local_media_note` states this boundary; the server JSON `local_only_photo_note` separately distinguishes any server-side `photos` metadata rows. Cloud backup is unavailable. Progress photo bytes are stripped of EXIF/GPS-style metadata before encrypted storage, and generated share files are stripped again before handoff. Generated export JSON, decrypted photo share files, and shelf share-card images are one-time app-cache/tmp files deleted after the share attempt; stale export/share cache filenames are also included in local private-data cleanup. Progress photo sharing is image-only, requires explicit confirmation, discloses that the image is not blurred, and excludes notes from the shared image even though notes can appear in the JSON export.

Auth session replacement is also a local privacy boundary. The mobile provider clears local-only private stores before accepting a different active Supabase user ID, so a new account on the same device does not inherit the previous account's local-only shelf, profile, routine, photo metadata, consent, notification, or entitlement caches.

Supabase session tokens are stored locally through `LargeSecureStore`: the content key stays in SecureStore and the AsyncStorage payload is an authenticated XChaCha20-Poly1305 envelope. Legacy AES-CTR session ciphertext is supported only for migration after a valid read. Tampered, malformed, plaintext, or keyless session values are deleted and treated as signed out.

OS app-switcher snapshots are treated as a privacy boundary. The root mobile provider overlays a neutral app privacy shield whenever app state is not active, so local-only photos, routines, shelf, Ask, community, and settings screens should not appear in app-switcher previews. App content does not mount until the encrypted app-lock preference resolves; preference failure assumes locked. After app-wide authentication, the Progress tab and direct capture, review, and detail entries share a separate foreground-scoped photo-timeline unlock that is cleared whenever the app leaves active state. The shield uses the runtime app display name rather than a hardcoded legacy brand. This still needs real-device verification because snapshot timing and native authentication ordering are platform-specific.

Android Auto Backup is disabled in app config for the same local-only data classes. Store-build inspection blocks `allowBackup` regressions across resolved development, staging, and production configs; binary QA must still inspect the built Android manifest and iOS backup/keychain restore behavior.

## Third Parties

- Supabase: Auth, database, storage, Edge Functions.
- RevenueCat: subscription/customer data; durable deletion uses REST API v2 preflight, 200/202 acknowledgement plus read-only absence reconciliation, and versioned HMAC identity tombstones. `REVENUECAT_V2_SECRET_API_KEY` is mandatory because V1 keys do not work with v2. Live alias, transfer, renewal, restore, and recreation proof plus approved tombstone retention/rotation remain gates.
- PostHog: analytics person keyed by pseudonymous app user ID plus a legacy raw-ID compatibility path; required-mode deletion persists the exact target set and provider status observations, then requires two interval-separated absence observations and reviewed capture-shutdown/no-recordings evidence before terminal success. Hosted EU-project completion remains a launch gate.
- Sentry: crash diagnostics; payload scrubber removes route params, URLs, product context, barcodes, OCR text, notes, photo paths, receipts, and free text before capture.
- Apple/Google: account and store billing records; the app deletion flow must explain subscription cancellation remains in store account management. For Sign in with Apple, the lifecycle server exchanges the one-use code, retains the encrypted refresh token for daily validation/deletion revocation, and accepts only verified signed account events. Fixed-origin exchange is bound to the authenticated Apple subject and only an exact `200` no-body revoke response proves automatic revocation. Native revoke-listener/state-check and signed-event source are implemented, but physical-iPhone, hosted token exchange/validation, primary-App-ID endpoint registration, real Apple event delivery, retention review, and App Review remain launch blockers.

## Review Requirement

If a launch feature writes a new user-owned or user-linked table, add it to `data-export`, `account-deletion` cascade/scrub coverage, the privacy labels/Data safety source, and the RLS adversarial matrix before enabling it.
