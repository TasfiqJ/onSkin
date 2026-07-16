# Phase 6 Payments QA Checklist

## Store Products

- RevenueCat current offering returns annual and monthly packages.
- Prices are localized on iOS. Android product/key/license evidence is not
  applicable while the active launch contract is iOS-only.
- Production build has no Test Store key.
- Missing offering disables purchase and does not grant Pro.

## Purchase

- Annual trial purchase opens native store sheet.
- User-cancelled purchase does not grant Pro.
- Active trial grants Pro only after RevenueCat `CustomerInfo` contains `pro`.
- Paid purchase grants Pro only after RevenueCat `CustomerInfo` contains `pro`.
- Trial reminder is scheduled only for `periodType='trial'`.
- Trial reminder is cancelled after paid conversion.

## Restore

- Restore works on fresh install.
- Restore works after sign-in on a second device using the same Supabase user id.
- Restore with no active subscription does not grant Pro.
- Restored entitlement cache includes `source='revenuecat'`, `verifiedAt`, `managementUrl` when available, product id, store, and renewal state.

## Reverse Trial

- Anonymous/authenticated Supabase user can start exactly one reverse trial.
- Reverse trial uses `store='app_granted'`, `period_type='reverse_trial'`, `will_renew=false`.
- A user with an active paid subscription cannot start a reverse trial.
- A second reverse trial attempt returns a conflict.
- The grant writes only `reverse_trial_grants`; an existing RevenueCat row is
  neither overwritten nor revoked, and both lanes can be active together.
- During the staged RPC rollout, the deprecated four-argument compatibility
  overload preserves but ignores the legacy `p_product_id` argument, writes
  null Store identity through the three-argument implementation, and remains
  callable only by `service_role`.
- Expiry is derived from `reverse_trial_grants.expires_at`; the compatibility
  expiry RPC is a no-op and never mutates RevenueCat state.
- A no-cursor store row is `legacy_unknown`, fails closed, and can exit only
  after the authenticated reconciliation endpoint receives a fresh RevenueCat
  v1 `request_date` snapshot for the JWT-derived account.
- Reconciliation rejects caller subjects/timestamps, stale/camel-case/v2
  timestamps, unknown or `app_granted` provider stores, and equal-watermark
  contradictions.

## Webhook

- Valid HMAC accepted.
- Missing, stale, or mismatched HMAC rejected when signing secret is configured.
- Duplicate `event.id` returns 200 and does not double-process.
- `INITIAL_PURCHASE` and `RENEWAL` activate Pro.
- `CANCELLATION` keeps Pro active but sets `will_renew=false`.
- `EXPIRATION`, `REFUND`, and `SUBSCRIPTION_PAUSED` deactivate Pro.
- Events resolve users by `app_user_id`, `original_app_user_id`, or aliases when those values are Supabase UUIDs.

## Win-Back

- The recorded PAY-01 launch state is tested exactly: no offer configured, or a
  specifically approved native Apple offer.
- For the recommended no-offer launch, eligible and ineligible discovery both
  return unavailable and route to the standard Pro offer without showing a
  discount.
- If an offer is later approved and configured, an eligible user sees the
  native localized offer price and purchase grants Pro only from RevenueCat
  `CustomerInfo`; an ineligible user sees the truthful fallback.
- Android or unsupported OS routes to the standard Pro offer.

## Account Deletion

- Deletion copy says App Store billing continues until the user cancels in the App Store.
- Edge Function uses the configured project and V2 secret key to dispatch the
  exact durable RevenueCat V2 project/customer DELETE request.
- The worker reconciles the complete customer/alias family after dispatch;
  missing, ambiguous, contradictory, or failed provider evidence prevents a
  false success response.
- Support can identify the user with Supabase UUID before deletion.

## Evidence Required For Strict Exit

- Generated `docs/phase-6/generated/payments-qa-packet.md` with `Git status:
clean`, current payment source hashes, current human-E2E manifest hashes,
  final RevenueCat/payment config evidence, and named signoff.
