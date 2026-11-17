import base64, hashlib, json, subprocess, sys
from pathlib import Path
root=Path(sys.argv[1])if len(sys.argv)>1 else Path(__file__).resolve().parent
m=json.loads((root/'MANIFEST.json').read_text(encoding='utf-8'))
for entry in m['publishedFiles']:
 data=(root/entry['path']).read_bytes();data.decode('utf-8');assert len(data)==entry['bytes'] and hashlib.sha256(data).hexdigest()==entry['sha256'],entry['path'];assert len(data)<=m['maximumPartBytes']
for shard in m['fileManifestShards']:
 for record in json.loads((root/shard['path']).read_text(encoding='utf-8'))['files']:
  data=b''.join((root/p['path']).read_bytes()for p in record['parts']);assert len(data)==record['publishedBytes'] and hashlib.sha256(data).hexdigest()==record['publishedSha256']
  if record['byteExact']:assert record['sourceSha256']==record['publishedSha256'] and record['sourceBytes']==record['publishedBytes']
matrix=json.loads((root/'reports/ALL38_ALL18_MATRIX.json').read_text(encoding='utf-8'));assert len(matrix['rows'])==38 and len(matrix['gates'])==18
assert all(r['formalAcceptance']=='UNACCEPTED'and not r['ownerAdmitted']for r in matrix['rows'])
assert all(g['formalAcceptance']=='UNACCEPTED'and not g['admitted']for g in matrix['gates'])
subprocess.run([sys.executable,str(root/'ancestry/verify_ancestry.py'),str(root/'ancestry/COMMIT_ANCESTRY_WITNESS.json')],check=True)
print(json.dumps({'allPublishedFilesVerified':len(m['publishedFiles']),'allOriginalTextFilesRepresented':m['originalTextFiles'],'all38All18Unaccepted':True}))
