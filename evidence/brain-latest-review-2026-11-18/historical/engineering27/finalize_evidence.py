import datetime, hashlib, json, re, subprocess
from pathlib import Path

E = Path(__file__).resolve().parent
R = E.parent / 'c16-candidate'
START = '0998a353feee905bf9be5cd728dbb76be4fd23ee'
START_TREE = 'e763a8061f04130aeeb1d16f29df3896bd329d61'
PARENT = 'ac026eea9e6860a19972bf5a6c78057f95eb9320'
PR48 = 'd292743c99c1fb98f5714789f4fd60fb1e7d5a5d'
TARGETS = ['apps/mobile/src/features/today/OptionalChangePanel41.test.tsx',
           'apps/mobile/src/features/today/OptionalChangePanel41.tsx']
def rawgit(*args): return subprocess.check_output(['git', *args], cwd=R)
def git(*args): return rawgit(*args).decode().strip()
def sha(raw): return hashlib.sha256(raw).hexdigest()
def write(name, data): (E / name).write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
labels = ['focused-mounted', 'focused-mounted-corrected', 'focused-required', 'root-tests']
runs = [json.loads((E / (name + '.json')).read_text()) for name in labels]
for i, run in enumerate(runs):
    assert run['exit'] == (1 if i in [0, 3] else 0) and run['sourceUnchanged']
    assert run['sourceBefore'] == run['sourceAfter']
    assert run['head'] == START and run['tree'] == START_TREE
    assert sha((E / (run['label'] + '.log')).read_bytes()) == run['logSha256']
    if i > 0:
        for source in run['sourceAfter']:
            assert source['sha256'] == sha((R / source['path']).read_bytes())
            assert source['gitBlob'] == git('hash-object', source['path'])
    log = re.sub(r'\x1b\[[0-9;]*m', '', (E / (run['label'] + '.log')).read_text(encoding='utf-8'))
    run['log'] = run['label'] + '.log'; run['receipt'] = run['label'] + '.json'
    if i == 0:
        assert re.search(r'Tests\s+1 failed \| 47 passed \(48\)', log)
        run.update(passedTests=47, failedTests=1, passedFiles=0, failedFiles=1)
    elif i == 1:
        assert re.search(r'Tests\s+48 passed \(48\)', log)
        run.update(passedTests=48, failedTests=0, passedFiles=1, failedFiles=0)
    elif i == 2:
        assert re.search(r'Tests\s+60 passed \(60\)', log)
        run.update(passedTests=60, failedTests=0, passedFiles=4, failedFiles=0)
    else:
        assert re.search(r'Tests\s+45 failed \| 7932 passed \(7977\)', log)
        assert re.search(r'Test Files\s+2 failed \| 552 passed \(554\)', log)
        assert re.search(r'Cached:\s+0 cached, 3 total', log)
        run.update(passedTests=7932, failedTests=45, passedFiles=552, failedFiles=2,
                   scope='Completed mobile results; other root workspaces did not report completed results after Turbo failure.')
for a, b in zip(runs, runs[1:]): assert a['end'] < b['start']

assert git('rev-parse', 'HEAD') == START and git('rev-parse', 'HEAD^{tree}') == START_TREE
assert git('rev-parse', 'HEAD^') == PARENT and git('branch', '--show-current') == 'stage/m1-native-runtime47'
assert git('diff', '--name-only', START).splitlines() == TARGETS
assert git('diff', '--cached', '--name-only') == ''
status = rawgit('status', '--porcelain=v1').decode()
assert status.splitlines() == [' M ' + path for path in TARGETS]
subprocess.run(['git', 'merge-base', '--is-ancestor', PR48, 'HEAD'], cwd=R, check=True)
sources = []
for path in TARGETS:
    original_blob = git('rev-parse', 'HEAD:' + path)
    raw = (R / path).read_bytes()
    sources.append({'path': path, 'baselineCommittedBlob': original_blob,
                    'uncommittedCandidateBlob': git('hash-object', path), 'worktreeSha256': sha(raw),
                    'normalizedCandidateSha256': sha(raw.decode().replace('\r\n', '\n').encode()),
                    'matchesPostCorrectionRuns': True, 'candidateCommitted': False})
