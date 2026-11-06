"""Bounded Simulator execution; every PASS requires an executed command.

The finite build, ordinary-runtime and internal-runtime stages preserve source
and artifact custody. They never admit an owner, enable a provider, sign a
release, or treat imported receipts/source checks as current native execution.
"""
import argparse
import ast
from contextlib import contextmanager
import gzip
import socket
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import build_opener, ProxyHandler, Request, HTTPRedirectHandler
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
import unicodedata
import zipfile
from types import SimpleNamespace
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
# Historical UNSIGNED flags above remain the pre-C03 witness. These command-line
# flags apply only to asserted iphonesimulator builds; app entitlements are a
# generated app-target SDK-conditional setting, never a global Pod/framework flag.
SIMULATOR_BUILD_FLAGS = [*UNSIGNED, 'ARCHS=x86_64']
# Leave every Pod/framework's original settings intact. The app's seven local
# signing values exist exclusively in its generated Simulator-conditional keys.
APP_SIMULATOR_BUILD_FLAGS = ['COMPILER_INDEX_STORE_ENABLE=NO', 'ARCHS=x86_64']


def simulator_signing():
    spec = importlib.util.spec_from_file_location('c47_simulator_signing',
        Path(__file__).with_name('simulator_signing47.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


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


def available_iphone(document, sdk_version=None, host_arch=None):
    """Keep legacy one-argument behavior; actual lanes supply both toolchain facts."""
    require((sdk_version is None) == (host_arch is None), 'SIMULATOR_TOOLCHAIN_PAIR')
    if sdk_version is not None:
        require(isinstance(sdk_version, str) and re.fullmatch(r'\d+\.\d+(?:\.\d+)*', sdk_version),
                'SIMULATOR_SDK_VERSION')
        require(host_arch in ('x86_64', 'arm64'), 'SIMULATOR_HOST_ARCH')
        sdk_pair = tuple(map(int, sdk_version.split('.')[:2]))
    runtime_by_id = {row['identifier']: row for row in document['runtimes']
                     if row.get('isAvailable') is True and
                     row.get('identifier', '').startswith('com.apple.CoreSimulator.SimRuntime.iOS-') and
                     re.fullmatch(r'\d+(?:\.\d+)*', row.get('version', '')) and
                     int(row['version'].split('.')[0]) >= 17 and
                     (host_arch is None or host_arch in row.get('supportedArchitectures', []))}
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
            if not device.get('deviceTypeIdentifier', '').startswith('com.apple.CoreSimulator.SimDeviceType.iPhone-'):
                continue
            rank = compact.index(device['name']) if device['name'] in compact else len(compact)
            parts = tuple(map(int, runtime['version'].split('.')))
            sdk_rank = 0 if sdk_version is None or parts[:2] == sdk_pair else 1
            choices.append(((sdk_rank, rank, tuple(-part for part in parts), device['name']), runtime, device))
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


def projected_source_inventory(verifier, root, head, g, generated_raw, authenticated_original=None):
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
        size, digest = before.st_size, content.hexdigest()
        if name == 'apps/mobile/package.json':
            expected = generated_raw if authenticated_original is None else authenticated_original
            require(digest == hashlib.sha256(expected).hexdigest(), 'GENERATED_PACKAGE_RACE')
            if authenticated_original is not None:
                require(blob.hexdigest() == oid, 'SOURCE_BLOB_DRIFT:' + name)
                size, digest = len(generated_raw), hashlib.sha256(generated_raw).hexdigest()
        else:
            require(blob.hexdigest() == oid, 'SOURCE_BLOB_DRIFT:' + name)
        total += size
        fingerprint.update(json.dumps([name, mode, oid, size, digest],
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


STAGE_REPOSITORY = 'TasfiqJ/onSkin'


STAGE_BRANCH = 'stage/m1-native-runtime47'


STAGE_WORKFLOW = '.github/workflows/campaign47-native-runtime.yml'


STAGE_JOB_NAMES = {'source': 'C47 source', 'build': 'C47 build', 'normal': 'C47 normal', 'internal': 'C47 internal'}


STAGE_DEPENDENCIES = {'source': (), 'build': ('source',), 'normal': ('source', 'build'),
                      'internal': ('source', 'build', 'normal'), 'legacy25-normal': ('build',)}


STAGE_MANIFEST = 'stage-provenance.json'


STAGE_MAX_FILES = 50000


STAGE_MAX_PAYLOAD = 500 * MIB


STAGE_MAX_WIRE = 550 * MIB


STAGE_MAX_FILE = 360 * MIB


STAGE_MAX_JSON = 8 * MIB


def stage_integer(value):
    require(type(value) is int or isinstance(value, str) and
            re.fullmatch(r'[1-9][0-9]{0,18}', value), 'STAGE_INTEGER')
    number = int(value)
    require(0 < number < 2 ** 63, 'STAGE_INTEGER')
    return number


def stage_json(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, 'STAGE_JSON_DUPLICATE')
            result[key] = value
        return result
    require(len(raw) <= STAGE_MAX_JSON, 'STAGE_JSON_BOUND')
    try:
        return json.loads(raw, object_pairs_hook=pairs)
    except (ValueError, RecursionError, UnicodeError):
        raise ValueError('C47_STAGE_JSON_INVALID') from None


def stage_name(name):
    require(isinstance(name, str) and 0 < len(name) <= 512 and name.isascii() and
            not re.search(r'[\x00-\x1f\x7f<>:"\\|?*]', name) and not name.startswith('/'),
            'STAGE_MEMBER_NAME')
    parts = name.split('/')
    require(len(parts) <= 24 and all(part and part not in ('.', '..') and
            not part.endswith(('.', ' ')) and not re.match(
                r'(?i)^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)', part) for part in parts),
            'STAGE_MEMBER_NAME')
    return parts


def stage_file_digest(path, maximum=STAGE_MAX_FILE):
    for parent in [*reversed(path.parent.parents), path.parent]:
        require(stat.S_ISDIR(parent.lstat().st_mode), 'STAGE_DIRECTORY_LINK')
    before = path.lstat()
    stamp = lambda info: (info.st_dev, info.st_ino, info.st_mode, info.st_nlink,
                          info.st_size, info.st_mtime_ns, info.st_ctime_ns)
    require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and
            0 <= before.st_size <= maximum, 'STAGE_REGULAR_FILE_BOUND')
    descriptor = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
    digest, size = hashlib.sha256(), 0
    try:
        require(stamp(os.fstat(descriptor)) == stamp(before), 'STAGE_FILE_RACE')
        with os.fdopen(descriptor, 'rb', closefd=False) as stream:
            while True:
                chunk = stream.read(MIB)
                if not chunk:
                    break
                size += len(chunk)
                require(size <= maximum, 'STAGE_REGULAR_FILE_BOUND')
                digest.update(chunk)
        require(stamp(os.fstat(descriptor)) == stamp(before) and
                stamp(path.lstat()) == stamp(before) and size == before.st_size, 'STAGE_FILE_RACE')
    finally:
        os.close(descriptor)
    return {'bytes': size, 'sha256': digest.hexdigest()}


def stage_expected(role, needs, context):
    require(role in STAGE_JOB_NAMES and isinstance(context, dict) and
            context.get('repository') == STAGE_REPOSITORY and
            isinstance(context.get('head'), str) and re.fullmatch(r'[a-f0-9]{40}', context['head']) and
            isinstance(context.get('tree'), str) and re.fullmatch(r'[a-f0-9]{40}', context['tree']), 'STAGE_CONTEXT')
    run_id, attempt = stage_integer(context['run_id']), stage_integer(context['run_attempt'])
    require(isinstance(needs, dict) and
            set(needs) == {'artifact_id', 'digest', 'run_id', 'producer_run_attempt', 'payload_bytes'} and
            stage_integer(needs['run_id']) == run_id and
            stage_integer(needs['producer_run_attempt']) == attempt and
            isinstance(needs.get('digest'), str) and re.fullmatch(r'[a-f0-9]{64}', needs['digest']),
            'STAGE_TRUSTED_NEEDS')
    payload = stage_integer(needs['payload_bytes'])
    require(payload <= STAGE_MAX_PAYLOAD, 'STAGE_PAYLOAD_BOUND')
    return {'stage': role, 'repository': STAGE_REPOSITORY, 'run_id': run_id,
            'run_attempt': attempt, 'job_name': STAGE_JOB_NAMES[role],
            'head': context['head'], 'tree': context['tree'],
            'artifact_id': stage_integer(needs['artifact_id']), 'digest': needs['digest'],
            'payload_bytes': payload,
            'artifact_name': f"campaign47-native-{role}-{context['head']}-{run_id}-{attempt}"}


def stage_dependencies(consumer_stage, needs):
    require(consumer_stage in STAGE_DEPENDENCIES and isinstance(needs, dict) and
            set(needs) == set(STAGE_DEPENDENCIES[consumer_stage]), 'STAGE_DEPENDENCIES')
    return STAGE_DEPENDENCIES[consumer_stage]


def stage_service_proof(expected, run, jobs, artifact):
    require(isinstance(run, dict) and isinstance(jobs, dict) and isinstance(artifact, dict),
            'STAGE_API_DOCUMENT_SHAPE')
    require(type(run.get('id')) is int and type(run.get('run_attempt')) is int and
            run.get('id') == expected['run_id'] and run.get('run_attempt') == expected['run_attempt'] and
            run.get('head_sha') == expected['head'] and run.get('head_branch') == STAGE_BRANCH and
            run.get('event') == 'pull_request' and run.get('path') == STAGE_WORKFLOW and
            run.get('repository', {}).get('full_name') == STAGE_REPOSITORY and
            run.get('repository', {}).get('private') is False and
            run.get('head_repository', {}).get('full_name') == STAGE_REPOSITORY, 'STAGE_RUN_METADATA')
    values = jobs.get('jobs')
    require(isinstance(values, list) and all(isinstance(job, dict) for job in values) and
            len(values) <= 100 and type(jobs.get('total_count')) is int and
            jobs.get('total_count') == len(values),
            'STAGE_JOB_PAGE_BOUND')
    selected = [job for job in values if job.get('name') == expected['job_name']]
    require(len(selected) == 1, 'STAGE_PRODUCER_JOB_UNIQUE')
    job = selected[0]
    require(type(job.get('id')) is int and type(job.get('run_id')) is int and
            job.get('run_id') == expected['run_id'] and job.get('head_sha') == expected['head'] and
            job.get('status') == 'completed' and job.get('conclusion') == 'success' and
            ('run_attempt' not in job or type(job['run_attempt']) is int and
             job['run_attempt'] == expected['run_attempt']), 'STAGE_PRODUCER_JOB_SUCCESS')
    owner = artifact.get('workflow_run')
    require(isinstance(owner, dict) and type(owner.get('id')) is int and
            type(artifact.get('id')) is int and owner.get('id') == expected['run_id'] and
            owner.get('head_sha') == expected['head'] and owner.get('head_branch') == STAGE_BRANCH and
            artifact.get('id') == expected['artifact_id'] and artifact.get('name') == expected['artifact_name'] and
            artifact.get('expired') is False and artifact.get('digest') == 'sha256:' + expected['digest'],
            'STAGE_ARTIFACT_METADATA')
    size = artifact.get('size_in_bytes')
    require(type(size) is int and 0 < size <= STAGE_MAX_WIRE, 'STAGE_WIRE_BOUND')
    return {'repository': STAGE_REPOSITORY, 'run_id': expected['run_id'],
            'producer_run_attempt': expected['run_attempt'], 'producer_job_id': stage_integer(job['id']),
            'producer_job_name': expected['job_name'], 'artifact_id': expected['artifact_id'],
            'artifact_name': expected['artifact_name'], 'wire_bytes': size,
            'wire_sha256': expected['digest'], 'service_digest': artifact['digest'],
            'source_head': expected['head'], 'source_tree': expected['tree']}


class _StageNoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        return None


def _stage_api(path, token, redirect=False):
    require(isinstance(token, str) and 0 < len(token) <= 1024 and
            not re.search(r'[\r\n]', token), 'STAGE_EPHEMERAL_TOKEN_REQUIRED')
    request = Request('https://api.github.com/repos/' + STAGE_REPOSITORY + path, headers={
        'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'C47-stage-artifact-loader'})
    opener = build_opener(ProxyHandler({}), _StageNoRedirect())
    try:
        with opener.open(request, timeout=30) as response:
            require(not redirect and response.status == 200, 'STAGE_API_RESPONSE')
            raw = response.read(STAGE_MAX_JSON + 1)
            return stage_json(raw), hashlib.sha256(raw).hexdigest()
    except HTTPError as error:
        location = error.headers.get('Location') if redirect and error.code == 302 else None
        error.close()
        require(location is not None, 'STAGE_API_RESPONSE')
        return location
    except (URLError, OSError):
        raise ValueError('C47_STAGE_API_UNAVAILABLE') from None


def stage_blob_location(location):
    require(isinstance(location, str) and len(location) <= 16384 and location.isascii() and
            not re.search(r'[\x00-\x20\x7f]', location), 'STAGE_BLOB_LOCATION')
    try:
        parsed = urlsplit(location)
        require(parsed.scheme == 'https' and parsed.hostname and
                parsed.hostname.endswith('.blob.core.windows.net') and parsed.port in (None, 443) and
                not parsed.username and not parsed.password and not parsed.fragment, 'STAGE_BLOB_LOCATION')
    except ValueError:
        raise ValueError('C47_STAGE_BLOB_LOCATION') from None
    return location


def _stage_download(expected, proof, token, target):
    location = stage_blob_location(_stage_api('/actions/artifacts/' + str(expected['artifact_id']) + '/zip',
                                               token, redirect=True))
    # A separate opener and Request prevent Authorization from reaching the blob.
    opener = build_opener(ProxyHandler({}), _StageNoRedirect())
    request = Request(location, headers={'User-Agent': 'C47-stage-artifact-loader'})
    descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_NOFOLLOW', 0), 0o600)
    digest, size, deadline = hashlib.sha256(), 0, time.monotonic() + 300
    try:
        with os.fdopen(descriptor, 'wb', closefd=False) as stream, opener.open(request, timeout=20) as response:
            require(response.status == 200 and (response.headers.get('Content-Length') is None or
                    response.headers['Content-Length'] == str(proof['wire_bytes'])), 'STAGE_BLOB_RESPONSE')
            while True:
                require(time.monotonic() < deadline, 'STAGE_DOWNLOAD_DEADLINE')
                chunk = response.read(MIB)
                if not chunk:
                    break
                size += len(chunk)
                require(size <= proof['wire_bytes'] <= STAGE_MAX_WIRE, 'STAGE_WIRE_BOUND')
                stream.write(chunk)
                digest.update(chunk)
            stream.flush()
            os.fsync(descriptor)
    except (HTTPError, URLError, OSError):
        raise ValueError('C47_STAGE_BLOB_DOWNLOAD_FAILED') from None
    finally:
        os.close(descriptor)
    require(size == proof['wire_bytes'] and digest.hexdigest() == expected['digest'] and
            proof['service_digest'] == 'sha256:' + digest.hexdigest(), 'STAGE_WIRE_IDENTITY')


def _stage_manifest_identity(value, expected):
    require(isinstance(value, dict) and type(value.get('schema')) is int and
            value.get('schema') == 1 and value.get('stage') == expected['stage'] and
            value.get('repository') == expected['repository'] and type(value.get('run_id')) is int and
            type(value.get('run_attempt')) is int and value.get('run_id') == expected['run_id'] and
            value.get('run_attempt') == expected['run_attempt'] and value.get('job_name') == expected['job_name'] and
            value.get('source') == {'head': expected['head'], 'tree': expected['tree']}, 'STAGE_MANIFEST_IDENTITY')


def stage_execution_identity(value, expected):
    require(isinstance(value, dict) and isinstance(value.get('job_context'), dict) and
            isinstance(value.get('source'), dict), 'STAGE_EXECUTION_SHAPE')
    context = value.get('job_context', {})
    require(value.get('stage') == expected['stage'] and value.get('stage_complete') is True and
            not value.get('failure') and not value.get('collection_failure') and
            value.get('source', {}).get('head') == expected['head'] and
            value.get('source', {}).get('tree') == expected['tree'] and
            context.get('repository') == expected['repository'] and type(context.get('run_id')) is int and
            type(context.get('run_attempt')) is int and context.get('run_id') == expected['run_id'] and
            context.get('run_attempt') == expected['run_attempt'] and context.get('job_name') == expected['job_name'] and
            ('job_id' not in context or context['job_id'] == 'native-' + expected['stage']) and
            value.get('acceptance_granted') is False and value.get('campaign_candidate_complete') is False and
            value.get('release') == 'NO_GO', 'STAGE_EXECUTION_IDENTITY_OR_INCOMPLETE')


def verify_stage_zip(archive, expected, proof, output):
    require(proof['wire_sha256'] == expected['digest'] and
            proof['service_digest'] == 'sha256:' + expected['digest'], 'STAGE_DUAL_WIRE_ANCHOR')
    require(stage_file_digest(archive, STAGE_MAX_WIRE) ==
            {'bytes': proof['wire_bytes'], 'sha256': expected['digest']}, 'STAGE_WIRE_IDENTITY')
    require(not output.exists(), 'STAGE_NEW_IMPORT_DIRECTORY')
    with zipfile.ZipFile(archive) as bundle:
        members = bundle.infolist()
        require(0 < len(members) <= STAGE_MAX_FILES, 'STAGE_MEMBER_BOUND')
        names, aliases, total = set(), {}, 0
        for member in members:
            parts = stage_name(member.filename)
            require(member.filename not in names and not member.is_dir() and not member.flag_bits & 1 and
                    stat.S_IFMT(member.external_attr >> 16) in (0, stat.S_IFREG) and
                    member.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED), 'STAGE_MEMBER_TYPE')
            for count in range(1, len(parts) + 1):
                prefix = '/'.join(parts[:count])
                require(aliases.get(prefix.casefold(), prefix) == prefix, 'STAGE_MEMBER_ALIAS')
                aliases[prefix.casefold()] = prefix
            names.add(member.filename)
            total += member.file_size
            require(member.file_size <= STAGE_MAX_FILE and total <= STAGE_MAX_PAYLOAD and
                    member.file_size <= max(1, member.compress_size) * 2000, 'STAGE_EXPANDED_BOUND')
        require(total == expected['payload_bytes'] and STAGE_MANIFEST in names and 'execution.json' in names and
                not any('/'.join(name.split('/')[:n]) in names for name in names
                        for n in range(1, len(name.split('/')))), 'STAGE_EXACT_PAYLOAD_INVENTORY')
        require(bundle.getinfo(STAGE_MANIFEST).file_size <= STAGE_MAX_JSON, 'STAGE_MANIFEST_BOUND')
        manifest_raw = bundle.read(STAGE_MANIFEST)
        manifest = stage_json(manifest_raw)
        _stage_manifest_identity(manifest, expected)
        entries = manifest.get('files')
        require(isinstance(entries, list) and all(isinstance(row, dict) and set(row) ==
                {'path', 'bytes', 'sha256'} for row in entries), 'STAGE_MANIFEST_INVENTORY')
        inventory = {}
        for row in entries:
            stage_name(row['path'])
            require(row['path'] not in inventory and type(row['bytes']) is int and
                    0 <= row['bytes'] <= STAGE_MAX_FILE and isinstance(row['sha256'], str) and
                    re.fullmatch(r'[a-f0-9]{64}', row['sha256']),
                    'STAGE_MANIFEST_INVENTORY')
            inventory[row['path']] = row
        require(set(inventory) == names - {STAGE_MANIFEST}, 'STAGE_EXACT_PAYLOAD_INVENTORY')
        output.mkdir(mode=0o700)
        for member in members:
            target = output.joinpath(*stage_name(member.filename))
            target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            for parent in [target.parent, *target.parent.parents]:
                if parent == output.parent:
                    break
                require(stat.S_ISDIR(parent.lstat().st_mode), 'STAGE_DIRECTORY_LINK')
            descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL |
                                 getattr(os, 'O_NOFOLLOW', 0), 0o600)
            digest, size = hashlib.sha256(), 0
            try:
                with os.fdopen(descriptor, 'wb', closefd=False) as stream, bundle.open(member) as source:
                    while True:
                        chunk = source.read(MIB)
                        if not chunk:
                            break
                        size += len(chunk)
                        require(size <= member.file_size, 'STAGE_MEMBER_SIZE')
                        digest.update(chunk)
                        stream.write(chunk)
                require(size == member.file_size, 'STAGE_MEMBER_SIZE')
            finally:
                os.close(descriptor)
            actual = stage_file_digest(target)
            require(actual == {'bytes': size, 'sha256': digest.hexdigest()} and
                    (member.filename == STAGE_MANIFEST or actual ==
                     {key: inventory[member.filename][key] for key in ('bytes', 'sha256')}), 'STAGE_MEMBER_HASH')
    require(stage_file_digest(archive, STAGE_MAX_WIRE) ==
            {'bytes': proof['wire_bytes'], 'sha256': expected['digest']}, 'STAGE_WIRE_REREAD')
    execution = stage_json(read_native_file(output / 'execution.json'))
    stage_execution_identity(execution, expected)
    return {'producer': proof, 'stage': expected['stage'], 'payload_directory': str(output),
            'manifest_sha256': hashlib.sha256(manifest_raw).hexdigest(), 'files': len(members),
            'payload_bytes': total, 'all_file_hashes_and_crc_verified': True,
            'current_runner_commands_imported': False,
            'driver_app_or_named_xctest_admission_still_required': True}


def write_stage_provenance(directory, role, context):
    require(role in STAGE_JOB_NAMES and context.get('repository') == STAGE_REPOSITORY and
            isinstance(context.get('head'), str) and re.fullmatch(r'[a-f0-9]{40}', context['head']) and
            isinstance(context.get('tree'), str) and re.fullmatch(r'[a-f0-9]{40}', context['tree']) and
            directory.is_absolute() and stat.S_ISDIR(directory.lstat().st_mode) and
            not (directory / STAGE_MANIFEST).exists(), 'STAGE_PRODUCER_MANIFEST')
    files, total = [], 0
    for parent, directories, names in os.walk(directory, followlinks=False):
        require(all(stat.S_ISDIR((Path(parent) / name).lstat().st_mode) for name in directories),
                'STAGE_DIRECTORY_LINK')
        for name in sorted(names):
            path = Path(parent) / name
            relative = path.relative_to(directory).as_posix()
            stage_name(relative)
            files.append({'path': relative, **stage_file_digest(path)})
            total += files[-1]['bytes']
            require(len(files) < STAGE_MAX_FILES and total <= STAGE_MAX_PAYLOAD,
                    'STAGE_PRODUCER_PAYLOAD_BOUND')
    value = {'schema': 1, 'stage': role, 'repository': STAGE_REPOSITORY,
             'run_id': stage_integer(context['run_id']), 'run_attempt': stage_integer(context['run_attempt']),
             'job_name': STAGE_JOB_NAMES[role], 'source': {'head': context['head'], 'tree': context['tree']},
             'files': sorted(files, key=lambda row: row['path'])}
    raw = (json.dumps(value, indent=2, sort_keys=True) + '\n').encode()
    require(len(raw) <= STAGE_MAX_JSON and total + len(raw) <= STAGE_MAX_PAYLOAD,
            'STAGE_PRODUCER_PAYLOAD_BOUND')
    for row in files:
        require(stage_file_digest(directory.joinpath(*stage_name(row['path']))) ==
                {key: row[key] for key in ('bytes', 'sha256')}, 'STAGE_PRODUCER_REREAD')
    with (directory / STAGE_MANIFEST).open('xb') as stream:
        stream.write(raw)
    return {'payload_bytes': total + len(raw),
            'manifest_sha256': hashlib.sha256(raw).hexdigest()}


def load_authenticated_stage_inputs(consumer_stage, trusted_needs, context, token, import_root):
    dependencies = stage_dependencies(consumer_stage, trusted_needs)
    require(dependencies, 'STAGE_BUILD_HAS_NO_IMPORTED_INPUTS')
    temporary = Path(context['runner_temp']).resolve(strict=True)
    workspace = Path(context['workspace']).resolve(strict=True)
    evidence = Path(context['evidence_root']).resolve(strict=True)
    import_root = Path(import_root)
    require(import_root.is_absolute() and '..' not in import_root.parts and not import_root.exists() and
            import_root.is_relative_to(temporary) and not import_root.is_relative_to(workspace) and
            not import_root.is_relative_to(evidence) and not evidence.is_relative_to(import_root),
            'STAGE_IMPORT_OUTSIDE_CURRENT_SOURCE')
    for parent in [*reversed(import_root.parent.parents), import_root.parent]:
        require(stat.S_ISDIR(parent.lstat().st_mode), 'STAGE_DIRECTORY_LINK')
    expected = {role: stage_expected(role, trusted_needs[role], context) for role in dependencies}
    proofs = {}
    for role, wanted in expected.items():
        path = '/actions/runs/' + str(wanted['run_id']) + '/attempts/' + str(wanted['run_attempt'])
        run, run_sha = _stage_api(path, token)
        jobs, jobs_sha = _stage_api(path + '/jobs?per_page=100&page=1', token)
        artifact, artifact_sha = _stage_api('/actions/artifacts/' + str(wanted['artifact_id']), token)
        proof = stage_service_proof(wanted, run, jobs, artifact)
        proof['authenticated_api_response_sha256'] = {'run_attempt': run_sha, 'jobs': jobs_sha,
                                                       'artifact': artifact_sha}
        proofs[role] = proof
    import_root.mkdir(mode=0o700)
    imported = {}
    for role, wanted in expected.items():
        directory = import_root / role
        directory.mkdir(mode=0o700)
        archive = directory / 'artifact.zip'
        _stage_download(wanted, proofs[role], token, archive)
        imported[role] = verify_stage_zip(archive, wanted, proofs[role], directory / 'payload')
    return {'imported_provenance': imported, 'current_runner_commands_imported': False,
            'signed_urls_or_credentials_retained': False}


def _simulator_optional(r, name, argv, timeout, diagnostic=False):
    """A failed diagnostic is retained, and cannot replace the primary failure."""
    try:
        r.run(name, argv, timeout=timeout, required=False, diagnostic=diagnostic)
    except Exception as error:
        r.receipt.setdefault('simulator_diagnostic_exceptions', []).append(
            {'command': name, 'error_type': type(error).__name__})
        try:
            r.persist()
        except Exception:
            pass


def simulator_resources(r, label, diagnostic=False):
    """No command arguments/environment dumps; every snapshot is bounded."""
    for suffix, argv in [
        ('memory', ['/usr/bin/vm_stat']),
        ('disk', ['/bin/df', '-k', '/System/Volumes/Data']),
        ('processes', ['/bin/ps', '-axo', 'pid,ppid,%cpu,%mem,state,etime,comm']),
    ]:
        _simulator_optional(r, label + '-' + suffix, argv, 10, diagnostic)


def simulator_install_diagnostics(r, device=None, phase='install'):
    """At most 80 command seconds; 55 before a controlled device exists."""
    require(phase in ('install', 'startup'), 'SIMULATOR_DIAGNOSTIC_PHASE')
    simulator_resources(r, 'simulator-' + phase + '-failure', diagnostic=True)
    guest = ('process == "installd" OR process == "containermanagerd" OR '
             'process == "lsd" OR process == "SpringBoard" OR process == "runningboardd"')
    host = ('process == "CoreSimulatorService" OR process == "simdiskimaged" OR '
            'subsystem BEGINSWITH "com.apple.CoreSimulator"')
    if device is not None:
        _simulator_optional(r, 'simulator-installer-log',
                            ['xcrun', 'simctl', 'spawn', device, 'log', 'show', '--last', '15m',
                             '--style', 'json', '--predicate', guest], 25, diagnostic=True)
    _simulator_optional(r, 'simulator-host-service-log',
                        ['/usr/bin/log', 'show', '--last', '15m', '--style', 'json',
                         '--predicate', host], 25, diagnostic=True)


def prepare_simulator(r, label):
    """Actual toolchain + actual available inventory -> one fresh controlled UUID."""
    require(label in ('normal', 'internal'), 'SIMULATOR_LANE_LABEL')
    tools = json.loads(read_native_file(r.output / 'toolchain.json'))
    sdk, architecture = tools['simulator-sdk'], tools['architecture']
    head = r.receipt['source']['head']
    require(re.fullmatch(r'[0-9a-f]{40}', head), 'SIMULATOR_SOURCE_HEAD')
    device = None
    simulator_resources(r, 'simulator-before-inventory')
    try:
        # The first real inventory call may initialize the cold host service.
        # Required registry/container commands below establish actual support.
        document = json.loads(r.text('simulator-inventory', ['xcrun', 'simctl', 'list', '--json'], timeout=300))
        runtime, template = available_iphone(document, sdk, architecture)
        created = r.text('simulator-create', ['xcrun', 'simctl', 'create', 'C47-' + label + '-' + head[:12],
                                           template['deviceTypeIdentifier'], runtime['identifier']], timeout=60)
        require(str(uuid.UUID(created)).lower() == created.lower(), 'SIMULATOR_UDID')
        device = created
        r.receipt['simulator'] = {
            'udid': device, 'runtime': runtime, 'template': template,
            'selection': {'policy': 'Actual SDK major/minor first, then existing compact preference',
                          'sdk_version': sdk, 'host_architecture': architecture,
                          'sdk_major_minor_match': runtime['version'].split('.')[:2] == sdk.split('.')[:2],
                          'logical_width_qualified': False},
        }
        r.persist()
        simulator_resources(r, 'simulator-before-boot')
        r.run('simulator-boot', ['xcrun', 'simctl', 'boot', device], timeout=60)
        r.run('simulator-bootstatus', ['xcrun', 'simctl', 'bootstatus', device, '-b'], timeout=600)
        return device
    except Exception:
        simulator_install_diagnostics(r, device, phase='startup')
        raise


def install_simulator_app(r, device, app, bundle):
    """One parsed readiness/absence observation, one install, actual lookup.

    Call only for the UUID just returned by prepare_simulator. The consuming
    lane must first authenticate the same-new-HEAD product and complete app
    inventory. No installed/UI/acceptance stage is marked here.
    """
    require(isinstance(device, str) and str(uuid.UUID(device)).lower() == device.lower() and
            r.receipt.get('simulator', {}).get('udid') == device, 'SIMULATOR_UDID')
    require(re.fullmatch(r'[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+', bundle), 'PRODUCT_BUNDLE_ID')
    simulator_resources(r, 'simulator-before-install')
    try:
        paths = r.run('simulator-registry-ready', ['xcrun', 'simctl', 'listapps', device], timeout=600)
        # listapps can emit an OpenStep property list. Use the installed system
        # converter rather than assuming XML, JSON, or inventing a plist parser.
        raw = read_native_file(paths[0])
        require(0 < len(raw) <= 4 * 1024 * 1024, 'SIMULATOR_REGISTRY_SIZE')
        registry = json.loads(r.text('simulator-registry-json',
                                    ['/usr/bin/plutil', '-convert', 'json', '-o', '-', paths[0]], timeout=15))
        require(isinstance(registry, dict) and bool(registry) and
                all(isinstance(row, dict) for row in registry.values()), 'SIMULATOR_REGISTRY_SHAPE')
        require(bundle not in registry and not any(row.get('CFBundleIdentifier') == bundle
                                                   for row in registry.values()),
                'SIMULATOR_TARGET_ALREADY_INSTALLED')
        r.run('simulator-install', ['xcrun', 'simctl', 'install', device, app], timeout=600)
        container = r.text('simulator-installed-container',
                           ['xcrun', 'simctl', 'get_app_container', device, bundle, 'app'], timeout=300)
        require(Path(container).is_absolute() and Path(container).is_dir() and
                Path(container).suffix == '.app', 'SIMULATOR_INSTALLED_APP_CONTAINER')
        return container
    except Exception:
        simulator_install_diagnostics(r, device)
        raise


def _produced_app_name(name):
    require(isinstance(name, str) and 0 < len(name.encode('utf-8')) <= 1024 and
            unicodedata.normalize('NFC', name) == name and
            not re.search(r'[\\:\x00-\x1f\x7f]', name) and
            all(part and part not in ('.', '..') and not part.endswith(('.', ' '))
                for part in name.split('/')), 'IMPORTED_APP_PATH')
    return name


def _produced_app_tar_pass(stream, files, destination=None):
    """One closed normal-app format; first pass verifies every byte before any extraction."""
    require(isinstance(files, list) and 0 < len(files) < 10000, 'IMPORTED_APP_INVENTORY_BOUND')
    expected = {'LayerwellStaging.app': {'type': 'directory', 'mode': '0o755'}}
    aliases, total = {'layerwellstaging.app'}, 0
    for row in files:
        require(isinstance(row, dict) and row.get('type') in ('file', 'directory'), 'IMPORTED_APP_INVENTORY_TYPE')
        name = 'LayerwellStaging.app/' + _produced_app_name(row.get('path'))
        require(name.casefold() not in aliases, 'IMPORTED_APP_PATH_ALIAS')
        aliases.add(name.casefold())
        required = {'path', 'type', 'mode'} | ({'bytes', 'sha256'} if row['type'] == 'file' else set())
        require(set(row) == required and row['mode'] in
                (('0o644', '0o755') if row['type'] == 'file' else ('0o755',)), 'IMPORTED_APP_INVENTORY_MODE')
        if row['type'] == 'file':
            require(type(row['bytes']) is int and 0 <= row['bytes'] <= MAX_APP and
                    isinstance(row['sha256'], str) and re.fullmatch(r'[a-f0-9]{64}', row['sha256']),
                    'IMPORTED_APP_INVENTORY_FILE')
            total += row['bytes']
            require(total <= 2 * 1024 * MIB, 'IMPORTED_APP_EXPANDED_BOUND')
        expected[name] = {key: value for key, value in row.items() if key != 'path'}
    for name in expected:
        if '/' in name:
            require(expected.get(name.rsplit('/', 1)[0], {}).get('type') == 'directory',
                    'IMPORTED_APP_PARENT_DIRECTORY')
    seen = set()
    stream.seek(0)
    class BoundedTar:
        def __init__(self, raw):
            self.raw, self.observed = raw, 0

        def read(self, count):
            require(type(count) is int and 0 <= count <= MIB, 'IMPORTED_APP_TAR_READ_BOUND')
            chunk = self.raw.read(count)
            self.observed += len(chunk)
            require(self.observed <= total + 16 * MIB, 'IMPORTED_APP_TAR_EXPANSION_BOUND')
            return chunk

    with gzip.GzipFile(fileobj=stream, mode='rb') as raw:
        with tarfile.open(fileobj=BoundedTar(raw), mode='r|') as archive:
            for member in archive:
                name = _produced_app_name(member.name)
                require(len(seen) < 10000 and name in expected and name not in seen,
                        'IMPORTED_APP_MEMBER_INVENTORY')
                seen.add(name)
                require(member.type in (tarfile.DIRTYPE, tarfile.REGTYPE, tarfile.AREGTYPE) and
                        not member.sparse and not member.linkname and
                        set(member.pax_headers) <= {'path', 'mtime'} and
                        all(isinstance(value, str) and len(value) <= 1024 for value in member.pax_headers.values()) and
                        member.pax_headers.get('path', name) in ([name, name + '/'] if member.isdir() else [name]),
                        'IMPORTED_APP_MEMBER_TYPE')
                row = expected[name]
                kind = 'directory' if member.isdir() else 'file'
                require(row['type'] == kind and oct(member.mode) == row['mode'] and
                        member.size == (row['bytes'] if kind == 'file' else 0), 'IMPORTED_APP_MEMBER_METADATA')
                target = destination.joinpath(*name.split('/')) if destination is not None else None
                if kind == 'directory':
                    if target is not None:
                        target.mkdir(mode=0o755)
                        target.chmod(0o755)
                    continue
                digest, size = hashlib.sha256(), 0
                descriptor = None
                if target is not None:
                    require(all(stat.S_ISDIR(parent.lstat().st_mode)
                                for parent in [target.parent, *target.parent.parents]), 'IMPORTED_APP_TARGET_DIRECTORY')
                    descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_NOFOLLOW', 0), 0o600)
                try:
                    with archive.extractfile(member) as source:
                        while True:
                            chunk = source.read(MIB)
                            if not chunk:
                                break
                            size += len(chunk)
                            require(size <= row['bytes'], 'IMPORTED_APP_FILE_BOUND')
                            digest.update(chunk)
                            if descriptor is not None:
                                with memoryview(chunk) as pending:
                                    while pending:
                                        written = os.write(descriptor, pending)
                                        require(written > 0, 'IMPORTED_APP_WRITE')
                                        pending = pending[written:]
                    require(size == row['bytes'] and digest.hexdigest() == row['sha256'], 'IMPORTED_APP_FILE_HASH')
                finally:
                    if descriptor is not None:
                        os.close(descriptor)
                if target is not None:
                    target.chmod(int(row['mode'], 8))
    require(seen == set(expected), 'IMPORTED_APP_INVENTORY_COMPLETE')
    return {'members': len(seen), 'regular_bytes': total,
            'qualification': 'ARCHIVE_BYTES_AND_SHAPE_ONLY_NOT_MACH_O_OR_RUNTIME_PROOF'}


def consume_produced_app(r, producer, expected_head, architecture, destination):
    """Consume the authenticated same-source build; never represent this as a current-job compile."""
    require_simulator_host(architecture)
    require(re.fullmatch(r'[a-f0-9]{40}', expected_head) and
            r.receipt['source']['head'] == expected_head, 'IMPORTED_APP_CURRENT_SOURCE')
    reuse = r.receipt.get('authenticated_app_build_reuse25')
    product_source = reuse['producer_source'] if reuse else r.receipt['source']
    product_head = product_source['head']
    producer, destination = Path(producer), Path(destination).absolute()
    temporary = Path(os.environ['RUNNER_TEMP']).resolve(strict=True)
    require(destination.parent == temporary and not os.path.lexists(destination) and
            all(stat.S_ISDIR(parent.lstat().st_mode) for parent in [temporary, *temporary.parents]),
            'IMPORTED_APP_FRESH_RUNNER_TEMP')
    receipt_raw = read_native_file(producer / 'app-artifact.json')
    inventory_raw = read_native_file(producer / 'app-inventory.json')
    receipt, inventory = stage_json(receipt_raw), stage_json(inventory_raw)
    require(receipt.get('file') == 'signed-simulator-app.tar.gz' and
            receipt.get('source_head') == product_head and
            receipt.get('configuration') == 'Release' and receipt.get('lane') == 'normal-staging' and
            receipt.get('standalone_embedded_javascript') is True and
            receipt.get('not_an_iphone_or_testflight_release') is True and
            receipt.get('platform') == 'iOS Simulator' and receipt.get('architectures') == [architecture] and
            receipt.get('bundle_id') == 'com.layerwell.app.staging' and
            receipt.get('executable') == 'LayerwellStaging', 'IMPORTED_APP_PRODUCER_IDENTITY')
    require(inventory.get('source', {}).get('head') == product_head and
            inventory['source'].get('tree') == product_source['tree'] and
            inventory.get('configuration') == 'Release' and inventory.get('lane') == 'normal-staging' and
            hashlib.sha256(inventory_raw).hexdigest() == receipt.get('inventory_sha256'),
            'IMPORTED_APP_INVENTORY_IDENTITY')
    files = inventory.get('files')
    require(isinstance(files, list) and all(any(row.get('path') == name and row.get('type') == 'file' and
            type(row.get('bytes')) is int and row['bytes'] > 0 for row in files if isinstance(row, dict))
            for name in ['Info.plist', 'LayerwellStaging', 'main.jsbundle']), 'IMPORTED_APP_REQUIRED_FILES')
    archive_path = producer / receipt['file']
    before = archive_path.lstat()
    stamp = lambda value: (value.st_dev, value.st_ino, value.st_mode, value.st_nlink, value.st_size,
                           value.st_mtime_ns, value.st_ctime_ns)
    require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and type(receipt.get('bytes')) is int and
            0 < before.st_size == receipt['bytes'] <= MAX_APP and
            isinstance(receipt.get('sha256'), str) and re.fullmatch(r'[a-f0-9]{64}', receipt['sha256']),
            'IMPORTED_APP_ARCHIVE_BOUND')
    descriptor = os.open(archive_path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
    with os.fdopen(descriptor, 'rb') as stream:
        require(stamp(os.fstat(stream.fileno())) == stamp(before), 'IMPORTED_APP_ARCHIVE_OPEN_RACE')
        digest = hashlib.sha256()
        for chunk in iter(lambda: stream.read(MIB), b''):
            digest.update(chunk)
        require(digest.hexdigest() == receipt['sha256'], 'IMPORTED_APP_ARCHIVE_HASH')
        shape = _produced_app_tar_pass(stream, files)
        destination.mkdir(mode=0o700)
        require(_produced_app_tar_pass(stream, files, destination) == shape, 'IMPORTED_APP_EXTRACTION_DRIFT')
        require(stamp(os.fstat(stream.fileno())) == stamp(before) and
                stamp(archive_path.lstat()) == stamp(before), 'IMPORTED_APP_ARCHIVE_RACE')
    app = destination / 'LayerwellStaging.app'
    require(bundle_inventory(app) == files, 'IMPORTED_APP_EXTRACTED_INVENTORY')
    info = plistlib.loads(read_native_file(app / 'Info.plist'))
    binary = app / receipt['executable']
    bundle, executable, archs = validate_product(info,
        r.text('imported-product-file', ['file', binary]),
        r.text('imported-product-architectures', ['lipo', '-archs', binary]),
        r.text('imported-product-build-version', ['xcrun', 'vtool', '-show-build', binary]), architecture)
    require((bundle, executable, archs) == (receipt['bundle_id'], receipt['executable'], receipt['architectures']),
            'IMPORTED_APP_CURRENT_PRODUCT_IDENTITY')
    signing = simulator_signing().inspect_product(r, sys.modules[__name__], app, bundle, 'imported-signed-product')
    simulator_signing().validate_ordinary_product(signing)
    require(signing == receipt.get('simulator_signing'), 'IMPORTED_POST_SIGNING_IDENTITY')
    require(simulator_signing().check_diagnostic_bundle(sys.modules[__name__], app, False) ==
            receipt.get('ordinary_javascript'), 'IMPORTED_ORDINARY_WITHOUT_DIAGNOSTICS')
    provenance = {'origin': 'AUTHENTICATED_PRODUCER_APP_NOT_COMPILED_IN_THIS_JOB',
        'source_head': product_head, 'source_tree': inventory['source']['tree'],
        'runtime_candidate_source': r.receipt['source'],
        'producer_app_receipt_sha256': hashlib.sha256(receipt_raw).hexdigest(),
        'producer_app_archive_sha256': receipt['sha256'], 'producer_app_archive_bytes': receipt['bytes'],
        'producer_app_inventory_sha256': receipt['inventory_sha256'],
        'configuration': 'Release', 'lane': 'normal-staging', 'bundle_id': bundle, 'executable': executable,
        'authenticated_executable': app_executable_identity(files, executable),
        'current_host_architecture': architecture, 'current_job_product_probes': True,
        'archive_shape': shape, 'acceptance_granted': False, 'release': 'NO_GO'}
    return app, bundle, provenance

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
            'status': 'RUNNING', 'stage_complete': False, 'upstream_payload_bytes': 0, 'commands': [], 'stages': {},
            'lane': 'normal-staging', 'internal_supported_owner': 'NOT_RUN',
            'widget_extension': 'EXCLUDED_BY_EXISTING_SIMULATOR_PROFILE',
            'campaign_candidate_complete': False, 'acceptance_granted': False, 'release': 'NO_GO',
            'limitations': ['Simulator only; no physical iPhone, power-loss, device/distribution signing, camera/OCR accuracy, provider, clinical, or owner admission'],
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
        capture_lock = threading.Lock()
        capture_frozen = False
        stdout.touch()
        stderr.touch()
        try:
            process = subprocess.Popen(list(map(str, argv)), cwd=cwd or self.root,
                                       env=env or self.env, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                       start_new_session=(os.name != 'nt'))
            stream_failures = []
            def copy(pipe, destination, display):
                # A descendant can retain its pipe after the command exits.
                # Only this lock may admit writes to the retained evidence.
                with capture_lock:
                    if capture_frozen:
                        return
                    target = destination.open('wb', buffering=0)
                with target:
                    try:
                        for chunk in iter(lambda: pipe.read(65536), b''):
                            with capture_lock:
                                if capture_frozen:
                                    break
                                require(target.write(chunk) == len(chunk), 'SHORT_LOG_WRITE')
                            if name == 'dependency-graph' and destination == stdout:
                                continue  # Full immutable JSON remains in the retained raw stdout.
                            if hasattr(display, 'buffer'):
                                display.buffer.write(chunk)
                                display.buffer.flush()
                            else:
                                display.write(chunk.decode('utf-8', errors='replace'))
                                display.flush()
                    except Exception as error:
                        stream_failures.append(type(error).__name__)
                    finally:
                        pipe.close()
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
            closed = not any(thread.is_alive() for thread in threads)
            row['capture_complete'] = closed and not stream_failures
            if not row['capture_complete']:
                row.update(process_exit_code=code,
                           error_type='LOG_STREAM_DID_NOT_CLOSE' if not closed else 'LOG_STREAM_FAILURE',
                           stream_error_types=list(stream_failures),
                           output_scope='PARTIAL_BYTES_FROZEN_BEFORE_RECEIPT_HASHING')
                code = code if code != 0 else 125
            if closed:
                process.stdout.close()
                process.stderr.close()
            row.update(exit_code=code, state='PASS' if code == 0 else 'FAIL')
        except OSError as error:
            stdout.touch(exist_ok=True)
            stderr.write_text(str(error), encoding='utf-8')
            row.update(exit_code=127, state='FAIL', error_type=type(error).__name__)
        except Exception as error:
            row.update(exit_code=124 if row.get('timed_out') else 125, state='FAIL',
                       error_type=type(error).__name__, capture_complete=False,
                       output_scope='PARTIAL_BYTES_FROZEN_BEFORE_RECEIPT_HASHING')
            raise
        finally:
            # Late pipe data must never mutate a hashed log or final manifest.
            # Unbuffered writes and the shared gate make the partial bytes final.
            with capture_lock:
                capture_frozen = True
            row['finished_utc'] = utc()
            for label, path in [('stdout', stdout), ('stderr', stderr)]:
                if path.exists():
                    row[label + '_bytes'] = path.stat().st_size
                    row[label + '_sha256'] = sha(path)
            self.persist()
        if name == 'dependency-graph':
            print('C47_DEPENDENCY_GRAPH_RAW_CAPTURE ' + json.dumps({key: row[key] for key in
                ('state', 'exit_code', 'stdout_bytes', 'stdout_sha256')}), flush=True)
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


def prepare(r, source_controls=True):
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
    tools['app_simulator_build_flags'] = APP_SIMULATOR_BUILD_FLAGS
    tools['runner_image'] = {key: os.environ.get(key) for key in ('ImageOS', 'ImageVersion', 'RUNNER_OS', 'RUNNER_ARCH')}
    tools['build_environment'] = ENVIRONMENT
    write_json(r.output / 'toolchain.json', tools)
    r.passed('toolchain', tools)
    r.run('normal-install', ['npm', 'ci', '--no-audit', '--no-fund'], timeout=1000)
    r.run('postinstall-check', ['npm', 'run', 'postinstall:check'], timeout=180)
    if source_controls:
        r.run('swift-behavior47', ['python3', '-I', '-B',
              'scripts/release/full-app-j01/swift_behavior47.py', '--output', r.output / 'swift-behavior47'], timeout=120)
        r.run('ocr-source-contract', ['npm', 'run', 'cat05:native-ocr-source-contract:test'], timeout=240)
        r.run('existing-workflow-contract', ['npm', 'run', 'phase5:ios-simulator-compile-workflow:test'], timeout=120)
        r.run('generated47-controls', ['node', '--test', 'scripts/release/full-app-j01/native_generated47.test.mjs'], timeout=1800)
        r.run('generated47-properties-controls', ['python3', '-I', '-B', 'scripts/release/full-app-j01/pods_compat47.test.py'], timeout=120)
    source47 = r.output / 'current-generated47-source.json'
    r.run('current-generated47-source', ['node', 'scripts/release/full-app-j01/native_generated47.mjs',
                                       '--phase', 'SOURCE', '--output', source47], timeout=600)
    r.run('dependency-graph', ['npm', 'ls', '--all', '--json', '--long'], timeout=180)
    r.source_proof('source-after-install', head)
    r.passed('installation', {'normal_hooks_executed': True, 'reviewed_native_source': 'CURRENT_SOURCE47_TECHNICAL_ONLY'})
    return head, tools, source47


def execute_retained_consent_runtime27(r, token):
    """Runtime-only continuation of its authenticated diagnostic; no app producer."""
    require(platform.system() == 'Darwin', 'MACOS_REQUIRED')
    head = os.environ.get('C47_EXPECTED_HEAD', '')
    require(re.fullmatch(r'[a-f0-9]{40}', head), 'EXPECTED_HEAD_REQUIRED')
    require(os.environ.get('C47_UI_PHASE') == 'normal-staging', 'NORMAL_STAGING_PHASE_REQUIRED')
    for key, value in ENVIRONMENT.items():
        require(r.env.get(key) == value, 'BUILD_ENVIRONMENT:' + key)
    require(Path(r.env['DEVELOPER_DIR']).is_dir(), 'PINNED_XCODE_UNAVAILABLE')
    require(bool(token), 'CONSENT_RUNTIME27_ARTIFACT_TOKEN_REQUIRED')
    require('C47_ARTIFACT_READ_TOKEN' not in r.env and
            'C47_ARTIFACT_READ_TOKEN' not in os.environ, 'ARTIFACT_TOKEN_CHILD_ENV_FORBIDDEN')
    r.env['C46_EXPECTED_HEAD'] = head
    r.receipt['source'] = r.source_proof('source-before-consent-runtime27', head)
    r.passed('source', r.receipt['source'])
    path = r.root / 'scripts/release/full-app-j01/consent_trace47.py'
    spec = importlib.util.spec_from_file_location('c47_retained_consent_runtime27', path)
    diagnostic = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(diagnostic)
    try:
        diagnostic.run_retained_runtime27(r, sys.modules[__name__], token)
    finally:
        try:
            r.source_proof('source-after-consent-runtime27', head)
        finally:
            retain_result_bundles(r)
    r.receipt.update(status='CONSENT_RETAINED_RUNTIME_DIAGNOSTIC_ONLY_27', ordinary_admitted=False,
                     internal_supported_owner='NOT_RUN', finished_utc=utc())
    r.persist()


def execution_mode(stage, *, probe=False, resume25=False, consent_trace04=False, consent_runtime27=False):
    require(stage in ('source', 'build', 'normal', 'internal'), 'EXECUTION_STAGE')
    require(sum(map(bool, (probe, resume25, consent_trace04, consent_runtime27))) <= 1, 'EXCLUSIVE_EXECUTION_MODE')
    require(not probe or stage == 'build', 'PROBE_BUILD_STAGE_ONLY')
    require(not resume25 or stage == 'normal', 'REUSE25_NORMAL_ONLY')
    require(not consent_trace04 or stage == 'build', 'CONSENT_TRACE_BUILD_STAGE_ONLY')
    require(not consent_runtime27 or stage == 'build', 'CONSENT_RUNTIME27_BUILD_STAGE_ONLY')
    return 'consent-runtime27' if consent_runtime27 else 'consent-trace04' if consent_trace04 else 'probe' if probe else 'reuse25' if resume25 else stage


def execute(r, compile_only=False, consent_trace04=False, source_provenance=None):
    head, tools, source47 = prepare(r, source_controls=source_provenance is None)
    if source_provenance is not None:
        r.receipt['authenticated_source_controls04'] = verify_source_producer04(r, source_provenance)
        r.persist()
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
    signing = simulator_signing()
    bundle_id = 'com.layerwell.app.staging'
    ent = signing.configure_app(r, sys.modules[__name__], ios, bundle_id)
    signing.check_effective_app(r, sys.modules[__name__], ['xcodebuild', '-workspace', workspace, '-scheme', scheme,
        '-configuration', 'Release', '-sdk', 'iphonesimulator', *APP_SIMULATOR_BUILD_FLAGS],
        bundle_id, ent, 'native-build-settings')
    r.passed('native-generation', {'workspace': str(workspace), 'scheme': scheme,
                                   'inputs': {p.name: sha(p) for p in native.iterdir() if p.is_file()}})
    products = Path(os.environ['RUNNER_TEMP']) / 'c47-native-products'
    products.mkdir(exist_ok=False)
    derived = products / 'derived'
    build_argv = ['xcodebuild', '-workspace', workspace, '-scheme', scheme,
                          '-configuration', 'Release', '-sdk', 'iphonesimulator',
                          '-destination', 'generic/platform=iOS Simulator', '-derivedDataPath', derived,
                          *APP_SIMULATOR_BUILD_FLAGS]
    if consent_trace04:
        path = r.root / 'scripts/release/full-app-j01/consent_trace47.py'
        spec = importlib.util.spec_from_file_location('c47_consent_trace04', path)
        diagnostic = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(diagnostic)
        diagnostic.run_trace(r, sys.modules[__name__], ios, build_argv, products, bundle_id, head)
        # Actual installed Xcode help/schema/output; diagnostic reads never admit a test.
        for kind in ('summary', 'tests'):
            r.run('xcresult04-help-' + kind, ['xcrun', 'xcresulttool', 'help', 'get', 'test-results', kind],
                  timeout=30, required=False)
            r.run('xcresult04-schema-' + kind, ['xcrun', 'xcresulttool', 'get', 'test-results', kind, '--schema'],
                  timeout=30, required=False)
            r.run('xcresult04-actual-' + kind, ['xcrun', 'xcresulttool', 'get', 'test-results', kind,
                  '--path', products / 'ui.xcresult', '--compact'], timeout=30, required=False)
        r.source_proof('source-after-consent-diagnostic-restoration', head, allow_generation=True)
        r.receipt.update(status='CONSENT_LIFECYCLE_DIAGNOSTIC_ONLY_04', finished_utc=utc())
        r.persist()
        return
    signing.run_app_diagnostic(r, sys.modules[__name__], ios, build_argv, products, bundle_id, head)
    r.run('native-build', build_argv + ['-resultBundlePath', products / 'build.xcresult', 'build'], timeout=3000)
    signing.retain_applied_outputs(sys.modules[__name__], derived, r.output/'simulator-signing/applied-xcent')
    r.source_proof('source-after-build', head, allow_generation=True)
    apps = list((derived / 'Build/Products/Release-iphonesimulator').glob('*.app'))
    require(len(apps) == 1, 'PRODUCT_COUNT')
    app = apps[0]
    bundle, _, archive_receipt = retain_app(r, app, products, head, tools['architecture'],
                                           'Release', 'normal-staging')
    r.passed('compiled', archive_receipt)
    if compile_only:
        r.receipt.update(status='BUILD_NATIVE_COMPILED_RUNTIME_NOT_RUN', finished_utc=utc())
        r.persist()
        return
    run_normal(r, ios, products, app, bundle, head)


def run_normal(r, ios, products, app, bundle, head):
    device = prepare_simulator(r, 'normal')
    installed = install_simulator_app(r, device, app, bundle)
    verify_installed_app(r, installed, app, bundle)
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
                                                         'launchctl', 'list'], timeout=120)
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
                                     '-default-test-execution-time-allowance', '600',
                                     '-maximum-test-execution-time-allowance', '600',
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


def evidence_total(r, root=None):
    reserved = r.receipt.get('upstream_payload_bytes', 0)
    require(type(reserved) is int and 0 <= reserved <= MAX_EVIDENCE, 'UPSTREAM_EVIDENCE_BOUND')
    return evidence_size(root or getattr(r, 'evidence_root', r.output)) + reserved


def app_executable_identity(files, executable):
    rows = [row for row in files if row.get('path') == executable]
    require(len(rows) == 1 and rows[0].get('type') == 'file' and
            type(rows[0].get('bytes')) is int and rows[0]['bytes'] > 0 and
            isinstance(rows[0].get('sha256'), str) and re.fullmatch(r'[a-f0-9]{64}', rows[0]['sha256']),
            'AUTHENTICATED_APP_EXECUTABLE_ROW')
    return {key: rows[0][key] for key in ('bytes', 'sha256')}


def verify_installed_app(r, container, app, bundle):
    installed = Path(container).resolve(strict=True)
    info = plistlib.loads(read_native_file(app / 'Info.plist'))
    current = plistlib.loads(read_native_file(installed / 'Info.plist'))
    executable = info['CFBundleExecutable']
    require(current.get('CFBundleIdentifier') == bundle == info['CFBundleIdentifier'] and
            current.get('CFBundleExecutable') == executable, 'INSTALLED_PRODUCT_IDENTITY')
    imported = r.receipt['stages'].get('verified-produced-app', {}).get('details')
    if imported is not None:
        require(imported.get('bundle_id') == bundle and imported.get('executable') == executable,
                'INSTALLED_AUTHENTICATED_PRODUCT_IDENTITY')
        authenticated = imported['authenticated_executable']
        inventory_sha256 = imported['producer_app_inventory_sha256']
    else:
        compiled = r.receipt['stages']['compiled']['details']
        raw = read_native_file(r.output / 'app-inventory.json')
        require(hashlib.sha256(raw).hexdigest() == compiled['inventory_sha256'] and
                compiled.get('bundle_id') == bundle and compiled.get('executable') == executable,
                'INSTALLED_RETAINED_COMPILED_INVENTORY')
        authenticated = app_executable_identity(stage_json(raw)['files'], executable)
        inventory_sha256 = compiled['inventory_sha256']
    expected = stage_file_digest(app / executable, MAX_APP)
    observed = stage_file_digest(installed / executable, MAX_APP)
    require(observed == expected == authenticated, 'INSTALLED_EXECUTABLE_BYTES')
    r.passed('installed', {'udid': r.receipt['simulator']['udid'], 'bundle_id': bundle,
        'source_head': r.receipt['source']['head'], 'installed_executable_sha256': observed['sha256'],
        'expected_executable_sha256': expected['sha256'], 'executable_bytes': observed['bytes'],
        'authenticated_inventory_sha256': inventory_sha256,
        'qualification': 'ACTUAL_INSTALL_ZERO_AND_CONTAINER_LOOKUP_WITH_EXACT_EXECUTABLE_BYTES'})


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
    signing = simulator_signing().inspect_product(r, sys.modules[__name__], app, bundle, 'signed-product')
    simulator_signing().validate_ordinary_product(signing)
    ordinary_js = simulator_signing().check_diagnostic_bundle(sys.modules[__name__], app, False) if configuration == 'Release' else None
    if configuration == 'Release':
        require(b'C47_SEPARATE_CONSENT_DIAGNOSTIC_04' not in read_native_file(app / 'main.jsbundle'),
                'CONSENT_DIAGNOSTIC_IN_ORDINARY_PRODUCT')
    write_json(r.output / 'app-inventory.json', {'source': r.receipt['source'], 'lane': lane,
                                               'simulator_signing': signing, 'ordinary_javascript': ordinary_js,
                                               'configuration': configuration, 'files': bundle_inventory(app)})
    native = r.output / 'generated-native'
    native.mkdir(exist_ok=True)
    shutil.copy2(app / 'Info.plist', native / 'app-Info.plist')
    name = 'signed-simulator-app.tar.gz' if lane == 'normal-staging' else 'signed-internal-debug-simulator-app.tar.gz'
    archive = products / name
    with tarfile.open(archive, 'w:gz', dereference=False) as target:
        target.add(app, arcname=app.name)
    receipt = {'file': name, 'bytes': archive.stat().st_size, 'sha256': sha(archive),
               'inventory_sha256': sha(r.output / 'app-inventory.json'), 'source_head': head,
               'bundle_id': bundle, 'executable': executable_name, 'architectures': archs,
               'platform': 'iOS Simulator', 'lane': lane, 'configuration': configuration,
               'simulator_signing': signing, 'ordinary_javascript': ordinary_js,
               'standalone_embedded_javascript': configuration == 'Release',
               'not_an_iphone_or_testflight_release': True}
    write_json(r.output / 'app-artifact.json', receipt)
    require(archive.stat().st_size <= MAX_APP, 'APP_ARTIFACT_SIZE_BOUND')
    limit_root = getattr(r, 'evidence_root', r.output)
    require(evidence_total(r, limit_root) + archive.stat().st_size <= MAX_EVIDENCE - 48 * MIB,
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
                                                         'launchctl', 'list'], timeout=120)
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
    allowance = '600' if lane == 'normal-staging' else '900'
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
    for name in ['build.xcresult', 'keychain-build.xcresult', 'consent-trace-build.xcresult', 'ui.xcresult', 'ui-core.xcresult', 'ui-rights.xcresult',
                 'ui-export.xcresult', 'ui-export-cleanup.xcresult',
                 'ui-larger-text.xcresult']:
        source = products / name
        destination = r.output / name
        if source.is_dir() and not destination.exists():
            size = evidence_size(source)
            if size + evidence_total(r) <= MAX_EVIDENCE - 10 * MIB:
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


