#!/usr/bin/env python3
"""Verify exact onSkin cloud task context from an OUT-OF-ZIP digest."""
import argparse, hashlib, json, pathlib
arg=argparse.ArgumentParser();arg.add_argument('--expected-manifest-sha256',required=True);args=arg.parse_args()
root=pathlib.Path(__file__).resolve().parent
raw=(root/'TASK_MANIFEST.json').read_bytes();actual=hashlib.sha256(raw).hexdigest()
if len(args.expected_manifest_sha256)!=64 or actual!=args.expected_manifest_sha256.lower():
    raise SystemExit('FAIL manifest digest: got '+actual)
manifest=json.loads(raw);seen=set()
for item in manifest['files']:
    name=item['path'];part=pathlib.PurePosixPath(name)
    if not name or part.is_absolute() or '..' in part.parts or name in seen or chr(92) in name:
        raise SystemExit('FAIL unsafe or duplicate path: '+name)
    seen.add(name);p=root.joinpath(*part.parts)
    if p.is_symlink() or not p.is_file():raise SystemExit('FAIL missing/symlink: '+name)
    data=p.read_bytes()
    if len(data)!=item['bytes'] or hashlib.sha256(data).hexdigest()!=item['sha256']:
        raise SystemExit('FAIL file integrity: '+name)
expected=seen|{'TASK_MANIFEST.json'}
actualfiles={p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file()}
if actualfiles!=expected:raise SystemExit('FAIL exact file list: '+repr((expected-actualfiles,actualfiles-expected)))
assert manifest['branch']=='stage/m1-retained-safety'
print('VERIFIED',len(seen),'cloud context files; manifest',actual,'; NOT repository CI / protected admission')
