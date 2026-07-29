# Phase 4 Beta Coverage Report

Generated: 2026-07-29T19:53:21.558Z
Status: blocked
Git SHA: 36cda4b0a7bd1790df80abe9caef721546aefe58
Git status: clean


## Governed Evidence Chain

- Status: blocked
- Source S: BLOCKED
- Evidence E: BLOCKED
- Current R/F HEAD: 36cda4b0a7bd1790df80abe9caef721546aefe58
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
| package.json | present | 43019 | cb06180e39a939dca7fcf26ea633e1417ec6e3250ccfcf76e917aa1d1f677239 |
| docs/hugeToDo/launch-contract.json | present | 6343 | 49359cf6585e2e3ad2825935ebab657ab398ad209d4b20ff3fea60df083f2c72 |
| scripts/launch/contract.mjs | present | 13431 | bc9437b9ae8ce4094bd8048932c1e748bf12bca4ebc8b377c84bb7fd94b95f35 |
| .env.example | present | 27858 | 5514e31f85bd2f7155d8bbab2bdda9874cb6ecc92bc7bb2164c62bc6d6276a52 |
| scripts/phase4/build-source-worklist.mjs | present | 45862 | 9771b7f30ba4347828e0293fc7e8381b204e779f5dbd0520aebbdb45cb099cfc |
| scripts/phase4/beta-coverage-report.mjs | present | 41079 | 7bb1ba8b05f90f7fe3c80a23cc30dfc790d7999cb0e37db421cb71e3bdfec7a1 |
| scripts/phase4/beta-coverage-report-smoke.mjs | present | 11145 | 5296dda1c926ddbb7021a91251db2405f9748534d63f76d488e7b71ebd16120c |
| scripts/phase4/beta-coverage-packet-contract.mjs | present | 996 | 38ed4065cb51607fac1f82f8e371dd3ef487256602f5535312da0dbed9cc37a0 |
| scripts/phase4/beta-coverage-packet-contract.test.mjs | present | 867 | a4631af37fdc9bec17c89b0bc736fd3c7da871902aa4592b8cbb88e43196bfa1 |
| scripts/phase4/beta-coverage-committed-check.mjs | present | 10745 | 401a677c2d90ca7af566debf7bb7925ecbb9f6094732dd90ed0bc24d76704c00 |
| scripts/phase4/beta-coverage-committed-check.test.mjs | present | 9362 | deb3a3d39ed3b8e86c5e4ba5cad959f5b69327ef29ac466577d8c84966310a13 |
| scripts/phase4/source-policy.mjs | present | 89435 | 75242c44fe3ff9e46472647fbcfb9d59070a1306fb4638ae106117a30c9cc634 |
| scripts/phase4/source-policy.test.mjs | present | 39752 | c8ff4534e7f7870930f1ee77e5aa7185f8cafea30e5aa87f5a50646383e4244f |
| scripts/phase4/catalog-curation-contract.mjs | present | 229798 | 22acca7d8bbb543c77bb8ececef160185f4bad2ab17de0c41f717b03d5552627 |
| scripts/phase4/catalog-curation-contract.test.mjs | present | 114891 | a7d2e97697d96f619bc47b0a1ac3a843834dd018bb9262df0a052e8c1cad1eb4 |
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
| scripts/phase9/release-qa-integrity.test.mjs | present | 35022 | ba97fd498d900ab76fa22ea968c37ba88406517da87ee9f1babd54f8dca5a679 |
| scripts/launch/governed-evidence-chain.mjs | present | 64286 | 01a86c396964ffa8ab630341c46dc599f851cc0327e54563ec3366ef771aecb7 |
| scripts/launch/governed-evidence-chain.test.mjs | present | 35858 | 1361abf142d7ef3e50a321637dc02c7374ac7f64e0710146849f38498a62e43a |
| docs/FOR_TAS_TO_DO.md | present | 11239 | 11b6df522e34a3b1a3ad8e130cf07345a8e91059efee6f4399d27360026c2825 |
| docs/phase-3/consent-matrix.md | present | 17993 | 2ec41501d4fbd98e55f8edb4b7d83a9bd92ff8e5973f6eb37bd5117274d42342 |
| docs/phase-3/data-inventory.md | present | 60082 | 0adcbf9be7cbaf7908377e55d0ca482101f37f7ce0a048f3d020d4d4a4b52483 |
| docs/store-privacy-inventory.md | present | 41308 | 27ad6d8ef6f9a1702dc42cb7464f05f5eb872d8cc57177cf521de95520632ad5 |
| docs/phase-4/beta-coverage-input.template.json | present | 2315 | 4def562c508626e3ad3c2e289d8cd454fe223ba560c85862e6dc78d53613a172 |
| docs/phase-4/beta-shelf-corpus.template.json | present | 24386 | 55a44a32ecd47ed53a7a7ba1b8a1694ea936a69768668e9a739f0218d98420a5 |
| docs/phase-4/beta-coverage-report.md | present | 8829 | ec85aa2775e5c9075bf3d72137cca06e955720aa80c3b807137ab6a7671f6c05 |
| docs/phase-4/catalog-coverage-quality-targets.template.json | present | 9408 | e53c6c5d2715392dab63930046836e1c7b832a007419508a778dd085c54846c1 |
| docs/phase-4/catalog-curation-review.template.json | present | 22649 | 4dcf0f76ece3ceee0328e0a97dff39a460d270474074b8abe1d5b9f568fb46f9 |
| docs/phase-4/catalog-cat02-membership-proof.template.json | present | 9254 | e4d9ec3cfc09aca71972eb141577492e7bf17cab3a0a78ebd393cdc3fe152c56 |
| docs/phase-4/catalog-curation-database-readback.template.json | present | 8239 | 9930f9302215af9d73d4bde4b8992f89d9b83af9b1132fe122afd3f268833c0a |
| docs/phase-4/catalog-curation-release-runbook.md | present | 45248 | ddd36a968b4ef6f994fd4a9e5847a9ad4c2626a7f5d7057f4a1a92d1610d831e |
| docs/phase-4/generated/source-worklist.json | present | 128106 | fb344a72e2ca4ca3a440bd97b0753c3efee0b9d119321e7726ce1e1b41bb5a4b |
| docs/phase-4/generated/source-worklist.md | present | 76417 | 28948cc7dd03b9420295e518e912cb4f209d545ebd70f0198e460459fe076d5e |
| docs/phase-4/observability-dashboard.md | present | 5335 | ffc77c9c33712b2a7b81bf92103e9bc4e71237a60ed40cd96b3aaad7298f0949 |
| docs/phase-4/phase-4-exit-review.md | present | 13732 | f816d01e8ec61062144ed5fe8e85805e58147e775efb86d87a3107971bec92ed |
| supabase/migrations/20260717000058_catalog_launch_curation.sql | present | 295282 | f2d53caad23347103e29b0f5660eefdbdd22bfdc05cc2cb47445ece4192919a6 |
| supabase/migrations/20260718000059_catalog_scan_minimization.sql | present | 33321 | 27e60d3a763d80c4db641cc469361e7593f36f4fb4b49663f400879874207c6e |
| supabase/migrations/20260718000060_cat07_truthful_freshness.sql | present | 24465 | 8bc2c35bfff443a3c3bf7ab76e52ed17e7d6b961a8b35bdde17701de5c7f574a |
| supabase/migrations/20260722000061_catalog_import_benzoyl_review_override.sql | present | 28316 | 4048342265ef103e6915411494911a98485528707c7413555725ba4ff427c1e9 |
| supabase/migrations/20260722000062_catalog_curation_statement_guard.sql | present | 53193 | f7bba7300939fd1f95247c464c49cc01544684637ff25d66076f137475ef9ef1 |
| scripts/phase9/catalog-import-0061-upgrade-postgres-rehearsal.sql | present | 28021 | b1d3464bc9b20a6bc432082b8b01832b980ea231338427fa1e187c238dcd7919 |
| scripts/phase9/catalog-curation-0062-upgrade-postgres-rehearsal.sql | present | 22993 | 64102fcd36e69ff58ab957c94866e215f2f72900758bc98926a46057230e45e9 |
| supabase/tests/database/catalog_launch_curation.test.sql | present | 202040 | 2792fc6c16e7ce655d60a6edb229cf24bb0b61ec662b161ec8b55ac39eddb376 |
| supabase/tests/database/catalog_serving_gate.test.sql | present | 36707 | 1e9e54227161be38e27e2263aab27ec16aeb2ef4ead2316f0dc9daafd12879d9 |
| supabase/tests/database/cat07_truthful_freshness.test.sql | present | 36171 | d95b9ec59b13f8ab09fcf3e71a052c17c2b3a669e8c93acaf01c793ffd073d24 |
| docs/phase-4/generated/catalog-qa-report.json | present | 24113 | 6d270f2b962ba6172a3ab50061777b2bc33e5eb2a992fd0be3311441083b3aec |
| docs/phase-4/generated/catalog-qa-report.md | present | 12339 | 592dcb7761d484fcbce8042973fc5b338c0373aa4daa0ef94172fd0556b0cd16 |
| docs/phase-10/beta-event-schema.md | present | 15983 | b8d378bed2de90910be0932c60f6d526adfe55c4c1fc2ec21641ab04aba84e85 |
| docs/phase-10/catalog-beta-report.md | present | 1680 | 28729b9ed344c13414cb6426f0c5360ac21034641b5cd94298d8dbb391165d28 |
| docs/phase-10/support-beta-report.md | present | 2149 | f25c3841a8bc5649dbd1f38632c756898da46a5d7f4d59ff7c328726dc9d26ac |
| docs/phase-10/retention-activation-report.md | present | 2343 | e7c5ebd8d49c5bc527e4ea926743a2ede4eb33522e6fda28ec1deae00953f8ab |
