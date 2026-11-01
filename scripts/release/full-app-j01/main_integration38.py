"""Finite local formula-history source integrity; historical approvals run only at their exact original full checkouts."""
import argparse, hashlib, json, os, re, shutil, stat, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path
from types import SimpleNamespace
ROOT = Path(__file__).resolve().parents[3]
BASE = '530da5d8af8c3b74a1675a4cfdffc03dca2ec9c1'
BASE_TREE = '034cd0b1708362f377a88dbef24e6fe0ddfbd1e3'
MAIN = '53a84d921d14dbff1d2e9b8f1b3bb27e10dcede6'
BRANCH = 'stage/m1-owned-formula-version38'
PARENT_BRANCH = 'stage/m1-compact-shelf-first-session37'
PLAN_COMMIT = '619679d8774743176d9c59d2e68561b27f7765b6'
PLAN = 'docs/brain/task-specs/M1X-38/SCOPE_PLAN.md'
PLAN_SHA = 'f06717831c1f695e20fe30465b428dfba64ab5d3795e4b891d6c684a93069cec'
TASK = 'docs/brain/task-specs/M1X-38/TASK.md'
PREFIX = 'scripts/release/full-app-j01/'
DOCS = 'docs/release/full-app-j01/'
AUTHORITY = 'BRAIN-M1X-MASTERV2-OWNED-FORMULA-VERSION38-SOURCE-CANDIDATE-01'
PINS = {40: ('530da5d8af8c3b74a1675a4cfdffc03dca2ec9c1', '034cd0b1708362f377a88dbef24e6fe0ddfbd1e3', 'stage/m1-compact-shelf-first-session37'), 39: ('1f4014f80402176ad2a208154d4da03db711ae5f', 'bc859097ad3c8273cf341802474c28a5b13a1d43', 'stage/m1-free-first-session-ci36'), 38: ('4c98bed778c1044b95cbb29fcaac06802fa398c1', '3296835a6cd05c60a6dfff6aa2aa3e1e817ed597', 'stage/m1-free-first-session-e2e35'), 37: ('7dea6048e5f1f5e397656b5f2fa670929fa9c2b8', '49b0baf1f20ca3d092db5d3cb14156feb2963f61', 'stage/m1-fullapp-dual-scope-readers34'), 36: ('4ca36e915608460a1ed97d7fff94a3ece61296ab', '49945b4e453b4fc30ceb175f330c8b4b924afe31', 'stage/m1-fullapp-j01-scope-cutover33'), 35: ('cbbb5a83bd29d2833399c214f5b6c6dd14873d24', '0745ad5f5595724a9b26de64324065dc3e53d2ea', 'stage/m1-main-quality-governance32')}
PROGRAMS = {'main_integration32.py': '5b48f78917aaf39e4da66138e3d5c52654af7defd1eaf37ab6404fdc631ceda4', 'check.py': '944c04283b834e5f20bdfcbf95c265c7af57f8f4754952b4353dee5f8d8952dd', 'main_integration33.py': '1176d7fa42f23ecde717ac4c9a96e5eb855774ac4e3bc2813f970a4004065616', 'main_integration34.py': '342e21de512e4e3bf6dffb5e3ad9b86b6b47c9c30f9815d219cd0ab868858fdb', 'main_integration35.py': '1418a7a04a9e91585bc7723a21a6455d86c6e28a1744ff09342275789771f32c', 'main_integration36.py': 'ccb5e6f668911fb54cbed496014ebd5123ec115d52d2ebd8e19b9faf89e0b448', 'main_integration36.test.py': '0507dc44e154bff8ca0fe87cb85694c6d84ff19dc780f7ca332fb8e0dab2433d', 'source_consumer36.test.py': '34c195fc9585373d3c3ef2bf43ce86d03d12dd230f95ad23648a8f69119fe219', 'main_integration37.py': '9c877b73d9db5515cf8319fe75e1d0924685a9f29c7fa121f988daeb33a2edf6', 'main_integration37.test.py': '9da5c9f99095ec8ba67800e94071221fabc82a012fcc08e127d6d92532bcc653', 'source_consumer37.test.py': 'e4de41cd5fc4d500e8214e1906d322cf88d5ddb05af52ed894096a92d1a433bb'}
NEW_STEP = '      - name: Verify current38 local bottle history and separately pinned37/36/35/34/33/32/29\n        run: |\n          set -euo pipefail\n          phase="${C38_PREFLIGHT_PHASE:-SOURCE_FROZEN}"\n          if [ "${GITHUB_EVENT_NAME:-}" = pull_request ]; then\n            git fetch --no-tags origin "$GITHUB_REF"\n            test "$(git rev-parse FETCH_HEAD)" = "$GITHUB_SHA"\n          fi\n          python3 -I -B scripts/release/full-app-j01/main_integration38.test.py\n          python3 -I -B scripts/release/full-app-j01/source_consumer38.test.py\n          node --test scripts/e2e/onboarding-first-session35.test.mjs scripts/e2e/retained-safety-assertions.test.mjs scripts/e2e/compact-shelf-target37.test.mjs scripts/e2e/owned-bottle-formula38.test.mjs\n          python3 -I -B scripts/release/full-app-j01/main_integration38.py --phase "$phase"\n          python3 -I -B scripts/release/full-app-j01/main_integration38.py --phase "$phase" --scope full-app-j01-v2\n          if python3 -I -B scripts/release/full-app-j01/main_integration38.py --phase "$phase" --scope full-app-j01-v2 --external-readiness; then\n            echo \'External readiness must remain refused\' >&2\n            exit 1\n          else\n            test "$?" = 2\n          fi\n          node scripts/launch/check-contract.mjs\n          python3 -I -B scripts/release/full-app-j01/main_integration38.py --historical\n          node scripts/docs/source-packet-supersession09.test.mjs\n\n'
GRANT = {'scripts/release/full-app-j01/main_integration38.py', 'apps/mobile/src/app/shelf/[id].tsx', 'docs/release/full-app-j01/owned-bottle-formula38.md', 'apps/mobile/src/features/shelf/shelfRoutes.test.ts', 'apps/mobile/src/features/shelf/IntakeContext.tsx', 'apps/mobile/src/features/shelf/useShelf.ts', 'apps/mobile/src/features/shelf/IntakeContext.test.ts', 'PROGRESS.md', 'apps/mobile/src/features/shelf/formulaVersion38.test.ts', 'scripts/e2e/owned-bottle-formula38.mjs', 'apps/mobile/src/features/shelf/mutations.ts', 'apps/mobile/src/features/shelf/mutationsRecovery.test.ts', 'apps/mobile/src/features/shelf/metadata.ts', 'docs/phase-4/generated/source-worklist.json', 'docs/brain/task-specs/M1X-38/SCOPE_PLAN.md', 'apps/mobile/src/features/shelf/ownedBottleVersion38.ts', 'apps/mobile/src/app/shelf/opened.tsx', 'scripts/release/full-app-j01/source_consumer38.test.py', 'docs/phase-4/generated/source-worklist.md', 'apps/mobile/src/features/shelf/store.test.ts', 'apps/mobile/src/features/shelf/ownedBottleVersion38.test.ts', 'scripts/e2e/owned-bottle-formula38.test.mjs', 'apps/mobile/src/app/shelf/manual.tsx', 'apps/mobile/src/features/shelf/formulaVersion38.ts', '.github/workflows/quality.yml', 'docs/brain/task-specs/M1X-38/TASK.md', 'docs/USER_FLOW_TREE.md', 'scripts/e2e/onboarding-first-session.mjs', 'scripts/release/full-app-j01/main_integration38.test.py', 'apps/mobile/src/app/shelf/formula-history.tsx', 'apps/mobile/src/features/shelf/store.ts', 'apps/mobile/src/app/shelf/_layout.tsx'}
BASELINES = [{'path': 'docs/brain/task-specs/M1X-38/SCOPE_PLAN.md', 'mode': None, 'blob': None, 'sha256': None, 'bytes': None}, {'path': 'docs/brain/task-specs/M1X-38/TASK.md', 'mode': None, 'blob': None, 'sha256': None, 'bytes': None}, {'path': 'apps/mobile/src/features/shelf/formulaVersion38.ts', 'mode': None, 'blob': None, 'sha256': None, 'bytes': None}, {'path': 'apps/mobile/src/features/shelf/formulaVersion38.test.ts', 'mode': None, 'blob': None, 'sha256': None, 'bytes': None}, {'path': 'apps/mobile/src/features/shelf/ownedBottleVersion38.ts', 'mode': None, 'blob': None, 'sha256': None, 'bytes': None}, {'path': 'apps/mobile/src/features/shelf/ownedBottleVersion38.test.ts', 'mode': None, 'blob': None, 'sha256': None, 'bytes': None}, {'path': 'apps/mobile/src/features/shelf/store.ts', 'mode': '100644', 'blob': '5fdcef634976a752843930898aee462e64bbe1fb', 'sha256': '0ad436f703af60d7da0afbfa12cf23d7c722e37650ac03f9360316098bb33e5a', 'bytes': 59061}, {'path': 'apps/mobile/src/features/shelf/store.test.ts', 'mode': '100644', 'blob': 'dcd328078036f7ed68fef0935edabe8f9bb9da0f', 'sha256': 'ef81c36aa369f9a59cb1e291237513e4a68bb2e2af537c9f39238f20ef2219e2', 'bytes': 57439}, {'path': 'apps/mobile/src/features/shelf/mutations.ts', 'mode': '100644', 'blob': '20b07b68ace019dbd4cf220840910f82f2d8e955', 'sha256': '7cc229b87258030f98f48f09bc076da800f3c44c08e54a6a3e45904bf756032d', 'bytes': 5644}, {'path': 'apps/mobile/src/features/shelf/mutationsRecovery.test.ts', 'mode': '100644', 'blob': 'e78eb9a4d2ed57e3fe5d0c391ebcb245af750ae7', 'sha256': '0ece694c4c4f3fc7c751b6243bee39542e244dde1527d83b560612426ffc7288', 'bytes': 6005}, {'path': 'apps/mobile/src/features/shelf/useShelf.ts', 'mode': '100644', 'blob': '0f3354cf6b866db72dda3943f30d735719a834cd', 'sha256': 'ab7cea36364411d80658bc712c20c1551feb8d7ca58f62bce41c64e25a3e0535', 'bytes': 13601}, {'path': 'apps/mobile/src/features/shelf/shelfRoutes.test.ts', 'mode': '100644', 'blob': '9e3473262a6d0abfe3e1c895537f6685520a63f7', 'sha256': 'bf576b6df44bd87c95f7dbe8e5bb5ab9b188039817f6a0328961b2c6da1a8fc3', 'bytes': 69404}, {'path': 'apps/mobile/src/features/shelf/metadata.ts', 'mode': '100644', 'blob': '6a6682044691ceffca419bb2c15051e46103828a', 'sha256': 'e7da08df3d733c91f2464b7de96fdabbfa45c283fbf47659d1e2996821f16546', 'bytes': 1606}, {'path': 'apps/mobile/src/app/shelf/[id].tsx', 'mode': '100644', 'blob': '97f1629951eafa8b73d1ca6ce334a01fc4a2c4be', 'sha256': '2c26347799a342f2cd50f732c3dd4d3787922ec3b7708ce9e0882b7297139458', 'bytes': 55878}, {'path': 'apps/mobile/src/app/shelf/manual.tsx', 'mode': '100644', 'blob': '6ad89ae00759d8bb7dbf69f643e677254e948e46', 'sha256': '56ec9e3c1ffda7ed2537babf81d782b55ee0ebb161e91e8069bcd6a09db8d251', 'bytes': 20074}, {'path': 'apps/mobile/src/app/shelf/opened.tsx', 'mode': '100644', 'blob': '7d60c276720a7529537fccececb28ef55bf02737', 'sha256': '3105764a90f0ec7fd3af89bd27669fa48a420a7614be1ad516d85fbc021552bb', 'bytes': 21693}, {'path': 'apps/mobile/src/app/shelf/_layout.tsx', 'mode': '100644', 'blob': '73376a08f9a969c7f289e95a649913d8a67d4086', 'sha256': 'aa87c625fa1109450c96fbbf56a2eccead64abdd1633ff348abb518be182a902', 'bytes': 1732}, {'path': 'apps/mobile/src/app/shelf/formula-history.tsx', 'mode': None, 'blob': None, 'sha256': None, 'bytes': None}, {'path': 'apps/mobile/src/features/shelf/IntakeContext.tsx', 'mode': '100644', 'blob': 'fafb23857ba7d71a808d0b259ab0561b9a87a19d', 'sha256': 'a4026b33e8141d97ee0c6238e1f729e32527ce710691c7d97082d71c505ac5ee', 'bytes': 7764}, {'path': 'apps/mobile/src/features/shelf/IntakeContext.test.ts', 'mode': '100644', 'blob': '1896ae15db930a409131cd5ccafb9eca2afdfd33', 'sha256': '9bc6f78dec650d85c5580cb691206733882b43f719f32faae937f140bbb2a859', 'bytes': 2193}, {'path': 'docs/USER_FLOW_TREE.md', 'mode': '100644', 'blob': 'd54e14904dfe662749f54d51b126c6ec377bcb4e', 'sha256': '3bb527a6df935f59341f9128200909b218395cd25a74d65e28cd6dff77371eff', 'bytes': 535073}, {'path': 'scripts/e2e/onboarding-first-session.mjs', 'mode': '100644', 'blob': '9c2a9c635bc8dd063299c1e985b1bac3bec7cfcf', 'sha256': '422dcac7b7c257136ea99342bd0f718e1d22f4e392805579f53d4329f39eabf3', 'bytes': 114274}, {'path': 'scripts/e2e/owned-bottle-formula38.test.mjs', 'mode': None, 'blob': None, 'sha256': None, 'bytes': None}, {'path': 'scripts/e2e/owned-bottle-formula38.mjs', 'mode': None, 'blob': None, 'sha256': None, 'bytes': None}, {'path': 'docs/release/full-app-j01/owned-bottle-formula38.md', 'mode': None, 'blob': None, 'sha256': None, 'bytes': None}, {'path': 'scripts/release/full-app-j01/main_integration38.py', 'mode': None, 'blob': None, 'sha256': None, 'bytes': None}, {'path': 'scripts/release/full-app-j01/main_integration38.test.py', 'mode': None, 'blob': None, 'sha256': None, 'bytes': None}, {'path': 'scripts/release/full-app-j01/source_consumer38.test.py', 'mode': None, 'blob': None, 'sha256': None, 'bytes': None}, {'path': '.github/workflows/quality.yml', 'mode': '100644', 'blob': '9cd909095d4c05b0270be715cbd028f8b671d0b9', 'sha256': '79c1f539ac0f70a81dbdb74af108a6aad2414129cd1657edb06f463680903976', 'bytes': 14882}, {'path': 'docs/phase-4/generated/source-worklist.json', 'mode': '100644', 'blob': '53ece4c1e8e56c318fbff30cc61f9995743877c7', 'sha256': '6875187803256d1def923165ed7b56bd3cc273381ac021aff0d10aae01870df1', 'bytes': 141091}, {'path': 'docs/phase-4/generated/source-worklist.md', 'mode': '100644', 'blob': '1ac1ea6ebf1ca4c9ca61b67ddbda7795773d248c', 'sha256': 'b09c0f6da37ccf70025be689499e83b9dbe306ddbdd107968f4e760fb99a6286', 'bytes': 84178}, {'path': 'PROGRESS.md', 'mode': '100644', 'blob': '3b1ddbe7d29990151313df6d1c04ec0ac78d2fdd', 'sha256': 'c9d249f01384ffa804aa0523a882398a416246ce12c5692659c1be614a29ee09', 'bytes': 547881}]
WORKLIST = {'docs/phase-4/generated/source-worklist.md', 'docs/phase-4/generated/source-worklist.json'}
# Optional paths may remain absent. The task ledger freezes the exact changed subset.
SOURCE = GRANT - WORKLIST - {PLAN}
ESSENTIAL = {TASK, PREFIX+'main_integration38.py', PREFIX+'main_integration38.test.py',
    PREFIX+'source_consumer38.test.py', '.github/workflows/quality.yml', 'PROGRESS.md',
    DOCS+'owned-bottle-formula38.md', 'docs/USER_FLOW_TREE.md',
    'apps/mobile/src/features/shelf/formulaVersion38.ts', 'apps/mobile/src/features/shelf/store.ts',
    'apps/mobile/src/app/shelf/[id].tsx', 'scripts/e2e/owned-bottle-formula38.test.mjs'}
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
             not getattr(info, 'st_file_attributes', 0) & 1024, 'R38_REGULAR_PARENT')
    before = path.lstat()
    need(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and not path.is_symlink() and
         not getattr(before, 'st_file_attributes', 0) & 1024 and before.st_size <= limit,
         'R38_REGULAR_FILE')
    raw = path.read_bytes()
    after = path.lstat()
    need((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns) ==
         (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns), 'R38_CHANGED_READ')
    return raw

