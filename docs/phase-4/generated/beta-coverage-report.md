# Phase 4 Beta Coverage Report

Generated: 2026-07-13T18:54:14.386Z
Status: blocked
Git SHA: 43467f0135b715bac01b697feba5515f77b74715
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
| package.json | present | 20824 | 8151c6a42a79225e676a2bb20e1bcc21775162305ef13a75c7fe4e35a56fbb9b |
| docs/hugeToDo/launch-contract.json | present | 2935 | 43bea3c862d7e36c7e8d744b87bcf21f65d721500e71e1f1cfa7492fbb14ee4b |
| scripts/launch/contract.mjs | present | 6676 | 6a3ced1c0e7e54ef7db31e848aeeebd3617a77db02c3b51c98d6ee3789a9007d |
| .env.example | present | 16193 | 970a51b212bea8ebe9024f315ed051d9a9a131adb10a6fcf2f8085e632e0210c |
| scripts/phase4/build-source-worklist.mjs | present | 19918 | ac896b3cbeeaeb36781c5fc7d6e20c87223e30961f52900e9bbb2e2c6fa7d086 |
| scripts/phase4/beta-coverage-report.mjs | present | 22245 | 708cc87185f72ee9356f73f75ec79c2543744647dae761aa347f55a81c86e4b7 |
| scripts/phase4/beta-coverage-report-smoke.mjs | present | 8339 | 74be5ca44d86da117f80a514ad283212d05a08549cdafb3e2ed6824e6a118105 |
| scripts/phase4/catalog-qa-report.mjs | present | 6961 | 86168235bfe785f680fdbdca89d6640fe2674627a1afdaf27669b0b24d750596 |
| scripts/phase4/catalog-qa-report-smoke.mjs | present | 5504 | 43e8b217e0a8276e0299f2477ddb3b4ab9536521d745514be2a48e68e7bf97a1 |
| supabase/functions/catalog-report/index.ts | present | 4637 | 92277aa7dc9ac044ecce389534ae9c58e99a10ecf5e038f7736ffaf6f5268abc |
| supabase/functions/catalog-report/privacy.ts | present | 3504 | 9dee03b20211d5b3fcb2e05ad4be85a00112dd00f03fc6e5c834969381f0e44e |
| supabase/functions/catalog-report/privacy.test.ts | present | 4009 | db9b6d1c812679297295c5afb6c8d0226c99f94b8aedefff620111d4fa9d7bac |
| supabase/functions/deno.lock | present | 2282 | 0f8de63ed60182b56865cfa47c666866b631ed4681c79345ec31a720565d1a3a |
| scripts/phase9/lib.mjs | present | 14794 | 0dd6fa1c3cf1e68e26adb577e8d9711e9eacf60e3b2f01a0da3e9ab5268744db |
| docs/FOR_TAS_TO_DO.md | present | 11191 | a02a5647d2491966a701743128fbacab0dc57bf72f0067b305be98ffd469d56c |
| docs/phase-4/beta-coverage-input.template.json | present | 1947 | cf8d5146432335820a361c1ea6d6c7cea1059df602c9d15804fefc01a4bc6cd2 |
| docs/phase-4/beta-coverage-report.md | present | 2125 | d657465c6bdf76f6084fd361cee5bb96c3ad5f92fecf99f93fc9d1cba8f3999d |
| docs/phase-4/generated/source-worklist.json | present | 46709 | cd288a066b579ae4dbc88e81badca4a4f95489be29adc943eb490858dd9228de |
| docs/phase-4/generated/source-worklist.md | present | 28924 | 663a8f1f78d9317e2350ef6998c401482b608faab1278f1712d4d4d4b3176848 |
| docs/phase-4/observability-dashboard.md | present | 2488 | f2c94ee4b693a2b943134f0c7cbec737fb6017042c8aae3b27fb60330477b981 |
| docs/phase-4/phase-4-exit-review.md | present | 2235 | 1d6760669e7c416ff4cca57995660d67c7b7225fc0f5a40edb88421596f0b5a3 |
| docs/phase-4/generated/catalog-qa-report.json | present | 7475 | e6ada6a109d2d3cb24a05bddb83c6763bfdcd9cf03d781ceb50e484429b977ba |
| docs/phase-4/generated/catalog-qa-report.md | present | 4055 | d30d7baac1d8b3d152bdc24e73371397d2414c83e9d02032978e997aa9b262a6 |
| docs/phase-10/beta-event-schema.md | present | 6525 | f3acfb6c84582d279e4000318c1e5c0e297623a80c1ce0bb8be17458313b4269 |
| docs/phase-10/catalog-beta-report.md | present | 1680 | 28729b9ed344c13414cb6426f0c5360ac21034641b5cd94298d8dbb391165d28 |
| docs/phase-10/support-beta-report.md | present | 2149 | f25c3841a8bc5649dbd1f38632c756898da46a5d7f4d59ff7c328726dc9d26ac |
| docs/phase-10/retention-activation-report.md | present | 2343 | e7c5ebd8d49c5bc527e4ea926743a2ede4eb33522e6fda28ec1deae00953f8ab |
