#!/usr/bin/env python3
"""Verify this extracted task context against a Brain-supplied external SHA256."""
import argparse,hashlib,json,pathlib,re,sys

def main():
 p=argparse.ArgumentParser()
 p.add_argument('--expected-manifest-sha256',required=True)
 args=p.parse_args()
 expected=args.expected_manifest_sha256.lower()
 if not re.fullmatch(r'[0-9a-f]{64}',expected):raise ValueError('EXTERNAL_MANIFEST_SHA256_FORMAT')
 root=pathlib.Path(__file__).resolve().parent
 raw=(root/'TASK_MANIFEST.json').read_bytes()
 if hashlib.sha256(raw).hexdigest()!=expected:raise ValueError('EXTERNAL_MANIFEST_SHA256_MISMATCH')
 manifest=json.loads(raw)
 if manifest.get('schema_version')!=1 or manifest.get('file_count')!=len(manifest.get('files',[])):raise ValueError('MANIFEST_SCHEMA')
 names=[v['path'] for v in manifest['files']]
 if len(names)!=len(set(x.lower() for x in names)):raise ValueError('CASE_COLLISION')
 for row in manifest['files']:
  name=row['path'];f=root/name
  if name.startswith('/') or '..' in pathlib.PurePosixPath(name).parts or '/' in name or '\\' in name or not f.is_file() or f.is_symlink():raise ValueError('PATH_OR_SYMLINK:'+name)
  b=f.read_bytes()
  if len(b)!=row['bytes'] or hashlib.sha256(b).hexdigest()!=row['sha256']:raise ValueError('MEMBER_HASH:'+name)
 actual={x.name for x in root.iterdir() if x.is_file()}
 if actual!=set(names)|{'TASK_MANIFEST.json'}:raise ValueError('MISSING_OR_EXTRA_MEMBERS')
 src=json.loads((root/'SOURCE_PREIMAGES.json').read_bytes())
 state=json.loads((root/'TASK_STATE.json').read_bytes())
 digest=hashlib.sha256(json.dumps(src,sort_keys=True,separators=(',',':')).encode()).hexdigest()
 if digest!=state['preimage_fingerprint'] or len(src['files'])!=state['preimage_count']:raise ValueError('PREIMAGE_FINGERPRINT')
 if src['commit']!=manifest['base_commit'] or src['tree']!=manifest['base_tree']:raise ValueError('BASE_BINDING')
 auth=json.loads((root/'SOURCE_EDIT_AUTHORIZATION.json').read_bytes())
 if auth['authorization_id']!=manifest['authorization_id']:raise ValueError('GRANT_BINDING')
 print(f"VERIFIED: task={manifest['iteration']} members={len(names)} preimages={len(src['files'])} external_manifest={expected}; NO_AUTHORITY_BEYOND_PACKET")
if __name__=='__main__':
 try:main()
 except Exception as exc:
  print('INVALID_ISSUANCE:'+str(exc),file=sys.stderr)
  sys.exit(1)
