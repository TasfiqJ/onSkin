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
        self.parent = Path(tempfile.gettempdir()).resolve()
        self.temporary = tempfile.TemporaryDirectory(prefix='security23-toolchain-', dir=self.parent)
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
        assert self.root.parent == self.parent and self.parent.resolve() == self.parent
        assert self.root.resolve() == self.root
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


class WindowsFixtureReader:
    """Restrict this same user's reader thread; never enable a privilege."""
    def __init__(self):
        import ctypes
        from ctypes import wintypes
        self.c, self.w = ctypes, wintypes
        self.handles, self.active, self.failure, self.proofs = [], False, None, []
        self.thread_restored = True
        self.api = ctypes.WinDLL('advapi32', use_last_error=True)
        self.kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        HANDLE, DWORD, BOOL, PVOID = wintypes.HANDLE, wintypes.DWORD, wintypes.BOOL, ctypes.c_void_p
        class LUID(ctypes.Structure):
            _fields_ = [('LowPart', DWORD), ('HighPart', wintypes.LONG)]
        class PRIVILEGE(ctypes.Structure):
            _fields_ = [('Luid', LUID), ('Attributes', DWORD)]
        class SID_ATTRIBUTE(ctypes.Structure):
            _fields_ = [('Sid', PVOID), ('Attributes', DWORD)]
        self.LUID, self.PRIVILEGE, self.SID_ATTRIBUTE = LUID, PRIVILEGE, SID_ATTRIBUTE
        declarations = {
            'OpenProcessToken': ([HANDLE, DWORD, ctypes.POINTER(HANDLE)], BOOL),
            'OpenThreadToken': ([HANDLE, DWORD, BOOL, ctypes.POINTER(HANDLE)], BOOL),
            'GetTokenInformation': ([HANDLE, DWORD, PVOID, DWORD, ctypes.POINTER(DWORD)], BOOL),
            'CreateRestrictedToken': ([HANDLE, DWORD, DWORD, PVOID, DWORD, PVOID,
                DWORD, PVOID, ctypes.POINTER(HANDLE)], BOOL),
            'EqualSid': ([PVOID, PVOID], BOOL),
            'ConvertSidToStringSidW': ([PVOID, ctypes.POINTER(wintypes.LPWSTR)], BOOL),
            'LookupPrivilegeValueW': ([wintypes.LPCWSTR, wintypes.LPCWSTR, ctypes.POINTER(LUID)], BOOL),
            'ImpersonateLoggedOnUser': ([HANDLE], BOOL),
            'SetThreadToken': ([ctypes.POINTER(HANDLE), HANDLE], BOOL),
            'RevertToSelf': ([], BOOL),
        }
        for name, (arguments, result) in declarations.items():
            function = getattr(self.api, name); function.argtypes = arguments; function.restype = result
        self.kernel.GetCurrentProcess.restype = HANDLE; self.kernel.GetCurrentThread.restype = HANDLE
        self.kernel.CloseHandle.argtypes = [HANDLE]; self.kernel.CloseHandle.restype = BOOL
        self.kernel.LocalFree.argtypes = [PVOID]; self.kernel.LocalFree.restype = PVOID
        try:
            process = HANDLE()
            self.check(self.api.OpenProcessToken(self.kernel.GetCurrentProcess(), 0xA,
                ctypes.byref(process)), 'ACL_READER_CAPABILITY_UNAVAILABLE')
            self.handles.append(process)
            self.original_thread = self.current_thread()
            if self.original_thread is not None: self.handles.append(self.original_thread)
            self.base = self.original_thread if self.original_thread is not None else process
            self.original_id = self.query(self.base, 10).raw[:8]
            self.original_privileges = self.privileges(self.base)
            self.user = self.query(self.base, 1)
            process_user = self.query(process, 1)
            self.check(self.api.EqualSid(self.sid_pointer(self.user), self.sid_pointer(process_user)),
                'ACL_READER_IDENTITY_CHANGED')
            sid = self.sid_pointer(self.user); text = wintypes.LPWSTR()
            self.check(self.api.ConvertSidToStringSidW(sid, ctypes.byref(text)), 'ACL_READER_CAPABILITY_UNAVAILABLE')
            try: self.sid = text.value
            finally: self.kernel.LocalFree(ctypes.cast(text, PVOID))
            self.notify = self.privilege_id('SeChangeNotifyPrivilege')
            self.backup = self.privilege_id('SeBackupPrivilege')
            self.restore = self.privilege_id('SeRestorePrivilege')
        except BaseException:
            for handle in reversed(self.handles): self.kernel.CloseHandle(handle)
            self.handles.clear()
            raise

    def check(self, condition, predicate):
        if not condition:
            self.failure = predicate
            raise AssertionError(predicate)

    def query(self, token, kind):
        size = self.w.DWORD()
        self.api.GetTokenInformation(token, kind, None, 0, self.c.byref(size))
        self.check(0 < size.value <= 65536, 'ACL_READER_CAPABILITY_UNAVAILABLE')
        buffer = self.c.create_string_buffer(size.value)
        self.check(self.api.GetTokenInformation(token, kind, buffer, size,
            self.c.byref(size)), 'ACL_READER_CAPABILITY_UNAVAILABLE')
        return buffer

    def sid_pointer(self, buffer):
        return self.c.cast(buffer, self.c.POINTER(self.SID_ATTRIBUTE)).contents.Sid

    def privilege_id(self, name):
        value = self.LUID()
        self.check(self.api.LookupPrivilegeValueW(None, name, self.c.byref(value)), 'ACL_READER_CAPABILITY_UNAVAILABLE')
        return (value.LowPart, value.HighPart)

    def privileges(self, token):
        buffer = self.query(token, 3)
        count = self.c.cast(buffer, self.c.POINTER(self.w.DWORD)).contents.value
        self.check(count <= 1024 and 4+count*self.c.sizeof(self.PRIVILEGE) <= len(buffer),
            'ACL_READER_CAPABILITY_UNAVAILABLE')
        values = self.c.cast(self.c.addressof(buffer)+4, self.c.POINTER(self.PRIVILEGE))
        return tuple(((values[i].Luid.LowPart, values[i].Luid.HighPart), values[i].Attributes) for i in range(count))

    def enabled(self, token):
        return {luid for luid, attributes in self.privileges(token) if attributes & 2}

    def current_thread(self):
        token = self.w.HANDLE()
        if self.api.OpenThreadToken(self.kernel.GetCurrentThread(), 0xE, True, self.c.byref(token)):
            return token
        self.check(self.c.get_last_error() == 1008, 'ACL_READER_CAPABILITY_UNAVAILABLE')
        return None

    def assert_original(self):
        token = self.current_thread()
        try:
            self.check((token is None) == (self.original_thread is None) and
                (token is None or self.query(token, 10).raw[:8] == self.original_id), 'ACL_READER_RESTORE_FAILED')
            self.check(self.privileges(self.base) == self.original_privileges, 'ACL_READER_RESTORE_FAILED')
        finally:
            if token is not None: self.kernel.CloseHandle(token)

    def read(self):
        from contextlib import contextmanager
        @contextmanager
        def context():
            self.assert_original()
            restricted = self.w.HANDLE(); effective = None; applied = False
            proof = dict(sameAccount=False, threadTokenRestored=True, restrictedOptionalPrivilegesDisabled=False,
                backupEnabledBefore=self.backup in self.enabled(self.base),
                restoreEnabledBefore=self.restore in self.enabled(self.base),
                backupEnabledDuring=False, restoreEnabledDuring=False, hadThreadTokenBefore=self.original_thread is not None)
            try:
                # Flag1 only: no SID changes, LUA/inert flags, privilege acquisition or account changes.
                self.check(self.api.CreateRestrictedToken(self.base, 1, 0, None, 0, None,
                    0, None, self.c.byref(restricted)), 'ACL_READER_CAPABILITY_UNAVAILABLE')
                user = self.query(restricted, 1)
                self.check(self.api.EqualSid(self.sid_pointer(self.user), self.sid_pointer(user)), 'ACL_READER_IDENTITY_CHANGED')
                self.check(self.enabled(restricted) <= {self.notify}, 'ACL_READER_PRIVILEGES_NOT_REDUCED')
                self.check(self.api.ImpersonateLoggedOnUser(restricted), 'ACL_READER_CAPABILITY_UNAVAILABLE')
                applied = self.active = True; self.thread_restored = proof['threadTokenRestored'] = False
                effective = self.current_thread(); self.check(effective is not None, 'ACL_READER_CAPABILITY_UNAVAILABLE')
                actual_user = self.query(effective, 1); enabled = self.enabled(effective)
                self.check(self.api.EqualSid(self.sid_pointer(self.user), self.sid_pointer(actual_user)), 'ACL_READER_IDENTITY_CHANGED')
                self.check(enabled <= {self.notify}, 'ACL_READER_PRIVILEGES_NOT_REDUCED')
                proof.update(sameAccount=True, restrictedOptionalPrivilegesDisabled=True,
                    backupEnabledDuring=self.backup in enabled, restoreEnabledDuring=self.restore in enabled)
                yield proof
            finally:
                if effective is not None: self.kernel.CloseHandle(effective)
                try:
                    if applied:
                        restored = self.api.SetThreadToken(None, self.original_thread) if self.original_thread is not None else self.api.RevertToSelf()
                        self.check(restored, 'ACL_READER_RESTORE_FAILED')
                        self.active = False; self.assert_original()
                        self.thread_restored = proof['threadTokenRestored'] = True
                finally:
                    if restricted.value: self.kernel.CloseHandle(restricted)
                    self.proofs.append(proof)
        return context()

    def close(self):
        self.check(not self.active and self.thread_restored, 'ACL_READER_RESTORE_FAILED')
        self.assert_original()
        for handle in reversed(self.handles): self.kernel.CloseHandle(handle)
        self.handles.clear(); self.sid = None


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

        def test_fixture_uses_canonical_temporary_parent(self):
            with tempfile.TemporaryDirectory(prefix='security23-parent-', dir=Path(tempfile.gettempdir()).resolve()) as parent:
                root = Path(parent).absolute(); (root/'nested').mkdir()
                with patch.object(tempfile, 'gettempdir', return_value=str(root/'nested'/'..')):
                    fixture = ToolFixture()
                    try:
                        self.assertEqual(fixture.root.parent, root)
                        self.assertEqual(fixture.root.resolve(), fixture.root)
                        toolchain.npm_inventory(fixture.npm, fixture.model)
                    finally: fixture.close()

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
            denied = self.f.npm / 'private_dir'; reader = None
            self._acl_phase = 'ACL_READER_CAPABILITY_UNAVAILABLE'
            try:
                reader = WindowsFixtureReader()
                with reader.read() as before_proof: before = self.value()
                self.assertTrue(before_proof['sameAccount'] and before_proof['threadTokenRestored'])
                reader.assert_original()
                # Apply/remove only this fixture's RD ACE under the original token.
                self._acl_phase = 'ACL_DENY_COMMAND_FAILED'
                applied = subprocess.run(['icacls', str(denied), '/deny', '*' + reader.sid + ':(RD)'],
                    capture_output=True, timeout=15)
                self.assertEqual(applied.returncode, 0)
                try:
                    self._acl_phase = 'ACL_READER_CAPABILITY_UNAVAILABLE'
                    with reader.read():
                        self._acl_phase = 'ACL_ENUMERATION_NOT_DENIED'
                        with self.assertRaises(PermissionError):
                            with os.scandir(denied) as stream: list(stream)
                        try:
                            denied.lstat(); self._acl_stat_denied = False
                        except PermissionError: self._acl_stat_denied = True
                        self._acl_phase = 'ACL_INVENTORY_PREDICATE_MISMATCH'
                        try: self.value()
                        except Refusal as error:
                            allowed = {'NPM_TOOL_ENUMERATION', 'NPM_TOOL_READ', 'NPM_TOOL_CHANGED', 'NPM_IDENTITY', 'NPM_EXPECTED_CONTENT', 'NPM_TOOL_LINK'}
                            self._acl_observed = error.args[0] if len(error.args) == 1 and type(error.args[0]) is str and error.args[0] in allowed else 'REFUSED'
                            self.assertEqual(self._acl_observed, 'NPM_TOOL_ENUMERATION')
                        else: self.fail('ACL_CONTROL_ACCEPTED_INCOMPLETE_CONTENT')
                except BaseException:
                    self._acl_failure = reader.failure or self._acl_phase
                    raise
                finally:
                    reader.assert_original()
                    restore = subprocess.run(['icacls', str(denied), '/remove:d', '*' + reader.sid],
                        capture_output=True, timeout=15)
                    try: self.assertEqual(restore.returncode, 0)
                    except BaseException:
                        self._acl_failure = 'ACL_RESTORE_COMMAND_FAILED'
                        raise
                self._acl_phase = 'ACL_RESTORED_IDENTITY_MISMATCH'
                with reader.read() as after_proof: self.assertEqual(self.value(), before)
                self.assertTrue(after_proof['sameAccount'] and after_proof['threadTokenRestored'])
            except BaseException:
                self._acl_failure = getattr(self, '_acl_failure', None) or (reader.failure if reader is not None else None) or self._acl_phase
                raise
            finally:
                if reader is not None:
                    try: reader.close()
                    except BaseException:
                        self._acl_failure = reader.failure or 'ACL_READER_RESTORE_FAILED'
                        raise
                    finally:
                        if reader.proofs:
                            proof = dict(reader.proofs[0])
                            for key in ('sameAccount', 'threadTokenRestored', 'restrictedOptionalPrivilegesDisabled'):
                                proof[key] = all(p[key] for p in reader.proofs)
                            for key in ('backupEnabledDuring', 'restoreEnabledDuring'):
                                proof[key] = any(p[key] for p in reader.proofs)
                            self._reader_proof = proof

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
        def note(self, case):
            rank = {'PASS': 0, 'NOT_RUN': 1, 'FAIL': 2, 'INCOMPLETE': 3}
            for index, prior in enumerate(self.cases):
                if prior['name'] == case['name']:
                    if rank[case['state']] > rank[prior['state']]: self.cases[index] = case
                    return
            self.cases.append(case)
        def addSuccess(self, test):
            case = dict(name=test._testMethodName, state='PASS')
            if test._testMethodName == 'test_actual_windows_acl_denial' and hasattr(test, '_reader_proof'):
                case['readerProof'] = test._reader_proof
            self.note(case)
        def failure(self, test, state):
            case = dict(name=test._testMethodName, state=state)
            predicate = getattr(test, '_acl_failure', None)
            if test._testMethodName == 'test_actual_windows_acl_denial' and predicate in {
                'ACL_ENUMERATION_NOT_DENIED', 'ACL_INVENTORY_PREDICATE_MISMATCH',
                'ACL_RESTORE_COMMAND_FAILED', 'ACL_RESTORED_IDENTITY_MISMATCH',
                'ACL_DENY_COMMAND_FAILED', 'ACL_READER_CAPABILITY_UNAVAILABLE',
                'ACL_READER_IDENTITY_CHANGED', 'ACL_READER_PRIVILEGES_NOT_REDUCED', 'ACL_READER_RESTORE_FAILED'}:
                case['predicate'] = predicate
                if hasattr(test, '_acl_observed'): case['observedPredicate'] = test._acl_observed
                if hasattr(test, '_acl_stat_denied'): case['directStatDenied'] = test._acl_stat_denied
            if test._testMethodName == 'test_actual_windows_acl_denial' and hasattr(test, '_reader_proof'):
                case['readerProof'] = test._reader_proof
            return case
        def addFailure(self, test, error):
            self.failures.append((test, 'ASSERTION_FAILED')); self.note(self.failure(test, 'FAIL'))
        def addError(self, test, error):
            self.errors.append((test, 'EXECUTION_INCOMPLETE')); self.note(self.failure(test, 'INCOMPLETE'))
        def addSkip(self, test, reason):
            self.skipped.append((test, reason)); self.note(dict(name=test._testMethodName, state='NOT_RUN', reason=reason))
    def combined_failure(self):
        class Broken(unittest.TestCase):
            def runTest(self): raise AssertionError('SYNTHETIC_BODY_FAILURE_PRIVATE_SENTINEL')
            def tearDown(self): raise OSError('SYNTHETIC_CLEANUP_FAILURE_PRIVATE_SENTINEL')
        result = SafeResult(); unittest.TestSuite([Broken()]).run(result)
        self.assertEqual(result.testsRun, 1); self.assertEqual(len(result.cases), 1)
        self.assertEqual(result.cases[0]['state'], 'INCOMPLETE')
        self.assertEqual((len(result.failures), len(result.errors)), (1, 1))
        self.assertNotIn('PRIVATE_SENTINEL', json.dumps(result.cases))
    setattr(ToolchainTests, 'test_duplicate_failure_cleanup_is_one_incomplete_case', combined_failure)
    result = SafeResult(); unittest.defaultTestLoader.loadTestsFromTestCase(ToolchainTests).run(result)
    expected = {'POSIX_FILESYSTEM_CONTROL_NOT_RUN_ON_WINDOWS', 'WINDOWS_SHIM_CONTROL_NOT_RUN_ON_POSIX', 'WINDOWS_ACL_CONTROL_NOT_RUN_ON_POSIX', 'WINDOWS_REPARSE_CONTROL_NOT_RUN_ON_POSIX'}
    state = 'PASS' if not result.failures and not result.errors and not any(r not in expected for _, r in result.skipped) else 'INCOMPLETE'
    return dict(schema=1, qualification='SYNTHETIC_PINNED_MODEL_FILESYSTEM_CONTROLS_ONLY', state=state,
        tests=result.testsRun, passed=sum(c['state'] == 'PASS' for c in result.cases),
        failed=sum(c['state'] == 'FAIL' for c in result.cases), errors=sum(c['state'] == 'INCOMPLETE' for c in result.cases),
        notRun=sum(c['state'] == 'NOT_RUN' for c in result.cases), platform=os.name, cases=result.cases, acceptanceGranted=False)


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
