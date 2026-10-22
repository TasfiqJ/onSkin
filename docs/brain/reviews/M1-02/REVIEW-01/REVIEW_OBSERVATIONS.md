# Independent evidence index — M1-02 review 01

Delivery `8c1149116df00f34314357d10929b32f52f6d118` / `58ad583815b55736f1e907e02d9c46853f0d1a11`. All independent checks below used this exact head and preserved a clean source worktree. Local root: `C:/Users/jasim/Desktop/onSkin/.claude/worktrees/m1-retained-safety`. Command working directory was this root except the explicitly isolated adverse-test harness. No credentials/private media were used.

## Root and governance command receipts

Retained workstation output directory: `C:/Users/jasim/AppData/Local/Temp/onskin-brain-m102-review-ufstvief`.

| Log | Exact command | Exit / outcome | SHA256 of stdout+STDERR capture |
|---|---|---|---|
|check-0.log|`npm run test -- --force`|0;6048pass|38bef40a06a4ebc6be1a57a1b839a3a193b93cecc04ddfac3960186a8ffc6913|
|check-1.log|`npm run typecheck -- --force`|0|201d81135dcd7929d75fcfbb29d719e34b825709fd30e3c007682810e9fdc02c|
|check-2.log|`npm run lint -- --force`|0|1b60910ac65732a3a95ae6ba3a4b7563b89aea261905467c62c86239a2513d8b|
|check-3.log|`python -B -m unittest discover -s scripts/brain -p test_*.py -v`|0;49pass2Windows skips|8df68e04185c62b4fb40b89ecf63f0df67651a269eba9195cbafa6ee7ea1350d|
|check-4.log|`python -B scripts/brain/brain.py --profile M1-02 report docs/brain/checkpoints/M1-02/completion-report.json`|0|541c8017bb7fd21a866d855fe5fda85fc611681400b90b57d960d104b9d21bff|
|check-5.log|source command below|1;148pass1fail|9fae6e4cfc4cf25052c23c8ecbcc5afebd31f60735b8830bfec476abc69ab014|
|check-6.log|`node scripts/phase4/build-source-worklist.mjs --strict --check`|0|ab248369bb441b4d4cfbb989f3aab2eac1de3a44622ca3e7bbc03e99efa122fd|

On Windows the npm commands were invoked with `cmd.exe /d /s /c`; Python was C:/Python39/python.exe. Executions used Node22.21.0/npm11.20.0/Python3.9.13. Counts from focused tests overlap root and must not be added.

```text
node --test scripts/core03/routine-guidance-source-contract.test.mjs scripts/core04/persistence-source-contract.test.mjs scripts/core05/adherence-source-contract.test.mjs scripts/photo01/photo01-source-contract.test.mjs scripts/photo02/photo02-source-contract.test.mjs scripts/photo03/photo03-source-contract.test.mjs scripts/photo04/photo04-source-contract.test.mjs scripts/photo05/trend-admission-source-contract.test.mjs scripts/photo07/photo07-source-contract.test.mjs scripts/pay07/entitlement-admission-source-contract.test.mjs scripts/core01/metro-linked-dependencies.test.cjs scripts/core01/native-age-assurance-source-contract.test.mjs scripts/e2e/retained-safety-assertions.test.mjs
```

## Four unmodified browser failures

Directory `C:/Users/jasim/AppData/Local/Temp/onskin-brain-m102-web-0n6l2pdg`. Each invocation used unique evidence directory/Chrome debug/server ports, exact unchanged runner, fresh synthetic UI state. All exited1 at the same expected-storage-error wait, before a completed daily proof.

| Case | Width x height | Server/debug ports | Flags | Output hash |
|---|---|---|---|---|
|daily390|390x844|8431/9531|`--daily-loop`|b305b8d1f52a550cda5da690abd2db4c5dfc6f45fa4bf12becadc657808ce1c9|
|daily375|375x667|8432/9532|`--daily-loop`|b305b8d1f52a550cda5da690abd2db4c5dfc6f45fa4bf12becadc657808ce1c9|
|daily430|430x932|8433/9533|`--daily-loop`|b305b8d1f52a550cda5da690abd2db4c5dfc6f45fa4bf12becadc657808ce1c9|
|crossDaily390|390x844|8434/9534|`--daily-loop --cross-owner`|c7aaf996f203276f3c4227cd3a7e2c4f160a4b0d7febfbd5639fd6313c734e3a|

