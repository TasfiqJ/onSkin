"""Write factual report/summary from completed durable receipts; no source acceptance."""
import datetime, hashlib, json, pathlib, re, subprocess, sys
root=pathlib.Path.cwd(); prefix=pathlib.Path('docs/brain/checkpoints/M1-03/SECURITY-REMEDIATION-WAVE-01'); out=root/prefix
base='05dc51d6c945d31c66b921ae99dee603de464cdc'; tree='fc579c91528aa285f28f6364d7f4da8ee2aafd3b'
def load(p):return json.loads(p.read_bytes())
tests=[]
for folder in ('docker-checks','local-checks'):
    for path in sorted((out/'evidence'/folder).glob('*.receipt.json')):
        receipt=load(path); log=path.with_name(path.name.replace('.receipt.json','.log'))
        body=log.read_text(errors='replace') if log.exists() else ''; plain=re.sub(r'\x1b\[[0-9;]*m','',body)
        count=re.findall(r'Ran (\d+) tests?',plain); tap=dict(re.findall(r'^# (tests|pass|fail|skipped) (\d+)\s*$',plain,re.M))
        vitest=re.findall(r'Tests\s+(\d+) passed',plain)
        tests.append({'name':path.name.removesuffix('.receipt.json'),'exit':receipt['exit'],'status':'PASS' if receipt['exit']==0 else 'RAW_NONZERO',
            'receipt':path.relative_to(root).as_posix(),'log':log.relative_to(root).as_posix(),'log_sha256':hashlib.sha256(log.read_bytes()).hexdigest() if log.exists() else None,
            'unittest_total':int(count[-1]) if count else None,'tap_counts':{k:int(v) for k,v in tap.items()},'vitest_pass_counts':[int(n) for n in vitest],
            'source_commit':base,'source_tree':tree})
