"""Safe installed-source identities only; never emit environment credentials."""
import hashlib, json, pathlib, platform, shutil, subprocess
root=pathlib.Path.cwd()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
lock=json.loads((root/'package-lock.json').read_text())
packages={}
for name in ['expo','expo-network','expo-notifications','@expo/ui','expo-router','expo-sharing','expo-widgets','react-native','hermes-compiler','react-native-drawer-layout']:
    path=root/'node_modules'/name/'package.json'
    data=json.loads(path.read_text())
    packages[name]=dict(installed_version=data['version'],installed_manifest_sha256=sha(path),lock=lock['packages']['node_modules/'+name])
bundled=root/'node_modules/expo/bundledNativeModules.json';expected=json.loads(bundled.read_text())
mapping=json.loads((root/'docs/phase-9/ios-sdk-package-mapping.json').read_text())
pins=[]
for package in mapping['mappings']:
    for pin in package['notes']['sourcePins']:
        actual=sha(root/pin['path']);assert actual==pin['sha256'];pins.append(dict(path=pin['path'],sha256=actual,matches_original=True))
native=[]
for path in (root/'scripts/phase5/expo-widgets-57.0.26').iterdir():
    if path.is_file():
        installed=root/'node_modules/expo-widgets/ios'/('Widgets/'+path.name if path.name in ['AppIntent.swift','EntryView.swift','TimelineProvider.swift','Utils.swift','WidgetLiveActivity.swift'] else path.name)
        assert sha(path)==sha(installed)
        native.append(dict(payload=path.relative_to(root).as_posix(),installed=installed.relative_to(root).as_posix(),sha256=sha(path)))
print(json.dumps(dict(platform=platform.platform(),python=platform.python_version(),node=subprocess.check_output(['node','--version']).decode().strip(),npm=subprocess.check_output(['npm','--version']).decode().strip(),npm_binary=shutil.which('npm'),source_commit=subprocess.check_output(['git','rev-parse','HEAD']).decode().strip(),source_tree=subprocess.check_output(['git','rev-parse','HEAD^{tree}']).decode().strip(),whole_lock_sha256=sha(root/'package-lock.json'),root_manifest_sha256=sha(root/'package.json'),packages=packages,installed_expo_bundled_version_map=dict(path=bundled.relative_to(root).as_posix(),sha256=sha(bundled),selected={k:expected.get(k) for k in ['@expo/ui','expo-router','expo-sharing','expo-widgets','expo-notifications']}),installed_mapped_pins=pins,reviewed_installed_native_payloads=native,admission='NONE'),indent=2))
