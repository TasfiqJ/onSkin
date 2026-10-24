"""Verify this candidate's working bytes, committed blobs, scope and ancestry."""
import hashlib
import json
import pathlib
import subprocess
import sys

root = pathlib.Path.cwd()
checkpoint = pathlib.Path(__file__).resolve().parent
working_only = '--working' in sys.argv


def git(*args):
    return subprocess.check_output(['git', *args], cwd=root).decode().strip()


scope = json.loads((checkpoint / 'source-scope.json').read_text())
manifest = json.loads((checkpoint / 'evidence-manifest.json').read_text())
subprocess.run(['git', 'merge-base', '--is-ancestor', scope['source_commit'], 'HEAD'], cwd=root, check=True)
for entry in scope['entries']:
    data = (root / entry['path']).read_bytes()
    assert hashlib.sha256(data).hexdigest() == entry['sha256'], entry['path']
    assert git('rev-parse', scope['source_commit'] + ':' + entry['path']) == entry['blob']
    assert git('rev-parse', 'HEAD:' + entry['path']) == entry['blob']
for entry in scope['protected_objects']:
    assert git('rev-parse', 'HEAD:' + entry['path']) == entry['anchor_object'], entry['path']
for entry in manifest['entries']:
    path = pathlib.PurePosixPath(entry['path'])
    assert not path.is_absolute() and '..' not in path.parts
    data = (root / entry['path']).read_bytes()
    assert len(data) == entry['bytes'], entry['path']
    assert hashlib.sha256(data).hexdigest() == entry['sha256'], entry['path']
    blob = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
    assert blob == entry['git_blob'], entry['path']
    if not working_only:
        assert git('rev-parse', 'HEAD:' + entry['path']) == blob, entry['path']
        assert git('ls-tree', 'HEAD', '--', entry['path']).startswith('100644 blob '), entry['path']
prefix = checkpoint.relative_to(root).as_posix() + '/'
tail_paths = git('diff', '--name-only', scope['source_commit'], 'HEAD').splitlines()
assert all(p.startswith(prefix) or p == 'ONSKIN_BRAIN_HANDOFF.txt' for p in tail_paths), tail_paths
assert git('branch', '--show-current') == 'stage/m1-retained-resilience'
print('PASS:', len(scope['entries']), 'source paths;', len(manifest['entries']),
      'evidence/handoff hashes;', 'working-only' if working_only else 'committed regular blobs;',
      'protected objects and evidence-only tail scope')
