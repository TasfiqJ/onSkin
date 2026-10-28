"""Bounded synthetic filesystem controls, including authentic pre-repair code."""
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import types
from unittest.mock import patch

ROOT = Path(__file__).absolute().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/security22'))
from redact import Refusal

BASE = '34fac69f3ba527724ecdf2d1cef69f27372756ad'
LEGACY_SHA256 = '92bf5db492343bc8fa24ac224c83d149f06762dad2641c4496bed342a490d9be'


def legacy_child(root, scenario, source):
    raw = Path(source).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == LEGACY_SHA256
    module = types.ModuleType('authenticated_legacy_toolchain22')
    exec(compile(raw, 'authenticated_legacy_toolchain22', 'exec'), module.__dict__)
    root = Path(root)
    def regular(_, name, limit):
        if name == 'scripts/security22/toolchain.json':
            return json.dumps(dict(schema=1, nodeMajor=22, npmVersion='11.20.0', pythonMinimum=[3, 9],
                checks=['inventory', 'dependency', 'tooling', 'historical_workflow_contract'],
                qualification='TECHNICAL_ONLY_NO_ADMISSION')).encode()
        return b'synthetic-public-source\n'
    def execute(argv, *args, **kwargs):
        if argv == ['git', '--version']: return 0, b'git version 2.47.3\n', b''
        if argv == ['node', '--version']: return 0, b'v22.16.0\n', b''
        if argv[-2:] == ['prefix', '--global']: return 0, str(root).encode() + b'\n', b''
        if argv[-1] == '--version': return 0, b'11.20.0\n', b''
        raise AssertionError('UNEXPECTED_SYNTHETIC_COMMAND')
    with patch.object(module, 'regular', regular), patch.object(module, 'execute', execute), \
         patch.object(module.shutil, 'which', lambda name: str(root / 'bin' / name)):
        try:
            value = module.identity(root)
            return dict(scenario=scenario, state='ACCEPTED_IDENTITY', files=value['tools']['npm']['files'],
                treeSHA256=value['tools']['npm']['treeSHA256'])
        except Refusal:
            return dict(scenario=scenario, state='REFUSED')


def historical_reproduction():
    if os.name != 'posix':
        return dict(qualification='HISTORICAL_FUNCTION_SYNTHETIC_FILESYSTEM_ONLY', state='NOT_RUN',
            reason='POSIX_PERMISSION_SEMANTICS_UNAVAILABLE', acceptanceGranted=False)
    raw = subprocess.check_output(['git', 'show', BASE + ':scripts/security22/toolchain.py'], cwd=ROOT, timeout=30)
    assert hashlib.sha256(raw).hexdigest() == LEGACY_SHA256
    with tempfile.TemporaryDirectory(prefix='security23-before-') as temporary:
        root = Path(temporary); root.chmod(0o755)
        source = root / 'legacy.py'; source.write_bytes(raw); source.chmod(0o644)
        npm = root / 'bin/node_modules/npm'
        files = {'bin/node': b'synthetic-node', 'bin/git': b'synthetic-git',
            'bin/node_modules/npm/package.json': b'{"name":"npm","version":"11.20.0"}',
            'bin/node_modules/npm/bin/npm-cli.js': b'// synthetic',
            'bin/node_modules/npm/node_modules/semver/package.json': b'{"name":"semver","bin":{"semver":"cli.js"}}',
            'bin/node_modules/npm/node_modules/semver/cli.js': b'// harmless synthetic cli',
            'bin/node_modules/npm/private_dir/child.js': b'// synthetic, not sensitive'}
        for name, data in files.items():
            path = root / name; path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data); path.chmod(0o644)
        results = []
        def probe(scenario):
            options = dict(user=65534, group=65534) if os.geteuid() == 0 else {}
            child = subprocess.run([sys.executable, '-B', __file__, '--legacy-child', str(root), scenario, str(source)],
                capture_output=True, timeout=15, **options)
            assert child.returncode == 0
            results.append(json.loads(child.stdout))
        probe('readable')
        link = npm / 'node_modules/.bin/semver'; link.parent.mkdir(); link.symlink_to('../semver/cli.js')
        probe('declared-contained-link'); link.unlink(); link.parent.rmdir()
        denied = npm / 'private_dir'; denied.chmod(0)
        try: probe('unreadable-directory')
        finally: denied.chmod(0o755)
        probe('restored')
        assert [v.get('files') for v in results] == [5, None, 4, 5]
        assert results[0]['treeSHA256'] == results[3]['treeSHA256'] != results[2]['treeSHA256']
        return dict(qualification='HISTORICAL_FUNCTION_SYNTHETIC_FILESYSTEM_ONLY', state='DEFECT_REPRODUCED',
            realNonprivilegedPOSIX=True, executableRepliesAndRepositoryReads='SYNTHETIC',
            legacySourceSHA256=LEGACY_SHA256, results=results, acceptanceGranted=False)


