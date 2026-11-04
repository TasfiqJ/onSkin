"""C45 orchestration controls. All synthetic receipts below are test fixtures only."""
import copy
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager, ExitStack
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import stat
import sys
import tempfile
import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('historical45', Path(__file__).with_name('historicalReplay45.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


@contextmanager
def native_failed_stage(child_message='C45_OWNED_NATIVE_FAILURE', padding=0, recorded_stage=True):
    """Actual owned failing subprocesses/Git/FS; synthetic test programs only."""
    with tempfile.TemporaryDirectory(prefix='c45-failed-stage-') as directory:
        base = Path(directory).resolve()
        fixture, workspace = base/'fixture', base/'child-workspace'
        source = workspace/'source'
        fixture.mkdir()
        source.mkdir(parents=True)
        for root in (fixture, source):
            subprocess.run(['git', 'init', '--quiet'], cwd=root, check=True, capture_output=True)
            subprocess.run(['git', 'config', 'core.autocrlf', 'false'], cwd=root, check=True)
            (root/'fixture.txt').write_bytes(b'SYNTHETIC_NATIVE_CONTROL_NOT_CAMPAIGN_SOURCE\n')
        script = fixture/m.PREFIX/'main_integration44.py'
        script.parent.mkdir(parents=True)
        text = 'print("N"*'+str(padding)+')\n'
        if recorded_stage:
            text += 'print('+repr('R44_HISTORICAL_WORKSPACE '+str(workspace))+')\n'
        text += 'print("SYNTHETIC_NORMAL_INVOCATION_FAILURE");raise SystemExit(1)\n'
        script.write_bytes(text.encode())
        for root in (fixture, source):
            subprocess.run(['git', 'add', '.'], cwd=root, check=True)
            subprocess.run(['git', '-c', 'user.name=C45 native control', '-c', 'user.email=c45@invalid.test',
                            'commit', '--quiet', '-m', 'synthetic native control'], cwd=root, check=True)
        head = m.git(fixture, 'rev-parse', 'HEAD').decode().strip()
        tree = m.git(fixture, 'rev-parse', 'HEAD^{tree}').decode().strip()
        evidence = base/'evidence'
        attempt = evidence/'attempt-1'
        attempt.mkdir(parents=True)
        (workspace/'logs').mkdir()
        child = m.run_command([sys.executable, '-I', '-B', '-c',
            'print("C"*'+str(padding)+');print('+repr(child_message)+');raise SystemExit(7)'],
            source, dict(os.environ), workspace/'logs/control.log')
        child['name'] = 'control'
        (workspace/'logs/receipts.json').write_text(json.dumps([child]))
        with patch.object(m, 'BASE', head), patch.object(m, 'TREE', tree):
            command = [sys.executable, '-I', '-B', m.PREFIX+'main_integration44.py', '--historical']
            row = m.run_command(command, fixture, dict(os.environ), attempt/'normal-full-invocation.log')
            row.update(head=head, tree=tree)
            result = dict(status='INCOMPLETE_REQUIRES_RESUME_OR_REPAIR', attempts=[row],
                          acceptanceGranted=False, release='NO_GO')
            yield SimpleNamespace(base=base, fixture=fixture, workspace=workspace, source=source,
                evidence=evidence, attempt=attempt, child=child, row=row, result=result, command=command)


class HistoricalExecutionControls(unittest.TestCase):
    def test_json_duplicates_nonfinite_and_linked_logs_refuse(self):
        for raw in (b'{"exit":0,"exit":1}', b'{"exit":NaN}', b'{"exit":Infinity}'):
            with self.assertRaises(ValueError):
                m.document(raw)
        with tempfile.TemporaryDirectory(prefix='c45-history-log-') as directory:
            path = Path(directory)/'log'
            path.write_bytes(b'public synthetic fixture\n')
            link = Path(directory)/'linked'
            os.link(path, link)
            with self.assertRaisesRegex(ValueError, 'C45H_REGULAR_FILE'):
                m.regular(path)
            link.unlink()
            self.assertEqual(m.regular(path), b'public synthetic fixture\n')

    def test_real_native_child_wrong_exit_is_retained_not_converted_to_success(self):
        with tempfile.TemporaryDirectory(prefix='c45-history-native-') as directory:
            root = Path(directory)
            command = [sys.executable, '-I', '-B', '-c', 'print("public synthetic fixture");raise SystemExit(2)']
            row = m.run_command(command, root, dict(os.environ), root/'child.log', expected=0)
            self.assertEqual((row['exit'], row['expectedExit'], row['timedOut']), (2, 0, False))
            self.assertIn(b'public synthetic fixture', m.verify_receipt(row, command, 0))
            for key, changed in (('exit', True), ('expectedExit', False), ('bytes', True),
                                 ('sha256', '0'*64), ('command', ['true'])):
                bad = dict(row, **{key: changed})
                with self.subTest(key=key), self.assertRaises(ValueError):
                    m.verify_receipt(bad, command, 0)
            (root/'child.log').write_bytes(b'forged success\n')
            with self.assertRaisesRegex(ValueError, 'C45H_LOG_CHANGED'):
                m.verify_receipt(row)

    def test_actual_timeout_retains_failure_and_native_log(self):
        with tempfile.TemporaryDirectory(prefix='c45-history-timeout-') as directory:
            root = Path(directory)
            row = m.run_command([sys.executable, '-I', '-B', '-c', 'import time;time.sleep(2)'],
                                root, dict(os.environ), root/'timeout.log', timeout=0.01)
            self.assertTrue(row['timedOut'])
            self.assertNotEqual(row['exit'], 0)
            self.assertEqual(m.verify_receipt(row), (root/'timeout.log').read_bytes())

    def test_actual_owned_timeout_drains_started_native_grandchild(self):
        with tempfile.TemporaryDirectory(prefix='c45-history-tree-') as directory:
            root = Path(directory)
            marker = root/'grandchild.pid'
            grandchild = ('import os,time;from pathlib import Path;'
                          'Path('+repr(str(marker))+').write_text(str(os.getpid()));time.sleep(30)')
            child = ('import subprocess,sys;process=subprocess.Popen([sys.executable,"-I","-B","-c",'+
                     repr(grandchild)+']);process.wait()')
            handle = None
            with ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(m.run_command, [sys.executable, '-I', '-B', '-c', child],
                                     root, dict(os.environ), root/'tree.log', 0, 3)
                deadline = time.monotonic()+2.5
                while not marker.exists() and time.monotonic() < deadline:
                    time.sleep(0.01)
                self.assertTrue(marker.exists(), 'native grandchild must actually start before timeout')
                pid = int(marker.read_text())
                if os.name == 'nt':
                    import ctypes
                    from ctypes import wintypes
                    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
                    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
                    kernel.OpenProcess.restype = wintypes.HANDLE
                    kernel.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
                    kernel.WaitForSingleObject.restype = wintypes.DWORD
                    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
                    handle = kernel.OpenProcess(0x00100000, False, pid)
                    self.assertTrue(handle, 'observe exact native process identity before termination')
                elif hasattr(os, 'pidfd_open'):
                    import select
                    handle = os.pidfd_open(pid)
                    poller = select.poll()
                    poller.register(handle, select.POLLIN)
                try:
                    row = future.result(timeout=15)
                    self.assertTrue(row['timedOut'])
                    self.assertTrue(row['descendantsDrained'])
                    if os.name == 'nt':
                        self.assertEqual(kernel.WaitForSingleObject(handle, 1000), 0)
                    elif hasattr(os, 'pidfd_open'):
                        self.assertTrue(poller.poll(1000))
                    else:
                        state = subprocess.run(['ps', '-p', str(pid), '-o', 'stat='], capture_output=True)
                        self.assertTrue(not state.stdout.strip() or state.stdout.strip().startswith(b'Z'))
                finally:
                    if handle is not None:
                        kernel.CloseHandle(handle) if os.name == 'nt' else os.close(handle)

    def test_actual_git_wrong_parent_refuses_before_old_reader_execution(self):
        with tempfile.TemporaryDirectory(prefix='c45-history-git-') as directory:
            root = Path(directory)
            subprocess.run(['git', 'init', '--quiet'], cwd=root, check=True)
            subprocess.run(['git', '-c', 'user.name=Synthetic fixture', '-c',
                            'user.email=fixture@example.invalid', 'commit', '--allow-empty', '--quiet',
                            '-m', 'Synthetic test fixture, no acceptance'], cwd=root, check=True)
            with self.assertRaisesRegex(ValueError, 'C45H_FIXTURE_PIN'):
                m.fixture_identity(root)

    def checkpoint(self, root):
        node = str((root/'node').resolve())
        npm = str((root/'npm/bin/npm-cli.js').resolve())
        Path(node).write_bytes(b'synthetic executable bytes, never executed\n')
        Path(npm).parent.mkdir(parents=True)
        Path(npm).write_bytes(b'synthetic CLI bytes, never executed\n')
        (root/'npm/package.json').write_bytes(b'{"version":"11.20.0"}\n')
        commands = [[node, '--version'], [node, npm, '--version'],
                    [node, npm, 'ci', '--ignore-scripts=false', '--no-audit', '--no-fund'],
                    [node, 'scripts/postinstall.mjs', '--check']]
        rows = []
        for number, (command, raw) in enumerate(zip(commands, (b'v22.21.0\n', b'11.20.0\n',
                                                             b'synthetic install\n', b'synthetic hooks\n'))):
            path = root/(str(number)+'.log')
            path.write_bytes(raw)
            rows.append(dict(command=command, exit=0, expectedExit=0, timedOut=False,
                             bytes=len(raw), sha256=m.digest(raw), log=str(path)))
        identity = dict(qualification='SYNTHETIC_PARSER_TEST_NOT_SOURCE_ACCEPTANCE', tree='a'*40)
        return dict(schema=1, identity=identity, node=node, npm=npm,
                    tools=m.tools_identity(node, npm), setup=rows), identity

    def test_checkpoint_binds_exact_toolchain_lock_identity_all_receipts_and_hooks(self):
        with tempfile.TemporaryDirectory(prefix='c45-history-checkpoint-') as directory:
            root = Path(directory).resolve()
            checkpoint, identity = self.checkpoint(root)
            self.assertEqual(m.checkpoint_guard(checkpoint, identity), checkpoint)
            for change in ('schema', 'identity', 'npm', 'install-command', 'hook-exit', 'missing-hook'):
                bad = copy.deepcopy(checkpoint)
                if change == 'schema':
                    bad['schema'] = True
                elif change == 'identity':
                    bad['identity']['tree'] = 'b'*40
                elif change == 'npm':
                    bad['npm'] = 'relative/npm-cli.js'
                elif change == 'install-command':
                    bad['setup'][2]['command'][3] = '--ignore-scripts=true'
                elif change == 'hook-exit':
                    bad['setup'][3]['exit'] = 1
                else:
                    bad['setup'].pop()
                with self.subTest(change=change), self.assertRaises(ValueError):
                    m.checkpoint_guard(bad, identity)
            (root/'1.log').write_bytes(b'10.9.4\n')
            checkpoint['setup'][1].update(bytes=7, sha256=m.digest(b'10.9.4\n'))
            with self.assertRaisesRegex(ValueError, 'C45H_NPM_VERSION'):
                m.checkpoint_guard(checkpoint, identity)

    def test_same_version_mutated_node_cli_or_npm_package_invalidates_checkpoint(self):
        for changed in ('node', 'npm/bin/npm-cli.js', 'npm/package.json', 'npm/lib.js'):
            with self.subTest(changed=changed), tempfile.TemporaryDirectory(prefix='c45-tools-') as directory:
                root = Path(directory).resolve()
                checkpoint, identity = self.checkpoint(root)
                before = m.tools_identity(checkpoint['node'], checkpoint['npm'])
                self.assertEqual(m.checkpoint_guard(checkpoint, identity, before), checkpoint)
                path = root/changed
                path.write_bytes((path.read_bytes() if path.exists() else b'')+b' changed same version\n')
                actual = m.tools_identity(checkpoint['node'], checkpoint['npm'])
                self.assertNotEqual(actual, before)
                with self.assertRaisesRegex(ValueError, 'C45H_TOOLCHAIN_CHANGED'):
                    m.checkpoint_guard(checkpoint, identity, actual)

    @contextmanager
    def tool_links(self):
        with tempfile.TemporaryDirectory(prefix='c45-tool-links-') as directory, ExitStack() as ports:
            root = Path(directory).resolve()
            checkpoint, identity = self.checkpoint(root)
            package = root/'npm'
            (package/'.bin').mkdir()
            for name in ('target.js', 'same.js'):
                (package/name).write_bytes(b'actual filesystem target, never executed\n')
            (package/'folder').mkdir()
            link = package/'.bin/tool'
            fake = {}
            native_readlink, native_lstat = os.readlink, Path.lstat
            try:
                os.symlink('../target.js', link)
                backend = 'NATIVE_'+os.name
            except OSError as error:
                if os.name != 'nt' or getattr(error, 'winerror', None) != 1314:
                    raise
                backend = 'SYNTHETIC_NATIVE_FS_PORT_NT_1314_POSIX_NOT_RUN'
                link.write_bytes(b'')
                fake[link] = '../target.js'
                def lstat(path):
                    info = native_lstat(path)
                    if path not in fake:
                        return info
                    values = {k: getattr(info, k) for k in ('st_dev', 'st_ino', 'st_size', 'st_mtime_ns', 'st_ctime_ns', 'st_nlink')}
                    return SimpleNamespace(**values, st_mode=stat.S_IFLNK | 0o777, st_file_attributes=1024)
                ports.enter_context(patch.object(Path, 'lstat', lstat))
                ports.enter_context(patch.object(os, 'readlink', lambda path: fake[path] if path in fake else native_readlink(path)))
            print('C45H_LINK_CONTROL_BACKEND='+backend, file=sys.stderr)
            def change(literal, path=link):
                if fake:
                    if not path.exists():
                        path.write_bytes(b'')
                    fake[path] = literal
                else:
                    if path.is_symlink():
                        path.unlink()
                    os.symlink(literal, path)
            yield root, checkpoint, identity, package, link, change

    def test_internal_tool_file_links_hash_literal_canonical_target_and_actual_target_bytes(self):
        with self.tool_links() as (root, checkpoint, identity, package, link, change):
            first = m.tools_identity(checkpoint['node'], checkpoint['npm'])
            row = first['npmPackageLinks'][0]
            self.assertEqual((row['path'], row['linkTarget'], row['resolvedTarget']), ('.bin/tool', '../target.js', 'target.js'))
            self.assertEqual(row['sha256'], m.digest((package/'target.js').read_bytes()))
            checkpoint['tools'] = first
            self.assertEqual(m.checkpoint_guard(checkpoint, identity, first), checkpoint)
            change('../same.js')
            retargeted = m.tools_identity(checkpoint['node'], checkpoint['npm'])
            self.assertNotEqual(retargeted['npmPackageSHA256'], first['npmPackageSHA256'], 'literal and target path matter even with identical bytes')
            (package/'same.js').write_bytes(b'changed same-version target bytes\n')
            actual = m.tools_identity(checkpoint['node'], checkpoint['npm'])
            self.assertNotEqual(actual['npmPackageSHA256'], retargeted['npmPackageSHA256'])
            with self.assertRaisesRegex(ValueError, 'C45H_TOOLCHAIN_CHANGED'):
                m.checkpoint_guard(checkpoint, identity, actual)

    def test_tool_links_refuse_escape_directory_cycle_chain_and_junction_without_traversal(self):
        for literal in ('../../outside.js', '../folder', 'tool', '../chain',
                        '../target.js/../same.js', '.././target.js', '..//target.js', '..\\target.js'):
            with self.subTest(literal=literal), self.tool_links() as (_, checkpoint, _, package, link, change):
                change('target.js', package/'chain')
                change(literal)
                with self.assertRaises(ValueError):
                    m.tools_identity(checkpoint['node'], checkpoint['npm'])
        with self.tool_links() as (_, checkpoint, _, package, link, change):
            original = Path.lstat
            def junction(path):
                info = original(path)
                if path != package/'folder':
                    return info
                values = {k: getattr(info, k) for k in ('st_dev', 'st_ino', 'st_size', 'st_mtime_ns', 'st_ctime_ns', 'st_nlink', 'st_mode')}
                return SimpleNamespace(**values, st_file_attributes=1024)
            with patch.object(Path, 'lstat', junction), self.assertRaisesRegex(ValueError, 'C45H_TOOL_LINK_DIRECTORY'):
                m.tools_identity(checkpoint['node'], checkpoint['npm'])

    def test_tool_link_and_parent_retarget_during_target_read_refuse(self):
        for mutation in ('link', 'parent'):
            with self.subTest(mutation=mutation), self.tool_links() as (_, checkpoint, _, package, link, change):
                original, entered = Path.open, []
                def opened(path, *args, **kwargs):
                    stream = original(path, *args, **kwargs)
                    if path == package/'target.js' and not entered:
                        entered.append(True)
                        if mutation == 'link':
                            change('../same.js')
                        else:
                            info = link.parent.stat()
                            os.utime(link.parent, ns=(info.st_atime_ns, info.st_mtime_ns+1000000000))
                    return stream
                with patch.object(Path, 'open', opened), self.assertRaisesRegex(ValueError, 'C45H_TOOL_LINK_CHANGED'):
                    m.tools_identity(checkpoint['node'], checkpoint['npm'])
                self.assertTrue(entered, 'actual target-file read must enter the controlled window')

    def test_tool_package_depth_is_bounded_before_recursing(self):
        with tempfile.TemporaryDirectory(prefix='c45-tool-depth-') as directory:
            root = Path(directory).resolve()
            checkpoint, _ = self.checkpoint(root)
            deep = root/'npm'
            for _ in range(33):
                deep = deep/'d'
                deep.mkdir()
            with self.assertRaisesRegex(ValueError, 'C45H_TOOL_PACKAGE_LIMIT'):
                m.tools_identity(checkpoint['node'], checkpoint['npm'])

    def test_actual_normal_file_parent_junction_retarget_after_traversal_is_refused_before_read(self):
        with tempfile.TemporaryDirectory(prefix='c45-tool-parent-race-') as directory:
            root = Path(directory).resolve()
            checkpoint, _ = self.checkpoint(root)
            package, outside = root/'npm', root/'outside'
            ordinary, held = package/'ordinary', root/'held-original'
            ordinary.mkdir(); outside.mkdir()
            payload = ordinary/'payload.js'
            payload.write_bytes(b'identical bytes, but outside package\n')
            (outside/'payload.js').write_bytes(payload.read_bytes())
            m.tools_identity(checkpoint['node'], checkpoint['npm'])
            original_lstat, original_open, calls, swapped, reads = Path.lstat, Path.open, [], [], []
            def lstat(path):
                if path == payload:
                    calls.append(True)
                    if len(calls) == 3:
                        self.assertTrue(ordinary.resolve().is_relative_to(root))
                        self.assertTrue(outside.resolve().is_relative_to(root))
                        ordinary.rename(held)
                        if os.name == 'nt':
                            quote = lambda p: "'"+str(p).replace("'", "''")+"'"
                            subprocess.run(['powershell.exe', '-NoProfile', '-Command',
                                'New-Item -ItemType Junction -Path '+quote(ordinary)+' -Value '+quote(outside)+' | Out-Null'],
                                check=True, capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW)
                        else:
                            os.symlink(outside, ordinary, target_is_directory=True)
                        swapped.append(True)
                return original_lstat(path)
            def opened(path, *args, **kwargs):
                if path == payload:
                    reads.append(True)
                return original_open(path, *args, **kwargs)
            try:
                with patch.object(Path, 'lstat', lstat), patch.object(Path, 'open', opened), \
                        self.assertRaisesRegex(ValueError, 'C45H_TOOL_PACKAGE_DIRECTORY_CHANGED'):
                    m.tools_identity(checkpoint['node'], checkpoint['npm'])
                self.assertTrue(swapped, 'real native directory junction/symlink window must execute')
                self.assertFalse(payload.resolve().is_relative_to(package))
                self.assertEqual(reads, [], 'outside-package ordinary input must not be opened')
            finally:
                if swapped:
                    self.assertTrue(ordinary.resolve().is_relative_to(root))
                    os.rmdir(ordinary) if os.name == 'nt' else ordinary.unlink()
                    self.assertTrue(held.resolve().is_relative_to(root))
                    held.rename(ordinary)

    def test_older_diagnostic_fixture_refuses_actual_replace_graft_alternates_shallow_and_dirty_bytes(self):
        neutral = (Path(__file__).resolve().parents[3]/m.PREFIX/'check.py').read_bytes()
        with tempfile.TemporaryDirectory(prefix='c45-selected-history-') as directory:
            directory = Path(directory).resolve()
            trusted, root = directory/'trusted', directory/'older'
            trusted.mkdir()
            def git(where, *args):
                return subprocess.check_output(['git', *args], cwd=where, stderr=subprocess.PIPE)
            git(trusted, 'init', '--quiet')
            git(trusted, 'config', 'user.name', 'Synthetic source test')
            git(trusted, 'config', 'user.email', 'fixture@example.invalid')
            git(trusted, 'config', 'core.autocrlf', 'false')
            checker = trusted/m.PREFIX/'check.py'
            checker.parent.mkdir(parents=True)
            checker.write_bytes(neutral)
            path = trusted/'tracked.txt'
            path.write_bytes(b'original synthetic source\n')
            git(trusted, 'add', '--all')
            git(trusted, 'commit', '--quiet', '-m', 'Synthetic fixture only, no acceptance')
            head = git(trusted, 'rev-parse', 'HEAD').decode().strip()
            git(directory, 'clone', '--quiet', '--no-local', '--no-hardlinks', '--single-branch',
                '-c', 'core.autocrlf=false', '-c', 'core.longpaths=true', str(trusted), str(root))
            path.write_bytes(b'future synthetic authority\n')
            git(trusted, 'commit', '--all', '--quiet', '-m', 'Synthetic future base, no acceptance')
            future = git(trusted, 'rev-parse', 'HEAD').decode().strip()
            future_tree = git(trusted, 'rev-parse', 'HEAD^{tree}').decode().strip()
            absent = subprocess.run(['git', 'cat-file', '-e', future+'^{commit}'], cwd=root,
                                    capture_output=True)
            self.assertNotEqual(absent.returncode, 0, 'older single-branch clone lacks future base')
            path = root/'tracked.txt'
            with patch.object(m, 'BASE', future), patch.object(m, 'TREE', future_tree):
                self.assertEqual(m.selected_fixture_identity(root, trusted)['trackedBlobs'], 2)
                for name in ('objects/info/alternates', 'info/grafts', 'shallow'):
                    metadata = root/'.git'/name
                    metadata.write_bytes((head+'\n').encode() if name == 'shallow' else b'')
                    try:
                        with self.subTest(name=name), self.assertRaises(ValueError):
                            m.selected_fixture_identity(root, trusted)
                    finally:
                        metadata.unlink()
                git(root, 'replace', head, head)
                with self.assertRaises(ValueError):
                    m.selected_fixture_identity(root, trusted)
                git(root, 'replace', '-d', head)
                path.write_bytes(b'changed synthetic source\n')
                with self.assertRaises(ValueError):
                    m.selected_fixture_identity(root, trusted)

    def test_known_foreign_selected_commit_is_not_admitted_by_trusted_future_store(self):
        neutral = (Path(__file__).resolve().parents[3]/m.PREFIX/'check.py').read_bytes()
        with tempfile.TemporaryDirectory(prefix='c45-foreign-history-') as directory:
            directory = Path(directory).resolve()
            trusted, foreign = directory/'trusted', directory/'foreign'
            for root in (trusted, foreign):
                root.mkdir()
                subprocess.run(['git', 'init', '--quiet'], cwd=root, check=True)
                subprocess.run(['git', 'config', 'core.autocrlf', 'false'], cwd=root, check=True)
                (root/'synthetic.txt').write_bytes(root.name.encode())
                subprocess.run(['git', 'add', '--all'], cwd=root, check=True)
                subprocess.run(['git', '-c', 'user.name=Synthetic source test', '-c',
                                'user.email=fixture@example.invalid', 'commit', '--quiet', '-m',
                                'Synthetic unrelated source, no acceptance'], cwd=root, check=True)
            checker = trusted/m.PREFIX/'check.py'
            checker.parent.mkdir(parents=True)
            checker.write_bytes(neutral)
            subprocess.run(['git', 'add', '--all'], cwd=trusted, check=True)
            subprocess.run(['git', '-c', 'user.name=Synthetic source test', '-c',
                            'user.email=fixture@example.invalid', 'commit', '--quiet', '-m',
                            'Synthetic trusted authority, no acceptance'], cwd=trusted, check=True)
            # Native test-only transport makes the unrelated commit known to the
            # trusted store; the production helper never fetches missing proof.
            subprocess.run(['git', 'fetch', '--quiet', '--no-tags', str(foreign),
                            'HEAD:refs/c45-synthetic-foreign'], cwd=trusted, check=True)
            head = m.git(trusted, 'rev-parse', 'HEAD').decode().strip()
            tree = m.git(trusted, 'rev-parse', 'HEAD^{tree}').decode().strip()
            with patch.object(m, 'BASE', head), patch.object(m, 'TREE', tree):
                with self.assertRaises(subprocess.CalledProcessError) as refusal:
                    m.selected_fixture_identity(foreign, trusted)
                self.assertEqual(refusal.exception.returncode, 1, 'known unrelated commit is not an ancestor')

    def test_expected_readiness_two_remains_distinct_from_success_zero(self):
        result = dict(exit=2, expectedExit=2)
        events = dict(diagnosticOnly=True, exit=2, events=[])
        self.assertEqual(m.diagnostic_classification(result, events), 'DIAGNOSTIC_RECOVERED_CAUSE_UNPROVEN')
        result['expectedExit'] = 0
        self.assertEqual(m.diagnostic_classification(result, events), 'SEMANTIC_OR_UNCLASSIFIED_NO_AUTOMATIC_RETRY')

    def test_only_actual_fatal_http_exception_classifies_retryable_not_generic_error_strings(self):
        result = dict(exit=1, expectedExit=0)
        events = dict(diagnosticOnly=True, exit=1,
                      events=[dict(function='main', type='HTTPError', httpStatus=503)])
        self.assertEqual(m.diagnostic_classification(result, events), 'REPRODUCED_RETRYABLE_HTTP')
        for changed in (dict(function='main', type='ValueError', message='R44_EXECUTION_INCOMPLETE'),
                        dict(function='main', type='HTTPError', httpStatus=401),
                        dict(function='main', type='HTTPError', httpStatus='503'),
                        dict(function='main', type='RuntimeError', message='HTTP Error503')):
            with self.subTest(changed=changed):
                self.assertEqual(m.diagnostic_classification(result, dict(events, events=[changed])),
                                 'SEMANTIC_OR_UNCLASSIFIED_NO_AUTOMATIC_RETRY')

    def test_caught_http_may_not_mask_a_later_semantic_or_custody_failure(self):
        events = dict(diagnosticOnly=True, exit=1, events=[
            dict(function='fetch_pr', type='HTTPError', httpStatus=503),
            dict(function='main', type='ValueError', message='R44_PARENT_TREE')])
        self.assertEqual(m.diagnostic_classification(dict(exit=1, expectedExit=0), events),
                         'SEMANTIC_OR_UNCLASSIFIED_NO_AUTOMATIC_RETRY')
        for bad in (dict(events, diagnosticOnly=False), dict(events, exit=True), dict(events, exit=0)):
            with self.assertRaises(ValueError):
                m.diagnostic_classification(dict(exit=1, expectedExit=0), bad)

    def test_diagnostic_and_composite_receipts_never_equal_required_normal_invocation(self):
        with tempfile.TemporaryDirectory(prefix='c45-history-not-full-') as directory:
            base = Path(directory)
            root = base/'fixture'
            root.mkdir()
            path = root/'synthetic.log'
            path.write_bytes(b'{"status":"PASS","diagnosticOnly":true}\n')
            row = dict(command=[sys.executable, '-I', '-B', '-c', 'synthetic diagnostic only'],
                       exit=0, expectedExit=0, timedOut=False, bytes=path.stat().st_size,
                       sha256=m.digest(path.read_bytes()), log=str(path), cwd=str(root.resolve()),
                       head=m.BASE, tree=m.TREE)
            with self.assertRaisesRegex(ValueError, 'C45H_COMMAND_CHANGED'):
                m.verify_complete(root, row)
            result = base/'result.json'
            result.write_bytes(b'{"status":"COMPOSITE_STAGES_PASS","acceptanceGranted":false,"release":"NO_GO"}')
            with self.assertRaisesRegex(ValueError, 'C45H_RESULT_NOT_COMPLETE'):
                m.verify_result(root, result)

    def test_every_attempt_binds_normal_command_cwd_head_tree_and_integer_exits(self):
        with tempfile.TemporaryDirectory(prefix='c45-attempts-') as directory:
            root = Path(directory).resolve()
            path = root/'synthetic.log'
            raw = b'public synthetic failure, not original source acceptance\n'
            path.write_bytes(raw)
            row = dict(command=[sys.executable, '-I', '-B', m.PREFIX+'main_integration44.py', '--historical'],
                       cwd=str(root), head=m.BASE, tree=m.TREE, exit=1, expectedExit=0,
                       timedOut=False, bytes=len(raw), sha256=m.digest(raw), log=str(path),
                       toolInputQualification='HASHED_BEFORE_AND_AFTER_ACTUAL_NORMAL_INVOCATION',
                       toolInputsBefore={'synthetic': 'metadata-test-only'},
                       toolInputsAfter={'synthetic': 'metadata-test-only'})
            m.verify_attempts(root, [row])
            for key, value in (('cwd', str(root/'elsewhere')), ('head', '0'*40), ('tree', '0'*40),
                               ('exit', True), ('expectedExit', False), ('timedOut', 0),
                               ('command', [sys.executable, '-c', 'synthetic alternative'])):
                bad = dict(row, **{key: value})
                with self.subTest(key=key), self.assertRaises(ValueError):
                    m.verify_attempts(root, [row, bad])
            for key in ('cwd', 'head', 'tree'):
                with self.subTest(complete=key), self.assertRaisesRegex(ValueError, 'C45H_INVOCATION_FIXTURE'):
                    m.verify_complete(root, dict(row, **{key: 'changed'}))
            with self.assertRaisesRegex(ValueError, 'C45H_ATTEMPT_LEDGER'):
                m.verify_attempts(root, [row]*4)

    def test_original_semantic_refusal_stops_before_diagnostic_and_cannot_be_retried_on_resume(self):
        with tempfile.TemporaryDirectory(prefix='c45-semantic-stop-') as directory:
            base = Path(directory).resolve()
            root = base/'fixture'
            root.mkdir()
            evidence = base/'external-evidence'
            directory = evidence/'attempt-1'
            directory.mkdir(parents=True)
            raw = b'{"valid":false,"error":"R44_PARENT_TREE"}\n'
            path = directory/'normal-full-invocation.log'
            path.write_bytes(raw)
            row = dict(command=[sys.executable, '-I', '-B', m.PREFIX+'main_integration44.py', '--historical'],
                       cwd=str(root), head=m.BASE, tree=m.TREE, exit=1, expectedExit=0,
                       timedOut=False, bytes=len(raw), sha256=m.digest(raw), log=str(path),
                       toolInputQualification='HASHED_BEFORE_AND_AFTER_ACTUAL_NORMAL_INVOCATION',
                       toolInputsBefore={'synthetic': 'metadata-test-only'},
                       toolInputsAfter={'synthetic': 'metadata-test-only'})
            self.assertEqual(m.original_refusal(row, root), 'R44_PARENT_TREE')
            diagnosis = m.diagnose(dict(root=str(root), row=row), root, directory, dict(os.environ))
            self.assertEqual(diagnosis['classification'], 'ORIGINAL_SEMANTIC_OR_CUSTODY_REFUSAL_NO_RETRY')
            self.assertFalse((root/'diagnostic.log').exists())
            self.assertFalse((directory/'diagnostic.log').exists())
            self.assertEqual(m.document(m.regular(directory/'diagnosis.json')), diagnosis)
            success = dict(row, exit=0)
            with self.assertRaisesRegex(ValueError, 'C45H_SEMANTIC_REFUSAL_RETRIED_WITHOUT_REPAIR'):
                m.verify_attempts(root, [row, success])
            (evidence/'attempts.json').write_text(json.dumps([row]))
            with patch.object(m, 'prepare', return_value=(None, {}, {})), \
                 patch.object(m, 'run_command', side_effect=AssertionError('must not execute after semantic stop')):
                result = m.replay(root, evidence)
            self.assertEqual(result['stopReason'], 'R44_PARENT_TREE')
            self.assertEqual(result['status'], 'INCOMPLETE_REQUIRES_RESUME_OR_REPAIR')

    def test_opaque_wrappers_remain_unproven_and_invalid_original_json_fails_closed(self):
        for code in ('R44_EXECUTION_INCOMPLETE', 'R32_CHILD_EXIT', 'R29_PUBLIC_READ_INCOMPLETE'):
            self.assertIsNone(m.explicit_refusal(json.dumps(dict(valid=False, error=code)).encode()))
        self.assertEqual(m.explicit_refusal(b'{"error":"R44_PARENT_TREE","error":"hidden"}'),
                         'C45H_ORIGINAL_DOCUMENT_INVALID')

    def test_tool_attestation_is_read_and_compared_never_write_only_metadata(self):
        tools = {'synthetic': 'metadata validator fixture, not executed source evidence'}
        row = dict(toolInputQualification='HASHED_BEFORE_AND_AFTER_ACTUAL_NORMAL_INVOCATION',
                   toolInputsBefore=tools, toolInputsAfter=tools)
        m.verify_tool_attestation(row, dict(tools=tools))
        for changed in (dict(row, toolInputsAfter={'changed': True}),
                        dict(row, toolInputsBefore=None), dict(row, toolInputQualification='PASS')):
            with self.assertRaises(ValueError):
                m.verify_tool_attestation(changed, dict(tools=tools))
        with self.assertRaisesRegex(ValueError, 'C45H_INVOCATION_CHECKPOINT_TOOLS'):
            m.verify_tool_attestation(row, dict(tools={'different': True}))

    def test_external_launch_keeps_versions_only_qualification_and_original_hashed_provenance(self):
        with tempfile.TemporaryDirectory(prefix='c45-external-provenance-') as directory:
            root = Path(directory).resolve()
            checkpoint, _ = self.checkpoint(root)
            checkpoint['identity'] = dict(root=str(root), head=m.BASE, tree=m.TREE,
                                          qualification='SYNTHETIC_VALIDATOR_FIXTURE_ONLY')
            launch = {key: value for key, value in checkpoint.items() if key != 'tools'}
            launch_path = root/'launch.json'
            launch_path.write_text(json.dumps(launch))
            log = root/'external.log'
            log.write_bytes(b'synthetic only, never normal-original-reader PASS\n')
            original = dict(command=[sys.executable, '-I', '-B', m.PREFIX+'main_integration44.py', '--historical'],
                            cwd=str(root), head=m.BASE, tree=m.TREE, exit=0, expectedExit=0, timedOut=False,
                            log=str(log), bytes=log.stat().st_size, sha256=m.digest(log.read_bytes()))
            receipt_path = root/'original-receipt.json'
            receipt_path.write_text(json.dumps(original))
            row = dict(original, toolInputsBefore=None, toolInputsAfter=checkpoint['tools'],
                       toolInputQualification='EXTERNAL_NORMAL_LAUNCH_VERSION_PATH_LOCK_HOOKS_LATER_BYTE_FINGERPRINT',
                       originalReceiptPath=str(receipt_path), originalReceiptSHA256=m.digest(receipt_path.read_bytes()),
                       launchCheckpointPath=str(launch_path), launchCheckpointSHA256=m.digest(launch_path.read_bytes()))
            m.verify_tool_attestation(row, checkpoint)
            with self.assertRaisesRegex(ValueError, 'C45H_EXTERNAL_TOOL_QUALIFICATION'):
                m.verify_tool_attestation(dict(row, toolInputsBefore=checkpoint['tools']), checkpoint)
            receipt_path.write_text(json.dumps(dict(original, exit=1)))
            with self.assertRaisesRegex(ValueError, 'C45H_EXTERNAL_RECEIPT_CHANGED'):
                m.verify_tool_attestation(row, checkpoint)

    def test_evidence_cannot_write_inside_readonly_fixture_before_authentication(self):
        with tempfile.TemporaryDirectory(prefix='c45-readonly-evidence-') as directory:
            root = Path(directory).resolve()
            for evidence in (root, root/'new-evidence'):
                with self.subTest(evidence=str(evidence)), self.assertRaisesRegex(ValueError, 'C45H_EVIDENCE_INSIDE_FIXTURE'):
                    m.prepare(root, evidence)
            self.assertFalse((root/'new-evidence').exists())
            self.assertFalse((root/'empty.npmrc').exists())

    def test_failure_stage_refuses_relative_workspace_and_arbitrary_log_reads(self):
        with self.assertRaisesRegex(ValueError, 'C45H_WORKSPACE_ABSOLUTE'):
            m.failure_stage(b'R44_HISTORICAL_WORKSPACE relative\n', Path.cwd())
        with tempfile.TemporaryDirectory(prefix='c45-history-child-') as directory:
            workspace = Path(directory).resolve()
            (workspace/'logs').mkdir()
            other = workspace/'other.log'
            other.write_bytes(b'synthetic')
            row = dict(name='control', command=['python', '-I', '-B', 'synthetic.py'], exit=1,
                       expectedExit=0, bytes=9, sha256=m.digest(b'synthetic'), log=str(other))
            (workspace/'logs/receipts.json').write_text(json.dumps([row]))
            raw = ('R44_HISTORICAL_WORKSPACE '+str(workspace)+'\n').encode()
            with self.assertRaisesRegex(ValueError, 'C45H_CHILD_LOG_PATH'):
                m.failure_stage(raw, workspace)

    def test_retry_limit_rejects_unbounded_and_boolean_inputs_before_any_execution(self):
        for value in (0, 4, -1, True, None, '3'):
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, 'C45H_ATTEMPT_LIMIT'):
                m.replay(Path.cwd(), Path.cwd(), value)

    def test_native_failed_child_is_immutably_copied_and_reported_without_executing_receipt_command(self):
        with native_failed_stage() as value:
            marker = value.base/'must-not-execute'
            forged = dict(value.child, command=[sys.executable, '-c',
                'from pathlib import Path;Path('+repr(str(marker))+').write_text("unsafe")'])
            (value.workspace/'logs/receipts.json').write_text(json.dumps([forged]))
            preserved = m.preserve_failed_stage(value.row, value.fixture, value.attempt)
            self.assertEqual(preserved['status'], 'VERIFIED_FAILED_STAGE_RETAINED')
            self.assertEqual(m.regular(value.attempt/'failed-stage.log'), m.verify_receipt(value.child))
            self.assertEqual(preserved['selectedSource']['head'], m.git(value.source, 'rev-parse', 'HEAD').decode().strip())
            with patch.object(m, 'run_command', side_effect=AssertionError('must not execute receipt-provided code')):
                diagnosis = m.diagnose(preserved['originalStage'], value.fixture, value.attempt, dict(os.environ))
            self.assertEqual(diagnosis['classification'], 'SEMANTIC_OR_UNBOUNDED_DIAGNOSTIC_NOT_RETRIED')
            self.assertFalse(marker.exists())
            stream = io.StringIO()
            metadata = m.report_replay_failure(value.result, value.evidence, stream)
            reported = json.loads(stream.getvalue())
            self.assertEqual(reported['result'], value.result)
            self.assertEqual(metadata['logs'], 3)
            self.assertIn('C45_OWNED_NATIVE_FAILURE', stream.getvalue())
            self.assertTrue(all(log['tailBytes'] <= 65536 for log in reported['logs']))
            self.assertEqual(m.preserve_failed_stage(value.row, value.fixture, value.attempt), preserved)

    def test_semantic_failed_child_keeps_diagnosis_before_stop_and_never_executes_a_diagnostic(self):
        with native_failed_stage('{"error":"R41_PARENT_TREE"}') as value:
            preserved = m.preserve_failed_stage(value.row, value.fixture, value.attempt)
            with patch.object(m, 'run_command', side_effect=AssertionError('semantic refusal cannot run diagnostic')):
                diagnosis = m.diagnose(preserved['originalStage'], value.fixture, value.attempt, dict(os.environ))
            self.assertEqual(diagnosis['classification'], 'ORIGINAL_SEMANTIC_OR_CUSTODY_REFUSAL_NO_RETRY')
            self.assertEqual(diagnosis['refusal'], 'R41_PARENT_TREE')
            self.assertEqual(m.document(m.regular(value.attempt/'diagnosis.json')), diagnosis)
            self.assertTrue((value.attempt/'diagnosis-receipt.json').is_file())
            self.assertFalse((value.attempt/'diagnostic.log').exists())

    def test_no_recorded_stage_preserves_actual_full_normal_failure_and_unknown_diagnosis(self):
        with native_failed_stage(recorded_stage=False) as value:
            before = m.regular(Path(value.row['log']))
            preserved = m.preserve_failed_stage(value.row, value.fixture, value.attempt)
            self.assertEqual((preserved['status'], preserved['cause']), ('NO_RECORDED_FAILED_STAGE', 'UNKNOWN'))
            diagnosis = m.diagnose(None, value.fixture, value.attempt, dict(os.environ))
            self.assertEqual(diagnosis['classification'], 'UNCLASSIFIED_NO_RECORDED_STAGE')
            self.assertFalse((value.attempt/'failed-stage.log').exists())
            stream = io.StringIO()
            self.assertEqual(m.report_replay_failure(value.result, value.evidence, stream)['logs'], 2)
            self.assertEqual(m.regular(Path(value.row['log'])), before)
            self.assertIn('SYNTHETIC_NORMAL_INVOCATION_FAILURE', stream.getvalue())

    def test_failure_evidence_bad_hash_child_path_and_normal_path_refuse_without_copy(self):
        for change in ('normal-hash', 'normal-path', 'child-hash', 'child-path'):
            with self.subTest(change=change), native_failed_stage() as value:
                row = dict(value.row)
                if change == 'normal-hash':
                    row['sha256'] = '0'*64
                elif change == 'normal-path':
                    row['log'] = str(value.base/'unowned.log')
                else:
                    child = dict(value.child)
                    child['sha256' if change == 'child-hash' else 'log'] = '0'*64 if change == 'child-hash' else str(value.base/'other.log')
                    (value.workspace/'logs/receipts.json').write_text(json.dumps([child]))
                with self.assertRaises(ValueError):
                    m.preserve_failed_stage(row, value.fixture, value.attempt)
                self.assertFalse((value.attempt/'failed-stage.log').exists())
                self.assertFalse((value.attempt/'failed-stage.json').exists())

    def test_failure_evidence_rejects_linked_oversized_and_changed_destination_native_files(self):
        for change in ('linked', 'oversized', 'changed-copy'):
            with self.subTest(change=change), native_failed_stage() as value:
                if change == 'linked':
                    os.link(value.child['log'], value.base/'linked-child.log')
                elif change == 'oversized':
                    Path(value.child['log']).write_bytes(b'X'*(8*1024*1024+1))
                else:
                    m.preserve_failed_stage(value.row, value.fixture, value.attempt)
                    (value.attempt/'failed-stage.log').write_bytes(b'changed')
                with self.assertRaises(ValueError):
                    m.preserve_failed_stage(value.row, value.fixture, value.attempt)
                if change == 'changed-copy':
                    self.assertEqual((value.attempt/'failed-stage.log').read_bytes(), b'changed')

    def test_regular_growth_is_bounded_before_allocating_the_changed_file(self):
        with tempfile.TemporaryDirectory(prefix='c45-bounded-failure-read-') as directory:
            path = Path(directory)/'log'
            path.write_bytes(b'original')
            actual = Path.lstat
            grown = []
            def lstat(target):
                value = actual(target)
                if target == path and not grown:
                    grown.append(True)
                    path.write_bytes(b'G'*200)
                return value
            with patch.object(Path, 'lstat', lstat), self.assertRaisesRegex(ValueError, 'C45H_REGULAR_LIMIT'):
                m.regular(path, 8)

    def test_report_refuses_changed_child_or_diagnosis_hash_before_writing_any_tail(self):
        for changed in ('failed-stage.log', 'diagnosis.json'):
            with self.subTest(changed=changed), native_failed_stage() as value:
                m.preserve_failed_stage(value.row, value.fixture, value.attempt)
                m.diagnose(None, value.fixture, value.attempt, dict(os.environ))
                path = value.attempt/changed
                path.write_bytes(path.read_bytes()+b' ')
                stream = io.StringIO()
                with self.assertRaisesRegex(ValueError, 'C45H_FAILURE_REPORT_'):
                    m.report_replay_failure(value.result, value.evidence, stream)
                self.assertEqual(stream.getvalue(), '')

    def test_report_rejects_arbitrary_normal_path_without_reading_it(self):
        with native_failed_stage() as value:
            row = dict(value.row, log=str(value.base/'private-unowned-file'))
            result = dict(value.result, attempts=[row])
            with patch.object(m, 'regular', side_effect=AssertionError('unowned path must never be read')):
                with self.assertRaisesRegex(ValueError, 'C45H_FAILURE_REPORT_LOG_PATH'):
                    m.report_replay_failure(result, value.evidence, io.StringIO())

    def test_report_caps_each_tail_total_bytes_and_retains_all_native_full_logs(self):
        with native_failed_stage(padding=200000) as value:
            attempts = []
            full = {}
            for number in range(1, 4):
                directory = value.evidence/('attempt-'+str(number))
                directory.mkdir(exist_ok=True)
                row = value.row if number == 1 else m.run_command(value.command, value.fixture,
                    dict(os.environ), directory/'normal-full-invocation.log')
                row.update(head=m.BASE, tree=m.TREE)
                attempts.append(row)
                m.preserve_failed_stage(row, value.fixture, directory)
                m.persist_diagnosis(value.fixture, directory, dict(classification='SYNTHETIC_BUDGET_CONTROL',
                    padding='D'*200000))
                for name in ('normal-full-invocation.log', 'failed-stage.log', 'diagnosis.json'):
                    path = directory/name
                    full[path] = m.digest(m.regular(path))
            stream = io.StringIO()
            result = dict(value.result, attempts=attempts)
            metadata = m.report_replay_failure(result, value.evidence, stream)
            raw = stream.getvalue().encode('ascii')
            self.assertLessEqual(len(raw), 512*1024)
            self.assertEqual(metadata['logs'], 9)
            logs = json.loads(raw)['logs']
            self.assertTrue(all(log['tailBytes'] <= 65536 for log in logs))
            self.assertTrue(any(log['tailBytes'] < 65536 for log in logs))
            self.assertTrue(all(m.digest(m.regular(path)) == expected for path, expected in full.items()))

    def test_report_refuses_oversized_result_metadata_without_partial_output(self):
        with native_failed_stage() as value:
            result = dict(value.result, oversized='M'*(512*1024))
            stream = io.StringIO()
            with self.assertRaisesRegex(ValueError, 'C45H_FAILURE_REPORT_TOTAL_LIMIT'):
                m.report_replay_failure(result, value.evidence, stream)
            self.assertEqual(stream.getvalue(), '')

    def test_report_includes_actual_owned_diagnostic_raw_tail_and_refuses_its_changed_receipt(self):
        with native_failed_stage() as value:
            m.preserve_failed_stage(value.row, value.fixture, value.attempt)
            diagnostic = m.run_command([sys.executable, '-I', '-B', '-c',
                'print("ACTUAL_OWNED_DIAGNOSTIC_FAILURE");raise SystemExit(3)'], value.source,
                dict(os.environ), value.attempt/'diagnostic.log')
            m.persist_diagnosis(value.fixture, value.attempt, dict(classification='SYNTHETIC_DIAGNOSTIC_CONTROL',
                diagnostic=diagnostic))
            stream = io.StringIO()
            self.assertEqual(m.report_replay_failure(value.result, value.evidence, stream)['logs'], 4)
            self.assertIn('ACTUAL_OWNED_DIAGNOSTIC_FAILURE', stream.getvalue())
            Path(diagnostic['log']).write_bytes(b'changed')
            with self.assertRaisesRegex(ValueError, 'C45H_LOG_CHANGED'):
                m.report_replay_failure(value.result, value.evidence, io.StringIO())


class NativeSupervisorControls(unittest.TestCase):
    def wait_for(self, predicate, seconds=3):
        deadline = time.monotonic()+seconds
        while not predicate():
            self.assertLess(time.monotonic(), deadline, 'controlled native handshake deadline')
            time.sleep(0.01)

    @contextmanager
    def windows_process_handle(self, pid):
        import ctypes
        from ctypes import wintypes
        self.assertEqual(os.name, 'nt', 'this is an actual Windows native control')
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel.OpenProcess.restype = wintypes.HANDLE
        kernel.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
        kernel.WaitForSingleObject.restype = wintypes.DWORD
        kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        handle = kernel.OpenProcess(0x00100000, False, pid)
        self.assertTrue(handle, 'pin the actual live native process before its original command finishes')
        try:
            yield lambda: kernel.WaitForSingleObject(handle, 1000) == 0
        finally:
            kernel.CloseHandle(handle)

    def windows_new_group_tree(self, root, exit_code=0, timeout=False, double=False):
        marker, release = root/'child.pid', root/'release'
        grandchild = ('import os,time;from pathlib import Path;Path('+repr(str(marker))+')'
                      '.write_text(str(os.getpid()));time.sleep(30)')
        launch = ('import subprocess,sys;subprocess.Popen([sys.executable,"-I","-B","-c",'+
                  repr(grandchild)+'],creationflags=512)')
        if double:
            launch = ('import subprocess,sys;subprocess.run([sys.executable,"-I","-B","-c",'+
                      repr(launch)+'],creationflags=512,check=True)')
        child = (launch+'\nimport time;from pathlib import Path;p=Path('+repr(str(release))+');deadline=time.monotonic()+10\n'
                 'while not p.exists() and time.monotonic()<deadline:time.sleep(.01)\n'
                 'assert p.exists()\n'+('time.sleep(30)' if timeout else 'raise SystemExit('+str(exit_code)+')'))
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(m.run_command, [sys.executable, '-I', '-B', '-c', child], root,
                                 dict(os.environ), root/'native.log', 0, 2 if timeout else 5)
            self.wait_for(marker.exists)
            with self.windows_process_handle(int(marker.read_text())) as terminal:
                release.write_bytes(b'controlled parent release\n')
                row = future.result(timeout=15)
                self.assertTrue(terminal(), 'Windows Job must contain descendants across new process groups')
            self.assertEqual(row['timedOut'], timeout)
            self.assertTrue(row['descendantsDrained'])
            self.assertEqual(row['processControl'], 'WINDOWS_OWNED_JOB')
            self.assertEqual(row['exit'], exit_code) if not timeout else self.assertNotEqual(row['exit'], 0)
            self.assertNotIn('nativeObservation', row)
            return row

    def actual_parent_abort(self, abrupt):
        import signal
        with tempfile.TemporaryDirectory(prefix='c45-native-parent-abort-') as directory:
            root = Path(directory).resolve()
            marker, release = root/'grandchild.pid', root/'abort'
            grandchild = ('import os,time;from pathlib import Path;Path('+repr(str(marker))+')'
                          '.write_text(str(os.getpid()));time.sleep(30)')
            option = 'start_new_session=True' if sys.platform == 'linux' else 'creationflags=512'
            child = ('import subprocess,sys,time;subprocess.Popen([sys.executable,"-I","-B","-c",'+
                     repr(grandchild)+'],'+option+');time.sleep(30)')
            worker = ('import importlib.util,os,sys,threading,time;from pathlib import Path;'
                      'p='+repr(str(Path(m.__file__).resolve()))+';'
                      's=importlib.util.spec_from_file_location("actual_native_worker",p);'
                      'm=importlib.util.module_from_spec(s);s.loader.exec_module(m)\n')
            if os.name == 'nt' and not abrupt:
                worker += ('def abort():\n'
                           ' p=Path('+repr(str(release))+');deadline=time.monotonic()+15\n'
                           ' while not p.exists() and time.monotonic()<deadline:time.sleep(.01)\n'
                           ' os._exit(9)\nthreading.Thread(target=abort,daemon=True).start()\n')
            worker += ('m.run_command([sys.executable,"-I","-B","-c",'+repr(child)+'],Path('+repr(str(root))+'),'
                       'dict(os.environ),Path('+repr(str(root/'command.log'))+'),timeout=20)\n'
                       'print("UNEXPECTED_CONTROL_COMPLETION")\n')
            descriptors, process = [], None
            with (root/'worker.log').open('wb') as output, ExitStack() as stack:
                try:
                    process = subprocess.Popen([sys.executable, '-I', '-B', '-c', worker], stdout=output,
                                               stderr=subprocess.STDOUT)
                    self.wait_for(marker.exists)
                    pid = int(marker.read_text())
                    if sys.platform == 'linux':
                        import select
                        children = m.linux_direct_children(process.pid)
                        self.assertEqual(len(children), 1, 'dedicated guardian is the worker only native child')
                        guardian_pid = children[0]
                        for owned_pid in (pid, guardian_pid):
                            descriptor = os.pidfd_open(owned_pid)
                            descriptors.append(descriptor)
                        pollers = []
                        for descriptor in descriptors:
                            poller = select.poll()
                            poller.register(descriptor, select.POLLIN)
                            pollers.append(poller)
                        terminal = lambda: bool(pollers[0].poll(1000))
                    else:
                        terminal = stack.enter_context(self.windows_process_handle(pid))
                    if abrupt:
                        process.kill()
                    elif sys.platform == 'linux':
                        process.send_signal(signal.SIGINT)
                    else:
                        release.write_bytes(b'actual parent exits abruptly without Python finally\n')
                    self.assertNotEqual(process.wait(timeout=15), 0)
                    self.assertTrue(terminal(), 'owned grandchild cannot survive its parent scope abort')
                    if sys.platform == 'linux':
                        self.assertTrue(pollers[1].poll(5000), 'guardian must drain before its own terminal state')
                        native = m.document(m.regular(root/'command.log.native.json'))
                        self.assertTrue(native['aborted'])
                        self.assertTrue(native['drain']['complete'])
                        self.assertIsNone(native['error'])
                        self.assertFalse(native['timedOut'])
                        self.assertLess(native['exit'], 0)
                    self.assertNotIn(b'UNEXPECTED_CONTROL_COMPLETION', (root/'worker.log').read_bytes())
                finally:
                    if process is not None and process.poll() is None:
                        process.kill()
                        process.wait()
                    if sys.platform == 'linux':
                        for descriptor in reversed(descriptors):
                            try:
                                signal.pidfd_send_signal(descriptor, signal.SIGTERM)
                            except ProcessLookupError:
                                pass
                            os.close(descriptor)

    def test_actual_parent_interruption_drains_before_propagating_failure(self):
        self.actual_parent_abort(abrupt=False)

    def test_actual_parent_death_drains_without_fabricating_command_completion(self):
        self.actual_parent_abort(abrupt=True)

    def test_native_schedule_inputs_are_finite_bounded_and_explicit(self):
        with tempfile.TemporaryDirectory(prefix='c45-schedule-schema-') as directory:
            root = Path(directory)
            for timeout in (0, -1, True, float('inf'), float('nan'), 21601):
                with self.subTest(timeout=timeout), self.assertRaisesRegex(ValueError, 'NATIVE_SCHEDULE_SCHEMA'):
                    m.run_command([sys.executable], root, dict(os.environ), root/'absent.log', timeout=timeout)
            for single_cpu in (None, 1, 'true'):
                with self.subTest(single_cpu=single_cpu), self.assertRaisesRegex(ValueError, 'NATIVE_SCHEDULE_SCHEMA'):
                    m.run_command([sys.executable], root, dict(os.environ), root/'absent.log', single_cpu=single_cpu)
            self.assertEqual(list(root.iterdir()), [])

    def test_actual_setsid_grandchild_cannot_survive_timeout_or_falsely_drained_receipt(self):
        if sys.platform != 'linux':
            with tempfile.TemporaryDirectory(prefix='c45-windows-newgroup-') as directory:
                self.windows_new_group_tree(Path(directory).resolve(), timeout=True)
            return
        import select
        with tempfile.TemporaryDirectory(prefix='c45-native-setsid-') as directory:
            root = Path(directory).resolve()
            marker = root/'escaped.json'
            grandchild = ('import os,json,time;from pathlib import Path;Path('+repr(str(marker))+')'
                '.write_text(json.dumps(dict(pid=os.getpid(),group=os.getpgrp(),session=os.getsid(0))));time.sleep(30)')
            child = ('import subprocess,sys,time;subprocess.Popen([sys.executable,"-I","-B","-c",'+
                     repr(grandchild)+'],start_new_session=True);time.sleep(30)')
            with ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(m.run_command, [sys.executable, '-I', '-B', '-c', child],
                                     root, dict(os.environ), root/'timeout.log', 0, 2)
                self.wait_for(marker.exists)
                identity = json.loads(marker.read_text())
                self.assertEqual(identity['pid'], identity['group'])
                self.assertEqual(identity['pid'], identity['session'])
                descriptor = os.pidfd_open(identity['pid'])
                try:
                    row = future.result(timeout=15)
                    poller = select.poll()
                    poller.register(descriptor, select.POLLIN)
                    self.assertTrue(poller.poll(1000), 'exact escaped native process must be terminal')
                    self.assertTrue(row['timedOut'])
                    self.assertNotEqual(row['exit'], 0)
                    self.assertTrue(row['descendantsDrained'])
                    self.assertEqual(row['processControl'], 'LINUX_EXCLUSIVE_SUBREAPER')
                    native = m.document(m.regular(Path(row['nativeObservation']['path'])))
                    self.assertTrue(native['drain']['complete'])
                    self.assertIn(identity['pid'], [item['pid'] for item in native['drain']['terminated']])
                finally:
                    os.close(descriptor)

    def test_actual_doublefork_is_reaped_after_natural_exit_preserving_zero_and_failure(self):
        if sys.platform != 'linux':
            for exit_code in (0, 7):
                with self.subTest(exit=exit_code), tempfile.TemporaryDirectory(prefix='c45-windows-double-') as directory:
                    self.windows_new_group_tree(Path(directory).resolve(), exit_code=exit_code, double=True)
            return
        for exit_code in (0, 7):
            with self.subTest(exit=exit_code), tempfile.TemporaryDirectory(prefix='c45-native-doublefork-') as directory:
                root = Path(directory).resolve()
                marker = root/'adopted.pid'
                grandchild = ('import os,time;from pathlib import Path;Path('+repr(str(marker))+')'
                              '.write_text(str(os.getpid()));time.sleep(30)')
                intermediate = ('import subprocess,sys;subprocess.Popen([sys.executable,"-I","-B","-c",'+
                                repr(grandchild)+'],start_new_session=True)')
                child = ('import subprocess,sys,time;from pathlib import Path;subprocess.run([sys.executable,"-I","-B","-c",'+
                    repr(intermediate)+'],check=True);p=Path('+repr(str(marker))+');deadline=time.monotonic()+3\n'
                    'while not p.exists() and time.monotonic()<deadline:time.sleep(.01)\n'
                    'assert p.exists();print("ACTUAL_NATIVE_ORIGINAL_EXIT");raise SystemExit('+str(exit_code)+')')
                row = m.run_command([sys.executable, '-I', '-B', '-c', child], root, dict(os.environ),
                                    root/'natural.log', timeout=5)
                self.assertEqual((row['exit'], row['timedOut']), (exit_code, False))
                self.assertIn(b'ACTUAL_NATIVE_ORIGINAL_EXIT', m.verify_receipt(row))
                self.assertIsNone(m.linux_process_identity(int(marker.read_text())), 'adopted grandchild is reaped')
                native = m.document(m.regular(Path(row['nativeObservation']['path'])))
                self.assertGreaterEqual(native['drain']['reaped'], 1)
                self.assertTrue(native['drain']['complete'])

    def test_live_support_child_and_unrelated_owned_process_are_not_terminated(self):
        with tempfile.TemporaryDirectory(prefix='c45-native-exclusive-') as directory:
            root = Path(directory).resolve()
            support, probe, witnessed, release = [root/name for name in ('support.pid', 'probe', 'witness', 'release')]
            grandchild = ('import os,time;from pathlib import Path;root=Path('+repr(str(root))+');'
                '(root/"support.pid").write_text(str(os.getpid()));deadline=time.monotonic()+15\n'
                'while time.monotonic()<deadline:\n'
                ' if (root/"probe").exists():(root/"witness").write_text("live original command still owns support child")\n'
                ' time.sleep(.01)')
            launch_option = 'start_new_session=True' if sys.platform == 'linux' else 'creationflags=512'
            child = ('import subprocess,sys,time;from pathlib import Path;subprocess.Popen([sys.executable,"-I","-B","-c",'+
                repr(grandchild)+'],'+launch_option+');p=Path('+repr(str(release))+');deadline=time.monotonic()+10\n'
                'while not p.exists() and time.monotonic()<deadline:time.sleep(.01)\nassert p.exists()')
            outsider = subprocess.Popen([sys.executable, '-I', '-B', '-c', 'import time;time.sleep(30)'])
            try:
                with ThreadPoolExecutor(max_workers=1) as pool:
                    future = pool.submit(m.run_command, [sys.executable, '-I', '-B', '-c', child],
                                         root, dict(os.environ), root/'live.log', 0, 8)
                    with ExitStack() as stack:
                        try:
                            self.wait_for(support.exists)
                            terminal = stack.enter_context(self.windows_process_handle(int(support.read_text()))) if os.name == 'nt' else None
                            self.assertFalse(future.done())
                            probe.write_bytes(b'controlled support operation\n')
                            self.wait_for(witnessed.exists)
                            self.assertIsNone(outsider.poll())
                        finally:
                            release.write_bytes(b'original command may now finish\n')
                        row = future.result(timeout=15)
                        if terminal is not None:
                            self.assertTrue(terminal())
                    self.assertEqual((row['exit'], row['timedOut']), (0, False))
                    self.assertIsNone(outsider.poll(), 'dedicated guardian must not adopt or kill caller siblings')
                    if sys.platform == 'linux':
                        self.assertIsNone(m.linux_process_identity(int(support.read_text())))
                    else:
                        self.assertEqual(row['processControl'], 'WINDOWS_OWNED_JOB')
            finally:
                if outsider.poll() is None:
                    outsider.kill()
                outsider.wait()

    def test_single_cpu_is_inherited_by_original_and_descendant_without_changing_caller(self):
        if sys.platform != 'linux':
            with tempfile.TemporaryDirectory(prefix='c45-windows-schedule-') as directory:
                root = Path(directory).resolve()
                with self.assertRaisesRegex(ValueError, 'SUPPORTED_NATIVE_CONTAINMENT'):
                    m.run_command([sys.executable], root, dict(os.environ), root/'unsupported.log', single_cpu=True)
                self.assertFalse((root/'unsupported.log').exists())
                self.windows_new_group_tree(root)
            return
        with tempfile.TemporaryDirectory(prefix='c45-native-affinity-') as directory:
            root = Path(directory).resolve()
            before = os.sched_getaffinity(0)
            grandchild = 'import os,json;print(json.dumps(sorted(os.sched_getaffinity(0))))'
            child = ('import os,json,subprocess,sys;print(json.dumps(dict(original=sorted(os.sched_getaffinity(0)),'
                     'descendant=json.loads(subprocess.check_output([sys.executable,"-I","-B","-c",'+repr(grandchild)+'])))))')
            row = m.run_command([sys.executable, '-I', '-B', '-c', child], root, dict(os.environ),
                                root/'affinity.log', single_cpu=True)
            observed = json.loads(m.verify_receipt(row))
            self.assertEqual(len(observed['original']), 1)
            self.assertEqual(observed['original'], observed['descendant'])
            native = m.document(m.regular(Path(row['nativeObservation']['path'])))
            self.assertTrue(native['scheduling']['singleCpuRequested'])
            self.assertEqual(native['scheduling']['selectedCPUs'], observed['original'])
            self.assertEqual(native['scheduling']['originalObservedCPUs'], observed['original'])
            self.assertEqual(os.sched_getaffinity(0), before)
            self.assertEqual((row['exit'], row['timedOut']), (0, False))

    def test_native_observations_are_bounded_and_do_not_record_arguments_or_environment(self):
        if sys.platform != 'linux':
            with tempfile.TemporaryDirectory(prefix='c45-windows-observation-') as directory:
                root = Path(directory).resolve()
                row = m.run_command([sys.executable, '-I', '-B', '-c', 'raise SystemExit(3)'],
                                    root, dict(os.environ), root/'observation.log')
                self.assertEqual((row['exit'], row['timedOut']), (3, False))
                self.assertEqual(row['processControl'], 'WINDOWS_OWNED_JOB')
                self.assertTrue(row['descendantsDrained'])
                self.assertNotIn('nativeObservation', row, 'Windows receipt must not claim Linux observations')
                self.assertEqual(list(root.glob('*.native.json')), [])
            return
        with tempfile.TemporaryDirectory(prefix='c45-native-observe-') as directory:
            root = Path(directory).resolve()
            private = 'SYNTHETIC_PRIVATE_ARG_AND_ENV_NOT_OBSERVATION_DATA'
            environment = dict(os.environ, C45_SYNTHETIC_PRIVATE=private)
            row = m.run_command([sys.executable, '-I', '-B', '-c', 'import time;time.sleep(.05)', private],
                                root, environment, root/'observation.log')
            raw = m.regular(Path(row['nativeObservation']['path']))
            native = m.document(raw)
            self.assertLessEqual(len(raw), 512*1024)
            self.assertNotIn(private.encode(), raw)
            self.assertTrue(native['samples'])
            self.assertLessEqual(len(native['samples']), 16)
            for sample in native['samples']:
                self.assertLessEqual(len(sample['processes']), 128)
                for process in sample['processes']:
                    self.assertNotIn('command', process)
                    self.assertNotIn('environment', process)
                    self.assertIs(type(process['startTicks']), int)
                    self.assertIs(type(process['userTicks']), int)


if __name__ == '__main__':
    unittest.main()
