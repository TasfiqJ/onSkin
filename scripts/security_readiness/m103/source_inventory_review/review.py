"""Non-admitting, exact-Git source reconciliation. Never runs a scanner or grants GO."""
import argparse
import collections
import gzip
import hashlib
import importlib.util
import io
import json
import pathlib
import re
import subprocess
import sys

BASE = '455e3596876d85f5734f4ac3163df1de09647e1f'
FROZEN_COMMIT = 'bbc28dc3d1f945191a81be56945b8bda7bb6ef73'
SECURITY = 'scripts/phase9/security_acceptance/'
M103 = 'scripts/security_readiness/m103/'
HISTORY = 'docs/brain/checkpoints/M1-03/SECURITY-REMEDIATION-WAVE-02/evidence/historical-current-review-matrix.json'
PINS = {
    SECURITY + 'contract.py': 'a237518381c986bcced04271595b232c61291a534111d1f0603d8421b96a0b1a',
    SECURITY + 'source-manifest.json': '3142f0f5c74bc42fc4e1b2b2cb03de8142075a885199b22ecd7035118185b69d',
    SECURITY + 'scan-targets.json.gz': '78c76b8b136feecb395f46a1113eff5c98214207dd8ebe7e339cc2002bfcdbd5',
    SECURITY + 'proposal.json': 'abc1ab02e54f50348e6f10b9a4cffa66164ffdd4bbf09693534b0e50d549f3e3',
    M103 + 'source_scan.py': '19361faa398682beaed980df8519b0ed998508c72931a24264ebad3c52dd3c82',
}
MAX_OBJECT = 512 * 1024**2
MAX_INFLATED = 64 * 1024**2
FLAGS = dict(admission='NONE', protected_source_go=False, main_promotion_authorized=False,
             coverage_complete=False, original_sast='NOT_RUN', owner_review='REQUIRED')


class Refused(ValueError):
    pass


def need(ok, code):
    if not ok:
        raise Refused(code)


def sha(body):
    return hashlib.sha256(body).hexdigest()


def canonical(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True) + '\n').encode()


def path_ok(name):
    need(isinstance(name, str) and bool(name) and
         not any(ord(c)<32 or c in '\\:<>"|?*' for c in name) and
         all(p not in ('', '.', '..') and not p.endswith((' ', '.')) and
             not re.fullmatch(r'(?i)(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?', p)
             for p in name.split('/')), 'UNSAFE_PATH')
    return name


def git(repo, *args):
    p = subprocess.run(['git', '-c', 'core.fsmonitor=false', '-c', 'core.longpaths=true',
                        '-C', str(repo), *args], capture_output=True, timeout=90)
    need(p.returncode == 0, 'GIT_FAILED:' + args[0])
    return p.stdout


def inflate(body, limit=MAX_INFLATED):
    """CRC/EOF checked, bounded; no extracted files and no unbounded decompress."""
    try:
        with gzip.GzipFile(fileobj=io.BytesIO(body)) as stream:
            out = stream.read(limit + 1)
            need(len(out) <= limit, 'GZIP_INFLATION_LIMIT')
            need(stream.read(1) == b'', 'GZIP_INFLATION_LIMIT')
            return out
    except (OSError, EOFError) as e:
        raise Refused('GZIP_CORRUPT_OR_TRUNCATED') from e


def tree_entries(repo, ref):
    entries = []
    for item in git(repo, 'ls-tree', '-rz', '--full-tree', ref).split(b'\0'):
        if not item:
            continue
        meta, name = item.split(b'\t', 1)
        mode, kind, oid = meta.decode('ascii').split()
        name = path_ok(name.decode('utf-8'))
        need(kind == 'blob' and mode in ('100644', '100755'), 'NONREGULAR_GIT_OBJECT:' + name)
        need(re.fullmatch('[0-9a-f]{40}', oid), 'INVALID_BLOB_ID')
        entries.append(dict(path=name, mode=mode, git_blob=oid))
    names = [r['path'] for r in entries]
    need(len(names) == len(set(n.casefold() for n in names)), 'DUPLICATE_GIT_PATH')
    return sorted(entries, key=lambda r: r['path'])


def verify_blob(body, oid):
    need(hashlib.sha1(b'blob ' + str(len(body)).encode() + b'\0' + body).hexdigest() == oid,
         'GIT_BLOB_DRIFT')


