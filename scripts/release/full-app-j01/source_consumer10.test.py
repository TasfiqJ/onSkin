"""Actual Git index/history controls; bounded fixtures, not a full-checkout qualification."""
import ast
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('release10_check', HERE/'check.py')
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)


def main():
    root = check.ROOT
    def functions(raw):
        return {n.name: ast.dump(n, include_attributes=False) for n in ast.parse(raw).body
                if isinstance(n, ast.FunctionDef)}
    before = functions(check.git('show', check.RELEASE09+':scripts/release/full-app-j01/check.py'))
    after = functions((HERE/'check.py').read_bytes())
    assert all(before[k] == after[k] for k in before if k not in ('source_guard', 'source09_guard'))
    for name in ['test_contract.py', 'source_consumer09.test.py']:
        assert (HERE/name).read_bytes() == check.git('show', check.RELEASE09+':scripts/release/full-app-j01/'+name)
    rejected = 0
    def expect(name, action, expected):
        nonlocal rejected
        error = None
        try:
            action(); actual = 0
        except (ValueError, subprocess.SubprocessError, OSError) as e:
            actual = 1; error = str(e)
        print(json.dumps(dict(case=name, exit=actual, expected_exit=expected, error=error)), flush=True)
        assert actual == expected, (name, error)
        rejected += actual
    for path in ['../escape', '/absolute', 'C:/drive', 'docs\\escape',
                 'docs/brain/contracts/RELEASE-10/../escape', 'docs/brain/contracts/RELEASE-10//x',
                 'docs/brain/contracts/RELEASE-10/./x', 'docs/brain/contracts/RELEASE-10/.git/config',
                 'docs/brain/contracts/RELEASE-10/.GIT/config', 'docs/brain/contracts/RELEASE-10/CON.md',
                 'docs/brain/contracts/RELEASE-10/alias.',
                 'docs/brain/contracts/RELEASE-10/\uff58', '.github/workflows/quality.yml',
                 'scripts/docs/readiness-status-audit.mjs', 'scripts/docs/readiness-status-audit.test.mjs',
                 'scripts/docs/source-packet-audit.mjs', 'scripts/phase4/build-source-worklist.mjs',
                 'scripts/release/full-app-j01/test_contract.py', 'scripts/release/full-app-j01/source_consumer09.test.py',
                 'docs/release/full-app-j01/contract.v1.json', 'package.json',
                 'docs/brain/checkpoints/RELEASE-09/SOURCE-PACKET-CONSUMER/README.md']:
        expect('unissued-path:'+path, lambda p=path:check.require(check.allowed10(p), 'R10_SCOPE'), 1)
    common = Path(check.git('rev-parse', '--git-common-dir').decode().strip())
    if not common.is_absolute(): common = (root/common).resolve()
    with tempfile.TemporaryDirectory(prefix='onskin-source10-') as temporary:
        fixture = Path(temporary)
        def git(*args, data=None):
            result = subprocess.run(['git', '-c', 'core.autocrlf=false', *args], cwd=fixture,
                                    input=data, capture_output=True)
            if result.returncode:
                raise RuntimeError(result.stderr.decode('utf-8', errors='replace'))
            return result.stdout
        git('init', '--quiet')
        (fixture/'.git/objects/info/alternates').write_bytes(((common/'objects').as_posix()+'\n').encode('utf-8'))
        # This private repository shares read-only object storage, not refs/index/worktree.
        # Its complete base tree is the actual immutable Release09 tree; no clone or checkout.
        git('read-tree', check.RELEASE09)
        base_tree = git('write-tree').decode().strip()
        assert base_tree == 'a59fc7ea1cc57901f6d848ff5009734f446bdff2'
        git('update-ref', 'HEAD', check.RELEASE09)
        def put(path, raw=b'bounded fixture\n', mode='100644'):
            blob = git('hash-object', '-w', '--stdin', data=raw).decode().strip()
            git('update-index', '--add', '--cacheinfo', mode, blob, path)
        def restore(): git('read-tree', base_tree)
        def delta():
            raw = git('diff', '--cached', '--raw', '--no-abbrev', '--no-renames', '-z', check.RELEASE09)
            print(json.dumps(dict(argv=['git', 'diff', '--cached', '--raw', '--no-abbrev',
                '--no-renames', '-z', check.RELEASE09], cwd=str(fixture), raw=raw.decode('utf-8'))))
            check.validate10_diff(raw, lambda p:git('show', ':'+p))
        worklist = 'docs/phase-4/generated/source-worklist.json'
        put(worklist); expect('authentic-generated-pair-path', delta, 0); restore()
        for path in sorted(check.RELEASE10_EXISTING | check.RELEASE10_NEW):
            put(path); expect('exact-granted-path:'+path, delta, 0); restore()
        for path in ['.github/workflows/quality.yml', 'scripts/phase4/build-source-worklist.mjs',
                     'docs/generated/source-packet-audit.json', 'docs/release/full-app-j01/contract.v1.json',
                     'scripts/release/full-app-j01/test_contract.py', 'supabase/config.toml']:
            put(path); expect('actual-protected-delta:'+path, delta, 1); restore()
        for mode in ['100755', '120000']:
            put(worklist, mode=mode); expect('actual-mode:'+mode, delta, 1); restore()
        git('update-index', '--force-remove', worklist)
        expect('actual-deletion', delta, 1); restore()
        put('docs/brain/contracts/RELEASE-10/Case.md')
        put('docs/brain/contracts/RELEASE-10/case.md')
        expect('actual-casefold-collision', delta, 1); restore()
        expect('malformed-raw', lambda:check.validate10_diff(b'invalid', lambda p:b''), 1)
        # An old guard still rejects Release10's genuine new projection delta.
        put(worklist)
        raw = git('diff', '--cached', '--raw', '--no-abbrev', '--no-renames', '-z', check.RELEASE09)
        expect('old09-rejects-new10-path', lambda:check.validate09_diff(raw, lambda p:git('show', ':'+p)), 1)
        restore()
        def commit(parent):
            tree = git('write-tree').decode().strip()
            return git('-c', 'user.name=Release10 fixture', '-c', 'user.email=fixture@example.invalid',
                       'commit-tree', tree, '-p', parent, data=b'bounded control\n').decode().strip()
        try:
            check.ROOT = fixture
            put(worklist); authentic = commit(check.RELEASE09)
            git('update-ref', 'HEAD', authentic)
            expect('actual-history-authentic', check.source10_history, 0)
            put('.github/workflows/quality.yml'); malicious = commit(authentic)
            git('update-ref', 'HEAD', malicious)
            expect('actual-history-protected-mutation', check.source10_history, 1)
            git('read-tree', authentic); restored = commit(malicious)
            git('update-ref', 'HEAD', restored)
            expect('actual-history-hidden-intermediate-remains-rejected', check.source10_history, 1)
            git('update-ref', 'HEAD', authentic)
            expect('actual-history-authentic-restored', check.source10_history, 0)
            restore(); put('docs/phase-4/generated/source-worklist.md')
            parallel = commit(check.RELEASE09)
            merge = git('-c', 'user.name=Release10 fixture', '-c', 'user.email=fixture@example.invalid',
                        'commit-tree', git('write-tree').decode().strip(), '-p', authentic, '-p', parallel,
                        data=b'forbidden merge\n').decode().strip()
            git('update-ref', 'HEAD', merge)
            expect('actual-history-merge', check.source10_history, 1)
            # A GitHub integration ref may only expose the identical source tree,
            # exact pinned base, exact PR14 event and exact branch head. This does
            # not qualify local source history as merged or independently accepted.
            git('read-tree', authentic)
            integration = git('-c', 'user.name=Release10 fixture', '-c', 'user.email=fixture@example.invalid',
                'commit-tree', git('write-tree').decode().strip(), '-p', check.RELEASE09, '-p', authentic,
                data=b'synthetic PR14 integration fixture\n').decode().strip()
            git('update-ref', 'HEAD', integration)
            event_path = fixture/'.git/event10.json'
            event = dict(number=14, repository=dict(full_name='TasfiqJ/onSkin'), pull_request=dict(number=14,
                base=dict(sha=check.RELEASE09, ref='stage/full-app-j01-source-packet-ci09'),
                head=dict(sha=authentic, ref='stage/full-app-j01-quality-projections10', repo=dict(full_name='TasfiqJ/onSkin'))))
            event_path.write_bytes(json.dumps(event).encode())
            env = dict(GITHUB_EVENT_NAME='pull_request', GITHUB_REPOSITORY='TasfiqJ/onSkin',
                GITHUB_REF='refs/pull/14/merge', GITHUB_SHA=integration, GITHUB_EVENT_PATH=str(event_path))
            with patch.dict(check.os.environ, env):
                expect('exact-synthetic-integration-tree-and-event', check.source10_history, 0)
                for key, bad in [('GITHUB_EVENT_NAME', 'push'), ('GITHUB_REF', 'refs/pull/15/merge'),
                                 ('GITHUB_SHA', authentic), ('GITHUB_REPOSITORY', 'other/repo')]:
                    with patch.dict(check.os.environ, {key:bad}):
                        expect('synthetic-context-tampered:'+key, check.source10_history, 1)
                event['pull_request']['head']['sha'] = check.RELEASE09
                event_path.write_bytes(json.dumps(event).encode())
                expect('synthetic-event-head-tampered', check.source10_history, 1)
                event['pull_request']['head']['sha'] = authentic
                event_path.write_bytes(json.dumps(event).encode())
                put(worklist, b'altered integration tree\n')
                bad_tree_merge = git('-c', 'user.name=Release10 fixture', '-c', 'user.email=fixture@example.invalid',
                    'commit-tree', git('write-tree').decode().strip(), '-p', check.RELEASE09, '-p', authentic,
                    data=b'forged integration tree\n').decode().strip()
                git('update-ref', 'HEAD', bad_tree_merge)
                with patch.dict(check.os.environ, {'GITHUB_SHA':bad_tree_merge}):
                    expect('synthetic-integration-tree-tampered', check.source10_history, 1)
                git('update-ref', 'HEAD', integration)
                expect('exact-synthetic-integration-restored', check.source10_history, 0)
            unrelated = git('-c', 'user.name=Release10 fixture', '-c', 'user.email=fixture@example.invalid',
                            'commit-tree', base_tree, data=b'unrelated root\n').decode().strip()
            git('update-ref', 'HEAD', unrelated)
            expect('actual-history-wrong-ancestry', check.source10_history, 1)
        finally:
            check.ROOT = root
    print(json.dumps(dict(passed=True, rejected=rejected,
        semantic_functions='UNCHANGED_AST', previous_tests='BYTE_IDENTICAL',
        qualification='BOUNDED_ACTUAL_GIT_INDEX_AND_HISTORY_NOT_FULL_CHECKOUT', release='NO_GO')))


if __name__ == '__main__':
    main()
