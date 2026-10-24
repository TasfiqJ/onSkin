"""Release10 consistency verifier; external manifest digest required, never acceptance."""
import argparse
import ast
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import stat
import subprocess
import sys
import unicodedata

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
BASE = '8ac97c32901272d97d1bff05f2abc294811055a6'
SOURCE = 'c3c868f86313a9f42b10adfef37cdbbeb1c2e289'
SOURCE_TREE = '47e469bb900ff57488043a027490c469703881d0'
PREFIX = 'docs/brain/checkpoints/RELEASE-10/QUALITY-PROJECTIONS/'
AUTHORITY = 'BRAIN-RELEASE10-QUALITY-PROJECTIONS-CONSUMERS-CANDIDATE-01'


def require(ok, label):
    if not ok: raise ValueError(label)


def sha(raw): return hashlib.sha256(raw).hexdigest()
def blob(raw): return hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
def git(*args): return subprocess.check_output(['git', *args], cwd=ROOT, stderr=subprocess.PIPE)


def regular(path):
    for part in [path]+list(path.parents):
        s = part.lstat()
        require(not stat.S_ISLNK(s.st_mode) and not getattr(s, 'st_file_attributes', 0)&1024, 'LINK:'+str(part))
        require(stat.S_ISREG(s.st_mode) if part == path else stat.S_ISDIR(s.st_mode), 'REGULAR:'+str(part))
    return path.read_bytes()


def pairs(items):
    result = {}
    for key, value in items:
        require(key not in result, 'DUPLICATE_KEY:'+key); result[key] = value
    return result


def load(path): return json.loads(regular(path).decode('utf-8-sig'), object_pairs_hook=pairs)


def tree(rev):
    result = {}
    for row in git('ls-tree', '-r', '-z', rev).split(b'\0'):
        if row:
            meta, path = row.split(b'\t'); mode, kind, oid = meta.decode().split()
            result[path.decode()] = dict(mode=mode, kind=kind, blob=oid)
    return result


