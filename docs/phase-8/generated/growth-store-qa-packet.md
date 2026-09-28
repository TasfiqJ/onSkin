# Phase 8 Growth Store QA Packet

Generated: 2026-08-10T01:44:15.118Z
Status: blocked
Git SHA: 81bbc20e3146d67d6e3a71418d3c53a105bea547
Git status: clean

## Public Identity

- Final domain: BLOCKED
- Marketing URL: BLOCKED
- App Store URL: BLOCKED
- Play Store URL: NOT APPLICABLE
- Support email: BLOCKED

## Blockers

- CORE-07A share publication is not admitted; no runtime flag, final domain, reviewedBy field, or QA flag can authorize export.
- CORE-07A public links are not admitted; the repository has no production token service or reviewed retention, revocation, deletion, and abuse contract.

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

- Zero admission: no per-record link or token is generated, resolved, or treated as valid
- Neutral static unavailable fallback does not imply a reviewed shared record
- No landing impression, store-click, share_id, or destination analytics/network beacon
- Future iOS Universal Link activation requires separately admitted public-link authority
- Malformed, valid-looking, expired, revoked, deleted, or unknown identifiers remain unavailable

### shareCard

- Zero admission: no card capture, temporary file, link, network request, or native share sheet
- Only an explicit sanitized allowlist may cross a future private-to-share boundary
- No raw owned products, profile, pregnancy, photo, internal rule, reviewer, or provenance fields
- Future export requires an immutable exact-content receipt and exact-payload confirmation
- No share-started, link-created, sheet-opened, destination, or payload analytics

### storeSubmission

- Metadata limits validated in tests
- No unsupported claims in public copy
- Screenshots use enabled features only
- Privacy labels and Data safety match code
- Account deletion and export evidence attached

### attribution

- Allowed campaign keys only
- No share_id while public-link admission is closed
- No health/product/profile/contact fields
- No complex analytics objects

## Source Hashes

