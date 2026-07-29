# Generated Phase 7 Core Loop QA Packet

Generated at: 2026-07-29T19:00:22.849Z
Git SHA: 066fec8429c3ffa188719398d9eb6203763db83e
Git status: clean

Strict completion requires real brand/legal clearance, Supabase RLS evidence, clinical review, catalog import evidence, device QA, RevenueCat QA, privacy/export/delete QA, analytics dashboard readiness, and a named owner.

## Governed Evidence Chain

- Status: blocked
- Source S: `BLOCKED`
- Evidence E: `BLOCKED`
- Current R/F HEAD: `066fec8429c3ffa188719398d9eb6203763db83e`
- Selected RC: `BLOCKED`
- Ledger path: `BLOCKED`
- Ledger SHA-256: `BLOCKED`
- Ledger entries: 0
- Audited generated descendants: 0
- Packet code bound to S: BLOCKED

## Upstream Packet Contracts

- Human-E2E manifest: blocked
- Phase 5 device QA: blocked
- Phase 5 recorded head: `86f092e4d90760f1d1bb4f34860346549b7bcfa5`

## Evidence

- Brand ready: BLOCKED
- Supabase RLS pass: BLOCKED
- Clinical review pass: BLOCKED
- Catalog beta import pass: BLOCKED
- Device QA pass: BLOCKED
- RevenueCat QA pass: BLOCKED
- Privacy/export/delete pass: BLOCKED
- Beta dashboard ready: BLOCKED
- Signed off by: BLOCKED

## Scenario Evidence

- Onboarding (PHASE7_ONBOARDING_CONSENT_QA_PASS): BLOCKED
- Shelf intake (PHASE7_SHELF_INTAKE_QA_PASS): BLOCKED
- Reviewed guidance (PHASE7_REVIEWED_GUIDANCE_QA_PASS): BLOCKED
- Routine builder (PHASE7_ROUTINE_BUILDER_QA_PASS): BLOCKED
- Today check-off (PHASE7_TODAY_CHECKOFF_QA_PASS): BLOCKED
- Photos (PHASE7_PHOTOS_PRIVACY_QA_PASS): BLOCKED
- Reminders (PHASE7_REMINDERS_QA_PASS): BLOCKED
- Payments (PHASE7_PAYMENTS_LIFECYCLE_QA_PASS): BLOCKED
- Privacy controls (PHASE7_PRIVACY_CONTROLS_QA_PASS): BLOCKED
- Share card (PHASE7_SHARE_CARD_QA_PASS): BLOCKED
- Deferred surfaces (PHASE7_DEFERRED_SURFACES_QA_PASS): BLOCKED
- Analytics (PHASE7_ANALYTICS_QA_PASS): BLOCKED

## Scenarios

| Surface | Required scenario set | Evidence flag | Status |
| --- | --- | --- | --- |
| Onboarding | final age/account/consent copy, policy links, and consent ledger verified | `PHASE7_ONBOARDING_CONSENT_QA_PASS` | BLOCKED |
| Shelf intake | add owned products via manual/search/scan-or-OCR with source/confidence visible; exact-date intake rejects impossible/future dates; label PAO requires explicit open-jar confirmation; surfaced expiry provenance matches the winning date; reload preserves the lifecycle; re-add archives the prior unit, retains product/PAO provenance, and drops its package-specific date evidence; replenishment alerts remain off until explicit opt-in | `PHASE7_SHELF_INTAKE_QA_PASS` | BLOCKED |
| Reviewed guidance | reviewed conflict shows evidence and sequence guidance; unreviewed conflict stays hidden | `PHASE7_REVIEWED_GUIDANCE_QA_PASS` | BLOCKED |
| Routine builder | AM/PM routine persists across restart, offline, timezone rollover | `PHASE7_ROUTINE_BUILDER_QA_PASS` | BLOCKED |
| Today check-off | offline/online check-off is idempotent and append-only | `PHASE7_TODAY_CHECKOFF_QA_PASS` | BLOCKED |
| Photos | baseline capture renders locally; app lock gates timeline; settings and Progress show device-only storage with no backup control or automatic upload | `PHASE7_PHOTOS_PRIVACY_QA_PASS` | BLOCKED |
| Reminders | permission, quiet hours, Android 13+ permission, timezone/DST behavior verified | `PHASE7_REMINDERS_QA_PASS` | BLOCKED |
| Payments | RevenueCat purchase, restore, cancellation, expiration, refund, and webhook lifecycle verified | `PHASE7_PAYMENTS_LIFECYCLE_QA_PASS` | BLOCKED |
| Privacy controls | export, account deletion, health-data withdrawal, app lock, support links verified | `PHASE7_PRIVACY_CONTROLS_QA_PASS` | BLOCKED |
| Share card | literal zero share and public-link admission: no capture, file, network, token, native share, record-implying landing state, raw/private projection, or analytics side effect | `PHASE7_SHARE_CARD_QA_PASS` | BLOCKED |
| Deferred surfaces | commerce/community posting/trend/cloud Ask/widgets/share hidden unless gates enabled | `PHASE7_DEFERRED_SURFACES_QA_PASS` | BLOCKED |
| Analytics | activation, retention, payment, privacy, support, and deferred-surface events visible | `PHASE7_ANALYTICS_QA_PASS` | BLOCKED |

## Files

