# Phase 4 Catalog Source Worklist

Generated: 2026-07-26T13:06:48.733Z
Status: pass
Git SHA: 591e3fdefbc744788e2de8bc7c3a869098e92e34
Git status: DIRTY

This generated worklist is an operator handoff for the catalog/source launch
gate. It does not approve any catalog source, product batch, beta metric, or
recommendation use. It records the evidence Tas/counsel/reviewers/operators
must attach before Phase 4 can stop blocking launch.

## Summary

- Work items: 13
- Source files hashed: 323
- Missing source files: 0
- Blockers: 0
- Warnings: 1

## Items

| ID                                | Domain         | Area                                                                  | Status         | Launch gate             | Sources | Missing sources |
| --------------------------------- | -------------- | --------------------------------------------------------------------- | -------------- | ----------------------- | ------- | --------------- |
| source-identity                   | sourceReview   | Final catalog release identity, trust, build, and attribution surface | blocked        | B-CATALOG-SOURCE-REVIEW | 14      | 0               |
| obf-odbl-posture                  | sourceReview   | Open Beauty Facts and ODbL launch posture                             | blocked        | B-ODBL-REVIEW           | 17      | 0               |
| cosing-reuse-taxonomy             | sourceReview   | CosIng reuse and ingredient-tag taxonomy                              | blocked        | B-CATALOG-SOURCE-REVIEW | 16      | 0               |
| curated-first-batch               | curation       | First curated launch product batch                                    | blocked        | B-CURATED-CATALOG       | 22      | 0               |
| import-qa                         | curation       | Import QA and generated catalog evidence                              | local-scaffold | B-CATALOG-SEED          | 13      | 0               |
| beta-coverage                     | betaEvidence   | Closed-beta catalog coverage and correction loop                      | blocked        | B-CATALOG-COVERAGE      | 19      | 0               |
| catalog-promotion-lifecycle       | curation       | Reviewed catalog staging, promotion, lineage, and rollback            | local-scaffold | B-CATALOG-SEED          | 26      | 0               |
| catalog-launch-curation-lifecycle | curation       | Signed launch curation, positive serving authority, and retirement    | local-scaffold | B-CURATED-CATALOG       | 27      | 0               |
| mobile-catalog-disclosure         | productSurface | Mobile catalog source, quality, and report-issue disclosure           | local-scaffold | B-CATALOG-SEED          | 77      | 0               |
| catalog-freshness-provenance      | productSurface | Catalog-backed Shelf freshness and provenance contract                | local-scaffold | B-CATALOG-SEED          | 38      | 0               |
| catalog-serving-gate              | productSurface | Fail-closed production catalog serving boundary                       | local-scaffold | B-CATALOG-SEED          | 33      | 0               |
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

- `.env.example` - 27858 bytes - sha256 `5514e31f85bd2f7155d8bbab2bdda9874cb6ecc92bc7bb2164c62bc6d6276a52`
- `scripts/phase4/check-source-env.mjs` - 2989 bytes - sha256 `ad8eaa253c3dd97fd6ea09a1cdbf11fb1aec96212a90a610e690a74981989a1a`
- `docs/phase-4/catalog-source-memo-open-beauty-facts.md` - 11052 bytes - sha256 `8c4cd97589830a1dac8d65aa2468857cdd252dd5be9dfbcb1a69ac4a1d89f143`
- `docs/phase-4/catalog-source-memo-cosing.md` - 6696 bytes - sha256 `4e8b2194655050f0df044e377ffb52d5b9a67e5bb96fc36618b9cf732b6baaa4`
- `docs/phase-4/README.md` - 9346 bytes - sha256 `6cd849d25d98c481da95662922e5a54d879c9cccf289d94cf9d6fe7eee2bc087`
- `docs/phase-4/catalog-source-policy.json` - 7249 bytes - sha256 `55c5ae5c64f52cd8a7d9e2ed94a6e878d9deeb42e8c6c16edc721e08bf8781a4`
- `docs/phase-4/catalog-source-trust-registry.json` - 235 bytes - sha256 `13a7f7ca9ac84b31351d1f343bd7e67117fec9b46fa66d60f6c3bdd98e70e824`
- `docs/phase-4/catalog-release-scope.json` - 341 bytes - sha256 `2d02ca4376b1e92ce37901ac67fd0b6dcb05c3a3f8525c881a6925bc68ffb0df`
- `docs/phase-4/catalog-release-build-evidence.json` - 481 bytes - sha256 `c0b7b51ad2e3e2fd864d25d2ae46b451d6cae1a1e1768d983c168c192dab4254`
- `docs/phase-4/catalog-source-release-runbook.md` - 14878 bytes - sha256 `ad1c21bb30222a35dd6d618352a329e02d514eb5cd2cb75ab1a8d3708e52e620`
- `scripts/phase4/catalog-source-policy-audit.mjs` - 8633 bytes - sha256 `f477b1bcaa8b6b7997cded65b63c21e7dbfc23a3c75d169720961f5eb3b6879c`
- `scripts/phase4/source-policy.mjs` - 89435 bytes - sha256 `75242c44fe3ff9e46472647fbcfb9d59070a1306fb4638ae106117a30c9cc634`
- `docs/phase-4/phase-4-exit-review.md` - 13711 bytes - sha256 `c52fa21ea2ecf9861c186bef88bd088598f5eb267920b4b2a1d78712c9ab6494`
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

- `docs/phase-4/catalog-source-memo-open-beauty-facts.md` - 11052 bytes - sha256 `8c4cd97589830a1dac8d65aa2468857cdd252dd5be9dfbcb1a69ac4a1d89f143`
- `docs/phase-4/odbl-compliance-memo.md` - 5338 bytes - sha256 `cf202bd20819b0a8f5b84cc81e7bb2f2470d45ae257a800d4e72f7e88e5bda7d`
- `docs/phase-4/catalog-source-policy.json` - 7249 bytes - sha256 `55c5ae5c64f52cd8a7d9e2ed94a6e878d9deeb42e8c6c16edc721e08bf8781a4`
- `docs/phase-4/obf-source-approval.template.json` - 8479 bytes - sha256 `9ffa7441d5d9efbf3662aef4509cf9c5cf21b66e296ce07838acaf9fe25ede15`
- `docs/phase-4/catalog-source-trust-registry.json` - 235 bytes - sha256 `13a7f7ca9ac84b31351d1f343bd7e67117fec9b46fa66d60f6c3bdd98e70e824`
- `docs/phase-4/catalog-release-scope.json` - 341 bytes - sha256 `2d02ca4376b1e92ce37901ac67fd0b6dcb05c3a3f8525c881a6925bc68ffb0df`
- `docs/phase-4/catalog-release-build-evidence.json` - 481 bytes - sha256 `c0b7b51ad2e3e2fd864d25d2ae46b451d6cae1a1e1768d983c168c192dab4254`
- `docs/phase-4/catalog-source-release-runbook.md` - 14878 bytes - sha256 `ad1c21bb30222a35dd6d618352a329e02d514eb5cd2cb75ab1a8d3708e52e620`
- `scripts/phase4/import-obf-snapshot.mjs` - 13213 bytes - sha256 `f9ed4016fb912e0d406e18d85654d3995ba3a6395a64de4516c50018e2d3f64d`
- `scripts/phase4/source-policy.mjs` - 89435 bytes - sha256 `75242c44fe3ff9e46472647fbcfb9d59070a1306fb4638ae106117a30c9cc634`
- `scripts/phase4/source-policy.test.mjs` - 39752 bytes - sha256 `c8ff4534e7f7870930f1ee77e5aa7185f8cafea30e5aa87f5a50646383e4244f`
- `scripts/phase4/catalog-qa-report.mjs` - 27119 bytes - sha256 `c01d9bc01c8db0951d8113cf74e53bea1e67e4d9145406e85098cfbdd032bf09`
- `supabase/migrations/20260614000026_phase4_catalog.sql` - 35102 bytes - sha256 `dc1a7f150bd5b285cf2d05f2583126ebeb97e67b5363666e670518896b93c311`
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

