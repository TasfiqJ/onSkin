# Catalog QA Report

Generated: 2026-07-18T21:28:52.769Z

Source: open_beauty_facts

Transform status: fixture

Git SHA: 52107141867fbc9b8e683cfa7399ffdc6351d6d6

Build-source Git SHA: not verified

Git status: clean

Records: 2

Rejected records: 1

Blockers: Import manifest source-policy identity/hash is missing or stale.; 2 records violate the exact content/provenance contract.

Warnings: none

Local QA clear: no

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
| .github/workflows/quality.yml | present | 9444 | 9bdb6ea48fbaea893f53522a87281c531c99662d978bbdb745b2d1d41a1d6fbd |
| package.json | present | 33803 | fcdd60b722b668df65a6714f6006014ea6ecc1ada7a50d056091c0936ce26206 |
| package-lock.json | present | 557143 | 0b817f6d89ea2b318e59d3bbc83203047ade24ab7496ba6ff2c91ff14356f850 |
| apps/mobile/app.config.js | present | 15355 | 2355312e00ff824a4092e5ab8d0a16b35e0e4910afaffaa1edf15f18d7f2ce43 |
| apps/mobile/app.base.json | present | 3981 | c741d1b60cc04f354955316d29a581274b208789dc8c357c49494a3584bfbb84 |
| apps/mobile/eas.json | present | 1478 | bf0aa5a8d6df31283433c1fd17eca55de67ba34a58457059d607844e84938944 |
| apps/mobile/package.json | present | 2897 | c328396d64378a47dd6bd99172a6c6e1abbc562e0c290ad1fc08fcb3dd4fdd80 |
| apps/mobile/phase3-review-evidence.js | present | 28497 | e6dbe67277b536a4cf3e6ba5eb3e3682d2caffe455c624088890e862b2796c93 |
| docs/hugeToDo/launch-contract.json | present | 2935 | 43bea3c862d7e36c7e8d744b87bcf21f65d721500e71e1f1cfa7492fbb14ee4b |
| scripts/launch/contract.mjs | present | 6676 | 6a3ced1c0e7e54ef7db31e848aeeebd3617a77db02c3b51c98d6ee3789a9007d |
| scripts/phase4/catalog-qa-report.mjs | present | 27119 | c01d9bc01c8db0951d8113cf74e53bea1e67e4d9145406e85098cfbdd032bf09 |
| scripts/phase4/build-source-worklist.mjs | present | 34856 | 53e89ca36ed46ec2230f4ffe51e56ff62f20b079f2a6f5979236cb3825fc749b |
| scripts/phase4/beta-coverage-report.mjs | present | 24852 | 5ec1f917eacbe248074687ea501c006d93227a67d3a10ce598ae7962e35e4852 |
| scripts/phase4/beta-coverage-report-smoke.mjs | present | 10503 | 4993e8d16fc4c7b89d8e45b3a7b67a6ec83dc2e1224a03a377de7c913463efeb |
| scripts/phase4/catalog-curation-contract.mjs | present | 228766 | 12d281bb397fea70f4ae8447638df7f86231f655b23b77d3bc9bec8adfaadf58 |
| scripts/phase4/catalog-curation-contract.test.mjs | present | 112005 | f94c977337a54e486d5e6867866077374550b10cc7cbd1bcb54c96b892f5d7fd |
| scripts/phase4/build-catalog-curation-envelope.mjs | present | 4096 | d31aa8d2bea0d2640ac4b343bf91261446aafc3155a9e7ce74e4f9406c760bd5 |
| scripts/phase4/catalog-coverage-quality-report.mjs | present | 5480 | f5fc81ea9f2d31fcec3185fed837634506c89197f7f51777f0c174fa1ab17216 |
| scripts/phase4/catalog-coverage-quality-report.test.mjs | present | 6586 | 616881a177d87b435f75ec39dfbe01eb2bc8dd4d91ff25b50da6c6a776dbb204 |
| scripts/phase4/import-obf-snapshot.mjs | present | 12846 | 8681784954382483d0c623e23b1e6fad2be337e377c74e229d8a92d9ebc91dae |
| scripts/phase4/import-cosing-dictionary.mjs | present | 13351 | 470016b20d8e5ecb4be94fb83d891c051cb10f42d702d60cde284466579da47a |
| scripts/phase4/import-fixture-smoke.mjs | present | 21057 | 31c890b6cb838841e493ced0f7d251f52ac06b1681634c0c08a1c2611713cd56 |
| scripts/phase4/check-source-env.mjs | present | 2989 | ad8eaa253c3dd97fd6ea09a1cdbf11fb1aec96212a90a610e690a74981989a1a |
| scripts/phase4/check-source-env-smoke.mjs | present | 3933 | 462b2461ca7948033e90e2b1183eda50b4df658393863472680b7d06d4906ede |
| scripts/phase4/catalog-qa-report-smoke.mjs | present | 16617 | d9a0f1a80b7716b822ef9ac970d9be9d75e01c85b7b55e3a445f75fae842c7dd |
| scripts/phase4/catalog-promotion-contract.mjs | present | 121357 | e808b7707faad5fdc5dd0b065b463865aa225d663c0444014942ace46e89dc99 |
| scripts/phase4/catalog-promotion-contract.test.mjs | present | 61882 | 2567fbb7f47cf2f62d481369998035efaf2cfe03cbf2febd6d44dbcb93b570e1 |
| scripts/phase4/build-catalog-stage-envelope.mjs | present | 619 | cc36fcee8961ab7239ccc606342253acf9cf7c1d2c5daf6910b56da93eefb2f6 |
| scripts/phase4/complete-catalog-database-receipts.mjs | present | 705 | f73f48b6ee641e7ae05bfeb0de2e4b2ced73492f838bbc94470a03f2f3db41df |
| scripts/phase4/catalog-source-policy-audit.mjs | present | 8633 | f477b1bcaa8b6b7997cded65b63c21e7dbfc23a3c75d169720961f5eb3b6879c |
| scripts/phase4/source-policy.mjs | present | 88870 | 8f3a60e94812556891e81a208737ce79c43fb2f9a34207207ea0ec204e25dfc9 |
| scripts/phase4/source-policy.test.mjs | present | 39752 | c8ff4534e7f7870930f1ee77e5aa7185f8cafea30e5aa87f5a50646383e4244f |
| scripts/phase2/local-supabase-contract.mjs | present | 5473 | 683ed37bd434f6c2b37a1adb24a666a620091d1bb254c7311999e54da21b9aa4 |
| scripts/phase2/local-supabase-reset.mjs | present | 16736 | 4d8a470c8b0f317771690f83befabf5ab76f652aa59c6c9462267717e18904ea |
| scripts/phase9/lib.mjs | present | 25469 | 5036b1121759918646f89e6ff914a4b7a55914437025f5f20dd2e9723ced1017 |
| scripts/phase9/rls-adversarial-smoke.mjs | present | 12029 | df660a2f69854d5466fef98ad39309c9f17cdfbb7fe1dbba7762a63e9cc3b1d2 |
| scripts/phase9/supabase-function-acl.test.mjs | present | 3485 | 15bb9b38166c18e0682735d6854c91609b0a91f07dc4889a33d750cda886a3fc |
| scripts/phase9/supabase-policy-lint.mjs | present | 16274 | 3faac8f26b03d91eee32d3c63a83af821509bc5e7b9e36ea19afc721196d9b9a |
| supabase/migrations/20260614000026_phase4_catalog.sql | present | 35102 | dc1a7f150bd5b285cf2d05f2583126ebeb97e67b5363666e670518896b93c311 |
| supabase/migrations/20260717000056_catalog_serving_eligibility_gate.sql | present | 34119 | 0d4543effd4eb5c6d5e036b96d777b217bf853fb0c9587575429a28f14d7793c |
| supabase/migrations/20260717000057_catalog_import_lifecycle.sql | present | 144722 | 926ba3a453bbe46e8ba97167049f5dda1fb22a59248dee1b9a216d4cc30b7ce7 |
| supabase/migrations/20260717000058_catalog_launch_curation.sql | present | 295282 | f2d53caad23347103e29b0f5660eefdbdd22bfdc05cc2cb47445ece4192919a6 |
| supabase/tests/database/schema_contract.test.sql | present | 31669 | f330fe265dc26f412020307dfa2720d4ab89939af4d8609c36b630c7e3ef286b |
| supabase/tests/database/catalog_import_lifecycle.test.sql | present | 105451 | da1c1d0e30be9bc271d66449336b83901d2f4f90d9b1429df5f58aa9c182e9ce |
| supabase/tests/database/catalog_launch_curation.test.sql | present | 165458 | 65e83a28fea146952f84b54dd2123f8fc93d69e4b9d3af5d0cbb9c84381115d0 |
| supabase/functions/catalog-lookup/index.ts | present | 11843 | 23e76d1ba0fd1e199be94986fb0e066e7e4cc6b64d04c642bdd1fb849c97b220 |
| supabase/functions/catalog-lookup/catalogContract.ts | present | 80 | 9707c48c48465b279c2112d84a8a1459867c395490d3c184aaa4e6c2fbc7f81a |
| supabase/functions/catalog-lookup/catalogContract.test.ts | present | 14681 | 96ab5dd088984ce67115b993e84436205ebb1bfabee25ea2d60558e7eea85f46 |
| supabase/functions/catalog-search/index.ts | present | 10142 | b7187fee6fe8981d42219de31d1358d11db16bb8f40be530c4d2f838e5400494 |
| supabase/functions/catalog-search/catalogContract.ts | present | 1343 | 62cc1e0d2e62d37187922e4ed1766b12d8ca8aa48cdebf3e3271ea6ae7ce417e |
| supabase/functions/catalog-search/catalogContract.test.ts | present | 3041 | dd91fb0c009da68074d795d7819149d9bb970e47c2fba6bbdfc7a08f7f53922d |
| supabase/functions/catalog-report/index.ts | present | 10890 | 00c15af1cac9a9cda6514d5c441b4c0b2420959a24727d697f7dce9ab8c4acbd |
| supabase/functions/catalog-report/privacy.ts | present | 6403 | e81dfbdafe784f79503fc4ad03487040f6e2725fe63f5000df77d944c3e28eec |
| supabase/functions/catalog-report/privacy.test.ts | present | 10228 | 31411acef464f8e0dda16605ee3f0af769163f67ea920ae5c1f6156ee4508f1d |
| supabase/functions/deno.lock | present | 2282 | 0f8de63ed60182b56865cfa47c666866b631ed4681c79345ec31a720565d1a3a |
| docs/FOR_TAS_TO_DO.md | present | 11239 | 11b6df522e34a3b1a3ad8e130cf07345a8e91059efee6f4399d27360026c2825 |
| docs/phase-3/consent-matrix.md | present | 16199 | 72dea59e32637652495e66be3d882714f4fef1ff43fa4f795fbc28b42c9edb9a |
| docs/phase-3/data-inventory.md | present | 52220 | 083458969608d44dadee3611522d875caa9f20dcf59fa2f88e1beb963cd18496 |
| docs/store-privacy-inventory.md | present | 41372 | 161d61fb6c01c8d326613635b94c36ab6f5c72feb30fad73658749ca213109a6 |
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
| docs/phase-4/catalog-source-memo-open-beauty-facts.md | present | 10932 | 893e09f4ad7c59c814a134df224c104ba7f959849ed2f34d5e700c2ee2088397 |
| docs/phase-4/catalog-import-promotion-runbook.md | present | 15706 | 0f9d787c2a7c6469151711ebb3da110995c0514963ecca5d59bc33df69a8d994 |
| docs/phase-4/catalog-source-policy.json | present | 7249 | 55c5ae5c64f52cd8a7d9e2ed94a6e878d9deeb42e8c6c16edc721e08bf8781a4 |
| docs/phase-4/catalog-source-trust-registry.json | present | 235 | 13a7f7ca9ac84b31351d1f343bd7e67117fec9b46fa66d60f6c3bdd98e70e824 |
| docs/phase-4/obf-source-approval.template.json | present | 8479 | 9ffa7441d5d9efbf3662aef4509cf9c5cf21b66e296ce07838acaf9fe25ede15 |
| docs/phase-4/cosing-source-approval.template.json | present | 8088 | 05ccfb90c2f7a3eed49571b1fc7d4b87fde28186d644d6cb53671456b7ba5fd3 |
| docs/phase-4/odbl-compliance-memo.md | present | 5338 | cf202bd20819b0a8f5b84cc81e7bb2f2470d45ae257a800d4e72f7e88e5bda7d |
| docs/phase-4/phase-4-exit-review.md | present | 9410 | d5c45471ddfce80c4a4069c1c660a664cefe6a2de6710b1b31ee7c5306838a90 |
