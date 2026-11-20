import copy, json, re
from pathlib import Path
from run import OUT, REPO, identity, now, sha, write

source=identity();assert not source['status']
labels=[f'final-acceptance3-connected-r{i}' for i in range(1,4)]+['final-runtime3-r1','final3-diary','final3-intake',*['final3-daily-'+w+'-adapter3' for w in ['375','390','430']],
 'final-root-tests-drain32','final-typecheck-drain32','final-lint-drain32','final-consumer-build-drain32','final-professional-build-drain32','final-privacy-drain32','final-consumer-authority-drain32','final-manual-recovery-drain32','final-connected-recovery-drain32','final-driver-regressions-drain32','final3-first-document-r1','final-static-cache32']
receipts=[json.loads((OUT/(label+'.json')).read_text()) for label in labels]
assert all(row['exit']==0 and row['before']==source and row['after']==source for row in receipts)
write('FINAL_RECEIPTS.json',receipts)
browser=[]
for i in range(1,4):
 value=json.loads((OUT/f'final-acceptance3-connected-r{i}-browser/summary.json').read_text());assert value['pass'] and len(value['viewports'])==3
 for row in value['viewports']:
  assert row['durable32']['actualWithdrawalAndRestart']
  browser.append(dict(repeat=i,width=row['width'],height=row['height'],unassisted=True,durable=row['durable32']))
runtime=json.loads((OUT/'final-runtime3-r1-browser/SUMMARY.json').read_text());assert len(runtime['ordinary'])==9 and not runtime['failures']
first_document=json.loads((OUT/'final3-first-document-r1-browser/SUMMARY.json').read_text());assert len(first_document['ordinary'])==9 and not first_document['failures']
write('RUNTIME_DURABLE_RESULTS.json',dict(source=source,ordinary=runtime['ordinary'],firstAppDocument=first_document,induced=runtime['induced'],interventions=runtime['interventions'],connected=browser,
 statuses=dict(unassisted_pass=9,recovery_with_explicit_user_action=len(runtime['interventions'])+len(first_document['interventions']),externally_assisted_E32=0,failed_final_series=0,retained_earlier_failures=True)))
history=dict(firstDeclaredSeries=dict(declaration='FINAL_REPEAT_DECLARATION.json',source='89d075e4ae5a65c5dff298f97572c105b4406a5f',
 cells=[dict(repeat=r,width=w,height=h,status='PASS' if r==1 and w==375 else 'FAILED' if r==1 and w==390 else 'NOT_RUN') for r in range(1,4) for w,h in [(375,667),(390,844),(430,932)]],
 stopReason='Canonical Shelf/profile loss; original recovery/ledger preserved; explicit apply retry correctly refused. Independent retained-profile diagnostic confirmed absence.',queuedRuntime='NOT_RUN',queuedLaterRegressions='NOT_RUN at that source'),
 preDrainSeries=dict(declaration='FINAL_REPEAT_DECLARATION2.json',source='7236d3f4dd90b7d2384adf45857f853f3b85010f',connectedPasses=9,runtimePasses=9,diary='PASS',intake='PASS',laterStages='NOT_RUN; stopped for reproduced raw bulk-drain defect'),replacementSeries=dict(declaration='FINAL_REPEAT_DECLARATION3.json',source=source,connectedPasses=9,runtimePasses=9),
 firstDocumentProbe=dict(declaration='FIRST_DOCUMENT_REPEAT_DECLARATION3.json',source=source,passes=9),
 historicalEngineering31=dict(classification='EXTERNALLY_ASSISTED_PASS',visiblePrivateAccessRetryActions=29,unassistedClaim=False))
