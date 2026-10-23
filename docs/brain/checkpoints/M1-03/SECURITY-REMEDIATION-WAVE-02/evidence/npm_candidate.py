"""Same-SDK Expo dependency trial in a fresh disposable exact clone only."""
import datetime,hashlib,json,os,pathlib,subprocess,time,urllib.request
source=pathlib.Path('/work/repo');root=pathlib.Path('/work/npm-candidate');out=pathlib.Path('/evidence/npm-candidate');out.mkdir(exist_ok=False)
env={**os.environ,'PATH':'/work/bin:/work/node-v24.19.0-linux-x64/bin:'+os.environ['PATH'],'CI':'1','npm_config_cache':'/work/npm-candidate-cache'}
def run(name,args,cwd=root,timeout=600,private=False):
    start=time.monotonic();log=pathlib.Path('/work')/('private-'+name+'.json') if private else out/(name+'.log')
    with log.open('wb') as f:
        try:code=subprocess.run(args,cwd=cwd,stdout=f,stderr=subprocess.STDOUT,timeout=timeout,env=env).returncode
        except subprocess.TimeoutExpired:code=124
    row=dict(argv=args,cwd=str(cwd),exit=code,seconds=time.monotonic()-start,log_sha256=hashlib.sha256(log.read_bytes()).hexdigest(),raw_private=private)
    (out/(name+'.receipt.json')).write_text(json.dumps(row,indent=2)+'\n');print(json.dumps(dict(name=name,exit=code)),flush=True)
    return code,log
assert run('clone',['git','clone','--no-hardlinks','--single-branch','--branch','stage/m1-gate-recovery',str(source),str(root)],cwd='/work')[0]==0
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=root).strip()==b'0ecfa2a646ce9b30e717f6995097515f884cfdaf'
original=(root/'package-lock.json').read_bytes();original_packages=json.loads(original)['packages']
# A same-SDK update obeys the ORIGINAL ~57.0.31 manifest and can only solve within SDK57.
assert run('sdk57-lock-candidate',['npm','update','expo','--workspace','apps/mobile','--package-lock-only','--ignore-scripts','--no-audit','--no-fund'])[0]==0
candidate=(root/'package-lock.json').read_bytes();packages=json.loads(candidate)['packages']
delta=[dict(path=p,old=original_packages.get(p),new=packages.get(p)) for p in sorted(original_packages.keys()|packages.keys()) if original_packages.get(p)!=packages.get(p)]
assert run('candidate-npm-ci',['npm','ci','--no-audit','--no-fund'],timeout=900)[0]==0
expo=run('candidate-expo-compatibility',['node',str(root/'node_modules/expo/bin/cli'),'install','--check'],cwd=root/'apps/mobile')[0]
run('candidate-node-forge-tree',['npm','ls','node-forge','--all','--json'])
audit_exit,audit=run('candidate-audit',['npm','audit','--audit-level=high','--json'],private=True)
report=json.loads(audit.read_bytes());findings=[]
for name,r in report.get('vulnerabilities',{}).items():
    findings.append(dict(package=name,severity=r['severity'],isDirect=r.get('isDirect'),range=r.get('range'),via=[dict(name=v.get('name'),source=v.get('source'),url=v.get('url'),range=v.get('range'),severity=v.get('severity')) if isinstance(v,dict) else v for v in r['via']],effects=r.get('effects',[]),nodes=r.get('nodes',[]),fixAvailable=r.get('fixAvailable')))
result=dict(source_head='0ecfa2a646ce9b30e717f6995097515f884cfdaf',source_tree='b6b5ec635dd12e327a34904ebbd1e1252715bcd4',original_lock_sha256=hashlib.sha256(original).hexdigest(),candidate_lock_sha256=hashlib.sha256(candidate).hexdigest(),
    original_expo=original_packages['node_modules/expo']['version'],candidate_expo=packages['node_modules/expo']['version'],package_delta_count=len(delta),delta=delta,expo_compatibility_exit=expo,audit_exit=audit_exit,audit_counts=report.get('metadata',{}).get('vulnerabilities'),sanitized_findings=findings,
    node_forge_versions=sorted({r['version'] for p,r in packages.items() if p.endswith('/node-forge')}),zod_versions=sorted({r['version'] for p,r in packages.items() if p.endswith('/zod')}),stage_edit=False,accepted=False,decision='REJECT_IF_NODE_FORGE_OR_ZOD_ADVISORY_REMAINS')
(out/'summary.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ('delta','sanitized_findings')},indent=2))
