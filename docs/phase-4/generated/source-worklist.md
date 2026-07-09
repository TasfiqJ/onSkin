# Phase 4 Catalog Source Worklist

Generated: 2026-07-09T17:21:10.604Z
Status: pass
Git SHA: 5e08a00fdcb06bb4c01c53a9eac6b7fce23b32f7
Git status: DIRTY

This generated worklist is an operator handoff for the catalog/source launch
gate. It does not approve any catalog source, product batch, beta metric, or
recommendation use. It records the evidence Tas/counsel/reviewers/operators
must attach before Phase 4 can stop blocking launch.

## Summary

- Work items: 9
- Source files hashed: 111
- Missing source files: 0
- Blockers: 0
- Warnings: 1

## Items

| ID                        | Domain         | Area                                                        | Status         | Launch gate             | Sources | Missing sources |
| ------------------------- | -------------- | ----------------------------------------------------------- | -------------- | ----------------------- | ------- | --------------- |
| source-identity           | sourceReview   | Final catalog API identity and attribution surface          | blocked        | B-CATALOG-SOURCE-REVIEW | 6       | 0               |
| obf-odbl-posture          | sourceReview   | Open Beauty Facts and ODbL launch posture                   | blocked        | B-ODBL-REVIEW           | 8       | 0               |
| cosing-reuse-taxonomy     | sourceReview   | CosIng reuse and ingredient-tag taxonomy                    | blocked        | B-CATALOG-SOURCE-REVIEW | 7       | 0               |
| curated-first-batch       | curation       | First curated launch product batch                          | blocked        | B-CURATED-CATALOG       | 7       | 0               |
| import-qa                 | curation       | Import QA and generated catalog evidence                    | local-scaffold | B-CATALOG-SEED          | 5       | 0               |
| beta-coverage             | betaEvidence   | Closed-beta catalog coverage and correction loop            | blocked        | B-CATALOG-COVERAGE      | 7       | 0               |
| mobile-catalog-disclosure | productSurface | Mobile catalog source, quality, and report-issue disclosure | local-scaffold | B-CATALOG-SEED          | 54      | 0               |
| obf-contribution-back     | operations     | Unmatched-product contribution-back operation               | blocked        | B-SHELF-CONTRIB         | 9       | 0               |
| observability-support     | operations     | Catalog dashboards, alerts, and support feedback loop       | blocked        | B-CATALOG-COVERAGE      | 8       | 0               |

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

- `.env.example` - 15616 bytes - sha256 `09fde04cf7c14297e488d608a3f3e2067d3ac357543212debe3c7758ed98f6e1`
- `scripts/phase4/check-source-env.mjs` - 3454 bytes - sha256 `1b459b27d2ffae6220523741099e72fd57911b53e36b4c0beeb93eb2ea0103a4`
- `docs/phase-4/catalog-source-memo-open-beauty-facts.md` - 2335 bytes - sha256 `a44a08bcdff16133b3dd39a153252d10275774f1977aaf4bcd3add7df616dfa8`
- `docs/phase-4/catalog-source-memo-cosing.md` - 2022 bytes - sha256 `313a2e63ddaeae7d9621bb04fede565d7a6b2c65086b2a171af6467b5f976b78`
- `docs/phase-4/phase-4-exit-review.md` - 2235 bytes - sha256 `1d6760669e7c416ff4cca57995660d67c7b7225fc0f5a40edb88421596f0b5a3`
- `docs/FOR_TAS_TO_DO.md` - 36418 bytes - sha256 `829648ede250e845937be24826b014323d082b446301d77192a9faa1ee733389`

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

