"""Release08 governance validation only; exit0 never grants release or feature admission."""
import argparse
import ast
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import unicodedata

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
RELEASE09 = '8ac97c32901272d97d1bff05f2abc294811055a6'
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


def validate09_diff(raw, read_after, historical_commit=None):
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
            expected = before.replace(b'      - name: Verify tooling security backports\n', RELEASE09_STEP.lstrip(b'\n')+b'\n      - name: Verify tooling security backports\n')
            # Preserve the immutable first candidate's exact last-step placement.
            # Working/future states must use the current early placement so this
            # independent guard is exercised before the blocked legacy worklist.
            if historical_commit == 'eb86be5298afd0fae3344ef6bf2a4db3b7ada116':
                expected = before.replace(b'\n  expo-export:\n', RELEASE09_STEP+b'\n  expo-export:\n')
            require(read_after(path) == expected, 'R09_WORKFLOW_EXACT_ADDITION')


def source09_guard():
    require(git('rev-parse', RELEASE08+'^{tree}').decode().strip() ==
            '0998881bc543840395dca375769ea1b7c9a8d4c7', 'R09_BASE_TREE')
    subprocess.run(['git', 'merge-base', '--is-ancestor', RELEASE08, RELEASE09],
                   cwd=ROOT, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    # Authenticate every intermediate committed state against the immutable R08
    # endpoint. Release10 separately checks the index, worktree and untracked paths
    # from the immutable Release09 endpoint; the original segment stays bounded.
    for commit in git('rev-list', '--reverse', RELEASE08+'..'+RELEASE09).decode().splitlines():
        raw = git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE08, commit)
        validate09_diff(raw, lambda path: git('show', commit+':'+path), historical_commit=commit)
    for path in SAFE_DOCS:
        require(regular(ROOT/path) == git('show', RELEASE08+':'+path), 'R09_NOTICE_IMMUTABLE:'+path)
    # Invoke the real source producer in read-only/current mode. This also binds
    # the fixed manifest, every original packet byte and exact additive inserts.
    result = subprocess.run(['node', 'scripts/docs/source-packet-audit.mjs', '--strict', '--check'],
                            cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
    require(result.returncode == 0, 'R09_SOURCE_PACKET:'+result.stdout+result.stderr)


RELEASE10_AUTHORITY = 'BRAIN-RELEASE10-QUALITY-PROJECTIONS-CONSUMERS-CANDIDATE-01'
RELEASE10_EXISTING = {
    'docs/phase-4/generated/source-worklist.json',
    'docs/phase-4/generated/source-worklist.md',
    'docs/generated/readiness-status-audit.json',
    'docs/generated/readiness-status-audit.md',
    'scripts/release/full-app-j01/check.py', 'ONSKIN_BRAIN_HANDOFF.txt',
}
# The conditional readiness-script grant is NOT activated: no deterministic bug
# was demonstrated. Missing governed provenance must remain a refusal.
RELEASE10_NEW = {
    'docs/release/full-app-j01/quality-projections10.md',
    'docs/release/full-app-j01/legacy-consumer-cutover10.unapplied.json',
    'scripts/release/full-app-j01/quality_projection10.test.py',
    'scripts/release/full-app-j01/source_consumer10.test.py',
}
RELEASE10_PREFIXES = ('docs/brain/contracts/RELEASE-10/',
    'docs/brain/task-specs/RELEASE-10/',
    'docs/brain/checkpoints/RELEASE-10/QUALITY-PROJECTIONS/')


def allowed10(path):
    return (isinstance(path, str) and
            re.fullmatch(r'[A-Za-z0-9._/-]+', path) is not None and
            all(part and part.casefold() not in ('.', '..', '.git') and not part.endswith('.') and
                re.fullmatch(r'(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?', part, re.I) is None
                for part in path.split('/')) and
            (path in RELEASE10_EXISTING or path in RELEASE10_NEW or
             path.startswith(RELEASE10_PREFIXES)))


def validate10_diff(raw, read_after):
    """Only actual regular-file additions/edits in the finite successor grant."""
    fields = raw.split(b'\0')
    require(fields[-1] == b'' and len(fields) % 2 == 1, 'R10_DIFF_SHAPE')
    seen = set()
    for n in range(0, len(fields)-1, 2):
        metadata = fields[n].decode('ascii').split()
        path = fields[n+1].decode('utf-8')
        require(len(metadata) == 5, 'R10_DIFF_META')
        oldmode, newmode, oldblob, newblob, status = metadata
        require(allowed10(path) and status in ('A', 'M'), 'R10_SCOPE:'+path)
        require(path.casefold() not in seen, 'R10_COLLISION:'+path)
        seen.add(path.casefold())
        require(newmode == '100644' and oldmode in (':000000', ':100644'), 'R10_MODE:'+path)
        require((path in RELEASE10_EXISTING) == (oldmode == ':100644'), 'R10_CREATE_EDIT:'+path)
        require(status == ('A' if oldmode == ':000000' else 'M') and
                re.fullmatch('[0-9a-f]{40}', oldblob) is not None and
                re.fullmatch('[0-9a-f]{40}', newblob) is not None, 'R10_DIFF_IDENTITY:'+path)
        read_after(path)  # Every changed working path is checked for links/reparse components.


def source10_endpoint():
    """Authenticate only PR14's tree-identical GitHub synthetic merge checkout.

    This is not permission to merge source history. Every source commit remains
    linear and checked; the immutable workflow/event binds the integration ref.
    """
    head = git('rev-parse', 'HEAD').decode().strip()
    parents = git('rev-list', '--parents', '-n', '1', head).decode().split()
    if len(parents) == 2:
        return head
    require(len(parents) == 3, 'R10_LINEAR_HISTORY:'+head)
    require(os.environ.get('GITHUB_EVENT_NAME') == 'pull_request' and
            os.environ.get('GITHUB_REPOSITORY') == 'TasfiqJ/onSkin' and
            os.environ.get('GITHUB_REF') == 'refs/pull/14/merge' and
            os.environ.get('GITHUB_SHA') == head, 'R10_CI_MERGE_CONTEXT')
    event_path = Path(os.environ.get('GITHUB_EVENT_PATH', ''))
    require(event_path.is_file() and event_path.stat().st_size <= 1024*1024, 'R10_CI_EVENT')
    event = load(event_path)
    pr = event.get('pull_request', {})
    require(event.get('number') == 14 and pr.get('number') == 14 and
            event.get('repository', {}).get('full_name') == 'TasfiqJ/onSkin' and
            pr.get('base', {}).get('sha') == RELEASE09 and parents[1] == RELEASE09 and
            pr.get('base', {}).get('ref') == 'stage/full-app-j01-source-packet-ci09' and
            pr.get('head', {}).get('sha') == parents[2] and
            pr.get('head', {}).get('ref') == 'stage/full-app-j01-quality-projections10' and
            pr.get('head', {}).get('repo', {}).get('full_name') == 'TasfiqJ/onSkin',
            'R10_CI_EVENT_IDENTITY')
    require(git('rev-parse', head+'^{tree}') == git('rev-parse', parents[2]+'^{tree}'),
            'R10_CI_MERGE_TREE')
    return parents[2]


def source10_history():
    require(git('rev-parse', RELEASE09+'^{tree}').decode().strip() ==
            'a59fc7ea1cc57901f6d848ff5009734f446bdff2', 'R10_BASE_TREE')
    endpoint = source10_endpoint()
    subprocess.run(['git', 'merge-base', '--is-ancestor', RELEASE09, endpoint],
                   cwd=ROOT, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    for commit in git('rev-list', '--reverse', RELEASE09+'..'+endpoint).decode().splitlines():
        parents = git('rev-list', '--parents', '-n', '1', commit).decode().split()
        require(len(parents) == 2, 'R10_LINEAR_HISTORY:'+commit)
        validate10_diff(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE09, commit),
                        lambda path: git('show', commit+':'+path))


def source10_guard():
    source10_history()
    # Check staged and working states independently: restoring a malicious staged
    # edit in the worktree must never hide its index delta.
    validate10_diff(git('diff', '--cached', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE09),
                    lambda path: git('show', ':'+path))
    validate10_diff(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE09),
                    lambda path: regular(ROOT/path))
    names = set()
    for entry in git('ls-files', '-v', '-z').decode().split('\0'):
        if entry:
            require(entry.startswith('H '), 'R10_INDEX_FLAGS:'+entry)
            require(entry[2:].casefold() not in names, 'R10_COLLISION:'+entry[2:])
            names.add(entry[2:].casefold())
    for path in git('ls-files', '--others', '--exclude-standard', '-z').decode().split('\0'):
        if path:
            require(allowed10(path) and path not in RELEASE10_EXISTING, 'R10_UNTRACKED_SCOPE:'+path)
            require(path.casefold() not in names, 'R10_COLLISION:'+path)
            names.add(path.casefold())
            regular(ROOT/path)


RELEASE11_BASE = '14805e7f708297e72419035f517acc41ba52da70'
RELEASE11_TREE = '90c9427743b99fb43747d68cd55e413d2aee3ad4'
RELEASE11_AUTHORITY = 'BRAIN-M103-SOURCE-RECOVERY11-CANDIDATE-01'
# GitHub allocated this exact draft; no general merge-ref exception is granted.
RELEASE11_PR = 15
RELEASE11_EXISTING = {
    'scripts/core05/adherence-source-contract.test.mjs',
    'scripts/core06/recommendation-admission-source-contract.test.mjs',
    'package.json', 'package-lock.json', 'apps/mobile/package.json',
    'scripts/release/full-app-j01/check.py',
    'docs/phase-4/generated/source-worklist.json',
    'docs/phase-4/generated/source-worklist.md', 'ONSKIN_BRAIN_HANDOFF.txt',
}
RELEASE11_NEW = {
    'scripts/release/full-app-j01/source_consumer11.test.py',
    'scripts/release/full-app-j01/dependency_guard11.test.py',
    'docs/release/full-app-j01/security-recovery11.md',
    'docs/release/full-app-j01/security-custody11.unapplied.json',
}
RELEASE11_PREFIXES = ('docs/brain/contracts/SECURITY-11/',
    'docs/brain/task-specs/SECURITY-11/',
    'docs/brain/checkpoints/M1-03/SECURITY-SOURCE-11/')


def allowed11(path):
    return (isinstance(path, str) and re.fullmatch(r'[A-Za-z0-9._/-]+', path) is not None and
            all(p and p.casefold() not in ('.', '..', '.git', '.gitattributes', '.gitignore') and
                not p.endswith('.') and
                re.fullmatch(r'(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?', p, re.I) is None
                for p in path.split('/')) and
            (path in RELEASE11_EXISTING or path in RELEASE11_NEW or
             path.startswith(RELEASE11_PREFIXES)))


