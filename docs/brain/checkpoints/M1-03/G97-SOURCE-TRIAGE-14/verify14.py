"""External-digest checkpoint verifier; source evidence only, never admission."""
import argparse,hashlib,io,json,os,pathlib,re,stat,subprocess,sys,tempfile,unicodedata,zipfile
HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[4]
SOURCE='63c7d910ec85659f3180e4ea7ddd41c7f44e2c5c'
TREE='5d914609352e75b112997dea7043c6bfc0913ba1'
AUTH='BRAIN-M103-G97-SOURCE-TRIAGE14-CANDIDATE-01'
PREFIX='docs/brain/checkpoints/M1-03/G97-SOURCE-TRIAGE-14/'
LIMIT=64*1024**2
DIRECTORIES={}
def need(ok,code):
    if not ok:raise ValueError(code)
def sha(b):return hashlib.sha256(b).hexdigest()
def blob(b):return hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
def key(n):
    need(isinstance(n,str) and re.fullmatch('[A-Za-z0-9._/-]+',n) and not n.startswith('/') and
         all(p and p not in ('.','..') and not p.startswith('.') and not p.endswith('.') and
             not re.fullmatch('(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?',p,re.I) for p in n.split('/')),'UNSAFE_PACKET_PATH')
    return unicodedata.normalize('NFKC',n).casefold()
def regular(p):
    for part in [p,*[d for d in p.parents if d not in DIRECTORIES]]:
        s=part.lstat();need(not stat.S_ISLNK(s.st_mode) and not getattr(s,'st_file_attributes',0)&1024,'LINK_REPARSE')
        if part!=p:
            need(stat.S_ISDIR(s.st_mode),'PARENT_MODE')
            DIRECTORIES[part]=(s.st_dev,s.st_ino,s.st_mtime_ns,s.st_ctime_ns)
    before=p.stat();need(stat.S_ISREG(before.st_mode) and before.st_nlink==1 and before.st_size<=LIMIT,'FILE_MODE_BOUND')
    with p.open('rb') as f:b=f.read(LIMIT+1)
    after=p.stat();need(len(b)<=LIMIT and (before.st_dev,before.st_ino,before.st_size,before.st_mtime_ns)==(after.st_dev,after.st_ino,after.st_size,after.st_mtime_ns),'FILE_RACE')
    return b
def parse(b):
    def pairs(rows):
        d={}
        for k,v in rows:need(k not in d,'DUP_JSON');d[k]=v
        return d
    return json.loads(b,object_pairs_hook=pairs,parse_constant=lambda x:need(False,'NONFINITE_JSON'))
def git(*args):
    with tempfile.TemporaryFile() as errors:
        with subprocess.Popen(['git','-c','core.fsmonitor=false','-c','core.longpaths=true',*args],cwd=ROOT,stdout=subprocess.PIPE,stderr=errors) as p:
            try:
                b=p.stdout.read(LIMIT+1);need(len(b)<=LIMIT,'GIT_BOUND');need(p.wait(timeout=90)==0,'GIT_ERROR');return b
            finally:
                if p.poll() is None:p.kill();p.wait()
def nul(b):need(not b or b.endswith(b'\0'),'TRUNCATED_GIT');return b[:-1].split(b'\0') if b else []
def entries(commit):
    d={};seen=set()
    for item in nul(git('ls-tree','-rz','--full-tree',commit)):
        meta,name=item.split(b'\t',1);mode,kind,oid=meta.decode().split();name=name.decode('utf-8')
        normalized=unicodedata.normalize('NFKC',name).casefold()
        need(normalized not in seen,'GIT_COLLISION');seen.add(normalized)
        need(mode in ('100644','100755') and kind=='blob' and re.fullmatch('[0-9a-f]{40}',oid),'GIT_MODE')
        d[name]=(mode,oid)
    return d