write('DECLARED_SERIES_HISTORY.json',history)
lines=['# Engineering32 finite runtime matrices','','All38/all18 UNACCEPTED. Ordinary startup/handoff, induced contention, command recovery and historical assisted evidence are separate.','','## First app execution (inert status page before app navigation)','','| Size | Repeat | Startup | Reload | Direct | History return | Automatic/manual Retry |','|---|---|---|---|---|---|---|']
for row in first_document['ordinary']:
 lines.append(f"| {row['width']}×{row['height']} | {row['repeat']} | {row['startup']['status']} | {row['reload']['status']} | {row['direct']['status']} | {row['returned']['status']} | 0 / 0 |")
lines+=['','Each checked document made exactly one exclusive request. The complete traces retain document/request IDs and callback timing. No query snapshot granted admission.','','## Committed connected journey','','| Size | Repeat | Unassisted journey | Apply / clear / retraction process restarts | Actual withdrawal/restart |','|---|---|---|---|---|']
for row in browser:lines.append(f"| {row['width']}×{row['height']} | {row['repeat']} | PASS | PASS; exact IDs/times and source hashes | PASS; erased and closed |")
lines+=['','Committed runtime-only handoff matrix: nine additional fresh profiles, three at each size, with all four navigation outcomes admitted using one request. The older helper initially creates an app target before tracing; first-app qualification therefore comes from the separate status-page probe above.','','## Induced states','','| Probe | Case | Result | Visible Retry actions |','|---|---|---|---|']
for name,result in [('committed runtime',runtime),('first document',first_document)]:
 for row in result['induced']:lines.append(f"| {name} | {row['case']} | PASS | {row.get('manualRetries',0)} |")
