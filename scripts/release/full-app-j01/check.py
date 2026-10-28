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
RELEASE16_PR = 20  # Allocated by GitHub on 2026-10-26; never predicted.
RELEASE16_AUTHORITY = 'BRAIN-M1X-ONBOARDING-RESILIENCE16-CANDIDATE-01'
RELEASE16_EXISTING = {
    'apps/mobile/src/app/onboarding/notifications.tsx', 'apps/mobile/src/app/onboarding/quiz.tsx',
    'apps/mobile/src/app/onboarding/products.tsx', 'apps/mobile/src/features/notifications/onboarding.ts',
    'docs/USER_FLOW_TREE.md', 'scripts/release/full-app-j01/check.py',
    'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md',
    'ONSKIN_BRAIN_HANDOFF.txt'}
RELEASE16_NEW = {'apps/mobile/src/features/onboarding/quizNavigation16.ts',
    'apps/mobile/src/features/onboarding/quizNavigation16.test.ts',
    'apps/mobile/src/features/notifications/reminderRecovery16.test.ts',
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
    require(set(new_names)-set(old_functions) == {'allowed16', 'validate16_checker', 'candidate16_guard',
        'validate16_diff', 'source16_endpoint', 'source16_history', 'source15_historical_segment',
        'source16_guard', 'release16_active'}, 'R16_NEW_FUNCTION_SCOPE')
    for assignment in added:
        try: ast.literal_eval(assignment.value)
        except (ValueError, TypeError): require(False, 'R16_NEW_GLOBAL_SIDE_EFFECT')


def candidate16_guard(raw):
    value = json.loads(raw, object_pairs_hook=pairs)
    require(set(value) == {'schema', 'authority', 'status', 'base', 'tree', 'acceptanceGranted', 'admissions'} and
            type(value['schema']) is int and value['schema'] == 1 and value['authority'] == RELEASE16_AUTHORITY and
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
                'R16_AFTER_BLOB:'+path)
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


RELEASE17_BASE = '28953aa3a84fed0684b80b442d0cd9c2de0663b2'
RELEASE17_TREE = '6776b61b49c63345e992da63f82920fedd07518b'
RELEASE17_PR = 21  # Allocated by GitHub on 2026-10-26; draft stacked only on PR20.
RELEASE17_AUTHORITY = 'BRAIN-M1X-PRIVACY-REENTRY17-REPAIR-01'
RELEASE17_EXISTING = {
    'apps/mobile/src/app/onboarding/quiz.tsx', 'apps/mobile/src/app/onboarding/products.tsx',
    'apps/mobile/src/app/onboarding/notifications.tsx',
    'apps/mobile/src/features/onboarding/quizNavigation16.ts',
    'apps/mobile/src/features/onboarding/quizNavigation16.test.ts',
    'apps/mobile/src/features/onboarding/productsFooter16.test.ts',
    'apps/mobile/src/features/notifications/reminderRecovery16.test.ts',
    'docs/USER_FLOW_TREE.md', 'scripts/release/full-app-j01/check.py',
    'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md',
    'ONSKIN_BRAIN_HANDOFF.txt'}
RELEASE17_NEW = {
    'apps/mobile/src/features/onboarding/quizFocus17.test.ts',
    'apps/mobile/src/features/onboarding/productsDraft17.test.ts',
    'apps/mobile/src/features/onboarding/onboardingPrivacy17.test.ts',
    'apps/mobile/src/features/notifications/reminderBoundary17.test.ts',
    'scripts/m1/onboarding_integrity17_browser.mjs',
    'scripts/release/full-app-j01/source_consumer17.test.py'}
RELEASE17_PREFIXES = ('docs/brain/contracts/M1X-17/', 'docs/brain/task-specs/M1X-17/',
    'docs/brain/checkpoints/M1-02/ONBOARDING-INTEGRITY-17/')


def allowed17(path):
    return (isinstance(path, str) and re.fullmatch(r'[A-Za-z0-9._/-]+', path) is not None and
        all(p and not p.startswith('.') and not p.endswith('.') and
            re.fullmatch(r'(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?', p, re.I) is None
            for p in path.split('/')) and
        (path in RELEASE17_EXISTING or path in RELEASE17_NEW or path.startswith(RELEASE17_PREFIXES)))


def validate17_checker(raw):
    before = git('show', RELEASE17_BASE+':scripts/release/full-app-j01/check.py')
    old = ast.parse(before); new = ast.parse(raw)
    funcs = lambda module: {n.name: ast.dump(n, include_attributes=False)
        for n in module.body if isinstance(n, ast.FunctionDef)}
    old_functions, new_functions = funcs(old), funcs(new)
    require(all(new_functions.get(k) == v for k, v in old_functions.items() if k != 'source_guard'),
            'R17_INHERITED_FUNCTION_CHANGED')
    expected = before.replace(b'    if release16_active():\n        source11_historical_segment()',
        b'    if release17_active():\n        source11_historical_segment()\n        source12_historical_segment()\n        source13_historical_segment()\n        source14_historical_segment()\n        source15_historical_segment()\n        source16_historical_segment()\n        source17_guard()\n    elif release16_active():\n        source11_historical_segment()')
    expected = expected.replace(b'or allowed16(path),', b'or allowed16(path) or allowed17(path),')
    require(new_functions.get('source_guard') == funcs(ast.parse(expected))['source_guard'],
            'R17_ORIGINAL_SOURCE_GUARD_CHANGED')
    assignments = lambda module: {ast.dump(n.targets[0]): ast.dump(n.value, include_attributes=False)
        for n in module.body if isinstance(n, ast.Assign) and len(n.targets) == 1}
    old_globals, new_globals = assignments(old), assignments(new)
    require(all(new_globals.get(k) == v for k, v in old_globals.items()), 'R17_INHERITED_GLOBAL_CHANGED')
    old_other = [ast.dump(n, include_attributes=False) for n in old.body
                 if not isinstance(n, (ast.Assign, ast.FunctionDef))]
    new_other = [ast.dump(n, include_attributes=False) for n in new.body
                 if not isinstance(n, (ast.Assign, ast.FunctionDef))]
    require(old_other == new_other, 'R17_INHERITED_MODULE_CHANGED')
    original_assignments = [ast.dump(n, include_attributes=False) for n in old.body if isinstance(n, ast.Assign)]
    inherited_assignments = [ast.dump(n, include_attributes=False) for n in new.body
        if isinstance(n, ast.Assign) and ast.dump(n.targets[0]) in old_globals]
    require(original_assignments == inherited_assignments, 'R17_INHERITED_ASSIGNMENT_ORDER')
    added = [n for n in new.body if isinstance(n, ast.Assign) and ast.dump(n.targets[0]) not in old_globals]
    require(all(len(n.targets) == 1 and isinstance(n.targets[0], ast.Name) and
                n.targets[0].id.startswith('RELEASE17_') for n in added), 'R17_NEW_GLOBAL_SCOPE')
    new_names = [n.name for n in new.body if isinstance(n, ast.FunctionDef)]
    require(len(new_names) == len(set(new_names)), 'R17_REDEFINED_SAFEGUARD')
    require(set(new_names)-set(old_functions) == {'allowed17', 'validate17_checker', 'candidate17_guard',
        'validate17_diff', 'source17_endpoint', 'source17_history', 'source16_historical_segment',
        'source17_guard', 'release17_active'}, 'R17_NEW_FUNCTION_SCOPE')
    for assignment in added:
        try: ast.literal_eval(assignment.value)
        except (ValueError, TypeError): require(False, 'R17_NEW_GLOBAL_SIDE_EFFECT')


def candidate17_guard(raw):
    value = json.loads(raw, object_pairs_hook=pairs)
    require(set(value) == {'schema', 'authority', 'status', 'base', 'tree', 'acceptanceGranted', 'admissions'} and
            type(value['schema']) is int and value['schema'] == 1 and value['authority'] == RELEASE17_AUTHORITY and
            value['status'] == 'SOURCE_ONLY_CANDIDATE' and value['base'] == RELEASE17_BASE and
            value['tree'] == RELEASE17_TREE and value['acceptanceGranted'] is False and
            value['admissions'] == dict(G97=False, DB=False, M103=False, M2=False, J01=False, PUBLIC=False),
            'R17_NO_ADMISSION')


def validate17_diff(raw, read_after):
    fields = raw.split(b'\0')
    require(fields[-1] == b'' and len(fields) % 2 == 1, 'R17_DIFF_SHAPE')
    names = set()
    for n in range(0, len(fields)-1, 2):
        metadata = fields[n].decode('ascii').split(); path = fields[n+1].decode('utf-8')
        require(len(metadata) == 5, 'R17_DIFF_META')
        oldmode, newmode, oldblob, newblob, status = metadata
        require(allowed17(path) and status in ('A', 'M'), 'R17_SCOPE:'+path)
        key = unicodedata.normalize('NFKC', path).casefold()
        require(key not in names, 'R17_COLLISION:'+path); names.add(key)
        require(oldmode in (':000000', ':100644') and newmode == '100644', 'R17_MODE:'+path)
        require((path in RELEASE17_EXISTING) == (oldmode == ':100644') and
                status == ('M' if oldmode == ':100644' else 'A') and
                all(re.fullmatch('[0-9a-f]{40}', x) for x in (oldblob, newblob)), 'R17_CREATE_EDIT:'+path)
        if oldmode == ':000000':
            require(oldblob == '0'*40 and subprocess.run(['git', 'cat-file', '-e', RELEASE17_BASE+':'+path],
                cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE).returncode != 0, 'R17_EXISTING_RECLASSIFIED')
        else:
            require(oldblob == git('rev-parse', RELEASE17_BASE+':'+path).decode().strip(), 'R17_BASE_BLOB')
        data = read_after(path)
        require(newblob == '0'*40 or hashlib.sha1(('blob '+str(len(data))+'\0').encode()+data).hexdigest()==newblob,
                'R17_AFTER_BLOB:'+path)
        if path == 'scripts/release/full-app-j01/check.py': validate17_checker(data)
        if path == 'docs/brain/contracts/M1X-17/candidate.json': candidate17_guard(data)
        if path == 'docs/USER_FLOW_TREE.md':
            before = git('show', RELEASE17_BASE+':'+path)
            require(data.startswith(before) and data[len(before):].count(b'## Campaign17:') == 1, 'R17_ADDITIVE_FLOW')


def source17_endpoint():
    head = git('rev-parse', 'HEAD').decode().strip()
    parents = git('rev-list', '--parents', '-n', '1', head).decode().split()
    if len(parents) == 2: return head
    require(len(parents) == 3 and parents[1] == RELEASE17_BASE, 'R17_CI_PARENTS')
    require(type(RELEASE17_PR) is int and RELEASE17_PR > 0 and
            os.environ.get('GITHUB_EVENT_NAME') == 'pull_request' and
            os.environ.get('GITHUB_REPOSITORY') == 'TasfiqJ/onSkin' and
            os.environ.get('GITHUB_REF') == 'refs/pull/'+str(RELEASE17_PR)+'/merge' and
            os.environ.get('GITHUB_SHA') == head, 'R17_CI_CONTEXT')
    event = json.loads(regular(Path(os.environ.get('GITHUB_EVENT_PATH', ''))), object_pairs_hook=pairs)
    pr = event.get('pull_request', {})
    require(event.get('number') == RELEASE17_PR and pr.get('number') == RELEASE17_PR and
            event.get('repository', {}).get('full_name') == 'TasfiqJ/onSkin' and
            pr.get('base', {}).get('sha') == RELEASE17_BASE and
            pr.get('base', {}).get('ref') == 'stage/m1-first-session-recovery16' and
            pr.get('head', {}).get('sha') == parents[2] and
            pr.get('head', {}).get('ref') == 'stage/m1-first-session-integrity17' and
            pr.get('head', {}).get('repo', {}).get('full_name') == 'TasfiqJ/onSkin' and
            pr.get('draft') is True and pr.get('maintainer_can_modify') is False and
            pr.get('auto_merge') is None, 'R17_CI_EVENT_IDENTITY')
    require(git('merge-base', RELEASE17_BASE, parents[2]).decode().strip() == RELEASE17_BASE, 'R17_CI_MERGE_BASE')
    require(git('rev-parse', head+'^{tree}') == git('rev-parse', parents[2]+'^{tree}'), 'R17_CI_MERGE_TREE')
    return parents[2]


def source17_history():
    require(git('rev-parse', RELEASE17_BASE+'^{tree}').decode().strip() == RELEASE17_TREE, 'R17_BASE_TREE')
    endpoint = source17_endpoint()
    subprocess.run(['git', 'merge-base', '--is-ancestor', RELEASE17_BASE, endpoint],
        cwd=ROOT, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    for commit in git('rev-list', '--reverse', RELEASE17_BASE+'..'+endpoint).decode().splitlines():
        require(len(git('rev-list', '--parents', '-n', '1', commit).decode().split()) == 2, 'R17_LINEAR_HISTORY')
        validate17_diff(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE17_BASE, commit),
                        lambda path: git('show', commit+':'+path))


def source16_historical_segment():
    actual_git = git
    def historical_git(*args):
        if args == ('rev-parse', 'HEAD'): return actual_git('rev-parse', RELEASE17_BASE)
        return actual_git(*args)
    globals()['git'] = historical_git
    try:
        source16_history()
        validate16_checker(actual_git('show', RELEASE17_BASE+':scripts/release/full-app-j01/check.py'))
    finally:
        globals()['git'] = actual_git


def source17_guard():
    source17_history()
    dependency13_guard(regular(ROOT/'package-lock.json'))
    dependency13_guard(git('show', ':package-lock.json'), lambda p: git('show', ':'+p), installed=False)
    validate17_diff(git('diff', '--cached', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE17_BASE),
                    lambda path: git('show', ':'+path))
    validate17_diff(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE17_BASE),
                    lambda path: regular(ROOT/path))
    names = set()
    for entry in git('ls-files', '-v', '-z').decode().split('\0'):
        if entry:
            require(entry.startswith('H '), 'R17_INDEX_FLAGS')
            key = unicodedata.normalize('NFKC', entry[2:]).casefold()
            require(key not in names, 'R17_COLLISION'); names.add(key)
    for path in git('ls-files', '--others', '--exclude-standard', '-z').decode().split('\0'):
        if path:
            require(allowed17(path) and path not in RELEASE17_EXISTING, 'R17_UNTRACKED_SCOPE:'+path)
            key = unicodedata.normalize('NFKC', path).casefold()
            require(key not in names, 'R17_COLLISION'); names.add(key); regular(ROOT/path)
    if os.environ.get('GITHUB_ACTIONS') == 'true' and __name__ == '__main__' and '--bundle-dir' not in sys.argv:
        result = subprocess.run([sys.executable, '-B', 'scripts/release/full-app-j01/source_consumer17.test.py'],
                                cwd=ROOT, capture_output=True, timeout=300)
        require(result.returncode == 0, 'R17_SOURCE_TESTS_FAILED')


def release17_active():
    return subprocess.run(['git', 'merge-base', '--is-ancestor', RELEASE17_BASE, 'HEAD'],
        cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE).returncode == 0


RELEASE18_BASE = 'f9709e02420d6c03cc9b9586cf60d89bfde7d8a3'
RELEASE18_TREE = 'c735b32c667059ba1d6855b6896c70e42d6c6fd8'
RELEASE18_PR = 22  # Allocated by GitHub; draft stacked only on immutable PR21.
RELEASE18_AUTHORITY = 'BRAIN-M1X-ONBOARDING-OWNER-PRIVACY18-REPAIR-01'
RELEASE18_EXISTING = {'apps/mobile/src/features/onboarding/quizNavigation.test.ts', 'apps/mobile/src/features/onboarding/OnboardingContext.tsx', 'apps/mobile/src/app/onboarding/quiz.tsx', 'apps/mobile/src/features/onboarding/onboardingPrivacy17.test.ts', 'scripts/release/full-app-j01/check.py', 'ONSKIN_BRAIN_HANDOFF.txt', 'apps/mobile/src/features/onboarding/productsDraft17.test.ts', 'apps/mobile/src/app/onboarding/goals.tsx', 'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md', 'apps/mobile/src/app/onboarding/reveal.tsx', 'docs/USER_FLOW_TREE.md', 'apps/mobile/src/app/onboarding/products.tsx', 'apps/mobile/src/features/onboarding/quizFocus17.test.ts', 'apps/mobile/src/app/onboarding/analyzing.tsx'}
RELEASE18_NEW = {'apps/mobile/src/features/onboarding/onboardingRoute18.test.tsx', 'scripts/release/full-app-j01/source_consumer18.test.py', 'apps/mobile/src/features/onboarding/onboardingRoute18.test.ts', 'apps/mobile/src/features/onboarding/onboardingOwner18.test.ts', 'scripts/m1/onboarding_owner_privacy18_browser.mjs', 'apps/mobile/src/features/onboarding/onboardingOwner18.test.tsx'}
RELEASE18_PREFIXES = ('docs/brain/contracts/M1X-18/', 'docs/brain/task-specs/M1X-18/',
    'docs/brain/checkpoints/M1-02/ONBOARDING-OWNER-PRIVACY-18/')


def allowed18(path):
    return (isinstance(path, str) and re.fullmatch(r'[A-Za-z0-9._/-]+', path) is not None and
        all(p and not p.startswith('.') and not p.endswith('.') and
            re.fullmatch(r'(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?', p, re.I) is None
            for p in path.split('/')) and
        (path in RELEASE18_EXISTING or path in RELEASE18_NEW or path.startswith(RELEASE18_PREFIXES)))


def validate18_checker(raw):
    before = git('show', RELEASE18_BASE+':scripts/release/full-app-j01/check.py')
    old = ast.parse(before); new = ast.parse(raw)
    funcs = lambda module: {n.name: ast.dump(n, include_attributes=False)
        for n in module.body if isinstance(n, ast.FunctionDef)}
    old_functions, new_functions = funcs(old), funcs(new)
    require(all(new_functions.get(k) == v for k, v in old_functions.items() if k != 'source_guard'),
            'R18_INHERITED_FUNCTION_CHANGED')
    expected = before.replace(b'    if release17_active():\n        source11_historical_segment()', b'    if release18_active():\n        source11_historical_segment()\n        source12_historical_segment()\n        source13_historical_segment()\n        source14_historical_segment()\n        source15_historical_segment()\n        source16_historical_segment()\n        source17_historical_segment()\n        source18_guard()\n    elif release17_active():\n        source11_historical_segment()')
    expected = expected.replace(b'or allowed17(path),', b'or allowed17(path) or allowed18(path),')
    require(new_functions.get('source_guard') == funcs(ast.parse(expected))['source_guard'],
            'R18_ORIGINAL_SOURCE_GUARD_CHANGED')
    assignments = lambda module: {ast.dump(n.targets[0]): ast.dump(n.value, include_attributes=False)
        for n in module.body if isinstance(n, ast.Assign) and len(n.targets) == 1}
    old_globals, new_globals = assignments(old), assignments(new)
    require(all(new_globals.get(k) == v for k, v in old_globals.items()), 'R18_INHERITED_GLOBAL_CHANGED')
    old_other = [ast.dump(n, include_attributes=False) for n in old.body
                 if not isinstance(n, (ast.Assign, ast.FunctionDef))]
    new_other = [ast.dump(n, include_attributes=False) for n in new.body
                 if not isinstance(n, (ast.Assign, ast.FunctionDef))]
    require(old_other == new_other, 'R18_INHERITED_MODULE_CHANGED')
    original_assignments = [ast.dump(n, include_attributes=False) for n in old.body if isinstance(n, ast.Assign)]
    inherited_assignments = [ast.dump(n, include_attributes=False) for n in new.body
        if isinstance(n, ast.Assign) and ast.dump(n.targets[0]) in old_globals]
    require(original_assignments == inherited_assignments, 'R18_INHERITED_ASSIGNMENT_ORDER')
    added = [n for n in new.body if isinstance(n, ast.Assign) and ast.dump(n.targets[0]) not in old_globals]
    require(all(len(n.targets) == 1 and isinstance(n.targets[0], ast.Name) and
                n.targets[0].id.startswith('RELEASE18_') for n in added), 'R18_NEW_GLOBAL_SCOPE')
    new_names = [n.name for n in new.body if isinstance(n, ast.FunctionDef)]
    require(len(new_names) == len(set(new_names)), 'R18_REDEFINED_SAFEGUARD')
    require(set(new_names)-set(old_functions) == {'allowed18', 'validate18_checker', 'candidate18_guard',
        'validate18_diff', 'source18_endpoint', 'source18_history', 'source17_historical_segment',
        'source18_guard', 'release18_active'}, 'R18_NEW_FUNCTION_SCOPE')
    for assignment in added:
        try: ast.literal_eval(assignment.value)
        except (ValueError, TypeError): require(False, 'R18_NEW_GLOBAL_SIDE_EFFECT')


def candidate18_guard(raw):
    value = json.loads(raw, object_pairs_hook=pairs)
    require(set(value) == {'schema', 'authority', 'status', 'base', 'tree', 'acceptanceGranted', 'admissions'} and
            type(value['schema']) is int and value['schema'] == 1 and value['authority'] == RELEASE18_AUTHORITY and
            value['status'] == 'SOURCE_ONLY_CANDIDATE' and value['base'] == RELEASE18_BASE and
            value['tree'] == RELEASE18_TREE and value['acceptanceGranted'] is False and
            value['admissions'] == dict(G97=False, DB=False, M103=False, M2=False, J01=False, PUBLIC=False),
            'R18_NO_ADMISSION')


def validate18_diff(raw, read_after):
    fields = raw.split(b'\0')
    require(fields[-1] == b'' and len(fields) % 2 == 1, 'R18_DIFF_SHAPE')
    names = set()
    for n in range(0, len(fields)-1, 2):
        metadata = fields[n].decode('ascii').split(); path = fields[n+1].decode('utf-8')
        require(len(metadata) == 5, 'R18_DIFF_META')
        oldmode, newmode, oldblob, newblob, status = metadata
        require(allowed18(path) and status in ('A', 'M'), 'R18_SCOPE:'+path)
        key = unicodedata.normalize('NFKC', path).casefold()
        require(key not in names, 'R18_COLLISION:'+path); names.add(key)
        require(oldmode in (':000000', ':100644') and newmode == '100644', 'R18_MODE:'+path)
        require((path in RELEASE18_EXISTING) == (oldmode == ':100644') and
                status == ('M' if oldmode == ':100644' else 'A') and
                all(re.fullmatch('[0-9a-f]{40}', x) for x in (oldblob, newblob)), 'R18_CREATE_EDIT:'+path)
        if oldmode == ':000000':
            require(oldblob == '0'*40 and subprocess.run(['git', 'cat-file', '-e', RELEASE18_BASE+':'+path],
                cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE).returncode != 0, 'R18_EXISTING_RECLASSIFIED')
        else:
            require(oldblob == git('rev-parse', RELEASE18_BASE+':'+path).decode().strip(), 'R18_BASE_BLOB')
        data = read_after(path)
        require(newblob == '0'*40 or hashlib.sha1(('blob '+str(len(data))+'\0').encode()+data).hexdigest()==newblob,
                'R18_AFTER_BLOB:'+path)
        if path == 'scripts/release/full-app-j01/check.py': validate18_checker(data)
        if path == 'docs/brain/contracts/M1X-18/candidate.json': candidate18_guard(data)
        if path == 'docs/USER_FLOW_TREE.md':
            before = git('show', RELEASE18_BASE+':'+path)
            require(data.startswith(before) and data[len(before):].count(b'## Campaign18') == 1, 'R18_ADDITIVE_FLOW')


