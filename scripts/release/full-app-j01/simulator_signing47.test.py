"""Simulator signing boundaries and real-operation receipt refusals, no Mac needed."""
import copy
import importlib.util
from pathlib import Path
import plistlib
import struct
import tempfile
import os
from types import SimpleNamespace
import unittest

spec=importlib.util.spec_from_file_location('signing47',Path(__file__).with_name('simulator_signing47.py'))
s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)

class SimulatorSigning47(unittest.TestCase):
    def test_simulator_exact_app_owned_identity_and_no_developer_identity(self):
        for bundle,target in s.PRODUCTS.items():
            flags=s.signing_flags('iphonesimulator',bundle,target,Path.cwd()/'generated.entitlements')
            self.assertIn('CODE_SIGN_IDENTITY=-',flags)
            self.assertIn('DEVELOPMENT_TEAM=',flags)
            self.assertIn('PROVISIONING_PROFILE_SPECIFIER=',flags)
            self.assertEqual(s.app_entitlements(bundle),{'application-identifier':s.PREFIX+bundle})

    def test_device_unknown_product_foreign_target_and_unscoped_paths_refuse(self):
        for sdk,bundle,target,path in [('iphoneos',s.PROBE_BUNDLE,'C47KeychainProbe',Path.cwd()/'a.entitlements'),
            ('macosx',s.PROBE_BUNDLE,'C47KeychainProbe',Path.cwd()/'a.entitlements'),
            ('iphonesimulator','com.other.app','Other',Path.cwd()/'a.entitlements'),
            ('iphonesimulator',s.PROBE_BUNDLE,'LayerwellStaging',Path.cwd()/'a.entitlements'),
            ('iphonesimulator',s.PROBE_BUNDLE,'C47KeychainProbe',Path('relative.entitlements'))]:
            with self.subTest(sdk=sdk,bundle=bundle,target=target,path=str(path)),self.assertRaises(ValueError):
                s.signing_flags(sdk,bundle,target,path)

    def test_effective_settings_reject_device_account_certificate_and_profile_leakage(self):
        settings={'PLATFORM_NAME':'iphonesimulator','PRODUCT_BUNDLE_IDENTIFIER':s.PROBE_BUNDLE,
                  'CODE_SIGNING_ALLOWED':'YES','CODE_SIGN_IDENTITY':'-','DEVELOPMENT_TEAM':''}
        doc=[{'target':'C47KeychainProbe','buildSettings':settings}]
        s.validate_build_settings(doc,s.PROBE_BUNDLE,'C47KeychainProbe')
        for key,value in [('PLATFORM_NAME','iphoneos'),('PRODUCT_BUNDLE_IDENTIFIER','com.other.app'),
            ('CODE_SIGNING_ALLOWED','NO'),('CODE_SIGN_IDENTITY','Apple Distribution'),
            ('DEVELOPMENT_TEAM','REALTEAM00'),('PROVISIONING_PROFILE','some-profile'),
            ('PROVISIONING_PROFILE_SPECIFIER','some-profile')]:
            wrong=copy.deepcopy(doc);wrong[0]['buildSettings'][key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):
                s.validate_build_settings(wrong,s.PROBE_BUNDLE,'C47KeychainProbe')
        with self.assertRaises(ValueError):s.validate_build_settings(doc+doc,s.PROBE_BUNDLE,'C47KeychainProbe')

    def test_wildcard_foreign_sharing_team_push_and_security_entitlements_refuse(self):
        bundle=s.PROBE_BUNDLE; valid=s.app_entitlements(bundle)
        s.validate_entitlements(valid,bundle)
        s.validate_entitlements({**valid,'keychain-access-groups':[s.PREFIX+bundle]},bundle)
        for patch in [{'application-identifier':'OTHER.'+bundle}, {'keychain-access-groups':['*']},
            {'keychain-access-groups':[s.PREFIX+bundle,'other.app']},
            {'com.apple.developer.team-identifier':'C47SIMTEST'}, {'aps-environment':'development'},
            {'com.apple.security.application-groups':['group.other']}, {'get-task-allow':'true'}]:
            with self.subTest(patch=patch),self.assertRaises(ValueError):s.validate_entitlements({**valid,**patch},bundle)

    def result(self,phase):
        rows=[{'operation':name,'status':-25300 if name.startswith('absent') else 0,
               'expected':-25300 if name.startswith('absent') else 0,'passed':True,'matched':True}
              for name in s.PHASE_OPERATIONS[phase]]
        return {'schema':1,'bundle':s.PROBE_BUNDLE,'pid':123,'phase':phase,'operations':rows,'passed':True}

    def test_all_real_operation_phases_and_missing_entitlement_is_never_absence(self):
        for phase in s.PHASE_OPERATIONS:
            valid=self.result(phase);s.validate_probe_result(valid,phase)
            for mutate in [lambda x:x.update(operations=[]),lambda x:x.update(pid=0),
                lambda x:x.update(bundle='com.other.app'),lambda x:x.update(passed=False),
                lambda x:x['operations'][0].update(status=-34018),
                lambda x:x['operations'][0].update(matched=False),
                lambda x:x['operations'][0].update(passed=False)]:
                bad=copy.deepcopy(valid);mutate(bad)
                with self.subTest(phase=phase),self.assertRaises(ValueError):s.validate_probe_result(bad,phase)

    def test_actual_macho_sections_are_parsed_and_not_assumed_from_an_input_plist(self):
        xml=plistlib.dumps(s.app_entitlements(s.PROBE_BUNDLE));length=72+80+16;data_start=32+length
        header=struct.pack('<8I',0xfeedfacf,0x01000007,3,2,2,length,0,0)
        segment=struct.pack('<II16sQQQQIIII',0x19,152,b'__TEXT',0,4096,0,data_start+len(xml),7,5,1,0)
        section=struct.pack('<16s16sQQIIIIIIII',b'__entitlements',b'__TEXT',0,len(xml),data_start,0,0,0,0,0,0,0)
        signature=struct.pack('<4I',0x1d,16,data_start+len(xml),4)
        raw=header+segment+section+signature+xml+b'fake'
        value=s.macho_entitlements(raw)
        self.assertEqual(value['simulated_entitlement_sections'][0]['plist'],s.app_entitlements(s.PROBE_BUNDLE))
        self.assertEqual(len(value['code_signatures']),1)
        for bad in [b'not MachO',raw[:32],raw[:data_start],raw[:20]+struct.pack('<I',0x7fffffff)+raw[24:]]:
            with self.assertRaises(ValueError):s.macho_entitlements(bad)

    def test_empty_normal_xcent_needs_exact_linked_simulator_identity(self):
        facts={'code_signatures':[{'offset':256,'bytes':4}],
               'simulated_entitlement_sections':[{'plist':s.app_entitlements(s.PROBE_BUNDLE)}]}
        s.validate_applied_entitlements(facts,[{}],s.PROBE_BUNDLE)
        for change in [lambda x:x.update(code_signatures=[]),
                       lambda x:x.update(simulated_entitlement_sections=[]),
                       lambda x:x['simulated_entitlement_sections'][0].update(plist={}),
                       lambda x:x['simulated_entitlement_sections'][0]['plist'].update(**{'keychain-access-groups':['*']})]:
            wrong=copy.deepcopy(facts);change(wrong)
            with self.assertRaises(ValueError):s.validate_applied_entitlements(wrong,[{}],s.PROBE_BUNDLE)
        with self.assertRaises(ValueError):
            s.validate_applied_entitlements(facts,[{'aps-environment':'development'}],s.PROBE_BUNDLE)

    def native(self):
        spec=importlib.util.spec_from_file_location('c47_native_reader_test',Path(__file__).with_name('native_runtime47.py'))
        native=importlib.util.module_from_spec(spec);spec.loader.exec_module(native)
        return native

    def test_large_binary_has_separate_bounded_reader_without_relaxing_documents(self):
        n=self.native()
        with tempfile.TemporaryDirectory(dir=Path(tempfile.gettempdir()).resolve()) as directory:
            root=Path(directory);path=root/'large-app';path.write_bytes(
                struct.pack('<8I',0xfeedfacf,0x01000007,3,2,1,16,0,0)+
                struct.pack('<4I',0x1d,16,48,4)+b'fake'+b'\0'*(11*1024*1024))
            with self.assertRaises(ValueError):n.read_native_file(path)
            self.assertEqual(len(s.inspect_binary(n,path)['code_signatures']),1)
            hard=root/'hardlink';os.link(path,hard)
            with self.assertRaises(ValueError):s.inspect_binary(n,path)
            hard.unlink()
            receipt=root/'receipt.json';receipt.write_bytes(b'{}')
            strict=SimpleNamespace(read_native_file=lambda path:n.read_native_file(path))
            self.assertEqual(s.read_receipt(strict,receipt),b'{}')
            receipt.write_bytes(b'x'*65537)
            with self.assertRaises(ValueError):s.read_receipt(strict,receipt)

    def test_only_application_simulator_conditional_settings_may_change(self):
        bundle='com.layerwell.app.staging';ent=Path.cwd()/'C47Simulator.entitlements'
        before={'project':[{'name':'Release','settings':{'CODE_SIGNING_ALLOWED':'NO'}}],
                'targets':[{'name':'LayerwellStaging','product_type':'com.apple.product-type.application',
                    'configurations':[{'name':name,'settings':{'PRODUCT_BUNDLE_IDENTIFIER':bundle,
                        'CODE_SIGN_ENTITLEMENTS':'LayerwellStaging/LayerwellStaging.entitlements'}} for name in ['Debug','Release']]},
                    {'name':'OtherFramework','product_type':'com.apple.product-type.framework','configurations':[]}]}
        after=copy.deepcopy(before)
        for config in after['targets'][0]['configurations']:
            config['settings'].update({key+'[sdk=iphonesimulator*]':value for key,value in {
                'CODE_SIGNING_ALLOWED':'YES','CODE_SIGNING_REQUIRED':'NO','CODE_SIGN_IDENTITY':'-',
                'CODE_SIGN_ENTITLEMENTS':str(ent),'DEVELOPMENT_TEAM':'','PROVISIONING_PROFILE':'',
                'PROVISIONING_PROFILE_SPECIFIER':''}.items()})
        proof={'before':before,'after':after};s.validate_project_edit(proof,bundle,ent)
        for change in [lambda x:x['project'][0]['settings'].update(CODE_SIGNING_ALLOWED='YES'),
            lambda x:x['targets'][1].update(configurations=[{'settings':{'CODE_SIGN_ENTITLEMENTS':str(ent)}}]),
            lambda x:x['targets'][0]['configurations'][0]['settings'].update(CODE_SIGN_ENTITLEMENTS=str(ent)),
            lambda x:x['targets'][0]['configurations'][0]['settings'].update(**{'DEVELOPMENT_TEAM[sdk=iphoneos*]':'TEAM'})]:
            bad=copy.deepcopy(proof);change(bad['after'])
            with self.assertRaises(ValueError):s.validate_project_edit(bad,bundle,ent)

    def test_securestore_result_binds_actual_process_source_and_every_operation(self):
        head='a'*40;bundle='com.layerwell.app.staging';pid=123
        for phase in s.PHASE_OPERATIONS:
            operations={**s.PHASE_OPERATIONS,'delete':['read-before-delete','delete-test-item','absent-after-delete']}[phase]
            valid={'schema':1,'head':head,'bundle':bundle,'pid':pid,'phase':phase,'marker':'C47_SEPARATE_SECURESTORE_DIAGNOSTIC_03',
                   'passed':True,'operations':[{'operation':op,'passed':True,'result':'EXPECTED_RESULT'} for op in operations]}
            if phase == 'first':valid['notificationBadge']={'api':'EXPO_NOTIFICATIONS_NATIVE_NO_PERMISSION_REQUEST',
                'before':0,'setter_result':False,'after':0,'badge_permission':False,'cleanup_passed':True}
            s.validate_app_keychain(valid,phase,head,bundle,pid)
            for mutate in [lambda x:x.update(pid=124),lambda x:x.update(head='b'*40),
                lambda x:x.update(operations=[]),lambda x:x.update(passed=False),
                lambda x:x['operations'][0].update(result='API_ERROR',code='-34018'),
                lambda x:x['operations'][0].update(passed=False)]:
                bad=copy.deepcopy(valid);mutate(bad)
                with self.assertRaises(ValueError):s.validate_app_keychain(bad,phase,head,bundle,pid)

    def test_notification_badge_proof_requires_real_zero_and_successful_cleanup(self):
        head='a'*40;bundle='com.layerwell.app.staging';pid=123
        valid={'schema':1,'head':head,'bundle':bundle,'pid':pid,'phase':'first',
            'marker':'C47_SEPARATE_SECURESTORE_DIAGNOSTIC_03','passed':True,
            'operations':[{'operation':op,'passed':True,'result':'EXPECTED_RESULT'} for op in s.PHASE_OPERATIONS['first']],
            'notificationBadge':{'api':'EXPO_NOTIFICATIONS_NATIVE_NO_PERMISSION_REQUEST','before':0,
                'setter_result':False,'after':0,'badge_permission':False,'cleanup_passed':True}}
        s.validate_app_keychain(valid,'first',head,bundle,pid)
        for patch in [{'after':1},{'after':None},{'after':False},{'before':False},
                      {'setter_result':'false'},{'cleanup_passed':False},{'error_code':'NATIVE_ERROR'}]:
            wrong=copy.deepcopy(valid);wrong['notificationBadge'].update(patch)
            with self.subTest(patch=patch),self.assertRaises(ValueError):
                s.validate_app_keychain(wrong,'first',head,bundle,pid)
        wrong=copy.deepcopy(valid);del wrong['notificationBadge']
        with self.assertRaises(ValueError):s.validate_app_keychain(wrong,'first',head,bundle,pid)
        self.assertIn('await clearNativeNotificationsForAccountIsolation()',s.APP_KEYCHAIN_JS)
        self.assertNotIn('requestPermissionsAsync',s.APP_KEYCHAIN_JS)

    def test_ordinary_bundle_cannot_contain_separate_diagnostic(self):
        n=self.native()
        with tempfile.TemporaryDirectory(dir=Path(tempfile.gettempdir()).resolve()) as directory:
            app=Path(directory);(app/'main.jsbundle').write_bytes(b'actual ordinary bundle fixture')
            s.check_diagnostic_bundle(n,app,False)
            (app/'main.jsbundle').write_bytes(b'C47_SEPARATE_SECURESTORE_DIAGNOSTIC_03')
            s.check_diagnostic_bundle(n,app,True)
            with self.assertRaises(ValueError):s.check_diagnostic_bundle(n,app,False)
            for raw in [b'C47_SEPARATE_CONSENT_DIAGNOSTIC_04',
                        b'C47_SEPARATE_SECURESTORE_DIAGNOSTIC_03 C47_SEPARATE_CONSENT_DIAGNOSTIC_04']:
                (app/'main.jsbundle').write_bytes(raw)
                for expected in (False, True):
                    with self.subTest(raw=raw,expected=expected), self.assertRaisesRegex(ValueError,'CONSENT_DIAGNOSTIC'):
                        s.check_diagnostic_bundle(n,app,expected)

    def test_app_command_refuses_device_account_distribution_or_global_entitlement_input(self):
        argv=['xcodebuild','-sdk','iphonesimulator','-scheme','LayerwellStaging','build']
        bundle='com.layerwell.app.staging';s.validate_app_command(argv,bundle)
        for wrong in [argv+['-allowProvisioningUpdates'],argv+['archive'],argv+['-exportArchive'],
            argv+['CODE_SIGN_ENTITLEMENTS=/tmp/app.entitlements'],
            argv+['CODE_SIGN_IDENTITY=Apple Distribution'],argv+['DEVELOPMENT_TEAM=REALTEAM00'],
            argv+['PROVISIONING_PROFILE=some-profile'],argv+['CODE_SIGNING_ALLOWED=YES'],
            [item.replace('iphonesimulator','iphoneos') for item in argv],
            [item.replace('LayerwellStaging','OtherTarget') for item in argv]]:
            with self.assertRaises(ValueError):s.validate_app_command(wrong,bundle)
        n=self.native()
        self.assertEqual(n.APP_SIMULATOR_BUILD_FLAGS,['COMPILER_INDEX_STORE_ENABLE=NO','ARCHS=x86_64'])
        self.assertIn('CODE_SIGNING_ALLOWED=NO',n.SIMULATOR_BUILD_FLAGS)
        self.assertFalse(any(x.startswith('CODE_SIGN_ENTITLEMENTS=') for x in n.APP_SIMULATOR_BUILD_FLAGS))

    def test_ordinary_product_refuses_the_actual_native_diagnostic_hook_or_missing_check(self):
        s.validate_ordinary_product({'effective':{'diagnostic_native_hook_present':False}})
        for wrong in [{},{'effective':{}},{'effective':{'diagnostic_native_hook_present':True}},
                      {'effective':{'diagnostic_native_hook_present':0}}]:
            with self.assertRaises(ValueError):s.validate_ordinary_product(wrong)
        n=self.native()
        with tempfile.TemporaryDirectory(dir=Path(tempfile.gettempdir()).resolve()) as directory:
            path=Path(directory)/'actual-byte-fixture'
            raw=struct.pack('<8I',0xfeedfacf,0x01000007,3,2,1,16,0,0)+struct.pack('<4I',0x1d,16,48,4)+b'fake'
            path.write_bytes(raw)
            self.assertFalse(s.inspect_binary(n,path)['diagnostic_native_hook_present'])
            clean=s.inspect_binary(n,path)
            for marker in (b'C47AppKeychainLaunch.json',b'C47ConsentLaunch04.json'):
                path.write_bytes(raw+marker)
                facts=s.inspect_binary(n,path)
                self.assertEqual(set(facts),set(clean))
                self.assertTrue(facts['diagnostic_native_hook_present'])
                with self.subTest(marker=marker), self.assertRaisesRegex(ValueError,'NATIVE_DIAGNOSTIC'):
                    s.validate_ordinary_product({'effective':facts})

if __name__=='__main__':unittest.main()
