import datetime,hashlib,json,pathlib,re,shutil,subprocess,sys
sys.path.insert(0,str(pathlib.Path(__file__).parent))
from gf01_run import ROOT,CP,EVIDENCE,write_json,digest
CHECKPOINT=ROOT/CP
for filename in ['gf01_report.py','gf01_intake_evidence.py','gf01_verify_delivery.py','gf01_profile_append.py','gf01_test.py']:
 shutil.copyfile(pathlib.Path(__file__).parent/filename,EVIDENCE/filename)
BASE='dbcfce9770850d4655221bd3d4c3b5799553aed2'
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT).decode().strip()
source=dict(commit='1dc58a5c5e49c3ffeada603f7e6f6038fc12803d',tree='b0a80f55a472fc28f02a5e993912314a17726f6c')
assert git('rev-parse','HEAD')==source['commit']
labels=['full-governance','targeted-qr02','targeted-qr03','fixture-ast-proof','fresh-npm-ci','forced-root-tests','forced-typecheck','forced-lint','original-secret12','source-worklist-check','original-security70','strict-profile']
receipts={label:json.loads((EVIDENCE/(label+'.receipt.json')).read_bytes()) for label in labels}
for label,value in receipts.items():
 assert value['source_commit']==source['commit'] and value['source_tree']==source['tree']
 assert value['status']=='PASS' or label=='original-security70'
