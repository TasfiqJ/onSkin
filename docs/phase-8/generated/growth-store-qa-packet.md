# Phase 8 Growth Store QA Packet

Generated: 2026-07-17T07:45:15.181Z
Status: blocked
Git SHA: 6241c23a30673d7ee9a0504a52d069ba4ea04d8d
Git status: clean

## Public Identity

- Final domain: BLOCKED
- Marketing URL: BLOCKED
- App Store URL: BLOCKED
- Play Store URL: NOT APPLICABLE
- Support email: BLOCKED

## Blockers

- None from code packet inputs.

## Warnings

- Final brand domain is missing.
- Marketing URL is missing.
- Support email is missing.
- App Store URL is missing.
- External evidence missing: brandSourceOfTruth.
- External evidence missing: domainDns.
- External evidence missing: iosUniversalLinks.
- External evidence missing: shareCardDeviceQa.
- External evidence missing: attributionPrivacy.
- External evidence missing: appStorePacket.
- External evidence missing: creatorCompliance.
- External evidence missing: supportResponse.
- External evidence missing: launchDashboard.
- External evidence missing: dryRun.
- External evidence missing: appleTeamId.
- External evidence missing: signedOffBy.

## Matrices

### linkRouting

- iOS installed opens app via Universal Links
- iOS not installed opens web fallback
- Desktop opens web fallback
- Invalid share ID never reveals sensitive context

### shareCard

- Reviewed non-safety two-product conflicts only
- 1080x1920 export
- Brand, CTA, footnote, and first-party link label present
- No product/profile/pregnancy/photo/rule data in URL
- Started, link created, succeeded/failed, sheet opened events present

### storeSubmission

- Metadata limits validated in tests
- No unsupported claims in public copy
- Screenshots use enabled features only
- Privacy labels and Data safety match code
- Account deletion and export evidence attached

### attribution

- Allowed campaign keys only
- Opaque share_id only
- No health/product/profile/contact fields
- No complex analytics objects

## Source Hashes

