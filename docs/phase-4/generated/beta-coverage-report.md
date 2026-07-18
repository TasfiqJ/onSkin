# Phase 4 Beta Coverage Report

Generated: 2026-07-18T15:52:00.193Z
Status: blocked
Git SHA: 2d5cb849ac0f926556df7a991be39074a1640fc8
Git status: clean


## Verdict

Local beta coverage clear: no

This legacy aggregate report is informational and can never be launch-clear.
CAT-03 authority requires the signed catalog-curation contract, a minimized
sealed holdout report, and an active database curation revision.

## Evidence

- Real beta data claimed: BLOCKED
- Catalog/beta dashboard evidence present: BLOCKED
- Analytics dashboard evidence present: BLOCKED
- Support dashboard evidence present: BLOCKED
- Exact source export digest present: BLOCKED
- Named signoff present: BLOCKED

## Metrics

| Metric | Value | Threshold | Status |
| --- | ---: | --- | --- |
| Completed beta users | n/a | 50-100 real target users | blocked |
| Users with 3+ products | n/a | all completed users | blocked |
| Average products per completed user | n/a | >= 3.00 | blocked |
| Barcode match rate | n/a | exercised and trended by category | blocked |
| Search success rate | n/a | no major category dead zone | blocked |
| OCR parse rate | n/a | low-confidence routed to review | blocked |
| Manual fallback completion | n/a | fallback saves exercised | blocked |
| Wrong-match report rate | n/a | <= 2% | blocked |
| Parser unknown-token rate | n/a | <= 15% | blocked |
| Below-usable products used in recs | n/a | 0 | blocked |
| Open P0/P1 support tickets | 0 | 0 | ok |

## Blockers

- Missing beta coverage input artifact. Set PHASE4_BETA_COVERAGE_INPUT or copy docs/phase-4/beta-coverage-input.template.json to docs/phase-4/beta-coverage-input.json and replace it with real beta exports.

## Warnings

- None.

## Input Artifact

| Path | Status | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| docs/phase-4/beta-coverage-input.json | missing |  |  |

## Source Hashes

