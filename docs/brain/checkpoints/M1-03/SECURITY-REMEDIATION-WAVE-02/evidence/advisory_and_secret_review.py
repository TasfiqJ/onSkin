"""Hash-bound original-provider triage and current primary advisory metadata."""
import collections,datetime,hashlib,json,pathlib,re,sys,urllib.request
root=pathlib.Path(sys.argv[1]);out=root/'docs/brain/checkpoints/M1-03/SECURITY-REMEDIATION-WAVE-02/evidence/triage';out.mkdir(exist_ok=False)
base=out.parent;sha=lambda b:hashlib.sha256(b).hexdigest()
summary=json.loads((base/'provider/safe-secret-summary.json').read_bytes());locations=json.loads((base/'provider/safe-secret-locations.json').read_bytes())
matrix=json.loads((base/'inventory-base/summary.json').read_bytes());paths={}
for shard in matrix['shards']:
    raw=(base/'inventory-base'/shard['path']).read_bytes();assert sha(raw)==shard['sha256']
    for row in json.loads(raw)['rows']:paths[sha(row['path'].encode())]=row
current=[]
for row in locations['rows']:
    if row['scope']!='current':continue
    bind=paths.get(row['path_sha256']);assert bind and bind['git_blob']==row['blob'] and bind['sha256']==row['file_sha256']
    path=bind['path'];source_class=('legacy-imported-documentation' if path.startswith('04_repo_docs/') else 'checkpoint-or-review-evidence' if path.startswith('docs/brain/') else 'app-or-package-source' if path.startswith(('apps/','packages/')) else 'database-or-edge-source' if path.startswith('supabase/') else 'tool-or-fixture' if path.startswith('scripts/') else 'other-source')
    current.append(dict(path_sha256=row['path_sha256'],git_blob=bind['git_blob'],sha256=bind['sha256'],range_sha256=row['range_sha256'],rule_id=row['rule_id'],source_class=source_class,owner_disposition='REQUIRED_UNREVIEWED_NO_LIVENESS_TEST'))
assert len(current)==1126 and sum(r['scope']=='history' for r in locations['rows'])==4361
(out/'secret-current-bindings.json').write_text(json.dumps(dict(source_head=matrix['source_commit'],source_tree=matrix['source_tree'],provider_run=summary['run_id'],artifact_sha256=summary['archive_sha256'],rows=current,counts_by_class=dict(collections.Counter(r['source_class'] for r in current)),all_current_blobs_match=True,history_count=4361,history_refreshed_by_original_provider=True,credential_checks=0,admission='NONE'),indent=2)+'\n')
advisories=[]
for advisory in ('GHSA-86w9-cpqp-85rv','GHSA-mrhx-c7xc-m3w5','GHSA-84m7-p3x7-pcfv','GHSA-xcq7-p3pf-p88h'):
    url='https://api.osv.dev/v1/vulns/'+advisory
    try:
        raw=urllib.request.urlopen(url,timeout=45).read();data=json.loads(raw)
        advisories.append(dict(id=data['id'],url=url,response_sha256=sha(raw),modified=data.get('modified'),published=data.get('published'),withdrawn=data.get('withdrawn'),aliases=data.get('aliases',[]),affected=data.get('affected',[]),references=data.get('references',[])))
    except Exception as e:advisories.append(dict(id=advisory,url=url,error=type(e).__name__+': '+str(e)))
registry=[]
for name in ('node-forge','@expo/code-signing-certificates','expo','zod'):
    url='https://registry.npmjs.org/'+name.replace('/','%2f')
    raw=urllib.request.urlopen(url,timeout=45).read();data=json.loads(raw);latest=data.get('dist-tags',{}).get('latest');version=data['versions'][latest]
    registry.append(dict(name=name,url=url,response_sha256=sha(raw),dist_tags=data.get('dist-tags',{}),latest=latest,latest_dependencies=version.get('dependencies',{}),latest_peer_dependencies=version.get('peerDependencies',{}),latest_dist={k:v for k,v in version.get('dist',{}).items() if k in ('integrity','shasum','tarball')},published_versions=len(data['versions'])))
osv=json.loads((base/'provider/safe-osv-summary.json').read_bytes())
rows=[]
for r in osv['rows']:
    p=r['source'];bind=paths.get(sha(p.encode()))
    rows.append(dict(path=p,path_sha256=sha(p.encode()),git_blob=bind['git_blob'] if bind else None,file_sha256=bind['sha256'] if bind else None,package=r['package'],advisories=[a['id'] for a in r['advisories']],
        execution_role='scanner-cli-only' if p.startswith('scripts/phase9/security_acceptance/') else 'immutable-historical-evidence' if p.startswith('docs/brain/') else 'application-and-development-lock-requires-parent-analysis',disposition='REPAIR_CANDIDATE_OR_OWNER_REVIEW_REQUIRED'))
(out/'advisory-primary-matrix.json').write_text(json.dumps(dict(observed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),source_head=matrix['source_commit'],source_tree=matrix['source_tree'],original_osv_run=40020077385,original_osv_exit=osv['scanner_exit'],primary_advisories=advisories,registry=registry,source_bindings=rows,stage_dependencies_changed=False),indent=2)+'\n')
print(json.dumps(dict(secret_current=len(current),secret_history=4361,all_current_blobs_match=True,classes=dict(collections.Counter(r['source_class'] for r in current)),registry=[dict(name=r['name'],latest=r['latest']) for r in registry],advisory_ids=[r['id'] for r in advisories]),indent=2))
