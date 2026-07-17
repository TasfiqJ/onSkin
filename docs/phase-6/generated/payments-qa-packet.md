# Generated Phase 6 Payments QA Packet

Generated at: 2026-07-17T00:25:30.809Z
Git SHA: ddaf13358fd1b38db645eb574e40df2b2d903a04
Git status: clean
Required inputs committed and byte-matched to HEAD: yes
Tracked secret environment files absent: yes

Strict completion requires real RevenueCat offering review and store restore evidence for every contract-required platform, webhook HMAC replay evidence, finance signoff, and a named owner.

## Evidence

- RevenueCat offering reviewed: BLOCKED
- iOS sandbox restore pass: BLOCKED
- Android license test pass: NOT APPLICABLE
- Retained RevenueCat V2 production project/access evidence attested: BLOCKED (the flag records that retained evidence was reviewed; it does not itself prove access or permissions)
- RevenueCat V2 redacted access evidence valid: BLOCKED
- RevenueCat V2 access evidence path: BLOCKED
- RevenueCat V2 access evidence SHA-256: BLOCKED
- RevenueCat V2 evidence project ID: BLOCKED
- RevenueCat V2 key binding fingerprint (SHA-256; not proof of access): BLOCKED
- RevenueCat legacy V1 key binding fingerprint (SHA-256; not proof of access): BLOCKED
- RevenueCat V2 access evidence reviewed at: BLOCKED
- RevenueCat V2 access evidence reviewed by: BLOCKED
- Webhook HMAC test pass: BLOCKED
- Finance signoff: BLOCKED
- Signed off by: BLOCKED

## Production Config

