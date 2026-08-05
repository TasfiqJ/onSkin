# PAY-07 Entitlement Admission Source Checkpoint — 2026-08-04

Status: `source-hardened / live-blocked`
Scope: positive entitlement admission, purchase-success claims, native fixture
exclusion, build-environment parity, and release-gate truthfulness

## Outcome

The source candidate now fails closed across the client paths that can admit or
describe Pro access:

- An unconfigured client cannot create a local reverse-trial entitlement. It
  must receive the exact server grant.
- Production and staging builds reject the custom full-Pro grant switch, and
  the Edge authority independently refuses before authentication unless
  `APP_ENV=development` and `SUPABASE_URL` is an exact HTTP loopback origin with
  an explicit port. A hosted project remains denied even if mislabeled
  development; onboarding instead offers a genuine free-plan continuation.
- Native/default entitlement-fixture modules return no grant and no delay.
  Positive deterministic fixtures exist only in the Expo web development
  implementation selected by Metro platform resolution.
- RevenueCat `FAILED` and `NOT_REQUESTED` verification states grant nothing.
  Cached V2 `revenuecat_not_requested` positives are rejected, and the selected
  active entitlement's verification value must exactly match the aggregate.
  `PROMOTIONAL` maps to a RevenueCat-granted out-of-store, non-billing
  `promotional` entitlement; it is not an Apple/StoreKit promotional offer.
- `/paywall/success` requires a completed post-mount exact-owner query, no
  loading/fetch/error state, freshly verified authority metadata, and an exact
  future expiry. Cached, pending, failed, expired, malformed,
  stale-verification, or incomplete-authority evidence cannot render success.
- Success admission advances on the wall clock, refetches at the earliest
  verification/expiry boundary and on app foreground, and cannot remain open on
  a frozen React Query timestamp.
- Renewal and price claims require an exact billing store, `willRenew=true`,
  the entitlement's own price, and exact cadence derived from the configured
  product ID. App grants, RevenueCat-granted promotions,
  non-renewing access, and missing billing facts use separate non-billing,
  no-renewal, or billing-unknown copy.
- `APP_VARIANT` and `EXPO_PUBLIC_APP_ENV` must match. A non-development
  JavaScript runtime will not accept an explicit development environment label.
- Trial copy is customer-specific: iOS asks RevenueCat for exact per-product
  introductory-offer eligibility and advertises a free trial only for
  `INTRO_ELIGIBILITY_STATUS_ELIGIBLE`. Unknown, ineligible, unavailable, or
  failed checks show a plain subscription CTA and no trial promise.
- Phase 6 now requires a canonical committed Trusted Entitlements artifact,
  cross-bound to the exact production app, bundle, build, Git SHA, SDK version,
  products, entitlement, reviewer, and four sandbox/TestFlight purchase/Restore
  observations. The review boolean is not evidence by itself.

## Human-simulated E2E

Codex in-app browser tested Expo web at 390 x 844:

- Fresh/free direct `/paywall/success` showed only `Pro access not confirmed`,
  the explicit no-charge/no-unlock alert, and two 56 px recovery controls.
  Confirmed/billing copy was absent and horizontal overflow was zero.
- `Check access again` remained fail-closed.
- `Subscription options` reached `/settings/subscription`.
- The isolated web-only development `store_pro` fixture rendered exact
  `$49.99/year` and `set to renew $49.99/yr` copy, no recovery copy, and a Today
  CTA that successfully reached `/today`.
- With no live store eligibility result, onboarding and contextual upsell showed
  `Subscribe to Pro`, never `Start free trial`. Onboarding described ordinary
  subscription billing, and its `Continue with the free plan` action reached
  `/today` without granting Pro. The contextual CTA returned inline
  store-unavailable recovery, and `Maybe later` reached `/today`.
- The first confirmed run exposed `$49.99/year/year` and
  `$49.99/year/yr`. The bug was recorded, fixed with one-cadence normalization,
  and reverified on the same surface.

The browser session above is semantic/interaction evidence from localhost, not
a signed native store transaction. The prior recovery screenshots below remain
local/volatile; the refreshed confirmation, onboarding, and upsell interactions
were not promoted into retained release evidence.

Local/volatile diagnostic evidence (not retained release proof):

- `test-results/human-e2e/2026-08-04/pay07-entitlement-admission-current/summary.json`
- `test-results/human-e2e/2026-08-04/pay07-entitlement-admission-current/recovery-390x844.png`
- `test-results/human-e2e/2026-08-04/pay07-entitlement-admission-current/confirmed-390x844.png`
- `docs/e2e-bug-reports/2026-08-04-paywall-success-annual-price-duplication.md`

The three `test-results/` entries are gitignored worktree artifacts. They are
useful for local diagnosis only: they are not committed, governed, or retained
release evidence and may disappear. The bug report is likewise not retained
proof until it is committed at the accepted revision. Release reliance requires
regeneration against the exact candidate or promotion into a governed evidence
location with immutable revision and hash binding.