def primitives():
    """Only neutral32 Git/delta/JSON/raw-reader operations; never its verify()."""
    global H
    for name in ('main_integration32.py', 'check.py'):
        need(digest(regular(ROOT/PREFIX/name)) == PROGRAMS[name], 'R38_NEUTRAL_PREIMAGE')
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
         len(set(commits)) == len(commits) and commits[0] == PLAN_COMMIT, 'R38_HISTORY_PHASES')
    source_commits = commits[1:] if phase == 'SOURCE_PENDING' else commits[1:-1]
    need(source_commits, 'R38_SOURCE_REQUIRED')
    previous, union = PLAN_COMMIT, set()
    for current in source_commits:
        need(parents(current) == [current, previous], 'R38_LINEAR_HISTORY')
        paths = changed(previous, current, allowed)
        need(paths, 'R38_EMPTY_SOURCE')
        union.update(paths)
        previous = current
    need(union == allowed and changed(BASE, previous, allowed|{PLAN}) == allowed|{PLAN}, 'R38_EXACT_SOURCE')
    seal = None
    if phase == 'SOURCE_FROZEN':
        seal = commits[-1]
        need(parents(seal) == [seal, previous] and changed(previous, seal, WORKLIST) == WORKLIST,
             'R38_SOLE_FINAL_SEAL')
    return previous, seal


