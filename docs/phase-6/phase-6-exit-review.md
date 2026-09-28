# Phase 6 Exit Review

## Implemented

- RevenueCat adapter fails closed in production and no longer returns local purchase stubs.
- Paywalls render RevenueCat offering prices and disable purchase when the offering is unavailable.
- Purchase, restore, and win-back actions grant Pro only from RevenueCat `CustomerInfo`.
- The RevenueCat-backed `entitlements` projection and no-card
  `reverse_trial_grants` authority are separate. Migration `0053` exposes both
  through an owner-derived, no-argument projection RPC; a legacy store row with
  no provider cursor fails closed as `legacy_unknown`.
- Reverse-trial grant writes are atomic and cannot overwrite, extend, or revoke
  the independent store lane.
- Authenticated subscription reconciliation accepts no caller owner or time and
  advances the store projection only from a bounded, fresh RevenueCat
  `request_date`.
- RevenueCat webhook verifies HMAC over the raw request body, dedupes events,
  resolves aliases, and mirrors cancellation versus expiration atomically.
- Durable account deletion quiesces the published RevenueCat identity, performs
  provider deletion with the secret server credential, and reconciles full
  family absence behind the database deletion barrier before terminal success.
- Every RevenueCat configure/login, offering, purchase, Restore, and
  customer-info operation requires the central exact-session publication
  authority and closes synchronously at an account boundary.
- A durable owner-bound write-ahead journal is recorded before native purchase
  or Restore so an unconfirmed result cannot trigger a second charge.
- iOS marketplace copy names the App Store. Account deletion does not imply
  billing cancellation and discloses that provider verification can take up to
  29 days.
- Positive entitlement fixtures and artificial entitlement delays exist only
  in the Expo web development implementation. Default and native modules are
  fail-closed, and Phase 6 plus PAY-07 source contracts enforce the boundary.
- Unconfigured clients refuse reverse trials, RevenueCat `NOT_REQUESTED`
  snapshots are rejected, and RevenueCat-granted `promotional` entitlements are
  explicitly out-of-store/non-billing rather than Apple promotional offers. A
  separate Edge boundary denies the custom grant before authentication unless
  the runtime is explicitly development on an exact HTTP loopback Supabase
  origin with an explicit port; hosted projects fail closed even if mislabeled.
  A direct URL or cached, pending, failed, expired, stale-verification, or
  incomplete-authority result renders recovery. Confirmation requires a fresh
  post-mount exact-owner result and future exact expiry; renewal/price copy also
  requires an exact billing store, `willRenew=true`, and the entitlement price.
- Phase 6 scripts generate a QA packet and block strict exit on missing external evidence.
- The generated QA packet hashes payment lifecycle routes, subscription
  contract tests, human-simulated E2E rules, user-flow tree, manifest
  generator, and generated manifest before payment evidence can be reviewed as
  current.

Source verification at the 2026-07-15 checkpoint passes:

- subscription reconciliation: 20/20;
- subscription grants: 8/8;
- RevenueCat webhook atomic contracts: 20/20;
- durable account deletion: 215/215;
- focused mobile server contract: 2/2;
- PostgreSQL 15/17 entitlement-authority rehearsals and the 52-migration
  two-reset/pgTAP/lint/empty-shadow gate; and
- integrated typecheck, lint, format, and 244 files / 2,780 tests.

These are source and local-database results, not StoreKit, hosted Supabase,
live RevenueCat, physical-iPhone, professional-review, or App Store evidence.

## Seven-Figure Readiness

The product thesis still depends on paid willingness for a trusted skincare
routine OS, not on payment mechanics alone. The current PAY-07 source candidate
removes known client-created Pro grants; this is not a claim that the custom
server app grant is Apple-approved, that hosted authority is verified, or that
restore/cancel/delete behavior has passed the signed-build lifecycle matrix.

Revenue target model:

- Candidate annual price: $49.99
- Gross ARR target: $1,000,000
- Required active annual subscribers: 20,005
- Practical target should be higher after store fees, tax, refunds, failed renewals, and churn.

Payment correctness target:

- 0 known client-created Pro grant paths in the current source candidate
- 0 production Test Store leakage paths
- 0 hardcoded payable prices
- 0 cancellation flows that revoke access before expiration
- 0 account deletion copy paths that imply store billing cancellation

## Remaining External Blockers

- Live RevenueCat project, products, packages, and current offering must be reviewed.
- Apple sandbox purchase, Restore, interrupted/pending transaction, refund,
  renewal, grace, expiry, reinstall, and provider-recreation flows must pass on
  the exact signed iOS build and supported physical iPhones.
- Webhook HMAC must be tested against the deployed Edge Function.
- Migration `0053`, reconciliation, grants/webhook, and the compatible mobile
  projection reader must be deployed in a reviewed order; prove no installed
  old direct-table reader remains or enforce a mandatory-version fence.
- RevenueCat alias/transfer, late-webhook, v1 reconciliation, v2 full-family
  absence, deletion/recreation, and rate-limit behavior need disposable live
  provider evidence.
- Production policy/support URLs must be real.
- Qualified counsel must review the transaction-journal retention and exact
  up-to-29-days deletion disclosure; only Apple can decide the exact submitted
  build in App Review.
- Brand/legal clearance must be recorded before production release.
- Finance owner must sign off on price, refund, fee, tax, and churn assumptions.
- The safest iOS release candidate disables the custom server-issued full-Pro
  reverse trial and uses an Apple-managed introductory offer. If retained as an
  exception, attach qualified counsel analysis, any Apple correspondence, and
  App Attest/DeviceCheck-backed anti-abuse/one-grant evidence, while remaining
  launch-blocked unless Apple accepts the exact submitted build for App Store
  distribution with that mechanism present. No prior review or correspondence
  guarantees acceptance.
- Retain the exact production build's explicit RevenueCat informational
  response-signature-verification configuration and sandbox/TestFlight purchase
  and Restore proof returning `VERIFIED` or `VERIFIED_ON_DEVICE`;
  `NOT_REQUESTED` must remain a denial.
