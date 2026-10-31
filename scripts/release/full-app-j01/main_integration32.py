"""Current development integration integrity and separate authentic Release29 replay.

No historical validator is dispatched as a validator for this new interval.
"""
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
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[3]
BASE = '53a84d921d14dbff1d2e9b8f1b3bb27e10dcede6'
BASE_TREE = '7c99d545af73a1caaf174f09c9c1a2f2daa1764d'
PR33 = '71dde4eed92edd20ff0e9611da42086d6e0f2b89'
PR33_TREE = 'f9e5f995d37a7dc058b07271e6b98f79cf698951'
BRANCH = 'stage/m1-main-quality-governance32'
PLAN_COMMIT = 'bea88075e6c1e9c927e17a0884327312b7303dd0'
PLAN = 'docs/brain/task-specs/M1X-32/SCOPE_PLAN.md'
PLAN_SHA = 'c00e087db37a6ad981d431176d4d26fd8636b09bb09acf9e1f59a7c6d646ada7'
TASK = 'docs/brain/task-specs/M1X-32/TASK.md'
PREFIX = 'scripts/release/full-app-j01/'
CHECKER_SHA = '944c04283b834e5f20bdfcbf95c265c7af57f8f4754952b4353dee5f8d8952dd'
SOURCE = {'.github/workflows/quality.yml', PREFIX+'main_integration32.py',
          PREFIX+'main_integration32.test.py', PREFIX+'source_consumer32.test.py', TASK, 'PROGRESS.md'}
WORKLIST = {'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md'}
CHAIN = [PR33, '4b0a72b71f38a3f9b3662e2bd83a4935b31411d1',
         '34d1c288864a3c4c3a7e4d34b876553b66fa54e1', '74aeb1ffbe0379bfc8b5ceaf38ea401b8d62e2c9',
         '58813b860fba7da7ad9867bbaf452c8e427c72be', BASE]
H = None


def need(value, code):
    if not value:
        raise ValueError(code)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def document(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            need(key not in result, 'R32_JSON_DUPLICATE'); result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=pairs,
                      parse_constant=lambda _: need(False, 'R32_JSON_NONFINITE'))


def helpers():
    global H
    if H is None:
        path = ROOT/PREFIX/'check.py'
        need(path.stat().st_size < 2*1024*1024, 'R32_HISTORICAL_CHECKER')
        raw = path.read_bytes()
        need(digest(raw) == CHECKER_SHA, 'R32_HISTORICAL_CHECKER')
        namespace = {'__name__': 'unchanged_release29_helpers', '__file__': str(path)}
        exec(compile(raw, str(path), 'exec'), namespace)
        H = SimpleNamespace(**namespace)
    return H


def git(*args):
    return helpers().git23(*args)


def text(*args):
    return git(*args).decode().strip()


def parents(commit):
    return text('rev-list', '--parents', '-n', '1', commit).split()


def delta(raw, allowed):
    """Reject deletion, executable/link modes, renames and ungranted paths."""
    parts = raw.split(b'\0'); found = set()
    need(parts[-1] == b'', 'R32_DIFF')
    for i in range(0, len(parts)-1, 2):
        need(i+1 < len(parts)-1, 'R32_DIFF')
        header = parts[i].decode('ascii').split(); name = parts[i+1].decode('utf8')
        need(len(header) == 5 and header[0] in (':000000', ':100644') and
             header[1] == '100644' and header[4] in ('A', 'M') and
             all(re.fullmatch('[0-9a-f]{40}', oid) for oid in header[2:4]) and
             ((header[4] == 'A') == (header[0] == ':000000')),
             'R32_DIFF')
        need(name in allowed and name not in found, 'R32_FINITE_SCOPE'); found.add(name)
    return found