def task_guard(value, read_body):
    need(type(value) is dict and set(value) == {'schema', 'authority', 'base', 'baseTree', 'planCommit',
         'sourceHashes', 'commands', 'acceptanceGranted', 'admissions', 'release', 'qualification'}, 'R38_TASK_SCHEMA')
    need(type(value['schema']) is int and value['schema'] == 1 and value['authority'] == AUTHORITY and
         value['base'] == BASE and value['baseTree'] == BASE_TREE and value['planCommit'] == PLAN_COMMIT and
         value['qualification'] == 'SOURCE_INTEGRITY_NOT_QUALIFIED_ACCEPTANCE', 'R38_TASK_AUTHORITY')
    no_admission(value, 'R38_NO_ADMISSION')
    hashes = value['sourceHashes']
    need(type(hashes) is dict and ESSENTIAL-{TASK} <= set(hashes) <= SOURCE-{TASK}, 'R38_HASH_INVENTORY')
    for path, sha in hashes.items():
        need(type(sha) is str and re.fullmatch('[0-9a-f]{64}', sha) and digest(read_body(path)) == sha,
             'R38_SOURCE_HASH')
    need(type(value['commands']) is list and value['commands'], 'R38_COMMAND_LEDGER')
    for row in value['commands']:
        need(type(row) is dict and set(row) == {'command', 'exit', 'qualification', 'logSha256'}, 'R38_COMMAND_LEDGER')
        command = row['command']
        need((type(command) is str and command.strip() or type(command) is list and command and
             all(type(v) is str and v for v in command)) and
             (row['exit'] is None or type(row['exit']) is int) and
             type(row['qualification']) is str and bool(row['qualification']) and
             (row['logSha256'] is None or type(row['logSha256']) is str and
              re.fullmatch('[0-9a-f]{64}', row['logSha256'])), 'R38_COMMAND_LEDGER')
    return set(hashes)|{TASK}


