import datetime, hashlib, json, os, re, subprocess, sys, time
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
REPO=ROOT.parent/'c16-candidate'
EXPECTED='efd3af803a2a71bd2fdd644ecfd500c619fb996c'
label,*command=sys.argv[1:]
log=ROOT/'checks'/(label+'.log');receipt_path=ROOT/'checks'/(label+'.json')
assert not log.exists()and not receipt_path.exists()
def git(*args):return subprocess.check_output(['git',*args],cwd=REPO,text=True).strip()
def identity():return {'head':git('rev-parse','HEAD'),'tree':git('rev-parse','HEAD^{tree}'),'branch':git('branch','--show-current'),'porcelain':git('status','--porcelain=v1')}
before=identity();assert before['head']==EXPECTED and not before['porcelain']
env={k:v for k,v in os.environ.items()if not k.startswith('EXPO_PUBLIC_')and not re.search(r'(TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY|PRIVATE_KEY|ACCESS_KEY)',k,re.I)}
env.update(EXPO_NO_DOTENV='1',EXPO_NO_TELEMETRY='1',EXPO_OFFLINE='1',EXPO_UNSTABLE_HEADLESS='1',TURBO_TELEMETRY_DISABLED='1',CI='1',NPM_CONFIG_OFFLINE='true',NPM_CONFIG_UPDATE_NOTIFIER='false',EXPO_PUBLIC_APP_ENV='development',EXPO_PUBLIC_SUPABASE_URL='https://blocked-supabase-url.invalid',EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY='__BLOCKED_PLACEHOLDER__')
start=datetime.datetime.now(datetime.timezone.utc).isoformat();clock=time.monotonic()
with log.open('wb')as stream:result=subprocess.run(command,cwd=REPO,env=env,stdout=stream,stderr=subprocess.STDOUT)
after=identity();receipt={'label':label,'command':command,'start':start,'end':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exit':result.returncode,'seconds':round(time.monotonic()-clock,3),'sourceBefore':before,'sourceAfter':after,'sourceUnchanged':before==after,'logSha256':hashlib.sha256(log.read_bytes()).hexdigest(),'scope':'existing local checks only; no installs, hosted CI, native attempt or source edits'}
receipt_path.write_text(json.dumps(receipt,indent=2),encoding='utf-8');print(json.dumps(receipt),flush=True)
raise SystemExit(result.returncode if before==after else 91)
