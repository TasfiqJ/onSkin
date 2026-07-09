# Phase 8 Growth Store QA Packet

Generated: 2026-07-09T21:37:35.118Z
Status: blocked
Git SHA: 323aadd71c8048cdc0268145cf82389840a98cc6
Git status: clean

## Public Identity

- Final domain: BLOCKED
- Marketing URL: BLOCKED
- App Store URL: BLOCKED
- Play Store URL: BLOCKED
- Support email: BLOCKED

## Blockers

- None from code packet inputs.

## Warnings

- Final brand domain is missing.
- Marketing URL is missing.
- Support email is missing.
- App Store URL is missing.
- Play Store URL is missing.
- External evidence missing: brandSourceOfTruth.
- External evidence missing: domainDns.
- External evidence missing: iosUniversalLinks.
- External evidence missing: androidAppLinks.
- External evidence missing: shareCardDeviceQa.
- External evidence missing: attributionPrivacy.
- External evidence missing: appStorePacket.
- External evidence missing: playStorePacket.
- External evidence missing: creatorCompliance.
- External evidence missing: supportResponse.
- External evidence missing: launchDashboard.
- External evidence missing: dryRun.
- External evidence missing: appleTeamId.
- External evidence missing: androidCertificateFingerprints.
- External evidence missing: signedOffBy.

## Matrices

### linkRouting

- iOS installed opens app via Universal Links
- iOS not installed opens web fallback
- Android installed opens app via App Links
- Android not installed opens web fallback
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

