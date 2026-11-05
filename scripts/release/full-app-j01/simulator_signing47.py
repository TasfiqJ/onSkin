"""C47-only Xcode Simulator signing; no Apple team, profile, device or distribution."""
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import shutil
import struct
import tarfile
import time

AUTH = 'BRAIN-C47-SIMULATOR-KEYCHAIN-RUNTIME-03'
# Synthetic local test prefix, never an Apple-issued developer/team identity.
PREFIX = 'C47SIMTEST.'
PRODUCTS = {'com.layerwell.app.staging': 'LayerwellStaging',
            'com.layerwell.app.dev': 'LayerwellDev',
            'com.layerwell.campaign47.keychainprobe': 'C47KeychainProbe'}
PROBE_BUNDLE = 'com.layerwell.campaign47.keychainprobe'


def need(value, code):
    if not value:
        raise ValueError('C47_SIMULATOR_SIGNING_' + code)


def app_entitlements(bundle):
    need(bundle in PRODUCTS, 'UNKNOWN_PRODUCT')
    # The default app-owned group is sufficient; do not enable Keychain Sharing.
    return {'application-identifier': PREFIX + bundle}


def signing_flags(sdk, bundle, target, entitlement_path):
    need(sdk == 'iphonesimulator', 'SIMULATOR_SDK_REQUIRED')
    need(bundle in PRODUCTS and PRODUCTS[bundle] == target, 'EXACT_TARGET_REQUIRED')
    path = Path(entitlement_path)
    need(path.is_absolute() and path.suffix == '.entitlements', 'GENERATED_ENTITLEMENT_PATH')
    return ['CODE_SIGNING_ALLOWED=YES', 'CODE_SIGNING_REQUIRED=NO', 'CODE_SIGN_IDENTITY=-',
            'DEVELOPMENT_TEAM=', 'PROVISIONING_PROFILE=', 'PROVISIONING_PROFILE_SPECIFIER=',
            'CODE_SIGN_ENTITLEMENTS=' + str(path), 'COMPILER_INDEX_STORE_ENABLE=NO', 'ARCHS=x86_64']


def validate_entitlements(value, bundle):
    need(bundle in PRODUCTS, 'UNKNOWN_PRODUCT')
    need(isinstance(value, dict) and value.get('application-identifier') == PREFIX + bundle,
         'APPLICATION_IDENTITY')
    need(set(value) <= {'application-identifier', 'keychain-access-groups', 'get-task-allow'},
         'UNEXPECTED_ENTITLEMENT')
    if 'keychain-access-groups' in value:
        need(value['keychain-access-groups'] == [PREFIX + bundle], 'APP_OWNED_GROUP_ONLY')
    if 'get-task-allow' in value:
        need(type(value['get-task-allow']) is bool, 'DEBUG_ENTITLEMENT_TYPE')
    return value


def validate_build_settings(document,bundle,target):
    need(bundle in PRODUCTS and PRODUCTS[bundle] == target,'EXACT_TARGET_REQUIRED')
    need(isinstance(document,list),'EFFECTIVE_SETTINGS_DOCUMENT')
    rows=[row for row in document if row.get('target') == target]
    need(len(rows) == 1,'EFFECTIVE_TARGET_COUNT')
    value=rows[0].get('buildSettings',{})
    need(value.get('PLATFORM_NAME') == 'iphonesimulator' and
         value.get('PRODUCT_BUNDLE_IDENTIFIER') == bundle,'EFFECTIVE_PLATFORM_PRODUCT')
    need(value.get('CODE_SIGNING_ALLOWED') == 'YES' and value.get('CODE_SIGN_IDENTITY') == '-',
         'EFFECTIVE_LOCAL_SIGNING')
    need(all(not value.get(key) for key in
        ('DEVELOPMENT_TEAM','PROVISIONING_PROFILE','PROVISIONING_PROFILE_SPECIFIER')),
         'DEVELOPER_ACCOUNT_OR_PROFILE_FORBIDDEN')
    return {key:value.get(key) for key in ('PLATFORM_NAME','SDKROOT','PRODUCT_BUNDLE_IDENTIFIER',
        'CODE_SIGNING_ALLOWED','CODE_SIGN_IDENTITY','CODE_SIGN_ENTITLEMENTS','DEVELOPMENT_TEAM',
        'PROVISIONING_PROFILE','PROVISIONING_PROFILE_SPECIFIER')}


