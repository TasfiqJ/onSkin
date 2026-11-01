{
  "schema": 1,
  "authority": "BRAIN-M1X-MASTERV2-OWNED-FORMULA-VERSION38-SOURCE-CANDIDATE-01",
  "base": "530da5d8af8c3b74a1675a4cfdffc03dca2ec9c1",
  "baseTree": "034cd0b1708362f377a88dbef24e6fe0ddfbd1e3",
  "planCommit": "619679d8774743176d9c59d2e68561b27f7765b6",
  "sourceHashes": {
    ".github/workflows/quality.yml": "9a5cd3e37819f5c56a31d347259e8980dbc2c714f2ec2827c7513a5ac3f9c317",
    "PROGRESS.md": "922a3aa0f56fd044b4457de79b07ac70dccf9d233fa29ba8461930585dae16e2",
    "apps/mobile/src/app/shelf/[id].tsx": "3b2e5413dcb41df26a96dca3499a7a0fc6ecbd804aff32209cc6611527f9921a",
    "apps/mobile/src/app/shelf/_layout.tsx": "a1cd0d1e1393593e65c4589c628e8befe7b39bade812c42e65974141d2a00d83",
    "apps/mobile/src/app/shelf/formula-history.tsx": "7203c50f30d49a3203de144851b6184c75f72abbb49129c623377ac18ef02c3e",
    "apps/mobile/src/features/shelf/formulaVersion38.test.ts": "8788a06de8dbf1b5e12f9dc3d29ca9620aa98eade7745853372354297f072daf",
    "apps/mobile/src/features/shelf/formulaVersion38.ts": "21f5b64bd33bc5bb66acb1b304bf493b9ad4f9c894bb0bdea9f304a66be30d70",
    "apps/mobile/src/features/shelf/mutations.ts": "33267719ade4f0312c2b2c1809fded621488957e1fcf1d0651a523399bf5b9c9",
    "apps/mobile/src/features/shelf/mutationsRecovery.test.ts": "34703661402d4baa2bc2d36acd860432ab033de5b9c71baf7c4b67e671a47e88",
    "apps/mobile/src/features/shelf/ownedBottleVersion38.test.ts": "f550a350ea02c2a313b599aae81d7d8a4b95eb9f35798baccc238054e21809a9",
    "apps/mobile/src/features/shelf/ownedBottleVersion38.ts": "7ba9b94542d1f22c0d6587d22dfd998a465f46d1af14ef6aa7c019726c70f6c5",
    "apps/mobile/src/features/shelf/shelfRoutes.test.ts": "0c0dafea3afb414972004d4160b723384cb42fe23a93e9631d7c84cd9c190b7c",
    "apps/mobile/src/features/shelf/store.test.ts": "df93f740de81d090015666d58f2f4f6527e35eb6074ea6d2eed6ac8e65a32e1a",
    "apps/mobile/src/features/shelf/store.ts": "8cc2546a87f48f4ae1667ec48c19ebaee768c68d893a49471ff8363d4d34b118",
    "apps/mobile/src/features/shelf/useShelf.ts": "79532fb77fb1af3f8f615adb1d91805126d2838e793d56eb2341721126274321",
    "docs/USER_FLOW_TREE.md": "50c6f34cd3aebac23eb970ad8a0820053150be97c8c3d7e58fe32fc23b10e414",
    "docs/release/full-app-j01/owned-bottle-formula38.md": "ad03e03a51ed94fc1639423681247bafe364fb4a942f264f7217a49cc777eb21",
    "scripts/e2e/onboarding-first-session.mjs": "db89f5429f6db9c8946bd7b8eb9d69c03286b670d52f3761cbc06e4870282795",
    "scripts/e2e/owned-bottle-formula38.mjs": "a66772bfe28685a882b808ecf8b91751f8456ed20d91f233ffbead2e0024ec82",
    "scripts/e2e/owned-bottle-formula38.test.mjs": "e79a2ae24353b20f203ff567063fc0489f5a0d94aaf4e739d1289326ca474721",
    "scripts/release/full-app-j01/main_integration38.py": "e54d1a467d9db6fb87a4a7f4f29bb1dd06d7167c6de851ec285d30476c1d5f74",
    "scripts/release/full-app-j01/main_integration38.test.py": "df3e3edea886fdaadf7706c0633e031decbb47f4a4ba4496ed90142b595727d8",
    "scripts/release/full-app-j01/source_consumer38.test.py": "04d7777e2a12d519b3a610d04333c439027c6bd47608bb9a3affa67c09c98f91"
  },
  "commands": [
    {
      "command": [
        "python",
        "-B",
        "verify_packet.py",
        "--expected-manifest-sha256",
        "c108b5a4cb67ee80da9b3c52df547abeee038a1920593969267e1dd9a7e1a053"
      ],
      "exit": 0,
      "qualification": "AUTHENTICATED_SMALL_CONTEXT_ONLY_NOT_C37_ARCHIVE",
      "logSha256": "25553cb6e21f5ce65f945acfa78619536edcfdc0671aac3af222c08d747d24ba"
    },
    {
      "command": [
        "node",
        "--test",
        "scripts/core04/persistence-source-contract.test.mjs",
        "scripts/core06/recommendation-admission-source-contract.test.mjs"
      ],
      "exit": 1,
      "qualification": "ACTUAL_COMMAND_SOURCE_CANDIDATE_ONLY; REAL_FAILURE_RETAINED_NOT_WAIVED",
      "logSha256": "beb363256bd75e453610c90c6278ca60f5a05a9f39de50f61682361cea09eecb"
    },
    {
      "command": [
        "C:\\Python39\\python.exe",
        "-I",
        "-B",
        "scripts/release/full-app-j01/main_integration38.test.py"
      ],
      "exit": 0,
      "qualification": "ACTUAL_COMMAND_SOURCE_CANDIDATE_ONLY",
      "logSha256": "f3148f7de731844bb0feea81bd6d7b944e5c87da66ad360b9acc41824603124a"
    },
    {
      "command": [
        "C:\\Python39\\python.exe",
        "-I",
        "-B",
        "scripts/release/full-app-j01/source_consumer38.test.py"
      ],
      "exit": 0,
      "qualification": "ACTUAL_COMMAND_SOURCE_CANDIDATE_ONLY",
      "logSha256": "22ca2d593cae3aea809c09d64ab718a61d17f1e1e1c50335327dfabfe460fc8a"
    },
    {
      "command": [
        "C:\\Python39\\python.exe",
        "-I",
        "-B",
        "scripts/release/full-app-j01/main_integration38.test.py"
      ],
      "exit": 0,
      "qualification": "ACTUAL_COMMAND_SOURCE_CANDIDATE_ONLY",
      "logSha256": "7c3fc914d46961887a63b2ab17b77d3beaaf3251b953eb4b44775c7a99c9b4c9"
    },
    {
      "command": [
        "C:\\Python39\\python.exe",
        "-I",
        "-B",
        "scripts/release/full-app-j01/source_consumer38.test.py"
      ],
      "exit": 0,
      "qualification": "ACTUAL_COMMAND_SOURCE_CANDIDATE_ONLY",
      "logSha256": "15c8592796bbfe26cdef730d01b43a362a119b066cb9e044a3b498cc0eef49e2"
    },
    {
      "command": [
        "C:\\Python39\\python.exe",
        "-I",
        "-B",
        "scripts/release/full-app-j01/main_integration38.py",
        "--historical"
      ],
      "exit": 0,
      "qualification": "ACTUAL_COMMAND_SOURCE_CANDIDATE_ONLY",
      "logSha256": "d5b9c07055d0f0e30de9066ae1344c8ec641fc041fcb921ee3e39efcf1f0517e"
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
      "qualification": "ACTUAL_COMMAND_SOURCE_CANDIDATE_ONLY; SOURCE_CHANGED_DURING_DEVELOPMENT_NOT_FINAL_STABLE_PROOF",
      "logSha256": "6acd6fc6b1dcbc2ebfcaa05456ee3dc0697a99b5faf5d604db276af2851ac2b6"
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
      "qualification": "ACTUAL_COMMAND_SOURCE_CANDIDATE_ONLY",
      "logSha256": "ca930a2513769fcb57e569e4bfe8ac1c77124db90eb1e037327566ddd69d6e82"
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
      "qualification": "ACTUAL_COMMAND_SOURCE_CANDIDATE_ONLY; FINAL_APP_CODE_STABLE_ZERO_TURBO_CACHE_HITS",
      "logSha256": "a37f99d2941ba9b6d556046471900b456ea4cc595278493cc21687b1e0393e53"
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
      "qualification": "ACTUAL_COMMAND_SOURCE_CANDIDATE_ONLY",
      "logSha256": "36fc8cde4bd9ec517812160b0bbc618f2c014b393fbae1e4f61f046f319138f6"
    },
    {
      "command": [
        "npm.cmd",
        "--workspace",
        "apps/mobile",
        "run",
        "test",
        "--",
        "src/features/shelf/mutationsRecovery.test.ts",
        "src/features/shelf/shelfRoutes.test.ts"
      ],
      "exit": 0,
      "qualification": "ACTUAL_COMMAND_SOURCE_CANDIDATE_ONLY",
      "logSha256": "86d1a9ce14f7b6e54022141772a7f437e7f21634d928a4c28ed0015d85e2f9f3"
    },
    {
      "command": [
        "npm.cmd",
        "ci"
      ],
      "exit": 0,
      "qualification": "ACTUAL_COMMAND_SOURCE_CANDIDATE_ONLY",
      "logSha256": "2695e966429e4694fc36836000329b3fd74b4c0e43c5f8ec90cf127faa3489e4"
    },
    {
      "command": [
        "npm.cmd",
        "run",
        "postinstall:check"
      ],
      "exit": 0,
      "qualification": "ACTUAL_COMMAND_SOURCE_CANDIDATE_ONLY",
      "logSha256": "5dd8278bf0b53f3b6607c8bd1e2a69a4cef4d30a54b304d2c660232f1be652b7"
    },
    {
      "command": [
        "node",
        "--test",
        "scripts/core04/persistence-source-contract.test.mjs",
        "scripts/core06/recommendation-admission-source-contract.test.mjs"
      ],
      "exit": 1,
      "qualification": "ACTUAL_COMMAND_SOURCE_CANDIDATE_ONLY; REAL_FAILURE_RETAINED_NOT_WAIVED; EXACT_PR40_COMPARATOR",
      "logSha256": "a6afc01f01df7b24ffec68aa1ff93c1d3de22ae11f506554f144ad4b7e83dbb2"
    },
    {
      "command": [
        "npm.cmd",
        "test",
        "--",
        "--force"
      ],
      "exit": 0,
      "qualification": "ACTUAL_COMMAND_SOURCE_CANDIDATE_ONLY",
      "logSha256": "237d2c8c618d8479002c87595ce9c75002c6262c1e9007a1df676cd4db26271b"
    },
    {
      "command": [
        "npm.cmd",
        "test",
        "--",
        "--force"
      ],
      "exit": 0,
      "qualification": "ACTUAL_COMMAND_SOURCE_CANDIDATE_ONLY; FINAL_APP_CODE_STABLE_ZERO_TURBO_CACHE_HITS",
      "logSha256": "46fbb4faae61dd7a57e1dfdb04f5e517b442260a995ef2fbd4f4e55920e28c9b"
    },
    {
      "command": [
        "npm.cmd",
        "test",
        "--",
        "--force"
      ],
      "exit": 0,
      "qualification": "ACTUAL_COMMAND_SOURCE_CANDIDATE_ONLY",
      "logSha256": "18e17fc74ff14fbb7798a1c42016fa7566deb40258fe7973828a9c2179be2c24"
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
      "qualification": "ACTUAL_COMMAND_SOURCE_CANDIDATE_ONLY",
      "logSha256": "55b4a003c0116725758df61bd7814a2564db8b9a6b0681a4976d0dcd153f69c0"
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
      "qualification": "ACTUAL_COMMAND_SOURCE_CANDIDATE_ONLY",
      "logSha256": "01f6e279c22422f6ba5766b6597bb2435edd89981d0a7a279d57b5bd5ec66b26"
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
      "qualification": "ACTUAL_COMMAND_SOURCE_CANDIDATE_ONLY; FINAL_APP_CODE_STABLE_ZERO_TURBO_CACHE_HITS",
      "logSha256": "ca182994a4c5f6cdc7ce36b8f2aa9742d860a9e0fa5272496d263d9a2db933b7"
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
      "qualification": "ACTUAL_COMMAND_SOURCE_CANDIDATE_ONLY",
      "logSha256": "44107653fcf85dad79f3ad7176fc60a6439dda00eeefd32395d8c39da69086ef"
    },
    {
      "command": [
        "npm.cmd",
        "--workspace",
        "apps/mobile",
        "run",
        "test",
        "--",
        "src/features/shelf/shelfRoutes.test.ts",
        "src/features/shelf/mutationsRecovery.test.ts"
      ],
      "exit": 0,
      "qualification": "ACTUAL_COMMAND_SOURCE_CANDIDATE_ONLY",
      "logSha256": "19c7240b0c57cc1aab7076c907a0df924071307bfbf844a0f7fd12765e9f59fc"
    },
    {
      "command": "node scripts/e2e/onboarding-first-session.mjs --owned-formula38",
      "exit": 1,
      "qualification": "ACTUAL_SYNTHETIC_OWNER_EXPO_WEB_NOT_NATIVE_OR_ACCEPTANCE; FAILED_ATTEMPT_RETAINED",
      "logSha256": "a885104af45191e4f6477ab3f78d82072ca7e844d532ede76c6dfe86fa329252"
    },
    {
      "command": "node --test scripts/e2e/onboarding-first-session35.test.mjs scripts/e2e/retained-safety-assertions.test.mjs scripts/e2e/compact-shelf-target37.test.mjs scripts/e2e/owned-bottle-formula38.test.mjs",
      "exit": 0,
      "qualification": "ACTUAL_SYNTHETIC_OWNER_EXPO_WEB_NOT_NATIVE_OR_ACCEPTANCE",
      "logSha256": "ddecc5ba9bf5b0ef47cd936227fb580995dd41e223cfbd686eadeff8f6a5b665"
    },
    {
      "command": "node --test scripts/e2e/onboarding-first-session35.test.mjs scripts/e2e/retained-safety-assertions.test.mjs scripts/e2e/compact-shelf-target37.test.mjs scripts/e2e/owned-bottle-formula38.test.mjs",
      "exit": 0,
      "qualification": "ACTUAL_SYNTHETIC_OWNER_EXPO_WEB_NOT_NATIVE_OR_ACCEPTANCE",
      "logSha256": "acba64a469fe369a886b51de5177cba9809a896c1cb9b514bcf10cbeb57c9b7e"
    },
    {
      "command": "node scripts/e2e/onboarding-first-session.mjs --owned-formula38",
      "exit": 1,
      "qualification": "ACTUAL_SYNTHETIC_OWNER_EXPO_WEB_NOT_NATIVE_OR_ACCEPTANCE; FAILED_ATTEMPT_RETAINED",
      "logSha256": "502a8570bd4c0297d8feee71df997fed76b5933725e5df7b280729d833c9c300"
    },
    {
      "command": "node scripts/e2e/onboarding-first-session.mjs --owned-formula38",
      "exit": 1,
      "qualification": "ACTUAL_SYNTHETIC_OWNER_EXPO_WEB_NOT_NATIVE_OR_ACCEPTANCE; FAILED_ATTEMPT_RETAINED",
      "logSha256": "abde43dd7beec982ab6d54a1cde350a01d8bf794fd3d2b83b0b445c91da0f14a"
    },
    {
      "command": "node scripts/e2e/onboarding-first-session.mjs --owned-formula38",
      "exit": 1,
      "qualification": "ACTUAL_SYNTHETIC_OWNER_EXPO_WEB_NOT_NATIVE_OR_ACCEPTANCE; FAILED_ATTEMPT_RETAINED",
      "logSha256": "d4ee09b248ba7c0b5ca8c086e7773978727b2f7739740a8094fd349626066b9a"
    },
    {
      "command": "node scripts/e2e/onboarding-first-session.mjs --owned-formula38",
      "exit": 0,
      "qualification": "ACTUAL_SYNTHETIC_OWNER_EXPO_WEB_NOT_NATIVE_OR_ACCEPTANCE; FINAL_IDENTICAL_APP_HARNESS_BYTES",
      "logSha256": "df73b19d290a0bcbe2e692b23abb052567bfa29c41522a8386adfbcb032b516d"
    },
    {
      "command": "node scripts/e2e/onboarding-first-session.mjs --owned-formula38",
      "exit": 1,
      "qualification": "ACTUAL_SYNTHETIC_OWNER_EXPO_WEB_NOT_NATIVE_OR_ACCEPTANCE; FAILED_ATTEMPT_RETAINED",
      "logSha256": "502a8570bd4c0297d8feee71df997fed76b5933725e5df7b280729d833c9c300"
    },
    {
      "command": "node scripts/e2e/onboarding-first-session.mjs --owned-formula38",
      "exit": 1,
      "qualification": "ACTUAL_SYNTHETIC_OWNER_EXPO_WEB_NOT_NATIVE_OR_ACCEPTANCE; FAILED_ATTEMPT_RETAINED",
      "logSha256": "abde43dd7beec982ab6d54a1cde350a01d8bf794fd3d2b83b0b445c91da0f14a"
    },
    {
      "command": "node scripts/e2e/onboarding-first-session.mjs --owned-formula38",
      "exit": 0,
      "qualification": "ACTUAL_SYNTHETIC_OWNER_EXPO_WEB_NOT_NATIVE_OR_ACCEPTANCE; FINAL_IDENTICAL_APP_HARNESS_BYTES",
      "logSha256": "8085d19d42de70b25d6e172a9b42be042527ab47f5dd08524d7d99f3b9b8be28"
    },
    {
      "command": "node scripts/e2e/onboarding-first-session.mjs --owned-formula38 --formula38-large-text",
      "exit": 1,
      "qualification": "ACTUAL_SYNTHETIC_OWNER_EXPO_WEB_NOT_NATIVE_OR_ACCEPTANCE; FAILED_ATTEMPT_RETAINED",
      "logSha256": "abde43dd7beec982ab6d54a1cde350a01d8bf794fd3d2b83b0b445c91da0f14a"
    },
    {
      "command": "node scripts/e2e/onboarding-first-session.mjs --owned-formula38 --formula38-large-text",
      "exit": 0,
      "qualification": "ACTUAL_SYNTHETIC_OWNER_EXPO_WEB_NOT_NATIVE_OR_ACCEPTANCE; FINAL_IDENTICAL_APP_HARNESS_BYTES",
      "logSha256": "5f010f8d7e1cff9d72f3ca0d2bd7b2ece717da20ec9f099a762e3834fa5f7393"
    },
    {
      "command": [
        "python",
        "-I",
        "-B",
        "scripts/release/full-app-j01/main_integration38.py",
        "--historical"
      ],
      "exit": 0,
      "qualification": "FRESH_EXACT_PR40_ORIGINAL37_AND_AUTHENTIC_NESTED36_TO29; LAUNCHED_WRAPPER_AND_FINAL_REPLAY_FUNCTIONS_BYTE_IDENTICAL",
      "logSha256": "d5b9c07055d0f0e30de9066ae1344c8ec641fc041fcb921ee3e39efcf1f0517e"
    },
    {
      "command": "Physical signed iPhone / VoiceOver / native process-death / real provider / StoreKit / clinical qualification",
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
