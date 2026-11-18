import datetime, hashlib, json, re, subprocess
from pathlib import Path

E = Path(__file__).resolve().parent
R = E.parent / 'c16-candidate'
START = '0998a353feee905bf9be5cd728dbb76be4fd23ee'
START_TREE = 'e763a8061f04130aeeb1d16f29df3896bd329d61'
PR48 = 'd292743c99c1fb98f5714789f4fd60fb1e7d5a5d'
ORIGINAL_MANIFEST = '35f9a81f032cbaa229e374d52769c1ee7c726174004b1218f9157fa546f5f1db'
TARGETS = ['apps/mobile/src/features/routine/planRecovery.test.ts',
           'apps/mobile/src/features/scheduler/cycleReadiness.plan.test.ts',
           'apps/mobile/src/features/today/OptionalChangePanel41.test.tsx',
           'apps/mobile/src/features/today/OptionalChangePanel41.tsx']
PINNED = {TARGETS[2]: 'ab63c800285963bcc79275b880d3b68077f85b1605d82992b2714a469036e9a3',
          TARGETS[3]: 'c152a2813d7ffc949ae6ec81a691e3e76e77d2e22e4a64d0a3ded0f1b026562d'}
def rawgit(*args): return subprocess.check_output(['git', *args], cwd=R)
def git(*args): return rawgit(*args).decode().strip()
def sha(raw): return hashlib.sha256(raw).hexdigest()
def write(name, value): (E / name).write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')

labels = ['A-focused-mocks', 'B-focused-mounted', 'C-focused-recovery', 'D-root-tests', 'E-root-typecheck', 'F-root-lint']
runs = [json.loads((E / (label + '.json')).read_text()) for label in labels]
for index, run in enumerate(runs):
    assert run['exit'] == 0 and run['sourceUnchanged'] and run['originalCandidateHashesPreserved']
    assert run['sourceBefore'] == run['sourceAfter']
    assert run['head'] == START and run['tree'] == START_TREE
    for source in run['sourceAfter']:
        assert source['sha256'] == sha((R / source['path']).read_bytes())
        assert source['gitBlob'] == git('hash-object', source['path'])
    log_bytes = (E / (run['label'] + '.log')).read_bytes()
    assert sha(log_bytes) == run['logSha256']
    log = re.sub(r'\x1b\[[0-9;]*m', '', log_bytes.decode())
    run['passedTests'] = sum(map(int, re.findall(r'Tests\s+(\d+) passed', log)))
    run['passedFiles'] = sum(map(int, re.findall(r'Test Files\s+(\d+) passed', log)))
    run['receipt'] = run['label'] + '.json'; run['log'] = run['label'] + '.log'
    if index < 4:
        assert run['passedTests'] == [107, 48, 60, 8652][index]
        assert run['passedFiles'] == [2, 1, 4, 579][index]
        if index == 3:
            assert re.search(r'Tasks:\s+3 successful, 3 total', log)
            assert re.search(r'Cached:\s+0 cached, 3 total', log)
    else:
        assert re.search(r'Tasks:\s+4 successful, 4 total', log)
        assert re.search(r'Cached:\s+0 cached, 4 total', log)
for first, second in zip(runs, runs[1:]): assert first['end'] < second['start']
for path, expected in PINNED.items(): assert sha((R / path).read_bytes()) == expected

old = E.parent / 'ENGINEERING27_EVIDENCE'
assert sha((old / 'SHA256SUMS.txt').read_bytes()) == ORIGINAL_MANIFEST
old_entries = [line.split('  ', 1) for line in (old / 'SHA256SUMS.txt').read_text().splitlines()]
assert len(old_entries) == 22
assert {p.name for p in old.iterdir()} == {name for _, name in old_entries} | {'SHA256SUMS.txt'}
for digest, name in old_entries: assert sha((old / name).read_bytes()) == digest

