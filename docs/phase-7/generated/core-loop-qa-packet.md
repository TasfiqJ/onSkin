# Generated Phase 7 Core Loop QA Packet

Generated at: 2026-07-11T18:48:46.991Z
Git SHA: de9bee6b829c97a89c2f0e08a83e59c788baffa9
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
| package.json | present | 18313 | 5714a4b7bd35cffa77b9951ebfcad3b090cc707a89bf0e0f6001ae7ad49c81b3 |
| apps/mobile/src/lib/launch/phase7.ts | present | 5290 | 4369c73351a58fd6cad9c5d94917185fadb7e67bf219aa9f85814dea5055e663 |
| apps/mobile/src/lib/launch/phase7.test.ts | present | 7951 | d8f1f40b721e0424f4781b7f5769d6610648c3b1dfac45a9ee0bf42e273f1815 |
| apps/mobile/src/components/launch/DeferredSurface.tsx | present | 2028 | 235a3fcdab2164c06c8677417a2ab5756779e0a53d1dd8b0d7485e6eba619f87 |
| apps/mobile/src/app/(tabs)/today.tsx | present | 32816 | c1f1d270ed129521e39147d536b2d98da36945bab0a1f6d169473bd78884c501 |
| apps/mobile/src/app/(tabs)/progress.tsx | present | 20519 | d009aa555a3230ad67a41dfdc2cbeb184b9684757b97085346fe5362e57c7125 |
| apps/mobile/src/app/(tabs)/shelf.tsx | present | 16085 | bfc542c49770247668411df13067245b1b5310bf23e48e19bdfc4dd5673e45be |
| apps/mobile/src/app/(tabs)/you.tsx | present | 37119 | b13fdc0f555048e214cda72affba45497b2d340b0e60a0ab4ae020a2ccc54c24 |
| apps/mobile/src/app/_layout.tsx | present | 2381 | e894aa085c1f78b8ea48b892d3038297ae207150d37eb692f87c39c69f4426cf |
| apps/mobile/src/app/cycle/settings.tsx | present | 27252 | 0ecdd558bf0120bd4a3906899313ae9aefe7ad3452c761c742b428099fea4c4f |
| apps/mobile/src/app/cycle/week.tsx | present | 13901 | 264a6d9fa2ce28abbb132d61b80739da5eb196990ef47867e1e6c3444e93b868 |
| apps/mobile/src/app/cycle/why-tonight.tsx | present | 8646 | 758245963dc29153bcb362353c3f375249b4fb0cde6ff60f5df2826875d444f2 |
| apps/mobile/src/app/onboarding/products.tsx | present | 15266 | 2ffd9ecd06b6480c94a8b91d1545a638cf0bd7295cfa55359467be33d905b0d9 |
| apps/mobile/src/app/routine/plan.tsx | present | 19392 | e0aa50b301550896c7fd6c963ccd0fa23aa9282927d00e5ed2e917a3ace8c006 |
| apps/mobile/src/app/share/conflict/[ruleId].tsx | present | 7123 | 0bd46e014ebcb0e3f2affaacfda83b2685137028564bca5a717fa7ac81f038db |
| apps/mobile/src/app/conflict/[ruleId].tsx | present | 32130 | f7dcd9e72e5d7209686a12708eea38498ce4d4d39b57f497bc37b127c834f6b8 |
| apps/mobile/src/app/shelf/[id].tsx | present | 37135 | dfae778efed66e57e151c5bfc14e00c7ce473fd2b4ec02002d90ff27e18770fd |
| apps/mobile/src/app/shelf/_layout.tsx | present | 916 | 9cd36d104cc8929fc4cf6bf7b9a805b904c3820df627fe160989a3924c6b27d4 |
| apps/mobile/src/app/shelf/add.tsx | present | 337 | 69027d3b5ac294d2632ceba04a4f075dfdfe624566466415059e5e74f37c0aa7 |
| apps/mobile/src/app/shelf/archive.tsx | present | 4585 | 5629481e04a349322eeff9bfd7633771689e532bb3b3109dfd1f969ad58f90ad |
| apps/mobile/src/app/shelf/manual.tsx | present | 13837 | 52ca7524948f5ad3a7485ce7be8be97d14d25ae55119f010ff1513baef291227 |
| apps/mobile/src/app/shelf/no-match.tsx | present | 10788 | 5afd8d6e4192c4b13e6926f4562d506252ebd72ade46b83f8f54314da66f69a7 |
| apps/mobile/src/app/shelf/ocr.tsx | present | 16348 | b50aa03a149f978434829bc60bcfa9c6bc599d9c7c41cac1a59cb16b5c8da321 |
| apps/mobile/src/app/shelf/opened.tsx | present | 11777 | 444f54a85bb001ec16759d304fbb754305aa590ec5018eefbfcf1c3bbfdb80ec |
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
| apps/mobile/src/features/notifications/BehaviouralTriggers.tsx | present | 2497 | 69712801b1f76253c941b1e18dd4d382660c3e42334df4d84d7dadfcd7bf225c |
| apps/mobile/src/features/notifications/claimsafety.test.ts | present | 4506 | a60c1534edb7ac76c00faf543e833d5df5671685373e8475db80aa23a4d8ab5a |
| apps/mobile/src/features/notifications/copy.ts | present | 4426 | a5b7cc3a1a0a512d21e61c49b0041ac0430c0194ab8adda45c09124a45f7787b |
| apps/mobile/src/features/notifications/store.ts | present | 7206 | 5428036c530d7d50627328f91e4f8ab9c1813f123e5e09a5ccb4d4799311bb97 |
| apps/mobile/src/features/notifications/store.test.ts | present | 5085 | a9276a89222c09c14fcf7856ea1b9e9462058ebc1d1510c5abad8e1e18d7a637 |
| apps/mobile/src/features/notifications/replenishmentOptInMigration.test.ts | present | 718 | 2b34153c9a4a85b29bbf8483217a65e4ee99b15837a50128bc7cf572c09fb4a0 |
| apps/mobile/src/features/recommendations/claimsafety.test.ts | present | 9030 | 7ad766f22ba19b9a6f9ca80bb1320ebae3c5bf970c3e850c485407db22b03068 |
| apps/mobile/src/features/recommendations/copy.ts | present | 7852 | d770279401f291b2ee903c275a1202c535f717272bc37bf7d5ef3fe1036778cb |
| apps/mobile/src/features/recommendations/engine.ts | present | 17809 | ccd83caffac064fa690bb5acbf67ec350a86398ce64f22e5f3ecc06ca691693d |
| apps/mobile/src/features/recommendations/engine.test.ts | present | 16643 | 8aaf0076f3f5df6f4c982d0ac1a62ce6835c1b6efcd6fc3f8f23ffa436126b1c |
| apps/mobile/src/features/recommendations/replenishment.ts | present | 2237 | c1283d8602f70730433bc4009a6049ffe21c369682bf2bdf3832b64766a09420 |
| apps/mobile/src/features/recommendations/replenishment.test.ts | present | 3505 | 9594da62265838c9628bc8dbfcc9eb81c24709a2510cb69fe1a88cde68b2f4cc |
| apps/mobile/src/features/recommendations/useRecommendations.ts | present | 2895 | efa71f91341a44cf26d64e3342ff3e70794988f92aa9eb95580fefa7ca59d1bc |
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
| apps/mobile/src/features/shelf/shelfRoutes.test.ts | present | 46618 | 0d4af97d8fc892571f9eeb045e7c2c1d7c48d59f54143db3ff1634309ff1c9dc |
| apps/mobile/src/features/shelf/store.ts | present | 12717 | a5cc27b4d691a9e37f38ad49a58a6c5bed5d6c4d9c7d166ba5509ac94057dc16 |
| apps/mobile/src/features/shelf/store.test.ts | present | 7202 | a2b05b14d6c45725f50768611345f98f4d7f90733840eac2d1a56fc9dff2f81d |
| apps/mobile/src/features/today/cycleCompletion.ts | present | 606 | 98332563cb28e0978440e3ef1c800eb67421adec0d29b8f164efa69d3c43c271 |
| apps/mobile/src/features/today/cycleCompletion.test.ts | present | 2082 | 455515f4c61045684d8e7a89501db67b90463eac203743659517940c2ea7788a |
| supabase/functions/catalog-lookup/index.ts | present | 8203 | 1d5f69b7ee82f45e7f2e4ed221783a28e67e275d6df3f69688b4562a26ed0134 |
| supabase/functions/catalog-lookup/catalogContract.ts | present | 1061 | 60733dac6228405052bac40f9336581042f24a3503b75be43ad238cb78fcb91d |
| supabase/functions/catalog-lookup/catalogContract.test.ts | present | 1797 | c91e14a46870197c03171f83ce64cc69ad4e5c649294fc7675e3149a9cb938f1 |
| supabase/functions/catalog-search/index.ts | present | 5389 | 6a2548c2709d0c61dc3710ab130037f6a6a1ab294d58c73335bb8300ce7f2aea |
| supabase/functions/catalog-search/catalogContract.ts | present | 650 | cbefae5cb524a20ec66aea62cc092d02d7e6d68d70080cec02a33342f2d91df0 |
| supabase/functions/catalog-search/catalogContract.test.ts | present | 1069 | ed8d55597732e97a3a76bf27e7e64456660b7882a5bb9687d2f295da5fdfb589 |
| supabase/migrations/20260711000038_shelf_freshness_invariants.sql | present | 1973 | 672df1e56fac4cdfc6bf641c3249221aaacf630439d28898a79ace2d25181bcd |
| supabase/migrations/20260711000039_replenishment_alert_opt_in.sql | present | 372 | eac60d4bf92f465ad2264c509f8e0a2f412b5780f862cf602b8ff16e1e2e1299 |
| scripts/phase7/build-core-loop-qa-packet.mjs | present | 13972 | 11dba878110dc0b5633f41bdf8cfd0cbecf904faa9705ef90192e62aa247c821 |
| scripts/phase7/check-core-loop.mjs | present | 17601 | 83114590e3776df56050ac810f98a1aeae208332107e15a3ae9750560647f547 |
| scripts/phase7/check-core-loop-smoke.mjs | present | 10994 | 3a9f398c342a03addc9e1dace1bd005cc911f7f5c18dae7b741b5f58408a4d71 |
| scripts/e2e/human-e2e-manifest.mjs | present | 45000 | 6dcd67a5ebf050e4416c0bae9192e1b2ac1e80edd9439b0b1078fc8215785730 |
| scripts/phase9/lib.mjs | present | 14020 | af0b4c651325a3fbb33eb94147744cb23253fa439066861e3ef1b64cbae7a083 |
| docs/HUMAN_SIMULATED_E2E_TESTING.md | present | 10167 | d7d616fcbe9078b55c0d4b3bf5e88ae19570fa533aee8edc599cf1956c7c9149 |
| docs/E2E_TESTING_CHECKLIST.md | present | 3556 | 014a9213d104d0a5bac7f1752cd94e938d3d5461d0ec5cffbf92e31678f96f7e |
| docs/USER_FLOW_TREE.md | present | 358477 | 7fc8375b5a219f6cf1d8e335d353d66999fdd68d8ec57aeea1cac49ed1136ab3 |
| docs/e2e/generated/human-e2e-manifest.json | present | 38560 | 4c194a4360f1a6376f060c5a2e0fbfcc0249b260b4c84f1771ee260183593832 |
| docs/e2e/generated/human-e2e-manifest.md | present | 11329 | f4ff33f094697bba7d29bd7eb8596043fd455a90d033ad266bd8385070850d70 |
| docs/phase-5/generated/device-qa-packet.json | present | 24149 | fcafa3301e53eeffbe10df8296a3906535e4205891875f64a5a043be41acad9c |
| docs/phase-5/generated/device-qa-packet.md | present | 22244 | 1b061d100cffad9b7b691c08f677221f75d21f8606253e2ccb7f20f94eef8dab |
| docs/phase-6/generated/payments-qa-packet.json | present | 10523 | f1b3c2a5fd65c8693483df825d14cec581a6648e48e60bf5d866b2283648922c |
| docs/phase-6/generated/payments-qa-packet.md | present | 7862 | 6dfed7cc9e4798deca99834aea66b5fe2b88144a00554786cb46b3c73f8d5ebe |
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
