"""Campaign44 source/reset fence integrity. Source proof never grants release admission."""
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
BASE = '302e2b83216e7d100e7da3b3f579ee33db8dc5af'
BASE_TREE = '075ee95de6e23282bdaf40890bf7bc5ed8aa7c18'
MAIN = '53a84d921d14dbff1d2e9b8f1b3bb27e10dcede6'
BRANCH = 'stage/m1-plan-source-reset-fence44'
PARENT_BRANCH = 'stage/m1-today-optional-changes41'
PLAN_COMMIT = '5387a7a2b3b0c5d5f7f04191b74bdaf474d40ab8'
PLAN_SHA = '98dd888990ab34c8da5afd0cb4e21fe44ea34919c141f40a375d5b3989dc3e54'
PLAN = 'docs/brain/task-specs/M1X-44/SCOPE_PLAN.md'
TASK = 'docs/brain/task-specs/M1X-44/TASK.md'
PREFIX = 'scripts/release/full-app-j01/'
DOCS = 'docs/release/full-app-j01/'
AUTHORITY = 'BRAIN-M1X-PLAN-SOURCE-RESET-FENCE44-SOURCE-CANDIDATE-01'
PHASES = ('SOURCE_PENDING', 'SOURCE_FROZEN')
WORKLIST = {'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md'}
DIAGNOSTIC_HEAD = '80b43a41273b6502bb5f1be816d2074d17fddda9'
DIAGNOSTIC_TREE = '732db26df18cbfb0c27459243c15499906499d8f'
DIAGNOSTIC_TASK_SHA = 'b5c0923da61785c7b09367e88ca052dd1441a62f03cb8028c5b9300f349f8ec3'
DIAGNOSTIC_RED_TEST = 'apps/mobile/src/features/settings/localPrivateDataFence44.test.ts'
DIAGNOSTIC_RED_SHA = '1b8a4d597844cadc8398a7150d833285bec38b3a78a7546855c66a85c2eac8ff'
ADDITIONAL_PATHS = (
    'apps/mobile/src/lib/auth/localAccountIsolation.ts',
    'apps/mobile/src/lib/auth/sessionOwner.ts',
    'apps/mobile/src/lib/auth/sessionOwner.test.ts',
)
LIFETIME_PATHS = (
    'apps/mobile/src/lib/auth/accountGeneration.ts',
    'apps/mobile/src/lib/auth/accountGeneration.test.ts',
    'apps/mobile/src/features/photos/encryptedStorage.ts',
    'apps/mobile/src/features/photos/encryptedStorage.test.ts',
)
EXTENDED_PATHS = ADDITIONAL_PATHS+LIFETIME_PATHS
USER_EXTENSION_TEXT_SHA = 'bd01fe2bf501dfa73ee1d8de6fc9ff014f08fc56e664c277bbdad0f18de5b02a'
EXTENSION_PROVENANCE_SHA = '47ae153955bbeccc552ae8238c389f631048887bc68b802282ab968c5b3d4ef3'
# Explicit user scope extension, not an invented Brain issuance or admission.
EXTENSION_PROVENANCE = {
    'acceptanceGranted': False,
    'grantedPaths': list(ADDITIONAL_PATHS),
    'originalPlanCommit': PLAN_COMMIT,
    'release': 'NO_GO',
    'resumesHead': DIAGNOSTIC_HEAD,
    'userText': 'i grant it\ndo it for me',
}
LIFETIME_PROVENANCE_SHA = 'c384f762ed367ac90eddde4f6e4f18f4592904f0a33a38c0d24e1c481b6556ab'
USER_LIFETIME_TEXT_SHA = 'e9917d29e7aeef91b4652fc524e1a3d256b5a0accf336b786b61be203d6167bc'
LIFETIME_PROVENANCE = {
    'acceptanceGranted': False,
    'grantedPaths': list(LIFETIME_PATHS),
    'originalPlanCommit': PLAN_COMMIT,
    'previousScopeExtensionSha256': EXTENSION_PROVENANCE_SHA,
    'release': 'NO_GO',
    'resumesHead': DIAGNOSTIC_HEAD,
    'userText': 'Authorize these four paths',
}
GRANT = {
    PLAN, TASK, 'PROGRESS.md', '.github/workflows/quality.yml', *WORKLIST,
    'apps/mobile/src/lib/storage/privateKV.ts',
    'apps/mobile/src/lib/storage/privateKV.test.ts',
    'apps/mobile/src/lib/storage/privateKVSourceFence44.test.ts',
    'apps/mobile/src/features/settings/localPrivateData.ts',
    'apps/mobile/src/features/settings/localPrivateData.test.ts',
    'apps/mobile/src/features/settings/localPrivateDataFence44.test.ts',
    'apps/mobile/src/app/index.tsx',
    'apps/mobile/src/features/settings/settingsRoutes.test.ts',
    'apps/mobile/src/lib/auth/devLocalResetCoordinator.ts',
    'apps/mobile/src/lib/auth/devLocalResetCoordinator.test.ts',
    'apps/mobile/src/features/routine/planSourceFence44.ts',
    'apps/mobile/src/features/routine/planSourceFence44.test.ts',
    'apps/mobile/src/features/routine/orderStore.ts',
    'apps/mobile/src/features/routine/orderStore.test.ts',
    'apps/mobile/src/features/routine/usePlan.ts',
    'apps/mobile/src/features/routine/usePlan.test.ts',
    'apps/mobile/src/features/shelf/store.ts',
    'apps/mobile/src/features/shelf/store.test.ts',
    'apps/mobile/src/features/onboarding/skinProfileStore.ts',
    'apps/mobile/src/features/onboarding/skinProfileStore.test.ts',
    'apps/mobile/src/features/intelligence/overrides.ts',
    'apps/mobile/src/features/intelligence/overrides.test.ts',
    'apps/mobile/src/features/onboarding/healthConsentStore.ts',
    'apps/mobile/src/features/onboarding/healthConsentStore.test.ts',
    'apps/mobile/src/features/routine/planRecovery.test.ts',
    'apps/mobile/src/lib/auth/localAccountIsolation.test.ts',
    DOCS+'plan-source-reset-fence44.md', PREFIX+'main_integration44.py',
    PREFIX+'main_integration44.test.py', PREFIX+'source_consumer44.test.py',
}
ORIGINAL_GRANT = set(GRANT)
GRANT.update(EXTENDED_PATHS)
SOURCE = GRANT - WORKLIST - {PLAN}
ESSENTIAL = {
    TASK, 'PROGRESS.md', '.github/workflows/quality.yml',
    'apps/mobile/src/lib/storage/privateKV.ts',
    'apps/mobile/src/lib/storage/privateKVSourceFence44.test.ts',
    'apps/mobile/src/features/settings/localPrivateData.ts',
    'apps/mobile/src/features/settings/localPrivateDataFence44.test.ts',
    'apps/mobile/src/features/routine/planSourceFence44.ts',
    'apps/mobile/src/features/routine/planSourceFence44.test.ts',
    DOCS+'plan-source-reset-fence44.md', PREFIX+'main_integration44.py',
    PREFIX+'main_integration44.test.py', PREFIX+'source_consumer44.test.py',
}
ESSENTIAL.update(EXTENDED_PATHS)
PROGRAMS = {
    'main_integration32.py': '5b48f78917aaf39e4da66138e3d5c52654af7defd1eaf37ab6404fdc631ceda4',
    'check.py': '944c04283b834e5f20bdfcbf95c265c7af57f8f4754952b4353dee5f8d8952dd',
    'main_integration41.py': '6a25a99782978c1cfd88db959069fc7f28e7b8aa679e4a3349884ad68dc5e0f7',
    'main_integration41.test.py': 'daffe64aeb80a35cbcad80555f701fb1a6f08624d923ba1d04ead63c40aa4365',
    'source_consumer41.test.py': '6f2ed41f5f3c42512a02dd4ca3066d70a99978b78edbc07cf7cab5a527932a61',
}
ADMISSIONS = ['DB06', 'DB08', 'R2B', 'M103', 'M2', 'NATIVE', 'J01', 'CLINICAL',
              'PROVIDER', 'PAID', 'APPLE', 'PUBLIC', 'G97']
