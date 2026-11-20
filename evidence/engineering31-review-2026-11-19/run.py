import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

OUT = Path(__file__).resolve().parent
REPO = OUT.parent / 'c16-candidate'
sys.stdout.reconfigure(encoding='utf-8')
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(data): return hashlib.sha256(data).hexdigest()
def git(*args): return subprocess.check_output(['git','--no-optional-locks',*args],cwd=REPO).decode('utf-8').strip()
def identity():
    index=Path(git('rev-parse','--git-path','index'))
    return dict(head=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}'),branch=git('branch','--show-current'),
      status=git('status','--porcelain=v1'),indexSha256=sha(index.read_bytes()),
      diffSha256=sha(subprocess.check_output(['git','diff','--binary','--full-index'],cwd=REPO)))
def write(name,value):
    dest=OUT/name; dest.parent.mkdir(parents=True,exist_ok=True)
    with dest.open('x',encoding='utf-8',newline='\n') as f: json.dump(value,f,indent=2); f.write('\n')
def environment():
    env={k:v for k,v in os.environ.items() if not k.startswith(('EXPO_PUBLIC_','ONBOARDING_E2E_','ONSKIN_')) and not re.search(r'TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY|PRIVATE_KEY|ACCESS_KEY',k,re.I)}
    env.update(CI='1',EXPO_OFFLINE='1',EXPO_UNSTABLE_HEADLESS='1',EXPO_NO_DOTENV='1',EXPO_NO_TELEMETRY='1',TURBO_TELEMETRY_DISABLED='1',npm_config_offline='true',GIT_OPTIONAL_LOCKS='0',PYTHONDONTWRITEBYTECODE='1')
    return env
def execute(label,command,overrides=None,clean=False):
    before=identity(); assert before['branch']=='stage/m1-native-runtime47'
    if clean: assert not before['status'],before
    free=shutil.disk_usage(OUT).free; assert free>=10*1024**3
    log=OUT/(label+'.log'); assert not log.exists() and not (OUT/(label+'.json')).exists()
    env=environment(); env.update(overrides or {})
    receipt=dict(label=label,command=command,before=before,start=now(),freeBytesBefore=free,externalCredentialsRemoved=True,dotenvDisabled=True,overrides=overrides or {})
    with log.open('xb') as stream: result=subprocess.run(command,cwd=REPO,env=env,stdout=stream,stderr=subprocess.STDOUT)
    receipt.update(exit=result.returncode,after=identity(),end=now(),freeBytesAfter=shutil.disk_usage(OUT).free,logBytes=log.stat().st_size,logSha256=sha(log.read_bytes()))
    write(label+'.json',receipt)
    assert receipt['before']==receipt['after'],'Source/index changed during validation'
    print(json.dumps(receipt),flush=True); print(log.read_text(encoding='utf-8',errors='replace')[-2600:],flush=True)
    return result.returncode
if __name__=='__main__':
    label=sys.argv[1]
    if label=='preflight':
        observed=identity()
        assert observed['head']=='e5b5d0934852dccac5bd90a2017f9536e2ac89f9' and observed['tree']=='9de89e78a4d475dbaf154d1d66dd29f34617a0d5' and not observed['status']
        index=Path(git('rev-parse','--git-path','index')); assert not Path(str(index)+'.lock').exists()
        (OUT/'initial-index.backup').write_bytes(index.read_bytes())
        subprocess.run(['git','merge-base','--is-ancestor','d292743c99c1fb98f5714789f4fd60fb1e7d5a5d','HEAD'],cwd=REPO,check=True)
        write('INITIAL_PREFLIGHT.json',dict(at=now(),source=observed,freeBytes=shutil.disk_usage(OUT).free,pr48Ancestor=True,writerObservation='Process inventory and repeat clean identity show no competing source writer or Git lock. Existing tool hosts only; observational, not an OS lock.',ancestry=git('log','-8','--format=%H %T %P %s')))
        print(observed)
    else: sys.exit(execute(label,sys.argv[2:],clean=label.startswith('final-')))
