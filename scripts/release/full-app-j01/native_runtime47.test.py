"""Local fail-closed orchestration checks; these do not execute or qualify iOS."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('native_runtime47', Path(__file__).with_name('native_runtime47.py'))
n = importlib.util.module_from_spec(spec)
spec.loader.exec_module(n)


class Runtime47Tests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='c47-orchestration-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def simulator_inventory(self):
        return {'runtimes': [
            {'identifier': 'com.apple.CoreSimulator.SimRuntime.iOS-26-4', 'version': '26.4.1', 'isAvailable': True},
            {'identifier': 'com.apple.CoreSimulator.SimRuntime.iOS-16-4', 'version': '16.4', 'isAvailable': True},
            {'identifier': 'com.apple.CoreSimulator.SimRuntime.iOS-26-5', 'version': '26.5', 'isAvailable': False},
        ], 'devices': {
            'com.apple.CoreSimulator.SimRuntime.iOS-26-4': [
                {'name': 'iPhone 17 Pro Max', 'isAvailable': True,
                 'deviceTypeIdentifier': 'com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro-Max'},
                {'name': 'iPhone 16e', 'isAvailable': True,
                 'deviceTypeIdentifier': 'com.apple.CoreSimulator.SimDeviceType.iPhone-16e'},
            ],
            'com.apple.CoreSimulator.SimRuntime.iOS-16-4': [
                {'name': 'iPhone SE (3rd generation)', 'isAvailable': True,
                 'deviceTypeIdentifier': 'com.apple.CoreSimulator.SimDeviceType.iPhone-SE-3rd-generation'},
            ],
        }}

    def product(self):
        return {'DTPlatformName': 'iphonesimulator', 'CFBundleSupportedPlatforms': ['iPhoneSimulator'],
                'CFBundleIdentifier': 'com.layerwell.app.staging', 'CFBundleExecutable': 'LayerwellStaging',
                'MinimumOSVersion': '17.0'}

    def test_requires_actual_available_supported_iphone_runtime_pair(self):
        runtime, device = n.available_iphone(self.simulator_inventory())
        self.assertEqual(runtime['version'], '26.4.1')
        self.assertEqual(device['name'], 'iPhone 16e')
        for mutate in [lambda d: d.update(devices={}),
                       lambda d: d.update(runtimes=[]),
                       lambda d: [row.update(isAvailable=False) for row in d['runtimes']],
                       lambda d: [row.update(isAvailable=False) for rows in d['devices'].values() for row in rows]]:
            value = self.simulator_inventory()
            mutate(value)
            with self.assertRaisesRegex(ValueError, 'NO_AVAILABLE_SUPPORTED_IPHONE_RUNTIME'):
                n.available_iphone(value)

    def test_rejects_device_binary_missing_macho_or_host_architecture(self):
        valid = (self.product(), 'Mach-O 64-bit executable arm64', 'arm64 x86_64',
                 'platform IOSSIMULATOR\nminos 17.0', 'arm64')
        self.assertEqual(n.validate_product(*valid)[0], 'com.layerwell.app.staging')
        mutations = [
            (0, dict(self.product(), DTPlatformName='iphoneos')),
            (0, dict(self.product(), CFBundleSupportedPlatforms=['iPhoneOS'])),
            (0, dict(self.product(), CFBundleExecutable='../outside')),
            (0, dict(self.product(), CFBundleIdentifier='invalid identifier')),
            (0, dict(self.product(), MinimumOSVersion='16.4')),
            (1, 'ELF executable'), (2, 'x86_64'), (2, 'arm64 armv7'),
            (3, 'platform IOS\nminos 17.0'),
        ]
        for index, value in mutations:
            args = list(valid)
            args[index] = value
            with self.subTest(index=index, value=value), self.assertRaises(ValueError):
                n.validate_product(*args)

    def test_bundle_inventory_hashes_actual_bytes_and_records_modes(self):
        app = self.root / 'Example.app'
        app.mkdir()
        binary = app / 'Example'
        binary.write_bytes(b'actual executable fixture bytes')
        binary.chmod(0o755)
        rows = n.bundle_inventory(app)
        self.assertEqual(rows[0]['path'], 'Example')
        self.assertEqual(rows[0]['sha256'], n.sha(binary))
        self.assertEqual(rows[0]['bytes'], binary.stat().st_size)
        binary.write_bytes(b'changed')
        self.assertNotEqual(rows[0]['sha256'], n.bundle_inventory(app)[0]['sha256'])
        self.assertEqual(n.evidence_size(app), len(b'changed'))

    def test_failed_command_preserves_both_complete_streams_without_stage_pass(self):
        runner = n.Runner(self.root, self.root / 'failure-evidence')
        with self.assertRaisesRegex(ValueError, 'COMMAND_FAILED:red'):
            runner.run('red', [sys.executable, '-I', '-c',
                              'import sys; print("raw stdout"); print("raw stderr",file=sys.stderr); sys.exit(7)'])
        receipt = json.loads((runner.output / 'execution.json').read_text())
        row = receipt['commands'][0]
        self.assertEqual(row['exit_code'], 7)
        self.assertEqual(row['state'], 'FAIL')
        self.assertEqual(receipt['stages'], {})
        self.assertFalse(receipt['campaign_candidate_complete'])
        self.assertEqual((runner.output / row['stdout']).read_text().strip(), 'raw stdout')
        self.assertEqual((runner.output / row['stderr']).read_text().strip(), 'raw stderr')
        self.assertEqual(row['stdout_sha256'], n.sha(runner.output / row['stdout']))
        self.assertEqual(row['stderr_sha256'], n.sha(runner.output / row['stderr']))

    def test_real_subprocess_timeout_retains_failure_and_finite_deadline(self):
        runner = n.Runner(self.root, self.root / 'timeout-evidence', seconds=5)
        with self.assertRaisesRegex(ValueError, 'COMMAND_FAILED:timeout'):
            runner.run('timeout', [sys.executable, '-I', '-c', 'import time; time.sleep(30)'], timeout=0.1)
        row = runner.receipt['commands'][0]
        self.assertTrue(row['timed_out'])
        self.assertEqual(row['exit_code'], 124)
        self.assertEqual(row['state'], 'FAIL')
        self.assertEqual(runner.receipt['stages'], {})

    def test_optional_diagnostic_failure_never_claims_runtime_pass(self):
        runner = n.Runner(self.root, self.root / 'diagnostic-evidence')
        runner.run('diagnostic', [sys.executable, '-I', '-c', 'raise SystemExit(4)'], required=False)
        self.assertEqual(runner.receipt['commands'][0]['exit_code'], 4)
        self.assertEqual(runner.receipt['stages'], {})
        self.assertEqual(runner.receipt['internal_supported_owner'], 'NOT_RUN')
        self.assertFalse(runner.receipt['acceptance_granted'])

    def test_nonexistent_command_is_recorded_as_failed_not_unexecuted_pass(self):
        runner = n.Runner(self.root, self.root / 'missing-evidence')
        with self.assertRaisesRegex(ValueError, 'COMMAND_FAILED:missing'):
            runner.run('missing', [str(self.root / 'nonexistent-program')])
        self.assertEqual(runner.receipt['commands'][0]['exit_code'], 127)
        self.assertEqual(runner.receipt['commands'][0]['state'], 'FAIL')
        self.assertEqual(runner.receipt['stages'], {})

    def test_exact_prebuild_script_projection_preserves_every_other_package_field(self):
        before = {'scripts': {'ios': 'expo start --ios', 'android': 'expo start --android', 'test': 'vitest run'},
                  'dependencies': {'react-native': '0.86.3'}, 'private': True}
        after = json.loads(json.dumps(before))
        after['scripts']['ios'] = 'expo run:ios'
        result = n.generated_package_projection(json.dumps(before).encode(), json.dumps(after).encode())
        self.assertEqual(result['changed_script_names'], ['ios'])
        for key, value in [('dependencies', {'react-native': '0.86.4'}),
                           ('private', False), ('new_field', True)]:
            invalid = dict(after, **{key: value})
            with self.assertRaisesRegex(ValueError, 'NON_SCRIPT_DELTA'):
                n.generated_package_projection(json.dumps(before).encode(), json.dumps(invalid).encode())
        after['scripts']['test'] = 'true'
        with self.assertRaisesRegex(ValueError, 'NON_SCRIPT_DELTA'):
            n.generated_package_projection(json.dumps(before).encode(), json.dumps(after).encode())

    def test_generated_native_archive_retains_project_config_but_excludes_pods_and_build(self):
        ios = self.root / 'ios'
        for name in ['App.xcodeproj/project.pbxproj', 'App/AppDelegate.swift', 'Pods/secret.pod', 'build/generated.swift']:
            path = ios / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(name)
        output = self.root / 'native-evidence'
        output.mkdir()
        n.retain_generated_native(ios, output)
        inventory = json.loads((output / 'generated-native/native-configuration-inventory.json').read_text())
        self.assertEqual([row['path'] for row in inventory['files']],
                         ['App/AppDelegate.swift', 'App.xcodeproj/project.pbxproj'])


if __name__ == '__main__':
    unittest.main()