def executed_producer_command(receipt, directory, name, read_output=False):
    commands = [row for row in receipt.get('commands', []) if row.get('name') == name]
    require(len(commands) == 1 and commands[0].get('state') == 'PASS' and
            type(commands[0].get('exit_code')) is int and commands[0]['exit_code'] == 0,
            'PRODUCER_ACTUAL_COMMAND:' + name)
    row, raw = commands[0], []
    for stream in ('stdout', 'stderr'):
        relative = row.get(stream)
        require(isinstance(relative, str) and len(stage_name(relative)) == 2 and
                stage_name(relative)[0] == 'logs', 'PRODUCER_CURRENT_LOG_PATH')
        path = directory.joinpath(*stage_name(relative))
        observed = stage_file_digest(path)
        require(type(row.get(stream + '_bytes')) is int and observed ==
                {'bytes': row[stream + '_bytes'], 'sha256': row.get(stream + '_sha256')},
                'PRODUCER_RAW_LOG_IDENTITY')
        if read_output:
            raw.append(read_native_file(path))
    return row, tuple(raw)


def producer_source_matches(r, receipt, directory):
    source = receipt.get('source')
    reuse = r.receipt.get('authenticated_app_build_reuse25')
    expected_source = reuse['producer_source'] if reuse else r.receipt['source']
    require(isinstance(source, dict) and source == expected_source, 'PRODUCER_SAME_WHOLE_SOURCE')
    proof = stage_json(read_native_file(directory / 'current-generated47-source.json'))
    require(proof.get('phase') == 'SOURCE' and proof.get('sourceHead') == source['head'] and
            proof.get('sourceTree') == source['tree'] and proof.get('profiles') == ['development', 'staging'] and
            proof.get('descriptorSHA256') == (reuse['producer_descriptor_sha256'] if reuse else
                sha(r.root / 'docs/phase-9/ios-generated-input-succession47.v1.json')) and
            proof.get('currentNative47', {}).get('verifiedInputCount') == 202 and
            proof['currentNative47'].get('committedCriticalInputs') == 172, 'PRODUCER_CURRENT_NATIVE_INPUTS')
    require(all(row.get('state') == 'PASS' and row.get('exit_code') == 0
                for row in receipt.get('commands', []) if row.get('required')), 'PRODUCER_REQUIRED_COMMAND_FAILURE')


