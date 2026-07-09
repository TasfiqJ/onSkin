# Phase 4 Beta Coverage Report

Generated: 2026-07-09T23:50:39.305Z
Status: blocked
Git SHA: d9ae09c5aa82932c5f6106079591e5bbd8ed9ba8
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
| package.json | present | 16117 | bb14b0e53b7e6f8dd754c32790aa9d2646cf7b9d86b7feb8a21d93857ff9d3df |
| .env.example | present | 15616 | 09fde04cf7c14297e488d608a3f3e2067d3ac357543212debe3c7758ed98f6e1 |
| scripts/phase4/build-source-worklist.mjs | present | 17182 | 1ab08d0a3392148f47e43b141c1a831b420d8110e5a37e780ac41dd685cfd1d6 |
| scripts/phase4/beta-coverage-report.mjs | present | 21522 | ed306d7329101f4369f5e7d971a8361f75e15eb3397288de990999e6c19aac69 |
| scripts/phase4/beta-coverage-report-smoke.mjs | present | 8359 | a277c4d4193d54daf9007b04a5b21b7261022ebe84ba9ae370233c894a3a6eb6 |
| scripts/phase4/catalog-qa-report.mjs | present | 6680 | 9abfd57fc1937cd3f958955f2a0a747e2b9a420560443b11c658feb9d3b482ee |
| scripts/phase4/catalog-qa-report-smoke.mjs | present | 5504 | 43e8b217e0a8276e0299f2477ddb3b4ab9536521d745514be2a48e68e7bf97a1 |
| supabase/functions/catalog-report/index.ts | present | 4604 | 831529e201bf59a61f9eb929cc5939c14797fb9e0eb0b11e1bf817a6008517ec |
| supabase/functions/catalog-report/privacy.ts | present | 3497 | d0d39665dc489392ff8d29c524d46ee182695772cf0fc7293c1c9d93c53e2c8e |
| supabase/functions/catalog-report/privacy.test.ts | present | 3819 | 1a6014b406eba2e771901906309e78162321af3352af63d33d20fd017df70c76 |
| supabase/functions/deno.lock | present | 2282 | 0f8de63ed60182b56865cfa47c666866b631ed4681c79345ec31a720565d1a3a |
| scripts/phase9/lib.mjs | present | 13761 | 544dbaaaba3f7eafcc2527d7700933f31e672a68f160fcb7222caa1389557ff1 |
| docs/FOR_TAS_TO_DO.md | present | 38599 | 4f87ae8fb03e688348fc267c4e3779c1775ceade0c0a1177c6c5690eef30b834 |
| docs/phase-4/beta-coverage-input.template.json | present | 1947 | cf8d5146432335820a361c1ea6d6c7cea1059df602c9d15804fefc01a4bc6cd2 |
| docs/phase-4/beta-coverage-report.md | present | 2125 | d657465c6bdf76f6084fd361cee5bb96c3ad5f92fecf99f93fc9d1cba8f3999d |
| docs/phase-4/generated/source-worklist.json | present | 35121 | f6479be42bcf12dccda9448776d3c39db4a05476bcc7e847676c3986466c7664 |
| docs/phase-4/generated/source-worklist.md | present | 22472 | 45eb2e4d4effe82a518979d09cd2b84126899d31004eadcb0d9afe99344cf182 |
| docs/phase-4/observability-dashboard.md | present | 1804 | a42191be85ab1d75e0c7d9cce2934b0e52369852da35bdd6edf2c153fc6f09af |
| docs/phase-4/phase-4-exit-review.md | present | 2235 | 1d6760669e7c416ff4cca57995660d67c7b7225fc0f5a40edb88421596f0b5a3 |
| docs/phase-4/generated/catalog-qa-report.json | present | 5693 | 9b2f46d96d257e531f18e48352e9c82a4590297c276c0e0d5326af59ef19e8ec |
| docs/phase-4/generated/catalog-qa-report.md | present | 3816 | 1ef590937145b15a52715b6642f5373af2020edf46a0234d00aad09afe26fa2c |
| docs/phase-10/beta-event-schema.md | present | 6425 | e875b98e6130e65989eb5adad3d57b6ab438747a809cccb49d1ce15e1c6ee383 |
| docs/phase-10/catalog-beta-report.md | present | 1291 | 2924dac7cc798a904716b0fbc7de6760046485e85db62e3357c901519081bd3c |
| docs/phase-10/support-beta-report.md | present | 1486 | 68bcd8e27b511229e2c1e9d5bb84ba97eac658b66f5bf04b8eb550c8838c9af3 |
| docs/phase-10/retention-activation-report.md | present | 1685 | 0e93cb0c1662d2ea3c35282dda19cc1d4188cb8c1c4a9cc52cbe5d996e9002ba |
