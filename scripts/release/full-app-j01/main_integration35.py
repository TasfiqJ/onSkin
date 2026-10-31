"""Campaign35 finite source integrity; original34 is a separate pinned replay."""
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
BASE = '7dea6048e5f1f5e397656b5f2fa670929fa9c2b8'
BASE_TREE = '49b0baf1f20ca3d092db5d3cb14156feb2963f61'
MAIN = '53a84d921d14dbff1d2e9b8f1b3bb27e10dcede6'
PARENT_BRANCH = 'stage/m1-fullapp-dual-scope-readers34'
BRANCH = 'stage/m1-free-first-session-e2e35'
PLAN_COMMIT = '74a1d1b449e3942677b327e748a41052552e8ae2'
PLAN = 'docs/brain/task-specs/M1X-35/SCOPE_PLAN.md'
PLAN_SHA = 'b7748505d8dc85d4614beec844480f2e769d68d362e669016a7f76bd755f60c5'
TASK = 'docs/brain/task-specs/M1X-35/TASK.md'
AUTHORITY = 'BRAIN-M1X-FREE-FIRST-SESSION-E2E35-SOURCE-CANDIDATE-01'
PREFIX = 'scripts/release/full-app-j01/'
DOCS = 'docs/release/full-app-j01/'
PARENT_SHA = '342e21de512e4e3bf6dffb5e3ad9b86b6b47c9c30f9815d219cd0ab868858fdb'
WORKLIST = {'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md'}
REQUIRED_SOURCE = {TASK, 'scripts/e2e/onboarding-first-session.mjs',
    'scripts/e2e/onboarding-first-session35.test.mjs', 'docs/USER_FLOW_TREE.md',
    DOCS+'free-first-session35.md', PREFIX+'main_integration35.py',
    PREFIX+'main_integration35.test.py', PREFIX+'source_consumer35.test.py',
    '.github/workflows/quality.yml', 'PROGRESS.md'}
SOURCE_GRANT = REQUIRED_SOURCE | {
    'scripts/e2e/retained-daily-loop.mjs', 'scripts/e2e/retained-safety-assertions.mjs',
    'scripts/e2e/retained-safety-assertions.test.mjs',
    'apps/mobile/src/app/onboarding/notifications.tsx', 'apps/mobile/src/app/onboarding/account.tsx',
    'apps/mobile/src/app/onboarding/paywall.tsx', 'apps/mobile/src/app/onboarding/_layout.tsx',
    'apps/mobile/src/features/notifications/onboarding.ts',
    'apps/mobile/src/features/notifications/notificationContinuation35.test.ts',
    'apps/mobile/src/features/onboarding/freeFirstSession35.test.ts'}
GRANT = SOURCE_GRANT | WORKLIST | {PLAN}
ADMISSIONS = ['DB06', 'DB08', 'R2B', 'M103', 'M2', 'NATIVE', 'J01', 'CLINICAL',
              'PROVIDER', 'PAID', 'APPLE', 'PUBLIC', 'G97']
PARENT = None

