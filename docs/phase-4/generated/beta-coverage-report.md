# Phase 4 Beta Coverage Report

Generated: 2026-07-09T17:39:33.396Z
Status: blocked
Git SHA: 02b38134802578fa0d19f85d2ba2842034341386
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

- Missing beta coverage input artifact. Set PHASE4_BETA_COVERAGE_INPUT or create docs/phase-4/beta-coverage-input.json from real beta exports.

## Warnings

- None.

## Input Artifact

| Path | Status | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| docs/phase-4/beta-coverage-input.json | missing |  |  |

## Source Hashes

| Path | Status | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| package.json | present | 14807 | 31b25f729ad716330f4120b1a2ad67f2ce7c01f0cd8608ce9b38e1030698c4aa |
| .env.example | present | 15616 | 09fde04cf7c14297e488d608a3f3e2067d3ac357543212debe3c7758ed98f6e1 |
| scripts/phase4/build-source-worklist.mjs | present | 17182 | 1ab08d0a3392148f47e43b141c1a831b420d8110e5a37e780ac41dd685cfd1d6 |
| scripts/phase4/beta-coverage-report.mjs | present | 21407 | b9c92a82c29de2bab80ec56fa2bdaf2742e3d0aa202775e4334b3012d14f3da4 |
| scripts/phase4/beta-coverage-report-smoke.mjs | present | 7566 | 0a145db27b355e3bf1a25a509f583559a8ca2728e73d2c8385b3f6da7a866732 |
| scripts/phase4/catalog-qa-report.mjs | present | 6680 | 9abfd57fc1937cd3f958955f2a0a747e2b9a420560443b11c658feb9d3b482ee |
| scripts/phase4/catalog-qa-report-smoke.mjs | present | 5504 | 43e8b217e0a8276e0299f2477ddb3b4ab9536521d745514be2a48e68e7bf97a1 |
| supabase/functions/catalog-report/index.ts | present | 4604 | 831529e201bf59a61f9eb929cc5939c14797fb9e0eb0b11e1bf817a6008517ec |
| supabase/functions/catalog-report/privacy.ts | present | 3497 | d0d39665dc489392ff8d29c524d46ee182695772cf0fc7293c1c9d93c53e2c8e |
| supabase/functions/catalog-report/privacy.test.ts | present | 3819 | 1a6014b406eba2e771901906309e78162321af3352af63d33d20fd017df70c76 |
| supabase/functions/deno.lock | present | 2282 | 0f8de63ed60182b56865cfa47c666866b631ed4681c79345ec31a720565d1a3a |
| scripts/phase9/lib.mjs | present | 13541 | 54b07f029b0b690a4ad8f4c05e524201a52a952c44e62ba9582d270764a141d7 |
| docs/FOR_TAS_TO_DO.md | present | 36999 | 09bcb871d3f4f5a18a3c623a86af549f9ae4ccfd2121bd486e0f84efb35feafe |
| docs/phase-4/beta-coverage-report.md | present | 1854 | 5fb792bcaf7004c9ce2f44f75eaf866f7bdba230e04116936f54a99cd9b873f6 |
| docs/phase-4/generated/source-worklist.json | present | 35120 | 9efc1e322663050c4b61ba49cbad4e5e2d071b1f0891f866a1fc8ebcba61a8bd |
| docs/phase-4/generated/source-worklist.md | present | 22471 | 4c66ddf760d528826959982c167a32ba870dfae9d0a30a2f955859cdd800daeb |
| docs/phase-4/observability-dashboard.md | present | 1804 | a42191be85ab1d75e0c7d9cce2934b0e52369852da35bdd6edf2c153fc6f09af |
| docs/phase-4/phase-4-exit-review.md | present | 2235 | 1d6760669e7c416ff4cca57995660d67c7b7225fc0f5a40edb88421596f0b5a3 |
| docs/phase-4/generated/catalog-qa-report.json | present | 5693 | d2230b51d1110c826f0a4d8a7de410bcf241493cf98a395ec0936afaff859e0f |
| docs/phase-4/generated/catalog-qa-report.md | present | 3816 | e17998ab83d31e56962175c540247621d9f3a5c67a01bf74b549945f17cd0f52 |
| docs/phase-10/beta-event-schema.md | present | 6406 | 02f56526909efc482c51307dc3fc8410de6b7c99b17699545f4db6208c4ca1d7 |
| docs/phase-10/catalog-beta-report.md | present | 1291 | 2924dac7cc798a904716b0fbc7de6760046485e85db62e3357c901519081bd3c |
| docs/phase-10/support-beta-report.md | present | 1486 | 68bcd8e27b511229e2c1e9d5bb84ba97eac658b66f5bf04b8eb550c8838c9af3 |
| docs/phase-10/retention-activation-report.md | present | 1685 | 0e93cb0c1662d2ea3c35282dda19cc1d4188cb8c1c4a9cc52cbe5d996e9002ba |
