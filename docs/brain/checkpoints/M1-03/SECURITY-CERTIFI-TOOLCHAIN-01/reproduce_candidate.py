import datetime, hashlib, json, os, pathlib, subprocess, sys, time

BASE=pathlib.Path('/tmp/onskin-m103-certifi-0fd3eeace36a492bb97dfcd8d99231aa')
REPO=BASE/'repo'
CTX=pathlib.Path(__file__).resolve().parent
OUT=CTX/'reproduction/attempt02'
OUT.mkdir(exist_ok=False)
HERE=REPO/'scripts/phase9/security_acceptance'
PYTHON=BASE/'venv/bin/python'
env={'PATH':str(BASE/'venv/bin')+':/usr/local/bin:/usr/bin:/bin','HOME':str(BASE/'home'),
     'LANG':'C.UTF-8','PYTHONDONTWRITEBYTECODE':'1','NPM_CONFIG_REGISTRY':'https://registry.npmjs.org/',
     'NPM_CONFIG_USERCONFIG':'/dev/null'}
def run(name,args,timeout=900):
    start=datetime.datetime.now(datetime.timezone.utc).isoformat(); t=time.monotonic()
    with (OUT/(name+'.stdout.log')).open('wb') as stdout,(OUT/(name+'.stderr.log')).open('wb') as stderr:
        p=subprocess.run(list(map(str,args)),cwd=BASE,env=env,stdout=stdout,stderr=stderr,timeout=timeout)
    result={'command':list(map(str,args)),'cwd':str(BASE),'started_utc':start,'exit':p.returncode,'elapsed_seconds':round(time.monotonic()-t,3)}
    (OUT/(name+'.receipt.json')).write_text(json.dumps(result,indent=2)+'\n'); print(json.dumps(result),flush=True)
    if p.returncode:
        print((OUT/(name+'.stderr.log')).read_text()[-10000:],flush=True)
        raise RuntimeError(name+' failed')
