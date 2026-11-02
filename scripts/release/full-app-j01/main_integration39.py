"""Exact Campaign39 inventory synchronization; source integrity never grants admission."""
import argparse, hashlib, json, os, re, shutil, stat, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path
from types import SimpleNamespace
ROOT = Path(__file__).resolve().parents[3]
BASE = '92f62f60e47237dd1f06750d8f7d9d2006b82617'
BASE_TREE = 'aea947d237d49cfcdad72ced54213b1f3a6ddf4e'
MAIN = '53a84d921d14dbff1d2e9b8f1b3bb27e10dcede6'
BRANCH = 'stage/m1-formula-route-inventory39'
PARENT_BRANCH = 'stage/m1-owned-formula-version38'
PLAN_COMMIT = '317a1c29ad2bd6dddd601317bbd317654bb9ed11'
PLAN = 'docs/brain/task-specs/M1X-39/SCOPE_PLAN.md'
PLAN_SHA = '1aee05427968151eddd96d6d59546ade5ef2def324d16765e0f23be3cc59947f'
TASK = 'docs/brain/task-specs/M1X-39/TASK.md'
PREFIX = 'scripts/release/full-app-j01/'
DOCS = 'docs/release/full-app-j01/'
AUTHORITY = 'BRAIN-M1X-MASTERV2-FORMULA-ROUTE-INVENTORY39-CORRECTION-01'
PINS = {40: ('530da5d8af8c3b74a1675a4cfdffc03dca2ec9c1', '034cd0b1708362f377a88dbef24e6fe0ddfbd1e3', 'stage/m1-compact-shelf-first-session37'), 39: ('1f4014f80402176ad2a208154d4da03db711ae5f', 'bc859097ad3c8273cf341802474c28a5b13a1d43', 'stage/m1-free-first-session-ci36'), 38: ('4c98bed778c1044b95cbb29fcaac06802fa398c1', '3296835a6cd05c60a6dfff6aa2aa3e1e817ed597', 'stage/m1-free-first-session-e2e35'), 37: ('7dea6048e5f1f5e397656b5f2fa670929fa9c2b8', '49b0baf1f20ca3d092db5d3cb14156feb2963f61', 'stage/m1-fullapp-dual-scope-readers34'), 36: ('4ca36e915608460a1ed97d7fff94a3ece61296ab', '49945b4e453b4fc30ceb175f330c8b4b924afe31', 'stage/m1-fullapp-j01-scope-cutover33'), 35: ('cbbb5a83bd29d2833399c214f5b6c6dd14873d24', '0745ad5f5595724a9b26de64324065dc3e53d2ea', 'stage/m1-main-quality-governance32'), 41: ('92f62f60e47237dd1f06750d8f7d9d2006b82617', 'aea947d237d49cfcdad72ced54213b1f3a6ddf4e', 'stage/m1-owned-formula-version38')}
PROGRAMS = {'main_integration32.py': '5b48f78917aaf39e4da66138e3d5c52654af7defd1eaf37ab6404fdc631ceda4', 'check.py': '944c04283b834e5f20bdfcbf95c265c7af57f8f4754952b4353dee5f8d8952dd', 'main_integration33.py': '1176d7fa42f23ecde717ac4c9a96e5eb855774ac4e3bc2813f970a4004065616', 'main_integration34.py': '342e21de512e4e3bf6dffb5e3ad9b86b6b47c9c30f9815d219cd0ab868858fdb', 'main_integration35.py': '1418a7a04a9e91585bc7723a21a6455d86c6e28a1744ff09342275789771f32c', 'main_integration36.py': 'ccb5e6f668911fb54cbed496014ebd5123ec115d52d2ebd8e19b9faf89e0b448', 'main_integration36.test.py': '0507dc44e154bff8ca0fe87cb85694c6d84ff19dc780f7ca332fb8e0dab2433d', 'source_consumer36.test.py': '34c195fc9585373d3c3ef2bf43ce86d03d12dd230f95ad23648a8f69119fe219', 'main_integration37.py': '9c877b73d9db5515cf8319fe75e1d0924685a9f29c7fa121f988daeb33a2edf6', 'main_integration37.test.py': '9da5c9f99095ec8ba67800e94071221fabc82a012fcc08e127d6d92532bcc653', 'source_consumer37.test.py': 'e4de41cd5fc4d500e8214e1906d322cf88d5ddb05af52ed894096a92d1a433bb', 'main_integration38.py': 'e54d1a467d9db6fb87a4a7f4f29bb1dd06d7167c6de851ec285d30476c1d5f74', 'main_integration38.test.py': 'df3e3edea886fdaadf7706c0633e031decbb47f4a4ba4496ed90142b595727d8', 'source_consumer38.test.py': '04d7777e2a12d519b3a610d04333c439027c6bd47608bb9a3affa67c09c98f91'}
NEW_STEP = '      - name: Verify current39 exact route inventory and separately pinned38/37/36/35/34/33/32/29\n        env:\n          GH_TOKEN: ${{ github.token }}\n        run: |\n          set -euo pipefail\n          phase="${C39_PREFLIGHT_PHASE:-SOURCE_FROZEN}"\n          if [ "${GITHUB_EVENT_NAME:-}" = pull_request ]; then\n            git fetch --no-tags origin "$GITHUB_REF"\n            test "$(git rev-parse FETCH_HEAD)" = "$GITHUB_SHA"\n          fi\n          python3 -I -B scripts/release/full-app-j01/main_integration39.test.py\n          python3 -I -B scripts/release/full-app-j01/source_consumer39.test.py\n          node --test scripts/launch/formula-route-inventory39.test.mjs\n          node --test scripts/e2e/onboarding-first-session35.test.mjs scripts/e2e/retained-safety-assertions.test.mjs scripts/e2e/compact-shelf-target37.test.mjs scripts/e2e/owned-bottle-formula38.test.mjs\n          python3 -I -B scripts/release/full-app-j01/main_integration39.py --phase "$phase"\n          python3 -I -B scripts/release/full-app-j01/main_integration39.py --phase "$phase" --scope full-app-j01-v2\n          if python3 -I -B scripts/release/full-app-j01/main_integration39.py --phase "$phase" --scope full-app-j01-v2 --external-readiness; then\n            echo \'External readiness must remain refused\' >&2\n            exit 1\n          else\n            test "$?" = 2\n          fi\n          node scripts/launch/check-contract.mjs\n          python3 -I -B scripts/release/full-app-j01/main_integration39.py --historical\n          node scripts/docs/source-packet-supersession09.test.mjs\n\n'
GRANT = {'.github/workflows/quality.yml', 'scripts/release/full-app-j01/source_consumer39.test.py', 'docs/phase-4/generated/source-worklist.json', 'docs/brain/task-specs/M1X-39/TASK.md', 'PROGRESS.md', 'docs/brain/task-specs/M1X-39/SCOPE_PLAN.md', 'scripts/launch/formula-route-inventory39.test.mjs', 'scripts/release/full-app-j01/main_integration39.test.py', 'docs/phase-4/generated/source-worklist.md', 'scripts/release/full-app-j01/main_integration39.py', 'docs/hugeToDo/feature-inventory.json', 'docs/release/full-app-j01/formula-route-inventory39.md'}
BASELINES = [{'path': '.github/workflows/quality.yml', 'mode': '100644', 'blob': '0f19a1f6b6ce9ecccede609a5a0cb1dda6bbf4b1', 'sha256': '9a5cd3e37819f5c56a31d347259e8980dbc2c714f2ec2827c7513a5ac3f9c317', 'bytes': 14930}, {'path': 'PROGRESS.md', 'mode': '100644', 'blob': '0ff9ebab9d006d46850b63db3890b91544d23261', 'sha256': '922a3aa0f56fd044b4457de79b07ac70dccf9d233fa29ba8461930585dae16e2', 'bytes': 553423}, {'path': 'docs/brain/task-specs/M1X-39/SCOPE_PLAN.md', 'mode': None, 'blob': None, 'sha256': None, 'bytes': None}, {'path': 'docs/brain/task-specs/M1X-39/TASK.md', 'mode': None, 'blob': None, 'sha256': None, 'bytes': None}, {'path': 'docs/hugeToDo/feature-inventory.json', 'mode': '100644', 'blob': '45f5ff54f3849c55340530c223e62b440fec2dae', 'sha256': '620d798e86c2fd0f8adb810cac1b11eaa3a1d9551f14db474454bb49f6148178', 'bytes': 94713}, {'path': 'docs/phase-4/generated/source-worklist.json', 'mode': '100644', 'blob': '2e4734aeecdd3618c37afe63fbdd843d8d649e7e', 'sha256': '76a275c6447ab54194a62682cb96cb2a901505a7f8e42258948f772952f1124b', 'bytes': 142034}, {'path': 'docs/phase-4/generated/source-worklist.md', 'mode': '100644', 'blob': 'eb833ce31308f25057f25221f91f574f9b9ca389', 'sha256': '3f57eb2efe6d2ec8af5d102ae80d9ce8dbcb329979aaa30fd609e38e6a2cc51a', 'bytes': 84773}, {'path': 'docs/release/full-app-j01/formula-route-inventory39.md', 'mode': None, 'blob': None, 'sha256': None, 'bytes': None}, {'path': 'scripts/launch/formula-route-inventory39.test.mjs', 'mode': None, 'blob': None, 'sha256': None, 'bytes': None}, {'path': 'scripts/release/full-app-j01/main_integration39.py', 'mode': None, 'blob': None, 'sha256': None, 'bytes': None}, {'path': 'scripts/release/full-app-j01/main_integration39.test.py', 'mode': None, 'blob': None, 'sha256': None, 'bytes': None}, {'path': 'scripts/release/full-app-j01/source_consumer39.test.py', 'mode': None, 'blob': None, 'sha256': None, 'bytes': None}]
WORKLIST = {'docs/phase-4/generated/source-worklist.md', 'docs/phase-4/generated/source-worklist.json'}
ADMISSIONS = ['DB06', 'DB08', 'R2B', 'M103', 'M2', 'NATIVE', 'J01', 'CLINICAL', 'PROVIDER', 'PAID', 'APPLE', 'PUBLIC', 'G97']
REQUIRED = ['F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F08', 'F09', 'F10', 'F11', 'F12', 'F13', 'F14', 'F15', 'F16', 'F17', 'F19', 'F20', 'V2-C01', 'V2-C02', 'V2-C03', 'V2-C04', 'V2-C05', 'V2-C06', 'V2-C07', 'V2-C08', 'V2-C09', 'V2-C10', 'V2-C11', 'V2-C12', 'P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'J01']
DEFERRED = ['F18', 'J02', 'J03', 'J04', 'J05', 'J06', 'J07', 'J08', 'J09', 'J10', 'J11', 'J12', 'J13', 'J14', 'J15', 'J16', 'J17', 'J18', 'J19', 'J20', 'J21', 'J22', 'J23', 'J24', 'J25', 'J26', 'J27']
GATES = ['G97', 'DB', 'M1-03', 'M2-01', 'G1', 'G2', 'G3', 'G4', 'G5', 'RIGHTS', 'CLINICAL', 'PROVIDER', 'PAYMENT', 'MODERATION', 'OPERATIONS', 'DEVICE', 'APPLE', 'PUBLIC']
PHASES = ('SOURCE_PENDING', 'SOURCE_FROZEN')
INVENTORY = 'docs/hugeToDo/feature-inventory.json'
ORIGINAL_INVENTORY_SHA = '620d798e86c2fd0f8adb810cac1b11eaa3a1d9551f14db474454bb49f6148178'
EXPECTED_INVENTORY_SHA = '166193bb73f389565aa141848546ee56e6f76967c0fdee3086dcc935772cf8a3'
ROUTE = {'id': 'route:shelf/formula-history.tsx', 'category': 'route', 'source': 'apps/mobile/src/app/shelf/formula-history.tsx', 'featureIds': ['F-03', 'F-04'], 'readiness': 'needs-device-verification'}
SOURCE = GRANT - WORKLIST - {PLAN}
ESSENTIAL = SOURCE
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
             not getattr(info, 'st_file_attributes', 0) & 1024, 'R39_REGULAR_PARENT')
    before = path.lstat()
    need(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and not path.is_symlink() and
         not getattr(before, 'st_file_attributes', 0) & 1024 and before.st_size <= limit,
         'R39_REGULAR_FILE')
    raw = path.read_bytes()
    after = path.lstat()
    need((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns) ==
         (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns), 'R39_CHANGED_READ')
    return raw