# Fixed fixture wrappers derived from authenticated npm11.20/cmd-shim8 source.
WINDOWS_SEMVER_SHIMS = {'': '#!/bin/sh\nbasedir=$(dirname "$(echo "$0" | sed -e \'s,\\\\,/,g\')")\n\ncase `uname` in\n    *CYGWIN*|*MINGW*|*MSYS*)\n        if command -v cygpath > /dev/null 2>&1; then\n            basedir=`cygpath -w "$basedir"`\n        fi\n    ;;\nesac\n\nif [ -x "$basedir/node" ]; then\n  exec "$basedir/node"  "$basedir/../semver/bin/semver.js" "$@"\nelse \n  exec node  "$basedir/../semver/bin/semver.js" "$@"\nfi\n', '.cmd': '@ECHO off\r\nGOTO start\r\n:find_dp0\r\nSET dp0=%~dp0\r\nEXIT /b\r\n:start\r\nSETLOCAL\r\nCALL :find_dp0\r\n\r\nIF EXIST "%dp0%\\node.exe" (\r\n  SET "_prog=%dp0%\\node.exe"\r\n) ELSE (\r\n  SET "_prog=node"\r\n  SET PATHEXT=%PATHEXT:;.JS;=;%\r\n)\r\n\r\nendLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\..\\semver\\bin\\semver.js" %*\r\n', '.ps1': '#!/usr/bin/env pwsh\n$basedir=Split-Path $MyInvocation.MyCommand.Definition -Parent\n\n$exe=""\nif ($PSVersionTable.PSVersion -lt "6.0" -or $IsWindows) {\n  # Fix case when both the Windows and Linux builds of Node\n  # are installed in the same directory\n  $exe=".exe"\n}\n$ret=0\nif (Test-Path "$basedir/node$exe") {\n  # Support pipeline input\n  if ($MyInvocation.ExpectingInput) {\n    $input | & "$basedir/node$exe"  "$basedir/../semver/bin/semver.js" $args\n  } else {\n    & "$basedir/node$exe"  "$basedir/../semver/bin/semver.js" $args\n  }\n  $ret=$LASTEXITCODE\n} else {\n  # Support pipeline input\n  if ($MyInvocation.ExpectingInput) {\n    $input | & "node$exe"  "$basedir/../semver/bin/semver.js" $args\n  } else {\n    & "node$exe"  "$basedir/../semver/bin/semver.js" $args\n  }\n  $ret=$LASTEXITCODE\n}\nexit $ret\n'}


