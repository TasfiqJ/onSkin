"""Stream-verify an externally anchored Campaign21 return ZIP without extracting it.

VERIFIED means archive integrity only. It never accepts source, Security,
database custody, native/device evidence, clinical/legal claims, or release.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys
import unicodedata
import zipfile

AUTHORITY = 'BRAIN-M1X-F09-LAYOUT-COMPATIBILITY21-REPAIR-01'
INPUT_SHA = '6c9b46747f0bb5a9141c9320a92f9508cff6d7e964b8ce2e8536e1260b64536e'
BASE = '3c8cb787f3770df09f0ae4507bca9ac49fb5a079'
BASE_TREE = '1ae09829967d455d98b5f5f93558927890d2d8e9'
MANIFEST = 'return_manifest.json'
CHECKPOINT = 'checkpoint/manifest.json'
INPUT_COPY = 'inputs/packet/manifest.json'
SELF = 'verify_return21.py'
MAX_MEMBERS = 30000
MAX_MEMBER_BYTES = 1024 * 1024 * 1024
MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024
MAX_MANIFEST_BYTES = 8 * 1024 * 1024
CHUNK_BYTES = 1024 * 1024


def require(value, error):
    if not value:
        raise ValueError(error)


def hex_digest(value, length):
    return isinstance(value, str) and re.fullmatch('[0-9a-f]{'+str(length)+'}', value) is not None


def sha(data):
    return hashlib.sha256(data).hexdigest()


def pairs(items):
    result = {}
    for key, value in items:
        require(key not in result, 'DUPLICATE_JSON_KEY:'+key)
        result[key] = value
    return result


def parse(raw):
    return json.loads(raw, object_pairs_hook=pairs,
        parse_constant=lambda value: (_ for _ in ()).throw(ValueError('NONFINITE_JSON:'+value)))


def native(path):
    value = os.path.abspath(path)
    if os.name == 'nt' and not value.startswith('\\\\?\\'):
        value = ('\\\\?\\UNC\\'+value[2:]) if value.startswith('\\\\') else ('\\\\?\\'+value)
    return Path(value)


def regular(path):
    for component in [path]+list(path.parents):
        info = native(component).lstat()
        require(not stat.S_ISLNK(info.st_mode) and not (getattr(info, 'st_file_attributes', 0) & 1024),
            'LINK_OR_REPARSE:'+str(component))
        require(stat.S_ISREG(info.st_mode) if component == path else stat.S_ISDIR(info.st_mode),
            'NOT_REGULAR_OR_DIRECTORY:'+str(component))
    return native(path).stat()


def safe(name):
    # Return members use portable artifact names. Reject Unicode aliases outright.
    return isinstance(name, str) and re.fullmatch(r'[A-Za-z0-9._@+()/=-]+', name) is not None and all(
        part and not part.startswith('.') and not part.endswith('.') and
        re.fullmatch(r'(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?', part, re.I) is None
        for part in name.split('/'))


def remember(name, identities):
    parts = name.split('/')
    for index in range(1, len(parts)+1):
        original = '/'.join(parts[:index])
        key = unicodedata.normalize('NFKC', original).casefold()
        require(key not in identities or identities[key] == original, 'NAME_COLLISION:'+name)
        identities[key] = original


def member(info):
    name = info.filename
    require(name == info.orig_filename and safe(name) and not info.is_dir() and
        not (info.flag_bits & (1 | 64)), 'UNSAFE_ZIP_MEMBER:'+name)
    mode = info.external_attr >> 16
    require(stat.S_IFMT(mode) == stat.S_IFREG and stat.S_IMODE(mode) == 0o644 and
        not (info.external_attr & (1024 | 16 | 8)), 'ZIP_MEMBER_MODE:'+name)
    require(0 <= info.file_size <= MAX_MEMBER_BYTES and
        info.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED), 'ZIP_MEMBER_SIZE_OR_ENCODING:'+name)


def small(archive, info):
    require(info.file_size <= MAX_MANIFEST_BYTES, 'MANIFEST_SIZE:'+info.filename)
    with archive.open(info) as source:
        data = source.read(MAX_MANIFEST_BYTES+1)
        require(len(data) <= MAX_MANIFEST_BYTES and source.read(1) == b'', 'MANIFEST_SIZE:'+info.filename)
    return data


def witness_schema(entry, name):
    require(isinstance(entry, dict) and set(entry) == {'bytes', 'sha256'} and type(entry['bytes']) is int and
        0 <= entry['bytes'] <= MAX_MEMBER_BYTES and hex_digest(entry['sha256'], 64), 'WITNESS_SCHEMA:'+name)


def source_schema(source):
    require(isinstance(source, dict) and set(source) == {'base', 'baseTree', 'runtimeHead', 'runtimeTree', 'sourceHead', 'sourceTree'} and
        source['base'] == BASE and source['baseTree'] == BASE_TREE and all(hex_digest(value, 40) for value in source.values()),
        'SOURCE_FREEZE_SCHEMA')


def has_export(names, platform):
    return any(name.startswith('exports/'+platform+'/') or name in
        {'exports/'+platform+'.zip', 'exports/'+platform+'.tar.gz'} for name in names)


def verify(zip_path, expected):
    require(hex_digest(expected, 64), 'BAD_EXTERNAL_MANIFEST_ANCHOR')
    zip_path = Path(zip_path).absolute()
    require(regular(zip_path).st_size <= MAX_TOTAL_BYTES, 'ARCHIVE_SIZE_LIMIT')
    with zipfile.ZipFile(native(zip_path)) as archive:
        infos = archive.infolist()
        require(0 < len(infos) <= MAX_MEMBERS, 'ARCHIVE_MEMBER_LIMIT')
        manifests = [info for info in infos if info.filename == MANIFEST]
        require(len(manifests) == 1, 'ONE_RETURN_MANIFEST_REQUIRED')
        member(manifests[0])
        raw = small(archive, manifests[0])
        require(sha(raw) == expected, 'EXTERNAL_RETURN_MANIFEST_SHA256')
        manifest = parse(raw)
        require(isinstance(manifest, dict) and set(manifest) == {'schema', 'authority', 'status', 'acceptanceGranted', 'release',
            'checkpointManifestSHA256', 'inputManifestSHA256', 'finalHead', 'finalTree', 'source', 'files'} and
            type(manifest['schema']) is int and manifest['schema'] == 1 and manifest['authority'] == AUTHORITY and
            manifest['status'] == 'SOURCE_ONLY_CANDIDATE' and manifest['acceptanceGranted'] is False and
            manifest['release'] == 'NO_GO' and manifest['inputManifestSHA256'] == INPUT_SHA and
            hex_digest(manifest['checkpointManifestSHA256'], 64) and hex_digest(manifest['finalHead'], 40) and
            hex_digest(manifest['finalTree'], 40), 'NON_ADMISSION_RETURN_SCHEMA')
        source_schema(manifest['source'])
        files = manifest['files']
        require(isinstance(files, dict) and {SELF, 'FINAL_REPORT.md', 'source.bundle', CHECKPOINT} <= set(files) and
            MANIFEST not in files and bool(files) and has_export(files, 'ios') and has_export(files, 'android') and
            any(name.startswith('evidence/') for name in files), 'RETURN_REQUIRED_FILES')
        expected_names = set(files) | {MANIFEST}
        identities = {}
        directories = set()
        for name in expected_names:
            require(safe(name), 'UNSAFE_MANIFEST_PATH:'+name)
            remember(name, identities)
            parts = name.split('/')
            directories.update('/'.join(parts[:index]) for index in range(1, len(parts)))
            if name != MANIFEST: witness_schema(files[name], name)
        require(not expected_names.intersection(directories), 'FILE_DIRECTORY_COLLISION')
        require(len(infos) == len(expected_names) and
            sum(info.file_size for info in infos) <= MAX_TOTAL_BYTES, 'RETURN_INVENTORY_OR_SIZE_LIMIT')
        seen = set()
        for info in infos:
            member(info)
            name = info.filename
            require(name in expected_names and name not in seen, 'EXTRA_OR_DUPLICATE_MEMBER:'+name)
            remember(name, identities)
            seen.add(name)
        require(seen == expected_names, 'EXACT_RETURN_INVENTORY')
        own_path = Path(__file__).absolute()
        own_size = regular(own_path).st_size
        require(own_size == files[SELF]['bytes'] and sha(native(own_path).read_bytes()) == files[SELF]['sha256'],
            'RUNNING_VERIFIER_BYTES')
        retained = {}
        total = 0
        for info in infos:
            name = info.filename
            if name == MANIFEST: continue
            expected_file = files[name]
            require(info.file_size == expected_file['bytes'], 'ZIP_MEMBER_DECLARED_BYTES:'+name)
            digest = hashlib.sha256()
            count = 0
            pieces = [] if name in {CHECKPOINT, INPUT_COPY} else None
            with archive.open(info) as source:
                while True:
                    data = source.read(CHUNK_BYTES)
                    if not data: break
                    count += len(data); total += len(data)
                    require(count <= expected_file['bytes'] and count <= MAX_MEMBER_BYTES and total <= MAX_TOTAL_BYTES,
                        'STREAM_SIZE_LIMIT:'+name)
                    digest.update(data)
                    if pieces is not None:
                        require(count <= MAX_MANIFEST_BYTES, 'CHECKPOINT_MANIFEST_SIZE')
                        pieces.append(data)
            require(count == expected_file['bytes'] and digest.hexdigest() == expected_file['sha256'], 'MEMBER_SHA256:'+name)
            if pieces is not None: retained[name] = b''.join(pieces)
        checkpoint_raw = retained[CHECKPOINT]
        require(sha(checkpoint_raw) == manifest['checkpointManifestSHA256'], 'CHECKPOINT_MANIFEST_SHA256')
        if INPUT_COPY in retained: require(sha(retained[INPUT_COPY]) == INPUT_SHA, 'OUTER_INPUT_MANIFEST_COPY_SHA256')
        checkpoint = parse(checkpoint_raw)
        require(isinstance(checkpoint, dict) and set(checkpoint) == {'schema', 'authority', 'status', 'acceptanceGranted', 'release',
            'inputManifestSHA256', 'producerSHA256', 'source', 'files', 'payload'} and
            type(checkpoint['schema']) is int and checkpoint['schema'] == 1 and checkpoint['authority'] == AUTHORITY and
            checkpoint['status'] == 'SOURCE_ONLY_CANDIDATE' and checkpoint['acceptanceGranted'] is False and
            checkpoint['release'] == 'NO_GO' and checkpoint['inputManifestSHA256'] == INPUT_SHA and
            checkpoint['source'] == manifest['source'], 'CHECKPOINT_RETURN_BINDING')
        return dict(status='VERIFIED', qualification='RETURN_ARCHIVE_INTEGRITY_ONLY; INDEPENDENT_SOURCE_REVIEW_REQUIRED',
            admission='NONE', acceptanceGranted=False, release='NO_GO', native='CLOSED',
            returnManifestSHA256=expected, checkpointManifestSHA256=manifest['checkpointManifestSHA256'],
            inputManifestSHA256=INPUT_SHA, finalHead=manifest['finalHead'], finalTree=manifest['finalTree'],
            files=len(expected_names), streamedBytes=total)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--zip', required=True, type=Path)
    parser.add_argument('--expected-manifest-sha256', required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(verify(args.zip, args.expected_manifest_sha256), sort_keys=True))
        return 0
    except (ValueError, KeyError, TypeError, OSError, UnicodeError, zipfile.BadZipFile, RuntimeError) as error:
        print(json.dumps(dict(status='REJECTED', admission='NONE', acceptanceGranted=False, release='NO_GO',
            native='CLOSED', error=str(error)), sort_keys=True))
        return 1


if __name__ == '__main__':
    sys.exit(main())
