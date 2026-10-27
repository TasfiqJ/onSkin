"""Release22 synthetic Git falsification; separate from real-checkout/scanner proof."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
from unittest.mock import patch


HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('release22_check', HERE/'check.py')
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
    candidate = dict(schema=1, authority=check.RELEASE22_AUTHORITY, status='SUBMITTED_REVIEW_REQUIRED',
        base=check.RELEASE22_BASE, tree=check.RELEASE22_TREE, acceptanceGranted=False, pr=None,
        admissions=dict(G97=False, DB=False, M103=False, M2=False, J01=False, PUBLIC=False))
    encode = lambda value: (json.dumps(value, sort_keys=True)+'\n').encode()
    expect('candidate-qualified', lambda: check.candidate22_guard(encode(candidate)), expected=0)
    for name, value in [('schema', True), ('schema', 1.0), ('acceptanceGranted', 0), ('pr', True),
        ('pr', 0), ('pr', -1), ('pr', 25.0), ('base', '0'*40), ('tree', '0'*40),
        ('status', 'ACCEPTED'), ('authority', 'UNREVIEWED')]:
        changed = copy.deepcopy(candidate); changed[name] = value
        expect('candidate-type-or-authority:'+name+':'+repr(value), lambda v=changed: check.candidate22_guard(encode(v)), 'R22_NO_ADMISSION')
    for gate in candidate['admissions']:
        for value in [True, 0, None, 'false']:
            changed = copy.deepcopy(candidate); changed['admissions'][gate] = value
            expect('technical-pass-cannot-admit:'+gate+':'+repr(value), lambda v=changed: check.candidate22_guard(encode(v)), 'R22_NO_ADMISSION')
    expect('duplicate-candidate-key', lambda: check.candidate22_guard(encode(candidate).replace(b'"schema": 1', b'"schema": 1,"schema": 1')), 'JSON_DUPLICATE_KEY')
    expect('nonfinite-candidate', lambda: check.candidate22_guard(encode(candidate).replace(b'"pr": null', b'"pr": NaN')), 'R22_NONFINITE_JSON')
    raw = (HERE/'check.py').read_bytes()
    expect('inherited-checker-exact', lambda: check.validate22_checker(raw), expected=0)
    expect('inherited-G97-cannot-clear', lambda: check.validate22_checker(raw.replace(b"'FAIL/NO_GO'", b"'PASS'", 1)), 'R22_INHERITED_BYTES')
    expect('inherited-custody-cannot-clear', lambda: check.validate22_checker(raw.replace(b"'BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED'", b"'ACCEPTED'", 1)), 'R22_INHERITED_BYTES')
    terminal = b"if __name__ == '__main__':\n    sys.exit(main())\n"
    expect('new-global-side-effect', lambda: check.validate22_checker(raw[:-len(terminal)]+b'RELEASE22_INJECT = globals().clear()\n'+terminal), 'R22_GLOBAL_SIDE_EFFECT')
    expect('new-function-injection', lambda: check.validate22_checker(raw[:-len(terminal)]+b'def arbitrary_function(): pass\n'+terminal), 'R22_FUNCTION_SCOPE')
    expect('new-dispatch-injection', lambda: check.validate22_checker(raw.replace(b'source_guard = source22_guard\n', b'source_guard = source21_guard\n')), 'R22_DISPATCH')
    expect('source-dispatch-omitted', lambda: check.validate22_checker(raw.replace(b'source_guard = source22_guard\n', b'')), 'R22_DISPATCH_REQUIRED')
    expect('validate-dispatch-omitted', lambda: check.validate22_checker(raw.replace(b'validate = validate22\n', b'')), 'R22_DISPATCH_REQUIRED')
    expect('duplicate-dispatch-refused', lambda: check.validate22_checker(raw[:-len(terminal)]+b'validate = validate22\n'+terminal), 'R22_DUPLICATE_ASSIGNMENT')
    tooling = check.git('show', check.RELEASE22_BASE+':scripts/phase9/patch-tooling-security.mjs')
    expect('active-historical-backports', lambda: check.tooling22_guard(tooling), expected=0)
    expect('historical-code-commented-out', lambda: check.tooling22_guard(b'/*'+tooling+b'*/\nexport function patchToolingSecurity(){return {status:"PASS"};}\n'), 'R22_ACTIVE_BACKPORT_PROFILES')
    expect('historical-code-inside-template', lambda: check.tooling22_guard(b'const inert = `'+tooling.replace(b'`', b'\\`')+b'`;\n'), 'R22_ACTIVE_BACKPORT_PROFILES')
    with patch.dict(os.environ, {'GIT_DIR': '/synthetic/redirect'}):
        expect('git-environment-before-history', check.source22_history, 'R22_GIT_ENV')
        expect('git-environment-before-endpoint', check.source22_endpoint, 'R22_GIT_ENV')
    for path in ['../escape', '/absolute', 'C:/drive', 'scripts/security22/../escape',
        'scripts/security22/Case.py', 'scripts/security22/run.py/child', '.github/workflows/security.yml',
        'scripts/phase9/security_acceptance/source-manifest.json', 'supabase/config.toml',
        'docs/phase-9/security-advisory-exceptions.json', 'apps/mobile/src/features/photos/store.ts']:
        expect('finite-scope:'+path, lambda p=path: check.require(check.allowed22(p), 'R22_FINITE_SCOPE'), 'R22_FINITE_SCOPE')
    for a, b in [('A/file', 'a/other'), ('Ａ/file', 'A/other')]:
        def alias():
            identities = {}; check.remember21(a, identities); check.remember21(b, identities)
        expect('implicit-parent-alias:'+a, alias, 'R21_')
    for path in ['package.json', 'apps/mobile/package.json', 'apps/catalog-operator-console/package.json']:
        original = check.git('show', check.RELEASE22_BASE+':'+path)
        expect('package-original:'+path, lambda p=path,b=original: check.package22_guard(p,b), expected=0)
        changed = json.loads(original); changed['name'] = 'unauthorized-product-change'
        expect('package-purpose:'+path, lambda p=path,v=changed: check.package22_guard(p,encode(v)), 'R22_PACKAGE_PURPOSE')
    original = json.loads(check.git('show', check.RELEASE22_BASE+':package.json'))
    changed = copy.deepcopy(original); changed['scripts']['test'] = 'echo green'
    expect('mandatory-test-cannot-disable', lambda: check.package22_guard('package.json', encode(changed)), 'R22_COMMAND_PRESERVATION')
    changed = copy.deepcopy(original); changed['scripts']['security22:test'] = 'python -B scripts/security22/test_security22.py'
    expect('additive-security22-wiring', lambda: check.package22_guard('package.json', encode(changed)), expected=0)
    changed = copy.deepcopy(original); changed['devDependencies']['react-native'] = '999.0.0'
    expect('framework-version-cannot-change', lambda: check.package22_guard('package.json', encode(changed)), 'R22_FRAMEWORK_VERSION')
    postinstall = check.git('show', check.RELEASE22_BASE+':scripts/postinstall.mjs')
    expect('postinstall-original', lambda: check.package22_guard('scripts/postinstall.mjs', postinstall), expected=0)
    expect('postinstall-early-exit-refused', lambda: check.package22_guard('scripts/postinstall.mjs', b'process.exit(0);\n'+postinstall), 'R22_POSTINSTALL_PRESERVATION')
    expect('postinstall-native-call-removal', lambda: check.package22_guard('scripts/postinstall.mjs', postinstall.replace(b'const viewShot = patchReactNativeViewShotPrivacy({ root, check });\n', b'')), 'R22_POSTINSTALL_PRESERVATION')
    old_root = check.ROOT
    common = Path(check.git('rev-parse', '--git-common-dir').decode().strip())
    if not common.is_absolute(): common = (old_root/common).resolve()
    with tempfile.TemporaryDirectory(prefix='onskin-source22-') as tmp:
        root = Path(tmp)
        def git(*args, data=None):
            result = subprocess.run(['git', '-c', 'core.longpaths=true', '-c', 'core.autocrlf=false', *args], cwd=root, input=data, capture_output=True)
            if result.returncode: raise subprocess.CalledProcessError(result.returncode, args, result.stdout, result.stderr)
            return result.stdout
        git('init', '--quiet'); (root/'.git/objects/info/alternates').write_bytes(((common/'objects').as_posix()+'\n').encode())
        git('read-tree', check.RELEASE22_BASE)
        def put(path, data=b'bounded synthetic input\n', mode='100644'):
            oid = git('hash-object', '-w', '--stdin', data=data).decode().strip()
            git('update-index', '--add', '--cacheinfo', mode, oid, path)
        def commit(parent, second=None):
            args = ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit-tree', git('write-tree').decode().strip(), '-p', parent]
            if second: args += ['-p', second]
            return git(*args, data=b'Release22 synthetic Git fixture\n').decode().strip()
        def delta(parent=None):
            check.validate22_diff(git('diff', '--cached', '--raw', '--no-abbrev', '--no-renames', '-z', parent or check.RELEASE22_BASE),
                lambda p: git('show', ':'+p), parent)
        put('scripts/release/full-app-j01/check.py', raw)
        put(check.RELEASE22_CANDIDATE, encode(candidate))
        authentic_tree = git('write-tree').decode().strip()
        authentic = commit(check.RELEASE22_BASE); git('update-ref', 'HEAD', authentic)
        check.ROOT = root
        actions_environment = os.environ.pop('GITHUB_ACTIONS', None)
        try:
            expect('synthetic-authentic-index', delta, expected=0)
            expect('synthetic-authentic-history', check.source22_history, expected=0)
            ci_candidate = copy.deepcopy(candidate); ci_candidate['pr'] = 26
            ci_path = root/check.RELEASE22_CANDIDATE; ci_path.parent.mkdir(parents=True); ci_path.write_bytes(encode(ci_candidate))
            event = dict(number=26, repository=dict(full_name='TasfiqJ/onSkin'), pull_request=dict(number=26,
                base=dict(sha=check.RELEASE22_BASE, ref='stage/m1-f09-layout-compatibility21'),
                head=dict(sha=authentic, ref='stage/m1-security-recovery22', repo=dict(full_name='TasfiqJ/onSkin')),
                draft=True, maintainer_can_modify=False, auto_merge=None))
            event_path = root/'synthetic-event.json'; event_path.write_bytes(encode(event))
            env = dict(GITHUB_ACTIONS='true', GITHUB_EVENT_NAME='pull_request', GITHUB_REPOSITORY='TasfiqJ/onSkin',
                GITHUB_REF='refs/pull/26/merge', GITHUB_SHA=authentic, GITHUB_EVENT_PATH=str(event_path))
            with patch.dict(os.environ, env):
                expect('exact-single-parent-candidate-event', check.source22_endpoint, expected=0)
                with patch.dict(os.environ, {'GITHUB_REF': 'refs/heads/main'}):
                    expect('single-parent-wrong-CI-ref', check.source22_endpoint, 'R22_CI_EVENT')
                event['pull_request']['number'] = 26.0; event_path.write_bytes(encode(event))
                expect('nested-PR-number-float', check.source22_endpoint, 'R22_CI_EVENT')
                event['pull_request']['number'] = 26; event_path.write_bytes(encode(event))
                expect('single-parent-event-restored', check.source22_endpoint, expected=0)
                del event['pull_request']['auto_merge']; event_path.write_bytes(encode(event))
                expect('missing-auto-merge-field', check.source22_endpoint, 'R22_CI_EVENT')
                event['pull_request']['auto_merge'] = False; event_path.write_bytes(encode(event))
                expect('false-auto-merge-is-not-null', check.source22_endpoint, 'R22_CI_EVENT')
                event['pull_request']['auto_merge'] = None
                event['pull_request']['number'] = True; event_path.write_bytes(encode(event))
                expect('boolean-nested-PR-number', check.source22_endpoint, 'R22_CI_EVENT')
                event['pull_request']['number'] = 26
                event['pull_request']['maintainer_can_modify'] = 0; event_path.write_bytes(encode(event))
                expect('numeric-maintainer-flag', check.source22_endpoint, 'R22_CI_EVENT')
                event['pull_request']['maintainer_can_modify'] = False
                event_path.write_bytes(encode(event)+b' '*(1024*1024))
                expect('oversize-event-refused-before-json', check.source22_endpoint, 'R22_CI_EVENT_SIZE')
                event_path.write_bytes(encode(event))
                expect('bounded-event-restored', check.source22_endpoint, expected=0)
                event_path.write_bytes(b'[]')
                expect('event-root-array-refused', check.source22_endpoint, 'R22_CI_EVENT')
                changed_event = copy.deepcopy(event); changed_event['pull_request']['head'] = False
                event_path.write_bytes(encode(changed_event))
                expect('event-false-head-schema', check.source22_endpoint, 'R22_CI_EVENT')
                event_path.write_bytes(b'{"SYNTHETIC_EVENT_KEY_CANARY":1,"SYNTHETIC_EVENT_KEY_CANARY":2}')
                try: check.source22_endpoint()
                except ValueError as error: assert str(error) == 'R22_CI_EVENT_JSON'
                else: raise AssertionError('malformed event was accepted')
                expect('event-duplicate-key-generic-refusal', check.source22_endpoint, 'R22_CI_EVENT_JSON')
                event_path.write_bytes(encode(event))
            (root/'.git/info/grafts').write_bytes(b'bounded synthetic graft\n')
            expect('graft-substitution-refused', check.source22_history, 'R22_HISTORY_SUBSTITUTION')
            (root/'.git/info/grafts').unlink()
            for path in ['.github/workflows/security.yml', 'scripts/phase9/security_acceptance/contract.py',
                'scripts/release/full-app-j01/test_contract.py', 'supabase/config.toml',
                'docs/brain/state/brain_state.json', 'apps/mobile/src/features/photos/store.ts']:
                put(path); expect('protected-edit:'+path, delta, 'R22_FINITE_SCOPE'); git('read-tree', authentic_tree)
                git('update-index', '--force-remove', path); expect('protected-delete:'+path, delta, 'R22_FINITE_SCOPE'); git('read-tree', authentic_tree)
            for mode in ['100755', '120000', '160000']:
                if mode == '160000': git('update-index', '--add', '--cacheinfo', mode, authentic, 'scripts/security22/run.py')
                else: put('scripts/security22/run.py', mode=mode)
                expect('new-mode:'+mode, delta, 'R22_MODE_OR_DELETION'); git('read-tree', authentic_tree)
            put('scripts/security22/run.py'); first = commit(authentic); git('update-ref', 'HEAD', first)
            first_tree = git('write-tree').decode().strip()
            git('update-index', '--force-remove', 'scripts/security22/run.py')
            deleted = commit(first); git('update-ref', 'HEAD', deleted)
            expect('intermediate-add-delete-cannot-hide', check.source22_history, 'R22_MODE_OR_DELETION')
            git('read-tree', first_tree); put('.github/workflows/security.yml'); tamper = commit(first)
            git('read-tree', first_tree); restored = commit(tamper); git('update-ref', 'HEAD', restored)
            expect('protected-tamper-restored-history-refused', check.source22_history, 'R22_FINITE_SCOPE')
            git('read-tree', authentic_tree); merged = commit(authentic, first); git('update-ref', 'HEAD', merged)
            expect('unauthorized-merge-refused', check.source22_history, 'R22_CI_CONTEXT')
            git('update-ref', 'HEAD', authentic); git('read-tree', authentic_tree)
            put('ONSKIN_BRAIN_HANDOFF.txt'); early = commit(authentic); git('update-ref', 'HEAD', early)
            expect('handoff-before-evidence-refused', check.source22_history, 'R22_HANDOFF_BEFORE_TAIL')
            git('update-ref', 'HEAD', authentic); git('read-tree', authentic_tree)
            expect('synthetic-restored-history', check.source22_history, expected=0)
            # These are synthetic checkpoint-envelope controls, not a clean full checkout.
            for path in check.RELEASE22_WORKLIST: put(path, b'synthetic generated-worklist fixture\n')
            source_head = commit(authentic); source_tree = git('write-tree').decode().strip()
            source = dict(base=check.RELEASE22_BASE, baseTree=check.RELEASE22_TREE,
                runtimeHead=authentic, runtimeTree=authentic_tree, sourceHead=source_head, sourceTree=source_tree)
            checkpoint = root/check.RELEASE22_CHECKPOINT; checkpoint.mkdir(parents=True)
            files = {}
            for name in ['README.md', 'FINAL_REPORT.md', 'payload.zip', 'verify22.py']:
                body = ('synthetic envelope '+name+'\n').encode(); (checkpoint/name).write_bytes(body)
                files[name] = dict(bytes=len(body), sha256=check.sha(body)); put(check.RELEASE22_CHECKPOINT+name, body)
            manifest = dict(schema=1, authority=check.RELEASE22_AUTHORITY, status='SUBMITTED_REVIEW_REQUIRED',
                acceptanceGranted=False, release='NO_GO', inputManifestSHA256='72b9642e0419d7117014a5476d431de2edc32e2014503099d785c43374b3d9f9',
                source=source, files=files, payload={})
            manifest_bytes = encode(manifest); (checkpoint/'manifest.json').write_bytes(manifest_bytes)
            put(check.RELEASE22_CHECKPOINT+'manifest.json', manifest_bytes)
            (root/'ONSKIN_BRAIN_HANDOFF.txt').write_bytes(b'synthetic factual handoff fixture\n')
            put('ONSKIN_BRAIN_HANDOFF.txt', b'synthetic factual handoff fixture\n')
            tail_head = commit(source_head); tail_tree = git('write-tree').decode().strip(); git('update-ref', 'HEAD', tail_head)
            expect('synthetic-envelope-exact', lambda: check.evidence22_guard(tail_head), expected=0)
            for field, value, code in [('schema', True, 'R22_EVIDENCE_NO_ADMISSION'),
                ('acceptanceGranted', 0, 'R22_EVIDENCE_NO_ADMISSION'), ('release', 'GO', 'R22_EVIDENCE_NO_ADMISSION')]:
                changed = copy.deepcopy(manifest); changed[field] = value; (checkpoint/'manifest.json').write_bytes(encode(changed))
                expect('evidence-schema:'+field, lambda: check.evidence22_guard(tail_head), code)
            changed = copy.deepcopy(manifest); changed['source']['sourceTree'] = '0'*40
            (checkpoint/'manifest.json').write_bytes(encode(changed))
            expect('evidence-wrong-tree', lambda: check.evidence22_guard(tail_head), 'R22_ONE_EVIDENCE_TAIL')
            changed = copy.deepcopy(manifest); changed['files']['README.md']['bytes'] = True
            (checkpoint/'manifest.json').write_bytes(encode(changed))
            expect('evidence-boolean-count', lambda: check.evidence22_guard(tail_head), 'R22_EVIDENCE_HASH')
            (checkpoint/'manifest.json').write_bytes(manifest_bytes.replace(b'"schema": 1', b'"schema": 1,"schema": 1'))
            expect('evidence-duplicate-json', lambda: check.evidence22_guard(tail_head), 'JSON_DUPLICATE_KEY')
            (checkpoint/'manifest.json').write_bytes(manifest_bytes)
            original_report = (checkpoint/'FINAL_REPORT.md').read_bytes(); (checkpoint/'FINAL_REPORT.md').write_bytes(original_report+b'corrupt')
            expect('artifact-corruption-refused', lambda: check.evidence22_guard(tail_head), 'R22_EVIDENCE_HASH')
            changed = copy.deepcopy(manifest); changed['files']['FINAL_REPORT.md'] = dict(bytes=len(original_report)+7,
                sha256=check.sha(original_report+b'corrupt')); (checkpoint/'manifest.json').write_bytes(encode(changed))
            expect('fabricated-clean-artifact-rehash-refused', lambda: check.evidence22_guard(tail_head), 'R22_EVIDENCE_COMMITTED_BYTES')
            (checkpoint/'FINAL_REPORT.md').write_bytes(original_report); (checkpoint/'manifest.json').write_bytes(manifest_bytes)
            expect('synthetic-envelope-restored', lambda: check.evidence22_guard(tail_head), expected=0)
            put('scripts/security22/README.md'); extra_tail = commit(tail_head); git('update-ref', 'HEAD', extra_tail)
            expect('second-evidence-tail-refused', check.source22_history, 'R22_AFTER_EVIDENCE_TAIL')
            git('read-tree', tail_tree); git('update-ref', 'HEAD', tail_head)
        finally:
            check.ROOT = old_root
            if actions_environment is not None: os.environ['GITHUB_ACTIONS'] = actions_environment
    print(json.dumps(dict(status='PASS', qualification='SYNTHETIC_GIT_SEGMENT_ONLY_NOT_REAL_CHECKOUT_OR_SCANNER',
        refusals=rejected, positiveControls=positives, acceptanceGranted=False, release='NO_GO')), flush=True)


if __name__ == '__main__':
    main()
