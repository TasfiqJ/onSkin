import zipfile,pathlib,json,hashlib,subprocess,io,tarfile,gzip,collections
base=pathlib.Path(__file__).resolve().parent;repo=base.parent/'postmerge-gate-triage01-stage'
sha=lambda b:hashlib.sha256(b).hexdigest()
canon=lambda v:json.dumps(v,sort_keys=True,separators=(',',':')).encode()
out={'source_commit':'d9912f4c8b30358593569c5b9b4e84773c6f463e','source_tree':'389c2a09b62e78a225a2b41c8a1965a1b0e1ab80','admission':'NONE'}
for group in ('code','static','secret'):
 with zipfile.ZipFile(base/(group+'.zip')) as z:
  data={n:z.read(n) for n in z.namelist()};get=lambda n:json.loads(data[n]);receipt={'zip_sha256':sha((base/(group+'.zip')).read_bytes()),'members':{n:{'sha256':sha(b),'bytes':len(b)} for n,b in data.items()}}
  receipt['outcomes']=get(group+'-gates-outcomes.json' if group=='code' else 'static-analysis-outcomes.json' if group=='static' else 'secret-scan-outcomes.json')
  assert receipt['outcomes']['sha']==out['source_commit'] and receipt['outcomes']['run_id']=='39833311172'
  if group=='code':
   audit=get('npm-audit-high.json');packet=get('dependency-inventory.json')
   receipt.update(npm_counts=audit['metadata']['vulnerabilities'],npm_ids=sorted({v.get('url','').split('/')[-1] for r in audit['vulnerabilities'].values() for v in r['via'] if isinstance(v,dict)}),sbom_blockers=packet['blockers'],sbom_package_count=packet['packageCount'],exits={n:b.decode().strip() for n,b in data.items() if n.endswith('exit-code')})
   receipt['policy_refusals']=data['npm-exception-gate.stderr'].decode().splitlines()
   target=base/'provider-code';target.mkdir(exist_ok=True)
   for n,b in data.items(): (target/n).write_bytes(b)
  elif group=='static':
   osv=get('osv-scan.json');receipt.update(osv_ids=sorted({v['id'] for result in osv['results'] for p in result['packages'] for v in p['vulnerabilities']}),osv_packages=sum(len(r['packages']) for r in osv['results']),exits={n:b.decode().strip() for n,b in data.items() if n.endswith('exit-code')},technical_receipt_present=any(n.startswith('g97-evidence/') for n in data),semgrep_raw_present=any('semgrep' in n for n in data))
   receipt['policy_refusals']=data['osv-exception-gate.stderr'].decode().splitlines()
  else:
   sarif=get('gitleaks-results.sarif');findings=[f for r in sarif['runs'] for f in r.get('results',[])];proof=get('secret-scan-proof.json')
   receipt['gitleaks_count']=len(findings)
   locations=[]
   for f in findings:
    loc=f['locations'][0]['physicalLocation'];region=loc['region'];assert region.get('snippet',{}).get('text')=='REDACTED'
    locations.append(sha(canon([f.get('partialFingerprints'),f['ruleId'],loc['artifactLocation']['uri'],region['startLine'],region.get('endLine')])))
   receipt['location_hashes']=sorted(locations);receipt['proof_keys']=sorted(proof)
   receipt['command_summaries']={k:{'exit':r['exit'],'stdout_sha256':r['stdout_sha256'],'stderr_sha256':r['stderr_sha256']} for k,r in proof.get('commands',{}).items()}
   receipt['proof_summary']={'sourceCommit':proof['source']['head'],'sourceTree':proof['source']['tree'],'run_id':proof['run_id'],'commits':len(proof['source']['commits'])}
   assert receipt['proof_summary']['sourceCommit']==out['source_commit'] and receipt['proof_summary']['sourceTree']==out['source_tree']
   current=proof['commands']['gitleaks-current']['report'];receipt['current_gitleaks_count']=len(current)
   receipt['current_location_hashes']=[]
   for f in current:
    assert f['Secret']=='REDACTED'
    receipt['current_location_hashes'].append(sha(canon([f.get('Commit'),f['RuleID'],f['File'],f['StartLine'],f.get('EndLine')])))
   receipt['current_location_hashes'].sort()
   receipt['trufflehog_verified_counts']={}
   for name in ('trufflehog-history','trufflehog-current'):
    logs=[json.loads(line) for line in proof['commands'][name]['stderr'].splitlines() if line.startswith('{')]
    receipt['trufflehog_verified_counts'][name]=next(r['verified_secrets'] for r in logs if r.get('msg')=='finished scanning')
   receipt['proof_shape']={k:(sorted(v) if isinstance(v,dict) else len(v) if isinstance(v,list) else type(v).__name__) for k,v in proof.items()}
  out[group]=receipt
