# Data Inventory

Status: working inventory, not legal-cleared  
Last updated: 2026-07-15

This inventory must match Apple privacy labels, Google Data Safety, the privacy policy, consumer health data notice, internal processor review, and support deletion/export workflows.

## Current Data Categories

| Category                              | Examples                                                                                                | Source                                         | Storage                                                                         | Shared with                                                             | Default                                      | Notes                                                                                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account identifiers                   | Email, auth user id, provider id                                                                        | Sign in                                        | Supabase Auth                                                                   | Supabase, Apple/Google auth as applicable                               | User action                                  | Required for account sync.                                                                                                                                       |
| Anonymous install/session identifiers | Anonymous user id, device/session ids                                                                   | Guest/session                                  | Local storage, analytics if configured                                          | PostHog/Sentry when enabled                                             | Enabled when configured                      | Must avoid health payloads in events.                                                                                                                            |
| Skin/routine profile                  | Goals, sensitivity, pregnancy/trying-to-become-pregnant/breastfeeding status, preferences, quiz answers | Onboarding and post-onboarding private setting | Encrypted local V1 authority; best-effort owner-scoped Supabase mirror          | Supabase when configured and consented                                  | Exact current version/hash health-data grant | Server-only status never clears local safety caution; malformed/unreadable local records are preserved.                                                          |
| Shelf data                            | Product names, roles, tags, opened dates, expiry, replenishment state                                   | User input/scan                                | Supabase/local cache                                                            | Supabase only; no request-time catalog provider                         | User action                                  | Product names can imply health concerns. Barcode/product-interest requests stay inside the OnSkin/Supabase boundary; Open Beauty Facts is offline-artifact-only. |
| Routine data                          | AM/PM steps, sequencing, completions, streaks                                                           | User input/generated routine                   | Supabase/local cache                                                            | Supabase                                                                | User action                                  | Adherence data may be health-adjacent.                                                                                                                           |
| Progress photos                       | Face/skin photos, notes, timestamps, coarse capture-quality metadata                                    | Camera by user action                          | Encrypted local device storage                                                  | No automatic image or metadata upload; explicit single-photo share only | Capture consent; backup unavailable          | Current V1 has no cloud-backup setter or metadata mirror; database provenance remains future server scaffolding.                                                 |
| Native camera inputs                  | Barcode frames, label photo temp files, progress photo temp files                                       | Camera by user action                          | Barcode frames not stored; label temp deleted; progress photo encrypted locally | No sharing by default                                                   | User action                                  | No faceprint, embedding, or tracking ID persisted.                                                                                                               |
| Photo trend state                     | On-device change state, consent, settings                                                               | User opt-in                                    | Local/Supabase consent ledger                                                   | No photo upload by default                                              | Off by default                               | Launch-required; blocked pending real engine, fairness, device, privacy, and legal review.                                                                       |
| Ask OnSkin data                       | Questions, minimized summary, safety-window metadata                                                    | User prompt                                    | Local plus reviewed encrypted safety-audit window for cloud mode                | Cloud model vendor only after consent                                   | Off by default                               | Launch-required; raw photos must never be sent.                                                                                                                  |
| Commerce consent/click data           | Anonymous click token, partner link event                                                               | User opt-in/click                              | Local/Supabase/partner                                                          | Affiliate partner                                                       | Off by default                               | Must not include skin profile/photos.                                                                                                                            |
| Subscription data                     | Entitlement state, product id, renewal state                                                            | Purchase/RevenueCat                            | RevenueCat/Supabase entitlement                                                 | RevenueCat and Apple billing                                            | User action                                  | Billing managed by the App Store.                                                                                                                                |
| Support/deletion/export               | Support messages, deletion/export request metadata                                                      | User action                                    | Supabase function logs/support vendor if used                                   | Support vendor TBD                                                      | User action                                  | Keep support vendor out until processor review.                                                                                                                  |
| Crash/performance telemetry           | Device/app version, stack traces                                                                        | Runtime errors                                 | Sentry if configured                                                            | Sentry                                                                  | Configured by environment                    | Scrub health payloads.                                                                                                                                           |
| Product analytics                     | Events, feature usage                                                                                   | Runtime                                        | PostHog if configured                                                           | PostHog                                                                 | Configured by environment                    | No raw health payloads or photos.                                                                                                                                |

## Phase 5 Native Notes

