# Health-Consent Withdrawal, Processor, And Retention Matrix

- Date: 2026-07-15
- Status: source candidate; privacy/legal review, live deployment, physical-iPhone evidence, and App Review remain open
- Scope: `health_data_collection` purpose only

This packet defines the source-controlled product and data contract for
withdrawing health-data consent without deleting the user's account. It is an
engineering and reviewer input, not legal advice, a compliance certification,
an Apple-approval prediction, or production evidence.

The machine-readable inventory is
[`health-processor-inventory-v1.json`](./health-processor-inventory-v1.json).
Its immutable inventory version is `health-processors-v1`.
Its `separatelyReconciledExternalHealthProcessors` value canonically serializes
as `[]`; SHA-256 of those two bytes is
`4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`.
Migration `0054` binds each operation to that version and digest so a future
recipient cannot be added silently.

## 1. Product Contract

Health-consent withdrawal and account deletion are separate rights and separate
operations.

When the user withdraws health-data consent, the source candidate must:

1. Persist a local `withdrawing` marker and stop new health-purpose reads,
   writes, sync, notifications, recommendations, and background work before
   starting destructive cleanup.
2. Append a non-grant consent record and establish a server-side write barrier.
3. Delete health-purpose data on the current device, in owner-scoped Postgres
   rows, and in the owned `photos` Storage namespace.
4. Reconcile every separately configured external health processor in the
   inventory version captured by the operation. Version 1 has none.
5. Keep the app in a paused, account-preserving shell until absence is verified.
6. Permit a fresh opt-in only after withdrawal reaches a terminal `withdrawn`
   state. Reconsent creates a new processing epoch and starts with empty health
   state; it must not restore deleted answers, products, routines, or photos.

The operation must preserve the Supabase Auth account, sign-in identities,
account-level settings that are not health-purpose data, App Store billing,
RevenueCat entitlement evidence, no-card grant evidence, and the durable store
transaction journal. It must not sign the user out, revoke Sign in with Apple,
reset RevenueCat identity, cancel an App Store subscription, or invoke full
account deletion.

### Durable worker operations lane

The source candidate includes the private scheduled Edge function
`health-consent-worker` and the one-minute pg_cron/Vault provisioning contract
`supabase/ops/health-consent-work-lane.sql`. The Edge secret is
`HEALTH_CONSENT_WORKER_SECRET`; its exact private Vault counterpart is
`health_consent_worker_secret`, and the environment-scoped project origin is
`health_consent_project_url`. No credential value belongs in source control or
the mobile build. Hosted provisioning must still prove one intended Cron job,
the expected Vault bindings, rotation/revocation, constant-time rejection of
bad secrets, retry after scheduler/function outage, bounded work, operator
alerts, and continuation when the requesting device disappears.

## 2. Data Scope And Outcome

The exact database implementation remains authoritative, but the reviewer
contract is broader than a table-name checklist: derived health state, caches,
queued work, and stale writers must not survive merely because they are stored
outside the primary profile table.

