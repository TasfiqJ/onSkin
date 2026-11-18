import datetime, hashlib, json, os, re, subprocess, sys, time
from pathlib import Path

E = Path(__file__).resolve().parent
R = E.parent / 'c16-candidate'
TARGETS = ['apps/mobile/src/features/routine/planRecovery.test.ts',
           'apps/mobile/src/features/scheduler/cycleReadiness.plan.test.ts',
           'apps/mobile/src/features/today/OptionalChangePanel41.test.tsx',
           'apps/mobile/src/features/today/OptionalChangePanel41.tsx']
PINNED = {'apps/mobile/src/features/today/OptionalChangePanel41.tsx': 'c152a2813d7ffc949ae6ec81a691e3e76e77d2e22e4a64d0a3ded0f1b026562d',
          'apps/mobile/src/features/today/OptionalChangePanel41.test.tsx': 'ab63c800285963bcc79275b880d3b68077f85b1605d82992b2714a469036e9a3'}
label, *command = sys.argv[1:]
log, receipt_path = E / (label + '.log'), E / (label + '.json')
if log.exists() or receipt_path.exists(): raise SystemExit('Evidence label already exists')
def git(*args): return subprocess.check_output(['git', *args], cwd=R).decode().strip()
def identity():
    rows = [{'path': path, 'sha256': hashlib.sha256((R / path).read_bytes()).hexdigest(),
             'bytes': (R / path).stat().st_size, 'gitBlob': git('hash-object', path)} for path in TARGETS]
    for row in rows:
        if row['path'] in PINNED: assert row['sha256'] == PINNED[row['path']], 'Original candidate changed'
    return rows
before = identity()
assert git('diff', '--name-only', 'HEAD').splitlines() == TARGETS
assert git('diff', '--cached', '--name-only') == ''
assert git('ls-files', '--others', '--exclude-standard') == ''
receipt = {'label': label, 'command': command, 'cwd': str(R),
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
    result = subprocess.run(command, cwd=R, env=env, stdout=stream, stderr=subprocess.STDOUT)
after = identity()
receipt.update(exit=result.returncode, seconds=round(time.monotonic()-start, 3),
               end=datetime.datetime.now(datetime.timezone.utc).isoformat(), sourceAfter=after,
               sourceUnchanged=before == after, originalCandidateHashesPreserved=True,
               logSha256=hashlib.sha256(log.read_bytes()).hexdigest(), status=git('status', '--porcelain=v1'))
receipt_path.write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
print(json.dumps(receipt), flush=True)
raise SystemExit(result.returncode if before == after else 91)
