import datetime, hashlib, json, re, shutil, subprocess
from pathlib import Path

O=Path(__file__).resolve().parent; R=O.parent/'c16-candidate'; RAW=O/'raw'; A=O/'audit'
HEAD='b29e731097984be98f5b06024d11255dbb732809'; TREE='bb63940c79e1fde4c946c8162f401baeac2b90c1'
START='1962b44aec384545638f4aaede36ac64ef31aebe'; START_TREE='ad97b496949cdaae0cbfe5d8c778b3c54576e14f'
OLD='https://github.com/TasfiqJ/onSkin/blob/63898e8dceb11d953bb1e2f137439c7e52c3e6fe/evidence/engineering28-review-2026-11-18/'
def git(*a):return subprocess.check_output(['git',*a],cwd=R).decode().strip()
def sha(b):return hashlib.sha256(b).hexdigest()
def put(n,s):
 p=RAW/n;p.parent.mkdir(parents=True,exist_ok=True);assert not p.exists(),n;p.write_text(s,encoding='utf-8',newline='\n')
def putj(n,v):put(n,json.dumps(v,indent=2,ensure_ascii=False)+'\n')
assert git('rev-parse','HEAD')==HEAD and git('rev-parse','HEAD^{tree}')==TREE and not git('status','--porcelain=v1')
required=['root-tests-final2','typecheck-final2','lint-final2','consumer-build-final2','professional-build-final2','privacy-focused-final2',
 'mapping-browser-final2','outcome-browser-final2','optional-browser-final','professional-owner375-final2','professional-owner430-final2','professional-queue375-final2','professional-queue430-final2']
for n in required:
 v=json.loads((O/(n+'.json')).read_text());assert v['exit']==0,n
 for boundary in ['before','after']:assert v[boundary]=={'head':HEAD,'tree':TREE,'branch':'stage/m1-native-runtime47','status':''},(n,boundary)
for n in ['mapping-browser-final2','outcome-browser-final2','optional-browser-final']:
 v=json.loads((O/n/'summary.json').read_text());assert v['pass'] is True,n
inventory=[];receipts=[]
for p in sorted(O.rglob('*')):
 if not p.is_file() or any(x in ['raw','raw-f8-intermediate','audit','stage','build','remote-readback','remote-reconstructed','local-reconstructed','__pycache__']for x in p.relative_to(O).parts):continue
 n=p.relative_to(O).as_posix();b=p.read_bytes()
 try:b.decode('utf-8');readable=b'\0'not in b
 except UnicodeDecodeError:readable=False
 inventory.append({'path':n,'bytes':len(b),'sha256':sha(b),'publication':'complete UTF-8 with declared path sanitization'if readable else'binary omitted; exact original size/hash retained'})
 if readable:put('current/'+n,b.decode('utf-8'))
 if p.parent==O and p.suffix=='.json':
  v=json.loads(b)
  if 'command'in v and'exit'in v:receipts.append({'label':p.stem,**v})
putj('CURRENT_ORIGINAL_INVENTORY.json',inventory);putj('CURRENT_RUN_RECEIPTS.json',receipts)
for n in ['verify_evidence.py','verify_trees.py']:put(n,(A/n).read_text())
for n in ['GITHUB_RECHECK.json','GITHUB_PREFLIGHT.json','github_delivery.py']:put('publication/'+n,(A/n).read_text())
for n in ['INITIAL_IDENTITY.json','ENGINEERING28_HANDOFF_REVIEW.json']:put(n,(O/n).read_text())
putj('CHECKPOINT.json',{'status':'COMPLETE_LOCAL_CHECKPOINT','authorization':'BRAIN-ONSKIN-AUTONOMOUS-LOCAL-PRODUCT-29',
 'branch':git('branch','--show-current'),'head':HEAD,'tree':TREE,'porcelain':'','startingHead':START,'startingTree':START_TREE,
 'sourceCommits':3,'applicationSourcePushed':False,'all38':'UNACCEPTED','all18':'UNACCEPTED','release':'NO_GO',
 'J01':'Visible Pores only; positive admission closed','nextCampaign':'Do not begin before independent Brain audit'})
