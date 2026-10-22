import importlib.util,pathlib,json,subprocess,ast,hashlib,shutil,os
root=pathlib.Path('/root/onskin-governance-fixture01')
base=pathlib.Path('/mnt/c/Users/jasim/Documents/ChatGPT/MasterV2Code')
ctx=base/'governance-fixture01-context'
# Refuse any source mutation until baseline discovery has actually completed.
assert pathlib.Path('/tmp/gf01-baseline-governance.log').read_text().rstrip().endswith('FAILED (failures=3, errors=1, skipped=2)'), 'Baseline incomplete or unexpected'
assert not subprocess.check_output(['git','status','--porcelain=v1'],cwd=root)
lock=root/'.git/gf01-writer.json'
with lock.open('x') as f: json.dump({'authorization':'M103-GOVERNANCE-FIXTURE01-SOURCE-EDIT-01','executor':'single Codex root agent','pid':os.getpid()},f)
for destination in [root/'docs/brain/checkpoints/M1-03/GOVERNANCE-FIXTURE-01/inputs',root/'docs/brain/reviews/M1-03/QR03-REVIEW01']:
 shutil.copytree(ctx,destination)
 for file in ctx.iterdir(): assert (destination/file.name).read_bytes()==file.read_bytes()
sys_path=root/'scripts/brain'
import sys
sys.path.insert(0,str(sys_path))
import brain,m103_profile as p
profile=root/'scripts/brain/m103_profile.py'
original=profile.read_bytes(); addition=(base/'gf01_profile_append.py').read_bytes()
assert addition.startswith(b'\n\n# Independent GOVERNANCE-FIXTURE-01 issuance;')
profile.write_bytes(original+addition)
import importlib
p=importlib.reload(p)
for label in p.GF01_FROZEN:
 path=root/('scripts/brain/test_m103_quality_recovery'+label[-2:]+'_profile.py')
 path.write_bytes(p.gf01_fixture_source(path.read_bytes(),label))
attrs=root/'.gitattributes';attrs.write_bytes(attrs.read_bytes()+p.GF01_ATTRIBUTES)
(root/p.GF01_ACTIVE).write_bytes(brain.encoded({**p.gf01_active_expected(),'submission_status':'IN_PROGRESS'}))
shutil.copyfile(base/'gf01_test.py',root/'scripts/brain/test_m103_governance_fixture01_profile.py')
(root/'ONSKIN_BRAIN_HANDOFF.txt').write_text('M1-03 / GOVERNANCE-FIXTURE-01\nAuthorization M103-GOVERNANCE-FIXTURE01-SOURCE-EDIT-01.\nExact external manifest verified; all 7 writable + 16 protected preimages match.\nImplementation and checks IN_PROGRESS. Historical test bodies remain unchanged.\nPR9 draft/open/unmerged; main unchanged.\nprotected_source_go=false; main_promotion_authorized=false; hosted_replay_authorized=false.\nAccepted tasks M0-01/M0-02/M1-01/M1-02; spending USD0.\nOriginal Security and canonical ECR database owner gates remain closed.\n',encoding='utf-8')
for name in ['scripts/brain/m103_profile.py','scripts/brain/test_m103_quality_recovery02_profile.py','scripts/brain/test_m103_quality_recovery03_profile.py','scripts/brain/test_m103_governance_fixture01_profile.py']:
 ast.parse((root/name).read_bytes(),filename=name)
print('Installed exact context twice; one disjoint source implementation; one fixture-repair approach.')

