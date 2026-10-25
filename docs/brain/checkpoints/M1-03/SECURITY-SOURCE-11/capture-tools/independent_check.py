import hashlib, json, pathlib, subprocess
TASK = pathlib.Path(__file__).resolve().parent
ROOT = pathlib.Path(r'C:/Users/jasim/Documents/ChatGPT/MasterV2Code/c11-independent-5ca49b38')
assert not (ROOT/'.git/objects/info/alternates').exists()
def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, stderr=subprocess.PIPE)
assert git('rev-parse','--is-shallow-repository').strip() == b'false'
assert not git('status','--porcelain=v1').strip()
files = [p for p in git('ls-files','-z').decode().split('\0') if p]
assert all((ROOT/p).is_file() for p in files)
results = []
def check(label, expected):
    argv = ['C:/Users/jasim/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',
            '-B','scripts/release/full-app-j01/check.py']
    r = subprocess.run(argv, cwd=ROOT, capture_output=True)
    for suffix, raw in [('stdout',r.stdout),('stderr',r.stderr)]:
        (TASK/'run-logs'/('independent-'+label+'.'+suffix+'.log')).write_bytes(raw)
    record = dict(case=label, argv=argv, cwd=str(ROOT), exit=r.returncode, expected_exit=expected,
        source=git('rev-parse','HEAD').decode().strip(),
        stdout_sha256=hashlib.sha256(r.stdout).hexdigest(),
        stderr_sha256=hashlib.sha256(r.stderr).hexdigest())
    results.append(record)
    (TASK/'run-logs/independent-progress.json').write_bytes((json.dumps(results,indent=2)+'\n').encode())
    print(json.dumps(record),flush=True)
    assert r.returncode == expected, r.stdout.decode(errors='replace')
check('current',0)
path = ROOT/'apps/mobile/src/features/notifications/useNotifications.ts'
original = path.read_bytes()
try:
    path.write_bytes(original+b'\n// unauthorized complete-checkout source mutation\n')
    check('tampered',1)
finally:
    path.write_bytes(original)
check('restored',0)
assert not git('status','--porcelain=v1').strip()
report = dict(qualification='INDEPENDENT_COMPLETE_CHECKOUT_SOURCE_GOVERNANCE_0_1_0',
    scope='Complete real tracked checkout and separate Git objects, original live governance checker only. No app/device/Security/database/release admission.',
    tracked_files=len(files), shallow=False, shared_object_store=False, clean_after=True,
    results=results, release='NO_GO')
(TASK/'run-logs/independent-complete-checkout.json').write_bytes((json.dumps(report,indent=2)+'\n').encode())
print(json.dumps(dict(qualified=True, tracked_files=len(files), scope=report['scope'])))

