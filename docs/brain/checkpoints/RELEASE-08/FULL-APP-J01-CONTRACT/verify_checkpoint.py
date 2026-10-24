"""Verify exact source and checkpoint bytes. Consistency is not external acceptance."""
import argparse
import hashlib
import json
from pathlib import Path
import stat
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
BASE = '50f25abeafaa6127e105e2a9d825e6d15dc1dcdb'
SOURCE = 'f0f743e5d8db586a1f9d98e417adb36416ede9fa'
PREFIXES = ('docs/release/full-app-j01/', 'scripts/release/full-app-j01/',
            'docs/brain/contracts/RELEASE-08/', 'docs/brain/task-specs/RELEASE-08/',
            'docs/brain/checkpoints/RELEASE-08/FULL-APP-J01-CONTRACT/')
DOCS = {f'docs/{x}.md' for x in ['MASTER_PLAN','PRODUCT_REQUIREMENTS','FEATURE_INDEX','ROADMAP','DECISIONS']}


def sha(raw): return hashlib.sha256(raw).hexdigest()
def git(*args): return subprocess.check_output(['git',*args], cwd=ROOT)
def load(path): return json.loads(path.read_bytes())
def allowed(path): return path in DOCS or path == 'ONSKIN_BRAIN_HANDOFF.txt' or path.startswith(PREFIXES)


def tree(rev):
    result = {}
    for line in git('ls-tree','-r',rev).decode().splitlines():
        meta,path = line.split('\t',1)
        mode,kind,blob = meta.split()
        result[path] = dict(mode=mode,kind=kind,blob=blob)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--expected-manifest-sha256', required=True)
    args = parser.parse_args()
    assert sha((HERE/'manifest.json').read_bytes()) == args.expected_manifest_sha256, 'External manifest mismatch'
    manifest = load(HERE/'manifest.json')
    paths = {x['path'] for x in manifest['files']}
    assert len(paths) == len(manifest['files'])
    actual = {p.relative_to(HERE).as_posix() for p in HERE.rglob('*') if p.is_file() and p.name!='manifest.json'}
    assert paths == actual, 'Missing/unlisted checkpoint file'
    for x in manifest['files']:
        p = HERE/x['path']
        assert '..' not in Path(x['path']).parts and not Path(x['path']).is_absolute()
        for part in [p]+list(p.parents):
            s = part.lstat()
            assert not stat.S_ISLNK(s.st_mode) and not (getattr(s,'st_file_attributes',0)&1024)
        raw = p.read_bytes()
        assert sha(raw)==x['sha256'] and len(raw)==x['bytes']
        assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==x['blob']
        assert x['mode']=='100644'
    proof = load(HERE/'source-proof.json')
    assert proof['base']==BASE and proof['source']==SOURCE
    assert git('rev-parse',SOURCE+'^{tree}').decode().strip()==proof['source_tree']
    subprocess.run(['git','merge-base','--is-ancestor',SOURCE,'HEAD'],cwd=ROOT,check=True)
    old,new,head = tree(BASE),tree(SOURCE),tree('HEAD')
    changed = sorted(p for p in set(old)|set(new) if old.get(p)!=new.get(p))
    assert changed == [x['path'] for x in proof['changes']]
    for x in proof['changes']:
        p=x['path']; assert allowed(p) and new[p]['mode']=='100644'
        for label,rev,entries in [('before',BASE,old),('after',SOURCE,new)]:
            if x[label] is None:
                assert p not in entries
                continue
            raw=git('show',rev+':'+p)
            assert all(entries[p][k]==x[label][k] for k in ['mode','kind','blob'])
            assert sha(raw)==x[label]['sha256'] and len(raw)==x[label]['bytes']
        assert head.get(p)==new[p], 'Source changed after measurement: '+p
        assert sha((ROOT/p).read_bytes())==x['after']['sha256'], 'Working source differs: '+p
    protected_old={p:v for p,v in old.items() if not allowed(p)}
    protected_head={p:v for p,v in head.items() if not allowed(p)}
    assert protected_old==protected_head and len(protected_old)==proof['protected_files']
    assert sha(json.dumps(protected_old,sort_keys=True).encode())==proof['protected_flat_digest']
    for x in proof['protected_frontier']:
        actual=git('ls-tree','HEAD','--',x['path']).decode().strip()
        meta,path=actual.split('\t',1)
        assert path==x['path'] and meta.split()==[x['mode'],x['kind'],x['blob']]
    for x in proof['absences']:
        assert (not git('ls-tree',BASE,'--',x['path']).strip())==x['base_absent']
        assert (not git('ls-tree',SOURCE,'--',x['path']).strip())==x['source_absent']
        own_new_directory = any((x['path']+'/').startswith(prefix) for prefix in PREFIXES)
        if x['source_absent'] and not own_new_directory:
            assert not git('ls-tree','HEAD','--',x['path']).strip()
    commits=git('rev-list','--reverse',BASE+'..HEAD').decode().splitlines()
    for commit in commits:
        for line in git('diff-tree','--no-commit-id','--name-status','-r',commit).decode().splitlines():
            status,p=line.split('\t',1)
            assert allowed(p) and status[0] not in 'DRC', (commit,p)
        # Descendants of the measured source are evidence-only tails.
        if commit!=SOURCE and commits.index(commit)>commits.index(SOURCE):
            for p in git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines():
                assert p.startswith(PREFIXES[-1]) or p=='ONSKIN_BRAIN_HANDOFF.txt', (commit,p)
    for receipt in HERE.glob('receipts/*.json'):
        r=load(receipt)
        assert r['head']==SOURCE and r['tree']==proof['source_tree'] and r['status_before']==''
        # The slow original Security run can overlap preparation of this new checkpoint.
        # Its real after-status is retained; only this task's untracked evidence is allowed.
        assert all(line == '?? docs/brain/checkpoints/RELEASE-08/' or
                   line.startswith('?? '+PREFIXES[-1]) for line in r['status_after'].splitlines())
        raw=(HERE/'logs'/r['log']).read_bytes()
        assert sha(raw)==r['log_sha256'] and len(raw)==r['log_bytes']
    cases=[json.loads(line) for line in (HERE/'logs/negative-final.log').read_text(encoding='utf-8').splitlines() if line.strip()]
    assert cases[0]['case']=='authentic-current' and cases[0]['exit']==0
    assert cases[-2]['case']=='authentic-restored' and cases[-2]['exit']==0
    negative=[x for x in cases if x.get('expected_exit')==1]
    assert len(negative)==151 and all(x['exit']==1 and x['result']['release']=='NO_GO' for x in negative)
    assert cases[-1]['passed'] is True and cases[-1]['qualification']=='BUNDLE_FIXTURES_ONLY_NOT_INDEPENDENT_CHECKOUT'
    command=[sys.executable,'-B',str(ROOT/'scripts/release/full-app-j01/check.py')]
    subprocess.run(command,cwd=ROOT,check=True)
    print(json.dumps(dict(verified=True,source=SOURCE,source_tree=proof['source_tree'],
        changed_paths=len(changed),protected_frontier=len(proof['protected_frontier']),
        protected_files=proof['protected_files'],negative_cases=151,release='NO_GO',
        self_acceptance=False,checkpoint_files=len(paths))))


if __name__=='__main__':
    main()
