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
    'apps/mobile/src/lib/auth/localAccountIsolation.ts',
    'apps/mobile/src/lib/auth/sessionOwner.ts',
    'apps/mobile/src/lib/auth/privateMutationRecovery46.test.ts',
    'apps/mobile/src/features/photos/photoDeleteJournal.c08b2.test.ts',
    'apps/mobile/src/features/photos/photoDeleteR3.integration.test.ts',
    'apps/mobile/src/features/photos/photoDeleteWithdrawal.c08b2.test.ts',
    'apps/mobile/src/features/routine/planSourceFence44.test.ts',
    'apps/mobile/src/features/settings/localPrivateDataFence44.test.ts',
    'apps/mobile/src/features/shelf/detailActionSheet.campaign26.test.ts',
    'apps/mobile/src/features/shelf/intakeRecovery.campaign25.test.ts',
    'apps/mobile/src/features/shelf/ownedBottleVersion38.test.ts',
    'apps/mobile/src/features/shelf/postDispatchCommit28.test.ts',
    'apps/mobile/src/features/shelf/shelfRoutes.test.ts',
    'apps/mobile/src/features/today/optionalChangeJournal41.test.ts',
    'apps/mobile/src/lib/storage/privateKV.test.ts',
    'apps/mobile/src/lib/storage/privateKVCommitFence28.test.ts',
    'apps/mobile/src/lib/storage/privateKVSourceFence44.test.ts',
    'packages/decode-uri-component-compat/package.json',
    'packages/decode-uri-component-compat/index.cjs',
    'packages/decode-uri-component-compat/index.d.ts',
    'scripts/release/full-app-j01/source_completion46.py',
    'scripts/release/full-app-j01/source_completion46.test.py',
    'scripts/release/full-app-j01/security_completion46.test.mjs',
    'scripts/release/full-app-j01/native_completion46.mjs',
    'scripts/release/full-app-j01/native_completion46.test.mjs',
    'scripts/release/full-app-j01/c46-rules/owasp-top-ten-current.yaml',
    '.github/workflows/quality.yml', '.github/workflows/campaign46-technical.yml', 'PROGRESS.md', 'ONSKIN_BRAIN_HANDOFF.txt',
    'package.json', 'package-lock.json',
}
ROOT = Path(__file__).resolve().parents[3]
CLOSURE_AUTH = 'BRAIN-C46-CURRENT-NATIVE-SECURITY-CLOSURE-02'
SUBMITTED = 'deafce53190f8437867a4c969cb85b0ec8e183d5'
SUBMITTED_TREE = '832a196ca7b6dda4a9888ade5680e8ba211c6020'
ORIGINAL_COMMITS = [
    '5b635c9d822f862b50c03f923c441e9b22161ff7',
    '517ae0727ba2364a33b85f21647553786f84b4c8',
    '940428ad64893ea553e68c1e9bb2ecea10ec698c',
    '6db6a9a6f48dac40282a878461b3543e5c7dcf6c',
    'a8b305b186e2beff20065e05b27f23b8fd1d637c',
    SUBMITTED,
]
# Explicit exercised amendment inventory. Never derived from an untrusted ledger.
CLOSURE_PATHS = {
    DOC + 'CHANGE_LEDGER.json', DOC + 'TASK.md',
    DOC + 'CLOSURE02_REPORT.md', DOC + 'CLOSURE02_QUALITY_COVERAGE.json',
    DOC + 'CLOSURE02_SECURITY_REPORT.json', DOC + 'EXTERNAL_ACTIONS.md',
    'scripts/release/full-app-j01/source_completion46.py',
    'scripts/release/full-app-j01/source_completion46.test.py',
    '.github/workflows/quality.yml', '.github/workflows/campaign46-technical.yml',
    'scripts/e2e/formula-driver-coverage46.test.mjs',
    'scripts/release/full-app-j01/mounted_journey46.mjs',
    'scripts/release/full-app-j01/mounted_journey46.test.mjs',
    'apps/mobile/src/features/onboarding/AgeReverificationRights.integration.test.ts',
    'apps/mobile/src/features/photos/photoDeleteR3.integration.test.ts',
    'apps/mobile/src/features/photos/photoDeleteWithdrawal.c08b2.test.ts',
    'apps/mobile/src/features/settings/localPrivateDataFence44.test.ts',
    'apps/mobile/src/features/today/optionalChange41.test.ts',
    'apps/mobile/src/lib/storage/privateKVCommitFence28.test.ts',
    'scripts/release/full-app-j01/patch-expo-collection-bounds46.mjs',
    'scripts/release/full-app-j01/patch-expo-collection-bounds46.test.mjs',
    'scripts/release/full-app-j01/fixtures46/expo-cli57.0.32/DevToolsPlugin.schema.cjs',
    'scripts/release/full-app-j01/fixtures46/expo-cli57.0.32/DevToolsPluginCliExtensionResults.cjs',
    'package.json', 'docs/phase-9/ios-sdk-lock-succession46.v1.json',
    'scripts/phase9/ios-privacy-lock-succession46.mjs',
    'scripts/phase9/ios-privacy-lock-succession46.test.mjs',
    'scripts/release/full-app-j01/native_current46.mjs',
    'scripts/phase9/ios-native-obligations46.json',
    'scripts/phase9/ios-privacy-contract.mjs',
    'scripts/phase9/ios-privacy-source-audit.mjs',
    'scripts/phase5/check-native-config.mjs',
    'scripts/phase9/store-build-inspect.mjs',
    'scripts/phase9/release-smoke.mjs',
    'scripts/phase9/release-install-wiring46.test.mjs',
    'scripts/release/full-app-j01/workflow_context46.py',
    'scripts/release/full-app-j01/workflow_context46.test.py',
    'PROGRESS.md', 'ONSKIN_BRAIN_HANDOFF.txt',
} | WORKLISTS


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


