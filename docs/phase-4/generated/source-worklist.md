# Phase 4 Catalog Source Worklist

Generated: 2026-07-16T18:12:49.303Z
Status: pass
Git SHA: e5045d6fe64665eeb40f58e9eb254e4dd86e3201
Git status: clean

This generated worklist is an operator handoff for the catalog/source launch
gate. It does not approve any catalog source, product batch, beta metric, or
recommendation use. It records the evidence Tas/counsel/reviewers/operators
must attach before Phase 4 can stop blocking launch.

## Summary

- Work items: 10
- Source files hashed: 149
- Missing source files: 0
- Blockers: 0
- Warnings: 0

## Items

| ID                           | Domain         | Area                                                        | Status         | Launch gate             | Sources | Missing sources |
| ---------------------------- | -------------- | ----------------------------------------------------------- | -------------- | ----------------------- | ------- | --------------- |
| source-identity              | sourceReview   | Final catalog API identity and attribution surface          | blocked        | B-CATALOG-SOURCE-REVIEW | 6       | 0               |
| obf-odbl-posture             | sourceReview   | Open Beauty Facts and ODbL launch posture                   | blocked        | B-ODBL-REVIEW           | 8       | 0               |
| cosing-reuse-taxonomy        | sourceReview   | CosIng reuse and ingredient-tag taxonomy                    | blocked        | B-CATALOG-SOURCE-REVIEW | 7       | 0               |
| curated-first-batch          | curation       | First curated launch product batch                          | blocked        | B-CURATED-CATALOG       | 7       | 0               |
| import-qa                    | curation       | Import QA and generated catalog evidence                    | local-scaffold | B-CATALOG-SEED          | 5       | 0               |
| beta-coverage                | betaEvidence   | Closed-beta catalog coverage and correction loop            | blocked        | B-CATALOG-COVERAGE      | 7       | 0               |
| mobile-catalog-disclosure    | productSurface | Mobile catalog source, quality, and report-issue disclosure | local-scaffold | B-CATALOG-SEED          | 60      | 0               |
| catalog-freshness-provenance | productSurface | Catalog-backed Shelf freshness and provenance contract      | local-scaffold | B-CATALOG-SEED          | 32      | 0               |
| obf-contribution-back        | operations     | Unmatched-product contribution-back operation               | blocked        | B-SHELF-CONTRIB         | 9       | 0               |
| observability-support        | operations     | Catalog dashboards, alerts, and support feedback loop       | blocked        | B-CATALOG-COVERAGE      | 8       | 0               |

## Item Details

### source-identity - Final catalog API identity and attribution surface

- Domain: sourceReview
- Status: blocked
- Launch gate: B-CATALOG-SOURCE-REVIEW
- Owner: Founder + counsel + engineering

Required evidence:

- Final cleared app name, production version, support email, and attribution URL.
- `phase4:check-source-env:strict` passes with production values.
- Counsel-approved public source/attribution copy under the final brand domain.

Sources:

- `.env.example` - 23004 bytes - sha256 `d38a8520b9664114bee56f823beffba23c0f49a4213d70f4b319f5ce81e71fbe`
- `scripts/phase4/check-source-env.mjs` - 2989 bytes - sha256 `ad8eaa253c3dd97fd6ea09a1cdbf11fb1aec96212a90a610e690a74981989a1a`
- `docs/phase-4/catalog-source-memo-open-beauty-facts.md` - 4263 bytes - sha256 `9b14b91a64c721d3f2c3a172c38f31afe881282ca50d96f1ecdef2e4e5c13626`
- `docs/phase-4/catalog-source-memo-cosing.md` - 2021 bytes - sha256 `49e53a77408706bf3511f991b4050b888cb7f17e6f7d559bd69b4de6808cb534`
- `docs/phase-4/phase-4-exit-review.md` - 2235 bytes - sha256 `1d6760669e7c416ff4cca57995660d67c7b7225fc0f5a40edb88421596f0b5a3`
- `docs/FOR_TAS_TO_DO.md` - 11191 bytes - sha256 `a02a5647d2491966a701743128fbacab0dc57bf72f0067b305be98ffd469d56c`

### obf-odbl-posture - Open Beauty Facts and ODbL launch posture

- Domain: sourceReview
- Status: blocked
- Launch gate: B-ODBL-REVIEW
- Owner: Counsel + engineering

Required evidence:

- Counsel records whether OBF data can be used for the launch catalog and under what attribution/share-alike obligations.
- Product images remain disabled unless image rights are separately approved.
- Bulk import uses approved export artifacts, not API crawling or search-as-you-type scraping.

Sources:

- `docs/phase-4/catalog-source-memo-open-beauty-facts.md` - 4263 bytes - sha256 `9b14b91a64c721d3f2c3a172c38f31afe881282ca50d96f1ecdef2e4e5c13626`
- `docs/phase-4/odbl-compliance-memo.md` - 2019 bytes - sha256 `0fe9bc07e3c4d34129ac8f8f2ba410a64e6caa0d77a3b7994198e0b4d9e18e69`
- `scripts/phase4/import-obf-snapshot.mjs` - 4856 bytes - sha256 `bf5721fac6d5b11e0ca0c99b2b883330af6eb22c66763ed316ebe98b229597bf`
- `scripts/phase4/catalog-qa-report.mjs` - 6961 bytes - sha256 `86168235bfe785f680fdbdca89d6640fe2674627a1afdaf27669b0b24d750596`
- `supabase/migrations/20260614000026_phase4_catalog.sql` - 35102 bytes - sha256 `dc1a7f150bd5b285cf2d05f2583126ebeb97e67b5363666e670518896b93c311`
- `supabase/functions/catalog-lookup/index.ts` - 11115 bytes - sha256 `b486e95fe9a6ad78cadc41f0ee41a6a2c8d49c1d9f76a3c8e0b80b3378acae06`
- `supabase/functions/catalog-search/index.ts` - 9192 bytes - sha256 `17a04d342b331e58d3f4bb295cc3e76db2786fea29a2e57252f02cea34b7c79a`
- `supabase/functions/catalog-report/index.ts` - 7394 bytes - sha256 `fe0631b3297d361ff1f66b7818669af102314eb1b709b7a70f7662971730dd1e`

### cosing-reuse-taxonomy - CosIng reuse and ingredient-tag taxonomy

- Domain: sourceReview
- Status: blocked
- Launch gate: B-CATALOG-SOURCE-REVIEW
- Owner: Counsel + cosmetic chemist

Required evidence:

- Counsel records CosIng reuse and attribution obligations.
- Cosmetic chemist signs the ingredient-tag taxonomy and confirms CosIng is not presented as product-level approval.
- Parser import artifact records snapshot date, parser version, and QA output hash.

Sources:

- `docs/phase-4/catalog-source-memo-cosing.md` - 2021 bytes - sha256 `49e53a77408706bf3511f991b4050b888cb7f17e6f7d559bd69b4de6808cb534`
- `docs/phase-4/ingredient-tag-taxonomy.md` - 3276 bytes - sha256 `8b2af877c4cbdd0f6a7f4f965ded0ece300710e7bb2adbe97c97d5aaef26b83f`
- `scripts/phase4/import-cosing-dictionary.mjs` - 4085 bytes - sha256 `ca08b1f6a8986c00f9850b6f87ec5de5250a7ad217f28c382674016f3bf0244b`
- `apps/mobile/src/features/catalog/ingredientParser.ts` - 6913 bytes - sha256 `1030094651254b5e6a934ae515bd42bf2f10ba10229b1164a12d3fd2ca99eee4`
- `apps/mobile/src/features/catalog/ingredientParser.test.ts` - 1497 bytes - sha256 `fc196a7b95de58ed71a6deff1d9df7afb4ea394b00ca482e8b1eae27204baf25`
- `apps/mobile/src/features/intelligence/tags.ts` - 5155 bytes - sha256 `45bad7e06d4afed653aa6d24da8fc991a3971ea0e219155e19c630a083477af4`
- `apps/mobile/src/features/intelligence/tags.test.ts` - 1791 bytes - sha256 `cc38be3e5c48bbcc1df28427dc326b1583222812d9dc3693d066c19d8de54b7e`

### curated-first-batch - First curated launch product batch

- Domain: curation
- Status: blocked
- Launch gate: B-CURATED-CATALOG
- Owner: Founder + catalog operator + clinical reviewers

Required evidence:

- Approved source exports and real beta shelf input drive the first batch; fixtures are not production data.
- Recommendable rows are `verified` or `usable`, reviewed, and correction-free.
- Sunscreen/OTC-adjacent rows have separate source, expiry, and reviewer handling.

Sources:

- `docs/phase-4/curated-product-curation-sheet.md` - 3113 bytes - sha256 `8f151ba15e2be8956f1fa1f0035815ec2c1a9044f1357285dddc8baef66cd144`
- `docs/phase-4/first-curated-product-batch.md` - 1401 bytes - sha256 `b2b1c9270c1d6e198a1f064ee1fdc9bb4181fe93147205c22af9c0325e3cbe3c`
- `scripts/phase4/fixtures/curated-products.sample.json` - 628 bytes - sha256 `b171a4ef68c26d8748b73c6dc28636d515cfeacf63d75b5335ade5653444bf49`
- `apps/mobile/src/features/catalog/quality.ts` - 4663 bytes - sha256 `7156ff221071cf6ab90c3558c20d084c53e1f48d0025843ebea5275929103e53`
- `apps/mobile/src/features/catalog/quality.test.ts` - 2258 bytes - sha256 `b5187f33001f741cdb8636ad61343f072502b60ffe2fba70b5e831fce570e599`
- `apps/mobile/src/features/recommendations/catalog.ts` - 9381 bytes - sha256 `e5d35422d6e33398d362b5c2e4483da8808bf2654d83d470013f537aa09e59c4`
- `apps/mobile/src/features/recommendations/claimsafety.test.ts` - 9030 bytes - sha256 `7ad766f22ba19b9a6f9ca80bb1320ebae3c5bf970c3e850c485407db22b03068`

