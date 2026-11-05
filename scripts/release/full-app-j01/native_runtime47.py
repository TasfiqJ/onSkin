"""Bounded unsigned Simulator execution; every PASS requires an executed command.

This helper qualifies only the normal-staging lane. It never admits an owner,
enables a provider, signs a release, or treats source checks as native execution.
"""
import argparse
from contextlib import contextmanager
import gzip
import socket
from urllib.error import URLError
from urllib.parse import urlsplit
from urllib.request import build_opener, ProxyHandler, Request
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
import uuid
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


PROVIDER_KEYS = (
    'EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME',
    'EXPO_PUBLIC_TURNSTILE_SITE_KEY', 'EXPO_PUBLIC_REVENUECAT_IOS_KEY', 'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY',
    'EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY', 'EXPO_PUBLIC_POSTHOG_KEY', 'EXPO_PUBLIC_SENTRY_DSN',
    'SENTRY_ORG', 'SENTRY_PROJECT', 'SENTRY_AUTH_TOKEN',
)

UNSIGNED = ['CODE_SIGNING_ALLOWED=NO', 'CODE_SIGNING_REQUIRED=NO', 'CODE_SIGN_IDENTITY=',
            'COMPILER_INDEX_STORE_ENABLE=NO']
SIMULATOR_BUILD_FLAGS = [*UNSIGNED, 'ARCHS=x86_64']


def require(value, code):
    if not value:
        raise ValueError('C47_' + code)


def require_simulator_host(architecture):
    require(architecture == 'x86_64', 'INTEL_SIMULATOR_HOST_REQUIRED')


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


NORMAL_UI_CASE = 'testNormalStagingAgeConsentAndUnavailableAccount'
INTERNAL_UI_CASES = (
    'test01CoreRetainedNativeJourney', 'test02LocalExport', 'test05ConsentWithdrawal',
    'test03LargerTextManualInput', 'test04RemoveSyntheticLocalExport',
)


def selected_xctest_summary(text, test_class, method):
    """An exit code or suite-only count cannot establish the selected XCTest."""
    normal = test_class == 'C47NativeUI' and method == NORMAL_UI_CASE
    require(normal or (test_class == 'C47InternalOwnerUI' and method in INTERNAL_UI_CASES),
            'XCTEST_SELECTED_CASE_REQUIRED')
    scope = 'NORMAL' if normal else 'INTERNAL'
    accepted = {'-[' + test_class + ' ' + method + ']',
                '-[C47NativeUI.' + test_class + ' ' + method + ']'}
    accepted.update(prefix + method + '()' for prefix in
                    [test_class + '.', test_class + '/', 'C47NativeUI.' + test_class + '.',
                     'C47NativeUI.' + test_class + '/', 'C47NativeUI/' + test_class + '/'])
    events = re.findall(r"\bTest\s*case\s+['\"]([^'\"]+)['\"]\s+(passed|failed|skipped)\b", text, re.I)
    require(events and all(name in accepted and state.lower() == 'passed' for name, state in events),
            scope + '_XCTEST_NAMED_PASS_REQUIRED_NO_FAILURE_SKIP_OR_UNKNOWN_CASE')
    counts = re.findall(r'\bExecuted\s+(\d+)\s+tests?,\s+with\s+(\d+)\s+failures?', text, re.I)
    require(counts and all(int(executed) == 1 and int(failed) == 0 for executed, failed in counts) and
            not re.search(r'\b[1-9]\d*\s+(?:tests?\s+)?skipped\b|\bTest\s+Suite[^\n]*\bfailed\b', text, re.I),
            scope + '_XCTEST_EXECUTED_ONE_FAILED_ZERO_SKIPPED_ZERO_REQUIRED')
    return {'expected_case': test_class + '/' + method, 'executed': 1, 'failed': 0, 'skipped': 0,
            'named_pass_event_count': len(events), 'summary_count': len(counts),
            'qualification': 'ACTUAL_NAMED_XCTEST_PASS_AND_CLEAN_EXECUTION_SUMMARY; ZERO_TESTS_REFUSED'}


def normal_xctest_summary(text):
    return selected_xctest_summary(text, 'C47NativeUI', NORMAL_UI_CASE)


def selected_ui_log_proof(r, paths, test_class, method):
    raw = [read_native_file(path) for path in paths]
    result = selected_xctest_summary(b'\n'.join(raw).decode('utf-8'), test_class, method)
    result.update(stdout_sha256=hashlib.sha256(raw[0]).hexdigest(),
                  stderr_sha256=hashlib.sha256(raw[1]).hexdigest(), source_head=r.receipt['source']['head'])
    return result


def normal_ui_log_proof(r, paths):
    return selected_ui_log_proof(r, paths, 'C47NativeUI', NORMAL_UI_CASE)


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

    @contextmanager
    def background(self, name, argv, cwd):
        require(time.monotonic() < self.deadline, 'TOTAL_DEADLINE')
        stdout, stderr = self.logs / (name + '.stdout'), self.logs / (name + '.stderr')
        row = {'name': name, 'argv': list(map(str, argv)), 'cwd': str(cwd), 'started_utc': utc(),
               'state': 'RUNNING', 'managed_background': True, 'stdout': str(stdout.relative_to(self.output)),
               'stderr': str(stderr.relative_to(self.output))}
        self.receipt['commands'].append(row)
        self.persist()
        process = None
        with stdout.open('wb') as out, stderr.open('wb') as err:
            try:
                process = subprocess.Popen(list(map(str, argv)), cwd=cwd, env=self.env,
                    stdout=out, stderr=err, start_new_session=(os.name != 'nt'))
                row['pid'] = process.pid
                self.persist()
                yield process
                require(process.poll() is None, 'BACKGROUND_EXITED_EARLY:' + name)
            finally:
                if process is not None:
                    running = process.poll() is None
                    if running:
                        if os.name != 'nt':
                            os.killpg(process.pid, signal.SIGTERM)
                        else:
                            process.terminate()
                        try:
                            process.wait(timeout=10)
                        except subprocess.TimeoutExpired:
                            if os.name != 'nt':
                                os.killpg(process.pid, signal.SIGKILL)
                            else:
                                process.kill()
                            process.wait(timeout=10)
                    row.update(exit_code=process.returncode, intentional_teardown=running,
                               state='STOPPED' if running else 'FAIL')
                else:
                    row.update(exit_code=127, state='FAIL')
                out.flush()
                err.flush()
                row.update(finished_utc=utc(), stdout_bytes=stdout.stat().st_size, stderr_bytes=stderr.stat().st_size,
                           stdout_sha256=sha(stdout), stderr_sha256=sha(stderr))
                self.persist()


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
        ('disk', ['df', '-k', r.output]),
        ('node', ['node', '--version']), ('npm', ['npm', '--version']),
        ('ruby', ['ruby', '--version']), ('cocoapods', ['pod', '--version']),
        ('xcodeproj', ['ruby', '-rxcodeproj', '-e', 'puts Xcodeproj::VERSION']),
        ('swift', ['xcrun', 'swiftc', '--version']),
        ('xcode', ['xcodebuild', '-version']), ('sdks', ['xcodebuild', '-showsdks']),
        ('simulator-sdk', ['xcrun', '--sdk', 'iphonesimulator', '--show-sdk-version']),
    ]:
        tools[name] = r.text('tool-' + name, argv, timeout=60)
    require(tools['node'] == 'v22.22.2' and tools['npm'] == '11.20.0', 'NODE_NPM_VERSION')
    require(tools['xcode'].startswith('Xcode 26.4'), 'XCODE_VERSION')
    require_simulator_host(tools['architecture'])
    tools['simulator_build_flags'] = SIMULATOR_BUILD_FLAGS
    tools['runner_image'] = {key: os.environ.get(key) for key in ('ImageOS', 'ImageVersion', 'RUNNER_OS', 'RUNNER_ARCH')}
    tools['build_environment'] = ENVIRONMENT
    write_json(r.output / 'toolchain.json', tools)
    r.passed('toolchain', tools)
    r.run('normal-install', ['npm', 'ci', '--no-audit', '--no-fund'], timeout=1000)
    r.run('postinstall-check', ['npm', 'run', 'postinstall:check'], timeout=180)
    r.run('swift-behavior47', ['python3', '-I', '-B',
          'scripts/release/full-app-j01/swift_behavior47.py', '--output', r.output / 'swift-behavior47'], timeout=120)
    r.run('ocr-source-contract', ['npm', 'run', 'cat05:native-ocr-source-contract:test'], timeout=240)
    r.run('existing-workflow-contract', ['npm', 'run', 'phase5:ios-simulator-compile-workflow:test'], timeout=120)
    r.run('generated47-controls', ['node', '--test', 'scripts/release/full-app-j01/native_generated47.test.mjs'], timeout=900)
    r.run('generated47-properties-controls', ['python3', '-I', '-B', 'scripts/release/full-app-j01/pods_compat47.test.py'], timeout=120)
    source47 = r.output / 'current-generated47-source.json'
    r.run('current-generated47-source', ['node', 'scripts/release/full-app-j01/native_generated47.mjs',
                                       '--phase', 'SOURCE', '--output', source47], timeout=600)
    r.run('dependency-graph', ['npm', 'ls', '--all', '--json', '--long'], timeout=180)
    r.source_proof('source-after-install', head)
    r.passed('installation', {'normal_hooks_executed': True, 'reviewed_native_source': 'CURRENT_SOURCE47_TECHNICAL_ONLY'})
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
    r.run('pods', ['pod', 'install'], cwd=ios, timeout=1200)
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
                                   '-configuration', 'Release', '-sdk', 'iphonesimulator', *SIMULATOR_BUILD_FLAGS, '-showBuildSettings'], timeout=120)
    r.passed('native-generation', {'workspace': str(workspace), 'scheme': scheme,
                                   'inputs': {p.name: sha(p) for p in native.iterdir() if p.is_file()}})
    products = Path(os.environ['RUNNER_TEMP']) / 'c47-native-products'
    products.mkdir(exist_ok=False)
    derived = products / 'derived'
    r.run('native-build', ['xcodebuild', '-workspace', workspace, '-scheme', scheme,
                          '-configuration', 'Release', '-sdk', 'iphonesimulator',
                          '-destination', 'generic/platform=iOS Simulator', '-derivedDataPath', derived,
                          '-resultBundlePath', products / 'build.xcresult', *SIMULATOR_BUILD_FLAGS, 'build'], timeout=3000)
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
    ui_paths = r.run('native-normal-staging-ui', ['xcodebuild', 'test', '-project', project,
                                     '-scheme', ui_receipt['scheme'], '-destination', 'id=' + device,
                                     '-parallel-testing-enabled', 'NO',
                                     '-maximum-concurrent-test-simulator-destinations', '1',
                                     '-test-timeouts-enabled', 'YES',
                                     '-default-test-execution-time-allowance', '300',
                                     '-maximum-test-execution-time-allowance', '300',
                                     '-resultBundlePath', products / 'ui.xcresult', *SIMULATOR_BUILD_FLAGS],
          env=ui_env, timeout=900)
    positive_xctest = normal_ui_log_proof(r, ui_paths)
    r.passed('normal-staging-ui', {'tests': ui_receipt['tests'], 'lane': 'normal-staging',
                                  'positive_xctest': positive_xctest,
                                  'qualification': 'Only the actually executed named XCTest cases'})
    r.source_proof('source-after-runtime', head, allow_generation=True)
    r.receipt['status'] = 'NORMAL_STAGING_NATIVE_EXECUTED_SUPPORTED_OWNER_NOT_RUN'
    r.receipt['finished_utc'] = utc()
    r.persist()


