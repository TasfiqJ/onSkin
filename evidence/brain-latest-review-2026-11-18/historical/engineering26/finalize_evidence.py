import datetime
import hashlib
import json
import re
import subprocess
from pathlib import Path

EVIDENCE = Path(__file__).resolve().parent
REPO = EVIDENCE.parent / 'c16-candidate'
TARGET = 'apps/mobile/src/features/shelf/formulaHistoryJourney.test.ts'
START = 'ac026eea9e6860a19972bf5a6c78057f95eb9320'
START_TREE = 'ed9d6b1cff7e46cca7f453e88f2a25118dedb756'
PR48 = 'd292743c99c1fb98f5714789f4fd60fb1e7d5a5d'

def git_bytes(*args):
    return subprocess.check_output(['git', *args], cwd=REPO)

def git(*args):
    return git_bytes(*args).decode().strip()

def sha(data):
    return hashlib.sha256(data).hexdigest()

def write_json(name, value):
    (EVIDENCE / name).write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')

labels = ['focused-1', 'focused-2', 'focused-3', 'root-tests', 'root-typecheck', 'root-lint']
receipts = [json.loads((EVIDENCE / (label + '.json')).read_text()) for label in labels]
raw = (REPO / TARGET).read_bytes()
for receipt in receipts:
    assert receipt['exit'] == 0 and receipt['sourceUnchanged'] is True
    assert receipt['sourceBefore'] == receipt['sourceAfter']
    assert receipt['sourceAfter']['sha256'] == sha(raw)
    assert receipt['sourceAfter']['gitBlob'] == git('hash-object', TARGET)
    assert receipt['head'] == START and receipt['tree'] == START_TREE
    assert sha((EVIDENCE / (receipt['label'] + '.log')).read_bytes()) == receipt['logSha256']
for earlier, later in zip(receipts, receipts[1:]):
    assert earlier['end'] < later['start']

validation = []
for receipt in receipts:
    log = (EVIDENCE / (receipt['label'] + '.log')).read_text(encoding='utf-8')
    log = re.sub(r'\x1b\[[0-9;]*m', '', log)
    files = [int(n) for n in re.findall(r'Test Files\s+(\d+) passed', log)]
    tests = [int(n) for n in re.findall(r'Tests\s+(\d+) passed', log)]
    if receipt['label'].startswith('focused-'):
        assert files == [1] and tests == [23]
    elif receipt['label'] == 'root-tests':
        assert sum(files) == 579 and sum(tests) == 8639
        assert re.search(r'Cached:\s+0 cached, 3 total', log)
    else:
        assert re.search(r'Tasks:\s+4 successful, 4 total', log)
        assert re.search(r'Cached:\s+0 cached, 4 total', log)
    validation.append({**receipt, 'passedTestFiles': sum(files), 'passedTests': sum(tests),
                       'receipt': receipt['label'] + '.json', 'log': receipt['label'] + '.log'})

head = git('rev-parse', 'HEAD')
tree = git('rev-parse', 'HEAD^{tree}')
branch = git('branch', '--show-current')
parent = git('rev-parse', 'HEAD^')
assert branch == 'stage/m1-native-runtime47' and parent == START
assert git('status', '--porcelain=v1') == ''
assert git('rev-list', '--count', START + '..HEAD') == '1'
assert git('diff', '--name-only', START, 'HEAD').splitlines() == [TARGET]
subprocess.run(['git', 'merge-base', '--is-ancestor', PR48, 'HEAD'], cwd=REPO, check=True)
blob = git('rev-parse', 'HEAD:' + TARGET)
blob_bytes = git_bytes('cat-file', 'blob', blob)
assert blob == receipts[0]['sourceBefore']['gitBlob']
assert blob_bytes.decode() == raw.decode().replace('\r\n', '\n')
identity = {
    'host': '[LOCAL_HOST]', 'worktree': str(REPO), 'branch': branch,
    'start': {'head': START, 'tree': START_TREE, 'parent': '8b63185db4400d43517c7e05a2e8ad8371e984ca', 'clean': True},
    'final': {'head': head, 'tree': tree, 'parent': parent, 'statusPorcelain': '', 'clean': True},
    'pr48Ancestor': PR48, 'pr48Preserved': True,
    'appendOnlyCommits': [{'head': head, 'subject': git('log', '-1', '--format=%s')}],
    'committedSource': {'path': TARGET, 'blob': blob, 'blobSha256': sha(blob_bytes),
                        'worktreeSha256': sha(raw), 'matchesEveryValidation': True,
                        'lineEndingNormalizedContentMatches': True},
    'verifiedAtUtc': datetime.datetime.now(datetime.timezone.utc).isoformat()
}
write_json('GIT_IDENTITY.json', identity)
write_json('CHANGED_FILES.json', {'files': [TARGET], 'count': 1,
           'numstat': git('diff', '--numstat', START, 'HEAD'),
           'productionFixturesAdaptersAndSharedHelpersUnchanged': True})
