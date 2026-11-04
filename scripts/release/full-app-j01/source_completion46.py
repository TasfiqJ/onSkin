"""C46 finite current-source technical checks. Never owner/release acceptance."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

BASE = '20c761fa5e3fbf427fb33ab319218bd0c1d022bd'
TREE = '23563c36af990df5fc74d6a79507cfc24a1ff8ac'
PLAN = 'docs/brain/task-specs/M1X-46/SCOPE_PLAN.md'
DOC = 'docs/brain/task-specs/M1X-46/'
WORKLISTS = {'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md'}
PATHS = {
    DOC + name for name in ['CHANGE_LEDGER.json', 'TASK.md', 'COMPLETION_MATRIX.json',
                            'EXTERNAL_ACTIONS.md', 'FINAL_REPORT.md']
} | WORKLISTS | {
    'apps/mobile/src/app/shelf/manual.tsx',
    'apps/mobile/src/app/shelf/_layout.tsx',
    'apps/mobile/src/features/shelf/ShelfDataAvailabilityGate.tsx',
    'apps/mobile/src/features/shelf/compactManual46.test.ts',
    'apps/mobile/src/features/routine/connectedJourney46.test.ts',
    'apps/mobile/src/features/settings/exportConfirmation46.test.ts',
    'apps/mobile/src/lib/storage/privateKV.ts',
    'packages/decode-uri-component-compat/package.json',
    'packages/decode-uri-component-compat/index.cjs',
    'packages/decode-uri-component-compat/index.d.ts',
    'scripts/release/full-app-j01/source_completion46.py',
    'scripts/release/full-app-j01/source_completion46.test.py',
    'scripts/release/full-app-j01/security_completion46.test.mjs',
    '.github/workflows/quality.yml', 'PROGRESS.md', 'ONSKIN_BRAIN_HANDOFF.txt',
    'package.json', 'package-lock.json',
}
ROOT = Path(__file__).resolve().parents[3]


def require(value, code):
    if not value:
        raise ValueError('C46_' + code)


def git(*args, root=ROOT):
    return subprocess.check_output(['git', '--no-replace-objects', *args], cwd=root)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def document(raw):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, 'DUPLICATE_FIELD')
            result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=unique)


def check_map(value, baseline, contract):
    required = [(row['id'], row['name']) for row in baseline['rows'] if row['disposition'] == 'REQUIRED']
    require(len(required) == 38, 'BASELINE_COUNT')
    rows = value['required_rows']
    require([(r['id'], r['name']) for r in rows] == required, 'REQUIRED_IDENTITIES')
    for row in rows:
        require(row['acceptanceGranted'] is False, 'SELF_ACCEPTANCE')
        for field in ['source_paths', 'entrypoints', 'tests', 'gaps', 'dependencies', 'next_action', 'evidence_axes']:
            require(field in row, 'MISSING_ROW_' + field)
        release = row['evidence_axes']['release']
        require(isinstance(release, dict) and release['status'] == 'NO_GO' and release['accepted'] is False, 'RELEASE')
    gates = value['owner_gates']
    require([g['id'] for g in gates] == [g['id'] for g in contract['gates']], 'GATE_IDENTITIES')
    require(len(gates) == 18 and all(g['admitted'] is False for g in gates), 'GATE_ADMISSION')


def check_ledger(value, preimage):
    require(value['base'] == BASE and value['base_tree'] == TREE, 'BASE_IDENTITY')
    require(value['inventory_frozen'] is True, 'INVENTORY_NOT_FROZEN')
    rows = value['paths']
    names = [r['path'] for r in rows]
    require(len(set(names)) == len(names) and set(names) == PATHS, 'FINITE_PATHS')
    for row in rows:
        raw = preimage(row['path'])
        require(row['preimage_sha256'] == (sha(raw) if raw is not None else None), 'PREIMAGE:' + row['path'])
        require(all(row.get(k) for k in ['need', 'invariant', 'authority', 'planned_validation']), 'PATH_RECORD')
        require(row['authority'] == 'BRAIN-M1X-APP-COMPLETION46-AUTONOMOUS-01', 'AUTHORITY')


def validate(phase, root=ROOT):
    g = lambda *args: git(*args, root=root)
    require(g('rev-parse', BASE + '^{tree}').decode().strip() == TREE, 'BASE_TREE')
    # Hosted pull_request checkout may be GitHub's synthetic merge. Inspect the
    # actual source second parent only if the first is the exact accepted base.
    head = g('rev-parse', 'HEAD').decode().strip()
    parents = g('show', '-s', '--format=%P', head).decode().split()
    if len(parents) == 2:
        require(parents[0] == BASE, 'MERGE_BASE_DRIFT')
        require(g('rev-parse', head + '^{tree}') == g('rev-parse', parents[1] + '^{tree}'), 'MERGE_TREE_DRIFT')
        head = parents[1]
    require(not g('status', '--porcelain', '--untracked-files=normal').strip(), 'DIRTY_SOURCE')
    require(g('merge-base', BASE, head).decode().strip() == BASE, 'ANCESTRY')
    commits = g('rev-list', '--reverse', BASE + '..' + head).decode().split()
    require(2 <= len(commits) <= 24, 'COMMIT_INTERVAL')
    plan_commit = commits[0]
    changed = lambda a, b: set(g('diff', '--name-only', a, b).decode().splitlines())
    require(changed(BASE, plan_commit) == {PLAN}, 'FIRST_PLAN_ONLY')
    ledger = document((root / (DOC + 'CHANGE_LEDGER.json')).read_bytes())
    require(ledger['plan_commit'] == plan_commit, 'PLAN_COMMIT')
    plan_bytes = g('show', plan_commit + ':' + PLAN)
    require(sha(plan_bytes) == ledger['plan_sha256'] and (root / PLAN).read_bytes() == plan_bytes, 'PLAN_FROZEN')
    previous = BASE
    for commit in commits:
        require(g('show', '-s', '--format=%P', commit).decode().split() == [previous], 'LINEAR_ANCESTRY')
        if commit != plan_commit:
            require(PLAN not in changed(previous, commit), 'PLAN_REWRITE')
        previous = commit
    def preimage(path):
        spec = BASE + ':' + path
        if subprocess.run(['git', 'cat-file', '-e', spec], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode:
            return None
        return g('show', spec)
    check_ledger(ledger, preimage)
    union = set()
    for commit in commits[1:]:
        union |= changed(g('rev-parse', commit + '^').decode().strip(), commit)
    require(union <= PATHS and changed(BASE, head) <= PATHS | {PLAN}, 'UNDECLARED_CHANGE')
    # No route additions/removals. The canonical94-route test independently
    # verifies projected IDs and the retained inventory bytes.
    route_names = lambda ref: g('ls-tree', '-r', '--name-only', ref, 'apps/mobile/src/app').decode().splitlines()
    require(route_names(BASE) == route_names(head), 'ROUTE_PATH_DRIFT')
    baseline = document(g('show', BASE + ':docs/release/full-app-j01/matrix.v2.json'))
    contract = document(g('show', BASE + ':docs/release/full-app-j01/contract.v2.json'))
    check_map(document((root / (DOC + 'COMPLETION_MATRIX.json')).read_bytes()), baseline, contract)
    if phase == 'SOURCE_FROZEN':
        parent = g('rev-parse', head + '^').decode().strip()
        require(changed(parent, head) == WORKLISTS, 'LAST_SEAL_ONLY')
        # This proves a two-file-only source delta, not execution of tests.
        # The return packet separately binds actual run logs to this parent.
        subprocess.run(['node', 'scripts/phase4/build-source-worklist.mjs', '--strict', '--check'], cwd=root, check=True)
    else:
        require(not (union & WORKLISTS), 'PREMATURE_SEAL')
    return {'status': phase, 'head': head, 'tree': g('rev-parse', head + '^{tree}').decode().strip(),
            'base': BASE, 'plan': plan_commit, 'commits': len(commits), 'finite_paths': len(PATHS),
            'tested_source_parent': g('rev-parse', head + '^').decode().strip() if phase == 'SOURCE_FROZEN' else None,
            'qualification': 'TECHNICAL_SOURCE_ONLY_NOT_TEST_EXECUTION', 'acceptanceGranted': False, 'release': 'NO_GO'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase', choices=['PENDING', 'SOURCE_FROZEN'], default='SOURCE_FROZEN')
    args = parser.parse_args()
    print(json.dumps(validate(args.phase), sort_keys=True))
