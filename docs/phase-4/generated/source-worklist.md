# Phase 4 Catalog Source Worklist

Generated: 2026-07-18T15:51:54.557Z
Status: pass
Git SHA: 2d5cb849ac0f926556df7a991be39074a1640fc8
Git status: clean

This generated worklist is an operator handoff for the catalog/source launch
gate. It does not approve any catalog source, product batch, beta metric, or
recommendation use. It records the evidence Tas/counsel/reviewers/operators
must attach before Phase 4 can stop blocking launch.

## Summary

- Work items: 13
- Source files hashed: 256
- Missing source files: 0
- Blockers: 0
- Warnings: 0

## Items

| ID                                | Domain         | Area                                                                  | Status         | Launch gate             | Sources | Missing sources |
| --------------------------------- | -------------- | --------------------------------------------------------------------- | -------------- | ----------------------- | ------- | --------------- |
| source-identity                   | sourceReview   | Final catalog release identity, trust, build, and attribution surface | blocked        | B-CATALOG-SOURCE-REVIEW | 14      | 0               |
| obf-odbl-posture                  | sourceReview   | Open Beauty Facts and ODbL launch posture                             | blocked        | B-ODBL-REVIEW           | 17      | 0               |
| cosing-reuse-taxonomy             | sourceReview   | CosIng reuse and ingredient-tag taxonomy                              | blocked        | B-CATALOG-SOURCE-REVIEW | 16      | 0               |
| curated-first-batch               | curation       | First curated launch product batch                                    | blocked        | B-CURATED-CATALOG       | 21      | 0               |
| import-qa                         | curation       | Import QA and generated catalog evidence                              | local-scaffold | B-CATALOG-SEED          | 13      | 0               |
| beta-coverage                     | betaEvidence   | Closed-beta catalog coverage and correction loop                      | blocked        | B-CATALOG-COVERAGE      | 19      | 0               |
| catalog-promotion-lifecycle       | curation       | Reviewed catalog staging, promotion, lineage, and rollback            | local-scaffold | B-CATALOG-SEED          | 8       | 0               |
| catalog-launch-curation-lifecycle | curation       | Signed launch curation, positive serving authority, and retirement    | local-scaffold | B-CURATED-CATALOG       | 21      | 0               |
| mobile-catalog-disclosure         | productSurface | Mobile catalog source, quality, and report-issue disclosure           | local-scaffold | B-CATALOG-SEED          | 60      | 0               |
| catalog-freshness-provenance      | productSurface | Catalog-backed Shelf freshness and provenance contract                | local-scaffold | B-CATALOG-SEED          | 33      | 0               |
| catalog-serving-gate              | productSurface | Fail-closed production catalog serving boundary                       | local-scaffold | B-CATALOG-SEED          | 16      | 0               |
| first-party-correction-report     | operations     | First-party missing-product and wrong-match operation                 | blocked        | B-SHELF-CONTRIB         | 10      | 0               |
| observability-support             | operations     | Catalog dashboards, alerts, and support feedback loop                 | blocked        | B-CATALOG-COVERAGE      | 8       | 0               |

## Item Details

### source-identity - Final catalog release identity, trust, build, and attribution surface

- Domain: sourceReview
- Status: blocked
- Launch gate: B-CATALOG-SOURCE-REVIEW
- Owner: Founder + counsel + engineering

Required evidence:

- Final cleared app name, production version, support email, and attribution URL.
- `phase4:check-source-env:strict` passes with production values.
- Counsel-approved public source/attribution copy under the final brand domain.
- The fixed release scope is approved for the exact display name, bundle ID, version, iOS build number, final host, support email, US territory, and attribution surface.
- The reviewed positive-decimal iOS build number is manually advanced before commit A, embedded by production app config, and never delegated to EAS auto-increment.
- The current reviewer registry is signed by the external trust root and matches the separately pinned epoch and raw-file SHA-256.
- Signed build evidence binds the exact EAS production iOS build ID/Git commit/resolved Expo config, IPA and Info.plist hashes, App Store Connect app, and US availability evidence.
- `phase4:source-policy-audit` passes in exactly three coherent states: pending/pending/pending baseline; active/approved/pending build candidate; and active/approved/verified release. Every other trust/scope/build mix fails.
- Clean commit A is the EAS build candidate; evidence-only descendant B records verified build evidence bound to A without changing the approved transformer/config payload.

Sources:

- `.env.example` - 27455 bytes - sha256 `0984b7c39628ce57f90fc39918b7863b7878335cf3c04fa33a69f1abd9bc5117`
- `scripts/phase4/check-source-env.mjs` - 2989 bytes - sha256 `ad8eaa253c3dd97fd6ea09a1cdbf11fb1aec96212a90a610e690a74981989a1a`
- `docs/phase-4/catalog-source-memo-open-beauty-facts.md` - 10698 bytes - sha256 `e9214896b57d59414865dd221ae14f8ca811a47190d1b1ab247781f389c424bf`
- `docs/phase-4/catalog-source-memo-cosing.md` - 6696 bytes - sha256 `4e8b2194655050f0df044e377ffb52d5b9a67e5bb96fc36618b9cf732b6baaa4`
- `docs/phase-4/README.md` - 6311 bytes - sha256 `0d49087378c85107b134c056ecf773a5849c0570a34975eed51d8df727dc7103`
- `docs/phase-4/catalog-source-policy.json` - 7249 bytes - sha256 `79005f1111af670bb8ce11d128627ecde9a59a8f323e2cf9170dfe50c8c2a050`
- `docs/phase-4/catalog-source-trust-registry.json` - 235 bytes - sha256 `13a7f7ca9ac84b31351d1f343bd7e67117fec9b46fa66d60f6c3bdd98e70e824`
- `docs/phase-4/catalog-release-scope.json` - 341 bytes - sha256 `2d02ca4376b1e92ce37901ac67fd0b6dcb05c3a3f8525c881a6925bc68ffb0df`
- `docs/phase-4/catalog-release-build-evidence.json` - 481 bytes - sha256 `c0b7b51ad2e3e2fd864d25d2ae46b451d6cae1a1e1768d983c168c192dab4254`
- `docs/phase-4/catalog-source-release-runbook.md` - 14619 bytes - sha256 `ac3794fe673f042bd11a57a7cfb95025c66c1b28c1f890c425fbea420ab391a1`
- `scripts/phase4/catalog-source-policy-audit.mjs` - 8633 bytes - sha256 `f477b1bcaa8b6b7997cded65b63c21e7dbfc23a3c75d169720961f5eb3b6879c`
- `scripts/phase4/source-policy.mjs` - 87622 bytes - sha256 `94053b1914ea094bc10b29d041c78cc71d62ed5ea7080981e0feef45695a110e`
- `docs/phase-4/phase-4-exit-review.md` - 9410 bytes - sha256 `d5c45471ddfce80c4a4069c1c660a664cefe6a2de6710b1b31ee7c5306838a90`
- `docs/FOR_TAS_TO_DO.md` - 11239 bytes - sha256 `11b6df522e34a3b1a3ad8e130cf07345a8e91059efee6f4399d27360026c2825`

