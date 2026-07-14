# Generated Phase 7 Core Loop QA Packet

Generated at: 2026-07-14T00:14:12.891Z
Git SHA: 440d7da1565811d3f8f14a1aa06d51edec5760d9
Git status: clean

Strict completion requires real brand/legal clearance, Supabase RLS evidence, clinical review, catalog import evidence, device QA, RevenueCat QA, privacy/export/delete QA, analytics dashboard readiness, and a named owner.

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
| Shelf intake | add owned products via manual/search/scan-or-OCR with source/confidence visible; exact-date intake rejects impossible/future dates; label PAO requires explicit open-jar confirmation; surfaced expiry provenance matches the winning date; reload preserves the lifecycle; re-add archives the prior unit, retains product/PAO provenance, and drops its printed expiry; replenishment alerts remain off until explicit opt-in | `PHASE7_SHELF_INTAKE_QA_PASS` | BLOCKED |
| Reviewed guidance | reviewed conflict shows evidence and sequence guidance; unreviewed conflict stays hidden | `PHASE7_REVIEWED_GUIDANCE_QA_PASS` | BLOCKED |
| Routine builder | AM/PM routine persists across restart, offline, timezone rollover | `PHASE7_ROUTINE_BUILDER_QA_PASS` | BLOCKED |
| Today check-off | offline/online check-off is idempotent and append-only | `PHASE7_TODAY_CHECKOFF_QA_PASS` | BLOCKED |
| Photos | baseline capture renders locally; app lock gates timeline; settings and Progress show device-only storage with no backup control or automatic upload | `PHASE7_PHOTOS_PRIVACY_QA_PASS` | BLOCKED |
| Reminders | permission, quiet hours, Android 13+ permission, timezone/DST behavior verified | `PHASE7_REMINDERS_QA_PASS` | BLOCKED |
| Payments | RevenueCat purchase, restore, cancellation, expiration, refund, and webhook lifecycle verified | `PHASE7_PAYMENTS_LIFECYCLE_QA_PASS` | BLOCKED |
| Privacy controls | export, account deletion, health-data withdrawal, app lock, support links verified | `PHASE7_PRIVACY_CONTROLS_QA_PASS` | BLOCKED |
| Share card | exact owned reviewed conflict only; no fallback; no sensitive analytics payload | `PHASE7_SHARE_CARD_QA_PASS` | BLOCKED |
| Deferred surfaces | commerce/community posting/trend/cloud Ask/widgets/share hidden unless gates enabled | `PHASE7_DEFERRED_SURFACES_QA_PASS` | BLOCKED |
| Analytics | activation, retention, payment, privacy, support, and deferred-surface events visible | `PHASE7_ANALYTICS_QA_PASS` | BLOCKED |

## Files

