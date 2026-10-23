"""CUSTOM installed-METADATA experiment. Never writes to stage technical source."""
import base64, csv, datetime, difflib, email, hashlib, io, json, os, pathlib, re, shutil, subprocess, sys, time, urllib.request, zipfile
sys.dont_write_bytecode=True
label=sys.argv[1] if len(sys.argv)>1 else 'bridge'
assert label in ('bridge','bridge2')
root=pathlib.Path('/work/repo');work=pathlib.Path('/work')/label;work.mkdir(exist_ok=False)
out=pathlib.Path('/evidence')/label;out.mkdir(exist_ok=False)
sys.path.insert(0,str(root/'scripts/phase9/security_acceptance'));import contract as c;import bootstrap_tools as b
policy=c.load(c.HERE,'proposal.json');req=c.HERE/b.REQUIREMENTS
sha=lambda raw:hashlib.sha256(raw).hexdigest()
def save(name,obj): (out/name).write_text(json.dumps(obj,indent=2)+'\n')
def run(name,argv,cwd=work,timeout=600,env=None):
    start=time.monotonic();started=datetime.datetime.now(datetime.timezone.utc).isoformat()
    with (out/(name+'.log')).open('wb') as log:
        try:code=subprocess.run(list(map(str,argv)),cwd=cwd,stdout=log,stderr=subprocess.STDOUT,timeout=timeout,env={**os.environ,**(env or {})}).returncode
        except subprocess.TimeoutExpired:code=124
    row=dict(argv=list(map(str,argv)),cwd=str(cwd),environment=env or {},started=started,exit=code,seconds=time.monotonic()-start,log_sha256=sha((out/(name+'.log')).read_bytes()))
    save(name+'.receipt.json',row);print(json.dumps(dict(name=name,exit=code,seconds=round(row['seconds'],2))),flush=True)
    return code
pip=[sys.executable,'-B','-m','pip','--isolated'];cache=['--cache-dir','/work/pip-cache']
common=['--index-url','https://pypi.org/simple','--no-input','--require-hashes','--only-binary=:all:']
assert run('old-download',pip+['download',*common,'--no-deps','-r',str(req),'-d',str(work/'old-wheels'),*cache])==0
wheelproof=[]
for wheel in sorted((work/'old-wheels').glob('*.whl')):
    with zipfile.ZipFile(wheel) as z:
        assert len(z.namelist())==len(set(z.namelist()))
        metadata_name=next(n for n in z.namelist() if n.endswith('.dist-info/METADATA'))
        metadata_raw=z.read(metadata_name);metadata=email.message_from_bytes(metadata_raw)
        record=next(n for n in z.namelist() if n.endswith('.dist-info/RECORD'));checked=0
        for name,digest,size in csv.reader(io.StringIO(z.read(record).decode())):
            assert '..' not in pathlib.PurePosixPath(name).parts and not name.startswith('/')
            raw=z.read(name)
            if digest:
                alg,encoded=digest.split('=',1);assert alg=='sha256' and base64.urlsafe_b64encode(hashlib.sha256(raw).digest()).rstrip(b'=').decode()==encoded
                assert len(raw)==int(size);checked+=1
        row=dict(filename=wheel.name,bytes=wheel.stat().st_size,sha256=sha(wheel.read_bytes()),record_members_verified=checked,name=metadata['Name'],version=metadata['Version'],metadata_sha256=sha(metadata_raw),requires_dist=metadata.get_all('Requires-Dist',[]),provides_extra=metadata.get_all('Provides-Extra',[]))
        wheelproof.append(row)
        if metadata['Name'].lower()=='semgrep':
            official_metadata=metadata_raw;semgrep_wheel=wheel;semgrep_record=z.read(record);official_distinfo={n:z.read(n) for n in z.namelist() if n.startswith(metadata_name.rsplit('/',1)[0]+'/')}