def primitives():
    """Only neutral32 Git/delta/JSON/raw-reader operations; never its verify()."""
    global H
    for name in ('main_integration32.py', 'check.py'):
        need(digest(regular(ROOT/PREFIX/name)) == PROGRAMS[name], 'R39_NEUTRAL_PREIMAGE')
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

def phase_guard(commits, phase, source_paths=None):
    allowed = SOURCE if source_paths is None else set(source_paths)
    need(allowed <= SOURCE and phase in PHASES and 2 <= len(commits) <= 32 and
         len(set(commits)) == len(commits) and commits[0] == PLAN_COMMIT, 'R39_HISTORY_PHASES')
    source_commits = commits[1:] if phase == 'SOURCE_PENDING' else commits[1:-1]
    need(source_commits, 'R39_SOURCE_REQUIRED')
    previous, union = PLAN_COMMIT, set()
    for current in source_commits:
        need(parents(current) == [current, previous], 'R39_LINEAR_HISTORY')
        paths = changed(previous, current, allowed)
        need(paths, 'R39_EMPTY_SOURCE')
        union.update(paths)
        previous = current
    need(union == allowed and changed(BASE, previous, allowed|{PLAN}) == allowed|{PLAN}, 'R39_EXACT_SOURCE')
    seal = None
    if phase == 'SOURCE_FROZEN':
        seal = commits[-1]
        need(parents(seal) == [seal, previous] and changed(previous, seal, WORKLIST) == WORKLIST,
             'R39_SOLE_FINAL_SEAL')
    return previous, seal