| Path | Status | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| .gitignore | present | 1558 | 5b57b665c8d575b3b7b16b3b650db773fc0fd73a86a5a30cb326afb5c1bf9fae |
| package.json | present | 33306 | c4f416cd9674976509b8ad35f2cac43b06f6653de466aace35773d0642c41b2c |
| docs/hugeToDo/launch-contract.json | present | 2935 | 43bea3c862d7e36c7e8d744b87bcf21f65d721500e71e1f1cfa7492fbb14ee4b |
| scripts/launch/contract.mjs | present | 6676 | 6a3ced1c0e7e54ef7db31e848aeeebd3617a77db02c3b51c98d6ee3789a9007d |
| .env.example | present | 27455 | 0984b7c39628ce57f90fc39918b7863b7878335cf3c04fa33a69f1abd9bc5117 |
| scripts/phase4/build-source-worklist.mjs | present | 34856 | 53e89ca36ed46ec2230f4ffe51e56ff62f20b079f2a6f5979236cb3825fc749b |
| scripts/phase4/beta-coverage-report.mjs | present | 24852 | 5ec1f917eacbe248074687ea501c006d93227a67d3a10ce598ae7962e35e4852 |
| scripts/phase4/beta-coverage-report-smoke.mjs | present | 10503 | 4993e8d16fc4c7b89d8e45b3a7b67a6ec83dc2e1224a03a377de7c913463efeb |
| scripts/phase4/catalog-curation-contract.mjs | present | 228766 | 12d281bb397fea70f4ae8447638df7f86231f655b23b77d3bc9bec8adfaadf58 |
| scripts/phase4/catalog-curation-contract.test.mjs | present | 112005 | f94c977337a54e486d5e6867866077374550b10cc7cbd1bcb54c96b892f5d7fd |
| scripts/phase4/build-catalog-curation-envelope.mjs | present | 4096 | d31aa8d2bea0d2640ac4b343bf91261446aafc3155a9e7ce74e4f9406c760bd5 |
| scripts/phase4/catalog-coverage-quality-report.mjs | present | 5480 | f5fc81ea9f2d31fcec3185fed837634506c89197f7f51777f0c174fa1ab17216 |
| scripts/phase4/catalog-coverage-quality-report.test.mjs | present | 6586 | 616881a177d87b435f75ec39dfbe01eb2bc8dd4d91ff25b50da6c6a776dbb204 |
| scripts/phase4/catalog-qa-report.mjs | present | 26987 | 44f66cf82c7676af4e89355726c396565bbc476271218c7c2e9b6e8954f24977 |
| scripts/phase4/catalog-qa-report-smoke.mjs | present | 14607 | af9d98f4c991863605f93f8fc873834f0e618c642adcd28e89a7dbcd2ed47127 |
| supabase/functions/catalog-report/index.ts | present | 9332 | c8dfe55ddfc44165a20822f9bfa1733c7ae116224d673822acce0c5c5318fecf |
| supabase/functions/catalog-report/privacy.ts | present | 3504 | 9dee03b20211d5b3fcb2e05ad4be85a00112dd00f03fc6e5c834969381f0e44e |
| supabase/functions/catalog-report/privacy.test.ts | present | 4009 | db9b6d1c812679297295c5afb6c8d0226c99f94b8aedefff620111d4fa9d7bac |
| supabase/functions/deno.lock | present | 2282 | 0f8de63ed60182b56865cfa47c666866b631ed4681c79345ec31a720565d1a3a |
| scripts/phase9/lib.mjs | present | 25511 | bc01832bfadc1795b91bba0f137036f2e3fd29426593c073260bca4324ace57f |
| docs/FOR_TAS_TO_DO.md | present | 11239 | 11b6df522e34a3b1a3ad8e130cf07345a8e91059efee6f4399d27360026c2825 |
| docs/phase-3/consent-matrix.md | present | 16199 | 72dea59e32637652495e66be3d882714f4fef1ff43fa4f795fbc28b42c9edb9a |
| docs/phase-3/data-inventory.md | present | 36362 | 39cf1a9caf5c435fafa23f0074ad4934dfeab6243ef0764949a504b9382a2eda |
| docs/store-privacy-inventory.md | present | 31965 | 620804f163e296ed0faac3bff466fe47f16c86ae5789b8f7bde687938a2342a7 |
| docs/phase-4/beta-coverage-input.template.json | present | 2315 | 4def562c508626e3ad3c2e289d8cd454fe223ba560c85862e6dc78d53613a172 |
| docs/phase-4/beta-shelf-corpus.template.json | present | 24386 | 55a44a32ecd47ed53a7a7ba1b8a1694ea936a69768668e9a739f0218d98420a5 |
| docs/phase-4/beta-coverage-report.md | present | 7014 | cce89c5b8b383e849013fe958912b15e441ec3333606f7fd2663e98b8bb50eea |
| docs/phase-4/catalog-coverage-quality-targets.template.json | present | 9408 | e53c6c5d2715392dab63930046836e1c7b832a007419508a778dd085c54846c1 |
| docs/phase-4/catalog-curation-review.template.json | present | 22649 | 47c15809a4db10ff82855c97405e3b01bca520df1d389b90baa44b6346658390 |
| docs/phase-4/catalog-cat02-membership-proof.template.json | present | 9254 | e4d9ec3cfc09aca71972eb141577492e7bf17cab3a0a78ebd393cdc3fe152c56 |
| docs/phase-4/catalog-curation-database-readback.template.json | present | 8239 | 98efb09bf33c5ef326534ddf6ce888594968bbf50e5bf953d651cb297b47f341 |
| docs/phase-4/catalog-curation-release-runbook.md | present | 40936 | a5775450aa2ed0bb59c37962964ea11a6f23f209b5c4c26bb970e82ee9771bef |
| docs/phase-4/generated/source-worklist.json | present | 86563 | 2b0b0e20caff8b068a2d2e0734af7e3895551f8389a49ee5eb93f7aa964f32c2 |
| docs/phase-4/generated/source-worklist.md | present | 53302 | 6994d2893814f0df625cb32e5e51459c71b5600a16250af476352a5484560582 |
| docs/phase-4/observability-dashboard.md | present | 3506 | 32031463cdbc4fcbf5997da4572f7b924154b53a25097dae78b773db67bb1b89 |
| docs/phase-4/phase-4-exit-review.md | present | 9410 | d5c45471ddfce80c4a4069c1c660a664cefe6a2de6710b1b31ee7c5306838a90 |
| supabase/migrations/20260717000058_catalog_launch_curation.sql | present | 295282 | f2d53caad23347103e29b0f5660eefdbdd22bfdc05cc2cb47445ece4192919a6 |
| supabase/tests/database/catalog_launch_curation.test.sql | present | 165458 | 65e83a28fea146952f84b54dd2123f8fc93d69e4b9d3af5d0cbb9c84381115d0 |
| docs/phase-4/generated/catalog-qa-report.json | present | 18703 | d4bf1a160197b1568cede5d983eaa35e90286db206cc8e33d3788c8621ac89e5 |
| docs/phase-4/generated/catalog-qa-report.md | present | 11095 | 0ddb53d01c07b23e68f516c26d342baba457b0bcf6a4f1e1d6df0df177709f39 |
| docs/phase-10/beta-event-schema.md | present | 6525 | f3acfb6c84582d279e4000318c1e5c0e297623a80c1ce0bb8be17458313b4269 |
| docs/phase-10/catalog-beta-report.md | present | 1680 | 28729b9ed344c13414cb6426f0c5360ac21034641b5cd94298d8dbb391165d28 |
| docs/phase-10/support-beta-report.md | present | 2149 | f25c3841a8bc5649dbd1f38632c756898da46a5d7f4d59ff7c328726dc9d26ac |
| docs/phase-10/retention-activation-report.md | present | 2343 | e7c5ebd8d49c5bc527e4ea926743a2ede4eb33522e6fda28ec1deae00953f8ab |
