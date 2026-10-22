import os,sys,pathlib,subprocess,json,hashlib,types
repo=pathlib.Path('/root/onskin-postmerge-gate-triage01-candidate');out=pathlib.Path('/root/onskin-postmerge-gate-triage01-private')
os.chdir(repo);os.environ.update(GIT_NO_LAZY_FETCH='1',GITHUB_ACTIONS='false',PYTHONDONTWRITEBYTECODE='1');sys.path.insert(0,str(repo/'scripts/phase9/security_acceptance'))
import contract as c
raw=subprocess.check_output(['git','show','HEAD:scripts/phase9/security_acceptance/test_contract.py'])
module=types.ModuleType('original_contract');exec(compile(raw,'git-original-test_contract.py','exec'),module.__dict__)
module.ContractTests.setUpClass();t=module.ContractTests()
js="""import {assertLegacyAuditedSbom} from './scripts/phase9/security_acceptance/workflow_contract.mjs';import {readFileSync} from 'node:fs';const load=p=>JSON.parse(readFileSync(p,'utf8'));try {console.log(JSON.stringify(assertLegacyAuditedSbom({packet:load(process.argv[1]+'/dependency-inventory.json'),audit:load(process.argv[1]+'/dependency-sbom-audit.json'),lock:load('package-lock.json'),policy:load('docs/phase-9/security-advisory-exceptions.json'),auditExit:1,sbomExit:1})));}catch(e){console.error(JSON.stringify({name:e.name,code:e.code,operator:e.operator,assertion:e.stack.split('\\n').filter(l=>l.includes('at assertLegacyAuditedSbom'))}));process.exitCode=1;}"""
rows=[]
try:
 w,root,*_=t.workflow_fixture()
 for name,directory in [('original-unit',str(root/'code')),('real-provider','/mnt/c/Users/jasim/Documents/ChatGPT/MasterV2Code/triage01-private/provider-code')]:
  p=subprocess.run(['node','--input-type=module','-e',js,directory],capture_output=True,timeout=30)
  receipt=dict(case=name,exit=p.returncode,stdout_sha256=c.SHA(p.stdout),stderr_sha256=c.SHA(p.stderr),result=json.loads(p.stderr if p.returncode else p.stdout));rows.append(receipt)
finally:t.doCleanups()
fixture=c.load(c.HERE,'test-fixtures.json.gz');sb=fixture['sbom']['report'];gr=fixture['graph']['report']
def edges(node):return sum(1+edges(v) for v in node.get('dependencies',{}).values())
receipt={'measured_commit':c.git(repo,'rev-parse','HEAD').decode().strip(),'measured_tree':c.git(repo,'rev-parse','HEAD^{tree}').decode().strip(),'assertions':rows,'unchanged_graph_fixture_sha256':c.SHA(c.CANON(gr)),'graph_edges':edges(gr),'unchanged_cyclonedx_fixture_sha256':c.SHA(c.CANON(sb)),'components':len(sb['components']),'dependency_rows':len(sb['dependencies']),'dependency_edges':sum(len(r.get('dependsOn',[])) for r in sb['dependencies']),'validator_sha256':c.SHA((c.HERE/'workflow_contract.mjs').read_bytes()),'candidate_changed_paths':c.git(repo,'diff','--name-only').decode().splitlines(),'yaml_version':json.loads((repo/'node_modules/yaml/package.json').read_bytes())['version'],'node':subprocess.check_output(['node','--version']).decode().strip(),'python':sys.version.split()[0]}
(out/'causal-proof.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt,indent=2))
