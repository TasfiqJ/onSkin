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
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('native_runtime47', Path(__file__).with_name('native_runtime47.py'))
n = importlib.util.module_from_spec(spec)
spec.loader.exec_module(n)


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
        case = n.NORMAL_UI_CASE
        legacy = "Test Case '-[C47NativeUI.C47NativeUI " + case + "]' passed (1.234 seconds).\n"
        modern = "Test case 'C47NativeUI." + case + "()' passed on 'actual controlled Simulator' (1.234 seconds).\n"
        summary = 'Executed 1 test, with 0 failures (0 unexpected) in 1.234 seconds\n'
        for events in [legacy, modern, legacy + modern]:
            proof = n.normal_xctest_summary(events + summary)
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
                n.normal_xctest_summary(invalid)
        with self.assertRaisesRegex(ValueError, 'ACTUAL_COMMAND_REQUIRED'):
            n.execute_internal(SimpleNamespace(receipt={'stages': {'normal-staging-ui': {'status': 'PASS'}},
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
        source = Path(__file__).with_name('native_ui47.swift').read_bytes()
        prefix = source[:8736]
        self.assertEqual(hashlib.sha256(prefix).hexdigest(),
                         'b57511fd34c67d0a39e9acb712d86d6ea19d90213b468bce7c1a528612487c44')
        self.assertIn(b'final class C47NativeUI', prefix)
        self.assertNotIn(b'final class C47InternalOwnerUI', prefix)
        self.assertIn(b'final class C47InternalOwnerUI', source[8736:])

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
        (producer / 'unsigned-simulator-app.tar.gz').write_bytes(valid)
        inventory = {'source': {'head': head, 'tree': tree}, 'lane': 'normal-staging',
                     'configuration': 'Release', 'files': rows}
        inventory_raw = json.dumps(inventory).encode()
        (producer / 'app-inventory.json').write_bytes(inventory_raw)
        receipt = {'file': 'unsigned-simulator-app.tar.gz', 'bytes': len(valid),
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
        self.assertEqual(n.stage_dependencies('normal', {'build': {}}), ('build',))
        self.assertEqual(n.stage_dependencies('internal', {'build': {}, 'normal': {}}), ('build', 'normal'))
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
                with self.subTest(output=output.name), self.assertRaises(ValueError):
                    n.load_authenticated_stage_inputs('normal', {'build': {}}, context, 'unused', output)
            with self.assertRaises(ValueError):
                n.load_authenticated_stage_inputs('build', {}, context, 'unused', self.root / 'new')
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

    def test_mismatched_device_is_rejected_before_install(self):
        self.ready()
        with self.assertRaises(ValueError):
            n.install_simulator_app(self.r, '11111111-1111-4111-8111-111111111111', 'Authenticated.app', SIM_UNIT_BUNDLE)
        self.assertNotIn('simulator-install', self.names())




class StageDriver47Tests(unittest.TestCase):
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
            app, installed, output = root / 'expected.app', root / 'installed.app', root / 'evidence'
            for directory in (app, installed, output):
                directory.mkdir()
            binary = b'fixture original executable'
            info = plistlib.dumps({'CFBundleIdentifier': 'com.layerwell.app.staging',
                                   'CFBundleExecutable': 'LayerwellStaging'})
            for directory in (app, installed):
                (directory / 'Info.plist').write_bytes(info)
                (directory / 'LayerwellStaging').write_bytes(binary)
            identity = {'bytes': len(binary), 'sha256': hashlib.sha256(binary).hexdigest()}
            inventory = {'files': [{'path': 'LayerwellStaging', 'type': 'file', **identity}]}
            n.write_json(output / 'app-inventory.json', inventory)
            inventory_sha = n.sha(output / 'app-inventory.json')
            base = {'source': {'head': 'a' * 40}, 'simulator': {'udid': 'current-device'}, 'stages': {}}
            compiled = {'bundle_id': 'com.layerwell.app.staging', 'executable': 'LayerwellStaging',
                        'inventory_sha256': inventory_sha}
            imported = {'bundle_id': compiled['bundle_id'], 'executable': compiled['executable'],
                        'authenticated_executable': identity, 'producer_app_inventory_sha256': inventory_sha}
            for lane, details in [('compiled', compiled), ('verified-produced-app', imported)]:
                receipt = copy.deepcopy(base)
                receipt['stages'][lane] = {'status': 'PASS', 'details': details}
                passed = []
                runner = SimpleNamespace(receipt=receipt, output=output,
                                         passed=lambda name, proof: passed.append((name, proof)))
                with patch.object(n, 'read_native_file', side_effect=lambda path: Path(path).read_bytes()):
                    n.verify_installed_app(runner, installed, app, compiled['bundle_id'])
                    self.assertEqual(passed[0][1]['authenticated_inventory_sha256'], inventory_sha)
                    for directory in (app, installed):
                        (directory / 'LayerwellStaging').write_bytes(b'changed matching executable')
                    with self.assertRaisesRegex(ValueError, 'INSTALLED_EXECUTABLE_BYTES'):
                        n.verify_installed_app(runner, installed, app, compiled['bundle_id'])
                    self.assertEqual(len(passed), 1)
                for directory in (app, installed):
                    (directory / 'LayerwellStaging').write_bytes(binary)

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


if __name__ == '__main__':
    unittest.main()
