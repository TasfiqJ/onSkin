import collections, hashlib, json, re
from pathlib import Path

O=Path(__file__).resolve().parent;RAW=O/'raw';D=O/'stage/evidence/engineering29-review-2026-11-18';LIMIT=245760
HEAD='b29e731097984be98f5b06024d11255dbb732809';TREE='bb63940c79e1fde4c946c8162f401baeac2b90c1'
def sha(b):return hashlib.sha256(b).hexdigest()
def jb(v):return(json.dumps(v,indent=2,ensure_ascii=False)+'\n').encode()
scan=json.loads((O/'audit/SCAN_MATCHES.json').read_text());assert scan['allRawIdentitiesAlreadyPublicInPR48']
for hit in scan['hits']:
 assert hit['kind']=='email',hit
 line=(RAW/hit['path']).read_text(encoding='utf-8').splitlines()[hit['line']-1]
 assert 'example.invalid'in line and'Buffer.from('in line,hit
assert not D.exists();D.mkdir(parents=True);records=[]
def put(n,b):
 b.decode('utf-8');assert len(b)<=LIMIT and b'\0'not in b,(n,len(b));p=D/n;assert not p.exists();p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
def sanitize(b):
 s=b.decode('utf-8');counts={}
 for key,pattern,replacement in [('homePaths',r'(?i)C:(?:\\{1,2}|/)Users(?:\\{1,2}|/)jasim\b','[LOCAL_USER_HOME]'),('hostName',r'\bSLEEPY\b','[LOCAL_HOST]'),
  ('browserProfiles',r'onskin-(?:e\d+[-\w]*|template\d+|mapping\d+|outcome\d+|queue|owner|authoring|evidence|recovery)-[A-Za-z0-9]{6,}','[TEMP_BROWSER_PROFILE]'),
  ('terminalEscapes',r'\x1b\[[0-?]*[ -/]*[@-~]','')]:
  s,n=re.subn(pattern,replacement,s);counts[key]=n
 return s.encode(),counts
def add(n,b,exact=False,generated=False):
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
 split=len(parts)>1 or n.startswith('patches/');rows=[]
 for i,part in enumerate(parts,1):
  path=n+f'.parts/part-{i:03}.txt'if split else n;put(path,part);rows.append({'order':i,'path':path,'bytes':len(part),'sha256':sha(part)})
 records.append({'logicalPath':n,'sourceBytes':len(b),'sourceSha256':sha(b),'publishedBytes':len(pub),'publishedSha256':sha(pub),'byteExact':b==pub,'sanitization':changes,'parts':rows})
for p in sorted(RAW.rglob('*')):
 if p.is_file():
  n=p.relative_to(RAW).as_posix();add(n,p.read_bytes(),exact=n.startswith('patches/')or n=='COMMIT_ANCESTRY_WITNESS.json')
safety={'checkedAt':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),'selectedUtf8FilesScanned':scan['files'],
 'credentialPatternMatches':0,'emailMatches':len(scan['hits']),'emailDisposition':'Only the previously published synthetic example.invalid EXIF fixture in the exact cumulative source patch. No real customer/device email.',
 'rawCommitIdentityCount':scan['rawCommitIdentityCount'],'rawIdentitiesAlreadyPublicInPR48':True,
 'review':'All complete selected UTF-8 material screened with credential/private-key/token/JWT/device/email patterns; source changes and synthetic DOM/fixture provenance reviewed. No credential liveness probes. No real customer/clinical data or native device secrets selected. The unchanged E28 patch bytes match its immutable published hashes; exact new source and failures remain reviewable.',
 'sanitization':dict(sum((collections.Counter(r['sanitization'])for r in records),collections.Counter())),
 'exactPreservation':'Cumulative/session source patches and raw commit witness are byte-exact. Other derived text declares path/profile/terminal sanitization with original and published hashes. Binary PNGs omitted with original hashes.',
 'zeroCost':'Evidence parent/tree contains no workflows. Default workflows/blobs/main-only push filters, visible hooks/rules, effective local pre-push hook and exact GitHub push URL checked. Push suppresses tag/submodule propagation and uses an atomic absent-ref lease. No source/PR/manual CI/native/paid operation.',
 'limits':'Bounded material screen and repository-visible trigger inspection, not protected whole-history security/billing/native acceptance. Postpublication API/raw/ref/Actions verification required before final delivery.'}
