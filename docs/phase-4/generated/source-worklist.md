# Phase 4 Catalog Source Worklist

Generated: 2026-09-27T18:52:13.380Z
Status: pass
Git SHA: 5be52337a94e2df207e7811aac2d31e9160b82b4
Git status: clean

This generated worklist is an operator handoff for the catalog/source launch
gate. It does not approve any catalog source, product batch, beta metric, or
recommendation use. It records the evidence Tas/counsel/reviewers/operators
must attach before Phase 4 can stop blocking launch.

## Summary

- Work items: 14
- Source files hashed: 413
- Missing source files: 0
- Blockers: 0
- Warnings: 0

## Items

| ID                                | Domain         | Area                                                                  | Status         | Launch gate             | Sources | Missing sources |
| --------------------------------- | -------------- | --------------------------------------------------------------------- | -------------- | ----------------------- | ------- | --------------- |
| source-identity                   | sourceReview   | Final catalog release identity, trust, build, and attribution surface | blocked        | B-CATALOG-SOURCE-REVIEW | 14      | 0               |
| obf-odbl-posture                  | sourceReview   | Open Beauty Facts and ODbL launch posture                             | blocked        | B-ODBL-REVIEW           | 17      | 0               |
| cosing-reuse-taxonomy             | sourceReview   | CosIng reuse and ingredient-tag taxonomy                              | blocked        | B-CATALOG-SOURCE-REVIEW | 16      | 0               |
| curated-first-batch               | curation       | First curated launch product batch                                    | blocked        | B-CURATED-CATALOG       | 22      | 0               |
| import-qa                         | curation       | Import QA and generated catalog evidence                              | local-scaffold | B-CATALOG-SEED          | 13      | 0               |
| beta-coverage                     | betaEvidence   | Closed-beta catalog coverage and correction loop                      | blocked        | B-CATALOG-COVERAGE      | 19      | 0               |
| catalog-promotion-lifecycle       | curation       | Reviewed catalog staging, promotion, lineage, and rollback            | local-scaffold | B-CATALOG-SEED          | 38      | 0               |
| catalog-launch-curation-lifecycle | curation       | Signed launch curation, positive serving authority, and retirement    | local-scaffold | B-CURATED-CATALOG       | 27      | 0               |
| mobile-catalog-disclosure         | productSurface | Mobile catalog source, quality, and report-issue disclosure           | local-scaffold | B-CATALOG-SEED          | 105     | 0               |
| recommendation-zero-admission     | productSurface | Fail-closed product-specific recommendation admission                 | local-scaffold | B-CURATED-CATALOG       | 18      | 0               |
| catalog-freshness-provenance      | productSurface | Catalog-backed Shelf freshness and provenance contract                | local-scaffold | B-CATALOG-SEED          | 46      | 0               |
| catalog-serving-gate              | productSurface | Fail-closed production catalog serving boundary                       | local-scaffold | B-CATALOG-SEED          | 57      | 0               |
| first-party-correction-report     | operations     | First-party missing-product and wrong-match operation                 | blocked        | B-SHELF-CONTRIB         | 13      | 0               |
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

- `.env.example` - 29662 bytes - sha256 `d9825f22149f8d15e491d4f1d97fbc8311ce739564a36e1f0ed0ecc64464e091`
- `scripts/phase4/check-source-env.mjs` - 2989 bytes - sha256 `ad8eaa253c3dd97fd6ea09a1cdbf11fb1aec96212a90a610e690a74981989a1a`
- `docs/phase-4/catalog-source-memo-open-beauty-facts.md` - 11067 bytes - sha256 `9292f4afe465be4e442ea87b88ff0830ac91d2e00554c0c85b04accd0044f869`
- `docs/phase-4/catalog-source-memo-cosing.md` - 6702 bytes - sha256 `409a010aaded56dce8e2053ce0356563516dde14e0494ee5b5697fa514cffbc3`
- `docs/phase-4/README.md` - 9346 bytes - sha256 `6cd849d25d98c481da95662922e5a54d879c9cccf289d94cf9d6fe7eee2bc087`
- `docs/phase-4/catalog-source-policy.json` - 7249 bytes - sha256 `55c5ae5c64f52cd8a7d9e2ed94a6e878d9deeb42e8c6c16edc721e08bf8781a4`
- `docs/phase-4/catalog-source-trust-registry.json` - 235 bytes - sha256 `13a7f7ca9ac84b31351d1f343bd7e67117fec9b46fa66d60f6c3bdd98e70e824`
- `docs/phase-4/catalog-release-scope.json` - 341 bytes - sha256 `2d02ca4376b1e92ce37901ac67fd0b6dcb05c3a3f8525c881a6925bc68ffb0df`
- `docs/phase-4/catalog-release-build-evidence.json` - 481 bytes - sha256 `c0b7b51ad2e3e2fd864d25d2ae46b451d6cae1a1e1768d983c168c192dab4254`
- `docs/phase-4/catalog-source-release-runbook.md` - 14881 bytes - sha256 `6ebf9512392750cf6dbbb6f1d073f362c931480690ecc30aa6061ec8f79e8cb6`
- `scripts/phase4/catalog-source-policy-audit.mjs` - 8633 bytes - sha256 `f477b1bcaa8b6b7997cded65b63c21e7dbfc23a3c75d169720961f5eb3b6879c`
- `scripts/phase4/source-policy.mjs` - 89435 bytes - sha256 `75242c44fe3ff9e46472647fbcfb9d59070a1306fb4638ae106117a30c9cc634`
- `docs/phase-4/phase-4-exit-review.md` - 13974 bytes - sha256 `3d0eb320246e201d6748c11913ecb6804de463a87d3a8ac2e6f62a6821bd921f`
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

- `docs/phase-4/catalog-source-memo-open-beauty-facts.md` - 11067 bytes - sha256 `9292f4afe465be4e442ea87b88ff0830ac91d2e00554c0c85b04accd0044f869`
- `docs/phase-4/odbl-compliance-memo.md` - 5347 bytes - sha256 `fb3d57b6b93b22aa87dc34434cdbf6cafec134458d5704ea70bcb8cff03ce755`
- `docs/phase-4/catalog-source-policy.json` - 7249 bytes - sha256 `55c5ae5c64f52cd8a7d9e2ed94a6e878d9deeb42e8c6c16edc721e08bf8781a4`
- `docs/phase-4/obf-source-approval.template.json` - 8479 bytes - sha256 `9ffa7441d5d9efbf3662aef4509cf9c5cf21b66e296ce07838acaf9fe25ede15`
- `docs/phase-4/catalog-source-trust-registry.json` - 235 bytes - sha256 `13a7f7ca9ac84b31351d1f343bd7e67117fec9b46fa66d60f6c3bdd98e70e824`
- `docs/phase-4/catalog-release-scope.json` - 341 bytes - sha256 `2d02ca4376b1e92ce37901ac67fd0b6dcb05c3a3f8525c881a6925bc68ffb0df`
- `docs/phase-4/catalog-release-build-evidence.json` - 481 bytes - sha256 `c0b7b51ad2e3e2fd864d25d2ae46b451d6cae1a1e1768d983c168c192dab4254`
- `docs/phase-4/catalog-source-release-runbook.md` - 14881 bytes - sha256 `6ebf9512392750cf6dbbb6f1d073f362c931480690ecc30aa6061ec8f79e8cb6`
- `scripts/phase4/import-obf-snapshot.mjs` - 13213 bytes - sha256 `f9ed4016fb912e0d406e18d85654d3995ba3a6395a64de4516c50018e2d3f64d`
- `scripts/phase4/source-policy.mjs` - 89435 bytes - sha256 `75242c44fe3ff9e46472647fbcfb9d59070a1306fb4638ae106117a30c9cc634`
- `scripts/phase4/source-policy.test.mjs` - 39730 bytes - sha256 `dedc9ebdb80bb022e9f0ad4769c369a4641fbfc03993a4d892ff7f3406659118`
- `scripts/phase4/catalog-qa-report.mjs` - 27119 bytes - sha256 `c01d9bc01c8db0951d8113cf74e53bea1e67e4d9145406e85098cfbdd032bf09`
- `supabase/migrations/20260614000026_phase4_catalog.sql` - 35096 bytes - sha256 `c7f7dccd5fee51d855048dfcf8892fa1fceaed94dd7c4193fa2005327d4eef4d`
- `supabase/functions/catalog-lookup/index.ts` - 11843 bytes - sha256 `23e76d1ba0fd1e199be94986fb0e066e7e4cc6b64d04c642bdd1fb849c97b220`
- `supabase/functions/catalog-search/index.ts` - 10142 bytes - sha256 `b7187fee6fe8981d42219de31d1358d11db16bb8f40be530c4d2f838e5400494`
- `supabase/functions/catalog-report/index.ts` - 10890 bytes - sha256 `00c15af1cac9a9cda6514d5c441b4c0b2420959a24727d697f7dce9ab8c4acbd`
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

- `docs/phase-4/catalog-source-memo-cosing.md` - 6702 bytes - sha256 `409a010aaded56dce8e2053ce0356563516dde14e0494ee5b5697fa514cffbc3`
- `docs/phase-4/ingredient-tag-taxonomy.md` - 3276 bytes - sha256 `8b2af877c4cbdd0f6a7f4f965ded0ece300710e7bb2adbe97c97d5aaef26b83f`
- `docs/phase-4/catalog-source-policy.json` - 7249 bytes - sha256 `55c5ae5c64f52cd8a7d9e2ed94a6e878d9deeb42e8c6c16edc721e08bf8781a4`
- `docs/phase-4/cosing-source-approval.template.json` - 8088 bytes - sha256 `05ccfb90c2f7a3eed49571b1fc7d4b87fde28186d644d6cb53671456b7ba5fd3`
- `docs/phase-4/catalog-source-trust-registry.json` - 235 bytes - sha256 `13a7f7ca9ac84b31351d1f343bd7e67117fec9b46fa66d60f6c3bdd98e70e824`
- `docs/phase-4/catalog-release-scope.json` - 341 bytes - sha256 `2d02ca4376b1e92ce37901ac67fd0b6dcb05c3a3f8525c881a6925bc68ffb0df`
- `docs/phase-4/catalog-release-build-evidence.json` - 481 bytes - sha256 `c0b7b51ad2e3e2fd864d25d2ae46b451d6cae1a1e1768d983c168c192dab4254`
- `docs/phase-4/catalog-source-release-runbook.md` - 14881 bytes - sha256 `6ebf9512392750cf6dbbb6f1d073f362c931480690ecc30aa6061ec8f79e8cb6`
- `scripts/phase4/import-cosing-dictionary.mjs` - 13351 bytes - sha256 `470016b20d8e5ecb4be94fb83d891c051cb10f42d702d60cde284466579da47a`
- `scripts/phase4/source-policy.mjs` - 89435 bytes - sha256 `75242c44fe3ff9e46472647fbcfb9d59070a1306fb4638ae106117a30c9cc634`
- `scripts/phase4/source-policy.test.mjs` - 39730 bytes - sha256 `dedc9ebdb80bb022e9f0ad4769c369a4641fbfc03993a4d892ff7f3406659118`
- `apps/mobile/src/features/catalog/ingredientParser.ts` - 7818 bytes - sha256 `4c3290b955c68859cd63d4aeddae374a5c0c7efb9730b1359aa72e3b09af2a88`
- `apps/mobile/src/features/catalog/ingredientParser.test.ts` - 3602 bytes - sha256 `a38abeedcf0b3a02e36b32ff6d3fa699d27c19dd5ffc2d3286f05e3278ec2afc`
- `apps/mobile/src/features/intelligence/tags.ts` - 5158 bytes - sha256 `91e886d42ea9f38150342851322a3537f9c25990e090bb76536e3d2bfe79809f`
- `apps/mobile/src/features/intelligence/tags.test.ts` - 1791 bytes - sha256 `cc38be3e5c48bbcc1df28427dc326b1583222812d9dc3693d066c19d8de54b7e`
- `scripts/phase4/catalog-qa-report.mjs` - 27119 bytes - sha256 `c01d9bc01c8db0951d8113cf74e53bea1e67e4d9145406e85098cfbdd032bf09`

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

