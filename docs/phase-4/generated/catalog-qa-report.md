# Catalog QA Report

Generated: 2026-07-22T17:40:39.166Z

Source: open_beauty_facts

Transform status: fixture

Git SHA: aadcf67688df648dd9c9ba872b84c6fc6f79be30

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
| docs/phase-4/generated/obf-fixture-import.json | present | 4077 | 12927fe64f0ad7d7c6eb59587374cc9c100ca90f9f3fe233a9e213db450f2e0d |

## Source Hashes

| Path | Status | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| .gitignore | present | 1644 | 066737865fcf01e54f00ead1cd32e4cc46e3b8571ffc0bbf685113da5059469a |
| .github/workflows/quality.yml | present | 10554 | 1b4bd0d46aeac3044c673d95754c25e283152461fddd062c19921e976be2faf0 |
| package.json | present | 39221 | 57d7608cc3edc070dac3891ade17e50062ce04a06e7b10c9a636ec9a35f33d3b |
| package-lock.json | present | 557171 | dd17af2962634dd6e1bc1f6f82ca381680bfdc61f161bea6d8ddef9e03d92920 |
| apps/mobile/app.config.js | present | 17986 | 84e5da6bde0ddb1203b6348627c5fd5e02b93ed97576538a2255561a02617fbb |
| apps/mobile/app.base.json | present | 4123 | c33864f530527e0b2aadc399a5bb773498e8e99e258cd94e6225d0a9acb8334f |
| apps/mobile/eas.json | present | 1477 | 074e0c2437c60101d805554dc89f3016ab3433df52d9fb9ccb5b59986b3c7051 |
| apps/mobile/package.json | present | 2897 | c328396d64378a47dd6bd99172a6c6e1abbc562e0c290ad1fc08fcb3dd4fdd80 |
| apps/mobile/phase3-review-evidence.js | present | 28497 | e6dbe67277b536a4cf3e6ba5eb3e3682d2caffe455c624088890e862b2796c93 |
| docs/hugeToDo/launch-contract.json | present | 2935 | 43bea3c862d7e36c7e8d744b87bcf21f65d721500e71e1f1cfa7492fbb14ee4b |
| scripts/launch/contract.mjs | present | 6676 | 6a3ced1c0e7e54ef7db31e848aeeebd3617a77db02c3b51c98d6ee3789a9007d |
| scripts/phase4/catalog-qa-report.mjs | present | 27119 | c01d9bc01c8db0951d8113cf74e53bea1e67e4d9145406e85098cfbdd032bf09 |
| scripts/phase4/build-source-worklist.mjs | present | 36863 | 74beb5ef0237d0dff71757784b4f3e734a756c94bbd5218cbdcb7e854cb5a6c2 |
| scripts/phase4/beta-coverage-report.mjs | present | 41079 | 7bb1ba8b05f90f7fe3c80a23cc30dfc790d7999cb0e37db421cb71e3bdfec7a1 |
| scripts/phase4/beta-coverage-report-smoke.mjs | present | 11145 | 5296dda1c926ddbb7021a91251db2405f9748534d63f76d488e7b71ebd16120c |
| scripts/phase4/catalog-curation-contract.mjs | present | 229798 | 22acca7d8bbb543c77bb8ececef160185f4bad2ab17de0c41f717b03d5552627 |
| scripts/phase4/catalog-curation-contract.test.mjs | present | 114891 | a7d2e97697d96f619bc47b0a1ac3a843834dd018bb9262df0a052e8c1cad1eb4 |
| scripts/phase4/build-catalog-curation-envelope.mjs | present | 4096 | d31aa8d2bea0d2640ac4b343bf91261446aafc3155a9e7ce74e4f9406c760bd5 |
| scripts/phase4/catalog-coverage-quality-report.mjs | present | 5480 | f5fc81ea9f2d31fcec3185fed837634506c89197f7f51777f0c174fa1ab17216 |
| scripts/phase4/catalog-coverage-quality-report.test.mjs | present | 6586 | 616881a177d87b435f75ec39dfbe01eb2bc8dd4d91ff25b50da6c6a776dbb204 |
| scripts/phase4/import-obf-snapshot.mjs | present | 13213 | f9ed4016fb912e0d406e18d85654d3995ba3a6395a64de4516c50018e2d3f64d |
| scripts/phase4/import-cosing-dictionary.mjs | present | 13351 | 470016b20d8e5ecb4be94fb83d891c051cb10f42d702d60cde284466579da47a |
| scripts/phase4/import-fixture-smoke.mjs | present | 22473 | b1999dcd1f340a3c5f792d0293834819d74390e7956c980484cc83df5055a0eb |
| scripts/phase4/check-source-env.mjs | present | 2989 | ad8eaa253c3dd97fd6ea09a1cdbf11fb1aec96212a90a610e690a74981989a1a |
| scripts/phase4/check-source-env-smoke.mjs | present | 3933 | 462b2461ca7948033e90e2b1183eda50b4df658393863472680b7d06d4906ede |
| scripts/phase4/catalog-qa-report-smoke.mjs | present | 17375 | 70b44647b94c8e2dfded0b7afefbc0b91be3c4de1f8123950e66e412e88c7f2d |
| scripts/phase4/catalog-promotion-contract.mjs | present | 126854 | 9612f6f16ce5b7c38bc8d1dcd6c5997bbb72d959033e807561111eac18980038 |
| scripts/phase4/catalog-promotion-contract.test.mjs | present | 70744 | f787bc201d8aed73728ca2200d81fbc293e65263306457f611f403f508fe66a4 |
| scripts/phase4/build-catalog-stage-envelope.mjs | present | 619 | cc36fcee8961ab7239ccc606342253acf9cf7c1d2c5daf6910b56da93eefb2f6 |
| scripts/phase4/complete-catalog-database-receipts.mjs | present | 705 | f73f48b6ee641e7ae05bfeb0de2e4b2ced73492f838bbc94470a03f2f3db41df |
| scripts/phase4/catalog-source-policy-audit.mjs | present | 8633 | f477b1bcaa8b6b7997cded65b63c21e7dbfc23a3c75d169720961f5eb3b6879c |
| scripts/phase4/source-policy.mjs | present | 89435 | 75242c44fe3ff9e46472647fbcfb9d59070a1306fb4638ae106117a30c9cc634 |
| scripts/phase4/source-policy.test.mjs | present | 39752 | c8ff4534e7f7870930f1ee77e5aa7185f8cafea30e5aa87f5a50646383e4244f |
| scripts/phase2/local-supabase-contract.mjs | present | 20762 | e908d55cc1f9b407329488da3334c98f19ca21bf81cd8f555245e3d2a2ac73ef |
| scripts/phase2/local-supabase-reset.mjs | present | 17383 | 33d45d64886affc68a49683963886206aa6608351b6158b15ec9f735e97ae89f |
| scripts/phase9/lib.mjs | present | 22138 | 013215c69c4c4a554cd35b6e7a1b633beb1aa2b16efc36e1bbf030311b93ef2c |
| scripts/phase9/rls-adversarial-smoke.mjs | present | 12029 | df660a2f69854d5466fef98ad39309c9f17cdfbb7fe1dbba7762a63e9cc3b1d2 |
| scripts/phase9/supabase-function-acl.test.mjs | present | 3485 | 15bb9b38166c18e0682735d6854c91609b0a91f07dc4889a33d750cda886a3fc |
| scripts/phase9/supabase-policy-lint.mjs | present | 16274 | 3faac8f26b03d91eee32d3c63a83af821509bc5e7b9e36ea19afc721196d9b9a |
| supabase/migrations/20260614000026_phase4_catalog.sql | present | 35102 | dc1a7f150bd5b285cf2d05f2583126ebeb97e67b5363666e670518896b93c311 |
| supabase/migrations/20260717000056_catalog_serving_eligibility_gate.sql | present | 34119 | 0d4543effd4eb5c6d5e036b96d777b217bf853fb0c9587575429a28f14d7793c |
| supabase/migrations/20260717000057_catalog_import_lifecycle.sql | present | 144722 | 926ba3a453bbe46e8ba97167049f5dda1fb22a59248dee1b9a216d4cc30b7ce7 |
| supabase/migrations/20260717000058_catalog_launch_curation.sql | present | 295282 | f2d53caad23347103e29b0f5660eefdbdd22bfdc05cc2cb47445ece4192919a6 |
| supabase/migrations/20260718000059_catalog_scan_minimization.sql | present | 33321 | 27e60d3a763d80c4db641cc469361e7593f36f4fb4b49663f400879874207c6e |
| supabase/migrations/20260718000060_cat07_truthful_freshness.sql | present | 24465 | 8bc2c35bfff443a3c3bf7ab76e52ed17e7d6b961a8b35bdde17701de5c7f574a |
| supabase/migrations/20260722000061_catalog_import_benzoyl_review_override.sql | present | 28316 | 4048342265ef103e6915411494911a98485528707c7413555725ba4ff427c1e9 |
| supabase/migrations/20260722000062_catalog_curation_statement_guard.sql | present | 53193 | f7bba7300939fd1f95247c464c49cc01544684637ff25d66076f137475ef9ef1 |
| scripts/phase9/catalog-import-0061-upgrade-postgres-rehearsal.sql | present | 28021 | b1d3464bc9b20a6bc432082b8b01832b980ea231338427fa1e187c238dcd7919 |
| scripts/phase9/catalog-curation-0062-upgrade-postgres-rehearsal.sql | present | 22993 | 64102fcd36e69ff58ab957c94866e215f2f72900758bc98926a46057230e45e9 |
| supabase/tests/database/schema_contract.test.sql | present | 33215 | 3426059e0af06a40dfe8dc38adaecb875493edcb827ab541c62820e8354dc601 |
| supabase/tests/database/catalog_import_lifecycle.test.sql | present | 109210 | df492491e2243ea15ade299d6f173cd8f3e7662fd53224a0718e22f7c2da965d |
| supabase/tests/database/catalog_launch_curation.test.sql | present | 197306 | 4dc48bb6d5614bf7765254733e2d03242386e6beb8527fa86cf14e12db6f3491 |
| supabase/tests/database/catalog_serving_gate.test.sql | present | 35691 | 52e48dcf3a70261580791dac75329e0f16741add4d4cc09ef0f5385bae77e666 |
| supabase/tests/database/cat07_truthful_freshness.test.sql | present | 35201 | 6d5971e51a3d74f1527c74baee7bce5ca0a9ffeda1c136e73200e39a06501078 |
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
| docs/phase-3/data-inventory.md | present | 54494 | 46cf9014bc4e53a32ee0354f6e30fcab907e1111c2e6d45aa06f728ca0cccd35 |
| docs/store-privacy-inventory.md | present | 44167 | 5b7aae93e234fbc6292e56cc57fabe427fe58ead703ed824291a89f54a55f536 |
| docs/phase-4/beta-coverage-report.md | present | 8829 | c171efae7cd7bdd114dabb0a015736280605dc54aeb13ad3954dfeb7d2b83268 |
| docs/phase-4/beta-shelf-corpus.template.json | present | 24386 | 55a44a32ecd47ed53a7a7ba1b8a1694ea936a69768668e9a739f0218d98420a5 |
| docs/phase-4/catalog-coverage-quality-targets.template.json | present | 9408 | e53c6c5d2715392dab63930046836e1c7b832a007419508a778dd085c54846c1 |
| docs/phase-4/catalog-curation-review.template.json | present | 22649 | 4dcf0f76ece3ceee0328e0a97dff39a460d270474074b8abe1d5b9f568fb46f9 |
| docs/phase-4/catalog-cat02-membership-proof.template.json | present | 9254 | e4d9ec3cfc09aca71972eb141577492e7bf17cab3a0a78ebd393cdc3fe152c56 |
| docs/phase-4/catalog-curation-database-readback.template.json | present | 8239 | 9930f9302215af9d73d4bde4b8992f89d9b83af9b1132fe122afd3f268833c0a |
| docs/phase-4/catalog-curation-release-runbook.md | present | 44363 | 5f80035149efea7ccc7c25120cfac971a33e46da12fea44f18e1f4bfdb9bafe6 |
| docs/phase-4/catalog-release-scope.json | present | 341 | 2d02ca4376b1e92ce37901ac67fd0b6dcb05c3a3f8525c881a6925bc68ffb0df |
| docs/phase-4/catalog-release-build-evidence.json | present | 481 | c0b7b51ad2e3e2fd864d25d2ae46b451d6cae1a1e1768d983c168c192dab4254 |
| docs/phase-4/catalog-source-memo-cosing.md | present | 6696 | 4e8b2194655050f0df044e377ffb52d5b9a67e5bb96fc36618b9cf732b6baaa4 |
| docs/phase-4/catalog-source-memo-open-beauty-facts.md | present | 10932 | 893e09f4ad7c59c814a134df224c104ba7f959849ed2f34d5e700c2ee2088397 |
| docs/phase-4/catalog-import-promotion-runbook.md | present | 20492 | 3e5bc54b99743c5aa39c84a28c5659d25a8915906b043f33755f7ab0be61a9c6 |
| docs/phase-4/catalog-source-policy.json | present | 7249 | 55c5ae5c64f52cd8a7d9e2ed94a6e878d9deeb42e8c6c16edc721e08bf8781a4 |
| docs/phase-4/catalog-source-trust-registry.json | present | 235 | 13a7f7ca9ac84b31351d1f343bd7e67117fec9b46fa66d60f6c3bdd98e70e824 |
| docs/phase-4/obf-source-approval.template.json | present | 8479 | 9ffa7441d5d9efbf3662aef4509cf9c5cf21b66e296ce07838acaf9fe25ede15 |
| docs/phase-4/cosing-source-approval.template.json | present | 8088 | 05ccfb90c2f7a3eed49571b1fc7d4b87fde28186d644d6cb53671456b7ba5fd3 |
| docs/phase-4/odbl-compliance-memo.md | present | 5338 | cf202bd20819b0a8f5b84cc81e7bb2f2470d45ae257a800d4e72f7e88e5bda7d |
| docs/phase-4/phase-4-exit-review.md | present | 10119 | fbef76a78ea94ec0b2f2746983bd1eeb81c57ef1766d1a9b6ca85defffee4d89 |
