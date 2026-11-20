import json
import base64
import urllib.parse
import urllib.request
from run import OUT, identity, now, sha, write
from publication import client, BRANCH, PREFIX

api=client();source=identity();assert not source['status']
objects=json.loads((OUT/'PUBLICATION_OBJECTS.json').read_text());first=objects['commit']
verified=json.loads((OUT/'REMOTE_VERIFICATION.json').read_text())
assert verified['evidenceCommit']==first and verified['source']==source and verified['workflowFree']
assert api('git/ref/heads/'+BRANCH)['object']['sha']==first
base=api('git/commits/'+first);old=api('git/trees/'+base['tree']['sha']+'?recursive=1');assert not old['truncated']
assert not any(r['path'].startswith('.github/workflows/') for r in old['tree'])
root='https://github.com/TasfiqJ/onSkin/blob/'+first+'/'+PREFIX
ancestry=json.loads((OUT/'ANCESTRY_VERIFICATION_FINAL2.json').read_text())
initial=json.loads((OUT/'INITIAL_PREFLIGHT.json').read_text())['source']
report=(OUT/'CORRECTED_REPORT.md').read_text(encoding='utf-8')
import re
count=re.search(r"passed \*\*([\d,]+) tests",report).group(1)
index=f'''# Engineering32 immutable evidence index

**COMPLETE_LOCAL_CANDIDATE. All38/all18 UNACCEPTED; release NO_GO.** Independent Brain review is required before Engineering33, acceptance or release.

Starting HEAD `{initial['head']}`, tree `{initial['tree']}`. Final local HEAD `{source['head']}`, tree `{source['tree']}`, branch `stage/m1-native-runtime47`; clean and unpushed. Append-only local history, PR48, main and all prior evidence remain preserved.

Payload commit `{first}` was independently re-downloaded through public raw URLs. Every manifest-listed payload byte/ordered part, both forward/reverse exact patch trees and {ancestry['objects']} raw Git commit objects/{ancestry['edges']} parent relationships verified. The workflow-free addendum adds this index and the readback receipt without changing the payload. Final ref/zero-Actions checks are retained in POSTPUBLICATION_FINAL.json locally and summarized in the return.

- [Complete report, results and limitations]({root}README.md)
- [Root-cause account and retained-failure distinctions]({root}ROOT_CAUSE.md)
- [Exact clean source identity]({root}FINAL_IDENTITY.json), [final command receipts]({root}FINAL_RECEIPTS.json), [all execution receipts]({root}ALL_EXECUTION_RECEIPTS.json)
- [Readable runtime matrices]({root}RUNTIME_MATRIX.md), [declared-series history]({root}DECLARED_SERIES_HISTORY.json), [finite runtime and connected repeat outcomes]({root}RUNTIME_DURABLE_RESULTS.json), [original declaration]({root}FINAL_REPEAT_DECLARATION.json), [final finite declaration]({root}FINAL_REPEAT_DECLARATION3.json)
- [Production-export history/cache ownership result]({root}STATIC_CACHE_RESULT.json)
- [Crash/deletion matrix]({root}CRASH_MATRIX.md), [changed privacy/lifecycle inventory]({root}SECURITY_PRIVACY_LIFECYCLE.md)
- [All38/all18 observational assessment]({root}ALL38_ALL18.md), [unchanged frozen contracts]({root}FROZEN_CONTRACTS.json)
- [Ordered exact cumulative PR48/session patch and ancestry parts]({root}PARTS_INDEX.json), [patch bytes/hashes/forward-reverse trees]({root}PATCH_VERIFICATION.json), [intermediate source patch inventory]({root}LOCAL_COMMIT_PATCHES_FINAL.json)
- [Raw offline ancestry verifier]({root}verify_ancestry.py), [bundle/parts verifier]({root}verify_bundle.py), [SHA256 manifest]({root}MANIFEST.json) and [readable manifest views]({root}MANIFEST_VIEWS.json)
- [Changed files/commits]({root}CHANGED_FILES.json), [publication screening]({root}PUBLICATION_SCREEN.json)
- [Native screenshot previews](SCREENSHOT_PREVIEWS.md) and [selected encoded screenshots with decode hashes]({root}SCREENSHOTS.json), [visual review]({root}VISUAL_REVIEW.json)
- [Unchanged Engineering31 evidence](https://github.com/TasfiqJ/onSkin/blob/ef15a0d9a435016c9f8e389ed4bc10237ae153f4/evidence/engineering31-review-2026-11-19/FINAL_INDEX.md)
- [Self-contained continuation instructions]({root}NEXT_SESSION.md)
- [Public-byte/ref/Actions readback receipt](REMOTE_VERIFICATION.json)

Ordinary committed driver: three unassisted fresh sessions per required viewport375×667/390×844/430×932; no operator retry helper. Dedicated runtime: nine fresh-profile cells, one request per document; induced real-tab refusal and its one explicit visible Retry remain separate. Every final committed-driver cell force-restarts apply, clear and retraction with canonical source ciphertext equality, then actual withdrawal/restart. Engineering31's29 supervisor Retry actions remain **externally assisted**, not reclassified.

Durable owner-reviewed original-command evidence precedes dispatch; no startup replay. Inspection is read-only. Explicit apply retry reacquires the approved live source proof; persisted JSON never becomes authority. Acknowledgement retains bounded inspect-only evidence. Routine/ledger/lifecycle/consent/source use eight fixed encrypted browser rows, including original canonical routine source stores; withdrawal audits successor erasure while closed. The report retains command/ledger/withdrawal rollback failures and focus/driver corrections.

Final uncached root {count} tests passed; root typecheck/configured lint/both builds and relevant privacy/owner/consent/source/intake/routine/brief/Diary suites passed. Local Edge/Expo, synthetic owners/bridge/native ports provide no installed-device, physical power-loss, provider/backend/professional/scientific qualification. J01 Visible Pores only; positive science closed, M1-03 unaccepted, M2-01 unauthorized, protected findings unwaived.

Zero paid/hosted/native/source-push operations, new application PRs, account/backend changes, merges, deployments or release actions. Only the separate workflow-free evidence branch was published. No Engineering33 work was started.
'''
files={'REMOTE_VERIFICATION.json':(json.dumps(verified,separators=(',',':'))+'\n').encode(),'FINAL_INDEX.md':index.encode()}
full_receipt=files['REMOTE_VERIFICATION.json']
if len(full_receipt)>220000:
    part_names=[]
    for i in range(0,len(full_receipt),220000):
        name=f'REMOTE_VERIFICATION.full.{i//220000+1:03d}.txt';files[name]=full_receipt[i:i+220000];part_names.append(name)
    summary={k:v for k,v in verified.items() if k!='files'}
    summary.update(verifiedPayloadFileCount=len(verified['files']),fullReceipt=dict(parts=part_names,bytes=len(full_receipt),sha256=sha(full_receipt),reconstruct='Concatenate UTF-8 part bytes in the exact listed order.'))
    files['REMOTE_VERIFICATION.json']=(json.dumps(summary,indent=2)+'\n').encode()
