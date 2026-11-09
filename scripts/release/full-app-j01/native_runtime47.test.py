"""Local fail-closed orchestration checks; these do not execute or qualify iOS."""
import importlib.util
import json
from types import SimpleNamespace
import time
import hashlib
import copy
import io
import stat
import zipfile
from pathlib import Path
import sys
import tempfile
import unittest
import subprocess
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('native_runtime47', Path(__file__).with_name('native_runtime47.py'))
n = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = n
spec.loader.exec_module(n)


def historical_runtime25():
    root = Path(__file__).resolve().parents[3]
    path = root/'scripts/release/full-app-j01/native_runtime47.py'
    raw = subprocess.check_output(['git','--no-replace-objects','show',
        'f21831f5731be928c8e323c509fb62b3d12a654e:scripts/release/full-app-j01/native_runtime47.py'],cwd=root)
    module = type(sys)('historical_native_runtime25')
    module.__file__ = str(path)
    sys.modules[module.__name__] = module
    exec(compile(raw,str(path),'exec'),module.__dict__)
    return module


class Runtime47Tests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='c47-orchestration-', dir=Path(tempfile.gettempdir()).resolve())
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
        intel = (self.product(), 'Mach-O 64-bit executable x86_64', 'x86_64',
                 'platform IOSSIMULATOR\nminos 17.0', 'x86_64')
        self.assertEqual(n.validate_product(*intel)[2], ['x86_64'])
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

    def test_host_only_simulator_build_refuses_an_unmatched_toolchain(self):
        n.require_simulator_host('x86_64')
        for architecture in ['arm64', 'AMD64', 'x86_64\n', '', None]:
            with self.subTest(architecture=architecture), self.assertRaisesRegex(
                    ValueError, 'INTEL_SIMULATOR_HOST_REQUIRED'):
                n.require_simulator_host(architecture)
        self.assertEqual(dict(value.split('=', 1) for value in n.SIMULATOR_BUILD_FLAGS), {
            'CODE_SIGNING_ALLOWED': 'NO', 'CODE_SIGNING_REQUIRED': 'NO',
            'CODE_SIGN_IDENTITY': '', 'COMPILER_INDEX_STORE_ENABLE': 'NO', 'ARCHS': 'x86_64'})

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


    def test_installed_pod_inventory_binds_full_bytes_and_refuses_lock_drift(self):
        ios = self.root / 'ios'
        pods = ios / 'Pods'
        pods.mkdir(parents=True)
        lock = b'PODS:\n  - Example (1.0)\nSPEC CHECKSUMS:\n  Example: abc\n'
        (ios / 'Podfile.lock').write_bytes(lock)
        (pods / 'Manifest.lock').write_bytes(lock)
        (pods / 'Example').mkdir()
        source = pods / 'Example/actual.m'
        source.write_bytes(b'actual generated dependency source')
        output = self.root / 'evidence'
        output.mkdir()
        n.retain_pod_inventory(ios, output)
        value = json.loads((output / 'generated-native/installed-pod-inventory.json').read_bytes())
        self.assertEqual(next(row for row in value['files'] if row['path'] == 'Example/actual.m')['sha256'], n.sha(source))
        self.assertTrue(value['manifest_lock_matches'])
        self.assertFalse(value['links_followed'])
        (pods / 'Manifest.lock').write_bytes(lock + b'drift')
        with self.assertRaisesRegex(ValueError, 'POD_LOCK_MANIFEST_DRIFT'):
            n.retain_pod_inventory(ios, output)


    def test_internal_lane_requires_completed_normal_ui_and_rejects_provider_or_pro_configuration(self):
        with self.assertRaisesRegex(ValueError, 'NORMAL_STAGING_UI_REQUIRED'):
            n.execute_internal(SimpleNamespace(receipt={'stages': {}}))
        environment = n.internal_environment({})
        self.assertEqual(environment['APP_VARIANT'], 'development')
        self.assertEqual(environment['EXPO_PUBLIC_E2E_FIRST_SESSION_AUTH'], 'anonymous_owner')
        self.assertEqual(environment['EXPO_NO_DOTENV'], '1')
        for supplied in [{key: 'present'} for key in n.PROVIDER_KEYS] + [
                {'EXPO_PUBLIC_CUSTOM_PRO_GRANT_ENABLED': 'true'},
                {'EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION': 'cross_owner'}]:
            with self.subTest(keys=list(supplied)), self.assertRaises(ValueError):
                n.internal_environment(supplied)
        for url in ['https://127.0.0.1:8081', 'http://remote.invalid:8081',
                    'http://user:password@localhost:8081', 'http://localhost:8082']:
            with self.assertRaises(ValueError):
                n.localhost_url(url)
        self.assertEqual(n.localhost_url('http://127.0.0.1:8081?disableFab=1'),
                         'http://127.0.0.1:8081?disableFab=1')


    def test_managed_background_preserves_raw_logs_and_terminates_actual_process(self):
        runner = n.Runner(self.root, self.root / 'background-evidence')
        with runner.background('background', [sys.executable, '-I', '-c',
                'import time; print("raw background output",flush=True); time.sleep(30)'], self.root) as process:
            limit = time.monotonic() + 3
            while (runner.logs / 'background.stdout').stat().st_size == 0 and time.monotonic() < limit:
                time.sleep(0.02)
            self.assertIsNone(process.poll())
        self.assertIsNotNone(process.poll())
        row = runner.receipt['commands'][0]
        self.assertEqual(row['state'], 'STOPPED')
        self.assertTrue(row['intentional_teardown'])
        self.assertEqual((runner.logs / 'background.stdout').read_text().strip(), 'raw background output')
        self.assertEqual(row['stdout_sha256'], n.sha(runner.logs / 'background.stdout'))


    def test_native_observation_handles_inline_and_external_envelopes_selective_deletion(self):
        directory = self.root / 'native-store'
        directory.mkdir()
        keys = {'layerwell.shelf.v1', 'layerwell.skinprofile.v1', 'layerwell.completions.v1'}
        envelope = json.dumps({'version': 'xchacha20poly1305:v1', 'nonceHex': '0' * 48, 'ciphertextHex': 'a' * 32})
        manifest = {key: envelope for key in keys}
        external = hashlib.md5('layerwell.completions.v1'.encode()).hexdigest()
        manifest['layerwell.completions.v1'] = None
        (directory / external).write_text(envelope)
        (directory / 'manifest.json').write_text(json.dumps(manifest))
        before = n.native_storage_summary(directory, keys, 'retained')
        self.assertEqual(before['health_envelope_shapes_valid'], 3)
        self.assertFalse(before['synthetic_plaintext_marker_detected'])
        self.assertFalse(before['secure_store_read_or_decrypted'])
        with self.assertRaises(ValueError):
            n.native_storage_summary(directory, keys, 'withdrawn')
        # A retained nonhealth receipt is valid after health-purpose removal.
        (directory / 'manifest.json').write_text(json.dumps({'nonhealth-age-receipt': envelope}))
        with self.assertRaisesRegex(ValueError, 'PLAINTEXT_OR_UNCONFIRMED_CLEANUP'):
            n.native_storage_summary(directory, keys, 'withdrawn')
        (directory / external).unlink()
        after = n.native_storage_summary(directory, keys, 'withdrawn')
        self.assertEqual(after['health_records_present'], 0)
        self.assertEqual(after['manifest_record_count'], 1)
        self.assertTrue(after['cleanup_control_marker_absent'])
        self.assertFalse(after['owner_isolation_qualified'])
        serialized = json.dumps(after)
        self.assertNotIn(str(directory), serialized)
        self.assertNotIn('layerwell.', serialized)
        manifest['layerwell.shelf.v1'] = 'C47 synthetic plaintext must fail'
        (directory / 'manifest.json').write_text(json.dumps(manifest))
        (directory / external).write_text(envelope)
        with self.assertRaises(ValueError):
            n.native_storage_summary(directory, keys, 'retained')


    def test_dynamic_type_readback_requires_one_exact_observed_category(self):
        for raw in ['accessibility-extra-extra-extra-large',
                    'Current content size category: UICTContentSizeCategoryAccessibilityXXXL',
                    'UIContentSizeCategoryAccessibilityExtraExtraExtraLarge']:
            self.assertEqual(n.content_size_category(raw), 'accessibility-extra-extra-extra-large')
        for raw in ['large', 'Current content size category: UICTContentSizeCategoryL']:
            self.assertEqual(n.content_size_category(raw), 'large')
        for raw in ['', 'unsupported', 'extra-large', 'notlarge',
                    'large accessibility-extra-extra-extra-large']:
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                n.content_size_category(raw)


    def export_fixture(self):
        sections = {key: {} for key in ['account_and_privacy', 'profile_and_preferences',
                    'shelf_and_routine', 'activity_and_app_state', 'subscription', 'progress']}
        sections['shelf_and_routine'] = {'synthetic': ['C47 synthetic cleanser',
            'C47 synthetic observation: used the test cleanser.',
            'C47 synthetic correction: used the test cleanser once.']}
        return {'mobile_export_schema_version': 2, 'exported_at': '2026-11-04T10:00:00.000Z',
                'server_account_data_status': 'backend_not_configured', 'server_account_data': None,
                'local_media_note': 'No photo files included.', 'local_device_data': {
                    'schema_version': 2, 'collected_at': '2026-11-04T10:00:00.000Z',
                    'storage_scope': 'encrypted_private_storage_on_this_device', 'sections': sections,
                    'exclusions': [{'data_class': 'fixture', 'reason': 'fixture'} for _ in range(6)]}}

    def test_normal_native_gate_requires_actual_expected_xctest_and_clean_executed_summary(self):
        historical = historical_runtime25()
        case = historical.NORMAL_UI_CASE
        legacy = "Test Case '-[C47NativeUI.C47NativeUI " + case + "]' passed (1.234 seconds).\n"
        modern = "Test case 'C47NativeUI." + case + "()' passed on 'actual controlled Simulator' (1.234 seconds).\n"
        summary = 'Executed 1 test, with 0 failures (0 unexpected) in 1.234 seconds\n'
        for events in [legacy, modern, legacy + modern]:
            proof = historical.normal_xctest_summary(events + summary)
            self.assertEqual((proof['executed'], proof['failed'], proof['skipped']), (1, 0, 0))
        for invalid in [summary, '** TEST SUCCEEDED **', legacy,
                        legacy + summary.replace('Executed 1', 'Executed 0'),
                        legacy + summary.replace('0 failures', '1 failure'),
                        legacy.replace(case, 'testUnrelated') + summary,
                        legacy.replace('passed', 'skipped') + summary,
                        legacy.replace('passed', 'failed') + summary,
                        legacy + summary + '1 test skipped\n',
                        legacy + summary + "Test Suite 'C47NativeUI' failed\n"]:
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                historical.normal_xctest_summary(invalid)
        with self.assertRaisesRegex(ValueError, 'ACTUAL_COMMAND_REQUIRED'):
            historical.execute_internal(SimpleNamespace(receipt={'stages': {'normal-staging-ui': {'status': 'PASS'}},
                                                       'commands': []}))


    def test_internal_native_gate_requires_selected_named_case_before_success(self):
        summary = 'Executed 1 test, with 0 failures (0 unexpected) in 1.234 seconds\n'
        for case in n.INTERNAL_UI_CASES:
            legacy = "Test Case '-[C47NativeUI.C47InternalOwnerUI " + case + "]' passed (1.234 seconds).\n"
            modern = "Test case 'C47InternalOwnerUI." + case + "()' passed on 'actual controlled Simulator' (1.234 seconds).\n"
            for events in [legacy, modern, legacy + modern]:
                with self.subTest(case=case, events=events):
                    proof = n.selected_xctest_summary(events + summary, 'C47InternalOwnerUI', case)
                    self.assertEqual(proof['expected_case'], 'C47InternalOwnerUI/' + case)
                    self.assertEqual((proof['executed'], proof['failed'], proof['skipped']), (1, 0, 0))
            for invalid in [summary, '** TEST SUCCEEDED **', legacy,
                            legacy + summary.replace('Executed 1', 'Executed 0'),
                            legacy + summary.replace('0 failures', '1 failure'),
                            legacy.replace(case, 'testUnrelated') + summary,
                            legacy.replace('passed', 'skipped') + summary,
                            legacy.replace('passed', 'failed') + summary,
                            legacy + summary + '1 test skipped\n',
                            legacy + summary + "Test Suite 'C47InternalOwnerUI' failed\n"]:
                with self.subTest(case=case, invalid=invalid), self.assertRaises(ValueError):
                    n.selected_xctest_summary(invalid, 'C47InternalOwnerUI', case)
        for method in [None, 'testUnrelated']:
            with self.subTest(method=method), self.assertRaisesRegex(ValueError, 'INTERNAL_TEST_SELECTION'):
                n.native_ui(SimpleNamespace(), self.root, self.root, 'unused', 'unused',
                            'internal-supported-owner', method=method)
        with self.assertRaisesRegex(ValueError, 'XCTEST_SELECTED_CASE_REQUIRED'):
            n.selected_xctest_summary(legacy + summary, 'C47UnrelatedUI', case)
        stdout, stderr = self.root / 'selected.stdout', self.root / 'selected.stderr'
        stdout_raw, stderr_raw = (legacy + summary).encode(), b''
        stdout.write_bytes(stdout_raw)
        stderr.write_bytes(stderr_raw)
        runner = SimpleNamespace(receipt={'source': {'head': 'a' * 40}})
        proof = n.selected_ui_log_proof(runner, (stdout, stderr), 'C47InternalOwnerUI', case)
        self.assertEqual(proof['stdout_sha256'], hashlib.sha256(stdout_raw).hexdigest())
        self.assertEqual(proof['stderr_sha256'], hashlib.sha256(stderr_raw).hexdigest())
        self.assertEqual(proof['source_head'], 'a' * 40)
        stderr.write_bytes(b'actual extra diagnostics\n')
        runner.receipt['source']['head'] = 'b' * 40
        changed = n.selected_ui_log_proof(runner, (stdout, stderr), 'C47InternalOwnerUI', case)
        self.assertNotEqual(changed['stderr_sha256'], proof['stderr_sha256'])
        self.assertEqual(changed['source_head'], 'b' * 40)

    def test_frozen_normal_swift_prefix_contains_only_the_original_normal_class(self):
        current = Path(__file__).with_name('native_ui47.swift').read_bytes()
        root = Path(__file__).resolve().parents[3]
        source = subprocess.check_output(['git', 'show',
            '445472ce057b90f08b5a51d5a49167c757d34b79:scripts/release/full-app-j01/native_ui47.swift'], cwd=root)
        preserved = subprocess.check_output(['git', 'show',
            'f21831f5731be928c8e323c509fb62b3d12a654e:scripts/release/full-app-j01/native_ui47.swift'], cwd=root)
        pre_disclosure = subprocess.check_output(['git', 'show',
            'ee4f91945ffd816accc17dce1374e7c5d3483818:scripts/release/full-app-j01/native_ui47.swift'], cwd=root)
        prefix = source[:8736]
        self.assertEqual(hashlib.sha256(prefix).hexdigest(),
                         'b57511fd34c67d0a39e9acb712d86d6ea19d90213b468bce7c1a528612487c44')
        self.assertIn(b'final class C47NativeUI', prefix)
        self.assertNotIn(b'final class C47InternalOwnerUI', prefix)
        self.assertIn(b'final class C47InternalOwnerUI', source[8736:])
        marker = b'    func testNormalStagingAgeConsentAndUnavailableAccount() throws {'
        self.assertEqual(source.count(marker), 1)
        self.assertEqual(preserved.count(marker), 1)
        # The entire old test body and internal suffix remain a real Git witness.
        self.assertEqual(preserved.split(marker)[1], source.split(marker)[1])
        self.assertIn(b'executionTimeAllowance = 600', preserved.split(marker)[0])
        self.assertIn(b'for character in value {', preserved.split(marker)[0])
        self.assertIn(b'requireFieldValue(field, prefix, label)', preserved.split(marker)[0])
        self.assertIn(b'XCTAssertEqual(field.value as? String, value, label + " did not accept the synthetic input")', preserved)
        separator = b'\nimport UIKit\n'
        self.assertEqual(current.count(separator), 1)
        self.assertEqual(preserved.count(separator), 1)
        normal = current.split(separator)[0]
        # C05: validate the exact current successor, then replay every old assertion.
        goals_commit05 = b'''        // C05 ordinary goals-commit successor05: await committed native selections.
        let clearSkinGoal = buttonBeginning("Clear skin", app)
        let barrierRepairGoal = buttonBeginning("Barrier repair", app)
        let goalsContinue = button("Continue", app)
        let goalsCommitted = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            clearSkinGoal.isSelected && barrierRepairGoal.isSelected && goalsContinue.isEnabled
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [goalsCommitted], timeout: deadline), .completed,
            "Both actual selected goals and enabled Continue must be committed before advancing")
'''
        self.assertEqual(normal.count(goals_commit05), 1)
        self.assertEqual(len(normal), 19483)
        self.assertEqual(hashlib.sha256(normal).hexdigest(),
                         '11f58b07368aacc1d09b5c6c26bf9f0764bcf06d05600cf5a1a9cf9bdd5516cf')
        normal = normal.replace(goals_commit05, b'', 1)
        self.assertEqual(pre_disclosure.count(separator), 1)
        historical04 = pre_disclosure.split(separator)[0]
        self.assertEqual(len(historical04), 18684)
        self.assertEqual(hashlib.sha256(historical04).hexdigest(),
                         '7ea34e6bab248fecf0557261186548ba2b5300407f25f6bc41d55261f723ce20')
        before_disclosure = b'''    private func requireDisclosure(_ app: XCUIApplication) {
        for label in ["WHAT", "WHY", "NEVER"] {
            XCTAssertTrue(text(label, app).waitForExistence(timeout: deadline),
                "The actual explicit disclosure must include " + label)
        }
    }
'''
        after_disclosure = b'''    private func requireDisclosure(_ app: XCUIApplication) {
        for label in ["WHAT", "WHY", "NEVER"] {
            XCTAssertTrue(text(label, app).waitForExistence(timeout: deadline),
                "The actual explicit disclosure must include " + label)
            requireVisible(text(label, app),
                "The actual explicit disclosure must make " + label + " reachable")
        }
    }
'''
        self.assertEqual(historical04.count(before_disclosure), 1)
        self.assertEqual(normal, historical04.replace(before_disclosure, after_disclosure, 1))
        self.assertEqual(len(normal), 18813)
        self.assertEqual(hashlib.sha256(normal).hexdigest(),
                         '3f3d5c65b093f08af85b29c9baa3e578f5615f8bd42762e94b8e1b314bc4e0db')
        self.assertIn(b'final class C47NativeUI', normal)
        self.assertNotIn(b'final class C47InternalOwnerUI', normal)
        self.assertNotIn(b'import UIKit', normal)
        self.assertEqual([line.strip().split(b'func ')[1].split(b'(')[0]
                          for line in normal.splitlines() if line.strip().startswith(b'func test')],
                         [b'testV04FreshConsentRefusalAndUnavailableAccount',
                          b'testV04UnderageRestartRequiresExplicitInitialConsent',
                          b'testV04ExplicitWithdrawalReviewCancelAndFreshReconsent'])
        for helper in [b'executionTimeAllowance = 600', b'for character in value {',
                       b'requireFieldValue(field, prefix, label)',
                       b'XCTAssertEqual(field.value as? String, value, label + " did not accept the synthetic input")']:
            self.assertIn(helper, normal)
        old_internal = preserved[preserved.index(b'import UIKit\n'):]
        current_internal = current[current.index(b'import UIKit\n'):]
        before_heading = b'        XCTAssertTrue(text("Your account is still here.", app).waitForExistence(timeout: deadline))'
        after_heading = b'        XCTAssertTrue(text("Health features are paused on this device.", app).waitForExistence(timeout: deadline))'
        self.assertEqual(old_internal.count(before_heading), 1)
        before_fill = b'''    private func fill(_ label: String, _ value: String, _ app: XCUIApplication) {
        let single = app.textFields.matching(identifier: label).firstMatch
        let multiple = app.textViews.matching(identifier: label).firstMatch
        let appeared = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in single.exists || multiple.exists }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [appeared], timeout: deadline), .completed, label)
        let field = single.exists ? single : multiple
        reveal(field, label, app)
        field.tap()
        if let existing = field.value as? String, !existing.isEmpty, existing != field.placeholderValue {
            field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: existing.count))
        }
        field.typeText(value)
        XCTAssertEqual(field.value as? String, value)
    }

'''
        after_fill = b'''    private func fill(_ label: String, _ value: String, _ app: XCUIApplication) {
        let single = app.textFields.matching(identifier: label).firstMatch
        let multiple = app.textViews.matching(identifier: label).firstMatch
        let appeared = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in single.exists || multiple.exists }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [appeared], timeout: deadline), .completed, label)
        let field = single.exists ? single : multiple
        reveal(field, label, app)
        field.tap()
        if let existing = field.value as? String, !existing.isEmpty, existing != field.placeholderValue {
            var remaining = existing
            for _ in existing {
                field.typeText(XCUIKeyboardKey.delete.rawValue)
                remaining.removeLast()
                requireFieldValue(field, remaining, label)
            }
        }
        var prefix = ""
        for character in value {
            field.typeText(String(character))
            prefix.append(character)
            requireFieldValue(field, prefix, label)
        }
        XCTAssertEqual(field.value as? String, value)
    }

    private func requireFieldValue(_ field: XCUIElement, _ value: String, _ label: String) {
        let accepted = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            let observed = field.value as? String
            return observed == value || (value.isEmpty && observed == field.placeholderValue)
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [accepted], timeout: deadline), .completed,
            label + " must accept each actual native key before the next key")
    }

'''
        self.assertEqual(old_internal.count(before_fill), 1)
        expected_internal = old_internal.replace(before_heading, after_heading, 1).replace(before_fill, after_fill, 1)
        self.assertEqual(current_internal, expected_internal)
        self.assertEqual([line.strip().split(b'func ')[1].split(b'(')[0]
                          for line in current_internal.splitlines() if line.strip().startswith(b'func test')],
                         [b'test01CoreRetainedNativeJourney', b'test03LargerTextManualInput',
                          b'test02LocalExport', b'test04RemoveSyntheticLocalExport', b'test05ConsentWithdrawal'])

    def test_export_schema_requires_source_scope_and_retained_journey_facts_without_content_in_report(self):
        value = self.export_fixture()
        raw = json.dumps(value).encode()
        summary = n.export_payload_summary(raw)
        self.assertEqual(summary['sha256'], hashlib.sha256(raw).hexdigest())
        self.assertEqual(summary['bytes'], len(raw))
        serialized = json.dumps(summary)
        self.assertNotIn('C47 synthetic', serialized)
        self.assertNotIn('shelf_and_routine', serialized)
        for mutate in [lambda d: d.update(server_account_data={'unsafe': 'not local'}),
                       lambda d: d.update(server_account_data_status='included'),
                       lambda d: d['local_device_data'].update(storage_scope='unknown'),
                       lambda d: d['local_device_data']['sections']['shelf_and_routine'].clear()]:
            data = self.export_fixture()
            mutate(data)
            with self.assertRaises(ValueError):
                n.export_payload_summary(json.dumps(data).encode())
        with self.assertRaisesRegex(ValueError, 'DUPLICATE_JSON_KEY'):
            n.export_json(b'{"same":1,"same":2}')

    def test_export_folder_discovery_is_bounded_and_does_not_treat_source_cache_as_provider(self):
        storage = self.root / 'actual-local-provider'
        storage.mkdir()
        token = 'C47 Synthetic Export ' + 'a' * 16
        cache = self.root / 'source-app-cache' / token
        cache.mkdir(parents=True)
        (cache / 'not-a-destination.json').write_text('source temporary bytes')
        self.assertEqual(n.export_folders(storage, token), [])
        selected = storage / 'Downloads' / token
        selected.mkdir(parents=True)
        self.assertEqual(n.export_folders(storage, token), [selected])
        duplicate = storage / token
        duplicate.mkdir()
        with self.assertRaisesRegex(ValueError, 'AMBIGUOUS_DESTINATION'):
            n.export_folders(storage, token)
        duplicate.rmdir()
        for index in range(513):
            (storage / ('bounded-' + str(index))).touch()
        with self.assertRaisesRegex(ValueError, 'DIRECTORY_BOUND'):
            n.export_folders(storage, token)

    def test_export_destination_requires_unique_fresh_baseline_real_save_one_file_and_honest_copy_metadata(self):
        storage = self.root / 'local-provider'
        token = 'C47 Synthetic Export ' + 'b' * 16
        selected = storage / token
        selected.mkdir(parents=True)
        candidate = selected / 'export.json'
        raw = json.dumps(self.export_fixture()).encode()
        candidate.write_bytes(raw)
        now = time.time()
        root_info = storage.lstat()
        context = {'storage': storage, 'root_identity': (root_info.st_dev, root_info.st_ino),
                   'token': token, 'started_epoch_ms': int((now - 10) * 1000),
                   'folder_absent_before_export': True, 'destination': None}
        observation = {'export_outcome': 'verification_required', 'local_location_selected': True,
                       'save_dispatched': True, 'folder_navigation_confirmed': True,
                       'returned_to_owner_controls': True, 'provider': 'on_my_iphone',
                       'folder_token': token, 'dispatch_epoch_ms': int((now - 5) * 1000)}
        actual_lstat = Path.lstat
        info = actual_lstat(candidate)
        birth = [now - 1]
        def lstat(path, *args, **kwargs):
            if path == candidate:
                return SimpleNamespace(st_mode=info.st_mode, st_ino=info.st_ino, st_birthtime=birth[0])
            return actual_lstat(path, *args, **kwargs)
        # Portable parser fixtures never claim a native Save. Copied birth
        # metadata is reported honestly; actual freshness requires the baseline.
        with patch.object(Path, 'lstat', lstat), patch.object(n, 'read_native_file', return_value=raw):
            summary = n.verify_export_destination(context, observation)
            self.assertEqual(summary['export_outcome'], 'local_saved')
            self.assertEqual(summary['sha256'], hashlib.sha256(raw).hexdigest())
            self.assertNotIn(str(selected), json.dumps(summary))
            for field, value in [('save_dispatched', False), ('folder_navigation_confirmed', False),
                                 ('provider', 'cloud'), ('returned_to_owner_controls', False),
                                 ('folder_token', 'wrong')]:
                with self.subTest(field=field), self.assertRaises(ValueError):
                    n.verify_export_destination(context, dict(observation, **{field: value}))
            birth[0] = now - 100
            copied = n.verify_export_destination(context, observation)
            self.assertEqual(copied['birth_metadata_status'], 'PREDATES_SAVE_COPY_METADATA_POSSIBLE')
            self.assertFalse(copied['birth_metadata_is_save_provenance'])
            with self.assertRaisesRegex(ValueError, 'ABSENT_BEFORE_BASELINE'):
                n.verify_export_destination(dict(context, folder_absent_before_export=False), observation)
            birth[0] = now + 60
            with self.assertRaisesRegex(ValueError, 'FUTURE_BIRTH_METADATA'):
                n.verify_export_destination(context, observation)
            birth[0] = now - 1
            (selected / 'ambiguous.json').write_bytes(raw)
            with self.assertRaisesRegex(ValueError, 'FILE_NOT_UNAMBIGUOUS'):
                n.verify_export_destination(context, observation)



    def test_same_source_app_consumer_rejects_archive_and_admission_tampering(self):
        # Synthetic archive shape only; this test executes no product probes, Mach-O or iOS.
        import io
        content = b'synthetic bytes, not a native binary'
        rows = [{'path': name, 'type': 'file', 'mode': mode, 'bytes': len(content),
                 'sha256': hashlib.sha256(content).hexdigest()} for name, mode in
                [('Info.plist', '0o644'), ('LayerwellStaging', '0o755'), ('main.jsbundle', '0o644')]]

        def archive_bytes(change=None, replacement=None):
            raw = io.BytesIO()
            with n.tarfile.open(fileobj=raw, mode='w:gz') as target:
                root = n.tarfile.TarInfo('LayerwellStaging.app')
                root.type, root.mode = n.tarfile.DIRTYPE, 0o755
                root.pax_headers = {'path': root.name + '/', 'mtime': '1.0'}
                target.addfile(root)
                for index, row in enumerate(rows):
                    member = n.tarfile.TarInfo('LayerwellStaging.app/' + row['path'])
                    member.mode, member.size = int(row['mode'], 8), len(content)
                    value = replacement if replacement is not None and index == 0 else content
                    if change is not None and index == 0:
                        change(member)
                    target.addfile(member, io.BytesIO(value) if member.isfile() else None)
            return raw.getvalue()

        valid = archive_bytes()
        observed = n._produced_app_tar_pass(io.BytesIO(valid), rows)
        self.assertEqual((observed['members'], observed['regular_bytes']), (4, 3 * len(content)))
        self.assertIn('NOT_MACH_O_OR_RUNTIME', observed['qualification'])
        mutations = [lambda m: setattr(m, 'name', '../escape'),
                     lambda m: setattr(m, 'name', '/LayerwellStaging.app/Info.plist'),
                     lambda m: setattr(m, 'name', 'LayerwellStaging.app/../escape'),
                     lambda m: setattr(m, 'name', 'LayerwellStaging.app/info.plist'),
                     lambda m: setattr(m, 'name', 'LayerwellStaging.app/Info.plist:stream'),
                     lambda m: setattr(m, 'mode', 0o777),
                     lambda m: (setattr(m, 'type', n.tarfile.SYMTYPE), setattr(m, 'linkname', '../outside')),
                     lambda m: (setattr(m, 'type', n.tarfile.LNKTYPE), setattr(m, 'linkname', 'LayerwellStaging.app/LayerwellStaging')),
                     lambda m: setattr(m, 'type', n.tarfile.FIFOTYPE)]
        for index, change in enumerate(mutations):
            with self.subTest(archive_mutation=index), self.assertRaises(ValueError):
                n._produced_app_tar_pass(io.BytesIO(archive_bytes(change)), rows)
        with self.assertRaisesRegex(ValueError, 'IMPORTED_APP_FILE_HASH'):
            n._produced_app_tar_pass(io.BytesIO(archive_bytes(replacement=b'X' * len(content))), rows)
        for changed in [rows[1:], rows + [dict(rows[0], path='info.plist')],
                        [dict(rows[0], sha256='0' * 64), *rows[1:]],
                        [dict(rows[0], path='e\u0301'), *rows[1:]]]:
            with self.subTest(inventory=changed), self.assertRaises(ValueError):
                n._produced_app_tar_pass(io.BytesIO(valid), changed)
        head, tree = 'a' * 40, 'b' * 40
        producer = self.root / 'producer'
        producer.mkdir()
        (producer / 'signed-simulator-app.tar.gz').write_bytes(valid)
        inventory = {'source': {'head': head, 'tree': tree}, 'lane': 'normal-staging',
                     'configuration': 'Release', 'files': rows}
        inventory_raw = json.dumps(inventory).encode()
        (producer / 'app-inventory.json').write_bytes(inventory_raw)
        receipt = {'file': 'signed-simulator-app.tar.gz', 'bytes': len(valid),
            'sha256': hashlib.sha256(valid).hexdigest(), 'source_head': head,
            'inventory_sha256': hashlib.sha256(inventory_raw).hexdigest(),
            'lane': 'normal-staging', 'configuration': 'Release', 'standalone_embedded_javascript': True,
            'not_an_iphone_or_testflight_release': True, 'platform': 'iOS Simulator',
            'architectures': ['x86_64'], 'bundle_id': 'com.layerwell.app.staging', 'executable': 'LayerwellStaging'}
        runner = SimpleNamespace(receipt={'source': {'head': head, 'tree': tree}},
                                 text=lambda *args: self.fail('Synthetic control must never invoke a native product probe'))
        destination = self.root / 'new-app'
        with patch.dict(n.os.environ, {'RUNNER_TEMP': str(self.root)}):
            for field, value in [('source_head', 'c' * 40), ('lane', 'internal-supported-owner'),
                                 ('configuration', 'Debug'), ('standalone_embedded_javascript', False),
                                 ('not_an_iphone_or_testflight_release', False), ('architectures', ['arm64']),
                                 ('inventory_sha256', '0' * 64), ('sha256', '0' * 64), ('bytes', len(valid) + 1)]:
                (producer / 'app-artifact.json').write_bytes(json.dumps(dict(receipt, **{field: value})).encode())
                with self.subTest(admission_field=field), self.assertRaises(ValueError):
                    n.consume_produced_app(runner, producer, head, 'x86_64', destination)
                self.assertFalse(destination.exists())
            (producer / 'app-artifact.json').write_bytes(json.dumps(receipt).encode())
            runner.receipt['source']['tree'] = 'c' * 40
            with self.assertRaisesRegex(ValueError, 'IMPORTED_APP_INVENTORY_IDENTITY'):
                n.consume_produced_app(runner, producer, head, 'x86_64', destination)
            runner.receipt['source']['tree'] = tree
            destination.mkdir()
            marker = destination / 'preserved'
            marker.write_bytes(b'unchanged')
            with self.assertRaisesRegex(ValueError, 'IMPORTED_APP_FRESH_RUNNER_TEMP'):
                n.consume_produced_app(runner, producer, head, 'x86_64', destination)
            self.assertEqual(marker.read_bytes(), b'unchanged')
            with self.assertRaisesRegex(ValueError, 'INTEL_SIMULATOR_HOST_REQUIRED'):
                n.consume_produced_app(runner, producer, head, 'arm64', self.root / 'other')