- EAS production app environment: yes
- Tracked templates/build config exclude server secrets: yes
- Production excludes RevenueCat Test Store key: yes
- Entitlement ID is pro: yes
- iOS RevenueCat public key configured: BLOCKED
- Android RevenueCat public key configured: NOT APPLICABLE
- Annual product ID final: BLOCKED
- Monthly product ID final: BLOCKED
- Webhook shared auth configured: BLOCKED
- Webhook signing secret configured: BLOCKED
- RevenueCat secret API key configured: BLOCKED
- RevenueCat project ID configured: BLOCKED
- RevenueCat V2 secret API key configured: BLOCKED
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
| .env.example | present | 25653 | 668f23c9f7fbb2098868ed170f1352eafdda85184256297701a2458736ca71ad |
| package.json | present | 31779 | 85289af8e3524cee2cdafba5c29813017a2fd3a9b1ac41e05d99e5e116340f5a |
| package-lock.json | present | 557143 | 0b817f6d89ea2b318e59d3bbc83203047ade24ab7496ba6ff2c91ff14356f850 |
| apps/mobile/package.json | present | 2897 | c328396d64378a47dd6bd99172a6c6e1abbc562e0c290ad1fc08fcb3dd4fdd80 |
| apps/mobile/eas.json | present | 1477 | 54ff13dfed579d16f30e1b7ff095bde79bee8bd4280150090e1da66e1ba4cbb6 |
| supabase/functions/deno.lock | present | 2282 | 0f8de63ed60182b56865cfa47c666866b631ed4681c79345ec31a720565d1a3a |
| docs/hugeToDo/launch-contract.json | present | 2935 | 43bea3c862d7e36c7e8d744b87bcf21f65d721500e71e1f1cfa7492fbb14ee4b |
| docs/hugeToDo/PAY-06-ENTITLEMENT-AUTHORITY-LANES-2026-07-14.md | present | 11287 | b3aa6768944665294ecc730c23a4834d150cb09328571befa0edd145697783b5 |
| scripts/launch/contract.mjs | present | 6676 | 6a3ced1c0e7e54ef7db31e848aeeebd3617a77db02c3b51c98d6ee3789a9007d |
| apps/mobile/src/lib/iap/revenuecat.ts | present | 37617 | 6ae4921ebcdfd202dad381661dddcefd28add835b2502328946c8ae1a52b0358 |
| apps/mobile/src/lib/iap/revenuecat.test.ts | present | 2427 | ee01c705dd9a77db4dc527d00fae8040b1e5315d2624193330afbd35ff144c0f |
| apps/mobile/src/lib/iap/revenuecatPublication.test.ts | present | 16262 | fbf6e643684dbdb4464b620885256936762803190e4df8c798af12e5f61a080f |
| apps/mobile/src/lib/env.ts | present | 6982 | 22ebe3a408c87b87be7da9e4a2282feba8620d88405b43216eb961966bfb5b31 |
| apps/mobile/src/features/subscription/store.ts | present | 60455 | 2e5e3e65abd8fc2e36b8e6bd0b9e369291829249d92740c0011d1f87d61101d8 |
| apps/mobile/src/features/subscription/entitlement.ts | present | 5813 | 735938df18d9a15c383c7017102c9626b538ab90f0f7e0ef9054d7b14de9e9ec |
| apps/mobile/src/features/subscription/entitlementEvidence.ts | present | 18546 | b8d11b40a3ec16703e42442a49f7a6a4582ea7a2c190a7e2f271326fbf5b61f9 |
| apps/mobile/src/features/subscription/entitlementEvidence.test.ts | present | 6620 | 3b54db67533690960a45168349bbad40dafb7a036ad31dbd669216a78f5e7c75 |
| apps/mobile/src/features/subscription/useEntitlement.ts | present | 17046 | 07ae96a482701392e841b70aff84a77e44ea0c35ea1e4659eb2fe2f58d8ab59c |
| apps/mobile/src/features/subscription/useSubscriptionOffering.ts | present | 761 | 9f765eb64c59b0a27f5b815b16fa829465322e1ee5dab866230bb6afe5af1a8a |
| apps/mobile/src/app/onboarding/paywall.tsx | present | 13146 | e5851cd5b74fbed61d537e36111634ca951c841ad7dfc1999c1086ff4504f6ad |
| apps/mobile/src/app/paywall/upsell.tsx | present | 10512 | 2ee92b7d43f0a596808d920b2e4cb702f9693ed00fac511a4d1521bd44af6d5a |
| apps/mobile/src/app/paywall/reoffer.tsx | present | 9080 | 40ff7c91d9ea2a3c529c697692fdfbcb98294f00dcc8b684ac2a0cde3a01fc9f |
| apps/mobile/src/app/paywall/downgrade.tsx | present | 5579 | 4eb6fed57d358c1f2503be13cd8571f99adc157b362be3776e723285cd4ef92e |
| apps/mobile/src/app/paywall/winback.tsx | present | 7658 | 74c02e7dd2118b1c8a7fb05db47693b35f2b6fb037c95c080c33232eb1529104 |
| apps/mobile/src/app/settings/subscription.tsx | present | 15690 | bd57b2f188f7631787f4bc3cb418b1247c9d67962f8c939c63aed1c1afff7772 |
| supabase/functions/revenuecat-webhook/index.ts | present | 7924 | 5a8f373654768965232ee87b0aa407806d369a33e3ac7598a3d850fde480e0f6 |
| supabase/functions/revenuecat-webhook/webhookCore.ts | present | 22878 | b4e1b8b677c7d4a419ccec00f288643debd4cd810bab5ef72f58819c4734e154 |
| supabase/functions/revenuecat-webhook/webhookCore.test.ts | present | 34744 | e892bcec5deba6a27572f53b87e9acb4fea87fba3fbda134388719f3fa949390 |
| supabase/functions/subscription-grants/index.ts | present | 4512 | 6aea31f612dc3ef6cb0011df0c126f26150b3d8d4c9d2eae4b6266e22815e8d0 |
| supabase/functions/subscription-grants/grantErrors.ts | present | 1228 | bea0805decc23cd51e203b58c577b13343ff1c4a46a7a678b54000b1f8fdfcc0 |
| supabase/functions/subscription-grants/grantErrors.test.ts | present | 2058 | ed3094a5e0da9fe098fd7d88f5139cf3d7e07870838d0e58a232a91302cda973 |
| supabase/functions/subscription-reconciliation/index.ts | present | 11629 | e1c30509a29a2b6e7b56bf7f5dc8b6aa82c50d2c876a52f4ebc2ff55ab773821 |
| supabase/functions/subscription-reconciliation/publicationLease.ts | present | 5726 | c9a14414a30e17579b381bcdfb87b48216a610d755b3cc1cb7b0bdfbe4520248 |
| supabase/functions/subscription-reconciliation/publicationLease.test.ts | present | 7149 | 62aa58fa50f9de6211d0f2f038397b03856d082a53e3f138048ba733363a2e8a |
| supabase/functions/subscription-reconciliation/reconciliationCore.ts | present | 14210 | 704d863946f59c8744cd949c7875f07dfdf9215e8ec51291c5fe1f63c6f06043 |
| supabase/functions/subscription-reconciliation/reconciliationCore.test.ts | present | 11386 | cff4523c5cf1305f90be5889ad366582f32717804fe4d99d524cebf5c7b87ec3 |
| supabase/functions/subscription-reconciliation/reconciliationContract.test.ts | present | 4242 | 1d724448169cc36cba21d0efd84d2e586a820e718bac1f025d974ea77e1c75b1 |
| supabase/functions/_shared/verifiedAuthSessionClaims.ts | present | 2358 | 39db868ee1aa517c95b03102990793d52ad45079b6b18bbebb5640ee44207443 |
| supabase/functions/account-deletion/index.ts | present | 1722 | d4fd2917de31d91d010788a3c45d390de61fefd770f090ff5f1242f385b2f7f2 |
| supabase/functions/account-deletion/durableDeletionRuntime.ts | present | 30369 | 5d3f7b1c565016dbfd3bd6288c14f8c1a6b58a60a94815eb3bc85926cae8976f |
| supabase/functions/account-deletion/durableDeletionRuntime.test.ts | present | 21148 | 5d3803afe5b7d2a91769cc92aa4ec6a3c7dbef28c317fe5beadef48cb05470dd |
| supabase/functions/account-deletion/durableProviderDeletion.ts | present | 87521 | 57cbc94e8d6807c45c9f92a66f321cce853679a0504cf48906d4160c8e3875ea |
| supabase/functions/account-deletion/durableProviderDeletion.test.ts | present | 57456 | 10eee00dcae5b2e9961c23ff096049ad4c2fb1d7289d233c5c853bcab9cab6cb |
| supabase/functions/account-deletion/revenueCatV2DeletionExecutor.ts | present | 75697 | ccbaf7e0d38c415e013522ba82ecdd5964ca8fc58b77899e7b20974431375fcc |
| supabase/functions/account-deletion/revenueCatV2DeletionExecutor.test.ts | present | 70138 | d21b4af5236130bb395ce9b739ecd6e018355ee16f48fcf65153bf82b3b6f0b2 |
| supabase/functions/account-deletion/providerDeletion.ts | present | 11122 | ab2afbf0ea3beb53373df06b0e073f77b70c2f8d76fd5afa9c23d6d67010d746 |
| supabase/functions/account-deletion/providerDeletion.test.ts | present | 17762 | 336488fc323c9dcf681e2df7781ece7bf144974fa705b6bd42c01a5d377e4fbf |
| supabase/functions/account-deletion/serviceRoleCleanup.ts | present | 3440 | f8d8d06f9fdf4b940af912773c6293eeb4530df110c8279b7d58788f344f053d |
| supabase/functions/account-deletion/serviceRoleCleanup.test.ts | present | 16530 | e93c3fe4cd82445ad5833a148ec5aaee95eb95b17b29e02170693623b3f4f95a |
| supabase/functions/order-report-poll/index.ts | present | 5552 | 8574b39ddfac908f1fa156b5c8e64fed8899f682563dff1fdc6981ec4e81d8ce |
| supabase/functions/order-report-poll/orderAttributionCore.ts | present | 10537 | 434abcf6f1f7424d503fcec137bd799dc66b520c26d0e76bd36d0820f1dfa7f0 |
| supabase/functions/order-report-poll/orderAttributionCore.test.ts | present | 14124 | 63105c5562be39504a68075984320cb2105d8f84be04d67d282135f79fb30f6b |
| supabase/migrations/20260615000027_phase6_payments.sql | present | 3061 | ac68e551a04d938548f93da78994984786e29b3bfdda51d52f39f7371e6b6865 |
| supabase/migrations/20260612000009_entitlements.sql | present | 1794 | 84344d8fd84b18f5aca66c95c30c8d526d182f7c9368feb1d999064c837e8f35 |
| supabase/migrations/20260613000020_subscription_extensions.sql | present | 1760 | f841d764f0272cf4ac83a237d26807ac9bd9aff8e010535097f26b9d21320714 |
| supabase/migrations/20260707000035_phase6_reverse_trial_atomic_grant.sql | present | 3947 | a88b75b7cfc6cd0fc791d04f466f9ab30b268c892a1603d919f08fe6ae8e2a02 |
| supabase/migrations/20260713000041_revenuecat_webhook_atomic_projection.sql | present | 15783 | 6a14eb82016bcd28ffcda9f81f17958329a54cdaab37af64bd2cfe71bbcf2efe |
| supabase/migrations/20260713000044_reverse_trial_no_store_identity.sql | present | 4979 | 6644e557e25f9475629b583f16e4db28eb7811ec3a7123eebc3ecb296db8f841 |
| supabase/migrations/20260713000046_account_service_row_scrub.sql | present | 45399 | 268234dbc7c423eef097a2ea17790b871d8413913df71006c73d686e3bd471cf |
| supabase/migrations/20260713000047_account_obf_contribution_erasure.sql | present | 8297 | 152f6ecaf1def7bebd0a5ff1d71b4152b336de72dc8ce8e465f071810f7d023b |
| supabase/migrations/20260713000048_account_deletion_lifecycle_and_rate_limit_ownership.sql | present | 87091 | 7a2d2eb4f6569044ffd94b74ba76dbed20723cecfbb22b11e325649c1d1fa1ad |
| supabase/migrations/20260713000049_revenuecat_deletion_barrier_guard.sql | present | 13861 | 7fc2228015a2aee2b862d1f31d7775547b2f160a93a1ed7ca685848d0bff1f9f |
| supabase/migrations/20260713000050_service_writer_deletion_barriers.sql | present | 10168 | b9224e00b774752c53f34a0ea82fcb1ac72a39c40ed1337b7c2266721876808d |
| supabase/migrations/20260713000051_revenuecat_identity_tombstones.sql | present | 35892 | 887bc82835479875553b4a2b71b9e756a6507a2ad15c5903a4e02762c05a268c |
| supabase/migrations/20260713000052_account_publication_fence.sql | present | 77778 | b19dcada637f30c4a7756711aed2ad6809877f2e043fc79c9c36ed107169b05d |
| supabase/migrations/20260714000053_entitlement_authority_lanes.sql | present | 36742 | d1aba134336ccb38292134dc5e10528b6a9370489413e5bd2b7992c03525cec1 |
| apps/mobile/src/features/subscription/paywallMobileContracts.test.ts | present | 38597 | 7889b5f7ad4c9ada4dbd9f89dcfd9f78a3f032058a636b4ddf960ef423ace2af |
| apps/mobile/src/features/subscription/store.test.ts | present | 32970 | 9074c92b587abc09f8df3e1d05c3fb4c0e95a38fd9a6ef6f4e00361a678e385d |
| apps/mobile/src/features/subscription/entitlement.test.ts | present | 3970 | 2ef807ac5ae4b4bdf0d83e47c3a37c7d1de4eb425c436fec17177991616a273a |
| apps/mobile/src/features/subscription/serverContracts.test.ts | present | 7049 | daca502833a84b5c01167cbe3b1c0c72e2042bc6514cbda4e56329f284f3f5be |
| scripts/phase6/build-payments-qa-packet.mjs | present | 32780 | a2dab123bfe37998053a83e37fc6338ea576db916ea49cd9e0428ae4133a6650 |
| scripts/phase6/check-payments-env.mjs | present | 20288 | 498d6aa19890a60815b6b70827e18aa7c3656e7057b66aa004b32f1e7ced9ddd |
| scripts/phase6/check-payments-env-smoke.mjs | present | 28944 | a00eebd347a8ada213256e2f1d72663f5bcbdff531d2c6538472fe5f245f0a83 |
| scripts/phase6/payments-git-provenance.mjs | present | 1409 | 0bafbaf1f9481a739880d5cfb51dedc1b7d7c0919dabddd35ebc239416e3f7a0 |
| scripts/phase6/payments-git-provenance.test.mjs | present | 3384 | 38e99203fbcfe288b77198d6fc4d3202e884ba6ffc457a24377bfabb203426b7 |
| scripts/phase6/payments-revenuecat-access-evidence.mjs | present | 11388 | 013c798d7bef14efafc95d00e841fc5e4a90e28a998f96aac43b43aad72c1372 |
| scripts/phase6/payments-revenuecat-access-evidence.test.mjs | present | 10042 | 90d4ae157d9822acb59f44bfa5d2916ec0ba9160102ac676e9656ea98aafef5d |
| scripts/phase6/payments-source-contract.mjs | present | 60242 | f10255f95987b1b280f35c63aa137dfcfe4822d923a27eaecfaf6f4611fecc98 |
| scripts/phase6/payments-source-contract.test.mjs | present | 23395 | b3c8c9488f437e03e7ae6b807a21b6db061045b90f0124e5c2dd6b14fbb16e80 |
| scripts/phase2/check-env.mjs | present | 21920 | c12bcc548afae7cae1992c290ef65f5a425ccbbb52edba1b4931a3e7a3d2298a |
| scripts/phase2/check-env-smoke.mjs | present | 25482 | 8b9de5340f2fb90f70d9d70f3ea0d1598e7507d3d7abed3890da145f82d0f270 |
| scripts/phase9/supabase-policy-lint.mjs | present | 13160 | 0e95f2369730db305c553dcdab24848ba25674fad0546dec4d09bf89d089535d |
| scripts/phase9/account-service-scrub-postgres-rehearsal.sql | present | 26077 | b4898279189ebca369eaa9f212632d0a903917fe137c8ccbbec994cb3c34743a |
| scripts/phase9/live-data-rights.mjs | present | 65161 | 0e6d7604437b35fa2e9f1fa2a6afbee6743cac829f58f0861e9aff46a28df13a |
| scripts/e2e/human-e2e-manifest.mjs | present | 75305 | 15a92f3558f39b6c8efb47159e43270a532de13dfeae5f02f56fdca385eca9b7 |
| scripts/phase9/lib.mjs | present | 24487 | 0eb82d148d6cc293b6cea56baecb0f24172e04e548a57d8815e951eb6ce66ff4 |
| docs/HUMAN_SIMULATED_E2E_TESTING.md | present | 10431 | db247b2acad570745d13b73913e3a18bef5ba9e4ea8d682322adfac7daa131d8 |
| docs/E2E_TESTING_CHECKLIST.md | present | 3632 | 1f37a8c5f6565073dfc4998dd2a46d6c3fbe6cba8f8dc4662039321af75be95f |
| docs/USER_FLOW_TREE.md | present | 398587 | 14be278a1f1d0a14d1d5d5ffffb0fe82fdc89f38479e82d9b3b8606e9cea9a1f |
| docs/e2e/generated/human-e2e-manifest.json | present | 48121 | 91499428e76938d01826dd760888c65129b5bde37f4c8bac98dfdc7915e8585f |
| docs/e2e/generated/human-e2e-manifest.md | present | 19687 | c662775245067ea876359602b379caa33c30fdc1f31b6452ac750e2b27cfe4fd |
| docs/phase-6/payments-runbook.md | present | 11302 | 676492b480b32f12c6fe829962f33a3f31bd597f2e2f4a7aa319e63e0f1da821 |
| docs/phase-6/payments-qa-checklist.md | present | 7870 | 847c0775f45ae6eb6afcc78acc33d38ca128e14db1d32723cac7003d5d6fd2d5 |
| docs/phase-6/phase-6-exit-review.md | present | 4798 | 85e5e80e3d3b14d12cbeae0a4abdbf7a66eba1128b527705bf076a6957fbba28 |
| docs/phase-6/revenuecat-v2-access-evidence.template.json | present | 852 | d70276f6b45d1fb21974eb7d9bd82f3f613232cf29a5e9cd8966aa84f85941d3 |
| supabase/functions/_shared/appleVault.test.ts | present | 5247 | ea14584e1dce69e82134b82064491ae1662eba352391c94ac8fcc1c8cd710026 |
| supabase/functions/_shared/appleVault.ts | present | 11831 | cf6cc69449ccbaa9acfb39ec7f70e6c9130da22799a395a94175a38e2b29de62 |
| supabase/functions/_shared/auth.ts | present | 321 | cac2bbac4936c570508b764482d8c396693bda989f4f605514b8a3ca06397999 |
| supabase/functions/_shared/body.ts | present | 1707 | 03e9ddbd56df2875f78b4f582ffdae13f0deca50d75d44ed3a5df4d685b39e6a |
| supabase/functions/_shared/env.test.ts | present | 2546 | 2b4c2caf437202cc2711aacf68b32a770601c99daeac0957b233896b1a3dcc38 |
| supabase/functions/_shared/env.ts | present | 2190 | 73a18a5941c812003251a779d0a945792353dc83aa628d310ca61660d5461e64 |
| supabase/functions/_shared/fetch.test.ts | present | 2223 | 3aad71c69a880c1a6d8778e4117737223dfdff7e5fa4199acee325430cd1fdca |
| supabase/functions/_shared/fetch.ts | present | 3485 | ec5037dc33ec951371156c429acf67bdc7e70df2596127f187946bea0985f2c3 |
| supabase/functions/_shared/revenueCatIdentityTombstone.test.ts | present | 5856 | 8471d17bcc33bb67c49c9ac1f5bb3f0d3a4adf019acf31652c62f1e7bbe1ddcd |
| supabase/functions/_shared/revenueCatIdentityTombstone.ts | present | 9464 | 69a7ef49ce80686fc0b503604219a4fbea1ac0439d58da83849615da22b6b9b3 |
| supabase/functions/_shared/stagingTrafficFreeze.test.ts | present | 2020 | 07ad57f798a149994ea617cbd54ec1fe1a14058bf8bd794b0c3ee8baafd20ac2 |
| supabase/functions/_shared/stagingTrafficFreeze.ts | present | 1064 | ce15829b5676fcd3daca31eaf010a6418a25a93fc99875f9790ad4ac06fdb0f3 |
| supabase/functions/_shared/storagePath.test.ts | present | 1355 | 3caf9cbb38b676c4a96dd9ae3f19479c205a90d31bb83fee7c7474bc76a2a2e9 |
| supabase/functions/_shared/storagePath.ts | present | 591 | 9367ade3719c7b7e38a7b090da7d904dd574bb43e29222bf5e8a839d3b377594 |
| supabase/functions/_shared/supabaseKeyMap.ts | present | 1499 | d8c89ac8ccb8f45213a50273aa28777de41ca322cde6d65cf206453bd87ebf5d |
| supabase/functions/_shared/supabaseSecretKey.ts | present | 836 | 4fc510692fd6627a2f28f4dbe1957f475f851a9ab8d257f2e68c1dd3daf95503 |
| supabase/functions/account-deletion/appleDeletionExecutor.test.ts | present | 8787 | e55f09381821abd93b0a8b54b9a67ada8260a6b880c5227f719e71f3335590d3 |
| supabase/functions/account-deletion/appleDeletionExecutor.ts | present | 6053 | bc30e1f1cb3a15f5203e3038191c830c47cf556fb05877d9679178b60a1229c9 |
| supabase/functions/account-deletion/appleDeletionNetwork.test.ts | present | 19446 | de51412cfad83e03f82d0637b47fd2ec2c2e776d61266d68e0525757cd07602e |
| supabase/functions/account-deletion/appleDeletionNetwork.ts | present | 20159 | 755073322aea362153c29c2a7114041903fcf398c5d1d026a09eb37e75a02c88 |
| supabase/functions/account-deletion/authDeletionExecutor.test.ts | present | 6000 | dd57439418166e2110e3173badb2df40f325eb382dbed924893b39d056109c1e |
| supabase/functions/account-deletion/authDeletionExecutor.ts | present | 4536 | 63bed68c219a5eec579454b5ec907cf037a4b9bdde118629949687bab1e3a1e6 |
| supabase/functions/account-deletion/deletionProviderNetwork.test.ts | present | 3225 | e40fc09581b7d085425e0d75d8c4f990ef4158c7e41aafde21304a156f484230 |
| supabase/functions/account-deletion/deletionProviderNetwork.ts | present | 4906 | 1b56a8956f8575833c03c3040015f29fa58b7bbe8bec307595326832ae2dc42f |
| supabase/functions/account-deletion/durableDeletionCore.test.ts | present | 20513 | 4b5eeb1f53314a657d6196d50e305346a0070fa833570ce30ae062db15aea310 |
| supabase/functions/account-deletion/durableDeletionCore.ts | present | 20356 | 5d4ad54e94c9c930f56dcaeeaa7a08b6f1841bf0899a8fc83cae4abd9f97598a |
| supabase/functions/account-deletion/durableDeletionCrypto.test.ts | present | 16760 | 9999256ad988831805838f53e45e94d32a355ddfbacf3cea68b8b0c35dedb8cb |
| supabase/functions/account-deletion/durableDeletionCrypto.ts | present | 16540 | 5ad0225c135733d25e38b4186cf9cc845822f556ae1763350d63aa9cfb0a6c52 |
| supabase/functions/account-deletion/durableDeletionDatabaseGateway.test.ts | present | 20292 | 5f8e0b2319656dc585d0a74386aebdbc623a0cc2b35fdbd3297547ee363790c2 |
| supabase/functions/account-deletion/durableDeletionDatabaseGateway.ts | present | 33874 | 9b7cd32ca6d8b50b8e5210579f6044de09859ca646aea21aca6a76d2d75c7958 |
| supabase/functions/account-deletion/durableDeletionEncryptedStateStore.test.ts | present | 2682 | ec655cd1c3a05dcb3cabf1c83211184b24fd73061b144e10bec94e752394c9d1 |
| supabase/functions/account-deletion/durableDeletionEncryptedStateStore.ts | present | 2810 | de77756d9e062d5562478e10417a1a81ad13ea41677b31b7982f093e6aa395fb |
| supabase/functions/account-deletion/durableDeletionHttpHandler.test.ts | present | 22284 | 2f2021465dd0f0ed855c0ab2f137e295483b9375181d9484ef1b85aa3552a236 |
| supabase/functions/account-deletion/durableDeletionHttpHandler.ts | present | 13332 | 1a32239694ee96b6ace4c21e86446d78c1fa1bbd3db2fad77d272fee988f42e5 |
| supabase/functions/account-deletion/durableDeletionPayloads.test.ts | present | 6563 | 38ce30de1e46b8156876e66684aa4355422c34b1a3a637d85fe38c0b92da6881 |
| supabase/functions/account-deletion/durableDeletionPayloads.ts | present | 8763 | c44a87c7139758453926e7369f172ac4e73551ebd0d100dc9ce73bea01c52dcf |
| supabase/functions/account-deletion/durableDeletionRuntimeCore.test.ts | present | 13777 | cd765768338f221b05a0ba47f4c81788ad01f2c338d4fcb62582891d0553d3f8 |
| supabase/functions/account-deletion/durableDeletionRuntimeCore.ts | present | 16165 | 34aa1d7af765ed0820c284068b8e01d7f8798fc9cc5a25d1d189adf07ab45bca |
| supabase/functions/account-deletion/durableDeletionWorker.test.ts | present | 11537 | 2ef47426e7c1c8d56a077318170f43b7a6975297cca214f8963142f3ce64ae04 |
| supabase/functions/account-deletion/durableDeletionWorker.ts | present | 8390 | 72ee02092659ddebc72e975f2e5222bb7936050deb6b4e9ea73227a4e111bd27 |
| supabase/functions/account-deletion/localDeletionExecutors.test.ts | present | 5662 | 6bb2b9104ac7f479afe9b6f9019fb64276351e81a93b66670f0a12ede6cc1914 |
| supabase/functions/account-deletion/photoStorageCleanup.test.ts | present | 7141 | 447cc4ff465f1de1c4bfe86b32fa41bc777bc3c9a95a95a9822d039d99744361 |
| supabase/functions/account-deletion/photoStorageCleanup.ts | present | 4296 | b693eedf3521d6e3214e0e0ccb84704b8f72c7931b32a954b61c1f4988ff14a6 |
| supabase/functions/account-deletion/photoStorageDeletionExecutor.ts | present | 3995 | 1c9a1ab84beb669226402259cbb9b1f0ab158461e5b4b7da69b8477b1bf3bf3e |
| supabase/functions/account-deletion/postHogDeletionExecutor.test.ts | present | 33952 | 5fa7cd63ebc998aec2c187b88408bfe6a9fe770893f03e33a331e8e1cfe270b8 |
| supabase/functions/account-deletion/postHogDeletionExecutor.ts | present | 53342 | 29a38f5fcfc15d74f55cfe809becaba2c78524bb846aa9683693166316201ff7 |
| supabase/functions/account-deletion/serviceRowsDeletionExecutor.ts | present | 1981 | 3a93798696be388478aabca75e163bd18f5d50bdb525ae6115387b02f963897e |
| apps/mobile/src/features/subscription/ComplianceRow.tsx | present | 5025 | 116fc975b950f6cf919471bd41c0530d1da8c08875d64d9f141bec10416cf514 |
| apps/mobile/src/features/subscription/PaywallFeedback.tsx | present | 2851 | b32214dc39986c6e3a92ecda688c761c965c2860448470c4839c4f229f399ece |
| apps/mobile/src/features/subscription/ProGate.tsx | present | 21628 | f7528d81a3fb52ac29a32ffc7902e48dd20c10b677e1e4abafcd11cff378bb15 |
| apps/mobile/src/features/subscription/ReverseTrialBanner.tsx | present | 2326 | b3453ed2c4b8efa0529d97decf7c352c03cae0411bc6bfbfba231212a5ec335f |
| apps/mobile/src/features/subscription/StoreTransactionNoticeHost.test.ts | present | 5863 | 0a0bd7d45eebe2a3429029e1c2586dd75b62aef97d10cc178d5d98fa8fb3b909 |
| apps/mobile/src/features/subscription/StoreTransactionNoticeHost.tsx | present | 12042 | 2add0b2247d702901aba3545efc4898b8b2166d105b83859bdf13aa6049c1bd0 |
| apps/mobile/src/features/subscription/cancelIntent.test.ts | present | 1780 | d950be6fe9113911fb318323d4a5b7a0fdcb2a1574ee2ce567dd56377d019660 |
| apps/mobile/src/features/subscription/cancelIntent.ts | present | 542 | 401681a7d3bed2d27b84599b1fc6321de1afb8d4cef1930bbe0d54597fc86dbe |
| apps/mobile/src/features/subscription/claimsafety.test.ts | present | 3455 | ada28dacdc9700b7b387e4a89980fe84c70423f07d1021172cf5230ad9680b45 |
| apps/mobile/src/features/subscription/conflictQuota.test.ts | present | 4710 | 240c045085f2c6a9b622d723607df62e6697edc3d50e5db877a4efb004503f5d |
| apps/mobile/src/features/subscription/conflictQuota.ts | present | 3595 | 0e88478e0ca325c0650bde53a223a2b06a0252f8dba370688b4b7d3eb06dd538 |
| apps/mobile/src/features/subscription/copy.ts | present | 8325 | 1a9ce7ca24c4de4b8631166a12351307e8facb6372bec4262193ad726147477c |
| apps/mobile/src/features/subscription/dismissPaywall.test.ts | present | 2567 | 0b6b18e59315bf79fc066ba0dd5bc544fcb93a896b9205e223d6af7d39668265 |
| apps/mobile/src/features/subscription/dismissPaywall.ts | present | 886 | f0e2425be6b3742ba8da23db5c36b326f8810d1f3285fd1015f9308072d400d9 |
| apps/mobile/src/features/subscription/gatedRoutes.test.ts | present | 1109 | 9d50f012762bc49dadef8736536ab807af198b970189df5c901d4375a83f7a4f |
| apps/mobile/src/features/subscription/gatedRoutes.ts | present | 483 | aea4630a6d619bc5a10f6ee247d46af66f0a29887db6f7da869f7f12fdacd4af |
| apps/mobile/src/features/subscription/lifecycle.test.ts | present | 3609 | 7a6fa4b798d5db895852bb635c1915f84dcede71457133ae2a2e767b9f4c7a68 |
| apps/mobile/src/features/subscription/lifecycle.ts | present | 3380 | d474cb495f3ea7250f159d2236605bb19383051202127aad225faca82a356804 |
| apps/mobile/src/features/subscription/plans.test.ts | present | 1722 | 23c775e3e8097b29f727b29157a62659e0a61ae726f7db1b019bd55c41749882 |
| apps/mobile/src/features/subscription/plans.ts | present | 2677 | 3e6f35b07b59b875d9ee7b337f341f227dd6f42f5178b501c4fdda2242225e22 |
| apps/mobile/src/features/subscription/priceDisplay.test.ts | present | 3483 | 420ec71fc37fed57e2ecc31fc5ccd19098289051b29bb18e9b79f13c2b7c180f |
| apps/mobile/src/features/subscription/priceDisplay.ts | present | 1789 | 2fe6c0d3c47f9eecdef15e31b4720c47afa00c74c97b14c738583648043ea296 |
| apps/mobile/src/features/subscription/proGatedRoutes.test.ts | present | 15570 | f9514722836aafe40e3882fb20a188f3c0a8ce4b494cb4ab49761779cd4b5356 |
| apps/mobile/src/features/subscription/storeTransactionNoticeContracts.test.ts | present | 6647 | fe93dd56547bbdf2c7307897b80d9f6af56a660b261ba72089bf7ea2a4a8fd12 |
| apps/mobile/src/features/subscription/storefrontCopy.test.ts | present | 2414 | bf337ddc1a4eb1656bb67eafc78133c36026b33f8797ebcef47e0deba889c561 |
| apps/mobile/src/features/subscription/storefrontCopy.ts | present | 1929 | 77cf3ff8188121e6ac2854595e0a79b2b9f71e794f8ddb4e773ae9a81bdaedcc |
| apps/mobile/src/features/subscription/useEntitlementEvidenceContracts.test.ts | present | 1052 | 54fe20269bdcc074b7ec48482838981c04b42a352db12a23984d356336b5cb64 |
| apps/mobile/src/lib/iap/storeTransactionNotice.test.ts | present | 25084 | e29af8a370e06282d1602e7d9279a24b7f2f3f385344e6fb7af2fb8488d9b92f |
| apps/mobile/src/lib/iap/storeTransactionNotice.ts | present | 25776 | 85ca3b06ddcd1ca2d084e74a8d55065794af5c96cc253178f67b45a801da9ce4 |
| supabase/functions/_shared/accountAccess.test.ts | present | 4985 | e4322b71cf6fd3bc61775a8b4a340d03765fc4e53ac61cc349d588e67861b746 |
| supabase/functions/_shared/accountAccess.ts | present | 3438 | 3a5ec1140587e88efb3caf49c4779dd44fdb2a9219f3dbf9e44deb9b8a6502e0 |
| supabase/functions/subscription-grants/deletionBarrierContract.test.ts | present | 5012 | 30ca9f7926bef7371a658484fd58b15c7229e650cbf622eb8f92b19af943cab2 |