write('GIT_IDENTITY.json', {'host': '[LOCAL_HOST]', 'worktree': str(R), 'branch': 'stage/m1-native-runtime47',
      'start': {'head': START, 'tree': START_TREE, 'parent': PARENT, 'clean': True},
      'final': {'head': START, 'tree': START_TREE, 'parent': PARENT, 'clean': False, 'statusPorcelain': status},
      'pr48Ancestor': PR48, 'pr48Preserved': True, 'appendOnlyCommits': [], 'stagedFiles': [],
      'sources': sources, 'verifiedAtUtc': datetime.datetime.now(datetime.timezone.utc).isoformat()})
write('CHANGED_FILES.json', {'files': TARGETS, 'count': 2, 'numstat': git('diff', '--numstat', START),
      'onlyAuthorizedFilesChanged': True, 'committed': False})
(E / 'SOURCE.diff').write_bytes(rawgit('diff', '--binary', '--full-index', START))
resolution = 'New primary-path test omitted existing category selection before the factual-text assertion. Added the missing explicit Other personal note press and an Observed local date assertion; retained the original assertion. No production fix, assertion reduction, timing change or blind retry.'
blocker = {'status': 'BLOCKED', 'code': 'PROTECTED_ROOT_REGRESSION_SCOPE_LIMIT',
           'failure': '45 protected tests fail because the existing expo-router mocks omit useFocusEffect required by the new collapsed-entry focus guard.',
           'locations': ['apps/mobile/src/features/routine/planRecovery.test.ts:51',
                         'apps/mobile/src/features/scheduler/cycleReadiness.plan.test.ts:53'],
           'stack': 'apps/mobile/src/features/today/OptionalChangePanel41.tsx:76',
           'allowedFiles': TARGETS,
           'decision': 'Stop without commit. Do not change out-of-scope mocks, conditionally bypass focus protection or rerun unchanged source to hide failure.',
           'review': 'Independent read-only reviewer confirmed both router-only mocks and the retained failure. No reviewer edits/tests.'}
write('BLOCKER.json', blocker)
not_run = []
for name, command in [('root-typecheck', ['npm.cmd', 'run', 'typecheck', '--', '--cache=local:w', '--concurrency=1']),
                      ('root-lint', ['npm.cmd', 'run', 'lint', '--', '--cache=local:w', '--concurrency=1'])]:
    receipt = {'label': name, 'command': command, 'status': 'NOT_RUN', 'exit': None,
               'reason': 'Stopped at unresolved protected root regression under Engineering27 stop instruction.'}
    write(name + '.json', receipt); not_run.append(receipt)
write('VALIDATION.json', {'result': 'BLOCKED', 'runs': runs, 'notRun': not_run,
      'sequential': True, 'sourceUnchangedWithinEveryRun': True, 'postCorrectionRunsMatchRetainedCandidate': True,
      'resolvedFailures': [{'receipt': 'focused-mounted.json', 'passed': 47, 'failed': 1, 'resolution': resolution}],
      'unresolvedFailure': blocker, 'rootReruns': [],
      'discovery': '.tsx direct entries excluded by existing include. Existing observationHistory.test.ts bridge used separately and in root; required focused command ran unchanged.',
      'browserNativeDeviceSimulator': 'NOT_RUN; explicitly not authorized', 'commit': 'NOT_CREATED; qualification failed'})
