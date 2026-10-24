import ast,hashlib,json,pathlib,stat,subprocess
ROOT=pathlib.Path(r'C:\Users\jasim\Desktop\WeddingCards\work\m102-retained-resilience')
OUT=pathlib.Path(__file__).parent
BASE='8ac97c32901272d97d1bff05f2abc294811055a6'
def git(*a):return subprocess.check_output(['git',*a],cwd=ROOT)
def tree(ref):
 result={}
 for item in git('ls-tree','-r','-z',ref).split(b'\0'):
  if item:
   m,p=item.split(b'\t');mode,kind,blob=m.decode().split();result[p.decode()]={'mode':mode,'kind':kind,'blob':blob}
 return result
assert not git('status','--porcelain=v1').strip()
source=git('rev-parse','HEAD').decode().strip();base=tree(BASE);current=tree(source)
edited={'scripts/release/full-app-j01/check.py','docs/phase-4/generated/source-worklist.json','docs/phase-4/generated/source-worklist.md','ONSKIN_BRAIN_HANDOFF.txt'}
protected={p:r for p,r in base.items() if p not in edited}
commits=[]
for c in git('rev-list','--reverse',BASE+'..HEAD').decode().splitlines():
 entries=tree(c)
 assert all(entries.get(p)==r for p,r in protected.items())
 changed={p:dict(r,sha256=hashlib.sha256(git('show',c+':'+p)).hexdigest()) for p,r in entries.items() if base.get(p)!=r}
 commits.append(dict(commit=c,tree=git('rev-parse',c+'^{tree}').decode().strip(),parents=git('rev-list','--parents','-n','1',c).decode().split()[1:],changed_from_release09=changed))
rows=[];total=0
for p,r in current.items():
 f=ROOT/p;s=f.lstat();assert stat.S_ISREG(s.st_mode) and not (getattr(s,'st_file_attributes',0)&1024),p
 digest=hashlib.sha256();blob=hashlib.sha1(('blob '+str(s.st_size)+'\0').encode())
 with f.open('rb') as stream:
  while True:
   chunk=stream.read(1024*1024)
   if not chunk:break
   digest.update(chunk);blob.update(chunk)
 assert blob.hexdigest()==r['blob'],('WORKING_BLOB_MISMATCH',p)
 rows.append(dict(path=p,**r,sha256=digest.hexdigest(),bytes=s.st_size,protected=p in protected))
 total+=s.st_size
proof=dict(base=BASE,base_tree='a59fc7ea1cc57901f6d848ff5009734f446bdff2',source=source,
 source_tree=git('rev-parse','HEAD^{tree}').decode().strip(),protected_count=len(protected),file_count=len(rows),tracked_bytes=total,
 files=rows,intermediate_commits=commits,absences=['apps/mobile/src/features/janus','apps/professional','apps/pro'],
 qualification='SOURCE_AND_GIT_IDENTITY_CONSISTENCY_NOT_INDEPENDENT_ACCEPTANCE')
for p in proof['absences']:assert not (ROOT/p).exists(),p
(OUT/'source-proof.json').write_bytes((json.dumps(proof,indent=2)+'\n').encode())
print(json.dumps({k:v for k,v in proof.items() if k not in ('files','intermediate_commits')}))