def macho_entitlements(raw):
    need(len(raw) >= 32 and struct.unpack_from('<I', raw)[0] == 0xfeedfacf, 'THIN_MACHO64')
    count, length = struct.unpack_from('<II', raw, 16)
    need(0 < count < 1024 and 32 + length <= len(raw), 'LOAD_COMMAND_BOUND')
    at, signatures, sections = 32, [], []
    for _ in range(count):
        need(at + 8 <= 32 + length, 'LOAD_COMMAND_HEADER')
        cmd, size = struct.unpack_from('<II', raw, at)
        need(size >= 8 and at + size <= 32 + length, 'LOAD_COMMAND_SIZE')
        if cmd == 0x1d:
            need(size == 16, 'SIGNATURE_COMMAND_SIZE')
            offset, size_ = struct.unpack_from('<II', raw, at + 8)
            need(size_ > 0 and offset + size_ <= len(raw), 'SIGNATURE_BYTES')
            signatures.append({'offset': offset, 'bytes': size_})
        if cmd == 0x19:
            need(size >= 72, 'SEGMENT_HEADER')
            nsects = struct.unpack_from('<I', raw, at + 64)[0]
            need(72 + nsects * 80 <= size, 'SECTION_BOUND')
            for index in range(nsects):
                start = at + 72 + index * 80
                name = raw[start:start+16].split(b'\0')[0].decode('ascii')
                segment = raw[start+16:start+32].split(b'\0')[0].decode('ascii')
                size_ = struct.unpack_from('<Q', raw, start + 40)[0]
                offset = struct.unpack_from('<I', raw, start + 48)[0]
                if segment == '__TEXT' and name in ('__entitlements', '__ents_der'):
                    need(0 < size_ <= 65536 and offset + size_ <= len(raw), 'ENTITLEMENT_SECTION_BOUND')
                    data = raw[offset:offset+size_]
                    item = {'segment':segment,'section':name,'bytes':size_,
                            'sha256':hashlib.sha256(data).hexdigest()}
                    if name == '__entitlements':
                        item['plist'] = plistlib.loads(data.rstrip(b'\0'))
                    sections.append(item)
        at += size
    need(at == 32 + length, 'EXACT_LOAD_COMMANDS')
    return {'code_signatures': signatures, 'simulated_entitlement_sections': sections}


def inspect_product(r, n, app, bundle, prefix):
    info = plistlib.loads(n.read_native_file(app / 'Info.plist'))
    need(info.get('CFBundleIdentifier') == bundle and info.get('CFBundleExecutable') == PRODUCTS[bundle],
         'BUILT_PRODUCT_IDENTITY')
    binary = app / info['CFBundleExecutable']
    n.validate_product(info, r.text(prefix+'-file', ['file',binary]),
        r.text(prefix+'-architectures',['lipo','-archs',binary]),
        r.text(prefix+'-platform',['xcrun','vtool','-show-build',binary]), 'x86_64')
    facts = macho_entitlements(n.read_native_file(binary, n.MAX_APP))
    # Preserve actual outputs before interpreting the mechanism.
    r.run(prefix+'-signature',['codesign','-d','--verbose=4',app], required=False)
    paths = r.run(prefix+'-signature-entitlements',['codesign','-d','--entitlements',':-',app],required=False)
    signed = []
    for path in paths:
        data = n.read_native_file(path)
        begin, end = data.find(b'<?xml'), data.rfind(b'</plist>')
        if begin >= 0 and end > begin:
            signed.append(plistlib.loads(data[begin:end+8]))
    facts['signature_entitlements'] = signed
    n.write_json(r.output/(prefix+'-effective-entitlements.json'), facts)
    r.run(prefix+'-verify-signature',['codesign','--verify','--strict','--verbose=4',app])
    need(len(facts['code_signatures']) == 1, 'ACTUAL_LOCAL_SIGNATURE_REQUIRED')
    applied = signed + [s['plist'] for s in facts['simulated_entitlement_sections'] if 'plist' in s]
    need(applied, 'APPLIED_ENTITLEMENTS_REQUIRED')
    for value in applied:
        validate_entitlements(value,bundle)
    return {'bundle':bundle,'executable':info['CFBundleExecutable'],
            'bytes':binary.stat().st_size,'sha256':n.sha(binary),'effective':facts,
            'local_test_identity':'SYNTHETIC_C47SIMTEST_NOT_APPLE_TEAM','authorization':AUTH}


