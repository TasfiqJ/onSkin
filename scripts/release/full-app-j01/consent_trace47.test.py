"""C04 observation controls; these do not qualify native runtime."""
import importlib.util
import json
from pathlib import Path
import plistlib
import subprocess
import tempfile
from types import SimpleNamespace
import unittest

spec = importlib.util.spec_from_file_location('consent_trace47', Path(__file__).with_name('consent_trace47.py'))
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)
ROOT = Path(__file__).resolve().parents[3]


def historical_source():
    return subprocess.check_output(['git', '--no-replace-objects', 'show',
        'f21831f5731be928c8e323c509fb62b3d12a654e:' + c.SOURCE], cwd=ROOT)


class ConsentTrace47Tests(unittest.TestCase):
    def trace(self):
        return {'schema':1, 'marker':c.MARKER, 'head':'a' * 40,
            'bundle':'com.layerwell.app.staging', 'pid':123, 'overflow':False,
            'events':[{'operation':'lifecycle-published', 'sequence':1, 'ageStatus':'current',
                'backendConfigured':False, 'state':'verification_required', 'reason':'authoritative_unconsented',
                'resumeState':None, 'cleanupComplete':True, 'epochZero':True, 'leasePresent':False,
                'leaseOwnerMatches':None, 'leaseEpochMatches':None, 'errorClass':None, 'errorCode':None}]}

    def validate(self, value):
        return c.validate_trace(json.dumps(value).encode(), 'a' * 40, 'com.layerwell.app.staging', 123)

    def test_actual_f218_transform_is_exact_and_diagnostic_only(self):
        original = historical_source()
        generated = c.transformed_source(original)
        self.assertEqual(c.digest(original), c.SOURCE_SHA)
        self.assertEqual(generated, c.transformed_source(original))
        self.assertIn(b"c47Trace04('initial-unconsented-cleanup-start', previous);", generated)
        self.assertIn(b"c47Trace04('initial-consent-cleanup-error', paused, error);", generated)
        self.assertEqual(generated.count(b'await '), original.count(b'await '))
        self.assertEqual(generated.count(b'writeLocal('), original.count(b'writeLocal('))
        self.assertEqual(generated.count(b'clearHealthPurposeLocalDataForFence('), original.count(b'clearHealthPurposeLocalDataForFence('))
        with self.assertRaisesRegex(ValueError, 'EXACT_F218'):
            c.transformed_source(original + b'\n')

    def test_closed_schema_accepts_only_content_free_enum_and_boolean_data(self):
        self.assertEqual(self.validate(self.trace())['events'][0]['reason'], 'authoritative_unconsented')
        for key, value in [('ownerUserId','secret-owner'), ('birthDate','1990-01-01'),
                           ('processingEpoch',42), ('message','private text'), ('rawRecord',{})]:
            wrong = self.trace()
            wrong['events'][0][key] = value
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, 'EVENT_FIELDS'):
                self.validate(wrong)
        for key, value in [('reason','arbitrary data'), ('cleanupComplete',1), ('errorCode','secret-token')]:
            wrong = self.trace()
            wrong['events'][0][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.validate(wrong)

    def test_pid_source_bound_overflow_duplicate_and_missing_events_refuse(self):
        for key, value in [('pid',124), ('head','b' * 40), ('overflow',True), ('events',[])]:
            wrong = self.trace()
            wrong[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.validate(wrong)
        wrong = self.trace()
        wrong['events'] = wrong['events'] * 257
        with self.assertRaisesRegex(ValueError, 'EVENT_BOUND'):
            self.validate(wrong)
        with self.assertRaisesRegex(ValueError, 'DUPLICATE_KEY'):
            c.validate_trace(b'{"schema":1,"schema":1}', 'a' * 40, 'com.layerwell.app.staging', 123)
        with self.assertRaisesRegex(ValueError, 'FILE_BOUND'):
            c.validate_trace(b' ' * (c.MAX_TRACE + 1), 'a' * 40, 'com.layerwell.app.staging', 123)

    def test_exception_restores_tracked_and_generated_sources_without_admission(self):
        with tempfile.TemporaryDirectory(prefix='c47-trace-') as temporary:
            root = Path(temporary)
            source = root / c.SOURCE
            source.parent.mkdir(parents=True)
            original = historical_source()
            source.write_bytes(original)
            ios = root / 'apps/mobile/ios'
            delegate = ios / 'LayerwellStaging/AppDelegate.swift'
            delegate.parent.mkdir(parents=True)
            delegate_original = b'import Expo\n    let delegate = ReactNativeDelegate()\n'
            delegate.write_bytes(delegate_original)
            evidence = root / 'evidence'
            with self.assertRaisesRegex(RuntimeError, 'actual build failure'):
                with c.diagnostic_inputs(root, ios, evidence, 'a' * 40) as entry:
                    self.assertNotEqual(source.read_bytes(), original)
                    self.assertTrue(entry.is_file())
                    self.assertFalse(json.loads((evidence / 'TRANSFORM.json').read_bytes())['ordinary_admitted'])
                    raise RuntimeError('actual build failure')
            self.assertEqual(source.read_bytes(), original)
            self.assertEqual(delegate.read_bytes(), delegate_original)
            self.assertFalse((root / 'apps/mobile/.expo/C47ConsentDiagnostic04.js').exists())
            restored = json.loads((evidence / 'RESTORED.json').read_bytes())
            self.assertTrue(restored['exact_restore'])
            self.assertFalse(restored['ordinary_admitted'])

    def test_observers_register_before_mount_and_never_invoke_authority(self):
        self.assertLess(c.ENTRY.index('subscribeToHealthDataLifecycle(record'), c.ENTRY.index("require('expo-router/entry')"))
        for forbidden in ['setAgeVerified(', 'setActiveHealthProcessingEpoch(', 'writeHealthDataLifecycle(',
                          'grantAuthoritativeHealthDataConsent(', 'deleteItemAsync(', 'setItemAsync(']:
            self.assertNotIn(forbidden, c.ENTRY)
            self.assertNotIn(forbidden, c.TS_OBSERVER)

    def test_diagnostic_install_uses_own_inventory_without_any_ordinary_stage(self):
        with tempfile.TemporaryDirectory(prefix='c47-trace-install-') as temporary:
            root = Path(temporary)
            app, installed = root / 'built.app', root / 'installed.app'
            app.mkdir()
            installed.mkdir()
            info = plistlib.dumps({'CFBundleIdentifier':'com.layerwell.app.staging',
                                   'CFBundleExecutable':'LayerwellStaging'})
            binary = b'actual diagnostic executable'
            for directory in (app, installed):
                (directory / 'Info.plist').write_bytes(info)
                (directory / 'LayerwellStaging').write_bytes(binary)
            source = {'head':'a' * 40, 'tree':'b' * 40}
            identity = {'bytes':len(binary), 'sha256':c.digest(binary)}
            inventory = root / 'inventory.json'
            c.document(inventory, {'source':source, 'lane':'SEPARATE_RELEASE_CONSENT_DIAGNOSTIC_04',
                'product':{'bundle':'com.layerwell.app.staging','executable':'LayerwellStaging'},
                'files':[{'path':'LayerwellStaging','type':'file', **identity}]})
            receipt = {'source':source, 'stages':{}}
            runner = SimpleNamespace(receipt=receipt,
                passed=lambda name, detail: receipt['stages'].update({name:{'status':'PASS','details':detail}}))
            native = SimpleNamespace(read_native_file=lambda path:path.read_bytes(), MAX_APP=1000,
                app_executable_identity=lambda files, name:{key:files[0][key] for key in ('bytes','sha256')},
                stage_file_digest=lambda path, maximum:{'bytes':len(path.read_bytes()), 'sha256':c.digest(path.read_bytes())})
            detail = c.verify_diagnostic_install(runner, native, installed, app,
                                                'com.layerwell.app.staging', inventory)
            self.assertEqual(detail['installed_executable'], identity)
            self.assertEqual(set(receipt['stages']), {'consent-diagnostic-installed'})
            self.assertFalse(detail['ordinary_admitted'])
            (installed / 'LayerwellStaging').write_bytes(b'wrong installed product')
            with self.assertRaisesRegex(ValueError, 'INSTALLED_DIAGNOSTIC_BYTES'):
                c.verify_diagnostic_install(runner, native, installed, app,
                                            'com.layerwell.app.staging', inventory)


if __name__ == '__main__':
    unittest.main()