def quality_guard(raw, before):
    start = b'      - name: Verify current37 compact Shelf source and authentic pinned36/35/34/33/32/29\n'
    stop = b'      - name: Verify tooling security backports\n'
    need(before.count(start) == before.count(stop) == 1, 'R38_QUALITY_PARENT')
    prefix, remainder = before.split(start)
    _, suffix = remainder.split(stop)
    need(raw == prefix+NEW_STEP.encode()+stop+suffix, 'R38_QUALITY_ONLY_FIRST_STEP')


def scope_guard(bundle):
    need(set(bundle) == {'contract.v2.json', 'matrix.v2.json', 'precedence.v2.json', 'roadmap.v2.json',
         'owner-ledger33.v1.json'}, 'R38_SCOPE_INVENTORY')
    c, m, p, owner = [bundle[n] for n in ('contract.v2.json', 'matrix.v2.json', 'precedence.v2.json', 'owner-ledger33.v1.json')]
    need(c['schema_version'] == 2 and c['contract_id'] == 'onskin-full-app-j01-campaign33-v2' and
         c['required_f']+c['required_c']+c['required_p']+c['korean_candidates'] == REQUIRED and
         c['deferred_f']+c['deferred_j'] == DEFERRED and c['release_status'] == 'NO_GO' and
         all(c[k] is False for k in ('acceptanceGranted', 'candidateReady', 'productReady',
             'providerReady', 'paidReady', 'professionalReady', 'j01Qualified')), 'R38_SCOPE_NO_ADMISSION')
    ids = [f'F{i:02}' for i in range(1,21)]+[f'V2-C{i:02}' for i in range(1,13)]+[f'P{i:02}' for i in range(1,7)]+[f'J{i:02}' for i in range(1,28)]
    need(type(m['rows']) is list and [r.get('id') for r in m['rows']] == ids and
         (m['row_count'], m['required_count'], m['deferred_count']) == (65, 38, 27) and
         m['acceptanceGranted'] is False and m['release'] == 'NO_GO', 'R38_SCOPE_ROWS')
    for row in m['rows']:
        need(all(row[k] is False for k in ('complete', 'positive_output_enabled', 'owner_admitted')) and
             row['gates'] and len(set(row['gates'])) == len(row['gates']) and
             set(row['gates']) <= set(GATES), 'R38_ROW_NO_ADMISSION')
    need([g['id'] for g in owner['gates']] == GATES and owner['gates'] == c['gates'] and
         all(g['admitted'] is False and g['evidence'] == [] for g in owner['gates']) and
         owner['qualified_admissions'] == dict.fromkeys(ADMISSIONS, False) and
         owner['acceptanceGranted'] is False and owner['release'] == 'NO_GO' and
         p['source_validity']['status'] == 'CURRENT_FOR_PINNED_BASE_ONLY' and
         p['source_validity']['security_expiry_unchanged'] == '2026-10-21T00:00:00Z', 'R38_GATES_CLOSED')
    return dict(valid=True, scope='full-app-j01-v2', contract=c['contract_id'], requiredRows=38,
        deferredRows=27, totalRows=65, requiredIds=REQUIRED, deferredIds=DEFERRED,
        obligations=[dict(id=r['id'], complete=False, ownerAdmitted=False, positiveOutputEnabled=False,
            gates=r['gates']) for r in m['rows']], unadmittedGates=GATES,
        assessedHead=c['source_base'], assessedTree=c['source_base_tree'], assessmentRenewed=False,
        qualification='AUTHENTICATED_UNCHANGED_HISTORICAL_SCOPE_NOT_OWNER_ACCEPTANCE',
        externalReady=False, candidateReady=False, acceptanceGranted=False, release='NO_GO')

def scope(source_paths=None):
    bundle = {}
    for name in ('contract.v2.json', 'matrix.v2.json', 'precedence.v2.json', 'roadmap.v2.json', 'owner-ledger33.v1.json'):
        raw = regular(ROOT/DOCS/name)
        need(raw == git('show', BASE+':'+DOCS+name), 'R38_SCOPE_DOCUMENT')
        bundle[name] = document(raw)
    # The matrix is a historical assessment, never a claim that current source is qualified.
    matrix = bundle['matrix.v2.json']
    refs = [r for row in matrix['rows'] for r in row['source_refs']]
    refs += [matrix['history']['source_ref']] + matrix['history']['snapshot_refs']
    seen, changes = {}, []
    allowed = SOURCE if source_paths is None else set(source_paths)
    for ref in refs:
        path = ref['path']
        need(type(path) is str and not path.startswith('/') and '\\' not in path and ':' not in path and
             all(p and p not in ('.', '..') for p in path.split('/')) and
             ref['source_commit'] == PINS[35][0] and ref['mode'] == '100644', 'R38_SCOPE_REFERENCE')
        if path in seen:
            need(ref == seen[path], 'R38_SCOPE_REFERENCE_DUPLICATE')
            continue
        seen[path] = ref
        historical = git('show', ref['source_commit']+':'+path)
        oid = hashlib.sha1(('blob '+str(len(historical))+'\0').encode()+historical).hexdigest()
        need(digest(historical) == ref['sha256'] and oid == ref['blob'] and
             git('ls-tree', ref['source_commit'], '--', path) == ('100644 blob '+oid+'\t'+path+'\n').encode(),
             'R38_SCOPE_REFERENCE_HASH')
        current = regular(ROOT/path)
        if current != historical:
            need(path in allowed, 'R38_SCOPE_UNGRANTED_CHANGE')
            changes.append(dict(path=path, assessedSHA256=ref['sha256'], currentSHA256=digest(current),
                                qualification='CURRENT_SOURCE_CHANGE_REQUIRES_INDEPENDENT_REVIEW'))
    result = scope_guard(bundle)
    result.update(sourceReferencesHashed=len(seen), changedHistoricalReferences=changes,
                  assessmentRenewed=False)
    return result


