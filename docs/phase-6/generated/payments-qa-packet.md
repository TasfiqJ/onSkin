# Generated Phase 6 Payments QA Packet

Generated at: 2026-07-16T15:29:14.795Z
Git SHA: 5dd7053290160d461fab9cfe0ffb885b5f6daa4c
Git status: clean

Strict completion requires real RevenueCat offering review and store restore evidence for every contract-required platform, webhook HMAC replay evidence, finance signoff, and a named owner.

## Evidence

- RevenueCat offering reviewed: BLOCKED
- iOS sandbox restore pass: BLOCKED
- Android license test pass: NOT APPLICABLE
- Webhook HMAC test pass: BLOCKED
- Finance signoff: BLOCKED
- Signed off by: BLOCKED

## Production Config

- EAS production app environment: yes
- Production excludes RevenueCat Test Store key: yes
- Entitlement ID is pro: yes
- iOS RevenueCat public key configured: BLOCKED
- Android RevenueCat public key configured: NOT APPLICABLE
- Annual product ID final: BLOCKED
- Monthly product ID final: BLOCKED
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
| Reverse trial | authenticated Edge Function atomically grants exactly once in the app lane with null provider identity; access expires from the immutable grant window without mutating the store lane |
| Win-back | approved commercial state is exact: no-offer launch returns unavailable and standard fallback; any later native Apple offer proves eligibility, localized price, purchase, renewal, and fallback |
| Webhook auth | bad HMAC rejected, stale timestamp rejected, duplicate event id idempotent |
| Account deletion | mobile copy says deletion does not cancel store billing; server calls RevenueCat delete customer |
| Finance | $49.99 annual model, refund/churn assumptions, entitlement denial/leakage reviewed |

## Files