- `docs/phase-4/catalog-source-memo-open-beauty-facts.md` - 2335 bytes - sha256 `a44a08bcdff16133b3dd39a153252d10275774f1977aaf4bcd3add7df616dfa8`
- `docs/phase-4/odbl-compliance-memo.md` - 2020 bytes - sha256 `6316be05d79992a32321bd291e7b9eb965da14c12c9c0a3feb7e9ce0dfd69a79`
- `scripts/phase4/import-obf-snapshot.mjs` - 4814 bytes - sha256 `437b8ce58a661ac43aba2f64016bf5c5bff1dc63910ffeca36fd348047dd88af`
- `scripts/phase4/catalog-qa-report.mjs` - 6680 bytes - sha256 `9abfd57fc1937cd3f958955f2a0a747e2b9a420560443b11c658feb9d3b482ee`
- `supabase/migrations/20260614000026_phase4_catalog.sql` - 35102 bytes - sha256 `dc1a7f150bd5b285cf2d05f2583126ebeb97e67b5363666e670518896b93c311`
- `supabase/functions/catalog-lookup/index.ts` - 8315 bytes - sha256 `943138cd87be526acaea5c84acff7250967670bfe964805f315c8eb71a9f474c`
- `supabase/functions/catalog-search/index.ts` - 5351 bytes - sha256 `6469ad3fb88b6eba7e09bdc00a211618a2b25d36123ec6775bdb120c05c5c44d`
- `supabase/functions/catalog-report/index.ts` - 4604 bytes - sha256 `831529e201bf59a61f9eb929cc5939c14797fb9e0eb0b11e1bf817a6008517ec`

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

- `docs/phase-4/catalog-source-memo-cosing.md` - 2022 bytes - sha256 `313a2e63ddaeae7d9621bb04fede565d7a6b2c65086b2a171af6467b5f976b78`
- `docs/phase-4/ingredient-tag-taxonomy.md` - 2468 bytes - sha256 `76cc7112d24a682dee6d0b0fad9226b5d89ddea128cf0147d4ec7a4c503b629c`
- `scripts/phase4/import-cosing-dictionary.mjs` - 4025 bytes - sha256 `07918f71f397b59c5889995c479d6d1757f216edcaec0b8ac19fa64a9dc5e4b0`
- `apps/mobile/src/features/catalog/ingredientParser.ts` - 6876 bytes - sha256 `17f8524a0c96086b13807f9ecdd8d49cec6a8c945b7538ebc091e5c3917ab846`
- `apps/mobile/src/features/catalog/ingredientParser.test.ts` - 1498 bytes - sha256 `3d4cbbfb6a0137835695c8b17c701729192cc2040dcd9d5b2e4a2c60eec34814`
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

- `docs/phase-4/curated-product-curation-sheet.md` - 2097 bytes - sha256 `0b266036321d6147e9cca271877fc5152134a6a1b8412bd6316fba8e9784c3c8`
- `docs/phase-4/first-curated-product-batch.md` - 1402 bytes - sha256 `357b8712cff604a3d9787410bff9a0f2fbdf0b085c6d954eb92028e0b6267d5c`
- `scripts/phase4/fixtures/curated-products.sample.json` - 629 bytes - sha256 `6b60f46472fbd5c1a75c9ea7d65de2977bfd9b6e9f5aebb2dfb76a258b5b8328`
- `apps/mobile/src/features/catalog/quality.ts` - 4561 bytes - sha256 `99874e1beff9f2d87aad5254c6983b2b4fca2b0f6af9b74eedd616ee430ec7f9`
- `apps/mobile/src/features/catalog/quality.test.ts` - 2259 bytes - sha256 `05f97b04206ec104128c5f1f75940bb6768d6c7156e9e4dc1532975a1565b840`
- `apps/mobile/src/features/recommendations/catalog.ts` - 9381 bytes - sha256 `e5d35422d6e33398d362b5c2e4483da8808bf2654d83d470013f537aa09e59c4`
- `apps/mobile/src/features/recommendations/claimsafety.test.ts` - 8512 bytes - sha256 `ee4afa31d88ebb0b858fb62d25a21e4a1de1473ab30499803366ff39026e2024`

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

- `scripts/phase4/catalog-qa-report.mjs` - 6680 bytes - sha256 `9abfd57fc1937cd3f958955f2a0a747e2b9a420560443b11c658feb9d3b482ee`
- `scripts/phase4/catalog-qa-report-smoke.mjs` - 5504 bytes - sha256 `43e8b217e0a8276e0299f2477ddb3b4ab9536521d745514be2a48e68e7bf97a1`
- `scripts/phase4/import-obf-snapshot.mjs` - 4814 bytes - sha256 `437b8ce58a661ac43aba2f64016bf5c5bff1dc63910ffeca36fd348047dd88af`
- `scripts/phase4/import-cosing-dictionary.mjs` - 4025 bytes - sha256 `07918f71f397b59c5889995c479d6d1757f216edcaec0b8ac19fa64a9dc5e4b0`
- `scripts/docs/generated-packet-status-audit.mjs` - 11748 bytes - sha256 `ddafd263ac29b217a1a86af04d74df0b21cd298af09cb669a91c5c3ec672f332`

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

