"""Forward evidence refresh after authentic CI required existing-surface design."""
from pathlib import Path
import datetime
import hashlib
import json
import shutil
import subprocess

repo=Path(r'C:\Users\jasim\Desktop\WeddingCards\work\m102-retained-resilience')
run=Path(__file__).resolve().parent
root=repo/'docs/brain/checkpoints/M1-02/RETAINED-MAJOR-CAMPAIGN-05'
source='74c08a37a761d3bb44601c2d6b4b52a8f9e9c6b7'
tree='02f5a55250b0fbf4b924314f8c4aac7ee6f46bc5'
previous='54033f7c150b08721779ed02e51e68de02fa5544'
successes=['inline375-verified','inline390-verified','inline-cross390-verified']
diagnostics=['inline375-attempt1','inline390-final','inline390-visible','inline-cross390-final']
def git(*args): return subprocess.check_output(['git',*args],cwd=repo).decode().strip()
def sha(data): return hashlib.sha256(data).hexdigest()
def blob(data): return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def write(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(value.rstrip()+'\n',encoding='utf-8')
def jsonwrite(path,value): write(path,json.dumps(value,indent=2,ensure_ascii=False))
assert git('rev-parse','HEAD')==source and git('status','--porcelain=v1')==''
assert git('rev-parse','HEAD^{tree}')==tree
for name in successes+['final-inline-root-tests','final-inline-root-typecheck','final-inline-root-lint','final-inline-retained']:
    receipt=json.loads((run/(name+'.json')).read_bytes())
    assert receipt['head']==source and receipt['exit_code']==0 and receipt['status_before']==receipt['status_after']=='',name
assert json.loads((run/'inline-worklist-contract.json').read_bytes())['exits']==[0,1,0]
scope=json.loads((run/'source-scope.json').read_bytes())
assert scope['source_commit']==source and scope['source_path_count']==21
archive=root/'history/routed-candidate'
assert not archive.exists(), 'Refresh is one-shot; review any partial run.'
for name in ['README.md','source-scope.json','completion-report.json','evidence-manifest.json','ui-review.json']:
    archive.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(root/name,archive/name)
write(archive/'CONTEXT.md',f'''These are historical artifacts from {previous}, not the current completion report.
The historical manifest authenticates that committed checkpoint at that Git revision only.
CI there failed the unchanged launch inventory for an added route and canonical DB image acquisition.
The current implementation uses an inline You section, without changing the inventory, producer, workflow or database.
All original raw receipts remain; previous successful PNGs are hash-indexed when omitted from the current bounded selection.
''')
for item in run.glob('*.json'):
    value=json.loads(item.read_bytes())
    if isinstance(value,dict) and 'command' in value and 'exit_code' in value:
        shutil.copyfile(item,root/'receipts'/item.name)
for item in run.glob('*.log'): shutil.copyfile(item,root/'receipts'/item.name)
for name in ['source-scope.json','inline-worklist-contract.json','first-push-ci-0.json','first-push-ci-1.json','first-push-ci-2.json','measured-inline-ci-observation.json','measured-inline-ci-later.json','measured-secret-changed-path-audit.json']:
    shutil.copyfile(run/name,root/name)
for item in run.glob('*.py'): shutil.copyfile(item,root/'tools'/item.name)
shutil.copyfile(run/'verify_checkpoint.py',root/'verify_checkpoint.py')
for name in ['e2e-wrapper.mjs','e2e-fragment.txt','routed-e2e-wrapper.mjs','routed-e2e-fragment.txt','inline-v1-e2e-wrapper.mjs','inline-v1-e2e-fragment.txt']:
    shutil.copyfile(run/name,root/'e2e'/name)

omitted=json.loads((root/'omitted-duplicate-images.json').read_bytes())
for name in ['web375-measured-final','web390-attempt1','cross390-attempt2']:
    for item in (root/'e2e'/name).glob('*.png'):
        assert item.resolve().is_relative_to((root/'e2e').resolve()) and not item.is_symlink()
        raw=item.read_bytes()
        omitted.append(dict(run=name,path=item.name,bytes=len(raw),sha256=sha(raw),reason='Superseded routed-candidate image; original Git checkpoint and raw snapshots/actions/bindings retained.'))
        item.unlink()
for name in successes+diagnostics:
    for item in sorted((run/name).iterdir()):
        if not item.is_file(): continue
        if item.suffix=='.png' and name not in successes and item.name!='FAILURE.png':
            raw=item.read_bytes()
            omitted.append(dict(run=name,path=item.name,bytes=len(raw),sha256=sha(raw),reason='Earlier inline/diagnostic duplicate; raw snapshots/actions/logs retained.'))
            continue
        target=root/'e2e'/name/item.name
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(item,target)
selected=sorted(p.relative_to(root).as_posix() for p in (root/'e2e').rglob('*.png'))
ui=[]
for name in successes:
    for item in sorted((root/'e2e'/name).glob('R05*.json')):
        value=json.loads(item.read_bytes())
        if 'overflowX' in value:
            ui.append(dict(run=name,path=item.relative_to(root).as_posix(),viewport=value['viewport'],overflowX=value['overflowX'],issueCount=value['issueCount']))
assert len(ui)==26 and all(v['overflowX']<=1 and v['issueCount']==0 for v in ui)
assert 20<=len(selected)<=40,len(selected)
for label in ['Check-Photo-cleanup-again','Check-Shelf-again']:
    geometry=json.loads((root/'e2e/inline390-verified'/('R05-text200-action-'+label+'.json')).read_bytes())
    assert geometry['hit'] and 0<geometry['y']<geometry['viewport']['height']
jsonwrite(root/'omitted-duplicate-images.json',omitted)
jsonwrite(root/'ui-review.json',dict(selected_screenshots=selected,changed_flow_states=ui,overflow_failures=0,control_issues=0))

replacements={
    'd76cbd2742920895522e3e9018d554319c777741':source,
    '44bd5a747df37f46e8d4b49475648c00f7857905':tree,
    '6,157':'6,158','6,133':'6,134','2,312':'2,313',
    '6,157/6,157':'6,158/6,158','2,312/2,312':'2,313/2,313',
    '637 renderer':'638 renderer','637 renderer-deprecation':'638 renderer-deprecation',
    'Sixteen new-feature cases':'Seventeen new-feature cases',
    '16 new-feature':'17 new-feature',
    'all sixteen final feature cases':'all seventeen final feature cases',
    '32 screenshots':str(len(selected))+' screenshots',
    '**32 screenshots**':'**'+str(len(selected))+' screenshots**',
    'three genuine failed attempts':'five genuine failed attempts',
    '23 changed':'21 changed','23 source':'21 source',
    '51 protected':'53 protected','48 existing':'50 existing',
    'all ten intermediate':'all thirteen intermediate',
    'ten forward commits':'twelve forward source/doc/worklist commits and one historical evidence commit',
    'You now links to **Local recovery**':'You now expands **Local recovery**',
}
for name in ['README.md','DESIGN_DECISIONS.md','RESULTS.md','BLOCKERS.md']:
    value=(root/name).read_text(encoding='utf-8')
    for before,after in replacements.items(): value=value.replace(before,after)
    write(root/name,value)
write(root/'SOURCE_SCOPE.md',f'''# Exact source scope

Measured implementation `{source}`, tree `{tree}`, descends from the pinned anchor through 12 source/doc/worklist commits and historical evidence commit `{previous}`. The final evidence refresh follows it. All 21 cumulative source/doc/worklist paths have pre/post Git blobs and SHA-256 in source-scope.json. All 13 intermediate commits through this measured source were checked against the literal grant, including the route added then removed during forward refinement.

There are 53 protected identity/absence witnesses: 50 existing Git objects and three absence witnesses. The unchanged launch producer and feature inventory are explicit additional witnesses. Every old checkpoint, original Security/DB/workflow/producer, auth/consent/storage/offline and selected encryption/native/dependency boundary remains unchanged. Campaign05 explicitly authorizes the Shelf mutations path that was a narrow preservation witness in M1X-04; no false unchanged claim is made for that path.

'''+ '\n'.join('- `'+e['path']+'`' for e in scope['entries']))

with (root/'DESIGN_DECISIONS.md').open('a',encoding='utf-8') as stream:
    stream.write(f'''
## Final existing-surface choice after authentic CI

The first pushed candidate `{previous}` added a route and failed the original execution-baseline inventory check. The mechanical exception covers only the two Phase4 worklists, so the feature inventory was left byte-identical. The same device-local affordance now expands inside You → Help. Its explicit Close action collapses the section; the row exposes expanded accessibility state. Feature-owned navigation and all read/owner/consent/day guards are retained. No route or new backend/store was needed. The unchanged validator reproduces exit 1 before, exit 0 after. Source-only iOS must still be observed at each actual pushed head.
''')
with (root/'RESULTS.md').open('a',encoding='utf-8') as stream:
    stream.write('''
| Additional final proof | Before | After |
| --- | --- | --- |
| New route required an unauthorized inventory refresh | Original execution-baseline validator exit 1 at first pushed candidate | Existing You section; original inventory and producer unchanged; validator exit 0 |
| Recovery close/accessibility in an existing surface | Routed-only candidate | Mounted Close case plus actual keyboard Close/reopen; 17 feature tests total |

The first inline cross-owner attempt failed because its driver searched for a button on a correctly denied age gate; the actual source boundary stayed closed. A stricter text-stress attempt incorrectly required activeElement to persist after the normal busy/disabled interval; visible focus before Enter and post-settlement hit testing are measured separately in the corrected run. These are retained test-setup failures, not invented production defects. An early inline test syntax error was fixed before declaring its suite green.

After authentic CI required the existing-surface design, a third genuine two-output worklist generation followed that final source/flow change. Its final 0/1/0 proof uses the clean complete authorized checkout. Earlier generation and independent-checkout receipts remain historical, never substituted for this final-source check.
''')

write(root/'E2E_SUMMARY.md',f'''# Actual synthetic Expo web evidence

Final successes: `{successes[0]}` (375×667), `{successes[1]}` (390×844, 430×932, 360×640 with direct text/line-height ×2), `{successes[2]}` (390×844, A→B→A). All execute measured implementation `{source}` cleanly with actual headless Chrome and real Expo web. The original repository driver is unchanged. Exact original/executed driver hashes and executed scripts, action traces, UI snapshots, important console/server logs and raw exits are retained. Only synthetic transport and platform I/O/permission ports are controlled.

The actual You row expands the section and exposes an explicit keyboard Close/reopen. Independent saved Today evidence stays usable while reminder KV refuses; its per-domain retry works offline without changing durable check-offs. Notifications and Timing show read-error retry and Back, recover through actual hooks and reread on entry. An enabled reminder choice says Needs confirmation, never OS scheduling/delivery. The existing Progress paid gate remains closed. Reload requires reopening the section and rereads existing device evidence.

The final cross-owner flow holds A's actual local read while the real synthetic Auth event starts B reconciliation, observes the neutral boundary, exercises cleanup failure/duplicate retry, then admits B with B's own age/consent/quiz/Shelf. B's status and reload remain isolated. Returning to A and direct You entry remain age-closed; no local status is displayed. The finite observer and mounted adversarial tests are bounded proof, not a universal live-provider guarantee.

Twenty-six final changed-flow snapshots have zero horizontal overflow and zero visible-control issues. Two 200% text controls additionally require visible keyboard focus before Enter, then on-screen center coordinates and element hit testing after settlement. Post-dispatch activeElement persistence is not claimed. `{len(selected)}` PNGs are retained, including the five genuine failed UI attempts across both design passes. Superseded success/duplicate images are omitted only with their actual hashes/sizes; all raw state/actions/logs stay. ui-review.json and evidence-manifest.json enumerate actual files; inherited driver screenshot-request lists do not prove suppressed images exist.

NOT_RUN: native camera/encrypted filesystem/Keychain, actual OS permission/scheduling/delivery, signed iPhone, installed cold offline launch, physical Dynamic Type/VoiceOver, paid-positive, live provider/hosted/clinical/release behavior. No real user/clinical images or credentials, no new telemetry, USD 0.
''')
historical_matrix=(root/'TEST_MATRIX.md').read_text(encoding='utf-8')
historical_matrix=historical_matrix.replace('# Commands, raw exits and limits', '# Commands, raw exits and limits\n\nThe first table and its following measurements describe the earlier routed-candidate pass, with exact original counts and SHAs retained. The final existing-surface measurements are below.')
write(root/'TEST_MATRIX.md',historical_matrix)
with (root/'TEST_MATRIX.md').open('a',encoding='utf-8') as stream:
    stream.write('''
## Final measured existing-surface validation

| Command / final receipt | Raw exit | Result |
| --- | --- | --- |
| `npm test -- --force` / final-inline-root-tests | 0 | Mobile 6,134 + console 24 = 6,158; 483 files, 2 tasks, 0 cached, no skips reported |
| `npm run typecheck -- --force` / final-inline-root-typecheck | 0 | 3 tasks, 0 cached |
| `npm run lint -- --force` / final-inline-root-lint | 0 | 3 tasks, 0 cached, 0 lint warnings |
| All eight retained feature families + Recovery/settings / final-inline-retained | 0 | 2,313 tests, 193 files |
| Original execution-baseline validator | 1 / 0 | Routed candidate refused; existing-surface implementation accepted, inventory unchanged |
| Original source-worklist strict check with one disposable input tamper / inline-worklist-contract | 0 / 1 / 0 | Clean complete final checkout; both outputs refuse; exact restoration; unchanged producer/output hashes |

The final forced root run retains 638 renderer-deprecation lines and 33 act-warning lines. Earlier clean source measurement and independent complete-checkout producer proof are historical receipts, not substituted for these final measurements. No native/provider/release result follows from any local pass.
''')
with (root/'BLOCKERS.md').open('a',encoding='utf-8') as stream:
    stream.write(f'''
## Authentic first-push CI and safe forward repair

At `{previous}`, Quality 40067071311 failed only its canonical DB job 120792463643: canonical image acquisition reported ECR “Data limit exceeded” / H01_SQL_PROBE_FAILED. Repository gates, both PostgreSQL deletion rehearsals and both Expo exports passed. The canonical image, workflow, SQL and policy remain unchanged; alternate-image rehearsal success does not replace this failed canonical job.

iOS source-contract run 40067071330 failed its execution-baseline inventory after the added route. This in-scope design cause was repaired by placing recovery in the existing You surface. The original validator now passes without changing launch inventory. Security 40067071304 failed protected evidence/acceptance gates; live Supabase was skipped. Raw API observations and iOS/DB failure logs are retained. These observations belong only to that head. Measured-source and final evidence-tail CI are read independently after their pushes; pending remains pending and is reported in PR11/final relay.

At the actual pushed measured source, iOS run 40068215647 passes SOURCE-ONLY. Quality 40068215649 repository gates and both PG rehearsals pass; canonical DB 120795820768 fails ECR Data limit exceeded; exports remain time-bound in measured-inline-ci-later.json. Security 40068215691 fails protected acceptance, with expired/advisory-drift refusals and current-source findings unreviewed. Its diagnostic artifact SHA-256 is retained in the metadata-only changed-path audit: 1,133 current records, zero in Campaign05 changed paths. No finding is classified or waived here. The default PR checkout is synthetic merge 35ecd50ad3fc27538c984270dbe3f55b70ff43ed; the API confirms its tree exactly equals the measured source tree. This is CI transport/source identity evidence, not source acceptance, G97 closure or native proof.
''')

report=json.loads((archive/'completion-report.json').read_bytes())
report.update(measured_source=source,measured_tree=tree,source_paths=21,source_commits=12,intermediate_commits=13,protected_path_witnesses=53,existing_protected_objects=50,historical_candidate=previous)
report['implementation']['feature']='Expandable device-local recovery section in existing You → Help, with accessible Close; no new route, persistence, provider, permission prompt, scheduling or automatic fix'
report['tests']['new_feature']['passed']=17
report['tests']['retained_recovery_settings']['passed']=2313
report['tests']['root'].update(mobile=6134,total=6158,renderer_deprecation_lines=638)
report['tests']['worklist'].update(complete_final_checkout=True,complete_independent_checkout=False,historical_independent_checkout_proof=True,final_checkout_note='Clean complete authorized checkout at final measured source')
report['tests']['execution_baseline']=dict(before_exit=1,after_exit=0,inventory_unchanged=True,producer_unchanged=True)
report['e2e'].update(passed=successes,screenshots=len(selected),text200_actual_action_hit_tests=2)
report['github_ci']['first_pushed_candidate']=dict(head=previous,quality='FAIL: canonical DB image acquisition; repository/rehearsals/exports PASS',ios_source_only='FAIL: route inventory, repaired in forward client design',security='FAIL protected acceptance',logs='first-push-ci-*.json and receipts/first-push-*-failure.log')
report['github_ci']['measured_source_observation']='See measured-inline-ci-observation.json: actual pushed measured-source API state; source-only iOS PASS, canonical DB image acquisition FAIL, remaining jobs time-bound as recorded.'
report['github_ci']['final_head']='Read authentic actual evidence-tail head after push; report time-bound state in PR11/final relay. No prior success borrowed.'
report['receipts']=[]
for receipt in sorted((root/'receipts').glob('*.json')):
    value=json.loads(receipt.read_bytes())
    if 'exit_code' in value:
        report['receipts'].append(dict(path=receipt.relative_to(root).as_posix(),exit=value['exit_code'],head=value['head'],log_sha256=value['log_sha256']))
jsonwrite(root/'completion-report.json',report)

with (repo/'ONSKIN_BRAIN_HANDOFF.txt').open('a',encoding='utf-8') as stream:
    stream.write(f'''

M1X-05 FINAL EXISTING-SURFACE REVISION — {datetime.datetime.now(datetime.timezone.utc).isoformat()}
This entry supersedes the routed-candidate measurement above; the original candidate and its raw evidence remain in Git {previous} and current checkpoint history.
SUBMITTED_REVIEW_REQUIRED. Authorization M1X-RETAINED-MAJOR-CAMPAIGN05-CLIENT-CANDIDATE-01. Brain alone accepts.
Final measured implementation {source}, tree {tree};12 source/doc/worklist commits plus one historical evidence tail;21 cumulative source/doc/worklist paths;53 unchanged protected identity/absence witnesses.
Authentic first-push CI rejected the added route's inventory. Recovery now expands inside existing You with accessible Close; original launch inventory/producer unchanged, validator 1→0. No protected regeneration or workflow/DB change.
Final clean forced root6158/6158 (mobile6134+console24;483 files),retained/recovery/settings2313/2313 (193 files),typecheck/lint0;zero cached;no skips reported;638 renderer-deprecation/33 act-warning lines;lint0 warnings.17 feature cases. Original production21 failing vectors+1 safeguard remains independent baseline proof.
Final unchanged worklist producer0/1/0 at the measured source in a clean complete checkout; both outputs refuse the disposable tamper and pass exact restore. Historical independent full-checkout proof remains.
Actual headless Chrome/Expo web at375x667,390x844,430x932,360x640 direct text x2;actual keyboard/Close/reopen/offline/reload;A→B→A delayed local read/cleanup retry/B own admission/closed A.26 final snapshots0 overflow/control issues;2 text-stress target hit checks;{len(selected)} bounded PNGs including5 failed attempts. Synthetic ports only;native/provider/paid-positive/clinical/release NOT_RUN.USD0.
First-push Quality failed canonical DB ECR Data limit exceeded, with repository/rehearsals/exports passed;iOS inventory cause now repaired;Security failed protected acceptance. Final actual pushed-head CI is read separately in PR11/final relay, not predicted. G97 FAIL/NO_GO;M1-03 BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED;M2-01/dependents NOT_AUTHORIZED.
Checkpoint docs/brain/checkpoints/M1-02/RETAINED-MAJOR-CAMPAIGN-05 contains current source/evidence hashes,history,raw receipts/UI,limitations,machine report and portable verifier. The following final evidence-only commit SHA/tree is determined after commit/push; no future self-hash. Main/PR10 remain read-only;PR11 stays DRAFT OPEN UNMERGED auto-merge OFF.
''')

files=[]
for item in sorted(root.rglob('*')):
    if not item.is_file() or item==root/'evidence-manifest.json': continue
    raw=item.read_bytes()
    files.append(dict(path=item.relative_to(root).as_posix(),bytes=len(raw),sha256=sha(raw),git_blob=blob(raw)))
raw=(repo/'ONSKIN_BRAIN_HANDOFF.txt').read_bytes()
jsonwrite(root/'evidence-manifest.json',dict(schema_version=1,files=files,handoff=dict(path='ONSKIN_BRAIN_HANDOFF.txt',bytes=len(raw),sha256=sha(raw),git_blob=blob(raw)),self_hash_policy='This manifest excludes itself. Actual committed evidence-tail SHA/tree are observed after commit/push; no future self-hash.'))
print(json.dumps(dict(source=source,tree=tree,evidence_files=len(files),screenshots=len(selected),states=len(ui),manifest_sha256=sha((root/'evidence-manifest.json').read_bytes())),indent=2))