def producer_final_source_matches(r, receipt, directory, name):
    if getattr(r, 'receipt', {}).get('authenticated_app_build_reuse25'):
        # The exact closed historical proof is retained, never relabeled current.
        require(name == 'source-after-build.json' and sha(directory / name) ==
                '713bc30b0dc1f33135aec191c9414264843c277e5739104b7229094862145e8b',
                'REUSE25_CLOSED_ORIGIN_FINAL_SOURCE')
        return
    before = receipt['source']
    after = stage_json(read_native_file(directory / name))
    require(set(after) == set(before) and all(after.get(key) == before.get(key)
            for key in ('head', 'tree', 'base', 'base_tree', 'helper', 'helper_sha256')),
            'PRODUCER_FINAL_WHOLE_SOURCE_IDENTITY')
    if after['inventory'] == before['inventory']:
        return
    projection = directory / 'generation-projection'
    original = read_native_file(projection / 'original-package.json')
    generated = read_native_file(projection / 'generated-package.json')
    require(original == read_native_file(r.root / 'apps/mobile/package.json') and
            generated_package_projection(original, generated) == stage_json(read_native_file(projection / 'projection.json')),
            'PRODUCER_EXACT_GENERATED_PACKAGE_PROJECTION')
    inventory = after['inventory']
    require(set(inventory) == {'files', 'bytes', 'actual_inventory_sha256', 'qualification'} and
            inventory['files'] == before['inventory']['files'] and
            inventory['bytes'] == before['inventory']['bytes'] - len(original) + len(generated) and
            re.fullmatch(r'[a-f0-9]{64}', inventory['actual_inventory_sha256']) and
            inventory['qualification'] == 'ALL_SOURCE_BYTES_EXACT_EXCEPT_DECLARED_GENERATED_PACKAGE_SCRIPT_PROJECTION',
            'PRODUCER_VERIFIED_PROJECTION_FINGERPRINT')
    verifier_path = r.root / 'scripts/release/full-app-j01/source_completion46.py'
    spec = importlib.util.spec_from_file_location('c47_import_source_verifier', verifier_path)
    verifier = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(verifier)
    g = lambda *args: verifier.git(*args, root=r.root)
    require(g('rev-parse', 'HEAD').decode().strip() == before['head'], 'PRODUCER_CURRENT_SOURCE_HEAD')
    expected_inventory = projected_source_inventory(verifier, r.root, before['head'], g, generated,
                                                    authenticated_original=original)
    require(inventory == expected_inventory, 'PRODUCER_EXACT_PROJECTED_SOURCE_INVENTORY')


