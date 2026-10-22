import pathlib,json,subprocess,sys
r=pathlib.Path('/root/onskin-governance-fixture01');sys.path.insert(0,str(r/'scripts/brain'))
import brain,m103_profile as p
assert pathlib.Path('/tmp/gf01-approach01-smoke.log').read_text().rstrip().endswith('OK'),'Smoke not complete and green'
active=r/p.GF01_ACTIVE;value=brain.decode(active.read_bytes());value['submission_status']='SUBMITTED_REVIEW_REQUIRED';active.write_bytes(brain.encoded(value))
paths=['.gitattributes','ONSKIN_BRAIN_HANDOFF.txt','scripts/brain/m103_profile.py','scripts/brain/test_m103_quality_recovery02_profile.py','scripts/brain/test_m103_quality_recovery03_profile.py',p.GF01_ACTIVE,'scripts/brain/test_m103_governance_fixture01_profile.py',p.GF01_INPUT,p.GF01_REVIEW]
subprocess.run(['git','add','--',*paths],cwd=r,check=True)
a=brain.load(r,p.GF01_INPUT+'/SOURCE_EDIT_AUTHORIZATION.json');allowed={x['path'] for x in a['allowed_existing_files']}|set(a['new_exact_files'])
for path in subprocess.check_output(['git','diff','--cached','--name-only'],cwd=r).decode().splitlines():assert path in allowed or any(path.startswith(prefix) for prefix in a['new_prefixes']),path
subprocess.run(['git','diff','--cached','--check'],cwd=r,check=True)
subprocess.run(['git','-c','user.name=Codex onSkin source engineering','-c','user.email=codex-onskin@localhost','-c','commit.gpgsign=false','commit','-m','Pin historical QR02 and QR03 fixture sources and add disjoint GF01 custody'],cwd=r,check=True)
assert not subprocess.check_output(['git','status','--porcelain=v1'],cwd=r)
print('SOURCE_COMMIT='+brain.git(r,'rev-parse','HEAD'));print('SOURCE_TREE='+brain.git(r,'rev-parse','HEAD^{tree}'))