- `docs/phase-4/curated-product-curation-sheet.md` - 8390 bytes - sha256 `d93bbc7b1bd011586647893f8a6e7a49f81d05d6cbe30855d6c88d6011b0a92b`
- `docs/phase-4/first-curated-product-batch.md` - 10318 bytes - sha256 `fbdb42e6971b7511492bc65efda409d6b0735856fdc2f98be8119bafa2472022`
- `docs/phase-4/catalog-curation-release-runbook.md` - 45531 bytes - sha256 `92a0b946a5e431e787f95d0513289ef1938a8964b23272d329f5cb15395d2be9`
- `docs/phase-4/catalog-coverage-quality-targets.template.json` - 9406 bytes - sha256 `bd6a316f1d520cee3d5ef347d82bff445cbf810b0ca5c8a551b0c13a083dca7a`
- `docs/phase-4/beta-shelf-corpus.template.json` - 24378 bytes - sha256 `eab0f3ab1ac78f53307b69976163c9edd07350a7fdc5dd52c05cb7c3b40106d5`
- `docs/phase-4/catalog-curation-review.template.json` - 22645 bytes - sha256 `90f7348843f623d30b142d27a59a3d93c33978f9d163c06eea0b78ca2bc8283a`
- `docs/phase-4/catalog-cat02-membership-proof.template.json` - 9252 bytes - sha256 `e4bf0f76e0ca82047ffe90700a768ddd12d79d0199da1522369f51a48a67e9d7`
- `docs/phase-4/catalog-curation-database-readback.template.json` - 8237 bytes - sha256 `d2a01a45d7af0d2cf428a144d589a916b1d2089ab1fa809502a0bcb694ac317e`
- `docs/phase-3/consent-matrix.md` - 18185 bytes - sha256 `40c6e5537e138b7c8206baef6fca6be6cafb819813d13771793d8a5ca2fd716b`
- `docs/phase-3/data-inventory.md` - 60091 bytes - sha256 `b5e153f31311d3fa7af2dd16f553f05624b09e27da5d2ed10e44a5018a14aa5c`
- `docs/store-privacy-inventory.md` - 41774 bytes - sha256 `6cbed3fc305f44a3bf58eb3eee087443989c90d7759a46a9454ffb7489ab9480`
- `docs/phase-4/catalog-source-release-runbook.md` - 14881 bytes - sha256 `6ebf9512392750cf6dbbb6f1d073f362c931480690ecc30aa6061ec8f79e8cb6`
- `scripts/phase4/catalog-curation-contract.mjs` - 229778 bytes - sha256 `d5b6565b893b8815eb29ffc5b50665684c86541b0f7580d2a0f80c2db8b56221`
- `scripts/phase4/catalog-curation-contract.test.mjs` - 114869 bytes - sha256 `6f0bb1578661a3951bf4b4b370c003debe0f3d2505439077c91119e7d1d28c3c`
- `scripts/phase4/build-catalog-curation-envelope.mjs` - 4096 bytes - sha256 `d31aa8d2bea0d2640ac4b343bf91261446aafc3155a9e7ce74e4f9406c760bd5`
- `scripts/phase4/catalog-coverage-quality-report.mjs` - 5480 bytes - sha256 `f5fc81ea9f2d31fcec3185fed837634506c89197f7f51777f0c174fa1ab17216`
- `scripts/phase4/catalog-coverage-quality-report.test.mjs` - 6586 bytes - sha256 `616881a177d87b435f75ec39dfbe01eb2bc8dd4d91ff25b50da6c6a776dbb204`
- `scripts/phase4/import-obf-snapshot.mjs` - 13213 bytes - sha256 `f9ed4016fb912e0d406e18d85654d3995ba3a6395a64de4516c50018e2d3f64d`
- `scripts/phase4/import-cosing-dictionary.mjs` - 13351 bytes - sha256 `470016b20d8e5ecb4be94fb83d891c051cb10f42d702d60cde284466579da47a`
- `supabase/migrations/20260717000058_catalog_launch_curation.sql` - 295282 bytes - sha256 `f2d53caad23347103e29b0f5660eefdbdd22bfdc05cc2cb47445ece4192919a6`
- `supabase/migrations/20260722000062_catalog_curation_statement_guard.sql` - 53193 bytes - sha256 `f7bba7300939fd1f95247c464c49cc01544684637ff25d66076f137475ef9ef1`
- `supabase/tests/database/catalog_launch_curation.test.sql` - 202710 bytes - sha256 `7272a899ade80123b990747c1f9402930ba8b07e7b71fbfe4c13b45a11d38b19`

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

- `scripts/phase4/catalog-qa-report.mjs` - 27119 bytes - sha256 `c01d9bc01c8db0951d8113cf74e53bea1e67e4d9145406e85098cfbdd032bf09`
- `scripts/phase4/catalog-qa-report-smoke.mjs` - 17375 bytes - sha256 `70b44647b94c8e2dfded0b7afefbc0b91be3c4de1f8123950e66e412e88c7f2d`
- `scripts/phase4/import-obf-snapshot.mjs` - 13213 bytes - sha256 `f9ed4016fb912e0d406e18d85654d3995ba3a6395a64de4516c50018e2d3f64d`
- `scripts/phase4/import-cosing-dictionary.mjs` - 13351 bytes - sha256 `470016b20d8e5ecb4be94fb83d891c051cb10f42d702d60cde284466579da47a`
- `scripts/phase4/catalog-source-policy-audit.mjs` - 8633 bytes - sha256 `f477b1bcaa8b6b7997cded65b63c21e7dbfc23a3c75d169720961f5eb3b6879c`
- `scripts/phase4/source-policy.mjs` - 89435 bytes - sha256 `75242c44fe3ff9e46472647fbcfb9d59070a1306fb4638ae106117a30c9cc634`
- `scripts/phase4/source-policy.test.mjs` - 39730 bytes - sha256 `dedc9ebdb80bb022e9f0ad4769c369a4641fbfc03993a4d892ff7f3406659118`
- `docs/phase-4/catalog-source-policy.json` - 7249 bytes - sha256 `55c5ae5c64f52cd8a7d9e2ed94a6e878d9deeb42e8c6c16edc721e08bf8781a4`
- `docs/phase-4/catalog-source-trust-registry.json` - 235 bytes - sha256 `13a7f7ca9ac84b31351d1f343bd7e67117fec9b46fa66d60f6c3bdd98e70e824`
- `docs/phase-4/catalog-release-scope.json` - 341 bytes - sha256 `2d02ca4376b1e92ce37901ac67fd0b6dcb05c3a3f8525c881a6925bc68ffb0df`
- `docs/phase-4/catalog-release-build-evidence.json` - 481 bytes - sha256 `c0b7b51ad2e3e2fd864d25d2ae46b451d6cae1a1e1768d983c168c192dab4254`
- `docs/phase-4/catalog-source-release-runbook.md` - 14881 bytes - sha256 `6ebf9512392750cf6dbbb6f1d073f362c931480690ecc30aa6061ec8f79e8cb6`
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

- `docs/phase-4/beta-coverage-report.md` - 8829 bytes - sha256 `ec85aa2775e5c9075bf3d72137cca06e955720aa80c3b807137ab6a7671f6c05`
- `docs/phase-4/beta-shelf-corpus.template.json` - 24378 bytes - sha256 `eab0f3ab1ac78f53307b69976163c9edd07350a7fdc5dd52c05cb7c3b40106d5`
- `docs/phase-4/catalog-coverage-quality-targets.template.json` - 9406 bytes - sha256 `bd6a316f1d520cee3d5ef347d82bff445cbf810b0ca5c8a551b0c13a083dca7a`
- `docs/phase-4/catalog-curation-release-runbook.md` - 45531 bytes - sha256 `92a0b946a5e431e787f95d0513289ef1938a8964b23272d329f5cb15395d2be9`
- `docs/phase-4/catalog-cat02-membership-proof.template.json` - 9252 bytes - sha256 `e4bf0f76e0ca82047ffe90700a768ddd12d79d0199da1522369f51a48a67e9d7`
- `docs/phase-4/catalog-curation-database-readback.template.json` - 8237 bytes - sha256 `d2a01a45d7af0d2cf428a144d589a916b1d2089ab1fa809502a0bcb694ac317e`
- `docs/phase-3/consent-matrix.md` - 18185 bytes - sha256 `40c6e5537e138b7c8206baef6fca6be6cafb819813d13771793d8a5ca2fd716b`
- `docs/phase-3/data-inventory.md` - 60091 bytes - sha256 `b5e153f31311d3fa7af2dd16f553f05624b09e27da5d2ed10e44a5018a14aa5c`
- `docs/store-privacy-inventory.md` - 41774 bytes - sha256 `6cbed3fc305f44a3bf58eb3eee087443989c90d7759a46a9454ffb7489ab9480`
- `scripts/phase4/beta-coverage-report.mjs` - 41079 bytes - sha256 `7bb1ba8b05f90f7fe3c80a23cc30dfc790d7999cb0e37db421cb71e3bdfec7a1`
- `scripts/phase4/beta-coverage-report-smoke.mjs` - 11135 bytes - sha256 `5a0b2c40953c5a3ce641320d3df1b555872da27732d4c6b6da7bd2aba8234d7f`
- `scripts/phase4/catalog-curation-contract.mjs` - 229778 bytes - sha256 `d5b6565b893b8815eb29ffc5b50665684c86541b0f7580d2a0f80c2db8b56221`
- `scripts/phase4/catalog-curation-contract.test.mjs` - 114869 bytes - sha256 `6f0bb1578661a3951bf4b4b370c003debe0f3d2505439077c91119e7d1d28c3c`
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
- Migration `0057` plus forward migrations `0061` and `0062` stage the signed v2 category vocabulary through sealed service RPCs and retain bounded statement-level curation integrity. Migration `0063` gives CAT-08 operators immutable recommendation authority only, and `0065` repairs both operator-transition conflict targets plus the global function default ACL while preserving the exact gateway grants. Migration `0066` additionally seals the unreviewed legacy clinical-content fixtures against every API-role table privilege and migration-owner mutation. Migration `0067` gives `plpgsql_check` a checker-only ephemeral table shape for the known runtime-temporary-table release wrapper. Migration `0069` preserves catalog provenance while moving owner Shelf projection behind an exact replay RPC and stable identity/tombstone boundary. Migration `0070` stages the exact current Ask grant tuple only as an unreleased `draft_blocked` successor without inventing review or approval. Migration `0071` then forces literal zero product-specific recommendation admission, seals the legacy recommendation cache, and makes preference mutation owner-derived through one health-fenced RPC; approval, promotion, rollback, CAT-03 activation, recommendation-mode opening, and any future reviewed clinical publication intentionally require separate authority.
- Every promoted projection traces through its immutable staged record and batch to source artifact, transform, approval, QA, and reviewer hashes.
- A reviewed hosted two-session drill proves atomic promotion, full retry on serialization failure, source-withdrawal containment, exact verification, and non-destructive rollback with shelf/correction references preserved.

