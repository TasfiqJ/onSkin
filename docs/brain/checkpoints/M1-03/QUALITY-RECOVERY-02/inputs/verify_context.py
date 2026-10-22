#!/usr/bin/env python3
"""Offline, exact-byte verification of one Brain-issued Codex packet."""
import argparse, hashlib, json, pathlib, sys

def sha(data): return hashlib.sha256(data).hexdigest()

def verify(folder, expected):
    expected=expected.lower()
    if len(expected)!=64 or any(c not in '0123456789abcdef' for c in expected):
        raise ValueError('Need 64-character externally supplied SHA256')
    path=folder/'TASK_MANIFEST.json'
    raw=path.read_bytes()
    if sha(raw)!=expected:
        raise ValueError('External manifest SHA256 mismatch')
    manifest=json.loads(raw)
    entries=manifest.get('files',[])
    if manifest.get('schema_version')!=1 or manifest.get('file_count')!=len(entries):
        raise ValueError('Unexpected manifest layout')
    names=[]
    for entry in entries:
        name=entry['path']
        pp=pathlib.PurePosixPath(name)
        if pp.is_absolute() or '..' in pp.parts or str(pp)!=name or name=='TASK_MANIFEST.json':
            raise ValueError('Forbidden path in manifest: '+name)
        names.append(name)
        f=folder.joinpath(*pp.parts)
        if not f.is_file() or f.is_symlink(): raise ValueError('Missing/nonfile: '+name)
        data=f.read_bytes()
        if len(data)!=entry['bytes'] or sha(data)!=entry['sha256']:
            raise ValueError('Altered file: '+name)
    if len(set(names))!=len(names): raise ValueError('Duplicate manifest entries')
    present={x.relative_to(folder).as_posix() for x in folder.rglob('*') if x.is_file() and '__pycache__' not in x.parts}
    extra=present - set(names) - {'TASK_MANIFEST.json'}
    if extra: raise ValueError('Unexpected extra files: '+repr(sorted(extra)))
    print('VERIFIED',len(names),'members and manifest SHA256',expected)

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--expected-manifest-sha256',required=True)
    options=parser.parse_args()
    try:verify(pathlib.Path(__file__).resolve().parent,options.expected_manifest_sha256)
    except Exception as error: print('INVALID_CONTEXT',str(error),file=sys.stderr);sys.exit(1)