STAGE_TEST_CONTEXT = {'repository': 'TasfiqJ/onSkin', 'run_id': 1001, 'run_attempt': 2,
           'head': 'a' * 40, 'tree': 'b' * 40}

def stage_fixture_encoded(value):
    return (json.dumps(value, sort_keys=True) + '\n').encode()

class StageControls(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='c47-stage-pure-')
        self.root = Path(self.temporary.name).resolve()
        self.serial = 0

    def tearDown(self):
        self.temporary.cleanup()

    def unique(self, label):
        self.serial += 1
        return self.root / (str(self.serial) + '-' + label)

    def service(self, expected, wire_bytes):
        run = {'id': STAGE_TEST_CONTEXT['run_id'], 'run_attempt': STAGE_TEST_CONTEXT['run_attempt'],
               'head_sha': STAGE_TEST_CONTEXT['head'], 'head_branch': n.STAGE_BRANCH,
               'event': 'pull_request', 'path': n.STAGE_WORKFLOW,
               'repository': {'full_name': STAGE_TEST_CONTEXT['repository'], 'private': False},
               'head_repository': {'full_name': STAGE_TEST_CONTEXT['repository']}}
        job = {'id': 7001, 'run_id': STAGE_TEST_CONTEXT['run_id'], 'head_sha': STAGE_TEST_CONTEXT['head'],
               'name': n.STAGE_JOB_NAMES[expected['stage']], 'status': 'completed',
               'conclusion': 'success', 'run_attempt': STAGE_TEST_CONTEXT['run_attempt']}
        jobs = {'total_count': 1, 'jobs': [job]}
        artifact = {'id': expected['artifact_id'], 'name': expected['artifact_name'],
                    'expired': False, 'digest': 'sha256:' + expected['digest'],
                    'size_in_bytes': wire_bytes,
                    'workflow_run': {'id': STAGE_TEST_CONTEXT['run_id'], 'head_sha': STAGE_TEST_CONTEXT['head'],
                                     'head_branch': n.STAGE_BRANCH}}
        return run, jobs, artifact

    def package(self, role='build', change_execution=None, change_manifest=None,
                change_members=None, extra_entries=()):
        producer = self.unique('producer')
        producer.mkdir()
        execution = {'stage': role, 'stage_complete': True,
                     'source': {'head': STAGE_TEST_CONTEXT['head'], 'tree': STAGE_TEST_CONTEXT['tree']},
                     'job_context': {key: STAGE_TEST_CONTEXT[key] for key in ('repository', 'run_id', 'run_attempt')},
                     'acceptance_granted': False, 'campaign_candidate_complete': False, 'release': 'NO_GO'}
        execution['job_context'].update(job_name=n.STAGE_JOB_NAMES[role], job_id='native-' + role)
        if change_execution:
            change_execution(execution)
        (producer / 'execution.json').write_bytes(stage_fixture_encoded(execution))
        (producer / 'logs').mkdir()
        (producer / 'logs' / 'actual.stdout').write_bytes(b'controlled local fixture\n')
        receipt = n.write_stage_provenance(producer, role, STAGE_TEST_CONTEXT)
        members = {path.relative_to(producer).as_posix(): path.read_bytes()
                   for path in producer.rglob('*') if path.is_file()}
        if change_manifest:
            manifest = json.loads(members[n.STAGE_MANIFEST])
            change_manifest(manifest)
            members[n.STAGE_MANIFEST] = stage_fixture_encoded(manifest)
        if change_members:
            change_members(members)
        archive = self.unique('artifact.zip')
        with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_STORED) as bundle:
            for name, raw in [*sorted(members.items()), *extra_entries]:
                info = zipfile.ZipInfo(name, (2026, 11, 5, 0, 0, 0))
                info.create_system = 3
                info.external_attr = (stat.S_IFREG | 0o644) << 16
                bundle.writestr(info, raw)
        needs = {'artifact_id': 9001, 'digest': hashlib.sha256(archive.read_bytes()).hexdigest(),
                 'run_id': STAGE_TEST_CONTEXT['run_id'], 'producer_run_attempt': STAGE_TEST_CONTEXT['run_attempt'],
                 'payload_bytes': sum(len(raw) for raw in members.values()) +
                                  sum(len(raw) for _, raw in extra_entries)}
        expected = n.stage_expected(role, needs, STAGE_TEST_CONTEXT)
        service = self.service(expected, archive.stat().st_size)
        proof = n.stage_service_proof(expected, *service)
        return archive, expected, proof, service, receipt

    def reject_archive(self, package):
        with self.assertRaises((ValueError, zipfile.BadZipFile)):
            n.verify_stage_zip(*package[:3], self.unique('import'))

    def test_01_actual_writer_zip_and_all_hashes(self):
        for role in ('build', 'normal'):
            with self.subTest(role=role):
                package = self.package(role=role)
                output = self.unique('import')
                result = n.verify_stage_zip(*package[:3], output)
                self.assertTrue(result['all_file_hashes_and_crc_verified'])
                self.assertFalse(result['current_runner_commands_imported'])
                self.assertTrue(result['driver_app_or_named_xctest_admission_still_required'])
                self.assertEqual(result['payload_bytes'], package[4]['payload_bytes'])
                self.assertEqual(result['manifest_sha256'], package[4]['manifest_sha256'])
                for path in output.rglob('*'):
                    if path.is_file():
                        self.assertTrue(stat.S_ISREG(path.lstat().st_mode))

    def test_02_finite_dependencies_and_same_attempt(self):
        self.assertEqual(n.stage_dependencies('legacy25-normal', {'build': {}}), ('build',))
        self.assertEqual(n.stage_dependencies('source', {}), ())
        self.assertEqual(n.stage_dependencies('build', {'source': {}}), ('source',))
        self.assertEqual(n.stage_dependencies('normal', {'source': {}, 'build': {}}), ('source', 'build'))
        self.assertEqual(n.stage_dependencies('internal', {'source': {}, 'build': {}, 'normal': {}}), ('source', 'build', 'normal'))
        for role, needs in [('normal', {}), ('normal', {'normal': {}}),
                            ('internal', {'build': {}}), ('internal', {'build': {}, 'normal': {}, 'other': {}})]:
            with self.subTest(role=role, needs=list(needs)), self.assertRaises(ValueError):
                n.stage_dependencies(role, needs)
        package = self.package()
        expected = package[1]
        needs = {'artifact_id': expected['artifact_id'], 'digest': expected['digest'],
                 'run_id': expected['run_id'], 'producer_run_attempt': expected['run_attempt'],
                 'payload_bytes': expected['payload_bytes']}
        for key, value in [('run_id', 1002), ('producer_run_attempt', 1), ('digest', None),
                           ('digest', 'sha256:' + expected['digest']), ('artifact_id', True),
                           ('payload_bytes', 0), ('payload_bytes', n.STAGE_MAX_PAYLOAD + 1)]:
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                n.stage_expected('build', {**needs, key: value}, STAGE_TEST_CONTEXT)

    def test_03_run_source_attempt_repo_and_workflow_refusals(self):
        package = self.package()
        run, jobs, artifact = package[3]
        mutations = [('id', 1002), ('run_attempt', 1), ('head_sha', 'c' * 40),
                     ('head_branch', 'other'), ('path', '.github/workflows/other.yml'),
                     ('event', 'workflow_dispatch'), ('repository', {'full_name': 'other/repo', 'private': False}),
                     ('head_repository', {'full_name': 'other/repo'})]
        for key, value in mutations:
            with self.subTest(key=key), self.assertRaises(ValueError):
                n.stage_service_proof(package[1], {**run, key: value}, jobs, artifact)

    def test_04_unique_completed_job_and_optional_attempt(self):
        package = self.package()
        run, jobs, artifact = package[3]
        without_attempt = copy.deepcopy(jobs)
        del without_attempt['jobs'][0]['run_attempt']
        self.assertEqual(n.stage_service_proof(package[1], run, without_attempt, artifact)['producer_job_id'], 7001)
        for key, value in [('name', 'C47 normal'), ('conclusion', 'failure'), ('status', 'in_progress'),
                           ('head_sha', 'c' * 40), ('run_attempt', 1), ('run_id', 1002)]:
            changed = copy.deepcopy(jobs)
            changed['jobs'][0][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                n.stage_service_proof(package[1], run, changed, artifact)
        for changed in [{'total_count': 2, 'jobs': jobs['jobs'] * 2},
                        {'total_count': 101, 'jobs': jobs['jobs']}, {'total_count': 0, 'jobs': []}]:
            with self.subTest(changed=changed['total_count']), self.assertRaises(ValueError):
                n.stage_service_proof(package[1], run, changed, artifact)

    def test_05_service_artifact_identity_and_populated_digest(self):
        package = self.package()
        run, jobs, artifact = package[3]
        for key, value in [('id', 9002), ('name', 'stale'), ('expired', True), ('digest', None),
                           ('digest', 'sha256:' + 'c' * 64), ('workflow_run', None),
                           ('workflow_run', {**artifact['workflow_run'], 'id': 1002}),
                           ('size_in_bytes', 0), ('size_in_bytes', True)]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                n.stage_service_proof(package[1], run, jobs, {**artifact, key: value})

    def test_06_raw_wire_and_dual_anchor_refusals(self):
        package = self.package()
        for changed in [{**package[2], 'wire_sha256': 'c' * 64},
                        {**package[2], 'service_digest': 'sha256:' + 'c' * 64},
                        {**package[2], 'wire_bytes': package[2]['wire_bytes'] + 1}]:
            self.reject_archive((package[0], package[1], changed))
        with package[0].open('ab') as stream:
            stream.write(b'changed raw wire')
        self.reject_archive(package)

    def test_07_rehashed_contradictory_manifest_refusals(self):
        mutations = [lambda value: value.update(stage='normal'),
                     lambda value: value.update(run_attempt=1),
                     lambda value: value.update(source={'head': 'c' * 40, 'tree': STAGE_TEST_CONTEXT['tree']}),
                     lambda value: value['files'][0].update(sha256='c' * 64),
                     lambda value: value['files'][0].update(bytes=0)]
        for mutation in mutations:
            with self.subTest(mutation=mutations.index(mutation)):
                self.reject_archive(self.package(change_manifest=mutation))

    def test_08_exact_inventory_missing_and_extra_members(self):
        for mutation in [lambda files: files.pop('logs/actual.stdout'),
                         lambda files: files.update({'extra.txt': b'extra'}),
                         lambda files: files.pop('stage-provenance.json')]:
            with self.subTest(mutation=str(mutation)):
                self.reject_archive(self.package(change_members=mutation))

    def test_09_duplicate_json_and_member_hash_refusals(self):
        self.reject_archive(self.package(change_members=lambda files:
                            files.update({'stage-provenance.json': b'{"schema":1,"schema":1}'})))
        self.reject_archive(self.package(change_members=lambda files:
                            files.update({'logs/actual.stdout': b'altered member'})))
        with self.assertRaises(ValueError):
            n.stage_json(b'{"x":1,"x":2}')

    def test_10_complete_current_stage_context_required(self):
        mutations = [lambda value: value.update(stage_complete=False),
                     lambda value: value.update(failure={'type': 'RuntimeError'}),
                     lambda value: value.update(collection_failure={'type': 'RuntimeError'}),
                     lambda value: value.update(stage='normal'),
                     lambda value: value['source'].update(tree='c' * 40),
                     lambda value: value['job_context'].update(job_name='C47 normal'),
                     lambda value: value['job_context'].update(run_attempt=1),
                     lambda value: value['job_context'].update(job_id='native-normal'),
                     lambda value: value.update(acceptance_granted=True),
                     lambda value: value.update(campaign_candidate_complete=True),
                     lambda value: value.update(release='GO')]
        for index, mutation in enumerate(mutations):
            with self.subTest(index=index):
                self.reject_archive(self.package(change_execution=mutation))

    def test_11_canonical_paths_aliases_collisions_and_duplicates(self):
        for name in ['../escape', '/absolute', 'a\\b', 'AUX.txt', 'a/../b', 'a./b', 'a//b', 'a:b']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                n.stage_name(name)
        for entries in [(('Logs/other.txt', b'x'),), (('logs', b'x'),),
                        (('logs/actual.stdout', b'x'),), (('../escape', b'x'),)]:
            with self.subTest(entries=[name for name, _ in entries]):
                self.reject_archive(self.package(extra_entries=entries))

    def test_12_symlink_member_and_bad_crc_refusals(self):
        package = self.package()
        with zipfile.ZipFile(package[0], 'a') as bundle:
            info = zipfile.ZipInfo('link')
            info.create_system = 3
            info.external_attr = (stat.S_IFLNK | 0o777) << 16
            bundle.writestr(info, b'elsewhere')
        raw = package[0].read_bytes()
        expected = {**package[1], 'digest': hashlib.sha256(raw).hexdigest(),
                    'payload_bytes': package[1]['payload_bytes'] + len(b'elsewhere')}
        proof = n.stage_service_proof(expected, *self.service(expected, len(raw)))
        self.reject_archive((package[0], expected, proof))
        package = self.package()
        raw = package[0].read_bytes().replace(b'controlled local fixture', b'controlled local fixturE', 1)
        package[0].write_bytes(raw)
        expected = {**package[1], 'digest': hashlib.sha256(raw).hexdigest()}
        proof = n.stage_service_proof(expected, *self.service(expected, len(raw)))
        self.reject_archive((package[0], expected, proof))

    def test_13_strict_blob_redirect_policy_without_network(self):
        allowed = 'https://example.blob.core.windows.net/container/blob?sig=synthetic'
        self.assertEqual(n.stage_blob_location(allowed), allowed)
        for value in ['http://example.blob.core.windows.net/x', 'https://api.github.com/x',
                      'https://example.blob.core.windows.net.evil.test/x',
                      'https://u:p@example.blob.core.windows.net/x',
                      'https://example.blob.core.windows.net:444/x',
                      'https://example.blob.core.windows.net/x#fragment',
                      'https://example.blob.core.windows.net/x\r\nAuthorization: secret']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                n.stage_blob_location(value)
        self.assertIsNone(n._StageNoRedirect().redirect_request(None, None, 302, '', {}, allowed))

    def test_14_producer_writer_is_single_use_and_identity_bound(self):
        producer = self.unique('producer')
        producer.mkdir()
        (producer / 'execution.json').write_bytes(b'{}')
        with self.assertRaises(ValueError):
            n.write_stage_provenance(producer, 'build', {**STAGE_TEST_CONTEXT, 'repository': 'other/repo'})
        n.write_stage_provenance(producer, 'build', STAGE_TEST_CONTEXT)
        with self.assertRaises(ValueError):
            n.write_stage_provenance(producer, 'build', STAGE_TEST_CONTEXT)

    def test_15_existing_import_directory_and_payload_bound_refusals(self):
        package = self.package()
        output = self.unique('already-exists')
        output.mkdir()
        with self.assertRaises(ValueError):
            n.verify_stage_zip(*package[:3], output)
        changed = {**package[1], 'payload_bytes': package[1]['payload_bytes'] + 1}
        self.reject_archive((package[0], changed, package[2]))

    def test_16_import_output_boundaries_refuse_before_api_access(self):
        workspace, evidence = self.root / 'source', self.root / 'evidence'
        workspace.mkdir()
        evidence.mkdir()
        context = {**STAGE_TEST_CONTEXT, 'runner_temp': str(self.root), 'workspace': str(workspace),
                   'evidence_root': str(evidence)}
        original_api = n._stage_api
        def forbidden_api(*args, **kwargs):
            self.fail('Network/API boundary must not be reached')
        n._stage_api = forbidden_api
        try:
            for output in [workspace / 'new', evidence / 'new', self.root.parent / 'outside-new']:
                with self.subTest(output=output.name), self.assertRaisesRegex(ValueError, 'STAGE_IMPORT_OUTSIDE_CURRENT_SOURCE'):
                    n.load_authenticated_stage_inputs('normal', {'source': {}, 'build': {}}, context, 'unused', output)
            with self.assertRaisesRegex(ValueError, 'STAGE_DEPENDENCIES'):
                n.load_authenticated_stage_inputs('build', {}, context, 'unused', self.root / 'new')
            with self.assertRaisesRegex(ValueError, 'STAGE_BUILD_HAS_NO_IMPORTED_INPUTS'):
                n.load_authenticated_stage_inputs('source', {}, context, 'unused', self.root / 'new')
        finally:
            n._stage_api = original_api

    def test_17_manifest_and_execution_reject_boolean_integer_aliases(self):
        package = self.package()
        expected = {**package[1], 'run_id': 1, 'run_attempt': 1}
        with zipfile.ZipFile(package[0]) as archive:
            manifest = json.loads(archive.read(n.STAGE_MANIFEST))
            execution = json.loads(archive.read('execution.json'))
        manifest.update(run_id=1, run_attempt=1)
        execution['job_context'].update(run_id=1, run_attempt=1)
        n._stage_manifest_identity(manifest, expected)
        n.stage_execution_identity(execution, expected)
        for field in ('run_id', 'run_attempt'):
            changed = copy.deepcopy(manifest)
            changed[field] = True
            with self.subTest(document='manifest', field=field), self.assertRaises(ValueError):
                n._stage_manifest_identity(changed, expected)
            changed = copy.deepcopy(execution)
            changed['job_context'][field] = True
            with self.subTest(document='execution', field=field), self.assertRaises(ValueError):
                n.stage_execution_identity(changed, expected)

SIM_UNIT_UUID = '32221348-85D6-4745-953B-6B9B8B8BCDDE'
SIM_UNIT_BUNDLE = 'com.layerwell.app.staging'


def simulator_unit_inventory():
    # Finite relevant projection of authenticated native9 inventory; never a live Simulator proof.
    versions = [('26.2', '26-2', 'iPhone 16e', 'iPhone-16e'),
                ('26.4.1', '26-4', 'iPhone 17e', 'iPhone-17e'),
                ('26.5', '26-5', 'iPhone 17e', 'iPhone-17e')]
    return {'runtimes': [{'identifier': 'com.apple.CoreSimulator.SimRuntime.iOS-' + tag,
                'isAvailable': True, 'version': version, 'supportedArchitectures': ['x86_64', 'arm64']}
                for version, tag, _, _ in versions],
            'devices': {'com.apple.CoreSimulator.SimRuntime.iOS-' + tag: [
                {'name': name, 'isAvailable': True,
                 'deviceTypeIdentifier': 'com.apple.CoreSimulator.SimDeviceType.' + kind}]
                for _, tag, name, kind in versions}}


class FakeRunner:
    def __init__(self, output, inventory):
        self.output = output
        self.inventory = inventory
        self.receipt = {'source': {'head': 'ae3d33b57e3597f815c561823b20d4e713d7416c'}}
        self.calls = []
        self.failures = {}
        self.registry = {'com.apple.Preferences': {'CFBundleIdentifier': 'com.apple.Preferences'}}
        self.registry_raw = b'{ "com.apple.Preferences" = { CFBundleIdentifier = "com.apple.Preferences"; }; }'
        self.container = output / 'Installed.app'
        self.container.mkdir()
        (output / 'toolchain.json').write_text(json.dumps({'simulator-sdk': '26.4', 'architecture': 'x86_64'}))

    def persist(self):
        pass

    def run(self, name, argv, **kwargs):
        self.calls.append((name, list(map(str, argv)), kwargs))
        if name in self.failures:
            raise self.failures[name]
        stdout, stderr = self.output / (name + '.stdout'), self.output / (name + '.stderr')
        stdout.write_bytes(self.registry_raw if name == 'simulator-registry-ready' else b'')
        stderr.write_bytes(b'')
        return stdout, stderr

    def text(self, name, argv, **kwargs):
        self.run(name, argv, **kwargs)
        return {
            'simulator-inventory': json.dumps(self.inventory),
            'simulator-create': SIM_UNIT_UUID,
            'simulator-registry-json': json.dumps(self.registry),
            'simulator-installed-container': str(self.container),
        }.get(name, '')

class SimulatorProposalTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='c47-sim-proposal-', dir=Path(tempfile.gettempdir()).resolve())
        self.addCleanup(self.temp.cleanup)
        self.inventory = simulator_unit_inventory()
        self.r = FakeRunner(Path(self.temp.name), self.inventory)

    def ready(self):
        return n.prepare_simulator(self.r, 'normal')

    def names(self):
        return [row[0] for row in self.r.calls]

    def test_inventory_prefers_sdk_major_minor_then_compact(self):
        runtime, device = n.available_iphone(self.inventory, '26.4', 'x86_64')
        self.assertEqual(runtime['version'], '26.4.1')
        self.assertEqual(device['name'], 'iPhone 17e')
        self.assertIn('x86_64', runtime['supportedArchitectures'])

    def test_legacy_selection_is_unchanged_without_toolchain_arguments(self):
        runtime, device = n.available_iphone(self.inventory)
        self.assertEqual((runtime['version'], device['name']), ('26.2', 'iPhone 16e'))

    def test_partial_invalid_or_unsupported_toolchain_is_refused(self):
        for args in [('26.4',), ('bad', 'x86_64'), ('26.4', 'AMD64')]:
            with self.subTest(args=args), self.assertRaises(ValueError):
                n.available_iphone(self.inventory, *args)
        value = copy.deepcopy(self.inventory)
        for row in value['runtimes']:
            row['supportedArchitectures'] = ['arm64']
        with self.assertRaisesRegex(ValueError, 'NO_AVAILABLE_SUPPORTED_IPHONE_RUNTIME'):
            n.available_iphone(value, '26.4', 'x86_64')

    def test_unavailable_under17_or_unlisted_runtime_never_admits(self):
        for change in ('unavailable', 'old', 'missing'):
            value = copy.deepcopy(self.inventory)
            for row in value['runtimes']:
                if change == 'unavailable':
                    row['isAvailable'] = False
                elif change == 'old':
                    row['version'] = '16.4'
            if change == 'missing':
                value['devices'] = {}
            with self.subTest(change=change), self.assertRaises(ValueError):
                n.available_iphone(value, '26.4', 'x86_64')

    def test_fresh_prepare_binds_actual_uuid_and_records_preference_without_width_claim(self):
        self.assertEqual(self.ready(), SIM_UNIT_UUID)
        self.assertEqual(self.r.receipt['simulator']['runtime']['version'], '26.4.1')
        self.assertTrue(self.r.receipt['simulator']['selection']['sdk_major_minor_match'])
        self.assertFalse(self.r.receipt['simulator']['selection']['logical_width_qualified'])
        row = next(row for row in self.r.calls if row[0] == 'simulator-bootstatus')
        self.assertEqual(row[2]['timeout'], 600)
        self.assertEqual(self.names().count('simulator-create'), 1)
        self.assertEqual(self.names().count('simulator-inventory'), 1)
        inventory = next(row for row in self.r.calls if row[0] == 'simulator-inventory')
        self.assertEqual(inventory[2]['timeout'], 300)
        self.assertLess(self.names().index('simulator-before-inventory-processes'),
                        self.names().index('simulator-inventory'))
        self.assertFalse(any(name.startswith('simulator-help-') for name in self.names()))
        self.assertNotIn('stages', self.r.receipt)

    def test_inventory_failure_before_uuid_preserves_primary_and_host_diagnostics_without_retry(self):
        primary = RuntimeError('actual first service command timeout fixture')
        self.r.failures = {'simulator-inventory': primary, 'simulator-host-service-log': OSError('diagnostic fixture')}
        with self.assertRaises(RuntimeError) as raised:
            self.ready()
        self.assertIs(raised.exception, primary)
        self.assertEqual(self.names().count('simulator-inventory'), 1)
        self.assertNotIn('simulator-create', self.names())
        self.assertNotIn('simulator-boot', self.names())
        self.assertNotIn('simulator-installer-log', self.names())
        self.assertIn('simulator-host-service-log', self.names())
        diagnostic = [row for row in self.r.calls if row[0].startswith('simulator-startup-failure-') or
                      row[0] == 'simulator-host-service-log']
        self.assertEqual(sum(row[2]['timeout'] for row in diagnostic), 55)
        self.assertTrue(all(row[2]['diagnostic'] and not row[2]['required'] for row in diagnostic))
        self.assertNotIn('simulator', self.r.receipt)
        self.assertNotIn('stages', self.r.receipt)

    def test_boot_failure_after_fresh_uuid_preserves_primary_and_scoped_guest_host_diagnostics(self):
        primary = RuntimeError('actual boot timeout fixture')
        self.r.failures = {'simulator-boot': primary}
        with self.assertRaises(RuntimeError) as raised:
            self.ready()
        self.assertIs(raised.exception, primary)
        self.assertEqual(self.r.receipt['simulator']['udid'], SIM_UNIT_UUID)
        self.assertEqual(self.names().count('simulator-create'), 1)
        self.assertEqual(self.names().count('simulator-boot'), 1)
        self.assertNotIn('simulator-bootstatus', self.names())
        self.assertIn('simulator-installer-log', self.names())
        self.assertIn('simulator-host-service-log', self.names())
        self.assertFalse(any('erase' in row[1] or 'uninstall' in row[1] for row in self.r.calls))
        self.assertNotIn('stages', self.r.receipt)

    def test_available_fallback_is_recorded_as_non_matching(self):
        self.r.inventory = copy.deepcopy(self.inventory)
        for row in self.r.inventory['runtimes']:
            if row['version'] == '26.4.1':
                row['isAvailable'] = False
        self.ready()
        self.assertFalse(self.r.receipt['simulator']['selection']['sdk_major_minor_match'])

    def test_success_uses_one_install600_then_actual_container_and_no_stage_pass(self):
        device = self.ready()
        self.assertEqual(n.install_simulator_app(self.r, device, 'Authenticated.app', SIM_UNIT_BUNDLE), str(self.r.container))
        install = next(row for row in self.r.calls if row[0] == 'simulator-install')
        self.assertEqual(install[2]['timeout'], 600)
        self.assertEqual(self.names().count('simulator-install'), 1)
        self.assertLess(self.names().index('simulator-registry-json'), self.names().index('simulator-install'))
        self.assertLess(self.names().index('simulator-install'), self.names().index('simulator-installed-container'))
        lookup = next(row for row in self.r.calls if row[0] == 'simulator-installed-container')
        self.assertEqual(lookup[2]['timeout'], 300)
        self.assertEqual(self.names().count('simulator-installed-container'), 1)
        self.assertNotIn('stages', self.r.receipt)
        self.assertFalse(any('erase' in row[1] or 'uninstall' in row[1] for row in self.r.calls))

    def test_existing_target_under_key_or_bundle_field_refuses_before_install(self):
        device = self.ready()
        for registry in [{SIM_UNIT_BUNDLE: {}}, {'different-key': {'CFBundleIdentifier': SIM_UNIT_BUNDLE}}]:
            self.r.registry = registry
            with self.subTest(registry=registry), self.assertRaisesRegex(ValueError, 'TARGET_ALREADY_INSTALLED'):
                n.install_simulator_app(self.r, device, 'Authenticated.app', SIM_UNIT_BUNDLE)
        self.assertNotIn('simulator-install', self.names())

    def test_empty_raw_or_malformed_registry_refuses_before_install(self):
        device = self.ready()
        for raw, registry in [(b'', {}), (b'nonempty', []), (b'nonempty', {}), (b'nonempty', {'x': []})]:
            self.r.registry_raw, self.r.registry = raw, registry
            with self.subTest(raw=raw, registry=registry), self.assertRaises(ValueError):
                n.install_simulator_app(self.r, device, 'Authenticated.app', SIM_UNIT_BUNDLE)
        self.assertNotIn('simulator-install', self.names())

    def test_install_failure_is_preserved_with_diagnostics_failure_and_no_retry(self):
        device = self.ready()
        primary = RuntimeError('actual install timeout fixture')
        self.r.failures = {'simulator-install': primary, 'simulator-installer-log': OSError('diagnostic fixture')}
        with self.assertRaises(RuntimeError) as raised:
            n.install_simulator_app(self.r, device, 'Authenticated.app', SIM_UNIT_BUNDLE)
        self.assertIs(raised.exception, primary)
        self.assertEqual(self.names().count('simulator-install'), 1)
        self.assertIn('simulator-host-service-log', self.names())
        self.assertNotIn('simulator-installed-container', self.names())
        self.assertNotIn('stages', self.r.receipt)
        diagnostic = [row for row in self.r.calls if row[0].startswith('simulator-install-failure-') or
                      row[0] in ('simulator-installer-log', 'simulator-host-service-log')]
        self.assertEqual(sum(row[2]['timeout'] for row in diagnostic), 80)
        self.assertTrue(all(row[2]['diagnostic'] and not row[2]['required'] for row in diagnostic))

    def test_missing_actual_container_fails_after_single_install_without_pass(self):
        device = self.ready()
        self.r.container.rmdir()
        with self.assertRaisesRegex(ValueError, 'INSTALLED_APP_CONTAINER'):
            n.install_simulator_app(self.r, device, 'Authenticated.app', SIM_UNIT_BUNDLE)
        self.assertEqual(self.names().count('simulator-install'), 1)
        self.assertNotIn('stages', self.r.receipt)

    def test_container_lookup_timeout_after_install_never_admits_or_reinstalls(self):
        device = self.ready()
        primary = TimeoutError('retained native19 container lookup timeout')
        self.r.failures = {'simulator-installed-container': primary}
        with self.assertRaises(TimeoutError) as raised:
            n.install_simulator_app(self.r, device, 'Authenticated.app', SIM_UNIT_BUNDLE)
        self.assertIs(raised.exception, primary)
        self.assertEqual(self.names().count('simulator-install'), 1)
        self.assertEqual(self.names().count('simulator-installed-container'), 1)
        self.assertIn('simulator-host-service-log', self.names())
        self.assertNotIn('stages', self.r.receipt)
        self.assertFalse(any('erase' in row[1] or 'uninstall' in row[1] for row in self.r.calls))

    def test_mismatched_device_is_rejected_before_install(self):
        self.ready()
        with self.assertRaises(ValueError):
            n.install_simulator_app(self.r, '11111111-1111-4111-8111-111111111111', 'Authenticated.app', SIM_UNIT_BUNDLE)
        self.assertNotIn('simulator-install', self.names())




