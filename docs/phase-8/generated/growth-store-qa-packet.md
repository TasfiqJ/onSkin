# Phase 8 Growth Store QA Packet

Generated: 2026-07-04T07:57:29.959Z
Status: blocked

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

- `apps/mobile/app.config.js`: `a61fa8ca0d36efcecb37a870a732f0d0fe0bd97a7da2f677d685363bbd5a0c46`
- `apps/mobile/src/lib/env.ts`: `366cfbac20dbe98d488e5a53f9e3d4cc9e67a30a9ebc4bc788f3e91cdd5f52e7`
- `apps/mobile/src/lib/launch/phase8.ts`: `9630757897d5d2f3252b740aa01f14de7444bf628ea3929f7f782ee746a6dfeb`
- `apps/mobile/src/lib/growth/attribution.ts`: `3aaf6cf26bcc185e56c4bd4a7561cda83c4c8e73fdbcb504aa45130ff503d739`
- `apps/mobile/src/features/growth/shareLinks.ts`: `0173ed4e39393e7c16a597b305f15c02b471f70041574ca785d161137a4b7e4d`
- `apps/mobile/src/app/s/[shareId].tsx`: `8222eedaebb699c04647f83bd6ccbfcc4029d73cd1b4521c5058d4693d8f3829`
- `apps/mobile/src/features/growth/shareCard.ts`: `3403a83b3b56049494762cab41bbe30a1cedf8aba8499b6212b347c643ce64ed`
- `apps/mobile/src/app/share/conflict/[ruleId].tsx`: `15f7d8d5381f66ab27af31a650bc6a843c902fb1f2027d13db59ff5f9fe5002f`
- `apps/mobile/src/features/review/policy.ts`: `cd8ccb30d06e9ef1e44f45693609dfecea5860582695cb18e5f6ac8e1a458d05`
- `apps/mobile/src/features/review/prompt.ts`: `e83faae1cec35009174c378bfe44b486e41ace7949373fff914c4d64dd2dcd2e`
- `apps/mobile/src/lib/legal/storeMetadata.ts`: `071bd7fb89b37b3294ef716a49798f20724e762498bf80795f7d7cab7e4ced13`
- `docs/phase-8/source-of-truth.md`: `5d8dafa07759bbddccc928bb47ca6eeb262bc0e46f08e9e84c3344d6406b85d1`
- `docs/phase-8/link-routing-runbook.md`: `43b789dd31a1dc3bbef6cc351935fbfcd8c852678c5954429ff71bf469b91e90`
- `docs/phase-8/store-compliance-packet.md`: `846963335b3c4c91ae1491cb33a7f1a8bcb0e91f27f20cb79882d855c7cf1a5e`
- `docs/phase-8/creator-brief.md`: `c32d7bfe42e7e40ce91a2ae3bee89dda06f89f50c4922fdae3be1d776712a210`
- `docs/phase-8/acquisition-dashboard.md`: `444868fad465a28a1732161b2a3d3c177854f9589e48ac137f7c3658452b2877`
- `docs/phase-8/launch-dry-run-checklist.md`: `3d357c7e4a8d4adc1d018da0d646d81944b7c30d0f2c357eac4264e14f76b798`
- `supabase/migrations/20260616000028_phase8_growth.sql`: `629bcda19f7f227679b8202a6d0234392dba62d4cf602023d0c2b976c576f14e`
- `supabase/functions/growth-event/index.ts`: `07df0cef3aa0cdb5251eb0f0e7a4d92fe490964f743463b35ef50a54cfc38410`
- `supabase/functions/waitlist/index.ts`: `6ddee0c190a91f55239615c2a1b6e366061bfbbd30cbd8b3dc9ae5138fdf8e70`
