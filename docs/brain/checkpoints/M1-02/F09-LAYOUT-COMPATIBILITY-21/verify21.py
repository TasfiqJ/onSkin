"""Externally anchored Campaign21 integrity. Exit 0 grants no acceptance or release."""
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
import zipfile

AUTHORITY = 'BRAIN-M1X-F09-LAYOUT-COMPATIBILITY21-REPAIR-01'
INPUT_SHA = '6c9b46747f0bb5a9141c9320a92f9508cff6d7e964b8ce2e8536e1260b64536e'
BASE = '3c8cb787f3770df09f0ae4507bca9ac49fb5a079'
BASE_TREE = '1ae09829967d455d98b5f5f93558927890d2d8e9'
PREFIX = 'docs/brain/checkpoints/M1-02/F09-LAYOUT-COMPATIBILITY-21/'
PRODUCER = 'scripts/phase4/build-source-worklist.mjs'
CHECKER = 'scripts/release/full-app-j01/check.py'
FIXTURE = 'apps/mobile/src/features/photos/progressEmptyLayout.c08b2.test.ts'
CANDIDATE = 'docs/brain/contracts/M1X-21/candidate.json'
WORKLIST = {'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md'}
RUNTIME = {'apps/mobile/src/app/(tabs)/progress.tsx', 'apps/mobile/src/features/photos/CompareSlider.tsx'}
REGRESSIONS = {'apps/mobile/src/features/photos/manualCompare20Route.test.ts',
    'apps/mobile/src/features/photos/manualCompare20.test.ts',
    'apps/mobile/src/features/photos/progressRoutes.test.ts'}
EXISTING = {FIXTURE, CHECKER, 'docs/USER_FLOW_TREE.md', 'ONSKIN_BRAIN_HANDOFF.txt'} | WORKLIST | RUNTIME | REGRESSIONS
NEW = {'apps/mobile/src/features/photos/progressLayoutAuthority21.test.ts',
    'scripts/m1/f09_layout_compatibility21_browser.mjs',
    'scripts/release/full-app-j01/source_consumer21.test.py'}
PREFIXES = ('docs/brain/contracts/M1X-21/', 'docs/brain/task-specs/M1X-21/', PREFIX)
INPUT_NAMES = {'00_READ_FIRST.md', '01_LIVE_PR24_AUDIT.md', '02_SEVEN_FAILING_CASES.md',
    '03_F09_PRIVACY_AND_BOUNDARIES.md', '04_RELEASE_GATES.md', '05_DELIVERY_AND_VERIFICATION.md',
    'TASK_DIRECTIVE.md', 'PROMPT_TEMPLATE.md', 'EXACT_PROMPT.md', 'verify_packet.py', 'manifest.json'}
MAX_MEMBERS = 20000
MAX_MEMBER_BYTES = 256 * 1024 * 1024
MAX_PAYLOAD_BYTES = 1024 * 1024 * 1024


def require(value, error):
    if not value:
        raise ValueError(error)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def oid(value, length=40):
    return isinstance(value, str) and re.fullmatch('[0-9a-f]{'+str(length)+'}', value) is not None


def blob(data):
    return hashlib.sha1(('blob '+str(len(data))+'\0').encode()+data).hexdigest()


def pairs(items):
    result = {}
    for key, value in items:
        require(key not in result, 'DUPLICATE_JSON_KEY:'+key)
        result[key] = value
    return result


def parse(raw):
    return json.loads(raw, object_pairs_hook=pairs,
        parse_constant=lambda value: (_ for _ in ()).throw(ValueError('NONFINITE_JSON:'+value)))


def safe(name):
    return isinstance(name, str) and re.fullmatch(r'[A-Za-z0-9._/()-]+', name) is not None and all(
        part and not part.startswith('.') and not part.endswith('.') and
        re.fullmatch(r'(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?', part, re.I) is None
        for part in name.split('/'))


