# Catalog QA Report

Generated: 2026-07-17T10:59:45.832Z

Source: open_beauty_facts

Transform status: fixture

Git SHA: f01fe110b3a225de70bf4ff7c585e2d772a38ddb

Build-source Git SHA: not verified

Git status: clean

Records: 2

Rejected records: 1

Blockers: none

Warnings: none

Local QA clear: yes

Launch clear: no

Launch clear reason: No. Source-transform QA is only one gate; launch still requires final source identity/legal evidence, curated record review, beta coverage, signed binary/device evidence, deployment, and named signoff.

## Input Artifact

| Path | Status | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| docs/phase-4/generated/obf-fixture-import.json | present | 4077 | bc86d7ab2daf6db510693e130609bd07e6231c098f4de60199d7cde8271ffced |

## Source Hashes

| Path | Status | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| .github/workflows/quality.yml | present | 8913 | 6be83291bcedd89aa9aea732e0254adf6180c13291a2838b097012f02497eaf4 |
| package.json | present | 32606 | 32d39d3ba7389bc0d968090df49590ddae46dd632cf0ef7cd7b840b581640211 |
| package-lock.json | present | 557143 | 0b817f6d89ea2b318e59d3bbc83203047ade24ab7496ba6ff2c91ff14356f850 |
| apps/mobile/app.config.js | present | 15355 | 2355312e00ff824a4092e5ab8d0a16b35e0e4910afaffaa1edf15f18d7f2ce43 |
| apps/mobile/app.base.json | present | 3981 | c741d1b60cc04f354955316d29a581274b208789dc8c357c49494a3584bfbb84 |
| apps/mobile/eas.json | present | 1478 | bf0aa5a8d6df31283433c1fd17eca55de67ba34a58457059d607844e84938944 |
| apps/mobile/package.json | present | 2897 | c328396d64378a47dd6bd99172a6c6e1abbc562e0c290ad1fc08fcb3dd4fdd80 |
| apps/mobile/phase3-review-evidence.js | present | 28497 | e6dbe67277b536a4cf3e6ba5eb3e3682d2caffe455c624088890e862b2796c93 |
| docs/hugeToDo/launch-contract.json | present | 2935 | 43bea3c862d7e36c7e8d744b87bcf21f65d721500e71e1f1cfa7492fbb14ee4b |
| scripts/launch/contract.mjs | present | 6676 | 6a3ced1c0e7e54ef7db31e848aeeebd3617a77db02c3b51c98d6ee3789a9007d |
| scripts/phase4/catalog-qa-report.mjs | present | 26987 | 44f66cf82c7676af4e89355726c396565bbc476271218c7c2e9b6e8954f24977 |
| scripts/phase4/build-source-worklist.mjs | present | 29178 | d2c52e971c3708050412b1b4eb5edeb9fa43c10383cc925cb6434baf8ab6f45f |
| scripts/phase4/beta-coverage-report.mjs | present | 22270 | 36526f2a68ace587f0a0d8cbf9aa26f2f6831a5b8c5e8d1f20624fb5be7f8079 |
| scripts/phase4/beta-coverage-report-smoke.mjs | present | 8339 | 74be5ca44d86da117f80a514ad283212d05a08549cdafb3e2ed6824e6a118105 |
| scripts/phase4/import-obf-snapshot.mjs | present | 12929 | 3efd8d761fec3fa19ec1fd90e0445c46c684382bb0624fd76f0fc5c4f49b2608 |
| scripts/phase4/import-cosing-dictionary.mjs | present | 13351 | 470016b20d8e5ecb4be94fb83d891c051cb10f42d702d60cde284466579da47a |
| scripts/phase4/import-fixture-smoke.mjs | present | 17697 | d2a79e6d4558b18a5dd02a69dfccb2133c764767d326b881ab39a0afd235d26b |
| scripts/phase4/check-source-env.mjs | present | 2989 | ad8eaa253c3dd97fd6ea09a1cdbf11fb1aec96212a90a610e690a74981989a1a |
| scripts/phase4/check-source-env-smoke.mjs | present | 3933 | 462b2461ca7948033e90e2b1183eda50b4df658393863472680b7d06d4906ede |
| scripts/phase4/catalog-qa-report-smoke.mjs | present | 13868 | 610987b742671fc1b9503ff8f19d3e7151283811ba1c7a35b1e3ee8d73f9a112 |
| scripts/phase4/catalog-promotion-contract.mjs | present | 121311 | b0e248aa0e7696357deb53bfd49b7a9da516f6d5818e7fc89d1fb0b91a54bad0 |
| scripts/phase4/catalog-promotion-contract.test.mjs | present | 61364 | 3e7631a11cfc2446d26041b447fd1b6b4687d37021517037be2fed9659b61c04 |
| scripts/phase4/build-catalog-stage-envelope.mjs | present | 619 | cc36fcee8961ab7239ccc606342253acf9cf7c1d2c5daf6910b56da93eefb2f6 |
| scripts/phase4/complete-catalog-database-receipts.mjs | present | 705 | f73f48b6ee641e7ae05bfeb0de2e4b2ced73492f838bbc94470a03f2f3db41df |
| scripts/phase4/catalog-source-policy-audit.mjs | present | 8633 | f477b1bcaa8b6b7997cded65b63c21e7dbfc23a3c75d169720961f5eb3b6879c |
| scripts/phase4/source-policy.mjs | present | 86618 | 9e7659ea3f52c7f69196e9ecdd2759f95bb363fac243cb600b58ffaf90e58e0e |
| scripts/phase4/source-policy.test.mjs | present | 38524 | 12c69f6082cd11f667f9c605713930b1f6c21f17c6c7042005173a20b7ce9f2f |
| scripts/phase2/local-supabase-contract.mjs | present | 5473 | ad5beccd0323328693201f1febeb0a7483f9190132c9ff6f54f9d19fdb1326b2 |
| scripts/phase2/local-supabase-reset.mjs | present | 16736 | 996b659829dc99de19f90c14b5bb8cc67b4081e5cf0e5b41252324f3bd66e3e2 |
| scripts/phase9/lib.mjs | present | 24601 | 76b51c49b63d383bd8ab639536233d5ed52e088c71f8c4911944b2c06852eaf8 |
| scripts/phase9/rls-adversarial-smoke.mjs | present | 11441 | d65370be1fb57a7a10e34c95c57349aaaf6b98fcbf798fb714dc9a6ef36190a5 |
| scripts/phase9/supabase-function-acl.test.mjs | present | 3485 | 15bb9b38166c18e0682735d6854c91609b0a91f07dc4889a33d750cda886a3fc |
| scripts/phase9/supabase-policy-lint.mjs | present | 13721 | f9aec69c488609b67c9e721e33adc0ea2ec8cca500ae3133ff5036eace8587ea |
| supabase/migrations/20260614000026_phase4_catalog.sql | present | 35102 | dc1a7f150bd5b285cf2d05f2583126ebeb97e67b5363666e670518896b93c311 |
| supabase/migrations/20260717000056_catalog_serving_eligibility_gate.sql | present | 34119 | 0d4543effd4eb5c6d5e036b96d777b217bf853fb0c9587575429a28f14d7793c |
| supabase/migrations/20260717000057_catalog_import_lifecycle.sql | present | 144722 | 926ba3a453bbe46e8ba97167049f5dda1fb22a59248dee1b9a216d4cc30b7ce7 |
| supabase/tests/database/schema_contract.test.sql | present | 21980 | 034d35a86f153dd93b4a5c664ac23297cfa65ffc9bb4afce18f7dd30e61c3763 |
| supabase/tests/database/catalog_import_lifecycle.test.sql | present | 105451 | da1c1d0e30be9bc271d66449336b83901d2f4f90d9b1429df5f58aa9c182e9ce |
| supabase/functions/catalog-lookup/index.ts | present | 10199 | 231dd6175ac99232bf7b263e2152311e8d8ccbe9dd008dcdb12c5321926f27c1 |
| supabase/functions/catalog-lookup/catalogContract.test.ts | present | 10760 | aaf0321ab9002bf966b9d287a01ea6f732bea03932abed03299b7d2a1e47ce2b |
| supabase/functions/catalog-search/index.ts | present | 9227 | 640842b71581aac2f7a01870d27a8e951614bc282e5686cbf9d9564ad5c810fc |
| supabase/functions/catalog-search/catalogContract.test.ts | present | 3041 | dd91fb0c009da68074d795d7819149d9bb970e47c2fba6bbdfc7a08f7f53922d |
| supabase/functions/catalog-report/index.ts | present | 9332 | c8dfe55ddfc44165a20822f9bfa1733c7ae116224d673822acce0c5c5318fecf |
| supabase/functions/catalog-report/privacy.ts | present | 3504 | 9dee03b20211d5b3fcb2e05ad4be85a00112dd00f03fc6e5c834969381f0e44e |
| supabase/functions/catalog-report/privacy.test.ts | present | 4009 | db9b6d1c812679297295c5afb6c8d0226c99f94b8aedefff620111d4fa9d7bac |
| supabase/functions/deno.lock | present | 2282 | 0f8de63ed60182b56865cfa47c666866b631ed4681c79345ec31a720565d1a3a |
| docs/FOR_TAS_TO_DO.md | present | 11191 | a02a5647d2491966a701743128fbacab0dc57bf72f0067b305be98ffd469d56c |
| docs/phase-4/beta-coverage-report.md | present | 2125 | d657465c6bdf76f6084fd361cee5bb96c3ad5f92fecf99f93fc9d1cba8f3999d |
| docs/phase-4/catalog-release-scope.json | present | 341 | 2d02ca4376b1e92ce37901ac67fd0b6dcb05c3a3f8525c881a6925bc68ffb0df |
| docs/phase-4/catalog-release-build-evidence.json | present | 481 | c0b7b51ad2e3e2fd864d25d2ae46b451d6cae1a1e1768d983c168c192dab4254 |
| docs/phase-4/catalog-source-memo-cosing.md | present | 6696 | 4e8b2194655050f0df044e377ffb52d5b9a67e5bb96fc36618b9cf732b6baaa4 |
| docs/phase-4/catalog-source-memo-open-beauty-facts.md | present | 10698 | e9214896b57d59414865dd221ae14f8ca811a47190d1b1ab247781f389c424bf |
| docs/phase-4/catalog-import-promotion-runbook.md | present | 15598 | 9ec04f9b12e9865d7a56c7476c220701e0ac93dfb9ae3644b8518cbbacf1139f |
| docs/phase-4/catalog-source-policy.json | present | 7249 | 79005f1111af670bb8ce11d128627ecde9a59a8f323e2cf9170dfe50c8c2a050 |
| docs/phase-4/catalog-source-trust-registry.json | present | 235 | 13a7f7ca9ac84b31351d1f343bd7e67117fec9b46fa66d60f6c3bdd98e70e824 |
| docs/phase-4/obf-source-approval.template.json | present | 8479 | 9ffa7441d5d9efbf3662aef4509cf9c5cf21b66e296ce07838acaf9fe25ede15 |
| docs/phase-4/cosing-source-approval.template.json | present | 8088 | 05ccfb90c2f7a3eed49571b1fc7d4b87fde28186d644d6cb53671456b7ba5fd3 |
| docs/phase-4/odbl-compliance-memo.md | present | 5099 | ed14fda2e129ee22293ab5d28433626971c0ba8998034547e5f15dc23746c191 |
| docs/phase-4/phase-4-exit-review.md | present | 5375 | d425e45c2f5d04263b6925bd66f0d6662a6722c5486d344581942edf1ac1d7e9 |
