"""Bind all original explicit SQL targets without invoking a database or scanner."""
import hashlib,json,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[6];out=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(root/'scripts/phase9/security_acceptance'));import contract as c
policy=c.load(c.HERE,'proposal.json');targets=c.scan_coverage(policy)['explicitTargets'];assert len(targets)==26
summary=json.loads((out/'inventory-base/summary.json').read_bytes());rows={}
for shard in summary['shards']:
    raw=(out/'inventory-base'/shard['path']).read_bytes();assert hashlib.sha256(raw).hexdigest()==shard['sha256']
    for row in json.loads(raw)['rows']:rows[row['path']]=row
result=[]
for path in targets:
    row=rows[path];assert row['sha256']==hashlib.sha256((root/path).read_bytes()).hexdigest()
    result.append(dict(path=path,git_blob=row['git_blob'],sha256=row['sha256'],bytes=row['bytes'],frozen_explicit_target=True,target_support='NOT_NEWLY_SCANNED',disposition='RETAIN_REQUIRED_SQL_NO_DATABASE_OR_COVERAGE_ADMISSION'))
(out/'sql-target-identities.json').write_text(json.dumps(dict(source_head=summary['source_commit'],source_tree=summary['source_tree'],rows=result,source_manifest_unchanged=True),indent=2)+'\n')
print('VERIFIED: all 26 original explicit SQL target identities; no scan or database invocation')
