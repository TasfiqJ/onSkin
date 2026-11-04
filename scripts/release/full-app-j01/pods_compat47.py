"""Exact generated-only Expo extraPods repair. No source, signing or module removal."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess

ROOT = Path(__file__).absolute().parents[3]
DESCRIPTOR = 'docs/phase-9/ios-generated-input-succession47.v1.json'
HELPER = 'scripts/release/full-app-j01/pods_compat47.py'
PODS = [{'name': 'GoogleUtilities/Environment', 'modular_headers': True},
        {'name': 'RecaptchaInterop', 'modular_headers': True}]
PROPERTY = 'apple.extraPods'
VALUE = json.dumps(PODS, separators=(',', ':'))


def require(value, code):
    if not value:
        raise ValueError('C47_PODS_' + code)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def document(raw):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, 'DUPLICATE_JSON_KEY')
            result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=unique)


def regular(path, maximum=2 * 1024 * 1024):
    path = Path(path).absolute()
    parents = []
    for parent in [*reversed(path.parent.parents), path.parent]:
        info = parent.lstat()
        require(stat.S_ISDIR(info.st_mode) and not getattr(info, 'st_file_attributes', 0) & 1024, 'DIRECTORY_LINK')
        parents.append((parent, info.st_dev, info.st_ino))
    stamp = lambda v: (v.st_dev, v.st_ino, v.st_mode, v.st_nlink, v.st_size, v.st_mtime_ns)
    before = path.lstat()
    require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and before.st_size <= maximum and
            not getattr(before, 'st_file_attributes', 0) & 1024, 'REGULAR_FILE_BOUND')
    fd = os.open(path, os.O_RDONLY | getattr(os, 'O_BINARY', 0) | getattr(os, 'O_NOFOLLOW', 0))
    try:
        require(stamp(os.fstat(fd)) == stamp(before), 'OPEN_RACE')
        chunks = []
        size = 0
        while True:
            chunk = os.read(fd, min(65536, before.st_size - size + 1))
            if not chunk:
                break
            size += len(chunk)
            require(size <= before.st_size, 'READ_BOUND')
            chunks.append(chunk)
        require(size == before.st_size and stamp(os.fstat(fd)) == stamp(before) and
                stamp(path.lstat()) == stamp(before), 'FILE_RACE')
        for parent, device, inode in parents:
            info = parent.lstat()
            require(stat.S_ISDIR(info.st_mode) and (info.st_dev, info.st_ino) == (device, inode), 'DIRECTORY_RACE')
        return b''.join(chunks)
    finally:
        os.close(fd)


def projection(before):
    properties = document(before)
    require(isinstance(properties, dict) and properties and all(isinstance(key, str) and
            isinstance(value, str) for key, value in properties.items()), 'PROPERTIES_STRING_MAP')
    require(PROPERTY not in properties, 'EXTRA_PODS_MUST_BE_ABSENT')
    return (json.dumps({**properties, PROPERTY: VALUE}, indent=2, ensure_ascii=False) + '\n').encode()


def verify_delta(before, after):
    require(after == projection(before), 'EXACT_TWO_POD_DELTA')
    parsed = document(after)
    require(document(parsed[PROPERTY]) == PODS, 'EXACT_POD_TUPLES')
    return True


def profile_preimages(transition, profile):
    require(profile in ['staging', 'development'], 'PROFILE_NOT_AUTHORIZED')
    require(transition['allowedProfiles'] == ['staging', 'development'], 'FINITE_PROFILE_INVENTORY')
    if profile == 'staging':
        return transition['propertiesPreimage']['sha256'], transition['podfilePreimage']['sha256']
    declared = transition['developmentProjection']
    require(declared['provenance'] == 'DECLARED_TARGET_NAME_PROJECTION_NOT_OBSERVED_MACOS_GENERATION',
            'DEVELOPMENT_PROJECTION_PROVENANCE')
    stage_properties, stage_podfile = declared['stagingPropertiesUTF8'].encode(), declared['stagingPodfileUTF8'].encode()
    require(digest(stage_properties) == transition['propertiesPreimage']['sha256'] and
            digest(stage_podfile) == transition['podfilePreimage']['sha256'], 'STAGING_TEMPLATE_BINDING')
    properties = document(stage_properties)
    key = 'expo.inlineModules.xcodeProjectTargets'
    require(document(properties[key]) == {'mainTarget': 'LayerwellStaging', 'targets': []}, 'EXACT_STAGING_TARGET')
    properties[key] = json.dumps({'mainTarget': 'LayerwellDev', 'targets': []}, separators=(',', ':'))
    dev_properties = (json.dumps(properties, indent=2, ensure_ascii=False) + '\n').encode()
    needle, replacement = b"target 'LayerwellStaging' do", b"target 'LayerwellDev' do"
    require(stage_podfile.count(needle) == 1, 'EXACT_STAGING_POD_TARGET')
    dev_podfile = stage_podfile.replace(needle, replacement)
    require(digest(dev_properties) == declared['propertiesPreimage']['sha256'] and
            digest(dev_podfile) == declared['podfilePreimage']['sha256'], 'DECLARED_DEVELOPMENT_PREIMAGE')
    return digest(dev_properties), digest(dev_podfile)


def apply(ios, output, binding):
    ios, output = Path(ios).absolute(), Path(output).absolute()
    require(ios.is_dir() and not output.exists() and not output.is_relative_to(ios), 'NEW_OUTPUT_REQUIRED')
    properties, podfile = ios / 'Podfile.properties.json', ios / 'Podfile'
    before, podfile_before = regular(properties), regular(podfile)
    require(digest(before) == binding['propertiesPreimageSHA256'] and
            digest(podfile_before) == binding['podfilePreimageSHA256'], 'ACTUAL_GENERATED_PREIMAGE')
    after = projection(before)
    output.mkdir(parents=True)
    (output / 'Podfile.properties.before.json').write_bytes(before)
    (output / 'Podfile.before').write_bytes(podfile_before)
    temporary = ios / 'Podfile.properties.json.c47-tmp'
    with temporary.open('xb') as stream:
        stream.write(after)
        stream.flush()
        os.fsync(stream.fileno())
    require(regular(properties) == before and regular(podfile) == podfile_before, 'PREWRITE_RACE')
    temporary.replace(properties)
    actual = regular(properties)
    require(verify_delta(before, actual) and regular(podfile) == podfile_before, 'POSTWRITE_READBACK')
    (output / 'Podfile.properties.after.json').write_bytes(actual)
    (output / 'Podfile.after').write_bytes(podfile_before)
    receipt = {'schema': 1, 'status': 'GENERATED_TWO_POD_PROPERTIES_VERIFIED_NO_ADMISSION',
               'profile': binding.get('profile', 'staging'),
               'sourceHead': binding['sourceHead'], 'descriptorSHA256': binding['descriptorSHA256'],
               'sourceProofSHA256': binding['sourceProofSHA256'], 'helperSHA256': digest(regular(Path(__file__))),
               'iosDirectory': str(ios), 'propertiesPreimageSHA256': digest(before),
               'propertiesPostimageSHA256': digest(actual), 'podfilePreimageSHA256': digest(podfile_before),
               'podfilePostimageSHA256': digest(podfile_before), 'property': PROPERTY, 'pods': PODS,
               'acceptanceGranted': False, 'nativeAccepted': False, 'release': 'NO_GO'}
    (output / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    return receipt


def verify_receipt(path, ios, binding):
    path, ios = Path(path), Path(ios).absolute()
    receipt = document(regular(path))
    require(receipt.get('schema') == 1 and receipt.get('status') == 'GENERATED_TWO_POD_PROPERTIES_VERIFIED_NO_ADMISSION' and
            receipt.get('acceptanceGranted') is False and receipt.get('nativeAccepted') is False and
            receipt.get('release') == 'NO_GO', 'RECEIPT_CLAIMS')
    for key in ['sourceHead', 'descriptorSHA256', 'sourceProofSHA256', 'propertiesPreimageSHA256', 'podfilePreimageSHA256']:
        require(receipt.get(key) == binding[key], 'STALE_OR_FORGED_RECEIPT_BINDING')
    require(receipt.get('profile') == binding.get('profile', 'staging'), 'RECEIPT_PROFILE')
    require(receipt.get('helperSHA256') == digest(regular(Path(__file__))) and
            receipt.get('iosDirectory') == str(ios) and receipt.get('property') == PROPERTY and
            receipt.get('pods') == PODS, 'RECEIPT_HELPER_OR_SCOPE')
    before, after = regular(path.parent / 'Podfile.properties.before.json'), regular(path.parent / 'Podfile.properties.after.json')
    require(verify_delta(before, after) and digest(before) == receipt['propertiesPreimageSHA256'] and
            digest(after) == receipt['propertiesPostimageSHA256'] and regular(ios / 'Podfile.properties.json') == after,
            'ACTUAL_PROPERTIES_RECEIPT_DRIFT')
    podfile = regular(ios / 'Podfile')
    require(podfile == regular(path.parent / 'Podfile.before') == regular(path.parent / 'Podfile.after') and
            digest(podfile) == receipt['podfilePreimageSHA256'] == receipt['podfilePostimageSHA256'], 'PODFILE_DRIFT')
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ios-directory', required=True, type=Path)
    parser.add_argument('--source-proof', required=True, type=Path)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--verify-receipt', type=Path)
    parser.add_argument('--profile', choices=['staging', 'development'], default='staging')
    args = parser.parse_args()
    env = {key: value for key, value in os.environ.items() if not key.upper().startswith('GIT_')}
    git = lambda *values: subprocess.check_output(['git', '--no-replace-objects', *values], cwd=ROOT, env=env, timeout=30)
    head = git('rev-parse', 'HEAD').decode().strip()
    require(re.fullmatch(r'[a-f0-9]{40}', head) and head == os.environ.get('C47_EXPECTED_HEAD'), 'EXPECTED_CURRENT_HEAD')
    descriptor_raw = regular(ROOT / DESCRIPTOR)
    require(git('show', head + ':' + DESCRIPTOR) == descriptor_raw and
            git('show', head + ':' + HELPER) == regular(Path(__file__)), 'COMMITTED_HELPER_DESCRIPTOR')
    descriptor = document(descriptor_raw)
    proof_raw = regular(args.source_proof, 16 * 1024 * 1024)
    proof = document(proof_raw)
    require(proof.get('phase') == 'SOURCE' and proof.get('sourceHead') == head and
            proof.get('descriptorSHA256') == digest(descriptor_raw) and
            proof.get('profiles') == ['development', 'staging'] and
            proof.get('currentNative46', {}).get('verifiedInputCount') == 202 and
            proof['currentNative46']['source']['sourceHead'] == head, 'FRESH_CURRENT_SOURCE_PROOF')
    require(args.ios_directory.absolute() == ROOT / 'apps/mobile/ios', 'GENERATED_IOS_ROOT')
    require(os.environ.get('APP_VARIANT') == args.profile and os.environ.get('EXPO_PUBLIC_APP_ENV') == args.profile,
            'ACTUAL_ENVIRONMENT_PROFILE')
    transition = descriptor['generatedTransition']
    properties_hash, podfile_hash = profile_preimages(transition, args.profile)
    binding = {'sourceHead': head, 'descriptorSHA256': digest(descriptor_raw), 'sourceProofSHA256': digest(proof_raw),
               'profile': args.profile, 'propertiesPreimageSHA256': properties_hash, 'podfilePreimageSHA256': podfile_hash}
    if args.verify_receipt:
        result = verify_receipt(args.verify_receipt, args.ios_directory, binding)
    else:
        require(args.output is not None and not args.output.absolute().is_relative_to(ROOT), 'OUTPUT_OUTSIDE_SOURCE')
        result = apply(args.ios_directory, args.output, binding)
    print(json.dumps(result, sort_keys=True))


if __name__ == '__main__':
    main()