| Data or authority                                                                              | Withdrawal outcome                                                                                            | Reason / verification                                                                                                    |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Skin profile, goals, sensitivities, quiz answers, and pregnancy/breastfeeding setting          | Delete locally and remotely                                                                                   | Direct health-inference input; absence plus write denial required                                                        |
| Shelf products, stable identity/tombstone rows, local/server sync queues and minimized receipts, scan history, catalog corrections/lookups tied to the user | Delete | Products, tombstones, retry state, and searches can reveal health concerns; private replay ledgers and disabled/legacy OBF contribution rows are included |
| Routines, steps, cycles, ramps, conflicts, step/routine-day completions, local completion journal/outbox/terminal receipts, streaks and freezes | Delete; reset profile streak counters and adherence timezone/reference/version | Derived from health-purpose inputs and adherence behavior; routine-day rows are user attestation, not objective proof |
| Recommendation preferences/results                                                             | Delete                                                                                                        | Health-purpose personalization and derived state                                                                         |
| Ask sessions and safety audit rows                                                             | Delete                                                                                                        | May encode health context even when transcripts are minimized                                                            |
| Trend state and server photo metadata                                                          | Delete                                                                                                        | Derived from sensitive progress observations                                                                             |
| Local encrypted progress images, thumbnails, notes, keys, and memory/cache artifacts           | Delete from this device                                                                                       | Local-only does not mean exempt from the user's withdrawal choice                                                        |
| Owned `photos` bucket objects                                                                  | Delete in bounded batches and verify zero residue                                                             | Storage is a distinct work step; a database-row count is insufficient                                                    |
| Health-related reminders, preferences, and delivery logs                                       | Cancel/delete                                                                                                 | Prevent future purpose processing and sensitive inference from cadence                                                   |
| Community questions/reactions/reports/blocks created from the user's health-purpose experience | Delete or detach only the withdrawing user's contribution, preserving other users' records where required     | Cross-owner deletion must not erase another user's evidence                                                              |
| Commerce click events and order correlation derived from the user's health-purpose experience  | Delete and detach correlation                                                                                 | Billing/order records are separate, but the health-derived click link is not                                             |
| Health consent ledger                                                                          | Append withdrawal; retain only the minimized, immutable rights record under an approved finite retention rule | A historical grant cannot reactivate processing; exact retention/legal basis needs counsel                               |
| Withdrawal operation and step receipts                                                         | Retain minimized status/evidence only for an approved finite period; purge on account deletion                | Needed for idempotency, support, and proof of completion; the current source has no approved production retention period |
| Auth account and login identities                                                              | Preserve                                                                                                      | Withdrawal must not become account deletion                                                                              |
| Subscription, entitlement, refund, and store-transaction state                                 | Preserve under its separate billing/account purpose                                                           | The app cannot cancel Apple billing by deleting health-purpose data                                                      |
| Base account profile                                                                           | Preserve, except health-derived streak counters reset                                                         | Keeps the account usable without preserving derived health state                                                         |
| Marketing choice and unrelated account consents                                                | Preserve unless separately withdrawn                                                                          | Consent is purpose-specific                                                                                              |

Any field later shown to contain health-purpose data moves into deletion scope
even if it is stored in a nominally non-health table. That requires a migration,
test update, inventory review, and reviewer reapproval.

## 3. Processor And Recipient Classification

An empty separate-provider array does **not** mean no vendor handles health
data. It means no additional provider requires an independent API deletion or
absence-reconciliation step in version 1 after the primary infrastructure lanes
below run.

| Provider or boundary       | Current source-candidate role                                                                 | Receives health-purpose data?                                         | Withdrawal treatment                                                                                                                                                            | Launch status                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Supabase                   | Auth, owner-scoped Postgres, Storage, Edge Functions                                          | Yes, when configured and consented                                    | Postgres cleanup and Storage work run inside the durable operation; no duplicate external-provider dispatch                                                                     | Live project, DPA, region, backup behavior, restore behavior, hosted worker, and zero-residue proof blocked |
| Current device             | Encrypted local profile, Shelf v3 products/pending/terminal sync, completion v3 history/journal/outbox/terminal/unsynced state, routine, photo, and preference state | Yes | Freeze synchronously, drain/cancel work, delete registered health stores and photo material, clear memory/query caches | Source cleanup registration exists; native process-death/Keychain/zero-byte evidence remains pending |
| PostHog                    | Dependency/config scaffold; direct capture disabled                                           | No approved health payload; current `track()` sanitizes then discards | No provider deletion step for this purpose. Purge legacy local PostHog persistence. Any enabled capture requires a new inventory version and reviewed transport                 | Live project and privacy review blocked                                                                     |
| Sentry                     | Optional scrubbed crash diagnostics                                                           | No approved health or stable user payload                             | Not an account health-data store by contract. Before-send removes user, route, request, breadcrumbs, product/photo/profile context, and raw exception text                      | Live payload inspection, DPA, retention, and deletion posture blocked                                       |
| RevenueCat                 | Subscription/entitlement processing                                                           | No; health attributes are prohibited                                  | Preserve billing evidence; do not reset identity during health withdrawal                                                                                                       | Live project/sandbox and privacy review blocked                                                             |
| Apple                      | Sign in, App Store billing, distribution                                                      | No app health-purpose dataset                                         | Preserve login and billing; Apple revocation belongs only to account deletion or credential invalidation                                                                        | Live/native verification blocked                                                                            |
| Google                     | Optional Google Sign-In on iPhone                                                             | No app health-purpose dataset                                         | Preserve login                                                                                                                                                                  | Live/native verification blocked                                                                            |
| Cloud AI provider          | Not selected/configured                                                                       | No                                                                    | Feature stays fail-closed. Enabling requires explicit consent, minimized payload, provider deletion, DPA/retention review, and a new inventory version                          | Launch-blocked                                                                                              |
| Affiliate/commerce partner | Not selected/configured                                                                       | No                                                                    | Health attributes remain prohibited; enabling purpose-separated click sharing does not authorize health sharing                                                                 | Launch-blocked                                                                                              |
| Support vendor             | Not selected/configured                                                                       | No approved free-form health intake                                   | Do not route health content until a processor and retention contract exists                                                                                                     | Launch-blocked                                                                                              |
| Open Beauty Facts          | Reviewed offline source artifacts only; request-time lookup and live contribution are removed | No live transfer in the source candidate                              | No external reconciliation step. Delete any disabled/legacy owner-linked queued contribution in database cleanup; any future network transport requires a new inventory version | Any live lookup, contribution, or user-directed request transfer is launch-blocked                          |

