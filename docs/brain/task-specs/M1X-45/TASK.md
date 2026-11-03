{
  "schema": 1,
  "authority": "M1X-V2-C05-OWNER-PLAN-VERSIONS45-SOURCE-CANDIDATE-01",
  "base": "3865cdd8f610d2c715bd1f3f304ab3c756ca4fbc",
  "baseTree": "c02c58151aa2c23090712494bb8b758f1feb7dab",
  "planCommit": "054f2adf7169fa2c7da8b29150193835b27e62c0",
  "sourceHashes": {
    ".github/workflows/quality.yml": "eef5f8d6f0a90d251a9fc154fdf2e1eaf37a07572f1396c337a95555e4ce1fcf",
    "PROGRESS.md": "b16cfe22d420963198b02052fd7d5edc13258047bf3e76a9c4990626581b5887",
    "apps/mobile/src/app/routine/plan.tsx": "597932ab61f5c3292eb2da7217c242058c9a263992586c561b89d384b265504f",
    "apps/mobile/src/features/routine/PlanHistoryPanel45.test.tsx": "bb97e4815f5b8918548696579924a43d470c0bc3a8ab13bf4c62d5232bb82887",
    "apps/mobile/src/features/routine/PlanHistoryPanel45.tsx": "d1a72785e6518bb7c72fe7e269013c87975abcf32c3af2904c38039fc7f97239",
    "apps/mobile/src/features/routine/planHistory45.test.ts": "65e9f5053127f9384e839b4ce44d85767815cd045c6fc50a4433d4a4a8a28b4b",
    "apps/mobile/src/features/routine/planHistory45.ts": "192e4c253a560a7992cfa3136d7dd595e8fefdae166e766e3822a3158f7a5abb",
    "apps/mobile/src/features/routine/planHistory45Encrypted.test.ts": "d4a6970d72f4f322ade2a1bbb627dd811ae25674739a557ef8a012480bb29e27",
    "apps/mobile/src/features/routine/planSourceFence44.ts": "f24610014e457eae710adf807e98868675dbbe265d07e47a99be52780c9ff285",
    "apps/mobile/src/features/routine/usePlan.test.ts": "340ef5d081f2ae9aa0d27ac65ecaf081fe8aa842f90e3df34dc290db035820f8",
    "apps/mobile/src/features/settings/localDeviceExport.test.ts": "e4424e2cc304b453e4d5c0db6f0d4bb2c9887859acbbc68e44cfc19fcd83d579",
    "apps/mobile/src/features/settings/localDeviceExport.ts": "fe68af8f82ef1c8496c0f22b1018e2b6fe500eee45defba5a36b6ec2f552e851",
    "apps/mobile/src/features/settings/localPrivateDataFence44.test.ts": "d9812d9aaee74a99dc7fc98a56da0fa76fa47a67754c5984efe89d41c21451fa",
    "apps/mobile/src/features/settings/localPrivateDataKeys.test.ts": "3918cf3883603a0f695b23b0b23ab3efcdfedf7fde2d0772c943969809672330",
    "apps/mobile/src/features/settings/localPrivateDataKeys.ts": "b0a6f1f8cb776af0549f44dc44d5c7e6cfa2828e5c0d2f201ec48a983c695d8f",
    "apps/mobile/src/features/shelf/ownedBottleVersion38.test.ts": "138d9a8c1c26a27211bc159fe94bac6e160b609aeaf962d2974073b843cb3f56",
    "apps/mobile/src/lib/auth/localAccountIsolation.ts": "7f02e125f82f5a2fdc576645ae1abd94513ee6fdc6132009a94e965a6609a265",
    "apps/mobile/src/lib/auth/sessionOwner.ts": "5f892775afaa04cdd2b5d655d12dee5314de3bc77dae57fa304b99e86dc15485",
    "apps/mobile/src/lib/consent/healthDataWriteAdmission.test.ts": "27e659c9d242a147ba18ffc235e58d4ad3c1faa7b3c0b41c684c78bc65d0b64d",
    "apps/mobile/src/lib/consent/healthDataWriteAdmission.ts": "4479481bf7050df877d699105b41b132181c6dc3d1f27eb15fdb666b376515d6",
    "apps/mobile/src/lib/storage/privateKV.ts": "2f6cb91144098609abbace74f650c8aead05b4d4607d57eb0537986fb21a2bf8",
    "docs/brain/task-specs/M1X-45/CHANGE_LEDGER.json": "317697455aeaf883e06e101493bc8fa9f6a24ad2b7c021c6d22aab0890e68c0e",
    "docs/release/full-app-j01/owner-plan-history45.md": "f99a1c2d4ad41ad0b26a31b7a19ea44a5685167142127e5189edd3f102da12d0",
    "scripts/release/full-app-j01/historicalReplay45.py": "e26294a43fc48607214fcefae5afb95d04295775b310c31034045899f5bae4d5",
    "scripts/release/full-app-j01/historicalReplay45.test.py": "36f1931598cb24cd23630ba1870a6562666681b7f6b595e515fcf42a9d9a1f50",
    "scripts/release/full-app-j01/main_integration45.py": "5d56435a463f0c6d39c55c4cb9577748cef229d6f07752d6dce3642d86f314ae",
    "scripts/release/full-app-j01/main_integration45.test.py": "bcdbb1c73c2be16925d5b4a36d0564a4435ae158e047bafeeb5f1ae99d8a867d",
    "scripts/release/full-app-j01/source_consumer45.test.py": "31a621583c60baffd3cb3800059901a5118fd4af0e4b55a52c3735064a7356c5"
  },
  "commands": [
    {
      "command": [
        "npm",
        "ci"
      ],
      "exit": 0,
      "qualification": "HISTORICAL_PRE_CLOSURE04__PRIOR_DIAGNOSTIC421_CUTOFF__NPM_CI_ACTUAL_RAW_RECEIPT_NOT_ACCEPTANCE",
      "logSha256": "161a9afcde6c5ee2a44454c6398536b10943d600f742e48bb4047726688eab23"
    },
    {
      "command": [
        "npm.cmd",
        "run",
        "postinstall:check"
      ],
      "exit": 0,
      "qualification": "HISTORICAL_PRE_CLOSURE04__PRIOR_DIAGNOSTIC421_CUTOFF__POSTINSTALL_CHECK_ACTUAL_RAW_RECEIPT_NOT_ACCEPTANCE",
      "logSha256": "5dd8278bf0b53f3b6607c8bd1e2a69a4cef4d30a54b304d2c660232f1be652b7"
    },
    {
      "command": [
        "npm.cmd",
        "--workspace",
        "apps/mobile",
        "run",
        "test",
        "--",
        "src/features/routine/planHistory45.test.ts",
        "src/features/routine/planHistory45Encrypted.test.ts",
        "src/features/routine/planSourceFence44.test.ts",
        "src/lib/storage/privateKVSourceFence44.test.ts"
      ],
      "exit": 1,
      "qualification": "HISTORICAL_PRE_CLOSURE04__PRIOR_DIAGNOSTIC421_CUTOFF__HISTORY_FOCUSED_01_ACTUAL_RAW_RECEIPT_NOT_ACCEPTANCE",
      "logSha256": "3b9289cb1363d4217945791b495295f530aa89355a0a4d2e0b33b2af88a05064"
    },
    {
      "command": [
        "npm.cmd",
        "--workspace",
        "apps/mobile",
        "run",
        "test",
        "--",
        "src/features/routine/planHistory45.test.ts",
        "src/features/routine/planHistory45Encrypted.test.ts",
        "src/features/routine/planSourceFence44.test.ts",
        "src/lib/storage/privateKVSourceFence44.test.ts"
      ],
      "exit": 0,
      "qualification": "HISTORICAL_PRE_CLOSURE04__PRIOR_DIAGNOSTIC421_CUTOFF__HISTORY_FOCUSED_02_ACTUAL_RAW_RECEIPT_NOT_ACCEPTANCE",
      "logSha256": "7021193e0d92b697639bc3291dddf3f19f1855cc34b76892a96ba4608bdeafaa"
    },
    {
      "command": [
        "npm.cmd",
        "--workspace",
        "apps/mobile",
        "run",
        "test",
        "--",
        "src/features/routine/planHistory45.test.ts",
        "src/features/routine/planHistory45Encrypted.test.ts",
        "src/features/routine/planSourceFence44.test.ts",
        "src/lib/storage/privateKVSourceFence44.test.ts",
        "src/features/settings/localPrivateDataFence44.test.ts",
        "src/features/settings/localDeviceExport.test.ts",
        "src/features/settings/localPrivateDataKeys.test.ts",
        "src/lib/consent/healthDataWriteAdmission.test.ts"
      ],
      "exit": 0,
      "qualification": "HISTORICAL_PRE_CLOSURE04__PRIOR_DIAGNOSTIC421_CUTOFF__HISTORY_FOCUSED_03_ACTUAL_RAW_RECEIPT_NOT_ACCEPTANCE",
      "logSha256": "d4dd6d3c24364c7a248ae8904e1448157bbf3590adc579d78e674b0569e95915"
    },
    {
      "command": [
        "npm.cmd",
        "test",
        "--",
        "--force"
      ],
      "exit": 0,
      "qualification": "HISTORICAL_PRE_CLOSURE04__PRIOR_DIAGNOSTIC421_CUTOFF__BLOCKED_FINAL_ROOT_TESTS_ACTUAL_RAW_RECEIPT_NOT_ACCEPTANCE",
      "logSha256": "097c7f4a639b9cb01fe80022ea8fd12bcea0d2fec2a67828422b042922577ae3"
    },
    {
      "command": [
        "npm.cmd",
        "run",
        "typecheck",
        "--",
        "--force"
      ],
      "exit": 0,
      "qualification": "HISTORICAL_PRE_CLOSURE04__PRIOR_DIAGNOSTIC421_CUTOFF__BLOCKED_FINAL_ROOT_TYPECHECK_ACTUAL_RAW_RECEIPT_NOT_ACCEPTANCE",
      "logSha256": "1c31a33661f78c87ac0b8de9016b4a72d5bc7d0b42141415d3ee70293b1fe5bc"
    },
    {
      "command": [
        "npm.cmd",
        "run",
        "lint",
        "--",
        "--force"
      ],
      "exit": 1,
      "qualification": "HISTORICAL_PRE_CLOSURE04__PRIOR_DIAGNOSTIC421_CUTOFF__BLOCKED_FINAL_ROOT_LINT_ACTUAL_RAW_RECEIPT_NOT_ACCEPTANCE",
      "logSha256": "7cc29dbe897d8e5f4d9b0ff4a2298038cf938022278552525e65bc8b6e02eca3"
    },
    {
      "command": [
        "npm.cmd",
        "test",
        "--",
        "--force"
      ],
      "exit": 0,
      "qualification": "HISTORICAL_PRE_CLOSURE04__PRIOR_DIAGNOSTIC421_CUTOFF__BLOCKED_CLOSURE_ROOT_TESTS_ACTUAL_RAW_RECEIPT_NOT_ACCEPTANCE",
      "logSha256": "bb5ea0eecb2d9c4484d5df4430d8e3af362144c3e872d2e77d14f602e3a82fdb"
    },
    {
      "command": [
        "npm.cmd",
        "run",
        "typecheck",
        "--",
        "--force"
      ],
      "exit": 0,
      "qualification": "HISTORICAL_PRE_CLOSURE04__PRIOR_DIAGNOSTIC421_CUTOFF__BLOCKED_CLOSURE_ROOT_TYPECHECK_ACTUAL_RAW_RECEIPT_NOT_ACCEPTANCE",
      "logSha256": "dbef0819aca95e9e373455e6d23b1cf1fec8bb56ef1e68734e835e46aa60fae3"
    },
    {
      "command": [
        "npm.cmd",
        "run",
        "lint",
        "--",
        "--force"
      ],
      "exit": 0,
      "qualification": "HISTORICAL_PRE_CLOSURE04__PRIOR_DIAGNOSTIC421_CUTOFF__BLOCKED_CLOSURE_ROOT_LINT_ACTUAL_RAW_RECEIPT_NOT_ACCEPTANCE",
      "logSha256": "1f6079a831f6cbcfa6be51f6b2a44f289f1ba3511c39412f791e8719ceb81aaa"
    },
    {
      "command": [
        "node",
        "--test",
        "scripts/core04/persistence-source-contract.test.mjs",
        "scripts/core06/recommendation-admission-source-contract.test.mjs"
      ],
      "exit": 1,
      "qualification": "HISTORICAL_PRE_CLOSURE04__PRIOR_DIAGNOSTIC421_CUTOFF__BLOCKED_FINAL_CORE04_CORE06_EXPECTED_PROTECTED_TWO_OPEN_FAILURES",
      "logSha256": "0904ca575fd8f09017d02e07aaf20ffdc0a44a508cf468adf7c1b9f2640a9c4f"
    },
    {
      "command": "ui-final.log",
      "exit": 0,
      "qualification": "HISTORICAL_PRE_CLOSURE04__PRIOR_DIAGNOSTIC421_CUTOFF__RAW_123_TEST_SELECTION_PASS_NOT_OWNER_ACCEPTANCE",
      "logSha256": "8b65f71ed2715a8a74c4967c3fe69c18a37cfd957fb7f60612ead096c00ce1c5"
    },
    {
      "command": "cleanup-export-fixed-final-focused.log",
      "exit": 0,
      "qualification": "HISTORICAL_PRE_CLOSURE04__PRIOR_DIAGNOSTIC421_CUTOFF__RAW_80_TEST_SELECTION_PASS_NOT_OWNER_ACCEPTANCE",
      "logSha256": "6a3a5842368f486c4d94a8a0b58cced6805266aaea8b625a542fca187d34e2a8"
    },
    {
      "command": "export-tentative-history-adversarial-red2.log",
      "exit": 1,
      "qualification": "HISTORICAL_PRE_CLOSURE04__PRIOR_DIAGNOSTIC421_CUTOFF__RAW_2_TEST_SELECTION_GENUINE_TENTATIVE_EXPORT_COUNTEREXAMPLE_FIXED_IN_SUCCESSOR",
      "logSha256": "31e1a005b6c2eed9c589e42e6044be37de548ef9ddb9d2008f3919ec2850fd17"
    },
    {
      "command": "export-tentative-history-adversarial-fixed.log",
      "exit": 0,
      "qualification": "HISTORICAL_PRE_CLOSURE04__PRIOR_DIAGNOSTIC421_CUTOFF__RAW_2_TEST_SELECTION_PASS_NOT_OWNER_ACCEPTANCE",
      "logSha256": "4a60e9c7c99f2f1778e0bb1946a72caa8cbaef1b23411800370675f34f67950e"
    },
    {
      "command": "actual compact375x812-or-smaller browser Plan/Save/history smoke",
      "exit": null,
      "qualification": "HISTORICAL_PRE_CLOSURE04__PRIOR_DIAGNOSTIC421_CUTOFF__BLOCKED_BROWSER_CONNECTOR_DISABLED_AND_NATIVE_URL_POLICY_STOP_NO_WORKAROUND",
      "logSha256": "dade7febea145fb86b5e9ec992e3b7feb8a7a19a767ee2905446f8a0e3d7855b"
    },
    {
      "command": "complete authenticated44->41->...->29 replay",
      "exit": 1,
      "qualification": "HISTORICAL_PRE_CLOSURE04__PRIOR_DIAGNOSTIC421_CUTOFF__INCOMPLETE_MANUALLY_TERMINATED_AFTER_BROWSER_BLOCKER_NOT_A_CHAIN_PASS",
      "logSha256": "52b78cb88a7fd43946340818998546cce21daf3d47a0252c9c180eb49f62e9be"
    },
    {
      "command": "SOURCE_FROZEN/seal/push/stackedDRAFTPR/final-head hostedCI",
      "exit": null,
      "qualification": "HISTORICAL_PRE_CLOSURE04__PRIOR_DIAGNOSTIC421_CUTOFF__NOT_RUN_PARTIAL_BLOCKED_NO_GO",
      "logSha256": null
    },
    {
      "command": [
        "npm.cmd",
        "test",
        "--",
        "--force"
      ],
      "exit": 1,
      "qualification": "HISTORICAL_PRE_CLOSURE04__PRIOR_AUTHENTICATED_CLOSURE02__CURRENT_CLOSURE02_ACTUAL_OPEN_RED_NOT_WAIVED",
      "logSha256": "fb6d0af6442a5b227c1fe5b60b74580ef9f613f0c39bc468c814b6caf6836348"
    },
    {
      "command": [
        "npm.cmd",
        "run",
        "typecheck",
        "--",
        "--force"
      ],
      "exit": 0,
      "qualification": "HISTORICAL_PRE_CLOSURE04__PRIOR_AUTHENTICATED_CLOSURE02__CURRENT_CLOSURE02_ACTUAL_PASS_NOT_ACCEPTANCE",
      "logSha256": "a5f3246422a4fc24de53a617809b12b6e3c66e43328d9c5a15c51201884d91b4"
    },
    {
      "command": [
        "npm.cmd",
        "run",
        "lint",
        "--",
        "--force"
      ],
      "exit": 0,
      "qualification": "HISTORICAL_PRE_CLOSURE04__PRIOR_AUTHENTICATED_CLOSURE02__CURRENT_CLOSURE02_ACTUAL_PASS_NOT_ACCEPTANCE",
      "logSha256": "568c62ad1c2380303fe0ad58fbdd22c1ca7187f06766ef0231937050e883017f"
    },
    {
      "command": [
        "node",
        "--test",
        "scripts/core04/persistence-source-contract.test.mjs",
        "scripts/core06/recommendation-admission-source-contract.test.mjs"
      ],
      "exit": 1,
      "qualification": "HISTORICAL_PRE_CLOSURE04__PRIOR_AUTHENTICATED_CLOSURE02__CURRENT_CLOSURE02_ACTUAL_OPEN_RED_NOT_WAIVED",
      "logSha256": "e7c6fbb57d245b7a3240302dda786591d94caa5e14dd0c410f6c12f41656ada4"
    },
    {
      "command": "restart-marker-rollback-adversarial-red.log",
      "exit": 1,
      "qualification": "HISTORICAL_PRE_CLOSURE04__PRIOR_AUTHENTICATED_CLOSURE02__CURRENT_CLOSURE02_GENUINE_RED_OR_FAILED_REPLAY_NOT_ACCEPTED",
      "logSha256": "6298c0dbc742d7648cfcbad8161032d567461b4ef0978c237ac2cc392881912a"
    },
    {
      "command": "prearm-confirmed-retention-adversarial-red.log",
      "exit": 1,
      "qualification": "HISTORICAL_PRE_CLOSURE04__PRIOR_AUTHENTICATED_CLOSURE02__CURRENT_CLOSURE02_GENUINE_RED_OR_FAILED_REPLAY_NOT_ACCEPTED",
      "logSha256": "85391f222cb4f7141f7e193fd4e6eb84922d79bb28fdcf99ac72a04f237be401"
    },
    {
      "command": "cleanup-fence-full-diagnostic.log",
      "exit": 1,
      "qualification": "HISTORICAL_PRE_CLOSURE04__PRIOR_AUTHENTICATED_CLOSURE02__CURRENT_CLOSURE02_GENUINE_RED_OR_FAILED_REPLAY_NOT_ACCEPTED",
      "logSha256": "972d098223bef26ff03ef8da296b6e23906b2f80bfe6052eec30a1abc1bfe6d5"
    },
    {
      "command": "historical45-closure02.log",
      "exit": 1,
      "qualification": "HISTORICAL_PRE_CLOSURE04__PRIOR_AUTHENTICATED_CLOSURE02__CURRENT_CLOSURE02_GENUINE_RED_OR_FAILED_REPLAY_NOT_ACCEPTED",
      "logSha256": "1bbf80e7e4fd29af035e554969d54a7884c7c6cbf99ceaff0534bd6bd3192706"
    },
    {
      "command": "actual browser smoke375x812",
      "exit": null,
      "qualification": "HISTORICAL_PRE_CLOSURE04__BRAIN_C45_SOURCE_CLOSURE_02_EXPLICIT_SOURCE_ONLY_EXCEPTION_NOT_VERIFIED_NO_BROWSER_RETRY",
      "logSha256": null
    },
    {
      "command": [
        "npm.cmd",
        "test",
        "--",
        "--force"
      ],
      "exit": 0,
      "qualification": "HISTORICAL_PRE_CLOSURE04__REPAIR03_INTERIM_ACTUAL_RAW_NOT_FROZEN_OR_ACCEPTED",
      "logSha256": "e8b12126d1c069a25d5e0afa624bd1ec284b648ac607c1fa25d0f77fcceefc98"
    },
    {
      "command": [
        "npm.cmd",
        "--workspace",
        "apps/mobile",
        "run",
        "test",
        "--",
        "src/features/routine/planHistory45.test.ts",
        "src/features/routine/planHistory45Encrypted.test.ts",
        "src/features/routine/planSourceFence44.test.ts",
        "src/features/routine/usePlan.test.ts",
        "src/features/routine/orderStore.test.ts",
        "src/features/routine/planRecovery.test.ts",
        "src/lib/storage/privateKVSourceFence44.test.ts",
        "src/lib/storage/privateKV.test.ts",
        "src/lib/auth/localAccountIsolation.test.ts",
        "src/lib/auth/sessionOwner.test.ts",
        "src/lib/auth/accountGeneration.test.ts",
        "src/features/settings/localPrivateDataFence44.test.ts",
        "src/features/settings/localPrivateData.test.ts",
        "src/features/settings/localDeviceExport.test.ts",
        "src/features/settings/localPrivateDataKeys.test.ts",
        "src/lib/consent/healthDataWriteAdmission.test.ts",
        "src/lib/consent/withdrawal.test.ts",
        "src/features/photos/encryptedStorage.test.ts",
        "src/features/photos/store.test.ts"
      ],
      "exit": 1,
      "qualification": "HISTORICAL_PRE_CLOSURE04__REPAIR03_FINAL_ACTUAL_RAW_NOT_FROZEN_OR_ACCEPTED__repair03-final-encrypted-selection.receipt",
      "logSha256": "22e34a7d24cf1603e23edfc7a9894ce7f73100a0ed21a9471624b97b391807c4"
    },
    {
      "command": [
        "python",
        "-I",
        "-B",
        "scripts/release/full-app-j01/main_integration45.test.py"
      ],
      "exit": 0,
      "qualification": "HISTORICAL_PRE_CLOSURE04__REPAIR03_FINAL_ACTUAL_RAW_NOT_FROZEN_OR_ACCEPTED__repair03-final-finite-tests.receipt",
      "logSha256": "cf65bd30517b8c120a742124142d75934d71348011693705a9d1de4210ae49ba"
    },
    {
      "command": [
        "npm.cmd",
        "run",
        "lint",
        "--",
        "--force"
      ],
      "exit": 0,
      "qualification": "HISTORICAL_PRE_CLOSURE04__REPAIR03_FINAL_ACTUAL_RAW_NOT_FROZEN_OR_ACCEPTED__repair03-final-lint.receipt",
      "logSha256": "d0d158365cb0a46522abf97fd0c216446c4919fc93bef6cb3ec6239a61fc27f3"
    },
    {
      "command": [
        "npm.cmd",
        "test",
        "--",
        "--force"
      ],
      "exit": 1,
      "qualification": "HISTORICAL_PRE_CLOSURE04__REPAIR03_FINAL_ACTUAL_RAW_NOT_FROZEN_OR_ACCEPTED__repair03-final-root-tests.receipt",
      "logSha256": "1b369d78967ae84c698dcdfdc544cee4387302becd5ade23daa2148d9f469492"
    },
    {
      "command": [
        "node",
        "--test",
        "scripts/launch/formula-route-inventory39.test.mjs"
      ],
      "exit": 0,
      "qualification": "HISTORICAL_PRE_CLOSURE04__REPAIR03_FINAL_ACTUAL_RAW_NOT_FROZEN_OR_ACCEPTED__repair03-final-route-inventory.receipt",
      "logSha256": "a2705d0684c35b206aade0e78d29c5eca1954369fc83ae710b6324caf69a424e"
    },
    {
      "command": [
        "python",
        "-I",
        "-B",
        "scripts/release/full-app-j01/source_consumer45.test.py"
      ],
      "exit": 0,
      "qualification": "HISTORICAL_PRE_CLOSURE04__REPAIR03_FINAL_ACTUAL_RAW_NOT_FROZEN_OR_ACCEPTED__repair03-final-source-consumer.receipt",
      "logSha256": "997f9dffde93cf3f0c9d4e61c791e995ea52d5a7d02997b0773bb1bcd8e1bc82"
    },
    {
      "command": [
        "npm.cmd",
        "run",
        "typecheck",
        "--",
        "--force"
      ],
      "exit": 0,
      "qualification": "HISTORICAL_PRE_CLOSURE04__REPAIR03_FINAL_ACTUAL_RAW_NOT_FROZEN_OR_ACCEPTED__repair03-final-typecheck.receipt",
      "logSha256": "9655103d5a6e3a89d1da808822d0bc9ca916866e51e91ec0964707d21988dba6"
    },
    {
      "command": [
        "node",
        "--test",
        "scripts/core04/persistence-source-contract.test.mjs",
        "scripts/core06/recommendation-admission-source-contract.test.mjs"
      ],
      "exit": 1,
      "qualification": "HISTORICAL_PRE_CLOSURE04__REPAIR03_PROTECTED24_OF26_SAME_TWO_OPEN_FAILURES_UNWAIVED",
      "logSha256": "6f1a1c30dd3eaf3f76df45e1181471d13930bcc00bba73112efdd199ee7d4fcf"
    },
    {
      "command": "bottle-fixed-isolated.log",
      "exit": 0,
      "qualification": "C04_RAW_ACTUAL_BOTTLE15_NOT_FINAL_SOURCE_ACCEPTANCE",
      "logSha256": "84bcce9f8e6ba1cae0a8a4daffedef0ed09962ed364319b95356ea459875c5e4"
    },
    {
      "command": "bottle-fixed-storage-shelf.log",
      "exit": 0,
      "qualification": "C04_RAW_ACTUAL_BOTTLE_SHELF_STORAGE170_NOT_FINAL_SOURCE_ACCEPTANCE",
      "logSha256": "9e8b22c4a0d8e6b060bd4f7de5996b3f5fcbcaea8bc8bb73afb40040a000422a"
    },
    {
      "command": "c04-combined-runtime-selection.log",
      "exit": 0,
      "qualification": "C04_RAW_ACTUAL_COMBINED_RUNTIME637_BEFORE_ADDED_READ_GUARDS_NOT_FINAL_SOURCE_ACCEPTANCE",
      "logSha256": "b206de99adc2782fac0b550d0e6dfc27e5dd9010f1887766dc35dca0d354c3eb"
    },
    {
      "command": "unauthenticated-history-read-export-red.log",
      "exit": 1,
      "qualification": "C04_RAW_ACTUAL_GENUINE_NATIVE_PLAINTEXT_AND_EMPTY_READ_EXPORT_RED_NOT_FINAL_SOURCE_ACCEPTANCE",
      "logSha256": "af6dd73ae3607d3ab6bdab2cf66a34a6adfdce6153e9cc2a753eea230813484b"
    },
    {
      "command": "history-native-batch-shape-red.log",
      "exit": 1,
      "qualification": "C04_RAW_ACTUAL_FIRST_BATCH_HARNESS_SPY_ERROR_NOT_ACCEPTED_NOT_FINAL_SOURCE_ACCEPTANCE",
      "logSha256": "d86f31250010c7b8a22638d2a4634be3eb09f5a33f305b1845b749bae38aaf6b"
    },
    {
      "command": "history-native-batch-shape-red2.log",
      "exit": 1,
      "qualification": "C04_RAW_ACTUAL_GENUINE_MISSING_DUPLICATE_BATCH_RED_NOT_FINAL_SOURCE_ACCEPTANCE",
      "logSha256": "632b4ef4cb8857209b3b7683ced7665a8c67740d312e7f0a32bdbbe676fde54d"
    },
    {
      "command": "unexpected-history-row-red.log",
      "exit": 1,
      "qualification": "C04_RAW_ACTUAL_GENUINE_UNEXPECTED_HISTORY_AFTER_HEALTH_CLOSE_RED_NOT_FINAL_SOURCE_ACCEPTANCE",
      "logSha256": "776eddadfbc55df3e71cd2a077f9d69094bdadaa5bbc61c489666dd6e875326e"
    },
    {
      "command": "history-batch-scope-fixed-all.log",
      "exit": 0,
      "qualification": "C04_RAW_ACTUAL_AFFECTED_SIX_FILE278_PASS_NOT_FINAL_SOURCE_ACCEPTANCE",
      "logSha256": "43bb401d35eb543a49bc02a2a6d0c79e91f6997051205edfdef53cabce8b4a59"
    },
    {
      "command": [
        "npm.cmd",
        "test",
        "--",
        "--force"
      ],
      "exit": 0,
      "qualification": "C04_E2_STABLE_ROOT_6939_PASS_0_FAIL_0_CACHE_PRE_FINAL_METADATA",
      "logSha256": "0f8f33e2338c5404fb4ae7ff1227acb37c5298ef1078d2ee859c29466ca0fc5c"
    },
    {
      "command": [
        "npm.cmd",
        "run",
        "typecheck",
        "--",
        "--force"
      ],
      "exit": 0,
      "qualification": "C04_E2_FORCED_TYPECHECK_0_CACHE_PRE_FINAL_METADATA",
      "logSha256": "43b26ec1bef460ff0fd6ecc97e776318178c6e912cc8573a224b9c410d3bc8d8"
    },
    {
      "command": [
        "npm.cmd",
        "run",
        "lint",
        "--",
        "--force"
      ],
      "exit": 0,
      "qualification": "C04_E2_FORCED_LINT_0_CACHE_PRE_FINAL_METADATA",
      "logSha256": "206074c592cfa8bbbffd27c772227a73fa688c6086d061da7cefcaf1f474f55c"
    },
    {
      "command": [
        "node",
        "--test",
        "scripts/launch/formula-route-inventory39.test.mjs"
      ],
      "exit": 0,
      "qualification": "C04_E2_EXACT94_ROUTES_5_PASS_PRE_FINAL_METADATA",
      "logSha256": "c37edc6f55fb0b34d6dabf6e2ea6427b622bf1b88d1b6bfa4eb1c4cd8b741e89"
    },
    {
      "command": [
        "node",
        "--test",
        "scripts/core04/persistence-source-contract.test.mjs",
        "scripts/core06/recommendation-admission-source-contract.test.mjs"
      ],
      "exit": 1,
      "qualification": "C04_E2_PROTECTED24_OF26_SAME_TWO_OPEN_UNWAIVED",
      "logSha256": "cb1019a1030b33101c88126070aefaf4198a8c4fddec73564e933310869088c5"
    },
    {
      "command": [
        "python",
        "-I",
        "-B",
        "scripts/release/full-app-j01/main_integration45.py",
        "--phase",
        "SOURCE_PENDING"
      ],
      "exit": 0,
      "qualification": "C04_E2_SOURCE_PENDING_ONLY_NOT_SEAL_OR_ACCEPTANCE",
      "logSha256": "da1e6e2c37bd22cda7ab75efa089d0c6aed259a34148e7ddea075ea18b2268a2"
    },
    {
      "command": [
        "C:\\Python39\\python.exe",
        "-I",
        "-B",
        "scripts/release/full-app-j01/main_integration44.py",
        "--historical"
      ],
      "exit": 0,
      "qualification": "C04_ACTUAL_COMPLETE_NORMAL_ORIGINAL44_THROUGH29_QUALIFIED_TOOL_FINGERPRINT_LATER_NOT_C45_COMPOSITE_OR_ACCEPTANCE",
      "logSha256": "16efc88d4ec9a04c22e3512266e696a29684294a87dd61fb723c77230a911cfe"
    }
  ],
  "acceptanceGranted": false,
  "admissions": {
    "DB06": false,
    "DB08": false,
    "R2B": false,
    "M103": false,
    "M2": false,
    "NATIVE": false,
    "J01": false,
    "CLINICAL": false,
    "PROVIDER": false,
    "PAID": false,
    "APPLE": false,
    "PUBLIC": false,
    "G97": false
  },
  "release": "NO_GO",
  "qualification": "SOURCE_INTEGRITY_NOT_QUALIFIED_ACCEPTANCE",
  "additionalAuthorization": "BRAIN-C45-MARKER-OWNERSHIP-REPAIR-03",
  "closureAuthorization": "BRAIN-C45-AUTONOMOUS-CLOSURE-04"
}
