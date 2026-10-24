#!/usr/bin/env python3
"""Verify the untrusted Release10 handoff against an externally pasted manifest digest.

Checks only byte integrity / safe paths / exact prompt derivation. No source or release acceptance.
"""
from pathlib import Path
import argparse, hashlib, json, os, re, stat, sys, unicodedata

def die(why): raise ValueError(why)
def sha(raw): return hashlib.sha256(raw).hexdigest()
def valid_name(s):
    if not isinstance(s,str) or not s or s.startswith(('/', '\\')) or '\\' in s or ':' in s or '\x00' in s: die('UNSAFE_NAME')
    if any(not v or v in ('.','..') or v.endswith((' ','.')) for v in s.split('/')): die('UNSAFE_SEGMENT')
    if any(re.match(r'^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)',v,re.I) for v in s.split('/')): die('RESERVED_NAME')
    return unicodedata.normalize('NFKC',s).casefold()
def safe_read(root,relative):
    valid_name(relative)
    f=root/relative
    for item in [f]+list(f.parents):
        st=item.lstat()
        if stat.S_ISLNK(st.st_mode) or (getattr(st,'st_file_attributes',0)&1024): die('LINK_OR_REPARSE')
        if item==f and not stat.S_ISREG(st.st_mode): die('NOT_REGULAR')
        if item!=f and not stat.S_ISDIR(st.st_mode): die('NOT_DIRECTORY_PARENT')
    return f.read_bytes()
def main():
    arg=argparse.ArgumentParser()
    arg.add_argument('--expected-manifest-sha256',required=True)
    a=arg.parse_args()
    if not re.fullmatch('[0-9a-f]{64}',a.expected_manifest_sha256): die('INVALID_EXTERNAL_ANCHOR')
    root=Path(__file__).resolve().parent
    if sha(safe_read(root,'manifest.json'))!=a.expected_manifest_sha256: die('MANIFEST_DIGEST_MISMATCH')
    man=json.loads(safe_read(root,'manifest.json'))
    if man.get('schema_version')!=1 or man.get('kind')!='onskin-release10-context': die('MANIFEST_FORMAT')
    entries=man.get('files')
    if not isinstance(entries,list): die('MANIFEST_FILES')
    names=[x['path'] for x in entries]
    if len(set(valid_name(n) for n in names))!=len(names): die('CASE_COLLISION')
    if any(n in ('manifest.json','EXACT_PROMPT.md') for n in names): die('INVALID_LISTING')
    actual=[]
    for file in root.rglob('*'):
        st=file.lstat()
        if stat.S_ISLNK(st.st_mode) or (getattr(st,'st_file_attributes',0)&1024): die('UNSAFE_ENTRY')
        if not stat.S_ISREG(st.st_mode) and not stat.S_ISDIR(st.st_mode): die('NONREGULAR_ENTRY')
        if file.is_file(): actual.append(file.relative_to(root).as_posix())
    expected=set(names)|{'manifest.json','EXACT_PROMPT.md'}
    if len(actual)!=len(expected) or set(actual)!=expected or len(set(valid_name(x) for x in actual))!=len(actual): die('INVENTORY_MISMATCH')
    for x in entries:
        raw=safe_read(root,x['path'])
        if len(raw)!=x['bytes'] or sha(raw)!=x['sha256']: die('FILE_MISMATCH:'+x['path'])
    template=safe_read(root,'PROMPT_TEMPLATE.md')
    exact=safe_read(root,'EXACT_PROMPT.md')
    placeholder=b'__EXTERNAL_MANIFEST_SHA256__'
    if template.count(placeholder)!=1: die('BAD_TEMPLATE')
    if exact!=template.replace(placeholder,a.expected_manifest_sha256.encode('ascii')): die('PROMPT_DERIVATION_MISMATCH')
    print(f'VERIFIED: {len(entries)} authenticated files; exact prompt derived; manifest {a.expected_manifest_sha256}')
if __name__=='__main__':
    try: main()
    except Exception as e:
        print('CONTEXT_INVALID: '+str(e),file=sys.stderr)
        sys.exit(1)
