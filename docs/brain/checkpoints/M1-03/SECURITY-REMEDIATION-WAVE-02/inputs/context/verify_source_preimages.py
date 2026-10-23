#!/usr/bin/env python3
"""Verify Git preimage identity, checkout cleanliness and WORKTREE bytes from an externally anchored list+fingerprint."""
import argparse,hashlib,json,pathlib,subprocess,sys,re

def git(root,*a):
 p=subprocess.run(['git','-C',str(root),*a],capture_output=True)
 if p.returncode:raise ValueError('GIT:'+repr(a)+':'+p.stderr.decode(errors='replace')[:160])
 return p.stdout

def main():
 a=argparse.ArgumentParser();a.add_argument('--repo',required=True);a.add_argument('--expected-fingerprint',required=True);v=a.parse_args()
 root=pathlib.Path(v.repo).resolve();bundle=pathlib.Path(__file__).resolve().parent
 obj=json.loads((bundle/'PREIMAGE_PATHS.json').read_bytes());h=obj['commit'];t=obj['tree']
 if not re.fullmatch(r'[0-9a-f]{64}',v.expected_fingerprint):raise ValueError('BAD_EXPECTED_FINGERPRINT')
 if v.expected_fingerprint!=obj['preimage_fingerprint_sha256']:raise ValueError('WRONG_EXTERNAL_FINGERPRINT')
 if git(root,'rev-parse','HEAD').decode().strip()!=h:raise ValueError('STALE_HEAD')
 if git(root,'rev-parse','HEAD^{tree}').decode().strip()!=t:raise ValueError('STALE_TREE')
 if git(root,'branch','--show-current').decode().strip()!='stage/m1-gate-recovery':raise ValueError('WRONG_BRANCH')
 if git(root,'status','--porcelain=v1'):raise ValueError('DIRTY_CHECKOUT')
 if git(root,'remote','get-url','origin').decode().strip()!='https://github.com/TasfiqJ/onSkin.git':raise ValueError('WRONG_ORIGIN')
 if (root/'.git/objects/info/alternates').exists():raise ValueError('SHARED_OBJECTS')
 paths=obj['paths']
 if len(paths)!=len(set(paths)):raise ValueError('DUPLICATE_PATH')
 rows=[]
 for path in paths:
  if pathlib.PurePosixPath(path).is_absolute() or '..' in pathlib.PurePosixPath(path).parts:raise ValueError('BAD_PATH')
  oid=git(root,'rev-parse',h+':'+path).decode().strip()
  if git(root,'cat-file','-t',oid).strip()!=b'blob':raise ValueError('NON_BLOB:'+path)
  b=git(root,'cat-file','blob',oid)
  work=root.joinpath(*path.split('/'))
  if not work.is_file() or work.is_symlink() or work.read_bytes()!=b:raise ValueError('WORKING_BYTE_DRIFT:'+path)
  mode=git(root,'ls-tree',h,path).decode().split()[0]
  rows.append({'path':path,'bytes':len(b),'git_blob':oid,'sha256':hashlib.sha256(b).hexdigest(),'mode':mode})
 fingerprint=hashlib.sha256(json.dumps({'commit':h,'tree':t,'files':sorted(rows,key=lambda x:x['path'])},sort_keys=True,separators=(',',':')).encode()).hexdigest()
 if fingerprint!=v.expected_fingerprint:raise ValueError('PREIMAGE_FINGERPRINT_MISMATCH:'+fingerprint)
 print('VERIFIED: source preimages='+str(len(rows))+' fingerprint='+fingerprint+' branch=stage/m1-gate-recovery clean')
if __name__=='__main__':
 try:main()
 except Exception as e:print('INVALID_SOURCE: '+str(e),file=sys.stderr);sys.exit(1)