add('PUBLICATION_SAFETY_REVIEW.json',jb(safety),generated=True)
add('PUBLICATION_SAFETY_REVIEW.md',b'''# Publication screening and zero-cost boundary

Every selected complete UTF-8 artifact was screened for credentials, private keys, tokens, JWTs, credential URLs, device identifiers and email values. The only email match is the already published synthetic example.invalid EXIF fixture in the exact cumulative source patch. Decoded raw Git author/committer identities match the already public PR48 identity. No real customer/clinical data, clinical image, native device secret or credential material was selected. No credential liveness probes ran.

Both source patches and the raw commit witness retain exact bytes. Derived text declares home/host/browser-profile/terminal sanitization with separate original and published hashes and ordered reassembly. Binary screenshots are omitted with original size/SHA256 inventory; actual text DOM/state, commands, responses and complete logs remain. This is bounded material screening, not formal Security acceptance.

Publication uses a fresh evidence-only branch derived from immutable Engineering28 evidence. The parent and candidate tree contain no workflows. Default workflow blobs and main-only push filters, absent create/indirect triggers, visible rules/hooks, effective local pre-push hook and exact remote URL are checked. Atomic absent-ref lease prevents replacing an existing branch; tag/submodule propagation is disabled. [skip ci] is supplementary. No application-source/PR/main mutation, hosted/manual CI, paid/native/provider/account/LFS operation is initiated. Full API/raw byte/hash readback, reconstruction, ancestry/trees, preserved refs and all-event Actions checks follow before final delivery.
''',generated=True)
lines=['# Exact source patches','','Concatenate ordered raw UTF-8 part bytes with no added separators/newlines. MANIFEST maps all original/published sizes and SHA256. verify_evidence.py reconstructs; verify_trees.py independently checks both forward/reverse exact Git trees with temporary indexes.','']
for r in [x for x in records if x['logicalPath'].startswith('patches/')]:
 lines+=['## '+r['logicalPath'],'',f"Exact bytes {r['sourceBytes']}; SHA256 `{r['sourceSha256']}`.",'']
 for p in r['parts']:lines+=[f"- Part {p['order']}: [{p['path']}]({p['path']}) — {p['bytes']} bytes; SHA256 `{p['sha256']}`."]
 lines+=['']
add('PATCH_INDEX.md',('\n'.join(lines)+'\n').encode(),generated=True)
originals=list(records);pages=[]
for start in range(0,len(originals),50):
 n=f'indexes/FILES-{start//50+1:03}.md';pages.append(n);lines=['# Complete readable payload index','','Original and published sizes/hashes and sanitization are in the manifest shards. Every complete file and ordered part is linked.','']
 for r in originals[start:start+50]:
  lines+=['## '+r['logicalPath'],'',f"Original {r['sourceBytes']} bytes / SHA256 `{r['sourceSha256']}`. Published {r['publishedBytes']} bytes / SHA256 `{r['publishedSha256']}`. Byte-exact: {str(r['byteExact']).lower()}.",'']
  for p in r['parts']:lines+=[f"- [{p['path']}](../{p['path']}) — order {p['order']}; {p['bytes']} bytes; SHA256 `{p['sha256']}`."]
  lines+=['']
 add(n,('\n'.join(lines)+'\n').encode(),generated=True)
