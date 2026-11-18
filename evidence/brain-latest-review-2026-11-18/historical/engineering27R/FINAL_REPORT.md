# Engineering27R local checkpoint

COMPLETE_LOCAL_CHECKPOINT

DOT_RELAY: ENGINEERING27R_LOCAL_CHECKPOINT_001
Authorization: BRAIN-ONSKIN-TODAY-SAVED-DRAFTS-ENTRY-27-REMEDIATION-01

## Remediation and original failure

E27 stopped with 7,932 mobile tests passed and 45 failed: 23 in planRecovery and 22 in cycleReadiness.plan. Their router-only test mocks omitted useFocusEffect, called by the retained collapsed-panel focus guard. That failed root run and its report remain unchanged in ENGINEERING27_EVIDENCE. All 22 original entries and its manifest `35f9a81f032cbaa229e374d52769c1ee7c726174004b1218f9157fa546f5f1db` were independently verified with no extras, at baseline and again before completion.

E27R changed only each existing vi.mock('expo-router') declaration in the two authorized test files. Each async factory imports useEffect from React, preserves its exact router methods, and exports `useFocusEffect: (callback: () => void | (() => void)) => useEffect(callback, [callback])`. The callback runs for a mounted focused renderer; its returned cleanup is registered for unmount/dependency change. These two suites do not simulate navigation blur; the unchanged dedicated panel tests separately verify normal focus retirement. Comments document this limit. There is no no-op, conditional hook, fake navigation stack, global focus override or production bypass.

Static full-file comparison proves all bytes outside those mock declarations are unchanged after Git line-ending normalization, including original assertions, fixtures, authority ports and test bodies. A separate read-only review confirmed callback/cleanup/dependency semantics and exact router preservation. Both retained E27 candidate files were never touched and kept their pinned raw SHA-256 values throughout every validation and after commit:

- OptionalChangePanel41.tsx: `c152a2813d7ffc949ae6ec81a691e3e76e77d2e22e4a64d0a3ded0f1b026562d`
- OptionalChangePanel41.test.tsx: `ab63c800285963bcc79275b880d3b68077f85b1605d82992b2714a469036e9a3`

The one local commit includes the original candidate plus the two mock corrections:

- `apps/mobile/src/features/routine/planRecovery.test.ts`
- `apps/mobile/src/features/scheduler/cycleReadiness.plan.test.ts`
- `apps/mobile/src/features/today/OptionalChangePanel41.test.tsx`
- `apps/mobile/src/features/today/OptionalChangePanel41.tsx`

The retained candidate adds the collapsed heading and direct Saved change drafts entry using existing inventory and original authority. Its original primary action, explicit resume/discard/refresh/Back and canonical draft/history behavior are preserved; E27R introduces no additional product changes.

## Actual validation

All six commands ran in the requested A–F order, sequentially, once each, with installed local tooling. No validation failed in E27R and no reruns occurred. Before/after hashes for all four paths were recorded for every run and matched; final committed blobs match those validated sources. Raw logs, exact commands, UTC timestamps, durations, exits and counts are retained in individual receipts and VALIDATION.json.

| Run | Passed tests | Exit | Seconds |
| --- | ---: | ---: | ---: |
| A-focused-mocks | 107 | 0 | 36.25 |
| B-focused-mounted | 48 | 0 | 21.656 |
| C-focused-recovery | 60 | 0 | 6.156 |
| D-root-tests | 8652 | 0 | 54.844 |
| E-root-typecheck | Configured check | 0 | 23.907 |
| F-root-lint | Configured check | 0 | 75.078 |

A passed both remediated suites, 107 tests. B passed the unchanged 48 mounted panel cases, including focus-retirement coverage, through the existing observationHistory.test.ts bridge. C ran the exact requested command and passed four discovered suites/60 tests; the .tsx argument is not a direct Vitest entry under the unchanged include pattern, so B supplies explicit mounted coverage.

D passed all root workspaces uncached: mobile 7,977 tests/554 files, professional web 651/18, catalog console 24/7; total 8,652 tests/579 files. Turbo reported 3 successful tasks and 0 cached. E typecheck and F configured lint each passed 4 tasks with 0 cached. The types workspace retains its existing no-lint placeholder; no broader lint coverage is claimed. Existing suite diagnostics remain in raw logs.

No browser/native/device/simulator qualification was authorized or performed. This remediation uses the existing synthetic in-memory test infrastructure and does not establish those platform qualifications.

## Git and evidence

- Host/worktree: [LOCAL_HOST] / `[LOCAL_USER_HOME]\Documents\ChatGPT\MasterV2Code\c16-candidate`
- Branch: stage/m1-native-runtime47.
- Start HEAD: `0998a353feee905bf9be5cd728dbb76be4fd23ee`
- Start tree: `e763a8061f04130aeeb1d16f29df3896bd329d61`
- Start parent: `ac026eea9e6860a19972bf5a6c78057f95eb9320`
- Baseline: exactly the two pinned unstaged files, no staged or untracked files.
- Final HEAD: `efd3af803a2a71bd2fdd644ecfd500c619fb996c`
- Final tree: `83670a073910a840c69368f1760d5cb59d021054`
- Final direct parent: `0998a353feee905bf9be5cd728dbb76be4fd23ee`
- One append-only local commit: `feat: expose saved change drafts from Today`
- Final status: clean; exactly four committed changed paths.
- PR48 ancestor `d292743c99c1fb98f5714789f4fd60fb1e7d5a5d` preserved (exit 0).

GIT_IDENTITY.json records raw source hashes and committed blob identities, including Git's existing CRLF normalization for the test candidate. SOURCE.diff includes the complete four-file commit; SOURCE_INVARIANTS.json distinguishes unchanged retained candidate bytes from the two declaration-only remediation edits. BASELINE.json, original-evidence verification receipts, CHANGED_FILES.json, VALIDATION.json, all A–F logs/receipts and PROHIBITED_OPERATIONS.json retain the complete local record. SHA256SUMS.txt covers every actual evidence file except itself; file-set completeness and every listed hash were independently recomputed and verified. Original E27 evidence is untouched.

There are no unresolved blockers or pending/denied/uncertain actions. No prohibited operation was performed; the exact list is in PROHIBITED_OPERATIONS.json. No upload, publication, ZIP, push/PR, merge, release, production change, external provider, private data, dependency download or new paid operation occurred.

All 38 requirements and 18 gates remain UNACCEPTED. Professional provider/identity/custody stays HOLD. J01 Visible Pores remains the only Korean assessment and stays inactive/refusing positive results. Release remains NO_GO. Independent Brain acceptance is pending; Brain retains source acceptance and release-readiness authority.
