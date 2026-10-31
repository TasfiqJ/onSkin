"""Campaign33 finite source integrity; original32/29 run only in pinned clones."""
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
BASE = 'cbbb5a83bd29d2833399c214f5b6c6dd14873d24'
BASE_TREE = '0745ad5f5595724a9b26de64324065dc3e53d2ea'
MAIN = '53a84d921d14dbff1d2e9b8f1b3bb27e10dcede6'
PARENT_BRANCH = 'stage/m1-main-quality-governance32'
BRANCH = 'stage/m1-fullapp-j01-scope-cutover33'
PLAN_COMMIT = '4e9c20e7502e51750ac85a1227f7151c7334e2bb'
PLAN = 'docs/brain/task-specs/M1X-33/SCOPE_PLAN.md'
PLAN_SHA = 'd7b3675e1d6b81fca233eed8099157ccf9f31a8855b27305fdd6c2b65a5855ce'
AUTHORITY = 'BRAIN-M1X-MASTERV2-FULLAPP-J01-SCOPE-CUTOVER33-CANDIDATE-01'
PREFIX = 'scripts/release/full-app-j01/'
DOCS = 'docs/release/full-app-j01/'
TASK = 'docs/brain/task-specs/M1X-33/TASK.md'
SOURCE = {
    TASK, DOCS+'contract.v2.json', DOCS+'matrix.v2.json', DOCS+'precedence.v2.json',
    DOCS+'roadmap.v2.json', DOCS+'owner-ledger33.v1.json', DOCS+'cutover33.md',
    DOCS+'j01-capture-feasibility33.md', 'scripts/launch/check-contract.mjs',
    'scripts/launch/full-app-contract33.mjs', 'scripts/launch/full-app-contract33.test.mjs',
    PREFIX+'main_integration33.py', PREFIX+'main_integration33.test.py',
    PREFIX+'source_consumer33.test.py', '.github/workflows/quality.yml', 'PROGRESS.md',
}
WORKLIST = {'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md'}
ADMISSIONS = ['DB06', 'DB08', 'R2B', 'M103', 'M2', 'NATIVE', 'J01', 'CLINICAL',
              'PROVIDER', 'PAID', 'APPLE', 'PUBLIC', 'G97']
PARENT_SHA = '5b48f78917aaf39e4da66138e3d5c52654af7defd1eaf37ab6404fdc631ceda4'
PARENT = None

