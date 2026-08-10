# Generated Phase 6 Payments QA Packet

Generated at: 2026-08-10T01:37:48.524Z
Git SHA: fa0aa21c1fa2020a3e2a9624daf4051f4564dd8f
Git status: DIRTY
Required inputs committed and byte-matched to HEAD: BLOCKED
Tracked secret environment files absent: yes

Strict completion requires real RevenueCat offering review and store restore evidence for every contract-required platform, webhook HMAC replay evidence, finance signoff, and a named owner.

## Evidence

- RevenueCat offering reviewed: BLOCKED
- iOS sandbox restore pass: BLOCKED
- Trusted Entitlements review attested: BLOCKED (the flag records review; the governed artifact below supplies the cross-bound evidence)
- Trusted Entitlements governed evidence valid: BLOCKED
- Trusted Entitlements evidence path: BLOCKED
- Trusted Entitlements evidence SHA-256: BLOCKED
- Trusted Entitlements RevenueCat app ID: BLOCKED
- Trusted Entitlements bundle/build: BLOCKED / BLOCKED
- Trusted Entitlements immutable source Git SHA: BLOCKED
- Trusted Entitlements mode derived from reviewed source: BLOCKED
- Trusted Entitlements retained observation artifacts: BLOCKED
- Trusted Entitlements evidence reviewed at: BLOCKED
- Trusted Entitlements evidence reviewed by: BLOCKED
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
| Custom app grant | production/staging config and release UI keep the custom full-Pro grant disabled; dormant backend one-grant authority remains development-only pending separate Apple-policy and anti-abuse acceptance |
| Win-back | approved commercial state is exact: no-offer launch returns unavailable and standard fallback; any later native Apple offer proves eligibility, localized price, purchase, renewal, and fallback |
| Webhook auth | bad HMAC rejected, stale timestamp rejected, duplicate event id idempotent |
| Account deletion | mobile copy says deletion does not cancel store billing; server calls RevenueCat delete customer |
| Finance | $49.99 annual model, refund/churn assumptions, entitlement denial/leakage reviewed |

## Files

