"""Actual Git controls in a disposable repository; no acceptance or release qualification."""
import ast
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('release11_check', HERE/'check.py')
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)


def main():
    root = check.ROOT
    check.validate11_checker((HERE/'check.py').read_bytes())
    for name in ('test_contract.py', 'source_consumer09.test.py', 'source_consumer10.test.py'):
        assert (HERE/name).read_bytes() == check.git('show', check.RELEASE11_BASE+':scripts/release/full-app-j01/'+name)
    rejected = 0
    def expect(name, action, expected=1, code=None):
        nonlocal rejected
        error = None
        try:
            action(); actual = 0
        except (ValueError, subprocess.SubprocessError, OSError) as exc:
            actual = 1; error = str(exc)
        print(json.dumps(dict(case=name, exit=actual, expected_exit=expected, error=error)), flush=True)
        assert actual == expected and (code is None or code in (error or '')), (name, error)
        rejected += actual
    for path in ('../escape', '/absolute', 'C:/drive', 'docs\\escape',
        'docs/brain/contracts/SECURITY-11/../escape', 'docs/brain/contracts/SECURITY-11//x',
        'docs/brain/contracts/SECURITY-11/.git/config', 'docs/brain/contracts/SECURITY-11/.GIT/config',
        'docs/brain/contracts/SECURITY-11/CON.md', 'docs/brain/contracts/SECURITY-11/alias.',
        'docs/brain/contracts/SECURITY-11/\uff58', 'docs/brain/contracts/SECURITY-11/.gitattributes',
        '.github/workflows/quality.yml', 'scripts/phase9/security-exceptions.mjs',
        'supabase/config.toml', 'apps/mobile/src/features/notifications/useNotifications.ts',
        'docs/generated/readiness-status-audit.json', 'docs/brain/state/manifest.json',
        'scripts/phase4/build-source-worklist.mjs', 'scripts/launch/check-contract.mjs',
        'scripts/release/full-app-j01/test_contract.py',
        'docs/brain/checkpoints/RELEASE-10/QUALITY-PROJECTIONS/README.md'):
        expect('unissued:'+path, lambda p=path:check.require(check.allowed11(p), 'R11_SCOPE'))
    common = Path(check.git('rev-parse', '--git-common-dir').decode().strip())
    if not common.is_absolute():
        common = (root/common).resolve()
    with tempfile.TemporaryDirectory(prefix='onskin-source11-') as temporary:
        fixture = Path(temporary).resolve()
        def git(*args, data=None):
            result = subprocess.run(['git', '-c', 'core.autocrlf=false', '-c', 'core.longpaths=true', *args],
                                    cwd=fixture, input=data, capture_output=True)
            if result.returncode:
                raise subprocess.CalledProcessError(result.returncode, args, result.stdout, result.stderr)
            return result.stdout
        git('init', '--quiet')
        (fixture/'.git/objects/info/alternates').write_bytes(((common/'objects').as_posix()+'\n').encode())
        git('read-tree', check.RELEASE11_BASE)
        git('update-ref', 'HEAD', check.RELEASE11_BASE)
        contract_path = 'docs/brain/contracts/SECURITY-11/dependency-patch.v1.json'
        (fixture/contract_path).parent.mkdir(parents=True)
        (fixture/contract_path).write_bytes((root/contract_path).read_bytes())
        def put(path, data=b'bounded fixture\n', mode='100644'):
            blob = git('hash-object', '-w', '--stdin', data=data).decode().strip()
            git('update-index', '--add', '--cacheinfo', mode, blob, path)
        def restore():
            git('read-tree', check.RELEASE11_BASE)
        def delta():
            raw = git('diff', '--cached', '--raw', '--no-abbrev', '--no-renames', '-z', check.RELEASE11_BASE)
            check.validate11_diff(raw, lambda p:git('show', ':'+p))
        def commit(parent, *other):
            return git('-c', 'user.name=Release11 fixture', '-c', 'user.email=fixture@example.invalid',
                'commit-tree', git('write-tree').decode().strip(), '-p', parent,
                *sum((['-p', p] for p in other), []), data=b'bounded negative control\n').decode().strip()
        try:
            check.ROOT = fixture
            for path in sorted(check.RELEASE11_NEW | (check.RELEASE11_EXISTING -
                {'package.json', 'apps/mobile/package.json'})):
                data = (root/path).read_bytes() if (root/path).is_file() else b'bounded fixture\n'
                put(path, data); expect('granted:'+path, delta, 0); restore()
            protected = '.github/workflows/quality.yml'
            for path in (protected, 'scripts/phase9/dependency-sbom.mjs', 'supabase/config.toml',
                'apps/mobile/src/features/notifications/useNotifications.ts',
                'docs/generated/readiness-status-audit.json',
                'scripts/release/full-app-j01/source_consumer10.test.py'):
                put(path); expect('protected-delta:'+path, delta, code='R11_SCOPE'); restore()
            for mode in ('100755', '120000'):
                put('ONSKIN_BRAIN_HANDOFF.txt', mode=mode)
                expect('mode:'+mode, delta, code='R11_'); restore()
            git('update-index', '--force-remove', 'ONSKIN_BRAIN_HANDOFF.txt')
            expect('deletion', delta, code='R11_SCOPE'); restore()
            put('docs/brain/contracts/SECURITY-11/Case.md')
            put('docs/brain/contracts/SECURITY-11/case.md')
            expect('case-collision', delta, code='R11_COLLISION'); restore()
            expect('malformed-raw', lambda:check.validate11_diff(b'invalid', lambda p:b''), code='R11_DIFF_SHAPE')
            put('scripts/core05/adherence-source-contract.test.mjs')
            raw = git('diff', '--cached', '--raw', '--no-abbrev', '--no-renames', '-z', check.RELEASE11_BASE)
            expect('old10-still-rejects-new11', lambda:check.validate10_diff(raw, lambda p:b''), code='R10_SCOPE')
            authentic = commit(check.RELEASE11_BASE)
            git('update-ref', 'HEAD', authentic)
            expect('authentic-history', check.source11_history, 0)
            put(protected); malicious = commit(authentic)
            git('update-ref', 'HEAD', malicious)
            expect('protected-history', check.source11_history, code='R11_SCOPE')
            git('read-tree', authentic); restored = commit(malicious)
            git('update-ref', 'HEAD', restored)
            expect('hidden-intermediate', check.source11_history, code='R11_SCOPE')
            restore(); put('ONSKIN_BRAIN_HANDOFF.txt'); parallel = commit(check.RELEASE11_BASE)
            merge = commit(authentic, parallel)
            git('update-ref', 'HEAD', merge)
            expect('ordinary-merge', check.source11_history, code='R11_')
            git('read-tree', authentic)
            integration = commit(check.RELEASE11_BASE, authentic)
            git('update-ref', 'HEAD', integration)
            # The test never invents a PR number; integration testing starts only
            # once GitHub has actually allocated this campaign's draft.
            if check.RELEASE11_PR is not None:
                event = dict(number=check.RELEASE11_PR, repository=dict(full_name='TasfiqJ/onSkin'),
                    pull_request=dict(number=check.RELEASE11_PR,
                        base=dict(sha=check.RELEASE11_BASE, ref='stage/full-app-j01-quality-projections10'),
                        head=dict(sha=authentic, ref='stage/m103-security-source-recovery11',
                                  repo=dict(full_name='TasfiqJ/onSkin'))))
                event_path = fixture/'.git/event11.json'
                event_path.write_bytes(json.dumps(event).encode())
                environment = dict(GITHUB_EVENT_NAME='pull_request', GITHUB_REPOSITORY='TasfiqJ/onSkin',
                    GITHUB_REF='refs/pull/'+str(check.RELEASE11_PR)+'/merge',
                    GITHUB_SHA=integration, GITHUB_EVENT_PATH=str(event_path))
                with patch.dict(check.os.environ, environment):
                    expect('exact-created-PR-event', check.source11_history, 0)
                    for key, value in (('GITHUB_EVENT_NAME', 'push'), ('GITHUB_REPOSITORY', 'other/repo'),
                        ('GITHUB_REF', 'refs/pull/0/merge'), ('GITHUB_SHA', authentic)):
                        with patch.dict(check.os.environ, {key:value}):
                            expect('wrong-event:'+key, check.source11_history, code='R11_CI_')
                    for section, key, value in (
                        ('base', 'sha', check.RELEASE09), ('base', 'ref', 'main'),
                        ('head', 'sha', check.RELEASE11_BASE), ('head', 'ref', 'other')):
                        previous = event['pull_request'][section][key]
                        event['pull_request'][section][key] = value
                        event_path.write_bytes(json.dumps(event).encode())
                        expect('forged-event:'+section+':'+key, check.source11_history, code='R11_CI_EVENT_IDENTITY')
                        event['pull_request'][section][key] = previous
                    event['pull_request']['head']['repo']['full_name'] = 'other/repo'
                    event_path.write_bytes(json.dumps(event).encode())
                    expect('wrong-owner', check.source11_history, code='R11_CI_EVENT_IDENTITY')
                    event['pull_request']['head']['repo']['full_name'] = 'TasfiqJ/onSkin'
                    event_path.write_bytes(json.dumps(event).encode())
                    put('ONSKIN_BRAIN_HANDOFF.txt')
                    altered = commit(check.RELEASE11_BASE, authentic)
                    git('update-ref', 'HEAD', altered)
                    with patch.dict(check.os.environ, {'GITHUB_SHA':altered}):
                        expect('altered-integration-tree', check.source11_history, code='R11_CI_MERGE_TREE')
                print(json.dumps(dict(integration='ACTUAL_ALLOCATED_PR', pr=check.RELEASE11_PR)))
            else:
                print(json.dumps(dict(integration='NOT_RUN_PR_NOT_CREATED_YET')))
            unrelated = git('-c', 'user.name=Release11 fixture', '-c', 'user.email=fixture@example.invalid',
                'commit-tree', git('write-tree').decode().strip(), data=b'unrelated root\n').decode().strip()
            git('update-ref', 'HEAD', unrelated)
            expect('wrong-ancestry', check.source11_history)
            # Materialize the complete real base for independent index/worktree
            # controls. Only this task-created temporary repository is mutated.
            restore(); git('update-ref', 'HEAD', check.RELEASE11_BASE)
            git('checkout-index', '--all', '--force')
            expect('complete-fixture-current', check.source11_guard, 0)
            original = (fixture/protected).read_bytes()
            put(protected, original+b'\n# staged mutation\n')
            expect('staged-hidden-by-restored-worktree', check.source11_guard, code='R11_SCOPE')
            restore()
            (fixture/protected).write_bytes(original+b'\n# working mutation\n')
            expect('working-protected', check.source11_guard, code='R11_SCOPE')
            (fixture/protected).write_bytes(original)
            for flag, undo in (('--assume-unchanged', '--no-assume-unchanged'), ('--skip-worktree', '--no-skip-worktree')):
                git('update-index', flag, protected)
                expect('index-flag:'+flag, check.source11_guard, code='R11_INDEX_FLAGS')
                git('update-index', undo, protected)
            untracked = fixture/'apps/mobile/src/forbidden11.ts'
            untracked.write_bytes(b'export const forbidden = true;\n')
            expect('untracked-runtime', check.source11_guard, code='R11_UNTRACKED_SCOPE')
            untracked.unlink()
            expect('complete-fixture-restored', check.source11_guard, 0)
        finally:
            check.ROOT = root
    print(json.dumps(dict(passed=True, rejected=rejected, qualification='DISPOSABLE_GIT_CONTROLS',
                         inherited_semantics='UNCHANGED_AST', release='NO_GO')))


if __name__ == '__main__':
    main()