def pr_guard(value, number, head, branch, base, base_branch):
    need(type(value) is dict and type(value.get('number')) is int and value['number'] == number and
         value.get('state') == 'open' and value.get('draft') is True and value.get('merged') is False and
         value.get('merged_at') is None and value.get('closed_at') is None and
         value.get('maintainer_can_modify') is False and 'auto_merge' in value and value['auto_merge'] is None and
         value.get('head', {}).get('sha') == head and value['head'].get('ref') == branch and
         value['head'].get('repo', {}).get('full_name') == 'TasfiqJ/onSkin' and
         value.get('base', {}).get('sha') == base and value['base'].get('ref') == base_branch and
         value['base'].get('repo', {}).get('full_name') == 'TasfiqJ/onSkin', 'R38_PR_CUSTODY')

def ci_guard(env, event, head, tree, merge, merge_tree, live, live_pr):
    expected = dict(main=MAIN, **{'pr'+str(n): p[0] for n, p in PINS.items()})
    if env.get('GITHUB_ACTIONS') != 'true':
        need(not any(k.startswith('GITHUB_') for k in env) and live == expected, 'R38_LOCAL_CONTEXT')
        return 'LOCAL_EXACT_CHECKOUT_NOT_HOSTED_CI'
    need(env.get('GITHUB_EVENT_NAME') == 'pull_request' and env.get('GITHUB_REPOSITORY') == 'TasfiqJ/onSkin' and
         type(event) is dict and event.get('repository', {}).get('full_name') == 'TasfiqJ/onSkin', 'R38_CI_KIND')
    number = event.get('number')
    need(type(number) is int and number > 40 and env.get('GITHUB_REF') == 'refs/pull/'+str(number)+'/merge', 'R38_CI_EVENT')
    for pr in (event.get('pull_request'), live_pr):
        pr_guard(pr, number, head, BRANCH, BASE, PARENT_BRANCH)
    need(re.fullmatch('[0-9a-f]{40}', env.get('GITHUB_SHA', '')) and
         merge == [env['GITHUB_SHA'], BASE, head] and merge_tree == tree and
         live_pr.get('merge_commit_sha') == env['GITHUB_SHA'], 'R38_SERVICE_TEST_MERGE')
    need(live == dict(expected, source=head), 'R38_STALE_REFS')
    return 'GENUINE_EVENT_LIVE_PR_REFS_SERVICE_TEST_MERGE'

def fetch_pr(number):
    request = urllib.request.Request('https://api.github.com/repos/TasfiqJ/onSkin/pulls/'+str(number),
        headers={'Accept': 'application/vnd.github+json', 'User-Agent': 'onSkin-current38-source-integrity'})
    with urllib.request.urlopen(request, timeout=30) as response:
        raw = response.read(1024*1024+1)
    need(len(raw) <= 1024*1024, 'R38_LIVE_PR_SIZE')
    return document(raw)

def live_refs(include_source=False):
    names = {'refs/heads/main': 'main', **{'refs/heads/'+p[2]: 'pr'+str(n) for n, p in PINS.items()}}
    if include_source:
        names['refs/heads/'+BRANCH] = 'source'
    values = {}
    for line in text('ls-remote', '--exit-code', 'origin', *names).splitlines():
        sha, name = line.split()
        need(name in names and names[name] not in values and re.fullmatch('[0-9a-f]{40}', sha), 'R38_LIVE_REFS')
        values[names[name]] = sha
    need(set(values) == set(names.values()), 'R38_LIVE_REFS')
    return values

def service_merge_ref_guard(raw, ref, sha):
    need(type(ref) is str and re.fullmatch(r'refs/pull/[1-9][0-9]*/merge', ref) and
         type(sha) is str and re.fullmatch('[0-9a-f]{40}', sha) and
         raw == (sha+'\t'+ref+'\n').encode(), 'R38_SERVICE_MERGE_REF')


def snapshot(head):
    check = primitives().helpers()
    tree = check.tree29(head)
    index = git('ls-files', '--stage', '-z')
    need(index == b''.join((mode+' '+oid+' 0\t'+path+'\0').encode() for path, (mode, oid) in tree.items()), 'R38_INDEX')
    need(all(line.startswith(b'H ') for line in git('ls-files', '-v', '-z').split(b'\0') if line), 'R38_INDEX_FLAGS')
    need(not git(*primitives().filter_overrides(), 'status', '--porcelain=v1', '--untracked-files=all', '-z'), 'R38_DIRTY')
    return index, check.working29_guard(tree)

