# Generated Phase 6 Payments QA Packet

Generated at: 2026-07-07T02:01:07.085Z

Strict completion requires real RevenueCat offering review, iOS sandbox restore, Android license-test restore, webhook HMAC replay evidence, finance signoff, and a named owner.

## Evidence

- RevenueCat offering reviewed: BLOCKED
- iOS sandbox restore pass: BLOCKED
- Android license test pass: BLOCKED
- Webhook HMAC test pass: BLOCKED
- Finance signoff: BLOCKED
- Signed off by: BLOCKED

## Scenarios

| Surface           | Required scenario set                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| Offering load     | current RevenueCat offering returns annual and monthly packages with localized prices            |
| Missing offering  | paywall disables purchase and shows unavailable state; no Pro grant                              |
| Trial purchase    | eligible annual trial opens store sheet, grants Pro only from CustomerInfo, schedules reminder   |
| Paid purchase     | ineligible/no-trial annual purchase grants Pro only from CustomerInfo and cancels trial reminder |
| Cancellation      | webhook sets will_renew=false but keeps access until expiration                                  |
| Expiration/refund | webhook deactivates entitlement and lifecycle screen downgrades gracefully                       |
| Restore           | new install restores active subscription and writes verified local cache                         |
| Reverse trial     | authenticated Edge Function grants exactly once, server expiry RPC deactivates after 7 days      |
| Win-back          | native eligible win-back offer purchases on iOS; unavailable offers are hidden/rerouted          |
| Webhook auth      | bad HMAC rejected, stale timestamp rejected, duplicate event id idempotent                       |
| Account deletion  | mobile copy says deletion does not cancel store billing; server calls RevenueCat delete customer |
| Finance           | $49.99 annual model, refund/churn assumptions, entitlement denial/leakage reviewed               |

## Files

| Path                                                             | Status  | Bytes | SHA-256                                                          |
| ---------------------------------------------------------------- | ------- | ----- | ---------------------------------------------------------------- |
| apps/mobile/src/lib/iap/revenuecat.ts                            | present | 18355 | b95779de93cd11304b541cd6c44c01e2b86eaa56c3a408a1569f52b47bde0a75 |
| apps/mobile/src/features/subscription/store.ts                   | present | 6487  | 5a905346a58231713ccfb0725011a96c8d12b2607adcb5503732d4c79c97dc19 |
| apps/mobile/src/features/subscription/useEntitlement.ts          | present | 5134  | 38851383ef23dda719aae4445a3ca919de06a1fb49aa42543cfe6bd9986d56f3 |
| apps/mobile/src/features/subscription/useSubscriptionOffering.ts | present | 579   | 68323e5167be9790971105d41d23397bdef153d779cf8e7f2e8a27d4a80a9675 |
| apps/mobile/src/app/onboarding/paywall.tsx                       | present | 11904 | d663be60b6f95eef72c9ad885874065329c35a9a7379680fa94444a58988b18c |
| apps/mobile/src/app/paywall/upsell.tsx                           | present | 4757  | 59183087b0a168e3214d1c29b8badf0726b363b36e3ca85d8fd916b5f14f79d0 |
| apps/mobile/src/app/paywall/winback.tsx                          | present | 6284  | 3da03e9e8910404da62ea7dabc3679a2aacac93613321ddee0c8d09ea1702ca6 |
| apps/mobile/src/app/settings/subscription.tsx                    | present | 9245  | bc66030e6d733529cdb6e7d0a01456bb51f2bc0af2357cbe30ab63266962cbc9 |
| supabase/functions/revenuecat-webhook/index.ts                   | present | 12847 | 7899144905d1966dccc526e106dfb1ace848c6f492383a97699d5859a7a49fa5 |
| supabase/functions/subscription-grants/index.ts                  | present | 4492  | e146744807f42d221bc26771728efa6360da03b586a91e1d77c01d3b2c624d7f |
| supabase/functions/account-deletion/index.ts                     | present | 15795 | d7c16fe965a32ecb8b7d7d1781fac87a409a1035123c47224573f83ecdc8cc73 |
| supabase/migrations/20260615000027_phase6_payments.sql           | present | 3061  | ac68e551a04d938548f93da78994984786e29b3bfdda51d52f39f7371e6b6865 |
| docs/phase-6/payments-runbook.md                                 | present | 3263  | 1279bccdb7f786516d1c5c466bed0b4012e779e8086aaa9f7486111f010f4a15 |
| docs/phase-6/payments-qa-checklist.md                            | present | 2599  | 2262a8a44e0d98349b7d4fda5d7350631be6dbd43e185047440f296e178142fb |
| docs/phase-6/phase-6-exit-review.md                              | present | 2228  | acbfe0d63607f4aa448a3d0c6e1a06fa5062afeb7085eadb820cd86f14e1f6b2 |

## Blockers

- Missing PHASE6_RC_OFFERING_REVIEWED=true.
- Missing PHASE6_IOS_SANDBOX_RESTORE_PASS=true.
- Missing PHASE6_ANDROID_LICENSE_TEST_PASS=true.
- Missing PHASE6_WEBHOOK_HMAC_TEST_PASS=true.
- Missing PHASE6_FINANCE_SIGNOFF=true.
- Missing PHASE6_SIGNED_OFF_BY.
