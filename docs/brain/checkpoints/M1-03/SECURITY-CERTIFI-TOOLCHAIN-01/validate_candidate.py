import copy, datetime, hashlib, json, os, pathlib, re, subprocess, sys, time

BASE=pathlib.Path('/tmp/onskin-m103-certifi-0fd3eeace36a492bb97dfcd8d99231aa')
REPO=BASE/'repo'; CTX=pathlib.Path(__file__).resolve().parent; OUT=CTX/'validation'
OUT.mkdir(exist_ok=False)
proof=json.loads((CTX/'reproduction/attempt02/candidate-proof.json').read_bytes())
assert proof['status']=='PASS'
TOOLS=BASE/'new-tools-02'; PYTHON=BASE/'venv/bin/python'
NPM=TOOLS/'npm/node_modules/npm/bin/npm-cli.js'
CACHE=BASE/'fresh-validation-npm-cache';assert not CACHE.exists()
env={'PATH':str(TOOLS/'cli-bin')+':'+str(BASE/'venv/bin')+':/usr/local/bin:/usr/bin:/bin',
     'HOME':str(BASE/'home'),'LANG':'C.UTF-8','PYTHONDONTWRITEBYTECODE':'1',
     'NPM_CONFIG_REGISTRY':'https://registry.npmjs.org/','NPM_CONFIG_USERCONFIG':'/dev/null',
     'NPM_CONFIG_CACHE':str(CACHE),'TURBO_TELEMETRY_DISABLED':'1','DO_NOT_TRACK':'1','CI':'1'}
