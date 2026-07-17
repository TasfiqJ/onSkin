# Phase 4 Beta Coverage Report

Generated: 2026-07-17T10:59:46.287Z
Status: blocked
Git SHA: f01fe110b3a225de70bf4ff7c585e2d772a38ddb
Git status: clean


## Verdict

Local beta coverage clear: no

This report is launch-clear only when it is generated from real closed-beta
exports, the worktree is clean, every evidence URL/signoff is real, and all
Phase 4 coverage thresholds below are satisfied.

## Evidence

- Real beta data: BLOCKED
- Catalog/beta dashboard: BLOCKED
- Analytics dashboard: BLOCKED
- Support dashboard: BLOCKED
- Source export hash: BLOCKED
- Signed off by: BLOCKED

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
| package.json | present | 32606 | 32d39d3ba7389bc0d968090df49590ddae46dd632cf0ef7cd7b840b581640211 |
| docs/hugeToDo/launch-contract.json | present | 2935 | 43bea3c862d7e36c7e8d744b87bcf21f65d721500e71e1f1cfa7492fbb14ee4b |
| scripts/launch/contract.mjs | present | 6676 | 6a3ced1c0e7e54ef7db31e848aeeebd3617a77db02c3b51c98d6ee3789a9007d |
| .env.example | present | 27455 | 0984b7c39628ce57f90fc39918b7863b7878335cf3c04fa33a69f1abd9bc5117 |
| scripts/phase4/build-source-worklist.mjs | present | 29178 | d2c52e971c3708050412b1b4eb5edeb9fa43c10383cc925cb6434baf8ab6f45f |
| scripts/phase4/beta-coverage-report.mjs | present | 22270 | 36526f2a68ace587f0a0d8cbf9aa26f2f6831a5b8c5e8d1f20624fb5be7f8079 |
| scripts/phase4/beta-coverage-report-smoke.mjs | present | 8339 | 74be5ca44d86da117f80a514ad283212d05a08549cdafb3e2ed6824e6a118105 |
| scripts/phase4/catalog-qa-report.mjs | present | 26987 | 44f66cf82c7676af4e89355726c396565bbc476271218c7c2e9b6e8954f24977 |
| scripts/phase4/catalog-qa-report-smoke.mjs | present | 13868 | 610987b742671fc1b9503ff8f19d3e7151283811ba1c7a35b1e3ee8d73f9a112 |
| supabase/functions/catalog-report/index.ts | present | 9332 | c8dfe55ddfc44165a20822f9bfa1733c7ae116224d673822acce0c5c5318fecf |
| supabase/functions/catalog-report/privacy.ts | present | 3504 | 9dee03b20211d5b3fcb2e05ad4be85a00112dd00f03fc6e5c834969381f0e44e |
| supabase/functions/catalog-report/privacy.test.ts | present | 4009 | db9b6d1c812679297295c5afb6c8d0226c99f94b8aedefff620111d4fa9d7bac |
| supabase/functions/deno.lock | present | 2282 | 0f8de63ed60182b56865cfa47c666866b631ed4681c79345ec31a720565d1a3a |
| scripts/phase9/lib.mjs | present | 24601 | 76b51c49b63d383bd8ab639536233d5ed52e088c71f8c4911944b2c06852eaf8 |
| docs/FOR_TAS_TO_DO.md | present | 11191 | a02a5647d2491966a701743128fbacab0dc57bf72f0067b305be98ffd469d56c |
| docs/phase-4/beta-coverage-input.template.json | present | 1947 | cf8d5146432335820a361c1ea6d6c7cea1059df602c9d15804fefc01a4bc6cd2 |
| docs/phase-4/beta-coverage-report.md | present | 2125 | d657465c6bdf76f6084fd361cee5bb96c3ad5f92fecf99f93fc9d1cba8f3999d |
| docs/phase-4/generated/source-worklist.json | present | 69962 | af5478881accac35d278d0c7e64a65a21b381fdfcd798f6ab0c64d3cd4b31587 |
| docs/phase-4/generated/source-worklist.md | present | 43480 | dc56cba7da1088efa770334d82cc840e91692bc454705ec1c36cfce8e9ba4e3b |
| docs/phase-4/observability-dashboard.md | present | 3506 | 32031463cdbc4fcbf5997da4572f7b924154b53a25097dae78b773db67bb1b89 |
| docs/phase-4/phase-4-exit-review.md | present | 5375 | d425e45c2f5d04263b6925bd66f0d6662a6722c5486d344581942edf1ac1d7e9 |
| docs/phase-4/generated/catalog-qa-report.json | present | 14817 | dcc84d974fac28a9808bfe1bc78a730cd6c195cac6c02e3f4aa593c1cad362c5 |
| docs/phase-4/generated/catalog-qa-report.md | present | 8501 | b3ca0575535b68415964fa647862a6526cc40879e382487a6af23f486aadd8da |
| docs/phase-10/beta-event-schema.md | present | 6525 | f3acfb6c84582d279e4000318c1e5c0e297623a80c1ce0bb8be17458313b4269 |
| docs/phase-10/catalog-beta-report.md | present | 1680 | 28729b9ed344c13414cb6426f0c5360ac21034641b5cd94298d8dbb391165d28 |
| docs/phase-10/support-beta-report.md | present | 2149 | f25c3841a8bc5649dbd1f38632c756898da46a5d7f4d59ff7c328726dc9d26ac |
| docs/phase-10/retention-activation-report.md | present | 2343 | e7c5ebd8d49c5bc527e4ea926743a2ede4eb33522e6fda28ec1deae00953f8ab |