H = None
O41 = None


def need(value, code):
    if not value:
        raise ValueError(code)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def regular(path, limit=2*1024*1024):
    for parent in path.parents:
        info = parent.lstat()
        need(stat.S_ISDIR(info.st_mode) and not parent.is_symlink() and
             not getattr(info, 'st_file_attributes', 0) & 1024, 'R44_REGULAR_PARENT')
    before = path.lstat()
    need(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and not path.is_symlink() and
         not getattr(before, 'st_file_attributes', 0) & 1024 and before.st_size <= limit,
         'R44_REGULAR_FILE')
    raw = path.read_bytes()
    after = path.lstat()
    need((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns) ==
         (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns), 'R44_CHANGED_READ')
    return raw


def authenticated_program(name, identity):
    path = ROOT/PREFIX/name
    raw = regular(path)
    need(digest(raw) == identity, 'R44_ORIGINAL_PROGRAM')
    namespace = {'__name__': 'authenticated_neutral_definitions_not_current_source_acceptance',
                 '__file__': str(path)}
    exec(compile(raw, str(path), 'exec'), namespace)
    return SimpleNamespace(**namespace)


def primitives():
    """Only neutral Git/JSON/raw readers, never original32 current verification."""
    global H
    for name in ('main_integration32.py', 'check.py'):
        need(digest(regular(ROOT/PREFIX/name)) == PROGRAMS[name], 'R44_NEUTRAL_PREIMAGE')
    if H is None:
        H = authenticated_program('main_integration32.py', PROGRAMS['main_integration32.py'])
    return H


def original41():
    """Authenticated pure guards and nested transcript parser; never current verify()."""
    global O41
    need(digest(regular(ROOT/PREFIX/'main_integration41.py')) == PROGRAMS['main_integration41.py'],
         'R44_ORIGINAL41_IDENTITY')
    if O41 is None:
        O41 = authenticated_program('main_integration41.py', PROGRAMS['main_integration41.py'])
    return O41


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


def phase_guard(commits, phase, source_paths=None):
    allowed = SOURCE if source_paths is None else set(source_paths)
    need(allowed <= SOURCE and phase in PHASES and 2 <= len(commits) <= 32 and
         len(set(commits)) == len(commits) and commits[0] == PLAN_COMMIT, 'R44_HISTORY_PHASES')
    source_commits = commits[1:] if phase == 'SOURCE_PENDING' else commits[1:-1]
    need(source_commits, 'R44_SOURCE_REQUIRED')
    previous, union = PLAN_COMMIT, set()
    for current in source_commits:
        need(parents(current) == [current, previous], 'R44_LINEAR_HISTORY')
        paths = changed(previous, current, allowed)
        need(paths, 'R44_EMPTY_SOURCE')
        union.update(paths)
        previous = current
    need(union == allowed and changed(BASE, previous, allowed|{PLAN}) == allowed|{PLAN}, 'R44_EXACT_SOURCE')
    seal = None
    if phase == 'SOURCE_FROZEN':
        seal = commits[-1]
        need(parents(seal) == [seal, previous] and changed(previous, seal, WORKLIST) == WORKLIST,
             'R44_SOLE_FINAL_SEAL')
    return previous, seal


def scope_extension_guard(value):
    need(type(value) is dict and value == EXTENSION_PROVENANCE, 'R44_USER_SCOPE_EXTENSION')
    canonical = (json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)+'\n').encode()
    need(digest(canonical) == EXTENSION_PROVENANCE_SHA and
         digest(value['userText'].encode()) == USER_EXTENSION_TEXT_SHA and
         len(ORIGINAL_GRANT) == 36 and len(GRANT) == 43 and
         GRANT-ORIGINAL_GRANT == set(EXTENDED_PATHS), 'R44_USER_EXTENSION_PROVENANCE')


def lifetime_extension_guard(value):
    need(type(value) is dict and value == LIFETIME_PROVENANCE, 'R44_USER_LIFETIME_EXTENSION')
    canonical = (json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)+'\n').encode()
    need(digest(canonical) == LIFETIME_PROVENANCE_SHA and
         digest(value['userText'].encode()) == USER_LIFETIME_TEXT_SHA and
         value['previousScopeExtensionSha256'] == EXTENSION_PROVENANCE_SHA,
         'R44_USER_LIFETIME_PROVENANCE')


def task_guard(value, read_body):
    need(type(value) is dict and set(value) == {'schema', 'authority', 'base', 'baseTree', 'planCommit',
         'sourceHashes', 'commands', 'acceptanceGranted', 'admissions', 'release', 'qualification',
         'scopeExtension', 'scopeExtension2'}, 'R44_TASK_SCHEMA')
    need(type(value['schema']) is int and value['schema'] == 1 and value['authority'] == AUTHORITY and
         value['base'] == BASE and value['baseTree'] == BASE_TREE and value['planCommit'] == PLAN_COMMIT and
         value['qualification'] == 'SOURCE_INTEGRITY_NOT_QUALIFIED_ACCEPTANCE', 'R44_TASK_AUTHORITY')
    no_admission(value, 'R44_NO_ADMISSION')
    scope_extension_guard(value['scopeExtension'])
    lifetime_extension_guard(value['scopeExtension2'])
    hashes = value['sourceHashes']
    need(type(hashes) is dict and ESSENTIAL-{TASK} <= set(hashes) <= SOURCE-{TASK}, 'R44_HASH_INVENTORY')
    for path, sha in hashes.items():
        need(type(sha) is str and re.fullmatch('[0-9a-f]{64}', sha) and digest(read_body(path)) == sha,
             'R44_SOURCE_HASH')
    need(type(value['commands']) is list and value['commands'], 'R44_COMMAND_LEDGER')
    for row in value['commands']:
        need(type(row) is dict and set(row) == {'command', 'exit', 'qualification', 'logSha256'}, 'R44_COMMAND_LEDGER')
        command = row['command']
        need((type(command) is str and command.strip() or type(command) is list and command and
             all(type(v) is str and v for v in command)) and
             (row['exit'] is None or type(row['exit']) is int) and
             type(row['qualification']) is str and bool(row['qualification']) and
             (row['logSha256'] is None or type(row['logSha256']) is str and
              re.fullmatch('[0-9a-f]{64}', row['logSha256'])), 'R44_COMMAND_LEDGER')
    return set(hashes)|{TASK}