class StageDriver47Tests(unittest.TestCase):

    def test_inherited_output_pipe_failure_freezes_actual_bytes_and_never_passes(self):
        with tempfile.TemporaryDirectory(dir=Path(tempfile.gettempdir()).resolve()) as temporary:
            root = Path(temporary)
            runner = n.Runner(root, root / 'evidence')
            # The real parent exits0; its real child holds both output pipes,
            # then emits data after the bounded close observation has failed.
            child = "import time;time.sleep(0.8);print('late-child-output',flush=True)"
            parent = "import subprocess,sys;subprocess.Popen([sys.executable,'-I','-c'," + repr(child) + "]);print('parent-output',flush=True)"
            join = n.threading.Thread.join
            with patch.object(n.threading.Thread, 'join', lambda thread, timeout=None: join(thread, 0.05)):
                with self.assertRaisesRegex(ValueError, 'COMMAND_FAILED:inherited-pipe'):
                    runner.run('inherited-pipe', [sys.executable, '-I', '-c', parent], timeout=3)
            row = runner.receipt['commands'][0]
            self.assertEqual((row['state'], row['exit_code'], row['process_exit_code']), ('FAIL', 125, 0))
            self.assertFalse(row['capture_complete'])
            self.assertEqual(row['error_type'], 'LOG_STREAM_DID_NOT_CLOSE')
            before = [(runner.output / row[s]).read_bytes() for s in ('stdout', 'stderr')]
            time.sleep(1)
            self.assertEqual(before, [(runner.output / row[s]).read_bytes() for s in ('stdout', 'stderr')])
            for stream in ('stdout', 'stderr'):
                raw = (runner.output / row[stream]).read_bytes()
                self.assertEqual(row[stream + '_bytes'], len(raw))
                self.assertEqual(row[stream + '_sha256'], hashlib.sha256(raw).hexdigest())
            self.assertEqual(runner.receipt['stages'], {})
            self.assertFalse(runner.receipt['acceptance_granted'])

    def test_slow_registry_read_keeps_real_parse_and_absence_before_single_install(self):
        with tempfile.TemporaryDirectory(dir=Path(tempfile.gettempdir()).resolve()) as temporary:
            runner = FakeRunner(Path(temporary), simulator_unit_inventory())
            device = n.prepare_simulator(runner, 'normal')
            n.install_simulator_app(runner, device, Path(temporary) / 'App.app', 'com.layerwell.app.staging')
            names = [row[0] for row in runner.calls]
            registry = next(row for row in runner.calls if row[0] == 'simulator-registry-ready')
            self.assertEqual(registry[2]['timeout'], 600)
            self.assertEqual(names.count('simulator-registry-ready'), 1)
            self.assertLess(names.index('simulator-registry-json'), names.index('simulator-install'))
            self.assertEqual(names.count('simulator-install'), 1)
    """Portable receipt boundaries, never a native execution claim."""
    def test_source_control_summary_without_thirty_current_named_cases_cannot_pass(self):
        source = Path(n.__file__).with_name('native_generated47.test.mjs').read_text(encoding='utf-8')
        names = n.re.findall(r"^test\('([^'\n]+)',", source, n.re.M)
        argv = ['node', '--test', 'scripts/release/full-app-j01/native_generated47.test.mjs']
        summary = '# tests 30\n# pass 30\n# fail 0\n# skipped 0\n# cancelled 0\n# todo 0\n'
        cases = ''.join('ok ' + str(index) + ' - ' + name + '\n' for index, name in enumerate(names, 1))
        valid = (cases + '1..30\n' + summary).encode()
        n.full_generated_control_proof(argv, valid, source)
        for raw in [summary.encode(), valid.replace(b'ok 1 - ', b'ok 2 - ', 1),
                    valid.replace(names[0].encode(), b'wrong test', 1),
                    valid.replace(b'1..30', b'1..0'), valid.replace(b'ok 1 - ', b'not ok 1 - ', 1),
                    valid.replace(names[0].encode(), (names[0] + ' # SKIP').encode(), 1)]:
            with self.subTest(raw=raw[:50]), self.assertRaises(ValueError):
                n.full_generated_control_proof(argv, raw, source)
        for command in [argv + ['--test-name-pattern=small'], ['node', 'fake.mjs']]:
            with self.assertRaisesRegex(ValueError, 'CONTROL_COMMAND'):
                n.full_generated_control_proof(command, valid, source)

    def test_installed_executable_is_bound_to_previously_authenticated_inventory_in_both_lanes(self):
        import plistlib
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            app, installed, output = root/'expected.app',root/'installed.app',root/'evidence'
            for directory in (app,installed,output):
                directory.mkdir()
            binary,javascript = b'fixture original executable',b'fixture current javascript'
            info = plistlib.dumps({'CFBundleIdentifier':'com.layerwell.app.staging',
                                   'CFBundleExecutable':'LayerwellStaging'})
            for directory in (app,installed):
                (directory/'Info.plist').write_bytes(info)
                (directory/'LayerwellStaging').write_bytes(binary)
                (directory/'main.jsbundle').write_bytes(javascript)
            def rows(directory):
                return [{'path':path.name,'type':'file','mode':'0o755' if path.name == 'LayerwellStaging' else '0o644',
                         'bytes':len(path.read_bytes()),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
                        for path in sorted(Path(directory).iterdir())]
            identity = {'bytes':len(binary),'sha256':hashlib.sha256(binary).hexdigest()}
            source = {'head':'a'*40,'tree':'b'*40}
            signed = {'synthetic_product_only':True}
            js = {'diagnostic_marker_present':False,'bytes':len(javascript),
                  'sha256':hashlib.sha256(javascript).hexdigest()}
            inventory = {'source':source,'configuration':'Release','lane':'normal-staging','files':rows(app),
                         'simulator_signing':signed,'ordinary_javascript':js}
            n.write_json(output/'app-inventory.json',inventory)
            inventory_sha = n.sha(output/'app-inventory.json')
            base = {'source':source,'simulator':{'udid':'current-device'},'stages':{}}
            compiled = {'bundle_id':'com.layerwell.app.staging','executable':'LayerwellStaging',
                        'inventory_sha256':inventory_sha,'source_head':source['head'],
                        'configuration':'Release','lane':'normal-staging'}
            imported = {'bundle_id':compiled['bundle_id'],'executable':compiled['executable'],
                        'authenticated_executable':identity,'producer_app_inventory_sha256':inventory_sha,
                        'source_head':source['head'],'source_tree':source['tree'],
                        'configuration':'Release','lane':'normal-staging'}
            signing = SimpleNamespace(inspect_product=lambda *args:signed,validate_ordinary_product=lambda *args:None,
                                      check_diagnostic_bundle=lambda *args:js)
            for lane,details in [('compiled',compiled),('verified-produced-app',imported)]:
                receipt = copy.deepcopy(base)
                receipt['stages'][lane] = {'status':'PASS','details':details}
                passed = []
                case_output = root/(lane+'-positive')
                case_output.mkdir()
                n.shutil.copy2(output/'app-inventory.json',case_output/'app-inventory.json')
                runner = SimpleNamespace(receipt=receipt,output=case_output,
                    passed=lambda name,proof:passed.append((name,proof)))
                with patch.object(n,'read_native_file',side_effect=lambda path:Path(path).read_bytes()),\
                     patch.object(n,'bundle_inventory',side_effect=rows),patch.object(n,'simulator_signing',return_value=signing):
                    n.verify_installed_app(runner,installed,app,compiled['bundle_id'])
                    self.assertEqual(passed[0][1]['authenticated_inventory_sha256'],inventory_sha)
                    for directory in (app,installed):
                        (directory/'LayerwellStaging').write_bytes(b'changed matching executable')
                    runner.output = root/(lane+'-negative')
                    runner.output.mkdir()
                    n.shutil.copy2(output/'app-inventory.json',runner.output/'app-inventory.json')
                    with self.assertRaisesRegex(ValueError,'INSTALLED_EXECUTABLE_BYTES'):
                        n.verify_installed_app(runner,installed,app,compiled['bundle_id'])
                    self.assertEqual(len(passed),1)
                for directory in (app,installed):
                    (directory/'LayerwellStaging').write_bytes(binary)


    def test_large_compiler_stream_is_hashed_and_tampering_or_duplicate_command_refuses(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'logs').mkdir()
            raw = b'compiler output\n' * (11 * n.MIB // 16 + 1)
            paths = [root / 'logs/build.stdout', root / 'logs/build.stderr']
            paths[0].write_bytes(raw)
            paths[1].write_bytes(b'')
            row = {'name': 'native-build', 'state': 'PASS', 'exit_code': 0}
            for key, path in zip(('stdout', 'stderr'), paths):
                row.update({key: path.relative_to(root).as_posix(), key + '_bytes': path.stat().st_size,
                            key + '_sha256': n.sha(path)})
            receipt = {'commands': [row]}
            actual, outputs = n.executed_producer_command(receipt, root, 'native-build')
            self.assertEqual(actual, row)
            self.assertEqual(outputs, ())
            self.assertGreater(len(raw), 10 * n.MIB)
            with paths[0].open('ab') as stream:
                stream.write(b'changed')
            with self.assertRaisesRegex(ValueError, 'RAW_LOG_IDENTITY'):
                n.executed_producer_command(receipt, root, 'native-build')
            with self.assertRaisesRegex(ValueError, 'ACTUAL_COMMAND'):
                n.executed_producer_command({'commands': [row, row]}, root, 'native-build')

    def test_projected_producer_source_requires_exact_known_scripts_and_byte_delta(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'apps/mobile').mkdir(parents=True)
            artifact = root / 'producer'
            projection = artifact / 'generation-projection'
            projection.mkdir(parents=True)
            original = json.dumps({'scripts': {'ios': 'expo start --ios', 'android': 'expo start --android'},
                                   'version': '1.0.0'}).encode()
            generated = json.dumps({'scripts': {'ios': 'expo run:ios', 'android': 'expo run:android'},
                                    'version': '1.0.0'}).encode()
            (root / 'apps/mobile/package.json').write_bytes(original)
            (projection / 'original-package.json').write_bytes(original)
            (projection / 'generated-package.json').write_bytes(generated)
            n.write_json(projection / 'projection.json', n.generated_package_projection(original, generated))
            import subprocess
            verifier_source = Path(n.__file__).with_name('source_completion46.py')
            (root / 'scripts/release/full-app-j01').mkdir(parents=True)
            (root / 'scripts/release/full-app-j01/source_completion46.py').write_bytes(verifier_source.read_bytes())
            subprocess.run(['git', 'init', '-q', str(root)], check=True)
            subprocess.run(['git', '-C', str(root), 'add', 'apps', 'scripts'], check=True)
            subprocess.run(['git', '-C', str(root), '-c', 'user.name=C47 fixture', '-c',
                            'user.email=fixture@example.invalid', 'commit', '-qm', 'portable fixture'], check=True)
            spec = importlib.util.spec_from_file_location('projection_fixture_verifier', verifier_source)
            verifier = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(verifier)
            g = lambda *args: verifier.git(*args, root=root)
            head = g('rev-parse', 'HEAD').decode().strip()
            before = {'head': head, 'tree': g('rev-parse', 'HEAD^{tree}').decode().strip(),
                      'base': n.BASE, 'base_tree': n.BASE_TREE, 'helper': verifier_source.name,
                      'helper_sha256': n.sha(verifier_source),
                      'inventory': verifier.verify_tracked_source(root, head, g)}
            after = copy.deepcopy(before)
            after['inventory'] = n.projected_source_inventory(verifier, root, head, g, generated,
                                                               authenticated_original=original)
            runner = SimpleNamespace(root=root)
            # Pure parser fixture: actual Darwin nofollow/race checks remain unchanged.
            with patch.object(n, 'read_native_file', side_effect=lambda path: Path(path).read_bytes()):
                runner = SimpleNamespace(root=root)
                n.write_json(artifact / 'after.json', after)
                n.producer_final_source_matches(runner, {'source': before}, artifact, 'after.json')
                forged = copy.deepcopy(after)
                forged['inventory']['actual_inventory_sha256'] = '0' * 64
                n.write_json(artifact / 'after.json', forged)
                with self.assertRaisesRegex(ValueError, 'EXACT_PROJECTED_SOURCE_INVENTORY'):
                    n.producer_final_source_matches(runner, {'source': before}, artifact, 'after.json')
                bad = copy.deepcopy(after)
                bad['inventory']['bytes'] += 1
                n.write_json(artifact / 'after.json', bad)
                with self.assertRaisesRegex(ValueError, 'PROJECTION_FINGERPRINT'):
                    n.producer_final_source_matches(runner, {'source': before}, artifact, 'after.json')
                n.write_json(artifact / 'after.json', after)
                unrelated = json.loads(generated)
                unrelated['version'] = '2.0.0'
                (projection / 'generated-package.json').write_bytes(json.dumps(unrelated).encode())
                with self.assertRaisesRegex(ValueError, 'NON_SCRIPT_DELTA'):
                    n.producer_final_source_matches(runner, {'source': before}, artifact, 'after.json')


class SurvivalQuery47Tests(unittest.TestCase):
    def test_both_lanes_require_five_completed_same_pid_queries_with_bounded_service_time(self):
        historical = historical_runtime25()
        bundle, device, pid = 'com.layerwell.app.staging', 'fresh-device', 53943
        for lane in ('normal', 'internal'):
            for table in (str(pid) + '\t0\tUIKitApplication:' + bundle, '53944\t0\t' + bundle):
                calls, waits = [], []
                def text(name, argv, **kwargs):
                    calls.append((name, argv, kwargs))
                    return bundle + ': ' + str(pid) if name == 'simulator-launch' else table
                def stop_after_survival(*args, **kwargs):
                    raise RuntimeError('survival-complete-before-ui')
                runner = SimpleNamespace(text=text, run=stop_after_survival,
                                         output=Path('unused-evidence'))
                with self.subTest(lane=lane, table=table), \
                     patch.object(n.time, 'monotonic', return_value=100), \
                     patch.object(n.time, 'sleep', side_effect=waits.append), \
                     patch.object(historical, 'prepare_simulator', return_value=device), \
                     patch.object(historical, 'install_simulator_app', return_value=Path('installed.app')), \
                     patch.object(historical, 'verify_installed_app'):
                    def execute():
                        if lane == 'normal':
                            historical.run_normal(runner, Path('ios'), Path('products'), Path('app'), bundle, 'a' * 40)
                        else:
                            return n.launch_and_verify(runner, device, bundle)
                    if table.startswith(str(pid) + '\t'):
                        if lane == 'normal':
                            with self.assertRaisesRegex(RuntimeError, 'survival-complete-before-ui'):
                                execute()
                        else:
                            self.assertEqual(execute(), pid)
                        self.assertEqual(waits, [1, 3, 8, 15, 30])
                        self.assertEqual([x[0] for x in calls[1:]], ['process-survival-' + str(i) for i in range(5)])
                    else:
                        with self.assertRaisesRegex(ValueError, 'APP_PROCESS_DID_NOT_SURVIVE'):
                            execute()
                        self.assertEqual(len(calls), 2)
                    for _, argv, kwargs in calls[1:]:
                        self.assertEqual(argv, ['xcrun', 'simctl', 'spawn', device, 'launchctl', 'list'])
                        self.assertEqual(kwargs, {'timeout': 120})



class SimulatorProbeAdmissionTests(unittest.TestCase):
    def test_successful_toolchain_probe_cannot_become_an_app_build_producer(self):
        with tempfile.TemporaryDirectory(dir=Path(tempfile.gettempdir()).resolve()) as directory:
            root = Path(directory)
            proof = {'stage':'build','status':'SIMULATOR_TOOLCHAIN_KEYCHAIN_PROBE_ONLY',
                     'stages':{'probe-compiled':{'status':'PASS'},'probe-keychain':{'status':'PASS'}}}
            (root/'execution.json').write_text(json.dumps(proof),encoding='utf8')
            with patch.object(n,'producer_source_matches'):
                with self.assertRaisesRegex(ValueError,'BUILD_PRODUCER_STAGE'):
                    n.verify_build_producer(SimpleNamespace(),{'payload_directory':str(root)})


class ExactProductReuse25Tests(unittest.TestCase):
    def fixture(self):
        origin = n.RESUME25_ORIGIN['head']
        root = Path(__file__).resolve().parents[3]
        def pair(name):
            return (subprocess.check_output(['git','show',origin+':'+name],cwd=root),
                    subprocess.check_output(['git','show','f21831f5731be928c8e323c509fb62b3d12a654e:'+name],cwd=root))
        py = pair('scripts/release/full-app-j01/native_runtime47.py')
        descriptor = pair('docs/phase-9/ios-generated-input-succession47.v1.json')
        ui = pair('scripts/release/full-app-j01/native_ui47.swift')
        paths = ['scripts/release/full-app-j01/native_ui47.swift']
        return paths, *py, *descriptor, *ui

    def test_current_reuse_preserves_all_non_routing_build_functions_and_ui_assertions(self):
        n.verify_reuse25_delta(*self.fixture())

    def test_product_dependency_installer_signing_and_unknown_paths_refuse(self):
        for name in ['apps/mobile/src/app/onboarding/age.tsx','package-lock.json',
                     'scripts/phase5/patch-expo-widgets-lifecycle.mjs',
                     'scripts/release/full-app-j01/simulator_signing47.py','unknown.txt']:
            args=list(self.fixture());args[0].append(name)
            with self.assertRaisesRegex(ValueError,'NON_PRODUCT_DELTA_ONLY'):
                n.verify_reuse25_delta(*args)

    def test_coordinator_environment_and_compile_behavior_drift_refuse(self):
        args=list(self.fixture());args[2]=args[2].replace(b"compile_only=False",b"compile_only=True",1)
        with self.assertRaisesRegex(ValueError,'BUILD_FUNCTION_OR_ENVIRONMENT_DRIFT'):
            n.verify_reuse25_delta(*args)

    def test_descriptor_entitlement_or_dependency_drift_refuses(self):
        args=list(self.fixture());obj=json.loads(args[4]);obj['registry'][0]['path']='node_modules/foreign';args[4]=json.dumps(obj).encode()
        with self.assertRaisesRegex(ValueError,'GENERATED_INPUT_OR_SIGNING_DRIFT'):
            n.verify_reuse25_delta(*args)

    def test_weakened_normal_or_internal_assertion_refuses(self):
        for before in [b'Blank age input must not proceed', b'final class C47InternalOwnerUI']:
            args=list(self.fixture());args[6]=args[6].replace(before,b'changed',1)
            with self.assertRaisesRegex(ValueError,'SUBSTANTIVE_UI_EXPECTATIONS_DRIFT'):
                n.verify_reuse25_delta(*args)

class ConsentDiagnostic04AdmissionTests(unittest.TestCase):
    def test_diagnostic_is_explicit_build_only_and_excludes_all_other_modes(self):
        self.assertEqual(n.execution_mode('build', consent_trace04=True), 'consent-trace04')
        for stage, flags in [('normal', {'consent_trace04': True}), ('internal', {'consent_trace04': True}),
                             ('build', {'consent_trace04': True, 'probe': True}),
                             ('build', {'consent_trace04': True, 'resume25': True})]:
            with self.subTest(stage=stage, flags=flags), self.assertRaises(ValueError):
                n.execution_mode(stage, **flags)

    def test_completed_consent_trace_cannot_admit_a_build_producer(self):
        with tempfile.TemporaryDirectory(dir=Path(tempfile.gettempdir()).resolve()) as directory:
            root = Path(directory)
            (root/'execution.json').write_text(json.dumps({'stage': 'build', 'stage_complete': True,
                'status': 'CONSENT_LIFECYCLE_DIAGNOSTIC_ONLY_04',
                'stages': {'consent-trace04': {'status': 'PASS'}}}), encoding='utf8')
            with patch.object(n, 'producer_source_matches'):
                with self.assertRaisesRegex(ValueError, 'BUILD_PRODUCER_STAGE'):
                    n.verify_build_producer(SimpleNamespace(), {'payload_directory': str(root)})

    def test_c04_compile_change_is_rejected_by_historical_reuse25_policy(self):
        fixture = list(ExactProductReuse25Tests().fixture())
        fixture[2] = Path(n.__file__).read_bytes()
        with self.assertRaisesRegex(ValueError, 'BUILD_FUNCTION_OR_ENVIRONMENT_DRIFT'):
            n.verify_reuse25_delta(*fixture)


class RetainedConsentRuntime27AdmissionTests(unittest.TestCase):
    def test_retained_mode_is_build_only_and_exclusive_with_every_old_mode(self):
        self.assertEqual(n.execution_mode('build', consent_runtime27=True), 'consent-runtime27')
        self.assertEqual(n.execution_mode('build', consent_trace04=True), 'consent-trace04')
        self.assertEqual(n.execution_mode('build', probe=True), 'probe')
        self.assertEqual(n.execution_mode('normal', resume25=True), 'reuse25')
        for stage in ('normal', 'internal'):
            with self.subTest(stage=stage), self.assertRaisesRegex(ValueError, 'CONSENT_RUNTIME27_BUILD_STAGE_ONLY'):
                n.execution_mode(stage, consent_runtime27=True)
        for old in ('probe', 'resume25', 'consent_trace04'):
            with self.subTest(old=old), self.assertRaisesRegex(ValueError, 'EXCLUSIVE_EXECUTION_MODE'):
                n.execution_mode('build', consent_runtime27=True, **{old: True})

    def test_completed_retained_diagnostic_never_qualifies_as_a_build_producer(self):
        with tempfile.TemporaryDirectory(dir=Path(tempfile.gettempdir()).resolve()) as directory:
            root = Path(directory)
            (root/'execution.json').write_text(json.dumps({'stage': 'build', 'stage_complete': True,
                'status': 'CONSENT_RETAINED_RUNTIME_DIAGNOSTIC_ONLY_27',
                'ordinary_admitted': False,
                'stages': {'compiled': {'status': 'PASS'}, 'app-process-keychain': {'status': 'PASS'}}}), encoding='utf8')
            with patch.object(n, 'producer_source_matches'):
                with self.assertRaisesRegex(ValueError, 'BUILD_PRODUCER_STAGE'):
                    n.verify_build_producer(SimpleNamespace(), {'payload_directory': str(root)})

    def test_dispatch_binds_current_source_restores_checks_on_failure_and_never_prepares_build_tools(self):
        with tempfile.TemporaryDirectory(dir=Path(tempfile.gettempdir()).resolve()) as directory:
            root = Path(directory)
            helper = root/'scripts/release/full-app-j01/consent_trace47.py'
            helper.parent.mkdir(parents=True)
            head = 'a'*40
            current = {'head': head, 'tree': 'b'*40}
            for fail in (False, True):
                helper.write_text("def run_retained_runtime27(r,n,token):\n"
                    "    assert token == 'synthetic-ephemeral-token27'\n"
                    "    assert 'C47_ARTIFACT_READ_TOKEN' not in r.env\n"
                    "    r.receipt['observed_current_head'] = r.receipt['source']['head']\n" +
                    ("    raise RuntimeError('retained-observation-failed')\n" if fail else ''), encoding='utf8')
                calls = []
                receipt = {}
                def source(name, observed):
                    calls.append((name, observed))
                    return current.copy()
                runner = SimpleNamespace(root=root, env=dict(n.ENVIRONMENT), receipt=receipt,
                    source_proof=source, persist=lambda:None, passed=lambda *args:None)
                with patch.object(n.platform, 'system', return_value='Darwin'), \
                     patch.object(Path, 'is_dir', return_value=True), \
                     patch.dict(n.os.environ, {'C47_EXPECTED_HEAD':head, 'C47_UI_PHASE':'normal-staging'}), \
                     patch.dict(sys.modules, {n.__name__: n}), \
                     patch.object(n, 'prepare', side_effect=AssertionError('build preparation forbidden')) as prepare, \
                     patch.object(n, 'retain_result_bundles') as retain:
                    n.os.environ.pop('C47_ARTIFACT_READ_TOKEN', None)
                    if fail:
                        with self.assertRaisesRegex(RuntimeError, 'retained-observation-failed'):
                            n.execute_retained_consent_runtime27(runner, 'synthetic-ephemeral-token27')
                    else:
                        n.execute_retained_consent_runtime27(runner, 'synthetic-ephemeral-token27')
                        self.assertEqual(receipt['status'], 'CONSENT_RETAINED_RUNTIME_DIAGNOSTIC_ONLY_27')
                        self.assertFalse(receipt['ordinary_admitted'])
                    prepare.assert_not_called()
                    retain.assert_called_once_with(runner)
                self.assertEqual(calls, [('source-before-consent-runtime27',head),('source-after-consent-runtime27',head)])
                self.assertEqual(receipt['source'], current)
                self.assertEqual(receipt['observed_current_head'], head)
                self.assertNotIn('synthetic-ephemeral-token27', json.dumps(receipt))
                self.assertNotIn('C47_ARTIFACT_READ_TOKEN', runner.env)



class SourceStage04Tests(unittest.TestCase):
    """Synthetic custody controls, never native/source execution evidence."""
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(dir=Path(tempfile.gettempdir()).resolve())
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.output = self.root / 'producer'
        self.output.mkdir()
        self.source = {'head':'a' * 40, 'tree':'b' * 40}
        self.runner = SimpleNamespace(root=self.root, receipt={'source':self.source})
        descriptor = self.root / 'docs/phase-9/ios-generated-input-succession47.v1.json'
        descriptor.parent.mkdir(parents=True)
        descriptor.write_bytes(b'{}')
        testfile = self.root / 'scripts/release/full-app-j01/native_generated47.test.mjs'
        testfile.parent.mkdir(parents=True)
        names = ['synthetic-source-case-' + str(i) for i in range(30)]
        testfile.write_bytes(''.join("test('" + name + "', () => {});\n" for name in names).encode())
        raw = ''.join('ok ' + str(i) + ' - ' + name + '\n' for i,name in enumerate(names,1))
        raw += '1..30\n# tests 30\n# pass 30\n# fail 0\n# skipped 0\n# cancelled 0\n# todo 0\n'
        for event in ('BEGIN','END'):
            raw += ''.join('# ' + json.dumps({'event':'C47_SOURCE_CASE_' + event,'name':name},separators=(',',':')) + '\n' for name in names)
        self.commands = []
        (self.output / 'logs').mkdir()
        for index,name in enumerate(n.SOURCE_COMMANDS04):
            command = {'name':name,'state':'PASS','exit_code':0,'required':True,'capture_complete':True,
                       'argv':['node','--test','scripts/release/full-app-j01/native_generated47.test.mjs']}
            for stream in ('stdout','stderr'):
                content = raw.encode() if name == 'generated47-controls' and stream == 'stdout' else b''
                path = 'logs/' + str(index) + '.' + stream
                (self.output / path).write_bytes(content)
                command.update({stream:path,stream + '_bytes':len(content),stream + '_sha256':hashlib.sha256(content).hexdigest()})
            self.commands.append(command)
        self.receipt = {'stage':'source','stage_complete':True,'status':'SOURCE_CONTROLS_PASSED_APPLICATION_NOT_BUILT','ordinary_admitted':False,
            'source':self.source,'stages':{'source':{},'toolchain':{},'installation':{}},'commands':self.commands,
            'internal_supported_owner':'NOT_RUN','acceptance_granted':False,'campaign_candidate_complete':False,'release':'NO_GO'}
        producer = {key:1 for key in n.SOURCE_IDENTITY_FIELDS04}
        producer.update(producer_job_name='C47 source',source_head=self.source['head'],source_tree=self.source['tree'])
        self.provenance = {'payload_directory':str(self.output),'payload_bytes':1234,'producer':producer}
        self.write('source-before.json',self.source)
        self.write('source-after-controls.json',self.source)
        self.write('toolchain.json',{'build_environment':n.ENVIRONMENT,'architecture':'x86_64',
            'node':'v22.22.2','npm':'11.20.0','xcode':'Xcode 26.4.1',
            'simulator_build_flags':n.SIMULATOR_BUILD_FLAGS,'app_simulator_build_flags':n.APP_SIMULATOR_BUILD_FLAGS})
        self.write('current-generated47-source.json',{'phase':'SOURCE','sourceHead':self.source['head'],
            'sourceTree':self.source['tree'],'profiles':['development','staging'],
            'descriptorSHA256':hashlib.sha256(b'{}').hexdigest(),
            'currentNative47':{'verifiedInputCount':202,'committedCriticalInputs':172}})

    def write(self,name,value):
        (self.output / name).write_text(json.dumps(value))

    def verify(self):
        self.write('execution.json',self.receipt)
        return n.verify_source_producer04(self.runner,self.provenance)

    def test_same_source_full_thirty_streams_and_no_app_are_qualified(self):
        result = self.verify()
        self.assertFalse(result['current_runner_commands_imported'])
        self.assertEqual(result['payload_bytes'],1234)

    def test_wrong_source_and_app_stage_cannot_substitute_source_receipt(self):
        self.receipt['source'] = dict(self.source,head='c' * 40)
        with self.assertRaisesRegex(ValueError,'PRODUCER_SAME_WHOLE_SOURCE'):
            self.verify()
        self.receipt['source'] = self.source
        self.receipt['stages']['compiled'] = {'status':'PASS'}
        with self.assertRaisesRegex(ValueError,'ONLY_COMPLETE_SOURCE_STAGE'):
            self.verify()
        self.receipt['stages'].pop('compiled')
        self.receipt['ordinary_admitted'] = True
        with self.assertRaisesRegex(ValueError,'ONLY_COMPLETE_SOURCE_STAGE'):
            self.verify()

    def test_changed_stream_and_claimed_pass_with_failed_tap_refuse(self):
        command = next(c for c in self.commands if c['name'] == 'generated47-controls')
        path = self.output / command['stdout']
        original = path.read_bytes()
        path.write_bytes(original + b'changed')
        with self.assertRaisesRegex(ValueError,'RAW_LOG_IDENTITY'):
            self.verify()
        invalid = original.replace(b'# pass 30',b'# pass 29')
        path.write_bytes(invalid)
        command.update(stdout_bytes=len(invalid),stdout_sha256=hashlib.sha256(invalid).hexdigest())
        with self.assertRaisesRegex(ValueError,'FULL_SOURCE_CONTROLS'):
            self.verify()

    def test_final_source_drift_and_incomplete_capture_refuse(self):
        self.write('source-after-controls.json',dict(self.source,tree='c' * 40))
        with self.assertRaisesRegex(ValueError,'UNPROJECTED_FINAL_SOURCE'):
            self.verify()
        self.write('source-after-controls.json',self.source)
        self.commands[0]['capture_complete'] = False
        with self.assertRaisesRegex(ValueError,'COMPLETE_REQUIRED_COMMANDS'):
            self.verify()

    def test_unique_family_uses_each_own_payload_once_not_nested_totals(self):
        values = {role:{'producer':{'artifact_id':i},'payload_bytes':i,'upstream_payload_bytes':999999}
                  for i,role in enumerate(('source','build','normal'),1)}
        self.assertEqual(n.family_payload_bytes04(values,('source','build','normal')),6)
        with self.assertRaisesRegex(ValueError,'EXACT_UPSTREAM_ROLES'):
            n.family_payload_bytes04({'build':values['build']},('source','build'))
        values['normal']['producer']['artifact_id'] = values['source']['producer']['artifact_id']
        with self.assertRaisesRegex(ValueError,'UNIQUE_FAMILY_BUDGET'):
            n.family_payload_bytes04(values,('source','build','normal'))



class RawConsoleIsolation04Tests(unittest.TestCase):
    def test_blocked_live_console_cannot_block_or_truncate_retained_command_streams(self):
        class BlockedConsole:
            def __init__(self):
                self.entered = n.threading.Event()
                self.release = n.threading.Event()
                self.calls = 0
                self.buffer = self

            def write(self, value):
                self.calls += 1
                self.entered.set()
                self.release.wait(3)
                return len(value)

            def flush(self):
                self.calls += 1
                self.entered.set()
                self.release.wait(3)

        with tempfile.TemporaryDirectory(dir=Path(tempfile.gettempdir()).resolve()) as temporary:
            runner = n.Runner(Path(temporary), Path(temporary) / 'evidence')
            console = BlockedConsole()
            joined = []
            real_join = n.threading.Thread.join

            def bounded_join(thread, timeout=None):
                joined.append(thread)
                return real_join(thread, 0.1)

            try:
                with patch.object(n.sys, 'stdout', console), patch.object(n.sys, 'stderr', console), \
                     patch.object(n.threading.Thread, 'join', bounded_join):
                    runner.run('blocked-console', [sys.executable, '-I', '-c',
                        "import sys;sys.stdout.buffer.write(b'X'*30630);sys.stdout.flush();"
                        "sys.stderr.buffer.write(b'E'*190);sys.stderr.flush()"], timeout=3)
            finally:
                # Releasing the synthetic sink prevents a deliberately blocked
                # old reader from leaking into later controls. Production join
                # bounds, freeze gates and partial-failure rules are unchanged.
                console.release.set()
                for thread in joined:
                    real_join(thread, 2)
                row = runner.receipt['commands'][0]
                raw = {stream:(runner.output / row[stream]).read_bytes() for stream in ('stdout','stderr')}
                self.blocked_console_observation = {
                    'row':copy.deepcopy(row), 'console_calls':console.calls,
                    'live_console_was_entered':console.entered.is_set(), 'raw':raw,
                }
            self.assertEqual(row['exit_code'], 0)
            self.assertEqual(row['state'], 'PASS')
            self.assertTrue(row['capture_complete'])
            self.assertFalse(row.get('timed_out', False))
            self.assertEqual(raw, {'stdout':b'X'*30630,'stderr':b'E'*190})
            for stream in ('stdout','stderr'):
                self.assertEqual(row[stream + '_bytes'],len(raw[stream]))
                self.assertEqual(row[stream + '_sha256'],hashlib.sha256(raw[stream]).hexdigest())
            self.assertEqual(console.calls, 0)
            self.assertFalse(console.entered.is_set())
            self.assertEqual(runner.receipt['stages'], {})
            self.assertFalse(runner.receipt['acceptance_granted'])


class Ordinary04EEControls(unittest.TestCase):
    """Synthetic architecture controls; provider/native admission stays pending."""
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='ordinary04-ee-')
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        observation = patch.object(n,'read_native_file',side_effect=lambda path:Path(path).read_bytes())
        observation.start()
        self.addCleanup(observation.stop)

    def failed_command(self):
        method = n.NORMAL_UI_CASES04[0]
        raw = ("/synthetic/native_ui47.swift:52: error: -[C47NativeUI.C47NativeUI " + method + "] : XCTAssertTrue failed - synthetic assertion\n" +
               "Test Case '-[C47NativeUI.C47NativeUI " + method + "]' failed (1 second).\n" +
               'Executed 1 test, with 1 failure (0 unexpected) in 1 second.\n').encode()
        row = {'name':'native-normal-staging-ui','required':True,'state':'FAIL','exit_code':65,
               'capture_complete':True,'timeout_seconds':900}
        (self.directory/'logs').mkdir(exist_ok=True)
        for kind,data in [('stdout',raw),('stderr',b'')]:
            path = 'logs/001-native-normal-staging-ui.'+kind
            (self.directory/path).write_bytes(data)
            row.update({kind:path,kind+'_bytes':len(data),kind+'_sha256':hashlib.sha256(data).hexdigest()})
        return method,row,(raw,b'')

    def case(self,index,outcome='PASS'):
        method = n.NORMAL_UI_CASES04[index]
        device = 'device-'+str(index)
        failed = int(outcome == 'ASSERTION_FAILED')
        parsed = {'expected_case':'C47NativeUI/'+method,'executed':1,'failed':failed,
                  'unexpected':0,'skipped':0,'udid':device}
        if failed:
            parsed['classification'] = 'XCTEST_ASSERTION_FAILURE_ONLY'
        return {'suite_version':4,'method':method,'udid':device,'data_container':'container-'+str(index),
            'source':{'head':'a'*40,'tree':'b'*40},'runner':{'version':4},'lane':'normal-staging',
            'outcome':outcome,'assertion_failure_xctest' if failed else 'positive_xctest':
                {'executed':1,'failed':failed,'unexpected':0,'skipped':0},
            'result_bundle':{'parsed':parsed}}

    def test_fabricated_provider_documents_without_named_case_cannot_admit(self):
        # Previous guessed key names must never establish either outcome.
        fabricated = {'totalTestCount':1,'passedTests':1,'failedTests':0,'skippedTests':0,
                      'expectedFailures':0,'testFailures':[]}
        with self.assertRaises(ValueError):
            n.normal_result_documents04(fabricated,{},n.NORMAL_UI_CASES04[0],'synthetic-device')
        with self.assertRaises(ValueError):
            n.normal_assertion_failure_documents04(fabricated,{},n.NORMAL_UI_CASES04[0],'synthetic-device')

    def test_each_current_named_pass_requires_explicit_zero_unexpected_and_refuses_historical_singleton(self):
        for method in n.NORMAL_UI_CASES04:
            raw = ("Test Case '-[C47NativeUI.C47NativeUI " + method + "]' passed.\n"+
                   'Executed 1 test, with 0 failures (0 unexpected) in 1 second.\n')
            self.assertEqual(n.selected_xctest_summary(raw,'C47NativeUI',method)['unexpected'],0)
            for bad in [raw.replace('0 unexpected','1 unexpected'),raw.replace('(0 unexpected)',''),
                        raw.replace('passed','skipped'),raw+'1 test skipped\n']:
                with self.subTest(method=method,bad=bad),self.assertRaises(ValueError):
                    n.selected_xctest_summary(bad,'C47NativeUI',method)
        with self.assertRaisesRegex(ValueError,'SELECTED_CASE_REQUIRED'):
            n.selected_xctest_summary('', 'C47NativeUI',n.NORMAL_UI_CASE)

    def test_only_complete_required_exit65_and_exact_failed_command_bytes_reach_assertion_classifier(self):
        method,row,raw = self.failed_command()
        error = ValueError('C47_COMMAND_FAILED:native-normal-staging-ui')
        actual,streams = n.normal_assertion_command04({'commands':[row]},self.directory,error)
        self.assertEqual(streams,raw)
        self.assertEqual(n.normal_assertion_log04(streams,method,{'head':'a'*40})['failed'],1)
        for key,value in [('state','PASS'),('required',False),('exit_code',70),('exit_code',True),
                          ('capture_complete',False),('timed_out',True),('process_exit_code',-9),
                          ('error_type','LOG_STREAM_DID_NOT_CLOSE')]:
            bad = {**row,key:value}
            with self.subTest(key=key,value=value),self.assertRaises(ValueError):
                n.normal_assertion_command04({'commands':[bad]},self.directory,error)
        for error in [RuntimeError(str(error)),ValueError('C47_COMMAND_FAILED:simulator-install'),
                      ValueError('C47_APP_PROCESS_DID_NOT_SURVIVE')]:
            with self.assertRaises(ValueError):
                n.normal_assertion_command04({'commands':[row]},self.directory,error)
        (self.directory/row['stdout']).write_bytes(raw[0]+b'late changed bytes')
        with self.assertRaisesRegex(ValueError,'RAW_LOG_IDENTITY'):
            n.normal_assertion_command04({'commands':[row]},self.directory,
                ValueError('C47_COMMAND_FAILED:native-normal-staging-ui'))

    def test_failed_log_requires_exact_one_case_zero_unexpected_zero_skips(self):
        method,row,raw = self.failed_command()
        for bad in [raw[0].replace(b'0 unexpected',b'1 unexpected'),
                    raw[0].replace(b'(0 unexpected)',b''),raw[0]+b'1 test skipped\n',
                    raw[0].replace(method.encode(),n.NORMAL_UI_CASE.encode()),
                    raw[0].replace(b'failed',b'passed'),raw[0].replace(b'Executed 1',b'Executed 0')]:
            with self.assertRaises(ValueError):
                n.normal_assertion_log04((bad,b''),method,{'head':'a'*40})

    def test_case_execution_requires_exact_selected_argv_and_actual_assertion_only_classification(self):
        method,row,raw = self.failed_command()
        source = {'head':'a'*40,'tree':'b'*40}
        device = 'synthetic-device'
        child = SimpleNamespace(output=self.directory,receipt={'source':source,'commands':[row]})
        def run(name,argv,**kwargs):
            self.assertEqual(name,'native-normal-staging-ui')
            row['argv'] = list(map(str,argv))
            raise ValueError('C47_COMMAND_FAILED:native-normal-staging-ui')
        child.run = run
        parsed = {'expected_case':'C47NativeUI/'+method,'executed':1,'failed':1,'unexpected':0,
                  'skipped':0,'udid':device,'classification':'XCTEST_ASSERTION_FAILURE_ONLY'}
        with patch.object(n,'collect_normal_result04',return_value={'parsed':parsed,'assertion_observation':{
            'source_file':'native_ui47.swift','source_line':52,
            'failure_text_sha256':hashlib.sha256(b'XCTAssertTrue failed - synthetic assertion').hexdigest()}}) as collect:
            proof = n.normal_case_execution04(child,Path('project'),Path('products'),method,device,{})
            self.assertEqual(proof['outcome'],'ASSERTION_FAILED')
            self.assertEqual(collect.call_args.kwargs,{'outcome':'ASSERTION_FAILED'})
        for classification in ['CRASH','COMPILE_ERROR','UNEXPECTED_FAILURE',None]:
            bad = {**parsed,'classification':classification}
            with patch.object(n,'collect_normal_result04',return_value={'parsed':bad}),\
                 self.subTest(classification=classification),self.assertRaisesRegex(ValueError,'ACTUAL_ASSERTION_ONLY_REQUIRED'):
                n.normal_case_execution04(child,Path('project'),Path('products'),method,device,{})
        def wrong_command(name,argv,**kwargs):
            row['argv'] = list(map(str,argv))+['-only-testing:Unrelated/test']
            raise ValueError('C47_COMMAND_FAILED:native-normal-staging-ui')
        child.run = wrong_command
        with patch.object(n,'collect_normal_result04') as collect,self.assertRaisesRegex(ValueError,'EXACT_SELECTED_COMMAND'):
            n.normal_case_execution04(child,Path('project'),Path('products'),method,device,{})
        collect.assert_not_called()

    def test_aggregate_retains_all_three_outcomes_and_refuses_omission_or_reused_identity(self):
        cases = [self.case(i) for i in range(3)]
        source,runner = cases[0]['source'],cases[0]['runner']
        self.assertEqual(n.normal_suite_aggregate04(cases,source,runner)['failed'],0)
        cases[0] = self.case(0,'ASSERTION_FAILED')
        aggregate = n.normal_suite_aggregate04(cases,source,runner)
        self.assertEqual((aggregate['executed'],aggregate['failed'],aggregate['unexpected'],aggregate['skipped']),
                         (3,1,0,0))
        for bad in [cases[:-1],list(reversed(cases))]:
            with self.assertRaisesRegex(ValueError,'EXACT_COMPLETE_CASES'):
                n.normal_suite_aggregate04(bad,source,runner)
        for key,value in [('source',{'head':'c'*40}),('lane','internal-supported-owner'),
                          ('udid',cases[0]['udid']),('data_container',cases[0]['data_container'])]:
            bad = copy.deepcopy(cases)
            bad[1][key] = value
            with self.subTest(key=key),self.assertRaises(ValueError):
                n.normal_suite_aggregate04(bad,source,runner)
        bad = copy.deepcopy(cases)
        bad[0]['result_bundle']['parsed']['classification'] = 'CRASH_OR_UNEXPECTED_FAILURE'
        with self.assertRaises(ValueError):
            n.normal_suite_aggregate04(bad,source,runner)
        with self.assertRaisesRegex(ValueError,'COMPLETE_PASS_REQUIRED'):
            n.normal_xctest_gate(SimpleNamespace(receipt={'stages':{'normal-staging-ui':{
                'status':'PASS','details':{'positive_xctest':aggregate}}}}))

    def loop_fixture(self,failure):
        original_runner = n.Runner
        parent = original_runner(self.directory,self.directory/'parent')
        parent.receipt['source'] = {'head':'a'*40,'tree':'b'*40}
        parent.receipt['job_context'] = {'run_id':1}
        calls,children = [],[]
        def generate(name,argv,**kwargs):
            self.assertEqual(name,'generate-native-ui-runner')
            project = parent.output/'ui/runner/C47NativeUI.xcodeproj'
            project.mkdir(parents=True)
            (parent.output/'ui/runner.json').write_text(json.dumps({'project':str(project)}))
            return ()
        parent.run = generate
        parent.source_proof = lambda *args,**kwargs:calls.append(('source-after',args,kwargs))
        def child_factory(root,output,**kwargs):
            child = original_runner(root,output,**kwargs)
            child.run = lambda *args,**kwargs:None
            def text(name,argv,**kwargs):
                self.assertEqual(name,'simulator-data-container')
                return str(Path.home()/'Library/Developer/CoreSimulator/Devices'/child.receipt['simulator']['udid']/
                           'data/Containers/Data/Application'/('00000000-0000-0000-0000-'+str(len(children)).zfill(12)))
            child.text = text
            children.append(child)
            return child
        def prepare(child,label):
            device = '00000000-0000-0000-0000-'+str(len(children)).zfill(12)
            child.receipt['simulator'] = {'udid':device}
            return device
        def installed(child,*args):
            child.passed('installed',{'udid':child.receipt['simulator']['udid']})
        def execute(child,project,products,method,device,environment):
            index = len(calls)
            calls.append(method)
            if failure == 'infrastructure':
                raise ValueError('C47_COMMAND_FAILED:simulator-install')
            failed = failure == 'assertion' and len(calls) == 1
            outcome = 'ASSERTION_FAILED' if failed else 'PASS'
            parsed = {'expected_case':'C47NativeUI/'+method,'executed':1,'failed':int(failed),
                      'unexpected':0,'skipped':0,'udid':device}
            if failed:
                parsed['classification'] = 'XCTEST_ASSERTION_FAILURE_ONLY'
            return {'outcome':outcome,'result_bundle':{'parsed':parsed},
                'assertion_failure_xctest' if failed else 'positive_xctest':
                    {'executed':1,'failed':int(failed),'unexpected':0,'skipped':0},
                **({'failure':{'type':'ValueError','detail':'C47_COMMAND_FAILED:native-normal-staging-ui'}} if failed else {})}
        return parent,calls,children,[(n,'Runner',child_factory),(n,'normal_runner04',lambda r:{'version':4}),
            (n,'prepare_simulator',prepare),(n,'install_simulator_app',lambda *args:Path('installed.app')),
            (n,'verify_installed_app',installed),(n,'launch_and_verify',lambda *args:12345),
            (n,'normal_case_execution04',execute),(n,'retain_result_bundles',lambda *args:None)]

    def test_three_independent_cases_collect_after_qualified_assertion_and_internal_remains_blocked(self):
        parent,calls,children,replacements = self.loop_fixture('assertion')
        from contextlib import ExitStack
        with ExitStack() as stack:
            for module,name,value in replacements:
                stack.enter_context(patch.object(module,name,value))
            with self.assertRaisesRegex(ValueError,'COMPLETE_SUITE_FAILED_INTERNAL_NOT_ADMITTED'):
                n.run_normal(parent,Path('ios'),self.directory,Path('app'),'com.layerwell.app.staging','a'*40)
        self.assertEqual(calls[:3],list(n.NORMAL_UI_CASES04))
        self.assertEqual(len(children),3)
        self.assertEqual(parent.receipt['ordinary_suite_summary04']['failed'],1)
        self.assertNotIn('normal-staging-ui',parent.receipt['stages'])
        self.assertEqual(children[0].receipt['status'],'NORMAL_V04_CASE_ASSERTION_FAILED')
        self.assertTrue(all(child.receipt['status'] == 'NORMAL_V04_CASE_EXECUTED_PASS' for child in children[1:]))

    def test_infrastructure_failure_aborts_before_second_independent_case(self):
        parent,calls,children,replacements = self.loop_fixture('infrastructure')
        from contextlib import ExitStack
        with ExitStack() as stack:
            for module,name,value in replacements:
                stack.enter_context(patch.object(module,name,value))
            with self.assertRaisesRegex(ValueError,'COMMAND_FAILED:simulator-install'):
                n.run_normal(parent,Path('ios'),self.directory,Path('app'),'com.layerwell.app.staging','a'*40)
        self.assertEqual(calls,[n.NORMAL_UI_CASES04[0]])
        self.assertEqual(len(children),1)
        self.assertNotIn('ordinary_suite_summary04',parent.receipt)



class InstalledAppIdentity04Controls(unittest.TestCase):
    """Synthetic full-app controls; matching Mach-O alone cannot admit changed JS."""
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='installed-app04-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        observation = patch.object(n,'read_native_file',side_effect=lambda path:Path(path).read_bytes())
        observation.start();self.addCleanup(observation.stop)

    def fixture(self,label='case',debug=False):
        root = self.root/label
        root.mkdir()
        app,installed,output = root/'source.app',root/'installed.app',root/'evidence'
        bundle = 'com.layerwell.app.development' if debug else 'com.layerwell.app.staging'
        executable = 'LayerwellDev' if debug else 'LayerwellStaging'
        source = {'head':'a'*40,'tree':'b'*40}
        for directory in (app,installed,output):
            directory.mkdir()
        for directory in (app,installed):
            (directory/'Info.plist').write_bytes(n.plistlib.dumps({'CFBundleIdentifier':bundle,
                'CFBundleExecutable':executable}))
            (directory/executable).write_bytes(b'synthetic matching executable')
            (directory/'_CodeSignature').mkdir()
            (directory/'_CodeSignature/CodeResources').write_bytes(b'synthetic all resources')
            if not debug:
                (directory/'main.jsbundle').write_bytes(b'synthetic current javascript')
        def rows(directory):
            result = []
            for path in sorted(Path(directory).rglob('*')):
                row = {'path':path.relative_to(directory).as_posix(),
                       'type':'directory' if path.is_dir() else 'file',
                       'mode':'0o755' if path.is_dir() or path.name == executable else '0o644'}
                if path.is_file():
                    row.update(bytes=len(path.read_bytes()),sha256=hashlib.sha256(path.read_bytes()).hexdigest())
                result.append(row)
            return result
        product = {'qualification':'SYNTHETIC_PRODUCT_ONLY'}
        javascript = None if debug else {'diagnostic_marker_present':False,
            'bytes':len((app/'main.jsbundle').read_bytes()),'sha256':n.sha(app/'main.jsbundle')}
        inventory = {'source':source,'configuration':'Debug' if debug else 'Release',
            'lane':'internal-supported-owner' if debug else 'normal-staging','files':rows(app),
            'simulator_signing':product,'ordinary_javascript':javascript}
        n.write_json(output/'app-inventory.json',inventory)
        authority = {'source_head':source['head'],'source_tree':source['tree'],'bundle_id':bundle,
            'executable':executable,'configuration':inventory['configuration'],'lane':inventory['lane'],
            'inventory_sha256':n.sha(output/'app-inventory.json')}
        receipt = {'source':source,'simulator':{'udid':'synthetic-device'},
                   'stages':{'compiled':{'status':'PASS','details':authority}}}
        calls = []
        runner = SimpleNamespace(receipt=receipt,output=output,
            passed=lambda stage,proof:receipt['stages'].update({stage:{'status':'PASS','details':proof}}))
        signing = SimpleNamespace(inspect_product=lambda *args:(calls.append('strict-installed-product') or product),
            validate_ordinary_product=lambda *args:None,
            check_diagnostic_bundle=lambda *args:javascript)
        return root,app,installed,runner,inventory,authority,rows,signing,calls,bundle

    def test_complete_release_and_debug_inventories_pass_with_honest_javascript_qualifications(self):
        for debug in (False,True):
            root,app,installed,runner,inventory,authority,rows,signing,calls,bundle = self.fixture(str(debug),debug)
            with patch.object(n,'bundle_inventory',side_effect=rows),patch.object(n,'simulator_signing',return_value=signing):
                n.verify_installed_app(runner,installed,app,bundle)
            proof = runner.receipt['stages']['installed']['details']
            self.assertEqual(proof['full_inventory']['producer_to_installed']['regular_files_byte_identical'],3 if debug else 4)
            self.assertEqual(calls,['strict-installed-product'])
            self.assertEqual(proof['executable'],'LayerwellDev' if debug else 'LayerwellStaging')
            self.assertIn('METRO_DEVELOPMENT' if debug else 'EXACT_AUTHENTICATED_JAVASCRIPT',proof['javascript_qualification'])

    def test_changed_javascript_with_identical_executable_and_source_is_retained_and_refused(self):
        root,app,installed,runner,inventory,authority,rows,signing,calls,bundle = self.fixture()
        (installed/'main.jsbundle').write_bytes(b'synthetic other javascript')
        self.assertEqual(n.sha(installed/'LayerwellStaging'),n.sha(app/'LayerwellStaging'))
        with patch.object(n,'bundle_inventory',side_effect=rows),patch.object(n,'simulator_signing',return_value=signing),\
             self.assertRaisesRegex(ValueError,'INSTALLED_CLOSED_APP_BYTES'):
            n.verify_installed_app(runner,installed,app,bundle)
        evidence = runner.output/'installed-product-verification-compiled'
        diff = json.loads((evidence/'exact-inventory-differences.json').read_bytes())
        self.assertEqual([row['path'] for row in diff['producer_to_installed']],['main.jsbundle'])
        self.assertNotIn('installed',runner.receipt['stages'])

    def test_source_profile_and_stale_inventory_hash_cannot_be_forgiven_by_matching_files(self):
        for label,mutation,refresh in [('source',lambda v:v['source'].update(head='c'*40),True),
            ('profile',lambda v:v.update(configuration='Debug'),True),
            ('lane',lambda v:v.update(lane='internal-supported-owner'),True),
            ('stale-hash',lambda v:v.update(unexpected_metadata=True),False)]:
            root,app,installed,runner,inventory,authority,rows,signing,calls,bundle = self.fixture(label)
            mutation(inventory)
            n.write_json(runner.output/'app-inventory.json',inventory)
            if refresh:
                authority['inventory_sha256'] = n.sha(runner.output/'app-inventory.json')
            with patch.object(n,'bundle_inventory',side_effect=rows),patch.object(n,'simulator_signing',return_value=signing),\
                 self.subTest(label=label),self.assertRaises(ValueError):
                n.verify_installed_app(runner,installed,app,bundle)
            self.assertEqual(calls,[])
            self.assertNotIn('installed',runner.receipt['stages'])

    def test_unknown_member_and_expanded_permission_refuse_but_safe_narrowing_keeps_every_byte(self):
        for label in ('unknown-member','expanded','narrow'):
            root,app,installed,runner,inventory,authority,rows,signing,calls,bundle = self.fixture(label)
            if label == 'unknown-member':
                (installed/'unrecorded-resource').write_bytes(b'extra')
            def observed(path):
                result = rows(path)
                if Path(path) == installed and label != 'unknown-member':
                    next(row for row in result if row['path'] == 'LayerwellStaging')['mode'] = '0o775' if label == 'expanded' else '0o500'
                return result
            with patch.object(n,'bundle_inventory',side_effect=observed),patch.object(n,'simulator_signing',return_value=signing):
                if label == 'narrow':
                    n.verify_installed_app(runner,installed,app,bundle)
                    proof = runner.receipt['stages']['installed']['details']['full_inventory']
                    self.assertEqual(proof['producer_to_installed']['mode_changes'],
                        [{'path':'LayerwellStaging','producer_mode':'0o755','observed_mode':'0o500'}])
                else:
                    with self.assertRaises(ValueError):
                        n.verify_installed_app(runner,installed,app,bundle)
                    self.assertNotIn('installed',runner.receipt['stages'])

    def test_consumer_retains_authenticated_inventory_exact_raw_bytes_and_hash(self):
        root,app,installed,runner,inventory,authority,rows,signing,calls,bundle = self.fixture()
        producer = root/'producer'
        producer.mkdir()
        raw = json.dumps(inventory,indent=3,separators=(',',': ')).encode()+b'\n'
        (producer/'app-inventory.json').write_bytes(raw)
        archive = producer/'signed-simulator-app.tar.gz'
        with n.tarfile.open(archive,'w:gz') as target:
            member = n.tarfile.TarInfo('LayerwellStaging.app');member.type=n.tarfile.DIRTYPE;member.mode=0o755
            target.addfile(member)
            for row in inventory['files']:
                member = n.tarfile.TarInfo('LayerwellStaging.app/'+row['path']);member.mode=int(row['mode'],8)
                if row['type'] == 'directory':
                    member.type=n.tarfile.DIRTYPE;target.addfile(member)
                else:
                    data = (app/row['path']).read_bytes();member.size=len(data);target.addfile(member,io.BytesIO(data))
        receipt = {'file':archive.name,'bytes':archive.stat().st_size,'sha256':n.sha(archive),
            'source_head':inventory['source']['head'],'inventory_sha256':hashlib.sha256(raw).hexdigest(),
            'lane':'normal-staging','configuration':'Release','standalone_embedded_javascript':True,
            'not_an_iphone_or_testflight_release':True,'platform':'iOS Simulator','architectures':['x86_64'],
            'bundle_id':bundle,'executable':'LayerwellStaging','simulator_signing':inventory['simulator_signing'],
            'ordinary_javascript':inventory['ordinary_javascript']}
        n.write_json(producer/'app-artifact.json',receipt)
        (runner.output/'app-inventory.json').unlink()
        runner.text = lambda *args:''
        # This function executes on Darwin. Windows' default os.open text mode
        # would translate LF bytes while this synthetic control extracts its
        # plist; emulate Darwin's byte writes without changing production code.
        original_open = n.os.open
        def darwin_byte_open(path,flags,*args):
            return original_open(path,flags | getattr(n.os,'O_BINARY',0),*args)
        with patch.dict(n.os.environ,{'RUNNER_TEMP':str(root)}),patch.object(n,'bundle_inventory',side_effect=rows),\
             patch.object(n,'simulator_signing',return_value=signing),\
             patch.object(n.os,'open',side_effect=darwin_byte_open),\
             patch.object(n,'validate_product',return_value=(bundle,'LayerwellStaging',['x86_64'])):
            result = n.consume_produced_app(runner,producer,inventory['source']['head'],'x86_64',root/'consumed')
        self.assertEqual((runner.output/'app-inventory.json').read_bytes(),raw)
        self.assertEqual(result[2]['producer_app_inventory_sha256'],hashlib.sha256(raw).hexdigest())




class InstalledResourceExec04Controls(unittest.TestCase):
    def test_observed_nonexecuted_resource_mode_narrows_without_allowing_main_or_unknown_helper_loss(self):
        paths = ('Frameworks/ExpoCamera.framework/ExpoCamera',
                 'GoogleMVFaceDetectorResources.bundle/BCLjoy_200.emd',
                 'GoogleSignIn.bundle/Roboto-Bold.ttf')
        expected = [{'path':path,'type':'file','mode':'0o755','bytes':2,'sha256':'a'*64}
                    for path in ('LayerwellStaging',*paths)]
        observed = [dict(row) for row in expected]
        for row in observed[1:]:
            row['mode'] = '0o644'
        proof = n.installed_app_inventory_proof(expected,observed,'LayerwellStaging')
        self.assertEqual(proof['regular_files_byte_identical'],4)
        self.assertEqual(len(proof['mode_changes']),3)
        for label in ('main','unknown-helper','wrong-resource-bytes','unobserved-mode-pair'):
            left,right = [dict(row) for row in expected],[dict(row) for row in observed]
            if label == 'main':
                right[0]['mode'] = '0o644'
            elif label == 'unknown-helper':
                left[1]['path'] = right[1]['path'] = 'Frameworks/UnrecognizedHelper.framework/UnrecognizedHelper'
            elif label == 'wrong-resource-bytes':
                right[1]['sha256'] = 'b'*64
            else:
                left[1]['mode'],right[1]['mode'] = '0o750','0o640'
            with self.subTest(label=label),self.assertRaises(ValueError):
                n.installed_app_inventory_proof(left,right,'LayerwellStaging')



class SchemaBackedResult04Controls(unittest.TestCase):
    """Source-level schema/selection controls; actual31 cardinality remains required."""
    def documents(self,failed=False):
        method = n.NORMAL_UI_CASES04[0]
        device = {'deviceId':'00000000-0000-0000-0000-000000000001','deviceName':'synthetic',
                  'architecture':'x86_64','modelName':'synthetic','osVersion':'26.4'}
        config = {'configurationId':'synthetic-id','configurationName':'synthetic'}
        summary = {'title':'SYNTHETIC_SCHEMA_FIELD_CONTROL_ONLY','environmentDescription':'synthetic',
            'topInsights':[],'statistics':[],'result':'Failed' if failed else 'Passed',
            'totalTestCount':1,'passedTests':int(not failed),'failedTests':int(failed),'skippedTests':0,'expectedFailures':0}
        tests = {'devices':[device],'testPlanConfigurations':[config],'testNodes':[{
            'nodeType':'Test Case','name':method+'()','nodeIdentifier':'C47NativeUI/'+method+'()',
            'result':summary['result']}]}
        failures = [{'testName':method,'targetName':'C47NativeUI','failureText':'XCTAssertTrue failed - synthetic',
                     'testIdentifier':1,'testIdentifierString':'C47NativeUI/'+method+'()'}] if failed else []
        summary['devicesAndConfigurations'] = [{'device':device,'testPlanConfiguration':config,
            **{key:summary[key] for key in ('passedTests','failedTests','skippedTests','expectedFailures')}}]
        summary['testFailures'] = failures
        if failed:
            tests['testNodes'][0]['children'] = [{'nodeType':'Failure Message',
                'name':'native_ui47.swift:52: '+failures[0]['failureText']}]
        normalized = {'device':device,'configuration':config,'failures':failures,
            'counts':{key:summary[key] for key in ('passedTests','failedTests','skippedTests','expectedFailures')}}
        return summary,tests,method,device['deviceId'],normalized

    def test_schema_identity_refuses_unknown_or_modified_provider_shapes(self):
        for kind in ('summary','tests','unknown'):
            with self.subTest(kind=kind),self.assertRaises(ValueError):
                n.normal_result_schema04({'schemas':{'fabricated':{'type':'object'}}},kind)

    def test_explicit_counts_are_typed_and_all_ordinary_pass_obligations_are_required(self):
        summary,tests,method,device,normalized = self.documents()
        with patch.object(n,'normal_result_summary_collections04',return_value=normalized):
            self.assertEqual(n.normal_result_documents04(summary,tests,method,device),{
                'expected_case':'C47NativeUI/'+method,'executed':1,'failed':0,'unexpected':0,'skipped':0,'udid':device})
            for key,value in [('totalTestCount',0),('passedTests',0),('failedTests',1),('skippedTests',1),
                              ('expectedFailures',1),('totalTestCount',True),('result','Failed')]:
                bad = {**summary,key:value}
                with self.subTest(key=key),self.assertRaises(ValueError):
                    n.normal_result_documents04(bad,tests,method,device)
            for key in ('totalTestCount','passedTests','failedTests','skippedTests','expectedFailures'):
                bad = dict(summary);del bad[key]
                with self.subTest(missing=key),self.assertRaises(ValueError):
                    n.normal_result_documents04(bad,tests,method,device)

    def test_named_tree_exact_device_configuration_and_no_repetition_or_failure_message_are_required(self):
        summary,tests,method,device,normalized = self.documents()
        mutations = []
        for mutate in [lambda v:v['devices'][0].update(deviceId='another-device'),
                       lambda v:v['devices'][0].update(architecture='arm64'),
                       lambda v:v['testPlanConfigurations'].append(v['testPlanConfigurations'][0]),
                       lambda v:v['testNodes'].append(v['testNodes'][0]),
                       lambda v:v['testNodes'][0].update(nodeIdentifier='C47NativeUI/'+n.NORMAL_UI_CASE),
                       lambda v:v['testNodes'][0].update(result='Skipped'),
                       lambda v:v['testNodes'][0].update(children='not-array'),
                       lambda v:v['testNodes'][0].update(children=[{'nodeType':'Failure Message','name':'failure'}]),
                       lambda v:v['testNodes'][0].update(children=[{'nodeType':'Test Case Run','name':'1','result':'Passed'},
                                                                {'nodeType':'Test Case Run','name':'2','result':'Passed'}])]:
            bad = copy.deepcopy(tests);mutate(bad);mutations.append(bad)
        with patch.object(n,'normal_result_summary_collections04',return_value=normalized):
            for bad in mutations:
                with self.subTest(tests=bad),self.assertRaises(ValueError):
                    n.normal_result_documents04(summary,bad,method,device)

    def test_failed_result_record_cannot_skip_source_case_or_assertion_classification(self):
        summary,tests,method,device,normalized = self.documents(True)
        with patch.object(n,'normal_result_summary_collections04',return_value=normalized):
            self.assertEqual(n.normal_assertion_failure_documents04(summary,tests,method,device)['classification'],
                             'XCTEST_ASSERTION_FAILURE_ONLY')
            with patch.object(n,'normal_assertion_classification04') as classifier:
                self.assertEqual(n.normal_assertion_failure_documents04(summary,tests,method,device)['classification'],
                                 'XCTEST_ASSERTION_FAILURE_ONLY')
                self.assertEqual(classifier.call_count,1)
            for key,value in [('targetName','Unrelated'),('testIdentifierString','C47NativeUI/'+n.NORMAL_UI_CASE),
                              ('testIdentifier',True),('failureText','')]:
                bad = copy.deepcopy(normalized);bad['failures'][0][key] = value
                with patch.object(n,'normal_result_summary_collections04',return_value=bad),\
                     patch.object(n,'normal_assertion_classification04') as classifier,self.assertRaises(ValueError):
                    n.normal_assertion_failure_documents04(summary,tests,method,device)
                classifier.assert_not_called()

    def test_actual_summary_arrays_and_explicit_pass_only_omission_refuse_ambiguous_failures(self):
        summary,tests,method,device,normalized = self.documents()
        self.assertEqual(n.normal_result_documents04(summary,tests,method,device)['executed'],1)
        omitted = copy.deepcopy(summary);del omitted['testFailures']
        self.assertEqual(n.normal_result_documents04(omitted,tests,method,device)['failed'],0)
        for value in (None,{},'unavailable'):
            bad = {**summary,'testFailures':value}
            with self.subTest(value=value),self.assertRaises(ValueError):
                n.normal_result_documents04(bad,tests,method,device)
        failed,failed_tests,method,device,normalized = self.documents(True)
        del failed['testFailures']
        with self.assertRaisesRegex(ValueError,'AMBIGUOUS_MISSING_FAILURE_OUTPUT'):
            n.normal_assertion_failure_documents04(failed,failed_tests,method,device)
        for key in ('totalTestCount','passedTests','failedTests','skippedTests','expectedFailures'):
            bad = dict(omitted);del bad[key]
            with self.subTest(missing_count=key),self.assertRaises(ValueError):
                n.normal_result_documents04(bad,tests,method,device)

    def test_assertion_family_source_node_and_raw_error_line_all_must_correspond(self):
        summary,tests,method,device,normalized = self.documents(True)
        failure = normalized['failures'][0]
        nodes = tests['testNodes'][0]['children']
        observation = n.normal_assertion_classification04(failure,nodes,method)
        raw = ('/synthetic/native_ui47.swift:52: error: -[C47NativeUI.C47NativeUI '+method+
               '] : '+failure['failureText']+'\n').encode()
        self.assertEqual(n.normal_assertion_raw04((raw,b''),method,observation),observation)
        for text in ('Application crashed','XCTAssertTrue failed - app crashed',
                     'XCTAssertTrue failed - Error Domain=infra','test runner exited','XCTFail - unsupported'):
            bad = {**failure,'failureText':text}
            with self.subTest(text=text),self.assertRaises(ValueError):
                n.normal_assertion_classification04(bad,[{'nodeType':'Failure Message',
                    'name':'native_ui47.swift:52: '+text}],method)
        for bad in (raw.replace(b':52:',b':53:'),raw.replace(b'failed - synthetic',b'failed - other'),raw+raw):
            with self.assertRaisesRegex(ValueError,'RAW_AND_PROVIDER_ASSERTION_MUST_MATCH'):
                n.normal_assertion_raw04((bad,b''),method,observation)


class InternalCompletion04Controls(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='internal-completion04-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root/'logs').mkdir()
        self.receipt = {'source':{'head':'a'*40},'commands':[],'stages':{}}
        methods = [('core','test01CoreRetainedNativeJourney'),('larger-text','test03LargerTextManualInput'),
                   ('export','test02LocalExport'),('export-cleanup','test04RemoveSyntheticLocalExport'),
                   ('rights','test05ConsentWithdrawal')]
        for index,(suffix,method) in enumerate(methods,1):
            name = 'native-internal-supported-owner-ui-'+suffix
            raw = ("Test Case '-[C47NativeUI.C47InternalOwnerUI "+method+"]' passed.\n"+
                   'Executed 1 test, with 0 failures (0 unexpected) in 1 second.\n').encode()
            row = {'name':name,'required':True,'state':'PASS','exit_code':0,'capture_complete':True,
                   'argv':['xcodebuild','test','-only-testing:C47NativeUI/C47InternalOwnerUI/'+method]}
            for kind,data in [('stdout',raw),('stderr',b'')]:
                path = 'logs/'+str(index)+'.'+kind
                (self.root/path).write_bytes(data)
                row.update({kind:path,kind+'_bytes':len(data),kind+'_sha256':hashlib.sha256(data).hexdigest()})
            proof = n.selected_xctest_summary(raw.decode(),'C47InternalOwnerUI',method)
            proof.update(stdout_sha256=hashlib.sha256(raw).hexdigest(),stderr_sha256=hashlib.sha256(b'').hexdigest(),source_head='a'*40)
            self.receipt['commands'].append(row)
            self.receipt['stages']['internal-supported-owner-ui-'+suffix] = {'status':'PASS','details':{
                'tests':['C47NativeUI/C47InternalOwnerUI/'+method],'lane':'internal-supported-owner','positive_xctest':proof}}
        destination = {'export_outcome':'local_saved','destination_exists':True,'selected_folder_absent_before_export':True,
            'destination_observed_after_actual_save_dispatch':True,'source_cache_is_destination':False}
        cleanup = {'state':'PASS','original_destination_absent':True}
        self.receipt['export_destination_verification'] = {**destination,'state':'PASS','cleanup':cleanup}
        self.receipt['stages']['native-export-local-destination'] = {'status':'PASS','details':destination}
        self.receipt['stages']['native-export-original-destination-removed-via-files-ui'] = {'status':'PASS','details':cleanup}
        observation = patch.object(n,'read_native_file',side_effect=lambda path:Path(path).read_bytes())
        observation.start();self.addCleanup(observation.stop)

    def completion(self,receipt=None):
        return n.internal_journey_completion04(SimpleNamespace(receipt=receipt or self.receipt,output=self.root))

    def test_only_five_actual_cases_and_actual_export_and_cleanup_pass_complete_the_scope(self):
        proof = self.completion()
        self.assertTrue(proof['whole_scope_complete'])
        self.assertEqual(proof['completed_case_count'],5)
        for state in ('NOT_RUN','NOT_VERIFIED'):
            bad = copy.deepcopy(self.receipt)
            bad['export_destination_verification']['state'] = state
            result = self.completion(bad)
            self.assertFalse(result['whole_scope_complete'])
            self.assertEqual(result['completed_case_count'],5)
        bad = copy.deepcopy(self.receipt)
        bad['export_destination_verification']['cleanup']['state'] = 'NOT_VERIFIED'
        self.assertFalse(self.completion(bad)['whole_scope_complete'])
        bad = copy.deepcopy(self.receipt)
        bad['commands'] = [row for row in bad['commands'] if not row['name'].endswith('export-cleanup')]
        result = self.completion(bad)
        self.assertFalse(result['whole_scope_complete'])
        self.assertEqual(result['completed_case_count'],4)

    def test_changed_case_stream_extra_case_or_false_capture_cannot_complete_internal(self):
        for mutation in [lambda v:v['commands'][0].update(capture_complete=False),
                         lambda v:v['commands'].append({**v['commands'][0],'name':'native-internal-supported-owner-ui-unknown'}),
                         lambda v:v['commands'][0]['argv'].append('-only-testing:Unrelated/test')]:
            bad = copy.deepcopy(self.receipt);mutation(bad)
            self.assertFalse(self.completion(bad)['whole_scope_complete'])
        path = self.root/self.receipt['commands'][0]['stdout']
        path.write_bytes(path.read_bytes()+b'changed stream')
        self.assertFalse(self.completion()['whole_scope_complete'])


class AuthenticatedDevExecutable04Controls(unittest.TestCase):
    def test_development_main_permission_loss_refuses_without_expanding_resource_exceptions(self):
        fixture_test = InstalledAppIdentity04Controls('test_complete_release_and_debug_inventories_pass_with_honest_javascript_qualifications')
        fixture_test.setUp()
        self.addCleanup(fixture_test.doCleanups)
        root,app,installed,runner,inventory,authority,rows,signing,calls,bundle = fixture_test.fixture('development-main-loss',True)
        self.assertEqual(authority['executable'],'LayerwellDev')
        def observed(path):
            result = rows(path)
            if Path(path) == installed:
                next(row for row in result if row['path'] == 'LayerwellDev')['mode'] = '0o644'
            return result
        with patch.object(n,'bundle_inventory',side_effect=observed),patch.object(n,'simulator_signing',return_value=signing),\
             self.assertRaisesRegex(ValueError,'INSTALLED_MAIN_EXECUTABLE_PERMISSION'):
            n.verify_installed_app(runner,installed,app,bundle)
        self.assertNotIn('installed',runner.receipt['stages'])
        diff = json.loads((runner.output/'installed-product-verification-compiled/exact-inventory-differences.json').read_bytes())
        self.assertEqual(diff['producer_to_installed'][0]['path'],'LayerwellDev')
        self.assertEqual(diff['producer_to_installed'][0]['different_fields'],['mode'])
        with self.assertRaisesRegex(ValueError,'AUTHENTICATED_EXECUTABLE_NAME'):
            n.installed_app_inventory_proof(inventory['files'],inventory['files'],'UnrecognizedExecutable')


class FixedBuild35Recovery36Tests(unittest.TestCase):
    """Pure harness/authentication controls; these never execute or admit native UI."""
    def delta_fixture(self):
        repo=Path(__file__).resolve().parents[3]
        names=['scripts/release/full-app-j01/native_runtime47.py','scripts/release/full-app-j01/native_runtime47.test.py',
               'docs/phase-9/ios-generated-input-succession47.v1.json']
        old={name:subprocess.check_output(['git','--no-replace-objects','show',n.RESUME36_ORIGIN['head']+':'+name],cwd=repo) for name in names}
        # C04 reuse is a frozen historical witness; C05 must not inherit its authority.
        checkpoint='fa4275986b727b3e6d855b059d5688210a09e440'
        current={name:subprocess.check_output(['git','--no-replace-objects','show',checkpoint+':'+name],cwd=repo) for name in names}
        return names,old,current

    def test_storage05_current_diagnostic_inputs_refuse_fixed35_reuse(self):
        names,old,historical=self.delta_fixture()
        repo=Path(n.__file__).resolve().parents[3]
        current={name:(repo/name).read_bytes() for name in names}
        descriptor=json.loads(current[names[2]])
        policy=descriptor['storageOrigin05']
        self.assertEqual(policy['authority'],'BRAIN-C47-STORAGE-ROOT-CAUSE-RUNTIME-05')
        self.assertEqual(set(policy['sourcePaths']),{
            'scripts/release/full-app-j01/storage_trace47.py',
            'scripts/release/full-app-j01/storage_trace47.test.py',
            'scripts/release/full-app-j01/storage_origin47.mjs'})
        self.assertTrue(policy['diagnosticOnly']);self.assertFalse(policy['normalProductReuseAllowed'])
        for name in names[:2]:
            pin=next(row for row in descriptor['sourcePins'] if row['path']==name)
            self.assertEqual(pin,{'path':name,'bytes':len(current[name]),'sha256':hashlib.sha256(current[name]).hexdigest()})
        self.assertNotEqual(current[names[2]],historical[names[2]])
        # Frozen C04 harness bytes remain a historical witness, not a current reuse grant.
        for path,expected in {
            names[0]:{'bytes':250032,'sha256':'2ba9683a1a4eefe7a6a846fcb3c93a67c8e142389edc9df697ea6040f949f5b4'},
            names[1]:{'bytes':166608,'sha256':'2be2a5d2356e44b09fb32728e1fc2b27396d3d9018bc779420f794fe35602537'},
            names[2]:{'bytes':17385,'sha256':'c4e7b319e0b80d64f12351d0d3c3bef321f14ff5e992728e63d2a73e7c76032e'},
        }.items():
            self.assertEqual({'bytes':len(historical[path]),'sha256':hashlib.sha256(historical[path]).hexdigest()},expected)
        # Synthetic fixture only: freeze the old reviewed harness, vary current generated inputs.
        # Its two self-pins describe those fixture bytes; no actual descriptor is modified.
        generated_descriptor=json.loads(current[names[2]])
        for path in names[:2]:
            pin=next(row for row in generated_descriptor['sourcePins'] if row['path']==path)
            pin.update(bytes=len(historical[path]),sha256=hashlib.sha256(historical[path]).hexdigest())
        frozen_harness_current_generated_fixture={**historical,names[2]:json.dumps(generated_descriptor).encode()}
        with self.assertRaisesRegex(ValueError,'RESUME36_GENERATED_INPUT_OR_AUTHORITY_DRIFT'):
            n.verify_reuse36_delta(names,old,frozen_harness_current_generated_fixture)
        # Preserve the exact115 rejection witness; current observer harness also refuses Build35.
        witness115={name:subprocess.check_output(['git','show','9269c1d2e7dc87bcb8c6578503e84f71e53fc638:'+name],cwd=repo) for name in names}
        with self.assertRaisesRegex(ValueError,'RESUME36_EXACT_REVIEWED_FUNCTION_BODY:execution_mode'):
            n.verify_reuse36_delta(names,old,witness115)
        with self.assertRaisesRegex(ValueError,'RESUME36_EXACT_REVIEWED_FUNCTION_BODY:consume_produced_app'):
            n.verify_reuse36_delta(names,old,current)

    def test_fixed36_accepts_only_reviewed_harness_delta(self):
        args=self.delta_fixture();self.assertEqual(n.verify_reuse36_delta(*args),sorted(args[0]))

    def test_fixed36_rejects_product_lock_installer_signing_and_ui_changes(self):
        for name in ('apps/mobile/src/features/healthConsent/lifecycle.ts','package-lock.json','apps/mobile/app.config.js',
                     'scripts/phase5/patch-expo-widgets-lifecycle.mjs','scripts/release/full-app-j01/simulator_signing47.py',
                     'scripts/release/full-app-j01/native_ui47.swift','scripts/release/full-app-j01/native_ui47.rb'):
            names,old,current=self.delta_fixture()
            with self.subTest(name=name),self.assertRaisesRegex(ValueError,'RESUME36_EXACT_NON_PRODUCT_DELTA'):
                n.verify_reuse36_delta(names+[name],old,current)

    def test_fixed36_rejects_changed_build_environment_or_generated_authority(self):
        names,old,current=self.delta_fixture();py=names[0]
        current[py]=current[py].replace(b"'IOS_WIDGET_EXTENSION_BUILD_ENABLED': 'false'",b"'IOS_WIDGET_EXTENSION_BUILD_ENABLED': 'true'",1)
        with self.assertRaisesRegex(ValueError,'RESUME36_PROTECTED_BUILD_DEPENDENCY_SIGNING_OR_ENVIRONMENT_DRIFT'):
            n.verify_reuse36_delta(names,old,current)
        names,old,current=self.delta_fixture();value=json.loads(current[names[2]]);value['registry'][0]['path']='node_modules/foreign'
        current[names[2]]=json.dumps(value).encode()
        with self.assertRaisesRegex(ValueError,'RESUME36_GENERATED_INPUT_OR_AUTHORITY_DRIFT'):
            n.verify_reuse36_delta(names,old,current)

    def test_fixed36_requires_exact_self_pins_and_unchanged_target60(self):
        names,old,current=self.delta_fixture();value=json.loads(current[names[2]])
        next(row for row in value['sourcePins'] if row['path']==names[0])['sha256']='0'*64
        current[names[2]]=json.dumps(value).encode()
        with self.assertRaisesRegex(ValueError,'RESUME36_EXACT_CURRENT_SELF_PIN'):n.verify_reuse36_delta(names,old,current)
        names,old,current=self.delta_fixture();current[names[0]]=current[names[0]].replace(
            b"bundle, *arguments], timeout=60)",b"bundle, *arguments], timeout=300)",1)
        with self.assertRaisesRegex(ValueError,'RESUME36_.*DRIFT'):n.verify_reuse36_delta(names,old,current)

    def test_fixed36_removing_required_three_case_gate_is_rejected(self):
        names,old,current=self.delta_fixture()
        current[names[0]]=current[names[0]].replace(b"aggregate.get('executed') == 3",b"aggregate.get('executed') == 2",1)
        with self.assertRaisesRegex(ValueError,'RESUME36_EXACT_REVIEWED_FUNCTION_BODY'):
            n.verify_reuse36_delta(names,old,current)

    def test_fixed36_mode_is_normal_only_and_exclusive(self):
        self.assertEqual(n.execution_mode('normal',resume36=True),'resume36')
        for stage in ('source','build','internal'):
            with self.assertRaisesRegex(ValueError,'RESUME36_NORMAL_ONLY'):n.execution_mode(stage,resume36=True)
        for other in ('resume25','probe','consent_trace04','consent_runtime27'):
            with self.assertRaisesRegex(ValueError,'EXCLUSIVE_EXECUTION_MODE'):n.execution_mode('normal',resume36=True,**{other:True})

    def synthetic_partial_fixture(self,directory):
        source={'head':n.RESUME36_ORIGIN['head'],'tree':n.RESUME36_ORIGIN['tree']}
        parent={'stage':'normal','stage_complete':False,'status':'PARTIAL_BLOCKED','source':source,
            'failure':{'detail':'C47_COMMAND_FAILED:simulator-launch'},'release':'NO_GO','acceptance_granted':False,
            'stages':{},'commands':[],'qualification':'SYNTHETIC_STRUCTURE_FIXTURE_NOT_NATIVE_EVIDENCE'}
        child={'source':source,'method':n.NORMAL_UI_CASES04[0],'ordinary_suite_version':4,'status':'PARTIAL_BLOCKED',
            'commands':[],'qualification':'SYNTHETIC_STRUCTURE_FIXTURE_NOT_NATIVE_EVIDENCE'}
        for receipt,root,count in ((parent,directory,37),(child,directory/'ordinary-v04/01',27)):
            (root/'logs').mkdir(parents=True)
            for index in range(1,count+1):
                launch=receipt is child and index==25
                name='simulator-launch' if launch else 'fixture-command-'+str(index)
                row={'name':name,'capture_complete':True,'state':'FAIL' if launch else 'PASS','required':True,
                     'exit_code':124 if launch else 0,'timed_out':launch,'timeout_seconds':60}
                for kind in ('stdout','stderr'):
                    path='logs/'+str(index).zfill(3)+'-'+name+'.'+kind;(root/path).write_bytes(b'')
                    row[kind]=path;row[kind+'_bytes']=0;row[kind+'_sha256']=hashlib.sha256(b'').hexdigest()
                receipt['commands'].append(row)
            (root/'execution.json').write_text(json.dumps(receipt))
        return parent

    def test_fixed36_synthetic_partial_is_failure_and_never_a_normal_pass(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory=Path(temporary);receipt=self.synthetic_partial_fixture(directory)
            proof=n.verify_partial36_execution(receipt,directory)
            self.assertFalse(proof['normal_admitted']);self.assertFalse(proof['actual_normal_xctest_executed'])
            receipt['stage_complete']=True
            with self.assertRaisesRegex(ValueError,'RESUME36_EXACT_FAILED_NORMAL'):n.verify_partial36_execution(receipt,directory)

    def test_fixed36_partial_provider_wrong_head_artifact_or_job_refuse_before_download(self):
        origin=n.RESUME36_ORIGIN;pin=origin['partial']
        run={'id':origin['run_id'],'run_attempt':2,'head_sha':origin['head'],'head_branch':n.STAGE_BRANCH,
             'event':'pull_request','path':n.STAGE_WORKFLOW,'repository':{'full_name':n.STAGE_REPOSITORY,'private':False},
             'head_repository':{'full_name':n.STAGE_REPOSITORY},'qualification':'SYNTHETIC_METADATA_FIXTURE'}
        jobs={'total_count':4,'jobs':[{'name':'C47 '+role,'id':pin['job_id'] if role=='normal' else index,
             'run_id':origin['run_id'],'head_sha':origin['head'],'status':'completed','conclusion':'failure'}
             for index,role in enumerate(('source','build','normal','internal'),1)]}
        artifact={'id':pin['artifact_id'],'name':'campaign47-native-normal-'+origin['head']+'-'+str(origin['run_id'])+'-2',
             'expired':False,'digest':'sha256:'+pin['digest'],'size_in_bytes':pin['wire_bytes'],
             'workflow_run':{'id':origin['run_id'],'head_sha':origin['head']}}
        context={'repository':n.STAGE_REPOSITORY,**{key:origin[key] for key in ('head','tree','run_id','run_attempt')}}
        for kind in ('head','artifact','job'):
            r,j,a=copy.deepcopy((run,jobs,artifact))
            if kind=='head':r['head_sha']='0'*40
            elif kind=='artifact':a['id']+=1
            else:next(row for row in j['jobs'] if row['name']=='C47 normal')['id']+=1
            with self.subTest(kind=kind),tempfile.TemporaryDirectory() as temporary,patch.object(n,'_stage_api',side_effect=[(r,'a'*64),(j,'b'*64),(a,'c'*64)]),patch.object(n,'_stage_download') as download:
                with self.assertRaisesRegex(ValueError,'RESUME36_'):n.resume36_partial_import(context,'fixture-token',Path(temporary)/'new')
                download.assert_not_called()

    def test_fixed36_missing_partial_evidence_cannot_enable_reuse(self):
        names,old,current=self.delta_fixture()
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)
            for name,data in current.items():(root/name).parent.mkdir(parents=True,exist_ok=True);(root/name).write_bytes(data)
            source={'head':'a'*40,'tree':'b'*40};runner=SimpleNamespace(root=root,env={},receipt={'source':source})
            context={**source,'repository':n.STAGE_REPOSITORY,'runner_temp':str(root),'run_id':999,'run_attempt':1}
            def git(argv,**kwargs):
                args=argv[2:]
                if args[:2]==['merge-base','--is-ancestor']:return b''
                if args[0]=='rev-parse':return n.RESUME36_ORIGIN['tree'].encode()+b'\n'
                if args[:2]==['diff','--name-only']:return ('\n'.join(names)+'\n').encode()
                if args[:2]==['diff','--name-status']:return ''.join('M\t'+name+'\n' for name in names).encode()
                if args[:2]==['diff','--summary']:return b''
                if args[0]=='show':return old[args[1].split(':',1)[1]]
                raise AssertionError(args)
            imported={role:{'producer':{'producer_job_id':n.RESUME36_ORIGIN[role]['job_id']},'payload_directory':str(root)} for role in ('source','build')}
            with patch.object(n.subprocess,'check_output',side_effect=git),patch.object(n,'load_authenticated_stage_inputs',return_value={'imported_provenance':imported}),patch.object(n,'verify_producer_streams36'),patch.object(n,'resume36_partial_import',side_effect=ValueError('MISSING_PARTIAL_PROOF')):
                with self.assertRaisesRegex(ValueError,'MISSING_PARTIAL_PROOF'):n.resume36_import(runner,context,'fixture-token')
            self.assertNotIn('authenticated_app_build_reuse36',runner.receipt)

    def test_fixed36_settings_probe_uses_system_identity_exact_pid_and_no_target_launch(self):
        runtime_root='/Library/Developer/CoreSimulator/Volumes/fixture/Contents/Resources/RuntimeRoot'
        registry={'com.apple.Preferences':{'CFBundleIdentifier':'com.apple.Preferences','CFBundleExecutable':'Preferences',
            'CFBundleName':'Settings','CFBundleDisplayName':'Settings','ApplicationType':'System',
            'Path':runtime_root+'/Applications/Preferences.app','Bundle':'file://'+runtime_root+'/Applications/Preferences.app/'}}
        runner=SimpleNamespace(receipt={'simulator':{'runtime':{'runtimeRoot':runtime_root}}},output=Path('unused'),text=unittest.mock.Mock(side_effect=['com.apple.Preferences: 91','91\t0\tcom.apple.Preferences']),run=unittest.mock.Mock(),passed=unittest.mock.Mock())
        with patch.object(n,'executed_producer_command',return_value=({},(json.dumps(registry).encode(),b''))):
            n.platform_bootstrap36(runner,'device')
        self.assertEqual(runner.text.call_args_list[0].kwargs,{'timeout':60})
        self.assertTrue(all('com.layerwell.app.staging' not in str(call) for call in runner.text.call_args_list))
        runner.text=unittest.mock.Mock(side_effect=['com.apple.Preferences: 91','92\t0\tcom.apple.Preferences'])
        with patch.object(n,'executed_producer_command',return_value=({},(json.dumps(registry).encode(),b''))):
            with self.assertRaisesRegex(ValueError,'PLATFORM36_SAME_SETTINGS_PID'):n.platform_bootstrap36(runner,'device')

    def test_fixed36_diagnostic_exception_preserves_primary_probe_failure(self):
        fixture=Ordinary04EEControls();fixture.setUp();self.addCleanup(fixture.doCleanups)
        parent,calls,children,replacements=fixture.loop_fixture('none')
        parent.receipt['authenticated_app_build_reuse36']={'fixture_only':True}
        from contextlib import ExitStack
        with ExitStack() as stack:
            for module,name,value in replacements:stack.enter_context(patch.object(module,name,value))
            stack.enter_context(patch.object(n,'platform_bootstrap36',side_effect=ValueError('PRIMARY_PLATFORM_FAILURE')))
            stack.enter_context(patch.object(n,'launch_failure_diagnostics36',side_effect=OSError('SECONDARY_DIAGNOSTIC_IO')))
            with self.assertRaisesRegex(ValueError,'PRIMARY_PLATFORM_FAILURE'):
                n.run_normal(parent,Path('ios'),fixture.directory,Path('app'),'com.layerwell.app.staging','a'*40)
        self.assertEqual(len(children),1)
        self.assertEqual(children[0].receipt['failure']['detail'],'PRIMARY_PLATFORM_FAILURE')
        self.assertEqual(children[0].receipt['launch36_diagnostic_error_type'],'OSError')
        self.assertNotIn('normal-staging-ui',parent.receipt['stages'])

    def test_fixed36_named_normal_suite_gate_stays_required_before_internal(self):
        with self.assertRaisesRegex(ValueError,'NORMAL_STAGING_UI_REQUIRED_BEFORE_INTERNAL'):
            n.normal_xctest_gate(SimpleNamespace(receipt={'stages':{}},root=Path('unused'),output=Path('unused')))
        partial={'stages':{'normal-staging-ui':{'status':'PASS','details':{'positive_xctest':{'suite_version':4,'executed':2,'failed':0,'unexpected':0,'skipped':0}}}}}
        with self.assertRaisesRegex(ValueError,'NORMAL04_COMPLETE_PASS_REQUIRED_BEFORE_INTERNAL'):
            n.normal_xctest_gate(SimpleNamespace(receipt=partial,root=Path('unused'),output=Path('unused')))



class OrdinaryRelease05BuildTests(unittest.TestCase):
    """Synthetic producer contracts; never a real app, compiler or storage result."""
    def fixture(self):
        f=SourceStage04Tests('test_same_source_full_thirty_streams_and_no_app_are_qualified')
        f.setUp();self.addCleanup(f.doCleanups)
        f.source.update(base=n.BASE,base_tree=n.BASE_TREE,helper='synthetic-test-helper',
            helper_sha256='c'*64,inventory={'qualification':'SYNTHETIC_NOT_GIT_SOURCE'})
        for path in ('source-before.json','source-after-controls.json'):f.write(path,f.source)
        proof=f.verify()
        output=f.root/'build';output.mkdir();(output/'logs').mkdir()
        names=('normal-install','postinstall-check','current-generated47-source','current-generated47-native',
            'current-generated47-resolved','pods','product-file','product-architectures','product-build-version',
            'configure-simulator-app-target','native-build-settings','signed-product-verify-signature','native-build')
        commands=[]
        for i,name in enumerate(names):
            command={'name':name,'state':'PASS','exit_code':0,'capture_complete':True,'required':True,
                'argv':['xcodebuild','-configuration','Release','-sdk','iphonesimulator',*n.APP_SIMULATOR_BUILD_FLAGS,'build']}
            for stream in ('stdout','stderr'):
                path=output/'logs'/(str(i)+'.'+stream);path.write_bytes(b'SYNTHETIC_NOT_COMPILER_OUTPUT')
                command.update({stream:path.relative_to(output).as_posix(),stream+'_bytes':path.stat().st_size,stream+'_sha256':n.sha(path)})
            commands.append(command)
        app={'qualification':'SYNTHETIC_NOT_AN_APP'}
        receipt={'stage':'build','status':'BUILD_NATIVE_COMPILED_RUNTIME_NOT_RUN','source':f.source,
            'stages':{'compiled':{'status':'PASS','details':app}},'commands':commands,
            'ordinary_release05':{**n.ORDINARY_RELEASE05,'source_head':f.source['head'],'source_tree':f.source['tree']},
            'authenticated_source_controls04':proof,'imported_provenance':{'source':f.provenance}}
        for path in ('toolchain.json','current-generated47-source.json'):(output/path).write_bytes((f.output/path).read_bytes())
        (output/'source-after-build.json').write_bytes(json.dumps(f.source).encode());(output/'app-artifact.json').write_bytes(json.dumps(app).encode())
        provenance={'payload_directory':str(output)}
        def verify(source=True):
            (output/'execution.json').write_bytes(json.dumps(receipt).encode())
            return n.verify_build_producer(f.runner,provenance,f.provenance if source else None)
        return f,output,receipt,verify

    def test_build_only_mode_is_exclusive_and_keeps_all_legacy_modes(self):
        self.assertEqual(n.execution_mode('build',ordinary_release05=True),'ordinary-release05')
        self.assertEqual(n.execution_mode('build'),'build')
        for stage in ('source','normal','internal'):
            with self.subTest(stage=stage),self.assertRaisesRegex(ValueError,'BUILD_ONLY'):
                n.execution_mode(stage,ordinary_release05=True)
        for flag in ('probe','resume25','resume36','consent_trace04','consent_runtime27'):
            with self.subTest(flag=flag),self.assertRaisesRegex(ValueError,'EXCLUSIVE'):
                n.execution_mode('build',ordinary_release05=True,**{flag:True})

    def test_new_ordinary_build_cannot_run_without_exact_source_stage_or_be_a_runtime_mode(self):
        for kwargs in ({},{'compile_only':True},{'compile_only':True,'consent_trace04':True,'source_provenance':{}}):
            with self.subTest(kwargs=kwargs),patch.object(n,'prepare') as prepare,self.assertRaisesRegex(ValueError,'AUTHENTICATED_SOURCE_BUILD_ONLY'):
                n.execute(SimpleNamespace(),ordinary_release05=True,**kwargs)
            prepare.assert_not_called()

    def test_current_source_and_new_release_commands_qualify_without_claiming_smoke_or_runtime(self):
        f,output,receipt,verify=self.fixture()
        result=verify()
        self.assertEqual(result.receipt['ordinary_release05']['role'],'NEW_UNINSTRUMENTED_RELEASE05_NOT_RUNTIME_PROOF')
        self.assertFalse(result.receipt['ordinary_release05']['ordinary_admitted'])
        self.assertNotIn('app-process-keychain',result.receipt['stages'])
        del receipt['ordinary_release05']
        with self.assertRaisesRegex(ValueError,'REAL_APP_KEYCHAIN_REQUIRED'):verify()

    def test_profile_tampering_stale_source_or_diagnostic_stage_cannot_be_an_ordinary_producer(self):
        f,output,receipt,verify=self.fixture();original=copy.deepcopy(receipt)
        for mutate in (lambda x:x['ordinary_release05'].update(source_head='d'*40),
                       lambda x:x['ordinary_release05'].update(ordinary_admitted=True),
                       lambda x:x['ordinary_release05'].update(ordinary_admitted=0),
                       lambda x:x['ordinary_release05'].update(new_current_source_build=1),
                       lambda x:x['ordinary_release05'].update(separate_keychain_smoke_run=True),
                       lambda x:x['stages'].update({'app-process-keychain':{'status':'PASS'}}),
                       lambda x:x['commands'].append({'name':'app-keychain-diagnostic-build'})):
            receipt.clear();receipt.update(copy.deepcopy(original));mutate(receipt)
            with self.assertRaises(ValueError):verify()
        receipt.clear();receipt.update(copy.deepcopy(original))
        with self.assertRaises(ValueError):verify(False)
        receipt['source']=dict(f.source,head='e'*40)
        with self.assertRaisesRegex(ValueError,'SAME_WHOLE_SOURCE'):verify()

    def test_missing_signed_build_wrong_configuration_or_changed_raw_stream_still_refuse(self):
        f,output,receipt,verify=self.fixture();original=copy.deepcopy(receipt)
        receipt['commands']=[row for row in receipt['commands'] if row['name']!='signed-product-verify-signature']
        with self.assertRaisesRegex(ValueError,'ACTUAL_COMMAND'):verify()
        receipt.clear();receipt.update(copy.deepcopy(original))
        build=next(row for row in receipt['commands'] if row['name']=='native-build');build['argv'][2]='Debug'
        with self.assertRaisesRegex(ValueError,'REAL_RELEASE_BUILD'):verify()
        receipt.clear();receipt.update(copy.deepcopy(original))
        build=next(row for row in receipt['commands'] if row['name']=='native-build');(output/build['stdout']).write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError,'RAW_LOG_IDENTITY'):verify()



class OptionalCapture46Tests(unittest.TestCase):
    """Host-command/cleanup fixtures only; never an iOS or suite PASS claim."""
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(dir=Path(tempfile.gettempdir()).resolve())
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)

    def double_wait_timeout(self):
        # Closed actual in-memory streams isolate the second process wait;
        # the OS/process outcome itself is deliberately unknown in this fixture.
        class Pipe(io.BytesIO):
            def __init__(self,raw):
                super().__init__(raw)
                self.done=n.threading.Event()
            def close(self):
                super().close()
                self.done.set()
        class Process:
            def __init__(self):
                self.stdout=Pipe(b'diagnostic raw stdout')
                self.stderr=Pipe(b'diagnostic raw stderr')
                self.pid=987654321
                self.waits=[]
                self.killed=False
            def wait(self,timeout):
                self.stdout.done.wait(1);self.stderr.done.wait(1)
                self.waits.append(timeout)
                raise subprocess.TimeoutExpired('SYNTHETIC_HOST_COMMAND',timeout)
            def kill(self):self.killed=True
        return Process()

    def test_optional_diagnostic_second_wait_timeout_is_retained_not_promoted(self):
        runner=n.Runner(self.root,self.root/'optional')
        process=self.double_wait_timeout()
        with patch.object(n.subprocess,'Popen',return_value=process),patch.object(n.os,'killpg',create=True):
            paths=runner.run('optional-observation',['synthetic-observation'],timeout=30,
                required=False,diagnostic=True)
        row=runner.receipt['commands'][0]
        self.assertEqual(process.waits,[30,30])
        self.assertEqual((row['state'],row['exit_code'],row['error_type']),('FAIL',124,'TimeoutExpired'))
        self.assertFalse(row['capture_complete'])
        self.assertTrue(row['optional_diagnostic_timeout_retained'])
        self.assertEqual(row['output_scope'],'PARTIAL_BYTES_FROZEN_BEFORE_RECEIPT_HASHING')
        for key,path in zip(('stdout','stderr'),paths):
            raw=path.read_bytes()
            self.assertEqual(row[key+'_bytes'],len(raw))
            self.assertEqual(row[key+'_sha256'],hashlib.sha256(raw).hexdigest())
        self.assertEqual(runner.receipt['stages'],{})
        self.assertFalse(runner.receipt['campaign_candidate_complete'])
        self.assertFalse(runner.receipt['acceptance_granted'])

    def test_required_or_substantive_second_wait_timeout_still_raises(self):
        for index,(required,diagnostic) in enumerate(((True,False),(True,True),(False,False))):
            with self.subTest(required=required,diagnostic=diagnostic):
                runner=n.Runner(self.root,self.root/str(index))
                process=self.double_wait_timeout()
                with patch.object(n.subprocess,'Popen',return_value=process),patch.object(n.os,'killpg',create=True):
                    with self.assertRaises(subprocess.TimeoutExpired):
                        runner.run('substantive',['synthetic-command'],timeout=30,
                            required=required,diagnostic=diagnostic)
                row=runner.receipt['commands'][0]
                self.assertEqual(row['exit_code'],124)
                self.assertFalse(row['capture_complete'])
                self.assertNotIn('optional_diagnostic_timeout_retained',row)
                self.assertEqual(runner.receipt['stages'],{})

    def test_unexpected_direct_runner_error_is_not_treated_as_optional_timeout(self):
        runner=n.Runner(self.root,self.root/'unexpected')
        process=SimpleNamespace(stdout=io.BytesIO(b''),stderr=io.BytesIO(b''),pid=987654321,
            wait=lambda timeout: (_ for _ in ()).throw(RuntimeError('SYNTHETIC_UNEXPECTED')))
        with patch.object(n.subprocess,'Popen',return_value=process):
            with self.assertRaisesRegex(RuntimeError,'SYNTHETIC_UNEXPECTED'):
                runner.run('observation',['synthetic-command'],required=False,diagnostic=True)
        row=runner.receipt['commands'][0]
        self.assertEqual((row['state'],row['exit_code'],row['error_type']),('FAIL',125,'RuntimeError'))
        self.assertNotIn('optional_diagnostic_timeout_retained',row)

    def normal_fixture(self,fail_selected=False):
        runner=n.Runner(self.root,self.root/'normal')
        runner.receipt['source']={'head':'a'*40,'tree':'b'*40}
        ios=self.root/'ios';ios.mkdir()
        products=self.root/'products';products.mkdir()
        events=[]
        def command(child,name,argv,**kwargs):
            events.append((child.output.name,name))
            if name=='generate-native-ui-runner':
                ui=child.output/'ui';(ui/'runner/C47NativeUI.xcodeproj').mkdir(parents=True)
                n.write_json(ui/'runner.json',{'project':str(ui/'runner/C47NativeUI.xcodeproj')})
            if name=='simulator-final-screenshot' and child.output.name=='02':
                raise subprocess.TimeoutExpired('SYNTHETIC_OPTIONAL_SCREENSHOT',30)
            return child.logs/'synthetic.stdout',child.logs/'synthetic.stderr'
        def simulator(child,lane):
            events.append((child.output.name,'prepare'))
            device='00000000-0000-4000-8000-'+str(int(child.output.name)).zfill(12)
            child.receipt['simulator']={'udid':device}
            return device
        def text(child,name,argv,**kwargs):
            device=child.receipt['simulator']['udid']
            data='00000000-0000-4000-8000-'+str(int(child.output.name)+100).zfill(12)
            return str(Path.home()/'Library/Developer/CoreSimulator/Devices'/device/'data/Containers/Data/Application'/data)
        def installed(child,*args):child.passed('installed',{'fixture':'SYNTHETIC_INSTALLED_PRODUCT'})
        def execute(child,project,case_products,method,device,environment):
            events.append((child.output.name,'selected-case'))
            if fail_selected and child.output.name=='02':raise ValueError('REQUIRED_SELECTED_UI_FAILURE')
            counts={'executed':1,'failed':0,'unexpected':0,'skipped':0}
            return {'outcome':'PASS','positive_xctest':counts,
                'result_bundle':{'parsed':{'expected_case':'C47NativeUI/'+method,'udid':device,**counts}}}
        def retain(child):events.append((child.output.name,'retain-results'))
        def gate(parent):
            events.append(('parent','strict-gate-called'))
            value=parent.receipt['stages']['normal-staging-ui']['details']['positive_xctest']
            self.assertEqual((value['executed'],value['failed'],value['unexpected'],value['skipped']),(3,0,0,0))
        return runner,ios,products,events,dict(command=command,simulator=simulator,text=text,
            installed=installed,execute=execute,retain=retain,gate=gate)

    def exercise_normal(self,fail_selected=False):
        runner,ios,products,events,f=self.normal_fixture(fail_selected)
        with patch.object(n.Runner,'run',f['command']),patch.object(n.Runner,'text',f['text']),\
             patch.object(n,'read_native_file',side_effect=lambda path:Path(path).read_bytes()),\
             patch.object(n,'normal_runner04',return_value={'tests':['SYNTHETIC_THREE_CASE_RUNNER']}),\
             patch.object(n,'prepare_simulator',f['simulator']),\
             patch.object(n,'install_simulator_app',return_value=self.root/'Synthetic.app'),\
             patch.object(n,'verify_installed_app',f['installed']),\
             patch.object(n,'launch_and_verify',return_value=12345),\
             patch.object(n,'normal_case_execution04',f['execute']),\
             patch.object(n,'retain_result_bundles',f['retain']),\
             patch.object(n,'normal_xctest_gate',f['gate']),\
             patch.object(n.Runner,'source_proof',return_value={'fixture':'SYNTHETIC_SOURCE_PROOF'}):
            if fail_selected:
                with self.assertRaisesRegex(ValueError,'REQUIRED_SELECTED_UI_FAILURE'):
                    n.run_normal(runner,ios,products,self.root/'Synthetic.app','com.layerwell.app.staging','a'*40)
            else:n.run_normal(runner,ios,products,self.root/'Synthetic.app','com.layerwell.app.staging','a'*40)
        return runner,events

    def test_optional_capture_cannot_skip_second_shutdown_retention_or_third_fresh_case(self):
        runner,events=self.exercise_normal()
        self.assertEqual([x for x in events if x[1]=='selected-case'],
            [('01','selected-case'),('02','selected-case'),('03','selected-case')])
        self.assertLess(events.index(('02','simulator-final-screenshot')),events.index(('02','simulator-shutdown')))
        self.assertLess(events.index(('02','simulator-shutdown')),events.index(('02','retain-results')))
        self.assertLess(events.index(('02','retain-results')),events.index(('03','prepare')))
        self.assertIn(('parent','strict-gate-called'),events)
        second=json.loads((runner.output/'ordinary-v04/02/execution.json').read_text())
        self.assertEqual(second['status'],'NORMAL_V04_CASE_EXECUTED_PASS')
        self.assertEqual(second['simulator_diagnostic_exceptions'],
            [{'command':'simulator-final-screenshot','error_type':'TimeoutExpired'}])
        self.assertFalse(second['acceptance_granted'])

    def test_primary_selected_failure_remains_primary_and_retains_second_case_results(self):
        runner,events=self.exercise_normal(True)
        self.assertIn(('02','simulator-shutdown'),events)
        self.assertIn(('02','retain-results'),events)
        self.assertNotIn(('03','prepare'),events)
        second=json.loads((runner.output/'ordinary-v04/02/execution.json').read_text())
        self.assertEqual(second['failure']['detail'],'REQUIRED_SELECTED_UI_FAILURE')
        self.assertEqual(second['status'],'PARTIAL_BLOCKED')
        self.assertNotIn('normal-staging-ui',runner.receipt['stages'])

    def test_final_collector_keeps_independent_observations_shutdown_and_results(self):
        runner=n.Runner(self.root,self.root/'collection')
        runner.receipt['simulator']={'udid':'00000000-0000-4000-8000-000000000001'}
        events=[]
        def fail(child,name,argv,**kwargs):
            events.append(name)
            raise subprocess.TimeoutExpired('SYNTHETIC_OPTIONAL_OBSERVATION',kwargs['timeout'])
        with patch.object(n.Runner,'run',fail),patch.object(n,'retain_result_bundles',
                side_effect=lambda child:events.append('retain-results')):
            n.collect(runner)
        self.assertEqual(events,['simulator-diagnostics','simulator-final-devices',
            'simulator-final-screenshot','simulator-shutdown','retain-results'])
        self.assertEqual(len(runner.receipt['simulator_diagnostic_exceptions']),4)
        self.assertTrue(runner.receipt['artifact_policy']['upload_within_limit'])
        self.assertEqual(runner.receipt['stages'],{})
        self.assertFalse(runner.receipt['acceptance_granted'])