def source18_endpoint():
    head = git('rev-parse', 'HEAD').decode().strip()
    parents = git('rev-list', '--parents', '-n', '1', head).decode().split()
    if len(parents) == 2: return head
    require(len(parents) == 3 and parents[1] == RELEASE18_BASE, 'R18_CI_PARENTS')
    require(type(RELEASE18_PR) is int and RELEASE18_PR > 0 and
            os.environ.get('GITHUB_EVENT_NAME') == 'pull_request' and
            os.environ.get('GITHUB_REPOSITORY') == 'TasfiqJ/onSkin' and
            os.environ.get('GITHUB_REF') == 'refs/pull/'+str(RELEASE18_PR)+'/merge' and
            os.environ.get('GITHUB_SHA') == head, 'R18_CI_CONTEXT')
    event = json.loads(regular(Path(os.environ.get('GITHUB_EVENT_PATH', ''))), object_pairs_hook=pairs)
    pr = event.get('pull_request', {})
    require(event.get('number') == RELEASE18_PR and pr.get('number') == RELEASE18_PR and
            event.get('repository', {}).get('full_name') == 'TasfiqJ/onSkin' and
            pr.get('base', {}).get('sha') == RELEASE18_BASE and
            pr.get('base', {}).get('ref') == 'stage/m1-first-session-integrity17' and
            pr.get('head', {}).get('sha') == parents[2] and
            pr.get('head', {}).get('ref') == 'stage/m1-onboarding-owner-privacy18' and
            pr.get('head', {}).get('repo', {}).get('full_name') == 'TasfiqJ/onSkin' and
            pr.get('draft') is True and pr.get('maintainer_can_modify') is False and
            pr.get('auto_merge') is None, 'R18_CI_EVENT_IDENTITY')
    require(git('merge-base', RELEASE18_BASE, parents[2]).decode().strip() == RELEASE18_BASE, 'R18_CI_MERGE_BASE')
    require(git('rev-parse', head+'^{tree}') == git('rev-parse', parents[2]+'^{tree}'), 'R18_CI_MERGE_TREE')
    return parents[2]


def source18_history():
    require(git('rev-parse', RELEASE18_BASE+'^{tree}').decode().strip() == RELEASE18_TREE, 'R18_BASE_TREE')
    endpoint = source18_endpoint()
    subprocess.run(['git', 'merge-base', '--is-ancestor', RELEASE18_BASE, endpoint],
        cwd=ROOT, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    for commit in git('rev-list', '--reverse', RELEASE18_BASE+'..'+endpoint).decode().splitlines():
        require(len(git('rev-list', '--parents', '-n', '1', commit).decode().split()) == 2, 'R18_LINEAR_HISTORY')
        validate18_diff(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE18_BASE, commit),
                        lambda path: git('show', commit+':'+path))


def source17_historical_segment():
    actual_git = git
    def historical_git(*args):
        if args == ('rev-parse', 'HEAD'): return actual_git('rev-parse', RELEASE18_BASE)
        return actual_git(*args)
    globals()['git'] = historical_git
    try:
        source17_history()
        validate17_checker(actual_git('show', RELEASE18_BASE+':scripts/release/full-app-j01/check.py'))
    finally:
        globals()['git'] = actual_git


def source18_guard():
    source18_history()
    dependency13_guard(regular(ROOT/'package-lock.json'))
    dependency13_guard(git('show', ':package-lock.json'), lambda p: git('show', ':'+p), installed=False)
    validate18_diff(git('diff', '--cached', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE18_BASE),
                    lambda path: git('show', ':'+path))
    validate18_diff(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE18_BASE),
                    lambda path: regular(ROOT/path))
    names = set()
    for entry in git('ls-files', '-v', '-z').decode().split('\0'):
        if entry:
            require(entry.startswith('H '), 'R18_INDEX_FLAGS')
            key = unicodedata.normalize('NFKC', entry[2:]).casefold()
            require(key not in names, 'R18_COLLISION'); names.add(key)
    for path in git('ls-files', '--others', '--exclude-standard', '-z').decode().split('\0'):
        if path:
            require(allowed18(path) and path not in RELEASE18_EXISTING, 'R18_UNTRACKED_SCOPE:'+path)
            key = unicodedata.normalize('NFKC', path).casefold()
            require(key not in names, 'R18_COLLISION'); names.add(key); regular(ROOT/path)
    if os.environ.get('GITHUB_ACTIONS') == 'true' and __name__ == '__main__' and '--bundle-dir' not in sys.argv:
        result = subprocess.run([sys.executable, '-B', 'scripts/release/full-app-j01/source_consumer18.test.py'],
                                cwd=ROOT, capture_output=True, timeout=300)
        require(result.returncode == 0, 'R18_SOURCE_TESTS_FAILED')


def release18_active():
    return subprocess.run(['git', 'merge-base', '--is-ancestor', RELEASE18_BASE, 'HEAD'],
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
    if release18_active():
        source11_historical_segment()
        source12_historical_segment()
        source13_historical_segment()
        source14_historical_segment()
        source15_historical_segment()
        source16_historical_segment()
        source17_historical_segment()
        source18_guard()
    elif release17_active():
        source11_historical_segment()
        source12_historical_segment()
        source13_historical_segment()
        source14_historical_segment()
        source15_historical_segment()
        source16_historical_segment()
        source17_guard()
    elif release16_active():
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
        require(allowed_path(path) or allowed09(path) or allowed10(path) or allowed11(path) or allowed12(path) or allowed13(path) or allowed14(path) or allowed15(path) or allowed16(path) or allowed17(path) or allowed18(path), 'WORKING_SCOPE:'+path)
    for path in git('ls-files', '--others', '--exclude-standard').decode().splitlines():
        require(allowed_path(path) or allowed09(path) or allowed10(path) or allowed11(path) or allowed12(path) or allowed13(path) or allowed14(path) or allowed15(path) or allowed16(path) or allowed17(path) or allowed18(path), 'UNTRACKED_SCOPE:'+path)
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



# Release19 successor. Inherited Release08-18 definitions above are immutable.
RELEASE19_BASE = '149d18f3ae3c49f966a9e2b1a679901d1d15b3b6'
RELEASE19_TREE = '061b8e8565f21e871fb1d57bed1316cc1a76e5d6'
RELEASE19_PR = 23
RELEASE19_AUTHORITY = 'BRAIN-M1X-ONBOARDING-COMPATIBILITY19-REPAIR-01'
RELEASE19_EXISTING = {
    'apps/mobile/src/features/onboarding/OnboardingContext.tsx',
    'apps/mobile/src/app/onboarding/goals.tsx', 'apps/mobile/src/app/onboarding/quiz.tsx',
    'apps/mobile/src/app/onboarding/products.tsx', 'apps/mobile/src/app/onboarding/analyzing.tsx',
    'apps/mobile/src/app/onboarding/reveal.tsx',
    'apps/mobile/src/features/onboarding/productsFooter16.test.ts',
    'apps/mobile/src/features/onboarding/quizNavigation16.test.ts',
    'apps/mobile/src/features/onboarding/onboardingRoutes.test.ts',
    'apps/mobile/src/features/shelf/coreJourney.campaign06.test.ts',
    'apps/mobile/src/features/onboarding/OnboardingContext.test.ts',
    'apps/mobile/src/features/healthConsent/healthLifecycleRoutes.test.ts',
    'apps/mobile/src/features/onboarding/onboardingOwner18.test.ts',
    'apps/mobile/src/features/onboarding/onboardingRoute18.test.ts',
    'apps/mobile/src/features/onboarding/onboardingPrivacy17.test.ts',
    'apps/mobile/src/features/onboarding/quizFocus17.test.ts',
    'apps/mobile/src/features/onboarding/productsDraft17.test.ts',
    'docs/USER_FLOW_TREE.md', 'scripts/release/full-app-j01/check.py',
    'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md',
    'ONSKIN_BRAIN_HANDOFF.txt'}
RELEASE19_NEW = {'apps/mobile/src/features/onboarding/onboardingCompatibility19.test.ts',
    'apps/mobile/src/features/onboarding/onboardingConsent19.test.ts',
    'scripts/m1/onboarding_compatibility19_browser.mjs',
    'scripts/release/full-app-j01/source_consumer19.test.py'}
RELEASE19_PREFIXES = ('docs/brain/contracts/M1X-19/', 'docs/brain/task-specs/M1X-19/',
    'docs/brain/checkpoints/M1-02/ONBOARDING-COMPATIBILITY-19/')
RELEASE19_INHERITED_SOURCE_GUARD = source_guard


def allowed19(path):
    return (isinstance(path, str) and re.fullmatch(r'[A-Za-z0-9._/-]+', path) is not None and
        all(p and not p.startswith('.') and not p.endswith('.') and
            re.fullmatch(r'(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?', p, re.I) is None
            for p in path.split('/')) and
        (path in RELEASE19_EXISTING or path in RELEASE19_NEW or path.startswith(RELEASE19_PREFIXES)))


def validate19_checker(raw):
    before = git('show', RELEASE19_BASE+':scripts/release/full-app-j01/check.py')
    tail = b"if __name__ == '__main__':\n    sys.exit(main())\n"
    require(before.endswith(tail) and raw.startswith(before[:-len(tail)]) and raw.endswith(tail),
            'R19_INHERITED_BYTES_CHANGED')
    old = ast.parse(before); new = ast.parse(raw)
    inherited = {n.name: ast.dump(n, include_attributes=False) for n in old.body if isinstance(n, ast.FunctionDef)}
    require(all(any(isinstance(n, ast.FunctionDef) and n.name == name and
            ast.dump(n, include_attributes=False) == value for n in new.body)
            for name, value in inherited.items()), 'R19_INHERITED_AST_CHANGED')
    extension = ast.parse(raw[len(before)-len(tail):-len(tail)])
    functions = {'allowed19', 'validate19_checker', 'candidate19_guard', 'validate19_diff',
        'source19_endpoint', 'source19_history', 'source18_historical_guard', 'source19_guard'}
    require({n.name for n in extension.body if isinstance(n, ast.FunctionDef)} == functions and
            len([n for n in extension.body if isinstance(n, ast.FunctionDef)]) == len(functions), 'R19_FUNCTION_SCOPE')
    for node in extension.body:
        if isinstance(node, ast.FunctionDef): continue
        require(isinstance(node, ast.Assign) and len(node.targets) == 1 and
                isinstance(node.targets[0], ast.Name), 'R19_MODULE_SCOPE')
        name = node.targets[0].id
        if name == 'source_guard':
            require(isinstance(node.value, ast.Name) and node.value.id == 'source19_guard', 'R19_DISPATCH')
        elif name == 'RELEASE19_INHERITED_SOURCE_GUARD':
            require(isinstance(node.value, ast.Name) and node.value.id == 'source_guard', 'R19_INHERITED_DISPATCH')
        else:
            require(name.startswith('RELEASE19_'), 'R19_GLOBAL_SCOPE')
            try: ast.literal_eval(node.value)
            except (ValueError, TypeError): require(False, 'R19_GLOBAL_SIDE_EFFECT')


def candidate19_guard(raw):
    value = json.loads(raw, object_pairs_hook=pairs)
    require(set(value) == {'schema', 'authority', 'status', 'base', 'tree', 'acceptanceGranted', 'admissions'} and
        type(value['schema']) is int and value['schema'] == 1 and value['authority'] == RELEASE19_AUTHORITY and
        value['base'] == RELEASE19_BASE and value['tree'] == RELEASE19_TREE and
        value['status'] == 'SOURCE_ONLY_CANDIDATE' and value['acceptanceGranted'] is False and
        value['admissions'] == dict(G97=False, DB=False, M103=False, M2=False, J01=False, PUBLIC=False), 'R19_NO_ADMISSION')


def validate19_diff(raw, read_after):
    fields = raw.split(b'\0')
    require(fields[-1] == b'' and len(fields) % 2 == 1, 'R19_DIFF_SHAPE')
    names = set()
    for n in range(0, len(fields)-1, 2):
        meta = fields[n].decode('ascii').split(); path = fields[n+1].decode('utf-8')
        require(len(meta) == 5, 'R19_DIFF_META')
        oldmode, newmode, oldblob, newblob, status = meta
        require(allowed19(path) and status in ('A', 'M'), 'R19_SCOPE:'+path)
        key = unicodedata.normalize('NFKC', path).casefold()
        require(key not in names, 'R19_COLLISION'); names.add(key)
        require(oldmode in (':000000', ':100644') and newmode == '100644', 'R19_MODE')
        require((path in RELEASE19_EXISTING) == (oldmode == ':100644') and
            status == ('M' if oldmode == ':100644' else 'A') and
            all(re.fullmatch('[0-9a-f]{40}', x) for x in (oldblob, newblob)), 'R19_CREATE_EDIT')
        if oldmode == ':100644':
            require(oldblob == git('rev-parse', RELEASE19_BASE+':'+path).decode().strip(), 'R19_BASE_BLOB')
        else:
            require(oldblob == '0'*40 and subprocess.run(['git', 'cat-file', '-e', RELEASE19_BASE+':'+path],
                cwd=ROOT, capture_output=True).returncode != 0, 'R19_EXISTING_RECLASSIFIED')
        data = read_after(path)
        require(newblob == '0'*40 or hashlib.sha1(('blob '+str(len(data))+'\0').encode()+data).hexdigest() == newblob,
            'R19_AFTER_BLOB')
        if path == 'scripts/release/full-app-j01/check.py': validate19_checker(data)
        if path == 'docs/brain/contracts/M1X-19/candidate.json': candidate19_guard(data)
        if path == 'docs/USER_FLOW_TREE.md':
            before = git('show', RELEASE19_BASE+':'+path)
            require(data.startswith(before) and data[len(before):].count(b'## Campaign19') == 1, 'R19_ADDITIVE_FLOW')


def source19_endpoint():
    head = git('rev-parse', 'HEAD').decode().strip()
    parents = git('rev-list', '--parents', '-n', '1', head).decode().split()
    if len(parents) == 2: return head
    require(len(parents) == 3 and parents[1] == RELEASE19_BASE, 'R19_CI_PARENTS')
    require(type(RELEASE19_PR) is int and RELEASE19_PR > 0 and
        os.environ.get('GITHUB_EVENT_NAME') == 'pull_request' and os.environ.get('GITHUB_REPOSITORY') == 'TasfiqJ/onSkin' and
        os.environ.get('GITHUB_REF') == 'refs/pull/'+str(RELEASE19_PR)+'/merge' and os.environ.get('GITHUB_SHA') == head, 'R19_CI_CONTEXT')
    event = json.loads(regular(Path(os.environ.get('GITHUB_EVENT_PATH', ''))), object_pairs_hook=pairs)
    pr = event.get('pull_request', {})
    require(event.get('number') == RELEASE19_PR and pr.get('number') == RELEASE19_PR and
        event.get('repository', {}).get('full_name') == 'TasfiqJ/onSkin' and
        pr.get('base', {}).get('sha') == RELEASE19_BASE and pr.get('base', {}).get('ref') == 'stage/m1-onboarding-owner-privacy18' and
        pr.get('head', {}).get('sha') == parents[2] and pr.get('head', {}).get('ref') == 'stage/m1-onboarding-compatibility19' and
        pr.get('head', {}).get('repo', {}).get('full_name') == 'TasfiqJ/onSkin' and pr.get('draft') is True and
        pr.get('maintainer_can_modify') is False and pr.get('auto_merge') is None, 'R19_CI_EVENT')
    require(git('rev-parse', head+'^{tree}') == git('rev-parse', parents[2]+'^{tree}'), 'R19_CI_TREE')
    return parents[2]


def source19_history():
    require(git('rev-parse', RELEASE19_BASE+'^{tree}').decode().strip() == RELEASE19_TREE, 'R19_BASE_TREE')
    endpoint = source19_endpoint()
    subprocess.run(['git', 'merge-base', '--is-ancestor', RELEASE19_BASE, endpoint], cwd=ROOT, check=True, capture_output=True)
    for commit in git('rev-list', '--reverse', RELEASE19_BASE+'..'+endpoint).decode().splitlines():
        require(len(git('rev-list', '--parents', '-n', '1', commit).decode().split()) == 2, 'R19_LINEAR_HISTORY')
        validate19_diff(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE19_BASE, commit),
            lambda path: git('show', commit+':'+path))


def source18_historical_guard():
    # Evaluate every inherited guard against actual immutable PR22 Git bytes.
    # Current source is checked separately and strictly by source19_guard.
    actual_git, actual_regular, actual_name = git, regular, __name__
    def historical_git(*args):
        if args == ('rev-parse', 'HEAD'): return actual_git('rev-parse', RELEASE19_BASE)
        if args[0] == 'diff' and len([a for a in args[1:] if not a.startswith('-')]) == 1:
            return actual_git(*[a for a in args if a != '--cached'], RELEASE19_BASE)
        if args[0] == 'show' and args[1].startswith(':'): return actual_git('show', RELEASE19_BASE+args[1])
        if args[0] == 'ls-files':
            if '--others' in args: return b''
            if '-v' in args:
                return b''.join(b'H '+p+b'\0' for p in actual_git('ls-tree', '-r', '--name-only', '-z', RELEASE19_BASE).split(b'\0') if p)
        return actual_git(*args)
    def historical_regular(path):
        try: name = Path(path).absolute().relative_to(ROOT.absolute()).as_posix()
        except ValueError: return actual_regular(path)
        found = subprocess.run(['git', 'cat-file', '-e', RELEASE19_BASE+':'+name], cwd=ROOT, capture_output=True)
        return actual_git('show', RELEASE19_BASE+':'+name) if found.returncode == 0 else actual_regular(path)
    globals()['git'], globals()['regular'], globals()['__name__'] = historical_git, historical_regular, 'release18_historical'
    try: return RELEASE19_INHERITED_SOURCE_GUARD()
    finally: globals()['git'], globals()['regular'], globals()['__name__'] = actual_git, actual_regular, actual_name


def source19_guard():
    source19_history()
    dependency13_guard(regular(ROOT/'package-lock.json'))
    dependency13_guard(git('show', ':package-lock.json'), lambda p: git('show', ':'+p), installed=False)
    validate19_diff(git('diff', '--cached', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE19_BASE), lambda p: git('show', ':'+p))
    validate19_diff(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE19_BASE), lambda p: regular(ROOT/p))
    names = set()
    for entry in git('ls-files', '-v', '-z').decode().split('\0'):
        if entry:
            require(entry.startswith('H '), 'R19_INDEX_FLAGS')
            key = unicodedata.normalize('NFKC', entry[2:]).casefold()
            require(key not in names, 'R19_COLLISION'); names.add(key)
    for path in git('ls-files', '--others', '--exclude-standard', '-z').decode().split('\0'):
        if path:
            require(allowed19(path) and path not in RELEASE19_EXISTING, 'R19_UNTRACKED_SCOPE:'+path)
            key = unicodedata.normalize('NFKC', path).casefold()
            require(key not in names, 'R19_COLLISION'); names.add(key); regular(ROOT/path)
    # Original consumer18 runs separately against its unchanged immutable checker.
    # The successor consumer exercises the current finite scope without rewriting old negatives.
    if os.environ.get('GITHUB_ACTIONS') == 'true' and __name__ == '__main__' and '--bundle-dir' not in sys.argv:
        result = subprocess.run([sys.executable, '-B', 'scripts/release/full-app-j01/source_consumer19.test.py'], cwd=ROOT, capture_output=True, timeout=300)
        require(result.returncode == 0, 'R19_SOURCE_TESTS_FAILED: ' +
            result.stdout.decode('utf-8', errors='replace')[-4000:] +
            result.stderr.decode('utf-8', errors='replace')[-4000:])
    return source18_historical_guard()


source_guard = source19_guard


# Release20 successor. Inherited Release08-19 definitions above are immutable.
RELEASE20_BASE = '9b3b1781ad65b10ae6b3ade7c1a87a03a64374e4'
RELEASE20_TREE = '961d24a7427667aab610939f3a4d088db0a90430'
RELEASE20_PR = 24
RELEASE20_AUTHORITY = 'BRAIN-M1X-F09-MANUAL-PHOTO-COMPARE20-CANDIDATE-01'
RELEASE20_EXISTING = {'ONSKIN_BRAIN_HANDOFF.txt', 'apps/mobile/src/features/photos/CompareSlider.tsx', 'apps/mobile/src/features/photos/compareAccessibility.ts', 'apps/mobile/src/features/photos/timeline.test.ts', 'apps/mobile/src/app/(tabs)/progress.tsx', 'docs/USER_FLOW_TREE.md', 'docs/phase-4/generated/source-worklist.md', 'apps/mobile/src/features/photos/progressRoutes.test.ts', 'scripts/release/full-app-j01/check.py', 'apps/mobile/src/features/photos/progressImageDemand.test.ts', 'apps/mobile/src/features/photos/compareAccessibility.test.ts', 'docs/phase-4/generated/source-worklist.json', 'apps/mobile/src/features/photos/copy.ts', 'apps/mobile/src/features/photos/timeline.ts'}
RELEASE20_NEW = {'apps/mobile/src/features/photos/manualCompare20.test.ts', 'scripts/m1/f09_manual_compare20_browser.mjs', 'apps/mobile/src/features/photos/manualCompare20.ts', 'apps/mobile/src/features/photos/manualCompare20Route.test.ts', 'scripts/release/full-app-j01/source_consumer20.test.py'}
RELEASE20_PREFIXES = ('docs/brain/contracts/M1X-20/', 'docs/brain/task-specs/M1X-20/',
    'docs/brain/checkpoints/M1-02/F09-MANUAL-COMPARE-20/')
RELEASE20_INHERITED_SOURCE_GUARD = source_guard


def allowed20(path):
    return (isinstance(path, str) and re.fullmatch(r'[A-Za-z0-9._/()-]+', path) is not None and
        all(p and not p.startswith('.') and not p.endswith('.') and
            re.fullmatch(r'(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?', p, re.I) is None
            for p in path.split('/')) and
        (path in RELEASE20_EXISTING or path in RELEASE20_NEW or path.startswith(RELEASE20_PREFIXES)))


def validate20_checker(raw):
    before = git('show', RELEASE20_BASE+':scripts/release/full-app-j01/check.py')
    tail = b"if __name__ == '__main__':\n    sys.exit(main())\n"
    require(before.endswith(tail) and raw.startswith(before[:-len(tail)]) and raw.endswith(tail),
            'R20_INHERITED_BYTES_CHANGED')
    old = ast.parse(before); new = ast.parse(raw)
    inherited = {n.name: ast.dump(n, include_attributes=False) for n in old.body if isinstance(n, ast.FunctionDef)}
    require(all(any(isinstance(n, ast.FunctionDef) and n.name == name and
            ast.dump(n, include_attributes=False) == value for n in new.body)
            for name, value in inherited.items()), 'R20_INHERITED_AST_CHANGED')
    extension = ast.parse(raw[len(before)-len(tail):-len(tail)])
    functions = {'allowed20', 'validate20_checker', 'candidate20_guard', 'validate20_diff',
        'source20_endpoint', 'source20_history', 'source19_historical_guard', 'source20_guard'}
    require({n.name for n in extension.body if isinstance(n, ast.FunctionDef)} == functions and
            len([n for n in extension.body if isinstance(n, ast.FunctionDef)]) == len(functions), 'R20_FUNCTION_SCOPE')
    for node in extension.body:
        if isinstance(node, ast.FunctionDef): continue
        require(isinstance(node, ast.Assign) and len(node.targets) == 1 and
                isinstance(node.targets[0], ast.Name), 'R20_MODULE_SCOPE')
        name = node.targets[0].id
        if name == 'source_guard':
            require(isinstance(node.value, ast.Name) and node.value.id == 'source20_guard', 'R20_DISPATCH')
        elif name == 'RELEASE20_INHERITED_SOURCE_GUARD':
            require(isinstance(node.value, ast.Name) and node.value.id == 'source_guard', 'R20_INHERITED_DISPATCH')
        else:
            require(name.startswith('RELEASE20_'), 'R20_GLOBAL_SCOPE')
            try: ast.literal_eval(node.value)
            except (ValueError, TypeError): require(False, 'R20_GLOBAL_SIDE_EFFECT')


