"""Finite current37 source integrity. Original36 and older approvals run only at their own named full checkouts."""
import argparse, hashlib, json, os, re, shutil, stat, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path
from types import SimpleNamespace
ROOT = Path(__file__).resolve().parents[3]
BASE = '1f4014f80402176ad2a208154d4da03db711ae5f'
BASE_TREE = 'bc859097ad3c8273cf341802474c28a5b13a1d43'
MAIN = '53a84d921d14dbff1d2e9b8f1b3bb27e10dcede6'
BRANCH = 'stage/m1-compact-shelf-first-session37'
PARENT_BRANCH = 'stage/m1-free-first-session-ci36'
PLAN_COMMIT = '55372107ca1d6138477627ef863fba329aa6c42d'
PLAN = 'docs/brain/task-specs/M1X-37/SCOPE_PLAN.md'
PLAN_SHA = 'b43e72db487321b7caf91d6de67bbfbf318837970f351579163629264817bed5'
TASK = 'docs/brain/task-specs/M1X-37/TASK.md'
PREFIX = 'scripts/release/full-app-j01/'
DOCS = 'docs/release/full-app-j01/'
AUTHORITY = 'BRAIN-M1X-COMPACT-SHELF-FIRST-SESSION37-SOURCE-CANDIDATE-01'
PINS = {39: ('1f4014f80402176ad2a208154d4da03db711ae5f', 'bc859097ad3c8273cf341802474c28a5b13a1d43', 'stage/m1-free-first-session-ci36'), 38: ('4c98bed778c1044b95cbb29fcaac06802fa398c1', '3296835a6cd05c60a6dfff6aa2aa3e1e817ed597', 'stage/m1-free-first-session-e2e35'), 37: ('7dea6048e5f1f5e397656b5f2fa670929fa9c2b8', '49b0baf1f20ca3d092db5d3cb14156feb2963f61', 'stage/m1-fullapp-dual-scope-readers34'), 36: ('4ca36e915608460a1ed97d7fff94a3ece61296ab', '49945b4e453b4fc30ceb175f330c8b4b924afe31', 'stage/m1-fullapp-j01-scope-cutover33'), 35: ('cbbb5a83bd29d2833399c214f5b6c6dd14873d24', '0745ad5f5595724a9b26de64324065dc3e53d2ea', 'stage/m1-main-quality-governance32')}
PROGRAMS = {'main_integration32.py': '5b48f78917aaf39e4da66138e3d5c52654af7defd1eaf37ab6404fdc631ceda4', 'check.py': '944c04283b834e5f20bdfcbf95c265c7af57f8f4754952b4353dee5f8d8952dd', 'main_integration33.py': '1176d7fa42f23ecde717ac4c9a96e5eb855774ac4e3bc2813f970a4004065616', 'main_integration34.py': '342e21de512e4e3bf6dffb5e3ad9b86b6b47c9c30f9815d219cd0ab868858fdb', 'main_integration35.py': '1418a7a04a9e91585bc7723a21a6455d86c6e28a1744ff09342275789771f32c', 'main_integration36.py': 'ccb5e6f668911fb54cbed496014ebd5123ec115d52d2ebd8e19b9faf89e0b448', 'main_integration36.test.py': '0507dc44e154bff8ca0fe87cb85694c6d84ff19dc780f7ca332fb8e0dab2433d', 'source_consumer36.test.py': '34c195fc9585373d3c3ef2bf43ce86d03d12dd230f95ad23648a8f69119fe219'}
NEW_STEP = '      - name: Verify current37 compact Shelf source and authentic pinned36/35/34/33/32/29\n        run: |\n          set -euo pipefail\n          phase="${C37_PREFLIGHT_PHASE:-SOURCE_FROZEN}"\n          if [ "${GITHUB_EVENT_NAME:-}" = pull_request ]; then\n            git fetch --no-tags origin "$GITHUB_REF"\n            test "$(git rev-parse FETCH_HEAD)" = "$GITHUB_SHA"\n          fi\n          python3 -I -B scripts/release/full-app-j01/main_integration37.test.py\n          python3 -I -B scripts/release/full-app-j01/source_consumer37.test.py\n          node --test scripts/e2e/onboarding-first-session35.test.mjs scripts/e2e/retained-safety-assertions.test.mjs scripts/e2e/compact-shelf-target37.test.mjs\n          python3 -I -B scripts/release/full-app-j01/main_integration37.py --phase "$phase"\n          python3 -I -B scripts/release/full-app-j01/main_integration37.py --phase "$phase" --scope full-app-j01-v2\n          if python3 -I -B scripts/release/full-app-j01/main_integration37.py --phase "$phase" --scope full-app-j01-v2 --external-readiness; then\n            echo \'External readiness must remain refused\' >&2\n            exit 1\n          else\n            test "$?" = 2\n          fi\n          node scripts/launch/check-contract.mjs\n          python3 -I -B scripts/release/full-app-j01/main_integration37.py --historical\n          node scripts/docs/source-packet-supersession09.test.mjs\n\n'
SOURCE = {'.github/workflows/quality.yml', 'docs/brain/task-specs/M1X-37/TASK.md', 'scripts/e2e/onboarding-first-session.mjs', 'scripts/release/full-app-j01/main_integration37.test.py', 'docs/release/full-app-j01/compact-shelf-first-session37.md', 'PROGRESS.md', 'docs/USER_FLOW_TREE.md', 'scripts/release/full-app-j01/source_consumer37.test.py', 'scripts/release/full-app-j01/main_integration37.py', 'scripts/e2e/compact-shelf-target37.test.mjs', 'scripts/e2e/onboarding-first-session35.test.mjs'}
WORKLIST = {'docs/phase-4/generated/source-worklist.md', 'docs/phase-4/generated/source-worklist.json'}
GRANT = {'apps/mobile/src/app/(tabs)/today.tsx', 'PROGRESS.md', 'apps/mobile/src/features/shelf/shelfRenderDiagnostics.ts', 'scripts/release/full-app-j01/source_consumer37.test.py', 'scripts/e2e/compact-shelf-target37.test.mjs', 'scripts/e2e/retained-safety-assertions.mjs', 'apps/mobile/src/features/shelf/shelfRoutes.test.ts', 'docs/release/full-app-j01/compact-shelf-first-session37.md', 'apps/mobile/src/app/(tabs)/shelf.tsx', 'docs/phase-4/generated/source-worklist.json', 'docs/USER_FLOW_TREE.md', 'apps/mobile/src/app/(tabs)/_layout.tsx', 'scripts/release/full-app-j01/main_integration37.py', 'docs/phase-4/generated/source-worklist.md', 'docs/brain/task-specs/M1X-37/SCOPE_PLAN.md', '.github/workflows/quality.yml', 'docs/brain/task-specs/M1X-37/TASK.md', 'scripts/e2e/onboarding-first-session.mjs', 'scripts/release/full-app-j01/main_integration37.test.py', 'scripts/e2e/retained-safety-assertions.test.mjs', 'apps/mobile/src/features/shelf/shelfRenderDiagnostics.test.ts', 'scripts/e2e/onboarding-first-session35.test.mjs'}
BASELINES = [{'path': 'docs/brain/task-specs/M1X-37/SCOPE_PLAN.md', 'mode': None, 'blob': None, 'sha256': None, 'bytes': None, 'condition': 'NEW'}, {'path': 'docs/brain/task-specs/M1X-37/TASK.md', 'mode': None, 'blob': None, 'sha256': None, 'bytes': None, 'condition': 'NEW'}, {'path': '.github/workflows/quality.yml', 'mode': '100644', 'blob': '085ab507af20ae68ab7b4fcc77e3abf8deb2bbee', 'sha256': 'd68b45727eede68a4b1760e5cbdc419690e65f32130a2915830e010c0736813d', 'bytes': 14962, 'condition': 'PLANNED_IF_NEEDED'}, {'path': 'PROGRESS.md', 'mode': '100644', 'blob': '161d2bcdcd99d62b76981af2142fa6fe9278e00e', 'sha256': 'a5f485cdd17a585674d8881438ad1400ac9604909000781240cb78e7a2a9ade9', 'bytes': 544605, 'condition': 'PLANNED_IF_NEEDED'}, {'path': 'docs/USER_FLOW_TREE.md', 'mode': '100644', 'blob': '7c5f37af6bce38a343c4f5e09dbb083df8ddaa37', 'sha256': '77c982e529b5ed3e875c343cb322e0a213f4022623b1302180f12f81a3a6579f', 'bytes': 533360, 'condition': 'PLANNED_IF_NEEDED'}, {'path': 'docs/release/full-app-j01/compact-shelf-first-session37.md', 'mode': None, 'blob': None, 'sha256': None, 'bytes': None, 'condition': 'NEW'}, {'path': 'scripts/e2e/onboarding-first-session.mjs', 'mode': '100644', 'blob': 'a4a745605fdf7de043b46260745dee174b18e180', 'sha256': 'd9b56cf5149b01c1b2485c9143c36ce45d9b18393f73ec55985477a5164dacfe', 'bytes': 101659, 'condition': 'PLANNED_IF_NEEDED'}, {'path': 'scripts/e2e/onboarding-first-session35.test.mjs', 'mode': '100644', 'blob': 'ebd459470331c8b0658d2a495eec191f18c9c4a7', 'sha256': '2f8fac92f93190fc14a21623b95bf81a800b4c7b1272cff1cdf2a7f5d6c25ee9', 'bytes': 8344, 'condition': 'PLANNED_IF_NEEDED'}, {'path': 'scripts/e2e/compact-shelf-target37.test.mjs', 'mode': None, 'blob': None, 'sha256': None, 'bytes': None, 'condition': 'NEW'}, {'path': 'scripts/release/full-app-j01/main_integration37.py', 'mode': None, 'blob': None, 'sha256': None, 'bytes': None, 'condition': 'NEW'}, {'path': 'scripts/release/full-app-j01/main_integration37.test.py', 'mode': None, 'blob': None, 'sha256': None, 'bytes': None, 'condition': 'NEW'}, {'path': 'scripts/release/full-app-j01/source_consumer37.test.py', 'mode': None, 'blob': None, 'sha256': None, 'bytes': None, 'condition': 'NEW'}, {'path': 'docs/phase-4/generated/source-worklist.json', 'mode': '100644', 'blob': 'b5054c4533cea8d781062f00a64b202653fc641b', 'sha256': '203853eb73bddc5bbc6bdad0f44ba43dd44b191b74905b5013aadf4f0d0747b4', 'bytes': 141091, 'condition': 'PLANNED_IF_NEEDED'}, {'path': 'docs/phase-4/generated/source-worklist.md', 'mode': '100644', 'blob': 'a82321468789b99dd9a9602652bc99bee76e00b2', 'sha256': '6e7de44b63841364fc0527408dd9624321cd6bfe10e727d350c0a9089d10841a', 'bytes': 84178, 'condition': 'PLANNED_IF_NEEDED'}, {'path': 'scripts/e2e/retained-safety-assertions.mjs', 'mode': '100644', 'blob': '30eadad6ad818f83c13f4abba178e339afd9c0a5', 'sha256': 'edd6d33b3905fdb2fceb670552c5cbd1d8b88050b184699640d8a84d66290c2c', 'bytes': 1946, 'condition': 'APP_DEFECT_RED_GREEN_REQUIRED'}, {'path': 'scripts/e2e/retained-safety-assertions.test.mjs', 'mode': '100644', 'blob': '7ae56b621c6d77349164686593100b1d5c3c292c', 'sha256': '3d3c126629abf1d9d07a0da91f8e38d5a9c7e3a062f9900029a00e1062cdfe7a', 'bytes': 2379, 'condition': 'APP_DEFECT_RED_GREEN_REQUIRED'}, {'path': 'apps/mobile/src/app/(tabs)/shelf.tsx', 'mode': '100644', 'blob': 'd51ec774fc9298d5a480bbf6beb5d1d2fb409576', 'sha256': '37be1459adc333062e5cab20542ecbc7bda2c60c04615ba41e99e7181f7d3f36', 'bytes': 26733, 'condition': 'APP_DEFECT_RED_GREEN_REQUIRED'}, {'path': 'apps/mobile/src/app/(tabs)/today.tsx', 'mode': '100644', 'blob': 'e8bbce863adef5e89779e742aa394fa3a5df1783', 'sha256': '3327e663d2e75f0a0a897154868a9f43780b0639e088e3e00e67640ec2395dea', 'bytes': 53996, 'condition': 'APP_DEFECT_RED_GREEN_REQUIRED'}, {'path': 'apps/mobile/src/app/(tabs)/_layout.tsx', 'mode': '100644', 'blob': '1202ce7473645fc162dac652bdff676b8df35b1f', 'sha256': '15c6202800f7815104bceba8df31cf520aacf31db5f71d02fc2a10a44bdb3901', 'bytes': 5403, 'condition': 'APP_DEFECT_RED_GREEN_REQUIRED'}, {'path': 'apps/mobile/src/features/shelf/shelfRenderDiagnostics.test.ts', 'mode': '100644', 'blob': '2e11196b53408cdd4efa74ef202c38eb45dd0f96', 'sha256': '95b13fc770765acbf385893636c318449d42680faa61e4d735521d146dc22b13', 'bytes': 3187, 'condition': 'APP_DEFECT_RED_GREEN_REQUIRED'}, {'path': 'apps/mobile/src/features/shelf/shelfRoutes.test.ts', 'mode': '100644', 'blob': '9e3473262a6d0abfe3e1c895537f6685520a63f7', 'sha256': 'bf576b6df44bd87c95f7dbe8e5bb5ab9b188039817f6a0328961b2c6da1a8fc3', 'bytes': 69404, 'condition': 'APP_DEFECT_RED_GREEN_REQUIRED'}, {'path': 'apps/mobile/src/features/shelf/shelfRenderDiagnostics.ts', 'mode': '100644', 'blob': 'aee6b6eaf21da460a94eaa85fc7fc47c1b966041', 'sha256': '5fc7a6c4000c93d5058509d26e5d8c1a480ba159a6db0a36579d54fad417a56b', 'bytes': 3381, 'condition': 'APP_DEFECT_RED_GREEN_REQUIRED'}]
ADMISSIONS = ['DB06', 'DB08', 'R2B', 'M103', 'M2', 'NATIVE', 'J01', 'CLINICAL',
              'PROVIDER', 'PAID', 'APPLE', 'PUBLIC', 'G97']
