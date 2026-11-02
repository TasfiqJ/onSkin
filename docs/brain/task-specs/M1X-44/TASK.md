{
  "schema": 1,
  "authority": "BRAIN-M1X-PLAN-SOURCE-RESET-FENCE44-SOURCE-CANDIDATE-01",
  "base": "302e2b83216e7d100e7da3b3f579ee33db8dc5af",
  "baseTree": "075ee95de6e23282bdaf40890bf7bc5ed8aa7c18",
  "planCommit": "5387a7a2b3b0c5d5f7f04191b74bdaf474d40ab8",
  "sourceHashes": {
    ".github/workflows/quality.yml": "1fb894f68f93c48b85f7ddfb9f59176eca4851e69f261a791b1f291a04deea5d",
    "PROGRESS.md": "3466ee3392ae2947ce07efcd4e6444b0f3ae9b17b34942b93ca497ef758f3d8c",
    "apps/mobile/src/app/index.tsx": "1175367d6e84d1c937d996925499e5ce99891b13bc8683fb4cff257a4f42de10",
    "apps/mobile/src/features/onboarding/healthConsentStore.ts": "dd9a44efb1724c5bbff924a1108f7367cdc64fe19536ad5e47502c2f9a7de111",
    "apps/mobile/src/features/routine/planSourceFence44.test.ts": "1ec61b14e6d73cbc66223e996e12fd010108b692e0607cfa82c87a6dbe159659",
    "apps/mobile/src/features/routine/planSourceFence44.ts": "bf839dc99f068da5a18ded6c14bc2e283e02302eee368122fc2e2a560fe477cd",
    "apps/mobile/src/features/settings/localPrivateData.test.ts": "83dd1b47167c3169b02178740087162af591abf3acd8ddb169ed81312cb55697",
    "apps/mobile/src/features/settings/localPrivateData.ts": "fa25a9ca45dce146fcee48270b8a9335b1bca0133863dce44420705998ec9c7b",
    "apps/mobile/src/features/settings/localPrivateDataFence44.test.ts": "1b8a4d597844cadc8398a7150d833285bec38b3a78a7546855c66a85c2eac8ff",
    "apps/mobile/src/features/settings/settingsRoutes.test.ts": "5ad4abe1aee5270f5c2c0fa35e62345905bff0b28825f2fe8bac0fe8a0a57de4",
    "apps/mobile/src/lib/storage/privateKV.ts": "0c8fa288274a91e022a09c694e6584ede48164189e6e7efd14db4ac9e9aaedac",
    "apps/mobile/src/lib/storage/privateKVSourceFence44.test.ts": "b6d68f5bf5cb97edf1dc94031d6ace694e1d9f42c12ac040a651e66bffad82ef",
    "docs/release/full-app-j01/plan-source-reset-fence44.md": "082b5d716fdc0a2e58ee8573c6ec9624eeabed32fddca44469cd452e4003ac0e",
    "scripts/release/full-app-j01/main_integration44.py": "bce81fb34af2cf210b52f3c35b9712d31cbf0bdd1b428ef7695f6e6617706d35",
    "scripts/release/full-app-j01/main_integration44.test.py": "fbc310dda161a208db179bb7823ddddeb908c1d85a97b389c85880dc16c5fc7c",
    "scripts/release/full-app-j01/source_consumer44.test.py": "60e056780fb495d5b83580721255bb2c38c3cc87ca7dfb1fa9d41a1ded5a195b"
  },
  "commands": [
    {
      "command": [
        "npm.cmd",
        "ci"
      ],
      "exit": 0,
      "qualification": "ACTUAL_NORMAL_NPM_CI_REPOSITORY_HOOKS_PASS_NO_DEPENDENCY_EDITS",
      "logSha256": "f0d3def1714362203db551dface26d005cdd03cd9e05001b176846d6ec5ae0cf"
    },
    {
      "command": [
        "npm.cmd",
        "test"
      ],
      "exit": 0,
      "qualification": "UNTOUCHED_PR44_6638_PASS",
      "logSha256": "e7dc5960a5b43c515503f3efba79ac5a7ddaa83fa025d740ff8a619745111e92"
    },
    {
      "command": [
        "npm.cmd",
        "run",
        "typecheck"
      ],
      "exit": 0,
      "qualification": "UNTOUCHED_PR44_TYPECHECK_PASS",
      "logSha256": "c86473951f2c12aab113097023fa22942858905c773f0f4a6f2d7e3cbd5a9712"
    },
    {
      "command": [
        "npm.cmd",
        "run",
        "lint"
      ],
      "exit": 0,
      "qualification": "UNTOUCHED_PR44_LINT_PASS",
      "logSha256": "6b1c4d4c427ce6442da196047380f8c65d7d70fbca0a5c97f653aac75cb2e631"
    },
    {
      "command": [
        "node",
        "--test",
        "scripts/core04/persistence-source-contract.test.mjs",
        "scripts/core06/recommendation-admission-source-contract.test.mjs"
      ],
      "exit": 1,
      "qualification": "ORIGINAL_PROTECTED_24_PASS_2_FAIL_EXIT1_UNCHANGED",
      "logSha256": "4d6fb2b06da6f199abc53afdae81318515f79da5f4a1685398a8b36adda6ae38"
    },
    {
      "command": [
        "npm.cmd",
        "--workspace",
        "apps/mobile",
        "exec",
        "--",
        "vitest",
        "run",
        "src/lib/storage/privateKVSourceFence44.test.ts",
        "src/lib/storage/privateKV.test.ts"
      ],
      "exit": 1,
      "qualification": "ACTUAL_INITIAL_HARNESS_9_FAIL_69_PASS_IMPORT_ORDER_CORRECTED_NOT_WAIVED",
      "logSha256": "a644105c1b710771b0f0eaa5340d3f011a7ef99f1d4faed7eb013850e3a34fc2"
    },
    {
      "command": [
        "npm.cmd",
        "--workspace",
        "apps/mobile",
        "exec",
        "--",
        "vitest",
        "run",
        "src/lib/storage/privateKVSourceFence44.test.ts",
        "src/lib/storage/privateKV.test.ts"
      ],
      "exit": 0,
      "qualification": "ACTUAL_78_PASS_COMPONENT_ONLY_BEFORE_LATER_COUNTEREXAMPLES",
      "logSha256": "47b4acdbaa7c9b857485894444d95d82cbce78c5db7f6297eb17dc02036da8a9"
    },
    {
      "command": [
        "npm.cmd",
        "--workspace",
        "apps/mobile",
        "exec",
        "--",
        "vitest",
        "run",
        "src/lib/storage/privateKVSourceFence44.test.ts",
        "src/lib/storage/privateKV.test.ts",
        "src/features/routine/planSourceFence44.test.ts"
      ],
      "exit": 0,
      "qualification": "ACTUAL_115_PASS_COMPONENT_ONLY_BEFORE_LATER_COUNTEREXAMPLES",
      "logSha256": "611eaa0db378c23a72d2503a07342ee7fa485c1e01e66d82d26a4fe657227d7d"
    },
    {
      "command": [
        "npm.cmd",
        "run",
        "typecheck"
      ],
      "exit": 2,
      "qualification": "ACTUAL_TEST_GENERIC_TYPE_ERROR_EXIT2_LATER_CORRECTED",
      "logSha256": "436a02ff71dbb449055122423fbe34284add55360160d34819cae0970b90d472"
    },
    {
      "command": [
        "npm.cmd",
        "test",
        "--",
        "--force"
      ],
      "exit": 1,
      "qualification": "ACTUAL_6725_PASS_1_FAIL_ORIGINAL_INSPECTION_CHILD_ETIMEDOUT60000_NOT_WAIVED",
      "logSha256": "74accd411b667e643c8570ec8e406776a3e390bb7befa809393e3f2dc1fcad90"
    },
    {
      "command": [
        "node",
        "--test",
        "scripts/core04/persistence-source-contract.test.mjs",
        "scripts/core06/recommendation-admission-source-contract.test.mjs"
      ],
      "exit": 1,
      "qualification": "ORIGINAL_PROTECTED_24_PASS_2_FAIL_EXIT1_UNCHANGED",
      "logSha256": "aeecabc1e0e880cecd302df728c16915a64d816b5dde41f1573d7d0b82429e57"
    },
    {
      "command": [
        "node",
        "--test",
        "scripts/phase9/health-processor-local-records.test.mjs",
        "scripts/phase9/data-export-local-records.test.mjs"
      ],
      "exit": 1,
      "qualification": "INVALID_COMMAND_REFERENCED_ABSENT_FILES_NOT_A_TEST_PASS",
      "logSha256": "b3a1d674c55476fe7488d62f55f88c5085bcc796819b6671047e45f6e1a9bd6d"
    },
    {
      "command": [
        "node",
        "scripts/phase9/health-processor-inventory-smoke.mjs"
      ],
      "exit": 0,
      "qualification": "ACTUAL_HEALTH_PROCESSOR_INVENTORY_SOURCE_PASS",
      "logSha256": "923ecc6b2f946c786703c22f15f5a1d5b826a150693c7cf877b89939db8e43d2"
    },
    {
      "command": [
        "node",
        "scripts/phase9/privacy-payload-audit.mjs"
      ],
      "exit": 0,
      "qualification": "ACTUAL_PRIVACY_PAYLOAD_SOURCE_PASS",
      "logSha256": "4a44686897735b9ae16d3c42e7fa40593363471a3f65840d87c469b856fefb0a"
    },
    {
      "command": [
        "npm.cmd",
        "test",
        "--",
        "--force"
      ],
      "exit": 1,
      "qualification": "PARTIAL_BLOCKED_ACTUAL_FORCED_ROOT_6727_PASS_3_GENUINE_CLEANUP_FAIL_EXIT1",
      "logSha256": "105607b0393f86fba1e055dd8b67b4a979d9268ee7c9b11a462bbe4a7424f67f"
    },
    {
      "command": [
        "npm.cmd",
        "--workspace",
        "apps/mobile",
        "exec",
        "--",
        "vitest",
        "run",
        "src/lib/storage/privateKV.test.ts",
        "src/lib/storage/privateKVSourceFence44.test.ts",
        "src/features/settings/localPrivateData.test.ts",
        "src/features/settings/localPrivateDataFence44.test.ts",
        "src/features/routine/planSourceFence44.test.ts",
        "src/features/healthConsent/selectiveCleanup.test.ts",
        "src/lib/auth/localAccountIsolation.test.ts",
        "src/features/settings/localDeviceExport.test.ts",
        "src/features/onboarding/healthConsentStore.test.ts",
        "src/features/photos/photoDeleteWithdrawal.c08b2.test.ts",
        "src/features/today/optionalChangeJournal41.test.ts"
      ],
      "exit": 1,
      "qualification": "PARTIAL_BLOCKED_ACTUAL_11_SUITES_225_PASS_3_FAIL_EXIT1",
      "logSha256": "aea09de4f46a07fc3e6e06ae477bd87e79023e691f9ee774fd7b4fd497c2e248"
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
      "qualification": "ACTUAL_FORCED_TYPECHECK_3_TASKS_PASS",
      "logSha256": "67d59a1971c4b84fdf07472bec3b20f0eb80244a70811c3c2d1432e7ba4dae54"
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
      "qualification": "ACTUAL_FORCED_LINT_3_TASKS_PASS",
      "logSha256": "1868f174a739e50d459f7c1da6999dd4d689a494ad205038005bd00a1d3e9b14"
    },
    {
      "command": [
        "python",
        "-I",
        "-B",
        "scripts/release/full-app-j01/main_integration44.test.py"
      ],
      "exit": 0,
      "qualification": "ACTUAL_19_HOSTILE_GOVERNANCE_PASS_SOURCE_ONLY_NOT_SAFETY_ACCEPTANCE",
      "logSha256": "698af5a3d61e98e51a272ed2a44016b98d928512e34042851b1cd07085d3df2d"
    },
    {
      "command": [
        "python",
        "-I",
        "-B",
        "scripts/release/full-app-j01/source_consumer44.test.py"
      ],
      "exit": 0,
      "qualification": "ACTUAL_12_REAL_GIT_CONTROLS_PASS_SOURCE_ONLY_NOT_SAFETY_ACCEPTANCE",
      "logSha256": "eeda4b5716a6039841a0783c0047f917d2d3cfc003a58f130f54bad78469ea00"
    },
    {
      "command": [
        "npm.cmd",
        "--workspace",
        "apps/mobile",
        "run",
        "test",
        "--",
        "src/features/routine/planSourceFence42.test.ts"
      ],
      "exit": 1,
      "qualification": "IMMUTABLE_ORIGINAL_C42_EXACT_PR44_REPRODUCTION_3_PASS_3_FAIL_EXIT1",
      "logSha256": "73324ab0177caf2abf67973cd4ebaeee27f2164b4a07dbc32fec7329ea785096"
    },
    {
      "command": [
        "npm.cmd",
        "--workspace",
        "apps/mobile",
        "run",
        "test",
        "--",
        "src/lib/storage/privateKVSourceFence43.test.ts"
      ],
      "exit": 1,
      "qualification": "IMMUTABLE_ORIGINAL_C43_EXACT_PR44_REPRODUCTION_2_PASS_1_FAIL_EXIT1",
      "logSha256": "4fb4e3ee738cee52604483169e425ea00d688e48a355dd5620ee3bcde36bd120"
    },
    {
      "command": [
        "npm.cmd",
        "--workspace",
        "apps/mobile",
        "run",
        "test",
        "--",
        "src/features/settings/localPrivateDataFence44.test.ts",
        "-t",
        "retires local-consent hashing"
      ],
      "exit": 1,
      "qualification": "ACTUAL_CONSENT_CIPHER_AND_KEY_RESURRECTION_BEFORE_GRANTED_CONSENT_STORE_REPAIR",
      "logSha256": "3918e678311b8076daacce1489991b934894c72245f4460c7971f56efc52a6e8"
    },
    {
      "command": [
        "node",
        "node_modules/vitest/vitest.mjs",
        "run",
        "--config",
        "..\\campaign44-evidence\\cleanup\\overlap-audit\\vitest.config.mjs",
        "-t",
        "AUDIT: failed wider account cleanup"
      ],
      "exit": 1,
      "qualification": "UNRESOLVED_ACTUAL_WIDER_CLEANUP_QUARANTINE_MARKER_LOSS",
      "logSha256": "109299bb45d6e8aa8af40c1f52609e296006d119520e39b2ccc0549df8e57a88"
    },
    {
      "command": [
        "node",
        "node_modules/vitest/vitest.mjs",
        "run",
        "--config",
        "..\\campaign44-evidence\\cleanup\\overlap-audit\\vitest.config.mjs",
        "-t",
        "AUDIT: dev reset cannot clear"
      ],
      "exit": 1,
      "qualification": "UNRESOLVED_ACTUAL_DEV_NATIVE_MARK_BEFORE_ACCOUNT_BEGIN_MARKER_LOSS",
      "logSha256": "0e7ca5872e41e4ffba8c710b55421cc70126f07b19d9c300e5b3902a3817f9d6"
    },
    {
      "command": [
        "node",
        "node_modules/vitest/vitest.mjs",
        "run",
        "--config",
        "..\\campaign44-evidence\\cleanup\\overlap-audit\\vitest.config.mjs",
        "-t",
        "AUDIT: independent direct cleanup"
      ],
      "exit": 1,
      "qualification": "UNRESOLVED_ACTUAL_UNRELATED_OUTER_RELEASE_PHOTO_KEY_RESURRECTION",
      "logSha256": "1483f5505785f2d26af1792c288acc3ec0dbcdb5dfd34528b79e13d049d63ff7"
    },
    {
      "command": [
        "npm.cmd",
        "--workspace",
        "apps/mobile",
        "run",
        "test",
        "--",
        "src/features/settings/localPrivateDataFence44.test.ts",
        "-t",
        "AUDIT:"
      ],
      "exit": 1,
      "qualification": "PARTIAL_BLOCKED_ACTUAL_THREE_ADDITIVE_REGRESSIONS_ALL_FAIL_EXIT1",
      "logSha256": "b8455a546939083b5fe0b44252b1923b59e757faadca80a265cd7f54949a3315"
    },
    {
      "command": [
        "npm.cmd",
        "--workspace",
        "apps/mobile",
        "run",
        "test",
        "--",
        "src/features/settings/localPrivateData.test.ts",
        "src/features/settings/localPrivateDataFence44.test.ts",
        "src/lib/storage/privateKV.test.ts",
        "src/lib/storage/privateKVSourceFence44.test.ts",
        "src/features/routine/planSourceFence44.test.ts",
        "src/features/settings/settingsRoutes.test.ts",
        "src/features/today/optionalChangeJournal41.test.ts",
        "src/features/photos/photoDeleteWithdrawal.c08b2.test.ts",
        "src/features/onboarding/onboardingRoutes.test.ts",
        "src/lib/auth/localAccountIsolation.test.ts",
        "src/features/onboarding/healthConsentStore.test.ts"
      ],
      "exit": 1,
      "qualification": "PARTIAL_BLOCKED_ACTUAL_BROADER_11_SUITE_SELECTION_246_PASS_3_FAIL_EXIT1",
      "logSha256": "aac26f4f16e18b4d80b7a6f4981c144cd9115ebb904fd272119910e76810a7be"
    },
    {
      "command": [
        "C:\\Python39\\python.exe",
        "-I",
        "-B",
        "scripts/release/full-app-j01/main_integration44.py",
        "--historical"
      ],
      "exit": 1,
      "qualification": "ACTUAL_NEW_DRIVER_MISTAKEN_LOCAL_HOSTED_ONLY_BEHAVIOR_REFUSED_DRIVER_CORRECTED",
      "logSha256": "32ce2baa37f6bc0e5ef096649bcaf8da0511c5b9e271e342f50e4f88fbbee634"
    },
    {
      "command": [
        "C:\\Python39\\python.exe",
        "-I",
        "-B",
        "scripts/release/full-app-j01/main_integration44.py",
        "--historical"
      ],
      "exit": 1,
      "qualification": "CANCELLED_SAFETY_BLOCKER_WRAPPER_EXIT1_ORIGINAL41_INTERVAL_PASS_NESTED_SUFFIX_NOT_RUN",
      "logSha256": "4806a35bc35ad8e4b27dfaac4c90fabce031542d53b68f6679f82bbe4f50f68f"
    },
    {
      "command": "Campaign44 worklist/seal/push/PR/service-merge/hosted-CI/native-device",
      "exit": null,
      "qualification": "NOT_RUN_AFTER_DEMONSTRATED_SAFETY_BLOCKER_NO_PR_NO_PUSH_NO_SEAL_NO_DEVICE_ACCEPTANCE",
      "logSha256": null
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
  "qualification": "SOURCE_INTEGRITY_NOT_QUALIFIED_ACCEPTANCE"
}
