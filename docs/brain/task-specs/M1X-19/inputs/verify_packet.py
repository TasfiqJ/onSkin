"""Deterministic externally anchored Campaign19 context verifier. Does not grant source acceptance."""
import argparse, hashlib, json, os, re, stat, sys, unicodedata
from pathlib import Path

def require(ok, why):
    if not ok: raise ValueError(why)

def digest(data): return hashlib.sha256(data).hexdigest()

def pairs(kvs):
    d={}
    for k,v in kvs:
        require(k not in d, 'DUPLICATE_MANIFEST_KEY')
        d[k]=v
    return d

def name_ok(p):
    if not re.fullmatch(r'[A-Za-z0-9._/-]+',p) or p.startswith('/') or '\\' in p: return False
    for c in p.split('/'):
        if c in ('','.','..') or c.startswith('.') or c.endswith('.') or re.fullmatch(r'(?i:(con|prn|aux|nul|com[1-9]|lpt[1-9]))(\..*)?',c): return False
    return True

def regular(path,root):
    root=root.resolve()
    require(path.is_relative_to(root),'OUTSIDE_ROOT')
    for part in (path,*path.parents):
        if part==root.parent: break
        m=part.lstat().st_mode
        require(not stat.S_ISLNK(m) and not getattr(part.lstat(),'st_file_attributes',0)&1024,'SYMLINK_OR_REPARSE')
        if part==root: break
    info=path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_nlink==1, 'NONREGULAR_OR_HARDLINK')
    return path.read_bytes()

def verify(root,anchor):
    require(re.fullmatch(r'[0-9a-f]{64}',anchor) is not None,'BAD_EXTERNAL_ANCHOR')
    raw=regular(root/'manifest.json',root)
    require(digest(raw)==anchor,'EXTERNAL_MANIFEST_SHA256_MISMATCH')
    data=json.loads(raw,object_pairs_hook=pairs)
    require(set(data)=={'schema','authority','status','release','acceptanceGranted','admissions','files'},'MANIFEST_SCHEMA')
    require(data['schema']==1 and data['authority']=='BRAIN-M1X-ONBOARDING-COMPATIBILITY19-REPAIR-01','IDENTITY')
    require(data['status']=='SOURCE_ONLY_CONTEXT' and data['release']=='NO_GO' and data['acceptanceGranted'] is False, 'NO_ADMISSION')
    require(data['admissions']=={'DB':False,'G97':False,'J01':False,'M103':False,'M2':False,'PUBLIC':False},'GATE_STATUS')
    witness=data['files']
    require(isinstance(witness,dict) and 5<=len(witness)<=32,'FILE_COUNT')
    expected=set(witness)|{'manifest.json'}
    found=set()
    names=set()
    for path in root.rglob('*'):
        rel=path.relative_to(root).as_posix()
        require(name_ok(rel),'UNSAFE_PATH:'+rel)
        key=unicodedata.normalize('NFKC',rel).casefold()
        require(key not in names,'CASEFOLD_COLLISION:'+rel); names.add(key)
        mode=path.lstat().st_mode
        require(not stat.S_ISLNK(mode) and not getattr(path.lstat(),'st_file_attributes',0)&1024,'LINK_REPARSE:'+rel)
        require(stat.S_ISREG(mode) and path.stat().st_nlink==1,'NONREGULAR:'+rel)
        found.add(rel)
    require(found==expected,'EXACT_INVENTORY_MISMATCH:missing='+str(sorted(expected-found))+';extra='+str(sorted(found-expected)))
    for name,desc in witness.items():
        require(name_ok(name) and set(desc)=={'bytes','sha256'},'WITNESS_FORMAT')
        value=regular(root/name,root)
        require(len(value)==desc['bytes'] and len(value)<1_000_000 and digest(value)==desc['sha256'],'HASH_MISMATCH:'+name)
    prompt=(root/'TASK_DIRECTIVE.md').read_bytes()
    require(prompt==(root/'PROMPT_TEMPLATE.md').read_bytes()==(root/'EXACT_PROMPT.md').read_bytes(),'INTERNAL_PROMPT_MISMATCH')
    require(prompt.startswith(b'CAMPAIGN19 ') and b'BRAIN-M1X-ONBOARDING-COMPATIBILITY19-REPAIR-01' in prompt,'PROMPT_AUTHORITY')
    return {'status':'VERIFIED','count':len(witness),'manifest_sha256':anchor,'prompt_sha256':digest(prompt),'admissions':data['admissions']}

def main():
    p=argparse.ArgumentParser();p.add_argument('--expected-manifest-sha256',required=True);a=p.parse_args()
    try:
        print(json.dumps(verify(Path(__file__).resolve().parent,a.expected_manifest_sha256),sort_keys=True))
        return 0
    except (ValueError,OSError,KeyError,TypeError,json.JSONDecodeError) as e:
        print(json.dumps({'status':'CONTEXT_INVALID','error':str(e),'release':'NO_GO'}))
        return 1
if __name__=='__main__': sys.exit(main())
