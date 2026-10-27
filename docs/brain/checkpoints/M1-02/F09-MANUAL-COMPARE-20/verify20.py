"""Externally anchored Campaign20 artifact/source integrity. Never grants acceptance."""
import argparse
import ast
import hashlib
import json
from pathlib import Path
import re
import stat
import subprocess
import sys
import unicodedata
import zipfile

AUTHORITY = 'BRAIN-M1X-F09-MANUAL-PHOTO-COMPARE20-CANDIDATE-01'
INPUT_SHA = '41b0c20e2a74c033f68f758cc96ad8be6e5b72daa51917652c5b9cb206c53cfd'
BASE = '9b3b1781ad65b10ae6b3ade7c1a87a03a64374e4'
BASE_TREE = '961d24a7427667aab610939f3a4d088db0a90430'
PREFIX = 'docs/brain/checkpoints/M1-02/F09-MANUAL-COMPARE-20/'
EXISTING = {
    'apps/mobile/src/app/(tabs)/progress.tsx',
    *['apps/mobile/src/features/photos/'+p for p in ['CompareSlider.tsx', 'compareAccessibility.ts',
       'timeline.ts', 'copy.ts', 'compareAccessibility.test.ts', 'timeline.test.ts',
       'progressRoutes.test.ts', 'progressImageDemand.test.ts']],
    'docs/USER_FLOW_TREE.md', 'scripts/release/full-app-j01/check.py',
    'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md',
    'ONSKIN_BRAIN_HANDOFF.txt',
}
NEW = {
    *['apps/mobile/src/features/photos/'+p for p in ['manualCompare20.ts', 'manualCompare20.test.ts', 'manualCompare20Route.test.ts']],
    'scripts/m1/f09_manual_compare20_browser.mjs', 'scripts/release/full-app-j01/source_consumer20.test.py',
}
PREFIXES = ('docs/brain/contracts/M1X-20/', 'docs/brain/task-specs/M1X-20/', PREFIX)


def require(value, error):
    if not value:
        raise ValueError(error)


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
                      parse_constant=lambda value: (_ for _ in ()).throw(ValueError('NONFINITE_JSON')))


def safe(name):
    return isinstance(name, str) and re.fullmatch(r'[A-Za-z0-9._/()-]+', name) is not None and all(
        part and not part.startswith('.') and not part.endswith('.') and
        re.fullmatch(r'(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?', part, re.I) is None
        for part in name.split('/'))


def regular(path):
    for item in [path]+list(path.parents):
        metadata = item.lstat()
        require(not stat.S_ISLNK(metadata.st_mode) and not (getattr(metadata, 'st_file_attributes', 0) & 1024),
                'LINK_OR_REPARSE:'+str(item))
    require(path.is_file(), 'NOT_REGULAR:'+str(path))
    return path.read_bytes()


def inventory_check(data, expected, name):
    require(set(expected) == {'bytes', 'sha256'} and type(expected['bytes']) is int and
            expected['bytes'] == len(data) and expected['sha256'] == sha(data), 'ARTIFACT_SHA256:'+name)


def handoff(source, digest):
    return (f'''Campaign20 F09 private manual photo comparison SOURCE_ONLY_CANDIDATE / PARTIAL_BLOCKED / NO_GO.
Authority {AUTHORITY}.
Input manifest {INPUT_SHA}.
Draft PR24 https://github.com/TasfiqJ/onSkin/pull/24
Branch stage/m1-f09-manual-photo-compare20; base stage/m1-onboarding-compatibility19.
Immutable parent {BASE}; tree {BASE_TREE}.
Frozen runtime {source['runtimeHead']}; tree {source['runtimeTree']}.
Frozen source after unchanged-producer worklist {source['sourceHead']}; tree {source['sourceTree']}.
Checkpoint {PREFIX}README.md
External checkpoint manifest SHA256 {digest}
Verify: python -B {PREFIX}verify20.py --expected-manifest-sha256 {digest} --git-root .
Exactly one evidence-only descendant follows frozen source; verification derives the final HEAD/tree. Exact later final-head checks, CI, failures/skips and return custody are in the external FINAL_REPORT.md and verified return ZIP.
Seven protected populated-layout fixture cases remain UNAPPLIED: apps/mobile/src/features/photos/progressEmptyLayout.c08b2.test.ts omits Query/health authority and current front-series metadata. No protected gate or old test was weakened for a green result. Independent Brain source acceptance is required.
Synthetic Expo web, source tests and exports do not establish signed/native iPhone, VoiceOver, actual StoreKit, provider, clinical/legal, Apple or public release. G97 FAIL/NO_GO; DB06/DB08/R2B NOT_ACCEPTED; M1-03 BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED; M2 NOT_AUTHORIZED; J01 G1/G2/G3/G5 NOT_ACCEPTED.
The entire working non-Korean F01-F17/F19-F20, 12 consumer C and six professional P groups including required F09, plus exactly independently validated J01 Visible Pores remain required. F18 and J02-J27 including J05 are deferred. USD0; no merge, prior-branch/main edit, force push, auto-merge, maintainer modification, private Security custody or self-acceptance.
''').encode()


