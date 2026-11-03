"""Finite Campaign45 source integrity; no owner, security or release admission."""
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
from types import ModuleType

ROOT = Path(__file__).resolve().parents[3]
BASE = '3865cdd8f610d2c715bd1f3f304ab3c756ca4fbc'
BASE_TREE = 'c02c58151aa2c23090712494bb8b758f1feb7dab'
MAIN = '53a84d921d14dbff1d2e9b8f1b3bb27e10dcede6'
BRANCH = 'stage/m1-owner-plan-history45'
PARENT_BRANCH = 'stage/m1-plan-source-reset-fence44'
PLAN_COMMIT = '054f2adf7169fa2c7da8b29150193835b27e62c0'
PLAN_SHA = '43dec79273fad05121ce5aaf0d13100b708a3e0fc7585c5760e25b7cf6b474f6'
PREFIX = 'scripts/release/full-app-j01/'
DOCS = 'docs/release/full-app-j01/'
PLAN = 'docs/brain/task-specs/M1X-45/SCOPE_PLAN.md'
TASK = 'docs/brain/task-specs/M1X-45/TASK.md'
AUTHORITY = 'M1X-V2-C05-OWNER-PLAN-VERSIONS45-SOURCE-CANDIDATE-01'
PHASES = ('SOURCE_PENDING', 'SOURCE_FROZEN')
WORKLIST = {'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md'}
GRANT = {
    PLAN, TASK, *WORKLIST, 'PROGRESS.md', '.github/workflows/quality.yml',
    'apps/mobile/src/features/routine/planHistory45.ts',
    'apps/mobile/src/features/routine/planHistory45.test.ts',
    'apps/mobile/src/features/routine/planHistory45Encrypted.test.ts',
    'apps/mobile/src/features/routine/PlanHistoryPanel45.tsx',
    'apps/mobile/src/features/routine/PlanHistoryPanel45.test.tsx',
    'apps/mobile/src/features/routine/planSourceFence44.ts',
    'apps/mobile/src/features/routine/planSourceFence44.test.ts',
    'apps/mobile/src/features/routine/usePlan.ts',
    'apps/mobile/src/features/routine/usePlan.test.ts',
    'apps/mobile/src/features/routine/orderStore.ts',
    'apps/mobile/src/features/routine/orderStore.test.ts',
    'apps/mobile/src/features/routine/planRecovery.test.ts',
    'apps/mobile/src/features/routine/PlanSourceNotice.tsx',
    'apps/mobile/src/app/routine/plan.tsx',
    'apps/mobile/src/features/routine/orderRoutes.test.ts',
    'apps/mobile/src/lib/storage/privateKV.ts',
    'apps/mobile/src/lib/storage/privateKVSourceFence44.test.ts',
    'apps/mobile/src/lib/consent/healthDataWriteAdmission.ts',
    'apps/mobile/src/lib/consent/healthDataWriteAdmission.test.ts',
    'apps/mobile/src/features/settings/localPrivateDataKeys.ts',
    'apps/mobile/src/features/settings/localPrivateDataKeys.test.ts',
    'apps/mobile/src/features/settings/localPrivateData.ts',
    'apps/mobile/src/features/settings/localPrivateData.test.ts',
    'apps/mobile/src/features/settings/localPrivateDataFence44.test.ts',
    'apps/mobile/src/lib/consent/withdrawal.ts',
    'apps/mobile/src/lib/consent/withdrawal.test.ts',
    'apps/mobile/src/features/settings/localDeviceExport.ts',
    'apps/mobile/src/features/settings/localDeviceExport.test.ts',
    'apps/mobile/src/features/settings/mobileDataExportWriter.ts',
    DOCS+'owner-plan-history45.md', PREFIX+'main_integration45.py',
    PREFIX+'main_integration45.test.py', PREFIX+'source_consumer45.test.py',
}
SOURCE = GRANT-WORKLIST-{PLAN}
ESSENTIAL = {
    TASK, 'PROGRESS.md', '.github/workflows/quality.yml',
    'apps/mobile/src/features/routine/planHistory45.ts',
    'apps/mobile/src/features/routine/planHistory45.test.ts',
    'apps/mobile/src/features/routine/planHistory45Encrypted.test.ts',
    'apps/mobile/src/features/routine/PlanHistoryPanel45.tsx',
    'apps/mobile/src/features/routine/PlanHistoryPanel45.test.tsx',
    'apps/mobile/src/features/routine/planSourceFence44.ts',
    'apps/mobile/src/app/routine/plan.tsx',
    'apps/mobile/src/lib/storage/privateKV.ts',
    'apps/mobile/src/features/settings/localPrivateDataKeys.ts',
    'apps/mobile/src/features/settings/localPrivateDataKeys.test.ts',
    'apps/mobile/src/features/settings/localDeviceExport.ts',
    'apps/mobile/src/features/settings/localDeviceExport.test.ts',
    DOCS+'owner-plan-history45.md', PREFIX+'main_integration45.py',
    PREFIX+'main_integration45.test.py', PREFIX+'source_consumer45.test.py',
}
PROGRAMS = {
    'main_integration32.py': '5b48f78917aaf39e4da66138e3d5c52654af7defd1eaf37ab6404fdc631ceda4',
    'check.py': '944c04283b834e5f20bdfcbf95c265c7af57f8f4754952b4353dee5f8d8952dd',
    'main_integration44.py': 'faa8527c97f14ded526b83e50eb6da5c93ef7f7e4545125a0f3f0d9d9545987a',
    'main_integration44.test.py': '5b2e15bc8e0db6b83d05d88ecb4f4f7a323b898e32ff4fbc55f3930473fa18cc',
    'source_consumer44.test.py': '91e1472bdd2276819f942bde099c7f7cc8a9c23f008e0baeaba3625fb8119b6c',
}
ADMISSIONS = ['DB06', 'DB08', 'R2B', 'M103', 'M2', 'NATIVE', 'J01', 'CLINICAL',
              'PROVIDER', 'PAID', 'APPLE', 'PUBLIC', 'G97']