head, tree, parent = git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD^{tree}'), git('rev-parse', 'HEAD^')
assert parent == START and git('rev-list', '--count', START + '..HEAD') == '1'
assert git('branch', '--show-current') == 'stage/m1-native-runtime47'
assert git('status', '--porcelain=v1') == ''
assert git('diff', '--name-only', START, 'HEAD').splitlines() == TARGETS
subprocess.run(['git', 'merge-base', '--is-ancestor', PR48, 'HEAD'], cwd=R, check=True)
sources = []
for path in TARGETS:
    raw = (R / path).read_bytes()
    blob = git('rev-parse', 'HEAD:' + path)
    content = rawgit('cat-file', 'blob', blob)
    assert blob == git('hash-object', path)
    assert content.decode() == raw.decode().replace('\r\n', '\n')
    sources.append({'path': path, 'blob': blob, 'blobSha256': sha(content), 'worktreeSha256': sha(raw),
                    'matchesAllSixValidationRuns': True, 'pinnedE27Candidate': path in PINNED})
write('GIT_IDENTITY.json', {'host': '[LOCAL_HOST]', 'worktree': str(R), 'branch': 'stage/m1-native-runtime47',
      'start': {'head': START, 'tree': START_TREE, 'parent': 'ac026eea9e6860a19972bf5a6c78057f95eb9320',
                'clean': False, 'requiredDirtyBaseline': list(PINNED), 'staged': [], 'untracked': []},
      'final': {'head': head, 'tree': tree, 'parent': parent, 'clean': True, 'statusPorcelain': ''},
      'appendOnlyCommits': [{'head': head, 'subject': git('log', '-1', '--format=%s')}],
      'pr48Ancestor': PR48, 'pr48Preserved': True, 'sources': sources,
      'originalCandidateHashesPreserved': PINNED, 'originalEvidenceManifestSha256': ORIGINAL_MANIFEST,
      'originalEvidenceEntriesVerified': 22, 'originalEvidenceExtras': [],
      'verifiedAtUtc': datetime.datetime.now(datetime.timezone.utc).isoformat()})
write('CHANGED_FILES.json', {'committedFiles': TARGETS, 'count': 4,
      'newRemediationEdits': TARGETS[:2], 'retainedByteIdenticalCandidate': TARGETS[2:],
      'numstat': git('diff', '--numstat', START, 'HEAD')})
(E / 'SOURCE.diff').write_bytes(rawgit('diff', '--binary', '--full-index', START, 'HEAD'))
write('VALIDATION.json', {'result': 'PASS', 'runs': runs, 'sequence': 'A then B then C then D then E then F',
      'concurrentCommands': False, 'failures': [], 'reruns': [], 'sourceHashesUnchangedAcrossAllSixRuns': True,
      'allCommittedBlobsMatchValidatedSources': True,
      'originalE27Failure': {'report': '../ENGINEERING27_EVIDENCE/FINAL_REPORT.md', 'log': '../ENGINEERING27_EVIDENCE/root-tests.log',
                            'mobilePassed': 7932, 'mobileFailed': 45, 'planRecoveryFailed': 23, 'cycleReadinessFailed': 22,
                            'cause': 'Router-only mocks omitted useFocusEffect; original evidence unchanged.'},
      'testDiscovery': 'B runs existing observationHistory.test.ts bridge for all 48 panel cases. C exact command discovers four .ts suites/60 tests; direct .tsx entry is excluded by unchanged Vitest include.',
      'warnings': 'Existing react-test-renderer and suite diagnostics retained in raw logs. Git CRLF normalization warning retained in tool receipts; raw and committed source hashes distinguished.',
      'limits': 'Configured lint only; no browser/native/device/simulator qualification. Types-workspace no-lint placeholder unchanged.'})