def verify(phase='SOURCE_FROZEN'):
    need(not sys.flags.optimize and phase in PHASES, 'R38_PHASE')
    primitives().helpers().full29_store()
    need(text('remote', 'get-url', 'origin').removesuffix('.git') == 'https://github.com/TasfiqJ/onSkin', 'R38_ORIGIN')
    authenticate_parent()
    head, tree = text('rev-parse', 'HEAD'), text('rev-parse', 'HEAD^{tree}')
    need(len(parents(head)) == 2 and text('merge-base', BASE, head) == BASE, 'R38_SOURCE_HEAD')
    in_ci = os.environ.get('GITHUB_ACTIONS') == 'true'
    if not in_ci:
        need(text('symbolic-ref', '--short', 'HEAD') == BRANCH, 'R38_BRANCH')
    if in_ci:
        need(phase == 'SOURCE_FROZEN', 'R38_CI_REQUIRES_SEAL')
    commits = text('rev-list', '--reverse', BASE+'..'+head).splitlines()
    need(len(commits) >= 2, 'R38_SOURCE_REQUIRED')
    substantive = commits[-1] if phase == 'SOURCE_PENDING' else commits[-2]
    source_paths = task_guard(document(git('show', substantive+':'+TASK)), lambda path: git('show', substantive+':'+path))
    source, seal = phase_guard(commits, phase, source_paths)
    need(git('show', head+':'+PLAN) == git('show', PLAN_COMMIT+':'+PLAN), 'R38_PLAN_IMMUTABLE')
    quality_guard(git('show', source+':.github/workflows/quality.yml'), git('show', BASE+':.github/workflows/quality.yml'))
    if seal:
        value = document(git('show', seal+':docs/phase-4/generated/source-worklist.json'))
        primitives().worklist_guard(value, source)
        need(value.get('warnings') == [] and value.get('summary', {}).get('warningCount') == 0 and
             value.get('summary', {}).get('blockerCount') == 0, 'R38_WORKLIST_WARNINGS')
        markdown = git('show', seal+':docs/phase-4/generated/source-worklist.md')
        need(('Git SHA: '+source).encode() in markdown and b'Git status: clean' in markdown, 'R38_WORKLIST_MARKDOWN')
        run_readonly(['node', 'scripts/phase4/build-source-worklist.mjs', '--strict', '--check'])
    before = snapshot(head)
    projection = scope(source_paths)
    for n, (phead, _, branch) in PINS.items():
        prior = PINS[n-1] if n > 35 else (MAIN, '', 'main')
        pr_guard(fetch_pr(n), n, phead, branch, prior[0], prior[2])
    live = live_refs(in_ci)
    event, merge, merge_tree, live_pr = {}, [], None, None
    if in_ci:
        path = Path(os.environ.get('GITHUB_EVENT_PATH', ''))
        need(path.is_absolute(), 'R38_EVENT_PATH')
        event = document(regular(path))
        number = event.get('number')
        need(type(number) is int and number > 40, 'R38_CI_EVENT')
        live_pr = fetch_pr(number)
        sha = os.environ.get('GITHUB_SHA', '')
        need(re.fullmatch('[0-9a-f]{40}', sha), 'R38_CI_SHA')
        ref = os.environ.get('GITHUB_REF', '')
        need(ref == 'refs/pull/'+str(number)+'/merge', 'R38_CI_EVENT')
        service_merge_ref_guard(git('ls-remote', '--exit-code', 'origin', ref), ref, sha)
        merge, merge_tree = parents(sha), text('rev-parse', sha+'^{tree}')
    qualification = ci_guard(os.environ, event, head, tree, merge, merge_tree, live, live_pr)
    need(snapshot(head) == before and text('rev-parse', 'HEAD') == head and live_refs(in_ci) == live, 'R38_FINAL_SNAPSHOT')
    return dict(valid=True, phase=phase, head=head, tree=tree, sourceHead=source, sealedHead=seal,
        parentHead=BASE, parentTree=BASE_TREE, changedSourcePaths=sorted(source_paths), trackedBlobsHashed=before[1],
        qualification=qualification, governance='CURRENT38_FINITE_SOURCE_ONLY', productScope=projection,
        historicalCheck='SEPARATE_FRESH_PR40_ORIGINAL37_36_35_34_33_32_29_REQUIRED',
        acceptanceGranted=False, admissions=dict.fromkeys(ADMISSIONS, False), release='NO_GO')


def run_readonly(args, expected=0, timeout=900):
    result = subprocess.run(args, cwd=ROOT, capture_output=True, timeout=timeout)
    need(result.returncode == expected, 'R38_READONLY_CHILD_EXIT')
    return result.stdout

def test_summary(raw, tests, passed, failed):
    lines = raw.replace(b'\r', b'').splitlines()
    for label, count in (('tests', tests), ('pass', passed), ('fail', failed), ('cancelled', 0), ('skipped', 0), ('todo', 0)):
        need(lines.count(('# '+label+' '+str(count)).encode()) == 1 and
             sum(line.startswith(('# '+label+' ').encode()) for line in lines) == 1, 'R38_TEST_INTERVAL')

def historical_python():
    # Old replay deliberately scrubs its environment again. A Windows Store
    # alias writes %SystemDrive% caches into cwd under that original scrub.
    # Use the already-installed normal interpreter; never ignore those files.
    path = Path(shutil.which('python') or sys.executable).resolve() if os.name == 'nt' else Path(sys.executable).resolve()
    need(path.is_file() and (os.name != 'nt' or 'windowsapps' not in str(path).lower()), 'R38_HISTORICAL_PYTHON')
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
        need(not args.external_readiness or args.scope is not None, 'R38_EXPLICIT_SCOPE_REQUIRED')
        result = historical() if args.historical else verify(args.phase)
        if args.scope:
            result = dict(result['productScope'], head=result['head'], tree=result['tree'], phase=args.phase,
                          sourceQualification=result['qualification'])
        print(json.dumps(result, sort_keys=True))
        return 2 if args.external_readiness else 0
    except Exception as exc:
        code = str(exc)
        reason = code if re.fullmatch(r'(?:R38|R37|R36|R35|R34|R33|R32|R29|R23)_[A-Z0-9_]{1,96}', code) else 'R38_EXECUTION_INCOMPLETE'
        print(json.dumps(dict(valid=False, error=reason, acceptanceGranted=False, release='NO_GO')))
        return 1

def plan_baselines(raw):
    rows = re.findall(r'^\| ([^|]+) \| (ABSENT|100644) \| (ABSENT|[0-9a-f]{40}) \| (ABSENT|[0-9a-f]{64}) \|$', raw.decode('utf-8'), re.MULTILINE)
    return [dict(path=p, mode=None if mode=='ABSENT' else mode,
                 blob=None if blob=='ABSENT' else blob, sha256=None if sha=='ABSENT' else sha)
            for p,mode,blob,sha in rows]


