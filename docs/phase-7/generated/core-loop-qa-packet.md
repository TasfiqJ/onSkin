# Generated Phase 7 Core Loop QA Packet

Generated at: 2026-08-10T01:37:52.760Z
Git SHA: fa0aa21c1fa2020a3e2a9624daf4051f4564dd8f
Git status: DIRTY

Strict completion requires real brand/legal clearance, Supabase RLS evidence, clinical review, catalog import evidence, device QA, RevenueCat QA, privacy/export/delete QA, analytics dashboard readiness, and a named owner.

## Governed Evidence Chain

- Status: blocked
- Source S: `BLOCKED`
- Evidence E: `BLOCKED`
- Current R/F HEAD: `fa0aa21c1fa2020a3e2a9624daf4051f4564dd8f`
- Selected RC: `BLOCKED`
- Ledger path: `BLOCKED`
- Ledger SHA-256: `BLOCKED`
- Ledger entries: 0
- Audited generated descendants: 0
- Packet code bound to S: BLOCKED

## Upstream Packet Contracts

- Human-E2E manifest: blocked
- Phase 5 device QA: blocked
- Phase 5 recorded head: `ce7d3fedc88e6333e72dad9c08b03dd9105dd73b`

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
| package.json | present | 44354 | af6cec1697c363daf266bcd4032a184aa9a994a51cc6a8c0991da4c67b0d8c8e |
| docs/hugeToDo/launch-contract.json | present | 7174 | ef6a34e9e8de58380296f08473211f4915ab81817cde4ee5394f6210f08ca3bb |
| docs/hugeToDo/CORE-06-RECOMMENDATION-ADMISSION-SOURCE-CHECKPOINT-2026-07-26.md | present | 35345 | 6a4bba46c424d8941303d3a7d695e916c8d1b70671af12613fd944903f657246 |
| docs/hugeToDo/CORE-07-SHARE-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md | present | 9946 | 066dce90fc4cf7749eebbd8dcf5874917d36484ddef097e60a94a1b3fc649dcb |
| docs/09-personalized-recommendations.md | present | 46694 | 27f422fbf7d58d35193d03611b66d80148c2f2e74883dd2b81e0be08e77f87ce |
| scripts/launch/contract.mjs | present | 15776 | 7bec15c6d8aa7a5f744e094fa74c84969b6b09eeb23d97e94e05498315d5708b |
| scripts/core02/clinical-rule-source-contract.test.mjs | present | 36083 | 627b0a03adc26059ed2828b55bc69d6a87b9662f8dbac9c5bdc89f6a42fc0382 |
| scripts/core06/recommendation-admission-source-contract.test.mjs | present | 31801 | 832b5f8ae7d03fb8280c91df3cbe197b7818b2cc745dff7991c3c0387ae5f8a2 |
| scripts/core07/share-admission-source-contract.mjs | present | 34840 | ffbe2846213eb33235b0dad2f3fde61685cff6db92db0d887fed5071392cfd9d |
| scripts/core07/share-admission-source-contract.test.mjs | present | 11145 | 8990c02aae82ed1271bc5e010373609a482ac40f1b565cfa60c70d3c9d9eb8a3 |
| scripts/phase9/recommendation-zero-admission-smoke.mjs | present | 10172 | e0a502b43e551350852c6bb48301b54cb52526789f8e238bb47406c833205df9 |
| apps/mobile/src/lib/env.ts | present | 7874 | d01f2db0a98f0537663312adc42bb375ca8523cdec282f2548a610b1f98383f1 |
| apps/mobile/src/lib/env.test.ts | present | 9745 | 5d2cb946d79920cbaec54eae3c9f0409fc6636673ac1e0f14ee8e6c5b5558bdc |
| apps/mobile/src/lib/launch/phase7.ts | present | 5454 | 1d198075b9eed13f1b0b9cfcdff59043368999a46f2845df4c81ab518afa4f36 |
| apps/mobile/src/lib/launch/phase7.test.ts | present | 10212 | c2e3fa53a0f06bc6ca7466d5260cca5fc403500d847eb32fb38699ff1f3f0cf5 |
| apps/mobile/src/lib/launch/phase8.ts | present | 2237 | dedaffd1350a4f8288dfb029fad187b00f6899de3f7e05bdbe09d123058564e7 |
| apps/mobile/src/lib/launch/phase8.test.ts | present | 2289 | b8b699ce63dcd78ba1a1747cdc413c36cc00827084d7b0612ce2d5f44e3c7b2f |
| apps/mobile/src/components/launch/DeferredSurface.tsx | present | 2402 | 79a3f2e05911f3e78be64f9fca311d57166fbe38ae178359f2dc3181d7417c47 |
| apps/mobile/src/components/launch/DeferredSurface.test.ts | present | 1646 | bf8f2f3f4b13e8f06f1bd7f2f9c27271d873c05b70435dbc0f49dc8d0f3bb7f3 |
| apps/mobile/src/lib/navigation/safeBack.ts | present | 1487 | a2e3143f42c223bb14acb27e97182a8582dc85342f44a8960c0c4adf4795ec12 |
| apps/mobile/src/lib/navigation/safeBack.test.ts | present | 3715 | 126a5f0b64f09192e20052bfa87f2f327ffab2831b3cc9a287882023ae7cd203 |
| apps/mobile/src/app/(tabs)/today.tsx | present | 38886 | c07f10efec2a63a5c6eeb8cefc7e040276cae42fcfef1f18a1646dc3d93074d1 |
| apps/mobile/src/app/(tabs)/progress.tsx | present | 20084 | 5ca24d30673f0f0e79ea4ded5e2758e17ecda5505ca6a94862271b9614c6b030 |
| apps/mobile/src/app/(tabs)/shelf.tsx | present | 21848 | aaf21f3b9567103e0c35b2fdeec4f535f164b592942e76b091e25ba19ab0fb43 |
| apps/mobile/src/app/(tabs)/you.tsx | present | 36392 | c5e534632a0dc98b33dc23aef4c0fa491f614a339d44ee6c24692712f9133620 |
| apps/mobile/src/app/_layout.tsx | present | 4046 | d2d7bae5a6eb88250d21a81cf09ec2ac2523673b429e7df4fcb4ba45539a08f6 |
| apps/mobile/src/app/cycle/settings.tsx | present | 27312 | 83d4354596864bdcb546ece0243de3b7a2affe71ecbf3029b72c126caeb6d333 |
| apps/mobile/src/app/cycle/week.tsx | present | 15186 | b2c90d552f0c186bad5cbcd385e60cba289ca5b6242f6f9d0b991f631af200ba |
| apps/mobile/src/app/cycle/why-tonight.tsx | present | 9120 | 7e85c05e2157e53dbb88db012045056133b2f6a0b32dc47f797e6891a95559f3 |
| apps/mobile/src/app/onboarding/products.tsx | present | 15830 | d4dc65741eeee9852dda1c99c8b7ab18d47a58ff5783619c57008a450f69b94b |
| apps/mobile/src/app/routine/plan.tsx | present | 19735 | a7a4e3c5dc34b3dd0811faefb6f67a1a6809a0e6396b16521d46497c334c9bfc |
| apps/mobile/src/app/share/conflict/[ruleId].tsx | present | 539 | a996efa45ca90843bb78b4f07e188d27f5e41bb37d146c7379e0a1c3881cc473 |
| apps/mobile/src/app/s/[shareId].tsx | present | 1198 | 1703e9e18281966cf0c6cf0d8d37524c80bfdc094da073eb04f8618da50af0f2 |
| apps/mobile/src/app/trend/_layout.tsx | present | 932 | 8e52eb3c8bcf71a9510e615136717c06253194b57002ba35b8b0341782a6fb5f |
| apps/mobile/src/app/trend/fairness.tsx | present | 602 | 625403126bf931379dc9c3a7bf4b85eed206e20d6c931ae98a741685b5639a50 |
| apps/mobile/src/app/trend/optin.tsx | present | 550 | f1b4ef25ffe3161c231e766ad24bd43b308dd4394e347925dfdde0c27667ac23 |
| apps/mobile/src/app/conflict/[ruleId].tsx | present | 25335 | 18f00fd1e5f161dfda3cda01f952a5bc620e88598c7ed13ffdfa67c9d9587f4e |
| apps/mobile/src/app/recommendations/[id].tsx | present | 9519 | a543fefe3766440bb069d22cc2610afa9d479d5bce41dbadecb815717a073083 |
| apps/mobile/src/app/recommendations/index.tsx | present | 16527 | c7ccd56efafea2072f8b4cb2d7191971b22626767a87601062f25b38b0a74e00 |
| apps/mobile/src/app/recommendations/preferences.tsx | present | 14358 | 2c55147fe125d665ab955e5ceefac2018c1f85dfd4e747846d11935c4515c106 |
| apps/mobile/src/app/shelf/[id].tsx | present | 45428 | 1b2fddb06a6809c09987635c672c9a43026226805481c5438df09950c8d6cc3d |
| apps/mobile/src/app/shelf/_layout.tsx | present | 963 | 5223360e4b730ffc7fd37d356211a5aab42cae6aba388474ea1af61999d8203c |
| apps/mobile/src/app/shelf/add.tsx | present | 337 | 69027d3b5ac294d2632ceba04a4f075dfdfe624566466415059e5e74f37c0aa7 |
| apps/mobile/src/app/shelf/archive.tsx | present | 4165 | 6f17ea9614579d1f50e8b17bdf0b9dbfac6caac699821302710903f745d3854d |
| apps/mobile/src/app/shelf/manual.tsx | present | 17625 | 7b5be927575a0fcc5febeafe03511c1bda402e591644707ffb167807bccb3190 |
| apps/mobile/src/app/shelf/no-match.tsx | present | 13431 | 7fdbdebaf549170305f6e959548446c1cc1a0d483c1b32408f8683a820d4c353 |
| apps/mobile/src/app/shelf/ocr.tsx | present | 47515 | 8081c8eec75eb8a0781c66a1f2e5f093ad6f54c067e261a155bf33412f2b61a2 |
| apps/mobile/src/app/shelf/opened.tsx | present | 18282 | 1e7108e64c4b12f462a51745f1e15d465990ed2dc8f7cf0b76f027afbc677c85 |
| apps/mobile/src/app/shelf/replenish.tsx | present | 10694 | e4dee732e65c6bbdb7870597941390d5e53416940cce96d02d3f4d7eb8d2aec1 |
| apps/mobile/src/app/shelf/scan.tsx | present | 33673 | a8ec4e910593e3e4917e75b170b300cff88eefac35f46b1ea332d0b544279248 |
| apps/mobile/src/app/shelf/search.tsx | present | 24504 | 193518934f1168ed86ddc90f530af12065b8c00e4c394722ce61a8181901f087 |
| apps/mobile/src/features/ask/answer.ts | present | 15570 | 231edf9518e51ab747dab53d2740d8a8aa4317a1c48349f73fd3d17313790e7b |
| apps/mobile/src/features/ask/answer.test.ts | present | 11922 | 4d6a33acbd626f7a3a61b02e62af29c85d59ace6fc01f63a74bd27608ffb1dbf |
| apps/mobile/src/features/ask/claimsafety.test.ts | present | 7841 | 05cd47f500866b175719b0c16e5a0106c84ed0581d49a372e5d6daaadb3e650c |
| apps/mobile/src/features/ask/copy.ts | present | 7508 | c0fa11f9fcb1c0175e13a3368e1000f7dd6f2b80e2d486124649b55878358f35 |
| apps/mobile/src/features/ask/useAsk.ts | present | 5560 | 9f03da10e33b546052d7c0bea39b8f72cba70c28465f17eeca5bed79930b6727 |
| apps/mobile/src/features/catalog/client.ts | present | 23824 | 85b771f782010e99cd4061ed331557de73e68a16fb838d92f720f58d042f693e |
| apps/mobile/src/features/catalog/client.test.ts | present | 31695 | 42dc1c9e4d29c565827535836cf635c37bc19399f663859695a1546df518d297 |
| apps/mobile/src/features/growth/shareAdmission.ts | present | 2280 | 02adedb821a476eeba4fd2bc06681feeba2008fa1c97ffd4937a39a569dc6327 |
| apps/mobile/src/features/growth/shareAdmission.test.ts | present | 1773 | 8c9f4e8d16aa5cdd4dd9ef0911b129a700966e2990539f820424d620ea22c58b |
| apps/mobile/src/features/growth/publicLinkAdmission.ts | present | 1278 | 2010dbd8de265052387c6d8930df10fc77f152aa3da1529622ed47b1adfc1ab0 |
| apps/mobile/src/features/growth/publicLinkAdmission.test.ts | present | 1399 | 89560602ca877d7da45e518657372be92929003accb55641e6628a07a6fc4e1e |
| apps/mobile/src/features/growth/shareProjection.ts | present | 3922 | 181032634536521b98caee66fabda609be3e3832f238bf1c73b4f42fca08ab6b |
| apps/mobile/src/features/growth/shareProjection.test.ts | present | 3360 | 13f4e6e502729400592522be787f629581e437cd934bbeada3b995d5bbd91a94 |
| apps/mobile/src/features/growth/ConflictCard.tsx | present | 4280 | c507a02987606253932950df0066322a724edfccdc08286640882d0b660af981 |
| apps/mobile/src/features/growth/shareCard.ts | present | 405 | a7059162afa68ee7cdd765a117d5c8edee387eaf5a8d7d85c78ff23ee0faafac |
| apps/mobile/src/features/growth/shareCard.test.ts | present | 1667 | fcecf1cd61bf89aa3693ac9bd3e1dde3432de81926f4d52598209ce36ded0e7b |
| apps/mobile/src/features/growth/shareLinks.ts | present | 318 | 36af63e30c40653b8940d7f8dbf89e7e6b451c3286b522181f77ff1f9a1127f7 |
| apps/mobile/src/features/growth/shareLinks.test.ts | present | 1432 | 7bf7ce568500a5849da0b7b261aad0f611f24f2076d514d36df07ba896c79194 |
| apps/mobile/src/features/growth/shareLandingRoute.test.ts | present | 1958 | f4a329de6c143ef8b1ea376bf5f778e13861d28880a6462f6f1f03183632b8f0 |
| apps/mobile/src/features/growth/cardCopy.ts | present | 1015 | a24de9609fad759eb3eab90dac948769901f53a30b3540803bf63082ddeb9067 |
| apps/mobile/src/features/growth/cardCopy.test.ts | present | 2295 | 98399b2b10fa7ce24935353ea1bd5b9eef06c614381d0d2a2d12748874d4d08d |
| apps/mobile/src/features/commerce/WhereToBuy.tsx | present | 156 | a459ece2191dbbfb7aa787e784dd074b8b361369e904ee9d76baf8118848a0ae |
| apps/mobile/src/features/commerce/commerceRoutes.test.ts | present | 3417 | 5944b9d3b150c49ed31e4b111ca50717630813ef4a58211bd6d6de412ea3ff72 |
| apps/mobile/src/features/intelligence/pao.ts | present | 5160 | 32209515587ba1136c72abcd9703f25ef46c0aa6a289bff5fac685a08a0eafde |
| apps/mobile/src/features/intelligence/pao.test.ts | present | 3875 | d4ff777e1b13717b1fd7b6d01a695070e34f065a311b1f98e04d3b0bb737a385 |
| apps/mobile/src/features/intelligence/conflictIdentity.ts | present | 878 | 06b94824e2a2b164d3b40f38e3106252cf0f796a34292d8dcbbdeba7d0c20ecf |
| apps/mobile/src/features/intelligence/conflictRoutes.test.ts | present | 15285 | 5afea2b23b272edfca8978c717523530ea5d2729a29367876899a53171bd949e |
| apps/mobile/src/features/notifications/BehaviouralTriggers.tsx | present | 3485 | a1d607269e8beef3e56d0694fd80fb7f9f6f77b42278d7e7f5dc8cb1db4a5ffd |
| apps/mobile/src/features/notifications/claimsafety.test.ts | present | 4506 | a60c1534edb7ac76c00faf543e833d5df5671685373e8475db80aa23a4d8ab5a |
| apps/mobile/src/features/notifications/copy.ts | present | 5151 | 9aa46a886898cf55ff2b436c7a555f8df7eba7ed6f715dd173d0a5f652daee5d |
| apps/mobile/src/features/notifications/store.ts | present | 9910 | 396f23be42696512500e46c8250b149f07a7100f0c2e503805fe1bf28cae1b88 |
| apps/mobile/src/features/notifications/store.test.ts | present | 7931 | b8a63af36c9facd9806f11a4057ddd65a506c53bc6a7383afa91af23a2663366 |
| apps/mobile/src/features/notifications/replenishmentOptInMigration.test.ts | present | 718 | 2b34153c9a4a85b29bbf8483217a65e4ee99b15837a50128bc7cf572c09fb4a0 |
| apps/mobile/src/features/onboarding/serverSkinProfile.ts | present | 9991 | 2680e2d2351a632e83ff3e754bcec970428061b1c37d44be57ca2915196912e3 |
| apps/mobile/src/features/onboarding/serverSkinProfile.test.ts | present | 5888 | 65a95900235a33b8ebc2d3b2181defd85bbba27a67eaa407ff413c2010b9ec31 |
| apps/mobile/src/features/recommendations/admission.ts | present | 3362 | 699de9485fa5fed2335fb4b91dbd9f263ae7cd081048c30bb6b4d6fc17bb7934 |
| apps/mobile/src/features/recommendations/admission.test.ts | present | 3673 | 41f457e23372c20b95d5bfe723a4077bebfefbf833aaa4cf786e73505a51cf70 |
| apps/mobile/src/features/recommendations/RecommendationsTeaser.tsx | present | 8769 | 9a255293b62127479d28415260afe39f1730cf408f25fcef38c55610d1e327ff |
| apps/mobile/src/features/recommendations/RecommendationsTeaser.test.ts | present | 4098 | b5e0476fc56282475ab005d50a49e3e65104a1e9d413389d81cf957976eea03a |
| apps/mobile/src/features/recommendations/claimsafety.test.ts | present | 11306 | 252f4bd0350bbdeb0252e488c6f2805631ec27a3e49293946b96c04895678276 |
| apps/mobile/src/features/recommendations/catalog.ts | present | 9190 | e183af7ee7a5857de1aad0024f823ab2404d9ed1d5d60f7faf56d5f65973b511 |
| apps/mobile/src/features/recommendations/copy.ts | present | 11164 | af155a735087bbcc2890f9fb758fdfb924c73afcd3e4708aa41996ef54c74c8f |
| apps/mobile/src/features/recommendations/engine.ts | present | 24388 | a1d0a76d4b276e2a38dd50bd473f73cab343c65610d67a84442127535e3a950c |
| apps/mobile/src/features/recommendations/engine.test.ts | present | 31685 | df0fe0eb470f47ae40d09cbc427de0c1c80081c2b22ca9be7e216dbc881cfb31 |
| apps/mobile/src/features/recommendations/fit.ts | present | 5856 | 4eec6fdbc73890afa427ab8257eb9818ad3bef9771ea4c21c2233fedb6dab505 |
| apps/mobile/src/features/recommendations/fit.test.ts | present | 5245 | 7e5df21dc82923a9b51041a3a986c6d9ff6d2aa77acb84d5cd947c5f2f9122e9 |
| apps/mobile/src/features/recommendations/fragrance.ts | present | 912 | da21d1a0df285d242c9aef9fe4c05e329d44f3fb1047a2c4a075d4585d2c1644 |
| apps/mobile/src/features/recommendations/goalAdmission.ts | present | 2696 | fb83706008828017504ae68c94ba561cb7441dfb65047d341771bc0a2d2aa27b |
| apps/mobile/src/features/recommendations/goalAdmission.test.ts | present | 2749 | 9342f3791b75441c2522f505832a3e7eb371de999ef15d8f166277acde9337aa |
| apps/mobile/src/features/recommendations/goalProvenance.ts | present | 4471 | b1c4ee246ed40885d8fc6b57cbcfecf5d66124a38fe4209841dd16df39ec3cc6 |
| apps/mobile/src/features/recommendations/loading.ts | present | 707 | 3708883b8d09582f3620cc933e2412ef2c6054d0fe5d9f5ca15d9145067c5c55 |
| apps/mobile/src/features/recommendations/preferences.ts | present | 920 | 83a545245a56af5094cc15ef2d152a43e3ec77d3e6de80788b5d7a1ef530bcf4 |
| apps/mobile/src/features/recommendations/recommendationRoutes.test.ts | present | 16214 | 613046a86d8d81bd131362697574f18dc7f7ed2d44ce3041076e358ad93eec62 |
| apps/mobile/src/features/recommendations/replenishment.ts | present | 3829 | ad0658a4a88071c1991c13c1d8d797d6250cdf5fa70fc33f2613cef380b4e610 |
| apps/mobile/src/features/recommendations/replenishment.test.ts | present | 6348 | 412f2d66356e09df6c9766a156b754978d7fdf5874e960204cd491844bfdcfc7 |
| apps/mobile/src/features/recommendations/store.ts | present | 7365 | cb428e23452d4315e573258daa86f0f68c5cbee614bf120408a0a5ad6ca4ef66 |
| apps/mobile/src/features/recommendations/store.test.ts | present | 8337 | e7b41b103e0634e744c0321e2ee1ff78bb9447c0365c431b52630e16e1c0ee46 |
| apps/mobile/src/features/recommendations/useRecommendations.ts | present | 3878 | c86b5797892557f0197bc812cac9bf1ebe5eab79956590be5e64955b3331f733 |
| apps/mobile/src/features/recommendations/useRecommendations.test.ts | present | 2802 | facda1c30fe00fe4cf5e7bf7a98c3435481835857c4774a3e9316af501f343bc |
| apps/mobile/src/features/routine/activationAnalytics.ts | present | 5526 | dfae2f3154e39e42e13a4640d48656feda527475418f50b26c655e81afb50346 |
| apps/mobile/src/features/routine/activationAnalytics.test.ts | present | 6849 | 636d7853c8726c1a6e1bb8f7bf8aa4f65a86cdb903841b2ef30e4429b6a1bbd0 |
| apps/mobile/src/features/scheduler/cadence.ts | present | 2891 | 0c46957a5a49577fdb6808cea95802834a8b5c5f2df50600d4ce93c00a0f8f6d |
| apps/mobile/src/features/scheduler/customCycle.ts | present | 13146 | 3e6fc08ddf8813933f5e07216fc04c411d7683a44f3761b33b82132f95ee9cda |
| apps/mobile/src/features/scheduler/customCycle.test.ts | present | 9291 | 9cec61bc36016b5c2acc6afeaff48b37cae861271141203520574ea3399f8e14 |
| apps/mobile/src/features/scheduler/cycleStore.ts | present | 21917 | 2b62b32417ea521812b6e262d3af6f70d5b476cc6ed9c63cb1b2571080b3a69f |
| apps/mobile/src/features/scheduler/cycleStore.test.ts | present | 26042 | 494e627efccb6bb99af9db4cca05925b463548fc8614088c00849e848d7db051 |
| apps/mobile/src/features/scheduler/cycleWeekRoute.test.ts | present | 21836 | 19b56bbd139d44d5ea04ebc37d33c132b6f212156ce071e0d302ae0d39ee9ab0 |
| apps/mobile/src/features/scheduler/orchestrate.ts | present | 13384 | 270438bd3b141bfec25009e1045931768ff5f2742bace5eda7b049ea8c3e7b98 |
| apps/mobile/src/features/scheduler/orchestrate.test.ts | present | 19685 | adf9461b4f76f0e4662c26784805ee7d7a8bda7b77bd1ea3a0314f994c3484d3 |
| apps/mobile/src/features/scheduler/profile.ts | present | 6608 | b973abeefc9753eac218965d0e3bdbc437faab7191b3cfc141c5b979a116f63a |
| apps/mobile/src/features/scheduler/profile.test.ts | present | 10906 | ca69bfb059f6d8d608574c05c49b88097afa69895bc6963c4823e766a1549985 |
| apps/mobile/src/features/scheduler/useCycle.ts | present | 12287 | af28c4dab1dc7d71ff0959047fdea3c24fc2346bbfdaa6f97d959f4ffb0c3493 |
| apps/mobile/src/features/shelf/freshness.ts | present | 7302 | 15e49e4d6e0911eb7cb465c15c8b2a836affe16d09f6f122c1d4ddb3ee1294b3 |
| apps/mobile/src/features/shelf/freshness.test.ts | present | 8351 | fee1fd4da816079fe1e3cd10a33af16c74e7244ec996905605013f7884699a0a |
| apps/mobile/src/features/shelf/freshnessMigration.test.ts | present | 4858 | 03808fae36a3a74134bcda3d5db0e729729dcde2653b0331a7d481a5a71f9689 |
| apps/mobile/src/features/shelf/paoProvenance.ts | present | 511 | a9688d11fda1c37ac1aae3d66426d82f470ba7a04252d7b4558cb9e361c90910 |
| apps/mobile/src/features/shelf/paoProvenance.test.ts | present | 1305 | 036d37d4a9e008be0b89e5c63d9091704f439d23111ca377513a5f4a6bebc555 |
| apps/mobile/src/features/shelf/shelfRoutes.test.ts | present | 69844 | 4e25d81e10f9bba5eead0e597eaabec9f1e459600b73bc922fe8bb75528d3a71 |
| apps/mobile/src/features/shelf/store.ts | present | 58802 | 29efebed92401a8cdb627f382977eb65c9343a35d90f1c947febd6407d4808e7 |
| apps/mobile/src/features/shelf/store.test.ts | present | 57316 | b36dde3201cc2abedb699a9a9b16e572ad19f04142ea894ab757c548898bb650 |
| apps/mobile/src/features/today/completionsStore.ts | present | 36567 | 2bcd01245770ca3b1055a88ee26d75278fe49cc4d360f6662aa62550b18df5bc |
| apps/mobile/src/features/today/completionsStore.test.ts | present | 31521 | 26f5616f33bb413563e9e25ba9957cae0178ffc803dc8ec6dfeb268ee56e166d |
| apps/mobile/src/features/today/cycleCompletion.ts | present | 622 | c3c632e9bf71f42f85fa140de50b03e3b47afe2d0c00a70977579879f81f5317 |
| apps/mobile/src/features/today/cycleCompletion.test.ts | present | 2516 | 437d3282afaac2a6c106fc3e056b410dab2fb6d34c3363bc99de829e615b3462 |
| apps/mobile/src/features/today/routineProjection.ts | present | 7275 | 6fd3051255557caeaa3e92bb4c3ca29713c3dc2c620aad7fc4beaf17b0d998c0 |
| apps/mobile/src/features/today/routineProjection.test.ts | present | 7637 | c89b88c5a960fc77fec7508528b5d0f10699600a17bc917a7b4371f0d1f761ed |
| apps/mobile/src/features/today/todayRoute.test.ts | present | 12470 | a9f3974eecfdf656bb1b3024bcc9950bd3c3511934045d8a7e04cc3e0ea65a20 |
| apps/mobile/src/features/trend/copy.ts | present | 5384 | 40709349e646db4d7fa582dd397e96ce315a2394f7c3714224a8911e1de066f5 |
| apps/mobile/src/features/trend/fairnessPrivacyGate.test.ts | present | 3420 | 71eec188c7b7135d067ce1313be73dc4df8be5afc02fe3ec655fe44a81dac802 |
| apps/mobile/src/features/trend/trendRoutes.test.ts | present | 2544 | a74a7c0516aa57fb610e0339d85a740505fe8f203f30d7f93f5e1713ddcf298a |
| apps/mobile/src/features/trend/useTrend.ts | present | 2605 | f66040eaa2090ad36f2b35244e6c70814f6709981448e5210b5577ec71d98f75 |
| apps/mobile/src/lib/consent/healthDataWriteAdmissionContracts.test.ts | present | 11623 | 862fa0aba3d6153c257203e4a532361315e994852bc3294aac0ef4fb2bd11f3c |
| apps/mobile/src/lib/consent/healthProcessingEpoch.ts | present | 19939 | 7bc8327c91737b810a6fa24a5fbac1569b7d3a47883de0d5dc53651245d4794a |
| apps/mobile/src/lib/legal/phase3LaunchGates.test.ts | present | 2082 | b9bc17d3b7ed540c527509e4e59ca3a774d3d2510f6bab706c2b8742f5b91aee |
| packages/types/src/database.types.ts | present | 213300 | 2c14252f882294d2ca42832405fb0fe157f855a85a9d3fc5d47999457be9b1d3 |
| packages/types/src/client-database.types.ts | present | 3194 | 7527a744c009f23b87c9ca88dee22df8192fcd7f288a1ef427e2efb42eab2c95 |
| packages/types/src/client-database.types.contract.ts | present | 3849 | 3de1fbfa0648aabd8f4f07a0e41ccba3a8992cfc7301b1248ffcecfa731ec00a |
| packages/types/src/index.ts | present | 19452 | 03fbf4e84f93a35a8ea72da9c69f184f06ce0b3a9e5bef0fc4569859d2f22c91 |
| packages/types/package.json | present | 398 | ef2fb4ad105532c389467886cc2035de955078f4ae1a8b08db122241592b62c2 |
| apps/mobile/src/lib/supabase/client.ts | present | 7619 | c200f014b9edf07064523fe97da18d4020e5404f0ad364d01cb3aa6fb33322c5 |
| scripts/phase2/database-types-contract-lib.mjs | present | 1380 | 315402e9a0b8f77d8c922022ff9040c342769c9a57a122912ef5cff43f35355d |
| scripts/phase2/database-types-contract.test.mjs | present | 5663 | 8b8617536c1877200480db460683f3e476bc77f80affea00be4d9f61b79907d3 |
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
| supabase/tests/database/cat07_truthful_freshness.test.sql | present | 36165 | 24fe6b485009f9733568b3e101c5278380d620e9a75894898a114a9f1670d6f3 |
| supabase/tests/database/recommendation_zero_admission.test.sql | present | 17952 | 6b913214063fde2879fc990e53e48dc46e3a3fb12998ded0f91b106ae6b454bf |
| supabase/tests/upgrade/recommendation_zero_admission_0071_upgrade.test.sql | present | 7912 | 011e2ffc2994475df1ece65e1503dd363c4d42206a4509d46195a01d4f324c77 |
| scripts/phase7/build-core-loop-qa-packet.mjs | present | 50771 | f533e751b5aa254cc4f1d6816e90032d1c501b5a9c0c5d3db5305b3db2e21951 |
| scripts/phase7/check-core-loop.mjs | present | 32536 | 4acb5ef04037dfca9062a3e06da799c2b31ee8b7defa5a56011551a2f35ae356 |
| scripts/phase7/check-core-loop-smoke.mjs | present | 36764 | 2f38af5f74fea6abd0a609f461259179a5227d8f9b9c4c00a859a7f770caa25a |
| scripts/phase7/core-loop-qa-packet-contract.mjs | present | 1474 | 3cf50c30778d6704ef5e83debe4a8ab3d9e80f9bed04012fb4413a5270fcf994 |
| scripts/phase7/core-loop-qa-packet-contract.test.mjs | present | 11973 | b69b4a712244d30a7802b0ac9699c4828e855e77f93d25ed8c0fdb01ef549b2b |
| scripts/e2e/human-e2e-manifest.mjs | present | 366877 | 7c887ba017a91d47840b79496513c9d3a178286ce652e1e267b1f8a806e89751 |
| scripts/e2e/human-e2e-manifest-render.mjs | present | 2593 | b868275b0ca1a3bb99ab681bf7b96e466b03aefd3d410c244a7d9a076fc5b41d |
| scripts/e2e/human-e2e-manifest-contract.mjs | present | 3491 | 6e7f480614b95db86bcd3fd771a7de603cc4e1c9517fdd944c5846399e9bce0a |
| scripts/e2e/human-e2e-manifest-contract.test.mjs | present | 3040 | 6735c623cb02de4504eda49fece81eadaf944b6bdd28ef12537bbfad22cb350a |
| scripts/e2e/evidence-diagnostic-hygiene.mjs | present | 26880 | 0a57e0f2b5e086be1313a33174b98ac54e79cd9a996db0bdc3a5fdb0f99fd911 |
| scripts/e2e/cat07-png-contract.mjs | present | 7174 | 9c1f9d93dc8e2ee70a7490b8355808a628b86eb75da423fb94f5df958928a29a |
| scripts/e2e/cat07-committed-evidence.mjs | present | 27592 | 3beef279abfe936f2edd35358d69bf192d6896cdc9eae61a88a0beb49bb4e9fa |
| scripts/e2e/cat07-shelf-freshness-audit.mjs | present | 164470 | 786634bcf91a0799ad7957ee3416c95b4ed0c021dfa529c1fcc07c47afa4f93d |
| scripts/e2e/cat07-shelf-freshness-audit.test.mjs | present | 70903 | 8e0c5806f0bb448b2b3f81446110a867d8041bb375625b822b1a088d93804006 |
| scripts/phase2/local-supabase-contract.mjs | present | 53244 | f104824ecde526d55740a72515422b78faec7243afe8b58219c984fd1f6b4c21 |
| scripts/phase5/device-qa-packet-contract.mjs | present | 2100 | c7bb801c99819e83ad4971cfbea573c60e41c074ca31e6d9dd068b2579cdc8ee |
| scripts/phase9/cat07-truthful-freshness-postgres-rehearsal.sql | present | 12249 | e2ffde42d3da2cf35e19c717cb85d6ddf9ba576b99d21cf46806d5e83ebc30dc |
| scripts/phase9/catalog-import-0061-upgrade-postgres-rehearsal.sql | present | 28021 | b1d3464bc9b20a6bc432082b8b01832b980ea231338427fa1e187c238dcd7919 |
| scripts/phase9/catalog-curation-0062-upgrade-postgres-rehearsal.sql | present | 22993 | 64102fcd36e69ff58ab957c94866e215f2f72900758bc98926a46057230e45e9 |
| scripts/phase9/lib.mjs | present | 22873 | 2432468891aa67b138785021580caadcc27ab5d1c7aca8c5015e1ddc531d021c |
| scripts/phase9/release-qa-integrity.mjs | present | 56470 | ff2f7724d4cc0bdd4058f76acb8c31ea3b4d2e80a1e1dba531066a1750b727db |
| scripts/launch/governed-evidence-chain.mjs | present | 64289 | e0ca8221da0ed5561fb68ae32c1eec28fc0291dd94518ddaeabb5e191c58ca1a |
| scripts/launch/governed-evidence-chain.test.mjs | present | 35870 | 93dc7808c2e81f47fa1e5fb317c60050932955a236d135467ae2bcdfb1e7fddd |
| scripts/phase9/build-evidence-chain-ledger.mjs | present | 17702 | 69308cd626980aba6c12b636ff82230f9c40c1bb1d9d6b9fc10e71678abfc225 |
| scripts/phase9/build-evidence-chain-ledger.test.mjs | present | 10841 | acb29bedcdd9c9a524dd80d7c61a70da5d887f12abab4fa1da111f72cd0df3de |
| docs/HUMAN_SIMULATED_E2E_TESTING.md | present | 10413 | 109f35402903500e5bc61054e52bf8f0dbe090d3ade395d96303ea008bb7bc50 |
| docs/E2E_TESTING_CHECKLIST.md | present | 6998 | 34248253ee5234d7a92a7733f4579a191ff3bd398152da8941886ab79a786026 |
| docs/USER_FLOW_TREE.md | present | 479007 | c9bea260d50a17c937c8cf0f0765cc30d3c0eb073a962db0fc9cf132a76dc0d9 |
| docs/hugeToDo/CAT-07-SHELF-FRESHNESS-SOURCE-CHECKPOINT-2026-07-19.md | present | 16940 | ca7efbb26ae9a36e1936b04c50f03b92acdac8e930fa81fb022f6483dd5cf77a |
| docs/e2e/generated/human-e2e-manifest.json | present | 299477 | d6780e5d700152200cdc68759b9358403b6304dc5ebd230f44cce321788200c0 |
| docs/e2e/generated/human-e2e-manifest.md | present | 2244721 | a83cb0e8cfbfb3aae9ab087c17b77844a9ea32ee9bf465fcfb85dc1008f4c3dd |
| test-results/human-e2e/2026-08-08/cat07-shelf-freshness-current/summary.json | missing |  |  |
| docs/phase-5/generated/device-qa-packet.json | present | 112286 | d4e45943f61b1a7675e5f03a2d1aa3bc9603916b5a8b45b99b8c4ae0a695dafb |
| docs/phase-5/generated/device-qa-packet.md | present | 66218 | efd4b42003b0ea5916544abe6b6bfcf6e47dfe9790218996c312a546694ca5df |
| docs/phase-6/generated/payments-qa-packet.json | present | 90232 | 7f7b80ceb90c64238f79386c2fa61a1277664b8079e1348108fd85100762ffd7 |
| docs/phase-6/generated/payments-qa-packet.md | present | 38699 | 459fd0d57f7bef61ccf07c70d072e9dd6ba7cde766b86bc25207964d55af7f2b |
| docs/phase-7/surface-inventory.md | present | 15505 | 3210ece9e29d343560a8fcbe7c98bff1334808e77a1a0491931186e3d3146ca0 |
| docs/phase-7/launch-claim-matrix.md | present | 4516 | 62de4afeb06ae6a2731d193354aa0e29d2d7bb57d0bc36f5671a6efede751a19 |
| docs/phase-7/beta-evidence-dashboard.md | present | 4972 | 8018b3cfa5f4c3c5092308a75854ac29e32f3a0c16deefc7f842eaa6e98a243e |
| docs/phase-7/core-loop-qa-checklist.md | present | 67403 | 3ef5e70d2f996c3fea9a343b1da4a3b288326475af3c64abd05eecaff88baf6d |
| docs/phase-7/phase-7-exit-review.md | present | 6145 | fb918b17f206b18ef47a7335f38de749c056a9748f2080d00d0ec56cca89419d |
| docs/phase-8/public-site/share.html | present | 1634 | 45bced7d455386121e569aff4bf40b20dfccda7e54b4cd62560a313d2031c834 |
| docs/hugeToDo/PHOTO-05-TREND-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md | present | 21451 | 74235e8ab2c228f6f97baf0a18081e7b4219a7d91859c2ae28d4be2e23ba30da |
| docs/06-photo-progress.md | present | 49458 | ac72f41a97294ddf25a9ed6b84442d2112f3facff36707ab0ebeda1853be93b5 |
| docs/12-ai-trend-analysis.md | present | 68321 | 87041be91399b2cee40486fec7d8a360e522bdbbd7ca2f62fcccd240fc837ed6 |
| docs/MASTER_PLAN.md | present | 69870 | 9cd41d4a19e5932677dc69cd077178316ce34b26a9f6921df02d578343996e99 |
| docs/DECISIONS.md | present | 94119 | f2862262e79bff5df0a480f66510547745a765038a9e4bec4eec6a119edda7fb |
| docs/FEATURE_INDEX.md | present | 9140 | 04a1be15af74e79b7cf193dd77618e62573048d44741d4e2b1df037accc6870c |
| docs/ROADMAP.md | present | 8546 | fb13e339e545ceb4aca975be741f7bdf01880bd4bbd3cb821c7fb812890ff3de |
| docs/hugeToDo/README.md | present | 66552 | 6070f6a29246c30f016c4e57159d82d424e0b5c89a9780d007415b64469090ab |
| scripts/launch/contract-smoke.mjs | present | 10643 | 98beaccf94d02705a36e67c716af69a194897a6ec52c0edade49f3432bcd7de2 |
| scripts/launch/check-contract.mjs | present | 1450 | f00772997c9bc422a77001d27d7eb5ab167f24b5e1074b641f87643bad99b4f3 |
| .env.example | present | 29662 | d9825f22149f8d15e491d4f1d97fbc8311ce739564a36e1f0ed0ecc64464e091 |
| apps/mobile/src/lib/consent/dependentConsentContract.ts | present | 9011 | a3cedb9ee93cea5d43700dac093d528225652d32096dbd1286d8b5d85e59070c |
| apps/mobile/src/lib/consent/dependentConsentContract.test.ts | present | 2510 | a7faed8bd978c885bcaba4810d595341a08477233092572a02fbdd5a852bdcee |
| apps/mobile/src/lib/consent/dependentConsentLifecycle.ts | present | 25851 | ba0c425416000beb7aeebcacd90d792e7ae9bb7da1f93203d0fa6cdf06370baf |
| apps/mobile/src/lib/consent/dependentConsentLifecycle.test.ts | present | 17433 | 10a4c82b11f68a11128bd2491d042e0745f777603278e3daaf5fa06209a4dac4 |
| apps/mobile/src/app/progress/about.tsx | present | 2293 | 07c9a1c90a494edff2c67d626312e6e6889523365b5c9900073fcb6e5eb6cdec |
| apps/mobile/src/features/trend/applyConsentChoice.ts | present | 637 | 3b960048debd59e0a0669167c408025159ad67cfd3f62076700fe78bcd429124 |
| apps/mobile/src/features/trend/applyConsentChoice.test.ts | present | 1828 | 45a12c3ef0f7cb17830606f98365e59b77111f7e9e45241f2c1aa1539c80c14e |
| apps/mobile/src/features/trend/claimsafety.test.ts | present | 5938 | befd6084fe86e36523f416182136fa05020498b18918bf9cded0910d55baf4f0 |
| apps/mobile/src/features/trend/consent.ts | present | 1227 | a4e37054dfc470c935ec45249c8f2bb58d75d5c55407dc3b238b9f1d6e055106 |
| apps/mobile/src/features/trend/consent.test.ts | present | 2518 | c8d5b14e464359308cc39cf16f880e77cff2184e0f0da36814256d9d937fb3ce |
| apps/mobile/src/features/trend/store.ts | present | 2125 | 542844e451dba6540df09c617698ceba0d31a0b38bbbcc799c1bc7ebd25d184f |
| apps/mobile/src/features/trend/store.test.ts | present | 2472 | 6fbdfe52251541ee60192f193228b44a59e584ca581cb875df62fedf72e62300 |
| apps/mobile/src/features/trend/trend.ts | present | 3601 | 7a42b3df6ac4047f440c89929bf7f7e2bfad6bd40a97c9ffdb373c84788275d1 |
| apps/mobile/src/features/trend/trend.test.ts | present | 3224 | 797f4e43ac5724fce8c6df388bdd6c84514ff8a10626f6c7866b8fb47bf3733b |
| apps/mobile/src/features/trend/TrendInsight.tsx | present | 462 | 0cb5fe60f475a09c85e89b5aea4dd8a5f0092b90f87191605c958f8d760723c5 |
| apps/mobile/src/features/trend/useTrend.test.ts | present | 3959 | 0900e378011668323b49eb2cd6a2054dfd7393ed62efa808badce8cf7fe72f72 |
| apps/mobile/src/features/photos/copy.ts | present | 7664 | f966ccfece22b84190631f02d863aba85d601e2cf41b62532f8be0a1a9cc02ee |
| supabase/migrations/20260613000024_photo_trend.sql | present | 4734 | af7618e6a91895b4d68f053f23f8321c38a4bdd33d1652488f7437720d4c05ce |
| scripts/photo05/trend-admission-source-contract.mjs | present | 28244 | 97d3850c9474e889c112e1c0904ac9f16ede01f537165f78ff579373176f963a |
| scripts/photo05/trend-admission-source-contract.test.mjs | present | 10427 | 5aaf71a04757e216e5d89196fa13c049f87bb551d0e052f4946c8b3ca5d6bd20 |
| scripts/phase9/build-release-qa-packet.mjs | present | 62156 | 05585070fd0e8d03dc843274860b7d676ee1d1f56b7cca222dcf49d3daa31ab1 |
| scripts/phase9/release-smoke.mjs | present | 76062 | 34f6cfc6199b3274f74b9fdbbe127d5b34b9175eff78bece3ff92bd7b3e64f08 |
| scripts/phase9/release-qa-integrity.test.mjs | present | 35031 | dc21754b7660bf356633471ad8479a26626d7dad046b7876c2c39902c2831dec |
| BLOCKERS.md | present | 103634 | 4029955acb06343cdc43f0d031708cca8a67db15043f4bf3c01ccd465fb681d6 |
| PROGRESS.md | present | 526630 | b6d6947c8d7eae9dd718d8594249ae2b2e4b9452acbaf2ae732e1070d9b26669 |
| apps/mobile/src/app/commerce/_layout.tsx | present | 101 | f9c006f08624e8f8f3a6fc2a2ba015a71d5c2954af82aae09b2d6185c6283abb |
| apps/mobile/src/app/commerce/consent.tsx | present | 178 | a2453382e5b3d1eed13160b4a27f675dd3f563fbbed7e3eba4a9f7d9f2fb6749 |
| apps/mobile/src/app/commerce/stack/[slug].tsx | present | 176 | 37f630992967de1c4b87cf6e59599df93b2bb331afd87b63cacf60c1d64e14fa |
| apps/mobile/src/app/commerce/stacks.tsx | present | 177 | 45a849bb0d637007e1a4a3f0bd96bd928e77cfd8b2f12142c049f252ee698b4e |
| apps/mobile/src/app/commerce/transparency.tsx | present | 183 | 391fa84fa5a3085da65bdcbeb50c6470912de8616826ab2f7aaee24258e79989 |
| apps/mobile/src/features/commerce/CommerceDeferredSurface.tsx | present | 449 | b57b799ec43cecce12b7d9c9155d81288a62fdd4af2a6f520ad99e1b57b668e5 |
| apps/mobile/src/features/commerce/CommerceLinkNotice.tsx | present | 751 | 911862ba2aa65e417f186c920738dc977ab3acb65fddc46ad9682b32b31ad2f7 |
| apps/mobile/src/features/commerce/LockGlyph.tsx | present | 1284 | a6a4bc8696bc94c4fd5acc0a39226a258607b3778dd21f90bb23bd22fe0c9ca8 |
| apps/mobile/src/features/commerce/admission.ts | present | 70 | 32feaa31a53d5d322da4ca4eb3b38a5968458d04c28df95afdcfe8d4ad96a10d |
| apps/mobile/src/features/commerce/attribution.test.ts | present | 2320 | a5511bee657ada9d14cfb0e680ed6763ea37bf02365440cb1e19d77353ecf315 |
| apps/mobile/src/features/commerce/attribution.ts | present | 1544 | 851b6e522d79437bbd905b0c03e105e9734702dbd5915c81144e6b553059a636 |
| apps/mobile/src/features/commerce/claimsafety.test.ts | present | 4273 | e1c8afd3b5f869a2d95acbb0c0a17a5cfcc902a91d3f5072fec5f4b6b55c5856 |
| apps/mobile/src/features/commerce/commerce.test.ts | present | 2844 | 6db2503af9f9cd26612945dfa2e1184dbaa95f63bd1ef0393d6feaa38b9bb76a |
| apps/mobile/src/features/commerce/consent.test.ts | present | 2287 | 29d6cee0db17a8ccf62b2f62c633a59b57e9f45029dbf1f8f5f5ce351f070226 |
| apps/mobile/src/features/commerce/consent.ts | present | 1095 | 80f0f30cacc7c0de3393568bb6fa4c23c703eccdba0c658788732cb1a66a73bd |
| apps/mobile/src/features/commerce/consentLogic.ts | present | 336 | 613f344902c702ae413107b040b3c2c1b0069b58325771c44968dc38ffed6777 |
| apps/mobile/src/features/commerce/copy.ts | present | 4650 | f4d72943b0215a0a54b477c832c4119a6253c748b267ed3079473828a3622be0 |
| apps/mobile/src/features/commerce/disclosureOperation.test.ts | present | 1066 | 2afd4c867d9bbccc27834a4573d2a88bd90c9681122bcbe74135a9fe03a9f757 |
| apps/mobile/src/features/commerce/disclosureOperation.ts | present | 495 | 24008712afbcc370df59388af3a08f7e723cd7089aefb7e73c73a4a1073d936e |
| apps/mobile/src/features/commerce/links.ts | present | 1611 | 1071bb1ed8a663933c60f28259508d11430183a856d41eb11a94e03e2855f835 |
| apps/mobile/src/features/commerce/stacks.ts | present | 1130 | 2667228595d6cd89a5af8062966bac5a8430fe374a09e64fd3b2958e118abe92 |
| apps/mobile/src/features/commerce/store.test.ts | present | 1806 | 063010b209abf21b229a99fe8ce3faae2043d8c5c31f8192fae5c53c7eede8d4 |
| apps/mobile/src/features/commerce/store.ts | present | 973 | 1a0ab8d62ee4e74367cb9920792454760403282bd158ba70433b7d35268bc32a |
| apps/mobile/src/features/commerce/useCommerce.ts | present | 698 | 09521e1e075a97111e59d0e32a55a9d0db9ad18987bfd3304a4726bbc719d92e |
| docs/10-creator-stacks-build-spec.md | present | 23889 | 5150c750d59824ad1e87be5b2f756556cffe59e4e688c911c30e5dae4a095b6e |
| docs/hugeToDo/COM-01-COMMERCE-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md | present | 13005 | 16e3c7d306dadce9e191c2eec4aedebc1179549c50a3f27ad791da7a6a887d0e |
| scripts/com01/commerce-admission-source-contract.mjs | present | 41547 | af9e410a976ff9f5f9aee7e2a988ea2441f660b85212cd345625ccb015db35df |
| scripts/com01/commerce-admission-source-contract.test.mjs | present | 18887 | 5d45088061bf38b49ebf30cd41403c18e454643b89c7ce48a3ada5c805a42329 |
| supabase/functions/order-report-poll/index.ts | present | 1125 | 5747e2e536851e325fcb25ca3c9f0cefa81fc0c0f94c6c34791b89b5651adc8c |
| supabase/functions/order-report-poll/orderAttributionCore.ts | present | 10537 | 434abcf6f1f7424d503fcec137bd799dc66b520c26d0e76bd36d0820f1dfa7f0 |
| supabase/migrations/20260729000072_commerce_zero_admission.sql | present | 6320 | a209915c6f3b860fdf06f2eacd46c8f10221078b042257fcdcb2b37578e45806 |
| supabase/tests/database/commerce_zero_admission.test.sql | present | 13495 | cd12a7fa92ae52d4abd6155c0b7b9bafc8208be1d24054b434c02d811720249e |
| supabase/tests/upgrade/commerce_zero_admission_0072_upgrade.test.sql | present | 11866 | 0765f0c0b926a1a20297f94d6604d0f7557c0815315b36e3c115dbc5162c6f7b |