def task_guard(value, read_body):
    need(type(value) is dict and set(value) == {'schema', 'authority', 'base', 'baseTree', 'planCommit',
         'sourceHashes', 'commands', 'acceptanceGranted', 'admissions', 'release', 'qualification'}, 'R39_TASK_SCHEMA')
    need(type(value['schema']) is int and value['schema'] == 1 and value['authority'] == AUTHORITY and
         value['base'] == BASE and value['baseTree'] == BASE_TREE and value['planCommit'] == PLAN_COMMIT and
         value['qualification'] == 'SOURCE_INTEGRITY_NOT_QUALIFIED_ACCEPTANCE', 'R39_TASK_AUTHORITY')
    no_admission(value, 'R39_NO_ADMISSION')
    hashes = value['sourceHashes']
    need(type(hashes) is dict and ESSENTIAL-{TASK} <= set(hashes) <= SOURCE-{TASK}, 'R39_HASH_INVENTORY')
    for path, sha in hashes.items():
        need(type(sha) is str and re.fullmatch('[0-9a-f]{64}', sha) and digest(read_body(path)) == sha,
             'R39_SOURCE_HASH')
    need(type(value['commands']) is list and value['commands'], 'R39_COMMAND_LEDGER')
    for row in value['commands']:
        need(type(row) is dict and set(row) == {'command', 'exit', 'qualification', 'logSha256'}, 'R39_COMMAND_LEDGER')
        command = row['command']
        need((type(command) is str and command.strip() or type(command) is list and command and
             all(type(v) is str and v for v in command)) and
             (row['exit'] is None or type(row['exit']) is int) and
             type(row['qualification']) is str and bool(row['qualification']) and
             (row['logSha256'] is None or type(row['logSha256']) is str and
              re.fullmatch('[0-9a-f]{64}', row['logSha256'])), 'R39_COMMAND_LEDGER')
    return set(hashes)|{TASK}

def scope_guard(bundle):
    need(set(bundle) == {'contract.v2.json', 'matrix.v2.json', 'precedence.v2.json', 'roadmap.v2.json',
         'owner-ledger33.v1.json'}, 'R39_SCOPE_INVENTORY')
    c, m, p, owner = [bundle[n] for n in ('contract.v2.json', 'matrix.v2.json', 'precedence.v2.json', 'owner-ledger33.v1.json')]
    need(c['schema_version'] == 2 and c['contract_id'] == 'onskin-full-app-j01-campaign33-v2' and
         c['required_f']+c['required_c']+c['required_p']+c['korean_candidates'] == REQUIRED and
         c['deferred_f']+c['deferred_j'] == DEFERRED and c['release_status'] == 'NO_GO' and
         all(c[k] is False for k in ('acceptanceGranted', 'candidateReady', 'productReady',
             'providerReady', 'paidReady', 'professionalReady', 'j01Qualified')), 'R39_SCOPE_NO_ADMISSION')
    ids = [f'F{i:02}' for i in range(1,21)]+[f'V2-C{i:02}' for i in range(1,13)]+[f'P{i:02}' for i in range(1,7)]+[f'J{i:02}' for i in range(1,28)]
    need(type(m['rows']) is list and [r.get('id') for r in m['rows']] == ids and
         (m['row_count'], m['required_count'], m['deferred_count']) == (65, 38, 27) and
         m['acceptanceGranted'] is False and m['release'] == 'NO_GO', 'R39_SCOPE_ROWS')
    for row in m['rows']:
        need(all(row[k] is False for k in ('complete', 'positive_output_enabled', 'owner_admitted')) and
             row['gates'] and len(set(row['gates'])) == len(row['gates']) and
             set(row['gates']) <= set(GATES), 'R39_ROW_NO_ADMISSION')
    need([g['id'] for g in owner['gates']] == GATES and owner['gates'] == c['gates'] and
         all(g['admitted'] is False and g['evidence'] == [] for g in owner['gates']) and
         owner['qualified_admissions'] == dict.fromkeys(ADMISSIONS, False) and
         owner['acceptanceGranted'] is False and owner['release'] == 'NO_GO' and
         p['source_validity']['status'] == 'CURRENT_FOR_PINNED_BASE_ONLY' and
         p['source_validity']['security_expiry_unchanged'] == '2026-10-21T00:00:00Z', 'R39_GATES_CLOSED')
    return dict(valid=True, scope='full-app-j01-v2', contract=c['contract_id'], requiredRows=38,
        deferredRows=27, totalRows=65, requiredIds=REQUIRED, deferredIds=DEFERRED,
        obligations=[dict(id=r['id'], complete=False, ownerAdmitted=False, positiveOutputEnabled=False,
            gates=r['gates']) for r in m['rows']], unadmittedGates=GATES,
        assessedHead=c['source_base'], assessedTree=c['source_base_tree'], assessmentRenewed=False,
        qualification='AUTHENTICATED_UNCHANGED_HISTORICAL_SCOPE_NOT_OWNER_ACCEPTANCE',
        externalReady=False, candidateReady=False, acceptanceGranted=False, release='NO_GO')

def pr_guard(value, number, head, branch, base, base_branch):
    need(type(value) is dict and type(value.get('number')) is int and value['number'] == number and
         value.get('state') == 'open' and value.get('draft') is True and value.get('merged') is False and
         value.get('merged_at') is None and value.get('closed_at') is None and
         value.get('maintainer_can_modify') is False and 'auto_merge' in value and value['auto_merge'] is None and
         value.get('head', {}).get('sha') == head and value['head'].get('ref') == branch and
         value['head'].get('repo', {}).get('full_name') == 'TasfiqJ/onSkin' and
         value.get('base', {}).get('sha') == base and value['base'].get('ref') == base_branch and
         value['base'].get('repo', {}).get('full_name') == 'TasfiqJ/onSkin', 'R39_PR_CUSTODY')