PROBE_SWIFT = r'''import UIKit
import Security

@main final class C47Probe: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey:Any]?) -> Bool {
    let phase = ProcessInfo.processInfo.arguments.last ?? "invalid"
    let key = Data("c47-simulator-toolchain-transient-v1".utf8)
    // Expo SecureStore default requireAuthentication=false uses app:no-auth,
    // Data account/generic attributes and no explicit accessGroup.
    let query: [String:Any] = [kSecClass as String:kSecClassGenericPassword,
      kSecAttrService as String:"app:no-auth",kSecAttrAccount as String:key,kSecAttrGeneric as String:key]
    let first = Data("c47-synthetic-first".utf8), updated = Data("c47-synthetic-updated".utf8)
    var rows: [[String:Any]] = []
    func record(_ operation: String, _ status: OSStatus, _ expected: OSStatus, _ matched: Bool = true) {
      rows.append(["operation":operation,"status":Int(status),"expected":Int(expected),"matched":matched,"passed":status == expected && matched])
    }
    func read(_ operation: String, _ expected: OSStatus, _ value: Data? = nil) {
      var search = query; search[kSecReturnData as String] = true; search[kSecMatchLimit as String] = kSecMatchLimitOne
      var result: CFTypeRef?; let status = SecItemCopyMatching(search as CFDictionary,&result)
      record(operation,status,expected,value == nil || (result as? Data) == value)
    }
    if phase == "first" {
      read("absent",errSecItemNotFound)
      if rows.allSatisfy({$0["passed"] as? Bool == true}) {
        var add = query; add[kSecValueData as String] = first; add[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlocked
        record("write",SecItemAdd(add as CFDictionary,nil),errSecSuccess)
        read("read",errSecSuccess,first)
        record("update",SecItemUpdate(query as CFDictionary,[kSecValueData as String:updated] as CFDictionary),errSecSuccess)
        read("read-updated",errSecSuccess,updated)
      }
    } else if phase == "relaunch" { read("read-after-relaunch",errSecSuccess,updated)
    } else if phase == "delete" {
      record("delete-test-item",SecItemDelete(query as CFDictionary),errSecSuccess)
      read("absent-after-delete",errSecItemNotFound)
    }
    let passed = !rows.isEmpty && rows.allSatisfy({$0["passed"] as? Bool == true})
    let receipt: [String:Any] = ["schema":1,"bundle":Bundle.main.bundleIdentifier ?? "", "pid":Int(getpid()),"phase":phase,"operations":rows,"passed":passed]
    let directory = FileManager.default.urls(for:.documentDirectory,in:.userDomainMask)[0]
    if ["first","relaunch","delete"].contains(phase), let data = try? JSONSerialization.data(withJSONObject:receipt,options:[.prettyPrinted,.sortedKeys]) {
      try? data.write(to:directory.appendingPathComponent("C47KeychainProbe-\(phase).json"),options:.atomic)
    }
    window = UIWindow(frame:UIScreen.main.bounds); let controller = UIViewController(); controller.view.backgroundColor = .white
    let label = UILabel(frame:CGRect(x:20,y:100,width:340,height:120));label.text = "C47 isolated probe \(phase): \(passed ? "PASS" : "FAIL")";label.numberOfLines = 0
    controller.view.addSubview(label);window?.rootViewController = controller;window?.makeKeyAndVisible();return true
  }
}
'''

PROBE_PROJECT = r'''require 'xcodeproj'
require 'json'
root = ARGV.fetch(0)
project = Xcodeproj::Project.new(File.join(root,'C47KeychainProbe.xcodeproj'))
target = project.new_target(:application,'C47KeychainProbe',:ios,'17.0')
target.source_build_phase.add_file_reference(project.main_group.new_file('Main.swift'))
target.build_configurations.each do |config|
  config.build_settings.merge!({'PRODUCT_BUNDLE_IDENTIFIER'=>'com.layerwell.campaign47.keychainprobe',
    'PRODUCT_NAME'=>'C47KeychainProbe','INFOPLIST_FILE'=>'Info.plist','SWIFT_VERSION'=>'5.0',
    'TARGETED_DEVICE_FAMILY'=>'1','SUPPORTED_PLATFORMS'=>'iphonesimulator',
    'SUPPORTS_MACCATALYST'=>'NO','IPHONEOS_DEPLOYMENT_TARGET'=>'17.0'})
end
project.save
scheme = Xcodeproj::XCScheme.new;scheme.add_build_target(target);scheme.launch_action.build_configuration = 'Release'
scheme.save_as(project.path,'C47KeychainProbe',true)
'''