Sources:

- `scripts/phase4/catalog-promotion-contract.mjs` - 126852 bytes - sha256 `3cae46f65c8f8d5eeff4a66f41d3caa4a945f75c91ffb047ce48a4875319f6c6`
- `scripts/phase4/catalog-promotion-contract.test.mjs` - 70690 bytes - sha256 `0416507f84fe584ca8d68d25b4daaf0775f0dad2aef3063e5fa30ca1346d12d5`
- `scripts/phase4/build-catalog-stage-envelope.mjs` - 619 bytes - sha256 `cc36fcee8961ab7239ccc606342253acf9cf7c1d2c5daf6910b56da93eefb2f6`
- `scripts/phase4/complete-catalog-database-receipts.mjs` - 705 bytes - sha256 `f73f48b6ee641e7ae05bfeb0de2e4b2ced73492f838bbc94470a03f2f3db41df`
- `supabase/migrations/20260717000057_catalog_import_lifecycle.sql` - 144722 bytes - sha256 `926ba3a453bbe46e8ba97167049f5dda1fb22a59248dee1b9a216d4cc30b7ce7`
- `supabase/migrations/20260718000059_catalog_scan_minimization.sql` - 33319 bytes - sha256 `46c3128d68dccb17b50e28363c478ec7de032a180faf3a5298b0620bfe6e81ec`
- `supabase/migrations/20260718000060_cat07_truthful_freshness.sql` - 24465 bytes - sha256 `8bc2c35bfff443a3c3bf7ab76e52ed17e7d6b961a8b35bdde17701de5c7f574a`
- `supabase/migrations/20260722000061_catalog_import_benzoyl_review_override.sql` - 28316 bytes - sha256 `4048342265ef103e6915411494911a98485528707c7413555725ba4ff427c1e9`
- `supabase/migrations/20260722000062_catalog_curation_statement_guard.sql` - 53193 bytes - sha256 `f7bba7300939fd1f95247c464c49cc01544684637ff25d66076f137475ef9ef1`
- `supabase/migrations/20260722000063_catalog_operator_authority.sql` - 165487 bytes - sha256 `9b2864f4f8943db3ea39d76c7558bcbd2e4ccb1728b30b12a4c186b03f4f0531`
- `supabase/migrations/20260726000065_catalog_operator_transition_conflict_target.sql` - 4519 bytes - sha256 `9afd1ad223c9e7587d42118cee9dbc4fe0b0ea641de4f6fad44d8ecb20d79ccb`
- `supabase/migrations/20260726000066_legacy_clinical_content_immutability.sql` - 5653 bytes - sha256 `61ee02bd285ae59fe1905244335699bc630830e16910fda7eb4f19a21e637cd8`
- `supabase/migrations/20260726000067_catalog_release_temp_table_lint_contract.sql` - 7771 bytes - sha256 `2b9a4fc1412edc2373366bb3532710dcaec0439f5b96bb669aa22246cdfbe9b4`
- `supabase/migrations/20260726000068_routine_adherence_authority.sql` - 33471 bytes - sha256 `37bfd190919f62e63f4e2a61580c5cfe96dea30af72f80259b8d3e9a704f8885`
- `supabase/migrations/20260726000069_routine_completion_sync_bridge.sql` - 66673 bytes - sha256 `a15a8832786011ae3739af56d2c5156dd4102f1ca9c3acbceb0849fa961f665c`
- `supabase/migrations/20260726000070_health_consent_draft_successor_staging.sql` - 22231 bytes - sha256 `8599187818bc105309e1c0dd8affe084972838ba3238a67fe95586ec29e8e54c`
- `supabase/migrations/20260726000071_recommendation_zero_admission.sql` - 14874 bytes - sha256 `4e3e0c46a246b97e98f014bf65499ea86b7f57119744466aebc8c1491331acc9`
- `supabase/tests/database/catalog_operator_authority.test.sql` - 76546 bytes - sha256 `5a1f34ae94cf87751dc2a0244d769bf6ce1660082c96f7a6082587514b7bc03a`
- `supabase/tests/database/clinical_content_legacy_seal.test.sql` - 10085 bytes - sha256 `4fa05a5da0b083d99484a88b4600a02cd830eb6874f440f2faadaa3cf23e0a16`
- `supabase/tests/database/catalog_release_temp_table_lint_contract.test.sql` - 3333 bytes - sha256 `e4045cf7c1e548432876795532cabd086bfde9eb6492ff7f0ae6ce1db2d4a76b`
- `supabase/tests/database/routine_adherence_authority.test.sql` - 38276 bytes - sha256 `8ab6c7bf347c6a45393fac206e62dec2b52fcb38fea7b88e5d9385c363c8b213`
- `supabase/tests/database/routine_completion_sync_bridge.test.sql` - 50474 bytes - sha256 `1a3bef93ee96ac214bc4a7f72b3601e966ec4a5def4d035097ba4cbf928da09e`
- `supabase/tests/database/health_consent_draft_successor_staging.test.sql` - 14110 bytes - sha256 `dc100ac73bb1840bc725004f23087dff7f16198a94d7da67f63f0284029439f7`
- `supabase/tests/database/recommendation_zero_admission.test.sql` - 17945 bytes - sha256 `abce9996b5c27aa4e05b38ed2cf6c603f6d975bda1bd37f5093fbdb197af9166`
- `supabase/tests/upgrade/routine_completion_sync_bridge_0069_upgrade.test.sql` - 8430 bytes - sha256 `6ad21d15844a4a9fe4924e864619598837a26ea9c20e953c1ed7222fcc69a0c2`
- `supabase/tests/upgrade/health_consent_draft_successor_0070_upgrade.test.sql` - 7087 bytes - sha256 `186f5dd60f99514d7febe6a803b51f5fc67b42609f69efbcea6624df0fbba207`
- `supabase/tests/upgrade/recommendation_zero_admission_0071_upgrade.test.sql` - 7912 bytes - sha256 `011e2ffc2994475df1ece65e1503dd363c4d42206a4509d46195a01d4f324c77`
- `scripts/phase9/catalog-import-0061-upgrade-postgres-rehearsal.sql` - 28021 bytes - sha256 `b1d3464bc9b20a6bc432082b8b01832b980ea231338427fa1e187c238dcd7919`
- `scripts/phase9/catalog-curation-0062-upgrade-postgres-rehearsal.sql` - 22993 bytes - sha256 `64102fcd36e69ff58ab957c94866e215f2f72900758bc98926a46057230e45e9`
- `scripts/phase9/catalog-operator-0065-upgrade-postgres-rehearsal.sql` - 5846 bytes - sha256 `b6a914dc1e9d04bbf27933d3e969211482fbbc41e04efd5648fff0b5d56683d6`
- `scripts/phase9/clinical-content-0066-upgrade-postgres-rehearsal.sql` - 6577 bytes - sha256 `d7bfbfb7fed85a600c07d6c779aad6bc1e349c53f7d5eae1fba62597178647e7`
- `scripts/phase9/catalog-release-0067-lint-contract-postgres-rehearsal.sql` - 3956 bytes - sha256 `859c79b291ff98ab81490780533d337fa98e7c4988167283567f4f13e142b18e`
- `scripts/phase9/recommendation-zero-admission-smoke.mjs` - 10268 bytes - sha256 `1762aae74a0efea601be2a053f51d4550fa8525f988152f18e8669690f2ee808`
- `supabase/tests/database/catalog_import_lifecycle.test.sql` - 109814 bytes - sha256 `d543af34e2559d938a12ba4741181f170e3c04fa678c93c411f911118ef2a899`
- `supabase/tests/database/catalog_serving_gate.test.sql` - 36707 bytes - sha256 `1e9e54227161be38e27e2263aab27ec16aeb2ef4ead2316f0dc9daafd12879d9`
- `supabase/tests/database/cat07_truthful_freshness.test.sql` - 36173 bytes - sha256 `ba698f5c9551e47577891264ed80da6ae34c9d788631f134490ac107ffc6a7ba`
- `docs/phase-4/catalog-import-promotion-runbook.md` - 21791 bytes - sha256 `b9f49792c056e98922af8e61157ab5493c9548d799289375e38805ebc39bd888`
- `docs/phase-4/first-curated-product-batch.md` - 10318 bytes - sha256 `fbdb42e6971b7511492bc65efda409d6b0735856fdc2f98be8119bafa2472022`

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

- `.gitignore` - 1644 bytes - sha256 `066737865fcf01e54f00ead1cd32e4cc46e3b8571ffc0bbf685113da5059469a`
- `package.json` - 46193 bytes - sha256 `cbad57882396cb586c31e2c56d77801b51046e3f0f03f86c9d73343acfc2fab4`
- `.github/workflows/quality.yml` - 12475 bytes - sha256 `bdfb2b76adbcce35de64bd04a3b2e5cec3f5ca925eee2eefb307a6e157a581ea`
- `docs/phase-4/catalog-curation-release-runbook.md` - 45531 bytes - sha256 `92a0b946a5e431e787f95d0513289ef1938a8964b23272d329f5cb15395d2be9`
- `docs/phase-4/catalog-coverage-quality-targets.template.json` - 9406 bytes - sha256 `bd6a316f1d520cee3d5ef347d82bff445cbf810b0ca5c8a551b0c13a083dca7a`
- `docs/phase-4/beta-shelf-corpus.template.json` - 24378 bytes - sha256 `eab0f3ab1ac78f53307b69976163c9edd07350a7fdc5dd52c05cb7c3b40106d5`
- `docs/phase-4/catalog-curation-review.template.json` - 22645 bytes - sha256 `90f7348843f623d30b142d27a59a3d93c33978f9d163c06eea0b78ca2bc8283a`
- `docs/phase-4/catalog-cat02-membership-proof.template.json` - 9252 bytes - sha256 `e4bf0f76e0ca82047ffe90700a768ddd12d79d0199da1522369f51a48a67e9d7`
- `docs/phase-4/catalog-curation-database-readback.template.json` - 8237 bytes - sha256 `d2a01a45d7af0d2cf428a144d589a916b1d2089ab1fa809502a0bcb694ac317e`
- `docs/phase-3/consent-matrix.md` - 18185 bytes - sha256 `40c6e5537e138b7c8206baef6fca6be6cafb819813d13771793d8a5ca2fd716b`
- `docs/phase-3/data-inventory.md` - 60091 bytes - sha256 `b5e153f31311d3fa7af2dd16f553f05624b09e27da5d2ed10e44a5018a14aa5c`
- `docs/store-privacy-inventory.md` - 41774 bytes - sha256 `6cbed3fc305f44a3bf58eb3eee087443989c90d7759a46a9454ffb7489ab9480`
- `scripts/phase4/catalog-curation-contract.mjs` - 229778 bytes - sha256 `d5b6565b893b8815eb29ffc5b50665684c86541b0f7580d2a0f80c2db8b56221`
- `scripts/phase4/catalog-curation-contract.test.mjs` - 114869 bytes - sha256 `6f0bb1578661a3951bf4b4b370c003debe0f3d2505439077c91119e7d1d28c3c`
- `scripts/phase4/build-catalog-curation-envelope.mjs` - 4096 bytes - sha256 `d31aa8d2bea0d2640ac4b343bf91261446aafc3155a9e7ce74e4f9406c760bd5`
- `scripts/phase4/catalog-coverage-quality-report.mjs` - 5480 bytes - sha256 `f5fc81ea9f2d31fcec3185fed837634506c89197f7f51777f0c174fa1ab17216`
- `scripts/phase4/catalog-coverage-quality-report.test.mjs` - 6586 bytes - sha256 `616881a177d87b435f75ec39dfbe01eb2bc8dd4d91ff25b50da6c6a776dbb204`
- `supabase/migrations/20260717000058_catalog_launch_curation.sql` - 295282 bytes - sha256 `f2d53caad23347103e29b0f5660eefdbdd22bfdc05cc2cb47445ece4192919a6`
- `supabase/tests/database/catalog_launch_curation.test.sql` - 202710 bytes - sha256 `7272a899ade80123b990747c1f9402930ba8b07e7b71fbfe4c13b45a11d38b19`
- `supabase/migrations/20260717000057_catalog_import_lifecycle.sql` - 144722 bytes - sha256 `926ba3a453bbe46e8ba97167049f5dda1fb22a59248dee1b9a216d4cc30b7ce7`
- `supabase/migrations/20260718000059_catalog_scan_minimization.sql` - 33319 bytes - sha256 `46c3128d68dccb17b50e28363c478ec7de032a180faf3a5298b0620bfe6e81ec`
- `supabase/migrations/20260718000060_cat07_truthful_freshness.sql` - 24465 bytes - sha256 `8bc2c35bfff443a3c3bf7ab76e52ed17e7d6b961a8b35bdde17701de5c7f574a`
- `supabase/migrations/20260722000061_catalog_import_benzoyl_review_override.sql` - 28316 bytes - sha256 `4048342265ef103e6915411494911a98485528707c7413555725ba4ff427c1e9`
- `supabase/migrations/20260722000062_catalog_curation_statement_guard.sql` - 53193 bytes - sha256 `f7bba7300939fd1f95247c464c49cc01544684637ff25d66076f137475ef9ef1`
- `supabase/tests/database/catalog_import_lifecycle.test.sql` - 109814 bytes - sha256 `d543af34e2559d938a12ba4741181f170e3c04fa678c93c411f911118ef2a899`
- `supabase/tests/database/catalog_serving_gate.test.sql` - 36707 bytes - sha256 `1e9e54227161be38e27e2263aab27ec16aeb2ef4ead2316f0dc9daafd12879d9`
- `supabase/tests/database/cat07_truthful_freshness.test.sql` - 36173 bytes - sha256 `ba698f5c9551e47577891264ed80da6ae34c9d788631f134490ac107ffc6a7ba`

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