def ci_guard(env, event, head, tree, merge, merge_tree, live, live_pr):
    expected = dict(main=MAIN, **{'pr'+str(n): p[0] for n, p in PINS.items()})
    if env.get('GITHUB_ACTIONS') != 'true':
        need(not any(k.startswith('GITHUB_') for k in env) and live == expected, 'R39_LOCAL_CONTEXT')
        return 'LOCAL_EXACT_CHECKOUT_NOT_HOSTED_CI'
    need(env.get('GITHUB_EVENT_NAME') == 'pull_request' and env.get('GITHUB_REPOSITORY') == 'TasfiqJ/onSkin' and
         type(event) is dict and event.get('repository', {}).get('full_name') == 'TasfiqJ/onSkin', 'R39_CI_KIND')
    number = event.get('number')
    need(type(number) is int and number > 41 and env.get('GITHUB_REF') == 'refs/pull/'+str(number)+'/merge', 'R39_CI_EVENT')
    for pr in (event.get('pull_request'), live_pr):
        pr_guard(pr, number, head, BRANCH, BASE, PARENT_BRANCH)
    need(re.fullmatch('[0-9a-f]{40}', env.get('GITHUB_SHA', '')) and
         merge == [env['GITHUB_SHA'], BASE, head] and merge_tree == tree and
         live_pr.get('merge_commit_sha') == env['GITHUB_SHA'], 'R39_SERVICE_TEST_MERGE')
    need(live == dict(expected, source=head), 'R39_STALE_REFS')
    return 'GENUINE_EVENT_LIVE_PR_REFS_SERVICE_TEST_MERGE'

def github_headers(env):
    headers={'Accept':'application/vnd.github+json','User-Agent':'onSkin-current39-source-integrity'}
    if env.get('GITHUB_ACTIONS') == 'true':
        token=env.get('GH_TOKEN','')
        need(type(token) is str and 20 <= len(token) <= 4096 and not any(c.isspace() for c in token),
             'R39_CI_READ_TOKEN')
        headers['Authorization']='Bearer '+token
    return headers

def fetch_pr(number):
    request = urllib.request.Request('https://api.github.com/repos/TasfiqJ/onSkin/pulls/'+str(number),
        headers=github_headers(os.environ))
    with urllib.request.urlopen(request, timeout=30) as response:
        raw = response.read(1024*1024+1)
    need(len(raw) <= 1024*1024, 'R39_LIVE_PR_SIZE')
    return document(raw)

def live_refs(include_source=False):
    names = {'refs/heads/main': 'main', **{'refs/heads/'+p[2]: 'pr'+str(n) for n, p in PINS.items()}}
    if include_source:
        names['refs/heads/'+BRANCH] = 'source'
    values = {}
    for line in text('ls-remote', '--exit-code', 'origin', *names).splitlines():
        sha, name = line.split()
        need(name in names and names[name] not in values and re.fullmatch('[0-9a-f]{40}', sha), 'R39_LIVE_REFS')
        values[names[name]] = sha
    need(set(values) == set(names.values()), 'R39_LIVE_REFS')
    return values

def service_merge_ref_guard(raw, ref, sha):
    need(type(ref) is str and re.fullmatch(r'refs/pull/[1-9][0-9]*/merge', ref) and
         type(sha) is str and re.fullmatch('[0-9a-f]{40}', sha) and
         raw == (sha+'\t'+ref+'\n').encode(), 'R39_SERVICE_MERGE_REF')

def snapshot(head):
    check = primitives().helpers()
    tree = check.tree29(head)
    index = git('ls-files', '--stage', '-z')
    need(index == b''.join((mode+' '+oid+' 0\t'+path+'\0').encode() for path, (mode, oid) in tree.items()), 'R39_INDEX')
    need(all(line.startswith(b'H ') for line in git('ls-files', '-v', '-z').split(b'\0') if line), 'R39_INDEX_FLAGS')
    need(not git(*primitives().filter_overrides(), 'status', '--porcelain=v1', '--untracked-files=all', '-z'), 'R39_DIRTY')
    return index, check.working29_guard(tree)

def run_readonly(args, expected=0, timeout=900):
    result = subprocess.run(args, cwd=ROOT, capture_output=True, timeout=timeout)
    need(result.returncode == expected, 'R39_READONLY_CHILD_EXIT')
    return result.stdout

def test_summary(raw, tests, passed, failed):
    lines = raw.replace(b'\r', b'').splitlines()
    for label, count in (('tests', tests), ('pass', passed), ('fail', failed), ('cancelled', 0), ('skipped', 0), ('todo', 0)):
        need(lines.count(('# '+label+' '+str(count)).encode()) == 1 and
             sum(line.startswith(('# '+label+' ').encode()) for line in lines) == 1, 'R39_TEST_INTERVAL')

def historical_python():
    # Old replay deliberately scrubs its environment again. A Windows Store
    # alias writes %SystemDrive% caches into cwd under that original scrub.
    # Use the already-installed normal interpreter; never ignore those files.
    path = Path(shutil.which('python') or sys.executable).resolve() if os.name == 'nt' else Path(sys.executable).resolve()
    need(path.is_file() and (os.name != 'nt' or 'windowsapps' not in str(path).lower()), 'R39_HISTORICAL_PYTHON')
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
        need(not args.external_readiness or args.scope is not None, 'R39_EXPLICIT_SCOPE_REQUIRED')
        result = historical() if args.historical else verify(args.phase)
        if args.scope:
            result = dict(result['productScope'], head=result['head'], tree=result['tree'], phase=args.phase,
                          sourceQualification=result['qualification'])
        print(json.dumps(result, sort_keys=True))
        return 2 if args.external_readiness else 0
    except Exception as exc:
        code = str(exc)
        reason = code if re.fullmatch(r'(?:R39|R38|R37|R36|R35|R34|R33|R32|R29|R23)_[A-Z0-9_]{1,96}', code) else 'R39_EXECUTION_INCOMPLETE'
        print(json.dumps(dict(valid=False, error=reason, acceptanceGranted=False, release='NO_GO')))
        return 1

def plan_baselines(raw):
    rows = re.findall(r'^\| ([^|]+) \| (ABSENT|100644) \| (ABSENT|[0-9a-f]{40}) \| (ABSENT|[0-9a-f]{64}) \|$', raw.decode('utf-8'), re.MULTILINE)
    return [dict(path=p, mode=None if mode=='ABSENT' else mode,
                 blob=None if blob=='ABSENT' else blob, sha256=None if sha=='ABSENT' else sha)
            for p,mode,blob,sha in rows]


def quality_guard(raw, before):
    start = b'      - name: Verify current38 local bottle history and separately pinned37/36/35/34/33/32/29\n'
    stop = b'      - name: Verify tooling security backports\n'
    need(before.count(start) == before.count(stop) == 1, 'R39_QUALITY_PARENT')
    prefix, remainder = before.split(start)
    _, suffix = remainder.split(stop)
    need(raw == prefix+NEW_STEP.encode()+stop+suffix, 'R39_QUALITY_ONLY_FIRST_STEP')


