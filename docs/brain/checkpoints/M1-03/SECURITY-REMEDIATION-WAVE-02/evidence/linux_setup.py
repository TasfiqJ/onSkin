import datetime, hashlib, json, os, pathlib, subprocess, sys, time, urllib.request, tarfile
out=pathlib.Path('/evidence'); work=pathlib.Path('/work')
def run(name,argv,cwd=work,timeout=600):
    start=time.monotonic()
    with (out/(name+'.log')).open('wb') as f:
        try: code=subprocess.run(argv,cwd=cwd,stdout=f,stderr=subprocess.STDOUT,timeout=timeout).returncode
        except subprocess.TimeoutExpired: code=124
    row=dict(argv=argv,cwd=str(cwd),exit=code,seconds=time.monotonic()-start,observed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),log_sha256=hashlib.sha256((out/(name+'.log')).read_bytes()).hexdigest())
    (out/(name+'.receipt.json')).write_text(json.dumps(row,indent=2)+'\n'); print(json.dumps(row),flush=True)
    return code
if not (work/'repo').exists():
    assert run('exact-clone',['git','-c','safe.directory=/issued','clone','--no-hardlinks','--single-branch','--branch','stage/m1-gate-recovery','/issued','/work/repo'])==0
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd='/work/repo').strip()==b'0ecfa2a646ce9b30e717f6995097515f884cfdaf'
assert not subprocess.check_output(['git','status','--porcelain'],cwd='/work/repo')
base='https://nodejs.org/dist/v24.19.0/'
manifest=urllib.request.urlopen(base+'SHASUMS256.txt',timeout=60).read()
name='node-v24.19.0-linux-x64.tar.xz'; pin=next(line.split()[0].decode() for line in manifest.splitlines() if line.split()[-1].decode()==name)
raw=urllib.request.urlopen(base+name,timeout=120).read(); assert hashlib.sha256(raw).hexdigest()==pin
archive=work/name;archive.write_bytes(raw)
with tarfile.open(archive) as t:
    assert all((x.name=='node-v24.19.0-linux-x64' or x.name.startswith('node-v24.19.0-linux-x64/')) and '..' not in x.name.split('/') for x in t)
    t.extractall(work)
os.environ['PATH']='/work/node-v24.19.0-linux-x64/bin:'+os.environ['PATH']
assert run('npm-tool-install',['npm','install','--prefix','/work/npm-tool','npm@11.20.0','--ignore-scripts','--bin-links=false','--no-audit','--no-fund'])==0
sys.path.insert(0,'/work/repo/scripts/phase9/security_acceptance');import contract as c
tree=c.tool_tree('/work/npm-tool/node_modules/npm');assert tree==c.load(c.HERE,'proposal.json')['npmToolTree']
bins=work/'bin';bins.mkdir()
for n in ('npm','npx'):
    target=work/'npm-tool/node_modules/npm/bin'/f'{n}-cli.js';target.chmod(0o755);(bins/n).symlink_to(target)
versions=subprocess.check_output(['sh','-c','python3 --version; ldd --version | head -1; node --version; /work/bin/npm --version; mount | grep " /work "'],env=os.environ).decode()
probe=work/'exec-test';probe.write_text('#!/bin/sh\nexit 0\n');probe.chmod(0o755)
assert run('tmpfs-exec-probe',[str(probe)])==0
(out/'runtime.json').write_text(json.dumps(dict(python=sys.version,versions=versions,npm_tool_tree=tree,node_tarball_sha256=pin,node_shasums_sha256=hashlib.sha256(manifest).hexdigest(),source_read_only=True,scratch='/work memory tmpfs',incremental_spend_usd=0),indent=2)+'\n')
