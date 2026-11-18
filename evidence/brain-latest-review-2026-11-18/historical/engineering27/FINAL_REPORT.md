# Engineering27 blocked local checkpoint

BLOCKED

DOT_RELAY: ENGINEERING27_LOCAL_CHECKPOINT_001
Authorization: BRAIN-ONSKIN-TODAY-SAVED-DRAFTS-ENTRY-27

## Blocker and retained candidate

The uncached root suite failed 45 protected mobile tests in planRecovery.test.ts and cycleReadiness.plan.test.ts. Both existing expo-router mocks export router only (lines 51 and 53 respectively). The new collapsed-panel focus-generation guard calls useFocusEffect at OptionalChangePanel41.tsx:76, and these mocks do not provide it. The retained raw stack explicitly reports the missing export. This is a concrete test compatibility failure introduced by calling the focus hook while the panel is collapsed, not a timing failure.

The current focus-safe implementation needs those existing Today-rendering mocks to model the focus lifecycle. Those test files are outside the two authorized paths. The task was stopped without changing them, conditionally bypassing focus protection, weakening assertions or repeating root tests on unchanged source. A read-only reviewer independently confirmed this limitation. No implementation commit was created; the candidate is retained unstaged in the two allowed files. Typecheck and lint were not run after the stop condition.

## Implemented candidate scope

Today's collapsed optional-change panel has the heading Your optional change notes, the original primary Record a change (optional) action, and a secondary Saved change drafts action. The secondary action opens the existing inventory directly without creating an editor, saving a draft or appending/submitting history. Its hint says it opens saved factual notes, corrections and retractions; it uses existing Button variants and their unchanged 56px minimum target size.

Only these repository files changed:

- `apps/mobile/src/features/today/OptionalChangePanel41.tsx`
- `apps/mobile/src/features/today/OptionalChangePanel41.test.tsx`

The new entry checks the original captured lease, original isSourceCurrent callback and focus generation. Accepted entry props stay pinned; focus cleanup clears that entry and invalidates its callback. The existing content component takes an initial inventory flag, preserving the inventory's production loader and original authority checks, explicit refresh/resume/discard, Back handler, and all draft/history operations. The primary handler is unchanged. No inventory, store, codec, history, authority, encryption, Local Recovery, route, schema or other source file changed.

Thirteen new mounted cases cover collapsed light/dark controls, direct inventory/no editor/no mutation, original primary behavior, normal owner/account/grant/expiry/withdrawal/source/blur retirement, pinned original authority and explicit fresh remount entry. All 35 existing mounted cases/assertions and original test ports remain unchanged, as verified in SOURCE_INVARIANTS.json. New mounted tests mock inventory delegation; unchanged real inventory/store regressions supply their separate production-path evidence. This candidate is not qualified for acceptance because of the root failure.

## Actual validation

All validation commands ran sequentially with installed local tooling. Before/after source hashes match within every run. Final retained source matches all post-correction runs; production source also matches the initial failed run.

| Run | Passed | Failed | Exit | Seconds |
| --- | ---: | ---: | ---: | ---: |
| focused-mounted | 47 | 1 | 1 | 21.469 |
| focused-mounted-corrected | 48 | 0 | 0 | 21.453 |
| focused-required | 60 | 0 | 0 | 6.172 |
| root-tests | 7932 | 45 | 1 | 49.218 |

The first mounted run failed one new test and passed 47. New primary-path test omitted existing category selection before the factual-text assertion. Added the missing explicit Other personal note press and an Observed local date assertion; retained the original assertion. No production fix, assertion reduction, timing change or blind retry. Its corrected run passed all 48 mounted cases. Both receipts and raw logs remain intact.

The unchanged Vitest include discovers .test.ts files, so the supplied .tsx argument is not independently collected. The existing observationHistory.test.ts bridge imports the mounted panel tests; it was run separately and within root. The exact required focused command passed 60 tests across four discovered suites. Final focused coverage totals 108 passing cases across the corrected mounted and required commands.

Root mobile results: 7,932 passed / 45 failed, with 552 passed / 2 failed files (7,977 tests, 554 files). Turbo exited 1 with 0 successful / 3 total tasks and 0 cached. Other workspaces did not report completed results after the failure; no aggregate root pass is claimed. The root failure was not rerun. Root typecheck and configured lint are NOT_RUN, with explicit not-run receipts. No source timeout, concurrency, fixture, assertion or skip was changed to obtain a pass. Existing suite diagnostics are preserved in raw logs.

No browser, native, simulator or device run was authorized or performed. Mounted/source checks do not establish browser/native accessibility qualification.

## Exact Git identity

- Host/worktree: [LOCAL_HOST] / `[LOCAL_USER_HOME]\Documents\ChatGPT\MasterV2Code\c16-candidate`
- Branch: stage/m1-native-runtime47.
- Starting and final HEAD: `0998a353feee905bf9be5cd728dbb76be4fd23ee`
- Starting and final Git tree: `e763a8061f04130aeeb1d16f29df3896bd329d61`
- Direct parent: `ac026eea9e6860a19972bf5a6c78057f95eb9320`
- PR48 ancestor: `d292743c99c1fb98f5714789f4fd60fb1e7d5a5d`, preserved (exit 0).
- Baseline clean; final working tree DIRTY with exactly the two allowed modified files, unstaged.
- Append-only commit list: empty; no commit created because qualification failed.

GIT_IDENTITY.json distinguishes baseline committed blobs from uncommitted candidate hashes. No claim is made that candidate blobs are committed. CHANGED_FILES.json and SOURCE.diff retain the exact proposed change. BASELINE.json, SOURCE_INVARIANTS.json, BLOCKER.json, VALIDATION.json and every actual test receipt/log retain the failure history and blocker. Typecheck/lint have NOT_RUN receipts, not fabricated logs. SHA256SUMS.txt covers every evidence file except itself; completeness and every listed hash were recomputed and verified after generation.

## Boundaries

No prohibited operation was performed. PROHIBITED_OPERATIONS.json records the exact exclusions. No ZIP, upload, push, install/download, external provider, private-data access, browser/native/device, hosted CI, account/access change, production, merge, deployment or release occurred. Older engineering evidence is unchanged. No tool action is denied, pending or uncertain; the blocker is the explicit source scope and protected regression requirement.

All 38 requirements and 18 gates remain UNACCEPTED. Professional provider/identity/custody stays HOLD. J01 Visible Pores remains the only Korean assessment and stays inactive/refusing positive results. Release remains NO_GO. Brain retains independent source acceptance and release-readiness authority.