def remember(name, identities):
    # Include implicit directories: Foo/a and foo/b are aliases on Windows.
    parts = name.split('/')
    for index in range(1, len(parts)+1):
        original = '/'.join(parts[:index])
        key = unicodedata.normalize('NFKC', original).casefold()
        require(key not in identities or identities[key] == original, 'NAME_COLLISION:'+name)
        identities[key] = original


def native(path):
    # Git can check out paths beyond Win32's legacy 260-character limit even
    # when the host Python process has not opted in to ordinary long paths.
    value = os.path.abspath(path)
    if os.name == 'nt' and not value.startswith('\\\\?\\'):
        value = ('\\\\?\\UNC\\'+value[2:]) if value.startswith('\\\\') else ('\\\\?\\'+value)
    return Path(value)


def metadata(path):
    info = native(path).lstat()
    require(not stat.S_ISLNK(info.st_mode) and not (getattr(info, 'st_file_attributes', 0) & 1024),
        'LINK_OR_REPARSE:'+str(path))
    return info


def regular(path):
    for ancestor in path.parents:
        require(stat.S_ISDIR(metadata(ancestor).st_mode), 'NOT_DIRECTORY:'+str(ancestor))
    info = metadata(path)
    require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1, 'NOT_SINGLE_REGULAR:'+str(path))
    return native(path).read_bytes()


def inventory_check(data, expected, name):
    require(isinstance(expected, dict) and set(expected) == {'bytes', 'sha256'} and
        type(expected['bytes']) is int and expected['bytes'] >= 0 and oid(expected['sha256'], 64) and
        expected['bytes'] == len(data) and expected['sha256'] == sha(data), 'ARTIFACT_SHA256:'+name)


def artifact_inventory(here, entries):
    require(isinstance(entries, dict) and {'README.md', 'FINAL_REPORT.md', 'verify21.py', 'payload.zip'} <= set(entries)
        and 'manifest.json' not in entries, 'ARTIFACT_MANIFEST_FILES')
    expected = set(entries) | {'manifest.json'}
    directories = set()
    identities = {}
    for name in expected:
        require(safe(name), 'ARTIFACT_NAME:'+name)
        remember(name, identities)
        parts = name.split('/')
        directories.update('/'.join(parts[:i]) for i in range(1, len(parts)))
    require(not expected.intersection(directories), 'ARTIFACT_FILE_DIRECTORY_COLLISION')
    found = set()
    pending = [here]
    while pending:
        directory = pending.pop()
        require(stat.S_ISDIR(metadata(directory).st_mode), 'ARTIFACT_DIRECTORY')
        with os.scandir(native(directory)) as children:
            for child in children:
                path = directory/child.name
                name = path.relative_to(here).as_posix()
                require(safe(name), 'ARTIFACT_NAME:'+name)
                remember(name, identities)
                info = metadata(path)
                if stat.S_ISDIR(info.st_mode):
                    require(name in directories, 'EXTRA_ARTIFACT_DIRECTORY:'+name)
                    pending.append(path)
                else:
                    require(name in expected, 'EXTRA_ARTIFACT:'+name)
                    data = regular(path)
                    if name != 'manifest.json': inventory_check(data, entries[name], name)
                    found.add(name)
    require(found == expected, 'ARTIFACT_INVENTORY')


