import json, re
from pathlib import Path
out=Path(__file__).resolve().parent
matrix=json.loads((out.parent/'ENGINEERING19_EVIDENCE/ALL38_ALL18_MATRIX.json').read_text())
matrix['assessment']='Engineering20 source implementation assessment only; inherited rows explicitly identified; no formal acceptance'
updates={
 'F02':['Durable drafts now require current adult/owner/consent/persisted epoch before payload reads; rights export and actual withdrawal cleanup are covered.','Genuine accounts, hosted custody/deletion and native device qualification remain absent.'],
 'F03':['Connected explicitly saved encrypted bottle transcription with restart/resume/source review/confirmation/discard inventory is implemented.','Manual intake and optional corrections remain memory-only; admitted OCR/catalog sources and physical capture remain absent.'],
 'V2-C01':['Purpose-bound draft encryption, original authority/CAS, paused-processing owner export, withdrawal retry/drain and unknown-key refusal are locally verified.','Real authentication, backend custody/rights execution, native durability and independent security gates remain open.'],
 'V2-C02':['Exact bottle identity and saved-source revision bind durable unconfirmed transcription; review is mandatory on resume and observation needs explicit confirmation.','Manual/opened intake draft persistence, authentic OCR source admission and physical capture remain incomplete.'],
 'V2-C11':['Saved-draft recovery inventory and refusal states are connected; keyboard/focus and viewport checks passed for exercised local branches.','Native accessibility, wider device/text-scale coverage, older ungated web contexts and other draft types remain open.'],
 'P04':['Current authorized reconciliation projection links exact intended versions to latest owner acknowledgement/decline while preserving historical closure; real API stays closed.','Unfinished code includes named assignments/staff coverage, calendar/backlog, digests and genuine original-record/delivered-response integration. Genuine professional identity/licensing, staff/provider custody, backend authority, hosted operations and formal acceptance also remain absent.']}
for row in matrix['rows']:
    row['formalAcceptance']='UNACCEPTED';row['ownerAdmitted']=False
    if row['id']=='V2-C07': row['assessmentColumns'][2]=row['assessmentColumns'][2].replace('durable draft journeys remain missing','private capture, manual intake and optional correction draft persistence remain missing; durable bottle transcription is now implemented within its documented local scope')
    row['engineering20Evidence']='Full local root regression; no new external/native/clinical qualification. Unchanged implementation details inherited from Engineering19 assessment.'
    if row['id'] in updates:
        row['assessmentColumns'][1:3]=updates[row['id']]
        row['assessmentColumns'][3]='Engineering20 ordinary defensive/source tests and connected synthetic local browser flow; see VERIFICATION_SUMMARY.json.'
        row['engineering20Evidence']='Changed in this checkpoint; see session patch and final verification receipts.'
for gate in matrix['gates']:
    gate['formalAcceptance']='UNACCEPTED';gate['admitted']=False
    gate['engineering20LocalEvidence']='Local engineering evidence only. No protected acceptance or real operational qualification performed.'
assert len(matrix['rows'])==38 and len(matrix['gates'])==18
(out/'ALL38_ALL18_MATRIX.json').write_text(json.dumps(matrix,indent=2),encoding='utf-8')
lines=['# All38 implementation assessment and all18 acceptance gates','', 'Every row remains formally UNACCEPTED. Release NO_GO. Unchanged implementation assessments are inherited Engineering19 findings, with Engineering20 full local regression; this is not a new audit or acceptance of each external requirement.','', '| ID | Requirement | Local implementation assessment | Unfinished implementation / external dependencies | Formal state |','|---|---|---|---|---|']
for row in matrix['rows']:
    c=row['assessmentColumns'];lines.append('| '+' | '.join([row['id'],row['name'],c[1],c[2]+' '+c[4],'UNACCEPTED'])+' |')
lines+=['','| Gate | Owner | Required evidence still outstanding | Formal state |','|---|---|---|---|']
for gate in matrix['gates']: lines.append('| '+' | '.join([gate['id'],gate['owner'],gate['acceptance'],'UNACCEPTED'])+' |')
(out/'ALL38_ALL18_MATRIX.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
labels=['final-root-tests-r4','final-root-types-r3','final-root-lint-r2','checkpoint-consumer-build','committed-professional-build','draft-rights-tests','full-suite-fixture-regressions-r2','professional-response-tests','bottle-browser-final','professional-browser-final-375','professional-browser-final-430']
receipts=[json.loads((out/(label+'.json')).read_text()) for label in labels]
assert all(r['exit']==0 for r in receipts)
log=(out/'final-root-tests-r4.log').read_text(encoding='utf-8',errors='replace')
counts=[int(n) for n in re.findall(r'Tests\s+(\d+) passed',log)];assert sum(counts)==8407,counts
summary={'scope':'Local synthetic/source verification only','totalUncachedTests':sum(counts),'mobile':7732,'professional':651,'operator':24,'cachedTasks':0,
 'finalSourceHead':'4dce84e20a71f19c60c16c7682e683bb512363ed','finalSourceTree':'9d61cabdc11cff36577e4e7aa94b00ca4a95f393',
 'receipts':receipts,'sourceIdentityNote':'Final tests/typecheck/consumer build bind final HEAD. Earlier browser/lint receipts bind951ec0f; the only subsequent source delta is an erased Set<string> test type annotation. Professional build binds60cf68e, followed only by test/docs changes. Runtime files are identical.',
 'limitations':['Not native/physical-device validation','No real providers/backend/professional authority','No protected security or acceptance gate qualification','Web lock excludes older nonparticipating builds','No crash/fsync or multiple-native-process qualification']}
(out/'VERIFICATION_SUMMARY.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
print(json.dumps({'requirements':38,'gates':18,'tests':sum(counts),'checks':len(receipts)}))
