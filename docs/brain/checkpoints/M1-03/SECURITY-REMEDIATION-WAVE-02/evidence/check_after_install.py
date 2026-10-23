"""Repeat the complete unchanged Security suite after its YAML dependency exists."""
import datetime,hashlib,json,os,pathlib,subprocess,time
root=pathlib.Path('/work/repo');out=pathlib.Path('/evidence/after-install');out.mkdir(exist_ok=False)
env={**os.environ,'PATH':'/work/bin:/work/node-v24.19.0-linux-x64/bin:'+os.environ['PATH'],'PYTHONDONTWRITEBYTECODE':'1','CI':'1'}
for name,args in [('security70',['python3','-B','-m','unittest','discover','-s','scripts/phase9/security_acceptance','-p','test_contract.py','-v']),('strict-gf01-report',['python3','-B','scripts/brain/brain.py','--profile','M1-03','report','docs/brain/checkpoints/M1-03/GOVERNANCE-FIXTURE-01/completion-report.json'])]:
    start=time.monotonic()
    with (out/(name+'.log')).open('wb') as f:
        try:code=subprocess.run(args,cwd=root,stdout=f,stderr=subprocess.STDOUT,timeout=360,env=env).returncode
        except subprocess.TimeoutExpired:code=124
    row=dict(argv=args,cwd=str(root),exit=code,seconds=time.monotonic()-start,observed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),source_head='0ecfa2a646ce9b30e717f6995097515f884cfdaf',source_tree='b6b5ec635dd12e327a34904ebbd1e1252715bcd4',log_sha256=hashlib.sha256((out/(name+'.log')).read_bytes()).hexdigest())
    (out/(name+'.receipt.json')).write_text(json.dumps(row,indent=2)+'\n');print(json.dumps(row),flush=True)
