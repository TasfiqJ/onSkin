"""Import authentic local Git pack, verify witness hashes, preserve refs; no source values."""
import gzip
import hashlib
import json
import os
from pathlib import Path
import subprocess

root = Path.cwd()
source = Path('/root/onskin-brain-custody-source-6c9c')
pack = Path('/root/onskin-reconciliation-custody-66ba3219-20261022/complete-endpoints-recovered.pack')
os.environ['GIT_NO_LAZY_FETCH'] = '1'
def git(repo, *args):
    return subprocess.check_output(['git', '-C', str(repo), *args])
before = git(root, 'show-ref')
with pack.open('rb') as stream:
    subprocess.run(['git', 'index-pack', '--stdin', '--strict'], stdin=stream, check=True)
old = json.loads(gzip.decompress(git(source, 'cat-file', 'blob',
    '32c36cf860aee91e177d7db2286e40e6dda35182:scripts/phase9/security_acceptance/history.json.gz')))
current = json.loads(gzip.decompress((root / 'scripts/phase9/security_acceptance/history.json.gz').read_bytes()))
references = {}
for row in old + current:
    key = row['commit'] + ':' + row['path']
    identity = row['source_blob'], row['source_sha256']
    assert key not in references or references[key] == identity
    references[key] = identity
for key, (oid, digest) in references.items():
    data = git(root, 'cat-file', 'blob', key)
    assert hashlib.sha256(data).hexdigest() == digest
    assert hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() == oid
endpoints = {r['commit'] for r in old + current} | {
    '32c36cf860aee91e177d7db2286e40e6dda35182', '569a16d07c0103e0c019f35e384a278671f2a76f'}
for commit in endpoints:
    assert git(root, 'cat-file', '-t', commit).strip() == b'commit'
assert before == git(root, 'show-ref')
print(json.dumps(dict(admission='NONE', pack_sha256=hashlib.sha256(pack.read_bytes()).hexdigest(),
    pack_bytes=pack.stat().st_size, original_witnesses=len(old), current_witnesses=len(current),
    verified_references=len(references), verified_endpoints=len(endpoints),
    refs_unchanged_sha256=hashlib.sha256(before).hexdigest(),
    source=str(source), pack=str(pack), network='NO_LAZY_FETCH; authentic local pack only'), indent=2))
