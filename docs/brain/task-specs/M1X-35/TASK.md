{
  "schema": 1,
  "authority": "BRAIN-M1X-FREE-FIRST-SESSION-E2E35-SOURCE-CANDIDATE-01",
  "base": "7dea6048e5f1f5e397656b5f2fa670929fa9c2b8",
  "baseTree": "49b0baf1f20ca3d092db5d3cb14156feb2963f61",
  "planCommit": "74a1d1b449e3942677b327e748a41052552e8ae2",
  "sourceHashes": {
    ".github/workflows/quality.yml": "8546b35bf755f4fc3a60664146205f4dc50b804a9f0b48f8f6600d81f50fe48f",
    "PROGRESS.md": "5f338c0525b6f51895338f624959341cec433c8efa9d5f123a51c0aae73b940b",
    "docs/USER_FLOW_TREE.md": "77c982e529b5ed3e875c343cb322e0a213f4022623b1302180f12f81a3a6579f",
    "docs/release/full-app-j01/free-first-session35.md": "0815ba184b3542be258b9eb65bfb73ea1d096b6b0757ef195d9b71c1c81150ef",
    "scripts/e2e/onboarding-first-session.mjs": "d9b56cf5149b01c1b2485c9143c36ce45d9b18393f73ec55985477a5164dacfe",
    "scripts/e2e/onboarding-first-session35.test.mjs": "2f8fac92f93190fc14a21623b95bf81a800b4c7b1272cff1cdf2a7f5d6c25ee9",
    "scripts/release/full-app-j01/main_integration35.py": "1418a7a04a9e91585bc7723a21a6455d86c6e28a1744ff09342275789771f32c",
    "scripts/release/full-app-j01/main_integration35.test.py": "a9e71d708d4a19ae8b673c4cb4217500919f92ece3bb61dce0e9c82da80a348e",
    "scripts/release/full-app-j01/source_consumer35.test.py": "d69774afb8a695af23f1ce8ae5ecc6175ba1afc9c610119e35e47ca00ffabfab"
  },
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
  "validation": [
    {
      "command": "npm ci --ignore-scripts=false --no-audit --no-fund",
      "exit": 0,
      "scope": "fresh current35 normal install;1028 packages;mandatory postinstall ran;normal existing cache"
    },
    {
      "command": "npm run postinstall:check",
      "exit": 0,
      "scope": "all original installed patches verified"
    },
    {
      "command": "npm run typecheck",
      "exit": 0,
      "scope": "3/3 tasks,0/3 cached;42.644s;mobile app unchanged thereafter"
    },
    {
      "command": "npm run lint",
      "exit": 0,
      "scope": "3/3 tasks,0/3 cached;mobile app unchanged thereafter"
    },
    {
      "command": "npm test",
      "exit": 1,
      "scope": "first attempt:6501/6502 tests;0/2 cache hits;unchanged Git-status stability assertion raced source edits;failure retained"
    },
    {
      "command": "npm --workspace apps/mobile run test -- src/lib/launch/phase9StoreBuildInspect.test.ts",
      "exit": 0,
      "scope": "independent exact pinned37 retry2/2;unchanged bytes,stable clean checkout"
    },
    {
      "command": "npm test",
      "exit": 0,
      "scope": "stable current35 rerun6502/6502 tests;506/506 files;2/2 tasks;1/2 cache hits;43.44s"
    },
    {
      "command": "node --test scripts/e2e/onboarding-first-session35.test.mjs scripts/e2e/retained-safety-assertions.test.mjs",
      "exit": 0,
      "scope": "49/49 including45 independently authored actual-driver decision cases;synthetic IO source evidence only"
    },
    {
      "command": "python -I -B scripts/release/full-app-j01/main_integration35.test.py",
      "exit": 0,
      "scope": "14/14 synthetic negative controls"
    },
    {
      "command": "python -I -B scripts/release/full-app-j01/source_consumer35.test.py",
      "exit": 0,
      "scope": "7/7 independent actual-Git/disposable byte/restoration controls"
    },
    {
      "command": "node scripts/e2e/onboarding-first-session.mjs",
      "exit": 1,
      "scope": "unchanged parent37 driver375x667 before run; actual saved OFF screen,missing Continue tap,Account timeout"
    },
    {
      "command": "node scripts/e2e/onboarding-first-session.mjs",
      "exit": 0,
      "scope": "final executed driver375x667,ports18538/19538;actual age/consent/quiz3products/pending review/savedOFF/Continue/Account/freePaywall/Today/ownedShelf+productBack/Progress/ageReload closed"
    },
    {
      "command": "node scripts/e2e/onboarding-first-session.mjs",
      "exit": 0,
      "scope": "final executed driver390x844,ports18539/19539;same actual complete flow;no Pro or native admission"
    },
    {
      "command": "node --test scripts/photo01/photo01-source-contract.test.mjs scripts/photo02/photo02-source-contract.test.mjs scripts/photo03/photo03-source-contract.test.mjs scripts/photo04/photo04-source-contract.test.mjs scripts/photo07/photo07-source-contract.test.mjs scripts/core02/clinical-rule-source-contract.test.mjs scripts/core03/routine-guidance-source-contract.test.mjs scripts/core04/persistence-source-contract.test.mjs scripts/core05/adherence-source-contract.test.mjs scripts/core06/recommendation-admission-source-contract.test.mjs scripts/core07/share-admission-source-contract.test.mjs",
      "exit": 1,
      "scope": "168/170;inherited core04/core06 string expectations;both reproduced unchanged at exact parent37;protected sources remain untouched"
    },
    {
      "command": "npm run phase4:source-policy-smoke",
      "exit": 0,
      "scope": "original policy tests and fixed trust/release/source registry audit;no worklist production here"
    },
    {
      "command": "npx expo export --platform ios --clear --output-dir C:\\Users\\jasim\\Documents\\ChatGPT\\MasterV2Code\\campaign35-run\\unsigned-export-ios",
      "exit": 0,
      "scope": "executed from apps/mobile with actual absolute output directory outside source;unsigned clear-cache Hermes export,not native signed/device proof"
    },
    {
      "command": "npx expo export --platform android --clear --output-dir C:\\Users\\jasim\\Documents\\ChatGPT\\MasterV2Code\\campaign35-run\\unsigned-export-android",
      "exit": 0,
      "scope": "executed from apps/mobile with actual absolute output directory outside source;unsigned clear-cache resilience export,not iOS release proof"
    },
    {
      "command": "python -I -B scripts/release/full-app-j01/main_integration34.py",
      "exit": 0,
      "scope": "fresh named34 exactPR37 checkout;23590 tracked blobs hashed;original current-source proof,206.718s"
    },
    {
      "command": "python -I -B scripts/release/full-app-j01/main_integration34.py",
      "exit": 1,
      "scope": "genuine current35 named-branch refusal R34_WRONG_BRANCH;not a PASS"
    },
    {
      "command": "python -I -B scripts/release/full-app-j01/main_integration34.test.py",
      "exit": 0,
      "scope": "fresh exactPR37 historical checkout14/14"
    },
    {
      "command": "python -I -B scripts/release/full-app-j01/source_consumer34.test.py",
      "exit": 0,
      "scope": "fresh exactPR37 historical checkout6/6"
    },
    {
      "command": "node --test scripts/launch/candidate-scope34.test.mjs scripts/launch/consumer-entry34.test.mjs",
      "exit": 0,
      "scope": "fresh exactPR37 historical checkout31/31;unchanged candidate34"
    },
    {
      "command": "python -B scripts/release/full-app-j01/test_contract.py",
      "exit": null,
      "scope": "historical37 original151 execution in progress at source freeze;actual final external receipts required"
    },
    {
      "command": "python -B scripts/release/full-app-j01/source_consumer09.test.py",
      "exit": null,
      "scope": "historical37 original09 execution pending at source freeze;actual final external receipts required"
    },
    {
      "command": "python -I -B scripts/release/full-app-j01/main_integration34.py --historical",
      "exit": null,
      "scope": "fresh exactPR37 nested original33/32/29 pending at source freeze;actual final external receipts required"
    },
    {
      "command": "python -I -B scripts/release/full-app-j01/main_integration35.py",
      "exit": null,
      "scope": "NOT_RUN before immutable source/worklist seal exists;actual final local and real hosted results external"
    },
    {
      "command": "GitHub automatic Quality/iOS/unchanged Security/candidate29",
      "exit": null,
      "scope": "NOT_RUN before publication;actual run/attempt/conclusion external;no fabricated event or bypass"
    },
    {
      "command": "physical iPhone / VoiceOver / APNs / real StoreKit / signed build / real provider",
      "exit": null,
      "scope": "NOT_RUN;unqualified and no external acceptance"
    }
  ],
  "sourceSnapshots": {
    "parentHead": "7dea6048e5f1f5e397656b5f2fa670929fa9c2b8",
    "parentTree": "49b0baf1f20ca3d092db5d3cb14156feb2963f61",
    "planCommit": "74a1d1b449e3942677b327e748a41052552e8ae2"
  }
}