- `docs/phase-4/catalog-source-memo-cosing.md` - 6696 bytes - sha256 `4e8b2194655050f0df044e377ffb52d5b9a67e5bb96fc36618b9cf732b6baaa4`
- `docs/phase-4/ingredient-tag-taxonomy.md` - 3276 bytes - sha256 `8b2af877c4cbdd0f6a7f4f965ded0ece300710e7bb2adbe97c97d5aaef26b83f`
- `docs/phase-4/catalog-source-policy.json` - 7249 bytes - sha256 `55c5ae5c64f52cd8a7d9e2ed94a6e878d9deeb42e8c6c16edc721e08bf8781a4`
- `docs/phase-4/cosing-source-approval.template.json` - 8088 bytes - sha256 `05ccfb90c2f7a3eed49571b1fc7d4b87fde28186d644d6cb53671456b7ba5fd3`
- `docs/phase-4/catalog-source-trust-registry.json` - 235 bytes - sha256 `13a7f7ca9ac84b31351d1f343bd7e67117fec9b46fa66d60f6c3bdd98e70e824`
- `docs/phase-4/catalog-release-scope.json` - 341 bytes - sha256 `2d02ca4376b1e92ce37901ac67fd0b6dcb05c3a3f8525c881a6925bc68ffb0df`
- `docs/phase-4/catalog-release-build-evidence.json` - 481 bytes - sha256 `c0b7b51ad2e3e2fd864d25d2ae46b451d6cae1a1e1768d983c168c192dab4254`
- `docs/phase-4/catalog-source-release-runbook.md` - 14878 bytes - sha256 `ad1c21bb30222a35dd6d618352a329e02d514eb5cd2cb75ab1a8d3708e52e620`
- `scripts/phase4/import-cosing-dictionary.mjs` - 13351 bytes - sha256 `470016b20d8e5ecb4be94fb83d891c051cb10f42d702d60cde284466579da47a`
- `scripts/phase4/source-policy.mjs` - 89435 bytes - sha256 `75242c44fe3ff9e46472647fbcfb9d59070a1306fb4638ae106117a30c9cc634`
- `scripts/phase4/source-policy.test.mjs` - 39752 bytes - sha256 `c8ff4534e7f7870930f1ee77e5aa7185f8cafea30e5aa87f5a50646383e4244f`
- `apps/mobile/src/features/catalog/ingredientParser.ts` - 7815 bytes - sha256 `18da13e8858587faac9137a4ea93b0c24676cbdd215624e8ae30653f9e1173e8`
- `apps/mobile/src/features/catalog/ingredientParser.test.ts` - 3602 bytes - sha256 `a38abeedcf0b3a02e36b32ff6d3fa699d27c19dd5ffc2d3286f05e3278ec2afc`
- `apps/mobile/src/features/intelligence/tags.ts` - 5155 bytes - sha256 `45bad7e06d4afed653aa6d24da8fc991a3971ea0e219155e19c630a083477af4`
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
- `docs/phase-4/catalog-curation-release-runbook.md` - 45229 bytes - sha256 `e273a6080b0dcc8609cacd8eeff850056cec0069406c646b9ff87f17578a2414`
- `docs/phase-4/catalog-coverage-quality-targets.template.json` - 9408 bytes - sha256 `e53c6c5d2715392dab63930046836e1c7b832a007419508a778dd085c54846c1`
- `docs/phase-4/beta-shelf-corpus.template.json` - 24386 bytes - sha256 `55a44a32ecd47ed53a7a7ba1b8a1694ea936a69768668e9a739f0218d98420a5`
- `docs/phase-4/catalog-curation-review.template.json` - 22649 bytes - sha256 `4dcf0f76ece3ceee0328e0a97dff39a460d270474074b8abe1d5b9f568fb46f9`
- `docs/phase-4/catalog-cat02-membership-proof.template.json` - 9254 bytes - sha256 `e4d9ec3cfc09aca71972eb141577492e7bf17cab3a0a78ebd393cdc3fe152c56`
- `docs/phase-4/catalog-curation-database-readback.template.json` - 8239 bytes - sha256 `9930f9302215af9d73d4bde4b8992f89d9b83af9b1132fe122afd3f268833c0a`
- `docs/phase-3/consent-matrix.md` - 16199 bytes - sha256 `72dea59e32637652495e66be3d882714f4fef1ff43fa4f795fbc28b42c9edb9a`
- `docs/phase-3/data-inventory.md` - 55523 bytes - sha256 `3db72b178c48f2011f4606c9bb7fbe7ee63477adb07063dfba900ca69848eab8`
- `docs/store-privacy-inventory.md` - 45140 bytes - sha256 `248805cba7f7006b8f05759cf99264422097103de4aa13149d0da015506683eb`
- `docs/phase-4/catalog-source-release-runbook.md` - 14878 bytes - sha256 `ad1c21bb30222a35dd6d618352a329e02d514eb5cd2cb75ab1a8d3708e52e620`
- `scripts/phase4/catalog-curation-contract.mjs` - 229798 bytes - sha256 `22acca7d8bbb543c77bb8ececef160185f4bad2ab17de0c41f717b03d5552627`
- `scripts/phase4/catalog-curation-contract.test.mjs` - 114891 bytes - sha256 `a7d2e97697d96f619bc47b0a1ac3a843834dd018bb9262df0a052e8c1cad1eb4`
- `scripts/phase4/build-catalog-curation-envelope.mjs` - 4096 bytes - sha256 `d31aa8d2bea0d2640ac4b343bf91261446aafc3155a9e7ce74e4f9406c760bd5`
- `scripts/phase4/catalog-coverage-quality-report.mjs` - 5480 bytes - sha256 `f5fc81ea9f2d31fcec3185fed837634506c89197f7f51777f0c174fa1ab17216`
- `scripts/phase4/catalog-coverage-quality-report.test.mjs` - 6586 bytes - sha256 `616881a177d87b435f75ec39dfbe01eb2bc8dd4d91ff25b50da6c6a776dbb204`
- `scripts/phase4/import-obf-snapshot.mjs` - 13213 bytes - sha256 `f9ed4016fb912e0d406e18d85654d3995ba3a6395a64de4516c50018e2d3f64d`
- `scripts/phase4/import-cosing-dictionary.mjs` - 13351 bytes - sha256 `470016b20d8e5ecb4be94fb83d891c051cb10f42d702d60cde284466579da47a`
- `supabase/migrations/20260717000058_catalog_launch_curation.sql` - 295282 bytes - sha256 `f2d53caad23347103e29b0f5660eefdbdd22bfdc05cc2cb47445ece4192919a6`
- `supabase/migrations/20260722000062_catalog_curation_statement_guard.sql` - 53193 bytes - sha256 `f7bba7300939fd1f95247c464c49cc01544684637ff25d66076f137475ef9ef1`
- `supabase/tests/database/catalog_launch_curation.test.sql` - 201879 bytes - sha256 `36f2bfe54bc24795350576db03ad4a5caf0911de729a093c4dd813da9b0b1509`

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
- `scripts/phase4/source-policy.test.mjs` - 39752 bytes - sha256 `c8ff4534e7f7870930f1ee77e5aa7185f8cafea30e5aa87f5a50646383e4244f`
- `docs/phase-4/catalog-source-policy.json` - 7249 bytes - sha256 `55c5ae5c64f52cd8a7d9e2ed94a6e878d9deeb42e8c6c16edc721e08bf8781a4`
- `docs/phase-4/catalog-source-trust-registry.json` - 235 bytes - sha256 `13a7f7ca9ac84b31351d1f343bd7e67117fec9b46fa66d60f6c3bdd98e70e824`
- `docs/phase-4/catalog-release-scope.json` - 341 bytes - sha256 `2d02ca4376b1e92ce37901ac67fd0b6dcb05c3a3f8525c881a6925bc68ffb0df`
- `docs/phase-4/catalog-release-build-evidence.json` - 481 bytes - sha256 `c0b7b51ad2e3e2fd864d25d2ae46b451d6cae1a1e1768d983c168c192dab4254`
- `docs/phase-4/catalog-source-release-runbook.md` - 14878 bytes - sha256 `ad1c21bb30222a35dd6d618352a329e02d514eb5cd2cb75ab1a8d3708e52e620`
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
- `docs/phase-4/beta-shelf-corpus.template.json` - 24386 bytes - sha256 `55a44a32ecd47ed53a7a7ba1b8a1694ea936a69768668e9a739f0218d98420a5`
- `docs/phase-4/catalog-coverage-quality-targets.template.json` - 9408 bytes - sha256 `e53c6c5d2715392dab63930046836e1c7b832a007419508a778dd085c54846c1`
- `docs/phase-4/catalog-curation-release-runbook.md` - 45229 bytes - sha256 `e273a6080b0dcc8609cacd8eeff850056cec0069406c646b9ff87f17578a2414`
- `docs/phase-4/catalog-cat02-membership-proof.template.json` - 9254 bytes - sha256 `e4d9ec3cfc09aca71972eb141577492e7bf17cab3a0a78ebd393cdc3fe152c56`
- `docs/phase-4/catalog-curation-database-readback.template.json` - 8239 bytes - sha256 `9930f9302215af9d73d4bde4b8992f89d9b83af9b1132fe122afd3f268833c0a`
- `docs/phase-3/consent-matrix.md` - 16199 bytes - sha256 `72dea59e32637652495e66be3d882714f4fef1ff43fa4f795fbc28b42c9edb9a`
- `docs/phase-3/data-inventory.md` - 55523 bytes - sha256 `3db72b178c48f2011f4606c9bb7fbe7ee63477adb07063dfba900ca69848eab8`
- `docs/store-privacy-inventory.md` - 45140 bytes - sha256 `248805cba7f7006b8f05759cf99264422097103de4aa13149d0da015506683eb`
- `scripts/phase4/beta-coverage-report.mjs` - 41079 bytes - sha256 `7bb1ba8b05f90f7fe3c80a23cc30dfc790d7999cb0e37db421cb71e3bdfec7a1`
- `scripts/phase4/beta-coverage-report-smoke.mjs` - 11145 bytes - sha256 `5296dda1c926ddbb7021a91251db2405f9748534d63f76d488e7b71ebd16120c`
- `scripts/phase4/catalog-curation-contract.mjs` - 229798 bytes - sha256 `22acca7d8bbb543c77bb8ececef160185f4bad2ab17de0c41f717b03d5552627`
- `scripts/phase4/catalog-curation-contract.test.mjs` - 114891 bytes - sha256 `a7d2e97697d96f619bc47b0a1ac3a843834dd018bb9262df0a052e8c1cad1eb4`
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
- Migration `0057` plus forward migrations `0061` and `0062` stage the signed v2 category vocabulary through sealed service RPCs and retain bounded statement-level curation integrity. Migration `0063` gives CAT-08 operators immutable recommendation authority only, and `0065` repairs both operator-transition conflict targets plus the global function default ACL while preserving the exact gateway grants. Migration `0066` additionally seals the unreviewed legacy clinical-content fixtures against every API-role table privilege and migration-owner mutation. Migration `0067` gives `plpgsql_check` a checker-only ephemeral table shape for the known runtime-temporary-table release wrapper, so every other wrapper statement remains linted with no extension dependency or runtime/security change; approval, promotion, rollback, CAT-03 activation, and any future reviewed clinical publication intentionally require separate authority.
- Every promoted projection traces through its immutable staged record and batch to source artifact, transform, approval, QA, and reviewer hashes.
- A reviewed hosted two-session drill proves atomic promotion, full retry on serialization failure, source-withdrawal containment, exact verification, and non-destructive rollback with shelf/correction references preserved.

