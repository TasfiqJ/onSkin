# Phase 6 Exit Review

## Implemented

- RevenueCat adapter fails closed in production and no longer returns local purchase stubs.
- Paywalls render RevenueCat offering prices and disable purchase when the offering is unavailable.
- Purchase, restore, and win-back actions grant Pro only from RevenueCat `CustomerInfo`.
- Reverse trial moved to a service-role Supabase Edge Function.
- Entitlements migration adds verified source, environment, management URL, package, store user id, and raw status metadata.
- RevenueCat webhook verifies HMAC over the raw request body, dedupes events, resolves aliases, and mirrors cancellation versus expiration correctly.
- Account deletion calls RevenueCat customer deletion with a secret server key.
- Mobile deletion copy no longer implies account deletion cancels Apple or Google billing.
- Phase 6 scripts generate a QA packet and block strict exit on missing external evidence.

## Seven-Figure Readiness

The product thesis still depends on paid willingness for a trusted skincare routine OS, not on payment mechanics alone. Phase 6 removes a major monetization risk: users cannot self-grant paid access locally, prices are not hardcoded into payable offers, and restore/cancel/delete behavior is aligned with store rules.

Revenue target model:

- Candidate annual price: $49.99
- Gross ARR target: $1,000,000
- Required active annual subscribers: 20,005
- Practical target should be higher after store fees, tax, refunds, failed renewals, and churn.

Payment correctness target:

- 0 known local self-grant paths
- 0 production Test Store leakage paths
- 0 hardcoded payable prices
- 0 cancellation flows that revoke access before expiration
- 0 account deletion copy paths that imply store billing cancellation

## Remaining External Blockers

- Live RevenueCat project, products, packages, and current offering must be reviewed.
- Apple sandbox restore and Google license-test restore must pass on installable builds.
- Webhook HMAC must be tested against the deployed Edge Function.
- Production policy/support URLs must be real.
- Brand/legal clearance must be recorded before production release.
- Finance owner must sign off on price, refund, fee, tax, and churn assumptions.
