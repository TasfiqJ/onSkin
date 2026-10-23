import datetime, hashlib, json, os, pathlib, platform, subprocess, sys, time

BASE = pathlib.Path('/tmp/onskin-m103-certifi-0fd3eeace36a492bb97dfcd8d99231aa')
REPO = BASE / 'repo'
CTX = pathlib.Path(__file__).resolve().parent
OUT = CTX / 'reproduction'
OUT.mkdir(exist_ok=False)
env = {'PATH': str(BASE/'venv/bin')+':/usr/local/bin:/usr/bin:/bin',
       'HOME': str(BASE/'home'), 'LANG': 'C.UTF-8', 'PYTHONDONTWRITEBYTECODE': '1',
       'NPM_CONFIG_REGISTRY': 'https://registry.npmjs.org/', 'NPM_CONFIG_USERCONFIG': '/dev/null'}
(BASE/'home').mkdir()
def run(name, args, cwd=REPO, timeout=900):
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    t = time.monotonic()
    with (OUT/(name+'.stdout.log')).open('wb') as stdout, (OUT/(name+'.stderr.log')).open('wb') as stderr:
        p = subprocess.run(args, cwd=cwd, env=env, stdout=stdout, stderr=stderr, timeout=timeout)
    result = {'command': list(map(str,args)), 'cwd': str(cwd), 'started_utc': started,
              'exit': p.returncode, 'elapsed_seconds': round(time.monotonic()-t,3)}
    (OUT/(name+'.receipt.json')).write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result), flush=True)
    return p.returncode

def git(*args): return subprocess.check_output(['git',*args],cwd=REPO,env=env).decode().strip()
assert git('rev-parse','HEAD') == 'eaa47d7a1882dc395100bd0a958550a8beef406b'
assert git('rev-parse','HEAD^{tree}') == '7abcf80b45c88bad08f8411405c744c55d727093'
assert not git('status','--porcelain=v1','--untracked-files=all')
pre = json.loads((CTX/'SOURCE_PREIMAGES.json').read_bytes())
for f in pre['files']:
    b=(REPO/f['path']).read_bytes()
    assert len(b)==f['bytes'] and hashlib.sha256(b).hexdigest()==f['sha256']
assert not [p for p in (REPO/'.git/objects').rglob('*') if p.is_file() and p.stat().st_nlink != 1]
assert not [p for p in REPO.rglob('*') if p.is_file() and p.stat().st_nlink != 1]
python=BASE/'venv/bin/python'
run('environment', [str(python),'-B','-c',
    'import sys,platform,hashlib,pathlib,json,pip; print(json.dumps({"python":sys.version,"executable":sys.executable,"platform":platform.platform(),"libc":platform.libc_ver(),"pip":pip.__version__,"python_sha256":hashlib.sha256(pathlib.Path(sys.executable).resolve().read_bytes()).hexdigest()},indent=2))'])
run('environment-packages', ['dpkg-query','-W','python3.12','python3.12-venv','python3-pip-whl','libc6'])
run('environment-wheels', ['sha256sum','/usr/share/python-wheels/pip-24.0-py3-none-any.whl','/usr/share/python-wheels/setuptools-68.1.2-py3-none-any.whl'])
rc = run('old-bootstrap', [str(python),'-B','scripts/phase9/security_acceptance/bootstrap_tools.py',str(BASE/'old-tools')])
if rc:
    print((OUT/'old-bootstrap.stderr.log').read_text()[-10000:], flush=True)
    sys.exit(rc)
sys.path.insert(0,str(REPO/'scripts/phase9/security_acceptance'))
from contract import tool_tree
policy=json.loads((REPO/'scripts/phase9/security_acceptance/proposal.json').read_bytes())
actual=tool_tree(BASE/'old-tools/semgrep',python_site=True)
assert actual==policy['semgrepPackageTree']
report={'status':'PASS','old_assembled_package_tree':actual,'old_original_package_tree':policy['semgrepBuild']['originalPackageTree'],
        'original_tree_verified_by':'unchanged bootstrap_tools.install_engine before assembly',
        'requirements_sha256':hashlib.sha256((REPO/'scripts/phase9/security_acceptance/semgrep-requirements-linux-py312.txt').read_bytes()).hexdigest()}
(OUT/'old-proof.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report),flush=True)