def dependency11_guard(raw):
    """Only the eight authenticated 4.1.12 Vitest records; no other graph mutation."""
    before = json.loads(git('show', RELEASE11_BASE+':package-lock.json'), object_pairs_hook=pairs)
    after = json.loads(raw, object_pairs_hook=pairs)
    if after == before:
        return  # Earlier source-only commits remain admissible.
    contract = load(ROOT/'docs/brain/contracts/SECURITY-11/dependency-patch.v1.json')
    approved = contract['nodes']
    require(sha(json.dumps(approved, sort_keys=True, separators=(',', ':')).encode()) ==
            '5a25d459ae94186cc123e37bee90ff7c1d6145af5723487d31f386fda30210de',
            'R11_APPROVED_DEPENDENCY_IDENTITY')
    expected = json.loads(json.dumps(before))
    expected['packages'].update(approved)
    require(after == expected, 'R11_DEPENDENCY_CLOSURE')


def validate11_checker(raw):
    before = ast.parse(git('show', RELEASE11_BASE+':scripts/release/full-app-j01/check.py'))
    after = ast.parse(raw)
    functions = lambda module: {n.name: ast.dump(n, include_attributes=False)
        for n in module.body if isinstance(n, ast.FunctionDef)}
    old, new = functions(before), functions(after)
    require(all(new.get(k) == v for k, v in old.items() if k != 'source_guard'),
            'R11_INHERITED_FUNCTION_CHANGED')
    assignments = lambda module: {ast.dump(n.targets[0]): ast.dump(n.value, include_attributes=False)
        for n in module.body if isinstance(n, ast.Assign) and len(n.targets) == 1}
    old_globals, new_globals = assignments(before), assignments(after)
    require(all(new_globals.get(k) == v for k, v in old_globals.items()),
            'R11_INHERITED_GLOBAL_CHANGED')


def validate11_diff(raw, read_after):
    fields = raw.split(b'\0')
    require(fields[-1] == b'' and len(fields) % 2 == 1, 'R11_DIFF_SHAPE')
    names = set()
    for n in range(0, len(fields)-1, 2):
        metadata = fields[n].decode('ascii').split()
        path = fields[n+1].decode('utf-8')
        require(len(metadata) == 5, 'R11_DIFF_META')
        oldmode, newmode, oldblob, newblob, status = metadata
        require(allowed11(path) and status in ('A', 'M'), 'R11_SCOPE:'+path)
        key = unicodedata.normalize('NFKC', path).casefold()
        require(key not in names, 'R11_COLLISION:'+path)
        names.add(key)
        require(oldmode in (':000000', ':100644') and newmode == '100644', 'R11_MODE:'+path)
        require((path in RELEASE11_EXISTING) == (oldmode == ':100644'), 'R11_CREATE_EDIT:'+path)
        require(status == ('A' if oldmode == ':000000' else 'M') and
                all(re.fullmatch('[0-9a-f]{40}', x) for x in (oldblob, newblob)),
                'R11_DIFF_IDENTITY:'+path)
        data = read_after(path)
        if path in ('package.json', 'apps/mobile/package.json'):
            require(data == git('show', RELEASE11_BASE+':'+path), 'R11_DECLARATION_NOT_ACTIVATED')
        if path == 'package-lock.json':
            dependency11_guard(data)
        if path == 'scripts/release/full-app-j01/check.py':
            validate11_checker(data)


def source11_endpoint():
    head = git('rev-parse', 'HEAD').decode().strip()
    parents = git('rev-list', '--parents', '-n', '1', head).decode().split()
    if len(parents) == 2:
        return head
    require(len(parents) == 3 and type(RELEASE11_PR) is int, 'R11_LINEAR_HISTORY:'+head)
    require(os.environ.get('GITHUB_EVENT_NAME') == 'pull_request' and
            os.environ.get('GITHUB_REPOSITORY') == 'TasfiqJ/onSkin' and
            os.environ.get('GITHUB_REF') == 'refs/pull/'+str(RELEASE11_PR)+'/merge' and
            os.environ.get('GITHUB_SHA') == head, 'R11_CI_MERGE_CONTEXT')
    event_path = Path(os.environ.get('GITHUB_EVENT_PATH', ''))
    require(event_path.is_file() and event_path.stat().st_size <= 1024*1024, 'R11_CI_EVENT')
    event = load(event_path)
    pr = event.get('pull_request', {})
    require(event.get('number') == RELEASE11_PR and pr.get('number') == RELEASE11_PR and
            event.get('repository', {}).get('full_name') == 'TasfiqJ/onSkin' and
            pr.get('base', {}).get('sha') == RELEASE11_BASE and parents[1] == RELEASE11_BASE and
            pr.get('base', {}).get('ref') == 'stage/full-app-j01-quality-projections10' and
            pr.get('head', {}).get('sha') == parents[2] and
            pr.get('head', {}).get('ref') == 'stage/m103-security-source-recovery11' and
            pr.get('head', {}).get('repo', {}).get('full_name') == 'TasfiqJ/onSkin',
            'R11_CI_EVENT_IDENTITY')
    require(git('rev-parse', head+'^{tree}') == git('rev-parse', parents[2]+'^{tree}'),
            'R11_CI_MERGE_TREE')
    return parents[2]


def source11_history():
    require(git('rev-parse', RELEASE11_BASE+'^{tree}').decode().strip() == RELEASE11_TREE,
            'R11_BASE_TREE')
    endpoint = source11_endpoint()
    subprocess.run(['git', 'merge-base', '--is-ancestor', RELEASE11_BASE, endpoint],
                   cwd=ROOT, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    for commit in git('rev-list', '--reverse', RELEASE11_BASE+'..'+endpoint).decode().splitlines():
        require(len(git('rev-list', '--parents', '-n', '1', commit).decode().split()) == 2,
                'R11_LINEAR_HISTORY:'+commit)
        validate11_diff(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE11_BASE, commit),
                        lambda path: git('show', commit+':'+path))


def source11_guard():
    source11_history()
    for name in ('package.json', 'package-lock.json', 'apps/mobile/package.json'):
        baseline = git('show', RELEASE11_BASE+':'+name)
        require(regular(ROOT/name) == baseline and git('show', ':'+name) == baseline,
                'R11_DEPENDENCY_UNAPPLIED:'+name)
    validate11_diff(git('diff', '--cached', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE11_BASE),
                    lambda path: git('show', ':'+path))
    validate11_diff(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE11_BASE),
                    lambda path: regular(ROOT/path))
    names = set()
    for entry in git('ls-files', '-v', '-z').decode().split('\0'):
        if entry:
            require(entry.startswith('H '), 'R11_INDEX_FLAGS:'+entry)
            key = unicodedata.normalize('NFKC', entry[2:]).casefold()
            require(key not in names, 'R11_COLLISION:'+entry[2:])
            names.add(key)
    for path in git('ls-files', '--others', '--exclude-standard', '-z').decode().split('\0'):
        if path:
            require(allowed11(path) and path not in RELEASE11_EXISTING, 'R11_UNTRACKED_SCOPE:'+path)
            key = unicodedata.normalize('NFKC', path).casefold()
            require(key not in names, 'R11_COLLISION:'+path)
            names.add(key)
            regular(ROOT/path)


def source10_historical_segment():
    """Execute unchanged Release10 history on its exact endpoint, never on new source."""
    actual_git = git
    def historical_git(*args):
        if args == ('rev-parse', 'HEAD'):
            return actual_git('rev-parse', RELEASE11_BASE)
        return actual_git(*args)
    globals()['git'] = historical_git
    try:
        source10_history()
    finally:
        globals()['git'] = actual_git


RELEASE12_BASE = '9e3ba80e09579ee4855948f13297049791c4d5d7'
RELEASE12_TREE = '0c3d2dc79a54a405315df06f05d284bd643cd538'
RELEASE12_PR = 16  # Allocated by GitHub, observed after draft creation.
RELEASE12_MANIFEST = 'docs/release/full-app-j01/dependency-succession12.v1.json'
RELEASE12_MANIFEST_SHA256 = '5f3ac49ea52a6e4b955bb31495324f157d2d5a85d0d55ca1b66216e7faa565a2'
RELEASE12_LOCK_SHA256 = '7656c2e6bf482df5a9bc94c9789816a40c5f2b5cfb30e2f10748411229c136cb'
RELEASE12_BLOCKER = 'docs/brain/contracts/SECURITY-12/dependency-install-blocker.v1.json'
RELEASE12_BLOCKER_SHA256 = 'd52d4153dd4f718559aa2a7461824d013545f37929f609ca677fa7cd9f50ab35'
RELEASE12_EXISTING = {'package-lock.json', 'scripts/release/full-app-j01/check.py',
    'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md',
    'ONSKIN_BRAIN_HANDOFF.txt'}
RELEASE12_NEW = {RELEASE12_MANIFEST,
    'docs/release/full-app-j01/security-custody12.unapplied.json',
    'docs/release/full-app-j01/security-recovery12.md',
    'scripts/release/full-app-j01/source_consumer12.test.py',
    'scripts/release/full-app-j01/dependency_guard12.test.py'}
RELEASE12_PREFIXES = ('docs/brain/contracts/SECURITY-12/', 'docs/brain/task-specs/SECURITY-12/',
    'docs/brain/checkpoints/M1-03/SECURITY-DEPENDENCY-12/')


def allowed12(path):
    return (isinstance(path, str) and re.fullmatch(r'[A-Za-z0-9._/-]+', path) is not None and
        all(p and p.casefold() not in ('.', '..', '.git', '.gitattributes', '.gitignore') and
            not p.endswith('.') and
            re.fullmatch(r'(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?', p, re.I) is None
            for p in path.split('/')) and
        (path in RELEASE12_EXISTING or path in RELEASE12_NEW or path.startswith(RELEASE12_PREFIXES)))


def release12_active():
    return subprocess.run(['git', 'merge-base', '--is-ancestor', RELEASE12_BASE, 'HEAD'],
        cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE).returncode == 0


