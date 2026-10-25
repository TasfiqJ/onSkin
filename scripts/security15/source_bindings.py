"""Bounded read-only bindings. Hash custody is never qualified acceptance."""
import ast
import importlib.util
import os
from pathlib import Path
import re
import stat
import subprocess
import zlib

ROOT = Path(__file__).resolve().parents[2]
BASE = '53cf869c5fc5f13ecd18dc1ef9c3a6288eaae51a'
TREE = '1c483dedfb4c5d51994be07f65f1a40bdd52be73'
POLICY = 'docs/brain/contracts/SECURITY-15/coverage-policy15.v1.json'
CHECKPOINT = 'docs/brain/checkpoints/M1-03/G97-COVERAGE-CANDIDATE-15/'
AUTHORITY = 'BRAIN-M103-G97-FULL-COVERAGE15-CANDIDATE-01'
COMPARATOR_SHA = '79d23fa05323b71e3086bcb400a2a3499e5d4b864c01b6c4eb34845786920848'

# Reuse the unchanged authenticated bounded Git/blob/path/JSON primitives.
import hashlib
_comparator = ROOT/'scripts/security14/source_inventory.py'
if hashlib.sha256(_comparator.read_bytes()).hexdigest() != COMPARATOR_SHA:
    raise ValueError('COMPARATOR_IDENTITY')
_spec = importlib.util.spec_from_file_location('source14_primitives', _comparator)
inv = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(inv)
need, sha, canonical, parse, regular, path_key = inv.need, inv.sha, inv.canonical, inv.parse, inv.regular, inv.path_key


def git(root, *args):
    return inv.git(root, '--no-replace-objects', '--no-optional-locks', *args)


def paths(names):
    seen = {}
    for name in names:
        path_key(name)
        parts = name.split('/')
        for i in range(1, len(parts)+1):
            prefix = '/'.join(parts[:i]); key = path_key(prefix)
            need(key not in seen or seen[key] == prefix, 'CANONICAL_COLLISION')
            seen[key] = prefix


def entries(root, commit):
    rows = inv.tree_entries(git(root, 'ls-tree', '-rz', '--full-tree', commit))
    paths(rows)
    return rows


def strict_gzip(raw, limit=inv.LIMIT):
    dec = zlib.decompressobj(16+zlib.MAX_WBITS)
    body = dec.decompress(raw, limit+1)
    need(len(body) <= limit and dec.eof and not dec.unused_data and not dec.unconsumed_tail,
         'GZIP_TRUNCATED_AMBIGUOUS_OR_BOUND')
    return body


def policy(root):
    value = parse(regular(Path(root)/POLICY))
    need(value == POLICY_VALUE, 'POLICY_IDENTITY')
    return value


def witnesses(root, commit):
    need(git(root, 'rev-parse', BASE+'^{tree}').decode().strip() == TREE, 'BASE_TREE')
    current = entries(root, commit); base = entries(root, BASE)
    protected = {n:r for n,r in base.items() if n.startswith(inv.PREFIX) or
                 n.startswith('scripts/security14/') or n.startswith('.github/') or
                 n in ('.gitignore', 'docs/phase-9/security-advisory-exceptions.json')}
    need(all(current.get(n) == r for n,r in protected.items()), 'PROTECTED_SCANNER_WITNESS')
    for leaf, digest in inv.PINS.items():
        raw = regular(Path(root)/(inv.PREFIX+leaf))
        need(sha(raw) == digest and sha(git(root,'show',commit+':'+inv.PREFIX+leaf)) == digest,
             'ORIGINAL_WITNESS_IDENTITY')
    for n in protected:
        # No source is printed or interpreted except the hash-authenticated classifier.
        need(sha(regular(Path(root)/n)) == sha(git(root,'show',BASE+':'+n)), 'WORKTREE_WITNESS')
    original = inv.manifest_rows(regular(Path(root)/(inv.PREFIX+'source-manifest.json')),
                                 inv.PINS['source-manifest.json'])
    original.update({inv.PREFIX+n:inv.PINS[n] for n in ('source-manifest.json','proposal.json')})
    raw = regular(Path(root)/(inv.PREFIX+'scan-targets.json.gz'))
    strict_gzip(raw)
    coverage = inv.coverage_rows(raw, inv.PINS['scan-targets.json.gz'], original)
    return original, coverage, protected


def classifier(root):
    # Execute exactly the original classifier and its finite constants; no guessed rules.
    raw = regular(Path(root)/(inv.PREFIX+'contract.py'))
    need(sha(raw) == inv.PINS['contract.py'], 'ORIGINAL_CLASSIFIER')
    module = ast.parse(raw)
    selected = [n for n in module.body if
                isinstance(n, ast.FunctionDef) and n.name == 'coverage_kind' or
                isinstance(n, ast.Assign) and any(isinstance(t,ast.Name) and t.id in
                ('COMPRESSED_WITNESSES','ENGINE_SOURCE_ARCHIVE') for t in n.targets)]
    need(len(selected) == 3, 'CLASSIFIER_SCHEMA')
    env = dict(require=need)
    exec(compile(ast.Module(body=selected,type_ignores=[]), '<authenticated-original-classifier>', 'exec'), env)
    return env['coverage_kind']