NEW_STEP = '''      - name: Verify full-app scope33 and separately pinned integration32/Release29
        run: |
          set -euo pipefail
          if [ "$(git rev-parse --is-shallow-repository)" = true ]; then
            git fetch --no-tags --unshallow origin
          fi
          if [ "$GITHUB_EVENT_NAME" = pull_request ]; then
            git fetch --no-tags origin "$GITHUB_REF"
            test "$(git rev-parse FETCH_HEAD)" = "$GITHUB_SHA"
          fi
          python3 -I -B scripts/release/full-app-j01/main_integration33.test.py
          python3 -I -B scripts/release/full-app-j01/source_consumer33.test.py
          node --test scripts/launch/full-app-contract33.test.mjs
          node scripts/launch/check-contract.mjs --scope full-app-j01-v2
          python3 -I -B scripts/release/full-app-j01/main_integration32.test.py
          python3 -I -B scripts/release/full-app-j01/source_consumer32.test.py
          python3 -I -B scripts/release/full-app-j01/main_integration33.py
          python3 -I -B scripts/release/full-app-j01/main_integration33.py --historical
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
    global PARENT
    if PARENT is None:
        path = ROOT/PREFIX/'main_integration32.py'
        raw = path.read_bytes()
        need(digest(raw) == PARENT_SHA, 'R33_PARENT_CHECKER_BYTES')
        ns = {'__name__': 'unchanged_integration32_helpers', '__file__': str(path)}
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
    return parent().delta(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', before, after), allowed)


def authenticate_parent():
    p = parent()
    need(text('rev-parse', BASE+'^{tree}') == BASE_TREE, 'R33_PARENT_TREE')
    p.authenticate_chain()
    original = text('rev-list', '--reverse', MAIN+'..'+BASE).splitlines()
    source, seal = p.phase_guard(original)
    need(seal == BASE and source == 'af4406593fcd125d186263455fc1095174aee72a', 'R33_PARENT_PHASES')
    p.task_guard(document(git('show', source+':'+p.TASK)), lambda name: git('show', source+':'+name))
    p.worklist_guard(document(git('show', BASE+':docs/phase-4/generated/source-worklist.json')), source)
    need(parents(PLAN_COMMIT) == [PLAN_COMMIT, BASE] and
         digest(git('show', PLAN_COMMIT+':'+PLAN)) == PLAN_SHA and
         changed(BASE, PLAN_COMMIT, {PLAN}) == {PLAN}, 'R33_PLAN_FIRST')


def task_guard(value, body):
    need(type(value) is dict and set(value) == {'schema', 'authority', 'base', 'baseTree',
         'planCommit', 'sourceHashes', 'acceptanceGranted', 'admissions', 'release', 'qualification'}, 'R33_TASK_SCHEMA')
    need(type(value['schema']) is int and value['schema'] == 1 and value['authority'] == AUTHORITY and
         value['base'] == BASE and value['baseTree'] == BASE_TREE and value['planCommit'] == PLAN_COMMIT and
         value['acceptanceGranted'] is False and value['release'] == 'NO_GO' and
         value['qualification'] == 'SOURCE_INTEGRITY_NOT_QUALIFIED_ACCEPTANCE' and
         value['admissions'] == dict.fromkeys(ADMISSIONS, False) and
         all(v is False for v in value['admissions'].values()), 'R33_NO_ADMISSION')
    need(type(value['sourceHashes']) is dict and set(value['sourceHashes']) == SOURCE-{TASK}, 'R33_HASH_INVENTORY')
    for path, sha in value['sourceHashes'].items():
        need(type(sha) is str and re.fullmatch('[0-9a-f]{64}', sha) and digest(body(path)) == sha, 'R33_FROZEN_SOURCE')


def phase_guard(commits):
    need(3 <= len(commits) <= 6 and commits[0] == PLAN_COMMIT, 'R33_HISTORY_PHASES')
    need(len(set(commits)) == len(commits), 'R33_HISTORY_PHASES')
    previous = commits[0]; union = set()
    for source in commits[1:-1]:
        need(parents(source) == [source, previous], 'R33_LINEAR_HISTORY')
        paths = changed(previous, source, SOURCE)
        need(paths, 'R33_EMPTY_SOURCE_PHASE'); union.update(paths); previous = source
    seal = commits[-1]
    need(parents(seal) == [seal, previous] and union == SOURCE and
         changed(previous, seal, WORKLIST) == WORKLIST, 'R33_SOURCE_THEN_SEAL')
    return previous, seal


def quality_guard(raw, before):
    start = b'      - name: Verify current integration32 and separately pinned Release29\n'
    stop = b'      - name: Verify tooling security backports\n'
    need(before.count(start) == before.count(stop) == 1, 'R33_QUALITY_BASE')
    a, rest = before.split(start); _, b = rest.split(stop)
    need(raw == a+NEW_STEP.encode()+stop+b, 'R33_QUALITY_ONLY_FIRST_GOVERNANCE_STEP')


def ci_guard(env, event, checkout, tree, merge, merge_tree, live):
    if env.get('GITHUB_ACTIONS') != 'true':
        need(not any(k.startswith('GITHUB_') for k in env), 'R33_LOCAL_CONTEXT')
        return 'LOCAL_EXACT_CHECKOUT_NOT_CI'
    need(env.get('GITHUB_REPOSITORY') == 'TasfiqJ/onSkin' and type(event) is dict and
         event.get('repository', {}).get('full_name') == 'TasfiqJ/onSkin', 'R33_CI_REPOSITORY')
    need(env.get('GITHUB_EVENT_NAME') == 'pull_request', 'R33_CI_KIND')
    pr = event.get('pull_request', {}); number = event.get('number')
    need(type(number) is int and number > 35 and pr.get('number') == number and type(pr.get('number')) is int and
         pr.get('state') == 'open' and pr.get('draft') is True and pr.get('merged_at') is None and
         pr.get('closed_at') is None and pr.get('merged', False) is False and
         pr.get('maintainer_can_modify') is False and 'auto_merge' in pr and pr['auto_merge'] is None and
         pr.get('base', {}).get('sha') == BASE and pr['base'].get('ref') == PARENT_BRANCH and
         pr.get('head', {}).get('sha') == checkout and pr['head'].get('ref') == BRANCH and
         pr['head'].get('repo', {}).get('full_name') == 'TasfiqJ/onSkin' and
         env.get('GITHUB_REF') == 'refs/pull/'+str(number)+'/merge', 'R33_CI_EVENT')
    need(merge == [env.get('GITHUB_SHA'), BASE, checkout] and merge_tree == tree, 'R33_CI_TEST_MERGE')
    need(live == dict(main=MAIN, parent=BASE, source=checkout), 'R33_STALE_HEAD_OR_PARENT')
    return 'EXACT_EVENT_LIVE_PARENT_AND_SOURCE'


def verify():
    need(not sys.flags.optimize, 'R33_ASSERTIONS')
    p = parent(); check = p.helpers()
    check.full29_store(); authenticate_parent()
    checkout = text('rev-parse', 'HEAD'); tree_sha = text('rev-parse', 'HEAD^{tree}')
    need(len(parents(checkout)) == 2, 'R33_CHECKOUT_SOURCE_NOT_MERGE')
    source, seal = phase_guard(text('rev-list', '--reverse', BASE+'..'+checkout).splitlines())
    need(changed(BASE, seal, SOURCE|WORKLIST|{PLAN}) == SOURCE|WORKLIST|{PLAN}, 'R33_COMPLETE_SCOPE')
    need(git('show', seal+':'+PLAN) == git('show', PLAN_COMMIT+':'+PLAN), 'R33_PLAN_IMMUTABLE')
    task_guard(document(git('show', source+':'+TASK)), lambda name: git('show', source+':'+name))
    quality_guard(git('show', source+':.github/workflows/quality.yml'), git('show', BASE+':.github/workflows/quality.yml'))
    p.worklist_guard(document(git('show', seal+':docs/phase-4/generated/source-worklist.json')), source)
    index_tree = check.tree29(checkout); index = git('ls-files', '--stage', '-z')
    expected = b''.join((mode+' '+oid+' 0\t'+path+'\0').encode() for path, (mode, oid) in index_tree.items())
    overrides = p.filter_overrides()
    need(index == expected and not git(*overrides, 'status', '--porcelain=v1', '--untracked-files=all', '-z'), 'R33_DIRTY')
    need(all(line.startswith(b'H ') for line in git('ls-files', '-v', '-z').split(b'\0') if line), 'R33_INDEX_FLAGS')
    checked = check.working29_guard(index_tree)
    scope = document(p.child(['node', 'scripts/launch/full-app-contract33.mjs'], ROOT, dict(os.environ)))
    need(scope.get('valid') is True and scope.get('requiredRows') == 38 and scope.get('deferredRows') == 27 and
         scope.get('externalReady') is False and scope.get('candidateReady') is False and
         scope.get('acceptanceGranted') is False and scope.get('release') == 'NO_GO', 'R33_PRODUCT_CONTRACT')
    event = {}; live = {}; merge = []; merge_tree = None
    if os.environ.get('GITHUB_ACTIONS') == 'true':
        event_path = Path(os.environ.get('GITHUB_EVENT_PATH', ''))
        need(event_path.is_absolute(), 'R33_EVENT_PATH')
        event = document(check.regular29(event_path, 1024*1024))
        refs = text('ls-remote', '--exit-code', 'origin', 'refs/heads/main', 'refs/heads/'+PARENT_BRANCH, 'refs/heads/'+BRANCH).splitlines()
        names = {'refs/heads/main': 'main', 'refs/heads/'+PARENT_BRANCH: 'parent', 'refs/heads/'+BRANCH: 'source'}
        live = {names[name]: sha for sha, name in (r.split() for r in refs)}
        sha = os.environ.get('GITHUB_SHA', '')
        need(re.fullmatch('[0-9a-f]{40}', sha), 'R33_CI_SHA')
        merge = parents(sha); merge_tree = text('rev-parse', sha+'^{tree}')
    qualification = ci_guard(os.environ, event, checkout, tree_sha, merge, merge_tree, live)
    need(git('ls-files', '--stage', '-z') == index and text('rev-parse', 'HEAD') == checkout and
         not git(*overrides, 'status', '--porcelain=v1', '--untracked-files=all', '-z'), 'R33_FINAL_SNAPSHOT')
    return dict(valid=True, qualification=qualification, head=checkout, tree=tree_sha, sourceHead=source,
                sealedHead=seal, parentHead=BASE, trackedBlobsHashed=checked,
                governance='CURRENT_CAMPAIGN33_FINITE_SOURCE_ONLY', productScope=scope,
                historicalCheck='SEPARATE_PINNED_INTEGRATION32_AND_RELEASE29_REQUIRED',
                acceptanceGranted=False, admissions=dict.fromkeys(ADMISSIONS, False), release='NO_GO')


def historical():
    """Unchanged original32 and29 execute with no current CI event in a fresh clone.

    This mode proves only historical source. The separate verify() command is
    mandatory in Quality and owns the current Campaign33 checkout proof.
    """
    p = parent(); authenticate_parent()
    checkout = text('rev-parse', 'HEAD'); before_tree = text('rev-parse', 'HEAD^{tree}')
    refusal = document(p.child([sys.executable, '-I', '-B', PREFIX+'main_integration32.py'], ROOT,
                              dict(os.environ), expected=1))
    need(refusal.get('valid') is False and refusal.get('release') == 'NO_GO' and
         refusal.get('error') == 'R32_HISTORY_PHASES', 'R33_PRESERVE_ORIGINAL32_REFUSAL')
    workspace = Path(tempfile.mkdtemp(prefix='integration33-')).resolve()
    need(not workspace.is_relative_to(ROOT), 'R33_EXTERNAL_CLONE')
    root = workspace/'pr35'; env = p.clean_environment()
    p.child(['git', '-c', 'core.hooksPath=', 'clone', '--no-checkout', '--no-hardlinks', '--single-branch',
             '--branch', PARENT_BRANCH, '-c', 'core.autocrlf=false', '-c', 'core.longpaths=true',
             'https://github.com/TasfiqJ/onSkin.git', str(root)], workspace, env)
    # Suppress platform conversion without changing a tracked source byte.
    (root/'.git/info/attributes').write_bytes(b'* -text -eol -filter -ident -working-tree-encoding\n')
    p.child(['git', '-c', 'core.hooksPath=', 'checkout', '--detach', BASE], root, env)
    def pinned(*args):
        return p.child(['git', '--no-replace-objects', *args], root, env).decode().strip()
    need(pinned('rev-parse', 'HEAD') == BASE and pinned('rev-parse', 'HEAD^{tree}') == BASE_TREE and
         digest((root/PREFIX/'main_integration32.py').read_bytes()) == PARENT_SHA, 'R33_HISTORICAL_PIN')
    print('R33_EXACT_PR35_FULL_CLONE_AUTHENTICATED', file=sys.stderr, flush=True)
    node = Path(shutil.which('node')).resolve()
    candidates = [node.parent/'node_modules/npm/bin/npm-cli.js'] if os.name == 'nt' else [node.parent.parent/'lib/node_modules/npm/bin/npm-cli.js']
    if os.name == 'nt' and env.get('APPDATA'):
        candidates.insert(0, Path(env['APPDATA'])/'npm/node_modules/npm/bin/npm-cli.js')
    config = workspace/'empty.npmrc'; config.write_bytes(b'')
    env.update(npm_config_userconfig=os.devnull, npm_config_globalconfig=str(config))
    need(p.child([str(node), '--version'], root, env).strip() == b'v22.21.0', 'R33_RUNTIME')
    npm = next((path for path in candidates if path.is_file() and
                p.child([str(node), str(path), '--version'], root, env).strip() == b'11.20.0'), None)
    need(npm is not None, 'R33_RUNTIME')
    p.child([str(node), str(npm), 'ci', '--ignore-scripts=false', '--no-audit', '--no-fund'], root, env)
    p.child([str(node), 'scripts/postinstall.mjs', '--check'], root, env)
    print('R33_PR35_NORMAL_INSTALL_AND_HOOKS_PASS', file=sys.stderr, flush=True)
    result = document(p.child([sys.executable, '-I', '-B', PREFIX+'main_integration32.py', '--historical'],
                              root, env, timeout=1500))
    need(result.get('status') == 'PASS' and result.get('historicalCheckerExit') == 0 and
         result.get('acceptanceGranted') is False and result.get('release') == 'NO_GO', 'R33_HISTORICAL_RESULT')
    need(not pinned('status', '--porcelain=v1', '--untracked-files=all') and pinned('rev-parse', 'HEAD') == BASE and
         pinned('rev-parse', 'HEAD^{tree}') == BASE_TREE and text('rev-parse', 'HEAD') == checkout and
         text('rev-parse', 'HEAD^{tree}') == before_tree, 'R33_HISTORICAL_CHANGED')
    return dict(status='PASS', historicalParentHead=BASE, historicalParentTree=BASE_TREE,
                parentCheckerSHA256=PARENT_SHA, originalCurrent32Refusal=refusal, release29=result,
                qualification='SUPPLIER_PINNED_HISTORICAL_CLONES_NOT_CURRENT33_OR_OWNER_ADMISSION',
                current33Proof='SEPARATE_VERIFY_REQUIRED', npmCache='NORMAL_EXISTING_CACHE_NO_ZERO_CACHE_CLAIM',
                acceptanceGranted=False, release='NO_GO')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--historical', action='store_true'); args = parser.parse_args()
    try:
        print(json.dumps(historical() if args.historical else verify(), sort_keys=True))
        return 0
    except Exception as error:
        code = error.args[0] if type(error) is ValueError and len(error.args) == 1 else None
        safe = code if type(code) is str and re.fullmatch(r'(?:R33|R32|R29|R23)_[A-Z_]+', code) else 'R33_EXECUTION_INCOMPLETE'
        print(json.dumps(dict(valid=False, error=safe, acceptanceGranted=False, release='NO_GO')))
        return 1


if __name__ == '__main__':
    sys.exit(main())
