{
  "schema": 1,
  "authority": "BRAIN-M1X-TODAY-OPTIONAL-CHANGES41-SOURCE-CANDIDATE-01",
  "base": "e3d7e439cd32ccfbe4e5ac4eebcc8d31b007c84c",
  "baseTree": "e87b8701d48ff7862e651d77f127104ee9b94c6a",
  "planCommit": "106354b34afe98eb4c19aa6a392135ef22fbad91",
  "sourceHashes": {
    ".github/workflows/quality.yml": "9252755840759ec8ad5f14454b654c0794797176a430bc577063ab89d76ffe35",
    "PROGRESS.md": "52b778351d09ae9647d06ca1c66e781a07985b31ace6ca987d2db9415a828b01",
    "apps/mobile/src/app/(tabs)/today.tsx": "815f6f0ee88be8dc17bd197fa09a26afe6aadad216f18be4dbdfaf727bb42360",
    "apps/mobile/src/features/today/OptionalChangePanel41.test.tsx": "610ba82a4aa233c22090c83dc83c2fecf8be68159612139461091a6935dc6db3",
    "apps/mobile/src/features/today/OptionalChangePanel41.tsx": "c9b7eeb7fd2bffde9b7e15bd806d738540779709c01791aaa55035abdc5d31c8",
    "apps/mobile/src/features/today/completionsStore.t1.test.ts": "1ebd686ad170307f0fc1a7891eba002e79035edeb0b13f60233387daee46a96a",
    "apps/mobile/src/features/today/completionsStore.ts": "37dcac72b66838fefd05a3a783410e2705d990dc3a7212554a473f725348f9b4",
    "apps/mobile/src/features/today/optionalChange41.test.ts": "6bbc96f5998df412fd947d8fc2c3582cfb5d0abba2388cfde91b417ab2126aad",
    "apps/mobile/src/features/today/optionalChange41.ts": "92b5b4ed021bbb4e6452d6087ca78ba4dcbe2d09cdf4473fd204d4bf0243752e",
    "apps/mobile/src/features/today/optionalChangeJournal41.test.ts": "d45de01454611cdd0128a2289d57bfb83930547a60f74f49c48739c26ba9792e",
    "apps/mobile/src/features/today/optionalChangeJournal41.ts": "7bfc842dd3a0024ad16c53fa5cffa04c5766ecb997e2df3e94cfe726f4bfdbf1",
    "apps/mobile/src/features/today/todayPersistence.t1.test.ts": "406568d2445304ec28098b81ec0dc2aad9b98cad65a9b736e2e0548149ff4e1f",
    "apps/mobile/src/features/today/todayRoute.test.ts": "e7a857b59988331944a970db1813edc37e2429702999f7d0b1a63552d4c338f3",
    "docs/USER_FLOW_TREE.md": "1525743f161ec725f2fe1a812b1e619c1f4ac12dbd60a8a2a089c1c5429cdedf",
    "docs/release/full-app-j01/today-optional-changes41.md": "750ce2dbb64dc18b2d3136eb8db35ba04ac73745336d9952f6797af8257e61a3",
    "scripts/e2e/onboarding-first-session.mjs": "137baa92969042c78ee8c8afd698fdd2b4709952bce7243419b64ee50597be71",
    "scripts/e2e/optional-change41.mjs": "b9bdd7ab00012af6df941d0f4e5518a970e5f1523cea63e637e5afc07a3e5682",
    "scripts/e2e/optional-change41.test.mjs": "4d6147ee85e54446542fe1c93f6084dc509daffd1d203bb57b3f9596b785484c",
    "scripts/release/full-app-j01/main_integration41.py": "6a25a99782978c1cfd88db959069fc7f28e7b8aa679e4a3349884ad68dc5e0f7",
    "scripts/release/full-app-j01/main_integration41.test.py": "daffe64aeb80a35cbcad80555f701fb1a6f08624d923ba1d04ead63c40aa4365",
    "scripts/release/full-app-j01/source_consumer41.test.py": "6f2ed41f5f3c42512a02dd4ca3066d70a99978b78edbc07cf7cab5a527932a61"
  },
  "commands": [
    {
      "command": [
        "npm.cmd",
        "ci",
        "--cache",
        "../npm-cache"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_EXIT; synthetic/source/browser or unsigned export only; no qualified native/owner/release admission",
      "logSha256": "37060db954bfabb7288f96ce998444ebd4a8450bf7532f8e45daa5b089a65b53"
    },
    {
      "command": [
        "npm.cmd",
        "run",
        "postinstall:check"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_EXIT; synthetic/source/browser or unsigned export only; no qualified native/owner/release admission",
      "logSha256": "03140c57adc6c3c7550ee68611f53b56b8de4485994dddcdc2805272f35929e5"
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
      "qualification": "ACTUAL_LOCAL_COMMAND_EXIT; synthetic/source/browser or unsigned export only; no qualified native/owner/release admission",
      "logSha256": "4c4dd18cf1e8a1a6e7700c75b0f2ea73ba1d7bad7c88e87262da74062c9095be"
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
      "qualification": "ACTUAL_LOCAL_COMMAND_EXIT; synthetic/source/browser or unsigned export only; no qualified native/owner/release admission",
      "logSha256": "017957e5bbfc8e8b2842f4fb7bafb8be075b4425df2479b3337e5e1a26ed33fa"
    },
    {
      "command": [
        "npm.cmd",
        "test",
        "--",
        "--force"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_EXIT; synthetic/source/browser or unsigned export only; no qualified native/owner/release admission",
      "logSha256": "cd1ae848301e455fe37fcd36e697d0ec9cc4cb831373f095deabef93e19f3dd6"
    },
    {
      "command": [
        "node",
        "node_modules/vitest/vitest.mjs",
        "run",
        "--config",
        "../evidence/ui-vitest.config.mjs",
        "--passWithNoTests=false"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_EXIT; synthetic/source/browser or unsigned export only; no qualified native/owner/release admission",
      "logSha256": "4aafc2c2cac614cb4d6d7b5e5fd852d6240230d0fbaa22849809f99517671d13"
    },
    {
      "command": [
        "node",
        "--test",
        "scripts/e2e/optional-change41.test.mjs",
        "scripts/e2e/onboarding-first-session35.test.mjs",
        "scripts/e2e/retained-safety-assertions.test.mjs",
        "scripts/e2e/compact-shelf-target37.test.mjs",
        "scripts/e2e/owned-bottle-formula38.test.mjs"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_EXIT; synthetic/source/browser or unsigned export only; no qualified native/owner/release admission",
      "logSha256": "df36358cfbd83728b78672beaa1c112fd4bd7858786f220ebfa80bee394a155c"
    },
    {
      "command": [
        "node",
        "scripts/launch/validate-execution-baseline.mjs"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_EXIT; synthetic/source/browser or unsigned export only; no qualified native/owner/release admission",
      "logSha256": "a41b98ac6d270e03dc23bb4f2e014b41adc85336ec93ea57bfb9c3c43e4ea5c1"
    },
    {
      "command": [
        "node",
        "scripts/launch/check-contract.mjs"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_EXIT; synthetic/source/browser or unsigned export only; no qualified native/owner/release admission",
      "logSha256": "56b1da55b35de94664253fbc9a1be9dffd2b5ed1da6f59cbd986e6fd8940c93b"
    },
    {
      "command": [
        "npm.cmd",
        "run",
        "postinstall:check"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_EXIT; synthetic/source/browser or unsigned export only; no qualified native/owner/release admission",
      "logSha256": "42783080f30c54c4221b0f00986e0ac04e1a8dbb2d968a8f5a6911d671cd0ffa"
    },
    {
      "command": [
        "node",
        "C:\\Users\\jasim\\Documents\\ChatGPT\\MasterV2Code\\campaign41-82698yl6\\source\\node_modules\\expo\\bin\\cli",
        "export",
        "--platform",
        "ios",
        "--output-dir",
        "C:\\Users\\jasim\\Documents\\ChatGPT\\MasterV2Code\\campaign41-82698yl6\\export-ios",
        "--source-maps",
        "external",
        "--dump-assetmap",
        "--clear",
        "--max-workers",
        "2"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_EXIT; synthetic/source/browser or unsigned export only; no qualified native/owner/release admission",
      "logSha256": "2ff5fe2f9cd4dd8773490ed67045a8378f9b3439a848b546a6557217b5d5e697"
    },
    {
      "command": [
        "node",
        "C:\\Users\\jasim\\Documents\\ChatGPT\\MasterV2Code\\campaign41-82698yl6\\source\\node_modules\\expo\\bin\\cli",
        "export",
        "--platform",
        "android",
        "--output-dir",
        "C:\\Users\\jasim\\Documents\\ChatGPT\\MasterV2Code\\campaign41-82698yl6\\export-android",
        "--source-maps",
        "external",
        "--dump-assetmap",
        "--clear",
        "--max-workers",
        "2"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_EXIT; synthetic/source/browser or unsigned export only; no qualified native/owner/release admission",
      "logSha256": "3e1bdca05a3f84afd015cdcc24cf748aa1b530c6020283e5c1d4309d627355e9"
    },
    {
      "command": [
        "node",
        "scripts/e2e/onboarding-first-session.mjs",
        "--owned-formula38",
        "--formula38-large-text",
        "--daily-loop",
        "--retained-safety",
        "--optional-change41",
        "--change41-large-text"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_EXIT; synthetic/source/browser or unsigned export only; no qualified native/owner/release admission",
      "logSha256": "e41bf0895d6f4df713aa5226287e32001164636c95fc7a1399251d73c5bf166c"
    },
    {
      "command": [
        "node",
        "scripts/e2e/onboarding-first-session.mjs",
        "--owned-formula38",
        "--formula38-large-text",
        "--daily-loop",
        "--retained-safety",
        "--optional-change41",
        "--change41-large-text"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_EXIT; synthetic/source/browser or unsigned export only; no qualified native/owner/release admission",
      "logSha256": "eaf0a8aa927f9f07c998449c6086ddb9c582114c9b15da03dd13d76c416e44c5"
    },
    {
      "command": [
        "node",
        "scripts/e2e/onboarding-first-session.mjs",
        "--owned-formula38",
        "--formula38-large-text",
        "--daily-loop",
        "--retained-safety",
        "--optional-change41",
        "--change41-large-text"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_EXIT; synthetic/source/browser or unsigned export only; no qualified native/owner/release admission",
      "logSha256": "54b53c98c490772817e7d8cb102e0df25267dbf7331f614e9669223d551cb564"
    },
    {
      "command": [
        "npm.cmd",
        "ci",
        "--cache",
        "../npm-cache"
      ],
      "exit": 0,
      "qualification": "ACTUAL_SEPARATE_FRESH_EXACT_PR43; original40/historical context only, never successor CURRENT admission",
      "logSha256": "302f623803ecab39639a754ba4c3349699ee0f1d338d61997df02696eabdd61d"
    },
    {
      "command": [
        "npm.cmd",
        "run",
        "postinstall:check"
      ],
      "exit": 0,
      "qualification": "ACTUAL_SEPARATE_FRESH_EXACT_PR43; original40/historical context only, never successor CURRENT admission",
      "logSha256": "c0d7cfd89f3f7bd40c622a35444dbc53df10075a248461c5b62e48a0817ad9e2"
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
      "qualification": "ACTUAL_SEPARATE_FRESH_EXACT_PR43; original40/historical context only, never successor CURRENT admission",
      "logSha256": "32bd67e03968ac918b4043dd2ecf33a4baed42a66a68a08ebe46a643babadfdf"
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
      "qualification": "ACTUAL_SEPARATE_FRESH_EXACT_PR43; original40/historical context only, never successor CURRENT admission",
      "logSha256": "577b0fcfef0addc5e956bb551b8a4cf554205aec902648a68b1be6e1c33dd769"
    },
    {
      "command": [
        "npm.cmd",
        "test",
        "--",
        "--force"
      ],
      "exit": 0,
      "qualification": "ACTUAL_SEPARATE_FRESH_EXACT_PR43; original40/historical context only, never successor CURRENT admission",
      "logSha256": "427a496bec8a15e858da626d99459296f6a9fa15f2f6b514f041bba0d96fa462"
    },
    {
      "command": [
        "python",
        "-I",
        "-B",
        "scripts/release/full-app-j01/main_integration40.test.py"
      ],
      "exit": 0,
      "qualification": "ACTUAL_SEPARATE_FRESH_EXACT_PR43; original40/historical context only, never successor CURRENT admission",
      "logSha256": "fe32f90ac7b160bc2876a71f9f8df16e7d8618a62458c59f6da93e3d479fd2eb"
    },
    {
      "command": [
        "python",
        "-I",
        "-B",
        "scripts/release/full-app-j01/source_consumer40.test.py"
      ],
      "exit": 0,
      "qualification": "ACTUAL_SEPARATE_FRESH_EXACT_PR43; original40/historical context only, never successor CURRENT admission",
      "logSha256": "71fb2b386e70a9d132b9db4d8785b5ddc0124ea9ef4940f9f5695921e14736bb"
    },
    {
      "command": [
        "python",
        "-I",
        "-B",
        "scripts/release/full-app-j01/main_integration40.py"
      ],
      "exit": 0,
      "qualification": "ACTUAL_SEPARATE_FRESH_EXACT_PR43; original40/historical context only, never successor CURRENT admission",
      "logSha256": "ed853351e19697a7a930f715eeabbbf41e2f9b6c1a700bf2bff590db5294402f"
    },
    {
      "command": [
        "python",
        "-I",
        "-B",
        "scripts/release/full-app-j01/main_integration40.py",
        "--scope",
        "full-app-j01-v2"
      ],
      "exit": 0,
      "qualification": "ACTUAL_SEPARATE_FRESH_EXACT_PR43; original40/historical context only, never successor CURRENT admission",
      "logSha256": "4777cc5a0dd15d388c910956f8d567bd7dd3ff340dc4be847b1215e9060bed61"
    },
    {
      "command": [
        "node",
        "--test",
        "scripts/e2e/onboarding-first-session35.test.mjs",
        "scripts/e2e/retained-safety-assertions.test.mjs",
        "scripts/e2e/compact-shelf-target37.test.mjs",
        "scripts/e2e/owned-bottle-formula38.test.mjs"
      ],
      "exit": 0,
      "qualification": "ACTUAL_SEPARATE_FRESH_EXACT_PR43; original40/historical context only, never successor CURRENT admission",
      "logSha256": "4e6e07a935c496a2590a990fe12584541e9e89684c1af6a94a700af5c993d102"
    },
    {
      "command": [
        "node",
        "--test",
        "scripts/launch/formula-route-inventory39.test.mjs"
      ],
      "exit": 0,
      "qualification": "ACTUAL_SEPARATE_FRESH_EXACT_PR43; original40/historical context only, never successor CURRENT admission",
      "logSha256": "15ae8603e58e742d592189710054c146860eb64074616e46814f56e898d66eea"
    },
    {
      "command": [
        "node",
        "--test",
        "scripts/phase2/catalog-operator-cat08-cleanup40.test.mjs"
      ],
      "exit": 0,
      "qualification": "ACTUAL_SEPARATE_FRESH_EXACT_PR43; original40/historical context only, never successor CURRENT admission",
      "logSha256": "2affcde175fb846c5e7174d259c6080091e3ce6fcba59cb64e77a0c77c528e56"
    },
    {
      "command": [
        "node",
        "--test",
        "scripts/core04/persistence-source-contract.test.mjs",
        "scripts/core06/recommendation-admission-source-contract.test.mjs"
      ],
      "exit": 1,
      "qualification": "ACTUAL_UNCHANGED_PROTECTED_SOURCE_RED_24_OF_26; same two literal failures on exact parent/current; no waiver",
      "logSha256": "a6fb08439301a465690b37b464810eed2baaceb0aa1525b6ade01eb34aadab3b"
    },
    {
      "command": [
        "node",
        "--test",
        "scripts/core04/persistence-source-contract.test.mjs",
        "scripts/core06/recommendation-admission-source-contract.test.mjs"
      ],
      "exit": 1,
      "qualification": "ACTUAL_UNCHANGED_PROTECTED_SOURCE_RED_24_OF_26; same two literal failures on exact parent/current; no waiver",
      "logSha256": "6a01c378dd1c38964c93c0ee19a2d3c82aac7364be6b8fa377d4091b5c22919b"
    },
    {
      "command": [
        "python",
        "-I",
        "-B",
        "scripts/release/full-app-j01/main_integration40.py",
        "--scope",
        "full-app-j01-v2",
        "--external-readiness"
      ],
      "exit": 2,
      "qualification": "ACTUAL_EXPECTED_EXTERNAL_READINESS_REFUSAL_EXIT2; all qualification gates remain closed",
      "logSha256": "6079bd179b4ba6adb63ca86bfa8384a97b61b4f9d51d6f8755da82f6a1fe5579"
    },
    {
      "command": [
        "npm.cmd",
        "test",
        "--",
        "--force"
      ],
      "exit": 1,
      "qualification": "ACTUAL_NEW_REGRESSION_EXIT1; two import-time suites failed; resolved by deferred explicit initialization; protected tests unchanged",
      "logSha256": "4afdf251de4bd7faae49cd9b36ea1a708ee480a2a837bb1e118aa98968a4b8e8"
    },
    {
      "command": [
        "node",
        "scripts/e2e/onboarding-first-session.mjs",
        "--owned-formula38",
        "--formula38-large-text",
        "--daily-loop",
        "--retained-safety",
        "--optional-change41",
        "--change41-large-text"
      ],
      "exit": 1,
      "qualification": "ACTUAL_FAILED_BROWSER_ATTEMPT_PRESERVED; not a completed happy path; final375e rerun supplies subsequent proof",
      "logSha256": "2e2860bb114f3fd9f3f9af5ca2e983ca1903ea466845aca85f0bce7585c0ff48"
    },
    {
      "command": [
        "node",
        "scripts/e2e/onboarding-first-session.mjs",
        "--owned-formula38",
        "--formula38-large-text",
        "--daily-loop",
        "--retained-safety",
        "--optional-change41",
        "--change41-large-text"
      ],
      "exit": 1,
      "qualification": "ACTUAL_FAILED_BROWSER_ATTEMPT_PRESERVED; not a completed happy path; final375e rerun supplies subsequent proof",
      "logSha256": "d3eef94ceccacdcdb3e528eba743214dbeb20ad37447924e1ebe6eb11e8fd1e6"
    },
    {
      "command": [
        "node",
        "scripts/e2e/onboarding-first-session.mjs",
        "--owned-formula38",
        "--formula38-large-text",
        "--daily-loop",
        "--retained-safety",
        "--optional-change41",
        "--change41-large-text"
      ],
      "exit": 1,
      "qualification": "ACTUAL_FAILED_BROWSER_ATTEMPT_PRESERVED; not a completed happy path; final375e rerun supplies subsequent proof",
      "logSha256": "c30bf56bb6c6190ec1fed75b12a68d9c71c705b92e5957b926c43715ad970230"
    },
    {
      "command": [
        "node",
        "scripts/e2e/onboarding-first-session.mjs",
        "--owned-formula38",
        "--formula38-large-text",
        "--daily-loop",
        "--retained-safety",
        "--optional-change41",
        "--change41-large-text"
      ],
      "exit": 1,
      "qualification": "ACTUAL_FAILED_BROWSER_ATTEMPT_PRESERVED; not a completed happy path; final375e rerun supplies subsequent proof",
      "logSha256": "88f510797885e1c08b757bdc1e68c1419f67eedd960ee448eae1c744c537f753"
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
        "src/features/today/optionalChange41.test.ts",
        "src/features/today/optionalChangeJournal41.test.ts",
        "src/features/today/completionsStore.t1.test.ts",
        "src/features/today/completionsStore.test.ts"
      ],
      "exit": 0,
      "qualification": "ACTUAL_FOCUSED_128_PASS_WITH_REAL_PRIVATEKV_AND_SYNTHETIC_NATIVE_PORTS; not signed native evidence",
      "logSha256": "c7178319ca36bd6d0956aa4631a6cda46ef572d2a6d90be9d98dd29e162ce20d"
    },
    {
      "command": [
        "C:\\Python39\\python.exe",
        "-I",
        "-B",
        "C:\\Users\\jasim\\Documents\\ChatGPT\\MasterV2Code\\campaign41-82698yl6\\source\\scripts\\release\\full-app-j01\\main_integration41.test.py"
      ],
      "exit": 0,
      "qualification": "ACTUAL_CURRENT41_BOUNDARY_AND_REAL_GIT_SOURCE_CONTROLS; immutable policy not product acceptance",
      "logSha256": "b65c431166a29044d9038fd31092fc4a260617d7ebe62e3a800bd97dab41cef6"
    },
    {
      "command": [
        "C:\\Python39\\python.exe",
        "-I",
        "-B",
        "C:\\Users\\jasim\\Documents\\ChatGPT\\MasterV2Code\\campaign41-82698yl6\\source\\scripts\\release\\full-app-j01\\source_consumer41.test.py"
      ],
      "exit": 0,
      "qualification": "ACTUAL_CURRENT41_BOUNDARY_AND_REAL_GIT_SOURCE_CONTROLS; immutable policy not product acceptance",
      "logSha256": "4a2b22a50b42524604f1dc0f3f31de625a89bc09b28ffd24e0bbc970c5f2b4ae"
    },
    {
      "command": [
        "python",
        "-I",
        "-B",
        "scripts/release/full-app-j01/main_integration40.py",
        "--historical"
      ],
      "exit": null,
      "qualification": "ACTUAL_RUNNING_AT_LEDGER_CUTOFF_IN_SEPARATE_FRESH_EXACT_PR43; nested39-to29 not inferred PASS; external final report records terminal",
      "logSha256": null
    },
    {
      "command": "Genuine hosted pull_request Quality/iOS/Security/candidate29 event after final seal and push",
      "exit": null,
      "qualification": "NOT_RUN_AT_PRE_PUSH_SOURCE_LEDGER_CUTOFF; external final report records genuine terminal URLs and conclusions",
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