- `docs/phase-4/beta-coverage-report.md` - 1854 bytes - sha256 `5fb792bcaf7004c9ce2f44f75eaf866f7bdba230e04116936f54a99cd9b873f6`
- `scripts/phase4/beta-coverage-report.mjs` - 21407 bytes - sha256 `b9c92a82c29de2bab80ec56fa2bdaf2742e3d0aa202775e4334b3012d14f3da4`
- `scripts/phase4/beta-coverage-report-smoke.mjs` - 7566 bytes - sha256 `0a145db27b355e3bf1a25a509f583559a8ca2728e73d2c8385b3f6da7a866732`
- `docs/phase-10/catalog-beta-report.md` - 1291 bytes - sha256 `2924dac7cc798a904716b0fbc7de6760046485e85db62e3357c901519081bd3c`
- `docs/phase-10/support-beta-report.md` - 1486 bytes - sha256 `68bcd8e27b511229e2c1e9d5bb84ba97eac658b66f5bf04b8eb550c8838c9af3`
- `docs/phase-10/retention-activation-report.md` - 1685 bytes - sha256 `0e93cb0c1662d2ea3c35282dda19cc1d4188cb8c1c4a9cc52cbe5d996e9002ba`
- `docs/FOR_TAS_TO_DO.md` - 36418 bytes - sha256 `829648ede250e845937be24826b014323d082b446301d77192a9faa1ee733389`

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

