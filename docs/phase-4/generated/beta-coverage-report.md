# Phase 4 Beta Coverage Report

Generated: 2026-07-09T15:58:35.556Z
Status: blocked
Git SHA: db2eb2ea0c35f4dbbb66af8d91be2aedee060c42
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
| package.json | present | 13575 | 48f9e3f326ee484e9d96f7054d30cd27028780bae7d58e006254b1ab0ed64832 |
| .env.example | present | 15616 | 09fde04cf7c14297e488d608a3f3e2067d3ac357543212debe3c7758ed98f6e1 |
| scripts/phase4/build-source-worklist.mjs | present | 16791 | bf3a1c89be6eaaa0f8985bacd0e137d58509bba26dc1381f4f30d6cb6dc62f21 |
| scripts/phase4/beta-coverage-report.mjs | present | 21220 | 245f5542ae9b109bcc8e9b6e0b9fa6c3bb49ac44dabd0dd76b1046d8316619c6 |
| scripts/phase4/beta-coverage-report-smoke.mjs | present | 7116 | a7f0280c06c6247c5cbccf806403f7960636cc85fdb5f9223d03ad517f8ca558 |
| scripts/phase4/catalog-qa-report.mjs | present | 6493 | 96796c537dc0ee1150fa84e5eff78b39ea6064c575c92f68ba83e5d9f2ce440f |
| scripts/phase4/catalog-qa-report-smoke.mjs | present | 5271 | 6cf01a6d0303828a2b5b6aaddcd6cad662c9aeb3098700de431cf12ff182ab35 |
| scripts/phase9/lib.mjs | present | 13437 | 2e71b816a23d872b46a743345ac70b96b95625f3c720ed7274f2e6833d726f78 |
| docs/FOR_TAS_TO_DO.md | present | 36418 | 829648ede250e845937be24826b014323d082b446301d77192a9faa1ee733389 |
| docs/phase-4/beta-coverage-report.md | present | 1854 | 5fb792bcaf7004c9ce2f44f75eaf866f7bdba230e04116936f54a99cd9b873f6 |
| docs/phase-4/generated/source-worklist.json | present | 33127 | b38a98e69beda5c700be1a0497afeb789d9ab1c749348cca0f47259dbbeddf5c |
| docs/phase-4/generated/source-worklist.md | present | 21492 | 1318d6661f2c603479a0610744cc46480c7c4b36048f2d8134d5be3804483cbc |
| docs/phase-4/observability-dashboard.md | present | 1804 | a42191be85ab1d75e0c7d9cce2934b0e52369852da35bdd6edf2c153fc6f09af |
| docs/phase-4/phase-4-exit-review.md | present | 2235 | 1d6760669e7c416ff4cca57995660d67c7b7225fc0f5a40edb88421596f0b5a3 |
| docs/phase-4/generated/catalog-qa-report.json | present | 4902 | 6ead0ee93c1b00b93f0dd301a5ef04f61c4ff7b23920e2ca33994e9b7db6b607 |
| docs/phase-4/generated/catalog-qa-report.md | present | 3297 | aa6897ee1530b5bdf384ea4e1b38695f80182d986535a564d11756db6420334f |
| docs/phase-10/beta-event-schema.md | present | 6406 | 02f56526909efc482c51307dc3fc8410de6b7c99b17699545f4db6208c4ca1d7 |
| docs/phase-10/catalog-beta-report.md | present | 1291 | 2924dac7cc798a904716b0fbc7de6760046485e85db62e3357c901519081bd3c |
| docs/phase-10/support-beta-report.md | present | 1486 | 68bcd8e27b511229e2c1e9d5bb84ba97eac658b66f5bf04b8eb550c8838c9af3 |
| docs/phase-10/retention-activation-report.md | present | 1685 | 0e93cb0c1662d2ea3c35282dda19cc1d4188cb8c1c4a9cc52cbe5d996e9002ba |