Sources:

- `scripts/phase4/catalog-promotion-contract.mjs` - 126854 bytes - sha256 `9612f6f16ce5b7c38bc8d1dcd6c5997bbb72d959033e807561111eac18980038`
- `scripts/phase4/catalog-promotion-contract.test.mjs` - 70744 bytes - sha256 `f787bc201d8aed73728ca2200d81fbc293e65263306457f611f403f508fe66a4`
- `scripts/phase4/build-catalog-stage-envelope.mjs` - 619 bytes - sha256 `cc36fcee8961ab7239ccc606342253acf9cf7c1d2c5daf6910b56da93eefb2f6`
- `scripts/phase4/complete-catalog-database-receipts.mjs` - 705 bytes - sha256 `f73f48b6ee641e7ae05bfeb0de2e4b2ced73492f838bbc94470a03f2f3db41df`
- `supabase/migrations/20260717000057_catalog_import_lifecycle.sql` - 144722 bytes - sha256 `926ba3a453bbe46e8ba97167049f5dda1fb22a59248dee1b9a216d4cc30b7ce7`
- `supabase/migrations/20260718000059_catalog_scan_minimization.sql` - 33321 bytes - sha256 `27e60d3a763d80c4db641cc469361e7593f36f4fb4b49663f400879874207c6e`
- `supabase/migrations/20260718000060_cat07_truthful_freshness.sql` - 24465 bytes - sha256 `8bc2c35bfff443a3c3bf7ab76e52ed17e7d6b961a8b35bdde17701de5c7f574a`
- `supabase/migrations/20260722000061_catalog_import_benzoyl_review_override.sql` - 28316 bytes - sha256 `4048342265ef103e6915411494911a98485528707c7413555725ba4ff427c1e9`
- `supabase/migrations/20260722000062_catalog_curation_statement_guard.sql` - 53193 bytes - sha256 `f7bba7300939fd1f95247c464c49cc01544684637ff25d66076f137475ef9ef1`
- `supabase/migrations/20260722000063_catalog_operator_authority.sql` - 165489 bytes - sha256 `dd9f1537dd7bc68810d9e1322055a6c36a1fef6e873e90577687f133094dcdb2`
- `supabase/migrations/20260726000065_catalog_operator_transition_conflict_target.sql` - 4519 bytes - sha256 `9afd1ad223c9e7587d42118cee9dbc4fe0b0ea641de4f6fad44d8ecb20d79ccb`
- `supabase/migrations/20260726000066_legacy_clinical_content_immutability.sql` - 5653 bytes - sha256 `61ee02bd285ae59fe1905244335699bc630830e16910fda7eb4f19a21e637cd8`
- `supabase/migrations/20260726000067_catalog_release_temp_table_lint_contract.sql` - 7771 bytes - sha256 `2b9a4fc1412edc2373366bb3532710dcaec0439f5b96bb669aa22246cdfbe9b4`
- `supabase/tests/database/catalog_operator_authority.test.sql` - 73519 bytes - sha256 `9c465a6b8c15dabf799913b2ae30f03b62ca61514cdcafbb372af39c78c652d7`
- `supabase/tests/database/clinical_content_legacy_seal.test.sql` - 10088 bytes - sha256 `02df3c9e33e487c314f390ce18070b15c38a0cca46c113ae7b3e03fb905a21db`
- `supabase/tests/database/catalog_release_temp_table_lint_contract.test.sql` - 3300 bytes - sha256 `d8accade3b03f31827bffcf9ddf82e407b3766cb645908be2ad6a31b9c03558d`
- `scripts/phase9/catalog-import-0061-upgrade-postgres-rehearsal.sql` - 28021 bytes - sha256 `b1d3464bc9b20a6bc432082b8b01832b980ea231338427fa1e187c238dcd7919`
- `scripts/phase9/catalog-curation-0062-upgrade-postgres-rehearsal.sql` - 22993 bytes - sha256 `64102fcd36e69ff58ab957c94866e215f2f72900758bc98926a46057230e45e9`
- `scripts/phase9/catalog-operator-0065-upgrade-postgres-rehearsal.sql` - 5846 bytes - sha256 `b6a914dc1e9d04bbf27933d3e969211482fbbc41e04efd5648fff0b5d56683d6`
- `scripts/phase9/clinical-content-0066-upgrade-postgres-rehearsal.sql` - 6577 bytes - sha256 `d7bfbfb7fed85a600c07d6c779aad6bc1e349c53f7d5eae1fba62597178647e7`
- `scripts/phase9/catalog-release-0067-lint-contract-postgres-rehearsal.sql` - 3956 bytes - sha256 `859c79b291ff98ab81490780533d337fa98e7c4988167283567f4f13e142b18e`
- `supabase/tests/database/catalog_import_lifecycle.test.sql` - 109210 bytes - sha256 `df492491e2243ea15ade299d6f173cd8f3e7662fd53224a0718e22f7c2da965d`
- `supabase/tests/database/catalog_serving_gate.test.sql` - 36567 bytes - sha256 `122a856982e0401fbc9dfd6587d0c650a27d15c31273439020cd4d666ee34bef`
- `supabase/tests/database/cat07_truthful_freshness.test.sql` - 35199 bytes - sha256 `3cc0ff929a7f7fea3f409cb2a3baa40befb083e7fccade68df05dc9c3b238253`
- `docs/phase-4/catalog-import-promotion-runbook.md` - 21320 bytes - sha256 `da3b3a6c98890ad85834c6304edcd71e2192725017c13391304c732e244d9feb`
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
- `package.json` - 41151 bytes - sha256 `5b913ce21150cbd017edb3d39851c3aac1f396f93709c026a3f100fdd37684f8`
- `.github/workflows/quality.yml` - 11249 bytes - sha256 `034f7a679b42fdc8ef7382a48ae1b440ae3354704e22a26a90ec872dfc7a44fb`
- `docs/phase-4/catalog-curation-release-runbook.md` - 45229 bytes - sha256 `e273a6080b0dcc8609cacd8eeff850056cec0069406c646b9ff87f17578a2414`
- `docs/phase-4/catalog-coverage-quality-targets.template.json` - 9408 bytes - sha256 `e53c6c5d2715392dab63930046836e1c7b832a007419508a778dd085c54846c1`
- `docs/phase-4/beta-shelf-corpus.template.json` - 24386 bytes - sha256 `55a44a32ecd47ed53a7a7ba1b8a1694ea936a69768668e9a739f0218d98420a5`
- `docs/phase-4/catalog-curation-review.template.json` - 22649 bytes - sha256 `4dcf0f76ece3ceee0328e0a97dff39a460d270474074b8abe1d5b9f568fb46f9`
- `docs/phase-4/catalog-cat02-membership-proof.template.json` - 9254 bytes - sha256 `e4d9ec3cfc09aca71972eb141577492e7bf17cab3a0a78ebd393cdc3fe152c56`
- `docs/phase-4/catalog-curation-database-readback.template.json` - 8239 bytes - sha256 `9930f9302215af9d73d4bde4b8992f89d9b83af9b1132fe122afd3f268833c0a`
- `docs/phase-3/consent-matrix.md` - 16199 bytes - sha256 `72dea59e32637652495e66be3d882714f4fef1ff43fa4f795fbc28b42c9edb9a`
- `docs/phase-3/data-inventory.md` - 55523 bytes - sha256 `3db72b178c48f2011f4606c9bb7fbe7ee63477adb07063dfba900ca69848eab8`
- `docs/store-privacy-inventory.md` - 45140 bytes - sha256 `248805cba7f7006b8f05759cf99264422097103de4aa13149d0da015506683eb`
- `scripts/phase4/catalog-curation-contract.mjs` - 229798 bytes - sha256 `22acca7d8bbb543c77bb8ececef160185f4bad2ab17de0c41f717b03d5552627`
- `scripts/phase4/catalog-curation-contract.test.mjs` - 114891 bytes - sha256 `a7d2e97697d96f619bc47b0a1ac3a843834dd018bb9262df0a052e8c1cad1eb4`
- `scripts/phase4/build-catalog-curation-envelope.mjs` - 4096 bytes - sha256 `d31aa8d2bea0d2640ac4b343bf91261446aafc3155a9e7ce74e4f9406c760bd5`
- `scripts/phase4/catalog-coverage-quality-report.mjs` - 5480 bytes - sha256 `f5fc81ea9f2d31fcec3185fed837634506c89197f7f51777f0c174fa1ab17216`
- `scripts/phase4/catalog-coverage-quality-report.test.mjs` - 6586 bytes - sha256 `616881a177d87b435f75ec39dfbe01eb2bc8dd4d91ff25b50da6c6a776dbb204`
- `supabase/migrations/20260717000058_catalog_launch_curation.sql` - 295282 bytes - sha256 `f2d53caad23347103e29b0f5660eefdbdd22bfdc05cc2cb47445ece4192919a6`
- `supabase/tests/database/catalog_launch_curation.test.sql` - 201879 bytes - sha256 `36f2bfe54bc24795350576db03ad4a5caf0911de729a093c4dd813da9b0b1509`
- `supabase/migrations/20260717000057_catalog_import_lifecycle.sql` - 144722 bytes - sha256 `926ba3a453bbe46e8ba97167049f5dda1fb22a59248dee1b9a216d4cc30b7ce7`
- `supabase/migrations/20260718000059_catalog_scan_minimization.sql` - 33321 bytes - sha256 `27e60d3a763d80c4db641cc469361e7593f36f4fb4b49663f400879874207c6e`
- `supabase/migrations/20260718000060_cat07_truthful_freshness.sql` - 24465 bytes - sha256 `8bc2c35bfff443a3c3bf7ab76e52ed17e7d6b961a8b35bdde17701de5c7f574a`
- `supabase/migrations/20260722000061_catalog_import_benzoyl_review_override.sql` - 28316 bytes - sha256 `4048342265ef103e6915411494911a98485528707c7413555725ba4ff427c1e9`
- `supabase/migrations/20260722000062_catalog_curation_statement_guard.sql` - 53193 bytes - sha256 `f7bba7300939fd1f95247c464c49cc01544684637ff25d66076f137475ef9ef1`
- `supabase/tests/database/catalog_import_lifecycle.test.sql` - 109210 bytes - sha256 `df492491e2243ea15ade299d6f173cd8f3e7662fd53224a0718e22f7c2da965d`
- `supabase/tests/database/catalog_serving_gate.test.sql` - 36567 bytes - sha256 `122a856982e0401fbc9dfd6587d0c650a27d15c31273439020cd4d666ee34bef`
- `supabase/tests/database/cat07_truthful_freshness.test.sql` - 35199 bytes - sha256 `3cc0ff929a7f7fea3f409cb2a3baa40befb083e7fccade68df05dc9c3b238253`

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
- `apps/mobile/src/features/catalog/client.ts` - 23827 bytes - sha256 `a134e2bb32ea3fde57ef7dbcbe987ef15a5010a440ec38700731a2ea339e9a0e`
- `apps/mobile/src/features/catalog/copy.ts` - 1913 bytes - sha256 `b182cec74cb72f850e83dcca14a5548c6277d73a9eaac229f6062e665090f958`
- `apps/mobile/src/features/catalog/ingredientParser.test.ts` - 3602 bytes - sha256 `a38abeedcf0b3a02e36b32ff6d3fa699d27c19dd5ffc2d3286f05e3278ec2afc`
- `apps/mobile/src/features/catalog/ingredientParser.ts` - 7815 bytes - sha256 `18da13e8858587faac9137a4ea93b0c24676cbdd215624e8ae30653f9e1173e8`
- `apps/mobile/src/features/catalog/normalization.test.ts` - 2110 bytes - sha256 `1f31a87618439a232cb1d96c17ac460a5b0d7fe7a6588f6ba61283f79ff875c8`
- `apps/mobile/src/features/catalog/normalization.ts` - 2647 bytes - sha256 `16317a4fcfc871414a1b902e8323f24eceb9982c9b40959d49225827c5aeb9ff`
- `apps/mobile/src/features/catalog/obf.test.ts` - 1862 bytes - sha256 `730dbc1d7f7d7610b0a4d73ca45efadb375768af806c634763c000fb81206e2f`
- `apps/mobile/src/features/catalog/obf.ts` - 4536 bytes - sha256 `fd176cfb945b3543b342acadc6f40c333d6c6b484023884998a6f448ebadd2b6`
- `apps/mobile/src/features/catalog/quality.test.ts` - 2258 bytes - sha256 `b5187f33001f741cdb8636ad61343f072502b60ffe2fba70b5e831fce570e599`
- `apps/mobile/src/features/catalog/quality.ts` - 4663 bytes - sha256 `7156ff221071cf6ab90c3558c20d084c53e1f48d0025843ebea5275929103e53`
- `apps/mobile/src/features/catalog/recoveryReport.test.ts` - 1873 bytes - sha256 `b7e4593f9b49f40152266ff5f1ef68d45fc3d651fbaba7bc50bc10858c1a8e94`
- `apps/mobile/src/features/catalog/recoveryReport.ts` - 1449 bytes - sha256 `a1968787279dc1232a27426cf70724a5c8f0d7d65c3669fb462f7b0a25485912`
- `apps/mobile/src/features/catalog/reportOperation.test.ts` - 2745 bytes - sha256 `f306511b72663dfa01c24897a58ccdc6bdaba2081a28a64222e16e9f851c5752`
- `apps/mobile/src/features/catalog/reportOperation.ts` - 2796 bytes - sha256 `680cae013c853f82df16c3eec1c72c2623a752d1583204c1b7ecd917c83dfa37`
- `apps/mobile/src/features/catalog/reportPresentation.test.ts` - 5906 bytes - sha256 `226c050f99dae3e465fbf49da3c6618549bab261dccecb64773a8b3efaaaf4ab`
- `apps/mobile/src/features/catalog/reportPresentation.ts` - 5781 bytes - sha256 `6fbe26f5bfb254a22272603da403455763a4ac23f1966e998cf891fe36b7e615`
- `apps/mobile/src/features/catalog/reportTransport.ts` - 6607 bytes - sha256 `ef8e02518936fb1fd6bdbff03aebf4012d5fb84e2ef3467c948b727c420ff483`
- `apps/mobile/src/features/shelf/analytics.test.ts` - 543 bytes - sha256 `fce0e7cd2128b9c01644369a7dde86d178f44aaa80b0c7f9a58079ab08d4cc17`
- `apps/mobile/src/features/shelf/analytics.ts` - 599 bytes - sha256 `1e514f5fc1a96111a8b792dc8841ad41a11130dd6de7031eb08a353f85ef1050`
- `apps/mobile/src/features/shelf/catalogLookupRecovery.test.ts` - 8320 bytes - sha256 `5991b1ce3ea47e81841235c5845ca632ed3c719777365f6af9865ff10fe8bd50`
- `apps/mobile/src/features/shelf/catalogLookupRecovery.ts` - 7625 bytes - sha256 `aafbea137610e42b8d6df23c18f1e93731d78840a8017e3c577c02acf9ee0247`
- `apps/mobile/src/features/shelf/catalogRecoveryAsync.test.ts` - 13379 bytes - sha256 `130d79a4beebd7dc7ada42b78a90a9233b1b5bcdbad7d2f24cab7667e64f350a`
- `apps/mobile/src/features/shelf/categories.test.ts` - 1325 bytes - sha256 `a6f69552408d01ddfd0f5d44d0c296101f77eda35f0affcbbde580d3dd950a42`
- `apps/mobile/src/features/shelf/categories.ts` - 2390 bytes - sha256 `922060ab9c10baa353a89dc69f9d107cc1ff0b91fed280dc47b0c5eb485f5911`
- `apps/mobile/src/features/shelf/expiry.test.ts` - 2602 bytes - sha256 `dca407f4572147d1368e0f2b108e4a59ed2bb0f63e541bdeb0f1264bbb73d952`
- `apps/mobile/src/features/shelf/expiry.ts` - 2778 bytes - sha256 `43e97ea2d296532af742bd23643e9ca48ed0193d756ba5c163f421703a15508d`
- `apps/mobile/src/features/shelf/freshness.test.ts` - 8353 bytes - sha256 `a7ec4652c8a3cff995038511eec95f31e3d0045cf99d4597f78c58daee44364e`
- `apps/mobile/src/features/shelf/freshness.ts` - 7299 bytes - sha256 `be0997619e57b575d84169f1c47bbf00bbb61e811a393ce04eff586b5b14b77e`
- `apps/mobile/src/features/shelf/freshnessMigration.test.ts` - 4873 bytes - sha256 `fa08aa33695c6e2a00a7ff7901c5859077376eeb15e2cec8abf40058314257dc`
- `apps/mobile/src/features/shelf/IntakeContext.test.ts` - 2193 bytes - sha256 `9bc6f78dec650d85c5580cb691206733882b43f719f32faae937f140bbb2a859`
- `apps/mobile/src/features/shelf/IntakeContext.tsx` - 2707 bytes - sha256 `e0cd87f56b16cb77fcc474b06050235bc72c732108c82c0316d09bc72411b3a4`
- `apps/mobile/src/features/shelf/intakeSession.ts` - 2846 bytes - sha256 `1c6239702337c9a30cd10e0611ef0087014be56c6bc917c48a0245f553da0710`
- `apps/mobile/src/features/shelf/labels.test.ts` - 911 bytes - sha256 `2ba7c9f148da2c53095451e9a9dee151446950a4f60ec52ccc08a0f20d2a9c6f`
- `apps/mobile/src/features/shelf/labels.ts` - 978 bytes - sha256 `8106cbcfb4d79040f6547234f9afcc2627b9adaa0ce529789544085b5f6ed679`
- `apps/mobile/src/features/shelf/LocalDateField.tsx` - 1878 bytes - sha256 `e5cf3e8c0700e99944dcf1d515e511d4d78464277643599a6ba704daec7b9503`
- `apps/mobile/src/features/shelf/metadata.ts` - 1606 bytes - sha256 `e7da08df3d733c91f2464b7de96fdabbfa45c283fbf47659d1e2996821f16546`
- `apps/mobile/src/features/shelf/mutations.ts` - 8204 bytes - sha256 `f03148aaf4096689edeb7b1bee8eaf2d95eb44734a5d701b5f06af19b62a5916`
- `apps/mobile/src/features/shelf/pairedConflicts.ts` - 766 bytes - sha256 `eb4cc3b857828ae8d123890b0771a44fe57e73e29da3e6207604fd3ed640a918`
- `apps/mobile/src/features/shelf/paoProvenance.test.ts` - 1305 bytes - sha256 `036d37d4a9e008be0b89e5c63d9091704f439d23111ca377513a5f4a6bebc555`
- `apps/mobile/src/features/shelf/paoProvenance.ts` - 508 bytes - sha256 `dd71e9b3f563903e532cd76f5643ce04cc280f6cbe79cc7837ad2861fdacb7b3`
- `apps/mobile/src/features/shelf/scanLog.test.ts` - 4009 bytes - sha256 `5fbd9506ee53dc6908b7839a4c4f2bcecfaeb6b2f7748ba49fc7a125b9e773c2`
- `apps/mobile/src/features/shelf/scanLog.ts` - 1527 bytes - sha256 `4f27c7914c0147f85d4bc7f6a800e6bf013b808a17f3a5eea4dd574baf212f20`
- `apps/mobile/src/features/shelf/shelfRoutes.test.ts` - 69329 bytes - sha256 `92a87a442d7bb92878cb10612b5edd6d3e8badc310eedc539e6b1b4ac754ea79`
- `apps/mobile/src/features/shelf/store.test.ts` - 39839 bytes - sha256 `821345dd832c7479d0329ad0e85a5e438be0f77acbb4d219ed735aab7a862ba3`
- `apps/mobile/src/features/shelf/store.ts` - 31307 bytes - sha256 `5596f52b4eb96cfb43c349773677766e96557f315bb70e2092e711b27f7570b1`
- `apps/mobile/src/features/shelf/useShelf.test.ts` - 5075 bytes - sha256 `2aa0f2717f781bdf8836d451df432e577ab157fa5e0799f2ab674e87b163aea9`
- `apps/mobile/src/features/shelf/useShelf.ts` - 10185 bytes - sha256 `4835a4911aa8bc4b0bae235a85ed5cc681e67ac75d145917aadcbf0771f3f4a8`
- `apps/mobile/src/app/shelf/[id].tsx` - 45428 bytes - sha256 `1b2fddb06a6809c09987635c672c9a43026226805481c5438df09950c8d6cc3d`
- `apps/mobile/src/app/shelf/search.tsx` - 24405 bytes - sha256 `601e8b0ee413b1fa04048bcb52912b785897f912fdb4dc1e08743f7bce533fe0`
- `apps/mobile/src/app/shelf/manual.tsx` - 17400 bytes - sha256 `e9e38d15ff3caf085a6c57cf153934d7318aefdcc2fef4985a0dd2526bca2c51`
- `apps/mobile/src/features/recommendations/applyPreferences.test.ts` - 1319 bytes - sha256 `751559e6d23b979ffe0cd2924d42f30eb41b591f6427bf13d27c175cffdb75a3`
- `apps/mobile/src/features/recommendations/applyPreferences.ts` - 493 bytes - sha256 `50dabada0ac3066adf7bd455e93c95ee89b5838079a2f737ff7d36b57d02b0f3`
- `apps/mobile/src/features/recommendations/catalog.ts` - 9640 bytes - sha256 `113bb09a809c5cd381b8cfb5336542b887321bc7ba3b43373ff4d36342319062`
- `apps/mobile/src/features/recommendations/claimsafety.test.ts` - 9803 bytes - sha256 `1fe96a03fb2df36e660bd1ae860347f78e4d46ad0e8fd1b4e3b2339597237c63`
- `apps/mobile/src/features/recommendations/copy.ts` - 9698 bytes - sha256 `62c73660f6cdd5358999017746cec322fdf4de4d7c08d8fe1746cad550899e94`
- `apps/mobile/src/features/recommendations/engine.test.ts` - 28963 bytes - sha256 `f63077fd3b9a2e4afce418e07b34645111a1e9a43c541c820658c87b31dc2961`
- `apps/mobile/src/features/recommendations/engine.ts` - 22647 bytes - sha256 `8ad537eafe9d6353f5558d2dd777c2c55b88300bd2c2dcafd0a969e7f7eb0ed4`
- `apps/mobile/src/features/recommendations/fit.test.ts` - 4538 bytes - sha256 `d35d81e63490ba1e16fc586bb67890ac9215444f4db21d094deb83e7222be150`
- `apps/mobile/src/features/recommendations/fit.ts` - 5766 bytes - sha256 `ccb921626563a5cea9ec02a162c9f84289ada483edcf51dd755ab30b5658f18d`
- `apps/mobile/src/features/recommendations/loading.ts` - 251 bytes - sha256 `9c611cd49e793cc1161ecd665ee790bb056014b28a8d2f928a20bf59c0d7294d`
- `apps/mobile/src/features/recommendations/preferences.ts` - 647 bytes - sha256 `055882921e6e68b018b75aa075d93214119fa098add0c3e2665f96dadc77ebbf`
- `apps/mobile/src/features/recommendations/recommendationRoutes.test.ts` - 14651 bytes - sha256 `e09257f75e5dabd44ce73b475e00f9e31bb60c619f948ebe3c6b96ff6f0abeb2`
- `apps/mobile/src/features/recommendations/RecommendationsTeaser.test.ts` - 3590 bytes - sha256 `6f0d92c8fb2f1165be38c25b7bc2b6aa6ba582bfda66e86b7099e7ed78bb4340`
- `apps/mobile/src/features/recommendations/RecommendationsTeaser.tsx` - 8502 bytes - sha256 `8b113a60cd2090065e7c6ed982d061cbb8213ef17c1a6684c3a26596873598b3`
- `apps/mobile/src/features/recommendations/replenishment.test.ts` - 6345 bytes - sha256 `0809c65bdf7982d97624373387e58350342ec65cd5681a145968fa7deb864608`
- `apps/mobile/src/features/recommendations/replenishment.ts` - 3829 bytes - sha256 `ad0658a4a88071c1991c13c1d8d797d6250cdf5fa70fc33f2613cef380b4e610`
- `apps/mobile/src/features/recommendations/store.test.ts` - 7126 bytes - sha256 `3f51aba2e8b925752a0c74c30413190342d1462a09c19bbc7c0dcbc1f8dde1d8`
- `apps/mobile/src/features/recommendations/store.ts` - 7133 bytes - sha256 `b240f42ca33243d0db35eaed63c307d598be89aa485a1ba80a6e5bd7b5f98774`
- `apps/mobile/src/features/recommendations/useRecommendations.test.ts` - 1006 bytes - sha256 `9c1908c337df4cc3abd8a4fb12fcf12bca2d82b985b4043189a4347ab65fe44a`
- `apps/mobile/src/features/recommendations/useRecommendations.ts` - 3586 bytes - sha256 `df399196f973280670f1da3b3d5faf142c278e572ec6788c5e5430a48baf402f`
- `supabase/functions/catalog-report/index.ts` - 10890 bytes - sha256 `00c15af1cac9a9cda6514d5c441b4c0b2420959a24727d697f7dce9ab8c4acbd`
- `supabase/functions/catalog-report/privacy.ts` - 6403 bytes - sha256 `e81dfbdafe784f79503fc4ad03487040f6e2725fe63f5000df77d944c3e28eec`
- `supabase/functions/catalog-report/privacy.test.ts` - 10228 bytes - sha256 `31411acef464f8e0dda16605ee3f0af769163f67ea920ae5c1f6156ee4508f1d`

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

