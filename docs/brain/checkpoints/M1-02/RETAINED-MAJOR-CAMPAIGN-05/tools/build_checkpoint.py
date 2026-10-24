from pathlib import Path
import datetime
import hashlib
import json
import re
import shutil
import subprocess

repo = Path(r'C:\Users\jasim\Desktop\WeddingCards\work\m102-retained-resilience')
run = Path(__file__).resolve().parent
root = repo/'docs/brain/checkpoints/M1-02/RETAINED-MAJOR-CAMPAIGN-05'
source = 'd76cbd2742920895522e3e9018d554319c777741'
tree = '44bd5a747df37f46e8d4b49475648c00f7857905'
auth = 'M1X-RETAINED-MAJOR-CAMPAIGN05-CLIENT-CANDIDATE-01'
def git(*args): return subprocess.check_output(['git',*args],cwd=repo).decode().strip()
def sha(data): return hashlib.sha256(data).hexdigest()
def blob(data): return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def write(path, text):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(text.rstrip()+'\n',encoding='utf-8')
assert git('rev-parse','HEAD') == source
assert git('status','--porcelain=v1') == ''
assert not root.exists(), 'Refuse an existing checkpoint'
for name in ['measured-root-tests','measured-root-typecheck','measured-root-lint','web375-measured-final','web390-attempt1','cross390-attempt2']:
    assert json.loads((run/(name+'.json')).read_bytes())['exit_code'] == 0, name
scope=json.loads((run/'source-scope.json').read_bytes())
assert scope['source_commit'] == source and scope['source_tree'] == tree
assert json.loads((run/'worklist-contract.json').read_bytes())['exits'] == [0,1,0]
root.mkdir(parents=True)

for item in run.glob('*.json'):
    value=json.loads(item.read_bytes())
    if isinstance(value,dict) and 'command' in value and 'exit_code' in value:
        target=root/'receipts'/item.name; target.parent.mkdir(exist_ok=True); shutil.copyfile(item,target)
for item in run.glob('*.log'):
    target=root/'receipts'/item.name; target.parent.mkdir(exist_ok=True); shutil.copyfile(item,target)
for name in ['source-scope.json','independent-original-overlay.json','worklist-contract.json','intake-ci-observation.json','intake-local-preflight.txt','pre-delivery-state.json']:
    shutil.copyfile(run/name,root/name)
for name in ['run_check.py','audit_scope.py','prepare_worktree.py','worklist_probe.py','build_checkpoint.py']:
    (root/'tools').mkdir(exist_ok=True); shutil.copyfile(run/name,root/'tools'/name)
shutil.copyfile(run/'verify_checkpoint.py',root/'verify_checkpoint.py')
(root/'e2e').mkdir(); shutil.copyfile(run/'e2e-wrapper.mjs',root/'e2e/e2e-wrapper.mjs'); shutil.copyfile(run/'e2e-fragment.txt',root/'e2e/e2e-fragment.txt')

successes=['web375-measured-final','web390-attempt1','cross390-attempt2']
diagnostics=['web375-attempt2','web375-attempt3','web375-attempt4','cross390-attempt1']
omitted=[]; ui=[]; selected=[]
for name in successes+diagnostics:
    directory=run/name
    for item in sorted(directory.iterdir()):
        if not item.is_file(): continue
        if item.suffix=='.png' and name not in successes and item.name!='FAILURE.png':
            data=item.read_bytes(); omitted.append(dict(run=name,path=item.name,bytes=len(data),sha256=sha(data),reason='Duplicate diagnostic/earlier-success image; raw state, actions, failure and logs retained.'))
            continue
        target=root/'e2e'/name/item.name; target.parent.mkdir(parents=True,exist_ok=True); shutil.copyfile(item,target)
        if item.suffix=='.png': selected.append(target.relative_to(root).as_posix())
        if name in successes and item.name.startswith('R05') and item.suffix=='.json':
            value=json.loads(item.read_bytes())
            if 'viewport' in value:
                ui.append(dict(run=name,path=target.relative_to(root).as_posix(),viewport=value['viewport'],overflowX=value['overflowX'],issueCount=value['issueCount']))