def verify(expected, git_root=None):
    here = Path(__file__).absolute().parent
    manifest_raw = regular(here/'manifest.json')
    require(re.fullmatch('[0-9a-f]{64}', expected) is not None and sha(manifest_raw) == expected,
            'EXTERNAL_MANIFEST_SHA256')
    manifest = parse(manifest_raw)
    require(manifest['schema'] == 1 and manifest['authority'] == AUTHORITY and
            manifest['acceptanceGranted'] is False and manifest['release'] == 'NO_GO' and
            manifest['status'] == 'SOURCE_ONLY_CANDIDATE_PARTIAL_BLOCKED' and
            manifest['inputManifestSHA256'] == INPUT_SHA and manifest['rootTestFailures'] == 7,
            'NON_ADMISSION_CONTRACT')
    names = set()
    actual = set()
    for path in here.rglob('*'):
        require(not path.is_symlink(), 'ARTIFACT_LINK')
        if path.is_dir():
            require(not (getattr(path.lstat(), 'st_file_attributes', 0) & 1024), 'ARTIFACT_REPARSE')
            continue
        name = path.relative_to(here).as_posix()
        require(safe(name), 'ARTIFACT_NAME')
        key = unicodedata.normalize('NFKC', name).casefold()
        require(key not in names, 'ARTIFACT_COLLISION')
        names.add(key)
        actual.add(name)
        if name != 'manifest.json':
            require(name in manifest['files'], 'EXTRA_ARTIFACT:'+name)
            inventory_check(regular(path), manifest['files'][name], name)
    require(actual == set(manifest['files']) | {'manifest.json'}, 'ARTIFACT_INVENTORY')
    payload = {}
    with zipfile.ZipFile(here/'payload.zip') as archive:
        seen = set()
        for info in archive.infolist():
            require(safe(info.filename) and not info.is_dir() and not (info.flag_bits & 1), 'PAYLOAD_NAME')
            mode = info.external_attr >> 16
            require(stat.S_IFMT(mode) == stat.S_IFREG and stat.S_IMODE(mode) == 0o644 and
                    not (info.external_attr & 1024), 'PAYLOAD_MODE')
            key = unicodedata.normalize('NFKC', info.filename).casefold()
            require(key not in seen, 'PAYLOAD_COLLISION')
            seen.add(key)
            require(info.filename in manifest['payload'], 'EXTRA_PAYLOAD')
            data = archive.read(info)
            inventory_check(data, manifest['payload'][info.filename], info.filename)
            payload[info.filename] = data
    require(set(payload) == set(manifest['payload']), 'PAYLOAD_INVENTORY')
    packet_prefix = 'inputs/packet/'
    raw = payload[packet_prefix+'manifest.json']
    require(sha(raw) == INPUT_SHA, 'ORIGINAL_INPUT_MANIFEST')
    packet = parse(raw)
    require(len(packet['files']) == 9 and packet['promptIdentical'] is True, 'NINE_AUTHENTICATED_INPUTS')
    require({name[len(packet_prefix):] for name in payload if name.startswith(packet_prefix)} ==
            set(packet['files']) | {'manifest.json'}, 'ORIGINAL_INPUT_INVENTORY')
    for name, entry in packet['files'].items():
        inventory_check(payload[packet_prefix+name], entry, name)
    require(len({payload[packet_prefix+name] for name in ['TASK_DIRECTIVE.md', 'PROMPT_TEMPLATE.md', 'EXACT_PROMPT.md']}) == 1,
            'ORIGINAL_PROMPT_TRIAD')
    result = dict(status='VERIFIED', admission='NONE', release='NO_GO',
                  qualification='ARTIFACT_INTEGRITY_ONLY; PARTIAL_BLOCKED_SOURCE_REVIEW_REQUIRED',
                  files=len(manifest['files']), payloadFiles=len(payload), inputFiles=9)
    if git_root is None:
        return result
    root = Path(git_root).absolute()
    def git(*args):
        return subprocess.check_output(['git', *args], cwd=root, stderr=subprocess.PIPE)
    source = manifest['source']
    require(source['base'] == BASE and source['baseTree'] == BASE_TREE and
            git('rev-parse', BASE+'^{tree}').decode().strip() == BASE_TREE, 'PINNED_PARENT')
    require(git('status', '--porcelain=v1', '--untracked-files=all', '-z') == b'', 'CLEAN_CHECKOUT_REQUIRED')
    require(all(not entry or entry.startswith(b'H ') for entry in git('ls-files', '-v', '-z').split(b'\0')), 'INDEX_FLAGS')
    proof = parse(payload['proof/source-inventory.json'])
    commits = git('rev-list', '--reverse', BASE+'..'+source['sourceHead']).decode().splitlines()
    require([row['commit'] for row in proof['commits']] == commits and bool(commits), 'COMPLETE_SOURCE_HISTORY')
    for row in proof['commits']:
        commit = row['commit']
        identity = git('rev-list', '--parents', '-n', '1', commit).decode().split()
        require(len(identity) == 2 and identity[1] == row['parent'] and
                git('rev-parse', commit+'^{tree}').decode().strip() == row['tree'], 'SOURCE_COMMIT_TREE_PARENT')
        fields = git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', BASE, commit).split(b'\0')
        require(fields[-1] == b'' and len(fields) % 2 == 1, 'SOURCE_DIFF_SHAPE')
        actual_paths = []
        for index in range(0, len(fields)-1, 2):
            meta = fields[index].decode().split()
            name = fields[index+1].decode()
            require(safe(name) and (name in EXISTING or name in NEW or name.startswith(PREFIXES)) and
                    meta[1] == '100644' and meta[4] in ['M', 'A'], 'FINITE_SOURCE_SCOPE:'+name)
            data = git('show', commit+':'+name)
            actual_paths.append(dict(path=name, mode=meta[1], blob=meta[3], bytes=len(data), sha256=sha(data)))
        require(actual_paths == row['paths'], 'EXACT_INTERMEDIATE_INVENTORY')
        changed = git('diff', '--name-only', '--no-renames', '-z', row['parent'], commit).decode().split('\0')[:-1]
        require(changed == row['changedFromParent'], 'INTERMEDIATE_PARENT_DIFF')
    require(git('rev-parse', source['runtimeHead']+'^{tree}').decode().strip() == source['runtimeTree'] and
            git('rev-parse', source['sourceHead']+'^{tree}').decode().strip() == source['sourceTree'] and
            git('rev-parse', source['sourceHead']+'^').decode().strip() == source['runtimeHead'], 'FROZEN_IDENTITIES')
    worklist = git('diff', '--name-only', '-z', source['runtimeHead'], source['sourceHead']).decode().split('\0')[:-1]
    require(set(worklist) == {'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md'},
            'WORKLIST_ONLY_COMMIT')
    producer = 'scripts/phase4/build-source-worklist.mjs'
    require(git('show', BASE+':'+producer) == regular(root/producer) and
            sha(regular(root/producer)) == manifest['producerSHA256'], 'UNMODIFIED_PRODUCER')
    before = git('show', BASE+':scripts/release/full-app-j01/check.py')
    current = regular(root/'scripts/release/full-app-j01/check.py')
    tail = b"if __name__ == '__main__':\n    sys.exit(main())\n"
    require(before.endswith(tail) and current.startswith(before[:-len(tail)]), 'INHERITED_CHECKER_BYTES')
    head = git('rev-parse', 'HEAD').decode().strip()
    parents = git('rev-list', '--parents', '-n', '1', head).decode().split()
    require(len(parents) == 2 and parents[1] == source['sourceHead'], 'ONE_FINAL_EVIDENCE_TAIL')
    paths = git('diff', '--name-only', '--no-renames', '-z', source['sourceHead'], head).decode().split('\0')[:-1]
    require(set(paths) == {PREFIX+name for name in manifest['files']} | {PREFIX+'manifest.json', 'ONSKIN_BRAIN_HANDOFF.txt'},
            'EXACT_EVIDENCE_TAIL')
    raw_tail = git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', source['sourceHead'], head).split(b'\0')
    for index in range(0, len(raw_tail)-1, 2):
        meta = raw_tail[index].decode().split()
        name = raw_tail[index+1].decode()
        require(meta[1] == '100644' and meta[4] == ('M' if name == 'ONSKIN_BRAIN_HANDOFF.txt' else 'A'), 'EVIDENCE_TAIL_MODE')
    require(regular(root/'ONSKIN_BRAIN_HANDOFF.txt') == handoff(source, expected), 'FACTUAL_HANDOFF')
    for entry in proof['commits'][-1]['paths']:
        if entry['path'] != 'ONSKIN_BRAIN_HANDOFF.txt':
            inventory_check(regular(root/entry['path']), dict(bytes=entry['bytes'], sha256=entry['sha256']), entry['path'])
    result.update(sourceHead=source['sourceHead'], runtimeHead=source['runtimeHead'],
                  finalHead=head, finalTree=git('rev-parse', 'HEAD^{tree}').decode().strip(), sourceCommits=len(commits))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--expected-manifest-sha256', required=True)
    parser.add_argument('--git-root', type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(verify(args.expected_manifest_sha256, args.git_root), sort_keys=True))
        return 0
    except (ValueError, KeyError, TypeError, OSError, zipfile.BadZipFile, subprocess.SubprocessError) as error:
        print(json.dumps(dict(status='REJECTED', admission='NONE', release='NO_GO', error=str(error)), sort_keys=True))
        return 1


if __name__ == '__main__':
    sys.exit(main())
