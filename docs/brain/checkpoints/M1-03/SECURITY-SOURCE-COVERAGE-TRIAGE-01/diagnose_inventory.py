"""Read-only inventory diagnosis; no scanner execution or source acceptance."""
import argparse, collections, datetime, gzip, hashlib, json, pathlib, subprocess, sys

BASE = '4f6a2d2c84a06ba9b794967fb76a5f9b6fc994fe'
TREE = '791580347993487bd3920727ee7b0e31668eed4e'
def sha(b): return hashlib.sha256(b).hexdigest()
def stamp(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def write(p, o): p.write_bytes((json.dumps(o, indent=2, sort_keys=True)+'\n').encode())

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--repo',type=pathlib.Path,required=True); ap.add_argument('--output',type=pathlib.Path,required=True); a=ap.parse_args()
    r=a.repo.resolve(); out=a.output.resolve(); out.mkdir(parents=True,exist_ok=True)
    def git(*args): return subprocess.check_output(['git',*args],cwd=r)
    assert git('rev-parse','HEAD').decode().strip()==BASE
    assert git('rev-parse','HEAD^{tree}').decode().strip()==TREE
    assert not git('status','--porcelain=v1').strip()
    started=stamp(); here=r/'scripts/phase9/security_acceptance'; sys.path.insert(0,str(here)); import contract
    policy=contract.load(here,'proposal.json'); manifest=contract.load(here,'source-manifest.json')
    expected={v['path']:v['sha256'] for v in manifest}
    for p in ('proposal.json','source-manifest.json'): expected['scripts/phase9/security_acceptance/'+p]=sha((here/p).read_bytes())
    frozen=json.loads(gzip.decompress((here/'scan-targets.json.gz').read_bytes()))
    partitions={x['path']:x for group in ('targets','exclusions') for x in frozen[group]}
    assert set(partitions)==set(expected)
    original=contract.scan_coverage(policy)  # Original schema and denominator verification only.
    tracked=set(git('ls-files','-z').decode().strip('\0').split('\0'))
    untracked=set(filter(None,git('ls-files','--others','--exclude-standard','-z').decode().split('\0')))
    rows=[]
    for p in sorted(set(expected)|tracked):
        v={'path':p,'tracked':p in tracked,'reviewed_sha256':expected.get(p),'reviewed_partition':partitions.get(p)}
        if p not in tracked: v.update(status='absent',current_sha256=None,bytes=None,diagnostic_kind=None)
        else:
            b=(contract.physical(r)/p).read_bytes(); h=sha(b)
            v.update(current_sha256=h,bytes=len(b),status=('extra' if p not in expected else 'unchanged' if h==expected[p] else 'changed'))
            try: v['diagnostic_kind'],v['diagnostic_reason']=contract.coverage_kind(p,b)
            except contract.Rejected as e: v.update(diagnostic_kind='BLOCKED',diagnostic_reason=str(e))
        v['area']='docs/brain' if p.startswith('docs/brain/') else 'app' if p.startswith(('apps/','packages/')) else 'database' if p.startswith('supabase/') else 'other'
        v['suffix']=pathlib.PurePosixPath(p).suffix or '(none)'; rows.append(v)
    command=[sys.executable,'-B','-c',"import pathlib,sys; sys.path.insert(0,sys.argv[1]); import contract; contract.source(pathlib.Path(sys.argv[2]),contract.load(contract.HERE,'proposal.json'))",str(here),str(r)]
    begin=stamp(); run=subprocess.run(command,cwd=r,capture_output=True); end=stamp()
    assert run.returncode==1 and b'contract.Rejected: SOURCE_INVENTORY_DRIFT' in run.stderr
    assert len(rows)==len(set(expected)|tracked)
    counts=dict(collections.Counter(v['status'] for v in rows)); assert sum(counts.values())==len(rows)
    assert counts.get('extra',0)+counts.get('absent',0)>0
    summary={'reviewed_inventory':len(expected),'reviewed_manifest_rows':len(manifest),'tracked':len(tracked),'untracked':len(untracked),'status_counts':counts,
        'status_by_area':{s:dict(collections.Counter(v['area'] for v in rows if v['status']==s)) for s in counts},
        'status_by_suffix':{s:dict(collections.Counter(v['suffix'] for v in rows if v['status']==s)) for s in counts},
        'frozen_target_count':len(frozen['targets']),'frozen_required_count':len(original['required']),'frozen_exclusion_count':len(frozen['exclusions']),
        'frozen_auxiliary_count':len(original['targets'])-len(original['required']),'explicit_sql_targets':len(frozen['explicitTargets']),
        'current_kind_counts':dict(collections.Counter(v.get('diagnostic_kind') for v in rows if v['tracked'])),
        'large_or_unsupported':[{'path':v['path'],'bytes':v['bytes'],'reason':v.get('diagnostic_reason'),'status':v['status']} for v in rows if v.get('diagnostic_kind')=='BLOCKED']}
    receipt={'command':command,'cwd':str(r),'started':begin,'finished':end,'raw_exit':run.returncode,'stdout_sha256':sha(run.stdout),'stderr_sha256':sha(run.stderr),
        'safe_error':'contract.Rejected: SOURCE_INVENTORY_DRIFT','before_scanners':True,'collector_order':['source(root,policy)','scan_coverage(policy,root)','coupled_source(root,installed)','verify_tool_sources(tools,policy)','scanner commands'],
        'original_contract_sha256':sha((here/'contract.py').read_bytes()),'original_collect_sha256':sha((here/'collect.py').read_bytes())}
    write(out/'inventory-reproducer.json',receipt)
    matrix={'schema_version':1,'source_sha':BASE,'source_tree':TREE,'started':started,'finished':stamp(),
        'status':'FAIL_CLOSED_NO_CURRENT_SAST_EVIDENCE','summary':summary,'scanned_current_paths':None,'coverage_percent':None,
        'diagnostic_classification_is_not_approval':True,'frozen_explicit_sql_targets':frozen['explicitTargets'],
        'frozen_source_manifest_sha256':policy['sourceManifest'],'frozen_scan_targets_sha256':policy['scanCoverageManifest'],
        'path_rows_include':'changed/extra/absent only; 11833 unchanged paths inherit the exact frozen source-manifest and scan-targets partition',
        'paths':[dict(path=v['path'],status=v['status'],sha256=v['current_sha256'],bytes=v['bytes'],kind=v['diagnostic_kind'],
            **({'reason':v['diagnostic_reason']} if v.get('diagnostic_kind') in ('BLOCKED','auxiliary') else {})) for v in rows if v['status']!='unchanged']}
    (out.parent/'SCAN_COVERAGE_MATRIX.json').write_bytes((json.dumps(matrix,sort_keys=True,separators=(',',':'))+'\n').encode())
    assert not git('status','--porcelain=v1').strip()
    print(json.dumps(summary,indent=2)); print('ORIGINAL_SOURCE_GUARD_EXIT',run.returncode)

if __name__=='__main__': main()
