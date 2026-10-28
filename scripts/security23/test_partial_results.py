"""Synthetic public-output controls; no live tools, repository or scanner output."""
import contextlib
import copy
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).absolute().parents[1] / 'security22'))
import run
from redact import Refusal, canonical, diagnostic

CANARY = 'SYNTHETIC_PRIVATE_OUTPUT_23_C:/private/eyJ.invalid.signature'
GATE = dict(errors=0, failures=0, passed=True,
    qualification='SYNTHETIC_DISCLOSURE_AND_BOUNDS_ONLY', skipped=0, testsRun=26)
PARTIAL = dict(testsRun=10, failures=0, errors=0, skipped=0, passed=True,
    qualification='SYNTHETIC_PARTIAL_PUBLICATION_ONLY')
TOOLS = {'identitySHA256': 'a' * 64}
SOURCE = dict(head='b' * 40, tree='c' * 40, metadata={'state': 'PASS'},
    workingBytes={'state': 'PASS'}, archiveCoverage={'state': 'PASS'},
    generated={'state': 'EXPLICIT_DEPENDENCY_COMPONENT_SCOPE'}, history={'commits': 1, 'reachableObjects': 1})


def gates(argv, *args, **kwargs):
    if argv[-1] == '--regressions':
        missing = 12 if os.name == 'nt' else 3
        return 0, canonical(dict(qualification='SYNTHETIC_PINNED_MODEL_FILESYSTEM_CONTROLS_ONLY',
            state='PASS', platform=os.name, acceptanceGranted=False, tests=43, passed=43-missing,
            failed=0, errors=0, notRun=missing)), b''
    return 0, canonical(PARTIAL if argv[-1].endswith('test_partial_results.py') else GATE), b''


