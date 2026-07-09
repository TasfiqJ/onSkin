# Phase 8 Growth Store QA Packet

Generated: 2026-07-09T14:27:41.262Z
Status: blocked
Git SHA: b8c176cbe9c51162dc58e1f5d62e357abba26a38
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
- `package.json`: `ec9126b6605a01f80aa1c12a6d20ab37146aabdb024bf2661682c1ecf9a9c335`
- `apps/mobile/app.config.js`: `5b383ac2e7cf52bc80e75c680c9321282734cc94c1ca5f3ebd4df249c429a08c`
- `apps/mobile/src/lib/env.ts`: `2f07a9ac7fa9a07c287c36614cd77aa2c4d06fbcf9fd9037733413f6528b8321`
- `apps/mobile/src/lib/launch/phase8.ts`: `94ac42c54e192d2f3c641de05609846ff3de9892646d5cc6ad41a098acbdac70`
- `apps/mobile/src/lib/growth/attribution.ts`: `ad7a471633455bcdf45c95f8ce41ef4a7275c108786b06ba5f63d424d272208f`
- `apps/mobile/src/features/growth/shareLinks.ts`: `0173ed4e39393e7c16a597b305f15c02b471f70041574ca785d161137a4b7e4d`
- `apps/mobile/src/app/s/[shareId].tsx`: `98ca033789f88188c3056bb2a9f5d411bf8de52cf5b44e408c15c311c4c4e54d`
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
- `docs/HUMAN_SIMULATED_E2E_TESTING.md`: `bac3f0403cbec1055dc8290a168c521962974b09143e8444c9feca59bc7ee9f6`
- `docs/E2E_TESTING_CHECKLIST.md`: `014a9213d104d0a5bac7f1752cd94e938d3d5461d0ec5cffbf92e31678f96f7e`
- `docs/USER_FLOW_TREE.md`: `fd488bff8539e7bb01fdf453b2b7fd62463b5812e42872768865296ad837f827`
- `docs/e2e/generated/human-e2e-manifest.json`: `b3b6da7d062300ccbe340df1d5ccea968c9d49eff36332dfb9abaf7dfd5c0954`
- `docs/e2e/generated/human-e2e-manifest.md`: `f52b20185669572413704a96299774e2b07314eec9808d78bc7be5ed3013c261`
- `docs/phase-5/generated/device-qa-packet.json`: `874618061a082c6759d821313e0eda91a4c3ea5c33f2c8d23c4ced62fe3c1522`
- `docs/phase-5/generated/device-qa-packet.md`: `6eb1b6676f639210437547257badce83e0002c7777f3d3b6f55158e787fb6382`
- `docs/phase-6/generated/payments-qa-packet.json`: `6a8ae532b40e6e52f18101b423a1c07c1e7d7c83a23e73901ab5cc5f225d3f3f`
- `docs/phase-6/generated/payments-qa-packet.md`: `55242a7b0c9600d2a9b35b81a9e3ec81e1ae8c8b2f756c6d1ce5b330c5c98b04`
- `docs/phase-7/generated/core-loop-qa-packet.json`: `6ad26f0bf8c0d2f89d91c6d024f6eedece36bc136626522e0704ad5c2b0477a6`
- `docs/phase-7/generated/core-loop-qa-packet.md`: `2b17d43ef9806466052bb5e486a50a7026e26f05a861e273dc878dbba9693a23`
- `scripts/phase8/build-growth-store-qa-packet.mjs`: `6070ec2ffd588b13555481ab5173e7d7783958977662807199e3dc16bd5c1122`
- `scripts/phase8/check-growth-store-readiness.mjs`: `e6602b38bf458f5759f9fc82f9e9defb38611c1252fdb308bc61f81555d2fac6`
- `scripts/phase8/check-growth-store-smoke.mjs`: `ad8b8a7dc8530c305cec3c5ac61efea434c1538d93020ed3d9b1acb33a0490a0`
- `scripts/phase9/lib.mjs`: `6ea9876b9f4b8ee106fe8690ce4626e4faedcf099f72285d0ead99cae5d44ace`
- `supabase/migrations/20260616000028_phase8_growth.sql`: `629bcda19f7f227679b8202a6d0234392dba62d4cf602023d0c2b976c576f14e`
- `supabase/functions/growth-event/index.ts`: `a7945cfe8706fffeec0bb733aac5a9a19a47545c2dfa021c9807db907b6261ae`
- `supabase/functions/waitlist/index.ts`: `828be1876b1aa1de84e33267a912b957a05a018b42d9207ade2be7d34157d256`