write('PROHIBITED_OPERATIONS.json', {
      'authorization': 'BRAIN-ONSKIN-TODAY-SAVED-DRAFTS-ENTRY-27-REMEDIATION-01',
      'mode': 'LOCAL_ONLY / DEFENSIVE / ZERO_NEW_PAID_OPERATIONS',
      'notPerformed': ['New paid operations or spending', 'Network/provider contact', 'Browser/native/device/simulator/App Store runs',
        'Cloud engineering or other executor', 'Dependency download/install/update', 'Hosted CI or Actions', 'Account/permission/access changes',
        'Actual private data inspection', 'Crafted persisted records', 'Exploit development or vulnerability reproduction',
        'Uploads, ZIP, GitHub push, PR or publication', 'Production/backend changes, merge, deployment or release',
        'Reset, stash, checkout, branch switch, rebase, clean or new worktree', 'Edits to either pinned E27 candidate file',
        'Edits outside the two authorized existing router mock declarations', 'Original E27 evidence modifications',
        'Timeout/concurrency change, arbitrary sleep, skip, weakened assertion, suppressed failure or blind rerun',
        'No-op/conditional focus hook, fake navigation stack, global focus override or production bypass'],
      'unexpectedDownloadAttempts': [], 'pendingDeniedOrUncertainActions': [], 'localCommitCount': 1,
      'requirements': '38 UNACCEPTED', 'gates': '18 UNACCEPTED', 'professionalProviderIdentityCustody': 'HOLD',
      'j01': 'Visible Pores only; inactive/refusing', 'release': 'NO_GO', 'independentAcceptance': 'Pending Brain'})