assert len(wheelproof)==len(re.findall(r'^[\w.-]+==',req.read_text(),re.M))
save('old-wheel-members.json',wheelproof)
assert sha(semgrep_wheel.read_bytes())=='c142ec04a2ed144970cb0a92f6877651dd3c088505eec737bb7f4db7ae5f0ffa'
assert run('old-install',pip+['install',*common,'--no-compile','--no-deps','--target',str(work/'old-site'),'-r',str(req),'--report',str(out/'old-official-install.json'),*cache])==0
oldsite=work/'old-site';oldoriginal=c.tool_tree(oldsite,python_site=True)
assert oldoriginal==policy['semgrepBuild']['originalPackageTree']
oldengine=b.install_engine(oldsite,c.HERE/b.ENGINE_ARCHIVE,policy['semgrepBuild'],work/'old-preserved')
oldassembled=c.tool_tree(oldsite,python_site=True);assert oldassembled==policy['semgrepPackageTree']
save('old-reproduction.json',dict(source_head=c.git(root,'rev-parse','HEAD').decode().strip(),source_tree=c.git(root,'rev-parse','HEAD^{tree}').decode().strip(),requirements_sha256=sha(req.read_bytes()),originalPackageTree=oldoriginal,semgrepPackageTree=oldassembled,engine=oldengine,upstream_wheel_sha256=sha(semgrep_wheel.read_bytes()),all_original_identities_reproduced=True))
oldlines=[b'Requires-Dist: mcp==1.29.0',b'Requires-Dist: opentelemetry-api~=1.37.0',b'Requires-Dist: opentelemetry-sdk~=1.37.0',b'Requires-Dist: opentelemetry-exporter-otlp-proto-http~=1.37.0']
newlines=[b'Requires-Dist: mcp==1.30.0',b'Requires-Dist: opentelemetry-api~=1.45.1',b'Requires-Dist: opentelemetry-sdk~=1.45.1',b'Requires-Dist: opentelemetry-exporter-otlp-proto-http~=1.45.1']
patched=official_metadata
for old,new in zip(oldlines,newlines):
    assert patched.count(old+b'\n')==1;patched=patched.replace(old+b'\n',new+b'\n')
delta=''.join(difflib.unified_diff(official_metadata.decode().splitlines(True),patched.decode().splitlines(True),fromfile='semgrep-1.181.0.dist-info/METADATA.official',tofile='semgrep-1.181.0.dist-info/METADATA.custom',n=3))
(out/'semgrep-dependency-metadata.patch').write_text(delta)
save('patch-identity.json',dict(status='CUSTOM_CANDIDATE_ONLY_NOT_OFFICIAL_UPSTREAM_WHEEL',upstream_wheel_sha256=sha(semgrep_wheel.read_bytes()),upstream_metadata_sha256=sha(official_metadata),custom_metadata_sha256=sha(patched),patch_sha256=sha(delta.encode()),old_new_requires_dist=[dict(old=a.decode(),new=b.decode()) for a,b in zip(oldlines,newlines)],other_metadata_unchanged=True,official_wheel_rewritten=False))
env=work/'candidate-env';assert run('candidate-venv',[sys.executable,'-B','-m','venv','--without-pip',str(env)])==0
py=env/'bin/python';site=env/'lib/python3.12/site-packages'
semgrepreq=work/'semgrep-only.txt';semgrepreq.write_text(next(line for line in req.read_text().splitlines() if line.startswith('semgrep=='))+'\n')
newpip=pip+['--python',str(py)]
assert run('candidate-upstream-seed',newpip+['install',*common,'--no-compile','--no-deps','-r',str(semgrepreq),'--report',str(out/'candidate-upstream-seed.json'),*cache])==0
metadata=site/'semgrep-1.181.0.dist-info/METADATA';assert metadata.read_bytes()==official_metadata
seed_distinfo={p.name:sha(p.read_bytes()) for p in metadata.parent.iterdir() if p.is_file()}
save('candidate-upstream-distinfo-before-patch.json',seed_distinfo)
def apply_metadata(raw,wheel_sha='c142ec04a2ed144970cb0a92f6877651dd3c088505eec737bb7f4db7ae5f0ffa'):
    assert wheel_sha==sha(semgrep_wheel.read_bytes()),'UNKNOWN_WHEEL'
    assert sha(raw)==sha(official_metadata),'EXACT_METADATA_PREIMAGE_REQUIRED'
    result=raw
    for a,b in zip(oldlines,newlines):assert result.count(a+b'\n')==1;result=result.replace(a+b'\n',b+b'\n')
    assert sha(result)==sha(patched),'CUSTOM_METADATA_POSTIMAGE_DRIFT'
    return result
