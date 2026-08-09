# Phase 8 Growth Store QA Packet

Generated: 2026-08-09T06:50:36.076Z
Status: blocked
Git SHA: c41edad9489a03deb2819bbba7053424c961fa11
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

- `.env.example`: `41af16d44a9531286d9dbe8339b15c0777f9246c5f84f4fd03efc19dbe14d217`
- `package.json`: `0e4f018aa53711f137cf17c7cfdd3a94ee79f4d0caa816c50c541f4486c62540`
- `docs/hugeToDo/launch-contract.json`: `ef6a34e9e8de58380296f08473211f4915ab81817cde4ee5394f6210f08ca3bb`
- `docs/hugeToDo/CORE-07-SHARE-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md`: `36231f4132e2a6192048b7f48afad9d1cd2ccc013d4453c55912a628997fa9ab`
- `scripts/launch/contract.mjs`: `7bec15c6d8aa7a5f744e094fa74c84969b6b09eeb23d97e94e05498315d5708b`
- `scripts/core02/clinical-rule-source-contract.test.mjs`: `627b0a03adc26059ed2828b55bc69d6a87b9662f8dbac9c5bdc89f6a42fc0382`
- `scripts/core07/share-admission-source-contract.mjs`: `ffbe2846213eb33235b0dad2f3fde61685cff6db92db0d887fed5071392cfd9d`
- `scripts/core07/share-admission-source-contract.test.mjs`: `8990c02aae82ed1271bc5e010373609a482ac40f1b565cfa60c70d3c9d9eb8a3`
- `apps/mobile/app.config.js`: `9153d53ac6e9b4b4688066c1ce94cf06758712dac646a1f0e7df10b9337e8c5f`
- `apps/mobile/src/lib/env.ts`: `10d3095fdac566e4720f2e99e0791bb8617c8c09f21618873c3fc919cf166757`
- `apps/mobile/src/lib/env.test.ts`: `5d2cb946d79920cbaec54eae3c9f0409fc6636673ac1e0f14ee8e6c5b5558bdc`
- `apps/mobile/src/lib/launch/phase7.ts`: `1d198075b9eed13f1b0b9cfcdff59043368999a46f2845df4c81ab518afa4f36`
- `apps/mobile/src/lib/launch/phase7.test.ts`: `a940f412b4300c8e98e4a2d7265c8b04b755f5371ed0501530d087572f31c4c3`
- `apps/mobile/src/lib/launch/phase8.ts`: `dedaffd1350a4f8288dfb029fad187b00f6899de3f7e05bdbe09d123058564e7`
- `apps/mobile/src/lib/launch/phase8.test.ts`: `7def95ec2a6b678d70e535babaf2c34d241ec112239fef4a4aac526d03c1977b`
- `apps/mobile/src/lib/growth/attribution.ts`: `80c9c4089fed353e7443deb38f9baa6ebb56b466a4fc07f2ce2caeb4f71f55e2`
- `apps/mobile/src/features/growth/shareAdmission.ts`: `02adedb821a476eeba4fd2bc06681feeba2008fa1c97ffd4937a39a569dc6327`
- `apps/mobile/src/features/growth/shareAdmission.test.ts`: `b91ac95fd984223a78d8cf7e90aafbecc93ca37b3720c998a2c74f9f50728db7`
- `apps/mobile/src/features/growth/publicLinkAdmission.ts`: `2010dbd8de265052387c6d8930df10fc77f152aa3da1529622ed47b1adfc1ab0`
- `apps/mobile/src/features/growth/publicLinkAdmission.test.ts`: `01dffc5dbcba810134a1f7939ff0212ef79fee924349008bde69a8ee43d05c23`
- `apps/mobile/src/features/growth/shareProjection.ts`: `181032634536521b98caee66fabda609be3e3832f238bf1c73b4f42fca08ab6b`
- `apps/mobile/src/features/growth/shareProjection.test.ts`: `1bc71c2592968386a9d620c63fd33672c7fc78cf4f209b7344f0e1c83ffd03d4`
- `apps/mobile/src/features/growth/ConflictCard.tsx`: `c507a02987606253932950df0066322a724edfccdc08286640882d0b660af981`
- `apps/mobile/src/features/growth/shareLinks.ts`: `36af63e30c40653b8940d7f8dbf89e7e6b451c3286b522181f77ff1f9a1127f7`
- `apps/mobile/src/features/growth/shareLinks.test.ts`: `a995256a1740d32d2608a0bfab05d053a80ec07407dbe86090690808bb92c706`
- `apps/mobile/src/features/growth/shareLandingRoute.test.ts`: `f4a329de6c143ef8b1ea376bf5f778e13861d28880a6462f6f1f03183632b8f0`
- `apps/mobile/src/features/growth/cardCopy.ts`: `e9f3d09dfa1ba628dd883088e2b67976eaa2164c3a509e5808f54435ef991776`
- `apps/mobile/src/features/growth/cardCopy.test.ts`: `c288a67751c6a181f80c8a93933f2aee36fd7d286d0f7f3faee72e42716d45c9`
- `apps/mobile/src/features/intelligence/conflictIdentity.ts`: `06b94824e2a2b164d3b40f38e3106252cf0f796a34292d8dcbbdeba7d0c20ecf`
- `apps/mobile/src/features/intelligence/conflictRoutes.test.ts`: `5afea2b23b272edfca8978c717523530ea5d2729a29367876899a53171bd949e`
- `apps/mobile/src/app/s/[shareId].tsx`: `1703e9e18281966cf0c6cf0d8d37524c80bfdc094da073eb04f8618da50af0f2`
- `apps/mobile/src/features/growth/shareCard.ts`: `a7059162afa68ee7cdd765a117d5c8edee387eaf5a8d7d85c78ff23ee0faafac`
- `apps/mobile/src/features/growth/shareCard.test.ts`: `fcecf1cd61bf89aa3693ac9bd3e1dde3432de81926f4d52598209ce36ded0e7b`
- `apps/mobile/src/app/conflict/[ruleId].tsx`: `18f00fd1e5f161dfda3cda01f952a5bc620e88598c7ed13ffdfa67c9d9587f4e`
- `apps/mobile/src/app/share/conflict/[ruleId].tsx`: `a996efa45ca90843bb78b4f07e188d27f5e41bb37d146c7379e0a1c3881cc473`
- `apps/mobile/src/features/review/policy.ts`: `ae0deae45bf76323f0ce33832cb34d961d5bec065c5177ef6f8eb34df37b21fe`
- `apps/mobile/src/features/review/prompt.ts`: `c8d002cd9d7297b262e199074e3af4971bc7d752f62afa884ad04c924971f43b`
- `apps/mobile/src/lib/legal/storeMetadata.ts`: `eb209dc51a5639c1eaae942a9c5426a3044b15a49e0db8e636d3775f55acbb7c`
- `docs/phase-8/source-of-truth.md`: `0c16aab57df886d9900d6629adc7431119bbeea8fa4e03a737e0559fbeb8c356`
- `docs/phase-8/link-routing-runbook.md`: `c4314fc17eb9941a0c63b10ccca883c7c4c9762e1c64b1c8de3e9cc12995d0f3`
- `docs/phase-8/store-metadata-source-of-truth.md`: `b0351e2736ff2e77cccc6ec7e3530c1165f1fac5bc862e9cfc3d1d653584da08`
- `docs/phase-8/store-compliance-packet.md`: `846963335b3c4c91ae1491cb33a7f1a8bcb0e91f27f20cb79882d855c7cf1a5e`
- `docs/phase-8/creator-brief.md`: `4d24677954d2ec765fc40c912806fbfc6cb9ab5020ad4d71b1c00cd5bc2453bb`
- `docs/phase-8/apple-ads-keyword-lab.md`: `386c58b62123b320adf38079b98b9a15446389595258eecc21fdaec94aaf5642`
- `docs/phase-8/acquisition-dashboard.md`: `fc0f930310046c7f10e3e7c385ad5a52bde711927ab645d74bd5fb1b247be252`
- `docs/phase-8/launch-dry-run-checklist.md`: `3d357c7e4a8d4adc1d018da0d646d81944b7c30d0f2c357eac4264e14f76b798`
- `docs/phase-8/support-review-response-playbook.md`: `4bb43fd8996cd5a8585b84fc51de370ee0a3a4fe3d12375ec2bee908e77e3576`
- `docs/phase-8/phase-8-exit-review.md`: `b22998175e5087040973e9216b7e2bbb9412506fc9db5816372c7737142fa4ab`
- `docs/phase-8/public-site/index.html`: `c42920a7f165be6cb2d878b6a3423c5a0531d992a0a8963f86c0ec924224cede`
- `docs/phase-8/public-site/share.html`: `45bced7d455386121e569aff4bf40b20dfccda7e54b4cd62560a313d2031c834`
- `docs/phase-8/public-site/waitlist.html`: `2a27f02d64f526012b9dd022f7fb7591cab04f46470d3a6cd6c8439baf9c8a94`
- `docs/phase-8/public-site/support.html`: `d1235f470c05baf63ca059a5d188db7c03e4753499a4a4ee4ae4de75e7daef2a`
- `docs/phase-8/public-site/.well-known/apple-app-site-association.template.json`: `074f2a17a36b3659e6682ae1e8386c6c668c4362f90e88ed09cd98c0b5ab0813`
- `docs/phase-8/public-site/.well-known/assetlinks.template.json`: `1ec260dc15dc08af510cd49b83e4c63a3a369e1f9560bf174fc8b34aa097d319`
- `docs/HUMAN_SIMULATED_E2E_TESTING.md`: `4eda39f0c47b2debcb7021ad2e71d010e217ee9970152f50e01890e61ef4891e`
- `docs/E2E_TESTING_CHECKLIST.md`: `34248253ee5234d7a92a7733f4579a191ff3bd398152da8941886ab79a786026`
- `docs/USER_FLOW_TREE.md`: `326c766318fbb18ba1f6d0c57ebc9ebe19333dbd3d9d81b7352bb22890eb345e`
- `docs/e2e/generated/human-e2e-manifest.json`: `d6780e5d700152200cdc68759b9358403b6304dc5ebd230f44cce321788200c0`
- `docs/e2e/generated/human-e2e-manifest.md`: `a83cb0e8cfbfb3aae9ab087c17b77844a9ea32ee9bf465fcfb85dc1008f4c3dd`
- `docs/phase-5/generated/device-qa-packet.json`: `fae8aecd9c352ddedab6474dc800c04fddcfe503f93b5ef7d202503323548b24`
- `docs/phase-5/generated/device-qa-packet.md`: `4ffc75d46d625965fe268a70352e413bfc4b9015fae7e8bfc8b7f14deac72bba`
- `docs/phase-6/generated/payments-qa-packet.json`: `822ee96197eb4d22035c4062562e53c869ea971d73eb9c1325ac66a1292a6cd3`
- `docs/phase-6/generated/payments-qa-packet.md`: `6388483aa48cb2abe60062d4251f57569cec7f779146ae031abee5bf3910619a`
- `docs/phase-7/generated/core-loop-qa-packet.json`: `02c52bcefb6da3f1ef31d415874a4a075af1d37ecfaa23b3c0f81e5336d9de71`
- `docs/phase-7/generated/core-loop-qa-packet.md`: `6e095a16107b977fe556594f8ac9a5a584cebbfe8234c29f808a8b8c9ec375a8`
- `scripts/phase8/build-growth-store-qa-packet.mjs`: `ac6279c12bb2f5f3314db3d1333ec30fa0b873712a5d14424e28ad3976009683`
- `scripts/phase8/check-growth-store-readiness.mjs`: `75106f91f70732d79811924589958cb7c469b477fef9278fb3d61da13aa8d3af`
- `scripts/phase8/check-growth-store-smoke.mjs`: `f3557324dca81f8687fb75ee2d8d76183ab3da26112acf0dc0db1323dcc295d4`
- `scripts/phase9/lib.mjs`: `2432468891aa67b138785021580caadcc27ab5d1c7aca8c5015e1ddc531d021c`
- `supabase/migrations/20260616000028_phase8_growth.sql`: `9f0deaa909e7a5641c405b4b68870e58e3d143cb5956f2794e092ba704276e44`
- `supabase/functions/growth-event/index.ts`: `af59ae32fabd9310558274109db8cdd53455d09dc26074efb4758373f63a1770`
- `supabase/functions/waitlist/index.ts`: `d798455f90ccf72a5505e2dd5e42c3225d05ae5a4f3d8a2fcfc63cb86ed8c6ac`