def full_generated_control_proof(argv, raw, source):
    require(argv == ['node', '--test', 'scripts/release/full-app-j01/native_generated47.test.mjs'],
            'BUILD_PRODUCER_FULL_SOURCE_CONTROL_COMMAND')
    names = re.findall(r"^test\('([^'\n]+)',", source, re.M)
    require(len(names) == 30 and len(set(names)) == 30, 'BUILD_PRODUCER_CURRENT_SOURCE_CONTROL_NAMES')
    tap = raw.decode('utf-8')
    for key, expected in [('tests', 30), ('pass', 30), ('fail', 0), ('skipped', 0), ('cancelled', 0), ('todo', 0)]:
        require(re.findall(r'^# ' + key + r' (\d+)\s*$', tap, re.M) == [str(expected)],
                'BUILD_PRODUCER_FULL_SOURCE_CONTROLS')
    cases = re.findall(r'^ok (\d+) - (.+)$', tap, re.M)
    require(cases == [(str(index), name) for index, name in enumerate(names, 1)] and
            re.findall(r'^1\.\.(\d+)\s*$', tap, re.M) == ['30'] and
            not re.search(r'^not ok |^ok .*#\s*(?:SKIP|TODO)\b', tap, re.M | re.I),
            'BUILD_PRODUCER_THIRTY_ACTUAL_NAMED_SOURCE_CONTROLS')