### import-qa - Import QA and generated catalog evidence

- Domain: curation
- Status: local-scaffold
- Launch gate: B-CATALOG-SEED
- Owner: Engineering + catalog operator

Required evidence:

- Production import artifact hash, source snapshot date, and parser version are archived.
- `phase4:qa-report` has zero blockers against the approved import artifact.
- Generated packet status audit reports no dirty packet text and no stale source hashes.

Sources:

- `scripts/phase4/catalog-qa-report.mjs` - 6961 bytes - sha256 `86168235bfe785f680fdbdca89d6640fe2674627a1afdaf27669b0b24d750596`
- `scripts/phase4/catalog-qa-report-smoke.mjs` - 5504 bytes - sha256 `43e8b217e0a8276e0299f2477ddb3b4ab9536521d745514be2a48e68e7bf97a1`
- `scripts/phase4/import-obf-snapshot.mjs` - 4856 bytes - sha256 `bf5721fac6d5b11e0ca0c99b2b883330af6eb22c66763ed316ebe98b229597bf`
- `scripts/phase4/import-cosing-dictionary.mjs` - 4085 bytes - sha256 `ca08b1f6a8986c00f9850b6f87ec5de5250a7ad217f28c382674016f3bf0244b`
- `scripts/docs/generated-packet-status-audit.mjs` - 11726 bytes - sha256 `0618ffa7f0651f696d9a6243e5840bb3f35531c7dbd3844916f3e6d77f63bbdb`

### beta-coverage - Closed-beta catalog coverage and correction loop

- Domain: betaEvidence
- Status: blocked
- Launch gate: B-CATALOG-COVERAGE
- Owner: Founder + engineering + support

Required evidence:

- 50-100 real target users add at least three products each.
- Barcode, search, OCR, and manual fallback are all exercised and reported.
- Wrong-match rate, parser unknown-token rate, catalog support tickets, and top gaps are triaged.
- `phase4:beta-coverage-report:strict` passes only with real beta exports and named signoff.

Sources:

- `docs/phase-4/beta-coverage-report.md` - 2125 bytes - sha256 `d657465c6bdf76f6084fd361cee5bb96c3ad5f92fecf99f93fc9d1cba8f3999d`
- `scripts/phase4/beta-coverage-report.mjs` - 22245 bytes - sha256 `708cc87185f72ee9356f73f75ec79c2543744647dae761aa347f55a81c86e4b7`
- `scripts/phase4/beta-coverage-report-smoke.mjs` - 8339 bytes - sha256 `74be5ca44d86da117f80a514ad283212d05a08549cdafb3e2ed6824e6a118105`
- `docs/phase-10/catalog-beta-report.md` - 1680 bytes - sha256 `28729b9ed344c13414cb6426f0c5360ac21034641b5cd94298d8dbb391165d28`
- `docs/phase-10/support-beta-report.md` - 2149 bytes - sha256 `f25c3841a8bc5649dbd1f38632c756898da46a5d7f4d59ff7c328726dc9d26ac`
- `docs/phase-10/retention-activation-report.md` - 2343 bytes - sha256 `e7c5ebd8d49c5bc527e4ea926743a2ede4eb33522e6fda28ec1deae00953f8ab`
- `docs/FOR_TAS_TO_DO.md` - 11191 bytes - sha256 `a02a5647d2491966a701743128fbacab0dc57bf72f0067b305be98ffd469d56c`

### mobile-catalog-disclosure - Mobile catalog source, quality, and report-issue disclosure

- Domain: productSurface
- Status: local-scaffold
- Launch gate: B-CATALOG-SEED
- Owner: Engineering + counsel

Required evidence:

- Product detail and shelf flows show source/quality without implying completeness or endorsement.
- Wrong-match reporting stays route-owned and privacy-safe.
- Product-specific recommendations remain blocked for below-usable, unreviewed, or correction-open rows.

Sources:

- `apps/mobile/src/features/catalog/client.test.ts` - 12335 bytes - sha256 `92250d319ea33fc14bb57c0bf131e732847762036f9ed132788033aea0c78dbd`
- `apps/mobile/src/features/catalog/client.ts` - 11357 bytes - sha256 `ac891d9253e2f2d81be440eda468ab02d0f9e3afddb84822be14f9a48f451438`
- `apps/mobile/src/features/catalog/copy.ts` - 1913 bytes - sha256 `b182cec74cb72f850e83dcca14a5548c6277d73a9eaac229f6062e665090f958`
- `apps/mobile/src/features/catalog/ingredientParser.test.ts` - 1497 bytes - sha256 `fc196a7b95de58ed71a6deff1d9df7afb4ea394b00ca482e8b1eae27204baf25`
- `apps/mobile/src/features/catalog/ingredientParser.ts` - 6913 bytes - sha256 `1030094651254b5e6a934ae515bd42bf2f10ba10229b1164a12d3fd2ca99eee4`
- `apps/mobile/src/features/catalog/normalization.test.ts` - 750 bytes - sha256 `255e781eb918fc8581ff91fa9048309b1e2560b204c9b66216ccc5bb0e9de759`
- `apps/mobile/src/features/catalog/normalization.ts` - 2203 bytes - sha256 `9d4f8294db57ab98b4fa6a2997e29512a11ccf91a18e3273c7312c7117393ac7`
- `apps/mobile/src/features/catalog/obf.test.ts` - 1862 bytes - sha256 `730dbc1d7f7d7610b0a4d73ca45efadb375768af806c634763c000fb81206e2f`
- `apps/mobile/src/features/catalog/obf.ts` - 4536 bytes - sha256 `fd176cfb945b3543b342acadc6f40c333d6c6b484023884998a6f448ebadd2b6`
- `apps/mobile/src/features/catalog/quality.test.ts` - 2258 bytes - sha256 `b5187f33001f741cdb8636ad61343f072502b60ffe2fba70b5e831fce570e599`
- `apps/mobile/src/features/catalog/quality.ts` - 4663 bytes - sha256 `7156ff221071cf6ab90c3558c20d084c53e1f48d0025843ebea5275929103e53`
- `apps/mobile/src/features/shelf/analytics.test.ts` - 543 bytes - sha256 `fce0e7cd2128b9c01644369a7dde86d178f44aaa80b0c7f9a58079ab08d4cc17`
- `apps/mobile/src/features/shelf/analytics.ts` - 599 bytes - sha256 `1e514f5fc1a96111a8b792dc8841ad41a11130dd6de7031eb08a353f85ef1050`
- `apps/mobile/src/features/shelf/categories.test.ts` - 2124 bytes - sha256 `4aae0710713ddf321c7cb078b8434b4c77931270f68591802be2d2366cbdf4a9`
- `apps/mobile/src/features/shelf/categories.ts` - 2691 bytes - sha256 `4a08833bd1d80b64748e2b8b635c2e39dce596d2eef4d52ea36f39912bac29d0`
- `apps/mobile/src/features/shelf/expiry.ts` - 1306 bytes - sha256 `0846816c55e3ccab674ba04ab9b9332eef7e7301436620fbaaf9fea2fa9cb734`
- `apps/mobile/src/features/shelf/freshness.test.ts` - 2976 bytes - sha256 `3ab2cc0066fb2c9880b8a294424fcf15b21b749e39106b95fda14153bab5b962`
- `apps/mobile/src/features/shelf/freshness.ts` - 3758 bytes - sha256 `db7f03175302ca10c75668056d8ca1ce0ff3f41de06b36e8428e09437ddc1ee2`
- `apps/mobile/src/features/shelf/freshnessMigration.test.ts` - 1325 bytes - sha256 `39696409e00d951d5a8d57b065b35f051bdc12a791471d8564c146446dc1dd73`
- `apps/mobile/src/features/shelf/IntakeContext.tsx` - 2833 bytes - sha256 `afc1156ac26b2a759511c95e8acc7f84ab8b6487d46f72c359c3dc4fee6c3252`
- `apps/mobile/src/features/shelf/labels.ts` - 947 bytes - sha256 `b39bac34c85280eda82ce9b8a5e3d8ea31d90dcd3e53f6daeb636cd0df0a8552`
- `apps/mobile/src/features/shelf/LocalDateField.tsx` - 1765 bytes - sha256 `e0b6cc071362f286582498c4333650d0ead57b58dbc6cc9f270e53c70e1e87a4`
- `apps/mobile/src/features/shelf/metadata.ts` - 1352 bytes - sha256 `3d5ea0795d0b2460a4d14b070496a41c84fc5cbaac0431e05f0c48d2ca29194e`
- `apps/mobile/src/features/shelf/mutations.ts` - 7190 bytes - sha256 `0e7259ca6764665b6ca46ad82d3f9634d06d4a713966bbf54d95109443f439de`
- `apps/mobile/src/features/shelf/pairedConflicts.ts` - 766 bytes - sha256 `eb4cc3b857828ae8d123890b0771a44fe57e73e29da3e6207604fd3ed640a918`
- `apps/mobile/src/features/shelf/paoProvenance.test.ts` - 1305 bytes - sha256 `036d37d4a9e008be0b89e5c63d9091704f439d23111ca377513a5f4a6bebc555`
- `apps/mobile/src/features/shelf/paoProvenance.ts` - 508 bytes - sha256 `dd71e9b3f563903e532cd76f5643ce04cc280f6cbe79cc7837ad2861fdacb7b3`
- `apps/mobile/src/features/shelf/scanLog.test.ts` - 5724 bytes - sha256 `ccf91fca6b913eeb1b5c46c29320a2fbf640bc66d0688a57a6632d505ce43ac5`
- `apps/mobile/src/features/shelf/scanLog.ts` - 2544 bytes - sha256 `b573ee6ea5a07aca95196a3f9a2b25a0c5e38acad442a42c6172146a1b23d0fc`
- `apps/mobile/src/features/shelf/shelfRoutes.test.ts` - 46944 bytes - sha256 `2f45fdbde9cd192859748f334866f575099991a691ad408b3937d15306ee16a5`
- `apps/mobile/src/features/shelf/store.test.ts` - 11630 bytes - sha256 `9f17b0e0fa83743dcdf058fc8dcf5bea2201e7c65537a75a9d4288de0c73b0c2`
- `apps/mobile/src/features/shelf/store.ts` - 16642 bytes - sha256 `2f155ccad6592e2381dacc525477bf862b81bc15597e61a01af0a28311861fa8`
- `apps/mobile/src/features/shelf/useShelf.test.ts` - 4753 bytes - sha256 `63d228877532e01ded924cfc5693c6789ee2a311207ebc840e8bc88a1b6b69ac`
- `apps/mobile/src/features/shelf/useShelf.ts` - 10850 bytes - sha256 `30250aed26eef5b6a2509541301728db5c26aff4ca1cbb2270596f8b70071edb`
- `apps/mobile/src/app/shelf/[id].tsx` - 37135 bytes - sha256 `dfae778efed66e57e151c5bfc14e00c7ce473fd2b4ec02002d90ff27e18770fd`
- `apps/mobile/src/app/shelf/search.tsx` - 15482 bytes - sha256 `01ae00b96fa0a378ae140b8f54c342a268e5b34c0e32e0a76349e4b9493176d6`
- `apps/mobile/src/app/shelf/manual.tsx` - 13837 bytes - sha256 `52ca7524948f5ad3a7485ce7be8be97d14d25ae55119f010ff1513baef291227`
- `apps/mobile/src/features/recommendations/applyPreferences.test.ts` - 1319 bytes - sha256 `751559e6d23b979ffe0cd2924d42f30eb41b591f6427bf13d27c175cffdb75a3`
- `apps/mobile/src/features/recommendations/applyPreferences.ts` - 493 bytes - sha256 `50dabada0ac3066adf7bd455e93c95ee89b5838079a2f737ff7d36b57d02b0f3`
- `apps/mobile/src/features/recommendations/catalog.ts` - 9381 bytes - sha256 `e5d35422d6e33398d362b5c2e4483da8808bf2654d83d470013f537aa09e59c4`
- `apps/mobile/src/features/recommendations/claimsafety.test.ts` - 9030 bytes - sha256 `7ad766f22ba19b9a6f9ca80bb1320ebae3c5bf970c3e850c485407db22b03068`
- `apps/mobile/src/features/recommendations/copy.ts` - 7852 bytes - sha256 `d770279401f291b2ee903c275a1202c535f717272bc37bf7d5ef3fe1036778cb`
- `apps/mobile/src/features/recommendations/engine.test.ts` - 16643 bytes - sha256 `8aaf0076f3f5df6f4c982d0ac1a62ce6835c1b6efcd6fc3f8f23ffa436126b1c`
- `apps/mobile/src/features/recommendations/engine.ts` - 17809 bytes - sha256 `ccd83caffac064fa690bb5acbf67ec350a86398ce64f22e5f3ecc06ca691693d`
- `apps/mobile/src/features/recommendations/fit.test.ts` - 4508 bytes - sha256 `37e6a7e1c6bf31bf7ad7f5b4511fa41c9e1a345f9890eaadce3152ef09cc6dd7`
- `apps/mobile/src/features/recommendations/fit.ts` - 5650 bytes - sha256 `53030a7d1537eaf7567b861bd72368f829b82d79a4323285d570a6a6da823745`
- `apps/mobile/src/features/recommendations/loading.ts` - 251 bytes - sha256 `9c611cd49e793cc1161ecd665ee790bb056014b28a8d2f928a20bf59c0d7294d`
- `apps/mobile/src/features/recommendations/preferences.ts` - 647 bytes - sha256 `055882921e6e68b018b75aa075d93214119fa098add0c3e2665f96dadc77ebbf`
- `apps/mobile/src/features/recommendations/recommendationRoutes.test.ts` - 14651 bytes - sha256 `e09257f75e5dabd44ce73b475e00f9e31bb60c619f948ebe3c6b96ff6f0abeb2`
- `apps/mobile/src/features/recommendations/RecommendationsTeaser.test.ts` - 3590 bytes - sha256 `6f0d92c8fb2f1165be38c25b7bc2b6aa6ba582bfda66e86b7099e7ed78bb4340`
- `apps/mobile/src/features/recommendations/RecommendationsTeaser.tsx` - 8154 bytes - sha256 `e7f0a45a96459b892d81a36c3a5f196864b7f9bec210f4be880dee58706e75f0`
- `apps/mobile/src/features/recommendations/replenishment.test.ts` - 3505 bytes - sha256 `9594da62265838c9628bc8dbfcc9eb81c24709a2510cb69fe1a88cde68b2f4cc`
- `apps/mobile/src/features/recommendations/replenishment.ts` - 2237 bytes - sha256 `c1283d8602f70730433bc4009a6049ffe21c369682bf2bdf3832b64766a09420`
- `apps/mobile/src/features/recommendations/store.test.ts` - 7126 bytes - sha256 `3f51aba2e8b925752a0c74c30413190342d1462a09c19bbc7c0dcbc1f8dde1d8`
- `apps/mobile/src/features/recommendations/store.ts` - 7133 bytes - sha256 `b240f42ca33243d0db35eaed63c307d598be89aa485a1ba80a6e5bd7b5f98774`
- `apps/mobile/src/features/recommendations/useRecommendations.test.ts` - 1006 bytes - sha256 `9c1908c337df4cc3abd8a4fb12fcf12bca2d82b985b4043189a4347ab65fe44a`
- `apps/mobile/src/features/recommendations/useRecommendations.ts` - 3251 bytes - sha256 `ed9aa67b5350287f58fcbba8fc6f328183fb803dd27ba8625906923cd8006018`
- `supabase/functions/catalog-report/index.ts` - 7394 bytes - sha256 `fe0631b3297d361ff1f66b7818669af102314eb1b709b7a70f7662971730dd1e`
- `supabase/functions/catalog-report/privacy.ts` - 3504 bytes - sha256 `9dee03b20211d5b3fcb2e05ad4be85a00112dd00f03fc6e5c834969381f0e44e`
- `supabase/functions/catalog-report/privacy.test.ts` - 4009 bytes - sha256 `db9b6d1c812679297295c5afb6c8d0226c99f94b8aedefff620111d4fa9d7bac`