REQUIRED = [f'F{i:02}' for i in range(1, 21) if i != 18] + [f'V2-C{i:02}' for i in range(1, 13)] + [f'P{i:02}' for i in range(1, 7)] + ['J01']
DEFERRED = ['F18'] + [f'J{i:02}' for i in range(2, 28)]
GATES = ['G97', 'DB', 'M1-03', 'M2-01', 'G1', 'G2', 'G3', 'G4', 'G5', 'RIGHTS',
         'CLINICAL', 'PROVIDER', 'PAYMENT', 'MODERATION', 'OPERATIONS', 'DEVICE', 'APPLE', 'PUBLIC']
PHASES = ('SOURCE_PENDING', 'SOURCE_FROZEN')
H = None


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
             not getattr(info, 'st_file_attributes', 0) & 1024, 'R37_REGULAR_PARENT')
    before = path.lstat()
    need(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and not path.is_symlink() and
         not getattr(before, 'st_file_attributes', 0) & 1024 and before.st_size <= limit,
         'R37_REGULAR_FILE')
    raw = path.read_bytes()
    after = path.lstat()
    need((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns) ==
         (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns), 'R37_CHANGED_READ')
    return raw


def primitives():
    """Only neutral32 Git/delta/JSON/raw-reader operations; never its verify()."""
    global H
    for name in ('main_integration32.py', 'check.py'):
        need(digest(regular(ROOT/PREFIX/name)) == PROGRAMS[name], 'R37_NEUTRAL_PREIMAGE')
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