def internal_environment(environment):
    require(all(not environment.get(key) for key in PROVIDER_KEYS), 'INTERNAL_PROVIDER_CONFIGURATION_FORBIDDEN')
    require(environment.get('EXPO_PUBLIC_CUSTOM_PRO_GRANT_ENABLED', 'false') == 'false', 'INTERNAL_PRO_GRANT_FORBIDDEN')
    require(not any(value for key, value in environment.items() if key.startswith('EXPO_PUBLIC_E2E_')),
            'UNDECLARED_E2E_FIXTURE')
    return dict(environment, APP_VARIANT='development', EXPO_PUBLIC_APP_ENV='development',
                EXPO_PUBLIC_E2E_FIRST_SESSION_AUTH='anonymous_owner', EXPO_PUBLIC_CUSTOM_PRO_GRANT_ENABLED='false',
                C47_UI_PHASE='internal-supported-owner', C47_RUNTIME_LANE='internal-supported-owner',
                EXPO_NO_DOTENV='1', EXPO_OFFLINE='1', NODE_ENV='development',
                EXPO_PACKAGER_PROXY_URL='http://127.0.0.1:8081', REACT_NATIVE_PACKAGER_HOSTNAME='127.0.0.1')


def localhost_url(url):
    parsed = urlsplit(url)
    require(parsed.scheme == 'http' and parsed.hostname in ['127.0.0.1', 'localhost'] and
            parsed.port == 8081 and not parsed.username and not parsed.password, 'INTERNAL_LOCALHOST_URL_REQUIRED')
    return url


def retain_app(r, app, products, head, architecture, configuration, lane):
    with (app / 'Info.plist').open('rb') as stream:
        info = plistlib.load(stream)
    executable_name = info.get('CFBundleExecutable', '')
    require(re.fullmatch(r'[A-Za-z0-9._ -]+', executable_name) and executable_name not in ('.', '..'),
            'PRODUCT_EXECUTABLE_NAME')
    binary = app / executable_name
    bundle, executable_name, archs = validate_product(info,
        r.text('product-file', ['file', binary]),
        r.text('product-architectures', ['lipo', '-archs', binary]),
        r.text('product-build-version', ['xcrun', 'vtool', '-show-build', binary]), architecture)
    write_json(r.output / 'app-inventory.json', {'source': r.receipt['source'], 'lane': lane,
                                               'configuration': configuration, 'files': bundle_inventory(app)})
    native = r.output / 'generated-native'
    native.mkdir(exist_ok=True)
    shutil.copy2(app / 'Info.plist', native / 'app-Info.plist')
    name = 'unsigned-simulator-app.tar.gz' if lane == 'normal-staging' else 'internal-debug-simulator-app.tar.gz'
    archive = products / name
    with tarfile.open(archive, 'w:gz', dereference=False) as target:
        target.add(app, arcname=app.name)
    receipt = {'file': name, 'bytes': archive.stat().st_size, 'sha256': sha(archive),
               'inventory_sha256': sha(r.output / 'app-inventory.json'), 'source_head': head,
               'bundle_id': bundle, 'executable': executable_name, 'architectures': archs,
               'platform': 'iOS Simulator', 'lane': lane, 'configuration': configuration,
               'standalone_embedded_javascript': configuration == 'Release',
               'not_an_iphone_or_testflight_release': True}
    write_json(r.output / 'app-artifact.json', receipt)
    require(archive.stat().st_size <= MAX_APP, 'APP_ARTIFACT_SIZE_BOUND')
    limit_root = getattr(r, 'evidence_root', r.output)
    require(evidence_size(limit_root) + archive.stat().st_size <= MAX_EVIDENCE - 48 * MIB,
            'COMBINED_APP_EVIDENCE_SIZE_BOUND')
    shutil.copy2(archive, r.output / name)
    return bundle, executable_name, receipt


def launch_and_verify(r, device, bundle, arguments=()):
    launch = r.text('simulator-launch', ['xcrun', 'simctl', 'launch', device, bundle, *arguments], timeout=60)
    match = re.fullmatch(re.escape(bundle) + r': ([1-9][0-9]*)', launch)
    require(match, 'LAUNCH_PID')
    pid = int(match.group(1))
    launched_at = time.monotonic()
    for index, delay in enumerate([1, 3, 8, 15, 30]):
        time.sleep(max(0, launched_at + delay - time.monotonic()))
        table = r.text('process-survival-' + str(index), ['xcrun', 'simctl', 'spawn', device,
                                                         'launchctl', 'list'], timeout=20)
        require(any(line.split() and line.split()[0] == str(pid) and bundle in line
                    for line in table.splitlines()), 'APP_PROCESS_DID_NOT_SURVIVE')
    return pid


