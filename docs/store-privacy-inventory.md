# Store Privacy Inventory Draft

Date: 2026-07-04

This is an engineering draft for Apple App Privacy and Google Play Data Safety.
Counsel must review it against the final policies and actual production
configuration before store submission.

## Data Categories

| Category | Current app use | Shared with | Notes |
| --- | --- | --- | --- |
| Account identifiers | Supabase user ID, email/Apple/Google auth when linked | Supabase, Apple/Google auth providers | Anonymous-first account exists before sign-in. |
| Purchase data | RevenueCat subscriber/customer info, product ID, entitlement, renewal state | RevenueCat, Apple/Google stores, Supabase entitlement mirror | App gates on `pro` entitlement; no client writes entitlements. |
| Product shelf data | Product names, brands, barcodes, opened dates, PAO/expiry state | Supabase only if sync/cloud features enabled | Manual local-first shelf exists; catalog match sources need final policy. |
| Health/wellness inferences | Skin profile answers, goals, sensitivities, pregnancy/breastfeeding status if provided | Supabase if account/sync writes succeed | Requires explicit health-data consent in app. |
| Photos | Progress photos and quality metadata | Local device by default | Phase 5 encrypts progress photo files locally; cloud backup must stay off unless explicit consent and backup encryption are live. |
| Camera capture | Barcode frames, label temp photos, progress photo temp files | Local device by default | Barcode frames are not stored; label temp files are deleted after text confirmation; progress temp files are deleted after encryption. |
| Usage analytics | Funnel events, feature events, non-content properties | PostHog | Do not send health/photo content. Person deletion must run on account deletion. |
| Crash diagnostics | Error events, release/build metadata, device/runtime diagnostics | Sentry | Config disables default PII, screenshots, view hierarchy, and failed requests. |
| Notifications | Reminder preferences and local notification schedule | Local device; Supabase preference mirror if configured | Physical-device QA still required. |
| Commerce clicks | Opaque click token and destination metadata if commerce ships | Commerce rail and Supabase attribution logs | No skin/goal/pregnancy/photo fields may leave the app in affiliate URLs. |
| Community/Ask | Consent-gated participation/audit metadata | Supabase if features ship | Cloud Ask remains launch-blocked until vendor/privacy/legal gates clear. |

## Store Review Inputs Needed

- Final privacy policy URL.
- Final consumer health data privacy policy URL, if separate.
- Terms URL.
- Support URL.
- Account deletion instructions URL.
- Data export instructions URL.
- Plain-English data retention/deletion policy.
- Confirmation that analytics/crash tools do not collect sensitive content.
- Confirmation that photos are local-only unless cloud backup is explicitly live
  and consented.

## Current Engineering Safeguards

- Separate env vars for public bundle values versus server secrets.
- `scripts/phase2/check-env.mjs` rejects secret-looking `EXPO_PUBLIC_*` keys and private-looking values assigned to public keys.
- PostHog session replay is disabled.
- Sentry default PII, screenshots, view hierarchy, and failed request capture are
  disabled.
- Supabase RLS smoke script verifies owner-only access before release.
- RevenueCat is bound to Supabase user IDs to preserve entitlement continuity.
- Native photo files are encrypted locally with authenticated encryption before storage.
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
