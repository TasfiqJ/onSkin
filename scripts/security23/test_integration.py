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
from redact import Refusal, canonical, diagnostic, require

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
        for raw in (b'# tests true\n', b'# tests 100001\n# pass 100001\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n'):
            with patch.object(run, 'execute', return_value=(0, raw, b'')), self.assertRaises(Refusal): run.tap([], Path.cwd())

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


def native_controls():
    """Bound real source tests and publish only counts/fixed diagnostic tokens."""
    root = run.ROOT
    result = dict(schema=1, qualification='ACTUAL_NATIVE_SOURCE_CONTROLS_ONLY', acceptanceGranted=False,
        sourceAcceptance='SUBMITTED_REVIEW_REQUIRED', release='NO_GO', executionComplete=False,
        tests=dict(state='NOT_RUN'), installedAudit=dict(state='NOT_RUN'))
    stage = 'SOURCE_METADATA'
    try:
        head = inventory.git(root, 'rev-parse', 'HEAD').decode().strip()
        tree = inventory.git(root, 'rev-parse', 'HEAD^{tree}').decode().strip()
        require(run.re.fullmatch('[0-9a-f]{40}', head) and run.re.fullmatch('[0-9a-f]{40}', tree) and
            not inventory.git(root, 'status', '--porcelain'), 'DIRTY_SOURCE')
        result.update(headObserved=head, treeObserved=tree)
        stage = 'NATIVE_SOURCE_TESTS'
        result['tests'] = run.tap(['node', '--test', '--test-concurrency=1',
            'scripts/phase9/ios-privacy-source-audit.test.mjs',
            'scripts/phase9/ios-privacy-lock-succession23.test.mjs',
            'scripts/security23/native-source.test.mjs'], root, seconds=600, diagnostics=True)
        stage = 'CURRENT_INSTALLED_NATIVE_AUDIT'
        code, _, _ = run.execute(['node', 'scripts/phase9/ios-privacy-source-audit.mjs', '--strict', '--check'], root, seconds=180)
        result['installedAudit'] = dict(state='PASS' if code == 0 else 'INCOMPLETE', exit=code)
        stage = 'SOURCE_STABILITY'
        require(inventory.git(root, 'rev-parse', 'HEAD').decode().strip() == head and
            not inventory.git(root, 'status', '--porcelain'), 'SOURCE_CHANGED')
        result['executionComplete'] = True
        # Preserve the real tool exits. Existing platform skips remain explicit
        # in counts/state and never become performed passes or native admission.
        exit_code = result['tests']['exit'] or code
        result['state'] = 'PASS' if result['tests']['state'] == 'PASS' and code == 0 else 'INCOMPLETE'
        print(canonical(result).decode()); return exit_code
    except (Exception, KeyboardInterrupt) as error:
        result.update(state='INCOMPLETE', stage=stage, reason=diagnostic(error))
        print(canonical(result).decode()); return 2


if __name__ == '__main__':
    if sys.argv[1:] == ['--native-controls']: sys.exit(native_controls())
    if len(sys.argv) != 1:
        print(canonical(dict(state='INCOMPLETE', reason='ARGUMENT_SCOPE', acceptanceGranted=False)).decode()); sys.exit(2)
    sys.exit(main())