def scope(source_paths=None):
    bundle = {}
    for name in ('contract.v2.json', 'matrix.v2.json', 'precedence.v2.json', 'roadmap.v2.json', 'owner-ledger33.v1.json'):
        raw = regular(ROOT/DOCS/name)
        need(raw == git('show', BASE+':'+DOCS+name), 'R44_SCOPE_DOCUMENT')
        bundle[name] = document(raw)
    result = original41().scope_guard(bundle)
    matrix = bundle['matrix.v2.json']
    refs = [ref for row in matrix['rows'] for ref in row['source_refs']]
    refs += [matrix['history']['source_ref']] + matrix['history']['snapshot_refs']
    seen, inherited = {}, []
    for ref in refs:
        path = ref['path']
        need(type(path) is str and not path.startswith('/') and '\\' not in path and ':' not in path and
             all(p and p not in ('.', '..') for p in path.split('/')) and
             ref['source_commit'] == original41().PINS[35][0] and ref['mode'] == '100644', 'R44_SCOPE_REFERENCE')
        if path in seen:
            need(ref == seen[path], 'R44_SCOPE_REFERENCE_DUPLICATE')
            continue
        seen[path] = ref
        historical = git('show', ref['source_commit']+':'+path)
        oid = hashlib.sha1(('blob '+str(len(historical))+'\0').encode()+historical).hexdigest()
        need(digest(historical) == ref['sha256'] and oid == ref['blob'] and
             git('ls-tree', ref['source_commit'], '--', path) == ('100644 blob '+oid+'\t'+path+'\n').encode(),
             'R44_SCOPE_REFERENCE_HASH')
        current = regular(ROOT/path)
        need(current == git('show', BASE+':'+path) or path in set(source_paths or ()) and path in SOURCE,
             'R44_SCOPE_UNGRANTED_CHANGE')
        if current != historical:
            inherited.append(dict(path=path, assessedSHA256=ref['sha256'], currentSHA256=digest(current),
                                  qualification='CURRENT_SOURCE_NOT_REASSESSED_OR_ADMITTED'))
    result.update(sourceReferencesHashed=len(seen), changedHistoricalReferences=inherited,
                  assessmentRenewed=False, authorizedDifferencesNotReassessed=True)
    return result


def new_step():
    step = original41().NEW_STEP.replace('Verify current41 optional Today changes',
        'Verify current44 source/reset fence').replace('separately pinned40/', 'separately pinned41/40/')
    step = step.replace('C41_PREFLIGHT_PHASE', 'C44_PREFLIGHT_PHASE')
    step = step.replace('          python3 -I -B scripts/release/full-app-j01/main_integration41.test.py\n', '')
    step = step.replace('          python3 -I -B scripts/release/full-app-j01/source_consumer41.test.py\n', '')
    step = step.replace('main_integration41.py', 'main_integration44.py')
    marker = '          node --test scripts/phase2/catalog-operator-cat08-cleanup40.test.mjs\n'
    focused = ('          python3 -I -B scripts/release/full-app-j01/main_integration44.test.py\n'
               '          python3 -I -B scripts/release/full-app-j01/source_consumer44.test.py\n'
               '          npm --workspace apps/mobile run test -- --passWithNoTests=false --reporter=verbose '
               'src/lib/storage/privateKVSourceFence44.test.ts '
               'src/features/settings/localPrivateDataFence44.test.ts '
               'src/features/routine/planSourceFence44.test.ts '
               'src/features/onboarding/healthConsentStore.test.ts '
               'src/lib/auth/sessionOwner.test.ts '
               'src/lib/auth/localAccountIsolation.test.ts '
               'src/lib/auth/accountGeneration.test.ts '
               'src/features/photos/encryptedStorage.test.ts\n')
    need(step.count(marker) == 1, 'R44_QUALITY_TEMPLATE')
    return step.replace(marker, focused+marker)


def quality_guard(raw, before):
    start = b'      - name: Verify current41 optional Today changes and separately pinned40/39/38/37/36/35/34/33/32/29\n'
    stop = b'      - name: Verify tooling security backports\n'
    need(before.count(start) == before.count(stop) == 1, 'R44_QUALITY_PARENT')
    prefix, remainder = before.split(start)
    _, suffix = remainder.split(stop)
    need(raw == prefix+new_step().encode()+stop+suffix, 'R44_QUALITY_ONLY_FIRST_STEP')


def authenticate_parent():
    """Authenticate PR44 history and protected preimages without its CURRENT verifier."""
    need(text('rev-parse', BASE+'^{tree}') == BASE_TREE, 'R44_PARENT_TREE')
    old = original41()
    old.authenticate_parent()
    for name, sha in PROGRAMS.items():
        need(digest(regular(ROOT/PREFIX/name)) == sha and digest(git('show', BASE+':'+PREFIX+name)) == sha,
             'R44_ORIGINAL_PROGRAM')
    chain = [old.PLAN_COMMIT, '323b9c0bdbb2d6fa9c0c53bd3994a2e9ec0239d9',
             '9c482130523b2479a534e248f34cf9bbcead6f39', BASE]
    need(text('rev-list', '--reverse', old.BASE+'..'+BASE).splitlines() == chain, 'R44_PARENT_PHASES')
    value = document(git('show', chain[-2]+':'+old.TASK))
    paths = old.task_guard(value, lambda path: git('show', chain[-2]+':'+path))
    source, seal = old.phase_guard(chain, 'SOURCE_FROZEN', paths)
    need(source == chain[-2] and seal == BASE, 'R44_PARENT_SEAL')
    old.quality_guard(git('show', source+':.github/workflows/quality.yml'),
                      git('show', old.BASE+':.github/workflows/quality.yml'))
    primitives().worklist_guard(document(git('show', BASE+':docs/phase-4/generated/source-worklist.json')), source)
    need(parents(PLAN_COMMIT) == [PLAN_COMMIT, BASE] and changed(BASE, PLAN_COMMIT, {PLAN}) == {PLAN} and
         digest(git('show', PLAN_COMMIT+':'+PLAN)) == PLAN_SHA, 'R44_PLAN_FIRST')
    for path, entry in BASELINES.items():
        mode, blob, sha, size = entry
        expected = b'' if blob is None else (mode+' blob '+blob+'\t'+path+'\n').encode()
        need(git('ls-tree', BASE, '--', path) == expected, 'R44_BASELINE_IDENTITY')
        if blob is not None:
            raw = git('show', BASE+':'+path)
            need(digest(raw) == sha and len(raw) == size, 'R44_BASELINE_IDENTITY')
    need(set(BASELINES) == GRANT and len(GRANT) == 43, 'R44_BASELINE_INVENTORY')
    diagnostic_guard()