assert receipts['full-governance']['counts']==dict(passed=101,failed=0,skipped=2)
assert receipts['targeted-qr02']['counts']==receipts['targeted-qr03']['counts']==dict(passed=8,failed=0,skipped=0)
assert receipts['forced-root-tests']['counts']==dict(passed=6067,failed=0,skipped=0)
assert receipts['original-secret12']['counts']==dict(passed=12,failed=0,skipped=0)
def ids(log):return re.findall(r'^test_\S+ \(([^)]+)\) \.\.\.',log,re.M)
baseline=(EVIDENCE/'baseline-governance.log').read_text();final=(EVIDENCE/'full-governance.log').read_text()
old,new=ids(baseline),ids(final);added=sorted(set(new)-set(old));removed=sorted(set(old)-set(new))
assert len(old)==93 and len(new)==103 and not removed and len(added)==10
old_skips=re.findall(r'^test_\S+ \(([^)]+)\) \.\.\. skipped (.+)$',baseline,re.M)
new_skips=re.findall(r'^test_\S+ \(([^)]+)\) \.\.\. skipped (.+)$',final,re.M)
assert old_skips==new_skips and len(new_skips)==2 and all('Windows junction test only' in reason for _,reason in new_skips)
write_json(EVIDENCE/'test-inventory.json',dict(schema_version=1,baseline_count=93,current_count=103,old_ids=old,current_ids=new,added_ids=added,removed_ids=removed,skips=new_skips,unchanged_original_qr02_methods=8,unchanged_original_qr03_methods=8,unchanged_original_test_method_ASTs_and_source_bodies=True,fixture_repair_approaches=1,ordinary_subprocess_discovery=True,alternate_frozen_endpoint_harness_used=False))
a=json.loads((CHECKPOINT/'inputs/SOURCE_EDIT_AUTHORIZATION.json').read_bytes())
changes=git('diff','--name-only',BASE).splitlines()+git('ls-files','--others','--exclude-standard').splitlines()
allowed={row['path'] for row in a['allowed_existing_files']}|set(a['new_exact_files'])
assert all(path in allowed or any(path.startswith(prefix) for prefix in a['new_prefixes']) for path in changes)
for row in a['protected_unchanged']:assert digest((ROOT/row['path']).read_bytes())==row['sha256']
registry='docs/brain/reviews/M1-03/SH01-REVIEW01/ADR_REGISTRY.json'
assert len(json.loads((ROOT/registry).read_bytes())['records'])==51
write_json(EVIDENCE/'custody-summary.json',dict(schema_version=1,authorization_id=a['authorization_id'],external_manifest_sha256='6510d0f948e93517eb4c2bb5875f5988507642a3c10f065c8d250222dfeec30f',base_commit=BASE,base_tree=a['base_tree'],implementation=source,measured_source=source,source_writer_count=1,fresh_clone=True,hardlinks=False,alternates=False,writable_preimages_verified=7,protected_preimages_verified=16,protected_current_files_identical=16,roadmap_tasks=47,module_identities=27,prior_adr_records=51,prior_adr_registry=registry,source_edit_union_permitted=False,fixture_repair_approaches=1,worklist_regenerated=False,original_active_records_unchanged=True,protected_source_go=False,main_promotion_authorized=False,hosted_replay_authorized=False,accepted_tasks=a['accepted_tasks'],incremental_spend_usd=0,context_health=dict(level='LOW',compactions_observed=0,status='sufficient; no scope expansion; independent Brain review required')))
security=receipts['original-security70'];security_log=(EVIDENCE/'original-security70.log').read_text()
security_summary='exit '+str(security['exit_code'])+'; 70 tests, '+str(security['observed_inventory']['failure_events'])+' failure events and '+str(security['observed_inventory']['errors'])+' errors; '+str(security.get('counts'))+' counts distinct test methods'
assert 'WORKFLOW_SBOM_UNRELATED_FAILURE_OR_DRIFT' in security_log or security['exit_code']==0
CHECKPOINT.joinpath('README.md').write_text(f'''# M1-03 / GOVERNANCE-FIXTURE-01

Submitted for independent Brain review under `{a['authorization_id']}`. This repairs historical governance fixtures only. Whole M1-03 remains unaccepted.

Implementation and measured source: `{source['commit']}`, tree `{source['tree']}`. The later delivery commits contain checkpoint evidence and factual handoff only. The live stage ref supplies the final delivery SHA; its exact CI observations and postcommit validation receipts accompany the return packet to avoid a self-referential Git hash.

The original 93-test ordinary Linux discovery reproduced three failure events, one error, and two genuine Windows-only skips. Current ordinary discovery runs all 103 tests: 101 pass, zero failure/error, and the same two skips. The ten added tests include nine adverse cases. Original QR02 and QR03 targeted modules each pass 8/8. All original test method ASTs and exact bodies remain unchanged; only their setUp byte-source selection changed.

QR02 fixture active/attributes/governance bytes come from authentic delivery `3dcaf50633024ec652fe7b14a5c9072eac92642e` / `fd98eedb0cef6644d8e1538047aacbe44f10d837`; QR03 uses `dbcfce9770850d4655221bd3d4c3b5799553aed2` / `93d9a5789c1ce443cf0bcd86696fff044ff2fd64`. Each read verifies tree, Git blob, SHA256 and size and refuses missing/corrupt objects. No global ROOT mutation or alternate endpoint harness was used. One bounded fixture-repair approach was sufficient.

The appended profile preserves all historical source bytes and default refusals, seals QR03 at its immutable delivery tree, retains the fixed QR02 predecessor validation chain, and applies only this new exact grant to its own interval. It rejects unauthorized intermediate/reverted commits and restricted edits inside allowed filenames. Inputs and the new QR03 review contain the entire supplied 14-file context byte-for-byte; prior reviews and original active records are unchanged.

See [RESULTS](RESULTS.md), [BLOCKERS](BLOCKERS.md), [strict report](completion-report.json), [regular Git blob manifest](SHA256SUMS.json), and [test inventory](evidence/test-inventory.json). Commands, cwd, source SHA/tree, raw exits, full logs and hash-bound receipts are under `evidence/`. The canonical clean worklist check passed without regenerating either output.

`protected_source_go=false`; `main_promotion_authorized=false`; `hosted_replay_authorized=false`; accepted tasks only M0-01/M0-02/M1-01/M1-02; spend USD0. PR9 stays draft/open/unmerged, and main stays `bbc28dc3d1f945191a81be56945b8bda7bb6ef73`. No self-acceptance, later task, clinical/device/archive/hosted/release authority.
''')
rows=[]
for label,v in receipts.items():rows.append(f"| {label} | {v['exit_code']} | {v.get('counts') or 'command passed; no test count asserted'} |")
CHECKPOINT.joinpath('RESULTS.md').write_text('''# Results

Measured source `{commit}` / tree `{tree}`.

| Command receipt | Actual exit | Observed counts |
|---|---:|---|
{rows}

The original ordinary baseline ran 93 tests with three failure events, one error, and two genuine Windows-only skips (exit1). That red baseline and the successful replacement are both retained. All baseline test IDs remain present; exactly ten new IDs were added. Negative tests still reject false GO, wrong branch/head/base, altered issuance/review/preimages, protected-source drift, tampered report artifacts, later QR03 contamination and unauthorized intermediate/reverted commits. The two original modules' 16 test ASTs and exact bodies are unchanged.

Fresh npm ci added 1,032 packages. Forced root tests pass 6,067/6,067; typecheck/lint pass; each forced command reports zero cached tasks. Original secret12 passes. Original Security70 is accounted independently and retains its actual exit/errors, including any genuine WORKFLOW_SBOM_UNRELATED_FAILURE_OR_DRIFT. No Security source, rule, fixture or acceptance record was edited.

The clean canonical Phase4 strict worklist check passed with no generated-file changes. Source code ends at the measured commit; subsequent changes are evidence and handoff only. The strict completion report and SHA256 manifest are checked against committed regular Git blobs after the evidence commit. Exact final-head GitHub Quality, Security and iOS jobs are captured after normal stage push in the accompanying return receipt; no pending run is called PASS and no historical run is relabeled as final-head.

Context health LOW, sufficient, no observed compaction. Stop for independent Brain review. No whole-M1-03 acceptance or protected admission.
'''.format(commit=source['commit'],tree=source['tree'],rows='\n'.join(rows)))
CHECKPOINT.joinpath('BLOCKERS.md').write_text(f'''# Owner blockers and review stop

- Original Security admission remains CLOSED. Findings/advisories and source coverage/SBOM issues remain unreviewed; the original proposal expiry remains 2026-10-21T00:00:00Z. The unchanged original Security70 contract produced {security_summary}. Its genuine failures remain failures, without a waiver or policy/fixture rewrite.
- Canonical Quality database acquisition previously failed on the original ECR immutable image with `Data limit exceeded`. Final-head Quality results are recorded as observed after delivery. No image substitution, credentials, quota retry, SQL/types/Edge change or hosted replay was attempted. PG15/17 rehearsals and source tests cannot replace canonical database authority.
- Independent Brain alone decides acceptance and promotion. Whole M1-03 is not accepted; QR03 notifications work remains PARTIAL_ACCEPTED for its bounded source scope. No M2/J05, clinical/patient/JANUS, provider/device, signing/TestFlight, archive, deployment or release action is authorized.

PR9 remains draft/open/unmerged; main is read-only and unchanged. `protected_source_go=false`, `main_promotion_authorized=false`, `hosted_replay_authorized=false`. Accepted tasks remain M0-01/M0-02/M1-01/M1-02. Spend USD0.

There is no remaining code blocker inside this finite fixture-repair grant. This is a source-only submission for independent review, with original protected owner gates retained red/closed.
''')
ROOT.joinpath('ONSKIN_BRAIN_HANDOFF.txt').write_text(f'''M1-03 / GOVERNANCE-FIXTURE-01 - SUBMITTED_REVIEW_REQUIRED
Authorization {a['authorization_id']}.
External manifest anchor verified: 6510d0f948e93517eb4c2bb5875f5988507642a3c10f065c8d250222dfeec30f.
Issued base {BASE}, tree {a['base_tree']}; 7 writable + 16 protected preimages verified.
Implementation/measured source {source['commit']}; tree {source['tree']}.
Only historical QR02/QR03 fixture setUp source selection and the disjoint GF01 interval/test/active authority changed. Original 16 test ASTs and source bodies unchanged; one repair approach.
Ordinary Linux governance: 103 tests, 101 pass, zero failure/error, two unchanged Windows-only skips. QR02 8/8 and QR03 8/8 targeted pass. Fresh npm ci 1032, root6067, typecheck/lint zero cached, original secret12 PASS. Original Security70: {security_summary}; preserve genuine rejection. Clean canonical worklist check PASS, no regeneration.
Checkpoint docs/brain/checkpoints/M1-03/GOVERNANCE-FIXTURE-01 contains strict report, complete source-bound command evidence and regular Git blob hashes. Final evidence delivery SHA/tree and exact-head original Quality/Security/iOS observations are in the live pushed ref and accompanying return receipt; evidence tail changes only checkpoint/handoff.
Original Security findings/advisories/SBOM remain unreviewed; proposal expired 2026-10-21T00:00:00Z. Canonical ECR acquisition remains an owner blocker; no replay, substitution or quota retry.
PR9 remains draft/open/unmerged; main bbc28dc3d1f945191a81be56945b8bda7bb6ef73 unchanged.
protected_source_go=false; main_promotion_authorized=false; hosted_replay_authorized=false.
Accepted tasks only M0-01/M0-02/M1-01/M1-02; tasks47/modules27/priorADRs51 unchanged; spend USD0.
Context health LOW; sufficient; no observed compaction. No self-acceptance/M2/clinical/device/archive/release. Stop for independent Brain review. Founder returns to Brain with: Codex is done.
''')
# Every command receipt is a bound execution. Prior failed baseline is retained independently.
executions=[]
for label in ['baseline-governance',*labels]:
 v=json.loads((EVIDENCE/(label+'.receipt.json')).read_bytes());path=CP+'evidence/'+label+'.receipt.json'
 executions.append({**{k:v[k] for k in ['command','working_directory','environment','source_commit','source_tree','status','exit_code']},'id':label,'axis':'source','admission':'NONE','evidence_class':'INDEPENDENTLY_REPRODUCED','artifact':path,'sha256':digest((ROOT/path).read_bytes())})
