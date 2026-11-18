"""Engineering20 local evidence only. No network, archive, branch or ref write."""
import base64, datetime, hashlib, json, os, subprocess, sys, uuid
from pathlib import Path
OUT = Path(__file__).resolve().parent
REPO = OUT.parent/'c16-candidate'
PUBLISHED = 'd292743c99c1fb98f5714789f4fd60fb1e7d5a5d'
START = '2f699f6157c1d6414b7e74661a4e11e89a77ed92'
def git(*args, env=None): return subprocess.check_output(['git', *args], cwd=REPO, env=env)
def txt(*args): return git(*args).decode().strip()
def sha(data): return hashlib.sha256(data).hexdigest()
def write(name, value): (OUT/name).write_text(json.dumps(value, indent=2), encoding='utf-8')
assert txt('branch','--show-current') == 'stage/m1-native-runtime47'
assert not txt('status','--porcelain'), 'Clean source required'
head, tree = txt('rev-parse','HEAD'), txt('rev-parse','HEAD^{tree}')
for base in [START,PUBLISHED]: subprocess.run(['git','merge-base','--is-ancestor',base,head],cwd=REPO,check=True)
pre = json.loads((OUT/'PRECONDITIONS.json').read_text())
frozen = {}
for name in ['docs/release/full-app-j01/contract.v2.json','docs/release/full-app-j01/matrix.v2.json','docs/release/full-app-j01/precedence.v2.json','docs/release/full-app-j01/contract.v1.json','docs/release/full-app-j01/matrix.v1.json','docs/release/full-app-j01/precedence.v1.json','docs/hugeToDo/launch-contract.json']:
    assert (REPO/name).exists(), name
    original=git('show',START+':'+name); current=(REPO/name).read_bytes()
    assert original == git('show',head+':'+name), name
    assert sha(current) == sha(original), name
    frozen[name]=sha(current)
write('FROZEN_CONTRACT_VERIFICATION.json',{'unchangedByteForByte':True,'files':frozen,'all38':'UNACCEPTED','all18':'UNACCEPTED','release':'NO_GO'})
chain=[]; current=head
while True:
    raw=git('cat-file','commit',current)
    assert hashlib.sha1(b'commit '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==current
    headers=raw.split(b'\n\n',1)[0].splitlines(); parents=[v[7:].decode() for v in headers if v.startswith(b'parent ')]
    chain.append({'sha':current,'tree':next(v[5:].decode() for v in headers if v.startswith(b'tree ')), 'allParents':parents,
                  'length':len(raw),'payloadBase64':base64.b64encode(raw).decode(),'selectedParentIndex':None if current==PUBLISHED else 0})
    if current==PUBLISHED: break
    assert parents; current=parents[0]
chain.reverse()
write('COMMIT_ANCESTRY_WITNESS.json',{'format':'raw-git-commit-ancestry-v1','published':PUBLISHED,'target':head,'targetTree':tree,
      'firstParentPath':True,'pathBaseToTarget':chain,'limitation':'Commit-object hash/tree/ancestry proof; no acceptance, private keys or credentials.'})
result=subprocess.check_output([sys.executable,str(OUT/'verify_ancestry.py')],text=True)
(OUT/'ANCESTRY_VERIFICATION.json').write_text(result,encoding='utf-8')
index=Path(txt('rev-parse','--git-path','index')); index=index if index.is_absolute() else REPO/index
before=sha(index.read_bytes()); patches=[]
for label,base in [('CUMULATIVE_PR48_TO_ENGINEERING20',PUBLISHED),('SESSION_ENGINEERING19_TO_ENGINEERING20',START)]:
    patch=OUT/(label+'.patch'); patch.write_bytes(git('diff','--binary','--full-index','--no-renames',base,head,'--'))
    temp=OUT/('verify-index-'+uuid.uuid4().hex); env=dict(os.environ,GIT_INDEX_FILE=str(temp))
    base_tree=txt('rev-parse',base+'^{tree}')
    try:
        git('read-tree',base,env=env);git('apply','--cached','--binary','--check',str(patch),env=env);git('apply','--cached','--binary',str(patch),env=env)
        forward=git('write-tree',env=env).decode().strip();assert forward==tree
        git('apply','--cached','--binary','--reverse','--check',str(patch),env=env);git('apply','--cached','--binary','--reverse',str(patch),env=env)
        reverse=git('write-tree',env=env).decode().strip();assert reverse==base_tree
        patches.append({'file':patch.name,'base':base,'baseTree':base_tree,'target':head,'targetTree':tree,'bytes':patch.stat().st_size,
                        'sha256':sha(patch.read_bytes()),'forwardExactTree':forward,'reverseExactTree':reverse})
    finally:
        if temp.exists(): temp.unlink()
assert sha(index.read_bytes())==before and not txt('status','--porcelain')
write('PATCH_VERIFICATION.json',{'patches':patches,'activeIndexUnchanged':True,'cleanPorcelain':'','method':'isolated temporary index; no source checkout/ref/history mutation'})
def blobs(commit):
    return {line.split('\t',1)[1]:line.split('\t',1)[0].split()[2] for line in git('ls-tree','-r','-z',commit).decode().split('\0') if line}
final_blobs=blobs(head); published_blobs=blobs(PUBLISHED); files=[]
for name in git('ls-files','-z','--','apps','packages','scripts','docs').decode().split('\0'):
    if name: files.append({'path':name,'sha256':sha((REPO/name).read_bytes()),'blob':final_blobs[name]})
write('SOURCE_MANIFEST.json',{'head':head,'tree':tree,'files':files})
changes=[]
for name in txt('diff','--name-only','--no-renames',PUBLISHED,head).splitlines():
    entry={'path':name}
    for label,tree_blobs in [('published',published_blobs),('final',final_blobs)]:
        entry[label+'Blob']=tree_blobs.get(name)
    changes.append(entry)
write('CUMULATIVE_CHANGED_PATHS.json',{'count':len(changes),'paths':changes})
assert txt('rev-parse','HEAD')==head and sha(index.read_bytes())==before and not txt('status','--porcelain'), 'Source changed during packaging'
write('DELIVERY.json',{'status':'PARTIAL_LOCAL_CHECKPOINT','head':head,'tree':tree,'branch':txt('branch','--show-current'),
      'startingHead':START,'startingTree':txt('rev-parse',START+'^{tree}'),'published':PUBLISHED,'publishedTree':txt('rev-parse',PUBLISHED+'^{tree}'),
      'commits':txt('log','--reverse','--format=%H %s',START+'..'+head).splitlines(),'sessionChangedPaths':txt('diff','--name-only',START,head).splitlines(),
      'cleanWorktree':True,'recordedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'all38':'UNACCEPTED','all18':'UNACCEPTED',
      'release':'NO_GO','publication':'BLOCKED_EXTERNAL','evidenceCommit':None,'evidenceIndexUrl':None,'paidOperationsInitiated':0})
print(json.dumps({'head':head,'tree':tree,'commitObjects':len(chain),'patches':patches,'clean':True}))