H = None
O44 = None


def need(value, code):
    if not value:
        raise ValueError(code)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def regular(path, limit=2*1024*1024):
    for parent in path.parents:
        info = parent.lstat()
        need(stat.S_ISDIR(info.st_mode) and not parent.is_symlink() and
             not getattr(info, 'st_file_attributes', 0) & 1024, 'R45_REGULAR_PARENT')
    before = path.lstat()
    need(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and not path.is_symlink() and
         not getattr(before, 'st_file_attributes', 0) & 1024 and before.st_size <= limit,
         'R45_REGULAR_FILE')
    raw = path.read_bytes()
    after = path.lstat()
    need((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns) ==
         (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns), 'R45_CHANGED_READ')
    return raw


def authenticated_program(name):
    path = ROOT/PREFIX/name
    raw = regular(path)
    need(digest(raw) == PROGRAMS[name], 'R45_ORIGINAL_PROGRAM')
    module = ModuleType('authenticated_neutral_definitions_not_current_source_acceptance')
    module.__file__ = str(path)
    exec(compile(raw, str(path), 'exec'), module.__dict__)
    return module


def primitives():
    global H
    for name in ('main_integration32.py', 'check.py'):
        need(digest(regular(ROOT/PREFIX/name)) == PROGRAMS[name], 'R45_NEUTRAL_PREIMAGE')
    if H is None:
        H = authenticated_program('main_integration32.py')
    return H


def original44():
    """Authenticated pure guards/parsers; original44 CURRENT runs in fresh PR45 only."""
    global O44
    need(digest(regular(ROOT/PREFIX/'main_integration44.py')) == PROGRAMS['main_integration44.py'],
         'R45_ORIGINAL44_IDENTITY')
    if O44 is None:
        O44 = authenticated_program('main_integration44.py')
    return O44


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
    admissions = value.get('admissions')
    need(value.get('acceptanceGranted') is False and value.get('release') == 'NO_GO' and
         type(admissions) is dict and set(admissions) == set(ADMISSIONS) and
         all(v is False for v in admissions.values()), code)


def phase_guard(commits, phase, source_paths):
    allowed = set(source_paths)
    need(ESSENTIAL <= allowed <= SOURCE and phase in PHASES and 2 <= len(commits) <= 32 and
         len(set(commits)) == len(commits) and commits[0] == PLAN_COMMIT, 'R45_HISTORY_PHASES')
    source_commits = commits[1:] if phase == 'SOURCE_PENDING' else commits[1:-1]
    need(source_commits, 'R45_SOURCE_REQUIRED')
    previous, union = PLAN_COMMIT, set()
    for current in source_commits:
        need(parents(current) == [current, previous], 'R45_LINEAR_HISTORY')
        paths = changed(previous, current, allowed)
        need(paths, 'R45_EMPTY_SOURCE')
        union.update(paths)
        previous = current
    need(union == allowed and changed(BASE, previous, allowed|{PLAN}) == allowed|{PLAN}, 'R45_EXACT_SOURCE')
    seal = None
    if phase == 'SOURCE_FROZEN':
        seal = commits[-1]
        need(parents(seal) == [seal, previous] and changed(previous, seal, WORKLIST) == WORKLIST,
             'R45_SOLE_FINAL_SEAL')
    return previous, seal


def task_guard(value, read_body):
    need(type(value) is dict and set(value) == {'schema', 'authority', 'base', 'baseTree', 'planCommit',
         'sourceHashes', 'commands', 'acceptanceGranted', 'admissions', 'release', 'qualification'},
         'R45_TASK_SCHEMA')
    need(type(value['schema']) is int and value['schema'] == 1 and value['authority'] == AUTHORITY and
         value['base'] == BASE and value['baseTree'] == BASE_TREE and value['planCommit'] == PLAN_COMMIT and
         value['qualification'] == 'SOURCE_INTEGRITY_NOT_QUALIFIED_ACCEPTANCE', 'R45_TASK_AUTHORITY')
    no_admission(value, 'R45_NO_ADMISSION')
    hashes = value['sourceHashes']
    need(type(hashes) is dict and ESSENTIAL-{TASK} <= set(hashes) <= SOURCE-{TASK}, 'R45_HASH_INVENTORY')
    for path, sha in hashes.items():
        need(type(sha) is str and re.fullmatch('[0-9a-f]{64}', sha) and digest(read_body(path)) == sha,
             'R45_SOURCE_HASH')
    need(type(value['commands']) is list and value['commands'], 'R45_COMMAND_LEDGER')
    for row in value['commands']:
        need(type(row) is dict and set(row) == {'command', 'exit', 'qualification', 'logSha256'}, 'R45_COMMAND_LEDGER')
        command = row['command']
        need((type(command) is str and command.strip() or type(command) is list and command and
             all(type(v) is str and v for v in command)) and
             (row['exit'] is None or type(row['exit']) is int) and
             type(row['qualification']) is str and bool(row['qualification']) and
             (row['logSha256'] is None or type(row['logSha256']) is str and
              re.fullmatch('[0-9a-f]{64}', row['logSha256'])), 'R45_COMMAND_LEDGER')
    return set(hashes)|{TASK}