def candidate20_guard(raw):
    value = json.loads(raw, object_pairs_hook=pairs)
    require(set(value) == {'schema', 'authority', 'status', 'base', 'tree', 'acceptanceGranted', 'admissions'} and
        type(value['schema']) is int and value['schema'] == 1 and value['authority'] == RELEASE20_AUTHORITY and
        value['base'] == RELEASE20_BASE and value['tree'] == RELEASE20_TREE and
        value['status'] == 'SOURCE_ONLY_CANDIDATE' and value['acceptanceGranted'] is False and
        value['admissions'] == dict(G97=False, DB=False, M103=False, M2=False, J01=False, PUBLIC=False), 'R20_NO_ADMISSION')


def validate20_diff(raw, read_after):
    fields = raw.split(b'\0')
    require(fields[-1] == b'' and len(fields) % 2 == 1, 'R20_DIFF_SHAPE')
    names = set()
    for n in range(0, len(fields)-1, 2):
        meta = fields[n].decode('ascii').split(); path = fields[n+1].decode('utf-8')
        require(len(meta) == 5, 'R20_DIFF_META')
        oldmode, newmode, oldblob, newblob, status = meta
        require(allowed20(path) and status in ('A', 'M'), 'R20_SCOPE:'+path)
        key = unicodedata.normalize('NFKC', path).casefold()
        require(key not in names, 'R20_COLLISION'); names.add(key)
        require(oldmode in (':000000', ':100644') and newmode == '100644', 'R20_MODE')
        require((path in RELEASE20_EXISTING) == (oldmode == ':100644') and
            status == ('M' if oldmode == ':100644' else 'A') and
            all(re.fullmatch('[0-9a-f]{40}', x) for x in (oldblob, newblob)), 'R20_CREATE_EDIT')
        if oldmode == ':100644':
            require(oldblob == git('rev-parse', RELEASE20_BASE+':'+path).decode().strip(), 'R20_BASE_BLOB')
        else:
            require(oldblob == '0'*40 and subprocess.run(['git', 'cat-file', '-e', RELEASE20_BASE+':'+path],
                cwd=ROOT, capture_output=True).returncode != 0, 'R20_EXISTING_RECLASSIFIED')
        data = read_after(path)
        require(newblob == '0'*40 or hashlib.sha1(('blob '+str(len(data))+'\0').encode()+data).hexdigest() == newblob,
            'R20_AFTER_BLOB')
        if path == 'scripts/release/full-app-j01/check.py': validate20_checker(data)
        if path == 'docs/brain/contracts/M1X-20/candidate.json': candidate20_guard(data)
        if path == 'docs/USER_FLOW_TREE.md':
            before = git('show', RELEASE20_BASE+':'+path)
            require(data.startswith(before) and data[len(before):].count(b'## Campaign20') == 1, 'R20_ADDITIVE_FLOW')


def source20_endpoint():
    head = git('rev-parse', 'HEAD').decode().strip()
    parents = git('rev-list', '--parents', '-n', '1', head).decode().split()
    if len(parents) == 2: return head
    require(len(parents) == 3 and parents[1] == RELEASE20_BASE, 'R20_CI_PARENTS')
    require(type(RELEASE20_PR) is int and RELEASE20_PR > 0 and
        os.environ.get('GITHUB_EVENT_NAME') == 'pull_request' and os.environ.get('GITHUB_REPOSITORY') == 'TasfiqJ/onSkin' and
        os.environ.get('GITHUB_REF') == 'refs/pull/'+str(RELEASE20_PR)+'/merge' and os.environ.get('GITHUB_SHA') == head, 'R20_CI_CONTEXT')
    event = json.loads(regular(Path(os.environ.get('GITHUB_EVENT_PATH', ''))), object_pairs_hook=pairs)
    pr = event.get('pull_request', {})
    require(event.get('number') == RELEASE20_PR and pr.get('number') == RELEASE20_PR and
        event.get('repository', {}).get('full_name') == 'TasfiqJ/onSkin' and
        pr.get('base', {}).get('sha') == RELEASE20_BASE and pr.get('base', {}).get('ref') == 'stage/m1-onboarding-compatibility19' and
        pr.get('head', {}).get('sha') == parents[2] and pr.get('head', {}).get('ref') == 'stage/m1-f09-manual-photo-compare20' and
        pr.get('head', {}).get('repo', {}).get('full_name') == 'TasfiqJ/onSkin' and pr.get('draft') is True and
        pr.get('maintainer_can_modify') is False and pr.get('auto_merge') is None, 'R20_CI_EVENT')
    require(git('rev-parse', head+'^{tree}') == git('rev-parse', parents[2]+'^{tree}'), 'R20_CI_TREE')
    return parents[2]


def source20_history():
    require(git('rev-parse', RELEASE20_BASE+'^{tree}').decode().strip() == RELEASE20_TREE, 'R20_BASE_TREE')
    endpoint = source20_endpoint()
    subprocess.run(['git', 'merge-base', '--is-ancestor', RELEASE20_BASE, endpoint], cwd=ROOT, check=True, capture_output=True)
    for commit in git('rev-list', '--reverse', RELEASE20_BASE+'..'+endpoint).decode().splitlines():
        require(len(git('rev-list', '--parents', '-n', '1', commit).decode().split()) == 2, 'R20_LINEAR_HISTORY')
        validate20_diff(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE20_BASE, commit),
            lambda path: git('show', commit+':'+path))


def source19_historical_guard():
    # Evaluate every inherited guard against actual immutable PR23 Git bytes.
    # Current source is checked separately and strictly by source20_guard.
    actual_git, actual_regular, actual_name = git, regular, __name__
    def historical_git(*args):
        if args == ('rev-parse', 'HEAD'): return actual_git('rev-parse', RELEASE20_BASE)
        if args[0] == 'diff' and len([a for a in args[1:] if not a.startswith('-')]) == 1:
            return actual_git(*[a for a in args if a != '--cached'], RELEASE20_BASE)
        if args[0] == 'show' and args[1].startswith(':'): return actual_git('show', RELEASE20_BASE+args[1])
        if args[0] == 'ls-files':
            if '--others' in args: return b''
            if '-v' in args:
                return b''.join(b'H '+p+b'\0' for p in actual_git('ls-tree', '-r', '--name-only', '-z', RELEASE20_BASE).split(b'\0') if p)
        return actual_git(*args)
    def historical_regular(path):
        try: name = Path(path).absolute().relative_to(ROOT.absolute()).as_posix()
        except ValueError: return actual_regular(path)
        found = subprocess.run(['git', 'cat-file', '-e', RELEASE20_BASE+':'+name], cwd=ROOT, capture_output=True)
        return actual_git('show', RELEASE20_BASE+':'+name) if found.returncode == 0 else actual_regular(path)
    globals()['git'], globals()['regular'], globals()['__name__'] = historical_git, historical_regular, 'release19_historical'
    try: return RELEASE20_INHERITED_SOURCE_GUARD()
    finally: globals()['git'], globals()['regular'], globals()['__name__'] = actual_git, actual_regular, actual_name


def source20_guard():
    source20_history()
    candidate20_guard(regular(ROOT/'docs/brain/contracts/M1X-20/candidate.json'))
    candidate20_guard(git('show', ':docs/brain/contracts/M1X-20/candidate.json'))
    dependency13_guard(regular(ROOT/'package-lock.json'))
    dependency13_guard(git('show', ':package-lock.json'), lambda p: git('show', ':'+p), installed=False)
    validate20_diff(git('diff', '--cached', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE20_BASE), lambda p: git('show', ':'+p))
    validate20_diff(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE20_BASE), lambda p: regular(ROOT/p))
    names = set()
    for entry in git('ls-files', '-v', '-z').decode().split('\0'):
        if entry:
            require(entry.startswith('H '), 'R20_INDEX_FLAGS')
            key = unicodedata.normalize('NFKC', entry[2:]).casefold()
            require(key not in names, 'R20_COLLISION'); names.add(key)
    for path in git('ls-files', '--others', '--exclude-standard', '-z').decode().split('\0'):
        if path:
            require(allowed20(path) and path not in RELEASE20_EXISTING, 'R20_UNTRACKED_SCOPE:'+path)
            key = unicodedata.normalize('NFKC', path).casefold()
            require(key not in names, 'R20_COLLISION'); names.add(key); regular(ROOT/path)
    # Original Release08-19 consumers run separately against their immutable checkers.
    # The successor consumer exercises the current finite scope without rewriting old negatives.
    if os.environ.get('GITHUB_ACTIONS') == 'true' and __name__ == '__main__' and '--bundle-dir' not in sys.argv:
        result = subprocess.run([sys.executable, '-B', 'scripts/release/full-app-j01/source_consumer20.test.py'], cwd=ROOT, capture_output=True, timeout=300)
        require(result.returncode == 0, 'R20_SOURCE_TESTS_FAILED: ' +
            result.stdout.decode('utf-8', errors='replace')[-4000:] +
            result.stderr.decode('utf-8', errors='replace')[-4000:])
    return source19_historical_guard()


source_guard = source20_guard


# Release21 successor. Inherited Release08-20 definitions above are immutable.
RELEASE21_BASE = '3c8cb787f3770df09f0ae4507bca9ac49fb5a079'
RELEASE21_TREE = '1ae09829967d455d98b5f5f93558927890d2d8e9'
RELEASE21_PR = 25  # Bind only the GitHub-allocated draft number.
RELEASE21_AUTHORITY = 'BRAIN-M1X-F09-LAYOUT-COMPATIBILITY21-REPAIR-01'
RELEASE21_EXISTING = {
    'apps/mobile/src/features/photos/progressEmptyLayout.c08b2.test.ts',
    'apps/mobile/src/features/photos/manualCompare20Route.test.ts',
    'apps/mobile/src/features/photos/manualCompare20.test.ts',
    'apps/mobile/src/features/photos/progressRoutes.test.ts',
    'apps/mobile/src/app/(tabs)/progress.tsx',
    'apps/mobile/src/features/photos/CompareSlider.tsx',
    'docs/USER_FLOW_TREE.md', 'scripts/release/full-app-j01/check.py',
    'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md',
    'ONSKIN_BRAIN_HANDOFF.txt',
}
RELEASE21_NEW = {
    'apps/mobile/src/features/photos/progressLayoutAuthority21.test.ts',
    'scripts/m1/f09_layout_compatibility21_browser.mjs',
    'scripts/release/full-app-j01/source_consumer21.test.py',
}
RELEASE21_PREFIXES = ('docs/brain/contracts/M1X-21/', 'docs/brain/task-specs/M1X-21/',
    'docs/brain/checkpoints/M1-02/F09-LAYOUT-COMPATIBILITY-21/')
RELEASE21_CHECKPOINT = 'docs/brain/checkpoints/M1-02/F09-LAYOUT-COMPATIBILITY-21/'
RELEASE21_RUNTIME = {'apps/mobile/src/app/(tabs)/progress.tsx',
    'apps/mobile/src/features/photos/CompareSlider.tsx'}
RELEASE21_FIXTURE = 'apps/mobile/src/features/photos/progressEmptyLayout.c08b2.test.ts'
RELEASE21_CANDIDATE = 'docs/brain/contracts/M1X-21/candidate.json'
RELEASE21_EARLY_CHECKER_SHA256 = '80b4af241a5e4f45136cbe1667dccde8b9109855c52d330573f2af9fd791515c'
RELEASE21_INHERITED_SOURCE_GUARD = source_guard


def allowed21(path):
    return (isinstance(path, str) and re.fullmatch(r'[A-Za-z0-9._/()-]+', path) is not None and
        all(p and not p.startswith('.') and not p.endswith('.') and
            re.fullmatch(r'(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?', p, re.I) is None
            for p in path.split('/')) and
        (path in RELEASE21_EXISTING or path in RELEASE21_NEW or path.startswith(RELEASE21_PREFIXES)))


def remember21(path, identities):
    parts = path.split('/')
    for size in range(1, len(parts)+1):
        original = '/'.join(parts[:size])
        key = unicodedata.normalize('NFKC', original).casefold()
        require(key not in identities or identities[key] == original, 'R21_COLLISION')
        identities[key] = original


def validate21_checker(raw):
    before = git('show', RELEASE21_BASE+':scripts/release/full-app-j01/check.py')
    tail = b"if __name__ == '__main__':\n    sys.exit(main())\n"
    require(before.endswith(tail) and raw.startswith(before[:-len(tail)]) and raw.endswith(tail),
            'R21_INHERITED_BYTES_CHANGED')
    old = ast.parse(before); new = ast.parse(raw)
    inherited = {n.name: ast.dump(n, include_attributes=False) for n in old.body if isinstance(n, ast.FunctionDef)}
    require(all(any(isinstance(n, ast.FunctionDef) and n.name == name and
            ast.dump(n, include_attributes=False) == value for n in new.body)
            for name, value in inherited.items()), 'R21_INHERITED_AST_CHANGED')
    extension = ast.parse(raw[len(before)-len(tail):-len(tail)])
    functions = {'allowed21', 'remember21', 'validate21_checker', 'candidate21_guard', 'validate21_diff',
        'source21_endpoint', 'source21_history', 'source20_historical_guard', 'source21_guard',
        'fixture21_guard', 'runtime21_guard', 'evidence21_guard'}
    # Authenticate the exact earlier committed successor before the alias helper existed.
    # This permits its immutable history without accepting another old-shaped checker.
    if sha(raw) == RELEASE21_EARLY_CHECKER_SHA256: functions -= {'remember21'}
    require({n.name for n in extension.body if isinstance(n, ast.FunctionDef)} == functions and
            len([n for n in extension.body if isinstance(n, ast.FunctionDef)]) == len(functions), 'R21_FUNCTION_SCOPE')
    for node in extension.body:
        if isinstance(node, ast.FunctionDef): continue
        require(isinstance(node, ast.Assign) and len(node.targets) == 1 and
                isinstance(node.targets[0], ast.Name), 'R21_MODULE_SCOPE')
        name = node.targets[0].id
        if name == 'source_guard':
            require(isinstance(node.value, ast.Name) and node.value.id == 'source21_guard', 'R21_DISPATCH')
        elif name == 'RELEASE21_INHERITED_SOURCE_GUARD':
            require(isinstance(node.value, ast.Name) and node.value.id == 'source_guard', 'R21_INHERITED_DISPATCH')
        else:
            require(name.startswith('RELEASE21_'), 'R21_GLOBAL_SCOPE')
            try: ast.literal_eval(node.value)
            except (ValueError, TypeError): require(False, 'R21_GLOBAL_SIDE_EFFECT')


def candidate21_guard(raw):
    value = json.loads(raw, object_pairs_hook=pairs)
    require(set(value) == {'schema', 'authority', 'status', 'base', 'tree', 'acceptanceGranted', 'admissions', 'runtimeProof'} and
        type(value['schema']) is int and value['schema'] == 1 and value['authority'] == RELEASE21_AUTHORITY and
        value['base'] == RELEASE21_BASE and value['tree'] == RELEASE21_TREE and
        value['status'] == 'SOURCE_ONLY_CANDIDATE' and value['acceptanceGranted'] is False and
        value['admissions'] == dict(G97=False, DB=False, M103=False, M2=False, J01=False, PUBLIC=False) and
        all(flag is False for flag in value['admissions'].values()), 'R21_NO_ADMISSION')
    require(type(value['runtimeProof']) is dict and set(value['runtimeProof']) <= RELEASE21_RUNTIME, 'R21_RUNTIME_PROOF_SCOPE')
    return value


def validate21_diff(raw, read_after):
    fields = raw.split(b'\0')
    require(fields[-1] == b'' and len(fields) % 2 == 1, 'R21_DIFF_SHAPE')
    names = set()
    identities = {}
    for n in range(0, len(fields)-1, 2):
        meta = fields[n].decode('ascii').split(); path = fields[n+1].decode('utf-8')
        require(len(meta) == 5, 'R21_DIFF_META')
        oldmode, newmode, oldblob, newblob, status = meta
        require(allowed21(path) and status in ('A', 'M'), 'R21_SCOPE:'+path)
        remember21(path, identities)
        key = unicodedata.normalize('NFKC', path).casefold()
        require(key not in names, 'R21_COLLISION'); names.add(key)
        require(oldmode in (':000000', ':100644') and newmode == '100644', 'R21_MODE')
        require((path in RELEASE21_EXISTING) == (oldmode == ':100644') and
            status == ('M' if oldmode == ':100644' else 'A') and
            all(re.fullmatch('[0-9a-f]{40}', x) for x in (oldblob, newblob)), 'R21_CREATE_EDIT')
        if oldmode == ':100644':
            require(oldblob == git('rev-parse', RELEASE21_BASE+':'+path).decode().strip(), 'R21_BASE_BLOB')
        else:
            require(oldblob == '0'*40 and subprocess.run(['git', 'cat-file', '-e', RELEASE21_BASE+':'+path],
                cwd=ROOT, capture_output=True).returncode != 0, 'R21_EXISTING_RECLASSIFIED')
        data = read_after(path)
        require(newblob == '0'*40 or hashlib.sha1(('blob '+str(len(data))+'\0').encode()+data).hexdigest() == newblob,
            'R21_AFTER_BLOB')
        if path == 'scripts/release/full-app-j01/check.py': validate21_checker(data)
        if path == RELEASE21_CANDIDATE: candidate21_guard(data)
        if path == RELEASE21_FIXTURE: fixture21_guard(data)
        if path in RELEASE21_RUNTIME: runtime21_guard(path, read_after)
        if path in {'apps/mobile/src/features/photos/manualCompare20Route.test.ts',
                'apps/mobile/src/features/photos/manualCompare20.test.ts',
                'apps/mobile/src/features/photos/progressRoutes.test.ts'}:
            lines = iter(data.splitlines(keepends=True))
            require(all(any(original == added for added in lines) for original in
                git('show', RELEASE21_BASE+':'+path).splitlines(keepends=True)), 'R21_ADDITIVE_REGRESSION:'+path)
        if path == 'docs/USER_FLOW_TREE.md':
            before = git('show', RELEASE21_BASE+':'+path)
            require(data.startswith(before) and data[len(before):].count(b'## Campaign21') == 1, 'R21_ADDITIVE_FLOW')


def fixture21_guard(raw):
    before = git('show', RELEASE21_BASE+':'+RELEASE21_FIXTURE)
    marker = b"describe('C-08B2-R2 empty layout composition (pixel geometry is covered by the browser runner)', () => {"
    require(before.count(marker) == raw.count(marker) == 1 and
        raw[raw.index(marker):] == before[before.index(marker):], 'R21_ORIGINAL15_CHANGED')


def runtime21_guard(path, read_after):
    value = candidate21_guard(read_after(RELEASE21_CANDIDATE))
    proof = value['runtimeProof'].get(path)
    require(isinstance(proof, dict) and set(proof) == {'defect', 'before', 'after'} and
        isinstance(proof['defect'], str) and len(proof['defect'].strip()) >= 20, 'R21_RUNTIME_REPRODUCTION_REQUIRED:'+path)
    for phase, expected in [('before', 1), ('after', 0)]:
        receipt = proof[phase]
        fields = {'command', 'exit', 'receiptSHA256'} | ({'source'} if phase == 'before' else set())
        require(isinstance(receipt, dict) and set(receipt) == fields and
            type(receipt['exit']) is int and receipt['exit'] == expected and
            isinstance(receipt['command'], list) and bool(receipt['command']) and
            all(isinstance(arg, str) and bool(arg) for arg in receipt['command']) and
            re.fullmatch('[0-9a-f]{64}', receipt['receiptSHA256']) is not None and
            (phase != 'before' or receipt['source'] == RELEASE21_BASE), 'R21_RUNTIME_PROOF:'+path)


def evidence21_guard(endpoint):
    # There is no evidence tail while substantive source is being developed.
    # Once a checkpoint enters Git, require exactly one terminal evidence child.
    names = [p for p in git('diff', '--name-only', '--no-renames', '-z', RELEASE21_BASE, endpoint).decode().split('\0')
             if p.startswith(RELEASE21_CHECKPOINT)]
    manifest_path = RELEASE21_CHECKPOINT+'manifest.json'
    if not names:
        require(not (ROOT/manifest_path).exists(), 'R21_UNCOMMITTED_EVIDENCE')
        return
    manifest = json.loads(regular(ROOT/manifest_path), object_pairs_hook=pairs)
    require(type(manifest.get('schema')) is int and manifest.get('schema') == 1 and manifest.get('authority') == RELEASE21_AUTHORITY and
        manifest.get('acceptanceGranted') is False and manifest.get('release') == 'NO_GO' and
        manifest.get('inputManifestSHA256') == '6c9b46747f0bb5a9141c9320a92f9508cff6d7e964b8ce2e8536e1260b64536e', 'R21_EVIDENCE_NO_ADMISSION')
    source = manifest['source']
    require(source['base'] == RELEASE21_BASE and source['baseTree'] == RELEASE21_TREE and
        all(re.fullmatch('[0-9a-f]{40}', source[k]) is not None for k in
            ['runtimeHead', 'runtimeTree', 'sourceHead', 'sourceTree']), 'R21_EVIDENCE_SOURCE')
    require(git('rev-parse', source['runtimeHead']+'^{tree}').decode().strip() == source['runtimeTree'] and
        git('rev-parse', source['sourceHead']+'^{tree}').decode().strip() == source['sourceTree'] and
        git('rev-list', '--parents', '-n', '1', source['sourceHead']).decode().split() ==
            [source['sourceHead'], source['runtimeHead']] and
        git('rev-list', '--parents', '-n', '1', endpoint).decode().split() ==
            [endpoint, source['sourceHead']], 'R21_ONE_EVIDENCE_TAIL')
    worklist = set(git('diff', '--name-only', '--no-renames', '-z', source['runtimeHead'], source['sourceHead']).decode().split('\0')[:-1])
    require(worklist == {'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md'}, 'R21_WORKLIST_ONLY_FREEZE')
    require(git('merge-base', RELEASE21_BASE, source['runtimeHead']).decode().strip() == RELEASE21_BASE,
        'R21_EVIDENCE_ANCESTRY')
    files = manifest['files']
    require(isinstance(files, dict) and bool(files) and all(isinstance(name, str) and
        allowed21(RELEASE21_CHECKPOINT+name) and not name.startswith('.') and
        name != 'manifest.json' for name in files), 'R21_EVIDENCE_FILES')
    expected = {RELEASE21_CHECKPOINT+name for name in files} | {manifest_path}
    actual = set()
    for artifact in (ROOT/RELEASE21_CHECKPOINT).rglob('*'):
        require(not artifact.is_symlink() and not (getattr(artifact.lstat(), 'st_file_attributes', 0) & 1024), 'R21_EVIDENCE_LINK')
        if artifact.is_dir(): continue
        actual.add(artifact.relative_to(ROOT).as_posix())
    require(actual == expected and set(names) == expected, 'R21_EVIDENCE_INVENTORY')
    for name, entry in files.items():
        data = regular(ROOT/(RELEASE21_CHECKPOINT+name))
        require(isinstance(entry, dict) and set(entry) == {'bytes', 'sha256'} and
            type(entry['bytes']) is int and entry['bytes'] == len(data) and
            entry['sha256'] == sha(data), 'R21_EVIDENCE_SHA256:'+name)
    fields = git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', source['sourceHead'], endpoint).split(b'\0')
    require(fields[-1] == b'' and len(fields) % 2 == 1, 'R21_EVIDENCE_DIFF')
    changed = set()
    for index in range(0, len(fields)-1, 2):
        meta = fields[index].decode().split(); path = fields[index+1].decode()
        require(len(meta) == 5 and meta[1] == '100644' and
            meta[4] == ('M' if path == 'ONSKIN_BRAIN_HANDOFF.txt' else 'A'), 'R21_EVIDENCE_MODE')
        changed.add(path)
    require(changed == expected | {'ONSKIN_BRAIN_HANDOFF.txt'}, 'R21_EVIDENCE_TAIL_SCOPE')




