# Consent Matrix

Status: legal copy blocked; technical consent surfaces partially implemented  
Last updated: 2026-07-29

## Consent Principles

- Consent must be specific, informed, and revocable.
- High-risk consents are not bundled.
- Defaults are off for sharing, optional beta catalog curation, Ask cloud mode,
  commerce partner sharing, and marketing. Trend processing and photo cloud
  backup are currently unavailable, not merely off.
- Withdrawal must be as easy as granting.
- Consent text/version/hash must be stored when required; a grant is current only when its version and SHA-256 text hash match the exact displayed copy.
- Malformed, unreadable, declined, stale-version, and wrong-hash grants fail closed and remain preserved for explicit recovery.
- Placeholder legal copy cannot ship.

## Matrix

| Consent                        | Purpose                                                                                                                                                                                                   | Default                                                                        | Collection/sharing                                                                                                                                                                                                                                                                      | Source                                                                                                                                                            | Current status                                                                                                                                                                                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Health data collection         | Collect goals, quiz answers, sensitivities, pregnancy/trying-to-become-pregnant/breastfeeding status, added products, and derived routine/progress/adherence state                                        | Required before goals or any personal profile use/write                        | Encrypted local-first collection; owner-scoped Supabase Shelf/completion replay and adherence projection when configured                                                                                                                                                                | `apps/mobile/src/features/onboarding/consentCopy.ts`, migrations `0068` and `0069`                                                                                | Required order is age -> consent -> goals -> quiz. The active health epoch fences local/remote writes; final legal copy, hosted replay, two-device, native, retention, privacy-label, and professional gates remain blocked                               |
| Optional beta catalog curation | Use separately contributed beta-shelf observations only to prioritize independent catalog review and measure the exact declared corpus/holdout; never to create product facts or recommendation authority | Off; unbundled from health, account, analytics, and beta participation consent | Restricted first-party/Supabase intake; retained CAT-03 release evidence is participant-capped aggregate or domain-separated keyed commitments only; no raw shelf identifiers, barcodes, product names, or free text go to Git, general analytics, catalog sources, or AI providers     | `docs/phase-4/catalog-curation-release-runbook.md`, `docs/phase-4/catalog-coverage-quality-targets.template.json`, `docs/phase-4/beta-shelf-corpus.template.json` | Launch-blocked: purpose-specific copy/UI, consent ledger, restricted intake, withdrawal/deletion, finite retention, backup treatment, privacy/legal review, and hosted evidence do not exist; keyed commitments must not be called anonymous              |
| Marketing                      | Emails/promotions                                                                                                                                                                                         | Off                                                                            | Marketing contact                                                                                                                                                                                                                                                                       | You tab / consent ledger                                                                                                                                          | Copy placeholder until legal                                                                                                                                                                                                                              |
| Commerce partner sharing       | Reserved future display of paid where-to-buy links and an opaque partner click identifier                                                                                                                 | Unavailable; COM admission is closed                                           | No current positive transfer. Any future identifier must be treated as pseudonymous unless counsel and technical evidence prove otherwise; document recipient, linkability, purpose, retention, deletion, disclosure, App Privacy, consumer-health, and FTC treatment before activation | `apps/mobile/src/features/commerce/*`                                                                                                                             | COM-01..07 zero-admission; partner, processor, privacy, consumer-health, disclosure, retention, deletion, and legal gates remain blocked                                                                                                                  |
| Photo cloud backup             | Reserved future backup of progress photos                                                                                                                                                                 | Unavailable                                                                    | No current upload or metadata mirror                                                                                                                                                                                                                                                    | `apps/mobile/src/features/photos/consent.ts`                                                                                                                      | No setter/UX; future implementation and legal review required                                                                                                                                                                                             |
| Photo trend reading            | Future on-device within-person descriptive Trend state; no current processing authority                                                                                                                   | Unavailable; positive grant refused before mutation                            | No current photo read, measurement, result persistence, upload, content analytics, or positive consent grant; explicit legacy withdrawal cleanup remains governed as a data-rights path                                                                                                 | `apps/mobile/src/features/trend/*`, `docs/hugeToDo/PHOTO-05-TREND-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md`                                                      | PHOTO-05A literal zero admission. Launch-required but blocked by a real engine/issuer, calibration/failure proof, fairness, exact consent/privacy/legal review, archive local-only proof, supported-iPhone evidence, and professional signoff             |
| Ask cloud mode                 | Broader cloud-grounded answers                                                                                                                                                                            | Off                                                                            | Minimized summary to cloud model vendor                                                                                                                                                                                                                                                 | `apps/mobile/src/features/ask/*`                                                                                                                                  | Launch-required; blocked pending vendor/safety/privacy/clinical/legal gates                                                                                                                                                                               |
| Notifications                  | Exact-time routine reminders and separately controlled optional suggestions                                                                                                                               | Every purpose off; OS authorization independently controlled                   | Encrypted on-device preferences, local scheduling, and local scheduling-attempt reservations; no current push token, remote notification preference/log write, or notification analytics                                                                                                | `apps/mobile/src/features/notifications/*`                                                                                                                        | Local source candidate; exact-time soft ask and fail-closed scheduling implemented. Final legal/privacy copy plus native permission, scheduling, relaunch, DST/timezone, accessibility, network, and exact-build evidence remain blocked                  |
| Account deletion               | Delete account/data                                                                                                                                                                                       | User action                                                                    | Intended local freeze plus hosted/vendor deletion workflow; no launch-availability claim until all recovery and live gates pass                                                                                                                                                         | `apps/mobile/src/features/settings/actions.ts`                                                                                                                    | Launch-blocked source candidate: malformed/unavailable local-store recovery, hosted/vendor completion, subscription disclosure, exact-device behavior, and legal/App Review evidence remain open                                                          |
| Health-data consent withdrawal | Stop health-purpose processing and delete collected/derived health-purpose data without deleting the account or billing state                                                                             | User action                                                                    | Local freeze + withdrawal ledger + durable Postgres/Storage/processor reconciliation                                                                                                                                                                                                    | `apps/mobile/src/features/settings/actions.ts`, `supabase/functions/consent-withdrawal/index.ts`, `docs/hugeToDo/health-processor-inventory-v1.json`              | Source candidate in progress; the paused shell and terminal-only fresh reconsent are locally implemented and Expo-web verified, while hosted worker/Storage, native-device/staging, retention approval, and final copy remain blocked                     |
| Data export                    | Export user data from server and the requesting device                                                                                                                                                    | User action                                                                    | Schema-v4 Edge export plus purpose-limited local-device snapshot. Stable Shelf identity and Shelf/completion receipts use three authenticated-nonanonymous, `auth.uid()`-derived keyset RPCs; local v3 pending/terminal state is included                                               | `apps/mobile/src/features/settings/actions.ts`, `apps/mobile/src/features/settings/localDeviceExport.ts`, `supabase/functions/data-export/`                       | Source candidate. Two-pass owner/count/checksum/column guards and health-lifecycle epoch binding are implemented; hosted concurrency/completeness, native share/cache, final access scope, `request_sha256` exclusion, policy, and counsel remain blocked |

