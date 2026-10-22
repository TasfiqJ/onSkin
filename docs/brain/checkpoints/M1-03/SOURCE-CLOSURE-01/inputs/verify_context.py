#!/usr/bin/env python3
"""Verify exact issued context files against an EXTERNALLY supplied manifest hash."""
import argparse,hashlib,json,pathlib,stat,sys
p=argparse.ArgumentParser();p.add_argument('--expected-manifest-sha256',required=True);p.add_argument('--root',default='.')
a=p.parse_args();root=pathlib.Path(a.root).resolve();raw=(root/'TASK_MANIFEST.json').read_bytes()
def need(condition,message):
 if not condition:raise ValueError(message)
need(len(a.expected_manifest_sha256)==64 and all(x in '0123456789abcdef' for x in a.expected_manifest_sha256),'Invalid external SHA')
need(hashlib.sha256(raw).hexdigest()==a.expected_manifest_sha256,'Independent issuance SHA256 mismatch')
def strict_pairs(pairs):
 d={}
 for k,v in pairs:
  need(k not in d,'Duplicate JSON key');d[k]=v
 return d
m=json.loads(raw,object_pairs_hook=strict_pairs)
need(m['branch']=='stage/m1-retained-safety' and m['task_id']=='M1-03' and m['iteration']=='SOURCE-CLOSURE-01','Wrong scope')
known={'TASK_MANIFEST.json'}
for f in m['files']:
 name=f['path'];need(name and not name.startswith('/') and '\\' not in name and '..' not in pathlib.PurePosixPath(name).parts,'Unsafe path')
 need(name not in known,'Duplicate file');known.add(name)
 target=root/name;need(target.is_file() and not target.is_symlink() and target.resolve().is_relative_to(root),'Absent/linked file: '+name)
 info=target.stat();need(info.st_nlink==1,'Hardlinked file: '+name)
 data=target.read_bytes();need(len(data)==f['bytes'] and hashlib.sha256(data).hexdigest()==f['sha256'],'File mismatch: '+name)
observed={p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file()}
need(observed==known,'Extra or missing files: '+repr(sorted(observed.symmetric_difference(known))[:8]))
print('VERIFIED',m['task_id'],m['iteration'],len(m['files']),'files; independent manifest digest confirmed')