add('FILE_INDEX.md',('# Complete readable file index\n\n'+''.join(f'- [{n}]({n})\n'for n in pages)+'\nComplete logs, failures, DOM/state, receipts, reports and exact source patch parts are listed. No selected text file is truncated.\n').encode(),generated=True)
add('README.md',f'''# Engineering29 local product checkpoint

Authorization BRAIN-ONSKIN-AUTONOMOUS-LOCAL-PRODUCT-29. Final clean source `{HEAD}`, tree `{TREE}`, existing branch stage/m1-native-runtime47. Start Engineering28 `1962b44aec384545638f4aaede36ac64ef31aebe` / tree `ad97b496949cdaae0cbfe5d8c778b3c54576e14f`. Three local source commits; no application-source push or PR/main change.

Connected exact template revision→ordered role/product/omission review→immutable intended provenance→encrypted issuance/readback/exact retry→independent received-copy history. Explicit unshelved/unresolved states block issuance and create no admitted product. Consumer read-only uncertain-apply outcome inspection preserves original command/predecessor/facts and distinguishes retained historical outcomes; false no-apply copy and delayed apply/clear/retraction cache rollback are repaired. Genuine original-owner ingress/application writer, production professional authority/custody and lawful template offboarding remain unavailable. Default API503 remains. All38/all18 UNACCEPTED, release NO_GO, exactly J01 Visible Pores with positives closed.

Final clean-source validation:8708 tests/584files,532 focused privacy/recovery cases, root typecheck/configured lint and both web builds PASS. Mapping, consumer outcome and optional draft/history browsers pass375/390/430; professional owner/queue regressions pass375/430. All positive trust/serial/HTTP ports and acknowledgement faults are explicitly synthetic; no native/security/provider/clinical acceptance follows.

- [Exact checkpoint](CHECKPOINT.json), [starting observation](INITIAL_IDENTITY.json), [authenticated E28 handoff review](ENGINEERING28_HANDOFF_REVIEW.json), [frozen scope](FROZEN_SCOPE_PRESERVATION.json)
- [Complete engineering report](FINAL_REPORT.md), [all38/all18 matrix](ALL38_ALL18_MATRIX.md), [machine matrix](ALL38_ALL18_MATRIX.json)
- [Security/privacy](SECURITY_PRIVACY_REVIEW.md), [open gaps and blockers](OPEN_DEFECTS_AND_RELEASE_BLOCKERS.md), [native/external ledger](NATIVE_AND_EXTERNAL_QUALIFICATION.md)
- [Validation index](TEST_EVIDENCE_INDEX.md), [exact command receipts](CURRENT_RUN_RECEIPTS.json), [original file/binary inventory](CURRENT_ORIGINAL_INVENTORY.json), [tooling limits](TOOLING_NOTES.md)
- [Cumulative and session patch parts](PATCH_INDEX.md), [forward/reverse tree proof](PATCH_VERIFICATION.json), [changed-source inventory](CHANGED_FILES.json), [three source commits](COMMITS_SINCE_ENGINEERING28.json)
- [Offline raw ancestry witness](COMMIT_ANCESTRY_WITNESS.json), [ancestry index](ANCESTRY_INDEX.md), [independent verifier](verify_ancestry.py), [actual verification](ANCESTRY_VERIFICATION.json)
- [Complete readable file index](FILE_INDEX.md), [byte manifest](MANIFEST.json), [publication screening](PUBLICATION_SAFETY_REVIEW.md), [trigger/ref preflight](publication/GITHUB_RECHECK.json)
- [Self-contained continuation and Brain priorities](BRAIN_NEXT_DECISION.md)

Files are readable UTF-8, no NUL, at most245760bytes. Split files have ordered byte-exact parts in FILE_INDEX/PATCH_INDEX and SHA256 manifests. Download this directory preserving paths and run:

```text
python verify_evidence.py /downloaded/evidence /new/reconstructed
python verify_ancestry.py /new/reconstructed/COMMIT_ANCESTRY_WITNESS.json
python verify_trees.py /existing/onskin/repository /new/reconstructed
```

The151 raw commit objects/150 parent links authenticate source Git identities/tree declarations, not signatures/authorship/security acceptance. Both exact patches reproduce the original/final trees using isolated temporary indexes without changing the active source/index. Binary screenshots are retained locally with original hashes; text DOM/state/receipts remain published. Intermediate dirty/failing runs are disclosed separately from final clean-source validation.

Historical unchanged evidence is referenced at immutable [Engineering28](https://github.com/TasfiqJ/onSkin/blob/63898e8dceb11d953bb1e2f137439c7e52c3e6fe/evidence/engineering28-review-2026-11-18/README.md), including earlier native and protected qualification limits, without republishing thousands of historical logs.

Open this index through its complete evidence commit SHA from the final response for permanent relative links. A commit cannot embed its own SHA; complete postpublication API/raw byte/hash/ref/Actions receipts remain local to avoid a self-referential second publication. Those checks must finish before delivery. Evidence publication grants no source/hosted/paid/native/release permission. No subsequent campaign begins before independent Brain audit.
'''.encode(),generated=True)
shards=[]
for start in range(0,len(records),60):
 n=f'manifests/FILES-{start//60+1:03}.json';b=jb({'formatVersion':1,'files':records[start:start+60]});put(n,b);shards.append({'path':n,'bytes':len(b),'sha256':sha(b)})
put('MANIFEST.json',jb({'formatVersion':1,'sourceHead':HEAD,'sourceTree':TREE,'logicalFiles':len(records),'maxPartBytes':LIMIT,'shards':shards,
 'rootHashScope':'Manifest root is authenticated by the immutable Git commit/blob; all payloads are authenticated through ordered shards and parts.'}))
missing=[]
for n in ['README.md','PATCH_INDEX.md','FILE_INDEX.md']+pages:
 for url in re.findall(r'\]\(([^)]+)\)',(D/n).read_text()):
  if not url.startswith(('http:','https:','#'))and not((D/n).parent/url).is_file():missing.append((n,url))
assert not missing,missing
print(json.dumps({'logicalFiles':len(records),'publishedFiles':sum(p.is_file()for p in D.rglob('*')),'bytes':sum(p.stat().st_size for p in D.rglob('*')if p.is_file()),'screening':safety},indent=2))