## Blockers

- Phase 7 source snapshot: package.json working bytes do not match pinned HEAD.
- Phase 7 source snapshot: docs/hugeToDo/CORE-06-RECOMMENDATION-ADMISSION-SOURCE-CHECKPOINT-2026-07-26.md working bytes do not match pinned HEAD.
- Phase 7 source snapshot: docs/hugeToDo/CORE-07-SHARE-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md working bytes do not match pinned HEAD.
- Phase 7 source snapshot: docs/09-personalized-recommendations.md working bytes do not match pinned HEAD.
- Phase 7 source snapshot: scripts/core06/recommendation-admission-source-contract.test.mjs working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/lib/env.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/lib/launch/phase7.test.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/lib/launch/phase8.test.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/app/cycle/settings.tsx working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/app/recommendations/[id].tsx working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/app/recommendations/index.tsx working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/app/recommendations/preferences.tsx working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/app/shelf/opened.tsx working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/app/shelf/scan.tsx working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/ask/answer.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/catalog/client.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/growth/shareAdmission.test.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/growth/publicLinkAdmission.test.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/growth/shareProjection.test.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/growth/shareLinks.test.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/growth/cardCopy.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/growth/cardCopy.test.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/notifications/copy.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/notifications/store.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/notifications/store.test.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/onboarding/serverSkinProfile.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/onboarding/serverSkinProfile.test.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/recommendations/claimsafety.test.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/recommendations/catalog.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/recommendations/copy.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/recommendations/engine.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/recommendations/engine.test.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/recommendations/fit.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/recommendations/fit.test.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/recommendations/goalAdmission.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/recommendations/goalProvenance.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/recommendations/preferences.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/recommendations/replenishment.test.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/recommendations/store.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/recommendations/store.test.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/routine/activationAnalytics.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/routine/activationAnalytics.test.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/scheduler/cycleStore.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/scheduler/cycleStore.test.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/scheduler/orchestrate.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/scheduler/orchestrate.test.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/scheduler/profile.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/scheduler/useCycle.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/shelf/freshness.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/shelf/freshness.test.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/shelf/paoProvenance.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/shelf/store.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/shelf/store.test.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/today/completionsStore.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/today/completionsStore.test.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/trend/copy.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/lib/consent/healthProcessingEpoch.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: packages/types/src/index.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: packages/types/package.json working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/lib/supabase/client.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: scripts/phase7/check-core-loop-smoke.mjs working bytes do not match pinned HEAD.
- Phase 7 source snapshot: scripts/e2e/human-e2e-manifest.mjs working bytes do not match pinned HEAD.
- Phase 7 source snapshot: scripts/e2e/human-e2e-manifest-contract.test.mjs working bytes do not match pinned HEAD.
- Phase 7 source snapshot: scripts/e2e/cat07-png-contract.mjs working bytes do not match pinned HEAD.
- Phase 7 source snapshot: scripts/e2e/cat07-shelf-freshness-audit.mjs working bytes do not match pinned HEAD.
- Phase 7 source snapshot: scripts/launch/governed-evidence-chain.mjs working bytes do not match pinned HEAD.
- Phase 7 source snapshot: scripts/launch/governed-evidence-chain.test.mjs working bytes do not match pinned HEAD.
- Phase 7 source snapshot: scripts/phase9/build-evidence-chain-ledger.test.mjs working bytes do not match pinned HEAD.
- Phase 7 source snapshot: docs/HUMAN_SIMULATED_E2E_TESTING.md working bytes do not match pinned HEAD.
- Phase 7 source snapshot: docs/USER_FLOW_TREE.md working bytes do not match pinned HEAD.
- Phase 7 source snapshot: docs/hugeToDo/CAT-07-SHELF-FRESHNESS-SOURCE-CHECKPOINT-2026-07-19.md working bytes do not match pinned HEAD.
- Phase 7 source snapshot: test-results/human-e2e/2026-08-08/cat07-shelf-freshness-current/summary.json does not exist as a blob in pinned HEAD.
- Phase 7 source snapshot: test-results/human-e2e/2026-08-08/cat07-shelf-freshness-current/summary.json is missing in the working tree.
- Phase 7 source snapshot: docs/phase-5/generated/device-qa-packet.json working bytes do not match pinned HEAD.
- Phase 7 source snapshot: docs/phase-5/generated/device-qa-packet.md working bytes do not match pinned HEAD.
- Phase 7 source snapshot: docs/phase-6/generated/payments-qa-packet.json working bytes do not match pinned HEAD.
- Phase 7 source snapshot: docs/phase-6/generated/payments-qa-packet.md working bytes do not match pinned HEAD.
- Phase 7 source snapshot: docs/phase-7/core-loop-qa-checklist.md working bytes do not match pinned HEAD.
- Phase 7 source snapshot: docs/hugeToDo/PHOTO-05-TREND-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md working bytes do not match pinned HEAD.
- Phase 7 source snapshot: docs/06-photo-progress.md working bytes do not match pinned HEAD.
- Phase 7 source snapshot: docs/12-ai-trend-analysis.md working bytes do not match pinned HEAD.
- Phase 7 source snapshot: docs/MASTER_PLAN.md working bytes do not match pinned HEAD.
- Phase 7 source snapshot: docs/DECISIONS.md working bytes do not match pinned HEAD.
- Phase 7 source snapshot: docs/hugeToDo/README.md working bytes do not match pinned HEAD.
- Phase 7 source snapshot: .env.example working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/lib/consent/dependentConsentContract.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/trend/claimsafety.test.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/trend/store.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/trend/store.test.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/trend/trend.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/photos/copy.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: scripts/phase9/build-release-qa-packet.mjs working bytes do not match pinned HEAD.
- Phase 7 source snapshot: scripts/phase9/release-smoke.mjs working bytes do not match pinned HEAD.
- Phase 7 source snapshot: scripts/phase9/release-qa-integrity.test.mjs working bytes do not match pinned HEAD.
- Phase 7 source snapshot: BLOCKERS.md working bytes do not match pinned HEAD.
- Phase 7 source snapshot: PROGRESS.md working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/commerce/attribution.test.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/commerce/claimsafety.test.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/commerce/copy.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/commerce/links.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/commerce/stacks.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/commerce/store.test.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: apps/mobile/src/features/commerce/store.ts working bytes do not match pinned HEAD.
- Phase 7 source snapshot: docs/10-creator-stacks-build-spec.md working bytes do not match pinned HEAD.
- Phase 7 source snapshot: docs/hugeToDo/COM-01-COMMERCE-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md working bytes do not match pinned HEAD.
- Governed evidence chain: the governed evidence source must be one lowercase 40-character Git SHA.
- Governed evidence chain: the governed evidence release candidate must be one strict immutable RC directory.
- Phase 5 upstream packet: pinned Phase 5 device QA packet must contain an empty blockers array.
- Phase 5 upstream packet: pinned Phase 5 device QA packet required QA evidence inventory is not exact and passing.
- Phase 5 upstream packet: pinned Phase 5 device QA packet does not contain completed named native-device signoff.
- Phase 5 upstream packet: pinned Phase 5 device QA packet widgetLifecycleEvidence is not pass.
- Phase 5 upstream packet: pinned Phase 5 device QA packet cameraLifecycleEvidence is not pass.
- Phase 5 upstream packet: pinned Phase 5 device QA packet performanceEvidence is not pass.
- Phase 5 upstream packet: pinned Phase 5 device QA packet required native OCR evidence is not pass.
- Phase 5 upstream packet: pinned Phase 5 device QA packet fresh governed evidence-chain audit is not pass.
- Phase 5 upstream packet: pinned Phase 5 device QA packet fresh governed evidence-chain audit is not pass.
- Human-E2E upstream manifest: human-E2E manifest status is not pass.
- Human-E2E upstream manifest: human-E2E manifest blockers must be one empty array.
- Human-E2E upstream manifest: human-E2E required gate iphone-375-667-200-text-pressure is not pass.
- Human-E2E upstream manifest: human-E2E required gate iphone-375-200-text-pressure is not pass.
- Human-E2E upstream manifest: human-E2E required gate modern-390-200-text-pressure is not pass.
- Human-E2E upstream manifest: human-E2E required gate boundary-414-896-200-text-pressure is not pass.
- Human-E2E upstream manifest: human-E2E required gate modern-430-200-text-pressure is not pass.
- Human-E2E upstream manifest: human-E2E required gate skipped-routes-375-667-200-text-pressure is not pass.
- Human-E2E upstream manifest: human-E2E required gate skipped-routes-390-844-200-text-pressure is not pass.
- Human-E2E upstream manifest: human-E2E required gate skipped-routes-430-932-200-text-pressure is not pass.
- Human-E2E upstream manifest: human-E2E required gate account-upgrade-supported-phone is not pass.
- Human-E2E upstream manifest: human-E2E required gate account-isolation-supported-phone is not pass.
- Human-E2E upstream manifest: human-E2E required gate account-deletion-durable-recovery-expo-web-stress is not pass.
- Human-E2E upstream manifest: human-E2E required gate health-consent-withdrawal-expo-web-compatibility is not pass.
- Human-E2E upstream manifest: human-E2E required gate cat04-catalog-recovery-supported-phone is not pass.
- Human-E2E upstream manifest: human-E2E required gate cat05-native-ocr-review-supported-phone is not pass.
- Human-E2E upstream manifest: human-E2E required gate progress-timelapse-supported-phone is not pass.
- Human-E2E upstream manifest: human-E2E required gate progress-capture-analysis-supported-phone is not pass.
- Human-E2E upstream manifest: human-E2E required gate progress-device-only-backup-supported-phone is not pass.
- Human-E2E upstream manifest: human-E2E required gate progress-direct-route-lock-supported-phone is not pass.
- Human-E2E upstream manifest: human-E2E required gate progress-storage-recovery-supported-phone is not pass.
- Human-E2E upstream manifest: human-E2E required gate private-envelope-corruption-supported-phone is not pass.
- Human-E2E upstream manifest: human-E2E required gate pregnancy-safety-status-supported-phone is not pass.
- Human-E2E upstream manifest: human-E2E required gate multi-active-plan-today-supported-phone is not pass.
- Human-E2E upstream manifest: human-E2E required gate routine-order-persistence-supported-phone is not pass.
- Human-E2E upstream manifest: human-E2E required gate conflict-choice-schedule-supported-phone is not pass.
- Human-E2E upstream manifest: human-E2E required gate cycle-disruption-reconciliation-supported-phone is not pass.
- Human-E2E upstream manifest: human-E2E required gate authored-cycle-customization-supported-phone is not pass.
- Human-E2E upstream manifest: human-E2E required gate cat07-shelf-freshness-supported-phone is not pass.
- Human-E2E upstream manifest: human-E2E required gate required-surface-honesty-supported-phone is not pass.
- Human-E2E upstream manifest: human-E2E required gate trend-route-group-gate-supported-phone is not pass.
- Human-E2E upstream manifest: human-E2E required gate data-export-local-photo-disclosure-supported-phone is not pass.
- Human-E2E upstream manifest: human-E2E required gate data-export-combined-device-supported-phone is not pass.
- Human-E2E upstream manifest: human-E2E required gate data-export-account-generation-supported-phone is not pass.
- Human-E2E upstream manifest: human-E2E manifest fresh governed evidence-chain audit is not pass.
- Human-E2E upstream manifest: human-E2E manifest Git SHA does not match its governed current Git SHA.
- Human-E2E upstream manifest: fresh governed evidence-chain audit is not pass.
- Missing test-results/human-e2e/2026-08-08/cat07-shelf-freshness-current/summary.json.
- CORE-07A share publication is not admitted; no runtime flag, final domain, reviewedBy field, or QA flag may substitute for a positive immutable exact-content share receipt.
- CORE-07A public links are not admitted; no token service, reviewed retention/revocation/deletion/abuse contract, or exact-destination confirmation is available.
- PHOTO-05A Trend insights remain literal-zero-admission; no environment, development, E2E, caller, fixture, legacy state, simulated metric, consent grant, QA flag, or stored row may substitute for a validated on-device engine and issuer-bound result.
- COM-01A commerce remains literal-zero-admission; no environment, domain, development/E2E mode, consent or legacy state, catalog row, reviewer string, affiliate URL, server credential, QA flag, or stored row may admit publication, partner polling, click recording, analytics, or retailer navigation.
- CAT07 committed evidence: test-results/human-e2e/2026-08-08/cat07-shelf-freshness-current/summary.json must exist in HEAD.
- CAT07 full evidence contract: full CAT07 manifest validator failed: FAIL committed CAT07 full evidence contract: test-results/human-e2e/2026-08-08/cat07-shelf-freshness-current/summary.json must exist in the pinned HEAD.
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

- Phase 7 core-loop QA packet generated with a dirty Git worktree; do not use it as final core-loop evidence.
