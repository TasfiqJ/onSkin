# Catalog QA Report

Generated: 2026-07-17T07:44:56.759Z

Source: cosing

Transform status: fixture

Git SHA: 6241c23a30673d7ee9a0504a52d069ba4ea04d8d

Build-source Git SHA: not verified

Git status: clean

Records: 3

Rejected records: 0

Blockers: none

Warnings: none

Local QA clear: yes

Launch clear: no

Launch clear reason: No. Source-transform QA is only one gate; launch still requires final source identity/legal evidence, curated record review, beta coverage, signed binary/device evidence, deployment, and named signoff.

## Input Artifact

| Path | Status | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| docs/phase-4/generated/cosing-fixture-import.json | present | 3996 | 377aef6a49c635745d99390c1ea843bbe3bfc3b90138293dfc29909b1123d313 |

## Source Hashes

| Path | Status | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| package.json | present | 32272 | 1355fd9c03faea3cb3742522e15221a2d05a67f3aaff3113ef1b7dcbdc3996f7 |
| package-lock.json | present | 557143 | 0b817f6d89ea2b318e59d3bbc83203047ade24ab7496ba6ff2c91ff14356f850 |
| apps/mobile/app.config.js | present | 15355 | 2355312e00ff824a4092e5ab8d0a16b35e0e4910afaffaa1edf15f18d7f2ce43 |
| apps/mobile/app.base.json | present | 3981 | c741d1b60cc04f354955316d29a581274b208789dc8c357c49494a3584bfbb84 |
| apps/mobile/eas.json | present | 1478 | bf0aa5a8d6df31283433c1fd17eca55de67ba34a58457059d607844e84938944 |
| apps/mobile/package.json | present | 2897 | c328396d64378a47dd6bd99172a6c6e1abbc562e0c290ad1fc08fcb3dd4fdd80 |
| apps/mobile/phase3-review-evidence.js | present | 28497 | e6dbe67277b536a4cf3e6ba5eb3e3682d2caffe455c624088890e862b2796c93 |
| docs/hugeToDo/launch-contract.json | present | 2935 | 43bea3c862d7e36c7e8d744b87bcf21f65d721500e71e1f1cfa7492fbb14ee4b |
| scripts/launch/contract.mjs | present | 6676 | 6a3ced1c0e7e54ef7db31e848aeeebd3617a77db02c3b51c98d6ee3789a9007d |
| scripts/phase4/catalog-qa-report.mjs | present | 27681 | a029d3d586a64f9feb1edba9d953817b294cbc0ea7e1192b446785b45bac264b |
| scripts/phase4/build-source-worklist.mjs | present | 27155 | 156fdd20c50e541b65ce4d0901cc7cad5b9d41afd68b8ca4b215657889d7d46c |
| scripts/phase4/beta-coverage-report.mjs | present | 22270 | 36526f2a68ace587f0a0d8cbf9aa26f2f6831a5b8c5e8d1f20624fb5be7f8079 |
| scripts/phase4/beta-coverage-report-smoke.mjs | present | 8339 | 74be5ca44d86da117f80a514ad283212d05a08549cdafb3e2ed6824e6a118105 |
| scripts/phase4/import-obf-snapshot.mjs | present | 12508 | 13a0c91365efac1224ae0a6a31eace9d14bca292740045dc0c4eae30199c7046 |
| scripts/phase4/import-cosing-dictionary.mjs | present | 13294 | 75ecc3a48664af5daed702231210c4c0e8757fecd14241d5c781e0a794434538 |
| scripts/phase4/import-fixture-smoke.mjs | present | 15318 | c6f0c7101bc8f2cc738fa2f7e15deaedfa9edb9961f56b78366c44997fbd4711 |
| scripts/phase4/check-source-env.mjs | present | 2989 | ad8eaa253c3dd97fd6ea09a1cdbf11fb1aec96212a90a610e690a74981989a1a |
| scripts/phase4/check-source-env-smoke.mjs | present | 3933 | 462b2461ca7948033e90e2b1183eda50b4df658393863472680b7d06d4906ede |
| scripts/phase4/catalog-qa-report-smoke.mjs | present | 9666 | 1125775a1e89634042149037a190fe78206731f673e2b54983e57f171aed3744 |
| scripts/phase4/catalog-source-policy-audit.mjs | present | 8633 | f477b1bcaa8b6b7997cded65b63c21e7dbfc23a3c75d169720961f5eb3b6879c |
| scripts/phase4/source-policy.mjs | present | 83646 | 8c718e7ae413af329141f204d8df6f8ecf979bb575a6fe5f2ee8a013af3497a5 |
| scripts/phase4/source-policy.test.mjs | present | 37974 | 70ae4c562a1587cf8f20c1d4f68732eaba4cc1139d4f12dd911beaee35909fde |
| supabase/migrations/20260614000026_phase4_catalog.sql | present | 35102 | dc1a7f150bd5b285cf2d05f2583126ebeb97e67b5363666e670518896b93c311 |
| supabase/migrations/20260717000056_catalog_serving_eligibility_gate.sql | present | 34119 | 0d4543effd4eb5c6d5e036b96d777b217bf853fb0c9587575429a28f14d7793c |
| supabase/functions/catalog-lookup/index.ts | present | 10199 | 231dd6175ac99232bf7b263e2152311e8d8ccbe9dd008dcdb12c5321926f27c1 |
| supabase/functions/catalog-search/index.ts | present | 9227 | 640842b71581aac2f7a01870d27a8e951614bc282e5686cbf9d9564ad5c810fc |
| supabase/functions/catalog-report/index.ts | present | 9332 | c8dfe55ddfc44165a20822f9bfa1733c7ae116224d673822acce0c5c5318fecf |
| supabase/functions/catalog-report/privacy.ts | present | 3504 | 9dee03b20211d5b3fcb2e05ad4be85a00112dd00f03fc6e5c834969381f0e44e |
| supabase/functions/catalog-report/privacy.test.ts | present | 4009 | db9b6d1c812679297295c5afb6c8d0226c99f94b8aedefff620111d4fa9d7bac |
| supabase/functions/deno.lock | present | 2282 | 0f8de63ed60182b56865cfa47c666866b631ed4681c79345ec31a720565d1a3a |
| scripts/phase9/lib.mjs | present | 24601 | 62cd70bb40e6792b8626922a38bdba9fa1e20a7539ddbbe1de43644d6ce18411 |
| docs/FOR_TAS_TO_DO.md | present | 11191 | a02a5647d2491966a701743128fbacab0dc57bf72f0067b305be98ffd469d56c |
| docs/phase-4/beta-coverage-report.md | present | 2125 | d657465c6bdf76f6084fd361cee5bb96c3ad5f92fecf99f93fc9d1cba8f3999d |
| docs/phase-4/catalog-release-scope.json | present | 341 | 2d02ca4376b1e92ce37901ac67fd0b6dcb05c3a3f8525c881a6925bc68ffb0df |
| docs/phase-4/catalog-release-build-evidence.json | present | 481 | c0b7b51ad2e3e2fd864d25d2ae46b451d6cae1a1e1768d983c168c192dab4254 |
| docs/phase-4/catalog-source-memo-cosing.md | present | 6696 | 4e8b2194655050f0df044e377ffb52d5b9a67e5bb96fc36618b9cf732b6baaa4 |
| docs/phase-4/catalog-source-memo-open-beauty-facts.md | present | 10516 | dc69c90116e1db72810201c435677990ecc9a716da1786663efd35de6aec90c0 |
| docs/phase-4/catalog-source-policy.json | present | 7249 | 79005f1111af670bb8ce11d128627ecde9a59a8f323e2cf9170dfe50c8c2a050 |
| docs/phase-4/catalog-source-trust-registry.json | present | 235 | 13a7f7ca9ac84b31351d1f343bd7e67117fec9b46fa66d60f6c3bdd98e70e824 |
| docs/phase-4/obf-source-approval.template.json | present | 8479 | 9ffa7441d5d9efbf3662aef4509cf9c5cf21b66e296ce07838acaf9fe25ede15 |
| docs/phase-4/cosing-source-approval.template.json | present | 8088 | 05ccfb90c2f7a3eed49571b1fc7d4b87fde28186d644d6cb53671456b7ba5fd3 |
| docs/phase-4/odbl-compliance-memo.md | present | 4938 | b8ed9a0b3216590e15d50b7ee7a0326b4b22d206f92fec0361bc2602b04280c1 |
| docs/phase-4/phase-4-exit-review.md | present | 4624 | 5a6fdd10f79545aa570fb70d62e4b31e7044583bf7da4769451a1330ba36d6b1 |