- `apps/mobile/src/features/catalog/client.test.ts` - 4115 bytes - sha256 `39405ec911d268db14b802ebb80156f0e0cc28e7061e5caee66dab7116cf28e7`
- `apps/mobile/src/features/catalog/client.ts` - 4003 bytes - sha256 `968d5b6a45cc265d41ce3b626cdc29fc35ba279cb86fc7fc9f46c600e07f6bba`
- `apps/mobile/src/features/catalog/copy.ts` - 1913 bytes - sha256 `b182cec74cb72f850e83dcca14a5548c6277d73a9eaac229f6062e665090f958`
- `apps/mobile/src/features/catalog/ingredientParser.test.ts` - 1498 bytes - sha256 `3d4cbbfb6a0137835695c8b17c701729192cc2040dcd9d5b2e4a2c60eec34814`
- `apps/mobile/src/features/catalog/ingredientParser.ts` - 6876 bytes - sha256 `17f8524a0c96086b13807f9ecdd8d49cec6a8c945b7538ebc091e5c3917ab846`
- `apps/mobile/src/features/catalog/normalization.test.ts` - 751 bytes - sha256 `5464268a0599fdcb3abfc5f4f451476f83ebf2f1c2ca3681514453f1a35790d1`
- `apps/mobile/src/features/catalog/normalization.ts` - 2204 bytes - sha256 `7d3f9a945d1f7e17aaae4285f96b8fa0f680c527a507bec22d636c3f1efc5083`
- `apps/mobile/src/features/catalog/obf.test.ts` - 1863 bytes - sha256 `a07b1dd6b7c2c9e33a3060950a3f86e1174ccf27a41c2001350a69dfa8d5241d`
- `apps/mobile/src/features/catalog/obf.ts` - 4341 bytes - sha256 `1a2f75c6572b48ac7626d4514520a1c7dd173219fd901efb4df985d92b2fe157`
- `apps/mobile/src/features/catalog/quality.test.ts` - 2259 bytes - sha256 `05f97b04206ec104128c5f1f75940bb6768d6c7156e9e4dc1532975a1565b840`
- `apps/mobile/src/features/catalog/quality.ts` - 4561 bytes - sha256 `99874e1beff9f2d87aad5254c6983b2b4fca2b0f6af9b74eedd616ee430ec7f9`
- `apps/mobile/src/features/shelf/analytics.test.ts` - 543 bytes - sha256 `fce0e7cd2128b9c01644369a7dde86d178f44aaa80b0c7f9a58079ab08d4cc17`
- `apps/mobile/src/features/shelf/analytics.ts` - 599 bytes - sha256 `1e514f5fc1a96111a8b792dc8841ad41a11130dd6de7031eb08a353f85ef1050`
- `apps/mobile/src/features/shelf/categories.test.ts` - 2124 bytes - sha256 `4aae0710713ddf321c7cb078b8434b4c77931270f68591802be2d2366cbdf4a9`
- `apps/mobile/src/features/shelf/categories.ts` - 2696 bytes - sha256 `aebb87c48e67cf211f4f878d47ff22eca0705133940b9202addda56cbde035c6`
- `apps/mobile/src/features/shelf/expiry.ts` - 993 bytes - sha256 `a9442bc51ab8761763f774e4e48c04e5d0bad11640486e2a983e61876b05a0d5`
- `apps/mobile/src/features/shelf/IntakeContext.tsx` - 2833 bytes - sha256 `afc1156ac26b2a759511c95e8acc7f84ab8b6487d46f72c359c3dc4fee6c3252`
- `apps/mobile/src/features/shelf/labels.ts` - 612 bytes - sha256 `1a5fbe77abdf30f9b8286625effa24e240444bcbf3be8f5a8663693a17a855eb`
- `apps/mobile/src/features/shelf/metadata.ts` - 1372 bytes - sha256 `87178aae2ac9df43a91f5815a54d3f91c71a3da5c7e1777a545122d23a1628be`
- `apps/mobile/src/features/shelf/mutations.ts` - 3567 bytes - sha256 `2f297f5dc58b6820309f207d07d6bf8ab403cfa30e5f62b6611e44564546806c`
- `apps/mobile/src/features/shelf/pairedConflicts.ts` - 771 bytes - sha256 `7b87abe51db6e2af8a5b213b52b1a32f4a1af87bfaf372db323d5cfc7dce3678`
- `apps/mobile/src/features/shelf/paoProvenance.test.ts` - 909 bytes - sha256 `e9b4d0c1dd6c19d3a833a18c6b2c2aecb79c1872d6bfff9d71585cb0b06d4855`
- `apps/mobile/src/features/shelf/paoProvenance.ts` - 429 bytes - sha256 `004ec2dc224ec22076481a3b84242573a5f08f6bf87ccdc90c3d003de97c4aec`
- `apps/mobile/src/features/shelf/scanLog.test.ts` - 4472 bytes - sha256 `8510e109ebd01569344f623ff002576a588d39a6bc04592685c242852551ce0f`
- `apps/mobile/src/features/shelf/scanLog.ts` - 1867 bytes - sha256 `0a00c94a4de9c3dedc2815b64340e9195c4f26971910f58fd8ca8066315bc28d`
- `apps/mobile/src/features/shelf/shelfRoutes.test.ts` - 42220 bytes - sha256 `a4d62e8fbc498aa8f3da61715e236b55c409e1a76c463404410c7243f097ba20`
- `apps/mobile/src/features/shelf/store.test.ts` - 4504 bytes - sha256 `6877eeedecd0b6680a764c61fba2dbcb012680e8e6c5d3230573105dd2548cda`
- `apps/mobile/src/features/shelf/store.ts` - 12890 bytes - sha256 `416a05c75ac9c6c5e86cfd12e7bef9d30f3992ad0d963f4e874fecdda20ac705`
- `apps/mobile/src/features/shelf/useShelf.test.ts` - 3709 bytes - sha256 `4c0e9666689722778f642729ab0e12091ffa92e1e5184cff8a908a745182da37`
- `apps/mobile/src/features/shelf/useShelf.ts` - 8783 bytes - sha256 `0fb8fe03586758ea85aabc8d825cd42d4aeb007c5eb62b45a6d9ee2eb6980261`
- `apps/mobile/src/app/shelf/[id].tsx` - 28902 bytes - sha256 `b82a2c09fe1cfe41975d54a19a58d5c2f31aa13fde6c9a996a67134b77432019`
- `apps/mobile/src/app/shelf/search.tsx` - 7411 bytes - sha256 `810fa476120670243d23d8fc8d61feb7ddbc8e34c86bd26b334842caf20ead79`
- `apps/mobile/src/app/shelf/manual.tsx` - 13837 bytes - sha256 `52ca7524948f5ad3a7485ce7be8be97d14d25ae55119f010ff1513baef291227`
- `apps/mobile/src/features/recommendations/applyPreferences.test.ts` - 1319 bytes - sha256 `751559e6d23b979ffe0cd2924d42f30eb41b591f6427bf13d27c175cffdb75a3`
- `apps/mobile/src/features/recommendations/applyPreferences.ts` - 493 bytes - sha256 `50dabada0ac3066adf7bd455e93c95ee89b5838079a2f737ff7d36b57d02b0f3`
- `apps/mobile/src/features/recommendations/catalog.ts` - 9381 bytes - sha256 `e5d35422d6e33398d362b5c2e4483da8808bf2654d83d470013f537aa09e59c4`
- `apps/mobile/src/features/recommendations/claimsafety.test.ts` - 8512 bytes - sha256 `ee4afa31d88ebb0b858fb62d25a21e4a1de1473ab30499803366ff39026e2024`
- `apps/mobile/src/features/recommendations/copy.ts` - 6697 bytes - sha256 `2ad5032b99268c20853bedbf4d4cf03b3ce562e82e664ed8c153339b3f4433cf`
- `apps/mobile/src/features/recommendations/engine.test.ts` - 10226 bytes - sha256 `24c101fe9e4bde58cba13e47af366ffb45ab703cf4564573fb968a2ea42a1162`
- `apps/mobile/src/features/recommendations/engine.ts` - 15342 bytes - sha256 `787257b5591e3cb2f7e86bbadcd3dc1e25c8b6c3bf08080d640f129962540df4`
- `apps/mobile/src/features/recommendations/fit.test.ts` - 4419 bytes - sha256 `c3e7dc2a6a757ece8f27ae019ef6fc6a41d3c730f657e6cf8db902aabb50df93`
- `apps/mobile/src/features/recommendations/fit.ts` - 5650 bytes - sha256 `53030a7d1537eaf7567b861bd72368f829b82d79a4323285d570a6a6da823745`
- `apps/mobile/src/features/recommendations/loading.ts` - 251 bytes - sha256 `9c611cd49e793cc1161ecd665ee790bb056014b28a8d2f928a20bf59c0d7294d`
- `apps/mobile/src/features/recommendations/preferences.ts` - 647 bytes - sha256 `055882921e6e68b018b75aa075d93214119fa098add0c3e2665f96dadc77ebbf`
- `apps/mobile/src/features/recommendations/recommendationRoutes.test.ts` - 14653 bytes - sha256 `a0bff4bbcc4dbf7eda7672df73ce449e39b726e4236feaa08308fcc8417b8995`
- `apps/mobile/src/features/recommendations/RecommendationsTeaser.test.ts` - 3590 bytes - sha256 `6f0d92c8fb2f1165be38c25b7bc2b6aa6ba582bfda66e86b7099e7ed78bb4340`
- `apps/mobile/src/features/recommendations/RecommendationsTeaser.tsx` - 8154 bytes - sha256 `e7f0a45a96459b892d81a36c3a5f196864b7f9bec210f4be880dee58706e75f0`
- `apps/mobile/src/features/recommendations/store.test.ts` - 3232 bytes - sha256 `ef032d38c8d630abaee8072724276b590e0223dae3e8995522e8a9771e579a0d`
- `apps/mobile/src/features/recommendations/store.ts` - 5632 bytes - sha256 `bf8890e423058ebe067aa925d1ec76b5b7cd168560558cd8a49ee8701da5d7ef`
- `apps/mobile/src/features/recommendations/useRecommendations.test.ts` - 1006 bytes - sha256 `9c1908c337df4cc3abd8a4fb12fcf12bca2d82b985b4043189a4347ab65fe44a`
- `apps/mobile/src/features/recommendations/useRecommendations.ts` - 2491 bytes - sha256 `f279c9c9ba518afe6392b1717c604ded0786dd18bddd4d69ea3fb912107050a2`
- `supabase/functions/catalog-report/index.ts` - 4604 bytes - sha256 `831529e201bf59a61f9eb929cc5939c14797fb9e0eb0b11e1bf817a6008517ec`
- `supabase/functions/catalog-report/privacy.ts` - 3497 bytes - sha256 `d0d39665dc489392ff8d29c524d46ee182695772cf0fc7293c1c9d93c53e2c8e`
- `supabase/functions/catalog-report/privacy.test.ts` - 3819 bytes - sha256 `1a6014b406eba2e771901906309e78162321af3352af63d33d20fd017df70c76`

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

