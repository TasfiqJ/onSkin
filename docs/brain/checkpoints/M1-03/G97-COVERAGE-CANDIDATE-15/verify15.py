"""External-anchor bootstrap. Complete technical evidence only; no acceptance."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[4]


def need(ok):
    if not ok:raise ValueError('INCOMPLETE')


def regular(path):
    for component in [path,*path.parents]:
        s=component.lstat()
        need(not stat.S_ISLNK(s.st_mode) and not getattr(s,'st_file_attributes',0)&1024)
    s=path.lstat()
    need(stat.S_ISREG(s.st_mode) and s.st_nlink==1 and s.st_size<=64*1024**2)
    raw=path.read_bytes();a=path.lstat()
    need((s.st_dev,s.st_ino,s.st_size,s.st_mtime_ns)==(a.st_dev,a.st_ino,a.st_size,a.st_mtime_ns))
    return raw


def pairs(items):
    result={}
    for k,v in items:need(k not in result);result[k]=v
    return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--expected-manifest-sha256',required=True);args=parser.parse_args()
    try:
        need(re.fullmatch('[0-9a-f]{64}',args.expected_manifest_sha256))
        raw=regular(HERE/'manifest.json')
        need(hashlib.sha256(raw).hexdigest()==args.expected_manifest_sha256)
        m=json.loads(raw,object_pairs_hook=pairs,parse_constant=lambda _:need(False))
        need(m['status']=='OWNER_REVIEW_REQUIRED' and m['acceptanceGranted'] is False)
        # Authenticate all executable imports before executing any repository code.
        for name,receipt in list(m['tools'].items()):
            need(re.fullmatch('[A-Za-z0-9._/-]+',name) and
                 all(p not in ('','.','..') for p in name.split('/')))
            data=regular(ROOT/name)
            need(hashlib.sha256(data).hexdigest()==receipt['sha256'] and len(data)==receipt['bytes'])
            oid=subprocess.check_output(['git','--no-replace-objects','rev-parse',m['source']+':'+name],
                                        cwd=ROOT,stderr=subprocess.PIPE).decode().strip()
            need(oid==receipt['blob'])
        for name,receipt in m['files'].items():
            need(re.fullmatch('[A-Za-z0-9._-]+',name))
            data=regular(HERE/name)
            need(hashlib.sha256(data).hexdigest()==receipt['sha256'] and len(data)==receipt['bytes'])
        sys.path.insert(0,str(ROOT/'scripts/security15'))
        import verify_candidate
        result=verify_candidate.checkpoint(ROOT,HERE,args.expected_manifest_sha256)
        print(json.dumps(result,sort_keys=True));return 0
    except Exception:
        print('{"status":"INCOMPLETE","acceptanceGranted":false}');return 1


if __name__=='__main__':raise SystemExit(main())
