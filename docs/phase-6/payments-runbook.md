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
RevenueCat authority into `public.entitlements`; the one-time server app grant
remains in `public.reverse_trial_grants`. Authenticated clients call the
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
- Client-created reverse-trial entitlements in every environment
- Positive entitlement fixtures or artificial entitlement delays in the
  shared/default/native module; the only permitted positive visual fixture is
  the platform-resolved Expo web development module
- `NOT_REQUESTED` RevenueCat data admitted as positive entitlement evidence
- Direct or stale `/paywall/success` navigation treated as proof of a purchase,
  trial, renewal, price, expiry, or Pro unlock; cached, pending, failed, expired,
  stale-verification, or incomplete-authority data must show recovery
- Win-back grants without a native eligible offer
- Test Store key in production
- Purchase CTA enabled when the current offering is missing

## Custom App Grant (disabled in the iOS release candidate)

Production/staging app configuration rejects the custom full-Pro grant flag,
onboarding exposes a real free-plan continuation instead, contextual grant UI is
development-only and explicit, and the runtime refuses the grant before any
network call unless that development exception is active. The Edge Function
also refuses before authentication unless `APP_ENV=development` and
`SUPABASE_URL` is an exact HTTP loopback origin with an explicit port. Hosted
Supabase URLs are denied even if their environment is mislabeled development.
The retained backend authority is therefore dormant future-exception code, not
an active hosted release mechanism.

If a separately reviewed future exception is pursued,
`supabase/functions/subscription-grants` remains the only grant authority and
must satisfy all rules below:

Rules:

- Authenticated users only
- Edge runtime is explicitly development and bound to an exact HTTP loopback
  Supabase origin with an explicit port; production, staging, hosted,
  malformed, credential-bearing, path-bearing, and non-loopback URLs fail
  closed before authentication or service-role work
- Supabase must be configured and the exact server response must be accepted;
  the client never fabricates or persists a fallback grant
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

RevenueCat `VERIFIED` evidence is definitive. `VERIFIED_ON_DEVICE` remains a
positive-only provisional lane and cannot advance an empty/inactive watermark.
`FAILED` and `NOT_REQUESTED` are rejected. RevenueCat provider promotions retain
the `promotional` store lane and never become `app_granted` authority. Here
`promotional` means a RevenueCat-granted out-of-store, non-billing entitlement;
it is not an Apple/StoreKit promotional offer and never supports a purchase,
price, conversion, or renewal claim.

### Trusted Entitlements operational gate

The exact production build must keep RevenueCat response-signature verification
enabled before it can admit store access. Current RevenueCat SDKs enable Trusted
Entitlements by default, and this app also explicitly configures informational
verification; this is an SDK/build control, not a claimed dashboard switch.
Retain the exact SDK/version/configuration evidence and sandbox/TestFlight
purchase plus Restore artifacts showing `VERIFIED` or `VERIFIED_ON_DEVICE` for
the exact app user, product, build, and timestamp. Exercise invalid verification
and cache invalidation behavior. `NOT_REQUESTED` means verification was not
requested and is deliberately denied; a source-only rejection test does not
prove the signed candidate runs the expected path. If verification is
unavailable or fails, keep Pro closed, show recovery, preserve the transaction
journal, and direct the user to Restore or support without offering another
charge.

Create the retained record from
`docs/phase-6/revenuecat-trusted-entitlements-evidence.template.json`, then set
`PHASE6_REVENUECAT_TRUSTED_ENTITLEMENTS_EVIDENCE_PATH` to that committed
repo-relative file. Set
`PHASE6_REVENUECAT_TRUSTED_ENTITLEMENTS_SOURCE_GIT_SHA` to the full immutable Git
commit used to build the reviewed binary. That commit must exist locally and be
an ancestor of the later packet/evidence HEAD. The gate reads `revenuecat.ts`
and `package-lock.json` from the source commit, derives the configured
`INFORMATIONAL` mode and installed SDK version, and compares those values to the
record. This source commit intentionally predates the commit that adds evidence;
binding the record to its own containing HEAD would be self-referential. The
commit range from reviewed source through packet HEAD may contain only
added/modified governed Trusted Entitlements records/artifacts and Phase 6
generated packet outputs. Any deletion, rename, or unrelated source/docs change
requires a new reviewed build and source commit.

For each sandbox/TestFlight purchase and Restore observation, retain one
separate redacted source artifact under
`docs/phase-6/revenuecat-trusted-entitlements-artifacts/<release>/` and record its
repo-relative path and SHA-256 in the observation. Use four unique direct regular
non-symlink files; the validator hashes their actual bytes, while the packet
requires the record and all four artifacts to be committed and byte-equal to
packet HEAD. Purchase and Restore within an environment must bind the same
app-user ID hash and product. Hash app-user IDs with SHA-256 and redact raw IDs,
tokens, receipts, and secrets from retained logs/screenshots. The gate decodes
text/JSON/log artifacts as UTF-8 and rejects secret-like, control-character, and
placeholder content; binary screenshots remain subject to reviewer redaction.
Observations and review must be no more than 30 days old.
`PHASE6_REVENUECAT_TRUSTED_ENTITLEMENTS_PASS=true` is only a review attestation
and cannot replace the record or its four retained source artifacts.

Before showing any free-trial language, the iOS client also calls RevenueCat's
per-product introductory-offer eligibility API. Only exact `ELIGIBLE` results
may expose trial duration/copy; unknown, ineligible, no-offer, and failed checks
must show ordinary subscription checkout language.

### Apple classification gate for the custom app grant

The server-only boundary prevents a compromised or misconfigured client from
minting Pro; it does not establish that the underlying custom no-card Pro grant
is acceptable for App Store distribution. Apple App Review Guideline 3.1.1
requires in-app purchase for feature/functionality unlocks, while 3.1.2 and App
Store Connect define introductory free trials for auto-renewable subscriptions.
The current iOS release candidate uses the StoreKit subscription path (including
an Apple-managed introductory offer when configured) and disables the custom
grant. If a future exception is pursued, record qualified counsel analysis, any
Apple correspondence, and separately reviewed server-verified App
Attest/DeviceCheck, cross-account/device
eligibility, replay resistance, and rate limits. Counsel and correspondence are
inputs, not App Review approval or a guarantee. Only Apple's acceptance of the
exact submitted build for App Store distribution with that mechanism present
resolves this gate; fraud controls do not resolve the payment-policy question.

References: [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/),
[Apple introductory offers](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-introductory-offers-for-auto-renewable-subscriptions/),
[Expo platform-specific modules](https://docs.expo.dev/router/advanced/platform-specific-modules/),
[Expo environment variables](https://docs.expo.dev/guides/environment-variables/), and
[RevenueCat Trusted Entitlements](https://www.revenuecat.com/docs/customers/trusted-entitlements).

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