def dependency12_guard(raw, read_after=None):
    """Two distinct authorities: immutable old witness and frozen candidate source proposal."""
    read_after = read_after or (lambda path: regular(ROOT/path))
    authority_raw = read_after(RELEASE12_MANIFEST)
    require(sha(authority_raw) == RELEASE12_MANIFEST_SHA256, 'R12_MANIFEST_IDENTITY')
    authority = json.loads(authority_raw, object_pairs_hook=pairs)
    require(sha(raw) == RELEASE12_LOCK_SHA256 == authority['candidate_root_lock']['sha256'],
            'R12_CANDIDATE_LOCK_SHA256')
    require(authority['status'] == 'CANDIDATE_REVIEW_REQUIRED' and
            authority['base'] == dict(commit=RELEASE12_BASE, tree=RELEASE12_TREE) and
            authority['pr'] == RELEASE12_PR and authority['spend_usd'] == 0 and
            all(v is False for v in authority['admissions'].values()), 'R12_NO_ADMISSION')
    before_raw = git('show', RELEASE12_BASE+':package-lock.json')
    original = authority['original_root_lock_witness']
    require(original['source_commit'] == BASE and original['mode'] == '100644' and
            sha(before_raw) == original['sha256'] ==
            '99aa497f2d0cc2ca237167403fbbb9d9aee0a4e42fa991ea44f9661487ecf568' and
            git('show', BASE+':package-lock.json') == before_raw, 'R12_ORIGINAL_LOCK_AUTHORITY')
    frozen = json.loads(git('show', RELEASE12_BASE+
        ':docs/brain/contracts/SECURITY-11/dependency-patch.v1.json'), object_pairs_hook=pairs)['nodes']
    require(authority['nodes'] == frozen and len(frozen) == 8 and
            authority['changed_nodes'] == list(frozen), 'R12_REVIEWED_EIGHT_NODES')
    before = json.loads(before_raw, object_pairs_hook=pairs)
    after = json.loads(raw, object_pairs_hook=pairs)
    expected = json.loads(before_raw, object_pairs_hook=pairs)
    expected['packages'].update(frozen)
    require(after == expected and list(after['packages']) == list(before['packages']),
            'R12_EXACT_CLOSURE_AND_ORDER')
    require(authority['candidate_root_lock']['blob'] ==
            hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest(), 'R12_LOCK_BLOB')
    for row in authority['historical_contracts'] + [authority['reviewed_nodes_source']]:
        require(sha(git('show', RELEASE12_BASE+':'+row['path'])) == row['sha256'] and
                read_after(row['path']) == git('show', RELEASE12_BASE+':'+row['path']),
                'R12_HISTORICAL_WITNESS:'+row['path'])
    for row in authority['declarations']:
        require(read_after(row['path']) == git('show', RELEASE12_BASE+':'+row['path']),
                'R12_DECLARATION:'+row['path'])
    for row in authority['registry']:
        require(row['path'] in frozen and row['integrity_verified'] is True and
                row['signature_verified'] is True and row['provenance_verified'] is True,
                'R12_REGISTRY_VERIFICATION')
        for key in ('metadata', 'attestations'):
            require(sha(read_after(row[key]['path'])) == row[key]['sha256'],
                    'R12_REGISTRY_BYTES:'+row[key]['path'])
        metadata = json.loads(read_after(row['metadata']['path']), object_pairs_hook=pairs)
        require(metadata['dist']['integrity'] == frozen[row['path']]['integrity'] and
                metadata['dist']['tarball'] == frozen[row['path']]['resolved'], 'R12_REGISTRY_INTEGRITY')
    proof = authority['provenance']
    require(sha(read_after(proof['path'])) == proof['sha256'], 'R12_PROVENANCE_BYTES')
    return authority


def unapplied12_guard(raw, read_after=None):
    """Native privacy's protected whole-lock witness blocks current activation."""
    read_after = read_after or (lambda path: regular(ROOT/path))
    blocker_raw = read_after(RELEASE12_BLOCKER)
    require(sha(blocker_raw) == RELEASE12_BLOCKER_SHA256, 'R12_BLOCKER_IDENTITY')
    blocker = json.loads(blocker_raw, object_pairs_hook=pairs)
    require(sha(raw) == blocker['required_current_lock_sha256'] ==
            '99aa497f2d0cc2ca237167403fbbb9d9aee0a4e42fa991ea44f9661487ecf568' and
            raw == git('show', RELEASE12_BASE+':package-lock.json'), 'R12_PATCH_UNAPPLIED')
    for row in blocker['protected_witnesses']:
        require(sha(read_after(row['path'])) == row['sha256'] and
                read_after(row['path']) == git('show', RELEASE12_BASE+':'+row['path']),
                'R12_PROTECTED_COMPATIBILITY_WITNESS:'+row['path'])
    # Continue to authenticate the independently tested proposal. Reading its
    # frozen historical blob is not permission to install or admit it now.
    return dependency12_guard(git('cat-file', 'blob', '843be0fdf1fe9354dfdc4750118481486d9a778a'), read_after)


def validate12_diff(raw, read_after):
    fields = raw.split(b'\0')
    require(fields[-1] == b'' and len(fields) % 2 == 1, 'R12_DIFF_SHAPE')
    names = set()
    for n in range(0, len(fields)-1, 2):
        metadata = fields[n].decode('ascii').split()
        path = fields[n+1].decode('utf-8')
        require(len(metadata) == 5, 'R12_DIFF_META')
        oldmode, newmode, oldblob, newblob, status = metadata
        require(allowed12(path) and status in ('A', 'M'), 'R12_SCOPE:'+path)
        key = unicodedata.normalize('NFKC', path).casefold()
        require(key not in names, 'R12_COLLISION:'+path)
        names.add(key)
        require(oldmode in (':000000', ':100644') and newmode == '100644', 'R12_MODE:'+path)
        require((path in RELEASE12_EXISTING) == (oldmode == ':100644') and
                status == ('A' if oldmode == ':000000' else 'M') and
                all(re.fullmatch('[0-9a-f]{40}', x) for x in (oldblob, newblob)),
                'R12_CREATE_EDIT:'+path)
        data = read_after(path)
        if path == 'package-lock.json':
            dependency12_guard(data, read_after)
        if path == RELEASE12_MANIFEST:
            require(sha(data) == RELEASE12_MANIFEST_SHA256, 'R12_MANIFEST_IDENTITY')
        if path == 'scripts/release/full-app-j01/check.py':
            validate11_checker(data)  # Every old function/global except source_guard is unchanged.


def source12_endpoint():
    head = git('rev-parse', 'HEAD').decode().strip()
    parents = git('rev-list', '--parents', '-n', '1', head).decode().split()
    if len(parents) == 2:
        return head
    require(len(parents) == 3, 'R12_LINEAR_HISTORY:'+head)
    require(os.environ.get('GITHUB_EVENT_NAME') == 'pull_request' and
            os.environ.get('GITHUB_REPOSITORY') == 'TasfiqJ/onSkin' and
            os.environ.get('GITHUB_REF') == 'refs/pull/'+str(RELEASE12_PR)+'/merge' and
            os.environ.get('GITHUB_SHA') == head, 'R12_CI_MERGE_CONTEXT')
    event_path = Path(os.environ.get('GITHUB_EVENT_PATH', ''))
    require(event_path.is_file() and event_path.stat().st_size <= 1024*1024, 'R12_CI_EVENT')
    event = load(event_path)
    pr = event.get('pull_request', {})
    require(event.get('number') == RELEASE12_PR and pr.get('number') == RELEASE12_PR and
            event.get('repository', {}).get('full_name') == 'TasfiqJ/onSkin' and
            pr.get('base', {}).get('sha') == RELEASE12_BASE and parents[1] == RELEASE12_BASE and
            pr.get('base', {}).get('ref') == 'stage/m103-security-source-recovery11' and
            pr.get('head', {}).get('sha') == parents[2] and
            pr.get('head', {}).get('ref') == 'stage/m103-dependency-witness12' and
            pr.get('head', {}).get('repo', {}).get('full_name') == 'TasfiqJ/onSkin',
            'R12_CI_EVENT_IDENTITY')
    require(git('rev-parse', head+'^{tree}') == git('rev-parse', parents[2]+'^{tree}'),
            'R12_CI_MERGE_TREE')
    return parents[2]


def source12_history():
    require(git('rev-parse', RELEASE12_BASE+'^{tree}').decode().strip() == RELEASE12_TREE,
            'R12_BASE_TREE')
    endpoint = source12_endpoint()
    subprocess.run(['git', 'merge-base', '--is-ancestor', RELEASE12_BASE, endpoint],
        cwd=ROOT, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    blocked = False
    for commit in git('rev-list', '--reverse', RELEASE12_BASE+'..'+endpoint).decode().splitlines():
        require(len(git('rev-list', '--parents', '-n', '1', commit).decode().split()) == 2,
                'R12_LINEAR_HISTORY:'+commit)
        read_after = lambda path: git('show', commit+':'+path)
        validate12_diff(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE12_BASE, commit), read_after)
        has_blocker = bool(git('ls-tree', commit, '--', RELEASE12_BLOCKER).strip())
        require(not blocked or has_blocker, 'R12_BLOCKER_REMOVAL')
        blocked = blocked or has_blocker
        if has_blocker:
            unapplied12_guard(read_after('package-lock.json'), read_after)
        elif git('ls-tree', commit, '--', RELEASE12_MANIFEST).strip():
            dependency12_guard(read_after('package-lock.json'), read_after)


def source12_guard():
    source12_history()
    for row in ('package.json', 'apps/mobile/package.json'):
        require(regular(ROOT/row) == git('show', RELEASE12_BASE+':'+row) == git('show', ':'+row),
                'R12_DECLARATION:'+row)
    unapplied12_guard(regular(ROOT/'package-lock.json'))
    unapplied12_guard(git('show', ':package-lock.json'), lambda p: git('show', ':'+p))
    validate12_diff(git('diff', '--cached', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE12_BASE),
                    lambda path: git('show', ':'+path))
    validate12_diff(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE12_BASE),
                    lambda path: regular(ROOT/path))
    names = set()
    for entry in git('ls-files', '-v', '-z').decode().split('\0'):
        if entry:
            require(entry.startswith('H '), 'R12_INDEX_FLAGS:'+entry)
            key = unicodedata.normalize('NFKC', entry[2:]).casefold()
            require(key not in names, 'R12_COLLISION:'+entry[2:])
            names.add(key)
    for path in git('ls-files', '--others', '--exclude-standard', '-z').decode().split('\0'):
        if path:
            require(allowed12(path) and path not in RELEASE12_EXISTING, 'R12_UNTRACKED_SCOPE:'+path)
            key = unicodedata.normalize('NFKC', path).casefold()
            require(key not in names, 'R12_COLLISION:'+path)
            names.add(key)
            regular(ROOT/path)


def source11_historical_segment():
    """Keep the unedited Release11 history checker bounded at the exact PR15 endpoint."""
    actual_git = git
    def historical_git(*args):
        if args == ('rev-parse', 'HEAD'):
            return actual_git('rev-parse', RELEASE12_BASE)
        return actual_git(*args)
    globals()['git'] = historical_git
    try:
        source11_history()
    finally:
        globals()['git'] = actual_git


def validate12(bundle=BUNDLE):
    """Retain the tested proposal, while refusing activation outside the finite grant.

    The applied candidate's isolated historical reader is preserved at immutable
    b74d9997 and its measured CI failure. Current original bytes need no remapping.
    All original validate()/witness() semantics execute on actual current source.
    """
    if not release12_active():
        return RELEASE12_LEGACY_VALIDATE(bundle)
    authority = unapplied12_guard(regular(ROOT/'package-lock.json'))
    result = RELEASE12_LEGACY_VALIDATE(bundle)
    result['historical_lock_witness'] = authority['original_root_lock_witness']['sha256']
    result['current_dependency_witness'] = authority['original_root_lock_witness']['sha256']
    result['proposed_dependency_witness'] = RELEASE12_LOCK_SHA256
    result['dependency_successor_status'] = 'UNAPPLIED_COMPATIBILITY_BLOCKED'
    return result



