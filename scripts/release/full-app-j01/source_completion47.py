"""C47 exact current-source scope/seal verification. No runtime or owner admission."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess

HERE = Path(__file__).absolute().parent
ROOT = HERE.parents[2]
spec = importlib.util.spec_from_file_location('accepted_source_completion46', HERE / 'source_completion46.py')
accepted = importlib.util.module_from_spec(spec)
spec.loader.exec_module(accepted)
BASE = '02aa4ba879fb844f3ca0aa929591203ee45f4163'
TREE = '02f4b093d399631c4e36b32bf163fa543b61fc3e'
AUTH = 'BRAIN-M1X-NATIVE-RUNTIME47-AUTONOMOUS-01'
DOC = 'docs/brain/task-specs/M1X-47/'
PLAN = DOC + 'SCOPE_PLAN.md'
PLAN_COMMIT = 'a5b3edb572bf92310c555933f8c0db6300e1aecc'
PLAN_SHA256 = 'fb6527187151a5b86d8450e291c9be284188e2e6c5959d42a19ef4bfd49e36fd'
WORKLISTS = {'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md'}
# Finite independently enumerated scope; a ledger never grants its own paths.
PATHS = {
    PLAN, DOC + 'CHANGE_LEDGER.json', DOC + 'TASK.md',
    '.github/workflows/campaign47-native-runtime.yml',
    '.github/workflows/quality.yml', '.github/workflows/campaign46-technical.yml',
    'scripts/release/full-app-j01/native_runtime47.py',
    'scripts/release/full-app-j01/native_runtime47.test.py',
    'scripts/release/full-app-j01/native_ui47.swift',
    'scripts/release/full-app-j01/native_ui47.rb',
    'scripts/release/full-app-j01/native_workflow47.test.mjs',
    'scripts/release/full-app-j01/source_completion47.py',
    'scripts/release/full-app-j01/source_completion47.test.py',
    'scripts/release/full-app-j01/pods_compat47.py',
    'scripts/release/full-app-j01/pods_compat47.test.py',
    'scripts/release/full-app-j01/native_generated47.mjs',
    'scripts/release/full-app-j01/native_generated47.test.mjs',
    'docs/phase-9/ios-generated-input-succession47.v1.json',
    'scripts/phase9/ios-native-obligations47.json',
    'docs/USER_FLOW_TREE.md', 'PROGRESS.md', 'ONSKIN_BRAIN_HANDOFF.txt',
} | WORKLISTS


def require(value, code):
    if not value:
        raise ValueError('C47_' + code)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def commit(g, reference):
    require(re.fullmatch(r'[a-f0-9]{40}', reference), 'COMMIT_REFERENCE')
    raw = g('cat-file', 'commit', reference)
    require(hashlib.sha1(b'commit ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() == reference,
            'COMMIT_OBJECT_HASH')
    header = raw.split(b'\n\n', 1)[0].decode('utf-8').splitlines()
    trees = [line[5:] for line in header if line.startswith('tree ')]
    parents = [line[7:] for line in header if line.startswith('parent ')]
    require(len(trees) == 1 and all(re.fullmatch(r'[a-f0-9]{40}', value)
                                 for value in trees + parents), 'COMMIT_HEADER')
    return trees[0], parents


def check_plan(first_commit, first_delta, original, current):
    require(first_commit == PLAN_COMMIT and first_delta == {PLAN}, 'FIRST_PLAN_ONLY')
    require(sha(original) == PLAN_SHA256 and current == original, 'PLAN_FROZEN')


def check_scope(exercised, declared):
    require(exercised <= PATHS and exercised <= declared, 'UNDECLARED_CHANGED_PATH')


def check_ledger(value, preimage, exercised, phase):
    require(type(value.get('schema')) is int and value['schema'] == 1 and
            type(value.get('campaign')) is int and value['campaign'] == 47 and value.get('authorization') == AUTH and
            value.get('base') == BASE and value.get('base_tree') == TREE, 'LEDGER_IDENTITY')
    require(value.get('first_plan_commit') == PLAN_COMMIT and
            value.get('frozen_plan_sha256') == PLAN_SHA256, 'LEDGER_PLAN_IDENTITY')
    require(phase in ['SOURCE_PENDING', 'SOURCE_FROZEN'], 'PHASE')
    state = value.get('inventory_state')
    require(state in ['EXPLICIT_PREDECLARED_NOT_FINAL_FROZEN', 'FROZEN'] and
            (phase != 'SOURCE_FROZEN' or state == 'FROZEN'), 'INVENTORY_NOT_FROZEN')
    rows = value.get('paths')
    require(isinstance(rows, list) and rows and all(isinstance(row, dict) for row in rows), 'LEDGER_ROWS')
    names = [row.get('path') for row in rows]
    require(all(isinstance(name, str) for name in names) and len(names) == len(set(names)) and
            set(names) <= PATHS, 'FINITE_PATH_INVENTORY')
    check_scope(exercised, set(names))
    for row in rows:
        raw = preimage(row['path'])
        require(row.get('preimage_state') == ('ABSENT' if raw is None else 'PRESENT') and
                row.get('preimage_sha256') == (None if raw is None else sha(raw)) and
                row.get('preimage_bytes') == (None if raw is None else len(raw)), 'PREIMAGE:' + row['path'])
        require(all(isinstance(row.get(key), str) and row[key].strip()
                    for key in ['causal_need', 'invariant', 'validation']), 'PATH_PROVENANCE')
    return set(names)


def check_phase(phase, final_delta):
    require(phase in ['SOURCE_PENDING', 'SOURCE_FROZEN'], 'PHASE')
    if phase == 'SOURCE_FROZEN':
        require(final_delta == WORKLISTS, 'LAST_SEAL_ONLY')


def validate(phase, root=ROOT):
    root = Path(root).absolute()
    g = lambda *args: accepted.git(*args, root=root)
    accepted.check_git_metadata(g, root)
    require(re.fullmatch(r'(?:https://github\.com/|git@github\.com:)TasfiqJ/onSkin(?:\.git)?',
                         g('remote', 'get-url', 'origin').decode().strip(), re.I), 'REPOSITORY_IDENTITY')
    head = g('rev-parse', 'HEAD').decode().strip()
    expected = os.environ.get('C47_EXPECTED_HEAD', os.environ.get('C46_EXPECTED_HEAD', head))
    require(head == expected and re.fullmatch(r'[a-f0-9]{40}', head), 'EXPECTED_HEAD')
    require(commit(g, BASE)[0] == TREE, 'ACCEPTED_BASE_TREE')
    require(not g('status', '--porcelain', '--untracked-files=normal').strip(), 'DIRTY_SOURCE')
    commits = []
    cursor = head
    while cursor != BASE:
        require(cursor not in commits and len(commits) < 256, 'ACCEPTED_ANCESTRY')
        _, parents = commit(g, cursor)
        require(len(parents) == 1, 'APPEND_ONLY_NO_MERGE')
        commits.append(cursor)
        cursor = parents[0]
    commits.reverse()
    require(len(commits) >= 2, 'IMPLEMENTATION_COMMIT_REQUIRED')
    changed = lambda a, b: set(g('diff', '--name-only', a, b).decode().splitlines())
    plan = g('show', PLAN_COMMIT + ':' + PLAN)
    check_plan(commits[0], changed(BASE, commits[0]), plan, (root / PLAN).read_bytes())
    exercised = set()
    previous = BASE
    for current in commits:
        delta = changed(previous, current)
        require(current == PLAN_COMMIT or PLAN not in delta, 'PLAN_REWRITE')
        exercised |= delta
        previous = current
    inventory = accepted.verify_tracked_source(root, head, g)
    ledger = accepted.document(g('show', head + ':' + DOC + 'CHANGE_LEDGER.json'))
    def preimage(path):
        return g('show', BASE + ':' + path) if g('ls-tree', '-z', BASE, '--', path) else None
    declared = check_ledger(ledger, preimage, exercised, phase)
    if phase == 'SOURCE_FROZEN':
        require(declared == exercised, 'FROZEN_EXERCISED_INVENTORY')
    parent = commit(g, head)[1][0]
    check_phase(phase, changed(parent, head))
    if phase == 'SOURCE_FROZEN':
        subprocess.run(['node', 'scripts/phase4/build-source-worklist.mjs', '--strict', '--check'],
                       cwd=root, env=accepted.git_environment(), check=True, timeout=180)
    require(g('rev-parse', 'HEAD').decode().strip() == head, 'HEAD_RACE')
    return {'schema': 1, 'status': phase, 'head': head, 'tree': commit(g, head)[0],
            'base': BASE, 'base_tree': TREE, 'plan_commit': PLAN_COMMIT, 'plan_sha256': PLAN_SHA256,
            'source_inventory': inventory, 'finite_declared_paths': len(declared),
            'exercised_paths': sorted(exercised), 'commits': commits,
            'tested_source_parent': parent if phase == 'SOURCE_FROZEN' else None,
            'non_worklist_source_equal_to_tested_parent': phase == 'SOURCE_FROZEN',
            'qualification': 'TECHNICAL_CURRENT_SOURCE_ONLY_NOT_TEST_OR_NATIVE_EXECUTION',
            'historical_source46_validator_modified': False, 'acceptanceGranted': False, 'release': 'NO_GO'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase', choices=['SOURCE_PENDING', 'SOURCE_FROZEN'], default='SOURCE_FROZEN')
    args = parser.parse_args()
    print(json.dumps(validate(args.phase), sort_keys=True))