- `docs/phase-4/odbl-compliance-memo.md` - 2020 bytes - sha256 `6316be05d79992a32321bd291e7b9eb965da14c12c9c0a3feb7e9ce0dfd69a79`
- `docs/04-smart-shelf.md` - 54123 bytes - sha256 `7ba337c03c868a9fe53e187b5a5ec1cf2cafdb2782387a1e1839c3837dc6cb15`
- `supabase/migrations/20260614000026_phase4_catalog.sql` - 35102 bytes - sha256 `dc1a7f150bd5b285cf2d05f2583126ebeb97e67b5363666e670518896b93c311`
- `supabase/functions/catalog-report/index.ts` - 4604 bytes - sha256 `831529e201bf59a61f9eb929cc5939c14797fb9e0eb0b11e1bf817a6008517ec`
- `supabase/functions/catalog-report/privacy.ts` - 3497 bytes - sha256 `d0d39665dc489392ff8d29c524d46ee182695772cf0fc7293c1c9d93c53e2c8e`
- `supabase/functions/catalog-report/privacy.test.ts` - 3819 bytes - sha256 `1a6014b406eba2e771901906309e78162321af3352af63d33d20fd017df70c76`
- `apps/mobile/src/features/catalog/client.ts` - 4003 bytes - sha256 `968d5b6a45cc265d41ce3b626cdc29fc35ba279cb86fc7fc9f46c600e07f6bba`
- `apps/mobile/src/features/catalog/client.test.ts` - 4115 bytes - sha256 `39405ec911d268db14b802ebb80156f0e0cc28e7061e5caee66dab7116cf28e7`
- `docs/FOR_TAS_TO_DO.md` - 36418 bytes - sha256 `829648ede250e845937be24826b014323d082b446301d77192a9faa1ee733389`

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

