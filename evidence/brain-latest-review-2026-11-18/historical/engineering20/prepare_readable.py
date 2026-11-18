"""Explicit E20 evidence allowlist; no historical reproduction artifacts or writes to GitHub."""
import base64, hashlib, json, re, shutil, sys
from pathlib import Path
OUT=Path(__file__).resolve().parent
STAGE=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else OUT.parent/'ENGINEERING20_READABLE_STAGE'/'evidence'/'engineering20'
assert not STAGE.exists(), 'Use a new stage or inspect an existing one; never silently replace delivery'
STAGE.mkdir(parents=True)
MAX=245760
def sha(b): return hashlib.sha256(b).hexdigest()
def clean(b):
    text=b.decode('utf-8',errors='replace')
    text=re.sub(r'\x1b\[[0-9;]*[A-Za-z]','',text)
    # Personal workspace/profile roots are not necessary for public audit.
    for old,new in [(str(OUT.parent/'c16-candidate'),'<REPO>'),(str(OUT),'<EVIDENCE>'),(r'[LOCAL_USER_HOME]','<LOCAL_USER>')]:
        for value in [old,old.replace('\\','/'),old.replace('\\','\\\\')]: text=text.replace(value,new)
    return text.encode('utf-8')
manifest=[]
def include(source,logical=None,sanitize=False):
    logical=logical or source.relative_to(OUT).as_posix();raw=source.read_bytes();data=clean(raw) if sanitize else raw
    text=source.suffix.lower() in ['.json','.md','.log','.py','.patch','.txt','.mjs']
    chunks=[]
    if text and len(data)>MAX:
        start=0
        while start<len(data):
            end=min(start+MAX,len(data))
            while True:
                try: data[start:end].decode('utf-8');break
                except UnicodeDecodeError: end-=1
            chunks.append(data[start:end]);start=end
        names=[f'parts/{logical.replace("/","__")}.part-{i+1:03d}.txt' for i in range(len(chunks))]
    else: chunks=[data]; names=[logical]
    parts=[]
    for name,chunk in zip(names,chunks):
        path=STAGE/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(chunk)
        parts.append({'path':name,'bytes':len(chunk),'sha256':sha(chunk)})
    manifest.append({'originalPath':logical,'originalBytes':len(raw),'originalSha256':sha(raw),'publishedBytes':len(data),'publishedSha256':sha(data),
                     'transformation':'ANSI removal; local personal paths replaced; UTF-8 replacement decoding' if sanitize else 'none; exact bytes', 'parts':parts})
names=['PRECONDITIONS.json','DELIVERY.json','FROZEN_CONTRACT_VERIFICATION.json','SOURCE_MANIFEST.json','CUMULATIVE_CHANGED_PATHS.json',
 'COMMIT_ANCESTRY_WITNESS.json','ANCESTRY_VERIFICATION.json','PATCH_VERIFICATION.json','CUMULATIVE_PR48_TO_ENGINEERING20.patch','SESSION_ENGINEERING19_TO_ENGINEERING20.patch',
 'FINAL_REPORT.md','ALL38_ALL18_MATRIX.json','ALL38_ALL18_MATRIX.md','NEXT_SESSION_PROMPT.md','VERIFICATION_SUMMARY.json','PUBLICATION_BLOCKER.md',
 'PROCESS_CLEANUP.json','verify_ancestry.py','verify_trees.py','verify_evidence.py','run_check.py','build_consumer.py','package_checkpoint.py','prepare_readable.py','make_reports.py']
for name in names: include(OUT/name,sanitize=name in ['PRECONDITIONS.json','PROCESS_CLEANUP.json','NEXT_SESSION_PROMPT.md'])
# Diagnostic receipts/logs are E20 only. No blanket copy of scripts or older evidence.
for source in sorted(OUT.iterdir()):
    if source.suffix=='.log' or source.suffix=='.json' and source.name not in names and source.name!='PUBLICATION_MANIFEST.json':
        if source.stem.startswith(('draft-','typecheck-','bottle-browser','professional-','root-','final-','committed-','full-suite-','checkpoint-')):
            include(source,'checks/'+source.name,sanitize=True)
for folder in ['bottle-browser','bottle-browser-r2','bottle-browser-r3','bottle-browser-r4','bottle-browser-final','professional-browser','professional-browser-final']:
    for source in sorted((OUT/folder).rglob('*')):
        if source.is_file() and 'domain' not in source.parts and source.suffix in ['.json','.png','.log']:
            include(source,sanitize=source.suffix!='.png')
(STAGE/'PUBLICATION_MANIFEST.json').write_text(json.dumps({'format':'engineering20-readable-evidence-v1','files':manifest},indent=2),encoding='utf-8')
delivery=json.loads((OUT/'DELIVERY.json').read_text())
lines=['# Engineering20 local evidence index','', '**Local checkpoint; publication BLOCKED_EXTERNAL. All 38 requirements and 18 gates UNACCEPTED. Release NO_GO.**','',
 f"Final application HEAD `{delivery['head']}`; tree `{delivery['tree']}`. Source commits were never pushed.",'',
 '- [Final engineering report](FINAL_REPORT.md)','- [All38/all18 assessment](ALL38_ALL18_MATRIX.md)','- [Verification receipts summary](VERIFICATION_SUMMARY.json)',
 '- [Delivery identity and commits](DELIVERY.json)','- [Publication blocker](PUBLICATION_BLOCKER.md)','- [Next-session instructions](NEXT_SESSION_PROMPT.md)',
 '- [Ordered parts and hashes](PUBLICATION_MANIFEST.json)','- [Exact forward/reverse tree receipts](PATCH_VERIFICATION.json)','',
 'Run `python verify_evidence.py` using the Python standard library. It verifies every published byte and reconstructs all large originals under `_reconstructed/`, including both exact patches and the raw Git commit witness. Then run `python verify_ancestry.py _reconstructed/COMMIT_ANCESTRY_WITNESS.json`. To independently recheck trees with a local repository containing the baseline objects, run `python verify_trees.py <repo-path> _reconstructed`. No network is used.','',
 'The manifest records sanitization separately from exact-byte source patches and ancestry. Original Git commit author metadata is retained to preserve object identities. All app screenshots and fixture content are synthetic. No new exploit/reproduction artifact is included. Prior Engineering19 evidence is referenced, not repackaged.','',
 'Engineering19 immutable baseline: [evidence index](https://github.com/TasfiqJ/onSkin/blob/303538aadb990e0f6f5e56c926b874ca54ec1085/evidence/engineering19/README.md). Its reports remain historical evidence, not newly rerun results. The unavailable old private task was not recovered.','', '## Readable parts','']
for entry in manifest:
    if len(entry['parts'])>1:
        lines.append(f"- {entry['originalPath']}: "+', '.join(f"[part {i+1}]({p['path']})" for i,p in enumerate(entry['parts'])))
(STAGE/'README.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
hashes={p.relative_to(STAGE).as_posix():sha(p.read_bytes()) for p in sorted(STAGE.rglob('*')) if p.is_file()}
(STAGE/'FILE_SHA256.json').write_text(json.dumps(hashes,indent=2),encoding='utf-8')
receipt={'stage':str(STAGE),'files':len(hashes)+1,'manifestSha256':sha((STAGE/'PUBLICATION_MANIFEST.json').read_bytes()),
         'fileIndexSha256':sha((STAGE/'FILE_SHA256.json').read_bytes()),'published':False,'head':delivery['head'],'tree':delivery['tree']}
(OUT/'READABLE_STAGE_RECEIPT.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8');print(json.dumps(receipt))