def changed(before, after, allowed):
    return delta(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', before, after), allowed)


def authenticate_chain():
    need(text('rev-parse', BASE+'^{tree}') == BASE_TREE and
         text('rev-parse', PR33+'^{tree}') == PR33_TREE, 'R32_BASE_TREE')
    need(text('rev-list', '--reverse', PR33+'..'+BASE).splitlines() == CHAIN[1:], 'R32_INTEGRATED_HISTORY')
    for previous, current in zip(CHAIN, CHAIN[1:]):
        need(parents(current) == [current, previous], 'R32_INTEGRATED_PARENT')
    need(parents(PLAN_COMMIT) == [PLAN_COMMIT, BASE] and
         digest(git('show', PLAN_COMMIT+':'+PLAN)) == PLAN_SHA, 'R32_PLAN_PIN')
    need(changed(BASE, PLAN_COMMIT, {PLAN}) == {PLAN}, 'R32_PLAN_FIRST')


def task_guard(value, body):
    need(type(value) is dict and set(value) == {'schema', 'authority', 'base', 'baseTree', 'planCommit',
         'sourceHashes', 'acceptanceGranted', 'admissions', 'release', 'qualification'}, 'R32_TASK_SCHEMA')
    need(type(value['schema']) is int and value['schema'] == 1 and
         value['authority'] == 'USER_CAMPAIGN32_MAIN_QUALITY_RECOVERY' and value['base'] == BASE and
         value['baseTree'] == BASE_TREE and value['planCommit'] == PLAN_COMMIT and
         value['acceptanceGranted'] is False and value['release'] == 'NO_GO' and
         value['qualification'] == 'SOURCE_INTEGRITY_NOT_QUALIFIED_ACCEPTANCE' and
         value['admissions'] == dict.fromkeys(['G97', 'DB', 'M103', 'M2', 'NATIVE', 'J01', 'CLINICAL', 'PROVIDER', 'APPLE', 'PUBLIC'], False)
         and all(v is False for v in value['admissions'].values()), 'R32_NO_ADMISSION')
    need(type(value['sourceHashes']) is dict and set(value['sourceHashes']) == SOURCE-{TASK}, 'R32_HASH_INVENTORY')
    for path, sha in value['sourceHashes'].items():
        need(type(sha) is str and re.fullmatch('[0-9a-f]{64}', sha) and digest(body(path)) == sha, 'R32_FROZEN_SOURCE')


def ci_guard(env, event, checkout, tree, merge, merge_tree, live):
    if env.get('GITHUB_ACTIONS') != 'true':
        need(not any(k.startswith('GITHUB_') for k in env), 'R32_LOCAL_CONTEXT')
        return 'LOCAL_EXACT_CHECKOUT_NOT_CI'
    need(type(event) is dict and env.get('GITHUB_REPOSITORY') == 'TasfiqJ/onSkin' and
         event.get('repository', {}).get('full_name') == 'TasfiqJ/onSkin', 'R32_CI_REPOSITORY')
    kind = env.get('GITHUB_EVENT_NAME')
    if kind == 'pull_request':
        pr = event.get('pull_request', {}); number = event.get('number')
        need(type(number) is int and number > 0 and type(pr.get('number')) is int and pr.get('number') == number and
             pr.get('draft') is True and pr.get('maintainer_can_modify') is False and
             'auto_merge' in pr and pr['auto_merge'] is None and
             pr.get('base', {}).get('sha') == BASE and pr['base'].get('ref') == 'main' and
             pr.get('head', {}).get('sha') == checkout and pr['head'].get('ref') == BRANCH and
             pr['head'].get('repo', {}).get('full_name') == 'TasfiqJ/onSkin' and
             env.get('GITHUB_REF') == 'refs/pull/'+str(number)+'/merge', 'R32_CI_EVENT')
        need(merge == [env.get('GITHUB_SHA'), BASE, checkout] and merge_tree == tree, 'R32_CI_TEST_MERGE')
        need(live == {'main': BASE, 'source': checkout}, 'R32_STALE_HEAD')
    elif kind == 'push':
        need(env.get('GITHUB_REF') == 'refs/heads/main' and event.get('ref') == 'refs/heads/main' and
             event.get('after') == checkout and env.get('GITHUB_SHA') == checkout and
             live.get('main') == checkout, 'R32_CI_PUSH')
    else:
        need(False, 'R32_CI_KIND')
    return 'EXACT_EVENT_AND_LIVE_REFS'


def phase_guard(commits):
    need(len(commits) == 3 and commits[0] == PLAN_COMMIT, 'R32_HISTORY_PHASES')
    plan, source, seal = commits
    need(parents(source) == [source, plan] and parents(seal) == [seal, source], 'R32_LINEAR_HISTORY')
    need(changed(plan, source, SOURCE) == SOURCE and changed(source, seal, WORKLIST) == WORKLIST,
         'R32_SOURCE_THEN_SEAL')
    return source, seal


def worklist_guard(worklist, source):
    need(worklist.get('gitSha') == source and worklist.get('gitStatus') == '' and
         worklist.get('strict') is True and worklist.get('blockers') == [], 'R32_WORKLIST_SOURCE')


def filter_overrides():
    # Same conversion suppression as unchanged source29_guard; no configured
    # clean/smudge/process executable may run while checking working bytes.
    configured = subprocess.run(['git', 'config', '--null', '--name-only', '--get-regexp',
        r'^filter\..*\.(clean|smudge|process)$'], cwd=ROOT, capture_output=True)
    need(configured.returncode in (0, 1) and len(configured.stdout) <= 65536, 'R32_FILTERS')
    overrides = []
    for key in configured.stdout.decode().split('\0'):
        if key:
            need(re.fullmatch(r'filter\.[A-Za-z0-9_. -]{1,128}\.(clean|smudge|process)', key), 'R32_FILTERS')
            overrides += ['-c', key+'=', '-c', key.rsplit('.', 1)[0]+'.required=false']
    return overrides


def verify():
    need(not sys.flags.optimize, 'R32_ASSERTIONS')
    check = helpers(); check.full29_store(); authenticate_chain()
    checkout = text('rev-parse', 'HEAD'); checkout_tree = text('rev-parse', 'HEAD^{tree}')
    row = parents(checkout); endpoint = checkout
    if len(row) == 3:
        need(row[1] == BASE and checkout_tree == text('rev-parse', row[2]+'^{tree}'), 'R32_INTEGRATION_MERGE')
        endpoint = row[2]
    source, seal = phase_guard(text('rev-list', '--reverse', BASE+'..'+endpoint).splitlines())
    need(changed(BASE, endpoint, SOURCE|WORKLIST|{PLAN}) == SOURCE|WORKLIST|{PLAN}, 'R32_COMPLETE_SCOPE')
    need(git('show', endpoint+':'+PLAN) == git('show', PLAN_COMMIT+':'+PLAN), 'R32_PLAN_IMMUTABLE')
    task_guard(document(git('show', source+':'+TASK)), lambda path: git('show', source+':'+path))
    need(git('show', endpoint+':'+PREFIX+'check.py') == git('show', BASE+':'+PREFIX+'check.py'), 'R32_HISTORICAL_CHECKER')
    worklist = document(git('show', endpoint+':docs/phase-4/generated/source-worklist.json'))
    worklist_guard(worklist, source)
    overrides = filter_overrides()
    tree = check.tree29(checkout); index = git('ls-files', '--stage', '-z')
    expected_index = b''.join((mode+' '+oid+' 0\t'+path+'\0').encode() for path, (mode, oid) in tree.items())
    need(index == expected_index and not git(*overrides, 'status', '--porcelain=v1', '--untracked-files=all', '-z'), 'R32_DIRTY')
    need(all(line.startswith(b'H ') for line in git('ls-files', '-v', '-z').split(b'\0') if line), 'R32_INDEX_FLAGS')
    checked = check.working29_guard(tree)
    need(git('ls-files', '--stage', '-z') == index and text('rev-parse', 'HEAD') == checkout and
         not git(*overrides, 'status', '--porcelain=v1', '--untracked-files=all', '-z'), 'R32_FINAL_SNAPSHOT')
    event = {}; live = {}; merge = []; merge_tree = None
    if os.environ.get('GITHUB_ACTIONS') == 'true':
        event_path = Path(os.environ.get('GITHUB_EVENT_PATH', ''))
        need(event_path.is_absolute(), 'R32_EVENT_PATH'); event = document(check.regular29(event_path, 1024*1024))
        refs = text('ls-remote', '--exit-code', 'origin', 'refs/heads/main', 'refs/heads/'+BRANCH).splitlines()
        live = {('main' if name == 'refs/heads/main' else 'source'): sha for sha, name in (r.split() for r in refs)}
        if os.environ.get('GITHUB_EVENT_NAME') == 'pull_request':
            sha = os.environ.get('GITHUB_SHA', '')
            need(re.fullmatch('[0-9a-f]{40}', sha), 'R32_CI_SHA'); merge = parents(sha); merge_tree = text('rev-parse', sha+'^{tree}')
    qualification = ci_guard(os.environ, event, checkout, checkout_tree, merge, merge_tree, live)
    return dict(valid=True, qualification=qualification, head=checkout, tree=checkout_tree,
                sourceHead=source, sealedHead=seal, integratedBase=BASE, trackedBlobsHashed=checked,
                governance='CURRENT_INTEGRATION32_ONLY', historicalChecker='UNCHANGED_SEPARATE_REPLAY_REQUIRED',
                acceptanceGranted=False, release='NO_GO')


def clean_environment():
    allowed = {'PATH', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA'}
    env = {k: v for k, v in os.environ.items() if k.upper() in allowed}
    env.update(CI='1', EXPO_NO_TELEMETRY='1', GIT_TERMINAL_PROMPT='0')
    return env


def child(args, root, env, expected=0, timeout=600):
    with tempfile.TemporaryFile() as log:
        process = subprocess.Popen(args, cwd=root, env=env, stdout=log, stderr=subprocess.STDOUT)
        try:
            process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            process.kill(); process.wait(); need(False, 'R32_CHILD_TIMEOUT')
        need(log.tell() <= 8*1024*1024, 'R32_CHILD_OUTPUT')
        log.seek(0); raw = log.read(8*1024*1024+1)
        need(process.returncode == expected, 'R32_CHILD_EXIT')
        return raw


def historical():
    """Fresh public clone; no supplied old CI event and no historical source edits."""
    proof = verify(); check = helpers()
    refusal = child([sys.executable, '-I', '-B', PREFIX+'check.py'], ROOT, dict(os.environ), expected=1)
    refusal = document(refusal)
    expected = 'R29_CI_EVENT' if os.environ.get('GITHUB_EVENT_NAME') == 'pull_request' else 'R29_CI_CONTEXT' if os.environ.get('GITHUB_ACTIONS') == 'true' else 'R29_AFTER_EVIDENCE_TAIL'
    need(refusal == {'valid': False, 'error': expected, 'release': 'NO_GO'}, 'R32_ORIGINAL_REFUSAL')
    parent = Path(tempfile.gettempdir()).resolve(); workspace = Path(tempfile.mkdtemp(prefix='integration32-', dir=parent)).resolve()
    need(workspace.parent == parent and not workspace.is_relative_to(ROOT), 'R32_EXTERNAL_CLONE')
    root = workspace/'release29'; env = clean_environment()
    try:
        child(['git', '-c', 'core.hooksPath=', 'clone', '--no-checkout', '--no-hardlinks', '--single-branch',
               '--branch', 'stage/m1-windows-reader-integrity29', '-c', 'core.autocrlf=false', '-c', 'core.longpaths=true',
               'https://github.com/TasfiqJ/onSkin.git', str(root)], workspace, env)
        child(['git', '-c', 'core.hooksPath=', 'checkout', '--detach', PR33], root, env)
        def pinned(*args):
            return child(['git', '--no-replace-objects', *args], root, env).decode().strip()
        need(pinned('rev-parse', 'HEAD') == PR33 and pinned('rev-parse', 'HEAD^{tree}') == PR33_TREE and
             digest((root/PREFIX/'check.py').read_bytes()) == CHECKER_SHA, 'R32_HISTORICAL_PIN')
        print('R32_HISTORICAL_CLONE_AUTHENTICATED', file=sys.stderr, flush=True)
        node = Path(shutil.which('node')).resolve()
        # npm's platform shim prefers a globally installed npm over Node's bundled
        # copy. Select the actually installed reviewed CLI, never a manager swap.
        candidates = [node.parent/'node_modules/npm/bin/npm-cli.js'] if os.name == 'nt' else [node.parent.parent/'lib/node_modules/npm/bin/npm-cli.js']
        if os.name == 'nt' and env.get('APPDATA'):
            candidates.insert(0, Path(env['APPDATA'])/'npm/node_modules/npm/bin/npm-cli.js')
        config = workspace/'global-empty.npmrc'; config.write_bytes(b'')
        env.update(npm_config_userconfig=os.devnull, npm_config_globalconfig=str(config))
        need(child([str(node), '--version'], root, env).strip() == b'v22.21.0', 'R32_RUNTIME')
        npm = next((p for p in candidates if p.is_file() and
                    child([str(node), str(p), '--version'], root, env).strip() == b'11.20.0'), None)
        need(npm is not None, 'R32_RUNTIME')
        child([str(node), str(npm), 'ci', '--ignore-scripts=false', '--no-audit', '--no-fund'], root, env)
        child([str(node), 'scripts/postinstall.mjs', '--check'], root, env)
        print('R32_HISTORICAL_NORMAL_INSTALL_AND_HOOKS_PASS', file=sys.stderr, flush=True)
        controls = child([sys.executable, '-I', '-B', PREFIX+'source_consumer29.test.py'], root, env)
        summary = document(controls.splitlines()[-1])
        need(summary.get('status') == 'PASS' and summary.get('refusals', 0) > 0 and
             summary.get('positiveControls', 0) > 0 and summary.get('qualification') ==
             'SYNTHETIC_GIT_AND_READER_SCOPE_CONTROLS_NOT_INDEPENDENT_FULL_CHECKOUT_OR_SECURITY_ACCEPTANCE' and
             summary.get('acceptanceGranted') is False and summary.get('release') == 'NO_GO', 'R32_HISTORICAL_CONTROLS')
        result = document(child([sys.executable, '-I', '-B', PREFIX+'check.py'], root, env))
        need(result.get('valid') is True and result.get('current_source_governance') == 'RELEASE29_FINITE_SCOPE_ONLY' and
             result.get('acceptanceGranted') is False and result.get('release') == 'NO_GO' and
             all(v is False for v in result.get('admissions', {}).values()), 'R32_HISTORICAL_RESULT')
        need(not pinned('status', '--porcelain=v1', '--untracked-files=all') and pinned('rev-parse', 'HEAD') == PR33 and
             pinned('rev-parse', 'HEAD^{tree}') == PR33_TREE, 'R32_HISTORICAL_CHANGED')
        need(verify() == proof, 'R32_CURRENT_CHANGED')
        return dict(status='PASS', historicalHead=PR33, historicalTree=PR33_TREE, checkerSHA256=CHECKER_SHA,
                    historicalCheckerExit=0, historicalControls=summary, originalCurrentRefusal=refusal,
                    qualification='INDEPENDENT_PINNED_CLONE_NORMAL_HOOKS_NO_HISTORICAL_CI_CLAIM', acceptanceGranted=False, release='NO_GO')
    finally:
        # Like the existing replay29 runner, retain the independent clone outside
        # source for inspection. Hosted runner storage is ephemeral. Avoid hiding
        # a primary verification error behind Windows read-only pack cleanup.
        need(workspace.parent == parent and workspace.name.startswith('integration32-'), 'R32_CLEANUP_PATH')


def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--historical', action='store_true'); args = parser.parse_args()
    try:
        print(json.dumps(historical() if args.historical else verify(), sort_keys=True))
        return 0
    except Exception as error:
        code = error.args[0] if type(error) is ValueError and len(error.args) == 1 else None
        # Only literal codes from this source or inherited fixed refusal codes escape.
        safe = code if type(code) is str and re.fullmatch(r'(?:R32|R29|R23)_[A-Z_]+', code) else 'R32_EXECUTION_INCOMPLETE'
        print(json.dumps(dict(valid=False, error=safe, acceptanceGranted=False, release='NO_GO')))
        return 1


if __name__ == '__main__':
    sys.exit(main())