| Path | Status | Bytes | SHA-256 |
| --- | --- | --- | --- |
| .env.example | present | 22784 | 32ff3fcaea32204c1e56f9b3624199c5613ad46401471548217d7d83ce849a6b |
| package.json | present | 29829 | 9ac1ae585e96d92766992718348a3c79ddae316f227dff88842fb1ed0374f575 |
| docs/hugeToDo/launch-contract.json | present | 2935 | 43bea3c862d7e36c7e8d744b87bcf21f65d721500e71e1f1cfa7492fbb14ee4b |
| docs/hugeToDo/PAY-06-ENTITLEMENT-AUTHORITY-LANES-2026-07-14.md | present | 11287 | b3aa6768944665294ecc730c23a4834d150cb09328571befa0edd145697783b5 |
| scripts/launch/contract.mjs | present | 6676 | 6a3ced1c0e7e54ef7db31e848aeeebd3617a77db02c3b51c98d6ee3789a9007d |
| apps/mobile/src/lib/iap/revenuecat.ts | present | 37617 | 6ae4921ebcdfd202dad381661dddcefd28add835b2502328946c8ae1a52b0358 |
| apps/mobile/src/lib/env.ts | present | 6982 | 22ebe3a408c87b87be7da9e4a2282feba8620d88405b43216eb961966bfb5b31 |
| apps/mobile/src/features/subscription/store.ts | present | 60455 | 2e5e3e65abd8fc2e36b8e6bd0b9e369291829249d92740c0011d1f87d61101d8 |
| apps/mobile/src/features/subscription/useEntitlement.ts | present | 17046 | 07ae96a482701392e841b70aff84a77e44ea0c35ea1e4659eb2fe2f58d8ab59c |
| apps/mobile/src/features/subscription/useSubscriptionOffering.ts | present | 761 | 9f765eb64c59b0a27f5b815b16fa829465322e1ee5dab866230bb6afe5af1a8a |
| apps/mobile/src/app/onboarding/paywall.tsx | present | 13146 | e5851cd5b74fbed61d537e36111634ca951c841ad7dfc1999c1086ff4504f6ad |
| apps/mobile/src/app/paywall/upsell.tsx | present | 10512 | 2ee92b7d43f0a596808d920b2e4cb702f9693ed00fac511a4d1521bd44af6d5a |
| apps/mobile/src/app/paywall/reoffer.tsx | present | 9080 | 40ff7c91d9ea2a3c529c697692fdfbcb98294f00dcc8b684ac2a0cde3a01fc9f |
| apps/mobile/src/app/paywall/downgrade.tsx | present | 5579 | 4eb6fed57d358c1f2503be13cd8571f99adc157b362be3776e723285cd4ef92e |
| apps/mobile/src/app/paywall/winback.tsx | present | 7658 | 74c02e7dd2118b1c8a7fb05db47693b35f2b6fb037c95c080c33232eb1529104 |
| apps/mobile/src/app/settings/subscription.tsx | present | 15690 | bd57b2f188f7631787f4bc3cb418b1247c9d67962f8c939c63aed1c1afff7772 |
| supabase/functions/revenuecat-webhook/index.ts | present | 7924 | 5a8f373654768965232ee87b0aa407806d369a33e3ac7598a3d850fde480e0f6 |
| supabase/functions/subscription-grants/index.ts | present | 4512 | 6aea31f612dc3ef6cb0011df0c126f26150b3d8d4c9d2eae4b6266e22815e8d0 |
| supabase/functions/subscription-reconciliation/index.ts | present | 11629 | e1c30509a29a2b6e7b56bf7f5dc8b6aa82c50d2c876a52f4ebc2ff55ab773821 |
| supabase/functions/subscription-reconciliation/publicationLease.ts | present | 5726 | c9a14414a30e17579b381bcdfb87b48216a610d755b3cc1cb7b0bdfbe4520248 |
| supabase/functions/subscription-reconciliation/publicationLease.test.ts | present | 7149 | 62aa58fa50f9de6211d0f2f038397b03856d082a53e3f138048ba733363a2e8a |
| supabase/functions/subscription-reconciliation/reconciliationCore.ts | present | 14210 | 704d863946f59c8744cd949c7875f07dfdf9215e8ec51291c5fe1f63c6f06043 |
| supabase/functions/subscription-reconciliation/reconciliationCore.test.ts | present | 11386 | cff4523c5cf1305f90be5889ad366582f32717804fe4d99d524cebf5c7b87ec3 |
| supabase/functions/subscription-reconciliation/reconciliationContract.test.ts | present | 4242 | 1d724448169cc36cba21d0efd84d2e586a820e718bac1f025d974ea77e1c75b1 |
| supabase/functions/_shared/verifiedAuthSessionClaims.ts | present | 2358 | 39db868ee1aa517c95b03102990793d52ad45079b6b18bbebb5640ee44207443 |
| supabase/functions/account-deletion/index.ts | present | 1722 | d4fd2917de31d91d010788a3c45d390de61fefd770f090ff5f1242f385b2f7f2 |
| supabase/functions/account-deletion/providerDeletion.ts | present | 11122 | ab2afbf0ea3beb53373df06b0e073f77b70c2f8d76fd5afa9c23d6d67010d746 |
| supabase/functions/account-deletion/providerDeletion.test.ts | present | 17762 | 336488fc323c9dcf681e2df7781ece7bf144974fa705b6bd42c01a5d377e4fbf |
| supabase/functions/account-deletion/serviceRoleCleanup.ts | present | 3440 | f8d8d06f9fdf4b940af912773c6293eeb4530df110c8279b7d58788f344f053d |
| supabase/functions/account-deletion/serviceRoleCleanup.test.ts | present | 16530 | e93c3fe4cd82445ad5833a148ec5aaee95eb95b17b29e02170693623b3f4f95a |
| supabase/functions/order-report-poll/index.ts | present | 5552 | 8574b39ddfac908f1fa156b5c8e64fed8899f682563dff1fdc6981ec4e81d8ce |
| supabase/functions/order-report-poll/orderAttributionCore.ts | present | 10537 | 434abcf6f1f7424d503fcec137bd799dc66b520c26d0e76bd36d0820f1dfa7f0 |
| supabase/functions/order-report-poll/orderAttributionCore.test.ts | present | 14124 | 63105c5562be39504a68075984320cb2105d8f84be04d67d282135f79fb30f6b |
| supabase/migrations/20260615000027_phase6_payments.sql | present | 3061 | ac68e551a04d938548f93da78994984786e29b3bfdda51d52f39f7371e6b6865 |
| supabase/migrations/20260707000035_phase6_reverse_trial_atomic_grant.sql | present | 3947 | a88b75b7cfc6cd0fc791d04f466f9ab30b268c892a1603d919f08fe6ae8e2a02 |
| supabase/migrations/20260713000044_reverse_trial_no_store_identity.sql | present | 4979 | 6644e557e25f9475629b583f16e4db28eb7811ec3a7123eebc3ecb296db8f841 |
| supabase/migrations/20260713000046_account_service_row_scrub.sql | present | 45399 | 268234dbc7c423eef097a2ea17790b871d8413913df71006c73d686e3bd471cf |
| supabase/migrations/20260713000047_account_obf_contribution_erasure.sql | present | 8297 | 152f6ecaf1def7bebd0a5ff1d71b4152b336de72dc8ce8e465f071810f7d023b |
| supabase/migrations/20260714000053_entitlement_authority_lanes.sql | present | 36742 | d1aba134336ccb38292134dc5e10528b6a9370489413e5bd2b7992c03525cec1 |
| apps/mobile/src/features/subscription/paywallMobileContracts.test.ts | present | 38597 | 7889b5f7ad4c9ada4dbd9f89dcfd9f78a3f032058a636b4ddf960ef423ace2af |
| apps/mobile/src/features/subscription/store.test.ts | present | 32970 | 9074c92b587abc09f8df3e1d05c3fb4c0e95a38fd9a6ef6f4e00361a678e385d |
| apps/mobile/src/features/subscription/entitlement.test.ts | present | 3970 | 2ef807ac5ae4b4bdf0d83e47c3a37c7d1de4eb425c436fec17177991616a273a |
| apps/mobile/src/features/subscription/serverContracts.test.ts | present | 7049 | daca502833a84b5c01167cbe3b1c0c72e2042bc6514cbda4e56329f284f3f5be |
| scripts/phase6/build-payments-qa-packet.mjs | present | 16789 | d1862e0d2c3348d69fcab35836d73cac0c2d551cbc0d123ebdddd44017e6242d |
| scripts/phase6/check-payments-env.mjs | present | 10888 | a759ca81c4905f1123a8cd62b285279cabf2bb902ea17ac910f41b04827732ef |
| scripts/phase6/check-payments-env-smoke.mjs | present | 10775 | 1cfdc08c66f9bf5ec1e16443cf5677c5745ebe969171757db2e1bbc9f49acfd2 |
| scripts/phase2/check-env.mjs | present | 21920 | c12bcc548afae7cae1992c290ef65f5a425ccbbb52edba1b4931a3e7a3d2298a |
| scripts/phase2/check-env-smoke.mjs | present | 25482 | 8b9de5340f2fb90f70d9d70f3ea0d1598e7507d3d7abed3890da145f82d0f270 |
| scripts/phase9/supabase-policy-lint.mjs | present | 13160 | 0e95f2369730db305c553dcdab24848ba25674fad0546dec4d09bf89d089535d |
| scripts/phase9/account-service-scrub-postgres-rehearsal.sql | present | 26077 | b4898279189ebca369eaa9f212632d0a903917fe137c8ccbbec994cb3c34743a |
| scripts/phase9/live-data-rights.mjs | present | 65161 | 0e6d7604437b35fa2e9f1fa2a6afbee6743cac829f58f0861e9aff46a28df13a |
| scripts/e2e/human-e2e-manifest.mjs | present | 75305 | 15a92f3558f39b6c8efb47159e43270a532de13dfeae5f02f56fdca385eca9b7 |
| scripts/phase9/lib.mjs | present | 24406 | 4c52e937ddea7a47fba80f69d80d6d586e9c236750cefb9500362352e1cb270e |
| docs/HUMAN_SIMULATED_E2E_TESTING.md | present | 10431 | db247b2acad570745d13b73913e3a18bef5ba9e4ea8d682322adfac7daa131d8 |
| docs/E2E_TESTING_CHECKLIST.md | present | 3632 | 1f37a8c5f6565073dfc4998dd2a46d6c3fbe6cba8f8dc4662039321af75be95f |
| docs/USER_FLOW_TREE.md | present | 382133 | ed2da42899c932830f77ebf16b1aa14d34c604651304bb7ae0d93ad8cb8fcfe8 |
| docs/e2e/generated/human-e2e-manifest.json | present | 48121 | 12a1166209b20760be86a4a70d0c875a0de789553906f7656e51d54815dbd00e |
| docs/e2e/generated/human-e2e-manifest.md | present | 19687 | 7152a25efe24e4feb08e1d035236707b2c8d2bc6ab69cf493652f64616179755 |
| docs/phase-6/payments-runbook.md | present | 5833 | 18b15bfd5ea5e8d0b8f5f410c4367d05b50c2ba9778c8d393e36692e409a4320 |
| docs/phase-6/payments-qa-checklist.md | present | 4881 | 221820b219447c879c19f9dc2ac4fa742d0fa95be9702e0e22bc27da40d53c5c |
| docs/phase-6/phase-6-exit-review.md | present | 4798 | 85e5e80e3d3b14d12cbeae0a4abdbf7a66eba1128b527705bf076a6957fbba28 |

## Blockers

- Missing final EXPO_PUBLIC_REVENUECAT_IOS_KEY.
- Missing final EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID.
- Missing final EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID.
- Missing production REVENUECAT_WEBHOOK_AUTH.
- Missing production REVENUECAT_WEBHOOK_SIGNING_SECRET.
- Missing production REVENUECAT_SECRET_API_KEY.
- BRAND_LEGAL_CLEARANCE must be cleared for production.
- EXPO_PUBLIC_PRIVACY_URL must be a production HTTPS URL.
- EXPO_PUBLIC_TERMS_URL must be a production HTTPS URL.
- EXPO_PUBLIC_SUPPORT_URL must be a production HTTPS URL.
- Missing PHASE6_RC_OFFERING_REVIEWED=true.
- Missing PHASE6_IOS_SANDBOX_RESTORE_PASS=true.
- Missing PHASE6_WEBHOOK_HMAC_TEST_PASS=true.
- Missing PHASE6_FINANCE_SIGNOFF=true.
- Missing PHASE6_SIGNED_OFF_BY.

## Warnings

- none