def authenticate_parent():
    for head, tree, _ in PINS.values():
        need(text('rev-parse', head+'^{tree}') == tree, 'R38_PARENT_TREE')
    chain = [PINS[39][0], '55372107ca1d6138477627ef863fba329aa6c42d',
             '85fbcc3281a0d23815a16d40fb9a90d0ae712ff3', BASE]
    need(text('rev-list','--reverse',chain[0]+'..'+BASE).splitlines() == chain[1:], 'R38_PARENT_PHASES')
    for a,b in zip(chain,chain[1:]): need(parents(b)==[b,a], 'R38_PARENT_LINEAR')
    old_plan = 'docs/brain/task-specs/M1X-37/SCOPE_PLAN.md'
    need(changed(chain[0],chain[1],{old_plan})=={old_plan} and
         digest(git('show',chain[1]+':'+old_plan))=='b43e72db487321b7caf91d6de67bbfbf318837970f351579163629264817bed5', 'R38_PARENT_PLAN')
    old_task = 'docs/brain/task-specs/M1X-37/TASK.md'
    value = document(git('show',chain[-2]+':'+old_task))
    expected = {'scripts/release/full-app-j01/main_integration37.test.py', 'scripts/release/full-app-j01/source_consumer37.test.py', 'scripts/e2e/compact-shelf-target37.test.mjs', 'scripts/e2e/onboarding-first-session35.test.mjs', 'docs/release/full-app-j01/compact-shelf-first-session37.md', 'docs/USER_FLOW_TREE.md', 'scripts/e2e/onboarding-first-session.mjs', 'docs/brain/task-specs/M1X-37/TASK.md', 'scripts/release/full-app-j01/main_integration37.py', 'PROGRESS.md', '.github/workflows/quality.yml'}
    need(changed(chain[1],chain[-2],expected)==expected and changed(chain[-2],BASE,WORKLIST)==WORKLIST,'R38_PARENT_SOURCE_SEAL')
    need(value.get('base')==chain[0] and value.get('baseTree')==PINS[39][1] and value.get('planCommit')==chain[1] and
         value.get('authority')=='BRAIN-M1X-COMPACT-SHELF-FIRST-SESSION37-SOURCE-CANDIDATE-01' and
         set(value.get('sourceHashes',{}))==expected-{old_task},'R38_PARENT_LEDGER')
    no_admission(value,'R38_PARENT_LEDGER')
    for name,sha in value['sourceHashes'].items():
        need(digest(git('show',chain[-2]+':'+name))==sha and git('show',chain[-2]+':'+name)==git('show',BASE+':'+name),'R38_PARENT_SOURCE_HASH')
    primitives().worklist_guard(document(git('show',BASE+':docs/phase-4/generated/source-worklist.json')),chain[-2])
    for name,sha in PROGRAMS.items():
        need(digest(regular(ROOT/PREFIX/name))==sha and digest(git('show',BASE+':'+PREFIX+name))==sha,'R38_ORIGINAL_PROGRAM')
    need(parents(PLAN_COMMIT)==[PLAN_COMMIT,BASE] and changed(BASE,PLAN_COMMIT,{PLAN})=={PLAN} and
         digest(git('show',PLAN_COMMIT+':'+PLAN))==PLAN_SHA,'R38_PLAN_FIRST')
    plan = git('show',PLAN_COMMIT+':'+PLAN)
    expected_rows = [{k:r[k] for k in ('path','mode','blob','sha256')} for r in BASELINES]
    need(plan_baselines(plan)==expected_rows and len(BASELINES)==32 and
         len({r['path'] for r in BASELINES})==32 and {r['path'] for r in BASELINES}==GRANT,'R38_PLAN_BASELINES')
    for row in BASELINES:
        entry=git('ls-tree',BASE,'--',row['path'])
        if row['blob'] is None:
            need(entry==b'','R38_BASELINE_ABSENT')
        else:
            raw=git('show',BASE+':'+row['path'])
            need(entry==(row['mode']+' blob '+row['blob']+'\t'+row['path']+'\n').encode() and
                 len(raw)==row['bytes'] and digest(raw)==row['sha256'],'R38_BASELINE_IDENTITY')


def original37_reader():
    path = ROOT/PREFIX/'main_integration37.py'
    raw = regular(path)
    need(digest(raw)==PROGRAMS[path.name], 'R38_ORIGINAL37_IDENTITY')
    namespace = {'__name__':'authenticated_original37_neutral_transcript_reader_only','__file__':str(path)}
    exec(compile(raw,str(path),'exec'),namespace)
    return SimpleNamespace(**namespace)


def historical_result(raw):
    lines = [line for line in raw.replace(b'\r',b'').splitlines() if line]
    need(len(lines)==2 and lines[0].startswith(b'R37_HISTORICAL_WORKSPACE '),'R38_HISTORICAL_TRANSCRIPT')
    value = document(lines[-1]); no_admission(value,'R38_HISTORICAL_NO_ADMISSION')
    need(value.get('status')=='PASS' and value.get('historicalHead')==PINS[39][0] and
         value.get('historicalTree')==PINS[39][1] and value.get('qualification')==
         'FRESH_AUTHENTIC_PR39_36_35_34_33_32_29_NOT_CURRENT_OR_OWNER_ACCEPTANCE','R38_HISTORICAL_PIN')
    workspace = Path(value.get('workspace',''))
    need(workspace.is_absolute() and lines[0]==('R37_HISTORICAL_WORKSPACE '+str(workspace)).encode(),'R38_HISTORICAL_WORKSPACE')
    receipts=value.get('receipts')
    names=['clone-pr39','checkout-named36','node-version','normal-npm-ci','postinstall-check',
           'original36-main_integration36.test.py','original36-source_consumer36.test.py',
           'original36-exact-source','original36-authentic-historical']
    need(type(receipts) is list and [r.get('name') for r in receipts]==names,'R38_HISTORICAL_INTERVAL')
    root=workspace/'pr39'; python=historical_python(); node=receipts[2].get('command',[None])[0]
    need(type(node) is str and Path(node).is_absolute(),'R38_HISTORICAL_COMMAND')
    expected={
        'clone-pr39':['git','clone','--no-local','--no-hardlinks','--no-checkout','--single-branch','--branch',PINS[39][2],
            '-c','core.autocrlf=false','-c','core.longpaths=true','https://github.com/TasfiqJ/onSkin.git',str(root)],
        'checkout-named36':['git','checkout',PINS[39][2]],
        'node-version':[node,'--version'],
        'postinstall-check':[node,'scripts/postinstall.mjs','--check'],
        'original36-main_integration36.test.py':[python,'-I','-B',PREFIX+'main_integration36.test.py'],
        'original36-source_consumer36.test.py':[python,'-I','-B',PREFIX+'source_consumer36.test.py'],
        'original36-exact-source':[python,'-I','-B',PREFIX+'main_integration36.py'],
        'original36-authentic-historical':[python,'-I','-B',PREFIX+'main_integration36.py','--historical']}
    for row in receipts:
        name=row['name']
        need(type(row.get('exit')) is int and row['exit']==row.get('expectedExit')==0 and row.get('timedOut') is False,
             'R38_HISTORICAL_CHILD')
        need(row.get('historicalHead')==PINS[39][0] and row.get('historicalTree')==PINS[39][1], 'R38_HISTORICAL_PIN')
        log=workspace/'logs'/(name+'.log')
        need(row.get('log')==str(log),'R38_HISTORICAL_LOG_PATH')
        body=regular(log,8*1024*1024)
        need(len(body)==row.get('bytes') and digest(body)==row.get('sha256'),'R38_HISTORICAL_LOG_HASH')
        command=row.get('command')
        if name=='normal-npm-ci':
            need(type(command) is list and len(command)==6 and command[0]==node and Path(command[1]).is_absolute() and
                 Path(command[1]).name=='npm-cli.js' and command[2:]==['ci','--ignore-scripts=false','--no-audit','--no-fund'],
                 'R38_HISTORICAL_COMMAND')
        else: need(command==expected[name],'R38_HISTORICAL_COMMAND')
        if name=='original36-exact-source':
            need(document(body)==value.get('original36'),'R38_ACTUAL_TRANSCRIPT')
        if name=='original36-authentic-historical':
            need(original37_reader().historical_result(body)==value.get('original36Historical'),'R38_NESTED_ACTUAL_TRANSCRIPT')
    original=value.get('original36',{})
    need(original.get('valid') is True and original.get('head')==PINS[39][0] and original.get('tree')==PINS[39][1] and
         original.get('governance')=='CURRENT36_FINITE_SOURCE_ONLY' and
         original.get('qualification')=='LOCAL_EXACT_CHECKOUT_NOT_HOSTED_CI', 'R38_ORIGINAL36_VERDICT')
    no_admission(original,'R38_ORIGINAL36_NO_ADMISSION')
    return value