class ToolFixture:
    def __init__(self):
        from redact import canonical
        self.temporary = tempfile.TemporaryDirectory(prefix='security23-toolchain-')
        self.root = Path(self.temporary.name).absolute(); self.root.chmod(0o755)
        self.npm = self.root / 'npm'
        self.files = {'package.json': b'{"name":"npm","version":"11.20.0"}',
            'bin/npm-cli.js': b'#!/usr/bin/env node\n// synthetic npm\n',
            'bin/npx-cli.js': b'#!/usr/bin/env node\n// synthetic npx\n',
            'node_modules/semver/package.json': b'{"name":"semver","version":"7.8.5","bin":{"semver":"bin/semver.js"}}',
            'node_modules/semver/bin/semver.js': b'#!/usr/bin/env node\n// synthetic contained target\n',
            'private_dir/child.js': b'// synthetic omitted content\n'}
        def profile(files):
            return dict(files=len(files), bytes=sum(map(len, files.values())), treeSHA256=hashlib.sha256(
                canonical(sorted([n, hashlib.sha256(b).hexdigest()] for n, b in files.items()))).hexdigest())
        windows = dict(self.files)
        windows.update({'node_modules/.bin/semver' + suffix: raw.encode() for suffix, raw in WINDOWS_SEMVER_SHIMS.items()})
        # Expected contents come only from these initial constants, before mutations.
        self.model = dict(qualification='PINNED_NPM11_20_GLOBAL_INSTALL_ONLY',
            source=dict(url='https://registry.npmjs.org/npm/-/npm-11.20.0.tgz',
                sha256='d1a92f40e6c407b84c3a00c3cf978a10b24fd42f153c527e2016cef7bb34a483',
                integrity='sha512-dF3EDFwbYN+N5RUip+ZYDe0NeURK5BgqKOcvT1iNtUYhTMTl0FwWhBuXrS7KtXyduqyTMS5aaQaregnHDAxNgw=='),
            profiles=dict(posix=profile(self.files), nt=profile(windows)),
            bins=[dict(name='semver', target='node_modules/semver/bin/semver.js', link='../semver/bin/semver.js',
                targetSHA256=hashlib.sha256(self.files['node_modules/semver/bin/semver.js']).hexdigest(),
                package='node_modules/semver/package.json', binValue='bin/semver.js')])
        for name, raw in self.files.items(): self.write(name, raw)
        self.bin = self.npm / 'node_modules/.bin/semver'; self.bin.parent.mkdir()
        self.target = self.npm / 'node_modules/semver/bin/semver.js'
        if os.name == 'posix': self.bin.symlink_to('../semver/bin/semver.js')
        else:
            for suffix, raw in WINDOWS_SEMVER_SHIMS.items(): self.write('node_modules/.bin/semver' + suffix, raw.encode())
        self.model_path = self.root / 'model.json'
        self.model_path.write_text(json.dumps(self.model), encoding='utf8'); self.model_path.chmod(0o644)

    def write(self, name, raw):
        path = self.npm / name; path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw); path.chmod(0o644); return path

    def close(self):
        assert self.root.parent == Path(tempfile.gettempdir()).resolve()
        assert self.root.name.startswith('security23-toolchain-') and self.root == Path(self.temporary.name).absolute()
        self.temporary.cleanup()


def inventory_child(root, model_path):
    import toolchain
    from redact import diagnostic
    try:
        raw = Path(model_path).read_bytes()
        if len(raw) > 65536: raise Refusal('NPM_MODEL_IDENTITY')
        return dict(state='ACCEPTED', identity=toolchain.npm_inventory(Path(root), json.loads(raw)))
    except Refusal as error:
        return dict(state='REFUSED', predicate=diagnostic(error))
    except BaseException:
        return dict(state='INCOMPLETE', predicate='EXECUTION_INCOMPLETE')