def inventory_guard(raw, original_raw):
    """The entire original object must survive the one exact canonical route addition."""
    original, current = document(original_raw), document(raw)
    need(digest(original_raw) == ORIGINAL_INVENTORY_SHA and digest(raw) == EXPECTED_INVENTORY_SHA,
         'R39_INVENTORY_HASH')
    need(type(original) is dict and type(current) is dict and
         type(original.get('categoryCounts', {}).get('route')) is int and
         original['categoryCounts']['route'] == 93 and
         type(current.get('categoryCounts', {}).get('route')) is int and
         current['categoryCounts']['route'] == 94 and type(current.get('items')) is list,
         'R39_INVENTORY_COUNT')
    rows = [row for row in current['items'] if type(row) is dict and row.get('id') == ROUTE['id']]
    need(rows == [ROUTE] and not any(row.get('id') == ROUTE['id'] for row in original['items']),
         'R39_INVENTORY_ROUTE')
    projected = dict(current, categoryCounts=dict(current['categoryCounts'], route=93),
                     items=[row for row in current['items'] if row.get('id') != ROUTE['id']])
    need(projected == original, 'R39_INVENTORY_PROJECTION')
    return dict(originalSHA256=digest(original_raw), currentSHA256=digest(raw),
                originalRouteCount=93, currentRouteCount=94, addedRow=ROUTE,
                everyOtherMemberUnchanged=True, readiness='needs-device-verification')


def baseline_guard():
    # The unchanged writing producer normally writes only inventory and graph.
    # Reset-status is an explicit extra mode and must not replace recorded progress.
    module = './scripts/launch/execution-baseline.mjs'
    code = ("import {buildFeatureInventory,buildTaskGraph,buildExecutionStatus,stableJson} from '"+module+"';"
            "console.log(JSON.stringify({inventory:await stableJson(buildFeatureInventory()),"
            "graph:await stableJson(buildTaskGraph()),resetStatus:await stableJson(buildExecutionStatus())}));")
    outputs = document(run_readonly(['node', '--input-type=module', '-e', code]))
    need(type(outputs) is dict and set(outputs) == {'inventory','graph','resetStatus'} and
         all(type(value) is str for value in outputs.values()), 'R39_BASELINE_OUTPUTS')
    original = git('show', BASE+':'+INVENTORY)
    actual = regular(ROOT/INVENTORY)
    projection = inventory_guard(actual, original)
    need(outputs['inventory'].encode() == actual, 'R39_CANONICAL_INVENTORY')
    graph_path = 'docs/hugeToDo/task-graph.json'
    need(outputs['graph'].encode() == regular(ROOT/graph_path) == git('show',BASE+':'+graph_path),
         'R39_OTHER_BASELINE_CHANGED')
    preserved = {}
    for path in ('launch-contract.json','execution-status.json','credential-inventory.json',
                 'evidence-governance.json','worktree-boundary.json'):
        name='docs/hugeToDo/'+path
        raw=regular(ROOT/name)
        need(raw == git('show',BASE+':'+name), 'R39_OTHER_BASELINE_CHANGED')
        preserved[name]=digest(raw)
    projection.update(taskGraphSHA256=digest(outputs['graph'].encode()), preserved=preserved,
                      resetOnlyStatusProjectionSHA256=digest(outputs['resetStatus'].encode()),
                      resetStatusApplied=False, writingProducerRun=False)
    return projection


def scope(source_paths=None):
    bundle = {}
    for name in ('contract.v2.json','matrix.v2.json','precedence.v2.json','roadmap.v2.json','owner-ledger33.v1.json'):
        raw=regular(ROOT/DOCS/name)
        need(raw == git('show',BASE+':'+DOCS+name), 'R39_SCOPE_DOCUMENT')
        bundle[name]=document(raw)
    matrix=bundle['matrix.v2.json']
    refs=[ref for row in matrix['rows'] for ref in row['source_refs']]
    refs += [matrix['history']['source_ref']] + matrix['history']['snapshot_refs']
    seen, inherited = {}, []
    for ref in refs:
        path=ref['path']
        need(type(path) is str and not path.startswith('/') and '\\' not in path and ':' not in path and
             all(p and p not in ('.','..') for p in path.split('/')) and
             ref['source_commit'] == PINS[35][0] and ref['mode'] == '100644', 'R39_SCOPE_REFERENCE')
        if path in seen:
            need(ref == seen[path], 'R39_SCOPE_REFERENCE_DUPLICATE')
            continue
        seen[path]=ref
        historical=git('show',ref['source_commit']+':'+path)
        oid=hashlib.sha1(('blob '+str(len(historical))+'\0').encode()+historical).hexdigest()
        need(digest(historical) == ref['sha256'] and oid == ref['blob'] and
             git('ls-tree',ref['source_commit'],'--',path) == ('100644 blob '+oid+'\t'+path+'\n').encode(),
             'R39_SCOPE_REFERENCE_HASH')
        current=regular(ROOT/path)
        need(current == git('show',BASE+':'+path), 'R39_SCOPE_UNGRANTED_CHANGE')
        if current != historical:
            inherited.append(dict(path=path,assessedSHA256=ref['sha256'],currentSHA256=digest(current),
                                  qualification='INHERITED_PR41_SOURCE_NOT_REASSESSED_OR_ADMITTED'))
    result=scope_guard(bundle)
    result.update(sourceReferencesHashed=len(seen),changedHistoricalReferences=inherited,
                  assessmentRenewed=False,pr41ReferencedSourceUnchanged=True)
    return result


