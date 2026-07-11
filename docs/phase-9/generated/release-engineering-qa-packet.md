# Phase 9 Release Engineering QA Packet

Generated: 2026-07-11T18:48:56.063Z
Status: blocked
Git SHA: de9bee6b829c97a89c2f0e08a83e59c788baffa9
Git status: clean

## Release Identity

- Environment: development
- Final domain: BLOCKED
- Marketing URL: BLOCKED
- App Store URL: BLOCKED
- Play Store URL: BLOCKED
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
- External RC evidence missing: PHASE9_ANDROID_CLOSED_TEST_PASS=true.
- External RC evidence missing: PHASE9_ANDROID_TARGET_API_PASS=true.
- External RC evidence missing: PHASE9_ANDROID_16KB_PASS=true.
- External RC evidence missing: PHASE9_IOS_PRIVACY_REPORT_PASS=true.
- External RC evidence missing: PHASE9_APP_STORE_PACKET_PASS=true.
- External RC evidence missing: PHASE9_PLAY_PACKET_PASS=true.
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
- PHASE9_ANDROID_CLOSED_TEST_PASS: BLOCKED
- PHASE9_ANDROID_TARGET_API_PASS: BLOCKED
- PHASE9_ANDROID_16KB_PASS: BLOCKED
- PHASE9_IOS_PRIVACY_REPORT_PASS: BLOCKED
- PHASE9_APP_STORE_PACKET_PASS: BLOCKED
- PHASE9_PLAY_PACKET_PASS: BLOCKED
- PHASE9_DEVICE_QA_PASS: BLOCKED
- PHASE9_ROLLBACK_DRILL_PASS: BLOCKED
- PHASE9_INCIDENT_RESPONSE_PASS: BLOCKED
- PHASE9_DEPENDENCY_AUDIT_PASS: BLOCKED
- PHASE9_BETA_EVIDENCE_PASS: BLOCKED

## Source Hashes

