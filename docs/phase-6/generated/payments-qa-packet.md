# Generated Phase 6 Payments QA Packet

Generated at: 2026-07-13T20:06:13.093Z
Git SHA: 61f1c8c5338a771fce635a31353ff138e74080bf
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
| Reverse trial | authenticated Edge Function atomically grants exactly once with null product/offering/package identity; server expiry RPC deactivates after 7 days |
| Win-back | approved commercial state is exact: no-offer launch returns unavailable and standard fallback; any later native Apple offer proves eligibility, localized price, purchase, renewal, and fallback |
| Webhook auth | bad HMAC rejected, stale timestamp rejected, duplicate event id idempotent |
| Account deletion | mobile copy says deletion does not cancel store billing; server calls RevenueCat delete customer |
| Finance | $49.99 annual model, refund/churn assumptions, entitlement denial/leakage reviewed |

## Files

| Path | Status | Bytes | SHA-256 |
| --- | --- | --- | --- |
| .env.example | present | 16422 | c48da3e0c5eb2b900c9a721c35428f2b402b3577e1692b9fae0ad157c64ef091 |
| package.json | present | 21062 | 9941896bfa7a3ee09bff6dee4c377410c6009c417111786732e974503cf42ca0 |
| docs/hugeToDo/launch-contract.json | present | 2935 | 43bea3c862d7e36c7e8d744b87bcf21f65d721500e71e1f1cfa7492fbb14ee4b |
| scripts/launch/contract.mjs | present | 6676 | 6a3ced1c0e7e54ef7db31e848aeeebd3617a77db02c3b51c98d6ee3789a9007d |
| apps/mobile/src/lib/iap/revenuecat.ts | present | 18317 | f89981290f02bc355ca4ac279b9e660c86d480a9c6e54b041a4d600f0468b105 |
| apps/mobile/src/lib/env.ts | present | 6982 | cee9823ec5d10a90a7dfe0596ce6c9d9b23e3a48d875e7093574b1384a7c1447 |
| apps/mobile/src/features/subscription/store.ts | present | 18069 | 6ec155fe3fcc419dbee2c35774006fc376519b63991f391e90c587f399701c81 |
| apps/mobile/src/features/subscription/useEntitlement.ts | present | 8996 | 985461773303cd3a9505999ecfeb4c06d72db0e14fb2a056cbf5394cc6dec7c1 |
| apps/mobile/src/features/subscription/useSubscriptionOffering.ts | present | 706 | 1652dfe2e6eeb73c7e1ac752fe684465f7083456156a9fc339b122f3a32f752b |
| apps/mobile/src/app/onboarding/paywall.tsx | present | 13073 | 8431d6eaf1af5b9b3b11929ca846234384beecfeb6606cece8c5b460686530c3 |
| apps/mobile/src/app/paywall/upsell.tsx | present | 10439 | 3aa577c240eaa5085db61a9bab40ece1138bd640f177ef44a3dac1a3d4d4c9eb |
| apps/mobile/src/app/paywall/reoffer.tsx | present | 9007 | d641e51cf1e1eea76e05bcd5eeb3ca824832465921ae5122fda824762f63a682 |
| apps/mobile/src/app/paywall/downgrade.tsx | present | 5506 | 8df92df0e0523dfbef418973ab376249bfbbca7f066f02942ff5256b732faa20 |
| apps/mobile/src/app/paywall/winback.tsx | present | 7585 | 607e9183342717447fcdeea518bcd20f05d5128e407c8e55f4c11e5e0dc5068d |
| apps/mobile/src/app/settings/subscription.tsx | present | 15590 | f3259cbed4d0b74ba9825b104ae6d30164d208c1db73a1994a1a9a9ee63ef8d1 |
| supabase/functions/revenuecat-webhook/index.ts | present | 6685 | 968f41a01907c3f230b05b570bf31c85836105f532e70c9dbaebd594376840b5 |
| supabase/functions/subscription-grants/index.ts | present | 3350 | 754c849c1e774f3429f9949d90fd599eac79dc23aa0b5c5eb4b057884a11ad10 |
| supabase/functions/account-deletion/index.ts | present | 15316 | 7441711f06bd443c3d299c4607950c85ac586226c5d9879eeea601511a54659a |
| supabase/migrations/20260615000027_phase6_payments.sql | present | 3061 | ac68e551a04d938548f93da78994984786e29b3bfdda51d52f39f7371e6b6865 |
| supabase/migrations/20260707000035_phase6_reverse_trial_atomic_grant.sql | present | 3947 | a88b75b7cfc6cd0fc791d04f466f9ab30b268c892a1603d919f08fe6ae8e2a02 |
| supabase/migrations/20260713000044_reverse_trial_no_store_identity.sql | present | 4979 | 6644e557e25f9475629b583f16e4db28eb7811ec3a7123eebc3ecb296db8f841 |
| apps/mobile/src/features/subscription/paywallMobileContracts.test.ts | present | 38547 | 4cfecd7a571a82cda68f8b3f7eabaaa485e79bc00bfd8bc643ab9cbdd1c6072c |
| apps/mobile/src/features/subscription/store.test.ts | present | 20946 | 48f7eaa7af2864c8bf09bf9b458c1104d832b6f055e06e44f409870ceb609881 |
| apps/mobile/src/features/subscription/entitlement.test.ts | present | 3970 | 2ef807ac5ae4b4bdf0d83e47c3a37c7d1de4eb425c436fec17177991616a273a |
| apps/mobile/src/features/subscription/serverContracts.test.ts | present | 5589 | 8570de7a1ede32e81b99ec209011db7fd3483971d14d5da33d0c8dfb4718f157 |
| scripts/phase6/build-payments-qa-packet.mjs | present | 15407 | 87d7824d90cb1c3fa5f8abedbf31b7d82346943fbe57ca6904666b9c51e96ad0 |
| scripts/phase6/check-payments-env.mjs | present | 10888 | a759ca81c4905f1123a8cd62b285279cabf2bb902ea17ac910f41b04827732ef |
| scripts/phase6/check-payments-env-smoke.mjs | present | 10775 | 1cfdc08c66f9bf5ec1e16443cf5677c5745ebe969171757db2e1bbc9f49acfd2 |
| scripts/phase2/check-env.mjs | present | 11132 | 520719a738da550be0181335e8175f04f8e8d93c1450b99d2e67546fe9415380 |
| scripts/phase2/check-env-smoke.mjs | present | 11419 | 9da4e944217b3e440122690644f4e410ab1017393b04bfcc8f2bd0768421bb66 |
| scripts/phase9/supabase-policy-lint.mjs | present | 9417 | 937e2ffda3ba57f7cb0f4b82892529695815b15c2e42da8e3c0f952cd4a77c89 |
| scripts/e2e/human-e2e-manifest.mjs | present | 59344 | 38e229c125f6c077d68722ff792825f750610f1e8610008c61834e9f43e6cfe9 |
| scripts/phase9/lib.mjs | present | 20344 | 01fd4497bb9bb34e80f51a8daa76513edb383c6cb68686b22e72b8e4d8cf5665 |
| docs/HUMAN_SIMULATED_E2E_TESTING.md | present | 10431 | db247b2acad570745d13b73913e3a18bef5ba9e4ea8d682322adfac7daa131d8 |
| docs/E2E_TESTING_CHECKLIST.md | present | 3632 | 1f37a8c5f6565073dfc4998dd2a46d6c3fbe6cba8f8dc4662039321af75be95f |
| docs/USER_FLOW_TREE.md | present | 358190 | 1eeb5ae98ce1c98f9f479c9fe720a6ad0eb52a6959fec5f3dc3c54c5696ca461 |
| docs/e2e/generated/human-e2e-manifest.json | present | 41722 | 2bf6783f104ede6f29d16a4c4f41d78a73ad26ca9208e387b198df28c582a8f2 |
| docs/e2e/generated/human-e2e-manifest.md | present | 16508 | 3d34c5c586b41e4c5f77973636bcdb3ad99345c48b645303119f7aa558f81cad |
| docs/phase-6/payments-runbook.md | present | 4930 | df69aa37fc10c1d7e82ea7f79ad1f897b99b449b6d33d31ffaf083431fe7927c |
| docs/phase-6/payments-qa-checklist.md | present | 4421 | 7cecda908ebe97e68dee7a1ee9f03efc44f3299bdd3409250ee991ba39577fa6 |
| docs/phase-6/phase-6-exit-review.md | present | 2755 | 0ce0003af4a03b66cde2bafe235bae50fbe3a9e66f6ff0b107f74e4c64cd50df |

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