def source21_endpoint():
    head = git('rev-parse', 'HEAD').decode().strip()
    parents = git('rev-list', '--parents', '-n', '1', head).decode().split()
    if len(parents) == 2: return head
    require(len(parents) == 3 and parents[1] == RELEASE21_BASE, 'R21_CI_PARENTS')
    require(type(RELEASE21_PR) is int and RELEASE21_PR > 0 and
        os.environ.get('GITHUB_EVENT_NAME') == 'pull_request' and os.environ.get('GITHUB_REPOSITORY') == 'TasfiqJ/onSkin' and
        os.environ.get('GITHUB_REF') == 'refs/pull/'+str(RELEASE21_PR)+'/merge' and os.environ.get('GITHUB_SHA') == head, 'R21_CI_CONTEXT')
    event = json.loads(regular(Path(os.environ.get('GITHUB_EVENT_PATH', ''))), object_pairs_hook=pairs)
    pr = event.get('pull_request', {})
    require(event.get('number') == RELEASE21_PR and pr.get('number') == RELEASE21_PR and
        event.get('repository', {}).get('full_name') == 'TasfiqJ/onSkin' and
        pr.get('base', {}).get('sha') == RELEASE21_BASE and pr.get('base', {}).get('ref') == 'stage/m1-f09-manual-photo-compare20' and
        pr.get('head', {}).get('sha') == parents[2] and pr.get('head', {}).get('ref') == 'stage/m1-f09-layout-compatibility21' and
        pr.get('head', {}).get('repo', {}).get('full_name') == 'TasfiqJ/onSkin' and pr.get('draft') is True and
        pr.get('maintainer_can_modify') is False and pr.get('auto_merge') is None, 'R21_CI_EVENT')
    require(git('rev-parse', head+'^{tree}') == git('rev-parse', parents[2]+'^{tree}'), 'R21_CI_TREE')
    return parents[2]


def source21_history():
    require(git('rev-parse', RELEASE21_BASE+'^{tree}').decode().strip() == RELEASE21_TREE, 'R21_BASE_TREE')
    endpoint = source21_endpoint()
    subprocess.run(['git', 'merge-base', '--is-ancestor', RELEASE21_BASE, endpoint], cwd=ROOT, check=True, capture_output=True)
    for commit in git('rev-list', '--reverse', RELEASE21_BASE+'..'+endpoint).decode().splitlines():
        require(len(git('rev-list', '--parents', '-n', '1', commit).decode().split()) == 2, 'R21_LINEAR_HISTORY')
        validate21_diff(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE21_BASE, commit),
            lambda path: git('show', commit+':'+path))


def source20_historical_guard():
    # Evaluate every inherited guard against actual immutable PR24 Git bytes.
    # Current source is checked separately and strictly by source21_guard.
    actual_git, actual_regular, actual_name = git, regular, __name__
    def historical_git(*args):
        if args == ('rev-parse', 'HEAD'): return actual_git('rev-parse', RELEASE21_BASE)
        if args[0] == 'diff' and len([a for a in args[1:] if not a.startswith('-')]) == 1:
            return actual_git(*[a for a in args if a != '--cached'], RELEASE21_BASE)
        if args[0] == 'show' and args[1].startswith(':'): return actual_git('show', RELEASE21_BASE+args[1])
        if args[0] == 'ls-files':
            if '--others' in args: return b''
            if '-v' in args:
                return b''.join(b'H '+p+b'\0' for p in actual_git('ls-tree', '-r', '--name-only', '-z', RELEASE21_BASE).split(b'\0') if p)
        return actual_git(*args)
    def historical_regular(path):
        try: name = Path(path).absolute().relative_to(ROOT.absolute()).as_posix()
        except ValueError: return actual_regular(path)
        found = subprocess.run(['git', 'cat-file', '-e', RELEASE21_BASE+':'+name], cwd=ROOT, capture_output=True)
        return actual_git('show', RELEASE21_BASE+':'+name) if found.returncode == 0 else actual_regular(path)
    globals()['git'], globals()['regular'], globals()['__name__'] = historical_git, historical_regular, 'release20_historical'
    try: return RELEASE21_INHERITED_SOURCE_GUARD()
    finally: globals()['git'], globals()['regular'], globals()['__name__'] = actual_git, actual_regular, actual_name


def source21_guard():
    source21_history()
    evidence21_guard(source21_endpoint())
    candidate21_guard(regular(ROOT/'docs/brain/contracts/M1X-21/candidate.json'))
    candidate21_guard(git('show', ':docs/brain/contracts/M1X-21/candidate.json'))
    dependency13_guard(regular(ROOT/'package-lock.json'))
    dependency13_guard(git('show', ':package-lock.json'), lambda p: git('show', ':'+p), installed=False)
    validate21_diff(git('diff', '--cached', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE21_BASE), lambda p: git('show', ':'+p))
    validate21_diff(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE21_BASE), lambda p: regular(ROOT/p))
    names = set()
    identities = {}
    for entry in git('ls-files', '-v', '-z').decode().split('\0'):
        if entry:
            require(entry.startswith('H '), 'R21_INDEX_FLAGS')
            remember21(entry[2:], identities)
            key = unicodedata.normalize('NFKC', entry[2:]).casefold()
            require(key not in names, 'R21_COLLISION'); names.add(key)
    for path in git('ls-files', '--others', '--exclude-standard', '-z').decode().split('\0'):
        if path:
            require(allowed21(path) and path not in RELEASE21_EXISTING, 'R21_UNTRACKED_SCOPE:'+path)
            remember21(path, identities)
            key = unicodedata.normalize('NFKC', path).casefold()
            require(key not in names, 'R21_COLLISION'); names.add(key); regular(ROOT/path)
    # Original Release08-20 consumers run separately against their immutable checkers.
    # The successor consumer exercises the current finite scope without rewriting old negatives.
    if os.environ.get('GITHUB_ACTIONS') == 'true' and __name__ == '__main__' and '--bundle-dir' not in sys.argv:
        result = subprocess.run([sys.executable, '-B', 'scripts/release/full-app-j01/source_consumer21.test.py'], cwd=ROOT, capture_output=True, timeout=300)
        require(result.returncode == 0, 'R21_SOURCE_TESTS_FAILED: ' +
            result.stdout.decode('utf-8', errors='replace')[-4000:] +
            result.stderr.decode('utf-8', errors='replace')[-4000:])
    return source20_historical_guard()


source_guard = source21_guard


# Release22 successor. Every inherited Release08-21 byte above is immutable.
RELEASE22_BASE = '2cffa9e92be101af4e3b371f1815ec9f458d8da4'
RELEASE22_TREE = '9380dd155ee2c7879de7ef79eb27d0028b950d13'
RELEASE22_AUTHORITY = 'BRAIN-M1X-SECURITY-RECOVERY22-CANDIDATE-01'
RELEASE22_CANDIDATE = 'docs/brain/contracts/M1X-22/candidate.json'
RELEASE22_CHECKPOINT = 'docs/brain/checkpoints/M1-03/SECURITY-RECOVERY-22/'
RELEASE22_WORKLIST = {'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md'}
RELEASE22_EXISTING = {
    'package.json', 'package-lock.json', 'apps/mobile/package.json',
    'apps/catalog-operator-console/package.json', 'scripts/postinstall.mjs',
    'scripts/phase9/patch-tooling-security.mjs', 'scripts/phase9/patch-tooling-security.test.mjs',
    'scripts/release/full-app-j01/check.py', 'docs/phase-4/generated/source-worklist.json',
    'docs/phase-4/generated/source-worklist.md', 'ONSKIN_BRAIN_HANDOFF.txt'}
RELEASE22_NEW = {
    '.github/workflows/security-candidate22.yml', 'scripts/security22/README.md',
    'scripts/security22/run.py', 'scripts/security22/inventory.py', 'scripts/security22/toolchain.py',
    'scripts/security22/collect.py', 'scripts/security22/evaluate.py', 'scripts/security22/redact.py',
    'scripts/security22/dependency.mjs', 'scripts/security22/test_security22.py',
    'scripts/security22/dependency.test.mjs', 'scripts/security22/toolchain.json',
    'scripts/security22/policy.json', 'scripts/security22/synthetic-fixtures.json',
    'scripts/security22/patch-tooling.mjs', 'scripts/security22/patch-tooling.test.mjs',
    'scripts/security22/backports.json', 'scripts/release/full-app-j01/source_consumer22.test.py',
    'docs/brain/contracts/M1X-22/candidate.json', 'docs/brain/task-specs/M1X-22/TASK.md',
    'docs/security/security22/ROOT_CAUSES.md', 'docs/security/security22/REMEDIATION.md',
    'docs/security/security22/VALIDATION.md', 'docs/security/security22/BLOCKERS.md',
    'docs/security/security22/UPSTREAM_SOURCES.md',
    'docs/brain/checkpoints/M1-03/SECURITY-RECOVERY-22/README.md',
    'docs/brain/checkpoints/M1-03/SECURITY-RECOVERY-22/FINAL_REPORT.md',
    'docs/brain/checkpoints/M1-03/SECURITY-RECOVERY-22/manifest.json',
    'docs/brain/checkpoints/M1-03/SECURITY-RECOVERY-22/payload.zip',
    'docs/brain/checkpoints/M1-03/SECURITY-RECOVERY-22/verify22.py'}


def git22(*args):
    require(not any(key.startswith('GIT_') and key not in {'GIT_PAGER', 'GIT_TERMINAL_PROMPT'} for key in os.environ), 'R22_GIT_ENV')
    return subprocess.check_output(['git', '--no-pager', '--no-replace-objects', '--no-optional-locks',
        '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', '-c', 'diff.external=',
        '-c', 'core.hooksPath=', *args], cwd=ROOT, stderr=subprocess.PIPE)


def allowed22(path):
    return isinstance(path, str) and path in RELEASE22_EXISTING | RELEASE22_NEW


def candidate22_guard(raw):
    value = json.loads(raw, object_pairs_hook=pairs,
        parse_constant=lambda _: require(False, 'R22_NONFINITE_JSON'))
    require(type(value) is dict and set(value) == {'schema', 'authority', 'status', 'base', 'tree',
        'acceptanceGranted', 'admissions', 'pr'} and type(value['schema']) is int and value['schema'] == 1 and
        value['authority'] == RELEASE22_AUTHORITY and value['status'] == 'SUBMITTED_REVIEW_REQUIRED' and
        value['base'] == RELEASE22_BASE and value['tree'] == RELEASE22_TREE and
        value['acceptanceGranted'] is False and type(value['admissions']) is dict and
        set(value['admissions']) == {'G97', 'DB', 'M103', 'M2', 'J01', 'PUBLIC'} and
        all(flag is False for flag in value['admissions'].values()) and
        (value['pr'] is None or (type(value['pr']) is int and value['pr'] > 0)), 'R22_NO_ADMISSION')
    return value


def validate22_checker(raw):
    before = git22('show', RELEASE22_BASE+':scripts/release/full-app-j01/check.py')
    tail = b"if __name__ == '__main__':\n    sys.exit(main())\n"
    require(before.endswith(tail) and raw.startswith(before[:-len(tail)]) and raw.endswith(tail), 'R22_INHERITED_BYTES')
    extension = ast.parse(raw[len(before)-len(tail):-len(tail)])
    functions = {'git22', 'allowed22', 'candidate22_guard', 'validate22_checker', 'package22_guard',
        'tooling22_guard', 'validate22_diff', 'source22_endpoint', 'source22_history', 'evidence22_guard',
        'source22_guard', 'historical21_validate', 'validate22'}
    require({n.name for n in extension.body if isinstance(n, ast.FunctionDef)} == functions and
        len([n for n in extension.body if isinstance(n, ast.FunctionDef)]) == len(functions), 'R22_FUNCTION_SCOPE')
    dispatch = set(); assigned = set()
    for node in extension.body:
        if isinstance(node, ast.FunctionDef): continue
        require(isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name), 'R22_MODULE_SCOPE')
        name = node.targets[0].id
        require(name not in assigned, 'R22_DUPLICATE_ASSIGNMENT'); assigned.add(name)
        if name in {'source_guard', 'validate'}:
            dispatch.add(name)
            require(isinstance(node.value, ast.Name) and node.value.id ==
                {'source_guard': 'source22_guard', 'validate': 'validate22'}[name], 'R22_DISPATCH')
        else:
            require(name.startswith('RELEASE22_'), 'R22_GLOBAL_SCOPE')
            try: ast.literal_eval(node.value)
            except (ValueError, TypeError): require(False, 'R22_GLOBAL_SIDE_EFFECT')
    require(dispatch == {'source_guard', 'validate'}, 'R22_DISPATCH_REQUIRED')


def package22_guard(path, raw):
    before_raw = git22('show', RELEASE22_BASE+':'+path)
    if path == 'scripts/postinstall.mjs':
        # The three existing installer calls, argument validation and reporting stay mandatory.
        original = iter(before_raw.splitlines()); pending = next(original, None); additions = []
        for line in raw.splitlines():
            if line == pending: pending = next(original, None)
            else: additions.append(line)
        require(pending is None and all(not line.strip() or line in {
            b"import { patchToolingSecurity22 } from './security22/patch-tooling.mjs';",
            b'const toolingSecurity22 = patchToolingSecurity22({ root, check });'} for line in additions) and
            len([line for line in additions if line.strip()]) == len(set(line for line in additions if line.strip())),
            'R22_POSTINSTALL_PRESERVATION')
        return
    before = json.loads(before_raw, object_pairs_hook=pairs)
    after = json.loads(raw, object_pairs_hook=pairs)
    require(type(after) is dict, 'R22_PACKAGE_SCHEMA')
    dependency_fields = {'dependencies', 'devDependencies', 'optionalDependencies'}
    mutable = dependency_fields | ({'scripts'} if path == 'package.json' else set())
    require({k:v for k,v in before.items() if k not in mutable} ==
        {k:v for k,v in after.items() if k not in mutable}, 'R22_PACKAGE_PURPOSE')
    for field in dependency_fields:
        old, new = before.get(field, {}), after.get(field, {})
        require(type(new) is dict and set(old) <= set(new) and
            all(type(k) is str and type(v) is str and bool(v) for k,v in new.items()), 'R22_DEPENDENCY_SCHEMA')
        for framework in ('expo', 'react-native'):
            require(old.get(framework) == new.get(framework), 'R22_FRAMEWORK_VERSION')
    if path == 'package.json':
        old, new = before.get('scripts', {}), after.get('scripts', {})
        require(type(new) is dict and all(new.get(k) == v for k,v in old.items()) and
            all(k.startswith('security22:') and type(v) is str and bool(v) for k,v in new.items() if k not in old),
            'R22_COMMAND_PRESERVATION')


def tooling22_guard(raw):
    original = git22('show', RELEASE22_BASE+':scripts/phase9/patch-tooling-security.mjs')
    def tokens(source):
        pattern = rb"""'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|\`(?:\\.|[^\`\\])*\`|//[^\r\n]*|/\*[\s\S]*?\*/|[A-Za-z_$][A-Za-z0-9_$]*|[0-9]+|[^\s]"""
        return [token for token in re.findall(pattern, source) if not token.startswith((b'//', b'/*'))]
    start, end = original.index(b'const PROFILES = ['), original.index(b'const SCRIPT_ROOT = ')
    expected = tokens(original[start:end]); actual = tokens(raw); depth = 0; found = 0
    for index, token in enumerate(actual):
        if depth == 0 and actual[index:index+3] == [b'const', b'PROFILES', b'=']:
            require(actual[index:index+len(expected)] == expected, 'R22_HISTORICAL_BACKPORT_PROFILES')
            found += 1
        if token == b'{': depth += 1
        if token == b'}': depth -= 1
        require(depth >= 0, 'R22_TOOLING_SYNTAX')
    require(found == 1 and depth == 0, 'R22_ACTIVE_BACKPORT_PROFILES')


def validate22_diff(raw, read_after, parent=None):
    require(not any(key.startswith('GIT_') and key not in {'GIT_PAGER', 'GIT_TERMINAL_PROMPT'} for key in os.environ), 'R22_GIT_ENV')
    parent = parent or RELEASE22_BASE
    fields = raw.split(b'\0')
    require(fields[-1] == b'' and len(fields) % 2 == 1, 'R22_DIFF_SHAPE')
    identities = {}; seen = set()
    for index in range(0, len(fields)-1, 2):
        meta = fields[index].decode('ascii').split(); path = fields[index+1].decode('utf-8')
        require(len(meta) == 5 and allowed22(path) and path not in seen, 'R22_FINITE_SCOPE')
        seen.add(path); remember21(path, identities)
        oldmode, newmode, oldblob, newblob, status = meta
        require(oldmode in (':000000', ':100644') and newmode == '100644' and status in ('A', 'M') and
            all(re.fullmatch('[0-9a-f]{40}', v) for v in (oldblob, newblob)), 'R22_MODE_OR_DELETION')
        exists = subprocess.run(['git', '--no-replace-objects', 'cat-file', '-e', parent+':'+path],
            cwd=ROOT, capture_output=True).returncode == 0
        require(exists == (status == 'M') == (oldmode == ':100644'), 'R22_PARENT_PROVENANCE')
        if exists: require(oldblob == git22('rev-parse', parent+':'+path).decode().strip(), 'R22_PARENT_BLOB')
        else: require(oldblob == '0'*40, 'R22_NEW_BLOB')
        if parent == RELEASE22_BASE:
            require(exists == (path in RELEASE22_EXISTING), 'R22_CREATE_EDIT')
        data = read_after(path)
        require(newblob == '0'*40 or hashlib.sha1(('blob '+str(len(data))+'\0').encode()+data).hexdigest() == newblob,
            'R22_AFTER_BLOB')
        if path == 'scripts/release/full-app-j01/check.py': validate22_checker(data)
        if path == RELEASE22_CANDIDATE: candidate22_guard(data)
        if path in ('package.json', 'apps/mobile/package.json', 'apps/catalog-operator-console/package.json', 'scripts/postinstall.mjs'):
            package22_guard(path, data)
        if path == 'scripts/phase9/patch-tooling-security.mjs':
            tooling22_guard(data)
        if path == 'scripts/phase9/patch-tooling-security.test.mjs':
            original = git22('show', RELEASE22_BASE+':'+path)
            lines = iter(data.splitlines(keepends=True))
            require(all(any(old == new for new in lines) for old in original.splitlines(keepends=True)), 'R22_EXISTING_TOOLING_REGRESSIONS')
        if path == 'package-lock.json':
            before = json.loads(git22('show', RELEASE22_BASE+':package-lock.json'), object_pairs_hook=pairs)
            lock = json.loads(data, object_pairs_hook=pairs)
            require(type(lock) is dict and type(lock.get('lockfileVersion')) is int and
                lock['lockfileVersion'] == before['lockfileVersion'] and type(lock.get('packages')) is dict,
                'R22_LOCK_SCHEMA')
            for name, node in lock['packages'].items():
                if name.endswith('/node_modules/expo') or name.endswith('/node_modules/react-native') or name in ('node_modules/expo', 'node_modules/react-native'):
                    require(name in before['packages'] and node.get('version') == before['packages'][name].get('version'), 'R22_LOCK_FRAMEWORK')


def source22_endpoint():
    head = git22('rev-parse', 'HEAD').decode().strip()
    parents = git22('rev-list', '--parents', '-n', '1', head).decode().split()
    require(len(parents) in (2, 3), 'R22_HEAD_PARENTS')
    endpoint = head if len(parents) == 2 else parents[2]
    if len(parents) == 3 or os.environ.get('GITHUB_ACTIONS') == 'true':
        require(os.environ.get('GITHUB_EVENT_NAME') == 'pull_request' and
            os.environ.get('GITHUB_REPOSITORY') == 'TasfiqJ/onSkin' and os.environ.get('GITHUB_SHA') in (head, endpoint), 'R22_CI_CONTEXT')
        candidate = candidate22_guard(regular(ROOT/RELEASE22_CANDIDATE)); number = candidate['pr']
        require(type(number) is int and number > 0, 'R22_CI_CONTEXT')
        event_path = Path(os.environ.get('GITHUB_EVENT_PATH', ''))
        try:
            # Keep regular()'s complete ancestor checks, then bound the read itself.
            for component in (event_path, *event_path.parents):
                info = component.lstat()
                require(not stat.S_ISLNK(info.st_mode) and not getattr(info, 'st_file_attributes', 0) & 1024,
                    'R22_CI_EVENT_PATH')
            before = event_path.lstat()
            require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and
                0 < before.st_size <= 1024*1024, 'R22_CI_EVENT_SIZE')
            with event_path.open('rb') as stream:
                opened = os.fstat(stream.fileno()); event_raw = stream.read(1024*1024+1)
                finished = os.fstat(stream.fileno())
            after = event_path.lstat()
        except OSError:
            require(False, 'R22_CI_EVENT_PATH')
        identity = lambda value: (value.st_dev, value.st_ino, value.st_size, value.st_mtime_ns)
        require(identity(before) == identity(opened) == identity(finished) == identity(after) and
            len(event_raw) == before.st_size and len(event_raw) <= 1024*1024, 'R22_CI_EVENT_CHANGED')
        try:
            event = json.loads(event_raw, object_pairs_hook=pairs,
                parse_constant=lambda _: require(False, 'R22_NONFINITE_JSON'))
        except (ValueError, TypeError, UnicodeError):
            require(False, 'R22_CI_EVENT_JSON')
        require(type(event) is dict and type(event.get('repository')) is dict and
            type(event.get('pull_request')) is dict, 'R22_CI_EVENT')
        pr = event['pull_request']
        require(type(pr.get('base')) is dict and type(pr.get('head')) is dict and
            type(pr['head'].get('repo')) is dict, 'R22_CI_EVENT')
        require(type(event.get('number')) is int and event['number'] == number and type(pr.get('number')) is int and pr['number'] == number and
            event.get('repository', {}).get('full_name') == 'TasfiqJ/onSkin' and
            os.environ.get('GITHUB_REF') == 'refs/pull/'+str(number)+'/merge' and
            pr.get('base', {}).get('sha') == RELEASE22_BASE and pr.get('base', {}).get('ref') == 'stage/m1-f09-layout-compatibility21' and
            pr.get('head', {}).get('sha') == endpoint and
            re.fullmatch(r'stage/m1-security-recovery22(?:-[a-z0-9-]+)?', pr.get('head', {}).get('ref', '')) is not None and
            pr.get('head', {}).get('repo', {}).get('full_name') == 'TasfiqJ/onSkin' and pr.get('draft') is True and
            pr.get('maintainer_can_modify') is False and 'auto_merge' in pr and pr['auto_merge'] is None, 'R22_CI_EVENT')
        if len(parents) == 3:
            require(parents[1] == RELEASE22_BASE and os.environ.get('GITHUB_REF') == 'refs/pull/'+str(number)+'/merge' and
                git22('rev-parse', head+'^{tree}') == git22('rev-parse', endpoint+'^{tree}'), 'R22_CI_MERGE_TREE')
    return endpoint


