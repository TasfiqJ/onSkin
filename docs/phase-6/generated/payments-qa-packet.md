# Generated Phase 6 Payments QA Packet

Generated at: 2026-07-08T17:46:01.779Z

Strict completion requires real RevenueCat offering review, iOS sandbox restore, Android license-test restore, webhook HMAC replay evidence, finance signoff, and a named owner.

## Evidence

- RevenueCat offering reviewed: BLOCKED
- iOS sandbox restore pass: BLOCKED
- Android license test pass: BLOCKED
- Webhook HMAC test pass: BLOCKED
- Finance signoff: BLOCKED
- Signed off by: BLOCKED

## Production Config

- EAS production app environment: yes
- Production excludes RevenueCat Test Store key: yes
- Entitlement ID is pro: yes
- iOS RevenueCat public key configured: BLOCKED
- Android RevenueCat public key configured: BLOCKED
- Annual product ID final: BLOCKED
- Monthly product ID final: BLOCKED
- Reverse-trial product ID final: BLOCKED
- Webhook shared auth configured: BLOCKED
- Webhook signing secret configured: BLOCKED
- RevenueCat secret API key configured: BLOCKED
- Brand legal clearance recorded: BLOCKED
- Privacy URL production: BLOCKED
- Terms URL production: BLOCKED
- Support URL production: BLOCKED

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
| Reverse trial | authenticated Edge Function atomically grants exactly once, server expiry RPC deactivates after 7 days |
| Win-back | native eligible win-back offer purchases on iOS; unavailable offers are hidden/rerouted |
| Webhook auth | bad HMAC rejected, stale timestamp rejected, duplicate event id idempotent |
| Account deletion | mobile copy says deletion does not cancel store billing; server calls RevenueCat delete customer |
| Finance | $49.99 annual model, refund/churn assumptions, entitlement denial/leakage reviewed |

## Files

| Path | Status | Bytes | SHA-256 |
| --- | --- | --- | --- |
| package.json | present | 11407 | 68de59211e7bd4051bbba65042722123f6f8e20e1f27f4eb40bc9d363a0ad2cd |
| apps/mobile/src/lib/iap/revenuecat.ts | present | 18355 | b95779de93cd11304b541cd6c44c01e2b86eaa56c3a408a1569f52b47bde0a75 |
| apps/mobile/src/features/subscription/store.ts | present | 10936 | 9ad69b9debf029e4cc4e85d34ff163b855ad32c14f30881f5023dfa8e54ac991 |
| apps/mobile/src/features/subscription/useEntitlement.ts | present | 8978 | 8f2d4fd67770956da6e6a656d90b1584edd827a0f5ae80365b4bb925cef5286a |
| apps/mobile/src/features/subscription/useSubscriptionOffering.ts | present | 579 | 68323e5167be9790971105d41d23397bdef153d779cf8e7f2e8a27d4a80a9675 |
| apps/mobile/src/app/onboarding/paywall.tsx | present | 12195 | df0b406c727f1722e9f2bef2c600693290d0f3b302c20dad7d11439a767890b7 |
| apps/mobile/src/app/paywall/upsell.tsx | present | 7238 | ac7f68cab670ff75a647ee6c8e6499337bd32c60fee189e82a78c63ff7edd859 |
| apps/mobile/src/app/paywall/winback.tsx | present | 7394 | 0858e3180d41540efd1ce4f2306ee40c4f313fe52d9e5963c0b3a6b264eef069 |
| apps/mobile/src/app/settings/subscription.tsx | present | 13478 | e842070989fe69249e34e8e1e44f462e94e1adae82af64bc35fa459421ce0089 |
| supabase/functions/revenuecat-webhook/index.ts | present | 13292 | 210324cc1b57e321885d2fb523cf62a0b2adcfca3cee9fc2df9164ffde9147c4 |
| supabase/functions/subscription-grants/index.ts | present | 3457 | 2922047f3ca942aa406785a00ee8175ac3f1899f6b97502f49393a6b204baa02 |
| supabase/functions/account-deletion/index.ts | present | 15795 | d7c16fe965a32ecb8b7d7d1781fac87a409a1035123c47224573f83ecdc8cc73 |
| supabase/migrations/20260615000027_phase6_payments.sql | present | 3061 | ac68e551a04d938548f93da78994984786e29b3bfdda51d52f39f7371e6b6865 |
| supabase/migrations/20260707000035_phase6_reverse_trial_atomic_grant.sql | present | 3947 | a88b75b7cfc6cd0fc791d04f466f9ab30b268c892a1603d919f08fe6ae8e2a02 |
| apps/mobile/src/features/subscription/serverContracts.test.ts | present | 3019 | d956f0f80adc8c7fa64ab50322b665606449c89f98d2209704c73a674df4cc97 |
| scripts/phase6/build-payments-qa-packet.mjs | present | 12605 | f6e1aeb7535d99d3bb6da7167a780966ca57fbb49ba3cb2fe0a97d747376eab4 |
| scripts/phase6/check-payments-env.mjs | present | 7645 | c2008b98067f42c4c8bd2dbc84dcd1cfe80167edd43ca30f32253b7a18e92b50 |
| scripts/phase6/check-payments-env-smoke.mjs | present | 7493 | 40919a7139f9d5315f15dec5d62e7e7605eb84ee0c846440a52b8127fc187874 |
| scripts/phase9/lib.mjs | present | 9767 | d2eeb648cca2cc61457e9796d6f1074081effb8847b2ec37544c3e7df3ce3752 |
| docs/phase-6/payments-runbook.md | present | 3696 | f8e63af71f040eda8bc9c468e34421981c3479be81d0fd29bc052794fdf3e6da |
| docs/phase-6/payments-qa-checklist.md | present | 3469 | d335de4c06ae6cc01cbb695a6b32b2d48bd97073f86218d31693ebcd79976337 |
| docs/phase-6/phase-6-exit-review.md | present | 2367 | 6702047baf4028eab3e49d23bc145afbf689f1f3262263b43020cdffcc720cac |

## Blockers

- Missing final EXPO_PUBLIC_REVENUECAT_IOS_KEY.
- Missing final EXPO_PUBLIC_REVENUECAT_ANDROID_KEY.
- Missing final EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID.
- Missing final EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID.
- Missing final EXPO_PUBLIC_REVENUECAT_REVERSE_TRIAL_PRODUCT_ID.
- Missing production REVENUECAT_WEBHOOK_AUTH.
- Missing production REVENUECAT_WEBHOOK_SIGNING_SECRET.
- Missing production REVENUECAT_SECRET_API_KEY.
- BRAND_LEGAL_CLEARANCE must be cleared for production.
- EXPO_PUBLIC_PRIVACY_URL must be a production HTTPS URL.
- EXPO_PUBLIC_TERMS_URL must be a production HTTPS URL.
- EXPO_PUBLIC_SUPPORT_URL must be a production HTTPS URL.
- Missing PHASE6_RC_OFFERING_REVIEWED=true.
- Missing PHASE6_IOS_SANDBOX_RESTORE_PASS=true.
- Missing PHASE6_ANDROID_LICENSE_TEST_PASS=true.
- Missing PHASE6_WEBHOOK_HMAC_TEST_PASS=true.
- Missing PHASE6_FINANCE_SIGNOFF=true.
- Missing PHASE6_SIGNED_OFF_BY.