def payload_inventory(here, entries):
    require(isinstance(entries, dict) and bool(entries) and len(entries) <= MAX_MEMBERS, 'PAYLOAD_MANIFEST')
    identities = {}
    directories = set()
    for name in entries:
        require(safe(name), 'PAYLOAD_NAME:'+name)
        remember(name, identities)
        parts = name.split('/')
        directories.update('/'.join(parts[:i]) for i in range(1, len(parts)))
    require(not set(entries).intersection(directories), 'PAYLOAD_FILE_DIRECTORY_COLLISION')
    found = set()
    retained = {}
    with zipfile.ZipFile(native(here/'payload.zip')) as archive:
        infos = archive.infolist()
        require(len(infos) == len(entries) and len(infos) <= MAX_MEMBERS and
            sum(info.file_size for info in infos) <= MAX_PAYLOAD_BYTES, 'PAYLOAD_SIZE_OR_COUNT')
        for info in infos:
            name = info.filename
            require(name == info.orig_filename and safe(name) and not info.is_dir() and
                name in entries and name not in found and not (info.flag_bits & 1), 'PAYLOAD_MEMBER:'+name)
            mode = info.external_attr >> 16
            require(stat.S_IFMT(mode) == stat.S_IFREG and stat.S_IMODE(mode) == 0o644 and
                not (info.external_attr & 1024), 'PAYLOAD_MODE:'+name)
            require(0 <= info.file_size <= MAX_MEMBER_BYTES and info.compress_type in
                (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED), 'PAYLOAD_ENCODING_OR_SIZE:'+name)
            data = archive.read(info)
            inventory_check(data, entries[name], name)
            if name.startswith('inputs/packet/') or name == 'proof/source-inventory.json': retained[name] = data
            found.add(name)
    require(found == set(entries), 'PAYLOAD_INVENTORY')
    return retained


def input_packet(payload):
    prefix = 'inputs/packet/'
    require({name[len(prefix):] for name in payload if name.startswith(prefix)} == INPUT_NAMES,
        'NEW_ELEVEN_FILE_INPUT_INVENTORY')
    raw = payload[prefix+'manifest.json']
    require(sha(raw) == INPUT_SHA, 'ORIGINAL_CAMPAIGN21_INPUT_MANIFEST')
    packet = parse(raw)
    require(set(packet) == {'schema', 'authority', 'status', 'files', 'promptTriple'} and
        type(packet['schema']) is int and packet['schema'] == 1 and packet['authority'] == AUTHORITY and
        packet['status'] == 'CONTEXT_ONLY' and isinstance(packet['files'], dict) and
        set(packet['files']) == INPUT_NAMES-{'manifest.json'}, 'NEW_INPUT_MANIFEST_SCHEMA')
    for name, entry in packet['files'].items(): inventory_check(payload[prefix+name], entry, name)
    names = ['TASK_DIRECTIVE.md', 'PROMPT_TEMPLATE.md', 'EXACT_PROMPT.md']
    require(packet['promptTriple'] == names and len({payload[prefix+name] for name in names}) == 1,
        'ORIGINAL_PROMPT_TRIAD')


def handoff(source, digest):
    return (f'''Campaign21 F09 populated comparison layout compatibility SOURCE_ONLY_CANDIDATE / NO_GO.
Authority {AUTHORITY}.
Input manifest {INPUT_SHA}.
Draft PR25 https://github.com/TasfiqJ/onSkin/pull/25
Branch stage/m1-f09-layout-compatibility21; base stage/m1-f09-manual-photo-compare20.
Immutable parent {BASE}; tree {BASE_TREE}.
Frozen substantive source {source['runtimeHead']}; tree {source['runtimeTree']}.
Frozen source after unchanged-producer worklist {source['sourceHead']}; tree {source['sourceTree']}.
Checkpoint {PREFIX}README.md
External checkpoint manifest SHA256 {digest}
Verify: python -B {PREFIX}verify21.py --expected-manifest-sha256 {digest} --git-root .
Exactly one evidence-only descendant follows frozen source; verification derives the final HEAD/tree. Later final-head checks, CI, failures/skips and return custody are recorded in the external FINAL_REPORT.md and verified return ZIP.
The original fifteen layout case bodies and assertions are byte-preserved. Synthetic authority/Query fixture repairs and additive regression protections require independent Brain source review; no acceptance or gate admission is granted.
G97 FAIL/NO_GO; original Security credentials/secret findings privately UNREVIEWED; DB06/DB08/R2B NOT_ACCEPTED; M1-03 BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED; M2 NOT_AUTHORIZED; J01 optical G1/G2/G3/G5 and longitudinal G4 NOT_ACCEPTED.
Synthetic Expo web, source tests and unsigned exports do not establish installed iPhone, VoiceOver, provider, clinical/legal, Apple or public release. All remain CLOSED.
First release still requires all working non-Korean F01-F17/F19-F20, 12 consumer C and six professional P groups including required F09 private history/manual comparison, plus exactly independently validated J01 Visible Pores. F18 and J02-J27 including J05 remain deferred.
USD0; no merge, protected/main/prior-branch edit, rebase, force push, auto-merge, maintainer modification, private Security custody or self-acceptance.
''').encode('utf-8')


