"""Bounded unsigned Simulator execution; every PASS requires an executed command.

This helper qualifies only the normal-staging lane. It never admits an owner,
enables a provider, signs a release, or treats source checks as native execution.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import platform
import plistlib
import re
import shutil
import signal
import stat
import subprocess
import sys
import tarfile
import threading
import time
from datetime import datetime, timezone

BASE = '02aa4ba879fb844f3ca0aa929591203ee45f4163'
BASE_TREE = '02f4b093d399631c4e36b32bf163fa543b61fc3e'
MIB = 1024 * 1024
MAX_APP = 350 * MIB
MAX_EVIDENCE = 500 * MIB
ENVIRONMENT = {
    'APP_VARIANT': 'staging', 'CI': 'true',
    'DEVELOPER_DIR': '/Applications/Xcode_26.4.app/Contents/Developer',
    'EXPO_NO_GIT_STATUS': '1', 'EXPO_NO_TELEMETRY': '1',
    'EXPO_PUBLIC_APP_ENV': 'staging', 'EXPO_PUBLIC_CAMERA_STACK': 'expo-camera',
    'EXPO_PUBLIC_NATIVE_CAMERA_ENABLED': 'true', 'EXPO_PUBLIC_NATIVE_OCR_ENABLED': 'true',
    'EXPO_USE_PRECOMPILED_MODULES': '1', 'IOS_WIDGET_EXTENSION_BUILD_ENABLED': 'false',
    'SENTRY_DISABLE_AUTO_UPLOAD': 'true',
}


def require(value, code):
    if not value:
        raise ValueError('C47_' + code)


def sha(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(MIB), b''):
            digest.update(chunk)
    return digest.hexdigest()


def utc():
    return datetime.now(timezone.utc).isoformat()


def write_json(path, value):
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, indent=2, sort_keys=True) + '\n', encoding='utf-8')
    temporary.replace(path)


def output_text(paths, limit=8 * MIB):
    require(paths[0].stat().st_size <= limit, 'COMMAND_OUTPUT_PARSE_BOUND')
    return paths[0].read_text(encoding='utf-8', errors='strict')


def available_iphone(document):
    """Select only a declared available iOS17+ iPhone, preferring compact models."""
    runtime_by_id = {row['identifier']: row for row in document['runtimes']
                     if row.get('isAvailable') is True and
                     row.get('identifier', '').startswith('com.apple.CoreSimulator.SimRuntime.iOS-') and
                     re.fullmatch(r'\d+(?:\.\d+)*', row.get('version', '')) and
                     int(row['version'].split('.')[0]) >= 17}
    compact = ['iPhone SE (3rd generation)', 'iPhone 16e', 'iPhone 17e',
               'iPhone 16', 'iPhone 17', 'iPhone Air', 'iPhone 17 Pro']
    choices = []
    for runtime_id, devices in document['devices'].items():
        if runtime_id not in runtime_by_id:
            continue
        runtime = runtime_by_id[runtime_id]
        for device in devices:
            if device.get('isAvailable') is not True or not device.get('name', '').startswith('iPhone '):
                continue
            kind = device.get('deviceTypeIdentifier', '')
            if not kind.startswith('com.apple.CoreSimulator.SimDeviceType.iPhone-'):
                continue
            rank = compact.index(device['name']) if device['name'] in compact else len(compact)
            version = tuple(-int(part) for part in runtime['version'].split('.'))
            choices.append(((rank, version, device['name']), runtime, device))
    require(choices, 'NO_AVAILABLE_SUPPORTED_IPHONE_RUNTIME')
    _, runtime, device = min(choices, key=lambda row: row[0])
    return runtime, device


def validate_product(info, description, architectures, build_version, host_arch):
    require(info.get('DTPlatformName') == 'iphonesimulator' and
            info.get('CFBundleSupportedPlatforms') == ['iPhoneSimulator'], 'PRODUCT_PLATFORM')
    bundle = info.get('CFBundleIdentifier', '')
    executable = info.get('CFBundleExecutable', '')
    require(re.fullmatch(r'[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+', bundle), 'PRODUCT_BUNDLE_ID')
    require(re.fullmatch(r'[A-Za-z0-9._ -]+', executable) and executable not in ('.', '..'),
            'PRODUCT_EXECUTABLE_NAME')
    require('Mach-O' in description, 'PRODUCT_MACH_O')
    archs = architectures.strip().split()
    require(archs and set(archs) <= {'arm64', 'x86_64'} and host_arch in archs, 'PRODUCT_ARCHITECTURE')
    require(re.search(r'\bplatform\s+(?:IOSSIMULATOR|7)\b', build_version), 'MACH_O_SIMULATOR_PLATFORM')
    require(re.fullmatch(r'\d+(?:\.\d+)*', str(info.get('MinimumOSVersion', ''))) and
            int(info['MinimumOSVersion'].split('.')[0]) >= 17, 'PRODUCT_MINIMUM_OS')
    return bundle, executable, archs


def bundle_inventory(app):
    rows = []
    app = app.resolve()
    for path in sorted(app.rglob('*')):
        info = path.lstat()
        name = path.relative_to(app).as_posix()
        row = {'path': name, 'mode': oct(stat.S_IMODE(info.st_mode))}
        if stat.S_ISLNK(info.st_mode):
            target = os.readlink(path)
            require(not os.path.isabs(target) and path.resolve().is_relative_to(app), 'APP_EXTERNAL_LINK')
            row.update(type='symlink', target=target,
                       sha256=hashlib.sha256(os.fsencode(target)).hexdigest())
        elif stat.S_ISREG(info.st_mode):
            row.update(type='file', bytes=info.st_size, sha256=sha(path))
        elif stat.S_ISDIR(info.st_mode):
            row.update(type='directory')
        else:
            raise ValueError('C47_APP_SPECIAL_FILE')
        rows.append(row)
    require(rows, 'EMPTY_APP')
    return rows


def evidence_size(root):
    return sum(path.stat().st_size for path in root.rglob('*') if path.is_file())


def generated_package_projection(original, generated):
    before = json.loads(original)
    after = json.loads(generated)
    require(isinstance(before.get('scripts'), dict) and isinstance(after.get('scripts'), dict),
            'GENERATED_PACKAGE_SCRIPTS')
    expected = json.loads(original)
    changed = []
    for name in ['ios', 'android']:
        if after['scripts'].get(name) != before['scripts'].get(name):
            require(before['scripts'].get(name) == 'expo start --' + name and
                    after['scripts'].get(name) == 'expo run:' + name, 'GENERATED_PACKAGE_SCRIPT_DELTA')
            expected['scripts'][name] = after['scripts'][name]
            changed.append(name)
    require(after == expected and changed, 'GENERATED_PACKAGE_NON_SCRIPT_DELTA')
    return {'changed_script_names': changed, 'original_sha256': hashlib.sha256(original).hexdigest(),
            'generated_sha256': hashlib.sha256(generated).hexdigest(),
            'qualification': 'ONLY_EXPO_PREBUILD_SCRIPT_REWRITE_WITH_RAW_PREIMAGE_RETAINED'}


def projected_source_inventory(verifier, root, head, g, generated_raw):
    """Rehash every actual file; allow only the separately authenticated package projection."""
    rows = verifier.tracked_inventory(g('ls-tree', '-r', '-z', '--full-tree', head))
    flags = g('ls-files', '-v', '-z').split(b'\0')[:-1]
    require(all(row[:1] != b'S' and not row[:1].islower() for row in flags), 'HIDDEN_INDEX_FLAGS')
    index = []
    for entry in g('ls-files', '--stage', '-z').split(b'\0')[:-1]:
        header, name = entry.split(b'\t', 1)
        mode, oid, stage = header.decode('ascii').split()
        require(stage == '0', 'SOURCE_INDEX_STAGE')
        index.append((mode, oid, name.decode('utf-8')))
    require(index == rows, 'SOURCE_INDEX_DRIFT')
    fingerprint = hashlib.sha256()
    total = 0
    for mode, oid, name in rows:
        path = root.joinpath(*name.split('/'))
        parents = verifier.directory_chain(path.parent)
        before = path.lstat()
        require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and
                bool(before.st_mode & 0o111) == (mode == '100755'), 'SOURCE_FILE_MODE:' + name)
        blob = hashlib.sha1(b'blob ' + str(before.st_size).encode('ascii') + b'\0')
        content = hashlib.sha256()
        with path.open('rb') as stream:
            require(verifier.opened_file_stamp(os.fstat(stream.fileno())) == verifier.opened_file_stamp(before),
                    'SOURCE_OPEN_RACE:' + name)
            for chunk in iter(lambda: stream.read(MIB), b''):
                blob.update(chunk)
                content.update(chunk)
        require(verifier.file_stamp(path.lstat()) == verifier.file_stamp(before), 'SOURCE_FILE_RACE:' + name)
        verifier.recheck_directories(parents)
        if name == 'apps/mobile/package.json':
            require(content.hexdigest() == hashlib.sha256(generated_raw).hexdigest(), 'GENERATED_PACKAGE_RACE')
        else:
            require(blob.hexdigest() == oid, 'SOURCE_BLOB_DRIFT:' + name)
        total += before.st_size
        fingerprint.update(json.dumps([name, mode, oid, before.st_size, content.hexdigest()],
                                      separators=(',', ':')).encode() + b'\n')
    require(g('rev-parse', 'HEAD').decode().strip() == head, 'SOURCE_HEAD_RACE')
    return {'files': len(rows), 'bytes': total, 'actual_inventory_sha256': fingerprint.hexdigest(),
            'qualification': 'ALL_SOURCE_BYTES_EXACT_EXCEPT_DECLARED_GENERATED_PACKAGE_SCRIPT_PROJECTION'}


def retain_generated_native(ios, output):
    if not ios.is_dir():
        return
    generated = output / 'generated-native'
    generated.mkdir(exist_ok=True)
    rows = []
    selected = []
    total = 0
    for directory, directories, names in os.walk(ios, followlinks=False):
        parent = Path(directory)
        directories[:] = sorted(name for name in directories
                                if name not in ['Pods', 'build', 'xcuserdata', '.git', '.symlinks']
                                and not (parent / name).is_symlink())
        for name in sorted(names):
            path = parent / name
            if path.is_symlink() or not path.is_file():
                continue
            total += path.stat().st_size
            require(total <= 32 * MIB, 'GENERATED_NATIVE_CONFIGURATION_BOUND')
            rows.append({'path': path.relative_to(ios).as_posix(), 'bytes': path.stat().st_size,
                         'sha256': sha(path)})
            selected.append(path)
    with tarfile.open(generated / 'native-configuration.tar.gz', 'w:gz') as archive:
        for path in selected:
            archive.add(path, arcname=path.relative_to(ios).as_posix(), recursive=False)
    write_json(generated / 'native-configuration-inventory.json', {'files': rows, 'bytes': total,
               'exclusions': ['Pods', 'build', 'xcuserdata', '.git', '.symlinks', 'symlinks'],
               'qualification': 'ACTUAL_GENERATED_FIRST_PARTY_NATIVE_CONFIGURATION_NOT_POD_SOURCE'})


def retain_pod_inventory(ios, output):
    """Hash actually installed Pod source without following dependency links."""
    pods = ios / 'Pods'
    require(pods.is_dir() and not pods.is_symlink(), 'INSTALLED_PODS_REQUIRED')
    lock = (ios / 'Podfile.lock').read_bytes()
    require(lock and (pods / 'Manifest.lock').read_bytes() == lock, 'POD_LOCK_MANIFEST_DRIFT')
    native = output / 'generated-native'
    native.mkdir(exist_ok=True)
    shutil.copy2(pods / 'Manifest.lock', native / 'Manifest.lock')
    rows, total = [], 0
    for directory, directories, names in os.walk(pods, followlinks=False):
        parent = Path(directory)
        directories.sort()
        for name in sorted(directories + names):
            path = parent / name
            info = path.lstat()
            row = {'path': path.relative_to(pods).as_posix(), 'mode': oct(stat.S_IMODE(info.st_mode))}
            if stat.S_ISLNK(info.st_mode):
                target = os.readlink(path)
                row.update(type='symlink', target=target, sha256=hashlib.sha256(os.fsencode(target)).hexdigest())
            elif stat.S_ISDIR(info.st_mode):
                row.update(type='directory')
            else:
                require(stat.S_ISREG(info.st_mode), 'POD_SPECIAL_FILE')
                total += info.st_size
                row.update(type='file', bytes=info.st_size, sha256=sha(path))
            rows.append(row)
            require(len(rows) <= 100000 and total <= 8 * 1024 * MIB, 'POD_SOURCE_INVENTORY_BOUND')
    local_specs = pods / 'Local Podspecs'
    if local_specs.is_dir():
        destination = native / 'local-podspecs'
        destination.mkdir(exist_ok=True)
        for spec in sorted(local_specs.glob('*.podspec.json')):
            require(spec.is_file() and not spec.is_symlink() and spec.stat().st_size <= 2 * MIB, 'LOCAL_PODSPEC_FILE')
            shutil.copy2(spec, destination / spec.name)
    write_json(native / 'installed-pod-inventory.json', {'podfile_lock_sha256': hashlib.sha256(lock).hexdigest(),
               'manifest_lock_matches': True, 'files': rows, 'regular_bytes': total,
               'links_followed': False, 'qualification': 'ACTUAL_INSTALLED_POD_INPUT_INVENTORY_NOT_COMPILE_OR_RUNTIME_PROOF'})


class Runner:
    def __init__(self, root, output, seconds=84 * 60):
        self.root = root
        self.output = output
        self.logs = output / 'logs'
        self.logs.mkdir(parents=True)
        self.deadline = time.monotonic() + seconds
        self.env = {key: value for key, value in os.environ.items()
                    if not key.upper().startswith('GIT_')}
        self.env['GIT_OPTIONAL_LOCKS'] = '0'
        self.receipt = {
            'schema': 1, 'campaign': 47, 'started_utc': utc(),
            'status': 'RUNNING', 'commands': [], 'stages': {},
            'lane': 'normal-staging', 'internal_supported_owner': 'NOT_RUN',
            'widget_extension': 'EXCLUDED_BY_EXISTING_SIMULATOR_PROFILE',
            'campaign_candidate_complete': False, 'acceptance_granted': False, 'release': 'NO_GO',
            'limitations': ['Simulator only; no physical iPhone, power-loss, signing, camera/OCR accuracy, provider, clinical, or owner admission'],
        }
        self.persist()

    def persist(self):
        write_json(self.output / 'execution.json', self.receipt)

    def passed(self, stage, details=None):
        self.receipt['stages'][stage] = {'status': 'PASS', 'finished_utc': utc(),
                                         'details': details or {}}
        self.persist()

    def run(self, name, argv, cwd=None, timeout=120, env=None, required=True, diagnostic=False):
        require(re.fullmatch(r'[a-z0-9-]+', name), 'COMMAND_NAME')
        remaining = self.deadline - time.monotonic()
        require(diagnostic or remaining > 0, 'TOTAL_DEADLINE')
        timeout = min(timeout, max(1, remaining)) if not diagnostic else timeout
        prefix = self.logs / ('%03d-%s' % (len(self.receipt['commands']) + 1, name))
        stdout, stderr = Path(str(prefix) + '.stdout'), Path(str(prefix) + '.stderr')
        row = {'name': name, 'argv': list(map(str, argv)), 'cwd': str(cwd or self.root),
               'timeout_seconds': timeout, 'started_utc': utc(), 'required': required,
               'stdout': str(stdout.relative_to(self.output)),
               'stderr': str(stderr.relative_to(self.output)), 'state': 'RUNNING'}
        self.receipt['commands'].append(row)
        self.persist()
        process = None
        try:
            process = subprocess.Popen(list(map(str, argv)), cwd=cwd or self.root,
                                       env=env or self.env, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                       start_new_session=(os.name != 'nt'))
            stream_failures = []
            def copy(pipe, destination, display):
                with destination.open('wb') as target:
                    try:
                        for chunk in iter(lambda: pipe.read(65536), b''):
                            target.write(chunk)
                            if hasattr(display, 'buffer'):
                                display.buffer.write(chunk)
                                display.buffer.flush()
                            else:
                                display.write(chunk.decode('utf-8', errors='replace'))
                                display.flush()
                    except Exception as error:
                        stream_failures.append(type(error).__name__)
            threads = [threading.Thread(target=copy, args=(process.stdout, stdout, sys.stdout), daemon=True),
                       threading.Thread(target=copy, args=(process.stderr, stderr, sys.stderr), daemon=True)]
            for thread in threads:
                thread.start()
            try:
                code = process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                row['timed_out'] = True
                if os.name != 'nt':
                    os.killpg(process.pid, signal.SIGKILL)
                else:
                    process.kill()
                process.wait(timeout=30)
                code = 124
            for thread in threads:
                thread.join(timeout=30)
            require(not any(thread.is_alive() for thread in threads), 'LOG_STREAM_DID_NOT_CLOSE')
            require(not stream_failures, 'LOG_STREAM_FAILURE')
            process.stdout.close()
            process.stderr.close()
            row.update(exit_code=code, state='PASS' if code == 0 else 'FAIL')
        except OSError as error:
            stdout.touch(exist_ok=True)
            stderr.write_text(str(error), encoding='utf-8')
            row.update(exit_code=127, state='FAIL', error_type=type(error).__name__)
        finally:
            row['finished_utc'] = utc()
            for label, path in [('stdout', stdout), ('stderr', stderr)]:
                if path.exists():
                    row[label + '_bytes'] = path.stat().st_size
                    row[label + '_sha256'] = sha(path)
            self.persist()
        require(not required or row.get('exit_code') == 0, 'COMMAND_FAILED:' + name)
        return stdout, stderr

    def text(self, name, argv, **kwargs):
        return output_text(self.run(name, argv, **kwargs)).strip()

    def source_proof(self, name, expected, allow_generation=False):
        # Reuse accepted C46 whole-working-tree verification, without invoking
        # that campaign's ledger/acceptance entrypoint against a new campaign.
        path = self.root / 'scripts/release/full-app-j01/source_completion46.py'
        spec = importlib.util.spec_from_file_location('c47_accepted_source_verifier', path)
        verifier = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(verifier)
        g = lambda *args: verifier.git(*args, root=self.root)
        verifier.check_git_metadata(g, self.root)
        require(g('rev-parse', 'HEAD').decode().strip() == expected, 'SOURCE_HEAD')
        require(g('rev-parse', BASE + '^{tree}').decode().strip() == BASE_TREE, 'ACCEPTED_PARENT_TREE')
        require(g('merge-base', BASE, expected).decode().strip() == BASE, 'ACCEPTED_ANCESTRY')
        status = g('status', '--porcelain', '--untracked-files=normal').decode()
        if allow_generation and status.strip():
            require(status == ' M apps/mobile/package.json\n', 'UNDECLARED_GENERATED_SOURCE_CHANGE')
            original = g('show', expected + ':apps/mobile/package.json')
            generated = (self.root / 'apps/mobile/package.json').read_bytes()
            projection = generated_package_projection(original, generated)
            projection_dir = self.output / 'generation-projection'
            projection_dir.mkdir(exist_ok=True)
            (projection_dir / 'original-package.json').write_bytes(original)
            (projection_dir / 'generated-package.json').write_bytes(generated)
            write_json(projection_dir / 'projection.json', projection)
            proof = projected_source_inventory(verifier, self.root, expected, g, generated)
        else:
            require(not status.strip(), 'TRACKED_OR_UNTRACKED_SOURCE_CHANGE')
            proof = verifier.verify_tracked_source(self.root, expected, g)
        receipt = {'head': expected, 'tree': g('rev-parse', expected + '^{tree}').decode().strip(),
                   'base': BASE, 'base_tree': BASE_TREE, 'inventory': proof,
                   'helper': path.relative_to(self.root).as_posix(), 'helper_sha256': sha(path)}
        write_json(self.output / (name + '.json'), receipt)
        return receipt


def execute(r):
    require(platform.system() == 'Darwin', 'MACOS_REQUIRED')
    head = os.environ.get('C47_EXPECTED_HEAD', '')
    require(re.fullmatch(r'[a-f0-9]{40}', head), 'EXPECTED_HEAD_REQUIRED')
    require(os.environ.get('C47_UI_PHASE') == 'normal-staging', 'NORMAL_STAGING_PHASE_REQUIRED')
    for key, value in ENVIRONMENT.items():
        require(r.env.get(key) == value, 'BUILD_ENVIRONMENT:' + key)
    require(Path(r.env['DEVELOPER_DIR']).is_dir(), 'PINNED_XCODE_UNAVAILABLE')
    r.env['C46_EXPECTED_HEAD'] = head
    r.receipt['source'] = r.source_proof('source-before', head)
    r.passed('source', r.receipt['source'])
    # The first actual hosted run reproduced a broken global npm self-upgrade
    # (MODULE_NOT_FOUND: promise-retry). Reuse the existing reviewed bootstrap
    # pattern: install npm beside the runner tool, without replacing that tool.
    tools_directory = Path(os.environ['RUNNER_TEMP']) / 'c47-reviewed-npm'
    require(not tools_directory.exists(), 'NEW_NPM_TOOL_DIRECTORY_REQUIRED')
    r.text('bootstrap-npm-version', ['npm', '--version'], timeout=30)
    r.run('bootstrap-reviewed-npm', ['npm', 'install', '--prefix', tools_directory,
          'npm@11.20.0', '--ignore-scripts', '--no-audit', '--no-fund'], timeout=180)
    npm_lock = tools_directory / 'package-lock.json'
    lock = json.loads(npm_lock.read_bytes())
    npm_input = lock['packages']['node_modules/npm']
    require(npm_input['version'] == '11.20.0' and
            npm_input['resolved'] == 'https://registry.npmjs.org/npm/-/npm-11.20.0.tgz' and
            npm_input.get('integrity', '').startswith('sha512-'), 'NPM_TOOL_REGISTRY_INPUT')
    require((tools_directory / 'node_modules/.bin/npm').is_file(), 'NPM_TOOL_LAUNCHER')
    r.env['PATH'] = str(tools_directory / 'node_modules/.bin') + os.pathsep + r.env['PATH']
    shutil.copy2(npm_lock, r.output / 'reviewed-npm-package-lock.json')
    write_json(r.output / 'reviewed-npm-input.json', npm_input)
    tools = {}
    for name, argv in [
        ('os', ['sw_vers']), ('architecture', ['uname', '-m']),
        ('node', ['node', '--version']), ('npm', ['npm', '--version']),
        ('ruby', ['ruby', '--version']), ('cocoapods', ['pod', '--version']),
        ('xcode', ['xcodebuild', '-version']), ('sdks', ['xcodebuild', '-showsdks']),
        ('simulator-sdk', ['xcrun', '--sdk', 'iphonesimulator', '--show-sdk-version']),
    ]:
        tools[name] = r.text('tool-' + name, argv, timeout=60)
    require(tools['node'] == 'v22.22.2' and tools['npm'] == '11.20.0', 'NODE_NPM_VERSION')
    require(tools['xcode'].startswith('Xcode 26.4'), 'XCODE_VERSION')
    tools['runner_image'] = {key: os.environ.get(key) for key in ('ImageOS', 'ImageVersion', 'RUNNER_OS', 'RUNNER_ARCH')}
    tools['build_environment'] = ENVIRONMENT
    write_json(r.output / 'toolchain.json', tools)
    r.passed('toolchain', tools)
    r.run('normal-install', ['npm', 'ci', '--no-audit', '--no-fund'], timeout=1000)
    r.run('postinstall-check', ['npm', 'run', 'postinstall:check'], timeout=180)
    r.run('ocr-source-contract', ['npm', 'run', 'cat05:native-ocr-source-contract:test'], timeout=240)
    r.run('existing-workflow-contract', ['npm', 'run', 'phase5:ios-simulator-compile-workflow:test'], timeout=120)
    r.run('current-native46', ['node', 'scripts/release/full-app-j01/native_current46.mjs'], timeout=600)
    r.run('generated47-controls', ['node', '--test', 'scripts/release/full-app-j01/native_generated47.test.mjs'], timeout=120)
    r.run('generated47-properties-controls', ['python3', '-I', '-B', 'scripts/release/full-app-j01/pods_compat47.test.py'], timeout=120)
    source47 = r.output / 'current-generated47-source.json'
    r.run('current-generated47-source', ['node', 'scripts/release/full-app-j01/native_generated47.mjs',
                                       '--phase', 'SOURCE', '--output', source47], timeout=600)
    r.run('dependency-graph', ['npm', 'ls', '--all', '--json', '--long'], timeout=180)
    r.source_proof('source-after-install', head)
    r.passed('installation', {'normal_hooks_executed': True, 'reviewed_native_source': 'CURRENT_SOURCE46_TECHNICAL_ONLY'})
    mobile = r.root / 'apps/mobile'
    r.run('resolved-expo-config', ['npx', '--no-install', 'expo', 'config', '--json'], cwd=mobile, timeout=120)
    r.run('prebuild', ['npx', '--no-install', 'expo', 'prebuild', '--platform', 'ios', '--clean',
                       '--no-install', '--template', '../../node_modules/expo/template.tgz'], cwd=mobile, timeout=300)
    # Preserve any generator mutation before refusing it; never silently reset
    # dependency or package inputs to manufacture a clean-source receipt.
    r.run('generated-source-diff', ['git', '--no-replace-objects', 'diff', '--binary', 'HEAD'], timeout=60)
    r.source_proof('source-after-prebuild', head, allow_generation=True)
    ios = mobile / 'ios'
    require(ios.is_dir(), 'NATIVE_PROJECT_MISSING')
    compatibility47 = r.output / 'generated-compat47'
    r.run('generated47-exact-properties', ['python3', '-I', '-B',
          'scripts/release/full-app-j01/pods_compat47.py', '--ios-directory', ios,
          '--source-proof', source47, '--output', compatibility47], timeout=120)
    r.run('current-generated47-native', ['node', 'scripts/release/full-app-j01/native_generated47.mjs',
          '--phase', 'GENERATED', '--source-proof', source47, '--receipt', compatibility47 / 'receipt.json',
          '--output', r.output / 'current-generated47.json'], timeout=600)
    r.source_proof('source-after-generated47', head, allow_generation=True)
    r.run('pods', ['pod', 'install', '--project-directory=ios'], cwd=mobile, timeout=1200)
    retain_pod_inventory(ios, r.output)
    r.run('current-generated47-resolved', ['node', 'scripts/release/full-app-j01/native_generated47.mjs',
          '--phase', 'RESOLVED', '--source-proof', source47, '--receipt', compatibility47 / 'receipt.json',
          '--output', r.output / 'current-generated47-resolved.json'], timeout=600)
    r.source_proof('source-after-pods', head, allow_generation=True)
    retain_generated_native(ios, r.output)
    require(re.search(r'^  - NativeLabelOcr \(1\.0\.0\)', (ios / 'Podfile.lock').read_text(), re.M),
            'NATIVE_OCR_NOT_AUTOLINKED')
    native = r.output / 'generated-native'
    native.mkdir(exist_ok=True)
    for name in ['Podfile', 'Podfile.lock', 'Podfile.properties.json']:
        require((ios / name).is_file(), 'GENERATED_INPUT_MISSING:' + name)
        shutil.copy2(ios / name, native / name)
    workspaces = list(ios.glob('*.xcworkspace'))
    require(len(workspaces) == 1, 'WORKSPACE_COUNT')
    workspace = workspaces[0]
    scheme = workspace.stem
    r.run('native-build-settings', ['xcodebuild', '-workspace', workspace, '-scheme', scheme,
                                   '-configuration', 'Release', '-sdk', 'iphonesimulator', '-showBuildSettings'], timeout=120)
    r.passed('native-generation', {'workspace': str(workspace), 'scheme': scheme,
                                   'inputs': {p.name: sha(p) for p in native.iterdir() if p.is_file()}})
    products = Path(os.environ['RUNNER_TEMP']) / 'c47-native-products'
    products.mkdir(exist_ok=False)
    derived = products / 'derived'
    unsigned = ['CODE_SIGNING_ALLOWED=NO', 'CODE_SIGNING_REQUIRED=NO', 'CODE_SIGN_IDENTITY=',
                'COMPILER_INDEX_STORE_ENABLE=NO']
    r.run('native-build', ['xcodebuild', '-workspace', workspace, '-scheme', scheme,
                          '-configuration', 'Release', '-sdk', 'iphonesimulator',
                          '-destination', 'generic/platform=iOS Simulator', '-derivedDataPath', derived,
                          '-resultBundlePath', products / 'build.xcresult', *unsigned, 'build'], timeout=3000)
    r.source_proof('source-after-build', head, allow_generation=True)
    apps = list((derived / 'Build/Products/Release-iphonesimulator').glob('*.app'))
    require(len(apps) == 1, 'PRODUCT_COUNT')
    app = apps[0]
    with (app / 'Info.plist').open('rb') as stream:
        info = plistlib.load(stream)
    executable_name = info.get('CFBundleExecutable', '')
    require(re.fullmatch(r'[A-Za-z0-9._ -]+', executable_name) and executable_name not in ('.', '..'), 'PRODUCT_EXECUTABLE_NAME')
    binary = app / executable_name
    description = r.text('product-file', ['file', binary])
    architectures = r.text('product-architectures', ['lipo', '-archs', binary])
    build_version = r.text('product-build-version', ['xcrun', 'vtool', '-show-build', binary])
    bundle, executable_name, archs = validate_product(info, description, architectures, build_version, tools['architecture'])
    inventory = bundle_inventory(app)
    write_json(r.output / 'app-inventory.json', {'source': r.receipt['source'], 'files': inventory})
    shutil.copy2(app / 'Info.plist', native / 'app-Info.plist')
    archive = products / 'unsigned-simulator-app.tar.gz'
    with tarfile.open(archive, 'w:gz', dereference=False) as target:
        target.add(app, arcname=app.name)
    archive_receipt = {'file': archive.name, 'bytes': archive.stat().st_size, 'sha256': sha(archive),
                       'inventory_sha256': sha(r.output / 'app-inventory.json'), 'source_head': head,
                       'bundle_id': bundle, 'executable': executable_name, 'architectures': archs,
                       'platform': 'iOS Simulator', 'not_an_iphone_or_testflight_release': True}
    write_json(r.output / 'app-artifact.json', archive_receipt)
    require(archive.stat().st_size <= MAX_APP, 'APP_ARTIFACT_SIZE_BOUND')
    shutil.copy2(archive, r.output / archive.name)
    r.passed('compiled', archive_receipt)
    simulator_document = json.loads(r.text('simulator-inventory', ['xcrun', 'simctl', 'list', '--json']))
    runtime, template = available_iphone(simulator_document)
    device = r.text('simulator-create', ['xcrun', 'simctl', 'create', 'C47-' + head[:12],
                                       template['deviceTypeIdentifier'], runtime['identifier']])
    require(re.fullmatch(r'[0-9A-Fa-f-]{36}', device), 'SIMULATOR_UDID')
    r.receipt['simulator'] = {'udid': device, 'runtime': runtime, 'template': template,
                              'selection': 'Compact-first among actually available iPhone/runtime pairs; fresh controlled device'}
    r.persist()
    r.run('simulator-boot', ['xcrun', 'simctl', 'boot', device], timeout=60)
    r.run('simulator-bootstatus', ['xcrun', 'simctl', 'bootstatus', device, '-b'], timeout=240)
    r.run('simulator-install', ['xcrun', 'simctl', 'install', device, app], timeout=120)
    r.passed('installed', {'udid': device, 'bundle_id': bundle})
    launch = r.text('simulator-launch', ['xcrun', 'simctl', 'launch', device, bundle], timeout=60)
    match = re.fullmatch(re.escape(bundle) + r': ([1-9][0-9]*)', launch)
    require(match, 'LAUNCH_PID')
    pid = int(match.group(1))
    launched_at = time.monotonic()
    for index, delay in enumerate([1, 3, 8, 15, 30]):
        remaining = launched_at + delay - time.monotonic()
        if remaining > 0:
            time.sleep(remaining)
        table = r.text('process-survival-' + str(index), ['xcrun', 'simctl', 'spawn', device,
                                                         'launchctl', 'list'], timeout=20)
        require(any(line.split() and line.split()[0] == str(pid) and bundle in line
                    for line in table.splitlines()), 'APP_PROCESS_DID_NOT_SURVIVE')
    r.run('normal-launch-screenshot', ['xcrun', 'simctl', 'io', device, 'screenshot',
                                     r.output / 'normal-launch.png'], timeout=30)
    r.passed('launched', {'pid': pid, 'survival_seconds': 30, 'bundle_id': bundle})
    ui = r.output / 'ui'
    ui.mkdir()
    ui_env = dict(r.env, C47_BUNDLE_ID=bundle, C47_RUNTIME_LANE='normal-staging')
    r.run('generate-native-ui-runner', ['ruby', r.root / 'scripts/release/full-app-j01/native_ui47.rb', ios, ui],
          env=ui_env, timeout=120)
    ui_receipt = json.loads((ui / 'runner.json').read_text())
    project = Path(ui_receipt['project'])
    require(ui_receipt.get('lane') == 'normal-staging' and ui_receipt.get('bundle_id') == bundle and
            ui_receipt.get('scheme') == 'C47NativeUI' and project.is_dir() and
            project.resolve().is_relative_to(ui.resolve()), 'UI_RUNNER_IDENTITY')
    r.run('native-normal-staging-ui', ['xcodebuild', 'test', '-project', project,
                                     '-scheme', ui_receipt['scheme'], '-destination', 'id=' + device,
                                     '-parallel-testing-enabled', 'NO',
                                     '-maximum-concurrent-test-simulator-destinations', '1',
                                     '-test-timeouts-enabled', 'YES',
                                     '-default-test-execution-time-allowance', '300',
                                     '-maximum-test-execution-time-allowance', '300',
                                     '-resultBundlePath', products / 'ui.xcresult', *unsigned],
          env=ui_env, timeout=900)
    r.passed('normal-staging-ui', {'tests': ui_receipt['tests'], 'lane': 'normal-staging',
                                  'qualification': 'Only the actually executed named XCTest cases'})
    r.source_proof('source-after-runtime', head, allow_generation=True)
    r.receipt['status'] = 'NORMAL_STAGING_NATIVE_EXECUTED_SUPPORTED_OWNER_NOT_RUN'
    r.receipt['finished_utc'] = utc()
    r.persist()


def collect(r):
    """Best-effort diagnostics cannot manufacture a runtime stage PASS."""
    device = r.receipt.get('simulator', {}).get('udid')
    if device:
        r.run('simulator-diagnostics', ['xcrun', 'simctl', 'spawn', device, 'log', 'show',
                                      '--last', '15m', '--style', 'json', '--predicate',
                                      'process CONTAINS "Layerwell" OR process CONTAINS "C47NativeUI"'],
              timeout=60, required=False, diagnostic=True)
        r.run('simulator-final-devices', ['xcrun', 'simctl', 'list', 'devices', '--json'],
              timeout=30, required=False, diagnostic=True)
        r.run('simulator-final-screenshot', ['xcrun', 'simctl', 'io', device, 'screenshot',
                                            r.output / 'final-simulator.png'],
              timeout=30, required=False, diagnostic=True)
        r.run('simulator-shutdown', ['xcrun', 'simctl', 'shutdown', device],
              timeout=30, required=False, diagnostic=True)
    temporary = os.environ.get('RUNNER_TEMP')
    if temporary:
        products = Path(temporary) / 'c47-native-products'
        for name in ['build.xcresult', 'ui.xcresult']:
            source = products / name
            if source.is_dir():
                size = evidence_size(source)
                if size + evidence_size(r.output) <= MAX_EVIDENCE - 10 * MIB:
                    shutil.copytree(source, r.output / name)
                else:
                    r.receipt.setdefault('diagnostic_limits', []).append(
                        {'path': name, 'bytes': size, 'state': 'NOT_COPIED_EVIDENCE_SIZE_BOUND'})
    ios = r.root / 'apps/mobile/ios'
    retain_generated_native(ios, r.output)
    generated = r.output / 'generated-native'
    for name in ['Podfile', 'Podfile.lock', 'Podfile.properties.json']:
        path = ios / name
        if path.is_file() and path.stat().st_size <= 10 * MIB:
            generated.mkdir(exist_ok=True)
            shutil.copy2(path, generated / name)
    reports = Path.home() / 'Library/Logs/DiagnosticReports'
    if reports.is_dir():
        crashes = r.output / 'crashes'
        for path in reports.glob('*'):
            if path.is_file() and path.name.startswith(('Layerwell', 'C47NativeUI')) and path.stat().st_size <= 10 * MIB:
                crashes.mkdir(exist_ok=True)
                shutil.copy2(path, crashes / path.name)
    size = evidence_size(r.output)
    policy = {'maximum_bytes': MAX_EVIDENCE, 'observed_bytes_before_policy': size,
              'upload_within_limit': size <= MAX_EVIDENCE - MIB, 'app_archive_maximum_bytes': MAX_APP}
    r.receipt['artifact_policy'] = policy
    r.persist()
    write_json(r.output / 'artifact-policy.json', policy)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[3]
    output = args.output.absolute()
    require(not output.resolve().is_relative_to(root), 'OUTPUT_IN_SOURCE')
    require(not output.exists() or output.is_dir() and not any(output.iterdir()), 'OUTPUT_NOT_EMPTY')
    output.mkdir(parents=True, exist_ok=True)
    runner = Runner(root, output)
    code = 0
    try:
        execute(runner)
    except Exception as error:
        code = 1
        runner.receipt.update(status='PARTIAL_BLOCKED', failure={'type': type(error).__name__, 'detail': str(error)},
                              finished_utc=utc())
        runner.persist()
        print('C47_EXECUTION_FAILED: ' + str(error), file=sys.stderr)
    finally:
        try:
            collect(runner)
        except Exception as error:
            code = 1
            runner.receipt['collection_failure'] = {'type': type(error).__name__, 'detail': str(error)}
            runner.persist()
    if not runner.receipt.get('artifact_policy', {}).get('upload_within_limit'):
        code = 1
    print(json.dumps({'status': runner.receipt['status'], 'stages': list(runner.receipt['stages']),
                      'campaign_candidate_complete': False, 'release': 'NO_GO'}))
    return code


if __name__ == '__main__':
    raise SystemExit(main())