write(root/'omitted-duplicate-images.json',json.dumps(omitted,indent=2))
write(root/'ui-review.json',json.dumps(dict(selected_screenshots=selected,changed_flow_states=ui,overflow_failures=sum(v['overflowX']>1 for v in ui),control_issues=sum(v['issueCount'] for v in ui)),indent=2))
assert len(selected)==32 and len(ui)==26 and all(v['overflowX']<=1 and v['issueCount']==0 for v in ui)

write(root/'README.md',f'''# M1 Major Retained Campaign 05

**SUBMITTED_REVIEW_REQUIRED. Independent Brain acceptance required.**

Authorization `{auth}`. Continue the existing draft [PR11](https://github.com/TasfiqJ/onSkin/pull/11) on `stage/m1-retained-resilience`.

Starting anchor `99596bfceac782d740415503bc25452cac623254`, tree `d45b9c1257c74ab61328600af0ac5a7d1350e388`.
Measured implementation **`{source}`**, tree **`{tree}`**.
The following checkpoint/handoff commit is evidence only. Its actual SHA/tree and authentic final-head CI are read after push and reported in PR11 and the final relay; no future self-hash is invented here.

Shelf, capture and reminder callbacks now retain their accepted owner/grant. Reminder settings distinguish unavailable private storage, isolate query generations, reread on entry and expose accessible retry + Back. You now links to **Local recovery**, which independently reads existing device evidence and opens existing feature recovery controls without new persistence, provider requests, permission prompts or automatic repair.

- [Design and five-stream investigation](DESIGN_DECISIONS.md)
- [Before/after results](RESULTS.md), [commands and raw exits](TEST_MATRIX.md)
- [Exact paths](SOURCE_SCOPE.md), [pre/post blobs + SHA-256, history and protected witnesses](source-scope.json)
- [Synthetic Expo web evidence and limits](E2E_SUMMARY.md), [remaining blockers](BLOCKERS.md)
- [Machine completion report](completion-report.json), [evidence hashes](evidence-manifest.json)

Forced clean measured-source root tests **6,157/6,157** (mobile 6,133; console 24), typecheck and lint pass with zero cached tasks. All eight retained families plus Recovery/settings pass **2,312/2,312**. Original production independently reproduces **21 failing vectors + one passing safeguard**, not 21 independent bugs. Sixteen new-feature cases pass. The unchanged original worklist producer passes **0/1/0** in a complete independent checkout.

Actual headless Chrome passes 375×667 and 390×844, 430×932, 360×640 with direct text ×2, and A→B→A with a delayed Recovery read. Twenty-six changed-flow snapshots have zero horizontal/visible-control issues. The selection keeps **32 screenshots**, including three genuine failed attempts; omitted duplicates are hash-indexed.

Original Security/G97 remains FAIL/NO_GO; M1-03 BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED; M2-01 and dependent/native/clinical/paid/provider/release work remain unauthorized. Native filesystem/camera, OS permission/delivery, physical accessibility, installed offline cold start and paid-positive/provider behavior are NOT_RUN. Spend USD 0.

From repository root after commit: `python -B docs/brain/checkpoints/M1-02/RETAINED-MAJOR-CAMPAIGN-05/verify_checkpoint.py`.
''')
write(root/'DESIGN_DECISIONS.md','''# Design and source investigation

The existing Today retry, reminder save notices and photo deletion notices are useful within their domains. Inspection found no equivalent local-only entry point that explains these independent states together. The new You → Help → Local recovery view fills that gap without a new ledger, backend protocol, cloud sync promise, entitlement or data copy.

The view retains descriptors only. It reads the existing Shelf loader, this local day's completion loader, strict notification preferences and existing photo-deletion status. It never reads photo metadata/images/notes, opens encrypted image files, schedules notifications, requests permission or contacts a provider. “No pending cleanup” refers only to the current readable journal, not all historical deletion or photo-content availability. Reminder intent always needs separate permission/scheduling confirmation. Existing Progress paywall and lock gates remain on the feature link.

Existing account/health leases fence every await. Local adult/consent receipts are checked before and after domain reads. Lease generation, day/foreground clock and focus remount the panel; old requests cannot publish into a replacement. Feature-owned change signals and existing query invalidations retire earlier snapshots, coalesce changes and reread through one flight per domain. There is no persisted cross-domain cache and no destructive “fix all.” Reads retry independently; mutations and native convergence stay in the original feature controls.

| Stream | Inspection and disposition |
| --- | --- |
| A: first/returning session | Read onboarding provider/receipt/quiz/navigation and actual Shelf stores/hooks/routes. Existing quiz completion, duplicate submission and append-only rules remain. Fixed render-retired Shelf callbacks; actual onboarding/manual/error/reload and A→B→A paths ran. |
| B: daily/offline loop | Read completion/progress/clock/profile/ramp paths and current launch contracts. Kept accepted offline/streak/ramp repairs and deterministic DST/clock logic. New local-day and foreground status tests pass; actual AM/PM offline duplicate/write-refusal/reload journey passes. No extra algorithm defect was invented. |
| C: reminder intent | Fixed unavailable preferences, generation-isolated reads/mutations, withdrawn/old-owner display and one-minute cached-entry reuse. Existing strict permission classifier, quota/quiet-hours, cancellation compensation, billing separation and prompt policy remain unchanged and tested. |
| D: private diary | Read storage, encryption, thumbnails, publication/delete journals and sensitive cache boundaries. Reused the existing detail-mutation authority path for capture dispatch. Existing capture-session fences remain an additional protection. No crypto or filesystem change; source-port tests do not prove native capture. |
| E: accessible recovery | New generic status cards and read-error screens have 48px controls, Back, live error notices, independent retry and visible keyboard focus. Real web geometry/text-pressure and feature/paywall return were exercised. |

The private-KV primitive already compensates ambiguous commit-then-reject writes. We retained it and its tests rather than manufacturing a feature-level mutation bug by mocking away that contract. Photo cleanup remains journal-owned, truthful and independently retryable.

The prior M1X-04 preservation list included Shelf mutations because that earlier task did not edit Shelf. Campaign05 explicitly authorizes that file; its changed bytes and retained cancellation behavior are recorded as source here. Absolute protected paths and all old checkpoints remain unchanged. This design note issues no ADR, acceptance, M2 or launch authority.
''')
write(root/'RESULTS.md','''# Before and after

| Problem family | Original/earlier failure | Repair and proof |
| --- | --- | --- |
| Retired retained actions | Real Shelf hook + store wrote an old intake after A→B or same-owner regrant. Other retired lifecycle methods also failed to reject before persistence. Capture's mutation observer could adopt a replacement render's authority. | Capture the render lease for Shelf; carry photo authority in mutation variables through the existing guarded mutation path. Nine Shelf vectors and two capture vectors fail on original production; the late capture-settlement safeguard already passed. |
| Preference availability and isolation | Corrupt/unreadable preferences looked like defaults; retained data survived failed reads/withdrawal/owner replacement. An old reminder mutation callback could opt in a new owner. Notifications/Timing lacked a reachable read retry. | Preserve conservative scheduler fallback, add strict UI reads, scope queries to the exact grant, mask failed/pending data and carry accepted mutation authority in variables. Real stores/hooks and mounted routes prove error/retry, independent state and isolation. |
| Cached settings entry | With the real app's one-minute freshness, returning to settings could reuse a fresh-looking snapshot without reading the now-unavailable device store. Actual Expo web reproduced the missed recovery state. | Local preference queries reread on mount and withhold the prior snapshot while reading. A mounted regression reproduces the app freshness default; the same real web flow then passes. |

The final three-file overlay on untouched pinned production reproduces **21 failures and one safeguard pass**. It used all mobile source paths, no tracked production edits, and exact final test hashes. It was intentionally sparse for negative source testing; complete-checkout qualification was separate. These are failure vectors across the families above, not a count of independent defects.

The new Recovery implementation's own early adversarial tests found three gaps: same-owner write during a pending empty read, and age/consent closure during a domain read. Those three failed with twelve passing cases before repair; all sixteen final feature cases pass, including foreground/local-day refresh. This is new-feature iteration, not a claim that the original product had sixteen new bugs.

Honest failed attempts remain in receipts: an invalid new replacement-test UUID (corrected before the independent baseline), legacy source-string expectations (original tests retained; source naming preserved), probe/render lint findings (fixed with effects), callback memoization (changed to a single-flight loop), stale ignored Expo route types (refreshed by real Expo start), Windows ESM import URL and early evidence-write setup, a Timing text locator, and the cross-owner test-port deadlock. None was relabeled a passing product test.

The original generator first ran after the then-final source/docs. Full-root testing subsequently required preserving the original Shelf source-contract variable name. That small forward source commit required a second authentic two-output generation. The final complete-checkout check refuses both outputs after one referenced input changes, preserves the outputs, restores the input exactly and passes: 0/1/0. Producer/policy/tests/exclusions/versions were not changed.
''')
write(root/'TEST_MATRIX.md','''# Commands, raw exits and limits

All receipts contain exact argv, cwd, UTC, head/tree, actual exit, complete-log SHA-256 and working status; later receipts also hash each working source/test file. Installed Node 22.21.0, npm 11.20.0, Python 3.9.13 and Vitest 4.1.11 were reused. No dependency, lock, policy or native version changed.

| Receipt | Actual result | Exit |
| --- | --- | --- |
| independent-original-production | Final three additive test files on exact anchor production: 21 fail, one pass; corrected fixtures. | 1 expected |
| shelf-render-authority-green | Shelf hook/store, prior read recovery and opening routes: 72 pass. | 0 |
| photo-render-authority-green | Capture authority, offline diary, real store and detail UX: 69 pass. | 0 |
| reminder-entry-green | Complete reminder family after entry fix: 257 pass. | 0 |
| recovery-source-currentness-red | Early new-feature implementation: three fail, twelve pass. | 1 expected |
| recovery-foreground-green | Final new-feature mounted/source acceptance: 16 pass. | 0 |
| final-retained-and-recovery | All eight retained families + new Recovery and settings: 2,312 pass, 193 files. | 0 |
| measured-root-tests | `npm test -- --force`: 6,133 mobile + 24 console = 6,157; 476 + 7 files; two tasks, zero cached. | 0 |
| measured-root-typecheck | `npm run typecheck -- --force`: three tasks, zero cached. | 0 |
| measured-root-lint | `npm run lint -- --force`: three tasks, zero cached; mobile ESLint with max-warnings=0; console TypeScript; types workspace has no lint configured. | 0 |
| final-worklist-generation | Unchanged `node scripts/phase4/build-source-worklist.mjs --strict`; only two permitted outputs. | 0 |
| independent-worklist-contract | Original `--strict --check` at measured source, complete independent checkout; changed one Shelf input; both outputs refused; exact restoration. | 0 / 1 / 0 |
| web375-measured-final / web390-attempt1 | Actual fresh-profile Expo web onboarding, daily loop and changed recovery/settings flows; 390 also checks 430 and 360/text×2. | 0 / 0 |
| cross390-attempt2 | Actual synthetic A→B→A, delayed Recovery read and existing cleanup failure/retry. | 0 |

The combined retained command is `npm --workspace apps/mobile run test -- src/features/shelf src/features/today src/features/routine src/features/scheduler src/features/streak src/features/notifications src/features/photos src/features/onboarding src/features/retainedRecovery src/features/settings --maxWorkers=4`.

The measured forced root runs start/end clean at d76cbd2742920895522e3e9018d554319c777741. No skips are reported. The complete root log retains 637 renderer-deprecation lines and 33 “not wrapped in act” warning lines. These are raw line counts, not independent defects; they were not suppressed. Final lint has zero warnings. Earlier nonzero exits and raw logs remain beside the final passes.

The complete disposable worktree used installed-dependency junctions, no source hard links or install. After the 0/1/0 audit and exact restore, its known junctions were removed without recursion and its clean owned worktree was removed. Existing Brain worktrees, including their negative overlays, were preserved. Final current-state evidence is in pre-delivery-state.json; post-push readback is reported externally.
''')
write(root/'E2E_SUMMARY.md','''# Actual synthetic Expo web

The unchanged repository onboarding/daily/cross-owner driver ran actual headless Chrome against Expo web with fresh synthetic profiles. The checkpoint-local wrapper adds the new interactions, bounded screenshots and platform-port timing. Original/executed driver hashes are retained; the final 375 run also retains the exact executed script. No production feature function was replaced to manufacture a success. Browser storage refusals/delays and permission bridge states are controlled ports and are labeled accordingly.

375×667 and 390×844 pass the real age/consent/quiz/manual/free-plan flow, durable AM/PM check-offs, duplicate/refused-write retry and reload. You → Local recovery uses the actual link. It shows independent local evidence; a reminder read refusal leaves saved check-offs intact. Keyboard Tab/focus/Enter and Back are exercised with a visible outline assertion. Notifications and Timing show read-error recovery, reread after returning, and retry offline. An explicit user switch saves reminder intent through the actual hook/store with a controlled permission bridge; Recovery still says Needs confirmation. The original bridge is restored. Progress retains its actual free-plan paywall.

The 390 run also inspects 430×932 and 360×640 with direct text sizes/line heights multiplied by two using the existing text-pressure method. Content wraps, controls remain reachable by scroll and there is no horizontal overflow. This is browser stress, not physical Dynamic Type or VoiceOver.

The cross-owner run starts Recovery under A, delays its actual private read, triggers the real synthetic Auth B reconciliation, and observes the neutral boundary while work drains. Existing failed cleanup/duplicate retry then leads to B's own age/consent/quiz/Shelf/edit. Recovery reads B's own state; B reload remains isolated. Returning to A and direct Recovery entry remain age-closed. The finite original observer reports no A flash; this is not a universal or live-provider guarantee.

Twenty-six changed-flow snapshots have zero horizontal overflow and zero visible-control issues. Thirty-two selected screenshots include three genuine failures: cached settings before repair, a wrong Timing locator, and the test-port deadlock. Repetitive diagnostic/earlier-success images are omitted only with their actual hashes/sizes; all raw state, actions, bindings, error and console records remain. Inherited driver artifact lists are requests, not proof of suppressed screenshots; ui-review.json and evidence-manifest.json enumerate actual retained files.

The final 375 and cross-owner runs use exact measured source d76cbd2742920895522e3e9018d554319c777741. The successful 390 run used 98e2a638c125267dcaf5e06b237fc019800029c4; subsequent runtime change only names the already-validated Shelf owner variable to preserve the original source contract. Changed UI/hooks remain byte-identical; later deltas are docs/generated worklists. The final cross-owner run also exercises Shelf/daily behavior after that naming repair.

Native camera/encrypted filesystem/Keychain, actual OS prompt/scheduling/delivery, installed offline cold start, physical accessibility, paid-positive, real provider/hosted/clinical/signing/release behavior are NOT_RUN. Browser warnings retain the expected blocked-provider environment, web notification listener and pointer-events deprecation messages. Original no-uncaught-error and safety assertions remain unchanged.
''')
write(root/'BLOCKERS.md','''# Protected gates and limitations

- M1-03 remains BLOCKED_EXTERNAL_CUSTODY / NOT_ACCEPTED. Original G97 remains FAIL / NO_GO. Historical OWASP custody, source/scanner/secret/advisory/issuance/expiry obligations remain open: 61 refused source classifiers, 26 SQL obligations, 189 failed historical targets / 368 events. Expiry 2026-10-21T00:00:00Z was not extended.
- The original anchor's refreshed Quality and canonical DB job completed successfully; iOS passed source-only; Security failed. Those observations belong only to 99596bfceac782d740415503bc25452cac623254. Final pushed-head CI is read separately after push and reported in PR11/final relay. Pending remains pending; no prior success is borrowed.
- Main d9912f4c8b30358593569c5b9b4e84773c6f463e and PR10/stage/m1-gate-recovery cd2bd51997f283c0b446bf2124f427f482550fa8 remain read-only. PR11 must stay DRAFT/OPEN/UNMERGED, auto-merge OFF.
- M2-01 and every dependent M2/M3/clinical/JANUS/paid/native/release milestone remain NOT_AUTHORIZED. This is M1 client recovery, not a new owner/formula ledger, export/history, clinical feature or release admission.
- No original Security/DB/native/dependency/auth/storage/encryption primitive was edited or reattested. No canonical image/workflow substitution, credential search, hosted replay, real patient data or new spend occurred. Existing qualified-custodian needs remain with the original [owner packet](https://github.com/TasfiqJ/onSkin/blob/d9912f4c8b30358593569c5b9b4e84773c6f463e/docs/brain/checkpoints/M1-03/OWNER_ACTION_PACKET.md); no new protected fix was required by this campaign.
- Source-port/Expo evidence does not establish native filesystem, OS delivery, physical accessibility, provider, paid-positive, signing or clinical outcomes. These remain NOT_RUN. Incremental spend USD 0.
''')
write(root/'SOURCE_SCOPE.md',f'''# Exact source scope

Measured source `{source}`, tree `{tree}`, descends from the authenticated/pinned anchor through ten forward commits. All 23 changed source/doc/worklist paths and their exact pre/post mode, Git blob, byte length and SHA-256 are in source-scope.json. All ten intermediate path sets pass the campaign allowlist.

There are 51 protected path witnesses: 48 existing Git objects and three absence witnesses. Every existing checkpoint child, original Security/DB/workflow/producer, auth/consent/storage/offline and selected encryption/native/dependency boundary remains unchanged. The witness list explicitly distinguishes the previously narrow M1X-04 Shelf preservation witness from this campaign's now-authorized Shelf edit.

'''+ '\n'.join('- `'+entry['path']+'`' for entry in scope['entries'])+'\n')

