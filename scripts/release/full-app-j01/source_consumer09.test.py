"""Bounded real Git-delta fixtures; not an independent complete-checkout qualification."""
import ast
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('release09_check', HERE/'check.py')
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)
ROOT = check.ROOT


def main():
    old = check.git('show', check.RELEASE08+':scripts/release/full-app-j01/check.py').decode()
    new = (HERE/'check.py').read_text(encoding='utf-8')
    def functions(source):
        return {node.name: ast.dump(node, include_attributes=False) for node in ast.parse(source).body
                if isinstance(node, ast.FunctionDef)}
    before, after = functions(old), functions(new)
    assert all(before[key] == after[key] for key in before if key != 'source_guard')
    assert (HERE/'test_contract.py').read_bytes() == check.git(
        'show', check.RELEASE08+':scripts/release/full-app-j01/test_contract.py')
    rejected = 0
    for path in ['../escape', '/absolute', 'C:/drive', 'docs\\escape',
                 'docs/brain/contracts/RELEASE-09/../escape',
                 'docs/brain/contracts/RELEASE-09/./escape',
                 '.github/workflows/security.yml', 'package.json',
                 'docs/release/full-app-j01/contract.v1.json',
                 'docs/brain/checkpoints/RELEASE-08/FULL-APP-J01-CONTRACT/verify_checkpoint.py']:
        assert not check.allowed09(path), path
        print(json.dumps(dict(case='unauthorized-path', path=path, rejected=True)))
        rejected += 1
    workflow = '.github/workflows/quality.yml'
    audit = 'scripts/docs/source-packet-audit.mjs'
    before_workflow = check.git('show', check.RELEASE08+':'+workflow)
    exact_workflow = before_workflow.replace(b'      - name: Verify tooling security backports\n', check.RELEASE09_STEP.lstrip(b'\n')+b'\n      - name: Verify tooling security backports\n')
    with tempfile.TemporaryDirectory(prefix='onskin-git09-') as temporary:
        fixture = Path(temporary)
        def git(*args):
            return subprocess.check_output(['git', '-c', 'core.autocrlf=false', *args],
                                           cwd=fixture, stderr=subprocess.PIPE)
        def put(path, raw):
            p = fixture/path; p.parent.mkdir(parents=True, exist_ok=True); p.write_bytes(raw)
        git('init', '--quiet')
        baseline = {workflow: before_workflow, audit: b'baseline\n',
                    'scripts/phase9/security-protected.py': b'protected\n',
                    'docs/MASTER_PLAN.md': b'protected notice\n'}
        for path, raw in baseline.items(): put(path, raw)
        git('add', '--all'); tree = git('write-tree').decode().strip()
        def reset_fixture():
            # Restore only this fresh fixture's index and explicitly tracked files.
            git('read-tree', tree)
            for path, raw in baseline.items(): put(path, raw)
            for path in ['.github/workflows/other.yml', 'docs/release/full-app-j01/new-unissued.json',
                         'docs/release/full-app-j01/consumer-scope09.md']:
                p = fixture/path
                if p.exists(): p.unlink()
        def run(name, expected, historical_commit=None):
            nonlocal rejected
            raw = git('diff', '--cached', '--raw', '--no-abbrev', '--no-renames', '-z', tree)
            try:
                check.validate09_diff(raw, lambda path: (fixture/path).read_bytes(), historical_commit=historical_commit)
                actual = 0; error = None
            except ValueError as e:
                actual = 1; error = str(e)
            print(json.dumps(dict(case=name, argv=['git', 'diff', '--cached', '--raw',
                '--no-abbrev', '--no-renames', '-z', tree], cwd=str(fixture),
                exit=actual, expected_exit=expected, error=error)))
            assert actual == expected, (name, error)
            rejected += actual
        put(workflow, exact_workflow); put(audit, b'authorized bounded implementation\n')
        put('docs/release/full-app-j01/consumer-scope09.md', b'candidate scope\n')
        git('add', '--all'); run('authentic-exact-workflow-addition', 0); reset_fixture()
        historical = before_workflow.replace(b'\n  expo-export:\n', check.RELEASE09_STEP+b'\n  expo-export:\n')
        put(workflow, historical); git('add', '--all')
        run('exact-immutable-first-candidate-placement', 0, 'eb86be5298afd0fae3344ef6bf2a4db3b7ada116')
        run('historical-placement-rejected-for-current-source', 1)
        run('historical-placement-rejected-for-forged-commit', 1, '0'*40)
        reset_fixture()
        for name, raw in [
            ('workflow-existing-step-tamper', exact_workflow.replace(b'run: npm test', b'run: true', 1)),
            ('workflow-job-dependency-tamper', exact_workflow.replace(b'needs: checks', b'needs: []', 1)),
            ('workflow-duplicate-addition', exact_workflow.replace(check.RELEASE09_STEP, check.RELEASE09_STEP*2)),
            ('workflow-validator-removed', exact_workflow.replace(b'python3 -B scripts/release/full-app-j01/check.py', b'true')),
        ]:
            put(workflow, raw); git('add', '--all'); run(name, 1); reset_fixture()
        for path in ['scripts/phase9/security-protected.py', 'docs/MASTER_PLAN.md',
                     '.github/workflows/other.yml', 'docs/release/full-app-j01/new-unissued.json']:
            put(path, b'unauthorized\n'); git('add', '--all'); run('scope-tamper-'+path, 1); reset_fixture()
        (fixture/audit).unlink(); git('add', '--all'); run('delete-authorized-script', 1); reset_fixture()
        blob = git('hash-object', '-w', '--', audit).decode().strip()
        for mode in ['100755', '120000']:
            git('update-index', '--cacheinfo', mode, blob, audit)
            run('nonregular-or-mode-change-'+mode, 1); reset_fixture()
        put('scripts/docs/source-packet-audit.mjs', b'changed\n'); git('add', '--all')
        run('authentic-restored-allowed-delta', 0)
    print(json.dumps(dict(passed=True, rejected=rejected, original_semantic_functions='UNCHANGED_AST',
                          original_151_fixture_script='BYTE_IDENTICAL',
                          qualification='BOUNDED_REAL_GIT_DELTA_FIXTURES_ONLY', release='NO_GO')))


if __name__ == '__main__':
    main()