def authenticate_parent():
    for head,tree,_ in PINS.values():
        need(text('rev-parse',head+'^{tree}') == tree, 'R39_PARENT_TREE')
    chain=[PINS[40][0],'619679d8774743176d9c59d2e68561b27f7765b6',
           '0f53b3e17635302c3dca11ec553c4d78ad281a8e',BASE]
    need(text('rev-list','--reverse',chain[0]+'..'+BASE).splitlines() == chain[1:], 'R39_PARENT_PHASES')
    for a,b in zip(chain,chain[1:]):
        need(parents(b) == [b,a], 'R39_PARENT_LINEAR')
    old_plan='docs/brain/task-specs/M1X-38/SCOPE_PLAN.md'
    plan=git('show',chain[1]+':'+old_plan)
    need(changed(chain[0],chain[1],{old_plan}) == {old_plan} and
         digest(plan) == 'f06717831c1f695e20fe30465b428dfba64ab5d3795e4b891d6c684a93069cec',
         'R39_PARENT_PLAN')
    rows=plan_baselines(plan)
    need(len(rows) == len({r['path'] for r in rows}) == 32, 'R39_PARENT_BASELINES')
    for row in rows:
        entry=git('ls-tree',chain[0],'--',row['path'])
        if row['blob'] is None:
            need(entry == b'', 'R39_PARENT_BASELINE')
        else:
            need(entry == (row['mode']+' blob '+row['blob']+'\t'+row['path']+'\n').encode() and
                 digest(git('show',chain[0]+':'+row['path'])) == row['sha256'], 'R39_PARENT_BASELINE')
    old_task='docs/brain/task-specs/M1X-38/TASK.md'
    value=document(git('show',chain[-2]+':'+old_task))
    need(value.get('base') == chain[0] and value.get('baseTree') == PINS[40][1] and
         value.get('planCommit') == chain[1] and value.get('authority') ==
         'BRAIN-M1X-MASTERV2-OWNED-FORMULA-VERSION38-SOURCE-CANDIDATE-01' and
         type(value.get('sourceHashes')) is dict, 'R39_PARENT_LEDGER')
    no_admission(value,'R39_PARENT_LEDGER')
    expected=set(value['sourceHashes'])|{old_task}
    need(expected <= {r['path'] for r in rows}-{old_plan}-WORKLIST and len(expected) == 24 and
         changed(chain[1],chain[-2],expected) == expected and changed(chain[-2],BASE,WORKLIST) == WORKLIST,
         'R39_PARENT_SOURCE_SEAL')
    for name,sha in value['sourceHashes'].items():
        need(type(sha) is str and re.fullmatch('[0-9a-f]{64}',sha) and
             digest(git('show',chain[-2]+':'+name)) == sha and
             git('show',chain[-2]+':'+name) == git('show',BASE+':'+name), 'R39_PARENT_SOURCE_HASH')
    primitives().worklist_guard(document(git('show',BASE+':docs/phase-4/generated/source-worklist.json')),chain[-2])
    for name,sha in PROGRAMS.items():
        need(digest(regular(ROOT/PREFIX/name)) == sha and digest(git('show',BASE+':'+PREFIX+name)) == sha,
             'R39_ORIGINAL_PROGRAM')
    need(parents(PLAN_COMMIT) == [PLAN_COMMIT,BASE] and changed(BASE,PLAN_COMMIT,{PLAN}) == {PLAN} and
         digest(git('show',PLAN_COMMIT+':'+PLAN)) == PLAN_SHA, 'R39_PLAN_FIRST')
    plan=git('show',PLAN_COMMIT+':'+PLAN)
    expected_rows={r['path']:{k:r[k] for k in ('path','mode','blob','sha256')} for r in BASELINES}
    actual_rows=plan_baselines(plan)
    need(len(actual_rows) == len(BASELINES) == len(expected_rows) == 12 and
         {r['path']:r for r in actual_rows} == expected_rows and set(expected_rows) == GRANT,
         'R39_PLAN_BASELINES')
    for row in BASELINES:
        entry=git('ls-tree',BASE,'--',row['path'])
        if row['blob'] is None:
            need(entry == b'', 'R39_BASELINE_ABSENT')
        else:
            raw=git('show',BASE+':'+row['path'])
            need(entry == (row['mode']+' blob '+row['blob']+'\t'+row['path']+'\n').encode() and
                 len(raw) == row['bytes'] and digest(raw) == row['sha256'], 'R39_BASELINE_IDENTITY')


def verify(phase='SOURCE_FROZEN'):
    need(not sys.flags.optimize and phase in PHASES, 'R39_PHASE')
    primitives().helpers().full29_store()
    need(text('remote','get-url','origin').removesuffix('.git') == 'https://github.com/TasfiqJ/onSkin', 'R39_ORIGIN')
    authenticate_parent()
    head,tree=text('rev-parse','HEAD'),text('rev-parse','HEAD^{tree}')
    need(len(parents(head)) == 2 and text('merge-base',BASE,head) == BASE, 'R39_SOURCE_HEAD')
    in_ci=os.environ.get('GITHUB_ACTIONS') == 'true'
    if not in_ci:
        need(text('symbolic-ref','--short','HEAD') == BRANCH, 'R39_BRANCH')
    else:
        need(phase == 'SOURCE_FROZEN', 'R39_CI_REQUIRES_SEAL')
    commits=text('rev-list','--reverse',BASE+'..'+head).splitlines()
    need(len(commits) >= 2, 'R39_SOURCE_REQUIRED')
    substantive=commits[-1] if phase == 'SOURCE_PENDING' else commits[-2]
    source_paths=task_guard(document(git('show',substantive+':'+TASK)),lambda path:git('show',substantive+':'+path))
    source,seal=phase_guard(commits,phase,source_paths)
    need(git('show',head+':'+PLAN) == git('show',PLAN_COMMIT+':'+PLAN), 'R39_PLAN_IMMUTABLE')
    quality_guard(git('show',source+':.github/workflows/quality.yml'),git('show',BASE+':.github/workflows/quality.yml'))
    if seal:
        value=document(git('show',seal+':docs/phase-4/generated/source-worklist.json'))
        primitives().worklist_guard(value,source)
        need(value.get('warnings') == [] and value.get('summary',{}).get('warningCount') == 0 and
             value.get('summary',{}).get('blockerCount') == 0, 'R39_WORKLIST_WARNINGS')
        markdown=git('show',seal+':docs/phase-4/generated/source-worklist.md')
        need(('Git SHA: '+source).encode() in markdown and b'Git status: clean' in markdown,'R39_WORKLIST_MARKDOWN')
        run_readonly(['node','scripts/phase4/build-source-worklist.mjs','--strict','--check'])
    before=snapshot(head)
    projection=scope(source_paths)
    inventory=baseline_guard()
    run_readonly(['node','scripts/launch/validate-execution-baseline.mjs'])
    run_readonly(['node','scripts/launch/execution-baseline-smoke.mjs'])
    for n,(phead,_,branch) in PINS.items():
        prior=PINS[n-1] if n > 35 else (MAIN,'','main')
        pr_guard(fetch_pr(n),n,phead,branch,prior[0],prior[2])
    live=live_refs(in_ci)
    event,merge,merge_tree,live_pr={},[],None,None
    if in_ci:
        path=Path(os.environ.get('GITHUB_EVENT_PATH',''))
        need(path.is_absolute(),'R39_EVENT_PATH')
        event=document(regular(path))
        number=event.get('number')
        need(type(number) is int and number > 41,'R39_CI_EVENT')
        live_pr=fetch_pr(number)
        sha=os.environ.get('GITHUB_SHA','')
        need(re.fullmatch('[0-9a-f]{40}',sha),'R39_CI_SHA')
        ref=os.environ.get('GITHUB_REF','')
        need(ref == 'refs/pull/'+str(number)+'/merge','R39_CI_EVENT')
        service_merge_ref_guard(git('ls-remote','--exit-code','origin',ref),ref,sha)
        merge,merge_tree=parents(sha),text('rev-parse',sha+'^{tree}')
    qualification=ci_guard(os.environ,event,head,tree,merge,merge_tree,live,live_pr)
    need(snapshot(head) == before and text('rev-parse','HEAD') == head and live_refs(in_ci) == live,
         'R39_FINAL_SNAPSHOT')
    return dict(valid=True,phase=phase,head=head,tree=tree,sourceHead=source,sealedHead=seal,
                parentHead=BASE,parentTree=BASE_TREE,changedSourcePaths=sorted(source_paths),
                trackedBlobsHashed=before[1],qualification=qualification,governance='CURRENT39_FINITE_SOURCE_ONLY',
                productScope=projection,inventory=inventory,
                historicalCheck='SEPARATE_FRESH_PR41_ORIGINAL38_37_36_35_34_33_32_29_REQUIRED',
                acceptanceGranted=False,admissions=dict.fromkeys(ADMISSIONS,False),release='NO_GO')


