"""Reduce original provider ZIPs to counts, identities and hashes, never payloads.

--sources is an external private JSON list with name/id/url from the connector.
URLs and raw archives are never written to the checkpoint.
"""
import argparse, collections, datetime, hashlib, io, json, pathlib, re, sys, urllib.request, zipfile

def sha(b): return hashlib.sha256(b).hexdigest()
def canon(o): return json.dumps(o,sort_keys=True,separators=(',',':')).encode()
def write(p,o): p.write_bytes((json.dumps(o,indent=2,sort_keys=True)+'\n').encode())
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--sources',type=pathlib.Path,required=True);ap.add_argument('--repo',type=pathlib.Path,required=True);ap.add_argument('--output',type=pathlib.Path,required=True);a=ap.parse_args()
    out=a.output; out.mkdir(parents=True,exist_ok=True); repo=a.repo.resolve(); here=repo/'scripts/phase9/security_acceptance';sys.path.insert(0,str(here));import secret_scan
    artifact_rows=[]; advisories={}; secrets={}
    lock=json.loads((repo/'package-lock.json').read_bytes())
    for row in json.loads(a.sources.read_bytes()):
        start=datetime.datetime.now(datetime.timezone.utc).isoformat()
        data=pathlib.Path(row['file']).read_bytes() if 'file' in row else urllib.request.urlopen(row['url'],timeout=60).read();z=zipfile.ZipFile(io.BytesIO(data))
        expected={'static':'d4c7bde3d719f7f840a829253387a1c93ac2abbfd99a62869f1900b2fd93452b','code':'64acd56941a28be0ba2a6713d4b33fb146ccfff465868b4b4b3981bb8c9f0869','secret':'a644c782ec4953e175d957e30e7e28a0b3051c17c185a8e2ed8e6798fd248868','decision':'fd7cfd3ad641bde1bb5560ec43d3d60ad773ecd0f149efe6695712c292a7b096'}
        assert sha(data)==expected[row['name']]
        artifact_rows.append({'id':row['id'],'name':row['name'],'sha256':sha(data),'bytes':len(data),'started':start,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'members':[{'name':i.filename,'bytes':i.file_size,'sha256':sha(z.read(i.filename))} for i in z.infolist()]})
        if row['name']=='secret':
            p=json.loads(z.read('secret-scan-proof.json')); sarif=z.read('gitleaks-results.sarif');assert sha(sarif)==p['sarif_sha256']
            assert p['source']['tree']=='791580347993487bd3920727ee7b0e31668eed4e'
            records=p['commands']['gitleaks-current']['report']; history=json.loads(sarif)['runs'][0]['results']
            checks={};tools={}
            for name,pin in secret_scan.PINS.items():
                assert all(p['tools'][name][k]==v for k,v in pin.items());secret_scan.validate_version(p['tools'][name]['version_result'],name)
                tools[name]={'version':pin['version'],'provider_declared_binary_sha256':pin['binary'],'local_binary_rehashed':False}
            for name,v in p['commands'].items():
                assert all(sha(v[k].encode())==v[k+'_sha256'] for k in ('stdout','stderr'))
                clean=re.sub(r'\x1b\[[0-9;]*m','',v['stderr'])
                check={'raw_exit':v['exit'],'started':v['started'],'finished':v['finished'],'stdout_sha256':v['stdout_sha256'],'stderr_sha256':v['stderr_sha256']}
                if name.startswith('trufflehog'):
                    ev=[json.loads(s) for s in clean.splitlines() if s.strip()];end=ev[-1]
                    assert end.get('msg')=='finished scanning' and end.get('trufflehog_version')=='3.99.3' and end.get('chunks',0)>0 and end.get('bytes',0)>0
                    assert end.get('verified_secrets')==0 and end.get('unverified_secrets')==0 and v['exit']==0 and not v['stdout'].strip()
                    assert not any(e.get('level')=='error' or 'error' in e for e in ev)
                    check.update(verified_secrets=0,unverified_secrets=0,completed=True)
                else:
                    count=len(records) if name.endswith('current') else len(history)
                    assert v['exit']==2 and re.search(r'leaks found: '+str(count)+r'\s*$',clean)
                    check.update(findings=count,completed=True)
                checks[name]=check
            redacted=all(v['Secret']=='REDACTED' for v in records)
            assert redacted
            locations=[];prefixes=collections.Counter();rules=collections.Counter();files=set()
            for v in records:
                path=v['File'].replace('\\','/');prefix=p['snapshot'].replace('\\','/').rstrip('/')+'/'
                assert path.startswith(prefix);path=path[len(prefix):]
                bucket='docs/brain/' if path.startswith('docs/brain/') else 'apps/' if path.startswith('apps/') else 'other/'
                prefixes[bucket]+=1;rules[v['RuleID']]+=1;files.add(sha(path.encode()))
                locations.append({'location_sha256':sha(canon([path,v['StartLine'],v['EndLine'],v['StartColumn'],v['EndColumn']])),'rule_id':v['RuleID'],'source_prefix':bucket})
            secrets={'schema_version':1,'status':'UNRESOLVED_CURRENT_SOURCE_FINDINGS','run_id':p['run_id'],'source_head':p['source']['head'],'source_tree':p['source']['tree'],'source_ref':p['source_ref'],
                'provider_context':p['context'],'raw_match_context_always_withheld':True,'original_proposal_current_count':1107,'observed_current_count':len(records),'delta_current_vs_old_proposal':len(records)-1107,
                'original_proposal_history_count':3265,'observed_history_count':len(history),'delta_history_vs_old_proposal':len(history)-3265,
                'history_is_not_current_count':True,'tools':tools,'commands':checks,'current_report_redaction_checked':redacted,
                'current_prefix_counts':dict(prefixes),'current_rule_counts':dict(rules),'current_file_location_hash_count':len(files),'current_locations':locations,
                'independent_full_admission_validation':False,'fresh_local_secret_scan':'NOT_RUN','no_automatic_dismissal_or_allowlist':True}
            write(out.parent/'SAFE_SECRET_DISCREPANCIES.json',secrets)
        elif row['name']=='code':
            audit=json.loads(z.read('npm-audit-high.json'));roots=[]
            for name,v in audit['vulnerabilities'].items():
                for via in v.get('via',[]):
                    if isinstance(via,dict):
                        roots.append({'package':name,'advisory':via['url'].split('/')[-1],'severity':via['severity'],'affected_range':via.get('range'),
                            'locked_paths':[{'path':p,'version':lock['packages'][p]['version'],'dev_flag':lock['packages'][p].get('dev',False),'dev_optional':lock['packages'][p].get('devOptional',False)} for p in v['nodes']]})
            all_ids={x['advisory'] for x in roots}; assert not all_ids&{'GHSA-qxg6-89mg-rqv8','GHSA-xp26-3454-mjgp'}
            advisories['npm']={'counts':audit['metadata']['vulnerabilities'],'roots':roots,'propagated_package_names':sorted(audit['vulnerabilities']),
                'raw_exits':{n:int(z.read(n)) for n in z.namelist() if n.endswith('.exit-code')},'outcomes':json.loads(z.read('code-gates-outcomes.json')),'fixed_mocker_advisories_present':False}
        elif row['name']=='static':
            report=json.loads(z.read('osv-scan.json'));findings=[]
            for result in report['results']:
                path=result['source']['path'];path=path.split('/onSkin/onSkin/',1)[-1]
                for pkg in result['packages']:
                    for v in pkg['vulnerabilities']:
                        findings.append({'source':path,'package':pkg['package'],'id':v['id'],'aliases':v.get('aliases',[]),
                            'fixed_versions':sorted({e['fixed'] for af in v.get('affected',[]) for rg in af.get('ranges',[]) for e in rg.get('events',[]) if 'fixed' in e})})
            advisories['osv']={'findings':findings,'raw_exits':{n:int(z.read(n)) for n in z.namelist() if n.endswith('.exit-code')},'outcomes':json.loads(z.read('static-analysis-outcomes.json')),
                'g97_receipt_present':any(n.startswith('g97-evidence/') for n in z.namelist()),'semgrep_report_present':any('semgrep' in n for n in z.namelist())}
        else: advisories['original_decision']=json.loads(z.read('g97-decision.json'))
    write(out/'provider-artifact-identities.json',artifact_rows);write(out/'advisory-identities.json',advisories)
    print(json.dumps({'artifacts_verified':len(artifact_rows),'current_gitleaks':secrets['observed_current_count'],'history_gitleaks':secrets['observed_history_count'],'npm':advisories['npm']['counts'],'osv_records':len(advisories['osv']['findings']),'decision':advisories['original_decision']}))

if __name__=='__main__':main()