rows = '\n'.join(f"| {r['label']} | {r['passedTests'] or 'Configured check'} | {r['exit']} | {r['seconds']} |" for r in runs)
paths = '\n'.join('- `' + path + '`' for path in TARGETS)
report = f"""# Engineering27R local checkpoint

COMPLETE_LOCAL_CHECKPOINT

DOT_RELAY: ENGINEERING27R_LOCAL_CHECKPOINT_001
Authorization: BRAIN-ONSKIN-TODAY-SAVED-DRAFTS-ENTRY-27-REMEDIATION-01

## Remediation and original failure

E27 stopped with 7,932 mobile tests passed and 45 failed: 23 in planRecovery and 22 in cycleReadiness.plan. Their router-only test mocks omitted useFocusEffect, called by the retained collapsed-panel focus guard. That failed root run and its report remain unchanged in ENGINEERING27_EVIDENCE. All 22 original entries and its manifest `{ORIGINAL_MANIFEST}` were independently verified with no extras, at baseline and again before completion.

E27R changed only each existing vi.mock('expo-router') declaration in the two authorized test files. Each async factory imports useEffect from React, preserves its exact router methods, and exports `useFocusEffect: (callback: () => void | (() => void)) => useEffect(callback, [callback])`. The callback runs for a mounted focused renderer; its returned cleanup is registered for unmount/dependency change. These two suites do not simulate navigation blur; the unchanged dedicated panel tests separately verify normal focus retirement. Comments document this limit. There is no no-op, conditional hook, fake navigation stack, global focus override or production bypass.

Static full-file comparison proves all bytes outside those mock declarations are unchanged after Git line-ending normalization, including original assertions, fixtures, authority ports and test bodies. A separate read-only review confirmed callback/cleanup/dependency semantics and exact router preservation. Both retained E27 candidate files were never touched and kept their pinned raw SHA-256 values throughout every validation and after commit:

- OptionalChangePanel41.tsx: `{PINNED[TARGETS[3]]}`
- OptionalChangePanel41.test.tsx: `{PINNED[TARGETS[2]]}`

The one local commit includes the original candidate plus the two mock corrections:

{paths}

The retained candidate adds the collapsed heading and direct Saved change drafts entry using existing inventory and original authority. Its original primary action, explicit resume/discard/refresh/Back and canonical draft/history behavior are preserved; E27R introduces no additional product changes.

## Actual validation

All six commands ran in the requested A–F order, sequentially, once each, with installed local tooling. No validation failed in E27R and no reruns occurred. Before/after hashes for all four paths were recorded for every run and matched; final committed blobs match those validated sources. Raw logs, exact commands, UTC timestamps, durations, exits and counts are retained in individual receipts and VALIDATION.json.

| Run | Passed tests | Exit | Seconds |
| --- | ---: | ---: | ---: |
{rows}

A passed both remediated suites, 107 tests. B passed the unchanged 48 mounted panel cases, including focus-retirement coverage, through the existing observationHistory.test.ts bridge. C ran the exact requested command and passed four discovered suites/60 tests; the .tsx argument is not a direct Vitest entry under the unchanged include pattern, so B supplies explicit mounted coverage.

D passed all root workspaces uncached: mobile 7,977 tests/554 files, professional web 651/18, catalog console 24/7; total 8,652 tests/579 files. Turbo reported 3 successful tasks and 0 cached. E typecheck and F configured lint each passed 4 tasks with 0 cached. The types workspace retains its existing no-lint placeholder; no broader lint coverage is claimed. Existing suite diagnostics remain in raw logs.

No browser/native/device/simulator qualification was authorized or performed. This remediation uses the existing synthetic in-memory test infrastructure and does not establish those platform qualifications.

## Git and evidence

- Host/worktree: [LOCAL_HOST] / `{R}`
- Branch: stage/m1-native-runtime47.
- Start HEAD: `{START}`
- Start tree: `{START_TREE}`
- Start parent: `ac026eea9e6860a19972bf5a6c78057f95eb9320`
- Baseline: exactly the two pinned unstaged files, no staged or untracked files.
- Final HEAD: `{head}`
- Final tree: `{tree}`
- Final direct parent: `{parent}`
- One append-only local commit: `{git('log', '-1', '--format=%s')}`
- Final status: clean; exactly four committed changed paths.
- PR48 ancestor `{PR48}` preserved (exit 0).

GIT_IDENTITY.json records raw source hashes and committed blob identities, including Git's existing CRLF normalization for the test candidate. SOURCE.diff includes the complete four-file commit; SOURCE_INVARIANTS.json distinguishes unchanged retained candidate bytes from the two declaration-only remediation edits. BASELINE.json, original-evidence verification receipts, CHANGED_FILES.json, VALIDATION.json, all A–F logs/receipts and PROHIBITED_OPERATIONS.json retain the complete local record. SHA256SUMS.txt covers every actual evidence file except itself; file-set completeness and every listed hash were independently recomputed and verified. Original E27 evidence is untouched.

There are no unresolved blockers or pending/denied/uncertain actions. No prohibited operation was performed; the exact list is in PROHIBITED_OPERATIONS.json. No upload, publication, ZIP, push/PR, merge, release, production change, external provider, private data, dependency download or new paid operation occurred.

All 38 requirements and 18 gates remain UNACCEPTED. Professional provider/identity/custody stays HOLD. J01 Visible Pores remains the only Korean assessment and stays inactive/refusing positive results. Release remains NO_GO. Independent Brain acceptance is pending; Brain retains source acceptance and release-readiness authority.
"""
(E / 'FINAL_REPORT.md').write_text(report, encoding='utf-8')
manifest = E / 'SHA256SUMS.txt'
assert all(p.is_file() for p in E.iterdir())
entries = [(p.name, sha(p.read_bytes())) for p in sorted(E.iterdir()) if p != manifest]
manifest.write_text(''.join(f'{digest}  {name}\n' for name, digest in entries), encoding='utf-8')
for name, digest in entries: assert sha((E / name).read_bytes()) == digest
assert {p.name for p in E.iterdir()} == {name for name, _ in entries} | {'SHA256SUMS.txt'}
print(json.dumps({'result': 'COMPLETE_LOCAL_CHECKPOINT', 'head': head, 'tree': tree, 'parent': parent,
                  'clean': True, 'manifestFilesVerified': len(entries), 'manifestSha256': sha(manifest.read_bytes()),
                  'report': str(E / 'FINAL_REPORT.md')}))