### catalog-freshness-provenance - Catalog-backed Shelf freshness and provenance contract

- Domain: productSurface
- Status: local-scaffold
- Launch gate: B-CATALOG-SEED
- Owner: Engineering + catalog operator + device QA

Required evidence:

- Catalog lookup/search expose the source UUID separately and admit only reviewed, region-compatible PAO and printed-expiry evidence; external candidates do not fabricate provenance.
- Shelf intake requires a coherent opened state and exact non-future local date, records `label` PAO provenance only after explicit open-jar confirmation, and surfaces the source of the winning expiry date.
- Re-add archives the prior unit and creates a fresh unit without inheriting its printed expiry; automatic replenishment uses only supported signals and alerts remain explicit opt-in.

Sources:

- `docs/04-smart-shelf.md` - 55627 bytes - sha256 `96a33fafa232716b20562d6bf5664ce018284bc4fc59c9003a1437ab37065dce`
- `docs/USER_FLOW_TREE.md` - 382133 bytes - sha256 `ed2da42899c932830f77ebf16b1aa14d34c604651304bb7ae0d93ad8cb8fcfe8`
- `apps/mobile/src/app/onboarding/products.tsx` - 15483 bytes - sha256 `ae461d520feb9894e38ce46222b47963d9f31f9077933eb03142e53898ea72ba`
- `apps/mobile/src/app/shelf/[id].tsx` - 37135 bytes - sha256 `dfae778efed66e57e151c5bfc14e00c7ce473fd2b4ec02002d90ff27e18770fd`
- `apps/mobile/src/app/shelf/opened.tsx` - 12059 bytes - sha256 `cac7cfabb2a28e50ebb8138cde5d7c38e0dfbb35a8142ad680697ff816e49cd0`
- `apps/mobile/src/app/shelf/replenish.tsx` - 7631 bytes - sha256 `5addfea202ebc15850feacc3a18c79d6216310c61a341a101c300a497cd94644`
- `apps/mobile/src/app/shelf/scan.tsx` - 23220 bytes - sha256 `81712f3391afccaadd7f86d1f3ccd546d696e842654fbd01fb3cc9cf9df0eb6c`
- `apps/mobile/src/app/shelf/search.tsx` - 15482 bytes - sha256 `01ae00b96fa0a378ae140b8f54c342a268e5b34c0e32e0a76349e4b9493176d6`
- `apps/mobile/src/features/catalog/client.ts` - 11357 bytes - sha256 `ac891d9253e2f2d81be440eda468ab02d0f9e3afddb84822be14f9a48f451438`
- `apps/mobile/src/features/catalog/client.test.ts` - 12335 bytes - sha256 `92250d319ea33fc14bb57c0bf131e732847762036f9ed132788033aea0c78dbd`
- `apps/mobile/src/features/intelligence/pao.ts` - 8291 bytes - sha256 `fcf9d36c694715069f527a60586ca9c0d075a00d9162263cd4b7d71f1d4baa27`
- `apps/mobile/src/features/intelligence/pao.test.ts` - 5134 bytes - sha256 `1304cbbd30e91abd5ec841c4f71598fe0dcb6ce5437eec6d78849e169c1742b2`
- `apps/mobile/src/features/notifications/store.ts` - 11233 bytes - sha256 `c4a58487812e87b538741c9db719437bd92dcc1d2b482605ced3997d7ad6862d`
- `apps/mobile/src/features/notifications/store.test.ts` - 9408 bytes - sha256 `14ab5ba14dedd4c4854b0cba685764e65de3237f8d130d543c09f47c5b7a5608`
- `apps/mobile/src/features/notifications/replenishmentOptInMigration.test.ts` - 718 bytes - sha256 `2b34153c9a4a85b29bbf8483217a65e4ee99b15837a50128bc7cf572c09fb4a0`
- `apps/mobile/src/features/recommendations/replenishment.ts` - 2237 bytes - sha256 `c1283d8602f70730433bc4009a6049ffe21c369682bf2bdf3832b64766a09420`
- `apps/mobile/src/features/recommendations/replenishment.test.ts` - 3505 bytes - sha256 `9594da62265838c9628bc8dbfcc9eb81c24709a2510cb69fe1a88cde68b2f4cc`
- `apps/mobile/src/features/shelf/freshness.ts` - 3758 bytes - sha256 `db7f03175302ca10c75668056d8ca1ce0ff3f41de06b36e8428e09437ddc1ee2`
- `apps/mobile/src/features/shelf/freshness.test.ts` - 2976 bytes - sha256 `3ab2cc0066fb2c9880b8a294424fcf15b21b749e39106b95fda14153bab5b962`
- `apps/mobile/src/features/shelf/freshnessMigration.test.ts` - 1325 bytes - sha256 `39696409e00d951d5a8d57b065b35f051bdc12a791471d8564c146446dc1dd73`
- `apps/mobile/src/features/shelf/paoProvenance.ts` - 508 bytes - sha256 `dd71e9b3f563903e532cd76f5643ce04cc280f6cbe79cc7837ad2861fdacb7b3`
- `apps/mobile/src/features/shelf/paoProvenance.test.ts` - 1305 bytes - sha256 `036d37d4a9e008be0b89e5c63d9091704f439d23111ca377513a5f4a6bebc555`
- `apps/mobile/src/features/shelf/store.ts` - 16642 bytes - sha256 `2f155ccad6592e2381dacc525477bf862b81bc15597e61a01af0a28311861fa8`
- `apps/mobile/src/features/shelf/store.test.ts` - 11630 bytes - sha256 `9f17b0e0fa83743dcdf058fc8dcf5bea2201e7c65537a75a9d4288de0c73b0c2`
- `supabase/functions/catalog-lookup/index.ts` - 11115 bytes - sha256 `b486e95fe9a6ad78cadc41f0ee41a6a2c8d49c1d9f76a3c8e0b80b3378acae06`
- `supabase/functions/catalog-lookup/catalogContract.ts` - 641 bytes - sha256 `e205eae032c22fab88748e3f7b47a92ba65c74b0fa9f4372e03896839af45f94`
- `supabase/functions/catalog-lookup/catalogContract.test.ts` - 1683 bytes - sha256 `5ae64b92a6baa5707bdea6e6aff7d59ef04e5138354a75e772c1d8ba7b31a6ec`
- `supabase/functions/catalog-search/index.ts` - 9192 bytes - sha256 `17a04d342b331e58d3f4bb295cc3e76db2786fea29a2e57252f02cea34b7c79a`
- `supabase/functions/catalog-search/catalogContract.ts` - 1994 bytes - sha256 `3b51d16f5b8d5b24a9f87d2e445c28391c8f6407d39150f4085910da97f380e0`
- `supabase/functions/catalog-search/catalogContract.test.ts` - 3949 bytes - sha256 `18adc4c4572004285afab509ab0d100daeaaa905ce5895d1783a0a792d15cc59`
- `supabase/migrations/20260711000038_shelf_freshness_invariants.sql` - 1973 bytes - sha256 `672df1e56fac4cdfc6bf641c3249221aaacf630439d28898a79ace2d25181bcd`
- `supabase/migrations/20260711000039_replenishment_alert_opt_in.sql` - 372 bytes - sha256 `eac60d4bf92f465ad2264c509f8e0a2f412b5780f862cf602b8ff16e1e2e1299`

