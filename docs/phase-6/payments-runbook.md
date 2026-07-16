# Phase 6 Payments Runbook

## RevenueCat Setup

Use StoreKit and Google Play subscriptions through RevenueCat only. Do not add web checkout, Stripe, Paddle, or alternate billing in Phase 6.

Required dashboard configuration:

- Entitlement: `pro`
- Products: set final App Store/Play/RevenueCat IDs in
  `EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID` and
  `EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID`; committed `routinekind_*_dev`
  defaults are local placeholders only.
- Current offering: annual and monthly packages present for iOS. Android
  products, keys, and license-test evidence are not launch requirements while
  `docs/hugeToDo/launch-contract.json` remains iOS-only.
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
- `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` only when Android becomes a
  contract-required release platform
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=pro`
- `EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID`
- `EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID`
- `REVENUECAT_WEBHOOK_AUTH`, a 32-256 character ASCII letters/digits/\_/- shared
  value with at least eight distinct characters
- `REVENUECAT_WEBHOOK_SIGNING_SECRET`, `whsec_` plus a 32-256 character ASCII
  letters/digits/\_/- suffix with at least eight distinct characters
- `REVENUECAT_SECRET_API_KEY` for authenticated legacy V1 CustomerInfo
  reconciliation; `sk_` plus 20-509 ASCII alphanumerics with at least eight
  distinct suffix characters
- `REVENUECAT_PROJECT_ID` for the durable account-deletion project binding
  (`proj` plus 5-251 ASCII alphanumerics)
- `REVENUECAT_V2_SECRET_API_KEY` for durable REST API V2 customer deletion and
  full-family reconciliation; `sk_` plus 20-997 ASCII alphanumerics with at
  least eight distinct suffix characters; the legacy V1 key is not a fallback
- `PHASE6_REVENUECAT_V2_ACCESS_EVIDENCE_PATH` naming one completed, redacted,
  repo-relative JSON copied from
  `docs/phase-6/revenuecat-v2-access-evidence.template.json`
- `PHASE6_REVENUECAT_V2_CUSTOMER_DELETE_ACCESS_PASS=true` only after a reviewer
  retains redacted production evidence that the exact project and V2 key
  authenticated successfully and the key has the reviewed customer-delete
  permission. The flag records that review; it does not prove access by itself.
- `EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY` blank

All four server credentials above are read only from protected runtime secret
storage, an untracked local `.env`, or the invoking process. The checker rejects
a non-placeholder copy in tracked `.env.example` or production `eas.json`, and
strict provenance rejects any tracked secret `.env*` file other than the
placeholder-only `.env.example`. Every production credential must be exact,
untrimmed, and non-placeholder. Never put these values in the mobile bundle.

Strict QA packets hash the complete local TypeScript/TSX dependency and sibling
test closure for the subscription, IAP, RevenueCat webhook, subscription-grant,
subscription-reconciliation, and order-report-poll roots; the complete durable
account-deletion dependency/test closure; every payment/deletion/entitlement
migration named by the builder; root/mobile build manifests; the completed
redacted RevenueCat access-evidence JSON; Phase 6 verifier scripts; the shared
evidence-normalization helper; and the human-simulated E2E rules/tree/manifest.
The source contract also pins canonical SHA-256 bytes for the four reviewed
entrypoint/runtime/executor/provider modules before applying its AST invariants.
Regenerate
`docs/phase-6/generated/payments-qa-packet.md` after changing any of those
inputs. The generated packet must show the source Git SHA and `Git status:
clean`; `DIRTY` and `UNAVAILABLE` are blocking investigation states, not final
payments signoff. Every required input must be tracked at and byte-match HEAD;
ignored, untracked, assume-unchanged, skip-worktree, and submodule changes fail
closed. Only the packet's own two generated outputs are excluded from status.

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

Account deletion uses the durable work lane to attest the configured RevenueCat
project and the complete customer/alias family before dispatching:

`DELETE https://api.revenuecat.com/v2/projects/{project_id}/customers/{customer_id}`

RevenueCat REST API V2 uses `Authorization: Bearer <sk_...>`. The exact
production key must retain `project_configuration:projects:read` for the
runtime's project attestation and
`customer_information:customers:read_write` for the customer DELETE. The
committed `proj` + ASCII-alphanumeric project-ID and `sk_` secret-key checks are
syntax gates only; they do not prove that the project exists, that the key is
bound to it, or that either permission is granted. Retain redacted provider
evidence for the exact production project/key and reviewed disposable-customer
exercise before setting the Phase 6 access flag. A successful Bearer project
list plus customer read/delete/full-family absence sequence must be recorded;
an authorization error or project mismatch blocks completion.

Copy the committed template to
`docs/phase-6/revenuecat-v2-access-evidence.<release>.json`, set `status` to
`complete`, and record only redacted response facts. Its project ID must
exactly match `REVENUECAT_PROJECT_ID`; its two lowercase SHA-256 binding
fingerprints must be computed locally from the exact high-entropy legacy V1 and
V2 `sk_` values. Record project-list HTTP 200, V2 customer read-before HTTP 200,
DELETE HTTP 200 or 202, read-after HTTP 404, full-family absence reconciliation,
and legacy V1 CustomerInfo HTTP 200. The artifact must be a direct regular
non-symlink file of 1-65,536 bytes, valid canonical duplicate-free UTF-8 JSON,
be committed at and byte-match HEAD, and contain neither configured key nor
secret-shaped reviewer text. Its exact schema must identify a completed,
redacted, production RevenueCat record, and `reviewedBy` must exactly match
`PHASE6_SIGNED_OFF_BY`; tainted reviewer text is rejected and never emitted.

The packet hashes this JSON and records the non-secret project ID, both
fingerprints, named reviewer, and timestamp. `reviewedAt` must be no more than
seven days before the packet's captured clock and no more than five minutes in
its future; rotation, permission changes, or an older exercise requires fresh
evidence. Neither a fingerprint, the structured record, nor the boolean flag
independently proves provider access; they bind the retained human-reviewed
evidence to the configuration. Never place either secret key in the evidence
file or packet. See RevenueCat's
[API authentication](https://www.revenuecat.com/docs/projects/authentication)
and [V2 customer DELETE](https://www.revenuecat.com/docs/api-v2) references.

The mutation is write-ahead recorded and is never treated as terminal success.
The worker performs bounded V2 customer and alias reconciliation and requires
the database deletion barrier's full-family absence observations before the
operation can complete. Missing, ambiguous, or contradictory provider evidence
fails closed for retry or operator action. RevenueCat deletion does not cancel
an App Store subscription; the mobile copy must continue to say that billing
continues until the user cancels in the App Store.

## Seven-Figure Check

At a $49.99 annual plan, $1,000,000 gross ARR requires 20,005 active annual subscribers before store fees, tax, refunds, and churn. A 1 percent entitlement bug at that scale can deny or leak roughly $10,000 gross ARR, so payment correctness is a revenue feature, not infrastructure polish.