def scope(source_paths=None):
    bundle = {}
    for name in ('contract.v2.json', 'matrix.v2.json', 'precedence.v2.json', 'roadmap.v2.json', 'owner-ledger33.v1.json'):
        raw = regular(ROOT/DOCS/name)
        need(raw == git('show', BASE+':'+DOCS+name), 'R45_SCOPE_DOCUMENT')
        bundle[name] = document(raw)
    old = original44().original41()
    result = old.scope_guard(bundle)
    matrix = bundle['matrix.v2.json']
    refs = [ref for row in matrix['rows'] for ref in row['source_refs']]
    refs += [matrix['history']['source_ref']] + matrix['history']['snapshot_refs']
    seen, inherited = {}, []
    for ref in refs:
        path = ref['path']
        need(type(path) is str and not path.startswith('/') and '\\' not in path and ':' not in path and
             all(p and p not in ('.', '..') for p in path.split('/')) and
             ref['source_commit'] == old.PINS[35][0] and ref['mode'] == '100644', 'R45_SCOPE_REFERENCE')
        if path in seen:
            need(ref == seen[path], 'R45_SCOPE_REFERENCE_DUPLICATE')
            continue
        seen[path] = ref
        historical = git('show', ref['source_commit']+':'+path)
        oid = hashlib.sha1(('blob '+str(len(historical))+'\0').encode()+historical).hexdigest()
        need(digest(historical) == ref['sha256'] and oid == ref['blob'] and
             git('ls-tree', ref['source_commit'], '--', path) == ('100644 blob '+oid+'\t'+path+'\n').encode(),
             'R45_SCOPE_REFERENCE_HASH')
        current = regular(ROOT/path)
        need(current == git('show', BASE+':'+path) or path in set(source_paths or ()) and path in SOURCE,
             'R45_SCOPE_UNGRANTED_CHANGE')
        if current != historical:
            inherited.append(dict(path=path, assessedSHA256=ref['sha256'], currentSHA256=digest(current),
                                  qualification='CURRENT_SOURCE_NOT_REASSESSED_OR_ADMITTED'))
    result.update(sourceReferencesHashed=len(seen), changedHistoricalReferences=inherited,
                  assessmentRenewed=False, authorizedDifferencesNotReassessed=True)
    return result


def new_step():
    step = original44().new_step().replace('Verify current44 source/reset fence',
        'Verify current45 owner-saved local plan history').replace('separately pinned41/', 'separately pinned44/41/')
    step = step.replace('C44_PREFLIGHT_PHASE', 'C45_PREFLIGHT_PHASE')
    step = step.replace('main_integration44', 'main_integration45').replace('source_consumer44', 'source_consumer45')
    step = step.replace('src/lib/storage/privateKVSourceFence44.test.ts ',
        'src/features/routine/planHistory45.test.ts src/features/routine/planHistory45Encrypted.test.ts '
        'src/features/settings/localPrivateDataKeys.test.ts src/features/settings/localDeviceExport.test.ts '
        'src/lib/storage/privateKVSourceFence44.test.ts ')
    step = step.replace("include: ['src/features/today/OptionalChangePanel41.test.tsx']",
        "include: ['src/features/today/OptionalChangePanel41.test.tsx', 'src/features/routine/PlanHistoryPanel45.test.tsx']")
    return step


def quality_guard(raw, before):
    start = b'      - name: Verify current44 source/reset fence and separately pinned41/40/39/38/37/36/35/34/33/32/29\n'
    stop = b'      - name: Verify tooling security backports\n'
    need(before.count(start) == before.count(stop) == 1, 'R45_QUALITY_PARENT')
    prefix, remainder = before.split(start)
    _, suffix = remainder.split(stop)
    need(raw == prefix+new_step().encode()+stop+suffix, 'R45_QUALITY_ONLY_FIRST_STEP')


def authenticate_parent():
    """Independently audit pinned PR45 commits and source, never original44 CURRENT on C45."""
    need(text('rev-parse', BASE+'^{tree}') == BASE_TREE, 'R45_PARENT_TREE')
    old = original44()
    old.authenticate_parent()
    for name, sha in PROGRAMS.items():
        need(digest(regular(ROOT/PREFIX/name)) == sha and digest(git('show', BASE+':'+PREFIX+name)) == sha,
             'R45_ORIGINAL_PROGRAM')
    chain = [old.PLAN_COMMIT, old.DIAGNOSTIC_HEAD, '3802dd386928a966226e0fd3ec5fa678c561b6a6', BASE]
    need(text('rev-list', '--reverse', old.BASE+'..'+BASE).splitlines() == chain, 'R45_PARENT_PHASES')
    value = document(git('show', chain[-2]+':'+old.TASK))
    paths = old.task_guard(value, lambda path: git('show', chain[-2]+':'+path))
    source, seal = old.phase_guard(chain, 'SOURCE_FROZEN', paths)
    need(source == chain[-2] and seal == BASE, 'R45_PARENT_SEAL')
    old.quality_guard(git('show', source+':.github/workflows/quality.yml'),
                      git('show', old.BASE+':.github/workflows/quality.yml'))
    primitives().worklist_guard(document(git('show', BASE+':docs/phase-4/generated/source-worklist.json')), source)
    need(parents(PLAN_COMMIT) == [PLAN_COMMIT, BASE] and changed(BASE, PLAN_COMMIT, {PLAN}) == {PLAN} and
         digest(git('show', PLAN_COMMIT+':'+PLAN)) == PLAN_SHA, 'R45_PLAN_FIRST')
    need(set(BASELINES) == GRANT and len(GRANT) == 39, 'R45_BASELINE_INVENTORY')
    for path, entry in BASELINES.items():
        mode, blob, sha, size = entry
        expected = b'' if blob is None else (mode+' blob '+blob+'\t'+path+'\n').encode()
        need(git('ls-tree', BASE, '--', path) == expected, 'R45_BASELINE_IDENTITY')
        if blob is not None:
            raw = git('show', BASE+':'+path)
            need(digest(raw) == sha and len(raw) == size, 'R45_BASELINE_IDENTITY')


