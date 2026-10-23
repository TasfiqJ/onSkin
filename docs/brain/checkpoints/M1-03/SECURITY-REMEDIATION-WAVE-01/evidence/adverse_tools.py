"""Exercise the actual pip hash check and original installer/tree refusals."""
import datetime, json, pathlib, shutil, subprocess, sys, tempfile, unittest.mock
root=pathlib.Path('/work/repo'); out=pathlib.Path('/evidence/docker-adverse'); out.mkdir(exist_ok=False)
sys.path.insert(0,str(root/'scripts/phase9/security_acceptance'))
import bootstrap_tools as b
import collect
import contract as c
rows=[]
with tempfile.TemporaryDirectory(prefix='wave-forged-',dir='/work/tmp') as temp:
    temp=pathlib.Path(temp); forged=temp/'requirements.txt';forged.write_text('mcp==1.30.0 --hash=sha256:'+'0'*64+'\n')
    argv=[sys.executable,'-B','-m','pip','--isolated','download','--index-url','https://pypi.org/simple','--only-binary=:all:','--no-deps','--require-hashes','--dest',str(temp/'wheels'),'--requirement',str(forged)]
    result=subprocess.run(argv,capture_output=True,timeout=120); raw=result.stdout+result.stderr;(out/'forged-wheel.log').write_bytes(raw)
    assert result.returncode!=0 and b'THESE PACKAGES DO NOT MATCH THE HASHES' in raw
    rows.append({'case':'forged-wheel','argv':argv,'exit':result.returncode,'original_guard':'pip --require-hashes','log_sha256':c.SHA(raw),'rejected':True})
    fake=temp/'fake';fake.mkdir();shutil.copyfile(c.HERE/'proposal.json',fake/'proposal.json');(fake/b.REQUIREMENTS).write_bytes((c.HERE/b.REQUIREMENTS).read_bytes()+b'\n# forged requirements input\n')
    try:
        with unittest.mock.patch.object(b,'HERE',fake),unittest.mock.patch.object(sys,'argv',['bootstrap_tools.py',str(temp/'tools')]): b.main()
        raise AssertionError('FORGED_REQUIREMENTS_ACCEPTED')
    except c.Rejected as e:
        assert str(e)=='REQUIREMENTS_DRIFT';rows.append({'case':'forged-requirements','original_guard':'bootstrap_tools.main','rejection':str(e),'rejected':True})
    policy=c.load(c.HERE,'proposal.json'); forged_policy=dict(policy,semgrepPackageTree='0'*64)
    try:collect.verify_semgrep(pathlib.Path('/work/old/semgrep'),forged_policy);raise AssertionError('FORGED_TREE_ACCEPTED')
    except c.Rejected as e:
        assert str(e)=='SEMGREP_IMPLEMENTATION_DRIFT';rows.append({'case':'forged-package-tree','original_guard':'collect.verify_semgrep','rejection':str(e),'rejected':True})
(out/'receipt.json').write_text(json.dumps({'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rows':rows,'admission':'NONE'},indent=2)+'\n')
print(json.dumps(rows,indent=2))