def changed_scope(name):
    return safe(name) and (name in EXISTING or name in NEW or name.startswith(PREFIXES))


def proof_schema(proof, source):
    require(isinstance(proof, dict) and isinstance(proof.get('commits'), list) and len(proof['commits']) >= 2,
        'SOURCE_PROOF_SCHEMA')
    previous = BASE
    commits = set()
    for row in proof['commits']:
        require(isinstance(row, dict) and set(row) == {'commit', 'parent', 'tree', 'paths', 'changedFromParent'} and
            all(oid(row[key]) for key in ['commit', 'parent', 'tree']) and row['parent'] == previous and
            row['commit'] not in commits and isinstance(row['paths'], list) and isinstance(row['changedFromParent'], list),
            'SOURCE_PROOF_COMMIT_SCHEMA')
        paths = set()
        identities = {}
        for entry in row['paths']:
            require(isinstance(entry, dict) and set(entry) == {'path', 'mode', 'blob', 'bytes', 'sha256'} and
                changed_scope(entry['path']) and not entry['path'].startswith(PREFIX) and entry['path'] not in RUNTIME and
                entry['mode'] == '100644' and oid(entry['blob']) and type(entry['bytes']) is int and entry['bytes'] >= 0 and
                oid(entry['sha256'], 64) and entry['path'] not in paths, 'SOURCE_PROOF_PATH_SCHEMA')
            paths.add(entry['path']); remember(entry['path'], identities)
        changed = row['changedFromParent']
        require(all(changed_scope(name) and not name.startswith(PREFIX) and name not in RUNTIME for name in changed) and
            len(changed) == len(set(changed)), 'SOURCE_PROOF_PARENT_PATHS')
        commits.add(row['commit']); previous = row['commit']
    require([row['commit'] for row in proof['commits'][-2:]] == [source['runtimeHead'], source['sourceHead']] and
        proof['commits'][-2]['tree'] == source['runtimeTree'] and proof['commits'][-1]['tree'] == source['sourceTree'] and
        set(proof['commits'][-1]['changedFromParent']) == WORKLIST, 'SOURCE_PROOF_FROZEN_IDENTITIES')


def raw_diff(raw):
    fields = raw.split(b'\0')
    require(fields[-1] == b'' and len(fields) % 2 == 1, 'SOURCE_DIFF_SHAPE')
    result = []
    for index in range(0, len(fields)-1, 2):
        meta = fields[index].decode('ascii').split()
        name = fields[index+1].decode('utf-8')
        require(len(meta) == 5 and oid(meta[2]) and oid(meta[3]), 'SOURCE_DIFF_METADATA')
        result.append((meta, name))
    return result


