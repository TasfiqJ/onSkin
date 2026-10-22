import os,sys,pathlib,subprocess,json,hashlib,time
repo=pathlib.Path('/root/onskin-postmerge-gate-triage01-candidate')
out=pathlib.Path('/root/onskin-postmerge-gate-triage01-private')
os.chdir(repo);os.environ.update(GIT_NO_LAZY_FETCH='1',GITHUB_ACTIONS='false',PYTHONDONTWRITEBYTECODE='1')
rows=[]
def run(name,args,cwd=repo):
 t=time.monotonic();p=subprocess.run(args,cwd=cwd,capture_output=True,timeout=240)
 raw=p.stdout+b'\nSTDERR\n'+p.stderr;(out/(name+'.log')).write_bytes(raw)
 row=dict(name=name,command=args,exit=p.returncode,seconds=round(time.monotonic()-t,2),sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw));rows.append(row)
 print(json.dumps(row),flush=True);return p
here=repo/'scripts/phase9/security_acceptance'
sys.path.insert(0,str(here))
import test_contract as tc
tc.ContractTests.setUpClass();t=tc.ContractTests()
try:
 w,root,needs,commit,run_id,fresh=t.workflow_fixture()
 run('original-sbom-wrapper',['node',str(here/'workflow_contract.mjs'),'sbom',str(root/'code')])
 js="""import {assertLegacyAuditedSbom} from './scripts/phase9/security_acceptance/workflow_contract.mjs';
import {readFileSync} from 'node:fs';
const load=p=>JSON.parse(readFileSync(p,'utf8'));
try {console.log(JSON.stringify(assertLegacyAuditedSbom({packet:load(process.argv[1]+'/code/dependency-inventory.json'),audit:load(process.argv[1]+'/code/dependency-sbom-audit.json'),lock:load('package-lock.json'),policy:load('docs/phase-9/security-advisory-exceptions.json'),auditExit:1,sbomExit:1})));}
catch(e){console.error(JSON.stringify({name:e.name,code:e.code,operator:e.operator,stack:e.stack.split('\\n').filter(l=>!l.includes('node:internal')).slice(0,5)}));process.exitCode=1;}
"""
 p=run('underlying-assertion',['node','--input-type=module','-e',js,str(root)])
 print(p.stderr.decode(),flush=True)
 packet=json.loads((root/'code/dependency-inventory.json').read_bytes());lock=json.loads((repo/'package-lock.json').read_bytes())
 old={x['path']:x for x in packet['packages']};current={p:m for p,m in lock['packages'].items() if p}
 changed=[dict(path=p,fields=[k for k in ('version','license','resolved') if old[p][k]!=current[p].get(k)]) for p in sorted(old.keys()&current.keys()) if any(old[p][k]!=current[p].get(k) for k in ('version','license','resolved'))]
 delta=dict(packet_count=len(old),lock_count=len(current),missing=sorted(current.keys()-old.keys()),extra=sorted(old.keys()-current.keys()),changed=changed)
 (out/'package-delta.json').write_text(json.dumps(delta,indent=2)+'\n');print(json.dumps(delta),flush=True)
finally:t.doCleanups()
run('original-targeted',['python3','-B','-m','unittest','test_contract.ContractTests.test_original_workflow_valid_known_artifacts_are_technical_only','-v'],here)
run('original-70',['python3','-B','-m','unittest','discover','-s','scripts/phase9/security_acceptance','-p','test_contract.py','-v'])
run('original-secret-12',['python3','-B','-m','unittest','discover','-s','scripts/phase9/security_acceptance','-p','test_secret_scan.py','-v'])
run('original-workflow-structure',['node','--input-type=module','-e',"import {validateWorkflowAdmission} from './scripts/phase9/security_acceptance/workflow_contract.mjs';import {readFileSync} from 'node:fs';const valid=validateWorkflowAdmission(readFileSync('.github/workflows/security.yml','utf8'));console.log(JSON.stringify({valid,approval:false}));if(!valid)process.exitCode=1;"])
(out/'baseline-results.json').write_text(json.dumps(rows,indent=2)+'\n')
