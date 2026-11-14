"""Synthetic local controls for the proposed preparation policy; not native proof."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import unittest
from unittest.mock import patch

path = Path(__file__).with_name('observer_probe16.py')
spec = importlib.util.spec_from_file_location('observer_probe16', path)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
REAL_RUN = subprocess.run
CMD = ['/bin/ps', '-axo', 'pid=,lstart=,comm=']


def state():
    return {'phase': 'PREPARATION', 'invalid': None, 'armed': False, 'checkpoints': []}


def result(code=0, stdout=b'', stderr=b''):
    return subprocess.CompletedProcess(CMD, code, stdout, stderr)


class ProbeTests(unittest.TestCase):
    def call(self, s=None, deadline=None, op='RUNNER_PROCESS_DISCOVERY', argv=None):
        return m.run_preparation_probe16(state() if s is None else s, op,
            CMD if argv is None else argv, os.environ.copy(),
            time.monotonic_ns() + 20_000_000_000 if deadline is None else deadline)

    def test_success_is_not_identity_or_ready_admission(self):
        s = state()
        with patch.object(m, '_bounded_run', return_value=result(stdout=b'private contents')):
            self.assertEqual(self.call(s).stdout, b'private contents')
        self.assertFalse(s['armed'])
        self.assertEqual(s['checkpoints'], [])
        self.assertEqual(s['preparation_probes16'][0]['status'], 'COMPLETED_NOT_IDENTITY_ACCEPTED')
        self.assertNotIn('private contents', json.dumps({k: v for k, v in s.items() if not k.startswith('_')}))

    def test_preparation_cap_not_active_ack_cap(self):
        with patch.object(m, '_bounded_run', return_value=result()) as run:
            self.call()
        self.assertEqual(run.call_args.kwargs['timeout'], 15)

    def test_remaining_ui_budget_wins(self):
        with patch.object(m, '_bounded_run', return_value=result()) as run:
            self.call(deadline=time.monotonic_ns() + 200_000_000)
        self.assertGreater(run.call_args.kwargs['timeout'], 0)
        self.assertLessEqual(run.call_args.kwargs['timeout'], .2)

    def test_invalid_phase_or_terminal_never_spawns(self):
        variants = [dict(state(), phase='ACTIVE'), dict(state(), armed=True),
                    dict(state(), checkpoints=[1]), dict(state(), invalid={'code': 'failure'}),
                    dict(state(), first_preparation_failure16={}), {}]
        with patch.object(m, '_bounded_run') as run:
            for s in variants:
                with self.subTest(s=s), self.assertRaises(ValueError):
                    self.call(s)
            run.assert_not_called()

    def test_expired_or_malformed_deadline_never_spawns(self):
        with patch.object(m, '_bounded_run') as run:
            for end in [0, -1, True, 2.0, time.monotonic_ns() - 1]:
                with self.subTest(end=end), self.assertRaises(ValueError):
                    self.call(deadline=end)
            run.assert_not_called()

    def test_command_shape_and_operation_are_closed(self):
        with patch.object(m, '_bounded_run') as run:
            for op, cmd in [('UNKNOWN', CMD), ('RUNNER_PROCESS_DISCOVERY', CMD + ['secret']),
                            ('RUNNER_PROCESS_DISCOVERY', 'shell command'),
                            ('RUNNER_DATA_CONTAINER', ['xcrun','simctl','get_app_container','bad','other','data'])]:
                with self.subTest(op=op, cmd=cmd), self.assertRaises(ValueError):
                    self.call(op=op, argv=cmd)
            run.assert_not_called()

    def test_correct_container_command_is_preserved_without_identifiers_in_record(self):
        device = '00000000-0000-4000-8000-000000000001'
        cmd = ['xcrun', 'simctl', 'get_app_container', device, m.RUNNER_BUNDLE, 'data']
        s = state()
        with patch.object(m, '_bounded_run', return_value=result()) as run:
            self.call(s, op='RUNNER_DATA_CONTAINER', argv=cmd)
            self.assertEqual(run.call_args.args[0], cmd)
        self.assertNotIn(device, json.dumps({k: v for k, v in s.items() if not k.startswith('_')}))

    def test_timeout_retains_actual_static_operation_not_arguments(self):
        s = state()
        e = subprocess.TimeoutExpired(CMD, 3, output=b'private-pid-and-path', stderr=b'secret')
        with patch.object(m, '_bounded_run', side_effect=e), self.assertRaises(subprocess.TimeoutExpired) as caught:
            self.call(s)
        self.assertIs(caught.exception, e)
        row = s['first_preparation_failure16']
        self.assertEqual(row['operation'], 'RUNNER_PROCESS_DISCOVERY')
        self.assertEqual(row['status'], 'TIMEOUT')
        self.assertEqual(row['stdout_bytes'], len(e.output))
        for word in ['private-pid', 'secret', '/bin/ps']:
            self.assertNotIn(word, json.dumps({k: v for k, v in s.items() if not k.startswith('_')}))

    def test_failure_is_terminal_and_first_failure_immutable(self):
        s = state()
        with patch.object(m, '_bounded_run', return_value=result(code=1)):
            with self.assertRaises(ValueError):
                self.call(s)
        first = dict(s['first_preparation_failure16'])
        with patch.object(m, '_bounded_run') as run, self.assertRaises(ValueError):
            self.call(s)
        run.assert_not_called()
        self.assertEqual(first, s['first_preparation_failure16'])

    def test_late_success_is_refused(self):
        s = state()
        ticks = iter([100, 100 + 15_000_000_001, 100 + 15_000_000_002])
        with patch.object(m.time, 'monotonic_ns', side_effect=lambda: next(ticks)), \
             patch.object(m, '_bounded_run', return_value=result()), self.assertRaises(ValueError):
            self.call(s, deadline=100 + 20_000_000_000)
        self.assertEqual(s['first_preparation_failure16']['status'], 'FAILED')

    def test_concurrent_invalidation_cannot_return_success(self):
        s = state()
        def invalidate(*args, **kwargs):
            s['invalid'] = {'code': 'OTHER_OBSERVER_FAILED'}
            return result()
        with patch.object(m, '_bounded_run', side_effect=invalidate), self.assertRaises(ValueError):
            self.call(s)

    def test_output_overflow_is_refused(self):
        with patch.object(m, '_bounded_run', return_value=result(stdout=b'x'*(m.MAX_OUTPUT_BYTES+1))), \
             self.assertRaises(ValueError):
            self.call()

    def test_records_are_bounded_and_have_timing(self):
        s = state()
        with patch.object(m, '_bounded_run', return_value=result()):
            for _ in range(20):
                self.call(s)
        self.assertEqual(len(s['preparation_probes16']), 8)
        self.assertEqual(s['preparation_probes16_evicted'], 12)
        self.assertTrue(all(r['elapsed_ns'] >= 0 for r in s['preparation_probes16']))

    def test_real_child_can_finish_after_old_three_second_preparation_limit(self):
        # Substitute only the OS implementation, not our deadlines or exception path.
        child = [sys.executable, '-c', 'import time; time.sleep(3.15); print("ready")']
        with self.assertRaises(subprocess.TimeoutExpired):
            REAL_RUN(child, capture_output=True, timeout=3)
        def owned_child(*args, **kwargs):
            return REAL_RUN(child, **kwargs)
        s = state()
        with patch.object(m, '_bounded_run', side_effect=owned_child):
            self.assertEqual(self.call(s, deadline=time.monotonic_ns()+6_000_000_000).stdout.strip(), b'ready')
        self.assertFalse(s['armed'])

    def test_real_child_timeout_stays_timeout(self):
        child = [sys.executable, '-c', 'import time; time.sleep(2)']
        def owned_child(*args, **kwargs):
            return REAL_RUN(child, **kwargs)
        s = state()
        with patch.object(m, '_bounded_run', side_effect=owned_child), self.assertRaises(subprocess.TimeoutExpired):
            self.call(s, deadline=time.monotonic_ns()+100_000_000)
        self.assertEqual(s['first_preparation_failure16']['status'], 'TIMEOUT')


class BoundedCaptureTests(unittest.TestCase):
    def child(self, source, timeout=3):
        return m._bounded_run([sys.executable, '-c', source],
                              capture_output=True, env=os.environ.copy(), timeout=timeout)

    def test_both_real_pipes_complete_within_combined_bound(self):
        result = self.child('import sys; sys.stdout.buffer.write(b"o"*60000); '
                            'sys.stderr.buffer.write(b"e"*60000)')
        self.assertEqual(result.stdout, b'o'*60000)
        self.assertEqual(result.stderr, b'e'*60000)
        self.assertEqual(result.returncode, 0)

    def test_real_overflow_stops_child_before_later_side_effect(self):
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory(prefix='c16-bound-') as directory:
            marker = Path(directory) / 'later-marker'
            source = ('import pathlib,sys,time; sys.stdout.buffer.write(b"x"*1048577); '
                      'sys.stdout.flush(); time.sleep(.5); '
                      'pathlib.Path(' + repr(str(marker)) + ').write_text("finished")')
            with self.assertRaisesRegex(ValueError, 'OUTPUT_BOUND') as caught:
                self.child(source)
            self.assertFalse(marker.exists())
            self.assertTrue(caught.exception.capture_truncated)
            self.assertLessEqual(len(caught.exception.output)+len(caught.exception.stderr),
                                 m.MAX_OUTPUT_BYTES)

    def test_real_timeout_retains_partial_output_and_reaps_child(self):
        # Test collection after output exists, independently of interpreter startup.
        # The deliberate startup delay exceeds the OLD fixture's total 0.4s budget.
        # A separate test below covers a fresh child timing out before any output.
        import threading
        source = ('import os,sys,time; time.sleep(.6); '
                  'os.write(sys.stdout.fileno(), b"partial\\n"); '
                  'os.write(sys.stderr.fileno(), b"READY\\n"); time.sleep(30)')
        command = [sys.executable, '-c', source]
        process = subprocess.Popen(command, stdin=subprocess.DEVNULL,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   env=os.environ.copy())
        ready = threading.Event()
        observation = {}

        def await_ready():
            try:
                observation['token'] = process.stderr.read(6)
            except Exception as error:
                observation['error_type'] = type(error).__name__
            finally:
                ready.set()

        waiter = threading.Thread(target=await_ready, daemon=True)
        try:
            waiter.start()
            self.assertTrue(ready.wait(5), 'owned fixture did not become ready')
            waiter.join(timeout=1)
            self.assertFalse(waiter.is_alive())
            self.assertEqual(observation, {'token': b'READY\n'})
            self.assertIsNone(process.poll())
            # Only construction is substituted. Collection, deadline, kill and reap
            # use the actual implementation and this actual already-ready child.
            with patch.object(m.subprocess, 'Popen', return_value=process) as spawn:
                with self.assertRaises(subprocess.TimeoutExpired) as caught:
                    self.child(source, .4)
                spawn.assert_called_once()
                self.assertEqual(spawn.call_args.args[0], command)
            self.assertEqual(caught.exception.output.strip(), b'partial')
            self.assertFalse(caught.exception.capture_truncated)
            self.assertIsNotNone(process.poll(), 'timed-out child was not reaped')
        finally:
            if process.poll() is None:
                process.kill()
            process.wait(timeout=1)
            if waiter.ident is not None:
                waiter.join(timeout=1)
            for stream in (process.stdout, process.stderr):
                if not stream.closed:
                    stream.close()

    def test_real_timeout_before_output_retains_empty_prefix_and_reaps_child(self):
        # A timeout does not promise that the child ran far enough to emit data.
        processes = []
        real_popen = subprocess.Popen

        def capture_process(*args, **kwargs):
            child = real_popen(*args, **kwargs)
            processes.append(child)
            return child

        with patch.object(m.subprocess, 'Popen', side_effect=capture_process):
            with self.assertRaises(subprocess.TimeoutExpired) as caught:
                self.child('import time; time.sleep(5); print("too late", flush=True)', .4)
        self.assertEqual(caught.exception.output, b'')
        self.assertFalse(caught.exception.capture_truncated)
        self.assertEqual(len(processes), 1)
        self.assertIsNotNone(processes[0].poll(), 'timed-out child was not reaped')

    def test_failure_sink_receives_bounded_original_bytes_and_identity(self):
        import hashlib
        s = state()
        error = subprocess.TimeoutExpired(CMD, .2, output=b'private partial', stderr=b'os error')
        retained = []
        def retain(row, stdout, stderr):
            retained.append((row, stdout, stderr))
            return {'saved': True}
        with patch.object(m, '_bounded_run', side_effect=error), self.assertRaises(subprocess.TimeoutExpired):
            m.run_preparation_probe16(s, 'RUNNER_PROCESS_DISCOVERY', CMD, None,
                                     time.monotonic_ns()+1_000_000_000, retain)
        row, stdout, stderr = retained[0]
        self.assertEqual((stdout, stderr), (error.output, error.stderr))
        self.assertEqual(row['stdout_sha256'], hashlib.sha256(stdout).hexdigest())
        self.assertEqual(s['first_preparation_failure16']['retention'], {'saved': True})

    def test_overlapping_probe_never_spawns_and_does_not_release_another_probe(self):
        import threading
        s = state(); lock = threading.Lock(); lock.acquire()
        s['_preparation_probe16_lock'] = lock
        with patch.object(m, '_bounded_run') as run, self.assertRaisesRegex(ValueError, 'CONCURRENT_PROBE'):
            ProbeTests().call(s)
        run.assert_not_called()
        self.assertTrue(lock.locked())
        lock.release()

    def test_retention_failure_is_terminal_with_original_failure_preserved(self):
        s = state()
        def refused(*args):
            raise OSError('synthetic storage refusal')
        with patch.object(m, '_bounded_run', return_value=result(code=1)), self.assertRaises(OSError):
            m.run_preparation_probe16(s, 'RUNNER_PROCESS_DISCOVERY', CMD, None,
                                     time.monotonic_ns()+1_000_000_000, refused)
        self.assertEqual(s['first_preparation_failure16']['code'], 'C47_PREPARATION16_EXIT')
        self.assertEqual(s['first_preparation_failure16']['retention']['status'], 'FAILED')
        with patch.object(m, '_bounded_run') as run, self.assertRaises(ValueError):
            ProbeTests().call(s)
        run.assert_not_called()


if __name__ == '__main__':
    unittest.main(verbosity=2)