def snapshot(head):
    check = primitives().helpers()
    tree = check.tree29(head)
    index = git('ls-files', '--stage', '-z')
    need(index == b''.join((mode+' '+oid+' 0\t'+path+'\0').encode() for path, (mode, oid) in tree.items()), 'R45_INDEX')
    need(all(line.startswith(b'H ') for line in git('ls-files', '-v', '-z').split(b'\0') if line), 'R45_INDEX_FLAGS')
    need(not git(*primitives().filter_overrides(), 'status', '--porcelain=v1', '--untracked-files=all', '-z'), 'R45_DIRTY')
    return index, check.working29_guard(tree)


def pins():
    return dict(original44().pins()) | {45: (BASE, BASE_TREE, PARENT_BRANCH)}


def ci_guard(env, event, head, tree, merge, merge_tree, live, live_pr):
    expected = dict(main=MAIN, **{'pr'+str(n): p[0] for n, p in pins().items()})
    if env.get('GITHUB_ACTIONS') != 'true':
        need(not any(k.startswith('GITHUB_') for k in env) and live == expected, 'R45_LOCAL_CONTEXT')
        return 'LOCAL_EXACT_CHECKOUT_NOT_HOSTED_CI'
    need(env.get('GITHUB_EVENT_NAME') == 'pull_request' and env.get('GITHUB_REPOSITORY') == 'TasfiqJ/onSkin' and
         type(event) is dict and event.get('repository', {}).get('full_name') == 'TasfiqJ/onSkin', 'R45_CI_KIND')
    number = event.get('number')
    need(type(number) is int and number > 45 and env.get('GITHUB_REF') == 'refs/pull/'+str(number)+'/merge', 'R45_CI_EVENT')
    for pr in (event.get('pull_request'), live_pr):
        original44().original41().pr_guard(pr, number, head, BRANCH, BASE, PARENT_BRANCH)
    need(re.fullmatch('[0-9a-f]{40}', env.get('GITHUB_SHA', '')) and
         merge == [env['GITHUB_SHA'], BASE, head] and merge_tree == tree and
         live_pr.get('merge_commit_sha') == env['GITHUB_SHA'], 'R45_SERVICE_TEST_MERGE')
    need(live == dict(expected, source=head), 'R45_STALE_REFS')
    return 'GENUINE_EVENT_LIVE_PR_REFS_SERVICE_TEST_MERGE'


def live_refs(include_source=False):
    names = {'refs/heads/main': 'main', **{'refs/heads/'+p[2]: 'pr'+str(n) for n, p in pins().items()}}
    if include_source:
        names['refs/heads/'+BRANCH] = 'source'
    values = {}
    for line in text('ls-remote', '--exit-code', 'origin', *names).splitlines():
        sha, name = line.split()
        need(name in names and names[name] not in values and re.fullmatch('[0-9a-f]{40}', sha), 'R45_LIVE_REFS')
        values[names[name]] = sha
    need(set(values) == set(names.values()), 'R45_LIVE_REFS')
    return values


def run_readonly(args, expected=0, timeout=900):
    result = subprocess.run(args, cwd=ROOT, capture_output=True, timeout=timeout)
    need(result.returncode == expected, 'R45_READONLY_CHILD_EXIT')
    return result.stdout


def verify(phase='SOURCE_FROZEN'):
    need(not sys.flags.optimize and phase in PHASES, 'R45_PHASE')
    primitives().helpers().full29_store()
    need(text('remote', 'get-url', 'origin').removesuffix('.git') == 'https://github.com/TasfiqJ/onSkin', 'R45_ORIGIN')
    authenticate_parent()
    head, tree = text('rev-parse', 'HEAD'), text('rev-parse', 'HEAD^{tree}')
    need(len(parents(head)) == 2 and text('merge-base', BASE, head) == BASE, 'R45_SOURCE_HEAD')
    in_ci = os.environ.get('GITHUB_ACTIONS') == 'true'
    need(phase == 'SOURCE_FROZEN' if in_ci else text('symbolic-ref', '--short', 'HEAD') == BRANCH, 'R45_BRANCH_OR_CI_SEAL')
    commits = text('rev-list', '--reverse', BASE+'..'+head).splitlines()
    need(len(commits) >= 2 and commits[0] == PLAN_COMMIT, 'R45_SOURCE_HISTORY')
    substantive = commits[-1] if phase == 'SOURCE_PENDING' else commits[-2]
    paths = task_guard(document(git('show', substantive+':'+TASK)), lambda path: git('show', substantive+':'+path))
    source, seal = phase_guard(commits, phase, paths)
    need(git('show', head+':'+PLAN) == git('show', PLAN_COMMIT+':'+PLAN), 'R45_PLAN_IMMUTABLE')
    quality_guard(git('show', source+':.github/workflows/quality.yml'), git('show', BASE+':.github/workflows/quality.yml'))
    if seal:
        value = document(git('show', seal+':docs/phase-4/generated/source-worklist.json'))
        primitives().worklist_guard(value, source)
        need(value.get('warnings') == [] and value.get('summary', {}).get('warningCount') == 0 and
             value.get('summary', {}).get('blockerCount') == 0, 'R45_WORKLIST_WARNINGS')
        markdown = git('show', seal+':docs/phase-4/generated/source-worklist.md')
        need(('Git SHA: '+source).encode() in markdown and b'Git status: clean' in markdown, 'R45_WORKLIST_MARKDOWN')
        run_readonly(['node', 'scripts/phase4/build-source-worklist.mjs', '--strict', '--check'])
    before = snapshot(head)
    projection = scope(paths)
    run_readonly(['node', 'scripts/launch/validate-execution-baseline.mjs'])
    run_readonly(['node', 'scripts/launch/execution-baseline-smoke.mjs'])
    old = original44()
    for number, (phead, ptree, branch) in pins().items():
        prior = pins()[number-1] if number > 35 else (MAIN, '', 'main')
        need(text('rev-parse', phead+'^{tree}') == ptree and text('merge-base', prior[0], phead) == prior[0], 'R45_PIN_ANCESTRY')
        old.original41().pr_guard(old.fetch_pr(number), number, phead, branch, prior[0], prior[2])
    live = live_refs(in_ci)
    event, merge, merge_tree, live_pr = {}, [], None, None
    if in_ci:
        path = Path(os.environ.get('GITHUB_EVENT_PATH', ''))
        need(path.is_absolute(), 'R45_EVENT_PATH')
        event = document(regular(path))
        number = event.get('number')
        need(type(number) is int and number > 45, 'R45_CI_EVENT')
        live_pr = old.fetch_pr(number)
        sha, ref = os.environ.get('GITHUB_SHA', ''), os.environ.get('GITHUB_REF', '')
        old.original41().service_merge_ref_guard(git('ls-remote', '--exit-code', 'origin', ref), ref, sha)
        merge, merge_tree = parents(sha), text('rev-parse', sha+'^{tree}')
    qualification = ci_guard(os.environ, event, head, tree, merge, merge_tree, live, live_pr)
    need(snapshot(head) == before and text('rev-parse', 'HEAD') == head and live_refs(in_ci) == live, 'R45_FINAL_SNAPSHOT')
    return dict(valid=True, phase=phase, head=head, tree=tree, sourceHead=source, sealedHead=seal,
                parentHead=BASE, parentTree=BASE_TREE, changedSourcePaths=sorted(paths),
                trackedBlobsHashed=before[1], qualification=qualification, governance='CURRENT45_FINITE_SOURCE_ONLY',
                productScope=projection, historicalCheck='SEPARATE_FRESH_PR45_ORIGINAL44_41_TO_29_REQUIRED',
                acceptanceGranted=False, admissions=dict.fromkeys(ADMISSIONS, False), release='NO_GO')