| Path | Status | Bytes | SHA-256 |
| --- | --- | --- | --- |
| package.json | present | 22309 | a16ee01cccdf30fd34b0b956590cf4c750ab927f89db8f507e0df10010663b4e |
| docs/hugeToDo/launch-contract.json | present | 2935 | 43bea3c862d7e36c7e8d744b87bcf21f65d721500e71e1f1cfa7492fbb14ee4b |
| scripts/launch/contract.mjs | present | 6676 | 6a3ced1c0e7e54ef7db31e848aeeebd3617a77db02c3b51c98d6ee3789a9007d |
| apps/mobile/src/lib/launch/phase7.ts | present | 6185 | 875babca48f518e13c897550ae2b0feb66346ba700f8ffba8aad9560f07b1d46 |
| apps/mobile/src/lib/launch/phase7.test.ts | present | 8407 | 2d633e139d356fdce0e6b966e1675a017fcc4b4a0ddbc5679149fc942331681f |
| apps/mobile/src/components/launch/DeferredSurface.tsx | present | 2320 | 6ff85a7cc8ac36e0566673132a0abef71e0e65e99af158c3439b61c9bb4b98b2 |
| apps/mobile/src/components/launch/DeferredSurface.test.ts | present | 1224 | 28c8db73d114e25fb69fa533df1020bcfbf91df1e31036b12ee91040ff24c60d |
| apps/mobile/src/lib/navigation/safeBack.ts | present | 1487 | a2e3143f42c223bb14acb27e97182a8582dc85342f44a8960c0c4adf4795ec12 |
| apps/mobile/src/lib/navigation/safeBack.test.ts | present | 3715 | 126a5f0b64f09192e20052bfa87f2f327ffab2831b3cc9a287882023ae7cd203 |
| apps/mobile/src/app/(tabs)/today.tsx | present | 32816 | c1f1d270ed129521e39147d536b2d98da36945bab0a1f6d169473bd78884c501 |
| apps/mobile/src/app/(tabs)/progress.tsx | present | 20519 | d009aa555a3230ad67a41dfdc2cbeb184b9684757b97085346fe5362e57c7125 |
| apps/mobile/src/app/(tabs)/shelf.tsx | present | 16085 | bfc542c49770247668411df13067245b1b5310bf23e48e19bdfc4dd5673e45be |
| apps/mobile/src/app/(tabs)/you.tsx | present | 37329 | ef9b7c6e0e1e848d60577c19a936d91d228421de548af6f157a762ac38f303bf |
| apps/mobile/src/app/_layout.tsx | present | 2918 | 0cdfb18b35b11fb1080241b1ffcc90fb291b0eac85b7a89c152da2b202ed17db |
| apps/mobile/src/app/cycle/settings.tsx | present | 27252 | 0ecdd558bf0120bd4a3906899313ae9aefe7ad3452c761c742b428099fea4c4f |
| apps/mobile/src/app/cycle/week.tsx | present | 13901 | 264a6d9fa2ce28abbb132d61b80739da5eb196990ef47867e1e6c3444e93b868 |
| apps/mobile/src/app/cycle/why-tonight.tsx | present | 8646 | 758245963dc29153bcb362353c3f375249b4fb0cde6ff60f5df2826875d444f2 |
| apps/mobile/src/app/onboarding/products.tsx | present | 15483 | ae461d520feb9894e38ce46222b47963d9f31f9077933eb03142e53898ea72ba |
| apps/mobile/src/app/routine/plan.tsx | present | 19392 | e0aa50b301550896c7fd6c963ccd0fa23aa9282927d00e5ed2e917a3ace8c006 |
| apps/mobile/src/app/share/conflict/[ruleId].tsx | present | 7123 | 0bd46e014ebcb0e3f2affaacfda83b2685137028564bca5a717fa7ac81f038db |
| apps/mobile/src/app/trend/_layout.tsx | present | 1091 | 84e2ebdcabfebf7ae274c6742f44841410376ff6dc62888561ffa52b4fe7b9ed |
| apps/mobile/src/app/trend/fairness.tsx | present | 4963 | 7e4654db068f93519165002135b21efc3c275c097d970a4960890657662fc8e0 |
| apps/mobile/src/app/trend/optin.tsx | present | 526 | 59e11ac2d24b435b45b77a07030733ec5bfc93bddeac993f23d915a02a6058b5 |
| apps/mobile/src/app/conflict/[ruleId].tsx | present | 32130 | f7dcd9e72e5d7209686a12708eea38498ce4d4d39b57f497bc37b127c834f6b8 |
| apps/mobile/src/app/shelf/[id].tsx | present | 37135 | dfae778efed66e57e151c5bfc14e00c7ce473fd2b4ec02002d90ff27e18770fd |
| apps/mobile/src/app/shelf/_layout.tsx | present | 916 | 9cd36d104cc8929fc4cf6bf7b9a805b904c3820df627fe160989a3924c6b27d4 |
| apps/mobile/src/app/shelf/add.tsx | present | 337 | 69027d3b5ac294d2632ceba04a4f075dfdfe624566466415059e5e74f37c0aa7 |
| apps/mobile/src/app/shelf/archive.tsx | present | 4585 | 5629481e04a349322eeff9bfd7633771689e532bb3b3109dfd1f969ad58f90ad |
| apps/mobile/src/app/shelf/manual.tsx | present | 13837 | 52ca7524948f5ad3a7485ce7be8be97d14d25ae55119f010ff1513baef291227 |
| apps/mobile/src/app/shelf/no-match.tsx | present | 10788 | 5afd8d6e4192c4b13e6926f4562d506252ebd72ade46b83f8f54314da66f69a7 |
| apps/mobile/src/app/shelf/ocr.tsx | present | 16348 | b50aa03a149f978434829bc60bcfa9c6bc599d9c7c41cac1a59cb16b5c8da321 |
| apps/mobile/src/app/shelf/opened.tsx | present | 12059 | cac7cfabb2a28e50ebb8138cde5d7c38e0dfbb35a8142ad680697ff816e49cd0 |
| apps/mobile/src/app/shelf/replenish.tsx | present | 7631 | 5addfea202ebc15850feacc3a18c79d6216310c61a341a101c300a497cd94644 |
| apps/mobile/src/app/shelf/scan.tsx | present | 23220 | 81712f3391afccaadd7f86d1f3ccd546d696e842654fbd01fb3cc9cf9df0eb6c |
| apps/mobile/src/app/shelf/search.tsx | present | 15482 | 01ae00b96fa0a378ae140b8f54c342a268e5b34c0e32e0a76349e4b9493176d6 |
| apps/mobile/src/features/ask/answer.ts | present | 11305 | 62e8f3bca768b462c74117b3215dfe32fdc23488a9c9219eb3a37f8394ae1971 |
| apps/mobile/src/features/ask/answer.test.ts | present | 7151 | 5cc0f7342b5839a880ee6839283a62ec2362463f65ad879c4675366436684788 |
| apps/mobile/src/features/ask/claimsafety.test.ts | present | 7602 | 2af74cb07a39bb25b0b4204c845539cb2f5d4c2835bb63a056a1cf6565063cc3 |
| apps/mobile/src/features/ask/copy.ts | present | 8534 | 3417a7d79f70df50d1a25d00aac004e7e06ca4be28313432d9c19409d31d6ca3 |
| apps/mobile/src/features/ask/useAsk.ts | present | 5305 | 43f52fa66c6ef5b79ba18fad4cf6134dd37cd3941d6a94cc7d1d44100c261ba8 |
| apps/mobile/src/features/catalog/client.ts | present | 9984 | 2700b12181daaf103dd4768c646b40a18d921c8bc0d5877f399e6ce55375078c |
| apps/mobile/src/features/catalog/client.test.ts | present | 11141 | f37eac5b03f95b060b2b5f7b1c92983a5906135541ba0422b6fa01e9752a5f4c |
| apps/mobile/src/features/commerce/WhereToBuy.tsx | present | 8380 | 236b8c3c89b38d689ee02f83f18b90638a0ada5b4659edc8235df803d6b30293 |
| apps/mobile/src/features/intelligence/pao.ts | present | 8291 | fcf9d36c694715069f527a60586ca9c0d075a00d9162263cd4b7d71f1d4baa27 |
| apps/mobile/src/features/intelligence/pao.test.ts | present | 5134 | 1304cbbd30e91abd5ec841c4f71598fe0dcb6ce5437eec6d78849e169c1742b2 |
| apps/mobile/src/features/notifications/BehaviouralTriggers.tsx | present | 3389 | acda04c36b2cc08ed4c108feef5ee7ac3ef778a1e74e9b04aeca900d37f1031c |
| apps/mobile/src/features/notifications/claimsafety.test.ts | present | 4506 | a60c1534edb7ac76c00faf543e833d5df5671685373e8475db80aa23a4d8ab5a |
| apps/mobile/src/features/notifications/copy.ts | present | 4426 | a5b7cc3a1a0a512d21e61c49b0041ac0430c0194ab8adda45c09124a45f7787b |
| apps/mobile/src/features/notifications/store.ts | present | 10712 | a378d37a92aaf8d6a916a1e1f76cdcb5c7ab9f987357931587ab2fc3089fb8e9 |
| apps/mobile/src/features/notifications/store.test.ts | present | 8192 | 23c6fa428c62edad422ac7406d3f3db129f2892248d5e39c481fe174dd84f5fe |
| apps/mobile/src/features/notifications/replenishmentOptInMigration.test.ts | present | 718 | 2b34153c9a4a85b29bbf8483217a65e4ee99b15837a50128bc7cf572c09fb4a0 |
| apps/mobile/src/features/recommendations/claimsafety.test.ts | present | 9030 | 7ad766f22ba19b9a6f9ca80bb1320ebae3c5bf970c3e850c485407db22b03068 |
| apps/mobile/src/features/recommendations/copy.ts | present | 7852 | d770279401f291b2ee903c275a1202c535f717272bc37bf7d5ef3fe1036778cb |
| apps/mobile/src/features/recommendations/engine.ts | present | 17809 | ccd83caffac064fa690bb5acbf67ec350a86398ce64f22e5f3ecc06ca691693d |
| apps/mobile/src/features/recommendations/engine.test.ts | present | 16643 | 8aaf0076f3f5df6f4c982d0ac1a62ce6835c1b6efcd6fc3f8f23ffa436126b1c |
| apps/mobile/src/features/recommendations/replenishment.ts | present | 2237 | c1283d8602f70730433bc4009a6049ffe21c369682bf2bdf3832b64766a09420 |
| apps/mobile/src/features/recommendations/replenishment.test.ts | present | 3505 | 9594da62265838c9628bc8dbfcc9eb81c24709a2510cb69fe1a88cde68b2f4cc |
| apps/mobile/src/features/recommendations/useRecommendations.ts | present | 2895 | efa71f91341a44cf26d64e3342ff3e70794988f92aa9eb95580fefa7ca59d1bc |
| apps/mobile/src/features/routine/activationAnalytics.ts | present | 4931 | 3ded53b46d47e2cf3ee2174ea9fefec84674b9ec070d4e63fa048e9fb4744202 |
| apps/mobile/src/features/routine/activationAnalytics.test.ts | present | 5638 | aac64fb8bae9f05698fb04c03ad118b73f06baa175751e07fee71366c1b186f4 |
| apps/mobile/src/features/scheduler/cadence.ts | present | 1364 | f7164eef26e124c398c3f79e3088c7500c2e35adc41f02ac47abdf675bab3b21 |
| apps/mobile/src/features/scheduler/customCycle.ts | present | 13146 | 3e6fc08ddf8813933f5e07216fc04c411d7683a44f3761b33b82132f95ee9cda |
| apps/mobile/src/features/scheduler/customCycle.test.ts | present | 9291 | 9cec61bc36016b5c2acc6afeaff48b37cae861271141203520574ea3399f8e14 |
| apps/mobile/src/features/scheduler/cycleStore.ts | present | 16143 | 79bbc5f714baac7229a381aa4dd99eff542b4d357eba10ec6dc2a515f31e56bc |
| apps/mobile/src/features/scheduler/cycleStore.test.ts | present | 14902 | 77a6eebec64f7afbefa60f6ad04878b075c7f74e105ce409a8b1d52b7713fa06 |
| apps/mobile/src/features/scheduler/cycleWeekRoute.test.ts | present | 15514 | f9842811b150aa91c76201cedac3dd7ec6a31e52f04ae80540e1fdc42904cb46 |
| apps/mobile/src/features/scheduler/orchestrate.ts | present | 12566 | cc78a6d95295d2dd3cf2db03e00401fcd01bf3142ca0a329e25d5e2e2e884a37 |
| apps/mobile/src/features/scheduler/orchestrate.test.ts | present | 19231 | da53077967a8907cc35ac85b032fc1dba1537cc9b92d99b180b3ffb7a4e388b2 |
| apps/mobile/src/features/scheduler/useCycle.ts | present | 9317 | 4e69bfb5c48f94701e888144161597b2f27ff7880d19426e8b418e896df32a23 |
| apps/mobile/src/features/shelf/freshness.ts | present | 3758 | db7f03175302ca10c75668056d8ca1ce0ff3f41de06b36e8428e09437ddc1ee2 |
| apps/mobile/src/features/shelf/freshness.test.ts | present | 2976 | 3ab2cc0066fb2c9880b8a294424fcf15b21b749e39106b95fda14153bab5b962 |
| apps/mobile/src/features/shelf/freshnessMigration.test.ts | present | 1325 | 39696409e00d951d5a8d57b065b35f051bdc12a791471d8564c146446dc1dd73 |
| apps/mobile/src/features/shelf/paoProvenance.ts | present | 508 | dd71e9b3f563903e532cd76f5643ce04cc280f6cbe79cc7837ad2861fdacb7b3 |
| apps/mobile/src/features/shelf/paoProvenance.test.ts | present | 1305 | 036d37d4a9e008be0b89e5c63d9091704f439d23111ca377513a5f4a6bebc555 |
| apps/mobile/src/features/shelf/shelfRoutes.test.ts | present | 46944 | 2f45fdbde9cd192859748f334866f575099991a691ad408b3937d15306ee16a5 |
| apps/mobile/src/features/shelf/store.ts | present | 15181 | 0f9a48aa3fd386c5fec3b23bd4803ed5711e88830f64f55a9a6f66a465d0364a |
| apps/mobile/src/features/shelf/store.test.ts | present | 10016 | df306f9374482351758a2ae2f79531387314714c95f0fece57240dd84581a9ec |
| apps/mobile/src/features/today/cycleCompletion.ts | present | 606 | 98332563cb28e0978440e3ef1c800eb67421adec0d29b8f164efa69d3c43c271 |
| apps/mobile/src/features/today/cycleCompletion.test.ts | present | 2082 | 455515f4c61045684d8e7a89501db67b90463eac203743659517940c2ea7788a |
| apps/mobile/src/features/trend/copy.ts | present | 5381 | 804c809a7f3acdebf3293fdb738d18524e6e3aa8095e78c0f00de0cf8cfc9318 |
| apps/mobile/src/features/trend/fairnessPrivacyGate.test.ts | present | 3425 | d4b9128f7a7309f2117d3df3ef5016950bf4cd9a58ce2a253dc3517288fda6e1 |
| apps/mobile/src/features/trend/trendRoutes.test.ts | present | 3695 | 3f4c93276730c9725fe274b70587c539316f924f03ef6b328aaa7dff2739bab7 |
| apps/mobile/src/features/trend/useTrend.ts | present | 3012 | c3c33e17b6fe1043b94478776f8f45220e56bf5f3611703d26bcda2a7f0541c9 |
| supabase/functions/catalog-lookup/index.ts | present | 8187 | 3ea57934c0e3a102de119b9ccf8644bbceab1cc488bdcb0dd4f0fea7583e7689 |
| supabase/functions/catalog-lookup/catalogContract.ts | present | 1061 | 60733dac6228405052bac40f9336581042f24a3503b75be43ad238cb78fcb91d |
| supabase/functions/catalog-lookup/catalogContract.test.ts | present | 1797 | c91e14a46870197c03171f83ce64cc69ad4e5c649294fc7675e3149a9cb938f1 |
| supabase/functions/catalog-search/index.ts | present | 5093 | 7d3986fb22d0463989ae885aed8ac77070e90a2597a9188d3c8358f5d6c09e96 |
| supabase/functions/catalog-search/catalogContract.ts | present | 1994 | 3b51d16f5b8d5b24a9f87d2e445c28391c8f6407d39150f4085910da97f380e0 |
| supabase/functions/catalog-search/catalogContract.test.ts | present | 3949 | 18adc4c4572004285afab509ab0d100daeaaa905ce5895d1783a0a792d15cc59 |
| supabase/migrations/20260711000038_shelf_freshness_invariants.sql | present | 1973 | 672df1e56fac4cdfc6bf641c3249221aaacf630439d28898a79ace2d25181bcd |
| supabase/migrations/20260711000039_replenishment_alert_opt_in.sql | present | 372 | eac60d4bf92f465ad2264c509f8e0a2f412b5780f862cf602b8ff16e1e2e1299 |
| scripts/phase7/build-core-loop-qa-packet.mjs | present | 14844 | a44f7fc35236d034645eb9f924e6ea030b87be38145e5be635ec39c4de9a2a2b |
| scripts/phase7/check-core-loop.mjs | present | 22088 | 8df23d34ca7998dc25c04e6fc9ea8e816fbc5cc6cbebed7bbcd16acf0e0653ca |
| scripts/phase7/check-core-loop-smoke.mjs | present | 13728 | 73b7341ddc39904dda7ca1fa689dee67d69009c3ccb67f142937219eac7f18e0 |
| scripts/e2e/human-e2e-manifest.mjs | present | 59344 | 38e229c125f6c077d68722ff792825f750610f1e8610008c61834e9f43e6cfe9 |
| scripts/phase9/lib.mjs | present | 20344 | 01fd4497bb9bb34e80f51a8daa76513edb383c6cb68686b22e72b8e4d8cf5665 |
| docs/HUMAN_SIMULATED_E2E_TESTING.md | present | 10431 | db247b2acad570745d13b73913e3a18bef5ba9e4ea8d682322adfac7daa131d8 |
| docs/E2E_TESTING_CHECKLIST.md | present | 3632 | 1f37a8c5f6565073dfc4998dd2a46d6c3fbe6cba8f8dc4662039321af75be95f |
| docs/USER_FLOW_TREE.md | present | 358943 | 059cf974dc272f3b410ee65bc2b3ef5dcf9b5363c5a277bd7ecd39eeb9f396e6 |
| docs/e2e/generated/human-e2e-manifest.json | present | 41722 | fddcdc2850d6f6e04ee2ce4231d0594566a8ba75a8139e020e47c08de15eb2ab |
| docs/e2e/generated/human-e2e-manifest.md | present | 16508 | e1b5fd170718368b2c671f896ed23f5b767faa4078e7e957a08c93972f878476 |
| docs/phase-5/generated/device-qa-packet.json | present | 26526 | 47be0118304ea5a68372169a21634f2f073e471b0d0db6f7f78191034c3b3919 |
| docs/phase-5/generated/device-qa-packet.md | present | 23039 | 7e3a0c16df9b800b03a54036543c6c5972255db1a10c18c9a96b4188e764c731 |
| docs/phase-6/generated/payments-qa-packet.json | present | 15937 | ef722d8dcb95a204a27786953a3414eba912d7fd899c76c696b7ca9c5f412bbf |
| docs/phase-6/generated/payments-qa-packet.md | present | 10435 | 1af1e8092dceb8c6913c01597819816791518ff3ca4c21922ed1c672b385ce46 |
| docs/phase-7/surface-inventory.md | present | 7793 | 50c0f72fb317e36588a30559cd254dcb3b7ebaa7c73b8b4ba4dfb9ea35350fd6 |
| docs/phase-7/launch-claim-matrix.md | present | 4322 | 7027d6d21f2cc7c3bb6944f003f9aeac6a09efea8dc2785280f6a3da44bb6b6b |
| docs/phase-7/beta-evidence-dashboard.md | present | 4725 | f57bd8b15489b66c4dbee486f3e15190eb2e4752420308dfb71883372348cdd1 |
| docs/phase-7/core-loop-qa-checklist.md | present | 63695 | 40d653354b6134a9f3e21321f35a1fe4a1f5358ab99ef7a451356941cdf33724 |
| docs/phase-7/phase-7-exit-review.md | present | 4261 | af747174347a16ab1bcfcaba8a35b26c95b26708912f4cb56e0bf5c3862ce7cb |

## Blockers

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

## Warnings

- none