- `.env.example`: `09fde04cf7c14297e488d608a3f3e2067d3ac357543212debe3c7758ed98f6e1`
- `package.json`: `2cd969f5304354242b6341aeb16db281d12c941eed9e40bc18e4d955a7c579c3`
- `apps/mobile/app.config.js`: `5b383ac2e7cf52bc80e75c680c9321282734cc94c1ca5f3ebd4df249c429a08c`
- `apps/mobile/src/lib/env.ts`: `2f07a9ac7fa9a07c287c36614cd77aa2c4d06fbcf9fd9037733413f6528b8321`
- `apps/mobile/src/lib/launch/phase8.ts`: `94ac42c54e192d2f3c641de05609846ff3de9892646d5cc6ad41a098acbdac70`
- `apps/mobile/src/lib/growth/attribution.ts`: `3c40957a4a64c8a427eef0cebf021d60388514ce249a823f296187e367ab5cd4`
- `apps/mobile/src/features/growth/shareLinks.ts`: `0173ed4e39393e7c16a597b305f15c02b471f70041574ca785d161137a4b7e4d`
- `apps/mobile/src/app/s/[shareId].tsx`: `2ebbc5d7a3d0dcd4023b80199e63eeecc53a10fd468a04d0b056bd4a7bc78b06`
- `apps/mobile/src/features/growth/shareCard.ts`: `e8254e8c72c51ea30f3fad1d9259e6c810c114bea2ee3d5bcabe89b00c936436`
- `apps/mobile/src/app/share/conflict/[ruleId].tsx`: `2d3372b7a4d726109665bbe067ac38bf4866f5a4daf3a539c52a322e860dd240`
- `apps/mobile/src/features/review/policy.ts`: `ae0deae45bf76323f0ce33832cb34d961d5bec065c5177ef6f8eb34df37b21fe`
- `apps/mobile/src/features/review/prompt.ts`: `e345835e33c6a899d4337bd2ff332d7003224571db610ad3be32adc3613a9a57`
- `apps/mobile/src/lib/legal/storeMetadata.ts`: `1708605207ee343e401eb71ed07c38af193232841ac35f1fbf7c0459aa5ffa68`
- `docs/phase-8/source-of-truth.md`: `a37b4c9915e4433a7aeda3ca42b5131578cf77394e0b8bbf200bcd9a8ceb22e9`
- `docs/phase-8/link-routing-runbook.md`: `43b789dd31a1dc3bbef6cc351935fbfcd8c852678c5954429ff71bf469b91e90`
- `docs/phase-8/store-metadata-source-of-truth.md`: `834d3988706f584a02ebc9ec0bcdcfd6fea8e3d648fa2982521eb41718607a80`
- `docs/phase-8/store-compliance-packet.md`: `846963335b3c4c91ae1491cb33a7f1a8bcb0e91f27f20cb79882d855c7cf1a5e`
- `docs/phase-8/creator-brief.md`: `4d24677954d2ec765fc40c912806fbfc6cb9ab5020ad4d71b1c00cd5bc2453bb`
- `docs/phase-8/apple-ads-keyword-lab.md`: `386c58b62123b320adf38079b98b9a15446389595258eecc21fdaec94aaf5642`
- `docs/phase-8/acquisition-dashboard.md`: `444868fad465a28a1732161b2a3d3c177854f9589e48ac137f7c3658452b2877`
- `docs/phase-8/launch-dry-run-checklist.md`: `3d357c7e4a8d4adc1d018da0d646d81944b7c30d0f2c357eac4264e14f76b798`
- `docs/phase-8/support-review-response-playbook.md`: `4bb43fd8996cd5a8585b84fc51de370ee0a3a4fe3d12375ec2bee908e77e3576`
- `docs/phase-8/phase-8-exit-review.md`: `7e2eb6fdf96e23539f54211c95a11c1092cd8fafcb42ac25985a37a755044963`
- `docs/phase-8/public-site/index.html`: `c42920a7f165be6cb2d878b6a3423c5a0531d992a0a8963f86c0ec924224cede`
- `docs/phase-8/public-site/share.html`: `8769234d1fbf894eb49d650d8643d8e25dfeb735c5caa199acb40c61836e9a49`
- `docs/phase-8/public-site/waitlist.html`: `2a27f02d64f526012b9dd022f7fb7591cab04f46470d3a6cd6c8439baf9c8a94`
- `docs/phase-8/public-site/support.html`: `00e3ac9648d19b3c1beb147623bedeba84effe74e4889a57d401872d934e2bd6`
- `docs/phase-8/public-site/.well-known/apple-app-site-association.template.json`: `074f2a17a36b3659e6682ae1e8386c6c668c4362f90e88ed09cd98c0b5ab0813`
- `docs/phase-8/public-site/.well-known/assetlinks.template.json`: `1ec260dc15dc08af510cd49b83e4c63a3a369e1f9560bf174fc8b34aa097d319`
- `docs/HUMAN_SIMULATED_E2E_TESTING.md`: `d7d616fcbe9078b55c0d4b3bf5e88ae19570fa533aee8edc599cf1956c7c9149`
- `docs/E2E_TESTING_CHECKLIST.md`: `014a9213d104d0a5bac7f1752cd94e938d3d5461d0ec5cffbf92e31678f96f7e`
- `docs/USER_FLOW_TREE.md`: `224efda71c736d59f83aabd8432cf174cdfd64d148245713d38e17a8f8794647`
- `docs/e2e/generated/human-e2e-manifest.json`: `e6fd3d871a5d80b4c7ad9f51a45731399e9be1f1846de3231795bb298c1babb1`
- `docs/e2e/generated/human-e2e-manifest.md`: `09c53bb8774f7e58d22f48173a9852843d96044891e9fde141e116fd52ea71f1`
- `docs/phase-5/generated/device-qa-packet.json`: `ca78837fc2396233147e26b88c6d76cc63664d310d7752a4235b828e9ab5d345`
- `docs/phase-5/generated/device-qa-packet.md`: `0cc8a288612bb88880838f4da6596fde657b597b43963ceaa07864392dfed7e6`
- `docs/phase-6/generated/payments-qa-packet.json`: `dd9d9cfb95d57b1c836c777f6a8aae12bfa3f43a19a933db00235e05364836d4`
- `docs/phase-6/generated/payments-qa-packet.md`: `447729dece6efa071365ab9e8582c1548f70cbd24d0a3d849cc40535ec3fd878`
- `docs/phase-7/generated/core-loop-qa-packet.json`: `91fe01a347d831feca3c6f2d97f1dba242f39d1c6361b324c830496507bcc976`
- `docs/phase-7/generated/core-loop-qa-packet.md`: `a184b36c18700a1a538d8e4f9cc57bc143823c39719c198a7eb1c94756581e9d`
- `scripts/phase8/build-growth-store-qa-packet.mjs`: `6070ec2ffd588b13555481ab5173e7d7783958977662807199e3dc16bd5c1122`
- `scripts/phase8/check-growth-store-readiness.mjs`: `4ebec879035401ebcb1bbe62a3315a4b183475dd5b0659b7efbe6fe3d38718f5`
- `scripts/phase8/check-growth-store-smoke.mjs`: `ad8b8a7dc8530c305cec3c5ac61efea434c1538d93020ed3d9b1acb33a0490a0`
- `scripts/phase9/lib.mjs`: `544dbaaaba3f7eafcc2527d7700933f31e672a68f160fcb7222caa1389557ff1`
- `supabase/migrations/20260616000028_phase8_growth.sql`: `629bcda19f7f227679b8202a6d0234392dba62d4cf602023d0c2b976c576f14e`
- `supabase/functions/growth-event/index.ts`: `fbcbc8abdd0165bfa1ac693994bec7f6019e63ce6901a156e744394c9161c8fd`
- `supabase/functions/waitlist/index.ts`: `828be1876b1aa1de84e33267a912b957a05a018b42d9207ade2be7d34157d256`
