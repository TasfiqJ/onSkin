import datetime, hashlib, json, platform, subprocess
from pathlib import Path

EVIDENCE = Path(__file__).resolve().parent
REPO = EVIDENCE.parent / 'c16-candidate'
HEAD = '8b63185db4400d43517c7e05a2e8ad8371e984ca'
TREE = '8c9a1409dbcfbfbcc5923f41382263364a5bf6fd'
PARENT = '08da2f379c487f8b56d470c7093eb6045b700204'
ANCESTOR = 'd292743c99c1fb98f5714789f4fd60fb1e7d5a5d'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=REPO)

def textgit(*args):
    return git(*args).decode().strip()

def sha(data):
    return hashlib.sha256(data).hexdigest()

def write(name, value):
    path = EVIDENCE / name
    if path.exists():
        raise RuntimeError('Evidence already exists: ' + name)
    if isinstance(value, bytes):
        path.write_bytes(value)
    else:
        path.write_text(value if isinstance(value, str) else json.dumps(value, indent=2) + '\n', encoding='utf-8')

assert platform.node().upper() == '[LOCAL_HOST]'
assert textgit('branch', '--show-current') == 'stage/m1-native-runtime47'
assert textgit('rev-parse', 'HEAD') == HEAD
assert textgit('rev-parse', 'HEAD^{tree}') == TREE
assert textgit('rev-parse', 'HEAD^') == PARENT
assert not textgit('status', '--porcelain=v1')
assert subprocess.run(['git', 'merge-base', '--is-ancestor', ANCESTOR, HEAD], cwd=REPO).returncode == 0
identity = {'head': HEAD, 'tree': TREE, 'directParent': PARENT, 'statusPorcelain': '', 'clean': True}
write('GIT_IDENTITY.json', {
    'host': platform.node(), 'worktree': str(REPO), 'branch': 'stage/m1-native-runtime47',
    'starting': identity, 'final': identity, 'appendOnlyCommits': [],
    'pr48Ancestor': ANCESTOR, 'pr48AncestorVerified': True,
    'verifiedAtUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'writerCheck': 'Only calling PowerShell process at preflight, no index.lock. Two E24 agents performed read-only source inspection and stopped without edits/tests.'
})
write('CHANGED_FILES.json', [])
write('SOURCE.diff', git('diff', '--binary', HEAD, '--'))

ranges = {
    'apps/mobile/src/features/shelf/manualIntakeDraftStore.ts': [(15, 45)],
    'apps/mobile/src/features/today/optionalChangeDraftStore.ts': [(18, 47)],
    'apps/mobile/src/lib/storage/privateKV.ts': [(171, 193), (1227, 1347)],
    'apps/mobile/src/lib/storage/privateKVContentKey.ts': [(1, 63)],
}
excerpts, source_identity = [], []
for name, blocks in ranges.items():
    raw = (REPO / name).read_bytes()
    lines = raw.decode('utf-8-sig').splitlines()
    source_identity.append({'path': name, 'workingSha256': sha(raw),
        'gitBlob': textgit('rev-parse', HEAD + ':' + name),
        'gitBlobSha256': sha(git('show', HEAD + ':' + name))})
    excerpts.append('\n### ' + name + '\n')
    for first, last in blocks:
        excerpts.extend(f'{i}: {lines[i-1]}' for i in range(first, min(last, len(lines)) + 1))
write('STATIC_SOURCE_EXCERPTS.txt', '\n'.join(excerpts) + '\n')
write('STATIC_SOURCE_IDENTITY.json', source_identity)

