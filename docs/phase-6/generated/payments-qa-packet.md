# Generated Phase 6 Payments QA Packet

Generated at: 2026-07-08T21:21:10.500Z
Git SHA: c3ad652bea5e4ea05a1c9ea1885eb362069c8dd5
Git status: clean

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
| package.json | present | 12147 | bcb595f695619b5c4e2104e8eb31389089cdca30d6da8d439e75141d1f98a0a1 |
| apps/mobile/src/lib/iap/revenuecat.ts | present | 18355 | b95779de93cd11304b541cd6c44c01e2b86eaa56c3a408a1569f52b47bde0a75 |
| apps/mobile/src/features/subscription/store.ts | present | 10936 | 9ad69b9debf029e4cc4e85d34ff163b855ad32c14f30881f5023dfa8e54ac991 |
| apps/mobile/src/features/subscription/useEntitlement.ts | present | 8978 | 8f2d4fd67770956da6e6a656d90b1584edd827a0f5ae80365b4bb925cef5286a |
| apps/mobile/src/features/subscription/useSubscriptionOffering.ts | present | 579 | 68323e5167be9790971105d41d23397bdef153d779cf8e7f2e8a27d4a80a9675 |
| apps/mobile/src/app/onboarding/paywall.tsx | present | 12195 | df0b406c727f1722e9f2bef2c600693290d0f3b302c20dad7d11439a767890b7 |
| apps/mobile/src/app/paywall/upsell.tsx | present | 8330 | 6297af79efae06dc856f296673c3874c10dece1c379b7837ced7ee066fe3ccfa |
| apps/mobile/src/app/paywall/reoffer.tsx | present | 8582 | 36a975b664a43be6713d55746414245aa9f643fc04b66ce8b33765c98db865a6 |
| apps/mobile/src/app/paywall/downgrade.tsx | present | 5065 | 7804127ff434bac6b0c44c7c5f5e39653a8466c927663fe16121a149ec3b356d |
| apps/mobile/src/app/paywall/winback.tsx | present | 7394 | 0858e3180d41540efd1ce4f2306ee40c4f313fe52d9e5963c0b3a6b264eef069 |
| apps/mobile/src/app/settings/subscription.tsx | present | 13478 | e842070989fe69249e34e8e1e44f462e94e1adae82af64bc35fa459421ce0089 |
| supabase/functions/revenuecat-webhook/index.ts | present | 13292 | 210324cc1b57e321885d2fb523cf62a0b2adcfca3cee9fc2df9164ffde9147c4 |
| supabase/functions/subscription-grants/index.ts | present | 3457 | 2922047f3ca942aa406785a00ee8175ac3f1899f6b97502f49393a6b204baa02 |
| supabase/functions/account-deletion/index.ts | present | 15795 | d7c16fe965a32ecb8b7d7d1781fac87a409a1035123c47224573f83ecdc8cc73 |
| supabase/migrations/20260615000027_phase6_payments.sql | present | 3061 | ac68e551a04d938548f93da78994984786e29b3bfdda51d52f39f7371e6b6865 |
| supabase/migrations/20260707000035_phase6_reverse_trial_atomic_grant.sql | present | 3947 | a88b75b7cfc6cd0fc791d04f466f9ab30b268c892a1603d919f08fe6ae8e2a02 |
| apps/mobile/src/features/subscription/paywallMobileContracts.test.ts | present | 26899 | c549c9c75cf8170deb383a1a896903a0f590a46c00118c16c322b8014effb954 |
| apps/mobile/src/features/subscription/store.test.ts | present | 9423 | 0bd51518170c0b8650fd2da273d8e41e67fc79e67d61d931d26bb60b3bda024a |
| apps/mobile/src/features/subscription/entitlement.test.ts | present | 3513 | 9eacdfb4685fc9a11faa2b65c2becc33f3b3ea7a5b429357f457fb83c2535ed6 |
| apps/mobile/src/features/subscription/serverContracts.test.ts | present | 3019 | d956f0f80adc8c7fa64ab50322b665606449c89f98d2209704c73a674df4cc97 |
| scripts/phase6/build-payments-qa-packet.mjs | present | 14388 | 6af224fd802aab6b89052093fb17a2b769b01cad126bfb01bec1ac715112c1ef |
| scripts/phase6/check-payments-env.mjs | present | 10163 | 4413f6bf9f823cdb72d0f62bf9659737ae696f99f263677856e60d7e7e9a9009 |
| scripts/phase6/check-payments-env-smoke.mjs | present | 10114 | df4ee4543c815fe726c52ef092caac9e2e56638ac7b1c94b38971f43cee7fe7a |
| scripts/e2e/human-e2e-manifest.mjs | present | 11741 | 7bc0332cc266cf02137dc1811e44e638b0a8c73cbdc48e30b41f13a6a13dbad8 |
| scripts/phase9/lib.mjs | present | 9767 | d2eeb648cca2cc61457e9796d6f1074081effb8847b2ec37544c3e7df3ce3752 |
| docs/HUMAN_SIMULATED_E2E_TESTING.md | present | 9642 | e323d2a1826f9dceef1aaa3b91a6d04aa6c662f159af876a1fb6d7b232101f29 |
| docs/E2E_TESTING_CHECKLIST.md | present | 3387 | ca541bd7fdd87e0853e707f845a144a53c71d50c55adebfb17feccedd956c812 |
| docs/USER_FLOW_TREE.md | present | 198146 | 009fc346db13963af5a96ff4db5581a1f33f3044a7598cfdcb10852cb5447072 |
| docs/e2e/generated/human-e2e-manifest.json | present | 3293 | 41185e566b49d812d3ec6490b5ca2d2e7265465aced87f8a687e7546bb24ad88 |
| docs/e2e/generated/human-e2e-manifest.md | present | 1774 | 09bab90c22f06dfcd2648865076aab0dbf004c04c3c2321b1fee007391ab44fe |
| docs/phase-6/payments-runbook.md | present | 3957 | 8a0c61a484cd2e8fd689c93f96efb2b13ab34eb8ca285ffb80aac8c6b7072fa1 |
| docs/phase-6/payments-qa-checklist.md | present | 3683 | 5bec4264a96766fe6861096ec709eab95088b5975c4227c6562f7454f519a291 |
| docs/phase-6/phase-6-exit-review.md | present | 2599 | 4f096a6c3c698ce428400e9eb88518f353358197e55846ba815a4448b9fa1ea8 |

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

## Warnings

- none
