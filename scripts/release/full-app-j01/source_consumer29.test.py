"""Independent current29 refusal controls; historical consumers run at original pins."""
import ast
import copy
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
from types import SimpleNamespace
from unittest.mock import patch


def main():
    if sys.flags.optimize: raise ValueError('R29_ASSERTIONS_REQUIRED')
    if len(sys.argv) != 1: raise ValueError('R29_ARGUMENT_SCHEMA')
    root = Path(__file__).resolve().parents[3]
    actual = root/'scripts/release/full-app-j01/check.py'
    raw = actual.read_bytes()
    namespace = {'__name__': 'current29_controls', '__file__': str(actual)}
    exec(compile(raw, '<current29-checker>', 'exec'), namespace)
    check = SimpleNamespace(**namespace)
    positive = refused = 0
    encoded = lambda v: (json.dumps(v, sort_keys=True)+'\n').encode()
    def expect(label, action, success=False, code=None):
        nonlocal positive, refused
        try: action()
        except (ValueError, KeyError, TypeError, OSError, subprocess.SubprocessError) as error:
            assert not success and (code is None or error.args == (code,)), label
            refused += 1
        else:
            assert success, label
            positive += 1
        print(json.dumps(dict(case=label, exit=0 if success else 1, expectedExit=0 if success else 1)), flush=True)
    candidate = json.loads((root/check.RELEASE29_CANDIDATE).read_bytes())
    plan = (root/check.RELEASE29_PLAN).read_bytes()
    expect('authentic20-path-plan', lambda: check.scope29_guard(plan), True)
    expect('authentic-closed-contract', lambda: check.candidate29_guard(encoded(candidate)), True)
    for key, values in {'schema': [True, 1.0, 2], 'authority': ['UNISSUED'], 'status': ['ACCEPTED'],
        'base': ['0'*40], 'tree': ['0'*40], 'scopeCommit': ['0'*40], 'scopePlanSHA256': ['0'*64],
        'inputManifestSHA256': ['0'*64], 'acceptanceGranted': [True, 0, None], 'pr': [True, 0, -1, 33.0]}.items():
        for value in values:
            changed = copy.deepcopy(candidate); changed[key] = value
            expect('contract-refusal-'+key+'-'+repr(value), lambda v=changed: check.candidate29_guard(encoded(v)))
    for key in candidate['admissions']:
        for value in (True, 0, None, 'false'):
            changed = copy.deepcopy(candidate); changed['admissions'][key] = value
            expect('closed-admission-'+key+'-'+repr(value), lambda v=changed: check.candidate29_guard(encoded(v)))
    for body in (b'[]', b'{}', encoded(candidate).replace(b'"schema": 1', b'"schema": 1,"schema": 1'),
        encoded(candidate).replace(b'"pr": 33', b'"pr": NaN'), b' '*(65537)):
        expect('malformed-contract', lambda b=body: check.candidate29_guard(b))
    for body in (plan+b'\n', plan.replace(b'20-path', b'21-path'), plan.replace(b'NO_GO', b'GO')):
        assert body != plan
        expect('immutable-plan-refusal', lambda b=body: check.scope29_guard(b), code='R29_PLAN_IDENTITY')
    for path in ('../escape', '/absolute', 'C:/drive', 'a\\b', 'a//b', 'a/../b', 'file.', 'NUL.txt',
        'Ａ/file', 'a\x00b', 'a:b', 'a?', 'a\nfile'):
        expect('unsafe-path-'+repr(path), lambda p=path: check.name29(p, {}))
    for paths in (('A/file', 'a/other'), ('a', 'a/child')):
        def collision(paths=paths):
            identities = {}
            for path in paths: check.name29(path, identities)
        expect('implicit-parent-collision', collision, code='R29_PATH_ALIAS')
    expect('exact-append-only-current-checker', lambda: check.validate29_checker(raw), True)
    before = check.git23('show', check.RELEASE29_BASE+':scripts/release/full-app-j01/check.py')
    old = [ast.dump(n, include_attributes=False) for n in ast.parse(before).body if isinstance(n, ast.FunctionDef)]
    new = [ast.dump(n, include_attributes=False) for n in ast.parse(raw).body if isinstance(n, ast.FunctionDef)]
    assert len(old) == 218 and new[:len(old)] == old
    print(json.dumps(dict(case='all-original-function-ASTs-preserved', exit=0)), flush=True)
    terminal = b"if __name__ == '__main__':\n    sys.exit(main())\n"
    for addition in (b'import socket\n', b'validate = validate29\n', b'RELEASE29_EXTRA = 1\n',
        b'RELEASE29_EXTRA = globals().clear()\n', b'def injected(): return True\n'):
        expect('checker-extension-injection', lambda a=addition: check.validate29_checker(raw[:-len(terminal)]+a+terminal))
    expect('checker-inherited-byte-mutation', lambda: check.validate29_checker(raw.replace(b'"""Release08', b'"""Release00', 1)))
    expect('checker-dispatch-mutation', lambda: check.validate29_checker(raw[:-len(terminal)].replace(
        b'source_guard = source29_guard', b'source_guard = source28_guard')+terminal))
    expect('checker-appendix-byte-mutation', lambda: check.validate29_checker(raw.replace(
        b'# Release29 successor.', b'# Release29 changed.', 1)))
    for release in (27, 28):
        path = 'scripts/release/full-app-j01/replay'+str(release)+'.py'
        body = (root/path).read_bytes()
        expect('exact-named-reader-'+str(release), lambda p=path, b=body: check.reader29_guard(p, b), True)
        tree = ast.parse(body)
        target = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'bytes'+str(release))
        helper = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'same'+str(release))
        lines = body.splitlines(keepends=True)
        changed = b''.join(lines[:helper.lineno])+b'    return True\n'+b''.join(lines[helper.lineno:])
        expect('reader-ungranted-helper-'+str(release), lambda p=path, b=changed: check.reader29_guard(p, b))
        for changed in (body+b'\n# outside authorized function\n', body+b'import socket\n',
            body.replace(('def bytes'+str(release)+'(path,').encode(), ('def bytes'+str(release)+'(other,').encode(), 1),
            b''.join(lines[:target.lineno])+b'    return b""\n'+b''.join(lines[target.lineno:])):
            expect('reader-outside-scope-or-implementation-'+str(release), lambda p=path, b=changed: check.reader29_guard(p, b))
        frozen = check.git23('show', check.RELEASE29_BASE+':'+path)
        expect('unrepaired-frozen-reader-refused-'+str(release), lambda p=path, b=frozen: check.reader29_guard(p, b))
    for path in ('apps/mobile/src/lib/storage/privateKV.ts', 'scripts/release/full-app-j01/replay27.test.py',
        'scripts/release/full-app-j01/replay28.test.py', '.github/workflows/security.yml', 'scripts/core05/adherence-source-contract.test.mjs'):
        delta = b':100644 100644 '+b'0'*40+b' '+b'0'*40+b' M\0'+path.encode()+b'\0'
        expect('protected-diff-'+path, lambda b=delta: check.validate29_diff(b, lambda _: b'', working=True), code='R29_FINITE_SCOPE')
    for mode, status in (('100755', 'M'), ('120000', 'M'), ('000000', 'D')):
        path = 'scripts/release/full-app-j01/replay27.py'
        delta = (':100644 '+mode+' '+'0'*40+' '+'0'*40+' '+status+'\0'+path+'\0').encode()
        expect('mode-or-deletion-'+mode, lambda b=delta: check.validate29_diff(b, lambda _: b'', working=True))
    # Exercise the actual history state machine through a bounded synthetic Git
    # port. Diff parsing/scopes are independently exercised above and by the real
    # source check; this does not claim a complete independent Git checkout.
    plan_id = check.RELEASE29_PLAN_COMMIT; base_id = check.RELEASE29_BASE
    impl_id = 'a'*40; freeze_id = 'b'*40; tail_id = 'c'*40; extra_id = 'd'*40
    evidence = {check.RELEASE29_CHECKPOINT+n for n in check.RELEASE29_CHECKPOINT_FILES} | {'ONSKIN_BRAIN_HANDOFF.txt'}
    def history_case(rows, endpoint=None):
        commits = [row[0] for row in rows]
        endpoint = endpoint or commits[-1]
        mapping = {commit: (parent, paths) for commit, parent, paths in rows}
        def synthetic_git(*args):
            if args == ('rev-parse', base_id+'^{tree}'): return check.RELEASE29_TREE.encode()
            if args[:1] == ('merge-base',): return base_id.encode()
            if args == ('rev-list', '--parents', '-n', '1', plan_id): return (plan_id+' '+base_id).encode()
            if args == ('show', plan_id+':'+check.RELEASE29_PLAN): return plan
            if args == ('rev-list', '--reverse', base_id+'..'+endpoint): return '\n'.join(commits).encode()
            if args[:4] == ('rev-list', '--parents', '-n', '1'):
                commit = args[4]; parent = mapping[commit][0]
                return (commit+' '+parent).encode()
            if args[0] == 'diff': return json.dumps(sorted(mapping[args[-1]][1])).encode()
            raise ValueError('SYNTHETIC_GIT_UNEXPECTED_CALL')
        with patch.dict(namespace, {'git23': synthetic_git, 'source29_endpoint': lambda: endpoint,
            'validate29_diff': lambda raw, *_args, **_kwargs: set(json.loads(raw))}):
            return check.source29_history()
    first = (plan_id, base_id, {check.RELEASE29_PLAN})
    substantive = (impl_id, plan_id, {'docs/brain/task-specs/M1X-29/TASK.md'})
    frozen = (freeze_id, impl_id, check.RELEASE29_WORKLIST)
    tail = (tail_id, freeze_id, evidence)
    expect('history-plan-only', lambda: history_case([first]), True)
    expect('history-source-stage', lambda: history_case([first, substantive]), True)
    expect('history-single-worklist-freeze', lambda: history_case([first, substantive, frozen]), True)
    expect('history-single-complete-tail', lambda: history_case([first, substantive, frozen, tail]), True)
    for rows, code in [
        ([(impl_id, base_id, {'docs/brain/task-specs/M1X-29/TASK.md'})], 'R29_PLAN_FIRST'),
        ([first, (impl_id, '0'*40, substantive[2])], 'R29_LINEAR_HISTORY'),
        ([first, (impl_id, plan_id+' '+base_id, substantive[2])], 'R29_LINEAR_HISTORY'),
        ([first, (impl_id, plan_id, {check.RELEASE29_PLAN})], 'R29_PLAN_IMMUTABLE'),
        ([first, substantive, (freeze_id, impl_id, {next(iter(check.RELEASE29_WORKLIST))})], 'R29_WORKLIST_ONLY_FREEZE'),
        ([first, substantive, (tail_id, impl_id, evidence)], 'R29_EVIDENCE_TAIL_SCOPE'),
        ([first, substantive, frozen, (tail_id, freeze_id, {'ONSKIN_BRAIN_HANDOFF.txt'})], 'R29_EVIDENCE_TAIL_SCOPE'),
        ([first, substantive, frozen, (extra_id, freeze_id, substantive[2])], 'R29_SOURCE_AFTER_FREEZE'),
        ([first, substantive, frozen, tail, (extra_id, tail_id, evidence)], 'R29_AFTER_EVIDENCE_TAIL'),
        ([first, substantive, frozen, tail, (extra_id, tail_id, substantive[2])], 'R29_AFTER_EVIDENCE_TAIL')]:
        expect('history-refuses-invalid-transition-'+code, lambda rows=rows: history_case(rows), code=code)
    with patch.dict(os.environ, {'GIT_DIR': '/synthetic/redirect'}):
        expect('Git-environment-before-endpoint', check.source29_endpoint, code='R23_GIT_ENV')
        expect('Git-environment-before-store', check.full29_store, code='R23_GIT_ENV')
    # Explicit CI event/base/head/tree custody controls. All event bodies and IDs
    # below are synthetic and never authorize a real PR or release gate.
    with tempfile.TemporaryDirectory(prefix='source29-event-') as directory:
        event_path = Path(directory)/'event.json'; head_id = 'e'*40; merge_id = 'f'*40
        event = dict(number=33, repository=dict(full_name='TasfiqJ/onSkin'), pull_request=dict(number=33,
            base=dict(sha=base_id, ref='stage/m1-destructive-commit-core05-28'),
            head=dict(sha=head_id, ref='stage/m1-windows-reader-integrity29', repo=dict(full_name='TasfiqJ/onSkin')),
            draft=True, maintainer_can_modify=False, auto_merge=None, merge_commit_sha=None))
        environment = {k: v for k, v in os.environ.items() if not k.upper().startswith(('GITHUB_', 'GIT_'))}
        environment.update(GITHUB_ACTIONS='true', GITHUB_EVENT_NAME='pull_request', GITHUB_REPOSITORY='TasfiqJ/onSkin',
            GITHUB_EVENT_PATH=str(event_path), GITHUB_REF='refs/pull/33/merge', GITHUB_SHA=merge_id)
        def event_case(value, wrong_tree=False, wrong_parent=False):
            event_path.write_bytes(encoded(value))
            def synthetic_git(*args):
                if args == ('rev-parse', 'HEAD'): return head_id.encode()
                if args == ('rev-list', '--parents', '-n', '1', head_id): return (head_id+' '+base_id).encode()
                if args == ('rev-list', '--parents', '-n', '1', merge_id):
                    return (merge_id+' '+('0'*40 if wrong_parent else base_id)+' '+head_id).encode()
                if args[:1] == ('rev-parse',) and args[1].endswith('^{tree}'):
                    return (('0'*40 if wrong_tree and args[1].startswith(merge_id) else check.RELEASE29_TREE)+'\n').encode()
                raise ValueError('SYNTHETIC_GIT_UNEXPECTED_CALL')
            with patch.dict(namespace, {'git23': synthetic_git}), patch.dict(os.environ, environment, clear=True):
                return check.source29_endpoint()
        expect('CI-exact-synthetic-event-and-test-merge', lambda: event_case(event), True)
        for key, value in [('draft', False), ('maintainer_can_modify', True), ('auto_merge', {}), ('number', True)]:
            changed = copy.deepcopy(event); changed['pull_request'][key] = value
            expect('CI-event-refusal-'+key, lambda v=changed: event_case(v), code='R29_CI_EVENT')
        for section, key, value in [('base', 'sha', '0'*40), ('base', 'ref', 'main'),
            ('head', 'sha', '0'*40), ('head', 'ref', 'main')]:
            changed = copy.deepcopy(event); changed['pull_request'][section][key] = value
            expect('CI-source-identity-refusal-'+section+'-'+key, lambda v=changed: event_case(v), code='R29_CI_EVENT')
        expect('CI-test-merge-wrong-tree', lambda: event_case(event, wrong_tree=True), code='R29_CI_TEST_MERGE_IDENTITY')
        expect('CI-test-merge-wrong-parent', lambda: event_case(event, wrong_parent=True), code='R29_CI_TEST_MERGE_IDENTITY')
    # Raw-byte controls operate on a synthetic temporary public file only.
    with tempfile.TemporaryDirectory(prefix='source29-public-') as directory:
        path = Path(directory)/'public.txt'; body = b'current source stability\n'*80; path.write_bytes(body)
        expect('regular29-unchanged', lambda: check.require(check.regular29(path) == body, 'TEST'), True)
        expect('regular29-size-bound', lambda: check.regular29(path, 1))
        expect('regular29-missing', lambda: check.regular29(path.with_name('missing')))
        expect('regular29-directory', lambda: check.regular29(path.parent))
        link = path.with_name('hardlink'); os.link(path, link)
        expect('regular29-hardlink', lambda: check.regular29(path)); link.unlink()
        expect('regular29-restoration', lambda: check.require(check.regular29(path) == body, 'TEST'), True)
        original_read = os.read; calls = 0
        named = path.lstat()
        with path.open('rb') as stream: opened = os.fstat(stream.fileno())
        def mutate(fd, size):
            nonlocal calls
            block = original_read(fd, min(size, 32)); calls += 1
            if calls == 1: path.write_bytes(b'X'+body[1:])
            return block
        original_lstat = Path.lstat
        def alias(path_arg, *args, **kwargs):
            return named if path_arg == path else original_lstat(path_arg, *args, **kwargs)
        with patch.object(os, 'read', side_effect=mutate), patch.object(os, 'fstat', return_value=opened), patch.object(Path, 'lstat', alias):
            expect('regular29-consumed-byte-alias', lambda: check.regular29(path), code='R29_PUBLIC_CHANGED')
        path.write_bytes(body)
        expect('regular29-exact-restoration', lambda: check.require(check.regular29(path) == body, 'TEST'), True)
        ns = namespace; previous = ns['ROOT']; ns['ROOT'] = path.parent
        index = {path.name: ('100644', hashlib.sha1(('blob '+str(len(body))+'\0').encode()+body).hexdigest())}
        try:
            expect('raw-tracked-exact', lambda: check.working29_guard(index), True)
            path.write_bytes(b'X'+body[1:])
            expect('raw-tracked-byte-mismatch', lambda: check.working29_guard(index), code='R29_WORKING_BLOB')
            path.write_bytes(body)
            expect('raw-tracked-restored', lambda: check.working29_guard(index), True)
            calls = 0
            with patch.object(os, 'read', side_effect=mutate), patch.object(os, 'fstat', return_value=opened), patch.object(Path, 'lstat', alias):
                expect('raw-tracked-consumed-byte-metadata-alias', lambda: check.working29_guard(index), code='R29_WORKING_CHANGED')
            path.write_bytes(body)
            with patch.object(os, 'read', side_effect=OSError()):
                expect('raw-tracked-read-failure', lambda: check.working29_guard(index))
            parent_calls = 0
            def changed_parent(path_arg, *args, **kwargs):
                nonlocal parent_calls
                info = original_lstat(path_arg, *args, **kwargs)
                if path_arg == path.parent:
                    parent_calls += 1
                    if parent_calls == 2:
                        fields = {name: getattr(info, name) for name in dir(info) if name.startswith('st_')}
                        fields['st_ino'] += 1
                        return SimpleNamespace(**fields)
                return info
            with patch.object(Path, 'lstat', changed_parent):
                expect('raw-tracked-shared-parent-identity-change', lambda: check.working29_guard(index), code='R29_WORKING_PATH')
            expect('raw-tracked-final-exact-restoration', lambda: check.working29_guard(index), True)
        finally: ns['ROOT'] = previous
    print(json.dumps(dict(status='PASS', positiveControls=positive, refusals=refused, inheritedFunctions=len(old),
        qualification='SYNTHETIC_GIT_AND_READER_SCOPE_CONTROLS_NOT_INDEPENDENT_FULL_CHECKOUT_OR_SECURITY_ACCEPTANCE',
        acceptanceGranted=False, release='NO_GO')), flush=True)


if __name__ == '__main__':
    try: main()
    except Exception:
        print(json.dumps(dict(status='FAIL', code='R29_SOURCE_CONTROL_FAILED', acceptanceGranted=False, release='NO_GO')), flush=True)
        raise SystemExit(1) from None