PHASE_OPERATIONS = {'first':['absent','write','read','update','read-updated'],
                    'relaunch':['read-after-relaunch'],'delete':['delete-test-item','absent-after-delete']}


def validate_probe_result(value, phase, bundle=PROBE_BUNDLE):
    need(isinstance(value,dict) and value.get('schema') == 1 and value.get('bundle') == bundle and
         value.get('phase') == phase and type(value.get('pid')) is int and value['pid'] > 0,
         'ACTUAL_APP_RECEIPT')
    rows = value.get('operations',[])
    need([row.get('operation') for row in rows] == PHASE_OPERATIONS[phase] and value.get('passed') is True,
         'REAL_KEYCHAIN_OPERATIONS')
    for row in rows:
        expected = -25300 if row['operation'].startswith('absent') else 0
        need(type(row.get('status')) is int and row['status'] == expected == row.get('expected') and
             row.get('passed') is True and row.get('matched') is True,'REAL_KEYCHAIN_OSSTATUS')
    return value


def run_probe(r,n):
    need(os.name == 'posix' and r.env.get('APP_VARIANT') == 'staging' and
         r.env.get('EXPO_PUBLIC_APP_ENV') == 'staging','HOST_AND_LANE')
    head = r.env['C47_EXPECTED_HEAD']
    r.receipt.update(lane='isolated-simulator-toolchain-probe',
        qualification='TOOLCHAIN_ONLY_NOT_LAYERWELL_APP_OR_ORDINARY_XCTEST',signing_authority=AUTH,
        limitations=['Simulator-local synthetic test identity only; no Apple account/profile/device/distribution',
                     'Not Layerwell application, ordinary XCTest, supported owner or release proof'])
    r.receipt['source'] = r.source_proof('source-before',head)
    r.passed('source',r.receipt['source'])
    tools = {}
    for name,argv in [('architecture',['uname','-m']),('xcode',['xcodebuild','-version']),
        ('simulator-sdk',['xcrun','--sdk','iphonesimulator','--show-sdk-version']),
        ('swift',['xcrun','swiftc','--version']),('xcodeproj',['ruby','-rxcodeproj','-e','puts Xcodeproj::VERSION'])]:
        tools[name] = r.text('probe-tool-'+name,argv,timeout=60)
    need(tools['architecture'] == 'x86_64' and tools['xcode'].startswith('Xcode 26.4'),'ACTUAL_TOOLCHAIN')
    n.write_json(r.output/'toolchain.json',tools)
    root = Path(os.environ['RUNNER_TEMP']).resolve()/ 'c47-simulator-signing-probe'
    need(not root.exists(),'NEW_PROBE_WORKSPACE');root.mkdir()
    (root/'Main.swift').write_text(PROBE_SWIFT,encoding='utf8')
    (root/'make-project.rb').write_text(PROBE_PROJECT,encoding='utf8')
    info={'CFBundleIdentifier':'$(PRODUCT_BUNDLE_IDENTIFIER)','CFBundleExecutable':'$(EXECUTABLE_NAME)',
          'CFBundleName':'C47KeychainProbe','CFBundlePackageType':'APPL','CFBundleVersion':'1',
          'CFBundleShortVersionString':'1.0','LSRequiresIPhoneOS':True,'UILaunchScreen':{}}
    (root/'Info.plist').write_bytes(plistlib.dumps(info))
    entitlement=root/'C47Simulator.entitlements';entitlement.write_bytes(plistlib.dumps(app_entitlements(PROBE_BUNDLE)))
    evidence=r.output/'simulator-probe';evidence.mkdir()
    for name in ['Main.swift','make-project.rb','Info.plist','C47Simulator.entitlements']:
        shutil.copy2(root/name,evidence/name)
    r.run('probe-generate-project',['ruby',root/'make-project.rb',root],timeout=60)
    shutil.copy2(root/'C47KeychainProbe.xcodeproj/project.pbxproj',evidence/'project.pbxproj')
    flags=signing_flags('iphonesimulator',PROBE_BUNDLE,'C47KeychainProbe',entitlement)
    argv=['xcodebuild','-project',root/'C47KeychainProbe.xcodeproj','-scheme','C47KeychainProbe',
          '-configuration','Release','-sdk','iphonesimulator','-destination','generic/platform=iOS Simulator',
          '-derivedDataPath',root/'derived',*flags]
    settings=r.run('probe-effective-build-settings',argv+['-showBuildSettings','-json'],timeout=120)
    effective=validate_build_settings(json.loads(n.read_native_file(settings[0])),PROBE_BUNDLE,'C47KeychainProbe')
    n.write_json(evidence/'effective-settings.json',effective)
    r.run('probe-xcode-build',argv+['-resultBundlePath',root/'build.xcresult','build'],timeout=600)
    # Preserve generated/applied entitlement outputs, not just our input plist.
    for index,path in enumerate(sorted((root/'derived').rglob('*.xcent*'))):
        if path.is_file():shutil.copy2(path,evidence/(str(index)+'-'+path.name))
    app=root/'derived/Build/Products/Release-iphonesimulator/C47KeychainProbe.app'
    need(app.is_dir(),'ACTUAL_PROBE_APP')
    n.write_json(evidence/'app-inventory.json',{'source':r.receipt['source'],'files':n.bundle_inventory(app),
        'qualification':'ISOLATED_TOOLCHAIN_PROBE_NOT_LAYERWELL_APP'})
    archive=evidence/'signed-simulator-toolchain-probe.tar.gz'
    with tarfile.open(archive,'w:gz') as out:
        out.add(app,arcname=app.name,recursive=True)
    n.write_json(evidence/'app-artifact.json',{'file':archive.name,'bytes':archive.stat().st_size,
        'sha256':n.sha(archive),'source':r.receipt['source'],'bundle':PROBE_BUNDLE,'configuration':'Release',
        'lane':'isolated-simulator-toolchain-probe','qualification':'NOT_LAYERWELL_RUNTIME_OR_OWNER_PROOF'})
    product=inspect_product(r,n,app,PROBE_BUNDLE,'probe-product')
    r.passed('probe-compiled',product)
    device=n.prepare_simulator(r,'normal')
    container=Path(n.install_simulator_app(r,device,app,PROBE_BUNDLE))
    need(n.sha(container/'C47KeychainProbe') == product['sha256'],'INSTALLED_POST_SIGNATURE_BYTES')
    data=Path(r.text('probe-data-container',['xcrun','simctl','get_app_container',device,PROBE_BUNDLE,'data'],timeout=60))
    results=[]
    for phase in PHASE_OPERATIONS:
        output=r.text('probe-launch-'+phase,['xcrun','simctl','launch',device,PROBE_BUNDLE,phase],timeout=120)
        match=re.fullmatch(re.escape(PROBE_BUNDLE)+r': ([1-9][0-9]*)',output)
        need(match,'PROBE_LAUNCH_PID')
        receipt=data/'Documents'/('C47KeychainProbe-'+phase+'.json');deadline=time.monotonic()+30
        while not receipt.is_file() and time.monotonic()<deadline:time.sleep(.2)
        need(receipt.is_file(),'APP_PROCESS_RECEIPT_MISSING')
        raw=n.read_native_file(receipt,65536);(evidence/receipt.name).write_bytes(raw)
        value=validate_probe_result(json.loads(raw),phase)
        need(value['pid'] == int(match.group(1)),'APP_PROCESS_PID_BINDING');results.append(value)
        r.run('probe-terminate-'+phase,['xcrun','simctl','terminate',device,PROBE_BUNDLE],timeout=60)
    need(len({v['pid'] for v in results}) == 3,'ACTUAL_PROCESS_RESTARTS')
    r.source_proof('source-after-probe',head)
    r.passed('probe-keychain',{'same_simulator':device,'same_data_container':str(data),
        'bundle':PROBE_BUNDLE,'processes':[v['pid'] for v in results],'operation_results':results,
        'namespace':'APP_OWNED_DEFAULT_GROUP_ONLY','test_item_deleted':True,
        'qualification':'ISOLATED_TOOLCHAIN_APP_NOT_LAYERWELL_SECURESTORE_OR_NORMAL_XCTEST'})
    r.receipt.update(status='SIMULATOR_TOOLCHAIN_KEYCHAIN_PROBE_ONLY',finished_utc=n.utc())
    r.persist()