def source22_history():
    grafts = Path(git22('rev-parse', '--git-path', 'info/grafts').decode().strip())
    if not grafts.is_absolute(): grafts = ROOT/grafts
    require(not os.path.lexists(grafts) and not git22('for-each-ref', '--format=%(refname)', 'refs/replace').strip() and
        not os.environ.get('GIT_REPLACE_REF_BASE'), 'R22_HISTORY_SUBSTITUTION')
    require(git22('rev-parse', '--is-shallow-repository').strip() == b'false' and
        git22('rev-parse', RELEASE22_BASE+'^{tree}').decode().strip() == RELEASE22_TREE, 'R22_FULL_PINNED_HISTORY')
    endpoint = source22_endpoint()
    require(git22('merge-base', RELEASE22_BASE, endpoint).decode().strip() == RELEASE22_BASE, 'R22_ANCESTRY')
    previous = RELEASE22_BASE; evidence_seen = False
    for commit in git22('rev-list', '--reverse', RELEASE22_BASE+'..'+endpoint).decode().splitlines():
        require(git22('rev-list', '--parents', '-n', '1', commit).decode().split() == [commit, previous], 'R22_LINEAR_HISTORY')
        require(not evidence_seen, 'R22_AFTER_EVIDENCE_TAIL')
        validate22_diff(git22('diff', '--raw', '--no-abbrev', '--no-renames', '-z', previous, commit),
            lambda path: git22('show', commit+':'+path), previous)
        validate22_diff(git22('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE22_BASE, commit),
            lambda path: git22('show', commit+':'+path))
        paths = git22('diff', '--name-only', '--no-renames', '-z', previous, commit).decode().split('\0')[:-1]
        evidence_seen = any(p.startswith(RELEASE22_CHECKPOINT) for p in paths)
        require('ONSKIN_BRAIN_HANDOFF.txt' not in paths or evidence_seen, 'R22_HANDOFF_BEFORE_TAIL')
        previous = commit
    return endpoint


def evidence22_guard(endpoint):
    names = {p for p in git22('diff', '--name-only', '--no-renames', '-z', RELEASE22_BASE, endpoint).decode().split('\0')
        if p.startswith(RELEASE22_CHECKPOINT)}
    expected = {p for p in RELEASE22_NEW if p.startswith(RELEASE22_CHECKPOINT)}
    if not names:
        require(not (ROOT/RELEASE22_CHECKPOINT).exists(), 'R22_UNCOMMITTED_EVIDENCE')
        return
    require(names == expected, 'R22_EVIDENCE_EXACT_PATHS')
    manifest = load(ROOT/(RELEASE22_CHECKPOINT+'manifest.json'))
    require(type(manifest) is dict and set(manifest) == {'schema', 'authority', 'status', 'acceptanceGranted',
        'release', 'inputManifestSHA256', 'source', 'files', 'payload'} and
        type(manifest['schema']) is int and manifest['schema'] == 1 and manifest['authority'] == RELEASE22_AUTHORITY and
        manifest['status'] == 'SUBMITTED_REVIEW_REQUIRED' and manifest['acceptanceGranted'] is False and
        manifest['release'] == 'NO_GO' and manifest['inputManifestSHA256'] ==
        '72b9642e0419d7117014a5476d431de2edc32e2014503099d785c43374b3d9f9', 'R22_EVIDENCE_NO_ADMISSION')
    source = manifest['source']
    require(type(source) is dict and set(source) == {'base', 'baseTree', 'runtimeHead', 'runtimeTree', 'sourceHead', 'sourceTree'} and
        source['base'] == RELEASE22_BASE and source['baseTree'] == RELEASE22_TREE and
        all(type(v) is str and re.fullmatch('[0-9a-f]{40}', v) for v in source.values()), 'R22_EVIDENCE_SOURCE')
    require(git22('rev-parse', source['runtimeHead']+'^{tree}').decode().strip() == source['runtimeTree'] and
        git22('rev-parse', source['sourceHead']+'^{tree}').decode().strip() == source['sourceTree'] and
        git22('rev-list', '--parents', '-n', '1', source['sourceHead']).decode().split() == [source['sourceHead'], source['runtimeHead']] and
        git22('rev-list', '--parents', '-n', '1', endpoint).decode().split() == [endpoint, source['sourceHead']], 'R22_ONE_EVIDENCE_TAIL')
    require(set(git22('diff', '--name-only', '--no-renames', '-z', source['runtimeHead'], source['sourceHead']).decode().split('\0')[:-1]) ==
        RELEASE22_WORKLIST, 'R22_WORKLIST_ONLY_FREEZE')
    require(set(git22('diff', '--name-only', '--no-renames', '-z', source['sourceHead'], endpoint).decode().split('\0')[:-1]) ==
        expected | {'ONSKIN_BRAIN_HANDOFF.txt'}, 'R22_EVIDENCE_TAIL_SCOPE')
    files = manifest['files']
    require(type(files) is dict and set(files) == {'README.md', 'FINAL_REPORT.md', 'payload.zip', 'verify22.py'}, 'R22_EVIDENCE_FILES')
    actual = set()
    for path in (ROOT/RELEASE22_CHECKPOINT).rglob('*'):
        info = path.lstat()
        require(not stat.S_ISLNK(info.st_mode) and not getattr(info, 'st_file_attributes', 0) & 1024, 'R22_EVIDENCE_LINK')
        if stat.S_ISDIR(info.st_mode): continue
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1, 'R22_EVIDENCE_REGULAR')
        actual.add(path.relative_to(ROOT).as_posix())
    require(actual == expected, 'R22_EVIDENCE_INVENTORY')
    for name, witness in files.items():
        raw = regular(ROOT/(RELEASE22_CHECKPOINT+name))
        require(type(witness) is dict and set(witness) == {'bytes', 'sha256'} and type(witness['bytes']) is int and
            witness['bytes'] == len(raw) and witness['sha256'] == sha(raw), 'R22_EVIDENCE_HASH')
    require(all(regular(ROOT/path) == git22('show', endpoint+':'+path) for path in expected | {'ONSKIN_BRAIN_HANDOFF.txt'}),
        'R22_EVIDENCE_COMMITTED_BYTES')


def source22_guard():
    endpoint = source22_history(); evidence22_guard(endpoint)
    if (ROOT/(RELEASE22_CHECKPOINT+'manifest.json')).exists():
        require(not git22('status', '--porcelain=v1', '--untracked-files=all', '-z'), 'R22_FROZEN_CHECKOUT_DIRTY')
    candidate22_guard(regular(ROOT/RELEASE22_CANDIDATE))
    candidate22_guard(git22('show', ':'+RELEASE22_CANDIDATE))
    validate22_diff(git22('diff', '--cached', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE22_BASE), lambda p: git22('show', ':'+p))
    validate22_diff(git22('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE22_BASE), lambda p: regular(ROOT/p))
    identities = {}; tree = {}
    for raw in git22('ls-tree', '-r', '-z', endpoint).split(b'\0'):
        if not raw: continue
        meta, name = raw.split(b'\t', 1); mode, kind, oid = meta.decode().split(); path = name.decode()
        require(kind == 'blob' and mode in ('100644', '100755'), 'R22_TREE_MODE')
        tree[path] = (mode, oid); remember21(path, identities)
    index = {}
    for raw in git22('ls-files', '--stage', '-z').split(b'\0'):
        if not raw: continue
        meta, name = raw.split(b'\t', 1); mode, oid, stage = meta.decode().split(); path = name.decode()
        require(stage == '0' and mode in ('100644', '100755') and path not in index, 'R22_INDEX_STAGE_MODE')
        index[path] = (mode, oid); remember21(path, identities)
    for raw in git22('ls-files', '-v', '-z').split(b'\0'):
        if raw: require(raw.startswith(b'H '), 'R22_INDEX_FLAGS')
    for path in git22('ls-files', '--others', '--exclude-standard', '-z').decode().split('\0'):
        if not path: continue
        require(path in RELEASE22_NEW and path not in index, 'R22_UNTRACKED_SCOPE'); remember21(path, identities); regular(ROOT/path)
    # Full clean-source inventory/scanner coverage is independently executed by security22.
    # This guard proves finite source governance, never technical Security readiness.
    return tree


def historical21_validate(bundle=BUNDLE):
    raw = git22('show', RELEASE22_BASE+':scripts/release/full-app-j01/check.py')
    namespace = {'__name__': 'release21_historical', '__file__': str(ROOT/'scripts/release/full-app-j01/check.py')}
    exec(compile(raw, 'immutable-pr25-checker', 'exec'), namespace)
    actual_git, actual_regular = git22, regular
    def historical_git(*args):
        if args == ('rev-parse', 'HEAD'): return actual_git('rev-parse', RELEASE22_BASE)
        if args[0] == 'diff' and len([a for a in args[1:] if not a.startswith('-')]) == 1:
            return actual_git(*[a for a in args if a != '--cached'], RELEASE22_BASE)
        if args[0] == 'show' and args[1].startswith(':'): return actual_git('show', RELEASE22_BASE+args[1])
        if args[0] == 'ls-files':
            if '--others' in args: return b''
            if '-v' in args:
                return b''.join(b'H '+p+b'\0' for p in actual_git('ls-tree', '-r', '--name-only', '-z', RELEASE22_BASE).split(b'\0') if p)
        return actual_git(*args)
    def historical_regular(path):
        try: name = Path(path).absolute().relative_to(ROOT.absolute()).as_posix()
        except ValueError: return actual_regular(path)
        found = subprocess.run(['git', '--no-replace-objects', 'cat-file', '-e', RELEASE22_BASE+':'+name], cwd=ROOT, capture_output=True)
        return actual_git('show', RELEASE22_BASE+':'+name) if found.returncode == 0 else actual_regular(path)
    namespace['git'], namespace['regular'] = historical_git, historical_regular
    result = namespace['validate'](bundle)
    result['historical_source'] = RELEASE22_BASE
    result['historical_qualification'] = 'IMMUTABLE_PR25_GOVERNANCE_REPLAY; NOT_CURRENT_SECURITY_ACCEPTANCE'
    return result


def validate22(bundle=BUNDLE):
    source22_guard()
    result = historical21_validate(bundle)
    result['current_source_governance'] = 'RELEASE22_FINITE_SCOPE_ONLY'
    result['source_acceptance'] = 'SUBMITTED_REVIEW_REQUIRED'
    result['release'] = 'NO_GO'
    return result


source_guard = source22_guard
validate = validate22


# Release23 successor. Every inherited Release08-22 byte above is immutable.
RELEASE23_BASE = '34fac69f3ba527724ecdf2d1cef69f27372756ad'
RELEASE23_TREE = '832baeae6421bfaa6fb668b025932d2c49a4f33c'
RELEASE23_AUTHORITY = 'BRAIN-M1X-SECURITY-INTEGRATION23-REPAIR-01'
RELEASE23_CANDIDATE = 'docs/brain/contracts/M1X-23/candidate.json'
RELEASE23_CHECKPOINT = 'docs/brain/checkpoints/M1-03/SECURITY-INTEGRATION-23/'
RELEASE23_WORKLIST = {'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md'}
RELEASE23_EXISTING = {
    'scripts/security22/README.md',
    'scripts/security22/run.py',
    'scripts/security22/inventory.py',
    'scripts/security22/toolchain.py',
    'scripts/security22/collect.py',
    'scripts/security22/evaluate.py',
    'scripts/security22/redact.py',
    'scripts/security22/dependency.mjs',
    'scripts/security22/test_security22.py',
    'scripts/security22/dependency.test.mjs',
    'scripts/security22/toolchain.json',
    'scripts/security22/policy.json',
    'scripts/security22/patch-tooling.mjs',
    'scripts/security22/patch-tooling.test.mjs',
    'scripts/security22/backports.json',
    '.github/workflows/security-candidate22.yml',
    'package.json',
    'package-lock.json',
    'apps/mobile/package.json',
    'apps/catalog-operator-console/package.json',
    'scripts/postinstall.mjs',
    'scripts/phase9/patch-tooling-security.mjs',
    'scripts/phase9/patch-tooling-security.test.mjs',
    'scripts/phase9/ios-privacy-contract.mjs',
    'scripts/phase9/ios-privacy-source-audit.mjs',
    'scripts/phase9/ios-privacy-source-audit.test.mjs',
    'scripts/phase5/ios-extension-contract.mjs',
    'scripts/phase5/check-native-config.mjs',
    'scripts/release/full-app-j01/check.py',
    'docs/phase-4/generated/source-worklist.json',
    'docs/phase-4/generated/source-worklist.md',
    'ONSKIN_BRAIN_HANDOFF.txt',
}
RELEASE23_NEW = {
    'scripts/security23/README.md',
    'scripts/security23/test_integration.py',
    'scripts/security23/test_toolchain.py',
    'scripts/security23/test_partial_results.py',
    'scripts/security23/native-source.test.mjs',
    'scripts/security23/fixtures.json',
    'scripts/phase9/ios-privacy-lock-succession23.mjs',
    'scripts/phase9/ios-privacy-lock-succession23.test.mjs',
    'docs/phase-9/ios-sdk-lock-succession23.v1.json',
    'scripts/release/full-app-j01/source_consumer23.test.py',
    'docs/brain/contracts/M1X-23/candidate.json',
    'docs/brain/task-specs/M1X-23/TASK.md',
    'docs/security/security23/ROOT_CAUSES.md',
    'docs/security/security23/REMEDIATION.md',
    'docs/security/security23/VALIDATION.md',
    'docs/security/security23/BLOCKERS.md',
    'docs/security/security23/UPSTREAM_SOURCES.md',
    'docs/brain/checkpoints/M1-03/SECURITY-INTEGRATION-23/README.md',
    'docs/brain/checkpoints/M1-03/SECURITY-INTEGRATION-23/FINAL_REPORT.md',
    'docs/brain/checkpoints/M1-03/SECURITY-INTEGRATION-23/manifest.json',
    'docs/brain/checkpoints/M1-03/SECURITY-INTEGRATION-23/payload.zip',
    'docs/brain/checkpoints/M1-03/SECURITY-INTEGRATION-23/verify23.py',
}

RELEASE23_FIXTURE_SOURCE = 'd08347f0011672cd309d835628c094b5e9f4725d'
RELEASE23_FIXTURE_TREE = '0998881bc543840395dca375769ea1b7c9a8d4c7'
RELEASE23_FIXTURE_CHECKER_SHA256 = '7118308899a2b6b89e98680697d486b85dacd9b9fad8702cdf39a54751f6b822'
RELEASE23_FIXTURE_QUALIFICATION = 'HISTORICAL_BUNDLE_FIXTURE_ONLY_NOT_CURRENT_SOURCE'
RELEASE23_FIXTURE_INPUTS = {'schema.v1.json': '14d6f9b7bae3596d615a37714257d023ab41c6ab22629a3b92a13c44c0e45b3c', 'contract.v1.json': '017635909e410d567879be077909bbccc049960f500b52a648a2af2dc1427996', 'matrix.v1.json': '3b3fd0bba1c668358326658f8a4dedeab7239ba8d0221dc01f415f506c080fe3', 'precedence.v1.json': '330804dfc5d3e83c5f7da83aeb53a003b3d68c2cecc8935afc9edd1cbc7a5ec8', 'roadmap.v1.json': '35ea2bdb913ec62127765108c0e4484a2b9e78914b7f073a20040f8fc3a4d0da', 'history-crosswalk.v1.json': '2a4018895dc74fda87b265df22ff9aee2468a8ab49de41f39186bc42614563f3', 'historical/roadmap_47.json': '7b6c4772e891babd310b40c421d036c91a51b340b5485448e7aa99d1b499fb39', 'historical/adr_registry_51.json': '2f910cf0cd0c473474141ff81bb7d639f2fba8bc10dc306b52243d5e52b215c1'}
RELEASE23_FIXTURE_ERROR_CODES = {'MATRIX_COUNTS', 'LEGACY_GUARD', 'GATE_IDENTITIES', 'SCHEMA_UNSUPPORTED:', 'P_ALIAS:', 'SCHEMA_ENUM:', 'PRODUCT_AUTHORITY', 'R23_FIXTURE_SCHEMA', 'R23_FIXTURE_ARGUMENT', 'FINITE_IDS:', 'J_REGISTRY:', 'BASE_BLOB_SHA256:', 'PRIORITY_NOT_J05_ADMISSION', 'PRECEDENCE_NOTICE:', 'ROW_QUALIFIED_OWNERS:', 'PRECEDENCE_SAFETY', 'HISTORICAL_DEPS:', 'J01_SINGLE_SCAN_GATES', 'J01_G4_CHANGE_GATE', 'AUTHENTIC_HISTORY:', 'BASE_TREE', 'SCHEMA_DUPLICATE:', 'F09_DIARY', 'DAG_NOT_ISSUANCE:', 'SCHEMA_MIN_ITEMS:', 'HISTORICAL_STATUS:', 'SOURCE_ABSENT:', 'F09_NOT_F18', 'SCHEMA_REQUIRED:', 'PRECEDENCE_PROPOSAL', 'R23_FIXTURE_SOURCE', 'R23_PUBLIC_BOUND', 'ZERO_SPEND', 'MATRIX65_IDENTITIES', 'DAG38_EXACT_OWNERS', 'F_ALIAS:', 'J_ROW_GATES:', 'DAG_ROW_OWNER:', 'R23_FIXTURE_CHANGED', 'SCHEMA_MIN_LENGTH:', 'NO_STUB_GREEN:', 'SOURCE_MATURITY:', 'DAG_CYCLE:', 'CONTRACT_BASE', 'CONTRACT_VERSION', 'JSON_NONFINITE:', 'DAG_EDGE:', 'SCHEMA_UNKNOWN_KEY:', 'SOURCE_PATH', 'DAG_OPERATIONAL_GATES:', 'HISTORICAL_COUNT:', 'SAFE_OFFER', 'NO_ADMISSION', 'GATE_OWNER:', 'HISTORICAL_RECORD:', 'COMMIT_SCOPE:', 'HISTORY_AUTHORITY', 'PROTECTED_WITNESS_OMITTED', 'REGULAR_PATH:', 'UNTRACKED_SCOPE:', 'DAG_GATE:', 'C_ALIAS:', 'WORKING_SCOPE:', 'LEGACY_DOC_BYTES:', 'SCHEMA_MAX_ITEMS:', 'SCHEMA_CONST:', 'R23_FIXTURE_CANONICAL_INPUT', 'M103_TO_M2', 'PRECEDENCE_ORDER', 'LEGACY_CONSUMERS', 'SOURCE_SHA256:', 'NO_SELF_ACCEPTANCE', 'PRECEDENCE_LIMIT', 'HISTORICAL_NODE:', 'R23_FIXTURE_GIT_IDENTITY', 'ROW_GATES:', 'R23_PUBLIC_FILE', 'NO_FAKE_CUTOVER', 'SOURCE_IDENTITY:', 'J01_INTAKE', 'ROW_STATUS:', 'LEDGER_CUSTODY', 'J01_NO_CLAIMS', 'R23_PUBLIC_PATH', 'HISTORY_NO_ACCEPTANCE', 'ROW_REQUIRED_GATE:', 'R23_PUBLIC_READ_INCOMPLETE', 'JSON_DUPLICATE_KEY:', 'R23_FIXTURE_READ_SCOPE', 'R23_PUBLIC_CHANGED', 'R23_FIXTURE_SCOPE', 'SCHEMA_TYPE:', 'HISTORICAL_IDENTITIES:', 'ROW_TRACEABILITY:', 'SCHEMA_DIALECT', 'ROW_OVERLAP:', 'GATE_CLOSED:', 'DAG_IDENTITIES', 'SOURCE_MODE:', 'ROW_EVIDENCE:', 'HISTORICAL_PROVENANCE:', 'DAG_UNKNOWN_NODE:', 'PLATFORM_TERRITORY', 'J01_DAG', 'R23_FIXTURE_INCOMPLETE'}


def regular23(path, limit=128*1024*1024):
    """Read a single public current-path input with a stable, bounded identity."""
    require(isinstance(path, Path) and path.is_absolute() and type(limit) is int and
        0 <= limit <= 128*1024*1024, 'R23_PUBLIC_BOUND')
    def identity(info, comparable=False):
        # Windows path/handle APIs expose different ctime domains in CPython3.12.
        # Keep raw ctime for same-domain stability; birthtime only joins the domains.
        stamp = getattr(info, 'st_birthtime_ns', info.st_ctime_ns) if comparable and os.name == 'nt' else info.st_ctime_ns
        mode = info.st_mode & ~0o111 if os.name == 'nt' else info.st_mode
        return (info.st_dev, info.st_ino, mode, info.st_nlink, info.st_size,
            info.st_mtime_ns, stamp)
    try:
        ancestors = []
        for parent in path.parents:
            info = parent.lstat()
            require(stat.S_ISDIR(info.st_mode) and not stat.S_ISLNK(info.st_mode) and
                not getattr(info, 'st_file_attributes', 0) & 1024, 'R23_PUBLIC_PATH')
            ancestors.append((parent, info.st_dev, info.st_ino, info.st_mode))
        before = path.lstat()
        require(stat.S_ISREG(before.st_mode) and not stat.S_ISLNK(before.st_mode) and
            before.st_nlink == 1 and not getattr(before, 'st_file_attributes', 0) & 1024,
            'R23_PUBLIC_FILE')
        require(before.st_size <= limit, 'R23_PUBLIC_BOUND')
        descriptor = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_BINARY', 0))
        try:
            opened = os.fstat(descriptor)
            require(identity(opened, comparable=True) == identity(before, comparable=True), 'R23_PUBLIC_CHANGED')
            pieces = []; total = 0
            while True:
                chunk = os.read(descriptor, min(65536, limit-total+1))
                if not chunk: break
                total += len(chunk)
                require(total <= limit and total <= before.st_size, 'R23_PUBLIC_BOUND')
                pieces.append(chunk)
            after = os.fstat(descriptor)
        finally:
            os.close(descriptor)
        current = path.lstat()
        for parent, device, inode, mode in ancestors:
            info = parent.lstat()
            require((info.st_dev, info.st_ino, info.st_mode) == (device, inode, mode) and
                not getattr(info, 'st_file_attributes', 0) & 1024, 'R23_PUBLIC_PATH')
        require(identity(opened) == identity(after) and identity(before) == identity(current) and total == before.st_size,
            'R23_PUBLIC_CHANGED')
        return b''.join(pieces)
    except OSError:
        raise ValueError('R23_PUBLIC_READ_INCOMPLETE') from None


def git23(*args):
    require(not any(key.startswith('GIT_') and key not in {'GIT_PAGER', 'GIT_TERMINAL_PROMPT'} for key in os.environ), 'R23_GIT_ENV')
    return subprocess.check_output(['git', '--no-pager', '--no-replace-objects', '--no-optional-locks',
        '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', '-c', 'diff.external=',
        '-c', 'core.hooksPath=', *args], cwd=ROOT, stderr=subprocess.PIPE)


def allowed23(path):
    return isinstance(path, str) and path in RELEASE23_EXISTING | RELEASE23_NEW


def scope23_guard(existing, new):
    require(type(existing) is set and type(new) is set and not existing & new and
        all(type(path) is str for path in existing | new), 'R23_GRANT_SCHEMA')
    document = dict(existingPaths=sorted(existing), newPaths=sorted(new))
    require(sha(json.dumps(document, sort_keys=True, separators=(',', ':')).encode()) ==
        'a38feac08dd51b74b3ca26f0cf783da7a44b0016614025b34619d5970ee52e50', 'R23_AUTHENTIC_FINITE_GRANT')


def candidate23_guard(raw):
    value = json.loads(raw, object_pairs_hook=pairs,
        parse_constant=lambda _: require(False, 'R23_NONFINITE_JSON'))
    require(type(value) is dict and set(value) == {'schema', 'authority', 'status', 'base', 'tree',
        'acceptanceGranted', 'admissions', 'pr', 'inputManifestSHA256', 'scopeSHA256'} and type(value['schema']) is int and value['schema'] == 1 and
        value['authority'] == RELEASE23_AUTHORITY and value['status'] == 'SUBMITTED_REVIEW_REQUIRED' and
        value['base'] == RELEASE23_BASE and value['tree'] == RELEASE23_TREE and
        value['inputManifestSHA256'] == 'a18911e49a60663dd8b66b9d2e609235d153c4ad48d8dafc361225f341557576' and
        value['scopeSHA256'] == '9c3aa1f8cb23109cf9909dfe1a8cb094baff8beeb2ee54b54db7d6df379e86af' and
        value['acceptanceGranted'] is False and type(value['admissions']) is dict and
        set(value['admissions']) == {'G97', 'DB', 'M103', 'M2', 'J01', 'PUBLIC'} and
        all(flag is False for flag in value['admissions'].values()) and
        (value['pr'] is None or (type(value['pr']) is int and value['pr'] > 0)), 'R23_NO_ADMISSION')
    return value


def validate23_checker(raw):
    before = git23('show', RELEASE23_BASE+':scripts/release/full-app-j01/check.py')
    tail = b"if __name__ == '__main__':\n    sys.exit(main())\n"
    require(before.endswith(tail) and raw.startswith(before[:-len(tail)]) and raw.endswith(tail), 'R23_INHERITED_BYTES')
    extension = ast.parse(raw[len(before)-len(tail):-len(tail)])
    functions = {'regular23', 'git23', 'allowed23', 'candidate23_guard', 'validate23_checker', 'package23_guard',
        'tooling23_guard', 'validate23_diff', 'source23_endpoint', 'source23_history', 'evidence23_guard',
        'source23_guard', 'scope23_guard', 'fixture23_validate', 'validate23'}
    declarations = [node for node in extension.body if isinstance(node, ast.FunctionDef)]
    names = {node.name for node in declarations}
    prior = functions-{'fixture23_validate'}
    require(names in (functions,functions-{'regular23'},prior,prior-{'regular23'}) and
        len(declarations) == len(names), 'R23_FUNCTION_SCOPE')
    if names != functions:
        # Earlier source profiles are exact inputs, never a blanket missing-helper allowance.
        require(sha(raw) in {
            '3ef627dd93f086364d8df04e17261a1c1cc63a1e900df1c47e4e3a893d80fbb4',
            '1f8dcb7f4573ed4f57354d67eb38f9db60e977d200362443a37040b21d5f86c4',
            'a5f38441fa6609187353ac5603e142a72599baf8985b6e31d0986b05e2a525e6',
            'bfd2f538293c78c5a43fca8906482a45618f48d0fe1da07f45dbc6ba913827cb',
            '5385f222fb727196d47786d89aadf23647586455731d5437bcb4e8911aadfa92',
            '20b5d2dd454bca9bd3672f90caa22685b83d040acbc978d340939cf10d1bc9cc',
            'dcaa04dcf564c7c4749423416418a7b76701c9f575de302719820100674a3df6',
        }, 'R23_HISTORICAL_CHECKER')
    dispatch = set(); assigned = set()
    for node in extension.body:
        if isinstance(node, ast.FunctionDef): continue
        require(isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name), 'R23_MODULE_SCOPE')
        name = node.targets[0].id
        require(name not in assigned, 'R23_DUPLICATE_ASSIGNMENT'); assigned.add(name)
        if name in {'source_guard','validate'}:
            dispatch.add(name)
            require(isinstance(node.value, ast.Name) and node.value.id ==
                {'source_guard':'source23_guard','validate':'validate23'}[name], 'R23_DISPATCH')
        else:
            require(name.startswith('RELEASE23_'), 'R23_GLOBAL_SCOPE')
            try: ast.literal_eval(node.value)
            except (ValueError, TypeError): require(False, 'R23_GLOBAL_SIDE_EFFECT')
    require(dispatch == {'source_guard','validate'}, 'R23_DISPATCH_REQUIRED')
    values = {node.targets[0].id: ast.literal_eval(node.value) for node in extension.body
        if isinstance(node, ast.Assign) and node.targets[0].id in {'RELEASE23_EXISTING', 'RELEASE23_NEW'}}
    require(set(values) == {'RELEASE23_EXISTING', 'RELEASE23_NEW'}, 'R23_GRANT_SCHEMA')
    scope23_guard(values['RELEASE23_EXISTING'], values['RELEASE23_NEW'])


def package23_guard(path, raw):
    before_raw = git23('show', RELEASE23_BASE+':'+path)
    if path == 'scripts/postinstall.mjs':
        require(raw == before_raw, 'R23_POSTINSTALL_PRESERVATION')
        return
    before = json.loads(before_raw, object_pairs_hook=pairs)
    after = json.loads(raw, object_pairs_hook=pairs)
    require(type(after) is dict, 'R23_PACKAGE_SCHEMA')
    dependency_fields = {'dependencies', 'devDependencies', 'optionalDependencies'}
    mutable = dependency_fields | ({'scripts'} if path == 'package.json' else set())
    require({k:v for k,v in before.items() if k not in mutable} ==
        {k:v for k,v in after.items() if k not in mutable}, 'R23_PACKAGE_PURPOSE')
    for field in dependency_fields:
        old, new = before.get(field, {}), after.get(field, {})
        require(type(new) is dict and set(old) <= set(new) and
            all(type(k) is str and type(v) is str and bool(v) for k,v in new.items()), 'R23_DEPENDENCY_SCHEMA')
        for framework in ('expo', 'react-native'):
            require(old.get(framework) == new.get(framework), 'R23_FRAMEWORK_VERSION')
    if path == 'package.json':
        old, new = before.get('scripts', {}), after.get('scripts', {})
        additions = {'python -B scripts/security23/test_integration.py',
            'python -B scripts/security23/test_toolchain.py',
            'python -B scripts/security23/test_partial_results.py',
            'python -B scripts/release/full-app-j01/source_consumer23.test.py',
            'node --test scripts/phase9/ios-privacy-lock-succession23.test.mjs',
            'node --test scripts/security23/native-source.test.mjs'}
        def preserved(key, value):
            current = new.get(key)
            return current == value or (type(current) is str and current.startswith(value+' && ') and
                all(command in additions for command in current[len(value)+4:].split(' && ')))
        require(type(new) is dict and all(preserved(k, v) for k,v in old.items()) and
            all(k.startswith('security23:') and type(v) is str and bool(v) for k,v in new.items() if k not in old),
            'R23_COMMAND_PRESERVATION')


def tooling23_guard(raw):
    original = git23('show', RELEASE23_BASE+':scripts/phase9/patch-tooling-security.mjs')
    def tokens(source):
        pattern = rb"""'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|\`(?:\\.|[^\`\\])*\`|//[^\r\n]*|/\*[\s\S]*?\*/|[A-Za-z_$][A-Za-z0-9_$]*|[0-9]+|[^\s]"""
        return [token for token in re.findall(pattern, source) if not token.startswith((b'//', b'/*'))]
    start, end = original.index(b'const PROFILES = ['), original.index(b'const SCRIPT_ROOT = ')
    expected = tokens(original[start:end]); actual = tokens(raw); depth = 0; found = 0
    for index, token in enumerate(actual):
        if depth == 0 and actual[index:index+3] == [b'const', b'PROFILES', b'=']:
            require(actual[index:index+len(expected)] == expected, 'R23_HISTORICAL_BACKPORT_PROFILES')
            found += 1
        if token == b'{': depth += 1
        if token == b'}': depth -= 1
        require(depth >= 0, 'R23_TOOLING_SYNTAX')
    require(found == 1 and depth == 0, 'R23_ACTIVE_BACKPORT_PROFILES')


def validate23_diff(raw, read_after, parent=None):
    require(not any(key.startswith('GIT_') and key not in {'GIT_PAGER', 'GIT_TERMINAL_PROMPT'} for key in os.environ), 'R23_GIT_ENV')
    parent = parent or RELEASE23_BASE
    fields = raw.split(b'\0')
    require(fields[-1] == b'' and len(fields) % 2 == 1, 'R23_DIFF_SHAPE')
    identities = {}; seen = set()
    for index in range(0, len(fields)-1, 2):
        meta = fields[index].decode('ascii').split(); path = fields[index+1].decode('utf-8')
        require(len(meta) == 5 and allowed23(path) and path not in seen, 'R23_FINITE_SCOPE')
        seen.add(path); remember21(path, identities)
        oldmode, newmode, oldblob, newblob, status = meta
        require(oldmode in (':000000', ':100644') and newmode == '100644' and status in ('A', 'M') and
            all(re.fullmatch('[0-9a-f]{40}', v) for v in (oldblob, newblob)), 'R23_MODE_OR_DELETION')
        exists = subprocess.run(['git', '--no-replace-objects', 'cat-file', '-e', parent+':'+path],
            cwd=ROOT, capture_output=True).returncode == 0
        require(exists == (status == 'M') == (oldmode == ':100644'), 'R23_PARENT_PROVENANCE')
        if exists: require(oldblob == git23('rev-parse', parent+':'+path).decode().strip(), 'R23_PARENT_BLOB')
        else: require(oldblob == '0'*40, 'R23_NEW_BLOB')
        if parent == RELEASE23_BASE:
            require(exists == (path in RELEASE23_EXISTING), 'R23_CREATE_EDIT')
        data = read_after(path)
        require(newblob == '0'*40 or hashlib.sha1(('blob '+str(len(data))+'\0').encode()+data).hexdigest() == newblob,
            'R23_AFTER_BLOB')
        if path == 'scripts/release/full-app-j01/check.py': validate23_checker(data)
        if path == RELEASE23_CANDIDATE: candidate23_guard(data)
        if path in ('package.json', 'apps/mobile/package.json', 'apps/catalog-operator-console/package.json', 'scripts/postinstall.mjs'):
            package23_guard(path, data)
        if path == 'scripts/phase9/patch-tooling-security.mjs':
            tooling23_guard(data)
        if path == 'scripts/phase9/patch-tooling-security.test.mjs':
            original = git23('show', RELEASE23_BASE+':'+path)
            lines = iter(data.splitlines(keepends=True))
            require(all(any(old == new for new in lines) for old in original.splitlines(keepends=True)), 'R23_EXISTING_TOOLING_REGRESSIONS')
        if path == 'package-lock.json':
            before = json.loads(git23('show', RELEASE23_BASE+':package-lock.json'), object_pairs_hook=pairs)
            lock = json.loads(data, object_pairs_hook=pairs)
            require(type(lock) is dict and type(lock.get('lockfileVersion')) is int and
                lock['lockfileVersion'] == before['lockfileVersion'] and type(lock.get('packages')) is dict,
                'R23_LOCK_SCHEMA')
            for name, node in lock['packages'].items():
                if name.endswith('/node_modules/expo') or name.endswith('/node_modules/react-native') or name in ('node_modules/expo', 'node_modules/react-native'):
                    require(name in before['packages'] and node.get('version') == before['packages'][name].get('version'), 'R23_LOCK_FRAMEWORK')


def source23_endpoint():
    head = git23('rev-parse', 'HEAD').decode().strip()
    parents = git23('rev-list', '--parents', '-n', '1', head).decode().split()
    require(len(parents) in (2, 3), 'R23_HEAD_PARENTS')
    endpoint = head if len(parents) == 2 else parents[2]
    if len(parents) == 3 or os.environ.get('GITHUB_ACTIONS') == 'true':
        require(os.environ.get('GITHUB_EVENT_NAME') == 'pull_request' and
            os.environ.get('GITHUB_REPOSITORY') == 'TasfiqJ/onSkin' and os.environ.get('GITHUB_SHA') in (head, endpoint), 'R23_CI_CONTEXT')
        candidate = candidate23_guard(regular23(ROOT/RELEASE23_CANDIDATE)); number = candidate['pr']
        require(type(number) is int and number > 0, 'R23_CI_CONTEXT')
        event_path = Path(os.environ.get('GITHUB_EVENT_PATH', ''))
        try:
            # Keep regular23()'s complete ancestor checks, then bound the read itself.
            for component in (event_path, *event_path.parents):
                info = component.lstat()
                require(not stat.S_ISLNK(info.st_mode) and not getattr(info, 'st_file_attributes', 0) & 1024,
                    'R23_CI_EVENT_PATH')
            before = event_path.lstat()
            require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and
                0 < before.st_size <= 1024*1024, 'R23_CI_EVENT_SIZE')
            with event_path.open('rb') as stream:
                opened = os.fstat(stream.fileno()); event_raw = stream.read(1024*1024+1)
                finished = os.fstat(stream.fileno())
            after = event_path.lstat()
        except OSError:
            require(False, 'R23_CI_EVENT_PATH')
        identity = lambda value: (value.st_dev, value.st_ino, value.st_size, value.st_mtime_ns)
        require(identity(before) == identity(opened) == identity(finished) == identity(after) and
            len(event_raw) == before.st_size and len(event_raw) <= 1024*1024, 'R23_CI_EVENT_CHANGED')
        try:
            event = json.loads(event_raw, object_pairs_hook=pairs,
                parse_constant=lambda _: require(False, 'R23_NONFINITE_JSON'))
        except (ValueError, TypeError, UnicodeError):
            require(False, 'R23_CI_EVENT_JSON')
        require(type(event) is dict and type(event.get('repository')) is dict and
            type(event.get('pull_request')) is dict, 'R23_CI_EVENT')
        pr = event['pull_request']
        require(type(pr.get('base')) is dict and type(pr.get('head')) is dict and
            type(pr['head'].get('repo')) is dict, 'R23_CI_EVENT')
        require(type(event.get('number')) is int and event['number'] == number and type(pr.get('number')) is int and pr['number'] == number and
            event.get('repository', {}).get('full_name') == 'TasfiqJ/onSkin' and
            os.environ.get('GITHUB_REF') == 'refs/pull/'+str(number)+'/merge' and
            pr.get('base', {}).get('sha') == RELEASE23_BASE and pr.get('base', {}).get('ref') == 'stage/m1-security-recovery22' and
            pr.get('head', {}).get('sha') == endpoint and
            re.fullmatch(r'stage/m1-security-integration23', pr.get('head', {}).get('ref', '')) is not None and
            pr.get('head', {}).get('repo', {}).get('full_name') == 'TasfiqJ/onSkin' and pr.get('draft') is True and
            pr.get('maintainer_can_modify') is False and 'auto_merge' in pr and pr['auto_merge'] is None, 'R23_CI_EVENT')
        if len(parents) == 3:
            require(parents[1] == RELEASE23_BASE and os.environ.get('GITHUB_REF') == 'refs/pull/'+str(number)+'/merge' and
                git23('rev-parse', head+'^{tree}') == git23('rev-parse', endpoint+'^{tree}'), 'R23_CI_MERGE_TREE')
    return endpoint