def phase_guard(commits, phase):
    need(phase in PHASES and 2 <= len(commits) <= 32 and len(set(commits)) == len(commits) and
         commits[0] == PLAN_COMMIT, 'R37_HISTORY_PHASES')
    source_commits = commits[1:] if phase == 'SOURCE_PENDING' else commits[1:-1]
    need(source_commits, 'R37_SOURCE_REQUIRED')
    previous, union = PLAN_COMMIT, set()
    for current in source_commits:
        need(parents(current) == [current, previous], 'R37_LINEAR_HISTORY')
        paths = changed(previous, current, SOURCE)
        need(paths, 'R37_EMPTY_SOURCE')
        union.update(paths)
        previous = current
    need(union == SOURCE and changed(BASE, previous, SOURCE|{PLAN}) == SOURCE|{PLAN}, 'R37_EXACT_SOURCE')
    seal = None
    if phase == 'SOURCE_FROZEN':
        seal = commits[-1]
        need(parents(seal) == [seal, previous] and changed(previous, seal, WORKLIST) == WORKLIST,
             'R37_SOLE_FINAL_SEAL')
    return previous, seal


def task_guard(value, body):
    need(type(value) is dict and set(value) == {'schema', 'authority', 'base', 'baseTree', 'planCommit',
         'sourceHashes', 'acceptanceGranted', 'admissions', 'release', 'qualification'}, 'R37_TASK_SCHEMA')
    need(type(value['schema']) is int and value['schema'] == 1 and value['authority'] == AUTHORITY and
         value['base'] == BASE and value['baseTree'] == BASE_TREE and value['planCommit'] == PLAN_COMMIT and
         value['qualification'] == 'SOURCE_INTEGRITY_NOT_QUALIFIED_ACCEPTANCE', 'R37_TASK_AUTHORITY')
    no_admission(value, 'R37_NO_ADMISSION')
    need(type(value['sourceHashes']) is dict and set(value['sourceHashes']) == SOURCE-{TASK}, 'R37_HASH_INVENTORY')
    for path, sha in value['sourceHashes'].items():
        need(type(sha) is str and re.fullmatch('[0-9a-f]{64}', sha) and digest(body(path)) == sha,
             'R37_SOURCE_HASH')