metadata.write_bytes(apply_metadata(metadata.read_bytes()))
candidate_req=pathlib.Path('/evidence/official/combined-requirements.txt')
assert run('candidate-dependency-aware-dry-run',newpip+['install',*common,'--no-compile','--dry-run','-r',str(candidate_req),'--report',str(out/'candidate-solver.json'),*cache])==0
assert run('candidate-dependency-aware-install',newpip+['install',*common,'--no-compile','-r',str(candidate_req),'--report',str(out/'candidate-installed.json'),*cache])==0
assert run('candidate-pip-check',newpip+['check'])==0
custom_original=c.tool_tree(site,python_site=True)
profile=dict(policy['semgrepBuild'],originalPackageTree=custom_original)
engine=b.install_engine(site,c.HERE/b.ENGINE_ARCHIVE,profile,work/'candidate-preserved')
custom_assembled=c.tool_tree(site,python_site=True)
assert metadata.read_bytes()==patched
distinfo=metadata.parent
after_distinfo={p.name:sha(p.read_bytes()) for p in distinfo.iterdir() if p.is_file()}
save('candidate-custom-distinfo-after-patch.json',after_distinfo)
assert {k:v for k,v in seed_distinfo.items() if k!='METADATA'}=={k:v for k,v in after_distinfo.items() if k!='METADATA'},'NON_METADATA_DISTINFO_DRIFT'
def inventory(folder):return {p.relative_to(folder).as_posix():sha(p.read_bytes()) for p in folder.rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix not in ('.pyc','.pyo')}
oldfiles=inventory(oldsite);newfiles=inventory(site)
oldchanges={n for n in oldfiles if n.startswith(('mcp/','mcp-','opentelemetry/','opentelemetry_'))}
newchanges={n for n in newfiles if n.startswith(('mcp/','mcp-','opentelemetry/','opentelemetry_'))}
changes=[dict(path=n,old_sha256=oldfiles.get(n),new_sha256=newfiles.get(n)) for n in sorted(oldfiles.keys()|newfiles.keys()) if oldfiles.get(n)!=newfiles.get(n)]
unexplained=[r for r in changes if r['path'] not in oldchanges|newchanges|{'semgrep-1.181.0.dist-info/METADATA','semgrep-1.181.0.dist-info/RECORD'}]
save('installed-file-delta.json',dict(changes=changes,unexplained=unexplained))
assert not unexplained,'UNRELATED_INSTALLED_FILE_DRIFT'
save('candidate-trees.json',dict(originalPackageTree=custom_original,semgrepPackageTree=custom_assembled,engine=engine,custom=True,semgrep_other_distinfo_unchanged=True))
neg=[]
for label,raw,wh in [('tampered-metadata',official_metadata+b'\n','c142ec04a2ed144970cb0a92f6877651dd3c088505eec737bb7f4db7ae5f0ffa'),('wrong-version',official_metadata.replace(b'Version: 1.181.0',b'Version: 1.181.1'),'c142ec04a2ed144970cb0a92f6877651dd3c088505eec737bb7f4db7ae5f0ffa'),('unknown-wheel',official_metadata,'0'*64),('already-custom',patched,'c142ec04a2ed144970cb0a92f6877651dd3c088505eec737bb7f4db7ae5f0ffa')]:
    try:apply_metadata(raw,wh);rejected=False
    except AssertionError:rejected=True
    assert rejected;neg.append(dict(case=label,rejected=True))
incompatible=work/'incompatible.txt';incompatible.write_text('mcp==1.29.0\nsemgrep==1.181.0\n')
code=run('incompatible-solver',newpip+['install','--dry-run','--only-binary=:all:','--index-url','https://pypi.org/simple','-r',str(incompatible),*cache]);assert code!=0
missing=site/'opentelemetry_api-1.45.1.dist-info';hidden=work/'missing-api.dist-info';missing.rename(hidden)
try:code=run('missing-dependency-pip-check',newpip+['check']);assert code!=0
finally:hidden.rename(missing)
save('adverse-results.json',dict(metadata_rejections=neg,incompatible_solver_refused=True,missing_dependency_refused=True,source_policy_unchanged=True))
entry=[str(py),'-I','-S','-B','-c',c.SEMGREP_ENTRY,str(site)]
assert run('old-semgrep-version',[sys.executable,'-I','-S','-B','-c',c.SEMGREP_ENTRY,str(oldsite),'--version'],env={'SEMGREP_SEND_METRICS':'off','SEMGREP_ENABLE_VERSION_CHECK':'0'})==0
assert run('new-semgrep-version',entry+['--version'],env={'SEMGREP_SEND_METRICS':'off','SEMGREP_ENABLE_VERSION_CHECK':'0'})==0
assert run('old-core-version',[str(oldsite/'semgrep/bin/semgrep-core'),'-version'])==0
assert run('new-core-version',[str(site/'semgrep/bin/semgrep-core'),'-version'])==0
save('bridge-summary.json',dict(status='CANDIDATE_SOLVER_PASS_RUNTIME_PENDING',old_tree_proof=True,full_dependency_aware_solver=True,pip_check=True,official_wheel_unchanged=True,custom_metadata_only=True,stage_technical_edit_eligible=False))
