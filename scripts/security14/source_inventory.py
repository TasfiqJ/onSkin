"""Read-only, versioned UNAPPLIED G97 crosswalk. Never installs a source manifest.

Git identities and externally pinned witnesses authenticate bytes, not Security
acceptance or a qualified signature. Python 3.9+, standard library only.
"""
import argparse
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import tempfile
import unicodedata

BASE = 'd0c5ad49ba22c8da7136d59a399589af1cea0e82'
TREE = '4cfe9c819df4c22fc5d19d79f9c0e89e0e24c973'
ORIGINAL = 'bbc28dc3d1f945191a81be56945b8bda7bb6ef73'
PREFIX = 'scripts/phase9/security_acceptance/'
PINS = {
    'source-manifest.json': '3142f0f5c74bc42fc4e1b2b2cb03de8142075a885199b22ecd7035118185b69d',
    'scan-targets.json.gz': '78c76b8b136feecb395f46a1113eff5c98214207dd8ebe7e339cc2002bfcdbd5',
    'proposal.json': '03a667b14f387dc1ca4356e875c4ff8f355b314dd09f045ef93375028543e896',
    'secret_scan.py': '30a04d2b2c7a4fa9aefacdea6796b20c7e1f332b61102d12a47878145e3590a5',
    'contract.py': 'a237518381c986bcced04271595b232c61291a534111d1f0603d8421b96a0b1a',
    'gitleaks.toml': 'f683584269dd6d1af30371c56b6a39def7343e0549f1f4c3c445932bcb075828',
    'workflow_contract.mjs': 'c10d31381ef6fca9c836d785e804178ba3f48e3e99a92e1f42078a99a58fc47a',
}
LIMIT = 64 * 1024**2

def need(ok, code):
    if not ok:
        raise ValueError(code)

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()

def parse(raw):
    def pairs(items):
        out = {}
        for key, value in items:
            need(key not in out, 'DUPLICATE_JSON')
            out[key] = value
        return out
    return json.loads(raw, object_pairs_hook=pairs,
                      parse_constant=lambda _: need(False, 'NONFINITE_JSON'))

def path_key(name):
    need(isinstance(name, str) and name and not name.startswith('/') and
         not re.search(r'\\|:|//|[\x00-\x1f\x7f]', name), 'UNSAFE_PATH')
    normalized = unicodedata.normalize('NFKC', name).casefold()
    need(not normalized.startswith('/') and not re.search(r'\\|:|//|[\x00-\x1f\x7f]', normalized), 'UNSAFE_PATH')
    for part in [*name.split('/'), *normalized.split('/')]:
        need(part not in ('', '.', '..') and part.casefold() != '.git' and
             part == part.strip() and not part.endswith('.') and
             not re.fullmatch(r'(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?', part, re.I),
             'UNSAFE_PATH')
    return normalized

def regular(path, limit=LIMIT):
    path = Path(path).absolute()
    for component in [path, *path.parents]:
        info = component.lstat()
        need(not stat.S_ISLNK(info.st_mode) and not getattr(info, 'st_file_attributes', 0) & 1024,
             'LINK_OR_REPARSE')
    before = path.stat()
    need(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and before.st_size <= limit,
         'INPUT_BOUND_OR_MODE')
    with path.open('rb') as stream:
        data = stream.read(limit + 1)
    after = path.stat()
    need(len(data) <= limit and (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) ==
         (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns), 'INPUT_RACE_OR_BOUND')
    return data

def git(root, *args, limit=LIMIT):
    """Finite metadata output, no shell, no worktree/index/object mutation."""
    with tempfile.TemporaryFile() as errors:
        with subprocess.Popen(['git', '-c', 'core.fsmonitor=false', '-c', 'core.longpaths=true', *args],
                              cwd=root, stdout=subprocess.PIPE, stderr=errors,
                              env=dict(os.environ, GIT_TERMINAL_PROMPT='0')) as process:
            try:
                data = process.stdout.read(limit + 1)
                need(len(data) <= limit, 'GIT_OUTPUT_BOUND')
                need(process.wait(timeout=90) == 0, 'GIT_ERROR')
                return data
            finally:
                if process.poll() is None:
                    process.kill()
                    process.wait()

def nul(raw):
    need(not raw or raw.endswith(b'\0'), 'TRUNCATED_GIT')
    return raw[:-1].split(b'\0') if raw else []

def tree_entries(raw):
    out = {}; seen = set()
    for entry in nul(raw):
        metadata, name = entry.split(b'\t', 1)
        mode, kind, blob = metadata.decode('ascii').split()
        name = name.decode('utf-8'); key = path_key(name)
        need(key not in seen, 'TREE_COLLISION')
        seen.add(key)
        need(mode in ('100644', '100755') and kind == 'blob' and
             re.fullmatch('[0-9a-f]{40}', blob), 'TREE_MODE_OR_ID')
        out[name] = dict(mode=mode, blob=blob)
    return out

