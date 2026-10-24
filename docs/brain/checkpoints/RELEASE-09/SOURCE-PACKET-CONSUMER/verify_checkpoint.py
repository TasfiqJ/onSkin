"""Release09 source/evidence consistency. An external digest is mandatory; no acceptance."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import stat
import subprocess
import sys
import unicodedata

HERE = Path(__file__).absolute().parent
ROOT = HERE.parents[4]
BASE = 'd08347f0011672cd309d835628c094b5e9f4725d'
SOURCE = '3d951357163d2abd1b02b456c6f52cfb0dbf70ce'
SOURCE_TREE = '02c58ff4cc87f7a9feb1b1fd5828ac4406cd0f5e'
CHECKPOINT = 'docs/brain/checkpoints/RELEASE-09/SOURCE-PACKET-CONSUMER/'
EXISTING = {'scripts/docs/source-packet-audit.mjs', 'docs/generated/source-packet-audit.json',
    'docs/generated/source-packet-audit.md', '.github/workflows/quality.yml',
    'scripts/release/full-app-j01/check.py', 'scripts/release/full-app-j01/test_contract.py',
    'ONSKIN_BRAIN_HANDOFF.txt'}
NEW = {'docs/release/full-app-j01/source-packet-supersession09.v1.json',
    'docs/release/full-app-j01/consumer-scope09.md', 'scripts/docs/source-packet-supersession09.test.mjs',
    'scripts/release/full-app-j01/source_consumer09.test.py'}
PREFIXES = ('docs/brain/contracts/RELEASE-09/', 'docs/brain/task-specs/RELEASE-09/', CHECKPOINT)


def require(ok, label):
    if not ok: raise ValueError(label)


def sha(raw): return hashlib.sha256(raw).hexdigest()
def blob(raw): return hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
def git(*args): return subprocess.check_output(['git', *args], cwd=ROOT)
def allowed(path): return path in EXISTING or path in NEW or path.startswith(PREFIXES)


def good_name(path):
    require(isinstance(path, str) and path and not re.search(r'(^/|\\|:|(^|/)\.\.?(/|$))', path), 'UNSAFE_PATH')
    require(all(x and x == x.strip() and not x.endswith('.') for x in path.split('/')), 'UNSAFE_SEGMENT')
    return unicodedata.normalize('NFKC', path).casefold()


def regular(path):
    for part in [path]+list(path.parents):
        meta = part.lstat()
        require(not stat.S_ISLNK(meta.st_mode) and not (getattr(meta, 'st_file_attributes', 0)&1024), 'LINK_OR_REPARSE:'+str(part))
        require(stat.S_ISREG(meta.st_mode) if part == path else stat.S_ISDIR(meta.st_mode), 'NOT_REGULAR:'+str(part))
    return path.read_bytes()


def pairs(rows):
    result = {}
    for key, value in rows:
        require(key not in result, 'JSON_DUPLICATE:'+key); result[key] = value
    return result


def load(path): return json.loads(regular(path).decode('utf-8'), object_pairs_hook=pairs)


def tree(rev):
    result = {}
    for row in git('ls-tree', '-r', '-z', rev).split(b'\0'):
        if not row: continue
        meta, path = row.split(b'\t', 1); mode, kind, oid = meta.decode().split()
        path = path.decode(); good_name(path)
        result[path] = dict(mode=mode, kind=kind, blob=oid)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--expected-manifest-sha256', required=True)
    args = parser.parse_args()
    require(re.fullmatch('[0-9a-f]{64}', args.expected_manifest_sha256), 'EXTERNAL_DIGEST_FORMAT')
    require(sha(regular(HERE/'manifest.json')) == args.expected_manifest_sha256, 'EXTERNAL_MANIFEST_MISMATCH')
    manifest = load(HERE/'manifest.json')
    require(manifest['schema_version'] == 1 and manifest['authority'] ==
            'BRAIN-RELEASE09-SOURCE-PACKET-CI-CANDIDATE-01', 'MANIFEST_AUTHORITY')
    names = [row['path'] for row in manifest['files']]
    require(len(names) == len(set(good_name(p) for p in names)), 'INVENTORY_COLLISION')
    actual = set()
    for path in HERE.rglob('*'):
        metadata = path.lstat()
        require(not stat.S_ISLNK(metadata.st_mode) and not (getattr(metadata, 'st_file_attributes', 0)&1024), 'INVENTORY_LINK')
        require(stat.S_ISDIR(metadata.st_mode) or stat.S_ISREG(metadata.st_mode), 'INVENTORY_SPECIAL')
        if path.is_file() and path != HERE/'manifest.json': actual.add(path.relative_to(HERE).as_posix())
    require(set(names) == actual, 'FILES_MISSING_OR_EXTRA')
    for row in manifest['files']:
        raw = regular(HERE/row['path'])
        require(sha(raw) == row['sha256'] and len(raw) == row['bytes'] and blob(raw) == row['blob']
                and row['mode'] == '100644', 'FILE_IDENTITY:'+row['path'])
    handoff = regular(ROOT/'ONSKIN_BRAIN_HANDOFF.txt')
    require(sha(handoff) == manifest['handoff_sha256'], 'HANDOFF_IDENTITY')
    proof = load(HERE/'source-proof.json')
    require(proof['base'] == BASE and proof['source'] == SOURCE and proof['source_tree'] == SOURCE_TREE, 'SOURCE_ANCHOR')
    require(git('rev-parse', BASE+'^{tree}').decode().strip() == '0998881bc543840395dca375769ea1b7c9a8d4c7', 'BASE_TREE')
    require(git('rev-parse', SOURCE+'^{tree}').decode().strip() == SOURCE_TREE, 'SOURCE_TREE')
    subprocess.run(['git', 'merge-base', '--is-ancestor', SOURCE, 'HEAD'], cwd=ROOT, check=True)
    baseline, source, head = tree(BASE), tree(SOURCE), tree('HEAD')
    changed = sorted(p for p in set(baseline)|set(source) if baseline.get(p) != source.get(p))
    require(changed == [row['path'] for row in proof['changes']], 'SOURCE_DIFF_INVENTORY')
    for row in proof['changes']:
        path = row['path']; require(allowed(path), 'SOURCE_SCOPE:'+path)
        for label, rev, entries in [('before', BASE, baseline), ('after', SOURCE, source)]:
            info = row[label]
            if info is None: require(path not in entries, 'SOURCE_PREIMAGE:'+path); continue
            raw = git('show', rev+':'+path)
            require(all(entries[path][k] == info[k] for k in ('mode', 'kind', 'blob')) and
                    sha(raw) == info['sha256'] and len(raw) == info['bytes'], 'SOURCE_BYTES:'+path)
        require(head.get(path) == source[path] and sha(regular(ROOT/path)) == row['after']['sha256'], 'SOURCE_CHANGED_AFTER_MEASUREMENT:'+path)
    protected = {p:v for p,v in baseline.items() if not allowed(p)}
    digest = sha(json.dumps(protected, sort_keys=True, separators=(',', ':')).encode())
    require(len(protected) == proof['protected_files'] and digest == proof['protected_flat_digest'], 'PROTECTED_INVENTORY')
    commits = git('rev-list', '--reverse', BASE+'..HEAD').decode().splitlines()
    measured_index = commits.index(SOURCE)
    for n, commit in enumerate(commits):
        entries = tree(commit)
        require({p:v for p,v in entries.items() if not allowed(p)} == protected, 'PROTECTED_COMMIT:'+commit)
        for path in proof['protected_absences']:
            require(not git('ls-tree', commit, '--', path).strip(), 'ABSENCE_COMMIT:'+path)
        for raw in git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', BASE, commit).split(b'\0')[::2]:
            if raw:
                meta=raw.decode().split(); require(meta[1] == '100644' and meta[-1] in ('A', 'M'), 'COMMIT_MODE_OR_DELETE')
        for path in git('diff-tree', '--no-commit-id', '--name-only', '-r', commit).decode().splitlines():
            require(allowed(path), 'COMMIT_SCOPE:'+path)
            if n > measured_index:
                require(path == 'ONSKIN_BRAIN_HANDOFF.txt' or path.startswith(CHECKPOINT), 'EVIDENCE_ONLY_TAIL:'+path)
    for path in proof['protected_absences']: require(not (ROOT/path).exists(), 'WORKING_ABSENCE:'+path)
    for path in git('diff', '--name-only', 'HEAD').decode().splitlines():
        require(path == 'ONSKIN_BRAIN_HANDOFF.txt' or path.startswith(CHECKPOINT), 'DIRTY_SOURCE:'+path)
    for path in git('ls-files', '--others', '--exclude-standard', '-z').decode().split('\0'):
        if path: require(path.startswith(CHECKPOINT), 'UNTRACKED_SOURCE:'+path); regular(ROOT/path)
    # Source-test evidence is parsed rather than borrowed from the Release08 checkpoint.
    rows = [json.loads(line) for line in (HERE/'logs/negative-final.log').read_text(encoding='utf-8').splitlines() if line.strip()]
    negatives = [row for row in rows if row.get('expected_exit') == 1]
    require(rows[0]['case'] == 'authentic-current' and rows[0]['exit'] == 0 and
            rows[-2]['case'] == 'authentic-restored' and rows[-2]['exit'] == 0 and
            len(negatives) == 151 and all(row['exit'] == 1 and row['result']['release'] == 'NO_GO' for row in negatives), 'NEGATIVE151_PROOF')
    require(rows[-1]['qualification'] == 'BUNDLE_FIXTURES_ONLY_NOT_INDEPENDENT_CHECKOUT', 'FIXTURE_QUALIFICATION')
    producer = [json.loads(line) for line in (HERE/'logs/source-fixtures-current.log').read_text().splitlines() if line.strip()]
    require(producer[0]['case'] == 'authentic-current' and producer[0]['exit'] == 0 and
            producer[-2]['case'] == 'authentic-restored' and producer[-2]['exit'] == 0 and
            producer[-1]['passed'] and producer[-1]['rejected'] >= 30, 'PRODUCER_FIXTURES')
    for path in (HERE/'receipts').glob('*.json'):
        receipt=load(path)
        if receipt.get('head') == SOURCE and 'log_sha256' in receipt:
            raw = regular(HERE/'logs'/receipt['log'])
            require(sha(raw) == receipt['log_sha256'] and len(raw) == receipt['log_bytes'], 'RAW_RECEIPT:'+path.name)
    subprocess.run([sys.executable, '-B', 'scripts/release/full-app-j01/check.py'], cwd=ROOT, check=True)
    print(json.dumps(dict(verified=True, source=SOURCE, source_tree=SOURCE_TREE,
        delivery_head=git('rev-parse', 'HEAD').decode().strip(), source_paths=len(changed),
        protected_files=len(protected), negative_cases=151, checkpoint_files=len(names),
        source_acceptance='REVIEW_REQUIRED', release='NO_GO', independent_complete_checkout='NOT_QUALIFIED')))


if __name__ == '__main__':
    try: main()
    except Exception as error:
        print('VERIFICATION_FAILED: '+str(error), file=sys.stderr)
        sys.exit(1)