def native_ui(r, ios, products, device, bundle, lane, initial_url=None, method=None):
    if lane == 'internal-supported-owner':
        require(method in INTERNAL_UI_CASES, 'INTERNAL_TEST_SELECTION')
    ui = r.output / 'ui'
    ui_env = dict(r.env, C47_BUNDLE_ID=bundle, C47_RUNTIME_LANE=lane, C47_UI_PHASE=lane)
    if initial_url:
        ui_env['C47_INITIAL_URL'] = localhost_url(initial_url)
    if r.env.get('C47_EXPORT_FOLDER'):
        ui_env['C47_EXPORT_FOLDER'] = r.env['C47_EXPORT_FOLDER']
    if not ui.exists():
        ui.mkdir()
        r.run('generate-native-ui-runner', ['ruby', r.root / 'scripts/release/full-app-j01/native_ui47.rb', ios, ui],
              env=ui_env, timeout=120)
    receipt = json.loads((ui / 'runner.json').read_text())
    project = Path(receipt['project'])
    test_class = 'C47NativeUI' if lane == 'normal-staging' else 'C47InternalOwnerUI'
    require(receipt.get('lane') == lane and receipt.get('bundle_id') == bundle and
            receipt.get('scheme') == 'C47NativeUI' and receipt.get('selected_test_class') == test_class and
            project.is_dir() and project.resolve().is_relative_to(ui.resolve()), 'UI_RUNNER_IDENTITY')
    if lane == 'internal-supported-owner':
        require(receipt.get('export_folder') == r.env.get('C47_EXPORT_FOLDER'), 'EXPORT_UI_SCHEME_FOLDER_BINDING')
    selected = 'C47NativeUI/' + test_class
    suffix = ''
    if method:
        require(lane == 'internal-supported-owner' and method in INTERNAL_UI_CASES, 'INTERNAL_TEST_SELECTION')
        selected += '/' + method
        require(selected in receipt['tests'], 'INTERNAL_TEST_RECEIPT')
        suffix = {'test01CoreRetainedNativeJourney': '-core', 'test02LocalExport': '-export',
                  'test05ConsentWithdrawal': '-rights', 'test04RemoveSyntheticLocalExport': '-export-cleanup',
                  'test03LargerTextManualInput': '-larger-text'}[method]
    allowance = '300' if lane == 'normal-staging' else '900'
    paths = r.run('native-' + lane + '-ui' + suffix, ['xcodebuild', 'test', '-project', project,
          '-scheme', receipt['scheme'], '-destination', 'id=' + device,
          '-only-testing:' + selected, '-parallel-testing-enabled', 'NO',
          '-maximum-concurrent-test-simulator-destinations', '1', '-test-timeouts-enabled', 'YES',
          '-default-test-execution-time-allowance', allowance, '-maximum-test-execution-time-allowance', allowance,
          '-resultBundlePath', products / ('ui' + suffix + '.xcresult'), *SIMULATOR_BUILD_FLAGS], env=ui_env, timeout=1200)
    positive_xctest = selected_ui_log_proof(r, paths, test_class, method or NORMAL_UI_CASE)
    r.passed(lane + '-ui' + suffix, {'tests': [selected] if method else receipt['tests'], 'lane': lane,
                           'positive_xctest': positive_xctest,
                           'qualification': 'Only the actually executed named XCTest case'})


def retain_result_bundles(r):
    temporary = os.environ.get('RUNNER_TEMP')
    if not temporary:
        return
    products = Path(r.receipt.get('products_directory', str(Path(temporary) / 'c47-native-products')))
    for name in ['build.xcresult', 'ui.xcresult', 'ui-core.xcresult', 'ui-rights.xcresult',
                 'ui-export.xcresult', 'ui-export-cleanup.xcresult',
                 'ui-larger-text.xcresult']:
        source = products / name
        destination = r.output / name
        if source.is_dir() and not destination.exists():
            size = evidence_size(source)
            if size + evidence_size(getattr(r, 'evidence_root', r.output)) <= MAX_EVIDENCE - 10 * MIB:
                shutil.copytree(source, destination)
            else:
                r.receipt.setdefault('diagnostic_limits', []).append(
                    {'path': name, 'bytes': size, 'state': 'NOT_COPIED_EVIDENCE_SIZE_BOUND'})


def metro_ready_and_bundle(r, process, bundle):
    opener = build_opener(ProxyHandler({}))
    ready_deadline = min(r.deadline, time.monotonic() + 120)
    ready = False
    while time.monotonic() < ready_deadline:
        require(process.poll() is None, 'METRO_EXITED_BEFORE_READY')
        try:
            with opener.open('http://127.0.0.1:8081/status', timeout=2) as response:
                ready = response.status == 200 and response.read(1024) == b'packager-status:running'
        except (URLError, OSError):
            pass
        if ready:
            break
        time.sleep(0.5)
    require(ready, 'LOCALHOST_METRO_NOT_READY')
    request = Request('http://127.0.0.1:8081', headers={
        'Expo-Platform': 'ios', 'Accept': 'application/expo+json,application/json',
        'Expo-Updates-Environment': 'DEVELOPMENT'})
    with opener.open(request, timeout=min(120, max(1, r.deadline - time.monotonic()))) as response:
        raw = response.read(2 * MIB + 1)
    require(len(raw) <= 2 * MIB, 'METRO_MANIFEST_BOUND')
    manifest = json.loads(raw)
    config = manifest['extra']['expoClient']
    require(config['extra']['appVariant'] == 'development' and
            config['extra']['appEnvironment'] == 'development' and
            config['ios']['bundleIdentifier'] == bundle, 'INTERNAL_MANIFEST_PROFILE_IDENTITY')
    (r.output / 'metro-manifest.json').write_bytes(raw)
    asset_url = localhost_url(manifest['launchAsset']['url'])
    asset = r.output / 'metro-debug-javascript.bundle.gz'
    digest = hashlib.sha256()
    size = 0
    with opener.open(asset_url, timeout=min(180, max(1, r.deadline - time.monotonic()))) as response:
        with gzip.open(asset, 'wb') as target:
            while True:
                require(time.monotonic() < r.deadline, 'TOTAL_DEADLINE')
                chunk = response.read(MIB)
                if not chunk:
                    break
                size += len(chunk)
                require(size <= 128 * MIB, 'METRO_BUNDLE_BOUND')
                digest.update(chunk)
                target.write(chunk)
    require(size > 0 and evidence_size(r.evidence_root) <= MAX_EVIDENCE - 32 * MIB,
            'METRO_BUNDLE_EVIDENCE_BOUND')
    receipt = {'manifest_sha256': hashlib.sha256(raw).hexdigest(), 'asset_url': asset_url,
               'javascript_bytes': size, 'javascript_sha256': digest.hexdigest(),
               'compressed_file': asset.name, 'compressed_sha256': sha(asset),
               'source_head': r.receipt['source']['head'], 'lane': 'internal-supported-owner',
               'qualification': 'LOCALHOST_METRO_DEVELOPMENT_JAVASCRIPT_NOT_STANDALONE_OFFLINE_RELEASE'}
    write_json(r.output / 'metro-bundle.json', receipt)
    r.passed('localhost-metro', receipt)


def read_native_file(path):
    """Read-only bounded nofollow observation. Exceptions contain no content/path."""
    ancestors = [*reversed(path.parent.parents), path.parent]
    stamps = []
    for parent in ancestors:
        info = parent.lstat()
        require(stat.S_ISDIR(info.st_mode), 'NATIVE_OBSERVATION_LINKED_DIRECTORY')
        stamps.append((parent, info.st_dev, info.st_ino))
    before = path.lstat()
    require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and before.st_size <= 10 * MIB,
            'NATIVE_OBSERVATION_REGULAR_FILE_BOUND')
    stamp = lambda info: (info.st_dev, info.st_ino, info.st_mode, info.st_nlink, info.st_size,
                          info.st_mtime_ns, info.st_ctime_ns)
    descriptor = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
    try:
        require(stamp(os.fstat(descriptor)) == stamp(before), 'NATIVE_OBSERVATION_OPEN_RACE')
        parts = []
        size = 0
        while True:
            chunk = os.read(descriptor, min(MIB, before.st_size - size + 1))
            if not chunk:
                break
            size += len(chunk)
            require(size <= before.st_size, 'NATIVE_OBSERVATION_READ_RACE')
            parts.append(chunk)
        require(size == before.st_size and stamp(os.fstat(descriptor)) == stamp(before) and
                stamp(path.lstat()) == stamp(before), 'NATIVE_OBSERVATION_CHANGED_FILE')
        for parent, device, inode in stamps:
            info = parent.lstat()
            require(stat.S_ISDIR(info.st_mode) and (info.st_dev, info.st_ino) == (device, inode),
                    'NATIVE_OBSERVATION_DIRECTORY_RACE')
        return b''.join(parts)
    finally:
        os.close(descriptor)