Command prefix: `node scripts/e2e/onboarding-first-session.mjs`. Environment keys: ONBOARDING_E2E_PORT, ONBOARDING_E2E_DEBUG_PORT, ONBOARDING_E2E_VIEWPORT_WIDTH, ONBOARDING_E2E_VIEWPORT_HEIGHT and ONBOARDING_E2E_EVIDENCE_DIR. EXPO_NO_TELEMETRY=1. No host-clock mutation. Started21:05:10,21:06:38,21:08:05,21:09:34 UTC October20. Observed local time around17:06.

Runner SHA256 `cd8e9f6fd23085f3fd788354c91f800753179991159f6e5bfa37c912240e9a0c`; daily helper `53cc64adddfec9fe02d8cd6b96f9778714c2c9538153a93663a8898911a51a11`.

Brain viewed daily390/FAILURE.png and corresponding JSON. URL AM; rendered Evening routine0of2, Glycolic7% toner and synthetic moisturizer, no expected error. The UI controls were present/hit-testable; a URL assertion is not clock-state proof. Do not call this a discovered data-loss defect.

## Controlled-port probes

Directory `C:/Users/jasim/AppData/Local/Temp/onskin-brain-m102-adverse-_agaeqo5`. Existing installed dependencies linked in a disposable harness; no source/dependency modification. `node <repo>/node_modules/vitest/vitest.mjs run --config <probe>/vitest.config.mjs --reporter verbose -t BRAIN:`. Two selected tests failed;36 copied existing cases were intentionally filtered, not real platform skips.

Raw output SHA256 `dd92c769a4616d818d05c88a2a1a53c07a0b314888c466ee70b85fda876399f9`. Probe SHA256: brain-deliver.test.ts `41daae3f9143f5e85a786a88973bb829576094776c395ade76249402a504a5cb`; brain-startup.test.ts `a7481043fe9cb6703cad0b547d831fa6824b73c09835a3592dc708ead3701b28`.

Deliver result: promise resolved undefined instead of rejecting runtime unavailable. Startup result: second call unavailable; category-port calls stayed4. These are actual source behaviors under controlled native ports, not real OS observations. Reproduction code/steps in REPRODUCERS.md.

## Modified-harness diagnostic — not a passing implementation

Directory `C:/Users/jasim/AppData/Local/Temp/onskin-brain-m102-clock-control-go85v2m5`. Temporary relocated runner kept the original app root and assertion imports. Only its helper's FIRST AM navigation added a document reload and Morning routine wait. At390, ports8451/9551, it advanced but exited1 at later saved-AM re-entry; FAILURE.json again shows AM URL with PM content. Brain viewed this screenshot too. No app source changed.

Output SHA256 `cdbbd72f4c8d019d6f33598d8e50c21407bd953a4c53fff95f4b832903a0b325`; temporary runner `90288dc2a3ea9a3b72311a502c83007f8aae7ef557ab0af6ccceafdb8fb2743f`; helper `e5baa3ee077ff4a632d56df322a070bf4c2364c95d37da79db7d2bfd021a748e`.

## Source equality and integrity

These sources are byte-identical between M1-01 acceptance and submitted M1-02: notification startup, Today screen, useRoutineClock, completionsStore and the inherited CORE05 contract. Thus current findings must not be mislabeled newly introduced by this patch.

| Source | SHA256 |
|---|---|
|notifications/startup.ts|1e17e9652cfe3f95cea1f9608d204250f2aa338144a6089063205088e8c18b0f|
|today/completionsStore.ts|433593338e667c9de81d3e57c8f4b0f547149124c54a471147b757fe3c601bbf|
|today/useRoutineClock.ts|b1dec943daf8d3bb1b0cae3e9e4f56a474866299f9d4dba75a6088627354521f|
|app/(tabs)/today.tsx|9d1e1eb86c2bbc23a1b74206a2bab2ec765a30b846bbf36edbd3e58ab982fc94|
|scripts/core05/adherence-source-contract.test.mjs|ee42ab243737cd08bf704932ecc12fa4c52b2663e57b24174b950cf2ec70a026|

The remote compact export brain-review-export.json is26,406bytes SHA256 `812a95d4b29fc0ca5cb7bbfd62a29d65e8c8d257cf42de080dcee1af8c42163d`; it includes receipts/custody/diagnostic metadata. Raw artifacts are retained on the owner workstation, not embedded in this Markdown-first package. Hashes alone establish byte identity, not truth or native proof. Reproduce safely if temporary files are no longer available.
