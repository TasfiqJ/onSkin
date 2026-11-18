# Engineering25 — Read-only private storage and Local recovery

**COMPLETE_LOCAL_CHECKPOINT.** Both authorized components are implemented and locally validated. No unresolved implementation blocker was found. Independent acceptance remains with Brain; native behavior is not qualified by mocks or Expo web.

Authorization: BRAIN-ONSKIN-PRIVATE-KV-READONLY-25. Host [LOCAL_HOST]. LOCAL_ONLY / DEFENSIVE / ZERO_NEW_PAID_OPERATIONS.

## Exact identity

Worktree: `[LOCAL_USER_HOME]\Documents\ChatGPT\MasterV2Code\c16-candidate`. Branch remains `stage/m1-native-runtime47`.

| State | HEAD | Tree | Worktree |
| --- | --- | --- | --- |
| Start | `8b63185db4400d43517c7e05a2e8ad8371e984ca` | `8c9a1409dbcfbfbcc5923f41382263364a5bf6fd` | Clean |
| Final | `ac026eea9e6860a19972bf5a6c78057f95eb9320` | `ed9d6b1cff7e46cca7f453e88f2a25118dedb756` | Clean |

Starting direct parent `08da2f379c487f8b56d470c7093eb6045b700204` verified. Final direct parent is the starting HEAD. PR48 ancestor `d292743c99c1fb98f5714789f4fd60fb1e7d5a5d` remains preserved. One append-only local implementation commit: `ac026eea9e6860a19972bf5a6c78057f95eb9320 fix: keep private reads pure and expose recovery drafts`. No competing writer was observed; delegated tests used separate files and source review was read-only. Full identity, changed-file hashes and exact patch are in `GIT_IDENTITY.json`, `CHANGED_FILES.json` and `SOURCE.diff`.

## Read-only key boundary

The E24 blocker was addressed in the two authorized shared storage files. `getStoredPrivateKVContentKey`, `getExistingContentKey` and `assertRetainedContentKey` now resolve/recheck existing material without adapter writes. Web remains an existing AsyncStorage read. Native secure-only, identical-location and legacy-only cases preserve the selected key without cleanup or migration. Native unavailable/read-failure behavior continues to use an existing legacy fallback; absent/unreadable/conflicting material retains the existing refusal behavior. No read or unchanged source transaction creates, repairs, rotates, migrates or deletes keys.

Explicit `maintainStoredPrivateKVContentKey(expected, assertCurrent)` receives the already-selected existing key and original write guard. It revalidates continuity and current authority around asynchronous work, performs migration only after a definitive native miss, and cleans only an identical fallback. Fresh guarded reads precede migration/cleanup, including fresh native/fallback checks after migration readback. Missing/conflicting/successor material is not replaced. Failed or omitted migration retains the fallback. Existing creation and orphan safeguards remain confined to real authorized writes.

Guarded writes call maintenance before `commitPrivateMutation46` arms a durable intent. Source writes call it only after unchanged/publication returns and before durable intents. Original adult/owner/consent/epoch, account and write capabilities, authority-before-payload ordering, sorted reservations, source comparisons, purpose-bound encryption, retained-key revalidation, mutation generations, quarantine, exact readback, ambiguous-write compensation and deletion priority remain intact. Direct remove/multi-remove/widget/key-clear and rollback paths were not changed. Purpose-limited export writes continue to use their original account guard.

The existing explicit generic updater still treats unchanged legacy plaintext as an actual representation/encryption migration. Current-envelope/null no-ops return before maintenance; source transactions reject unauthenticated legacy bytes. This preserves the original authorized migration semantics and is not described as a read-only plaintext updater. `KEY_READ_SEMANTICS.json` inventories the calls, lanes and exact decisions.

## Six-domain Local recovery

You → Help → Local recovery now has independent Manual intake drafts and Optional change drafts rows beside Shelf, Today check-offs, Reminder choices and Photo cleanup. Each new row calls its existing production loader with the original admitted lease inside the existing lifecycle/pre/post authority flow. It returns only generic Saved on this device, Not configured or Unavailable text. Failures remain independent and explicitly say nothing was reset.

Manual drafts navigate to `/shelf/intake-drafts`. Optional drafts navigate to Today and explain Your optional change notes → Saved change drafts. Inspection never saves, deletes, discards, resumes, confirms or retries a draft/submission, adds a product or writes history. No new key, cache, notification, raw reader or provider path was introduced. Existing explicit Check again coalescing, foreground/re-entry refresh and stale-result retirement remain in force. The overview contains no product/brand/ingredient/note/photo content, owner/draft/event identifiers, counts, raw errors or storage paths.

## Source inventory

Ten files changed: the two authorized shared storage modules; the existing key-storage test and new `privateKVReadOnly25.test.ts`; the two authorized Local recovery modules; the existing campaign05 adapter test and new `localRecoveryDrafts25.test.ts`; only the relevant M1-02 addition in `docs/USER_FLOW_TREE.md`; and `PROGRESS.md`. Existing campaign05 and key migration assertions remain intact. The old key tests now explicitly invoke write-time maintenance where migration is expected. The old four-domain recovery adapter gained empty draft-loader doubles; the companion suite uses real production loaders, encryption and successful Save APIs.

