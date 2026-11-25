from __future__ import annotations
import argparse,hashlib,pathlib,sys,zipfile
p=argparse.ArgumentParser();p.add_argument('archive',type=pathlib.Path);p.add_argument('--expected-zip-sha256',required=True);p.add_argument('--expected-manifest-sha256',required=True);a=p.parse_args()
def sha(b):return hashlib.sha256(b).hexdigest()
assert sha(a.archive.read_bytes())==a.expected_zip_sha256,'ZIP mismatch'
with zipfile.ZipFile(a.archive) as z:
 names=z.namelist();assert len(names)==len(set(names)),'Duplicate member'
 for info in z.infolist():
  q=pathlib.PurePosixPath(info.filename);assert not q.is_absolute() and '..' not in q.parts and '\\' not in info.filename,'Unsafe path'
  assert (info.external_attr>>16)&0o170000 != 0o120000,'Symlink member'
  assert info.file_size<20_000_000,'Oversized member'
 assert sum(x.file_size for x in z.infolist())<50_000_000,'Oversized packet'
 m=z.read('MANIFEST.sha256');assert sha(m)==a.expected_manifest_sha256,'Manifest mismatch'
 listed=set()
 for line in m.decode().splitlines():
  h,n=line.split('  ',1);assert n not in listed,'Duplicate manifest member';listed.add(n);assert sha(z.read(n))==h,'Member mismatch: '+n
 assert set(names)==listed|{'MANIFEST.sha256'},'Unlisted files'
 print('PASS:',len(listed),'verified files. No extraction or code execution performed.')