def source_head(g):
    # Hosted pull_request checkout may be GitHub's synthetic merge. Inspect the
    # actual source second parent only if the first is the exact accepted base.
    head = g('rev-parse', 'HEAD').decode().strip()
    parents = g('show', '-s', '--format=%P', head).decode().split()
    if len(parents) == 2:
        require(parents[0] == BASE, 'MERGE_BASE_DRIFT')
        require(g('rev-parse', head + '^{tree}') == g('rev-parse', parents[1] + '^{tree}'), 'MERGE_TREE_DRIFT')
        head = parents[1]
    return head


def check_git_metadata(g, root):
    # Git's ordinary ancestry views must not be changed by local graft/replace
    # metadata. Historical and current objects still receive exact hash checks.
    require(g('rev-parse', '--is-shallow-repository').decode().strip() == 'false',
            'SHALLOW_SOURCE')
    for name in ['info/grafts', 'objects/info/alternates']:
        path = Path(g('rev-parse', '--git-path', name).decode().strip())
        if not path.is_absolute():
            path = root / path
        require(not path.exists() and not path.is_symlink(), 'GIT_METADATA:' + name)
    require(not g('for-each-ref', '--format=%(refname)', 'refs/replace').strip(),
            'REPLACE_REFS')


def check_closure_ledger(value, preimage):
    require(value['authorization'] == CLOSURE_AUTH, 'CLOSURE_AUTHORITY')
    require(value['predecessor_source'] == SUBMITTED and
            value['predecessor_tree'] == SUBMITTED_TREE, 'CLOSURE_PREDECESSOR')
    require(value['inventory_frozen'] is True, 'CLOSURE_INVENTORY_NOT_FROZEN')
    rows = value['paths']
    names = [r['path'] for r in rows]
    require(len(set(names)) == len(names) and set(names) == CLOSURE_PATHS, 'CLOSURE_FINITE_PATHS')
    for row in rows:
        raw = preimage(row['path'])
        require(row['preimage_ref'] == SUBMITTED and
                row['preimage_sha256'] == (sha(raw) if raw is not None else None) and
                row['bytes'] == (len(raw) if raw is not None else None), 'CLOSURE_PREIMAGE:' + row['path'])
        require(row['authority'] == CLOSURE_AUTH and
                all(row.get(k) for k in ['need', 'invariant', 'planned_validation']), 'CLOSURE_PATH_RECORD')