def objects(repo, entries):
    """Same object header, regular-mode and blob-hash semantics as source_scan.snapshot.

    Unlike snapshot, this read-only reviewer never materializes source contents.
    """
    with subprocess.Popen(['git', '-C', str(repo), 'cat-file', '--batch'],
                          stdin=subprocess.PIPE, stdout=subprocess.PIPE) as p:
        try:
            for row in entries:
                oid = row['git_blob']
                p.stdin.write((oid + '\n').encode()); p.stdin.flush()
                header = p.stdout.readline().decode('ascii').split()
                need(len(header) == 3 and header[:2] == [oid, 'blob'], 'GIT_OBJECT_HEADER')
                size = int(header[2]); need(0 <= size <= MAX_OBJECT, 'OBJECT_SIZE_LIMIT')
                body = p.stdout.read(size)
                need(len(body) == size and p.stdout.read(1) == b'\n', 'GIT_OBJECT_TRUNCATED')
                verify_blob(body, oid)
                yield row, body
        finally:
            p.stdin.close()
            if sys.exc_info()[0]:
                p.kill()
            need(p.wait() == 0 or sys.exc_info()[0] is not None, 'GIT_READER_FAILED')


def contract(repo, commit):
    """Import only byte-pinned original contract; it remains unchanged and authoritative."""
    for name, digest in PINS.items():
        body = git(repo, 'cat-file', 'blob', commit + ':' + name)
        need(sha(body) == digest, 'ORIGINAL_PIN_DRIFT:' + name)
    spec = importlib.util.spec_from_file_location('inventory_original_contract', repo / SECURITY / 'contract.py')
    # Validate ancestors and regular working bytes before executing the pinned module.
    f = repo
    for part in (SECURITY + 'contract.py').split('/'):
        f = f / part
        st = f.lstat()
        need(not f.is_symlink() and not getattr(st, 'st_file_attributes', 0) & 0x400,
             'LINKED_CONTRACT')
    need(f.stat().st_nlink == 1 and sha(f.read_bytes()) == PINS[SECURITY + 'contract.py'],
         'WORKING_CONTRACT_DRIFT')
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    for name, digest in PINS.items():
        need(sha(module.safe(repo, name, allow_empty=True)) == digest, 'WORKING_PIN_DRIFT:' + name)
    return module


def unique_rows(rows):
    need(isinstance(rows, list), 'ROWS_SCHEMA')
    names = [path_ok(r['path']) for r in rows]
    need(names == sorted(names) and len(names) == len(set(n.casefold() for n in names)),
         'DUPLICATE_OR_NONCANONICAL_PATHS')
    return {r['path']: r for r in rows}


def frozen(repo, c):
    raw = git(repo, 'cat-file', 'blob', BASE + ':' + SECURITY + 'source-manifest.json')
    rows = c.parse_json(raw); old = unique_rows(rows)
    for r in rows:
        need(set(r) == {'path', 'sha256'} and re.fullmatch('[0-9a-f]{64}', r['sha256']), 'OLD_ROW_SCHEMA')
    old.update({name: dict(path=name, sha256=PINS[name]) for name in
                (SECURITY + 'source-manifest.json', SECURITY + 'proposal.json')})
    # The last frozen-manifest commit supplies authentic old blob/size witnesses.
    # If a frozen hash does not match that tree, keep it explicitly unresolved.
    for row, body in objects(repo, tree_entries(repo, FROZEN_COMMIT)):
        name = row['path']
        if name in old and sha(body) == old[name]['sha256']:
            old[name].update(git_blob=row['git_blob'], bytes=len(body), witness_commit=FROZEN_COMMIT)
    for row in old.values():
        need('git_blob' in row or row['path'] in (SECURITY+'proposal.json', SECURITY+'source-manifest.json'),
             'FROZEN_GIT_WITNESS_UNRESOLVED:' + row['path'])
    # The two binding documents are deliberately outside their own frozen inventory.
    for name in (SECURITY+'proposal.json', SECURITY+'source-manifest.json'):
        body = git(repo, 'cat-file', 'blob', BASE + ':' + name)
        old[name].update(git_blob=git(repo, 'rev-parse', BASE+':'+name).decode().strip(),
                         bytes=len(body), witness_commit=BASE)
    policy = c.parse_json(git(repo, 'cat-file', 'blob', BASE + ':' + SECURITY + 'proposal.json'))
    scope = c.parse_json(inflate(git(repo, 'cat-file', 'blob', BASE + ':' + SECURITY + 'scan-targets.json.gz')))
    validate_scope(scope, old)
    # Exercise the original scope validator against the unchanged pinned files too.
    exact = c.scan_coverage(policy)
    need(set(exact['sourceIdentities']) == set(old) and len(exact['explicitTargets']) == 26,
         'ORIGINAL_SCOPE_DISAGREEMENT')
    return old, policy, scope


