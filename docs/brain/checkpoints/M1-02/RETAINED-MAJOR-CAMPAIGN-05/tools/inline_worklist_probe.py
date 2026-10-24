from pathlib import Path
import datetime
import hashlib
import json
import subprocess

root=Path(r'C:\Users\jasim\Desktop\WeddingCards\work\m102-retained-resilience').resolve()
out=Path(__file__).resolve().parent
def git(*args): return subprocess.check_output(['git',*args],cwd=root).decode().strip()
def sha(data): return hashlib.sha256(data).hexdigest()
assert root.name=='m102-retained-resilience'
assert git('rev-parse','HEAD')=='74c08a37a761d3bb44601c2d6b4b52a8f9e9c6b7'
assert git('status','--porcelain=v1')==''
assert git('config','--get','core.sparseCheckout')=='false'
assert not any(line.startswith('S ') for line in git('ls-files','-t').splitlines())
input_path=root/'apps/mobile/src/features/shelf/mutations.ts'
producer=root/'scripts/phase4/build-source-worklist.mjs'
original=input_path.read_bytes()
producer_before=sha(producer.read_bytes())
assert producer_before=='b3882f954498008cd80fe57d50f75c358504bca99f5f97b7481239977af26d1e'
outputs=[root/'docs/phase-4/generated/source-worklist.json',root/'docs/phase-4/generated/source-worklist.md']
hashes={p.name:sha(p.read_bytes()) for p in outputs}
receipts=[]
def check(label):
    command=[r'C:\Program Files\nodejs\node.exe','scripts/phase4/build-source-worklist.mjs','--strict','--check']
    result=subprocess.run(command,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    log=out/('inline-worklist-'+label+'.log')
    assert not log.exists()
    log.write_bytes(result.stdout)
    receipts.append(dict(label=label,command=command,cwd=str(root),exit=result.returncode,log=log.name,sha256=sha(result.stdout),utc=datetime.datetime.now(datetime.timezone.utc).isoformat()))
    assert {p.name:sha(p.read_bytes()) for p in outputs}==hashes
    return result
assert check('current').returncode==0
try:
    input_path.write_bytes(original+b'\n// Disposable Campaign05 final input probe; never committed.\n')
    refused=check('altered-input')
    assert refused.returncode!=0
    assert all(p.name.encode() in refused.stdout for p in outputs)
finally:
    input_path.write_bytes(original)
assert check('restored').returncode==0
assert input_path.read_bytes()==original and git('status','--porcelain=v1')==''
assert sha(producer.read_bytes())==producer_before
report=dict(head=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}'),full_checkout=True,checkout='clean complete authorized implementation checkout; no Expo or test process reads during probe',exits=[r['exit'] for r in receipts],input='apps/mobile/src/features/shelf/mutations.ts',restored_sha256=sha(original),producer_sha256=producer_before,outputs=hashes,receipts=receipts)
(out/'inline-worklist-contract.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,indent=2))
