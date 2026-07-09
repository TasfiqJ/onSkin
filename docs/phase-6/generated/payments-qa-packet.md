# Generated Phase 6 Payments QA Packet

Generated at: 2026-07-09T16:18:14.917Z
Git SHA: 0419965c33feb27c0bff4557c95a7c7ed5b0a418
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
| package.json | present | 13798 | dd21079f31bff92d95d1f4b1826c1f81d87a9c4724e319751e0dab148bf0656c |
| apps/mobile/src/lib/iap/revenuecat.ts | present | 18355 | b95779de93cd11304b541cd6c44c01e2b86eaa56c3a408a1569f52b47bde0a75 |
| apps/mobile/src/features/subscription/store.ts | present | 10936 | 9ad69b9debf029e4cc4e85d34ff163b855ad32c14f30881f5023dfa8e54ac991 |
| apps/mobile/src/features/subscription/useEntitlement.ts | present | 8978 | 8f2d4fd67770956da6e6a656d90b1584edd827a0f5ae80365b4bb925cef5286a |
| apps/mobile/src/features/subscription/useSubscriptionOffering.ts | present | 579 | 68323e5167be9790971105d41d23397bdef153d779cf8e7f2e8a27d4a80a9675 |
| apps/mobile/src/app/onboarding/paywall.tsx | present | 12402 | 5b7800c2942ff62d3407c4c7eb23a8d9681b6012717f058121561c3ef09e7b46 |
| apps/mobile/src/app/paywall/upsell.tsx | present | 10439 | 3aa577c240eaa5085db61a9bab40ece1138bd640f177ef44a3dac1a3d4d4c9eb |
| apps/mobile/src/app/paywall/reoffer.tsx | present | 9007 | d641e51cf1e1eea76e05bcd5eeb3ca824832465921ae5122fda824762f63a682 |
| apps/mobile/src/app/paywall/downgrade.tsx | present | 5506 | 1ba9948580e026aebe08e08c7f23776418ae2de657c31a09e301993e804b76bb |
| apps/mobile/src/app/paywall/winback.tsx | present | 7394 | 0858e3180d41540efd1ce4f2306ee40c4f313fe52d9e5963c0b3a6b264eef069 |
| apps/mobile/src/app/settings/subscription.tsx | present | 15574 | 6f9024c3f2b40b59f17755a328814cbfe1823a031db4795c4565a87ab5c7372f |
| supabase/functions/revenuecat-webhook/index.ts | present | 13292 | 210324cc1b57e321885d2fb523cf62a0b2adcfca3cee9fc2df9164ffde9147c4 |
| supabase/functions/subscription-grants/index.ts | present | 3457 | 2922047f3ca942aa406785a00ee8175ac3f1899f6b97502f49393a6b204baa02 |
| supabase/functions/account-deletion/index.ts | present | 15795 | d7c16fe965a32ecb8b7d7d1781fac87a409a1035123c47224573f83ecdc8cc73 |
| supabase/migrations/20260615000027_phase6_payments.sql | present | 3061 | ac68e551a04d938548f93da78994984786e29b3bfdda51d52f39f7371e6b6865 |
| supabase/migrations/20260707000035_phase6_reverse_trial_atomic_grant.sql | present | 3947 | a88b75b7cfc6cd0fc791d04f466f9ab30b268c892a1603d919f08fe6ae8e2a02 |
| apps/mobile/src/features/subscription/paywallMobileContracts.test.ts | present | 36894 | 5ff0e9205b68441fd70ebe519eabe8b17b707dda96773ec3aac0c7fd230789d0 |
| apps/mobile/src/features/subscription/store.test.ts | present | 9423 | 0bd51518170c0b8650fd2da273d8e41e67fc79e67d61d931d26bb60b3bda024a |
| apps/mobile/src/features/subscription/entitlement.test.ts | present | 3513 | 9eacdfb4685fc9a11faa2b65c2becc33f3b3ea7a5b429357f457fb83c2535ed6 |
| apps/mobile/src/features/subscription/serverContracts.test.ts | present | 3019 | d956f0f80adc8c7fa64ab50322b665606449c89f98d2209704c73a674df4cc97 |
| scripts/phase6/build-payments-qa-packet.mjs | present | 14162 | fe95b745b23f41cfc89beea08815ddf494357cdcaca5c5de2d32d3d22aa0f5b2 |
| scripts/phase6/check-payments-env.mjs | present | 10163 | 4413f6bf9f823cdb72d0f62bf9659737ae696f99f263677856e60d7e7e9a9009 |
| scripts/phase6/check-payments-env-smoke.mjs | present | 10114 | df4ee4543c815fe726c52ef092caac9e2e56638ac7b1c94b38971f43cee7fe7a |
| scripts/e2e/human-e2e-manifest.mjs | present | 18616 | 6c94b8961cdbd25ddbbd0fa43cb9638c603c31cde22859615716d8a6ec5ee374 |
| scripts/phase9/lib.mjs | present | 13437 | 2e71b816a23d872b46a743345ac70b96b95625f3c720ed7274f2e6833d726f78 |
| docs/HUMAN_SIMULATED_E2E_TESTING.md | present | 9982 | 2828721ebc99a2de1e4ba722516bfacd4ed8c2537603c8756cc383c49d5889a5 |
| docs/E2E_TESTING_CHECKLIST.md | present | 3556 | 014a9213d104d0a5bac7f1752cd94e938d3d5461d0ec5cffbf92e31678f96f7e |
| docs/USER_FLOW_TREE.md | present | 275013 | 96760d6827833bcacd91181fc2f9b9204759d3d218b2d3964ffbdea5c6068073 |
| docs/e2e/generated/human-e2e-manifest.json | present | 11616 | 387ccfabec4fcde786f87004459b6a4e1f02c0d9da168c5a50ac17d83f1689b7 |
| docs/e2e/generated/human-e2e-manifest.md | present | 4958 | 9ffa7fb330ee1c146e088596f71886bd7e40247f9ba01f590252b8207639e35e |
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
