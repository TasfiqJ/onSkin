"""Verify bounded regular Git blobs; this does not grant acceptance."""
import hashlib, json, pathlib, subprocess

CP = pathlib.Path(__file__).resolve().parent
ROOT = CP.parents[4]
PREFIX = CP.relative_to(ROOT).as_posix() + '/'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

def oid(spec):
    return git('rev-parse', spec).decode().strip()

scope = json.loads((CP / 'source-scope.json').read_bytes())
manifest = json.loads((CP / 'evidence-manifest.json').read_bytes())
source = scope['source_commit']
subprocess.run(['git','merge-base','--is-ancestor',scope['anchor'],source], cwd=ROOT, check=True)
subprocess.run(['git','merge-base','--is-ancestor',source,'HEAD'], cwd=ROOT, check=True)
assert oid(source + '^{tree}') == scope['source_tree']
authorized = {row['path'] for row in scope['entries']}
for row in scope['entries']:
    path = row['path']
    data = git('show', 'HEAD:' + path)
    assert oid('HEAD:' + path) == row['blob'], path
    assert hashlib.sha256(data).hexdigest() == row['sha256'], path
    assert (ROOT / path).read_bytes() == data, path
for row in scope['protected_objects']:
    path = row['path']
    assert oid(scope['anchor'] + ':' + path) == row['anchor'], path
    assert oid(source + ':' + path) == row['source'], path
    if path == 'docs/brain/checkpoints/M1-02':
        changes = git('diff','--name-only',scope['anchor'],'HEAD','--',path).decode().splitlines()
        assert all(p.startswith(PREFIX) for p in changes), changes
    else:
        assert oid('HEAD:' + path) == row['anchor'], path
changes = git('diff','--name-only',scope['anchor'],'HEAD').decode().splitlines()
assert all(p in authorized or p == 'ONSKIN_BRAIN_HANDOFF.txt' or p.startswith(PREFIX) for p in changes), changes
expected = {row['path'] for row in manifest['entries']}
actual = set(git('ls-tree','-r','--name-only','HEAD','--',PREFIX).decode().splitlines())
actual.discard(PREFIX + 'evidence-manifest.json')
actual.add('ONSKIN_BRAIN_HANDOFF.txt')
assert actual == expected, dict(missing=sorted(expected-actual), extra=sorted(actual-expected))
for row in manifest['entries']:
    path = ROOT / row['path']
    assert path.is_file() and not path.is_symlink(), path
    mode = git('ls-tree','HEAD','--',row['path']).decode().split()[0]
    assert mode in ['100644','100755'], path
    data = git('show','HEAD:' + row['path'])
    assert oid('HEAD:' + row['path']) == row['git_blob'], path
    assert len(data) == row['bytes'] and hashlib.sha256(data).hexdigest() == row['sha256'], path
    assert path.read_bytes() == data, path
for path in (CP / 'receipts').glob('*.json'):
    receipt = json.loads(path.read_bytes())
    assert hashlib.sha256(path.with_suffix('.log').read_bytes()).hexdigest() == receipt['sha256'], path
print('PASS:', len(authorized), 'source paths,', len(scope['protected_objects']),
      'protected identities,', len(expected), 'regular evidence/handoff Git blobs. Admission NONE.')
