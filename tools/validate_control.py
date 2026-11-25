from __future__ import annotations
import hashlib,json,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[1]
def load(p):return json.loads((root/p).read_text(encoding='utf-8'))
c=load('CONTROL.json');features=load('features/INDEX.json');gates=load('gates/INDEX.json');contract=load(c['original_contract'])
expected=set(contract['required_f']+contract['required_c']+contract['required_p']+contract['korean_candidates'])
assert len(features)==38 and {r['id'] for r in features}==expected,'Requirement registry mismatch'
assert len(gates)==18 and len({g['id'] for g in gates})==18,'Gate registry mismatch'
assert c['public_release']=='NO_GO' and c['beta_distribution']=='NOT_AUTHORIZED','Bootstrap must not grant release'
assert c['new_spend_authorized']==0 and contract['korean_candidates']==['J01'],'Scope/spend mismatch'
a=c['active_task'];p=root/a['path'];assert p.is_file() and hashlib.sha256(p.read_bytes()).hexdigest()==a['sha256'],'Task bytes mismatch'
for r in features:assert (root/'features'/(r['id']+'.md')).is_file() and r['formal_acceptance']=='UNACCEPTED'
for g in gates:assert (root/'gates'/(g['id']+'.md')).is_file() and not g['admitted']
for p in root.rglob('*'):
 if p.is_file():assert '.github/workflows' not in p.as_posix(),'No workflows in control branch'
parts=load('sources/engineering39/PARTS_INDEX.json')
for x in parts:
 b=b''.join((root/p).read_bytes() for p in x['parts']);assert len(b)==x['published_bytes'] and hashlib.sha256(b).hexdigest()==x['published_sha256'],'Evidence reassembly mismatch'
print(json.dumps({'status':'PASS','features':len(features),'gates':len(gates),'active_task':a['id'],'source_parts_verified':len(parts)}))
