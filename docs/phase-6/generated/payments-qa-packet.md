# Generated Phase 6 Payments QA Packet

Generated at: 2026-07-10T03:54:59.086Z
Git SHA: 1cc505bbf185fd017ec8abbca79718d4d5a04797
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
| package.json | present | 17806 | 1c6fc4f6dca8fbaaf783034068f46c3b705cb7055d7b8b74873d85f49e4daf01 |
| apps/mobile/src/lib/iap/revenuecat.ts | present | 18355 | b95779de93cd11304b541cd6c44c01e2b86eaa56c3a408a1569f52b47bde0a75 |
| apps/mobile/src/features/subscription/store.ts | present | 10936 | 9ad69b9debf029e4cc4e85d34ff163b855ad32c14f30881f5023dfa8e54ac991 |
| apps/mobile/src/features/subscription/useEntitlement.ts | present | 9124 | 9e1c92c8998845c588473acbace1f53a23aed7b6ebae2c75941365830c8a5319 |
| apps/mobile/src/features/subscription/useSubscriptionOffering.ts | present | 579 | 68323e5167be9790971105d41d23397bdef153d779cf8e7f2e8a27d4a80a9675 |
| apps/mobile/src/app/onboarding/paywall.tsx | present | 13073 | 8431d6eaf1af5b9b3b11929ca846234384beecfeb6606cece8c5b460686530c3 |
| apps/mobile/src/app/paywall/upsell.tsx | present | 10439 | 3aa577c240eaa5085db61a9bab40ece1138bd640f177ef44a3dac1a3d4d4c9eb |
| apps/mobile/src/app/paywall/reoffer.tsx | present | 9007 | d641e51cf1e1eea76e05bcd5eeb3ca824832465921ae5122fda824762f63a682 |
| apps/mobile/src/app/paywall/downgrade.tsx | present | 5506 | 8df92df0e0523dfbef418973ab376249bfbbca7f066f02942ff5256b732faa20 |
| apps/mobile/src/app/paywall/winback.tsx | present | 7585 | 607e9183342717447fcdeea518bcd20f05d5128e407c8e55f4c11e5e0dc5068d |
| apps/mobile/src/app/settings/subscription.tsx | present | 15590 | f3259cbed4d0b74ba9825b104ae6d30164d208c1db73a1994a1a9a9ee63ef8d1 |
| supabase/functions/revenuecat-webhook/index.ts | present | 13445 | d240f129c8052426ae8adaea8e4accc17a9c8daf14104899bdc8a0ae7663bf6a |
| supabase/functions/subscription-grants/index.ts | present | 3514 | 706cf81639c3ee765820c482ec0d2a21e8ae63d4711a73b529036b6f153ae4a5 |
| supabase/functions/account-deletion/index.ts | present | 15927 | 5bb6817f086f4387e701e205493468c0b9a4c295e993a22ec6fafd7f8fd34d0b |
| supabase/migrations/20260615000027_phase6_payments.sql | present | 3061 | ac68e551a04d938548f93da78994984786e29b3bfdda51d52f39f7371e6b6865 |
| supabase/migrations/20260707000035_phase6_reverse_trial_atomic_grant.sql | present | 3947 | a88b75b7cfc6cd0fc791d04f466f9ab30b268c892a1603d919f08fe6ae8e2a02 |
| apps/mobile/src/features/subscription/paywallMobileContracts.test.ts | present | 38244 | 030326dbb2af9331513d6d5f9ad446ac61a26c04ecec559abe7cbecb31ffb669 |
| apps/mobile/src/features/subscription/store.test.ts | present | 9423 | 0bd51518170c0b8650fd2da273d8e41e67fc79e67d61d931d26bb60b3bda024a |
| apps/mobile/src/features/subscription/entitlement.test.ts | present | 3513 | 9eacdfb4685fc9a11faa2b65c2becc33f3b3ea7a5b429357f457fb83c2535ed6 |
| apps/mobile/src/features/subscription/serverContracts.test.ts | present | 3032 | f67ac9c4c1c207a37d674ac1b05cb0b795b36ecd59255ec08404429c191052a2 |
| scripts/phase6/build-payments-qa-packet.mjs | present | 14162 | fe95b745b23f41cfc89beea08815ddf494357cdcaca5c5de2d32d3d22aa0f5b2 |
| scripts/phase6/check-payments-env.mjs | present | 10597 | e6ae3b4acdcda9c085aac4680669adb017a7e1de4d397d69735664aa2e45be67 |
| scripts/phase6/check-payments-env-smoke.mjs | present | 10114 | df4ee4543c815fe726c52ef092caac9e2e56638ac7b1c94b38971f43cee7fe7a |
| scripts/e2e/human-e2e-manifest.mjs | present | 24950 | 47cb54c1783edaec78485b2c2a6e33681242ed64b2fdb9d8ffbb24c21baa8a84 |
| scripts/phase9/lib.mjs | present | 14020 | af0b4c651325a3fbb33eb94147744cb23253fa439066861e3ef1b64cbae7a083 |
| docs/HUMAN_SIMULATED_E2E_TESTING.md | present | 10167 | d7d616fcbe9078b55c0d4b3bf5e88ae19570fa533aee8edc599cf1956c7c9149 |
| docs/E2E_TESTING_CHECKLIST.md | present | 3556 | 014a9213d104d0a5bac7f1752cd94e938d3d5461d0ec5cffbf92e31678f96f7e |
| docs/USER_FLOW_TREE.md | present | 309942 | 763ef2b7bba51f3104b660fca35892325d964e05e4193fba37b49f44b79002ed |
| docs/e2e/generated/human-e2e-manifest.json | present | 20077 | 65797b848e1ed786cd1e16cb1cb9b30088b08cfee0960d7aee948ae7e43e56b9 |
| docs/e2e/generated/human-e2e-manifest.md | present | 7085 | 627783d9e7a6473653afbc79c5eb71be652e3924e9e1dfbd875e21c0814487cd |
| docs/phase-6/payments-runbook.md | present | 4053 | fdbeaa848738a3ae2b0048fa6988c10a0e0f70b0b7e0df45d81449ea4169c812 |
| docs/phase-6/payments-qa-checklist.md | present | 3683 | 5bec4264a96766fe6861096ec709eab95088b5975c4227c6562f7454f519a291 |
| docs/phase-6/phase-6-exit-review.md | present | 2755 | 0ce0003af4a03b66cde2bafe235bae50fbe3a9e66f6ff0b107f74e4c64cd50df |

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