### obf-contribution-back - Unmatched-product contribution-back operation

- Domain: operations
- Status: blocked
- Launch gate: B-SHELF-CONTRIB
- Owner: Counsel + catalog operator + engineering

Required evidence:

- Contribution-back account, credentials, moderation/validation owner, and retry policy are approved.
- User-facing copy does not promise contribution-back unless the queue job is live and legally approved.
- No personal shelf/profile data is sent as contribution-back payload.

Sources:

- `docs/phase-4/odbl-compliance-memo.md` - 2019 bytes - sha256 `0fe9bc07e3c4d34129ac8f8f2ba410a64e6caa0d77a3b7994198e0b4d9e18e69`
- `docs/04-smart-shelf.md` - 55627 bytes - sha256 `96a33fafa232716b20562d6bf5664ce018284bc4fc59c9003a1437ab37065dce`
- `supabase/migrations/20260614000026_phase4_catalog.sql` - 35102 bytes - sha256 `dc1a7f150bd5b285cf2d05f2583126ebeb97e67b5363666e670518896b93c311`
- `supabase/functions/catalog-report/index.ts` - 7394 bytes - sha256 `fe0631b3297d361ff1f66b7818669af102314eb1b709b7a70f7662971730dd1e`
- `supabase/functions/catalog-report/privacy.ts` - 3504 bytes - sha256 `9dee03b20211d5b3fcb2e05ad4be85a00112dd00f03fc6e5c834969381f0e44e`
- `supabase/functions/catalog-report/privacy.test.ts` - 4009 bytes - sha256 `db9b6d1c812679297295c5afb6c8d0226c99f94b8aedefff620111d4fa9d7bac`
- `apps/mobile/src/features/catalog/client.ts` - 11357 bytes - sha256 `ac891d9253e2f2d81be440eda468ab02d0f9e3afddb84822be14f9a48f451438`
- `apps/mobile/src/features/catalog/client.test.ts` - 12335 bytes - sha256 `92250d319ea33fc14bb57c0bf131e732847762036f9ed132788033aea0c78dbd`
- `docs/FOR_TAS_TO_DO.md` - 11191 bytes - sha256 `a02a5647d2491966a701743128fbacab0dc57bf72f0067b305be98ffd469d56c`