- `apps/mobile/src/features/catalog/analytics.test.ts` - 3368 bytes - sha256 `aebe009cf40c8c8c07e88395c0395a90449d79bb24d514a187b06fee7b6bfacc`
- `apps/mobile/src/features/catalog/analytics.ts` - 1523 bytes - sha256 `0576db6223f0a0f0a3b4a3a12aa06818c91787b812438724867a7146ebd5c592`
- `apps/mobile/src/features/catalog/CatalogReportConfirmation.tsx` - 4702 bytes - sha256 `2cfd1ff61e88ea74dfa8aca794cc114554edb704bd81f3ddad9c387a6f092a4d`
- `apps/mobile/src/features/catalog/client.test.ts` - 31695 bytes - sha256 `42dc1c9e4d29c565827535836cf635c37bc19399f663859695a1546df518d297`
- `apps/mobile/src/features/catalog/client.ts` - 23824 bytes - sha256 `85b771f782010e99cd4061ed331557de73e68a16fb838d92f720f58d042f693e`
- `apps/mobile/src/features/catalog/copy.ts` - 1913 bytes - sha256 `b182cec74cb72f850e83dcca14a5548c6277d73a9eaac229f6062e665090f958`
- `apps/mobile/src/features/catalog/ingredientParser.test.ts` - 3602 bytes - sha256 `a38abeedcf0b3a02e36b32ff6d3fa699d27c19dd5ffc2d3286f05e3278ec2afc`
- `apps/mobile/src/features/catalog/ingredientParser.ts` - 7818 bytes - sha256 `4c3290b955c68859cd63d4aeddae374a5c0c7efb9730b1359aa72e3b09af2a88`
- `apps/mobile/src/features/catalog/normalization.test.ts` - 2110 bytes - sha256 `1f31a87618439a232cb1d96c17ac460a5b0d7fe7a6588f6ba61283f79ff875c8`
- `apps/mobile/src/features/catalog/normalization.ts` - 2647 bytes - sha256 `16317a4fcfc871414a1b902e8323f24eceb9982c9b40959d49225827c5aeb9ff`
- `apps/mobile/src/features/catalog/obf.test.ts` - 1858 bytes - sha256 `c2213d6ebbda2d3531207576a2452e66f1c0d4a719fd5b1a2f367cb6539c3ea4`
- `apps/mobile/src/features/catalog/obf.ts` - 4536 bytes - sha256 `fd176cfb945b3543b342acadc6f40c333d6c6b484023884998a6f448ebadd2b6`
- `apps/mobile/src/features/catalog/ocrRenderDiagnostics.test.ts` - 3444 bytes - sha256 `d2ae6887317284f49809f2d7bfcabb39edad07a5dd68023d35d0cd379f85b590`
- `apps/mobile/src/features/catalog/ocrRenderDiagnostics.ts` - 3326 bytes - sha256 `2597cf8247f86fa597df212dd9aa841d6515b17795597b2efe2371f30067fb0b`
- `apps/mobile/src/features/catalog/ocrReview.test.ts` - 1433 bytes - sha256 `6cbec28973d2dafe17b71d319d5cf0f9fb637c7925d6318e7e0f05c179531102`
- `apps/mobile/src/features/catalog/ocrReview.ts` - 654 bytes - sha256 `271d269647b396ede1a6482324e1b9075d47f702c51a38daddddb745627b18ff`
- `apps/mobile/src/features/catalog/quality.test.ts` - 2258 bytes - sha256 `b5187f33001f741cdb8636ad61343f072502b60ffe2fba70b5e831fce570e599`
- `apps/mobile/src/features/catalog/quality.ts` - 4663 bytes - sha256 `7156ff221071cf6ab90c3558c20d084c53e1f48d0025843ebea5275929103e53`
- `apps/mobile/src/features/catalog/recoveryReport.test.ts` - 1873 bytes - sha256 `b7e4593f9b49f40152266ff5f1ef68d45fc3d651fbaba7bc50bc10858c1a8e94`
- `apps/mobile/src/features/catalog/recoveryReport.ts` - 1449 bytes - sha256 `a1968787279dc1232a27426cf70724a5c8f0d7d65c3669fb462f7b0a25485912`
- `apps/mobile/src/features/catalog/reportOperation.test.ts` - 2745 bytes - sha256 `f306511b72663dfa01c24897a58ccdc6bdaba2081a28a64222e16e9f851c5752`
- `apps/mobile/src/features/catalog/reportOperation.ts` - 2796 bytes - sha256 `680cae013c853f82df16c3eec1c72c2623a752d1583204c1b7ecd917c83dfa37`
- `apps/mobile/src/features/catalog/reportPresentation.test.ts` - 5906 bytes - sha256 `226c050f99dae3e465fbf49da3c6618549bab261dccecb64773a8b3efaaaf4ab`
- `apps/mobile/src/features/catalog/reportPresentation.ts` - 5781 bytes - sha256 `6fbe26f5bfb254a22272603da403455763a4ac23f1966e998cf891fe36b7e615`
- `apps/mobile/src/features/catalog/reportTransport.ts` - 6607 bytes - sha256 `ef8e02518936fb1fd6bdbff03aebf4012d5fb84e2ef3467c948b727c420ff483`
- `apps/mobile/src/features/catalog/searchQuery.test.ts` - 2206 bytes - sha256 `2aeec78ae03dcd2ddd01bc0f5e462d72c50214ffda24aa0652fcad4b9476c446`
- `apps/mobile/src/features/catalog/searchQuery.ts` - 619 bytes - sha256 `8016301e585dbafd22665a48dffd821a6755b578014f32d156f214cfc762bfbe`
- `apps/mobile/src/features/catalog/searchRenderDiagnostics.test.ts` - 4394 bytes - sha256 `6b596f431cc3e96299944681b131d7abaeacea4d0c708113841226a114284684`
- `apps/mobile/src/features/catalog/searchRenderDiagnostics.ts` - 4036 bytes - sha256 `e7086df34f6f721e3b9557af78e24e3fbddefb78cf6c191150ce6c06ac889819`
- `apps/mobile/src/features/catalog/searchRequestCoordinator.test.ts` - 2758 bytes - sha256 `337ee756d8c8afcc855466255a0b8141ca46f67ea8e56cb139c2ec83b23f12aa`
- `apps/mobile/src/features/catalog/searchRequestCoordinator.ts` - 1657 bytes - sha256 `2374a0c869835113153d5a47a0c4b5a37ec0dbecef7e33417dab10eb76683280`
- `apps/mobile/src/features/shelf/addSubmissionAttempt.test.ts` - 1218 bytes - sha256 `31ca05a08951ddf868395760edd3c647ef26f19623e881fbeb8bb3de4ecdef81`
- `apps/mobile/src/features/shelf/addSubmissionAttempt.ts` - 652 bytes - sha256 `deacb413cd74e8725690886d7a1415f70d915acf40d7e27153f1278142a39d2a`
- `apps/mobile/src/features/shelf/analytics.test.ts` - 543 bytes - sha256 `fce0e7cd2128b9c01644369a7dde86d178f44aaa80b0c7f9a58079ab08d4cc17`
- `apps/mobile/src/features/shelf/analytics.ts` - 599 bytes - sha256 `1e514f5fc1a96111a8b792dc8841ad41a11130dd6de7031eb08a353f85ef1050`
- `apps/mobile/src/features/shelf/barcodeScanSession.test.ts` - 5210 bytes - sha256 `330c52a54d12b7be4ae9aabe745ac9adde3688ca39779fcf6d399fc8452b3e52`
- `apps/mobile/src/features/shelf/barcodeScanSession.ts` - 3270 bytes - sha256 `cdedabaab860b076cb1ec84ac87f56471ecec5f578e176d9119f28ce3d783362`
- `apps/mobile/src/features/shelf/catalogLookupRecovery.test.ts` - 8306 bytes - sha256 `1cdcc8095503879420c4c2c2198e84b2f8a0569e2ccbafc489b3e031589fc707`
- `apps/mobile/src/features/shelf/catalogLookupRecovery.ts` - 7625 bytes - sha256 `aafbea137610e42b8d6df23c18f1e93731d78840a8017e3c577c02acf9ee0247`
- `apps/mobile/src/features/shelf/catalogRecoveryAsync.test.ts` - 13373 bytes - sha256 `b336d46440752fe9463c5fc479f5f1abd0c344b8d14b99ae2d1396d2ff78c56a`
- `apps/mobile/src/features/shelf/categories.test.ts` - 1325 bytes - sha256 `a6f69552408d01ddfd0f5d44d0c296101f77eda35f0affcbbde580d3dd950a42`
- `apps/mobile/src/features/shelf/categories.ts` - 2393 bytes - sha256 `1a8449afa7536dca3ec6b744016af047f3e98c97b8e2a71412e0d3d90b3d1864`
- `apps/mobile/src/features/shelf/expiry.test.ts` - 2602 bytes - sha256 `dca407f4572147d1368e0f2b108e4a59ed2bb0f63e541bdeb0f1264bbb73d952`
- `apps/mobile/src/features/shelf/expiry.ts` - 2778 bytes - sha256 `43e97ea2d296532af742bd23643e9ca48ed0193d756ba5c163f421703a15508d`
- `apps/mobile/src/features/shelf/freshness.test.ts` - 8351 bytes - sha256 `fee1fd4da816079fe1e3cd10a33af16c74e7244ec996905605013f7884699a0a`
- `apps/mobile/src/features/shelf/freshness.ts` - 7302 bytes - sha256 `15e49e4d6e0911eb7cb465c15c8b2a836affe16d09f6f122c1d4ddb3ee1294b3`
- `apps/mobile/src/features/shelf/freshnessMigration.test.ts` - 4858 bytes - sha256 `03808fae36a3a74134bcda3d5db0e729729dcde2653b0331a7d481a5a71f9689`
- `apps/mobile/src/features/shelf/IntakeContext.test.ts` - 2193 bytes - sha256 `9bc6f78dec650d85c5580cb691206733882b43f719f32faae937f140bbb2a859`
- `apps/mobile/src/features/shelf/IntakeContext.tsx` - 2707 bytes - sha256 `e0cd87f56b16cb77fcc474b06050235bc72c732108c82c0316d09bc72411b3a4`
- `apps/mobile/src/features/shelf/intakeSession.ts` - 2849 bytes - sha256 `51e3eb2a4384da1f128b530867bfc23b13a85f24e69de3ab223eb8356368609c`
- `apps/mobile/src/features/shelf/labels.test.ts` - 911 bytes - sha256 `2ba7c9f148da2c53095451e9a9dee151446950a4f60ec52ccc08a0f20d2a9c6f`
- `apps/mobile/src/features/shelf/labels.ts` - 981 bytes - sha256 `fbfc6530dd72edc301ae33f4e1c065bad568d380d7fd94e1711d6698725cd55e`
- `apps/mobile/src/features/shelf/limits.ts` - 222 bytes - sha256 `8f469d2cafccc1f3ebb14b4ac4e09951d4e58ab63df7bea88c4906a3b8aa8449`
- `apps/mobile/src/features/shelf/LocalDateField.tsx` - 1878 bytes - sha256 `e5cf3e8c0700e99944dcf1d515e511d4d78464277643599a6ba704daec7b9503`
- `apps/mobile/src/features/shelf/metadata.ts` - 1606 bytes - sha256 `e7da08df3d733c91f2464b7de96fdabbfa45c283fbf47659d1e2996821f16546`
- `apps/mobile/src/features/shelf/mutations.ts` - 4655 bytes - sha256 `13dfde9b8a5490f67b5269271ae0bdf6bb3910ba5b55b4db60560690d7a56eac`
- `apps/mobile/src/features/shelf/pairedConflicts.ts` - 766 bytes - sha256 `eb4cc3b857828ae8d123890b0771a44fe57e73e29da3e6207604fd3ed640a918`
- `apps/mobile/src/features/shelf/paoProvenance.test.ts` - 1305 bytes - sha256 `036d37d4a9e008be0b89e5c63d9091704f439d23111ca377513a5f4a6bebc555`
- `apps/mobile/src/features/shelf/paoProvenance.ts` - 511 bytes - sha256 `a9688d11fda1c37ac1aae3d66426d82f470ba7a04252d7b4558cb9e361c90910`
- `apps/mobile/src/features/shelf/scanLog.test.ts` - 4009 bytes - sha256 `5fbd9506ee53dc6908b7839a4c4f2bcecfaeb6b2f7748ba49fc7a125b9e773c2`
- `apps/mobile/src/features/shelf/scanLog.ts` - 1530 bytes - sha256 `370419a096fde7cda1980d998d78fadab2cf9d825570a55e3f7ec4f4d78824ab`
- `apps/mobile/src/features/shelf/ShelfDataAvailabilityGate.tsx` - 4926 bytes - sha256 `b31af7e6edea964195e39f90e21eb14065745fd851ec504bfd6e28b3fc91d8d6`
- `apps/mobile/src/features/shelf/shelfRenderDiagnostics.test.ts` - 3187 bytes - sha256 `95b13fc770765acbf385893636c318449d42680faa61e4d735521d146dc22b13`
- `apps/mobile/src/features/shelf/shelfRenderDiagnostics.ts` - 3381 bytes - sha256 `5fc7a6c4000c93d5058509d26e5d8c1a480ba159a6db0a36579d54fad417a56b`
- `apps/mobile/src/features/shelf/shelfRoutes.test.ts` - 69844 bytes - sha256 `4e25d81e10f9bba5eead0e597eaabec9f1e459600b73bc922fe8bb75528d3a71`
- `apps/mobile/src/features/shelf/shelfScanOutboxMigration.test.ts` - 4755 bytes - sha256 `45e1dfa21c1ec493bf6663da5ff0af17bd17748596c7d4c2fd8cd3375a32ad6d`
- `apps/mobile/src/features/shelf/shelfStressFixture.test.ts` - 3999 bytes - sha256 `ae29eead217c5a96acec1a07314cd92592f5cf3fef910e197b2b1a998e60a755`
- `apps/mobile/src/features/shelf/shelfStressFixture.ts` - 3821 bytes - sha256 `f23f1ceb1e4af3cae17a19a4c35a931a71cfe7fc8cf3ecc39bcff173c34d81a0`
- `apps/mobile/src/features/shelf/store.test.ts` - 57316 bytes - sha256 `b36dde3201cc2abedb699a9a9b16e572ad19f04142ea894ab757c548898bb650`
- `apps/mobile/src/features/shelf/store.ts` - 58802 bytes - sha256 `29efebed92401a8cdb627f382977eb65c9343a35d90f1c947febd6407d4808e7`
- `apps/mobile/src/features/shelf/useShelf.test.ts` - 5075 bytes - sha256 `2aa0f2717f781bdf8836d451df432e577ab157fa5e0799f2ab674e87b163aea9`
- `apps/mobile/src/features/shelf/useShelf.ts` - 10548 bytes - sha256 `5c77df5d4c09c62315d94976afb745cd564242f2ec49efe8fd5ea4656b36b1fc`
- `apps/mobile/src/app/shelf/[id].tsx` - 45428 bytes - sha256 `1b2fddb06a6809c09987635c672c9a43026226805481c5438df09950c8d6cc3d`
- `apps/mobile/src/app/shelf/search.tsx` - 24504 bytes - sha256 `193518934f1168ed86ddc90f530af12065b8c00e4c394722ce61a8181901f087`
- `apps/mobile/src/app/shelf/manual.tsx` - 17625 bytes - sha256 `7b5be927575a0fcc5febeafe03511c1bda402e591644707ffb167807bccb3190`
- `apps/mobile/src/features/recommendations/admission.test.ts` - 3673 bytes - sha256 `41f457e23372c20b95d5bfe723a4077bebfefbf833aaa4cf786e73505a51cf70`
- `apps/mobile/src/features/recommendations/admission.ts` - 3362 bytes - sha256 `699de9485fa5fed2335fb4b91dbd9f263ae7cd081048c30bb6b4d6fc17bb7934`
- `apps/mobile/src/features/recommendations/applyPreferences.test.ts` - 1319 bytes - sha256 `751559e6d23b979ffe0cd2924d42f30eb41b591f6427bf13d27c175cffdb75a3`
- `apps/mobile/src/features/recommendations/applyPreferences.ts` - 515 bytes - sha256 `61c8add8701211047e510e0302e6d8fd97a1d408f6efef09fadbad89432cef94`
- `apps/mobile/src/features/recommendations/catalog.ts` - 9190 bytes - sha256 `e183af7ee7a5857de1aad0024f823ab2404d9ed1d5d60f7faf56d5f65973b511`
- `apps/mobile/src/features/recommendations/claimsafety.test.ts` - 11306 bytes - sha256 `252f4bd0350bbdeb0252e488c6f2805631ec27a3e49293946b96c04895678276`
- `apps/mobile/src/features/recommendations/copy.ts` - 11164 bytes - sha256 `af155a735087bbcc2890f9fb758fdfb924c73afcd3e4708aa41996ef54c74c8f`
- `apps/mobile/src/features/recommendations/engine.test.ts` - 31685 bytes - sha256 `df0fe0eb470f47ae40d09cbc427de0c1c80081c2b22ca9be7e216dbc881cfb31`
- `apps/mobile/src/features/recommendations/engine.ts` - 24388 bytes - sha256 `a1d0a76d4b276e2a38dd50bd473f73cab343c65610d67a84442127535e3a950c`
- `apps/mobile/src/features/recommendations/fit.test.ts` - 5245 bytes - sha256 `7e5df21dc82923a9b51041a3a986c6d9ff6d2aa77acb84d5cd947c5f2f9122e9`
- `apps/mobile/src/features/recommendations/fit.ts` - 5856 bytes - sha256 `4eec6fdbc73890afa427ab8257eb9818ad3bef9771ea4c21c2233fedb6dab505`
- `apps/mobile/src/features/recommendations/fragrance.ts` - 912 bytes - sha256 `da21d1a0df285d242c9aef9fe4c05e329d44f3fb1047a2c4a075d4585d2c1644`
- `apps/mobile/src/features/recommendations/goalAdmission.test.ts` - 2749 bytes - sha256 `9342f3791b75441c2522f505832a3e7eb371de999ef15d8f166277acde9337aa`
- `apps/mobile/src/features/recommendations/goalAdmission.ts` - 2696 bytes - sha256 `fb83706008828017504ae68c94ba561cb7441dfb65047d341771bc0a2d2aa27b`
- `apps/mobile/src/features/recommendations/goalProvenance.ts` - 4471 bytes - sha256 `b1c4ee246ed40885d8fc6b57cbcfecf5d66124a38fe4209841dd16df39ec3cc6`
- `apps/mobile/src/features/recommendations/loading.ts` - 707 bytes - sha256 `3708883b8d09582f3620cc933e2412ef2c6054d0fe5d9f5ca15d9145067c5c55`
- `apps/mobile/src/features/recommendations/preferences.ts` - 920 bytes - sha256 `83a545245a56af5094cc15ef2d152a43e3ec77d3e6de80788b5d7a1ef530bcf4`
- `apps/mobile/src/features/recommendations/recommendationOutboxMigration.test.ts` - 2724 bytes - sha256 `9d558a4a7c0a5ccc5f3993f1a8e670e975369009aaf7594748eb9c410dc30c26`
- `apps/mobile/src/features/recommendations/recommendationRoutes.test.ts` - 16214 bytes - sha256 `613046a86d8d81bd131362697574f18dc7f7ed2d44ce3041076e358ad93eec62`
- `apps/mobile/src/features/recommendations/RecommendationsTeaser.test.ts` - 4098 bytes - sha256 `b5e0476fc56282475ab005d50a49e3e65104a1e9d413389d81cf957976eea03a`
- `apps/mobile/src/features/recommendations/RecommendationsTeaser.tsx` - 8769 bytes - sha256 `9a255293b62127479d28415260afe39f1730cf408f25fcef38c55610d1e327ff`
- `apps/mobile/src/features/recommendations/replenishment.test.ts` - 6348 bytes - sha256 `412f2d66356e09df6c9766a156b754978d7fdf5874e960204cd491844bfdcfc7`
- `apps/mobile/src/features/recommendations/replenishment.ts` - 3829 bytes - sha256 `ad0658a4a88071c1991c13c1d8d797d6250cdf5fa70fc33f2613cef380b4e610`
- `apps/mobile/src/features/recommendations/store.test.ts` - 8337 bytes - sha256 `e7b41b103e0634e744c0321e2ee1ff78bb9447c0365c431b52630e16e1c0ee46`
- `apps/mobile/src/features/recommendations/store.ts` - 7365 bytes - sha256 `cb428e23452d4315e573258daa86f0f68c5cbee614bf120408a0a5ad6ca4ef66`
- `apps/mobile/src/features/recommendations/useRecommendations.test.ts` - 2802 bytes - sha256 `facda1c30fe00fe4cf5e7bf7a98c3435481835857c4774a3e9316af501f343bc`
- `apps/mobile/src/features/recommendations/useRecommendations.ts` - 3878 bytes - sha256 `c86b5797892557f0197bc812cac9bf1ebe5eab79956590be5e64955b3331f733`
- `supabase/functions/catalog-report/index.ts` - 10890 bytes - sha256 `00c15af1cac9a9cda6514d5c441b4c0b2420959a24727d697f7dce9ab8c4acbd`
- `supabase/functions/catalog-report/privacy.ts` - 6403 bytes - sha256 `e81dfbdafe784f79503fc4ad03487040f6e2725fe63f5000df77d944c3e28eec`
- `supabase/functions/catalog-report/privacy.test.ts` - 10228 bytes - sha256 `31411acef464f8e0dda16605ee3f0af769163f67ea920ae5c1f6156ee4508f1d`