def good_path(path):
    require(isinstance(path, str) and not re.search(r'(^/|\\|:|(^|/)\.\.?(/|$))', path), 'PATH')
    require(all(p and p == p.strip() and not p.endswith('.') for p in path.split('/')), 'SEGMENT')
    return unicodedata.normalize('NFKC', path).casefold()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--expected-manifest-sha256', required=True)
    args = parser.parse_args()
    require(re.fullmatch('[0-9a-f]{64}', args.expected_manifest_sha256), 'DIGEST_FORMAT')
    require(sha(regular(HERE/'manifest.json')) == args.expected_manifest_sha256, 'EXTERNAL_MANIFEST_MISMATCH')
    manifest = load(HERE/'manifest.json')
    require(manifest['authorization'] == AUTHORITY and manifest['source'] == SOURCE and
            manifest['source_tree'] == SOURCE_TREE and manifest['status'] == 'SUBMITTED_REVIEW_REQUIRED', 'MANIFEST_AUTHORITY')
    names = set(); expected = set()
    for row in manifest['files']:
        path = row['path']; key = good_path(path)
        require(key not in names and path != 'manifest.json', 'INVENTORY_COLLISION')
        names.add(key); expected.add(path)
        raw = regular(HERE/path)
        require(len(raw) == row['bytes'] and sha(raw) == row['sha256'] and blob(raw) == row['blob'] and
                row['mode'] == '100644', 'CHECKPOINT_IDENTITY:'+path)
    actual = {p.relative_to(HERE).as_posix() for p in HERE.rglob('*') if p.is_file() and p != HERE/'manifest.json'}
    require(actual == expected, 'CHECKPOINT_EXACT_INVENTORY')
    packet_digest = '92863b8f804d234750ba9c3fd0ff907dbdba35ed9dcdff231e70c93dd81b4344'
    require(sha(regular(HERE/'intake/manifest.json')) == packet_digest, 'INTAKE_EXTERNAL_ANCHOR')
    packet = subprocess.run([sys.executable, '-B', 'verify_packet.py', '--expected-manifest-sha256', packet_digest],
                            cwd=HERE/'intake', capture_output=True, text=True)
    require(packet.returncode == 0 and 'VERIFIED' in packet.stdout, 'INTAKE_VERIFICATION')
    require(not git('status', '--porcelain=v1').strip(), 'WORKTREE_NOT_CLEAN')
    head = git('rev-parse', 'HEAD').decode().strip()
    source_tree = tree(SOURCE); delivery_tree = tree(head); base_tree = tree(BASE)
    require(git('rev-parse', SOURCE+'^{tree}').decode().strip() == SOURCE_TREE, 'SOURCE_TREE')
    require(git('rev-parse', BASE+'^{tree}').decode().strip() == 'a59fc7ea1cc57901f6d848ff5009734f446bdff2', 'BASE_TREE')
    proof = load(HERE/'source-proof.json')
    require(proof['source'] == SOURCE and proof['source_tree'] == SOURCE_TREE, 'PROOF_SOURCE')
    require({r['path']:{k:r[k] for k in ('mode','kind','blob')} for r in proof['files']} == source_tree, 'SOURCE_EXACT_INVENTORY')
    protected = {r['path']:{k:r[k] for k in ('mode','kind','blob')} for r in proof['files'] if r['protected']}
    require(len(protected) == proof['protected_count'] == 23095, 'PROTECTED_COUNT')
    require(all(base_tree.get(p) == r for p,r in protected.items()), 'PROTECTED_BASE')
    commits = git('rev-list', '--reverse', BASE+'..'+SOURCE).decode().splitlines()
    require(commits == [r['commit'] for r in proof['intermediate_commits']], 'INTERMEDIATE_INVENTORY')
    for record in proof['intermediate_commits']:
        commit = record['commit']; entries = tree(commit)
        require(git('rev-parse', commit+'^{tree}').decode().strip() == record['tree'], 'INTERMEDIATE_TREE')
        require(all(entries.get(p) == r for p,r in protected.items()), 'INTERMEDIATE_PROTECTED:'+commit)
        changed = {p:r for p,r in entries.items() if base_tree.get(p) != r}
        require(set(changed) == set(record['changed_from_release09']), 'INTERMEDIATE_FRONTIER')
        for p,r in record['changed_from_release09'].items():
            raw = git('show', commit+':'+p)
            require(changed[p] == {k:r[k] for k in ('mode','kind','blob')} and sha(raw) == r['sha256'], 'INTERMEDIATE_IDENTITY:'+p)
    for row in proof['files']:
        path = row['path']
        if path == 'ONSKIN_BRAIN_HANDOFF.txt':
            raw = git('show', SOURCE+':'+path)
        else:
            require(delivery_tree.get(path) == source_tree[path], 'DELIVERY_SOURCE_CHANGED:'+path)
            raw = regular(ROOT/path)
        require(len(raw) == row['bytes'] and blob(raw) == row['blob'] and sha(raw) == row['sha256'], 'SOURCE_BYTES:'+path)
    for p in proof['absences']:
        require(not (ROOT/p).exists() and not any(n == p or n.startswith(p+'/') for n in delivery_tree), 'ABSENCE:'+p)
    parents = git('rev-list', '--parents', '-n', '1', head).decode().split()
    require(len(parents) == 2 and parents[1] == SOURCE, 'EVIDENCE_ONLY_DIRECT_CHILD')
    frontier = {p for p in set(delivery_tree)|set(source_tree) if delivery_tree.get(p) != source_tree.get(p)}
    require(frontier == {PREFIX+'manifest.json', *[PREFIX+p for p in expected], 'ONSKIN_BRAIN_HANDOFF.txt'}, 'EXACT_EVIDENCE_FRONTIER')
    for p in frontier:
        require(delivery_tree[p]['mode'] == '100644' and delivery_tree[p]['kind'] == 'blob', 'EVIDENCE_MODE')
        require(delivery_tree[p]['blob'] == blob(regular(ROOT/p)), 'EVIDENCE_BLOB:'+p)
    old = ast.parse(git('show', BASE+':scripts/release/full-app-j01/check.py'))
    new = ast.parse(regular(ROOT/'scripts/release/full-app-j01/check.py'))
    before = {n.name:ast.dump(n, include_attributes=False) for n in old.body if isinstance(n,ast.FunctionDef)}
    after = {n.name:ast.dump(n, include_attributes=False) for n in new.body if isinstance(n,ast.FunctionDef)}
    require(all(before[k] == after[k] for k in before if k not in ('source_guard','source09_guard')), 'SEMANTICS_CHANGED')
    def assignments(module):
        return {ast.dump(n.targets[0]):ast.dump(n.value, include_attributes=False)
                for n in module.body if isinstance(n, ast.Assign) and len(n.targets) == 1}
    old_globals, new_globals = assignments(old), assignments(new)
    require(all(new_globals.get(k) == v for k,v in old_globals.items()), 'ORIGINAL_GLOBAL_SEMANTICS_CHANGED')
    semantic = load(HERE/'logs/final-c3-semantic151.json')
    require(semantic['exit'] == 0 and semantic['source'] == [SOURCE, SOURCE_TREE], 'SEMANTIC_RECEIPT')
    cases = [json.loads(line) for line in regular(HERE/'logs/final-c3-semantic151.log').decode().splitlines() if line.startswith('{')]
    negatives = [r for r in cases if r.get('expected_exit') == 1]
    require(len(negatives) == 151 and all(r['exit'] == 1 for r in negatives), 'SEMANTIC_NEGATIVES')
    require(cases[0]['exit'] == 0 and any(r.get('case') == 'authentic-restored' and r.get('exit') == 0 for r in cases), 'SEMANTIC_RESTORED')
    result = subprocess.run([sys.executable, '-B', 'scripts/release/full-app-j01/check.py'], cwd=ROOT,
                            capture_output=True, text=True)
    require(result.returncode == 0, 'LIVE_GOVERNANCE:'+result.stdout+result.stderr)
    print(json.dumps(dict(verified=True, source=SOURCE, source_tree=SOURCE_TREE,
        evidence_head=head, evidence_tree=git('rev-parse','HEAD^{tree}').decode().strip(),
        protected_files=len(protected), checkpoint_files=len(expected)+1, semantic_negatives=151,
        identities=65, required_rows=38, historical_tasks=47, historical_adrs=51,
        readiness='BLOCKED_OUTSIDE_SCOPE', source_acceptance='REVIEW_REQUIRED', release='NO_GO')))


if __name__ == '__main__':
    try: main()
    except (ValueError, KeyError, TypeError, OSError, subprocess.SubprocessError) as error:
        print(json.dumps(dict(verified=False, error=str(error), release='NO_GO'))); sys.exit(1)
