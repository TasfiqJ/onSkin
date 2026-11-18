import datetime, hashlib, json, os, subprocess, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')

OUT = Path(__file__).resolve().parent
REPO = OUT.parent / 'c16-candidate'
def git(*args):
    return subprocess.check_output(['git', *args], cwd=REPO).decode().strip()
def identity():
    return dict(head=git('rev-parse', 'HEAD'), tree=git('rev-parse', 'HEAD^{tree}'),
                branch=git('branch', '--show-current'), status=git('status', '--porcelain=v1'))
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
label, *command = sys.argv[1:]
OUT.mkdir(exist_ok=True)
log = OUT / (label + '.log')
receipt = OUT / (label + '.json')
assert not log.exists() and not receipt.exists(), 'Preserve previous executions'
r = dict(command=command, cwd=str(REPO), start=now(), before=identity())
env = dict(os.environ, CI='1', EXPO_NO_TELEMETRY='1', EXPO_OFFLINE='1', npm_config_offline='true')
if command[0] == 'npm': command[0] = 'npm.cmd'
with log.open('wb') as stream:
    result = subprocess.run(command, cwd=REPO, stdout=stream, stderr=subprocess.STDOUT, env=env)
r.update(end=now(), after=identity(), exit=result.returncode,
         logSha256=hashlib.sha256(log.read_bytes()).hexdigest(), logBytes=log.stat().st_size)
receipt.write_text(json.dumps(r, indent=2) + '\n', encoding='utf-8')
print(json.dumps(r, indent=2))
print(log.read_text(encoding='utf-8', errors='replace')[-1800:])
sys.exit(result.returncode)