def native_storage_summary(directory, health_keys, phase):
    require(phase in ['retained', 'withdrawn'], 'NATIVE_OBSERVATION_PHASE')
    entries = list(directory.iterdir())
    require(0 < len(entries) <= 512 and all(path.name == 'manifest.json' or
            re.fullmatch(r'[a-f0-9]{32}', path.name) for path in entries), 'NATIVE_OBSERVATION_FILE_INVENTORY')
    raw_files = {path.name: read_native_file(path) for path in entries}
    require(sum(len(value) for value in raw_files.values()) <= 32 * MIB, 'NATIVE_OBSERVATION_TOTAL_BOUND')
    manifest = json.loads(raw_files['manifest.json'])
    require(isinstance(manifest, dict) and all(isinstance(key, str) and
            (value is None or isinstance(value, str)) for key, value in manifest.items()),
            'NATIVE_OBSERVATION_MANIFEST_SHAPE')
    present = set(manifest) & health_keys
    current = 0
    for key in present:
        value = manifest[key]
        if value is None:
            # MD5 is the installed native library's filename algorithm only.
            value = raw_files[hashlib.md5(key.encode()).hexdigest()].decode('utf-8')
        envelope = json.loads(value)
        valid = isinstance(envelope, dict) and set(envelope) == {'version', 'nonceHex', 'ciphertextHex'} and \
            envelope.get('version') == 'xchacha20poly1305:v1' and \
            isinstance(envelope.get('nonceHex'), str) and re.fullmatch(r'[a-fA-F0-9]{48}', envelope['nonceHex']) and \
            isinstance(envelope.get('ciphertextHex'), str) and len(envelope['ciphertextHex']) >= 32 and \
            len(envelope['ciphertextHex']) % 2 == 0 and re.fullmatch(r'[a-fA-F0-9]+', envelope['ciphertextHex'])
        require(valid, 'NATIVE_OBSERVATION_HEALTH_ENVELOPE_SHAPE')
        current += 1
    orphan_health_files = sum(hashlib.md5(key.encode()).hexdigest() in raw_files
                              for key in health_keys - present)
    markers = (b'C47 synthetic', b'C47 synthetic observation:', b'C47 synthetic correction:')
    plaintext = any(marker in raw for raw in raw_files.values() for marker in markers)
    cleanup_absent = 'layerwell.localDataCleanupRequired.v1' not in manifest
    require(not plaintext and cleanup_absent and orphan_health_files == 0,
            'NATIVE_OBSERVATION_PLAINTEXT_OR_UNCONFIRMED_CLEANUP')
    if phase == 'retained':
        require({'layerwell.shelf.v1', 'layerwell.skinprofile.v1', 'layerwell.completions.v1'} <= present,
                'NATIVE_OBSERVATION_REQUIRED_RETAINED_RECORDS')
    else:
        require(not present, 'NATIVE_OBSERVATION_HEALTH_RECORDS_REMAIN_AFTER_WITHDRAWAL')
    return {'phase': phase, 'native_files_checked': len(raw_files), 'manifest_record_count': len(manifest),
            'health_purpose_key_inventory_count': len(health_keys), 'health_records_present': len(present),
            'health_envelope_shapes_valid': current, 'orphan_health_files': orphan_health_files,
            'synthetic_plaintext_marker_detected': plaintext, 'cleanup_control_marker_absent': cleanup_absent,
            'secure_store_read_or_decrypted': False, 'owner_isolation_qualified': False,
            'qualification': 'CONTENT_FREE_NATIVE_FILE_OBSERVATION_PAIRED_WITH_UI_NOT_CRYPTO_AUTHENTICATION_PROOF'}


def _observe_native_storage(r, device, bundle, phase):
    def invoke(name, argv):
        # Container paths and native keys/values are deliberately never logged.
        row = {'name': name, 'argv_template': ['<controlled-simulator>' if value == device else
               '<internal-bundle>' if value == bundle else value for value in argv],
               'started_utc': utc(), 'stdout_policy': 'NOT_RETAINED_CONTENT_FREE_OBSERVATION', 'state': 'RUNNING'}
        r.receipt['commands'].append(row)
        r.persist()
        try:
            result = subprocess.run(argv, capture_output=True, env=r.env, timeout=30)
            row.update(exit_code=result.returncode, state='PASS' if result.returncode == 0 else 'FAIL')
        except subprocess.TimeoutExpired:
            row.update(exit_code=124, state='FAIL', timed_out=True)
            raise
        except OSError:
            row.update(exit_code=127, state='FAIL')
            raise
        finally:
            row['finished_utc'] = utc()
            r.persist()
        require(result.returncode == 0 and len(result.stdout) <= MIB, 'NATIVE_OBSERVATION_COMMAND_FAILED')
        return result.stdout.decode('utf-8').strip()
    table = invoke('native-observation-process-state-' + phase,
                   ['xcrun', 'simctl', 'spawn', device, 'launchctl', 'list'])
    active = lambda value: any(parts and parts[0].isdigit() and int(parts[0]) > 0 and bundle in line
                               for line in value.splitlines() for parts in [line.split()])
    if active(table):
        invoke('native-observation-stop-app-' + phase, ['xcrun', 'simctl', 'terminate', device, bundle])
    require(not active(invoke('native-observation-stopped-confirmation-' + phase,
            ['xcrun', 'simctl', 'spawn', device, 'launchctl', 'list'])), 'NATIVE_OBSERVATION_APP_STILL_RUNNING')
    container = Path(invoke('native-observation-container-resolution-' + phase,
                            ['xcrun', 'simctl', 'get_app_container', device, bundle, 'data']))
    expected_parent = Path.home() / 'Library/Developer/CoreSimulator/Devices' / device / 'data/Containers/Data/Application'
    require(container.is_absolute() and container.parent == expected_parent and
            re.fullmatch(r'[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}', container.name),
            'NATIVE_OBSERVATION_CONTROLLED_CONTAINER')
    native_path = r.root / 'node_modules/@react-native-async-storage/async-storage/ios/RNCAsyncStorage.mm'
    private_path = r.root / 'apps/mobile/src/lib/storage/privateKV.ts'
    health_path = r.root / 'apps/mobile/src/lib/consent/healthDataWriteAdmission.ts'
    source = health_path.read_text()
    match = re.search(r'export const HEALTH_PURPOSE_PRIVATE_DATA_KEYS = \[(.*?)\] as const;', source, re.S)
    require(match, 'NATIVE_OBSERVATION_HEALTH_KEY_SOURCE')
    literals = match.group(1)
    require(re.fullmatch(r"(?:\s*'[^'\\\r\n]+'\s*,)+\s*", literals), 'NATIVE_OBSERVATION_HEALTH_KEY_LITERALS')
    keys = re.findall(r"'([^']+)'", literals)
    require(len(keys) == 36 and len(set(keys)) == 36, 'NATIVE_OBSERVATION_HEALTH_KEY_INVENTORY')
    summary = native_storage_summary(container / 'Library/Application Support' / bundle / 'RCTAsyncLocalStorage_V1',
                                     set(keys), phase)
    summary.update(source_head=r.receipt['source']['head'], native_async_storage_source_sha256=sha(native_path),
                   private_kv_source_sha256=sha(private_path), health_purpose_source_sha256=sha(health_path))
    write_json(r.output / ('native-storage-' + phase + '.json'), summary)
    r.passed('native-storage-' + phase, summary)


def observe_native_storage(r, device, bundle, phase):
    try:
        _observe_native_storage(r, device, bundle, phase)
    except ValueError as error:
        if str(error).startswith('C47_NATIVE_OBSERVATION_'):
            raise
        raise ValueError('C47_NATIVE_OBSERVATION_INVALID_CONTENT') from None
    except (OSError, KeyError, UnicodeError, subprocess.TimeoutExpired):
        raise ValueError('C47_NATIVE_OBSERVATION_IO_OR_EXPECTED_RECORD_REFUSED') from None