ci_path=out/'evidence/delivery-ci.json';ci=load(ci_path) if ci_path.exists() else load(out/'evidence/baseline-ci.json')
report={'schema_version':1,'task_id':'M1-03','iteration':'SECURITY-REMEDIATION-WAVE-01','authorization_id':'M103-SECURITY-REMEDIATION-WAVE01-CONDITIONAL-SOURCE-EDIT-01',
    'status':'SUBMITTED_REVIEW_REQUIRED','accepted_by_brain':False,'admission':'NONE','protected_source_go':False,
    'external_manifest_sha256':'249b00aae6198adca75225b911f1c8273ce94ff9a2b129fe4b1f45edd494e303','preimage_fingerprint':'9fe6fec09698e595def19a6f7304d1376f850e32d12051e8ebdd882f16fd3c2f',
    'baseline':{'commit':base,'tree':tree},'implementation':{'source_edits':0,'commit':base,'tree':tree,'reason':'All three pinned dependency-aware candidates are incompatible with protected Semgrep requirements.'},
    'measured_source':{'commit':base,'tree':tree},'delivery':{'branch':'stage/m1-gate-recovery','commit':None,'tree':None,'resolve_via':'Final normal push is independently read after commit. Manifest-only tail does not change measured implementation. No future self-hash.'},
    'main':'d9912f4c8b30358593569c5b9b4e84773c6f463e','pr':{'number':10,'draft':True,'open':True,'merged':False},
    'accepted_tasks':['M0-01','M0-02','M1-01','M1-02'],'incremental_spend_usd':0,'legacy_proposal_expiry':'2026-10-21T00:00:00Z',
    'workstreams':{'A':'BLOCKED_DEPENDENCY_CONSTRAINT; original and all candidate trees measured; stage unchanged','B':'DIAGNOSTIC_COMPLETE; 20407 paths, 8485 extra, 90 changed; 189/368 historical locations rebound','C':'DIAGNOSTIC_COMPLETE; safe provider triage and rejected installed npm candidate','D':'EXACT_CI_OBSERVED; final-head observation follows normal delivery push'},
    'measured_improvement':{'stage_vulnerabilities_removed':0,'changed_candidate_python_versions_clear_target_advisories':2,'candidate_admission':False,'original_tool_trees_reproduced':2,'candidate_trees_measured':3,'review_paths_bound':20407,'historical_failed_targets_bound':189,'historical_fixpoint_locations_bound':368,'secret_findings_suppressed':0},
    'tests':tests,'ci':ci,'blockers':['Protected Semgrep dependency metadata excludes patched MCP/OpenTelemetry','Original source inventory drift and 61 classifier refusals','OWASP current registry bytes differ from original pin','Original current/history secret findings unreviewed','node-forge has no official patched release; root-only candidate leaves six high propagated findings','Expired original Security proposal and exception policy','Canonical ECR provider block remains separate; see exact run receipts'],
    'environment':'Initial WSL ENOSPC/EIO interrupted a suite. Completed official Ubuntu24.04 Docker replacement uses Python3.12.3/glibc2.39, memory-backed disposable scratch and durable Windows receipts. See environment-fault.json and docker-runtime.json.',
    'forbidden_axes':{'main_promotion':False,'m2':False,'hosted_db_replay':False,'signing':False,'testflight':False,'release':False,'patient_data':False},
    'context_health':'Single issued ZIP only; exact inputs preserved; no union; one stage writer; independent Brain review required.',
    'next_proposed_source_scope':'SCANNER-DEPENDENCY-METADATA-BRIDGE-01 (proposal only; NEXT_PROPOSED_SOURCE_SCOPE.md)',
    'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
if '--interim' in sys.argv:
    report['status']='WORK_IN_PROGRESS_CHECKPOINT'; report['outstanding']='Original governance/root suites and final delivery CI still running/pending; this milestone is not the completed task.'
(out/'completion-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
lines=['**Evidence delivery for independent Brain review. Stage technical changes: zero; Security NO GO.**','',
       'Measured source/test snapshot: `'+base+'`, tree `'+tree+'`. Original and patched-family scanner trees are measured in isolated no-hardlink Linux clones. Every dependency-aware candidate resolver exits 1, so both protected technical source files remain unchanged.','',
       '| Check | Actual exit | Measured count |','| --- | ---: | --- |']
for t in tests:
    count=t['unittest_total'] or t['tap_counts'].get('tests') or (' + '.join(map(str,t['vitest_pass_counts'])) if t['vitest_pass_counts'] else 'See receipt')
    lines.append(f"| {t['name']} | {t['exit']} | {count} |")
lines += ['', 'Raw nonzero exits stay nonzero. Strict report/profile refusals do not admit this task. The first root-directory Expo invocation, if refused, is separate from the passing check in the correct mobile workspace. Worklist drift is reported as such unless the unchanged canonical generator is separately run on a clean measured source.', '',
    'Measured engineering progress: 13 changed/new family wheels independently verified; original upstream/assembled identities reproduced; three candidate trees and family-only file deltas measured; 20,407 base paths classified; all 189 historical failed targets and 368 fixpoint locations bound to current blobs; original provider current/history secret artifacts safely partitioned; one real installed npm candidate rejected because its vulnerability remains.', '',
    'Actual vulnerability reduction on stage is **zero**. Official advisory controls detect both old vulnerable Python versions and return no advisory for the proposed fixed versions, but incompatible dependency metadata prevents applying that candidate. No original SAST or provider source Security GO is claimed.', '',
    'Latest committed CI observations are in `evidence/delivery-ci.json` when present; otherwise `evidence/baseline-ci.json` is explicitly the issuance base. Read the final delivery SHA from GitHub after the final push. Prior/head or PR merge-tree observations are never borrowed as final-head success.', '',
    'Only the new checkpoint and factual root handoff may change. Preserve main, PR draft/open/unmerged, all source preimages, expired policy/owner pins and the accepted-task set. Spend $0. STOP for independent Brain review.']
(out/'RESULTS.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
blockers='''**Original Security remains NO GO. Independent Brain review required.**

- Both official patched Python families conflict with Semgrep1.181.0 declared requirements. All three complete candidate resolvers refuse; no stage requirements/proposal edit is eligible. A metadata-only bridge needs a new exact authorization and real compatibility tests.
- Base inventory is 8,485 extra/90 changed, with 61 unchanged-classifier refusals. The issued 8,308/89 count belongs to an earlier commit. Current source/coverage remains unreviewed; no original scanner run occurred.
- Three rule bundles reproduce; current OWASP registry bytes do not reproduce its pin. Recover authentic old bytes or obtain separately reviewed rule authority.
- Original provider current Gitleaks1121/history4351 findings remain unreviewed. Zero TruffleHog verified findings does not clear them. Owner TasfiqJ must classify and rotate/revoke real credentials if established; no raw values or suppressions are delivered.
- node-forge1.4.0 has no officially patched release. Removing its direct root declaration leaves Expo transitive paths and the same six high propagated records; that installed disposable candidate is rejected.
- Original proposal expiry2026-10-21 and exception expiry2026-10-17 remain expired. Owner-controlled source pins and all source admission remain closed.
- Canonical pinned ECR SQL probe returned Data limit exceeded at issuance base. New-head CI is independently recorded; an old successful job or PG15/17 rehearsal is not a substitute. No ECR retry, image substitution or paid quota change occurred.
- Initial WSL scratch failed after host ENOSPC/EIO. That partial governance run is not a pass. A memory-backed official Ubuntu Docker fallback reruns authorized checks and saves complete replacement receipts; original failed distro is left untouched after one restart attempt.

No main promotion, M2, hosted replay, clinical/patient data, deployment, signing/TestFlight, release or self-acceptance. The only next source scope is the proposal in NEXT_PROPOSED_SOURCE_SCOPE.md; it is not an issuance.
'''
(out/'BLOCKERS.md').write_text(blockers,encoding='utf-8')
handoff=f'''onSkin V2 | M1-03 SECURITY-REMEDIATION-WAVE-01 | SUBMITTED_REVIEW_REQUIRED
Sole authority: M103-SECURITY-REMEDIATION-WAVE01-CONDITIONAL-SOURCE-EDIT-01
External manifest: 249b00aae6198adca75225b911f1c8273ce94ff9a2b129fe4b1f45edd494e303
Implementation and measured source unchanged: {base}
Measured source tree: {tree}
Protected technical source edits: ZERO. All25 initial preimages passed; all24 other witness files remain unchanged.
Evidence-only delivery ref: stage/m1-gate-recovery. Final SHA/tree resolved externally after normal push; never invent a future self-hash. SHA256SUMS binds previously committed regular blobs.
Main remains d9912f4c8b30358593569c5b9b4e84773c6f463e. PR10 DRAFT/OPEN/UNMERGED; no auto-merge.
Original66-distribution Semgrep upstream/assembled identities reproduce; MCP, OpenTelemetry and combined scratch trees measured. All3 dependency-aware candidate resolvers exit1 against protected Semgrep constraints. Stage vulnerabilities removed:0. No source fix is falsely claimed.
Coverage base:20407 paths,8485 extra,90 changed,61 classifier refusals; issued8308/89 traced to earlier4f6a2d2. All189 historical failed targets and368 fixpoint locations now bound to current blobs;187 failed files unchanged,2 changed. Three rules reproduce, OWASP current bytes drift. Original SAST NOT RUN.
Provider base Security39997349147 failed: current Gitleaks1121/history4351; TruffleHog0 verified; npm6 high propagated; OSV4 package/location records. Raw secret artifacts remain private. Root-only npm removal tested and rejected; no stage npm edits.
Base Quality39997349019 failed canonical ECR Data limit exceeded; source QA,PG15/17,exports pass. iOS39997349006 source-only success. Later exact-head CI observations are separate in checkpoint evidence/delivery-ci.json and final external handoff.
Durable tests/argv/exits/tree/log hashes: checkpoint completion-report.json and evidence/docker-checks. Initial WSL failure not a pass; Docker fallback persists replacement receipts. Strict original report refusals are not admission.
Accepted tasks ONLY M0-01,M0-02,M1-01,M1-02. M1-03 NOT accepted. Proposal expiry2026-10-21T00:00:00Z unchanged; original exception expiry unchanged.
protected_source_go=false; hosted_db_go=false; M2=false; main_promotion=false; release=false. Spend USD0.
One proposal: SCANNER-DEPENDENCY-METADATA-BRIDGE-01. No self-issued next task.
Checkpoint: docs/brain/checkpoints/M1-03/SECURITY-REMEDIATION-WAVE-01/
Context health: exact single issued ZIP retained; no prior authority union; one source writer; source preimages reverified after byte-preserving NTFS compression.
STOP for independent Brain review. Founder relay: Codex is done.
'''
(root/'ONSKIN_BRAIN_HANDOFF.txt').write_bytes(handoff.encode())
print(json.dumps({'tests_receipts':len(tests),'report':'SUBMITTED_REVIEW_REQUIRED','source_edits':0,'admission':'NONE'}))
