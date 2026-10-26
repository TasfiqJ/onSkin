"""Authenticate Campaign16 candidate evidence. Never grants acceptance or release."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import sys
import unicodedata
import zipfile


def require(ok, message):
    if not ok:
        raise ValueError(message)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def regular(path):
    for component in [path, *path.parents]:
        value = component.lstat()
        require(not stat.S_ISLNK(value.st_mode) and not getattr(value, 'st_file_attributes', 0) & 1024, 'LINK_OR_REPARSE')
    require(path.is_file() and path.stat().st_nlink == 1, 'REGULAR_SINGLE_FILE_REQUIRED')
    return path.read_bytes()


def pairs(items):
    result = {}
    for key, value in items:
        require(key not in result, 'DUPLICATE_JSON_KEY')
        result[key] = value
    return result


def safe(name):
    return (isinstance(name, str) and re.fullmatch(r'[A-Za-z0-9._/-]+', name) and
            not PurePosixPath(name).is_absolute() and all(part not in ('', '.', '..') and
            not part.startswith('.') and not part.endswith('.') and
            not re.fullmatch(r'(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?', part, re.I)
            for part in name.split('/')))


def verify(folder, expected, git_root=None):
    raw = regular(folder/'manifest.json')
    require(digest(raw) == expected, 'EXTERNAL_MANIFEST_ANCHOR_MISMATCH')
    value = json.loads(raw, object_pairs_hook=pairs)
    require(value['schema'] == 1 and value['authority'] == 'BRAIN-M1X-ONBOARDING-RESILIENCE16-CANDIDATE-01', 'IDENTITY')
    require(value['status'] == 'SOURCE_ONLY_CANDIDATE' and value['release'] == 'NO_GO' and
            value['acceptanceGranted'] is False and all(x is False for x in value['admissions'].values()), 'NO_ADMISSION')
    require(set(value['files']) == {'README.md', 'payload.zip', 'verify16.py'}, 'FINITE_CHECKPOINT')
    for name, witness in value['files'].items():
        data = regular(folder/name)
        require(len(data) == witness['bytes'] and digest(data) == witness['sha256'], 'FILE_AUTHENTICATION:'+name)
    require((folder/'payload.zip').stat().st_size <= 32*1024*1024, 'ARCHIVE_BOUND')
    with zipfile.ZipFile(folder/'payload.zip') as archive:
        entries = archive.infolist()
        require(len(entries) == len(value['members']) <= 512 and sum(x.file_size for x in entries) <= 128*1024*1024, 'MEMBER_BOUND')
        seen = set()
        for item in entries:
            require(safe(item.filename) and not item.is_dir() and not item.flag_bits & 1 and
                    stat.S_IFMT(item.external_attr >> 16) == stat.S_IFREG and not item.external_attr & 1024, 'UNSAFE_MEMBER')
            key = unicodedata.normalize('NFKC', item.filename).casefold()
            require(key not in seen, 'NFKC_CASEFOLD_COLLISION'); seen.add(key)
            witness = value['members'].get(item.filename)
            require(witness is not None and witness['mode'] == '100644', 'MEMBER_IDENTITY')
            data = archive.read(item)
            require(len(data) == witness['bytes'] and digest(data) == witness['sha256'], 'MEMBER_AUTHENTICATION:'+item.filename)
        require({x.filename for x in entries} == set(value['members']), 'EXACT_MEMBER_SET')
    if git_root is not None:
        def git(*args):
            return subprocess.check_output(['git', *args], cwd=git_root, stderr=subprocess.PIPE)
        source = value['source']['commit']; head = git('rev-parse', 'HEAD').decode().strip()
        require(git('rev-parse', source+'^{tree}').decode().strip() == value['source']['tree'], 'SOURCE_TREE')
        require(subprocess.run(['git', 'merge-base', '--is-ancestor', source, head], cwd=git_root,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE).returncode == 0, 'SOURCE_ANCESTRY')
        prefix = 'docs/brain/checkpoints/M1-02/ONBOARDING-RECOVERY-16/'
        allowed = {prefix+name for name in ['README.md', 'manifest.json', 'payload.zip', 'verify16.py']} | {'ONSKIN_BRAIN_HANDOFF.txt'}
        commits = git('rev-list', '--reverse', source+'..'+head).decode().splitlines()
        require(len(commits) == 1, 'EXACTLY_ONE_EVIDENCE_TAIL')
        require(len(git('rev-list', '--parents', '-n', '1', head).split()) == 2, 'LINEAR_TAIL')
        fields = git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', source, head).split(b'\0')
        changed = set()
        for i in range(0, len(fields)-1, 2):
            meta = fields[i].decode().split(); name = fields[i+1].decode()
            require(name in allowed and meta[1] == '100644' and meta[4] in ('A', 'M'), 'EVIDENCE_ONLY_TAIL')
            changed.add(name)
        require(changed == allowed, 'EXACT_TAIL_PATHS')
        require(git('status', '--porcelain=v1', '-uall') == b'', 'DIRTY_DELIVERY')
        for item in git('ls-files', '-v', '-z').split(b'\0'):
            if item: require(item.startswith(b'H '), 'INDEX_FLAGS')
        require(git('show', head+':'+prefix+'manifest.json') == raw, 'DELIVERY_MANIFEST')
    return dict(verified=True, members=len(value['members']), source=value['source'], git_checked=git_root is not None,
                release='NO_GO', acceptance='REVIEW_REQUIRED')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--expected-manifest-sha256', required=True)
    parser.add_argument('--git-root', type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(verify(Path(__file__).resolve().parent, args.expected_manifest_sha256, args.git_root), sort_keys=True))
        return 0
    except (ValueError, KeyError, TypeError, OSError, zipfile.BadZipFile, subprocess.SubprocessError) as error:
        print(json.dumps(dict(verified=False, error=str(error), release='NO_GO')))
        return 1


if __name__ == '__main__':
    sys.exit(main())