| Path | Status | Bytes | SHA-256 |
| --- | --- | --- | --- |
| package.json | present | 42839 | a7784a3b2521e128f0c06e854b7b662ddb00be06ce59e13f667a653ddb1a8270 |
| docs/hugeToDo/launch-contract.json | present | 5899 | 7256e35fbe476ea0217c5443ecc84b84cc8a6ea3246f0279e7fe170b95b9d1ea |
| docs/hugeToDo/CORE-06-RECOMMENDATION-ADMISSION-SOURCE-CHECKPOINT-2026-07-26.md | present | 35333 | c852d2a97f979b23680069241b667ad2e15d7a7f298d364281955db8599888a2 |
| docs/hugeToDo/CORE-07-SHARE-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md | present | 9943 | 36231f4132e2a6192048b7f48afad9d1cd2ccc013d4453c55912a628997fa9ab |
| docs/09-personalized-recommendations.md | present | 46631 | 7d4544112256b1b026116a42357069ec3e4002c5bde7ef1b6612b82784fcd0f4 |
| scripts/launch/contract.mjs | present | 12227 | 72fe270bb72f4be815c6b3d1bce1be95b3f961dc9de29df9937acaa58e84878f |
| scripts/core02/clinical-rule-source-contract.test.mjs | present | 35923 | 9ce053ef5dfd88e963583f494ad3232cf1623d0c559d854795b319faa14a65ed |
| scripts/core06/recommendation-admission-source-contract.test.mjs | present | 32016 | c845f060a7a18f514eacfb5476ce0f5aa8696dc76692cf2a2feb45332b91e3c7 |
| scripts/core07/share-admission-source-contract.mjs | present | 34840 | ffbe2846213eb33235b0dad2f3fde61685cff6db92db0d887fed5071392cfd9d |
| scripts/core07/share-admission-source-contract.test.mjs | present | 11145 | 8990c02aae82ed1271bc5e010373609a482ac40f1b565cfa60c70d3c9d9eb8a3 |
| scripts/phase9/recommendation-zero-admission-smoke.mjs | present | 7831 | eb9e8caad7b98399af9ad7001b08e9a27eea01e614c8dd04a562eb63f6465865 |
| apps/mobile/src/lib/env.ts | present | 6982 | 22ebe3a408c87b87be7da9e4a2282feba8620d88405b43216eb961966bfb5b31 |
| apps/mobile/src/lib/env.test.ts | present | 8126 | d799ad8c62a0fdff865f5d29299061eb1927e7d5e1c30e177683bed18791ebc9 |
| apps/mobile/src/lib/launch/phase7.ts | present | 5153 | 693b552de439ef21d68a78cef57c94d3cbe20aa60fc2e2ee15fbbcb20ec2e7c3 |
| apps/mobile/src/lib/launch/phase7.test.ts | present | 7770 | 5705ef52663469a5dc8d31d84e8059047f97b4b062f9d096c34cc94f0258e166 |
| apps/mobile/src/lib/launch/phase8.ts | present | 2237 | dedaffd1350a4f8288dfb029fad187b00f6899de3f7e05bdbe09d123058564e7 |
| apps/mobile/src/lib/launch/phase8.test.ts | present | 2313 | 7def95ec2a6b678d70e535babaf2c34d241ec112239fef4a4aac526d03c1977b |
| apps/mobile/src/components/launch/DeferredSurface.tsx | present | 2320 | 6ff85a7cc8ac36e0566673132a0abef71e0e65e99af158c3439b61c9bb4b98b2 |
| apps/mobile/src/components/launch/DeferredSurface.test.ts | present | 1224 | 28c8db73d114e25fb69fa533df1020bcfbf91df1e31036b12ee91040ff24c60d |
| apps/mobile/src/lib/navigation/safeBack.ts | present | 1487 | a2e3143f42c223bb14acb27e97182a8582dc85342f44a8960c0c4adf4795ec12 |
| apps/mobile/src/lib/navigation/safeBack.test.ts | present | 3715 | 126a5f0b64f09192e20052bfa87f2f327ffab2831b3cc9a287882023ae7cd203 |
| apps/mobile/src/app/(tabs)/today.tsx | present | 38886 | c07f10efec2a63a5c6eeb8cefc7e040276cae42fcfef1f18a1646dc3d93074d1 |
| apps/mobile/src/app/(tabs)/progress.tsx | present | 20519 | d009aa555a3230ad67a41dfdc2cbeb184b9684757b97085346fe5362e57c7125 |
| apps/mobile/src/app/(tabs)/shelf.tsx | present | 21848 | aaf21f3b9567103e0c35b2fdeec4f535f164b592942e76b091e25ba19ab0fb43 |
| apps/mobile/src/app/(tabs)/you.tsx | present | 40092 | 4c46f34715c5baa915c7bdb3521a1e366ff9bba9bcd4ffff05dd61d7ad0b0bc8 |
| apps/mobile/src/app/_layout.tsx | present | 4046 | d2d7bae5a6eb88250d21a81cf09ec2ac2523673b429e7df4fcb4ba45539a08f6 |
| apps/mobile/src/app/cycle/settings.tsx | present | 27311 | e743de466e9c1a3c0a33f63ff34bb99c3c9507b698e8564a76a2dc2b60089450 |
| apps/mobile/src/app/cycle/week.tsx | present | 15186 | b2c90d552f0c186bad5cbcd385e60cba289ca5b6242f6f9d0b991f631af200ba |
| apps/mobile/src/app/cycle/why-tonight.tsx | present | 9120 | 7e85c05e2157e53dbb88db012045056133b2f6a0b32dc47f797e6891a95559f3 |
| apps/mobile/src/app/onboarding/products.tsx | present | 15830 | d4dc65741eeee9852dda1c99c8b7ab18d47a58ff5783619c57008a450f69b94b |
| apps/mobile/src/app/routine/plan.tsx | present | 19735 | a7a4e3c5dc34b3dd0811faefb6f67a1a6809a0e6396b16521d46497c334c9bfc |
| apps/mobile/src/app/share/conflict/[ruleId].tsx | present | 539 | a996efa45ca90843bb78b4f07e188d27f5e41bb37d146c7379e0a1c3881cc473 |
| apps/mobile/src/app/s/[shareId].tsx | present | 1198 | 1703e9e18281966cf0c6cf0d8d37524c80bfdc094da073eb04f8618da50af0f2 |
| apps/mobile/src/app/trend/_layout.tsx | present | 1091 | 84e2ebdcabfebf7ae274c6742f44841410376ff6dc62888561ffa52b4fe7b9ed |
| apps/mobile/src/app/trend/fairness.tsx | present | 4963 | 7e4654db068f93519165002135b21efc3c275c097d970a4960890657662fc8e0 |
| apps/mobile/src/app/trend/optin.tsx | present | 526 | 59e11ac2d24b435b45b77a07030733ec5bfc93bddeac993f23d915a02a6058b5 |
| apps/mobile/src/app/conflict/[ruleId].tsx | present | 25335 | 18f00fd1e5f161dfda3cda01f952a5bc620e88598c7ed13ffdfa67c9d9587f4e |
| apps/mobile/src/app/recommendations/[id].tsx | present | 9516 | 3e486837968cfecd86544a9e5a78a658854e26a541b4d7c04ed8c0460467326e |
| apps/mobile/src/app/recommendations/index.tsx | present | 16524 | 44c0ddd92b98b8d98d51b204914f42a3238fcabdad4dbede9c836e6bab3e32b4 |
| apps/mobile/src/app/recommendations/preferences.tsx | present | 14355 | d032c3c7198f8bf4c85406796a5e5cc2c38c05c33c440e2084d15f30c1e07a38 |
| apps/mobile/src/app/shelf/[id].tsx | present | 45428 | 1b2fddb06a6809c09987635c672c9a43026226805481c5438df09950c8d6cc3d |
| apps/mobile/src/app/shelf/_layout.tsx | present | 963 | 5223360e4b730ffc7fd37d356211a5aab42cae6aba388474ea1af61999d8203c |
| apps/mobile/src/app/shelf/add.tsx | present | 337 | 69027d3b5ac294d2632ceba04a4f075dfdfe624566466415059e5e74f37c0aa7 |
| apps/mobile/src/app/shelf/archive.tsx | present | 4165 | 6f17ea9614579d1f50e8b17bdf0b9dbfac6caac699821302710903f745d3854d |
| apps/mobile/src/app/shelf/manual.tsx | present | 17625 | 7b5be927575a0fcc5febeafe03511c1bda402e591644707ffb167807bccb3190 |
| apps/mobile/src/app/shelf/no-match.tsx | present | 13431 | 7fdbdebaf549170305f6e959548446c1cc1a0d483c1b32408f8683a820d4c353 |
| apps/mobile/src/app/shelf/ocr.tsx | present | 47515 | 8081c8eec75eb8a0781c66a1f2e5f093ad6f54c067e261a155bf33412f2b61a2 |
| apps/mobile/src/app/shelf/opened.tsx | present | 18279 | f6def4491f22caae90590351f50f424c38397a8d6c8b6d2c3f77d7d8c0346f6d |
| apps/mobile/src/app/shelf/replenish.tsx | present | 13236 | e1511ab6367bf8b7d0242ce87cdb9c459d32f66e18f81927e1aeb932fcf2e5b0 |
| apps/mobile/src/app/shelf/scan.tsx | present | 33677 | f90b455d7f735e6ece27a07e6367e4a2e032da4d03cae497739d52c3a4bde733 |
| apps/mobile/src/app/shelf/search.tsx | present | 24504 | 193518934f1168ed86ddc90f530af12065b8c00e4c394722ce61a8181901f087 |
| apps/mobile/src/features/ask/answer.ts | present | 15567 | cc9a7a0bd0e44a3cca4709479aee9513f424059917fd07335e26bb36371ce786 |
| apps/mobile/src/features/ask/answer.test.ts | present | 11922 | 4d6a33acbd626f7a3a61b02e62af29c85d59ace6fc01f63a74bd27608ffb1dbf |
| apps/mobile/src/features/ask/claimsafety.test.ts | present | 7841 | 05cd47f500866b175719b0c16e5a0106c84ed0581d49a372e5d6daaadb3e650c |
| apps/mobile/src/features/ask/copy.ts | present | 7508 | c0fa11f9fcb1c0175e13a3368e1000f7dd6f2b80e2d486124649b55878358f35 |
| apps/mobile/src/features/ask/useAsk.ts | present | 5560 | 9f03da10e33b546052d7c0bea39b8f72cba70c28465f17eeca5bed79930b6727 |
| apps/mobile/src/features/catalog/client.ts | present | 23827 | a134e2bb32ea3fde57ef7dbcbe987ef15a5010a440ec38700731a2ea339e9a0e |
| apps/mobile/src/features/catalog/client.test.ts | present | 31695 | 42dc1c9e4d29c565827535836cf635c37bc19399f663859695a1546df518d297 |
| apps/mobile/src/features/growth/shareAdmission.ts | present | 2280 | 02adedb821a476eeba4fd2bc06681feeba2008fa1c97ffd4937a39a569dc6327 |
| apps/mobile/src/features/growth/shareAdmission.test.ts | present | 1775 | b91ac95fd984223a78d8cf7e90aafbecc93ca37b3720c998a2c74f9f50728db7 |
| apps/mobile/src/features/growth/publicLinkAdmission.ts | present | 1278 | 2010dbd8de265052387c6d8930df10fc77f152aa3da1529622ed47b1adfc1ab0 |
| apps/mobile/src/features/growth/publicLinkAdmission.test.ts | present | 1401 | 01dffc5dbcba810134a1f7939ff0212ef79fee924349008bde69a8ee43d05c23 |
| apps/mobile/src/features/growth/shareProjection.ts | present | 3922 | 181032634536521b98caee66fabda609be3e3832f238bf1c73b4f42fca08ab6b |
| apps/mobile/src/features/growth/shareProjection.test.ts | present | 3366 | 1bc71c2592968386a9d620c63fd33672c7fc78cf4f209b7344f0e1c83ffd03d4 |
| apps/mobile/src/features/growth/ConflictCard.tsx | present | 4280 | c507a02987606253932950df0066322a724edfccdc08286640882d0b660af981 |
| apps/mobile/src/features/growth/shareCard.ts | present | 405 | a7059162afa68ee7cdd765a117d5c8edee387eaf5a8d7d85c78ff23ee0faafac |
| apps/mobile/src/features/growth/shareCard.test.ts | present | 1667 | fcecf1cd61bf89aa3693ac9bd3e1dde3432de81926f4d52598209ce36ded0e7b |
| apps/mobile/src/features/growth/shareLinks.ts | present | 318 | 36af63e30c40653b8940d7f8dbf89e7e6b451c3286b522181f77ff1f9a1127f7 |
| apps/mobile/src/features/growth/shareLinks.test.ts | present | 1434 | a995256a1740d32d2608a0bfab05d053a80ec07407dbe86090690808bb92c706 |
| apps/mobile/src/features/growth/shareLandingRoute.test.ts | present | 1958 | f4a329de6c143ef8b1ea376bf5f778e13861d28880a6462f6f1f03183632b8f0 |
| apps/mobile/src/features/growth/cardCopy.ts | present | 1017 | e9f3d09dfa1ba628dd883088e2b67976eaa2164c3a509e5808f54435ef991776 |
| apps/mobile/src/features/growth/cardCopy.test.ts | present | 2319 | c288a67751c6a181f80c8a93933f2aee36fd7d286d0f7f3faee72e42716d45c9 |
| apps/mobile/src/features/commerce/WhereToBuy.tsx | present | 9445 | 42147c464f5bfdd3c6b206c9e2814c387b784f7decc25e98b93d926451bcb1ca |
| apps/mobile/src/features/commerce/commerceRoutes.test.ts | present | 8621 | c39cb98b09a609e825dc3e463ee125e968ddd7e98f7d1af19ff32ed1ac1a2cfb |
| apps/mobile/src/features/intelligence/pao.ts | present | 5160 | 32209515587ba1136c72abcd9703f25ef46c0aa6a289bff5fac685a08a0eafde |
| apps/mobile/src/features/intelligence/pao.test.ts | present | 3875 | d4ff777e1b13717b1fd7b6d01a695070e34f065a311b1f98e04d3b0bb737a385 |
| apps/mobile/src/features/intelligence/conflictIdentity.ts | present | 878 | 06b94824e2a2b164d3b40f38e3106252cf0f796a34292d8dcbbdeba7d0c20ecf |
| apps/mobile/src/features/intelligence/conflictRoutes.test.ts | present | 15285 | 5afea2b23b272edfca8978c717523530ea5d2729a29367876899a53171bd949e |
| apps/mobile/src/features/notifications/BehaviouralTriggers.tsx | present | 3485 | a1d607269e8beef3e56d0694fd80fb7f9f6f77b42278d7e7f5dc8cb1db4a5ffd |
| apps/mobile/src/features/notifications/claimsafety.test.ts | present | 4506 | a60c1534edb7ac76c00faf543e833d5df5671685373e8475db80aa23a4d8ab5a |
| apps/mobile/src/features/notifications/copy.ts | present | 5148 | 02aeba0b0c5edc670c169e4732aa94ba4960ba153c087ffdc9d617561955af38 |
| apps/mobile/src/features/notifications/store.ts | present | 9907 | 16ecbc9ac6e9e4b7fc6e52ddc6f0ee6fca8719f6ad18f888800f5ea387277c38 |
| apps/mobile/src/features/notifications/store.test.ts | present | 7928 | ae99c70b099cfdad28cdb9a882d9ee06fc7ecbe524397a50c5a1d672d057cf47 |
| apps/mobile/src/features/notifications/replenishmentOptInMigration.test.ts | present | 718 | 2b34153c9a4a85b29bbf8483217a65e4ee99b15837a50128bc7cf572c09fb4a0 |
| apps/mobile/src/features/onboarding/serverSkinProfile.ts | present | 9985 | dd8c759f21a9c494689f2f2560587e7d6f518ffe48e8cc68178139b3d3fd55b2 |
| apps/mobile/src/features/onboarding/serverSkinProfile.test.ts | present | 5885 | 484831986ac1278169488f2348fe604093c973226f418af67906578ea2553d04 |
| apps/mobile/src/features/recommendations/admission.ts | present | 3362 | 699de9485fa5fed2335fb4b91dbd9f263ae7cd081048c30bb6b4d6fc17bb7934 |
| apps/mobile/src/features/recommendations/admission.test.ts | present | 3673 | 41f457e23372c20b95d5bfe723a4077bebfefbf833aaa4cf786e73505a51cf70 |
| apps/mobile/src/features/recommendations/RecommendationsTeaser.tsx | present | 8769 | 9a255293b62127479d28415260afe39f1730cf408f25fcef38c55610d1e327ff |
| apps/mobile/src/features/recommendations/RecommendationsTeaser.test.ts | present | 4098 | b5e0476fc56282475ab005d50a49e3e65104a1e9d413389d81cf957976eea03a |
| apps/mobile/src/features/recommendations/claimsafety.test.ts | present | 11303 | 778a3f8cf6a166b5684ac5b862403e1349259d30ca8c7f540626b94fdd0bbcda |
| apps/mobile/src/features/recommendations/catalog.ts | present | 9187 | c51facef1b8d53e2c916de28b08910147b6afe2d1de3ba36f587ad9cc1f64ffa |
| apps/mobile/src/features/recommendations/copy.ts | present | 11161 | 4e652b871697dbe4856f2c931da5faa7b85dcbcca84e2cad7d70b4b4a3880f72 |
| apps/mobile/src/features/recommendations/engine.ts | present | 24385 | 09d3eb6119b68909c9d34d23ddacf6c2ee9d79e0d35ecf277353c68d8b8224c3 |
| apps/mobile/src/features/recommendations/engine.test.ts | present | 31682 | 0dafb11a6aebd0a713417db7839385905ab059a2a06c56c4f691fdf13e50205c |
| apps/mobile/src/features/recommendations/fit.ts | present | 5853 | 5c26217852fd5a54a2ca1fa5bc60eba3943611a1f84a7a26a8050a6331383f7e |
| apps/mobile/src/features/recommendations/fit.test.ts | present | 5242 | be28f0c73964323a77cdbfedc171ec895f8828765a7a7077896f07ce729c3a0a |
| apps/mobile/src/features/recommendations/fragrance.ts | present | 912 | da21d1a0df285d242c9aef9fe4c05e329d44f3fb1047a2c4a075d4585d2c1644 |
| apps/mobile/src/features/recommendations/goalAdmission.ts | present | 2693 | 70b629422f47106ad926b24f343103c3e782383f7a447909e314941a4a41df19 |
| apps/mobile/src/features/recommendations/goalAdmission.test.ts | present | 2749 | 9342f3791b75441c2522f505832a3e7eb371de999ef15d8f166277acde9337aa |
| apps/mobile/src/features/recommendations/goalProvenance.ts | present | 4465 | 05dc69ab16053b740179fad604b101afc486dfcc16a90fa76586ac8f59f8e50d |
| apps/mobile/src/features/recommendations/loading.ts | present | 707 | 3708883b8d09582f3620cc933e2412ef2c6054d0fe5d9f5ca15d9145067c5c55 |
| apps/mobile/src/features/recommendations/preferences.ts | present | 917 | 20f23f9dd2a185d093a204b9977ef771a0f4e562bb588b0398290a0eeb1bf898 |
| apps/mobile/src/features/recommendations/recommendationRoutes.test.ts | present | 16214 | 613046a86d8d81bd131362697574f18dc7f7ed2d44ce3041076e358ad93eec62 |
| apps/mobile/src/features/recommendations/replenishment.ts | present | 3829 | ad0658a4a88071c1991c13c1d8d797d6250cdf5fa70fc33f2613cef380b4e610 |
| apps/mobile/src/features/recommendations/replenishment.test.ts | present | 6345 | 0809c65bdf7982d97624373387e58350342ec65cd5681a145968fa7deb864608 |
| apps/mobile/src/features/recommendations/store.ts | present | 7353 | b24499fe9b122b13b390248fd9988d5521991a47f26b8e24eca1b2dfab923a83 |
| apps/mobile/src/features/recommendations/store.test.ts | present | 8331 | 8a22ba398c5d5204162dbb98b4ef7f97dd82817f13e21d154dcc50fe0eee6444 |
| apps/mobile/src/features/recommendations/useRecommendations.ts | present | 3878 | c86b5797892557f0197bc812cac9bf1ebe5eab79956590be5e64955b3331f733 |
| apps/mobile/src/features/recommendations/useRecommendations.test.ts | present | 2802 | facda1c30fe00fe4cf5e7bf7a98c3435481835857c4774a3e9316af501f343bc |
| apps/mobile/src/features/routine/activationAnalytics.ts | present | 5528 | a79affb1332e22f7d9f4a6acbaa24066bbc4d0443de3ac40f72614e9ef4f78c4 |
| apps/mobile/src/features/routine/activationAnalytics.test.ts | present | 6851 | ce2b53262a21163ff27df5a6823b902f4de85fa396e2535e32331dfd2d4d9889 |
| apps/mobile/src/features/scheduler/cadence.ts | present | 2891 | 0c46957a5a49577fdb6808cea95802834a8b5c5f2df50600d4ce93c00a0f8f6d |
| apps/mobile/src/features/scheduler/customCycle.ts | present | 13146 | 3e6fc08ddf8813933f5e07216fc04c411d7683a44f3761b33b82132f95ee9cda |
| apps/mobile/src/features/scheduler/customCycle.test.ts | present | 9291 | 9cec61bc36016b5c2acc6afeaff48b37cae861271141203520574ea3399f8e14 |
| apps/mobile/src/features/scheduler/cycleStore.ts | present | 21910 | 9a32efad1c33138c1cc31ba8f21aca5f9a748a1ce767ac317ce311ca6cf0e964 |
| apps/mobile/src/features/scheduler/cycleStore.test.ts | present | 26038 | 50683374e860600be6d785014002a1c3e75c4c163f6cbfb0f74da31063f23340 |
| apps/mobile/src/features/scheduler/cycleWeekRoute.test.ts | present | 21836 | 19b56bbd139d44d5ea04ebc37d33c132b6f212156ce071e0d302ae0d39ee9ab0 |
| apps/mobile/src/features/scheduler/orchestrate.ts | present | 13381 | 9232e7a8b8f8a92de9e871dcf806ada0776a96eb527289c5c1476ec2452286a8 |
| apps/mobile/src/features/scheduler/orchestrate.test.ts | present | 19682 | 613be5b855e6a975da9e39002c74e1069bae65ac906d7a2f351807e08ad3048a |
| apps/mobile/src/features/scheduler/profile.ts | present | 6605 | a29854d4894bd7920c0b050bcfe61ea066563cdf9df188ea717d7efb9a70cad2 |
| apps/mobile/src/features/scheduler/profile.test.ts | present | 10906 | ca69bfb059f6d8d608574c05c49b88097afa69895bc6963c4823e766a1549985 |
| apps/mobile/src/features/scheduler/useCycle.ts | present | 12284 | 5206dc3e8cd31cea4b8933daa4d6ca1f5c2efa7808c2322c6d70705cd72c9fd9 |
| apps/mobile/src/features/shelf/freshness.ts | present | 7299 | be0997619e57b575d84169f1c47bbf00bbb61e811a393ce04eff586b5b14b77e |
| apps/mobile/src/features/shelf/freshness.test.ts | present | 8353 | a7ec4652c8a3cff995038511eec95f31e3d0045cf99d4597f78c58daee44364e |
| apps/mobile/src/features/shelf/freshnessMigration.test.ts | present | 4858 | 03808fae36a3a74134bcda3d5db0e729729dcde2653b0331a7d481a5a71f9689 |
| apps/mobile/src/features/shelf/paoProvenance.ts | present | 508 | dd71e9b3f563903e532cd76f5643ce04cc280f6cbe79cc7837ad2861fdacb7b3 |
| apps/mobile/src/features/shelf/paoProvenance.test.ts | present | 1305 | 036d37d4a9e008be0b89e5c63d9091704f439d23111ca377513a5f4a6bebc555 |
| apps/mobile/src/features/shelf/shelfRoutes.test.ts | present | 69745 | 9f2bff3241c5948522fa56e0d4e8857c24cd46b38d3e9b9868dd5416d24f1f68 |
| apps/mobile/src/features/shelf/store.ts | present | 58796 | 218dd66ae24c4e301b476fe878ddcfc614e9acb435045a1571375ee399893d15 |
| apps/mobile/src/features/shelf/store.test.ts | present | 57329 | c000ac66f164e1a2118cd5fe153f32a8c6565388534319825bfb0728cec29e02 |
| apps/mobile/src/features/today/completionsStore.ts | present | 36561 | f6b92329805ead6df4e8340f1a7734b2a2b1e7cdd695ab2be148fe256283ff34 |
| apps/mobile/src/features/today/completionsStore.test.ts | present | 31515 | a51b1cacf3ea5d610ed026e9fb9d3b6a76074dce799c6964be3fd097875fc308 |
| apps/mobile/src/features/today/cycleCompletion.ts | present | 622 | c3c632e9bf71f42f85fa140de50b03e3b47afe2d0c00a70977579879f81f5317 |
| apps/mobile/src/features/today/cycleCompletion.test.ts | present | 2516 | 437d3282afaac2a6c106fc3e056b410dab2fb6d34c3363bc99de829e615b3462 |
| apps/mobile/src/features/today/routineProjection.ts | present | 7275 | 6fd3051255557caeaa3e92bb4c3ca29713c3dc2c620aad7fc4beaf17b0d998c0 |
| apps/mobile/src/features/today/routineProjection.test.ts | present | 7637 | c89b88c5a960fc77fec7508528b5d0f10699600a17bc917a7b4371f0d1f761ed |
| apps/mobile/src/features/today/todayRoute.test.ts | present | 12470 | a9f3974eecfdf656bb1b3024bcc9950bd3c3511934045d8a7e04cc3e0ea65a20 |
| apps/mobile/src/features/trend/copy.ts | present | 5381 | 804c809a7f3acdebf3293fdb738d18524e6e3aa8095e78c0f00de0cf8cfc9318 |
| apps/mobile/src/features/trend/fairnessPrivacyGate.test.ts | present | 3425 | d4b9128f7a7309f2117d3df3ef5016950bf4cd9a58ce2a253dc3517288fda6e1 |
| apps/mobile/src/features/trend/trendRoutes.test.ts | present | 3695 | 3f4c93276730c9725fe274b70587c539316f924f03ef6b328aaa7dff2739bab7 |
| apps/mobile/src/features/trend/useTrend.ts | present | 4370 | fcd3bd8d434f15a63638e7852260f23a65309f997bd1daa45c57483dd041396e |
| apps/mobile/src/lib/consent/healthDataWriteAdmissionContracts.test.ts | present | 11578 | b4f0a759ae2d8f14b48f01f3700eec8ad9dcd92a2adcfd937e4bbdb84e2af270 |
| apps/mobile/src/lib/consent/healthProcessingEpoch.ts | present | 19927 | 1b0af9d43eae6b98e7ffa633457910cef695c778f3f428d9b5a6b7b8c3b6407d |
| apps/mobile/src/lib/legal/phase3LaunchGates.test.ts | present | 2096 | 8a142e0fa997dd409c06d449f4749b88940db50b02ed10f4369d5a6bc52c3229 |
| packages/types/src/database.types.ts | present | 58832 | 33e67e9c9cb829624bed72693dfe2b4706838483a547b1d3d359384bef8bd434 |
| supabase/functions/catalog-lookup/index.ts | present | 11843 | 23e76d1ba0fd1e199be94986fb0e066e7e4cc6b64d04c642bdd1fb849c97b220 |
| supabase/functions/catalog-lookup/catalogContract.ts | present | 80 | 9707c48c48465b279c2112d84a8a1459867c395490d3c184aaa4e6c2fbc7f81a |
| supabase/functions/catalog-lookup/catalogContract.test.ts | present | 14681 | 96ab5dd088984ce67115b993e84436205ebb1bfabee25ea2d60558e7eea85f46 |
| supabase/functions/catalog-search/index.ts | present | 10142 | b7187fee6fe8981d42219de31d1358d11db16bb8f40be530c4d2f838e5400494 |
| supabase/functions/catalog-search/catalogContract.ts | present | 1343 | 62cc1e0d2e62d37187922e4ed1766b12d8ca8aa48cdebf3e3271ea6ae7ce417e |
| supabase/functions/catalog-search/catalogContract.test.ts | present | 3041 | dd91fb0c009da68074d795d7819149d9bb970e47c2fba6bbdfc7a08f7f53922d |
| supabase/migrations/20260711000038_shelf_freshness_invariants.sql | present | 1973 | 672df1e56fac4cdfc6bf641c3249221aaacf630439d28898a79ace2d25181bcd |
| supabase/migrations/20260711000039_replenishment_alert_opt_in.sql | present | 372 | eac60d4bf92f465ad2264c509f8e0a2f412b5780f862cf602b8ff16e1e2e1299 |
| supabase/migrations/20260718000060_cat07_truthful_freshness.sql | present | 24465 | 8bc2c35bfff443a3c3bf7ab76e52ed17e7d6b961a8b35bdde17701de5c7f574a |
| supabase/migrations/20260722000061_catalog_import_benzoyl_review_override.sql | present | 28316 | 4048342265ef103e6915411494911a98485528707c7413555725ba4ff427c1e9 |
| supabase/migrations/20260722000062_catalog_curation_statement_guard.sql | present | 53193 | f7bba7300939fd1f95247c464c49cc01544684637ff25d66076f137475ef9ef1 |
| supabase/migrations/20260726000071_recommendation_zero_admission.sql | present | 14874 | 4e3e0c46a246b97e98f014bf65499ea86b7f57119744466aebc8c1491331acc9 |
| supabase/tests/database/catalog_import_lifecycle.test.sql | present | 109814 | d543af34e2559d938a12ba4741181f170e3c04fa678c93c411f911118ef2a899 |
| supabase/tests/database/catalog_launch_curation.test.sql | present | 202040 | 2792fc6c16e7ce655d60a6edb229cf24bb0b61ec662b161ec8b55ac39eddb376 |
| supabase/tests/database/catalog_serving_gate.test.sql | present | 36707 | 1e9e54227161be38e27e2263aab27ec16aeb2ef4ead2316f0dc9daafd12879d9 |
| supabase/tests/database/cat07_truthful_freshness.test.sql | present | 36171 | d95b9ec59b13f8ab09fcf3e71a052c17c2b3a669e8c93acaf01c793ffd073d24 |
| supabase/tests/database/recommendation_zero_admission.test.sql | present | 17931 | 29f904aac21064dd5f5c2e8f3c7fa2a81417d3ffde26f5134f58e8b145b224b5 |
| supabase/tests/upgrade/recommendation_zero_admission_0071_upgrade.test.sql | present | 7912 | 011e2ffc2994475df1ece65e1503dd363c4d42206a4509d46195a01d4f324c77 |
| scripts/phase7/build-core-loop-qa-packet.mjs | present | 49237 | bf4349ebdc049d5bb87e6c54e509d13f1c676f3155af4963ba81864480c46060 |
| scripts/phase7/check-core-loop.mjs | present | 31071 | f6470c7627d0f583404433f629c63ce6456c9eff4a2877f15b8cc66efd36fe56 |
| scripts/phase7/check-core-loop-smoke.mjs | present | 35175 | 06504cfde48c52c8a81e095505568e4edd2fe897cb0798d90a6f788e80f53e1b |
| scripts/phase7/core-loop-qa-packet-contract.mjs | present | 1474 | 3cf50c30778d6704ef5e83debe4a8ab3d9e80f9bed04012fb4413a5270fcf994 |
| scripts/phase7/core-loop-qa-packet-contract.test.mjs | present | 8842 | 24fec7274b0478d8d15f1fceb7bf131adfc1ad88b189debed51f04c804df7772 |
| scripts/e2e/human-e2e-manifest.mjs | present | 365743 | de9185cc072f28c89183ae134ea35b24abdf4be8bf0fb23333dc3efd4c10b615 |
| scripts/e2e/human-e2e-manifest-render.mjs | present | 2593 | b868275b0ca1a3bb99ab681bf7b96e466b03aefd3d410c244a7d9a076fc5b41d |
| scripts/e2e/human-e2e-manifest-contract.mjs | present | 3491 | 6e7f480614b95db86bcd3fd771a7de603cc4e1c9517fdd944c5846399e9bce0a |
| scripts/e2e/human-e2e-manifest-contract.test.mjs | present | 3037 | 1567c0da6f8654d6362f7628680b87f0df73b1bbe86d8a29e6a38de1648c2415 |
| scripts/e2e/evidence-diagnostic-hygiene.mjs | present | 26880 | 0a57e0f2b5e086be1313a33174b98ac54e79cd9a996db0bdc3a5fdb0f99fd911 |
| scripts/e2e/cat07-png-contract.mjs | present | 7176 | 1677a40874cc7797a9d0954d50c14c2dadde5111b85dcbc0b76cd2cdc1a53e9f |
| scripts/e2e/cat07-committed-evidence.mjs | present | 26706 | aba171f0dff8e720edb5d3b2bf4637dce3902cc503aa0b13a11f238c3b754bd0 |
| scripts/e2e/cat07-shelf-freshness-audit.mjs | present | 150904 | 84532689b6b2025c80f14c21771486804242b42257b6cc40a38fd24c9fbe6229 |
| scripts/e2e/cat07-shelf-freshness-audit.test.mjs | present | 60211 | a5a2f444cdf73cc914490101b1f90a4c3f5b48156e43eca3b219c1b0816615a6 |
| scripts/phase2/local-supabase-contract.mjs | present | 47459 | d72fad22be3bc90240178ed03b2718d2338355f977458968d7ed9d435b5d068d |
| scripts/phase5/device-qa-packet-contract.mjs | present | 2100 | c7bb801c99819e83ad4971cfbea573c60e41c074ca31e6d9dd068b2579cdc8ee |
| scripts/phase9/cat07-truthful-freshness-postgres-rehearsal.sql | present | 12249 | e2ffde42d3da2cf35e19c717cb85d6ddf9ba576b99d21cf46806d5e83ebc30dc |
| scripts/phase9/catalog-import-0061-upgrade-postgres-rehearsal.sql | present | 28021 | b1d3464bc9b20a6bc432082b8b01832b980ea231338427fa1e187c238dcd7919 |
| scripts/phase9/catalog-curation-0062-upgrade-postgres-rehearsal.sql | present | 22993 | 64102fcd36e69ff58ab957c94866e215f2f72900758bc98926a46057230e45e9 |
| scripts/phase9/lib.mjs | present | 22873 | 2432468891aa67b138785021580caadcc27ab5d1c7aca8c5015e1ddc531d021c |
| scripts/phase9/release-qa-integrity.mjs | present | 56470 | ff2f7724d4cc0bdd4058f76acb8c31ea3b4d2e80a1e1dba531066a1750b727db |
| scripts/launch/governed-evidence-chain.mjs | present | 64286 | 01a86c396964ffa8ab630341c46dc599f851cc0327e54563ec3366ef771aecb7 |
| scripts/launch/governed-evidence-chain.test.mjs | present | 35858 | 1361abf142d7ef3e50a321637dc02c7374ac7f64e0710146849f38498a62e43a |
| scripts/phase9/build-evidence-chain-ledger.mjs | present | 17702 | 69308cd626980aba6c12b636ff82230f9c40c1bb1d9d6b9fc10e71678abfc225 |
| scripts/phase9/build-evidence-chain-ledger.test.mjs | present | 10832 | 97b39eff264003a715df958960f6b352f22b9061251a47e6fad69763558e0059 |
| docs/HUMAN_SIMULATED_E2E_TESTING.md | present | 10407 | 4eda39f0c47b2debcb7021ad2e71d010e217ee9970152f50e01890e61ef4891e |
| docs/E2E_TESTING_CHECKLIST.md | present | 6998 | 34248253ee5234d7a92a7733f4579a191ff3bd398152da8941886ab79a786026 |
| docs/USER_FLOW_TREE.md | present | 470834 | 6aa5e9b6e07e6feac24c2f64a0f5974314aada8f12ecc346a295b91e67cb367f |
| docs/hugeToDo/CAT-07-SHELF-FRESHNESS-SOURCE-CHECKPOINT-2026-07-19.md | present | 16934 | e8df50a7774196f97388b0b3aa0f29a0379c2b2380400f39b6e5350a40ecaf1f |
| docs/e2e/generated/human-e2e-manifest.json | present | 51716 | 65b7e16ea6c5c4a1d1ea41e81aafb2860a78a8502c6687887163d011ae8a51af |
| docs/e2e/generated/human-e2e-manifest.md | present | 29844 | aa4b36c47c6616c938189a1c98d4f7ee5bedde3b7834247595eb356d5fb73f28 |
| test-results/human-e2e/2026-07-22/cat07-shelf-freshness-current/summary.json | missing |  |  |
| docs/phase-5/generated/device-qa-packet.json | present | 67134 | 6c5a8392a141b8bd7b4a386694af40b3d92eb735ad9034959e67ba6578456210 |
| docs/phase-5/generated/device-qa-packet.md | present | 54005 | fae02b1117440520afb208793ff8181969dfad1bd5bacdf0f466a56c8ee2625e |
| docs/phase-6/generated/payments-qa-packet.json | present | 46459 | b8ac3ab8859450f99f61f13d2e72e4296cebbe30a518b5415bae1125fbf1a4d9 |
| docs/phase-6/generated/payments-qa-packet.md | present | 29731 | 68ef2e97dd73b8c641322d0b0f61d2fdeae44b456722fec480c3c552844db2db |
| docs/phase-7/surface-inventory.md | present | 13983 | 6e786b9110a866ad89dc569e5bbcb029f97a08e7c55379ee06310223286e4d83 |
| docs/phase-7/launch-claim-matrix.md | present | 4322 | 7027d6d21f2cc7c3bb6944f003f9aeac6a09efea8dc2785280f6a3da44bb6b6b |
| docs/phase-7/beta-evidence-dashboard.md | present | 4972 | 8018b3cfa5f4c3c5092308a75854ac29e32f3a0c16deefc7f842eaa6e98a243e |
| docs/phase-7/core-loop-qa-checklist.md | present | 67419 | a68a8abdd945bdc6ddb5f95e5333a568729f4e35f292e7398b2dd05ecac0fca3 |
| docs/phase-7/phase-7-exit-review.md | present | 4844 | 4eae611b79c272251576743e6d999f1a84f540fb2dbe2a1049c1e0e9b2f48eba |
| docs/phase-8/public-site/share.html | present | 1634 | 45bced7d455386121e569aff4bf40b20dfccda7e54b4cd62560a313d2031c834 |

