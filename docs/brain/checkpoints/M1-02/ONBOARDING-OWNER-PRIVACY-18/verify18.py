"""Authenticate Campaign18 evidence and derive its delivery identity; no acceptance."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import sys
import unicodedata
import zipfile

AUTHORITY = 'BRAIN-M1X-ONBOARDING-OWNER-PRIVACY18-REPAIR-01'
BASE = 'f9709e02420d6c03cc9b9586cf60d89bfde7d8a3'
TREE = 'c735b32c667059ba1d6855b6896c70e42d6c6fd8'
PREFIX = 'docs/brain/checkpoints/M1-02/ONBOARDING-OWNER-PRIVACY-18/'

INPUT_SHA256 = 'd6ce18a12f444fd91da5820fdf4e67900fd8d062de2515d2ef916d08a77c53df'
EDIT = {
'apps/mobile/src/features/onboarding/OnboardingContext.tsx',
'apps/mobile/src/features/onboarding/quizNavigation.test.ts',
'apps/mobile/src/app/onboarding/quiz.tsx', 'apps/mobile/src/app/onboarding/goals.tsx',
'apps/mobile/src/app/onboarding/products.tsx', 'apps/mobile/src/app/onboarding/analyzing.tsx',
'apps/mobile/src/app/onboarding/reveal.tsx',
'apps/mobile/src/features/onboarding/quizFocus17.test.ts',
'apps/mobile/src/features/onboarding/onboardingPrivacy17.test.ts',
'apps/mobile/src/features/onboarding/productsDraft17.test.ts',
'docs/USER_FLOW_TREE.md', 'scripts/release/full-app-j01/check.py',
'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md',
'ONSKIN_BRAIN_HANDOFF.txt'}
CREATE = {'apps/mobile/src/features/onboarding/'+name+'.test.'+suffix
    for name in ['onboardingOwner18','onboardingRoute18'] for suffix in ['ts','tsx']} | {
'scripts/m1/onboarding_owner_privacy18_browser.mjs',
'scripts/release/full-app-j01/source_consumer18.test.py'}
CREATE_PREFIXES = ('docs/brain/contracts/M1X-18/','docs/brain/task-specs/M1X-18/',PREFIX)

def allowed_change(path, old):
    return safe(path) and ((old and path in EDIT) or
        (not old and (path in CREATE or path.startswith(CREATE_PREFIXES))))

def require(ok, message):
    if not ok: raise ValueError(message)

def digest(data): return hashlib.sha256(data).hexdigest()

def pairs(items):
    value = {}
    for key, item in items:
        require(key not in value, 'DUPLICATE_JSON_KEY')
        value[key] = item
    return value

def decode(data):
    return json.loads(data, object_pairs_hook=pairs,
        parse_constant=lambda _: (_ for _ in ()).throw(ValueError('NONFINITE_JSON')))

def safe(name):
    return (isinstance(name, str) and re.fullmatch(r'[A-Za-z0-9._/-]+', name) is not None and
        not PurePosixPath(name).is_absolute() and all(part not in ('', '.', '..') and
        not part.startswith('.') and not part.endswith('.') and
        re.fullmatch(r'(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?', part, re.I) is None
        for part in name.split('/')))

def regular(path):
    for component in [path, *path.parents]:
        s = component.lstat()
        require(not stat.S_ISLNK(s.st_mode) and not getattr(s, 'st_file_attributes', 0) & 1024, 'LINK_OR_REPARSE')
    s = path.stat()
    require(stat.S_ISREG(s.st_mode) and s.st_nlink == 1, 'REGULAR_SINGLE_FILE_REQUIRED')
    return path.read_bytes()

def verify(folder, expected, git_root=None):
    require(re.fullmatch('[0-9a-f]{64}', expected or '') is not None, 'EXTERNAL_SHA_FORMAT')
    raw = regular(folder/'manifest.json')
    require(digest(raw) == expected, 'EXTERNAL_MANIFEST_MISMATCH')
    value = decode(raw)
    require(type(value['schema']) is int and value['schema'] == 1 and value['authority'] == AUTHORITY, 'IDENTITY')
    require(value['status'] == 'SOURCE_ONLY_CANDIDATE' and value['release'] == 'NO_GO' and
        value['acceptanceGranted'] is False and value['admissions'] ==
        dict(G97=False, DB=False, M103=False, M2=False, J01=False, PUBLIC=False), 'NO_ADMISSION')
    require(set(value['files']) == {'README.md','verify18.py','payload.zip'}, 'FINITE_CHECKPOINT')
    require({p.name for p in folder.iterdir()} == set(value['files']) | {'manifest.json'}, 'CHECKPOINT_INVENTORY')
    for name, witness in value['files'].items():
        data = regular(folder/name)
        require(len(data) == witness['bytes'] and digest(data) == witness['sha256'], 'FILE_AUTHENTICATION:'+name)
    require((folder/'payload.zip').stat().st_size <= 32*1024*1024, 'ARCHIVE_BOUND')
    members = {}
    with zipfile.ZipFile(folder/'payload.zip') as archive:
        entries = archive.infolist()
        require(len(entries) == len(value['members']) <= 1024 and
            sum(e.file_size for e in entries) <= 128*1024*1024, 'MEMBER_BOUND')
        seen = set()
        for item in entries:
            require(safe(item.filename) and not item.is_dir() and not item.flag_bits & 1 and
                item.external_attr >> 16 == (stat.S_IFREG | 0o644) and not item.external_attr & 1024,
                'UNSAFE_MEMBER')
            key = unicodedata.normalize('NFKC', item.filename).casefold()
            require(key not in seen, 'NFKC_CASEFOLD_COLLISION'); seen.add(key)
            data = archive.read(item); witness = value['members'].get(item.filename)
            require(witness is not None and witness['mode'] == '100644' and
                len(data) == witness['bytes'] and digest(data) == witness['sha256'], 'MEMBER_AUTHENTICATION:'+item.filename)
            members[item.filename] = data
        require(set(members) == set(value['members']), 'EXACT_MEMBER_SET')
    provenance = decode(members['proof/source-provenance.json'])
    require(value['source'] == provenance['source'] and value['base'] == provenance['base'] and
        value['base']['sha'] == BASE and value['base']['tree'] == TREE, 'SOURCE_PROVENANCE')
    derived = None
    if git_root is not None:
        def git(*args): return subprocess.check_output(['git',*args],cwd=git_root,stderr=subprocess.PIPE)
        def entries(commit):
            result = {}
            for row in git('ls-tree','-r','-z',commit).split(b'\0'):
                if not row: continue
                meta, name = row.split(b'\t',1); mode, kind, blob = meta.decode().split()
                result[name.decode('utf-8')] = dict(mode=mode,kind=kind,blob=blob)
            return result
        source = value['source']['sha']; head = git('rev-parse','HEAD').decode().strip()
        require(git('rev-parse',source+'^{tree}').decode().strip() == value['source']['tree'], 'SOURCE_TREE')
        require(git('rev-parse',BASE+'^{tree}').decode().strip() == TREE, 'BASE_TREE')
        context_prefix = 'docs/brain/task-specs/M1X-18/inputs/'
        context_raw = git('show',source+':'+context_prefix+'manifest.json')
        require(digest(context_raw) == INPUT_SHA256, 'ORIGINAL_EXTERNAL_INPUT')
        context = decode(context_raw)
        for name,witness in context['files'].items():
            require(safe(name), 'INPUT_NAME')
            data = git('show',source+':'+context_prefix+name)
            require(len(data) == witness['bytes'] and digest(data) == witness['sha256'], 'INPUT_BYTES')
        require(git('show',source+':'+context_prefix+'TASK_DIRECTIVE.md') ==
            git('show',source+':'+context_prefix+'PROMPT_TEMPLATE.md') ==
            git('show',source+':'+context_prefix+'EXACT_PROMPT.md'), 'INPUT_INTERNAL_PROMPT_EQUALITY')
        baseline_entries = entries(BASE)
        expected_commits = [row['sha'] for row in provenance['commits']]
        require(git('rev-list','--reverse',BASE+'..'+source).decode().splitlines() == expected_commits, 'SOURCE_COMMIT_CHAIN')
        for commit in provenance['commits']:
            require(git('rev-list','--parents','-n','1',commit['sha']).decode().split() ==
                [commit['sha'],commit['parent']], 'SOURCE_LINEAR_PARENT')
            require(git('rev-parse',commit['sha']+'^{tree}').decode().strip() == commit['tree'], 'SOURCE_COMMIT_TREE')
            commit_entries = entries(commit['sha'])
            actual_changes = {p for p in set(baseline_entries) | set(commit_entries)
                if baseline_entries.get(p) != commit_entries.get(p)}
            require(actual_changes == {r['path'] for r in commit['changes']}, 'INTERMEDIATE_EXACT_DELTA')
            for row in commit['changes']:
                entry = row['after']
                path = row['path']; old = baseline_entries.get(path)
                require(allowed_change(path, old is not None) and path in commit_entries,
                    'FINITE_EDIT_CREATE_GRANT:'+path)
                require({k:entry[k] for k in ['mode','kind','blob']} == commit_entries[path], 'INTERMEDIATE_ENTRY')
                require((row['before'] is None) == (old is None), 'INTERMEDIATE_BEFORE_SHAPE')
                if old is not None:
                    require({k:row['before'][k] for k in ['mode','kind','blob']} == old, 'INTERMEDIATE_BEFORE_ENTRY')
                require(entry is not None and entry['mode'] == '100644' and entry['kind'] == 'blob', 'SOURCE_MODE')
                data = git('show',commit['sha']+':'+row['path'])
                require(git('rev-parse',commit['sha']+':'+row['path']).decode().strip() == entry['blob'] and
                    len(data) == entry['bytes'] and digest(data) == entry['sha256'], 'SOURCE_CHANGED_BLOB')
        with subprocess.Popen(['git','cat-file','--batch'],cwd=git_root,
                stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE) as batch:
            hashes = {}
            for label, commit in [('baseline',BASE),('source',source)]:
                rows = [decode(line) for line in gzip.decompress(members['proof/'+label+'-inventory.jsonl.gz']).splitlines()]
                inventory = {row['path']:row for row in rows}
                require(all(row['commit'] == commit for row in rows), 'SOURCE_INVENTORY_COMMIT')
                require(len(inventory) == len(rows) == value['base' if label == 'baseline' else 'source']['paths'], 'SOURCE_INVENTORY_COUNT')
                require({name:{key:row[key] for key in ['mode','kind','blob']} for name,row in inventory.items()} ==
                    entries(commit), 'SOURCE_EXACT_OBJECT_INVENTORY')
                for row in rows:
                    oid = row['blob']
                    if oid not in hashes:
                        batch.stdin.write((oid+'\n').encode());batch.stdin.flush()
                        header = batch.stdout.readline().decode().split()
                        require(header[:2] == [oid,'blob'], 'GIT_BLOB_HEADER')
                        data = batch.stdout.read(int(header[2]))
                        require(batch.stdout.read(1) == b'\n' and
                            hashlib.sha1(('blob '+str(len(data))+'\0').encode()+data).hexdigest() == oid, 'GIT_BLOB_OBJECT')
                        hashes[oid] = (len(data),digest(data))
                    require(hashes[oid] == (row['bytes'],row['sha256']), 'SOURCE_INVENTORY_SHA256')
            batch.stdin.close();batch.wait()
            require(batch.returncode == 0, 'GIT_BATCH_EXIT')
        before, after = entries(BASE), entries(source)
        changed = {r['path'] for r in provenance['source_delta']}
        require(set(after)-set(before) == set(provenance['added']) and not set(before)-set(after), 'SOURCE_PATH_SET')
        require(changed == {p for p in set(before)|set(after) if before.get(p) != after.get(p)}, 'SOURCE_EXACT_DELTA')
        require(git('replace','-l') == b'' and git('rev-parse','--is-shallow-repository').strip() == b'false', 'UNREPLACED_COMPLETE_GIT')
        require(all(after[name] == entry for name,entry in before.items() if name not in changed), 'PROTECTED_BLOB_IDENTITY')
        require(git('rev-list','--reverse',source+'..'+head).decode().splitlines() == [head] and
            git('rev-list','--parents','-n','1',head).decode().split() == [head,source], 'EXACTLY_ONE_LINEAR_EVIDENCE_TAIL')
        expected_paths = {PREFIX+name for name in ['README.md','manifest.json','payload.zip','verify18.py']} | {'ONSKIN_BRAIN_HANDOFF.txt'}
        fields = git('diff','--raw','--no-abbrev','--no-renames','-z',source,head).split(b'\0')
        require(fields[-1] == b'' and len(fields)%2 == 1, 'TAIL_DIFF_SHAPE')
        actual = set()
        for i in range(0,len(fields)-1,2):
            meta = fields[i].decode().split(); name = fields[i+1].decode()
            require(len(meta) == 5 and name in expected_paths and meta[1] == '100644' and
                meta[4] == ('M' if name == 'ONSKIN_BRAIN_HANDOFF.txt' else 'A'), 'EVIDENCE_ONLY_TAIL')
            actual.add(name)
        require(actual == expected_paths, 'EXACT_TAIL_PATHS')
        require(git('status','--porcelain=v1','-uall') == b'', 'DIRTY_DELIVERY')
        require(all(e.startswith(b'H ') for e in git('ls-files','-v','-z').split(b'\0') if e), 'INDEX_FLAGS')
        require(git('show',head+':'+PREFIX+'manifest.json') == raw, 'DELIVERY_MANIFEST')
        for name in value['files']:
            require(git('show',head+':'+PREFIX+name) == regular(folder/name), 'DELIVERY_FILE:'+name)
        pointer = git('show',head+':ONSKIN_BRAIN_HANDOFF.txt').decode('utf-8')
        require(digest(raw) in pointer and source in pointer and 'https://github.com/TasfiqJ/onSkin/pull/22' in pointer and
            all(x in pointer for x in ['G97 FAIL/NO_GO','DB06/DB08/R2B NOT_ACCEPTED','M1-03 BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED','M2 NOT_AUTHORIZED','USD0']), 'NON_ADMITTING_POINTER')
        derived = dict(sha=head,tree=git('rev-parse',head+'^{tree}').decode().strip())
    return dict(status='VERIFIED',members=len(members),source=value['source'],delivery=derived,
        git_checked=git_root is not None,source_acceptance='REVIEW_REQUIRED',release='NO_GO')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--expected-manifest-sha256',required=True)
    parser.add_argument('--git-root',type=Path)
    args=parser.parse_args()
    try:
        print(json.dumps(verify(Path(__file__).absolute().parent,args.expected_manifest_sha256,args.git_root),sort_keys=True));return 0
    except (ValueError,KeyError,TypeError,OSError,zipfile.BadZipFile,subprocess.SubprocessError) as error:
        print(json.dumps(dict(status='INVALID',error=str(error),release='NO_GO')));return 1

if __name__=='__main__':sys.exit(main())