def historical_commands(workspace, node, npm, python):
    root = workspace/'pr45'
    return [
        ('clone-pr45', ['git', 'clone', '--no-local', '--no-hardlinks', '--no-checkout', '--branch', PARENT_BRANCH,
         '-c', 'core.autocrlf=false', '-c', 'core.longpaths=true', 'https://github.com/TasfiqJ/onSkin.git', str(root)], 0),
        ('checkout-named44', ['git', 'checkout', PARENT_BRANCH], 0),
        ('node-version', [node, '--version'], 0),
        ('npm-version', [node, npm, '--version'], 0),
        ('normal-npm-ci', [node, npm, 'ci', '--ignore-scripts=false', '--no-audit', '--no-fund'], 0),
        ('postinstall-check', [node, 'scripts/postinstall.mjs', '--check'], 0),
        ('original44-main_integration44.test.py', [python, '-I', '-B', PREFIX+'main_integration44.test.py'], 0),
        ('original44-source_consumer44.test.py', [python, '-I', '-B', PREFIX+'source_consumer44.test.py'], 0),
        ('original44-source-regressions', [node, str(root/'node_modules/vitest/vitest.mjs'), 'run',
         '--root', str(root/'apps/mobile'), '--passWithNoTests=false', '--reporter=verbose',
         'src/lib/storage/privateKVSourceFence44.test.ts',
         'src/features/settings/localPrivateDataFence44.test.ts',
         'src/features/routine/planSourceFence44.test.ts'], 0),
        ('original44-exact-source', [python, '-I', '-B', PREFIX+'main_integration44.py'], 0),
        ('original44-fullapp-scope', [python, '-I', '-B', PREFIX+'main_integration44.py', '--scope', 'full-app-j01-v2'], 0),
        ('original44-external-readiness-refusal', [python, '-I', '-B', PREFIX+'main_integration44.py',
         '--scope', 'full-app-j01-v2', '--external-readiness'], 2),
        ('original44-authentic-historical', [python, '-I', '-B', PREFIX+'main_integration44.py', '--historical'], 0),
    ]


def validate_receipts(value, workspace, commands):
    receipts = value.get('receipts')
    need(type(receipts) is list and all(type(r) is dict for r in receipts) and
         [r.get('name') for r in receipts] == [r[0] for r in commands],
         'R45_HISTORICAL_INTERVAL')
    logs = {}
    for row, (name, command, expected) in zip(receipts, commands):
        need(type(row.get('exit')) is int and type(row.get('expectedExit')) is int and
             row['exit'] == row['expectedExit'] == expected and row.get('timedOut') is False and
             row.get('historicalHead') == BASE and row.get('historicalTree') == BASE_TREE and
             row.get('command') == command, 'R45_HISTORICAL_CHILD')
        path = workspace/'logs'/(name+'.log')
        need(row.get('log') == str(path) and type(row.get('bytes')) is int, 'R45_HISTORICAL_LOG_PATH')
        raw = regular(path, 8*1024*1024)
        need(len(raw) == row['bytes'] and digest(raw) == row.get('sha256'), 'R45_HISTORICAL_LOG_HASH')
        logs[name] = raw
    return logs


