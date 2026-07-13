# Phase 9 Release Engineering QA Packet

Generated: 2026-07-13T15:32:53.056Z
Status: blocked
Git SHA: 4bb0f418697f3714da2611cb8dfd318ce612656c
Git status: clean

## Release Identity

- Environment: development
- Final domain: BLOCKED
- Marketing URL: BLOCKED
- App Store URL: BLOCKED
- Play Store URL: NOT APPLICABLE
- Support email: BLOCKED
- Signed off by: BLOCKED
- Release candidate folder: BLOCKED

## Blockers

- None from packet inputs.

## Warnings

- External RC evidence missing: PHASE9_FINAL_IDENTITY_PASS=true.
- External RC evidence missing: PHASE9_LIVE_SUPABASE_PASS=true.
- External RC evidence missing: PHASE9_RLS_STAGING_PASS=true.
- External RC evidence missing: PHASE9_RLS_PRODUCTION_PASS=true.
- External RC evidence missing: PHASE9_EDGE_AUTH_PASS=true.
- External RC evidence missing: PHASE9_PUBLIC_FORMS_PASS=true.
- External RC evidence missing: PHASE9_CATALOG_RATE_LIMIT_PASS=true.
- External RC evidence missing: PHASE9_ORDER_REPORT_POLL_PASS=true.
- External RC evidence missing: PHASE9_DATA_EXPORT_DELETE_PASS=true.
- External RC evidence missing: PHASE9_CONSENT_WITHDRAWAL_PASS=true.
- External RC evidence missing: PHASE9_OBSERVABILITY_PAYLOAD_PASS=true.
- External RC evidence missing: PHASE9_REVENUECAT_WEBHOOK_PASS=true.
- External RC evidence missing: PHASE9_REVENUECAT_NATIVE_QA_PASS=true.
- External RC evidence missing: PHASE9_IOS_TESTFLIGHT_PASS=true.
- External RC evidence missing: PHASE9_IOS_PRIVACY_REPORT_PASS=true.
- External RC evidence missing: PHASE9_APP_STORE_PACKET_PASS=true.
- External RC evidence missing: PHASE9_DEVICE_QA_PASS=true.
- External RC evidence missing: PHASE9_ROLLBACK_DRILL_PASS=true.
- External RC evidence missing: PHASE9_INCIDENT_RESPONSE_PASS=true.
- External RC evidence missing: PHASE9_DEPENDENCY_AUDIT_PASS=true.
- External RC evidence missing: PHASE9_BETA_EVIDENCE_PASS=true.
- External RC evidence missing: PHASE9_SIGNED_OFF_BY.

## Evidence

- PHASE9_FINAL_IDENTITY_PASS: BLOCKED
- PHASE9_LIVE_SUPABASE_PASS: BLOCKED
- PHASE9_RLS_STAGING_PASS: BLOCKED
- PHASE9_RLS_PRODUCTION_PASS: BLOCKED
- PHASE9_EDGE_AUTH_PASS: BLOCKED
- PHASE9_PUBLIC_FORMS_PASS: BLOCKED
- PHASE9_CATALOG_RATE_LIMIT_PASS: BLOCKED
- PHASE9_ORDER_REPORT_POLL_PASS: BLOCKED
- PHASE9_DATA_EXPORT_DELETE_PASS: BLOCKED
- PHASE9_CONSENT_WITHDRAWAL_PASS: BLOCKED
- PHASE9_OBSERVABILITY_PAYLOAD_PASS: BLOCKED
- PHASE9_REVENUECAT_WEBHOOK_PASS: BLOCKED
- PHASE9_REVENUECAT_NATIVE_QA_PASS: BLOCKED
- PHASE9_IOS_TESTFLIGHT_PASS: BLOCKED
- PHASE9_IOS_PRIVACY_REPORT_PASS: BLOCKED
- PHASE9_APP_STORE_PACKET_PASS: BLOCKED
- PHASE9_DEVICE_QA_PASS: BLOCKED
- PHASE9_ROLLBACK_DRILL_PASS: BLOCKED
- PHASE9_INCIDENT_RESPONSE_PASS: BLOCKED
- PHASE9_DEPENDENCY_AUDIT_PASS: BLOCKED
- PHASE9_BETA_EVIDENCE_PASS: BLOCKED
- PHASE9_ANDROID_CLOSED_TEST_PASS: not_applicable
- PHASE9_ANDROID_TARGET_API_PASS: not_applicable
- PHASE9_ANDROID_16KB_PASS: not_applicable
- PHASE9_PLAY_PACKET_PASS: not_applicable

