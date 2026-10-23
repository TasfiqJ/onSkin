"""Assemble factual checkpoint documents from completed measured receipts."""
import datetime,hashlib,json,pathlib,re,subprocess
base=pathlib.Path(__file__).resolve().parent;checkpoint=base.parent;root=checkpoint.parents[4]
load=lambda name:json.loads((base/name).read_bytes())
head='0ecfa2a646ce9b30e717f6995097515f884cfdaf';tree='b6b5ec635dd12e327a34904ebbd1e1252715bcd4'
security=load('after-install/security70.receipt.json');assert security['exit']==0 and 'Ran 70 tests' in (base/'after-install/security70.log').read_text()
index=load('execution-index.json');inventory=load('inventory-base/summary.json');secret=load('provider/safe-secret-summary.json');npm=load('fresh-npm-summary.json');candidate=load('npm-candidate/summary.json');runtime=load('bridge-runtime/candidate-trees.json')
receipts=[]
for name in ('npm-ci','security70','secret12','expiry8','governance103','mobile-expo','ios-source-check','worklist-check','strict-original-report','strict-gf01-report','npm-audit'):
    r=load('source-checks/'+name+'.receipt.json');receipts.append(dict(check='initial '+name,exit=r['exit'],seconds=round(r['seconds'],2),receipt='evidence/source-checks/'+name+'.receipt.json'))
for name in ('security70','strict-gf01-report'):
    r=load('after-install/'+name+'.receipt.json');receipts.append(dict(check='after npm ci '+name,exit=r['exit'],seconds=round(r['seconds'],2),receipt='evidence/after-install/'+name+'.receipt.json'))