## Native JavaScript source-exclusion check

An iOS Expo export used matching development identity/environment values while
running production-mode JavaScript export without Hermes bytecode. The
6,909,415-byte bundle SHA-256 was
`1b0c5a5d43aa80ec44b8626cd8ca47195614ca36b35b2109fba8e7e881399cac`.
The exported bundle is also a gitignored, local/volatile diagnostic artifact,
not retained release proof; its recorded hash does not make the absent bytes a
committed release input.
None of these markers appeared:

- `EXPO_PUBLIC_E2E_ENTITLEMENT`
- `EXPO_PUBLIC_E2E_ENTITLEMENT_DELAY_MS`
- `local_store_fixture`
- `e2e-store-user`
- `e2e-expired-store-user`
- `expired_reverse_trial`

This proves Metro's native JavaScript source choice for this export. It does not
prove a signed archive, Hermes bytecode, native runtime, StoreKit transaction,
RevenueCat result, physical iPhone, TestFlight, or App Review outcome.

## Verification

- PAY-07 adversarial source contract: 18/18 passed.
- Trusted Entitlements artifact validator: 21/21 adversarial tests passed.
- Focused entitlement/RevenueCat/route/environment verification:
  `npm.cmd --workspace apps/mobile test -- src/features/subscription/store.test.ts src/features/subscription/successAdmission.test.ts src/features/subscription/paywallMobileContracts.test.ts src/features/subscription/claimsafety.test.ts src/features/subscription/storefrontCopy.test.ts src/lib/appConfig.test.ts src/lib/env.test.ts src/lib/iap/revenuecatPublication.test.ts`
  passed with 8 files and 276/276 tests.
- Full mobile suite: 336 files, 4,183/4,183 passed.
- Mobile TypeScript: passed.
- Phase 6 payment source baseline: 30/30 checker/packet smoke cases passed; the
  non-strict check exits 0 with expected missing-production and
  missing-external-evidence warnings.

## Apple and provider decision boundary

Apple Guideline 3.1.1 requires in-app purchase for unlocking digital features,
while Apple-managed subscription free trials are introductory offers configured
in App Store Connect. The safest iOS release candidate disables the custom
server full-Pro grant and uses an Apple-managed introductory offer. If the
custom exception is retained, qualified counsel analysis, Apple correspondence
if obtainable, and App Attest/DeviceCheck anti-abuse evidence are inputs only;
they cannot guarantee approval. The exact submitted build remains blocked unless
Apple accepts it for App Store distribution with that mechanism present.

The exact production build must retain RevenueCat response-signature
verification. Current RevenueCat SDKs enable Trusted Entitlements by default,
and this app also explicitly requests informational verification; this is an
SDK/build control, not a claimed dashboard switch. Retain sandbox/TestFlight
purchase and Restore evidence returning `VERIFIED` or `VERIFIED_ON_DEVICE`;
otherwise the intentional `NOT_REQUESTED` denial can also deny legitimate
customers.

Primary references:

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple introductory offers](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-introductory-offers-for-auto-renewable-subscriptions/)
- [StoreKit current entitlements](https://developer.apple.com/documentation/storekit/transaction/currententitlements)
- [DeviceCheck](https://developer.apple.com/documentation/devicecheck)
- [Establishing app integrity](https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity)
- [Expo platform-specific modules](https://docs.expo.dev/router/advanced/platform-specific-modules/)
- [Expo environment variables](https://docs.expo.dev/guides/environment-variables/)
- [RevenueCat Trusted Entitlements](https://www.revenuecat.com/docs/customers/trusted-entitlements)
- [RevenueCat customer-profile promotional entitlements](https://www.revenuecat.com/docs/dashboard-and-metrics/customer-profile)

## Open launch gates

- Configure the Apple-managed introductory offer for the iOS release candidate;
  keep the custom full-Pro grant disabled. Any future custom-grant exception is
  a separate reviewed change and remains blocked through exact-build App Review.
- Configure real App Store Connect products and the production RevenueCat
  project, offering, app-user identity, and webhooks; prove the exact build's
  response-signature-verification results.
- Prove signed-build sandbox/TestFlight purchase, Restore, pending/interrupted,
  cancellation, renewal, grace, expiry, refund, reinstall, account switch,
  alias/transfer, and deletion/recreation behavior on supported physical
  iPhones.
- Prove hosted Supabase grant/reconciliation/webhook authority and anti-abuse
  behavior, including App Attest/DeviceCheck if a custom grant remains.
- Complete qualified legal/privacy review, production policy/support URLs,
  finance signoff, and Apple's independent App Review.

No source or local-browser result in this checkpoint is legal advice, Apple
approval, release-candidate proof, or a revenue guarantee.
