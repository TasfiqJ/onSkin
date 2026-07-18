# Catalog QA Report

Generated: 2026-07-18T15:51:57.685Z

Source: open_beauty_facts

Transform status: fixture

Git SHA: 2d5cb849ac0f926556df7a991be39074a1640fc8

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
| .gitignore | present | 1558 | 5b57b665c8d575b3b7b16b3b650db773fc0fd73a86a5a30cb326afb5c1bf9fae |
| .github/workflows/quality.yml | present | 9224 | 5a38100532c58ecd9d9d414d0455bdf63912feef1e836d738ff4612096a06038 |
| package.json | present | 33306 | c4f416cd9674976509b8ad35f2cac43b06f6653de466aace35773d0642c41b2c |
| package-lock.json | present | 557143 | 0b817f6d89ea2b318e59d3bbc83203047ade24ab7496ba6ff2c91ff14356f850 |
| apps/mobile/app.config.js | present | 15355 | 2355312e00ff824a4092e5ab8d0a16b35e0e4910afaffaa1edf15f18d7f2ce43 |
| apps/mobile/app.base.json | present | 3981 | c741d1b60cc04f354955316d29a581274b208789dc8c357c49494a3584bfbb84 |
| apps/mobile/eas.json | present | 1478 | bf0aa5a8d6df31283433c1fd17eca55de67ba34a58457059d607844e84938944 |
| apps/mobile/package.json | present | 2897 | c328396d64378a47dd6bd99172a6c6e1abbc562e0c290ad1fc08fcb3dd4fdd80 |
| apps/mobile/phase3-review-evidence.js | present | 28497 | e6dbe67277b536a4cf3e6ba5eb3e3682d2caffe455c624088890e862b2796c93 |
| docs/hugeToDo/launch-contract.json | present | 2935 | 43bea3c862d7e36c7e8d744b87bcf21f65d721500e71e1f1cfa7492fbb14ee4b |
| scripts/launch/contract.mjs | present | 6676 | 6a3ced1c0e7e54ef7db31e848aeeebd3617a77db02c3b51c98d6ee3789a9007d |
| scripts/phase4/catalog-qa-report.mjs | present | 26987 | 44f66cf82c7676af4e89355726c396565bbc476271218c7c2e9b6e8954f24977 |
| scripts/phase4/build-source-worklist.mjs | present | 34856 | 53e89ca36ed46ec2230f4ffe51e56ff62f20b079f2a6f5979236cb3825fc749b |
| scripts/phase4/beta-coverage-report.mjs | present | 24852 | 5ec1f917eacbe248074687ea501c006d93227a67d3a10ce598ae7962e35e4852 |
| scripts/phase4/beta-coverage-report-smoke.mjs | present | 10503 | 4993e8d16fc4c7b89d8e45b3a7b67a6ec83dc2e1224a03a377de7c913463efeb |
| scripts/phase4/catalog-curation-contract.mjs | present | 228766 | 12d281bb397fea70f4ae8447638df7f86231f655b23b77d3bc9bec8adfaadf58 |
| scripts/phase4/catalog-curation-contract.test.mjs | present | 112005 | f94c977337a54e486d5e6867866077374550b10cc7cbd1bcb54c96b892f5d7fd |
| scripts/phase4/build-catalog-curation-envelope.mjs | present | 4096 | d31aa8d2bea0d2640ac4b343bf91261446aafc3155a9e7ce74e4f9406c760bd5 |
| scripts/phase4/catalog-coverage-quality-report.mjs | present | 5480 | f5fc81ea9f2d31fcec3185fed837634506c89197f7f51777f0c174fa1ab17216 |
| scripts/phase4/catalog-coverage-quality-report.test.mjs | present | 6586 | 616881a177d87b435f75ec39dfbe01eb2bc8dd4d91ff25b50da6c6a776dbb204 |
| scripts/phase4/import-obf-snapshot.mjs | present | 12929 | 3efd8d761fec3fa19ec1fd90e0445c46c684382bb0624fd76f0fc5c4f49b2608 |
| scripts/phase4/import-cosing-dictionary.mjs | present | 13351 | 470016b20d8e5ecb4be94fb83d891c051cb10f42d702d60cde284466579da47a |
| scripts/phase4/import-fixture-smoke.mjs | present | 17697 | d2a79e6d4558b18a5dd02a69dfccb2133c764767d326b881ab39a0afd235d26b |
| scripts/phase4/check-source-env.mjs | present | 2989 | ad8eaa253c3dd97fd6ea09a1cdbf11fb1aec96212a90a610e690a74981989a1a |
| scripts/phase4/check-source-env-smoke.mjs | present | 3933 | 462b2461ca7948033e90e2b1183eda50b4df658393863472680b7d06d4906ede |
| scripts/phase4/catalog-qa-report-smoke.mjs | present | 14607 | af9d98f4c991863605f93f8fc873834f0e618c642adcd28e89a7dbcd2ed47127 |
| scripts/phase4/catalog-promotion-contract.mjs | present | 121311 | b0e248aa0e7696357deb53bfd49b7a9da516f6d5818e7fc89d1fb0b91a54bad0 |
| scripts/phase4/catalog-promotion-contract.test.mjs | present | 61364 | 3e7631a11cfc2446d26041b447fd1b6b4687d37021517037be2fed9659b61c04 |
| scripts/phase4/build-catalog-stage-envelope.mjs | present | 619 | cc36fcee8961ab7239ccc606342253acf9cf7c1d2c5daf6910b56da93eefb2f6 |
| scripts/phase4/complete-catalog-database-receipts.mjs | present | 705 | f73f48b6ee641e7ae05bfeb0de2e4b2ced73492f838bbc94470a03f2f3db41df |
| scripts/phase4/catalog-source-policy-audit.mjs | present | 8633 | f477b1bcaa8b6b7997cded65b63c21e7dbfc23a3c75d169720961f5eb3b6879c |
| scripts/phase4/source-policy.mjs | present | 87622 | 94053b1914ea094bc10b29d041c78cc71d62ed5ea7080981e0feef45695a110e |
| scripts/phase4/source-policy.test.mjs | present | 38524 | 12c69f6082cd11f667f9c605713930b1f6c21f17c6c7042005173a20b7ce9f2f |
| scripts/phase2/local-supabase-contract.mjs | present | 5473 | b01de696e909265fc81df2ac4cd563474bc1155e7604d4cb11d02c4db2a21510 |
| scripts/phase2/local-supabase-reset.mjs | present | 16736 | a92602b1445d8ab5d6109e571d8b3b81b82582becd7607e7043bf0b027030d0d |
| scripts/phase9/lib.mjs | present | 25511 | bc01832bfadc1795b91bba0f137036f2e3fd29426593c073260bca4324ace57f |
| scripts/phase9/rls-adversarial-smoke.mjs | present | 12029 | 55bbfebb905784424f827f305dd3e06a8e743b16403c6586d0e46201970bfa77 |
| scripts/phase9/supabase-function-acl.test.mjs | present | 3485 | 15bb9b38166c18e0682735d6854c91609b0a91f07dc4889a33d750cda886a3fc |
| scripts/phase9/supabase-policy-lint.mjs | present | 15377 | 20c4f961577e14ecc43b703f13e65228989e472af30acf464f35006c82beccab |
| supabase/migrations/20260614000026_phase4_catalog.sql | present | 35102 | dc1a7f150bd5b285cf2d05f2583126ebeb97e67b5363666e670518896b93c311 |
| supabase/migrations/20260717000056_catalog_serving_eligibility_gate.sql | present | 34119 | 0d4543effd4eb5c6d5e036b96d777b217bf853fb0c9587575429a28f14d7793c |
| supabase/migrations/20260717000057_catalog_import_lifecycle.sql | present | 144722 | 926ba3a453bbe46e8ba97167049f5dda1fb22a59248dee1b9a216d4cc30b7ce7 |
| supabase/migrations/20260717000058_catalog_launch_curation.sql | present | 295282 | f2d53caad23347103e29b0f5660eefdbdd22bfdc05cc2cb47445ece4192919a6 |
| supabase/tests/database/schema_contract.test.sql | present | 21979 | 519ded423a1b5fe7cca18eae9bbb5541ec64462f5872ebf4102ef74cd0e477ad |
| supabase/tests/database/catalog_import_lifecycle.test.sql | present | 105451 | da1c1d0e30be9bc271d66449336b83901d2f4f90d9b1429df5f58aa9c182e9ce |
| supabase/tests/database/catalog_launch_curation.test.sql | present | 165458 | 65e83a28fea146952f84b54dd2123f8fc93d69e4b9d3af5d0cbb9c84381115d0 |
| supabase/functions/catalog-lookup/index.ts | present | 10199 | 231dd6175ac99232bf7b263e2152311e8d8ccbe9dd008dcdb12c5321926f27c1 |
| supabase/functions/catalog-lookup/catalogContract.ts | present | 80 | 9707c48c48465b279c2112d84a8a1459867c395490d3c184aaa4e6c2fbc7f81a |
| supabase/functions/catalog-lookup/catalogContract.test.ts | present | 14681 | 96ab5dd088984ce67115b993e84436205ebb1bfabee25ea2d60558e7eea85f46 |
| supabase/functions/catalog-search/index.ts | present | 9227 | 640842b71581aac2f7a01870d27a8e951614bc282e5686cbf9d9564ad5c810fc |
| supabase/functions/catalog-search/catalogContract.ts | present | 1343 | 62cc1e0d2e62d37187922e4ed1766b12d8ca8aa48cdebf3e3271ea6ae7ce417e |
| supabase/functions/catalog-search/catalogContract.test.ts | present | 3041 | dd91fb0c009da68074d795d7819149d9bb970e47c2fba6bbdfc7a08f7f53922d |
| supabase/functions/catalog-report/index.ts | present | 9332 | c8dfe55ddfc44165a20822f9bfa1733c7ae116224d673822acce0c5c5318fecf |
| supabase/functions/catalog-report/privacy.ts | present | 3504 | 9dee03b20211d5b3fcb2e05ad4be85a00112dd00f03fc6e5c834969381f0e44e |
| supabase/functions/catalog-report/privacy.test.ts | present | 4009 | db9b6d1c812679297295c5afb6c8d0226c99f94b8aedefff620111d4fa9d7bac |
| supabase/functions/deno.lock | present | 2282 | 0f8de63ed60182b56865cfa47c666866b631ed4681c79345ec31a720565d1a3a |
| docs/FOR_TAS_TO_DO.md | present | 11239 | 11b6df522e34a3b1a3ad8e130cf07345a8e91059efee6f4399d27360026c2825 |
| docs/phase-3/consent-matrix.md | present | 16199 | 72dea59e32637652495e66be3d882714f4fef1ff43fa4f795fbc28b42c9edb9a |
| docs/phase-3/data-inventory.md | present | 36362 | 39cf1a9caf5c435fafa23f0074ad4934dfeab6243ef0764949a504b9382a2eda |
| docs/store-privacy-inventory.md | present | 31965 | 620804f163e296ed0faac3bff466fe47f16c86ae5789b8f7bde687938a2342a7 |
| docs/phase-4/beta-coverage-report.md | present | 7014 | cce89c5b8b383e849013fe958912b15e441ec3333606f7fd2663e98b8bb50eea |
| docs/phase-4/beta-shelf-corpus.template.json | present | 24386 | 55a44a32ecd47ed53a7a7ba1b8a1694ea936a69768668e9a739f0218d98420a5 |
| docs/phase-4/catalog-coverage-quality-targets.template.json | present | 9408 | e53c6c5d2715392dab63930046836e1c7b832a007419508a778dd085c54846c1 |
| docs/phase-4/catalog-curation-review.template.json | present | 22649 | 47c15809a4db10ff82855c97405e3b01bca520df1d389b90baa44b6346658390 |
| docs/phase-4/catalog-cat02-membership-proof.template.json | present | 9254 | e4d9ec3cfc09aca71972eb141577492e7bf17cab3a0a78ebd393cdc3fe152c56 |
| docs/phase-4/catalog-curation-database-readback.template.json | present | 8239 | 98efb09bf33c5ef326534ddf6ce888594968bbf50e5bf953d651cb297b47f341 |
| docs/phase-4/catalog-curation-release-runbook.md | present | 40936 | a5775450aa2ed0bb59c37962964ea11a6f23f209b5c4c26bb970e82ee9771bef |
| docs/phase-4/catalog-release-scope.json | present | 341 | 2d02ca4376b1e92ce37901ac67fd0b6dcb05c3a3f8525c881a6925bc68ffb0df |
| docs/phase-4/catalog-release-build-evidence.json | present | 481 | c0b7b51ad2e3e2fd864d25d2ae46b451d6cae1a1e1768d983c168c192dab4254 |
| docs/phase-4/catalog-source-memo-cosing.md | present | 6696 | 4e8b2194655050f0df044e377ffb52d5b9a67e5bb96fc36618b9cf732b6baaa4 |
| docs/phase-4/catalog-source-memo-open-beauty-facts.md | present | 10698 | e9214896b57d59414865dd221ae14f8ca811a47190d1b1ab247781f389c424bf |
| docs/phase-4/catalog-import-promotion-runbook.md | present | 15706 | 0f9d787c2a7c6469151711ebb3da110995c0514963ecca5d59bc33df69a8d994 |
| docs/phase-4/catalog-source-policy.json | present | 7249 | 79005f1111af670bb8ce11d128627ecde9a59a8f323e2cf9170dfe50c8c2a050 |
| docs/phase-4/catalog-source-trust-registry.json | present | 235 | 13a7f7ca9ac84b31351d1f343bd7e67117fec9b46fa66d60f6c3bdd98e70e824 |
| docs/phase-4/obf-source-approval.template.json | present | 8479 | 9ffa7441d5d9efbf3662aef4509cf9c5cf21b66e296ce07838acaf9fe25ede15 |
| docs/phase-4/cosing-source-approval.template.json | present | 8088 | 05ccfb90c2f7a3eed49571b1fc7d4b87fde28186d644d6cb53671456b7ba5fd3 |
| docs/phase-4/odbl-compliance-memo.md | present | 5099 | ed14fda2e129ee22293ab5d28433626971c0ba8998034547e5f15dc23746c191 |
| docs/phase-4/phase-4-exit-review.md | present | 9410 | d5c45471ddfce80c4a4069c1c660a664cefe6a2de6710b1b31ee7c5306838a90 |
