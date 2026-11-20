import base64, importlib.util, json, re
from pathlib import Path
from run import OUT, REPO, identity, now, sha
from publication import PREFIX

prior_dir=OUT.parent/'ENGINEERING31_EVIDENCE_20261119'
spec=importlib.util.spec_from_file_location('screen',OUT.parent/'ENGINEERING30_EVIDENCE_20261119/package.py')
screen=importlib.util.module_from_spec(spec);spec.loader.exec_module(screen)
ROOT=OUT/'stage'/PREFIX
MAX=220000
def js(value):return (json.dumps(value,indent=2)+'\n').encode()
if __name__=='__main__':
 source=identity();assert not source['status'] and not ROOT.exists();ROOT.mkdir(parents=True)
 receipts=json.loads((OUT/'FINAL_RECEIPTS.json').read_text())
 assert all(r['exit']==0 and r['before']==source and r['after']==source for r in receipts)
 rows=[];parts=[]
 def put(name,data,exact=False):
  if isinstance(data,str):data=data.encode()
  data.decode('utf-8');assert b'\0' not in data
  safe=data if exact else screen.sanitize(data.decode()).encode()
  if len(safe)>MAX:
   chunks=[];offset=0
   while offset<len(safe):
    end=min(offset+MAX,len(safe))
    while True:
     try:safe[offset:end].decode('utf-8');break
     except UnicodeDecodeError:end-=1
    chunks.append(safe[offset:end]);offset=end
   names=[]
   for i,chunk in enumerate(chunks):
    part=f'parts/{name}.{i+1:03d}.txt';put(part,chunk,True);names.append(part)
   parts.append(dict(logical=name,parts=names,bytes=len(safe),sha256=sha(safe),originalRawSha256=sha(data),byteExact=exact));return
  path=ROOT/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(safe)
  rows.append(dict(path=name,bytes=len(safe),sha256=sha(safe),originalSha256=sha(data),homePathSanitized=safe!=data,byteExact=exact))
 all_receipts=[]
 for p in sorted(OUT.glob('*.json')):
  v=json.loads(p.read_text())
  if isinstance(v,dict) and 'command' in v and 'logSha256' in v:
   assert sha((OUT/(p.stem+'.log')).read_bytes())==v['logSha256'];all_receipts.append(v)
   put('receipts/'+p.name,js(v));put('logs/'+p.stem+'.log',(OUT/(p.stem+'.log')).read_bytes())
 put('ALL_EXECUTION_RECEIPTS.json',js(all_receipts));put('FINAL_RECEIPTS.json',js(receipts))
 mapping={'REPORT.md':'README.md','FINAL_IDENTITY_FINAL.json':'FINAL_IDENTITY.json','PATCH_VERIFICATION_FINAL.json':'PATCH_VERIFICATION.json',
  'ANCESTRY_VERIFICATION_FINAL.json':'ANCESTRY_VERIFICATION.json','CHANGED_FILES_FINAL.json':'CHANGED_FILES.json','FROZEN_CONTRACTS_FINAL.json':'FROZEN_CONTRACTS.json'}
 for name in ['REPORT.md','ROOT_CAUSE.md','NEXT_SESSION.md','SECURITY_PRIVACY_LIFECYCLE.md','CRASH_MATRIX.md','ALL38_ALL18.json','ALL38_ALL18.md',
  'FINAL_TARGET_CASES.json','FINAL_CHECKS_SUMMARY.json','FINAL_REPEAT_DECLARATION.json','RUNTIME_DURABLE_RESULTS.json','RUNTIME_MATRIX.md','DECLARED_SERIES_HISTORY.json','LOCAL_COMMIT_PATCHES_FINAL.json','finish_validation32.py','finish_validation32_second.py','FINAL_REPEAT_DECLARATION2.json','inspect_failed_source32.mjs','first_document_runtime32.mjs','run_first_document32.py','FIRST_DOCUMENT_REPEAT_DECLARATION.json','FIRST_DOCUMENT_PROBE_DERIVATION.json','report32.py','INITIAL_PREFLIGHT.json','FINAL_IDENTITY_FINAL.json','PATCH_VERIFICATION_FINAL.json','ANCESTRY_VERIFICATION_FINAL.json','CHANGED_FILES_FINAL.json','FROZEN_CONTRACTS_FINAL.json',
  'preflight-working.json','preflight-final3.json','VISUAL_REVIEW.json','PROCESS_CLEANUP.json','run.py','final_validation.py','browser_validation.py','source_proof.py','verify_bundle.py', 'package32.py']:
  put(mapping.get(name,name),(OUT/name).read_bytes())
 for name in ['CUMULATIVE_PR48_TO_FINAL.patch','SESSION_ENGINEERING31_TO_FINAL.patch','COMMIT_ANCESTRY_WITNESS.json','verify_ancestry.py']:
  data=(OUT/'source-proof-final'/name).read_bytes();put(name,data,True)
  if len(data)<=MAX:parts.append(dict(logical=name,parts=[name],bytes=len(data),sha256=sha(data),originalRawSha256=sha(data),byteExact=True))
 for p in sorted((OUT/'source-proof-final/commits').glob('*.patch')):put('commits/'+p.name,p.read_bytes(),True)
 # Readable synthetic UI state, admission/crash traces and all failures. No
 # browser profiles, decrypted storage dumps, raw key values or compiled apps.
 for folder in sorted(OUT.iterdir()):
  if not folder.is_dir() or not any((folder/x).exists() for x in ['summary.json','SUMMARY.json']):continue
  for p in sorted(folder.glob('*.json')):
   name=p.name
   if any(x in name.lower() for x in ['console','network','owned','race-state','runtime-events','authority','local-readback']):continue
   v=json.loads(p.read_text())
   selected=name in ['summary.json','SUMMARY.json','DECLARED_MATRIX.json','TRACE.json','FAILURE-TRACE.json','FAILURE.json','ERROR.json','steps.json','M102-daily-loop.json'] or name.endswith(('-admission-trace.json','-canonical-receipt.json','-summary.json','-source-hashes.json','-original-evidence.json')) or name.startswith('keyboard-readiness-') or isinstance(v,dict) and 'text' in v and 'path' in v
   if selected:
    if name=='FAILURE-TRACE.json' and 'ciphertextHex' in json.dumps(v):v=dict(message='Exact ledger ciphertext equality failed after forced process restart; synthetic payload bytes omitted.',originalBytes=p.stat().st_size,originalSha256=sha(p.read_bytes()),stackLocation='durable-routine32.mjs:40',payloadOmitted=True)
    put('browser/'+folder.name+'/'+name,js(v))
 screenshots=[]
 for folder in sorted(OUT.iterdir()):
  if not folder.is_dir():continue
  selected=[]
  if folder.name=='final-acceptance2-connected-r1-browser':
   selected=list(folder.glob('*restart-original-not-found.png'))+[folder/'375x667-withdrawal-erased.png']
  if folder.name=='final-runtime2-r1-browser':selected=list(folder.glob('*-1.png'))
  if folder.name in ['connected-working2-browser','final-connected3-browser','final-acceptance-connected-r1-browser']:
   if (folder/'failure-state.png').exists():selected=[folder/'failure-state.png']
  for p in sorted(set(selected)):
   data=p.read_bytes();name='visual/'+folder.name+'/'+p.name+'.base64.txt'
   put(name,base64.encodebytes(data),True)
   screenshots.append(dict(path=name,decodedBytes=len(data),decodedSha256=sha(data),synthetic=True))
 put('SCREENSHOTS.json',js(dict(files=screenshots,decode='Base64 decode ordered logical files; verify decodedBytes/decodedSha256.')))
 inventory=[dict(path=p.relative_to(OUT/'build').as_posix(),bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted((OUT/'build').rglob('*')) if p.is_file()]
 put('BUILD_ARTIFACTS.json',js(dict(files=inventory,compiledArtifactsRemainLocal=True)))
 old=(prior_dir/'source-proof-final3/CUMULATIVE_PR48_TO_FINAL.patch').read_bytes()
 assert sha(old)=='da08d9cd142cae1849d28fc15f77a557859e3251e6b6b34dabfe765b8f2a6fdb'
 allowed={(hit['kind'],hit['matchSha256']) for hit in screen.matches(old.decode())};hits=[]
 for p in sorted(ROOT.rglob('*')):
  if not p.is_file():continue
  for hit in screen.matches(p.read_text(encoding='utf-8')):
   if (hit['kind'],hit['matchSha256']) in allowed:reason='Exact previously published Engineering31 source fixture signature.'
   elif hit['kind']=='email' and re.search(r'@(2|3|4)x\.png|@example\.(com|test)|@example\.invalid|@openai\.com',p.read_text(encoding='utf-8').splitlines()[hit['line']-1]):reason='Generated density asset or explicit synthetic fixture address.'
   else:raise AssertionError(('Unreviewed publication signature',p.name,hit))
   hits.append(dict(path=p.relative_to(ROOT).as_posix(),**hit,disposition=reason))
 def identities(path):
  values=set()
  for obj in json.loads(path.read_text())['pathBaseToTarget']:
   for line in base64.b64decode(obj['payloadBase64']).split(b'\n\n',1)[0].splitlines():
    if line.startswith((b'author ',b'committer ')):values.add(line.split(b' ',1)[1].rsplit(b' ',2)[0])
  return values
 assert identities(OUT/'source-proof-final/COMMIT_ANCESTRY_WITNESS.json')<=identities(prior_dir/'source-proof-final3/COMMIT_ANCESTRY_WITNESS.json')
 put('PUBLICATION_SCREEN.json',js(dict(at=now(),safeForPublication=True,unreviewedMatches=0,hits=hits,realCustomerDataIncluded=False,privateKeysIncluded=False,profilesIncluded=False,
  sourcePatchesByteExact=True,priorCumulativeSha256=sha(old),screenScope='Changed application and test source, full readable logs/traces and selected visually reviewed synthetic screenshots; no real accounts or inputs used.')))
 put('PARTS_INDEX.json',js(parts))
 put('PUBLICATION_DERIVATION_INDEX.json',js(rows))
 (ROOT/'MANIFEST.json').write_bytes(js(dict(at=now(),source=source,files=[{k:r[k] for k in ['path','bytes','sha256']} for r in rows],manifestExcludesItself=True)))
 print(json.dumps(dict(files=len(rows)+1,bytes=sum(p.stat().st_size for p in ROOT.rglob('*') if p.is_file()),screenHits=len(hits))))
