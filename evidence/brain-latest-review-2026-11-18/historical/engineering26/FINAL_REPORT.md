# Engineering26 local checkpoint

COMPLETE_LOCAL_CHECKPOINT

Relay: DOT_RELAY: ENGINEERING26_LOCAL_CHECKPOINT_001
Authorization: BRAIN-ONSKIN-FORMULA-HISTORY-TEST-READINESS-26

The initial shared formula-history journey setup now observes the exact mounted and enabled `Record label observation` control before pressing it. It uses `vi.waitFor` with the installed Vitest defaults (1,000 ms timeout and 50 ms polling interval), with a React `act` microtask flush before each observation. The wait never activates the control. This is a test synchronization correction, with no product change or product defect claim.

Only `apps/mobile/src/features/shelf/formulaHistoryJourney.test.ts` changed: seven lines added and one removed. The initial `flush26` call after mount was replaced; the shared helper itself and every later wait are untouched. `press()` keeps its original existence/enabled assertions and one activation. Every test body, assertion, parameterization, original authority and fixture remains identical. SOURCE_INVARIANTS.json records exact replacement and test-body hash verification; a separate read-only review found no blocker. No timeout/interval option, arbitrary sleep, activation retry, concurrency change or skip was added.

## Git identity

- Host: [LOCAL_HOST]; worktree: `[LOCAL_USER_HOME]\Documents\ChatGPT\MasterV2Code\c16-candidate`
- Branch: `stage/m1-native-runtime47`; clean at baseline and final verification.
- Start HEAD: `ac026eea9e6860a19972bf5a6c78057f95eb9320`
- Start tree: `ed9d6b1cff7e46cca7f453e88f2a25118dedb756`
- Start direct parent: `8b63185db4400d43517c7e05a2e8ad8371e984ca`
- Final HEAD: `0998a353feee905bf9be5cd728dbb76be4fd23ee`
- Final tree: `e763a8061f04130aeeb1d16f29df3896bd329d61`
- Final direct parent: `ac026eea9e6860a19972bf5a6c78057f95eb9320`
- One append-only local commit: `test: await formula history setup readiness`
- PR48 ancestor `d292743c99c1fb98f5714789f4fd60fb1e7d5a5d` preserved (exit 0).
- Committed source blob: `34fe95b43ec97551a8e10f99a8cf112cd888dfed`
- Worktree source SHA-256: `4f97f0754cc30f0ce4d657e99824a3bb664544720c37e5ad7012fb198199d4f0`
- Committed blob SHA-256: `4f97f0754cc30f0ce4d657e99824a3bb664544720c37e5ad7012fb198199d4f0`

The final committed blob matches all six validation runs. Raw source SHA-256 and Git blob identity were recorded before and after each run, with no drift. Git-normalized committed content equals the working source. All other repository files are unchanged. No competing writer was observed during preflight; source scope and hashes remained stable throughout.

## Validation

The required commands ran sequentially, with installed local tooling and offline/no-telemetry environment settings. No browser work ran concurrently. Each raw log and receipt is retained.

| Run | Passed tests | Exit | Seconds |
| --- | ---: | ---: | ---: |
| focused-1 | 23 | 0 | 8.594 |
| focused-2 | 23 | 0 | 8.531 |
| focused-3 | 23 | 0 | 8.563 |
| root-tests | 8639 | 0 | 55.5 |
| root-typecheck | Configured check | 0 | 24.109 |
| root-lint | Configured check | 0 | 76.765 |

All three focused runs passed all 23 existing cases. The uncached root suite passed 8,639 tests in 579 files (mobile 7,964/554; professional web 651/18; catalog console 24/7), with 3 successful tasks and 0 cached. Root typecheck and configured lint each passed 4 tasks with 0 cached. The target suite also passed 23 cases within the root run. Root lint remains the repository's configured checks; no broader lint coverage is claimed.

No E26 validation failed, and no extra validation retries occurred. Existing suite diagnostics, including react-test-renderer deprecation warnings, remain in the raw logs. There are no unresolved blockers. Successful local runs do not establish native/device qualification or eliminate every possible future timing failure.

## Evidence and limits

BASELINE.json, GIT_IDENTITY.json, CHANGED_FILES.json, SOURCE.diff, SOURCE_INVARIANTS.json, VALIDATION.json, three focused logs/receipts, root test/typecheck/lint logs/receipts, and PROHIBITED_OPERATIONS.json provide the source and validation record. Local evidence helper scripts are included for reproducibility. SHA256SUMS.txt lists every evidence file except itself; every listed hash was independently recomputed after manifest generation.

No prohibited operation was performed; the exact list is in PROHIBITED_OPERATIONS.json. No ZIP, upload, push, dependency download/install, external provider, actual private data, browser, native/device/simulator, cloud CI, production, merge, deployment or release operation occurred. Older evidence remains untouched.

All 38 requirements and 18 gates remain UNACCEPTED. Professional identity/provider/custody remains HOLD. J01 Visible Pores remains the only Korean assessment, inactive and refusing positive results. Release remains NO_GO. This is a local engineering checkpoint only; Brain retains independent source review and acceptance authority.