- `.env.example`: `2e389243c757aee40769b8a15718d601160687cfdbd84517aecb34c8834255ba`
- `package.json`: `5714a4b7bd35cffa77b9951ebfcad3b090cc707a89bf0e0f6001ae7ad49c81b3`
- `package-lock.json`: `76b937f730e84620ffb5ec1082e40f841890324ff09b2222d5e99e9ac917f6bd`
- `.github/workflows/security.yml`: `fdb06576390f13621c3ce0887c4cc208f73d049c59a42d72c6cd04f9d9f6658d`
- `apps/mobile/app.base.json`: `a94796ab8d3d7f5765ccaf9e8137d55519b983b32175b76b2e26bc7e019869c5`
- `apps/mobile/app.config.js`: `1e991391ddb1a45682ce202fb95e4450bb799518c33eb78640af1949180b0fec`
- `apps/mobile/eas.json`: `1187d67c82776366a401a818708e33d186f9ffbdb7be196058a561e423d60f51`
- `apps/mobile/src/lib/env.ts`: `268bf5903053c48b3663f61139452deebe10da046e779eef000c1dfeb385d7a4`
- `apps/mobile/src/lib/env.test.ts`: `aa44ad9dd368cc132601c375e295067e23ec28e432b032ef05e3da76988c41fa`
- `apps/mobile/src/lib/launch/phase7.ts`: `4369c73351a58fd6cad9c5d94917185fadb7e67bf219aa9f85814dea5055e663`
- `apps/mobile/src/lib/launch/phase7.test.ts`: `d8f1f40b721e0424f4781b7f5769d6610648c3b1dfac45a9ee0bf42e273f1815`
- `apps/mobile/src/lib/analytics/eventRegistry.ts`: `334b5b3a7a298d4820b4c888016f53a7a0610fd9c158ce6e81ebabfb3fae1ce6`
- `apps/mobile/src/lib/analytics/track.ts`: `d613d0f4c9cb794b681b722850dc4b408d06eb8da0574f16681463d7b4c22be2`
- `apps/mobile/src/lib/iap/revenuecat.ts`: `f89981290f02bc355ca4ac279b9e660c86d480a9c6e54b041a4d600f0468b105`
- `apps/mobile/src/lib/observability/scrub.ts`: `ad231f592848825dbeaffcbd960a31e0ae916fe7e1916ded939e9b0f79deabed`
- `apps/mobile/src/lib/observability/sentry.ts`: `c81f27c8ac940d81b4ddd10521d922689840d7dfc7071ade812ff4e45e51fa9e`
- `apps/mobile/src/app/(tabs)/you.tsx`: `b13fdc0f555048e214cda72affba45497b2d340b0e60a0ab4ae020a2ccc54c24`
- `apps/mobile/src/app/(tabs)/progress.tsx`: `d009aa555a3230ad67a41dfdc2cbeb184b9684757b97085346fe5362e57c7125`
- `apps/mobile/src/app/progress/capture.tsx`: `843e4347b948b4720a4415e499e0f14a4bd3c020adb6d9814ffe1dddea1cb7dc`
- `apps/mobile/src/app/progress/review.tsx`: `04cb2815f6498d8b67a30ac817191092ebad3b895546fca890f824ced89689ad`
- `apps/mobile/src/app/progress/[id].tsx`: `4543b6d031a2b869fd61ebc0a3832eaa5deab7ebc220e7074b9ea4dc8e475d64`
- `apps/mobile/src/features/photos/PhotoTimelineLockGate.tsx`: `deccd291d391bbd6654664b00920622bbad9051e1deb2c79ad2e282503846218`
- `apps/mobile/src/features/photos/PhotoStorageGate.tsx`: `acda1b19266b960c94f493e80bab98f23002b0ff3bcfb93a4601f774e23d6888`
- `apps/mobile/src/features/photos/store.ts`: `1557f6d511baf44fec1d52d5e585d506a5f7ad7173ef0e95d5c7984ff2f02b6b`
- `apps/mobile/src/features/photos/usePhotos.ts`: `7bfcfda545ab719de32f460c859d6aa66075e97a84d200194360c114f2fb16a5`
- `apps/mobile/src/features/settings/actions.ts`: `93dbb3136e5a4888d667fb1f368e71bab259a7e51330f753a2777068315182b6`
- `apps/mobile/src/features/settings/localDeviceExport.ts`: `16dd55731879bace8db794440b2a369d40ea53cf092a7029d6ead480a8a12064`
- `apps/mobile/src/features/settings/localDeviceExport.test.ts`: `a9694e2201bcd58b8479bf40011b152a5192e2700451e37c7a630daffc448dd5`
- `apps/mobile/src/features/settings/localPrivateDataKeys.ts`: `c1f0d62052b3dbb47dfb763e1458c3732074a1c1296982f3ecb83e7560968943`
- `apps/mobile/src/features/settings/localPrivateData.ts`: `15c781cf4b5cae057d54b597587fa3ee9b6248044089c871fa917db275baaaba`
- `apps/mobile/src/lib/storage/privateKV.ts`: `bff21c993302bbdcb2a084e9be58a37aaf8f804c9b51813fd9da3e278eb2ee82`
- `apps/mobile/src/lib/storage/privateKV.test.ts`: `f40598f25641df646c012689736eb110d8686c82247447a62581f56b5bce1daf`
- `apps/mobile/src/lib/applock/AppLockProvider.tsx`: `3fa65fa22ba7c689861afb0bc6fa1d6492cbedc80b900891e574e8929ef31a75`
- `apps/mobile/src/lib/applock/authenticate.ts`: `fda9cd0c3818aa1c0f78edf9c499111622537c81c10f2f1761655a0cc652f0a8`
- `apps/mobile/src/lib/applock/authenticate.test.ts`: `947eb4b02863750bd6f2a420b28e889e31845b8a04808724ab40018114d97659`
- `apps/mobile/src/lib/auth/apple.ts`: `650ff0310cbc12acee871fb265a32f2b05306660af92ed31b36cc268582aa4e0`
- `supabase/functions/account-deletion/index.ts`: `5bb6817f086f4387e701e205493468c0b9a4c295e993a22ec6fafd7f8fd34d0b`
- `supabase/functions/_shared/body.ts`: `03e9ddbd56df2875f78b4f582ffdae13f0deca50d75d44ed3a5df4d685b39e6a`
- `supabase/functions/_shared/fetch.ts`: `d8ff37a96a965d3826d3d7df14a69eb00f35dddbc119d3a2f4cc92d778226a25`
- `supabase/functions/_shared/storagePath.ts`: `9367ade3719c7b7e38a7b090da7d904dd574bb43e29222bf5e8a839d3b377594`
- `supabase/functions/_shared/storagePath.test.ts`: `3caf9cbb38b676c4a96dd9ae3f19479c205a90d31bb83fee7c7474bc76a2a2e9`
- `supabase/functions/data-export/index.ts`: `b8e484616581a970ae19d8f86b342eaddb24fa44a9ad1367936b24f0f8d84f1f`
- `supabase/functions/consent-withdrawal/index.ts`: `9da0e6b2b2b41057f1aa0e7f84620f7caa4b6dad3932b9959b0171efbc674b25`
- `supabase/functions/subscription-grants/index.ts`: `706cf81639c3ee765820c482ec0d2a21e8ae63d4711a73b529036b6f153ae4a5`
- `supabase/functions/catalog-search/index.ts`: `6a2548c2709d0c61dc3710ab130037f6a6a1ab294d58c73335bb8300ce7f2aea`
- `supabase/functions/catalog-search/catalogContract.ts`: `cbefae5cb524a20ec66aea62cc092d02d7e6d68d70080cec02a33342f2d91df0`
- `supabase/functions/catalog-search/catalogContract.test.ts`: `ed8d55597732e97a3a76bf27e7e64456660b7882a5bb9687d2f295da5fdfb589`
- `supabase/functions/catalog-lookup/index.ts`: `1d5f69b7ee82f45e7f2e4ed221783a28e67e275d6df3f69688b4562a26ed0134`
- `supabase/functions/catalog-lookup/catalogContract.ts`: `60733dac6228405052bac40f9336581042f24a3503b75be43ad238cb78fcb91d`
- `supabase/functions/catalog-lookup/catalogContract.test.ts`: `c91e14a46870197c03171f83ce64cc69ad4e5c649294fc7675e3149a9cb938f1`
- `supabase/functions/catalog-report/index.ts`: `bff289eeca7657c0fa0e65ec686c07903dfa08a36c7a7691150cd28417d4aa36`
- `supabase/functions/catalog-report/privacy.ts`: `9dee03b20211d5b3fcb2e05ad4be85a00112dd00f03fc6e5c834969381f0e44e`
- `supabase/functions/catalog-report/privacy.test.ts`: `db9b6d1c812679297295c5afb6c8d0226c99f94b8aedefff620111d4fa9d7bac`
- `supabase/functions/revenuecat-webhook/index.ts`: `d240f129c8052426ae8adaea8e4accc17a9c8daf14104899bdc8a0ae7663bf6a`
- `supabase/migrations/20260705000034_phase9_security_definer_hardening.sql`: `28e6e359282469c72a5a4669f308cae905141b7a311e4a99aa53834462bbc567`
- `supabase/migrations/20260711000038_shelf_freshness_invariants.sql`: `672df1e56fac4cdfc6bf641c3249221aaacf630439d28898a79ace2d25181bcd`
- `supabase/migrations/20260711000039_replenishment_alert_opt_in.sql`: `eac60d4bf92f465ad2264c509f8e0a2f412b5780f862cf602b8ff16e1e2e1299`
- `scripts/phase9/lib.mjs`: `af0b4c651325a3fbb33eb94147744cb23253fa439066861e3ef1b64cbae7a083`
- `scripts/phase9/release-contact-smoke.mjs`: `e4695f91978bbebbe2ed447b543b3d163b6b81c8313c4aecf490a72acf67e58a`
- `scripts/phase9/evidence-normalization-smoke.mjs`: `2de1e09c5988c4546cd543cd6fae6c3a90884b112775b7f579a1776ce3bb2be5`
- `scripts/phase9/release-smoke.mjs`: `72289bcf0fd39e9039d06a7b4c27ffa7a3868061cabde34bc72c897adcbd6043`
- `scripts/phase9/rls-adversarial.mjs`: `1fbe4e90ce280a9d4c9c8e642ea7beb718cee6d1647ea399e1fd6e9511bfcf89`
- `scripts/phase9/build-release-qa-packet.mjs`: `f2ecc5d4b1a43fde15c6ddca15e18e6f68ed48e3863489219eb2d777ac2e6f4d`
- `scripts/phase9/live-supabase-adversarial.mjs`: `1219259653e4040ab4d31233d5a2906c44843189e30b859574a540f05be82c8d`
- `scripts/phase9/live-edge-auth.mjs`: `ae2764d73242fe3c9b5d9497c78d9b0b62cbd2438ec3ac633496004402d37441`
- `scripts/phase9/live-data-rights.mjs`: `fed1600ee42a0a3acd3b7010c729c2094c9b4ea26d59038fdb6cd914771f5aa4`
- `scripts/phase9/live-consent-withdrawal.mjs`: `baf9d94d3034bdf53c7bc7c2960eb7342aacf3c09b9b65f1c35bcb99806fe97b`
- `scripts/phase9/live-public-forms.mjs`: `e4bb52bf67f60df98aabcc9095dc7758e92c376d06cd17887bf12e70220ae789`
- `scripts/phase9/live-catalog-rate-limit.mjs`: `9325b416192733bd81da59811b9b08f2e1c58dcfa7c2aa43dd08ca9038046da6`
- `scripts/phase9/live-order-report-poll.mjs`: `1e5176ff563695bed27f63fcc8a51a7fdc77c05b523b9dfd4616070ad89c3206`
- `scripts/phase9/live-revenuecat-webhook.mjs`: `98f2d8496eb4f5c19706c3ce7d17d82c84223ba776bae6084e9706ebf3e6e718`
- `scripts/phase9/edge-auth-smoke.mjs`: `f83551bb457e0a53dad7132350d56f363525ac70088517bfa4bc7ac852c72095`
- `scripts/phase9/edge-functions-check.mjs`: `23de6b1e91a031036ec5369839fa31a48c97d6295c050de16bab6670550cd590`
- `scripts/phase9/data-rights-smoke.mjs`: `3295e5438139c48ece91dbf5800a2b3a090ca15718e8796c9303442e7b6f0605`
- `scripts/phase9/consent-withdrawal-smoke.mjs`: `7c0451f33fd799ac29a2bb162ae54d86dbd4cee5f81b17b223f84c15564d178e`
- `scripts/phase9/supabase-policy-lint.mjs`: `bc34caeea0df827ec02e9e952606aac19106560a88279ed40bca45466908470e`
- `scripts/phase9/security-ci-smoke.mjs`: `ab3d8be0b2ada7da1a9b7890f4043768cfada3888e524e2964e251d3759566a7`
- `scripts/phase9/privacy-payload-audit.mjs`: `623a43e5794cebd23863114d21fb80cd34aa8785db1fe056b64cef7b6e3052d7`
- `scripts/phase9/dependency-sbom.mjs`: `0b36b22f21004af4913cd1c72b0f247765b888a3461ee074a3758a8c3d8df351`
- `scripts/phase9/store-build-inspect.mjs`: `6dbda3144157e2b8f75f92b81dc3cf52310154fbd5a8a64ccd80942745ea5366`
- `docs/phase-9/source-of-truth.md`: `b23f022feded586dadfd8e21d7c407b8b94f9ed317ae6ddde12dac1c5933c9da`
- `docs/phase-9/data-inventory.md`: `e65cb0862d1ba602ecdc5b1ded39d7bb79271273866e3343b90c5ebf1f1f2da8`
- `docs/phase-9/edge-function-auth-matrix.md`: `e93759bc6338c06bbfd883e0c704cba42c85eafd15369278564255b60d8e7786`
- `docs/phase-9/observability-payload-audit.md`: `3aa9508564cef79e704b14fdd43a80063e8e040ebc7dcdfa7f68a9cd8d86ada7`
- `docs/phase-9/security-scanner-evidence.md`: `878d37533e0f2cd94a77a774917e829f7436e854816ae9caf623e498c45f8566`
- `docs/phase-9/rollout-rollback-plan.md`: `d251c08b7a24ad16686bc31b74b11ed50fb3158154d5aec4b0b81df4b2c24a2e`
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
