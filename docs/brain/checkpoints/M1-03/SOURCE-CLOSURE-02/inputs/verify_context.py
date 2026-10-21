#!/usr/bin/env python3
"""Verify source ZIP file bytes against an independently supplied SHA256 manifest digest."""
import argparse, hashlib, json, pathlib, sys
p=argparse.ArgumentParser();p.add_argument('--expected-manifest-sha256',required=True);args=p.parse_args()
root=pathlib.Path(__file__).resolve().parent;manifest=root/'TASK_MANIFEST.json';raw=manifest.read_bytes()
actual=hashlib.sha256(raw).hexdigest()
if actual!=args.expected_manifest_sha256.lower():raise SystemExit(f'MANIFEST DIGEST MISMATCH expected {args.expected_manifest_sha256}, got {actual}')
m=json.loads(raw);seen=set()
for x in m['files']:
    name=x['path'];path=pathlib.PurePosixPath(name)
    if path.is_absolute() or '..' in path.parts or name in seen or not name:raise SystemExit('UNSAFE OR DUPLICATE PATH '+name)
    seen.add(name);item=root.joinpath(*path.parts)
    if item.is_symlink() or not item.is_file():raise SystemExit('MISSING/SYMLINK '+name)
    content=item.read_bytes()
    if len(content)!=x['bytes'] or hashlib.sha256(content).hexdigest()!=x['sha256']:raise SystemExit('FILE INTEGRITY MISMATCH '+name)
expected=seen|{'TASK_MANIFEST.json'}
real={q.relative_to(root).as_posix() for q in root.rglob('*') if q.is_file()}
if real!=expected:raise SystemExit('FILE LIST MISMATCH missing='+str(sorted(expected-real))+' extra='+str(sorted(real-expected)))
print('VERIFIED',len(seen),'files; manifest',actual,'; source-only non-admitting; not CI acceptance')