### obf-odbl-posture - Open Beauty Facts and ODbL launch posture

- Domain: sourceReview
- Status: blocked
- Launch gate: B-ODBL-REVIEW
- Owner: Counsel + engineering

Required evidence:

- Counsel records whether OBF data can be used for the launch catalog and under what attribution/share-alike obligations.
- Product images remain disabled unless image rights are separately approved.
- Bulk import uses approved export artifacts, not API crawling or search-as-you-type scraping.
- A detached approval based on `obf-source-approval.template.json` records the exact artifact bytes/SHA-256, transformed-payload hash, source snapshot, current policy/trust/scope/transformer hashes, territories/fields, database-combination/share-alike/offer-of-data decisions, operations evidence, and public attribution/data-delivery evidence.
- The current filtering/normalization transformer uses only the conservative derivative-database plus entire-derivative-or-alterations machine-readable delivery path; a collective-component conclusion requires a new reviewed transformer/policy revision.
- Distinct active legal and engineering Ed25519 identities sign the same canonical approval payload; neither checked-in pending template nor a single reviewer can authorize production.

Sources:

- `docs/phase-4/catalog-source-memo-open-beauty-facts.md` - 10698 bytes - sha256 `e9214896b57d59414865dd221ae14f8ca811a47190d1b1ab247781f389c424bf`
- `docs/phase-4/odbl-compliance-memo.md` - 5099 bytes - sha256 `ed14fda2e129ee22293ab5d28433626971c0ba8998034547e5f15dc23746c191`
- `docs/phase-4/catalog-source-policy.json` - 7249 bytes - sha256 `79005f1111af670bb8ce11d128627ecde9a59a8f323e2cf9170dfe50c8c2a050`
- `docs/phase-4/obf-source-approval.template.json` - 8479 bytes - sha256 `9ffa7441d5d9efbf3662aef4509cf9c5cf21b66e296ce07838acaf9fe25ede15`
- `docs/phase-4/catalog-source-trust-registry.json` - 235 bytes - sha256 `13a7f7ca9ac84b31351d1f343bd7e67117fec9b46fa66d60f6c3bdd98e70e824`
- `docs/phase-4/catalog-release-scope.json` - 341 bytes - sha256 `2d02ca4376b1e92ce37901ac67fd0b6dcb05c3a3f8525c881a6925bc68ffb0df`
- `docs/phase-4/catalog-release-build-evidence.json` - 481 bytes - sha256 `c0b7b51ad2e3e2fd864d25d2ae46b451d6cae1a1e1768d983c168c192dab4254`
- `docs/phase-4/catalog-source-release-runbook.md` - 14619 bytes - sha256 `ac3794fe673f042bd11a57a7cfb95025c66c1b28c1f890c425fbea420ab391a1`
- `scripts/phase4/import-obf-snapshot.mjs` - 12929 bytes - sha256 `3efd8d761fec3fa19ec1fd90e0445c46c684382bb0624fd76f0fc5c4f49b2608`
- `scripts/phase4/source-policy.mjs` - 87622 bytes - sha256 `94053b1914ea094bc10b29d041c78cc71d62ed5ea7080981e0feef45695a110e`
- `scripts/phase4/source-policy.test.mjs` - 38524 bytes - sha256 `12c69f6082cd11f667f9c605713930b1f6c21f17c6c7042005173a20b7ce9f2f`
- `scripts/phase4/catalog-qa-report.mjs` - 26987 bytes - sha256 `44f66cf82c7676af4e89355726c396565bbc476271218c7c2e9b6e8954f24977`
- `supabase/migrations/20260614000026_phase4_catalog.sql` - 35102 bytes - sha256 `dc1a7f150bd5b285cf2d05f2583126ebeb97e67b5363666e670518896b93c311`
- `supabase/functions/catalog-lookup/index.ts` - 10199 bytes - sha256 `231dd6175ac99232bf7b263e2152311e8d8ccbe9dd008dcdb12c5321926f27c1`
- `supabase/functions/catalog-search/index.ts` - 9227 bytes - sha256 `640842b71581aac2f7a01870d27a8e951614bc282e5686cbf9d9564ad5c810fc`
- `supabase/functions/catalog-report/index.ts` - 9332 bytes - sha256 `c8dfe55ddfc44165a20822f9bfa1733c7ae116224d673822acce0c5c5318fecf`
- `supabase/migrations/20260717000056_catalog_serving_eligibility_gate.sql` - 34119 bytes - sha256 `0d4543effd4eb5c6d5e036b96d777b217bf853fb0c9587575429a28f14d7793c`

### cosing-reuse-taxonomy - CosIng reuse and ingredient-tag taxonomy

- Domain: sourceReview
- Status: blocked
- Launch gate: B-CATALOG-SOURCE-REVIEW
- Owner: Counsel + cosmetic chemist

Required evidence:

- Counsel records CosIng reuse and attribution obligations.
- Cosmetic chemist signs the ingredient-tag taxonomy and confirms CosIng is not presented as product-level approval.
- Parser import artifact records exact artifact bytes/SHA-256, snapshot date, parser/transformer bundle, transformed-payload hash, and CosIng QA output hash.
- A detached approval based on `cosing-source-approval.template.json` records exact policy/trust/scope/transformer hashes, fields/territories, reuse/attribution/third-party-rights decisions, glossary decision, evidence, and owners.
- Distinct active legal and engineering Ed25519 identities sign the same canonical approval payload; neither checked-in pending template nor a single reviewer can authorize production.