(EVIDENCE / 'SOURCE.diff').write_bytes(git_bytes('diff', '--binary', '--full-index', START, 'HEAD', '--', TARGET))
write_json('VALIDATION.json', {'result': 'PASS', 'runs': validation, 'sequential': True,
           'failures': [], 'rerunsBeyondRequiredThreeFocusedRuns': [],
           'sourceUnchangedAcrossEveryRunAndCommittedBlob': True,
           'warnings': 'Existing react-test-renderer deprecation and other suite diagnostics are retained in raw logs; no validation failure.',
           'scopeAudit': 'SOURCE_INVARIANTS.json', 'configuredLint': 'Repository configured lint only; no stronger lint coverage claimed.'})
prohibited = [
    'New spend or paid operations', 'Downloads, dependency installation or tooling updates',
    'Network or outside provider contact', 'Actual private payload access',
    'Account, permission or access changes', 'Production or backend changes',
    'Hosted CI, cloud engineering or remote test execution', 'GitHub push, upload or publication',
    'Browser work or browser journeys', 'Native, device or simulator attempts',
    'Merge, deployment or release', 'Reset, rebase, stash, clean, checkout, branch switch or new worktree',
    'Product, shared fixture, shared helper or adapter edits', 'Frozen contract or acceptance edits',
    'Crafted persisted records, vulnerability reproduction, exploit or penetration testing',
    'Timeout increase, arbitrary sleep, concurrency change, assertion reduction, test skip or activation retry',
    'Changes to older engineering evidence', 'ZIP creation'
]
write_json('PROHIBITED_OPERATIONS.json', {'authorization': 'BRAIN-ONSKIN-FORMULA-HISTORY-TEST-READINESS-26',
           'mode': 'LOCAL_ONLY / DEFENSIVE / ZERO_NEW_PAID_OPERATIONS',
           'notPerformed': prohibited, 'unexpectedDownloadAttempts': [],
           'blockedOrPendingActions': [], 'localCommitCount': 1,
           'requirementsAccepted': 0, 'gatesAccepted': 0,
           'professionalIdentityProviderCustody': 'HOLD',
           'j01': 'Visible Pores only; inactive and refusing positive results',
           'release': 'NO_GO', 'independentAcceptanceAuthority': 'Brain'})