NEW_STEP = '''      - name: Verify finite free-first-session35 and separately pinned34/33/32/29
        run: |
          set -euo pipefail
          if [ "$(git rev-parse --is-shallow-repository)" = true ]; then
            git fetch --no-tags --unshallow origin
          fi
          if [ "$GITHUB_EVENT_NAME" = pull_request ]; then
            git fetch --no-tags origin "$GITHUB_REF"
            test "$(git rev-parse FETCH_HEAD)" = "$GITHUB_SHA"
          fi
          python3 -I -B scripts/release/full-app-j01/main_integration35.test.py
          python3 -I -B scripts/release/full-app-j01/source_consumer35.test.py
          node --test scripts/e2e/onboarding-first-session35.test.mjs
          node --test scripts/launch/candidate-scope34.test.mjs scripts/launch/consumer-entry34.test.mjs
          node scripts/launch/candidate-scope34.mjs --mode verification
          node scripts/launch/check-contract.mjs --scope full-app-j01-v2
          python3 -I -B scripts/release/full-app-j01/main_integration35.py
          # Authentic original34 and its controls run only at exact PR37 in a fresh named34 checkout.
          # Its historical mode independently replays original33/32/29; refusals remain refusals.
          python3 -I -B scripts/release/full-app-j01/main_integration35.py --historical
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
    """Authenticate reusable original34 bytes; never rebind its authority."""
    global PARENT
    if PARENT is None:
        path = ROOT/PREFIX/'main_integration34.py'
        raw = path.read_bytes()
        need(digest(raw) == PARENT_SHA, 'R35_PARENT_CHECKER_BYTES')
        namespace = {'__name__': 'unchanged34_helpers_not_successor_admission', '__file__': str(path)}
        exec(compile(raw, str(path), 'exec'), namespace)
        PARENT = SimpleNamespace(**namespace)
    return PARENT


def old():
    return parent().parent().parent()


def git(*args):
    return parent().git(*args)


def text(*args):
    return git(*args).decode().strip()


def document(raw):
    return parent().document(raw)


def parents(commit):
    return text('rev-list', '--parents', '-n', '1', commit).split()


def changed(before, after, allowed):
    return old().delta(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', before, after), allowed)


def authenticate_parent():
    p = parent()
    need(text('rev-parse', BASE+'^{tree}') == BASE_TREE, 'R35_PARENT_TREE')
    p.authenticate_parent()
    source, seal = p.phase_guard(text('rev-list', '--reverse', p.BASE+'..'+BASE).splitlines())
    need(source == 'b8cff3e1e76428a1bc10788c1cfa3b981992aef5' and seal == BASE, 'R35_PARENT_PHASES')
    p.task_guard(document(git('show', source+':'+p.TASK)), lambda name: git('show', source+':'+name))
    old().worklist_guard(document(git('show', BASE+':docs/phase-4/generated/source-worklist.json')), source)
    p.quality_guard(git('show', source+':.github/workflows/quality.yml'),
                    git('show', p.BASE+':.github/workflows/quality.yml'))
    need(parents(PLAN_COMMIT) == [PLAN_COMMIT, BASE] and
         digest(git('show', PLAN_COMMIT+':'+PLAN)) == PLAN_SHA and
         changed(BASE, PLAN_COMMIT, {PLAN}) == {PLAN}, 'R35_PLAN_FIRST')
    need(git('show', BASE+':scripts/phase4/build-source-worklist.mjs') ==
         git('show', p.BASE+':scripts/phase4/build-source-worklist.mjs'), 'R35_UNCHANGED_PRODUCER')


def phase_guard(commits):
    need(3 <= len(commits) <= 32 and commits[0] == PLAN_COMMIT and len(set(commits)) == len(commits),
         'R35_HISTORY_PHASES')
    previous, union = PLAN_COMMIT, set()
    for source in commits[1:-1]:
        need(parents(source) == [source, previous], 'R35_LINEAR_HISTORY')
        paths = changed(previous, source, SOURCE_GRANT)
        need(paths, 'R35_EMPTY_SOURCE_PHASE')
        union.update(paths)
        previous = source
    seal = commits[-1]
    need(parents(seal) == [seal, previous] and REQUIRED_SOURCE <= union <= SOURCE_GRANT and
         changed(previous, seal, WORKLIST) == WORKLIST, 'R35_SOURCE_THEN_SEAL')
    return previous, seal, union


def task_guard(value, body, source_paths):
    fields = {'schema', 'authority', 'base', 'baseTree', 'planCommit', 'sourceHashes',
              'acceptanceGranted', 'admissions', 'release', 'qualification', 'validation', 'sourceSnapshots'}
    need(type(value) is dict and set(value) == fields, 'R35_TASK_SCHEMA')
    need(type(value['schema']) is int and value['schema'] == 1 and value['authority'] == AUTHORITY and
         value['base'] == BASE and value['baseTree'] == BASE_TREE and value['planCommit'] == PLAN_COMMIT and
         value['acceptanceGranted'] is False and value['release'] == 'NO_GO' and
         value['qualification'] == 'SOURCE_INTEGRITY_NOT_QUALIFIED_ACCEPTANCE' and
         value['admissions'] == dict.fromkeys(ADMISSIONS, False) and
         all(v is False for v in value['admissions'].values()), 'R35_NO_ADMISSION')
    need(type(source_paths) is set and REQUIRED_SOURCE <= source_paths <= SOURCE_GRANT and
         type(value['sourceHashes']) is dict and set(value['sourceHashes']) == source_paths-{TASK},
         'R35_HASH_INVENTORY')
    for path, sha in value['sourceHashes'].items():
        need(type(sha) is str and re.fullmatch('[0-9a-f]{64}', sha) and digest(body(path)) == sha,
             'R35_FROZEN_SOURCE')
    need(value['sourceSnapshots'] == dict(parentHead=BASE, parentTree=BASE_TREE, planCommit=PLAN_COMMIT),
         'R35_SOURCE_SNAPSHOTS')
    checks = value['validation']
    need(type(checks) is list and checks and len(checks) <= 256, 'R35_VALIDATION_RECORD')
    for row in checks:
        need(type(row) is dict and set(row) == {'command', 'exit', 'scope'} and
             type(row['command']) is str and 0 < len(row['command']) <= 4096 and
             (row['exit'] is None or type(row['exit']) is int) and
             type(row['scope']) is str and 0 < len(row['scope']) <= 4096, 'R35_VALIDATION_RECORD')


def quality_guard(raw, before):
    start = b'      - name: Verify read-only dual-scope34 and separately pinned33/32/29\n'
    stop = b'      - name: Verify tooling security backports\n'
    need(before.count(start) == before.count(stop) == 1, 'R35_QUALITY_BASE')
    a, rest = before.split(start)
    _, b = rest.split(stop)
    need(raw == a+NEW_STEP.encode()+stop+b, 'R35_QUALITY_ONLY_FIRST_GOVERNANCE_STEP')


def parent_pr_guard(pr37, pr36):
    for value, number, head, branch in [
        (pr37, 37, BASE, PARENT_BRANCH), (pr36, 36, parent().BASE, parent().PARENT_BRANCH)]:
        need(type(value) is dict and type(value.get('number')) is int and value['number'] == number and
             value.get('state') == 'open' and value.get('draft') is True and value.get('merged') is False and
             value.get('merged_at') is None and value.get('closed_at') is None and
             value.get('head', {}).get('sha') == head and value['head'].get('ref') == branch and
             value['head'].get('repo', {}).get('full_name') == 'TasfiqJ/onSkin',
             'R35_LIVE_PARENT_SOURCE_DRIFT')
    need(pr37.get('base', {}).get('sha') == parent().BASE and
         pr37['base'].get('ref') == parent().PARENT_BRANCH, 'R35_LIVE_PARENT_SOURCE_DRIFT')


def ci_guard(env, event, checkout, tree, merge, merge_tree, live, live_pr=None):
    if env.get('GITHUB_ACTIONS') != 'true':
        need(not any(k.startswith('GITHUB_') for k in env), 'R35_LOCAL_CONTEXT')
        return 'LOCAL_EXACT_CHECKOUT_NOT_CI'
    need(env.get('GITHUB_REPOSITORY') == 'TasfiqJ/onSkin' and type(event) is dict and
         event.get('repository', {}).get('full_name') == 'TasfiqJ/onSkin', 'R35_CI_REPOSITORY')
    # Quality has no authorized35 branch-push trigger; main pushes are never admitted here.
    need(env.get('GITHUB_EVENT_NAME') == 'pull_request', 'R35_CI_KIND')
    number = event.get('number')
    def exact(value):
        return type(value) is dict and type(number) is int and number > 37 and \
            type(value.get('number')) is int and value['number'] == number and value.get('state') == 'open' and \
            value.get('draft') is True and value.get('merged') is False and value.get('merged_at') is None and \
            value.get('closed_at') is None and value.get('maintainer_can_modify') is False and \
            'auto_merge' in value and value['auto_merge'] is None and \
            value.get('base', {}).get('sha') == BASE and value['base'].get('ref') == PARENT_BRANCH and \
            value.get('head', {}).get('sha') == checkout and value['head'].get('ref') == BRANCH and \
            value['head'].get('repo', {}).get('full_name') == 'TasfiqJ/onSkin'
    need(exact(event.get('pull_request')) and env.get('GITHUB_REF') == 'refs/pull/'+str(number)+'/merge',
         'R35_CI_EVENT')
    need(exact(live_pr), 'R35_LIVE_PR')
    need(merge == [env.get('GITHUB_SHA'), BASE, checkout] and merge_tree == tree, 'R35_CI_TEST_MERGE')
    need(live == dict(main=MAIN, parent=BASE, ancestor=parent().BASE, source=checkout),
         'R35_STALE_HEAD_OR_PARENT')
    return 'EXACT_EVENT_LIVE_PR_PARENT_MAIN_SOURCE_AND_TEST_MERGE'


def live_refs(include_source):
    names = {'refs/heads/main': 'main', 'refs/heads/'+PARENT_BRANCH: 'parent',
             'refs/heads/'+parent().PARENT_BRANCH: 'ancestor'}
    if include_source:
        names['refs/heads/'+BRANCH] = 'source'
    result = {}
    for row in text('ls-remote', '--exit-code', 'origin', *names).splitlines():
        sha, name = row.split()
        need(name in names and names[name] not in result and re.fullmatch('[0-9a-f]{40}', sha), 'R35_LIVE_REFS')
        result[names[name]] = sha
    need(set(result) == set(names.values()), 'R35_LIVE_REFS')
    return result


def fetch_pr(number):
    request = urllib.request.Request('https://api.github.com/repos/TasfiqJ/onSkin/pulls/'+str(number),
        headers={'Accept': 'application/vnd.github+json', 'User-Agent': 'onSkin-Campaign35-source-verifier'})
    with urllib.request.urlopen(request, timeout=30) as response:
        raw = response.read(1024*1024+1)
    need(len(raw) <= 1024*1024, 'R35_LIVE_PR_SIZE')
    return document(raw)


def verify():
    need(not sys.flags.optimize, 'R35_ASSERTIONS')
    check = old().helpers()
    check.full29_store()
    authenticate_parent()
    checkout, tree = text('rev-parse', 'HEAD'), text('rev-parse', 'HEAD^{tree}')
    need(len(parents(checkout)) == 2, 'R35_CHECKOUT_SOURCE_NOT_MERGE')
    in_ci = os.environ.get('GITHUB_ACTIONS') == 'true'
    if not in_ci:
        need(text('symbolic-ref', '--short', 'HEAD') == BRANCH, 'R35_WRONG_BRANCH')
    live = live_refs(in_ci)
    need({k:v for k,v in live.items() if k != 'source'} ==
         dict(main=MAIN, parent=BASE, ancestor=parent().BASE), 'R35_STALE_HEAD_OR_PARENT')
    parent_pr_guard(fetch_pr(37), fetch_pr(36))
    source, seal, source_paths = phase_guard(text('rev-list', '--reverse', BASE+'..'+checkout).splitlines())
    need(changed(BASE, seal, GRANT) == source_paths|WORKLIST|{PLAN}, 'R35_COMPLETE_SCOPE')
    need(git('show', seal+':'+PLAN) == git('show', PLAN_COMMIT+':'+PLAN), 'R35_PLAN_IMMUTABLE')
    task_guard(document(git('show', source+':'+TASK)), lambda name: git('show', source+':'+name), source_paths)
    quality_guard(git('show', source+':.github/workflows/quality.yml'),
                  git('show', BASE+':.github/workflows/quality.yml'))
    worklist = document(git('show', seal+':docs/phase-4/generated/source-worklist.json'))
    old().worklist_guard(worklist, source)
    need(worklist.get('warnings') == [], 'R35_WORKLIST_WARNINGS')
    index_tree = check.tree29(checkout)
    index = git('ls-files', '--stage', '-z')
    expected = b''.join((mode+' '+oid+' 0\t'+path+'\0').encode()
                        for path, (mode, oid) in index_tree.items())
    overrides = old().filter_overrides()
    need(index == expected and not git(*overrides, 'status', '--porcelain=v1', '--untracked-files=all', '-z'),
         'R35_DIRTY')
    need(all(line.startswith(b'H ') for line in git('ls-files', '-v', '-z').split(b'\0') if line),
         'R35_INDEX_FLAGS')
    checked = check.working29_guard(index_tree)
    scope = parent().scope_guard(document(old().child(
        ['node', 'scripts/launch/candidate-scope34.mjs', '--mode', 'verification'], ROOT, dict(os.environ))))
    event, merge, merge_tree, live_pr = {}, [], None, None
    if in_ci:
        event_path = Path(os.environ.get('GITHUB_EVENT_PATH', ''))
        need(event_path.is_absolute(), 'R35_EVENT_PATH')
        event = document(check.regular29(event_path, 1024*1024))
        number = event.get('number')
        need(type(number) is int and number > 37, 'R35_CI_EVENT')
        live_pr = fetch_pr(number)
        sha = os.environ.get('GITHUB_SHA', '')
        need(re.fullmatch('[0-9a-f]{40}', sha), 'R35_CI_SHA')
        merge, merge_tree = parents(sha), text('rev-parse', sha+'^{tree}')
    qualification = ci_guard(os.environ, event, checkout, tree, merge, merge_tree, live, live_pr)
    need(git('ls-files', '--stage', '-z') == index and text('rev-parse', 'HEAD') == checkout and
         not git(*overrides, 'status', '--porcelain=v1', '--untracked-files=all', '-z') and
         check.working29_guard(index_tree) == checked, 'R35_FINAL_SNAPSHOT')
    return dict(valid=True, qualification=qualification, head=checkout, tree=tree, sourceHead=source,
        sealedHead=seal, parentHead=BASE, changedSourcePaths=sorted(source_paths), trackedBlobsHashed=checked,
        governance='CURRENT_CAMPAIGN35_FINITE_FREE_FIRST_SESSION_SOURCE_ONLY', productScope=scope,
        historicalCheck='SEPARATE_PINNED_PR37_ORIGINAL34_33_32_29_REQUIRED',
        acceptanceGranted=False, admissions=dict.fromkeys(ADMISSIONS, False), release='NO_GO')


def historical_result(raw):
    """Validate the genuine combined original34 progress transcript and terminal result."""
    lines = [line for line in raw.splitlines() if line]
    need(len(lines) == 4 and lines[0].startswith(b'R34_HISTORICAL_WORKSPACE ') and
         len(lines[0]) <= 4096 and lines[1:3] == [b'R34_EXACT_PR36_FULL_CLONE_AUTHENTICATED',
         b'R34_PR36_NORMAL_INSTALL_AND_HOOKS_PASS'], 'R35_HISTORICAL34_TRANSCRIPT')
    value = document(lines[-1])
    p = parent()
    need(value.get('status') == 'PASS' and value.get('historicalHead') == p.BASE and
         value.get('historicalTree') == p.BASE_TREE and value.get('checkerSHA256') == p.PARENT_SHA and
         value.get('acceptanceGranted') is False and value.get('release') == 'NO_GO' and
         value.get('admissions') == dict.fromkeys(ADMISSIONS, False) and
         all(v is False for v in value['admissions'].values()) and
         value.get('qualification') == 'SUPPLIER_PINNED33_32_29_REPLAY_NOT_CURRENT34_OR_OWNER_ACCEPTANCE',
         'R35_HISTORICAL34_RESULT')
    original = value.get('original33', {})
    need(original.get('valid') is True and original.get('head') == p.BASE and
         original.get('tree') == p.BASE_TREE and original.get('release') == 'NO_GO' and
         original.get('acceptanceGranted') is False and
         original.get('admissions') == dict.fromkeys(ADMISSIONS, False) and
         all(v is False for v in original['admissions'].values()), 'R35_HISTORICAL33_SOURCE')
    need(value.get('original33CurrentRefusal') ==
         dict(valid=False, error='R33_HISTORY_PHASES', acceptanceGranted=False, release='NO_GO'),
         'R35_HISTORICAL33_REFUSAL')
    p.historical_result(json.dumps(value.get('original32And29')).encode())
    return value


def current34_refusal(raw, in_ci):
    value = document(raw)
    # Real CI reaches34's history: its old worklist seal is now an interior source phase.
    # The unchanged32 delta helper refuses those paths; named local35 refuses its branch first.
    expected = 'R32_FINITE_SCOPE' if in_ci else 'R34_WRONG_BRANCH'
    need(value == dict(valid=False, error=expected, acceptanceGranted=False, release='NO_GO'),
         'R35_ORIGINAL34_REFUSAL')
    return value


def historical():
    """Original34 runs at exact PR37 on its named branch, without synthetic CI events."""
    authenticate_parent()
    checkout, checkout_tree = text('rev-parse', 'HEAD'), text('rev-parse', 'HEAD^{tree}')
    env = old().clean_environment()
    refusal = current34_refusal(old().child(
        [sys.executable, '-I', '-B', PREFIX+'main_integration34.py'], ROOT, dict(os.environ), expected=1),
        os.environ.get('GITHUB_ACTIONS') == 'true')
    workspace = Path(tempfile.mkdtemp(prefix='integration35-')).resolve()
    need(not workspace.is_relative_to(ROOT), 'R35_EXTERNAL_CLONE')
    print('R35_HISTORICAL_WORKSPACE '+str(workspace), file=sys.stderr, flush=True)
    root, logs = workspace/'pr37', workspace/'logs'
    logs.mkdir()
    receipts = []
    def run(name, args, cwd, expected=0, timeout=900):
        log = logs/(name+'.log')
        started, timed_out = time.monotonic(), False
        with log.open('wb') as output:
            process = subprocess.Popen(args, cwd=cwd, env=env, stdout=output, stderr=subprocess.STDOUT)
            try:
                process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
                timed_out = True
        body = log.read_bytes()
        need(len(body) <= 8*1024*1024, 'R35_HISTORICAL_OUTPUT')
        receipts.append(dict(name=name, command=args, exit=process.returncode, expectedExit=expected,
            log=str(log), bytes=len(body), sha256=digest(body), seconds=round(time.monotonic()-started,3),
            timedOut=timed_out, historicalHead=BASE, historicalTree=BASE_TREE))
        (logs/'receipts.json').write_text(json.dumps(receipts, indent=2)+'\n', encoding='utf-8')
        need(not timed_out, 'R35_HISTORICAL_TIMEOUT')
        need(process.returncode == expected, 'R35_HISTORICAL_CHILD_EXIT')
        return body
    run('clone-pr37', ['git', '-c', 'core.hooksPath=', 'clone', '--no-checkout', '--no-hardlinks',
        '--single-branch', '--branch', PARENT_BRANCH, '-c', 'core.autocrlf=false', '-c', 'core.longpaths=true',
        'https://github.com/TasfiqJ/onSkin.git', str(root)], workspace)
    (root/'.git/info/attributes').write_bytes(b'* -text -eol -filter -ident -working-tree-encoding\n')
    run('checkout-pr37-named34', ['git', '-c', 'core.hooksPath=', 'checkout', PARENT_BRANCH], root)
    def pinned(*args):
        return old().child(['git', '--no-replace-objects', *args], root, env).decode().strip()
    need(pinned('rev-parse', 'HEAD') == BASE and pinned('rev-parse', 'HEAD^{tree}') == BASE_TREE and
         pinned('symbolic-ref', '--short', 'HEAD') == PARENT_BRANCH and
         digest((root/PREFIX/'main_integration34.py').read_bytes()) == PARENT_SHA, 'R35_HISTORICAL_PIN')
    print('R35_EXACT_PR37_FULL_CLONE_AUTHENTICATED', file=sys.stderr, flush=True)
    node = Path(shutil.which('node')).resolve()
    candidates = [node.parent/'node_modules/npm/bin/npm-cli.js'] if os.name == 'nt' else [node.parent.parent/'lib/node_modules/npm/bin/npm-cli.js']
    if os.name == 'nt' and env.get('APPDATA'):
        candidates.insert(0, Path(env['APPDATA'])/'npm/node_modules/npm/bin/npm-cli.js')
    config = workspace/'empty.npmrc'
    config.write_bytes(b'')
    env.update(npm_config_userconfig=os.devnull, npm_config_globalconfig=str(config))
    need(run('node-version', [str(node), '--version'], root).strip() == b'v22.21.0', 'R35_RUNTIME')
    npm = next((path for path in candidates if path.is_file() and
                old().child([str(node), str(path), '--version'], root, env).strip() == b'11.20.0'), None)
    need(npm is not None, 'R35_RUNTIME')
    run('normal-npm-ci', [str(node), str(npm), 'ci', '--ignore-scripts=false', '--no-audit', '--no-fund'], root)
    run('postinstall-check', [str(node), 'scripts/postinstall.mjs', '--check'], root)
    print('R35_PR37_NORMAL_INSTALL_AND_HOOKS_PASS', file=sys.stderr, flush=True)
    for name in ['main_integration34.test.py', 'source_consumer34.test.py']:
        run(name, [sys.executable, '-I', '-B', PREFIX+name], root)
    run('original34-node-controls', [str(node), '--test', 'scripts/launch/candidate-scope34.test.mjs',
        'scripts/launch/consumer-entry34.test.mjs'], root)
    run('original34-candidate-cli', [str(node), 'scripts/launch/candidate-scope34.mjs', '--mode', 'verification'], root)
    run('original34-default-cli', [str(node), 'scripts/launch/check-contract.mjs'], root)
    run('original34-explicit-cli', [str(node), 'scripts/launch/check-contract.mjs', '--scope', 'full-app-j01-v2'], root)
    run('original34-external-readiness', [str(node), 'scripts/launch/check-contract.mjs',
        '--scope', 'full-app-j01-v2', '--external-readiness'], root, expected=2)
    original = document(run('original34-current-source',
        [sys.executable, '-I', '-B', PREFIX+'main_integration34.py'], root))
    need(original.get('valid') is True and original.get('head') == BASE and original.get('tree') == BASE_TREE and
         original.get('acceptanceGranted') is False and original.get('release') == 'NO_GO' and
         original.get('admissions') == dict.fromkeys(ADMISSIONS, False) and
         all(v is False for v in original['admissions'].values()), 'R35_HISTORICAL34_SOURCE')
    run('original151-negatives', [sys.executable, '-B', PREFIX+'test_contract.py'], root)
    run('original09-source-controls', [sys.executable, '-B', PREFIX+'source_consumer09.test.py'], root)
    nested = historical_result(run('original34-pinned33-32-29',
        [sys.executable, '-I', '-B', PREFIX+'main_integration34.py', '--historical'], root, timeout=3600))
    need(not pinned('status', '--porcelain=v1', '--untracked-files=all') and pinned('rev-parse', 'HEAD') == BASE and
         pinned('rev-parse', 'HEAD^{tree}') == BASE_TREE and text('rev-parse', 'HEAD') == checkout and
         text('rev-parse', 'HEAD^{tree}') == checkout_tree, 'R35_HISTORICAL_CHANGED')
    return dict(status='PASS', historicalHead=BASE, historicalTree=BASE_TREE, checkerSHA256=PARENT_SHA,
        original34=original, original34CurrentRefusal=refusal, original33And32And29=nested,
        receipts=receipts, workspace=str(workspace), npmCache='NORMAL_EXISTING_CACHE_NO_ZERO_CACHE_CLAIM',
        qualification='SUPPLIER_PINNED34_33_32_29_REPLAY_NOT_CURRENT35_OR_OWNER_ACCEPTANCE',
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
        safe = code if type(code) is str and re.fullmatch(r'(?:R35|R34|R33|R32|R29|R23)_[A-Z_]+', code) else 'R35_EXECUTION_INCOMPLETE'
        print(json.dumps(dict(valid=False, error=safe, acceptanceGranted=False, release='NO_GO')))
        return 1


if __name__ == '__main__':
    sys.exit(main())