def quality_guard(raw, before):
    start = b'      - name: Verify current36 integrity and separately pinned35/34/33/32/29\n'
    stop = b'      - name: Verify tooling security backports\n'
    need(before.count(start) == before.count(stop) == 1, 'R37_QUALITY_PARENT')
    prefix, remainder = before.split(start)
    _, suffix = remainder.split(stop)
    need(raw == prefix+NEW_STEP.encode()+stop+suffix, 'R37_QUALITY_ONLY_FIRST_STEP')


def scope_guard(bundle):
    need(set(bundle) == {'contract.v2.json', 'matrix.v2.json', 'precedence.v2.json', 'roadmap.v2.json',
         'owner-ledger33.v1.json'}, 'R37_SCOPE_INVENTORY')
    c, m, p, owner = [bundle[n] for n in ('contract.v2.json', 'matrix.v2.json', 'precedence.v2.json', 'owner-ledger33.v1.json')]
    need(c['schema_version'] == 2 and c['contract_id'] == 'onskin-full-app-j01-campaign33-v2' and
         c['required_f']+c['required_c']+c['required_p']+c['korean_candidates'] == REQUIRED and
         c['deferred_f']+c['deferred_j'] == DEFERRED and c['release_status'] == 'NO_GO' and
         all(c[k] is False for k in ('acceptanceGranted', 'candidateReady', 'productReady',
             'providerReady', 'paidReady', 'professionalReady', 'j01Qualified')), 'R37_SCOPE_NO_ADMISSION')
    ids = [f'F{i:02}' for i in range(1,21)]+[f'V2-C{i:02}' for i in range(1,13)]+[f'P{i:02}' for i in range(1,7)]+[f'J{i:02}' for i in range(1,28)]
    need(type(m['rows']) is list and [r.get('id') for r in m['rows']] == ids and
         (m['row_count'], m['required_count'], m['deferred_count']) == (65, 38, 27) and
         m['acceptanceGranted'] is False and m['release'] == 'NO_GO', 'R37_SCOPE_ROWS')
    for row in m['rows']:
        need(all(row[k] is False for k in ('complete', 'positive_output_enabled', 'owner_admitted')) and
             row['gates'] and len(set(row['gates'])) == len(row['gates']) and
             set(row['gates']) <= set(GATES), 'R37_ROW_NO_ADMISSION')
    need([g['id'] for g in owner['gates']] == GATES and owner['gates'] == c['gates'] and
         all(g['admitted'] is False and g['evidence'] == [] for g in owner['gates']) and
         owner['qualified_admissions'] == dict.fromkeys(ADMISSIONS, False) and
         owner['acceptanceGranted'] is False and owner['release'] == 'NO_GO' and
         p['source_validity']['status'] == 'CURRENT_FOR_PINNED_BASE_ONLY' and
         p['source_validity']['security_expiry_unchanged'] == '2026-10-21T00:00:00Z', 'R37_GATES_CLOSED')
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
        need(raw == git('show', BASE+':'+DOCS+name), 'R37_SCOPE_DOCUMENT')
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
             ref['source_commit'] == PINS[35][0] and ref['mode'] == '100644', 'R37_SCOPE_REFERENCE')
        if path in seen:
            need(ref == seen[path], 'R37_SCOPE_REFERENCE_DUPLICATE')
            continue
        seen[path] = ref
        raw = regular(ROOT/path)
        oid = hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
        need(digest(raw) == ref['sha256'] and oid == ref['blob'] and
             git('ls-tree', PINS[35][0], '--', path) == ('100644 blob '+oid+'\t'+path+'\n').encode(),
             'R37_SCOPE_REFERENCE_HASH')
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
         value['base'].get('repo', {}).get('full_name') == 'TasfiqJ/onSkin', 'R37_PR_CUSTODY')


def ci_guard(env, event, head, tree, merge, merge_tree, live, live_pr):
    expected = dict(main=MAIN, **{'pr'+str(n): p[0] for n, p in PINS.items()})
    if env.get('GITHUB_ACTIONS') != 'true':
        need(not any(k.startswith('GITHUB_') for k in env) and live == expected, 'R37_LOCAL_CONTEXT')
        return 'LOCAL_EXACT_CHECKOUT_NOT_HOSTED_CI'
    need(env.get('GITHUB_EVENT_NAME') == 'pull_request' and env.get('GITHUB_REPOSITORY') == 'TasfiqJ/onSkin' and
         type(event) is dict and event.get('repository', {}).get('full_name') == 'TasfiqJ/onSkin', 'R37_CI_KIND')
    number = event.get('number')
    need(type(number) is int and number > 39 and env.get('GITHUB_REF') == 'refs/pull/'+str(number)+'/merge', 'R37_CI_EVENT')
    for pr in (event.get('pull_request'), live_pr):
        pr_guard(pr, number, head, BRANCH, BASE, PARENT_BRANCH)
    need(re.fullmatch('[0-9a-f]{40}', env.get('GITHUB_SHA', '')) and
         merge == [env['GITHUB_SHA'], BASE, head] and merge_tree == tree, 'R37_SERVICE_TEST_MERGE')
    need(live == dict(expected, source=head), 'R37_STALE_REFS')
    return 'GENUINE_EVENT_LIVE_PR_REFS_SERVICE_TEST_MERGE'