class LocalSource05ProfileTests(unittest.TestCase):
    """Synthetic producer/control fixtures only; no actual source/native/app result."""
    def fixture(self):
        old=OrdinaryRelease05BuildTests();f,output,receipt,_=old.fixture();self.addCleanup(old.doCleanups)
        receipt.pop('authenticated_source_controls04');receipt.pop('imported_provenance')
        receipt.update(local_source05=dict(n.LOCAL_SOURCE05),stage_complete=True,acceptance_granted=False,
            campaign_candidate_complete=False,release='NO_GO',upstream_payload_bytes=0,
            job_context={'repository':n.STAGE_REPOSITORY,'run_id':61,'run_attempt':1,'job_name':'C47 build','job_id':'native-build'})
        f.runner.receipt.update(local_source05=dict(n.LOCAL_SOURCE05),job_context=dict(receipt['job_context']))
        for name in ('source-before.json','source-after-local-controls05.json'):(output/name).write_text(json.dumps(f.source))
        existing={r['name'] for r in receipt['commands']}
        for row in f.commands:
            if row['name'] in existing:continue
            row=copy.deepcopy(row)
            for stream in ('stdout','stderr'):
                raw=(f.output/row[stream]).read_bytes();path=output/'logs'/('local-'+row['name']+'.'+stream);path.write_bytes(raw)
                row.update({stream:path.relative_to(output).as_posix(),stream+'_bytes':len(raw),stream+'_sha256':n.sha(path)})
            receipt['commands'].append(row)
        producer=dict(f.provenance['producer'],producer_job_name='C47 build',run_id=61,producer_run_attempt=1)
        provenance={'payload_directory':str(output),'producer':producer}
        receipt['local_controls05']=n.verify_local_source05_controls(f.runner,receipt,output)
        def verify(enabled=True,source=None):
            (output/'execution.json').write_text(json.dumps(receipt))
            return n.verify_build_producer(f.runner,provenance,source,local_source05=enabled)
        return f,output,receipt,provenance,verify

    def test_explicit_profile_keeps_default_dependencies_and_modes(self):
        self.assertEqual(n.STAGE_DEPENDENCIES['normal'],('source','build'))
        for role,parents in [('build',()),('normal',('build',)),('internal',('build','normal'))]:
            self.assertEqual(n.stage_dependencies(role,{k:{} for k in parents},local_source05=True),parents)
            self.assertEqual(n.execution_mode(role,ordinary_release05=role=='build',local_source05=True),'local-source05')
        for role,flags in [('source',{}),('build',{}),('normal',{'ordinary_release05':True})]:
            with self.subTest(role=role),self.assertRaises(ValueError):n.execution_mode(role,local_source05=True,**flags)
        with self.assertRaisesRegex(ValueError,'EXCLUSIVE'):
            n.execution_mode('build',ordinary_release05=True,local_source05=True,consent_trace04=True)
        with self.assertRaisesRegex(ValueError,'STAGE_DEPENDENCIES'):
            n.stage_dependencies('normal',{'source':{},'build':{}},local_source05=True)

    def test_new_profile_uses_own_prepare_controls_and_old_ordinary_still_requires_source(self):
        runner=SimpleNamespace(receipt={'local_source05':dict(n.LOCAL_SOURCE05)})
        with patch.object(n,'prepare',side_effect=ValueError('STOP_BEFORE_NATIVE')) as prepare:
            with self.assertRaisesRegex(ValueError,'STOP_BEFORE_NATIVE'):
                n.execute(runner,compile_only=True,ordinary_release05=True,local_source05=True)
        prepare.assert_called_once_with(runner,source_controls=True)
        with patch.object(n,'prepare') as prepare:
            with self.assertRaisesRegex(ValueError,'AUTHENTICATED_SOURCE_BUILD_ONLY'):
                n.execute(runner,compile_only=True,ordinary_release05=True)
        prepare.assert_not_called()

    def test_full_local_thirty_and_sixty_events_qualify_only_new_build_profile(self):
        f,output,receipt,provenance,verify=self.fixture();result=verify()
        self.assertEqual(result.local_source05_proof['case_events'],60)
        self.assertTrue(result.local_source05_proof['source_controls_performed_in_build_job'])
        self.assertFalse(result.local_source05_proof['ordinary_admitted'])
        self.assertNotIn('app-process-keychain',result.receipt['stages'])
        with self.assertRaisesRegex(ValueError,'EXPLICIT_CONSUMER'):verify(False)
        with self.assertRaisesRegex(ValueError,'NO_SOURCE_SUBSTITUTION'):verify(source=f.provenance)

    def test_missing_partial_failed_or_mismatched_profile_never_becomes_local_build(self):
        f,output,receipt,provenance,verify=self.fixture();original=copy.deepcopy(receipt)
        for mutate in [lambda x:x.pop('local_source05'),lambda x:x['local_source05'].update(ordinary_admitted=0),
            lambda x:x['local_source05'].update(profile='historical'),lambda x:x.update(stage_complete=False),
            lambda x:x.update(failure={'type':'ValueError'}),lambda x:x.update(authenticated_source_controls04={'claimed':True}),
            lambda x:x.update(imported_provenance={'source':f.provenance}),lambda x:x.update(upstream_payload_bytes=False),
            lambda x:x['commands'].__setitem__(slice(None),[r for r in x['commands'] if r['name']!='generated47-controls']),
            lambda x:next(r for r in x['commands'] if r['name']=='generated47-controls').update(capture_complete=False),
            lambda x:next(r for r in x['commands'] if r['name']=='generated47-controls').update(state='FAIL',exit_code=124)]:
            receipt.clear();receipt.update(copy.deepcopy(original));mutate(receipt)
            with self.subTest(mutate=mutate),self.assertRaises(ValueError):verify()

    def test_truncated_wrong_tap_or_missing_event_reject_even_with_rehashed_stream(self):
        f,output,receipt,provenance,verify=self.fixture();row=next(r for r in receipt['commands'] if r['name']=='generated47-controls');path=output/row['stdout'];before=path.read_bytes()
        changes=[before.replace(b'# pass 30',b'# pass 29'),b'\n'.join(before.splitlines()[:-1])+b'\n',before.replace(b'"event":"C47_SOURCE_CASE_END"',b'"event":"C47_SOURCE_CASE_BEGIN"',1)]
        for raw in changes:
            path.write_bytes(raw);row.update(stdout_bytes=len(raw),stdout_sha256=n.sha(path))
            with self.assertRaises(ValueError):verify()

    def test_source_context_toolchain_and_final_source_drift_remain_closed(self):
        f,output,receipt,provenance,verify=self.fixture();original=copy.deepcopy(receipt);producer=copy.deepcopy(provenance)
        for mutate in [lambda x:x['job_context'].update(run_id=62),lambda x:x['job_context'].update(run_attempt=2),lambda x:x['job_context'].update(run_id=True),lambda x:x.update(source=dict(f.source,head='e'*40))]:
            receipt.clear();receipt.update(copy.deepcopy(original));mutate(receipt)
            with self.assertRaises(ValueError):verify()
        receipt.clear();receipt.update(copy.deepcopy(original))
        for key,value in [('producer_run_attempt',2),('source_head','e'*40),('producer_job_name','C47 source')]:
            provenance.clear();provenance.update(copy.deepcopy(producer));provenance['producer'][key]=value
            with self.assertRaises(ValueError):verify()
        provenance.clear();provenance.update(copy.deepcopy(producer))
        (output/'source-after-local-controls05.json').write_text(json.dumps(dict(f.source,tree='e'*40)))
        with self.assertRaisesRegex(ValueError,'UNPROJECTED_CONTROLS_SOURCE'):verify()

    def test_local_imports_use_only_exact_build_then_build_normal_roles(self):
        from unittest.mock import Mock
        for role,parents in [('normal',('build',)),('internal',('build','normal'))]:
            context={'runner_temp':tempfile.gettempdir()};runner=SimpleNamespace(receipt={},persist=Mock())
            imports={parent:{'producer':{'artifact_id':i+1},'payload_bytes':5} for i,parent in enumerate(parents)}
            with patch.object(n,'load_authenticated_stage_inputs',return_value={'imported_provenance':imports}) as load:
                actual=n.stage_imports(runner,role,context,'TOKEN',local_source05=True)
            self.assertEqual(set(load.call_args.args[1]),set(parents));self.assertEqual(load.call_args.kwargs,{'local_source05':True})
            self.assertNotIn('source',actual);self.assertEqual(runner.receipt['upstream_payload_bytes'],5*len(parents))

    def test_local_normal_profile_and_old_source_substitution_refuse_before_suite_gate(self):
        f,output,receipt,provenance,verify=self.fixture()
        normal=dict(receipt,stage='normal',imported_provenance={'source':f.provenance,'build':provenance})
        (output/'execution.json').write_text(json.dumps(normal))
        with patch.object(n,'producer_source_matches'):
            with self.assertRaisesRegex(ValueError,'NORMAL_BUILD_ONLY'):
                n.verify_normal_producer(f.runner,provenance,provenance,local_source05=True)
        normal.pop('local_source05');(output/'execution.json').write_text(json.dumps(normal))
        with patch.object(n,'producer_source_matches'):
            with self.assertRaisesRegex(ValueError,'EXACT_PROFILE'):
                n.verify_normal_producer(f.runner,provenance,provenance,local_source05=True)



