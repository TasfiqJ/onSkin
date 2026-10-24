"""Read-only integrity verifier. This grants no source or release acceptance."""
from pathlib import Path
import argparse
import gzip
import hashlib
import json
import subprocess
import tarfile

parser = argparse.ArgumentParser()
parser.add_argument('--working', action='store_true', help='Check before the evidence commit')
args = parser.parse_args()
HERE = Path(__file__).resolve().parent
REPO = HERE.parents[4]

def git(*argv):
    return subprocess.check_output(['git', *argv], cwd=REPO)

def identity(data):
    return dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest(),
                blob=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest())

trees = {}
def entry(ref, path):
    if ref not in trees:
        tree = {}
        for raw in git('ls-tree', '-r', '-t', '-z', ref).split(b'\0'):
            if not raw:
                continue
            meta, name = raw.split(b'\t', 1)
            mode, kind, oid = meta.decode().split()
            tree[name.decode()] = dict(mode=mode, kind=kind, object=oid)
        trees[ref] = tree
    return trees[ref].get(path)

def check(data, expected):
    actual = identity(data)
    assert all(actual[key] == expected[key] for key in actual), expected

manifest = json.loads((HERE/'evidence-manifest.json').read_text(encoding='utf-8'))
scope = json.loads((HERE/'source-scope.json').read_text(encoding='utf-8'))
source, anchor = scope['source'], scope['anchor']
prefix = HERE.relative_to(REPO).as_posix()
assert git('merge-base', '--is-ancestor', anchor, source) == b''
assert git('merge-base', '--is-ancestor', source, 'HEAD') == b''
assert git('rev-parse', source+'^{tree}').decode().strip() == scope['source_tree']
assert git('rev-parse', anchor+'^{tree}').decode().strip() == scope['anchor_tree']
assert set(git('diff','--name-only',anchor,source).decode().splitlines()) == {r['path'] for r in scope['changes']}
for row in scope['changes']:
    for ref, name in [(anchor, 'before'), (source, 'after')]:
        expected = row[name]
        actual = entry(ref, row['path'])
        if expected is None:
            assert actual is None
            continue
        assert actual == dict(mode=expected['mode'], kind='blob', object=expected['blob'])
        check(git('cat-file', 'blob', actual['object']), expected)
    check((REPO/row['path']).read_bytes(), row['after'])
    assert entry('HEAD',row['path']) == entry(source,row['path'])
for witness in scope['protected_frontier']:
    for ref in [anchor, source, 'HEAD']:
        assert entry(ref,witness['path']) == {k:v for k,v in witness.items() if k!='path'}, witness
for path in scope['protected_absences']:
    assert entry(source,path) is None and entry('HEAD',path) is None
assert git('rev-list','--reverse',anchor+'..'+source).decode().splitlines() == [r['commit'] for r in scope['intermediate_commits']]
for commit in scope['intermediate_commits']:
    assert git('rev-parse',commit['commit']+'^{tree}').decode().strip() == commit['tree']
    changed = git('diff-tree','--no-commit-id','--name-only','-r',commit['commit']).decode().splitlines()
    assert changed == commit['changed']
    assert set(changed) <= {r['path'] for r in scope['changes']}

packet = gzip.decompress((HERE/'context-manifest-authenticated.json.gz').read_bytes())
assert hashlib.sha256(packet).hexdigest() == '424b3561ab2f6d216cba33d44239e8ff9fef516f8d153da4365b86d2d52719cb'
expected_paths = {r['path'] for r in manifest['files']} | {'evidence-manifest.json'}
assert {p.relative_to(HERE).as_posix() for p in HERE.rglob('*') if p.is_file()} == expected_paths
assert len({p.casefold() for p in expected_paths}) == len(expected_paths)
for row in manifest['files']:
    path = (HERE/row['path']).resolve()
    assert path.is_relative_to(HERE) and path.is_file() and not path.is_symlink()
    check(path.read_bytes(), row)
    if not args.working:
        assert entry('HEAD',prefix+'/'+row['path']) == dict(mode='100644',kind='blob',object=row['blob'])
check((REPO/'ONSKIN_BRAIN_HANDOFF.txt').read_bytes(), manifest['handoff'])
if not args.working:
    assert entry('HEAD','ONSKIN_BRAIN_HANDOFF.txt')['object'] == manifest['handoff']['blob']
    assert entry('HEAD',prefix+'/evidence-manifest.json')['object'] == identity((HERE/'evidence-manifest.json').read_bytes())['blob']
for path in git('diff','--name-only',source,'HEAD').decode().splitlines():
    assert path.startswith(prefix+'/') or path == 'ONSKIN_BRAIN_HANDOFF.txt', path

archives = json.loads((HERE/'archive-members.json').read_text(encoding='utf-8'))
for name, expected in archives.items():
    with tarfile.open(HERE/name,'r:gz') as archive:
        members = archive.getmembers()
        assert len(members) == len(expected)
        assert {m.name for m in members} == set(expected)
        for member in members:
            assert member.isfile() and not Path(member.name).is_absolute() and '..' not in Path(member.name).parts
            check(archive.extractfile(member).read(), expected[member.name])
segments = json.loads((HERE/'command-receipts.json').read_text(encoding='utf-8'))['raw_logs']
raw_logs = gzip.decompress((HERE/'raw-command-logs.bin.gz').read_bytes())
cursor = 0
for row in segments:
    assert row['offset'] == cursor
    check(raw_logs[cursor:cursor+row['bytes']], row)
    cursor += row['bytes']
assert cursor == len(raw_logs)
report = json.loads((HERE/'completion-report.json').read_text(encoding='utf-8'))
assert report['source_commit'] == source and report['self_accepted'] is False
assert report['independent_worklist'] == 'NOT_QUALIFIED'
print(f"PASS: {len(scope['changes'])} source paths; {len(scope['protected_frontier'])} protected witnesses + {len(scope['protected_absences'])} absences; {len(manifest['files'])} evidence files")
print('Integrity only. Independent Brain review and all external gates remain required.')
