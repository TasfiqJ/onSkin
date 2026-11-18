"""Standard library only. Offline integrity/reassembly of this publication.
Usage: python verify_evidence.py /path/to/evidence/root /new/output/directory
Download all files with their repository-relative layout first. No network/Git.
"""
import hashlib,json,sys
from pathlib import Path
root=Path(sys.argv[1]).resolve();dest=Path(sys.argv[2]).resolve()
if dest.exists():raise ValueError('Use a new output directory; existing files will not be overwritten')
dest.mkdir(parents=True)
def digest(b):return hashlib.sha256(b).hexdigest()
def safe(base,name):
 p=(base/name).resolve()
 if base not in p.parents:raise ValueError('unsafe relative manifest path')
 return p
def checked(row):
 data=safe(root,row['path']).read_bytes();data.decode('utf-8')
 if len(data)!=row['bytes']or digest(data)!=row['sha256']:raise ValueError('file mismatch: '+row['path'])
 return data
m=json.loads((root/'MANIFEST.json').read_text(encoding='utf-8'));records=[];files=0
for shard in m['shards']:records+=json.loads(checked(shard))['files'];files+=1
seen=set()
for row in records:
 chunks=[]
 for n,part in enumerate(row['parts'],1):
  if part['order']!=n or part['path']in seen:raise ValueError('duplicate/unordered part')
  seen.add(part['path']);chunks.append(checked(part));files+=1
 data=b''.join(chunks)
 if len(data)!=row['publishedBytes']or digest(data)!=row['publishedSha256']:raise ValueError('reassembled mismatch')
 if row['byteExact']and(row['sourceBytes']!=len(data)or row['sourceSha256']!=digest(data)):raise ValueError('exact original mismatch')
 target=safe(dest,row['logicalPath']);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
actual={p.relative_to(root).as_posix()for p in root.rglob('*')if p.is_file()}
expected=seen|{s['path']for s in m['shards']}|{'MANIFEST.json'}
if actual!=expected:raise ValueError('file-set mismatch; missing/extra paths')
print(json.dumps({'verified':True,'logicalFiles':len(records),'publishedFiles':len(expected),'hashedFiles':files,'manifestRoot':'Transport-authenticated by immutable Git commit/blob; root excludes its own recursive digest','output':str(dest),'patches':[{'path':r['logicalPath'],'bytes':r['publishedBytes'],'sha256':r['publishedSha256']}for r in records if r['logicalPath'].startswith('patches/')]},indent=2))
