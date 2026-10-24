from pathlib import Path
import subprocess, hashlib, json, datetime, sys

root = Path(r'C:\Users\jasim\Desktop\WeddingCards\work\m1x05-original-329853b7').resolve()
out = Path(__file__).resolve().parent
def git(*args): return subprocess.check_output(['git',*args],cwd=root).decode().strip()
def sha(data): return hashlib.sha256(data).hexdigest()
assert root.name == 'm1x05-original-329853b7'
assert git('rev-parse','HEAD') == 'd76cbd2742920895522e3e9018d554319c777741'
assert git('status','--porcelain=v1') == ''
assert git('config','--get','core.sparseCheckout') == 'false'
assert not any(line.startswith('S ') for line in git('ls-files','-t').splitlines())
input_path = root/'apps/mobile/src/features/shelf/mutations.ts'
producer = root/'scripts/phase4/build-source-worklist.mjs'
original = input_path.read_bytes()
producer_before = sha(producer.read_bytes())
outputs = [root/'docs/phase-4/generated/source-worklist.json', root/'docs/phase-4/generated/source-worklist.md']
output_hashes = {p.name:sha(p.read_bytes()) for p in outputs}
assert all('apps/mobile/src/features/shelf/mutations.ts' in p.read_text(encoding='utf-8') for p in outputs)
receipts=[]
def check(label):
    argv=[r'C:\Program Files\nodejs\node.exe','scripts/phase4/build-source-worklist.mjs','--strict','--check']
    result=subprocess.run(argv,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    log=out/('worklist-'+label+'.log'); log.write_bytes(result.stdout)
    receipts.append(dict(label=label,command=argv,cwd=str(root),exit=result.returncode,log=log.name,sha256=sha(result.stdout),utc=datetime.datetime.now(datetime.timezone.utc).isoformat()))
    assert {p.name:sha(p.read_bytes()) for p in outputs} == output_hashes
    return result
assert check('current').returncode == 0
try:
    input_path.write_bytes(original+b'\n// Disposable M1X-05 input tamper; never committed.\n')
    altered=check('altered-input')
    assert altered.returncode != 0
    assert all(p.name.encode() in altered.stdout for p in outputs), altered.stdout
finally:
    input_path.write_bytes(original)
assert check('restored').returncode == 0
assert input_path.read_bytes() == original and git('status','--porcelain=v1') == ''
assert sha(producer.read_bytes()) == producer_before
report=dict(head=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}'),full_checkout=True,exits=[r['exit'] for r in receipts],
    input='apps/mobile/src/features/shelf/mutations.ts',restored_sha256=sha(original),producer_sha256=producer_before,outputs=output_hashes,receipts=receipts)
(out/'worklist-contract.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,indent=2))
