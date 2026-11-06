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
        for code in ['HEALTH_PURPOSE_LOCAL_CLEAR_FAILED', 'HEALTH_PURPOSE_LOCAL_CLEAR_OWNER_INVALID',
                     'HEALTH_PURPOSE_LOCAL_CLEAR_OWNER_MISMATCH']:
            actual = self.trace()
            actual['events'][0].update(errorClass='Error', errorCode=code)
            self.assertEqual(self.validate(actual)['events'][0]['errorCode'], code)
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
        for key, value in [('schema',True), ('pid',124), ('head','b' * 40), ('overflow',True), ('events',[])]:
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
        self.assertNotIn('getAgePolicyReceiptStatus', c.ENTRY)
        self.assertNotIn('getPrivateItem(', c.ENTRY)
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



class RetainedDiagnostic27Tests(unittest.TestCase):
    def metadata(self):
        p = c.RETAINED27
        run = {'id':p['run_id'],'run_attempt':1,'head_sha':p['head'],'head_branch':'stage/m1-native-runtime47',
            'event':'pull_request','path':'.github/workflows/campaign47-native-runtime.yml',
            'status':'completed','conclusion':'failure','repository':{'full_name':'TasfiqJ/onSkin','private':False},
            'head_repository':{'full_name':'TasfiqJ/onSkin'}}
        job = {'id':p['job_id'],'run_id':p['run_id'],'run_attempt':1,'head_sha':p['head'],
            'name':'C47 build','status':'completed','conclusion':'failure','labels':['macos-26-intel']}
        artifact = {'id':p['artifact_id'],
            'name':'campaign47-native-build-' + p['head'] + '-' + str(p['run_id']) + '-1',
            'expired':False,'size_in_bytes':p['wire_bytes'],'digest':'sha256:' + p['digest'],
            'workflow_run':{'id':p['run_id'],'head_sha':p['head'],'head_branch':'stage/m1-native-runtime47'}}
        return run,job,artifact

    def test_pinned_partial_producer_metadata_refuses_wrong_job_head_digest_expiry_and_types(self):
        run,job,artifact = self.metadata()
        self.assertEqual(c.retained27_metadata(run,job,artifact)['wire_bytes'],85192778)
        for index,key,value in [(0,'head_sha','0'*40),(0,'run_attempt',True),(1,'id',1),
                                (1,'conclusion','success'),(1,'labels',['larger-paid-runner']),
                                (2,'digest','sha256:'+'0'*64),(2,'expired',True),(2,'size_in_bytes',1)]:
            rows = [dict(row) for row in self.metadata()]
            rows[index][key] = value
            with self.subTest(key=key,value=value),self.assertRaisesRegex(ValueError,'RETAINED27_'):
                c.retained27_metadata(*rows)

    def test_historical_source_and_current_consumer_are_separate_and_never_admit(self):
        producer = {'head':c.RETAINED27['head'],'tree':c.RETAINED27['tree']}
        consumer = {'head':'a'*40,'tree':'b'*40}
        result = c.retained27_sources(consumer,producer)
        self.assertEqual(result['producer_source'],producer)
        self.assertEqual(result['consumer_source'],consumer)
        self.assertFalse(result['ordinary_admitted'])
        self.assertFalse(result['internal_admitted'])
        with self.assertRaisesRegex(ValueError,'PRODUCER_SOURCE'):
            c.retained27_sources(consumer,{**producer,'tree':'0'*40})
        with self.assertRaisesRegex(ValueError,'DISTINCT_CONSUMER'):
            c.retained27_sources(producer,producer)

    def test_wrong_wire_and_wrong_closed_product_inventory_are_not_imported(self):
        with tempfile.TemporaryDirectory(prefix='c47-retained27-refuse-') as temporary:
            root = Path(temporary)
            native = SimpleNamespace(STAGE_MAX_WIRE=100000000,
                stage_file_digest=lambda *args:{'bytes':85192778,'sha256':'0'*64})
            with self.assertRaisesRegex(ValueError,'RETAINED27_WIRE'):
                c.retained27_zip(native,root/'wire.zip',root/'payload')
            self.assertFalse((root/'payload').exists())
            native = SimpleNamespace(read_native_file=lambda path:b'{}')
            with self.assertRaisesRegex(ValueError,'APP_INVENTORY_DIGEST'):
                c.retained27_inventory(native,root)

    def test_claimed_ordinary_pass_cannot_enter_the_pinned_partial_diagnostic(self):
        p=c.RETAINED27
        value={'source':{'head':p['head'],'tree':p['tree']},
               'job_context':{'repository':'TasfiqJ/onSkin','run_id':p['run_id'],'run_attempt':1,
                              'job_id':'native-build','job_name':'C47 build'},
               'status':'PARTIAL_BLOCKED','stage':'build','stage_complete':False,
               'ordinary_admitted':True,'internal_supported_owner':'NOT_RUN',
               'acceptance_granted':False,'campaign_candidate_complete':False,'release':'NO_GO',
               'failure':{'detail':'C47_COMMAND_FAILED:simulator-installed-container','type':'ValueError'}}
        native=SimpleNamespace(read_native_file=lambda path:json.dumps(value).encode(),stage_json=json.loads)
        with self.assertRaisesRegex(ValueError,'KNOWN_PARTIAL_ONLY'):
            c.retained27_execution(native,Path('.'))

    def test_retained_install_uses_full_producer_inventory_and_refuses_installed_byte_drift(self):
        with tempfile.TemporaryDirectory(prefix='c47-retained27-installed-') as temporary:
            root=Path(temporary)
            app,installed=root/'app',root/'installed'
            app.mkdir();installed.mkdir()
            for folder in (app,installed):
                (folder/'Info.plist').write_bytes(plistlib.dumps({'CFBundleIdentifier':'com.layerwell.app.staging',
                                                               'CFBundleExecutable':'LayerwellStaging'}))
                (folder/'LayerwellStaging').write_bytes(b'diagnostic')
            def inventory(folder):
                return [{'path':path.name,'type':'file','mode':'0o644','bytes':len(path.read_bytes()),
                         'sha256':c.digest(path.read_bytes())} for path in sorted(folder.iterdir())]
            producer={'head':c.RETAINED27['head'],'tree':c.RETAINED27['tree']}
            manifest={'source':producer,'files':inventory(app)}
            receipt={'source':{'head':'a'*40,'tree':'b'*40},'stages':{}}
            runner=SimpleNamespace(receipt=receipt,passed=lambda key,value:receipt['stages'].update({key:value}))
            native=SimpleNamespace(bundle_inventory=inventory,read_native_file=lambda path:path.read_bytes())
            result=c.retained27_installed(runner,native,installed,app,manifest)
            self.assertFalse(result['ordinary_admitted'])
            self.assertEqual(receipt['source']['head'],'a'*40)
            (installed/'LayerwellStaging').write_bytes(b'drift')
            with self.assertRaisesRegex(ValueError,'ALL_INSTALLED_BYTES'):
                c.retained27_installed(runner,native,installed,app,manifest)


if __name__ == '__main__':
    unittest.main()
