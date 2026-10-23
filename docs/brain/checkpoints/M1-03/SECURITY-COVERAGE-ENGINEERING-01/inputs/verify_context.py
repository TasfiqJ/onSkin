#!/usr/bin/env python3
"""Verify one Brain-issued exact context; requires external manifest SHA256."""
import argparse,hashlib,json,pathlib,re,sys

def SHA(b):return hashlib.sha256(b).hexdigest()

def verify(folder,expected):
 if not re.fullmatch('[0-9a-f]{64}',expected):raise ValueError('INVALID_EXTERNAL_SHA256')
 raw=(folder/'TASK_MANIFEST.json').read_bytes()
 if SHA(raw)!=expected:raise ValueError('MANIFEST_HASH_MISMATCH')
 m=json.loads(raw)
 rows=m.get('files',[])
 if m.get('schema_version')!=1 or m.get('file_count')!=len(rows):raise ValueError('MANIFEST_SCHEMA')
 names=[]
 for r in rows:
  p=r['path'];pp=pathlib.PurePosixPath(p)
  if not p or p=='TASK_MANIFEST.json' or '/' in p or '\\' in p or pp.is_absolute() or '..' in pp.parts:raise ValueError('UNSAFE_MEMBER')
  f=folder/p
  if not f.is_file() or f.is_symlink():raise ValueError('MISSING_OR_LINKED_'+p)
  b=f.read_bytes()
  if len(b)!=r['bytes'] or SHA(b)!=r['sha256']:raise ValueError('MEMBER_SHA_OR_LENGTH_'+p)
  names.append(p)
 if len(names)!=len(set(p.lower() for p in names)):raise ValueError('DUPLICATE_CASEFOLD')
 present={x.name for x in folder.iterdir() if x.is_file()}
 if present!=set(names)|{'TASK_MANIFEST.json'}:raise ValueError('MISSING_EXTRA_FILES')
 pre=json.loads((folder/'PREIMAGE_WITNESSES.json').read_bytes())
 canonical=json.dumps(pre,sort_keys=True,separators=(',',':')).encode()
 authority=json.loads((folder/'SOURCE_AUTHORIZATION.json').read_bytes())
 if SHA(canonical)!=authority['preimage_fingerprint'] or len(pre['files'])!=24:raise ValueError('SOURCE_PREIMAGE_FINGERPRINT')
 if pre['commit']!=m['base_commit'] or pre['tree']!=m['base_tree']:raise ValueError('BASE_BINDING')
 if authority['authorization_id']!=m['authorization_id']:raise ValueError('AUTH_BINDING')
 print('VERIFIED',len(names),'context members',len(pre['files']),'Git preimage witnesses; external manifest',expected)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--expected-manifest-sha256',required=True)
 args=p.parse_args()
 try:verify(pathlib.Path(__file__).resolve().parent,args.expected_manifest_sha256)
 except Exception as e: print('INVALID_ISSUANCE',str(e),file=sys.stderr);sys.exit(1)
