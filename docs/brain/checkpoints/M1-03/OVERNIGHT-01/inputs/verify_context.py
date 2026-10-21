#!/usr/bin/env python3
"""Verify an issued text-only context against an independently supplied manifest digest."""
import argparse, hashlib, json, re, stat, sys
from pathlib import Path

def need(ok, message):
    if not ok: raise ValueError(message)
def pairs(rows):
    d={}
    for k,v in rows:
        need(k not in d, 'duplicate JSON key'); d[k]=v
    return d
def load(b):return json.loads(b.decode('utf8'),object_pairs_hook=pairs)
def digest(b):return hashlib.sha256(b).hexdigest()
def run():
    a=argparse.ArgumentParser();a.add_argument('--expected-manifest-sha256',required=True);a.add_argument('--root',type=Path,default=Path(__file__).absolute().parent);o=a.parse_args()
    need(re.fullmatch('[0-9a-f]{64}',o.expected_manifest_sha256) is not None,'invalid expected digest')
    root=o.root.absolute()
    for p in [root,*root.parents]:
        st=p.lstat();need(not stat.S_ISLNK(st.st_mode) and not getattr(st,'st_file_attributes',0)&0x400,'linked root')
    def safe(name):
        need(isinstance(name,str) and name.isascii() and not re.search(r'[\\:\x00-\x1f]',name),'unsafe name')
        parts=name.split('/');need(all(x and x not in ['.','..'] for x in parts),'unsafe path')
        p=root
        for x in parts:
            need(not x.endswith((' ','.')),'aliased path');p=p/x;st=p.lstat();need(not stat.S_ISLNK(st.st_mode) and not getattr(st,'st_file_attributes',0)&0x400,'linked input')
        need(p.is_file() and p.stat().st_nlink==1,'nonregular/hardlinked input');return p
    raw=safe('TASK_MANIFEST.json').read_bytes();need(digest(raw)==o.expected_manifest_sha256,'manifest authority mismatch');m=load(raw)
    need(m['task_id']=='M1-03' and m['iteration']=='OVERNIGHT-01','wrong task')
    seen={'task_manifest.json'};total=0;expected={'TASK_MANIFEST.json'}
    for row in m['files']:
        name=row['path'];need(name.casefold() not in seen,'duplicate/alias input');seen.add(name.casefold());expected.add(name)
        b=safe(name).read_bytes();need(type(row['bytes']) is int and len(b)==row['bytes'] and digest(b)==row['sha256'],'input changed: '+name)
        b.decode('utf8');total+=len(b)
    actual=set()
    for p in root.rglob('*'):
        st=p.lstat();need(not stat.S_ISLNK(st.st_mode) and not getattr(st,'st_file_attributes',0)&0x400,'linked extra')
        if p.is_file(): actual.add(p.relative_to(root).as_posix())
    need(actual==expected,'missing/extra context files');need(total==m['actual_input_bytes'] and total<=m['max_input_bytes']<=1048576,'context budget')
    print('PASS: exact M1-03 OVERNIGHT-01 context; no implementation or release admission')
if __name__=='__main__':
    try:run()
    except (ValueError,OSError,TypeError,KeyError) as e:print('REJECTED: '+str(e),file=sys.stderr);sys.exit(1)