- `docs/04-smart-shelf.md` - 62801 bytes - sha256 `c3abb13a3d3235e666d0de99aa4f8c1a47b0a8efe18ec2a473b3a5aa718ce855`
- `docs/USER_FLOW_TREE.md` - 444559 bytes - sha256 `e46c024d4e02036c46e53130a1b08e54ca34e1cb00f8a6df3c0de80050e89d8a`
- `apps/mobile/src/app/onboarding/products.tsx` - 15344 bytes - sha256 `0a6ae408b5eede2db6b93952e54da250e81b71e08fc69d4f8be1f54625f8a9ab`
- `apps/mobile/src/app/shelf/[id].tsx` - 45428 bytes - sha256 `1b2fddb06a6809c09987635c672c9a43026226805481c5438df09950c8d6cc3d`
- `apps/mobile/src/app/shelf/opened.tsx` - 18279 bytes - sha256 `f6def4491f22caae90590351f50f424c38397a8d6c8b6d2c3f77d7d8c0346f6d`
- `apps/mobile/src/app/shelf/replenish.tsx` - 13236 bytes - sha256 `e1511ab6367bf8b7d0242ce87cdb9c459d32f66e18f81927e1aeb932fcf2e5b0`
- `apps/mobile/src/app/shelf/scan.tsx` - 33677 bytes - sha256 `f90b455d7f735e6ece27a07e6367e4a2e032da4d03cae497739d52c3a4bde733`
- `apps/mobile/src/app/shelf/search.tsx` - 24405 bytes - sha256 `601e8b0ee413b1fa04048bcb52912b785897f912fdb4dc1e08743f7bce533fe0`
- `apps/mobile/src/features/catalog/client.ts` - 23827 bytes - sha256 `a134e2bb32ea3fde57ef7dbcbe987ef15a5010a440ec38700731a2ea339e9a0e`
- `apps/mobile/src/features/catalog/client.test.ts` - 31695 bytes - sha256 `42dc1c9e4d29c565827535836cf635c37bc19399f663859695a1546df518d297`
- `apps/mobile/src/features/intelligence/pao.ts` - 5160 bytes - sha256 `32209515587ba1136c72abcd9703f25ef46c0aa6a289bff5fac685a08a0eafde`
- `apps/mobile/src/features/intelligence/pao.test.ts` - 3875 bytes - sha256 `d4ff777e1b13717b1fd7b6d01a695070e34f065a311b1f98e04d3b0bb737a385`
- `apps/mobile/src/features/notifications/store.ts` - 11233 bytes - sha256 `c4a58487812e87b538741c9db719437bd92dcc1d2b482605ced3997d7ad6862d`
- `apps/mobile/src/features/notifications/store.test.ts` - 9408 bytes - sha256 `14ab5ba14dedd4c4854b0cba685764e65de3237f8d130d543c09f47c5b7a5608`
- `apps/mobile/src/features/notifications/replenishmentOptInMigration.test.ts` - 718 bytes - sha256 `2b34153c9a4a85b29bbf8483217a65e4ee99b15837a50128bc7cf572c09fb4a0`
- `apps/mobile/src/features/recommendations/replenishment.ts` - 3829 bytes - sha256 `ad0658a4a88071c1991c13c1d8d797d6250cdf5fa70fc33f2613cef380b4e610`
- `apps/mobile/src/features/recommendations/replenishment.test.ts` - 6345 bytes - sha256 `0809c65bdf7982d97624373387e58350342ec65cd5681a145968fa7deb864608`
- `apps/mobile/src/features/shelf/freshness.ts` - 7299 bytes - sha256 `be0997619e57b575d84169f1c47bbf00bbb61e811a393ce04eff586b5b14b77e`
- `apps/mobile/src/features/shelf/freshness.test.ts` - 8353 bytes - sha256 `a7ec4652c8a3cff995038511eec95f31e3d0045cf99d4597f78c58daee44364e`
- `apps/mobile/src/features/shelf/freshnessMigration.test.ts` - 4873 bytes - sha256 `fa08aa33695c6e2a00a7ff7901c5859077376eeb15e2cec8abf40058314257dc`
- `apps/mobile/src/features/shelf/paoProvenance.ts` - 508 bytes - sha256 `dd71e9b3f563903e532cd76f5643ce04cc280f6cbe79cc7837ad2861fdacb7b3`
- `apps/mobile/src/features/shelf/paoProvenance.test.ts` - 1305 bytes - sha256 `036d37d4a9e008be0b89e5c63d9091704f439d23111ca377513a5f4a6bebc555`
- `apps/mobile/src/features/shelf/store.ts` - 31307 bytes - sha256 `5596f52b4eb96cfb43c349773677766e96557f315bb70e2092e711b27f7570b1`
- `apps/mobile/src/features/shelf/store.test.ts` - 39839 bytes - sha256 `821345dd832c7479d0329ad0e85a5e438be0f77acbb4d219ed735aab7a862ba3`
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
- `supabase/tests/database/catalog_serving_gate.test.sql` - 36567 bytes - sha256 `122a856982e0401fbc9dfd6587d0c650a27d15c31273439020cd4d666ee34bef`
- `supabase/tests/database/cat07_truthful_freshness.test.sql` - 35199 bytes - sha256 `3cc0ff929a7f7fea3f409cb2a3baa40befb083e7fccade68df05dc9c3b238253`