def source23_history():
    scope23_guard(RELEASE23_EXISTING, RELEASE23_NEW)
    grafts = Path(git23('rev-parse', '--git-path', 'info/grafts').decode().strip())
    if not grafts.is_absolute(): grafts = ROOT/grafts
    require(not os.path.lexists(grafts) and not git23('for-each-ref', '--format=%(refname)', 'refs/replace').strip() and
        not os.environ.get('GIT_REPLACE_REF_BASE'), 'R23_HISTORY_SUBSTITUTION')
    require(git23('rev-parse', '--is-shallow-repository').strip() == b'false' and
        git23('rev-parse', RELEASE23_BASE+'^{tree}').decode().strip() == RELEASE23_TREE, 'R23_FULL_PINNED_HISTORY')
    endpoint = source23_endpoint()
    require(git23('merge-base', RELEASE23_BASE, endpoint).decode().strip() == RELEASE23_BASE, 'R23_ANCESTRY')
    previous = RELEASE23_BASE; evidence_seen = False
    for commit in git23('rev-list', '--reverse', RELEASE23_BASE+'..'+endpoint).decode().splitlines():
        require(git23('rev-list', '--parents', '-n', '1', commit).decode().split() == [commit, previous], 'R23_LINEAR_HISTORY')
        require(not evidence_seen, 'R23_AFTER_EVIDENCE_TAIL')
        validate23_diff(git23('diff', '--raw', '--no-abbrev', '--no-renames', '-z', previous, commit),
            lambda path: git23('show', commit+':'+path), previous)
        validate23_diff(git23('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE23_BASE, commit),
            lambda path: git23('show', commit+':'+path))
        paths = git23('diff', '--name-only', '--no-renames', '-z', previous, commit).decode().split('\0')[:-1]
        evidence_seen = any(p.startswith(RELEASE23_CHECKPOINT) for p in paths)
        require('ONSKIN_BRAIN_HANDOFF.txt' not in paths or evidence_seen, 'R23_HANDOFF_BEFORE_TAIL')
        previous = commit
    return endpoint


def evidence23_guard(endpoint):
    names = {p for p in git23('diff', '--name-only', '--no-renames', '-z', RELEASE23_BASE, endpoint).decode().split('\0')
        if p.startswith(RELEASE23_CHECKPOINT)}
    expected = {p for p in RELEASE23_NEW if p.startswith(RELEASE23_CHECKPOINT)}
    if not names:
        require(not (ROOT/RELEASE23_CHECKPOINT).exists(), 'R23_UNCOMMITTED_EVIDENCE')
        return
    require(names == expected, 'R23_EVIDENCE_EXACT_PATHS')
    manifest = json.loads(regular23(ROOT/(RELEASE23_CHECKPOINT+'manifest.json')), object_pairs_hook=pairs,
        parse_constant=lambda _: require(False, 'R23_NONFINITE_JSON'))
    require(type(manifest) is dict and set(manifest) == {'schema', 'authority', 'status', 'acceptanceGranted',
        'release', 'inputManifestSHA256', 'source', 'files', 'payload'} and
        type(manifest['schema']) is int and manifest['schema'] == 1 and manifest['authority'] == RELEASE23_AUTHORITY and
        manifest['status'] == 'SUBMITTED_REVIEW_REQUIRED' and manifest['acceptanceGranted'] is False and
        manifest['release'] == 'NO_GO' and manifest['inputManifestSHA256'] ==
        'a18911e49a60663dd8b66b9d2e609235d153c4ad48d8dafc361225f341557576', 'R23_EVIDENCE_NO_ADMISSION')
    source = manifest['source']
    require(type(source) is dict and set(source) == {'base', 'baseTree', 'runtimeHead', 'runtimeTree', 'sourceHead', 'sourceTree'} and
        source['base'] == RELEASE23_BASE and source['baseTree'] == RELEASE23_TREE and
        all(type(v) is str and re.fullmatch('[0-9a-f]{40}', v) for v in source.values()), 'R23_EVIDENCE_SOURCE')
    require(git23('rev-parse', source['runtimeHead']+'^{tree}').decode().strip() == source['runtimeTree'] and
        git23('rev-parse', source['sourceHead']+'^{tree}').decode().strip() == source['sourceTree'] and
        git23('rev-list', '--parents', '-n', '1', source['sourceHead']).decode().split() == [source['sourceHead'], source['runtimeHead']] and
        git23('rev-list', '--parents', '-n', '1', endpoint).decode().split() == [endpoint, source['sourceHead']], 'R23_ONE_EVIDENCE_TAIL')
    require(set(git23('diff', '--name-only', '--no-renames', '-z', source['runtimeHead'], source['sourceHead']).decode().split('\0')[:-1]) ==
        RELEASE23_WORKLIST, 'R23_WORKLIST_ONLY_FREEZE')
    require(set(git23('diff', '--name-only', '--no-renames', '-z', source['sourceHead'], endpoint).decode().split('\0')[:-1]) ==
        expected | {'ONSKIN_BRAIN_HANDOFF.txt'}, 'R23_EVIDENCE_TAIL_SCOPE')
    files = manifest['files']
    require(type(files) is dict and set(files) == {'README.md', 'FINAL_REPORT.md', 'payload.zip', 'verify23.py'}, 'R23_EVIDENCE_FILES')
    actual = set()
    for path in (ROOT/RELEASE23_CHECKPOINT).iterdir():
        info = path.lstat()
        require(not stat.S_ISLNK(info.st_mode) and not getattr(info, 'st_file_attributes', 0) & 1024, 'R23_EVIDENCE_LINK')
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1, 'R23_EVIDENCE_REGULAR')
        actual.add(path.relative_to(ROOT).as_posix())
    require(actual == expected, 'R23_EVIDENCE_INVENTORY')
    for name, witness in files.items():
        raw = regular23(ROOT/(RELEASE23_CHECKPOINT+name))
        require(type(witness) is dict and set(witness) == {'bytes', 'sha256'} and type(witness['bytes']) is int and
            witness['bytes'] == len(raw) and witness['sha256'] == sha(raw), 'R23_EVIDENCE_HASH')
    require(all(regular23(ROOT/path) == git23('show', endpoint+':'+path) for path in expected | {'ONSKIN_BRAIN_HANDOFF.txt'}),
        'R23_EVIDENCE_COMMITTED_BYTES')