SOURCE_COMMANDS04 = (
    'normal-install', 'postinstall-check', 'swift-behavior47', 'ocr-source-contract',
    'existing-workflow-contract', 'generated47-controls', 'generated47-properties-controls',
    'current-generated47-source', 'dependency-graph',
)
SOURCE_IDENTITY_FIELDS04 = ('repository', 'run_id', 'producer_run_attempt', 'producer_job_id',
    'producer_job_name', 'artifact_id', 'artifact_name', 'wire_bytes', 'wire_sha256',
    'service_digest', 'source_head', 'source_tree')


def verify_source_producer04(r, provenance):
    directory = Path(provenance['payload_directory'])
    receipt = stage_json(read_native_file(directory / 'execution.json'))
    producer_source_matches(r, receipt, directory)
    require(receipt.get('stage') == 'source' and receipt.get('stage_complete') is True and
            receipt.get('status') == 'SOURCE_CONTROLS_PASSED_APPLICATION_NOT_BUILT' and
            receipt.get('ordinary_admitted') is False and
            not receipt.get('failure') and not receipt.get('collection_failure') and
            set(receipt.get('stages', {})) == {'source', 'toolchain', 'installation'} and
            receipt.get('internal_supported_owner') == 'NOT_RUN' and
            receipt.get('acceptance_granted') is False and receipt.get('campaign_candidate_complete') is False and
            receipt.get('release') == 'NO_GO',
            'SOURCE04_ONLY_COMPLETE_SOURCE_STAGE')
    require(provenance['producer'].get('producer_job_name') == 'C47 source' and
            provenance['producer'].get('source_head') == r.receipt['source']['head'] and
            provenance['producer'].get('source_tree') == r.receipt['source']['tree'], 'SOURCE04_PRODUCER_IDENTITY')
    require(stage_json(read_native_file(directory / 'source-before.json')) == receipt['source'] ==
            stage_json(read_native_file(directory / 'source-after-controls.json')), 'SOURCE04_UNPROJECTED_FINAL_SOURCE')
    require(all(c.get('capture_complete') is True and c.get('state') == 'PASS' and c.get('exit_code') == 0
                for c in receipt.get('commands', []) if c.get('required')), 'SOURCE04_COMPLETE_REQUIRED_COMMANDS')
    for name in SOURCE_COMMANDS04:
        executed_producer_command(receipt, directory, name)
    control, streams = executed_producer_command(receipt, directory, 'generated47-controls', read_output=True)
    raw = b'\n'.join(streams)
    current = read_native_file(r.root / 'scripts/release/full-app-j01/native_generated47.test.mjs').decode('utf8')
    full_generated_control_proof(control['argv'], raw, current)
    names = re.findall(r"^test\('([^'\n]+)'", current, re.M)
    events = re.findall(r'^(?:#\s*)?(\{"event":"C47_SOURCE_CASE_(?:BEGIN|END)"[^\n]+\})$', raw.decode('utf8'), re.M)
    events = [stage_json(event.encode()) for event in events]
    for state in ('BEGIN', 'END'):
        require([row.get('name') for row in events if row.get('event') == 'C47_SOURCE_CASE_' + state] == names,
                'SOURCE04_ALL_THIRTY_CASE_EVENTS')
    require(len(events) == 60, 'SOURCE04_EXACT_CASE_EVENT_COUNT')
    tools = stage_json(read_native_file(directory / 'toolchain.json'))
    require(tools.get('build_environment') == ENVIRONMENT and tools.get('architecture') == 'x86_64' and
            tools.get('node') == 'v22.22.2' and tools.get('npm') == '11.20.0' and
            tools.get('xcode', '').startswith('Xcode 26.4') and
            tools.get('simulator_build_flags') == SIMULATOR_BUILD_FLAGS and
            tools.get('app_simulator_build_flags') == APP_SIMULATOR_BUILD_FLAGS, 'SOURCE04_TOOLCHAIN')
    return {'producer': {key: provenance['producer'][key] for key in SOURCE_IDENTITY_FIELDS04},
            'payload_bytes': provenance['payload_bytes'],
            'source_before_sha256': sha(directory / 'source-before.json'),
            'source_after_sha256': sha(directory / 'source-after-controls.json'),
            'full_thirty_stdout_sha256': control['stdout_sha256'],
            'full_thirty_stderr_sha256': control['stderr_sha256'],
            'current_runner_commands_imported': False,
            'qualification': 'AUTHENTICATED_SAME_HEAD_SOURCE_STAGE; ACTUAL_LOCAL_INSTALL_AND_SOURCE_PROOF_STILL_REQUIRED'}