class Controls(unittest.TestCase):
    def preflight(self, where, error):
        with patch.object(run, 'execute', side_effect=gates), patch.object(run, 'policy', return_value={}), \
             patch.object(run, 'identity', return_value=TOOLS), patch.object(run, 'snapshot', return_value=SOURCE), \
             patch.object(run, where, side_effect=error):
            return run.perform(Path.cwd())

    def test_fixed_diagnostics(self):
        for error in (Refusal(CANARY), OSError(CANARY), ValueError(CANARY), Refusal({'private': CANARY}),
                      Refusal('NPM_TOOL_ENUMERATION', CANARY)):
            self.assertNotIn(CANARY, diagnostic(error))
        self.assertEqual(diagnostic(Refusal('NPM_TOOL_ENUMERATION')), 'NPM_TOOL_ENUMERATION')

    def test_unknown_tools_have_no_fabricated_binding(self):
        value = self.preflight('identity', Refusal('NPM_TOOL_ENUMERATION'))
        self.assertIsNone(value['source']); self.assertIsNone(value['toolchain'])
        self.assertFalse(value['executionComplete'])
        self.assertEqual(value['components']['preflight']['stage'], 'TOOLCHAIN')
        self.assertEqual(value['components']['dependencies']['state'], 'NOT_RUN')
        self.assertEqual(value['components']['disclosure_controls']['state'], 'PASS')

    def test_established_tools_preserved_on_source_refusal(self):
        value = self.preflight('snapshot', OSError(CANARY))
        self.assertIsNone(value['source']); self.assertEqual(value['toolchain'], TOOLS)
        self.assertNotIn(CANARY, canonical(value).decode())

    def test_interrupt_preserves_completed_controls(self):
        value = self.preflight('identity', KeyboardInterrupt(CANARY))
        self.assertEqual(value['components']['partial_disclosure_controls']['state'], 'PASS')
        self.assertEqual(value['components']['preflight']['reason'], 'EXECUTION_INTERRUPTED')
        self.assertNotIn(CANARY, canonical(value).decode())

    def test_partial_publication_has_null_bindings_and_exact_hashes(self):
        value = self.preflight('identity', Refusal(CANARY))
        with tempfile.TemporaryDirectory(prefix='security23-public-') as directory:
            target = Path(directory) / 'new'
            run.publish_components(target, value)
            index = json.loads((target / 'index.json').read_bytes())
            self.assertEqual(len(index['files']), len(value['components']))
            for name, identity in index['files'].items():
                raw = (target / name).read_bytes(); component = json.loads(raw)
                self.assertEqual(identity, dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest()))
                self.assertIsNone(component['head']); self.assertIsNone(component['tree'])
                self.assertIsNone(component['toolchainIdentitySHA256'])
                self.assertNotIn(CANARY, raw.decode())
            with self.assertRaises(FileExistsError):
                run.publish_components(target, value)

    def test_failed_disclosure_does_not_collect_real_data(self):
        with patch.object(run, 'execute', return_value=(1, canonical(GATE), b'')), \
             patch.object(run, 'identity') as tools, patch.object(run, 'snapshot') as source:
            value = run.perform(Path.cwd())
        tools.assert_not_called(); source.assert_not_called()
        self.assertEqual(value['components']['preflight']['stage'], 'DISCLOSURE_GATE')
        self.assertFalse(value['acceptanceGranted']); self.assertFalse(value['candidateReady'])

    def test_malformed_partial_gate_refuses_before_collection(self):
        changed = {**PARTIAL, 'testsRun': True}
        with patch.object(run, 'execute', side_effect=[(0, canonical(GATE), b''), (0, canonical(changed), b'')]), \
             patch.object(run, 'identity') as tools:
            value = run.perform(Path.cwd())
        tools.assert_not_called()
        self.assertEqual(value['components']['preflight']['reason'], 'PARTIAL_GATE_FAILED')

    def test_preserved_component_and_false_acceptance(self):
        value = self.preflight('identity', Refusal('TOOL_VERSION'))
        self.assertFalse(value['acceptanceGranted']); self.assertEqual(value['G97'], 'FAIL/NO_GO')
        self.assertEqual(value['components']['qualified_custody']['state'], 'BLOCKED_EXTERNAL_CUSTODY')
        changed = copy.deepcopy(value)
        changed['components']['qualified_custody']['state'] = 'PASS'
        with self.assertRaises(Refusal):
            run.summary(changed['components'])

    def later_failure(self, interrupted):
        tools = {**TOOLS, 'inputs': {'package-lock.json': 'd' * 64},
            'tools': {'npm': {'cliSHA256': 'e' * 64}, 'node': {'version': 'v22.21.0'}}}
        def execute(argv, *args, **kwargs):
            if 'scripts/security22/dependency.mjs' in argv:
                if interrupted: raise KeyboardInterrupt(CANARY)
                return 1, b'{}', b''
            if 'scripts/postinstall.mjs' in argv: raise OSError(CANARY)
            if 'scripts/phase9/security_acceptance/contract.py' in argv:
                return 1, canonical(dict(code='SOURCE_INVENTORY_DRIFT', acceptanceGranted=False, rawScannerPass=False)), b''
            return gates(argv)
        with patch.object(run, 'execute', side_effect=execute), patch.object(run, 'policy', return_value={}), \
             patch.object(run, 'identity', return_value=tools), patch.object(run, 'snapshot', return_value=SOURCE), \
             patch.object(run, 'dependency', return_value={'state': 'FINDINGS', 'exit': 1}), \
             patch.object(run, 'regular', return_value=b'{}'), patch.object(run, 'tap', return_value={'state': 'PASS', 'exit': 0}):
            return run.perform(Path.cwd())

    def test_completed_tooling_survives_patch_exception(self):
        value = self.later_failure(False)
        self.assertEqual(value['components']['tooling_regressions']['state'], 'PASS')
        self.assertEqual(value['components']['mandatory_native_patches']['state'], 'INCOMPLETE')
        self.assertNotIn(CANARY, canonical(value).decode())

    def test_interrupted_attempt_is_incomplete_not_unexecuted(self):
        value = self.later_failure(True)
        self.assertEqual(value['components']['dependencies']['state'], 'INCOMPLETE')
        self.assertTrue(value['components']['dependencies']['executed'])
        self.assertEqual(value['components']['tooling_regressions']['state'], 'NOT_RUN')
        self.assertEqual(value['source'], SOURCE)


def main():
    result = unittest.TextTestRunner(stream=io.StringIO()).run(unittest.defaultTestLoader.loadTestsFromTestCase(Controls))
    print(json.dumps(dict(qualification='SYNTHETIC_PARTIAL_PUBLICATION_ONLY', testsRun=result.testsRun,
        failures=len(result.failures), errors=len(result.errors), skipped=len(result.skipped), passed=result.wasSuccessful()), sort_keys=True))
    return 0 if result.wasSuccessful() and not result.skipped else 1


if __name__ == '__main__':
    sys.exit(main())
