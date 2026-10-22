import pathlib,os,subprocess,json,hashlib,time
repo=pathlib.Path('/root/onskin-postmerge-gate-triage01-candidate');out=pathlib.Path('/root/onskin-postmerge-gate-triage01-private');os.chdir(repo);os.environ.update(GIT_NO_LAZY_FETCH='1',PYTHONDONTWRITEBYTECODE='1',GITHUB_ACTIONS='false')
patch='/mnt/c/Users/jasim/Documents/ChatGPT/MasterV2Code/postmerge-gate-triage01-stage/docs/brain/checkpoints/M1-03/POSTMERGE-GATE-TRIAGE-01/candidates/0001-unit-sbom-use-original-producer.patch'
p=repo/'scripts/phase9/security_acceptance/test_contract.py';raw=p.read_bytes();blob=subprocess.check_output(['git','hash-object','-w',str(p)]).decode().strip();assert subprocess.check_output(['git','cat-file','-t',blob]).strip()==b'blob'
receipt=dict(path=str(p.relative_to(repo)),bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest(),git_blob=blob,scope='disposable clone only; never stage or main')
(out/'candidate-postimage.json').write_text(json.dumps(receipt,indent=2)+'\n')
rows=[]
def run(name,args,cwd=repo):
 t=time.monotonic();p=subprocess.run(args,cwd=cwd,capture_output=True,timeout=90);raw=p.stdout+b'\nSTDERR\n'+p.stderr;(out/(name+'.log')).write_bytes(raw);r=dict(name=name,command=args,exit=p.returncode,seconds=round(time.monotonic()-t,2),sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw));rows.append(r);print(json.dumps(r),flush=True);return p
assert run('candidate-reverse-apply',['git','apply','-R',patch]).returncode==0
assert run('candidate-reversal-clean',['git','diff','--exit-code']).returncode==0
assert run('reversed-original-targeted',['python3','-B','-m','unittest','test_contract.ContractTests.test_original_workflow_valid_known_artifacts_are_technical_only','-v'],repo/'scripts/phase9/security_acceptance').returncode==1
assert run('candidate-fresh-apply-check',['git','apply','--check',patch]).returncode==0
run('local-database-source-contract',['node','scripts/phase2/local-supabase-contract.mjs'])
(out/'finish-results.json').write_text(json.dumps(rows,indent=2)+'\n')
