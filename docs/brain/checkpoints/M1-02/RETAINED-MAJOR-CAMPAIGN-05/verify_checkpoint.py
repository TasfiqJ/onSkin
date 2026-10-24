"""Read-only verification of Campaign05 source, history and evidence."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

root = Path(__file__).resolve().parent
repo = root.parents[4]
working = '--working' in sys.argv
def git(*args): return subprocess.check_output(['git', *args], cwd=repo)
def sha(data): return hashlib.sha256(data).hexdigest()
def blob(data): return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
manifest = json.loads((root/'evidence-manifest.json').read_bytes())
expected = {entry['path'] for entry in manifest['files']}
assert len(expected) == len(manifest['files']) == len({p.casefold() for p in expected})
actual = {p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file()}
assert actual == expected | {'evidence-manifest.json'}, 'missing or extra evidence'
for entry in manifest['files']:
    path = (root/entry['path']).resolve()
    assert path.is_relative_to(root) and not path.is_symlink()
    data = path.read_bytes()
    assert len(data) == entry['bytes'] and sha(data) == entry['sha256'] and blob(data) == entry['git_blob'], entry['path']
    if not working:
        relative = path.relative_to(repo).as_posix()
        assert git('rev-parse', 'HEAD:'+relative).decode().strip() == entry['git_blob'], relative
handoff = manifest['handoff']
data = (repo/handoff['path']).read_bytes()
assert sha(data) == handoff['sha256'] and blob(data) == handoff['git_blob']
if not working: assert git('rev-parse', 'HEAD:'+handoff['path']).decode().strip() == handoff['git_blob']

scope = json.loads((root/'source-scope.json').read_bytes())
source = scope['source_commit']
assert git('rev-parse', source+'^{tree}').decode().strip() == scope['source_tree']
subprocess.run(['git','merge-base','--is-ancestor',scope['anchor'],source],cwd=repo,check=True)
for entry in scope['entries']:
    for field, revision in [('before',scope['anchor']),('after',source)]:
        witness = entry[field]
        if witness is None:
            assert git('ls-tree',revision,'--',entry['path']) == b''
            continue
        data = git('cat-file','blob',revision+':'+entry['path'])
        assert sha(data) == witness['sha256'] and blob(data) == witness['blob'] and len(data) == witness['bytes']
    assert sha((repo/entry['path']).read_bytes()) == entry['after']['sha256'], entry['path']
for witness in scope['protected_objects']:
    for revision in [scope['anchor'],source,'HEAD']:
        value = git('ls-tree',revision,'--',witness['path']).decode().strip() or None
        assert value == witness['anchor_entry'], witness['path']
driver = git('cat-file','blob',source+':scripts/e2e/onboarding-first-session.mjs')
for binding_file in (root/'e2e').rglob('driver-binding.json'):
    binding = json.loads(binding_file.read_bytes())
    assert sha(driver) == binding['originalSha256'], binding_file
    executed = binding_file.with_name('executed-driver.mjs')
    if executed.exists(): assert sha(executed.read_bytes()) == binding['executedSha256'], executed

allowed = {entry['path'] for entry in scope['entries']} | {'ONSKIN_BRAIN_HANDOFF.txt'}
prefix = root.relative_to(repo).as_posix()+'/'
for commit in git('rev-list','--reverse',scope['anchor']+'..HEAD').decode().splitlines():
    for path in git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines():
        assert path in allowed or path.startswith(prefix), ('unauthorized intermediate path',commit,path)
        assert not any(path == p['path'] or path.startswith(p['path']+'/') for p in scope['protected_objects']), ('protected intermediate path',commit,path)
print('PASS:',len(scope['entries']),'source paths;',len(scope['protected_objects']),'protected identity/absence witnesses;',len(manifest['files']),'evidence blobs + tracked handoff; mode', 'WORKING' if working else 'COMMITTED', '; admission NONE')
