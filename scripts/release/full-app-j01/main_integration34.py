"""Campaign34 finite read-only reader integrity and separate pinned33/32/29 replay."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
from types import SimpleNamespace
import urllib.request

ROOT = Path(__file__).resolve().parents[3]
BASE = '4ca36e915608460a1ed97d7fff94a3ece61296ab'
BASE_TREE = '49945b4e453b4fc30ceb175f330c8b4b924afe31'
MAIN = '53a84d921d14dbff1d2e9b8f1b3bb27e10dcede6'
PARENT_BRANCH = 'stage/m1-fullapp-j01-scope-cutover33'
BRANCH = 'stage/m1-fullapp-dual-scope-readers34'
PLAN_COMMIT = 'fe0782e37b8eb74b1f097ae8b2def6cde4a478b8'
PLAN = 'docs/brain/task-specs/M1X-34/SCOPE_PLAN.md'
PLAN_SHA = '3254681ec8e36887d7f6948890836de7f01e8f2058ea52e6ada5a475b7261535'
AUTHORITY = 'BRAIN-M1X-FULLAPP-PROTECTED-READER-ADOPTION34-CANDIDATE-01'
PREFIX = 'scripts/release/full-app-j01/'
DOCS = 'docs/release/full-app-j01/'
TASK = 'docs/brain/task-specs/M1X-34/TASK.md'
SOURCE = {TASK, DOCS+'cutover34.md', DOCS+'consumer-migration34.v1.json',
          'scripts/launch/candidate-scope34.mjs', 'scripts/launch/candidate-scope34.test.mjs',
          'scripts/launch/consumer-entry34.test.mjs', 'scripts/launch/contract.mjs',
          'scripts/launch/execution-baseline.mjs', PREFIX+'main_integration34.py',
          PREFIX+'main_integration34.test.py', PREFIX+'source_consumer34.test.py',
          '.github/workflows/quality.yml', 'PROGRESS.md'}
WORKLIST = {'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md'}
GRANT = SOURCE | WORKLIST | {PLAN, 'scripts/launch/contract-smoke.mjs',
    'scripts/launch/build-execution-baseline.mjs', 'scripts/launch/validate-execution-baseline.mjs',
    'apps/mobile/app.config.js', 'scripts/launch/governed-evidence-chain.mjs',
    'scripts/launch/governed-evidence-chain.test.mjs'}
ADMISSIONS = ['DB06', 'DB08', 'R2B', 'M103', 'M2', 'NATIVE', 'J01', 'CLINICAL',
              'PROVIDER', 'PAID', 'APPLE', 'PUBLIC', 'G97']
PARENT_SHA = '1176d7fa42f23ecde717ac4c9a96e5eb855774ac4e3bc2813f970a4004065616'
PRODUCER_SHA = 'b3882f954498008cd80fe57d50f75c358504bca99f5f97b7481239977af26d1e'
REQUIRED = [f'F{i:02}' for i in range(1, 21) if i != 18] + [f'V2-C{i:02}' for i in range(1, 13)] + [f'P{i:02}' for i in range(1, 7)] + ['J01']
DEFERRED = ['F18'] + [f'J{i:02}' for i in range(2, 28)]
GATES = ['G97', 'DB', 'M1-03', 'M2-01', 'G1', 'G2', 'G3', 'G4', 'G5', 'RIGHTS',
         'CLINICAL', 'PROVIDER', 'PAYMENT', 'MODERATION', 'OPERATIONS', 'DEVICE', 'APPLE', 'PUBLIC']
DOCUMENT_PINS = {
    'scripts/launch/full-app-contract33.mjs': '9bcc7fc1ce631f861faaea2857252a9c7cfc6639a00f742a5b71503e6744e5a0',
    DOCS+'contract.v2.json': '0578cb851f28aa26c289793fad76edd862d4222073e0fcc5c3b5210849026495',
    DOCS+'matrix.v2.json': '1daafaa86df15dc14af8250a395ab86a7534f2d2a7738c0c0ce1555c1a91a7f0',
    DOCS+'precedence.v2.json': 'd386e395fc42c716f85121e977393b185d2c75344bdd63c4a4b44a896c4efa39',
    DOCS+'roadmap.v2.json': 'd057d0a2b6b3f6bb07150cf5a751ae922f186466a12bcd61edba824f0bee5017',
    DOCS+'owner-ledger33.v1.json': 'a9390584684fbfef3c4988993be54c12bcfa7211ed2d4dffaa4ef9a2cc8cb420',
}
PARENT = None

NEW_STEP = '''      - name: Verify read-only dual-scope34 and separately pinned33/32/29
        run: |
          set -euo pipefail
          if [ "$(git rev-parse --is-shallow-repository)" = true ]; then
            git fetch --no-tags --unshallow origin
          fi
          if [ "$GITHUB_EVENT_NAME" = pull_request ]; then
            git fetch --no-tags origin "$GITHUB_REF"
            test "$(git rev-parse FETCH_HEAD)" = "$GITHUB_SHA"
          fi
          python3 -I -B scripts/release/full-app-j01/main_integration34.test.py
          python3 -I -B scripts/release/full-app-j01/source_consumer34.test.py
          node --test scripts/launch/candidate-scope34.test.mjs scripts/launch/consumer-entry34.test.mjs
          node scripts/launch/candidate-scope34.mjs --mode verification
          node scripts/launch/check-contract.mjs --scope full-app-j01-v2
          python3 -I -B scripts/release/full-app-j01/main_integration34.py
          # Exact original main_integration33.py and its source/negative/CLI tests run only at pinned PR36.
          # Its --historical mode separately authenticates original32 and Release29; no current-source admission33.
          python3 -I -B scripts/release/full-app-j01/main_integration34.py --historical
          python3 -B scripts/release/full-app-j01/test_contract.py
          python3 -B scripts/release/full-app-j01/source_consumer09.test.py
          node scripts/docs/source-packet-supersession09.test.mjs

'''


def need(ok, code):
    if not ok:
        raise ValueError(code)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def parent():
    """Only pinned reusable helpers; original33.verify is never a successor validator."""
    global PARENT
    if PARENT is None:
        path = ROOT/PREFIX/'main_integration33.py'
        raw = path.read_bytes()
        need(digest(raw) == PARENT_SHA, 'R34_PARENT_CHECKER_BYTES')
        ns = {'__name__': 'unchanged33_helpers_not_successor_admission', '__file__': str(path)}
        exec(compile(raw, str(path), 'exec'), ns)
        PARENT = SimpleNamespace(**ns)
    return PARENT


def git(*args):
    return parent().git(*args)


def text(*args):
    return git(*args).decode().strip()


def document(raw):
    return parent().document(raw)


def parents(commit):
    return text('rev-list', '--parents', '-n', '1', commit).split()


def changed(before, after, allowed):
    return parent().parent().delta(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', before, after), allowed)


def authenticate_parent():
    p = parent()
    need(text('rev-parse', BASE+'^{tree}') == BASE_TREE, 'R34_PARENT_TREE')
    p.authenticate_parent()
    source, seal = p.phase_guard(text('rev-list', '--reverse', p.BASE+'..'+BASE).splitlines())
    need(source == '7bae622aaa3cc26304abd5f657ec6918b8c10b17' and seal == BASE, 'R34_PARENT_PHASES')
    p.task_guard(document(git('show', source+':'+p.TASK)), lambda name: git('show', source+':'+name))
    p.parent().worklist_guard(document(git('show', BASE+':docs/phase-4/generated/source-worklist.json')), source)
    need(parents(PLAN_COMMIT) == [PLAN_COMMIT, BASE] and
         digest(git('show', PLAN_COMMIT+':'+PLAN)) == PLAN_SHA and
         changed(BASE, PLAN_COMMIT, {PLAN}) == {PLAN}, 'R34_PLAN_FIRST')
    need(digest(git('show', BASE+':scripts/phase4/build-source-worklist.mjs')) == PRODUCER_SHA,
         'R34_UNCHANGED_PRODUCER')


def task_guard(value, body):
    need(type(value) is dict and set(value) == {'schema', 'authority', 'base', 'baseTree',
         'planCommit', 'sourceHashes', 'acceptanceGranted', 'admissions', 'release', 'qualification'}, 'R34_TASK_SCHEMA')
    need(type(value['schema']) is int and value['schema'] == 1 and value['authority'] == AUTHORITY and
         value['base'] == BASE and value['baseTree'] == BASE_TREE and value['planCommit'] == PLAN_COMMIT and
         value['acceptanceGranted'] is False and value['release'] == 'NO_GO' and
         value['qualification'] == 'SOURCE_INTEGRITY_NOT_QUALIFIED_ACCEPTANCE' and
         value['admissions'] == dict.fromkeys(ADMISSIONS, False) and
         all(v is False for v in value['admissions'].values()), 'R34_NO_ADMISSION')
    need(type(value['sourceHashes']) is dict and set(value['sourceHashes']) == SOURCE-{TASK}, 'R34_HASH_INVENTORY')
    for path, sha in value['sourceHashes'].items():
        need(type(sha) is str and re.fullmatch('[0-9a-f]{64}', sha) and digest(body(path)) == sha, 'R34_FROZEN_SOURCE')


def phase_guard(commits):
    need(3 <= len(commits) <= 32 and commits[0] == PLAN_COMMIT and len(set(commits)) == len(commits),
         'R34_HISTORY_PHASES')
    previous = PLAN_COMMIT
    union = set()
    for source in commits[1:-1]:
        need(parents(source) == [source, previous], 'R34_LINEAR_HISTORY')
        paths = changed(previous, source, SOURCE)
        need(paths, 'R34_EMPTY_SOURCE_PHASE')
        union.update(paths)
        previous = source
    seal = commits[-1]
    need(parents(seal) == [seal, previous] and union == SOURCE and
         changed(previous, seal, WORKLIST) == WORKLIST, 'R34_SOURCE_THEN_SEAL')
    return previous, seal


def quality_guard(raw, before):
    start = b'      - name: Verify full-app scope33 and separately pinned integration32/Release29\n'
    stop = b'      - name: Verify tooling security backports\n'
    need(before.count(start) == before.count(stop) == 1, 'R34_QUALITY_BASE')
    a, rest = before.split(start)
    _, b = rest.split(stop)
    need(raw == a+NEW_STEP.encode()+stop+b, 'R34_QUALITY_ONLY_FIRST_GOVERNANCE_STEP')


def scope_guard(value):
    need(type(value) is dict and set(value) == {'valid', 'schemaVersion', 'scope', 'mode', 'contract',
         'requiredRows', 'deferredRows', 'totalRows', 'requiredIds', 'deferredIds', 'obligations',
         'unadmittedGates', 'provenance', 'externalReady', 'candidateReady', 'acceptanceGranted', 'release'} and
         value.get('valid') is True and value.get('scope') == 'full-app-j01-v2' and
         value.get('mode') == 'verification' and value.get('contract') == 'onskin-full-app-j01-campaign33-v2' and
         type(value.get('schemaVersion')) is int and value['schemaVersion'] == 2 and
         value.get('requiredIds') == REQUIRED and value.get('deferredIds') == DEFERRED and
         all(type(value.get(k)) is int and value[k] == n for k, n in
             [('requiredRows', 38), ('deferredRows', 27), ('totalRows', 65)]) and
         value.get('unadmittedGates') == GATES and
         value.get('externalReady') is False and value.get('candidateReady') is False and
         value.get('acceptanceGranted') is False and value.get('release') == 'NO_GO', 'R34_CANDIDATE_NO_ADMISSION')
    rows = value['obligations']
    need(type(rows) is list and len(rows) == 65 and all(type(row) is dict and
         set(row) == {'id', 'action', 'gates', 'complete', 'positiveOutputEnabled', 'ownerAdmitted'} and
         type(row.get('id')) is str for row in rows) and
         {row['id'] for row in rows} == set(REQUIRED+DEFERRED), 'R34_OBLIGATION_IDENTITIES')
    for row in rows:
        need(row['action'] == ('DEFERRED_NOT_AUTHORIZED' if row['id'] in DEFERRED else 'VERIFY_REQUIRED_OBLIGATION') and
             row['complete'] is False and row['positiveOutputEnabled'] is False and row['ownerAdmitted'] is False and
             type(row['gates']) is list and all(type(gate) is str for gate in row['gates']) and
             len(row['gates']) == len(set(row['gates'])) and
             all(gate in GATES for gate in row['gates']), 'R34_OBLIGATION_NO_ADMISSION')
    expected_rows, expected_provenance = pinned_projection()
    need(rows == expected_rows, 'R34_OBLIGATION_PINNED_GATES')
    provenance = value['provenance']
    need(type(provenance) is dict and provenance == expected_provenance and provenance.get('assessmentRenewed') is False,
         'R34_CANDIDATE_PROVENANCE')
    return value


def pinned_projection():
    """Derive exact gates and provenance from independently hash-pinned Git bodies."""
    documents = {}
    pins = []
    for path, sha in DOCUMENT_PINS.items():
        raw = git('show', BASE+':'+path)
        need(digest(raw) == sha, 'R34_PROJECTION_DOCUMENT_PIN')
        oid = hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
        need(git('ls-tree', BASE, '--', path) == ('100644 blob '+oid+'\t'+path+'\n').encode(),
             'R34_PROJECTION_DOCUMENT_MODE')
        pins.append(dict(path=path, mode='100644', blob=oid, sha256=sha))
        if path.startswith(DOCS):
            documents[path[len(DOCS):]] = document(raw)
    matrix = documents['matrix.v2.json']
    contract = documents['contract.v2.json']
    precedence = documents['precedence.v2.json']
    refs = {}
    for ref in [ref for row in matrix['rows'] for ref in row['source_refs']] + [matrix['history']['source_ref']] + matrix['history']['snapshot_refs']:
        refs[ref['path']] = ref
    rows = [dict(id=row['id'], action='DEFERRED_NOT_AUTHORIZED' if row['id'] in DEFERRED else 'VERIFY_REQUIRED_OBLIGATION',
        gates=row['gates'], complete=False, positiveOutputEnabled=False, ownerAdmitted=False) for row in matrix['rows']]
    provenance = dict(assessedHead=contract['source_base'], assessedTree=contract['source_base_tree'],
        integrationBase=BASE, integrationTree=BASE_TREE, readerPlan=PLAN_COMMIT, assessmentRenewed=False,
        sourceValidity=precedence['source_validity']['kind'], documentPins=pins,
        checkedCurrentSourceRefs=list(refs.values()), historicalAnchors=precedence['source_anchors'])
    return rows, provenance


def ci_guard(env, event, checkout, tree, merge, merge_tree, live, live_pr=None):
    if env.get('GITHUB_ACTIONS') != 'true':
        need(not any(k.startswith('GITHUB_') for k in env), 'R34_LOCAL_CONTEXT')
        return 'LOCAL_EXACT_CHECKOUT_NOT_CI'
    need(env.get('GITHUB_REPOSITORY') == 'TasfiqJ/onSkin' and type(event) is dict and
         event.get('repository', {}).get('full_name') == 'TasfiqJ/onSkin', 'R34_CI_REPOSITORY')
    need(env.get('GITHUB_EVENT_NAME') == 'pull_request', 'R34_CI_KIND')
    pr = event.get('pull_request', {})
    number = event.get('number')
    def exact(value):
        return type(value) is dict and type(number) is int and number > 36 and value.get('number') == number and \
            type(value.get('number')) is int and value.get('state') == 'open' and value.get('draft') is True and \
            value.get('merged_at') is None and value.get('closed_at') is None and value.get('merged', False) is False and \
            value.get('maintainer_can_modify') is False and 'auto_merge' in value and value['auto_merge'] is None and \
            value.get('base', {}).get('sha') == BASE and value['base'].get('ref') == PARENT_BRANCH and \
            value.get('head', {}).get('sha') == checkout and value['head'].get('ref') == BRANCH and \
            value['head'].get('repo', {}).get('full_name') == 'TasfiqJ/onSkin'
    need(exact(pr) and env.get('GITHUB_REF') == 'refs/pull/'+str(number)+'/merge', 'R34_CI_EVENT')
    need(exact(live_pr), 'R34_LIVE_PR')
    need(merge == [env.get('GITHUB_SHA'), BASE, checkout] and merge_tree == tree, 'R34_CI_TEST_MERGE')
    need(live == dict(main=MAIN, parent=BASE, source=checkout), 'R34_STALE_HEAD_OR_PARENT')
    return 'EXACT_EVENT_LIVE_PR_PARENT_MAIN_SOURCE_AND_TEST_MERGE'


def live_refs(include_source):
    names = {'refs/heads/main': 'main', 'refs/heads/'+PARENT_BRANCH: 'parent'}
    if include_source:
        names['refs/heads/'+BRANCH] = 'source'
    lines = text('ls-remote', '--exit-code', 'origin', *names).splitlines()
    result = {}
    for row in lines:
        sha, name = row.split()
        need(name in names and names[name] not in result and re.fullmatch('[0-9a-f]{40}', sha), 'R34_LIVE_REFS')
        result[names[name]] = sha
    need(set(result) == set(names.values()), 'R34_LIVE_REFS')
    return result


def verify():
    need(not sys.flags.optimize, 'R34_ASSERTIONS')
    p = parent()
    old = p.parent()
    check = old.helpers()
    check.full29_store()
    authenticate_parent()
    checkout = text('rev-parse', 'HEAD')
    tree_sha = text('rev-parse', 'HEAD^{tree}')
    need(len(parents(checkout)) == 2, 'R34_CHECKOUT_SOURCE_NOT_MERGE')
    in_ci = os.environ.get('GITHUB_ACTIONS') == 'true'
    if not in_ci:
        need(text('symbolic-ref', '--short', 'HEAD') == BRANCH, 'R34_WRONG_BRANCH')
        need(live_refs(False) == dict(main=MAIN, parent=BASE), 'R34_STALE_HEAD_OR_PARENT')
    source, seal = phase_guard(text('rev-list', '--reverse', BASE+'..'+checkout).splitlines())
    need(changed(BASE, seal, SOURCE|WORKLIST|{PLAN}) == SOURCE|WORKLIST|{PLAN}, 'R34_COMPLETE_SCOPE')
    need(git('show', seal+':'+PLAN) == git('show', PLAN_COMMIT+':'+PLAN), 'R34_PLAN_IMMUTABLE')
    task_guard(document(git('show', source+':'+TASK)), lambda name: git('show', source+':'+name))
    quality_guard(git('show', source+':.github/workflows/quality.yml'), git('show', BASE+':.github/workflows/quality.yml'))
    worklist = document(git('show', seal+':docs/phase-4/generated/source-worklist.json'))
    old.worklist_guard(worklist, source)
    need(worklist.get('warnings') == [], 'R34_WORKLIST_WARNINGS')
    index_tree = check.tree29(checkout)
    index = git('ls-files', '--stage', '-z')
    expected = b''.join((mode+' '+oid+' 0\t'+path+'\0').encode() for path, (mode, oid) in index_tree.items())
    overrides = old.filter_overrides()
    need(index == expected and not git(*overrides, 'status', '--porcelain=v1', '--untracked-files=all', '-z'), 'R34_DIRTY')
    need(all(line.startswith(b'H ') for line in git('ls-files', '-v', '-z').split(b'\0') if line), 'R34_INDEX_FLAGS')
    checked = check.working29_guard(index_tree)
    scope = scope_guard(document(old.child(['node', 'scripts/launch/candidate-scope34.mjs', '--mode', 'verification'], ROOT, dict(os.environ))))
    event = {}
    live = {}
    merge = []
    merge_tree = None
    live_pr = None
    if in_ci:
        event_path = Path(os.environ.get('GITHUB_EVENT_PATH', ''))
        need(event_path.is_absolute(), 'R34_EVENT_PATH')
        event = document(check.regular29(event_path, 1024*1024))
        number = event.get('number')
        need(type(number) is int and number > 36, 'R34_CI_EVENT')
        live = live_refs(True)
        request = urllib.request.Request('https://api.github.com/repos/TasfiqJ/onSkin/pulls/'+str(number),
            headers={'Accept': 'application/vnd.github+json', 'User-Agent': 'onSkin-Campaign34-source-verifier'})
        with urllib.request.urlopen(request, timeout=30) as response:
            live_pr = document(response.read(1024*1024+1))
        sha = os.environ.get('GITHUB_SHA', '')
        need(re.fullmatch('[0-9a-f]{40}', sha), 'R34_CI_SHA')
        merge = parents(sha)
        merge_tree = text('rev-parse', sha+'^{tree}')
    qualification = ci_guard(os.environ, event, checkout, tree_sha, merge, merge_tree, live, live_pr)
    need(git('ls-files', '--stage', '-z') == index and text('rev-parse', 'HEAD') == checkout and
         not git(*overrides, 'status', '--porcelain=v1', '--untracked-files=all', '-z'), 'R34_FINAL_SNAPSHOT')
    return dict(valid=True, qualification=qualification, head=checkout, tree=tree_sha, sourceHead=source,
                sealedHead=seal, parentHead=BASE, trackedBlobsHashed=checked,
                governance='CURRENT_CAMPAIGN34_FINITE_READ_ONLY_READERS_ONLY', productScope=scope,
                historicalCheck='SEPARATE_PINNED_PR36_ORIGINAL33_32_29_REQUIRED',
                acceptanceGranted=False, admissions=dict.fromkeys(ADMISSIONS, False), release='NO_GO')


def historical_result(raw):
    value = document(raw)
    need(value.get('status') == 'PASS' and value.get('historicalParentHead') == parent().BASE and
         value.get('historicalParentTree') == parent().BASE_TREE and
         value.get('parentCheckerSHA256') == parent().PARENT_SHA and
         value.get('acceptanceGranted') is False and value.get('release') == 'NO_GO' and
         value.get('current33Proof') == 'SEPARATE_VERIFY_REQUIRED' and
         value.get('qualification') == 'SUPPLIER_PINNED_HISTORICAL_CLONES_NOT_CURRENT33_OR_OWNER_ADMISSION',
         'R34_HISTORICAL33_RESULT')
    need(value.get('originalCurrent32Refusal') == dict(valid=False, error='R32_HISTORY_PHASES', acceptanceGranted=False,
         release='NO_GO'), 'R34_HISTORICAL32_REFUSAL')
    prefix = b'R32_HISTORICAL_CLONE_AUTHENTICATED\nR32_HISTORICAL_NORMAL_INSTALL_AND_HOOKS_PASS\n'
    parent().historical_result(prefix+json.dumps(value.get('release29')).encode())
    return value


def historical():
    """Original main_integration33.py executes only in a fresh exact PR36 checkout."""
    authenticate_parent()
    old = parent().parent()
    checkout = text('rev-parse', 'HEAD')
    checkout_tree = text('rev-parse', 'HEAD^{tree}')
    raw = old.child([sys.executable, '-I', '-B', PREFIX+'main_integration33.py'], ROOT, dict(os.environ), expected=1)
    refusal = document(raw)
    need(set(refusal) == {'valid', 'error', 'acceptanceGranted', 'release'} and refusal['valid'] is False and
         refusal['acceptanceGranted'] is False and refusal['release'] == 'NO_GO' and
         refusal['error'] in {'R33_HISTORY_PHASES', 'R32_FINITE_SCOPE', 'R33_SOURCE_THEN_SEAL'}, 'R34_ORIGINAL33_REFUSAL')
    workspace = Path(tempfile.mkdtemp(prefix='integration34-')).resolve()
    need(not workspace.is_relative_to(ROOT), 'R34_EXTERNAL_CLONE')
    print('R34_HISTORICAL_WORKSPACE '+str(workspace), file=sys.stderr, flush=True)
    root = workspace/'pr36'
    logs = workspace/'logs'
    logs.mkdir()
    receipts = []
    env = old.clean_environment()
    def run(name, args, cwd, expected=0, timeout=900):
        log = logs/(name+'.log')
        started = time.monotonic()
        timed_out = False
        with log.open('wb') as output:
            process = subprocess.Popen(args, cwd=cwd, env=env, stdout=output, stderr=subprocess.STDOUT)
            try:
                process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
                timed_out = True
        body = log.read_bytes()
        need(len(body) <= 8*1024*1024, 'R34_HISTORICAL_OUTPUT')
        receipts.append(dict(name=name, command=args, exit=process.returncode, expectedExit=expected,
                             log=str(log), bytes=len(body), sha256=digest(body), seconds=round(time.monotonic()-started,3),
                             timedOut=timed_out, historicalHead=BASE, historicalTree=BASE_TREE))
        (logs/'receipts.json').write_text(json.dumps(receipts, indent=2)+'\n', encoding='utf-8')
        need(not timed_out, 'R34_HISTORICAL_TIMEOUT')
        need(process.returncode == expected, 'R34_HISTORICAL_CHILD_EXIT')
        return body
    run('clone-pr36', ['git', '-c', 'core.hooksPath=', 'clone', '--no-checkout', '--no-hardlinks',
        '--single-branch', '--branch', PARENT_BRANCH, '-c', 'core.autocrlf=false', '-c', 'core.longpaths=true',
        'https://github.com/TasfiqJ/onSkin.git', str(root)], workspace)
    (root/'.git/info/attributes').write_bytes(b'* -text -eol -filter -ident -working-tree-encoding\n')
    run('checkout-pr36', ['git', '-c', 'core.hooksPath=', 'checkout', '--detach', BASE], root)
    def pinned(*args):
        return old.child(['git', '--no-replace-objects', *args], root, env).decode().strip()
    need(pinned('rev-parse', 'HEAD') == BASE and pinned('rev-parse', 'HEAD^{tree}') == BASE_TREE and
         digest((root/PREFIX/'main_integration33.py').read_bytes()) == PARENT_SHA, 'R34_HISTORICAL_PIN')
    print('R34_EXACT_PR36_FULL_CLONE_AUTHENTICATED', file=sys.stderr, flush=True)
    node = Path(shutil.which('node')).resolve()
    candidates = [node.parent/'node_modules/npm/bin/npm-cli.js'] if os.name == 'nt' else [node.parent.parent/'lib/node_modules/npm/bin/npm-cli.js']
    if os.name == 'nt' and env.get('APPDATA'):
        candidates.insert(0, Path(env['APPDATA'])/'npm/node_modules/npm/bin/npm-cli.js')
    config = workspace/'empty.npmrc'
    config.write_bytes(b'')
    env.update(npm_config_userconfig=os.devnull, npm_config_globalconfig=str(config))
    need(run('node-version', [str(node), '--version'], root).strip() == b'v22.21.0', 'R34_RUNTIME')
    npm = next((path for path in candidates if path.is_file() and
                old.child([str(node), str(path), '--version'], root, env).strip() == b'11.20.0'), None)
    need(npm is not None, 'R34_RUNTIME')
    run('normal-npm-ci', [str(node), str(npm), 'ci', '--ignore-scripts=false', '--no-audit', '--no-fund'], root)
    run('postinstall-check', [str(node), 'scripts/postinstall.mjs', '--check'], root)
    print('R34_PR36_NORMAL_INSTALL_AND_HOOKS_PASS', file=sys.stderr, flush=True)
    for name in ['main_integration33.test.py', 'source_consumer33.test.py']:
        run(name, [sys.executable, '-I', '-B', PREFIX+name], root)
    run('original33-node-controls', [str(node), '--test', 'scripts/launch/full-app-contract33.test.mjs'], root)
    run('original33-default-cli', [str(node), 'scripts/launch/check-contract.mjs'], root)
    run('original33-explicit-cli', [str(node), 'scripts/launch/check-contract.mjs', '--scope', 'full-app-j01-v2'], root)
    run('original33-external-readiness', [str(node), 'scripts/launch/check-contract.mjs', '--scope', 'full-app-j01-v2', '--external-readiness'], root, expected=2)
    original = document(run('original33-current-source', [sys.executable, '-I', '-B', PREFIX+'main_integration33.py'], root))
    need(original.get('valid') is True and original.get('head') == BASE and original.get('tree') == BASE_TREE and
         original.get('acceptanceGranted') is False and original.get('release') == 'NO_GO' and
         original.get('admissions') == dict.fromkeys(ADMISSIONS, False) and
         all(v is False for v in original['admissions'].values()), 'R34_HISTORICAL33_SOURCE')
    run('original151-negatives', [sys.executable, '-B', PREFIX+'test_contract.py'], root)
    run('original09-source-controls', [sys.executable, '-B', PREFIX+'source_consumer09.test.py'], root)
    transcript = run('original33-pinned32-and29', [sys.executable, '-I', '-B', PREFIX+'main_integration33.py', '--historical'], root, timeout=3000)
    # Original33 progress is stderr; retained combined transcript ends with its sole JSON result.
    lines = [line for line in transcript.splitlines() if line]
    need(len(lines) == 3 and lines[:2] == [b'R33_EXACT_PR35_FULL_CLONE_AUTHENTICATED',
         b'R33_PR35_NORMAL_INSTALL_AND_HOOKS_PASS'], 'R34_HISTORICAL33_TRANSCRIPT')
    result = historical_result(lines[-1])
    need(not pinned('status', '--porcelain=v1', '--untracked-files=all') and pinned('rev-parse', 'HEAD') == BASE and
         pinned('rev-parse', 'HEAD^{tree}') == BASE_TREE and text('rev-parse', 'HEAD') == checkout and
         text('rev-parse', 'HEAD^{tree}') == checkout_tree, 'R34_HISTORICAL_CHANGED')
    return dict(status='PASS', historicalHead=BASE, historicalTree=BASE_TREE, checkerSHA256=PARENT_SHA,
                original33=original, original33CurrentRefusal=refusal, original32And29=result,
                receipts=receipts, workspace=str(workspace), npmCache='NORMAL_EXISTING_CACHE_NO_ZERO_CACHE_CLAIM',
                qualification='SUPPLIER_PINNED33_32_29_REPLAY_NOT_CURRENT34_OR_OWNER_ACCEPTANCE',
                acceptanceGranted=False, admissions=dict.fromkeys(ADMISSIONS, False), release='NO_GO')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--historical', action='store_true')
    args = parser.parse_args()
    try:
        print(json.dumps(historical() if args.historical else verify(), sort_keys=True))
        return 0
    except Exception as error:
        code = error.args[0] if type(error) is ValueError and len(error.args) == 1 else None
        safe = code if type(code) is str and re.fullmatch(r'(?:R34|R33|R32|R29|R23)_[A-Z_]+', code) else 'R34_EXECUTION_INCOMPLETE'
        print(json.dumps(dict(valid=False, error=safe, acceptanceGranted=False, release='NO_GO')))
        return 1


if __name__ == '__main__':
    sys.exit(main())