scope=[dict(id='G1',status='PASS',evidence=['strict-profile']),dict(id='G2',status='PASS',evidence=['fixture-ast-proof','targeted-qr02','targeted-qr03']),dict(id='G3',status='PASS',evidence=['full-governance']),dict(id='G4',status='PASS',evidence=['fresh-npm-ci','forced-root-tests','forced-typecheck','forced-lint']),dict(id='G5',status='PARTIAL_TESTED',evidence=['original-secret12','original-security70']),dict(id='G6',status='PASS',evidence=['source-worklist-check','strict-profile']),dict(id='G7',status='PASS',evidence=['strict-profile'])]
all_paths=set(git('diff','--name-only',BASE).splitlines())|set(git('ls-files','--others','--exclude-standard').splitlines())
all_paths.update(p.relative_to(ROOT).as_posix() for p in CHECKPOINT.rglob('*') if p.is_file())
artifacts=[dict(path=path,sha256=digest((ROOT/path).read_bytes())) for path in sorted(all_paths) if path not in ['ONSKIN_BRAIN_HANDOFF.txt',CP+'completion-report.json',CP+'SHA256SUMS.json']]
report=dict(schema_version=3,task_id='M1-03',iteration='GOVERNANCE-FIXTURE-01',branch=a['branch'],status='SUBMITTED_REVIEW_REQUIRED',measured=source,delivery_ref='refs/heads/'+a['branch'],executions=executions,artifacts=artifacts,scope_matrix=scope,ci=[],axes=dict(source='PARTIAL_TESTED_NOT_COMPLETE',integration='NOT_RUN',surface='NOT_RUN',physical_device='NOT_ADMITTED',live_provider='NOT_ADMITTED',qualified_review='NOT_ADMITTED',clinical='NOT_ADMITTED',commercial='NOT_ADMITTED',release='NOT_ADMITTED'),blockers=['Independent Brain review required; whole M1-03 remains unaccepted.','Original Security owner/source admission closed; findings/advisories/SBOM and original expiry remain unchanged.','Canonical ECR immutable image acquisition owner blocker; no hosted database replay or alternative image.'],context_health=dict(level='LOW',compactions_observed=0,scope_complete='finite fixture repair only',continuation='independent Brain review'))
write_json(CHECKPOINT/'completion-report.json',report)
manifest_paths=sorted({row['path'] for row in artifacts}|{CP+'completion-report.json','ONSKIN_BRAIN_HANDOFF.txt'})
entries=[]
for path in manifest_paths:
 raw=(ROOT/path).read_bytes();blob=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
 entries.append(dict(path=path,git_blob=blob,sha256=digest(raw),bytes=len(raw),git_mode='100755' if (ROOT/path).stat().st_mode & 0o111 else '100644'))
write_json(CHECKPOINT/'SHA256SUMS.json',dict(schema_version=1,kind='COMMITTED_REGULAR_GIT_BLOB_SHA256_MANIFEST',measured_source=source,delivery_ref='refs/heads/'+a['branch'],self_excluded_to_avoid_hash_cycle=True,entries=entries))
print('Prepared strict report with',len(executions),'actual executions,',len(artifacts),'artifacts and',len(entries),'checksum objects; actual Security exit',security['exit_code'])
