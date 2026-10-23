"""Measure the frozen inventory and propose review partitions, without changing it."""
import collections, datetime, gzip, hashlib, json, pathlib, subprocess, sys, urllib.request
root=pathlib.Path(sys.argv[1]); out=pathlib.Path(sys.argv[2]); out.mkdir(parents=True,exist_ok=False)
sys.path.insert(0,str(root/'scripts/phase9/security_acceptance')); import contract as c
policy=c.load(c.HERE,'proposal.json'); prior=c.load(c.HERE,'source-manifest.json')
expected={r['path']:r['sha256'] for r in prior}; special={'scripts/phase9/security_acceptance/proposal.json','scripts/phase9/security_acceptance/source-manifest.json'}
names=set(c.git(root,'ls-files','-z').decode().split('\0'))-{''}
def category(n):
    if n.startswith(('docs/brain/checkpoints/','docs/brain/reviews/')): return 'checkpoint-or-review-evidence'
    if n.startswith(('apps/','packages/')): return 'current-app-or-shared-package'
    if n.startswith('supabase/'): return 'protected-database-edge-or-test'
    if n.startswith('scripts/phase9/security_acceptance/'): return 'protected-original-security'
    if '/generated/' in n: return 'generated-document-or-evidence'
    if n.startswith(('scripts/','.github/')): return 'tool-test-or-ci'
    if n.startswith(('docs/','04_repo_docs/')): return 'documentation-or-governance'
    return 'root-or-other-review-required'
rows=[]
for n in sorted(names):
    b=(root/n).read_bytes(); sha=c.SHA(b)
    status='binding-document' if n in special else 'extra' if n not in expected else 'unchanged' if sha==expected[n] else 'changed'
    try: coverage_kind,coverage_reason=c.coverage_kind(n,b)
    except c.Rejected as e: coverage_kind,coverage_reason='REFUSED',str(e)
    rows.append({'path':n,'sha256':sha,'bytes':len(b),'inventory_status':status,'review_partition':category(n),
                 'coverage_candidate_kind':coverage_kind,'coverage_candidate_reason':coverage_reason,
                 'disposition':'REVIEW_REQUIRED' if status in ('extra','changed') else 'RETAIN_EXACT_IDENTITY'})
missing=sorted(set(expected)-names)
try: c.source(root,policy); refusal={'exit':0,'result':'PASS'}
except c.Rejected as e: refusal={'exit':1,'result':str(e)}
counts=dict(collections.Counter(r['inventory_status'] for r in rows)); partitions={}
for status in ('extra','changed'):
    partitions[status]=dict(collections.Counter(r['review_partition'] for r in rows if r['inventory_status']==status))
coverage=c.load(c.HERE,'scan-targets.json.gz')
shards=[]
for index in range(0,len(rows),2000):
    name=f'review-rows-{index//2000:02d}.json'
    body=('{"rows":[\n'+',\n'.join(json.dumps(r,separators=(',',':')) for r in rows[index:index+2000])+'\n]}\n').encode()
    assert len(body)<4*1024**2
    (out/name).write_bytes(body);shards.append({'path':name,'rows':len(rows[index:index+2000]),'sha256':c.SHA(body),'bytes':len(body)})
(out/'review-matrix.json').write_text(json.dumps({'source_commit':c.git(root,'rev-parse','HEAD').decode().strip(),'row_count':len(rows),'rows_sha256':c.SHA(c.CANON(rows)),'shards':shards,'missing':missing,'note':'All diagnostic rows retained in bounded shards; original source-manifest and 4MiB scanner limit unchanged.'},indent=2)+'\n')
(out/'coverage-shape.json').write_text(json.dumps({'type':type(coverage).__name__,'keys':list(coverage) if isinstance(coverage,dict) else None,
    'entries':{k:len(v) if isinstance(v,(dict,list)) else v for k,v in coverage.items()} if isinstance(coverage,dict) else len(coverage)},indent=2)+'\n')
rules=[]
for name,pin in policy['rules'].items():
    candidates=[]
    # Read only named rule candidates, never a raw secret report or patient dataset.
    for path in root.rglob(name+'.yaml'):
        if '.git' in path.parts or 'node_modules' in path.parts: continue
        digest=c.SHA(path.read_bytes()); candidates.append({'path':path.relative_to(root).as_posix(),'sha256':digest,'matches_pin':digest==pin})
    url='https://semgrep.dev/c/p/'+name
    try:
        body=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Semgrep/'+policy['semgrepVersion']}),timeout=45).read()
        current={'url':url,'bytes':len(body),'sha256':c.SHA(body),'matches_pin':c.SHA(body)==pin}
        current['raw_rules_not_exported']=True
    except Exception as e: current={'url':url,'error':str(e)}
    rules.append({'name':name,'expected_sha256':pin,'local_candidates':candidates,'registry_probe':current})
summary={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source_commit':c.git(root,'rev-parse','HEAD').decode().strip(),
         'source_tree':c.git(root,'rev-parse','HEAD^{tree}').decode().strip(),'source_guard':refusal,'tracked':len(names),'original_manifest_rows':len(prior),
         'counts':counts,'missing':len(missing),'review_partitions':partitions,'rules':rules,'original_sast_run':False,'admission':'NONE'}
summary['current_classifier_counts']=dict(collections.Counter(r['coverage_candidate_kind'] for r in rows))
summary['current_classifier_refusals']=dict(collections.Counter(r['coverage_candidate_reason'] for r in rows if r['coverage_candidate_kind']=='REFUSED'))
try:
    frozen=c.scan_coverage(policy)
    summary['frozen_partition']={'status':'VALID_BINDING_ONLY','targets':len(frozen['targets']),'required':len(frozen['required']),'auxiliary':len(frozen['targets']-frozen['required']),'exclusions':len(coverage['exclusions']),'explicit_sql':len(frozen['explicitTargets'])}
except c.Rejected as e: summary['frozen_partition']={'status':'REJECTED','error':str(e)}
(out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n'); print(json.dumps(summary,indent=2))