def fetch_pr(number):
    request = urllib.request.Request('https://api.github.com/repos/TasfiqJ/onSkin/pulls/'+str(number),
        headers={'Accept': 'application/vnd.github+json', 'User-Agent': 'onSkin-current37-source-integrity'})
    with urllib.request.urlopen(request, timeout=30) as response:
        raw = response.read(1024*1024+1)
    need(len(raw) <= 1024*1024, 'R37_LIVE_PR_SIZE')
    return document(raw)


def live_refs(include_source=False):
    names = {'refs/heads/main': 'main', **{'refs/heads/'+p[2]: 'pr'+str(n) for n, p in PINS.items()}}
    if include_source:
        names['refs/heads/'+BRANCH] = 'source'
    values = {}
    for line in text('ls-remote', '--exit-code', 'origin', *names).splitlines():
        sha, name = line.split()
        need(name in names and names[name] not in values and re.fullmatch('[0-9a-f]{40}', sha), 'R37_LIVE_REFS')
        values[names[name]] = sha
    need(set(values) == set(names.values()), 'R37_LIVE_REFS')
    return values


def snapshot(head):
    check = primitives().helpers()
    tree = check.tree29(head)
    index = git('ls-files', '--stage', '-z')
    need(index == b''.join((mode+' '+oid+' 0\t'+path+'\0').encode() for path, (mode, oid) in tree.items()), 'R37_INDEX')
    need(all(line.startswith(b'H ') for line in git('ls-files', '-v', '-z').split(b'\0') if line), 'R37_INDEX_FLAGS')
    need(not git(*primitives().filter_overrides(), 'status', '--porcelain=v1', '--untracked-files=all', '-z'), 'R37_DIRTY')
    return index, check.working29_guard(tree)


def verify(phase='SOURCE_FROZEN'):
    need(not sys.flags.optimize and phase in PHASES, 'R37_PHASE')
    primitives().helpers().full29_store()
    need(text('remote', 'get-url', 'origin').removesuffix('.git') == 'https://github.com/TasfiqJ/onSkin', 'R37_ORIGIN')
    authenticate_parent()
    head, tree = text('rev-parse', 'HEAD'), text('rev-parse', 'HEAD^{tree}')
    need(len(parents(head)) == 2 and text('merge-base', BASE, head) == BASE, 'R37_SOURCE_HEAD')
    in_ci = os.environ.get('GITHUB_ACTIONS') == 'true'
    if not in_ci:
        need(text('symbolic-ref', '--short', 'HEAD') == BRANCH, 'R37_BRANCH')
    if in_ci:
        need(phase == 'SOURCE_FROZEN', 'R37_CI_REQUIRES_SEAL')
    source, seal = phase_guard(text('rev-list', '--reverse', BASE+'..'+head).splitlines(), phase)
    need(git('show', head+':'+PLAN) == git('show', PLAN_COMMIT+':'+PLAN), 'R37_PLAN_IMMUTABLE')
    task_guard(document(git('show', source+':'+TASK)), lambda path: git('show', source+':'+path))
    quality_guard(git('show', source+':.github/workflows/quality.yml'), git('show', BASE+':.github/workflows/quality.yml'))
    if seal:
        value = document(git('show', seal+':docs/phase-4/generated/source-worklist.json'))
        primitives().worklist_guard(value, source)
        need(value.get('warnings') == [], 'R37_WORKLIST_WARNINGS')
        markdown = git('show', seal+':docs/phase-4/generated/source-worklist.md')
        need(('Git SHA: '+source).encode() in markdown and b'Git status: clean' in markdown, 'R37_WORKLIST_MARKDOWN')
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
        need(path.is_absolute(), 'R37_EVENT_PATH')
        event = document(regular(path))
        number = event.get('number')
        need(type(number) is int and number > 39, 'R37_CI_EVENT')
        live_pr = fetch_pr(number)
        sha = os.environ.get('GITHUB_SHA', '')
        need(re.fullmatch('[0-9a-f]{40}', sha), 'R37_CI_SHA')
        merge, merge_tree = parents(sha), text('rev-parse', sha+'^{tree}')
    qualification = ci_guard(os.environ, event, head, tree, merge, merge_tree, live, live_pr)
    need(snapshot(head) == before and text('rev-parse', 'HEAD') == head and live_refs(in_ci) == live, 'R37_FINAL_SNAPSHOT')
    return dict(valid=True, phase=phase, head=head, tree=tree, sourceHead=source, sealedHead=seal,
        parentHead=BASE, parentTree=BASE_TREE, changedSourcePaths=sorted(SOURCE), trackedBlobsHashed=before[1],
        qualification=qualification, governance='CURRENT37_FINITE_SOURCE_ONLY', productScope=projection,
        historicalCheck='SEPARATE_FRESH_PR39_ORIGINAL36_35_34_33_32_29_REQUIRED',
        acceptanceGranted=False, admissions=dict.fromkeys(ADMISSIONS, False), release='NO_GO')


