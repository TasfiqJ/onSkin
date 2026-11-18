import datetime, hashlib, json, os, re, subprocess, sys, time
from pathlib import Path

EVIDENCE = Path(__file__).resolve().parent
REPO = EVIDENCE.parent / 'c16-candidate'
TARGET = 'apps/mobile/src/features/shelf/formulaHistoryJourney.test.ts'
label, *command = sys.argv[1:]
log = EVIDENCE / (label + '.log')
receipt_path = EVIDENCE / (label + '.json')
if log.exists() or receipt_path.exists():
    raise SystemExit('Evidence label already exists')

def git(*args):
    return subprocess.check_output(['git', *args], cwd=REPO).decode().strip()

def source_identity():
    raw = (REPO / TARGET).read_bytes()
    return {'path': TARGET, 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw),
            'gitBlob': git('hash-object', TARGET), 'status': git('status', '--porcelain=v1')}

before = source_identity()
if git('diff', '--name-only', 'HEAD').splitlines() != [TARGET]:
    raise SystemExit('Unexpected source scope before validation')
receipt = {'label': label, 'command': command, 'cwd': str(REPO),
           'start': datetime.datetime.now(datetime.timezone.utc).isoformat(),
           'head': git('rev-parse', 'HEAD'), 'tree': git('rev-parse', 'HEAD^{tree}'), 'sourceBefore': before}
env = {k: v for k, v in os.environ.items() if not k.startswith('EXPO_PUBLIC_')
       and not re.search(r'(TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY|PRIVATE_KEY|ACCESS_KEY)', k, re.I)}
env.update(EXPO_NO_DOTENV='1', EXPO_NO_TELEMETRY='1', EXPO_OFFLINE='1', EXPO_UNSTABLE_HEADLESS='1',
           EXPO_PUBLIC_APP_ENV='development', EXPO_PUBLIC_SUPABASE_URL='https://blocked-supabase-url.invalid',
           EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY='__BLOCKED_PLACEHOLDER__', TURBO_TELEMETRY_DISABLED='1',
           CI='1', NPM_CONFIG_OFFLINE='true', NPM_CONFIG_UPDATE_NOTIFIER='false')
start = time.monotonic()
with log.open('wb') as stream:
    result = subprocess.run(command, cwd=REPO, env=env, stdout=stream, stderr=subprocess.STDOUT)
after = source_identity()
unchanged = before == after
receipt.update(exit=result.returncode, seconds=round(time.monotonic()-start, 3),
               end=datetime.datetime.now(datetime.timezone.utc).isoformat(), sourceAfter=after,
               sourceUnchanged=unchanged, logSha256=hashlib.sha256(log.read_bytes()).hexdigest())
receipt_path.write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
print(json.dumps(receipt), flush=True)
raise SystemExit(result.returncode if unchanged else 91)