def verify(expected):
    need(re.fullmatch('[0-9a-f]{64}',expected),'EXTERNAL_ANCHOR_FORMAT')
    raw=regular(HERE/'manifest.json');need(sha(raw)==expected,'EXTERNAL_MANIFEST_MISMATCH');m=parse(raw)
    need(m['schema']==1 and m['authority']==AUTH and m['source']==SOURCE and m['tree']==TREE and
         m['acceptanceGranted'] is False,'CHECKPOINT_IDENTITY')
    actual=set();seen=set()
    for p in HERE.rglob('*'):
        s=p.lstat();need(stat.S_ISREG(s.st_mode) or stat.S_ISDIR(s.st_mode),'PACKET_SPECIAL')
        need(not stat.S_ISLNK(s.st_mode) and not getattr(s,'st_file_attributes',0)&1024,'PACKET_LINK')
        if p.is_file():actual.add(p.relative_to(HERE).as_posix())
    need(actual=={r['path'] for r in m['files']}|{'manifest.json'},'CHECKPOINT_INVENTORY')
    for r in m['files']:
        k=key(r['path']);need(k not in seen,'CHECKPOINT_COLLISION');seen.add(k)
        b=regular(HERE/r['path']);need(r['mode']=='100644' and len(b)==r['bytes'] and sha(b)==r['sha256'] and blob(b)==r['blob'],'CHECKPOINT_FILE_IDENTITY')
    raw=regular(HERE/'evidence.zip')
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        seen=set();total=0
        for e in z.infolist():
            k=key(e.filename);need(k not in seen,'ZIP_COLLISION');seen.add(k);total+=e.file_size
            need(e.filename in m['archive_entries'] and not e.flag_bits&1 and
                 stat.S_IFMT(e.external_attr>>16)==stat.S_IFREG and e.file_size<=LIMIT and total<=256*1024**2,'ZIP_MODE_BOUND')
            b=z.read(e);r=m['archive_entries'][e.filename]
            need(r['mode']=='100644' and len(b)==r['bytes'] and sha(b)==r['sha256'] and blob(b)==r['blob'],'ZIP_ENTRY_IDENTITY')
        need(seen==set(m['archive_entries']),'ZIP_INVENTORY')
        proof=parse(z.read('source-proof.json'))
    need(proof['source']==SOURCE and proof['tree']==TREE and proof['acceptanceGranted'] is False,'SOURCE_PROOF')
    need(git('rev-parse',SOURCE+'^{tree}').decode().strip()==TREE,'SOURCE_TREE')
    original=entries(SOURCE);need(set(original)=={r['path'] for r in proof['frontier']},'FRONTIER_OMISSION')
    for r in proof['frontier']:
        name=r['path'];need(original[name]==(r['mode'],r['blob']),'SOURCE_MODE_BLOB')
        if name=='ONSKIN_BRAIN_HANDOFF.txt':continue
        b=regular(ROOT/name);need(sha(b)==r['sha256'] and blob(b)==r['blob'],'SOURCE_BYTES')
    for name in proof['protected_absences']:need(not os.path.lexists(ROOT/name),'PROTECTED_ABSENCE')
    handoff=regular(ROOT/'ONSKIN_BRAIN_HANDOFF.txt');need(sha(handoff)==m['handoff_sha256'],'HANDOFF_IDENTITY')
    head=git('rev-parse','HEAD').decode().strip();tree=entries(head)
    descendants=git('rev-list','--reverse',SOURCE+'..'+head).decode().splitlines()
    need(len(descendants)==1,'EXACT_ONE_EVIDENCE_TAIL')
    need(git('merge-base',SOURCE,head).decode().strip()==SOURCE,'TAIL_ANCESTRY')
    need(git('rev-list','--parents','-n','1',head).decode().split()==[head,SOURCE],'TAIL_LINEAR')
    fields=nul(git('diff','--raw','--no-abbrev','--no-renames','-z',SOURCE,head));need(len(fields)%2==0,'TAIL_DIFF')
    expected_paths={PREFIX+r['path'] for r in m['files']}|{PREFIX+'manifest.json','ONSKIN_BRAIN_HANDOFF.txt'}
    changed=set()
    for i in range(0,len(fields),2):
        meta=fields[i].decode().split();name=fields[i+1].decode();changed.add(name)
        need(name in expected_paths and len(meta)==5 and meta[1]=='100644','TAIL_SCOPE')
        need((name=='ONSKIN_BRAIN_HANDOFF.txt' and meta[0]==':100644' and meta[-1]=='M') or
             (name!='ONSKIN_BRAIN_HANDOFF.txt' and meta[0]==':000000' and meta[-1]=='A'),'TAIL_CREATE_EDIT')
        need(tree[name]==('100644',blob(regular(ROOT/name))),'TAIL_WORKTREE')
    need(changed==expected_paths,'TAIL_OMISSION')
    need(not git('status','--porcelain=v1','-uall').strip(),'DIRTY_CHECKOUT')
    for directory,identity in DIRECTORIES.items():
        s=directory.lstat()
        need(not stat.S_ISLNK(s.st_mode) and not getattr(s,'st_file_attributes',0)&1024 and
             stat.S_ISDIR(s.st_mode) and (s.st_dev,s.st_ino)==identity[:2] and
             (not directory.is_relative_to(ROOT) or
              (s.st_dev,s.st_ino,s.st_mtime_ns,s.st_ctime_ns)==identity),'PARENT_RACE')
    return dict(status='VERIFIED',source=SOURCE,tree=TREE,delivery=head,frontier=len(original),entries=len(m['archive_entries']),
                acceptanceGranted=False,release='NO_GO',final_delivery_ci='SEE_EXTERNALLY_AUTHENTICATED_FOUNDER_RETURN_AND_PR_BODY')
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--expected-manifest-sha256',required=True);a=p.parse_args()
    try:print(json.dumps(verify(a.expected_manifest_sha256),sort_keys=True));return 0
    except (ValueError,KeyError,TypeError,OSError,EOFError,zipfile.BadZipFile,subprocess.SubprocessError):
        print('{"status":"REJECTED","acceptanceGranted":false}');return 1
if __name__=='__main__':raise SystemExit(main())
