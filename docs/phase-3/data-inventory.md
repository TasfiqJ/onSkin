# Data Inventory

Status: working inventory, not legal-cleared  
Last updated: 2026-07-04

This inventory must match Apple privacy labels, Google Data Safety, the privacy policy, consumer health data notice, internal processor review, and support deletion/export workflows.

## Current Data Categories

| Category                              | Examples                                                              | Source                       | Storage                                       | Shared with                               | Default                      | Notes                                            |
| ------------------------------------- | --------------------------------------------------------------------- | ---------------------------- | --------------------------------------------- | ----------------------------------------- | ---------------------------- | ------------------------------------------------ |
| Account identifiers                   | Email, auth user id, provider id                                      | Sign in                      | Supabase Auth                                 | Supabase, Apple/Google auth as applicable | User action                  | Required for account sync.                       |
| Anonymous install/session identifiers | Anonymous user id, device/session ids                                 | Guest/session                | Local storage, analytics if configured        | PostHog/Sentry when enabled               | Enabled when configured      | Must avoid health payloads in events.            |
| Skin/routine profile                  | Goals, sensitivity, pregnancy flag, preferences, quiz answers         | Onboarding                   | Supabase tables/local state                   | Supabase                                  | Requires health-data consent | Consumer health data risk.                       |
| Shelf data                            | Product names, roles, tags, opened dates, expiry, replenishment state | User input/scan              | Supabase/local cache                          | Supabase                                  | User action                  | Product names can imply health concerns.         |
| Routine data                          | AM/PM steps, sequencing, completions, streaks                         | User input/generated routine | Supabase/local cache                          | Supabase                                  | User action                  | Adherence data may be health-adjacent.           |
| Progress photos                       | Face/skin photos, notes, timestamps                                   | Camera/upload by user        | Local device by default                       | No sharing by default                     | Off cloud by default         | Cloud backup separate opt-in only.               |
| Native camera inputs                  | Barcode frames, label photo temp files, progress photo temp files      | Camera by user action        | Barcode frames not stored; label temp deleted; progress photo encrypted locally | No sharing by default                     | User action                  | No faceprint, embedding, or tracking ID persisted. |
| Photo trend state                     | On-device change state, consent, settings                             | User opt-in                  | Local/Supabase consent ledger                 | No photo upload by default                | Off by default               | Public V1 blocked pending fairness/legal review. |
| Ask OnSkin data                       | Questions, minimized summary, safety-window metadata                  | User prompt                  | Local; cloud mode deferred                    | Cloud model vendor only after consent     | Off by default               | Raw photos must never be sent.                   |
| Commerce consent/click data           | Anonymous click token, partner link event                             | User opt-in/click            | Local/Supabase/partner                        | Affiliate partner                         | Off by default               | Must not include skin profile/photos.            |
| Subscription data                     | Entitlement state, product id, renewal state                          | Purchase/RevenueCat          | RevenueCat/Supabase entitlement               | RevenueCat, Apple/Google billing          | User action                  | Billing managed by app stores.                   |
| Support/deletion/export               | Support messages, deletion/export request metadata                    | User action                  | Supabase function logs/support vendor if used | Support vendor TBD                        | User action                  | Keep support vendor out until processor review.  |
| Crash/performance telemetry           | Device/app version, stack traces                                      | Runtime errors               | Sentry if configured                          | Sentry                                    | Configured by environment    | Scrub health payloads.                           |
| Product analytics                     | Events, feature usage                                                 | Runtime                      | PostHog if configured                         | PostHog                                   | Configured by environment    | No raw health payloads or photos.                |

## Phase 5 Native Notes

- Barcode scanning uses on-device camera decode, then calls the OnSkin catalog Edge Function; raw barcode values are not allowed in analytics payloads.
- Label capture stores no label image after the user confirms editable text. Native OCR is disabled until a reviewed ML Kit/Vision module passes device QA.
- Progress photos are encrypted into app-private `.onskinphoto` files using XChaCha20-Poly1305, with the content key in SecureStore. Renderers decrypt to memory for display.
- Photo notes are encrypted before AsyncStorage persistence and are not mirrored to Supabase.
- Camera QA signals are coarse comparability metadata only. No face template, embedding, identity vector, or tracking ID may be persisted.

## Processor Inventory

| Processor             | Purpose                                 | Data risk   | Phase 3 status                                                     |
| --------------------- | --------------------------------------- | ----------- | ------------------------------------------------------------------ |
| Supabase              | Auth, database, storage, Edge Functions | High        | Needs DPA/config review before launch.                             |
| Apple                 | Sign in, IAP, app distribution          | Medium      | Required platform.                                                 |
| Google                | Sign in, Play billing/distribution      | Medium      | Required platform for Android.                                     |
| RevenueCat            | Subscription entitlement                | Medium      | Needs deletion/user-id review.                                     |
| PostHog               | Product analytics                       | Medium      | Must avoid health payloads and configure deletion.                 |
| Sentry                | Crash reporting                         | Medium      | Must scrub PII/health payloads and configure retention.            |
| Affiliate partner TBD | Paid links                              | Medium/high | Blocked until contract, disclosure, data minimization.             |
| Cloud AI vendor TBD   | Ask cloud mode                          | High        | Blocked until legal, privacy, zero-retention/no-training contract. |
| Support vendor TBD    | Support requests                        | Medium      | Blocked until processor review.                                    |

## Retention Commitments To Confirm With Counsel

- Account deletion deletes account data and storage through the Supabase Edge Function.
- Health-data consent withdrawal records withdrawal then deletes collected health data/account.
- Export returns user data through the `data-export` Edge Function.
- Photos remain on device by default.
- Cloud backup is separate and off by default.
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
