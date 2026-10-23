#!/usr/bin/env python3
"""Immutable context verifier using an EXTERNAL manifest digest."""
import argparse,hashlib,json,pathlib,re,sys

def sha(b):return hashlib.sha256(b).hexdigest()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--expected-manifest-sha256',required=True);args=ap.parse_args()
 expected=args.expected_manifest_sha256.lower()
 if not re.fullmatch(r'[0-9a-f]{64}',expected):raise ValueError('BAD_EXTERNAL_DIGEST')
 root=pathlib.Path(__file__).resolve().parent
 raw=(root/'TASK_MANIFEST.json').read_bytes()
 if sha(raw)!=expected:raise ValueError('EXTERNAL_MANIFEST_MISMATCH')
 m=json.loads(raw)
 if m.get('schema_version')!=1 or m.get('file_count')!=len(m.get('files',[])):raise ValueError('MANIFEST_INVALID')
 names=[x['path'] for x in m['files']]
 if len(names)!=len(set(n.lower() for n in names)):raise ValueError('DUPLICATE')
 for row in m['files']:
  n=row['path'];f=root/n
  if not n or n=='TASK_MANIFEST.json' or '/' in n or '\\' in n or '..' in pathlib.PurePosixPath(n).parts or not f.is_file() or f.is_symlink():raise ValueError('PATH:'+n)
  b=f.read_bytes()
  if len(b)!=row['bytes'] or sha(b)!=row['sha256']:raise ValueError('MEMBER_DRIFT:'+n)
 actual={f.name for f in root.iterdir() if f.is_file()}
 if actual!=set(names)|{'TASK_MANIFEST.json'}:raise ValueError('UNDECLARED_CONTENT')
 a=json.loads((root/'SOURCE_EDIT_AUTHORIZATION.json').read_bytes())
 if a['authorization_id']!=m['authorization_id'] or a['issued_base_commit']!=m['base_commit'] or a['issued_base_tree']!=m['base_tree']:raise ValueError('AUTH_DRIFT')
 print(f"VERIFIED: declared_members={len(names)} manifest_sha256={expected} exact_authority={m['authorization_id']}")
if __name__=='__main__':
 try:main()
 except Exception as e:print('INVALID_ISSUANCE: '+str(e),file=sys.stderr);sys.exit(1)