# Only synthetic reviewed UI screenshots; no browser profiles or keys.
preview_paths=[OUT/'final-acceptance3-connected-r1-browser'/f'{width}x{height}-restart-original-not-found.png' for width,height in [(375,667),(390,844),(430,932)]]
preview_paths.append(OUT/'final-acceptance3-connected-r1-browser/375x667-withdrawal-erased.png')
previews='# Synthetic browser screenshot previews\n\n'
for p in preview_paths:
    files['previews/'+p.name]=p.read_bytes()
    previews+=f'![{p.stem}](previews/{p.name})\n\n'
files['SCREENSHOT_PREVIEWS.md']=previews.encode()
import importlib.util
spec=importlib.util.spec_from_file_location('screen_addendum',OUT.parent/'ENGINEERING30_EVIDENCE_20261119/package.py');screen=importlib.util.module_from_spec(spec);spec.loader.exec_module(screen)
assert not any(screen.matches(data.decode()) for name,data in files.items() if not name.endswith('.png')),'Unexpected signature in addendum'
manifest=dict(at=now(),payloadCommit=first,payloadManifestSha256=sha((OUT/'stage2'/PREFIX/'MANIFEST.json').read_bytes()),
  files=[dict(path=name,bytes=len(data),sha256=sha(data)) for name,data in sorted(files.items())],manifestExcludesItself=True)
