"""Verify one externally anchored onSkin Release09 context packet, integrity only.

Run from a newly and SAFELY extracted packet directory with the manifest anchor
provided in the founder-pasted prompt. This does not approve source/release.
"""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import stat
import sys
import unicodedata

HERE = Path(__file__).resolve().parent
TOKEN = '__EXTERNAL_MANIFEST_SHA256__'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def regular_file(path):
    for part in [path] + list(path.parents):
        metadata = part.lstat()
        if stat.S_ISLNK(metadata.st_mode) or (getattr(metadata, 'st_file_attributes', 0) & 1024):
            raise ValueError('LINK_OR_REPARSE:' + str(part))
        if part == path:
            if not stat.S_ISREG(metadata.st_mode):
                raise ValueError('NOT_REGULAR:' + str(part))
        elif not stat.S_ISDIR(metadata.st_mode):
            raise ValueError('BAD_PARENT:' + str(part))
    return path.read_bytes()


def good_name(name):
    if not isinstance(name, str) or not name or '\\' in name or ':' in name:
        raise ValueError('BAD_NAME:' + str(name))
    p = PurePosixPath(name)
    if p.is_absolute() or any(x in ('', '.', '..') for x in name.split('/')) or p.as_posix() != name:
        raise ValueError('TRAVERSAL:' + name)
    return unicodedata.normalize('NFC', name).casefold()


def verify(expected):
    expected = expected.lower()
    if len(expected) != 64 or any(ch not in '0123456789abcdef' for ch in expected):
        raise ValueError('EXTERNAL_MANIFEST_FORMAT')
    raw = regular_file(HERE / 'manifest.json')
    if sha(raw) != expected:
        raise ValueError('EXTERNAL_MANIFEST_MISMATCH')
    payload = json.loads(raw.decode('utf-8'))
    if set(payload) != {'schema_version', 'packet_id', 'files'} or payload['schema_version'] != 1:
        raise ValueError('MANIFEST_SHAPE')
    if payload['packet_id'] != 'onskin-release09-source-packet-ci-2026-10-24':
        raise ValueError('MANIFEST_ID')
    expected_files = {'manifest.json', 'EXACT_PROMPT.md'}
    normalized = {good_name(x) for x in expected_files}
    for row in payload['files']:
        if set(row) != {'path', 'bytes', 'sha256'}:
            raise ValueError('ROW_SHAPE')
        path = row['path']
        canon = good_name(path)
        if canon in normalized:
            raise ValueError('DUPLICATE_FILENAME:' + path)
        normalized.add(canon)
        expected_files.add(path)
        data = regular_file(HERE / path)
        if len(data) != row['bytes'] or sha(data) != row['sha256']:
            raise ValueError('ENTRY_HASH_OR_SIZE:' + path)
    current_files = {str(x.relative_to(HERE)).replace('\\', '/') for x in HERE.rglob('*') if x.is_file()}
    if current_files != expected_files:
        raise ValueError('FILES_MISSING_OR_EXTRA:' + str(current_files ^ expected_files))
    if len({good_name(x) for x in current_files}) != len(current_files):
        raise ValueError('CASE_COLLISION')
    for candidate in HERE.rglob('*'):
        metadata = candidate.lstat()
        if stat.S_ISLNK(metadata.st_mode) or (getattr(metadata, 'st_file_attributes', 0) & 1024):
            raise ValueError('LINK_OR_REPARSE:' + str(candidate))
        if not (stat.S_ISREG(metadata.st_mode) or stat.S_ISDIR(metadata.st_mode)):
            raise ValueError('NOT_REGULAR_OR_DIR:' + str(candidate))
    expected_prompt = regular_file(HERE / 'PROMPT_TEMPLATE.md').decode('utf-8').replace(TOKEN, expected)
    actual_prompt = regular_file(HERE / 'EXACT_PROMPT.md').decode('utf-8')
    if actual_prompt != expected_prompt or TOKEN in actual_prompt:
        raise ValueError('EXACT_PROMPT_DERIVATION_MISMATCH')
    if sum(TOKEN in regular_file(HERE / 'PROMPT_TEMPLATE.md').decode('utf-8') for _ in range(1)) != 1:
        raise ValueError('PROMPT_TEMPLATE_ANCHOR')
    print('VERIFIED: external manifest, %d declared entries, exact prompt derivation; integrity only, no code or release acceptance.' % len(payload['files']))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--expected-manifest-sha256', required=True)
    args = parser.parse_args()
    try:
        verify(args.expected_manifest_sha256)
    except Exception as err:
        print('CONTEXT_INVALID: ' + str(err), file=sys.stderr)
        raise SystemExit(1)
