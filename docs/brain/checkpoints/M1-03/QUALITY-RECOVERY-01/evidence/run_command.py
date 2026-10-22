"""Capture bounded local checks with complete exits; never grants admission."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

p = argparse.ArgumentParser()
p.add_argument('id')
p.add_argument('--cwd', default='.')
p.add_argument('command', nargs=argparse.REMAINDER)
a = p.parse_args()
root = Path.cwd()
out = root / 'docs/brain/checkpoints/M1-03/QUALITY-RECOVERY-01/evidence'
assert a.id.replace('-', '').isalnum() and a.command
argv = a.command[1:] if a.command[0] == '--' else a.command
log = out / (a.id + '.log')
receipt = out / (a.id + '.receipt.json')
assert not log.exists() and not receipt.exists(), 'Preserve prior observations'
def git(*args):
    return subprocess.check_output(['git', '-C', str(root), *args]).decode().strip()
def sha(raw):
    return hashlib.sha256(raw).hexdigest()
before = {name: sha((root / name).read_bytes()) for name in
          ['apps/mobile/package.json', 'package.json', 'package-lock.json', 'scripts/brain/m103_profile.py']}
start = datetime.datetime.now(datetime.timezone.utc).isoformat()
with log.open('xb') as stream:
    result = subprocess.run(argv, cwd=root / a.cwd, stdout=stream, stderr=subprocess.STDOUT)
value = dict(schema_version=1, kind='LOCAL_EXECUTION', claim_origin='CODEX_REPORTED_EXECUTION',
             command=json.dumps(argv), working_directory=str(root / a.cwd),
             environment=sys.platform + '; ' + sys.version.split()[0] + '; CI=' + os.getenv('CI', '') +
             '; npm_config_cache=' + os.getenv('npm_config_cache', ''),
             source_commit=git('rev-parse', 'HEAD'), source_tree=git('rev-parse', 'HEAD^{tree}'),
             status='PASS' if result.returncode == 0 else 'FAIL', exit_code=result.returncode,
             started_at_utc=start, finished_at_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),
             source_precheck_sha256=before, dirty_source_at_start=git('status', '--porcelain', '--',
             'apps/mobile/package.json', 'package.json', 'package-lock.json', 'scripts/brain/m103_profile.py'),
             output=dict(path=log.relative_to(root).as_posix(), sha256=sha(log.read_bytes())), admission='NONE')
receipt.write_bytes((json.dumps(value, indent=2) + '\n').encode())
print(a.id, value['status'], 'raw_exit=' + str(result.returncode), flush=True)
print(log.read_text(errors='replace')[-4500:], flush=True)
sys.exit(result.returncode)
