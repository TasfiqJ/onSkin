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

Launch win-back posture follows the approved PAY-01 commercial state. The
current recommendation is **no win-back offer configured at launch**: discovery
must return unavailable and route to the standard Pro offer without inventing a
discount. If a later founder-approved native Apple win-back offer is enabled,
reopen PAY-08 and verify eligibility, localized price, purchase, renewal, and
fallback on supported iOS versions before release.

Production environment:

- `EXPO_PUBLIC_REVENUECAT_IOS_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=pro`
- `EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID`
- `EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID`
- `REVENUECAT_WEBHOOK_SIGNING_SECRET`
- `REVENUECAT_SECRET_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY` blank

Strict QA packets hash the payment runtime files, lifecycle paywall routes,
subscription contract tests, Supabase payment functions and migrations, Phase 6
verifier scripts, shared evidence-normalization helper, and the
human-simulated E2E rules/tree/manifest. Regenerate
`docs/phase-6/generated/payments-qa-packet.md` after changing any of those
inputs. The generated packet must show the source Git SHA and `Git status:
clean`; treat `Git status: DIRTY` as investigation evidence only, not final
payments signoff.

## Entitlement Truth

RevenueCat is the source of truth for store purchases. Supabase mirrors only
RevenueCat authority into `public.entitlements`; the one-time local reverse
trial remains in `public.reverse_trial_grants`. Authenticated clients call the
no-argument `read_entitlement_projections()` RPC, which derives `auth.uid()` and
returns both lanes in one schema-versioned object. The mobile AsyncStorage
entitlement is a cache only.

Allowed grant sources:

- `source='revenuecat'`: RevenueCat `CustomerInfo` or verified webhook
- `source='app_granted'`: normalized read output derived from the durable
  `reverse_trial_grants` row; it is never persisted over the RevenueCat row

Forbidden production behavior:

- Local trial grants
- Local paid grants
- Client E2E entitlement fixtures or artificial entitlement delays outside
  development builds
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
- `product_id`, `offering_id`, and `package_id` are null; no App Store Connect or
  RevenueCat product or package represents this grant
- `grant_app_granted_reverse_trial()` inserts only `reverse_trial_grants`; it
  never inserts, updates, expires, or revokes `public.entitlements`
- The compatibility return still has the historical entitlement row shape, but
  every RevenueCat-only event, transaction, store-user, offering, package, and
  cursor identifier is null
- A deprecated four-argument server-only RPC overload temporarily ignores its
  legacy `p_product_id` argument and delegates to the null-enforcing
  three-argument RPC so database-first deployment cannot break the previously
  deployed Edge caller. Remove the overload only after hosted evidence proves
  all callers use the three-argument signature.
- Expiry is derived from the immutable grant window. The old
  `expire_app_granted_reverse_trials()` entry point is a rolling-deploy no-op.

Historical store rows with no trustworthy provider cursor fail closed as
`legacy_unknown`. The authenticated `subscription-reconciliation` Edge Function
accepts no caller fields, fetches bounded RevenueCat v1 CustomerInfo for the
JWT-derived user, requires a fresh provider `request_date`, and invokes the
service-only snapshot RPC. It never substitutes Edge/database processing time.

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
