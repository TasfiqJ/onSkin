"""Verify reconstructed patches against exact Git trees with isolated indexes.
Usage: python verify_trees.py /path/to/existing/repository /path/to/reconstructed
No checkout, reset, branch switch, active-index mutation or network is used.
Git may write ordinary unreachable tree/blob objects while applying to temp indexes.
"""
import hashlib,json,os,subprocess,sys,tempfile
from pathlib import Path
repo=Path(sys.argv[1]).resolve();root=Path(sys.argv[2]).resolve()
def git(*a,env=None,data=None):return subprocess.check_output(['git',*a],cwd=repo,env=env,input=data)
def ident():return [git('rev-parse','HEAD'),git('rev-parse','HEAD^{tree}'),git('status','--porcelain=v1')]
before=ident();ip=Path(git('rev-parse','--git-path','index').decode().strip());ip=ip if ip.is_absolute() else repo/ip
old=ip.read_bytes()if ip.exists()else None
receipt=json.loads((root/'PATCH_VERIFICATION.json').read_text(encoding='utf-8'));results=[]
with tempfile.TemporaryDirectory(prefix='onskin-patch-verification-')as td:
 for p in receipt['patches']:
  data=(root/p['file']).read_bytes()
  if len(data)!=p['bytes']or hashlib.sha256(data).hexdigest()!=p['sha256']:raise ValueError('patch transport mismatch')
  for rev,start,expected in [(False,p['base'],p['targetTree']),(True,p['target'],p['baseTree'])]:
   index=Path(td)/(('reverse-'if rev else'forward-')+Path(p['file']).name+'.index');env=dict(os.environ,GIT_INDEX_FILE=str(index))
   git('read-tree',start,env=env);a=['apply','--cached','--binary','--whitespace=nowarn']+(['--reverse']if rev else[])
   git(*a,env=env,data=data);tree=git('write-tree',env=env).decode().strip()
   if tree!=expected:raise ValueError('exact tree mismatch')
   results.append({'file':p['file'],'reverse':rev,'tree':tree,'verified':True})
if before!=ident()or old!=(ip.read_bytes()if ip.exists()else None):raise ValueError('active source/index changed')
print(json.dumps({'verified':True,'results':results,'sourceAndIndexPreserved':True},indent=2))