Source evidence for the negative telemetry assertions is
`apps/mobile/src/lib/analytics/track.ts`,
`apps/mobile/src/lib/analytics/track.test.ts`,
`apps/mobile/src/lib/observability/sentry.ts`,
`apps/mobile/src/lib/observability/sentry.test.ts`, and
`apps/mobile/src/lib/observability/scrub.ts`. These contracts still require
release-binary network inspection; source inspection cannot prove a live vendor
configuration.

The planned commerce click token is opaque and contains no profile fields, but
it is **not anonymous**: Layerwell stores it beside an owner-scoped click and an
affiliate may return the same token with purchase attribution. Placeholder UI
that calls it anonymous is not eligible for production clearance. Final copy,
App Privacy answers, the partner contract, and the technical payload must
describe that pseudonymous linkage consistently. Written privacy/legal and
Apple-review analysis must also resolve whether attaching a paid link to a
health-context recommendation is permissible even when no profile field is sent;
until then, the partner transport and paid-link surface remain fail-closed.

## 4. Inventory Change Rule

Before any new provider, SDK, contractor, support tool, AI gateway, analytics
transport, affiliate system, or subprocess can receive health-purpose data:

1. Add it to a new, sorted external-processor array and issue a new immutable
   inventory version and digest. Do not rewrite the version captured by an
   existing operation.
2. Define its exact fields, purpose, region, encryption, access, subprocessors,
   DPA terms, retention, backup behavior, breach contact, deletion API, retry
   policy, rate limits, and terminal absence evidence.
3. Add a durable provider-specific withdrawal step. A successful dispatch alone
   is not terminal proof when the provider exposes status or read-back.
4. Update consent copy, privacy/consumer-health notices, Apple App Privacy
   answers, the processor register, threat model, incident plan, export/delete
   behavior, and professional review hashes.
5. Prove consent, refusal, withdrawal, provider outage, lost response,
   idempotency, replay, rate limit, and live deletion in staging before enabling
   production traffic.

An inventory version/hash mismatch is an `action_required` condition, not a
reason to report `NO_CONFIGURED_EXTERNAL_HEALTH_PROCESSORS`.

## 5. Retention And Timing Matrix

