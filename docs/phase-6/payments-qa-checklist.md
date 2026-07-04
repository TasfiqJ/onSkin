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
- `expire_app_granted_reverse_trials()` deactivates expired reverse trials.

## Webhook

- Valid HMAC accepted.
- Missing, stale, or mismatched HMAC rejected when signing secret is configured.
- Duplicate `event.id` returns 200 and does not double-process.
- `INITIAL_PURCHASE` and `RENEWAL` activate Pro.
- `CANCELLATION` keeps Pro active but sets `will_renew=false`.
- `EXPIRATION`, `REFUND`, and `SUBSCRIPTION_PAUSED` deactivate Pro.
- Events resolve users by `app_user_id`, `original_app_user_id`, or aliases when those values are Supabase UUIDs.

## Win-Back

- Eligible iOS win-back offer displays native offer price.
- Ineligible users do not see a fake discount.
- Android or unsupported OS routes to the standard Pro offer.

## Account Deletion

- Deletion copy says Apple or Google billing continues until store cancellation.
- Edge Function calls RevenueCat customer deletion with secret API key.
- RevenueCat deletion failure prevents a false success response.
- Support can identify the user with Supabase UUID before deletion.

## Evidence Required For Strict Exit

- `PHASE6_RC_OFFERING_REVIEWED=true`
- `PHASE6_IOS_SANDBOX_RESTORE_PASS=true`
- `PHASE6_ANDROID_LICENSE_TEST_PASS=true`
- `PHASE6_WEBHOOK_HMAC_TEST_PASS=true`
- `PHASE6_FINANCE_SIGNOFF=true`
- `PHASE6_SIGNED_OFF_BY=<name>`
