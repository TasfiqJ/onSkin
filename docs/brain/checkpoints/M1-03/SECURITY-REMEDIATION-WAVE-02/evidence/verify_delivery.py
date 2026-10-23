"""Verify final allowlist, protected bytes and regular committed evidence blobs."""
import argparse,hashlib,json,pathlib,re,subprocess,sys
sys.dont_write_bytecode=True
root=pathlib.Path(__file__).resolve().parents[6];checkpoint=pathlib.Path(__file__).resolve().parent.parent
prefix=checkpoint.relative_to(root).as_posix()+'/'
base='0ecfa2a646ce9b30e717f6995097515f884cfdaf';tree='b6b5ec635dd12e327a34904ebbd1e1252715bcd4'
sha=lambda b:hashlib.sha256(b).hexdigest()
git=lambda *a:subprocess.check_output(['git','-C',str(root),*a])
def permitted(path):
    parts=path.split('/')
    return not any(p in ('','.','..') for p in parts) and '\\' not in path and (path.startswith(prefix) or path=='ONSKIN_BRAIN_HANDOFF.txt')
def guards():
    assert git('branch','--show-current').strip()==b'stage/m1-gate-recovery'
    assert git('rev-parse',base+'^{tree}').decode().strip()==tree
    assert not (root/'.git/objects/info/alternates').exists()
    subprocess.run(['git','-C',str(root),'merge-base','--is-ancestor',base,'HEAD'],check=True)
    changed=set(git('diff','--name-only',base).decode().splitlines())
    changed.update(git('ls-files','--others','--exclude-standard').decode().splitlines())
    assert changed and all(permitted(p) for p in changed),sorted(p for p in changed if not permitted(p))
    spec=json.loads((checkpoint/'inputs/context/PREIMAGE_PATHS.json').read_bytes());rows=[]
    for name in sorted(spec['paths']):
        fields=git('ls-tree',base,'--',name).decode().split();mode,kind,oid=fields[:3];raw=git('cat-file','blob',oid)
        assert kind=='blob' and mode=='100644'
        assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==oid
        if name!='ONSKIN_BRAIN_HANDOFF.txt':assert (root/name).read_bytes()==raw and git('show','HEAD:'+name)==raw,name
        rows.append(dict(path=name,bytes=len(raw),git_blob=oid,sha256=sha(raw),mode=mode))
    fingerprint=sha(json.dumps(dict(commit=base,tree=tree,files=rows),sort_keys=True,separators=(',',':')).encode())
    assert fingerprint=='51bef23541f736bc2a890e25ae5ca8ac6c60104b2aef2906262f2038fee5a0d7'
    return dict(original_git_objects=27,unchanged_other_workfiles=26,baseline_fingerprint=fingerprint,scope_paths=len(changed),technical_source_edits=0)
def write_manifest():
    entries=[];self_path=prefix+'SHA256SUMS.json'
    for path in sorted([p for p in checkpoint.rglob('*') if p.is_file()]+[root/'ONSKIN_BRAIN_HANDOFF.txt']):
        name=path.relative_to(root).as_posix()
        if name==self_path:continue
        assert permitted(name) and not path.is_symlink() and path.stat().st_nlink==1
        raw=path.read_bytes()
        if not name.endswith('.zip'):
            value=raw.decode('utf-8-sig');assert '\0' not in value
            assert not re.search(r'https://[^\s"<>]+[?&]sig=',value),'SIGNED_DOWNLOAD_URL_MUST_NOT_BE_COMMITTED'
        entries.append(dict(path=name,bytes=len(raw),sha256=sha(raw),git_blob=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest(),mode='100644',disposition='REVIEW_REQUIRED_EVIDENCE_GROWTH_NO_SOURCE_ADMISSION'))
    obj=dict(schema_version=1,source_commit=base,source_tree=tree,files=entries,self_reference_excluded=self_path,
        note='Candidate hashes are verified against regular committed Git blobs after commit. Every new checkpoint path and factual handoff is individually review-required. This is not the frozen Security source-manifest or scan coverage.')
    (checkpoint/'SHA256SUMS.json').write_text(json.dumps(obj,indent=2)+'\n',encoding='utf-8')
    return len(entries)
def verify_manifest():
    obj=json.loads((checkpoint/'SHA256SUMS.json').read_bytes());names=[]
    for row in obj['files']:
        name=row['path'];assert permitted(name);names.append(name)
        fields=git('ls-tree','HEAD','--',name).decode().split();assert fields[:2]==['100644','blob'] and fields[2]==row['git_blob'],name
        raw=git('cat-file','blob',fields[2]);assert len(raw)==row['bytes'] and sha(raw)==row['sha256'] and (root/name).read_bytes()==raw,name
    actual={p.relative_to(root).as_posix() for p in checkpoint.rglob('*') if p.is_file()}|{'ONSKIN_BRAIN_HANDOFF.txt'}
    assert set(names)|{obj['self_reference_excluded']}==actual and len(names)==len(set(names))
    assert not git('status','--porcelain=v1','--untracked-files=all')
    return len(names)
for bad in ('.github/workflows/security.yml','apps/mobile/package.json','scripts/phase9/security_acceptance/bootstrap_tools.py','docs/brain/state/roadmap.json',prefix+'../outside',prefix+'/bad'):
    assert not permitted(bad)
assert permitted(prefix+'README.md') and permitted('ONSKIN_BRAIN_HANDOFF.txt')
parser=argparse.ArgumentParser();parser.add_argument('--write-manifest',action='store_true');parser.add_argument('--verify-manifest',action='store_true');args=parser.parse_args()
result=guards()
if args.write_manifest:result['manifest_written_entries']=write_manifest()
if args.verify_manifest:result['committed_regular_blobs_verified']=verify_manifest()
print(json.dumps(result,sort_keys=True))
