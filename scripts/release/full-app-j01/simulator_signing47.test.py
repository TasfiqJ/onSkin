"""Simulator signing boundaries and real-operation receipt refusals, no Mac needed."""
import copy
import importlib.util
from pathlib import Path
import plistlib
import struct
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

if __name__=='__main__':unittest.main()