## Blockers

- Missing PHASE6_REVENUECAT_V2_ACCESS_EVIDENCE_PATH.
- Missing final EXPO_PUBLIC_REVENUECAT_IOS_KEY.
- Missing final EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID.
- Missing final EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID.
- REVENUECAT_WEBHOOK_AUTH must be a high-entropy 32-256 character token.
- REVENUECAT_WEBHOOK_SIGNING_SECRET must be a high-entropy whsec_ token.
- REVENUECAT_SECRET_API_KEY must be a final high-entropy sk_-prefixed legacy V1 key.
- REVENUECAT_PROJECT_ID must be a final proj-prefixed production project ID.
- REVENUECAT_V2_SECRET_API_KEY must be a final sk_-prefixed V2 secret key.
- BRAND_LEGAL_CLEARANCE must be cleared for production.
- EXPO_PUBLIC_PRIVACY_URL must be a production HTTPS URL.
- EXPO_PUBLIC_TERMS_URL must be a production HTTPS URL.
- EXPO_PUBLIC_SUPPORT_URL must be a production HTTPS URL.
- Missing PHASE6_RC_OFFERING_REVIEWED=true.
- Missing PHASE6_IOS_SANDBOX_RESTORE_PASS=true.
- Missing PHASE6_REVENUECAT_V2_CUSTOMER_DELETE_ACCESS_PASS=true.
- Missing PHASE6_WEBHOOK_HMAC_TEST_PASS=true.
- Missing PHASE6_FINANCE_SIGNOFF=true.
- Missing PHASE6_SIGNED_OFF_BY.

## Warnings

- none
