"""C45 orchestration controls. All synthetic receipts below are test fixtures only."""
import copy
from concurrent.futures import ThreadPoolExecutor
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('historical45', Path(__file__).with_name('historicalReplay45.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


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
            raw = b'{"valid":false,"error":"R44_PARENT_TREE"}\n'
            path = root/'semantic.log'
            path.write_bytes(raw)
            row = dict(command=[sys.executable, '-I', '-B', m.PREFIX+'main_integration44.py', '--historical'],
                       cwd=str(root), head=m.BASE, tree=m.TREE, exit=1, expectedExit=0,
                       timedOut=False, bytes=len(raw), sha256=m.digest(raw), log=str(path),
                       toolInputQualification='HASHED_BEFORE_AND_AFTER_ACTUAL_NORMAL_INVOCATION',
                       toolInputsBefore={'synthetic': 'metadata-test-only'},
                       toolInputsAfter={'synthetic': 'metadata-test-only'})
            self.assertEqual(m.original_refusal(row, root), 'R44_PARENT_TREE')
            diagnosis = m.diagnose(dict(root=str(root), row=row), root, root, dict(os.environ))
            self.assertEqual(diagnosis['classification'], 'ORIGINAL_SEMANTIC_OR_CUSTODY_REFUSAL_NO_RETRY')
            self.assertFalse((root/'diagnostic.log').exists())
            success = dict(row, exit=0)
            with self.assertRaisesRegex(ValueError, 'C45H_SEMANTIC_REFUSAL_RETRIED_WITHOUT_REPAIR'):
                m.verify_attempts(root, [row, success])
            evidence = base/'external-evidence'
            evidence.mkdir()
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


if __name__ == '__main__':
    unittest.main()