def validate_scope(scope, old):
    need(isinstance(scope, dict) and set(scope) == {'schema','targets','exclusions','explicitTargets'}
         and type(scope['schema']) is int and scope['schema'] == 1, 'SCOPE_SCHEMA')
    need(all(isinstance(scope[k], list) for k in ('targets','exclusions','explicitTargets')), 'SCOPE_SCHEMA')
    combined = scope['targets'] + scope['exclusions']; seen = set()
    for r in combined:
        need(isinstance(r, dict) and set(r) == {'path','kind','reason'}, 'SCOPE_ROW_SCHEMA')
        name = path_ok(r['path'])
        need(name not in seen and name in old, 'SCOPE_DUPLICATE_OR_EXTRA'); seen.add(name)
    need(seen == set(old), 'SCOPE_OMISSION')
    sql = sorted(r['path'] for r in scope['targets'] if r['kind'] == 'required' and
                 r['path'].startswith('supabase/tests/') and r['path'].endswith('.sql'))
    need(scope['explicitTargets'] == sql and len(sql) == 26, 'MISSING_SQL')


def classification(c, name, body):
    # No checkpoint exception. Exact original refusal remains visible and blocking.
    try:
        kind, reason = c.coverage_kind(name, body)
    except c.Rejected as e:
        return dict(disposition='REFUSED', reason=str(e), original_classifier='REFUSED')
    if name.endswith('.gz') and not body.startswith(b'\x1f\x8b'):
        return dict(disposition='REFUSED', reason='GZIP_MAGIC_INVALID', original_classifier=kind)
    if body.startswith(b'\x1f\x8b') and name.endswith('.gz') and name != c.ENGINE_SOURCE_ARCHIVE:
        try:
            inflate(body)
        except Refused as e:
            return dict(disposition='REFUSED', reason=str(e), original_classifier=kind)
    return dict(disposition=kind, reason=reason, original_classifier=kind)


def path_class(name):
    if name.startswith(('docs/brain/checkpoints/','docs/brain/reviews/')):
        return 'checkpoint_or_review'
    if name.startswith('docs/'):
        return 'other_docs'
    if name.startswith(('scripts/','.github/')):
        return 'tools_or_ci'
    if name.startswith(('apps/','packages/')) or name in ('package.json','package-lock.json'):
        return 'app_or_package'
    return 'other'


def workspace(repo, commit, c, entries):
    need(git(repo, 'rev-parse', 'HEAD').decode().strip() == commit, 'WORKSPACE_HEAD_DRIFT')
    tracked = sorted(filter(None, git(repo, 'ls-files', '-z').decode().split('\0')))
    need(tracked == [r['path'] for r in entries], 'INDEX_INVENTORY_DRIFT')
    result = {}
    for label, args in [('untracked', ('--others','--exclude-standard')),
                        ('ignored', ('--others','--ignored','--exclude-standard'))]:
        names = sorted(filter(None, git(repo, 'ls-files', *args, '-z').decode().split('\0')))
        result[label] = [dict(path=path_ok(n), sha256=sha(c.safe(repo, n, allow_empty=True)),
                              bytes=(repo/n).stat().st_size) for n in names]
    need(not result['untracked'], 'UNTRACKED_EVIDENCE_TAIL')
    need(not git(repo, 'status', '--porcelain=v1', '--untracked-files=all'), 'DIRTY_SOURCE')
    return result


def history(repo, rows, c):
    body = git(repo, 'cat-file', 'blob', BASE + ':' + HISTORY)
    prior = c.parse_json(body); bypath = {r['path']: r for r in rows}
    need(len(prior['failed_targets']) == 189 and len(prior['fixpoint_events']) == 368,
         'HISTORICAL_OBLIGATION_OMISSION')
    result = dict(witness_path=HISTORY, witness_sha256=sha(body),
                  failed_targets=[], fixpoint_events=[], runs=prior['runs'], **FLAGS)
    for key in ('failed_targets','fixpoint_events'):
        for item in prior[key]:
            name = item['path']; need(name in bypath and bypath[name]['current'] is not None, 'HISTORICAL_PATH_MISSING')
            current = bypath[name]['current']
            result[key].append(dict(historical=item, path=name, current=current,
                                    review_status='OPEN', fresh_result=None))
    need(len({r['path'] for r in result['failed_targets']}) == 189, 'HISTORICAL_DUPLICATE')
    return result


