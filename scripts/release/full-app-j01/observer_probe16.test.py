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
        with patch.object(m.subprocess, 'run', return_value=result(stdout=b'private contents')):
            self.assertEqual(self.call(s).stdout, b'private contents')
        self.assertFalse(s['armed'])
        self.assertEqual(s['checkpoints'], [])
        self.assertEqual(s['preparation_probes16'][0]['status'], 'COMPLETED_NOT_IDENTITY_ACCEPTED')
        self.assertNotIn('private contents', json.dumps(s))

    def test_preparation_cap_not_active_ack_cap(self):
        with patch.object(m.subprocess, 'run', return_value=result()) as run:
            self.call()
        self.assertEqual(run.call_args.kwargs['timeout'], 15)

    def test_remaining_ui_budget_wins(self):
        with patch.object(m.subprocess, 'run', return_value=result()) as run:
            self.call(deadline=time.monotonic_ns() + 200_000_000)
        self.assertGreater(run.call_args.kwargs['timeout'], 0)
        self.assertLessEqual(run.call_args.kwargs['timeout'], .2)

    def test_invalid_phase_or_terminal_never_spawns(self):
        variants = [dict(state(), phase='ACTIVE'), dict(state(), armed=True),
                    dict(state(), checkpoints=[1]), dict(state(), invalid={'code': 'failure'}),
                    dict(state(), first_preparation_failure16={}), {}]
        with patch.object(m.subprocess, 'run') as run:
            for s in variants:
                with self.subTest(s=s), self.assertRaises(ValueError):
                    self.call(s)
            run.assert_not_called()

    def test_expired_or_malformed_deadline_never_spawns(self):
        with patch.object(m.subprocess, 'run') as run:
            for end in [0, -1, True, 2.0, time.monotonic_ns() - 1]:
                with self.subTest(end=end), self.assertRaises(ValueError):
                    self.call(deadline=end)
            run.assert_not_called()

    def test_command_shape_and_operation_are_closed(self):
        with patch.object(m.subprocess, 'run') as run:
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
        with patch.object(m.subprocess, 'run', return_value=result()) as run:
            self.call(s, op='RUNNER_DATA_CONTAINER', argv=cmd)
            self.assertEqual(run.call_args.args[0], cmd)
        self.assertNotIn(device, json.dumps(s))

    def test_timeout_retains_actual_static_operation_not_arguments(self):
        s = state()
        e = subprocess.TimeoutExpired(CMD, 3, output=b'private-pid-and-path', stderr=b'secret')
        with patch.object(m.subprocess, 'run', side_effect=e), self.assertRaises(subprocess.TimeoutExpired) as caught:
            self.call(s)
        self.assertIs(caught.exception, e)
        row = s['first_preparation_failure16']
        self.assertEqual(row['operation'], 'RUNNER_PROCESS_DISCOVERY')
        self.assertEqual(row['status'], 'TIMEOUT')
        self.assertEqual(row['stdout_bytes'], len(e.output))
        for word in ['private-pid', 'secret', '/bin/ps']:
            self.assertNotIn(word, json.dumps(s))

    def test_failure_is_terminal_and_first_failure_immutable(self):
        s = state()
        with patch.object(m.subprocess, 'run', return_value=result(code=1)):
            with self.assertRaises(ValueError):
                self.call(s)
        first = dict(s['first_preparation_failure16'])
        with patch.object(m.subprocess, 'run') as run, self.assertRaises(ValueError):
            self.call(s)
        run.assert_not_called()
        self.assertEqual(first, s['first_preparation_failure16'])

    def test_late_success_is_refused(self):
        s = state()
        ticks = iter([100, 100 + 15_000_000_001, 100 + 15_000_000_002])
        with patch.object(m.time, 'monotonic_ns', side_effect=lambda: next(ticks)), \
             patch.object(m.subprocess, 'run', return_value=result()), self.assertRaises(ValueError):
            self.call(s, deadline=100 + 20_000_000_000)
        self.assertEqual(s['first_preparation_failure16']['status'], 'FAILED')

    def test_concurrent_invalidation_cannot_return_success(self):
        s = state()
        def invalidate(*args, **kwargs):
            s['invalid'] = {'code': 'OTHER_OBSERVER_FAILED'}
            return result()
        with patch.object(m.subprocess, 'run', side_effect=invalidate), self.assertRaises(ValueError):
            self.call(s)

    def test_output_overflow_is_refused(self):
        with patch.object(m.subprocess, 'run', return_value=result(stdout=b'x'*(m.MAX_OUTPUT_BYTES+1))), \
             self.assertRaises(ValueError):
            self.call()

    def test_records_are_bounded_and_have_timing(self):
        s = state()
        with patch.object(m.subprocess, 'run', return_value=result()):
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
        with patch.object(m.subprocess, 'run', side_effect=owned_child):
            self.assertEqual(self.call(s, deadline=time.monotonic_ns()+6_000_000_000).stdout.strip(), b'ready')
        self.assertFalse(s['armed'])

    def test_real_child_timeout_stays_timeout(self):
        child = [sys.executable, '-c', 'import time; time.sleep(2)']
        def owned_child(*args, **kwargs):
            return REAL_RUN(child, **kwargs)
        s = state()
        with patch.object(m.subprocess, 'run', side_effect=owned_child), self.assertRaises(subprocess.TimeoutExpired):
            self.call(s, deadline=time.monotonic_ns()+100_000_000)
        self.assertEqual(s['first_preparation_failure16']['status'], 'TIMEOUT')


if __name__ == '__main__':
    unittest.main(verbosity=2)