def export_private_command(r, name, argv, input_bytes=None):
    """SDK container output remains in memory, never in logs or receipts."""
    require(r.deadline > time.monotonic(), 'TOTAL_DEADLINE')
    row = {'name': name, 'argv_template': ['<controlled-simulator>' if value ==
           r.receipt['simulator']['udid'] else value for value in argv],
           'started_utc': utc(), 'stdout_policy': 'NOT_RETAINED_PRIVATE_CONTAINER_OUTPUT', 'state': 'RUNNING'}
    r.receipt['commands'].append(row)
    r.persist()
    try:
        result = subprocess.run(argv, input=input_bytes, capture_output=True, env=r.env,
                                timeout=min(30, max(1, r.deadline - time.monotonic())))
        row.update(exit_code=result.returncode, state='PASS' if result.returncode == 0 else 'FAIL')
        require(result.returncode == 0 and len(result.stdout) <= MIB, 'EXPORT_SDK_COMMAND_REFUSED')
        return result.stdout.decode('utf-8').strip()
    except (OSError, UnicodeError, subprocess.TimeoutExpired):
        row.update(state='FAIL')
        raise ValueError('C47_EXPORT_SDK_COMMAND_UNAVAILABLE') from None
    finally:
        row['finished_utc'] = utc()
        r.persist()


def export_directory(path):
    require(path.is_absolute() and '..' not in path.parts, 'EXPORT_ABSOLUTE_DIRECTORY')
    for parent in [*reversed(path.parents), path]:
        require(stat.S_ISDIR(parent.lstat().st_mode), 'EXPORT_LINKED_OR_MISSING_DIRECTORY')
    return path


def export_folders(storage, token):
    require(re.fullmatch(r'C47 Synthetic Export [a-f0-9]{16}', token), 'EXPORT_FOLDER_TOKEN')
    pending, matches, count = [(export_directory(storage), 0)], [], 0
    while pending:
        directory, depth = pending.pop()
        for item in directory.iterdir():
            count += 1
            require(count <= 512, 'EXPORT_PROVIDER_DIRECTORY_BOUND')
            info = item.lstat()
            require(not stat.S_ISLNK(info.st_mode), 'EXPORT_LINKED_PROVIDER_ENTRY')
            if stat.S_ISDIR(info.st_mode):
                if item.name == token:
                    matches.append(export_directory(item))
                else:
                    require(depth < 4, 'EXPORT_PROVIDER_DEPTH_BOUND')
                    pending.append((item, depth + 1))
    require(len(matches) <= 1, 'EXPORT_AMBIGUOUS_DESTINATION')
    return matches


def prepare_export_destination(r, device, bundle):
    require(device == r.receipt['simulator']['udid'] and bundle.endswith('.development'),
            'EXPORT_CONTROLLED_INTERNAL_SIMULATOR')
    token = r.env['C47_EXPORT_FOLDER']
    for command in ['get_app_container', 'listapps']:
        paths = r.run('export-sdk-help-' + command, ['xcrun', 'simctl', 'help', command], timeout=30)
        require(command in output_text(paths, limit=131072) + paths[1].read_text(), 'EXPORT_SDK_HELP_UNAVAILABLE')
    # Verify Files actually exists on this runtime, then let its normal native
    # launch initialize its own group. This never writes an export or target file.
    apps = export_private_command(r, 'export-actual-installed-apps', ['xcrun', 'simctl', 'listapps', device])
    try:
        installed = plistlib.loads(apps.encode('utf-8'))
    except (ValueError, plistlib.InvalidFileException):
        installed = export_json(export_private_command(r, 'export-installed-apps-plist-conversion',
                                ['/usr/bin/plutil', '-convert', 'json', '-o', '-', '-'],
                                input_bytes=apps.encode('utf-8')).encode('utf-8'))
    require(isinstance(installed, dict) and isinstance(installed.get('com.apple.DocumentsApp'), dict) and
            installed['com.apple.DocumentsApp'].get('CFBundleIdentifier') == 'com.apple.DocumentsApp',
            'EXPORT_FILES_APPLICATION_UNAVAILABLE')
    container = Path(export_private_command(r, 'export-controlled-source-container',
                     ['xcrun', 'simctl', 'get_app_container', device, bundle, 'data']))
    expected = Path.home() / 'Library/Developer/CoreSimulator/Devices' / device / 'data'
    require(container.parent == expected / 'Containers/Data/Application' and
            re.fullmatch(r'[A-Fa-f0-9]{8}(?:-[A-Fa-f0-9]{4}){3}-[A-Fa-f0-9]{12}', container.name),
            'EXPORT_WRONG_SIMULATOR_DATA_ROOT')
    export_directory(container)
    export_private_command(r, 'export-native-files-initialization',
                           ['xcrun', 'simctl', 'launch', device, 'com.apple.DocumentsApp'])
    groups = export_private_command(r, 'export-actual-files-provider-groups',
                                   ['xcrun', 'simctl', 'get_app_container', device, 'com.apple.DocumentsApp', 'groups'])
    roots = re.findall(r'^group\.com\.apple\.FileProvider\.LocalStorage[ \t]+(/[^\r\n]+)$', groups, re.M)
    require(len(roots) == 1, 'EXPORT_LOCAL_PROVIDER_NOT_UNAMBIGUOUS')
    group = Path(roots[0].strip())
    require(group.parent == expected / 'Containers/Shared/AppGroup' and
            re.fullmatch(r'[A-Fa-f0-9]{8}(?:-[A-Fa-f0-9]{4}){3}-[A-Fa-f0-9]{12}', group.name),
            'EXPORT_PROVIDER_OUTSIDE_CONTROLLED_SIMULATOR')
    storage = export_directory(group / 'File Provider Storage')
    require(not export_folders(storage, token), 'EXPORT_SYNTHETIC_FOLDER_PREEXISTS')
    before = time.time()
    r.passed('export-destination-baseline', {'controlled_local_provider_resolved': True,
              'unique_synthetic_folder_absent': True, 'source_cache_is_destination': False,
              'other_simulator_or_application_content_read': False})
    info = storage.lstat()
    return {'storage': storage, 'root_identity': (info.st_dev, info.st_ino), 'token': token,
            'started_epoch_ms': int(before * 1000), 'folder_absent_before_export': True, 'destination': None}


def export_json(raw):
    def pairs(values):
        result = {}
        for key, value in values:
            require(key not in result, 'EXPORT_DUPLICATE_JSON_KEY')
            result[key] = value
        return result
    return json.loads(raw.decode('utf-8'), object_pairs_hook=pairs)


def export_ui_observation(r, products, cleanup=False):
    suffix = '-export-cleanup' if cleanup else '-export'
    result = products / ('ui' + suffix + '.xcresult')
    output = products / ('attachments' + suffix)
    help_paths = r.run('export-xcresulttool-actual-help' + suffix,
                      ['xcrun', 'xcresulttool', 'help', 'export', 'attachments'], timeout=30)
    actual_help = output_text(help_paths, limit=131072) + help_paths[1].read_text()
    require('--path' in actual_help and '--output-path' in actual_help and '--schema' in actual_help,
            'EXPORT_ATTACHMENT_COMMAND_UNSUPPORTED')
    r.run('export-xcresulttool-actual-schema' + suffix,
          ['xcrun', 'xcresulttool', 'export', 'attachments', '--schema'], timeout=30)
    r.run('export-native-ui-attachments' + suffix, ['xcrun', 'xcresulttool', 'export', 'attachments',
          '--path', result, '--output-path', output], timeout=60)
    manifest = export_json(read_native_file(output / 'manifest.json'))
    require(isinstance(manifest, list) and 0 < len(manifest) <= 8, 'EXPORT_ATTACHMENT_MANIFEST_SHAPE')
    label = 'native-local-export-cleanup-outcome' if cleanup else 'native-local-export-outcome'
    files = []
    for test in manifest:
        attachments = test.get('attachments') if isinstance(test, dict) else None
        require(isinstance(attachments, list) and len(attachments) <= 64, 'EXPORT_ATTACHMENT_INVENTORY_BOUND')
        for item in attachments:
            require(isinstance(item, dict), 'EXPORT_ATTACHMENT_ENTRY')
            if str(item.get('suggestedHumanReadableName', '')).startswith(label):
                name = item.get('exportedFileName')
                require(isinstance(name, str) and name == Path(name).name and '/' not in name and
                        '\\' not in name and name not in ['.', '..'], 'EXPORT_ATTACHMENT_LINK_OR_PATH')
                files.append(output / name)
    require(len(files) == 1, 'EXPORT_OBSERVATION_MISSING_OR_AMBIGUOUS')
    raw = read_native_file(files[0])
    observation = export_json(raw)
    require(isinstance(observation, dict) and observation.get('lane') == 'internal-supported-owner' and
            observation.get('folder_token') == r.env['C47_EXPORT_FOLDER'], 'EXPORT_UI_RECEIPT_IDENTITY')
    return observation, hashlib.sha256(raw).hexdigest()


