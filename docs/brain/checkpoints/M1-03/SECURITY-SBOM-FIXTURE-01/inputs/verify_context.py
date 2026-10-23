#!/usr/bin/env python3
"""Verify Brain-issued context using EXTERNAL manifest SHA256; fail closed."""
import argparse,hashlib,json,pathlib,sys

def digest(x):return hashlib.sha256(x).hexdigest()

def verify(folder,external):
    external=external.lower()
    if len(external)!=64 or any(c not in '0123456789abcdef' for c in external):
        raise ValueError('External SHA256 not exactly 64 lowercase hex chars')
    raw=(folder/'TASK_MANIFEST.json').read_bytes()
    if digest(raw)!=external:raise ValueError('EXTERNAL_MANIFEST_MISMATCH')
    m=json.loads(raw)
    if m.get('schema_version')!=1 or m.get('file_count')!=len(m.get('files',[])):
        raise ValueError('MANIFEST_SHAPE')
    names=[]
    for item in m['files']:
        name=item['path'];path=pathlib.PurePosixPath(name)
        if not name or name=='TASK_MANIFEST.json' or path.is_absolute() or '..' in path.parts or str(path)!=name or '\\' in name:
            raise ValueError('UNSAFE_MEMBER')
        names.append(name)
        f=folder.joinpath(*path.parts)
        if not f.is_file() or f.is_symlink():raise ValueError('MISSING_OR_LINKED_FILE:'+name)
        b=f.read_bytes()
        if len(b)!=item['bytes'] or digest(b)!=item['sha256']:
            raise ValueError('BYTE_DRIFT:'+name)
    if len(set(names))!=len(names) or len(set(n.lower() for n in names))!=len(names):
        raise ValueError('DUPLICATE_MEMBER')
    actual={p.relative_to(folder).as_posix() for p in folder.rglob('*') if p.is_file() and '__pycache__' not in p.parts}
    if actual!=set(names)|{'TASK_MANIFEST.json'}:raise ValueError('EXTRA_OR_MISSING_MEMBER:'+str(sorted(actual^ (set(names)|{'TASK_MANIFEST.json'}))))
    print('VERIFIED',len(names),'members; external manifest SHA256',external)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--expected-manifest-sha256',required=True)
    args=parser.parse_args()
    try:verify(pathlib.Path(__file__).resolve().parent,args.expected_manifest_sha256)
    except Exception as e:
        print('INVALID_CONTEXT',str(e),file=sys.stderr);sys.exit(1)