rows=[]
def run(name,args,expected=0,timeout=1200):
    started=datetime.datetime.now(datetime.timezone.utc).isoformat();t=time.monotonic()
    with (OUT/(name+'.stdout.log')).open('wb') as stdout,(OUT/(name+'.stderr.log')).open('wb') as stderr:
        p=subprocess.run(list(map(str,args)),cwd=REPO,env=env,stdout=stdout,stderr=stderr,timeout=timeout)
    row={'id':name,'argv':list(map(str,args)),'cwd':str(REPO),'started_utc':started,'exit':p.returncode,
         'expected_exit':expected,'elapsed_seconds':round(time.monotonic()-t,3),
         'status':'PASS' if p.returncode==expected else 'FAIL'}
    rows.append(row);(OUT/'executions.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(row),flush=True)
    if p.returncode!=expected:
        print((OUT/(name+'.stderr.log')).read_text()[-10000:],flush=True)
        print((OUT/(name+'.stdout.log')).read_text()[-10000:],flush=True)
        raise RuntimeError(name+' failed')
    return row
def npm(name,*args):return run(name,['node',NPM,*args])
def git(*args):return subprocess.check_output(['git',*args],cwd=REPO,env=env).decode().strip()
assert set(git('diff','--name-only').splitlines())=={'scripts/phase9/security_acceptance/proposal.json','scripts/phase9/security_acceptance/semgrep-requirements-linux-py312.txt'}
run('scratch-source-stage',['git','add','scripts/phase9/security_acceptance/proposal.json','scripts/phase9/security_acceptance/semgrep-requirements-linux-py312.txt'])
run('scratch-source-commit',['git','-c','user.name=Codex','-c','user.email=codex@openai.com','commit','-m','fix(security): update exact certifi scanner dependency'])
identity={'commit':git('rev-parse','HEAD'),'tree':git('rev-parse','HEAD^{tree}'),'status':git('status','--porcelain=v1','--untracked-files=all')}
assert not identity['status'];(OUT/'source-snapshot.json').write_text(json.dumps(identity,indent=2)+'\n')
npm('fresh-npm-ci','ci','--no-audit','--no-fund','--cache',CACHE,'--registry','https://registry.npmjs.org/')
run('original-security70',[PYTHON,'-B','-m','unittest','discover','-s','scripts/phase9/security_acceptance','-p','test_contract.py','-v'])
run('original-secret12',[PYTHON,'-B','-m','unittest','discover','-s','scripts/phase9/security_acceptance','-p','test_secret_scan.py','-v'])
run('original-expiry-exception8',['node','--test','scripts/phase9/security-advisory-exceptions.test.mjs'])
run('ordinary-governance103',[PYTHON,'-B','-m','unittest','discover','-s','scripts/brain','-p','test_*.py','-v'])
sys.path.insert(0,str(REPO/'scripts/phase9/security_acceptance'))
import contract as c
from collect import verify_tool_sources
policy=json.loads((REPO/'scripts/phase9/security_acceptance/proposal.json').read_bytes())
tools=json.loads((TOOLS/'tools.json').read_bytes())
checks=[]
def rejected(name,action,code):
    try:action()
    except c.Rejected as error:
        assert str(error)==code,(name,str(error));checks.append({'id':name,'status':'PASS','actual_refusal':str(error)})
    else:raise AssertionError(name+' was accepted')
verify_tool_sources(tools,policy)
target=pathlib.Path(tools['semgrep'])/'certifi/__init__.py';raw=target.read_bytes()
try:
    target.write_bytes(raw+b'\n# synthetic tamper\n')
    rejected('certifi-tamper',lambda:verify_tool_sources(tools,policy),'SEMGREP_IMPLEMENTATION_DRIFT')
finally:target.write_bytes(raw)
stale=copy.deepcopy(policy);stale['semgrepPackageTree']=proof['old_assembled_package_tree']
rejected('stale-tool-tree',lambda:verify_tool_sources(tools,stale),'SEMGREP_IMPLEMENTATION_DRIFT')
extra=pathlib.Path(tools['semgrep'])/'synthetic-extra-1.0.dist-info';extra.mkdir()
try:
    (extra/'METADATA').write_text('Name: synthetic-extra\nVersion: 1.0\n')
    rejected('extra-package',lambda:verify_tool_sources(tools,policy),'SEMGREP_IMPLEMENTATION_DRIFT')
finally:(extra/'METADATA').unlink();extra.rmdir()
forged=copy.deepcopy(policy);forged['notAfter']='2027-10-21T00:00:00Z'
rejected('forged-expiry',lambda:c.validate_policy(forged),'PROPOSAL_EXPIRED_OR_CHANGED')
rejected('real-proposal-remains-expired',lambda:c.validate_policy(policy),'PROPOSAL_EXPIRED_OR_CHANGED')
verify_tool_sources(tools,policy)
(OUT/'adverse-checks.json').write_text(json.dumps(checks,indent=2)+'\n');print(json.dumps(checks),flush=True)
run('original-source-inventory-refusal',[PYTHON,'-B','scripts/phase9/security_acceptance/contract.py','source'],expected=1)
npm('forced-root6067','run','test','--','--force','--cache-dir',BASE/'fresh-turbo-test-cache')
npm('forced-typecheck','run','typecheck','--','--force','--cache-dir',BASE/'fresh-turbo-type-cache')
npm('forced-lint','run','lint','--','--force','--cache-dir',BASE/'fresh-turbo-lint-cache')
npm('mobile-expo-compatibility','--workspace','apps/mobile','exec','--','expo','install','--check')
npm('ios-source-privacy-check','run','phase9:ios-privacy-source-audit:check')
npm('ios-source-privacy-tests','run','phase9:ios-privacy-source-audit:test')
npm('ios-archive-privacy-fixtures','run','phase9:ios-archive-privacy-evidence:test')
npm('canonical-phase4-worklist-check','run','phase4:source-worklist:check')
assert not git('status','--porcelain=v1','--untracked-files=all')
(OUT/'validation-complete.json').write_text(json.dumps({'status':'PASS','source':identity,'executions':len(rows),'adverse_checks':len(checks),'source_security_admitted':False},indent=2)+'\n')
print('PASS: complete validation; no source Security admission',flush=True)