rows = '\n'.join(f"| {r['label']} | {r['passedTests'] or 'Configured check'} | {r['exit']} | {r['seconds']} |" for r in validation)
report = f"""# Engineering26 local checkpoint

COMPLETE_LOCAL_CHECKPOINT

Relay: DOT_RELAY: ENGINEERING26_LOCAL_CHECKPOINT_001
Authorization: BRAIN-ONSKIN-FORMULA-HISTORY-TEST-READINESS-26

The initial shared formula-history journey setup now observes the exact mounted and enabled `Record label observation` control before pressing it. It uses `vi.waitFor` with the installed Vitest defaults (1,000 ms timeout and 50 ms polling interval), with a React `act` microtask flush before each observation. The wait never activates the control. This is a test synchronization correction, with no product change or product defect claim.

Only `{TARGET}` changed: seven lines added and one removed. The initial `flush26` call after mount was replaced; the shared helper itself and every later wait are untouched. `press()` keeps its original existence/enabled assertions and one activation. Every test body, assertion, parameterization, original authority and fixture remains identical. SOURCE_INVARIANTS.json records exact replacement and test-body hash verification; a separate read-only review found no blocker. No timeout/interval option, arbitrary sleep, activation retry, concurrency change or skip was added.

## Git identity

- Host: [LOCAL_HOST]; worktree: `{REPO}`
- Branch: `{branch}`; clean at baseline and final verification.
- Start HEAD: `{START}`
- Start tree: `{START_TREE}`
- Start direct parent: `8b63185db4400d43517c7e05a2e8ad8371e984ca`
- Final HEAD: `{head}`
- Final tree: `{tree}`
- Final direct parent: `{parent}`
- One append-only local commit: `{git('log', '-1', '--format=%s')}`
- PR48 ancestor `{PR48}` preserved (exit 0).
- Committed source blob: `{blob}`
- Worktree source SHA-256: `{sha(raw)}`
- Committed blob SHA-256: `{sha(blob_bytes)}`

The final committed blob matches all six validation runs. Raw source SHA-256 and Git blob identity were recorded before and after each run, with no drift. Git-normalized committed content equals the working source. All other repository files are unchanged. No competing writer was observed during preflight; source scope and hashes remained stable throughout.

## Validation

The required commands ran sequentially, with installed local tooling and offline/no-telemetry environment settings. No browser work ran concurrently. Each raw log and receipt is retained.

| Run | Passed tests | Exit | Seconds |
| --- | ---: | ---: | ---: |
{rows}

All three focused runs passed all 23 existing cases. The uncached root suite passed 8,639 tests in 579 files (mobile 7,964/554; professional web 651/18; catalog console 24/7), with 3 successful tasks and 0 cached. Root typecheck and configured lint each passed 4 tasks with 0 cached. The target suite also passed 23 cases within the root run. Root lint remains the repository's configured checks; no broader lint coverage is claimed.

No E26 validation failed, and no extra validation retries occurred. Existing suite diagnostics, including react-test-renderer deprecation warnings, remain in the raw logs. There are no unresolved blockers. Successful local runs do not establish native/device qualification or eliminate every possible future timing failure.

## Evidence and limits

BASELINE.json, GIT_IDENTITY.json, CHANGED_FILES.json, SOURCE.diff, SOURCE_INVARIANTS.json, VALIDATION.json, three focused logs/receipts, root test/typecheck/lint logs/receipts, and PROHIBITED_OPERATIONS.json provide the source and validation record. Local evidence helper scripts are included for reproducibility. SHA256SUMS.txt lists every evidence file except itself; every listed hash was independently recomputed after manifest generation.

No prohibited operation was performed; the exact list is in PROHIBITED_OPERATIONS.json. No ZIP, upload, push, dependency download/install, external provider, actual private data, browser, native/device/simulator, cloud CI, production, merge, deployment or release operation occurred. Older evidence remains untouched.

All 38 requirements and 18 gates remain UNACCEPTED. Professional identity/provider/custody remains HOLD. J01 Visible Pores remains the only Korean assessment, inactive and refusing positive results. Release remains NO_GO. This is a local engineering checkpoint only; Brain retains independent source review and acceptance authority.
"""
(EVIDENCE / 'FINAL_REPORT.md').write_text(report, encoding='utf-8')
manifest = EVIDENCE / 'SHA256SUMS.txt'
entries = [(p.name, sha(p.read_bytes())) for p in sorted(EVIDENCE.iterdir()) if p.is_file() and p != manifest]
manifest.write_text(''.join(f'{digest}  {name}\n' for name, digest in entries), encoding='utf-8')
for name, digest in entries:
    assert sha((EVIDENCE / name).read_bytes()) == digest
assert {p.name for p in EVIDENCE.iterdir() if p.is_file() and p != manifest} == {name for name, _ in entries}
print(json.dumps({'result': 'COMPLETE_LOCAL_CHECKPOINT', 'head': head, 'tree': tree,
                  'clean': True, 'manifestFilesVerified': len(entries),
                  'manifestSha256': sha(manifest.read_bytes()), 'report': str(EVIDENCE / 'FINAL_REPORT.md')}))