def preserved_source(git, name, data):
    if name == FIXTURE:
        before = git('show', BASE+':'+FIXTURE)
        marker = b"describe('C-08B2-R2 empty layout composition (pixel geometry is covered by the browser runner)', () => {"
        require(before.count(marker) == data.count(marker) == 1 and
            data[data.index(marker):] == before[before.index(marker):], 'ORIGINAL15_CHANGED')
    elif name in REGRESSIONS:
        lines = iter(data.splitlines(keepends=True))
        require(all(any(original == added for added in lines) for original in
            git('show', BASE+':'+name).splitlines(keepends=True)), 'NONADDITIVE_REGRESSION:'+name)
    elif name == 'docs/USER_FLOW_TREE.md':
        before = git('show', BASE+':'+name)
        require(data.startswith(before) and data[len(before):].count(b'## Campaign21') == 1, 'NONADDITIVE_FLOW')
    elif name == CHECKER:
        before = git('show', BASE+':'+CHECKER)
        tail = b"if __name__ == '__main__':\n    sys.exit(main())\n"
        require(before.endswith(tail) and data.startswith(before[:-len(tail)]) and data.endswith(tail), 'INHERITED_CHECKER_BYTES')
        old = ast.parse(before); new = ast.parse(data)
        inherited = {node.name: ast.dump(node, include_attributes=False) for node in old.body if isinstance(node, ast.FunctionDef)}
        require(all(any(isinstance(node, ast.FunctionDef) and node.name == name and
            ast.dump(node, include_attributes=False) == value for node in new.body)
            for name, value in inherited.items()), 'INHERITED_CHECKER_AST')
    elif name == CANDIDATE:
        value = parse(data)
        require(set(value) == {'schema', 'authority', 'status', 'base', 'tree', 'acceptanceGranted', 'admissions', 'runtimeProof'} and
            type(value['schema']) is int and value['schema'] == 1 and value['authority'] == AUTHORITY and
            value['status'] == 'SOURCE_ONLY_CANDIDATE' and value['base'] == BASE and value['tree'] == BASE_TREE and
            value['acceptanceGranted'] is False and value['admissions'] ==
                dict(G97=False, DB=False, M103=False, M2=False, J01=False, PUBLIC=False) and
            all(flag is False for flag in value['admissions'].values()) and value['runtimeProof'] == {}, 'CANDIDATE_NO_ADMISSION')


