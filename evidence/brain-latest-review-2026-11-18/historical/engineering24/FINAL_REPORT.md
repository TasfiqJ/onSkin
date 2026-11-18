# Engineering24 Local Recovery durable draft discoverability

**BLOCKED — existing loader key side effects conflict with the required read-only design.**

Authorization: BRAIN-ONSKIN-LOCAL-RECOVERY-DRAFT-VISIBILITY-24. LOCAL_ONLY / DEFENSIVE / ZERO_NEW_PAID_OPERATIONS. Static review reached the explicit instruction to stop for Brain if a production loader cannot be used safely. No implementation, source commit, test execution or browser run was performed. There is no candidate to accept.

## Verified baseline and final identity

Host: [LOCAL_HOST]. Worktree: `[LOCAL_USER_HOME]\Documents\ChatGPT\MasterV2Code\c16-candidate`. Branch: `stage/m1-native-runtime47`.

| Identity | Start | Final |
| --- | --- | --- |
| HEAD | `8b63185db4400d43517c7e05a2e8ad8371e984ca` | `8b63185db4400d43517c7e05a2e8ad8371e984ca` |
| Tree | `8c9a1409dbcfbfbcc5923f41382263364a5bf6fd` | `8c9a1409dbcfbfbcc5923f41382263364a5bf6fd` |
| Direct parent | `08da2f379c487f8b56d470c7093eb6045b700204` | `08da2f379c487f8b56d470c7093eb6045b700204` |
| Worktree | Clean | Clean |

Published PR48 ancestor `d292743c99c1fb98f5714789f4fd60fb1e7d5a5d` verified. No competing writer observed. Both E24 agents performed only source inspection; the test agent stopped before any edit or test. Append-only commit list: empty. Changed-file inventory: empty. `SOURCE.diff` is empty. No reset, checkout, rebase, stash, clean, branch switch or new worktree was used.

## Concrete static blocker

Both required production loaders use `updatePrivateItemWithSources` and return their original collection bytes:

- `apps/mobile/src/features/shelf/manualIntakeDraftStore.ts`: `loadManualIntakeDrafts`.
- `apps/mobile/src/features/today/optionalChangeDraftStore.ts`: `loadOptionalChangeDrafts`.

The shared transaction retains original authority checks and avoids destination draft mutation when its updater returns unchanged bytes (`privateKV.ts:1347`). However, before that return it obtains the existing encryption key at `privateKV.ts:1293` and revalidates it at `privateKV.ts:1335`. `getExistingContentKey` at lines 171–172 invokes `getStoredPrivateKVContentKey`.

The native branch of `privateKVContentKey.ts` performs these storage mutations while reading an existing key:

1. Line 46 invokes `AsyncStorage.removeItem` for the fallback content-key entry when a secure-store value already exists, including when the fallback is absent.
2. Line 54 invokes `setPrivateSecureStoreItemAsync` to migrate an existing legacy fallback key into SecureStore.
3. Line 61 removes the fallback entry after migration readback matches.

These calls precede the transaction's unchanged-value return. Therefore retaining the exact draft bytes does **not** establish zero native writes, particularly zero encryption-key writes/migration. The web branch only reads AsyncStorage, so successful web or web-mocked tests would not resolve this native source contradiction. This is a source finding, not a vulnerability reproduction or a claim that those native operations were executed in this task.

Missing keys do not cause replacement in the unchanged destination path; it refuses before key creation. Native secure-store read failures can fall back to an existing legacy key. Those existing policies were not altered or experimentally exercised. The specific blocker is sufficient without constructing any persisted record or simulating a native migration.

## Why work stopped

Engineering24 requires status inspection to perform no storage writes, repairs, rekeying or migrations, including encryption keys. It simultaneously requires unchanged production loaders/transactions and limits implementation files to retainedRecovery and narrowly listed docs. Resolving the shared key-reader behavior would require an explicitly authorized shared-storage change outside that boundary. A raw reader, alternate authority path, platform restriction, or weakened no-write assertion would violate the assignment.

The permitted status-row implementation was therefore not started. No draft store, codec, inventory, canonical history, existing Local recovery row, authority or UI source was changed. No partial web-only implementation is presented as complete. Brain must address this scope conflict before implementation can safely resume; no architecture decision is requested from the owner.

## Validation and evidence

Preflight checks passed. Static inspection covered Local recovery implementation/tests, both production draft loaders and their shared private transaction/key reader. The source excerpts, line numbers and Git/file hashes are in `STATIC_SOURCE_EXCERPTS.txt` and `STATIC_SOURCE_IDENTITY.json`; `PRIVACY_NO_WRITE_CHECK.json` records the exact finding and limits.

Focused tests, new tests, full uncached root tests, typecheck, configured lint and browser checks at 375×667, 390×844 and 430×932 are **NOT_RUN** because the explicit stop condition was reached before any source change. Commands, statuses and reasons are recorded in `VALIDATION.json`; there are no test failure logs or screenshots to fabricate. No test assertion was skipped or weakened and no timeout was increased. No native/device qualification was attempted.

All evidence is local under `[LOCAL_USER_HOME]\Documents\ChatGPT\MasterV2Code\ENGINEERING24_EVIDENCE`. `BASELINE.json`, `GIT_IDENTITY.json`, `CHANGED_FILES.json`, `SOURCE.diff`, `VALIDATION.json`, static source receipts, privacy/no-write findings, `PROHIBITED_OPERATIONS.json` and this report are included in `SHA256SUMS.txt`. Each listed file was verified. Existing Engineering21/22/23 evidence was only read, not modified.

## Boundaries

No app private payload was read or disclosed. No draft was saved, deleted, discarded, resumed or confirmed; no product/history/submission operation was executed. No storage repair, key mutation, migration, exploit test, crafted-record injection, provider contact, internet/download/install, cloud work, paid operation, hosted CI, native/device/simulator, access/account, production/backend, remote publication, merge or release operation occurred. The full prohibited-operation confirmation is recorded separately.

All 38 requirements and 18 gates remain **UNACCEPTED**. J01 Visible Pores remains the only Korean assessment, inactive/refusing positive results. Release remains **NO_GO**. Brain retains independent source review and acceptance authority.