archive=subprocess.check_output(['git','-C',str(repo),'archive','--format=tar',out['source_commit']])
with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
 files={m.name:tar.extractfile(m).read() for m in tar if m.isfile()}
rows=json.loads(files['scripts/phase9/security_acceptance/source-manifest.json']);expected={r['path']:r['sha256'] for r in rows}
special={'scripts/phase9/security_acceptance/source-manifest.json','scripts/phase9/security_acceptance/proposal.json'}
missing=sorted(expected.keys()-files.keys());extra=sorted(files.keys()-expected.keys()-special);changed=sorted(p for p in expected.keys()&files.keys() if sha(files[p])!=expected[p])
def category(p):
 if p.startswith('docs/brain/'):return 'docs/brain'
 if p.startswith('.github/workflows/'):return '.github/workflows'
 return '/'.join(p.split('/')[:2]) if '/' in p else 'root'
out['manifest_discrepancy']={'expected_rows':len(expected),'current_files':len(files),'changed_count':len(changed),'missing_count':len(missing),'extra_count':len(extra),'changed_classes':dict(collections.Counter(map(category,changed))),'missing_classes':dict(collections.Counter(map(category,missing))),'extra_classes':dict(collections.Counter(map(category,extra)))}
coverage=json.loads(gzip.decompress(files['scripts/phase9/security_acceptance/scan-targets.json.gz']))
out['frozen_coverage']={k:len(coverage[k]) for k in ('targets','exclusions','explicitTargets')}
out['frozen_coverage']['target_kinds']=dict(collections.Counter(r['kind'] for r in coverage['targets']))
partition=collections.Counter();oversize=0;oversize_classes=collections.Counter()
allowed_gzip={'scripts/phase9/security_acceptance/'+n for n in ('history.json.gz','scan-targets.json.gz','test-fixtures.json.gz','legacy-sbom-fixture.json.gz','semgrep-engine-linux-x86_64.tar.gz')}|{'scripts/phase9/tooling-security-backports/originals.json.gz'}
for p,b in files.items():
 if b.startswith(b'\x89PNG\r\n\x1a\n') and p.endswith('.png'):kind='excluded_png'
 elif b.startswith(b'\xff\xd8\xff') and p.endswith('.jpg'):kind='excluded_jpeg'
 elif b.startswith(b'\xff\xd8\xff') and p.endswith('.png'):kind='auxiliary_jpeg'
 elif b.startswith(b'\x1f\x8b') and p.endswith('.gz'):kind='excluded_reviewed_gzip' if p in allowed_gzip else 'blocked_unreviewed_gzip'
 else:
  kind='required';oversize+=len(b)>4*1024**2
  if len(b)>4*1024**2:oversize_classes[category(p)]+=1
 partition[kind]+=1
out['current_source_coverage_partition']={'counts':dict(partition),'sum':sum(partition.values()),'oversize_required':oversize,'oversize_classes':dict(oversize_classes),'meaning':'source classification only; no fresh Semgrep coverage claimed; unreviewed gzip and oversized required inputs block the current policy'}
fixture=json.loads(gzip.decompress(files['scripts/phase9/security_acceptance/test-fixtures.json.gz']));sg=fixture['semgrep']['report']
out['retained_semgrep_fixture']={'raw_exit':fixture['semgrep']['exit'],'results':len(sg.get('results',[])),'errors':len(sg.get('errors',[])),'fixpoint_timeouts':len(sg.get('time',{}).get('fixpoint_timeouts',[])),'scanned_paths':len(sg.get('paths',{}).get('scanned',[])),'required_or_auxiliary_targets':len(coverage['targets']),'missing_target_count':len({r['path'] for r in coverage['targets']}-set(sg.get('paths',{}).get('scanned',[])))}
(base/'discrepancies.json').write_text(json.dumps(out,indent=2)+'\n')
summary=json.loads(json.dumps(out));summary['secret'].pop('location_hashes');summary['secret'].pop('current_location_hashes');print(json.dumps(summary,indent=2))