### catalog-serving-gate - Fail-closed production catalog serving boundary

- Domain: productSurface
- Status: local-scaffold
- Launch gate: B-CATALOG-SEED
- Owner: Engineering + catalog operator + database reviewer

Required evidence:

- The complete 66-migration chain through `0067`, including catalog migrations `0056` through `0063`, `0064` exact output-only skin-profile quiz provenance, the `0065` CAT-08 transition/default-ACL repair, the additional `0066` legacy clinical-content immutability seal, and the narrow `0067` checker-only runtime-temporary-table shape, passes with the catalog, profile-provenance, CAT-07, CAT-08, clinical-content-seal, and lint-contract pgTAP contracts on the exact hosted staging revision before promotion, curation authorization, clinical publication, or campaign release.
- Barcode and search use service-role-only RPCs over the same positive source/product/correction/CAT-03 eligibility relation; `service_role` has no direct catalog-table read, while explicitly safe authenticated reads retain positive RLS.
- Only rows in the exact active global CAT-03 campaign with active campaign-scoped product authorization, reviewed `verified` or `usable` quality, recommendation eligibility, production/legal-approved sources, and zero independent product holds in `active` or `repair_attested` state can be served; untrusted open intake remains owner-scoped, and accepting, rejecting, closing, or deleting a report cannot release its hold.
- Barcode mappings are independently reviewed, direct authenticated reads cannot bypass source withdrawal, and every held/unknown reason returns the same no-match/manual fallback.