- `docs/phase-4/observability-dashboard.md` - 1804 bytes - sha256 `a42191be85ab1d75e0c7d9cce2934b0e52369852da35bdd6edf2c153fc6f09af`
- `docs/phase-4/beta-coverage-report.md` - 1854 bytes - sha256 `5fb792bcaf7004c9ce2f44f75eaf866f7bdba230e04116936f54a99cd9b873f6`
- `docs/phase-10/support-operations.md` - 2697 bytes - sha256 `2dedf1baab29c8e3bd0e1dcc9c248ffc1ade2e9d7cdbf05d217094208a87245d`
- `docs/phase-10/support-beta-report.md` - 1486 bytes - sha256 `68bcd8e27b511229e2c1e9d5bb84ba97eac658b66f5bf04b8eb550c8838c9af3`
- `scripts/phase4/beta-coverage-report.mjs` - 21407 bytes - sha256 `b9c92a82c29de2bab80ec56fa2bdaf2742e3d0aa202775e4334b3012d14f3da4`
- `supabase/functions/catalog-report/privacy.ts` - 3497 bytes - sha256 `d0d39665dc489392ff8d29c524d46ee182695772cf0fc7293c1c9d93c53e2c8e`
- `supabase/functions/catalog-report/privacy.test.ts` - 3819 bytes - sha256 `1a6014b406eba2e771901906309e78162321af3352af63d33d20fd017df70c76`
- `docs/FOR_TAS_TO_DO.md` - 36418 bytes - sha256 `829648ede250e845937be24826b014323d082b446301d77192a9faa1ee733389`

## Blockers

- None.

## Warnings

- Phase 4 source worklist generated with a dirty Git worktree; do not use it as final catalog-source evidence.
