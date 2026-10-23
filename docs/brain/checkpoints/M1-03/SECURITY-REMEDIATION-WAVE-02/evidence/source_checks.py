"""Unchanged technical contracts and fresh install at the exact issued source."""
import datetime, hashlib, json, os, pathlib, subprocess, time
root=pathlib.Path('/work/repo');out=pathlib.Path('/evidence/source-checks');out.mkdir(exist_ok=False)
os.environ['PATH']='/work/bin:/work/node-v24.19.0-linux-x64/bin:'+os.environ['PATH']
def run(name,args,timeout=600,cwd=root):
    begin=time.monotonic()
    log_path=pathlib.Path('/work/private-baseline-audit.json') if name=='npm-audit' else out/(name+'.log')
    with log_path.open('wb') as f:
        try:code=subprocess.run(args,cwd=cwd,stdout=f,stderr=subprocess.STDOUT,timeout=timeout,env={**os.environ,'CI':'1','PYTHONDONTWRITEBYTECODE':'1','TURBO_TELEMETRY_DISABLED':'1','DO_NOT_TRACK':'1'}).returncode
        except subprocess.TimeoutExpired:code=124
    row=dict(argv=args,cwd=str(cwd),environment=dict(CI='1',PYTHONDONTWRITEBYTECODE='1',TURBO_TELEMETRY_DISABLED='1',DO_NOT_TRACK='1'),exit=code,seconds=time.monotonic()-begin,
        observed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),source_head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root).decode().strip(),
        source_tree=subprocess.check_output(['git','rev-parse','HEAD^{tree}'],cwd=root).decode().strip(),log_sha256=hashlib.sha256(log_path.read_bytes()).hexdigest(),raw_private=name=='npm-audit')
    (out/(name+'.receipt.json')).write_text(json.dumps(row,indent=2)+'\n');print(json.dumps(dict(name=name,exit=code,seconds=round(row['seconds'],2))),flush=True)
    return code
for name,pattern in [('security70','test_contract.py'),('secret12','test_secret_scan.py')]:run(name,['python3','-B','-m','unittest','discover','-s','scripts/phase9/security_acceptance','-p',pattern,'-v'])
run('governance103',['python3','-B','-m','unittest','discover','-s','scripts/brain','-p','test_*.py','-v'])
assert run('npm-ci',['npm','ci','--no-audit','--no-fund'],900)==0
run('expiry8',['node','--test','scripts/phase9/security-advisory-exceptions.test.mjs'])
run('mobile-expo',['node',str(root/'node_modules/expo/bin/cli'),'install','--check'],cwd=root/'apps/mobile')
run('ios-source-check',['npm','run','phase9:ios-privacy-source-audit:check'])
run('worklist-check',['npm','run','phase4:source-worklist:check'])
run('strict-original-report',['python3','-B','scripts/brain/brain.py','report','docs/brain/checkpoints/M1-03/SECURITY-CERTIFI-TOOLCHAIN-01/completion-report.json'])
run('strict-gf01-report',['python3','-B','scripts/brain/brain.py','--profile','M1-03-GOVERNANCE-FIXTURE-01','report','docs/brain/checkpoints/M1-03/GOVERNANCE-FIXTURE-01/completion-report.json'])
run('npm-node-forge-tree',['npm','ls','node-forge','--all','--json'])
run('npm-audit',['npm','audit','--audit-level=high','--json'])
(out/'complete.json').write_text(json.dumps(dict(source_modified=False,root_large_suites='NOT_RUN_DIAGNOSTIC_ONLY',original_source_guard='REFUSED_SOURCE_INVENTORY_DRIFT',stage_technical_edit_eligible=False),indent=2)+'\n')