## Blockers

- Phase 7 source snapshot: test-results/human-e2e/2026-07-22/cat07-shelf-freshness-current/summary.json does not exist as a blob in pinned HEAD.
- Phase 7 source snapshot: test-results/human-e2e/2026-07-22/cat07-shelf-freshness-current/summary.json is missing in the working tree.
- Governed evidence chain: the governed evidence source must be one lowercase 40-character Git SHA.
- Governed evidence chain: the governed evidence release candidate must be one strict immutable RC directory.
- Governed evidence chain: pinned human-E2E manifest has no governed evidence-chain binding.
- Phase 5 upstream packet: pinned Phase 5 device QA packet must contain an empty blockers array.
- Phase 5 upstream packet: pinned Phase 5 device QA packet required QA evidence inventory is not exact and passing.
- Phase 5 upstream packet: pinned Phase 5 device QA packet does not contain completed named native-device signoff.
- Phase 5 upstream packet: pinned Phase 5 device QA packet widgetLifecycleEvidence is not pass.
- Phase 5 upstream packet: pinned Phase 5 device QA packet cameraLifecycleEvidence is not pass.
- Phase 5 upstream packet: pinned Phase 5 device QA packet performanceEvidence is not pass.
- Phase 5 upstream packet: pinned Phase 5 device QA packet required native OCR evidence is not pass.
- Phase 5 upstream packet: pinned Phase 5 device QA packet fresh governed evidence-chain audit is not pass.
- Phase 5 upstream packet: pinned Phase 5 device QA packet fresh governed evidence-chain audit is not pass.
- Human-E2E upstream manifest: human-E2E manifest must be one JSON object.
- Human-E2E upstream manifest: fresh governed evidence-chain audit is not pass.
- Missing test-results/human-e2e/2026-07-22/cat07-shelf-freshness-current/summary.json.
- CORE-07A share publication is not admitted; no runtime flag, final domain, reviewedBy field, or QA flag may substitute for a positive immutable exact-content share receipt.
- CORE-07A public links are not admitted; no token service, reviewed retention/revocation/deletion/abuse contract, or exact-destination confirmation is available.
- CAT07 committed evidence: test-results/human-e2e/2026-07-22/cat07-shelf-freshness-current/summary.json must exist in HEAD.
- CAT07 committed evidence: docs/e2e/generated/human-e2e-manifest.json in HEAD is not canonical JSON (two-space indentation, deterministic parsed key order, and one trailing newline are required).
- CAT07 committed evidence: committed human-E2E Markdown must exactly match the canonical rendering of its JSON.
- CAT07 full evidence contract: full CAT07 manifest validator failed: FAIL committed CAT07 full evidence contract: test-results/human-e2e/2026-07-22/cat07-shelf-freshness-current/summary.json must exist in the pinned HEAD.
- Missing brandReady evidence.
- Missing supabaseRlsPass evidence.
- Missing clinicalReviewPass evidence.
- Missing catalogBetaImportPass evidence.
- Missing deviceQaPass evidence.
- Missing revenueCatQaPass evidence.
- Missing privacyExportDeletePass evidence.
- Missing betaDashboardReady evidence.
- Missing PHASE7_SIGNED_OFF_BY.
- Missing onboardingConsentQaPass evidence.
- Missing shelfIntakeQaPass evidence.
- Missing reviewedGuidanceQaPass evidence.
- Missing routineBuilderQaPass evidence.
- Missing todayCheckoffQaPass evidence.
- Missing photosPrivacyQaPass evidence.
- Missing remindersQaPass evidence.
- Missing paymentsLifecycleQaPass evidence.
- Missing privacyControlsQaPass evidence.
- Missing shareCardQaPass evidence.
- Missing deferredSurfacesQaPass evidence.
- Missing analyticsQaPass evidence.
- Phase 7 evidence contract: Phase 7 evidence brandReady is not pass.
- Phase 7 evidence contract: Phase 7 evidence supabaseRlsPass is not pass.
- Phase 7 evidence contract: Phase 7 evidence clinicalReviewPass is not pass.
- Phase 7 evidence contract: Phase 7 evidence catalogBetaImportPass is not pass.
- Phase 7 evidence contract: Phase 7 evidence deviceQaPass is not pass.
- Phase 7 evidence contract: Phase 7 evidence revenueCatQaPass is not pass.
- Phase 7 evidence contract: Phase 7 evidence privacyExportDeletePass is not pass.
- Phase 7 evidence contract: Phase 7 evidence betaDashboardReady is not pass.
- Phase 7 evidence contract: Phase 7 evidence has no named signoff.
- Phase 7 evidence contract: Phase 7 evidence onboardingConsentQaPass is not pass.
- Phase 7 evidence contract: Phase 7 evidence shelfIntakeQaPass is not pass.
- Phase 7 evidence contract: Phase 7 evidence reviewedGuidanceQaPass is not pass.
- Phase 7 evidence contract: Phase 7 evidence routineBuilderQaPass is not pass.
- Phase 7 evidence contract: Phase 7 evidence todayCheckoffQaPass is not pass.
- Phase 7 evidence contract: Phase 7 evidence photosPrivacyQaPass is not pass.
- Phase 7 evidence contract: Phase 7 evidence remindersQaPass is not pass.
- Phase 7 evidence contract: Phase 7 evidence paymentsLifecycleQaPass is not pass.
- Phase 7 evidence contract: Phase 7 evidence privacyControlsQaPass is not pass.
- Phase 7 evidence contract: Phase 7 evidence shareCardQaPass is not pass.
- Phase 7 evidence contract: Phase 7 evidence deferredSurfacesQaPass is not pass.
- Phase 7 evidence contract: Phase 7 evidence analyticsQaPass is not pass.

## Warnings

- none