def export_payload_summary(raw):
    data = export_json(raw)
    require(isinstance(data, dict) and set(data) == {'mobile_export_schema_version', 'exported_at',
            'server_account_data_status', 'server_account_data', 'local_device_data', 'local_media_note'} and
            data['mobile_export_schema_version'] == 2 and
            data['server_account_data_status'] == 'backend_not_configured' and data['server_account_data'] is None,
            'EXPORT_BUNDLE_SCHEMA_OR_PROVIDER_SCOPE')
    local = data['local_device_data']
    require(isinstance(local, dict) and local.get('schema_version') == 2 and
            local.get('storage_scope') == 'encrypted_private_storage_on_this_device' and
            isinstance(local.get('exclusions'), list) and len(local['exclusions']) == 6 and
            all(isinstance(item, dict) and isinstance(item.get('data_class'), str) and
                isinstance(item.get('reason'), str) for item in local['exclusions']) and
            isinstance(data['exported_at'], str) and isinstance(local.get('collected_at'), str) and
            isinstance(data['local_media_note'], str), 'EXPORT_LOCAL_SCHEMA')
    sections = local.get('sections')
    require(isinstance(sections, dict) and set(sections) == {'account_and_privacy', 'profile_and_preferences',
            'shelf_and_routine', 'activity_and_app_state', 'subscription', 'progress'} and
            all(isinstance(value, dict) for value in sections.values()), 'EXPORT_SECTION_SCHEMA')
    for value in [data['exported_at'], local['collected_at']]:
        require(datetime.fromisoformat(value.replace('Z', '+00:00')).tzinfo is not None, 'EXPORT_SCHEMA_TIMESTAMP')
    markers = (b'C47 synthetic cleanser', b'C47 synthetic observation: used the test cleanser.',
               b'C47 synthetic correction: used the test cleanser once.')
    require(all(marker in raw for marker in markers), 'EXPORT_SYNTHETIC_JOURNEY_FACTS_MISSING')
    return {'schema_version_valid': True, 'server_account_data_absent': True,
            'expected_synthetic_journey_markers_present': True, 'section_count': len(sections),
            'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}


def verify_export_destination(context, observation):
    require(context.get('folder_absent_before_export') is True, 'EXPORT_ACTUAL_ABSENT_BEFORE_BASELINE_REQUIRED')
    require(observation.get('export_outcome') == 'verification_required' and
            observation.get('local_location_selected') is True and observation.get('save_dispatched') is True and
            observation.get('folder_navigation_confirmed') is True and observation.get('provider') == 'on_my_iphone' and
            observation.get('returned_to_owner_controls') is True and
            observation.get('folder_token') == context['token'], 'EXPORT_ACTUAL_LOCAL_SELECTION_REQUIRED')
    dispatch = observation.get('dispatch_epoch_ms')
    require(type(dispatch) is int and context['started_epoch_ms'] <= dispatch <= int(time.time() * 1000),
            'EXPORT_SAVE_DISPATCH_TIME')
    root_info = export_directory(context['storage']).lstat()
    require((root_info.st_dev, root_info.st_ino) == context['root_identity'], 'EXPORT_PROVIDER_CHANGED')
    folders = export_folders(context['storage'], context['token'])
    require(len(folders) == 1, 'EXPORT_SELECTED_FOLDER_NOT_FOUND')
    context['destination'] = folders[0]
    entries = list(folders[0].iterdir())
    require(0 < len(entries) <= 16, 'EXPORT_SELECTED_FOLDER_FILE_BOUND')
    candidates = [path for path in entries if path.suffix.lower() == '.json']
    require(len(candidates) == 1, 'EXPORT_DESTINATION_FILE_NOT_UNAMBIGUOUS')
    candidate = candidates[0]
    before = candidate.lstat()
    birth = getattr(before, 'st_birthtime', None)
    observed_ms = int(time.time() * 1000)
    require(birth is None or (isinstance(birth, (float, int)) and 0 <= birth * 1000 <= observed_ms + 2000),
            'EXPORT_INVALID_OR_FUTURE_BIRTH_METADATA_CONTRADICTS_OBSERVATION')
    summary = export_payload_summary(read_native_file(candidate))
    require(candidate.lstat().st_ino == before.st_ino, 'EXPORT_DESTINATION_CHANGED')
    return dict(summary, export_outcome='local_saved', destination_exists=True,
                selected_folder_absent_before_export=True, destination_observed_after_actual_save_dispatch=True,
                birth_epoch_ms=None if birth is None else int(birth * 1000),
                birth_metadata_status='UNAVAILABLE' if birth is None else
                    'PREDATES_SAVE_COPY_METADATA_POSSIBLE' if birth * 1000 < dispatch else 'AT_OR_AFTER_SAVE',
                freshness_basis='ABSENT_BEFORE_UNIQUE_UI_SELECTED_PROVIDER_FOLDER_AND_OBSERVED_AFTER_SAVE',
                birth_metadata_is_save_provenance=False, source_cache_is_destination=False,
                contents_or_private_paths_recorded=False, provider='on_my_iphone')


def export_status(r, state, detail):
    row = dict(detail, state=state)
    write_json(r.output / 'native-export-destination.json', row)
    r.receipt['export_destination_verification'] = row
    r.persist()


def execute_local_export(r, ios, products, device, bundle, initial_url):
    """Conditional OS destination proof; no file is ever created by the host."""
    context = None
    try:
        context = prepare_export_destination(r, device, bundle)
    except (OSError, ValueError, KeyError):
        export_status(r, 'NOT_RUN', {'export_outcome': 'not_run',
                      'reason': 'ACTUAL_CONTROLLED_FILES_LOCAL_PROVIDER_OR_FRESH_BASELINE_UNAVAILABLE'})
        return
    native_ui(r, ios, products, device, bundle, 'internal-supported-owner', initial_url, 'test02LocalExport')
    observation = None
    try:
        observation, receipt_hash = export_ui_observation(r, products)
        if observation.get('export_outcome') == 'cancelled_unavailable':
            require(observation.get('save_dispatched') is False and
                    observation.get('local_location_selected') is False, 'EXPORT_CANCEL_RECEIPT_INCONSISTENT')
            export_status(r, 'NOT_RUN', {'export_outcome': 'cancelled_unavailable',
                          'native_ui_observation_sha256': receipt_hash, 'save_dispatched': False})
            return
        summary = verify_export_destination(context, observation)
        summary.update(native_ui_observation_sha256=receipt_hash,
                       source_schema_sha256=sha(r.root / 'apps/mobile/src/features/settings/localDeviceExport.ts'))
        r.passed('native-export-local-destination', summary)
        export_status(r, 'PASS', summary)
    except (OSError, ValueError, KeyError, UnicodeError):
        export_status(r, 'NOT_VERIFIED', {'export_outcome': 'not_verified',
                      'reason': 'ACTUAL_UI_SELECTION_OR_FRESH_DESTINATION_SCHEMA_OR_HASH_NOT_PROVEN'})
    # Cleanup acts only on this run's unique synthetic folder after actual host
    # destination proof. An unverified Save cannot authorize a deletion claim.
    if r.receipt['export_destination_verification']['state'] == 'PASS':
        native_ui(r, ios, products, device, bundle, 'internal-supported-owner', initial_url,
                  'test04RemoveSyntheticLocalExport')
        cleanup = {'state': 'NOT_RUN', 'secure_erasure_qualified': False, 'trash_or_backups_checked': False}
        try:
            result, receipt_hash = export_ui_observation(r, products, cleanup=True)
            if result.get('cleanup_outcome') == 'verification_required' and result.get('delete_dispatched') is True:
                destination = context['destination']
                if destination is None:
                    matches = export_folders(context['storage'], context['token'])
                    destination = matches[0] if len(matches) == 1 else None
                require(destination is not None, 'EXPORT_CLEANUP_DESTINATION_WAS_NOT_OBSERVED')
                limit = min(r.deadline, time.monotonic() + 10)
                while time.monotonic() < limit and destination.exists():
                    time.sleep(0.25)
                export_directory(destination.parent)
                require(not destination.exists() and not destination.is_symlink(), 'EXPORT_CLEANUP_DESTINATION_REMAINS')
                cleanup.update(state='PASS', original_destination_absent=True,
                               native_ui_observation_sha256=receipt_hash,
                               qualification='REMOVED_FROM_SELECTED_DESTINATION_VIA_FILES_UI; NO_SECURE_ERASURE_CLAIM')
                r.passed('native-export-original-destination-removed-via-files-ui', cleanup)
        except (OSError, ValueError, KeyError, UnicodeError):
            cleanup.update(state='NOT_VERIFIED')
        r.receipt['export_destination_verification']['cleanup'] = cleanup
        export_status(r, r.receipt['export_destination_verification']['state'],
                      r.receipt['export_destination_verification'])


def content_size_category(raw):
    aliases = {
        'large': ['large', 'UICTContentSizeCategoryL', 'UIContentSizeCategoryLarge'],
        'accessibility-extra-extra-extra-large': [
            'accessibility-extra-extra-extra-large', 'UICTContentSizeCategoryAccessibilityXXXL',
            'UIContentSizeCategoryAccessibilityExtraExtraExtraLarge'],
    }
    matches = {category for category, values in aliases.items() if any(
        re.search(r'(?<![A-Za-z0-9_-])' + re.escape(value) + r'(?![A-Za-z0-9_-])', raw)
        for value in values)}
    require(len(matches) == 1, 'DYNAMIC_TYPE_READBACK_UNRECOGNIZED_OR_AMBIGUOUS')
    return next(iter(matches))


def set_dynamic_type(r, device, value, restoring=False):
    require(value in ['large', 'accessibility-extra-extra-extra-large'], 'DYNAMIC_TYPE_CATEGORY')
    name = 'restore-default' if restoring else 'larger-text'
    r.run('dynamic-type-' + name + '-set', ['xcrun', 'simctl', 'ui', device, 'content_size', value],
          timeout=30, diagnostic=restoring)
    paths = r.run('dynamic-type-' + name + '-readback', ['xcrun', 'simctl', 'ui', device, 'content_size'],
                  timeout=30, diagnostic=restoring)
    raw = output_text(paths, limit=65536).strip()
    require(content_size_category(raw) == value, 'DYNAMIC_TYPE_SETTING_NOT_CONFIRMED')
    detail = {'requested_category': value, 'actual_readback': raw, 'simulator_runtime_only': True,
              'geometry_claim': 'Only the actual selected device profile; no 375pt floor qualification'}
    write_json(r.output / ('dynamic-type-' + name + '.json'), detail)
    return detail


def execute_internal(parent):
    # This lane is structurally unreachable until ordinary app UI completed.
    require(parent.receipt['stages'].get('normal-staging-ui', {}).get('status') == 'PASS',
            'NORMAL_STAGING_UI_REQUIRED_BEFORE_INTERNAL')
    commands = [row for row in parent.receipt.get('commands', []) if row['name'] == 'native-normal-staging-ui']
    require(len(commands) == 1 and commands[0].get('state') == 'PASS' and commands[0].get('exit_code') == 0,
            'NORMAL_XCTEST_ACTUAL_COMMAND_REQUIRED_BEFORE_INTERNAL')
    command = commands[0]
    paths = tuple(parent.output / command[key] for key in ['stdout', 'stderr'])
    require(all(path.parent == parent.output / 'logs' for path in paths), 'NORMAL_XCTEST_CURRENT_JOB_LOGS_REQUIRED')
    proof = normal_ui_log_proof(parent, paths)
    require(proof == parent.receipt['stages']['normal-staging-ui']['details'].get('positive_xctest') and
            all(proof[key + '_sha256'] == command.get(key + '_sha256') for key in ['stdout', 'stderr']),
            'NORMAL_XCTEST_CURRENT_LOG_PROOF_REQUIRED_BEFORE_INTERNAL')
    environment = internal_environment(parent.env)
    head = parent.receipt['source']['head']
    output = parent.output / 'internal-supported-owner'
    child = Runner(parent.root, output, seconds=max(1, parent.deadline - time.monotonic()))
    child.deadline = parent.deadline
    child.env = environment
    child.evidence_root = parent.output
    child.receipt.update(lane='internal-supported-owner', internal_supported_owner='IN_PROGRESS',
        source=parent.receipt['source'], fixture='EXISTING_DEBUG_DEVELOPMENT_ANONYMOUS_OWNER_NO_PRO',
        qualification='METRO_DEPENDENT_DEBUG_NOT_STANDALONE_OFFLINE_OR_CUSTOMER_ONBOARDING',
        provider_configuration='ALL_DECLARED_PROVIDER_KEYS_ABSENT; DOTENV_DISABLED',
        entitlement_authority='NO_PRO_GRANT; EXISTING_NATIVE_PLAN_PHOTO_GUARDS_RETAINED',
        export_destination_verification={'state': 'NOT_RUN', 'export_outcome': 'not_run'})
    child.env['C47_EXPORT_FOLDER'] = 'C47 Synthetic Export ' + uuid.uuid4().hex[:16]
    parent.receipt['internal_supported_owner'] = {'status': 'IN_PROGRESS',
                                                 'evidence': 'internal-supported-owner/execution.json'}
    # The normal native config must not be overwritten by the second generation.
    retain_generated_native(parent.root / 'apps/mobile/ios', parent.output)
    retain_result_bundles(parent)
    parent.receipt['native_configuration_final_retained'] = True
    parent.persist()
    products = Path(os.environ['RUNNER_TEMP']) / 'c47-internal-native-products'
    products.mkdir(exist_ok=False)
    child.receipt['products_directory'] = str(products)
    child.persist()
    try:
        child.source_proof('source-before-internal', head, allow_generation=True)
        source47 = output / 'current-generated47-source.json'
        source_raw = (parent.output / 'current-generated47-source.json').read_bytes()
        source_proof = json.loads(source_raw)
        require(source_proof['phase'] == 'SOURCE' and source_proof['sourceHead'] == head and
                source_proof['profiles'] == ['development', 'staging'] and
                source_proof['descriptorSHA256'] == sha(child.root / 'docs/phase-9/ios-generated-input-succession47.v1.json'),
                'SAME_HEAD_UNPROJECTED_BOTH_PROFILE_SOURCE_PROOF_REQUIRED')
        source47.write_bytes(source_raw)
        child.receipt['source_gate_reuse'] = {'same_job_before_either_generation': True, 'same_head': head,
            'raw_source_proof_sha256': sha(source47), 'profiles': source_proof['profiles'],
            'qualification': 'Actual original SOURCE gate validated both profiles before normal prebuild; no reset or parent-source substitution'}
        child.persist()
        child.run('existing-fixture-separation-tests', ['npm', '--workspace', 'apps/mobile', 'exec', '--',
            'vitest', 'run', 'src/lib/auth/firstSessionE2E.test.ts',
            'src/lib/auth/firstSessionE2EAuthProviderContracts.test.ts', 'src/lib/env.test.ts'], timeout=180)
        mobile = child.root / 'apps/mobile'
        child.run('internal-resolved-expo-config', ['npx', '--no-install', 'expo', 'config', '--json'],
                  cwd=mobile, timeout=120)
        child.run('internal-prebuild', ['npx', '--no-install', 'expo', 'prebuild', '--platform', 'ios',
            '--clean', '--no-install', '--template', '../../node_modules/expo/template.tgz'], cwd=mobile, timeout=300)
        child.run('internal-generated-source-diff', ['git', '--no-replace-objects', 'diff', '--binary', 'HEAD'])
        child.source_proof('source-after-internal-prebuild', head, allow_generation=True)
        ios = mobile / 'ios'
        compatibility = output / 'generated-compat47'
        child.run('internal-generated47-exact-properties', ['python3', '-I', '-B',
            'scripts/release/full-app-j01/pods_compat47.py', '--ios-directory', ios,
            '--source-proof', source47, '--profile', 'development', '--output', compatibility], timeout=120)
        child.run('internal-generated47-native', ['node', 'scripts/release/full-app-j01/native_generated47.mjs',
            '--phase', 'GENERATED', '--profile', 'development', '--source-proof', source47,
            '--receipt', compatibility / 'receipt.json', '--output', output / 'current-generated47.json'], timeout=600)
        child.source_proof('source-after-internal-generated47', head, allow_generation=True)
        child.run('internal-pods', ['pod', 'install'], cwd=ios, timeout=1200)
        retain_pod_inventory(ios, output)
        child.run('internal-generated47-resolved', ['node', 'scripts/release/full-app-j01/native_generated47.mjs',
            '--phase', 'RESOLVED', '--profile', 'development', '--source-proof', source47,
            '--receipt', compatibility / 'receipt.json', '--output', output / 'current-generated47-resolved.json'], timeout=600)
        child.source_proof('source-after-internal-pods', head, allow_generation=True)
        require(re.search(r'^  - NativeLabelOcr \(1\.0\.0\)', (ios / 'Podfile.lock').read_text(), re.M),
                'INTERNAL_NATIVE_OCR_NOT_AUTOLINKED')
        retain_generated_native(ios, output)
        workspaces = list(ios.glob('*.xcworkspace'))
        require(len(workspaces) == 1, 'INTERNAL_WORKSPACE_COUNT')
        workspace = workspaces[0]
        derived = products / 'derived'
        child.run('internal-native-build-settings', ['xcodebuild', '-workspace', workspace, '-scheme', workspace.stem,
            '-configuration', 'Debug', '-sdk', 'iphonesimulator', *SIMULATOR_BUILD_FLAGS, '-showBuildSettings'], timeout=120)
        child.run('internal-native-build', ['xcodebuild', '-workspace', workspace, '-scheme', workspace.stem,
            '-configuration', 'Debug', '-sdk', 'iphonesimulator', '-destination', 'generic/platform=iOS Simulator',
            '-derivedDataPath', derived, '-resultBundlePath', products / 'build.xcresult', *SIMULATOR_BUILD_FLAGS, 'build'], timeout=2400)
        child.source_proof('source-after-internal-build', head, allow_generation=True)
        apps = list((derived / 'Build/Products/Debug-iphonesimulator').glob('*.app'))
        require(len(apps) == 1, 'INTERNAL_PRODUCT_COUNT')
        app = apps[0]
        architecture = json.loads((parent.output / 'toolchain.json').read_text())['architecture']
        bundle, _, app_receipt = retain_app(child, app, products, head, architecture,
                                           'Debug', 'internal-supported-owner')
        normal_bundle = parent.receipt['stages']['compiled']['details']['bundle_id']
        require(bundle != normal_bundle and bundle.endswith('.development'), 'INTERNAL_BUNDLE_SEPARATION')
        child.passed('compiled', app_receipt)
        # Only one controlled Simulator is booted during each lane.
        parent.run('normal-simulator-shutdown-before-internal', ['xcrun', 'simctl', 'shutdown',
                   parent.receipt['simulator']['udid']], timeout=30)
        template = parent.receipt['simulator']['template']
        runtime = parent.receipt['simulator']['runtime']
        device = child.text('simulator-create', ['xcrun', 'simctl', 'create', 'C47-internal-' + head[:12],
                            template['deviceTypeIdentifier'], runtime['identifier']])
        require(re.fullmatch(r'[0-9A-Fa-f-]{36}', device), 'INTERNAL_SIMULATOR_UDID')
        child.receipt['simulator'] = {'udid': device, 'runtime': runtime, 'template': template,
                                      'selection': 'Fresh same-profile controlled internal-lane Simulator'}
        child.persist()
        child.run('simulator-boot', ['xcrun', 'simctl', 'boot', device], timeout=60)
        child.run('simulator-bootstatus', ['xcrun', 'simctl', 'bootstatus', device, '-b'], timeout=240)
        child.run('simulator-install', ['xcrun', 'simctl', 'install', device, app], timeout=120)
        child.passed('installed', {'udid': device, 'bundle_id': bundle})
        with socket.socket() as port_probe:
            port_probe.bind(('127.0.0.1', 8081))
        initial_url = localhost_url('http://127.0.0.1:8081?disableOnboarding=1&disableFab=1&disableAutoLaunch=1')
        with child.background('localhost-metro', ['npx', '--no-install', 'expo', 'start', '--dev-client',
                              '--localhost', '--offline', '--port', '8081'], mobile) as metro:
            metro_ready_and_bundle(child, metro, bundle)
            pid = launch_and_verify(child, device, bundle, ['--initialUrl', initial_url])
            child.run('internal-launch-screenshot', ['xcrun', 'simctl', 'io', device, 'screenshot',
                       output / 'internal-debug-launch.png'], timeout=30)
            child.passed('launched', {'pid': pid, 'survival_seconds': 30, 'initial_url': initial_url,
                                     'javascript_mode': 'Metro development; standalone/offline not qualified'})
            native_ui(child, ios, products, device, bundle, 'internal-supported-owner', initial_url,
                      'test01CoreRetainedNativeJourney')
            observe_native_storage(child, device, bundle, 'retained')
            help_paths = child.run('simulator-ui-actual-help', ['xcrun', 'simctl', 'help', 'ui'], timeout=30)
            help_text = output_text(help_paths, limit=131072) + help_paths[1].read_text()
            require('content_size' in help_text and 'accessibility-extra-extra-extra-large' in help_text,
                    'DYNAMIC_TYPE_UNAVAILABLE_IN_ACTUAL_TOOLCHAIN')
            try:
                larger = set_dynamic_type(child, device, 'accessibility-extra-extra-extra-large')
                native_ui(child, ios, products, device, bundle, 'internal-supported-owner', initial_url,
                          'test03LargerTextManualInput')
                child.passed('larger-text-native-input', larger)
            finally:
                restored = set_dynamic_type(child, device, 'large', restoring=True)
                child.passed('dynamic-type-restored-before-rights', restored)
            execute_local_export(child, ios, products, device, bundle, initial_url)
            native_ui(child, ios, products, device, bundle, 'internal-supported-owner', initial_url,
                      'test05ConsentWithdrawal')
            observe_native_storage(child, device, bundle, 'withdrawn')
        child.source_proof('source-after-internal-runtime', head, allow_generation=True)
        child.receipt.update(status='INTERNAL_SYNTHETIC_DEBUG_NATIVE_EXECUTED_SCOPED_GUARDS_RETAINED',
                             internal_supported_owner='EXECUTED_SYNTHETIC_DEBUG_ONLY', finished_utc=utc())
    except Exception as error:
        child.receipt.update(status='PARTIAL_BLOCKED', failure={'type': type(error).__name__, 'detail': str(error)},
                             finished_utc=utc())
        raise
    finally:
        child.persist()
        collect(child)
        parent.receipt['internal_supported_owner'] = {'status': child.receipt['status'],
            'evidence': 'internal-supported-owner/execution.json', 'stages': list(child.receipt['stages'])}
        parent.persist()
    parent.receipt.update(status='NORMAL_AND_INTERNAL_SYNTHETIC_NATIVE_EXECUTED_SCOPE_REVIEW_REQUIRED',
                          finished_utc=utc())
    parent.persist()


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
    retain_result_bundles(r)
    ios = r.root / 'apps/mobile/ios'
    if not r.receipt.get('native_configuration_final_retained'):
        retain_generated_native(ios, r.output)
    generated = r.output / 'generated-native'
    for name in ['Podfile', 'Podfile.lock', 'Podfile.properties.json']:
        path = ios / name
        if not r.receipt.get('native_configuration_final_retained') and path.is_file() and path.stat().st_size <= 10 * MIB:
            generated.mkdir(exist_ok=True)
            shutil.copy2(path, generated / name)
    reports = Path.home() / 'Library/Logs/DiagnosticReports'
    if reports.is_dir():
        crashes = r.output / 'crashes'
        for path in reports.glob('*'):
            if path.is_file() and path.name.startswith(('Layerwell', 'C47NativeUI')) and path.stat().st_size <= 10 * MIB:
                crashes.mkdir(exist_ok=True)
                shutil.copy2(path, crashes / path.name)
    size = evidence_size(getattr(r, 'evidence_root', r.output))
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
        execute_internal(runner)
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