def source23_guard():
    endpoint = source23_history(); evidence23_guard(endpoint)
    if (ROOT/(RELEASE23_CHECKPOINT+'manifest.json')).exists():
        require(not git23('status', '--porcelain=v1', '--untracked-files=all', '-z'), 'R23_FROZEN_CHECKOUT_DIRTY')
    candidate23_guard(regular23(ROOT/RELEASE23_CANDIDATE))
    candidate23_guard(git23('show', ':'+RELEASE23_CANDIDATE))
    validate23_diff(git23('diff', '--cached', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE23_BASE), lambda p: git23('show', ':'+p))
    validate23_diff(git23('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE23_BASE), lambda p: regular23(ROOT/p))
    identities = {}; tree = {}
    for raw in git23('ls-tree', '-r', '-z', endpoint).split(b'\0'):
        if not raw: continue
        meta, name = raw.split(b'\t', 1); mode, kind, oid = meta.decode().split(); path = name.decode()
        require(kind == 'blob' and mode in ('100644', '100755'), 'R23_TREE_MODE')
        tree[path] = (mode, oid); remember21(path, identities)
    index = {}
    for raw in git23('ls-files', '--stage', '-z').split(b'\0'):
        if not raw: continue
        meta, name = raw.split(b'\t', 1); mode, oid, stage = meta.decode().split(); path = name.decode()
        require(stage == '0' and mode in ('100644', '100755') and path not in index, 'R23_INDEX_STAGE_MODE')
        index[path] = (mode, oid); remember21(path, identities)
    for raw in git23('ls-files', '-v', '-z').split(b'\0'):
        if raw: require(raw.startswith(b'H '), 'R23_INDEX_FLAGS')
    for path in git23('ls-files', '--others', '--exclude-standard', '-z').decode().split('\0'):
        if not path: continue
        require(path in RELEASE23_NEW and path not in index, 'R23_UNTRACKED_SCOPE'); remember21(path, identities); regular23(ROOT/path)
    # Full clean-source inventory/scanner coverage is independently executed by security22.
    # This guard proves finite source governance, never technical Security readiness.
    return tree


def fixture23_validate(bundle):
    """Validate actual mutant bytes against authenticated Release08 source witnesses."""
    bundle = Path(os.path.abspath(bundle))
    require(bundle.resolve() != BUNDLE.resolve() and not bundle.resolve().is_relative_to(ROOT.resolve()), 'R23_FIXTURE_SCOPE')
    require(git23('rev-parse', RELEASE23_FIXTURE_SOURCE+'^{tree}').decode().strip() == RELEASE23_FIXTURE_TREE,
        'R23_FIXTURE_SOURCE')
    checker = git23('show', RELEASE23_FIXTURE_SOURCE+':scripts/release/full-app-j01/check.py')
    require(sha(checker) == RELEASE23_FIXTURE_CHECKER_SHA256, 'R23_FIXTURE_SOURCE')
    # A changed canonical input cannot inherit this explicitly historical replay.
    canonical = {}
    for name, digest in RELEASE23_FIXTURE_INPUTS.items():
        canonical[name] = regular23(BUNDLE/name,16*1024*1024)
        require(sha(canonical[name]) == digest, 'R23_FIXTURE_CANONICAL_INPUT')
    declared_sources = set()
    def declare(value):
        if type(value) is dict:
            if type(value.get('path')) is str: declared_sources.add(value['path'])
            for child in value.values(): declare(child)
        elif type(value) is list:
            for child in value: declare(child)
    for name in FILES: declare(json.loads(canonical[name],object_pairs_hook=pairs))
    before = {name:regular23(bundle/name,16*1024*1024) for name in RELEASE23_FIXTURE_INPUTS}
    require(sha(before['schema.v1.json']) == RELEASE23_FIXTURE_INPUTS['schema.v1.json'], 'R23_FIXTURE_SCHEMA')
    fixture_paths = {bundle/name:name for name in before}
    tracked = {}
    for row in git23('ls-tree','-r','-z',RELEASE23_FIXTURE_SOURCE).split(b'\0'):
        if not row: continue
        metadata,name = row.split(b'\t',1);mode,kind,oid = metadata.decode('ascii').split()
        tracked[name.decode('utf8')] = (mode,kind,oid)
    immutable = {}
    def historical_regular(path):
        path = Path(os.path.abspath(path))
        if path in fixture_paths:
            return before[fixture_paths[path]]  # Actual mutant bytes, never an old-input substitute.
        try: name = path.relative_to(ROOT.absolute()).as_posix()
        except ValueError: raise ValueError('R23_FIXTURE_READ_SCOPE') from None
        require(name in declared_sources and name in tracked, 'R23_FIXTURE_READ_SCOPE')
        mode,kind,oid = tracked[name]
        require(kind == 'blob' and mode in ('100644','100755'), 'R23_FIXTURE_GIT_IDENTITY')
        if oid not in immutable:
            data = git23('cat-file','blob',oid)
            require(hashlib.sha1(('blob '+str(len(data))+'\0').encode()+data).hexdigest() == oid,
                'R23_FIXTURE_GIT_IDENTITY')
            immutable[oid] = data
        return immutable[oid]
    def historical_git(*args):
        if args == ('rev-parse','HEAD'): return git23('rev-parse',RELEASE23_FIXTURE_SOURCE)
        if args[0] == 'rev-list':
            return git23(*[value.replace('..HEAD','..'+RELEASE23_FIXTURE_SOURCE) for value in args])
        if args[0] == 'diff' and len([value for value in args[1:] if not value.startswith('-')]) == 1:
            return git23(*[value for value in args if value != '--cached'],RELEASE23_FIXTURE_SOURCE)
        if args[0] == 'show':
            require(len(args) == 2 and ':' in args[1] and args[1].split(':',1)[1] in declared_sources,
                'R23_FIXTURE_READ_SCOPE')
            return git23('show',RELEASE23_FIXTURE_SOURCE+args[1]) if args[1].startswith(':') else git23(*args)
        if args[0] == 'ls-files':
            if '--others' in args: return b''
            if '-v' in args: return b''.join(b'H '+name.encode()+b'\0' for name in tracked)
            if '--stage' in args:
                return b''.join((mode+' '+oid+' 0\t'+name).encode()+b'\0'
                    for name,(mode,kind,oid) in tracked.items())
        if args[0] == 'status': return b''
        return git23(*args)
    namespace = {'__name__':'release08_explicit_bundle_fixture',
        '__file__':str(ROOT/'scripts/release/full-app-j01/check.py')}
    exec(compile(checker,'authenticated-release08-fixture-checker','exec'),namespace)
    namespace['git'],namespace['regular'] = historical_git,historical_regular
    declared_sources.update(namespace['SAFE_DOCS'])
    declared_sources.update('docs/brain/state/'+row[3] for row in namespace['SNAPSHOTS'].values())
    # ROOT stays current. Only immutable Git-backed source-witness reads use the old source.
    require(namespace['ROOT'] == ROOT and namespace['BUNDLE'] == BUNDLE, 'R23_FIXTURE_SOURCE')
    try: result = namespace['validate'](bundle)
    finally:
        require(all(regular23(bundle/name,16*1024*1024) == data for name,data in before.items()),
            'R23_FIXTURE_CHANGED')
    result.update(qualification=RELEASE23_FIXTURE_QUALIFICATION,historical_source=RELEASE23_FIXTURE_SOURCE,
        historical_tree=RELEASE23_FIXTURE_TREE,historical_checker_sha256=RELEASE23_FIXTURE_CHECKER_SHA256,
        historical_source_witness_scope='AUTHENTIC_CANONICAL_DECLARED_PATHS_ONLY',
        current_source='NOT_CHECKED_CURRENT',current_source_governance='NOT_CHECKED_CURRENT',
        source_acceptance='NOT_CHECKED_CURRENT',acceptanceGranted=False,
        admissions=dict(G97=False,DB=False,M103=False,M2=False,J01=False,PUBLIC=False),release='NO_GO')
    return result


def validate23(bundle=BUNDLE):
    scope = ('HISTORICAL_BUNDLE_FIXTURE_ONLY_NOT_CURRENT_SOURCE;SOURCE=NOT_CHECKED_CURRENT;'
        'GOVERNANCE=NOT_CHECKED_CURRENT;ADMISSIONS=FALSE;NO_GO')
    try: current = Path(bundle).resolve() == BUNDLE.resolve()
    except Exception: raise ValueError('R23_FIXTURE_SCOPE|'+scope) from None
    if not current:
        try: return fixture23_validate(bundle)
        except Exception as error:
            code = error.args[0] if type(error) is ValueError and len(error.args)==1 and type(error.args[0]) is str else None
            code = code.split(':',1)[0]+':' if code is not None and ':' in code else code
            safe = code if code in RELEASE23_FIXTURE_ERROR_CODES else 'R23_FIXTURE_INCOMPLETE'
            raise ValueError(safe+'|'+scope) from None
    try:
        bundle = BUNDLE
        source23_guard()
        result = historical21_validate(bundle)
        result['current_source_governance'] = 'RELEASE23_FINITE_SCOPE_ONLY'
        result['inherited_release22'] = 'IMMUTABLE_PR26_DEFINITIONS; NOT_REPLAYED_BY_CURRENT_PATH'
        result['source_acceptance'] = 'SUBMITTED_REVIEW_REQUIRED'
        result['release'] = 'NO_GO'
        return result
    except Exception as error:
        # The inherited CLI keeps its semantics; the current path emits fixed codes only.
        code = error.args[0] if type(error) is ValueError and len(error.args) == 1 and type(error.args[0]) is str else None
        fixed = {
            'R23_HISTORICAL_CHECKER',
            'R23_PUBLIC_BOUND',
            'R23_PUBLIC_PATH',
            'R23_PUBLIC_FILE',
            'R23_PUBLIC_CHANGED',
            'R23_PUBLIC_READ_INCOMPLETE',
            'R23_ACTIVE_BACKPORT_PROFILES',
            'R23_AFTER_BLOB',
            'R23_AFTER_EVIDENCE_TAIL',
            'R23_ANCESTRY',
            'R23_AUTHENTIC_FINITE_GRANT',
            'R23_CI_CONTEXT',
            'R23_CI_EVENT',
            'R23_CI_EVENT_CHANGED',
            'R23_CI_EVENT_JSON',
            'R23_CI_EVENT_PATH',
            'R23_CI_EVENT_SIZE',
            'R23_CI_MERGE_TREE',
            'R23_COMMAND_PRESERVATION',
            'R23_CREATE_EDIT',
            'R23_DEPENDENCY_SCHEMA',
            'R23_DIFF_SHAPE',
            'R23_DISPATCH',
            'R23_DISPATCH_REQUIRED',
            'R23_DUPLICATE_ASSIGNMENT',
            'R23_EVIDENCE_COMMITTED_BYTES',
            'R23_EVIDENCE_EXACT_PATHS',
            'R23_EVIDENCE_FILES',
            'R23_EVIDENCE_HASH',
            'R23_EVIDENCE_INVENTORY',
            'R23_EVIDENCE_LINK',
            'R23_EVIDENCE_NO_ADMISSION',
            'R23_EVIDENCE_REGULAR',
            'R23_EVIDENCE_SOURCE',
            'R23_EVIDENCE_TAIL_SCOPE',
            'R23_EXISTING_TOOLING_REGRESSIONS',
            'R23_FINITE_SCOPE',
            'R23_FRAMEWORK_VERSION',
            'R23_FROZEN_CHECKOUT_DIRTY',
            'R23_FULL_PINNED_HISTORY',
            'R23_FUNCTION_SCOPE',
            'R23_GIT_ENV',
            'R23_GLOBAL_SCOPE',
            'R23_GLOBAL_SIDE_EFFECT',
            'R23_GRANT_SCHEMA',
            'R23_HANDOFF_BEFORE_TAIL',
            'R23_HEAD_PARENTS',
            'R23_HISTORICAL_BACKPORT_PROFILES',
            'R23_HISTORY_SUBSTITUTION',
            'R23_INDEX_FLAGS',
            'R23_INDEX_STAGE_MODE',
            'R23_INHERITED_BYTES',
            'R23_LINEAR_HISTORY',
            'R23_LOCK_FRAMEWORK',
            'R23_LOCK_SCHEMA',
            'R23_MODE_OR_DELETION',
            'R23_MODULE_SCOPE',
            'R23_NEW_BLOB',
            'R23_NONFINITE_JSON',
            'R23_NO_ADMISSION',
            'R23_ONE_EVIDENCE_TAIL',
            'R23_PACKAGE_PURPOSE',
            'R23_PACKAGE_SCHEMA',
            'R23_PARENT_BLOB',
            'R23_PARENT_PROVENANCE',
            'R23_POSTINSTALL_PRESERVATION',
            'R23_TOOLING_SYNTAX',
            'R23_TREE_MODE',
            'R23_UNCOMMITTED_EVIDENCE',
            'R23_UNTRACKED_SCOPE',
            'R23_WORKLIST_ONLY_FREEZE',
        }
        # Preserve original semantic refusal meanings without reflecting dynamic suffixes.
        legacy = set((
            'AUTHENTIC_HISTORY: BASE_BLOB_SHA256: BASE_TREE CONTRACT_BASE CONTRACT_VERSION C_ALIAS: '
            'DAG38_EXACT_OWNERS DAG_CYCLE: DAG_EDGE: DAG_GATE: DAG_IDENTITIES DAG_NOT_ISSUANCE: '
            'DAG_OPERATIONAL_GATES: DAG_ROW_OWNER: DAG_UNKNOWN_NODE: F09_DIARY F09_NOT_F18 FINITE_IDS: F_ALIAS: '
            'GATE_CLOSED: GATE_IDENTITIES GATE_OWNER: HISTORICAL_COUNT: HISTORICAL_DEPS: HISTORICAL_IDENTITIES: '
            'HISTORICAL_NODE: HISTORICAL_PROVENANCE: HISTORICAL_RECORD: HISTORICAL_STATUS: HISTORY_AUTHORITY '
            'HISTORY_NO_ACCEPTANCE J01_DAG J01_G4_CHANGE_GATE J01_INTAKE J01_NO_CLAIMS J01_SINGLE_SCAN_GATES '
            'JSON_DUPLICATE_KEY: JSON_NONFINITE: J_REGISTRY: J_ROW_GATES: LEDGER_CUSTODY LEGACY_CONSUMERS '
            'LEGACY_DOC_BYTES: LEGACY_GUARD M103_TO_M2 MATRIX65_IDENTITIES MATRIX_COUNTS NO_ADMISSION '
            'NO_FAKE_CUTOVER NO_SELF_ACCEPTANCE NO_STUB_GREEN: PLATFORM_TERRITORY PRECEDENCE_LIMIT '
            'PRECEDENCE_NOTICE: PRECEDENCE_ORDER PRECEDENCE_PROPOSAL PRECEDENCE_SAFETY PRIORITY_NOT_J05_ADMISSION '
            'PRODUCT_AUTHORITY PROTECTED_WITNESS_OMITTED P_ALIAS: REGULAR_PATH: ROW_EVIDENCE: ROW_GATES: '
            'ROW_OVERLAP: ROW_QUALIFIED_OWNERS: ROW_REQUIRED_GATE: ROW_STATUS: ROW_TRACEABILITY: SAFE_OFFER '
            'SCHEMA_CONST: SCHEMA_DIALECT SCHEMA_DUPLICATE: SCHEMA_ENUM: SCHEMA_MAX_ITEMS: SCHEMA_MIN_ITEMS: '
            'SCHEMA_MIN_LENGTH: SCHEMA_REQUIRED: SCHEMA_TYPE: SCHEMA_UNKNOWN_KEY: SCHEMA_UNSUPPORTED: '
            'SOURCE_ABSENT: SOURCE_IDENTITY: SOURCE_MATURITY: SOURCE_MODE: SOURCE_PATH SOURCE_SHA256: '
            'UNTRACKED_SCOPE: WORKING_SCOPE: ZERO_SPEND '
        ).split())
        prefix = code.split(':', 1)[0] + ':' if code is not None and ':' in code else code
        safe = code if code in fixed else prefix if prefix in legacy else 'R23_EXECUTION_INCOMPLETE'
        raise ValueError(safe) from None



source_guard = source23_guard
validate = validate23


# Release24 successor. Every inherited Release08-23 byte above is immutable.
RELEASE24_BASE = '5976394fd39f41550bde8107b9cc27c758b7ce14'
RELEASE24_TREE = '63a896fad61d85a51b0d1e9a23020ba02d169c9e'
RELEASE24_AUTHORITY = 'BRAIN-M1X-SECURITY-DEPENDENCY-DB24-CANDIDATE-01'
RELEASE24_CANDIDATE = 'docs/brain/contracts/M1X-24/candidate24.json'
RELEASE24_CHECKPOINT = 'docs/brain/checkpoints/M1-03/SECURITY-DEPENDENCY-DB24/'
RELEASE24_WORKLIST = {'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md'}
RELEASE24_EXISTING = {
    '.github/workflows/quality.yml',
    '.github/workflows/security-candidate22.yml',
    'ONSKIN_BRAIN_HANDOFF.txt',
    'apps/catalog-operator-console/package.json',
    'apps/mobile/package.json',
    'docs/phase-4/generated/source-worklist.json',
    'docs/phase-4/generated/source-worklist.md',
    'package-lock.json',
    'package.json',
    'scripts/phase2/local-supabase-reset.mjs',
    'scripts/phase5/check-native-config.mjs',
    'scripts/phase5/ios-extension-contract.mjs',
    'scripts/phase9/ios-privacy-contract.mjs',
    'scripts/phase9/ios-privacy-source-audit.mjs',
    'scripts/phase9/ios-privacy-source-audit.test.mjs',
    'scripts/phase9/patch-tooling-security.mjs',
    'scripts/phase9/patch-tooling-security.test.mjs',
    'scripts/phase9/tooling-security-vulnerabilities.test.mjs',
    'scripts/postinstall.mjs',
    'scripts/release/full-app-j01/check.py',
    'scripts/security22/README.md',
    'scripts/security22/backports.json',
    'scripts/security22/dependency.mjs',
    'scripts/security22/dependency.test.mjs',
    'scripts/security22/evaluate.py',
    'scripts/security22/patch-tooling.mjs',
    'scripts/security22/patch-tooling.test.mjs',
    'scripts/security22/policy.json',
    'scripts/security22/run.py',
    'scripts/security22/toolchain.json',
    'scripts/security22/toolchain.py',
}
RELEASE24_NEW = {
    'docs/brain/checkpoints/M1-03/SECURITY-DEPENDENCY-DB24/FINAL_REPORT.md',
    'docs/brain/checkpoints/M1-03/SECURITY-DEPENDENCY-DB24/README.md',
    'docs/brain/checkpoints/M1-03/SECURITY-DEPENDENCY-DB24/manifest.json',
    'docs/brain/checkpoints/M1-03/SECURITY-DEPENDENCY-DB24/payload.zip',
    'docs/brain/checkpoints/M1-03/SECURITY-DEPENDENCY-DB24/verify24.py',
    'docs/brain/contracts/M1X-24/candidate24.json',
    'docs/brain/task-specs/M1X-24/TASK.md',
    'docs/security/security24/advisories.md',
    'docs/security/security24/blockers.md',
    'docs/security/security24/canonical-db24.md',
    'docs/security/security24/validation.md',
    'scripts/phase2/canonical-postgres-mirror24.mjs',
    'scripts/phase2/canonical-postgres-mirror24.test.mjs',
    'scripts/release/full-app-j01/source_consumer24.test.py',
    'scripts/security24/advisory-behavior.test.mjs',
    'scripts/security24/backports.json',
    'scripts/security24/graph.mjs',
    'scripts/security24/patch-tooling.mjs',
    'scripts/security24/patch-tooling.test.mjs',
    'scripts/security24/probe.mjs',
    'scripts/security24/test_packet24.py',
}


def allowed24(path):
    return isinstance(path, str) and path in RELEASE24_EXISTING | RELEASE24_NEW



def scope24_guard(existing, new):
    require(type(existing) is set and type(new) is set and not existing & new and
        all(type(path) is str for path in existing | new), 'R24_GRANT_SCHEMA')
    document = dict(existingPaths=sorted(existing), newPaths=sorted(new))
    require(sha(json.dumps(document, sort_keys=True, separators=(',', ':')).encode()) ==
        '11396a690c00c30e083ab4507970e7fb8ae4253e88f757ec4b5f211c3ec4f753', 'R24_AUTHENTIC_FINITE_GRANT')



def candidate24_guard(raw):
    value = json.loads(raw, object_pairs_hook=pairs,
        parse_constant=lambda _: require(False, 'R24_NONFINITE_JSON'))
    require(type(value) is dict and set(value) == {'schema', 'authority', 'status', 'base', 'tree',
        'acceptanceGranted', 'admissions', 'pr', 'inputManifestSHA256', 'scopeSHA256'} and type(value['schema']) is int and value['schema'] == 1 and
        value['authority'] == RELEASE24_AUTHORITY and value['status'] == 'SUBMITTED_REVIEW_REQUIRED' and
        value['base'] == RELEASE24_BASE and value['tree'] == RELEASE24_TREE and
        value['inputManifestSHA256'] == '4ad7e101bd0d6d47613a956c7958a3148d143f12dd333e40652e910ea8573298' and
        value['scopeSHA256'] == '11396a690c00c30e083ab4507970e7fb8ae4253e88f757ec4b5f211c3ec4f753' and
        value['acceptanceGranted'] is False and type(value['admissions']) is dict and
        set(value['admissions']) == {'G97', 'DB', 'M103', 'M2', 'J01', 'PUBLIC'} and
        all(flag is False for flag in value['admissions'].values()) and
        (value['pr'] is None or (type(value['pr']) is int and value['pr'] > 0)), 'R24_NO_ADMISSION')
    return value



def validate24_checker(raw):
    before = git23('show', RELEASE24_BASE+':scripts/release/full-app-j01/check.py')
    terminal = b"if __name__ == '__main__':\n    sys.exit(main())\n"
    require(before.endswith(terminal) and raw.startswith(before[:-len(terminal)]) and
        raw.endswith(terminal), 'R24_INHERITED_BYTES')
    extension = ast.parse(raw[len(before)-len(terminal):-len(terminal)])
    functions = {'allowed24', 'scope24_guard', 'candidate24_guard', 'validate24_checker',
        'package24_guard', 'quality24_guard', 'validate24_diff', 'source24_endpoint',
        'source24_history', 'evidence24_guard', 'source24_guard', 'validate24'}
    declarations = [node for node in extension.body if isinstance(node, ast.FunctionDef)]
    require({node.name for node in declarations} == functions and len(declarations) == len(functions),
        'R24_FUNCTION_SCOPE')
    dispatch = set(); assigned = set()
    for node in extension.body:
        if isinstance(node, ast.FunctionDef): continue
        require(isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name),
            'R24_MODULE_SCOPE')
        name = node.targets[0].id
        require(name not in assigned, 'R24_DUPLICATE_ASSIGNMENT'); assigned.add(name)
        if name in {'source_guard', 'validate'}:
            dispatch.add(name)
            require(isinstance(node.value, ast.Name) and node.value.id ==
                {'source_guard':'source24_guard', 'validate':'validate24'}[name], 'R24_DISPATCH')
        else:
            require(name.startswith('RELEASE24_'), 'R24_GLOBAL_SCOPE')
            try: ast.literal_eval(node.value)
            except (ValueError, TypeError): require(False, 'R24_GLOBAL_SIDE_EFFECT')
    require(dispatch == {'source_guard', 'validate'}, 'R24_DISPATCH_REQUIRED')
    values = {node.targets[0].id: ast.literal_eval(node.value) for node in extension.body
        if isinstance(node, ast.Assign) and node.targets[0].id in {'RELEASE24_EXISTING', 'RELEASE24_NEW'}}
    require(set(values) == {'RELEASE24_EXISTING', 'RELEASE24_NEW'}, 'R24_GRANT_SCHEMA')
    scope24_guard(values['RELEASE24_EXISTING'], values['RELEASE24_NEW'])


def package24_guard(path, raw):
    before_raw = git23('show', RELEASE24_BASE+':'+path)
    if path == 'scripts/postinstall.mjs':
        expected = before_raw.replace(
            b"import { patchToolingSecurity22 } from './security22/patch-tooling.mjs';\n",
            b"import { patchToolingSecurity22 } from './security22/patch-tooling.mjs';\n"
            b"import { patchToolingSecurity24 } from './security24/patch-tooling.mjs';\n").replace(
            b'const toolingSecurity22 = patchToolingSecurity22({ root, check });\n',
            b'const toolingSecurity22 = patchToolingSecurity22({ root, check });\n'
            b'const toolingSecurity24 = patchToolingSecurity24({ root, check });\n')
        require(raw in (before_raw, expected), 'R24_POSTINSTALL_PRESERVATION')
        return
    before = json.loads(before_raw, object_pairs_hook=pairs)
    after = json.loads(raw, object_pairs_hook=pairs)
    require(type(after) is dict, 'R24_PACKAGE_SCHEMA')
    dependency_fields = {'dependencies', 'devDependencies', 'optionalDependencies'}
    mutable = dependency_fields | ({'scripts'} if path == 'package.json' else set())
    require({k:v for k,v in before.items() if k not in mutable} ==
        {k:v for k,v in after.items() if k not in mutable}, 'R24_PACKAGE_PURPOSE')
    for field in dependency_fields:
        old, new = before.get(field, {}), after.get(field, {})
        require(type(new) is dict and set(old) <= set(new) and
            all(type(k) is str and type(v) is str and bool(v) for k,v in new.items()), 'R24_DEPENDENCY_SCHEMA')
        for framework in ('expo', 'react-native'):
            require(old.get(framework) == new.get(framework), 'R24_FRAMEWORK_VERSION')
    if path == 'package.json':
        old, new = before.get('scripts', {}), after.get('scripts', {})
        additions = {'python -B scripts/release/full-app-j01/source_consumer24.test.py',
            'python -B scripts/security24/test_packet24.py',
            'node --test scripts/security24/advisory-behavior.test.mjs',
            'node --test scripts/security24/patch-tooling.test.mjs',
            'node --test scripts/phase2/canonical-postgres-mirror24.test.mjs'}
        def preserved(key, value):
            current = new.get(key)
            return current == value or (type(current) is str and current.startswith(value+' && ') and
                all(command in additions for command in current[len(value)+4:].split(' && ')))
        require(type(new) is dict and all(preserved(k, v) for k,v in old.items()) and
            all(k.startswith('security23:') and type(v) is str and bool(v) for k,v in new.items() if k not in old),
            'R24_COMMAND_PRESERVATION')



def quality24_guard(raw):
    original = git23('show', RELEASE24_BASE+':.github/workflows/quality.yml')
    anchor = b'      - name: Check local-only database contract\n'
    addition = (b'      - name: Verify canonical postgres mirror24 bootstrap controls\n'
        b'        run: node --test scripts/phase2/canonical-postgres-mirror24.test.mjs\n\n')
    require(original.count(anchor) == 1 and raw in (original, original.replace(anchor, addition+anchor)),
        'R24_QUALITY_GATE_PRESERVATION')


def validate24_diff(raw, read_after, parent=None):
    require(not any(key.startswith('GIT_') and key not in {'GIT_PAGER', 'GIT_TERMINAL_PROMPT'} for key in os.environ), 'R24_GIT_ENV')
    parent = parent or RELEASE24_BASE
    fields = raw.split(b'\0')
    require(fields[-1] == b'' and len(fields) % 2 == 1, 'R24_DIFF_SHAPE')
    identities = {}; seen = set()
    for index in range(0, len(fields)-1, 2):
        meta = fields[index].decode('ascii').split(); path = fields[index+1].decode('utf-8')
        require(len(meta) == 5 and allowed24(path) and path not in seen, 'R24_FINITE_SCOPE')
        seen.add(path); remember21(path, identities)
        oldmode, newmode, oldblob, newblob, status = meta
        require(oldmode in (':000000', ':100644') and newmode == '100644' and status in ('A', 'M') and
            all(re.fullmatch('[0-9a-f]{40}', v) for v in (oldblob, newblob)), 'R24_MODE_OR_DELETION')
        exists = subprocess.run(['git', '--no-replace-objects', 'cat-file', '-e', parent+':'+path],
            cwd=ROOT, capture_output=True).returncode == 0
        require(exists == (status == 'M') == (oldmode == ':100644'), 'R24_PARENT_PROVENANCE')
        if exists: require(oldblob == git23('rev-parse', parent+':'+path).decode().strip(), 'R24_PARENT_BLOB')
        else: require(oldblob == '0'*40, 'R24_NEW_BLOB')
        if parent == RELEASE24_BASE:
            require(exists == (path in RELEASE24_EXISTING), 'R24_CREATE_EDIT')
        data = read_after(path)
        require(newblob == '0'*40 or hashlib.sha1(('blob '+str(len(data))+'\0').encode()+data).hexdigest() == newblob,
            'R24_AFTER_BLOB')
        if path == 'scripts/release/full-app-j01/check.py': validate24_checker(data)
        if path == RELEASE24_CANDIDATE: candidate24_guard(data)
        if path in ('package.json', 'apps/mobile/package.json', 'apps/catalog-operator-console/package.json', 'scripts/postinstall.mjs'):
            package24_guard(path, data)
        if path == 'scripts/phase9/patch-tooling-security.mjs':
            tooling23_guard(data)
        if path in ('scripts/phase9/patch-tooling-security.test.mjs',
            'scripts/phase9/tooling-security-vulnerabilities.test.mjs', 'scripts/security22/patch-tooling.test.mjs',
            'scripts/security22/dependency.test.mjs', 'scripts/phase9/ios-privacy-source-audit.test.mjs'):
            original = git23('show', RELEASE24_BASE+':'+path)
            lines = iter(data.splitlines(keepends=True))
            require(all(any(old == new for new in lines) for old in original.splitlines(keepends=True)), 'R24_EXISTING_TOOLING_REGRESSIONS')
        if path == '.github/workflows/quality.yml': quality24_guard(data)
        if path == 'package-lock.json':
            before = json.loads(git23('show', RELEASE24_BASE+':package-lock.json'), object_pairs_hook=pairs)
            lock = json.loads(data, object_pairs_hook=pairs)
            require(type(lock) is dict and type(lock.get('lockfileVersion')) is int and
                lock['lockfileVersion'] == before['lockfileVersion'] and type(lock.get('packages')) is dict,
                'R24_LOCK_SCHEMA')
            for name, node in lock['packages'].items():
                if name.endswith('/node_modules/expo') or name.endswith('/node_modules/react-native') or name in ('node_modules/expo', 'node_modules/react-native'):
                    require(name in before['packages'] and node.get('version') == before['packages'][name].get('version'), 'R24_LOCK_FRAMEWORK')



def source24_endpoint():
    head = git23('rev-parse', 'HEAD').decode().strip()
    parents = git23('rev-list', '--parents', '-n', '1', head).decode().split()
    require(len(parents) in (2, 3), 'R24_HEAD_PARENTS')
    endpoint = head if len(parents) == 2 else parents[2]
    if len(parents) == 3 or os.environ.get('GITHUB_ACTIONS') == 'true':
        require(os.environ.get('GITHUB_EVENT_NAME') == 'pull_request' and
            os.environ.get('GITHUB_REPOSITORY') == 'TasfiqJ/onSkin' and os.environ.get('GITHUB_SHA') in (head, endpoint), 'R24_CI_CONTEXT')
        candidate = candidate24_guard(regular23(ROOT/RELEASE24_CANDIDATE)); number = candidate['pr']
        require(type(number) is int and number > 0, 'R24_CI_CONTEXT')
        event_path = Path(os.environ.get('GITHUB_EVENT_PATH', ''))
        try:
            # Keep regular23()'s complete ancestor checks, then bound the read itself.
            for component in (event_path, *event_path.parents):
                info = component.lstat()
                require(not stat.S_ISLNK(info.st_mode) and not getattr(info, 'st_file_attributes', 0) & 1024,
                    'R24_CI_EVENT_PATH')
            before = event_path.lstat()
            require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and
                0 < before.st_size <= 1024*1024, 'R24_CI_EVENT_SIZE')
            with event_path.open('rb') as stream:
                opened = os.fstat(stream.fileno()); event_raw = stream.read(1024*1024+1)
                finished = os.fstat(stream.fileno())
            after = event_path.lstat()
        except OSError:
            require(False, 'R24_CI_EVENT_PATH')
        identity = lambda value: (value.st_dev, value.st_ino, value.st_size, value.st_mtime_ns)
        require(identity(before) == identity(opened) == identity(finished) == identity(after) and
            len(event_raw) == before.st_size and len(event_raw) <= 1024*1024, 'R24_CI_EVENT_CHANGED')
        try:
            event = json.loads(event_raw, object_pairs_hook=pairs,
                parse_constant=lambda _: require(False, 'R24_NONFINITE_JSON'))
        except (ValueError, TypeError, UnicodeError):
            require(False, 'R24_CI_EVENT_JSON')
        require(type(event) is dict and type(event.get('repository')) is dict and
            type(event.get('pull_request')) is dict, 'R24_CI_EVENT')
        pr = event['pull_request']
        require(type(pr.get('base')) is dict and type(pr.get('head')) is dict and
            type(pr['head'].get('repo')) is dict, 'R24_CI_EVENT')
        require(type(event.get('number')) is int and event['number'] == number and type(pr.get('number')) is int and pr['number'] == number and
            event.get('repository', {}).get('full_name') == 'TasfiqJ/onSkin' and
            os.environ.get('GITHUB_REF') == 'refs/pull/'+str(number)+'/merge' and
            pr.get('base', {}).get('sha') == RELEASE24_BASE and pr.get('base', {}).get('ref') == 'stage/m1-security-integration23' and
            pr.get('head', {}).get('sha') == endpoint and
            re.fullmatch(r'stage/m1-security-dependency-db24', pr.get('head', {}).get('ref', '')) is not None and
            pr.get('head', {}).get('repo', {}).get('full_name') == 'TasfiqJ/onSkin' and pr.get('draft') is True and
            pr.get('maintainer_can_modify') is False and 'auto_merge' in pr and pr['auto_merge'] is None, 'R24_CI_EVENT')
        if len(parents) == 3:
            require(parents[1] == RELEASE24_BASE and os.environ.get('GITHUB_REF') == 'refs/pull/'+str(number)+'/merge' and
                git23('rev-parse', head+'^{tree}') == git23('rev-parse', endpoint+'^{tree}'), 'R24_CI_MERGE_TREE')
    return endpoint



