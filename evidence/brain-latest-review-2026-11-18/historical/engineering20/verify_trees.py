"""Recheck patches against an existing local Git object store; no checkout/network/ref changes."""
import hashlib, json, os, subprocess, sys, tempfile
from pathlib import Path
repo=Path(sys.argv[1]).resolve();evidence=Path(sys.argv[2]).resolve()
receipt=json.loads((evidence/'PATCH_VERIFICATION.json').read_text())
def git(*args,env=None):return subprocess.check_output(['git',*args],cwd=repo,env=env).decode().strip()
head=git('rev-parse','HEAD');status=git('status','--porcelain');results=[]
for patch in receipt['patches']:
    path=evidence/patch['file'];assert hashlib.sha256(path.read_bytes()).hexdigest()==patch['sha256']
    with tempfile.TemporaryDirectory(prefix='onskin-e20-tree-') as temporary:
        env=dict(os.environ,GIT_INDEX_FILE=str(Path(temporary)/'index'))
        git('read-tree',patch['base'],env=env);git('apply','--cached','--binary',str(path),env=env)
        assert git('write-tree',env=env)==patch['targetTree']
        git('apply','--cached','--binary','--reverse',str(path),env=env);assert git('write-tree',env=env)==patch['baseTree']
        results.append({'file':patch['file'],'forward':True,'reverse':True})
assert head==git('rev-parse','HEAD') and status==git('status','--porcelain')
print(json.dumps({'verified':True,'results':results,'sourceUnchanged':True}))
