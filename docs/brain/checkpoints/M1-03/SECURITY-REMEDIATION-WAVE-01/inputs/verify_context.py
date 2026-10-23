#!/usr/bin/env python3
import argparse, hashlib, json, pathlib, sys

def digest(v):return hashlib.sha256(v).hexdigest()
def verify():
 p=argparse.ArgumentParser();p.add_argument('--expected-manifest-sha256',required=True);a=p.parse_args()
 if len(a.expected_manifest_sha256)!=64 or any(c not in '0123456789abcdef' for c in a.expected_manifest_sha256):raise ValueError('BAD_EXTERNAL_SHA')
 root=pathlib.Path(__file__).resolve().parent;raw=(root/'TASK_MANIFEST.json').read_bytes()
 if digest(raw)!=a.expected_manifest_sha256:raise ValueError('EXTERNAL_MANIFEST_DRIFT')
 m=json.loads(raw);lst=m.get('files',[])
 if m.get('schema_version')!=1 or m.get('file_count')!=len(lst):raise ValueError('SCHEMA')
 expected={'TASK_MANIFEST.json'}
 for item in lst:
  name=item['path'];part=pathlib.PurePosixPath(name)
  if name in expected or part.is_absolute() or '/' in name or '\\' in name or '..' in part.parts:raise ValueError('UNSAFE_MEMBER')
  expected.add(name);f=root/name
  if not f.is_file() or f.is_symlink():raise ValueError('MISSING_MEMBER:'+name)
  b=f.read_bytes()
  if item['bytes']!=len(b) or item['sha256']!=digest(b):raise ValueError('BAD_MEMBER:'+name)
 if {f.name for f in root.iterdir() if f.is_file()}!=expected:raise ValueError('UNEXPECTED_FILES')
 pre=json.loads((root/'PREIMAGE_WITNESSES.json').read_bytes());scope=json.loads((root/'SOURCE_EDIT_AUTHORIZATION.json').read_bytes())
 if pre['commit']!=m['base_commit'] or pre['tree']!=m['base_tree'] or scope['authorization_id']!=m['authorization_id']:raise ValueError('AUTH_DRIFT')
 print('VERIFIED',len(lst),'members,',len(pre['files']),'preimages, external SHA',a.expected_manifest_sha256)
if __name__=='__main__':
 try:verify()
 except Exception as e:print('INVALID_CONTEXT',str(e),file=sys.stderr);sys.exit(1)