## Source Hashes

- `.env.example`: `970a51b212bea8ebe9024f315ed051d9a9a131adb10a6fcf2f8085e632e0210c`
- `docs/hugeToDo/launch-contract.json`: `43bea3c862d7e36c7e8d744b87bcf21f65d721500e71e1f1cfa7492fbb14ee4b`
- `scripts/launch/contract.mjs`: `6a3ced1c0e7e54ef7db31e848aeeebd3617a77db02c3b51c98d6ee3789a9007d`
- `package.json`: `8151c6a42a79225e676a2bb20e1bcc21775162305ef13a75c7fe4e35a56fbb9b`
- `package-lock.json`: `dc44f44dd678c99e3bc422fa303dc5d9852da471eb27e3bccc222d78f66149c7`
- `.github/workflows/security.yml`: `fdb06576390f13621c3ce0887c4cc208f73d049c59a42d72c6cd04f9d9f6658d`
- `apps/mobile/app.base.json`: `24e1d20a0c61544d2ecb71e39dacafcb17d03a3f20fc7f8e80bf449d900d005c`
- `apps/mobile/app.config.js`: `3c8de04b4d7452e7c41922d4202e934f8f201769be01095503b3969ad3fde0a5`
- `apps/mobile/eas.json`: `1672ae9cdd6fbd4c23c5e468fcbe24e761a5fbfa64279d0627328a981dd8c657`
- `apps/mobile/src/lib/env.ts`: `cee9823ec5d10a90a7dfe0596ce6c9d9b23e3a48d875e7093574b1384a7c1447`
- `apps/mobile/src/lib/env.test.ts`: `aa44ad9dd368cc132601c375e295067e23ec28e432b032ef05e3da76988c41fa`
- `apps/mobile/src/lib/launch/phase7.ts`: `875babca48f518e13c897550ae2b0feb66346ba700f8ffba8aad9560f07b1d46`
- `apps/mobile/src/lib/launch/phase7.test.ts`: `2d633e139d356fdce0e6b966e1675a017fcc4b4a0ddbc5679149fc942331681f`
- `apps/mobile/src/lib/analytics/eventRegistry.ts`: `c00e23a2c6bdcc6a081dbbea7c7905933ed9ef5929f15a5341b37a6c0dc96cae`
- `apps/mobile/src/lib/analytics/track.ts`: `d613d0f4c9cb794b681b722850dc4b408d06eb8da0574f16681463d7b4c22be2`
- `apps/mobile/src/app/community/ask.tsx`: `5603a0c3b19526cea52620c069183efb08f960f1943c77f74aa8bc637022d469`
- `apps/mobile/src/app/community/people-like-you.tsx`: `b18c6e540c9451ff47d0bf1ca919d94e8fa14f2ba187f5478b568e5fb686cdf4`
- `apps/mobile/src/app/trend/optin.tsx`: `4f05727b9908e26f7b4cb8b00b76ea8c23ca3e1abe556082053dbd23e3a09ff4`
- `apps/mobile/src/app/routine/widgets.tsx`: `f7c758cf8e18e10bcbba41f60a0a03fead7a952135ecf58ac95a21b2f623004a`
- `apps/mobile/src/app/routine/_layout.tsx`: `3c3fd965a6889c8addbe36a649b3703af5343a5034dd1181c2620d145c36216c`
- `apps/mobile/src/features/subscription/gatedRoutes.ts`: `aea4630a6d619bc5a10f6ee247d46af66f0a29887db6f7da869f7f12fdacd4af`
- `apps/mobile/src/features/subscription/copy.ts`: `1a9ce7ca24c4de4b8631166a12351307e8facb6372bec4262193ad726147477c`
- `apps/mobile/src/lib/iap/revenuecat.ts`: `f89981290f02bc355ca4ac279b9e660c86d480a9c6e54b041a4d600f0468b105`
- `apps/mobile/src/lib/observability/scrub.ts`: `ad231f592848825dbeaffcbd960a31e0ae916fe7e1916ded939e9b0f79deabed`
- `apps/mobile/src/lib/observability/sentry.ts`: `c81f27c8ac940d81b4ddd10521d922689840d7dfc7071ade812ff4e45e51fa9e`
- `apps/mobile/src/app/(tabs)/you.tsx`: `b13fdc0f555048e214cda72affba45497b2d340b0e60a0ab4ae020a2ccc54c24`
- `apps/mobile/src/app/(tabs)/progress.tsx`: `d009aa555a3230ad67a41dfdc2cbeb184b9684757b97085346fe5362e57c7125`
- `apps/mobile/src/app/progress/capture.tsx`: `dac3a89172ee267baf085ddf27a00fc46b3b2bba8472cb8193990199bcfa9c5a`
- `apps/mobile/src/app/progress/review.tsx`: `7ec464e63fc86038fe0d79368352061d0ef52842c37832a68a251c0b58c524f1`
- `apps/mobile/src/app/progress/[id].tsx`: `6c30541e68f2f7e1acd9a7b366f7531eaaebdf12e284ab831eb4aa3b7d2e02d2`
- `apps/mobile/src/features/photos/PhotoTimelineLockGate.tsx`: `f5c45a73af3712462acd4f3b1a393ead4c9aee1067e32b82a14b6e865a23af67`
- `apps/mobile/src/features/photos/PhotoStorageGate.tsx`: `acda1b19266b960c94f493e80bab98f23002b0ff3bcfb93a4601f774e23d6888`
- `apps/mobile/src/features/photos/encryptedStorage.ts`: `06c0a284c0a021f618aaf53d147cb120d3fb6cb7cf667349aaf14aaacc0b9d0e`
- `apps/mobile/src/features/photos/encryptedStorage.test.ts`: `9eab944a4634d44394e2b3ac8da7016c7afcaf8ae69e091897227792a2066def`
- `apps/mobile/src/features/photos/store.ts`: `9588c2885b0ab70a478f1cf2e332b4039affbfb78d4cf52b31921ecf055c61a3`
- `apps/mobile/src/features/photos/store.test.ts`: `4a217ee177ebc16b312f2d96c7b3df7f78334654261f15788811d83d4faf706c`
- `apps/mobile/src/features/photos/usePhotos.ts`: `7bfcfda545ab719de32f460c859d6aa66075e97a84d200194360c114f2fb16a5`
- `apps/mobile/src/features/settings/actions.ts`: `c57765ab321d7331872ec2127895f70101d7abd313be26bfd7efcfc5714efcf0`
- `apps/mobile/src/features/settings/localDeviceExport.ts`: `16dd55731879bace8db794440b2a369d40ea53cf092a7029d6ead480a8a12064`
- `apps/mobile/src/features/settings/localDeviceExport.test.ts`: `a9694e2201bcd58b8479bf40011b152a5192e2700451e37c7a630daffc448dd5`
- `apps/mobile/src/features/settings/localPrivateDataKeys.ts`: `605f4637401a393b7e7fd0838c17c11499baad624eaaedc4548a0bb3602bb95b`
- `apps/mobile/src/features/settings/localPrivateData.ts`: `15c781cf4b5cae057d54b597587fa3ee9b6248044089c871fa917db275baaaba`
- `apps/mobile/src/lib/storage/privateKV.ts`: `c8b6b56ddb38da8167adaf15d305ee8c5a8d1aaea2d8c344444cd426bc9e3971`
- `apps/mobile/src/lib/storage/privateKV.test.ts`: `f40598f25641df646c012689736eb110d8686c82247447a62581f56b5bce1daf`
- `apps/mobile/src/lib/supabase/largeSecureStore.ts`: `abab620fb825ec638a31e4c915d6fbc731fc48f506c522b5ddc4684dfee3382c`
- `apps/mobile/src/lib/supabase/largeSecureStore.test.ts`: `631bddceffd2830f8c5db4e65f4aee181481c4348f7ffbd6134f3b66c95cd533`
- `apps/mobile/src/lib/applock/AppLockProvider.tsx`: `e9375b8aad7427794167cd67ea76149668e3d9004acd19ff8d2bec4a4c9cab50`
- `apps/mobile/src/lib/applock/authenticate.ts`: `fda9cd0c3818aa1c0f78edf9c499111622537c81c10f2f1761655a0cc652f0a8`
- `apps/mobile/src/lib/applock/authenticate.test.ts`: `1b126e42651e7b449e83b574d50d41072041fb97714fb086d08cb2745972519e`
- `apps/mobile/src/lib/applock/singleFlight.ts`: `f222b5b02dad14e9770d37d3bba1844e162bfe9be91252dd6f823d1a571dedf9`
- `apps/mobile/src/lib/applock/singleFlight.test.ts`: `20204829bf8f0134cee6b24b2da0e6a7743be0da73ee4d382c00e2a2a3c841b0`
- `apps/mobile/src/lib/auth/accountGeneration.ts`: `0d167622d6002e9e699deb831f6cce55ec406cdc4d16af3313c27b57ab9917ec`
- `apps/mobile/src/lib/auth/accountGeneration.test.ts`: `23aea54f09eb9791c97f48cc4ebc7554b43fb1aa19cddae8d3dcb06950a8274a`
- `apps/mobile/src/lib/auth/localAccountIsolation.ts`: `9ec3488e1760322f842f0b46ed2b8bd4e08fdc370186c5e24a1472d996e5340b`
- `apps/mobile/src/lib/auth/localAccountIsolation.test.ts`: `dcefcaa46e57ea396b3690081070e3e940fc49521d1544c831637d8b90b753cf`
- `apps/mobile/src/lib/auth/apple.ts`: `650ff0310cbc12acee871fb265a32f2b05306660af92ed31b36cc268582aa4e0`
- `supabase/functions/account-deletion/index.ts`: `7441711f06bd443c3d299c4607950c85ac586226c5d9879eeea601511a54659a`
- `supabase/functions/account-deletion/photoStorageCleanup.ts`: `b693eedf3521d6e3214e0e0ccb84704b8f72c7931b32a954b61c1f4988ff14a6`
- `supabase/functions/account-deletion/photoStorageCleanup.test.ts`: `447cc4ff465f1de1c4bfe86b32fa41bc777bc3c9a95a95a9822d039d99744361`
- `supabase/functions/_shared/body.ts`: `03e9ddbd56df2875f78b4f582ffdae13f0deca50d75d44ed3a5df4d685b39e6a`
- `supabase/functions/_shared/fetch.ts`: `d8ff37a96a965d3826d3d7df14a69eb00f35dddbc119d3a2f4cc92d778226a25`
- `supabase/functions/_shared/storagePath.ts`: `9367ade3719c7b7e38a7b090da7d904dd574bb43e29222bf5e8a839d3b377594`
- `supabase/functions/_shared/storagePath.test.ts`: `3caf9cbb38b676c4a96dd9ae3f19479c205a90d31bb83fee7c7474bc76a2a2e9`
- `supabase/functions/data-export/index.ts`: `60a72ff0588741c040f6cfe5d2a10f000e49ffa9d6aafe212fe6d6875a1e207a`
- `supabase/functions/consent-withdrawal/index.ts`: `e4d2668a02048e1767f221c1486365a0fe18d709e462ff9ef1d9d590f3c4a2df`
- `supabase/functions/subscription-grants/index.ts`: `754c849c1e774f3429f9949d90fd599eac79dc23aa0b5c5eb4b057884a11ad10`
- `supabase/functions/catalog-search/index.ts`: `7d3986fb22d0463989ae885aed8ac77070e90a2597a9188d3c8358f5d6c09e96`
- `supabase/functions/catalog-search/catalogContract.ts`: `3b51d16f5b8d5b24a9f87d2e445c28391c8f6407d39150f4085910da97f380e0`
- `supabase/functions/catalog-search/catalogContract.test.ts`: `18adc4c4572004285afab509ab0d100daeaaa905ce5895d1783a0a792d15cc59`
- `supabase/functions/catalog-lookup/index.ts`: `3ea57934c0e3a102de119b9ccf8644bbceab1cc488bdcb0dd4f0fea7583e7689`
- `supabase/functions/catalog-lookup/catalogContract.ts`: `60733dac6228405052bac40f9336581042f24a3503b75be43ad238cb78fcb91d`
- `supabase/functions/catalog-lookup/catalogContract.test.ts`: `c91e14a46870197c03171f83ce64cc69ad4e5c649294fc7675e3149a9cb938f1`
- `supabase/functions/catalog-report/index.ts`: `92277aa7dc9ac044ecce389534ae9c58e99a10ecf5e038f7736ffaf6f5268abc`
- `supabase/functions/catalog-report/privacy.ts`: `9dee03b20211d5b3fcb2e05ad4be85a00112dd00f03fc6e5c834969381f0e44e`
- `supabase/functions/catalog-report/privacy.test.ts`: `db9b6d1c812679297295c5afb6c8d0226c99f94b8aedefff620111d4fa9d7bac`
- `supabase/functions/revenuecat-webhook/index.ts`: `968f41a01907c3f230b05b570bf31c85836105f532e70c9dbaebd594376840b5`
- `supabase/migrations/20260705000034_phase9_security_definer_hardening.sql`: `28e6e359282469c72a5a4669f308cae905141b7a311e4a99aa53834462bbc567`
- `supabase/migrations/20260711000038_shelf_freshness_invariants.sql`: `672df1e56fac4cdfc6bf641c3249221aaacf630439d28898a79ace2d25181bcd`
- `supabase/migrations/20260711000039_replenishment_alert_opt_in.sql`: `eac60d4bf92f465ad2264c509f8e0a2f412b5780f862cf602b8ff16e1e2e1299`
- `scripts/phase9/lib.mjs`: `6248cbe57cb3a77b3ba8fc36c3a78d4ab18ca363b275c4dbf7735dc3e3f91675`
- `scripts/phase9/release-contact-smoke.mjs`: `da12a4b38f9dddd85a6501454c16b92b5cb07f290d9f86f180fcfbe7b26bd0bd`
- `scripts/phase9/evidence-normalization-smoke.mjs`: `2de1e09c5988c4546cd543cd6fae6c3a90884b112775b7f579a1776ce3bb2be5`
- `scripts/phase9/release-smoke.mjs`: `9ba60c729718e063e73915576ee452f81da0da36f68eff1fb25b39661054a3fa`
- `scripts/phase9/rls-adversarial.mjs`: `1fbe4e90ce280a9d4c9c8e642ea7beb718cee6d1647ea399e1fd6e9511bfcf89`
- `scripts/phase9/build-release-qa-packet.mjs`: `21d5bc2cb93d3b8a9bcfcb43c9214388e65469296ca7a13debe345447b71f0f3`
- `scripts/phase9/live-supabase-adversarial.mjs`: `1219259653e4040ab4d31233d5a2906c44843189e30b859574a540f05be82c8d`
- `scripts/phase9/live-edge-auth.mjs`: `ae2764d73242fe3c9b5d9497c78d9b0b62cbd2438ec3ac633496004402d37441`
- `scripts/phase9/live-data-rights.mjs`: `fed1600ee42a0a3acd3b7010c729c2094c9b4ea26d59038fdb6cd914771f5aa4`
- `scripts/phase9/live-consent-withdrawal.mjs`: `baf9d94d3034bdf53c7bc7c2960eb7342aacf3c09b9b65f1c35bcb99806fe97b`
- `scripts/phase9/live-public-forms.mjs`: `e4bb52bf67f60df98aabcc9095dc7758e92c376d06cd17887bf12e70220ae789`
- `scripts/phase9/live-catalog-rate-limit.mjs`: `9325b416192733bd81da59811b9b08f2e1c58dcfa7c2aa43dd08ca9038046da6`
- `scripts/phase9/live-order-report-poll.mjs`: `1e5176ff563695bed27f63fcc8a51a7fdc77c05b523b9dfd4616070ad89c3206`
- `scripts/phase9/live-revenuecat-webhook.mjs`: `e4102043af0516e1713375e96d10b8edd4b77864c271d24e363f35632aa76870`
- `scripts/phase9/edge-auth-smoke.mjs`: `0342b70ddb0fce38edf33269106608fdbc5c6fc79840982c233df80ee118e880`
- `scripts/phase9/edge-functions-check.mjs`: `dd2be657d2c12ce50d79c90e039a04bd14c2578f8a9e6e0630f454136e7cc3c3`
- `scripts/phase9/data-rights-smoke.mjs`: `f5fd45e385d5ee677391e0dc011632af31eefd21d543d3471bcc76929026c7fe`
- `scripts/phase9/consent-withdrawal-smoke.mjs`: `7c0451f33fd799ac29a2bb162ae54d86dbd4cee5f81b17b223f84c15564d178e`
- `scripts/phase9/supabase-policy-lint.mjs`: `937e2ffda3ba57f7cb0f4b82892529695815b15c2e42da8e3c0f952cd4a77c89`
- `scripts/phase9/security-ci-smoke.mjs`: `ab3d8be0b2ada7da1a9b7890f4043768cfada3888e524e2964e251d3759566a7`
- `scripts/phase9/privacy-payload-audit.mjs`: `4f8c1bba9c1b9f8dbb29b8f7dee5b8688a16e609a4b455797ed6472ec5db5fc7`
- `scripts/phase9/dependency-sbom.mjs`: `0b36b22f21004af4913cd1c72b0f247765b888a3461ee074a3758a8c3d8df351`
- `scripts/phase9/store-build-inspect.mjs`: `01a6f0f239edcb670b244202fc2b930f94eb46762e556a7021f190752cdcc8db`
- `docs/phase-9/source-of-truth.md`: `b23f022feded586dadfd8e21d7c407b8b94f9ed317ae6ddde12dac1c5933c9da`
- `docs/phase-9/data-inventory.md`: `e65cb0862d1ba602ecdc5b1ded39d7bb79271273866e3343b90c5ebf1f1f2da8`
- `docs/phase-9/edge-function-auth-matrix.md`: `e93759bc6338c06bbfd883e0c704cba42c85eafd15369278564255b60d8e7786`
- `docs/phase-9/observability-payload-audit.md`: `3aa9508564cef79e704b14fdd43a80063e8e040ebc7dcdfa7f68a9cd8d86ada7`
- `docs/phase-9/security-scanner-evidence.md`: `878d37533e0f2cd94a77a774917e829f7436e854816ae9caf623e498c45f8566`
- `docs/phase-9/rollout-rollback-plan.md`: `4e91560fa71643bdbf91d3c2064a25a7961332d3c681661bd567a630af95a122`
- `docs/phase-9/incident-response-plan.md`: `cd3c1c87c47f2ba5f08f8a9abfdd8f05a3e02985d4e2cf0301f6781c2bad8d4c`
- `docs/phase-9/beta-evidence-summary.md`: `9f0be12a06fa6acb4ff83807a7e7245069a540d4726f04c503ac277b9586944e`
- `docs/phase-9/dependency-sbom.md`: `0296a48f97d54e286dce62f28eb54cc5ef0ebbcd29138fcdb20d0cb54d6e391a`
- `docs/phase-9/release-candidates/README.md`: `b32454b29c61424170b8ad2cabefc82a602366bfbb2f0f0ea86685fa1139d353`
- `docs/phase-9/release-candidates/_template/manifest.md`: `508a06e4058d45cee3ff22982c8e0d9f64e776cac176e246c99ae78a9d6865bb`
- `docs/phase-9/release-candidates/_template/commands.md`: `6df31562625d184bfe80a25191cbf34893ed3ed4bb7bce5d042ba37934ba609b`
- `docs/phase-9/release-candidates/_template/automated-verification.md`: `52e47fafb26188cda1a1492dadd0856b7e24cb4919e844fdeef09040bcef102f`
- `docs/phase-9/release-candidates/_template/manual-qa-matrix.md`: `8c1d69e7586dbbba577b3248e6b084fb621474a804b4d73d743d3a0b338348a2`
- `docs/phase-9/release-candidates/_template/security-review.md`: `f8e52e1e5f0aae45b69de9d7f7102b93478e332ab14e53c87511cf4a48a73405`
- `docs/phase-9/release-candidates/_template/privacy-review.md`: `73d1f5f35a317a2cc6e5b5e5df4b8ff6c4eaaf338b6be15c47ae9a2b09f69793`
- `docs/phase-9/release-candidates/_template/payments-review.md`: `2f716988be71b52f5f84f37df184f58eca16524ab5ce32bf8552db3de41c8aa5`
- `docs/phase-9/release-candidates/_template/observability-review.md`: `96d3a8f0e7b256c41ce93894e40c40d0192c3ee089f3543856ddd6d695450bbd`
- `docs/phase-9/release-candidates/_template/store-review-packet.md`: `3fdc5bf821032f6f4d49d92dbb30edbb73561b0e7393583dd71784d35d76414f`
- `docs/phase-9/release-candidates/_template/rollout-plan.md`: `14be2fbc8c4311ffae73fbf3362d38109507eb49c289a3bd5603639f2477744d`
- `docs/phase-9/release-candidates/_template/incident-plan.md`: `87b0647dd3a7e072821c18bba3be36a26835aed3611a5c3e313bcca3027ae3c3`
- `docs/phase-9/release-candidates/_template/signoff.md`: `a8bfb8395ad693c09d5940198d5e288db5638a2ac117e0d51a64347025752611`