def family_payload_bytes04(imported, roles):
    require(set(imported) == set(roles), 'SOURCE04_EXACT_UPSTREAM_ROLES')
    ids, total = [], 0
    for role in roles:
        row = imported[role]
        artifact = row.get('producer', {}).get('artifact_id')
        size = row.get('payload_bytes')
        require(type(artifact) is int and artifact > 0 and type(size) is int and size > 0,
                'SOURCE04_OWN_PAYLOAD_AND_ARTIFACT_REQUIRED')
        ids.append(artifact)
        total += size
    require(len(ids) == len(set(ids)) and 0 < total < MAX_EVIDENCE, 'SOURCE04_UNIQUE_FAMILY_BUDGET')
    return total


def execute_source04(r):
    head, _, _ = prepare(r)
    r.source_proof('source-after-controls', head)
    r.receipt.update(status='SOURCE_CONTROLS_PASSED_APPLICATION_NOT_BUILT', ordinary_admitted=False, finished_utc=utc())
    r.persist()


def verify_build_producer(r, provenance, source_provenance=None):
    directory = Path(provenance['payload_directory'])
    receipt = stage_json(read_native_file(directory / 'execution.json'))
    producer_source_matches(r, receipt, directory)
    require(receipt.get('stage') == 'build' and receipt.get('status') == 'BUILD_NATIVE_COMPILED_RUNTIME_NOT_RUN' and
            receipt.get('stages', {}).get('compiled', {}).get('status') == 'PASS' and
            not any(stage in receipt['stages'] for stage in ('installed', 'launched', 'normal-staging-ui')),
            'BUILD_PRODUCER_STAGE')
    require(receipt['stages'].get('app-process-keychain', {}).get('status') == 'PASS',
            'BUILD_PRODUCER_REAL_APP_KEYCHAIN_REQUIRED')
    tools = stage_json(read_native_file(directory / 'toolchain.json'))
    require(tools.get('build_environment') == ENVIRONMENT and tools.get('architecture') == 'x86_64' and
            tools.get('node') == 'v22.22.2' and tools.get('npm') == '11.20.0' and
            tools.get('xcode', '').startswith('Xcode 26.4') and
            tools.get('simulator_build_flags') == SIMULATOR_BUILD_FLAGS and
            tools.get('app_simulator_build_flags') == APP_SIMULATOR_BUILD_FLAGS, 'BUILD_PRODUCER_LANE')
    qualified_source = receipt.get('authenticated_source_controls04')
    if qualified_source is not None:
        require(source_provenance is not None and qualified_source == verify_source_producer04(r, source_provenance),
                'SOURCE04_BUILD_REQUIRES_ITS_EXACT_SOURCE_PRODUCER')
        upstream = receipt.get('imported_provenance', {}).get('source', {})
        require(upstream.get('payload_bytes') == source_provenance['payload_bytes'] and
                all(upstream.get('producer', {}).get(key) == source_provenance['producer'].get(key)
                    for key in SOURCE_IDENTITY_FIELDS04), 'SOURCE04_BUILD_SOURCE_CHAIN')
    else:
        require(source_provenance is None, 'SOURCE04_CURRENT_BUILD_CANNOT_SUBSTITUTE_LEGACY_DIRECT_CONTROLS')
    local_controls = () if qualified_source is not None else ('swift-behavior47', 'generated47-controls')
    for name in ('normal-install', 'postinstall-check', *local_controls,
                 'current-generated47-source', 'current-generated47-native', 'current-generated47-resolved',
                 'pods', 'product-file', 'product-architectures', 'product-build-version'):
        executed_producer_command(receipt, directory, name)
    for name in ('configure-simulator-app-target','native-build-settings','app-keychain-diagnostic-build',
                 'app-keychain-diagnostic-verify-signature','signed-product-verify-signature',
                 *('app-keychain-launch-'+phase for phase in ('first','relaunch','delete')),
                 *('app-keychain-terminate-'+phase for phase in ('first','relaunch','delete'))):
        executed_producer_command(receipt, directory, name)
    if qualified_source is None:
        control, logs = executed_producer_command(receipt, directory, 'generated47-controls', read_output=True)
        full_generated_control_proof(control.get('argv'), b'\n'.join(logs),
            read_native_file(r.root / 'scripts/release/full-app-j01/native_generated47.test.mjs').decode('utf-8'))
    build, _ = executed_producer_command(receipt, directory, 'native-build')
    argv = build.get('argv', [])
    require(argv and argv[0] == 'xcodebuild' and argv[-1] == 'build' and
            all(flag in argv for flag in APP_SIMULATOR_BUILD_FLAGS) and
            argv[argv.index('-configuration') + 1] == 'Release' and
            argv[argv.index('-sdk') + 1] == 'iphonesimulator', 'BUILD_PRODUCER_REAL_RELEASE_BUILD')
    producer_final_source_matches(r, receipt, directory, 'source-after-build.json')
    app = stage_json(read_native_file(directory / 'app-artifact.json'))
    require(app == receipt['stages']['compiled']['details'], 'BUILD_PRODUCER_APP_STAGE_BINDING')
    return SimpleNamespace(receipt=receipt, output=directory, provenance=provenance)


def normal_xctest_gate(parent):
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
    return proof


