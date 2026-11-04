"""Local fail-closed orchestration checks; these do not execute or qualify iOS."""
import importlib.util
import json
from types import SimpleNamespace
import time
import hashlib
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



if __name__ == '__main__':
    unittest.main()
