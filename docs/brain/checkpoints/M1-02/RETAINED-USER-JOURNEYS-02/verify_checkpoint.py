"""Read-only evidence, exact Git-object and scope verification."""
import hashlib
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent
repo = root.parents[4]
manifest = json.loads((root / 'evidence-manifest.json').read_bytes())
entries = manifest['files']
expected = {entry['path'] for entry in entries}
assert len(expected) == len(entries), 'duplicate manifest path'
actual = {p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file()}
assert actual == expected | {'evidence-manifest.json'}, 'missing or extra evidence'
for entry in entries:
    path = (root / entry['path']).resolve()
    assert path.is_relative_to(root) and not path.is_symlink(), entry['path']
    data = path.read_bytes()
    assert len(data) == entry['bytes'], entry['path']
    assert hashlib.sha256(data).hexdigest() == entry['sha256'], entry['path']

def git(*args):
    return subprocess.check_output(['git', *args], cwd=repo)

scope = json.loads((root / 'source-scope.json').read_bytes())
source = scope['source']
assert git('rev-parse', source + '^{tree}').decode().strip() == scope['source_tree']
subprocess.run(['git', 'merge-base', '--is-ancestor', scope['anchor'], source], cwd=repo, check=True)
for entry in scope['files']:
    for key, revision in [('before', scope['anchor']), ('after', source)]:
        if entry[key] is None:
            continue
        data = git('cat-file', 'blob', revision + ':' + entry['path'])
        assert hashlib.sha256(data).hexdigest() == entry[key]['sha256'], entry['path']
for entry in json.loads((root / 'protected-objects.json').read_bytes()):
    current = git('rev-parse', source + ':' + entry['path']).decode().strip()
    assert current == entry['anchor_object'] == entry['source_object'], entry['path']
allowed = {entry['path'] for entry in scope['files']} | {'ONSKIN_BRAIN_HANDOFF.txt'}
prefix = root.relative_to(repo).as_posix() + '/'
for path in git('diff', '--name-only', scope['anchor'], 'HEAD').decode().splitlines():
    assert path in allowed or path.startswith(prefix), 'out-of-scope path: ' + path
print('PASS:', len(entries), 'evidence files checked; source/tree, protected objects and scope verified; admission NONE')
