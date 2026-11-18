import collections, hashlib, json, math, re
from pathlib import Path

O=Path(__file__).resolve().parent; RAW=O/'raw'; D=O/'stage/evidence/engineering28-review-2026-11-18'; LIMIT=245760
def sha(b):return hashlib.sha256(b).hexdigest()
def jb(v):return(json.dumps(v,indent=2,ensure_ascii=False)+'\n').encode()
scan=json.loads((O/'audit/SCAN_MATCHES.json').read_text())
assert scan['allRawIdentitiesAlreadyPublicInPR48']
for hit in scan['hits']:
 assert hit['kind']=='email',hit
 line=(RAW/hit['path']).read_text(encoding='utf-8').splitlines()[hit['line']-1]
 assert 'example.invalid'in line and 'Buffer.from('in line,hit
assert not D.exists();D.mkdir(parents=True);records=[]
def put(name,b):
 b.decode('utf-8');assert len(b)<=LIMIT and b'\0'not in b,(name,len(b));p=D/name;assert not p.exists(),name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
def sanitize(b):
 s=b.decode('utf-8');counts={}
 for key,pattern,replacement in [('homePaths',r'(?i)C:(?:\\{1,2}|/)Users(?:\\{1,2}|/)jasim\b','[LOCAL_USER_HOME]'),('hostName',r'\bSLEEPY\b','[LOCAL_HOST]'),('browserProfiles',r'onskin-(?:e\d+[-\w]*|template28|queue|owner|authoring|evidence|recovery)-[A-Za-z0-9]{6,}','[TEMP_BROWSER_PROFILE]'),('terminalEscapes',r'\x1b\[[0-?]*[ -/]*[@-~]','')]:
  s,n=re.subn(pattern,replacement,s);counts[key]=n
 return s.encode(),counts
def add(name,b,exact=False,generated=False):
 pub,changes=(b,{})if exact or generated else sanitize(b);parts=[];offset=0
 while offset<len(pub):
  end=min(offset+LIMIT,len(pub))
  if end<len(pub):
   newline=pub.rfind(b'\n',offset+LIMIT//2,end)
   if newline>=0:end=newline+1
   else:
    while end>offset and pub[end]&0xc0==0x80:end-=1
  parts.append(pub[offset:end]);offset=end
 if not parts:parts=[b'']
 split=len(parts)>1 or name.startswith('patches/');rows=[]
 for i,part in enumerate(parts,1):
  n=name+f'.parts/part-{i:03}.txt'if split else name;put(n,part);rows.append(dict(order=i,path=n,bytes=len(part),sha256=sha(part)))
 records.append(dict(logicalPath=name,sourceBytes=len(b),sourceSha256=sha(b),publishedBytes=len(pub),publishedSha256=sha(pub),byteExact=b==pub,sanitization=changes,parts=rows))
for p in sorted(RAW.rglob('*')):
 if p.is_file():
  name=p.relative_to(RAW).as_posix();add(name,p.read_bytes(),exact=name.startswith('patches/')or name=='COMMIT_ANCESTRY_WITNESS.json')
safety={'checkedAt':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),'selectedUtf8FilesScanned':scan['files'],'credentialPatternMatches':0,'emailMatches':len(scan['hits']),'emailDisposition':'Only existing synthetic EXIF example.invalid fixture in exact cumulative patch; not real customer/device data.','rawCommitIdentityCount':scan['rawCommitIdentityCount'],'rawIdentitiesAlreadyPublicInPR48':True,'manualReview':'Source patches and every selected document/log/DOM/command receipt screened. All browser/port records are explicitly synthetic. No clinical image/customer record/credential/device secret or raw protected scanner match selected. Binary screenshots omitted with exact inventory hashes. Generic role-template data has no client import. No credential liveness probes.','sanitization':dict(sum((collections.Counter(r['sanitization'])for r in records),collections.Counter())),'exactPreservation':'Both source patches and raw commit-object witness retain exact bytes; no secret-bearing patch match requires alteration.','limitations':'Bounded selected-material review, not protected whole-history security acceptance. Some intermediate failure receipts are dirty/HEAD-changing; actual identities and r2 case-collision limitation retained.','zeroCostPublication':'No workflows in evidence parent/tree; unchanged main-only push filters; no create/indirect triggers, visible repository hooks/rules or local pre-push hook. No PR/dispatch/source push/native/paid/LFS operation. Rechecked immediately before push; postpush all-event Actions/API readback required.'}
add('PUBLICATION_SAFETY_REVIEW.json',jb(safety),generated=True)
add('PUBLICATION_SAFETY_REVIEW.md',b'''# Publication screening

All selected UTF-8 documents, logs, exact source patches and decoded commit identities were screened. No credential/private-key/token/device-secret pattern was found. The only email match is the existing synthetic example.invalid EXIF fixture in the cumulative patch. Synthetic test coordinates/UUIDs are not real customer/device records. No clinical images, real records, private scanner findings or credential material were selected.

Derived text declares home/host/browser-profile/terminal-escape sanitization with separate original and published hashes. Exact cumulative/session patches and raw commit-object witness are unmodified. Binary screenshots are omitted with original size/SHA256 inventories; actual DOM/state/network/command receipts remain. Build assets are not published. This is a bounded material screen, not protected Security acceptance.

Read publication/GITHUB_RECHECK.json for actual workflow/ref/hook safeguards. Evidence parent/tree contains no workflows; existing default-main push filters only main and has no create/indirect trigger. No source push, PR, hosted/manual CI, paid/native/provider/account/LFS operation is initiated. A fresh recheck precedes the absent-ref-only push; complete API/raw readback and all-event Actions observations follow before final delivery. Previous source/main/PR48/evidence refs remain unchanged.
''',generated=True)
patches=[r for r in records if r['logicalPath'].startswith('patches/')]
lines=['# Exact source patches','','Concatenate raw UTF-8 part bytes in order with no added newlines. MANIFEST and verify_evidence.py reconstruct complete files; verify_trees.py checks both forward/reverse exact Git trees using temporary indexes.','']
for r in patches:
 lines+=['## '+r['logicalPath'],'',f"Exact bytes {r['sourceBytes']}; SHA256 `{r['sourceSha256']}`.",'']
 for p in r['parts']:lines+=[f"- Part {p['order']}: [{p['path']}]({p['path']}) — {p['bytes']} bytes, SHA256 `{p['sha256']}`."]
 lines+=['']