def verify(expected, git_root=None):
    here = Path(__file__).absolute().parent
    require(oid(expected, 64), 'BAD_EXTERNAL_ANCHOR')
    manifest_raw = regular(here/'manifest.json')
    require(sha(manifest_raw) == expected, 'EXTERNAL_MANIFEST_SHA256')
    manifest = parse(manifest_raw)
    require(isinstance(manifest, dict) and set(manifest) == {'schema', 'authority', 'status', 'acceptanceGranted',
        'release', 'inputManifestSHA256', 'producerSHA256', 'source', 'files', 'payload'} and
        type(manifest['schema']) is int and manifest['schema'] == 1 and manifest['authority'] == AUTHORITY and
        manifest['status'] == 'SOURCE_ONLY_CANDIDATE' and manifest['acceptanceGranted'] is False and
        manifest['release'] == 'NO_GO' and manifest['inputManifestSHA256'] == INPUT_SHA and oid(manifest['producerSHA256'], 64),
        'NON_ADMISSION_MANIFEST_SCHEMA')
    source = manifest['source']
    require(isinstance(source, dict) and set(source) == {'base', 'baseTree', 'runtimeHead', 'runtimeTree', 'sourceHead', 'sourceTree'} and
        source['base'] == BASE and source['baseTree'] == BASE_TREE and all(oid(value) for value in source.values()), 'SOURCE_MANIFEST_SCHEMA')
    artifact_inventory(here, manifest['files'])
    payload = payload_inventory(here, manifest['payload'])
    input_packet(payload)
    proof = parse(payload['proof/source-inventory.json'])
    proof_schema(proof, source)
    result = dict(status='VERIFIED', admission='NONE', release='NO_GO', manifestSHA256=expected,
        qualification='ARTIFACT_INTEGRITY_ONLY; INDEPENDENT_SOURCE_REVIEW_REQUIRED',
        files=len(manifest['files'])+1, payloadFiles=len(manifest['payload']), inputFiles=11)
    if git_root is None: return result
    root = Path(git_root).absolute()
    require(stat.S_ISDIR(metadata(root).st_mode), 'GIT_ROOT_DIRECTORY')
    def git(*args):
        return subprocess.check_output(['git', '--no-replace-objects', '--no-optional-locks', *args], cwd=root, stderr=subprocess.PIPE)
    require(git('rev-parse', '--is-shallow-repository').decode().strip() == 'false', 'COMPLETE_GIT_HISTORY_REQUIRED')
    require(os.path.normcase(os.path.abspath(git('rev-parse', '--show-toplevel').decode().strip())) ==
        os.path.normcase(str(root)), 'GIT_ROOT_IDENTITY')
    require(git('rev-parse', BASE+'^{tree}').decode().strip() == BASE_TREE, 'PINNED_PARENT_TREE')
    grafts = Path(git('rev-parse', '--git-path', 'info/grafts').decode().strip())
    if not grafts.is_absolute(): grafts = root/grafts
    require(not os.path.lexists(native(grafts)), 'GIT_GRAFTS_NOT_ALLOWED')
    checked = subprocess.run(['git', '--no-replace-objects', '--no-optional-locks', 'fsck', '--strict',
        '--no-dangling', '--no-reflogs', 'HEAD', BASE], cwd=root, capture_output=True, timeout=300)
    require(checked.returncode == 0, 'GIT_OBJECT_INTEGRITY:'+checked.stderr.decode('utf-8', errors='replace')[-1000:])
    require(git('status', '--porcelain=v1', '--untracked-files=all', '-z') == b'', 'CLEAN_CHECKOUT_REQUIRED')
    require(all(not entry or entry.startswith(b'H ') for entry in git('ls-files', '-v', '-z').split(b'\0')), 'INDEX_FLAGS')
    head = git('rev-parse', 'HEAD').decode().strip()
    require(git('rev-list', '--parents', '-n', '1', head).decode().split() == [head, source['sourceHead']], 'ONE_FINAL_EVIDENCE_CHILD')
    commits = git('rev-list', '--reverse', BASE+'..'+source['sourceHead']).decode().splitlines()
    require(len(commits) >= 2 and [row['commit'] for row in proof['commits']] == commits and
        commits[-2:] == [source['runtimeHead'], source['sourceHead']] and
        git('merge-base', BASE, source['sourceHead']).decode().strip() == BASE, 'COMPLETE_SOURCE_HISTORY')
    previous = BASE
    for row in proof['commits']:
        require(isinstance(row, dict) and set(row) == {'commit', 'parent', 'tree', 'paths', 'changedFromParent'} and
            all(oid(row[key]) for key in ['commit', 'parent', 'tree']) and row['parent'] == previous, 'SOURCE_COMMIT_SCHEMA')
        commit = row['commit']
        require(git('rev-list', '--parents', '-n', '1', commit).decode().split() == [commit, previous] and
            git('rev-parse', commit+'^{tree}').decode().strip() == row['tree'], 'SOURCE_COMMIT_PARENT_TREE')
        actual_paths = []
        identities = {}
        for meta, name in raw_diff(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', BASE, commit)):
            require(changed_scope(name) and not name.startswith(PREFIX) and name not in RUNTIME and
                meta[0] in [':000000', ':100644'] and meta[1] == '100644' and
                meta[4] == ('M' if name in EXISTING else 'A') and
                ((name in EXISTING) == (meta[0] == ':100644')), 'FINITE_SOURCE_SCOPE:'+name)
            remember(name, identities)
            if name in EXISTING:
                require(meta[2] == git('rev-parse', BASE+':'+name).decode().strip(), 'BASE_BLOB:'+name)
            else:
                absent = subprocess.run(['git', '--no-replace-objects', 'cat-file', '-e', BASE+':'+name], cwd=root, capture_output=True)
                require(meta[2] == '0'*40 and absent.returncode != 0, 'NEW_PATH_WAS_EXISTING:'+name)
            data = git('show', commit+':'+name)
            require(blob(data) == meta[3], 'SOURCE_BLOB:'+name)
            preserved_source(git, name, data)
            actual_paths.append(dict(path=name, mode=meta[1], blob=meta[3], bytes=len(data), sha256=sha(data)))
        require(actual_paths == row['paths'], 'EXACT_INTERMEDIATE_INVENTORY:'+commit)
        changed = git('diff', '--name-only', '--no-renames', '-z', previous, commit).decode().split('\0')[:-1]
        require(changed == row['changedFromParent'], 'INTERMEDIATE_PARENT_DIFF:'+commit)
        previous = commit
    require(git('rev-parse', source['runtimeHead']+'^{tree}').decode().strip() == source['runtimeTree'] and
        git('rev-parse', source['sourceHead']+'^{tree}').decode().strip() == source['sourceTree'], 'FROZEN_TREES')
    require(set(git('diff', '--name-only', '--no-renames', '-z', source['runtimeHead'], source['sourceHead']).decode().split('\0')[:-1]) == WORKLIST,
        'WORKLIST_ONLY_COMMIT')
    producer = regular(root/PRODUCER)
    require(producer == git('show', BASE+':'+PRODUCER) and sha(producer) == manifest['producerSHA256'], 'UNCHANGED_PRODUCER')
    require(regular(root/'ONSKIN_BRAIN_HANDOFF.txt') == handoff(source, expected), 'FACTUAL_HANDOFF')
    expected_tail = {PREFIX+name for name in manifest['files']} | {PREFIX+'manifest.json', 'ONSKIN_BRAIN_HANDOFF.txt'}
    tail_paths = set()
    for meta, name in raw_diff(git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', source['sourceHead'], head)):
        require(name in expected_tail and meta[1] == '100644' and
            meta[4] == ('M' if name == 'ONSKIN_BRAIN_HANDOFF.txt' else 'A') and
            meta[0] == (':100644' if name == 'ONSKIN_BRAIN_HANDOFF.txt' else ':000000'), 'EXACT_EVIDENCE_TAIL_MODE:'+name)
        require(blob(regular(root/name)) == meta[3], 'EVIDENCE_BLOB:'+name)
        tail_paths.add(name)
    require(tail_paths == expected_tail, 'EXACT_EVIDENCE_TAIL_INVENTORY')
    for name in set(manifest['files']) | {'manifest.json'}:
        require(regular(root/(PREFIX+name)) == regular(here/name), 'CHECKPOINT_COPY_BYTES:'+name)
    # Verify all final tracked bytes and index rows, including unchanged protected
    # files; a clean-status report alone is not a content proof.
    tree_rows = {}
    identities = {}
    for entry in git('ls-tree', '-r', '-z', head).split(b'\0'):
        if not entry: continue
        meta, raw_name = entry.split(b'\t', 1); mode, kind, object_id = meta.decode('ascii').split()
        name = raw_name.decode('utf-8')
        require(mode in ('100644', '100755') and kind == 'blob' and oid(object_id), 'FINAL_TREE_MODE:'+name)
        remember(name, identities)
        require(name not in tree_rows, 'DUPLICATE_TREE_PATH')
        require(blob(regular(root/name)) == object_id, 'FINAL_CHECKOUT_BLOB:'+name)
        tree_rows[name] = (mode, object_id)
    index_rows = {}
    for entry in git('ls-files', '--stage', '-z').split(b'\0'):
        if not entry: continue
        meta, name = entry.split(b'\t', 1); mode, object_id, stage = meta.decode('ascii').split()
        name = name.decode('utf-8')
        require(stage == '0' and name not in index_rows, 'INDEX_STAGE')
        index_rows[name] = (mode, object_id)
    require(index_rows == tree_rows, 'EXACT_FINAL_INDEX')
    for name in [FIXTURE, CHECKER, CANDIDATE]: preserved_source(git, name, regular(root/name))
    result.update(qualification='ARTIFACT_AND_FULL_CHECKOUT_INTEGRITY_ONLY; INDEPENDENT_SOURCE_REVIEW_REQUIRED',
        runtimeHead=source['runtimeHead'], sourceHead=source['sourceHead'], sourceCommits=len(commits),
        finalHead=head, finalTree=git('rev-parse', head+'^{tree}').decode().strip(), trackedFiles=len(tree_rows))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--expected-manifest-sha256', required=True)
    parser.add_argument('--git-root', type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(verify(args.expected_manifest_sha256, args.git_root), sort_keys=True))
        return 0
    except (ValueError, KeyError, TypeError, OSError, UnicodeError, zipfile.BadZipFile, RuntimeError, subprocess.SubprocessError) as error:
        print(json.dumps(dict(status='REJECTED', admission='NONE', release='NO_GO', error=str(error)), sort_keys=True))
        return 1


if __name__ == '__main__':
    sys.exit(main())