def check_seal_lineage(phase, commits, changed, parent, tree, records):
    """Admit only explicit historical seals and a new final two-file seal.

    Generation/source equivalence is checked separately. This never claims
    execution of tests from commit shape or a ledger boolean.
    """
    observed = []
    for commit in commits:
        delta = changed(parent(commit), commit)
        if delta & WORKLISTS:
            require(delta == WORKLISTS, 'MIXED_OR_PARTIAL_SEAL')
            observed.append(commit)
    if phase == 'SOURCE_FROZEN':
        require(commits[-1] in observed and commits[-1] != SUBMITTED, 'NEW_FINAL_SEAL_REQUIRED')
        historical = observed[:-1]
    else:
        require(commits[-1] not in observed, 'PENDING_AT_SEAL')
        historical = observed
    names = [r['commit'] for r in records]
    require(names == historical and len(set(names)) == len(names), 'HISTORICAL_SEAL_INVENTORY')
    require(SUBMITTED in historical, 'ORIGINAL_SEAL_MISSING')
    for row in records:
        commit = row['commit']
        require(row['tested_source'] == parent(commit) and row['tree'] == tree(commit),
                'HISTORICAL_SEAL_IDENTITY')
        if commit == SUBMITTED:
            require(row['tested_source'] == ORIGINAL_COMMITS[-2] and
                    row['tree'] == SUBMITTED_TREE, 'ORIGINAL_SEAL_IDENTITY')


def validate(phase, root=ROOT):
    g = lambda *args: git(*args, root=root)
    check_git_metadata(g, root)
    require(g('rev-parse', BASE + '^{tree}').decode().strip() == TREE, 'BASE_TREE')
    head = source_head(g)
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
    closure = ledger.get('closure02')
    require(closure is not None, 'CLOSURE_AMENDMENT_REQUIRED')
    if closure is not None:
        require(commits[:len(ORIGINAL_COMMITS)] == ORIGINAL_COMMITS and
                len(commits) > len(ORIGINAL_COMMITS), 'ORIGINAL_SIX_COMMITS')
        require(g('rev-parse', SUBMITTED + '^{tree}').decode().strip() == SUBMITTED_TREE,
                'SUBMITTED_TREE')
        def closure_preimage(path):
            spec = SUBMITTED + ':' + path
            if subprocess.run(['git', 'cat-file', '-e', spec], cwd=root,
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode:
                return None
            return g('show', spec)
        check_closure_ledger(closure, closure_preimage)
        parent = lambda c: g('rev-parse', c + '^').decode().strip()
        tree = lambda c: g('rev-parse', c + '^{tree}').decode().strip()
        check_seal_lineage(phase, commits, changed, parent, tree, closure['historical_seals'])
    union = set()
    for commit in commits[1:]:
        union |= changed(g('rev-parse', commit + '^').decode().strip(), commit)
    allowed = PATHS | (CLOSURE_PATHS if closure is not None else set())
    require(union <= allowed and changed(BASE, head) <= allowed | {PLAN}, 'UNDECLARED_CHANGE')
    if closure is not None:
        extension = set()
        for commit in commits[len(ORIGINAL_COMMITS):]:
            extension |= changed(g('rev-parse', commit + '^').decode().strip(), commit)
        require(extension <= CLOSURE_PATHS, 'UNDECLARED_CLOSURE_CHANGE')
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
    elif closure is None:
        require(not (union & WORKLISTS), 'PREMATURE_SEAL')
    return {'status': phase, 'head': head, 'tree': g('rev-parse', head + '^{tree}').decode().strip(),
            'base': BASE, 'plan': plan_commit, 'commits': len(commits), 'finite_paths': len(allowed),
            'closure_authority': CLOSURE_AUTH if closure is not None else None,
            'preserved_submission': SUBMITTED if closure is not None else None,
            'tested_source_parent': g('rev-parse', head + '^').decode().strip() if phase == 'SOURCE_FROZEN' else None,
            'qualification': 'TECHNICAL_SOURCE_ONLY_NOT_TEST_EXECUTION', 'acceptanceGranted': False, 'release': 'NO_GO'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase', choices=['PENDING', 'SOURCE_FROZEN'], default='SOURCE_FROZEN')
    args = parser.parse_args()
    print(json.dumps(validate(args.phase), sort_keys=True))