- `.env.example`: `0984b7c39628ce57f90fc39918b7863b7878335cf3c04fa33a69f1abd9bc5117`
- `package.json`: `1355fd9c03faea3cb3742522e15221a2d05a67f3aaff3113ef1b7dcbdc3996f7`
- `docs/hugeToDo/launch-contract.json`: `43bea3c862d7e36c7e8d744b87bcf21f65d721500e71e1f1cfa7492fbb14ee4b`
- `scripts/launch/contract.mjs`: `6a3ced1c0e7e54ef7db31e848aeeebd3617a77db02c3b51c98d6ee3789a9007d`
- `apps/mobile/app.config.js`: `2355312e00ff824a4092e5ab8d0a16b35e0e4910afaffaa1edf15f18d7f2ce43`
- `apps/mobile/src/lib/env.ts`: `22ebe3a408c87b87be7da9e4a2282feba8620d88405b43216eb961966bfb5b31`
- `apps/mobile/src/lib/launch/phase8.ts`: `8149b2ab7984be03fd26ff44d3d680e422473dd79b7ad559558138cad4cf6ff9`
- `apps/mobile/src/lib/growth/attribution.ts`: `80c9c4089fed353e7443deb38f9baa6ebb56b466a4fc07f2ce2caeb4f71f55e2`
- `apps/mobile/src/features/growth/shareLinks.ts`: `0173ed4e39393e7c16a597b305f15c02b471f70041574ca785d161137a4b7e4d`
- `apps/mobile/src/app/s/[shareId].tsx`: `2ebbc5d7a3d0dcd4023b80199e63eeecc53a10fd468a04d0b056bd4a7bc78b06`
- `apps/mobile/src/features/growth/shareCard.ts`: `e8254e8c72c51ea30f3fad1d9259e6c810c114bea2ee3d5bcabe89b00c936436`
- `apps/mobile/src/app/share/conflict/[ruleId].tsx`: `0bd46e014ebcb0e3f2affaacfda83b2685137028564bca5a717fa7ac81f038db`
- `apps/mobile/src/features/review/policy.ts`: `ae0deae45bf76323f0ce33832cb34d961d5bec065c5177ef6f8eb34df37b21fe`
- `apps/mobile/src/features/review/prompt.ts`: `c8d002cd9d7297b262e199074e3af4971bc7d752f62afa884ad04c924971f43b`
- `apps/mobile/src/lib/legal/storeMetadata.ts`: `eb209dc51a5639c1eaae942a9c5426a3044b15a49e0db8e636d3775f55acbb7c`
- `docs/phase-8/source-of-truth.md`: `a37b4c9915e4433a7aeda3ca42b5131578cf77394e0b8bbf200bcd9a8ceb22e9`
- `docs/phase-8/link-routing-runbook.md`: `4f794fbe84a313a34441cff9ffbc7a363a0e555fdc23e0248f685ff9e8fe92cd`
- `docs/phase-8/store-metadata-source-of-truth.md`: `17bbcb8962f7d8592a51d914f8ce7e5e40c83daa3be7a61c1a6fd1ef1abbe8fb`
- `docs/phase-8/store-compliance-packet.md`: `846963335b3c4c91ae1491cb33a7f1a8bcb0e91f27f20cb79882d855c7cf1a5e`
- `docs/phase-8/creator-brief.md`: `4d24677954d2ec765fc40c912806fbfc6cb9ab5020ad4d71b1c00cd5bc2453bb`
- `docs/phase-8/apple-ads-keyword-lab.md`: `386c58b62123b320adf38079b98b9a15446389595258eecc21fdaec94aaf5642`
- `docs/phase-8/acquisition-dashboard.md`: `2f30ec0584cfc725f34f1ed49d4c5d2250e4f120c40f80dcf1041966c17783eb`
- `docs/phase-8/launch-dry-run-checklist.md`: `3d357c7e4a8d4adc1d018da0d646d81944b7c30d0f2c357eac4264e14f76b798`
- `docs/phase-8/support-review-response-playbook.md`: `4bb43fd8996cd5a8585b84fc51de370ee0a3a4fe3d12375ec2bee908e77e3576`
- `docs/phase-8/phase-8-exit-review.md`: `7e2eb6fdf96e23539f54211c95a11c1092cd8fafcb42ac25985a37a755044963`
- `docs/phase-8/public-site/index.html`: `c42920a7f165be6cb2d878b6a3423c5a0531d992a0a8963f86c0ec924224cede`
- `docs/phase-8/public-site/share.html`: `8769234d1fbf894eb49d650d8643d8e25dfeb735c5caa199acb40c61836e9a49`
- `docs/phase-8/public-site/waitlist.html`: `2a27f02d64f526012b9dd022f7fb7591cab04f46470d3a6cd6c8439baf9c8a94`
- `docs/phase-8/public-site/support.html`: `d1235f470c05baf63ca059a5d188db7c03e4753499a4a4ee4ae4de75e7daef2a`
- `docs/phase-8/public-site/.well-known/apple-app-site-association.template.json`: `074f2a17a36b3659e6682ae1e8386c6c668c4362f90e88ed09cd98c0b5ab0813`
- `docs/phase-8/public-site/.well-known/assetlinks.template.json`: `1ec260dc15dc08af510cd49b83e4c63a3a369e1f9560bf174fc8b34aa097d319`
- `docs/HUMAN_SIMULATED_E2E_TESTING.md`: `db247b2acad570745d13b73913e3a18bef5ba9e4ea8d682322adfac7daa131d8`
- `docs/E2E_TESTING_CHECKLIST.md`: `1f37a8c5f6565073dfc4998dd2a46d6c3fbe6cba8f8dc4662039321af75be95f`
- `docs/USER_FLOW_TREE.md`: `4ae6f3e4706026d040f89f487bb3782a76160f4f55cf117e07142cfa331db3a0`
- `docs/e2e/generated/human-e2e-manifest.json`: `dd3df0d37d27548c746e21d970375c671489f3f137d28ba2b741d82934115aa4`
- `docs/e2e/generated/human-e2e-manifest.md`: `1dc13b093b6e57436a3d8af16330bf5ddc3f76948cf535033834f559879ca6f3`
- `docs/phase-5/generated/device-qa-packet.json`: `6854231e263e231fcbdd120120c935f8b56b081bd83053ec18dac4060073dacd`
- `docs/phase-5/generated/device-qa-packet.md`: `20ad3e89c0740fe9cf1cf44ce3c3aadd42b50518a4bdd86c1bfccc703b1b1eff`
- `docs/phase-6/generated/payments-qa-packet.json`: `38097c3b83595b6960227a40136074f7f19524da7418131583eff67ebd0c079e`
- `docs/phase-6/generated/payments-qa-packet.md`: `43939725b9e1b95f410d8e15769bdf92c2c251ebebd9dd02a3bcba815b5ee940`
- `docs/phase-7/generated/core-loop-qa-packet.json`: `39ff34a1198aa330c4a4ce23c9a0d6ed0e115d807cf09e29d8c7b6d68767bf1b`
- `docs/phase-7/generated/core-loop-qa-packet.md`: `c7072295229c530f5e5a25805457fd88a199896ad126b50334939ef6a534dbfb`
- `scripts/phase8/build-growth-store-qa-packet.mjs`: `417068519980f0e79e36d565a3deac14de38804daa59d0b5773d88fc89768461`
- `scripts/phase8/check-growth-store-readiness.mjs`: `014ac3f8dfd4baae43b57c494c778688c180ae996f8cb8b29f0a2660211902a7`
- `scripts/phase8/check-growth-store-smoke.mjs`: `89cc87c5da60b6eb86ae112c93eb1995309c82dc2336995113dd5a37b8c37a98`
- `scripts/phase9/lib.mjs`: `62cd70bb40e6792b8626922a38bdba9fa1e20a7539ddbbe1de43644d6ce18411`
- `supabase/migrations/20260616000028_phase8_growth.sql`: `9f0deaa909e7a5641c405b4b68870e58e3d143cb5956f2794e092ba704276e44`
- `supabase/functions/growth-event/index.ts`: `af59ae32fabd9310558274109db8cdd53455d09dc26074efb4758373f63a1770`
- `supabase/functions/waitlist/index.ts`: `d798455f90ccf72a5505e2dd5e42c3225d05ae5a4f3d8a2fcfc63cb86ed8c6ac`
