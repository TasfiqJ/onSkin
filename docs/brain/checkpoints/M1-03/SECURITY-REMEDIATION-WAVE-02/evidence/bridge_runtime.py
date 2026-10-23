"""Continue the genuine candidate with canonical tree and runtime checks."""
import datetime, email, hashlib, json, os, pathlib, re, shutil, subprocess, sys, time
sys.dont_write_bytecode=True
root=pathlib.Path('/work/repo');work=pathlib.Path('/work/bridge2');site=work/'candidate-env/lib/python3.12/site-packages';oldsite=work/'old-site';py=work/'candidate-env/bin/python'
out=pathlib.Path('/evidence/bridge-runtime');out.mkdir(exist_ok=False)
sys.path.insert(0,str(root/'scripts/phase9/security_acceptance'));import contract as c
sha=lambda b:hashlib.sha256(b).hexdigest()
def save(n,v):(out/n).write_text(json.dumps(v,indent=2)+'\n')
def run(n,args,timeout=180,cwd=work):
    start=time.monotonic()
    with (out/(n+'.log')).open('wb') as f:
        try:code=subprocess.run(list(map(str,args)),cwd=cwd,stdout=f,stderr=subprocess.STDOUT,timeout=timeout,env={**os.environ,'SEMGREP_SEND_METRICS':'off','SEMGREP_ENABLE_VERSION_CHECK':'0','PYTHONDONTWRITEBYTECODE':'1'}).returncode
        except subprocess.TimeoutExpired:code=124
    save(n+'.receipt.json',dict(argv=list(map(str,args)),cwd=str(cwd),environment=dict(SEMGREP_SEND_METRICS='off',SEMGREP_ENABLE_VERSION_CHECK='0',PYTHONDONTWRITEBYTECODE='1'),exit=code,seconds=time.monotonic()-start,log_sha256=sha((out/(n+'.log')).read_bytes())))
    print(json.dumps(dict(name=n,exit=code)),flush=True);return code
delta=json.loads(pathlib.Path('/evidence/bridge2/installed-file-delta.json').read_bytes())
installer=[r for r in delta['unexplained'] if r['path'].startswith('bin/') or r['path'].endswith('.dist-info/RECORD')]
unexplained=[r for r in delta['unexplained'] if r not in installer]
assert not unexplained
save('installer-layout-differences.json',dict(explanation='Cross-layout target/bin launchers and generated RECORD paths differ between pip --target and venv. These are explicitly excluded by the ORIGINAL contract.tool_tree algorithm; no new exemption was added. Every difference is retained here. Semgrep non-METADATA dist-info files are compared before/after in the SAME venv and identical, including RECORD.',differences=installer,unexplained_canonical_package_files=unexplained))
metadata=site/'semgrep-1.181.0.dist-info/METADATA';official=(oldsite/'semgrep-1.181.0.dist-info/METADATA').read_bytes();patched=metadata.read_bytes()
before=json.loads(pathlib.Path('/evidence/bridge2/candidate-upstream-distinfo-before-patch.json').read_bytes());after={p.name:sha(p.read_bytes()) for p in metadata.parent.iterdir() if p.is_file()}
assert {k:v for k,v in before.items() if k!='METADATA'}=={k:v for k,v in after.items() if k!='METADATA'}
upstream=work/'upstream-proof';shutil.copytree(site,upstream)
shutil.copyfile(work/'candidate-preserved/semgrep-core.official-upstream',upstream/'semgrep/bin/semgrep-core')
shutil.rmtree(upstream/'semgrep/bin/libs');shutil.copytree(work/'candidate-preserved/official-upstream-libs',upstream/'semgrep/bin/libs')
save('candidate-trees.json',dict(custom_originalPackageTree=c.tool_tree(upstream,python_site=True),custom_semgrepPackageTree=c.tool_tree(site,python_site=True),official_wheel_unchanged=True,semgrep_non_metadata_distinfo_unchanged=True,upstream_metadata_sha256=sha(official),custom_metadata_sha256=sha(patched),canonical_unexplained_deltas=0,custom=True))
identity=json.loads(pathlib.Path('/evidence/bridge2/patch-identity.json').read_bytes())
def apply(raw,wheel=identity['upstream_wheel_sha256']):
    assert wheel==identity['upstream_wheel_sha256'],'UNKNOWN_WHEEL'
    assert sha(raw)==identity['upstream_metadata_sha256'],'METADATA_PREIMAGE'
    for row in identity['old_new_requires_dist']:
        old=row['old'].encode()+b'\n';new=row['new'].encode()+b'\n';assert raw.count(old)==1;raw=raw.replace(old,new)
    assert sha(raw)==identity['custom_metadata_sha256'];return raw
neg=[]
for label,raw,wheel in [('tampered-metadata',official+b'\n',identity['upstream_wheel_sha256']),('wrong-version',official.replace(b'Version: 1.181.0',b'Version: 1.181.1'),identity['upstream_wheel_sha256']),('unknown-wheel',official,'0'*64),('double-patch',patched,identity['upstream_wheel_sha256'])]:
    try:apply(raw,wheel);rejected=False
    except AssertionError:rejected=True
    assert rejected;neg.append(dict(case=label,rejected=True))
pip=[sys.executable,'-B','-m','pip','--isolated','--python',str(py)]
bad=work/'incompatible.txt';bad.write_text('semgrep==1.181.0\nmcp==1.29.0\n')
assert run('incompatible-solver',pip+['install','--dry-run','--index-url','https://pypi.org/simple','--only-binary=:all:','-r',bad])!=0
mcpmeta=email.message_from_bytes((site/'mcp-1.30.0.dist-info/METADATA').read_bytes())
save('extra-requirements.json',dict(semgrep_provides_extra=email.message_from_bytes(patched).get_all('Provides-Extra',[]),mcp_provides_extra=mcpmeta.get_all('Provides-Extra',[]),mcp_extra_requires=[r for r in mcpmeta.get_all('Requires-Dist',[]) if 'extra ==' in r]))
badextra=work/'incompatible-extra.txt';badextra.write_text('semgrep==1.181.0\nmcp[cli]==1.30.0\ntyper==0.1.0\n')
assert run('incompatible-extra-solver',pip+['install','--dry-run','--index-url','https://pypi.org/simple','--only-binary=:all:','-r',badextra])!=0
missing=site/'opentelemetry_api-1.45.1.dist-info';hidden=work/'hidden-api.dist-info';missing.rename(hidden)
try:assert run('missing-dependency-pip-check',pip+['check'])!=0
finally:hidden.rename(missing)
save('metadata-adverse.json',dict(cases=neg,incompatible_solver_refused=True,incompatible_extra_refused=True,missing_dependency_refused=True))
entry=lambda python,folder:[str(python),'-I','-S','-B','-c',c.SEMGREP_ENTRY,str(folder)]
for label,python,folder in [('old',sys.executable,oldsite),('new',py,site)]:
    assert run(label+'-semgrep-version',entry(python,folder)+['--version'])==0
    assert run(label+'-core-version',[folder/'semgrep/bin/semgrep-core','-version'])==0
save('runtime-ready.json',dict(candidate=str(site),python=str(py),old_site=str(oldsite),stage_technical_edit_eligible=False,critical_missing_gate='AUTHENTIC_OWASP_PIN_NOT_RECOVERED'))