def historical_result(raw):
    lines = [line for line in raw.replace(b'\r', b'').splitlines() if line]
    need(len(lines) == 2 and lines[0].startswith(b'R45_HISTORICAL_WORKSPACE '), 'R45_HISTORICAL_TRANSCRIPT')
    value = document(lines[-1])
    no_admission(value, 'R45_HISTORICAL_NO_ADMISSION')
    need(value.get('status') == 'PASS' and value.get('historicalHead') == BASE and value.get('historicalTree') == BASE_TREE and
         value.get('qualification') == 'FRESH_AUTHENTIC_PR45_44_41_TO_29_NOT_CURRENT_OR_OWNER_ACCEPTANCE', 'R45_HISTORICAL_PIN')
    workspace = Path(value.get('workspace', ''))
    need(workspace.is_absolute() and lines[0] == ('R45_HISTORICAL_WORKSPACE '+str(workspace)).encode(), 'R45_HISTORICAL_WORKSPACE')
    rows = value.get('receipts')
    need(type(rows) is list and len(rows) == 13, 'R45_HISTORICAL_INTERVAL')
    by_name = {r.get('name'): r for r in rows}
    node = by_name.get('node-version', {}).get('command', [None])[0]
    npm_command = by_name.get('normal-npm-ci', {}).get('command', [])
    need(type(node) is str and Path(node).is_absolute() and len(npm_command) == 6 and
         type(npm_command[1]) is str and Path(npm_command[1]).is_absolute() and
         Path(npm_command[1]).name == 'npm-cli.js', 'R45_HISTORICAL_TOOLS')
    python = original44().original41().historical_python()
    logs = validate_receipts(value, workspace, historical_commands(workspace, node, npm_command[1], python))
    need(logs['node-version'].strip() == b'v22.21.0' and logs['npm-version'].strip() == b'11.20.0', 'R45_RUNTIME')
    for name, count in (('original44-main_integration44.test.py', 22), ('original44-source_consumer44.test.py', 13)):
        need(re.search(('Ran '+str(count)+' tests? in ').encode(), logs[name]) is not None and
             logs[name].strip().endswith(b'OK'), 'R45_HISTORICAL_CONTROLS')
    source_log = re.sub(rb'\x1b\[[0-9;]*m', b'', logs['original44-source-regressions'])
    need(re.search(rb'Test Files\s+3 passed\s+\(3\)', source_log) is not None and
         re.search(rb'Tests\s+94 passed\s+\(94\)', source_log) is not None, 'R45_ORIGINAL44_REGRESSION_INTERVAL')
    for name, field in (('original44-exact-source', 'original44'), ('original44-fullapp-scope', 'original44Scope')):
        need(document(logs[name]) == value.get(field), 'R45_ACTUAL_TRANSCRIPT')
    need(original44().historical_result(logs['original44-authentic-historical']) == value.get('original44Historical'),
         'R45_NESTED_ACTUAL_TRANSCRIPT')
    verdict = value.get('original44', {})
    need(verdict.get('valid') is True and verdict.get('head') == BASE and verdict.get('tree') == BASE_TREE and
         verdict.get('governance') == 'CURRENT44_FINITE_SOURCE_ONLY' and
         verdict.get('qualification') == 'LOCAL_EXACT_CHECKOUT_NOT_HOSTED_CI', 'R45_ORIGINAL44_VERDICT')
    no_admission(verdict, 'R45_ORIGINAL44_NO_ADMISSION')
    return value


def historical():
    """Original44 CURRENT checks run only in a fresh exact named PR45 checkout."""
    authenticate_parent()
    start = text('rev-parse', 'HEAD')
    env = primitives().clean_environment()
    python = original44().original41().historical_python()
    workspace = Path(tempfile.mkdtemp(prefix='integration45-')).resolve()
    need(not workspace.is_relative_to(ROOT), 'R45_EXTERNAL_CLONE')
    root, logs = workspace/'pr45', workspace/'logs'
    logs.mkdir()
    env.update(TEMP=str(workspace.parent), TMP=str(workspace.parent), TMPDIR=str(workspace.parent))
    print('R45_HISTORICAL_WORKSPACE '+str(workspace), file=sys.stderr, flush=True)
    node = Path(shutil.which('node')).resolve()
    candidates = [node.parent/'node_modules/npm/bin/npm-cli.js'] if os.name == 'nt' else [node.parent.parent/'lib/node_modules/npm/bin/npm-cli.js']
    if env.get('APPDATA'):
        candidates.insert(0, Path(env['APPDATA'])/'npm/node_modules/npm/bin/npm-cli.js')
    npm = next((p for p in candidates if p.is_file() and
               subprocess.check_output([str(node), str(p), '--version'], env=env).strip() == b'11.20.0'), None)
    need(npm is not None, 'R45_RUNTIME')
    config = workspace/'empty.npmrc'
    config.write_bytes(b'')
    env.update(npm_config_userconfig=os.devnull, npm_config_globalconfig=str(config))
    commands = historical_commands(workspace, str(node), str(npm), python)
    receipts, output = [], {}
    def pinned(*args):
        return subprocess.check_output(['git', '--no-replace-objects', *args], cwd=root, env=env).decode().strip()
    for name, args, expected in commands:
        if name == 'node-version':
            need(pinned('rev-parse', 'HEAD') == BASE and pinned('rev-parse', 'HEAD^{tree}') == BASE_TREE and
                 pinned('rev-parse', '--is-shallow-repository') == 'false', 'R45_HISTORICAL_PIN')
            for program, sha in PROGRAMS.items():
                need(digest(regular(root/PREFIX/program)) == sha, 'R45_HISTORICAL_PROGRAM')
        path = logs/(name+'.log')
        started, timed_out = time.monotonic(), False
        with path.open('wb') as stream:
            process = subprocess.Popen(args, cwd=workspace if name == 'clone-pr45' else root,
                                       env=env, stdout=stream, stderr=subprocess.STDOUT)
            try:
                process.wait(timeout=21600 if name == 'original44-authentic-historical' else 1800)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
                timed_out = True
        raw = path.read_bytes()
        receipts.append(dict(name=name, command=args, exit=process.returncode, expectedExit=expected,
                             seconds=round(time.monotonic()-started, 3), timedOut=timed_out, bytes=len(raw),
                             sha256=digest(raw), log=str(path), historicalHead=BASE, historicalTree=BASE_TREE))
        (logs/'receipts.json').write_bytes((json.dumps(receipts, indent=2)+'\n').encode())
        need(not timed_out and len(raw) <= 8*1024*1024, 'R45_HISTORICAL_TIMEOUT_OR_OUTPUT')
        need(process.returncode == expected, 'R45_HISTORICAL_CHILD_EXIT')
        output[name] = raw
    need(pinned('status', '--porcelain=v1', '--untracked-files=all') == '' and pinned('rev-parse', 'HEAD') == BASE and
         text('rev-parse', 'HEAD') == start, 'R45_HISTORICAL_CHANGED')
    result = dict(status='PASS', historicalHead=BASE, historicalTree=BASE_TREE,
                  original44=document(output['original44-exact-source']),
                  original44Scope=document(output['original44-fullapp-scope']),
                  original44Historical=original44().historical_result(output['original44-authentic-historical']),
                  receipts=receipts, workspace=str(workspace),
                  qualification='FRESH_AUTHENTIC_PR45_44_41_TO_29_NOT_CURRENT_OR_OWNER_ACCEPTANCE',
                  acceptanceGranted=False, admissions=dict.fromkeys(ADMISSIONS, False), release='NO_GO')
    return historical_result(('R45_HISTORICAL_WORKSPACE '+str(workspace)+'\n'+json.dumps(result)).encode())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase', choices=PHASES, default='SOURCE_FROZEN')
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--historical', action='store_true')
    group.add_argument('--scope', choices=['full-app-j01-v2'])
    parser.add_argument('--external-readiness', action='store_true')
    args = parser.parse_args()
    try:
        need(not args.external_readiness or args.scope is not None, 'R45_EXPLICIT_SCOPE_REQUIRED')
        result = historical() if args.historical else verify(args.phase)
        if args.scope:
            result = dict(result['productScope'], head=result['head'], tree=result['tree'], phase=args.phase,
                          sourceQualification=result['qualification'])
        print(json.dumps(result, sort_keys=True))
        return 2 if args.external_readiness else 0
    except Exception as exc:
        reason = str(exc)
        if not re.fullmatch(r'(?:R45|R44|R41|R40|R39|R38|R37|R36|R35|R34|R33|R32|R29|R23)_[A-Z0-9_]{1,96}', reason):
            reason = 'R45_EXECUTION_INCOMPLETE'
        print(json.dumps(dict(valid=False, error=reason, acceptanceGranted=False, release='NO_GO')))
        return 1


