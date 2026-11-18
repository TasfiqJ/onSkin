import datetime, hashlib, json, re, shutil, subprocess
from pathlib import Path

O=Path(__file__).resolve().parent; R=O.parent/'c16-candidate'; RAW=O/'raw'; A=O/'audit'
HEAD='1962b44aec384545638f4aaede36ac64ef31aebe'; TREE='ad97b496949cdaae0cbfe5d8c778b3c54576e14f'
START='efd3af803a2a71bd2fdd644ecfd500c619fb996c'; START_TREE='83670a073910a840c69368f1760d5cb59d021054'
OLD='https://github.com/TasfiqJ/onSkin/blob/fdcade2438e0d8f8e1611f03cf6f3575dc1600ac/evidence/brain-latest-review-2026-11-18/'
def git(*args):return subprocess.check_output(['git',*args],cwd=R).decode().strip()
def sha(b):return hashlib.sha256(b).hexdigest()
def put(name,text):
 p=RAW/name;p.parent.mkdir(parents=True,exist_ok=True);assert not p.exists(),name;p.write_bytes(text.encode('utf-8'))
def putj(name,value):put(name,json.dumps(value,indent=2,ensure_ascii=False)+'\n')
assert git('rev-parse','HEAD')==HEAD and git('rev-parse','HEAD^{tree}')==TREE and not git('status','--porcelain=v1')
required=['root-tests-final2','typecheck-final2','lint-final2','consumer-build-final2','professional-build-final2','privacy-focused-final','optional-browser-final2','templates-browser-final2','professional-owner375','professional-owner430','professional-queue375','professional-queue430']
for label in required:
 receipt=json.loads((O/(label+'.json')).read_text());assert receipt['exit']==0,(label,receipt['exit']);assert receipt['before']['head']==HEAD and receipt['after']['head']==HEAD,label
for folder in ['optional-browser-final2','templates-browser-final2']:
 receipt=json.loads((O/folder/'summary.json').read_text());assert receipt['pass'] is True
inventory=[]; receipts=[]
for p in sorted(O.rglob('*')):
 if not p.is_file() or any(part in ['raw','audit','stage','build','remote-readback','remote-reconstructed','local-reconstructed','__pycache__'] for part in p.relative_to(O).parts):continue
 name=p.relative_to(O).as_posix();b=p.read_bytes();row={'path':name,'bytes':len(b),'sha256':sha(b)}
 try:b.decode('utf-8');readable=b'\0'not in b
 except UnicodeDecodeError:readable=False
 row['publication']='complete text with declared path sanitization' if readable else 'binary omitted; original size/hash retained'
 inventory.append(row)
 if readable:put('current/'+name,b.decode('utf-8'))
 if p.parent==O and p.suffix=='.json':
  v=json.loads(b)
  if 'command'in v and 'exit'in v:receipts.append({'label':p.stem,**v})
putj('CURRENT_ORIGINAL_INVENTORY.json',inventory);putj('CURRENT_RUN_RECEIPTS.json',receipts)
for name in ['verify_evidence.py','verify_trees.py']:
 put(name,(A/name).read_text(encoding='utf-8'))
for name in ['GITHUB_RECHECK.json','INITIAL_GITHUB_RECHECK.json','GITHUB_PREFLIGHT.json']:
 put('publication/'+name,(A/name).read_text(encoding='utf-8'))