table='\n'.join(f"| {r['check']} | {r['exit']} | {r['seconds']} |" for r in receipts)
results=f'''# Results: PARTIAL_DIAGNOSTIC

No live technical source change qualified. The tested implementation remains `{head}`, tree `{tree}`. Actual stage vulnerability reduction is zero. Evidence-only milestones are d53202d84b029b6ef783d2aeb24a5772b4846b9c and 32d23e4d787b75fa81b1e8d414efa1e1930f0265 (tree e5612a5dfb2dd989a10b023ccc50acc532928197). Final pushed SHA/tree and final-head CI are read externally after the final evidence commit; this document does not invent a future self-hash.

| Exact-source local check | Actual exit | Seconds |
| --- | ---: | ---: |
{table}

The complete original 70 Security contracts pass after fresh authenticated npm ci (1,032 packages). Before installation, the suite had 23 failing subcases/two errors because YAML was unavailable to workflow_contract.mjs; that failure is retained. Secret12 and expiry8 pass. Strict iOS source privacy, Expo SDK compatibility and canonical original worklist checks pass. Original historical report refusal and correct M1-03 GF01 `Wrong GF01 branch` refusal remain real exits 1. The wrong-profile invocation's exit 2 remains an invocation error, not an admission test.

Ordinary governance exits 124 at its 600-second bound with 80 cases started and no final suite result. It is INCOMPLETE, never a 103-case pass. Full forced 6,067 root tests/typecheck/lint with zero cache are NOT_RUN in this diagnostic-only wave. No live source-edit eligibility is claimed from incomplete validation.

Candidate engineering: all 66 old wheels and 13 changed/new family wheels authenticated, full old original/assembled trees reproduced, official wheel unchanged, exact four-line custom installed METADATA patch retained, genuine dependency-aware old/new solver checks and pip checks PASS. Actual old/new Semgrep startup/core, actual Semgrep MCP lifespan/session/tool, stateful HTTP lifecycle, actual Semgrep OTel configuration/propagation/thread context/local OTLP exporter PASS. Three original rule bundles produce the same two synthetic findings with a clean negative fixture and no errors/skips/fixpoints. Full four-rule proof is BLOCKED by unrecovered OWASP bytes. Unknown wheel/version/metadata/double patch, missing dependency, incompatible dependency/extra and extra scanner code refuse; restored trees match.

Inventory: {inventory['tracked']:,} paths; {inventory['inventory_counts']['extra']:,} extra, 90 changed, zero missing; 61 classifier refusals. Full hash-bound per-path reviewer matrix, all 26 SQL target identities and all 189 historical failed-target/368 fixpoint references remain open. No current source SAST coverage is asserted.

Original exact-tree provider Gitleaks is {secret['counts']['current_gitleaks']:,} current/{secret['counts']['history_gitleaks']:,} history, exits 2. Every current location binds to the exact source blob. No raw credential value or issuer disposition is exported. Original provider npm audit has six high propagated findings; fresh installed audit and same-SDK disposable candidate have {npm['counts']['high']} high, including the newly authenticated Zod advisory. The candidate's lock delta is {candidate['package_delta_count']}; node-forge remains 1.4.0 and Zod 3.25.76. No supported remediation is applied to stage.

Issued-source CI: Quality 40020077445 SUCCESS, including canonical ECR-backed credential-free Supabase verification; iOS 40020077467 SUCCESS source-only; Security 40020077385 FAILURE in all four original source-facing jobs, hosted DB job skipped. Earlier ECR Data limit exceeded remains intermittent historical infrastructure failure. Milestone2 CI is separately PENDING in evidence/milestone2-ci.json. Final delivery-head statuses must not inherit either observation.

All 51 completed command receipts, 13 nonzero receipt exits and six additional orchestration failure observations are indexed in evidence/execution-index.json. Expected adverse refusals and synthetic findings remain nonzero; no failure is rewritten as a green original provider gate. Earlier harness failures are explained in SEMGREP_BRIDGE_PROOF.md and BLOCKERS.md.

Original Security remains RED; proposal/exception expiry and all owner/source/rule/target controls are unchanged. No main/PR decision, acceptance, hosted replay, native/device/archive signoff, M2, deployment, signing/TestFlight or release. Spend $0. Independent Brain review required.
'''
(checkpoint/'RESULTS.md').write_text(results,encoding='utf-8')
report=dict(schema_version=1,task_id='M1-03',iteration='SECURITY-REMEDIATION-WAVE-02',authorization_id='M103-SECURITY-REMEDIATION-WAVE02-CONDITIONAL-SOURCE-EDIT-01',status='PARTIAL_DIAGNOSTIC',review_status='SUBMITTED_INDEPENDENT_BRAIN_REVIEW_REQUIRED',observed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
    tested_implementation=dict(sha=head,tree=tree,technical_source_edits=0),evidence_milestones=[dict(sha='d53202d84b029b6ef783d2aeb24a5772b4846b9c',tree='c0f4202f837559863890d040602001d71d8574c4'),dict(sha='32d23e4d787b75fa81b1e8d414efa1e1930f0265',tree='e5612a5dfb2dd989a10b023ccc50acc532928197')],
    delivery=dict(branch='stage/m1-gate-recovery',sha=None,tree=None,observation='Final SHA/tree/CI obtained externally after push to avoid self-reference; see final task response. Do not infer delivery CI from measured-source or milestone CI.'),
    context=dict(manifest_valid=True,external_manifest_sha256='55663df49e98f5209d4c2b04d573d058042aa16e0d95ede4c17547f4edd12dff',preimage_count=27,independent_fingerprint_sha256='51bef23541f736bc2a890e25ae5ca8ac6c60104b2aef2906262f2038fee5a0d7',exact_archive_and_extracted_inputs_retained=True,authority_union=False),
    candidate=dict(status='CUSTOM_CANDIDATE_ONLY',official_semgrep_wheel_unchanged=True,old_wheels_verified=66,new_wheels_verified=13,metadata_patch_sha256='672d3873545e1129a6a4bb6e49bce50aff92a9ab7bd6b30e70995b82c78abf2b',trees=runtime,full_dependency_aware_solver=True,pip_check=True,actual_runtime_smokes=True,full_four_rule_compatibility=False,source_bootstrap_schema_integration='NOT_ATTEMPTED_INELIGIBLE',stage_technical_edit_eligible=False),
    source_checks=receipts,governance=dict(exit=124,timeout_seconds=600,started_cases=80,complete_103_suite=False),large_root_suites=dict(test6067='NOT_RUN_DIAGNOSTIC_ONLY',typecheck='NOT_RUN_DIAGNOSTIC_ONLY',lint='NOT_RUN_DIAGNOSTIC_ONLY',zero_cached_proof=False),
    inventory=dict(tracked=20576,extra=8654,changed=90,missing=0,classifier_refusals=61,original_required=7755,original_auxiliary=1451,original_targets=9206,explicit_sql=26,historical_failed_targets=189,historical_fixpoints=368,current_source_scan=False,checkpoint_growth='Individually bound by final SHA256SUMS.json; review required, no admission'),
    findings=dict(provider_run=40020077385,current_gitleaks=1126,history_gitleaks=4361,provider_npm_high=6,fresh_npm_high=7,disposable_candidate_npm_high=7,stage_vulnerabilities_removed=0,credential_tests=0,owner_disposition='NONE'),
    axes=dict(candidate_technical='PARTIAL_PROOF_CUSTOM_ONLY',original_provider_security='RED_FAILURE',independent_source_acceptance='NOT_GRANTED',source_inventory='REFUSED',current_sast_coverage='NOT_RUN_NO_EVIDENCE',hosted_database='NOT_AUTHORIZED_NOT_RUN',native_device_archive='NOT_RUN_SOURCE_ONLY',release='NOT_AUTHORIZED',source_quality_ci='SUCCESS_40020077445',source_ios_ci='SUCCESS_SOURCE_ONLY_40020077467',delivery_ci='CHECK_AFTER_PUSH_PENDING_IS_PENDING'),
    protected_source_go=False,main_promotion_authorized=False,hosted_database_go=False,m2_authorized=False,release_authorized=False,technical_owner_acceptance_authorized=False,incremental_spend_usd=0,original_proposal_notAfter='2026-10-21T00:00:00Z',accepted_roadmap_tasks=['M0-01','M0-02','M1-01','M1-02'],main='d9912f4c8b30358593569c5b9b4e84773c6f463e',pr10='DRAFT_OPEN_UNMERGED',next_repair_proposal='Exact-source inventory/classifier admission; see NEXT_EXACT_SOURCE_SCOPE.md',founder_relay='Codex is done')