Sources:

- `supabase/migrations/20260717000056_catalog_serving_eligibility_gate.sql` - 34119 bytes - sha256 `0d4543effd4eb5c6d5e036b96d777b217bf853fb0c9587575429a28f14d7793c`
- `supabase/migrations/20260717000057_catalog_import_lifecycle.sql` - 144722 bytes - sha256 `926ba3a453bbe46e8ba97167049f5dda1fb22a59248dee1b9a216d4cc30b7ce7`
- `supabase/migrations/20260717000058_catalog_launch_curation.sql` - 295282 bytes - sha256 `f2d53caad23347103e29b0f5660eefdbdd22bfdc05cc2cb47445ece4192919a6`
- `supabase/migrations/20260718000059_catalog_scan_minimization.sql` - 33321 bytes - sha256 `27e60d3a763d80c4db641cc469361e7593f36f4fb4b49663f400879874207c6e`
- `supabase/migrations/20260718000060_cat07_truthful_freshness.sql` - 24465 bytes - sha256 `8bc2c35bfff443a3c3bf7ab76e52ed17e7d6b961a8b35bdde17701de5c7f574a`
- `supabase/migrations/20260722000061_catalog_import_benzoyl_review_override.sql` - 28316 bytes - sha256 `4048342265ef103e6915411494911a98485528707c7413555725ba4ff427c1e9`
- `supabase/migrations/20260722000062_catalog_curation_statement_guard.sql` - 53193 bytes - sha256 `f7bba7300939fd1f95247c464c49cc01544684637ff25d66076f137475ef9ef1`
- `supabase/migrations/20260722000063_catalog_operator_authority.sql` - 165489 bytes - sha256 `dd9f1537dd7bc68810d9e1322055a6c36a1fef6e873e90577687f133094dcdb2`
- `supabase/migrations/20260726000064_skin_profile_quiz_provenance.sql` - 6096 bytes - sha256 `06f801d0e783b95fdb7fe7e4bd4c288885c6eaeda7189708b5c50d8429b5460f`
- `supabase/migrations/20260726000065_catalog_operator_transition_conflict_target.sql` - 4519 bytes - sha256 `9afd1ad223c9e7587d42118cee9dbc4fe0b0ea641de4f6fad44d8ecb20d79ccb`
- `supabase/migrations/20260726000066_legacy_clinical_content_immutability.sql` - 5653 bytes - sha256 `61ee02bd285ae59fe1905244335699bc630830e16910fda7eb4f19a21e637cd8`
- `supabase/migrations/20260726000067_catalog_release_temp_table_lint_contract.sql` - 7771 bytes - sha256 `2b9a4fc1412edc2373366bb3532710dcaec0439f5b96bb669aa22246cdfbe9b4`
- `supabase/tests/database/catalog_serving_gate.test.sql` - 36567 bytes - sha256 `122a856982e0401fbc9dfd6587d0c650a27d15c31273439020cd4d666ee34bef`
- `supabase/tests/database/catalog_import_lifecycle.test.sql` - 109210 bytes - sha256 `df492491e2243ea15ade299d6f173cd8f3e7662fd53224a0718e22f7c2da965d`
- `supabase/tests/database/catalog_launch_curation.test.sql` - 201879 bytes - sha256 `36f2bfe54bc24795350576db03ad4a5caf0911de729a093c4dd813da9b0b1509`
- `supabase/tests/database/cat07_truthful_freshness.test.sql` - 35199 bytes - sha256 `3cc0ff929a7f7fea3f409cb2a3baa40befb083e7fccade68df05dc9c3b238253`
- `supabase/tests/database/catalog_operator_authority.test.sql` - 73519 bytes - sha256 `9c465a6b8c15dabf799913b2ae30f03b62ca61514cdcafbb372af39c78c652d7`
- `supabase/tests/database/skin_profile_quiz_provenance.test.sql` - 21311 bytes - sha256 `f80721e651b17edba0658ec2b1435b4469157a13855b1b286e1bb8d44bbf33f9`
- `supabase/tests/database/clinical_content_legacy_seal.test.sql` - 10088 bytes - sha256 `02df3c9e33e487c314f390ce18070b15c38a0cca46c113ae7b3e03fb905a21db`
- `supabase/tests/database/catalog_release_temp_table_lint_contract.test.sql` - 3300 bytes - sha256 `d8accade3b03f31827bffcf9ddf82e407b3766cb645908be2ad6a31b9c03558d`
- `supabase/tests/database/schema_contract.test.sql` - 33990 bytes - sha256 `4a4ab8a9917c2df4909aab4748391ce36d29588fd6e9c639f8d5d88d2429e040`
- `scripts/phase9/catalog-operator-0065-upgrade-postgres-rehearsal.sql` - 5846 bytes - sha256 `b6a914dc1e9d04bbf27933d3e969211482fbbc41e04efd5648fff0b5d56683d6`
- `scripts/phase9/clinical-content-0066-upgrade-postgres-rehearsal.sql` - 6577 bytes - sha256 `d7bfbfb7fed85a600c07d6c779aad6bc1e349c53f7d5eae1fba62597178647e7`
- `scripts/phase9/catalog-release-0067-lint-contract-postgres-rehearsal.sql` - 3956 bytes - sha256 `859c79b291ff98ab81490780533d337fa98e7c4988167283567f4f13e142b18e`
- `supabase/functions/catalog-lookup/index.ts` - 11843 bytes - sha256 `23e76d1ba0fd1e199be94986fb0e066e7e4cc6b64d04c642bdd1fb849c97b220`
- `supabase/functions/catalog-lookup/catalogContract.ts` - 80 bytes - sha256 `9707c48c48465b279c2112d84a8a1459867c395490d3c184aaa4e6c2fbc7f81a`
- `supabase/functions/catalog-lookup/catalogContract.test.ts` - 14681 bytes - sha256 `96ab5dd088984ce67115b993e84436205ebb1bfabee25ea2d60558e7eea85f46`
- `supabase/functions/catalog-search/index.ts` - 10142 bytes - sha256 `b7187fee6fe8981d42219de31d1358d11db16bb8f40be530c4d2f838e5400494`
- `supabase/functions/catalog-search/catalogContract.ts` - 1343 bytes - sha256 `62cc1e0d2e62d37187922e4ed1766b12d8ca8aa48cdebf3e3271ea6ae7ce417e`
- `supabase/functions/catalog-search/catalogContract.test.ts` - 3041 bytes - sha256 `dd91fb0c009da68074d795d7819149d9bb970e47c2fba6bbdfc7a08f7f53922d`
- `docs/phase-4/catalog-source-release-runbook.md` - 14878 bytes - sha256 `ad1c21bb30222a35dd6d618352a329e02d514eb5cd2cb75ab1a8d3708e52e620`
- `docs/phase-4/catalog-curation-release-runbook.md` - 45229 bytes - sha256 `e273a6080b0dcc8609cacd8eeff850056cec0069406c646b9ff87f17578a2414`
- `docs/phase-2-production-infrastructure-runbook.md` - 16088 bytes - sha256 `3c0f7fcceb67851a9dd233d53c83c6d1fa004aa9675c0bd5f9e7b0dc9ec956dc`

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

