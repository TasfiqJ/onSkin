"""Normalize authored evidence only; preserve captured raw bytes and bindings."""
from pathlib import Path
import hashlib
import json
import subprocess

repo=Path(r'C:\Users\jasim\Desktop\WeddingCards\work\m102-retained-resilience')
root=repo/'docs/brain/checkpoints/M1-02/RETAINED-MAJOR-CAMPAIGN-05'
run=Path(__file__).resolve().parent
def sha(data): return hashlib.sha256(data).hexdigest()
def blob(data): return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def lf(path,text): path.write_bytes((text.rstrip()+'\n').encode('utf-8'))

readme=(root/'README.md').read_text(encoding='utf-8')
readme=readme.replace('You now expands','You now offers expandable')
readme=readme.replace('in a complete independent checkout.', 'in the clean complete final checkout; the earlier independent-checkout proof remains historical.')
lf(root/'README.md',readme)
design=(root/'DESIGN_DECISIONS.md').read_text(encoding='utf-8').replace('New generic status cards and read-error screens have 48px controls, Back,', 'New generic status cards and read-error screens have 48px controls, Close or settings Back,')
lf(root/'DESIGN_DECISIONS.md',design)
lf(root/'EXTERNAL_OWNER_PACKET.md','''# Unapplied external owner packet — canonical DB image acquisition

Disposition: blocked external registry availability; no protected patch applied.

At measured source 74c08a37a761d3bb44601c2d6b4b52a8f9e9c6b7, original Quality run 40068215649 canonical DB job 120795820768 stopped before database rehearsal because the registry returned “Data limit exceeded.” First candidate job 120792463643 has the same acquisition refusal. Full original job logs and their hashes are in receipts/measured-canonical-db-failure.log and receipts/first-push-canonical-db-failure.log.

Owner action: the existing registry/service custodian must restore authorized acquisition of the unchanged canonical image, then rerun the original canonical job with the original workflow, image, SQL and drift checks. Success must bind that actual new run/head; the two passing PostgreSQL deletion rehearsals cannot substitute. No alternative image, dependency/workflow/SQL patch, expiry extension, credential search or paid capacity purchase is proposed or applied by this campaign.

Security/G97 and its original source/scanner/secret/advisory/expiry obligations remain separate and open. This packet grants no acceptance or release authority and asks the founder to make no engineering choice.
''')

# Authored documents/metadata/helpers have no external byte-identity promise.
# Captured receipts, E2E scripts/logs/snapshots and historical artifacts do.
authored=[p for p in root.iterdir() if p.is_file() and p.suffix in ['.md','.json','.py']]
authored += list((root/'tools').glob('*.py'))
for item in authored:
    if item.name=='evidence-manifest.json': continue
    item.write_bytes(item.read_bytes().replace(b'\r\n',b'\n'))
handoff=repo/'ONSKIN_BRAIN_HANDOFF.txt'
handoff.write_bytes(handoff.read_bytes().replace(b'\r\n',b'\n'))
subprocess.run(['git','diff','--check','--','apps/mobile/src','docs/USER_FLOW_TREE.md','docs/E2E_TESTING_CHECKLIST.md','docs/phase-4/generated','ONSKIN_BRAIN_HANDOFF.txt'],cwd=repo,check=True)

files=[]
for item in sorted(root.rglob('*')):
    if not item.is_file() or item==root/'evidence-manifest.json': continue
    raw=item.read_bytes()
    files.append(dict(path=item.relative_to(root).as_posix(),bytes=len(raw),sha256=sha(raw),git_blob=blob(raw)))
raw=handoff.read_bytes()
manifest=dict(schema_version=1,files=files,handoff=dict(path='ONSKIN_BRAIN_HANDOFF.txt',bytes=len(raw),sha256=sha(raw),git_blob=blob(raw)),self_hash_policy='This manifest excludes itself. Actual evidence-tail SHA/tree are observed after commit/push; no future self-hash. Captured raw bytes/bindings preserved; authored evidence uses LF.')
lf(root/'evidence-manifest.json',json.dumps(manifest,indent=2,ensure_ascii=False))
print(json.dumps(dict(evidence_files=len(files),bytes=sum(x['bytes'] for x in files),manifest_sha256=sha((root/'evidence-manifest.json').read_bytes()),raw_bytes='preserved',authored='LF'),indent=2))
