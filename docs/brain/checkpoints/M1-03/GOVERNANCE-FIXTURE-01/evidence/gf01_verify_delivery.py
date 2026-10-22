import pathlib,json,hashlib,subprocess,sys
r=pathlib.Path('/root/onskin-governance-fixture01');cp='docs/brain/checkpoints/M1-03/GOVERNANCE-FIXTURE-01/'
def git(*args):return subprocess.check_output(['git',*args],cwd=r).decode().strip()
sha=git('rev-parse','HEAD');tree=git('rev-parse','HEAD^{tree}')
sys.path.insert(0,str(r/'scripts/brain'));import brain,m103_profile as p
p.report(r,cp+'completion-report.json')
manifest=json.loads((r/cp/'SHA256SUMS.json').read_bytes())
for row in manifest['entries']:
 path=row['path'];entries=git('ls-tree','HEAD','--',path).splitlines();assert len(entries)==1
 mode,kind,oid=entries[0].split('\t')[0].split();assert mode in ['100644','100755'] and kind=='blob'
 data=subprocess.check_output(['git','show','HEAD:'+path],cwd=r)
 assert (mode,oid,len(data),hashlib.sha256(data).hexdigest())==(row['git_mode'],row['git_blob'],row['bytes'],row['sha256'])
 assert data==(r/path).read_bytes()
print('STRICT_REPORT PASS; committed report artifacts='+str(len(brain.load(r,cp+'completion-report.json')['artifacts'])))
print('REGULAR_GIT_BLOB_MANIFEST PASS; checksum objects='+str(len(manifest['entries'])))
source=manifest['measured_source'];print('MEASURED_SOURCE='+source['commit']);print('MEASURED_TREE='+source['tree']);print('DELIVERY_HEAD='+sha);print('DELIVERY_TREE='+tree)
changed=git('diff','--name-only',source['commit'],'HEAD').splitlines();assert all(x=='ONSKIN_BRAIN_HANDOFF.txt' or x.startswith(cp) for x in changed)
assert not git('status','--porcelain=v1')
print('EVIDENCE_ONLY_TAIL PASS; clean checkout; original protected files and instructions remain intact')