RELEASE13_BASE = 'bbbd59073b7add22ac350bced0d9a34124c12ffb'
RELEASE13_TREE = '4a70f0934a56e27863742084272c9bb4bfd5492d'
RELEASE13_PR = 17  # Allocated by GitHub after the proposal draft was created.
RELEASE13_MANIFEST = 'docs/phase-9/ios-sdk-lock-succession13.v1.json'
RELEASE13_MANIFEST_SHA256 = '824d99e0f57bee122af6b89f640c1bfe401b367b8f7211b1c0abf61b5a249409'
RELEASE13_EXISTING = {'package-lock.json', 'scripts/phase9/ios-privacy-contract.mjs',
    'scripts/phase9/ios-privacy-source-audit.test.mjs', 'scripts/release/full-app-j01/check.py',
    'docs/phase-9/generated/ios-privacy-source-audit.json',
    'docs/phase-9/generated/ios-privacy-source-audit.md',
    'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md',
    'ONSKIN_BRAIN_HANDOFF.txt'}
RELEASE13_NEW = {RELEASE13_MANIFEST, 'scripts/release/full-app-j01/source_consumer13.test.py',
    'scripts/release/full-app-j01/dependency_guard13.test.py',
    'docs/release/full-app-j01/native-privacy-succession13.md',
    'docs/release/full-app-j01/security-custody13.unapplied.json'}
RELEASE13_PREFIXES = ('docs/brain/contracts/SECURITY-13/', 'docs/brain/task-specs/SECURITY-13/',
    'docs/brain/checkpoints/M1-03/IOS-PRIVACY-LOCK-13/')


def allowed13(path):
    return (isinstance(path, str) and re.fullmatch(r'[A-Za-z0-9._/-]+', path) is not None and
        all(p and p.casefold() not in ('.', '..', '.git', '.gitattributes', '.gitignore') and
            not p.endswith('.') and
            re.fullmatch(r'(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?', p, re.I) is None
            for p in path.split('/')) and
        (path in RELEASE13_EXISTING or path in RELEASE13_NEW or path.startswith(RELEASE13_PREFIXES)))


def release13_active():
    return subprocess.run(['git', 'merge-base', '--is-ancestor', RELEASE13_BASE, 'HEAD'],
        cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE).returncode == 0


def dependency13_guard(raw, read_after=None, installed=True):
    read_after = read_after or (lambda path: regular(ROOT/path))
    manifest_raw = read_after(RELEASE13_MANIFEST)
    require(sha(manifest_raw) == RELEASE13_MANIFEST_SHA256, 'R13_MANIFEST_IDENTITY')
    manifest = json.loads(manifest_raw, object_pairs_hook=pairs)
    require(manifest['schemaVersion'] == 1 and manifest['pr'] == RELEASE13_PR and
            manifest['base'] == dict(commit=RELEASE13_BASE, tree=RELEASE13_TREE), 'R13_SOURCE_VERSION')
    authority = dependency12_guard(raw, read_after)  # Unchanged exact eight-node authority.
    original = git('show', RELEASE13_BASE+':package-lock.json')
    require(sha(original) == manifest['originalLock']['sha256'] and
            sha(raw) == manifest['candidateLock']['sha256'] and
            manifest['candidateNodes'] == authority['nodes'], 'R13_LOCK_IDENTITIES')
    mapping_raw = read_after(manifest['originalMapping']['path'])
    require(mapping_raw == git('show', RELEASE13_BASE+':'+manifest['originalMapping']['path']) and
            sha(mapping_raw) == manifest['originalMapping']['sha256'], 'R13_ORIGINAL_MAPPING')
    mapping = json.loads(mapping_raw, object_pairs_hook=pairs)
    require(mapping['mappings'] == manifest['unchangedNativeMappings'], 'R13_NATIVE_MAPPING_ROWS')
    before = json.loads(original, object_pairs_hook=pairs)
    after = json.loads(raw, object_pairs_hook=pairs)
    require(list(after['packages']) == list(before['packages']) and
            [p for p in before['packages'] if before['packages'][p] != after['packages'][p]] ==
            manifest['changedNodes'], 'R13_EXACT_NODE_ORDER')
    for path, node in manifest['unchangedNativeNodes'].items():
        require(before['packages'][path] == after['packages'][path] == node, 'R13_NATIVE_NODE:'+path)
    if installed:
        for row in mapping['mappings']:
            for pin in row['notes']['sourcePins']:
                require(sha(regular(ROOT/pin['path'])) == pin['sha256'], 'R13_INSTALLED_SOURCE:'+pin['path'])
        require(not os.path.lexists(ROOT/'apps/mobile/ios/Podfile.lock'), 'R13_UNPROVEN_PODFILE')
    return manifest


def validate13_checker(raw):
    before = ast.parse(git('show', RELEASE13_BASE+':scripts/release/full-app-j01/check.py'))
    after = ast.parse(raw)
    functions = lambda module: {n.name: ast.dump(n, include_attributes=False)
        for n in module.body if isinstance(n, ast.FunctionDef)}
    old, new = functions(before), functions(after)
    require(all(new.get(k) == v for k, v in old.items() if k != 'source_guard'),
            'R13_INHERITED_FUNCTION_CHANGED')
    assignments = lambda module: {ast.dump(n.targets[0]): ast.dump(n.value, include_attributes=False)
        for n in module.body if isinstance(n, ast.Assign) and len(n.targets) == 1}
    old_globals, new_globals = assignments(before), assignments(after)
    alias = ast.dump(ast.Name(id='validate', ctx=ast.Store()))
    require(all(new_globals.get(k) == v for k, v in old_globals.items() if k != alias),
            'R13_INHERITED_GLOBAL_CHANGED')
    require(new_globals[alias] == ast.dump(ast.Name(id='validate13', ctx=ast.Load())),
            'R13_CURRENT_VALIDATE_ALIAS')


def validate13_diff(raw, read_after):
    fields = raw.split(b'\0')
    require(fields[-1] == b'' and len(fields) % 2 == 1, 'R13_DIFF_SHAPE')
    names = set()
    for n in range(0, len(fields)-1, 2):
        metadata = fields[n].decode('ascii').split()
        path = fields[n+1].decode('utf-8')
        require(len(metadata) == 5, 'R13_DIFF_META')
        oldmode, newmode, oldblob, newblob, status = metadata
        require(allowed13(path) and status in ('A', 'M'), 'R13_SCOPE:'+path)
        key = unicodedata.normalize('NFKC', path).casefold()
        require(key not in names, 'R13_COLLISION:'+path)
        names.add(key)
        require(oldmode in (':000000', ':100644') and newmode == '100644', 'R13_MODE:'+path)
        require((path in RELEASE13_EXISTING) == (oldmode == ':100644') and
                status == ('A' if oldmode == ':000000' else 'M') and
                all(re.fullmatch('[0-9a-f]{40}', x) for x in (oldblob, newblob)),
                'R13_CREATE_EDIT:'+path)
        data = read_after(path)
        if path == 'package-lock.json':
            dependency13_guard(data, read_after, installed=False)
        if path == RELEASE13_MANIFEST:
            require(sha(data) == RELEASE13_MANIFEST_SHA256, 'R13_MANIFEST_IDENTITY')
        if path == 'scripts/release/full-app-j01/check.py':
            validate13_checker(data)


def source13_endpoint():
    head = git('rev-parse', 'HEAD').decode().strip()
    parents = git('rev-list', '--parents', '-n', '1', head).decode().split()
    if len(parents) == 2:
        return head
    require(len(parents) == 3, 'R13_LINEAR_HISTORY:'+head)
    require(os.environ.get('GITHUB_EVENT_NAME') == 'pull_request' and
            os.environ.get('GITHUB_REPOSITORY') == 'TasfiqJ/onSkin' and
            os.environ.get('GITHUB_REF') == 'refs/pull/'+str(RELEASE13_PR)+'/merge' and
            os.environ.get('GITHUB_SHA') == head, 'R13_CI_MERGE_CONTEXT')
    event_path = Path(os.environ.get('GITHUB_EVENT_PATH', ''))
    require(event_path.is_file() and event_path.stat().st_size <= 1024*1024, 'R13_CI_EVENT')
    event = load(event_path)
    pr = event.get('pull_request', {})
    require(event.get('number') == RELEASE13_PR and pr.get('number') == RELEASE13_PR and
            event.get('repository', {}).get('full_name') == 'TasfiqJ/onSkin' and
            pr.get('base', {}).get('sha') == RELEASE13_BASE and parents[1] == RELEASE13_BASE and
            pr.get('base', {}).get('ref') == 'stage/m103-dependency-witness12' and
            pr.get('head', {}).get('sha') == parents[2] and
            pr.get('head', {}).get('ref') == 'stage/m103-ios-privacy-lock-succession13' and
            pr.get('head', {}).get('repo', {}).get('full_name') == 'TasfiqJ/onSkin', 'R13_CI_EVENT_IDENTITY')
    require(git('merge-base', RELEASE13_BASE, parents[2]).decode().strip() == RELEASE13_BASE,
            'R13_CI_MERGE_BASE')
    require(git('rev-parse', head+'^{tree}') == git('rev-parse', parents[2]+'^{tree}'),
            'R13_CI_MERGE_TREE')
    return parents[2]


def source13_history():
    require(git('rev-parse', RELEASE13_BASE+'^{tree}').decode().strip() == RELEASE13_TREE, 'R13_BASE_TREE')
    endpoint = source13_endpoint()
    subprocess.run(['git', 'merge-base', '--is-ancestor', RELEASE13_BASE, endpoint],
        cwd=ROOT, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    for commit in git('rev-list', '--reverse', RELEASE13_BASE+'..'+endpoint).decode().splitlines():
        require(len(git('rev-list', '--parents', '-n', '1', commit).decode().split()) == 2,
                'R13_LINEAR_HISTORY:'+commit)
        read_after = lambda path: git('show', commit+':'+path)
        validate13_diff(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE13_BASE, commit), read_after)


def source13_guard():
    source13_history()
    dependency13_guard(regular(ROOT/'package-lock.json'))
    dependency13_guard(git('show', ':package-lock.json'), lambda p: git('show', ':'+p), installed=False)
    validate13_diff(git('diff', '--cached', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE13_BASE),
                    lambda path: git('show', ':'+path))
    validate13_diff(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE13_BASE),
                    lambda path: regular(ROOT/path))
    names = set()
    for entry in git('ls-files', '-v', '-z').decode().split('\0'):
        if entry:
            require(entry.startswith('H '), 'R13_INDEX_FLAGS:'+entry)
            key = unicodedata.normalize('NFKC', entry[2:]).casefold()
            require(key not in names, 'R13_COLLISION:'+entry[2:])
            names.add(key)
    for path in git('ls-files', '--others', '--exclude-standard', '-z').decode().split('\0'):
        if path:
            require(allowed13(path) and path not in RELEASE13_EXISTING, 'R13_UNTRACKED_SCOPE:'+path)
            key = unicodedata.normalize('NFKC', path).casefold()
            require(key not in names, 'R13_COLLISION:'+path)
            names.add(key)
            regular(ROOT/path)