putj('INITIAL_IDENTITY.json',{'recordedForHandoffAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'observation':'Verified before first source edit in the tool transcript; this derived receipt was written at handoff time, not backdated.','branch':'stage/m1-native-runtime47','head':START,'tree':START_TREE,'porcelain':'','pr48Ancestor':'d292743c99c1fb98f5714789f4fd60fb1e7d5a5d','engineering19Ancestor':'2f699f6157c1d6414b7e74661a4e11e89a77ed92','bothAncestryCommandsExit':0,'competingWriter':'No observed competing source writer; preceding local engineering task was idle in app list. No Git lock found. Some OS process command lines were unavailable; this is an observation, not a global lock proof.','worktree':'existing c16-candidate; no new application worktree/branch'})
putj('CHECKPOINT.json',{'status':'COMPLETE_LOCAL_CHECKPOINT','authorization':'BRAIN-ONSKIN-AUTONOMOUS-LOCAL-PRODUCT-28','branch':git('branch','--show-current'),'head':HEAD,'tree':TREE,'porcelain':git('status','--porcelain=v1'),'startingHead':START,'startingTree':START_TREE,'sourceCommits':4,'applicationSourcePushed':False,'all38':'UNACCEPTED','all18':'UNACCEPTED','release':'NO_GO','J01':'Visible Pores only; positive admission closed','nextCampaign':'Do not begin before independent Brain audit'})
frozen={}
for name in ['contract.v2.json','matrix.v2.json']:
 path='docs/release/full-app-j01/'+name;assert git('rev-parse',START+':'+path)==git('rev-parse',HEAD+':'+path)
 frozen[path]={'gitBlob':git('rev-parse',HEAD+':'+path),'unchangedFromEngineering27R':True,'sha256':sha((R/path).read_bytes())}
putj('FROZEN_SCOPE_PRESERVATION.json',frozen)
matrix=json.loads((O.parent/'BRAIN_LATEST_REVIEW_2026-11-18/raw/ALL38_ALL18_MATRIX.json').read_text())
matrix.update(sourceHead=HEAD,sourceTree=TREE,assessmentMethod='Engineering28 exact-source local regression plus bounded source inspection; inherited E27R evidence remains historical at its immutable link. No native/security/provider/scientific acceptance.')
for row in matrix['rows']:
 row['existingTestsAndEvidence']='Inherited E27R evidence: '+row['existingTestsAndEvidence']+' Current E28: root8674/582, privacy479/15, type/lint/builds and selected browser receipts; see TEST_EVIDENCE_INDEX. New tests are regression evidence, not qualification.'
 if row['id']=='P03':
  row['implementedBehavior']+=' E28 adds a practice-only generic role-template library: immutable revisions, dated original history/copy, review/cancel, source-CAS save, encrypted readback, exact retry, terminal retirement and reload. No client record import.'
  row['missingFunctionality']='Template-to-client intended issuance, exact role-to-owned-bottle resolution, unshelved proposals, genuine authority/custody and explicit owner application remain unfinished.'
  row['remainingCodeWork']='Connect only after genuine current source/roster/grant/serial interfaces exist. Add explicit per-slot mapping and source-bound issue/apply; retain missing-history refusal and default503. Lawful read-only template offboarding remains missing.'
 if row['id']=='F06':row['implementedBehavior']+=' E28 role templates are independently versioned; no owner application bridge is fabricated.'
 if row['id']=='F02':row['implementedBehavior']+=' E28 first-key creation retains original authority through probes and preserves dispatched/uncertain keys and discovered successors.'
 if row['id']=='F07':row['implementedBehavior']+=' E28 real navigation integration retires both collapsed entry callbacks across blur/refocus and owner replacement, retaining explicit same-lease source recovery.'
 if row['id']=='V2-C05':row['remainingCodeWork']+=' E28 found no admitted original-owner writer; the bridge remains closed rather than synthesizing an owner record.'
for gate in matrix['gates']:
 gate['currentEvidence']+=' E28 ordinary local source/browser tests do not grant this gate.'
assert len(matrix['rows'])==38 and len(matrix['gates'])==18 and all(x['formalAcceptance']=='UNACCEPTED'and not x['readyForIndependentAcceptance']for x in matrix['rows']+matrix['gates'])
putj('ALL38_ALL18_MATRIX.json',matrix)
lines=['# Engineering28 all38/all18 assessment','',f'Source `{HEAD}` / tree `{TREE}`. All38 REQUIRED requirements and all18 gates remain **UNACCEPTED**, not ready for independent acceptance. Release NO_GO. Frozen source contract/matrix unchanged. Exactly J01 Visible Pores; positive admission closed.','']
for row in matrix['rows']:
 lines+=['## '+row['id']+' — '+row['name'],'']
 for label,key in [('Implemented','implementedBehavior'),('Missing','missingFunctionality'),('Evidence','existingTestsAndEvidence'),('Remaining code','remainingCodeWork'),('External qualification','externalQualificationDependencies')]:lines+=['- **'+label+':** '+row[key]]
 lines+=['- **Formal acceptance:** UNACCEPTED; not ready.','']
lines+=['## Independent gates','','| Gate | Formal status | Evidence/remaining dependency |','| --- | --- | --- |']
for g in matrix['gates']:lines+=['| '+g['id']+' | UNACCEPTED | '+g['currentEvidence']+' '+g['remainingDependency']+' |']
put('ALL38_ALL18_MATRIX.md','\n'.join(lines)+'\n')
put('FINAL_REPORT.md',f'''# Engineering28 local product checkpoint

Authorization BRAIN-ONSKIN-AUTONOMOUS-LOCAL-PRODUCT-28. Start `{START}` / tree `{START_TREE}`; final `{HEAD}` / tree `{TREE}`, clean on existing stage/m1-native-runtime47. Four ordinary local commits; no rewrite, separate application branch/worktree, source push or PR change. All38/all18 UNACCEPTED, release NO_GO.

## Substantive product work

The professional template library is a complete bounded journey through the actual UI, API, domain and encrypted repository: load a practice-scoped inventory; compose ordered Morning/Evening product roles and a generic title; review; cancel back to the draft; explicitly save an immutable revision; inspect dated original revisions; copy a selected practice revision into a distinct draft; revise with exact parent-hash CAS; review/cancel/confirm retirement; reload retained history. Unknown acknowledgement retries the identical command/ID. Strict decoders enforce scopes, actor, time/order/hash/parent chains, bounded input and immutable prefixes. Retirement reserves terminal capacity after500 authoring entries/100 active revisions per template;100 template families and600 total entries bound the aggregate. A retired template cannot gain another revision; explicit copy creates a separate identity.

Templates are authored as generic product roles only, with a bounded generic title. There is no client import, owner/bottle ID, formula/clinical text field or plan-copy port. Human misuse of the generic title cannot be proven absent by code; copy explicitly prohibits client names/records. Every DOM value uses textContent/value. The browser keeps only transient memory/DOM, clears on blur/background/session retirement, and writes no template text to browser storage. Role/licence/AAL2/TOTP/current membership and verified workspace billing are checked before template load and at final serial handoff. Missing history/ports refuse; no empty aggregate is provisioned by a read. Default Vite/server APIs remain503. Positive tests install only explicit synthetic trust/keys/serial storage; no professional admission follows.

F06/V2-C05 and broader P03/P04 remain partial. Existing personal actual routines and recorded-use journals are distinct from intended plans, owner receipts and capacity acceptance. No genuine original-owner server ingestion/application writer, product-role mapping/unshelved proposal identity or roster assignment port was found that can lawfully complete the bridge now. Those connections remain unavailable. The template library is independently useful provider-free implementation that can be installed behind the existing trusted port when separately admitted; it does not assert clinical correctness, owner application, recorded use, delivery, capacity or payment. Template read-only offboarding still needs an explicit lawful permission/lifecycle design because the existing template-author permission requires active write billing.

## Security-preserving recovery work

First-content-key creation previously awaited existing-key/orphan/native probes before checking original authority at the caller. RED tests proved key creation and fallback deletion could begin after original consent retired. Both genuine-write callers now pass their original account/health/caller guards through creation and storage probes. Read/no-op paths remain observational. A native miss followed by a fallback await also allowed a discovered successor native key to be overwritten; a separate RED test proved it. A final native re-probe now refuses that stale miss. A dispatched key whose reply is lost or whose authority retires remains retained, without compensating deletion or a false record-write success. Genuine retry reuses the retained key. Native APIs provide no atomic CAS against unrelated external processes; physical/native interruption and arbitrary external mutation remain unqualified.

Both collapsed optional entries now require the rendered navigation generation. The previously unguarded Record callback reproduced a hidden history read after real route blur while the route remained mounted. Navigation integration now checks blur/refocus, original versus replacement owner and fresh explicit entry. The entered primary history pins its original lease; only that same exact lease may expose a freshly rendered source callback for explicit conflict recovery. An initial overly broad source pin broke two original same-owner recovery tests; their assertions are untouched and the repaired full suite passes. E23 raw outer CAS bytes, inner v5 predecessor proof, exact facts/IDs/targets and schema2/unprovable-legacy refusals are unchanged. Photos/orphan recovery still preserves uncertain evidence; no missing key/predecessor/owner proof is fabricated.

The maintained optional browser journey changes only the expanded-panel detection predicate to Find recorded changes. All substantive note/correction/retraction/original-text/source-conflict/refresh/review/readback/retirement/storage-refusal assertions remain. The original obsolete-heading failure is preserved at [immutable E27R evidence]({OLD}TEST_EVIDENCE_INDEX.md).

## Validation and defects repaired during this campaign

Final clean-source uncached root:8674 tests/582 files (mobile7988/556, professional662/19, operator24/7),3 tasks/0cached. Root typecheck and configured lint each4 tasks/0cached PASS; types retains its existing no-lint placeholder. Both web builds PASS. Current focused consent/owner/crypto/storage/photo/source/recovery/navigation subset479/15 PASS. Actual Edge template journey375×667/430×932 uses real source API/domain/encryption with synthetic trust/serial ports; owner and queue regressions pass375/430 using explicit synthetic HTTP fixtures and actual default503. Consumer optional drafts375/390/430 pass with actual encrypted local stores, explicit adult/consent onboarding, original text and exact canonical readbacks. Full source/timestamps/commands/exit/log hashes are in CURRENT_RUN_RECEIPTS and TEST_EVIDENCE_INDEX.

Preserved failures include initial focus-hook harness import failure and runner console-encoding failure; proven focus RED; three first-key creation RED failures; successor-key RED; one new fixture expectation mismatch (storage intentionally wraps domain errors as unavailable); root two original recovery regressions; one unused-import lint warning and one render-side-effect lint error; browser localhost-target setup refusal; browser property-order false unknown retirement; the reproducing unit RED; and a canceled interception acknowledgement that initially escaped the browser harness. Canonical content comparison repairs the false unknown retirement without weakening strict hashes/prefixes. Cancellation diagnostics now remain in the browser receipt without escaping cleanup. An unchanged intended-plan limit test timed out under concurrent root/build/lint load; it passed unchanged in isolation and the full clean root rerun passed with build workloads stopped. No assertion, timeout, protected fixture authority or test skip was relaxed.

One evidence limitation is explicit: browser attempt r2 used FAILURE.json and failure.json on a case-insensitive filesystem, so its state capture replaced the exception-text file. Its actual log/state/failed receipt remain; r3 preserves the reproduced exception trace and response sequence under distinct names. No missing trace is reconstructed or invented. Early dirty or HEAD-changing browser runs remain labeled intermediate; final clean-source receipts are separate. Four source commits and both exact patches authenticate final source; intermediate dirty receipts are not claimed to authenticate every intermediate byte.

## Review and publication boundary

Two read-only review agents inspected protected source and publication tooling; they made no source changes or external mutations. The complete cumulative PR48 patch and Engineering27R session patch have forward/reverse exact-tree checks.148 raw Git commit objects authenticate147 parent links from published PR48, independently verified offline. Historical thousands of unchanged logs are referenced at immutable fdcade evidence instead of copied. New complete text logs/receipts/DOM/state are retained; binary screenshots/build assets are omitted from text publication with exact screenshot inventory hashes. This is not signed-device, backend, professional/provider, clinical/J01, VoiceOver, protected Security/DB or release qualification.

Screened evidence publication uses only a new evidence-only branch derived from immutable fdcade. Existing source/main/PR48/evidence refs remain unchanged. Workflow blobs, default push filters, absent create/indirect triggers, visible hooks/rules and local hooks are checked before push; [skip ci] is supplementary. No hosted CI, paid operation, native attempt79–86, install/provider/account mutation, LFS, merge, deployment or release is initiated. Postpush API/raw byte readback, manifest/ancestry/tree verification and all-event Actions checks are required before final delivery. Independent Brain audit is next; no subsequent engineering campaign begins here.
''')
put('SECURITY_PRIVACY_REVIEW.md',f'''# Engineering28 bounded security/privacy assessment

Final source `{HEAD}` / `{TREE}`. Source inspection plus local synthetic tests; no protected acceptance. [Inherited E27R assessment]({OLD}SECURITY_PRIVACY_REVIEW.md) and G97/candidate29/DB/SDK/native findings remain unwaived.

- Template data is a workspace-only encrypted aggregate. Session/context/workspace come from the trusted authenticator/transaction, never client JSON. Existing template role requires current licence, AAL2/TOTP/membership and verified billing. Initial denial precedes template payload reads; final authority/billing and exact saved history are rechecked under the existing serial port. Client-source ports throw in integration tests and are never called. Missing/corrupt history refuses, not empty-success/provisioning. Scope prefixes, strict hash/parent/actor/time chains and immutable append prefixes prevent cross-workspace/rewrite. Exact ID reuse with changed payload refuses; exact historical retry certifies that revision, while the inventory shows current heads.
- Request origin/header/method/context/size/UTF8/key shape and response no-store/size/strict-record integrity are checked. Private exception bodies are not echoed. UI writes only textContent/value, no HTML insertion, URL content or browser persistence. Clear/background/session events retire generation and abort pending work. Old controls cannot adopt successor reviews. Template titles remain human-authored: explicit generic-only instructions and no client import prevent automatic copying, but semantic personal-data detection is not claimed.
- First-key creation now receives original authority through asynchronous resolution/orphan/native probes. Proven retirement and successor-key windows refuse before initiating a mutation. Native commit-then-reject or post-dispatch retirement preserves the dispatched key and refuses record success. Read/export/recovery/no-op paths do not create/migrate/delete keys. Existing lost/replaced key and E25 native maintenance tests remain. Native re-probes are not physical atomic CAS or multi-process qualification.
- Optional entry generations close the observed same-owner blur stale-read defect. Real navigation retains the route mount during blur/refocus and owner replacement. The primary entry retains the original lease while allowing explicit same-lease source recovery; source/in-flight history changes never become inferred actual-use facts. E23 proof domains/schema refusal and source-authenticated photo/orphan preservation are unchanged.
- Rights/export/withdrawal, owner/account, encrypted storage/photo deletion and recovery regressions pass in the479-case final subset and full8674 root suite. No real records, clinical images, credentials or device secrets were used. Browser fixtures are synthetic. Root tests do not clear protected findings, server custody, native rollback/keychain restore, arbitrary same-origin script compromise, lawful retention, clinical rights or accessibility qualification.

Remaining risks: no genuine hosted identity/licence/roster/grants/original-record source or serial driver; no real browser persistence durability against eviction or forensic erasure claim; no approved template-to-owner mapping/application; no lawful template read-only offboarding; bounded templates can exhaust authoring capacity but terminal retirement is reserved; arbitrary external/native-process key writers are not synchronized by these JS guards. J01-only positive admission stays closed. Default production API503 stays closed.
''')
put('OPEN_DEFECTS_AND_RELEASE_BLOCKERS.md',f'''# Open product and qualification gaps

All38/all18 UNACCEPTED; release NO_GO. Completed bounded repairs and their RED/GREEN logs are in FINAL_REPORT and TEST_EVIDENCE_INDEX. [Historical failures/blockers]({OLD}OPEN_DEFECTS_AND_RELEASE_BLOCKERS.md) remain evidence.

| Gap | Current behavior | Next prerequisite/action |
| --- | --- | --- |
| F06/V2-C05 intended→actual bridge | No fabricated original owner record/writer; acknowledgements/capacity never mean application/use | Genuine immutable original-owner ingress and exact owner transaction; explicit unshelved decisions/mapping/version review |
| P03 template→client plan | Standalone reusable practice role library complete; no implicit bottle mapping or cross-client text copy | Explicit source-bound slot mapping, exact template revision linkage, unshelved proposal identity and owner review |
| Template offboarding | Existing author permission requires live licence/billing for reads | Lawful retained practice-read policy/role under genuine custody; preserve history |
| P04 assignments/operations | Existing synthetic queue/source projections preserved | Genuine named roster, original-event source, staff calendar/digest/delivery/capacity authority |
| Missing/corrupt templates | Deliberate unavailable; no empty provisioning/read repair | Trusted original custodian must explicitly establish initial history; no browser fallback |
| Orphan/legacy/private-key uncertainty | Unproven bytes retained; schema2 and missing predecessor/key/ownership refuse | Independently defensible authenticated recovery; physical/custodian evidence |
| Native key CAS/custody | Final probe closes reproduced successor window; no native CAS claim | Real SecureStore/AsyncStorage interruption/restore/multi-process qualification |
| Protected/native/external gates | G97/Security/candidate29/DB/M1-03/SDK/native unwaived; M2-01 not authorized,79–86 unused | Original custodians and separate finite authority |
| Clinical/J01/rights | Exactly J01 Visible Pores; positives unavailable | Authentic rights, optics, image science, native device and independent review |
| Release/provider/Apple/operations | No real payment/provider/account/device/release qualification | Separate owner/custodian actions, funded capacity and independent acceptance |

No failing test, protected assertion, fixture authority or timeout was removed/weakened. The first root recovery failure was repaired in product source; the overloaded unchanged professional timeout passed unchanged in isolation and the full rerun. Browser r2 exception-file case collision is a disclosed evidence limitation, not a manufactured trace. Browser final uncaught interception has a preserved real failure log; maintained driver records cancellation errors and stops owned processes in finally.
''')
put('BRAIN_NEXT_DECISION.md',f'''# Independent Brain next decision

Audit final `{HEAD}` / tree `{TREE}` on existing stage/m1-native-runtime47. Verify CHECKPOINT, both exact patches and forward/reverse trees,148 raw commit objects/147 edges, all manifests and the complete current logs. Four local commits follow Engineering27R. Prior immutable evidence is [fdcade]({OLD}README.md). No subsequent engineering campaign should begin until this return is audited.

1. Review the proven creation-authority/successor-key repairs and navigation-retirement/same-lease recovery behavior. Passing local tests do not admit protected security or native storage policy.
2. Review the practice-only role-template aggregate, trusted transaction/API and memory-only UI. Decide the next finite provider-free implementation: exact template-revision-to-client mapping/unshelved proposal review, or authenticated recovery/accessibility. Do not turn a client-supplied fixture or copied plan into real professional/source authority.
3. Before connecting F06/V2-C05 or real P03/P04, establish genuine original-owner provenance/application writer, roster/grants, lawful retained-copy/offboarding and serial backend. Current default503 remains required. Template read-only offboarding needs a specific lawful role/lifecycle contract.
4. Protected Security/DB/native/device/J01/rights/provider/payment/Apple/support work remains external or separately authorized. M1-03 unaccepted; M2-01 not authorized; native79–86 unused. Founder retains spending/accounts/permissions/merge/release authority.

Continue only after the Brain audits source. Retain all38/all18 UNACCEPTED and release NO_GO. Never infer actual use from response, accepted plan, schedule or silence. Future source work must recheck the exact clean identity and competing writers without reset/rebase/amend/new application worktree/branch. Evidence-only publication grants no application-source push, hosted CI, paid operation or release.
''')
put('NATIVE_AND_EXTERNAL_QUALIFICATION.md',f'''# Qualification limits

No new macOS/native/simulator/device attempt, including79–86, was made. No physical iPhone/keychain/filesystem/camera/notification/widget/purchase/VoiceOver qualification is inferred from Node, synthetic native ports or Edge. No genuine professional account/licence/roster/grant/source/backend/provider/clinical corpus/payment operation was installed or treated as admitted. Default production API503 remains. Protected findings and native causes UNKNOWN remain as in the [immutable native/external ledger]({OLD}NATIVE_AND_EXTERNAL_QUALIFICATION.md). All18 gates UNACCEPTED; M2-01 not authorized; release NO_GO.
''')
put('TEST_EVIDENCE_INDEX.md',f'''# Engineering28 actual validation

Final `{HEAD}` / `{TREE}`, clean. [All command receipts](CURRENT_RUN_RECEIPTS.json) give actual start/end, exact argv, exit and original log hash. [Current original file inventory](CURRENT_ORIGINAL_INVENTORY.json) pins full logs/DOM/state and omitted binary screenshots. Manifest maps declared path sanitization to original/published hashes. [Prior immutable tests/failures]({OLD}TEST_EVIDENCE_INDEX.md) are historical, not rerun claims.

| Final check | Actual result | Receipt/log |
| --- | --- | --- |
| Uncached complete root |8674/582; mobile7988/556, pro662/19, operator24/7;3tasks/0cached |current/root-tests-final2.json; full ordered log parts in FILE_INDEX |
| Root typecheck |4tasks/0cached PASS |current/typecheck-final2.json/log |
| Configured root lint |4tasks/0cached PASS; types existing no-lint placeholder |current/lint-final2.json/log |
| Consumer Expo web export |PASS, no install |current/consumer-build-final2.json/log |
| Professional Vite build |PASS |current/professional-build-final2.json/log |
| Focused consent/owner/crypto/photo/recovery/navigation |479tests/15files PASS |current/privacy-focused-final.json/log |
| Template real API/domain/encrypted custody browser |375×667/430×932 PASS; synthetic trust/key/serial ports, real default503 |current/templates-browser-final2/summary.json and current/templates-browser-final2.json/log |
| Consumer optional history/durable drafts browser |375×667/390×844/430×932 PASS; actual local encrypted stores and explicit synthetic onboarding |current/optional-browser-final2/summary.json and current/optional-browser-final2.json/log |
| Professional owner and queue regression browsers |375×667/430×932 PASS; intercepted synthetic positives, real default503 |current/professional-final/; command receipts professional-owner375/430, professional-queue375/430 |

Final optional driver preserves every substantive E21 assertion. Only expanded-panel detection changed. Keyboard/44px targets, overflow, cancel/reload, original text, exact retries/history readback/retirement and unsupported storage negatives execute. Navigation unit integration uses real installed React Navigation focus/blur events (expo-router adapter returns that real hook), both routes remain mounted; original/successor owner controls are tested. Actual Expo browser uses the real router. These are not native-device/navigation qualification.

Intermediate failures remain complete under current/: focus-red/red2; creation-red; successor-red; templates-tests; template-order-red; templates-browser/r2/r3; root-tests-pre; root-tests-final (unchanged intended history5000ms timeout under concurrent build load); lint-pre/lint-final; templates-browser-final (uncaught canceled interception). The repaired root, canonical template comparison and final browser results are separate. No timeout/fixture authority/assertion/skip was relaxed. Initial focus-green argv named a .tsx file excluded by configured include; only3 navigation cases ran there. Later observationHistory wrapper and full root execute the original48 panel cases. Browser r2's case-colliding state file replaced exception text; r3 retains the reproduced full trace, and this limitation is explicit.

No native/device, protected hosted Security/DB, scientific/J01, real provider/backend/payment, full accessibility or release checks ran. Browser binary screenshots are omitted from text publication with original hashes; actual DOM/state/network receipts remain. Existing owner/queue drivers retain summaries/screenshots but do not claim exhaustive whole-device network capture. Some intermediate runs crossed source commits; they are not labeled final-clean validation.
''')
print(json.dumps({'reportsWritten':True,'requiredFinalReceipts':required,'selectedOriginalFiles':len(inventory),'commandReceipts':len(receipts),'all38':len(matrix['rows']),'all18':len(matrix['gates'])},indent=2))