def diagnostic_guard():
    """Keep the prior failed C44 interval and its red evidence immutable, never an accepted base."""
    need(text('rev-parse', DIAGNOSTIC_HEAD+'^{tree}') == DIAGNOSTIC_TREE and
         parents(DIAGNOSTIC_HEAD) == [DIAGNOSTIC_HEAD, PLAN_COMMIT], 'R44_DIAGNOSTIC_HISTORY')
    raw = git('show', DIAGNOSTIC_HEAD+':'+TASK)
    need(digest(raw) == DIAGNOSTIC_TASK_SHA, 'R44_DIAGNOSTIC_TASK')
    value = document(raw)
    no_admission(value, 'R44_DIAGNOSTIC_NO_ADMISSION')
    need('scopeExtension' not in value and value['base'] == BASE and value['baseTree'] == BASE_TREE and
         value['planCommit'] == PLAN_COMMIT and value['authority'] == AUTHORITY, 'R44_DIAGNOSTIC_AUTHORITY')
    old_source = ORIGINAL_GRANT-WORKLIST-{PLAN}
    old_paths = set(value['sourceHashes'])|{TASK}
    need(old_paths <= old_source and changed(PLAN_COMMIT, DIAGNOSTIC_HEAD, old_paths) == old_paths and
         changed(BASE, DIAGNOSTIC_HEAD, ORIGINAL_GRANT) == old_paths|{PLAN}, 'R44_DIAGNOSTIC_SCOPE')
    for path, sha in value['sourceHashes'].items():
        need(digest(git('show', DIAGNOSTIC_HEAD+':'+path)) == sha, 'R44_DIAGNOSTIC_SOURCE_HASH')
    red = git('show', DIAGNOSTIC_HEAD+':'+DIAGNOSTIC_RED_TEST)
    need(digest(red) == DIAGNOSTIC_RED_SHA and red.count(b"it('AUDIT:") == 3, 'R44_DIAGNOSTIC_RED_CUSTODY')
    qualification = 'PARTIAL_BLOCKED_ACTUAL_THREE_ADDITIVE_REGRESSIONS_ALL_FAIL_EXIT1'
    rows = [r for r in value['commands'] if r['qualification'] == qualification]
    need(len(rows) == 1 and rows[0]['exit'] == 1 and rows[0]['logSha256'] ==
         'b8455a546939083b5fe0b44252b1923b59e757faadca80a265cd7f54949a3315', 'R44_DIAGNOSTIC_RED_RECEIPT')


def snapshot(head):
    check = primitives().helpers()
    tree = check.tree29(head)
    index = git('ls-files', '--stage', '-z')
    need(index == b''.join((mode+' '+oid+' 0\t'+path+'\0').encode() for path, (mode, oid) in tree.items()), 'R44_INDEX')
    need(all(line.startswith(b'H ') for line in git('ls-files', '-v', '-z').split(b'\0') if line), 'R44_INDEX_FLAGS')
    need(not git(*primitives().filter_overrides(), 'status', '--porcelain=v1', '--untracked-files=all', '-z'), 'R44_DIRTY')
    return index, check.working29_guard(tree)


def pins():
    return dict(original41().PINS) | {44: (BASE, BASE_TREE, PARENT_BRANCH)}


def github_headers(env):
    headers = {'Accept': 'application/vnd.github+json', 'User-Agent': 'onSkin-current44-source-integrity'}
    if env.get('GITHUB_ACTIONS') == 'true':
        token = env.get('GH_TOKEN', '')
        need(type(token) is str and 20 <= len(token) <= 4096 and not any(c.isspace() for c in token),
             'R44_CI_READ_TOKEN')
        headers['Authorization'] = 'Bearer '+token
    return headers


def fetch_pr(number):
    request = urllib.request.Request('https://api.github.com/repos/TasfiqJ/onSkin/pulls/'+str(number),
                                     headers=github_headers(os.environ))
    with urllib.request.urlopen(request, timeout=30) as response:
        raw = response.read(1024*1024+1)
    need(len(raw) <= 1024*1024, 'R44_LIVE_PR_SIZE')
    return document(raw)


def live_refs(include_source=False):
    names = {'refs/heads/main': 'main', **{'refs/heads/'+p[2]: 'pr'+str(n) for n, p in pins().items()}}
    if include_source:
        names['refs/heads/'+BRANCH] = 'source'
    values = {}
    for line in text('ls-remote', '--exit-code', 'origin', *names).splitlines():
        sha, name = line.split()
        need(name in names and names[name] not in values and re.fullmatch('[0-9a-f]{40}', sha), 'R44_LIVE_REFS')
        values[names[name]] = sha
    need(set(values) == set(names.values()), 'R44_LIVE_REFS')
    return values


def ci_guard(env, event, head, tree, merge, merge_tree, live, live_pr):
    expected = dict(main=MAIN, **{'pr'+str(n): p[0] for n, p in pins().items()})
    if env.get('GITHUB_ACTIONS') != 'true':
        need(not any(k.startswith('GITHUB_') for k in env) and live == expected, 'R44_LOCAL_CONTEXT')
        return 'LOCAL_EXACT_CHECKOUT_NOT_HOSTED_CI'
    need(env.get('GITHUB_EVENT_NAME') == 'pull_request' and env.get('GITHUB_REPOSITORY') == 'TasfiqJ/onSkin' and
         type(event) is dict and event.get('repository', {}).get('full_name') == 'TasfiqJ/onSkin', 'R44_CI_KIND')
    number = event.get('number')
    need(type(number) is int and number > 44 and env.get('GITHUB_REF') == 'refs/pull/'+str(number)+'/merge', 'R44_CI_EVENT')
    for pr in (event.get('pull_request'), live_pr):
        original41().pr_guard(pr, number, head, BRANCH, BASE, PARENT_BRANCH)
    need(re.fullmatch('[0-9a-f]{40}', env.get('GITHUB_SHA', '')) and
         merge == [env['GITHUB_SHA'], BASE, head] and merge_tree == tree and
         live_pr.get('merge_commit_sha') == env['GITHUB_SHA'], 'R44_SERVICE_TEST_MERGE')
    need(live == dict(expected, source=head), 'R44_STALE_REFS')
    return 'GENUINE_EVENT_LIVE_PR_REFS_SERVICE_TEST_MERGE'


def run_readonly(args, expected=0, timeout=900):
    result = subprocess.run(args, cwd=ROOT, capture_output=True, timeout=timeout)
    need(result.returncode == expected, 'R44_READONLY_CHILD_EXIT')
    return result.stdout