def regression_tests():
    import copy
    import csv
    import unittest
    from contextlib import contextmanager
    import toolchain

    class ToolchainTests(unittest.TestCase):
        def setUp(self):
            self.f = ToolFixture(); self.addCleanup(self.f.close)
        def value(self, model=None):
            return toolchain.npm_inventory(self.f.npm, self.f.model if model is None else model)
        def refused(self, predicate=None, model=None):
            with self.assertRaises(Refusal) as caught: self.value(model)
            if predicate: self.assertEqual(str(caught.exception), predicate)
        def posix(self):
            if os.name != 'posix': self.skipTest('POSIX_FILESYSTEM_CONTROL_NOT_RUN_ON_WINDOWS')

        def test_complete_declared_installation(self):
            value = self.value(); profile = self.f.model['profiles'][os.name]
            self.assertEqual((value['files'], value['bytes'], value['treeSHA256']),
                (profile['files'], profile['bytes'], profile['treeSHA256']))
            self.assertEqual(value['links'], 1 if os.name == 'posix' else 0)
            self.assertEqual(set(value), {'version', 'cliSHA256', 'treeSHA256', 'files', 'bytes', 'links', 'installationModelSHA256'})

        def test_missing_files_and_restoration(self):
            before = self.value()
            for name in ('private_dir/child.js', 'bin/npm-cli.js', 'node_modules/semver/package.json'):
                (self.f.npm / name).unlink()
                try: self.refused()
                finally: self.f.write(name, self.f.files[name])
                self.assertEqual(self.value(), before)

        def test_missing_directory_and_restoration(self):
            before = self.value(); directory = self.f.npm / 'private_dir'; held = self.f.root / 'held'
            directory.rename(held)
            try: self.refused()
            finally: held.rename(directory)
            self.assertEqual(self.value(), before)

        def test_fixture_model_cannot_enter_production_identity(self):
            from redact import canonical
            config = dict(schema=1, nodeMajor=22, npmVersion='11.20.0', pythonMinimum=[3, 9],
                checks=['inventory', 'dependency', 'tooling', 'historical_workflow_contract'],
                qualification='TECHNICAL_ONLY_NO_ADMISSION', npmInstallation=self.f.model)
            with patch.object(toolchain, 'regular', return_value=canonical(config)):
                with self.assertRaises(Refusal) as caught: toolchain.identity(self.f.root)
            self.assertEqual(str(caught.exception), 'NPM_MODEL_IDENTITY')

        def test_actual_windows_junction_reparse(self):
            if os.name != 'nt': self.skipTest('WINDOWS_REPARSE_CONTROL_NOT_RUN_ON_POSIX')
            target = self.f.root / 'junction-target'; target.mkdir()
            link = self.f.npm / 'unexpected-junction'
            self.assertEqual(target.parent, self.f.root)
            self.assertEqual(link.parent, self.f.npm)
            child = subprocess.run(['cmd.exe', '/d', '/c', 'mklink', '/J', str(link), str(target)],
                capture_output=True, timeout=15)
            if child.returncode: self.skipTest('WINDOWS_JUNCTION_CREATION_UNAVAILABLE')
            try:
                self.assertTrue(link.lstat().st_file_attributes & 1024)
                self.refused('NPM_TOOL_LINK')
            finally:
                os.rmdir(link)
            self.value()

        def test_posix_root_link_containment(self):
            self.posix()
            link = self.f.root / 'npm-alias'; link.symlink_to('npm', target_is_directory=True)
            with self.assertRaises(Refusal) as caught: toolchain.npm_inventory(link, self.f.model)
            self.assertEqual(str(caught.exception), 'NPM_IDENTITY')

        def test_profile_boolean_counts(self):
            for field in ('files', 'bytes'):
                model = copy.deepcopy(self.f.model); model['profiles'][os.name][field] = True
                self.refused('NPM_MODEL_IDENTITY', model)

        def test_profile_invalid_counts(self):
            for field in ('files', 'bytes'):
                for bad in (0, -1, '6', 1.5):
                    model = copy.deepcopy(self.f.model); model['profiles'][os.name][field] = bad
                    self.refused('NPM_MODEL_IDENTITY', model)

        def test_declared_model_tampering(self):
            for field, value in (('link', '../../escape.js'), ('targetSHA256', '0' * 64),
                    ('binValue', '../escape.js'), ('target', '../escape.js')):
                model = copy.deepcopy(self.f.model); model['bins'][0][field] = value
                self.refused(model=model)

        def test_empty_and_duplicate_bin_model(self):
            for bins in ([], self.f.model['bins'] * 2):
                model = copy.deepcopy(self.f.model); model['bins'] = bins
                self.refused('NPM_BIN_METADATA', model)

        def test_hash_mismatch(self):
            model = copy.deepcopy(self.f.model); model['profiles'][os.name]['treeSHA256'] = '0' * 64
            self.refused('NPM_EXPECTED_CONTENT', model)

        def test_read_error(self):
            with patch.object(toolchain.os, 'open', side_effect=PermissionError('SYNTHETIC_DO_NOT_DISCLOSE')):
                self.refused('NPM_TOOL_READ')

        def test_cross_domain_birthtime_preserves_other_identity_fields(self):
            values = dict(st_dev=1, st_ino=2, st_mode=0o100644, st_nlink=1,
                st_size=9, st_mtime_ns=11, st_ctime_ns=13, st_birthtime_ns=7)
            path = types.SimpleNamespace(**values)
            handle = types.SimpleNamespace(**dict(values, st_ctime_ns=17, st_mode=0o100755))
            with patch.object(toolchain.os, 'name', 'nt'):
                self.assertNotEqual(toolchain._stamp(path), toolchain._stamp(handle))
                self.assertEqual(toolchain._stamp(path, comparable=True), toolchain._stamp(handle, comparable=True))
                for key in ('st_dev', 'st_ino', 'st_nlink', 'st_size', 'st_mtime_ns', 'st_birthtime_ns', 'st_mode'):
                    changed = dict(values)
                    changed[key] = 0o40644 if key == 'st_mode' else values[key]+1
                    self.assertNotEqual(toolchain._stamp(path, comparable=True),
                        toolchain._stamp(types.SimpleNamespace(**changed), comparable=True))

        def test_same_handle_change_time_mutation_refused(self):
            original = os.fstat; calls = []
            def changed(descriptor):
                info = original(descriptor); calls.append(True)
                if len(calls) == 2:
                    values = {key:getattr(info, key) for key in ('st_dev', 'st_ino', 'st_mode',
                        'st_nlink', 'st_size', 'st_mtime_ns', 'st_ctime_ns')}
                    if hasattr(info, 'st_birthtime_ns'): values['st_birthtime_ns'] = info.st_birthtime_ns
                    values['st_ctime_ns'] += 1
                    return types.SimpleNamespace(**values)
                return info
            with patch.object(toolchain.os, 'fstat', changed): self.refused('NPM_TOOL_CHANGED')
            self.assertEqual(len(calls), 2)

        def test_prior_metadata_change_keeps_exact_content_identity(self):
            import time
            before = self.value(); info = self.f.target.stat(); time.sleep(.02)
            self.f.target.write_bytes(self.f.files['node_modules/semver/bin/semver.js'])
            os.utime(self.f.target, ns=(info.st_atime_ns, info.st_mtime_ns))
            with self.f.target.open('rb') as stream:
                current = os.fstat(stream.fileno())
            if os.name == 'nt' and hasattr(current, 'st_birthtime_ns'):
                self.assertGreater(current.st_ctime_ns, current.st_birthtime_ns)
            self.assertEqual(self.value(), before)

        def test_stat_error(self):
            original = Path.lstat
            def denied(path, *args, **kwargs):
                if path == self.f.target: raise PermissionError('SYNTHETIC_DO_NOT_DISCLOSE')
                return original(path, *args, **kwargs)
            with patch.object(Path, 'lstat', denied): self.refused('NPM_TOOL_READ')

        def test_fstat_error(self):
            with patch.object(toolchain.os, 'fstat', side_effect=OSError('SYNTHETIC_DO_NOT_DISCLOSE')):
                self.refused('NPM_TOOL_READ')

        def test_enumeration_error(self):
            original = os.scandir
            def scan(path):
                if Path(path) == self.f.npm / 'private_dir': raise PermissionError('SYNTHETIC_DO_NOT_DISCLOSE')
                return original(path)
            with patch.object(toolchain.os, 'scandir', scan): self.refused('NPM_TOOL_ENUMERATION')

        def test_silent_enumerator_omission(self):
            original = os.scandir
            @contextmanager
            def scan(path):
                with original(path) as stream:
                    yield (e for e in stream if Path(path) != self.f.npm or e.name != 'private_dir')
            with patch.object(toolchain.os, 'scandir', scan): self.refused('NPM_EXPECTED_CONTENT')

        def test_open_time_mutation(self):
            original = os.open; changed = []
            def mutate(path, *args, **kwargs):
                fd = original(path, *args, **kwargs)
                if Path(path) == self.f.target and not changed:
                    changed.append(True); self.f.target.write_bytes(b'// synthetic mutation during read')
                return fd
            with patch.object(toolchain.os, 'open', mutate): self.refused('NPM_TOOL_CHANGED')
            self.assertEqual(changed, [True])

        def test_directory_time_mutation(self):
            original = os.scandir; changed = []
            @contextmanager
            def scan(path):
                with original(path) as stream: yield stream
                if Path(path) == self.f.npm and not changed:
                    changed.append(True); self.f.write('late.js', b'// synthetic late file')
            with patch.object(toolchain.os, 'scandir', scan): self.refused('NPM_TOOL_CHANGED')

        def test_actual_nonprivileged_posix_denial(self):
            self.posix(); denied = self.f.npm / 'private_dir'
            def probe():
                options = dict(user=65534, group=65534) if os.geteuid() == 0 else {}
                child = subprocess.run([sys.executable, '-B', str(Path(__file__).absolute()), '--inventory-child',
                    str(self.f.npm), str(self.f.model_path)], capture_output=True, timeout=20, **options)
                self.assertEqual(child.returncode, 0); return json.loads(child.stdout)
            before = probe(); self.assertEqual(before['state'], 'ACCEPTED'); denied.chmod(0)
            try:
                value = probe(); self.assertEqual((value['state'], value.get('predicate')), ('REFUSED', 'NPM_TOOL_ENUMERATION'))
            finally: denied.chmod(0o755)
            self.assertEqual(probe(), before)

        def test_actual_windows_acl_denial(self):
            if os.name != 'nt': self.skipTest('WINDOWS_ACL_CONTROL_NOT_RUN_ON_POSIX')
            denied = self.f.npm / 'private_dir'; before = self.value()
            who = subprocess.run(['whoami', '/user', '/fo', 'csv', '/nh'], capture_output=True, timeout=15)
            if who.returncode: self.skipTest('WINDOWS_ACL_PRINCIPAL_UNAVAILABLE')
            sid = list(csv.reader(io.StringIO(who.stdout.decode('utf8', errors='replace'))))[0][-1]
            if not __import__('re').fullmatch(r'S-1-[0-9-]+', sid): self.skipTest('WINDOWS_ACL_PRINCIPAL_UNAVAILABLE')
            # Deny directory enumeration, retaining READ_CONTROL so the exact
            # test ACE can be removed even under CPython3.12's private temp DACL.
            applied = subprocess.run(['icacls', str(denied), '/deny', '*' + sid + ':(RD)'], capture_output=True, timeout=15)
            if applied.returncode: self.skipTest('WINDOWS_ACL_DENY_UNAVAILABLE')
            try:
                with self.assertRaises(PermissionError):
                    with os.scandir(denied) as stream: list(stream)
                self.refused('NPM_TOOL_ENUMERATION')
            finally:
                restore = subprocess.run(['icacls', str(denied), '/remove:d', '*' + sid], capture_output=True, timeout=15)
                self.assertEqual(restore.returncode, 0)
            self.assertEqual(self.value(), before)

    def mutation(self, kind):
        f = self.f; predicate = None
        if kind == 'extra_content': f.write('extra.js', b'// synthetic extra'); predicate = 'NPM_EXPECTED_CONTENT'
        elif kind == 'extra_empty_directory': (f.npm / 'extra-empty').mkdir(); predicate = 'NPM_EXPECTED_CONTENT'
        elif kind == 'changed_metadata': f.write('node_modules/semver/package.json', b'{"name":"semver","bin":{"semver":"other.js"}}')
        elif kind == 'changed_target': f.target.write_bytes(b'// synthetic changed target')
        elif kind == 'missing_bin': f.bin.unlink(); predicate = 'NPM_EXPECTED_CONTENT'
        elif kind == 'undeclared_bin': f.write('node_modules/.bin/other', b'// synthetic undeclared'); predicate = 'NPM_EXPECTED_CONTENT'
        elif kind == 'changed_windows_shim':
            if os.name != 'nt': self.skipTest('WINDOWS_SHIM_CONTROL_NOT_RUN_ON_POSIX')
            f.write('node_modules/.bin/semver.cmd', b'@echo synthetic changed'); predicate = 'NPM_EXPECTED_CONTENT'
        elif kind == 'hardlink': os.link(f.target, f.npm / 'hardlink.js'); predicate = 'NPM_TOOL_FILE'
        elif kind == 'unicode_parent_alias':
            f.write('unicode-\u00e9/a.js', b'// one'); f.write('unicode-e\u0301/b.js', b'// two'); predicate = 'PATH_ALIAS_OR_COLLISION'
        elif kind == 'case_parent_alias':
            self.posix(); f.write('private_DIR/other.js', b'// case alias'); predicate = 'PATH_ALIAS_OR_COLLISION'
        elif kind == 'fifo': self.posix(); os.mkfifo(f.npm / 'fifo'); predicate = 'NPM_TOOL_FILE'
        elif kind == 'setid': self.posix(); f.target.chmod(0o4644); predicate = 'NPM_TOOL_FILE'
        elif kind in ('dangling_link', 'escaping_link', 'chained_link', 'cyclic_link'):
            self.posix(); f.bin.unlink()
            targets = dict(dangling_link='../semver/bin/missing.js', escaping_link=str(f.root / 'outside.js'),
                chained_link='../semver/bin/chain.js', cyclic_link='semver')
            if kind == 'escaping_link': (f.root / 'outside.js').write_bytes(b'// synthetic outside')
            if kind == 'chained_link': (f.target.parent / 'chain.js').symlink_to('semver.js')
            f.bin.symlink_to(targets[kind])
        elif kind == 'undeclared_link': self.posix(); (f.npm / 'unlisted-link').symlink_to('bin/npm-cli.js'); predicate = 'NPM_TOOL_LINK'
        elif kind == 'directory_link': self.posix(); (f.npm / 'directory-link').symlink_to('private_dir', target_is_directory=True); predicate = 'NPM_TOOL_LINK'
        elif kind == 'target_link': self.posix(); f.target.unlink(); f.target.symlink_to('../../../bin/npm-cli.js'); predicate = 'NPM_TOOL_LINK'
        self.refused(predicate)

    for kind in ('extra_content', 'extra_empty_directory', 'changed_metadata', 'changed_target', 'missing_bin',
            'undeclared_bin', 'changed_windows_shim', 'hardlink', 'unicode_parent_alias', 'case_parent_alias',
            'fifo', 'setid', 'dangling_link', 'escaping_link', 'chained_link', 'cyclic_link', 'undeclared_link',
            'directory_link', 'target_link'):
        def case(self, kind=kind): mutation(self, kind)
        setattr(ToolchainTests, 'test_' + kind, case)

    for name, constant in (('file_count', 'NPM_MAX_FILES'), ('total_bytes', 'NPM_MAX_BYTES'),
            ('file_bytes', 'NPM_MAX_FILE'), ('depth', 'NPM_MAX_DEPTH')):
        def bound(self, name=name, constant=constant):
            profile = self.f.model['profiles'][os.name]
            if name == 'depth': (self.f.npm / 'deep/a/b/c/d/e').mkdir(parents=True); limit = 4
            elif name == 'file_bytes': limit = 8
            else: self.f.write('extra.js', b'x'); limit = profile['files' if name == 'file_count' else 'bytes']
            with patch.object(toolchain, constant, limit): self.refused('NPM_TOOL_FILE' if name == 'file_bytes' else 'NPM_TOOL_BOUND')
        setattr(ToolchainTests, 'test_bound_' + name, bound)

    class SafeResult(unittest.TestResult):
        def __init__(self): super().__init__(); self.cases = []
        def addSuccess(self, test): self.cases.append(dict(name=test._testMethodName, state='PASS'))
        def addFailure(self, test, error):
            self.failures.append((test, 'ASSERTION_FAILED')); self.cases.append(dict(name=test._testMethodName, state='FAIL'))
        def addError(self, test, error):
            self.errors.append((test, 'EXECUTION_INCOMPLETE')); self.cases.append(dict(name=test._testMethodName, state='INCOMPLETE'))
        def addSkip(self, test, reason):
            self.skipped.append((test, reason)); self.cases.append(dict(name=test._testMethodName, state='NOT_RUN', reason=reason))
    result = SafeResult(); unittest.defaultTestLoader.loadTestsFromTestCase(ToolchainTests).run(result)
    expected = {'POSIX_FILESYSTEM_CONTROL_NOT_RUN_ON_WINDOWS', 'WINDOWS_SHIM_CONTROL_NOT_RUN_ON_POSIX', 'WINDOWS_ACL_CONTROL_NOT_RUN_ON_POSIX', 'WINDOWS_REPARSE_CONTROL_NOT_RUN_ON_POSIX'}
    state = 'PASS' if not result.failures and not result.errors and not any(r not in expected for _, r in result.skipped) else 'INCOMPLETE'
    return dict(schema=1, qualification='SYNTHETIC_PINNED_MODEL_FILESYSTEM_CONTROLS_ONLY', state=state,
        tests=result.testsRun, passed=sum(c['state'] == 'PASS' for c in result.cases), failed=len(result.failures),
        errors=len(result.errors), notRun=len(result.skipped), platform=os.name, cases=result.cases, acceptanceGranted=False)


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--inventory-child':
        print(json.dumps(inventory_child(*sys.argv[2:]), sort_keys=True)); sys.exit(0)
    if len(sys.argv) > 1 and sys.argv[1] == '--regressions':
        try:
            value = regression_tests()
        except BaseException:
            value = dict(schema=1, state='INCOMPLETE', reason='SYNTHETIC_REGRESSION_FAILED', acceptanceGranted=False)
        print(json.dumps(value, sort_keys=True)); sys.exit(0 if value['state'] == 'PASS' else 1)
    if len(sys.argv) > 1 and sys.argv[1] == '--legacy-child':
        print(json.dumps(legacy_child(*sys.argv[2:]))); sys.exit(0)
    try:
        print(json.dumps(historical_reproduction(), sort_keys=True))
    except BaseException:
        print(json.dumps(dict(state='INCOMPLETE', reason='SYNTHETIC_REPRODUCTION_FAILED', acceptanceGranted=False)))
        sys.exit(1)
