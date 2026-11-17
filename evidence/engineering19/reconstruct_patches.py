import argparse, hashlib, json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,default=Path(__file__).resolve().parent);p.add_argument('--out',type=Path,required=True);args=p.parse_args()
manifest=json.loads((args.root/'MANIFEST.json').read_text(encoding='utf-8'))
for shard in manifest['fileManifestShards']:
 data=(args.root/shard['path']).read_bytes();assert hashlib.sha256(data).hexdigest()==shard['sha256']
 for item in json.loads(data)['files']:
  chunks=[]
  for part in item['parts']:
   content=(args.root/part['path']).read_bytes();content.decode('utf-8');assert len(content)==part['bytes'] and hashlib.sha256(content).hexdigest()==part['sha256'];chunks.append(content)
  content=b''.join(chunks);assert len(content)==item['publishedBytes'] and hashlib.sha256(content).hexdigest()==item['publishedSha256']
  if item['sourcePath'].endswith('.patch'):
   assert item['byteExact'] and hashlib.sha256(content).hexdigest()==item['sourceSha256']
   destination=args.out/Path(item['sourcePath']).name;destination.parent.mkdir(parents=True,exist_ok=True)
   assert not destination.exists(),'Refuse to overwrite reconstructed patch';destination.write_bytes(content)
   print(destination.name,len(content),hashlib.sha256(content).hexdigest())