No draft codec/store, canonical history, actual-routine, inventory, professional source or frozen contract was changed. `PROTECTED_SOURCE_AND_CONTRACTS.json` verifies exact baseline equality for those core files, original storage/draft regressions, bottle-history setup, J01 matrices/contracts/precedence and launch contract.

## Validation receipts

| Receipt | Result |
| --- | --- |
| key-read-focused-r1 / r2 | 47 then final 55 key tests PASS |
| storage-boundary-r1 / r2 | Initial 179 PASS / 1 FAIL; final all 180 tests / 5 files PASS |
| draft-regression-r1 | 80 existing manual/optional draft tests / 4 files PASS |
| recovery-focused-r1 / r2 | Initial 17 PASS / 26 new fixture failures; final all 43 tests / 2 files PASS |
| types-focused-r1 | Mobile typecheck PASS |
| root-types-r1 / r2 | Initial new-test callback type error; final 4 tasks PASS, 0 cached |
| formula-journey-diagnostic-r1 | Unchanged bottle-history file, all 23 tests PASS |
| root-tests-r1 / r2 | Initial six bottle-history setup failures; final **8,639 tests / 579 files PASS**, 3 tasks, 0 cached |
| root-lint-r1 | Configured lint 4 tasks PASS, 0 cached |
| browser-r1 / r2 / r3 / r4 | Environment/driver failures preserved; final three-viewport journey PASS |

Final root breakdown: mobile 7,964 tests / 554 files; professional 651 / 18; catalog operator 24 / 7. Root commands used the requested `--cache=local:w --concurrency=1`. No cache reads or remote cache were used. Installed tooling only, with a scrubbed offline/no-telemetry environment and blocked service placeholder. Configured lint is mobile ESLint, existing web tsc tasks and the existing types no-lint placeholder; no additional lint coverage is claimed.

No-write tests verify single/batch/when-ready/envelope-validation/current no-op/source no-op paths, missing/unavailable/conflicting keys, all six status readers, zero adapter mutation calls and exact original bytes. Explicit write tests preserve migration, identical cleanup, continuity refusal and original authority retirement. The mounted recovery fixtures use existing web platform ports; separate key/privateKV tests cover native adapter return states. Neither proves installed-device behavior. See `NO_WRITE_VERIFICATION.json` and `MUTATION_MIGRATION_VERIFICATION.json`.

## Retained failures and corrections

- An extra newly added source reread moved the existing source-fence test's third-read gate before intent. Only that redundant new scan was removed; every baseline source check/assertion remains. All 180 then passed.
- The new recovery observer initially targeted unavailable SecureStore exports in the shared web fixture. It now spies the actual privateSecureStore mutation wrappers plus AsyncStorage mutators. All 26 new cases and 17 original cases pass.
- Root typecheck found the new test's React act callback returning a boolean. Its return was discarded with a void callback; no behavior/assertion changed.
- First full root execution had six `formulaHistoryJourney.test.ts` beforeEach failures: its unchanged fixed 25 ms wait ended before “Record label observation” existed. All 23 cases passed in isolation; the full unchanged command then passed with all 8,639 tests. Browser work overlapped the root runs, while typecheck/lint had finished before the final run. The fixed-wait setup is timing-sensitive; this is a supported diagnosis, not proof that it cannot flake. No timeout/worker/assertion change or waived failure occurred.
- Browser r1 could not access localhost inside the sandbox. Approved local-only elevated execution resolved the socket restriction without permission/account configuration changes. Browser r2 used an exact entry selector that omitted the existing row hint; it was corrected to the actual label. Browser r3 selected a hidden retained route's Local recovery section on return; the visible-route selector corrected that harness error. Generic re-entry receipts confirm the hidden inactive section and active six-row section separately. Waits and assertions were unchanged.

All raw failed logs, command receipts, source hashes, browser driver revisions and reruns are retained. `VALIDATION.json` indexes actual exit codes, durations and log hashes.

## Browser evidence and limits

Installed Edge and local Expo web were used with fresh synthetic profiles at 375×667, 390×844 and 430×932. The journey uses ordinary UI onboarding/draft saves as fixture setup, then verifies the overview's empty/saved/unavailable states, independent failures and recovery, all six reachable rows, keyboard focus/activation, live status, applicable targets at least 48 px, no horizontal overflow or private content, zero Storage writes during inspection retries, both existing inventories and actual return to You refresh. Screenshots are cropped to generic overview rows. Local-only DNS/request guards prevent provider contact; no download/install was needed. See `browser-r4/summary.json` and its per-viewport screenshots/receipts.

No real private data was inspected. No native/device/simulator, OS keychain durability, atomicity, physical accessibility, provider, professional, clinical or production qualification is claimed. No cloud engineering, spend, internet/provider contact, download/install, upload/push/publication, hosted CI, access/account change, production/backend, merge/deployment/release or offensive work was performed. Full confirmation is in `PROHIBITED_OPERATIONS.json`.

All evidence is local at `[LOCAL_USER_HOME]\Documents\ChatGPT\MasterV2Code\ENGINEERING25_EVIDENCE`. E24 evidence remains untouched; its original manifest and all 11 listed files were verified. Every current evidence file is covered by `SHA256SUMS.txt` and was verified after writing.

All 38 requirements and 18 gates remain **UNACCEPTED**. J01 Visible Pores remains the only Korean assessment and is inactive/refusing positive results. Release **NO_GO**. Brain retains independent source review and acceptance authority.
