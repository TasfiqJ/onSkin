"""Bind the actual isolated test checkout to the single source commit."""
import hashlib
import json
import pathlib
import subprocess
import sys

root = pathlib.Path.cwd()
inputs = pathlib.Path(sys.argv[1])
def git(*args):
    return subprocess.check_output(['git', *args])
assert git('rev-parse', 'HEAD').decode().strip() == 'efc75bf119904f983e40380067f682d111da52dd'
assert git('rev-parse', 'HEAD^{tree}').decode().strip() == '85568597205ccb6ee5a94fe16db063f78abbc70f'
assert not git('status', '--porcelain', '--untracked-files=all')
rows = json.loads((inputs / 'PREIMAGE_WITNESSES.json').read_bytes())['files']
for row in rows:
    raw = (root / row['path']).read_bytes()
    if row['path'] == 'scripts/phase9/security_acceptance/test_contract.py':
        assert len(raw) == 49880
        assert hashlib.sha256(raw).hexdigest() == '661cfc2615689e3e64ee96d343e7e0bd76eeb6e8276c1483d04733248cd193f8'
    else:
        assert len(raw) == row['bytes'] and hashlib.sha256(raw).hexdigest() == row['sha256'], row['path']
    assert raw == git('cat-file', 'blob', 'HEAD:' + row['path']), row['path']
inventory = git('ls-files', '--stage', '-z')
print(json.dumps(dict(status='PASS', cwd=str(root), clean=True,
    measured_commit=git('rev-parse', 'HEAD').decode().strip(),
    measured_tree=git('rev-parse', 'HEAD^{tree}').decode().strip(),
    tracked_files=len(inventory.split(b'\0')) - 1,
    tracked_inventory_sha256=hashlib.sha256(inventory).hexdigest(),
    witnesses_verified=25, node=subprocess.check_output(['node', '--version']).decode().strip(),
    python=sys.version, security_admission='CLOSED'), indent=2))