class LocalSource05PrebuildProofTests(unittest.TestCase):
    fixture = LocalSource05ProfileTests.fixture
    """Additional precompile sequencing controls; inherited fixtures are synthetic."""
    def test_missing_or_exit0_incomplete_controls_refuse_before_any_prebuild_command(self):
        from unittest.mock import Mock
        for kind in ('missing','partial-tap','missing-event'):
            f,output,receipt,provenance,verify=self.fixture()
            if kind=='missing':receipt['commands']=[r for r in receipt['commands'] if r['name']!='generated47-controls']
            else:
                row=next(r for r in receipt['commands'] if r['name']=='generated47-controls');path=output/row['stdout'];raw=path.read_bytes()
                raw=raw.replace(b'# pass 30',b'# pass 29') if kind=='partial-tap' else b'\n'.join(raw.splitlines()[:-1])+b'\n'
                path.write_bytes(raw);row.update(stdout_bytes=len(raw),stdout_sha256=n.sha(path))
            runner=SimpleNamespace(root=f.root,output=output,receipt=receipt,source_proof=Mock(),persist=Mock(),run=Mock())
            with patch.object(n,'prepare',return_value=(f.source['head'],{},output/'current-generated47-source.json')):
                with self.subTest(kind=kind),self.assertRaises(ValueError):
                    n.execute(runner,compile_only=True,ordinary_release05=True,local_source05=True)
            runner.run.assert_not_called()

    def test_computed_proof_is_persisted_before_first_generation_command(self):
        from unittest.mock import Mock
        f,output,receipt,provenance,verify=self.fixture();receipt.pop('local_controls05')
        runner=SimpleNamespace(root=f.root,output=output,receipt=receipt,source_proof=Mock(),persist=Mock(),run=Mock(side_effect=ValueError('STOP_FIRST_PREBUILD_COMMAND')))
        with patch.object(n,'prepare',return_value=(f.source['head'],{},output/'current-generated47-source.json')):
            with self.assertRaisesRegex(ValueError,'STOP_FIRST_PREBUILD_COMMAND'):
                n.execute(runner,compile_only=True,ordinary_release05=True,local_source05=True)
        self.assertEqual(runner.run.call_args.args[0],'resolved-expo-config')
        self.assertEqual(receipt['local_controls05'],n.verify_local_source05_controls(runner,receipt,output))
        self.assertEqual(receipt['local_controls05']['case_events'],60)

    def test_consumer_recomputes_raw_controls_and_refuses_changed_or_missing_stored_proof(self):
        f,output,receipt,provenance,verify=self.fixture();original=copy.deepcopy(receipt['local_controls05'])
        for value in (None,dict(original,case_events=59),dict(original,source_controls_performed_in_build_job=1),dict(original,extra=True)):
            receipt['local_controls05']=value
            with self.subTest(value=value),self.assertRaisesRegex(ValueError,'EXACT_PREBUILD_CONTROL_PROOF'):verify()


    def test_stored_control_profile_boolean_types_cannot_be_numeric_lookalikes(self):
        for key,value in [('new_current_source_build',1),('ordinary_admitted',0)]:
            f,output,receipt,provenance,verify=self.fixture()
            receipt['local_controls05']['profile'][key]=value
            with self.subTest(key=key),self.assertRaisesRegex(ValueError,'LOCAL_SOURCE05_EXACT_PROFILE'):verify()


