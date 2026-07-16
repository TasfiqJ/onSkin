# Store Privacy Inventory Draft

Date: 2026-07-04

This is an engineering draft for Apple App Privacy and Google Play Data Safety.
Counsel must review it against the final policies and actual production
configuration before store submission.

## iOS Privacy Source Evidence Boundary

The 2026-07-16 deterministic installed-source audit reports
`archive_required`: 63 native npm packages, 14/14 source-valid privacy
manifests, 14 manifest-resource source bindings still requiring archive
verification, 139 podspecs, 16 XCFramework candidates, no standalone framework
or `.a`/`.dylib` candidates, ten exact Apple SDK-list intersections, zero
errors, and 15 warnings. It also verifies the exact-hash repair for the invalid
empty `NSPrivacyAccessedAPITypes` array in the reviewed
`react-native-view-shot` source.

This result is an engineering input to this inventory, not a store answer. Ruby
podspec tokens are source candidates rather than evaluated CocoaPods or archive
proof. The audit excludes first-party/linked source, generated Expo prebuild,
resolved CocoaPods/SPM output, and the production archive; first-party sources
have separate validators and the other surfaces remain gates.

Before App Privacy answers are completed, reconcile the exact production
`.xcarchive`, build identity/hash, resolved `Podfile.lock`/SPM record, merged
privacy report, manifest and required-API ledgers, SDK signatures,
signing/entitlements/symbols/processing results, and observed network/storage
behavior to every category, purpose, linkage, tracking, sharing, and retention
answer. Named privacy/legal and supported-device signoffs must reference that
same release evidence and the final published URLs. Source-valid does not mean
archive-valid, label-complete, legally compliant, Apple-approved, or
commercially successful.

## Data Categories

| Category                   | Current app use                                                                                                                                                                        | Shared with                                                         | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account identifiers        | Supabase user ID, email/Apple/Google auth when linked                                                                                                                                  | Supabase, Apple/Google auth providers                               | Anonymous-first account exists before sign-in.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Purchase data              | RevenueCat subscriber/customer info, product ID, entitlement, renewal state                                                                                                            | RevenueCat, Apple/Google stores, Supabase entitlement mirror        | App gates on `pro` entitlement; no client writes entitlements.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Local store-safety journal | Domain-separated owner binding, state (`in_flight` or `unconfirmed`), reason (`completion_unconfirmed` or `payment_pending`), creation timestamp, and payment-pending review timestamp | Local device only                                                   | Contains no raw Auth/RevenueCat/StoreKit user ID, product, action, acknowledgement, receipt, order, or transaction ID and is excluded from account-private cleanup so a possible charge cannot be silently forgotten. Generic exact-owner records remain until verified recovery or terminal deletion. Payment-pending records have an original-timestamp-anchored 30-day review marker that never clears checkout from device time alone. Terminal deletion replaces a matching exact record with one ownerless bit containing only fresh `kind`, `createdAt`, and `expiresAt`; that field is also a review marker rather than an automatic retention maximum. Foreign UI collapses all detail to one generic device-safety state. Resolution-bound retention and disclosure require counsel approval. |
| Product shelf data         | Product names, brands, barcodes, opened dates, PAO/expiry state                                                                                                                        | Supabase only if sync/cloud features enabled                        | Manual local-first shelf exists; catalog match sources need final policy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Routine behavior           | AM/PM product-ID order preferences, cycle/ramp choices, and completion history                                                                                                         | Encrypted local device; Supabase only if sync writes succeed        | Current-device order preferences are exportable and are removed on account cleanup; cross-device routine sync is not a V1 claim.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Health/wellness inferences | Skin profile answers, goals, sensitivities, pregnancy/trying-to-become-pregnant/breastfeeding status if provided                                                                       | Encrypted local V1 profile; Supabase if account/sync writes succeed | Requires an explicit current version/hash health-data grant in app before personal profile use/write.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Photos                     | Progress photos and coarse capture-quality metadata                                                                                                                                    | Encrypted local device storage; explicit single-photo share only    | Phase 5 encrypts progress photo files locally. Post-capture face bounds are transient; no face template, landmark set, image, quality verdict, or automatic photo metadata enters analytics/Supabase. Cloud backup is unavailable until encrypted upload, restore, deletion, consent, and device QA ship together.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Camera capture             | Barcode frames, label temp photos, progress photo temp files                                                                                                                           | Local device by default                                             | Barcode frames are not stored; label temp files are deleted after text confirmation; progress temp files are analyzed locally, a temporary 64 px lighting sample is deleted, and the original temp file is deleted after encryption or discard.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Usage analytics            | Funnel events, feature events, non-content properties                                                                                                                                  | PostHog                                                             | Do not send health/photo content. Person deletion must run on account deletion.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Crash diagnostics          | Error events, release/build metadata, device/runtime diagnostics                                                                                                                       | Sentry                                                              | Config disables default PII, screenshots, view hierarchy, and failed requests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Notifications              | Reminder preferences and local notification schedule                                                                                                                                   | Local device; Supabase preference mirror if configured              | Physical-device QA still required.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Commerce clicks            | Opaque click token and destination metadata if commerce ships                                                                                                                          | Commerce rail and Supabase attribution logs                         | No skin/goal/pregnancy/photo fields may leave the app in affiliate URLs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Community/Ask              | Consent-gated participation/audit metadata                                                                                                                                             | Supabase if features ship                                           | Cloud Ask remains launch-blocked until vendor/privacy/legal gates clear.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## Store Review Inputs Needed

- Final privacy policy URL.
- Final consumer health data privacy policy URL, if separate.
- Terms URL.
- Support URL.
- Account deletion instructions URL.
- Data export instructions URL.
- In-app account export scope copy describes the combined account/device scope. The mobile JSON wrapper includes every registered local private-data record plus owner-scoped server data, while its `local_media_note` and the server JSON `local_only_photo_note` disclose that device-only Progress image files/thumbnails are excluded. Sanitized local Progress metadata and decrypted notes are included when available; any server-side `photos` rows remain separately covered.
- Plain-English data retention/deletion policy.
- Confirmation that analytics/crash tools do not collect sensitive content.
- Confirmation that current V1 photos are device-only unless the user explicitly
  shares one; cloud backup and automatic photo-metadata sync are unavailable.
- Counsel-approved disclosure and retention basis for the device-only store
  safety journal, including its pseudonymous owner binding, generic-record
  recovery retention, resolution-bound payment-pending/ownerless records, and
  device-clock 30-day review markers.

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

## Open Legal Questions

- Which jurisdictions are in launch scope.
- Whether the final policy set needs a standalone consumer health data policy.
- Whether any analytics event counts as consumer health data under launch-state
  laws.
- Whether product shelf, ingredient concerns, and pregnancy status require
  additional consent wording beyond current in-app consent.
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