Sources:

- `docs/phase-4/catalog-source-memo-cosing.md` - 6696 bytes - sha256 `4e8b2194655050f0df044e377ffb52d5b9a67e5bb96fc36618b9cf732b6baaa4`
- `docs/phase-4/ingredient-tag-taxonomy.md` - 3276 bytes - sha256 `8b2af877c4cbdd0f6a7f4f965ded0ece300710e7bb2adbe97c97d5aaef26b83f`
- `docs/phase-4/catalog-source-policy.json` - 7249 bytes - sha256 `79005f1111af670bb8ce11d128627ecde9a59a8f323e2cf9170dfe50c8c2a050`
- `docs/phase-4/cosing-source-approval.template.json` - 8088 bytes - sha256 `05ccfb90c2f7a3eed49571b1fc7d4b87fde28186d644d6cb53671456b7ba5fd3`
- `docs/phase-4/catalog-source-trust-registry.json` - 235 bytes - sha256 `13a7f7ca9ac84b31351d1f343bd7e67117fec9b46fa66d60f6c3bdd98e70e824`
- `docs/phase-4/catalog-release-scope.json` - 341 bytes - sha256 `2d02ca4376b1e92ce37901ac67fd0b6dcb05c3a3f8525c881a6925bc68ffb0df`
- `docs/phase-4/catalog-release-build-evidence.json` - 481 bytes - sha256 `c0b7b51ad2e3e2fd864d25d2ae46b451d6cae1a1e1768d983c168c192dab4254`
- `docs/phase-4/catalog-source-release-runbook.md` - 14619 bytes - sha256 `ac3794fe673f042bd11a57a7cfb95025c66c1b28c1f890c425fbea420ab391a1`
- `scripts/phase4/import-cosing-dictionary.mjs` - 13351 bytes - sha256 `470016b20d8e5ecb4be94fb83d891c051cb10f42d702d60cde284466579da47a`
- `scripts/phase4/source-policy.mjs` - 87622 bytes - sha256 `94053b1914ea094bc10b29d041c78cc71d62ed5ea7080981e0feef45695a110e`
- `scripts/phase4/source-policy.test.mjs` - 38524 bytes - sha256 `12c69f6082cd11f667f9c605713930b1f6c21f17c6c7042005173a20b7ce9f2f`
- `apps/mobile/src/features/catalog/ingredientParser.ts` - 6913 bytes - sha256 `1030094651254b5e6a934ae515bd42bf2f10ba10229b1164a12d3fd2ca99eee4`
- `apps/mobile/src/features/catalog/ingredientParser.test.ts` - 1497 bytes - sha256 `fc196a7b95de58ed71a6deff1d9df7afb4ea394b00ca482e8b1eae27204baf25`
- `apps/mobile/src/features/intelligence/tags.ts` - 5155 bytes - sha256 `45bad7e06d4afed653aa6d24da8fc991a3971ea0e219155e19c630a083477af4`
- `apps/mobile/src/features/intelligence/tags.test.ts` - 1791 bytes - sha256 `cc38be3e5c48bbcc1df28427dc326b1583222812d9dc3693d066c19d8de54b7e`
- `scripts/phase4/catalog-qa-report.mjs` - 26987 bytes - sha256 `44f66cf82c7676af4e89355726c396565bbc476271218c7c2e9b6e8954f24977`

### curated-first-batch - First curated launch product batch

- Domain: curation
- Status: blocked
- Launch gate: B-CURATED-CATALOG
- Owner: Founder + catalog operator + clinical reviewers

Required evidence:

- Approval-bound hash-only OBF and CosIng candidates are regenerated under ignored `artifacts/phase4/` from clean active/approved/pending build-candidate commit A; candidates are never promotable.
- Approved exact source artifacts drive product facts; a separately consented, privacy-minimized beta-shelf coverage corpus may prioritize records but cannot authorize or alter a product field.
- A pre-outcome signed target policy splits a curation corpus from an untouched holdout and defines denominators, minimum samples, suppression, confidence bounds, and priority-category gates.
- Recommendable rows are `verified` or `usable`, independently reviewed, correction-free, provenance-complete, and bound to the exact active global CAT-03 campaign plus product authorization.
- Sunscreen/US-OTC-adjacent rows bind a dated market-classification source, label/expiry evidence, and a distinct qualified regulatory review.
- CAT-02 promotion and CAT-03 preactivation authorization require exact source approvals, build evidence, QA, lineage, reviewer-role separation, and holdout/inventory gates; product authorizations remain non-serving until one exact-set atomic campaign release, after which an independent signed database readback can establish point-in-time final-clear.

Sources:

- `docs/phase-4/curated-product-curation-sheet.md` - 8390 bytes - sha256 `f8b6ffd0ff144fc9b5219e1be8d624d5b1fafc6d5051b3199e5ed5cc0d5b23ff`
- `docs/phase-4/first-curated-product-batch.md` - 9784 bytes - sha256 `7ae00318912a50d2843eb833e18202b7a31d3db6a97474125a28cefc4c57fa04`
- `docs/phase-4/catalog-curation-release-runbook.md` - 40936 bytes - sha256 `a5775450aa2ed0bb59c37962964ea11a6f23f209b5c4c26bb970e82ee9771bef`
- `docs/phase-4/catalog-coverage-quality-targets.template.json` - 9408 bytes - sha256 `e53c6c5d2715392dab63930046836e1c7b832a007419508a778dd085c54846c1`
- `docs/phase-4/beta-shelf-corpus.template.json` - 24386 bytes - sha256 `55a44a32ecd47ed53a7a7ba1b8a1694ea936a69768668e9a739f0218d98420a5`
- `docs/phase-4/catalog-curation-review.template.json` - 22649 bytes - sha256 `47c15809a4db10ff82855c97405e3b01bca520df1d389b90baa44b6346658390`
- `docs/phase-4/catalog-cat02-membership-proof.template.json` - 9254 bytes - sha256 `e4d9ec3cfc09aca71972eb141577492e7bf17cab3a0a78ebd393cdc3fe152c56`
- `docs/phase-4/catalog-curation-database-readback.template.json` - 8239 bytes - sha256 `98efb09bf33c5ef326534ddf6ce888594968bbf50e5bf953d651cb297b47f341`
- `docs/phase-3/consent-matrix.md` - 16199 bytes - sha256 `72dea59e32637652495e66be3d882714f4fef1ff43fa4f795fbc28b42c9edb9a`
- `docs/phase-3/data-inventory.md` - 36362 bytes - sha256 `39cf1a9caf5c435fafa23f0074ad4934dfeab6243ef0764949a504b9382a2eda`
- `docs/store-privacy-inventory.md` - 31965 bytes - sha256 `620804f163e296ed0faac3bff466fe47f16c86ae5789b8f7bde687938a2342a7`
- `docs/phase-4/catalog-source-release-runbook.md` - 14619 bytes - sha256 `ac3794fe673f042bd11a57a7cfb95025c66c1b28c1f890c425fbea420ab391a1`
- `scripts/phase4/catalog-curation-contract.mjs` - 228766 bytes - sha256 `12d281bb397fea70f4ae8447638df7f86231f655b23b77d3bc9bec8adfaadf58`
- `scripts/phase4/catalog-curation-contract.test.mjs` - 112005 bytes - sha256 `f94c977337a54e486d5e6867866077374550b10cc7cbd1bcb54c96b892f5d7fd`
- `scripts/phase4/build-catalog-curation-envelope.mjs` - 4096 bytes - sha256 `d31aa8d2bea0d2640ac4b343bf91261446aafc3155a9e7ce74e4f9406c760bd5`
- `scripts/phase4/catalog-coverage-quality-report.mjs` - 5480 bytes - sha256 `f5fc81ea9f2d31fcec3185fed837634506c89197f7f51777f0c174fa1ab17216`
- `scripts/phase4/catalog-coverage-quality-report.test.mjs` - 6586 bytes - sha256 `616881a177d87b435f75ec39dfbe01eb2bc8dd4d91ff25b50da6c6a776dbb204`
- `scripts/phase4/import-obf-snapshot.mjs` - 12929 bytes - sha256 `3efd8d761fec3fa19ec1fd90e0445c46c684382bb0624fd76f0fc5c4f49b2608`
- `scripts/phase4/import-cosing-dictionary.mjs` - 13351 bytes - sha256 `470016b20d8e5ecb4be94fb83d891c051cb10f42d702d60cde284466579da47a`
- `supabase/migrations/20260717000058_catalog_launch_curation.sql` - 295282 bytes - sha256 `f2d53caad23347103e29b0f5660eefdbdd22bfdc05cc2cb47445ece4192919a6`
- `supabase/tests/database/catalog_launch_curation.test.sql` - 165458 bytes - sha256 `65e83a28fea146952f84b54dd2123f8fc93d69e4b9d3af5d0cbb9c84381115d0`

### import-qa - Import QA and generated catalog evidence

- Domain: curation
- Status: local-scaffold
- Launch gate: B-CATALOG-SEED
- Owner: Engineering + catalog operator

Required evidence:

- Production import artifact hash, source snapshot date, and parser version are archived.
- `catalog-qa-report.mjs` has zero blockers/warnings when run separately against the approved OBF and CosIng artifacts; the `phase4:qa-report*` package scripts remain fixture conveniences.
- QA revalidates the embedded exact approval bytes, current trust/scope/transformer/release identity, signed EAS/archive/App Store evidence, source-specific schema, provenance, and deterministic transformed payload.
- Generated packet status audit reports no dirty packet text and no stale source hashes.

Sources:

- `scripts/phase4/catalog-qa-report.mjs` - 26987 bytes - sha256 `44f66cf82c7676af4e89355726c396565bbc476271218c7c2e9b6e8954f24977`
- `scripts/phase4/catalog-qa-report-smoke.mjs` - 14607 bytes - sha256 `af9d98f4c991863605f93f8fc873834f0e618c642adcd28e89a7dbcd2ed47127`
- `scripts/phase4/import-obf-snapshot.mjs` - 12929 bytes - sha256 `3efd8d761fec3fa19ec1fd90e0445c46c684382bb0624fd76f0fc5c4f49b2608`
- `scripts/phase4/import-cosing-dictionary.mjs` - 13351 bytes - sha256 `470016b20d8e5ecb4be94fb83d891c051cb10f42d702d60cde284466579da47a`
- `scripts/phase4/catalog-source-policy-audit.mjs` - 8633 bytes - sha256 `f477b1bcaa8b6b7997cded65b63c21e7dbfc23a3c75d169720961f5eb3b6879c`
- `scripts/phase4/source-policy.mjs` - 87622 bytes - sha256 `94053b1914ea094bc10b29d041c78cc71d62ed5ea7080981e0feef45695a110e`
- `scripts/phase4/source-policy.test.mjs` - 38524 bytes - sha256 `12c69f6082cd11f667f9c605713930b1f6c21f17c6c7042005173a20b7ce9f2f`
- `docs/phase-4/catalog-source-policy.json` - 7249 bytes - sha256 `79005f1111af670bb8ce11d128627ecde9a59a8f323e2cf9170dfe50c8c2a050`
- `docs/phase-4/catalog-source-trust-registry.json` - 235 bytes - sha256 `13a7f7ca9ac84b31351d1f343bd7e67117fec9b46fa66d60f6c3bdd98e70e824`
- `docs/phase-4/catalog-release-scope.json` - 341 bytes - sha256 `2d02ca4376b1e92ce37901ac67fd0b6dcb05c3a3f8525c881a6925bc68ffb0df`
- `docs/phase-4/catalog-release-build-evidence.json` - 481 bytes - sha256 `c0b7b51ad2e3e2fd864d25d2ae46b451d6cae1a1e1768d983c168c192dab4254`
- `docs/phase-4/catalog-source-release-runbook.md` - 14619 bytes - sha256 `ac3794fe673f042bd11a57a7cfb95025c66c1b28c1f890c425fbea420ab391a1`
- `scripts/docs/generated-packet-status-audit.mjs` - 12271 bytes - sha256 `64e5738be3438fb22f53537838b40e865165124e3695d2ff75cb811e9ed9b7f9`