### observability-support - Catalog dashboards, alerts, and support feedback loop

- Domain: operations
- Status: blocked
- Launch gate: B-CATALOG-COVERAGE
- Owner: Founder + support + engineering

Required evidence:

- Production catalog, analytics, and support dashboards exist under the final brand/account setup.
- Catalog miss, wrong-match, correction status, parser unknown-token, and support-ticket metrics are reviewed weekly during beta.
- Open P0/P1 catalog trust issues are zero before public launch.

Sources:

- `docs/phase-4/observability-dashboard.md` - 2488 bytes - sha256 `f2c94ee4b693a2b943134f0c7cbec737fb6017042c8aae3b27fb60330477b981`
- `docs/phase-4/beta-coverage-report.md` - 2125 bytes - sha256 `d657465c6bdf76f6084fd361cee5bb96c3ad5f92fecf99f93fc9d1cba8f3999d`
- `docs/phase-10/support-operations.md` - 4878 bytes - sha256 `bed258fc581aa469539542cbad95184e5314adb4a3b3ac11983b677cd4a00c7e`
- `docs/phase-10/support-beta-report.md` - 2149 bytes - sha256 `f25c3841a8bc5649dbd1f38632c756898da46a5d7f4d59ff7c328726dc9d26ac`
- `scripts/phase4/beta-coverage-report.mjs` - 22245 bytes - sha256 `708cc87185f72ee9356f73f75ec79c2543744647dae761aa347f55a81c86e4b7`
- `supabase/functions/catalog-report/privacy.ts` - 3504 bytes - sha256 `9dee03b20211d5b3fcb2e05ad4be85a00112dd00f03fc6e5c834969381f0e44e`
- `supabase/functions/catalog-report/privacy.test.ts` - 4009 bytes - sha256 `db9b6d1c812679297295c5afb6c8d0226c99f94b8aedefff620111d4fa9d7bac`
- `docs/FOR_TAS_TO_DO.md` - 11191 bytes - sha256 `a02a5647d2491966a701743128fbacab0dc57bf72f0067b305be98ffd469d56c`

## Blockers

- None.

## Warnings

- None.
