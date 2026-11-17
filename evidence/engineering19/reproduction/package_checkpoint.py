import base64, datetime, hashlib, json, os, shutil, subprocess, sys, uuid, zipfile
from pathlib import Path
OUT=Path(__file__).resolve().parent
REPO=OUT.parent/'c16-candidate'
PUBLISHED='d292743c99c1fb98f5714789f4fd60fb1e7d5a5d'
START='77d929253ed283fff30cae6f8cc753c61c666320'
VALIDATED='f3398a5d9'
def git(*args,env=None):return subprocess.check_output(['git',*args],cwd=REPO,env=env)
def txt(*args):return git(*args).decode('utf-8').strip()
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
assert txt('branch','--show-current')=='stage/m1-native-runtime47'
assert not txt('status','--porcelain'), 'Worktree must be clean'
head=txt('rev-parse','HEAD');tree=txt('rev-parse','HEAD^{tree}')
subprocess.run(['git','merge-base','--is-ancestor',PUBLISHED,head],cwd=REPO,check=True)
chain=[];current=head
while True:
    raw=git('cat-file','commit',current)
    assert hashlib.sha1(b'commit '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==current
    headers=raw.split(b'\n\n',1)[0].split(b'\n')
    parents=[line[7:].decode('ascii') for line in headers if line.startswith(b'parent ')]
    entry={'sha':current,'tree':next(line[5:].decode('ascii') for line in headers if line.startswith(b'tree ')), 'allParents':parents,'length':len(raw),'payloadBase64':base64.b64encode(raw).decode('ascii'),'selectedParentIndex':None}
    chain.append(entry)
    if current==PUBLISHED:break
    eligible=[i for i,parent in enumerate(parents) if subprocess.run(['git','merge-base','--is-ancestor',PUBLISHED,parent],cwd=REPO,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0]
    assert eligible,'No verified parent path'
    selected=eligible[0];entry['selectedParentIndex']=selected;current=parents[selected]
chain.reverse()
witness={'format':'raw-git-commit-ancestry-v1','published':PUBLISHED,'target':head,'targetTree':tree,'firstParentPath':all(e['selectedParentIndex']==0 for e in chain[1:]),'pathBaseToTarget':chain,'limitation':'Commit hash/tree/ancestry proof only; no tree blobs, test acceptance, private keys, or credentials.'}
(OUT/'COMMIT_ANCESTRY_WITNESS.json').write_text(json.dumps(witness,indent=2),encoding='utf-8')
verified=subprocess.check_output([sys.executable,'-X','utf8',str(OUT/'verify_ancestry.py')],cwd=OUT,text=True)
(OUT/'ANCESTRY_VERIFICATION.json').write_text(verified,encoding='utf-8')
index=Path(txt('rev-parse','--git-path','index'))
if not index.is_absolute():index=REPO/index
activeBefore=digest(index)
patches=[]
for label,base in [('CUMULATIVE_PR48_TO_ENGINEERING19',PUBLISHED),('SESSION_ENGINEERING18_TO_ENGINEERING19',START)]:
    patch=OUT/(label+'.patch');patch.write_bytes(git('diff','--binary','--full-index','--no-renames',base,head,'--'))
    temp=OUT/('verify-index-'+uuid.uuid4().hex)
    env=os.environ.copy();env['GIT_INDEX_FILE']=str(temp)
    baseTree=txt('rev-parse',base+'^{tree}')
    try:
        git('read-tree',base,env=env)
        git('apply','--cached','--binary','--check',str(patch),env=env)
        git('apply','--cached','--binary',str(patch),env=env)
        forward=git('write-tree',env=env).decode().strip();assert forward==tree
        git('apply','--cached','--binary','--reverse','--check',str(patch),env=env)
        git('apply','--cached','--binary','--reverse',str(patch),env=env)
        reverse=git('write-tree',env=env).decode().strip();assert reverse==baseTree
        patches.append({'file':patch.name,'base':base,'baseTree':baseTree,'target':head,'targetTree':tree,'bytes':patch.stat().st_size,'sha256':digest(patch),'forwardExactTree':forward,'reverseExactTree':reverse,'method':'isolated temporary index, no checkout/branch/worktree/reset/history mutation'})
    finally:
        if temp.exists():temp.unlink()
assert digest(index)==activeBefore
assert not txt('status','--porcelain')
(OUT/'PATCH_VERIFICATION.json').write_text(json.dumps({'patches':patches,'activeIndexUnchanged':True,'cleanPorcelain':'','head':head,'tree':tree},indent=2),encoding='utf-8')
runtimeChanges=txt('diff','--name-only','6e5e0acb11e08e3bde29e5b0cb81eb07fb9b0a76',head,'--','apps','packages','scripts').splitlines()
assert all(path.endswith('.test.ts') for path in runtimeChanges),runtimeChanges
manifest=[]
for name in git('ls-files','-z','--','apps','packages','scripts').decode().split('\0'):
    if not name:continue
    manifest.append({'path':name,'sha256':digest(REPO/name)})
(OUT/'SOURCE_MANIFEST.json').write_text(json.dumps({'head':head,'tree':tree,'files':manifest,'changesSinceBrowserAndBuildSource':runtimeChanges},indent=2),encoding='utf-8')
receipt={'status':'PARTIAL_LOCAL_CHECKPOINT / NO_GO','head':head,'tree':tree,'branch':txt('branch','--show-current'),'initialHead':START,'published':PUBLISHED,'commits':txt('log','--reverse','--format=%H %s',START+'..'+head).splitlines(),'patches':patches,'cleanWorktree':True,'sourceFiles':len(manifest),'ancestryObjects':len(chain),'recordedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'all38':'UNACCEPTED','all18':'UNACCEPTED','release':'NO_GO','push':False,'paidOperations':0}
(OUT/'DELIVERY.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
report=OUT/'FINAL_REPORT.md'
report.write_text(report.read_text(encoding='utf-8').replace('{{FINAL_HEAD}}',head).replace('{{FINAL_TREE}}',tree),encoding='utf-8')
prompt=OUT/'NEXT_SESSION_PROMPT.md'
prompt.write_text(prompt.read_text(encoding='utf-8').replace('{{FINAL_HEAD}}',head).replace('{{FINAL_TREE}}',tree),encoding='utf-8')
delivery='# Engineering19 local checkpoint\n\nHEAD `'+head+'`\n\nTree `'+tree+'`\n\n'+''.join(f"- {p['file']}: {p['bytes']} bytes; SHA256 `{p['sha256']}`; forward/reverse exact-tree PASS.\n"for p in patches)+'\nClean worktree, same branch, no push. All38/all18 UNACCEPTED; release NO_GO. See FINAL_REPORT.md.\n'
(OUT/'DELIVERY.md').write_text(delivery,encoding='utf-8')
hashes={str(path.relative_to(OUT)).replace('\\','/'):digest(path)for path in sorted(OUT.rglob('*'))if path.is_file() and path.name not in ['EVIDENCE_SHA256.json']}
(OUT/'EVIDENCE_SHA256.json').write_text(json.dumps(hashes,indent=2),encoding='utf-8')
archive=Path(r'[LOCAL_USER_HOME]\Downloads\onSkin_ENGINEERING19_REVIEW.zip')
assert not archive.exists(),'Never overwrite a delivered archive'
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6)as z:
    for path in sorted(OUT.rglob('*')):
        if path.is_file():z.write(path,str(path.relative_to(OUT)).replace('\\','/'))
with zipfile.ZipFile(archive)as z:assert z.testzip()is None
archiveReceipt={'file':str(archive),'bytes':archive.stat().st_size,'sha256':digest(archive),'head':head,'tree':tree,'archiveIntegrity':'PASS','note':'External archive hash intentionally lives outside the archive.'}
(OUT.parent/'ENGINEERING19_ARCHIVE_RECEIPT.json').write_text(json.dumps(archiveReceipt,indent=2),encoding='utf-8')
print(json.dumps(archiveReceipt,indent=2))
