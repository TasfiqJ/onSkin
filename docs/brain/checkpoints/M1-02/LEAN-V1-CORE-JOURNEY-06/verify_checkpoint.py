"""Read-only verification of this scoped submission. No acceptance authority."""
from pathlib import Path
import hashlib
import gzip
import json
import subprocess
import tarfile

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[4]


def git(*args):
    return subprocess.check_output(['git', *args], cwd=REPO)


trees = {}
def entry(ref, path):
    if ref not in trees:
        result = {}
        for raw in git('ls-tree', '-r', '-t', '-z', ref).split(b'\0'):
            if not raw:
                continue
            metadata, name = raw.split(b'\t', 1)
            mode, kind, oid = metadata.decode().split()
            result[name.decode()] = dict(mode=mode, kind=kind, object=oid)
        trees[ref] = result
    return trees[ref].get(path)


def blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def check_bytes(data, expected):
    assert len(data) == expected['bytes']
    assert hashlib.sha256(data).hexdigest() == expected['sha256']
    assert blob(data) == expected['blob']


manifest = json.loads((HERE / 'evidence-manifest.json').read_text(encoding='utf-8'))
scope = json.loads((HERE / 'source-scope.json').read_text(encoding='utf-8'))
packet_manifest = gzip.decompress((HERE / 'context-manifest-authenticated.json.gz').read_bytes())
assert hashlib.sha256(packet_manifest).hexdigest() == '28ba8bbd2c3d531e77d92eb736f92c8bc49966a9684fec52ea46417f3ec8051b'
authentication = json.loads((HERE / 'context-authentication.json').read_text(encoding='utf-8'))
assert json.loads(packet_manifest)['files'] == authentication['authenticated_members']
prefix = HERE.relative_to(REPO).as_posix()
source, anchor = scope['source'], scope['anchor']
assert git('merge-base', '--is-ancestor', source, 'HEAD') == b''
assert git('rev-parse', source + '^{tree}').decode().strip() == scope['source_tree']
assert git('rev-parse', anchor + '^{tree}').decode().strip() == scope['anchor_tree']

for item in manifest['files']:
    path = (HERE / item['path']).resolve()
    assert path.is_relative_to(HERE) and path.is_file() and not path.is_symlink()
    check_bytes(path.read_bytes(), item)
    assert entry('HEAD', prefix + '/' + item['path']) == dict(mode='100644', kind='blob', object=item['blob'])

expected_files = {item['path'] for item in manifest['files']} | {'evidence-manifest.json'}
assert {p.relative_to(HERE).as_posix() for p in HERE.rglob('*') if p.is_file()} == expected_files
check_bytes((REPO / 'ONSKIN_BRAIN_HANDOFF.txt').read_bytes(), manifest['handoff'])
assert entry('HEAD', 'ONSKIN_BRAIN_HANDOFF.txt')['object'] == manifest['handoff']['blob']

archives = json.loads((HERE / 'archive-members.json').read_text(encoding='utf-8'))
for name, members in archives.items():
    with tarfile.open(HERE / name, 'r:gz') as archive:
        assert [member.name for member in archive.getmembers()] == [item['path'] for item in members]
        for item in members:
            member = archive.getmember(item['path'])
            assert member.isfile() and not member.name.startswith('/') and '..' not in member.name.split('/')
            data = archive.extractfile(member).read()
            assert len(data) == item['bytes'] and hashlib.sha256(data).hexdigest() == item['sha256']

for change in scope['changes']:
    for ref, side in [(anchor, 'before'), (source, 'after')]:
        expected = change[side]
        actual = entry(ref, change['path'])
        if expected is None:
            assert actual is None
        else:
            assert actual == dict(mode=expected['mode'], kind='blob', object=expected['blob'])
            check_bytes(git('cat-file', 'blob', expected['blob']), expected)
    assert entry('HEAD', change['path']) == entry(source, change['path'])
    check_bytes((REPO / change['path']).read_bytes(), change['after'])

for witness in scope['protected_objects']:
    expected = {key: witness[key] for key in ['mode', 'kind', 'object']}
    for ref in [anchor, source, 'HEAD']:
        assert entry(ref, witness['path']) == expected, witness['path']
for path in scope['protected_absence']:
    for ref in [anchor, source, 'HEAD']:
        assert entry(ref, path) is None

allowed_source = {change['path'] for change in scope['changes']}
assert set(git('diff', '--name-only', anchor, source).decode().splitlines()) == allowed_source
frontier = {item['path'] for item in scope['protected_objects']}
for path, metadata in trees[anchor].items():
    if metadata['kind'] != 'blob' or path in allowed_source or path == 'ONSKIN_BRAIN_HANDOFF.txt' or path.startswith(prefix + '/'):
        continue
    assert any(path == root or path.startswith(root + '/') for root in frontier), path
for commit in git('rev-list', anchor + '..HEAD').decode().splitlines():
    for path in git('diff-tree', '--no-commit-id', '--name-only', '-r', commit).decode().splitlines():
        assert path in allowed_source or path == 'ONSKIN_BRAIN_HANDOFF.txt' or path.startswith(prefix + '/'), (commit, path)

print('PASS:', len(manifest['files']), 'evidence files;', len(scope['changes']),
      'source paths;', len(scope['protected_objects']), 'protected object witnesses;',
      len(scope['protected_absence']), 'absence witnesses. Review and external gates remain separate.')