def sha(b):return hashlib.sha256(b).hexdigest()
def manifest(root):
    rows={}
    for p in sorted(root.rglob('*')):
        assert not p.is_symlink()
        if p.is_file():
            assert p.stat().st_nlink==1
            rows[p.relative_to(root).as_posix()]={'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())}
    return rows
sys.path.insert(0,str(HERE))
from contract import tool_tree
from bootstrap_tools import install_engine
policy=json.loads((HERE/'proposal.json').read_bytes())
original_req=(HERE/'semgrep-requirements-linux-py312.txt').read_bytes()
witness=json.loads((CTX/'UPSTREAM_CERTIFI_WITNESS.json').read_bytes())
def pip_install(name,target,req):
    run(name,[PYTHON,'-B','-m','pip','--isolated','install','--index-url','https://pypi.org/simple','--no-input',
              '--require-hashes','--only-binary=:all:','--no-compile','--no-deps','--target',target,
              '--requirement',req,'--report',BASE/(name+'-wheel-install.json'),'--cache-dir',BASE/(name+'-cache')])
try:
    pip_install('old-original-02',BASE/'old-original-02',HERE/'semgrep-requirements-linux-py312.txt')
    oldtree=tool_tree(BASE/'old-original-02',python_site=True)
    assert oldtree==policy['semgrepBuild']['originalPackageTree']
    oldmanifest=manifest(BASE/'old-original-02')
    candidate_req=original_req.replace(witness['old_requirements_line'].encode(),witness['new_requirements_line'].encode())
    assert original_req.count(witness['old_requirements_line'].encode())==1
    assert len(original_req.splitlines())==len(candidate_req.splitlines())
    (HERE/'semgrep-requirements-linux-py312.txt').write_bytes(candidate_req)
    pip_install('new-original-02',BASE/'new-original-02',HERE/'semgrep-requirements-linux-py312.txt')
    newtree=tool_tree(BASE/'new-original-02',python_site=True)
    newmanifest=manifest(BASE/'new-original-02')
    delta=[{'path':p,'old':oldmanifest.get(p),'new':newmanifest.get(p)} for p in sorted(oldmanifest.keys()|newmanifest.keys()) if oldmanifest.get(p)!=newmanifest.get(p)]
    allowed=('certifi/','certifi-2026.10.18.dist-info/','certifi-2026.10.19.dist-info/')
    assert delta and all(r['path'].startswith(allowed) for r in delta),delta
    (OUT/'old-original-02-files.json').write_text(json.dumps(oldmanifest,indent=2)+'\n')
    (OUT/'new-original-02-files.json').write_text(json.dumps(newmanifest,indent=2)+'\n')
    profile=dict(policy['semgrepBuild']);profile['originalPackageTree']=newtree
    engine=install_engine(BASE/'new-original-02',HERE/'semgrep-engine-linux-x86_64.tar.gz',profile,BASE/'new-preserved-02')
    assembled=tool_tree(BASE/'new-original-02',python_site=True)
    oldassembled=manifest(BASE/'old-tools/semgrep');newassembled=manifest(BASE/'new-original-02')
    assembled_delta=[{'path':p,'old':oldassembled.get(p),'new':newassembled.get(p)} for p in sorted(oldassembled.keys()|newassembled.keys()) if oldassembled.get(p)!=newassembled.get(p)]
    assert all(r['path'].startswith(allowed) for r in assembled_delta),assembled_delta
    changes={'requirementsSha256':sha(candidate_req),'originalPackageTree':newtree,'semgrepPackageTree':assembled}
    raw=(HERE/'proposal.json').read_bytes()
    for previous,nextvalue in ((policy['semgrepBuild']['requirementsSha256'],changes['requirementsSha256']),
                               (policy['semgrepBuild']['originalPackageTree'],newtree),(policy['semgrepPackageTree'],assembled)):
        assert raw.count(previous.encode())==1
        raw=raw.replace(previous.encode(),nextvalue.encode())
    (HERE/'proposal.json').write_bytes(raw)
    run('new-bootstrap',[PYTHON,'-B',HERE/'bootstrap_tools.py',BASE/'new-tools-02'])
    assert tool_tree(BASE/'new-tools-02/semgrep',python_site=True)==assembled
    for name in ('gitleaks','trufflehog','osv'):
        assert (BASE/'old-tools/scanners'/name).read_bytes()==(BASE/'new-tools-02/scanners'/name).read_bytes()
    assert tool_tree(BASE/'old-tools/npm/node_modules/npm')==tool_tree(BASE/'new-tools-02/npm/node_modules/npm')==policy['npmToolTree']
    assert manifest(BASE/'old-tools/preserved-upstream')==manifest(BASE/'new-tools-02/preserved-upstream')
    report={'status':'PASS','changes':changes,'old_original_package_tree':oldtree,
            'old_assembled_package_tree':policy['semgrepPackageTree'],'candidate_proposal_sha256':sha(raw),
            'old_file_count':len(oldmanifest),'new_file_count':len(newmanifest),'file_delta':delta,
            'assembled_file_delta':assembled_delta,'all_noncertifi_files_identical':True,
            'all_scanner_binaries_identical':True,'npm_tree_identical':True,'preserved_upstream_identical':True,
            'engine':engine,'old_new_environment':'same Python3.12.3, pip24.0 venv; glibc2.39; isolated fresh hash-required wheel-only targets'}
    (OUT/'candidate-proof.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ('file_delta','assembled_file_delta')},indent=2),flush=True)
except BaseException:
    (HERE/'semgrep-requirements-linux-py312.txt').write_bytes(original_req)
    (HERE/'proposal.json').write_bytes(subprocess.check_output(['git','show','HEAD:scripts/phase9/security_acceptance/proposal.json'],cwd=REPO))
    raise