files['ADDENDUM_MANIFEST.json']=(json.dumps(manifest,indent=2)+'\n').encode();assert all(len(v)<=245760 for v in files.values())
entries=[]
for name,data in sorted(files.items()):
    if name.endswith('.png'):
        blob=api('git/blobs',dict(content=base64.b64encode(data).decode(),encoding='base64'));entries.append(dict(path=PREFIX+name,mode='100644',type='blob',sha=blob['sha']))
    else:entries.append(dict(path=PREFIX+name,mode='100644',type='blob',content=data.decode()))
tree=api('git/trees',dict(base_tree=base['tree']['sha'],tree=entries));actual=api('git/trees/'+tree['sha']+'?recursive=1');assert not actual['truncated']
before={r['path']:r['sha'] for r in old['tree'] if r['type']=='blob'};after={r['path']:r['sha'] for r in actual['tree'] if r['type']=='blob'}
assert set(after)==set(before)|{PREFIX+name for name in files} and all(after[k]==v for k,v in before.items())
assert not any(p.startswith('.github/workflows/') for p in after) and identity()==source
commit=api('git/commits',dict(message='[skip ci] Verify Engineering32 immutable evidence and zero Actions',tree=tree['sha'],parents=[first]))
assert api('git/ref/heads/'+BRANCH)['object']['sha']==first
ref=api('git/refs/heads/'+BRANCH,dict(sha=commit['sha'],force=False),method='PATCH');assert ref['object']['sha']==commit['sha']
checks=[]
for name,data in sorted(files.items()):
    url='https://raw.githubusercontent.com/TasfiqJ/onSkin/'+commit['sha']+'/'+PREFIX+name
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'onSkin-E32-final-readback'}),timeout=30) as response:actual=response.read()
    assert actual==data;checks.append(dict(path=name,bytes=len(actual),sha256=sha(actual)))
actions={}
for key,query in [('payload','head_sha='+first),('final','head_sha='+commit['sha']),('branch','branch='+urllib.parse.quote(BRANCH,safe=''))]:
    value=api('actions/runs?'+query+'&per_page=100');assert value['total_count']==0 and value['workflow_runs']==[];actions[key]=dict(totalCount=0,runs=[])
preserved={}
for name,expected in json.loads((OUT/'preflight-final4.json').read_text())['preservedRefs'].items():
    if name in ('pr48','archiveTag'):continue
    observed=api('git/ref/heads/'+name)['object']['sha'];assert observed==expected;preserved[name]=observed
pr=api('pulls/48');assert pr['head']['sha']=='d292743c99c1fb98f5714789f4fd60fb1e7d5a5d' and pr['draft'] and pr['state']=='open'
assert identity()==source
write('POSTPUBLICATION_FINAL.json',dict(at=now(),payloadCommit=first,finalEvidenceCommit=commit['sha'],tree=tree['sha'],branch=BRANCH,
  index='https://github.com/TasfiqJ/onSkin/blob/'+commit['sha']+'/'+PREFIX+'FINAL_INDEX.md',addendumFiles=checks,actions=actions,
  preservedRefs=preserved,pr48=dict(head=pr['head']['sha'],draft=True,state='open'),source=source,applicationSourcePush=False,hostedDispatches=0,paidOperationsInitiated=0,nativeAttempts=0,releaseActions=0))
print(json.dumps(dict(commit=commit['sha'],payload=first,index='https://github.com/TasfiqJ/onSkin/blob/'+commit['sha']+'/'+PREFIX+'FINAL_INDEX.md',zeroActions=True,protectedRefsPreserved=True)))
