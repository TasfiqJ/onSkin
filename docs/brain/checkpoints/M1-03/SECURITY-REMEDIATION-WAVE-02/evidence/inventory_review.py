"""Review every committed source blob; retain refusals and all denominators."""
import collections, datetime, hashlib, json, pathlib, subprocess, sys, urllib.request
root=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=False)
sys.path.insert(0,str(root/'scripts/phase9/security_acceptance'));import contract as c
git=lambda *a:subprocess.check_output(['git','-C',str(root),*a])
prior=c.load(c.HERE,'source-manifest.json');expected={r['path']:r['sha256'] for r in prior};policy=c.load(c.HERE,'proposal.json')
special={'scripts/phase9/security_acceptance/proposal.json','scripts/phase9/security_acceptance/source-manifest.json'}
items=[]
for record in git('ls-tree','-rz','--full-tree','HEAD').split(b'\0'):
    if not record:continue
    header,path=record.split(b'\t',1);mode,kind,oid=header.decode().split();assert kind=='blob' and mode in ('100644','100755')
    items.append((path.decode(),mode,oid))
process=subprocess.Popen(['git','-C',str(root),'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
rows=[]
def partition(n):
    if n.startswith(('docs/brain/checkpoints/','docs/brain/reviews/')):return 'checkpoint-or-review-evidence'
    if n.startswith(('apps/','packages/')):return 'app-or-package-source'
    if n.startswith('supabase/'):return 'database-edge-or-sql-test'
    if n.startswith('scripts/phase9/security_acceptance/'):return 'original-security-tooling'
    if n.startswith(('scripts/','.github/')):return 'tool-test-or-ci'
    if '/generated/' in n:return 'generated-source-or-document'
    if n.startswith(('docs/','04_repo_docs/')):return 'documentation-or-governance'
    return 'root-or-other-review-required'
for name,mode,oid in sorted(items):
    process.stdin.write((oid+'\n').encode());process.stdin.flush();header=process.stdout.readline().split();assert header[1]==b'blob'
    raw=process.stdout.read(int(header[2]));assert process.stdout.read(1)==b'\n';sha=hashlib.sha256(raw).hexdigest()
    status='binding-document' if name in special else 'extra' if name not in expected else 'unchanged' if sha==expected[name] else 'changed'
    try:kind,reason=c.coverage_kind(name,raw)
    except c.Rejected as e:kind,reason='REFUSED',str(e)
    part=partition(name)
    disposition=('REVIEW_EVIDENCE_WITH_PROVENANCE_AND_CLASSIFIER' if part=='checkpoint-or-review-evidence' else
        'REVIEW_SOURCE_AND_RUNTIME_SECURITY_EFFECT' if part in ('app-or-package-source','database-edge-or-sql-test','original-security-tooling','tool-test-or-ci') else 'REVIEW_CONTENT_AND_TARGET_SUPPORT')
    rows.append(dict(path=name,git_blob=oid,mode=mode,sha256=sha,bytes=len(raw),inventory_status=status,review_partition=part,
        coverage_candidate_kind=kind,coverage_candidate_reason=reason,disposition_candidate=disposition if status in ('extra','changed') else 'RETAIN_EXACT_IDENTITY',accepted=False))
process.stdin.close();assert process.wait()==0
shards=[]
for i in range(0,len(rows),1000):
    filename=f'paths-{i//1000:02d}.json';raw=json.dumps(dict(rows=rows[i:i+1000]),sort_keys=True,separators=(',',':')).encode()+b'\n';assert len(raw)<4*1024**2
    (out/filename).write_bytes(raw);shards.append(dict(path=filename,rows=len(rows[i:i+1000]),bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest()))
try:c.source(root,policy);guard=dict(exit=0,result='PASS')
except c.Rejected as e:guard=dict(exit=1,result=str(e))
coverage=c.scan_coverage(policy)
summary=dict(source_commit=git('rev-parse','HEAD').decode().strip(),source_tree=git('rev-parse','HEAD^{tree}').decode().strip(),
    observed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),tracked=len(rows),original_manifest_rows=len(prior),
    inventory_counts=dict(collections.Counter(r['inventory_status'] for r in rows)),
    missing=sorted(set(expected)-{r['path'] for r in rows}),classifier_counts=dict(collections.Counter(r['coverage_candidate_kind'] for r in rows)),
    classifier_refusals=dict(collections.Counter(r['coverage_candidate_reason'] for r in rows if r['coverage_candidate_kind']=='REFUSED')),
    review_partitions={s:dict(collections.Counter(r['review_partition'] for r in rows if r['inventory_status']==s)) for s in ('extra','changed')},
    frozen_coverage=dict(targets=len(coverage['targets']),required=len(coverage['required']),auxiliary=len(coverage['targets']-coverage['required']),explicit_sql=len(coverage['explicitTargets'])),
    source_guard=guard,shards=shards,original_sast_run=False,current_sast_coverage_claim=False,admission='NONE')
(out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k not in ('shards','missing')},indent=2))