- `docs/phase-4/odbl-compliance-memo.md` - 5338 bytes - sha256 `cf202bd20819b0a8f5b84cc81e7bb2f2470d45ae257a800d4e72f7e88e5bda7d`
- `docs/04-smart-shelf.md` - 62801 bytes - sha256 `c3abb13a3d3235e666d0de99aa4f8c1a47b0a8efe18ec2a473b3a5aa718ce855`
- `supabase/migrations/20260614000026_phase4_catalog.sql` - 35102 bytes - sha256 `dc1a7f150bd5b285cf2d05f2583126ebeb97e67b5363666e670518896b93c311`
- `supabase/functions/catalog-report/index.ts` - 10890 bytes - sha256 `00c15af1cac9a9cda6514d5c441b4c0b2420959a24727d697f7dce9ab8c4acbd`
- `supabase/functions/catalog-report/privacy.ts` - 6403 bytes - sha256 `e81dfbdafe784f79503fc4ad03487040f6e2725fe63f5000df77d944c3e28eec`
- `supabase/functions/catalog-report/privacy.test.ts` - 10228 bytes - sha256 `31411acef464f8e0dda16605ee3f0af769163f67ea920ae5c1f6156ee4508f1d`
- `supabase/migrations/20260717000056_catalog_serving_eligibility_gate.sql` - 34119 bytes - sha256 `0d4543effd4eb5c6d5e036b96d777b217bf853fb0c9587575429a28f14d7793c`
- `supabase/migrations/20260722000063_catalog_operator_authority.sql` - 165489 bytes - sha256 `dd9f1537dd7bc68810d9e1322055a6c36a1fef6e873e90577687f133094dcdb2`
- `supabase/migrations/20260726000065_catalog_operator_transition_conflict_target.sql` - 4519 bytes - sha256 `9afd1ad223c9e7587d42118cee9dbc4fe0b0ea641de4f6fad44d8ecb20d79ccb`
- `supabase/tests/database/catalog_operator_authority.test.sql` - 73519 bytes - sha256 `9c465a6b8c15dabf799913b2ae30f03b62ca61514cdcafbb372af39c78c652d7`
- `apps/mobile/src/features/catalog/client.ts` - 23827 bytes - sha256 `a134e2bb32ea3fde57ef7dbcbe987ef15a5010a440ec38700731a2ea339e9a0e`
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

- Phase 4 source worklist generated with a dirty Git worktree; do not use it as final catalog-source evidence.
