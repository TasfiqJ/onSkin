#!/usr/bin/env python3
"""Verify this unpacked task context against an independently supplied manifest SHA256."""
import argparse, hashlib, json, pathlib, stat, sys

def main():
    p=argparse.ArgumentParser();p.add_argument('--expected-manifest-sha256',required=True);p.add_argument('--root',type=pathlib.Path,default=pathlib.Path(__file__).absolute().parent);a=p.parse_args()
    root=a.root.absolute()
    def require(x,msg):
        if not x:raise ValueError(msg)
    def blob(name):
        require(isinstance(name,str) and name and '\\' not in name and ':' not in name,'unsafe name')
        parts=name.split('/');require(all(x and x not in ['.','..'] for x in parts) and not name.startswith('/'),'unsafe path')
        path=root.joinpath(*parts)
        for q in [root,*root.parents,*[root.joinpath(*parts[:i]) for i in range(1,len(parts)+1)]]:
            st=q.lstat();require(not stat.S_ISLNK(st.st_mode) and not getattr(st,'st_file_attributes',0)&0x400,'linked input')
        st=path.stat();require(stat.S_ISREG(st.st_mode) and st.st_nlink==1 and st.st_size<=1048576,'nonregular/oversize input')
        return path.read_bytes()
    raw=blob('TASK_MANIFEST.json');require(hashlib.sha256(raw).hexdigest()==a.expected_manifest_sha256,'manifest anchor mismatch')
    m=json.loads(raw);require(m['task_id']=='M1-01' and m['branch']=='stage/m1-retained-safety','wrong task')
    names=[r['path'] for r in m['files']];require(len(names)==len(set(names))<=128,'duplicate/too many files')
    total=0
    for r in m['files']:
        b=blob(r['path']);total+=len(b);require(type(r['bytes']) is int and len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'],'input mismatch '+r['path'])
    require(total==m['actual_input_bytes']<=m['max_input_bytes']<=1048576,'context bound')
    actual={q.relative_to(root).as_posix() for q in root.rglob('*') if q.is_file() or q.is_symlink()}
    require(actual==set(names)|{'TASK_MANIFEST.json'},'extra/missing file')
    print('PASS: M1-01 exact input hashes, paths and context bounds. This is package integrity, not runtime/security/release acceptance.')
if __name__=='__main__':
    try:main()
    except (OSError,ValueError,KeyError,TypeError) as exc:print('REJECTED: '+str(exc),file=sys.stderr);sys.exit(1)
