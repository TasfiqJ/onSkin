# Phase 9 Release Engineering QA Packet

Generated: 2026-07-07T07:36:14.746Z
Status: blocked
Git SHA: 3178a54def49e6641f6abf575a8546943cb1488a
Git status: DIRTY

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

- Release QA packet generated with a dirty Git worktree; do not use it as final RC evidence.
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

- `package.json`: `e40603ffe4af231c437cd64f3fe5a0fed26bdd3bf4f522e2ec31d658262611e8`
- `package-lock.json`: `1c13e399c5f12e19fc9c540a774bec9674f0c0f33db5e2cac0d569d65962ead4`
- `.github/workflows/security.yml`: `fdb06576390f13621c3ce0887c4cc208f73d049c59a42d72c6cd04f9d9f6658d`
- `apps/mobile/app.base.json`: `6b2d2b08e8c0092c04126228a9683cfb918c17f827a66ea8c181e73f6a366fd6`
- `apps/mobile/app.config.js`: `5b383ac2e7cf52bc80e75c680c9321282734cc94c1ca5f3ebd4df249c429a08c`
- `apps/mobile/eas.json`: `1187d67c82776366a401a818708e33d186f9ffbdb7be196058a561e423d60f51`
- `apps/mobile/src/lib/env.ts`: `2f07a9ac7fa9a07c287c36614cd77aa2c4d06fbcf9fd9037733413f6528b8321`
- `apps/mobile/src/lib/env.test.ts`: `aa44ad9dd368cc132601c375e295067e23ec28e432b032ef05e3da76988c41fa`
- `apps/mobile/src/lib/launch/phase7.ts`: `d4a708c1e06157624ac4d37d47ecf789768022787abc3ce1cc9fc17e5ef4a078`
- `apps/mobile/src/lib/launch/phase7.test.ts`: `474d2dbdbfdc9368789c627a1b4a6966aad7e0fc978c8636645f743edcdfcdc8`
- `apps/mobile/src/lib/analytics/eventRegistry.ts`: `0d47943e5a722f0e5f97427a919e50c0aaa9e2dbaa43d50f7ec98207ab8f85cb`
- `apps/mobile/src/lib/analytics/track.ts`: `7ddefd4443143d554d72bba46abe785736c9ecf912d411c27ccf6ddb75c7ed45`
- `apps/mobile/src/lib/iap/revenuecat.ts`: `b95779de93cd11304b541cd6c44c01e2b86eaa56c3a408a1569f52b47bde0a75`
- `apps/mobile/src/lib/observability/scrub.ts`: `222a302206c4bbeb9102dc1ffed86a7404a08390a4ed341cc4fcb25f876d803e`
- `apps/mobile/src/lib/observability/sentry.ts`: `d228827c369b9119584b2b75bab2b067debca9b5bc5510f58c8233da931c3230`
- `apps/mobile/src/features/settings/actions.ts`: `5ce8b0eece14b2dbd9a6b0378ea7ad71c53cdd6f718a6d9e1246fb61c717b6bd`
- `apps/mobile/src/features/settings/localPrivateData.ts`: `ec22645356726c6cc23a250317869035c0ee0c0bba868bf1cafd2953680c053f`
- `apps/mobile/src/lib/auth/apple.ts`: `2c61d825f40abde9f55e0bfb11ba32e345ee642f7d79de5002f0e1c404eb1ff8`
- `supabase/functions/account-deletion/index.ts`: `d7c16fe965a32ecb8b7d7d1781fac87a409a1035123c47224573f83ecdc8cc73`
- `supabase/functions/_shared/body.ts`: `03e9ddbd56df2875f78b4f582ffdae13f0deca50d75d44ed3a5df4d685b39e6a`
- `supabase/functions/_shared/fetch.ts`: `d8ff37a96a965d3826d3d7df14a69eb00f35dddbc119d3a2f4cc92d778226a25`
- `supabase/functions/data-export/index.ts`: `613170a95c01697505bdf17a4b83dbdafd6e6823f041161059bd1d79dc107e93`
- `supabase/functions/consent-withdrawal/index.ts`: `fa5f9949677e076c648ce90da97c631b67e53ea72ad94e0daa27199d68f14521`
- `supabase/functions/subscription-grants/index.ts`: `2922047f3ca942aa406785a00ee8175ac3f1899f6b97502f49393a6b204baa02`
- `supabase/functions/catalog-search/index.ts`: `6469ad3fb88b6eba7e09bdc00a211618a2b25d36123ec6775bdb120c05c5c44d`
- `supabase/functions/catalog-lookup/index.ts`: `943138cd87be526acaea5c84acff7250967670bfe964805f315c8eb71a9f474c`
- `supabase/functions/catalog-report/index.ts`: `5a063bb6db5e1a5194e17b498b61ed0e9abbaef1d62c7cb80f09be9da429c621`
- `supabase/functions/revenuecat-webhook/index.ts`: `7899144905d1966dccc526e106dfb1ace848c6f492383a97699d5859a7a49fa5`
- `supabase/migrations/20260705000034_phase9_security_definer_hardening.sql`: `28e6e359282469c72a5a4669f308cae905141b7a311e4a99aa53834462bbc567`
- `scripts/phase9/lib.mjs`: `d2eeb648cca2cc61457e9796d6f1074081effb8847b2ec37544c3e7df3ce3752`
- `scripts/phase9/release-smoke.mjs`: `fdc537b7d6a979bfcc1a471fa3c86f976134ec444391bf703359cf0cb7e0fec2`
- `scripts/phase9/build-release-qa-packet.mjs`: `67e1082e32f61da090905b0e1f7b16528a1e527e6e0ec8042edcc0b32a09d541`
- `scripts/phase9/live-supabase-adversarial.mjs`: `98c836d4dd6494c3ac6bf24719e97afd7f7cb4f8d542162deebbe1e15beed7ef`
- `scripts/phase9/live-edge-auth.mjs`: `ae2764d73242fe3c9b5d9497c78d9b0b62cbd2438ec3ac633496004402d37441`
- `scripts/phase9/live-data-rights.mjs`: `987f92e64ae380e5f9e6e641117ef7a85e89a40749b278ecede19fa2f5417b65`
- `scripts/phase9/live-consent-withdrawal.mjs`: `baf9d94d3034bdf53c7bc7c2960eb7342aacf3c09b9b65f1c35bcb99806fe97b`
- `scripts/phase9/live-public-forms.mjs`: `6bd8c49e0caa2c7dcb10f57998abf38622e30cf4dce3182420d3137edc6fe04a`
- `scripts/phase9/live-catalog-rate-limit.mjs`: `9325b416192733bd81da59811b9b08f2e1c58dcfa7c2aa43dd08ca9038046da6`
- `scripts/phase9/live-order-report-poll.mjs`: `1e5176ff563695bed27f63fcc8a51a7fdc77c05b523b9dfd4616070ad89c3206`
- `scripts/phase9/live-revenuecat-webhook.mjs`: `b135d21cc68f67fc0a1ca7f90f6ef00fcc84fad925001df6e0f828a80611b1ac`
- `scripts/phase9/edge-auth-smoke.mjs`: `a5da3372de530aa4faf1781a020422bd63eb3fa238e21873263b6c80487558be`
- `scripts/phase9/data-rights-smoke.mjs`: `b2fff6b199e1adc5b994a4113ebb9f27a7d07b4050452e02128e423ad1033d31`
- `scripts/phase9/supabase-policy-lint.mjs`: `153c5f455a7d99176feff036fa172fb4dfaa6ddbc97e8718c7cfbaf2f9bee183`
- `scripts/phase9/security-ci-smoke.mjs`: `f477d24f5873e1dfa5b00e95819f1237f9e79861d6c8434d6d07668031e9c1b9`
- `scripts/phase9/privacy-payload-audit.mjs`: `35a52d3a99b55738600119ffb62235fd0d4ec5742ee3fd86857e9c3bbb7b0b16`
- `scripts/phase9/dependency-sbom.mjs`: `8f2358b22445dd93b6537c388bf7718c93f0730f93b5f0cfb607f57dccaa8d17`
- `scripts/phase9/store-build-inspect.mjs`: `99cf8592a39992e5a1cc57e80d228d44752de7125ead7a5f4508018451eae094`
- `docs/phase-9/source-of-truth.md`: `c8ff3e307284f90a71ff497b131e9309c7e3d9c2876fbc9f7490b239a90f154f`
- `docs/phase-9/data-inventory.md`: `f7cf68cd1ec95fae581bd98623206994b1baa2daec42ba03339d7e41b0ce0abe`
- `docs/phase-9/edge-function-auth-matrix.md`: `eabfcd63602581316cf83f0ca42411f88b6206e578d0168bb7cc044a847c8743`
- `docs/phase-9/observability-payload-audit.md`: `3aa9508564cef79e704b14fdd43a80063e8e040ebc7dcdfa7f68a9cd8d86ada7`
- `docs/phase-9/security-scanner-evidence.md`: `1390557c60c5637f16ac10b46d2b1b38190ba4d0dddda43bf84a3bbd65c43428`
- `docs/phase-9/rollout-rollback-plan.md`: `d251c08b7a24ad16686bc31b74b11ed50fb3158154d5aec4b0b81df4b2c24a2e`
- `docs/phase-9/incident-response-plan.md`: `cd3c1c87c47f2ba5f08f8a9abfdd8f05a3e02985d4e2cf0301f6781c2bad8d4c`