def build(repo, commit):
    need(re.fullmatch('[0-9a-f]{40}', commit) is not None, 'FULL_COMMIT_REQUIRED')
    need(git(repo, 'rev-parse', commit+'^{commit}').decode().strip() == commit, 'EXACT_COMMIT_REQUIRED')
    c = contract(repo, commit); old, policy, scope = frozen(repo, c)
    entries = tree_entries(repo, commit); state = workspace(repo, commit, c, entries)
    oldtargets = {r['path']: r for r in scope['targets']+scope['exclusions']}
    rows = []
    for entry, body in objects(repo, entries):
        name = entry['path']; current = dict(entry, bytes=len(body), sha256=sha(body))
        # Git objects are the source; working bytes are independently compared.
        need(c.safe(repo, name, limit=MAX_OBJECT, allow_empty=True) == body, 'WORKING_BYTES_DRIFT:'+name)
        previous = old.get(name)
        relation = 'added' if previous is None else 'unchanged' if previous['sha256'] == sha(body) else 'changed'
        rows.append(dict(path=name, path_class=path_class(name), relation=relation, current=current, frozen=previous,
                         old_target=oldtargets.get(name), accepted=False, **classification(c, name, body)))
    current_names = {r['path'] for r in rows}
    rows.extend(dict(path=n, path_class=path_class(n), relation='missing', current=None, frozen=old[n], old_target=oldtargets[n],
                     disposition='REFUSED', reason='FROZEN_SOURCE_MISSING', original_classifier=None,
                     accepted=False) for n in sorted(set(old)-current_names))
    rows.sort(key=lambda r:r['path']); unique_rows(rows)
    sql = [next(r for r in rows if r['path'] == n) for n in scope['explicitTargets']]
    need(all(r['current'] and r['disposition']=='required' for r in sql) and len(sql)==26, 'MISSING_SQL')
    result = dict(schema=1, source_commit=commit,
                  source_tree=git(repo,'rev-parse',commit+'^{tree}').decode().strip(),
                  baseline_commit=BASE, frozen_witness_commit=FROZEN_COMMIT, original_pins=PINS,
                  rule_pins=policy['rules'], workspace=state, tracked_regular_paths=len(entries),
                  relations={k:sum(r['relation']==k for r in rows) for k in ('added','changed','missing','unchanged')},
                  dispositions=dict(collections.Counter(r['disposition'] for r in rows)),
                  added_classes=dict(collections.Counter(r['path_class'] for r in rows if r['relation']=='added')),
                  paths=rows, explicit_sql=sql, **FLAGS)
    result['historical_obligations'] = history(repo, rows, c)
    validate(result, entries)
    return result


def validate(value, entries):
    need(all(value.get(k) == v and type(value.get(k)) is type(v) for k,v in FLAGS.items()), 'FORGED_SECURITY_GO')
    need(value.get('original_pins') == PINS, 'ORIGINAL_PIN_DRIFT')
    rows = unique_rows(value['paths']); expected = {r['path']:r for r in entries}
    current = {n:r['current'] for n,r in rows.items() if r['current'] is not None}
    need(set(current) == set(expected), 'SOURCE_OMISSION_OR_EXTRA')
    for name, r in current.items():
        need(all(r[k] == expected[name][k] for k in ('path','mode','git_blob')), 'CHANGED_GIT_BLOB')
        need(re.fullmatch('[0-9a-f]{64}',r['sha256']) and type(r['bytes']) is int and r['bytes']>=0, 'IDENTITY_SCHEMA')
        need(rows[name]['accepted'] is False and rows[name]['disposition'] in ('required','auxiliary','excluded','REFUSED'), 'ROW_ADMISSION')
    sql = sorted(n for n,r in rows.items() if n.startswith('supabase/tests/') and n.endswith('.sql') and r['disposition']=='required')
    need([r['path'] for r in value['explicit_sql']] == sql and len(sql)==26, 'MISSING_SQL')
    need(value['tracked_regular_paths']==len(current) and
         value['relations']=={k:sum(r['relation']==k for r in rows.values()) for k in ('added','changed','missing','unchanged')} and
         value['dispositions']==dict(collections.Counter(r['disposition'] for r in rows.values())), 'DENOMINATOR_DRIFT')


def verify_rules(directory, pins):
    for name,digest in pins.items():
        f=directory/(path_ok(name)+'.yaml')
        need(f.is_file() and not f.is_symlink() and sha(f.read_bytes())==digest, 'RULE_HASH_MISMATCH:'+name)
    return dict(all_four_rule_claim=False, admission='NONE')


