# Phase 4 Beta Coverage Report

Generated: 2026-08-10T01:43:09.413Z
Status: blocked
Git SHA: bb60967e7855aeaa637a0db92224d15a92e3e158
Git status: clean


## Governed Evidence Chain

- Status: blocked
- Source S: BLOCKED
- Evidence E: BLOCKED
- Current R/F HEAD: bb60967e7855aeaa637a0db92224d15a92e3e158
- Selected RC: BLOCKED
- Ledger SHA-256: BLOCKED
- Ledger entries: 0
- Downstream generated commits: 0

## Verdict

Local beta coverage clear: no

This aggregate beta report cannot authorize CAT-03; CAT-03 separately requires the signed catalog-curation contract and privacy-minimized holdout report.

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
- Governed evidence chain: governed beta evidence requires one lowercase source commit S
- Governed evidence chain: governed beta evidence requires one immutable selected RC

## Warnings

- None.

## Input Artifact

| Path | Status | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| docs/phase-4/beta-coverage-input.json | missing |  |  |

## Source Hashes

| Path | Status | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| .gitignore | present | 1644 | 066737865fcf01e54f00ead1cd32e4cc46e3b8571ffc0bbf685113da5059469a |
| package.json | present | 44354 | af6cec1697c363daf266bcd4032a184aa9a994a51cc6a8c0991da4c67b0d8c8e |
| docs/hugeToDo/launch-contract.json | present | 7174 | ef6a34e9e8de58380296f08473211f4915ab81817cde4ee5394f6210f08ca3bb |
| scripts/launch/contract.mjs | present | 15776 | 7bec15c6d8aa7a5f744e094fa74c84969b6b09eeb23d97e94e05498315d5708b |
| .env.example | present | 29662 | d9825f22149f8d15e491d4f1d97fbc8311ce739564a36e1f0ed0ecc64464e091 |
| scripts/phase4/build-source-worklist.mjs | present | 46184 | 28a02f5eadc7ea2fa54cc9995455a26e2a6a83db2821097ebe69549e7b11b640 |
| scripts/phase4/beta-coverage-report.mjs | present | 41079 | 7bb1ba8b05f90f7fe3c80a23cc30dfc790d7999cb0e37db421cb71e3bdfec7a1 |
| scripts/phase4/beta-coverage-report-smoke.mjs | present | 11135 | 5a0b2c40953c5a3ce641320d3df1b555872da27732d4c6b6da7bd2aba8234d7f |
| scripts/phase4/beta-coverage-packet-contract.mjs | present | 996 | 38ed4065cb51607fac1f82f8e371dd3ef487256602f5535312da0dbed9cc37a0 |
| scripts/phase4/beta-coverage-packet-contract.test.mjs | present | 867 | a4631af37fdc9bec17c89b0bc736fd3c7da871902aa4592b8cbb88e43196bfa1 |
| scripts/phase4/beta-coverage-committed-check.mjs | present | 10745 | 401a677c2d90ca7af566debf7bb7925ecbb9f6094732dd90ed0bc24d76704c00 |
| scripts/phase4/beta-coverage-committed-check.test.mjs | present | 9365 | f86658f38009adcfa1cd65a092684441a4f57f76c90814e44d2e3eed1767b7c6 |
| scripts/phase4/source-policy.mjs | present | 89435 | 75242c44fe3ff9e46472647fbcfb9d59070a1306fb4638ae106117a30c9cc634 |
| scripts/phase4/source-policy.test.mjs | present | 39730 | dedc9ebdb80bb022e9f0ad4769c369a4641fbfc03993a4d892ff7f3406659118 |
| scripts/phase4/catalog-curation-contract.mjs | present | 229778 | d5b6565b893b8815eb29ffc5b50665684c86541b0f7580d2a0f80c2db8b56221 |
| scripts/phase4/catalog-curation-contract.test.mjs | present | 114869 | 6f0bb1578661a3951bf4b4b370c003debe0f3d2505439077c91119e7d1d28c3c |
| scripts/phase4/build-catalog-curation-envelope.mjs | present | 4096 | d31aa8d2bea0d2640ac4b343bf91261446aafc3155a9e7ce74e4f9406c760bd5 |
| scripts/phase4/catalog-coverage-quality-report.mjs | present | 5480 | f5fc81ea9f2d31fcec3185fed837634506c89197f7f51777f0c174fa1ab17216 |
| scripts/phase4/catalog-coverage-quality-report.test.mjs | present | 6586 | 616881a177d87b435f75ec39dfbe01eb2bc8dd4d91ff25b50da6c6a776dbb204 |
| scripts/phase4/catalog-qa-report.mjs | present | 27119 | c01d9bc01c8db0951d8113cf74e53bea1e67e4d9145406e85098cfbdd032bf09 |
| scripts/phase4/catalog-qa-report-smoke.mjs | present | 17375 | 70b44647b94c8e2dfded0b7afefbc0b91be3c4de1f8123950e66e412e88c7f2d |
| supabase/functions/catalog-report/index.ts | present | 10890 | 00c15af1cac9a9cda6514d5c441b4c0b2420959a24727d697f7dce9ab8c4acbd |
| supabase/functions/catalog-report/privacy.ts | present | 6403 | e81dfbdafe784f79503fc4ad03487040f6e2725fe63f5000df77d944c3e28eec |
| supabase/functions/catalog-report/privacy.test.ts | present | 10228 | 31411acef464f8e0dda16605ee3f0af769163f67ea920ae5c1f6156ee4508f1d |
| supabase/functions/deno.lock | present | 2465 | b5f517baf0e4dc911925ec80d45b534367a3ed1e8c982cd89998da7e614d93b7 |
| scripts/phase9/lib.mjs | present | 22873 | 2432468891aa67b138785021580caadcc27ab5d1c7aca8c5015e1ddc531d021c |
| scripts/phase9/release-qa-integrity.mjs | present | 56470 | ff2f7724d4cc0bdd4058f76acb8c31ea3b4d2e80a1e1dba531066a1750b727db |
| scripts/phase9/release-qa-integrity.test.mjs | present | 35031 | dc21754b7660bf356633471ad8479a26626d7dad046b7876c2c39902c2831dec |
| scripts/launch/governed-evidence-chain.mjs | present | 64289 | e0ca8221da0ed5561fb68ae32c1eec28fc0291dd94518ddaeabb5e191c58ca1a |
| scripts/launch/governed-evidence-chain.test.mjs | present | 35870 | 93dc7808c2e81f47fa1e5fb317c60050932955a236d135467ae2bcdfb1e7fddd |
| docs/FOR_TAS_TO_DO.md | present | 11239 | 11b6df522e34a3b1a3ad8e130cf07345a8e91059efee6f4399d27360026c2825 |
| docs/phase-3/consent-matrix.md | present | 18185 | 40c6e5537e138b7c8206baef6fca6be6cafb819813d13771793d8a5ca2fd716b |
| docs/phase-3/data-inventory.md | present | 60091 | b5e153f31311d3fa7af2dd16f553f05624b09e27da5d2ed10e44a5018a14aa5c |
| docs/store-privacy-inventory.md | present | 41453 | daa7d558c44e3cb246623258a475d78577a6df43d27ec2c17d7022e37e8aea37 |
| docs/phase-4/beta-coverage-input.template.json | present | 2315 | 4def562c508626e3ad3c2e289d8cd454fe223ba560c85862e6dc78d53613a172 |
| docs/phase-4/beta-shelf-corpus.template.json | present | 24378 | eab0f3ab1ac78f53307b69976163c9edd07350a7fdc5dd52c05cb7c3b40106d5 |
| docs/phase-4/beta-coverage-report.md | present | 8829 | ec85aa2775e5c9075bf3d72137cca06e955720aa80c3b807137ab6a7671f6c05 |
| docs/phase-4/catalog-coverage-quality-targets.template.json | present | 9406 | bd6a316f1d520cee3d5ef347d82bff445cbf810b0ca5c8a551b0c13a083dca7a |
| docs/phase-4/catalog-curation-review.template.json | present | 22645 | 90f7348843f623d30b142d27a59a3d93c33978f9d163c06eea0b78ca2bc8283a |
| docs/phase-4/catalog-cat02-membership-proof.template.json | present | 9252 | e4bf0f76e0ca82047ffe90700a768ddd12d79d0199da1522369f51a48a67e9d7 |
| docs/phase-4/catalog-curation-database-readback.template.json | present | 8237 | d2a01a45d7af0d2cf428a144d589a916b1d2089ab1fa809502a0bcb694ac317e |
| docs/phase-4/catalog-curation-release-runbook.md | present | 45248 | ddd36a968b4ef6f994fd4a9e5847a9ad4c2626a7f5d7057f4a1a92d1610d831e |
| docs/phase-4/generated/source-worklist.json | present | 129167 | d2f7007d930f1c088e823ea4c3941127c21697d1bdff33f51db6be4907dae918 |
| docs/phase-4/generated/source-worklist.md | present | 76995 | f12a71a9e882e297a3376aaf5884489abe353032fdfe83388ef5e2c583e6386d |
| docs/phase-4/observability-dashboard.md | present | 5335 | ffc77c9c33712b2a7b81bf92103e9bc4e71237a60ed40cd96b3aaad7298f0949 |
| docs/phase-4/phase-4-exit-review.md | present | 13732 | f816d01e8ec61062144ed5fe8e85805e58147e775efb86d87a3107971bec92ed |
| supabase/migrations/20260717000058_catalog_launch_curation.sql | present | 295282 | f2d53caad23347103e29b0f5660eefdbdd22bfdc05cc2cb47445ece4192919a6 |
| supabase/migrations/20260718000059_catalog_scan_minimization.sql | present | 33319 | 46c3128d68dccb17b50e28363c478ec7de032a180faf3a5298b0620bfe6e81ec |
| supabase/migrations/20260718000060_cat07_truthful_freshness.sql | present | 24465 | 8bc2c35bfff443a3c3bf7ab76e52ed17e7d6b961a8b35bdde17701de5c7f574a |
| supabase/migrations/20260722000061_catalog_import_benzoyl_review_override.sql | present | 28316 | 4048342265ef103e6915411494911a98485528707c7413555725ba4ff427c1e9 |
| supabase/migrations/20260722000062_catalog_curation_statement_guard.sql | present | 53193 | f7bba7300939fd1f95247c464c49cc01544684637ff25d66076f137475ef9ef1 |
| scripts/phase9/catalog-import-0061-upgrade-postgres-rehearsal.sql | present | 28021 | b1d3464bc9b20a6bc432082b8b01832b980ea231338427fa1e187c238dcd7919 |
| scripts/phase9/catalog-curation-0062-upgrade-postgres-rehearsal.sql | present | 22993 | 64102fcd36e69ff58ab957c94866e215f2f72900758bc98926a46057230e45e9 |
| supabase/tests/database/catalog_launch_curation.test.sql | present | 202040 | 2792fc6c16e7ce655d60a6edb229cf24bb0b61ec662b161ec8b55ac39eddb376 |
| supabase/tests/database/catalog_serving_gate.test.sql | present | 36707 | 1e9e54227161be38e27e2263aab27ec16aeb2ef4ead2316f0dc9daafd12879d9 |
| supabase/tests/database/cat07_truthful_freshness.test.sql | present | 36165 | 24fe6b485009f9733568b3e101c5278380d620e9a75894898a114a9f1670d6f3 |
| docs/phase-4/generated/catalog-qa-report.json | present | 53109 | 8df84d8ef92f1af9f89ced8a63da60745e566d55773843f0a1bf0a02d97bb026 |
| docs/phase-4/generated/catalog-qa-report.md | present | 39934 | c720c54d21e2b929b89892ae06112dd2f049ca25824b4d5778c99e74abd1dcd6 |
| docs/phase-10/beta-event-schema.md | present | 15983 | b8d378bed2de90910be0932c60f6d526adfe55c4c1fc2ec21641ab04aba84e85 |
| docs/phase-10/catalog-beta-report.md | present | 1680 | 28729b9ed344c13414cb6426f0c5360ac21034641b5cd94298d8dbb391165d28 |
| docs/phase-10/support-beta-report.md | present | 2149 | f25c3841a8bc5649dbd1f38632c756898da46a5d7f4d59ff7c328726dc9d26ac |
| docs/phase-10/retention-activation-report.md | present | 2343 | e7c5ebd8d49c5bc527e4ea926743a2ede4eb33522e6fda28ec1deae00953f8ab |