def source24_history():
    scope24_guard(RELEASE24_EXISTING, RELEASE24_NEW)
    grafts = Path(git23('rev-parse', '--git-path', 'info/grafts').decode().strip())
    if not grafts.is_absolute(): grafts = ROOT/grafts
    require(not os.path.lexists(grafts) and not git23('for-each-ref', '--format=%(refname)', 'refs/replace').strip() and
        not os.environ.get('GIT_REPLACE_REF_BASE'), 'R24_HISTORY_SUBSTITUTION')
    require(git23('rev-parse', '--is-shallow-repository').strip() == b'false' and
        git23('rev-parse', RELEASE24_BASE+'^{tree}').decode().strip() == RELEASE24_TREE, 'R24_FULL_PINNED_HISTORY')
    endpoint = source24_endpoint()
    require(git23('merge-base', RELEASE24_BASE, endpoint).decode().strip() == RELEASE24_BASE, 'R24_ANCESTRY')
    previous = RELEASE24_BASE; frozen = evidence_seen = False
    for commit in git23('rev-list', '--reverse', RELEASE24_BASE+'..'+endpoint).decode().splitlines():
        require(git23('rev-list', '--parents', '-n', '1', commit).decode().split() == [commit, previous], 'R24_LINEAR_HISTORY')
        require(not evidence_seen, 'R24_AFTER_EVIDENCE_TAIL')
        validate24_diff(git23('diff', '--raw', '--no-abbrev', '--no-renames', '-z', previous, commit),
            lambda path: git23('show', commit+':'+path), previous)
        validate24_diff(git23('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE24_BASE, commit),
            lambda path: git23('show', commit+':'+path))
        paths = set(git23('diff', '--name-only', '--no-renames', '-z', previous, commit).decode().split('\0')[:-1])
        evidence_seen = any(p.startswith(RELEASE24_CHECKPOINT) for p in paths)
        require('ONSKIN_BRAIN_HANDOFF.txt' not in paths or evidence_seen, 'R24_HANDOFF_BEFORE_TAIL')
        if evidence_seen:
            expected = {p for p in RELEASE24_NEW if p.startswith(RELEASE24_CHECKPOINT)}
            require(frozen and paths == expected | {'ONSKIN_BRAIN_HANDOFF.txt'}, 'R24_EVIDENCE_TAIL_SCOPE')
        elif paths & RELEASE24_WORKLIST:
            require(not frozen and paths == RELEASE24_WORKLIST, 'R24_WORKLIST_ONLY_FREEZE')
            frozen = True
        else:
            require(not frozen, 'R24_SOURCE_AFTER_FREEZE')
        previous = commit
    return endpoint


def evidence24_guard(endpoint):
    names = {p for p in git23('diff', '--name-only', '--no-renames', '-z', RELEASE24_BASE, endpoint).decode().split('\0')
        if p.startswith(RELEASE24_CHECKPOINT)}
    expected = {p for p in RELEASE24_NEW if p.startswith(RELEASE24_CHECKPOINT)}
    if not names:
        require(not (ROOT/RELEASE24_CHECKPOINT).exists(), 'R24_UNCOMMITTED_EVIDENCE')
        return
    require(names == expected, 'R24_EVIDENCE_EXACT_PATHS')
    manifest = json.loads(regular23(ROOT/(RELEASE24_CHECKPOINT+'manifest.json')), object_pairs_hook=pairs,
        parse_constant=lambda _: require(False, 'R24_NONFINITE_JSON'))
    require(type(manifest) is dict and set(manifest) == {'schema', 'authority', 'status', 'acceptanceGranted',
        'release', 'inputManifestSHA256', 'source', 'files', 'payload'} and
        type(manifest['schema']) is int and manifest['schema'] == 1 and manifest['authority'] == RELEASE24_AUTHORITY and
        manifest['status'] == 'SUBMITTED_REVIEW_REQUIRED' and manifest['acceptanceGranted'] is False and
        manifest['release'] == 'NO_GO' and manifest['inputManifestSHA256'] ==
        '4ad7e101bd0d6d47613a956c7958a3148d143f12dd333e40652e910ea8573298', 'R24_EVIDENCE_NO_ADMISSION')
    source = manifest['source']
    require(type(source) is dict and set(source) == {'base', 'baseTree', 'runtimeHead', 'runtimeTree', 'sourceHead', 'sourceTree'} and
        source['base'] == RELEASE24_BASE and source['baseTree'] == RELEASE24_TREE and
        all(type(v) is str and re.fullmatch('[0-9a-f]{40}', v) for v in source.values()), 'R24_EVIDENCE_SOURCE')
    require(git23('rev-parse', source['runtimeHead']+'^{tree}').decode().strip() == source['runtimeTree'] and
        git23('rev-parse', source['sourceHead']+'^{tree}').decode().strip() == source['sourceTree'] and
        git23('rev-list', '--parents', '-n', '1', source['sourceHead']).decode().split() == [source['sourceHead'], source['runtimeHead']] and
        git23('rev-list', '--parents', '-n', '1', endpoint).decode().split() == [endpoint, source['sourceHead']], 'R24_ONE_EVIDENCE_TAIL')
    require(set(git23('diff', '--name-only', '--no-renames', '-z', source['runtimeHead'], source['sourceHead']).decode().split('\0')[:-1]) ==
        RELEASE24_WORKLIST, 'R24_WORKLIST_ONLY_FREEZE')
    require(set(git23('diff', '--name-only', '--no-renames', '-z', source['sourceHead'], endpoint).decode().split('\0')[:-1]) ==
        expected | {'ONSKIN_BRAIN_HANDOFF.txt'}, 'R24_EVIDENCE_TAIL_SCOPE')
    files = manifest['files']
    require(type(files) is dict and set(files) == {'README.md', 'FINAL_REPORT.md', 'payload.zip', 'verify24.py'}, 'R24_EVIDENCE_FILES')
    actual = set()
    for path in (ROOT/RELEASE24_CHECKPOINT).iterdir():
        info = path.lstat()
        require(not stat.S_ISLNK(info.st_mode) and not getattr(info, 'st_file_attributes', 0) & 1024, 'R24_EVIDENCE_LINK')
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1, 'R24_EVIDENCE_REGULAR')
        actual.add(path.relative_to(ROOT).as_posix())
    require(actual == expected, 'R24_EVIDENCE_INVENTORY')
    for name, witness in files.items():
        raw = regular23(ROOT/(RELEASE24_CHECKPOINT+name))
        require(type(witness) is dict and set(witness) == {'bytes', 'sha256'} and type(witness['bytes']) is int and
            witness['bytes'] == len(raw) and witness['sha256'] == sha(raw), 'R24_EVIDENCE_HASH')
    require(all(regular23(ROOT/path) == git23('show', endpoint+':'+path) for path in expected | {'ONSKIN_BRAIN_HANDOFF.txt'}),
        'R24_EVIDENCE_COMMITTED_BYTES')



def source24_guard():
    endpoint = source24_history(); evidence24_guard(endpoint)
    if (ROOT/(RELEASE24_CHECKPOINT+'manifest.json')).exists():
        require(not git23('status', '--porcelain=v1', '--untracked-files=all', '-z'), 'R24_FROZEN_CHECKOUT_DIRTY')
    candidate24_guard(regular23(ROOT/RELEASE24_CANDIDATE))
    candidate24_guard(git23('show', ':'+RELEASE24_CANDIDATE))
    validate24_diff(git23('diff', '--cached', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE24_BASE), lambda p: git23('show', ':'+p))
    validate24_diff(git23('diff', '--raw', '--no-abbrev', '--no-renames', '-z', RELEASE24_BASE), lambda p: regular23(ROOT/p))
    identities = {}; tree = {}
    for raw in git23('ls-tree', '-r', '-z', endpoint).split(b'\0'):
        if not raw: continue
        meta, name = raw.split(b'\t', 1); mode, kind, oid = meta.decode().split(); path = name.decode()
        require(kind == 'blob' and mode in ('100644', '100755'), 'R24_TREE_MODE')
        tree[path] = (mode, oid); remember21(path, identities)
    index = {}
    for raw in git23('ls-files', '--stage', '-z').split(b'\0'):
        if not raw: continue
        meta, name = raw.split(b'\t', 1); mode, oid, stage = meta.decode().split(); path = name.decode()
        require(stage == '0' and mode in ('100644', '100755') and path not in index, 'R24_INDEX_STAGE_MODE')
        index[path] = (mode, oid); remember21(path, identities)
    for raw in git23('ls-files', '-v', '-z').split(b'\0'):
        if raw: require(raw.startswith(b'H '), 'R24_INDEX_FLAGS')
    for path in git23('ls-files', '--others', '--exclude-standard', '-z').decode().split('\0'):
        if not path: continue
        require(path in RELEASE24_NEW and path not in index, 'R24_UNTRACKED_SCOPE'); remember21(path, identities); regular23(ROOT/path)
    # Full clean-source inventory/scanner coverage is independently executed by security22.
    # This guard proves finite source governance, never technical Security readiness.
    return tree



def validate24(bundle=BUNDLE):
    # Explicit external bundle fixtures retain unchanged Release23 historical semantics.
    try: current = Path(bundle).resolve() == BUNDLE.resolve()
    except Exception: raise ValueError('R24_BUNDLE_SCOPE') from None
    if not current: return validate23(bundle)
    try:
        source24_guard()
        result = historical21_validate(BUNDLE)
        result.update(current_source_governance='RELEASE24_FINITE_SCOPE_ONLY',
            inherited_release23='IMMUTABLE_PR27_DEFINITIONS;NOT_REPLAYED_BY_CURRENT_PATH',
            source_acceptance='SUBMITTED_REVIEW_REQUIRED', acceptanceGranted=False,
            admissions=dict(G97=False, DB=False, M103=False, M2=False, J01=False, PUBLIC=False), release='NO_GO')
        return result
    except Exception as error:
        # Map through the unchanged Release23 fixed-code boundary to preserve
        # original semantic refusals without exposing dynamic paths or exception text.
        code = error.args[0] if type(error) is ValueError and len(error.args) == 1 and type(error.args[0]) is str else None
        known = {
            'R23_PUBLIC_BOUND', 'R23_PUBLIC_PATH', 'R23_PUBLIC_FILE', 'R23_PUBLIC_CHANGED',
            'R23_PUBLIC_READ_INCOMPLETE', 'R23_GIT_ENV', 'R23_HISTORICAL_BACKPORT_PROFILES',
            'R23_TOOLING_SYNTAX', 'R23_ACTIVE_BACKPORT_PROFILES',
            'R24_AFTER_BLOB', 'R24_AFTER_EVIDENCE_TAIL', 'R24_ANCESTRY', 'R24_AUTHENTIC_FINITE_GRANT',
            'R24_CI_CONTEXT', 'R24_CI_EVENT', 'R24_CI_EVENT_CHANGED', 'R24_CI_EVENT_JSON',
            'R24_CI_EVENT_PATH', 'R24_CI_EVENT_SIZE', 'R24_CI_MERGE_TREE', 'R24_COMMAND_PRESERVATION',
            'R24_CREATE_EDIT', 'R24_DEPENDENCY_SCHEMA', 'R24_DIFF_SHAPE', 'R24_DISPATCH',
            'R24_DISPATCH_REQUIRED', 'R24_DUPLICATE_ASSIGNMENT', 'R24_EVIDENCE_COMMITTED_BYTES',
            'R24_EVIDENCE_EXACT_PATHS', 'R24_EVIDENCE_FILES', 'R24_EVIDENCE_HASH',
            'R24_EVIDENCE_INVENTORY', 'R24_EVIDENCE_LINK', 'R24_EVIDENCE_NO_ADMISSION',
            'R24_EVIDENCE_REGULAR', 'R24_EVIDENCE_SOURCE', 'R24_EVIDENCE_TAIL_SCOPE',
            'R24_EXISTING_TOOLING_REGRESSIONS', 'R24_FINITE_SCOPE', 'R24_FRAMEWORK_VERSION',
            'R24_FROZEN_CHECKOUT_DIRTY', 'R24_FULL_PINNED_HISTORY', 'R24_FUNCTION_SCOPE',
            'R24_GLOBAL_SCOPE', 'R24_GLOBAL_SIDE_EFFECT', 'R24_GRANT_SCHEMA', 'R24_HANDOFF_BEFORE_TAIL',
            'R24_HEAD_PARENTS', 'R24_HISTORY_SUBSTITUTION', 'R24_INDEX_FLAGS', 'R24_INDEX_STAGE_MODE',
            'R24_INHERITED_BYTES', 'R24_LINEAR_HISTORY', 'R24_LOCK_FRAMEWORK', 'R24_LOCK_SCHEMA',
            'R24_MODE_OR_DELETION', 'R24_MODULE_SCOPE', 'R24_NEW_BLOB', 'R24_NONFINITE_JSON',
            'R24_NO_ADMISSION', 'R24_ONE_EVIDENCE_TAIL', 'R24_PACKAGE_PURPOSE', 'R24_PACKAGE_SCHEMA',
            'R24_PARENT_BLOB', 'R24_PARENT_PROVENANCE', 'R24_POSTINSTALL_PRESERVATION',
            'R24_QUALITY_GATE_PRESERVATION', 'R24_QUALITY_BOOTSTRAP_BOUND', 'R24_SOURCE_AFTER_FREEZE',
            'R24_TREE_MODE', 'R24_UNCOMMITTED_EVIDENCE', 'R24_UNTRACKED_SCOPE', 'R24_WORKLIST_ONLY_FREEZE',
        }
        if code in known: raise ValueError(code) from None
        # Use the inherited semantic vocabulary. Only the inherited validator's
        # fixed refusal labels are admitted; no caller-controlled suffix survives.
        legacy = set((
            'AUTHENTIC_HISTORY: BASE_BLOB_SHA256: BASE_TREE CONTRACT_BASE CONTRACT_VERSION C_ALIAS: '
            'DAG38_EXACT_OWNERS DAG_CYCLE: DAG_EDGE: DAG_GATE: DAG_IDENTITIES DAG_NOT_ISSUANCE: '
            'DAG_OPERATIONAL_GATES: DAG_ROW_OWNER: DAG_UNKNOWN_NODE: F09_DIARY F09_NOT_F18 FINITE_IDS: F_ALIAS: '
            'GATE_CLOSED: GATE_IDENTITIES GATE_OWNER: HISTORICAL_COUNT: HISTORICAL_DEPS: HISTORICAL_IDENTITIES: '
            'HISTORICAL_NODE: HISTORICAL_PROVENANCE: HISTORICAL_RECORD: HISTORICAL_STATUS: HISTORY_AUTHORITY '
            'HISTORY_NO_ACCEPTANCE J01_DAG J01_G4_CHANGE_GATE J01_INTAKE J01_NO_CLAIMS J01_SINGLE_SCAN_GATES '
            'JSON_DUPLICATE_KEY: JSON_NONFINITE: J_REGISTRY: J_ROW_GATES: LEDGER_CUSTODY LEGACY_CONSUMERS '
            'LEGACY_DOC_BYTES: LEGACY_GUARD M103_TO_M2 MATRIX65_IDENTITIES MATRIX_COUNTS NO_ADMISSION '
            'NO_FAKE_CUTOVER NO_SELF_ACCEPTANCE NO_STUB_GREEN: PLATFORM_TERRITORY PRECEDENCE_LIMIT '
            'PRECEDENCE_NOTICE: PRECEDENCE_ORDER PRECEDENCE_PROPOSAL PRECEDENCE_SAFETY PRIORITY_NOT_J05_ADMISSION '
            'PRODUCT_AUTHORITY PROTECTED_WITNESS_OMITTED P_ALIAS: REGULAR_PATH: ROW_EVIDENCE: ROW_GATES: '
            'ROW_OVERLAP: ROW_QUALIFIED_OWNERS: ROW_REQUIRED_GATE: ROW_STATUS: ROW_TRACEABILITY: SAFE_OFFER '
            'SCHEMA_CONST: SCHEMA_DIALECT SCHEMA_DUPLICATE: SCHEMA_ENUM: SCHEMA_MAX_ITEMS: SCHEMA_MIN_ITEMS: '
            'SCHEMA_MIN_LENGTH: SCHEMA_REQUIRED: SCHEMA_TYPE: SCHEMA_UNKNOWN_KEY: SCHEMA_UNSUPPORTED: '
            'SOURCE_ABSENT: SOURCE_IDENTITY: SOURCE_MATURITY: SOURCE_MODE: SOURCE_PATH SOURCE_SHA256: '
            'UNTRACKED_SCOPE: WORKING_SCOPE: ZERO_SPEND '
        ).split())
        prefix = code.split(':', 1)[0]+':' if code is not None and ':' in code else code
        safe = code if code in legacy else prefix if prefix in legacy else 'R24_EXECUTION_INCOMPLETE'
        raise ValueError(safe) from None


source_guard = source24_guard
validate = validate24


if __name__ == '__main__':
    sys.exit(main())
