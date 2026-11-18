import datetime, hashlib, json, os, subprocess, sys, time, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent / 'c16-candidate'
label, *command = sys.argv[1:]
log = ROOT / (label + '.log')
if log.exists(): raise SystemExit('Evidence label already exists')
def git(*args): return subprocess.check_output(['git', *args], cwd=REPO, text=True).strip()
receipt = {'label': label, 'command': command, 'cwd': str(REPO), 'start': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'head': git('rev-parse', 'HEAD'), 'tree': git('rev-parse', 'HEAD^{tree}'), 'status': git('status', '--porcelain')}
receipt['workingDiffSha256'] = hashlib.sha256(subprocess.check_output(['git','diff','--binary','HEAD'], cwd=REPO)).hexdigest()
env = {k:v for k,v in os.environ.items() if not k.startswith('EXPO_PUBLIC_') and not re.search(r'(TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY|PRIVATE_KEY|ACCESS_KEY)', k, re.I)}
env.update(EXPO_NO_DOTENV='1', EXPO_NO_TELEMETRY='1', EXPO_OFFLINE='1', EXPO_PUBLIC_APP_ENV='development', EXPO_PUBLIC_SUPABASE_URL='https://blocked-supabase-url.invalid', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY='__BLOCKED_PLACEHOLDER__', TURBO_TELEMETRY_DISABLED='1', CI='1')
start = time.monotonic()
with log.open('wb') as stream:
    result = subprocess.run(command, cwd=REPO, stdout=stream, stderr=subprocess.STDOUT, env=env)
receipt.update(exit=result.returncode, seconds=round(time.monotonic()-start, 3), end=datetime.datetime.now(datetime.timezone.utc).isoformat(), logSha256=hashlib.sha256(log.read_bytes()).hexdigest())
(ROOT/(label+'.json')).write_text(json.dumps(receipt, indent=2), encoding='utf-8')
print(json.dumps(receipt), flush=True)
raise SystemExit(result.returncode)
