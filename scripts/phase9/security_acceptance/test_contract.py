"""Adversarial unit tests. All fixtures/vectors grant NO scanner acceptance.

The Semgrep target list is synthetic current-scope test data; retained warnings
remain intact. Neither this fixture nor its clean vector is a scanner receipt.
"""
import copy,datetime,hashlib,json,os,pathlib,shutil,subprocess,sys,tempfile,unittest
sys.dont_write_bytecode=True
import contract as c
import history as h
import collect

class ContractTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.policy=c.load(c.HERE,'proposal.json');cls.actual=c.load(c.HERE,'test-fixtures.json.gz')
 def clean_vector(self):
  # A deliberately synthetic complete SAST vector tests other boundaries. The
  # real scanner's inherited warnings are tested separately and remain blocking.
  v=copy.deepcopy(self.actual);v['semgrep']['report']['errors']=[]
  v['semgrep']['report'].setdefault('time',{})['fixpoint_timeouts']=[]
  v['semgrep']['report']['paths']['scanned']=sorted(c.scan_coverage(self.policy)['targets'])
  v['semgrep']['report'].update(version=self.policy['semgrepVersion'],engine_requested='OSS',skipped_rules=[]);return v
 def test_exact_record_projection_positive_with_synthetic_SAST_only(self):c.records(self.clean_vector(),self.policy)
 def test_retained_Semgrep_warning_fixture_is_not_accepted(self):
  with self.assertRaisesRegex(c.Rejected,'SEMGREP_INCOMPLETE'):c.records(self.actual,self.policy)
 def test_every_scanner_omission_rejected(self):
  for name in self.actual:
   with self.subTest(name=name):
    v=self.clean_vector();del v[name]
    with self.assertRaisesRegex(c.Rejected,'SCANNER_OMISSION'):c.records(v,self.policy)
 def test_unreviewed_scanner_extra_rejected(self):
  v=self.clean_vector();v['alternate']={}
  with self.assertRaises(c.Rejected):c.records(v,self.policy)
 def test_scanner_execution_errors_are_not_findings(self):
  for name in self.actual:
   with self.subTest(name=name):
    v=self.clean_vector();v[name]['exit']=124
    with self.assertRaisesRegex(c.Rejected,'SCANNER_EXIT'):c.records(v,self.policy)
 def test_new_high_vulnerability_rejected(self):
  for name in ('npm-installed','npm-lock'):
   v=self.clean_vector();r=copy.deepcopy(v[name]['report']['vulnerabilities']['braces']);r['name']='new-package';r['nodes']=['node_modules/new-package'];r['via'][0].update(name='new-package',dependency='new-package',url='https://github.com/advisories/GHSA-aaaa-bbbb-cccc');v[name]['report']['vulnerabilities']['new-package']=r
   v[name]['report']['metadata']['vulnerabilities']['high']+=1;v[name]['report']['metadata']['vulnerabilities']['total']+=1
   with self.assertRaisesRegex(c.Rejected,'SCANNER_RECORD_DRIFT'):c.records(v,self.policy)
 def test_deleted_advisory_with_live_references_rejected(self):
  v=self.clean_vector();del v['npm-lock']['report']['vulnerabilities']['braces']
  with self.assertRaisesRegex(c.Rejected,'UNVERIFIED_AUDIT_REFERENCE'):c.records(v,self.policy)
 def test_modified_existing_advisory_rejected(self):
  v=self.clean_vector();v['npm-lock']['report']['vulnerabilities']['braces']['severity']='low'
  with self.assertRaisesRegex(c.Rejected,'SCANNER_RECORD_DRIFT'):c.records(v,self.policy)
 def test_registry_remediation_suggestions_are_preserved_but_not_authority(self):
  v=self.clean_vector()
  for name in ('npm-installed','npm-lock'):
   for r in v[name]['report']['vulnerabilities'].values():r['fixAvailable']=False;r['range']='registry-derived alternate range';r['effects']=[]
  c.records(v,self.policy)
 def test_changed_primary_advisory_and_unrooted_propagation_rejected(self):
  v=self.clean_vector();v['npm-lock']['report']['vulnerabilities']['braces']['via'][0]['range']='unreviewed-primary-range'
  with self.assertRaises(c.Rejected):c.records(v,self.policy)
  v=self.clean_vector();v['npm-lock']['report']['vulnerabilities']['nativewind']['via']=[]
  with self.assertRaisesRegex(c.Rejected,'UNROOTED_AUDIT_RECORD'):c.records(v,self.policy)
 def test_metadata_count_cannot_hide_record_omission(self):
  v=self.clean_vector();v['npm-installed']['report']['metadata']['vulnerabilities']['high']=0
  with self.assertRaises(c.Rejected):c.records(v,self.policy)
 def test_OSV_unknown_or_missing_root_rejected(self):
  for action in ('delete','new'):
   v=self.clean_vector();packages=v['osv']['report']['results'][0]['packages']
   if action=='delete':packages.pop()
   else:packages[0]['vulnerabilities'][0]['id']='GHSA-aaaa-bbbb-cccc'
   with self.assertRaises(c.Rejected):c.records(v,self.policy)
 def test_graph_nested_copy_peer_problem_and_omission_rejected(self):
  for action in ('peer','missing','nested'):
   v=self.clean_vector();obj=v['graph']['report']
   if action=='peer':obj['problems']=['invalid peer dependency']
   elif action=='missing':obj['dependencies'].pop(next(iter(obj['dependencies'])))
   else:obj['dependencies']['injected-copy']={'name':'braces','version':'3.0.3'}
   with self.assertRaises(c.Rejected):c.records(v,self.policy)
 def test_SBOM_component_and_dependency_edge_omissions_rejected(self):
  for key in ('components','dependencies'):
   v=self.clean_vector();v['sbom']['report'][key].pop()
   with self.assertRaises(c.Rejected):c.records(v,self.policy)
 def test_new_changed_missing_duplicate_history_records_rejected(self):
  for action in ('new','changed','missing','duplicate'):
   v=self.clean_vector();items=v['gitleaks']['report']
   if action=='new':items.append(copy.deepcopy(items[0]))
   elif action=='changed':items[0]['EndColumn']+=1
   elif action=='missing':items.pop()
   else:items[0]=copy.deepcopy(items[1])
   with self.assertRaises(c.Rejected):c.records(v,self.policy)
 def test_history_values_must_be_redacted(self):
  v=self.clean_vector();v['gitleaks']['report'][0]['Secret']='synthetic-test-value'
  with self.assertRaisesRegex(c.Rejected,'UNREDACTED'):c.records(v,self.policy)
 def test_SAST_finding_empty_coverage_and_version_drift_rejected(self):
  for action in ('finding','coverage','version','timeout','omission','substitution','invented','normalized-duplicate'):
   v=self.clean_vector();obj=v['semgrep']['report']
   if action=='finding':obj['results']=[{'id':'injected-positive'}]
   elif action=='coverage':obj['paths']['scanned']=[]
   elif action=='version':obj['version']='0.0.0'
   elif action=='timeout':obj['time']['fixpoint_timeouts']=[{'error_type':'Fixpoint timeout'}]
   elif action=='omission':obj['paths']['scanned'].pop()
   elif action=='substitution':obj['paths']['scanned'][0]='scripts/phase9/security_acceptance/source-manifest.json'
   elif action=='invented':obj['paths']['scanned']=[f'NONEXISTENT/{i}.tsx' for i in range(len(obj['paths']['scanned']))]
   else:obj['paths']['scanned'][0]=obj['paths']['scanned'][1].replace('/','\\')
   with self.assertRaises(c.Rejected):c.records(v,self.policy)
 def test_verified_credential_cannot_be_waived_by_history_dispositions(self):
  v=self.clean_vector();v['trufflehog']['report']=[{'Verified':True,'Raw':'synthetic-test-value'}]
  with self.assertRaisesRegex(c.Rejected,'VERIFIED_EXPOSURE'):c.records(v,self.policy)
 def test_all_3264_dispositions_reproduced_from_Git(self):
  import gzip
  rows=json.loads(gzip.decompress(c.git(c.ROOT,'show','32c36cf860aee91e177d7db2286e40e6dda35182:scripts/phase9/security_acceptance/history.json.gz')))
  ids={r['id'] for r in rows};fresh=[r for r in self.actual['gitleaks']['report'] if r['Fingerprint'] in ids]
  result=h.verify_history(c.ROOT,fresh,rows,c.safe(c.HERE,'gitleaks.toml').decode());self.assertEqual(result['records'],3264);self.assertEqual(result['unverified'],0)
 def test_history_forged_blob_hash_or_disposition_rejected(self):
  original=c.load(c.HERE,'history.json.gz')
  for field,value in [('source_sha256','0'*64),('source_blob','0'*40),('technical_disposition','UNVERIFIED')]:
   with self.subTest(field=field):
    rows=copy.deepcopy(original);rows[0][field]=value
    with self.assertRaises(ValueError):h.verify_history(c.ROOT,self.actual['gitleaks']['report'],rows,c.safe(c.HERE,'gitleaks.toml').decode())
 def test_unsafe_paths_rejected(self):
  for p in ('../outside','/absolute','C:/outside','a\\outside','a//b','a/./b','a\0b'):
   with self.assertRaises(c.Rejected):c.safe(c.HERE,p)
 def test_coverage_exclusion_manifest_source_identity_and_partition_drift_rejected(self):
  from unittest.mock import patch
  actual=c.safe;scope=c.load(c.HERE,'scan-targets.json.gz');manifest=c.load(c.HERE,'source-manifest.json')
  for action in ('omit','invent','excluded-source','changed-source-identity','duplicate'):
   changed=copy.deepcopy(scope);rows=copy.deepcopy(manifest)
   if action=='omit':changed['targets'].pop()
   elif action=='invent':changed['targets'][0]['path']='NONEXISTENT/placeholder.ts'
   elif action=='excluded-source':
    target=next(v for v in changed['targets'] if v['path']=='apps/mobile/src/lib/auth/AuthProvider.tsx');changed['targets'].remove(target);changed['exclusions'].append({**target,'kind':'excluded','reason':'binary-png'})
   elif action=='changed-source-identity':rows[0]['sha256']='0'*64
   else:changed['targets'].append(copy.deepcopy(changed['targets'][0]))
   import gzip
   compressed=gzip.compress(c.CANON(changed),mtime=0);json_rows=c.CANON(rows);policy={**self.policy,'scanCoverageManifest':c.SHA(compressed)}
   def modified(root,name):
    if name=='scan-targets.json.gz':return compressed
    if name=='source-manifest.json':return json_rows if action=='changed-source-identity' else actual(root,name)
    return actual(root,name)
   with self.subTest(action=action),patch.object(c,'safe',side_effect=modified):
    with self.assertRaises(c.Rejected):c.scan_coverage(policy)
 def test_hardlinked_evidence_rejected(self):
  with tempfile.TemporaryDirectory(prefix='g97-contract-') as d:
   p=pathlib.Path(d);(p/'original').write_text('unchanged');os.link(p/'original',p/'linked')
   with self.assertRaisesRegex(c.Rejected,'NONREGULAR'):c.safe(p,'linked')
 def test_duplicate_JSON_fields_are_not_normalized_away(self):
  with tempfile.TemporaryDirectory(prefix='g97-json-') as d:
   p=pathlib.Path(d);(p/'report.json').write_text('{"high":68,"high":0}')
   with self.assertRaisesRegex(c.Rejected,'DUPLICATE_JSON'):c.load(p,'report.json')
 def test_untrusted_semgrep_package_rejected_before_running_a_scanner(self):
  with tempfile.TemporaryDirectory(prefix='g97-fake-scanner-') as d:
   p=pathlib.Path(d);(p/'semgrep').mkdir();(p/'semgrep/__init__.py').write_text('raise RuntimeError("MUST_NOT_EXECUTE")')
   with self.assertRaisesRegex(c.Rejected,'SEMGREP_IMPLEMENTATION_DRIFT'):collect.verify_tool_sources({'semgrep':d},self.policy)
 def test_semgrep_dependency_or_executable_pth_substitution_rejected(self):
  with tempfile.TemporaryDirectory(prefix='g97-scanner-closure-') as d:
   p=pathlib.Path(d);(p/'semgrep').mkdir();(p/'semgrep/__init__.py').write_text('# synthetic package fixture')
   fixture={'semgrepPackageTree':c.tool_tree(p,python_site=True)};collect.verify_semgrep(p,fixture)
   for name in ('unreviewed.pth','unreviewed_dependency.py'):
    out=p/name;out.write_text('raise RuntimeError("MUST_NOT_EXECUTE")')
    with self.assertRaisesRegex(c.Rejected,'SEMGREP_IMPLEMENTATION_DRIFT'):collect.verify_semgrep(p,fixture)
    out.unlink()
 def test_envelope_cannot_hide_changed_raw_scanner_output(self):
  for name,value in self.actual.items():
   data=c.CANON(value['report']) if name not in ('trufflehog','trufflehog-current') else b''
   c.bind_raw_report(name,value['report'],data)
   with self.subTest(scanner=name):
    with self.assertRaises(c.Rejected):c.bind_raw_report(name,value['report'],b'{"unreported_new_finding":true}')
 def test_regression_skip_cancel_todo_and_rewritten_summary_rejected(self):
  good={'exit':0,'tests':20,'pass':20,'fail':0,'cancelled':0,'skipped':0,'todo':0,'file':'tests/synthetic.tap'}
  def tap(r):return ''.join('# '+k+' '+str(r[k])+'\n' for k in ('tests','pass','fail','cancelled','skipped','todo')).encode()
  good['transcript']=c.SHA(tap(good));c.bind_regression(good,tap(good),0,20)
  for key in ('fail','cancelled','skipped','todo'):
   bad={**good,key:1,'pass':19};bad['transcript']=c.SHA(tap(bad))
   with self.assertRaises(c.Rejected):c.bind_regression(bad,tap(bad),0,20)
  with self.assertRaises(c.Rejected):c.bind_regression(good,tap({**good,'skipped':1}),0,20)
  with self.assertRaises(c.Rejected):c.bind_regression(good,tap(good),1,20)
  with self.assertRaises(c.Rejected):c.bind_regression(good,tap(good),False,20)
 def test_scanner_commands_reject_scope_omissions(self):
  gl=['gitleaks','detect','--config=C:/repo/scripts/phase9/security_acceptance/gitleaks.toml','--redact=100','--exit-code=2','--report-format=json','--report-path=C:/evidence/gitleaks-raw.json','--log-opts=--all --full-history','--log-level=info']
  osv=['osv','scan','source','--recursive','--format=json','--output=C:/evidence/osv-raw.json','.']
  truffle=['trufflehog','git','file://candidate','--bare','--fail','--no-update','--json','--only-verified','--concurrency=1']
  sg=['python','-I','-S','-B','-X','pycache_prefix=C:/temporary','-c',c.SEMGREP_ENTRY,'C:/semgrep','scan','--error','--strict','--oss-only','--metrics=off','--jobs=1','--max-memory=768','--timeout=30','--max-target-bytes=4194304','--json','--output=C:/evidence/semgrep-raw.json']+[v for r in ('owasp-top-ten','typescript','react','secrets') for v in ('--config','C:/evidence/rules/'+r+'.yaml')]+['.',*c.scan_coverage(self.policy)['explicitTargets']]
  for name,args in [('gitleaks',gl),('osv',osv),('trufflehog',truffle),('semgrep',sg)]:
   c.scanner_scope(name,args)
   bad=list(args)
   if name=='gitleaks':bad[-2]='--log-opts=-1'
   elif name=='osv':bad.remove('--recursive')
   elif name=='trufflehog':bad.remove('--only-verified')
   else:bad.remove('--config')
   with self.assertRaisesRegex(c.Rejected,'SCANNER_SCOPE_DRIFT'):c.scanner_scope(name,bad)
 def test_source_drift_extra_missing_and_expired_policy_tamper(self):
  with tempfile.TemporaryDirectory(prefix='g97-source-') as d:
   root=pathlib.Path(d);here=root/'scripts/phase9/security_acceptance';here.mkdir(parents=True)
   (root/'docs/phase-9').mkdir(parents=True);(root/'docs/phase-9/security-advisory-exceptions.json').write_text('expired unchanged')
   (root/'source.txt').write_text('reviewed source')
   rows=[{'path':p,'sha256':c.SHA((root/p).read_bytes())} for p in ('source.txt','docs/phase-9/security-advisory-exceptions.json')]
   (here/'source-manifest.json').write_bytes(c.CANON(rows));(here/'proposal.json').write_text('{}')
   subprocess.run(['git','init','--quiet',str(root)],check=True)
   policy={'sourceManifest':c.SHA((here/'source-manifest.json').read_bytes()),'expiredPolicy':rows[1]['sha256']}
   saved=c.HERE;c.HERE=here
   try:
    c.source(root,policy)
    (root/'.git/info/exclude').write_text('.semgrepignore\n.gitleaksignore\n')
    for action in ('change','missing','extra','policy','ignored-ignore-file','ignored-history-file'):
     p=root/('source.txt' if action in ('change','missing') else 'extra.txt' if action=='extra' else '.semgrepignore' if action=='ignored-ignore-file' else '.gitleaksignore' if action=='ignored-history-file' else 'docs/phase-9/security-advisory-exceptions.json');before=p.read_bytes() if p.exists() else None
     if action=='missing':p.unlink()
     else:p.write_text('unreviewed')
     if action in ('ignored-ignore-file','ignored-history-file'):
      with self.assertRaisesRegex(c.Rejected,'UNREVIEWED_SCAN_IGNORE'):c.source(root,policy)
     else:
      with self.assertRaises(c.Rejected):c.source(root,policy)
     if before is None:p.unlink()
     else:p.write_bytes(before)
   finally:c.HERE=saved
 def test_owner_receipt_requires_exact_binding_signature_and_time(self):
  # Retained original method name; signed-owner acceptance is now retired.
  # Its replacement is exact automated scope plus a fixed, non-renewing window.
  clock=c.utc('2026-10-19T12:00:00Z')
  self.assertEqual(c.validate_policy(self.policy,clock),c.AUTOMATED_SCOPE)
  for field,value in [('mode','ACCEPT_ALL_SECURITY'),('independentHumanApproval',True),('externalSignatureRequired',True),('releaseAuthority',True),('databaseReplayAuthority',True),('integrationAuthority',True),('schema',True)]:
   changed=copy.deepcopy(self.policy);changed['acceptance'][field]=value
   with self.subTest(field=field),self.assertRaisesRegex(c.Rejected,'SCOPE_DRIFT'):c.validate_policy(changed,clock)
  for key,value in [('notBefore','2026-10-17T00:00:00Z'),('notAfter','2026-10-22T00:00:00Z'),('state','ACTIVE'),('id','UNREVIEWED')]:
   changed={**self.policy,key:value}
   with self.subTest(key=key),self.assertRaises(c.Rejected):c.validate_policy(changed,clock)
  for instant in ('2026-10-17T23:59:59Z','2026-10-21T00:00:00Z','2026-10-22T00:00:00Z'):
   with self.assertRaisesRegex(c.Rejected,'PROPOSAL_EXPIRED_OR_CHANGED'):c.validate_policy(self.policy,c.utc(instant))

 def test_oversize_text_is_scanned_and_bounded_not_excluded(self):
  for path in ('docs/e2e/generated/human-e2e-manifest.md','test-results/fixture.json','scripts/phase9/security_acceptance/source-manifest.json','apps/mobile/src/large.ts'):
   with self.subTest(path=path):
    self.assertEqual(c.coverage_kind(path,b'x'*(1024**2+1)),('required','source-text-or-generic-input'))
    self.assertEqual(c.coverage_kind(path,b'x'*(4*1024**2)),('required','source-text-or-generic-input'))
    with self.assertRaisesRegex(c.Rejected,'REQUIRED_SOURCE_EXCEEDS_SCANNER_LIMIT'):
     c.coverage_kind(path,b'x'*(4*1024**2+1))
 def test_scanner_strictness_and_bounded_size_cannot_be_removed(self):
  args=['python','-I','-S','-B','-X','pycache_prefix=C:/temporary','-c',c.SEMGREP_ENTRY,'C:/semgrep','scan','--error','--strict','--oss-only','--metrics=off','--jobs=1','--max-memory=768','--timeout=30','--max-target-bytes=4194304','--json','--output=C:/evidence/semgrep-raw.json']+[v for r in ('owasp-top-ten','typescript','react','secrets') for v in ('--config','C:/evidence/rules/'+r+'.yaml')]+['.',*c.scan_coverage(self.policy)['explicitTargets']]
  c.scanner_scope('semgrep',args)
  for token in ('-I','-S','--strict','--oss-only','--max-target-bytes=4194304'):
   with self.subTest(token=token):
    bad=list(args);bad.remove(token)
    with self.assertRaisesRegex(c.Rejected,'SCANNER_SCOPE_DRIFT'):c.scanner_scope('semgrep',bad)

 def workflow_fixture(self):
  """Synthetic legacy artifacts only; no scanner receipt or approval is made."""
  import workflow_admission as w
  temp=tempfile.TemporaryDirectory(prefix='g97-workflow-unit-');self.addCleanup(temp.cleanup)
  root=pathlib.Path(temp.name);fresh=self.clean_vector();commit='a'*40;run_id='123987'
  needs={name:{'result':'success','outputs':{}} for name in w.JOBS}
  def write(name,value):
   p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(value if isinstance(value,bytes) else c.CANON(value))
  for name,fields in w.JOBS.items():
   obj={field:'success' for field in fields};obj.update(job=name,sha=commit,run_id=run_id)
   if name=='code-gates':obj.update(dependency_sbom='failure',npm_audit_high='failure',npm_exception_gate='failure')
   if name=='secret-scan':obj.update(gitleaks='failure',gitleaks_exit='2')
   if name=='static-analysis':obj.update(osv='failure',osv_exception_gate='failure')
   write(w.MANIFESTS[name],obj)
  write('code/npm-audit-high.json',fresh['npm-installed']['report']);write('code/npm-audit-high.exit-code',b'1\n')
  # Actual source-generated packet; only the unit fixture's clock is refreshed.
  execution=c.load(c.HERE,'legacy-sbom-fixture.json.gz');sbom=execution['packet'];sbom['generatedAt']=c.now().isoformat(timespec='milliseconds').replace('+00:00','Z')
  write('code/dependency-inventory.json',sbom);write('code/dependency-sbom.exit-code',b'1\n')
  write('code/dependency-sbom-audit.json',execution['audit']);write('code/dependency-sbom-audit.exit-code',b'1\n')
  for mode,refusal in execution['policyRefusals'].items():
   folder='code' if mode=='npm' else 'static'
   for suffix,key in [('.stdout','stdout'),('.stderr','stderr'),('.exit-code','exit')]:write(folder+'/'+mode+'-exception-gate'+suffix,(str(refusal[key])+('\n' if key=='exit' else '')).encode())
  write('static/osv-scan.exit-code',str(fresh['osv']['exit']).encode()+b'\n')
  write('static/osv-scan.json',fresh['osv']['report'])
  write('secret/gitleaks-tool.json',{'version':'8.24.3','sha256':self.policy['toolBytes']['gitleaks'][0],'exit':0})
  findings=[{'ruleId':item['RuleID'],'partialFingerprints':{'commitSha':item['Commit']},'locations':[{'physicalLocation':{'artifactLocation':{'uri':item['File']},'region':{'startLine':item['StartLine'],'endLine':item['EndLine'],'snippet':{'text':'REDACTED'}}}}]} for item in fresh['gitleaks']['report'][:2]]
  write('secret/gitleaks-results.sarif',{'$schema':'https://json.schemastore.org/sarif-2.1.0.json','version':'2.1.0','runs':[{'tool':{'driver':{'name':'gitleaks','semanticVersion':'v8.0.0'}},'results':findings}]})
  # New original-secret diagnostic fixture only. Actual source/ref validation is
  # exercised against >30 real Git commits in test_secret_scan, never mocked there.
  from unittest import mock
  from test_secret_scan import synthetic_proof
  scope=dict(head=commit,tree='b'*40,parents=[],refs=['refs/heads/synthetic '+commit],
             commits=[commit],snapshot=[],snapshot_sha256=w.secret_scan.sha(b'[]'))
  patch=mock.patch.object(w.secret_scan,'git_scope',return_value=scope);patch.start();self.addCleanup(patch.stop)
  proof,sarif=synthetic_proof(scope,run_id,findings)
  write('secret/gitleaks-results.sarif',sarif);write('secret/'+w.secret_scan.PROOF,proof)
  return w,root,needs,commit,run_id,fresh
 def test_original_workflow_sbom_unrelated_failure_or_fabrication_rejects(self):
  w,root,needs,commit,run_id,fresh=self.workflow_fixture();p=root/'code/dependency-inventory.json';original=p.read_bytes()
  for action in ('blocker','counts','packages','provenance','signoff','stale'):
   value=c.parse_json(original)
   if action=='blocker':value['blockers'].append('Unexpected dependency install scripts detected.')
   elif action=='counts':value['vulnerabilities']['total']+=1
   elif action=='packages':value['packages'].pop()
   elif action=='provenance':value['auditProvenance']['completed']=False
   elif action=='signoff':value['warnings']=[]
   else:value['generatedAt']='2026-10-17T00:00:00.000Z'
   p.write_bytes(c.CANON(value))
   with self.subTest(action=action):
    with self.assertRaisesRegex(c.Rejected,'SBOM_UNRELATED_FAILURE'):w.original_jobs(root,needs,commit,run_id,fresh)
  p.write_bytes(original)
 def test_original_workflow_sbom_execution_exit_cannot_be_waived(self):
  w,root,needs,commit,run_id,fresh=self.workflow_fixture();p=root/'code/dependency-sbom.exit-code'
  for name in ('dependency-sbom.exit-code','dependency-sbom-audit.exit-code'):
   p=root/'code'/name
   for exit in ('0','2','127','137','143','true',''):
    p.write_text(exit)
    with self.subTest(file=name,exit=exit):
     with self.assertRaisesRegex(c.Rejected,'NONREGULAR_INPUT' if exit=='' else 'SBOM_(AUDIT_)?EXECUTION_ERROR'):w.original_jobs(root,needs,commit,run_id,fresh)
   p.write_text('1\n')
 def test_original_workflow_osv_execution_error_with_known_json_rejects(self):
  w,root,needs,commit,run_id,fresh=self.workflow_fixture();p=root/'static/osv-scan.exit-code'
  for exit in ('0','2','127','137','143','true',''):
   p.write_text(exit)
   with self.subTest(exit=exit):
    with self.assertRaisesRegex(c.Rejected,'NONREGULAR_INPUT' if exit=='' else 'OSV_(EXECUTION_ERROR|EXIT_DRIFT)'):w.original_jobs(root,needs,commit,run_id,fresh)
 def test_original_workflow_legacy_fetch_execution_or_extra_refusal_cannot_be_waived(self):
  w,root,needs,commit,run_id,fresh=self.workflow_fixture()
  for folder,mode in [('code','npm'),('static','osv')]:
   for suffix,value in [('.stderr','security review source returned HTTP 503\n'),('.stderr','braces: a newer release requires security review\n'),('.exit-code','127\n'),('.stdout','fabricated success\n')]:
    p=root/folder/(mode+'-exception-gate'+suffix);original=p.read_bytes();p.write_text(value)
    with self.subTest(mode=mode,suffix=suffix):
     with self.assertRaisesRegex(c.Rejected,'LEGACY_POLICY_REFUSAL_DRIFT'):w.original_jobs(root,needs,commit,run_id,fresh)
    p.write_bytes(original)
 def test_original_workflow_actual_gitleaks_tool_cannot_borrow_SARIF_placeholder(self):
  w,root,needs,commit,run_id,fresh=self.workflow_fixture();p=root/'secret/gitleaks-tool.json';original=p.read_bytes()
  for field,value in [('version','8.0.0'),('version','8.24.2'),('sha256','0'*64),('exit',127),('exit',True)]:
   changed=c.parse_json(original);changed[field]=value;p.write_bytes(c.CANON(changed))
   with self.subTest(field=field,value=value):
    with self.assertRaisesRegex(c.Rejected,'GITLEAKS_TOOL_IDENTITY_DRIFT'):w.original_jobs(root,needs,commit,run_id,fresh)
  p.write_bytes(original)
 def test_original_workflow_valid_known_artifacts_are_technical_only(self):
  w,root,needs,commit,run_id,fresh=self.workflow_fixture()
  result=w.original_jobs(root,needs,commit,run_id,fresh)
  self.assertEqual(result['sourceCommit'],commit);self.assertEqual(result['runId'],run_id)
  self.assertEqual(result['eventRangeHistoricalFindings'],2);self.assertEqual(set(result['files']),w.LEGACY_FILES|w.SECRET_FILES)
  self.assertNotIn('acceptanceGranted',result);self.assertNotIn('signature',result)
 def test_original_workflow_missing_extra_failed_skipped_cancelled_jobs_reject(self):
  w,root,needs,commit,run_id,fresh=self.workflow_fixture()
  for action in ('missing','extra','failure','skipped','cancelled','outputs'):
   with self.subTest(action=action):
    changed=copy.deepcopy(needs)
    if action=='missing':changed.pop('code-gates')
    elif action=='extra':changed['alternate-green']={'result':'success','outputs':{}}
    elif action=='outputs':changed['code-gates']['outputs']={'approval':'claimed'}
    else:changed['code-gates']['result']=action
    with self.assertRaises(c.Rejected):w.original_jobs(root,changed,commit,run_id,fresh)
 def test_original_workflow_wrong_source_run_schema_or_unrelated_check_rejects(self):
  w,root,needs,commit,run_id,fresh=self.workflow_fixture()
  for name,field,value in [('code-gates','sha','b'*40),('secret-scan','run_id','999'),('static-analysis','semgrep','failure'),('secret-scan','trufflehog','failure'),('code-gates','phase9_verify','skipped'),('code-gates','dependency_sbom','success'),('static-analysis','osv_exception_gate','success'),('code-gates','npm_exception_gate','success'),('code-gates','npm_audit_high',True)]:
   p=root/w.MANIFESTS[name];original=p.read_bytes();obj=c.parse_json(original);obj[field]=value;p.write_bytes(c.CANON(obj))
   with self.subTest(job=name,field=field):
    with self.assertRaises(c.Rejected):w.original_jobs(root,needs,commit,run_id,fresh)
   p.write_bytes(original)
 def test_original_workflow_omitted_added_or_linked_artifacts_reject(self):
  w,root,needs,commit,run_id,fresh=self.workflow_fixture()
  for name in w.LEGACY_FILES:
   p=root/name;original=p.read_bytes();p.unlink()
   with self.subTest(missing=name):
    with self.assertRaises((c.Rejected,FileNotFoundError)):w.original_jobs(root,needs,commit,run_id,fresh)
   p.write_bytes(original)
  p=root/'alternate-green.json';p.write_text('{}')
  with self.assertRaisesRegex(c.Rejected,'INVENTORY_DRIFT'):w.original_jobs(root,needs,commit,run_id,fresh)
  p.unlink()
  p=root/'secret/secret-scan-outcomes.json';original=p.read_bytes();p.unlink();target=root/'linked-target.json';target.write_bytes(original);p.symlink_to(target)
  with self.assertRaisesRegex(c.Rejected,'LINKED_INPUT'):w.original_jobs(root,needs,commit,run_id,fresh)
 def test_original_workflow_unknown_npm_or_osv_finding_rejects(self):
  w,root,needs,commit,run_id,fresh=self.workflow_fixture()
  p=root/'code/npm-audit-high.json';original=p.read_bytes();obj=c.parse_json(original);obj['vulnerabilities']['braces']['via'][0]['url']='https://github.com/advisories/GHSA-aaaa-bbbb-cccc';p.write_bytes(c.CANON(obj))
  with self.assertRaisesRegex(c.Rejected,'NPM_FINDING_DRIFT'):w.original_jobs(root,needs,commit,run_id,fresh)
  p.write_bytes(original)
  p=root/'static/osv-scan.json';obj=c.load(root,'static/osv-scan.json');obj['results'][0]['packages'][0]['vulnerabilities'][0]['id']='GHSA-aaaa-bbbb-cccc';p.write_bytes(c.CANON(obj))
  with self.assertRaisesRegex(c.Rejected,'OSV_FINDING_DRIFT'):w.original_jobs(root,needs,commit,run_id,fresh)
 def test_original_workflow_gitleaks_errors_new_duplicate_or_forged_findings_reject(self):
  w,root,needs,commit,run_id,fresh=self.workflow_fixture();p=root/'secret/gitleaks-results.sarif';original=p.read_bytes()
  for action in ('unknown','duplicate','range','version','unredacted','empty'):
   obj=c.parse_json(original);run=obj['runs'][0]
   if action=='unknown':run['results'][0]['ruleId']='unknown-rule'
   elif action=='duplicate':run['results'].append(copy.deepcopy(run['results'][0]))
   elif action=='range':run['results'][0]['locations'][0]['physicalLocation']['region']['endLine']+=1
   elif action=='version':run['tool']['driver']['semanticVersion']='0.0.0'
   elif action=='unredacted':run['results'][0]['locations'][0]['physicalLocation']['region']['snippet']['text']='synthetic-not-redacted'
   else:run['results']=[]
   p.write_bytes(c.CANON(obj))
   with self.subTest(action=action):
    with self.assertRaises(c.Rejected):w.original_jobs(root,needs,commit,run_id,fresh)
  p.write_bytes(original)
  p=root/'secret/secret-scan-outcomes.json';obj=c.load(root,'secret/secret-scan-outcomes.json');obj['gitleaks_exit']='1';p.write_bytes(c.CANON(obj))
  with self.assertRaisesRegex(c.Rejected,'EXECUTION_ERROR'):w.original_jobs(root,needs,commit,run_id,fresh)
 def test_owner_decision_digest_changes_for_any_original_raw_byte_change(self):
  w,root,needs,commit,run_id,fresh=self.workflow_fixture();before=w.original_jobs(root,needs,commit,run_id,fresh)
  p=root/'code/npm-audit-high.json';p.write_bytes(p.read_bytes()+b'\n')
  after=w.original_jobs(root,needs,commit,run_id,fresh)
  self.assertNotEqual(c.SHA(c.CANON(before)),c.SHA(c.CANON(after)))
  self.assertEqual(before['outcomes'],after['outcomes']);self.assertNotEqual(before['files'],after['files'])


 def test_physical_evidence_extra_missing_link_and_hardlink_reject(self):
  with tempfile.TemporaryDirectory(prefix='g97-inventory-unit-') as d:
   root=pathlib.Path(d);(root/'receipt.json').write_text('{}');p=root/'report.json';p.write_text('{}')
   expected={'receipt.json','report.json'};c.verify_artifact_inventory(root,expected)
   extra=root/'unreported-scanner.json';extra.write_text('{}')
   with self.assertRaisesRegex(c.Rejected,'INVENTORY_DRIFT'):c.verify_artifact_inventory(root,expected)
   extra.unlink();p.unlink()
   with self.assertRaisesRegex(c.Rejected,'INVENTORY_DRIFT'):c.verify_artifact_inventory(root,expected)
   p.symlink_to(root/'receipt.json')
   with self.assertRaisesRegex(c.Rejected,'NONREGULAR_EVIDENCE'):c.verify_artifact_inventory(root,expected)
   p.unlink();os.link(root/'receipt.json',p)
   with self.assertRaisesRegex(c.Rejected,'NONREGULAR_EVIDENCE'):c.verify_artifact_inventory(root,expected)
 def test_owner_receipt_loader_rejects_duplicate_nonfinite_oversize_and_links(self):
  with tempfile.TemporaryDirectory(prefix='g97-owner-json-unit-') as d:
   root=pathlib.Path(d);p=root/'approval.json';p.write_text('{}');self.assertEqual(c.parse_json(c.safe(p.parent,p.name,limit=65536)),{})
   for body,code in [(b'{"payload":{},"payload":{},"signature":""}','DUPLICATE_JSON_FIELD'),(b'{"payload":NaN}','NONFINITE_JSON'),(b' '*65537,'NONREGULAR_INPUT')]:
    p.write_bytes(body)
    with self.subTest(code=code):
     with self.assertRaisesRegex(c.Rejected,code):c.parse_json(c.safe(p.parent,p.name,limit=65536))
   target=root/'actual.json';target.write_text('{}');p.unlink();p.symlink_to(target)
   with self.assertRaisesRegex(c.Rejected,'LINKED_INPUT'):c.parse_json(c.safe(p.parent,p.name,limit=65536))

 def test_SAST_engine_substitution_or_skipped_rules_rejects(self):
  for field,value in [('engine_requested','PRO_INTERFILE'),('skipped_rules',[{'rule_id':'omitted-required-rule'}])]:
   v=self.clean_vector();v['semgrep']['report'][field]=value
   with self.subTest(field=field):
    with self.assertRaisesRegex(c.Rejected,'SEMGREP_INCOMPLETE'):c.records(v,self.policy)
 def test_SAST_diagnostics_reject_even_with_current_version_and_exact_paths(self):
  for field in ('parsing','taint'):
   v=self.clean_vector()
   if field=='parsing':v['semgrep']['report']['errors']=copy.deepcopy(self.actual['semgrep']['report']['errors']);self.assertTrue(v['semgrep']['report']['errors'])
   else:v['semgrep']['report']['time']['fixpoint_timeouts']=copy.deepcopy(self.actual['semgrep']['report']['time']['fixpoint_timeouts']);self.assertTrue(v['semgrep']['report']['time']['fixpoint_timeouts'])
   with self.subTest(field=field):
    with self.assertRaisesRegex(c.Rejected,'SEMGREP_INCOMPLETE'):c.records(v,self.policy)

 def engine_archive_fixture(self,entries):
  import gzip,io,tarfile
  out=io.BytesIO()
  with tarfile.open(fileobj=out,mode='w',format=tarfile.USTAR_FORMAT) as tar:
   for name,body,kind in entries:
    info=tarfile.TarInfo(name)
    if kind=='file':info.size=len(body);tar.addfile(info,io.BytesIO(body))
    else:info.type=tarfile.SYMTYPE if kind=='symlink' else tarfile.LNKTYPE;info.linkname='../outside';tar.addfile(info)
  return gzip.compress(out.getvalue(),mtime=0)
 def test_engine_archive_paths_links_duplicates_omissions_bytes_and_size_reject(self):
  import bootstrap_tools as b
  good=[('semgrep-core',b'new-core','file'),('libs/libunit.so',b'new-library','file')]
  expected={name:{'bytes':len(body),'sha256':c.SHA(body)} for name,body,kind in good}
  with tempfile.TemporaryDirectory(prefix='g97-engine-archive-unit-') as d:
   root=pathlib.Path(d);target=root/'positive';target.mkdir();b.engine_members(self.engine_archive_fixture(good),expected,target)
   self.assertEqual((target/'semgrep-core').read_bytes(),b'new-core')
   cases={'unknown':good+[('unreviewed',b'x','file')],'missing':good[:1],'duplicate':good+[good[0]],'symlink':[('semgrep-core',b'','symlink'),good[1]],'hardlink':[('semgrep-core',b'','hardlink'),good[1]],'bytes':[('semgrep-core',b'new-CORE','file'),good[1]],'escape':good+[('../outside',b'x','file')]}
   for name,entries in cases.items():
    target=root/name;target.mkdir();reviewed=copy.deepcopy(expected)
    if name=='escape':reviewed['../outside']={'bytes':1,'sha256':c.SHA(b'x')}
    with self.subTest(case=name):
     with self.assertRaises(c.Rejected):b.engine_members(self.engine_archive_fixture(entries),reviewed,target)
   self.assertFalse((root/'outside').exists())
   import gzip,tarfile
   info=tarfile.TarInfo('semgrep-core');info.size=384*1024**2+1
   raw=gzip.compress(info.tobuf(format=tarfile.USTAR_FORMAT)+b'\0'*1024,mtime=0);target=root/'oversize';target.mkdir()
   with self.assertRaisesRegex(c.Rejected,'SIZE_DRIFT'):b.engine_members(raw,{'semgrep-core':{'bytes':info.size,'sha256':'0'*64}},target)
 def test_engine_install_preserves_original_and_rejects_source_drift_before_move(self):
  import bootstrap_tools as b
  with tempfile.TemporaryDirectory(prefix='g97-engine-install-unit-') as d:
   root=pathlib.Path(d);entries=[('semgrep-core',b'non-executable-new-unit-fixture','file'),('libs/libunit.so',b'unit-library','file')]
   archive=root/'engine.tar.gz';archive.write_bytes(self.engine_archive_fixture(entries))
   def fixture(name):
    site=root/name;(site/'semgrep/bin/libs').mkdir(parents=True);(site/'semgrep/bin/semgrep-core').write_bytes(b'non-executable-upstream-unit-fixture');(site/'semgrep/bin/libs/original.so').write_bytes(b'original-library')
    profile={'originalPackageTree':c.tool_tree(site,python_site=True),'originalCoreSha256':c.SHA(b'non-executable-upstream-unit-fixture'),'archiveSha256':c.SHA(archive.read_bytes()),'portableCoreSha256':c.SHA(entries[0][1]),'members':{name:{'bytes':len(body),'sha256':c.SHA(body)} for name,body,kind in entries}}
    return site,profile
   site,profile=fixture('positive');preserved=root/'preserved';b.install_engine(site,archive,profile,preserved)
   self.assertEqual((site/'semgrep/bin/semgrep-core').read_bytes(),entries[0][1]);self.assertEqual((preserved/'semgrep-core.official-upstream').read_bytes(),b'non-executable-upstream-unit-fixture');self.assertEqual((preserved/'official-upstream-libs/original.so').read_bytes(),b'original-library')
   for name in ('archive','original','member'):
    site,profile=fixture(name);preserved=root/(name+'-preserved')
    if name=='archive':profile['archiveSha256']='0'*64
    elif name=='original':(site/'semgrep/bin/semgrep-core').write_bytes(b'unreviewed original')
    else:profile['members']['semgrep-core']['sha256']='0'*64
    with self.subTest(case=name):
     with self.assertRaises(c.Rejected):b.install_engine(site,archive,profile,preserved)
    if name=='member':self.assertEqual((preserved/'semgrep-core.official-upstream').read_bytes(),b'non-executable-upstream-unit-fixture')
    else:self.assertFalse(preserved.exists())



 def test_current_history_includes_new_source_recomputed_ruleset_digest(self):
  result=c.history(c.ROOT,self.actual['gitleaks']['report']);self.assertEqual(result['records'],3265);self.assertEqual(result['unverified'],0)
 def test_new_ruleset_digest_cannot_authorize_changed_rule_bytes(self):
  rows=[r for r in c.load(c.HERE,'history.json.gz') if r['technical_disposition']=='PINNED_SCANNER_RULESET_DIGEST']
  fresh=[r for r in self.actual['gitleaks']['report'] if r['Fingerprint'] in {w['id'] for w in rows}]
  changed=dict(self.policy['rules']);changed['secrets']='0'*64
  with self.assertRaisesRegex(ValueError,'HISTORICAL_RULESET_DIGEST_PROOF_FAILED'):h.verify_history(c.ROOT,fresh,rows,c.safe(c.HERE,'gitleaks.toml').decode(),changed)
 def test_scanner_network_listener_guard_rejects_real_IP_bind_and_allows_Unix_engine_socket(self):
  with tempfile.TemporaryDirectory() as directory:
   code=c.SCANNER_BIND_GUARD+"\ns=socket.socket();s.bind(('127.0.0.1',0))"
   rejected=subprocess.run([sys.executable,'-B','-c',code],capture_output=True)
   self.assertNotEqual(rejected.returncode,0);self.assertIn(b'G97_SCANNER_INTERNET_LISTENER_FORBIDDEN',rejected.stderr)
   code=c.SCANNER_BIND_GUARD+"\ns=socket.socket(socket.AF_UNIX);s.bind(sys.argv[1]);print('ACTUAL_UNIX_BIND_PASSED')"
   positive=subprocess.run([sys.executable,'-B','-c',code,str(pathlib.Path(directory)/'engine.sock')],capture_output=True)
   self.assertEqual(positive.returncode,0);self.assertIn(b'ACTUAL_UNIX_BIND_PASSED',positive.stdout)
 def test_OSV_scanner_dependency_lock_cannot_be_omitted_or_substituted(self):
  for action in ('omit','substitute','duplicate'):
   v=self.clean_vector();rows=v['osv']['report']['results']
   if action=='omit':rows.pop()
   elif action=='substitute':rows[-1]['source']['path']='/unknown/requirements.txt'
   else:rows.append(copy.deepcopy(rows[-1]))
   with self.assertRaises(c.Rejected):c.records(v,self.policy)
 def test_initial_audit_may_be_a_source_bound_subset_but_keeps_all_primary_roots(self):
  v=self.clean_vector();records=v['npm-initial']['report']['vulnerabilities'];v['npm-initial']['report']['vulnerabilities']={name:r for name,r in records.items() if r['via'] and any(isinstance(x,dict) for x in r['via'])}
  obj=v['npm-initial']['report'];obj['metadata']['vulnerabilities']={'info':0,'low':0,'moderate':0,'high':len(obj['vulnerabilities']),'critical':0,'total':len(obj['vulnerabilities'])}
  c.records(v,self.policy)
 def test_initial_audit_cannot_hide_new_changed_or_missing_primary_records(self):
  for action in ('new','path','root','count','boolean'):
   v=self.clean_vector();obj=v['npm-initial']['report'];rows=obj['vulnerabilities']
   if action=='new':
    item=copy.deepcopy(rows['braces']);item.update(name='injected-package',nodes=['node_modules/injected-package']);rows['injected-package']=item
   elif action=='path':rows['braces']['nodes']=['node_modules/substituted-braces']
   elif action=='root':obj['vulnerabilities']={'braces':rows['braces']}
   elif action=='count':obj['metadata']['vulnerabilities']['high']+=1
   else:obj['metadata']['vulnerabilities']['total']=True
   with self.subTest(action=action):
    with self.assertRaises(c.Rejected):c.records(v,self.policy)
 def test_current_source_findings_reproduce_typed_proofs_without_refreshing_retained_QA(self):
  raw=self.actual['gitleaks-current']['report'];prefix=raw[0]['File'].split('/current-source/',1)[0]+'/current-source'
  result,refs,witnesses=h.verify_current(c.ROOT,raw,prefix,'569a16d07c0103e0c019f35e384a278671f2a76f',c.load(c.HERE,'history.json.gz'),c.safe(c.HERE,'gitleaks.toml').decode(),self.policy['rules'])
  self.assertEqual(result['records'],1107);self.assertEqual(result['unverified'],0);self.assertFalse(result['historicalQARefreshed']);self.assertEqual(result['retainedReferencedSourceDigests'],13);self.assertEqual(result['exactRetainedSyntheticPayloads'],1)
 def test_current_source_report_rejects_path_range_redaction_duplicate_and_findings_drift(self):
  for action in ('path','range','redaction','duplicate','verified'):
   v=self.clean_vector();rows=v['gitleaks-current']['report']
   if action=='path':rows[0]['File']=rows[0]['File'].replace('/current-source/','/substituted-source/')
   elif action=='range':rows[0]['StartLine']=True
   elif action=='redaction':rows[0]['Secret']='SYNTHETIC-UNREDACTED-FIXTURE'
   elif action=='duplicate':rows[0]=copy.deepcopy(rows[1])
   else:v['trufflehog-current']['report']=[{'Verified':True,'Raw':'SYNTHETIC-FIXTURE'}]
   with self.subTest(action=action):
    with self.assertRaises(c.Rejected):c.records(v,self.policy)
 def test_current_QA_digest_cannot_borrow_an_unrelated_historical_source_reference(self):
  raw=self.actual['gitleaks-current']['report'];prefix=raw[0]['File'].split('/current-source/',1)[0]+'/current-source';rows=c.load(c.HERE,'history.json.gz')
  for row in rows:
   if row['technical_disposition']=='RECOMPUTED_SOURCE_FILE_DIGEST':row['proof']['referenced_source_path']='NONEXISTENT/substituted-reference.mjs'
  with self.assertRaises((ValueError,KeyError,subprocess.SubprocessError)):h.verify_current(c.ROOT,raw,prefix,'569a16d07c0103e0c019f35e384a278671f2a76f',rows,c.safe(c.HERE,'gitleaks.toml').decode(),self.policy['rules'])
 def test_scanner_startup_ignores_actual_ambient_module_injection(self):
  with tempfile.TemporaryDirectory(prefix='g97-python-startup-unit-') as directory:
   root=pathlib.Path(directory);(root/'socket.py').write_text('raise RuntimeError("UNREVIEWED_AMBIENT_MODULE_EXECUTED")')
   environment={**os.environ,'PYTHONPATH':str(root)}
   negative=subprocess.run([sys.executable,'-B','-S','-c','import socket'],cwd=root,env=environment,capture_output=True)
   self.assertNotEqual(negative.returncode,0);self.assertIn(b'UNREVIEWED_AMBIENT_MODULE_EXECUTED',negative.stderr)
   positive=subprocess.run([sys.executable,'-I','-S','-B','-c',c.SCANNER_BIND_GUARD+"\nprint(sys.flags.isolated,sys.flags.no_site)"],cwd=root,env=environment,capture_output=True)
   self.assertEqual(positive.returncode,0);self.assertEqual(positive.stdout.strip(),b'1 1');self.assertNotIn(b'UNREVIEWED_AMBIENT_MODULE_EXECUTED',positive.stderr)

 def test_standalone_accept_and_external_approval_options_are_retired(self):
  for path,args in [('contract.py',['accept']),('workflow_admission.py',['accept','--approval','forged.json'])]:
   process=subprocess.run([sys.executable,'-B',str(c.HERE/path),*args],capture_output=True)
   self.assertNotEqual(process.returncode,0)
   self.assertNotIn(b'SOURCE_ONLY_ACCEPTED',process.stdout)
 def test_automated_policy_refuses_absent_extra_or_false_typed_scope(self):
  clock=c.utc('2026-10-19T12:00:00Z')
  for value in (None,{}, {**c.AUTOMATED_SCOPE,'unreviewed':True},{**c.AUTOMATED_SCOPE,'externalSignatureRequired':0}):
   changed={**self.policy,'acceptance':value}
   with self.assertRaisesRegex(c.Rejected,'SCOPE_DRIFT'):c.validate_policy(changed,clock)

 def test_collector_refuses_outputs_inside_reviewed_source_before_creating_files(self):
  path=c.ROOT/'g97-invalid-inside-source-output'
  self.assertFalse(path.exists())
  with self.assertRaisesRegex(c.Rejected,'EVIDENCE_INSIDE_REVIEWED_SOURCE'):
   collect.collect(c.ROOT,c.ROOT,path,{},self.policy)
  self.assertFalse(path.exists())

 def test_automated_reviewed_source_pins_are_required_exact_and_typed(self):
  import workflow_admission as w
  commit=c.git(c.ROOT,'rev-parse','HEAD').decode().strip();digest=c.SHA(c.CANON(self.policy))
  self.assertEqual(w.reviewed_source_pins(self.policy,commit,commit,digest),{'sourceCommit':commit,'proposalSha256':digest})
  for expected,proposal,code in [(None,None,'PINS_REQUIRED'),('',digest,'PINS_REQUIRED'),(commit,None,'PINS_REQUIRED'),('0'*40,digest,'COMMIT_DRIFT'),(commit,'0'*64,'PROPOSAL_DRIFT')]:
   with self.subTest(code=code),self.assertRaisesRegex(c.Rejected,code):w.reviewed_source_pins(self.policy,commit,expected,proposal)
 def test_recomputed_source_manifest_or_policy_cannot_rebind_owner_pins(self):
  import workflow_admission as w
  commit=c.git(c.ROOT,'rev-parse','HEAD').decode().strip();digest=c.SHA(c.CANON(self.policy))
  changed=copy.deepcopy(self.policy);changed['sourceManifest']='f'*64
  with self.assertRaisesRegex(c.Rejected,'PROPOSAL_DRIFT'):w.reviewed_source_pins(changed,commit,commit,digest)
  prior=c.git(c.ROOT,'rev-parse','HEAD^').decode().strip()
  with self.assertRaisesRegex(c.Rejected,'COMMIT_DRIFT'):w.reviewed_source_pins(changed,prior,commit,digest)


 def history_link(self,row,plain=False):
  base='https://github.com/TasfiqJ/onSkin/blob/'+row['Commit']+'/'+row['File']
  return base+('?plain=1' if plain else '')+'#L'+str(row['StartLine'])+('-L'+str(row['EndLine']) if row['EndLine']!=row['StartLine'] else '')
 def test_history_GitHub_links_are_source_bound_and_raw_records_stay_unchanged(self):
  v=self.clean_vector()
  for row in v['gitleaks']['report']:row['Link']=self.history_link(row,row['File'].endswith('.md'))
  original=copy.deepcopy(v);c.records(v,self.policy);self.assertEqual(v,original)
  self.assertTrue(any(row['StartLine']!=row['EndLine'] for row in v['gitleaks']['report']))
  self.assertTrue(any('?plain=1#' in row['Link'] for row in v['gitleaks']['report']))
 def test_history_GitHub_links_reject_forged_targets_coordinates_queries_and_types(self):
  original=self.clean_vector();row=original['gitleaks']['report'][0];valid=self.history_link(row)
  attacks=[None,False,1,{},'',valid.replace('https:','http:',1),valid.replace('github.com','github.com.invalid',1),valid.replace('/TasfiqJ/onSkin/','/other/repository/',1),valid.replace(row['Commit'],'0'*40,1),valid.replace('/blob/','/tree/',1),valid.replace('/'+row['File'],'/different-file',1),valid+'-L999999',valid+'?unreviewed=1',valid+'\n',valid.replace('#L','#L0',1),'https://user@github.com/TasfiqJ/onSkin/blob/'+row['Commit']+'/'+row['File']+'#L'+str(row['StartLine'])]
  for link in attacks:
   with self.subTest(link=repr(link)):
    v=copy.deepcopy(original);v['gitleaks']['report'][0]['Link']=link
    with self.assertRaisesRegex(c.Rejected,'HISTORY_LINK'):c.records(v,self.policy)
  multi=next(x for x in original['gitleaks']['report'] if x['StartLine']!=x['EndLine'])
  v=copy.deepcopy(original);found=next(x for x in v['gitleaks']['report'] if x['Fingerprint']==multi['Fingerprint']);found['Link']=self.history_link(found).replace('-L'+str(found['EndLine']),'')
  with self.assertRaisesRegex(c.Rejected,'HISTORY_LINK'):c.records(v,self.policy)
 def test_valid_history_link_cannot_authorize_changed_finding_payload(self):
  for field,value in [('Commit','0'*40),('File','different-source'),('StartLine',999),('EndLine',999),('Author','changed'),('Message','changed'),('Entropy',0),('EndColumn',999)]:
   with self.subTest(field=field):
    v=self.clean_vector();row=v['gitleaks']['report'][0];row[field]=value
    if field=='StartLine':row['EndLine']=999
    row['Link']=self.history_link(row)
    with self.assertRaisesRegex(c.Rejected,'SCANNER_RECORD_DRIFT:gitleaks'):c.records(v,self.policy)
 def test_history_link_projection_preserves_unknown_fields_and_schema_refusals(self):
  for field in ('unreviewedMetadata','link'):
   v=self.clean_vector();row=v['gitleaks']['report'][0];row['Link']=self.history_link(row);row[field]='unreviewed'
   with self.assertRaisesRegex(c.Rejected,'SCANNER_RECORD_DRIFT:gitleaks'):c.records(v,self.policy)
  for field,value in [('StartLine',True),('EndLine',False),('File',None),('Commit',None)]:
   v=self.clean_vector();row=v['gitleaks']['report'][0];row['Link']=self.history_link(row);row[field]=value
   with self.assertRaisesRegex(c.Rejected,'HISTORY_LINK_SOURCE_DRIFT'):c.records(v,self.policy)

if __name__=='__main__':unittest.main(verbosity=2)