write('PROHIBITED_OPERATIONS.json', {
      'authorization': 'BRAIN-ONSKIN-TODAY-SAVED-DRAFTS-ENTRY-27', 'mode': 'LOCAL_ONLY / DEFENSIVE / ZERO_NEW_PAID_OPERATIONS',
      'notPerformed': ['New paid operations or spend', 'Downloads, dependency installs or updates', 'External provider or network operations',
        'Actual private data inspection', 'Account, permission or access changes', 'Hosted CI or Actions', 'Cloud engineering or remote execution',
        'Push, upload, publication or ZIP creation', 'Browser journeys', 'Native, simulator, device or App Store work',
        'Production/backend, merge, deploy or release', 'Exploit development, vulnerability reproduction or crafted persisted records',
        'Reset, rebase, stash, clean, checkout, switch or new worktree', 'Source edits outside the two allowed files',
        'Changes to inventory, stores, codecs, proof, history, privateKV, encryption, authority, routes or schema',
        'New persistent state, storage keys, packages or database changes', 'Assertion weakening, skips, arbitrary waits, timeout or concurrency changes',
        'Unchanged-source retry to hide failure', 'Changes to older engineering evidence', 'Source commit or staging after failed qualification'],
      'unexpectedDownloadAttempts': [], 'pendingOrDeniedOperations': [], 'requirements': '38 UNACCEPTED', 'gates': '18 UNACCEPTED',
      'professionalProviderIdentityCustody': 'HOLD', 'j01': 'Visible Pores only; inactive/refusing', 'release': 'NO_GO', 'independentAuthority': 'Brain'})