(checkpoint/'completion-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
readme=f'''# M1-03 / SECURITY-REMEDIATION-WAVE-02

**PARTIAL_DIAGNOSTIC — independent Brain review required. Stage technical source edits: zero. Original Security remains RED.**

Tested implementation `{head}`, tree `{tree}`. Sole non-union authority: `M103-SECURITY-REMEDIATION-WAVE02-CONDITIONAL-SOURCE-EDIT-01`. External context manifest and all 27 independent preimages passed; exact input bytes are under [inputs/context](inputs/context/) and [inputs/uploaded](inputs/uploaded/).

The genuine CUSTOM four-line installed Semgrep METADATA bridge passes dependency-aware solver/install/pip-check, wheel/tree proof and actual old/new MCP/OTel runtime smoke. Full compatibility is not established because the original pinned OWASP bundle remains unavailable. No live source integration is made. Security70, secret12, expiry8, fresh npm ci, Expo, strict iOS privacy and worklist pass; governance times out and full root suites are not rerun in diagnostic mode.

Read [RESULTS](RESULTS.md), [BLOCKERS](BLOCKERS.md), [SEMGREP_BRIDGE_PROOF](SEMGREP_BRIDGE_PROOF.md), [SAST_INVENTORY_REVIEW](SAST_INVENTORY_REVIEW.md), [SAFE_SECRET_ADVISORY_MATRIX](SAFE_SECRET_ADVISORY_MATRIX.md), [NEXT_EXACT_SOURCE_SCOPE](NEXT_EXACT_SOURCE_SCOPE.md) and [completion-report.json](completion-report.json). [SHA256SUMS.json](SHA256SUMS.json) individually binds regular evidence Git blobs, excluding its own self-reference. Run `python -B evidence/verify_delivery.py --verify-manifest` from this folder after delivery.

New original-provider findings: 1,126 current/4,361 history Gitleaks, all unreviewed. Fresh npm audit is seven high including Zod; same-SDK candidate retains vulnerabilities. Original inventory remains 8,654 extra/90 changed plus this checkpoint growth, 61 classifier refusals; no current full SAST coverage is claimed.

PR #10 stays draft/open/unmerged; main remains d9912f4c8b30358593569c5b9b4e84773c6f463e. Final delivery SHA/tree and actual CI are observed externally after push. No Security/DB GO, acceptance, expiry renewal, hosted replay, main promotion, M2, native/device/archive approval or release. Spend $0.

STOP for independent Brain review. Founder relay: **Codex is done.**
'''
(checkpoint/'README.md').write_text(readme,encoding='utf-8')
handoff=f'''onSkin V2 | M1-03 SECURITY-REMEDIATION-WAVE-02 | PARTIAL_DIAGNOSTIC / REVIEW_REQUIRED
Sole non-union authority: M103-SECURITY-REMEDIATION-WAVE02-CONDITIONAL-SOURCE-EDIT-01
External manifest: 55663df49e98f5209d4c2b04d573d058042aa16e0d95ede4c17547f4edd12dff
Tested implementation/source unchanged: {head}
Tested source tree: {tree}
All 27 initial Git objects and working bytes independently verified. Final 26 other witness files preserved; only factual handoff changes outside the new checkpoint.
Protected technical source edits ZERO. Authentic CUSTOM installed-METADATA candidate retained under checkpoint; official wheel/core/engine unchanged. Real old/new pip solver/check and Semgrep/MCP/OTel runtime smoke pass; full four-rule compatibility blocked by missing authentic OWASP pin. No live patch/source integration.
Source tests: after fresh npm ci, Security70 PASS; secret12/expiry8 PASS; Expo/strict iOS source privacy/original worklist PASS. Governance timeout124 at600s, not103 pass. Full forced6067/typecheck/lint NOT_RUN diagnostic-only. All initial failures and expected adverse nonzero exits retained.
Inventory:20576 paths;8654 extra/90 changed/0 missing;61 classifier refusals;26 SQL targets retained. Historical189 failures/368 fixpoints remain open, not new scans. New checkpoint growth individually hash-bound and review-required.
Original source-tree provider40020077385: Gitleaks1126 current/4361 history; no owner dispositions. Provider npm6 high; fresh audit7 high including newly authenticated Zod advisory. Same-SDK disposable candidate lock delta0 and vulnerabilities remain. No raw secrets or found-credential tests.
Measured-source Quality40020077445 SUCCESS including canonical ECR-backed local verification; iOS40020077467 SUCCESS source-only; Security40020077385 FAILURE all four original source-facing jobs. Historical ECR Data limit exceeded remains true intermittent history. Later-head CI is separate; PENDING remains PENDING.
Evidence milestones d53202d84b029b6ef783d2aeb24a5772b4846b9c and32d23e4d787b75fa81b1e8d414efa1e1930f0265; normal stage pushes. Final SHA/tree/actual CI resolved externally after final push, never fabricated into a future self-hash.
Main unchanged d9912f4c8b30358593569c5b9b4e84773c6f463e; PR10 DRAFT/OPEN/UNMERGED; Brain retains sole PR/main decisions.
Checkpoint: docs/brain/checkpoints/M1-03/SECURITY-REMEDIATION-WAVE-02/
Receipts: RESULTS.md, BLOCKERS.md, SEMGREP_BRIDGE_PROOF.md, SAST_INVENTORY_REVIEW.md, SAFE_SECRET_ADVISORY_MATRIX.md, NEXT_EXACT_SOURCE_SCOPE.md, completion-report.json, SHA256SUMS.json, evidence/execution-index.json.
One next proposed repair: source inventory/classifier admission at a newly Brain-issued exact delivered SHA/tree. This document grants no authority.
Original proposal expiry2026-10-21T00:00:00Z and exceptions/owner/source-manifest/targets/rules unchanged. Accepted tasks only M0-01/M0-02/M1-01/M1-02.
protected_source_go=false; hosted_db_go=false; main_promotion=false; M2=false; native/archive/device_approval=false; release=false. Spend USD0.
Context health VALID; exact uploaded ZIP/extracted bytes retained; no authority union; designated no-hardlink checkout only; one stage writer.
STOP for independent Brain review. Founder relay: Codex is done.
'''
(root/'ONSKIN_BRAIN_HANDOFF.txt').write_bytes(handoff.encode())
print(json.dumps(dict(report_written=True,status='PARTIAL_DIAGNOSTIC',technical_source_edits=0)))