| Path | Status | Bytes | SHA-256 |
| --- | --- | --- | --- |
| .env.example | present | 29662 | d9825f22149f8d15e491d4f1d97fbc8311ce739564a36e1f0ed0ecc64464e091 |
| package.json | present | 44354 | af6cec1697c363daf266bcd4032a184aa9a994a51cc6a8c0991da4c67b0d8c8e |
| package-lock.json | present | 607493 | c7d3880abf0211eadd0644ee2531fbba507d8661ed379c8cead68095c7bd1318 |
| apps/mobile/package.json | present | 2895 | ec8cadff66f59066df4e91e59ac04dc035568bf2fdaabadb7f2f07542531d248 |
| packages/types/src/index.ts | present | 19452 | 03fbf4e84f93a35a8ea72da9c69f184f06ce0b3a9e5bef0fc4569859d2f22c91 |
| apps/mobile/app.config.js | present | 19140 | 81851010e4eb58d23f8e61ca270d979776390f3607d4a6afdf6106936756eb5c |
| apps/mobile/eas.json | present | 1636 | c66faf6c37639471d73e0c168622534210d4f074cce1265d05e443e8b4a9bb04 |
| supabase/functions/deno.lock | present | 2465 | b5f517baf0e4dc911925ec80d45b534367a3ed1e8c982cd89998da7e614d93b7 |
| docs/hugeToDo/launch-contract.json | present | 7174 | ef6a34e9e8de58380296f08473211f4915ab81817cde4ee5394f6210f08ca3bb |
| docs/hugeToDo/PAY-07-ENTITLEMENT-ADMISSION-SOURCE-CHECKPOINT-2026-08-04.md | present | 10335 | 7269ef47ab1244f5a7c2c25e665399fabffc92838edfdbb75bf13a791f49aedd |
| docs/hugeToDo/PAY-06-ENTITLEMENT-AUTHORITY-LANES-2026-07-14.md | present | 11287 | b3aa6768944665294ecc730c23a4834d150cb09328571befa0edd145697783b5 |
| scripts/launch/contract.mjs | present | 15776 | 7bec15c6d8aa7a5f744e094fa74c84969b6b09eeb23d97e94e05498315d5708b |
| apps/mobile/src/lib/iap/revenuecat.ts | present | 40781 | 8eec8ea1c909208d44552a1d417728027eaef2bc8a6738d43f81a150bdef1a67 |
| apps/mobile/src/lib/iap/revenuecat.test.ts | present | 4873 | 2845c2d57772586a9bdf660cf370e91dd49d6ed38e9ed33de01d8c395e1b72a1 |
| apps/mobile/src/lib/iap/revenuecatPublication.test.ts | present | 27762 | 754ffdc14a2af1939cb64a4d7fb33a7bbed9f8aadd6975d47386a520e66cf17e |
| apps/mobile/src/lib/env.ts | present | 7874 | d01f2db0a98f0537663312adc42bb375ca8523cdec282f2548a610b1f98383f1 |
| apps/mobile/src/lib/env.test.ts | present | 9745 | 5d2cb946d79920cbaec54eae3c9f0409fc6636673ac1e0f14ee8e6c5b5558bdc |
| apps/mobile/src/lib/appConfig.test.ts | present | 44061 | 3b388b79f457e01533c66c5a4827da6576966d1f1bf2e292e2aab725e42613a8 |
| apps/mobile/src/features/subscription/store.ts | present | 61377 | 879c3a5a57984861a47b9e9f58509d032f37f81e08b3e03dd2dc357bafbc9ad4 |
| apps/mobile/src/features/subscription/entitlement.ts | present | 5816 | d5695565782924eb8f834962d36c6dacb17a3b4df06a7453d2fbd743282c858d |
| apps/mobile/src/features/subscription/entitlementEvidence.ts | present | 18713 | 0f10f2b81600f7868eb376f1a8289bb65c8e00d53269daab2b23dbf8288e1c1c |
| apps/mobile/src/features/subscription/entitlementEvidence.test.ts | present | 6620 | 3b54db67533690960a45168349bbad40dafb7a036ad31dbd669216a78f5e7c75 |
| apps/mobile/src/features/subscription/useEntitlement.ts | present | 13744 | ed217af48a9ca5761a22e2f8a0eada65b3f9a8524317fdacf9ce2895e922f744 |
| apps/mobile/src/features/subscription/entitlementE2EFixture.ts | present | 376 | 5cb75f1e977fc19ec4f9484091d40e79db06acf6d4e6d4020682e0aee63c506b |
| apps/mobile/src/features/subscription/entitlementE2EFixture.native.ts | present | 362 | 22ca06aeaff846211f3d796041fee85e29e69cab2aaee2125fab5ef5558cd081 |
| apps/mobile/src/features/subscription/entitlementE2EFixture.web.ts | present | 3797 | ae5661bb86248f2bfecbf00117c224d9b053be4f50ae978234d955499d167ea1 |
| apps/mobile/src/features/subscription/successAdmission.ts | present | 1938 | 4245c410f86507eb8d8c360919f3847ee7fc205b1a293262775219783edc1b74 |
| apps/mobile/src/features/subscription/successAdmission.test.ts | present | 6999 | fc84b0dcdc9b12648d985068d0cefee23b6ba82948240e709266d4f7e442cbd5 |
| apps/mobile/src/features/subscription/successPresentation.ts | present | 2111 | 77fe2ba9908d2634a43407537b1fb7338449dd56913925c7888f27c64826a587 |
| apps/mobile/src/features/subscription/copy.ts | present | 11061 | 2048bce5bf0bd79221103732842f0c358df60bd3c24c297a986ad45435767b77 |
| apps/mobile/src/features/subscription/useSubscriptionOffering.ts | present | 761 | 9f765eb64c59b0a27f5b815b16fa829465322e1ee5dab866230bb6afe5af1a8a |
| apps/mobile/src/app/onboarding/paywall.tsx | present | 13151 | ac353752bc8f1b20c9f03de272f0636212d97409a2a26d6e8552058d010e0e9f |
| apps/mobile/src/app/paywall/upsell.tsx | present | 10708 | 17404465962eccc96c64d0ef64c783dfa50a54b8097e8e84c6ee8bd20c877647 |
| apps/mobile/src/app/paywall/reoffer.tsx | present | 9080 | 40ff7c91d9ea2a3c529c697692fdfbcb98294f00dcc8b684ac2a0cde3a01fc9f |
| apps/mobile/src/app/paywall/downgrade.tsx | present | 5579 | 4eb6fed57d358c1f2503be13cd8571f99adc157b362be3776e723285cd4ef92e |
| apps/mobile/src/app/paywall/success.tsx | present | 6870 | e5d724bb30697dee06c2d4320cee49e373e69ea071ba49914007f73aa577e090 |
| apps/mobile/src/app/paywall/winback.tsx | present | 7837 | a337f81aa46b453e64902710086ce933d3aa6a8bfd5df0f96d84d4c22011396e |
| apps/mobile/src/app/settings/subscription.tsx | present | 16138 | dae516f79bc4d2c8f9d3a6164fb469cedfcdbde2e89787fe0ba4f4cf735f0bcb |
| supabase/functions/revenuecat-webhook/index.ts | present | 7924 | 5a8f373654768965232ee87b0aa407806d369a33e3ac7598a3d850fde480e0f6 |
| supabase/functions/revenuecat-webhook/webhookCore.ts | present | 22878 | b4e1b8b677c7d4a419ccec00f288643debd4cd810bab5ef72f58819c4734e154 |
| supabase/functions/revenuecat-webhook/webhookCore.test.ts | present | 34742 | 6d59a615986fc06cfc125c7c2265d7410a031989c073f85f44a096f1b37ea80c |
| supabase/functions/subscription-grants/index.ts | present | 4709 | 46bc2de380de0cbaa2374478fab12a5815368380565ac29e2d3a0c7a77f7bb97 |
| supabase/functions/subscription-grants/grantErrors.ts | present | 1228 | bea0805decc23cd51e203b58c577b13343ff1c4a46a7a678b54000b1f8fdfcc0 |
| supabase/functions/subscription-grants/grantErrors.test.ts | present | 2058 | ed3094a5e0da9fe098fd7d88f5139cf3d7e07870838d0e58a232a91302cda973 |
| supabase/functions/subscription-reconciliation/index.ts | present | 11629 | e1c30509a29a2b6e7b56bf7f5dc8b6aa82c50d2c876a52f4ebc2ff55ab773821 |
| supabase/functions/subscription-reconciliation/publicationLease.ts | present | 5726 | c9a14414a30e17579b381bcdfb87b48216a610d755b3cc1cb7b0bdfbe4520248 |
| supabase/functions/subscription-reconciliation/publicationLease.test.ts | present | 7149 | 62aa58fa50f9de6211d0f2f038397b03856d082a53e3f138048ba733363a2e8a |
| supabase/functions/subscription-reconciliation/reconciliationCore.ts | present | 14210 | 704d863946f59c8744cd949c7875f07dfdf9215e8ec51291c5fe1f63c6f06043 |
| supabase/functions/subscription-reconciliation/reconciliationCore.test.ts | present | 11358 | cd815dbb183ce7605cf9fdbd7786994c73b0eb360558b7cda0780fc45049e67d |
| supabase/functions/subscription-reconciliation/reconciliationContract.test.ts | present | 4242 | 1d724448169cc36cba21d0efd84d2e586a820e718bac1f025d974ea77e1c75b1 |
| supabase/functions/_shared/verifiedAuthSessionClaims.ts | present | 2358 | 39db868ee1aa517c95b03102990793d52ad45079b6b18bbebb5640ee44207443 |
| supabase/functions/account-deletion/index.ts | present | 1722 | d4fd2917de31d91d010788a3c45d390de61fefd770f090ff5f1242f385b2f7f2 |
| supabase/functions/account-deletion/durableDeletionRuntime.ts | present | 30369 | 5d3f7b1c565016dbfd3bd6288c14f8c1a6b58a60a94815eb3bc85926cae8976f |
| supabase/functions/account-deletion/durableDeletionRuntime.test.ts | present | 21144 | d8ec70280537c2bee68e994010b6c3cd63ff74d687aea40aa390b435f15ce8a2 |
| supabase/functions/account-deletion/durableProviderDeletion.ts | present | 87521 | 57cbc94e8d6807c45c9f92a66f321cce853679a0504cf48906d4160c8e3875ea |
| supabase/functions/account-deletion/durableProviderDeletion.test.ts | present | 57456 | 10eee00dcae5b2e9961c23ff096049ad4c2fb1d7289d233c5c853bcab9cab6cb |
| supabase/functions/account-deletion/revenueCatV2DeletionExecutor.ts | present | 75697 | ccbaf7e0d38c415e013522ba82ecdd5964ca8fc58b77899e7b20974431375fcc |
| supabase/functions/account-deletion/revenueCatV2DeletionExecutor.test.ts | present | 70138 | d21b4af5236130bb395ce9b739ecd6e018355ee16f48fcf65153bf82b3b6f0b2 |
| supabase/functions/account-deletion/providerDeletion.ts | present | 11125 | a2e6cce53a68935abbad4f3beeb3a30894be1d43894167cb92bfa65f7c1c9cda |
| supabase/functions/account-deletion/providerDeletion.test.ts | present | 17762 | 336488fc323c9dcf681e2df7781ece7bf144974fa705b6bd42c01a5d377e4fbf |
| supabase/functions/account-deletion/serviceRoleCleanup.ts | present | 3440 | f8d8d06f9fdf4b940af912773c6293eeb4530df110c8279b7d58788f344f053d |
| supabase/functions/account-deletion/serviceRoleCleanup.test.ts | present | 16530 | e93c3fe4cd82445ad5833a148ec5aaee95eb95b17b29e02170693623b3f4f95a |
| supabase/functions/order-report-poll/index.ts | present | 1125 | 5747e2e536851e325fcb25ca3c9f0cefa81fc0c0f94c6c34791b89b5651adc8c |
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
| apps/mobile/src/features/subscription/paywallMobileContracts.test.ts | present | 45302 | 20e29a36855d044849c47cdc8fcf204a9da41d43bebc2bfe724e575a5a50ee59 |
| apps/mobile/src/features/subscription/store.test.ts | present | 43342 | a89192fb45d56e770d12655cd02e7ab225ea874c3f57b11c3e69d81b7835c07a |
| apps/mobile/src/features/subscription/entitlement.test.ts | present | 3968 | 563be20feeb313e5e95dcdf027d3c1df27d3d8a7a2e011775b4b7e641d830acd |
| apps/mobile/src/features/subscription/serverContracts.test.ts | present | 7047 | 71af7f42475824c688fb078e76f73d60e4d34d70d308fe97a9bab28a12f40426 |
| scripts/phase6/build-payments-qa-packet.mjs | present | 40384 | caade2b96d77995fbac918e72b42ae3fb77257bf923ff8d11d2e0c74796d9fee |
| scripts/phase6/check-payments-env.mjs | present | 29440 | 9425baf7a8c01bc8a084c3d9e51da895e5edac3242beb19fd7a0839414abd519 |
| scripts/phase6/check-payments-env-smoke.mjs | present | 38081 | f13f85750baa06a60cd225a7297604bae4b359d48c25b050fa6a911ca595a81c |
| scripts/phase6/payments-git-provenance.mjs | present | 1409 | 0bafbaf1f9481a739880d5cfb51dedc1b7d7c0919dabddd35ebc239416e3f7a0 |
| scripts/phase6/payments-git-provenance.test.mjs | present | 3382 | d368ce5746f0d86ccdff979d52bc9a50b2d657d3e43c9c635004e1cba7cc7cb5 |
| scripts/phase6/payments-revenuecat-access-evidence.mjs | present | 11388 | 013c798d7bef14efafc95d00e841fc5e4a90e28a998f96aac43b43aad72c1372 |
| scripts/phase6/payments-revenuecat-access-evidence.test.mjs | present | 10038 | 24f2ad24e75c975af09f5c62557bdb657154dfe1ead565ab3eae69c058f5c8fe |
| scripts/phase6/payments-trusted-entitlements-evidence.mjs | present | 27323 | f73cf5e832fa1009b621d5d70d5c157bdcafd07f9a5eb89f4f705e5a6a52ddf9 |
| scripts/phase6/payments-trusted-entitlements-evidence.test.mjs | present | 22707 | db78d233ba9574da9c60606af0da4aa7639fcaccad6d22136b06d64839c48a21 |
| scripts/phase6/payments-source-contract.mjs | present | 60242 | f10255f95987b1b280f35c63aa137dfcfe4822d923a27eaecfaf6f4611fecc98 |
| scripts/phase6/payments-source-contract.test.mjs | present | 23395 | b3c8c9488f437e03e7ae6b807a21b6db061045b90f0124e5c2dd6b14fbb16e80 |
| scripts/pay07/entitlement-admission-source-contract.mjs | present | 31267 | d960b83024b428870f76bb9700a6b05e355e51744ce2b074be7cb3d4e7084657 |
| scripts/pay07/entitlement-admission-source-contract.test.mjs | present | 16124 | 02be758c132539a6eba6e4072bab36f017317f6b398a177cbdd4d164114a7145 |
| scripts/phase2/check-env.mjs | present | 21921 | bb391eaef352aca8160dbfa6f9ca80562cfcb9abeb065c82fc61a89e811a4995 |
| scripts/phase2/check-env-smoke.mjs | present | 25420 | 3d3a271ab63f749457cdd6fd55faa89ba1a1d75e434e3f589671d8a1761dbdaa |
| scripts/phase9/supabase-policy-lint.mjs | present | 18126 | 6da0337e9605b44b1f2020f326626e7250644c9eafc3e285166819039211bef6 |
| scripts/phase9/account-service-scrub-postgres-rehearsal.sql | present | 26077 | b4898279189ebca369eaa9f212632d0a903917fe137c8ccbbec994cb3c34743a |
| scripts/phase9/live-data-rights.mjs | present | 76345 | 992a15a6471e68bce483359b3157b5f9df8950d7f7576342a28492f15ea22bd5 |
| scripts/e2e/human-e2e-manifest.mjs | present | 366877 | 7c887ba017a91d47840b79496513c9d3a178286ce652e1e267b1f8a806e89751 |
| scripts/phase9/lib.mjs | present | 22873 | 2432468891aa67b138785021580caadcc27ab5d1c7aca8c5015e1ddc531d021c |
| docs/HUMAN_SIMULATED_E2E_TESTING.md | present | 10413 | 109f35402903500e5bc61054e52bf8f0dbe090d3ade395d96303ea008bb7bc50 |
| docs/E2E_TESTING_CHECKLIST.md | present | 6998 | 34248253ee5234d7a92a7733f4579a191ff3bd398152da8941886ab79a786026 |
| docs/USER_FLOW_TREE.md | present | 479007 | c9bea260d50a17c937c8cf0f0765cc30d3c0eb073a962db0fc9cf132a76dc0d9 |
| docs/e2e/generated/human-e2e-manifest.json | present | 299477 | d6780e5d700152200cdc68759b9358403b6304dc5ebd230f44cce321788200c0 |
| docs/e2e/generated/human-e2e-manifest.md | present | 2244721 | a83cb0e8cfbfb3aae9ab087c17b77844a9ea32ee9bf465fcfb85dc1008f4c3dd |
| docs/phase-6/payments-runbook.md | present | 19952 | 7121f4f3a5e464574bf9e8ad4cc309aeabfec923473218254e116d6e79cefd4b |
| docs/phase-6/payments-qa-checklist.md | present | 12675 | 9ed8e1e8ffa2c340e5f44c1e9a1689c01e2a224de820ccd822fd4a29c2a3a3d5 |
| docs/phase-6/phase-6-exit-review.md | present | 6580 | 79cce6ed47536a911053a5d9fb0cde65717feee225655472f34a9e068fdf1dac |
| docs/phase-6/revenuecat-v2-access-evidence.template.json | present | 852 | d70276f6b45d1fb21974eb7d9bd82f3f613232cf29a5e9cd8966aa84f85941d3 |
| docs/phase-6/revenuecat-trusted-entitlements-evidence.template.json | present | 2556 | 94e64268eb1a73c509eeb09689c4fd9e336187e7d5c478bb4a3bf2b313c72f12 |
| supabase/functions/_shared/appleVault.test.ts | present | 5245 | 5a7349f3985cceff0b00da46d6cc01c7fdc57c837f3477c6692d1e373897648c |
| supabase/functions/_shared/appleVault.ts | present | 11829 | 34918abcd16d593d21ac83c9a7c5e3c917ba4e6f87508010599b5bcba9b2ef3e |
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
| supabase/functions/account-deletion/appleDeletionNetwork.test.ts | present | 19444 | f085c3aec26e16cc3c3464bb44133705cfec7a073233ce3c62d0206a3c37d23d |
| supabase/functions/account-deletion/appleDeletionNetwork.ts | present | 20159 | 755073322aea362153c29c2a7114041903fcf398c5d1d026a09eb37e75a02c88 |
| supabase/functions/account-deletion/authDeletionExecutor.test.ts | present | 6000 | dd57439418166e2110e3173badb2df40f325eb382dbed924893b39d056109c1e |
| supabase/functions/account-deletion/authDeletionExecutor.ts | present | 4536 | 63bed68c219a5eec579454b5ec907cf037a4b9bdde118629949687bab1e3a1e6 |
| supabase/functions/account-deletion/deletionProviderNetwork.test.ts | present | 3225 | e40fc09581b7d085425e0d75d8c4f990ef4158c7e41aafde21304a156f484230 |
| supabase/functions/account-deletion/deletionProviderNetwork.ts | present | 4906 | 1b56a8956f8575833c03c3040015f29fa58b7bbe8bec307595326832ae2dc42f |
| supabase/functions/account-deletion/durableDeletionCore.test.ts | present | 20519 | ca4980b6ae06ea938fbb31ca5289d4c998702bbdfd563c2bfe65cf765f7543e5 |
| supabase/functions/account-deletion/durableDeletionCore.ts | present | 20356 | 5d4ad54e94c9c930f56dcaeeaa7a08b6f1841bf0899a8fc83cae4abd9f97598a |
| supabase/functions/account-deletion/durableDeletionCrypto.test.ts | present | 16760 | 9999256ad988831805838f53e45e94d32a355ddfbacf3cea68b8b0c35dedb8cb |
| supabase/functions/account-deletion/durableDeletionCrypto.ts | present | 16540 | 5ad0225c135733d25e38b4186cf9cc845822f556ae1763350d63aa9cfb0a6c52 |
| supabase/functions/account-deletion/durableDeletionDatabaseGateway.test.ts | present | 20290 | 6ef298e060dad37f8643df4cea1e4ba4bbbc5c37120ce670f5d13f166619c38f |
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
| apps/mobile/src/features/subscription/ProGate.tsx | present | 21829 | c1124074641c87806814c77eba7113d1e0aeef3760eb622c9d903a95324617e8 |
| apps/mobile/src/features/subscription/ReverseTrialBanner.tsx | present | 2326 | b3453ed2c4b8efa0529d97decf7c352c03cae0411bc6bfbfba231212a5ec335f |
| apps/mobile/src/features/subscription/StoreTransactionNoticeHost.test.ts | present | 5863 | 0a0bd7d45eebe2a3429029e1c2586dd75b62aef97d10cc178d5d98fa8fb3b909 |
| apps/mobile/src/features/subscription/StoreTransactionNoticeHost.tsx | present | 12042 | 2add0b2247d702901aba3545efc4898b8b2166d105b83859bdf13aa6049c1bd0 |
| apps/mobile/src/features/subscription/billingCadence.ts | present | 877 | f174c0201d866c74911b23b091cf5b16f3cd2fadc7db0c57ee4954b055eff4d8 |
| apps/mobile/src/features/subscription/cancelIntent.test.ts | present | 1780 | d950be6fe9113911fb318323d4a5b7a0fdcb2a1574ee2ce567dd56377d019660 |
| apps/mobile/src/features/subscription/cancelIntent.ts | present | 542 | 401681a7d3bed2d27b84599b1fc6321de1afb8d4cef1930bbe0d54597fc86dbe |
| apps/mobile/src/features/subscription/claimsafety.test.ts | present | 4856 | bd77f63a3d456df1d06dc3cead05d2db0c316f224b92c68dc23aaf921b301e08 |
| apps/mobile/src/features/subscription/conflictQuota.test.ts | present | 4713 | 778784d4480f20b901f1704e6a575386d13e1a11a2b073143e8df87ea9b2cf8f |
| apps/mobile/src/features/subscription/conflictQuota.ts | present | 3598 | 9198f5ca04a3bbdaa337c3608ed1db76cff2108f875857088b3c688860505364 |
| apps/mobile/src/features/subscription/dismissPaywall.test.ts | present | 2567 | 0b6b18e59315bf79fc066ba0dd5bc544fcb93a896b9205e223d6af7d39668265 |
| apps/mobile/src/features/subscription/dismissPaywall.ts | present | 889 | 9f3eb323ddc8225f6229c334c3292e2ae26b5621ce9d552c7718f5a6b3e5b969 |
| apps/mobile/src/features/subscription/gatedRoutes.test.ts | present | 1109 | 9d50f012762bc49dadef8736536ab807af198b970189df5c901d4375a83f7a4f |
| apps/mobile/src/features/subscription/gatedRoutes.ts | present | 486 | 8d8e44ffdf245214d6d8299b1a3ea0af55ee7da22ba659d0b029eda386c7929e |
| apps/mobile/src/features/subscription/lifecycle.test.ts | present | 3612 | 0ca7b1257ea890f69580af3765f4238d80608de4bc030d521ab81adaad203f2b |
| apps/mobile/src/features/subscription/lifecycle.ts | present | 3383 | 4e4791fe9f048c4b084d8c6aa049c422b99e01a3ee475ffad53ed1b2f5403992 |
| apps/mobile/src/features/subscription/plans.test.ts | present | 1727 | 5f77234ae56ba6f140972ba103b440a804f50973c8c2ce0c882b3a65b9a7db48 |
| apps/mobile/src/features/subscription/plans.ts | present | 2494 | e3d28f01c574ad82a31eebb0bf720bedc9bab8ef1da5405dfd75602b56d32f2e |
| apps/mobile/src/features/subscription/priceDisplay.test.ts | present | 3484 | 1b11f1209f55922a1236cb762849fdf4aa75c567b2aa729d6f64b23053b7456a |
| apps/mobile/src/features/subscription/priceDisplay.ts | present | 1792 | 93e960ad24c4592e281a3309f3bdb81d7ea8b5f04dfdb0f17236f6b368faa02b |
| apps/mobile/src/features/subscription/proGatedRoutes.test.ts | present | 16111 | 44d56f7f13bab8928002e0ef441c45de7748877e4becf54d74dd7d9279733997 |
| apps/mobile/src/features/subscription/storeTransactionNoticeContracts.test.ts | present | 6641 | 5eda1a3554738012efb80180c14d0f76467a5292fb99969988c9aabc2f148945 |
| apps/mobile/src/features/subscription/storefrontCopy.test.ts | present | 2628 | 44cc9d3ff4089821e69412f3150c855c0dd7a70e5b91af116df9773a192c263d |
| apps/mobile/src/features/subscription/storefrontCopy.ts | present | 1897 | 5f9def7dbafe7f302eb800376d47851e836fb1c97ff640db486b44523e7ccc3b |
| apps/mobile/src/features/subscription/useEntitlementEvidenceContracts.test.ts | present | 1052 | 54fe20269bdcc074b7ec48482838981c04b42a352db12a23984d356336b5cb64 |
| apps/mobile/src/features/subscription/winBackCommercialState.test.ts | present | 781 | ede569d3d6187329ef17c3c666a164358bcba9de712680ada9df0b78b7f72c27 |
| apps/mobile/src/features/subscription/winBackCommercialState.ts | present | 745 | cfda0d806811c71cefbf23d73f7dd1d59327cdf50157fce4e2b03b43ca9833e4 |
| apps/mobile/src/lib/iap/storeTransactionNotice.test.ts | present | 25084 | e29af8a370e06282d1602e7d9279a24b7f2f3f385344e6fb7af2fb8488d9b92f |
| apps/mobile/src/lib/iap/storeTransactionNotice.ts | present | 25774 | 95fc59d29b424bcdc438d0de364808359118eb36e118d4fb83841d3e47170838 |
| supabase/functions/_shared/accountAccess.test.ts | present | 4985 | e4322b71cf6fd3bc61775a8b4a340d03765fc4e53ac61cc349d588e67861b746 |
| supabase/functions/_shared/accountAccess.ts | present | 3438 | 3a5ec1140587e88efb3caf49c4779dd44fdb2a9219f3dbf9e44deb9b8a6502e0 |
| supabase/functions/subscription-grants/customProGrantAdmission.test.ts | present | 2312 | e653cf08ced4782c1cc8b45b33a192df7a84b5d87d08c2f394ee85c21764f713 |
| supabase/functions/subscription-grants/customProGrantAdmission.ts | present | 939 | b2194c7f327dbdfc9d023f993b6b6a7e6b96410e655336a6c3aaa296fd391fc2 |
| supabase/functions/subscription-grants/deletionBarrierContract.test.ts | present | 5012 | 30ca9f7926bef7371a658484fd58b15c7229e650cbf622eb8f92b19af943cab2 |