class Observation06Tests(unittest.TestCase):
    def pair(self):
        root=Path(__file__).resolve().parents[3];origin='9269c1d2e7dc87bcb8c6578503e84f71e53fc638'
        paths=['scripts/release/full-app-j01/native_runtime47.py','docs/phase-9/ios-generated-input-succession47.v1.json','scripts/release/full-app-j01/native_ui47.swift']
        args=[]
        for p in paths:args.extend((subprocess.check_output(['git','show',origin+':'+p],cwd=root),(root/p).read_bytes()))
        return root,paths[:2],args

    def test_actual_finite_harness_delta_preserves_every_product_and_old_reader(self):
        root,paths,args=self.pair();n.verify_reuse56_delta(paths,*args)

    def test_product_and_dependency_paths_are_rejected(self):
        _,paths,args=self.pair()
        for p in ('apps/mobile/src/lib/storage/privateKV.ts','package-lock.json','apps/mobile/app.config.ts','scripts/release/full-app-j01/native_ui47.swift','scripts/release/full-app-j01/simulator_signing47.py'):
            with self.subTest(p=p),self.assertRaisesRegex(ValueError,'FINITE_NON_PRODUCT_DELTA'):n.verify_reuse56_delta(paths+[p],*args)

    def test_changed_old_source_or_signature_readers_and_build_are_rejected(self):
        _,paths,args=self.pair()
        for target in ('def verify_stage_zip(', 'def verify_build_producer(', 'def execute(', 'def verify_installed_app('):
            mutated=list(args);mutated[1]=mutated[1].replace(target.encode(),target.replace('def ','def changed_').encode(),1)
            with self.subTest(target=target),self.assertRaisesRegex(ValueError,'PROTECTED_BUILD'):n.verify_reuse56_delta(paths,*mutated)

    def test_ordinary_assertion_or_importer_edits_are_rejected(self):
        _,paths,args=self.pair()
        for old,new in ((b"require(aggregate['failed'] == 0",b"require(aggregate['failed'] >= 0"),(b"'IMPORTED_APP_ARCHIVE_HASH'",b"'OTHER_ARCHIVE_HASH'")):
            mutated=list(args);self.assertIn(old,mutated[1]);mutated[1]=mutated[1].replace(old,new)
            with self.subTest(old=old),self.assertRaisesRegex(ValueError,'REUSE56_WHOLE_'):n.verify_reuse56_delta(paths,*mutated)

    def test_generated_pin_or_swift_assertion_drift_is_rejected(self):
        _,paths,args=self.pair();mutated=list(args);d=json.loads(mutated[3]);pin=next(p for p in d['sourcePins']if p['path']not in paths[:1]and not p['path'].endswith('native_runtime47.test.py'));pin['sha256']='0'*64;mutated[3]=json.dumps(d).encode()
        with self.assertRaisesRegex(ValueError,'ALL_PRODUCT_NATIVE'):n.verify_reuse56_delta(paths,*mutated)
        mutated=list(args);mutated[5]+=b'\n'
        with self.assertRaisesRegex(ValueError,'WHOLE_CURRENT_SWIFT'):n.verify_reuse56_delta(paths,*mutated)

    def test_native_frame_parser_discards_values_addresses_other_threads_and_paths(self):
        raw=b'Private exception token=secret DOB=1990\n  200 Thread_321: com.apple.main-thread (serial)\n    200 start (in libdyld.dylib) [0x123]\n    + 200 UIApplicationMain (in UIKitCore) + 2 [0x123]\n    + ! 200 __ulock_wait2 (in libsystem_kernel.dylib) + 3 [0xabc]\n    + 200 private_secret_patient (in LayerwellStaging) [0xdead]\n  200 Thread_322: com.facebook.react.JavaScript\n    + 200 SECRET_VALUE (in UIKitCore) [0xbeef]\n'
        frames=n.native_frames06(raw);self.assertEqual([f['symbol']for f in frames],['UIApplicationMain','__ulock_wait2']);self.assertNotIn('secret',json.dumps(frames));self.assertNotIn('0x',json.dumps(frames))
        with self.assertRaisesRegex(ValueError,'SAMPLE_BOUND'):n.native_frames06(b'x'*(4*n.MIB+1))

    def test_disabled_observer_cannot_spawn_or_write(self):
        with patch.object(n.subprocess,'run')as run,patch.object(n,'write_json')as write:
            with n.observe_ui06(None,None,enabled=False):pass
            run.assert_not_called();write.assert_not_called()



class LiveStream06Tests(unittest.TestCase):
    def test_owned_stream_append_does_not_disable_observation_and_still_bounds_reads(self):
        import os
        with tempfile.TemporaryDirectory()as directory:
            path=Path(directory)/'owned.stdout';path.write_bytes(b'BEGIN\n');original=os.read
            def grow(descriptor,size):
                with path.open('ab')as out:out.write(b'Tap "DD" TextField\n')
                return original(descriptor,size)
            with patch.object(n.os,'read',side_effect=grow):self.assertIn(b'Tap "DD" TextField',n.read_live_ui06(path))
            path.write_bytes(b'x'*(10*n.MIB+1))
            with self.assertRaisesRegex(ValueError,'LIVE_LOG_BOUND'):n.read_live_ui06(path)
            path.write_bytes(b'x')
            with patch.object(n.os,'open',side_effect=OSError('controlled-no-follow-refusal')):
                with self.assertRaises(OSError):n.read_live_ui06(path)


if __name__ == '__main__':
    unittest.main()