- `EXPO_PUBLIC_REVENUECAT_IOS_KEY=<final appl_ key>`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` is not applicable for the current
  iOS-only launch contract
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=pro`
- `EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID=<final store product id>`
- `EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID=<final store product id>`
- The no-card reverse trial has no Store product ID; its app-granted entitlement
  records `product_id=null`, `offering_id=null`, and `package_id=null`.
- `REVENUECAT_WEBHOOK_AUTH=<32-256 ASCII letters/digits/_/- with at least eight
distinct characters>`
- `REVENUECAT_WEBHOOK_SIGNING_SECRET=<whsec_ plus 32-256 ASCII
letters/digits/_/- with at least eight distinct suffix characters>`
- `REVENUECAT_SECRET_API_KEY=<sk_ plus 20-509 ASCII alphanumerics with at least
eight distinct suffix characters; production legacy V1 reconciliation key>`
- `REVENUECAT_PROJECT_ID=<exact untrimmed proj plus 5-251 ASCII alphanumerics>`
- `REVENUECAT_V2_SECRET_API_KEY=<sk_ plus 20-997 ASCII alphanumerics with at
least eight distinct suffix characters; production V2 customer read/write
key>`
- All four server credentials above come from protected runtime secret storage,
  an untracked local `.env`, or the invoking process. None may be copied into
  `.env.example`, production `eas.json`, another tracked `.env*`, or the client;
  each production value is exact, untrimmed, and non-placeholder.
- `PHASE6_REVENUECAT_V2_ACCESS_EVIDENCE_PATH=<completed redacted repo-relative
JSON copied from docs/phase-6/revenuecat-v2-access-evidence.template.json>`
- The packet hashes that completed JSON and cross-binds its exact non-secret
  project ID, separate lowercase SHA-256 binding fingerprints for the exact
  legacy V1 and V2 keys, named reviewer, and timestamp to configuration and
  Phase 6 signoff. The direct regular non-symlink file is 1-65,536 bytes,
  canonical duplicate-free UTF-8 JSON, committed at and byte-matches HEAD. Its
  exact schema says complete/redacted/production, `reviewedBy` exactly matches
  `PHASE6_SIGNED_OFF_BY`, and it contains neither configured key nor
  secret-shaped reviewer text. `reviewedAt` is no more than seven days old or
  five minutes ahead of the captured check clock.
- Retained redacted evidence records the exact production project and V2 key's
  Bearer-authenticated project-list HTTP 200, V2 customer read-before HTTP 200,
  customer DELETE HTTP 200 or 202, read-after HTTP 404, full-family absence
  reconciliation, plus legacy V1 CustomerInfo HTTP 200. It binds
  `project_configuration:projects:read` and
  `customer_information:customers:read_write`. Key syntax and a boolean flag
  are not proof of access or permissions; neither fingerprint nor the structured
  review record is independent proof. Any authorization error, mismatch,
  missing/tampered artifact, or incomplete observation remains blocking.
- The generated packet shows clean, canonical Git provenance and proves every
  required source, test, manifest, migration, and evidence input is committed
  at and byte-matches HEAD; ignored/untracked/index-hidden inputs fail closed.
- `BRAND_LEGAL_CLEARANCE=cleared`
- `EXPO_PUBLIC_PRIVACY_URL=<production HTTPS URL>`
- `EXPO_PUBLIC_TERMS_URL=<production HTTPS URL>`
- `EXPO_PUBLIC_SUPPORT_URL=<production HTTPS URL>`
- `PHASE6_RC_OFFERING_REVIEWED=true`
- `PHASE6_IOS_SANDBOX_RESTORE_PASS=true`
- `PHASE6_ANDROID_LICENSE_TEST_PASS` is not applicable for the current iOS-only
  launch contract
- `PHASE6_REVENUECAT_V2_CUSTOMER_DELETE_ACCESS_PASS=true` only after the retained
  evidence above was reviewed; this attestation does not itself prove access
- `PHASE6_WEBHOOK_HMAC_TEST_PASS=true`
- `PHASE6_FINANCE_SIGNOFF=true`
- `PHASE6_SIGNED_OFF_BY=<name>`