def source12_historical_segment():
    """Unchanged Release12 history and UNAPPLIED witness retain their original endpoint."""
    actual_git = git
    def historical_git(*args):
        if args == ('rev-parse', 'HEAD'):
            return actual_git('rev-parse', RELEASE13_BASE)
        return actual_git(*args)
    globals()['git'] = historical_git
    try:
        source12_history()
        unapplied12_guard(actual_git('show', RELEASE13_BASE+':package-lock.json'),
                          lambda path: actual_git('show', RELEASE13_BASE+':'+path))
    finally:
        globals()['git'] = actual_git


def validate13(bundle=BUNDLE):
    if not release13_active():
        return validate12(bundle)
    manifest = dependency13_guard(regular(ROOT/'package-lock.json'))
    # Current/index/history checks run with actual source. Only the original root
    # lock witness inside the unchanged semantic validator reads its declared version.
    import types
    namespace = dict(globals())
    actual_regular = regular
    def historical_witness_reader(path):
        if path == ROOT/'package-lock.json':
            return git('show', BASE+':package-lock.json')
        return actual_regular(path)
    namespace['regular'] = historical_witness_reader
    legacy = types.FunctionType(RELEASE12_LEGACY_VALIDATE.__code__, namespace)
    result = legacy(bundle)
    result['historical_lock_witness'] = manifest['originalLock']['sha256']
    result['current_dependency_witness'] = manifest['candidateLock']['sha256']
    result['ios_privacy_lock_successor'] = RELEASE13_MANIFEST_SHA256
    result['dependency_successor_status'] = 'SOURCE_CANDIDATE_REVIEW_REQUIRED'
    return result


RELEASE14_BASE = 'd0c5ad49ba22c8da7136d59a399589af1cea0e82'
RELEASE14_TREE = '4cfe9c819df4c22fc5d19d79f9c0e89e0e24c973'
RELEASE14_AUTHORITY = 'BRAIN-M103-G97-SOURCE-TRIAGE14-CANDIDATE-01'
RELEASE14_PR = 18  # Allocated by GitHub on 2026-10-25; observed after draft creation.
RELEASE14_EXISTING = {'scripts/launch/governed-evidence-chain.test.mjs',
    'scripts/release/full-app-j01/check.py', 'docs/phase-4/generated/source-worklist.json',
    'docs/phase-4/generated/source-worklist.md', 'ONSKIN_BRAIN_HANDOFF.txt'}
RELEASE14_NEW = {'scripts/security14/triage_gitleaks.py', 'scripts/security14/test_triage_gitleaks.py',
    'scripts/security14/source_inventory.py', 'scripts/security14/test_source_inventory.py',
    'scripts/release/full-app-j01/source_consumer14.test.py',
    'docs/release/full-app-j01/g97-security-triage14.md',
    'docs/release/full-app-j01/g97-security-triage14.unapplied.json'}
RELEASE14_PREFIXES = ('docs/brain/contracts/SECURITY-14/', 'docs/brain/task-specs/SECURITY-14/',
    'docs/brain/checkpoints/M1-03/G97-SOURCE-TRIAGE-14/')


def allowed14(path):
    return (isinstance(path, str) and re.fullmatch(r'[A-Za-z0-9._/-]+', path) is not None and
        all(p and not p.startswith('.') and not p.endswith('.') and
            re.fullmatch(r'(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?', p, re.I) is None
            for p in path.split('/')) and
        (path in RELEASE14_EXISTING or path in RELEASE14_NEW or path.startswith(RELEASE14_PREFIXES)))


def release14_active():
    return subprocess.run(['git', 'merge-base', '--is-ancestor', RELEASE14_BASE, 'HEAD'],
        cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE).returncode == 0


def validate14_checker(raw):
    before = git('show', RELEASE14_BASE+':scripts/release/full-app-j01/check.py')
    old = ast.parse(before); new = ast.parse(raw)
    funcs = lambda module: {n.name: ast.dump(n, include_attributes=False)
        for n in module.body if isinstance(n, ast.FunctionDef)}
    old_functions, new_functions = funcs(old), funcs(new)
    require(all(new_functions.get(k) == v for k, v in old_functions.items() if k != 'source_guard'),
            'R14_INHERITED_FUNCTION_CHANGED')
    expected = before.replace(b'    if release13_active():\n        source11_historical_segment()',
        b'    if release14_active():\n        source11_historical_segment()\n        source12_historical_segment()\n        source13_historical_segment()\n        source14_guard()\n    elif release13_active():\n        source11_historical_segment()')
    expected = expected.replace(b'or allowed13(path),', b'or allowed13(path) or allowed14(path),')
    require(new_functions.get('source_guard') == funcs(ast.parse(expected))['source_guard'],
            'R14_ORIGINAL_SOURCE_GUARD_CHANGED')
    assignments = lambda module: {ast.dump(n.targets[0]): ast.dump(n.value, include_attributes=False)
        for n in module.body if isinstance(n, ast.Assign) and len(n.targets) == 1}
    old_globals, new_globals = assignments(old), assignments(new)
    require(all(new_globals.get(k) == v for k, v in old_globals.items()), 'R14_INHERITED_GLOBAL_CHANGED')
    # Preserve every original module-level import, expression, alias and entrypoint
    # in order. New source-only definitions cannot replace an old top-level node.
    old_other = [ast.dump(n, include_attributes=False) for n in old.body
                 if not isinstance(n, (ast.Assign, ast.FunctionDef))]
    new_other = [ast.dump(n, include_attributes=False) for n in new.body
                 if not isinstance(n, (ast.Assign, ast.FunctionDef))]
    require(old_other == new_other, 'R14_INHERITED_MODULE_CHANGED')
    original_assignments = [ast.dump(n, include_attributes=False) for n in old.body if isinstance(n, ast.Assign)]
    inherited_assignments = [ast.dump(n, include_attributes=False) for n in new.body
        if isinstance(n, ast.Assign) and ast.dump(n.targets[0]) in old_globals]
    require(original_assignments == inherited_assignments, 'R14_INHERITED_ASSIGNMENT_ORDER')
    added = [n for n in new.body if isinstance(n, ast.Assign) and ast.dump(n.targets[0]) not in old_globals]
    require(all(len(n.targets) == 1 and isinstance(n.targets[0], ast.Name) and
                n.targets[0].id.startswith('RELEASE14_') for n in added), 'R14_NEW_GLOBAL_SCOPE')
    new_names = [n.name for n in new.body if isinstance(n, ast.FunctionDef)]
    require(len(new_names) == len(set(new_names)), 'R14_REDEFINED_SAFEGUARD')


def validate14_provenance_test(raw):
    old = git('show', RELEASE14_BASE+':scripts/launch/governed-evidence-chain.test.mjs')
    begin = b'function gitNulPaths('; end = b'\nfunction write('
    start, stop = old.index(begin), old.index(end, old.index(begin))
    left, right = raw.index(begin), raw.index(end, raw.index(begin))
    helper = raw[left:right]
    require(helper.count(b'maxBuffer: 8 * 1024 * 1024') == 1 and
            b"assert.equal(output.at(-1), 0" in helper and
            b"{ fatal: true }" in helper and b'return paths;' in helper, 'R14_FINITE_GIT_BUFFER')
    restored = raw[:left] + old[start:stop] + raw[right:]
    tests_begin = b"test('bounded Git paths preserve a real greater-than-1MiB"
    tests_end = b"test('canonical ledger builder/parser"
    a, b = restored.index(tests_begin), restored.index(tests_end)
    require(a < b and b'14000' in restored[a:b] and b'ENOBUFS' in restored[a:b] and
            b'assert.deepEqual(governedGeneratedPaths, trackedGeneratedPaths)' in restored[a:b],
            'R14_GIT_BUFFER_REGRESSION')
    require(restored[:a] + restored[b:] == old, 'R14_ORIGINAL_PROVENANCE_ASSERTION_CHANGED')


def candidate14_guard(raw):
    value = json.loads(raw, object_pairs_hook=pairs)
    require(value['schema'] == 1 and value['authority'] == RELEASE14_AUTHORITY and
            value['status'] == 'UNAPPLIED' and value['source'] == RELEASE14_BASE and
            value['tree'] == RELEASE14_TREE and value['acceptanceGranted'] is False and
            value['admissions'] == dict(G97=False, DB=False, M103=False, M2=False, J01=False, PUBLIC=False),
            'R14_NO_ADMISSION')
    require(isinstance(value['tasks'], list) and bool(value['tasks']) and
            all(t['status'] == 'UNAPPLIED' and t['qualified_owner_required'] is True and
                t['owner_decision'] == 'NOT_PERFORMED' and bool(t['source_witnesses'])
                for t in value['tasks']), 'R14_OWNER_DECISION_UNAPPLIED')
    for task in value['tasks']:
        for witness in task['source_witnesses']:
            name = witness['path']
            require(isinstance(name, str) and re.fullmatch('[A-Za-z0-9._/-]+', name) and
                    not any(x in ('', '.', '..') for x in name.split('/')), 'R14_OWNER_SOURCE_PATH')
            require(sha(git('show', RELEASE14_BASE+':'+name)) == witness['sha256'] and
                    git('rev-parse', RELEASE14_BASE+':'+name).decode().strip() == witness['blob'],
                    'R14_OWNER_SOURCE_WITNESS')


def validate14_diff(raw, read_after):
    fields = raw.split(b'\0')
    require(fields[-1] == b'' and len(fields) % 2 == 1, 'R14_DIFF_SHAPE')
    names = set()
    for n in range(0, len(fields)-1, 2):
        metadata = fields[n].decode('ascii').split(); path = fields[n+1].decode('utf-8')
        require(len(metadata) == 5, 'R14_DIFF_META')
        oldmode, newmode, oldblob, newblob, status = metadata
        require(allowed14(path) and status in ('A', 'M'), 'R14_SCOPE:'+path)
        key = unicodedata.normalize('NFKC', path).casefold()
        require(key not in names, 'R14_COLLISION:'+path); names.add(key)
        require(oldmode in (':000000', ':100644') and newmode == '100644', 'R14_MODE:'+path)
        require((path in RELEASE14_EXISTING) == (oldmode == ':100644') and
                status == ('M' if oldmode == ':100644' else 'A') and
                all(re.fullmatch('[0-9a-f]{40}', x) for x in (oldblob, newblob)), 'R14_CREATE_EDIT:'+path)
        if oldmode == ':000000':
            require(oldblob == '0'*40 and subprocess.run(['git', 'cat-file', '-e', RELEASE14_BASE+':'+path],
                cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE).returncode != 0, 'R14_EXISTING_RECLASSIFIED')
        else:
            require(oldblob == git('rev-parse', RELEASE14_BASE+':'+path).decode().strip(), 'R14_BASE_BLOB')
        data = read_after(path)
        if path == 'scripts/release/full-app-j01/check.py': validate14_checker(data)
        if path == 'scripts/launch/governed-evidence-chain.test.mjs': validate14_provenance_test(data)
        if path == 'docs/release/full-app-j01/g97-security-triage14.unapplied.json': candidate14_guard(data)


