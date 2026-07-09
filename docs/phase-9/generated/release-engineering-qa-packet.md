# Phase 9 Release Engineering QA Packet

Generated: 2026-07-09T23:51:43.337Z
Status: blocked
Git SHA: d9ae09c5aa82932c5f6106079591e5bbd8ed9ba8
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

- `.env.example`: `09fde04cf7c14297e488d608a3f3e2067d3ac357543212debe3c7758ed98f6e1`
- `package.json`: `bb14b0e53b7e6f8dd754c32790aa9d2646cf7b9d86b7feb8a21d93857ff9d3df`
- `package-lock.json`: `f85eb88858555c4ec6827aedf170ce7752f18e0f9c94c9a0e09a2c6a449f0d26`
- `.github/workflows/security.yml`: `fdb06576390f13621c3ce0887c4cc208f73d049c59a42d72c6cd04f9d9f6658d`
- `apps/mobile/app.base.json`: `a94796ab8d3d7f5765ccaf9e8137d55519b983b32175b76b2e26bc7e019869c5`
- `apps/mobile/app.config.js`: `5b383ac2e7cf52bc80e75c680c9321282734cc94c1ca5f3ebd4df249c429a08c`
- `apps/mobile/eas.json`: `1187d67c82776366a401a818708e33d186f9ffbdb7be196058a561e423d60f51`
- `apps/mobile/src/lib/env.ts`: `2f07a9ac7fa9a07c287c36614cd77aa2c4d06fbcf9fd9037733413f6528b8321`
- `apps/mobile/src/lib/env.test.ts`: `aa44ad9dd368cc132601c375e295067e23ec28e432b032ef05e3da76988c41fa`
- `apps/mobile/src/lib/launch/phase7.ts`: `4369c73351a58fd6cad9c5d94917185fadb7e67bf219aa9f85814dea5055e663`
- `apps/mobile/src/lib/launch/phase7.test.ts`: `d8f1f40b721e0424f4781b7f5769d6610648c3b1dfac45a9ee0bf42e273f1815`
- `apps/mobile/src/lib/analytics/eventRegistry.ts`: `334b5b3a7a298d4820b4c888016f53a7a0610fd9c158ce6e81ebabfb3fae1ce6`
- `apps/mobile/src/lib/analytics/track.ts`: `ba85d7ef840dbd322970efdd3f040997b07b881fa461050c1bb50142220051a4`
- `apps/mobile/src/lib/iap/revenuecat.ts`: `b95779de93cd11304b541cd6c44c01e2b86eaa56c3a408a1569f52b47bde0a75`
- `apps/mobile/src/lib/observability/scrub.ts`: `222a302206c4bbeb9102dc1ffed86a7404a08390a4ed341cc4fcb25f876d803e`
- `apps/mobile/src/lib/observability/sentry.ts`: `d228827c369b9119584b2b75bab2b067debca9b5bc5510f58c8233da931c3230`
- `apps/mobile/src/features/settings/actions.ts`: `28c211982c43826005b3de809a6d7a1a1b6e572fec33b9948bf1a1d56943882c`
- `apps/mobile/src/features/settings/localPrivateData.ts`: `3f1dad6f24a65d88ad542e91138a36cf35ce3d67a99b23745c1fa2ac84afb33a`
- `apps/mobile/src/lib/auth/apple.ts`: `2c61d825f40abde9f55e0bfb11ba32e345ee642f7d79de5002f0e1c404eb1ff8`
- `supabase/functions/account-deletion/index.ts`: `d7c16fe965a32ecb8b7d7d1781fac87a409a1035123c47224573f83ecdc8cc73`
- `supabase/functions/_shared/body.ts`: `03e9ddbd56df2875f78b4f582ffdae13f0deca50d75d44ed3a5df4d685b39e6a`
- `supabase/functions/_shared/fetch.ts`: `d8ff37a96a965d3826d3d7df14a69eb00f35dddbc119d3a2f4cc92d778226a25`
- `supabase/functions/_shared/storagePath.ts`: `9367ade3719c7b7e38a7b090da7d904dd574bb43e29222bf5e8a839d3b377594`
- `supabase/functions/_shared/storagePath.test.ts`: `b87f295f444c3f241379cd93a7eb8573bedbfe6830528bd521f0dac30348e5d2`
- `supabase/functions/data-export/index.ts`: `76310cf108a0c3bbb9cd24e76bac0aa5671d0085ea39b00e605e9d8fbc155f96`
- `supabase/functions/consent-withdrawal/index.ts`: `60c95bdc1eb58d117a334b0b786ec6c394e7145f1cdc6680ed86184cd01189e9`
- `supabase/functions/subscription-grants/index.ts`: `2922047f3ca942aa406785a00ee8175ac3f1899f6b97502f49393a6b204baa02`
- `supabase/functions/catalog-search/index.ts`: `6469ad3fb88b6eba7e09bdc00a211618a2b25d36123ec6775bdb120c05c5c44d`
- `supabase/functions/catalog-lookup/index.ts`: `943138cd87be526acaea5c84acff7250967670bfe964805f315c8eb71a9f474c`
- `supabase/functions/catalog-report/index.ts`: `831529e201bf59a61f9eb929cc5939c14797fb9e0eb0b11e1bf817a6008517ec`
- `supabase/functions/catalog-report/privacy.ts`: `d0d39665dc489392ff8d29c524d46ee182695772cf0fc7293c1c9d93c53e2c8e`
- `supabase/functions/catalog-report/privacy.test.ts`: `1a6014b406eba2e771901906309e78162321af3352af63d33d20fd017df70c76`
- `supabase/functions/revenuecat-webhook/index.ts`: `210324cc1b57e321885d2fb523cf62a0b2adcfca3cee9fc2df9164ffde9147c4`
- `supabase/migrations/20260705000034_phase9_security_definer_hardening.sql`: `28e6e359282469c72a5a4669f308cae905141b7a311e4a99aa53834462bbc567`
- `scripts/phase9/lib.mjs`: `544dbaaaba3f7eafcc2527d7700933f31e672a68f160fcb7222caa1389557ff1`
- `scripts/phase9/release-contact-smoke.mjs`: `e4695f91978bbebbe2ed447b543b3d163b6b81c8313c4aecf490a72acf67e58a`
- `scripts/phase9/evidence-normalization-smoke.mjs`: `2de1e09c5988c4546cd543cd6fae6c3a90884b112775b7f579a1776ce3bb2be5`
- `scripts/phase9/release-smoke.mjs`: `0e57ab70a4ff8f980de2fb37d9942c79ebd80851ad52fe683ed5b2443771d928`
- `scripts/phase9/rls-adversarial.mjs`: `24ede97ccbd865c99911ebdcb48c389c151b337565bc68e6788456bbb6c366bc`
- `scripts/phase9/build-release-qa-packet.mjs`: `150dfec06d8c6a828241315bcabba03900ad024878057860c49be86fd076d50a`
- `scripts/phase9/live-supabase-adversarial.mjs`: `98c836d4dd6494c3ac6bf24719e97afd7f7cb4f8d542162deebbe1e15beed7ef`
- `scripts/phase9/live-edge-auth.mjs`: `ae2764d73242fe3c9b5d9497c78d9b0b62cbd2438ec3ac633496004402d37441`
- `scripts/phase9/live-data-rights.mjs`: `987f92e64ae380e5f9e6e641117ef7a85e89a40749b278ecede19fa2f5417b65`
- `scripts/phase9/live-consent-withdrawal.mjs`: `baf9d94d3034bdf53c7bc7c2960eb7342aacf3c09b9b65f1c35bcb99806fe97b`
- `scripts/phase9/live-public-forms.mjs`: `6bd8c49e0caa2c7dcb10f57998abf38622e30cf4dce3182420d3137edc6fe04a`
- `scripts/phase9/live-catalog-rate-limit.mjs`: `9325b416192733bd81da59811b9b08f2e1c58dcfa7c2aa43dd08ca9038046da6`
- `scripts/phase9/live-order-report-poll.mjs`: `1e5176ff563695bed27f63fcc8a51a7fdc77c05b523b9dfd4616070ad89c3206`
- `scripts/phase9/live-revenuecat-webhook.mjs`: `98f2d8496eb4f5c19706c3ce7d17d82c84223ba776bae6084e9706ebf3e6e718`
- `scripts/phase9/edge-auth-smoke.mjs`: `92968a8bbbc5375a8ed3b52d087ae3c3b9b0f2435d5ddbcfcc2f0a6ed004284e`
- `scripts/phase9/edge-functions-check.mjs`: `81b6c6d8413d27166379c589f00434daf631feab4a406fd6e17b2cfbe6430f4b`
- `scripts/phase9/data-rights-smoke.mjs`: `3a4c649781cd0ca3b1a238afbc1919d1cf5a5c50702b0fd0f089b7855feb4af2`
- `scripts/phase9/consent-withdrawal-smoke.mjs`: `9204ce366e7f0175afddfdf2080d1abe3b3fc4d38ba75a2d891655a7334c3c9d`
- `scripts/phase9/supabase-policy-lint.mjs`: `153c5f455a7d99176feff036fa172fb4dfaa6ddbc97e8718c7cfbaf2f9bee183`
- `scripts/phase9/security-ci-smoke.mjs`: `f477d24f5873e1dfa5b00e95819f1237f9e79861d6c8434d6d07668031e9c1b9`
- `scripts/phase9/privacy-payload-audit.mjs`: `4e662826a00d001cfcc7b5f87230210132cfb5e1fcc518ba6c5403faeeec1ede`
- `scripts/phase9/dependency-sbom.mjs`: `bc7aad0525237b1116698211196de85849bb5892266557bdc5da8fe8fa7723db`
- `scripts/phase9/store-build-inspect.mjs`: `6dbda3144157e2b8f75f92b81dc3cf52310154fbd5a8a64ccd80942745ea5366`
- `docs/phase-9/source-of-truth.md`: `b23f022feded586dadfd8e21d7c407b8b94f9ed317ae6ddde12dac1c5933c9da`
- `docs/phase-9/data-inventory.md`: `cc2120ad02de7e8bb2d57747a556f113beb011cb46eb05d9147c09c3148eb947`
- `docs/phase-9/edge-function-auth-matrix.md`: `eabfcd63602581316cf83f0ca42411f88b6206e578d0168bb7cc044a847c8743`
- `docs/phase-9/observability-payload-audit.md`: `3aa9508564cef79e704b14fdd43a80063e8e040ebc7dcdfa7f68a9cd8d86ada7`
- `docs/phase-9/security-scanner-evidence.md`: `1390557c60c5637f16ac10b46d2b1b38190ba4d0dddda43bf84a3bbd65c43428`
- `docs/phase-9/rollout-rollback-plan.md`: `d251c08b7a24ad16686bc31b74b11ed50fb3158154d5aec4b0b81df4b2c24a2e`
- `docs/phase-9/incident-response-plan.md`: `cd3c1c87c47f2ba5f08f8a9abfdd8f05a3e02985d4e2cf0301f6781c2bad8d4c`
- `docs/phase-9/beta-evidence-summary.md`: `33c87c4593ff88fd1f02abbbf7c6a4888db95c2887168d716a3d01148608f424`
- `docs/phase-9/dependency-sbom.md`: `0296a48f97d54e286dce62f28eb54cc5ef0ebbcd29138fcdb20d0cb54d6e391a`
- `docs/phase-9/release-candidates/README.md`: `b32454b29c61424170b8ad2cabefc82a602366bfbb2f0f0ea86685fa1139d353`
- `docs/phase-9/release-candidates/_template/manifest.md`: `f4ec302ce801aa339b65b8cd4a547229ea2ae97eb6e49d42b57fec92b3a8bc0c`
- `docs/phase-9/release-candidates/_template/commands.md`: `6df31562625d184bfe80a25191cbf34893ed3ed4bb7bce5d042ba37934ba609b`
- `docs/phase-9/release-candidates/_template/automated-verification.md`: `89414039ee531a470f6e1477e8e79259aca82114a082efefbe87217437c84617`
- `docs/phase-9/release-candidates/_template/manual-qa-matrix.md`: `3cecb063d68d5134415559f051774cb4b4592a0a34fe47433e3a898f2e128c3f`
- `docs/phase-9/release-candidates/_template/security-review.md`: `b29d2c3a652d4256a88cac5025e7854eb7a8ab86e2e4ef62347828044ddd9ce3`
- `docs/phase-9/release-candidates/_template/privacy-review.md`: `000fb7d8b0204c9be7bc5a18aaf6b121903f73390ac43c17488b0dbda7d365f2`
- `docs/phase-9/release-candidates/_template/payments-review.md`: `cb7705c76b3643d379fcb920b12193f3cac7398ee91963e9c4aa073c5f8e8282`
- `docs/phase-9/release-candidates/_template/observability-review.md`: `61d40c23e5f506e4cb1c9968eff9cbea41b590db56511d21d441a74e74474d01`
- `docs/phase-9/release-candidates/_template/store-review-packet.md`: `3fdc5bf821032f6f4d49d92dbb30edbb73561b0e7393583dd71784d35d76414f`
- `docs/phase-9/release-candidates/_template/rollout-plan.md`: `a7a0270ce4b8a2156e7b1e90baf8108868b122a704fa14da1581f59a42681365`
- `docs/phase-9/release-candidates/_template/incident-plan.md`: `87b0647dd3a7e072821c18bba3be36a26835aed3611a5c3e313bcca3027ae3c3`
- `docs/phase-9/release-candidates/_template/signoff.md`: `cd48f15216882ab40c3ec3efa714bbe4f5ba230ec77ef10af2f76b6e4729c079`
