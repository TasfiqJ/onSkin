"""Release23 synthetic Git falsification; separate from real-checkout/scanner proof."""
import copy
from contextlib import redirect_stdout
import io
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import shutil
import sys
import tempfile
from unittest.mock import patch


HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('release23_check', HERE/'check.py')
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)


def main():
    rejected = positives = 0
    def expect(name, action, code=None, expected=1):
        nonlocal rejected, positives
        try:
            action(); actual = 0; error = None
        except (ValueError, KeyError, TypeError, OSError, subprocess.SubprocessError) as exc:
            actual = 1; error = str(exc)
        assert actual == expected and (not code or code in (error or '')), (name, actual, error)
        rejected += actual; positives += not actual
        print(json.dumps(dict(case=name, exit=actual, expectedExit=expected, code=code)), flush=True)
    candidate = dict(schema=1, authority=check.RELEASE23_AUTHORITY, status='SUBMITTED_REVIEW_REQUIRED',
        base=check.RELEASE23_BASE, tree=check.RELEASE23_TREE, acceptanceGranted=False, pr=None,
        inputManifestSHA256='a18911e49a60663dd8b66b9d2e609235d153c4ad48d8dafc361225f341557576',
        scopeSHA256='9c3aa1f8cb23109cf9909dfe1a8cb094baff8beeb2ee54b54db7d6df379e86af',
        admissions=dict(G97=False, DB=False, M103=False, M2=False, J01=False, PUBLIC=False))
    encode = lambda value: (json.dumps(value, sort_keys=True)+'\n').encode()
    expect('candidate-qualified', lambda: check.candidate23_guard(encode(candidate)), expected=0)
    for name, value in [('schema', True), ('schema', 1.0), ('acceptanceGranted', 0), ('pr', True),
        ('pr', 0), ('pr', -1), ('pr', 25.0), ('base', '0'*40), ('tree', '0'*40),
        ('status', 'ACCEPTED'), ('authority', 'UNREVIEWED')]:
        changed = copy.deepcopy(candidate); changed[name] = value
        expect('candidate-type-or-authority:'+name+':'+repr(value), lambda v=changed: check.candidate23_guard(encode(v)), 'R23_NO_ADMISSION')
    for gate in candidate['admissions']:
        for value in [True, 0, None, 'false']:
            changed = copy.deepcopy(candidate); changed['admissions'][gate] = value
            expect('technical-pass-cannot-admit:'+gate+':'+repr(value), lambda v=changed: check.candidate23_guard(encode(v)), 'R23_NO_ADMISSION')
    expect('authentic-finite-grant', lambda: check.scope23_guard(check.RELEASE23_EXISTING, check.RELEASE23_NEW), expected=0)
    for existing, new in [(check.RELEASE23_EXISTING | {'.github/workflows/security.yml'}, check.RELEASE23_NEW),
        (check.RELEASE23_EXISTING - {'scripts/security22/toolchain.py'}, check.RELEASE23_NEW),
        (check.RELEASE23_EXISTING, check.RELEASE23_NEW | {'scripts/security23/unissued.py'})]:
        expect('forged-or-truncated-grant', lambda a=existing,b=new: check.scope23_guard(a,b), 'R23_AUTHENTIC_FINITE_GRANT')
    for name in ['inputManifestSHA256', 'scopeSHA256']:
        changed = copy.deepcopy(candidate); changed[name] = '0'*64
        expect('stale-provenance:'+name, lambda v=changed: check.candidate23_guard(encode(v)), 'R23_NO_ADMISSION')
    for error in [ValueError('SYNTHETIC_EXCEPTION_TEXT_CANARY'), OSError('/SYNTHETIC_PATH_CANARY'),
        ValueError('R23_SYNTHETIC_UNKNOWN_CODE_CANARY'), ValueError(123)]:
        with patch.object(check, 'source23_guard', side_effect=error):
            expect('current-wrapper-fixed-disclosure', check.validate23, 'R23_EXECUTION_INCOMPLETE')
    with patch.object(check, 'source23_guard', side_effect=ValueError('R23_NO_ADMISSION')):
        expect('current-wrapper-retains-typed-refusal', check.validate23, 'R23_NO_ADMISSION')
    for unsafe, safe in [('FINITE_IDS:SYNTHETIC_LEGACY_SUFFIX_CANARY', 'FINITE_IDS:'),
        ('SCHEMA_TYPE:/SYNTHETIC_SCHEMA_PATH_CANARY', 'SCHEMA_TYPE:'),
        ('SOURCE_ABSENT:/SYNTHETIC_SOURCE_PATH_CANARY', 'SOURCE_ABSENT:'),
        ('NO_ADMISSION', 'NO_ADMISSION')]:
        with patch.object(check, 'source23_guard', return_value={}), patch.object(check,
            'historical21_validate', side_effect=ValueError(unsafe)):
            try: check.validate23()
            except ValueError as error: assert error.args == (safe,)
            else: raise AssertionError('legacy semantic refusal was accepted')
        rejected += 1
        print(json.dumps(dict(case='legacy-label-without-arbitrary-suffix', exit=1, code=safe)), flush=True)
    expect('duplicate-candidate-key', lambda: check.candidate23_guard(encode(candidate).replace(b'"schema": 1', b'"schema": 1,"schema": 1')), 'JSON_DUPLICATE_KEY')
    expect('nonfinite-candidate', lambda: check.candidate23_guard(encode(candidate).replace(b'"pr": null', b'"pr": NaN')), 'R23_NONFINITE_JSON')
    raw = (HERE/'check.py').read_bytes()
    expect('inherited-checker-exact', lambda: check.validate23_checker(raw), expected=0)
    expect('checker-grant-expansion-refused', lambda: check.validate23_checker(raw.replace(b"RELEASE23_EXISTING = {\n", b"RELEASE23_EXISTING = {\n    '.github/workflows/security.yml',\n")), 'R23_AUTHENTIC_FINITE_GRANT')
    for historical_blob in [
        '81266733cac51709cab8c7dc73d75c8d7979c532',
        '3c3d35988764604a92c3271ff8263d26862c4f3c',
        '409a56475aa99992ec9cebae370bdf0e61e45642',
        'ed72d7ec7b5d983b0dea4da672c4ab493c0cf272',
    ]:
        authentic = check.git23('cat-file', 'blob', historical_blob)
        expect('exact-pre-reader-checker-history', lambda b=authentic: check.validate23_checker(b), expected=0)
        expect('forged-pre-reader-checker-history', lambda b=authentic: check.validate23_checker(b.replace(
            b"RELEASE23_AUTHORITY = 'BRAIN-M1X-SECURITY-INTEGRATION23-REPAIR-01'",
            b"RELEASE23_AUTHORITY = 'UNISSUED'")), 'R23_HISTORICAL_CHECKER')
    reader_start = raw.index(b'def regular23('); reader_end = raw.index(b'def git23(', reader_start)
    expect('current-stable-reader-cannot-remove', lambda: check.validate23_checker(raw[:reader_start]+raw[reader_end:]), 'R23_HISTORICAL_CHECKER')
    expect('inherited-G97-cannot-clear', lambda: check.validate23_checker(raw.replace(b"'FAIL/NO_GO'", b"'PASS'", 1)), 'R23_INHERITED_BYTES')
    expect('inherited-custody-cannot-clear', lambda: check.validate23_checker(raw.replace(b"'BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED'", b"'ACCEPTED'", 1)), 'R23_INHERITED_BYTES')
    terminal = b"if __name__ == '__main__':\n    sys.exit(main())\n"
    expect('new-global-side-effect', lambda: check.validate23_checker(raw[:-len(terminal)]+b'RELEASE23_INJECT = globals().clear()\n'+terminal), 'R23_GLOBAL_SIDE_EFFECT')
    expect('new-function-injection', lambda: check.validate23_checker(raw[:-len(terminal)]+b'def arbitrary_function(): pass\n'+terminal), 'R23_FUNCTION_SCOPE')
    expect('new-dispatch-injection', lambda: check.validate23_checker(raw.replace(b'source_guard = source23_guard\n', b'source_guard = source21_guard\n')), 'R23_DISPATCH')
    expect('source-dispatch-omitted', lambda: check.validate23_checker(raw.replace(b'source_guard = source23_guard\n', b'')), 'R23_DISPATCH_REQUIRED')
    expect('validate-dispatch-omitted', lambda: check.validate23_checker(raw.replace(b'validate = validate23\n', b'')), 'R23_DISPATCH_REQUIRED')
    expect('duplicate-dispatch-refused', lambda: check.validate23_checker(raw[:-len(terminal)]+b'validate = validate23\n'+terminal), 'R23_DUPLICATE_ASSIGNMENT')
    tooling = check.git('show', check.RELEASE23_BASE+':scripts/phase9/patch-tooling-security.mjs')
    expect('active-historical-backports', lambda: check.tooling23_guard(tooling), expected=0)
    expect('historical-code-commented-out', lambda: check.tooling23_guard(b'/*'+tooling+b'*/\nexport function patchToolingSecurity(){return {status:"PASS"};}\n'), 'R23_ACTIVE_BACKPORT_PROFILES')
    expect('historical-code-inside-template', lambda: check.tooling23_guard(b'const inert = `'+tooling.replace(b'`', b'\\`')+b'`;\n'), 'R23_ACTIVE_BACKPORT_PROFILES')
    with patch.dict(os.environ, {'GIT_DIR': '/synthetic/redirect'}):
        expect('git-environment-before-history', check.source23_history, 'R23_GIT_ENV')
        expect('git-environment-before-endpoint', check.source23_endpoint, 'R23_GIT_ENV')
    for path in ['../escape', '/absolute', 'C:/drive', 'scripts/security22/../escape',
        'scripts/security22/Case.py', 'scripts/security22/run.py/child', '.github/workflows/security.yml',
        'scripts/phase9/security_acceptance/source-manifest.json', 'supabase/config.toml',
        'docs/phase-9/security-advisory-exceptions.json', 'apps/mobile/src/features/photos/store.ts']:
        expect('finite-scope:'+path, lambda p=path: check.require(check.allowed23(p), 'R23_FINITE_SCOPE'), 'R23_FINITE_SCOPE')
    for a, b in [('A/file', 'a/other'), ('Ａ/file', 'A/other')]:
        def alias():
            identities = {}; check.remember21(a, identities); check.remember21(b, identities)
        expect('implicit-parent-alias:'+a, alias, 'R21_')
    for path in ['package.json', 'apps/mobile/package.json', 'apps/catalog-operator-console/package.json']:
        original = check.git('show', check.RELEASE23_BASE+':'+path)
        expect('package-original:'+path, lambda p=path,b=original: check.package23_guard(p,b), expected=0)
        changed = json.loads(original); changed['name'] = 'unauthorized-product-change'
        expect('package-purpose:'+path, lambda p=path,v=changed: check.package23_guard(p,encode(v)), 'R23_PACKAGE_PURPOSE')
    original = json.loads(check.git('show', check.RELEASE23_BASE+':package.json'))
    changed = copy.deepcopy(original); changed['scripts']['test'] = 'echo green'
    expect('mandatory-test-cannot-disable', lambda: check.package23_guard('package.json', encode(changed)), 'R23_COMMAND_PRESERVATION')
    changed = copy.deepcopy(original); changed['scripts']['security23:test'] = 'python -B scripts/security22/test_security22.py'
    expect('additive-security22-wiring', lambda: check.package23_guard('package.json', encode(changed)), expected=0)
    changed = copy.deepcopy(original); changed['devDependencies']['react-native'] = '999.0.0'
    expect('framework-version-cannot-change', lambda: check.package23_guard('package.json', encode(changed)), 'R23_FRAMEWORK_VERSION')
    postinstall = check.git('show', check.RELEASE23_BASE+':scripts/postinstall.mjs')
    expect('postinstall-original', lambda: check.package23_guard('scripts/postinstall.mjs', postinstall), expected=0)
    expect('postinstall-early-exit-refused', lambda: check.package23_guard('scripts/postinstall.mjs', b'process.exit(0);\n'+postinstall), 'R23_POSTINSTALL_PRESERVATION')
    expect('postinstall-native-call-removal', lambda: check.package23_guard('scripts/postinstall.mjs', postinstall.replace(b'const viewShot = patchReactNativeViewShotPrivacy({ root, check });\n', b'')), 'R23_POSTINSTALL_PRESERVATION')
    with tempfile.TemporaryDirectory(prefix='onskin-public-read23-') as temporary:
        public = Path(temporary)/'public.json'; body = b'{"syntheticPublic":true}\n'
        public.write_bytes(body)
        expect('stable-bounded-public-read', lambda: check.require(check.regular23(public) == body, 'READ_MISMATCH'), expected=0)
        expect('public-read-bound', lambda: check.regular23(public, 1), 'R23_PUBLIC_BOUND')
        expect('public-read-boolean-bound', lambda: check.regular23(public, True), 'R23_PUBLIC_BOUND')
        expect('public-read-relative-path', lambda: check.regular23(Path('relative-public.json')), 'R23_PUBLIC_BOUND')
        alias = public.with_name('alias.json'); os.link(public, alias)
        try: expect('actual-public-hardlink-alias', lambda: check.regular23(public), 'R23_PUBLIC_FILE')
        finally: alias.unlink()
        expect('public-hardlink-restoration', lambda: check.require(check.regular23(public) == body, 'READ_MISMATCH'), expected=0)
        actual_lstat = Path.lstat; actual_fstat = os.fstat
        def domain_control(handle_change=False, path_change=False, windows=True):
            reads = dict(path=0, handle=0)
            def view(info, ctime, mode):
                fields = {name:getattr(info,name) for name in ('st_dev','st_ino','st_nlink','st_size','st_mtime_ns')}
                fields.update(st_mode=mode, st_ctime_ns=ctime, st_birthtime_ns=100,
                    st_file_attributes=getattr(info,'st_file_attributes',0))
                return type('SyntheticPublicTimeDomain', (), fields)()
            def path_stat(path):
                info = actual_lstat(path)
                if path != public: return info
                reads['path'] += 1
                return view(info,100+(path_change and reads['path'] > 1),info.st_mode | 0o111)
            def handle_stat(descriptor):
                info = actual_fstat(descriptor); reads['handle'] += 1
                return view(info,200+(handle_change and reads['handle'] > 1),info.st_mode & ~0o111)
            with patch.object(check.os,'name','nt' if windows else 'posix'), patch.object(Path,'lstat',path_stat), patch.object(check.os,'fstat',handle_stat):
                check.require(check.regular23(public) == body,'READ_MISMATCH')
        expect('synthetic-Windows-path-handle-time-domains', domain_control, expected=0)
        expect('synthetic-handle-ChangeTime-mutation', lambda: domain_control(handle_change=True), 'R23_PUBLIC_CHANGED')
        expect('synthetic-path-raw-time-mutation', lambda: domain_control(path_change=True), 'R23_PUBLIC_CHANGED')
        expect('POSIX-executable-mode-remains-strict', lambda: domain_control(windows=False), 'R23_PUBLIC_CHANGED')
        def linked_parent(path):
            info = actual_lstat(path)
            if path == public.parent:
                fields = list(info); fields[0] = __import__('stat').S_IFLNK | 0o777
                return os.stat_result(fields)
            return info
        with patch.object(Path, 'lstat', linked_parent):
            expect('synthetic-ancestor-link', lambda: check.regular23(public), 'R23_PUBLIC_PATH')
        def reparse_parent(path):
            info = actual_lstat(path)
            return type('SyntheticPublicReparse', (), dict(st_mode=info.st_mode, st_file_attributes=1024))() if path == public.parent else info
        with patch.object(Path, 'lstat', reparse_parent):
            expect('synthetic-ancestor-reparse', lambda: check.regular23(public), 'R23_PUBLIC_PATH')
        with patch.object(check.os, 'open', side_effect=OSError('/SYNTHETIC_PUBLIC_READ_ERROR_CANARY')):
            expect('public-read-error-fixed-code', lambda: check.regular23(public), 'R23_PUBLIC_READ_INCOMPLETE')
        actual_read = os.read; mutated = [False]
        def mutate_public(descriptor, amount):
            chunk = actual_read(descriptor, amount)
            if chunk and not mutated[0]:
                mutated[0] = True
                with public.open('ab') as stream: stream.write(b'synthetic mutation')
            return chunk
        try:
            with patch.object(check.os, 'read', mutate_public):
                expect('actual-public-read-mutation', lambda: check.regular23(public), 'R23_PUBLIC_')
        finally: public.write_bytes(body)
        expect('public-read-mutation-restored', lambda: check.require(check.regular23(public) == body, 'READ_MISMATCH'), expected=0)
        public.unlink()
        expect('missing-public-input', lambda: check.regular23(public), 'R23_PUBLIC_READ_INCOMPLETE')
    for blob in ['df3e5f5763a3cbfa7684a53e1138981c56ecb1dc',
        'fe5b20c5c29c54e2376eb7314d94af2f8ed6f37c','6c7fc81a4fc32d450994b7c29240914feba9dc47']:
        historical = check.git23('cat-file','blob',blob)
        expect('exact-pre-fixture-current-profile',lambda b=historical:check.validate23_checker(b),expected=0)
        expect('forged-pre-fixture-current-profile',lambda b=historical:check.validate23_checker(
            b.replace(b"RELEASE23_AUTHORITY = 'BRAIN-M1X-SECURITY-INTEGRATION23-REPAIR-01'",
            b"RELEASE23_AUTHORITY = 'UNISSUED'")),'R23_HISTORICAL_CHECKER')
    fixture_start = raw.index(b'def fixture23_validate('); fixture_end = raw.index(b'def validate23(',fixture_start)
    expect('fixture-helper-cannot-remove',lambda:check.validate23_checker(raw[:fixture_start]+raw[fixture_end:]),'R23_HISTORICAL_CHECKER')
    current_calls = []
    def current_replay(bundle):
        current_calls.append(bundle)
        return dict(valid=True,release='NO_GO')
    with patch.object(check,'source23_guard',return_value={}), patch.object(check,'historical21_validate',current_replay), patch.object(check,'fixture23_validate',side_effect=AssertionError('current-is-not-fixture')):
        expect('default-current-retains-full-dispatch',check.validate23,expected=0)
        expect('noncanonical-current-bundle-retains-current-dispatch',lambda:check.validate23(check.BUNDLE/'..'/check.BUNDLE.name),expected=0)
    assert current_calls == [check.BUNDLE,check.BUNDLE]
    with tempfile.TemporaryDirectory(prefix='onskin-explicit-fixture23-') as temporary:
        fixture = Path(temporary)/'bundle';shutil.copytree(check.BUNDLE,fixture)
        result = check.fixture23_validate(fixture)
        assert result['valid'] is True and result['qualification'] == check.RELEASE23_FIXTURE_QUALIFICATION
        assert result['current_source_governance'] == result['current_source'] == result['source_acceptance'] == 'NOT_CHECKED_CURRENT'
        assert result['acceptanceGranted'] is False and all(v is False for v in result['admissions'].values()) and result['release']=='NO_GO'
        positives += 1
        print(json.dumps(dict(case='actual-explicit-fixture-positive',exit=0,qualification=result['qualification'])),flush=True)
        contract = fixture/'contract.v1.json';body=contract.read_bytes();changed=json.loads(body)
        changed['admissions'][next(iter(changed['admissions']))]=True;contract.write_bytes(encode(changed))
        try:
            expect('actual-mutant-is-not-replaced-with-authentic-inputs',lambda:check.fixture23_validate(fixture),'NO_ADMISSION')
            command=[sys.executable,'-B',str(HERE/'check.py'),'--bundle-dir',str(fixture)]
            child=subprocess.run(command,capture_output=True,timeout=30);message=json.loads(child.stdout)
            assert child.returncode==1 and message['error'].startswith('NO_ADMISSION') and check.RELEASE23_FIXTURE_QUALIFICATION in message['error']
            assert 'SOURCE=NOT_CHECKED_CURRENT' in message['error'] and 'ADMISSIONS=FALSE' in message['error']
            rejected += 1
            print(json.dumps(dict(case='actual-fixture-cli-error-scope',exit=1,error=message['error'])),flush=True)
        finally:contract.write_bytes(body)
        matrix=fixture/'matrix.v1.json';matrix_body=matrix.read_bytes();changed=json.loads(matrix_body)
        reference=next(row for row in changed['rows'] if row.get('source_refs'))['source_refs'][0]
        metadata=check.git23('ls-tree',check.BASE,'--','.gitignore').decode().split('\t',1)[0].split()
        mode,kind,unapproved_blob=metadata
        reference.update(path='.gitignore',source_commit=check.BASE,mode=mode,blob=unapproved_blob,sha256='0'*64)
        matrix.write_bytes(encode(changed));actual_git=check.git23
        def refuse_unapproved_content(*args):
            assert args != ('cat-file','blob',unapproved_blob),'UNAPPROVED_SOURCE_CONTENT_OPENED'
            assert args != ('show',check.BASE+':.gitignore'),'UNAPPROVED_SOURCE_CONTENT_OPENED'
            return actual_git(*args)
        try:
            with patch.object(check,'git23',refuse_unapproved_content):
                expect('unapproved-public-tracked-witness-not-opened',lambda:check.fixture23_validate(fixture),'R23_FIXTURE_READ_SCOPE')
        finally:matrix.write_bytes(matrix_body)
        schema=fixture/'schema.v1.json';schema_body=schema.read_bytes();schema.write_bytes(b'{"$schema":"https://json-schema.org/draft/2020-12/schema"}')
        try:expect('forged-fixture-schema-refused',lambda:check.fixture23_validate(fixture),'R23_FIXTURE_SCHEMA')
        finally:schema.write_bytes(schema_body)
        alias=fixture.parent/'public-contract-alias';os.link(contract,alias)
        try:expect('actual-fixture-hardlink-refused',lambda:check.fixture23_validate(fixture),'R23_PUBLIC_FILE')
        finally:alias.unlink()
        empty=fixture.parent/'empty';empty.mkdir()
        expect('missing-fixture-input-refused',lambda:check.fixture23_validate(empty),'R23_PUBLIC_READ_INCOMPLETE')
        canonical=fixture.parent/'changed-canonical';shutil.copytree(check.BUNDLE,canonical)
        (canonical/'contract.v1.json').write_bytes(body+b' ')
        with patch.object(check,'BUNDLE',canonical):
            expect('changed-canonical-meaning-does-not-inherit-history',lambda:check.fixture23_validate(fixture),'R23_FIXTURE_CANONICAL_INPUT')
        saved=check.RELEASE23_FIXTURE_CHECKER_SHA256
        with patch.object(check,'RELEASE23_FIXTURE_CHECKER_SHA256','0'*64):
            expect('forged-fixture-checker-source-refused',lambda:check.fixture23_validate(fixture),'R23_FIXTURE_SOURCE')
        with patch.object(check,'RELEASE23_FIXTURE_TREE','0'*40):
            expect('forged-fixture-tree-refused',lambda:check.fixture23_validate(fixture),'R23_FIXTURE_SOURCE')
        actual_git=check.git23;changed_during=[False]
        def change_fixture(*args):
            if args == ('ls-tree','-r','-z',check.RELEASE23_FIXTURE_SOURCE) and not changed_during[0]:
                changed_during[0]=True;contract.write_bytes(body+b' ')
            return actual_git(*args)
        try:
            with patch.object(check,'git23',change_fixture):
                expect('fixture-mutates-during-validation',lambda:check.fixture23_validate(fixture),'R23_FIXTURE_CHANGED')
        finally:contract.write_bytes(body)
        sentinel=io.StringIO()
        with patch.object(check,'fixture23_validate',side_effect=OSError('/SYNTHETIC_FIXTURE_PATH_CANARY')), patch.object(sys,'argv',[str(HERE/'check.py'),'--bundle-dir',str(fixture)]), redirect_stdout(sentinel):
            code=check.main()
        message=json.loads(sentinel.getvalue());assert code==1 and 'SYNTHETIC_FIXTURE_PATH_CANARY' not in sentinel.getvalue()
        assert message['error'].startswith('R23_FIXTURE_INCOMPLETE') and check.RELEASE23_FIXTURE_QUALIFICATION in message['error']
        rejected += 1
        print(json.dumps(dict(case='fixture-errors-do-not-disclose-arbitrary-text',exit=1)),flush=True)
        expect('explicit-fixture-exact-restoration',lambda:check.require(check.fixture23_validate(fixture)['valid'] is True,'FIXTURE_RESTORATION'),expected=0)
    old_root = check.ROOT
    common = Path(check.git('rev-parse', '--git-common-dir').decode().strip())
    if not common.is_absolute(): common = (old_root/common).resolve()
    with tempfile.TemporaryDirectory(prefix='onskin-source23-') as tmp:
        root = Path(tmp)
        def git(*args, data=None):
            result = subprocess.run(['git', '-c', 'core.longpaths=true', '-c', 'core.autocrlf=false', *args], cwd=root, input=data, capture_output=True)
            if result.returncode: raise subprocess.CalledProcessError(result.returncode, args, result.stdout, result.stderr)
            return result.stdout
        git('init', '--quiet'); (root/'.git/objects/info/alternates').write_bytes(((common/'objects').as_posix()+'\n').encode())
        git('read-tree', check.RELEASE23_BASE)
        def put(path, data=b'bounded synthetic input\n', mode='100644'):
            oid = git('hash-object', '-w', '--stdin', data=data).decode().strip()
            git('update-index', '--add', '--cacheinfo', mode, oid, path)
        def commit(parent, second=None):
            args = ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit-tree', git('write-tree').decode().strip(), '-p', parent]
            if second: args += ['-p', second]
            return git(*args, data=b'Release23 synthetic Git fixture\n').decode().strip()
        def delta(parent=None):
            check.validate23_diff(git('diff', '--cached', '--raw', '--no-abbrev', '--no-renames', '-z', parent or check.RELEASE23_BASE),
                lambda p: git('show', ':'+p), parent)
        put('scripts/release/full-app-j01/check.py', raw)
        put(check.RELEASE23_CANDIDATE, encode(candidate))
        authentic_tree = git('write-tree').decode().strip()
        authentic = commit(check.RELEASE23_BASE); git('update-ref', 'HEAD', authentic)
        check.ROOT = root
        actions_environment = os.environ.pop('GITHUB_ACTIONS', None)
        try:
            expect('synthetic-authentic-index', delta, expected=0)
            expect('synthetic-authentic-history', check.source23_history, expected=0)
            ci_candidate = copy.deepcopy(candidate); ci_candidate['pr'] = 26
            ci_path = root/check.RELEASE23_CANDIDATE; ci_path.parent.mkdir(parents=True); ci_path.write_bytes(encode(ci_candidate))
            event = dict(number=26, repository=dict(full_name='TasfiqJ/onSkin'), pull_request=dict(number=26,
                base=dict(sha=check.RELEASE23_BASE, ref='stage/m1-security-recovery22'),
                head=dict(sha=authentic, ref='stage/m1-security-integration23', repo=dict(full_name='TasfiqJ/onSkin')),
                draft=True, maintainer_can_modify=False, auto_merge=None))
            event_path = root/'synthetic-event.json'; event_path.write_bytes(encode(event))
            env = dict(GITHUB_ACTIONS='true', GITHUB_EVENT_NAME='pull_request', GITHUB_REPOSITORY='TasfiqJ/onSkin',
                GITHUB_REF='refs/pull/26/merge', GITHUB_SHA=authentic, GITHUB_EVENT_PATH=str(event_path))
            with patch.dict(os.environ, env):
                expect('exact-single-parent-candidate-event', check.source23_endpoint, expected=0)
                with patch.dict(os.environ, {'GITHUB_REF': 'refs/heads/main'}):
                    expect('single-parent-wrong-CI-ref', check.source23_endpoint, 'R23_CI_EVENT')
                event['pull_request']['number'] = 26.0; event_path.write_bytes(encode(event))
                expect('nested-PR-number-float', check.source23_endpoint, 'R23_CI_EVENT')
                event['pull_request']['number'] = 26; event_path.write_bytes(encode(event))
                expect('single-parent-event-restored', check.source23_endpoint, expected=0)
                del event['pull_request']['auto_merge']; event_path.write_bytes(encode(event))
                expect('missing-auto-merge-field', check.source23_endpoint, 'R23_CI_EVENT')
                event['pull_request']['auto_merge'] = False; event_path.write_bytes(encode(event))
                expect('false-auto-merge-is-not-null', check.source23_endpoint, 'R23_CI_EVENT')
                event['pull_request']['auto_merge'] = None
                event['pull_request']['number'] = True; event_path.write_bytes(encode(event))
                expect('boolean-nested-PR-number', check.source23_endpoint, 'R23_CI_EVENT')
                event['pull_request']['number'] = 26
                event['pull_request']['maintainer_can_modify'] = 0; event_path.write_bytes(encode(event))
                expect('numeric-maintainer-flag', check.source23_endpoint, 'R23_CI_EVENT')
                event['pull_request']['maintainer_can_modify'] = False
                event_path.write_bytes(encode(event)+b' '*(1024*1024))
                expect('oversize-event-refused-before-json', check.source23_endpoint, 'R23_CI_EVENT_SIZE')
                event_path.write_bytes(encode(event))
                expect('bounded-event-restored', check.source23_endpoint, expected=0)
                event_path.write_bytes(b'[]')
                expect('event-root-array-refused', check.source23_endpoint, 'R23_CI_EVENT')
                changed_event = copy.deepcopy(event); changed_event['pull_request']['head'] = False
                event_path.write_bytes(encode(changed_event))
                expect('event-false-head-schema', check.source23_endpoint, 'R23_CI_EVENT')
                event_path.write_bytes(b'{"SYNTHETIC_EVENT_KEY_CANARY":1,"SYNTHETIC_EVENT_KEY_CANARY":2}')
                try: check.source23_endpoint()
                except ValueError as error: assert str(error) == 'R23_CI_EVENT_JSON'
                else: raise AssertionError('malformed event was accepted')
                expect('event-duplicate-key-generic-refusal', check.source23_endpoint, 'R23_CI_EVENT_JSON')
                event_path.write_bytes(encode(event))
            (root/'.git/info/grafts').write_bytes(b'bounded synthetic graft\n')
            expect('graft-substitution-refused', check.source23_history, 'R23_HISTORY_SUBSTITUTION')
            (root/'.git/info/grafts').unlink()
            for path in ['.github/workflows/security.yml', 'scripts/phase9/security_acceptance/contract.py',
                'scripts/release/full-app-j01/test_contract.py', 'supabase/config.toml',
                'docs/brain/state/brain_state.json', 'apps/mobile/src/features/photos/store.ts']:
                put(path); expect('protected-edit:'+path, delta, 'R23_FINITE_SCOPE'); git('read-tree', authentic_tree)
                git('update-index', '--force-remove', path); expect('protected-delete:'+path, delta, 'R23_FINITE_SCOPE'); git('read-tree', authentic_tree)
            for mode in ['100755', '120000', '160000']:
                if mode == '160000': git('update-index', '--add', '--cacheinfo', mode, authentic, 'scripts/security22/run.py')
                else: put('scripts/security22/run.py', mode=mode)
                expect('new-mode:'+mode, delta, 'R23_MODE_OR_DELETION'); git('read-tree', authentic_tree)
            put('scripts/security23/README.md'); first = commit(authentic); git('update-ref', 'HEAD', first)
            first_tree = git('write-tree').decode().strip()
            git('update-index', '--force-remove', 'scripts/security23/README.md')
            deleted = commit(first); git('update-ref', 'HEAD', deleted)
            expect('intermediate-add-delete-cannot-hide', check.source23_history, 'R23_MODE_OR_DELETION')
            git('read-tree', first_tree); put('.github/workflows/security.yml'); tamper = commit(first)
            git('read-tree', first_tree); restored = commit(tamper); git('update-ref', 'HEAD', restored)
            expect('protected-tamper-restored-history-refused', check.source23_history, 'R23_FINITE_SCOPE')
            git('read-tree', authentic_tree); merged = commit(authentic, first); git('update-ref', 'HEAD', merged)
            expect('unauthorized-merge-refused', check.source23_history, 'R23_CI_CONTEXT')
            git('update-ref', 'HEAD', authentic); git('read-tree', authentic_tree)
            put('ONSKIN_BRAIN_HANDOFF.txt'); early = commit(authentic); git('update-ref', 'HEAD', early)
            expect('handoff-before-evidence-refused', check.source23_history, 'R23_HANDOFF_BEFORE_TAIL')
            git('update-ref', 'HEAD', authentic); git('read-tree', authentic_tree)
            expect('synthetic-restored-history', check.source23_history, expected=0)
            # These are synthetic checkpoint-envelope controls, not a clean full checkout.
            for path in check.RELEASE23_WORKLIST: put(path, b'synthetic generated-worklist fixture\n')
            source_head = commit(authentic); source_tree = git('write-tree').decode().strip()
            source = dict(base=check.RELEASE23_BASE, baseTree=check.RELEASE23_TREE,
                runtimeHead=authentic, runtimeTree=authentic_tree, sourceHead=source_head, sourceTree=source_tree)
            checkpoint = root/check.RELEASE23_CHECKPOINT; checkpoint.mkdir(parents=True)
            files = {}
            for name in ['README.md', 'FINAL_REPORT.md', 'payload.zip', 'verify23.py']:
                body = ('synthetic envelope '+name+'\n').encode(); (checkpoint/name).write_bytes(body)
                files[name] = dict(bytes=len(body), sha256=check.sha(body)); put(check.RELEASE23_CHECKPOINT+name, body)
            manifest = dict(schema=1, authority=check.RELEASE23_AUTHORITY, status='SUBMITTED_REVIEW_REQUIRED',
                acceptanceGranted=False, release='NO_GO', inputManifestSHA256='a18911e49a60663dd8b66b9d2e609235d153c4ad48d8dafc361225f341557576',
                source=source, files=files, payload={})
            manifest_bytes = encode(manifest); (checkpoint/'manifest.json').write_bytes(manifest_bytes)
            put(check.RELEASE23_CHECKPOINT+'manifest.json', manifest_bytes)
            (root/'ONSKIN_BRAIN_HANDOFF.txt').write_bytes(b'synthetic factual handoff fixture\n')
            put('ONSKIN_BRAIN_HANDOFF.txt', b'synthetic factual handoff fixture\n')
            tail_head = commit(source_head); tail_tree = git('write-tree').decode().strip(); git('update-ref', 'HEAD', tail_head)
            expect('synthetic-envelope-exact', lambda: check.evidence23_guard(tail_head), expected=0)
            unexpected_directory = checkpoint/'unexpected-public-directory'; unexpected_directory.mkdir()
            try: expect('evidence-unexpected-directory', lambda: check.evidence23_guard(tail_head), 'R23_EVIDENCE_REGULAR')
            finally: unexpected_directory.rmdir()
            expect('evidence-directory-restored', lambda: check.evidence23_guard(tail_head), expected=0)
            for field, value, code in [('schema', True, 'R23_EVIDENCE_NO_ADMISSION'),
                ('acceptanceGranted', 0, 'R23_EVIDENCE_NO_ADMISSION'), ('release', 'GO', 'R23_EVIDENCE_NO_ADMISSION')]:
                changed = copy.deepcopy(manifest); changed[field] = value; (checkpoint/'manifest.json').write_bytes(encode(changed))
                expect('evidence-schema:'+field, lambda: check.evidence23_guard(tail_head), code)
            changed = copy.deepcopy(manifest); changed['source']['sourceTree'] = '0'*40
            (checkpoint/'manifest.json').write_bytes(encode(changed))
            expect('evidence-wrong-tree', lambda: check.evidence23_guard(tail_head), 'R23_ONE_EVIDENCE_TAIL')
            changed = copy.deepcopy(manifest); changed['files']['README.md']['bytes'] = True
            (checkpoint/'manifest.json').write_bytes(encode(changed))
            expect('evidence-boolean-count', lambda: check.evidence23_guard(tail_head), 'R23_EVIDENCE_HASH')
            (checkpoint/'manifest.json').write_bytes(manifest_bytes.replace(b'"schema": 1', b'"schema": 1,"schema": 1'))
            expect('evidence-duplicate-json', lambda: check.evidence23_guard(tail_head), 'JSON_DUPLICATE_KEY')
            (checkpoint/'manifest.json').write_bytes(manifest_bytes)
            original_report = (checkpoint/'FINAL_REPORT.md').read_bytes(); (checkpoint/'FINAL_REPORT.md').write_bytes(original_report+b'corrupt')
            expect('artifact-corruption-refused', lambda: check.evidence23_guard(tail_head), 'R23_EVIDENCE_HASH')
            changed = copy.deepcopy(manifest); changed['files']['FINAL_REPORT.md'] = dict(bytes=len(original_report)+7,
                sha256=check.sha(original_report+b'corrupt')); (checkpoint/'manifest.json').write_bytes(encode(changed))
            expect('fabricated-clean-artifact-rehash-refused', lambda: check.evidence23_guard(tail_head), 'R23_EVIDENCE_COMMITTED_BYTES')
            (checkpoint/'FINAL_REPORT.md').write_bytes(original_report); (checkpoint/'manifest.json').write_bytes(manifest_bytes)
            expect('synthetic-envelope-restored', lambda: check.evidence23_guard(tail_head), expected=0)
            put('scripts/security22/README.md'); extra_tail = commit(tail_head); git('update-ref', 'HEAD', extra_tail)
            expect('second-evidence-tail-refused', check.source23_history, 'R23_AFTER_EVIDENCE_TAIL')
            git('read-tree', tail_tree); git('update-ref', 'HEAD', tail_head)
        finally:
            check.ROOT = old_root
            if actions_environment is not None: os.environ['GITHUB_ACTIONS'] = actions_environment
    print(json.dumps(dict(status='PASS', qualification='SYNTHETIC_GIT_SEGMENT_ONLY_NOT_REAL_CHECKOUT_OR_SCANNER',
        refusals=rejected, positiveControls=positives, acceptanceGranted=False, release='NO_GO')), flush=True)


if __name__ == '__main__':
    main()
