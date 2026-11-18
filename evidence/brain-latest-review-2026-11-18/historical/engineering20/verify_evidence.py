"""Verify and reassemble local downloaded evidence using only Python stdlib."""
import base64, hashlib, json
from pathlib import Path
root=Path(__file__).resolve().parent
def sha(b): return hashlib.sha256(b).hexdigest()
def checked(name):
    path=(root/name).resolve();assert root in path.parents,'Invalid manifest path';return path
for name,digest in json.loads((root/'FILE_SHA256.json').read_text()).items(): assert sha(checked(name).read_bytes())==digest,name
manifest=json.loads((root/'PUBLICATION_MANIFEST.json').read_text())
destination=root/'_reconstructed';destination.mkdir(exist_ok=True)
for entry in manifest['files']:
    parts=[]
    for part in entry['parts']:
        data=checked(part['path']).read_bytes();assert len(data)==part['bytes'] and sha(data)==part['sha256'];parts.append(data)
    data=b''.join(parts);assert len(data)==entry['publishedBytes'] and sha(data)==entry['publishedSha256']
    if entry['transformation'].startswith('none'): assert sha(data)==entry['originalSha256'] and len(data)==entry['originalBytes']
    target=(destination/entry['originalPath']).resolve();assert destination in target.parents
    target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
w=json.loads((destination/'COMMIT_ANCESTRY_WITNESS.json').read_text());rows=w['pathBaseToTarget']
assert rows[0]['sha']==w['published'] and rows[-1]['sha']==w['target'] and rows[-1]['tree']==w['targetTree']
for index,row in enumerate(rows):
    raw=base64.b64decode(row['payloadBase64'],validate=True);assert len(raw)==row['length']
    assert hashlib.sha1(b'commit '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==row['sha']
    if index: assert row['allParents'][row['selectedParentIndex']]==rows[index-1]['sha']
d=json.loads((destination/'DELIVERY.json').read_text());assert w['target']==d['head'] and w['targetTree']==d['tree']
print(json.dumps({'verified':True,'files':len(manifest['files']),'commitObjects':len(rows),'head':d['head'],'tree':d['tree'],'reconstructed':str(destination)}))