def absences(root, names, original):
    directories = {''}
    for name in names:
        parts = name.split('/')[:-1]
        directories.update('/'.join(parts[:i]) for i in range(1,len(parts)+1))
    out = []
    for directory in sorted(directories):
        for leaf in ('.gitignore','.gitleaksignore','.semgrepignore'):
            name = (directory+'/' if directory else '')+leaf
            if name not in original:
                need(name not in names and not os.path.lexists(Path(root)/name), 'UNREVIEWED_SCAN_IGNORE')
                out.append(name)
    return out


def workspace(root, commit):
    before = git(root,'rev-parse','HEAD')
    need(before.decode().strip() == commit, 'WORKSPACE_SOURCE')
    need(not git(root,'status','--porcelain=v1','-z','--untracked-files=all'), 'WORKSPACE_DIRTY')
    tree = entries(root,commit); index = {}
    for raw in inv.nul(git(root,'ls-files','--stage','-z')):
        meta,name = raw.split(b'\t',1); mode,oid,stage = meta.decode('ascii').split()
        name=name.decode('utf-8'); need(stage=='0' and name not in index,'INDEX_STAGE')
        index[name]=dict(mode=mode,blob=oid)
    need(index == tree, 'INDEX_IDENTITY')
    need(all(r.startswith(b'H ') for r in inv.nul(git(root,'ls-files','-v','-z'))), 'INDEX_FLAGS')
    paths(index)
    # Ignored generated caches remain the original safe namespaces, never new source.
    for raw in inv.nul(git(root,'ls-files','--others','--ignored','--exclude-standard','-z',
                           '--','scripts','docs','apps','packages','supabase')):
        name=raw.decode('utf-8'); path_key(name)
        parts=name.split('/')
        safe_cache=any(p in ('node_modules','.turbo','.expo','dist','web-build','.temp','.branches') for p in parts)
        safe_cache = safe_cache or name.endswith('.tsbuildinfo') or name=='apps/mobile/expo-env.d.ts'
        need(safe_cache,'IGNORED_PROTECTED_SOURCE')
    directories={};total=0
    for name,row in tree.items():
        path=Path(root)/name
        for directory in path.parents:
            if directory not in directories:
                info=directory.lstat()
                need(stat.S_ISDIR(info.st_mode) and not stat.S_ISLNK(info.st_mode) and
                     not getattr(info,'st_file_attributes',0)&1024,'WORKTREE_DIRECTORY')
                directories[directory]=(info.st_dev,info.st_ino,info.st_mode)
        info=path.lstat();total+=info.st_size
        need(stat.S_ISREG(info.st_mode) and info.st_nlink==1 and
             not getattr(info,'st_file_attributes',0)&1024 and info.st_size<=inv.LIMIT and
             total<=2*1024**3,'WORKTREE_FILE_MODE_OR_BOUND')
        digest=hashlib.sha1(('blob '+str(info.st_size)+'\0').encode());size=0
        with path.open('rb') as stream:
            while True:
                chunk=stream.read(1024**2)
                if not chunk:break
                size+=len(chunk);need(size<=info.st_size,'WORKTREE_FILE_RACE');digest.update(chunk)
        after=path.lstat()
        need((info.st_dev,info.st_ino,info.st_size,info.st_mtime_ns,info.st_mode)==
             (after.st_dev,after.st_ino,after.st_size,after.st_mtime_ns,after.st_mode) and
             size==info.st_size and digest.hexdigest()==row['blob'],'WORKTREE_BLOB')
        if os.name != 'nt':
            executable=bool((Path(root)/name).stat().st_mode & stat.S_IXUSR)
            need(executable == (row['mode']=='100755'),'WORKTREE_MODE')
    for directory,identity in directories.items():
        info=directory.lstat()
        need((info.st_dev,info.st_ino,info.st_mode)==identity and
             not getattr(info,'st_file_attributes',0)&1024,'WORKTREE_DIRECTORY_RACE')
    need(git(root,'rev-parse','HEAD')==before and
         not git(root,'status','--porcelain=v1','-z','--untracked-files=all'),'WORKSPACE_RACE')
    return tree


POLICY_VALUE = {
    'schema':1, 'authority':AUTHORITY, 'status':'UNAPPLIED_CANDIDATE',
    'acceptanceGranted':False, 'base':{'commit':BASE,'tree':TREE},
    'originalSource':inv.ORIGINAL, 'originalManifestSha256':inv.PINS['source-manifest.json'],
    'originalTargetsSha256':inv.PINS['scan-targets.json.gz'],
    'scope':'ALL_GIT_REGULAR_FILES_AND_ALL_ORIGINAL_IDENTITIES_NO_ARCHIVAL_EXCLUSION',
    'newPaths':'UNREVIEWED_INCLUDE_NO_EXCLUSION',
    'originalPolicyRefusals':'BLOCKED_OUTSIDE_SCOPE_REQUIRES_ORIGINAL_SECURITY_CUSTODIAN',
    'tail':'ONE_SEPARATE_NEW_UNACCEPTED_EVIDENCE_DELTA_NO_SCAN_WAIVER',
    'limits':{'metadataBytes':inv.LIMIT,'blobBytes':inv.LIMIT,'snapshotBytes':2*1024**3,
              'paths':100000,'evidenceBytes':inv.LIMIT,'evidenceExpandedBytes':2*inv.LIMIT},
    'owners':['original Security source and scanner custodian','credential owners',
              'independent DB06/DB08/R2B custodian','readiness/CAT07 and native/J01 owners'],
    'admissions':dict(G97=False,DB=False,M103=False,M2=False,J01=False,PUBLIC=False),
    'spend_usd':0
}
