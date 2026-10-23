import datetime, hashlib, json, pathlib, subprocess
CTX=pathlib.Path(__file__).resolve().parent
ROOT=CTX.parent/'onSkin_M103_CERTIFI_REPAIR01_EXACT_eaa47d7'
BASE='eaa47d7a1882dc395100bd0a958550a8beef406b'
MAIN='d9912f4c8b30358593569c5b9b4e84773c6f463e'
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def sha(b):return hashlib.sha256(b).hexdigest()
done=json.loads((CTX/'validation/validation-complete.json').read_bytes())
assert done['status']=='PASS'
proof=json.loads((CTX/'reproduction/attempt02/candidate-proof.json').read_bytes())
assert proof['status']=='PASS'
assert ROOT.resolve().name=='onSkin_M103_CERTIFI_REPAIR01_EXACT_eaa47d7'
assert git('branch','--show-current').strip()==b'stage/m1-gate-recovery'
assert git('rev-parse','HEAD').decode().strip()==BASE
assert git('rev-parse','HEAD^{tree}').strip()==b'7abcf80b45c88bad08f8411405c744c55d727093'
assert not git('status','--porcelain=v1','--untracked-files=all').strip()
refs=dict(line.split()[::-1] for line in git('ls-remote','origin','refs/heads/main','refs/heads/stage/m1-gate-recovery').decode().splitlines())
assert refs=={'refs/heads/main':MAIN,'refs/heads/stage/m1-gate-recovery':BASE}
pr=json.loads((CTX/'promotion-github.json').read_bytes())
assert pr['head_sha']==BASE and pr['base_sha']==MAIN and pr['draft'] is True and pr['state']=='open' and pr['merged'] is False
pre=json.loads((CTX/'SOURCE_PREIMAGES.json').read_bytes())
assert sha(json.dumps(pre,sort_keys=True,separators=(',',':')).encode())=='7c7499572becd4cc57bd96071e91fb6c033660022224f96e2474232d9a450833'
for f in pre['files']:
    b=git('show',BASE+':'+f['path'])
    assert sha(b)==f['sha256'] and len(b)==f['bytes'] and (ROOT/f['path']).read_bytes()==b
    assert git('rev-parse',BASE+':'+f['path']).decode().strip()==f['git_blob']
gitdir=pathlib.Path(git('rev-parse','--absolute-git-dir').decode().strip())
assert not list(gitdir.rglob('*.lock'))
files=['scripts/phase9/security_acceptance/semgrep-requirements-linux-py312.txt','scripts/phase9/security_acceptance/proposal.json']
candidate={name:subprocess.check_output(['wsl','-d','onskin-r6-verification','--','cat','/tmp/onskin-m103-certifi-0fd3eeace36a492bb97dfcd8d99231aa/repo/'+name]) for name in files}
assert sha(candidate[files[0]])==proof['changes']['requirementsSha256']
assert sha(candidate[files[1]])==proof['candidate_proposal_sha256']
for name in files:(ROOT/name).write_bytes(candidate[name])
assert set(git('diff','--name-only').decode().splitlines())==set(files)
subprocess.run(['git','diff','--check'],cwd=ROOT,check=True)
subprocess.run(['git','add',*files],cwd=ROOT,check=True)
subprocess.run(['git','commit','-m','fix(security): update exact certifi scanner dependency'],cwd=ROOT,check=True)
snapshot={'commit':git('rev-parse','HEAD').decode().strip(),'tree':git('rev-parse','HEAD^{tree}').decode().strip()}
assert snapshot['tree']==done['source']['tree']
assert not git('status','--porcelain=v1','--untracked-files=all').strip()
receipt={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'repeated_preimages':23,'refs':refs,'pr':pr,
         'source':snapshot,'scratch_source':done['source'],'tree_identical_to_tested_scratch':True,
         'postimages':[{'path':name,'bytes':len(candidate[name]),'sha256':sha(candidate[name]),'git_blob':git('rev-parse','HEAD:'+name).decode().strip()} for name in files]}
(CTX/'stage-promotion.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt,indent=2))
