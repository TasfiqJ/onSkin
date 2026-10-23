"""Verify this exact technical change and committed checkpoint; grants no admission."""
import hashlib, json, pathlib, subprocess, sys

BASE='eaa47d7a1882dc395100bd0a958550a8beef406b'
ANCHOR='cccff31a39e59cb0e647accd2ff124547c523db97ed0c136bb56a99e8745743e'
PREFIX='docs/brain/checkpoints/M1-03/SECURITY-CERTIFI-TOOLCHAIN-01/'
TECH={'scripts/phase9/security_acceptance/semgrep-requirements-linux-py312.txt','scripts/phase9/security_acceptance/proposal.json'}
ROOT=pathlib.Path(subprocess.check_output(['git','rev-parse','--show-toplevel']).decode().strip())
CHECKPOINT=ROOT/PREFIX
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def sha(b):return hashlib.sha256(b).hexdigest()
def read_base(name):return git('show',BASE+':'+name)
inputs=CHECKPOINT/'inputs/members'
assert sha((inputs/'TASK_MANIFEST.json').read_bytes())==ANCHOR
pre=json.loads((inputs/'SOURCE_PREIMAGES.json').read_bytes())
assert sha(json.dumps(pre,sort_keys=True,separators=(',',':')).encode())=='7c7499572becd4cc57bd96071e91fb6c033660022224f96e2474232d9a450833'
manifest=json.loads((inputs/'TASK_MANIFEST.json').read_bytes())
for entry in manifest['files']:
    assert sha((inputs/entry['path']).read_bytes())==entry['sha256']
for entry in pre['files']:
    b=read_base(entry['path'])
    assert len(b)==entry['bytes'] and sha(b)==entry['sha256']
    assert git('rev-parse',BASE+':'+entry['path']).decode().strip()==entry['git_blob']
    if entry['path'] not in TECH|{'ONSKIN_BRAIN_HANDOFF.txt'}:
        assert (ROOT/entry['path']).read_bytes()==b
witness=json.loads((inputs/'UPSTREAM_CERTIFI_WITNESS.json').read_bytes())
requirement='scripts/phase9/security_acceptance/semgrep-requirements-linux-py312.txt'
old=read_base(requirement)
expected=old.replace(witness['old_requirements_line'].encode(),witness['new_requirements_line'].encode())
assert old.count(witness['old_requirements_line'].encode())==1
assert (ROOT/requirement).read_bytes()==expected
proposal='scripts/phase9/security_acceptance/proposal.json'
before=json.loads(read_base(proposal));after=json.loads((ROOT/proposal).read_bytes())
proof=json.loads((CHECKPOINT/'evidence/reproduction/attempt02/candidate-proof.json').read_bytes())
assert proof['status']=='PASS' and proof['all_noncertifi_files_identical']
assert proof['all_scanner_binaries_identical'] and proof['npm_tree_identical'] and proof['preserved_upstream_identical']
assert all(r['path'].startswith(('certifi/','certifi-2026.10.18.dist-info/','certifi-2026.10.19.dist-info/')) for r in proof['file_delta']+proof['assembled_file_delta'])
assert after['semgrepBuild']['requirementsSha256']==sha(expected)==proof['changes']['requirementsSha256']
for key in ('requirementsSha256','originalPackageTree'):
    assert after['semgrepBuild'][key]==proof['changes'][key]
    after['semgrepBuild'][key]=before['semgrepBuild'][key]
assert after['semgrepPackageTree']==proof['changes']['semgrepPackageTree']
after['semgrepPackageTree']=before['semgrepPackageTree']
assert after==before
assert after['notAfter']=='2026-10-21T00:00:00Z' and after['state']=='INACTIVE_PROPOSAL'
actual_raw=(ROOT/proposal).read_bytes();expected_raw=read_base(proposal)
for oldhash,newhash in ((before['semgrepBuild']['requirementsSha256'],proof['changes']['requirementsSha256']),
                       (before['semgrepBuild']['originalPackageTree'],proof['changes']['originalPackageTree']),
                       (before['semgrepPackageTree'],proof['changes']['semgrepPackageTree'])):
    assert expected_raw.count(oldhash.encode())==1
    expected_raw=expected_raw.replace(oldhash.encode(),newhash.encode())
assert actual_raw==expected_raw
allowed=TECH|{'ONSKIN_BRAIN_HANDOFF.txt','docs/phase-4/generated/source-worklist.json','docs/phase-4/generated/source-worklist.md'}
changed=set(git('diff','--name-only',BASE).decode().splitlines())
changed.update(git('ls-files','--others','--exclude-standard').decode().splitlines())
assert all(p in allowed or p.startswith(PREFIX) for p in changed),sorted(changed)
for commit in git('rev-list',BASE+'..HEAD').decode().splitlines():
    assert len(git('rev-list','--parents','-n','1',commit).decode().split())==2
    touched=git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines()
    assert all(p in allowed or p.startswith(PREFIX) for p in touched)
    assert not git('diff-tree','--diff-filter=D','--no-commit-id','--name-only','-r',commit)
assert git('branch','--show-current').decode().strip()=='stage/m1-gate-recovery'
sums_path=CHECKPOINT/'SHA256SUMS.json'
if sums_path.exists():
    sums=json.loads(sums_path.read_bytes())
    expected_paths={r['path'] for r in sums['files']}
    actual_paths={p.relative_to(CHECKPOINT).as_posix() for p in CHECKPOINT.rglob('*') if p.is_file() and p.name!='SHA256SUMS.json'}
    assert actual_paths==expected_paths,(actual_paths-expected_paths,expected_paths-actual_paths)
    for row in sums['files']:
        p=CHECKPOINT/row['path'];b=p.read_bytes()
        assert p.stat().st_nlink==1 and not p.is_symlink() and len(b)==row['bytes'] and sha(b)==row['sha256']
        if '--committed' in sys.argv:
            assert git('show','HEAD:'+PREFIX+row['path'])==b
assert '--committed' not in sys.argv or not git('status','--porcelain=v1','--untracked-files=all').strip()
print(json.dumps({'status':'PASS','preimages':len(pre['files']),'requirements_edit':'one exact certifi line',
                  'proposal_edit':'three exact hash substitutions only','changed_paths':len(changed),
                  'committed_checkpoint': '--committed' in sys.argv,'source_security_admitted':False}))
