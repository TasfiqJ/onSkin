{
  "schema": 1,
  "authority": "BRAIN-M1X-MASTERV2-FORMULA-ROUTE-INVENTORY39-CORRECTION-01",
  "base": "92f62f60e47237dd1f06750d8f7d9d2006b82617",
  "baseTree": "aea947d237d49cfcdad72ced54213b1f3a6ddf4e",
  "planCommit": "317a1c29ad2bd6dddd601317bbd317654bb9ed11",
  "sourceHashes": {
    ".github/workflows/quality.yml": "f24c49a0da9997455a11a99346a17db5a744d7bba269d2021936d3b91cc5f5fd",
    "PROGRESS.md": "29998bccdc23bd8c215fc7cd8b0ba8ce969733a25b0b230e8d648e611143db14",
    "docs/hugeToDo/feature-inventory.json": "166193bb73f389565aa141848546ee56e6f76967c0fdee3086dcc935772cf8a3",
    "docs/release/full-app-j01/formula-route-inventory39.md": "f3c5b7f39870cbe74499ec3721ae27f06cf4045177ab629fbb5b6267aa5dc287",
    "scripts/launch/formula-route-inventory39.test.mjs": "8044e741b42eb2be2415f15cfdc7f5e944cdf9ced182f119de9d1c288112e214",
    "scripts/release/full-app-j01/main_integration39.py": "5c1cebb4103cdb9b33f172d41f11b2d594734621fedda40f02e37bd91a5b0fb0",
    "scripts/release/full-app-j01/main_integration39.test.py": "f4e5be754831d3d622a18855c73d29627a6b2c8d580da50576c4d170a0350339",
    "scripts/release/full-app-j01/source_consumer39.test.py": "bc4b5b3a08f59533e71fc920edbc282f4386aaf3962952dc17805ee38ae3d973"
  },
  "commands": [
    {
      "command": [
        "C:\\Program Files\\nodejs\\node.exe",
        "C:\\Users\\jasim\\AppData\\Roaming\\npm\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "launch:execution-baseline:check"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "f24255f69626ee3127fffa1f4dd9144bd53f84f185e489717b2479ecdec9399e"
    },
    {
      "command": [
        "C:\\Program Files\\nodejs\\node.exe",
        "C:\\Users\\jasim\\AppData\\Roaming\\npm\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "launch:execution-baseline:smoke"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "88527dac7a7c72dbc0db83a8a43d4029c4d006f5c9faae43c16f3c4d652fb9a2"
    },
    {
      "command": [
        "C:\\Program Files\\nodejs\\node.EXE",
        "--test",
        "scripts/e2e/onboarding-first-session35.test.mjs",
        "scripts/e2e/retained-safety-assertions.test.mjs",
        "scripts/e2e/compact-shelf-target37.test.mjs",
        "scripts/e2e/owned-bottle-formula38.test.mjs"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "c4fe11408c7e62c87670c0ff8ea1dd1a6f492f43608010a3dea4e5e9263a09ab"
    },
    {
      "command": [
        "C:\\Program Files\\nodejs\\node.exe",
        "C:\\Users\\jasim\\AppData\\Roaming\\npm\\node_modules\\npm\\bin\\npm-cli.js",
        "--workspace",
        "apps/mobile",
        "run",
        "test",
        "--",
        "src/features/shelf/formulaVersion38.test.ts",
        "src/features/shelf/ownedBottleVersion38.test.ts",
        "src/features/shelf/shelfRoutes.test.ts",
        "src/features/shelf/store.test.ts",
        "src/features/shelf/mutationsRecovery.test.ts",
        "src/features/shelf/IntakeContext.test.ts",
        "src/lib/storage/privateKV.test.ts",
        "src/features/healthConsent/lifecycleStore.test.ts"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "a9348ec375e4363cbf9d0e9febf1e34b1686c7a4a36275856c78ca88ec600ef4"
    },
    {
      "command": [
        "C:/Python39/python.exe",
        "-I",
        "-B",
        "-c",
        "import importlib.util,json;from pathlib import Path;p=Path('scripts/release/full-app-j01/main_integration37.py');s=importlib.util.spec_from_file_location('original37_diagnostic',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);print(json.dumps(m.verify(),sort_keys=True))"
      ],
      "exit": 1,
      "qualification": "DIAGNOSTIC_DIRECT_UNCHANGED_ORIGINAL37_VERIFY_WITH_EXCEPTION_TRACE_NOT_REPLAY_SUCCESS",
      "logSha256": "6b2a931e6a5538734f9761624247490d1dc61a40a245a97caae39241c63e636a"
    },
    {
      "command": [
        "C:/Python39/python.exe",
        "-I",
        "-B",
        "scripts/release/full-app-j01/main_integration39.py",
        "--historical"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "83d819f394a1fb59a88c474f8f21646df36b68856baafc415e40e4b5ae6d4d56"
    },
    {
      "command": [
        "C:/Python39/python.exe",
        "-I",
        "-B",
        "scripts/release/full-app-j01/main_integration39.py",
        "--historical"
      ],
      "exit": 1,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "97323ea30c9b03d63bd8c33715a051596d5d32ec89e053f7e62953e55096817d"
    },
    {
      "command": [
        "C:\\Program Files\\nodejs\\node.EXE",
        "--test",
        "scripts/launch/formula-route-inventory39.test.mjs"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "5bd4741e522121013a5f44f266a9e78d78279a9349a9bf08b5fc02a2369f3f22"
    },
    {
      "command": [
        "C:\\Program Files\\nodejs\\node.EXE",
        "--test",
        "scripts/launch/full-app-contract33.test.mjs",
        "scripts/launch/candidate-scope34.test.mjs",
        "scripts/launch/consumer-entry34.test.mjs"
      ],
      "exit": 1,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "e4450d00cc4bb0bb33e21d21f6f67930d9af30dae84ad0c623c06945828814e5"
    },
    {
      "command": [
        "C:\\Program Files\\nodejs\\node.exe",
        "C:\\Users\\jasim\\AppData\\Roaming\\npm\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "lint"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "3d78c2c4ea162543b79641ff689d2044c8bfeaf37eca53aaf7b4bd6c0f02eed4"
    },
    {
      "command": [
        "C:/Python39/python.exe",
        "-I",
        "-B",
        "scripts/release/full-app-j01/main_integration39.test.py"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "cb63210830efb974c022ee2339aa7cfe7b622b8d2d665127ef6707749111dcd3"
    },
    {
      "command": [
        "C:\\Program Files\\nodejs\\node.exe",
        "C:\\Users\\jasim\\AppData\\Roaming\\npm\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "postinstall:check"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "5dd8278bf0b53f3b6607c8bd1e2a69a4cef4d30a54b304d2c660232f1be652b7"
    },
    {
      "command": [
        "C:\\Program Files\\nodejs\\node.EXE",
        "scripts/launch/check-contract.mjs",
        "--scope",
        "full-app-j01-v2"
      ],
      "exit": 1,
      "qualification": "ACTUAL_ORIGINAL_OPT_IN_READER_REFUSAL_AT_SEALED_PR41_NOT_CURRENT39_ADMISSION",
      "logSha256": "991e621d9391c5ae05c276b5aa26a902f71a970bf192808f80fab5939f115133"
    },
    {
      "command": [
        "C:\\Program Files\\nodejs\\node.exe",
        "C:\\Users\\jasim\\AppData\\Roaming\\npm\\node_modules\\npm\\bin\\npm-cli.js",
        "test"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "3bb09abbc106b5d2c57f3267673e02df12c5f693c53c029ec947c13f0f45abd9"
    },
    {
      "command": [
        "C:/Python39/python.exe",
        "-I",
        "-B",
        "scripts/release/full-app-j01/source_consumer39.test.py"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "fa23fc7ba631bf3d9e0731d26ae6b6a67faad43324ac6948a409cf1172c273b8"
    },
    {
      "command": [
        "C:\\Program Files\\nodejs\\node.exe",
        "C:\\Users\\jasim\\AppData\\Roaming\\npm\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "typecheck"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "5cfe1d4181aacd68bc5da4e9d76d1ac2cafd07fe5908f5c6519e6aa909a5c640"
    },
    {
      "command": [
        "npm",
        "ci"
      ],
      "exit": 0,
      "qualification": "NORMAL_REVIEWED_INSTALL_ROOT_HOOKS_PASS_EXISTING_SCRIPT_POLICY_PRESERVED",
      "logSha256": "d982ebb12d2fec47d27cd9177c4fcee8412da523d390898084336baa5d01e518"
    },
    {
      "command": [
        "python",
        "-I",
        "-B",
        "verify_packet.py",
        "--expected-manifest-sha256",
        "4d41aac8f9c9d685d29d3db9a35dc327687532bff956c0c6721ac5faa953aa44",
        "--expected-verifier-sha256",
        "8d6358f8157de0cb4f30bd761e10e3c2b151063ff0e3dbe9571bb3261bb75655"
      ],
      "exit": 0,
      "qualification": "EXACT_AUTHENTICATED_SMALL_CONTEXT_CUSTODY_ONLY",
      "logSha256": "2b22e2e0ddf305adb221ddfc6bac4b8bf13ed03091434e5e0b0884c454e49ce6"
    },
    {
      "command": [
        "node",
        "--test",
        "scripts/launch/formula-route-inventory39.test.mjs"
      ],
      "exit": 0,
      "qualification": "ACTUAL_5_OF_5_INCLUDING_ALL_DEFAULT_LEAN_V1_EXPORTS_AND_SNAPSHOTS",
      "logSha256": "16cbc50f78a35311321748d87e49b37e2aad91d1c856cd903fa8e880b4d4b20c"
    },
    {
      "command": [
        "node",
        "scripts/e2e/onboarding-first-session.mjs",
        "--owned-formula38"
      ],
      "exit": 0,
      "qualification": "NEW_C39_REAL_CHROME_EXPO_WEB_RERUN_OF_UNCHANGED_C38_HARNESS; SYNTHETIC_LOCAL_OWNER; NOT_NATIVE_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "17d556114377c983315c0adc631b5bde15b4505474079c52fd58f8b06f945836"
    },
    {
      "command": [
        "node",
        "scripts/e2e/onboarding-first-session.mjs",
        "--owned-formula38",
        "--formula38-large-text"
      ],
      "exit": 0,
      "qualification": "NEW_C39_REAL_CHROME_EXPO_WEB_RERUN_OF_UNCHANGED_C38_HARNESS; SYNTHETIC_LOCAL_OWNER; NOT_NATIVE_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "44fd69dce17da5587452ba31393d8ff8103b2a912cb1de84b2d49e2e14e1e8d1"
    },
    {
      "command": [
        "npm.cmd",
        "run",
        "launch:execution-baseline:check"
      ],
      "exit": 1,
      "qualification": "ACTUAL_PR41_READ_ONLY_AUDIT_ATTEMPT_FAILURES_RETAINED",
      "logSha256": "a43646213f2a6d0d5f80b6826ad70e563238e2ce941f7e6f08a0a346f15bafe3"
    },
    {
      "command": [
        "node",
        "C:\\Users\\jasim\\Documents\\ChatGPT\\Campaign39-20261101\\inventory-audit\\compute.mjs"
      ],
      "exit": 1,
      "qualification": "ACTUAL_PR41_READ_ONLY_AUDIT_ATTEMPT_FAILURES_RETAINED",
      "logSha256": "a00f9c15cd7327d26be94be54ac56a836135471e518f5b5dc00b0a0aca49a771"
    },
    {
      "command": [
        "node",
        "scripts/launch/check-contract.mjs",
        "--json"
      ],
      "exit": 0,
      "qualification": "ACTUAL_PR41_READ_ONLY_AUDIT_ATTEMPT_FAILURES_RETAINED",
      "logSha256": "d395ee5e1178ed64b586ab180c8990389ecf52c639a3dbdf651e548e3a2a25e0"
    },
    {
      "command": [
        "npm.cmd",
        "run",
        "launch:contract:smoke"
      ],
      "exit": 0,
      "qualification": "ACTUAL_PR41_READ_ONLY_AUDIT_ATTEMPT_FAILURES_RETAINED",
      "logSha256": "d62352ac5c2071e79c510325f14c47fd8c8ce4fade5a1f0d7fdd9d9257c00be7"
    },
    {
      "command": [
        "node",
        "C:\\Users\\jasim\\Documents\\ChatGPT\\Campaign39-20261101\\inventory-audit\\compute.mjs"
      ],
      "exit": 0,
      "qualification": "Default unchanged producer does not reset existing execution-status",
      "logSha256": "660181c549ff88c502830b04b66ac68be7ce2df7e8bc7292aab09982a5dd4390"
    },
    {
      "command": [
        "node",
        "--test",
        "scripts/launch/formula-route-inventory39.test.mjs"
      ],
      "exit": 1,
      "qualification": "DEVELOPMENT_ATTEMPT_EXIT1_BEFORE_INVENTORY_WRITE_AND_RESET_ONLY_STATUS_TEST_CORRECTION_FINAL5_OF5_RECORDED_SEPARATELY",
      "logSha256": "6611636bccebcdffb3e62214e7bd6e6e4d33f4d93a4d2451afeb13651b0d691f"
    },
    {
      "command": [
        "C:/Python39/python.exe",
        "-I",
        "-B",
        "scripts/release/full-app-j01/source_consumer39.test.py",
        "-v"
      ],
      "exit": 1,
      "qualification": "DEVELOPMENT_ATTEMPT_EXIT1_MISSING_CANDIDATE_FILENAME_CORRECTED_TO_ACTUAL_PROTECTED_PATH_FINAL13_OF13_SEPARATE",
      "logSha256": "376d2838e1145d088b8c6e6c4d6c68cc5c7b7fe62bceed96cbaa55c6997f8a51"
    },
    {
      "command": [
        "python",
        "-I",
        "-B",
        "C:\\Users\\jasim\\Documents\\ChatGPT\\Campaign39-20261101\\run_check.py",
        "root-test",
        "npm",
        "test"
      ],
      "exit": 1,
      "qualification": "EXTERNAL_RUNNER_UNICODE_PRINT_FAILURE_AFTER_CHILD_TEST_EXIT0_STRUCTURED_ANOMALY_RECEIPT",
      "logSha256": "cba582e671de6cb5bc390a9237dcede1b324e6294d09678da03059d9f2dcd0d2"
    },
    {
      "command": "Signed physical iPhone, VoiceOver, provider/paid/clinical/Apple/public qualification",
      "exit": null,
      "qualification": "NOT_RUN_NOT_AUTHORIZED_NOT_SUBSTITUTED",
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
