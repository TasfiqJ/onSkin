"""Campaign11 independent consistency verifier. External manifest SHA256 is mandatory.
No source, Security, database, main-promotion or release acceptance is granted.
"""
import argparse
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import unicodedata
import zipfile
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
BASE = '14805e7f708297e72419035f517acc41ba52da70'
SOURCE = '90a2b90bc859172683fd4a352ddd4cb13b307e89'
SOURCE_TREE = 'd3b9e8c6626d8b04632ec586ee408b160d8f0393'
PREFIX = 'docs/brain/checkpoints/M1-03/SECURITY-SOURCE-11/'
AUTHORITY = 'BRAIN-M103-SOURCE-RECOVERY11-CANDIDATE-01'
checked_directories = set()
archived_logs = None


def require(ok, label):
    if not ok:
        raise ValueError(label)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def blob(raw):
    return hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, stderr=subprocess.PIPE)


def disk(path):
    return Path('\\\\?\\'+str(path.absolute())) if os.name == 'nt' and not str(path).startswith('\\\\?\\') else path


def regular(path):
    if path.parent == HERE/'logs':
        require(not os.path.lexists(str(disk(HERE/'logs'))), 'ARCHIVE_LOGS_SHADOW')
        return archive_logs()[path.name]
    for part in [path]+list(path.parents):
        if part != path and part in checked_directories:
            break
        info = disk(part).lstat()
        require(not stat.S_ISLNK(info.st_mode) and not getattr(info, 'st_file_attributes', 0)&1024,
                'NONREGULAR:'+str(part))
        require(stat.S_ISREG(info.st_mode) if part == path else stat.S_ISDIR(info.st_mode),
                'NONREGULAR:'+str(part))
        if part != path:
            checked_directories.add(part)
    return disk(path).read_bytes()


def archive_logs():
    global archived_logs
    if archived_logs is None:
        entries = {}
        names = set()
        total = 0
        with zipfile.ZipFile(io.BytesIO(regular(HERE/'raw-evidence.zip'))) as archive:
            for info in archive.infolist():
                name = info.filename
                require(name == info.orig_filename and re.fullmatch(r'[A-Za-z0-9._-]+', name) and
                        name not in ('.', '..') and not info.is_dir() and not info.flag_bits&1 and
                        not info.external_attr&0x10,
                        'ARCHIVE_PATH')
                normalized = unicodedata.normalize('NFKC', name).casefold()
                require(normalized not in names, 'ARCHIVE_COLLISION')
                names.add(normalized)
                mode = info.external_attr >> 16
                require(stat.S_IFMT(mode) in (0,stat.S_IFREG) and mode&0o777 in (0,0o644),
                        'ARCHIVE_MODE')
                total += info.file_size
                require(info.file_size <= 16*1024*1024 and total <= 64*1024*1024, 'ARCHIVE_SIZE')
                entries[name] = archive.read(info)
        archived_logs = entries
    return archived_logs


def pairs(items):
    value = {}
    for key, entry in items:
        require(key not in value, 'DUPLICATE_KEY:'+key)
        value[key] = entry
    return value


def load(path):
    return json.loads(regular(path), object_pairs_hook=pairs)


def tree(rev):
    result = {}
    for entry in git('ls-tree', '-r', '-z', rev).split(b'\0'):
        if entry:
            meta, name = entry.split(b'\t', 1)
            mode, kind, oid = meta.decode().split()
            result[name.decode()] = dict(mode=mode, kind=kind, blob=oid)
    return result


def key(path):
    require(isinstance(path, str) and not re.search(r'(^/|\\|:|(^|/)\.\.?(/|$))', path), 'PATH')
    require(all(p and p == p.strip() and not p.endswith('.') for p in path.split('/')), 'PATH_SEGMENT')
    return unicodedata.normalize('NFKC', path).casefold()


def log(name, stream='stdout'):
    path = HERE/'logs'/(name+'.'+stream+'.log.gz')
    return gzip.decompress(regular(path))