| Record / system                                                  | Source-candidate target                                                                                                          | Required release evidence / unresolved decision                                                                                                                             |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New health-purpose processing after the user confirms withdrawal | Stop before destructive cleanup begins                                                                                           | Mobile local freeze, server barrier, epoch-bound writer tests, stale-client tests, and live two-device proof                                                                |
| Active local health state                                        | Delete during the local withdrawal boundary                                                                                      | Registered-key coverage, cancellation/drain proof, relaunch/process-death recovery, encrypted file and memory inspection                                                    |
| Active Supabase relational health state                          | Delete as soon as the worker prepares the accepted operation                                                                     | Clean migration replay, RPC/trigger tests, interrupted worker retry, exact zero counts, live staging proof                                                                  |
| Stable Shelf identity/tombstones and minimized replay receipts   | Retain only while the account and health-data purpose are active; erase when withdrawal begins and on account/Auth deletion       | No safe replay horizon exists for a suspended device. A future finite TTL requires versioned expiry/terminal semantics, migration and backup behavior, final notices, and privacy/legal approval |
| Supabase Storage objects                                         | Delete in bounded work batches; operation remains nonterminal until absence is re-attested                                       | Path ownership/epoch tests, unsafe legacy path handling, lost-response retry, hosted residue proof                                                                          |
| Separately reconciled external processors                        | None in version 1                                                                                                                | Inventory hash audit. Any recipient observed in release traffic is a P0 mismatch                                                                                            |
| Open Beauty Facts network transport                              | No request-time lookup, contribution, or other user-request transfer                                                             | Static source/manifest/env gates plus release-binary traffic inspection must show no OBF origin; any observed request is a P0 inventory mismatch                            |
| Consent ledger                                                   | Minimized immutable grant/decline/withdrawal evidence; never usable to restore an old grant                                      | Counsel must approve legal basis, fields, and finite duration; export/policy must match                                                                                     |
| Withdrawal operation/step state                                  | Raw owner linkage only while needed for the active/retryable operation; minimized terminal evidence for a finite reviewed period | A purge schedule and support/legal duration are still missing and launch-blocking                                                                                           |
| Hosted backups and archives                                      | Active deletion may be delayed only under a documented, applicable rule and provider capability                                  | Washington's outside limit is six months for archived/backup systems; choose a shorter supported target, configure it, test restore-then-delete, and disclose it accurately |
| Account/billing/entitlement records                              | Preserved under separate purposes and their own retention schedules                                                              | Counsel/finance must approve exact periods; health withdrawal must not alter subscription state                                                                             |
| Sentry diagnostics                                               | No health or account-linked payload by source contract                                                                           | Live payload inspection, retention setting, DPA, and incident testing remain blocked                                                                                        |
| PostHog                                                          | No direct capture in the source candidate                                                                                        | If enabled, perform fresh classification; current empty external inventory may no longer be valid                                                                           |

The app should target immediate freeze and prompt active-store deletion. Legal
response windows are outer limits, not product wait targets or evidence that a
particular business is covered. The UI must report the operation's actual
state; it must not promise completion while Storage, a processor, a worker, or
backup handling remains unverified.

### 2026-07-26 CORE-05 replay and access addendum

Migrations `0068` and `0069` bring Today adherence and Shelf/completion replay
inside this withdrawal contract. `0069` deletes private
`shelf_sync_operations` and `routine_completion_sync_operations` synchronously
when the lifecycle enters withdrawal; established routine/product cleanup and
identity cleanup hooks remove active and already-tombstoned
`shelf_product_identities`. The exact zero-residue predicate includes all three
new sources. Account/Auth deletion also cascades them.

Before withdrawal, the stable identity contains only product/owner ID,
creation time, and optional effective/received deletion times. The two receipt
ledgers contain operation/event ID, owner, a domain-separated request digest,
bounded state/result, and timestamps; neither retains the raw Shelf payload or
completion body. They remain linked health-purpose data, not anonymous
telemetry.

The absence of a finite TTL is deliberate but not legally approved. The
current protocol gives a suspended device no bounded replay horizon or expired
terminal disposition. Deleting a tombstone or receipt earlier could permit
resurrection, destroy exact idempotency, or make a delayed completion
unresolvable. A future finite schedule must coordinate client/server protocol,
migration, old-build handling, backup/restore, copy, access/export treatment,
and privacy/legal review.

Server account export schema v4 exposes the subject-facing stable identity and
receipt fields through three authenticated-nonanonymous,
`auth.uid()`-derived, account/health-fenced keyset RPCs. Direct table access
remains revoked. The Edge binds every health-fenced read to the initial
lifecycle-derived epoch, performs two complete owner/count/checksum/column
passes, and rechecks final lifecycle. Stable withdrawn/never-active state must
yield exact empty health sources under a deny epoch; nonactive residue fails
closed, and withdrawing or changed state aborts. Internal `request_sha256`
remains excluded because it can be
tested against guessed deleted payloads; counsel must approve that rights
decision.

For the US-wide product baseline, use Washington's stricter six-month backup
outer limit or a shorter supported target even though Nevada's statutory backup
outer allowance can reach two years. Neither limit is a product waiting period.

