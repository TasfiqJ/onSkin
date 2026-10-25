"""Freeze-first complete source identity candidate; never installs original acceptance."""
import argparse
from collections import Counter
import gzip
from pathlib import Path
import re
import subprocess
import tempfile
import source_bindings as b


def shapes(root, current):
    """Only retain magic bytes and length, with a bounded authenticated batch stream."""
    identities={r['blob']:r for r in current.values()};out={}
    with tempfile.TemporaryFile() as requests, tempfile.TemporaryFile() as errors:
        requests.write(('\n'.join(sorted(identities))+'\n').encode());requests.seek(0)
        with subprocess.Popen(['git','--no-replace-objects','cat-file','--batch'],cwd=root,
                              stdin=requests,stdout=subprocess.PIPE,stderr=errors) as proc:
            try:
                for oid in sorted(identities):
                    header=proc.stdout.readline(200).decode('ascii').split()
                    b.need(len(header)==3 and header[:2]==[oid,'blob'],'BLOB_HEADER')
                    size=int(header[2]);b.need(size==identities[oid]['bytes'],'BLOB_SIZE')
                    remaining=size;prefix=b'';digest=__import__('hashlib').sha256()
                    while remaining:
                        chunk=proc.stdout.read(min(remaining,1024**2));b.need(chunk,'TRUNCATED_BLOB')
                        if not prefix:prefix=chunk[:8]
                        digest.update(chunk);remaining-=len(chunk)
                    b.need(proc.stdout.read(1)==b'\n' and digest.hexdigest()==identities[oid]['sha256'],'BLOB_BYTES')
                    out[oid]=(prefix,size)
                b.need(proc.stdout.read(1)==b'' and proc.wait(timeout=90)==0,'BLOB_STREAM')
            finally:
                if proc.poll() is None:proc.kill();proc.wait()
    return out


class Shape:
    # The authenticated classifier uses only startswith and len. Preserve both.
    def __init__(self, prefix, size):self.prefix,self.size=prefix,size
    def startswith(self, prefix):return self.prefix.startswith(prefix)
    def __len__(self):return self.size


def candidate(root, commit, tree):
    b.need(re.fullmatch('[0-9a-f]{40}',commit) and re.fullmatch('[0-9a-f]{40}',tree),'SOURCE_ID')
    b.need(b.git(root,'rev-parse',commit+'^{tree}').decode().strip()==tree,'SOURCE_TREE')
    b.policy(root)
    b.source_history(root,commit)
    b.need(b.git(root,'show',commit+':'+b.POLICY)==b.canonical(b.POLICY_VALUE)+b'\n','FROZEN_POLICY_IDENTITY')
    original, coverage, protected = b.witnesses(root,commit)
    current = b.inv.snapshot(root,commit)
    b.need(len(current)<=100000,'PATH_BOUND');b.paths(current)
    old = b.inv.snapshot(root,b.inv.ORIGINAL)
    b.need(all(n in old and old[n]['sha256']==h for n,h in original.items()),'ORIGINAL_SOURCE_BYTES')
    classifier = b.classifier(root)
    blob_shapes = shapes(root,current)
    rows=[];counts=Counter();scope=Counter();blocked=Counter()
    for name in sorted(set(original)|set(current)):
        before=old.get(name) if name in original else None; after=current.get(name)
        status='added' if before is None else 'removed' if after is None else 'unchanged' if before==after else 'changed'
        counts[status]+=1
        if after:
            body=Shape(*blob_shapes[after['blob']])
            try:
                kind,reason=classifier(name,body)
                # An original allowed binary exclusion has authority for its exact identity only.
                classification={'kind':kind,'reason':reason,'authority':
                    'ORIGINAL_EXACT_IDENTITY' if before==after else 'OWNER_REVIEW_REQUIRED'}
                if kind=='excluded' and before!=after:
                    classification['kind']='NEW_UNREVIEWED_BINARY_INCLUDE';blocked['NEW_BINARY_OWNER_REPLAY']+=1
                if name.endswith(('.zip','.tar','.gz','.tgz')):
                    classification['archiveReview']='OWNER_REPLAY_REQUIRED_NO_OPAQUE_SCAN_CLEARANCE'
                    if before!=after:blocked['ARCHIVE_OWNER_REPLAY']+=1
            except ValueError as error:
                code=str(error).split(':',1)[0]
                b.need(code in ('UNREVIEWED_COMPRESSED_SOURCE','REQUIRED_SOURCE_EXCEEDS_SCANNER_LIMIT'),
                       'UNKNOWN_ORIGINAL_POLICY_REFUSAL')
                classification=dict(kind='BLOCKED_OUTSIDE_SCOPE',reason=code,
                                    owner='original Security source and scanner custodian')
                blocked[code]+=1
        else:classification=dict(kind='REMOVED_REQUIRES_OWNER_REVIEW')
        scope[classification['kind']]+=1
        rows.append(dict(path=name,before=before,after=after,status=status,
                         original_coverage=coverage.get(name),candidate_coverage=classification,
                         disposition='UNREVIEWED' if status!='unchanged' else 'HISTORICAL_IDENTITY_ONLY'))
    removed={r['path']:r['before'] for r in rows if r['status']=='removed'}
    by_blob={}
    for r in rows:
        if r['status']=='added':by_blob.setdefault(r['after']['blob'],[]).append(r['path'])
    renames=[dict(from_path=n,to_path=p,blob=r['blob'],disposition='BOTH_IDENTITIES_RETAINED_UNREVIEWED')
             for n,r in removed.items() for p in by_blob.get(r['blob'],[])]
    header=dict(schema=1,status='OWNER_REVIEW_REQUIRED',acceptanceGranted=False,
                source=commit,tree=tree,policy_sha256=b.sha(b.canonical(b.POLICY_VALUE)+b'\n'),
                original_source=b.inv.ORIGINAL,original_files=len(original),current_files=len(current),
                union_files=len(rows),counts=dict(counts),coverage_counts=dict(scope),
                blockers=dict(blocked),protected_witnesses=protected,
                protected_absences=b.absences(root,current,original),
                identical_blob_rename_candidates=renames,
                original_contract='FAIL/SOURCE_INVENTORY_DRIFT',
                scanner_target_decision='UNAPPLIED_NO_TARGET_REMOVED_OR_NEW_EXCLUSION_ADOPTED')
    return header, rows


def write_snapshot(path,header,rows):
    with Path(path).open('xb') as output:
        with gzip.GzipFile(filename='',mode='wb',fileobj=output,mtime=0) as stream:
            stream.write(b.canonical(header)+b'\n')
            for row in rows:stream.write(b.canonical(row)+b'\n')


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--repo',type=Path,default=b.ROOT)
    for n in ('source','tree','output'):p.add_argument('--'+n,required=True)
    a=p.parse_args()
    try:
        b.workspace(a.repo,a.source)
        h,rows=candidate(a.repo,a.source,a.tree);write_snapshot(a.output,h,rows)
        print(b.canonical(dict(status=h['status'],source=a.source,tree=a.tree,
              original=h['original_files'],current=h['current_files'],counts=h['counts'],
              blockers=h['blockers'],payload_sha256=b.sha(b.regular(Path(a.output))))).decode())
        return 0
    except Exception:
        print('{"status":"INCOMPLETE","acceptanceGranted":false}');return 2

if __name__=='__main__':raise SystemExit(main())