def historical():
    """Fresh full named PR40 checkout; original37 verifies only its own source."""
    authenticate_parent(); start=text('rev-parse','HEAD')
    env=primitives().clean_environment(); python=historical_python()
    workspace=Path(tempfile.mkdtemp(prefix='integration38-')).resolve()
    need(not workspace.is_relative_to(ROOT),'R38_EXTERNAL_CLONE')
    root=workspace/'pr40'; logs=workspace/'logs'; logs.mkdir()
    print('R38_HISTORICAL_WORKSPACE '+str(workspace),file=sys.stderr,flush=True)
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
        need(not timed_out and len(raw)<=8*1024*1024,'R38_HISTORICAL_TIMEOUT_OR_OUTPUT')
        need(process.returncode==expected,'R38_HISTORICAL_CHILD_EXIT')
        return raw
    run('clone-pr40',['git','clone','--no-local','--no-hardlinks','--no-checkout','--single-branch','--branch',PARENT_BRANCH,
        '-c','core.autocrlf=false','-c','core.longpaths=true','https://github.com/TasfiqJ/onSkin.git',str(root)],workspace)
    run('checkout-named37',['git','checkout',PARENT_BRANCH])
    def pinned(*args): return subprocess.check_output(['git','--no-replace-objects',*args],cwd=root,env=env).decode().strip()
    need(pinned('rev-parse','HEAD')==BASE and pinned('rev-parse','HEAD^{tree}')==BASE_TREE and pinned('rev-parse','--is-shallow-repository')=='false',
         'R38_HISTORICAL_PIN')
    for name,sha in PROGRAMS.items(): need(digest(regular(root/PREFIX/name))==sha,'R38_HISTORICAL_PROGRAM')
    node=Path(shutil.which('node')).resolve()
    candidates=[node.parent/'node_modules/npm/bin/npm-cli.js'] if os.name=='nt' else [node.parent.parent/'lib/node_modules/npm/bin/npm-cli.js']
    if env.get('APPDATA'): candidates.insert(0,Path(env['APPDATA'])/'npm/node_modules/npm/bin/npm-cli.js')
    config=workspace/'empty.npmrc'; config.write_bytes(b''); env.update(npm_config_userconfig=os.devnull,npm_config_globalconfig=str(config))
    need(run('node-version',[str(node),'--version']).strip()==b'v22.21.0','R38_RUNTIME')
    npm=next((p for p in candidates if p.is_file() and subprocess.check_output([str(node),str(p),'--version'],env=env).strip()==b'11.20.0'),None)
    need(npm is not None,'R38_RUNTIME')
    run('normal-npm-ci',[str(node),str(npm),'ci','--ignore-scripts=false','--no-audit','--no-fund'])
    run('postinstall-check',[str(node),'scripts/postinstall.mjs','--check'])
    for name in ('main_integration37.test.py','source_consumer37.test.py'):
        run('original37-'+name,[python,'-I','-B',PREFIX+name])
    run('original37-driver83',[str(node),'--test','scripts/e2e/onboarding-first-session35.test.mjs',
        'scripts/e2e/retained-safety-assertions.test.mjs','scripts/e2e/compact-shelf-target37.test.mjs'])
    verdict=document(run('original37-exact-source',[python,'-I','-B',PREFIX+'main_integration37.py']))
    need(verdict.get('valid') is True and verdict.get('head')==BASE and verdict.get('tree')==BASE_TREE and
         verdict.get('governance')=='CURRENT37_FINITE_SOURCE_ONLY' and verdict.get('qualification')=='LOCAL_EXACT_CHECKOUT_NOT_HOSTED_CI',
         'R38_ORIGINAL37_VERDICT')
    no_admission(verdict,'R38_ORIGINAL37_NO_ADMISSION')
    projection=document(run('original37-fullapp-scope',[python,'-I','-B',PREFIX+'main_integration37.py','--scope','full-app-j01-v2']))
    need(projection.get('head')==BASE and projection.get('tree')==BASE_TREE and projection.get('externalReady') is False and
         projection.get('acceptanceGranted') is False and projection.get('release')=='NO_GO', 'R38_ORIGINAL37_SCOPE')
    run('original37-external-readiness-refusal',[python,'-I','-B',PREFIX+'main_integration37.py','--scope','full-app-j01-v2','--external-readiness'],expected=2)
    nested=historical_result(run('original37-authentic-historical',[python,'-I','-B',PREFIX+'main_integration37.py','--historical'],timeout=10800))
    need(pinned('status','--porcelain=v1','--untracked-files=all')=='' and pinned('rev-parse','HEAD')==BASE and text('rev-parse','HEAD')==start,
         'R38_HISTORICAL_CHANGED')
    return dict(status='PASS',historicalHead=BASE,historicalTree=BASE_TREE,original37=verdict,original37Scope=projection,original37Historical=nested,
        receipts=receipts,workspace=str(workspace),qualification='FRESH_AUTHENTIC_PR40_37_36_35_34_33_32_29_NOT_CURRENT_OR_OWNER_ACCEPTANCE',
        acceptanceGranted=False,admissions=dict.fromkeys(ADMISSIONS,False),release='NO_GO')


if __name__ == '__main__':
    sys.exit(main())