### recommendation-zero-admission - Fail-closed product-specific recommendation admission

- Domain: productSurface
- Status: local-scaffold
- Launch gate: B-CURATED-CATALOG
- Owner: Engineering + clinical reviewers + regulatory counsel + database reviewer

Required evidence:

- CORE-06A remains a zero-product-admission checkpoint: only type-first and existing-Shelf context provenance can exist, and neither provenance can render or fetch commerce.
- Goal-active output requires the exact current feature flag, consent, quiz/profile/goal provenance, and positive review clearance; the current clearance is closed and empty.
- Migration `0071` forces every catalog row recommendation-ineligible, returns a zero-row service-only recommendation projection, seals the legacy recommendation cache, and exposes only an owner-derived health-fenced preference RPC.
- The aggregate source contract, static database gate, exact pgTAP contract, and forward-upgrade contract all pass before any product-specific mode-opening change can be reviewed.
- This checkpoint does not establish reviewed products, professional clearance, hosted or physical-device behavior, App Review acceptance, legal compliance, product safety, product-market fit, or revenue.

Sources:

- `docs/09-personalized-recommendations.md` - 46694 bytes - sha256 `27f422fbf7d58d35193d03611b66d80148c2f2e74883dd2b81e0be08e77f87ce`
- `docs/hugeToDo/CORE-06-RECOMMENDATION-ADMISSION-SOURCE-CHECKPOINT-2026-07-26.md` - 35345 bytes - sha256 `6a4bba46c424d8941303d3a7d695e916c8d1b70671af12613fd944903f657246`
- `scripts/core06/recommendation-admission-source-contract.test.mjs` - 31820 bytes - sha256 `8e32aba423280da0f22dba3fbc07adfde1ce28262967cd33e7e8d3d8830c1677`
- `apps/mobile/src/features/recommendations/admission.ts` - 3362 bytes - sha256 `699de9485fa5fed2335fb4b91dbd9f263ae7cd081048c30bb6b4d6fc17bb7934`
- `apps/mobile/src/features/recommendations/admission.test.ts` - 3673 bytes - sha256 `41f457e23372c20b95d5bfe723a4077bebfefbf833aaa4cf786e73505a51cf70`
- `apps/mobile/src/features/recommendations/goalAdmission.ts` - 2696 bytes - sha256 `fb83706008828017504ae68c94ba561cb7441dfb65047d341771bc0a2d2aa27b`
- `apps/mobile/src/features/recommendations/goalAdmission.test.ts` - 2749 bytes - sha256 `9342f3791b75441c2522f505832a3e7eb371de999ef15d8f166277acde9337aa`
- `apps/mobile/src/features/recommendations/goalProvenance.ts` - 4471 bytes - sha256 `b1c4ee246ed40885d8fc6b57cbcfecf5d66124a38fe4209841dd16df39ec3cc6`
- `apps/mobile/src/features/recommendations/catalog.ts` - 9190 bytes - sha256 `e183af7ee7a5857de1aad0024f823ab2404d9ed1d5d60f7faf56d5f65973b511`
- `apps/mobile/src/features/recommendations/engine.ts` - 24388 bytes - sha256 `a1d0a76d4b276e2a38dd50bd473f73cab343c65610d67a84442127535e3a950c`
- `apps/mobile/src/features/recommendations/engine.test.ts` - 31685 bytes - sha256 `df0fe0eb470f47ae40d09cbc427de0c1c80081c2b22ca9be7e216dbc881cfb31`
- `apps/mobile/src/features/recommendations/useRecommendations.ts` - 3878 bytes - sha256 `c86b5797892557f0197bc812cac9bf1ebe5eab79956590be5e64955b3331f733`
- `apps/mobile/src/features/commerce/WhereToBuy.tsx` - 156 bytes - sha256 `a459ece2191dbbfb7aa787e784dd074b8b361369e904ee9d76baf8118848a0ae`
- `apps/mobile/src/app/recommendations/[id].tsx` - 9519 bytes - sha256 `a543fefe3766440bb069d22cc2610afa9d479d5bce41dbadecb815717a073083`
- `supabase/migrations/20260726000071_recommendation_zero_admission.sql` - 14874 bytes - sha256 `4e3e0c46a246b97e98f014bf65499ea86b7f57119744466aebc8c1491331acc9`
- `supabase/tests/database/recommendation_zero_admission.test.sql` - 17945 bytes - sha256 `abce9996b5c27aa4e05b38ed2cf6c603f6d975bda1bd37f5093fbdb197af9166`
- `supabase/tests/upgrade/recommendation_zero_admission_0071_upgrade.test.sql` - 7912 bytes - sha256 `011e2ffc2994475df1ece65e1503dd363c4d42206a4509d46195a01d4f324c77`
- `scripts/phase9/recommendation-zero-admission-smoke.mjs` - 10268 bytes - sha256 `1762aae74a0efea601be2a053f51d4550fa8525f988152f18e8669690f2ee808`

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

