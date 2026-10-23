import hashlib,json,os,pathlib,subprocess,sys,time
sys.path.insert(0,'/work/repo/scripts/phase9/security_acceptance');import contract as c;import collect
out=pathlib.Path('/evidence/final-candidate-checks');out.mkdir(exist_ok=False)
old=pathlib.Path('/work/bridge2/old-site');new=pathlib.Path('/work/bridge2/candidate-env/lib/python3.12/site-packages')
for name,args,environment in [
 ('old-dependency-aware-dry-run',[sys.executable,'-B','-m','pip','--isolated','install','--dry-run','--require-hashes','--only-binary=:all:','--index-url','https://pypi.org/simple','-r','/work/repo/scripts/phase9/security_acceptance/semgrep-requirements-linux-py312.txt'],{'PYTHONPATH':str(old)}),
 ('old-pip-check',[sys.executable,'-B','-m','pip','check'],{'PYTHONPATH':str(old)}),
 ('new-pip-check',[sys.executable,'-B','-m','pip','--isolated','--python','/work/bridge2/candidate-env/bin/python','check'],{})]:
    start=time.monotonic()
    with (out/(name+'.log')).open('wb') as f:code=subprocess.run(args,stdout=f,stderr=subprocess.STDOUT,env={**os.environ,**environment},timeout=120).returncode
    row=dict(argv=args,cwd=os.getcwd(),environment=environment,exit=code,seconds=time.monotonic()-start,log_sha256=c.SHA((out/(name+'.log')).read_bytes()))
    (out/(name+'.receipt.json')).write_text(json.dumps(row,indent=2)+'\n');assert code==0
before=c.tool_tree(new,python_site=True);expected={'semgrepPackageTree':before};collect.verify_semgrep(new,expected)
extra=new/'wave02_adversarial_extra.py';assert not extra.exists();extra.write_bytes(b'# adversarial scratch fixture; never executed\n')
try:
    try:collect.verify_semgrep(new,expected);refused=False
    except c.Rejected as e:refused=str(e)=='SEMGREP_IMPLEMENTATION_DRIFT'
    assert refused
finally:extra.unlink()
assert c.tool_tree(new,python_site=True)==before
(out/'tool-tamper.json').write_text(json.dumps(dict(extra_code_refused=True,post_restore_tree=before,original_policy_unchanged=True,changed_wheel_refusal='evidence/bridge-runtime/metadata-adverse.json'),indent=2)+'\n')
print(json.dumps(dict(old_solver=True,old_pip_check=True,new_pip_check=True,extra_code_refused=True,restored=True)))
