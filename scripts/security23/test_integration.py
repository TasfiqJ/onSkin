"""Synthetic controls for warning-bearing and unstable public input refusal."""
import copy
import contextlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).absolute().parents[1]/'security22'))
import inventory
import run
from redact import Refusal, canonical

TOKEN = 'SYNTHETIC_INPUT_WARNING_PRIVATE_PATH_23'


def tool_fixture():
    cases = [dict(name=name, state='NOT_RUN', reason=run.TOOLCHAIN_NOT_RUN[name]) if name in run.TOOLCHAIN_NOT_RUN
        else dict(name=name, state='PASS') for name in sorted(run.TOOLCHAIN_CASES)]
    return dict(schema=1, qualification='SYNTHETIC_PINNED_MODEL_FILESYSTEM_CONTROLS_ONLY', state='PASS',
        tests=48, passed=48-len(run.TOOLCHAIN_NOT_RUN), failed=0, errors=0,
        notRun=len(run.TOOLCHAIN_NOT_RUN), platform=os.name, cases=cases, acceptanceGranted=False)


class Controls(unittest.TestCase):
    def test_git_warning_refuses_without_printing(self):
        captured = io.StringIO()
        with patch.object(inventory, 'execute', return_value=(0, b'partial inventory', TOKEN.encode())), \
             contextlib.redirect_stdout(captured), contextlib.redirect_stderr(captured):
            with self.assertRaisesRegex(Refusal, '^GIT_DIAGNOSTIC$'): inventory.git(Path.cwd(), 'ls-files')
        self.assertEqual(captured.getvalue(), '')

    def test_regular_complete_and_bound(self):
        with tempfile.TemporaryDirectory(prefix='security23-input-') as temporary:
            root = Path(temporary); (root/'public.txt').write_bytes(b'public fixture')
            self.assertEqual(inventory.regular(root, 'public.txt', 1024), b'public fixture')
            with self.assertRaises(Refusal): inventory.regular(root, 'public.txt', 4)

    def test_regular_open_replacement_refuses(self):
        with tempfile.TemporaryDirectory(prefix='security23-input-') as temporary:
            root = Path(temporary); path = root/'public.txt'; path.write_bytes(b'public fixture')
            original = os.open
            def replace(*args, **kwargs):
                path.rename(root/'saved.txt'); path.write_bytes(b'public fixture')
                return original(*args, **kwargs)
            with patch.object(inventory.os, 'open', side_effect=replace), self.assertRaises(Refusal):
                inventory.regular(root, 'public.txt', 1024)

    def test_regular_hardlink_refuses(self):
        with tempfile.TemporaryDirectory(prefix='security23-input-') as temporary:
            root = Path(temporary); path = root/'public.txt'; path.write_bytes(b'public fixture')
            os.link(path, root/'alias.txt')
            with self.assertRaises(Refusal): inventory.regular(root, 'public.txt', 1024)

    def test_tool_gate_malformed_and_omitted_controls_refuse(self):
        good = tool_fixture(); self.assertEqual(run.toolchain_gate_report(good, 0)['state'], 'PASS')
        variants = []
        for key, value in [('tests', True), ('failed', False), ('passed', 1.0), ('acceptanceGranted', 0)]:
            variant = copy.deepcopy(good); variant[key] = value; variants.append(variant)
        variant = copy.deepcopy(good); variant['cases'].pop(); variants.append(variant)
        variant = copy.deepcopy(good); variant['cases'][0]['name'] = TOKEN; variants.append(variant)
        for value in variants:
            with self.assertRaises(Refusal): run.toolchain_gate_report(value, 0)
        with self.assertRaises(Refusal): run.toolchain_gate_report(good, False)

    def test_tool_gate_preserves_fixed_failed_case(self):
        value = tool_fixture()
        failed = next(case for case in value['cases'] if case['state'] == 'PASS')
        failed['state'] = 'FAIL'; value.update(state='INCOMPLETE', failed=1, passed=value['passed']-1)
        result = run.toolchain_gate_report(value, 1)
        self.assertEqual(result['state'], 'INCOMPLETE')
        self.assertEqual(result['failedCases'], [failed['name']])
        self.assertNotIn(TOKEN, canonical(result).decode())


def main():
    result = unittest.TextTestRunner(stream=io.StringIO()).run(unittest.defaultTestLoader.loadTestsFromTestCase(Controls))
    print(json.dumps(dict(qualification='SYNTHETIC_PUBLIC_INPUT_CONTROLS_ONLY', testsRun=result.testsRun,
        failures=len(result.failures), errors=len(result.errors), skipped=len(result.skipped), passed=result.wasSuccessful()), sort_keys=True))
    return 0 if result.wasSuccessful() and not result.skipped else 1


if __name__ == '__main__': sys.exit(main())