frozen={}
for n in ['contract.v1.json','contract.v2.json','matrix.v1.json','matrix.v2.json','precedence.v1.json','precedence.v2.json']:
 p='docs/release/full-app-j01/'+n;assert git('rev-parse',START+':'+p)==git('rev-parse',HEAD+':'+p)
 frozen[p]={'gitBlob':git('rev-parse',HEAD+':'+p),'unchangedFromEngineering28':True,'sha256':sha((R/p).read_bytes())}
putj('FROZEN_SCOPE_PRESERVATION.json',frozen)
matrix=json.loads((O.parent/'ENGINEERING28_EVIDENCE/raw/ALL38_ALL18_MATRIX.json').read_text())
matrix.update(sourceHead=HEAD,sourceTree=TREE,assessmentMethod='Engineering29 exact-source local tests, builds, browser journeys and bounded source review. E28 matrix blob fb05e9bbecc1557bced08269d5c38088a7c7a278 authenticated against immutable GitHub handoff. No formal or external acceptance.')
for row in matrix['rows']:
 row['existingTestsAndEvidence']='Current E29: root8708/584 uncached; privacy532/17, type/lint/builds and selected browser journeys. These are regression evidence, not qualification of every row. Inherited E28 evidence is historical at the immutable prior index; see TEST_EVIDENCE_INDEX.'
 if row['id']in ['F06','P03','V2-C05']:
  row['implementedBehavior']+=' E29 connects exact immutable template revision selection, explicit ordered roles mapped to the current trusted product projection or omitted, unshelved/unresolved refusal, immutable templateOrigin, encrypted intended issuance/readback/exact retry and received-history provenance. No actual-routine writer is added.'
  row['missingFunctionality']='Genuine original-owner ingestion and admitted source/custody/identity/licence/roster/grant adapters; lawful intended-to-actual owner transaction; durable unshelved proposal identity/resolution; lawful retained-template offboarding policy. Synthetic ports do not admit production.'
  row['remainingCodeWork']='Admit genuine source and serial custody separately before production connection; design lawful source-bound owner application and proposal lifecycle. Keep defaults503, no new product admission, and template reads closed after licence/billing retirement.'
 if row['id']in ['F06','F07','V2-C03','V2-C05','V2-C11']:
  row['implementedBehavior']+=' E29 adds read-only exact uncertain-apply inspection (current/historical/unknown/conflict) and repairs false no-apply copy plus delayed apply/clear/retraction cache rollback across navigation. Original request/predecessor and owner authority are retained; no use is inferred.'
 if row['id']=='P05':row['implementedBehavior']+=' E29 owner received-copy reports retain selected template provenance after staff access retires, under existing independent owner rights; no retained practice-library right is invented.'
for g in matrix['gates']:g['currentEvidence']+=' E29 local tests/builds/browser evidence grants no acceptance of this gate.'
assert len(matrix['rows'])==38 and len(matrix['gates'])==18 and all(x['formalAcceptance']=='UNACCEPTED'and not x['readyForIndependentAcceptance']for x in matrix['rows']+matrix['gates'])
putj('ALL38_ALL18_MATRIX.json',matrix)
lines=['# Engineering29 all38/all18 assessment','',f'Exact source `{HEAD}` / tree `{TREE}`. All38 REQUIRED rows and all18 gates remain **UNACCEPTED**, not ready for independent acceptance. Release NO_GO; frozen contracts unchanged; exactly J01 Visible Pores with positives closed.','']
for row in matrix['rows']:
 lines+=['## '+row['id']+' — '+row['name'],'']
 for label,key in [('Implemented','implementedBehavior'),('Missing','missingFunctionality'),('Evidence','existingTestsAndEvidence'),('Remaining code','remainingCodeWork'),('External qualification','externalQualificationDependencies')]:lines+=['- **'+label+':** '+row[key]]
 lines+=['- **Formal acceptance:** UNACCEPTED; not ready.','']
