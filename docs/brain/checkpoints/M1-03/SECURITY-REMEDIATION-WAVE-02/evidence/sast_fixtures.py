"""Synthetic old/new parity under THREE authentic bundles; no source coverage claim."""
import collections,hashlib,json,os,pathlib,subprocess,sys,time
root=pathlib.Path('/work/repo');out=pathlib.Path('/evidence/sast-fixtures2');out.mkdir(exist_ok=False)
sys.path.insert(0,str(root/'scripts/phase9/security_acceptance'));import contract as c
fixture=pathlib.Path('/work/sast-fixtures2');fixture.mkdir(exist_ok=False)
(fixture/'negative.ts').write_text('export const increment = (value: number): number => value + 1;\n')
(fixture/'positive.ts').write_text('export function unsafe() { return eval(location.hash); }\n')
(fixture/'positive.tsx').write_text('export function Unsafe(input: string) { return <div dangerouslySetInnerHTML={{__html: input}} />; }\n')
rules=pathlib.Path('/work/rules');configs=[]
for n in ('typescript','react','secrets'):
    p=rules/(n+'.yaml');assert c.SHA(p.read_bytes())==c.load(c.HERE,'proposal.json')['rules'][n];configs+=['--config',str(p)]
rows=[]
for label,python,site in [('old',sys.executable,'/work/bridge2/old-site'),('new','/work/bridge2/candidate-env/bin/python','/work/bridge2/candidate-env/lib/python3.12/site-packages')]:
    raw=fixture/(label+'.json');args=[python,'-I','-S','-B','-c',c.SEMGREP_ENTRY,site,'scan','--error','--strict','--oss-only','--metrics=off','--jobs=1','--max-memory=768','--timeout=30','--max-target-bytes=4194304','--json','--output='+str(raw),*configs,'negative.ts','positive.ts','positive.tsx']
    start=time.monotonic()
    with (out/(label+'.log')).open('wb') as f:
        try:code=subprocess.run(args,cwd=fixture,stdout=f,stderr=subprocess.STDOUT,timeout=180,env={**os.environ,'SEMGREP_ENABLE_VERSION_CHECK':'0','SEMGREP_SEND_METRICS':'off'}).returncode
        except subprocess.TimeoutExpired:code=124
    data=json.loads(raw.read_bytes()) if raw.exists() else {};results=[dict(rule_id=r['check_id'],path=r['path'],start=r['start'],end=r['end']) for r in data.get('results',[])]
    row=dict(label=label,argv=args,cwd=str(fixture),exit=code,seconds=time.monotonic()-start,raw_sha256=c.SHA(raw.read_bytes()) if raw.exists() else None,log_sha256=c.SHA((out/(label+'.log')).read_bytes()),
        version=data.get('version'),results=results,errors=data.get('errors'),paths_scanned=data.get('paths',{}).get('scanned'),skipped_rules=data.get('skipped_rules'),fixpoint_timeouts=data.get('time',{}).get('fixpoint_timeouts',[]))
    rows.append(row)
(out/'observations.json').write_text(json.dumps(dict(runs=rows,fixture_revision='Use actual rule taint sources: location.hash and function parameter; generic input/arrow fixture gave no findings. No rule changed.'),indent=2)+'\n')
assert rows[0]['exit']==rows[1]['exit']==1
assert rows[0]['results']==rows[1]['results'] and len(rows[0]['results'])>0
assert all(r['errors']==[] and not r['fixpoint_timeouts'] for r in rows)
assert all(all(x['path']!='negative.ts' for x in r['results']) for r in rows)
(out/'summary.json').write_text(json.dumps(dict(runs=rows,old_new_parity=True,all_four_rule_gate=False,missing_rule='owasp-top-ten',synthetic_only=True,current_source_scan=False),indent=2)+'\n')
print(json.dumps(dict(old_new_parity=True,findings=len(rows[0]['results']),current_source_scan=False,all_four_rule_gate=False)))