def snapshot(root, commit):
    need(re.fullmatch('[0-9a-f]{40}', commit), 'COMMIT_FORMAT')
    entries = tree_entries(git(root, 'ls-tree', '-rz', '--full-tree', commit))
    unique = sorted({r['blob'] for r in entries.values()}); identities = {}
    # Read one batch stream incrementally. No source content is retained or emitted.
    with tempfile.TemporaryFile() as requests, tempfile.TemporaryFile() as errors:
        requests.write(('\n'.join(unique) + '\n').encode()); requests.seek(0)
        with subprocess.Popen(['git', 'cat-file', '--batch'], cwd=root, stdin=requests,
                              stdout=subprocess.PIPE, stderr=errors) as process:
            try:
                total = 0
                for oid in unique:
                    header = process.stdout.readline(200).decode('ascii').split()
                    need(len(header) == 3 and header[:2] == [oid, 'blob'], 'BLOB_HEADER')
                    size = int(header[2]); total += size
                    need(0 <= size <= LIMIT and total <= 2 * 1024**3, 'BLOB_BOUND')
                    digest = hashlib.sha256(); git_digest = hashlib.sha1()
                    git_digest.update(('blob '+str(size)+'\0').encode()); remaining = size
                    while remaining:
                        chunk = process.stdout.read(min(remaining, 1024**2))
                        need(bool(chunk), 'TRUNCATED_BLOB')
                        digest.update(chunk); git_digest.update(chunk); remaining -= len(chunk)
                    need(process.stdout.read(1) == b'\n' and git_digest.hexdigest() == oid, 'BLOB_IDENTITY')
                    identities[oid] = dict(sha256=digest.hexdigest(), bytes=size)
                need(process.stdout.read(1) == b'' and process.wait(timeout=90) == 0, 'BLOB_STREAM')
            finally:
                if process.poll() is None:
                    process.kill(); process.wait()
    return {name: dict(**row, **identities[row['blob']]) for name, row in entries.items()}

def manifest_rows(raw, expected_sha):
    need(sha(raw) == expected_sha, 'MANIFEST_REPLACED')
    rows = parse(raw); need(isinstance(rows, list) and len(rows) <= 100000, 'MANIFEST_SCHEMA')
    out = {}; seen = set()
    for row in rows:
        need(isinstance(row, dict) and set(row) == {'path', 'sha256'}, 'MANIFEST_ROW')
        key = path_key(row['path']); need(key not in seen, 'MANIFEST_COLLISION'); seen.add(key)
        need(isinstance(row['sha256'], str) and re.fullmatch('[0-9a-f]{64}', row['sha256']), 'MANIFEST_SHA')
        out[row['path']] = row['sha256']
    return out

def coverage_rows(raw, expected_sha, expected):
    need(sha(raw) == expected_sha, 'COVERAGE_REPLACED')
    with gzip.GzipFile(fileobj=io.BytesIO(raw)) as stream:
        body = stream.read(LIMIT + 1)
    need(len(body) <= LIMIT, 'COVERAGE_BOUND'); data = parse(body)
    need(set(data) == {'schema', 'targets', 'exclusions', 'explicitTargets'} and data['schema'] == 1,
         'COVERAGE_SCHEMA')
    out = {}; seen = set()
    for group in ('targets', 'exclusions'):
        need(isinstance(data[group], list), 'COVERAGE_SCHEMA')
        for row in data[group]:
            need(set(row) == {'path', 'kind', 'reason'}, 'COVERAGE_ROW')
            key = path_key(row['path']); need(key not in seen, 'COVERAGE_COLLISION'); seen.add(key)
            need((group == 'targets' and (row['kind'], row['reason']) in
                 [('required', 'source-text-or-generic-input'), ('auxiliary', 'opaque-jpeg-selected-by-generic-rules')]) or
                 (group == 'exclusions' and row['kind'] == 'excluded' and row['reason'] in
                  ['binary-png', 'binary-jpeg', 'gzip-source-witness', 'reviewed-scanner-engine-artifact']), 'COVERAGE_KIND')
            if group == 'exclusions':
                name = row['path']; reason = row['reason']
                compressed = {PREFIX+n for n in ('history.json.gz', 'scan-targets.json.gz', 'test-fixtures.json.gz', 'legacy-sbom-fixture.json.gz')}
                compressed.add('scripts/phase9/tooling-security-backports/originals.json.gz')
                need((reason == 'binary-png' and name.endswith('.png')) or
                     (reason == 'binary-jpeg' and name.endswith('.jpg')) or
                     (reason == 'gzip-source-witness' and name in compressed) or
                     (reason == 'reviewed-scanner-engine-artifact' and name == PREFIX+'semgrep-engine-linux-x86_64.tar.gz'),
                     'COVERAGE_BROAD_EXCLUSION')
            out[row['path']] = dict(group=group, kind=row['kind'], reason=row['reason'])
    need(set(out) == set(expected), 'COVERAGE_OMISSION')
    sql = sorted(n for n, r in out.items() if r['kind'] == 'required' and n.startswith('supabase/tests/') and n.endswith('.sql'))
    need(data['explicitTargets'] == sql, 'COVERAGE_SQL_OMISSION')
    return out

