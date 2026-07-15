# Phase 6 Payments QA Checklist

## Store Products

- RevenueCat current offering returns annual and monthly packages.
- Prices are localized on iOS and Android.
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

- Deletion copy says Apple or Google billing continues until store cancellation.
- Edge Function calls RevenueCat customer deletion with secret API key.
- RevenueCat deletion failure prevents a false success response.
- Support can identify the user with Supabase UUID before deletion.

## Evidence Required For Strict Exit

- Generated `docs/phase-6/generated/payments-qa-packet.md` with `Git status:
clean`, current payment source hashes, current human-E2E manifest hashes,
  final RevenueCat/payment config evidence, and named signoff.
- `EXPO_PUBLIC_REVENUECAT_IOS_KEY=<final appl_ key>`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=<final goog_ key>`
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=pro`
- `EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID=<final store product id>`
- `EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID=<final store product id>`
- The no-card reverse trial has no Store product ID; its app-granted entitlement
  records `product_id=null`, `offering_id=null`, and `package_id=null`.
- `REVENUECAT_WEBHOOK_AUTH=<production shared auth>`
- `REVENUECAT_WEBHOOK_SIGNING_SECRET=<production signing secret>`
- `REVENUECAT_SECRET_API_KEY=<production secret API key>`
- `BRAND_LEGAL_CLEARANCE=cleared`
- `EXPO_PUBLIC_PRIVACY_URL=<production HTTPS URL>`
- `EXPO_PUBLIC_TERMS_URL=<production HTTPS URL>`
- `EXPO_PUBLIC_SUPPORT_URL=<production HTTPS URL>`
- `PHASE6_RC_OFFERING_REVIEWED=true`
- `PHASE6_IOS_SANDBOX_RESTORE_PASS=true`
- `PHASE6_ANDROID_LICENSE_TEST_PASS=true`
- `PHASE6_WEBHOOK_HMAC_TEST_PASS=true`
- `PHASE6_FINANCE_SIGNOFF=true`
- `PHASE6_SIGNED_OFF_BY=<name>`
