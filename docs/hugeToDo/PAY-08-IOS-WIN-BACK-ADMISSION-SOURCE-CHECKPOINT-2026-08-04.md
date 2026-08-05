# PAY-08 iOS Win-Back Admission Source Checkpoint — 2026-08-04

- Status: `in_progress`
- Readiness: source-hardened, live-blocked
- Current commercial state: no iOS win-back offer admitted at launch
- Production claim: none; this checkpoint is not App Store Connect, RevenueCat,
  sandbox, TestFlight, legal, or App Review clearance

## Decision

PAY-01 selected **no win-back offer at launch**. The machine-readable authority
is now the versioned `iosWinBackOfferAdmission` object in
`docs/hugeToDo/launch-contract.json`. Its `winBackOfferAdmitted` value is
`false`. All EAS build profiles explicitly set
`EXPO_PUBLIC_IOS_WIN_BACK_ENABLED=false`, and Expo app configuration rejects a
true value while that admission remains closed.

The launch contract also requires:

- automatic RevenueCat/StoreKit in-app messages disabled;
- a manually selected message allowlist that retains billing issue, price
  increase consent, and generic messages but excludes `WIN_BACK_OFFER` while
  admission is closed;
- repeat delivery of that recovery-message allowlist on a retained
  inactive-to-active foreground transition, without reconfiguring identity or
  invalidating cached offerings after a transient presentation failure;
- ordinary Pro offering retrieval may continue for localized standard-plan
  terms, while win-back eligibility discovery is skipped and the disabled
  win-back purchase returns before any RevenueCat or StoreKit call;
- no hardcoded or invented discount, strike-through price, urgency, or savings
  claim; and
- any later admitted offer to be derived from Apple's eligibility result and
  localized StoreKit/RevenueCat offer price.

An unavailable or ineligible win-back path is not an offer. It routes to the
ordinary Pro paywall and shows only standard-plan presentation: the localized
store term when available, or the existing development preview fallback with
explicit App Store final-price confirmation when checkout is unavailable.

## Why app source alone is not enough

Apple documents that, when an offer is configured, StoreKit can automatically
present an eligible win-back sheet in app and Apple can merchandise the offer
in Manage Subscriptions or the App Store. RevenueCat's React Native
`shouldShowInAppMessagesAutomatically` configuration defaults to `true`, and
calling `showInAppMessages()` without a message-type allowlist can show every
eligible type. App source can suppress the app-owned automatic message path; it
cannot prove that App Store Connect contains no active offer or prevent Apple's
separate store surfaces from displaying an already-configured offer.

Therefore the no-offer production gate requires retained, timestamped App Store
Connect evidence for the exact subscription products and storefronts showing
no configured or active win-back offer. The evidence must bind the final bundle
ID, subscription group, product IDs, storefront scope, reviewed source commit,
build number, capture time, and named reviewer. RevenueCat offering/configuration
evidence for those same exact products is also required. A boolean, source test,
dashboard recollection, or screenshot without those bindings is insufficient.

PAY-08 remains `in_progress` and live-blocked until that external evidence and
the actual-candidate device matrix are retained. PAY-09 remains downstream.

## Current source controls

The adversarial contract is
`scripts/pay08/ios-win-back-source-contract.test.mjs`, invoked by
`pay08:ios-win-back-source-contract:test`. `launch:contract:verify` includes it,
and Phase 6, Phase 9, and launch verification inherit that contract gate.

The contract checks the exact admission schema, Expo build refusal, every EAS
profile, the no-offer runtime commercial state, RevenueCat message controls,
same-binding foreground retry without identity/cache mutation, iOS guard
ordering before provider calls, store-derived future offer data, neutral
fallback presentation, external-boundary documentation, and verification
wiring. Mutation tests prove that positive admission forgery, EAS override,
automatic messages, unconditional or non-iOS win-back messages, removed
provider guards, retry-path identity/cache mutation, hardcoded discounts,
missing wiring, and false completion claims fail closed.

## Required production evidence

For the current no-offer launch, retain all of the following:

1. Exact App Store Connect subscription-group and product views proving no
   configured/active win-back offer for every launch product and storefront.
2. Exact RevenueCat app, offering, package, product, and SDK configuration views
   bound to the same identifiers.
3. Final signed build configuration proving
   `EXPO_PUBLIC_IOS_WIN_BACK_ENABLED=false` and matching the reviewed source SHA.
4. Physical-iPhone sandbox and TestFlight evidence on supported iOS versions
   showing the win-back route performs no offer discovery or purchase call,
   makes no discount claim, and reaches the ordinary localized Pro plan.
5. A RevenueCat/StoreKit message exercise proving billing issue, price increase
   consent, and generic messages remain usable while win-back messages are not
   app-requested.

If a future native offer is proposed, PAY-08 must be reopened. A separately
reviewed contract version must positively admit the exact commercial state;
App Store Connect evidence must bind offer ID, product, customer eligibility,
duration, price, storefronts, availability, and priority; and sandbox plus
TestFlight must prove eligible discovery, ineligible fallback, localized price,
purchase, renewal/expiry, restore, cancellation, interruption, offline behavior,
and correct behavior across supported iOS versions. No remote flag or dashboard
change may bypass that source review.

## Official references reviewed

- Apple, [Merchandising win-back offers in your app](https://developer.apple.com/documentation/storekit/merchandising-win-back-offers-in-your-app)
- Apple, [Supporting win-back offers in your app](https://developer.apple.com/documentation/storekit/supporting-win-back-offers-in-your-app)
- Apple, [Set up win-back offers](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-win-back-offers/)
- Apple, [Testing win-back offers in the sandbox environment](https://developer.apple.com/documentation/storekit/testing-win-back-offers-in-the-sandbox-environment)
- RevenueCat, [iOS subscription offers](https://www.revenuecat.com/docs/subscription-guidance/subscription-offers/ios-subscription-offers)
- RevenueCat React Native SDK, [PurchasesConfiguration](https://revenuecat.github.io/react-native-purchases-docs/7.0.0/interfaces/PurchasesConfiguration.html)

These references define platform/provider mechanics, not a guarantee of legal
compliance, Apple approval, offer delivery, conversion, revenue, or business
performance. Final commercial copy, pricing, consumer-law treatment, storefront
scope, tax, and auto-renewal disclosures still require the applicable owners and
qualified counsel.
