"""Independently anchored finite Campaign18 orientation packet verifier; not source acceptance."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys
import unicodedata

AUTH = 'BRAIN-M1X-ONBOARDING-OWNER-PRIVACY18-REPAIR-01'
EXPECTED = {
    '00_READ_FIRST.md',
    '01_PR21_AUDIT_AND_CI.md',
    '02_OWNER_BOUNDARY_INVARIANTS.md',
    '03_RELEASE_SCOPE_AND_GATES.md',
    '04_SAFE_ENGINEERING_PROTOCOL.md',
    'TASK_DIRECTIVE.md',
    'EXACT_PROMPT.md',
    'PROMPT_TEMPLATE.md',
    'verify_packet.py',
}

def require(condition: bool, reason: str) -> None:
    if not condition:
        raise ValueError(reason)

def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def unique_pairs(items):
    output = {}
    for key, value in items:
        require(key not in output, 'DUPLICATE_MANIFEST_KEY')
        output[key] = value
    return output

def safe_name(name: str) -> bool:
    return (bool(re.fullmatch(r'[A-Za-z0-9._/-]+', name))
        and all(component and component not in ('.','..')
                and not component.endswith('.')
                and not component.startswith('.')
                and not re.fullmatch(r'(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?', component, re.I)
                for component in name.split('/')))

def safe_regular(path: Path, root: Path) -> bytes:
    require(path.parent == root and not path.is_dir(), 'EXPECTED_TOP_LEVEL_FILE')
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode), 'NONREGULAR_MEMBER:'+path.name)
    require(not info.st_mode & (stat.S_ISUID | stat.S_ISGID | stat.S_ISVTX), 'SPECIAL_BITS')
    require(not getattr(info, 'st_file_attributes', 0) & 1024, 'REPARSE_MEMBER')
    require(info.st_nlink == 1, 'HARDLINK_MEMBER')
    require(info.st_size <= 2_000_000, 'UNBOUNDED_MEMBER')
    return path.read_bytes()

def verify(root: Path, anchor: str) -> dict:
    require(re.fullmatch('[a-f0-9]{64}', anchor) is not None, 'BAD_EXTERNAL_ANCHOR')
    root = root.absolute()
    require(root.is_dir() and not root.is_symlink(), 'ROOT_IS_NOT_REGULAR_DIR')
    contents = list(root.iterdir())
    names = [x.name for x in contents]
    require(all(safe_name(name) for name in names), 'UNSAFE_OR_COLLIDING_MEMBER_NAME')
    norm_names = [unicodedata.normalize('NFKC', n).casefold() for n in names]
    require(len(norm_names) == len(set(norm_names)), 'NFKC_CASEFOLD_COLLISION')
    require(set(names) == EXPECTED | {'manifest.json'}, 'EXACT_INVENTORY_MISMATCH')
    manifest_raw = safe_regular(root/'manifest.json', root)
    require(sha256(manifest_raw) == anchor, 'EXTERNAL_MANIFEST_ANCHOR_MISMATCH')
    manifest = json.loads(manifest_raw, object_pairs_hook=unique_pairs)
    require(set(manifest) == {'schema','authority','packet_kind','admissions','acceptanceGranted','files'}, 'MANIFEST_SHAPE')
    require(type(manifest['schema']) is int and manifest['schema'] == 1, 'MANIFEST_SCHEMA')
    require(manifest['authority'] == AUTH and manifest['packet_kind'] == 'CODEX_ORIENTATION', 'PACKET_IDENTITY')
    require(manifest['acceptanceGranted'] is False and all(v is False for v in manifest['admissions'].values()), 'MUST_NOT_GRANT_ACCEPTANCE')
    require(set(manifest['files']) == EXPECTED, 'MANIFEST_INVENTORY')
    for name in sorted(EXPECTED):
        record = manifest['files'][name]
        require(set(record) == {'sha256','bytes'}, 'MANIFEST_RECORD_SHAPE:'+name)
        content = safe_regular(root/name, root)
        require(len(content) == record['bytes'] and sha256(content) == record['sha256'], 'FILE_DIGEST_MISMATCH:'+name)
    require((root/'TASK_DIRECTIVE.md').read_bytes() == (root/'PROMPT_TEMPLATE.md').read_bytes() ==
            (root/'EXACT_PROMPT.md').read_bytes(), 'PROMPT_DERIVATION_MISMATCH')
    return {'status':'VERIFIED','files':len(EXPECTED),'authority':AUTH,'sourceAcceptance':False,'release':'NO_GO'}

def main() -> int:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--expected-manifest-sha256', required=True)
    args=parser.parse_args()
    try:
        result=verify(Path(__file__).resolve().parent,args.expected_manifest_sha256)
        print('VERIFIED')
        print(json.dumps(result,sort_keys=True))
        return 0
    except (ValueError, TypeError, OSError, KeyError, json.JSONDecodeError) as exc:
        print('CONTEXT_INVALID: '+str(exc))
        return 1
if __name__ == '__main__':
    sys.exit(main())