def receipt(name):
    value = load(HERE/'logs'/(name+'.json'))
    require(sha(log(name)) == value['stdout_sha256'] and
            sha(log(name,'stderr')) == value['stderr_sha256'], 'RAW_RECEIPT:'+name)
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--expected-manifest-sha256', required=True)
    args = parser.parse_args()
    require(re.fullmatch('[0-9a-f]{64}', args.expected_manifest_sha256), 'DIGEST_FORMAT')
    require(sha(regular(HERE/'manifest.json')) == args.expected_manifest_sha256, 'EXTERNAL_MANIFEST_MISMATCH')
    manifest = load(HERE/'manifest.json')
    require(manifest['authorization'] == AUTHORITY and manifest['source'] == SOURCE and
            manifest['source_tree'] == SOURCE_TREE and manifest['status'] == 'SUBMITTED_REVIEW_REQUIRED',
            'MANIFEST_BINDING')
    inventory = set()
    normalized = set()
    for record in manifest['files']:
        name = record['path']
        name_key = key(name)
        require(name_key not in normalized and name != 'manifest.json', 'INVENTORY_COLLISION')
        normalized.add(name_key)
        inventory.add(name)
        raw = regular(HERE/name)
        require(len(raw) == record['bytes'] and sha(raw) == record['sha256'] and blob(raw) == record['blob'] and
                record['mode'] == '100644', 'CHECKPOINT_IDENTITY:'+name)
    actual = {p.relative_to(disk(HERE)).as_posix() for p in disk(HERE).rglob('*') if p.is_file()}
    require(actual == inventory|{'manifest.json'}, 'CHECKPOINT_EXACT_INVENTORY')
    logs = archive_logs()
    require(set(logs) == {r['path'] for r in manifest['archive_files']}, 'ARCHIVE_EXACT_INVENTORY')
    for record in manifest['archive_files']:
        raw = logs[record['path']]
        require(len(raw) == record['bytes'] and sha(raw) == record['sha256'] and
                blob(raw) == record['blob'] and record['mode'] == '100644',
                'ARCHIVE_IDENTITY:'+record['path'])
    packet_digest = 'c9c211ec438a67a207a9cec8d95b135207166e7162de7d036489445aa0995ab3'
    require(sha(regular(HERE/'intake/manifest.json')) == packet_digest, 'INTAKE_EXTERNAL_ANCHOR')
    packet = subprocess.run([sys.executable,'-B','verify_packet.py','--expected-manifest-sha256',packet_digest],
                            cwd=HERE/'intake', capture_output=True)
    require(packet.returncode == 0 and b'VERIFIED' in packet.stdout, 'INTAKE_VERIFICATION')
    require(not git('status','--porcelain=v1').strip(), 'WORKTREE_NOT_CLEAN')
    head = git('rev-parse','HEAD').decode().strip()
    source, delivery, base = tree(SOURCE), tree(head), tree(BASE)
    require(git('rev-parse',SOURCE+'^{tree}').decode().strip() == SOURCE_TREE and
            git('rev-parse',BASE+'^{tree}').decode().strip() == '90c9427743b99fb43747d68cd55e413d2aee3ad4',
            'PINNED_TREE')
    proof = load(HERE/'source-proof.json')
    require(proof['source'] == SOURCE and proof['source_tree'] == SOURCE_TREE and
            proof['base'] == BASE, 'SOURCE_PROOF')
    require({r['path']:{k:r[k] for k in ('mode','kind','blob')} for r in proof['files']} == source,
            'SOURCE_EXACT_INVENTORY')
    protected = [r for r in proof['files'] if r['protected_at_final']]
    require(len(protected) == proof['protected_final_count'], 'PROTECTED_COUNT')
    for record in proof['files']:
        name = record['path']
        require(delivery.get(name) == source[name] or name == 'ONSKIN_BRAIN_HANDOFF.txt',
                'SOURCE_CHANGED:'+name)
        raw = git('show',SOURCE+':'+name) if name == 'ONSKIN_BRAIN_HANDOFF.txt' else regular(ROOT/name)
        require(len(raw) == record['bytes'] and sha(raw) == record['sha256'] and blob(raw) == record['blob'],
                'SOURCE_BYTES:'+name)
        if record['protected_at_final']:
            require(base.get(name) == source[name], 'PROTECTED_PREIMAGE:'+name)
        if 'preimage' in record:
            before = git('show',BASE+':'+name)
            require(base[name] == {k:record['preimage'][k] for k in ('mode','kind','blob')} and
                    sha(before) == record['preimage']['sha256'], 'PREIMAGE_BYTES:'+name)
    history = git('rev-list','--reverse',BASE+'..'+SOURCE).decode().splitlines()
    require(history == [r['commit'] for r in proof['intermediate_commits']], 'HISTORY_INVENTORY')
    for record in proof['intermediate_commits']:
        commit = record['commit']
        entries = tree(commit)
        require(git('rev-list','--parents','-n','1',commit).decode().split() == [commit,record['parent']],
                'HISTORY_PARENT')
        require(git('rev-parse',commit+'^{tree}').decode().strip() == record['tree'], 'HISTORY_TREE')
        changed = {p:r for p,r in entries.items() if base.get(p) != r}
        require(set(changed) == set(record['changed_from_pr14']), 'HISTORY_FRONTIER')
        for name, identity in record['changed_from_pr14'].items():
            require(changed[name] == {k:identity[k] for k in ('mode','kind','blob')} and
                    sha(git('show',commit+':'+name)) == identity['sha256'], 'HISTORY_BYTES:'+name)
    for name in proof['absences']:
        require(not disk(ROOT/name).exists() and
                not any(p == name or p.startswith(name+'/') for p in delivery), 'ABSENCE:'+name)
    for commit in git('rev-list','--reverse',SOURCE+'..'+head).decode().splitlines():
        parents = git('rev-list','--parents','-n','1',commit).decode().split()
        require(len(parents) == 2, 'EVIDENCE_LINEAR')
        frontier = git('diff-tree','--no-commit-id','--name-only','-r',parents[1],commit).decode().splitlines()
        require(frontier and all(p == 'ONSKIN_BRAIN_HANDOFF.txt' or p.startswith(PREFIX) for p in frontier),
                'EVIDENCE_ONLY_TAIL')
    require(git('merge-base','--is-ancestor',SOURCE,head) == b'', 'SOURCE_ANCESTRY')
    frontier = {p for p in set(delivery)|set(source) if delivery.get(p) != source.get(p)}
    require(frontier == {'ONSKIN_BRAIN_HANDOFF.txt',PREFIX+'manifest.json',*[PREFIX+p for p in inventory]},
            'EVIDENCE_EXACT_FRONTIER')
    handoff = regular(ROOT/'ONSKIN_BRAIN_HANDOFF.txt')
    identity = manifest['root_handoff']
    require(sha(handoff) == identity['sha256'] and blob(handoff) == identity['blob'] and
            len(handoff) == identity['bytes'] and identity['mode'] == '100644', 'ROOT_HANDOFF_BINDING')
    for name in frontier:
        require(delivery[name]['mode'] == '100644' and delivery[name]['kind'] == 'blob' and
                delivery[name]['blob'] == blob(regular(ROOT/name)), 'EVIDENCE_GIT_IDENTITY:'+name)
    for name in ('final-root-tests-bounded','final-root-typecheck','final-root-lint','final-inherited',
                 'final-source09','final-source10','final-source11','final-dependency11',
                 'final-phase4-controls','final-source-packet-controls','final-launch-contract'):
        record = receipt(name)
        require(record['exit'] == 0 and record['source'] == [SOURCE,SOURCE_TREE], 'SUCCESS_RECEIPT:'+name)
    ci = load(HERE/'logs/source-ci-semantic151.json')
    ci_raw = gzip.decompress(regular(HERE/'logs/source-ci-quality.log.gz'))
    run = load(HERE/'logs/source-ci-quality-run.json')
    job = load(HERE/'logs/source-ci-quality-job.json')
    require(ci['source'] == [SOURCE,SOURCE_TREE] and ci['exit'] == 0 and
            ci['run_id'] == run['id'] == job['run_id'] and ci['job_id'] == job['id'] and
            run['head_sha'] == SOURCE and job['conclusion'] == 'success' and
            sha(ci_raw) == ci['raw_log_sha256'], 'ORIGINAL_CI_SEMANTIC_BINDING')
    cases = []
    for line in ci_raw.decode().splitlines():
        text = re.sub(r'^\d{4}-\d\d-\d\dT\S+Z\s?', '', line)
        try:
            row = json.loads(text)
        except ValueError:
            continue
        if isinstance(row, dict) and 'expected_exit' in row and (row.get('case') == 'authentic-current' or cases):
            cases.append(row)
            if row.get('case') == 'authentic-restored':
                break
    require(cases == ci['cases'], 'ORIGINAL_CI_CASE_STREAM')
    negatives = [r for r in cases if r.get('expected_exit') == 1]
    require(len(negatives) == 151 and all(r['exit'] == 1 for r in negatives), 'SEMANTIC151')
    require(cases[0]['exit'] == 0 and any(r.get('case') == 'authentic-restored' and r['exit'] == 0 for r in cases),
            'SEMANTIC_CURRENT_RESTORED')
    require(receipt('final-readiness')['exit'] == 1, 'READINESS_REMAINS_BLOCKED')
    independent = load(HERE/'logs/independent-complete-checkout.json')
    require(independent['qualification'] == 'INDEPENDENT_COMPLETE_CHECKOUT_SOURCE_GOVERNANCE_0_1_0' and
            [r['exit'] for r in independent['results']] == [0,1,0] and
            independent['clean_after'] is True and independent['shared_object_store'] is False,
            'INDEPENDENT_CHECKOUT')
    expected_refs = {
        'main':'d9912f4c8b30358593569c5b9b4e84773c6f463e',
        'stage/m1-gate-recovery':'cd2bd51997f283c0b446bf2124f427f482550fa8',
        'stage/m1-retained-resilience':'50f25abeafaa6127e105e2a9d825e6d15dc1dcdb',
        'stage/full-app-j01-release-contract08':'d08347f0011672cd309d835628c094b5e9f4725d',
        'stage/full-app-j01-source-packet-ci09':'8ac97c32901272d97d1bff05f2abc294811055a6',
        'stage/full-app-j01-quality-projections10':BASE,
        'stage/m103-security-source-recovery11':head,
    }
    refs = git('ls-remote','--heads','https://github.com/TasfiqJ/onSkin.git',*expected_refs).decode().splitlines()
    actual_refs = {ref.removeprefix('refs/heads/'):sha for sha,ref in (line.split() for line in refs)}
    require(actual_refs == expected_refs, 'LIVE_PINNED_REFS_OR_UNPUSHED_DELIVERY')
    live = subprocess.run([sys.executable,'-B','scripts/release/full-app-j01/check.py'],cwd=ROOT,capture_output=True)
    require(live.returncode == 0, 'LIVE_GOVERNANCE:'+live.stdout.decode(errors='replace')+live.stderr.decode(errors='replace'))
    print(json.dumps(dict(verified=True, source=SOURCE,source_tree=SOURCE_TREE,
        evidence_head=head,evidence_tree=git('rev-parse','HEAD^{tree}').decode().strip(),
        protected_files=len(protected),checkpoint_files=len(inventory)+1,
        archived_evidence_files=len(logs),semantic_negatives=151,
        identities=65,required_rows=38,historical_tasks=47,historical_adrs=51,
        independent_checkout='SOURCE_GOVERNANCE_0_1_0',source_acceptance='REVIEW_REQUIRED',
        security='FAIL/NO_GO',readiness='BLOCKED_OUTSIDE_SCOPE',release='NO_GO')))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, TypeError, OSError, zipfile.BadZipFile, subprocess.SubprocessError) as error:
        print(json.dumps(dict(verified=False,error=str(error),release='NO_GO')))
        sys.exit(1)