def verify(phase='SOURCE_FROZEN'):
    need(not sys.flags.optimize and phase in PHASES, 'R44_PHASE')
    primitives().helpers().full29_store()
    need(text('remote', 'get-url', 'origin').removesuffix('.git') == 'https://github.com/TasfiqJ/onSkin', 'R44_ORIGIN')
    authenticate_parent()
    head, tree = text('rev-parse', 'HEAD'), text('rev-parse', 'HEAD^{tree}')
    need(len(parents(head)) == 2 and text('merge-base', BASE, head) == BASE, 'R44_SOURCE_HEAD')
    in_ci = os.environ.get('GITHUB_ACTIONS') == 'true'
    need(phase == 'SOURCE_FROZEN' if in_ci else text('symbolic-ref', '--short', 'HEAD') == BRANCH, 'R44_BRANCH_OR_CI_SEAL')
    commits = text('rev-list', '--reverse', BASE+'..'+head).splitlines()
    need(len(commits) >= 3 and commits[:2] == [PLAN_COMMIT, DIAGNOSTIC_HEAD], 'R44_RESUMED_HISTORY')
    substantive = commits[-1] if phase == 'SOURCE_PENDING' else commits[-2]
    source_paths = task_guard(document(git('show', substantive+':'+TASK)), lambda path: git('show', substantive+':'+path))
    source, seal = phase_guard(commits, phase, source_paths)
    need(git('show', head+':'+PLAN) == git('show', PLAN_COMMIT+':'+PLAN), 'R44_PLAN_IMMUTABLE')
    quality_guard(git('show', source+':.github/workflows/quality.yml'), git('show', BASE+':.github/workflows/quality.yml'))
    if seal:
        value = document(git('show', seal+':docs/phase-4/generated/source-worklist.json'))
        primitives().worklist_guard(value, source)
        need(value.get('warnings') == [] and value.get('summary', {}).get('warningCount') == 0 and
             value.get('summary', {}).get('blockerCount') == 0, 'R44_WORKLIST_WARNINGS')
        markdown = git('show', seal+':docs/phase-4/generated/source-worklist.md')
        need(('Git SHA: '+source).encode() in markdown and b'Git status: clean' in markdown, 'R44_WORKLIST_MARKDOWN')
        run_readonly(['node', 'scripts/phase4/build-source-worklist.mjs', '--strict', '--check'])
    before = snapshot(head)
    projection = scope(source_paths)
    run_readonly(['node', 'scripts/launch/validate-execution-baseline.mjs'])
    run_readonly(['node', 'scripts/launch/execution-baseline-smoke.mjs'])
    for number, (phead, ptree, branch) in pins().items():
        prior = pins()[number-1] if number > 35 else (MAIN, '', 'main')
        need(text('rev-parse', phead+'^{tree}') == ptree and text('merge-base', prior[0], phead) == prior[0], 'R44_PIN_ANCESTRY')
        original41().pr_guard(fetch_pr(number), number, phead, branch, prior[0], prior[2])
    live = live_refs(in_ci)
    event, merge, merge_tree, live_pr = {}, [], None, None
    if in_ci:
        path = Path(os.environ.get('GITHUB_EVENT_PATH', ''))
        need(path.is_absolute(), 'R44_EVENT_PATH')
        event = document(regular(path))
        number = event.get('number')
        need(type(number) is int and number > 44, 'R44_CI_EVENT')
        live_pr = fetch_pr(number)
        sha, ref = os.environ.get('GITHUB_SHA', ''), os.environ.get('GITHUB_REF', '')
        original41().service_merge_ref_guard(git('ls-remote', '--exit-code', 'origin', ref), ref, sha)
        merge, merge_tree = parents(sha), text('rev-parse', sha+'^{tree}')
    qualification = ci_guard(os.environ, event, head, tree, merge, merge_tree, live, live_pr)
    need(snapshot(head) == before and text('rev-parse', 'HEAD') == head and live_refs(in_ci) == live, 'R44_FINAL_SNAPSHOT')
    return dict(valid=True, phase=phase, head=head, tree=tree, sourceHead=source, sealedHead=seal,
                parentHead=BASE, parentTree=BASE_TREE, changedSourcePaths=sorted(source_paths),
                trackedBlobsHashed=before[1], qualification=qualification, governance='CURRENT44_FINITE_SOURCE_ONLY',
                productScope=projection, historicalCheck='SEPARATE_FRESH_PR44_ORIGINAL41_40_TO_29_REQUIRED',
                acceptanceGranted=False, admissions=dict.fromkeys(ADMISSIONS, False), release='NO_GO')


def validate_receipts(value, workspace, pin, commands):
    receipts = value.get('receipts')
    need(type(receipts) is list and [r.get('name') for r in receipts] == [r[0] for r in commands],
         'R44_HISTORICAL_INTERVAL')
    logs = {}
    for row, (name, command, expected) in zip(receipts, commands):
        need(type(row.get('exit')) is int and row['exit'] == row.get('expectedExit') == expected and
             row.get('timedOut') is False and row.get('historicalHead') == pin[0] and
             row.get('historicalTree') == pin[1] and row.get('command') == command,
             'R44_HISTORICAL_CHILD')
        path = workspace/'logs'/(name+'.log')
        need(row.get('log') == str(path), 'R44_HISTORICAL_LOG_PATH')
        raw = regular(path, 8*1024*1024)
        need(len(raw) == row.get('bytes') and digest(raw) == row.get('sha256'), 'R44_HISTORICAL_LOG_HASH')
        logs[name] = raw
    return logs


def receipt_tools(value):
    rows = value.get('receipts')
    need(type(rows) is list and len(rows) >= 4, 'R44_HISTORICAL_INTERVAL')
    by_name = {r.get('name'): r for r in rows}
    node = by_name.get('node-version', {}).get('command', [None])[0]
    npm_command = by_name.get('normal-npm-ci', {}).get('command', [])
    need(type(node) is str and Path(node).is_absolute() and len(npm_command) == 6 and
         type(npm_command[1]) is str and Path(npm_command[1]).is_absolute() and
         Path(npm_command[1]).name == 'npm-cli.js', 'R44_HISTORICAL_TOOLS')
    return node, npm_command[1], original41().historical_python()


def original41_result(raw):
    """Authenticate actual original41→40→29 nested execution, never a claimed PASS alone."""
    lines = [line for line in raw.replace(b'\r', b'').splitlines() if line]
    need(len(lines) == 2 and lines[0].startswith(b'R41_HISTORICAL_WORKSPACE '), 'R44_HISTORICAL_TRANSCRIPT')
    value = document(lines[-1])
    no_admission(value, 'R44_HISTORICAL_NO_ADMISSION')
    old = original41()
    pin = (old.BASE, old.BASE_TREE, old.PARENT_BRANCH)
    need(value.get('status') == 'PASS' and value.get('historicalHead') == pin[0] and
         value.get('historicalTree') == pin[1] and value.get('qualification') ==
         'FRESH_AUTHENTIC_PR43_40_39_38_37_36_35_34_33_32_29_NOT_CURRENT_OR_OWNER_ACCEPTANCE', 'R44_HISTORICAL_PIN')
    workspace = Path(value.get('workspace', ''))
    need(workspace.is_absolute() and lines[0] == ('R41_HISTORICAL_WORKSPACE '+str(workspace)).encode(),
         'R44_HISTORICAL_WORKSPACE')
    node, npm, python = receipt_tools(value)
    root = workspace/'pr43'
    commands = [
        ('clone-pr43', ['git', 'clone', '--no-local', '--no-hardlinks', '--no-checkout', '--branch', pin[2],
         '-c', 'core.autocrlf=false', '-c', 'core.longpaths=true', 'https://github.com/TasfiqJ/onSkin.git', str(root)], 0),
        ('checkout-named40', ['git', 'checkout', pin[2]], 0),
        ('node-version', [node, '--version'], 0),
        ('normal-npm-ci', [node, npm, 'ci', '--ignore-scripts=false', '--no-audit', '--no-fund'], 0),
        ('postinstall-check', [node, 'scripts/postinstall.mjs', '--check'], 0),
        ('original40-main_integration40.test.py', [python, '-I', '-B', PREFIX+'main_integration40.test.py'], 0),
        ('original40-source_consumer40.test.py', [python, '-I', '-B', PREFIX+'source_consumer40.test.py'], 0),
        ('original40-driver103', [node, '--test', 'scripts/e2e/onboarding-first-session35.test.mjs',
         'scripts/e2e/retained-safety-assertions.test.mjs', 'scripts/e2e/compact-shelf-target37.test.mjs',
         'scripts/e2e/owned-bottle-formula38.test.mjs'], 0),
        ('original40-cleanup23', [node, '--test', 'scripts/phase2/catalog-operator-cat08-cleanup40.test.mjs'], 0),
        ('original40-inventory5', [node, '--test', 'scripts/launch/formula-route-inventory39.test.mjs'], 0),
        ('original40-exact-source', [python, '-I', '-B', PREFIX+'main_integration40.py'], 0),
        ('original40-fullapp-scope', [python, '-I', '-B', PREFIX+'main_integration40.py', '--scope', 'full-app-j01-v2'], 0),
        ('original40-external-readiness-refusal', [python, '-I', '-B', PREFIX+'main_integration40.py',
         '--scope', 'full-app-j01-v2', '--external-readiness'], 2),
        ('original40-authentic-historical', [python, '-I', '-B', PREFIX+'main_integration40.py', '--historical'], 0),
    ]
    logs = validate_receipts(value, workspace, pin, commands)
    need(logs['node-version'].strip() == b'v22.21.0', 'R44_RUNTIME')
    old.test_summary(logs['original40-driver103'], 103, 103, 0)
    for name, field in (('original40-exact-source', 'original40'), ('original40-fullapp-scope', 'original40Scope')):
        need(document(logs[name]) == value.get(field), 'R44_ACTUAL_TRANSCRIPT')
    need(old.historical_result(logs['original40-authentic-historical']) == value.get('original40Historical'),
         'R44_NESTED_ACTUAL_TRANSCRIPT')
    verdict = value.get('original40', {})
    need(verdict.get('valid') is True and verdict.get('head') == pin[0] and verdict.get('tree') == pin[1] and
         verdict.get('governance') == 'CURRENT40_FINITE_SOURCE_ONLY' and
         verdict.get('qualification') == 'LOCAL_EXACT_CHECKOUT_NOT_HOSTED_CI', 'R44_ORIGINAL40_VERDICT')
    no_admission(verdict, 'R44_ORIGINAL40_NO_ADMISSION')
    return value