def source14_endpoint():
    head = git('rev-parse', 'HEAD').decode().strip()
    parents = git('rev-list', '--parents', '-n', '1', head).decode().split()
    if len(parents) == 2: return head
    require(len(parents) == 3, 'R14_LINEAR_HISTORY')
    require(RELEASE14_PR > 0 and os.environ.get('GITHUB_EVENT_NAME') == 'pull_request' and
            os.environ.get('GITHUB_REPOSITORY') == 'TasfiqJ/onSkin' and
            os.environ.get('GITHUB_REF') == 'refs/pull/'+str(RELEASE14_PR)+'/merge' and
            os.environ.get('GITHUB_SHA') == head, 'R14_CI_MERGE_CONTEXT')
    event_path = Path(os.environ.get('GITHUB_EVENT_PATH', ''))
    require(event_path.is_file() and event_path.stat().st_size <= 1024*1024, 'R14_CI_EVENT')
    event = load(event_path); pr = event.get('pull_request', {})
    require(event.get('number') == RELEASE14_PR and pr.get('number') == RELEASE14_PR and
            event.get('repository', {}).get('full_name') == 'TasfiqJ/onSkin' and
            pr.get('base', {}).get('sha') == RELEASE14_BASE and parents[1] == RELEASE14_BASE and
            pr.get('base', {}).get('ref') == 'stage/m103-ios-privacy-lock-succession13' and
            pr.get('head', {}).get('sha') == parents[2] and
            pr.get('head', {}).get('ref') == 'stage/m103-g97-provenance-triage14' and
            pr.get('head', {}).get('repo', {}).get('full_name') == 'TasfiqJ/onSkin', 'R14_CI_EVENT_IDENTITY')
    require(git('merge-base', RELEASE14_BASE, parents[2]).decode().strip() == RELEASE14_BASE, 'R14_CI_MERGE_BASE')
    require(git('rev-parse', head+'^{tree}') == git('rev-parse', parents[2]+'^{tree}'), 'R14_CI_MERGE_TREE')
    return parents[2]


def source14_history():
    require(git('rev-parse', RELEASE14_BASE+'^{tree}').decode().strip() == RELEASE14_TREE, 'R14_BASE_TREE')
    endpoint = source14_endpoint()
    subprocess.run(['git', 'merge-base', '--is-ancestor', RELEASE14_BASE, endpoint],
        cwd=ROOT, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    for commit in git('rev-list', '--reverse', RELEASE14_BASE+'..'+endpoint).decode().splitlines():
        require(len(git('rev-list', '--parents', '-n', '1', commit).decode().split()) == 2, 'R14_LINEAR_HISTORY')
        validate14_diff(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE14_BASE, commit),
                        lambda path: git('show', commit+':'+path))


def source13_historical_segment():
    actual_git = git
    def historical_git(*args):
        if args == ('rev-parse', 'HEAD'): return actual_git('rev-parse', RELEASE14_BASE)
        return actual_git(*args)
    globals()['git'] = historical_git
    try:
        source13_history()
        validate13_checker(actual_git('show', RELEASE14_BASE+':scripts/release/full-app-j01/check.py'))
    finally:
        globals()['git'] = actual_git


def source14_guard():
    source14_history()
    dependency13_guard(regular(ROOT/'package-lock.json'))
    dependency13_guard(git('show', ':package-lock.json'), lambda p: git('show', ':'+p), installed=False)
    validate14_diff(git('diff', '--cached', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE14_BASE),
                    lambda path: git('show', ':'+path))
    validate14_diff(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE14_BASE),
                    lambda path: regular(ROOT/path))
    names = set()
    for entry in git('ls-files', '-v', '-z').decode().split('\0'):
        if entry:
            require(entry.startswith('H '), 'R14_INDEX_FLAGS')
            key = unicodedata.normalize('NFKC', entry[2:]).casefold()
            require(key not in names, 'R14_COLLISION'); names.add(key)
    for path in git('ls-files', '--others', '--exclude-standard', '-z').decode().split('\0'):
        if path:
            require(allowed14(path) and path not in RELEASE14_EXISTING, 'R14_UNTRACKED_SCOPE:'+path)
            key = unicodedata.normalize('NFKC', path).casefold()
            require(key not in names, 'R14_COLLISION'); names.add(key); regular(ROOT/path)
    # Existing immutable Quality wiring invokes this CLI. Add only source-only
    # synthetic tests; never execute the private artifact reader or a live scan.
    # Bundle-only semantic CLI negatives run their unchanged assertions separately.
    if os.environ.get('GITHUB_ACTIONS') == 'true' and __name__ == '__main__' and '--bundle-dir' not in sys.argv:
        for args in [[sys.executable, '-B', '-m', 'unittest', 'discover', '-s', 'scripts/security14', '-p', 'test_*.py'],
                     [sys.executable, '-B', 'scripts/release/full-app-j01/source_consumer14.test.py']]:
            result = subprocess.run(args, cwd=ROOT, capture_output=True)
            require(result.returncode == 0, 'R14_SOURCE_TESTS_FAILED:'+result.stdout.decode(errors='replace')+result.stderr.decode(errors='replace'))


RELEASE15_BASE = '53cf869c5fc5f13ecd18dc1ef9c3a6288eaae51a'
RELEASE15_TREE = '1c483dedfb4c5d51994be07f65f1a40bdd52be73'
RELEASE15_PR = 19  # Allocated by GitHub after draft creation on 2026-10-25.
RELEASE15_AUTHORITY = 'BRAIN-M103-G97-FULL-COVERAGE15-CANDIDATE-01'
RELEASE15_EXISTING = {'scripts/release/full-app-j01/check.py',
    'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md',
    'ONSKIN_BRAIN_HANDOFF.txt'}
RELEASE15_NEW = {'scripts/security15/build_candidate.py', 'scripts/security15/verify_candidate.py',
    'scripts/security15/source_bindings.py', 'scripts/security15/test_candidate.py',
    'scripts/security15/test_integrity.py', 'scripts/release/full-app-j01/source_consumer15.test.py',
    'docs/release/full-app-j01/g97-source-coverage15.md',
    'docs/release/full-app-j01/g97-source-coverage15.unapplied.json'}
RELEASE15_PREFIXES = ('docs/brain/contracts/SECURITY-15/', 'docs/brain/task-specs/SECURITY-15/',
    'docs/brain/checkpoints/M1-03/G97-COVERAGE-CANDIDATE-15/')


def allowed15(path):
    return (isinstance(path, str) and re.fullmatch(r'[A-Za-z0-9._/-]+', path) is not None and
        all(p and not p.startswith('.') and not p.endswith('.') and
            re.fullmatch(r'(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?', p, re.I) is None
            for p in path.split('/')) and
        (path in RELEASE15_EXISTING or path in RELEASE15_NEW or path.startswith(RELEASE15_PREFIXES)))


def release15_active():
    return subprocess.run(['git', 'merge-base', '--is-ancestor', RELEASE15_BASE, 'HEAD'],
        cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE).returncode == 0


def validate15_checker(raw):
    before = git('show', RELEASE15_BASE+':scripts/release/full-app-j01/check.py')
    old = ast.parse(before); new = ast.parse(raw)
    funcs = lambda module: {n.name: ast.dump(n, include_attributes=False)
        for n in module.body if isinstance(n, ast.FunctionDef)}
    old_functions, new_functions = funcs(old), funcs(new)
    require(all(new_functions.get(k) == v for k, v in old_functions.items() if k != 'source_guard'),
            'R15_INHERITED_FUNCTION_CHANGED')
    expected = before.replace(b'    if release14_active():\n        source11_historical_segment()',
        b'    if release15_active():\n        source11_historical_segment()\n        source12_historical_segment()\n        source13_historical_segment()\n        source14_historical_segment()\n        source15_guard()\n    elif release14_active():\n        source11_historical_segment()')
    expected = expected.replace(b'or allowed14(path),', b'or allowed14(path) or allowed15(path),')
    require(new_functions.get('source_guard') == funcs(ast.parse(expected))['source_guard'],
            'R15_ORIGINAL_SOURCE_GUARD_CHANGED')
    assignments = lambda module: {ast.dump(n.targets[0]): ast.dump(n.value, include_attributes=False)
        for n in module.body if isinstance(n, ast.Assign) and len(n.targets) == 1}
    old_globals, new_globals = assignments(old), assignments(new)
    require(all(new_globals.get(k) == v for k, v in old_globals.items()), 'R15_INHERITED_GLOBAL_CHANGED')
    # Preserve every original module-level import, expression, alias and entrypoint
    # in order. New source-only definitions cannot replace an old top-level node.
    old_other = [ast.dump(n, include_attributes=False) for n in old.body
                 if not isinstance(n, (ast.Assign, ast.FunctionDef))]
    new_other = [ast.dump(n, include_attributes=False) for n in new.body
                 if not isinstance(n, (ast.Assign, ast.FunctionDef))]
    require(old_other == new_other, 'R15_INHERITED_MODULE_CHANGED')
    original_assignments = [ast.dump(n, include_attributes=False) for n in old.body if isinstance(n, ast.Assign)]
    inherited_assignments = [ast.dump(n, include_attributes=False) for n in new.body
        if isinstance(n, ast.Assign) and ast.dump(n.targets[0]) in old_globals]
    require(original_assignments == inherited_assignments, 'R15_INHERITED_ASSIGNMENT_ORDER')
    added = [n for n in new.body if isinstance(n, ast.Assign) and ast.dump(n.targets[0]) not in old_globals]
    require(all(len(n.targets) == 1 and isinstance(n.targets[0], ast.Name) and
                n.targets[0].id.startswith('RELEASE15_') for n in added), 'R15_NEW_GLOBAL_SCOPE')
    new_names = [n.name for n in new.body if isinstance(n, ast.FunctionDef)]
    require(len(new_names) == len(set(new_names)), 'R15_REDEFINED_SAFEGUARD')


