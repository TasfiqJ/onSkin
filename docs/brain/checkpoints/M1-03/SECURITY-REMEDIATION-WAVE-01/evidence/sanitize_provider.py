"""Read provider artifacts privately; export no finding text or secret values."""
import collections, hashlib, json, pathlib, sys, zipfile
private=pathlib.Path(sys.argv[1]); root=pathlib.Path(sys.argv[2]); out=pathlib.Path(sys.argv[3]); out.mkdir(parents=True,exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
canon=lambda x:json.dumps(x,sort_keys=True,separators=(',',':')).encode()
def kind(n):
    if n.startswith(('docs/brain/checkpoints/','docs/brain/reviews/')):return 'checkpoint-or-review-evidence'
    if n.startswith(('apps/','packages/')):return 'app-or-package'
    if n.startswith('supabase/'):return 'database-or-edge-source'
    if n.startswith('scripts/'):return 'tool-or-fixture'
    return 'other-review-required'
with zipfile.ZipFile(private/'secret.zip') as z:
    proof_raw=z.read('secret-scan-proof.json'); proof=json.loads(proof_raw)
    sarif_raw=z.read('gitleaks-results.sarif'); sarif=json.loads(sarif_raw)
    snapshot={r['path']:r for r in proof['source']['snapshot']}; current=proof['commands']['gitleaks-current']['report']; historical=sarif['runs'][0]['results']
    rows=[]; categories=collections.Counter(); rules=collections.Counter(); unmatched=0
    for row in current:
        name=row['File']; prefix=proof['snapshot'].rstrip('/')+'/'
        if name.startswith(prefix): name=name[len(prefix):]
        elif name.startswith('./'): name=name[2:]
        bind=snapshot.get(name)
        if not bind: unmatched+=1
        category=kind(name); categories[category]+=1; rules[row['RuleID']]+=1
        coordinates={'path':name,'rule':row['RuleID'],'start':row['StartLine'],'end':row['EndLine'],'start_column':row['StartColumn'],'end_column':row['EndColumn']}
        rows.append({'scope':'current','path_sha256':sha(name.encode()),'blob':bind['object'] if bind else None,
                     'file_sha256':bind['sha256'] if bind else None,'range_sha256':sha(canon(coordinates)),
                     'rule_id':row['RuleID'],'partition':category,'disposition':'OWNER_REVIEW_REQUIRED'})
    for row in historical:
        loc=row['locations'][0]['physicalLocation']; name=loc['artifactLocation']['uri']; region=loc['region']; commit=row['partialFingerprints'].get('commitSha')
        coordinates={'path':name,'rule':row['ruleId'],'region':region,'commit':commit}
        rows.append({'scope':'history','path_sha256':sha(name.encode()),'commit_sha256':sha(str(commit).encode()),
                     'range_sha256':sha(canon(coordinates)),'rule_id':row['ruleId'],'disposition':'OWNER_REVIEW_REQUIRED'})
    commands={name:{'argv_sha256':sha(canon(r['argv'])),'exit':r['exit'],'started':r['started'],'finished':r['finished'],
                    'stdout_sha256':r['stdout_sha256'],'stderr_sha256':r['stderr_sha256']} for name,r in proof['commands'].items()}
    summary={'run_id':proof['run_id'],'context':proof['context'],'source_ref':proof['source_ref'],
             'provider_checkout_head':proof['source']['head'],'provider_checkout_tree':proof['source']['tree'],
             'stage_head':'05dc51d6c945d31c66b921ae99dee603de464cdc','binding_note':'PR workflow checked the synthetic merge commit; its tree equals the issued stage tree. Findings are tree-bound, not represented as a stage-head commit scan.',
             'archive_sha256':sha((private/'secret.zip').read_bytes()),'proof_sha256':sha(proof_raw),'sarif_sha256':sha(sarif_raw),
             'counts':{'current_gitleaks':len(current),'history_gitleaks':len(historical),'current_unmatched_snapshot_paths':unmatched},
             'current_partitions':dict(categories),'current_rules':dict(rules),'commands':commands,
             'verified_trufflehog_findings':0,'execution_errors_observed':0,'acceptance':'REJECTED_SECRET_CURRENT_SOURCE_FINDINGS_UNREVIEWED',
             'owner':'TasfiqJ (repository owner); security classification/rotation requires owner action; no owner receipt supplied',
             'raw_secret_output':False,'admission':'NONE'}
    (out/'safe-secret-locations.json').write_text(json.dumps({'source_run':proof['run_id'],'rows':rows},indent=2)+'\n')
    (out/'safe-secret-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
with zipfile.ZipFile(private/'static.zip') as z:
    osv_raw=z.read('osv-scan.json'); data=json.loads(osv_raw); rows=[]
    for result in data['results']:
        source=result['source']['path'].split('/onSkin/onSkin/')[-1]
        for package in result['packages']:
            rows.append({'source':source,'package':package['package'],'advisories':[{'id':v['id'],'aliases':v.get('aliases',[]),'affected':v.get('affected',[])} for v in package['vulnerabilities']]})
    (out/'safe-osv-summary.json').write_text(json.dumps({'run':39997349147,'archive_sha256':sha((private/'static.zip').read_bytes()),
        'raw_sha256':sha(osv_raw),'scanner_exit':int(z.read('osv-scan.exit-code')),'outcomes':json.loads(z.read('static-analysis-outcomes.json')),'rows':rows},indent=2)+'\n')
with zipfile.ZipFile(private/'code.zip') as z:
    raw=z.read('npm-audit-high.json'); data=json.loads(raw)
    (out/'provider-npm-audit.json').write_bytes(raw)
    (out/'safe-provider-code-summary.json').write_text(json.dumps({'run':39997349147,'archive_sha256':sha((private/'code.zip').read_bytes()),'npm_audit_sha256':sha(raw),'counts':data['metadata']['vulnerabilities'],
        'npm_audit_exit':int(z.read('npm-audit-high.exit-code')),'outcomes':json.loads(z.read('code-gates-outcomes.json'))},indent=2)+'\n')
print(json.dumps(summary,indent=2))