- `.env.example`: `d9825f22149f8d15e491d4f1d97fbc8311ce739564a36e1f0ed0ecc64464e091`
- `package.json`: `af6cec1697c363daf266bcd4032a184aa9a994a51cc6a8c0991da4c67b0d8c8e`
- `docs/hugeToDo/launch-contract.json`: `ef6a34e9e8de58380296f08473211f4915ab81817cde4ee5394f6210f08ca3bb`
- `docs/hugeToDo/CORE-07-SHARE-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md`: `066dce90fc4cf7749eebbd8dcf5874917d36484ddef097e60a94a1b3fc649dcb`
- `scripts/launch/contract.mjs`: `7bec15c6d8aa7a5f744e094fa74c84969b6b09eeb23d97e94e05498315d5708b`
- `scripts/core02/clinical-rule-source-contract.test.mjs`: `627b0a03adc26059ed2828b55bc69d6a87b9662f8dbac9c5bdc89f6a42fc0382`
- `scripts/core07/share-admission-source-contract.mjs`: `ffbe2846213eb33235b0dad2f3fde61685cff6db92db0d887fed5071392cfd9d`
- `scripts/core07/share-admission-source-contract.test.mjs`: `8990c02aae82ed1271bc5e010373609a482ac40f1b565cfa60c70d3c9d9eb8a3`
- `apps/mobile/app.config.js`: `81851010e4eb58d23f8e61ca270d979776390f3607d4a6afdf6106936756eb5c`
- `apps/mobile/src/lib/env.ts`: `d01f2db0a98f0537663312adc42bb375ca8523cdec282f2548a610b1f98383f1`
- `apps/mobile/src/lib/env.test.ts`: `5d2cb946d79920cbaec54eae3c9f0409fc6636673ac1e0f14ee8e6c5b5558bdc`
- `apps/mobile/src/lib/launch/phase7.ts`: `1d198075b9eed13f1b0b9cfcdff59043368999a46f2845df4c81ab518afa4f36`
- `apps/mobile/src/lib/launch/phase7.test.ts`: `c2e3fa53a0f06bc6ca7466d5260cca5fc403500d847eb32fb38699ff1f3f0cf5`
- `apps/mobile/src/lib/launch/phase8.ts`: `dedaffd1350a4f8288dfb029fad187b00f6899de3f7e05bdbe09d123058564e7`
- `apps/mobile/src/lib/launch/phase8.test.ts`: `b8b699ce63dcd78ba1a1747cdc413c36cc00827084d7b0612ce2d5f44e3c7b2f`
- `apps/mobile/src/lib/growth/attribution.ts`: `80c9c4089fed353e7443deb38f9baa6ebb56b466a4fc07f2ce2caeb4f71f55e2`
- `apps/mobile/src/features/growth/shareAdmission.ts`: `02adedb821a476eeba4fd2bc06681feeba2008fa1c97ffd4937a39a569dc6327`
- `apps/mobile/src/features/growth/shareAdmission.test.ts`: `8c9f4e8d16aa5cdd4dd9ef0911b129a700966e2990539f820424d620ea22c58b`
- `apps/mobile/src/features/growth/publicLinkAdmission.ts`: `2010dbd8de265052387c6d8930df10fc77f152aa3da1529622ed47b1adfc1ab0`
- `apps/mobile/src/features/growth/publicLinkAdmission.test.ts`: `89560602ca877d7da45e518657372be92929003accb55641e6628a07a6fc4e1e`
- `apps/mobile/src/features/growth/shareProjection.ts`: `181032634536521b98caee66fabda609be3e3832f238bf1c73b4f42fca08ab6b`
- `apps/mobile/src/features/growth/shareProjection.test.ts`: `13f4e6e502729400592522be787f629581e437cd934bbeada3b995d5bbd91a94`
- `apps/mobile/src/features/growth/ConflictCard.tsx`: `c507a02987606253932950df0066322a724edfccdc08286640882d0b660af981`
- `apps/mobile/src/features/growth/shareLinks.ts`: `36af63e30c40653b8940d7f8dbf89e7e6b451c3286b522181f77ff1f9a1127f7`
- `apps/mobile/src/features/growth/shareLinks.test.ts`: `7bf7ce568500a5849da0b7b261aad0f611f24f2076d514d36df07ba896c79194`
- `apps/mobile/src/features/growth/shareLandingRoute.test.ts`: `f4a329de6c143ef8b1ea376bf5f778e13861d28880a6462f6f1f03183632b8f0`
- `apps/mobile/src/features/growth/cardCopy.ts`: `a24de9609fad759eb3eab90dac948769901f53a30b3540803bf63082ddeb9067`
- `apps/mobile/src/features/growth/cardCopy.test.ts`: `98399b2b10fa7ce24935353ea1bd5b9eef06c614381d0d2a2d12748874d4d08d`
- `apps/mobile/src/features/intelligence/conflictIdentity.ts`: `06b94824e2a2b164d3b40f38e3106252cf0f796a34292d8dcbbdeba7d0c20ecf`
- `apps/mobile/src/features/intelligence/conflictRoutes.test.ts`: `5afea2b23b272edfca8978c717523530ea5d2729a29367876899a53171bd949e`
- `apps/mobile/src/app/s/[shareId].tsx`: `1703e9e18281966cf0c6cf0d8d37524c80bfdc094da073eb04f8618da50af0f2`
- `apps/mobile/src/features/growth/shareCard.ts`: `a7059162afa68ee7cdd765a117d5c8edee387eaf5a8d7d85c78ff23ee0faafac`
- `apps/mobile/src/features/growth/shareCard.test.ts`: `fcecf1cd61bf89aa3693ac9bd3e1dde3432de81926f4d52598209ce36ded0e7b`
- `apps/mobile/src/app/conflict/[ruleId].tsx`: `18f00fd1e5f161dfda3cda01f952a5bc620e88598c7ed13ffdfa67c9d9587f4e`
- `apps/mobile/src/app/share/conflict/[ruleId].tsx`: `a996efa45ca90843bb78b4f07e188d27f5e41bb37d146c7379e0a1c3881cc473`
- `apps/mobile/src/features/review/policy.ts`: `ae0deae45bf76323f0ce33832cb34d961d5bec065c5177ef6f8eb34df37b21fe`
- `apps/mobile/src/features/review/prompt.ts`: `53f5a43ac88d80dbf4bea6ca3be04825f797c612ab88b296eb1b537f3e9b7064`
- `apps/mobile/src/lib/legal/storeMetadata.ts`: `eb209dc51a5639c1eaae942a9c5426a3044b15a49e0db8e636d3775f55acbb7c`
- `docs/phase-8/source-of-truth.md`: `0c16aab57df886d9900d6629adc7431119bbeea8fa4e03a737e0559fbeb8c356`
- `docs/phase-8/link-routing-runbook.md`: `c4314fc17eb9941a0c63b10ccca883c7c4c9762e1c64b1c8de3e9cc12995d0f3`
- `docs/phase-8/store-metadata-source-of-truth.md`: `1ad4368293e42b6d59647035f2730fd113df8a4edb73f25e0c041bbf106cd3c7`
- `docs/phase-8/store-compliance-packet.md`: `846963335b3c4c91ae1491cb33a7f1a8bcb0e91f27f20cb79882d855c7cf1a5e`
- `docs/phase-8/creator-brief.md`: `5b1c100d1ba49d2263fd42b1efeec807de259b2fbac598334447a2c6f2461ff1`
- `docs/phase-8/apple-ads-keyword-lab.md`: `386c58b62123b320adf38079b98b9a15446389595258eecc21fdaec94aaf5642`
- `docs/phase-8/acquisition-dashboard.md`: `fc0f930310046c7f10e3e7c385ad5a52bde711927ab645d74bd5fb1b247be252`
- `docs/phase-8/launch-dry-run-checklist.md`: `3d357c7e4a8d4adc1d018da0d646d81944b7c30d0f2c357eac4264e14f76b798`
- `docs/phase-8/support-review-response-playbook.md`: `93b7767e74e756660cc74d7cf42420f1814b8cc6d59e3fb550398c173f43966b`
- `docs/phase-8/phase-8-exit-review.md`: `b22998175e5087040973e9216b7e2bbb9412506fc9db5816372c7737142fa4ab`
- `docs/phase-8/public-site/index.html`: `02dbcb8c451ebd8897c7aa080336fb6da6554330460821f83bb92d449cecf4f4`
- `docs/phase-8/public-site/share.html`: `45bced7d455386121e569aff4bf40b20dfccda7e54b4cd62560a313d2031c834`
- `docs/phase-8/public-site/waitlist.html`: `d9f77e6eae7f2389d1eb08c754f189986813ae723a081550e8687b19e1554899`
- `docs/phase-8/public-site/support.html`: `042e5f4db3a104cef7c229d6d3ea26b4a809e8458f482fb8cc7dcb755edd0030`
- `docs/phase-8/public-site/.well-known/apple-app-site-association.template.json`: `074f2a17a36b3659e6682ae1e8386c6c668c4362f90e88ed09cd98c0b5ab0813`
- `docs/phase-8/public-site/.well-known/assetlinks.template.json`: `1ec260dc15dc08af510cd49b83e4c63a3a369e1f9560bf174fc8b34aa097d319`
- `docs/HUMAN_SIMULATED_E2E_TESTING.md`: `109f35402903500e5bc61054e52bf8f0dbe090d3ade395d96303ea008bb7bc50`
- `docs/E2E_TESTING_CHECKLIST.md`: `34248253ee5234d7a92a7733f4579a191ff3bd398152da8941886ab79a786026`
- `docs/USER_FLOW_TREE.md`: `c9bea260d50a17c937c8cf0f0765cc30d3c0eb073a962db0fc9cf132a76dc0d9`
- `docs/e2e/generated/human-e2e-manifest.json`: `d6780e5d700152200cdc68759b9358403b6304dc5ebd230f44cce321788200c0`
- `docs/e2e/generated/human-e2e-manifest.md`: `a83cb0e8cfbfb3aae9ab087c17b77844a9ea32ee9bf465fcfb85dc1008f4c3dd`
- `docs/phase-5/generated/device-qa-packet.json`: `4c9604db2f25e6ababb5d3ef517b7c91a374de011b58853c7c9d7b4961ebfdec`
- `docs/phase-5/generated/device-qa-packet.md`: `6afc35deaa8e6ceaa8b2a99f7500ceed49473e5dc28634d5e4433cc7fe9c282b`
- `docs/phase-6/generated/payments-qa-packet.json`: `289814782ff1256043c4aaf3c487ac41b0aaf945cb7fe8ee61a9e1e5592fe1f0`
- `docs/phase-6/generated/payments-qa-packet.md`: `4ea09e4da916084d6615e43de47a22a3b35a680405c7b4fa41f9e5147e68c22f`
- `docs/phase-7/generated/core-loop-qa-packet.json`: `c9bf0ec465a361e4d5d880c9ff4d725c8572064d5e850d23041738b4fe6a1c99`
- `docs/phase-7/generated/core-loop-qa-packet.md`: `2f011da39ff33b2d1ef79e849473e6459e823817a050cb207ec80bd79f4d8ea4`
- `scripts/phase8/build-growth-store-qa-packet.mjs`: `ac6279c12bb2f5f3314db3d1333ec30fa0b873712a5d14424e28ad3976009683`
- `scripts/phase8/check-growth-store-readiness.mjs`: `75106f91f70732d79811924589958cb7c469b477fef9278fb3d61da13aa8d3af`
- `scripts/phase8/check-growth-store-smoke.mjs`: `0f3454f83188b7c2994ad97d869bd43c915db4f25743b9bc959220b35518ef72`
- `scripts/phase9/lib.mjs`: `2432468891aa67b138785021580caadcc27ab5d1c7aca8c5015e1ddc531d021c`
- `supabase/migrations/20260616000028_phase8_growth.sql`: `9f0deaa909e7a5641c405b4b68870e58e3d143cb5956f2794e092ba704276e44`
- `supabase/functions/growth-event/index.ts`: `af59ae32fabd9310558274109db8cdd53455d09dc26074efb4758373f63a1770`
- `supabase/functions/waitlist/index.ts`: `d798455f90ccf72a5505e2dd5e42c3225d05ae5a4f3d8a2fcfc63cb86ed8c6ac`
