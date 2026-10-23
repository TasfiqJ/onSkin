"""Rebind historical failed targets/fixpoint coordinates without exposing findings."""
import collections, hashlib, json, pathlib, subprocess
root=pathlib.Path.cwd(); prefix=root/'docs/brain/checkpoints/M1-03/SECURITY-REMEDIATION-WAVE-01'
source=root/'docs/brain/checkpoints/M1-03/SOURCE-CLOSURE-03/reconciliation-20261022/current-scan-summary.json'
raw=source.read_bytes(); history=json.loads(raw)
current={r['path']:r for r in json.loads((prefix/'evidence/inventory-reviewed/review-matrix.json').read_bytes())['rows']}
gitrows=subprocess.check_output(['git','ls-tree','-rz','HEAD']).split(b'\0'); blobs={}
for row in gitrows:
    if not row:continue
    meta,path=row.split(b'\t',1);blobs[path.decode()]=meta.decode().split()[2]
sha=lambda b:hashlib.sha256(b).hexdigest()
canon=lambda obj:json.dumps(obj,sort_keys=True,separators=(',',':')).encode()
failed=[]
for row in history['failed_targets']:
    name=row['path'].replace('\\','/'); now=current.get(name)
    failed.append({'path':name,'old_blob':row['git_blob'],'old_sha256':row['sha256'],'current_blob':blobs.get(name),'current_sha256':now['sha256'] if now else None,
       'relation':'UNCHANGED' if now and now['sha256']==row['sha256'] else 'CHANGED' if now else 'MISSING',
       'historical_applicable_bundles':row['applicable_bundles'],'historical_scanned_bundles':row['scanned_bundles'],'fresh_scanned_bundles':None,'review_status':'OPEN'})
events=[]; runs=[]
for run in history['runs']:
    warnings=run['fixpoint_timeouts'];runs.append({'bundle':run['bundle'],'rules_sha256':run['expected_sha256'],'raw_sha256':run['raw_sha256'],'event_count':len(warnings),'raw_exit':run['raw_exit'],'raw_error_count':run['raw_error_count']})
    for event in warnings:
        loc=event.get('location',{}); name=loc.get('path','').replace('\\','/')
        if name.startswith('./'):name=name[2:]
        if name not in current:
            matches=[n for n in current if name.endswith('/'+n)]
            if len(matches)==1:name=matches[0]
        now=current.get(name)
        coordinates={'bundle':run['bundle'],'path':name,'start':loc.get('start'),'end':loc.get('end')}
        events.append({'bundle':run['bundle'],'path':name if now else None,'historical_path_sha256':sha(loc.get('path','').encode()),'range_sha256':sha(canon(coordinates)),
                       'current_blob':blobs.get(name),'current_sha256':now['sha256'] if now else None,'review_status':'OPEN','fresh_event_result':None})
result={'source_summary_path':source.relative_to(root).as_posix(),'source_summary_sha256':sha(raw),'historical_source_commit':history['source_commit'],'historical_source_tree':history['source_tree'],
        'current_commit':'05dc51d6c945d31c66b921ae99dee603de464cdc','current_tree':'fc579c91528aa285f28f6364d7f4da8ee2aafd3b',
        'historical_failed_targets':len(failed),'historical_fixpoint_events':len(events),'declared_warning_events':history['warning_events'],
        'failed_target_relations':dict(collections.Counter(r['relation'] for r in failed)),'events_bound_to_current_blob':sum(bool(r['current_blob']) for r in events),
        'runs':runs,'failed_targets':failed,'fixpoint_events':events,'fresh_original_sast_run':False,'admission':'NONE'}
assert len(failed)==189 and len(events)==history['warning_events']==368
(prefix/'evidence/historical-current-review-matrix.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ('failed_targets','fixpoint_events','runs')},indent=2))
