"""Run real unchanged baseline checks; never turn a refusal into a pass."""
import datetime, hashlib, json, os, pathlib, subprocess, sys, time
root=pathlib.Path(sys.argv[1]); out=pathlib.Path(sys.argv[2]); out.mkdir(exist_ok=False,parents=True)
runtime=pathlib.Path(os.environ.get('WAVE_NPM_RUNTIME',str(out/'npm-runtime')))
def run(name,argv,timeout=900,env=None):
    started=datetime.datetime.now(datetime.timezone.utc).isoformat(); begin=time.monotonic()
    with (out/(name+'.log')).open('wb') as log:
        try: code=subprocess.run(argv,cwd=root,stdout=log,stderr=subprocess.STDOUT,env={**os.environ,**(env or {})},timeout=timeout).returncode
        except subprocess.TimeoutExpired: code=124
    raw=(out/(name+'.log')).read_bytes()
    receipt={'name':name,'argv':argv,'cwd':str(root),'started':started,'ended':datetime.datetime.now(datetime.timezone.utc).isoformat(),
             'seconds':time.monotonic()-begin,'exit':code,'log_sha256':hashlib.sha256(raw).hexdigest(),
             'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root).decode().strip(),
             'tree':subprocess.check_output(['git','rev-parse','HEAD^{tree}'],cwd=root).decode().strip()}
    (out/(name+'.receipt.json')).write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps({'name':name,'exit':code,'seconds':round(receipt['seconds'],2)}),flush=True)
    return code
run('npm-tool',['npm','install','--prefix',str(runtime),'npm@11.20.0','--ignore-scripts','--bin-links=false','--no-audit','--no-fund'])
npm=['node',str(runtime/'node_modules/npm/bin/npm-cli.js')]
if run('npm-ci',npm+['ci','--no-audit','--no-fund'])!=0: sys.exit(1)
run('security70',['python3','-B','-m','unittest','discover','-s','scripts/phase9/security_acceptance','-p','test_contract.py','-v'])
run('secret12',['python3','-B','-m','unittest','discover','-s','scripts/phase9/security_acceptance','-p','test_secret_scan.py','-v'])
run('expiry8',['node','--test','scripts/phase9/security-advisory-exceptions.test.mjs'])
run('governance103',['python3','-B','-m','unittest','discover','-s','scripts/brain','-p','test_*.py','-v'])
for command in ('test','typecheck','lint'):
    run('root-'+command,npm+['run',command,'--','--force'],env={'TURBO_TELEMETRY_DISABLED':'1','DO_NOT_TRACK':'1'})
run('mobile-expo',['node',str(root/'node_modules/expo/bin/cli'),'install','--check'],env={'CI':'1'})
run('ios-source-check',npm+['run','phase9:ios-privacy-source-audit:check'])
run('ios-source-tests',npm+['run','phase9:ios-privacy-source-audit:test'])
run('worklist-check',npm+['run','phase4:source-worklist:check'])
run('strict-original-report',['python3','-B','scripts/brain/brain.py','report','docs/brain/checkpoints/M1-03/SECURITY-CERTIFI-TOOLCHAIN-01/completion-report.json'])
for name,args in [('npm-initial',['audit','--audit-level=high','--json']),('npm-installed',['audit','--audit-level=high','--json']),('npm-lock',['audit','--package-lock-only','--audit-level=high','--json'])]:
    run(name,npm+args,env={'npm_config_cache':os.environ.get('WAVE_AUDIT_CACHE',str(out/'audit-cold-cache'))})
