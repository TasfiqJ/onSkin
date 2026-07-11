# Store Privacy Inventory Draft

Date: 2026-07-04

This is an engineering draft for Apple App Privacy and Google Play Data Safety.
Counsel must review it against the final policies and actual production
configuration before store submission.

## Data Categories

| Category                   | Current app use                                                                                                  | Shared with                                                         | Notes                                                                                                                                                                                                                                                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Account identifiers        | Supabase user ID, email/Apple/Google auth when linked                                                            | Supabase, Apple/Google auth providers                               | Anonymous-first account exists before sign-in.                                                                                                                                                                                                                                                                     |
| Purchase data              | RevenueCat subscriber/customer info, product ID, entitlement, renewal state                                      | RevenueCat, Apple/Google stores, Supabase entitlement mirror        | App gates on `pro` entitlement; no client writes entitlements.                                                                                                                                                                                                                                                     |
| Product shelf data         | Product names, brands, barcodes, opened dates, PAO/expiry state                                                  | Supabase only if sync/cloud features enabled                        | Manual local-first shelf exists; catalog match sources need final policy.                                                                                                                                                                                                                                          |
| Routine behavior           | AM/PM product-ID order preferences, cycle/ramp choices, and completion history                                  | Encrypted local device; Supabase only if sync writes succeed       | Current-device order preferences are exportable and are removed on account cleanup; cross-device routine sync is not a V1 claim.                                                                                                                                                                                    |
| Health/wellness inferences | Skin profile answers, goals, sensitivities, pregnancy/trying-to-become-pregnant/breastfeeding status if provided | Encrypted local V1 profile; Supabase if account/sync writes succeed | Requires an explicit current version/hash health-data grant in app before personal profile use/write.                                                                                                                                                                                                              |
| Photos                     | Progress photos and coarse capture-quality metadata                                                              | Encrypted local device storage; explicit single-photo share only    | Phase 5 encrypts progress photo files locally. Post-capture face bounds are transient; no face template, landmark set, image, quality verdict, or automatic photo metadata enters analytics/Supabase. Cloud backup is unavailable until encrypted upload, restore, deletion, consent, and device QA ship together. |
| Camera capture             | Barcode frames, label temp photos, progress photo temp files                                                     | Local device by default                                             | Barcode frames are not stored; label temp files are deleted after text confirmation; progress temp files are analyzed locally, a temporary 64 px lighting sample is deleted, and the original temp file is deleted after encryption or discard.                                                                    |
| Usage analytics            | Funnel events, feature events, non-content properties                                                            | PostHog                                                             | Do not send health/photo content. Person deletion must run on account deletion.                                                                                                                                                                                                                                    |
| Crash diagnostics          | Error events, release/build metadata, device/runtime diagnostics                                                 | Sentry                                                              | Config disables default PII, screenshots, view hierarchy, and failed requests.                                                                                                                                                                                                                                     |
| Notifications              | Reminder preferences and local notification schedule                                                             | Local device; Supabase preference mirror if configured              | Physical-device QA still required.                                                                                                                                                                                                                                                                                 |
| Commerce clicks            | Opaque click token and destination metadata if commerce ships                                                    | Commerce rail and Supabase attribution logs                         | No skin/goal/pregnancy/photo fields may leave the app in affiliate URLs.                                                                                                                                                                                                                                           |
| Community/Ask              | Consent-gated participation/audit metadata                                                                       | Supabase if features ship                                           | Cloud Ask remains launch-blocked until vendor/privacy/legal gates clear.                                                                                                                                                                                                                                           |

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

## Current Engineering Safeguards

- Separate env vars for public bundle values versus server secrets.
- Phase 2, Phase 9, Phase 10, and Phase 11 readiness gates reject secret-looking `EXPO_PUBLIC_*` keys and private-looking values assigned to public keys.
- PostHog session replay is disabled.
- Sentry default PII, screenshots, view hierarchy, and failed request capture are
  disabled.
- Supabase RLS smoke script verifies owner-only access before release.
- RevenueCat is bound to Supabase user IDs to preserve entitlement continuity.
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