def run_readonly(args, expected=0, timeout=900):
    result = subprocess.run(args, cwd=ROOT, capture_output=True, timeout=timeout)
    need(result.returncode == expected, 'R37_READONLY_CHILD_EXIT')
    return result.stdout


def test_summary(raw, tests, passed, failed):
    lines = raw.replace(b'\r', b'').splitlines()
    for label, count in (('tests', tests), ('pass', passed), ('fail', failed), ('cancelled', 0), ('skipped', 0), ('todo', 0)):
        need(lines.count(('# '+label+' '+str(count)).encode()) == 1 and
             sum(line.startswith(('# '+label+' ').encode()) for line in lines) == 1, 'R37_TEST_INTERVAL')


def historical_python():
    # Old replay deliberately scrubs its environment again. A Windows Store
    # alias writes %SystemDrive% caches into cwd under that original scrub.
    # Use the already-installed normal interpreter; never ignore those files.
    path = Path(shutil.which('python') or sys.executable).resolve() if os.name == 'nt' else Path(sys.executable).resolve()
    need(path.is_file() and (os.name != 'nt' or 'windowsapps' not in str(path).lower()), 'R37_HISTORICAL_PYTHON')
    return str(path)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--phase', choices=PHASES, default='SOURCE_FROZEN')
    group = p.add_mutually_exclusive_group()
    group.add_argument('--historical', action='store_true')
    group.add_argument('--scope', choices=['full-app-j01-v2'])
    p.add_argument('--external-readiness', action='store_true')
    args = p.parse_args()
    try:
        need(not args.external_readiness or args.scope is not None, 'R37_EXPLICIT_SCOPE_REQUIRED')
        result = historical() if args.historical else verify(args.phase)
        if args.scope:
            result = dict(result['productScope'], head=result['head'], tree=result['tree'], phase=args.phase,
                          sourceQualification=result['qualification'])
        print(json.dumps(result, sort_keys=True))
        return 2 if args.external_readiness else 0
    except Exception as exc:
        code = str(exc)
        reason = code if re.fullmatch(r'(?:R37|R36|R35|R34|R33|R32|R29|R23)_[A-Z0-9_]{1,96}', code) else 'R37_EXECUTION_INCOMPLETE'
        print(json.dumps(dict(valid=False, error=reason, acceptanceGranted=False, release='NO_GO')))
        return 1


def authenticate_parent():
    for head, tree, _ in PINS.values():
        need(text('rev-parse', head+'^{tree}') == tree, 'R37_PARENT_TREE')
    chain = [PINS[38][0], '71540ac12cfb3111166c074e6e017dac3de7ba76',
        '223b18332c0c65498236e86afd152b8bae541840', '6417d86e14a12d428130aca5afb6a85fed90f787',
        'a4222015333e5088a9a729e4995fd2e77881a288', BASE]
    need(text('rev-list','--reverse',chain[0]+'..'+BASE).splitlines() == chain[1:], 'R37_PARENT_PHASES')
    for a,b in zip(chain,chain[1:]): need(parents(b)==[b,a], 'R37_PARENT_LINEAR')
    old_plan='docs/brain/task-specs/M1X-36/SCOPE_PLAN.md'
    need(changed(chain[0],chain[1],{old_plan})=={old_plan} and
         digest(git('show',chain[1]+':'+old_plan))=='cd5e8e1841106e10069925388b876cde0f92657c530b39982bd142d809a18e4e', 'R37_PARENT_PLAN')
    old_task='docs/brain/task-specs/M1X-36/TASK.md'
    value=document(git('show',chain[-2]+':'+old_task))
    expected={old_task,'.github/workflows/quality.yml','PROGRESS.md',DOCS+'ci-integration36.md',
        PREFIX+'main_integration36.py',PREFIX+'main_integration36.test.py',PREFIX+'source_consumer36.test.py'}
    need(changed(chain[1],chain[-2],expected)==expected and changed(chain[-2],BASE,WORKLIST)==WORKLIST,'R37_PARENT_SOURCE_SEAL')
    need(value.get('base')==chain[0] and value.get('baseTree')==PINS[38][1] and value.get('planCommit')==chain[1] and
         value.get('authority')=='BRAIN-M1X-FREE-FIRST-SESSION-CI-INTEGRITY36-SOURCE-REPAIR-01' and
         set(value.get('sourceHashes',{}))==expected-{old_task},'R37_PARENT_LEDGER')
    no_admission(value,'R37_PARENT_LEDGER')
    for name,sha in value['sourceHashes'].items():
        need(digest(git('show',chain[-2]+':'+name))==sha and git('show',chain[-2]+':'+name)==git('show',BASE+':'+name),'R37_PARENT_SOURCE_HASH')
    primitives().worklist_guard(document(git('show',BASE+':docs/phase-4/generated/source-worklist.json')),chain[-2])
    for name,sha in PROGRAMS.items():
        need(digest(regular(ROOT/PREFIX/name))==sha and digest(git('show',BASE+':'+PREFIX+name))==sha,'R37_ORIGINAL_PROGRAM')
    need(parents(PLAN_COMMIT)==[PLAN_COMMIT,BASE] and changed(BASE,PLAN_COMMIT,{PLAN})=={PLAN} and
         digest(git('show',PLAN_COMMIT+':'+PLAN))==PLAN_SHA,'R37_PLAN_FIRST')
    plan=git('show',PLAN_COMMIT+':'+PLAN).decode('utf-8')
    need(document(plan.split('```json\n')[1].split('\n```')[0].encode())==BASELINES,'R37_PLAN_BASELINES')
    need(len(BASELINES)==22 and {r['path'] for r in BASELINES}==GRANT,'R37_BASELINE_INVENTORY')
    for row in BASELINES:
        entry=git('ls-tree',BASE,'--',row['path'])
        if row['blob'] is None:
            need(entry==b'','R37_BASELINE_ABSENT')
        else:
            raw=git('show',BASE+':'+row['path'])
            need(entry==(row['mode']+' blob '+row['blob']+'\t'+row['path']+'\n').encode() and
                 len(raw)==row['bytes'] and digest(raw)==row['sha256'],'R37_BASELINE_IDENTITY')