# Exact pinned PR45 preimages, not a regenerated source grant.
BASELINES = {
    '.github/workflows/quality.yml': ('100644', '89d7289ef9d7097757f591ed81cd8a2834c7e329', '0ea1bbe82006df100ec489d49c575fd61ee5cb9858772584419a5c2933675ec5', 16985),
    'PROGRESS.md': ('100644', '23128e6c6e274bfbac8c46791ec4465db8055f9e', '9aafe432348ab16bf7a308cb42f5e2e7943ef80c9b5045db49a4adf49f4e46db', 560656),
    'apps/mobile/src/app/routine/plan.tsx': ('100644', '8a3b7940d537b5e5fc1bad9775868f438118e82c', 'b6f6b40fedeac6581fb6be601e5a5220c5e7c25c558f720939001dc4540b2a17', 22885),
    'apps/mobile/src/features/routine/PlanHistoryPanel45.test.tsx': (None, None, None, None),
    'apps/mobile/src/features/routine/PlanHistoryPanel45.tsx': (None, None, None, None),
    'apps/mobile/src/features/routine/PlanSourceNotice.tsx': ('100644', '61241472a901ab89ca201ad015a4c183bc4d22f4', '5db80afc3ac7aaee9dfa25a3132934b7645283187582af98239ca7c9d3b05bca', 3012),
    'apps/mobile/src/features/routine/orderRoutes.test.ts': ('100644', 'aa239f92b54cd4564ca2b7148da3ed36675ebf5f', '8f6c171d5b738a3eb77afd9ea8aac49a4cff30b419bf14fec17f624b9bbe640e', 4017),
    'apps/mobile/src/features/routine/orderStore.test.ts': ('100644', '1bc7117a9a4f2abb9f71c9cf2df5ad696487eedf', 'bf9de584a71261637865333b6fb6fee3b8953bbd98f64d8711ffbc11a8906189', 17192),
    'apps/mobile/src/features/routine/orderStore.ts': ('100644', '3c856051f03ee1dcbb2dc3e9276298885f2a34b6', '3b08983c188287434cda96444cfed91d23c3d653952aec2cbf1a2ab92f0d656d', 10854),
    'apps/mobile/src/features/routine/planHistory45.test.ts': (None, None, None, None),
    'apps/mobile/src/features/routine/planHistory45.ts': (None, None, None, None),
    'apps/mobile/src/features/routine/planHistory45Encrypted.test.ts': (None, None, None, None),
    'apps/mobile/src/features/routine/planRecovery.test.ts': ('100644', '372a6bc6ffb6f39c4210e06743186d76ea5ab53a', 'c1c478d6b840ad3296b1e9088c467d89b73480d128c638919a3a52f093cd9be9', 40742),
    'apps/mobile/src/features/routine/planSourceFence44.test.ts': ('100644', '21f66420502e8f2e6bbb08356e91825ec3637d37', '1ec61b14e6d73cbc66223e996e12fd010108b692e0607cfa82c87a6dbe159659', 17677),
    'apps/mobile/src/features/routine/planSourceFence44.ts': ('100644', '47c8303c992acf9257d8aaccb69b5a31465a1f28', 'bf839dc99f068da5a18ded6c14bc2e283e02302eee368122fc2e2a560fe477cd', 7095),
    'apps/mobile/src/features/routine/usePlan.test.ts': ('100644', 'b580433de4b9b0084f0423d0fe49e7e21044ba58', '145de2acd477a3bf601dedefbd57c2490ff024de472c2389a434b6f8e72670ec', 3208),
    'apps/mobile/src/features/routine/usePlan.ts': ('100644', '25d0800674375259218ba5e192553e1e99fe19f6', 'd10920c965d1355c02f00f37483d3ebd8075e30ddef483866d9e193de8f0d236', 15396),
    'apps/mobile/src/features/settings/localDeviceExport.test.ts': ('100644', 'a5001706f0de5475c8e3706058a658e9af561d41', '8b629d87112f2114cda65af72ad6577545b3bc6b1b4a8301e55e8b976b41e220', 18614),
    'apps/mobile/src/features/settings/localDeviceExport.ts': ('100644', 'e943fce406182e52d71d9c08bf544cffbdc6591f', '855a31247f8c3f70920f1ee349f49691f53de2d0a6e0ad99e468e3241dd9ebbd', 13874),
    'apps/mobile/src/features/settings/localPrivateData.test.ts': ('100644', '316da455bd655b52a9630d38221c9813fb28a036', '32c17ed335d912a04942de3e8ee8e27a9f71ad4c9c2501f072f662a4a081cd3d', 13878),
    'apps/mobile/src/features/settings/localPrivateData.ts': ('100644', '3731c25e53fc65803b82e8a00de2224dd4dd48b7', '82b7e2ce6f315e9e14cff5f3bc6f8f7ef2162c3e3635040bd8ace37daf9715be', 8004),
    'apps/mobile/src/features/settings/localPrivateDataFence44.test.ts': ('100644', '32c4da2080b47a0b24f1a08f3d0bbaecec2c0477', 'e3dca2caf2df468ab9202e49b3498e1e050b8ff4ad3e40bd113609c4da66de52', 47609),
    'apps/mobile/src/features/settings/localPrivateDataKeys.test.ts': ('100644', '2f3d888363b7d41049962264e1e95247670118f6', '70f5b7d115042e6d6c95eac621e7058289de1f86fa10ee91b24844a078291acc', 5000),
    'apps/mobile/src/features/settings/localPrivateDataKeys.ts': ('100644', 'f03947ce35824b7555559a1263e6f5e536af9228', '655b37913289061b639d37514c14fad6d2f91e2b897c2e575e9c2fd20b869717', 4536),
    'apps/mobile/src/features/settings/mobileDataExportWriter.ts': ('100644', 'cf8a609c1a6653b08f17d09b6e25f11f0956dab1', '59fb2caca02885131d4f8652252da15f2a741c4af0b71e47f35be9395f99ad94', 2543),
    'apps/mobile/src/lib/consent/healthDataWriteAdmission.test.ts': ('100644', '5285bb32987582d330d46cc07aa4a0e488b8347a', 'f46c362e5be316aec7477354006d1d8f0ca8c0ed6313a32a42d5436eb5e5d3e4', 6607),
    'apps/mobile/src/lib/consent/healthDataWriteAdmission.ts': ('100644', '8a2b5a8bb65a6182db0d8dae928fd7abc11c0ea9', '8896b82049d3fd11c6311f43674b7a0aad463ccf146624d40b7d9b4a2aaff3ee', 6075),
    'apps/mobile/src/lib/consent/withdrawal.test.ts': ('100644', '5d7a09568fbbdb54c48e68e4cdecb02e2c1311e8', '55313acd71925fb94df433c553ff056c3bfb7836575c5b069e5dc7029274fa16', 13620),
    'apps/mobile/src/lib/consent/withdrawal.ts': ('100644', 'c3a61581b959315986291c751fe5c116a88d0a51', '31ed34e8ea092d1aa265714b633158a95cb1682c19f03c89123bebe087ec4688', 10781),
    'apps/mobile/src/lib/storage/privateKV.ts': ('100644', '4228a7eba321728f21890d4c7abd8434b49c3dce', '0c8fa288274a91e022a09c694e6584ede48164189e6e7efd14db4ac9e9aaedac', 37947),
    'apps/mobile/src/lib/storage/privateKVSourceFence44.test.ts': ('100644', '1da9a9df5a393e3856062a2cfe52c430a4ae6e0d', 'b6d68f5bf5cb97edf1dc94031d6ace694e1d9f42c12ac040a651e66bffad82ef', 13628),
    'docs/brain/task-specs/M1X-45/SCOPE_PLAN.md': (None, None, None, None),
    'docs/brain/task-specs/M1X-45/TASK.md': (None, None, None, None),
    'docs/phase-4/generated/source-worklist.json': ('100644', 'd952b949201f6629522eab213f1fa7b86c4b0974', '898cbdcf6c07b4164a874c3e606f1e5db27f036b0e11f4d4a5c1f9d9989b111c', 142034),
    'docs/phase-4/generated/source-worklist.md': ('100644', '5c21e65a684a60dc9f17c618f7ee5810f2fd3079', '88c314ac14631ea405b95e7895199e1c35377d3f079223a185a3d234dedf7d11', 84773),
    'docs/release/full-app-j01/owner-plan-history45.md': (None, None, None, None),
    'scripts/release/full-app-j01/main_integration45.py': (None, None, None, None),
    'scripts/release/full-app-j01/main_integration45.test.py': (None, None, None, None),
    'scripts/release/full-app-j01/source_consumer45.test.py': (None, None, None, None),
}


if __name__ == '__main__':
    sys.exit(main())
