"""Finite Campaign45 source integrity; no owner, security or release admission."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile
import traceback
from types import ModuleType

ROOT = Path(__file__).resolve().parents[3]
BASE = '3865cdd8f610d2c715bd1f3f304ab3c756ca4fbc'
BASE_TREE = 'c02c58151aa2c23090712494bb8b758f1feb7dab'
MAIN = '53a84d921d14dbff1d2e9b8f1b3bb27e10dcede6'
BRANCH = 'stage/m1-owner-plan-history45'
PARENT_BRANCH = 'stage/m1-plan-source-reset-fence44'
PLAN_COMMIT = '054f2adf7169fa2c7da8b29150193835b27e62c0'
PLAN_SHA = '43dec79273fad05121ce5aaf0d13100b708a3e0fc7585c5760e25b7cf6b474f6'
DIAGNOSTIC_COMMITS = ('421c309ea057d1b7d0710a505f79b876d9820f44',
                      '95ba43456fbabc7cec4c581b5c97b11ff84dd8b9',
                      '0f1521d639e54c44d30457faa463c2bff1e08bb1')
DIAGNOSTIC_TREES = ('f72e2367afb36ab5aa1cf9dca40dd6f00bc393c9',
                    'cbd2b0e7f1294d79cd2128547b825fec14c91581',
                    '76de39be856a33b3731222e238d2e4cce4329b7f')
# Immutable prior source checkpoint, never a successful hosted-CI admission.
# Later source repairs retain it in ancestry and require a new final seal.
PREVIOUS_SEALS = ((
    '812a4208154cef9b3d0f3078dd0a56329caedb3d',
    'a140cf67b78b61dc12f6c53bd4ec684f8b687b9c',
    '118a9d345109cb1fef03ffbaefa65afe847749a1',
), (
    '007aff70c652303890e03336ddc9a7ac0afb18ee',
    'b6f0f57efebfc531ecded46fc3f9233489713d61',
    '2090720900a2e892672a835d79bee4b0b73789a3',
), (
    '708c49e4509e0b4637cc2ed39a804414eb58771f',
    '9a370a012101060dc6881aa7e53482ef69b61e6a',
    'f25eaaeaa24414f84d01cf9fba07058aa9d0b5e7',
))
PREFIX = 'scripts/release/full-app-j01/'
DOCS = 'docs/release/full-app-j01/'
PLAN = 'docs/brain/task-specs/M1X-45/SCOPE_PLAN.md'
TASK = 'docs/brain/task-specs/M1X-45/TASK.md'
AUTHORITY = 'M1X-V2-C05-OWNER-PLAN-VERSIONS45-SOURCE-CANDIDATE-01'
REPAIR_AUTHORITY = 'BRAIN-C45-MARKER-OWNERSHIP-REPAIR-03'
REPAIR_PATHS = {'apps/mobile/src/lib/auth/localAccountIsolation.ts',
                'apps/mobile/src/lib/auth/sessionOwner.ts'}
CLOSURE_AUTHORITY = 'BRAIN-C45-AUTONOMOUS-CLOSURE-04'
LEDGER = 'docs/brain/task-specs/M1X-45/CHANGE_LEDGER.json'
# Final exercised inventory remains finite; amendments are explicit preimages,
# never a wildcard authorizing all files beneath a delegated directory.
CLOSURE_PATHS = {LEDGER, 'apps/mobile/src/features/shelf/ownedBottleVersion38.test.ts',
                 'apps/mobile/src/lib/consent/healthDataWriteAdmissionContracts.test.ts',
                 PREFIX+'historicalReplay45.py', PREFIX+'historicalReplay45.test.py'}
PHASES = ('SOURCE_PENDING', 'SOURCE_FROZEN')
WORKLIST = {'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md'}
ORIGINAL_GRANT = {
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
GRANT = ORIGINAL_GRANT | REPAIR_PATHS | CLOSURE_PATHS
SOURCE = GRANT-WORKLIST-{PLAN}
ESSENTIAL = {
    *REPAIR_PATHS, *CLOSURE_PATHS,
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


def previous_seal_guard(seal, parent, tree):
    need(text('rev-parse', seal+'^{tree}') == tree and parents(seal) == [seal, parent],
         'R45_PREVIOUS_SEAL_IDENTITY')
    need(changed(parent, seal, WORKLIST) == WORKLIST, 'R45_PREVIOUS_SEAL_WORKLIST')


def phase_guard(commits, phase, source_paths):
    allowed = set(source_paths)
    need(ESSENTIAL <= allowed <= SOURCE and phase in PHASES and 2 <= len(commits) <= 32 and
         len(set(commits)) == len(commits) and commits[0] == PLAN_COMMIT, 'R45_HISTORY_PHASES')
    source_commits = commits[1:] if phase == 'SOURCE_PENDING' else commits[1:-1]
    need(source_commits, 'R45_SOURCE_REQUIRED')
    need(type(PREVIOUS_SEALS) is tuple and all(type(row) is tuple and len(row) == 3 and
         all(type(value) is str and re.fullmatch('[0-9a-f]{40}', value) for value in row)
         for row in PREVIOUS_SEALS) and
         len({row[0] for row in PREVIOUS_SEALS}) == len(PREVIOUS_SEALS), 'R45_PREVIOUS_SEAL_POLICY')
    prior = {row[0]: row for row in PREVIOUS_SEALS}
    required = [row[0] for row in PREVIOUS_SEALS]
    previous, union, seen = PLAN_COMMIT, set(), []
    for current in source_commits:
        need(parents(current) == [current, previous], 'R45_LINEAR_HISTORY')
        if current in prior:
            need(current == required[len(seen)] and previous == prior[current][1], 'R45_PREVIOUS_SEAL_ORDER')
            previous_seal_guard(*prior[current])
            seen.append(current)
        else:
            paths = changed(previous, current, allowed)
            need(paths, 'R45_EMPTY_SOURCE')
            union.update(paths)
        previous = current
    need(seen == required, 'R45_PREVIOUS_SEALS_REQUIRED')
    need(previous not in prior, 'R45_SOURCE_AFTER_PREVIOUS_SEAL')
    aggregate = allowed | {PLAN} | (WORKLIST if seen else set())
    need(union == allowed and changed(BASE, previous, aggregate) == aggregate, 'R45_EXACT_SOURCE')
    seal = None
    if phase == 'SOURCE_FROZEN':
        seal = commits[-1]
        need(seal not in prior and parents(seal) == [seal, previous] and changed(previous, seal, WORKLIST) == WORKLIST,
             'R45_SOLE_FINAL_SEAL')
    return previous, seal


def task_guard(value, read_body):
    need(type(value) is dict and set(value) == {'schema', 'authority', 'additionalAuthorization', 'closureAuthorization', 'base', 'baseTree', 'planCommit',
         'sourceHashes', 'commands', 'acceptanceGranted', 'admissions', 'release', 'qualification'},
         'R45_TASK_SCHEMA')
    need(type(value['schema']) is int and value['schema'] == 1 and value['authority'] == AUTHORITY and
         value['additionalAuthorization'] == REPAIR_AUTHORITY and
         value['closureAuthorization'] == CLOSURE_AUTHORITY and
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


def ledger_guard(value, preimage):
    need(type(value) is dict and set(value) == {'schema', 'authority', 'originalPlanCommit',
         'frozenPlanSha256', 'preservedRepair03Checkpoint', 'preservedRepair03Tree',
         'scopePolicy', 'additionalPaths', 'decisions'}, 'R45_LEDGER_SCHEMA')
    need(type(value['schema']) is int and value['schema'] == 1 and
         value['authority'] == CLOSURE_AUTHORITY and value['originalPlanCommit'] == PLAN_COMMIT and
         value['frozenPlanSha256'] == PLAN_SHA and
         value['preservedRepair03Checkpoint'] == DIAGNOSTIC_COMMITS[-1] and
         value['preservedRepair03Tree'] == DIAGNOSTIC_TREES[-1] and
         value['scopePolicy'] == 'Task-bounded necessity; exact final exercised inventory, no wildcard acceptance',
         'R45_LEDGER_AUTHORITY')
    rows = value['additionalPaths']
    need(type(rows) is list and len(rows) == len(CLOSURE_PATHS) and
         all(type(row) is dict and type(row.get('path')) is str for row in rows) and
         {row.get('path') for row in rows} == CLOSURE_PATHS, 'R45_LEDGER_INVENTORY')
    fields = {'path', 'authority', 'recordedBeforeFirstEdit', 'preimageCommit', 'preimageSha256',
              'preimageBytes', 'causalNecessity', 'affectedInvariant', 'plannedValidation'}
    for row in rows:
        need(set(row) == fields and row['authority'] == CLOSURE_AUTHORITY and
             row['recordedBeforeFirstEdit'] is True and
             row['preimageCommit'] == DIAGNOSTIC_COMMITS[-1] and
             all(type(row[k]) is str and 1 <= len(row[k]) <= 2000 for k in
                 ('causalNecessity', 'affectedInvariant', 'plannedValidation')), 'R45_LEDGER_ROW')
        raw = preimage(row['path'])
        need((raw is None and row['preimageSha256'] is None and row['preimageBytes'] is None) or
             (raw is not None and type(row['preimageBytes']) is int and len(raw) == row['preimageBytes'] and
              digest(raw) == row['preimageSha256']), 'R45_LEDGER_PREIMAGE')
    decisions = value['decisions']
    need(type(decisions) is list and 1 <= len(decisions) <= 100 and all(type(row) is dict and
         set(row) == {'id', 'decision'} and all(type(v) is str and 1 <= len(v) <= 4000 for v in row.values())
         for row in decisions) and len({row['id'] for row in decisions}) == len(decisions), 'R45_LEDGER_DECISIONS')
    return set(row['path'] for row in rows)


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
    step = step.replace('          python3 -I -B '+PREFIX+'main_integration45.test.py\n',
        '          python3 -I -B '+PREFIX+'main_integration45.test.py\n'
        '          python3 -I -B '+PREFIX+'historicalReplay45.test.py\n')
    step = step.replace('src/lib/storage/privateKVSourceFence44.test.ts ',
        'src/features/routine/planHistory45.test.ts src/features/routine/planHistory45Encrypted.test.ts '
        'src/features/shelf/ownedBottleVersion38.test.ts '
        'src/features/settings/localPrivateDataKeys.test.ts src/features/settings/localDeviceExport.test.ts '
        'src/lib/storage/privateKVSourceFence44.test.ts ')
    step = step.replace("include: ['src/features/today/OptionalChangePanel41.test.tsx']",
        "include: ['src/features/today/OptionalChangePanel41.test.tsx', 'src/features/routine/PlanHistoryPanel45.test.tsx']")
    step = step.replace('main_integration45.py --historical\n',
        'main_integration45.py --historical --historical-evidence-dir "$RUNNER_TEMP/c45-history"\n')
    step += ('      - name: Retain Campaign45 historical replay evidence\n'
        '        if: always()\n'
        '        uses: actions/upload-artifact@v4\n'
        '        with:\n'
        '          name: campaign45-history-${{ github.run_id }}-${{ github.run_attempt }}\n'
        '          path: |\n'
        '            ${{ runner.temp }}/c45-history/logs/**\n'
        '            ${{ runner.temp }}/c45-history/full-normal-original44/**\n'
        '            ${{ runner.temp }}/c45-history/diagnostics/**\n'
        '            ${{ runner.temp }}/c45-history/cli-failure.json\n'
        '          if-no-files-found: warn\n'
        '          retention-days: 7\n\n')
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
    prior = PLAN_COMMIT
    for commit, tree in zip(DIAGNOSTIC_COMMITS, DIAGNOSTIC_TREES):
        need(parents(commit) == [commit, prior] and text('rev-parse', commit+'^{tree}') == tree,
             'R45_AUTHENTICATED_DIAGNOSTIC_HISTORY')
        prior = commit
    need(set(BASELINES) == GRANT and len(ORIGINAL_GRANT) == 39 and len(CLOSURE_PATHS) == 5 and
         len(GRANT) == 46 and
         GRANT-ORIGINAL_GRANT == REPAIR_PATHS|CLOSURE_PATHS, 'R45_BASELINE_INVENTORY')
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
    need(len(commits) >= 5 and commits[:4] == [PLAN_COMMIT, *DIAGNOSTIC_COMMITS], 'R45_SOURCE_HISTORY')
    substantive = commits[-1] if phase == 'SOURCE_PENDING' else commits[-2]
    paths = task_guard(document(git('show', substantive+':'+TASK)), lambda path: git('show', substantive+':'+path))
    ledger_guard(document(git('show', substantive+':'+LEDGER)), lambda path:
        git('show', DIAGNOSTIC_COMMITS[-1]+':'+path) if
        git('ls-tree', DIAGNOSTIC_COMMITS[-1], '--', path) else None)
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


def historical_commands(workspace, node, npm, python, fixture=None):
    root = workspace/'pr45' if fixture is None else fixture
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


def historical_helper():
    path = ROOT/PREFIX/'historicalReplay45.py'
    raw = regular(path)
    module = ModuleType('current45_bounded_historical_execution_not_acceptance')
    module.__file__ = str(path)
    exec(compile(raw, str(path), 'exec'), module.__dict__)
    return module


def source_identity():
    primitives().helpers().full29_store()
    head, tree = text('rev-parse', 'HEAD'), text('rev-parse', 'HEAD^{tree}')
    index, count = snapshot(head)
    return dict(head=head, tree=tree, indexBytes=len(index), indexSHA256=digest(index), trackedBlobs=count)


def historical_controls(fixture, checkpoint, python):
    # Keep the literal original controls, including its refusal exit of two.
    return historical_commands(fixture.parent, checkpoint['node'], checkpoint['npm'], python, fixture)[6:12]


def historical_options(historical_mode, fixture, result, env, evidence_directory=None):
    need((fixture is None) == (result is None), 'R45_HISTORICAL_REUSE_PAIR')
    if fixture is not None:
        need(historical_mode and not any(k.startswith('GITHUB_') for k in env), 'R45_LOCAL_REUSE_ONLY')
        need(Path(fixture).is_absolute() and Path(result).is_absolute(), 'R45_HISTORICAL_REUSE_PATH')
    if evidence_directory is not None:
        need(historical_mode and Path(evidence_directory).is_absolute(), 'R45_HISTORICAL_EVIDENCE_PATH')


def historical_workspace(requested=None, forbidden_roots=()):
    forbidden = (ROOT, *[Path(path) for path in forbidden_roots])
    def outside(path):
        need(all(path != root.resolve() and not path.is_relative_to(root.resolve()) for root in forbidden),
             'R45_EXTERNAL_CLONE')
    if requested is None:
        parent = Path(tempfile.gettempdir()).resolve()
        outside(parent)
        return Path(tempfile.mkdtemp(prefix='integration45-', dir=str(parent))).resolve()
    target = Path(requested)
    need(target.is_absolute(), 'R45_HISTORICAL_EVIDENCE_NEW')
    # lstat also observes existing dangling Windows junctions. Following
    # exists()/is_symlink() alone could mistake one for a new destination.
    try:
        target.lstat()
    except FileNotFoundError:
        pass
    else:
        raise ValueError('R45_HISTORICAL_EVIDENCE_NEW')
    for parent in target.parents:
        info = parent.lstat()
        need(stat.S_ISDIR(info.st_mode) and not parent.is_symlink() and
             not getattr(info, 'st_file_attributes', 0) & 1024, 'R45_HISTORICAL_EVIDENCE_DIRECTORY')
    target = target.resolve()
    outside(target)
    target.mkdir(mode=0o700, exist_ok=False)
    return target


def run_historical_control(helper, name, command, expected, fixture, workspace, env):
    attempts = []
    for number in range(1, 4):
        path = workspace/'logs'/(name+'-attempt-'+str(number)+'.log')
        row = helper.run_command(command, fixture, env, path, expected, 1800)
        row.update(historicalHead=BASE, historicalTree=BASE_TREE)
        attempts.append(row)
        helper.write_json(workspace/'logs'/(name+'-attempts.json'), attempts)
        if row['exit'] == expected and row['timedOut'] is False:
            return dict(name=name, attempts=attempts)
        if number == 3 or name not in ('original44-exact-source', 'original44-fullapp-scope',
                                      'original44-external-readiness-refusal') or row['timedOut'] or \
                helper.original_refusal(row, fixture) is not None:
            break
        directory = workspace/'diagnostics'/(name+'-attempt-'+str(number))
        directory.mkdir(parents=True)
        diagnosis = helper.diagnose(dict(root=str(fixture), row=dict(row)), fixture, directory, env)
        raw = regular(directory/'diagnosis.json', 8*1024*1024)
        row['diagnosis'] = dict(path=str(directory/'diagnosis.json'), bytes=len(raw), sha256=digest(raw))
        helper.write_json(workspace/'logs'/(name+'-attempts.json'), attempts)
        if diagnosis['classification'] not in ('REPRODUCED_RETRYABLE_HTTP', 'DIAGNOSTIC_RECOVERED_CAUSE_UNPROVEN'):
            break
    raise ValueError('R45_HISTORICAL_CONTROL_FAILED')


def control_receipts(value, workspace, fixture, commands, helper):
    controls = value.get('controls')
    need(type(controls) is list and all(type(c) is dict for c in controls) and
         [c.get('name') for c in controls] == [c[0] for c in commands], 'R45_HISTORICAL_INTERVAL')
    logs = {}
    for control, (name, command, expected) in zip(controls, commands):
        attempts = control.get('attempts')
        need(type(attempts) is list and 1 <= len(attempts) <= 3, 'R45_HISTORICAL_CONTROL_ATTEMPTS')
        for number, row in enumerate(attempts, 1):
            need(type(row) is dict and row.get('cwd') == str(fixture) and
                 row.get('historicalHead') == BASE and row.get('historicalTree') == BASE_TREE and
                 type(row.get('timedOut')) is bool and
                 row.get('log') == str(workspace/'logs'/(name+'-attempt-'+str(number)+'.log')),
                 'R45_HISTORICAL_CONTROL_FIXTURE')
            raw = helper.verify_receipt(row, command, expected)
            need(row['timedOut'] is False, 'R45_HISTORICAL_CONTROL_TIMEOUT')
            if number < len(attempts):
                need(row['exit'] != expected and name in ('original44-exact-source', 'original44-fullapp-scope',
                     'original44-external-readiness-refusal') and helper.original_refusal(row, fixture) is None,
                     'R45_HISTORICAL_RETRY')
                proof = row.get('diagnosis', {})
                path = workspace/'diagnostics'/(name+'-attempt-'+str(number))/'diagnosis.json'
                need(proof.get('path') == str(path), 'R45_HISTORICAL_DIAGNOSIS_PATH')
                data = regular(path, 8*1024*1024)
                need(type(proof.get('bytes')) is int and len(data) == proof['bytes'] and
                     digest(data) == proof.get('sha256'), 'R45_HISTORICAL_DIAGNOSIS_HASH')
                diagnosis = document(data)
                original = dict(row)
                del original['diagnosis']
                need(diagnosis.get('originalStage') == dict(root=str(fixture), row=original) and
                     diagnosis.get('normalOriginalCommandStillRequired') is True and
                     diagnosis.get('classification') in ('REPRODUCED_RETRYABLE_HTTP',
                     'DIAGNOSTIC_RECOVERED_CAUSE_UNPROVEN'), 'R45_HISTORICAL_DIAGNOSIS')
                relative = PREFIX+'main_integration44.py'
                output = path.parent/'exception-events.json'
                payload = [str(fixture), relative, PROGRAMS['main_integration44.py'],
                           command[command.index(relative)+1:], str(output)]
                diagnostic_command = [sys.executable, '-I', '-B', '-c', helper.TRACE_CODE, json.dumps(payload)]
                helper.verify_receipt(diagnosis['diagnostic'], diagnostic_command, expected)
                need(diagnosis['diagnostic'].get('cwd') == str(fixture) and
                     diagnosis['diagnostic'].get('timedOut') is False and
                     diagnosis['diagnostic'].get('log') == str(path.parent/'diagnostic.log') and
                     document(regular(output, 8*1024*1024)) == diagnosis.get('exceptionEvents'),
                     'R45_HISTORICAL_DIAGNOSIS_TRANSCRIPT')
                selected = diagnosis.get('selectedSource', {})
                need(selected.get('root') == str(fixture) and selected.get('head') == BASE and
                     selected.get('tree') == BASE_TREE and
                     diagnosis['exceptionEvents'].get('originalSourceSHA256') == PROGRAMS['main_integration44.py'],
                     'R45_HISTORICAL_DIAGNOSIS_SOURCE')
                need(helper.diagnostic_classification(diagnosis['diagnostic'], diagnosis['exceptionEvents']) ==
                     diagnosis['classification'], 'R45_HISTORICAL_DIAGNOSIS')
            else:
                need(row['exit'] == expected, 'R45_HISTORICAL_CONTROL_NOT_PASSED')
                logs[name] = raw
    return logs


def original44_control_results(logs, value):
    for name, count in (('original44-main_integration44.test.py', 22), ('original44-source_consumer44.test.py', 13)):
        need(re.search(('Ran '+str(count)+' tests? in ').encode(), logs[name]) is not None and
             logs[name].strip().endswith(b'OK'), 'R45_HISTORICAL_CONTROLS')
    source_log = re.sub(rb'\x1b\[[0-9;]*m', b'', logs['original44-source-regressions'])
    need(re.search(rb'Test Files\s+3 passed\s+\(3\)', source_log) is not None and
         re.search(rb'Tests\s+94 passed\s+\(94\)', source_log) is not None, 'R45_ORIGINAL44_REGRESSION_INTERVAL')
    exact = document(logs['original44-exact-source'])
    scoped = document(logs['original44-fullapp-scope'])
    refused = document(logs['original44-external-readiness-refusal'])
    need(exact == value.get('original44') and scoped == value.get('original44Scope') and
         scoped == refused, 'R45_ACTUAL_TRANSCRIPT')
    need(exact.get('valid') is True and exact.get('head') == BASE and exact.get('tree') == BASE_TREE and
         exact.get('governance') == 'CURRENT44_FINITE_SOURCE_ONLY' and
         exact.get('qualification') == 'LOCAL_EXACT_CHECKOUT_NOT_HOSTED_CI', 'R45_ORIGINAL44_VERDICT')
    no_admission(exact, 'R45_ORIGINAL44_NO_ADMISSION')
    projection = dict(exact.get('productScope', {}), head=BASE, tree=BASE_TREE, phase='SOURCE_FROZEN',
                      sourceQualification=exact['qualification'])
    need(scoped == projection and scoped.get('requiredRows') == 38 and
         len(scoped.get('unadmittedGates', [])) == 18 and scoped.get('externalReady') is False and
         scoped.get('assessmentRenewed') is False and scoped.get('acceptanceGranted') is False and
         scoped.get('release') == 'NO_GO', 'R45_ORIGINAL44_SCOPE_REFUSAL')
    need(all(row.get(key) is False for row in scoped.get('obligations', [])
             for key in ('complete', 'ownerAdmitted', 'positiveOutputEnabled')) and
         len(scoped.get('obligations', [])) == 65, 'R45_ORIGINAL44_SCOPE_REFUSAL')
    names = ('contract.v2.json', 'matrix.v2.json', 'precedence.v2.json', 'roadmap.v2.json', 'owner-ledger33.v1.json')
    frozen = original44().original41().scope_guard({name: document(git('show', BASE+':'+DOCS+name)) for name in names})
    need(all(scoped.get(key) == item for key, item in frozen.items()), 'R45_ORIGINAL44_SCOPE_REFUSAL')


def historical_result(raw):
    lines = [line for line in raw.replace(b'\r', b'').splitlines() if line]
    need(len(lines) == 2 and lines[0].startswith(b'R45_HISTORICAL_WORKSPACE '), 'R45_HISTORICAL_TRANSCRIPT')
    value = document(lines[-1])
    no_admission(value, 'R45_HISTORICAL_NO_ADMISSION')
    need(value.get('schema') == 2 and type(value.get('schema')) is int and value.get('status') == 'PASS' and
         value.get('historicalHead') == BASE and value.get('historicalTree') == BASE_TREE and
         value.get('qualification') == 'COMPOSITE_PR45_CONTROLS_AND_COMPLETE_NORMAL_ORIGINAL44_INVOCATION_NOT_OWNER_ACCEPTANCE' and
         value.get('mode') in ('FRESH_NAMED_PR45', 'EXPLICIT_LOCAL_COMPLETED_PROOF_REUSE'), 'R45_HISTORICAL_PIN')
    primitives().helpers().full29_store()
    workspace = Path(value.get('workspace', ''))
    need(workspace.is_absolute() and lines[0] == ('R45_HISTORICAL_WORKSPACE '+str(workspace)).encode(), 'R45_HISTORICAL_WORKSPACE')
    fixture = Path(value.get('fixture', ''))
    need(fixture.is_absolute() and not fixture.is_relative_to(ROOT) and not workspace.is_relative_to(ROOT),
         'R45_EXTERNAL_CLONE')
    helper = historical_helper()
    need(value.get('helperSHA256') == digest(regular(ROOT/PREFIX/'historicalReplay45.py')),
         'R45_HISTORICAL_HELPER_CHANGED')
    proof = value.get('completedNormalInvocation', {})
    path = Path(proof.get('path', ''))
    need(path.is_absolute() and not path.is_relative_to(ROOT), 'R45_HISTORICAL_FULL_PROOF_PATH')
    data = regular(path, 8*1024*1024)
    need(type(proof.get('bytes')) is int and len(data) == proof['bytes'] and digest(data) == proof.get('sha256'),
         'R45_HISTORICAL_FULL_PROOF_HASH')
    completed = helper.verify_result(fixture, path)
    need(completed == document(data) and completed.get('original44Historical') == value.get('original44Historical'),
         'R45_NESTED_ACTUAL_TRANSCRIPT')
    checkpoint = completed['checkpoint']
    need(helper.git(fixture, 'symbolic-ref', '--short', 'HEAD').strip().decode() == PARENT_BRANCH,
         'R45_HISTORICAL_NAMED_PARENT')
    python = original44().original41().historical_python()
    if value['mode'] == 'FRESH_NAMED_PR45':
        need(fixture == workspace/'pr45', 'R45_HISTORICAL_FRESH_FIXTURE')
        commands = historical_commands(workspace, checkpoint['node'], checkpoint['npm'], python)[:2]
        rows = value.get('cloneReceipts')
        need(type(rows) is list and len(rows) == 2, 'R45_HISTORICAL_CLONE_RECEIPTS')
        for row, (name, command, expected) in zip(rows, commands):
            need(row.get('name') == name and row.get('cwd') == str(workspace if name == 'clone-pr45' else fixture) and
                 row.get('log') == str(workspace/'logs'/(name+'.log')), 'R45_HISTORICAL_CLONE_RECEIPTS')
            helper.verify_receipt(row, command, expected)
            need(row['exit'] == expected and row.get('timedOut') is False, 'R45_HISTORICAL_CLONE_RECEIPTS')
    else:
        need(value.get('cloneReceipts') == [], 'R45_HISTORICAL_REUSE_CLAIM')
    logs = control_receipts(value, workspace, fixture, historical_controls(fixture, checkpoint, python), helper)
    original44_control_results(logs, value)
    measured = value.get('measuredSource', {})
    head = measured.get('head', '')
    need(type(head) is str and re.fullmatch('[0-9a-f]{40}', head) and
         text('rev-parse', head+'^{tree}') == measured.get('tree') and text('merge-base', BASE, head) == BASE,
         'R45_HISTORICAL_SOURCE_IDENTITY')
    source_tree = primitives().helpers().tree29(head)
    index = b''.join((mode+' '+oid+' 0\t'+path+'\0').encode() for path, (mode, oid) in source_tree.items())
    need(measured == dict(head=head, tree=measured['tree'], indexBytes=len(index), indexSHA256=digest(index),
                         trackedBlobs=len(source_tree)), 'R45_HISTORICAL_SOURCE_IDENTITY')
    current = text('rev-parse', 'HEAD')
    if current != head:
        need(parents(current) == [current, head] and
             changed(head, current, WORKLIST) == WORKLIST, 'R45_HISTORICAL_CALLER_SOURCE')
    need(source_identity()['head'] == current, 'R45_HISTORICAL_CALLER_SOURCE')
    return value


def historical(fixture=None, completed_result=None, evidence_directory=None):
    """Original44 CURRENT checks run only in a fresh exact named PR45 checkout.

    Explicit local reuse revalidates a completed normal invocation in its retained
    fixture and runs fresh controls; it does not claim a newly executed full chain.
    """
    historical_options(True, fixture, completed_result, os.environ, evidence_directory)
    authenticate_parent()
    before = source_identity()
    env = primitives().clean_environment()
    python = original44().original41().historical_python()
    helper = historical_helper()
    workspace = historical_workspace(evidence_directory, (fixture,) if fixture is not None else ())
    need(not workspace.is_relative_to(ROOT), 'R45_EXTERNAL_CLONE')
    try:
        return historical_in_workspace(fixture, completed_result, workspace, before, env, python, helper)
    except Exception as exc:
        # Only a workspace created by this invocation may receive this record.
        # Refused CLI paths never acquire write authority from an error handler.
        failure = dict(type=type(exc).__name__, error=str(exc), traceback=traceback.format_exc(),
                       acceptanceGranted=False, release='NO_GO')
        try:
            with (workspace/'cli-failure.json').open('xb') as stream:
                stream.write((json.dumps(failure, sort_keys=True)+'\n').encode())
        except OSError:
            traceback.print_exc(file=sys.stderr)
        raise


def historical_in_workspace(fixture, completed_result, workspace, before, env, python, helper):
    logs = workspace/'logs'
    logs.mkdir()
    env.update(TEMP=str(workspace.parent), TMP=str(workspace.parent), TMPDIR=str(workspace.parent))
    print('R45_HISTORICAL_WORKSPACE '+str(workspace), file=sys.stderr, flush=True)
    clone_receipts = []
    if fixture is None:
        fixture = workspace/'pr45'
        # Tool arguments do not affect these first two literal clone/checkout commands.
        for name, command, expected in historical_commands(workspace, '', '', python)[:2]:
            row = helper.run_command(command, workspace if name == 'clone-pr45' else fixture,
                                     env, logs/(name+'.log'), expected, 1800)
            row['name'] = name
            clone_receipts.append(row)
            helper.write_json(logs/'clone-receipts.json', clone_receipts)
            need(row['exit'] == expected and row['timedOut'] is False, 'R45_HISTORICAL_CLONE_FAILED')
        proof_directory = workspace/'full-normal-original44'
        mode = 'FRESH_NAMED_PR45'
    else:
        fixture = Path(fixture).resolve()
        completed_result = Path(completed_result).resolve()
        helper.verify_result(fixture, completed_result, workspace/'explicit-reuse-live')
        proof_directory = Path(document(regular(completed_result, 8*1024*1024))['checkpointDirectory'])
        mode = 'EXPLICIT_LOCAL_COMPLETED_PROOF_REUSE'
    need(helper.git(fixture, 'symbolic-ref', '--short', 'HEAD').strip().decode() == PARENT_BRANCH,
         'R45_HISTORICAL_NAMED_PARENT')
    _, control_env, checkpoint = helper.prepare(fixture, proof_directory)
    controls = []
    for name, command, expected in historical_controls(fixture, checkpoint, python):
        controls.append(run_historical_control(helper, name, command, expected, fixture, workspace, control_env))
        helper.write_json(logs/'controls.json', controls)
    if completed_result is None:
        completed = helper.replay(fixture, proof_directory)
        helper.write_json(logs/'original44-replay-result.json', completed)
        if completed.get('status') != 'COMPLETE_ORIGINAL44_FULL_INVOCATION':
            try:
                helper.report_replay_failure(completed, proof_directory, sys.stderr)
            except Exception:
                # Reporting failure is additional evidence, never permission to
                # hide or accept the already retained incomplete normal result.
                traceback.print_exc(file=sys.stderr)
        need(completed.get('status') == 'COMPLETE_ORIGINAL44_FULL_INVOCATION', 'R45_FULL_NORMAL_INVOCATION_INCOMPLETE')
        completed_result = proof_directory/'result.json'
    else:
        completed = helper.verify_result(fixture, completed_result, workspace/'post-controls-reuse-live')
    need(source_identity() == before, 'R45_HISTORICAL_CHANGED')
    output = control_receipts(dict(controls=controls), workspace, fixture,
                              historical_controls(fixture, checkpoint, python), helper)
    full_raw = regular(completed_result, 8*1024*1024)
    result = dict(schema=2, status='PASS', mode=mode, historicalHead=BASE, historicalTree=BASE_TREE,
                  original44=document(output['original44-exact-source']),
                  original44Scope=document(output['original44-fullapp-scope']),
                  original44Historical=completed['original44Historical'], controls=controls,
                  cloneReceipts=clone_receipts, workspace=str(workspace), fixture=str(fixture),
                  helperSHA256=digest(regular(ROOT/PREFIX/'historicalReplay45.py')), measuredSource=before,
                  completedNormalInvocation=dict(path=str(completed_result), bytes=len(full_raw), sha256=digest(full_raw)),
                  qualification='COMPOSITE_PR45_CONTROLS_AND_COMPLETE_NORMAL_ORIGINAL44_INVOCATION_NOT_OWNER_ACCEPTANCE',
                  acceptanceGranted=False, admissions=dict.fromkeys(ADMISSIONS, False), release='NO_GO')
    parsed = historical_result(('R45_HISTORICAL_WORKSPACE '+str(workspace)+'\n'+json.dumps(result)).encode())
    need(source_identity() == before, 'R45_HISTORICAL_CHANGED')
    return parsed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase', choices=PHASES, default='SOURCE_FROZEN')
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--historical', action='store_true')
    group.add_argument('--scope', choices=['full-app-j01-v2'])
    parser.add_argument('--external-readiness', action='store_true')
    parser.add_argument('--historical-fixture', type=Path)
    parser.add_argument('--historical-result', type=Path)
    parser.add_argument('--historical-evidence-dir', type=Path)
    args = parser.parse_args()
    try:
        need(not args.external_readiness or args.scope is not None, 'R45_EXPLICIT_SCOPE_REQUIRED')
        historical_options(args.historical, args.historical_fixture, args.historical_result, os.environ,
                           args.historical_evidence_dir)
        if args.historical:
            result = historical(args.historical_fixture, args.historical_result) if args.historical_evidence_dir is None else \
                historical(args.historical_fixture, args.historical_result, args.historical_evidence_dir)
        else:
            result = verify(args.phase)
        if args.scope:
            result = dict(result['productScope'], head=result['head'], tree=result['tree'], phase=args.phase,
                          sourceQualification=result['qualification'])
        print(json.dumps(result, sort_keys=True))
        return 2 if args.external_readiness else 0
    except Exception as exc:
        if args.historical:
            # Retain actual failure diagnostics, including coded orchestration
            # refusals, without dumping environment, headers or frame locals.
            traceback.print_exc(file=sys.stderr)
        reason = str(exc)
        if not re.fullmatch(r'(?:C45H|R45|R44|R41|R40|R39|R38|R37|R36|R35|R34|R33|R32|R29|R23)_[A-Z0-9_]{1,96}', reason):
            reason = 'R45_EXECUTION_INCOMPLETE'
        print(json.dumps(dict(valid=False, error=reason, acceptanceGranted=False, release='NO_GO')))
        return 1


# Exact pinned PR45 preimages, not a regenerated source grant.
BASELINES = {
    'apps/mobile/src/lib/consent/healthDataWriteAdmissionContracts.test.ts': ('100644', '41e0281da9b2335eb4d9a72d8afc32a86e6228e2', 'd6f6d14e558078ce4d07ef72c166a3c8b43b3b79b1f1e5bb0764dad9530eb1dd', 13144),
    'docs/brain/task-specs/M1X-45/CHANGE_LEDGER.json': (None, None, None, None),
    'apps/mobile/src/features/shelf/ownedBottleVersion38.test.ts': ('100644', '929f1eaf4aa54f67fcd34c5d921ae61250bff344', 'f550a350ea02c2a313b599aae81d7d8a4b95eb9f35798baccc238054e21809a9', 16416),
    'scripts/release/full-app-j01/historicalReplay45.py': (None, None, None, None),
    'scripts/release/full-app-j01/historicalReplay45.test.py': (None, None, None, None),
    'apps/mobile/src/lib/auth/localAccountIsolation.ts': ('100644', 'dba115379250aa4d1987551066bf41ca62665538', '54536c5fe1f9e1fe207359d4824de8b481c0f550fa2bd51a0ee0d901671e7490', 14970),
    'apps/mobile/src/lib/auth/sessionOwner.ts': ('100644', '545e8615aef56268ae96b219914350edda907b78', '96137032c2286422281a5fd9d33d1c950591773b1cddf6875ab17084b29ead1c', 8669),
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