def original36_reader():
    path=ROOT/PREFIX/'main_integration36.py'
    raw=regular(path)
    need(digest(raw)==PROGRAMS[path.name],'R37_ORIGINAL36_IDENTITY')
    namespace={'__name__':'authenticated_original36_neutral_transcript_reader_only','__file__':str(path)}
    exec(compile(raw,str(path),'exec'),namespace)
    return SimpleNamespace(**namespace)


def historical_result(raw):
    lines=[line for line in raw.replace(b'\r',b'').splitlines() if line]
    need(len(lines)==2 and lines[0].startswith(b'R36_HISTORICAL_WORKSPACE '),'R37_HISTORICAL_TRANSCRIPT')
    value=document(lines[-1]); no_admission(value,'R37_HISTORICAL_NO_ADMISSION')
    need(value.get('status')=='PASS' and value.get('historicalHead')==PINS[38][0] and
         value.get('historicalTree')==PINS[38][1] and value.get('qualification')==
         'FRESH_AUTHENTIC_PR38_35_34_33_32_29_NOT_CURRENT_OR_OWNER_ACCEPTANCE','R37_HISTORICAL_PIN')
    workspace=Path(value.get('workspace',''))
    need(workspace.is_absolute() and lines[0]==('R36_HISTORICAL_WORKSPACE '+str(workspace)).encode(),'R37_HISTORICAL_WORKSPACE')
    receipts=value.get('receipts')
    names=['clone-pr38','checkout-pr38','pin-2','pin-3','pin-4','node-version','python-runtime','normal-npm-ci','postinstall-check',
        'original35-main_integration35.test.py','original35-source_consumer35.test.py','original35-driver49',
        'original35-current-refusal','original34-cli-pr38-refusal','original34-pr38-tests-refusal','original35-authentic-historical','pin-16','pin-17']
    need(type(receipts) is list and [r.get('name') for r in receipts]==names,'R37_HISTORICAL_INTERVAL')
    root=workspace/'pr38'; python=historical_python(); node=receipts[5].get('command',[None])[0]
    need(type(node) is str and Path(node).is_absolute(),'R37_HISTORICAL_COMMAND')
    expected={
        'clone-pr38':['git','-c','core.hooksPath=','clone','--no-local','--no-hardlinks','--no-checkout','--single-branch','--branch',PINS[38][2],'-c','core.autocrlf=false','-c','core.longpaths=true','https://github.com/TasfiqJ/onSkin.git',str(root)],
        'checkout-pr38':['git','checkout',PINS[38][2]],
        'pin-2':['git','--no-replace-objects','rev-parse','HEAD'],
        'pin-3':['git','--no-replace-objects','rev-parse','HEAD^{tree}'],
        'pin-4':['git','--no-replace-objects','rev-parse','--is-shallow-repository'],
        'node-version':[node,'--version'],
        'python-runtime':[python,'-I','-B','-c','import json,sys;print(json.dumps(list(sys.version_info[:3])))'],
        'postinstall-check':[node,'scripts/postinstall.mjs','--check'],
        'original35-main_integration35.test.py':[python,'-I','-B',PREFIX+'main_integration35.test.py'],
        'original35-source_consumer35.test.py':[python,'-I','-B',PREFIX+'source_consumer35.test.py'],
        'original35-driver49':[node,'--test','scripts/e2e/onboarding-first-session35.test.mjs','scripts/e2e/retained-safety-assertions.test.mjs'],
        'original35-current-refusal':[python,'-I','-B',PREFIX+'main_integration35.py'],
        'original34-cli-pr38-refusal':[node,'scripts/launch/candidate-scope34.mjs','--mode','verification'],
        'original34-pr38-tests-refusal':[node,'--test','scripts/launch/candidate-scope34.test.mjs','scripts/launch/consumer-entry34.test.mjs'],
        'original35-authentic-historical':[python,'-I','-B',PREFIX+'main_integration35.py','--historical'],
        'pin-16':['git','--no-replace-objects','status','--porcelain=v1','--untracked-files=all'],
        'pin-17':['git','--no-replace-objects','rev-parse','HEAD']}
    failures={'original35-current-refusal','original34-cli-pr38-refusal','original34-pr38-tests-refusal'}
    for row in receipts:
        name=row['name']; code=1 if name in failures else 0
        need(type(row.get('exit')) is int and row['exit']==row.get('expectedExit')==code and row.get('timedOut') is False,'R37_HISTORICAL_CHILD')
        log=workspace/'logs'/(name+'.log')
        need(row.get('log')==str(log),'R37_HISTORICAL_LOG_PATH')
        body=regular(log,8*1024*1024)
        need(len(body)==row.get('bytes') and digest(body)==row.get('sha256'),'R37_HISTORICAL_LOG_HASH')
        command=row.get('command')
        if name=='normal-npm-ci':
            need(type(command) is list and len(command)==6 and command[0]==node and Path(command[1]).is_absolute() and
                 Path(command[1]).name=='npm-cli.js' and command[2:]==['ci','--ignore-scripts=false','--no-audit','--no-fund'],'R37_HISTORICAL_COMMAND')
        else: need(command==expected[name],'R37_HISTORICAL_COMMAND')
        if name=='original35-driver49': test_summary(body,49,49,0)
        if name=='original34-pr38-tests-refusal': test_summary(body,31,2,29)
        if name=='original35-authentic-historical':
            need(original36_reader().historical_result(body)==value.get('original35Historical'),'R37_NESTED_ACTUAL_TRANSCRIPT')
    need(value.get('original35CurrentRefusal')==dict(valid=False,error='R32_CHILD_EXIT',acceptanceGranted=False,release='NO_GO') and
         value.get('original34PR38Refusal')==dict(valid=False,error='R34_SOURCE_INTERVAL',acceptanceGranted=False,release='NO_GO'),'R37_HISTORICAL_REFUSALS')
    return value


