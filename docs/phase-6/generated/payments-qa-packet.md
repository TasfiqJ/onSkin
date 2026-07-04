# Generated Phase 6 Payments QA Packet

Generated at: 2026-07-04T07:07:31.393Z

Strict completion requires real RevenueCat offering review, iOS sandbox restore, Android license-test restore, webhook HMAC replay evidence, finance signoff, and a named owner.

## Evidence

- RevenueCat offering reviewed: BLOCKED
- iOS sandbox restore pass: BLOCKED
- Android license test pass: BLOCKED
- Webhook HMAC test pass: BLOCKED
- Finance signoff: BLOCKED
- Signed off by: BLOCKED

## Scenarios

| Surface | Required scenario set |
| --- | --- |
| Offering load | current RevenueCat offering returns annual and monthly packages with localized prices |
| Missing offering | paywall disables purchase and shows unavailable state; no Pro grant |
| Trial purchase | eligible annual trial opens store sheet, grants Pro only from CustomerInfo, schedules reminder |
| Paid purchase | ineligible/no-trial annual purchase grants Pro only from CustomerInfo and cancels trial reminder |
| Cancellation | webhook sets will_renew=false but keeps access until expiration |
| Expiration/refund | webhook deactivates entitlement and lifecycle screen downgrades gracefully |
| Restore | new install restores active subscription and writes verified local cache |
| Reverse trial | authenticated Edge Function grants exactly once, server expiry RPC deactivates after 7 days |
| Win-back | native eligible win-back offer purchases on iOS; unavailable offers are hidden/rerouted |
| Webhook auth | bad HMAC rejected, stale timestamp rejected, duplicate event id idempotent |
| Account deletion | mobile copy says deletion does not cancel store billing; server calls RevenueCat delete customer |
| Finance | $49.99 annual model, refund/churn assumptions, entitlement denial/leakage reviewed |

## Files

| Path | Status | Bytes | SHA-256 |
| --- | --- | --- | --- |
| apps/mobile/src/lib/iap/revenuecat.ts | present | 17187 | 9db96d033831efebdc5050bc2f435ebab1c2ff9a4b14a55097b5edb1d504e0d8 |
| apps/mobile/src/features/subscription/store.ts | present | 5495 | ea178e248e63c07a969b6fd3507edb3e971d97dcdd0481e423fe8524882ac4fd |
| apps/mobile/src/features/subscription/useEntitlement.ts | present | 5351 | b84bcf2c0bb797c436f2fea08a788e5218b43bd02df65617c8691eab7ac3dc64 |
| apps/mobile/src/features/subscription/useSubscriptionOffering.ts | present | 611 | 2f173449b93e2a4a12e57d68861df74cc7784739dad8ff8fe93ab3ef71497f49 |
| apps/mobile/src/app/onboarding/paywall.tsx | present | 8973 | ccf1f62e7ea05abc4cca46755006c9e6619ca80ce96155dc7cb1800114dc96ea |
| apps/mobile/src/app/paywall/upsell.tsx | present | 4258 | 70ba89273272d67dab64bfab4934f54c4fc89f7ee1f7b5e8dbd7fdf20e79abb1 |
| apps/mobile/src/app/paywall/winback.tsx | present | 5155 | cc6e6ce9db14ec3457c68e80dc2bf792c53de64564d990c446d0fec5f41687a2 |
| apps/mobile/src/app/settings/subscription.tsx | present | 7884 | 7e5769d1194f67c9bc1d9a5db57a4cabd21fcf3b06c4b292fd4175b3d45d759d |
| supabase/functions/revenuecat-webhook/index.ts | present | 8857 | 7fa26941896527bb52fa932872d4d4cc8c7be74005fdd4e0f0a9f62683480313 |
| supabase/functions/subscription-grants/index.ts | present | 3730 | 6a64618db961a876ecea59ffeacdf6ec863f0b83f9ec8e6e2a7d1cba31b69827 |
| supabase/functions/account-deletion/index.ts | present | 3999 | 00d5526d6f4e760ec5ecaa1a943e5b91ff606bfd0d5d4a5b4e43e65d148ad44d |
| supabase/migrations/20260615000027_phase6_payments.sql | present | 3061 | ac68e551a04d938548f93da78994984786e29b3bfdda51d52f39f7371e6b6865 |
| docs/phase-6/payments-runbook.md | present | 2953 | 8b415aab8405ed7e1109fe6a7cca91759fc6d6a406c0a08d04df3243edf4191c |
| docs/phase-6/payments-qa-checklist.md | present | 2599 | 2262a8a44e0d98349b7d4fda5d7350631be6dbd43e185047440f296e178142fb |
| docs/phase-6/phase-6-exit-review.md | present | 2228 | acbfe0d63607f4aa448a3d0c6e1a06fa5062afeb7085eadb820cd86f14e1f6b2 |

## Blockers

- Missing PHASE6_RC_OFFERING_REVIEWED=true.
- Missing PHASE6_IOS_SANDBOX_RESTORE_PASS=true.
- Missing PHASE6_ANDROID_LICENSE_TEST_PASS=true.
- Missing PHASE6_WEBHOOK_HMAC_TEST_PASS=true.
- Missing PHASE6_FINANCE_SIGNOFF=true.
- Missing PHASE6_SIGNED_OFF_BY.
