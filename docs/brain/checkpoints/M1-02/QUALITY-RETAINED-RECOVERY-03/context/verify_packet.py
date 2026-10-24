#!/usr/bin/env python3
"""Verify all listed context bytes against externally supplied manifest digest."""
import argparse, hashlib, json, pathlib, os, sys
p=argparse.ArgumentParser()
p.add_argument('--expected-manifest-sha256', required=True)
a=p.parse_args()
root=pathlib.Path(__file__).resolve().parent
m=root/'manifest.json'
sha=lambda b:hashlib.sha256(b).hexdigest()
raw=m.read_bytes()
if sha(raw).lower()!=a.expected_manifest_sha256.lower():
    raise SystemExit('FAIL EXTERNAL_MANIFEST_SHA256')
manifest=json.loads(raw)
items=manifest['files']
assert manifest['schema']==1
expected={'manifest.json','EXACT_PROMPT.md'}|{r['path'] for r in items}
actual=set()
for f in root.iterdir():
    if not f.is_file() or f.is_symlink(): raise SystemExit('FAIL NONREGULAR_MEMBER')
    actual.add(f.name)
if actual!=expected: raise SystemExit('FAIL FILE_SET '+str(sorted(actual^expected)))
if len(items)!=len({r['path'] for r in items}):raise SystemExit('FAIL DUPLICATE_ENTRY')
for r in items:
    name=r['path']
    if '/' in name or '\\' in name or name in ('.','..') or not name:
        raise SystemExit('FAIL UNSAFE_NAME')
    data=(root/name).read_bytes()
    if len(data)!=r['bytes'] or sha(data)!=r['sha256']:
        raise SystemExit('FAIL FILE_HASH '+name)
print(f"VERIFIED {len(items)} context files against externally supplied manifest SHA256; orientation prompt copy is not a manifest member; admission NONE")
