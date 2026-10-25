"""Read-only whole-source and frozen snapshot verification; exit0 is never G97 acceptance."""
import argparse
import io
from pathlib import Path
import stat
import zipfile
import source_bindings as b
import build_candidate as build


def payload(raw):
    body=b.strict_gzip(raw)
    lines=body.splitlines()
    b.need(lines and len(lines)<=100001,'SNAPSHOT_BOUND')
    h=b.parse(lines[0]);rows=[b.parse(line) for line in lines[1:]]
    b.need(b'\n'.join(b.canonical(x) for x in [h,*rows])+b'\n'==body,'SNAPSHOT_CANONICAL')
    b.need(h['status']=='OWNER_REVIEW_REQUIRED' and h['acceptanceGranted'] is False,'NO_ACCEPTANCE')
    names=[r['path'] for r in rows];b.paths(names)
    b.need(names==sorted(set(names)) and len(rows)==h['union_files'],'SNAPSHOT_INVENTORY')
    return h,rows


def verify_snapshot(root, raw, expected_sha, source, tree):
    b.need(b.sha(raw)==expected_sha,'EXTERNAL_SNAPSHOT_DIGEST')
    h,rows=payload(raw)
    b.need((h['source'],h['tree'])==(source,tree),'FROZEN_SOURCE_BINDING')
    expected=build.candidate(root,source,tree)
    b.need((h,rows)==expected,'FULL_SNAPSHOT_DIFFERENCE')
    return h


def compare_snapshot(raw, expected_sha, source, tree, expected):
    b.need(b.sha(raw)==expected_sha,'EXTERNAL_SNAPSHOT_DIGEST')
    h,rows=payload(raw)
    b.need((h['source'],h['tree'])==(source,tree),'FROZEN_SOURCE_BINDING')
    b.need((h,rows)==expected,'FULL_SNAPSHOT_DIFFERENCE')
    return h


def archive(raw):
    b.need(len(raw)<=b.inv.LIMIT,'ARCHIVE_BOUND')
    result={};seen=set();total=0
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        for e in z.infolist():
            key=b.path_key(e.filename)
            b.need(key not in seen,'ARCHIVE_COLLISION');seen.add(key)
            b.need(stat.S_IFMT(e.external_attr>>16) in (0,stat.S_IFREG) and
                   not e.external_attr&1024 and not e.flag_bits&1,'ARCHIVE_MODE')
            total+=e.file_size
            b.need(total<=2*b.inv.LIMIT and e.file_size<=b.inv.LIMIT,'ARCHIVE_EXPANDED_BOUND')
            result[e.filename]=z.read(e)
    return result


def tail(root, source, endpoint):
    commits=b.git(root,'rev-list','--reverse',source+'..'+endpoint).decode().splitlines()
    b.need(len(commits)==1,'ONE_EVIDENCE_TAIL')
    b.need(b.git(root,'rev-list','--parents','-n','1',endpoint).decode().split()==[endpoint,source],
           'EVIDENCE_PARENT')
    old=b.entries(root,source);new=b.inv.snapshot(root,endpoint)
    changed={}
    for name in sorted(set(old)|set(new)):
        after=new.get(name);before=old.get(name)
        if after and before==dict(mode=after['mode'],blob=after['blob']):continue
        b.need(after and after['mode']=='100644' and
               (name=='ONSKIN_BRAIN_HANDOFF.txt' or name.startswith(b.CHECKPOINT)),'EVIDENCE_TAIL_SCOPE')
        b.need(name=='ONSKIN_BRAIN_HANDOFF.txt' or before is None,'EVIDENCE_OVERWRITE')
        changed[name]=dict(before=before,after=after,status='NEW_UNACCEPTED_EVIDENCE')
    b.need(3<=sum(n.startswith(b.CHECKPOINT) for n in changed)<=5,'COMPACT_TAIL')
    return changed


def checkpoint(root, directory, expected):
    directory=Path(directory);raw=b.regular(directory/'manifest.json')
    b.need(b.sha(raw)==expected,'EXTERNAL_MANIFEST_DIGEST');m=b.parse(raw)
    b.need(m['status']=='OWNER_REVIEW_REQUIRED' and m['acceptanceGranted'] is False,'NO_ACCEPTANCE')
    b.need(set(p.name for p in directory.iterdir())==set(m['files'])|{'manifest.json'},'CHECKPOINT_INVENTORY')
    for n,r in m['files'].items():
        b.path_key(n);data=b.regular(directory/n)
        b.need(dict(bytes=len(data),sha256=b.sha(data),
               blob=__import__('hashlib').sha1(('blob '+str(len(data))+'\0').encode()+data).hexdigest(),
               mode='100644')==r,'CHECKPOINT_FILE')
    contents=archive(b.regular(directory/'evidence.zip'))
    b.need(set(contents)==set(m['members']),'EVIDENCE_MEMBERS')
    for n,data in contents.items():
        b.need(dict(bytes=len(data),sha256=b.sha(data))==m['members'][n],'EVIDENCE_MEMBER')
    h=verify_snapshot(root,contents['candidate.jsonl.gz'],m['candidate_sha256'],m['source'],m['tree'])
    endpoint=b.git(root,'rev-parse','HEAD').decode().strip()
    b.workspace(root,endpoint)
    delta=tail(root,m['source'],endpoint)
    # Attest the entire tail without a future self-hash: exact finite members plus
    # self-external manifest digest determine the commit tree independently.
    recorded=b.parse(contents['tail-plan.json'])
    b.need(set(delta)==set(recorded) and all(
        recorded[n]['before']==delta[n]['before'] and
        recorded[n]['status']=='NEW_UNACCEPTED_EVIDENCE' and
        delta[n]['after']['mode']=='100644' for n in recorded),'TAIL_DELTA')
    return dict(status=h['status'],source=m['source'],tree=m['tree'],evidence=endpoint,
                evidence_tree=b.git(root,'rev-parse',endpoint+'^{tree}').decode().strip(),
                candidate_sha256=m['candidate_sha256'],tail_files=len(delta))


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--repo',type=Path,default=b.ROOT);p.add_argument('--source-only',action='store_true')
    p.add_argument('--checkpoint',type=Path);p.add_argument('--expected-manifest-sha256')
    p.add_argument('--snapshot',type=Path);p.add_argument('--expected-snapshot-sha256')
    p.add_argument('--source');p.add_argument('--tree');a=p.parse_args()
    try:
        b.policy(a.repo)
        if a.source_only:
            head=b.git(a.repo,'rev-parse','HEAD').decode().strip()
            b.source_history(a.repo,head)
            b.witnesses(a.repo,head);names=b.workspace(a.repo,head)
            original,_coverage,_witness=b.witnesses(a.repo,head);b.absences(a.repo,names,original)
            result=dict(status='UNAPPLIED_CANDIDATE',acceptanceGranted=False,files=len(names))
        elif a.checkpoint:result=checkpoint(a.repo,a.checkpoint,a.expected_manifest_sha256)
        else:
            result=verify_snapshot(a.repo,b.regular(a.snapshot),a.expected_snapshot_sha256,a.source,a.tree)
            result={k:result[k] for k in ('status','source','tree','current_files','counts','blockers')}
        print(b.canonical(result).decode());return 0
    except Exception:
        print('{"status":"INCOMPLETE","acceptanceGranted":false}');return 1

if __name__=='__main__':raise SystemExit(main())