receipts=[]
for path in sorted((root/'receipts').glob('*.json')):
    value=json.loads(path.read_bytes())
    receipts.append(dict(path=path.relative_to(root).as_posix(),exit=value['exit_code'],head=value['head'],log_sha256=value['log_sha256']))
report=dict(schema_version=1,status='SUBMITTED_REVIEW_REQUIRED',authorization=auth,acceptance_authority='Independent ChatGPT Brain only',
    anchor=scope['anchor'],measured_source=source,measured_tree=tree,source_paths=23,source_commits=10,protected_path_witnesses=51,existing_protected_objects=48,absence_witnesses=3,
    implementation=dict(families=['render-retired Shelf/capture/reminder actions','unavailable/cross-grant reminder preference state','cached settings entry'],feature='Device-local recovery under You; no new persisted cache, provider, permission prompt, scheduling or automatic fix'),
    tests=dict(original_production=dict(failed_vectors=21,passed_safeguards=1,exit=1),new_feature=dict(passed=16),retained_recovery_settings=dict(passed=2312,files=193,exit=0),root=dict(mobile=6133,console=24,total=6157,files=483,exit=0,cached_tasks=0,skips_reported=0,renderer_deprecation_lines=637,act_warning_lines=33),typecheck=dict(exit=0,cached_tasks=0),lint=dict(exit=0,cached_tasks=0,warnings=0),worklist=dict(exits=[0,1,0],producer_unchanged=True,complete_independent_checkout=True)),
    e2e=dict(surface='Actual headless Chrome / Expo web, synthetic owners/products and controlled platform ports',passed=successes,screenshots=32,changed_flow_states=26,overflow_failures=0,control_issues=0,cross_owner='A-to-B-to-A; delayed Recovery read; cleanup failure/retry; B fresh admission; closed A return',not_run=['native camera/encrypted filesystem/Keychain','actual OS notification permission/scheduling/delivery','installed offline cold launch','physical accessibility/VoiceOver','paid-positive','real provider/hosted','clinical/signing/release']),
    github_ci=dict(anchor_only='See intake-ci-observation.json; final anchor Quality/canonical DB and source-only iOS passed, Security failed',final_head='Observed separately after evidence commit/push in PR11/final relay; not predicted or borrowed here'),
    delivery=dict(branch='stage/m1-retained-resilience',pr=11,required_pr_state='DRAFT OPEN UNMERGED; auto-merge OFF',evidence_tail='Read actual SHA/tree after commit and push; source above excludes evidence tail',main_promotion_authorized=False),
    boundaries=dict(m103='BLOCKED_EXTERNAL_CUSTODY / NOT_ACCEPTED',g97='FAIL / NO_GO',m201='NOT_AUTHORIZED',protected_admission=False,spend_usd=0),receipts=receipts)