lines+=['','The two visible Retry actions recover intentionally induced sustained contention after the real holder closes. Ordinary journeys use none. These are explicit user recovery, not a supervisor.','','## Retained failed declared series','','| Repeat | 375×667 | 390×844 | 430×932 |','|---|---|---|---|','| 1 | PASS | FAILED: missing canonical source; safe refusal | NOT_RUN |','| 2 | NOT_RUN | NOT_RUN | NOT_RUN |','| 3 | NOT_RUN | NOT_RUN | NOT_RUN |','','Later queued work at that earlier source was NOT_RUN. Its logs, original evidence hashes, failure screenshot and independent source diagnostic remain retained. Every earlier qualification failure is listed in ALL_EXECUTION_RECEIPTS.json and ROOT_CAUSE.md. Engineering31 remains externally assisted (29 visible Retry actions), with no reclassification.']
(OUT/'RUNTIME_MATRIX.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
static_cache=json.loads((OUT/'final-static-cache32-browser/SUMMARY.json').read_text());assert static_cache['pass'] and static_cache['competingAcquired'] is False
write('STATIC_CACHE_RESULT.json',static_cache)
prior=json.loads((OUT.parent/'ENGINEERING31_EVIDENCE_20261119/ALL38_ALL18_FINAL3.json').read_text())
assessment=copy.deepcopy(prior);assessment.update(at=now(),source=source,release='NO_GO',frozenRecordsModified=False)
updates={
 'F02':('Local browser admission and durable recovery advanced','Bounded exclusive admission and owner/consent/source-bound recovery work locally. Real identity/hosted lifecycle, native storage and external qualification remain absent.'),
 'F06':('Local original-command recovery advanced','Apply/clear retain encrypted original identities/facts before dispatch; strict browser predecessor/evidence commits survive tested forced restart. Professional intended-plan ingress and native qualification remain unavailable.'),
 'F07':('Local recorded-use correction recovery advanced','Exact original retraction target/stream survives restart; explicit review/retry and retained acknowledgement preserve the factual original use. No use is inferred from apply; native/hosted qualification remains absent.'),
 'V2-C05':('Local durable routine decision continuity advanced','Exact original command/time/predecessor/facts survive tested browser restart. Fresh approved source proof is reacquired for explicit apply retry. Acknowledged evidence is inspect-only; no professional source bridge is invented.'),
 'V2-C11':('Local bounded handoff and recovery accessibility advanced','Unassisted repeat matrix, contained scrollable owner recovery, post-inspection focus, cancellation and browser large-text checks are locally exercised. Whole-product/native accessibility remains unqualified.')}
for row in assessment['requirements']:
 assert row['acceptance']=='UNACCEPTED'
 if row['id'] in updates:row['observationalLocalStatus'],row['remaining']=updates[row['id']]
assert len(assessment['requirements'])==38 and len(assessment['gates'])==18 and all(g['acceptance']=='UNACCEPTED' for g in assessment['gates'])
write('ALL38_ALL18.json',assessment)
lines=['# Engineering32 observational all38/all18 assessment','','All 38 REQUIRED requirements and all 18 independent gates remain **UNACCEPTED**. Release **NO_GO**. Frozen records are unchanged.','','| Requirement | Local observation | Remaining qualification |','|---|---|---|']
lines += [f"| {r['id']} — {r['name']} | {r['observationalLocalStatus']} | {r['remaining']} |" for r in assessment['requirements']]
lines+=['','| Gate | Frozen status | Acceptance |','|---|---|---|']+[f"| {g['id']} | {g['frozenStatus']} | UNACCEPTED |" for g in assessment['gates']]
(OUT/'ALL38_ALL18.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
proof=json.loads((OUT/'PATCH_VERIFICATION_FINAL2.json').read_text());ancestry=json.loads((OUT/'ANCESTRY_VERIFICATION_FINAL2.json').read_text())
all_receipts=[]
for p in OUT.glob('*.json'):
 v=json.loads(p.read_text())
 if isinstance(v,dict) and 'logSha256' in v:all_receipts.append(v)
failures=[v for v in all_receipts if v['exit']!=0]
text=re.sub(r'\x1b\[[0-9;]*m','',(OUT/'final-root-tests-drain32.log').read_text(encoding='utf-8'))
counts=[int(x.replace(',','')) for x in re.findall(r'Tests\s+([\d,]+)\s+passed',text)]
total=sum(counts);assert total>=8732
start=json.loads((OUT/'INITIAL_PREFLIGHT.json').read_text())['source']
report=f'''# Engineering32 autonomous local reliability and durable recovery

**COMPLETE_LOCAL_CANDIDATE — independent Brain acceptance pending. All38/all18 UNACCEPTED; release NO_GO.**

Authorization BRAIN-ONSKIN-AUTONOMOUS-LOCAL-RELIABILITY-32. One application-source writer, append-only local commits, zero new paid operations. The existing worktree/application branch, draft PR48, main and earlier evidence remain preserved. No Engineering33 work is authorized by this return.

| Identity | Starting source | Final clean source |
|---|---|---|
| HEAD | {start['head']} | {source['head']} |
| Tree | {start['tree']} | {source['tree']} |
| Branch | stage/m1-native-runtime47 | stage/m1-native-runtime47 |

The authorized starting source/clean index/branch/PR48 ancestry matched independently. Process/thread/index observations found no competing writer; this is observational, not an OS-enforced editor lock. All validation enforced at least 10 GiB headroom and used fresh external outputs. No protected data/source/evidence was removed.

## Completed local journeys

1. Browser startup/reload/direct entry/return uses one bounded cancellable exclusive request. Actual current callbacks alone admit private/auth/cleanup access. Ordinary startup requires no supervisor or operator Retry. A real competing runtime remains closed and recovers with explicit Retry only after ownership ends. Unsupported/rejected coordination stays closed; no query-based admission, lock stealing, early blur/unmount release or hidden retry loop exists.
2. Owner actual-routine apply/clear/retraction prepares and verifies encrypted original ID/time/predecessor/source facts or exact original target/stream before dispatch. The browser ledger and evidence use strict ciphertext transactions under existing cryptography/key custody. Navigation and forced browser process restart retain original decisions. Explicit review distinguishes exact current/historical, conflicting, unreadable and not-found outcomes; not-found is never proof of failure. Inspection changes no ledger ciphertext, recovery ciphertext or keys.
3. Explicit original-identity retry reacquires current access; apply captures a fresh approved WeakMap-backed source proof and compares every original fact/reference. Stored JSON/hash/projection never becomes source authority. Changed source/predecessor/target refuses. Acknowledgement is a separate guarded operation that retains original evidence for inspect-only review. It cannot erase the only command copy. Apply records no use; retraction preserves the original factual event.
4. Existing owner withdrawal UI erases both durable health-purpose ciphertext rows; original consent/lifecycle receipts also use strict durability, successor raw-purpose audit rechecks completed erasure, and tested process restart remains closed with no original-command resurrection. Purpose/full clearing and strict owner rights export include the new evidence. Original account/health/navigation callbacks retire; direct deletion races are covered in the common encrypted-store/controller tests.

## Runtime and restart results

The final finite ordinary committed-driver series has **9 unassisted connected passes**: three fresh sessions at each of 375×667, 390×844 and 430×932 (a new profile for every viewport cell). Each includes normal startup/reload/direct entry, actual encrypted routines/use/brief/Diary refusal, original-command process restart, explicit same-ID retry, read-only inspection and actual withdrawal/restart. No external retry helper or ordinary operator Retry was used. A separate final runtime-only series has 9 fresh-profile cells with startup/reload/direct/history return, each requiring exactly one admission request per document. Intentional contention/refusal and raw storage-port fixtures remain separate. The committed final driver now forces browser-process restart after preparation for apply and after unknown committed results for clear and retraction, comparing the original canonical source ciphertext hashes at all three boundaries. These are actual owned-process terminations, not document reloads.

Engineering31's original assisted run remains assisted: its supervisor performed 29 visible Retry actions. This campaign does not relabel it or claim every historical failure had one diagnosis. See ROOT_CAUSE.md, all retained traces/receipts and the [unchanged Engineering31 immutable index](https://github.com/TasfiqJ/onSkin/blob/ef15a0d9a435016c9f8e389ed4bc10237ae153f4/evidence/engineering31-review-2026-11-19/FINAL_INDEX.md).

## Validation and retained failures

At this exact clean source, complete uncached root tests passed **{total:,} tests** across all three workspaces. Root typecheck/configured lint, Expo consumer web export and professional Vite build passed. Focused privacy/storage/key/owner/consent/source/recovery, Engineering30 intake/use and Engineering31 routine/brief/Diary regressions passed. Retained browser Diary/intake and daily-loop checks passed at all three sizes. Resource settings: serialized Turbo test tasks, at most four Vitest workers; no skipped cases, weakened substantive assertions or timeout increases.

{len(failures)} nonzero execution receipts are retained, along with earlier successful experiments. Meaningful RED/GREEN includes sticky admission, missing durable original evidence, lost localStorage preparation across force termination, focus loss after disabling an async inspection button, lost predecessor-ledger bytes across force termination, and rolled-back withdrawal authority across force termination. The latter exposed a privacy dependency and required durable original lifecycle/consent receipts plus a successor raw-purpose erasure audit. A completed 375px repair then exposed the old driver reset at the next viewport; every final viewport now uses a fresh profile while retaining it for the tested restart. The initial baseline experiment passed; its runner identity assertion detected a new test-only file added during that experiment, so it is not a clean-source validation receipt. The first unit command used the wrong Vitest root and found no tests; the corrected command reproduced the real failure. Test fixture import/platform-mock and timestamp-field assertions were corrected without changing production privacy requirements. A rendered-JSON heading test was corrected to assert the semantic dialog because JSX splits its text children. The first declared acceptance series stopped at390px when canonical Shelf/profile localStorage rows were lost while recovery/ledger ciphertext survived. An independent same-profile diagnostic confirmed both missing rows and PLAN_SOURCE44_UNAVAILABLE. The retry correctly refused; no saved facts were promoted to authority. Eight fixed original encrypted rows now include Shelf/profile/choices/order. The complete replacement finite series is separately declared, and the earlier series' remaining cells are NOT_RUN, not omitted passes. The first daily-loop regression also retained a 375px failure: its old refusal fixture intercepted localStorage while the ledger correctly wrote to the new adapter. The separately declared derived driver retargets this fault/readback to the actual adapter. Two later375px runs reached paid UI as completion settled during duplicate touches; their failed date assertions are retained. The final derived probe binds both actual touches to the original checkbox and holds the real ledger write until both arrive, proving the intended before-settlement duplicate boundary without inventing an event. It preserves every recovery, offline, duplicate, phase, paid-boundary assertion and original timeout. This does not claim the earlier unheld touch timing is fully diagnosed or fixed in production. The first withdrawal driver used a shortened accessible name; the complete existing Row name is now used. All earlier failures remain readable by receipt and screened trace, with raw local artifact hashes.

The previously completed nine-cell source7236d3f series is retained as pre-repair evidence. A later exact-source probe and two module tests reproduced premature rejection of bulk raw reads/erases while sibling I/O remained live. The repair drains all siblings and waits terminal transaction events before retiring fences. Its complete replacement finite series and full checks bind this final source; no prior pass was substituted for a final-source receipt.

## Limits and unchanged authority

This is local Edge/Expo real UI/storage evidence with synthetic owners, bridge faults and native ports. Physical iPhone/native power-loss/VoiceOver/Dynamic Type, production identity/original-owner ingress, professional licence/roster/grants/intended-plan custody, provider, backend, billing and scientific qualification remain absent or unauthorized. Strict browser transaction support is required; refused legacy prototype/future/corrupt evidence is never overwritten. Local origin eviction, device/key loss and unsupported storage remain truthful refusal/data-loss limits, not restoration promises. Acknowledged and unresolved evidence both count toward the 100-record/512,000-byte bound until explicit purpose/full cleanup; capacity stops new decisions without eviction.

Frozen all38/all18 bytes remain unchanged and formally UNACCEPTED. J01 Visible Pores only; positive scientific admission closed. M1-03 unaccepted, M2-01 unauthorized. Protected Security/G97/DB/candidate29/SDK/Doctor/native findings remain unwaived. Reserved native attempts79–86 remain unused.

## Source and delivery

PR48 baseline d292743c99c1fb98f5714789f4fd60fb1e7d5a5d is preserved. PARTS_INDEX.json lists ordered exact UTF-8 source patches/raw ancestry parts; verify_bundle.py reconstructs bytes without ZIP transfer. PATCH_VERIFICATION.json records actual forward/reverse exact-tree checks with isolated indexes/object storage and unchanged active source index. COMMIT_ANCESTRY_WITNESS.json contains {ancestry['objects']} raw Git commit objects/{ancestry['edges']} parent links; verify_ancestry.py verifies object/parent/tree identities offline, not authorship or acceptance.

No application-source push/new application PR, hosted Actions/CI dispatch, paid runner/service/LFS/Codespaces, macOS/native attempt, account/permission/provider/backend change, purchase, merge, deployment or release was performed. Only screened evidence is published on a separate workflow-free branch after repository-visible hooks/rules/workflow/ref checks. Public byte/hash/tree/ref/zero-Actions readback is recorded separately; this report alone does not assert a later publication outcome.

Recommended next decision: independent Brain review of this exact candidate, especially eight-row browser custody/migration and successor withdrawal audit, bounded retained acknowledgements and crash/deletion evidence. Do not begin Engineering33 or promote/release this source before that review and separate authority.
'''
(OUT/'REPORT.md').write_text(report,encoding='utf-8')
(OUT/'NEXT_SESSION.md').write_text(f'''# Independent review before further engineering

Final clean HEAD {source['head']}, tree {source['tree']}, branch stage/m1-native-runtime47, existing c16-candidate Windows worktree. Starting Engineering31 {start['head']} remains an ancestor. Never reset/pull/rebase/amend/replace with remote PR48 {proof['patches'][0]['base']}. No source was pushed. Evidence publication is separate.

Read README, ROOT_CAUSE, SECURITY_PRIVACY_LIFECYCLE, CRASH_MATRIX, all38/all18, final receipts and every retained failure. Application source is reconstructable through ordered exact patch parts and raw ancestry verifier. Final raw browser source uses eight strict encrypted rows (routine ledger/evidence, original health lifecycle/consent and the four canonical routine source stores), plus successor withdrawal erasure auditing, with the same key custody; inspection never migrates. Acknowledgements retain original evidence until explicit purpose/full clearing. Capacity is 100 records/512,000 plaintext bytes; unresolved work is not evicted. Old localStorage prototype evidence and unsupported schema/coordination refuse. Missing outcomes are unknown, not failed; no startup replay or forged WeakMap proof.

All38/all18 remain UNACCEPTED; NO_GO. J01 only, positive science closed; M1-03 unaccepted, M2-01 unauthorized. External/native/identity/provider/professional/custody gates are unchanged. Native79–86 unused. Re-run only finite independently approved follow-up; do not start Engineering33 before independent Brain review. Maintain one source writer, preserve all source/evidence refs, screen publication and enforce 10 GiB headroom. Existing run.py strips credentials/dotenv/telemetry and binds commands/logs/source/index. Use fresh labels/output paths; never overwrite failed receipts.
''',encoding='utf-8')
with (OUT/'NEXT_SESSION.md').open('a',encoding='utf-8') as continuation:
 continuation.write('''
## Offline verification and bounded reruns

Download the payload files named by MANIFEST.json from the immutable payload commit linked in FINAL_INDEX.md, preserving relative paths. Do not substitute branch-head URLs. From a fresh evidence directory, run:

```text
python -B verify_bundle.py <downloaded-payload-directory> <fresh-reassembled-directory>
python -B verify_ancestry.py <reassembled-or-direct-COMMIT_ANCESTRY_WITNESS.json>
```

verify_bundle.py checks every manifest length/SHA256 and reconstructs ordered exact UTF-8 parts. PATCH_VERIFICATION.json gives both patch lengths, SHA256 and baseline/target trees. source_proof.py shows forward/reverse application with separate indexes and isolated writable object storage plus read-only baseline alternates; never apply a proof patch to the active application index/worktree. Raw commit verification proves Git object/parent/tree identities, not authorship or acceptance. Intermediate source patches in LOCAL_COMMIT_PATCHES_FINAL.json reproduce each retained failed checkpoint.

For an independently authorized local check, keep c16-candidate and a fresh evidence directory as siblings. Copy the published tooling to that fresh directory, verify source identity first, preserve the original receipts, and choose new labels/output folders. run.py execute() binds before/after source/index, strips external credentials/dotenv/telemetry and checks at least10GiB free. final_validation.py accepts a suffix for new receipts and build outputs. The configured uncached command is `npm test -- --force --concurrency=1 -- --maxWorkers=4`; root typecheck/lint use `--force`; consumer/professional outputs stay external. Do not run the broad suite concurrently with browser bundles.

Read both finite declarations and DECLARED_SERIES_HISTORY.json before comparing results. The earlier declared series stopped on a real canonical-source failure; its unexecuted cells remain NOT_RUN. The replacement committed series and separately declared first-document probe are distinct. A second completed series at7236d3f was stopped before later checks for the reproduced bulk-I/O drain defect; FINAL_REPEAT_DECLARATION3.json qualifies its repair. first_document_runtime32.mjs begins on inert /status so the observer precedes first app execution. It is diagnostic, never a retry supervisor. Preserve every eligible failure and intervention, and do not weaken assertions or raise timeouts to obtain a pass.

No deployment, account/provider/permission change, source push, native79–86 attempt, hosted CI or Engineering33 is authorized by these reproduction instructions. Independent Brain acceptance and founder release authority remain separate.
''')
print(json.dumps(dict(source=source,rootTests=total,finalReceipts=len(receipts),retainedNonzero=len(failures),connectedPasses=len(browser),runtimeCells=len(runtime['ordinary']))))
