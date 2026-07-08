# Phase 6 Payments Runbook

## RevenueCat Setup

Use StoreKit and Google Play subscriptions through RevenueCat only. Do not add web checkout, Stripe, Paddle, or alternate billing in Phase 6.

Required dashboard configuration:

- Entitlement: `pro`
- Products: set final App Store/Play/RevenueCat IDs in
  `EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID` and
  `EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID`; committed `routinekind_*_dev`
  defaults are local placeholders only.
- Current offering: annual and monthly packages present for both iOS and Android
- Annual package: default paywall path, localized store price rendered by SDK
- Monthly package: secondary anchor, localized store price rendered by SDK
- Webhook signing: enabled with `REVENUECAT_WEBHOOK_SIGNING_SECRET`
- Webhook Authorization header: set to `REVENUECAT_WEBHOOK_AUTH` as defense in depth

Production environment:

- `EXPO_PUBLIC_REVENUECAT_IOS_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=pro`
- `EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID`
- `EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID`
- `EXPO_PUBLIC_REVENUECAT_REVERSE_TRIAL_PRODUCT_ID`
- `REVENUECAT_WEBHOOK_SIGNING_SECRET`
- `REVENUECAT_SECRET_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY` blank

Strict QA packets hash the payment runtime files, Supabase payment functions and
migrations, Phase 6 verifier scripts, and shared evidence-normalization helper.
Regenerate `docs/phase-6/generated/payments-qa-packet.md` after changing any of
those inputs. The generated packet must show the source Git SHA and
`Git status: clean`; treat `Git status: DIRTY` as investigation evidence only,
not final payments signoff.

## Entitlement Truth

RevenueCat is the source of truth for store purchases. Supabase mirrors RevenueCat events into `public.entitlements` for fast reads. The mobile AsyncStorage entitlement is a cache only.

Allowed grant sources:

- `source='revenuecat'`: RevenueCat `CustomerInfo` or verified webhook
- `source='app_granted'`: Supabase `subscription-grants` Edge Function for the no-card reverse trial

Forbidden production behavior:

- Local trial grants
- Local paid grants
- Win-back grants without a native eligible offer
- Test Store key in production
- Purchase CTA enabled when the current offering is missing

## Reverse Trial

The no-card reverse trial is granted by `supabase/functions/subscription-grants`.

Rules:

- Authenticated users only
- One grant per user in `reverse_trial_grants`
- 7 days of Pro
- `will_renew=false`
- Never creates a store transaction
- The audit row and `entitlements` mirror write commit atomically through
  `grant_app_granted_reverse_trial()`; a partial failure must not burn the
  user's only no-card trial
- Server expiry via `expire_app_granted_reverse_trials()`

## Webhook Verification

The RevenueCat webhook reads `await req.text()` before JSON parsing. HMAC verification uses:

`X-RevenueCat-Webhook-Signature: t=<unix_timestamp>,v1=<hmac_sha256_hex>`

The signed payload is:

`<timestamp>.<raw_json_body>`

Events are deduped by `event.id`. Unknown events are logged but ignored. Cancellation sets `will_renew=false` and keeps access until expiration; expiration, refund, and pause deactivate access.

## Account Deletion

Account deletion calls:

`DELETE https://api.revenuecat.com/v1/subscribers/{app_user_id}`

This deletes RevenueCat customer data. It does not cancel Apple or Google subscriptions. The mobile deletion copy must continue to say that billing continues until the user cancels in the store.

## Seven-Figure Check

At a $49.99 annual plan, $1,000,000 gross ARR requires 20,005 active annual subscribers before store fees, tax, refunds, and churn. A 1 percent entitlement bug at that scale can deny or leak roughly $10,000 gross ARR, so payment correctness is a revenue feature, not infrastructure polish.