def reconcile(expected, old, current, coverage):
    need(set(expected) <= set(old), 'ORIGINAL_SOURCE_OMISSION')
    need(all(old[n]['sha256'] == h for n, h in expected.items()), 'ORIGINAL_SOURCE_HASH')
    changes = []
    for name in sorted(set(expected) | set(current)):
        before = old.get(name) if name in expected else None; after = current.get(name)
        if before == after:
            continue
        status = 'added' if before is None else 'removed' if after is None else 'changed'
        changes.append(dict(path=name, status=status, before=before, after=after,
                            content_changed=before is None or after is None or before['sha256'] != after['sha256'],
                            mode_changed=bool(before and after and before['mode'] != after['mode']),
                            original_coverage=coverage.get(name), candidate_disposition='UNREVIEWED_INCLUDE_NO_EXCLUSION'))
    added = [r for r in changes if r['status'] == 'added']; removed = [r for r in changes if r['status'] == 'removed']
    renames = [dict(from_path=a['path'], to_path=b['path'], blob=a['before']['blob'],
                    certainty='IDENTICAL_BLOB_CANDIDATE_NOT_RECLASSIFICATION')
               for a in removed for b in added if a['before']['blob'] == b['after']['blob']]
    return changes, renames

def inventory(root):
    need(git(root, 'rev-parse', BASE+'^{tree}').decode().strip() == TREE, 'PR17_TREE')
    original = snapshot(root, ORIGINAL); current = snapshot(root, BASE)
    witnesses = []
    for leaf, digest in PINS.items():
        name = PREFIX + leaf; raw = regular(Path(root)/name)
        need(sha(raw) == digest and current[name]['sha256'] == digest, 'PROTECTED_WITNESS_DRIFT')
        witnesses.append(dict(path=name, sha256=digest, mode=current[name]['mode'], blob=current[name]['blob']))
    expected = manifest_rows(regular(Path(root)/(PREFIX+'source-manifest.json')), PINS['source-manifest.json'])
    expected.update({PREFIX+'source-manifest.json': PINS['source-manifest.json'], PREFIX+'proposal.json': PINS['proposal.json']})
    coverage = coverage_rows(regular(Path(root)/(PREFIX+'scan-targets.json.gz')), PINS['scan-targets.json.gz'], expected)
    changes, renames = reconcile(expected, original, current, coverage)
    directories = {''}
    for name in current:
        parts=name.split('/')[:-1]
        directories.update('/'.join(parts[:i]) for i in range(1,len(parts)+1))
    absences = []
    for directory in sorted(directories):
        for leaf in ('.gitleaksignore', '.semgrepignore', '.gitignore'):
            name = (directory+'/' if directory else '')+leaf
            if name not in expected:
                need(name not in current and not os.path.lexists(Path(root)/name), 'PROTECTED_ABSENCE_CHANGED')
                absences.append(name)
    from collections import Counter
    return dict(schema=1, status='UNAPPLIED_SOURCE_INVENTORY_DRIFT', acceptanceGranted=False,
                original_source=ORIGINAL, source=BASE, tree=TREE,
                signature_status='HASH_AND_GIT_WITNESSES_ONLY_NO_QUALIFIED_SIGNATURE',
                witnesses=witnesses, expected_files=len(expected), actual_files=len(current),
                protected_source_witnesses=[dict(path=n, **r) for n,r in current.items()
                    if n.startswith(PREFIX) or n in ('.github/workflows/security.yml', '.github/workflows/g97-security-acceptance.yml',
                                                   'docs/phase-9/security-advisory-exceptions.json')],
                unchanged_files=len(set(expected) & set(current))-sum(r['status']=='changed' for r in changes),
                counts=dict(Counter(r['status'] for r in changes)), changes=changes,
                identical_blob_rename_candidates=renames, protected_absences=absences,
                candidate_scope='EVERY_ADDITION_CHANGE_MODE_AND_REMOVAL_REQUIRES_ORIGINAL_OWNER_REVIEW',
                original_contract_expected='SOURCE_INVENTORY_DRIFT')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args=parser.parse_args()
    try:
        result=inventory(args.repo)
        with args.output.open('xb') as stream: stream.write(canonical(result)+b'\n')
        print(json.dumps(dict(status=result['status'], expected=result['expected_files'], actual=result['actual_files'], counts=result['counts'], output_sha256=sha(canonical(result)+b'\n'))))
        return 0  # Complete comparison; never a Security PASS.
    except (ValueError, KeyError, TypeError, OSError, subprocess.SubprocessError):
        print('{"status":"INCOMPLETE","acceptanceGranted":false}')
        return 2

if __name__ == '__main__':
    raise SystemExit(main())