def candidate15_guard(raw):
    value = json.loads(raw, object_pairs_hook=pairs)
    require(value['schema'] == 1 and value['authority'] == RELEASE15_AUTHORITY and
            value['status'] == 'UNAPPLIED_CANDIDATE' and value['source'] == RELEASE15_BASE and
            value['tree'] == RELEASE15_TREE and value['acceptanceGranted'] is False and
            value['admissions'] == dict(G97=False, DB=False, M103=False, M2=False, J01=False, PUBLIC=False),
            'R15_NO_ADMISSION')
    require(isinstance(value['tasks'], list) and bool(value['tasks']) and
            all(t['status'] == 'UNAPPLIED' and t['qualified_owner_required'] is True and
                t['owner_decision'] == 'NOT_PERFORMED' and bool(t['source_witnesses'])
                for t in value['tasks']), 'R15_OWNER_DECISION_UNAPPLIED')
    require(value['stop']=='STOP_FOR_QUALIFIED_SECURITY_CUSTODIAN' and
            all(t['negative_cases'] and t['acceptance_criteria'] for t in value['tasks']), 'R15_OWNER_CRITERIA')
    for task in value['tasks']:
        for witness in task['source_witnesses']:
            name = witness['path']
            require(isinstance(name, str) and re.fullmatch('[A-Za-z0-9._/-]+', name) and
                    not any(x in ('', '.', '..') for x in name.split('/')), 'R15_OWNER_SOURCE_PATH')
            require(sha(git('show', RELEASE15_BASE+':'+name)) == witness['sha256'] and
                    git('rev-parse', RELEASE15_BASE+':'+name).decode().strip() == witness['blob'],
                    'R15_OWNER_SOURCE_WITNESS')


def validate15_diff(raw, read_after):
    fields = raw.split(b'\0')
    require(fields[-1] == b'' and len(fields) % 2 == 1, 'R15_DIFF_SHAPE')
    names = set()
    for n in range(0, len(fields)-1, 2):
        metadata = fields[n].decode('ascii').split(); path = fields[n+1].decode('utf-8')
        require(len(metadata) == 5, 'R15_DIFF_META')
        oldmode, newmode, oldblob, newblob, status = metadata
        require(allowed15(path) and status in ('A', 'M'), 'R15_SCOPE:'+path)
        key = unicodedata.normalize('NFKC', path).casefold()
        require(key not in names, 'R15_COLLISION:'+path); names.add(key)
        require(oldmode in (':000000', ':100644') and newmode == '100644', 'R15_MODE:'+path)
        require((path in RELEASE15_EXISTING) == (oldmode == ':100644') and
                status == ('M' if oldmode == ':100644' else 'A') and
                all(re.fullmatch('[0-9a-f]{40}', x) for x in (oldblob, newblob)), 'R15_CREATE_EDIT:'+path)
        if oldmode == ':000000':
            require(oldblob == '0'*40 and subprocess.run(['git', 'cat-file', '-e', RELEASE15_BASE+':'+path],
                cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE).returncode != 0, 'R15_EXISTING_RECLASSIFIED')
        else:
            require(oldblob == git('rev-parse', RELEASE15_BASE+':'+path).decode().strip(), 'R15_BASE_BLOB')
        data = read_after(path)
        require(newblob == '0'*40 or hashlib.sha1(('blob '+str(len(data))+'\0').encode()+data).hexdigest()==newblob,
                'R15_AFTER_BLOB')
        if path == 'scripts/release/full-app-j01/check.py': validate15_checker(data)
        if path == 'docs/release/full-app-j01/g97-source-coverage15.unapplied.json': candidate15_guard(data)


def source15_endpoint():
    head = git('rev-parse', 'HEAD').decode().strip()
    parents = git('rev-list', '--parents', '-n', '1', head).decode().split()
    if len(parents) == 2: return head
    require(len(parents) == 3, 'R15_LINEAR_HISTORY')
    require(RELEASE15_PR > 0 and os.environ.get('GITHUB_EVENT_NAME') == 'pull_request' and
            os.environ.get('GITHUB_REPOSITORY') == 'TasfiqJ/onSkin' and
            os.environ.get('GITHUB_REF') == 'refs/pull/'+str(RELEASE15_PR)+'/merge' and
            os.environ.get('GITHUB_SHA') == head, 'R15_CI_MERGE_CONTEXT')
    event_path = Path(os.environ.get('GITHUB_EVENT_PATH', ''))
    require(event_path.is_file() and event_path.stat().st_size <= 1024*1024, 'R15_CI_EVENT')
    event = load(event_path); pr = event.get('pull_request', {})
    require(event.get('number') == RELEASE15_PR and pr.get('number') == RELEASE15_PR and
            event.get('repository', {}).get('full_name') == 'TasfiqJ/onSkin' and
            pr.get('base', {}).get('sha') == RELEASE15_BASE and parents[1] == RELEASE15_BASE and
            pr.get('base', {}).get('ref') == 'stage/m103-g97-provenance-triage14' and
            pr.get('head', {}).get('sha') == parents[2] and
            pr.get('head', {}).get('ref') == 'stage/m103-g97-coverage-candidate15' and
            pr.get('head', {}).get('repo', {}).get('full_name') == 'TasfiqJ/onSkin', 'R15_CI_EVENT_IDENTITY')
    require(git('merge-base', RELEASE15_BASE, parents[2]).decode().strip() == RELEASE15_BASE, 'R15_CI_MERGE_BASE')
    require(git('rev-parse', head+'^{tree}') == git('rev-parse', parents[2]+'^{tree}'), 'R15_CI_MERGE_TREE')
    return parents[2]


def source15_history():
    require(git('rev-parse', RELEASE15_BASE+'^{tree}').decode().strip() == RELEASE15_TREE, 'R15_BASE_TREE')
    endpoint = source15_endpoint()
    subprocess.run(['git', 'merge-base', '--is-ancestor', RELEASE15_BASE, endpoint],
        cwd=ROOT, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    for commit in git('rev-list', '--reverse', RELEASE15_BASE+'..'+endpoint).decode().splitlines():
        require(len(git('rev-list', '--parents', '-n', '1', commit).decode().split()) == 2, 'R15_LINEAR_HISTORY')
        validate15_diff(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE15_BASE, commit),
                        lambda path: git('show', commit+':'+path))


def source14_historical_segment():
    actual_git = git
    def historical_git(*args):
        if args == ('rev-parse', 'HEAD'): return actual_git('rev-parse', RELEASE15_BASE)
        return actual_git(*args)
    globals()['git'] = historical_git
    try:
        source14_history()
        validate14_checker(actual_git('show', RELEASE15_BASE+':scripts/release/full-app-j01/check.py'))
    finally:
        globals()['git'] = actual_git


def source15_guard():
    source15_history()
    dependency13_guard(regular(ROOT/'package-lock.json'))
    dependency13_guard(git('show', ':package-lock.json'), lambda p: git('show', ':'+p), installed=False)
    validate15_diff(git('diff', '--cached', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE15_BASE),
                    lambda path: git('show', ':'+path))
    validate15_diff(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE15_BASE),
                    lambda path: regular(ROOT/path))
    names = set()
    for entry in git('ls-files', '-v', '-z').decode().split('\0'):
        if entry:
            require(entry.startswith('H '), 'R15_INDEX_FLAGS')
            key = unicodedata.normalize('NFKC', entry[2:]).casefold()
            require(key not in names, 'R15_COLLISION'); names.add(key)
    for path in git('ls-files', '--others', '--exclude-standard', '-z').decode().split('\0'):
        if path:
            require(allowed15(path) and path not in RELEASE15_EXISTING, 'R15_UNTRACKED_SCOPE:'+path)
            key = unicodedata.normalize('NFKC', path).casefold()
            require(key not in names, 'R15_COLLISION'); names.add(key); regular(ROOT/path)
    # Bounded read-only candidate invocation; future evidence is not a prerequisite.
    if os.environ.get('GITHUB_ACTIONS') == 'true' and __name__ == '__main__' and '--bundle-dir' not in sys.argv:
        commands = [[sys.executable, '-B', 'scripts/security15/verify_candidate.py', '--source-only'],
            [sys.executable, '-B', '-m', 'unittest', 'discover', '-s', 'scripts/security15', '-p', 'test_*.py'],
            [sys.executable, '-B', 'scripts/release/full-app-j01/source_consumer15.test.py']]
        for command in commands:
            result = subprocess.run(command, cwd=ROOT, capture_output=True, timeout=300)
            require(result.returncode == 0, 'R15_CANDIDATE_TESTS_FAILED')


RELEASE16_BASE = 'b79e6d1e21a367be5cea5d0b333de9f2a144d41f'
RELEASE16_TREE = 'ca7b6ac8ebcc0086b338b784f110b411400361b0'
RELEASE16_PR = 0  # Replaced only with the actual GitHub allocation after creation.
RELEASE16_AUTHORITY = 'BRAIN-M1X-ONBOARDING-RESILIENCE16-CANDIDATE-01'
RELEASE16_EXISTING = {
    'apps/mobile/src/app/onboarding/notifications.tsx', 'apps/mobile/src/app/onboarding/quiz.tsx',
    'apps/mobile/src/app/onboarding/products.tsx', 'apps/mobile/src/features/notifications/onboarding.ts',
    'apps/mobile/src/features/notifications/onboarding.test.ts',
    'apps/mobile/src/features/notifications/applyPreferences.ts',
    'apps/mobile/src/features/notifications/applyPreferences.test.ts',
    'docs/USER_FLOW_TREE.md', 'scripts/release/full-app-j01/check.py',
    'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md',
    'ONSKIN_BRAIN_HANDOFF.txt'}
RELEASE16_NEW = {'apps/mobile/src/features/onboarding/quizNavigation16.ts',
    'apps/mobile/src/features/onboarding/quizNavigation16.test.ts',
    'apps/mobile/src/features/notifications/reminderRecovery16.test.ts',
    'apps/mobile/src/features/onboarding/productsFooter16.ts',
    'apps/mobile/src/features/onboarding/productsFooter16.test.ts',
    'scripts/release/full-app-j01/source_consumer16.test.py',
    'scripts/m1/onboarding_recovery16_browser.mjs'}
RELEASE16_PREFIXES = ('docs/brain/contracts/M1X-16/', 'docs/brain/task-specs/M1X-16/',
    'docs/brain/checkpoints/M1-02/ONBOARDING-RECOVERY-16/')


def allowed16(path):
    return (isinstance(path, str) and re.fullmatch(r'[A-Za-z0-9._/-]+', path) is not None and
        all(p and not p.startswith('.') and not p.endswith('.') and
            re.fullmatch(r'(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?', p, re.I) is None
            for p in path.split('/')) and
        (path in RELEASE16_EXISTING or path in RELEASE16_NEW or path.startswith(RELEASE16_PREFIXES)))