lines+=['## Independent gates','','| Gate | Formal status | Evidence and remaining dependency |','| --- | --- | --- |']
for g in matrix['gates']:lines+=['| '+g['id']+' | UNACCEPTED | '+g['currentEvidence']+' '+g['remainingDependency']+' |']
put('ALL38_ALL18_MATRIX.md','\n'.join(lines)+'\n')
put('FINAL_REPORT.md',f'''# Engineering29 local product checkpoint

Authorization BRAIN-ONSKIN-AUTONOMOUS-LOCAL-PRODUCT-29. Start `{START}` / `{START_TREE}`; final `{HEAD}` / `{TREE}`, clean on the existing stage/m1-native-runtime47 worktree. Three ordinary local source commits, no rewrite/reset/rebase/new application branch/worktree/PR. All38/all18 UNACCEPTED; release NO_GO. This is an engineering checkpoint, not completed-product or independent security acceptance.

## Product journeys and architecture

`d72248019d4b51580f0d4e306d1eb1492bcc3d8a` connects practice templates to the existing intended-plan editor. Explicit load checks current assigned client products and template authority in the same trusted serial transaction. Select an exact immutable revision, including an older active revision of a still-active family; never substitute the newest revision. Review each ordered AM/PM slot as a source product, explicit omission, unresolved or unshelved proposal. No role/name automatically implies ownership, equivalence or safety. Duplicate products within a phase, missing/changed source, invalid slots, changed context and retired families refuse. Unshelved/unresolved decisions are transient and block issuance; they create no Shelf product or durable proposal identity.

Cancel returns from review to mapping; abandoning mapping restores the pre-template draft. Detached controls and canceled reads cannot acquire successor reviews. Explicit issuance uses the existing current-source/predecessor/billing/capacity transaction and includes an immutable optional templateOrigin in the intended plan hash. Legacy plans preserve their exact fields/hashes; the new strict reader accepts only the explicitly enumerated legacy or provenance-bearing shape. The server derives provenance from current decoded template history and mapping, never accepts a client-supplied origin. Encrypted readback and unknown acknowledgement retry preserve the entire original command/mapping. Source/authority/family retirement refuses stale work; reload existing history before new intent. Received-copy and selected professional/owner/previsit reports preserve selected provenance without requiring fresh access to the practice library.

Original-owner server ingestion, genuine identity/licence/roster/grants and serial backend custody are still absent. Default production professional APIs remain503. The existing trusted product source is a port contract, not authenticity conferred by a hash or HTTP response. Local positive trust/key/serial ports and HTTP browser fixtures are explicitly synthetic. No genuine professional plan was admitted, no owner product was fabricated, and no personal actual-routine/use writer was connected. Template, intended plan, received copy, owner decision, applied routine and recorded use remain distinct.

Template read-only offboarding was investigated: template_author_issue is write-only and requires current licence plus verified write billing. No approved retained-copy/custodian right was supplied. E29 preserves that refusal for reads and writes and adds initial/final lifecycle negatives. Independent owner received copies use the pre-existing owner-rights contract after staff access retires; this does not grant retained practice-template access.

`f8a364c38533cbd15b81bd5f52ea37c87cdf4000` adds consumer uncertain-apply recovery and repairs stale publication. A reproduced committed apply with a lost acknowledgement, followed by a later version/stale retry, previously claimed that nothing from the review had applied. Errors now preserve uncertainty and expose an explicit observational outcome check. It requires original current owner/adult/health authority and compares the original command ID, date, predecessor hash, source hash, ordered facts and actor against authenticated saved history. Same-source data alone is insufficient. It reports a matching version as current-at-read or historical; absent, conflicting and unsupported evidence remains unknown and unchanged. The check neither creates a version nor records use, migrates keys, reconstructs predecessor proof or selects conflicting ciphertext.

A second RED reproduced delayed apply acknowledgement replacing a newer history cache after blur/refocus. Apply, clear and use-retraction retain their exact rendered decision and navigation epoch through completion. They refresh authenticated readers instead of assigning older commit results into the cache. A dispatched operation may have committed despite navigation; retiring the UI never claims to undo it. Inspection/new review/cancel/navigation/owner retirement fence late callbacks. Direct source-independent readback remains useful even when the old Shelf review is no longer applicable.

## Validation and retained failures

Final clean exact-source root:8708 tests/584 files (mobile7996/556, professional688/21, operator24/7),3tasks/0cached. Root typecheck and configured lint each4tasks/0cached PASS; types retains its existing no-lint placeholder. Consumer Expo web export and professional Vite build PASS. Focused owner/consent/crypto/key/photo/export/recovery/navigation/actual-outcome subset532/17 PASS. All full commands, timestamps, before/after identities, exits and complete log hashes are retained in CURRENT_RUN_RECEIPTS and CURRENT_ORIGINAL_INVENTORY.

Final real Edge mapping and Expo uncertain-outcome journeys pass375×667/390×844/430×932. Mapping uses real source UI/API/domain/encryption with synthetic trusted ports; consumer uses real onboarding, adult/consent choices, UI-entered synthetic Shelf data and real local encryption. Only before/after-commit acknowledgement faults are injected. Current key hashes and completion ciphertext remain unchanged by inspection. Keyboard,44px targets, no horizontal overflow, cancel, duplicate/unshelved/source conflicts, exact retry, reload and authority retirement are exercised. Consumer optional durable drafts/history regressions pass375/390/430; professional owner and material queue regressions pass375/430 with synthetic HTTP positives and real default503. These are not native, real provider/backend, physical device, scientific or full accessibility qualification.

Preserved failures: mapping-capability-red is a deliberate missing-module capability baseline (zero tests, not a demonstrated security defect); template-mapping-integration-pre exposed a mistaken new test import and was fixed to the real ownerReceivedPlanIndex without relaxing data assertions; mapping-browser had a new harness root-selector typo; r2 had an invalid quoted CSS selector. Their actual failure traces remain. Mapping-browser-r3 exposed real new template-retirement masking: the custody boundary turned a known refusal into503/unknown. template-retirement-status-red reproduced it; bounded content-free ProfessionalAccessError translation repairs it, with GREEN/browser-r4/final receipts. Arbitrary private/provider failures stay masked.

actual-outcome-red retains the false-no-apply defect; actual-navigation-ack-red retains the stale-cache defect. Separate GREEN, mounted original-authority tests and final root/browser receipts demonstrate the repairs. Clear/retraction late-ack siblings are also tested. No original protected assertion, timeout, skip or fixture authority was weakened. An initial clean-f8 queue browser regression failed before UI setup because its copied pure-domain list omitted new transitive template modules. b29e731097984be98f5b06024d11255dbb732809 adds those dependencies and moves server startup after fixture preparation under cleanup; all original queue assertions remain. Those failing375/430 receipts are retained, and every final check is repeated at the final clean three-commit checkpoint. There were no final root/type/lint/build failures. Expo reports its existing missing Sentry config, color warnings and forced clean process exit after a successful export; exit0 and the complete log are retained, without claiming native/runtime qualification. Trivial read-probe/path and evidence-helper quoting/preflight-assertion errors occurred before external mutation and are described in TOOLING_NOTES.

Intermediate browser runs are dirty-source observations; final clean-source runs are separate. The first mapping harness failure could not capture its section DOM because its selector was wrong; the complete exception/response/command/summary remains. No absent DOM or trace was invented. The first consumer browser did not check the actual content-key name; the final driver corrects that probe, asserts the real synthetic key exists and compares only its hash, never publishes key material. Screenshots are locally inspected and retained with original hashes; text publication omits binary PNGs while retaining actual DOM/state/network/command receipts.

## Scope and delivery

E23 outer-CAS/inner-event predecessor proof, E25 non-mutating reads, E27R focus semantics and E28 first-key/successor/navigation repairs remain unchanged and pass their negative tests. No Supabase/native/provider/payment/account configuration is changed. Protected Security/G97/DB/candidate29/SDK/Doctor/native findings remain unwaived. M1-03 remains unaccepted; M2-01 is not authorized; reserved native79–86 are unused. Exactly J01 Visible Pores remains in scope with positive counts/scores/physical measurements/change/clinical claims disabled.

Both exact patches verify forward and reverse using temporary indexes; the active source/index is preserved.151 raw commit objects authenticate150 ancestry links from published PR48; they do not prove signatures/authorship or security acceptance. Existing immutable E28 logs/native/external ledgers are linked instead of copied. Selected materials are screened before evidence-only publication. The publication parent/tree has no workflows, default workflow blobs/filters and visible hooks/rules are rechecked, and the absent-ref-only push cannot replace an existing branch. [skip ci] is supplementary. No application source push, PR change, hosted/manual CI, paid operation, native attempt, merge, deployment or release is initiated. All owned browser/server processes are stopped after validation. Complete remote API/raw byte/hash/reassembly/ancestry/tree/ref and all-event Actions verification follows before final delivery. No subsequent campaign begins before independent Brain audit.
''')
put('SECURITY_PRIVACY_REVIEW.md',f'''# Engineering29 bounded security/privacy review

Exact source `{HEAD}` / `{TREE}`. Ordinary source inspection and local synthetic tests only. [Inherited protected assessment]({OLD}SECURITY_PRIVACY_REVIEW.md) remains unwaived.

- Entry and current authority: template options require existing assigned owner read scope plus current practice template permission, AAL2/TOTP/membership/licence and verified write billing. Requests bind authenticated server context; client JSON/hash does not establish owner/source/provider authority. Initial denial precedes template payload reads; final authority, lifecycle, template/product history, predecessor, billing and capacity checks remain inside the same serial custody port. No new production adapter is installed.
- Review and confirmation: exact revision/hash and complete ordered slot decisions are captured. Unshelved/unresolved/missing/duplicate/conflicting products refuse; explicit omissions are retained. Server-built templateOrigin joins immutable plan integrity and exact retry. Retired-family/source/owner/grant/licence/billing changes refuse. No template imports client text or edits actual/use history.
- Custody/readback/history: existing encrypted workspace storage enforces immutable prefixes, owner/practice scope, exact writes and readback. Legacy plan hashes remain unchanged. Retained received-copy provenance uses the existing independent owner-rights policy, not new practice access. Reads do not provision missing aggregates or infer offboarding rights. No plaintext browser persistence, URLs or logs hold template/client text; generation/abort/background/session controls remain.
- Consumer uncertainty: observational inspection matches original ID/date/predecessor/owner/source/ordered facts. It never derives missing proof from current history, infers use, recreates keys or rewrites data. Current/historical outcomes are qualified at read time. Missing/unsupported/conflicting data remains unknown. Rendered decision and focus epochs fence delayed apply/clear/retraction results; normal readers refresh without older commit-result cache assignment.
- Preserved boundaries: E23 proof domains/schema2 refusal, E25 read-only key behavior, E27R/E28 navigation and first-key/successor preservation, photo/orphan provenance and withdrawal/export/deletion regressions pass in532 focused mobile tests and the8708 root run. No clinical/customer data or genuine provider/native key material was used. Default professional503, J01 positive closure and protected findings remain.

Remaining risks: genuine source/identity/licence/roster/grant/serial backend absent; browser eviction/forensic erasure and native process interruption/restore/multi-process CAS unqualified; lawful retained-template read/purge policy absent; arbitrary same-origin compromise is not solved by DOM/controller tests; human-authored generic titles cannot be proven free of private content by code. Scope is not formal Security/native/provider/clinical acceptance.
''')
put('OPEN_DEFECTS_AND_RELEASE_BLOCKERS.md',f'''# Open functionality and qualification

All38/all18 UNACCEPTED; release NO_GO. [Historical blockers/failures]({OLD}OPEN_DEFECTS_AND_RELEASE_BLOCKERS.md) remain. Current demonstrated defects and repairs are in FINAL_REPORT and complete RED/GREEN logs.

| Gap | Current behavior | Required next action |
| --- | --- | --- |
| Genuine owner ingress and actual application | Real application unavailable; local template→intended bridge depends on separately admitted trusted source ports | Authenticate immutable original-owner source and lawful source-bound owner transaction; no source authority from JSON/hash |
| Unshelved lifecycle | Explicit transient unshelved/unresolved decisions block issuance and create no product | Approved source-bound durable proposal identity, owner review, duplicate/archive/replacement/conflict resolution |
| Template offboarding | Reads and writes fail closed after licence/billing retirement; history preserved | Legal/owner/custodian retained-copy purpose and purge/read model before any new role |
| P04 staff operations | Existing queue/response linkage preserved; no fictional named staff or message delivery | Genuine roster/grants/original-event source, staffing/calendar/digest/delivery authority |
| Missing/corrupt source/custody | Explicit unavailable, no read-side provisioning | Genuine serial driver, keys, original lifecycle/source data and authorized provisioning |
| Uncertain apply after process loss | In-memory exact inspection works; reload exposes retained history without inventing original request proof | Optional durable recovery intent only with a reviewed original-predecessor protocol; no inference from current history |
| Orphan/legacy/private-key recovery | Ambiguous bytes and schema2/unprovable histories preserved | Authentic recovery/deletion authority and physical custody evidence |
| Protected/native/J01/external | Security/G97/candidate29/DB/SDK/Doctor/native unwaived; M1-03 unaccepted, M2-01 unauthorized,79–86 unused | Original custodians; genuine rights/science/optics/devices/providers/payments/Apple/funded operations and independent acceptance |

No final test/build failure remains. Browser and unit evidence is local/synthetic, not real professional admission, native accessibility or release evidence. No timeout or protected assertion was relaxed.
''')
put('NATIVE_AND_EXTERNAL_QUALIFICATION.md',f'''# Native and external qualification ledger

All38/all18 UNACCEPTED; release NO_GO. [Immutable E28 ledger]({OLD}NATIVE_AND_EXTERNAL_QUALIFICATION.md) and earlier protected findings remain authoritative historical limits.

| Area | E29 operation/result | Formal status |
| --- | --- | --- |
| Native/macOS/signing/devices | NOT_RUN; no new attempt, including79–86 | UNACCEPTED |
| Security/G97/candidate29/DB/SDK/Doctor/M1-03 | Existing findings unwaived; no protected hosted scanner/DB acceptance run | UNACCEPTED |
| M2-01 | No implementation/admission bypass | NOT_AUTHORIZED |
| Genuine professional/provider/custody | No activation/configuration/real records; default503 | UNACCEPTED |
| Billing/payment/accounts | No new spending, account, licence, credential or billing operation | UNACCEPTED |
| J01 Visible Pores | Only assessment scope; all positive claims remain closed | UNACCEPTED |
| Local tests/builds/browser | Passed bounded synthetic engineering checks; no physical/native/VoiceOver inference | Not formal qualification |
| Release/Apple/public operations | No merge, deployment, App Store action or release | NO_GO / NOT_AUTHORIZED |
| GitHub publication | Screened evidence-only branch; no source/PR/main mutation or hosted trigger | Review transport only |

Founder retains accounts/spending/merges/final release. Independent Brain retains technical acceptance and release-readiness decisions.
''')
put('BRAIN_NEXT_DECISION.md',f'''# Independent Brain continuation and next decision

Audit `{HEAD}` / `{TREE}` on existing stage/m1-native-runtime47. Verify both patches, temporary-index forward/reverse trees,151 raw objects/150 parent links, manifests, current logs and retained RED traces. Prior immutable checkpoint: [E28]({OLD}README.md). No subsequent campaign begins before this audit.

1. Review exact template revision linkage, ordered source-product/omission decisions, strict optional provenance shape, immutable encrypted history, source/authority/family retirement and unknown retry. Verify unshelved/unresolved choices cannot issue or create products. Positive test ports/HTTP responses are synthetic, never authenticated original-owner ingestion.
2. Review the consumer false-no-apply RED and navigation/cache-rollback RED. Verify exact original predecessor/ID/facts are needed for observational reconciliation, historical readback never implies current application/use, and delayed apply/clear/retraction/inspection results cannot replace newer state. Preserve E23/E25/E27R/E28 negative boundaries.
3. Next productive local work: durable source-bound unshelved proposal/owner review contracts and exact received-to-actual review/refusal, only after tracing available authentic ports. Keep real application closed if original-owner provenance/writer is absent. Improve durable unknown-intent recovery only with original predecessor evidence, never reconstruct it from current history.
4. Establish lawful template retained-copy/offboarding purposes with owner/custodian/legal approval before changing licence/billing read access. Independently admit genuine identity/licence/roster/grants/serial backend/source adapters before production. P04 assignment/digests/delivery require actual roster/operational authority.
5. Continue supported-viewport keyboard/focus/recovery work; physical native/accessibility, protected Security/DB, J01 science/rights/optics, provider/payment/Apple and funded operations remain separate dependencies. M1-03 unaccepted; M2-01 unauthorized;79–86 unused; all38/all18 UNACCEPTED and NO_GO.

Future source work must independently verify exact clean starting HEAD/tree/branch, ancestry and writer exclusivity without reset/rebase/adopting different source. Keep the existing worktree/PR48. Evidence-only publication confers no source push, paid/native/hosted/release authority.
''')
put('TEST_EVIDENCE_INDEX.md',f'''# Engineering29 actual validation index

Final clean source `{HEAD}` / `{TREE}`. CURRENT_RUN_RECEIPTS pins exact argv, timestamps, before/after source identity, exit, original log size/SHA256. CURRENT_ORIGINAL_INVENTORY pins every selected original text/binary file; manifest shards declare sanitization and exact ordered parts. [Historical E28 tests/failures]({OLD}TEST_EVIDENCE_INDEX.md) are referenced, not claimed as rerun.

| Final check | Actual result | Receipt/log |
| --- | --- | --- |
| Complete uncached root |8708/584; mobile7996/556, professional688/21, operator24/7;3tasks/0cached |current/root-tests-final2.json/log (ordered parts) |
| Root typecheck |4tasks/0cached PASS |current/typecheck-final2.json/log |
| Configured root lint |4tasks/0cached PASS; types existing no-lint placeholder |current/lint-final2.json/log |
| Consumer Expo web export |PASS, no install; existing forced exit warning after completed export retained |current/consumer-build-final2.json/log |
| Professional Vite build |PASS |current/professional-build-final2.json/log |
| Focused owner/consent/crypto/key/photo/export/recovery/navigation/outcomes |532/17 PASS |current/privacy-focused-final2.json/log |
| Template mapping source UI/API/domain/encryption |375×667/390×844/430×932 PASS; synthetic trust/key/serial ports |current/mapping-browser-final2/ and command receipt |
| Consumer uncertain actual apply |375×667/390×844/430×932 PASS; actual local encrypted stores/onboarding, synthetic acknowledgement faults |current/outcome-browser-final2/ and command receipt |
| Consumer optional history/durable drafts |375×667/390×844/430×932 PASS |current/optional-browser-final/ and command receipt |
| Professional independent owner / queue regressions |375×667/430×932 PASS; synthetic HTTP positives, real default503 |current/professional-final/; professional-owner/queue375/430-final receipts |

New mapping tests include exact immutable revision, ordered source mapping/omissions, duplicate/missing/conflicting/retired choice refusal, unshelved/unresolved absence of writes, current+final role/licence/grant/health/owner/billing changes, identical unknown retry and independent received-copy provenance. Consumer tests retain real source/store/encryption and compare exact byte maps across inspection, missing/unsupported reads, cancellation, same-owner/owner/navigation retirement and newer history after delayed apply/clear/retraction.

RED evidence: current/actual-outcome-red.log (false no-apply claim), current/actual-navigation-ack-red.log (older cache replaces newer after blur/refocus), current/template-retirement-status-red.log and mapping-browser-r3/FAILURE-TRACE (known template retirement incorrectly unknown). Separate GREEN logs and final clean root/browser results remain. mapping-capability-red is a missing-module capability baseline; integration-pre and mapping-browser/r2 are disclosed new-harness/import errors, not security findings. No original assertion/fixture/timeout/skip was relaxed. First mapping failure has no section DOM due its invalid selector, and the initial consumer browser's wrong key-name probe is superseded by the final corrected actual-key hash check.

All owned servers/browsers are stopped after runs. Screenshots are inspected locally and omitted from UTF-8 publication with exact original hashes; actual DOM/state/response/command records remain. None of this is physical-device, genuine backend/provider/native, protected security, J01 scientific, whole-app VoiceOver or release qualification.
''')
put('TOOLING_NOTES.md','''# Tooling and evidence limitations

Read-only inspection probes initially used several nonexistent historical paths and one unquoted PowerShell HEAD^{tree}; the quoted independent command confirmed the expected tree before source edits. Some process command lines were OS-inaccessible; app task status, Desktop Commander sessions, Git locks and repeated clean identity supplied bounded writer observations, not an OS-wide lock.

A long inline Python evidence-helper preparation command failed shell quoting before execution; the helper was written as a file instead. A string replacement accidentally formed a tuple key in the first read-only publication preflight; the assertion failed before any publication mutation. The corrected helper/preflight is retained. No failed preflight was bypassed and no existing ref was overwritten.

All actual test/browser failures have their original retained logs/traces. The first mapping harness root-selector failure could not capture its section DOM. No missing screenshot/DOM/trace is reconstructed. Dirty intermediate source receipts do not authenticate every intermediate byte; final clean receipts and exact patches authenticate the delivered checkpoint.
''')
print(json.dumps({'reportsWritten':True,'requiredFinalReceipts':required,'selectedOriginalFiles':len(inventory),'commandReceipts':len(receipts),'all38':38,'all18':18},indent=2))
