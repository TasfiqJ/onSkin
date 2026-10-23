#!/usr/bin/env python3
"""External-manifest-anchored onSkin context byte verification; no repository edits."""
import argparse,hashlib,json,pathlib,sys
P=pathlib.Path(__file__).resolve().parent
SHA=lambda b:hashlib.sha256(b).hexdigest()

def fail(message):
 print('INVALID_ISSUANCE: '+message,file=sys.stderr);sys.exit(2)

def main():
 parser=argparse.ArgumentParser()
 parser.add_argument('--expected-manifest-sha256',required=True)
 x=parser.parse_args()
 expected=x.expected_manifest_sha256.lower()
 if len(expected)!=64 or any(c not in '0123456789abcdef' for c in expected):fail('bad external SHA256 argument')
 raw=(P/'TASK_MANIFEST.json').read_bytes()
 if SHA(raw)!=expected:fail('external manifest SHA256 mismatch: expected '+expected+' actual '+SHA(raw))
 manifest=json.loads(raw)
 rows=manifest['files']
 if len(rows)!=manifest['file_count']:fail('file count differs')
 names=[r['path'] for r in rows]
 if len(set(names))!=len(names) or len(set(n.lower() for n in names))!=len(names):fail('duplicate/case-colliding name')
 reserved={'TASK_MANIFEST.json'}
 for r in rows:
  name=r['path']
  q=pathlib.PurePosixPath(name)
  if name in reserved or q.is_absolute() or len(q.parts)!=1 or name in ('.','..') or chr(92) in name:fail('unsafe name '+name)
  f=P/name
  if f.is_symlink() or not f.is_file():fail('missing/nonregular '+name)
  data=f.read_bytes()
  if len(data)!=r['bytes'] or SHA(data)!=r['sha256']:fail('member digest differs '+name)
 unexpected=[p.name for p in P.iterdir() if p.is_file() and p.name not in set(names)|reserved]
 if unexpected:fail('unexpected members '+str(unexpected))
 auth=json.loads((P/'SOURCE_EDIT_AUTHORIZATION.json').read_bytes())
 pre=json.loads((P/'PREIMAGE_WITNESSES.json').read_bytes())
 if auth['base_commit']!=pre['base_commit'] or auth['base_tree']!=pre['base_tree']:fail('base mismatch')
 pmap={x['path']:x for x in pre['files']}
 for r in auth['allowed_existing_files']+auth['protected_unchanged']:
  if pmap.get(r['path']) != {k:v for k,v in r.items() if k in ('path','bytes','sha256','git_blob')}:fail('preimage authority differs '+r['path'])
 digest=SHA(json.dumps(pre['files'],sort_keys=True,separators=(',',':')).encode())
 if digest!=auth['preimage_set_fingerprint']:fail('preimage set fingerprint mismatch')
 print('VERIFIED: external manifest '+expected+'; '+str(len(rows))+' members; '+str(len(pre['files']))+' Git preimages; auth '+auth['authorization_id'])

if __name__=='__main__':main()
