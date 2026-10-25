import hashlib, importlib.util, json, os, pathlib, subprocess
TASK = pathlib.Path(__file__).resolve().parent
ROOT = TASK/'source'
OUT = TASK/'checkpoint-draft'
OUT.mkdir(exist_ok=True)
BASE = '14805e7f708297e72419035f517acc41ba52da70'
SOURCE = '90a2b90bc859172683fd4a352ddd4cb13b307e89'
def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, stderr=subprocess.PIPE)
def disk(path):
    return pathlib.Path('\\\\?\\'+str(path.absolute())) if os.name == 'nt' else path
def digest(raw):
    return hashlib.sha256(raw).hexdigest()
def tree(rev):
    rows = {}
    for entry in git('ls-tree', '-r', '-z', rev).split(b'\0'):
        if entry:
            meta, path = entry.split(b'\t', 1)
            mode, kind, blob = meta.decode().split()
            rows[path.decode()] = dict(mode=mode, kind=kind, blob=blob)
    return rows
assert git('rev-parse','HEAD').decode().strip() == SOURCE
assert not git('status','--porcelain=v1').strip()
base, source = tree(BASE), tree(SOURCE)
mutable_final = {'scripts/core05/adherence-source-contract.test.mjs',
    'scripts/core06/recommendation-admission-source-contract.test.mjs',
    'scripts/release/full-app-j01/check.py', 'docs/phase-4/generated/source-worklist.json',
    'docs/phase-4/generated/source-worklist.md', 'ONSKIN_BRAIN_HANDOFF.txt'}
conditional = {'package.json','package-lock.json','apps/mobile/package.json'}
rows = []
for path, record in source.items():
    assert record['kind'] == 'blob' and record['mode'] in ('100644','100755'), (path,record)
    raw = disk(ROOT/path).read_bytes()
    assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest() == record['blob'], path
    protected = path in base and path not in mutable_final
    if protected:
        assert record == base[path], path
    row = dict(path=path, **record, bytes=len(raw), sha256=digest(raw),
               inherited=path in base, protected_at_final=protected)
    if path in base and base[path] != record:
        before = git('show', BASE+':'+path)
        row['preimage'] = dict(**base[path], bytes=len(before), sha256=digest(before))
    rows.append(row)
spec = importlib.util.spec_from_file_location('proof_check', ROOT/'scripts/release/full-app-j01/check.py')
checker = importlib.util.module_from_spec(spec);spec.loader.exec_module(checker)
history = []
for commit in git('rev-list','--reverse',BASE+'..'+SOURCE).decode().splitlines():
    parent = git('rev-list','--parents','-n','1',commit).decode().split()
    assert len(parent) == 2
    entries = tree(commit)
    changed = {}
    for path in set(base)|set(entries):
        if base.get(path) != entries.get(path):
            assert path in entries and checker.allowed11(path), (commit,path)
            record = entries[path]
            assert record['mode'] == '100644' and record['kind'] == 'blob'
            raw = git('show',commit+':'+path)
            changed[path] = dict(**record, bytes=len(raw), sha256=digest(raw))
    for path, record in base.items():
        if path not in mutable_final | conditional:
            assert entries.get(path) == record, (commit,path)
    history.append(dict(commit=commit, parent=parent[1],
        tree=git('rev-parse',commit+'^{tree}').decode().strip(), changed_from_pr14=changed))
old = json.loads(disk(ROOT/'docs/brain/checkpoints/RELEASE-10/QUALITY-PROJECTIONS/source-proof.json').read_bytes())
absences = old['absences']
for path in absences:
    assert not disk(ROOT/path).exists() and not any(p == path or p.startswith(path+'/') for p in source), path
proof = dict(authorization='BRAIN-M103-SOURCE-RECOVERY11-CANDIDATE-01',
    status='SUBMITTED_REVIEW_REQUIRED', base=BASE, base_tree=git('rev-parse',BASE+'^{tree}').decode().strip(),
    source=SOURCE, source_tree=git('rev-parse',SOURCE+'^{tree}').decode().strip(),
    files=rows, protected_final_count=sum(r['protected_at_final'] for r in rows),
    intermediate_commits=history, absences=absences,
    dependency_history='Exact eight-node conditional candidate was proposed and restored; final package bytes equal PR14.',
    no_external_acceptance=True)
(OUT/'source-proof.json').write_bytes((json.dumps(proof,indent=2)+'\n').encode())
print(json.dumps(dict(source=SOURCE, source_tree=proof['source_tree'], files=len(rows),
    protected_final_count=proof['protected_final_count'], source_commits=len(history), bytes=sum(r['bytes'] for r in rows))))