def validate16_checker(raw):
    before = git('show', RELEASE16_BASE+':scripts/release/full-app-j01/check.py')
    old = ast.parse(before); new = ast.parse(raw)
    funcs = lambda module: {n.name: ast.dump(n, include_attributes=False)
        for n in module.body if isinstance(n, ast.FunctionDef)}
    old_functions, new_functions = funcs(old), funcs(new)
    require(all(new_functions.get(k) == v for k, v in old_functions.items() if k != 'source_guard'),
            'R16_INHERITED_FUNCTION_CHANGED')
    expected = before.replace(b'    if release15_active():\n        source11_historical_segment()',
        b'    if release16_active():\n        source11_historical_segment()\n        source12_historical_segment()\n        source13_historical_segment()\n        source14_historical_segment()\n        source15_historical_segment()\n        source16_guard()\n    elif release15_active():\n        source11_historical_segment()')
    expected = expected.replace(b'or allowed15(path),', b'or allowed15(path) or allowed16(path),')
    require(new_functions.get('source_guard') == funcs(ast.parse(expected))['source_guard'],
            'R16_ORIGINAL_SOURCE_GUARD_CHANGED')
    assignments = lambda module: {ast.dump(n.targets[0]): ast.dump(n.value, include_attributes=False)
        for n in module.body if isinstance(n, ast.Assign) and len(n.targets) == 1}
    old_globals, new_globals = assignments(old), assignments(new)
    require(all(new_globals.get(k) == v for k, v in old_globals.items()), 'R16_INHERITED_GLOBAL_CHANGED')
    # Preserve every original module-level import, expression, alias and entrypoint
    # in order. New source-only definitions cannot replace an old top-level node.
    old_other = [ast.dump(n, include_attributes=False) for n in old.body
                 if not isinstance(n, (ast.Assign, ast.FunctionDef))]
    new_other = [ast.dump(n, include_attributes=False) for n in new.body
                 if not isinstance(n, (ast.Assign, ast.FunctionDef))]
    require(old_other == new_other, 'R16_INHERITED_MODULE_CHANGED')
    original_assignments = [ast.dump(n, include_attributes=False) for n in old.body if isinstance(n, ast.Assign)]
    inherited_assignments = [ast.dump(n, include_attributes=False) for n in new.body
        if isinstance(n, ast.Assign) and ast.dump(n.targets[0]) in old_globals]
    require(original_assignments == inherited_assignments, 'R16_INHERITED_ASSIGNMENT_ORDER')
    added = [n for n in new.body if isinstance(n, ast.Assign) and ast.dump(n.targets[0]) not in old_globals]
    require(all(len(n.targets) == 1 and isinstance(n.targets[0], ast.Name) and
                n.targets[0].id.startswith('RELEASE16_') for n in added), 'R16_NEW_GLOBAL_SCOPE')
    new_names = [n.name for n in new.body if isinstance(n, ast.FunctionDef)]
    require(len(new_names) == len(set(new_names)), 'R16_REDEFINED_SAFEGUARD')


def candidate16_guard(raw):
    value = json.loads(raw, object_pairs_hook=pairs)
    require(value['schema'] == 1 and value['authority'] == RELEASE16_AUTHORITY and
            value['status'] == 'SOURCE_ONLY_CANDIDATE' and value['base'] == RELEASE16_BASE and
            value['tree'] == RELEASE16_TREE and value['acceptanceGranted'] is False and
            value['admissions'] == dict(G97=False, DB=False, M103=False, M2=False, J01=False, PUBLIC=False),
            'R16_NO_ADMISSION')


def validate16_diff(raw, read_after):
    fields = raw.split(b'\0')
    require(fields[-1] == b'' and len(fields) % 2 == 1, 'R16_DIFF_SHAPE')
    names = set()
    for n in range(0, len(fields)-1, 2):
        metadata = fields[n].decode('ascii').split(); path = fields[n+1].decode('utf-8')
        require(len(metadata) == 5, 'R16_DIFF_META')
        oldmode, newmode, oldblob, newblob, status = metadata
        require(allowed16(path) and status in ('A', 'M'), 'R16_SCOPE:'+path)
        key = unicodedata.normalize('NFKC', path).casefold()
        require(key not in names, 'R16_COLLISION:'+path); names.add(key)
        require(oldmode in (':000000', ':100644') and newmode == '100644', 'R16_MODE:'+path)
        require((path in RELEASE16_EXISTING) == (oldmode == ':100644') and
                status == ('M' if oldmode == ':100644' else 'A') and
                all(re.fullmatch('[0-9a-f]{40}', x) for x in (oldblob, newblob)), 'R16_CREATE_EDIT:'+path)
        if oldmode == ':000000':
            require(oldblob == '0'*40 and subprocess.run(['git', 'cat-file', '-e', RELEASE16_BASE+':'+path],
                cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE).returncode != 0, 'R16_EXISTING_RECLASSIFIED')
        else:
            require(oldblob == git('rev-parse', RELEASE16_BASE+':'+path).decode().strip(), 'R16_BASE_BLOB')
        data = read_after(path)
        require(newblob == '0'*40 or hashlib.sha1(('blob '+str(len(data))+'\0').encode()+data).hexdigest()==newblob,
                'R16_AFTER_BLOB')
        if path == 'scripts/release/full-app-j01/check.py': validate16_checker(data)
        if path == 'docs/brain/contracts/M1X-16/candidate.json': candidate16_guard(data)
        if path == 'docs/USER_FLOW_TREE.md':
            before = git('show', RELEASE16_BASE+':'+path)
            require(data.startswith(before) and data[len(before):].count(b'## Campaign16:') == 1, 'R16_ADDITIVE_FLOW')


def source16_endpoint():
    head = git('rev-parse', 'HEAD').decode().strip()
    parents = git('rev-list', '--parents', '-n', '1', head).decode().split()
    if len(parents) == 2: return head
    require(len(parents) == 3, 'R16_LINEAR_HISTORY')
    require(RELEASE16_PR > 0 and os.environ.get('GITHUB_EVENT_NAME') == 'pull_request' and
            os.environ.get('GITHUB_REPOSITORY') == 'TasfiqJ/onSkin' and
            os.environ.get('GITHUB_REF') == 'refs/pull/'+str(RELEASE16_PR)+'/merge' and
            os.environ.get('GITHUB_SHA') == head, 'R16_CI_MERGE_CONTEXT')
    event_path = Path(os.environ.get('GITHUB_EVENT_PATH', ''))
    require(event_path.is_file() and event_path.stat().st_size <= 1024*1024, 'R16_CI_EVENT')
    event = load(event_path); pr = event.get('pull_request', {})
    require(event.get('number') == RELEASE16_PR and pr.get('number') == RELEASE16_PR and
            event.get('repository', {}).get('full_name') == 'TasfiqJ/onSkin' and
            pr.get('base', {}).get('sha') == RELEASE16_BASE and parents[1] == RELEASE16_BASE and
            pr.get('base', {}).get('ref') == 'stage/m103-g97-coverage-candidate15' and
            pr.get('head', {}).get('sha') == parents[2] and
            pr.get('head', {}).get('ref') == 'stage/m1-first-session-recovery16' and
            pr.get('head', {}).get('repo', {}).get('full_name') == 'TasfiqJ/onSkin', 'R16_CI_EVENT_IDENTITY')
    require(git('merge-base', RELEASE16_BASE, parents[2]).decode().strip() == RELEASE16_BASE, 'R16_CI_MERGE_BASE')
    require(git('rev-parse', head+'^{tree}') == git('rev-parse', parents[2]+'^{tree}'), 'R16_CI_MERGE_TREE')
    return parents[2]


def source16_history():
    require(git('rev-parse', RELEASE16_BASE+'^{tree}').decode().strip() == RELEASE16_TREE, 'R16_BASE_TREE')
    endpoint = source16_endpoint()
    subprocess.run(['git', 'merge-base', '--is-ancestor', RELEASE16_BASE, endpoint],
        cwd=ROOT, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    for commit in git('rev-list', '--reverse', RELEASE16_BASE+'..'+endpoint).decode().splitlines():
        require(len(git('rev-list', '--parents', '-n', '1', commit).decode().split()) == 2, 'R16_LINEAR_HISTORY')
        validate16_diff(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE16_BASE, commit),
                        lambda path: git('show', commit+':'+path))


def source15_historical_segment():
    actual_git = git
    def historical_git(*args):
        if args == ('rev-parse', 'HEAD'): return actual_git('rev-parse', RELEASE16_BASE)
        return actual_git(*args)
    globals()['git'] = historical_git
    try:
        source15_history()
        validate15_checker(actual_git('show', RELEASE16_BASE+':scripts/release/full-app-j01/check.py'))
    finally:
        globals()['git'] = actual_git


def source16_guard():
    source16_history()
    dependency13_guard(regular(ROOT/'package-lock.json'))
    dependency13_guard(git('show', ':package-lock.json'), lambda p: git('show', ':'+p), installed=False)
    validate16_diff(git('diff', '--cached', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE16_BASE),
                    lambda path: git('show', ':'+path))
    validate16_diff(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE16_BASE),
                    lambda path: regular(ROOT/path))
    names = set()
    for entry in git('ls-files', '-v', '-z').decode().split('\0'):
        if entry:
            require(entry.startswith('H '), 'R16_INDEX_FLAGS')
            key = unicodedata.normalize('NFKC', entry[2:]).casefold()
            require(key not in names, 'R16_COLLISION'); names.add(key)
    for path in git('ls-files', '--others', '--exclude-standard', '-z').decode().split('\0'):
        if path:
            require(allowed16(path) and path not in RELEASE16_EXISTING, 'R16_UNTRACKED_SCOPE:'+path)
            key = unicodedata.normalize('NFKC', path).casefold()
            require(key not in names, 'R16_COLLISION'); names.add(key); regular(ROOT/path)
    if os.environ.get('GITHUB_ACTIONS') == 'true' and __name__ == '__main__' and '--bundle-dir' not in sys.argv:
        result = subprocess.run([sys.executable, '-B', 'scripts/release/full-app-j01/source_consumer16.test.py'],
                                cwd=ROOT, capture_output=True, timeout=300)
        require(result.returncode == 0, 'R16_SOURCE_TESTS_FAILED')


def release16_active():
    return subprocess.run(['git', 'merge-base', '--is-ancestor', RELEASE16_BASE, 'HEAD'],
        cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE).returncode == 0


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
    source10_historical_segment()
    if release16_active():
        source11_historical_segment()
        source12_historical_segment()
        source13_historical_segment()
        source14_historical_segment()
        source15_historical_segment()
        source16_guard()
    elif release15_active():
        source11_historical_segment()
        source12_historical_segment()
        source13_historical_segment()
        source14_historical_segment()
        source15_guard()
    elif release14_active():
        source11_historical_segment()
        source12_historical_segment()
        source13_historical_segment()
        source14_guard()
    elif release13_active():
        source11_historical_segment()
        source12_historical_segment()
        source13_guard()
    elif release12_active():
        source11_historical_segment()
        source12_guard()
    else:
        source11_guard()
    for path in git('diff', '--name-only', BASE).decode().splitlines():
        require(allowed_path(path) or allowed09(path) or allowed10(path) or allowed11(path) or allowed12(path) or allowed13(path) or allowed14(path) or allowed15(path) or allowed16(path), 'WORKING_SCOPE:'+path)
    for path in git('ls-files', '--others', '--exclude-standard').decode().splitlines():
        require(allowed_path(path) or allowed09(path) or allowed10(path) or allowed11(path) or allowed12(path) or allowed13(path) or allowed14(path) or allowed15(path) or allowed16(path), 'UNTRACKED_SCOPE:'+path)
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


# Preserve the original validator function/AST for historical consumers.
RELEASE12_LEGACY_VALIDATE = validate
validate = validate12
validate = validate13


if __name__ == '__main__':
    sys.exit(main())
