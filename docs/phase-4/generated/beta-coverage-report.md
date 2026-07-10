# Phase 4 Beta Coverage Report

Generated: 2026-07-10T09:44:53.714Z
Status: blocked
Git SHA: fc54ef53c788a1db745188090cc60f184133a84e
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
| package.json | present | 18099 | 5967b643a1c61a763bebcd45d215e5286c001a1fc1c663c3be17589af3dffe40 |
| .env.example | present | 16277 | 2e389243c757aee40769b8a15718d601160687cfdbd84517aecb34c8834255ba |
| scripts/phase4/build-source-worklist.mjs | present | 17180 | cbd4cb4b8c99eb1963a273c0ae0bd3cdad326a715b37664e4ad62822a21c588c |
| scripts/phase4/beta-coverage-report.mjs | present | 21980 | 95d73e803393a93dcf0a54fa07ff3de9c3c0ee62250cfa608bd7e45883bfe0fd |
| scripts/phase4/beta-coverage-report-smoke.mjs | present | 8339 | 74be5ca44d86da117f80a514ad283212d05a08549cdafb3e2ed6824e6a118105 |
| scripts/phase4/catalog-qa-report.mjs | present | 6696 | f6e506aa07d8cff7715f2db8eff2cfe00784b2d5f277b3f78a1316eeaad0d4c4 |
| scripts/phase4/catalog-qa-report-smoke.mjs | present | 5504 | 43e8b217e0a8276e0299f2477ddb3b4ab9536521d745514be2a48e68e7bf97a1 |
| supabase/functions/catalog-report/index.ts | present | 4653 | bff289eeca7657c0fa0e65ec686c07903dfa08a36c7a7691150cd28417d4aa36 |
| supabase/functions/catalog-report/privacy.ts | present | 3504 | 9dee03b20211d5b3fcb2e05ad4be85a00112dd00f03fc6e5c834969381f0e44e |
| supabase/functions/catalog-report/privacy.test.ts | present | 4009 | db9b6d1c812679297295c5afb6c8d0226c99f94b8aedefff620111d4fa9d7bac |
| supabase/functions/deno.lock | present | 2282 | 0f8de63ed60182b56865cfa47c666866b631ed4681c79345ec31a720565d1a3a |
| scripts/phase9/lib.mjs | present | 14020 | af0b4c651325a3fbb33eb94147744cb23253fa439066861e3ef1b64cbae7a083 |
| docs/FOR_TAS_TO_DO.md | present | 51540 | 2b5a64e1a61a0b565cc0f02b2b6c49c699bf076acda6ede08544a701ee7cf75d |
| docs/phase-4/beta-coverage-input.template.json | present | 1947 | cf8d5146432335820a361c1ea6d6c7cea1059df602c9d15804fefc01a4bc6cd2 |
| docs/phase-4/beta-coverage-report.md | present | 2125 | d657465c6bdf76f6084fd361cee5bb96c3ad5f92fecf99f93fc9d1cba8f3999d |
| docs/phase-4/generated/source-worklist.json | present | 35122 | a49cb87901b5bd99cc07a3f6e80096508ce8d8b548fe3acdd6b2cf7c394a81e4 |
| docs/phase-4/generated/source-worklist.md | present | 22473 | 1f322bc63840e7f62cbc8d8be9effa26e1fba0e7d6362e41fea431901785ceb6 |
| docs/phase-4/observability-dashboard.md | present | 2488 | f2c94ee4b693a2b943134f0c7cbec737fb6017042c8aae3b27fb60330477b981 |
| docs/phase-4/phase-4-exit-review.md | present | 2235 | 1d6760669e7c416ff4cca57995660d67c7b7225fc0f5a40edb88421596f0b5a3 |
| docs/phase-4/generated/catalog-qa-report.json | present | 5693 | 8c5566fbe3ad361b55752c641cafed22b2bb5e1f34abb31728ac485c3a876f5d |
| docs/phase-4/generated/catalog-qa-report.md | present | 3816 | fc00da00d5933e9e43278dcdd4f52baa568109b1b3647b9549a3afcaecf41d02 |
| docs/phase-10/beta-event-schema.md | present | 6525 | f3acfb6c84582d279e4000318c1e5c0e297623a80c1ce0bb8be17458313b4269 |
| docs/phase-10/catalog-beta-report.md | present | 1680 | 28729b9ed344c13414cb6426f0c5360ac21034641b5cd94298d8dbb391165d28 |
| docs/phase-10/support-beta-report.md | present | 2149 | f25c3841a8bc5649dbd1f38632c756898da46a5d7f4d59ff7c328726dc9d26ac |
| docs/phase-10/retention-activation-report.md | present | 2343 | e7c5ebd8d49c5bc527e4ea926743a2ede4eb33522e6fda28ec1deae00953f8ab |