CORE-05 Shelf and completion replay is part of the existing
`health_data_collection` purpose, not a new bundled permission. Every local and
remote replay write requires the current health/account boundary. A Shelf or
completion operation does not become analytics, marketing, commerce-sharing,
or cloud-AI consent.

The installed health copy is still `draft-v1` / `draft_blocked`; production
new grants fail closed and server health-epoch/RPC admission requires the
current approved version/hash. Do not promote that draft unless the retained
review receipt explicitly covers off-device Supabase processing of Shelf
products, routine completion/adherence history, stable product tombstone
identities, minimized idempotency receipts, each processor/recipient role,
active-consent/account-lifetime retention, export, and withdrawal/account-
deletion erasure. A prior approval of generic profile/routine wording is not
approval of these additional fields and uses.

The server stores only minimal stable Shelf identity/tombstone fields and
minimized replay receipts. Raw Shelf/completion request bodies are not retained
in the receipt ledgers. Their internal domain-separated `request_sha256`
fingerprints remain sealed and are excluded from the subject-facing export
because they can be tested against guessed deleted payloads. Counsel must
approve that rights decision; hashing is not anonymization.

No safe client/server replay horizon exists yet, so those tombstones and
receipts remain only for the active account and active health-data purpose and
are erased on health-consent withdrawal or account/Auth deletion. A future
finite TTL requires a versioned expiry protocol and fresh copy, retention,
backup, rights, and privacy/legal review.

CAT-03 reviewer and operator audit records are not beta-participant consent
records. They may contain stable professional/workforce IDs, role and
independence-group assignments, qualification-evidence hashes, signatures, and
timestamps. Their legal basis, notice, access/export treatment, role-restricted
access, and finite or legally justified retention require separate
privacy/legal/workforce review. Hashing and signing do not make that audit data
anonymous, and participant consent cannot be used as its legal basis.

The append-only CAT-03 served-state mutation ledger is also governance/audit authority,
not beta-participant consent evidence. It stores a mutation-event ID, product ID,
generation, bounded mutation kind, source relation/key, INSERT/UPDATE/DELETE
operation, observation time, before/after row digests, prior root, event digest,
and advanced root. It stores no campaign ID, curation-record ID, or free-form
reason. The relation/key can remain indirectly linkable. Production use therefore
requires approved legal basis, access/export handling, retention or justified
preservation, and Apple privacy-label classification; the digest must not be
described as anonymization.
For a correction hold, the permanent digest is computed only from a bounded
serving projection: correction/product ID, status, UTC review time, and booleans
for the required reviewer and note. Reporter identity, barcode, free text,
arbitrary JSON, assignment/resolution content, and ambient timestamps are
excluded from the CAT-03 chain.

## Policy URL Contract

The app must expose functional links for:

- Privacy policy.
- Terms of service.
- Support.
- Account deletion instructions.
- Data export instructions.
- Consumer health data privacy policy/notice.

These are configured through public environment variables and wired into in-app settings/paywall.

## Launch Rule

`CONSENT_COPY_VERSION` values containing placeholder markers cannot be used in a production build. `npm run phase3:audit-copy:strict` must remain failing until final copy is reviewed and blocker rows are closed.

The withdrawal/reconsent acceptance contract is
`docs/hugeToDo/HEALTH-CONSENT-WITHDRAWAL-PROCESSOR-RETENTION-MATRIX-2026-07-15.md`.
Source files, tests, or a passing empty-processor hash audit do not close the
live-service, backup, physical-iPhone, privacy/legal/security, policy, or App
Review gates.