def historical_commands(workspace, node, npm, python):
    root = workspace/'pr44'
    ui = workspace/'original41-ui.config.mjs'
    return [
        ('clone-pr44', ['git', 'clone', '--no-local', '--no-hardlinks', '--no-checkout', '--branch', PARENT_BRANCH,
         '-c', 'core.autocrlf=false', '-c', 'core.longpaths=true', 'https://github.com/TasfiqJ/onSkin.git', str(root)], 0),
        ('checkout-named41', ['git', 'checkout', PARENT_BRANCH], 0),
        ('node-version', [node, '--version'], 0),
        ('npm-version', [node, npm, '--version'], 0),
        ('normal-npm-ci', [node, npm, 'ci', '--ignore-scripts=false', '--no-audit', '--no-fund'], 0),
        ('postinstall-check', [node, 'scripts/postinstall.mjs', '--check'], 0),
        ('original41-main_integration41.test.py', [python, '-I', '-B', PREFIX+'main_integration41.test.py'], 0),
        ('original41-source_consumer41.test.py', [python, '-I', '-B', PREFIX+'source_consumer41.test.py'], 0),
        ('original41-cleanup23', [node, '--test', 'scripts/phase2/catalog-operator-cat08-cleanup40.test.mjs'], 0),
        ('original41-inventory5', [node, '--test', 'scripts/launch/formula-route-inventory39.test.mjs'], 0),
        ('original41-ui19', [node, str(root/'node_modules/vitest/vitest.mjs'), 'run', '--config', str(ui),
         '--passWithNoTests=false', '--reporter=verbose'], 0),
        ('original41-optional-driver', [node, '--test', 'scripts/e2e/optional-change41.test.mjs'], 0),
        ('original41-driver103', [node, '--test', 'scripts/e2e/onboarding-first-session35.test.mjs',
         'scripts/e2e/retained-safety-assertions.test.mjs', 'scripts/e2e/compact-shelf-target37.test.mjs',
         'scripts/e2e/owned-bottle-formula38.test.mjs'], 0),
        ('original41-exact-source', [python, '-I', '-B', PREFIX+'main_integration41.py'], 0),
        ('original41-fullapp-scope', [python, '-I', '-B', PREFIX+'main_integration41.py', '--scope', 'full-app-j01-v2'], 0),
        ('original41-external-readiness-refusal', [python, '-I', '-B', PREFIX+'main_integration41.py',
         '--scope', 'full-app-j01-v2', '--external-readiness'], 2),
        ('original41-launch-contract', [node, 'scripts/launch/check-contract.mjs'], 0),
        ('original41-supersession', [node, 'scripts/docs/source-packet-supersession09.test.mjs'], 0),
        ('original41-authentic-historical', [python, '-I', '-B', PREFIX+'main_integration41.py', '--historical'], 0),
    ]


def historical_ui(workspace):
    mobile = workspace/'pr44/apps/mobile'
    value = {'root': str(mobile), 'resolve': {'alias': {'@': str(mobile/'src')}},
             'test': {'environment': 'node', 'include': ['src/features/today/OptionalChangePanel41.test.tsx']}}
    return ('export default '+json.dumps(value)+';\n').encode()


def historical_result(raw):
    lines = [line for line in raw.replace(b'\r', b'').splitlines() if line]
    need(len(lines) == 2 and lines[0].startswith(b'R44_HISTORICAL_WORKSPACE '), 'R44_HISTORICAL_TRANSCRIPT')
    value = document(lines[-1])
    no_admission(value, 'R44_HISTORICAL_NO_ADMISSION')
    need(value.get('status') == 'PASS' and value.get('historicalHead') == BASE and value.get('historicalTree') == BASE_TREE and
         value.get('qualification') == 'FRESH_AUTHENTIC_PR44_41_40_TO_29_NOT_CURRENT_OR_OWNER_ACCEPTANCE', 'R44_HISTORICAL_PIN')
    workspace = Path(value.get('workspace', ''))
    need(workspace.is_absolute() and lines[0] == ('R44_HISTORICAL_WORKSPACE '+str(workspace)).encode(), 'R44_HISTORICAL_WORKSPACE')
    node, npm, python = receipt_tools(value)
    logs = validate_receipts(value, workspace, (BASE, BASE_TREE), historical_commands(workspace, node, npm, python))
    need(logs['node-version'].strip() == b'v22.21.0' and logs['npm-version'].strip() == b'11.20.0', 'R44_RUNTIME')
    original41().test_summary(logs['original41-driver103'], 103, 103, 0)
    need(regular(workspace/'original41-ui.config.mjs') == historical_ui(workspace), 'R44_HISTORICAL_UI_CONFIG')
    ui_log = re.sub(rb'\x1b\[[0-9;]*m', b'', logs['original41-ui19'])
    need(re.search(rb'Tests\s+19 passed\s+\(19\)', ui_log) is not None, 'R44_HISTORICAL_UI_INTERVAL')
    for name, field in (('original41-exact-source', 'original41'), ('original41-fullapp-scope', 'original41Scope')):
        need(document(logs[name]) == value.get(field), 'R44_ACTUAL_TRANSCRIPT')
    need(original41_result(logs['original41-authentic-historical']) == value.get('original41Historical'),
         'R44_NESTED_ACTUAL_TRANSCRIPT')
    verdict = value.get('original41', {})
    need(verdict.get('valid') is True and verdict.get('head') == BASE and verdict.get('tree') == BASE_TREE and
         verdict.get('governance') == 'CURRENT41_FINITE_SOURCE_ONLY' and
         verdict.get('qualification') == 'LOCAL_EXACT_CHECKOUT_NOT_HOSTED_CI', 'R44_ORIGINAL41_VERDICT')
    no_admission(verdict, 'R44_ORIGINAL41_NO_ADMISSION')
    return value