rows = '\n'.join(f"| {r['label']} | {r['passedTests']} | {r['failedTests']} | {r['exit']} | {r['seconds']} |" for r in runs)
report = f"""# Engineering27 blocked local checkpoint

BLOCKED

DOT_RELAY: ENGINEERING27_LOCAL_CHECKPOINT_001
Authorization: BRAIN-ONSKIN-TODAY-SAVED-DRAFTS-ENTRY-27

## Blocker and retained candidate

The uncached root suite failed 45 protected mobile tests in planRecovery.test.ts and cycleReadiness.plan.test.ts. Both existing expo-router mocks export router only (lines 51 and 53 respectively). The new collapsed-panel focus-generation guard calls useFocusEffect at OptionalChangePanel41.tsx:76, and these mocks do not provide it. The retained raw stack explicitly reports the missing export. This is a concrete test compatibility failure introduced by calling the focus hook while the panel is collapsed, not a timing failure.

The current focus-safe implementation needs those existing Today-rendering mocks to model the focus lifecycle. Those test files are outside the two authorized paths. The task was stopped without changing them, conditionally bypassing focus protection, weakening assertions or repeating root tests on unchanged source. A read-only reviewer independently confirmed this limitation. No implementation commit was created; the candidate is retained unstaged in the two allowed files. Typecheck and lint were not run after the stop condition.

## Implemented candidate scope

Today's collapsed optional-change panel has the heading Your optional change notes, the original primary Record a change (optional) action, and a secondary Saved change drafts action. The secondary action opens the existing inventory directly without creating an editor, saving a draft or appending/submitting history. Its hint says it opens saved factual notes, corrections and retractions; it uses existing Button variants and their unchanged 56px minimum target size.

Only these repository files changed:

- `{TARGETS[1]}`
- `{TARGETS[0]}`

The new entry checks the original captured lease, original isSourceCurrent callback and focus generation. Accepted entry props stay pinned; focus cleanup clears that entry and invalidates its callback. The existing content component takes an initial inventory flag, preserving the inventory's production loader and original authority checks, explicit refresh/resume/discard, Back handler, and all draft/history operations. The primary handler is unchanged. No inventory, store, codec, history, authority, encryption, Local Recovery, route, schema or other source file changed.

Thirteen new mounted cases cover collapsed light/dark controls, direct inventory/no editor/no mutation, original primary behavior, normal owner/account/grant/expiry/withdrawal/source/blur retirement, pinned original authority and explicit fresh remount entry. All 35 existing mounted cases/assertions and original test ports remain unchanged, as verified in SOURCE_INVARIANTS.json. New mounted tests mock inventory delegation; unchanged real inventory/store regressions supply their separate production-path evidence. This candidate is not qualified for acceptance because of the root failure.

## Actual validation

All validation commands ran sequentially with installed local tooling. Before/after source hashes match within every run. Final retained source matches all post-correction runs; production source also matches the initial failed run.

| Run | Passed | Failed | Exit | Seconds |
| --- | ---: | ---: | ---: | ---: |
{rows}

The first mounted run failed one new test and passed 47. {resolution} Its corrected run passed all 48 mounted cases. Both receipts and raw logs remain intact.

The unchanged Vitest include discovers .test.ts files, so the supplied .tsx argument is not independently collected. The existing observationHistory.test.ts bridge imports the mounted panel tests; it was run separately and within root. The exact required focused command passed 60 tests across four discovered suites. Final focused coverage totals 108 passing cases across the corrected mounted and required commands.

Root mobile results: 7,932 passed / 45 failed, with 552 passed / 2 failed files (7,977 tests, 554 files). Turbo exited 1 with 0 successful / 3 total tasks and 0 cached. Other workspaces did not report completed results after the failure; no aggregate root pass is claimed. The root failure was not rerun. Root typecheck and configured lint are NOT_RUN, with explicit not-run receipts. No source timeout, concurrency, fixture, assertion or skip was changed to obtain a pass. Existing suite diagnostics are preserved in raw logs.

No browser, native, simulator or device run was authorized or performed. Mounted/source checks do not establish browser/native accessibility qualification.

## Exact Git identity

- Host/worktree: [LOCAL_HOST] / `{R}`
- Branch: stage/m1-native-runtime47.
- Starting and final HEAD: `{START}`
- Starting and final Git tree: `{START_TREE}`
- Direct parent: `{PARENT}`
- PR48 ancestor: `{PR48}`, preserved (exit 0).
- Baseline clean; final working tree DIRTY with exactly the two allowed modified files, unstaged.
- Append-only commit list: empty; no commit created because qualification failed.

GIT_IDENTITY.json distinguishes baseline committed blobs from uncommitted candidate hashes. No claim is made that candidate blobs are committed. CHANGED_FILES.json and SOURCE.diff retain the exact proposed change. BASELINE.json, SOURCE_INVARIANTS.json, BLOCKER.json, VALIDATION.json and every actual test receipt/log retain the failure history and blocker. Typecheck/lint have NOT_RUN receipts, not fabricated logs. SHA256SUMS.txt covers every evidence file except itself; completeness and every listed hash were recomputed and verified after generation.

## Boundaries

No prohibited operation was performed. PROHIBITED_OPERATIONS.json records the exact exclusions. No ZIP, upload, push, install/download, external provider, private-data access, browser/native/device, hosted CI, account/access change, production, merge, deployment or release occurred. Older engineering evidence is unchanged. No tool action is denied, pending or uncertain; the blocker is the explicit source scope and protected regression requirement.

All 38 requirements and 18 gates remain UNACCEPTED. Professional provider/identity/custody stays HOLD. J01 Visible Pores remains the only Korean assessment and stays inactive/refusing positive results. Release remains NO_GO. Brain retains independent source acceptance and release-readiness authority.
"""
(E / 'FINAL_REPORT.md').write_text(report, encoding='utf-8')
manifest = E / 'SHA256SUMS.txt'
entries = [(p.name, sha(p.read_bytes())) for p in sorted(E.iterdir()) if p.is_file() and p != manifest]
manifest.write_text(''.join(f'{digest}  {name}\n' for name, digest in entries), encoding='utf-8')
for name, digest in entries: assert sha((E / name).read_bytes()) == digest
assert {p.name for p in E.iterdir() if p.is_file() and p != manifest} == {n for n, _ in entries}
print(json.dumps({'result': 'BLOCKED', 'head': START, 'tree': START_TREE, 'parent': PARENT,
                  'clean': False, 'commits': [], 'manifestFilesVerified': len(entries),
                  'manifestSha256': sha(manifest.read_bytes()), 'report': str(E / 'FINAL_REPORT.md')}))
