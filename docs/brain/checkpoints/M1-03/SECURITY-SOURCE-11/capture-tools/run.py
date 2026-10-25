import datetime, hashlib, json, os, pathlib, subprocess, sys, time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
TASK = pathlib.Path(__file__).resolve().parent
ROOT = TASK / 'source'
LOGS = TASK / 'run-logs'
LOGS.mkdir(exist_ok=True)
name, *command = sys.argv[1:]
assert name and all(c.isalnum() or c in '-_.' for c in name)
def git(*args):
    r = subprocess.run(['git', *args], cwd=ROOT, capture_output=True)
    return r.stdout.decode('utf-8', errors='replace').strip() if r.returncode == 0 else None
start = datetime.datetime.now(datetime.timezone.utc).isoformat()
source = [git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD^{tree}')]
env = dict(os.environ, PYTHONDONTWRITEBYTECODE='1', TURBO_REMOTE_CACHE='false', TURBO_TELEMETRY_DISABLED='1', DO_NOT_TRACK='1')
if command[0] == 'npm':
    command[0] = 'C:/Program Files/nodejs/npm.cmd'
t = time.monotonic()
r = subprocess.run(command, cwd=ROOT, env=env, capture_output=True)
for suffix, data in [('stdout', r.stdout), ('stderr', r.stderr)]:
    (LOGS / (name+'.'+suffix+'.log')).write_bytes(data)
record = dict(argv=command, cwd=str(ROOT), start_utc=start, duration_seconds=round(time.monotonic()-t,3), exit=r.returncode, source=source, worktree_before_or_after='source identities are commit identities; uncommitted changes reported separately', status_after=git('status','--porcelain=v1'), stdout_sha256=hashlib.sha256(r.stdout).hexdigest(), stderr_sha256=hashlib.sha256(r.stderr).hexdigest())
(LOGS / (name+'.json')).write_text(json.dumps(record, indent=2)+'\n', encoding='utf-8')
print(json.dumps(record, indent=2))
print((r.stdout+r.stderr).decode('utf-8',errors='replace')[-3500:])
sys.exit(r.returncode)