def verify_normal_producer(r, provenance, build_provenance):
    directory = Path(provenance['payload_directory'])
    receipt = stage_json(read_native_file(directory / 'execution.json'))
    producer_source_matches(r, receipt, directory)
    require(receipt.get('stage') == 'normal' and
            receipt.get('status') == 'NORMAL_STAGING_NATIVE_EXECUTED_SUPPORTED_OWNER_NOT_RUN' and
            receipt.get('lane') == 'normal-staging', 'NORMAL_PRODUCER_STAGE')
    upstream = receipt.get('imported_provenance', {}).get('build', {}).get('producer')
    identity = ('repository', 'run_id', 'producer_run_attempt', 'producer_job_id', 'producer_job_name',
                'artifact_id', 'artifact_name', 'wire_bytes', 'wire_sha256', 'service_digest', 'source_head', 'source_tree')
    require(isinstance(upstream, dict) and all(upstream.get(key) == build_provenance['producer'].get(key)
                for key in identity), 'NORMAL_PRODUCER_SAME_BUILD_ARTIFACT')
    for name in ('normal-install', 'postinstall-check', 'current-generated47-source',
                 'simulator-registry-ready', 'simulator-registry-json', 'simulator-install',
                 'simulator-installed-container', 'simulator-launch', 'native-normal-staging-ui',
                 'imported-product-file', 'imported-product-architectures', 'imported-product-build-version'):
        executed_producer_command(receipt, directory, name)
    for index in range(5):
        executed_producer_command(receipt, directory, 'process-survival-' + str(index))
    stages = receipt['stages']
    require(all(stages.get(name, {}).get('status') == 'PASS' for name in
                ('verified-produced-app', 'installed', 'launched', 'normal-staging-ui')), 'NORMAL_PRODUCER_REAL_STAGES')
    app = stages['verified-produced-app']['details']
    require(app.get('source_head') == r.receipt['source']['head'] and
            app.get('source_tree') == r.receipt['source']['tree'] and
            app.get('configuration') == 'Release' and app.get('lane') == 'normal-staging' and
            app.get('bundle_id') == 'com.layerwell.app.staging' and app.get('executable') == 'LayerwellStaging' and
            app.get('current_job_product_probes') is True and
            app.get('authenticated_executable') == r.receipt['stages']['verified-produced-app']['details']['authenticated_executable'] and
            app.get('producer_app_inventory_sha256') == r.receipt['stages']['verified-produced-app']['details']['producer_app_inventory_sha256'],
            'NORMAL_PRODUCER_APP_IDENTITY')
    installed, launched = stages['installed']['details'], stages['launched']['details']
    require(installed.get('bundle_id') == app['bundle_id'] and
            installed.get('installed_executable_sha256') == installed.get('expected_executable_sha256') and
            installed.get('installed_executable_sha256') == app['authenticated_executable']['sha256'] and
            installed.get('executable_bytes') == app['authenticated_executable']['bytes'] and
            installed.get('authenticated_inventory_sha256') == app['producer_app_inventory_sha256'] and
            launched.get('bundle_id') == app['bundle_id'] and type(launched.get('pid')) is int and launched['pid'] > 0 and
            type(launched.get('survival_seconds')) is int and launched['survival_seconds'] == 30,
            'NORMAL_PRODUCER_INSTALL_AND_SURVIVAL')
    producer_final_source_matches(r, receipt, directory, 'source-after-runtime.json')
    parent = SimpleNamespace(receipt=receipt, output=directory, provenance=provenance)
    normal_xctest_gate(parent)
    return parent


RESUME25_ORIGIN = {'head': '445472ce057b90f08b5a51d5a49167c757d34b79',
    'tree': 'd90509f86079761e74d40c410004bb40ddfc671e', 'run_id': 42165447734,
    'run_attempt': 1, 'artifact_id': 13482270376,
    'digest': '58e6f56f589f5cc25f0efaffb03e2e775a09d10064d8be2de1d63bb9bca7410e',
    'payload_bytes': 130829447}


def verify_reuse25_delta(paths, old_python, new_python, old_descriptor, new_descriptor, old_ui, new_ui):
    """One pinned reuse, with every product/build input outside this finite delta identical."""
    allowed = {'scripts/release/full-app-j01/native_runtime47.py',
        'scripts/release/full-app-j01/native_runtime47.test.py',
        'scripts/release/full-app-j01/native_ui47.swift',
        'scripts/release/full-app-j01/native_ui47.rb',
        'scripts/release/full-app-j01/native_workflow47.test.mjs',
        '.github/workflows/campaign47-native-runtime.yml',
        'docs/phase-9/ios-generated-input-succession47.v1.json',
        'docs/brain/task-specs/M1X-47/CHANGE_LEDGER.json', 'docs/brain/task-specs/M1X-47/TASK.md',
        'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md'}
    require(paths and set(paths) <= allowed, 'REUSE25_NON_PRODUCT_DELTA_ONLY')
    changed_functions = {'producer_source_matches', 'producer_final_source_matches',
        'consume_produced_app', 'execute_consumer', 'execute_internal', 'main'}
    added_functions = {'verify_reuse25_delta', 'resume25_import'}
    def protected(raw):
        body = ast.parse(raw).body
        result = []
        for item in body:
            if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)) and item.name in changed_functions | added_functions:
                continue
            if isinstance(item, ast.Import) and len(item.names) == 1 and item.names[0].name == 'ast':
                continue
            if isinstance(item, ast.Assign) and len(item.targets) == 1 and isinstance(item.targets[0], ast.Name) and item.targets[0].id == 'RESUME25_ORIGIN':
                continue
            result.append(ast.dump(item, include_attributes=False))
        return result
    require(protected(old_python) == protected(new_python), 'REUSE25_BUILD_FUNCTION_OR_ENVIRONMENT_DRIFT')
    old, new = stage_json(old_descriptor), stage_json(new_descriptor)
    mutable_pins = {'scripts/release/full-app-j01/native_runtime47.py',
                    'scripts/release/full-app-j01/native_runtime47.test.py'}
    for descriptor in (old, new):
        descriptor['sourcePins'] = [pin for pin in descriptor['sourcePins'] if pin['path'] not in mutable_pins]
    require(old == new, 'REUSE25_GENERATED_INPUT_OR_SIGNING_DRIFT')
    marker = b'    func testNormalStagingAgeConsentAndUnavailableAccount() throws {'
    require(old_ui.count(marker) == new_ui.count(marker) == 1 and
            old_ui.split(marker)[1] == new_ui.split(marker)[1], 'REUSE25_SUBSTANTIVE_UI_EXPECTATIONS_DRIFT')


def resume25_import(r, context, token):
    origin = RESUME25_ORIGIN
    g = lambda *args: subprocess.check_output(['git', '--no-replace-objects', *args], cwd=r.root, env=r.env)
    require(context['head'] == r.receipt['source']['head'] and context['head'] != origin['head'] and
            g('merge-base', '--is-ancestor', origin['head'], context['head']) == b'' and
            g('rev-parse', origin['head'] + '^{tree}').decode().strip() == origin['tree'],
            'REUSE25_ORIGIN_ANCESTRY')
    paths = g('diff', '--name-only', origin['head'], context['head']).decode().splitlines()
    old = lambda name: g('show', origin['head'] + ':' + name)
    current = lambda name: read_native_file(r.root / name)
    py = 'scripts/release/full-app-j01/native_runtime47.py'
    desc = 'docs/phase-9/ios-generated-input-succession47.v1.json'
    ui = 'scripts/release/full-app-j01/native_ui47.swift'
    verify_reuse25_delta(paths, old(py), current(py), old(desc), current(desc), old(ui), current(ui))
    origin_context = {**context, **{key: origin[key] for key in ('head', 'tree', 'run_id', 'run_attempt')}}
    needs = {'build': {key: origin[key] for key in ('artifact_id', 'digest', 'run_id', 'payload_bytes')}}
    needs['build']['producer_run_attempt'] = origin['run_attempt']
    imported = load_authenticated_stage_inputs('legacy25-normal', needs, origin_context, token,
                    Path(context['runner_temp']) / 'c47-authenticated-producers')
    build = imported['imported_provenance']['build']
    require(build['producer']['producer_job_id'] == 127720729358, 'REUSE25_EXACT_BUILD_JOB')
    directory = Path(build['payload_directory'])
    require(sha(directory / 'source-before.json') ==
            'c62b6b95dd60eb0f230c951fd842534018561bdf735abfaa34fba5675e97082c',
            'REUSE25_CLOSED_ORIGIN_SOURCE')
    source = stage_json(read_native_file(directory / 'source-before.json'))
    require((source['head'], source['tree']) == (origin['head'], origin['tree']), 'REUSE25_SOURCE_IDENTITY')
    r.receipt['authenticated_app_build_reuse25'] = {'producer_source': source,
        'producer_descriptor_sha256': hashlib.sha256(old(desc)).hexdigest(),
        'runtime_candidate_source': r.receipt['source'], 'producer': build['producer'],
        'exact_non_product_changed_paths': paths, 'all_other_tracked_product_inputs_identical': True,
        'protected_coordinator_build_functions_and_environment_identical': True,
        'qualification': 'APP_ORIGIN_RETAINED; CURRENT_XCTEST_AND_INTERNAL_REQUIRED; NO_PARENT_RUNTIME_PASS'}
    r.receipt['imported_provenance'] = imported['imported_provenance']
    r.receipt['upstream_payload_bytes'] = build['payload_bytes']
    require(0 < build['payload_bytes'] < MAX_EVIDENCE, 'STAGE_COMBINED_EVIDENCE_BOUND')
    r.persist()
    return imported['imported_provenance']


def stage_imports(r, role, context, token):
    needed = {}
    for producer in STAGE_DEPENDENCIES[role]:
        prefix = 'C47_' + producer.upper() + '_'
        needed[producer] = {key: os.environ.get(prefix + name, '') for key, name in
                           [('artifact_id', 'ARTIFACT_ID'), ('digest', 'ARTIFACT_DIGEST'), ('run_id', 'RUN_ID'),
                            ('producer_run_attempt', 'RUN_ATTEMPT'), ('payload_bytes', 'PAYLOAD_BYTES')]}
    imported = load_authenticated_stage_inputs(role, needed, context, token,
                  Path(context['runner_temp']) / 'c47-authenticated-producers')
    r.receipt['imported_provenance'] = imported['imported_provenance']
    reserved = family_payload_bytes04(imported['imported_provenance'], STAGE_DEPENDENCIES[role])
    require(0 < reserved < MAX_EVIDENCE, 'STAGE_COMBINED_EVIDENCE_BOUND')
    r.receipt['upstream_payload_bytes'] = reserved
    r.persist()
    return imported['imported_provenance']


def execute_consumer(r, role, context, token, resume25=False):
    head, tools, source47 = prepare(r, source_controls=False)
    require((head, r.receipt['source']['tree']) == (context['head'], context['tree']), 'STAGE_CURRENT_SOURCE_CONTEXT')
    if resume25:
        require(role == 'normal', 'REUSE25_NORMAL_ONLY')
        imported = resume25_import(r, context, token)
    else:
        imported = stage_imports(r, role, context, token)
    source_provenance = imported.get('source')
    if source_provenance is not None:
        verify_source_producer04(r, source_provenance)
    else:
        require(resume25, 'SOURCE04_CURRENT_CONSUMER_REQUIRES_SOURCE_STAGE')
    verify_build_producer(r, imported['build'], source_provenance=source_provenance)
    app, bundle, app_proof = consume_produced_app(r, imported['build']['payload_directory'], head,
        tools['architecture'], Path(context['runner_temp']) / 'c47-verified-build-app')
    r.passed('verified-produced-app', app_proof)
    if role == 'internal':
        normal = verify_normal_producer(r, imported['normal'], imported['build'])
        r.receipt['lane'] = 'internal-stage-supervisor'
        r.persist()
        execute_internal(r, normal_evidence=normal)
        return
    require(role == 'normal', 'STAGE_CONSUMER_ROLE')
    mobile = r.root / 'apps/mobile'
    r.run('normal-ui-resolved-expo-config', ['npx', '--no-install', 'expo', 'config', '--json'], cwd=mobile, timeout=120)
    r.run('normal-ui-prebuild', ['npx', '--no-install', 'expo', 'prebuild', '--platform', 'ios', '--clean',
          '--no-install', '--template', '../../node_modules/expo/template.tgz'], cwd=mobile, timeout=300)
    r.run('normal-ui-generated-source-diff', ['git', '--no-replace-objects', 'diff', '--binary', 'HEAD'])
    r.source_proof('source-after-normal-ui-prebuild', head, allow_generation=True)
    ios = mobile / 'ios'
    compatibility = r.output / 'generated-compat47'
    r.run('normal-ui-generated47-exact-properties', ['python3', '-I', '-B',
          'scripts/release/full-app-j01/pods_compat47.py', '--ios-directory', ios,
          '--source-proof', source47, '--output', compatibility], timeout=120)
    r.run('normal-ui-generated47-native', ['node', 'scripts/release/full-app-j01/native_generated47.mjs',
          '--phase', 'GENERATED', '--source-proof', source47, '--receipt', compatibility / 'receipt.json',
          '--output', r.output / 'current-generated47.json'], timeout=600)
    r.source_proof('source-after-normal-ui-generated47', head, allow_generation=True)
    products = Path(context['runner_temp']) / 'c47-native-products'
    products.mkdir(exist_ok=False)
    r.receipt['products_directory'] = str(products)
    r.persist()
    run_normal(r, ios, products, app, bundle, head)
    if resume25:
        execute_internal(r)