commands = [
    'npm.cmd --workspace apps/mobile run test -- src/features/retainedRecovery/localRecovery.campaign05.test.ts src/features/shelf/manualIntakeDrafts.test.ts src/features/shelf/manualIntakeDraftUI21.test.ts src/features/today/optionalChangeDrafts.test.ts src/features/today/optionalChangeDraftUI21.test.ts',
    'npm.cmd test -- --cache=local:w --concurrency=1',
    'npm.cmd run typecheck -- --cache=local:w --concurrency=1',
    'npm.cmd run lint -- --cache=local:w --concurrency=1',
]
write('VALIDATION.json', {
    'preflight': 'PASS; exact baseline, clean branch and ancestry verified',
    'staticReview': 'BLOCKED; required no-write property contradicted by native key-reader implementation',
    'checks': [{'command': command, 'status': 'NOT_RUN', 'exitCode': None,
                'reason': 'Explicit stop condition reached before implementation; no source candidate exists.'} for command in commands],
    'newFocusedTests': 'NOT_CREATED; test agent stopped before editing or running tests',
    'browser': {'status': 'NOT_RUN', 'viewports': ['375x667', '390x844', '430x932'],
                'reason': 'Stopped before implementation. Web-only key reads cannot establish the required native zero-write property.',
                'screenshots': [], 'downloadAttempted': False},
    'native': 'NOT_RUN and not authorized',
    'testFailures': [], 'reruns': [], 'assertionsChanged': False, 'timeoutsChanged': False,
})
write('PRIVACY_NO_WRITE_CHECK.json', {
    'method': 'Static source inspection only; no execution of draft loaders or native storage paths',
    'result': 'BLOCKED',
    'destinationDraftBytes': 'Both loader updaters return the original raw bytes, reaching the unchanged-value transaction return before destination mutation.',
    'keySideEffects': [
        {'path': 'apps/mobile/src/lib/storage/privateKVContentKey.ts', 'line': 46,
         'finding': 'Existing secure key path invokes AsyncStorage.removeItem for the fallback key.'},
        {'path': 'apps/mobile/src/lib/storage/privateKVContentKey.ts', 'line': 54,
         'finding': 'Legacy fallback path invokes setPrivateSecureStoreItemAsync to migrate the existing key.'},
        {'path': 'apps/mobile/src/lib/storage/privateKVContentKey.ts', 'line': 61,
         'finding': 'Successful migration invokes AsyncStorage.removeItem for the fallback key.'},
    ],
    'authority': 'Existing original lease, adult receipt, current consent and exact owner/epoch checks were inspected and not modified.',
    'missingKey': 'The unchanged transaction path refuses missing key and returns before key creation; this does not remove native fallback mutation behavior.',
    'unreadableKey': 'Native secure-store read failure can use an existing legacy fallback; no stronger unconditional refusal is claimed.',
    'privateAppPayloadReadByAgent': False, 'draftsSavedDeletedResumedOrConfirmed': False,
    'sourceEdits': False, 'nativeExecution': False, 'craftedPersistedRecords': False,
})
write('PROHIBITED_OPERATIONS.json', {
    'authorization': 'BRAIN-ONSKIN-LOCAL-RECOVERY-DRAFT-VISIBILITY-24',
    'mode': 'LOCAL_ONLY / DEFENSIVE / ZERO_NEW_PAID_OPERATIONS',
    'performed': [],
    'notPerformed': [
        'Cloud execution or cloud evidence storage', 'Internet or provider contact',
        'Download, dependency install or new dependency', 'Hosted CI or GitHub Actions',
        'Push, upload, ZIP creation or publication', 'Native build, device, simulator or App Store operation',
        'Paid operation or spending', 'Access, permission, account, secret or service changes',
        'Production/backend changes, merge, deployment or release',
        'Identity/custody/licensing simulation or professional expansion',
        'Draft save, delete, discard, resume, confirmation, retry submission, product add or history write',
        'Storage creation, repair, rekey or migration', 'Raw-reader bypass, new schema/key or authority change',
        'Crafted persisted-record injection, vulnerability reproduction, exploit development/testing or destructive experiment',
        'Reset, rebase, stash, clean, branch switch or new worktree',
        'Frozen requirement/gate/J01 changes or weakened/skipped assertions',
    ],
    'newPaidOperations': 0, 'downloadAttempted': False,
})
write('FINAL_REPORT.md', f'''# Engineering24 Local Recovery durable draft discoverability

**BLOCKED — existing loader key side effects conflict with the required read-only design.**

Authorization: BRAIN-ONSKIN-LOCAL-RECOVERY-DRAFT-VISIBILITY-24. LOCAL_ONLY / DEFENSIVE / ZERO_NEW_PAID_OPERATIONS. Static review reached the explicit instruction to stop for Brain if a production loader cannot be used safely. No implementation, source commit, test execution or browser run was performed. There is no candidate to accept.

## Verified baseline and final identity

Host: [LOCAL_HOST]. Worktree: `{REPO}`. Branch: `stage/m1-native-runtime47`.

| Identity | Start | Final |
| --- | --- | --- |
| HEAD | `{HEAD}` | `{HEAD}` |
| Tree | `{TREE}` | `{TREE}` |
| Direct parent | `{PARENT}` | `{PARENT}` |
| Worktree | Clean | Clean |

Published PR48 ancestor `{ANCESTOR}` verified. No competing writer observed. Both E24 agents performed only source inspection; the test agent stopped before any edit or test. Append-only commit list: empty. Changed-file inventory: empty. `SOURCE.diff` is empty. No reset, checkout, rebase, stash, clean, branch switch or new worktree was used.

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

All evidence is local under `{EVIDENCE}`. `BASELINE.json`, `GIT_IDENTITY.json`, `CHANGED_FILES.json`, `SOURCE.diff`, `VALIDATION.json`, static source receipts, privacy/no-write findings, `PROHIBITED_OPERATIONS.json` and this report are included in `SHA256SUMS.txt`. Each listed file was verified. Existing Engineering21/22/23 evidence was only read, not modified.

## Boundaries

No app private payload was read or disclosed. No draft was saved, deleted, discarded, resumed or confirmed; no product/history/submission operation was executed. No storage repair, key mutation, migration, exploit test, crafted-record injection, provider contact, internet/download/install, cloud work, paid operation, hosted CI, native/device/simulator, access/account, production/backend, remote publication, merge or release operation occurred. The full prohibited-operation confirmation is recorded separately.

All 38 requirements and 18 gates remain **UNACCEPTED**. J01 Visible Pores remains the only Korean assessment, inactive/refusing positive results. Release remains **NO_GO**. Brain retains independent source review and acceptance authority.
''')

files = sorted(path for path in EVIDENCE.rglob('*') if path.is_file() and path.name != 'SHA256SUMS.txt')
write('SHA256SUMS.txt', ''.join(sha(path.read_bytes()) + '  ' + path.relative_to(EVIDENCE).as_posix() + '\n' for path in files))
for line in (EVIDENCE / 'SHA256SUMS.txt').read_text().splitlines():
    expected, name = line.split('  ', 1)
    assert sha((EVIDENCE / name).read_bytes()) == expected
assert not textgit('status', '--porcelain=v1')
print(json.dumps({'outcome': 'BLOCKED', 'head': HEAD, 'tree': TREE, 'clean': True,
    'manifestFiles': len(files), 'manifestSha256': sha((EVIDENCE / 'SHA256SUMS.txt').read_bytes())}))
