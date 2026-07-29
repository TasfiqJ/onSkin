# Phase 8 Growth Store QA Packet

Generated: 2026-07-29T08:28:04.423Z
Status: blocked
Git SHA: d70f556c827e8d03bd93e6274333594a0d60ce70
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

- `.env.example`: `5514e31f85bd2f7155d8bbab2bdda9874cb6ecc92bc7bb2164c62bc6d6276a52`
- `package.json`: `fce10a58e3001d05ac2d809317f3ae6890996da1a07e080563460eaf7ab54cf1`
- `docs/hugeToDo/launch-contract.json`: `3b74e9d87e3327ce5fe8829ab2a22f42a2af23668176aedcd72a65da53d4ac6b`
- `scripts/launch/contract.mjs`: `1799e586dbc2cdb6679422c3634199ce7da730e4cb1d03a08c6f2da2ba1a4fc9`
- `apps/mobile/app.config.js`: `4c92065418906f4eaa6d5ff3ed5aea7997ef1c0c70734673c2f7fceba685932c`
- `apps/mobile/src/lib/env.ts`: `22ebe3a408c87b87be7da9e4a2282feba8620d88405b43216eb961966bfb5b31`
- `apps/mobile/src/lib/launch/phase8.ts`: `8149b2ab7984be03fd26ff44d3d680e422473dd79b7ad559558138cad4cf6ff9`
- `apps/mobile/src/lib/growth/attribution.ts`: `80c9c4089fed353e7443deb38f9baa6ebb56b466a4fc07f2ce2caeb4f71f55e2`
- `apps/mobile/src/features/growth/shareLinks.ts`: `fb87d418754d6c1590a181db32dada60e1885fd8006da0e38d9b96a95febf3e8`
- `apps/mobile/src/app/s/[shareId].tsx`: `6357836090591a592544884599c9177dfbe397b5b7ef1f5a4c9cb489d5957aa5`
- `apps/mobile/src/features/growth/shareCard.ts`: `e8254e8c72c51ea30f3fad1d9259e6c810c114bea2ee3d5bcabe89b00c936436`
- `apps/mobile/src/app/share/conflict/[ruleId].tsx`: `c01a7d3b07823b92b83c4014da0b3ebbea4a0aecbd44abeb494b6a972abb92bd`
- `apps/mobile/src/features/review/policy.ts`: `ae0deae45bf76323f0ce33832cb34d961d5bec065c5177ef6f8eb34df37b21fe`
- `apps/mobile/src/features/review/prompt.ts`: `c8d002cd9d7297b262e199074e3af4971bc7d752f62afa884ad04c924971f43b`
- `apps/mobile/src/lib/legal/storeMetadata.ts`: `eb209dc51a5639c1eaae942a9c5426a3044b15a49e0db8e636d3775f55acbb7c`
- `docs/phase-8/source-of-truth.md`: `a37b4c9915e4433a7aeda3ca42b5131578cf77394e0b8bbf200bcd9a8ceb22e9`
- `docs/phase-8/link-routing-runbook.md`: `4f794fbe84a313a34441cff9ffbc7a363a0e555fdc23e0248f685ff9e8fe92cd`
- `docs/phase-8/store-metadata-source-of-truth.md`: `17bbcb8962f7d8592a51d914f8ce7e5e40c83daa3be7a61c1a6fd1ef1abbe8fb`
- `docs/phase-8/store-compliance-packet.md`: `846963335b3c4c91ae1491cb33a7f1a8bcb0e91f27f20cb79882d855c7cf1a5e`
- `docs/phase-8/creator-brief.md`: `4d24677954d2ec765fc40c912806fbfc6cb9ab5020ad4d71b1c00cd5bc2453bb`
- `docs/phase-8/apple-ads-keyword-lab.md`: `386c58b62123b320adf38079b98b9a15446389595258eecc21fdaec94aaf5642`
- `docs/phase-8/acquisition-dashboard.md`: `fc0f930310046c7f10e3e7c385ad5a52bde711927ab645d74bd5fb1b247be252`
- `docs/phase-8/launch-dry-run-checklist.md`: `3d357c7e4a8d4adc1d018da0d646d81944b7c30d0f2c357eac4264e14f76b798`
- `docs/phase-8/support-review-response-playbook.md`: `4bb43fd8996cd5a8585b84fc51de370ee0a3a4fe3d12375ec2bee908e77e3576`
- `docs/phase-8/phase-8-exit-review.md`: `7e2eb6fdf96e23539f54211c95a11c1092cd8fafcb42ac25985a37a755044963`
- `docs/phase-8/public-site/index.html`: `c42920a7f165be6cb2d878b6a3423c5a0531d992a0a8963f86c0ec924224cede`
- `docs/phase-8/public-site/share.html`: `8769234d1fbf894eb49d650d8643d8e25dfeb735c5caa199acb40c61836e9a49`
- `docs/phase-8/public-site/waitlist.html`: `2a27f02d64f526012b9dd022f7fb7591cab04f46470d3a6cd6c8439baf9c8a94`
- `docs/phase-8/public-site/support.html`: `d1235f470c05baf63ca059a5d188db7c03e4753499a4a4ee4ae4de75e7daef2a`
- `docs/phase-8/public-site/.well-known/apple-app-site-association.template.json`: `074f2a17a36b3659e6682ae1e8386c6c668c4362f90e88ed09cd98c0b5ab0813`
- `docs/phase-8/public-site/.well-known/assetlinks.template.json`: `1ec260dc15dc08af510cd49b83e4c63a3a369e1f9560bf174fc8b34aa097d319`
- `docs/HUMAN_SIMULATED_E2E_TESTING.md`: `4eda39f0c47b2debcb7021ad2e71d010e217ee9970152f50e01890e61ef4891e`
- `docs/E2E_TESTING_CHECKLIST.md`: `34248253ee5234d7a92a7733f4579a191ff3bd398152da8941886ab79a786026`
- `docs/USER_FLOW_TREE.md`: `75f3816b04c3bc799123cfe14303e89b405c8d26079f3238be0d8aa8f3865b24`
- `docs/e2e/generated/human-e2e-manifest.json`: `65b7e16ea6c5c4a1d1ea41e81aafb2860a78a8502c6687887163d011ae8a51af`
- `docs/e2e/generated/human-e2e-manifest.md`: `aa4b36c47c6616c938189a1c98d4f7ee5bedde3b7834247595eb356d5fb73f28`
- `docs/phase-5/generated/device-qa-packet.json`: `7edfbff0c2f39e82e47fec0ba5d5617301bb7a0b3c6fa90c6f45153650eebb39`
- `docs/phase-5/generated/device-qa-packet.md`: `aff90827030fcddd435cde71253d164baf8a847a65cd4a0777351d6d25287abd`
- `docs/phase-6/generated/payments-qa-packet.json`: `6b5f7da57f5a2c7fb0f1e5ba37a4e856238a4a98b7c69eac5d4e73ec4b28ca7b`
- `docs/phase-6/generated/payments-qa-packet.md`: `1ff05c349bb03d40fe68b9dd30c3dc07f6daf6695f7376b9fb7cbc02470adb51`
- `docs/phase-7/generated/core-loop-qa-packet.json`: `b3f5b84a99141a06d3728709f7034fe50ba74481865f24c1f5b7fe90d685dbfb`
- `docs/phase-7/generated/core-loop-qa-packet.md`: `cccd3a432ecb00a33b940a65f0d19c3db5c24568fcf11a12a8bbc810ae4d6e83`
- `scripts/phase8/build-growth-store-qa-packet.mjs`: `a125aa4557441949dcee8d8b943b2590767da3e9b76ea2569bf46dca9a1b261b`
- `scripts/phase8/check-growth-store-readiness.mjs`: `d1496dce11a51b2c0afce0f574c32bd4d102abccdc3598870268a311377524f4`
- `scripts/phase8/check-growth-store-smoke.mjs`: `89cc87c5da60b6eb86ae112c93eb1995309c82dc2336995113dd5a37b8c37a98`
- `scripts/phase9/lib.mjs`: `2432468891aa67b138785021580caadcc27ab5d1c7aca8c5015e1ddc531d021c`
- `supabase/migrations/20260616000028_phase8_growth.sql`: `9f0deaa909e7a5641c405b4b68870e58e3d143cb5956f2794e092ba704276e44`
- `supabase/functions/growth-event/index.ts`: `af59ae32fabd9310558274109db8cdd53455d09dc26074efb4758373f63a1770`
- `supabase/functions/waitlist/index.ts`: `d798455f90ccf72a5505e2dd5e42c3225d05ae5a4f3d8a2fcfc63cb86ed8c6ac`
