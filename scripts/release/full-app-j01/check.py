"""Release08 governance validation only; exit0 never grants release or feature admission."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys

BASE = '50f25abeafaa6127e105e2a9d825e6d15dc1dcdb'
ROOT = Path(__file__).resolve().parents[3]
BUNDLE = ROOT / 'docs/release/full-app-j01'
FILES = ['contract.v1.json', 'matrix.v1.json', 'precedence.v1.json',
         'roadmap.v1.json', 'history-crosswalk.v1.json']
F = [f'F{i:02}' for i in range(1, 21)]
C = [f'V2-C{i:02}' for i in range(1, 13)]
P = [f'P{i:02}' for i in range(1, 7)]
J = [f'J{i:02}' for i in range(1, 28)]
SNAPSHOTS = {
    'roadmap_47.json': ('tasks', 47, '7b6c4772e891babd310b40c421d036c91a51b340b5485448e7aa99d1b499fb39', 'roadmap.json'),
    'adr_registry_51.json': ('records', 51, '2f910cf0cd0c473474141ff81bb7d639f2fba8bc10dc306b52243d5e52b215c1', 'ADR_REGISTRY.json'),
}
GATE_STATUS = dict(zip(
    ['G97', 'DB', 'M1-03', 'M2-01', 'G1', 'G2', 'G3', 'G4', 'G5', 'RIGHTS',
     'CLINICAL', 'PROVIDER', 'PAYMENT', 'MODERATION', 'OPERATIONS', 'DEVICE', 'APPLE', 'PUBLIC'],
    ['FAIL/NO_GO', 'H01_SQL_PROBE_FAILED', 'BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED',
     'NOT_AUTHORIZED', 'NOT_RUN', 'NOT_ACCEPTED', 'NOT_ACCEPTED', 'CLOSED',
     'NOT_ACCEPTED', 'GATED', 'GATED', 'NOT_RUN', 'NOT_RUN', 'NOT_RUN',
     'NOT_RUN', 'NOT_RUN', 'NOT_AUTHORIZED', 'NOT_AUTHORIZED']))
SAFE_DOCS = {f'docs/{name}.md' for name in
             ['MASTER_PLAN', 'PRODUCT_REQUIREMENTS', 'FEATURE_INDEX', 'ROADMAP', 'DECISIONS']}
NEW_PREFIXES = ('docs/release/full-app-j01/', 'scripts/release/full-app-j01/',
                'docs/brain/contracts/RELEASE-08/', 'docs/brain/task-specs/RELEASE-08/',
                'docs/brain/checkpoints/RELEASE-08/FULL-APP-J01-CONTRACT/')


def require(ok, label):
    if not ok:
        raise ValueError(label)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False).encode('utf-8')


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, stderr=subprocess.PIPE)


def regular(path):
    for p in [path] + list(path.parents):
        s = p.lstat()
        require(not stat.S_ISLNK(s.st_mode) and not (getattr(s, 'st_file_attributes', 0) & 1024),
                f'REGULAR_PATH: link/reparse component {p}')
    require(path.is_file(), f'REGULAR_PATH: not a file {path}')
    return path.read_bytes()


def pairs(items):
    result = {}
    for key, value in items:
        require(key not in result, f'JSON_DUPLICATE_KEY:{key}')
        result[key] = value
    return result


def load(path):
    return json.loads(regular(path).decode('utf-8'), object_pairs_hook=pairs,
                      parse_constant=lambda x: (_ for _ in ()).throw(ValueError('JSON_NONFINITE:'+x)))


def schema_check(value, schema, where='$'):
    """Strict local JSON-Schema subset. Unknown keywords fail, never silently ignored."""
    allowed = {'$schema', 'description', 'type', 'const', 'enum', 'properties', 'required',
               'additionalProperties', 'items', 'minItems', 'maxItems', 'uniqueItems', 'minLength'}
    require(set(schema) <= allowed, f'SCHEMA_UNSUPPORTED:{where}')
    types = {'object': dict, 'array': list, 'string': str, 'boolean': bool,
             'integer': int, 'null': type(None)}
    if 'type' in schema:
        require(type(value) is types[schema['type']], f'SCHEMA_TYPE:{where}')
    if 'const' in schema:
        require(type(value) is type(schema['const']) and value == schema['const'], f'SCHEMA_CONST:{where}')
    if 'enum' in schema:
        require(value in schema['enum'], f'SCHEMA_ENUM:{where}')
    if isinstance(value, dict):
        props = schema.get('properties', {})
        require(set(schema.get('required', [])) <= set(value), f'SCHEMA_REQUIRED:{where}')
        if schema.get('additionalProperties') is False:
            require(set(value) <= set(props), f'SCHEMA_UNKNOWN_KEY:{where}')
        for key, item in value.items():
            if key in props:
                schema_check(item, props[key], where+'/'+key)
    elif isinstance(value, list):
        require(len(value) >= schema.get('minItems', 0), f'SCHEMA_MIN_ITEMS:{where}')
        require(len(value) <= schema.get('maxItems', len(value)), f'SCHEMA_MAX_ITEMS:{where}')
        if schema.get('uniqueItems'):
            require(len({canonical(x) for x in value}) == len(value), f'SCHEMA_DUPLICATE:{where}')
        for n, item in enumerate(value):
            schema_check(item, schema.get('items', {}), where+'/'+str(n))
    elif isinstance(value, str):
        require(len(value.strip()) >= schema.get('minLength', 0), f'SCHEMA_MIN_LENGTH:{where}')


def same(actual, expected, label):
    require(isinstance(actual, list) and len(actual) == len(expected)
            and len(set(actual)) == len(actual) and set(actual) == set(expected), label)


def allowed_path(path):
    return path in SAFE_DOCS or path == 'ONSKIN_BRAIN_HANDOFF.txt' or path.startswith(NEW_PREFIXES)



RELEASE08 = 'd08347f0011672cd309d835628c094b5e9f4725d'
RELEASE09_AUTHORITY = 'BRAIN-RELEASE09-SOURCE-PACKET-CI-CANDIDATE-01'
RELEASE09_EXISTING = {
    'scripts/docs/source-packet-audit.mjs',
    'docs/generated/source-packet-audit.json', 'docs/generated/source-packet-audit.md',
    '.github/workflows/quality.yml', 'scripts/release/full-app-j01/check.py',
    'scripts/release/full-app-j01/test_contract.py', 'ONSKIN_BRAIN_HANDOFF.txt',
}
RELEASE09_NEW = {
    'docs/release/full-app-j01/source-packet-supersession09.v1.json',
    'docs/release/full-app-j01/consumer-scope09.md',
    'scripts/docs/source-packet-supersession09.test.mjs',
    'scripts/release/full-app-j01/source_consumer09.test.py',
}
RELEASE09_PREFIXES = ('docs/brain/contracts/RELEASE-09/',
    'docs/brain/task-specs/RELEASE-09/',
    'docs/brain/checkpoints/RELEASE-09/SOURCE-PACKET-CONSUMER/')
# Exactly one additive step; the rest of quality.yml remains byte-authenticated.
RELEASE09_STEP = b'\n      - name: Check Release09 candidate full-app J01 governance\n        run: |\n          set -euo pipefail\n          if [ "$(git rev-parse --is-shallow-repository)" = true ]; then\n            git fetch --no-tags --unshallow origin\n          fi\n          python3 -B scripts/release/full-app-j01/check.py\n          python3 -B scripts/release/full-app-j01/test_contract.py\n          python3 -B scripts/release/full-app-j01/source_consumer09.test.py\n          node scripts/docs/source-packet-supersession09.test.mjs\n'


def allowed09(path):
    return (isinstance(path, str) and not re.search(r'(^/|\\|:|(^|/)\.\.?(/|$))', path)
            and (path in RELEASE09_EXISTING or path in RELEASE09_NEW
                 or path.startswith(RELEASE09_PREFIXES)))


def validate09_diff(raw, read_after):
    """Parse actual --raw -z Git deltas: no rename, deletion, symlink or broad prefix grant."""
    fields = raw.split(b'\0')
    require(fields[-1] == b'' and len(fields) % 2 == 1, 'R09_DIFF_SHAPE')
    for n in range(0, len(fields)-1, 2):
        metadata = fields[n].decode().split()
        path = fields[n+1].decode('utf-8')
        require(len(metadata) == 5 and metadata[0].startswith(':'), 'R09_DIFF_META')
        oldmode, newmode, oldblob, newblob, status = metadata
        require(allowed09(path) and status in ('A', 'M'), 'R09_SCOPE:'+path)
        require(newmode == '100644' and oldmode in (':000000', ':100644'), 'R09_MODE:'+path)
        require((path in RELEASE09_EXISTING) == (oldmode != ':000000'), 'R09_CREATE_EDIT:'+path)
        if path == '.github/workflows/quality.yml':
            before = git('show', RELEASE08+':'+path)
            expected = before.replace(b'\n  expo-export:\n', RELEASE09_STEP+b'\n  expo-export:\n')
            require(read_after(path) == expected, 'R09_WORKFLOW_EXACT_ADDITION')


def source09_guard():
    require(git('rev-parse', RELEASE08+'^{tree}').decode().strip() ==
            '0998881bc543840395dca375769ea1b7c9a8d4c7', 'R09_BASE_TREE')
    subprocess.run(['git', 'merge-base', '--is-ancestor', RELEASE08, 'HEAD'],
                   cwd=ROOT, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    # Authenticate every intermediate committed state against the immutable R08
    # endpoint, then the index/working tree and every untracked path separately.
    for commit in git('rev-list', '--reverse', RELEASE08+'..HEAD').decode().splitlines():
        raw = git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE08, commit)
        validate09_diff(raw, lambda path: git('show', commit+':'+path))
    validate09_diff(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE08),
                    lambda path: regular(ROOT/path))
    for path in git('ls-files', '--others', '--exclude-standard', '-z').decode().split('\0'):
        if path:
            require(allowed09(path) and path not in RELEASE09_EXISTING, 'R09_UNTRACKED_SCOPE:'+path)
            regular(ROOT/path)
    for path in SAFE_DOCS:
        require(regular(ROOT/path) == git('show', RELEASE08+':'+path), 'R09_NOTICE_IMMUTABLE:'+path)
    # Invoke the real source producer in read-only/current mode. This also binds
    # the fixed manifest, every original packet byte and exact additive inserts.
    result = subprocess.run(['node', 'scripts/docs/source-packet-audit.mjs', '--strict', '--check'],
                            cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
    require(result.returncode == 0, 'R09_SOURCE_PACKET:'+result.stdout+result.stderr)


def source_guard():
    # Examine every changed path and mode, including intermediate committed states.
    index = {}
    for line in git('ls-tree', '-r', BASE).decode().splitlines():
        metadata, path = line.split('\t', 1)
        mode, kind, blob = metadata.split()
        index[path] = (mode, kind, blob)
    require(git('rev-parse', BASE+'^{tree}').decode().strip() ==
            'f623b5bbd220fd6d9d10f967400081489a5dd7e0', 'BASE_TREE')
    intervals = [BASE] + git('rev-list', '--reverse', BASE+'..'+RELEASE08).decode().splitlines()
    for commit in intervals:
        for line in git('diff-tree', '--root', '--no-commit-id', '--name-status', '-r',
                        BASE, commit).decode().splitlines():
            status, path = line.split('\t', 1)
            require(allowed_path(path) and not status.startswith(('D', 'R', 'C')),
                    'COMMIT_SCOPE:'+commit+':'+path)
    source09_guard()
    for path in git('diff', '--name-only', BASE).decode().splitlines():
        require(allowed_path(path) or allowed09(path), 'WORKING_SCOPE:'+path)
    for path in git('ls-files', '--others', '--exclude-standard').decode().splitlines():
        require(allowed_path(path) or allowed09(path), 'UNTRACKED_SCOPE:'+path)
    for path in SAFE_DOCS:
        original = git('show', BASE+':'+path)
        actual = regular(ROOT/path)
        first, rest = original.split(b'\n', 1)
        require(actual.startswith(first+b'\n') and actual.endswith(rest), 'LEGACY_DOC_BYTES:'+path)
        inserted = actual[len(first)+1:len(actual)-len(rest)]
        require(inserted.count(b'Release08 proposed public-product scope') == 1 and
                b'NOT_DONE' in inserted and b'closed' in inserted, 'PRECEDENCE_NOTICE:'+path)
    return index


def validate(bundle=BUNDLE):
    schema = load(bundle/'schema.v1.json')
    require(schema.get('$schema') == 'https://json-schema.org/draft/2020-12/schema', 'SCHEMA_DIALECT')
    data = {name: load(bundle/name) for name in FILES}
    schema_check(data, schema)
    c, m, p, dag, hist = [data[x] for x in FILES]
    index = None
    checked = {}

    def witness(x):
        nonlocal index
        if index is None:
            index = source_guard()
        path = x['path']
        require(isinstance(path, str) and not re.search(r'(^/|\\|:|(^|/)\.\.?(/|$))', path), 'SOURCE_PATH')
        require(path in index, 'SOURCE_ABSENT:'+path)
        mode, kind, blob = index[path]
        require(kind == 'blob' and mode in ('100644', '100755'), 'SOURCE_MODE:'+path)
        require(x['source_commit'] == BASE and x['mode'] == mode and x['blob'] == blob, 'SOURCE_IDENTITY:'+path)
        if path not in checked:
            checked[path] = (sha(regular(ROOT/path)), sha(git('show', BASE+':'+path)))
        require(x['sha256'] == checked[path][0], 'SOURCE_SHA256:'+path)
        # Source links always bind immutable base bytes; the five notices are checked separately.
        require(x['sha256'] == checked[path][1], 'BASE_BLOB_SHA256:'+path)

    require(c['schema_version'] == 1 and c['contract_id'] == 'onskin-full-app-j01-release08-v1', 'CONTRACT_VERSION')
    require(c['authorization'] == 'BRAIN-RELEASE-FULLAPP-J01-REBASE08-CANDIDATE-01' and
            c['proposal_status'] == 'SUBMITTED_REVIEW_REQUIRED', 'NO_SELF_ACCEPTANCE')
    require(c['decision_id'] == 'BRAIN-RELEASE-SCOPE-FULL-APP-J01-2026-10-24-01', 'PRODUCT_AUTHORITY')
    require(c['source_base'] == BASE and c['source_base_tree'] == 'f623b5bbd220fd6d9d10f967400081489a5dd7e0', 'CONTRACT_BASE')
    for key, ids in [('required_f', [i for i in F if i != 'F18']), ('required_c', C), ('required_p', P),
                     ('korean_candidates', ['J01']), ('deferred_f', ['F18']), ('deferred_j', J[1:])]:
        same(c[key], ids, 'FINITE_IDS:'+key)
    require(c['spend_usd'] == 0 and type(c['spend_usd']) is int, 'ZERO_SPEND')
    require(all(x is False for x in c['admissions'].values()), 'NO_ADMISSION')
    release = c['release']
    require(release == dict(platforms=['ios'], minimum_ios='17.0', ipad=False, android_release=False,
        adult_minimum_age=18, storefront_candidate='US',
        closed_cohort_candidate='California resident adults and qualified California nonmedical professionals',
        public_territory_status='NOT_CLEARED', measurement_device_profiles=[], version='NOT_ASSIGNED', public_date=None), 'PLATFORM_TERRITORY')
    require(c['diary'] == dict(required=True, history=True, manual_comparison=True, automated_trend=False), 'F09_NOT_F18')
    require(c['offer'] == dict(strategy='APPROVED_APPLE_MANAGED_OFFER', unsafe_custom_reverse_grant=False,
                             current_subscriber_terms_preserved=True), 'SAFE_OFFER')
    j = c['j01']
    require(j['implementation'] == 'NOT_IMPLEMENTED_OR_VALIDATED' and j['intake'] == 'MISSING_IN_AUTHENTICATED_INTAKE'
            and j['requested_packet'] == 'J01_Important_Documents.zip' and not j['authenticated_research'], 'J01_INTAKE')
    same(j['single_scan_requires'], ['G1', 'G2', 'G3', 'G5'], 'J01_SINGLE_SCAN_GATES')
    same(j['change_requires'], ['G1', 'G2', 'G3', 'G4', 'G5'], 'J01_G4_CHANGE_GATE')
    require(j['fallback'] == ['unavailable', 'retake'] and j['on_device_only'] is True
            and all(x is False for x in j['claims'].values()), 'J01_NO_CLAIMS')
    same([g['id'] for g in c['gates']], list(GATE_STATUS), 'GATE_IDENTITIES')
    for g in c['gates']:
        require(g['status'] == GATE_STATUS[g['id']] and g['admitted'] is False and not g['evidence'],
                'GATE_CLOSED:'+g['id'])
        require(g['owner'].strip() and g['acceptance'].strip(), 'GATE_OWNER:'+g['id'])

    same([r['id'] for r in m['rows']], F+C+P+J, 'MATRIX65_IDENTITIES')
    require(m['observed_source'] == BASE and m['row_count'] == 65 and m['required_count'] == 38, 'MATRIX_COUNTS')
    rows = {r['id']: r for r in m['rows']}
    legacy = load(ROOT/'docs/hugeToDo/launch-contract.json')
    legacy_features = legacy['requiredFeatures'] + legacy['deferredFeatures']
    mods = {x['id']: x for x in load(ROOT/'docs/v2/mirrors/modules.json')['modules']}
    for i, r in rows.items():
        deferred = i == 'F18' or i in J[1:]
        require(r['disposition'] == ('DEFERRED' if deferred else 'REQUIRED') and
                r['status'] == ('DEFERRED' if deferred else 'REQUIRED_PENDING'), 'ROW_STATUS:'+i)
        require(r['positive_output_enabled'] is False and r['complete'] is False and not r['evidence_receipts'], 'NO_STUB_GREEN:'+i)
        require(all(r['evidence_axes'][x] == 'NOT_RUN' for x in
                    ['integration', 'device', 'qualified_review', 'provider']) and
                r['evidence_axes']['public_release'] == 'NOT_AUTHORIZED' and
                r['evidence_axes']['source'] == r['source_maturity'], 'ROW_EVIDENCE:'+i)
        allowed_maturity = ['ACCEPTED_SCOPED_RETAINED_SOURCE', 'SOURCE_CANDIDATE_GATED'] if i in F else (
            ['NOT_IMPLEMENTED_OR_VALIDATED'] if i in J else ['SPECIFICATION_WITH_UNIMPLEMENTED_DELTA'])
        require(r['source_maturity'] in allowed_maturity, 'SOURCE_MATURITY:'+i)
        require(r['owner_roles'] and r['source_refs'] and r['gaps'] and r['acceptance_behavior'].strip(), 'ROW_TRACEABILITY:'+i)
        for x in r['source_refs']: witness(x)
        require(set(r['gates']) <= set(GATE_STATUS) and 'PUBLIC' in r['gates'] and
                'G97' in r['gates'] and 'DB' in r['gates'], 'ROW_GATES:'+i)
        needs = {'F01':['RIGHTS','APPLE'], 'F03':['RIGHTS','DEVICE'],
                 'F04':['RIGHTS','PROVIDER','OPERATIONS'], 'F09':['DEVICE','G5'],
                 'F10':['DEVICE'], 'F11':['PAYMENT','PROVIDER','APPLE','DEVICE'],
                 'F12':['PAYMENT','APPLE'], 'F14':['PROVIDER'],
                 'F16':['RIGHTS','PROVIDER','PAYMENT','CLINICAL'],
                 'F17':['MODERATION','OPERATIONS','CLINICAL'], 'F19':['DEVICE','APPLE'],
                 'F20':['OPERATIONS','MODERATION','RIGHTS'], 'P06':['PAYMENT','APPLE'],
                 'V2-C10':['PAYMENT','APPLE']}.get(i, [])
        if i in ['F05','F06','F08','F13','F14','F15']: needs += ['CLINICAL']
        if i in P: needs += ['PROVIDER','OPERATIONS','CLINICAL','M2-01']
        require(set(needs) <= set(r['gates']), 'ROW_REQUIRED_GATE:'+i)
        owners = {g['id']:g['owner'] for g in c['gates']}
        require({owners[k] for k in r['gates']} <= set(r['owner_roles']), 'ROW_QUALIFIED_OWNERS:'+i)
        require(set(r['related_ids']) <= set(rows) and i not in r['related_ids'], 'ROW_OVERLAP:'+i)
        if i in F:
            n = int(i[1:]); key = next(x['key'] for x in legacy_features if x['id'] == n)
            require(r['legacy_ids'] == [f'F-{n:02}', key], 'F_ALIAS:'+i)
        elif i in P: require(r['legacy_ids'] == ['V2-'+i], 'P_ALIAS:'+i)
        elif i in C: require(r['legacy_ids'] == [i], 'C_ALIAS:'+i)
        else:
            require(r['historical_registry'] == mods[i] and mods[i]['publication_admitted'] is False, 'J_REGISTRY:'+i)
            require(set(['G1', 'G2', 'G3', 'G4', 'G5']) <= set(r['gates']), 'J_ROW_GATES:'+i)
    require('manual' in rows['F09']['acceptance_behavior'] and rows['F09']['disposition'] == 'REQUIRED', 'F09_DIARY')
    require(p['status'] == 'PROPOSED_PUBLIC_PRODUCT_AUTHORITY_SOURCE_REVIEW_PENDING' and
            p['product_contract'] == 'contract.v1.json', 'PRECEDENCE_PROPOSAL')
    require(p['supersedes_product_scope'] == ['ios-lean-v1-2026', 'historical all20/F18 inclusion',
            'J05-first engineering priority'] and p['activation'] ==
            'NONE; JSON is documentation, never a feature flag', 'PRECEDENCE_LIMIT')
    require(p['order'][0] == 'Exact current human authorization and protected custody' and
            p['order'][1] == 'Independent Brain source acceptance and later ordinary promotion' and
            len(p['order']) == 5, 'PRECEDENCE_ORDER')
    require(p['preserves'] == ['Original Security/DB admission', 'Clinical and source rights',
            'Adult/owner/consent/privacy', 'Literal-zero commerce/trend/share/paid gates',
            'Apple/financial/native/public approvals', '47 historical task and51 ADR records'], 'PRECEDENCE_SAFETY')
    cut = p['cutover']
    require(cut['status'] == 'NOT_DONE' and cut['ci_wired'] is False and
            cut['runtime_consumers_migrated'] is False, 'NO_FAKE_CUTOVER')
    expected_consumers = git('grep', '-l', '-e', 'scripts/launch/contract', '-e', 'launch-contract.json',
                             BASE, '--', 'scripts', 'apps', '.github').decode().splitlines()
    require(cut['consumers'] == expected_consumers, 'LEGACY_CONSUMERS')
    require(p['legacy_technical_guard'] == dict(path='docs/hugeToDo/launch-contract.json',
            status='HISTORICALLY_ACCEPTED_TECHNICAL_GUARD', byte_stable=True), 'LEGACY_GUARD')
    for x in p['protected_witnesses']: witness(x)
    essential = {'docs/hugeToDo/launch-contract.json', 'scripts/launch/contract.mjs',
                 'scripts/launch/check-contract.mjs', 'scripts/launch/contract-smoke.mjs',
                 'package.json', 'package-lock.json', 'docs/brain/state/roadmap.json',
                 'docs/v2/mirrors/modules.json', '.github/workflows/ios-launch-contract.yml'}
    require(essential <= {x['path'] for x in p['protected_witnesses']}, 'PROTECTED_WITNESS_OMITTED')

    nodes = {n['id']: n for n in dag['nodes']}
    require(len(nodes) == len(dag['nodes']) == 17, 'DAG_IDENTITIES')
    owned = []
    for i, n in nodes.items():
        require(n['implementation_authorized'] is False and n['status'] ==
                ('SUBMITTED_REVIEW_REQUIRED' if i == 'R08-GOV' else 'GATED'), 'DAG_NOT_ISSUANCE:'+i)
        require(set(n['depends_on']) <= set(nodes) and i not in n['depends_on'], 'DAG_EDGE:'+i)
        require(set(n['gates']) <= set(GATE_STATUS), 'DAG_GATE:'+i)
        for ident in n['owns']:
            require(ident in rows and rows[ident]['delivery_node'] == i, 'DAG_ROW_OWNER:'+ident)
        owned.extend(n['owns'])
        required_gates = {
            'R08-GOV': [], 'R08-RESEARCH': [], 'R08-BASELINE': ['M1-03','G97','DB'],
            'R08-IDENTITY': ['RIGHTS','APPLE'], 'R08-LEDGER': ['M1-03','M2-01'],
            'R08-CATALOG': ['RIGHTS','PROVIDER'], 'R08-CORE': ['CLINICAL'],
            'R08-PAY': ['PAYMENT','APPLE','PROVIDER'],
            'R08-DECISIONS': ['CLINICAL','RIGHTS','PROVIDER'],
            'R08-PRO': ['PROVIDER','CLINICAL','OPERATIONS','PAYMENT'],
            'R08-OPERATIONS': ['OPERATIONS','MODERATION','RIGHTS'],
            'R08-COMMUNITY': ['MODERATION','OPERATIONS','CLINICAL'],
            'R08-COMMERCE': ['RIGHTS','PROVIDER','PAYMENT','CLINICAL'],
            'R08-NATIVE': ['DEVICE','APPLE','G5'], 'R08-J01': ['G1','G2','G3','G5'],
            'R08-INTEGRATION': ['G97','DB','CLINICAL','DEVICE','OPERATIONS'],
            'R08-APPLE': ['APPLE','PUBLIC'],
        }
        require(i in required_gates, 'DAG_UNKNOWN_NODE:'+i)
        same(n['gates'], required_gates[i], 'DAG_OPERATIONAL_GATES:'+i)
    same(owned, c['required_f']+C+P+['J01'], 'DAG38_EXACT_OWNERS')
    visiting, visited = set(), set()
    def visit(i):
        require(i not in visiting, 'DAG_CYCLE:'+i)
        if i in visited: return
        visiting.add(i)
        for parent in nodes[i]['depends_on']: visit(parent)
        visiting.remove(i); visited.add(i)
    for i in nodes: visit(i)
    require(dag['protected_dependencies'] == {'M2-01':['M1-03'], 'M2-02':['M2-01'],
            'M2-03':['M2-02'], 'M2-04':['M2-03']}, 'M103_TO_M2')
    require('R08-BASELINE' in nodes['R08-LEDGER']['depends_on'] and
            set(['M1-03', 'M2-01']) <= set(nodes['R08-LEDGER']['gates']), 'LEDGER_CUSTODY')
    require(set(['G1', 'G2', 'G3', 'G5']) <= set(nodes['R08-J01']['gates']) and
            set(['R08-RESEARCH', 'R08-LEDGER', 'R08-NATIVE']) <= set(nodes['R08-J01']['depends_on']), 'J01_DAG')
    require(dag['j05_measurement_enabled'] is False and dag['removed_priority_predecessor'] == 'M3-02'
            and dag['j01_change_requires'] == 'G4' and dag['public_date'] is None, 'PRIORITY_NOT_J05_ADMISSION')

    for filename, (key, count, expected_hash, live_name) in SNAPSHOTS.items():
        snap_path = bundle/'historical'/filename
        require(sha(regular(snap_path)) == expected_hash, 'AUTHENTIC_HISTORY:'+filename)
        snapshot = load(snap_path)[key]
        live_path = 'docs/brain/checkpoints/M1-03/SOURCE-CLOSURE-01/inputs/BRAIN_STATE/'+live_name
        live = load(ROOT/live_path)[key]
        cross = hist['task_rows' if key == 'tasks' else 'adr_rows']
        same([x['id'] for x in cross], [x['id'] for x in live], 'HISTORICAL_IDENTITIES:'+key)
        require(len(snapshot) == len(live) == len(cross) == count, 'HISTORICAL_COUNT:'+key)
        for n, (old, current, x) in enumerate(zip(snapshot, live, cross)):
            require(x['id'] == old['id'] == current['id'] and x['original_status'] == old['status'] == current['status'], 'HISTORICAL_STATUS:'+x['id'])
            require(x['packet_record_sha256'] == sha(canonical(old)) and
                    x['live_record_sha256'] == sha(canonical(current)), 'HISTORICAL_RECORD:'+x['id'])
            require(x['packet_pointer'] == f'historical/{filename}#/{key}/{n}' and
                    x['live_source']['path'] == live_path, 'HISTORICAL_PROVENANCE:'+x['id'])
            witness(x['live_source'])
            require(set(x['new_nodes']) <= set(nodes)|{'DEFERRED'} and x['new_nodes'], 'HISTORICAL_NODE:'+x['id'])
            require(x['disposition'] == 'HISTORICAL_STATUS_PRESERVED_NOT_NEW_ACCEPTANCE', 'HISTORY_NO_ACCEPTANCE')
            if key == 'tasks': require(old['depends_on'] == current['depends_on'], 'HISTORICAL_DEPS:'+x['id'])
    require(hist['packet_manifest_anchor'] == '2dd612c4aba524688c432081cf6fe7cc47b02dd69bcac8d2db98ee3ec0e3676a'
            and hist['source_base'] == BASE and hist['encoding_differences'] == [], 'HISTORY_AUTHORITY')
    return dict(valid=True, evidence_class='GOVERNANCE_CONSISTENCY_ONLY', required_rows=38,
                identities=65, historical_tasks=47, historical_adrs=51, release='NO_GO',
                source_acceptance='REVIEW_REQUIRED', legacy_cutover='NOT_DONE')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle-dir', type=Path, default=BUNDLE)
    args = parser.parse_args()
    try:
        print(json.dumps(validate(args.bundle_dir), sort_keys=True))
        return 0
    except (ValueError, KeyError, TypeError, OSError, subprocess.SubprocessError) as error:
        print(json.dumps(dict(valid=False, release='NO_GO', error=str(error)), sort_keys=True))
        return 1


if __name__ == '__main__':
    sys.exit(main())