def original38_reader():
    path=ROOT/PREFIX/'main_integration38.py'
    raw=regular(path)
    need(digest(raw) == PROGRAMS[path.name],'R39_ORIGINAL38_IDENTITY')
    namespace={'__name__':'authenticated_original38_neutral_transcript_reader_only','__file__':str(path)}
    exec(compile(raw,str(path),'exec'),namespace)
    return SimpleNamespace(**namespace)


def stale_inventory_refusal(raw):
    expected=(b'Execution baseline validation failed (1):\n'
              b'- docs/hugeToDo/feature-inventory.json is stale. Run node scripts/launch/build-execution-baseline.mjs and review the diff.\n')
    need(raw.replace(b'\r\n',b'\n') == expected,'R39_HISTORICAL_INVENTORY_REFUSAL')
    return dict(exit=1,onlyStaleFeatureInventory=True,sha256=digest(raw),acceptanceGranted=False,release='NO_GO')


def historical_result(raw):
    """Authenticate original38's actual nested37 transcript, never its current approval."""
    lines=[line for line in raw.replace(b'\r',b'').splitlines() if line]
    need(len(lines) == 2 and lines[0].startswith(b'R38_HISTORICAL_WORKSPACE '),'R39_HISTORICAL_TRANSCRIPT')
    value=document(lines[-1]);no_admission(value,'R39_HISTORICAL_NO_ADMISSION')
    need(value.get('status') == 'PASS' and value.get('historicalHead') == PINS[40][0] and
         value.get('historicalTree') == PINS[40][1] and value.get('qualification') ==
         'FRESH_AUTHENTIC_PR40_37_36_35_34_33_32_29_NOT_CURRENT_OR_OWNER_ACCEPTANCE','R39_HISTORICAL_PIN')
    workspace=Path(value.get('workspace',''))
    need(workspace.is_absolute() and lines[0] == ('R38_HISTORICAL_WORKSPACE '+str(workspace)).encode(),
         'R39_HISTORICAL_WORKSPACE')
    receipts=value.get('receipts')
    names=['clone-pr40','checkout-named37','node-version','normal-npm-ci','postinstall-check',
           'original37-main_integration37.test.py','original37-source_consumer37.test.py','original37-driver83',
           'original37-exact-source','original37-fullapp-scope','original37-external-readiness-refusal',
           'original37-authentic-historical']
    need(type(receipts) is list and [r.get('name') for r in receipts] == names,'R39_HISTORICAL_INTERVAL')
    root=workspace/'pr40';python=historical_python();node=receipts[2].get('command',[None])[0]
    need(type(node) is str and Path(node).is_absolute(),'R39_HISTORICAL_COMMAND')
    expected={
        'clone-pr40':['git','clone','--no-local','--no-hardlinks','--no-checkout','--single-branch','--branch',PINS[40][2],
                      '-c','core.autocrlf=false','-c','core.longpaths=true','https://github.com/TasfiqJ/onSkin.git',str(root)],
        'checkout-named37':['git','checkout',PINS[40][2]],
        'node-version':[node,'--version'],
        'postinstall-check':[node,'scripts/postinstall.mjs','--check'],
        'original37-main_integration37.test.py':[python,'-I','-B',PREFIX+'main_integration37.test.py'],
        'original37-source_consumer37.test.py':[python,'-I','-B',PREFIX+'source_consumer37.test.py'],
        'original37-driver83':[node,'--test','scripts/e2e/onboarding-first-session35.test.mjs',
                               'scripts/e2e/retained-safety-assertions.test.mjs','scripts/e2e/compact-shelf-target37.test.mjs'],
        'original37-exact-source':[python,'-I','-B',PREFIX+'main_integration37.py'],
        'original37-fullapp-scope':[python,'-I','-B',PREFIX+'main_integration37.py','--scope','full-app-j01-v2'],
        'original37-external-readiness-refusal':[python,'-I','-B',PREFIX+'main_integration37.py','--scope',
                                               'full-app-j01-v2','--external-readiness'],
        'original37-authentic-historical':[python,'-I','-B',PREFIX+'main_integration37.py','--historical']}
    for row in receipts:
        name=row['name'];exitcode=2 if name == 'original37-external-readiness-refusal' else 0
        need(type(row.get('exit')) is int and row['exit'] == row.get('expectedExit') == exitcode and
             row.get('timedOut') is False,'R39_HISTORICAL_CHILD')
        need(row.get('historicalHead') == PINS[40][0] and row.get('historicalTree') == PINS[40][1],
             'R39_HISTORICAL_PIN')
        log=workspace/'logs'/(name+'.log')
        need(row.get('log') == str(log),'R39_HISTORICAL_LOG_PATH')
        body=regular(log,8*1024*1024)
        need(len(body) == row.get('bytes') and digest(body) == row.get('sha256'),'R39_HISTORICAL_LOG_HASH')
        command=row.get('command')
        if name == 'normal-npm-ci':
            need(type(command) is list and len(command) == 6 and command[0] == node and
                 Path(command[1]).is_absolute() and Path(command[1]).name == 'npm-cli.js' and
                 command[2:] == ['ci','--ignore-scripts=false','--no-audit','--no-fund'],'R39_HISTORICAL_COMMAND')
        else:
            need(command == expected[name],'R39_HISTORICAL_COMMAND')
        if name == 'original37-exact-source':
            need(document(body) == value.get('original37'),'R39_ACTUAL_TRANSCRIPT')
        if name == 'original37-fullapp-scope':
            need(document(body) == value.get('original37Scope'),'R39_ACTUAL_TRANSCRIPT')
        if name == 'original37-driver83':
            test_summary(body,83,83,0)
        if name == 'original37-authentic-historical':
            need(original38_reader().historical_result(body) == value.get('original37Historical'),
                 'R39_NESTED_ACTUAL_TRANSCRIPT')
    original=value.get('original37',{})
    need(original.get('valid') is True and original.get('head') == PINS[40][0] and
         original.get('tree') == PINS[40][1] and original.get('governance') == 'CURRENT37_FINITE_SOURCE_ONLY' and
         original.get('qualification') == 'LOCAL_EXACT_CHECKOUT_NOT_HOSTED_CI','R39_ORIGINAL37_VERDICT')
    no_admission(original,'R39_ORIGINAL37_NO_ADMISSION')
    return value