def historical():
    """Original41 CURRENT checks run only in a fresh exact named PR44 checkout."""
    authenticate_parent()
    start = text('rev-parse', 'HEAD')
    env = primitives().clean_environment()
    python = original41().historical_python()
    workspace = Path(tempfile.mkdtemp(prefix='integration44-')).resolve()
    need(not workspace.is_relative_to(ROOT), 'R44_EXTERNAL_CLONE')
    root, logs = workspace/'pr44', workspace/'logs'
    logs.mkdir()
    env.update(TEMP=str(workspace.parent), TMP=str(workspace.parent), TMPDIR=str(workspace.parent))
    print('R44_HISTORICAL_WORKSPACE '+str(workspace), file=sys.stderr, flush=True)
    node = Path(shutil.which('node')).resolve()
    candidates = [node.parent/'node_modules/npm/bin/npm-cli.js'] if os.name == 'nt' else [node.parent.parent/'lib/node_modules/npm/bin/npm-cli.js']
    if env.get('APPDATA'):
        candidates.insert(0, Path(env['APPDATA'])/'npm/node_modules/npm/bin/npm-cli.js')
    npm = next((p for p in candidates if p.is_file() and
               subprocess.check_output([str(node), str(p), '--version'], env=env).strip() == b'11.20.0'), None)
    need(npm is not None, 'R44_RUNTIME')
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
                 pinned('rev-parse', '--is-shallow-repository') == 'false', 'R44_HISTORICAL_PIN')
            for program, sha in PROGRAMS.items():
                need(digest(regular(root/PREFIX/program)) == sha, 'R44_HISTORICAL_PROGRAM')
        if name == 'original41-ui19':
            (workspace/'original41-ui.config.mjs').write_bytes(historical_ui(workspace))
        path = logs/(name+'.log')
        started, timed_out = time.monotonic(), False
        with path.open('wb') as stream:
            process = subprocess.Popen(args, cwd=workspace if name == 'clone-pr44' else root,
                                       env=env, stdout=stream, stderr=subprocess.STDOUT)
            try:
                process.wait(timeout=21600 if name == 'original41-authentic-historical' else 1800)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
                timed_out = True
        raw = path.read_bytes()
        receipts.append(dict(name=name, command=args, exit=process.returncode, expectedExit=expected,
                             seconds=round(time.monotonic()-started, 3), timedOut=timed_out, bytes=len(raw),
                             sha256=digest(raw), log=str(path), historicalHead=BASE, historicalTree=BASE_TREE))
        (logs/'receipts.json').write_bytes((json.dumps(receipts, indent=2)+'\n').encode())
        need(not timed_out and len(raw) <= 8*1024*1024, 'R44_HISTORICAL_TIMEOUT_OR_OUTPUT')
        need(process.returncode == expected, 'R44_HISTORICAL_CHILD_EXIT')
        output[name] = raw
    need(pinned('status', '--porcelain=v1', '--untracked-files=all') == '' and pinned('rev-parse', 'HEAD') == BASE and
         text('rev-parse', 'HEAD') == start, 'R44_HISTORICAL_CHANGED')
    result = dict(status='PASS', historicalHead=BASE, historicalTree=BASE_TREE,
                  original41=document(output['original41-exact-source']),
                  original41Scope=document(output['original41-fullapp-scope']),
                  original41Historical=original41_result(output['original41-authentic-historical']),
                  receipts=receipts, workspace=str(workspace),
                  qualification='FRESH_AUTHENTIC_PR44_41_40_TO_29_NOT_CURRENT_OR_OWNER_ACCEPTANCE',
                  acceptanceGranted=False, admissions=dict.fromkeys(ADMISSIONS, False), release='NO_GO')
    return historical_result(('R44_HISTORICAL_WORKSPACE '+str(workspace)+'\n'+json.dumps(result)).encode())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase', choices=PHASES, default='SOURCE_FROZEN')
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--historical', action='store_true')
    group.add_argument('--scope', choices=['full-app-j01-v2'])
    parser.add_argument('--external-readiness', action='store_true')
    args = parser.parse_args()
    try:
        need(not args.external_readiness or args.scope is not None, 'R44_EXPLICIT_SCOPE_REQUIRED')
        result = historical() if args.historical else verify(args.phase)
        if args.scope:
            result = dict(result['productScope'], head=result['head'], tree=result['tree'], phase=args.phase,
                          sourceQualification=result['qualification'])
        print(json.dumps(result, sort_keys=True))
        return 2 if args.external_readiness else 0
    except Exception as exc:
        reason = str(exc)
        if not re.fullmatch(r'(?:R44|R41|R40|R39|R38|R37|R36|R35|R34|R33|R32|R29|R23)_[A-Z0-9_]{1,96}', reason):
            reason = 'R44_EXECUTION_INCOMPLETE'
        print(json.dumps(dict(valid=False, error=reason, acceptanceGranted=False, release='NO_GO')))
        return 1


