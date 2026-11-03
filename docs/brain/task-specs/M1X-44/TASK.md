{
  "schema": 1,
  "authority": "BRAIN-M1X-PLAN-SOURCE-RESET-FENCE44-SOURCE-CANDIDATE-01",
  "base": "302e2b83216e7d100e7da3b3f579ee33db8dc5af",
  "baseTree": "075ee95de6e23282bdaf40890bf7bc5ed8aa7c18",
  "planCommit": "5387a7a2b3b0c5d5f7f04191b74bdaf474d40ab8",
  "sourceHashes": {
    ".github/workflows/quality.yml": "0ea1bbe82006df100ec489d49c575fd61ee5cb9858772584419a5c2933675ec5",
    "PROGRESS.md": "9aafe432348ab16bf7a308cb42f5e2e7943ef80c9b5045db49a4adf49f4e46db",
    "apps/mobile/src/app/index.tsx": "1175367d6e84d1c937d996925499e5ce99891b13bc8683fb4cff257a4f42de10",
    "apps/mobile/src/features/onboarding/healthConsentStore.ts": "dd9a44efb1724c5bbff924a1108f7367cdc64fe19536ad5e47502c2f9a7de111",
    "apps/mobile/src/features/photos/encryptedStorage.test.ts": "32e74505636e458a3a51278943d1863a17e8dd436f832245b3293fa392045db9",
    "apps/mobile/src/features/photos/encryptedStorage.ts": "e7183c615e31e5b84bed589e0d6c6c20d5139ac1e67abaff8e17cf781493dab7",
    "apps/mobile/src/features/routine/planSourceFence44.test.ts": "1ec61b14e6d73cbc66223e996e12fd010108b692e0607cfa82c87a6dbe159659",
    "apps/mobile/src/features/routine/planSourceFence44.ts": "bf839dc99f068da5a18ded6c14bc2e283e02302eee368122fc2e2a560fe477cd",
    "apps/mobile/src/features/settings/localPrivateData.test.ts": "32c17ed335d912a04942de3e8ee8e27a9f71ad4c9c2501f072f662a4a081cd3d",
    "apps/mobile/src/features/settings/localPrivateData.ts": "82b7e2ce6f315e9e14cff5f3bc6f8f7ef2162c3e3635040bd8ace37daf9715be",
    "apps/mobile/src/features/settings/localPrivateDataFence44.test.ts": "e3dca2caf2df468ab9202e49b3498e1e050b8ff4ad3e40bd113609c4da66de52",
    "apps/mobile/src/features/settings/settingsRoutes.test.ts": "5ad4abe1aee5270f5c2c0fa35e62345905bff0b28825f2fe8bac0fe8a0a57de4",
    "apps/mobile/src/lib/auth/accountGeneration.test.ts": "b06bf6ecebdb295819a7cbf263cc846198b2b151febef34c25b4c04bc7b71e01",
    "apps/mobile/src/lib/auth/accountGeneration.ts": "67e0112149e11a883795ad60d27cf9c8b9dfe079dfa6328bcf29c3997540eb1a",
    "apps/mobile/src/lib/auth/localAccountIsolation.test.ts": "858f2f01c7082300e341d6e1dc22c08350ddcfc96e03053d4ce35cac7552df64",
    "apps/mobile/src/lib/auth/localAccountIsolation.ts": "54536c5fe1f9e1fe207359d4824de8b481c0f550fa2bd51a0ee0d901671e7490",
    "apps/mobile/src/lib/auth/sessionOwner.test.ts": "3b4fb9c19c4a2ce27f9e1a93a545d28e93a715242f6b3a4df3f14afdc0f283db",
    "apps/mobile/src/lib/auth/sessionOwner.ts": "96137032c2286422281a5fd9d33d1c950591773b1cddf6875ab17084b29ead1c",
    "apps/mobile/src/lib/storage/privateKV.ts": "0c8fa288274a91e022a09c694e6584ede48164189e6e7efd14db4ac9e9aaedac",
    "apps/mobile/src/lib/storage/privateKVSourceFence44.test.ts": "b6d68f5bf5cb97edf1dc94031d6ace694e1d9f42c12ac040a651e66bffad82ef",
    "docs/release/full-app-j01/plan-source-reset-fence44.md": "f5041d532cfad50cc0af3b17a952fb7f9223c80378d0e0e9931ee74b456cab2e",
    "scripts/release/full-app-j01/main_integration44.py": "faa8527c97f14ded526b83e50eb6da5c93ef7f7e4545125a0f3f0d9d9545987a",
    "scripts/release/full-app-j01/main_integration44.test.py": "5b2e15bc8e0db6b83d05d88ecb4f4f7a323b898e32ff4fbc55f3930473fa18cc",
    "scripts/release/full-app-j01/source_consumer44.test.py": "91e1472bdd2276819f942bde099c7f7cc8a9c23f008e0baeaba3625fb8119b6c"
  },
  "commands": [
    {
      "command": [
        "npm.cmd",
        "ci"
      ],
      "exit": 0,
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__ACTUAL_NORMAL_NPM_CI_REPOSITORY_HOOKS_PASS_NO_DEPENDENCY_EDITS",
      "logSha256": "f0d3def1714362203db551dface26d005cdd03cd9e05001b176846d6ec5ae0cf"
    },
    {
      "command": [
        "npm.cmd",
        "test"
      ],
      "exit": 0,
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__UNTOUCHED_PR44_6638_PASS",
      "logSha256": "e7dc5960a5b43c515503f3efba79ac5a7ddaa83fa025d740ff8a619745111e92"
    },
    {
      "command": [
        "npm.cmd",
        "run",
        "typecheck"
      ],
      "exit": 0,
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__UNTOUCHED_PR44_TYPECHECK_PASS",
      "logSha256": "c86473951f2c12aab113097023fa22942858905c773f0f4a6f2d7e3cbd5a9712"
    },
    {
      "command": [
        "npm.cmd",
        "run",
        "lint"
      ],
      "exit": 0,
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__UNTOUCHED_PR44_LINT_PASS",
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
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__ORIGINAL_PROTECTED_24_PASS_2_FAIL_EXIT1_UNCHANGED",
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
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__ACTUAL_INITIAL_HARNESS_9_FAIL_69_PASS_IMPORT_ORDER_CORRECTED_NOT_WAIVED",
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
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__ACTUAL_78_PASS_COMPONENT_ONLY_BEFORE_LATER_COUNTEREXAMPLES",
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
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__ACTUAL_115_PASS_COMPONENT_ONLY_BEFORE_LATER_COUNTEREXAMPLES",
      "logSha256": "611eaa0db378c23a72d2503a07342ee7fa485c1e01e66d82d26a4fe657227d7d"
    },
    {
      "command": [
        "npm.cmd",
        "run",
        "typecheck"
      ],
      "exit": 2,
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__ACTUAL_TEST_GENERIC_TYPE_ERROR_EXIT2_LATER_CORRECTED",
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
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__ACTUAL_6725_PASS_1_FAIL_ORIGINAL_INSPECTION_CHILD_ETIMEDOUT60000_NOT_WAIVED",
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
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__ORIGINAL_PROTECTED_24_PASS_2_FAIL_EXIT1_UNCHANGED",
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
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__INVALID_COMMAND_REFERENCED_ABSENT_FILES_NOT_A_TEST_PASS",
      "logSha256": "b3a1d674c55476fe7488d62f55f88c5085bcc796819b6671047e45f6e1a9bd6d"
    },
    {
      "command": [
        "node",
        "scripts/phase9/health-processor-inventory-smoke.mjs"
      ],
      "exit": 0,
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__ACTUAL_HEALTH_PROCESSOR_INVENTORY_SOURCE_PASS",
      "logSha256": "923ecc6b2f946c786703c22f15f5a1d5b826a150693c7cf877b89939db8e43d2"
    },
    {
      "command": [
        "node",
        "scripts/phase9/privacy-payload-audit.mjs"
      ],
      "exit": 0,
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__ACTUAL_PRIVACY_PAYLOAD_SOURCE_PASS",
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
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__PARTIAL_BLOCKED_ACTUAL_FORCED_ROOT_6727_PASS_3_GENUINE_CLEANUP_FAIL_EXIT1",
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
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__PARTIAL_BLOCKED_ACTUAL_11_SUITES_225_PASS_3_FAIL_EXIT1",
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
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__ACTUAL_FORCED_TYPECHECK_3_TASKS_PASS",
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
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__ACTUAL_FORCED_LINT_3_TASKS_PASS",
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
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__ACTUAL_19_HOSTILE_GOVERNANCE_PASS_SOURCE_ONLY_NOT_SAFETY_ACCEPTANCE",
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
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__ACTUAL_12_REAL_GIT_CONTROLS_PASS_SOURCE_ONLY_NOT_SAFETY_ACCEPTANCE",
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
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__IMMUTABLE_ORIGINAL_C42_EXACT_PR44_REPRODUCTION_3_PASS_3_FAIL_EXIT1",
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
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__IMMUTABLE_ORIGINAL_C43_EXACT_PR44_REPRODUCTION_2_PASS_1_FAIL_EXIT1",
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
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__ACTUAL_CONSENT_CIPHER_AND_KEY_RESURRECTION_BEFORE_GRANTED_CONSENT_STORE_REPAIR",
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
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__UNRESOLVED_ACTUAL_WIDER_CLEANUP_QUARANTINE_MARKER_LOSS",
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
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__UNRESOLVED_ACTUAL_DEV_NATIVE_MARK_BEFORE_ACCOUNT_BEGIN_MARKER_LOSS",
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
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__UNRESOLVED_ACTUAL_UNRELATED_OUTER_RELEASE_PHOTO_KEY_RESURRECTION",
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
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__PARTIAL_BLOCKED_ACTUAL_THREE_ADDITIVE_REGRESSIONS_ALL_FAIL_EXIT1",
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
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__PARTIAL_BLOCKED_ACTUAL_BROADER_11_SUITE_SELECTION_246_PASS_3_FAIL_EXIT1",
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
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__ACTUAL_NEW_DRIVER_MISTAKEN_LOCAL_HOSTED_ONLY_BEHAVIOR_REFUSED_DRIVER_CORRECTED",
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
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__CANCELLED_SAFETY_BLOCKER_WRAPPER_EXIT1_ORIGINAL41_INTERVAL_PASS_NESTED_SUFFIX_NOT_RUN",
      "logSha256": "4806a35bc35ad8e4b27dfaac4c90fabce031542d53b68f6679f82bbe4f50f68f"
    },
    {
      "command": "Campaign44 worklist/seal/push/PR/service-merge/hosted-CI/native-device",
      "exit": null,
      "qualification": "HISTORICAL_DIAGNOSTIC80_CUTOFF__NOT_RUN_AFTER_DEMONSTRATED_SAFETY_BLOCKER_NO_PR_NO_PUSH_NO_SEAL_NO_DEVICE_ACCEPTANCE",
      "logSha256": null
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
        "AUDIT"
      ],
      "exit": 1,
      "qualification": "RESUMED_INTERMEDIATE_RESUME_CLEANUP_LIFETIME_SUCCESSORS_RAW_RESULT_PRESERVED_NOT_CURRENT_ACCEPTANCE",
      "logSha256": "4e02f2a4b8296d5a808d74a1460d458cf6de420bb1b4979c9021b06827763b76"
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
        "dev reset retries"
      ],
      "exit": 1,
      "qualification": "RESUMED_INTERMEDIATE_RESUME_DEV_FULL_SCOPE_RETRY_RAW_RESULT_PRESERVED_NOT_CURRENT_ACCEPTANCE",
      "logSha256": "79e0a3713f2be9516f39f12c2fc9bd14f8d6c26d61529c15c23de7a6bade182f"
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
        "dev reset retries"
      ],
      "exit": 0,
      "qualification": "RESUMED_INTERMEDIATE_RESUME_DEV_FULL_SCOPE_RETRY2_RAW_RESULT_PRESERVED_NOT_CURRENT_ACCEPTANCE",
      "logSha256": "b882c97e8d2953c0e7f918104f21a5d4955e89c36b75b640f69dcf2c928ff52d"
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
        "AUDIT: dev reset"
      ],
      "exit": 0,
      "qualification": "RESUMED_INTERMEDIATE_RESUME_MARKER_SCHEDULE_SUCCESSOR_RAW_RESULT_PRESERVED_NOT_CURRENT_ACCEPTANCE",
      "logSha256": "7f8b3284e08cd1c9e4a6c7c7d500ee0bf7f82ded4212b4763a5f5be7033d244a"
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
        "existing photo clear"
      ],
      "exit": 0,
      "qualification": "RESUMED_INTERMEDIATE_RESUME_PHOTO_CLEAR_SUCCESSOR_RAW_RESULT_PRESERVED_NOT_CURRENT_ACCEPTANCE",
      "logSha256": "d2c85710b16bfb1de347420a19ba2b01a955b25669ed9bbb221914a0f154d745"
    },
    {
      "command": [
        "npm.cmd",
        "--workspace",
        "apps/mobile",
        "run",
        "test",
        "--",
        "src/features/photos/encryptedStorage.test.ts"
      ],
      "exit": 0,
      "qualification": "RESUMED_INTERMEDIATE_RESUME_PHOTO_OWNED_CLEAR_RAW_RESULT_PRESERVED_NOT_CURRENT_ACCEPTANCE",
      "logSha256": "2c15c91c4e0b4faf8383ebbe88372aac9aa2a7a083fb56dc66b8e09c2510b6d0"
    },
    {
      "command": [
        "node",
        "node_modules/vitest/vitest.mjs",
        "run",
        "--config",
        "../campaign44-resume-evidence/selective-overlap/vitest.config.mjs",
        "-t",
        "AUDIT_RESUME:"
      ],
      "exit": 1,
      "qualification": "RESUMED_INTERMEDIATE_RESUME_SELECTIVE_OVERLAP_RED_RAW_RESULT_PRESERVED_NOT_CURRENT_ACCEPTANCE",
      "logSha256": "dad52adec6848e680da20f364e263465b8c0f62eb60ba8c97d43088cd4be20e8"
    },
    {
      "command": [
        "node",
        "node_modules/vitest/vitest.mjs",
        "run",
        "--config",
        "../campaign44-resume-evidence/selective-overlap/vitest.config.mjs",
        "-t",
        "AUDIT_RESUME:"
      ],
      "exit": 1,
      "qualification": "RESUMED_INTERMEDIATE_RESUME_SELECTIVE_OVERLAP_RED2_RAW_RESULT_PRESERVED_NOT_CURRENT_ACCEPTANCE",
      "logSha256": "2c668cde09445719e57f10e58541ce7d1035ec526148e7485b556e410d475834"
    },
    {
      "command": [
        "node",
        "node_modules/vitest/vitest.mjs",
        "run",
        "--config",
        "../campaign44-resume-evidence/selective-overlap/vitest.config.mjs",
        "-t",
        "AUDIT_RESUME:"
      ],
      "exit": 1,
      "qualification": "RESUMED_INTERMEDIATE_RESUME_SELECTIVE_OVERLAP_RED3_RAW_RESULT_PRESERVED_NOT_CURRENT_ACCEPTANCE",
      "logSha256": "42d4a45b039ad01507e6561815c1b5a90dff4d547221a87883442ef13b1af8ee"
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
        "AUDIT_RESUME"
      ],
      "exit": 0,
      "qualification": "RESUMED_INTERMEDIATE_RESUME_SELECTIVE_SUCCESSORS_RAW_RESULT_PRESERVED_NOT_CURRENT_ACCEPTANCE",
      "logSha256": "0ee517da285bb06985853f5da2c3f43b6d1528a730a8860bab9ac005a66f9888"
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
      "qualification": "EARLIER_COMPLETE_REPLAY_FAILED_AT_ORIGINAL38_EXIT1_CAUSE_UNKNOWN_NOT_WAIVED",
      "logSha256": "5dda893c6389a90f9359a4afa095ddad934f680f17ac68afc575dbde7f187467"
    },
    {
      "command": [
        "C:\\Python39\\python.exe",
        "-I",
        "-B",
        "C:\\Users\\jasim\\Documents\\ChatGPT\\MasterV2Code\\campaign44_historical38_diagnosis.py",
        "--child"
      ],
      "exit": 0,
      "qualification": "STANDALONE_UNCHANGED_ORIGINAL38_DIAGNOSIS_PASS_NOT_A_COMPLETE_REPLAY",
      "logSha256": "4e5de217a88463c0e7796f1ba2b5bd8f6fc6e479e4156259a77783c4a8362365"
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
        "src/features/settings/localPrivateDataFence44.test.ts",
        "src/lib/auth/sessionOwner.test.ts",
        "src/lib/auth/localAccountIsolation.test.ts",
        "src/features/settings/localPrivateData.test.ts",
        "src/features/today/optionalChangeJournal41.test.ts"
      ],
      "exit": 1,
      "qualification": "RESUMED_ACTUAL_APPROVED_SCOPE_CLEANUP_PROGRESS_RAW_EXIT_1_NOT_OWNER_ACCEPTANCE",
      "logSha256": "1975cd3bf994b4967abebe4e4eba81a737c0b70bd149f8f1cf69bbc7cd2f318a"
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
        "src/lib/auth/sessionOwner.test.ts",
        "src/lib/auth/localAccountIsolation.test.ts",
        "src/features/settings/localPrivateData.test.ts",
        "src/lib/storage/privateKVSourceFence44.test.ts",
        "src/lib/storage/privateKV.test.ts",
        "src/features/routine/planSourceFence44.test.ts",
        "src/features/today/optionalChangeJournal41.test.ts"
      ],
      "exit": 0,
      "qualification": "RESUMED_ACTUAL_AUTHORIZED_MARKER_STORAGE_CONTROLS_RAW_EXIT_0_NOT_OWNER_ACCEPTANCE",
      "logSha256": "eb59f210bb4eb3bc5f1ca29e6540d2e51ac0c228d31bb5b10ea0b97535b3c421"
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
        "src/lib/auth/sessionOwner.test.ts",
        "src/lib/auth/localAccountIsolation.test.ts",
        "src/features/settings/localPrivateData.test.ts",
        "src/features/settings/localPrivateDataFence44.test.ts",
        "src/features/today/optionalChangeJournal41.test.ts"
      ],
      "exit": 1,
      "qualification": "RESUMED_ACTUAL_DEV_FULL_CLEANUP_INTEGRATION_RAW_EXIT_1_NOT_OWNER_ACCEPTANCE",
      "logSha256": "b7bcdfe7dcd4bfa1abf64e48d6e877fef316dbde241d73ed9f6820da709e217e"
    },
    {
      "command": [
        "python",
        "-I",
        "-B",
        "-c",
        "\nimport copy,hashlib,json,runpy,tempfile\nfrom pathlib import Path\nroot=Path.cwd().parent\nb=runpy.run_path(str(root/'campaign44_build_final_return.py'),run_name='custody_helpers_only')\nv=runpy.run_path(str(root/'campaign44_verify_final_return.py'),run_name='verifier_helpers_only')\ntmp=Path(tempfile.mkdtemp(prefix='campaign44-custody-negative-',dir=root))\nresults=[]\ndef test(name,run):\n run();results.append({'case':name,'pass':True})\ndef reject(run):\n try:run()\n except ValueError:return\n raise AssertionError('expected custody rejection')\ndef digest(raw):return hashlib.sha256(raw).hexdigest()\np=tmp/'snapshot.txt';p.write_bytes(b'original')\nassert b['read_regular'](p)==b'original'\np.write_bytes(b'changed!')\ntest('validated-file-reuses-original-snapshot',lambda: b['require'](b['read_regular'](p)==b'original','newbytesused'))\ntest('pinned-reference-reuses-validated-snapshot',lambda: b['require'](b['reference']({'path':str(p),'sha256':digest(b'original')})[1]==b'original','newbytesused'))\ntest('wrong-reference-pin-rejected',lambda:reject(lambda:b['reference']({'path':str(p),'sha256':'0'*64})))\nlog=tmp/'checked.log';log.write_bytes(b'original')\nr=tmp/'checked.json';raw=json.dumps({'exit':0,'log':str(log),'logSha256':digest(b'original')}).encode();r.write_bytes(raw)\nb['receipt']({'path':str(r),'sha256':digest(raw)},'test')\nlog.write_bytes(b'changed!');r.write_bytes(b'X'*len(raw))\ntest('checked-log-and-receipt-snapshots-retained',lambda:b['require'](b['read_regular'](log)==b'original' and b['read_regular'](r)==raw,'checkedbyteschanged'))\nprompt=Path(r'C:/Users/jasim/Downloads/onSkin_Campaign44_FULL_CODEX_PROMPT_2026-11-02.md').read_bytes()\ntest('original36-prompt-accepted',lambda:b['require'](len(b['prompt_grant'](prompt))==36,'grantcount'))\ntest('mutated-full-prompt-rejected',lambda:reject(lambda:b['prompt_grant'](prompt+b'\\n')))\ne3=(root/'campaign44-resume-evidence/explicit-user-scope-extension.json').read_bytes()\ne4=(root/'campaign44-resume-evidence/explicit-user-lifetime-extension.json').read_bytes()\ntest('canonical-three-and-four-grants-accepted',lambda:b['require'](len(b['extension_paths'](e3,3))+len(b['extension_paths'](e4,4))==7,'extensioncount'))\nforged=json.loads(e4);forged['grantedPaths'][0]='apps/mobile/src/lib/auth/ungranted.ts'\ntest('same-count-forged-four-path-grant-rejected',lambda:reject(lambda:b['extension_paths'](json.dumps(forged).encode(),4)))\ntest('changed-canonical-four-path-bytes-rejected',lambda:reject(lambda:b['extension_paths'](e4+b'\\n',4)))\ncontext=(root/'campaign44-resume-evidence/independent-final-runtime-context44.json').read_bytes()\ntest('pinned-independent26-context-accepted',lambda:b['require'](len(b['reviewed_context'](context)['files'])==26,'contextcount'))\nforged=json.loads(context);forged['files']=[]\ntest('forged-empty-reviewed-file-list-rejected',lambda:reject(lambda:b['reviewed_context'](json.dumps(forged).encode())))\nproof=json.loads((root/'campaign44-evidence/diagnostic-current44.log').read_text())\nproof['phase']='SOURCE_FROZEN';proof['sealedHead']=proof['head']\ntest('full-no-admission-schema-accepted-synthetic',lambda:b['validate_source_proof'](proof,proof['head'],proof['tree'],False))\nforged=copy.deepcopy(proof);forged['productScope']['obligations']=[]\ntest('empty-obligations-proof-rejected',lambda:reject(lambda:b['validate_source_proof'](forged,proof['head'],proof['tree'],False)))\nforged=copy.deepcopy(proof);forged['productScope']['obligations'][0]['ownerAdmitted']=True\ntest('owner-admission-upgrade-rejected',lambda:reject(lambda:b['validate_source_proof'](forged,proof['head'],proof['tree'],False)))\nforged=copy.deepcopy(proof);forged['productScope']['unadmittedGates'].pop()\ntest('missing-owner-gate-rejected',lambda:reject(lambda:b['validate_source_proof'](forged,proof['head'],proof['tree'],False)))\nforged=copy.deepcopy(proof);forged['admissions'].pop('PUBLIC')\ntest('missing-higher-admission-key-rejected',lambda:reject(lambda:b['validate_source_proof'](forged,proof['head'],proof['tree'],False)))\np2=tmp/'bounded.txt';p2.write_bytes(b'ab')\ntest('verifier-read-bound-rejected',lambda:reject(lambda:v['snapshot_read'](p2,1)))\nmeta=v['identity'](p2.lstat());p2.write_bytes(b'cd')\ntest('verifier-changed-inventory-member-rejected',lambda:reject(lambda:v['snapshot_read'](p2,2,meta)))\n\nfrom types import SimpleNamespace\nimport io,zipfile\nfixture=json.loads((root/'campaign44-resume-evidence/checks/final-verifier-snapshot16-green.log').read_text())\nvalid=Path(fixture['stage'])/'valid-archive.zip'\ncopy_archive=tmp/'one-view.zip';copy_archive.write_bytes(valid.read_bytes())\nwith zipfile.ZipFile(io.BytesIO(copy_archive.read_bytes())) as source_zip:\n expected_manifest=digest(source_zip.read('manifest.json'))\nzip_constructor=v['zipfile'].ZipFile\nseen=[]\ndef swap_path_after_snapshot(source,*args,**kwargs):\n seen.append(isinstance(source,io.BytesIO))\n copy_archive.write_bytes(b'X'*copy_archive.stat().st_size)\n return zip_constructor(source,*args,**kwargs)\nv['zipfile'].ZipFile=swap_path_after_snapshot\ntry:\n result=v['archive_verify'](copy_archive,SimpleNamespace(expected_manifest_sha256=expected_manifest,expected_verifier_sha256=digest((root/'campaign44_verify_final_return.py').read_bytes())))\nfinally:\n v['zipfile'].ZipFile=zip_constructor\ntest('archive-replacement-after-snapshot-keeps-one-checked-view',lambda:b['require'](seen==[True] and result['status']=='INTEGRITY_VERIFIED','mixedarchiveviews'))\n\nsummary={'status':'PASS','cases':len(results),'qualification':'HELPER_ONLY_CUSTODY_NEGATIVE_CONTROLS_NO_FINAL_BUILD_NO_PRODUCT_ACCEPTANCE','builderSha256':digest((root/'campaign44_build_final_return.py').read_bytes()),'verifierSha256':digest((root/'campaign44_verify_final_return.py').read_bytes()),'outcomes':results}\n(tmp/'outcomes.json').write_text(json.dumps(summary,indent=2)+'\\n')\nprint(json.dumps(dict(summary,stage=str(tmp))))\n"
      ],
      "exit": 0,
      "qualification": "RESUMED_ACTUAL_FINAL_PACKAGER_CUSTODY_FINAL19_RAW_EXIT_0_NOT_OWNER_ACCEPTANCE",
      "logSha256": "b020386f308eb7bf9981e3ca509ccbac358302b65964d4da6e1c24963a5faba6"
    },
    {
      "command": [
        "python",
        "-I",
        "-B",
        "-c",
        "\nimport copy,hashlib,json,runpy,tempfile\nfrom pathlib import Path\nroot=Path.cwd().parent\nb=runpy.run_path(str(root/'campaign44_build_final_return.py'),run_name='custody_helpers_only')\nv=runpy.run_path(str(root/'campaign44_verify_final_return.py'),run_name='verifier_helpers_only')\ntmp=Path(tempfile.mkdtemp(prefix='campaign44-custody-negative-',dir=root))\nresults=[]\ndef test(name,run):\n run();results.append({'case':name,'pass':True})\ndef reject(run):\n try:run()\n except ValueError:return\n raise AssertionError('expected custody rejection')\ndef digest(raw):return hashlib.sha256(raw).hexdigest()\np=tmp/'snapshot.txt';p.write_bytes(b'original')\nassert b['read_regular'](p)==b'original'\np.write_bytes(b'changed!')\ntest('validated-file-reuses-original-snapshot',lambda: b['require'](b['read_regular'](p)==b'original','newbytesused'))\ntest('pinned-reference-reuses-validated-snapshot',lambda: b['require'](b['reference']({'path':str(p),'sha256':digest(b'original')})[1]==b'original','newbytesused'))\ntest('wrong-reference-pin-rejected',lambda:reject(lambda:b['reference']({'path':str(p),'sha256':'0'*64})))\nlog=tmp/'checked.log';log.write_bytes(b'original')\nr=tmp/'checked.json';raw=json.dumps({'exit':0,'log':str(log),'logSha256':digest(b'original')}).encode();r.write_bytes(raw)\nb['receipt']({'path':str(r),'sha256':digest(raw)},'test')\nlog.write_bytes(b'changed!');r.write_bytes(b'X'*len(raw))\ntest('checked-log-and-receipt-snapshots-retained',lambda:b['require'](b['read_regular'](log)==b'original' and b['read_regular'](r)==raw,'checkedbyteschanged'))\nprompt=Path(r'C:/Users/jasim/Downloads/onSkin_Campaign44_FULL_CODEX_PROMPT_2026-11-02.md').read_bytes()\ntest('original36-prompt-accepted',lambda:b['require'](len(b['prompt_grant'](prompt))==36,'grantcount'))\ntest('mutated-full-prompt-rejected',lambda:reject(lambda:b['prompt_grant'](prompt+b'\\n')))\ne3=(root/'campaign44-resume-evidence/explicit-user-scope-extension.json').read_bytes()\ne4=(root/'campaign44-resume-evidence/explicit-user-lifetime-extension.json').read_bytes()\ntest('canonical-three-and-four-grants-accepted',lambda:b['require'](len(b['extension_paths'](e3,3))+len(b['extension_paths'](e4,4))==7,'extensioncount'))\nforged=json.loads(e4);forged['grantedPaths'][0]='apps/mobile/src/lib/auth/ungranted.ts'\ntest('same-count-forged-four-path-grant-rejected',lambda:reject(lambda:b['extension_paths'](json.dumps(forged).encode(),4)))\ntest('changed-canonical-four-path-bytes-rejected',lambda:reject(lambda:b['extension_paths'](e4+b'\\n',4)))\ncontext=(root/'campaign44-resume-evidence/independent-final-runtime-context44.json').read_bytes()\ntest('pinned-independent26-context-accepted',lambda:b['require'](len(b['reviewed_context'](context)['files'])==26,'contextcount'))\nforged=json.loads(context);forged['files']=[]\ntest('forged-empty-reviewed-file-list-rejected',lambda:reject(lambda:b['reviewed_context'](json.dumps(forged).encode())))\nproof=json.loads((root/'campaign44-evidence/diagnostic-current44.log').read_text())\nproof['phase']='SOURCE_FROZEN';proof['sealedHead']=proof['head']\ntest('full-no-admission-schema-accepted-synthetic',lambda:b['validate_source_proof'](proof,proof['head'],proof['tree'],False))\nforged=copy.deepcopy(proof);forged['productScope']['obligations']=[]\ntest('empty-obligations-proof-rejected',lambda:reject(lambda:b['validate_source_proof'](forged,proof['head'],proof['tree'],False)))\nforged=copy.deepcopy(proof);forged['productScope']['obligations'][0]['ownerAdmitted']=True\ntest('owner-admission-upgrade-rejected',lambda:reject(lambda:b['validate_source_proof'](forged,proof['head'],proof['tree'],False)))\nforged=copy.deepcopy(proof);forged['productScope']['unadmittedGates'].pop()\ntest('missing-owner-gate-rejected',lambda:reject(lambda:b['validate_source_proof'](forged,proof['head'],proof['tree'],False)))\nforged=copy.deepcopy(proof);forged['admissions'].pop('PUBLIC')\ntest('missing-higher-admission-key-rejected',lambda:reject(lambda:b['validate_source_proof'](forged,proof['head'],proof['tree'],False)))\np2=tmp/'bounded.txt';p2.write_bytes(b'ab')\ntest('verifier-read-bound-rejected',lambda:reject(lambda:v['snapshot_read'](p2,1)))\nmeta=v['identity'](p2.lstat());p2.write_bytes(b'cd')\ntest('verifier-changed-inventory-member-rejected',lambda:reject(lambda:v['snapshot_read'](p2,2,meta)))\n\nfrom types import SimpleNamespace\nimport io,zipfile\nfixture=json.loads((root/'campaign44-resume-evidence/checks/final-verifier-snapshot16-green.log').read_text())\nvalid=Path(fixture['stage'])/'valid-archive.zip'\ncopy_archive=tmp/'one-view.zip';copy_archive.write_bytes(valid.read_bytes())\nwith zipfile.ZipFile(io.BytesIO(copy_archive.read_bytes())) as source_zip:\n expected_manifest=digest(source_zip.read('manifest.json'))\nzip_constructor=v['zipfile'].ZipFile\nseen=[]\ndef swap_path_after_snapshot(source,*args,**kwargs):\n seen.append(isinstance(source,io.BytesIO))\n copy_archive.write_bytes(b'X'*copy_archive.stat().st_size)\n return zip_constructor(source,*args,**kwargs)\nv['zipfile'].ZipFile=swap_path_after_snapshot\ntry:\n result=v['archive_verify'](copy_archive,SimpleNamespace(expected_manifest_sha256=expected_manifest,expected_verifier_sha256=digest((root/'campaign44_verify_final_return.py').read_bytes())))\nfinally:\n v['zipfile'].ZipFile=zip_constructor\ntest('archive-replacement-after-snapshot-keeps-one-checked-view',lambda:b['require'](seen==[True] and result['status']=='INTEGRITY_VERIFIED','mixedarchiveviews'))\n\nsummary={'status':'PASS','cases':len(results),'qualification':'HELPER_ONLY_CUSTODY_NEGATIVE_CONTROLS_NO_FINAL_BUILD_NO_PRODUCT_ACCEPTANCE','builderSha256':digest((root/'campaign44_build_final_return.py').read_bytes()),'verifierSha256':digest((root/'campaign44_verify_final_return.py').read_bytes()),'outcomes':results}\n(tmp/'outcomes.json').write_text(json.dumps(summary,indent=2)+'\\n')\nprint(json.dumps(dict(summary,stage=str(tmp))))\n"
      ],
      "exit": 0,
      "qualification": "RESUMED_ACTUAL_FINAL_PACKAGER_CUSTODY_NEGATIVE_GREEN_RAW_EXIT_0_NOT_OWNER_ACCEPTANCE",
      "logSha256": "fdddb516b796fba0b4937e5cc688512d06c61fbb0591087901963197272e6b20"
    },
    {
      "command": [
        "python",
        "-I",
        "-B",
        "-c",
        "\nimport copy,hashlib,json,runpy,tempfile\nfrom pathlib import Path\nroot=Path.cwd().parent\nb=runpy.run_path(str(root/'campaign44_build_final_return.py'),run_name='custody_helpers_only')\nv=runpy.run_path(str(root/'campaign44_verify_final_return.py'),run_name='verifier_helpers_only')\ntmp=Path(tempfile.mkdtemp(prefix='campaign44-custody-negative-',dir=root))\nresults=[]\ndef test(name,run):\n run();results.append({'case':name,'pass':True})\ndef reject(run):\n try:run()\n except ValueError:return\n raise AssertionError('expected custody rejection')\ndef digest(raw):return hashlib.sha256(raw).hexdigest()\np=tmp/'snapshot.txt';p.write_bytes(b'original')\nassert b['read_regular'](p)==b'original'\np.write_bytes(b'changed!')\ntest('validated-file-reuses-original-snapshot',lambda: b['require'](b['read_regular'](p)==b'original','newbytesused'))\ntest('pinned-reference-reuses-validated-snapshot',lambda: b['require'](b['reference']({'path':str(p),'sha256':digest(b'original')})[1]==b'original','newbytesused'))\ntest('wrong-reference-pin-rejected',lambda:reject(lambda:b['reference']({'path':str(p),'sha256':'0'*64})))\nlog=tmp/'checked.log';log.write_bytes(b'original')\nr=tmp/'checked.json';raw=json.dumps({'exit':0,'log':str(log),'logSha256':digest(b'original')}).encode();r.write_bytes(raw)\nb['receipt']({'path':str(r),'sha256':digest(raw)},'test')\nlog.write_bytes(b'changed!');r.write_bytes(b'X'*len(raw))\ntest('checked-log-and-receipt-snapshots-retained',lambda:b['require'](b['read_regular'](log)==b'original' and b['read_regular'](r)==raw,'checkedbyteschanged'))\nprompt=Path(r'C:/Users/jasim/Downloads/onSkin_Campaign44_FULL_CODEX_PROMPT_2026-11-02.md').read_bytes()\ntest('original36-prompt-accepted',lambda:b['require'](len(b['prompt_grant'](prompt))==36,'grantcount'))\ntest('mutated-full-prompt-rejected',lambda:reject(lambda:b['prompt_grant'](prompt+b'\\n')))\ne3=(root/'campaign44-resume-evidence/explicit-user-scope-extension.json').read_bytes()\ne4=(root/'campaign44-resume-evidence/explicit-user-lifetime-extension.json').read_bytes()\ntest('canonical-three-and-four-grants-accepted',lambda:b['require'](len(b['extension_paths'](e3,3))+len(b['extension_paths'](e4,4))==7,'extensioncount'))\nforged=json.loads(e4);forged['grantedPaths'][0]='apps/mobile/src/lib/auth/ungranted.ts'\ntest('same-count-forged-four-path-grant-rejected',lambda:reject(lambda:b['extension_paths'](json.dumps(forged).encode(),4)))\ntest('changed-canonical-four-path-bytes-rejected',lambda:reject(lambda:b['extension_paths'](e4+b'\\n',4)))\ncontext=(root/'campaign44-resume-evidence/independent-final-runtime-context44.json').read_bytes()\ntest('pinned-independent26-context-accepted',lambda:b['require'](len(b['reviewed_context'](context)['files'])==26,'contextcount'))\nforged=json.loads(context);forged['files']=[]\ntest('forged-empty-reviewed-file-list-rejected',lambda:reject(lambda:b['reviewed_context'](json.dumps(forged).encode())))\nproof=json.loads((root/'campaign44-evidence/diagnostic-current44.log').read_text())\nproof['phase']='SOURCE_FROZEN';proof['sealedHead']=proof['head']\ntest('full-no-admission-schema-accepted-synthetic',lambda:b['validate_source_proof'](proof,proof['head'],proof['tree'],False))\nforged=copy.deepcopy(proof);forged['productScope']['obligations']=[]\ntest('empty-obligations-proof-rejected',lambda:reject(lambda:b['validate_source_proof'](forged,proof['head'],proof['tree'],False)))\nforged=copy.deepcopy(proof);forged['productScope']['obligations'][0]['ownerAdmitted']=True\ntest('owner-admission-upgrade-rejected',lambda:reject(lambda:b['validate_source_proof'](forged,proof['head'],proof['tree'],False)))\nforged=copy.deepcopy(proof);forged['productScope']['unadmittedGates'].pop()\ntest('missing-owner-gate-rejected',lambda:reject(lambda:b['validate_source_proof'](forged,proof['head'],proof['tree'],False)))\nforged=copy.deepcopy(proof);forged['admissions'].pop('PUBLIC')\ntest('missing-higher-admission-key-rejected',lambda:reject(lambda:b['validate_source_proof'](forged,proof['head'],proof['tree'],False)))\np2=tmp/'bounded.txt';p2.write_bytes(b'ab')\ntest('verifier-read-bound-rejected',lambda:reject(lambda:v['snapshot_read'](p2,1)))\nmeta=v['identity'](p2.lstat());p2.write_bytes(b'cd')\ntest('verifier-changed-inventory-member-rejected',lambda:reject(lambda:v['snapshot_read'](p2,2,meta)))\nsummary={'status':'PASS','cases':len(results),'qualification':'HELPER_ONLY_CUSTODY_NEGATIVE_CONTROLS_NO_FINAL_BUILD_NO_PRODUCT_ACCEPTANCE','builderSha256':digest((root/'campaign44_build_final_return.py').read_bytes()),'verifierSha256':digest((root/'campaign44_verify_final_return.py').read_bytes()),'outcomes':results}\n(tmp/'outcomes.json').write_text(json.dumps(summary,indent=2)+'\\n')\nprint(json.dumps(dict(summary,stage=str(tmp))))\n"
      ],
      "exit": 0,
      "qualification": "RESUMED_ACTUAL_FINAL_PACKAGER_CUSTODY_NEGATIVE_RAW_EXIT_0_NOT_OWNER_ACCEPTANCE",
      "logSha256": "3c204391e4213b6afdf54d9cd09e95bd7ca38f223f44911b5a69d445e713933f"
    },
    {
      "command": [
        "python",
        "-I",
        "-B",
        "C:/Users/jasim/Documents/ChatGPT/MasterV2Code/campaign44_test_final_return_verifier.py"
      ],
      "exit": 0,
      "qualification": "RESUMED_ACTUAL_FINAL_VERIFIER_SNAPSHOT16_GREEN_RAW_EXIT_0_NOT_OWNER_ACCEPTANCE",
      "logSha256": "2e0699aae36ac31266a78e1b0588eff9b754c4e4901c1eb7ba133a88d10ced53"
    },
    {
      "command": [
        "python",
        "-I",
        "-B",
        "C:/Users/jasim/Documents/ChatGPT/MasterV2Code/campaign44_test_final_return_verifier.py"
      ],
      "exit": 1,
      "qualification": "RESUMED_ACTUAL_FINAL_VERIFIER_SNAPSHOT16_RAW_EXIT_1_NOT_OWNER_ACCEPTANCE",
      "logSha256": "9fa2867f6d148f31a2216887380bccabc2b607d6e18a7a35bd7db5c85219261b"
    },
    {
      "command": [
        "C:\\Python39\\python.exe",
        "-I",
        "-B",
        "scripts/release/full-app-j01/main_integration44.test.py"
      ],
      "exit": 0,
      "qualification": "RESUMED_ACTUAL_GOVERNANCE22_AFTER_CI_ENV_FIX_RAW_EXIT_0_NOT_OWNER_ACCEPTANCE",
      "logSha256": "2f200b9e3faf4ff33dd47b3b392bfdf08ece4816970050e4d39494fb5fbdea76"
    },
    {
      "command": [
        "python",
        "-I",
        "-B",
        "scripts/release/full-app-j01/main_integration44.test.py"
      ],
      "exit": 0,
      "qualification": "RESUMED_ACTUAL_GOVERNANCE43_BOUNDARIES_RAW_EXIT_0_NOT_OWNER_ACCEPTANCE",
      "logSha256": "0d7ead04daf2c81b0c2ff9e58c7f9c868216c384d9f398355a080514dceafcd1"
    },
    {
      "command": [
        "python",
        "-I",
        "-B",
        "scripts/release/full-app-j01/source_consumer44.test.py"
      ],
      "exit": 0,
      "qualification": "RESUMED_ACTUAL_GOVERNANCE43_SOURCE_CONTROLS_RAW_EXIT_0_NOT_OWNER_ACCEPTANCE",
      "logSha256": "77c8f82da841c3ad9ebb8290cc6f31d6196c683407c59ce31e6404392293de3f"
    },
    {
      "command": [
        "node",
        "scripts/phase9/health-processor-inventory-smoke.mjs"
      ],
      "exit": 0,
      "qualification": "RESUMED_ACTUAL_HEALTH_INVENTORY_FINAL_RAW_EXIT_0_NOT_OWNER_ACCEPTANCE",
      "logSha256": "923ecc6b2f946c786703c22f15f5a1d5b826a150693c7cf877b89939db8e43d2"
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
      "qualification": "RESUMED_ACTUAL_LINT_BEFORE_FREEZE_RAW_EXIT_0_NOT_OWNER_ACCEPTANCE",
      "logSha256": "86d049c248e318b6f49ba0f7747c3ce4b25139f130be815540e31c557a4dc20b"
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
        "src/lib/auth/sessionOwner.test.ts",
        "src/lib/auth/localAccountIsolation.test.ts",
        "src/features/settings/localPrivateData.test.ts"
      ],
      "exit": 0,
      "qualification": "RESUMED_ACTUAL_MARKER_AND_WIDER_SCOPE_RAW_EXIT_0_NOT_OWNER_ACCEPTANCE",
      "logSha256": "e806ded7f3907f208b2eee58fb18ffdfc6c68f225fd4de7b436d202764b4d81d"
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
        "src/features/settings/localPrivateData.test.ts",
        "src/lib/auth/localAccountIsolation.test.ts"
      ],
      "exit": 0,
      "qualification": "RESUMED_ACTUAL_MARKER_CLEANUP_PORTS_RAW_EXIT_0_NOT_OWNER_ACCEPTANCE",
      "logSha256": "052244b6ff3fae91f5cb47da153f3fbb1acb81a618c235e42ffce9ea209107e1"
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
        "src/lib/auth/sessionOwner.test.ts",
        "src/lib/auth/localAccountIsolation.test.ts",
        "src/features/settings/localPrivateDataFence44.test.ts",
        "src/features/settings/localPrivateData.test.ts"
      ],
      "exit": 1,
      "qualification": "RESUMED_ACTUAL_MARKER_INTEGRATION_FIRST_RAW_EXIT_1_NOT_OWNER_ACCEPTANCE",
      "logSha256": "9143390736691ceb41069542d8a816011f0fdfccb7b2f98484584e14a8102788"
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
        "src/features/settings/localPrivateDataFence44.test.ts",
        "src/features/today/optionalChangeJournal41.test.ts",
        "src/features/photos/photoDeleteWithdrawal.c08b2.test.ts",
        "src/features/photos/photoDeleteR3.integration.test.ts",
        "src/lib/auth/sessionOwner.test.ts",
        "src/lib/auth/accountGeneration.test.ts",
        "src/features/photos/encryptedStorage.test.ts"
      ],
      "exit": 1,
      "qualification": "RESUMED_ACTUAL_OWNED_LIFETIME_FIRST_INTEGRATION_RAW_EXIT_1_NOT_OWNER_ACCEPTANCE",
      "logSha256": "eeca4bd339411bb408bc2fc1711722eea12a5251975c74caf9a2a0ba797fdeca"
    },
    {
      "command": [
        "node",
        "scripts/phase9/privacy-payload-audit.mjs"
      ],
      "exit": 0,
      "qualification": "RESUMED_ACTUAL_PRIVACY_SOURCE_FINAL_RAW_EXIT_0_NOT_OWNER_ACCEPTANCE",
      "logSha256": "4a44686897735b9ae16d3c42e7fa40593363471a3f65840d87c469b856fefb0a"
    },
    {
      "command": [
        "node",
        "--test",
        "scripts/core04/persistence-source-contract.test.mjs",
        "scripts/core06/recommendation-admission-source-contract.test.mjs"
      ],
      "exit": 1,
      "qualification": "RESUMED_ACTUAL_PROTECTED_CORE_BEFORE_FREEZE_RAW_EXIT_1_NOT_OWNER_ACCEPTANCE",
      "logSha256": "a052c1edd0e8bd8b3fff330470df5aa62038e913dbf2372a83e161db3410dc9b"
    },
    {
      "command": [
        "npm.cmd",
        "test",
        "--",
        "--force"
      ],
      "exit": 0,
      "qualification": "RESUMED_ACTUAL_ROOT_BEFORE_FREEZE_RAW_EXIT_0_NOT_OWNER_ACCEPTANCE",
      "logSha256": "b690b201bf2b378ee4f105660b91dd3c07a5f4eed097929f9bc07fe27e6c3488"
    },
    {
      "command": [
        "npm.cmd",
        "run",
        "test",
        "--",
        "--force"
      ],
      "exit": 0,
      "qualification": "RESUMED_ACTUAL_ROOT_FINAL_RUNTIME_RAW_EXIT_0_NOT_OWNER_ACCEPTANCE",
      "logSha256": "2f3d0c385b679aec9b120c96c3e8649c4a1a485dcd48aef90765cccc1df1cb71"
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
        "src/features/settings/localPrivateDataFence44.test.ts",
        "src/features/settings/localPrivateData.test.ts",
        "src/features/today/optionalChangeJournal41.test.ts",
        "src/features/photos/photoDeleteWithdrawal.c08b2.test.ts",
        "src/features/photos/photoDeleteR3.integration.test.ts",
        "src/lib/auth/sessionOwner.test.ts",
        "src/lib/auth/localAccountIsolation.test.ts",
        "src/lib/auth/accountGeneration.test.ts",
        "src/features/photos/encryptedStorage.test.ts",
        "src/features/routine/planSourceFence44.test.ts",
        "src/lib/storage/privateKVSourceFence44.test.ts",
        "src/lib/storage/privateKV.test.ts"
      ],
      "exit": 0,
      "qualification": "RESUMED_ACTUAL_SAFETY_COMPLETE_FOCUSED_GREEN_RAW_EXIT_0_NOT_OWNER_ACCEPTANCE",
      "logSha256": "8a67947ea84cacb0324d0775c55a876b5a0ac1965cccb8f60ecbddfa7c212418"
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
        "src/features/settings/localPrivateDataFence44.test.ts",
        "src/features/settings/localPrivateData.test.ts",
        "src/features/today/optionalChangeJournal41.test.ts",
        "src/features/photos/photoDeleteWithdrawal.c08b2.test.ts",
        "src/features/photos/photoDeleteR3.integration.test.ts",
        "src/lib/auth/sessionOwner.test.ts",
        "src/lib/auth/localAccountIsolation.test.ts",
        "src/lib/auth/accountGeneration.test.ts",
        "src/features/photos/encryptedStorage.test.ts",
        "src/features/routine/planSourceFence44.test.ts",
        "src/lib/storage/privateKVSourceFence44.test.ts",
        "src/lib/storage/privateKV.test.ts"
      ],
      "exit": 1,
      "qualification": "RESUMED_ACTUAL_SAFETY_COMPLETE_FOCUSED_RAW_EXIT_1_NOT_OWNER_ACCEPTANCE",
      "logSha256": "ed76f4f048b0adf0a0b3671f1ff02b7e58af058948906c6b14d0685a161f57ee"
    },
    {
      "command": [
        "C:\\Python39\\python.exe",
        "-I",
        "-B",
        "scripts/release/full-app-j01/source_consumer44.test.py"
      ],
      "exit": 0,
      "qualification": "RESUMED_ACTUAL_SOURCE13_AFTER_CI_ENV_FIX_RAW_EXIT_0_NOT_OWNER_ACCEPTANCE",
      "logSha256": "4aa87a657620eb85265dc2a01955f2d1d121ec8e7477b95d40c5c7cdbe73c769"
    },
    {
      "command": [
        "C:\\Python39\\python.exe",
        "-I",
        "-B",
        "scripts/release/full-app-j01/source_consumer44.test.py",
        "SourceControls.test_unchanged_original41_current_reader_refuses_current44_successor"
      ],
      "exit": 0,
      "qualification": "RESUMED_ACTUAL_SYNTHETIC_CI_HARNESS_GREEN_RAW_EXIT_0_NOT_OWNER_ACCEPTANCE",
      "logSha256": "51aa9be86cae83321ab461910b8f978d6d650b6b2a21c605252bfe7a3ff2eed0"
    },
    {
      "command": [
        "C:\\Python39\\python.exe",
        "-I",
        "-B",
        "scripts/release/full-app-j01/source_consumer44.test.py",
        "SourceControls.test_unchanged_original41_current_reader_refuses_current44_successor"
      ],
      "exit": 1,
      "qualification": "RESUMED_ACTUAL_SYNTHETIC_CI_HARNESS_RED_RAW_EXIT_1_NOT_OWNER_ACCEPTANCE",
      "logSha256": "6ddc0b74d8f51ec3c53c30a7c63dba07954f3d3d7451ed6078783e9df6af906f"
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
      "qualification": "RESUMED_ACTUAL_TYPECHECK_BEFORE_FREEZE_RAW_EXIT_0_NOT_OWNER_ACCEPTANCE",
      "logSha256": "3e391be9fbb44212e868caf3624df682d2b16a8099f6cdc9cdd1b832c23b7fe5"
    },
    {
      "command": [
        "node",
        "scripts/e2e/onboarding-first-session.mjs",
        "--daily-loop",
        "--retained-safety",
        "--optional-change41",
        "--owned-formula38"
      ],
      "exit": 0,
      "qualification": "ACTUAL_CHROME_375X812_RETAINED_FLOWS_PASS_SYNTHETIC_WEB_ONLY_NOT_NATIVE_ACCEPTANCE",
      "logSha256": "09aebf59b079b3241ad132ed7c575a957fe33b56b34543ed68c50edba47a6884"
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
      "qualification": "ACTUAL_COMPLETE_FRESH_AUTHENTIC_ORIGINAL41_40_TO_29_PASS_NOT_CURRENT_OWNER_ACCEPTANCE_PRIOR_FAILED_REPLAYS_RETAINED",
      "logSha256": "d174579c38f6e4c1817cefb6fb5d6e99b974725744dc0992f55e40d6f8142f32"
    },
    {
      "command": "Campaign44 final seal/push/new draft PR/service merge/automatic hosted CI/native-device",
      "exit": null,
      "qualification": "PENDING_AT_SUBSTANTIVE_SOURCE_CUTOFF_FINAL_EXTERNAL_REPORT_RECORDS_ACTUAL_OUTCOMES_NATIVE_NOT_RUN",
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
  "qualification": "SOURCE_INTEGRITY_NOT_QUALIFIED_ACCEPTANCE",
  "scopeExtension": {
    "acceptanceGranted": false,
    "grantedPaths": [
      "apps/mobile/src/lib/auth/localAccountIsolation.ts",
      "apps/mobile/src/lib/auth/sessionOwner.ts",
      "apps/mobile/src/lib/auth/sessionOwner.test.ts"
    ],
    "originalPlanCommit": "5387a7a2b3b0c5d5f7f04191b74bdaf474d40ab8",
    "release": "NO_GO",
    "resumesHead": "80b43a41273b6502bb5f1be816d2074d17fddda9",
    "userText": "i grant it\ndo it for me"
  },
  "scopeExtension2": {
    "acceptanceGranted": false,
    "grantedPaths": [
      "apps/mobile/src/lib/auth/accountGeneration.ts",
      "apps/mobile/src/lib/auth/accountGeneration.test.ts",
      "apps/mobile/src/features/photos/encryptedStorage.ts",
      "apps/mobile/src/features/photos/encryptedStorage.test.ts"
    ],
    "originalPlanCommit": "5387a7a2b3b0c5d5f7f04191b74bdaf474d40ab8",
    "previousScopeExtensionSha256": "47ae153955bbeccc552ae8238c389f631048887bc68b802282ab968c5b3d4ef3",
    "release": "NO_GO",
    "resumesHead": "80b43a41273b6502bb5f1be816d2074d17fddda9",
    "userText": "Authorize these four paths"
  }
}
