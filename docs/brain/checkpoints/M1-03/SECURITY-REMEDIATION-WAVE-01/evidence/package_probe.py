"""Reproduce the protected installer package steps in a disposable Linux clone."""
import argparse, datetime, hashlib, importlib.metadata, json, os, pathlib, platform, shutil, subprocess, sys, time
sys.dont_write_bytecode = True
p = argparse.ArgumentParser()
p.add_argument('root', type=pathlib.Path)
p.add_argument('work', type=pathlib.Path)
p.add_argument('--requirements', type=pathlib.Path)
p.add_argument('--label', default='old')
p.add_argument('--evidence',type=pathlib.Path)
a = p.parse_args()
root = a.root.resolve(); work = a.work.resolve(); work.mkdir(parents=True, exist_ok=False)
sys.path.insert(0, str(root/'scripts/phase9/security_acceptance'))
import contract as c
import bootstrap_tools as b
policy = c.load(c.HERE, 'proposal.json')
req = a.requirements or c.HERE/b.REQUIREMENTS
receipt = {'label': a.label, 'root': str(root), 'work': str(work), 'started': datetime.datetime.now(datetime.timezone.utc).isoformat(),
           'python': sys.version, 'libc': platform.libc_ver(), 'requirementsSha256': c.SHA(req.read_bytes()),
           'head': c.git(root,'rev-parse','HEAD').decode().strip(), 'tree': c.git(root,'rev-parse','HEAD^{tree}').decode().strip()}
argv = [sys.executable,'-B','-m','pip','--isolated','install','--index-url','https://pypi.org/simple','--no-input',
        '--require-hashes','--only-binary=:all:','--no-compile','--no-deps','--target','semgrep','--requirement',str(req),
        '--report','official-wheel-install.json','--cache-dir','cache/pip']
started = time.monotonic()
with (work/'install.log').open('wb') as log:
    r = subprocess.run(argv,cwd=work,stdout=log,stderr=subprocess.STDOUT,timeout=600)
receipt['install'] = {'argv':argv,'exit':r.returncode,'seconds':time.monotonic()-started,'logSha256':c.SHA((work/'install.log').read_bytes())}
try:
    c.require(r.returncode==0,'PINNED_WHEEL_INSTALL_FAILED')
    site = work/'semgrep'
    receipt['originalPackageTree'] = c.tool_tree(site,python_site=True)
    receipt['originalCoreSha256'] = b.file_sha(site/'semgrep/bin/semgrep-core')
    receipt['distributions'] = sorted([{'name':d.metadata['Name'],'version':d.version,'requires':d.requires or []} for d in importlib.metadata.distributions(path=[str(site)])],key=lambda d:d['name'].lower())
    profile = dict(policy['semgrepBuild'])
    if a.label=='old':
        c.require(receipt['requirementsSha256']==profile['requirementsSha256'],'REQUIREMENTS_DRIFT')
        c.require(receipt['originalPackageTree']==profile['originalPackageTree'],'OLD_PACKAGE_TREE_NOT_REPRODUCED')
    else:
        # This measured identity authorizes only scratch assembly, never stage admission.
        profile['originalPackageTree']=receipt['originalPackageTree']
    receipt['engine'] = b.install_engine(site,c.HERE/b.ENGINE_ARCHIVE,profile,work/'preserved-upstream')
    receipt['semgrepPackageTree'] = c.tool_tree(site,python_site=True)
    if a.label=='old': c.require(receipt['semgrepPackageTree']==policy['semgrepPackageTree'],'OLD_ASSEMBLED_TREE_NOT_REPRODUCED')
    receipt['status']='REPRODUCED' if a.label=='old' else 'SCRATCH_MEASURED'
except Exception as e:
    receipt['status']='BLOCKED'; receipt['error']=str(e)
receipt['ended']=datetime.datetime.now(datetime.timezone.utc).isoformat()
(work/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
if a.evidence:
    a.evidence.mkdir(parents=True,exist_ok=True)
    for name in ('receipt.json','install.log','official-wheel-install.json'):
        if (work/name).is_file():shutil.copyfile(work/name,a.evidence/name)
print(json.dumps({k:v for k,v in receipt.items() if k not in ('distributions','engine')},indent=2))
sys.exit(0 if receipt['status']!='BLOCKED' else 1)