# Immutable PR44 preimages, independently inventoried before implementation.
BASELINES = {
    'apps/mobile/src/lib/auth/accountGeneration.ts': ('100644', '00afcec330c4875909a69f02cac6ca055a318bc2', 'aa0a702874069f12a968f4e7edbaa1a35ad5ac3487ffea25ac451d69c7553217', 5604),
    'apps/mobile/src/lib/auth/accountGeneration.test.ts': ('100644', 'f060a1195fcb42d0f68b4333e5d50bb1e9bbb6e1', 'd372f38fcf8f24a4c07c3b19e5b7b428ffc4a4d8837d24c065cfa36bfae849d1', 6652),
    'apps/mobile/src/features/photos/encryptedStorage.ts': ('100644', '55aafc5dec99fe89dd092e961b389076ef05d555', '4a5de9b5dd3d49c90b36e1c2d732a7bbbe1d686bec8b9a7d9c8fa09fbdf2a399', 44257),
    'apps/mobile/src/features/photos/encryptedStorage.test.ts': ('100644', '7e7f4c46185394e19f29130fec3a9437f955e268', 'dc56de1aeb07bf54bf7e33da018b79007dd81dbc3076ce82ba1687d16ab340d2', 46722),
    'apps/mobile/src/lib/auth/localAccountIsolation.ts': ('100644', 'a2ace9f1ec47e6f2617eacd67c2cf404e0fc5ec2', '1af3f7888388489d53c7ce7a803d4ed657a182e48dba5a83a7b300ab4a527509', 4831),
    'apps/mobile/src/lib/auth/sessionOwner.ts': ('100644', 'e04e8f6302b343c14da71cd8c4975820a5536bee', '19a80b00e69e3826da7f5bc7856cc166693d405af48aae43df1711b58ab5d20b', 7771),
    'apps/mobile/src/lib/auth/sessionOwner.test.ts': ('100644', '00deb51abdd0f77e3154a4bcad35a044c9cc35d2', 'a885092e3b6021e13d475db804e908e6c4a6947bfc7e7a56f43128875e96283d', 10358),
    '.github/workflows/quality.yml': ('100644', '15c2279631b155ae12740a17a0bc3842d77d06ca', '9252755840759ec8ad5f14454b654c0794797176a430bc577063ab89d76ffe35', 16533),
    'PROGRESS.md': ('100644', '83356e0dc630dad04d2e421ea8ab337b3ee38377', '52b778351d09ae9647d06ca1c66e781a07985b31ace6ca987d2db9415a828b01', 559724),
    'apps/mobile/src/app/index.tsx': ('100644', '10c1ec97a9a5c449314844b9327d834a70101425', '59d83117ef288c6db76bef2ec506803556371070b7b13b8fd8b139b96e0e0169', 12012),
    'apps/mobile/src/features/intelligence/overrides.test.ts': ('100644', 'ef622012a27714067b7aa10c284d253367d3c980', '5038c4701845527d42577b99f369ee2d9db08628edde8648949d4b00cd42df27', 7777),
    'apps/mobile/src/features/intelligence/overrides.ts': ('100644', '5e697003456b35640ce44194581184949342c019', '77b1c6ec962d655b4355cb60977ba0f09b9963ec9dd78ef76272fe3529e1866a', 11735),
    'apps/mobile/src/features/onboarding/healthConsentStore.test.ts': ('100644', '77c0ab3f371f5927f9096ceed28fb224dbe34191', '5f8d6b3403b6b59883b27a54accfe530e04002214fac018ab2dda89529938836', 10822),
    'apps/mobile/src/features/onboarding/healthConsentStore.ts': ('100644', 'f83c34d8361b6a294ebe7f57f4b4dccac091e918', '1a8a932a765f378af159417e50c68e254ac7a0e288862be93e0513a2e82b8b83', 7280),
    'apps/mobile/src/features/onboarding/skinProfileStore.test.ts': ('100644', '761fb4269c28b58dc406cf271f0fa8ff3fa52c8e', '1f00c42a714850f01a480d26902976a13a51ae615ee06112b1a7ddf5b6fcccbd', 14640),
    'apps/mobile/src/features/onboarding/skinProfileStore.ts': ('100644', '84a9af5e1ceba7094cec378a989cb009c6fc117c', 'dd2f963b1e3813514d7c72fe27176665c402d22c7fbfbf5be4bbf131d3d66d90', 17822),
    'apps/mobile/src/features/routine/orderStore.test.ts': ('100644', '1bc7117a9a4f2abb9f71c9cf2df5ad696487eedf', 'bf9de584a71261637865333b6fb6fee3b8953bbd98f64d8711ffbc11a8906189', 17192),
    'apps/mobile/src/features/routine/orderStore.ts': ('100644', '3c856051f03ee1dcbb2dc3e9276298885f2a34b6', '3b08983c188287434cda96444cfed91d23c3d653952aec2cbf1a2ab92f0d656d', 10854),
    'apps/mobile/src/features/routine/planRecovery.test.ts': ('100644', '372a6bc6ffb6f39c4210e06743186d76ea5ab53a', 'c1c478d6b840ad3296b1e9088c467d89b73480d128c638919a3a52f093cd9be9', 40742),
    'apps/mobile/src/features/routine/planSourceFence44.test.ts': (None, None, None, None),
    'apps/mobile/src/features/routine/planSourceFence44.ts': (None, None, None, None),
    'apps/mobile/src/features/routine/usePlan.test.ts': ('100644', 'b580433de4b9b0084f0423d0fe49e7e21044ba58', '145de2acd477a3bf601dedefbd57c2490ff024de472c2389a434b6f8e72670ec', 3208),
    'apps/mobile/src/features/routine/usePlan.ts': ('100644', '25d0800674375259218ba5e192553e1e99fe19f6', 'd10920c965d1355c02f00f37483d3ebd8075e30ddef483866d9e193de8f0d236', 15396),
    'apps/mobile/src/features/settings/localPrivateData.test.ts': ('100644', 'a98f8351ddfc82b567114b05052b2db48647f292', '711cf481b66d2819cd1e8199468767f1467aaf26bb8e9651f89c897368be1b8a', 10389),
    'apps/mobile/src/features/settings/localPrivateData.ts': ('100644', 'ddcc9fc5ec6893c5aa6dbded10c6560ac554db4a', 'c4c58c84ab8c81f799c15d73ca8b48174cc6bca6ba06d77615a74b694f4e3bf7', 3994),
    'apps/mobile/src/features/settings/localPrivateDataFence44.test.ts': (None, None, None, None),
    'apps/mobile/src/features/settings/settingsRoutes.test.ts': ('100644', '6e4b99c0373c5e944028ef079b086e1746737d1a', '790bc54b88f092bd606da5d3e7a2036cac1ebefa3dfa7cd9db82e78b243da6d2', 37436),
    'apps/mobile/src/features/shelf/store.test.ts': ('100644', 'f2019ac06ef972d0e7c8d15917da92c7bc31bca5', 'df93f740de81d090015666d58f2f4f6527e35eb6074ea6d2eed6ac8e65a32e1a', 75093),
    'apps/mobile/src/features/shelf/store.ts': ('100644', '5049a116081ab1385ea7f0803cb14248afa4cc6a', '8cc2546a87f48f4ae1667ec48c19ebaee768c68d893a49471ff8363d4d34b118', 69209),
    'apps/mobile/src/lib/auth/devLocalResetCoordinator.test.ts': ('100644', '2818b6817e40458e4a694dbf3f44a10bf714c116', 'fcd52517a8f92ae5e3a62632893f0210c93804fae751215e86bec61d15303b59', 4866),
    'apps/mobile/src/lib/auth/devLocalResetCoordinator.ts': ('100644', 'b92643f4060e0318ede603849628661e77cfb3fe', '5d3e722ebc4813005310d08e8c0f541f159300878ae7c9db644fd9be5bd0b966', 2055),
    'apps/mobile/src/lib/auth/localAccountIsolation.test.ts': ('100644', '3eafdcb04de6c6b74cecc674a1232026b30e2fa5', '31c934fe2297e2fc7e81d190b2af08ce73e59e625e4fd6a51102d1772e31ab22', 10246),
    'apps/mobile/src/lib/storage/privateKV.test.ts': ('100644', '143ee13d39cd54d23ba969c6969f11fd4ea4af21', 'a498442cce32e2a330a416793883528ef2a58234c1f2f0100a5b8f8f1ff8b969', 51654),
    'apps/mobile/src/lib/storage/privateKV.ts': ('100644', 'a87e44691d1090123f6f34aafc690e07066cb3ef', '650753610379b0f367b59fb23062ae20a58afd138a321980806e4116e4550116', 31883),
    'apps/mobile/src/lib/storage/privateKVSourceFence44.test.ts': (None, None, None, None),
    'docs/brain/task-specs/M1X-44/SCOPE_PLAN.md': (None, None, None, None),
    'docs/brain/task-specs/M1X-44/TASK.md': (None, None, None, None),
    'docs/phase-4/generated/source-worklist.json': ('100644', '8ba60749cf82b7071a20de2edf6c1b706754d093', '957a3a4da47ca854d0f114b51796589a16b07ab78e42b663ef4ebb6b3f8d9f0a', 142034),
    'docs/phase-4/generated/source-worklist.md': ('100644', 'd006676f30de62f8462c897bab2e60cd1c925917', 'ac1fa58337b17a9da5db9326e13ca54cf171c065b7a9086fc25240f098fe6e9c', 84773),
    'docs/release/full-app-j01/plan-source-reset-fence44.md': (None, None, None, None),
    'scripts/release/full-app-j01/main_integration44.py': (None, None, None, None),
    'scripts/release/full-app-j01/main_integration44.test.py': (None, None, None, None),
    'scripts/release/full-app-j01/source_consumer44.test.py': (None, None, None, None),
}


if __name__ == '__main__':
    sys.exit(main())