- `docs/04-smart-shelf.md` - 66906 bytes - sha256 `a83cbda544e062d873a8f3905923e35fca2e72a0213c33b0d6f6d79d8d40ca02`
- `docs/USER_FLOW_TREE.md` - 488928 bytes - sha256 `3ba79f8dd6dd3dc9bf98311ab9e77bce76403703dadf2b5e9e85fe20609875bd`
- `apps/mobile/src/app/onboarding/products.tsx` - 16016 bytes - sha256 `1c1080cf7cecf9dc3cba1830716f166e10b53d4dbc71178a08ae14a3e3b805b6`
- `apps/mobile/src/app/shelf/[id].tsx` - 45428 bytes - sha256 `1b2fddb06a6809c09987635c672c9a43026226805481c5438df09950c8d6cc3d`
- `apps/mobile/src/app/shelf/opened.tsx` - 18282 bytes - sha256 `1e7108e64c4b12f462a51745f1e15d465990ed2dc8f7cf0b76f027afbc677c85`
- `apps/mobile/src/app/shelf/replenish.tsx` - 10694 bytes - sha256 `e4dee732e65c6bbdb7870597941390d5e53416940cce96d02d3f4d7eb8d2aec1`
- `apps/mobile/src/app/shelf/scan.tsx` - 33673 bytes - sha256 `a8ec4e910593e3e4917e75b170b300cff88eefac35f46b1ea332d0b544279248`
- `apps/mobile/src/app/shelf/search.tsx` - 24504 bytes - sha256 `193518934f1168ed86ddc90f530af12065b8c00e4c394722ce61a8181901f087`
- `apps/mobile/src/features/catalog/client.ts` - 23824 bytes - sha256 `85b771f782010e99cd4061ed331557de73e68a16fb838d92f720f58d042f693e`
- `apps/mobile/src/features/catalog/client.test.ts` - 31695 bytes - sha256 `42dc1c9e4d29c565827535836cf635c37bc19399f663859695a1546df518d297`
- `apps/mobile/src/features/intelligence/pao.ts` - 5160 bytes - sha256 `32209515587ba1136c72abcd9703f25ef46c0aa6a289bff5fac685a08a0eafde`
- `apps/mobile/src/features/intelligence/pao.test.ts` - 3875 bytes - sha256 `d4ff777e1b13717b1fd7b6d01a695070e34f065a311b1f98e04d3b0bb737a385`
- `apps/mobile/src/features/notifications/store.ts` - 9910 bytes - sha256 `396f23be42696512500e46c8250b149f07a7100f0c2e503805fe1bf28cae1b88`
- `apps/mobile/src/features/notifications/store.test.ts` - 7931 bytes - sha256 `b8a63af36c9facd9806f11a4057ddd65a506c53bc6a7383afa91af23a2663366`
- `apps/mobile/src/features/notifications/replenishmentOptInMigration.test.ts` - 718 bytes - sha256 `2b34153c9a4a85b29bbf8483217a65e4ee99b15837a50128bc7cf572c09fb4a0`
- `apps/mobile/src/features/recommendations/replenishment.ts` - 3829 bytes - sha256 `ad0658a4a88071c1991c13c1d8d797d6250cdf5fa70fc33f2613cef380b4e610`
- `apps/mobile/src/features/recommendations/replenishment.test.ts` - 6348 bytes - sha256 `412f2d66356e09df6c9766a156b754978d7fdf5874e960204cd491844bfdcfc7`
- `apps/mobile/src/features/shelf/freshness.ts` - 7302 bytes - sha256 `15e49e4d6e0911eb7cb465c15c8b2a836affe16d09f6f122c1d4ddb3ee1294b3`
- `apps/mobile/src/features/shelf/freshness.test.ts` - 8351 bytes - sha256 `fee1fd4da816079fe1e3cd10a33af16c74e7244ec996905605013f7884699a0a`
- `apps/mobile/src/features/shelf/freshnessMigration.test.ts` - 4858 bytes - sha256 `03808fae36a3a74134bcda3d5db0e729729dcde2653b0331a7d481a5a71f9689`
- `apps/mobile/src/features/shelf/limits.ts` - 222 bytes - sha256 `8f469d2cafccc1f3ebb14b4ac4e09951d4e58ab63df7bea88c4906a3b8aa8449`
- `apps/mobile/src/features/shelf/paoProvenance.ts` - 511 bytes - sha256 `a9688d11fda1c37ac1aae3d66426d82f470ba7a04252d7b4558cb9e361c90910`
- `apps/mobile/src/features/shelf/paoProvenance.test.ts` - 1305 bytes - sha256 `036d37d4a9e008be0b89e5c63d9091704f439d23111ca377513a5f4a6bebc555`
- `apps/mobile/src/features/shelf/store.ts` - 58802 bytes - sha256 `29efebed92401a8cdb627f382977eb65c9343a35d90f1c947febd6407d4808e7`
- `apps/mobile/src/features/shelf/store.test.ts` - 57316 bytes - sha256 `b36dde3201cc2abedb699a9a9b16e572ad19f04142ea894ab757c548898bb650`
- `apps/mobile/src/lib/offline/shelfMirrorQueue.ts` - 8443 bytes - sha256 `e03000a6c457814ce75e7ccd62375bc6fe4bd0681185a86885d8292e7a274f61`
- `apps/mobile/src/lib/offline/shelfMirrorQueue.test.ts` - 11914 bytes - sha256 `994b92f546d3b3cdfafbab14a52a1ddbb82d4a4bd5d793fa9b14ce7ac6a52b38`
- `apps/mobile/src/lib/offline/OfflineSync.tsx` - 12107 bytes - sha256 `26dd7af6d4083ed8bf06a88bbc08887ea0a5d6b197600ed108cc81de4ce74af8`
- `apps/mobile/src/lib/offline/OfflineSync.test.ts` - 22933 bytes - sha256 `37a321d29dff0aec1140d3060a417e0d928a8306774da039d0d3dc3b551664ad`
- `supabase/functions/catalog-lookup/index.ts` - 11843 bytes - sha256 `23e76d1ba0fd1e199be94986fb0e066e7e4cc6b64d04c642bdd1fb849c97b220`
- `supabase/functions/catalog-lookup/catalogContract.ts` - 80 bytes - sha256 `9707c48c48465b279c2112d84a8a1459867c395490d3c184aaa4e6c2fbc7f81a`
- `supabase/functions/catalog-lookup/catalogContract.test.ts` - 14681 bytes - sha256 `96ab5dd088984ce67115b993e84436205ebb1bfabee25ea2d60558e7eea85f46`
- `supabase/functions/catalog-search/index.ts` - 10142 bytes - sha256 `b7187fee6fe8981d42219de31d1358d11db16bb8f40be530c4d2f838e5400494`
- `supabase/functions/catalog-search/catalogContract.ts` - 1343 bytes - sha256 `62cc1e0d2e62d37187922e4ed1766b12d8ca8aa48cdebf3e3271ea6ae7ce417e`
- `supabase/functions/catalog-search/catalogContract.test.ts` - 3041 bytes - sha256 `dd91fb0c009da68074d795d7819149d9bb970e47c2fba6bbdfc7a08f7f53922d`
- `supabase/migrations/20260711000038_shelf_freshness_invariants.sql` - 1973 bytes - sha256 `672df1e56fac4cdfc6bf641c3249221aaacf630439d28898a79ace2d25181bcd`
- `supabase/migrations/20260711000039_replenishment_alert_opt_in.sql` - 372 bytes - sha256 `eac60d4bf92f465ad2264c509f8e0a2f412b5780f862cf602b8ff16e1e2e1299`
- `supabase/migrations/20260717000056_catalog_serving_eligibility_gate.sql` - 34119 bytes - sha256 `0d4543effd4eb5c6d5e036b96d777b217bf853fb0c9587575429a28f14d7793c`
- `supabase/migrations/20260718000060_cat07_truthful_freshness.sql` - 24465 bytes - sha256 `8bc2c35bfff443a3c3bf7ab76e52ed17e7d6b961a8b35bdde17701de5c7f574a`
- `supabase/migrations/20260722000061_catalog_import_benzoyl_review_override.sql` - 28316 bytes - sha256 `4048342265ef103e6915411494911a98485528707c7413555725ba4ff427c1e9`
- `supabase/migrations/20260722000062_catalog_curation_statement_guard.sql` - 53193 bytes - sha256 `f7bba7300939fd1f95247c464c49cc01544684637ff25d66076f137475ef9ef1`
- `supabase/migrations/20260726000069_routine_completion_sync_bridge.sql` - 66673 bytes - sha256 `a15a8832786011ae3739af56d2c5156dd4102f1ca9c3acbceb0849fa961f665c`
- `supabase/tests/database/catalog_serving_gate.test.sql` - 36707 bytes - sha256 `1e9e54227161be38e27e2263aab27ec16aeb2ef4ead2316f0dc9daafd12879d9`
- `supabase/tests/database/cat07_truthful_freshness.test.sql` - 36173 bytes - sha256 `ba698f5c9551e47577891264ed80da6ae34c9d788631f134490ac107ffc6a7ba`
- `supabase/tests/database/routine_completion_sync_bridge.test.sql` - 50474 bytes - sha256 `1a3bef93ee96ac214bc4a7f72b3601e966ec4a5def4d035097ba4cbf928da09e`
- `supabase/tests/upgrade/routine_completion_sync_bridge_0069_upgrade.test.sql` - 8430 bytes - sha256 `6ad21d15844a4a9fe4924e864619598837a26ea9c20e953c1ed7222fcc69a0c2`