## 6. Primary-Source Rationale

- Apple App Review Guidelines 5.1.1(i) require the privacy policy to describe
  collected data, collection method, every use, third-party equivalent
  protection, retention/deletion, and how a user can revoke consent or request
  deletion; 5.1.1(ii) requires an easily accessible and understandable
  withdrawal path. Apple App Privacy treats off-device data retained beyond
  the real-time request as collected and requires the app-level answer to
  include integrated third-party practices. Apple also requires metadata and
  submitted behavior to be accurate.
  [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/),
  [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)
- Apple's health-and-fitness guidance requires data minimization, permission for
  health-data collection, accurate App Privacy declarations, and prohibits using
  health/fitness data for advertising, marketing, use-based data mining, or sale
  to data brokers. Layerwell therefore treats health-purpose data and the separate
  affiliate click purpose as non-composable authorities; a commerce opt-in must
  never authorize health-data disclosure.
  [Apple Health and fitness apps](https://developer.apple.com/health-fitness/)
- PIPEDA section 6.1 requires consent whose nature, purpose, and consequences a
  reasonable user would understand. Schedule 1 clauses 4.3 and 4.5 require an
  available withdrawal choice, disclosure of its implications, purpose-limited
  use, and destruction, erasure, or anonymization when information is no longer
  required. The Canadian privacy commissioners' joint meaningful-consent
  guidance further calls for prominent descriptions of the data, purposes,
  recipients, and meaningful risks; explicit consent is generally expected for
  sensitive information, and significant new purposes/parties/risks require
  fresh meaningful consent rather than silent policy expansion. Applicability
  and any provincial overlay still require launch-jurisdiction counsel.
  [PIPEDA section 6.1](https://laws-lois.justice.gc.ca/eng/acts/P-8.6/section-6.1.html),
  [PIPEDA Schedule 1](https://laws-lois.justice.gc.ca/eng/acts/P-8.6/section-sched417658.html),
  [OPC meaningful-consent guidance](https://www.priv.gc.ca/en/privacy-topics/business-privacy/collecting-personal-information/consent/gl_omc_201805/)
- Washington RCW 19.373.020 requires a consumer-health privacy policy to state
  categories, sources, purposes, affiliates, processors/recipients, and rights,
  and requires affirmative consent before collecting additional categories or
  using data for additional purposes not disclosed in that policy. RCW
  19.373.040 states withdrawal and deletion as distinct consumer rights. A
  deletion request reaches the entity's network and notified processors/
  contractors/third parties; active requests generally have a 45-day response
  rule, and archived/backup deletion delay may not exceed six months. Coverage
  and exact application still require counsel.
  [RCW 19.373.020](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373.020),
  [RCW 19.373.040](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373.040)
- Nevada NRS 603A.500, 603A.505, 603A.515, and 603A.530 address
  affirmative collection/sharing choices, cessation and deletion, propagation
  to processors and other recipients, and processor contracts. Nevada's active
  deletion period is generally 30 days after authentication; its backup outer
  allowance can reach two years. The national product must use the stricter
  applicable target rather than treating either outer limit as a waiting
  period. Coverage and exceptions require counsel.
  [Nevada NRS Chapter 603A](https://www.leg.state.nv.us/NRS/NRS-603A.html)
- Connecticut's current Chapter 743jj defines consumer health data as sensitive
  data, restricts processor access to the statutory contract framework, and
  contains consumer-health-controller duties. The July 1, 2026 amendments and
  exemptions require launch-date counsel review; a startup-size assumption is
  not an engineering control.
  [Connecticut Chapter 743jj](https://www.cga.ct.gov/2026/sup/chap_743jj.htm)
- California Civil Code sections 56.05-56.06 can deem qualifying consumer
  health software a health-care provider for CMIA purposes. Layerwell's exact
  pregnancy, health-profile, and condition-management behavior therefore needs
  a written counsel classification; this matrix does not decide coverage.
  [California Civil Code sections 56.05-56.06](https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?chapter=1.&division=1.&lawCode=CIV&part=2.6.)
- GDPR Article 7(3) says consent must be as easy to withdraw as to give and that
  withdrawal does not retroactively invalidate prior lawful processing.
  Article 17(1)(b) links withdrawal to erasure where no other legal ground
  applies, and Article 19 addresses notification to recipients. Applicability,
  exceptions, legal bases, and retention require counsel and launch-country
  review.
  [GDPR consolidated text](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A02016R0679-20160504)
- FTC guidance says many non-HIPAA health apps and service providers may fall
  under the Health Breach Notification Rule, and an unauthorized disclosure can
  be a breach even without a cybersecurity intrusion. This packet does not
  decide coverage; it makes provider and payload inventory a mandatory incident
  and launch control.
  [FTC HBNR compliance guidance](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0)

## 7. Acceptance And Evidence Gate

Do not close `DB-10`, `CORE-01`, `OPS-04`, the Phase 3 privacy row, or the App
Review consent gate from this document alone.

The credential-free combined local database candidate was replayed from scratch
twice on 2026-07-15 after the red-team fixes: all 53 migrations through `0054`
applied, all 77 public tables had RLS, the 54-table private classification
matched 30 owner-linked + 10 directly service-only + 14 sealed tables, and all 261 pgTAP
assertions passed (46 schema + 215 health-consent lifecycle). Schema lint,
migration-shadow comparison, empty drift, temporary type generation, formatting,
and repository-diff checks also passed. Phase 9 health-consent verification
passed 104 Deno tests plus 7 evidence tests. The mobile workspace passed
typecheck, lint, and 3,026 tests across 266 files. These are local source results
only; repository types were not replaced and `DB-08` remains open.

That 2026-07-15 evidence is historical for the original withdrawal lifecycle.
The 2026-07-26 `0068`/`0069` source extends its cleanup and zero-residue scope to
adherence fields, stable Shelf identities, and both minimized replay ledgers.
Only the exact current-head database/upgrade/source gates can prove the local
extension; hosted worker, Storage, backup, two-device, native, export,
privacy/legal/security, and App Review proof remain open.

Local human-simulated Expo-web evidence at 390 x 844 and 360 x 640 covers
consent-before-goals, decline/direct-goals denial, non-destructive withdrawal,
paused reload, fresh-consent refusal, and terminal reconsent with route stability
and reload. The report is under
`test-results/human-e2e/2026-07-15/health-consent-withdrawal-current/`. Placeholder
Supabase configuration was used, so it proves no hosted cleanup or Storage
absence.

Remaining required evidence includes:

- repeat the database, concurrency, and retry gates against the exact reviewed
  staging and production candidates and retain clean-revision artifacts;
- rerun the focused Edge and mobile status, expected-epoch, idempotency,
  cancellation, selective-cleanup, legacy-row, Storage, worker-claim,
  account-deletion-composition, and fresh-reconsent contracts on the exact clean
  release revision and retain their output;
- a source audit that recomputes the processor-array digest and rejects drift;
- a catalog transport audit proving the live Edge handler, manifest, and production
  environment expose no Open Beauty Facts request path; offline fixture/import
  artifacts must be non-network and any observed OBF release traffic is P0;
- complete the remaining human-simulated E2E for goals -> quiz and later
  onboarding, nonterminal interruption/retry, export/account deletion/sign-out/
  subscription controls, and native lifecycle variants; retain the completed
  local age/consent/decline/withdrawal/terminal-reconsent web run as regression
  evidence;
- reviewed staging evidence with two users, two sessions/devices, network loss,
  process death, stale writers, actual Storage objects, zero residue, and worker
  continuation without the requesting device, including retained Vault/Cron
  configuration and job-run evidence;
- schema-v4 hosted export evidence for stable Shelf identity and both replay
  receipt sources, including active-epoch reads, stable withdrawn/
  never-active exact emptiness, lifecycle-change abort, concurrent mutation,
  owner mismatch, count/checksum/column guards, and the reviewed
  `request_sha256` exclusion;
- supported physical-iPhone evidence for local files/keys/cache, notification
  cancellation, StoreKit/account preservation, foreground/background behavior,
  Dynamic Type, VoiceOver, and relaunch;
- production processor/DPA/region/retention/backup configuration, observed
  release-binary network traffic, final policy/App Privacy answers, and named
  privacy/legal/security review tied to exact source hashes.

Until those gates pass, the accurate readiness label is `launch-blocked`, even
if local source tests pass.