def historical():
    """Fresh exact named PR41 original38; stale inventory stays an actual refusal."""
    authenticate_parent();start=text('rev-parse','HEAD')
    env=primitives().clean_environment();python=historical_python()
    workspace=Path(tempfile.mkdtemp(prefix='integration39-')).resolve()
    need(not workspace.is_relative_to(ROOT),'R39_EXTERNAL_CLONE')
    root=workspace/'pr41';logs=workspace/'logs';logs.mkdir()
    # Keep original nested checkouts flat under the caller's task temp root.
    # Deeper prefixes can make authentic tracked paths exceed Windows MAX_PATH.
    temp=workspace.parent
    env.update(TEMP=str(temp),TMP=str(temp),TMPDIR=str(temp))
    print('R39_HISTORICAL_WORKSPACE '+str(workspace),file=sys.stderr,flush=True)
    receipts=[]
    def run(name,args,cwd=root,expected=0,timeout=1800):
        log=logs/(name+'.log');started=time.monotonic();timed_out=False
        with log.open('wb') as output:
            process=subprocess.Popen(args,cwd=cwd,env=env,stdout=output,stderr=subprocess.STDOUT)
            try:process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:process.kill();process.wait();timed_out=True
        raw=log.read_bytes()
        receipts.append(dict(name=name,command=args,exit=process.returncode,expectedExit=expected,
                             seconds=round(time.monotonic()-started,3),timedOut=timed_out,bytes=len(raw),
                             sha256=digest(raw),log=str(log),historicalHead=BASE,historicalTree=BASE_TREE))
        (logs/'receipts.json').write_bytes((json.dumps(receipts,indent=2)+'\n').encode())
        need(not timed_out and len(raw) <= 8*1024*1024,'R39_HISTORICAL_TIMEOUT_OR_OUTPUT')
        need(process.returncode == expected,'R39_HISTORICAL_CHILD_EXIT')
        return raw
    run('clone-pr41',['git','clone','--no-local','--no-hardlinks','--no-checkout','--single-branch','--branch',PARENT_BRANCH,
                     '-c','core.autocrlf=false','-c','core.longpaths=true','https://github.com/TasfiqJ/onSkin.git',str(root)],workspace)
    run('checkout-named38',['git','checkout',PARENT_BRANCH])
    def pinned(*args):
        return subprocess.check_output(['git','--no-replace-objects',*args],cwd=root,env=env).decode().strip()
    need(pinned('rev-parse','HEAD') == BASE and pinned('rev-parse','HEAD^{tree}') == BASE_TREE and
         pinned('rev-parse','--is-shallow-repository') == 'false','R39_HISTORICAL_PIN')
    for name,sha in PROGRAMS.items():
        need(digest(regular(root/PREFIX/name)) == sha,'R39_HISTORICAL_PROGRAM')
    need(digest(regular(root/INVENTORY)) == ORIGINAL_INVENTORY_SHA,'R39_HISTORICAL_INVENTORY')
    node=Path(shutil.which('node')).resolve()
    candidates=[node.parent/'node_modules/npm/bin/npm-cli.js'] if os.name == 'nt' else [node.parent.parent/'lib/node_modules/npm/bin/npm-cli.js']
    if env.get('APPDATA'):
        candidates.insert(0,Path(env['APPDATA'])/'npm/node_modules/npm/bin/npm-cli.js')
    config=workspace/'empty.npmrc';config.write_bytes(b'')
    env.update(npm_config_userconfig=os.devnull,npm_config_globalconfig=str(config))
    need(run('node-version',[str(node),'--version']).strip() == b'v22.21.0','R39_RUNTIME')
    npm=next((p for p in candidates if p.is_file() and
              subprocess.check_output([str(node),str(p),'--version'],env=env).strip() == b'11.20.0'),None)
    need(npm is not None,'R39_RUNTIME')
    run('normal-npm-ci',[str(node),str(npm),'ci','--ignore-scripts=false','--no-audit','--no-fund'])
    run('postinstall-check',[str(node),'scripts/postinstall.mjs','--check'])
    for name in ('main_integration38.test.py','source_consumer38.test.py'):
        run('original38-'+name,[python,'-I','-B',PREFIX+name])
    driver=run('original38-driver103',[str(node),'--test','scripts/e2e/onboarding-first-session35.test.mjs',
               'scripts/e2e/retained-safety-assertions.test.mjs','scripts/e2e/compact-shelf-target37.test.mjs',
               'scripts/e2e/owned-bottle-formula38.test.mjs'])
    test_summary(driver,103,103,0)
    verdict=document(run('original38-exact-source',[python,'-I','-B',PREFIX+'main_integration38.py']))
    need(verdict.get('valid') is True and verdict.get('head') == BASE and verdict.get('tree') == BASE_TREE and
         verdict.get('governance') == 'CURRENT38_FINITE_SOURCE_ONLY' and
         verdict.get('qualification') == 'LOCAL_EXACT_CHECKOUT_NOT_HOSTED_CI','R39_ORIGINAL38_VERDICT')
    no_admission(verdict,'R39_ORIGINAL38_NO_ADMISSION')
    projection=document(run('original38-fullapp-scope',[python,'-I','-B',PREFIX+'main_integration38.py','--scope','full-app-j01-v2']))
    need(projection.get('head') == BASE and projection.get('tree') == BASE_TREE and
         projection.get('externalReady') is False and projection.get('acceptanceGranted') is False and
         projection.get('release') == 'NO_GO','R39_ORIGINAL38_SCOPE')
    run('original38-external-readiness-refusal',[python,'-I','-B',PREFIX+'main_integration38.py',
                                              '--scope','full-app-j01-v2','--external-readiness'],expected=2)
    refusal=stale_inventory_refusal(run('original38-stale-inventory-refusal',
                                       [str(node),'scripts/launch/validate-execution-baseline.mjs'],expected=1))
    run('original38-original-baseline-smoke',[str(node),'scripts/launch/execution-baseline-smoke.mjs'])
    nested=historical_result(run('original38-authentic-historical',
                                 [python,'-I','-B',PREFIX+'main_integration38.py','--historical'],timeout=14400))
    need(pinned('status','--porcelain=v1','--untracked-files=all') == '' and pinned('rev-parse','HEAD') == BASE and
         text('rev-parse','HEAD') == start,'R39_HISTORICAL_CHANGED')
    return dict(status='PASS',historicalHead=BASE,historicalTree=BASE_TREE,original38=verdict,
                original38Scope=projection,original38InventoryRefusal=refusal,original38Historical=nested,
                receipts=receipts,workspace=str(workspace),
                qualification='FRESH_AUTHENTIC_PR41_38_37_36_35_34_33_32_29_NOT_CURRENT_OR_OWNER_ACCEPTANCE',
                acceptanceGranted=False,admissions=dict.fromkeys(ADMISSIONS,False),release='NO_GO')


if __name__ == '__main__':
    sys.exit(main())