### catalog-serving-gate - Fail-closed production catalog serving boundary

- Domain: productSurface
- Status: local-scaffold
- Launch gate: B-CATALOG-SEED
- Owner: Engineering + catalog operator + database reviewer

Required evidence:

- The current 94-migration source chain through `0078` includes catalog migrations `0056` through `0063`, the historical `0064` quiz-provenance boundary, `0065` CAT-08 transition/default-ACL repair, `0066` clinical-content seal, `0067` checker-only temporary-table shape, `0068` adherence, `0069` Shelf/completion replay, `0070` draft consent staging, `0071` recommendation zero admission, `0072` commerce zero admission, `0073` catalog promoter closure, `0074` draft Ask hash correction, `0075` current Layerwell quiz provenance, `0076` consent statement-time correction, `0077` exact-session/API access fencing, and `0078` PUBLIC/catalog-operator execution fencing. Before promotion, curation authorization, clinical publication, recommendation-mode opening, commerce admission, or campaign release, prove two clean complete-chain resets, exact history and generated-type parity, all catalog/profile/CAT-07/CAT-08/clinical/lint/adherence/replay/consent/recommendation/commerce pgTAP contracts, and the same current revision on reviewed hosted staging. Historical `0072` proof does not establish this current or hosted gate.
- Barcode and search use service-role-only RPCs over the same positive source/product/correction/CAT-03 eligibility relation; `service_role` has no direct catalog-table read, while explicitly safe authenticated reads retain positive RLS.
- Only rows in the exact active global CAT-03 campaign with active campaign-scoped product authorization, reviewed `verified` or `usable` quality, recommendation eligibility, production/legal-approved sources, and zero independent product holds in `active` or `repair_attested` state can be served; untrusted open intake remains owner-scoped, and accepting, rejecting, closing, or deleting a report cannot release its hold.
- Barcode mappings are independently reviewed, direct authenticated reads cannot bypass source withdrawal, and every held/unknown reason returns the same no-match/manual fallback.

Sources:

- `supabase/migrations/20260717000056_catalog_serving_eligibility_gate.sql` - 34119 bytes - sha256 `0d4543effd4eb5c6d5e036b96d777b217bf853fb0c9587575429a28f14d7793c`
- `supabase/migrations/20260717000057_catalog_import_lifecycle.sql` - 144722 bytes - sha256 `926ba3a453bbe46e8ba97167049f5dda1fb22a59248dee1b9a216d4cc30b7ce7`
- `supabase/migrations/20260717000058_catalog_launch_curation.sql` - 295282 bytes - sha256 `f2d53caad23347103e29b0f5660eefdbdd22bfdc05cc2cb47445ece4192919a6`
- `supabase/migrations/20260718000059_catalog_scan_minimization.sql` - 33319 bytes - sha256 `46c3128d68dccb17b50e28363c478ec7de032a180faf3a5298b0620bfe6e81ec`
- `supabase/migrations/20260718000060_cat07_truthful_freshness.sql` - 24465 bytes - sha256 `8bc2c35bfff443a3c3bf7ab76e52ed17e7d6b961a8b35bdde17701de5c7f574a`
- `supabase/migrations/20260722000061_catalog_import_benzoyl_review_override.sql` - 28316 bytes - sha256 `4048342265ef103e6915411494911a98485528707c7413555725ba4ff427c1e9`
- `supabase/migrations/20260722000062_catalog_curation_statement_guard.sql` - 53193 bytes - sha256 `f7bba7300939fd1f95247c464c49cc01544684637ff25d66076f137475ef9ef1`
- `supabase/migrations/20260722000063_catalog_operator_authority.sql` - 165487 bytes - sha256 `9b2864f4f8943db3ea39d76c7558bcbd2e4ccb1728b30b12a4c186b03f4f0531`
- `supabase/migrations/20260726000064_skin_profile_quiz_provenance.sql` - 6094 bytes - sha256 `3f9c2eda73121486ea0f7ddbcc6e69389291d888222561801510320c94f2a090`
- `supabase/migrations/20260726000065_catalog_operator_transition_conflict_target.sql` - 4519 bytes - sha256 `9afd1ad223c9e7587d42118cee9dbc4fe0b0ea641de4f6fad44d8ecb20d79ccb`
- `supabase/migrations/20260726000066_legacy_clinical_content_immutability.sql` - 5653 bytes - sha256 `61ee02bd285ae59fe1905244335699bc630830e16910fda7eb4f19a21e637cd8`
- `supabase/migrations/20260726000067_catalog_release_temp_table_lint_contract.sql` - 7771 bytes - sha256 `2b9a4fc1412edc2373366bb3532710dcaec0439f5b96bb669aa22246cdfbe9b4`
- `supabase/migrations/20260726000068_routine_adherence_authority.sql` - 33471 bytes - sha256 `37bfd190919f62e63f4e2a61580c5cfe96dea30af72f80259b8d3e9a704f8885`
- `supabase/migrations/20260726000069_routine_completion_sync_bridge.sql` - 66673 bytes - sha256 `a15a8832786011ae3739af56d2c5156dd4102f1ca9c3acbceb0849fa961f665c`
- `supabase/migrations/20260726000070_health_consent_draft_successor_staging.sql` - 22231 bytes - sha256 `8599187818bc105309e1c0dd8affe084972838ba3238a67fe95586ec29e8e54c`
- `supabase/migrations/20260726000071_recommendation_zero_admission.sql` - 14874 bytes - sha256 `4e3e0c46a246b97e98f014bf65499ea86b7f57119744466aebc8c1491331acc9`
- `supabase/migrations/20260729000072_commerce_zero_admission.sql` - 6320 bytes - sha256 `a209915c6f3b860fdf06f2eacd46c8f10221078b042257fcdcb2b37578e45806`
- `supabase/migrations/20260921000073_catalog_search_promotion_boundary.sql` - 3449 bytes - sha256 `7459415ccdc44bec601bbbb3b94fcf362caa2c65d9fe300958b3686f2410c5ca`
- `supabase/migrations/20260921000074_ask_consent_rebrand_hash_alignment.sql` - 1397 bytes - sha256 `35ac2f04286827f477a093954cebca661bfa074e36c17348b9c7f4f250a277aa`
- `supabase/migrations/20260921000075_skin_profile_quiz_contract_successor.sql` - 4123 bytes - sha256 `e6557039c30bb8e3c16a93ebecce844b7b71289d1abe4ffe44ebc8cd4e0dbd4f`
- `supabase/migrations/20260921000076_health_consent_statement_time.sql` - 2776 bytes - sha256 `2133d691ae9ba11657694cf7713d8fbbcf099cce62e5becc3152fb62b37198e0`
- `supabase/migrations/20260926000077_consent_and_api_access_fences.sql` - 3787 bytes - sha256 `8a7e66036dcc771ed632e1a8c10469deec183393366e12f3f1cf21e81c0aa4c1`
- `supabase/migrations/20260926000078_catalog_operator_public_execute_fence.sql` - 1064 bytes - sha256 `86668e0a9349fc845175a798868fb8540a303fec462e0bb3007bc5237c2b736c`
- `supabase/tests/database/catalog_serving_gate.test.sql` - 36707 bytes - sha256 `1e9e54227161be38e27e2263aab27ec16aeb2ef4ead2316f0dc9daafd12879d9`
- `supabase/tests/database/catalog_import_lifecycle.test.sql` - 109814 bytes - sha256 `d543af34e2559d938a12ba4741181f170e3c04fa678c93c411f911118ef2a899`
- `supabase/tests/database/catalog_launch_curation.test.sql` - 202710 bytes - sha256 `7272a899ade80123b990747c1f9402930ba8b07e7b71fbfe4c13b45a11d38b19`
- `supabase/tests/database/cat07_truthful_freshness.test.sql` - 36173 bytes - sha256 `ba698f5c9551e47577891264ed80da6ae34c9d788631f134490ac107ffc6a7ba`
- `supabase/tests/database/catalog_operator_authority.test.sql` - 76546 bytes - sha256 `5a1f34ae94cf87751dc2a0244d769bf6ce1660082c96f7a6082587514b7bc03a`
- `supabase/tests/database/skin_profile_quiz_provenance.test.sql` - 21314 bytes - sha256 `fd00f39e231fcb667b048a30618563182e97199e93d3f9ecfccdfa46ac8489a0`
- `supabase/tests/database/clinical_content_legacy_seal.test.sql` - 10085 bytes - sha256 `4fa05a5da0b083d99484a88b4600a02cd830eb6874f440f2faadaa3cf23e0a16`
- `supabase/tests/database/catalog_release_temp_table_lint_contract.test.sql` - 3333 bytes - sha256 `e4045cf7c1e548432876795532cabd086bfde9eb6492ff7f0ae6ce1db2d4a76b`
- `supabase/tests/database/routine_adherence_authority.test.sql` - 38276 bytes - sha256 `8ab6c7bf347c6a45393fac206e62dec2b52fcb38fea7b88e5d9385c363c8b213`
- `supabase/tests/database/routine_completion_sync_bridge.test.sql` - 50474 bytes - sha256 `1a3bef93ee96ac214bc4a7f72b3601e966ec4a5def4d035097ba4cbf928da09e`
- `supabase/tests/database/health_consent_draft_successor_staging.test.sql` - 14110 bytes - sha256 `dc100ac73bb1840bc725004f23087dff7f16198a94d7da67f63f0284029439f7`
- `supabase/tests/database/recommendation_zero_admission.test.sql` - 17945 bytes - sha256 `abce9996b5c27aa4e05b38ed2cf6c603f6d975bda1bd37f5093fbdb197af9166`
- `supabase/tests/database/commerce_zero_admission.test.sql` - 13436 bytes - sha256 `f3b9ccdf13fe020b12adf650ab11c302681fb79a3398fad0d804ab6ac560f5f5`
- `supabase/tests/database/ask_consent_rebrand_hash_alignment.test.sql` - 3924 bytes - sha256 `c3537102eae34830d76cbacf4eada29e99228766ec029606928ed754c1303c0b`
- `supabase/tests/database/skin_profile_quiz_contract_successor.test.sql` - 6732 bytes - sha256 `f5f7811ba4b111e6c75e66ed68d1da47024b8e65f4d3f54ce9b3bff8b2460b8b`
- `supabase/tests/upgrade/routine_completion_sync_bridge_0069_upgrade.test.sql` - 8430 bytes - sha256 `6ad21d15844a4a9fe4924e864619598837a26ea9c20e953c1ed7222fcc69a0c2`
- `supabase/tests/upgrade/health_consent_draft_successor_0070_upgrade.test.sql` - 7087 bytes - sha256 `186f5dd60f99514d7febe6a803b51f5fc67b42609f69efbcea6624df0fbba207`
- `supabase/tests/upgrade/recommendation_zero_admission_0071_upgrade.test.sql` - 7912 bytes - sha256 `011e2ffc2994475df1ece65e1503dd363c4d42206a4509d46195a01d4f324c77`
- `supabase/tests/upgrade/commerce_zero_admission_0072_upgrade.test.sql` - 12122 bytes - sha256 `5f3126751b234f07bd623e94dd732211788367b4cc9020121c885f36847b3769`
- `supabase/tests/database/schema_contract.test.sql` - 36244 bytes - sha256 `85faffa59677a0ffe48eee27df3ef565880fadbec2f9478d888911061c1553a2`
- `scripts/phase9/catalog-operator-0065-upgrade-postgres-rehearsal.sql` - 5846 bytes - sha256 `b6a914dc1e9d04bbf27933d3e969211482fbbc41e04efd5648fff0b5d56683d6`
- `scripts/phase9/clinical-content-0066-upgrade-postgres-rehearsal.sql` - 6577 bytes - sha256 `d7bfbfb7fed85a600c07d6c779aad6bc1e349c53f7d5eae1fba62597178647e7`
- `scripts/phase9/catalog-release-0067-lint-contract-postgres-rehearsal.sql` - 3956 bytes - sha256 `859c79b291ff98ab81490780533d337fa98e7c4988167283567f4f13e142b18e`
- `scripts/phase9/skin-profile-0075-upgrade-postgres-rehearsal.sql` - 5847 bytes - sha256 `5745c04fd2e3ee49d73b7ecdee20594a5c881be27a256c25c73be9bc81459943`
- `scripts/phase9/recommendation-zero-admission-smoke.mjs` - 10268 bytes - sha256 `1762aae74a0efea601be2a053f51d4550fa8525f988152f18e8669690f2ee808`
- `supabase/functions/catalog-lookup/index.ts` - 11843 bytes - sha256 `23e76d1ba0fd1e199be94986fb0e066e7e4cc6b64d04c642bdd1fb849c97b220`
- `supabase/functions/catalog-lookup/catalogContract.ts` - 80 bytes - sha256 `9707c48c48465b279c2112d84a8a1459867c395490d3c184aaa4e6c2fbc7f81a`
- `supabase/functions/catalog-lookup/catalogContract.test.ts` - 14681 bytes - sha256 `96ab5dd088984ce67115b993e84436205ebb1bfabee25ea2d60558e7eea85f46`
- `supabase/functions/catalog-search/index.ts` - 10142 bytes - sha256 `b7187fee6fe8981d42219de31d1358d11db16bb8f40be530c4d2f838e5400494`
- `supabase/functions/catalog-search/catalogContract.ts` - 1343 bytes - sha256 `62cc1e0d2e62d37187922e4ed1766b12d8ca8aa48cdebf3e3271ea6ae7ce417e`
- `supabase/functions/catalog-search/catalogContract.test.ts` - 3041 bytes - sha256 `dd91fb0c009da68074d795d7819149d9bb970e47c2fba6bbdfc7a08f7f53922d`
- `docs/phase-4/catalog-source-release-runbook.md` - 14881 bytes - sha256 `6ebf9512392750cf6dbbb6f1d073f362c931480690ecc30aa6061ec8f79e8cb6`
- `docs/phase-4/catalog-curation-release-runbook.md` - 45531 bytes - sha256 `92a0b946a5e431e787f95d0513289ef1938a8964b23272d329f5cb15395d2be9`
- `docs/phase-2-production-infrastructure-runbook.md` - 19776 bytes - sha256 `497e39436bc9fa8ef8f609ce3c5a2d5b75a62a06eeab63aaec6740f9e8a6998e`

### first-party-correction-report - First-party missing-product and wrong-match operation

- Domain: operations
- Status: blocked
- Launch gate: B-SHELF-CONTRIB
- Owner: Support + catalog operator + privacy/security + engineering

Required evidence:

- Owner-scoped missing-product and wrong-match reports enter only the app's first-party correction workflow with active health-data authority and bounded, minimized fields.
- Deletion and consent-withdrawal paths cover report data. Untrusted open intake remains owner-scoped; operator triage creates an independent reporter-free product hold, and only unreleased holds in `active` or `repair_attested` state suppress global catalog serving and recommendation eligibility. Accepting, rejecting, closing, or deleting the report cannot release that hold.
- Named support/catalog owners operate the seven-day triage SLA and retain correction-runbook evidence.
- No report, shelf/profile field, or user lookup is sent to OBF, CosIng, or another source; the legacy contribution queue and flag remain inert.

Sources:

- `docs/phase-4/odbl-compliance-memo.md` - 5347 bytes - sha256 `fb3d57b6b93b22aa87dc34434cdbf6cafec134458d5704ea70bcb8cff03ce755`
- `docs/04-smart-shelf.md` - 66906 bytes - sha256 `a83cbda544e062d873a8f3905923e35fca2e72a0213c33b0d6f6d79d8d40ca02`
- `supabase/migrations/20260614000026_phase4_catalog.sql` - 35096 bytes - sha256 `c7f7dccd5fee51d855048dfcf8892fa1fceaed94dd7c4193fa2005327d4eef4d`
- `supabase/functions/catalog-report/index.ts` - 10890 bytes - sha256 `00c15af1cac9a9cda6514d5c441b4c0b2420959a24727d697f7dce9ab8c4acbd`
- `supabase/functions/catalog-report/privacy.ts` - 6403 bytes - sha256 `e81dfbdafe784f79503fc4ad03487040f6e2725fe63f5000df77d944c3e28eec`
- `supabase/functions/catalog-report/privacy.test.ts` - 10228 bytes - sha256 `31411acef464f8e0dda16605ee3f0af769163f67ea920ae5c1f6156ee4508f1d`
- `supabase/migrations/20260717000056_catalog_serving_eligibility_gate.sql` - 34119 bytes - sha256 `0d4543effd4eb5c6d5e036b96d777b217bf853fb0c9587575429a28f14d7793c`
- `supabase/migrations/20260722000063_catalog_operator_authority.sql` - 165487 bytes - sha256 `9b2864f4f8943db3ea39d76c7558bcbd2e4ccb1728b30b12a4c186b03f4f0531`
- `supabase/migrations/20260726000065_catalog_operator_transition_conflict_target.sql` - 4519 bytes - sha256 `9afd1ad223c9e7587d42118cee9dbc4fe0b0ea641de4f6fad44d8ecb20d79ccb`
- `supabase/tests/database/catalog_operator_authority.test.sql` - 76546 bytes - sha256 `5a1f34ae94cf87751dc2a0244d769bf6ce1660082c96f7a6082587514b7bc03a`
- `apps/mobile/src/features/catalog/client.ts` - 23824 bytes - sha256 `85b771f782010e99cd4061ed331557de73e68a16fb838d92f720f58d042f693e`
- `apps/mobile/src/features/catalog/client.test.ts` - 31695 bytes - sha256 `42dc1c9e4d29c565827535836cf635c37bc19399f663859695a1546df518d297`
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

- `docs/phase-4/observability-dashboard.md` - 5335 bytes - sha256 `ffc77c9c33712b2a7b81bf92103e9bc4e71237a60ed40cd96b3aaad7298f0949`
- `docs/phase-4/beta-coverage-report.md` - 8829 bytes - sha256 `ec85aa2775e5c9075bf3d72137cca06e955720aa80c3b807137ab6a7671f6c05`
- `docs/phase-10/support-operations.md` - 4878 bytes - sha256 `bed258fc581aa469539542cbad95184e5314adb4a3b3ac11983b677cd4a00c7e`
- `docs/phase-10/support-beta-report.md` - 2149 bytes - sha256 `f25c3841a8bc5649dbd1f38632c756898da46a5d7f4d59ff7c328726dc9d26ac`
- `scripts/phase4/beta-coverage-report.mjs` - 41079 bytes - sha256 `7bb1ba8b05f90f7fe3c80a23cc30dfc790d7999cb0e37db421cb71e3bdfec7a1`
- `supabase/functions/catalog-report/privacy.ts` - 6403 bytes - sha256 `e81dfbdafe784f79503fc4ad03487040f6e2725fe63f5000df77d944c3e28eec`
- `supabase/functions/catalog-report/privacy.test.ts` - 10228 bytes - sha256 `31411acef464f8e0dda16605ee3f0af769163f67ea920ae5c1f6156ee4508f1d`
- `docs/FOR_TAS_TO_DO.md` - 11239 bytes - sha256 `11b6df522e34a3b1a3ad8e130cf07345a8e91059efee6f4399d27360026c2825`

## Blockers

- None.

## Warnings

- None.