- Barcode scanning uses on-device camera decode, then calls the OnSkin catalog Edge Function. The function queries only reviewed Supabase catalog rows and returns manual fallback on a miss; it does not call Open Beauty Facts or another catalog recipient. Raw barcode values are not allowed in analytics payloads.
- Label capture stores no label image after the user confirms editable text. Native OCR is disabled until a reviewed ML Kit/Vision module passes device QA.
- Progress photos are encrypted into app-private `.onskinphoto` files using XChaCha20-Poly1305, with the content key in SecureStore. Renderers decrypt to memory for display.
- Photo notes are encrypted before AsyncStorage persistence and are not mirrored to Supabase.
- Native content-key failure is non-destructive: unreadable/missing/malformed keys and authentication failures preserve ciphertext, do not create replacement keys on reads, and block stale empty/default rewrites. Genuine OS key loss remains unrecoverable because V1 has no key escrow or cloud restore.
- Opt-in app lock treats an unreadable encrypted preference as locked, delays app-tree mount until the preference resolves, and requires one foreground-scoped photo-timeline unlock for the Progress tab plus direct capture, review, and detail routes. Leaving the foreground clears that timeline unlock.
- After entitlement/app-lock checks, every data-bearing Progress route blocks its content and photo mutations until the encrypted metadata query succeeds. Read failure exposes shared retry recovery and cannot be interpreted as an empty timeline or missing photo.
- Local photo save performs no automatic Supabase image or metadata write. Startup removes stale backup-enable preferences from builds that exposed the incomplete path.
- Camera QA signals are coarse comparability metadata only. No face template, embedding, identity vector, or tracking ID may be persisted.

## Processor Inventory

The broad vendor inventory below is not the health-withdrawal dispatch list.
The versioned, hash-bound health-purpose classification and retention contract
is
`docs/hugeToDo/HEALTH-CONSENT-WITHDRAWAL-PROCESSOR-RETENTION-MATRIX-2026-07-15.md`,
with its machine-readable source at
`docs/hugeToDo/health-processor-inventory-v1.json`. Version 1 explicitly treats
Supabase as the primary infrastructure processor whose relational and Storage
cleanup happens inside the operation; the separate external-provider
reconciliation array is empty. That narrow empty array must never be described
as "no processor handles health data."

| Processor             | Purpose                                 | Data risk   | Phase 3 status                                                                                                       |
| --------------------- | --------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------- |
| Supabase              | Auth, database, storage, Edge Functions | High        | Needs DPA/config review before launch.                                                                               |
| Apple                 | Sign in, IAP, app distribution          | Medium      | Required platform.                                                                                                   |
| Google                | Optional Google Sign-In on iPhone       | Medium      | Auth purpose only; Google Play is outside this iOS release.                                                          |
| RevenueCat            | Subscription entitlement                | Medium      | Needs deletion/user-id review.                                                                                       |
| PostHog               | Product analytics                       | Medium      | Direct mobile capture is disabled; enabling it requires fresh consent/payload/processor review.                      |
| Sentry                | Scrubbed crash reporting                | Medium      | Stable user identity and health/product/photo context are removed; live payload and retention review remain blocked. |
| Affiliate partner TBD | Paid links                              | Medium/high | Blocked until contract, disclosure, data minimization.                                                               |
| Cloud AI vendor TBD   | Ask cloud mode                          | High        | Blocked until legal, privacy, zero-retention/no-training contract.                                                   |
| Support vendor TBD    | Support requests                        | Medium      | Blocked until processor review.                                                                                      |

## Retention Commitments To Confirm With Counsel

- Account deletion deletes account data and storage through the Supabase Edge Function.
- The non-destructive health-withdrawal source candidate first closes health
  processing, then deletes health-purpose local/Postgres/Storage state while
  preserving Auth, billing, entitlements, and the account. It must not invoke
  account deletion or cancel an App Store subscription. This is not release
  evidence until migration, Edge, mobile, worker, live staging, physical-iPhone,
  processor, backup/restore, and professional-review gates pass.
- Consent ledger and withdrawal-operation receipts need an approved minimized,
  finite retention schedule and purge job. Hosted backup deletion behavior is
  unverified; any Washington-applicable archive/backup delay may not be treated
  as open-ended or as active-store retention.
- Account export wraps server-held user data from `data-export` with every registered encrypted private-data record on the current device. The mobile collector removes shelf/photo file paths, image bytes, thumbnails, note ciphertext, encryption keys, auth credentials, and transient cache files; sanitized Progress metadata and decrypted notes are included when available. Configured backend failure aborts rather than silently omitting account data, while backend-free builds mark the server scope `backend_not_configured`.
- Photos remain encrypted on the current device unless the user explicitly shares one.
- Cloud backup is unavailable in current V1; reserved consent and backend schema do not make it a shipped capability.
- Commerce partner sharing is separate and off by default.
- Ask cloud mode is separate and off by default.
- Telemetry must not include raw health data, product notes, photos, or prompts.

## Required Before Launch

- Final privacy policy.
- Final consumer health data privacy policy/notice.
- Apple privacy nutrition labels.
- Google Data Safety declaration.
- Processor list and DPAs.
- Deletion/export support URLs.
- Incident/breach response owner and runbook.
