"""Exact generated-properties controls, not a substitute for CocoaPods execution."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import stat

spec = importlib.util.spec_from_file_location('pods_compat47', Path(__file__).with_name('pods_compat47.py'))
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)


class PodsCompat47Tests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='c47-generated-pods-', dir=Path(tempfile.gettempdir()).resolve())
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.ios = self.root / 'ios'
        self.ios.mkdir()
        self.before = b'{"expo.jsEngine":"hermes","ios.deploymentTarget":"17.0","unrelated":"preserve exact value"}\n'
        self.podfile = b'require "expo"\nuse_expo_modules!\n'
        (self.ios / 'Podfile.properties.json').write_bytes(self.before)
        (self.ios / 'Podfile').write_bytes(self.podfile)
        self.binding = {'sourceHead': 'a' * 40, 'descriptorSHA256': 'b' * 64, 'sourceProofSHA256': 'c' * 64,
                        'propertiesPreimageSHA256': p.digest(self.before), 'podfilePreimageSHA256': p.digest(self.podfile)}

    def test_exact_supported_two_pod_delta_and_unchanged_other_properties_podfile(self):
        receipt = p.apply(self.ios, self.root / 'evidence', self.binding)
        self.assertEqual(p.verify_receipt(self.root / 'evidence/receipt.json', self.ios, self.binding), receipt)
        after = (self.ios / 'Podfile.properties.json').read_bytes()
        self.assertTrue(p.verify_delta(self.before, after))
        parsed = p.document(after)
        self.assertEqual(p.document(parsed.pop('apple.extraPods')), p.PODS)
        self.assertEqual(parsed, p.document(self.before))
        self.assertEqual((self.ios / 'Podfile').read_bytes(), self.podfile)
        self.assertFalse(receipt['nativeAccepted'])
        self.assertFalse(receipt['acceptanceGranted'])

    def test_duplicate_conflicting_malformed_and_nonstring_properties_refuse(self):
        for raw in [b'{"a":"x","a":"y"}', b'{"apple.extraPods":"[]"}', b'{"a":true}',
                    b'[]', b'{}', b'invalid']:
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                p.projection(raw)

    def test_unknown_pod_fields_root_pod_extra_tuple_order_and_global_policy_refuse(self):
        original = p.document(p.projection(self.before))
        mutations = [lambda pods: pods[0].update(name='GoogleUtilities'),
                     lambda pods: pods[0].update(modular_headers=False),
                     lambda pods: pods[0].update(path='../elsewhere'),
                     lambda pods: pods.append({'name': 'Other', 'modular_headers': True}),
                     lambda pods: pods.reverse()]
        for mutate in mutations:
            after = copy.deepcopy(original)
            pods = p.document(after[p.PROPERTY])
            mutate(pods)
            after[p.PROPERTY] = json.dumps(pods, separators=(',', ':'))
            with self.assertRaisesRegex(ValueError, 'EXACT_TWO_POD_DELTA'):
                p.verify_delta(self.before, (json.dumps(after, indent=2) + '\n').encode())
        after = dict(original, **{'ios.useFrameworks': 'static'})
        with self.assertRaises(ValueError):
            p.verify_delta(self.before, (json.dumps(after, indent=2) + '\n').encode())

    def test_wrong_preimage_is_refused_before_generated_file_mutation(self):
        binding = dict(self.binding, propertiesPreimageSHA256='0' * 64)
        with self.assertRaisesRegex(ValueError, 'ACTUAL_GENERATED_PREIMAGE'):
            p.apply(self.ios, self.root / 'evidence', binding)
        self.assertEqual((self.ios / 'Podfile.properties.json').read_bytes(), self.before)

    def test_real_hardlink_and_modeled_linked_leaf_refuse(self):
        original = self.ios / 'Podfile'
        os.link(original, self.root / 'hardlink')
        with self.assertRaisesRegex(ValueError, 'REGULAR_FILE_BOUND'):
            p.regular(original)
        properties = self.ios / 'Podfile.properties.json'
        real_lstat = Path.lstat
        def linked(path):
            value = real_lstat(path)
            if path == properties:
                values = list(value)
                values[0] = stat.S_IFLNK | 0o777
                return os.stat_result(values)
            return value
        with patch.object(Path, 'lstat', linked), self.assertRaisesRegex(ValueError, 'REGULAR_FILE_BOUND'):
            p.regular(properties)

    def test_stale_forged_helper_claims_receipts_and_actual_postimage_drift_refuse(self):
        output = self.root / 'evidence'
        good = p.apply(self.ios, output, self.binding)
        for key, bad in [('sourceHead', '0' * 40), ('helperSHA256', '0' * 64),
                         ('sourceProofSHA256', '0' * 64), ('nativeAccepted', True),
                         ('propertiesPostimageSHA256', '0' * 64)]:
            altered = dict(good, **{key: bad})
            (output / 'receipt.json').write_text(json.dumps(altered))
            with self.subTest(key=key), self.assertRaises(ValueError):
                p.verify_receipt(output / 'receipt.json', self.ios, self.binding)
        (output / 'receipt.json').write_text(json.dumps(good))
        (self.ios / 'Podfile').write_bytes(self.podfile + b'use_modular_headers!\n')
        with self.assertRaisesRegex(ValueError, 'PODFILE_DRIFT'):
            p.verify_receipt(output / 'receipt.json', self.ios, self.binding)

    def test_development_is_only_declared_target_projection_and_production_refuses(self):
        descriptor = Path(__file__).absolute().parents[3] / 'docs/phase-9/ios-generated-input-succession47.v1.json'
        transition = p.document(descriptor.read_bytes())['generatedTransition']
        self.assertEqual(p.profile_preimages(transition, 'staging'),
                         (transition['propertiesPreimage']['sha256'], transition['podfilePreimage']['sha256']))
        expected = transition['developmentProjection']
        self.assertEqual(p.profile_preimages(transition, 'development'),
                         (expected['propertiesPreimage']['sha256'], expected['podfilePreimage']['sha256']))
        with self.assertRaises(ValueError):
            p.profile_preimages(transition, 'production')
        invalid = copy.deepcopy(transition)
        invalid['developmentProjection']['stagingPodfileUTF8'] += '\nuse_modular_headers!\n'
        with self.assertRaises(ValueError):
            p.profile_preimages(invalid, 'development')
        invalid = copy.deepcopy(transition)
        invalid['developmentProjection']['propertiesPreimage']['sha256'] = '0' * 64
        with self.assertRaises(ValueError):
            p.profile_preimages(invalid, 'development')

    def test_actual_current47_proof_refuses_old46_label_stale_head_and_forged_count(self):
        proof = {'phase': 'SOURCE', 'sourceHead': 'a' * 40, 'descriptorSHA256': 'b' * 64,
                 'profiles': ['development', 'staging'], 'currentNative47': {
                     'status': 'CURRENT_NATIVE_SOURCE47_SWIFT_SUCCESSOR_REVIEW_REQUIRED',
                     'verifiedInputCount': 202, 'source': {'sourceHead': 'a' * 40}}}
        self.assertTrue(p.validate_current_source_proof47(proof, 'a' * 40, 'b' * 64))
        for mutate in [lambda v: v.update(currentNative46=v.pop('currentNative47')),
                       lambda v: v.update(sourceHead='0' * 40),
                       lambda v: v['currentNative47'].update(status='CURRENT_SOURCE46'),
                       lambda v: v['currentNative47'].update(verifiedInputCount=201),
                       lambda v: v['currentNative47']['source'].update(sourceHead='0' * 40)]:
            value = copy.deepcopy(proof); mutate(value)
            with self.assertRaisesRegex(ValueError, 'FRESH_CURRENT_SOURCE_PROOF'):
                p.validate_current_source_proof47(value, 'a' * 40, 'b' * 64)


if __name__ == '__main__':
    unittest.main()
