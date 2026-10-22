import os,sys,pathlib,subprocess,json,hashlib,time
repo=pathlib.Path('/root/onskin-postmerge-gate-triage01-candidate');out=pathlib.Path('/root/onskin-postmerge-gate-triage01-private')
os.chdir(repo);os.environ.update(GIT_NO_LAZY_FETCH='1',GITHUB_ACTIONS='false',PYTHONDONTWRITEBYTECODE='1')
rows=[]
def run(name,args,cwd=repo):
 t=time.monotonic();p=subprocess.run(args,cwd=cwd,capture_output=True,timeout=300);raw=p.stdout+b'\nSTDERR\n'+p.stderr;(out/(name+'.log')).write_bytes(raw)
 row=dict(name=name,command=args,exit=p.returncode,seconds=round(time.monotonic()-t,2),sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw));rows.append(row);print(json.dumps(row),flush=True);return p
path=repo/'scripts/phase9/security_acceptance/test_contract.py';original=path.read_text()
assert hashlib.sha256(path.read_bytes()).hexdigest()=='73e31496101f9e0dd3bfc0bb716e0717ebfdfeecea1627c5d43853c3a1f1638c'
start=original.index('  # Actual source-generated packet; only the unit fixture\'s clock is refreshed.')
end=original.index("  write('code/dependency-inventory.json'",start)
replacement='''  # Synthetic audit replay only: invoke the unchanged producer against the
  # current lock. This unit packet is never a scanner receipt or acceptance.
  execution=c.load(c.HERE,'legacy-sbom-fixture.json.gz')
  with tempfile.TemporaryDirectory(prefix='g97-unit-sbom-producer-') as d:
   producer=pathlib.Path(d);(producer/'docs/phase-9').mkdir(parents=True)
   (producer/'package-lock.json').write_bytes(c.safe(c.ROOT,'package-lock.json'))
   (producer/'docs/phase-9/security-advisory-exceptions.json').write_bytes(c.safe(c.ROOT,'docs/phase-9/security-advisory-exceptions.json'))
   (producer/'audit.json').write_bytes(c.CANON(execution['audit']))
   stub=producer/'unit-audit.mjs'
   stub.write_text("import {readFileSync} from 'node:fs';process.stdout.write(readFileSync(new URL('audit.json',import.meta.url)));process.exitCode=1;")
   generated=subprocess.run(['node',str(c.ROOT/'scripts/phase9/dependency-sbom.mjs')],cwd=producer,
     env={'PATH':os.environ['PATH'],'PHASE9_RUN_NPM_AUDIT':'true','npm_execpath':str(stub),
          'npm_config_offline':'false','PHASE9_DEPENDENCY_AUDIT_PASS':'false'},capture_output=True,timeout=30)
   self.assertEqual(generated.returncode,1)  # Preserve the real expired-policy refusal.
   sbom=c.load(producer,'docs/phase-9/generated/dependency-inventory.json')
'''
path.write_text(original[:start]+replacement+original[end:])
patch=subprocess.check_output(['git','diff','--','scripts/phase9/security_acceptance/test_contract.py'])
dest=pathlib.Path('/mnt/c/Users/jasim/Documents/ChatGPT/MasterV2Code/postmerge-gate-triage01-stage/docs/brain/checkpoints/M1-03/POSTMERGE-GATE-TRIAGE-01/candidates');dest.mkdir(parents=True,exist_ok=True)
(dest/'0001-unit-sbom-use-original-producer.patch').write_bytes(patch)
here=repo/'scripts/phase9/security_acceptance'
run('candidate-targeted',['python3','-B','-m','unittest','test_contract.ContractTests.test_original_workflow_valid_known_artifacts_are_technical_only','-v'],here)
run('candidate-adverse',['python3','-B','-m','unittest','test_contract.ContractTests.test_original_workflow_sbom_unrelated_failure_or_fabrication_rejects','test_contract.ContractTests.test_original_workflow_sbom_execution_exit_cannot_be_waived','test_contract.ContractTests.test_original_workflow_unknown_npm_or_osv_finding_rejects','test_contract.ContractTests.test_SBOM_component_and_dependency_edge_omissions_rejected','test_contract.ContractTests.test_owner_receipt_requires_exact_binding_signature_and_time','-v'],here)
run('candidate-70',['python3','-B','-m','unittest','discover','-s','scripts/phase9/security_acceptance','-p','test_contract.py','-v'])
run('canonical-image-source-contract',['node','--test','scripts/phase2/canonical-postgres-pull-retry.test.mjs','scripts/phase2/local-supabase-reset-source.test.mjs'])
(out/'candidate-results.json').write_text(json.dumps(rows,indent=2)+'\n')
