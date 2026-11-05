"""C47-only Xcode Simulator signing; no Apple team, profile, device or distribution."""
import hashlib
import json
import mmap
import os
from pathlib import Path
import plistlib
import re
import shutil
import struct
import stat
import sys
import tarfile
import time

AUTH = 'BRAIN-C47-SIMULATOR-KEYCHAIN-RUNTIME-03'
# Synthetic local test prefix, never an Apple-issued developer/team identity.
PREFIX = 'C47SIMTEST.'
PRODUCTS = {'com.layerwell.app.staging': 'LayerwellStaging',
            'com.layerwell.app.development': 'LayerwellDev',
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


def inspect_binary(n, path):
    """App binary only: retain the existing 10MiB native-document reader unchanged."""
    identity = n.stage_file_digest(path, n.MAX_APP)
    stamp = lambda s: (s.st_dev, s.st_ino, s.st_mode, s.st_nlink, s.st_size,
                       s.st_mtime_ns, s.st_ctime_ns)
    before = path.lstat()
    need(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and
         0 < before.st_size == identity['bytes'] <= n.MAX_APP, 'APP_BINARY_BOUND')
    descriptor = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
    try:
        need(stamp(os.fstat(descriptor)) == stamp(before), 'APP_BINARY_OPEN_RACE')
        with mmap.mmap(descriptor, 0, access=mmap.ACCESS_READ) as data:
            need(hashlib.sha256(data).hexdigest() == identity['sha256'], 'APP_BINARY_HASH')
            facts = macho_entitlements(data)
            facts['diagnostic_native_hook_present'] = data.find(b'C47AppKeychainLaunch.json') >= 0
        need(stamp(os.fstat(descriptor)) == stamp(before) and
             stamp(path.lstat()) == stamp(before), 'APP_BINARY_READ_RACE')
    finally:
        os.close(descriptor)
    need(n.stage_file_digest(path, n.MAX_APP) == identity, 'APP_BINARY_CHANGED')
    facts['binary_identity'] = identity
    return facts


def validate_applied_entitlements(facts, signed, bundle):
    need(len(facts['code_signatures']) == 1, 'ACTUAL_LOCAL_SIGNATURE_REQUIRED')
    linked = [s['plist'] for s in facts['simulated_entitlement_sections'] if 'plist' in s]
    need(len(linked) == 1, 'APPLIED_SIMULATED_ENTITLEMENTS_REQUIRED')
    validate_entitlements(linked[0], bundle)
    # Xcode26.4 emits an empty normal .xcent and the identity in the linked
    # Simulator section. Nonempty signature entitlements must also be app-owned.
    need(len(signed) <= 1, 'SIGNATURE_ENTITLEMENT_COUNT')
    for value in signed:
        need(isinstance(value, dict), 'SIGNATURE_ENTITLEMENT_DICTIONARY')
        if value:
            validate_entitlements(value, bundle)


def read_receipt(n, path):
    need(0 < path.lstat().st_size <= 65536, 'APP_RECEIPT_BOUND')
    raw = n.read_native_file(path)
    need(0 < len(raw) <= 65536, 'APP_RECEIPT_BOUND')
    return raw


def validate_ordinary_product(product):
    need(product.get('effective',{}).get('diagnostic_native_hook_present') is False,
         'NATIVE_DIAGNOSTIC_IN_ORDINARY_PRODUCT')


def inspect_product(r, n, app, bundle, prefix):
    info = plistlib.loads(n.read_native_file(app / 'Info.plist'))
    need(info.get('CFBundleIdentifier') == bundle and info.get('CFBundleExecutable') == PRODUCTS[bundle],
         'BUILT_PRODUCT_IDENTITY')
    binary = app / info['CFBundleExecutable']
    n.validate_product(info, r.text(prefix+'-file', ['file',binary]),
        r.text(prefix+'-architectures',['lipo','-archs',binary]),
        r.text(prefix+'-platform',['xcrun','vtool','-show-build',binary]), 'x86_64')
    facts = inspect_binary(n, binary)
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
    validate_applied_entitlements(facts, signed, bundle)
    need(n.stage_file_digest(binary,n.MAX_APP) == facts['binary_identity'],'SIGNED_BINARY_CHANGED')
    return {'bundle':bundle,'executable':info['CFBundleExecutable'],
            **facts['binary_identity'],'effective':facts,
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
        raw=read_receipt(n,receipt);(evidence/receipt.name).write_bytes(raw)
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


# This project mutation is confined to the application target's Simulator SDK.
# The original device settings and entitlement file remain byte-for-byte intact.
APP_PROJECT = r'''require 'xcodeproj'
require 'json'
project_path, target_name, bundle, entitlements, output = ARGV
abort 'exact Simulator application only' unless {
  'LayerwellStaging'=>'com.layerwell.app.staging',
  'LayerwellDev'=>'com.layerwell.app.development'
}[target_name] == bundle && ENV['C47_SIGNING_SDK'] == 'iphonesimulator'
project = Xcodeproj::Project.open(project_path)
snapshot = lambda do
  {'project'=>project.build_configurations.map { |c| {'name'=>c.name,'settings'=>Marshal.load(Marshal.dump(c.build_settings))} },
   'targets'=>project.targets.map { |t| {'name'=>t.name,'product_type'=>t.product_type,
     'configurations'=>t.build_configurations.map { |c| {'name'=>c.name,'settings'=>Marshal.load(Marshal.dump(c.build_settings))} }} }}
end
before = snapshot.call
selected = project.targets.select { |t| t.name == target_name && t.product_type == 'com.apple.product-type.application' }
abort 'expected exactly one application target' unless selected.length == 1
selected[0].build_configurations.each do |c|
  abort 'unexpected original bundle' unless c.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] == bundle
  {'CODE_SIGNING_ALLOWED'=>'YES','CODE_SIGNING_REQUIRED'=>'NO','CODE_SIGN_IDENTITY'=>'-',
   'CODE_SIGN_ENTITLEMENTS'=>entitlements,'DEVELOPMENT_TEAM'=>'','PROVISIONING_PROFILE'=>'',
   'PROVISIONING_PROFILE_SPECIFIER'=>''}.each do |key,value|
    scoped = key + '[sdk=iphonesimulator*]'
    abort 'refuse existing scoped override' if c.build_settings.key?(scoped)
    c.build_settings[scoped] = value
  end
end
after = snapshot.call
project.save
File.write(output,JSON.pretty_generate({'before'=>before,'after'=>after})+"\n",mode:'wx')
'''


def validate_project_edit(value, bundle, entitlement):
    import copy
    need(bundle in PRODUCTS and bundle != PROBE_BUNDLE, 'ACTUAL_APP_REQUIRED')
    expected = copy.deepcopy(value['before'])
    rows = [t for t in expected['targets'] if t['name'] == PRODUCTS[bundle] and
            t['product_type'] == 'com.apple.product-type.application']
    need(len(rows) == 1 and {c['name'] for c in rows[0]['configurations']} == {'Debug','Release'},
         'GENERATED_APPLICATION_CONFIGURATIONS')
    for config in rows[0]['configurations']:
        need(config['settings'].get('PRODUCT_BUNDLE_IDENTIFIER') == bundle, 'ORIGINAL_APP_BUNDLE')
        for key, setting in {'CODE_SIGNING_ALLOWED':'YES','CODE_SIGNING_REQUIRED':'NO',
            'CODE_SIGN_IDENTITY':'-','CODE_SIGN_ENTITLEMENTS':str(entitlement),'DEVELOPMENT_TEAM':'',
            'PROVISIONING_PROFILE':'','PROVISIONING_PROFILE_SPECIFIER':''}.items():
            scoped = key + '[sdk=iphonesimulator*]'
            need(scoped not in config['settings'], 'UNDECLARED_PRIOR_OVERRIDE')
            config['settings'][scoped] = setting
    need(expected == value['after'], 'DEVICE_OR_UNRELATED_TARGET_CHANGED')


def configure_app(r,n,ios,bundle):
    need(bundle in PRODUCTS and bundle != PROBE_BUNDLE and
         ios.resolve() == (r.root/'apps/mobile/ios').resolve(), 'GENERATED_APP_WORKSPACE')
    need((bundle == 'com.layerwell.app.staging' and r.env['APP_VARIANT'] == 'staging') or
         (bundle == 'com.layerwell.app.development' and r.env['APP_VARIANT'] == 'development'),
         'EXACT_APP_LANE')
    projects=list(ios.glob('*.xcodeproj'))
    need(len(projects) == 1 and projects[0].stem == PRODUCTS[bundle], 'EXACT_APPLICATION_PROJECT')
    target=PRODUCTS[bundle]; project=projects[0]/'project.pbxproj'
    evidence=r.output/'simulator-signing'; evidence.mkdir()
    original_ent=ios/target/(target+'.entitlements')
    original=n.read_native_file(original_ent)
    (evidence/'original-device.entitlements').write_bytes(original)
    (evidence/'project.before.pbxproj').write_bytes(n.read_native_file(project))
    ent=ios/'C47Simulator.entitlements'
    need(not ent.exists(),'FRESH_APP_ENTITLEMENT_INPUT')
    ent.write_bytes(plistlib.dumps(app_entitlements(bundle)))
    (evidence/ent.name).write_bytes(n.read_native_file(ent))
    script=evidence/'configure-generated-simulator.rb';script.write_text(APP_PROJECT,encoding='utf8')
    changes=evidence/'project-settings-change.json'
    env={**r.env,'C47_SIGNING_SDK':'iphonesimulator'}
    r.run('configure-simulator-app-target',['ruby',script,projects[0],target,bundle,ent,changes],env=env,timeout=60)
    validate_project_edit(json.loads(n.read_native_file(changes)),bundle,ent)
    need(n.read_native_file(original_ent) == original,'ORIGINAL_DEVICE_ENTITLEMENTS_CHANGED')
    (evidence/'project.after.pbxproj').write_bytes(n.read_native_file(project))
    n.write_json(evidence/'scope.json',{'authorization':AUTH,'bundle':bundle,'target':target,
        'sdk':'iphonesimulator','synthetic_identity':PREFIX+bundle,
        'entitlement_input_sha256':n.sha(ent),'original_device_entitlement_sha256':n.sha(original_ent),
        'project_before_sha256':n.sha(evidence/'project.before.pbxproj'),
        'project_after_sha256':n.sha(project),'device_and_other_target_settings_unchanged':True})
    return ent


def check_effective_app(r,n,argv,bundle,ent,name):
    validate_app_command(argv,bundle)
    paths=r.run(name,argv+['-showBuildSettings','-json'],timeout=180)
    document=json.loads(n.read_native_file(paths[0]))
    value=validate_build_settings(document,bundle,PRODUCTS[bundle])
    need(value['CODE_SIGN_ENTITLEMENTS'] == str(ent),'EFFECTIVE_APP_ENTITLEMENT_INPUT')
    for row in document:
        if row.get('target') != PRODUCTS[bundle]:
            need(row.get('buildSettings',{}).get('CODE_SIGN_ENTITLEMENTS') != str(ent),
                 'APP_ENTITLEMENTS_LEAKED_TO_ANOTHER_TARGET')
    n.write_json(r.output/'simulator-signing/effective-settings.json',value)


def validate_app_command(argv,bundle):
    argv=list(map(str,argv))
    need(bundle in PRODUCTS and bundle != PROBE_BUNDLE and argv[0] == 'xcodebuild', 'APP_BUILD_TOOL')
    for option,expected in [('-sdk','iphonesimulator'),('-scheme',PRODUCTS[bundle])]:
        need(argv.count(option) == 1 and argv.index(option)+1 < len(argv) and
             argv[argv.index(option)+1] == expected,'SIMULATOR_APP_COMMAND_SCOPE')
    need(not any(arg in {'archive','-exportArchive','-archivePath','-exportPath','-exportOptionsPlist',
                        '-allowProvisioningUpdates','-allowProvisioningDeviceRegistration'} for arg in argv),
         'DISTRIBUTION_OR_ACCOUNT_COMMAND_FORBIDDEN')
    need(not any(arg.startswith('CODE_SIGN_ENTITLEMENTS=') for arg in argv),'GLOBAL_APP_ENTITLEMENTS_FORBIDDEN')
    need(not any(arg.startswith(('CODE_SIGN','DEVELOPMENT_TEAM=','PROVISIONING_PROFILE')) for arg in argv),
         'GLOBAL_SIGNING_OVERRIDE_FORBIDDEN')


# Separate Release diagnostic: use the installed Expo API with its real default
# query/options. Never modify recovery state or intercept the application's API.
APP_KEYCHAIN_JS = r'''import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import 'expo-router/entry';
const diagnosticMarker = 'C47_SEPARATE_SECURESTORE_DIAGNOSTIC_03';
void (async () => {
  const directory = FileSystem.documentDirectory;
  const launch = JSON.parse(await FileSystem.readAsStringAsync(directory + 'C47AppKeychainLaunch.json'));
  const key = 'C47SimulatorTransient03_' + launch.head.slice(0, 16);
  const operations = [];
  const first = 'C47_SYNTHETIC_FIRST', updated = 'C47_SYNTHETIC_UPDATED';
  async function check(operation, fn, expected) {
    try {
      const value = await fn();
      const passed = value === expected;
      operations.push({operation, passed, result: passed ? 'EXPECTED_RESULT' : 'UNEXPECTED_RESULT'});
      if (!passed) throw new Error('C47_EXPECTATION');
    } catch (error) {
      if (!operations.some(row => row.operation === operation))
        operations.push({operation, passed:false, result:'API_ERROR', code:String(error.code ?? 'UNCLASSIFIED')});
      throw new Error('C47_DIAGNOSTIC_STOP');
    }
  }
  let passed = false;
  try {
    if (launch.phase === 'first') {
      await check('absent', () => SecureStore.getItemAsync(key), null);
      await check('write', () => SecureStore.setItemAsync(key, first), undefined);
      await check('read', () => SecureStore.getItemAsync(key), first);
      await check('update', () => SecureStore.setItemAsync(key, updated), undefined);
      await check('read-updated', () => SecureStore.getItemAsync(key), updated);
    } else if (launch.phase === 'relaunch') {
      await check('read-after-relaunch', () => SecureStore.getItemAsync(key), updated);
    } else if (launch.phase === 'delete') {
      // Confirm the exact authorized test item before deleting only that item.
      await check('read-before-delete', () => SecureStore.getItemAsync(key), updated);
      await check('delete-test-item', () => SecureStore.deleteItemAsync(key), undefined);
      await check('absent-after-delete', () => SecureStore.getItemAsync(key), null);
    } else throw new Error('C47_PHASE');
    passed = operations.length > 0 && operations.every(row => row.passed);
  } catch { /* Failure is preserved, never returned as absent or success. */ }
  await FileSystem.writeAsStringAsync(directory + 'C47AppKeychain-' + launch.phase + '.json',
    JSON.stringify({schema:1, marker:diagnosticMarker, ...launch, operations, passed}));
})();
'''

APP_KEYCHAIN_SWIFT = r'''
    // Separate C47 diagnostic build only; restored before the ordinary build.
    let c47Arguments = ProcessInfo.processInfo.arguments
    guard let c47Index = c47Arguments.firstIndex(of: "--c47-keychain-phase"), c47Index + 1 < c47Arguments.count,
          c47Arguments.filter({ $0 == "--c47-keychain-phase" }).count == 1,
          ["first", "relaunch", "delete"].contains(c47Arguments[c47Index + 1]) else { fatalError("C47 diagnostic phase required") }
    let c47Launch: [String: Any] = ["schema": 1, "head": "HEAD47", "bundle": Bundle.main.bundleIdentifier ?? "", "pid": Int(ProcessInfo.processInfo.processIdentifier), "phase": c47Arguments[c47Index + 1]]
    let c47Documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    do {
      let c47Data = try JSONSerialization.data(withJSONObject: c47Launch, options: [.sortedKeys])
      try c47Data.write(to: c47Documents.appendingPathComponent("C47AppKeychainLaunch.json"), options: .atomic)
    } catch { fatalError("C47 diagnostic launch receipt unavailable") }
'''


def validate_app_keychain(value,phase,head,bundle,pid):
    operations={**PHASE_OPERATIONS,'delete':['read-before-delete','delete-test-item','absent-after-delete']}
    need(isinstance(value,dict) and value.get('schema') == 1 and value.get('head') == head and
         value.get('bundle') == bundle and value.get('pid') == pid and
         value.get('phase') == phase and value.get('marker') == 'C47_SEPARATE_SECURESTORE_DIAGNOSTIC_03',
         'REAL_APP_SECURESTORE_RECEIPT_IDENTITY')
    rows=value.get('operations',[])
    need(value.get('passed') is True and [row.get('operation') for row in rows] == operations[phase] and
         all(row.get('passed') is True and row.get('result') == 'EXPECTED_RESULT' and 'code' not in row for row in rows),
         'REAL_APP_SECURESTORE_OPERATIONS')


def run_app_diagnostic(r,n,ios,argv,products,bundle,head):
    validate_app_command(argv,bundle)
    need(bundle == 'com.layerwell.app.staging','ORDINARY_APP_DIAGNOSTIC_ONLY')
    mobile=r.root/'apps/mobile';entry=mobile/'.expo/C47KeychainDiagnostic03.js'
    need(not entry.exists() and 'ENTRY_FILE' not in r.env,'NO_EXISTING_ENTRY_OVERRIDE')
    delegate=ios/PRODUCTS[bundle]/'AppDelegate.swift'
    original=n.read_native_file(delegate)
    anchor=b'    let delegate = ReactNativeDelegate()'
    need(original.count(anchor) == 1 and b'C47' not in original,'EXACT_DIAGNOSTIC_INSERTION')
    evidence=r.output/'app-keychain-diagnostic';evidence.mkdir()
    (evidence/'AppDelegate.original.swift').write_bytes(original)
    entry.parent.mkdir(exist_ok=True);entry.write_text(APP_KEYCHAIN_JS,encoding='utf8')
    (evidence/'diagnostic-entry.js').write_bytes(n.read_native_file(entry))
    delegate.write_bytes(original.replace(anchor,APP_KEYCHAIN_SWIFT.replace('HEAD47',head).encode()+anchor))
    (evidence/'AppDelegate.diagnostic.swift').write_bytes(n.read_native_file(delegate))
    try:
        r.run('app-keychain-diagnostic-build',argv+['-resultBundlePath',products/'keychain-build.xcresult','build'],
              env={**r.env,'ENTRY_FILE':str(entry)},timeout=3000)
        app=products/'derived/Build/Products/Release-iphonesimulator/LayerwellStaging.app'
        check_diagnostic_bundle(n,app,True)
        product=inspect_product(r,n,app,bundle,'app-keychain-diagnostic')
        need(product['effective']['diagnostic_native_hook_present'] is True,'ACTUAL_DIAGNOSTIC_HOOK_REQUIRED')
        n.write_json(evidence/'app-inventory.json',{'source':r.receipt['source'],
            'configuration':'Release','lane':'SEPARATE_APP_SECURESTORE_DIAGNOSTIC',
            'product':product,'files':n.bundle_inventory(app)})
        archive=evidence/'signed-app-securestore-diagnostic.tar.gz'
        with tarfile.open(archive,'w:gz') as out:out.add(app,arcname=app.name)
        n.write_json(evidence/'app-artifact.json',{'file':archive.name,'bytes':archive.stat().st_size,
            'sha256':n.sha(archive),'inventory_sha256':n.sha(evidence/'app-inventory.json'),
            'product':product,'head':head,'qualification':'DIAGNOSTIC_NOT_ORDINARY_XCTEST_PRODUCT'})
        device=n.prepare_simulator(r,'normal')
        installed=Path(n.install_simulator_app(r,device,app,bundle))
        need(n.stage_file_digest(installed/PRODUCTS[bundle],n.MAX_APP) ==
             n.stage_file_digest(app/PRODUCTS[bundle],n.MAX_APP),'DIAGNOSTIC_INSTALLED_BYTES')
        data=Path(r.text('app-keychain-data-container',['xcrun','simctl','get_app_container',device,bundle,'data'],timeout=120))
        pids=[]
        for phase in PHASE_OPERATIONS:
            path=data/'Documents'/('C47AppKeychain-'+phase+'.json')
            need(not path.exists(),'NO_STALE_DIAGNOSTIC_RECEIPT')
            output=r.text('app-keychain-launch-'+phase,['xcrun','simctl','launch',device,bundle,'--c47-keychain-phase',phase],timeout=120)
            match=re.fullmatch(re.escape(bundle)+r': ([1-9][0-9]*)',output)
            need(match,'APP_DIAGNOSTIC_LAUNCH_PID');pid=int(match.group(1));pids.append(pid)
            deadline=min(time.monotonic()+90,r.deadline-30)
            while not path.is_file() and time.monotonic()<deadline:time.sleep(.5)
            need(path.is_file(),'APP_SECURESTORE_RECEIPT_MISSING')
            raw=read_receipt(n,path);(evidence/path.name).write_bytes(raw)
            validate_app_keychain(json.loads(raw),phase,head,bundle,pid)
            r.run('app-keychain-terminate-'+phase,['xcrun','simctl','terminate',device,bundle],timeout=120)
        need(len(set(pids)) == 3,'REAL_APP_PROCESS_RESTARTS')
        r.passed('app-process-keychain',{'bundle':bundle,'head':head,'same_simulator':device,
            'same_data_container':str(data),'pids':pids,'product':product,
            'api':'ACTUAL_EXPO_SECURE_STORE_DEFAULT_OPTIONS','no_values_or_recovery_data_logged':True,
            'only_transient_test_item_deleted':True,'ordinary_product_rebuild_required':True})
    finally:
        delegate.write_bytes(original)
        entry.unlink()
        need(n.read_native_file(delegate) == original and not entry.exists(),'DIAGNOSTIC_SOURCE_NOT_RESTORED')
        n.write_json(evidence/'RESTORED.json',{'delegate_sha256':n.sha(delegate),
            'original_delegate_sha256':hashlib.sha256(original).hexdigest(),'entry_removed':True,
            'ordinary_rebuild_not_yet_proven':True})


def check_diagnostic_bundle(n,app,expected):
    path=app/'main.jsbundle';identity=n.stage_file_digest(path,n.MAX_APP)
    before=path.lstat()
    stamp=lambda s:(s.st_dev,s.st_ino,s.st_mode,s.st_nlink,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
    descriptor=os.open(path,os.O_RDONLY|getattr(os,'O_NOFOLLOW',0))
    try:
        with mmap.mmap(descriptor,0,access=mmap.ACCESS_READ) as data:
            need(hashlib.sha256(data).hexdigest() == identity['sha256'],'JAVASCRIPT_BUNDLE_HASH')
            observed=data.find(b'C47_SEPARATE_SECURESTORE_DIAGNOSTIC_03') >= 0
        need(stamp(os.fstat(descriptor)) == stamp(before) and stamp(path.lstat()) == stamp(before),
             'JAVASCRIPT_BUNDLE_CHANGED')
    finally:os.close(descriptor)
    need(n.stage_file_digest(path,n.MAX_APP) == identity,'JAVASCRIPT_BUNDLE_CHANGED')
    need(observed is expected,'DIAGNOSTIC_BUNDLE_ISOLATION')
    return {'diagnostic_marker_present':observed,**identity}


def retain_applied_outputs(n,derived,evidence):
    evidence.mkdir()
    rows=[]
    for index,path in enumerate(sorted(derived.rglob('*.xcent*'))):
        identity=n.stage_file_digest(path,65536)
        destination=evidence/(str(index)+'-'+path.name)
        destination.write_bytes(n.read_native_file(path))
        if path.suffix == '.xcent':
            value=plistlib.loads(n.read_native_file(path))
            if value.get('application-identifier','').startswith(PREFIX):
                bundle=value['application-identifier'][len(PREFIX):]
                validate_entitlements(value,bundle)
                need(path.name in {PRODUCTS[bundle]+'.app-Simulated.xcent',PRODUCTS[bundle]+'.app.xcent'},
                     'APP_ENTITLEMENTS_ON_NESTED_PRODUCT')
        rows.append({'generated_path':str(path.relative_to(derived)),'evidence':destination.name,**identity})
    need(rows,'GENERATED_XCENT_OUTPUT_REQUIRED')
    n.write_json(evidence/'INDEX.json',rows)