def historical():
    """Fresh normal named36 checkout; never transplant an old approval onto current37."""
    authenticate_parent(); start=text('rev-parse','HEAD')
    env=primitives().clean_environment(); python=historical_python()
    workspace=Path(tempfile.mkdtemp(prefix='integration37-')).resolve()
    need(not workspace.is_relative_to(ROOT),'R37_EXTERNAL_CLONE')
    root=workspace/'pr39'; logs=workspace/'logs'; logs.mkdir()
    print('R37_HISTORICAL_WORKSPACE '+str(workspace),file=sys.stderr,flush=True)
    receipts=[]
    def run(name,args,cwd=root,expected=0,timeout=1800):
        log=logs/(name+'.log'); started=time.monotonic(); timed_out=False
        with log.open('wb') as output:
            process=subprocess.Popen(args,cwd=cwd,env=env,stdout=output,stderr=subprocess.STDOUT)
            try: process.wait(timeout=timeout)
            except subprocess.TimeoutExpired: process.kill(); process.wait(); timed_out=True
        raw=log.read_bytes()
        receipts.append(dict(name=name,command=args,exit=process.returncode,expectedExit=expected,seconds=round(time.monotonic()-started,3),
            timedOut=timed_out,bytes=len(raw),sha256=digest(raw),log=str(log),historicalHead=BASE,historicalTree=BASE_TREE))
        (logs/'receipts.json').write_text(json.dumps(receipts,indent=2)+'\n',encoding='utf-8')
        need(not timed_out and len(raw)<=8*1024*1024,'R37_HISTORICAL_TIMEOUT_OR_OUTPUT')
        need(process.returncode==expected,'R37_HISTORICAL_CHILD_EXIT')
        return raw
    run('clone-pr39',['git','clone','--no-local','--no-hardlinks','--no-checkout','--single-branch','--branch',PARENT_BRANCH,
        '-c','core.autocrlf=false','-c','core.longpaths=true','https://github.com/TasfiqJ/onSkin.git',str(root)],workspace)
    run('checkout-named36',['git','checkout',PARENT_BRANCH])
    def pinned(*args): return subprocess.check_output(['git','--no-replace-objects',*args],cwd=root,env=env).decode().strip()
    need(pinned('rev-parse','HEAD')==BASE and pinned('rev-parse','HEAD^{tree}')==BASE_TREE and pinned('rev-parse','--is-shallow-repository')=='false','R37_HISTORICAL_PIN')
    for name,sha in PROGRAMS.items(): need(digest(regular(root/PREFIX/name))==sha,'R37_HISTORICAL_PROGRAM')
    node=Path(shutil.which('node')).resolve()
    candidates=[node.parent/'node_modules/npm/bin/npm-cli.js'] if os.name=='nt' else [node.parent.parent/'lib/node_modules/npm/bin/npm-cli.js']
    if env.get('APPDATA'): candidates.insert(0,Path(env['APPDATA'])/'npm/node_modules/npm/bin/npm-cli.js')
    config=workspace/'empty.npmrc'; config.write_bytes(b''); env.update(npm_config_userconfig=os.devnull,npm_config_globalconfig=str(config))
    need(run('node-version',[str(node),'--version']).strip()==b'v22.21.0','R37_RUNTIME')
    npm=next((p for p in candidates if p.is_file() and subprocess.check_output([str(node),str(p),'--version'],env=env).strip()==b'11.20.0'),None)
    need(npm is not None,'R37_RUNTIME')
    run('normal-npm-ci',[str(node),str(npm),'ci','--ignore-scripts=false','--no-audit','--no-fund'])
    run('postinstall-check',[str(node),'scripts/postinstall.mjs','--check'])
    for name in ('main_integration36.test.py','source_consumer36.test.py'):
        run('original36-'+name,[python,'-I','-B',PREFIX+name])
    verdict=document(run('original36-exact-source',[python,'-I','-B',PREFIX+'main_integration36.py']))
    need(verdict.get('valid') is True and verdict.get('head')==BASE and verdict.get('tree')==BASE_TREE and
         verdict.get('governance')=='CURRENT36_FINITE_SOURCE_ONLY' and verdict.get('qualification')=='LOCAL_EXACT_CHECKOUT_NOT_HOSTED_CI','R37_ORIGINAL36_VERDICT')
    no_admission(verdict,'R37_ORIGINAL36_NO_ADMISSION')
    nested=historical_result(run('original36-authentic-historical',[python,'-I','-B',PREFIX+'main_integration36.py','--historical'],timeout=7200))
    need(pinned('status','--porcelain=v1','--untracked-files=all')=='' and pinned('rev-parse','HEAD')==BASE and text('rev-parse','HEAD')==start,'R37_HISTORICAL_CHANGED')
    return dict(status='PASS',historicalHead=BASE,historicalTree=BASE_TREE,original36=verdict,original36Historical=nested,
        receipts=receipts,workspace=str(workspace),qualification='FRESH_AUTHENTIC_PR39_36_35_34_33_32_29_NOT_CURRENT_OR_OWNER_ACCEPTANCE',
        acceptanceGranted=False,admissions=dict.fromkeys(ADMISSIONS,False),release='NO_GO')


if __name__ == '__main__':
    sys.exit(main())
