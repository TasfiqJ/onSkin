"""Read-only authenticated handoff integrity; not source or gate acceptance."""
from pathlib import Path
import argparse, hashlib, json, os, re, stat, sys, unicodedata
root=Path(__file__).resolve().parent
p=argparse.ArgumentParser()
p.add_argument('--expected-manifest-sha256',required=True)
a=p.parse_args()
assert re.fullmatch(r'[0-9a-f]{64}',a.expected_manifest_sha256),'ANCHOR_FORMAT'
def sha(b):return hashlib.sha256(b).hexdigest()
def safe(name):
    assert isinstance(name,str) and name and not name.startswith('/') and '\\' not in name and ':' not in name
    parts=name.split('/')
    assert all(x not in ('','.','..') and not x.endswith((' ','.')) and not re.search(r'[\x00-\x1f]',x) for x in parts)
    return unicodedata.normalize('NFKC',name).casefold()
m=root/'manifest.json'
assert sha(m.read_bytes())==a.expected_manifest_sha256,'ANCHOR_MISMATCH'
manifest=json.loads(m.read_text('utf-8'))
assert manifest['format']==1 and manifest['purpose']=='Campaign11 handoff only'
rows=manifest['files']; names=[r['path'] for r in rows]
expected=names+['manifest.json','EXACT_PROMPT.md']
assert len(expected)==len(set(safe(x) for x in expected)),'COLLISION'
actual=[]
for f in root.rglob('*'):
    s=f.lstat(); assert not stat.S_ISLNK(s.st_mode),'LINK'; assert stat.S_ISDIR(s.st_mode) or stat.S_ISREG(s.st_mode),'NONREGULAR'
    if f.is_file(): actual.append(f.relative_to(root).as_posix())
assert set(actual)==set(expected),'INVENTORY'
for r in rows:
    f=root/r['path']; st=f.lstat(); assert stat.S_ISREG(st.st_mode),'NOT_FILE'
    raw=f.read_bytes(); assert len(raw)==r['bytes'] and sha(raw)==r['sha256'],'FILE:'+r['path']
    assert int(r['mode'],8)==0o644,'MODE'
assert (root/'EXACT_PROMPT.md').read_bytes()==(root/'PROMPT_TEMPLATE.md').read_bytes().replace(b'__EXTERNAL_MANIFEST_SHA256__',a.expected_manifest_sha256.encode()),'EXACT_PROMPT_DERIVATION'
print('VERIFIED:',len(rows),'manifest entries and exact pasted prompt derivation; handoff integrity only')
