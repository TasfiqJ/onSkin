"""Finite current36 source integrity; authentic historical35/34/33/32/29 is separate."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import time
from types import SimpleNamespace
import urllib.request

ROOT = Path(__file__).resolve().parents[3]
BASE = '4c98bed778c1044b95cbb29fcaac06802fa398c1'
BASE_TREE = '3296835a6cd05c60a6dfff6aa2aa3e1e817ed597'
MAIN = '53a84d921d14dbff1d2e9b8f1b3bb27e10dcede6'
BRANCH = 'stage/m1-free-first-session-ci36'
PARENT_BRANCH = 'stage/m1-free-first-session-e2e35'
PLAN_COMMIT = '71540ac12cfb3111166c074e6e017dac3de7ba76'
PLAN = 'docs/brain/task-specs/M1X-36/SCOPE_PLAN.md'
PLAN_SHA = 'cd5e8e1841106e10069925388b876cde0f92657c530b39982bd142d809a18e4e'
TASK = 'docs/brain/task-specs/M1X-36/TASK.md'
PREFIX = 'scripts/release/full-app-j01/'
DOCS = 'docs/release/full-app-j01/'
AUTHORITY = 'BRAIN-M1X-FREE-FIRST-SESSION-CI-INTEGRITY36-SOURCE-REPAIR-01'
SOURCE = {'.github/workflows/quality.yml', PREFIX+'main_integration36.py',
          PREFIX+'main_integration36.test.py', PREFIX+'source_consumer36.test.py',
          TASK, DOCS+'ci-integration36.md', 'PROGRESS.md'}
WORKLIST = {'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md'}
GRANT = SOURCE | WORKLIST | {PLAN}
PINS = {
    38: (BASE, BASE_TREE, PARENT_BRANCH),
    37: ('7dea6048e5f1f5e397656b5f2fa670929fa9c2b8', '49b0baf1f20ca3d092db5d3cb14156feb2963f61', 'stage/m1-fullapp-dual-scope-readers34'),
    36: ('4ca36e915608460a1ed97d7fff94a3ece61296ab', '49945b4e453b4fc30ceb175f330c8b4b924afe31', 'stage/m1-fullapp-j01-scope-cutover33'),
    35: ('cbbb5a83bd29d2833399c214f5b6c6dd14873d24', '0745ad5f5595724a9b26de64324065dc3e53d2ea', 'stage/m1-main-quality-governance32'),
}
C35_PLAN = '74a1d1b449e3942677b327e748a41052552e8ae2'
C35_SOURCE = 'e5008a90c5315a51910be13f6e6690bdcc26ada5'
PROGRAMS = {
    'main_integration32.py': '5b48f78917aaf39e4da66138e3d5c52654af7defd1eaf37ab6404fdc631ceda4',
    'check.py': '944c04283b834e5f20bdfcbf95c265c7af57f8f4754952b4353dee5f8d8952dd',
    'main_integration33.py': '1176d7fa42f23ecde717ac4c9a96e5eb855774ac4e3bc2813f970a4004065616',
    'main_integration34.py': '342e21de512e4e3bf6dffb5e3ad9b86b6b47c9c30f9815d219cd0ab868858fdb',
    'main_integration35.py': '1418a7a04a9e91585bc7723a21a6455d86c6e28a1744ff09342275789771f32c',
}
ADMISSIONS = ['DB06', 'DB08', 'R2B', 'M103', 'M2', 'NATIVE', 'J01', 'CLINICAL',
              'PROVIDER', 'PAID', 'APPLE', 'PUBLIC', 'G97']
REQUIRED = [f'F{i:02}' for i in range(1, 21) if i != 18] + [f'V2-C{i:02}' for i in range(1, 13)] + [f'P{i:02}' for i in range(1, 7)] + ['J01']
DEFERRED = ['F18'] + [f'J{i:02}' for i in range(2, 28)]
GATES = ['G97', 'DB', 'M1-03', 'M2-01', 'G1', 'G2', 'G3', 'G4', 'G5', 'RIGHTS',
         'CLINICAL', 'PROVIDER', 'PAYMENT', 'MODERATION', 'OPERATIONS', 'DEVICE', 'APPLE', 'PUBLIC']
PHASES = ('SOURCE_PENDING', 'SOURCE_FROZEN')
H = None

NEW_STEP = '''      - name: Verify current36 integrity and separately pinned35/34/33/32/29
        run: |
          set -euo pipefail
          phase="${C36_PREFLIGHT_PHASE:-SOURCE_FROZEN}"
          if [ "$(git rev-parse --is-shallow-repository)" = true ]; then
            git fetch --no-tags --unshallow origin
          fi
          if [ "${GITHUB_EVENT_NAME:-}" = pull_request ]; then
            git fetch --no-tags origin "$GITHUB_REF"
            test "$(git rev-parse FETCH_HEAD)" = "$GITHUB_SHA"
          fi
          python3 -I -B scripts/release/full-app-j01/main_integration36.test.py
          python3 -I -B scripts/release/full-app-j01/source_consumer36.test.py
          node --test scripts/e2e/onboarding-first-session35.test.mjs scripts/e2e/retained-safety-assertions.test.mjs
          python3 -I -B scripts/release/full-app-j01/main_integration36.py --phase "$phase"
          python3 -I -B scripts/release/full-app-j01/main_integration36.py --phase "$phase" --scope full-app-j01-v2
          if python3 -I -B scripts/release/full-app-j01/main_integration36.py --phase "$phase" --scope full-app-j01-v2 --external-readiness; then
            echo 'External readiness must remain refused' >&2
            exit 1
          else
            test "$?" = 2
          fi
          node scripts/launch/check-contract.mjs
          python3 -I -B scripts/release/full-app-j01/main_integration36.py --historical
          node scripts/docs/source-packet-supersession09.test.mjs

'''


def need(value, code):
    if not value:
        raise ValueError(code)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def regular(path, limit=2*1024*1024):
    """Authenticate code before importing neutral primitives, including all parents."""
    for parent in path.parents:
        info = parent.lstat()
        need(stat.S_ISDIR(info.st_mode) and not parent.is_symlink() and
             not getattr(info, 'st_file_attributes', 0) & 1024, 'R36_REGULAR_PARENT')
    before = path.lstat()
    need(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and not path.is_symlink() and
         not getattr(before, 'st_file_attributes', 0) & 1024 and before.st_size <= limit,
         'R36_REGULAR_FILE')
    raw = path.read_bytes()
    after = path.lstat()
    need((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns) ==
         (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns), 'R36_CHANGED_READ')
    return raw


def primitives():
    """Only neutral32 Git/delta/JSON/raw-reader operations; never its verify()."""
    global H
    for name in ('main_integration32.py', 'check.py'):
        need(digest(regular(ROOT/PREFIX/name)) == PROGRAMS[name], 'R36_NEUTRAL_PREIMAGE')
    if H is None:
        path = ROOT/PREFIX/'main_integration32.py'
        namespace = {'__name__': 'authenticated_neutral32_not_source_admission', '__file__': str(path)}
        exec(compile(regular(path), str(path), 'exec'), namespace)
        H = SimpleNamespace(**namespace)
    return H


def git(*args):
    return primitives().git(*args)


def text(*args):
    return git(*args).decode().strip()


def document(raw):
    return primitives().document(raw)


def parents(commit):
    return text('rev-list', '--parents', '-n', '1', commit).split()


def changed(before, after, allowed):
    return primitives().delta(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', before, after), allowed)


def no_admission(value, code):
    need(value.get('acceptanceGranted') is False and value.get('release') == 'NO_GO' and
         value.get('admissions') == dict.fromkeys(ADMISSIONS, False) and
         all(v is False for v in value['admissions'].values()), code)


def authenticate_parent():
    for head, tree, _ in PINS.values():
        need(text('rev-parse', head+'^{tree}') == tree, 'R36_PARENT_TREE')
    chain = [PINS[37][0], C35_PLAN, C35_SOURCE, BASE]
    need(text('rev-list', '--reverse', chain[0]+'..'+BASE).splitlines() == chain[1:], 'R36_PARENT_PHASES')
    for before, after in zip(chain, chain[1:]):
        need(parents(after) == [after, before], 'R36_PARENT_LINEAR')
    plan35 = 'docs/brain/task-specs/M1X-35/SCOPE_PLAN.md'
    need(changed(chain[0], C35_PLAN, {plan35}) == {plan35} and
         digest(git('show', C35_PLAN+':'+plan35)) == 'b7748505d8dc85d4614beec844480f2e769d68d362e669016a7f76bd755f60c5', 'R36_PARENT_PLAN')
    task35 = 'docs/brain/task-specs/M1X-35/TASK.md'
    task = document(git('show', C35_SOURCE+':'+task35))
    source35 = {task35, '.github/workflows/quality.yml', 'PROGRESS.md', 'docs/USER_FLOW_TREE.md',
                DOCS+'free-first-session35.md', 'scripts/e2e/onboarding-first-session.mjs',
                'scripts/e2e/onboarding-first-session35.test.mjs', PREFIX+'main_integration35.py',
                PREFIX+'main_integration35.test.py', PREFIX+'source_consumer35.test.py'}
    need(changed(C35_PLAN, C35_SOURCE, source35) == source35 and changed(C35_SOURCE, BASE, WORKLIST) == WORKLIST,
         'R36_PARENT_SOURCE_SEAL')
    need(task.get('authority') == 'BRAIN-M1X-FREE-FIRST-SESSION-E2E35-SOURCE-CANDIDATE-01' and
         task.get('base') == chain[0] and task.get('baseTree') == PINS[37][1] and
         task.get('planCommit') == C35_PLAN and set(task.get('sourceHashes', {})) == source35-{task35},
         'R36_PARENT_LEDGER')
    no_admission(task, 'R36_PARENT_LEDGER')
    for name, sha in task['sourceHashes'].items():
        need(digest(git('show', C35_SOURCE+':'+name)) == sha and
             git('show', C35_SOURCE+':'+name) == git('show', BASE+':'+name), 'R36_PARENT_SOURCE_HASH')
    primitives().worklist_guard(document(git('show', BASE+':docs/phase-4/generated/source-worklist.json')), C35_SOURCE)
    for name, sha in PROGRAMS.items():
        need(digest(regular(ROOT/PREFIX/name)) == sha and
             digest(git('show', BASE+':'+PREFIX+name)) == sha, 'R36_ORIGINAL_PROGRAM')
    protected = [PREFIX+n for n in PROGRAMS if n != 'main_integration35.py'] + [
        'scripts/launch/candidate-scope34.mjs', 'scripts/launch/candidate-scope34.test.mjs',
        'scripts/launch/consumer-entry34.test.mjs', 'scripts/phase4/build-source-worklist.mjs']
    need(not git('diff', '--raw', chain[0], BASE, '--', *protected), 'R36_PARENT_PROTECTED')
    need(parents(PLAN_COMMIT) == [PLAN_COMMIT, BASE] and changed(BASE, PLAN_COMMIT, {PLAN}) == {PLAN} and
         digest(git('show', PLAN_COMMIT+':'+PLAN)) == PLAN_SHA, 'R36_PLAN_FIRST')


def phase_guard(commits, phase):
    need(phase in PHASES and 2 <= len(commits) <= 32 and len(set(commits)) == len(commits) and
         commits[0] == PLAN_COMMIT, 'R36_HISTORY_PHASES')
    source_commits = commits[1:] if phase == 'SOURCE_PENDING' else commits[1:-1]
    need(source_commits, 'R36_SOURCE_REQUIRED')
    previous, union = PLAN_COMMIT, set()
    for current in source_commits:
        need(parents(current) == [current, previous], 'R36_LINEAR_HISTORY')
        paths = changed(previous, current, SOURCE)
        need(paths, 'R36_EMPTY_SOURCE')
        union.update(paths)
        previous = current
    need(union == SOURCE and changed(BASE, previous, SOURCE|{PLAN}) == SOURCE|{PLAN}, 'R36_EXACT_SOURCE')
    seal = None
    if phase == 'SOURCE_FROZEN':
        seal = commits[-1]
        need(parents(seal) == [seal, previous] and changed(previous, seal, WORKLIST) == WORKLIST,
             'R36_SOLE_FINAL_SEAL')
    return previous, seal


def task_guard(value, body):
    need(type(value) is dict and set(value) == {'schema', 'authority', 'base', 'baseTree', 'planCommit',
         'sourceHashes', 'acceptanceGranted', 'admissions', 'release', 'qualification'}, 'R36_TASK_SCHEMA')
    need(type(value['schema']) is int and value['schema'] == 1 and value['authority'] == AUTHORITY and
         value['base'] == BASE and value['baseTree'] == BASE_TREE and value['planCommit'] == PLAN_COMMIT and
         value['qualification'] == 'SOURCE_INTEGRITY_NOT_QUALIFIED_ACCEPTANCE', 'R36_TASK_AUTHORITY')
    no_admission(value, 'R36_NO_ADMISSION')
    need(type(value['sourceHashes']) is dict and set(value['sourceHashes']) == SOURCE-{TASK}, 'R36_HASH_INVENTORY')
    for path, sha in value['sourceHashes'].items():
        need(type(sha) is str and re.fullmatch('[0-9a-f]{64}', sha) and digest(body(path)) == sha,
             'R36_SOURCE_HASH')


def quality_guard(raw, before):
    start = b'      - name: Verify finite free-first-session35 and separately pinned34/33/32/29\n'
    stop = b'      - name: Verify tooling security backports\n'
    need(before.count(start) == before.count(stop) == 1, 'R36_QUALITY_PARENT')
    prefix, remainder = before.split(start)
    _, suffix = remainder.split(stop)
    need(raw == prefix+NEW_STEP.encode()+stop+suffix, 'R36_QUALITY_ONLY_FIRST_STEP')


def scope_guard(bundle):
    need(set(bundle) == {'contract.v2.json', 'matrix.v2.json', 'precedence.v2.json', 'roadmap.v2.json',
         'owner-ledger33.v1.json'}, 'R36_SCOPE_INVENTORY')
    c, m, p, owner = [bundle[n] for n in ('contract.v2.json', 'matrix.v2.json', 'precedence.v2.json', 'owner-ledger33.v1.json')]
    need(c['schema_version'] == 2 and c['contract_id'] == 'onskin-full-app-j01-campaign33-v2' and
         c['required_f']+c['required_c']+c['required_p']+c['korean_candidates'] == REQUIRED and
         c['deferred_f']+c['deferred_j'] == DEFERRED and c['release_status'] == 'NO_GO' and
         all(c[k] is False for k in ('acceptanceGranted', 'candidateReady', 'productReady',
             'providerReady', 'paidReady', 'professionalReady', 'j01Qualified')), 'R36_SCOPE_NO_ADMISSION')
    ids = [f'F{i:02}' for i in range(1,21)]+[f'V2-C{i:02}' for i in range(1,13)]+[f'P{i:02}' for i in range(1,7)]+[f'J{i:02}' for i in range(1,28)]
    need(type(m['rows']) is list and [r.get('id') for r in m['rows']] == ids and
         (m['row_count'], m['required_count'], m['deferred_count']) == (65, 38, 27) and
         m['acceptanceGranted'] is False and m['release'] == 'NO_GO', 'R36_SCOPE_ROWS')
    for row in m['rows']:
        need(all(row[k] is False for k in ('complete', 'positive_output_enabled', 'owner_admitted')) and
             row['gates'] and len(set(row['gates'])) == len(row['gates']) and
             set(row['gates']) <= set(GATES), 'R36_ROW_NO_ADMISSION')
    need([g['id'] for g in owner['gates']] == GATES and owner['gates'] == c['gates'] and
         all(g['admitted'] is False and g['evidence'] == [] for g in owner['gates']) and
         owner['qualified_admissions'] == dict.fromkeys(ADMISSIONS, False) and
         owner['acceptanceGranted'] is False and owner['release'] == 'NO_GO' and
         p['source_validity']['status'] == 'CURRENT_FOR_PINNED_BASE_ONLY' and
         p['source_validity']['security_expiry_unchanged'] == '2026-10-21T00:00:00Z', 'R36_GATES_CLOSED')
    return dict(valid=True, scope='full-app-j01-v2', contract=c['contract_id'], requiredRows=38,
        deferredRows=27, totalRows=65, requiredIds=REQUIRED, deferredIds=DEFERRED,
        obligations=[dict(id=r['id'], complete=False, ownerAdmitted=False, positiveOutputEnabled=False,
            gates=r['gates']) for r in m['rows']], unadmittedGates=GATES,
        assessedHead=c['source_base'], assessedTree=c['source_base_tree'], assessmentRenewed=False,
        qualification='AUTHENTICATED_UNCHANGED_HISTORICAL_SCOPE_NOT_OWNER_ACCEPTANCE',
        externalReady=False, candidateReady=False, acceptanceGranted=False, release='NO_GO')


def scope():
    bundle = {}
    for name in ('contract.v2.json', 'matrix.v2.json', 'precedence.v2.json', 'roadmap.v2.json', 'owner-ledger33.v1.json'):
        raw = regular(ROOT/DOCS/name)
        need(raw == git('show', BASE+':'+DOCS+name), 'R36_SCOPE_DOCUMENT')
        bundle[name] = document(raw)
    # Reconcile every declared reference against authentic original assessed Git data
    # and present raw bytes. No old validator's current-source assumptions execute.
    matrix = bundle['matrix.v2.json']
    refs = [r for row in matrix['rows'] for r in row['source_refs']]
    refs += [matrix['history']['source_ref']] + matrix['history']['snapshot_refs']
    seen = {}
    for ref in refs:
        path = ref['path']
        need(type(path) is str and not path.startswith('/') and '\\' not in path and ':' not in path and
             all(p and p not in ('.', '..') for p in path.split('/')) and
             ref['source_commit'] == PINS[35][0] and ref['mode'] == '100644', 'R36_SCOPE_REFERENCE')
        if path in seen:
            need(ref == seen[path], 'R36_SCOPE_REFERENCE_DUPLICATE')
            continue
        seen[path] = ref
        raw = regular(ROOT/path)
        oid = hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
        need(digest(raw) == ref['sha256'] and oid == ref['blob'] and
             git('ls-tree', PINS[35][0], '--', path) == ('100644 blob '+oid+'\t'+path+'\n').encode(),
             'R36_SCOPE_REFERENCE_HASH')
    result = scope_guard(bundle)
    result['sourceReferencesHashed'] = len(seen)
    return result


def pr_guard(value, number, head, branch, base, base_branch):
    need(type(value) is dict and type(value.get('number')) is int and value['number'] == number and
         value.get('state') == 'open' and value.get('draft') is True and value.get('merged') is False and
         value.get('merged_at') is None and value.get('closed_at') is None and
         value.get('maintainer_can_modify') is False and 'auto_merge' in value and value['auto_merge'] is None and
         value.get('head', {}).get('sha') == head and value['head'].get('ref') == branch and
         value['head'].get('repo', {}).get('full_name') == 'TasfiqJ/onSkin' and
         value.get('base', {}).get('sha') == base and value['base'].get('ref') == base_branch and
         value['base'].get('repo', {}).get('full_name') == 'TasfiqJ/onSkin', 'R36_PR_CUSTODY')


def ci_guard(env, event, head, tree, merge, merge_tree, live, live_pr):
    expected = dict(main=MAIN, **{'pr'+str(n): p[0] for n, p in PINS.items()})
    if env.get('GITHUB_ACTIONS') != 'true':
        need(not any(k.startswith('GITHUB_') for k in env) and live == expected, 'R36_LOCAL_CONTEXT')
        return 'LOCAL_EXACT_CHECKOUT_NOT_HOSTED_CI'
    need(env.get('GITHUB_EVENT_NAME') == 'pull_request' and env.get('GITHUB_REPOSITORY') == 'TasfiqJ/onSkin' and
         type(event) is dict and event.get('repository', {}).get('full_name') == 'TasfiqJ/onSkin', 'R36_CI_KIND')
    number = event.get('number')
    need(type(number) is int and number > 38 and env.get('GITHUB_REF') == 'refs/pull/'+str(number)+'/merge', 'R36_CI_EVENT')
    for pr in (event.get('pull_request'), live_pr):
        pr_guard(pr, number, head, BRANCH, BASE, PARENT_BRANCH)
    need(re.fullmatch('[0-9a-f]{40}', env.get('GITHUB_SHA', '')) and
         merge == [env['GITHUB_SHA'], BASE, head] and merge_tree == tree, 'R36_SERVICE_TEST_MERGE')
    need(live == dict(expected, source=head), 'R36_STALE_REFS')
    return 'GENUINE_EVENT_LIVE_PR_REFS_SERVICE_TEST_MERGE'


def fetch_pr(number):
    request = urllib.request.Request('https://api.github.com/repos/TasfiqJ/onSkin/pulls/'+str(number),
        headers={'Accept': 'application/vnd.github+json', 'User-Agent': 'onSkin-current36-source-integrity'})
    with urllib.request.urlopen(request, timeout=30) as response:
        raw = response.read(1024*1024+1)
    need(len(raw) <= 1024*1024, 'R36_LIVE_PR_SIZE')
    return document(raw)


def live_refs(include_source=False):
    names = {'refs/heads/main': 'main', **{'refs/heads/'+p[2]: 'pr'+str(n) for n, p in PINS.items()}}
    if include_source:
        names['refs/heads/'+BRANCH] = 'source'
    values = {}
    for line in text('ls-remote', '--exit-code', 'origin', *names).splitlines():
        sha, name = line.split()
        need(name in names and names[name] not in values and re.fullmatch('[0-9a-f]{40}', sha), 'R36_LIVE_REFS')
        values[names[name]] = sha
    need(set(values) == set(names.values()), 'R36_LIVE_REFS')
    return values


def snapshot(head):
    check = primitives().helpers()
    tree = check.tree29(head)
    index = git('ls-files', '--stage', '-z')
    need(index == b''.join((mode+' '+oid+' 0\t'+path+'\0').encode() for path, (mode, oid) in tree.items()), 'R36_INDEX')
    need(all(line.startswith(b'H ') for line in git('ls-files', '-v', '-z').split(b'\0') if line), 'R36_INDEX_FLAGS')
    need(not git(*primitives().filter_overrides(), 'status', '--porcelain=v1', '--untracked-files=all', '-z'), 'R36_DIRTY')
    return index, check.working29_guard(tree)


def verify(phase='SOURCE_FROZEN'):
    need(not sys.flags.optimize and phase in PHASES, 'R36_PHASE')
    primitives().helpers().full29_store()
    need(text('remote', 'get-url', 'origin').removesuffix('.git') == 'https://github.com/TasfiqJ/onSkin', 'R36_ORIGIN')
    authenticate_parent()
    head, tree = text('rev-parse', 'HEAD'), text('rev-parse', 'HEAD^{tree}')
    need(len(parents(head)) == 2 and text('merge-base', BASE, head) == BASE, 'R36_SOURCE_HEAD')
    in_ci = os.environ.get('GITHUB_ACTIONS') == 'true'
    if not in_ci:
        need(text('symbolic-ref', '--short', 'HEAD') == BRANCH, 'R36_BRANCH')
    if in_ci:
        need(phase == 'SOURCE_FROZEN', 'R36_CI_REQUIRES_SEAL')
    source, seal = phase_guard(text('rev-list', '--reverse', BASE+'..'+head).splitlines(), phase)
    need(git('show', head+':'+PLAN) == git('show', PLAN_COMMIT+':'+PLAN), 'R36_PLAN_IMMUTABLE')
    task_guard(document(git('show', source+':'+TASK)), lambda path: git('show', source+':'+path))
    quality_guard(git('show', source+':.github/workflows/quality.yml'), git('show', BASE+':.github/workflows/quality.yml'))
    if seal:
        value = document(git('show', seal+':docs/phase-4/generated/source-worklist.json'))
        primitives().worklist_guard(value, source)
        need(value.get('warnings') == [], 'R36_WORKLIST_WARNINGS')
        markdown = git('show', seal+':docs/phase-4/generated/source-worklist.md')
        need(('Git SHA: '+source).encode() in markdown and b'Git status: clean' in markdown, 'R36_WORKLIST_MARKDOWN')
        run_readonly(['node', 'scripts/phase4/build-source-worklist.mjs', '--strict', '--check'])
    before = snapshot(head)
    projection = scope()
    for n, (phead, _, branch) in PINS.items():
        prior = PINS[n-1] if n > 35 else (MAIN, '', 'main')
        pr_guard(fetch_pr(n), n, phead, branch, prior[0], prior[2])
    live = live_refs(in_ci)
    event, merge, merge_tree, live_pr = {}, [], None, None
    if in_ci:
        path = Path(os.environ.get('GITHUB_EVENT_PATH', ''))
        need(path.is_absolute(), 'R36_EVENT_PATH')
        event = document(regular(path))
        number = event.get('number')
        need(type(number) is int and number > 38, 'R36_CI_EVENT')
        live_pr = fetch_pr(number)
        sha = os.environ.get('GITHUB_SHA', '')
        need(re.fullmatch('[0-9a-f]{40}', sha), 'R36_CI_SHA')
        merge, merge_tree = parents(sha), text('rev-parse', sha+'^{tree}')
    qualification = ci_guard(os.environ, event, head, tree, merge, merge_tree, live, live_pr)
    need(snapshot(head) == before and text('rev-parse', 'HEAD') == head and live_refs(in_ci) == live, 'R36_FINAL_SNAPSHOT')
    return dict(valid=True, phase=phase, head=head, tree=tree, sourceHead=source, sealedHead=seal,
        parentHead=BASE, parentTree=BASE_TREE, changedSourcePaths=sorted(SOURCE), trackedBlobsHashed=before[1],
        qualification=qualification, governance='CURRENT36_FINITE_SOURCE_ONLY', productScope=projection,
        historicalCheck='SEPARATE_FRESH_PR38_ORIGINAL35_34_33_32_29_REQUIRED',
        acceptanceGranted=False, admissions=dict.fromkeys(ADMISSIONS, False), release='NO_GO')


def run_readonly(args, expected=0, timeout=900):
    result = subprocess.run(args, cwd=ROOT, capture_output=True, timeout=timeout)
    need(result.returncode == expected, 'R36_READONLY_CHILD_EXIT')
    return result.stdout


def test_summary(raw, tests, passed, failed):
    lines = raw.replace(b'\r', b'').splitlines()
    for label, count in (('tests', tests), ('pass', passed), ('fail', failed), ('cancelled', 0), ('skipped', 0), ('todo', 0)):
        need(lines.count(('# '+label+' '+str(count)).encode()) == 1 and
             sum(line.startswith(('# '+label+' ').encode()) for line in lines) == 1, 'R36_TEST_INTERVAL')


def historical_result(raw):
    lines = [line for line in raw.replace(b'\r', b'').splitlines() if line]
    need(len(lines) == 4 and lines[0].startswith(b'R35_HISTORICAL_WORKSPACE ') and
         lines[1:3] == [b'R35_EXACT_PR37_FULL_CLONE_AUTHENTICATED', b'R35_PR37_NORMAL_INSTALL_AND_HOOKS_PASS'],
         'R36_HISTORICAL_TRANSCRIPT')
    value = document(lines[-1])
    no_admission(value, 'R36_HISTORICAL_NO_ADMISSION')
    need(value.get('status') == 'PASS' and value.get('historicalHead') == PINS[37][0] and
         value.get('historicalTree') == PINS[37][1] and value.get('checkerSHA256') == PROGRAMS['main_integration34.py'] and
         value.get('qualification') == 'SUPPLIER_PINNED34_33_32_29_REPLAY_NOT_CURRENT35_OR_OWNER_ACCEPTANCE', 'R36_HISTORICAL_PIN')
    original = value.get('original34', {})
    no_admission(original, 'R36_HISTORICAL34')
    need(original.get('valid') is True and original.get('head') == PINS[37][0] and
         original.get('tree') == PINS[37][1] and value.get('original34CurrentRefusal') ==
         dict(valid=False, error='R34_WRONG_BRANCH', acceptanceGranted=False, release='NO_GO'), 'R36_HISTORICAL34')
    # The original35 parser is a hash-authenticated neutral transcript reader only.
    path = ROOT/PREFIX/'main_integration35.py'
    raw_program = regular(path)
    need(digest(raw_program) == PROGRAMS[path.name], 'R36_ORIGINAL_PROGRAM')
    ns = {'__name__': 'original35_transcript_parser_only', '__file__': str(path)}
    exec(compile(raw_program, str(path), 'exec'), ns)
    nested = value.get('original33And32And29')
    ns['historical_result'](b'R34_HISTORICAL_WORKSPACE /already-executed-child\nR34_EXACT_PR36_FULL_CLONE_AUTHENTICATED\nR34_PR36_NORMAL_INSTALL_AND_HOOKS_PASS\n'+json.dumps(nested).encode())
    expected_names = ['clone-pr37', 'checkout-pr37-named34', 'node-version', 'normal-npm-ci', 'postinstall-check',
        'main_integration34.test.py', 'source_consumer34.test.py', 'original34-node-controls',
        'original34-candidate-cli', 'original34-default-cli', 'original34-explicit-cli', 'original34-external-readiness',
        'original34-current-source', 'original151-negatives', 'original09-source-controls', 'original34-pinned33-32-29']
    receipts = value.get('receipts')
    need(type(receipts) is list and [r.get('name') for r in receipts] == expected_names, 'R36_HISTORICAL_COMMAND_INTERVAL')
    workspace = Path(value.get('workspace', ''))
    need(workspace.is_absolute(), 'R36_HISTORICAL_WORKSPACE')
    root = workspace/'pr37'
    node = receipts[2].get('command', [None])[0]
    need(type(node) is str and Path(node).is_absolute(), 'R36_HISTORICAL_COMMAND')
    commands = {
        'clone-pr37': ['git', '-c', 'core.hooksPath=', 'clone', '--no-checkout', '--no-hardlinks',
            '--single-branch', '--branch', PINS[37][2], '-c', 'core.autocrlf=false', '-c', 'core.longpaths=true',
            'https://github.com/TasfiqJ/onSkin.git', str(root)],
        'checkout-pr37-named34': ['git', '-c', 'core.hooksPath=', 'checkout', PINS[37][2]],
        'node-version': [node, '--version'],
        'postinstall-check': [node, 'scripts/postinstall.mjs', '--check'],
        **{name: [sys.executable, '-I', '-B', PREFIX+name] for name in ('main_integration34.test.py', 'source_consumer34.test.py')},
        'original34-node-controls': [node, '--test', 'scripts/launch/candidate-scope34.test.mjs', 'scripts/launch/consumer-entry34.test.mjs'],
        'original34-candidate-cli': [node, 'scripts/launch/candidate-scope34.mjs', '--mode', 'verification'],
        'original34-default-cli': [node, 'scripts/launch/check-contract.mjs'],
        'original34-explicit-cli': [node, 'scripts/launch/check-contract.mjs', '--scope', 'full-app-j01-v2'],
        'original34-external-readiness': [node, 'scripts/launch/check-contract.mjs', '--scope', 'full-app-j01-v2', '--external-readiness'],
        'original34-current-source': [sys.executable, '-I', '-B', PREFIX+'main_integration34.py'],
        'original151-negatives': [sys.executable, '-B', PREFIX+'test_contract.py'],
        'original09-source-controls': [sys.executable, '-B', PREFIX+'source_consumer09.test.py'],
        'original34-pinned33-32-29': [sys.executable, '-I', '-B', PREFIX+'main_integration34.py', '--historical'],
    }
    for row in receipts:
        expected = 2 if row['name'] == 'original34-external-readiness' else 0
        need(type(row.get('exit')) is int and row['exit'] == expected and row.get('expectedExit') == expected and
             row.get('timedOut') is False and row.get('historicalHead') == PINS[37][0] and
             row.get('historicalTree') == PINS[37][1] and type(row.get('command')) is list and
             re.fullmatch('[0-9a-f]{64}', row.get('sha256', '')), 'R36_HISTORICAL_CHILD')
        if row['name'] == 'normal-npm-ci':
            command = row['command']
            need(len(command) == 6 and command[0] == node and Path(command[1]).is_absolute() and
                 Path(command[1]).name == 'npm-cli.js' and command[2:] ==
                 ['ci', '--ignore-scripts=false', '--no-audit', '--no-fund'], 'R36_HISTORICAL_COMMAND')
        else:
            need(row['command'] == commands[row['name']], 'R36_HISTORICAL_COMMAND')
    return value


def historical():
    """Execute fresh exact PR38 without fabricating any GitHub environment/event."""
    authenticate_parent()
    start_head = text('rev-parse', 'HEAD')
    env = primitives().clean_environment()
    workspace = Path(tempfile.mkdtemp(prefix='integration36-')).resolve()
    need(not workspace.is_relative_to(ROOT), 'R36_EXTERNAL_CLONE')
    root, logs = workspace/'pr38', workspace/'logs'
    logs.mkdir()
    print('R36_HISTORICAL_WORKSPACE '+str(workspace), file=sys.stderr, flush=True)
    receipts = []
    def run(name, args, cwd=root, expected=0, timeout=1800):
        log = logs/(name+'.log')
        started, timed_out = time.monotonic(), False
        with log.open('wb') as output:
            process = subprocess.Popen(args, cwd=cwd, env=env, stdout=output, stderr=subprocess.STDOUT)
            try:
                process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                process.kill(); process.wait(); timed_out=True
        raw = log.read_bytes()
        receipts.append(dict(name=name, command=args, exit=process.returncode, expectedExit=expected,
            seconds=round(time.monotonic()-started, 3), timedOut=timed_out, bytes=len(raw), sha256=digest(raw), log=str(log)))
        (logs/'receipts.json').write_text(json.dumps(receipts, indent=2)+'\n', encoding='utf-8')
        need(not timed_out and len(raw) <= 8*1024*1024, 'R36_HISTORICAL_TIMEOUT_OR_OUTPUT')
        need(process.returncode == expected, 'R36_HISTORICAL_CHILD_EXIT')
        return raw
    run('clone-pr38', ['git', '-c', 'core.hooksPath=', 'clone', '--no-local', '--no-hardlinks', '--no-checkout',
        '--single-branch', '--branch', PARENT_BRANCH, '-c', 'core.autocrlf=false', '-c', 'core.longpaths=true',
        'https://github.com/TasfiqJ/onSkin.git', str(root)], workspace)
    run('checkout-pr38', ['git', 'checkout', PARENT_BRANCH])
    def pinned(*args):
        return run('pin-'+str(len(receipts)), ['git', '--no-replace-objects', *args]).decode().strip()
    need(pinned('rev-parse', 'HEAD') == BASE and pinned('rev-parse', 'HEAD^{tree}') == BASE_TREE and
         pinned('rev-parse', '--is-shallow-repository') == 'false', 'R36_HISTORICAL_PIN')
    for name, sha in PROGRAMS.items():
        need(digest(regular(root/PREFIX/name)) == sha, 'R36_HISTORICAL_PROGRAM')
    node = Path(shutil.which('node')).resolve()
    candidates = [node.parent/'node_modules/npm/bin/npm-cli.js'] if os.name == 'nt' else [node.parent.parent/'lib/node_modules/npm/bin/npm-cli.js']
    if env.get('APPDATA'):
        candidates.insert(0, Path(env['APPDATA'])/'npm/node_modules/npm/bin/npm-cli.js')
    config = workspace/'empty.npmrc'; config.write_bytes(b'')
    env.update(npm_config_userconfig=os.devnull, npm_config_globalconfig=str(config))
    need(run('node-version', [str(node), '--version']).strip() == b'v22.21.0', 'R36_RUNTIME')
    npm = next((p for p in candidates if p.is_file() and subprocess.check_output([str(node), str(p), '--version'], env=env).strip() == b'11.20.0'), None)
    need(npm is not None, 'R36_RUNTIME')
    run('normal-npm-ci', [str(node), str(npm), 'ci', '--ignore-scripts=false', '--no-audit', '--no-fund'])
    run('postinstall-check', [str(node), 'scripts/postinstall.mjs', '--check'])
    for name in ('main_integration35.test.py', 'source_consumer35.test.py'):
        run('original35-'+name, [sys.executable, '-I', '-B', PREFIX+name])
    driver = run('original35-driver49', [str(node), '--test', 'scripts/e2e/onboarding-first-session35.test.mjs', 'scripts/e2e/retained-safety-assertions.test.mjs'])
    test_summary(driver, 49, 49, 0)
    refusal35 = document(run('original35-current-refusal', [sys.executable, '-I', '-B', PREFIX+'main_integration35.py'], expected=1))
    need(refusal35 == dict(valid=False, error='R32_CHILD_EXIT', acceptanceGranted=False, release='NO_GO'), 'R36_ORIGINAL35_REFUSAL')
    refusal34 = document(run('original34-cli-pr38-refusal', [str(node), 'scripts/launch/candidate-scope34.mjs', '--mode', 'verification'], expected=1))
    need(refusal34 == dict(valid=False, error='R34_SOURCE_INTERVAL', acceptanceGranted=False, release='NO_GO'), 'R36_ORIGINAL34_REFUSAL')
    tests = run('original34-pr38-tests-refusal', [str(node), '--test', 'scripts/launch/candidate-scope34.test.mjs', 'scripts/launch/consumer-entry34.test.mjs'], expected=1)
    test_summary(tests, 31, 2, 29)
    need(tests.count(b'R34_SOURCE_INTERVAL') >= 29, 'R36_ORIGINAL34_REFUSAL')
    result = historical_result(run('original35-authentic-historical', [sys.executable, '-I', '-B', PREFIX+'main_integration35.py', '--historical'], timeout=5400))
    for row in result['receipts']:
        body = regular(Path(row['log']), 8*1024*1024)
        need(len(body) == row['bytes'] and digest(body) == row['sha256'], 'R36_HISTORICAL_LOG_HASH')
        if row['name'] == 'original34-node-controls':
            test_summary(body, 31, 31, 0)
        if row['name'] == 'original151-negatives':
            need(document(body.splitlines()[-1]) == dict(passed=True, negative_cases=151, current_exit=0,
                 tampered_exits=1, restored_exit=0, qualification='BUNDLE_FIXTURES_ONLY_NOT_INDEPENDENT_CHECKOUT'),
                 'R36_ORIGINAL151_SUMMARY')
    need(not pinned('status', '--porcelain=v1', '--untracked-files=all') and pinned('rev-parse', 'HEAD') == BASE and
         text('rev-parse', 'HEAD') == start_head, 'R36_HISTORICAL_CHANGED')
    return dict(status='PASS', historicalHead=BASE, historicalTree=BASE_TREE, original35CurrentRefusal=refusal35,
        original34PR38Refusal=refusal34, original35Historical=result, receipts=receipts, workspace=str(workspace),
        qualification='FRESH_AUTHENTIC_PR38_35_34_33_32_29_NOT_CURRENT_OR_OWNER_ACCEPTANCE',
        npmCache='NORMAL_EXISTING_CACHE_NO_ZERO_CACHE_CLAIM', acceptanceGranted=False,
        admissions=dict.fromkeys(ADMISSIONS, False), release='NO_GO')


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--phase', choices=PHASES, default='SOURCE_FROZEN')
    group = p.add_mutually_exclusive_group()
    group.add_argument('--historical', action='store_true')
    group.add_argument('--scope', choices=['full-app-j01-v2'])
    p.add_argument('--external-readiness', action='store_true')
    args = p.parse_args()
    try:
        need(not args.external_readiness or args.scope is not None, 'R36_EXPLICIT_SCOPE_REQUIRED')
        result = historical() if args.historical else verify(args.phase)
        if args.scope:
            result = dict(result['productScope'], head=result['head'], tree=result['tree'], phase=args.phase,
                          sourceQualification=result['qualification'])
        print(json.dumps(result, sort_keys=True))
        return 2 if args.external_readiness else 0
    except Exception as exc:
        code = str(exc)
        reason = code if re.fullmatch(r'(?:R36|R32|R29|R23)_[A-Z_]+', code) else 'R36_EXECUTION_INCOMPLETE'
        print(json.dumps(dict(valid=False, error=reason, acceptanceGranted=False, release='NO_GO')))
        return 1


if __name__ == '__main__':
    sys.exit(main())