def live_candidate(manifest, manifest_path, proposed_bytes, proposal, proposal_path, proposal_bytes):
    """An exact live binding cannot merely append a manifest's own output to itself."""
    need(manifest_path not in {r['path'] for r in manifest}, 'SELF_REFERENTIAL_MANIFEST')
    need(proposal_path not in {r['path'] for r in manifest}, 'LIVE_PROPOSAL_CUSTODY_CYCLE')
    need(proposal['sourceManifest']==sha(proposed_bytes), 'PROPOSAL_MANIFEST_DRIFT')
    need(proposal_bytes==canonical(proposal), 'PROPOSAL_BYTES_DRIFT')
    return False  # Candidate analysis never admits source, even without a cycle.


def write_bundle(out, value):
    need(not out.exists() and not out.is_symlink(), 'NEW_OUTPUT_REQUIRED')
    for ancestor in out.parents:
        if ancestor.exists():
            need(not ancestor.is_symlink() and not getattr(ancestor.lstat(),'st_file_attributes',0)&0x400, 'LINKED_OUTPUT')
    out.mkdir(parents=True)
    files=[]
    def put(name, obj):
        body=canonical(obj); (out/name).write_bytes(body)
        files.append(dict(path=name,bytes=len(body),sha256=sha(body)))
    for i in range(0,len(value['paths']),512):
        put('inventory-%04d.json'%(i//512),value['paths'][i:i+512])
    put('sql-targets.json',value['explicit_sql'])
    put('historical-obligations.json',value['historical_obligations'])
    put('refusals.json',[r for r in value['paths'] if r['disposition']=='REFUSED'])
    summary={k:v for k,v in value.items() if k not in ('paths','explicit_sql','historical_obligations')}
    summary.update(files=files, inventory_rows=len(value['paths']),
                   inventory_sha256=sha(canonical(value['paths'])),
                   historical_failed_targets=189,historical_fixpoint_events=368,explicit_sql_count=26)
    (out/'summary.json').write_bytes(canonical(summary))
    return summary


def verify_bundle(repo, directory):
    """Rebuild from immutable objects; catches re-signed omissions and altered classifications."""
    c=contract(repo,BASE)
    summary=c.parse_json(c.safe(directory,'summary.json'))
    expected=build(repo,summary['source_commit'])
    seen=set(); actual=[]
    for row in summary['files']:
        name=path_ok(row['path']); need(name not in seen,'DUPLICATE_SHARD');seen.add(name)
        body=c.safe(directory,name,allow_empty=True)
        need(len(body)==row['bytes'] and sha(body)==row['sha256'],'SHARD_DRIFT')
        if name.startswith('inventory-'): actual.extend(c.parse_json(body))
    need({p.name for p in directory.iterdir()}==seen|{'summary.json'},'EVIDENCE_TAIL_DRIFT')
    need(actual==expected['paths'],'INVENTORY_RECOMPUTATION_DRIFT')
    # Compare every metadata/sidecar byte, not only the inventory shards.
    import tempfile
    with tempfile.TemporaryDirectory(prefix='m103-inventory-verify-') as temp:
        target=pathlib.Path(temp)/'expected';write_bundle(target,expected)
        need(all((target/p.name).read_bytes()==p.read_bytes() for p in directory.iterdir()), 'BUNDLE_RECOMPUTATION_DRIFT')
    return summary


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('mode',choices=['generate','verify']);p.add_argument('--repo',type=pathlib.Path,required=True)
    p.add_argument('--commit');p.add_argument('--out',type=pathlib.Path,required=True);a=p.parse_args()
    try:
        repo=a.repo.resolve(); out=a.out.absolute()
        need(not out.is_relative_to(repo), 'OUTPUT_INSIDE_MEASURED_SOURCE')
        summary=write_bundle(out,build(repo,a.commit)) if a.mode=='generate' else verify_bundle(repo,out)
        print(json.dumps({k:summary[k] for k in ('source_commit','source_tree','tracked_regular_paths','relations','dispositions','admission','coverage_complete')}))
        return 0
    except (ValueError,OSError,KeyError,TypeError,subprocess.SubprocessError) as e:
        print(json.dumps(dict(status='REFUSED',code=str(e) if isinstance(e,Refused) else type(e).__name__,**FLAGS)))
        return 1


if __name__=='__main__':
    sys.dont_write_bytecode=True
    sys.exit(main())