### beta-coverage - Closed-beta catalog coverage and correction loop

- Domain: betaEvidence
- Status: blocked
- Launch gate: B-CATALOG-COVERAGE
- Owner: Founder + engineering + support

Required evidence:

- 50-100 consented target users add at least three products each; the cohort is described as the defined beta-shelf coverage corpus, never as statistically market-representative.
- Barcode, search, OCR, and manual fallback are exercised with participant-capped aggregates, small-cell plus complementary suppression, and an overlapping-release/differencing guard.
- The fixed holdout meets predeclared minimum samples and one-sided confidence-bound gates for wrong matches, parser unknowns, recognition, shelf completion, manual fallback, every priority category, and zero open P0/P1/correction/recommendation-safety failures.
- `phase4:beta-coverage-report` remains informational; the signed CAT-03 contract may authorize only non-serving staging before one atomic campaign release, and only an independent signed post-release database readback can establish point-in-time final-clear.

Sources:

- `docs/phase-4/beta-coverage-report.md` - 7014 bytes - sha256 `cce89c5b8b383e849013fe958912b15e441ec3333606f7fd2663e98b8bb50eea`
- `docs/phase-4/beta-shelf-corpus.template.json` - 24386 bytes - sha256 `55a44a32ecd47ed53a7a7ba1b8a1694ea936a69768668e9a739f0218d98420a5`
- `docs/phase-4/catalog-coverage-quality-targets.template.json` - 9408 bytes - sha256 `e53c6c5d2715392dab63930046836e1c7b832a007419508a778dd085c54846c1`
- `docs/phase-4/catalog-curation-release-runbook.md` - 40936 bytes - sha256 `a5775450aa2ed0bb59c37962964ea11a6f23f209b5c4c26bb970e82ee9771bef`
- `docs/phase-4/catalog-cat02-membership-proof.template.json` - 9254 bytes - sha256 `e4d9ec3cfc09aca71972eb141577492e7bf17cab3a0a78ebd393cdc3fe152c56`
- `docs/phase-4/catalog-curation-database-readback.template.json` - 8239 bytes - sha256 `98efb09bf33c5ef326534ddf6ce888594968bbf50e5bf953d651cb297b47f341`
- `docs/phase-3/consent-matrix.md` - 16199 bytes - sha256 `72dea59e32637652495e66be3d882714f4fef1ff43fa4f795fbc28b42c9edb9a`
- `docs/phase-3/data-inventory.md` - 36362 bytes - sha256 `39cf1a9caf5c435fafa23f0074ad4934dfeab6243ef0764949a504b9382a2eda`
- `docs/store-privacy-inventory.md` - 31965 bytes - sha256 `620804f163e296ed0faac3bff466fe47f16c86ae5789b8f7bde687938a2342a7`
- `scripts/phase4/beta-coverage-report.mjs` - 24852 bytes - sha256 `5ec1f917eacbe248074687ea501c006d93227a67d3a10ce598ae7962e35e4852`
- `scripts/phase4/beta-coverage-report-smoke.mjs` - 10503 bytes - sha256 `4993e8d16fc4c7b89d8e45b3a7b67a6ec83dc2e1224a03a377de7c913463efeb`
- `scripts/phase4/catalog-curation-contract.mjs` - 228766 bytes - sha256 `12d281bb397fea70f4ae8447638df7f86231f655b23b77d3bc9bec8adfaadf58`
- `scripts/phase4/catalog-curation-contract.test.mjs` - 112005 bytes - sha256 `f94c977337a54e486d5e6867866077374550b10cc7cbd1bcb54c96b892f5d7fd`
- `scripts/phase4/catalog-coverage-quality-report.mjs` - 5480 bytes - sha256 `f5fc81ea9f2d31fcec3185fed837634506c89197f7f51777f0c174fa1ab17216`
- `scripts/phase4/catalog-coverage-quality-report.test.mjs` - 6586 bytes - sha256 `616881a177d87b435f75ec39dfbe01eb2bc8dd4d91ff25b50da6c6a776dbb204`
- `docs/phase-10/catalog-beta-report.md` - 1680 bytes - sha256 `28729b9ed344c13414cb6426f0c5360ac21034641b5cd94298d8dbb391165d28`
- `docs/phase-10/support-beta-report.md` - 2149 bytes - sha256 `f25c3841a8bc5649dbd1f38632c756898da46a5d7f4d59ff7c328726dc9d26ac`
- `docs/phase-10/retention-activation-report.md` - 2343 bytes - sha256 `e7c5ebd8d49c5bc527e4ea926743a2ede4eb33522e6fda28ec1deae00953f8ab`
- `docs/FOR_TAS_TO_DO.md` - 11239 bytes - sha256 `11b6df522e34a3b1a3ad8e130cf07345a8e91059efee6f4399d27360026c2825`

### catalog-promotion-lifecycle - Reviewed catalog staging, promotion, lineage, and rollback

- Domain: curation
- Status: local-scaffold
- Launch gate: B-CATALOG-SEED
- Owner: Engineering + catalog operator + database reviewer

Required evidence:

- A content-addressed CAT-02 stage envelope binds an approved transform, zero-warning source QA, exact per-record reviews, source/build evidence, natural keys, record hashes, and the US territory.
- Fixture/candidate records, incomplete reviews, changed idempotent replays, duplicate natural keys, and existing-catalog conflicts fail closed before promotion.
- Migration `0057` stages through sealed service RPCs, keeps approval/promotion/rollback migration-owner-only pending CAT-08, and denies direct API-role catalog mutation.
- Every promoted projection traces through its immutable staged record and batch to source artifact, transform, approval, QA, and reviewer hashes.
- A reviewed hosted two-session drill proves atomic promotion, full retry on serialization failure, source-withdrawal containment, exact verification, and non-destructive rollback with shelf/correction references preserved.

Sources:

- `scripts/phase4/catalog-promotion-contract.mjs` - 121311 bytes - sha256 `b0e248aa0e7696357deb53bfd49b7a9da516f6d5818e7fc89d1fb0b91a54bad0`
- `scripts/phase4/catalog-promotion-contract.test.mjs` - 61364 bytes - sha256 `3e7631a11cfc2446d26041b447fd1b6b4687d37021517037be2fed9659b61c04`
- `scripts/phase4/build-catalog-stage-envelope.mjs` - 619 bytes - sha256 `cc36fcee8961ab7239ccc606342253acf9cf7c1d2c5daf6910b56da93eefb2f6`
- `scripts/phase4/complete-catalog-database-receipts.mjs` - 705 bytes - sha256 `f73f48b6ee641e7ae05bfeb0de2e4b2ced73492f838bbc94470a03f2f3db41df`
- `supabase/migrations/20260717000057_catalog_import_lifecycle.sql` - 144722 bytes - sha256 `926ba3a453bbe46e8ba97167049f5dda1fb22a59248dee1b9a216d4cc30b7ce7`
- `supabase/tests/database/catalog_import_lifecycle.test.sql` - 105451 bytes - sha256 `da1c1d0e30be9bc271d66449336b83901d2f4f90d9b1429df5f58aa9c182e9ce`
- `docs/phase-4/catalog-import-promotion-runbook.md` - 15706 bytes - sha256 `0f9d787c2a7c6469151711ebb3da110995c0514963ecca5d59bc33df69a8d994`
- `docs/phase-4/first-curated-product-batch.md` - 9784 bytes - sha256 `7ae00318912a50d2843eb833e18202b7a31d3db6a97474125a28cefc4c57fa04`

### catalog-launch-curation-lifecycle - Signed launch curation, positive serving authority, and retirement

- Domain: curation
- Status: local-scaffold
- Launch gate: B-CURATED-CATALOG
- Owner: Catalog operator + independent reviewers + activation operator

Required evidence:

- A strict content-addressed CAT-03 envelope binds a pre-outcome target policy, minimized beta aggregate, untouched holdout, exact CAT-01 approvals, exact CAT-02 promoted projections, per-field provenance, and independent role-qualified reviews.
- Beta demand is prioritization evidence only and cannot create or change a brand, GTIN, category, INCI token, ingredient mapping, concentration, expiry, regulatory classification, quality fact, or recommendation authorization.
- Migration `0058` keeps target, campaign, record, per-product authorization, global release, and retirement authority immutable and migration-owner-only; API roles cannot mutate or forge curation state.
- Every catalog serving path positively requires the exact active global CAT-03 campaign plus campaign-scoped product authorization, exact CAT-02 lineage, complete reviewed dependencies, zero correction hold, and any required sunscreen/US-OTC review.
- A reviewed hosted two-session drill proves replay safety, non-serving successor staging, one exact-set atomic campaign release/supersession, concurrent correction/source-withdrawal containment, immediate retirement, signed post-release readback, and zero partial eligibility.

Sources:

- `.gitignore` - 1558 bytes - sha256 `5b57b665c8d575b3b7b16b3b650db773fc0fd73a86a5a30cb326afb5c1bf9fae`
- `package.json` - 33306 bytes - sha256 `c4f416cd9674976509b8ad35f2cac43b06f6653de466aace35773d0642c41b2c`
- `.github/workflows/quality.yml` - 9224 bytes - sha256 `5a38100532c58ecd9d9d414d0455bdf63912feef1e836d738ff4612096a06038`
- `docs/phase-4/catalog-curation-release-runbook.md` - 40936 bytes - sha256 `a5775450aa2ed0bb59c37962964ea11a6f23f209b5c4c26bb970e82ee9771bef`
- `docs/phase-4/catalog-coverage-quality-targets.template.json` - 9408 bytes - sha256 `e53c6c5d2715392dab63930046836e1c7b832a007419508a778dd085c54846c1`
- `docs/phase-4/beta-shelf-corpus.template.json` - 24386 bytes - sha256 `55a44a32ecd47ed53a7a7ba1b8a1694ea936a69768668e9a739f0218d98420a5`
- `docs/phase-4/catalog-curation-review.template.json` - 22649 bytes - sha256 `47c15809a4db10ff82855c97405e3b01bca520df1d389b90baa44b6346658390`
- `docs/phase-4/catalog-cat02-membership-proof.template.json` - 9254 bytes - sha256 `e4d9ec3cfc09aca71972eb141577492e7bf17cab3a0a78ebd393cdc3fe152c56`
- `docs/phase-4/catalog-curation-database-readback.template.json` - 8239 bytes - sha256 `98efb09bf33c5ef326534ddf6ce888594968bbf50e5bf953d651cb297b47f341`
- `docs/phase-3/consent-matrix.md` - 16199 bytes - sha256 `72dea59e32637652495e66be3d882714f4fef1ff43fa4f795fbc28b42c9edb9a`
- `docs/phase-3/data-inventory.md` - 36362 bytes - sha256 `39cf1a9caf5c435fafa23f0074ad4934dfeab6243ef0764949a504b9382a2eda`
- `docs/store-privacy-inventory.md` - 31965 bytes - sha256 `620804f163e296ed0faac3bff466fe47f16c86ae5789b8f7bde687938a2342a7`
- `scripts/phase4/catalog-curation-contract.mjs` - 228766 bytes - sha256 `12d281bb397fea70f4ae8447638df7f86231f655b23b77d3bc9bec8adfaadf58`
- `scripts/phase4/catalog-curation-contract.test.mjs` - 112005 bytes - sha256 `f94c977337a54e486d5e6867866077374550b10cc7cbd1bcb54c96b892f5d7fd`
- `scripts/phase4/build-catalog-curation-envelope.mjs` - 4096 bytes - sha256 `d31aa8d2bea0d2640ac4b343bf91261446aafc3155a9e7ce74e4f9406c760bd5`
- `scripts/phase4/catalog-coverage-quality-report.mjs` - 5480 bytes - sha256 `f5fc81ea9f2d31fcec3185fed837634506c89197f7f51777f0c174fa1ab17216`
- `scripts/phase4/catalog-coverage-quality-report.test.mjs` - 6586 bytes - sha256 `616881a177d87b435f75ec39dfbe01eb2bc8dd4d91ff25b50da6c6a776dbb204`
- `supabase/migrations/20260717000058_catalog_launch_curation.sql` - 295282 bytes - sha256 `f2d53caad23347103e29b0f5660eefdbdd22bfdc05cc2cb47445ece4192919a6`
- `supabase/tests/database/catalog_launch_curation.test.sql` - 165458 bytes - sha256 `65e83a28fea146952f84b54dd2123f8fc93d69e4b9d3af5d0cbb9c84381115d0`
- `supabase/migrations/20260717000057_catalog_import_lifecycle.sql` - 144722 bytes - sha256 `926ba3a453bbe46e8ba97167049f5dda1fb22a59248dee1b9a216d4cc30b7ce7`
- `supabase/tests/database/catalog_import_lifecycle.test.sql` - 105451 bytes - sha256 `da1c1d0e30be9bc271d66449336b83901d2f4f90d9b1429df5f58aa9c182e9ce`

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
- `supabase/functions/catalog-report/index.ts` - 9332 bytes - sha256 `c8dfe55ddfc44165a20822f9bfa1733c7ae116224d673822acce0c5c5318fecf`
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