write(root/'completion-report.json',json.dumps(report,indent=2))

handoff=repo/'ONSKIN_BRAIN_HANDOFF.txt'
assert auth not in handoff.read_text(encoding='utf-8')
with handoff.open('ab') as f:
    f.write(f'''\n\nM1 MAJOR RETAINED CAMPAIGN 05 — SUBMITTED_REVIEW_REQUIRED
Authorization {auth}. Independent Brain alone accepts source or authorizes later ordinary main promotion.
External packet manifest 41a5baa8afaf732c8fc4a836a3cb7e8662aaeb8b7ab459701e9ca0d9b5d370dc verified:19 anchored files; transport integrity only.
Started from 99596bfceac782d740415503bc25452cac623254/tree d45b9c1257c74ab61328600af0ac5a7d1350e388 on stage/m1-retained-resilience; main/PR10 untouched.
Measured implementation {source}/tree {tree};10 forward source/doc/worklist commits;23 source paths. This following checkpoint/handoff tail is evidence-only; actual final SHA/tree and final-head CI are reported after push, never predicted here.
Repairs: render-accepted Shelf/capture/reminder authority; strict/scoped reminder reads, no retained old-grant error/success; accessible read retry+Back; fresh local read on settings entry. New You Local recovery independently reads device-only descriptors and links existing controls; no new cache/backend/permission/scheduling/automatic cleanup/paid or clinical grant.
Original production overlay21 expected failures+1 safeguard;16 new-feature cases pass; all8 retained families+Recovery/settings2312/2312. Forced clean measured root6157/6157 (mobile6133+console24;483 files),typecheck/lint PASS,zero cached;no skips reported. Raw root637 renderer deprecation/33 act-warning lines retained;lint0 warnings. No original negative test weakened.
UNCHANGED worklist producer final 0/1/0 in complete independent checkout. First generation was followed by the original Shelf literal-contract repair, requiring authentic final regeneration of only the same2 outputs. Exact restoration and producer/output SHA receipts retained.
Actual synthetic Expo web375/390 plus430/360text200 and A→B→A PASS; delayed local read, cleanup refusal/retry,B own admission and closed A return.26 changed-flow geometry states0 issues;32 selected screenshots including3 genuine failed attempts;raw failures and omitted-duplicate hashes retained. Native filesystem/camera/Keychain,OS delivery,physical accessibility,installed offline cold start,paid-positive,provider/hosted/clinical/signing/release NOT_RUN.
Checkpoint docs/brain/checkpoints/M1-02/RETAINED-MAJOR-CAMPAIGN-05 includes README,design,matrix,results,exact pre/post source blobs+SHA,48 existing protected Git objects+3 absence witnesses,all intermediate scope sets,raw receipts,UI,limitations,machine report and verifier. All old checkpoints preserved. Shelf mutations were authorized anew here, not falsely listed as the prior narrow task's unchanged witness.
Anchor-only refreshed CI:Quality40060773053 and canonical DB120773565964 SUCCESS;iOS40060773028 SUCCESS source-only;Security40060773035 FAILURE. These are not final-head approvals. Actual final-head CI read after push is separate and time-bound in PR11/final response.
PR11 remains draft/open/unmerged/auto-merge off. Main d9912f4c8b30358593569c5b9b4e84773c6f463e and PR10 cd2bd51997f283c0b446bf2124f427f482550fa8 read-only. Original M1-03 BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED,G97 FAIL/NO_GO,61 source refusals,26 SQL obligations,189 failed historical targets/368 events,OWASP custody and expiry2026-10-21T00:00:00Z unchanged. M2-01/dependent/clinical/JANUS/native/paid/release NOT_AUTHORIZED. USD0.
Founder relay after final push/readback: Codex is done.
'''.encode('utf-8'))

entries=[]
for path in sorted(root.rglob('*')):
    if not path.is_file(): continue
    data=path.read_bytes(); entries.append(dict(path=path.relative_to(root).as_posix(),bytes=len(data),sha256=sha(data),git_blob=blob(data)))
data=handoff.read_bytes()
manifest=dict(schema_version=1,files=entries,handoff=dict(path='ONSKIN_BRAIN_HANDOFF.txt',bytes=len(data),sha256=sha(data),git_blob=blob(data)),self_excluded='evidence-manifest.json; no future commit hash')
write(root/'evidence-manifest.json',json.dumps(manifest,indent=2))
print(json.dumps(dict(source=source,tree=tree,evidence_files=len(entries),screenshots=len(selected),manifest_sha256=sha((root/'evidence-manifest.json').read_bytes()),checkpoint=str(root)),indent=2))
