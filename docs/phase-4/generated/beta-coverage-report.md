# Phase 4 Beta Coverage Report

Generated: 2026-07-09T02:06:00.910Z
Status: blocked
Git SHA: 785df3eb274f6d155fc0304a63c86192d775465d
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
| package.json | present | 13265 | ec9126b6605a01f80aa1c12a6d20ab37146aabdb024bf2661682c1ecf9a9c335 |
| .env.example | present | 15616 | 09fde04cf7c14297e488d608a3f3e2067d3ac357543212debe3c7758ed98f6e1 |
| scripts/phase4/beta-coverage-report.mjs | present | 21304 | 17db7bc6e862bc6fb065b5e740b12da8f3634adfaefb80b8c05393e39690a3de |
| scripts/phase4/beta-coverage-report-smoke.mjs | present | 7116 | a7f0280c06c6247c5cbccf806403f7960636cc85fdb5f9223d03ad517f8ca558 |
| scripts/phase4/catalog-qa-report.mjs | present | 6579 | cfb7d04ab9b1a0a940c186bd5b6921edca30e8447f5345aab7ccaefb4b8b0202 |
| scripts/phase4/catalog-qa-report-smoke.mjs | present | 5271 | 6cf01a6d0303828a2b5b6aaddcd6cad662c9aeb3098700de431cf12ff182ab35 |
| scripts/phase9/lib.mjs | present | 9767 | d2eeb648cca2cc61457e9796d6f1074081effb8847b2ec37544c3e7df3ce3752 |
| docs/FOR_TAS_TO_DO.md | present | 36062 | ea08a283d12fda609d81c30d18dbb5c82dce6c10244da853a5e768be7fa016ac |
| docs/phase-4/beta-coverage-report.md | present | 1854 | 5fb792bcaf7004c9ce2f44f75eaf866f7bdba230e04116936f54a99cd9b873f6 |
| docs/phase-4/observability-dashboard.md | present | 1804 | a42191be85ab1d75e0c7d9cce2934b0e52369852da35bdd6edf2c153fc6f09af |
| docs/phase-4/phase-4-exit-review.md | present | 2235 | 1d6760669e7c416ff4cca57995660d67c7b7225fc0f5a40edb88421596f0b5a3 |
| docs/phase-4/generated/catalog-qa-report.json | present | 4303 | 27892cfff31434a3860e81c4a101a7c7b64979a6a5f1dbf8804c9672ee3faee5 |
| docs/phase-4/generated/catalog-qa-report.md | present | 2902 | c38cd3f169c7e244063d89c3fda351c09eab3ec7f996abc2f6b4693cab5264c1 |
| docs/phase-10/beta-event-schema.md | present | 5479 | b4b7f137b45ed69c3416cdd19d9126e0d3449425b20813b7d0066991d674f91d |
| docs/phase-10/catalog-beta-report.md | present | 1291 | 2924dac7cc798a904716b0fbc7de6760046485e85db62e3357c901519081bd3c |
| docs/phase-10/support-beta-report.md | present | 1486 | 68bcd8e27b511229e2c1e9d5bb84ba97eac658b66f5bf04b8eb550c8838c9af3 |
| docs/phase-10/retention-activation-report.md | present | 1685 | 0e93cb0c1662d2ea3c35282dda19cc1d4188cb8c1c4a9cc52cbe5d996e9002ba |