## Blockers

- Phase 6 final payments evidence requires a clean Git worktree.
- Phase 6 required input bytes differ from HEAD: .env.example.
- Phase 6 required input bytes differ from HEAD: package.json.
- Phase 6 required input bytes differ from HEAD: package-lock.json.
- Phase 6 required input bytes differ from HEAD: apps/mobile/package.json.
- Phase 6 required input bytes differ from HEAD: packages/types/src/index.ts.
- Phase 6 required input bytes differ from HEAD: apps/mobile/app.config.js.
- Phase 6 required input bytes differ from HEAD: apps/mobile/src/lib/iap/revenuecat.ts.
- Phase 6 required input bytes differ from HEAD: apps/mobile/src/lib/iap/revenuecatPublication.test.ts.
- Phase 6 required input bytes differ from HEAD: apps/mobile/src/lib/env.ts.
- Phase 6 required input bytes differ from HEAD: apps/mobile/src/lib/appConfig.test.ts.
- Phase 6 required input bytes differ from HEAD: apps/mobile/src/features/subscription/store.ts.
- Phase 6 required input bytes differ from HEAD: apps/mobile/src/features/subscription/entitlement.ts.
- Phase 6 required input bytes differ from HEAD: apps/mobile/src/features/subscription/entitlementE2EFixture.web.ts.
- Phase 6 required input bytes differ from HEAD: apps/mobile/src/features/subscription/copy.ts.
- Phase 6 required input bytes differ from HEAD: apps/mobile/src/app/paywall/upsell.tsx.
- Phase 6 required input bytes differ from HEAD: supabase/functions/revenuecat-webhook/webhookCore.test.ts.
- Phase 6 required input bytes differ from HEAD: supabase/functions/subscription-reconciliation/reconciliationCore.test.ts.
- Phase 6 required input bytes differ from HEAD: supabase/functions/account-deletion/durableDeletionRuntime.test.ts.
- Phase 6 required input bytes differ from HEAD: supabase/functions/account-deletion/providerDeletion.ts.
- Phase 6 required input bytes differ from HEAD: apps/mobile/src/features/subscription/store.test.ts.
- Phase 6 required input bytes differ from HEAD: apps/mobile/src/features/subscription/entitlement.test.ts.
- Phase 6 required input bytes differ from HEAD: apps/mobile/src/features/subscription/serverContracts.test.ts.
- Phase 6 required input bytes differ from HEAD: scripts/phase6/check-payments-env-smoke.mjs.
- Phase 6 required input bytes differ from HEAD: scripts/phase6/payments-git-provenance.test.mjs.
- Phase 6 required input bytes differ from HEAD: scripts/phase6/payments-revenuecat-access-evidence.test.mjs.
- Phase 6 required input bytes differ from HEAD: scripts/phase6/payments-trusted-entitlements-evidence.test.mjs.
- Phase 6 required input bytes differ from HEAD: scripts/phase2/check-env.mjs.
- Phase 6 required input bytes differ from HEAD: scripts/phase2/check-env-smoke.mjs.
- Phase 6 required input bytes differ from HEAD: scripts/e2e/human-e2e-manifest.mjs.
- Phase 6 required input bytes differ from HEAD: docs/HUMAN_SIMULATED_E2E_TESTING.md.
- Phase 6 required input bytes differ from HEAD: docs/USER_FLOW_TREE.md.
- Phase 6 required input bytes differ from HEAD: docs/phase-6/payments-runbook.md.
- Phase 6 required input bytes differ from HEAD: supabase/functions/_shared/appleVault.test.ts.
- Phase 6 required input bytes differ from HEAD: supabase/functions/_shared/appleVault.ts.
- Phase 6 required input bytes differ from HEAD: supabase/functions/account-deletion/appleDeletionNetwork.test.ts.
- Phase 6 required input bytes differ from HEAD: supabase/functions/account-deletion/durableDeletionCore.test.ts.
- Phase 6 required input bytes differ from HEAD: supabase/functions/account-deletion/durableDeletionDatabaseGateway.test.ts.
- Phase 6 required input bytes differ from HEAD: apps/mobile/src/features/subscription/ProGate.tsx.
- Phase 6 required input bytes differ from HEAD: apps/mobile/src/features/subscription/conflictQuota.test.ts.
- Phase 6 required input bytes differ from HEAD: apps/mobile/src/features/subscription/conflictQuota.ts.
- Phase 6 required input bytes differ from HEAD: apps/mobile/src/features/subscription/dismissPaywall.ts.
- Phase 6 required input bytes differ from HEAD: apps/mobile/src/features/subscription/gatedRoutes.ts.
- Phase 6 required input bytes differ from HEAD: apps/mobile/src/features/subscription/lifecycle.test.ts.
- Phase 6 required input bytes differ from HEAD: apps/mobile/src/features/subscription/lifecycle.ts.
- Phase 6 required input bytes differ from HEAD: apps/mobile/src/features/subscription/plans.test.ts.
- Phase 6 required input bytes differ from HEAD: apps/mobile/src/features/subscription/plans.ts.
- Phase 6 required input bytes differ from HEAD: apps/mobile/src/features/subscription/priceDisplay.test.ts.
- Phase 6 required input bytes differ from HEAD: apps/mobile/src/features/subscription/priceDisplay.ts.
- Phase 6 required input bytes differ from HEAD: apps/mobile/src/features/subscription/storeTransactionNoticeContracts.test.ts.
- Phase 6 required input bytes differ from HEAD: apps/mobile/src/lib/iap/storeTransactionNotice.ts.
- Missing PHASE6_REVENUECAT_V2_ACCESS_EVIDENCE_PATH.
- Missing RevenueCat Trusted Entitlements evidence path.
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
- Missing PHASE6_REVENUECAT_TRUSTED_ENTITLEMENTS_PASS=true.
- Missing PHASE6_REVENUECAT_V2_CUSTOMER_DELETE_ACCESS_PASS=true.
- Missing PHASE6_WEBHOOK_HMAC_TEST_PASS=true.
- Missing PHASE6_FINANCE_SIGNOFF=true.
- Missing PHASE6_SIGNED_OFF_BY.

## Warnings

- Phase 6 payments QA packet generated with a dirty Git worktree; do not use it as final payments evidence.