add('PATCH_INDEX.md',('\n'.join(lines)+'\n').encode(),generated=True)
originals=list(records);pages=[]
for start in range(0,len(originals),60):
 name=f'indexes/FILES-{start//60+1:03}.md';pages.append(name)
 lines=['# Readable payload index','','Original and published byte hashes are in MANIFEST shards. Every ordered part is linked; no text log or patch is truncated.','']
 for r in originals[start:start+60]:
  lines+=['## '+r['logicalPath'],'',f"Original {r['sourceBytes']} bytes / SHA256 `{r['sourceSha256']}`. Published {r['publishedBytes']} bytes / SHA256 `{r['publishedSha256']}`. Exact: {str(r['byteExact']).lower()}.",'']
  for p in r['parts']:lines+=[f"- [{p['path']}](../{p['path']}) — order {p['order']}, {p['bytes']} bytes, SHA256 `{p['sha256']}`."]
  lines+=['']
 add(name,('\n'.join(lines)+'\n').encode(),generated=True)
add('FILE_INDEX.md',('# Complete readable payload\n\n'+''.join(f'- [{name}]({name})\n'for name in pages)+'\nEvery selected log, receipt, report, script, state file and split part is linked here. Manifest shards below authenticate every published file including these indexes.\n').encode(),generated=True)
add('README.md',b'''# Engineering28 local product checkpoint

Authorization BRAIN-ONSKIN-AUTONOMOUS-LOCAL-PRODUCT-28. Final clean source `1962b44aec384545638f4aaede36ac64ef31aebe`, tree `ad97b496949cdaae0cbfe5d8c778b3c54576e14f`, existing branch stage/m1-native-runtime47. Start Engineering27R `efd3af803a2a71bd2fdd644ecfd500c619fb996c` / `83670a073910a840c69368f1760d5cb59d021054`. Four local source commits; no application-source push or PR/main change.

Practice-only immutable template library with review/cancel/revision/copy/retirement/encrypted reload/exact uncertain retry; original-authority first-key creation and successor preservation; actual navigation blur/refocus retirement of collapsed optional entries; maintained consumer browser driver aligned with collapsed UI. Original-owner application, unshelved mapping, live professional admission and external qualification remain unavailable. Default production API503 remains. All38/all18 UNACCEPTED, release NO_GO, exactly J01 Visible Pores with positives closed.

Final clean-source validation:8674 tests/582files,479 focused privacy cases, root typecheck/lint and both web builds PASS. Consumer optional recovery375/390/430, professional template/owner/queue375/430 PASS. Positive professional trust/serial or HTTP ports are explicitly synthetic; no native/security/provider/clinical acceptance follows.

- [Exact identity](CHECKPOINT.json), [starting observation](INITIAL_IDENTITY.json), [frozen scope preserved](FROZEN_SCOPE_PRESERVATION.json)
- [Detailed report](FINAL_REPORT.md), [all38/all18](ALL38_ALL18_MATRIX.md), [machine matrix](ALL38_ALL18_MATRIX.json)
- [Security/privacy](SECURITY_PRIVACY_REVIEW.md), [open defects/blockers](OPEN_DEFECTS_AND_RELEASE_BLOCKERS.md), [native/external limits](NATIVE_AND_EXTERNAL_QUALIFICATION.md)
- [Test evidence](TEST_EVIDENCE_INDEX.md), [actual command receipts](CURRENT_RUN_RECEIPTS.json), [all original text/binary inventory](CURRENT_ORIGINAL_INVENTORY.json)
- [Exact cumulative and session patch parts](PATCH_INDEX.md), [forward/reverse tree checks](PATCH_VERIFICATION.json)
- [Raw offline commit witness](COMMIT_ANCESTRY_WITNESS.json), [ancestry index](ANCESTRY_INDEX.md), [independent verifier](verify_ancestry.py), [actual verification](ANCESTRY_VERIFICATION.json)
- [Changed source inventory](CHANGED_FILES.json), [four source commits](COMMITS_SINCE_ENGINEERING27R.json)
- [Complete readable file index](FILE_INDEX.md), [manifest](MANIFEST.json), [screening](PUBLICATION_SAFETY_REVIEW.md)
- [Publication preflight](publication/GITHUB_RECHECK.json), [next Brain decision and continuation](BRAIN_NEXT_DECISION.md)

If a linked logical file is split, its ordered published parts are in FILE_INDEX; no patch or log is truncated. Files are UTF-8, no NUL, at most245760bytes. Manifest shards pin original/published size/SHA256 and exact reassembly order; the immutable commit/blob authenticates the manifest root without a recursive self-hash. Download the complete directory preserving relative paths and run:

```text
python verify_evidence.py /downloaded/evidence /new/reconstructed
python verify_ancestry.py /new/reconstructed/COMMIT_ANCESTRY_WITNESS.json
python verify_trees.py /existing/onskin/repository /new/reconstructed
```

The148 raw commit objects/147 parent links authenticate Git identities/tree declarations, not authorship/signatures/security acceptance. Both exact patches verify forward and reverse through isolated temporary indexes without resetting/checking out or changing the active source/index. Binary screenshots are omitted with original hashes; actual text DOM/state evidence remains. Early dirty/HEAD-changing runs, failing RED traces and the r2 case-collision evidence limitation are explicit in FINAL_REPORT.

Unchanged historical logs/native ledgers are referenced at immutable [fdcade Engineering27R evidence](https://github.com/TasfiqJ/onSkin/blob/fdcade2438e0d8f8e1611f03cf6f3575dc1600ac/evidence/brain-latest-review-2026-11-18/README.md), preserving previous evidence without copying thousands of files.

Open this README through the full evidence commit SHA supplied in the delivery response; relative links then resolve to that immutable commit. A commit cannot embed its own final SHA. The final response supplies permanent absolute index/patch/witness links. Postpush complete API/raw readback, manifest/ancestry/tree checks, source/ref preservation and Actions checks remain local to avoid a second self-referential evidence commit. Evidence publication is review only. No subsequent campaign begins before independent Brain audit.
''',generated=True)
shards=[]
for start in range(0,len(records),60):
 name=f'manifests/FILES-{start//60+1:03}.json';b=jb({'formatVersion':1,'files':records[start:start+60]});put(name,b);shards.append(dict(path=name,bytes=len(b),sha256=sha(b)))
put('MANIFEST.json',jb({'formatVersion':1,'sourceHead':'1962b44aec384545638f4aaede36ac64ef31aebe','sourceTree':'ad97b496949cdaae0cbfe5d8c778b3c54576e14f','logicalFiles':len(records),'maxPartBytes':LIMIT,'shards':shards,'rootHashScope':'Manifest root authenticated by immutable Git commit/blob; all payload files authenticated through ordered shards/parts.'}))
# Resolve split logical links in the README to their generated file index instead
# of leaving a dangling logical path. The witness fits under the bound here.
missing=[]
for name in ['README.md','PATCH_INDEX.md','FILE_INDEX.md']+pages:
 for url in re.findall(r'\]\(([^)]+)\)',(D/name).read_text()):
  if not url.startswith(('http:','https:','#'))and not((D/name).parent/url).is_file():missing.append((name,url))
assert not missing,missing
print(json.dumps({'logicalFiles':len(records),'publishedFiles':len(list(D.rglob('*')))-len([p for p in D.rglob('*')if p.is_dir()]),'bytes':sum(p.stat().st_size for p in D.rglob('*')if p.is_file()),'screening':safety},indent=2))