def execute_internal(parent, normal_evidence=None):
    normal = parent if normal_evidence is None else normal_evidence
    positive_normal = normal_xctest_gate(normal)
    if normal_evidence is None:
        normal_bundle = parent.receipt['stages'].get('compiled',
            parent.receipt['stages'].get('verified-produced-app', {}))['details']['bundle_id']
    else:
        require(normal.receipt['source'] == parent.receipt['source'], 'INTERNAL_SAME_HEAD_NORMAL_SOURCE')
        normal_bundle = normal.receipt['stages']['verified-produced-app']['details']['bundle_id']
        parent.receipt['authenticated_normal_qualification'] = {
            'producer': normal.provenance['producer'], 'positive_xctest': positive_normal,
            'performed_in_current_job': False,
            'qualification': 'ACTUAL_UPSTREAM_NAMED_NORMAL_PASS_AUTHENTICATED_AT_SAME_HEAD_AND_ATTEMPT'}
        parent.persist()
    environment = internal_environment(parent.env)
    head = parent.receipt['source']['head']
    output = parent.output / 'internal-supported-owner'
    child = Runner(parent.root, output, seconds=max(1, parent.deadline - time.monotonic()))
    child.deadline = parent.deadline
    child.env = environment
    child.evidence_root = parent.output
    child.receipt['upstream_payload_bytes'] = parent.receipt.get('upstream_payload_bytes', 0)
    if parent.receipt.get('job_context'):
        child.receipt.update(stage='internal', job_context=parent.receipt['job_context'])
    inherited_tools = stage_json(read_native_file(parent.output / 'toolchain.json'))
    inherited_tools['inherited_from_same_job_supervisor'] = True
    inherited_tools['build_environment'] = {key: child.env.get(key) for key in ENVIRONMENT}
    write_json(output / 'toolchain.json', inherited_tools)
    child.receipt.update(lane='internal-supported-owner', internal_supported_owner='IN_PROGRESS',
        source=parent.receipt['source'], fixture='EXISTING_DEBUG_DEVELOPMENT_ANONYMOUS_OWNER_NO_PRO',
        qualification='METRO_DEPENDENT_DEBUG_NOT_STANDALONE_OFFLINE_OR_CUSTOMER_ONBOARDING',
        provider_configuration='ALL_DECLARED_PROVIDER_KEYS_ABSENT; DOTENV_DISABLED',
        entitlement_authority='NO_PRO_GRANT; EXISTING_NATIVE_PLAN_PHOTO_GUARDS_RETAINED',
        export_destination_verification={'state': 'NOT_RUN', 'export_outcome': 'not_run'})
    child.env['C47_EXPORT_FOLDER'] = 'C47 Synthetic Export ' + uuid.uuid4().hex[:16]
    parent.receipt['internal_supported_owner'] = {'status': 'IN_PROGRESS',
                                                 'evidence': 'internal-supported-owner/execution.json'}
    if normal_evidence is None:
        # Preserve the actual same-host normal inputs in legacy combined execution.
        retain_generated_native(parent.root / 'apps/mobile/ios', parent.output)
        retain_result_bundles(parent)
        parent.receipt['native_configuration_final_retained'] = True
    else:
        parent.receipt['normal_configuration_location'] = 'AUTHENTICATED_UPSTREAM_NORMAL_ARTIFACT'
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
        child.receipt['source_gate_reuse'] = {'same_job_before_either_generation': normal_evidence is None,
            'current_job_before_internal_generation': True, 'same_head': head,
            'raw_source_proof_sha256': sha(source47), 'profiles': source_proof['profiles'],
            'qualification': ('Actual same-job SOURCE before either generation' if normal_evidence is None else
                'Fresh current-job both-profile SOURCE before internal generation; ordinary qualification is authenticated upstream')}
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
        signing = simulator_signing()
        ent = signing.configure_app(child, sys.modules[__name__], ios, 'com.layerwell.app.development')
        signing.check_effective_app(child, sys.modules[__name__], ['xcodebuild', '-workspace', workspace,
            '-scheme', workspace.stem, '-configuration', 'Debug', '-sdk', 'iphonesimulator', *APP_SIMULATOR_BUILD_FLAGS],
            'com.layerwell.app.development', ent, 'internal-native-build-settings')
        child.run('internal-native-build', ['xcodebuild', '-workspace', workspace, '-scheme', workspace.stem,
            '-configuration', 'Debug', '-sdk', 'iphonesimulator', '-destination', 'generic/platform=iOS Simulator',
            '-derivedDataPath', derived, '-resultBundlePath', products / 'build.xcresult', *APP_SIMULATOR_BUILD_FLAGS, 'build'], timeout=2400)
        signing.retain_applied_outputs(sys.modules[__name__], derived, output/'simulator-signing/applied-xcent')
        child.source_proof('source-after-internal-build', head, allow_generation=True)
        apps = list((derived / 'Build/Products/Debug-iphonesimulator').glob('*.app'))
        require(len(apps) == 1, 'INTERNAL_PRODUCT_COUNT')
        app = apps[0]
        architecture = json.loads((parent.output / 'toolchain.json').read_text())['architecture']
        bundle, _, app_receipt = retain_app(child, app, products, head, architecture,
                                           'Debug', 'internal-supported-owner')
        require(bundle != normal_bundle and bundle.endswith('.development'), 'INTERNAL_BUNDLE_SEPARATION')
        child.passed('compiled', app_receipt)
        # Imported producer UUIDs belong to another host and are never reused.
        if normal_evidence is None:
            parent.run('normal-simulator-shutdown-before-internal', ['xcrun', 'simctl', 'shutdown',
                       parent.receipt['simulator']['udid']], timeout=30)
        device = prepare_simulator(child, 'internal')
        installed = install_simulator_app(child, device, app, bundle)
        verify_installed_app(child, installed, app, bundle)
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
    parent.receipt.update(status=('NORMAL_AND_INTERNAL_SYNTHETIC_NATIVE_EXECUTED_SCOPE_REVIEW_REQUIRED' if normal_evidence is None else
                                  'INTERNAL_NATIVE_EXECUTED_WITH_AUTHENTICATED_UPSTREAM_NORMAL'),
                          finished_utc=utc())
    parent.persist()


def collect(r):
    """Best-effort diagnostics cannot manufacture a runtime stage PASS."""
    device = r.receipt.get('simulator', {}).get('udid')
    if device:
        r.run('simulator-diagnostics', ['xcrun', 'simctl', 'spawn', device, 'log', 'show',
                                      '--last', '15m', '--style', 'compact', '--predicate',
                                      'process CONTAINS "Layerwell" OR process CONTAINS "C47NativeUI" OR '
                                      '(process == "securityd" AND eventMessage CONTAINS "Layerwell" AND '
                                      '(eventMessage CONTAINS[c] "entitlement" OR eventMessage CONTAINS "copy_matching"))'],
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
    retain_current = not r.receipt.get('native_configuration_final_retained') and r.receipt.get('lane') != 'internal-stage-supervisor'
    if retain_current:
        retain_generated_native(ios, r.output)
    generated = r.output / 'generated-native'
    for name in ['Podfile', 'Podfile.lock', 'Podfile.properties.json']:
        path = ios / name
        if retain_current and path.is_file() and path.stat().st_size <= 10 * MIB:
            generated.mkdir(exist_ok=True)
            shutil.copy2(path, generated / name)
    reports = Path.home() / 'Library/Logs/DiagnosticReports'
    if reports.is_dir():
        crashes = r.output / 'crashes'
        for path in reports.glob('*'):
            if path.is_file() and path.name.startswith(('Layerwell', 'C47NativeUI')) and path.stat().st_size <= 10 * MIB:
                crashes.mkdir(exist_ok=True)
                shutil.copy2(path, crashes / path.name)
    size = evidence_total(r)
    policy = {'maximum_bytes': MAX_EVIDENCE, 'observed_bytes_before_policy': size,
              'upload_within_limit': size <= MAX_EVIDENCE - STAGE_MAX_JSON - MIB,
              'stage_manifest_reserve_bytes': STAGE_MAX_JSON, 'app_archive_maximum_bytes': MAX_APP}
    r.receipt['artifact_policy'] = policy
    r.persist()
    write_json(r.output / 'artifact-policy.json', policy)


def hosted_stage_context(r, role):
    require(platform.system() == 'Darwin', 'MACOS_REQUIRED')
    require(role in STAGE_JOB_NAMES and os.environ.get('GITHUB_REPOSITORY') == STAGE_REPOSITORY and
            os.environ.get('GITHUB_JOB') == 'native-' + role, 'HOSTED_STAGE_IDENTITY')
    head = os.environ.get('C47_EXPECTED_HEAD', '')
    require(re.fullmatch(r'[a-f0-9]{40}', head), 'EXPECTED_HEAD_REQUIRED')
    actual = subprocess.check_output(['git', '--no-replace-objects', 'rev-parse', 'HEAD'], cwd=r.root, env=r.env).decode().strip()
    source_tree = subprocess.check_output(['git', '--no-replace-objects', 'rev-parse', head + '^{tree}'], cwd=r.root, env=r.env).decode().strip()
    require(actual == head and re.fullmatch(r'[a-f0-9]{40}', source_tree), 'STAGE_ACTUAL_SOURCE_CONTEXT')
    context = {'repository': STAGE_REPOSITORY, 'head': head, 'tree': source_tree,
               'run_id': stage_integer(os.environ.get('GITHUB_RUN_ID', '')),
               'run_attempt': stage_integer(os.environ.get('GITHUB_RUN_ATTEMPT', '')),
               'runner_temp': str(Path(os.environ['RUNNER_TEMP']).resolve(strict=True)),
               'workspace': str(r.root.resolve(strict=True)), 'evidence_root': str(r.output.resolve(strict=True))}
    r.receipt['job_context'] = {key: context[key] for key in ('repository', 'run_id', 'run_attempt')}
    r.receipt['job_context'].update(job_name=STAGE_JOB_NAMES[role], job_id='native-' + role)
    r.persist()
    return context


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--stage', required=True, choices=('source', 'build', 'normal', 'internal'))
    parser.add_argument('--resume25', action='store_true')
    parser.add_argument('--consent-trace04', action='store_true', help='Separate read-only consent diagnostic; never ordinary or internal admission')
    parser.add_argument('--consent-runtime27', action='store_true', help='Authenticated retained diagnostic runtime only; never an app producer')
    parser.add_argument('--simulator-probe', action='store_true',
                        help='Isolated C47 Xcode/Keychain tooling diagnostic; never an app producer')
    args = parser.parse_args()
    # The existing ephemeral read token never reaches hooks, Expo, subprocess arguments or receipts.
    token = os.environ.pop('C47_ARTIFACT_READ_TOKEN', '')
    root = Path(__file__).resolve().parents[3]
    output = args.output.absolute()
    require(not output.resolve().is_relative_to(root), 'OUTPUT_IN_SOURCE')
    require(not output.exists() or output.is_dir() and not any(output.iterdir()), 'OUTPUT_NOT_EMPTY')
    output.mkdir(parents=True, exist_ok=True)
    runner = Runner(root, output)
    runner.receipt['stage'] = args.stage
    runner.persist()
    code, context = 0, None
    try:
        context = hosted_stage_context(runner, args.stage)
        execution_mode(args.stage, probe=args.simulator_probe, resume25=args.resume25,
                       consent_trace04=args.consent_trace04, consent_runtime27=args.consent_runtime27)
        if args.consent_runtime27:
            execute_retained_consent_runtime27(runner, token)
        elif args.stage == 'source':
            require(not token, 'SOURCE04_NO_ARTIFACT_TOKEN')
            execute_source04(runner)
        elif args.stage == 'build':
            if not args.simulator_probe and not args.consent_trace04:
                require(bool(token), 'SOURCE04_BUILD_IMPORT_TOKEN_REQUIRED')
                imported = stage_imports(runner, 'build', context, token)
                execute(runner, compile_only=True, source_provenance=imported['source'])
            elif args.simulator_probe:
                require(not token, 'BUILD_STAGE_REQUIRES_NO_ARTIFACT_TOKEN')
                path = root / 'scripts/release/full-app-j01/simulator_signing47.py'
                spec = importlib.util.spec_from_file_location('c47_simulator_signing', path)
                signing = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(signing)
                signing.run_probe(runner, sys.modules[__name__])
            else:
                require(not token, 'BUILD_STAGE_REQUIRES_NO_ARTIFACT_TOKEN')
                execute(runner, compile_only=True, consent_trace04=args.consent_trace04)
        else:
            execute_consumer(runner, args.stage, context, token, resume25=args.resume25)
        require(runner.receipt['source']['head'] == context['head'] and
                runner.receipt['source']['tree'] == context['tree'], 'STAGE_FINAL_SOURCE_CONTEXT')
        runner.receipt['stage_complete'] = True
    except Exception as error:
        code = 1
        runner.receipt.update(status='PARTIAL_BLOCKED', stage_complete=False,
            failure={'type': type(error).__name__, 'detail': str(error)}, finished_utc=utc())
        runner.persist()
        print('C47_EXECUTION_FAILED: ' + str(error), file=sys.stderr)
    finally:
        try:
            collect(runner)
        except Exception as error:
            code = 1
            runner.receipt['collection_failure'] = {'type': type(error).__name__, 'detail': str(error)}
        if not runner.receipt.get('artifact_policy', {}).get('upload_within_limit'):
            code = 1
        runner.receipt['stage_complete'] = code == 0 and runner.receipt['stage_complete'] is True
        runner.receipt['finished_utc'] = utc()
        runner.persist()
    manifest = None
    if context is not None:
        try:
            # This is the final evidence-file write; uploaded bytes must remain closed afterwards.
            manifest = write_stage_provenance(output, args.stage, context)
        except Exception as error:
            code = 1
            print('C47_STAGE_MANIFEST_FAILED: ' + type(error).__name__ + ': ' + str(error), file=sys.stderr)
    else:
        code = 1
    print(json.dumps({'status': runner.receipt['status'], 'stage': args.stage,
        'stage_complete': code == 0 and runner.receipt['stage_complete'], 'manifest': manifest,
        'stages': list(runner.receipt['stages']), 'campaign_candidate_complete': False, 'release': 'NO_GO'}))
    return code



if __name__ == '__main__':
    raise SystemExit(main())