- `docs/04-smart-shelf.md` - 57158 bytes - sha256 `c85628b675ec6880847ec2ad86f523885679634ca135b6911708e90086377981`
- `docs/USER_FLOW_TREE.md` - 399901 bytes - sha256 `4ebc6823f96d1a23b14658fb7219a78e676a524cce211613b8f5e06758848861`
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
- `supabase/functions/catalog-lookup/index.ts` - 10199 bytes - sha256 `231dd6175ac99232bf7b263e2152311e8d8ccbe9dd008dcdb12c5321926f27c1`
- `supabase/functions/catalog-lookup/catalogContract.ts` - 80 bytes - sha256 `9707c48c48465b279c2112d84a8a1459867c395490d3c184aaa4e6c2fbc7f81a`
- `supabase/functions/catalog-lookup/catalogContract.test.ts` - 14681 bytes - sha256 `96ab5dd088984ce67115b993e84436205ebb1bfabee25ea2d60558e7eea85f46`
- `supabase/functions/catalog-search/index.ts` - 9227 bytes - sha256 `640842b71581aac2f7a01870d27a8e951614bc282e5686cbf9d9564ad5c810fc`
- `supabase/functions/catalog-search/catalogContract.ts` - 1343 bytes - sha256 `62cc1e0d2e62d37187922e4ed1766b12d8ca8aa48cdebf3e3271ea6ae7ce417e`
- `supabase/functions/catalog-search/catalogContract.test.ts` - 3041 bytes - sha256 `dd91fb0c009da68074d795d7819149d9bb970e47c2fba6bbdfc7a08f7f53922d`
- `supabase/migrations/20260711000038_shelf_freshness_invariants.sql` - 1973 bytes - sha256 `672df1e56fac4cdfc6bf641c3249221aaacf630439d28898a79ace2d25181bcd`
- `supabase/migrations/20260711000039_replenishment_alert_opt_in.sql` - 372 bytes - sha256 `eac60d4bf92f465ad2264c509f8e0a2f412b5780f862cf602b8ff16e1e2e1299`
- `supabase/migrations/20260717000056_catalog_serving_eligibility_gate.sql` - 34119 bytes - sha256 `0d4543effd4eb5c6d5e036b96d777b217bf853fb0c9587575429a28f14d7793c`

### catalog-serving-gate - Fail-closed production catalog serving boundary

- Domain: productSurface
- Status: local-scaffold
- Launch gate: B-CATALOG-SEED
- Owner: Engineering + catalog operator + database reviewer

Required evidence:

- Migrations `0056`, `0057`, and `0058` plus all three pgTAP contracts pass on the exact hosted staging revision before promotion, curation authorization, or campaign release.
- Barcode and search use service-role-only RPCs over the same positive source/product/correction/CAT-03 eligibility relation; `service_role` has no direct catalog-table read, while explicitly safe authenticated reads retain positive RLS.
- Only rows in the exact active global CAT-03 campaign with active campaign-scoped product authorization, reviewed `verified` or `usable` quality, recommendation eligibility, production/legal-approved sources, and zero operator-reviewed `triaged`/`accepted` correction holds can be served; untrusted open intake remains owner-scoped.
- Barcode mappings are independently reviewed, direct authenticated reads cannot bypass source withdrawal, and every held/unknown reason returns the same no-match/manual fallback.

Sources:

- `supabase/migrations/20260717000056_catalog_serving_eligibility_gate.sql` - 34119 bytes - sha256 `0d4543effd4eb5c6d5e036b96d777b217bf853fb0c9587575429a28f14d7793c`
- `supabase/migrations/20260717000057_catalog_import_lifecycle.sql` - 144722 bytes - sha256 `926ba3a453bbe46e8ba97167049f5dda1fb22a59248dee1b9a216d4cc30b7ce7`
- `supabase/migrations/20260717000058_catalog_launch_curation.sql` - 295282 bytes - sha256 `f2d53caad23347103e29b0f5660eefdbdd22bfdc05cc2cb47445ece4192919a6`
- `supabase/tests/database/catalog_serving_gate.test.sql` - 31579 bytes - sha256 `a57fb8548176ca6874efeee9571beadebd542ac874658bff612e8c82f9046c48`
- `supabase/tests/database/catalog_import_lifecycle.test.sql` - 105451 bytes - sha256 `da1c1d0e30be9bc271d66449336b83901d2f4f90d9b1429df5f58aa9c182e9ce`
- `supabase/tests/database/catalog_launch_curation.test.sql` - 165458 bytes - sha256 `65e83a28fea146952f84b54dd2123f8fc93d69e4b9d3af5d0cbb9c84381115d0`
- `supabase/tests/database/schema_contract.test.sql` - 21979 bytes - sha256 `519ded423a1b5fe7cca18eae9bbb5541ec64462f5872ebf4102ef74cd0e477ad`
- `supabase/functions/catalog-lookup/index.ts` - 10199 bytes - sha256 `231dd6175ac99232bf7b263e2152311e8d8ccbe9dd008dcdb12c5321926f27c1`
- `supabase/functions/catalog-lookup/catalogContract.ts` - 80 bytes - sha256 `9707c48c48465b279c2112d84a8a1459867c395490d3c184aaa4e6c2fbc7f81a`
- `supabase/functions/catalog-lookup/catalogContract.test.ts` - 14681 bytes - sha256 `96ab5dd088984ce67115b993e84436205ebb1bfabee25ea2d60558e7eea85f46`
- `supabase/functions/catalog-search/index.ts` - 9227 bytes - sha256 `640842b71581aac2f7a01870d27a8e951614bc282e5686cbf9d9564ad5c810fc`
- `supabase/functions/catalog-search/catalogContract.ts` - 1343 bytes - sha256 `62cc1e0d2e62d37187922e4ed1766b12d8ca8aa48cdebf3e3271ea6ae7ce417e`
- `supabase/functions/catalog-search/catalogContract.test.ts` - 3041 bytes - sha256 `dd91fb0c009da68074d795d7819149d9bb970e47c2fba6bbdfc7a08f7f53922d`
- `docs/phase-4/catalog-source-release-runbook.md` - 14619 bytes - sha256 `ac3794fe673f042bd11a57a7cfb95025c66c1b28c1f890c425fbea420ab391a1`
- `docs/phase-4/catalog-curation-release-runbook.md` - 40936 bytes - sha256 `a5775450aa2ed0bb59c37962964ea11a6f23f209b5c4c26bb970e82ee9771bef`
- `docs/phase-2-production-infrastructure-runbook.md` - 14956 bytes - sha256 `83d8ef1637f9a09af70e2f0e7b1b03e8cbec6516fd08bf807776272751ab6aeb`

### first-party-correction-report - First-party missing-product and wrong-match operation

- Domain: operations
- Status: blocked
- Launch gate: B-SHELF-CONTRIB
- Owner: Support + catalog operator + privacy/security + engineering

Required evidence:

- Owner-scoped missing-product and wrong-match reports enter only the app's first-party correction workflow with active health-data authority and bounded, minimized fields.
- Deletion and consent-withdrawal paths cover report data. Untrusted open intake remains owner-scoped; only operator-reviewed `triaged` or `accepted` product corrections suppress global catalog serving and recommendation eligibility.
- Named support/catalog owners operate the seven-day triage SLA and retain correction-runbook evidence.
- No report, shelf/profile field, or user lookup is sent to OBF, CosIng, or another source; the legacy contribution queue and flag remain inert.

Sources:

- `docs/phase-4/odbl-compliance-memo.md` - 5099 bytes - sha256 `ed14fda2e129ee22293ab5d28433626971c0ba8998034547e5f15dc23746c191`
- `docs/04-smart-shelf.md` - 57158 bytes - sha256 `c85628b675ec6880847ec2ad86f523885679634ca135b6911708e90086377981`
- `supabase/migrations/20260614000026_phase4_catalog.sql` - 35102 bytes - sha256 `dc1a7f150bd5b285cf2d05f2583126ebeb97e67b5363666e670518896b93c311`
- `supabase/functions/catalog-report/index.ts` - 9332 bytes - sha256 `c8dfe55ddfc44165a20822f9bfa1733c7ae116224d673822acce0c5c5318fecf`
- `supabase/functions/catalog-report/privacy.ts` - 3504 bytes - sha256 `9dee03b20211d5b3fcb2e05ad4be85a00112dd00f03fc6e5c834969381f0e44e`
- `supabase/functions/catalog-report/privacy.test.ts` - 4009 bytes - sha256 `db9b6d1c812679297295c5afb6c8d0226c99f94b8aedefff620111d4fa9d7bac`
- `supabase/migrations/20260717000056_catalog_serving_eligibility_gate.sql` - 34119 bytes - sha256 `0d4543effd4eb5c6d5e036b96d777b217bf853fb0c9587575429a28f14d7793c`
- `apps/mobile/src/features/catalog/client.ts` - 11357 bytes - sha256 `ac891d9253e2f2d81be440eda468ab02d0f9e3afddb84822be14f9a48f451438`
- `apps/mobile/src/features/catalog/client.test.ts` - 12335 bytes - sha256 `92250d319ea33fc14bb57c0bf131e732847762036f9ed132788033aea0c78dbd`
- `docs/FOR_TAS_TO_DO.md` - 11239 bytes - sha256 `11b6df522e34a3b1a3ad8e130cf07345a8e91059efee6f4399d27360026c2825`

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

- `docs/phase-4/observability-dashboard.md` - 3506 bytes - sha256 `32031463cdbc4fcbf5997da4572f7b924154b53a25097dae78b773db67bb1b89`
- `docs/phase-4/beta-coverage-report.md` - 7014 bytes - sha256 `cce89c5b8b383e849013fe958912b15e441ec3333606f7fd2663e98b8bb50eea`
- `docs/phase-10/support-operations.md` - 4878 bytes - sha256 `bed258fc581aa469539542cbad95184e5314adb4a3b3ac11983b677cd4a00c7e`
- `docs/phase-10/support-beta-report.md` - 2149 bytes - sha256 `f25c3841a8bc5649dbd1f38632c756898da46a5d7f4d59ff7c328726dc9d26ac`
- `scripts/phase4/beta-coverage-report.mjs` - 24852 bytes - sha256 `5ec1f917eacbe248074687ea501c006d93227a67d3a10ce598ae7962e35e4852`
- `supabase/functions/catalog-report/privacy.ts` - 3504 bytes - sha256 `9dee03b20211d5b3fcb2e05ad4be85a00112dd00f03fc6e5c834969381f0e44e`
- `supabase/functions/catalog-report/privacy.test.ts` - 4009 bytes - sha256 `db9b6d1c812679297295c5afb6c8d0226c99f94b8aedefff620111d4fa9d7bac`
- `docs/FOR_TAS_TO_DO.md` - 11239 bytes - sha256 `11b6df522e34a3b1a3ad8e130cf07345a8e91059efee6f4399d27360026c2825`

## Blockers

- None.

## Warnings

- None.
