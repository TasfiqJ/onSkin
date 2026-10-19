"""Adversarial unit tests. All fixtures/vectors grant NO scanner acceptance.

The Semgrep target list is synthetic current-scope test data; retained warnings
remain intact. Neither this fixture nor its clean vector is a scanner receipt.
"""
import base64,copy,datetime,hashlib,json,os,pathlib,shutil,subprocess,sys,tempfile,unittest
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
  v['semgrep']['report'].setdefault('time',{})['fixpoint_timeouts']=[];return v
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
  result=c.history(c.ROOT,self.actual['gitleaks']['report']);self.assertEqual(result['records'],3264);self.assertEqual(result['unverified'],0)
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
   data=c.CANON(value['report']) if name!='trufflehog' else b''
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
  sg=['python','-B','-X','pycache_prefix=C:/temporary','-c',c.SEMGREP_ENTRY,'C:/semgrep','scan','--error','--metrics=off','--jobs=1','--max-memory=768','--timeout=30','--json','--output=C:/evidence/semgrep-raw.json']+[v for r in ('owasp-top-ten','typescript','react','secrets') for v in ('--config','C:/evidence/rules/'+r+'.yaml')]+['.',*c.scan_coverage(self.policy)['explicitTargets']]
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
    (root/'.git/info/exclude').write_text('.semgrepignore\n')
    for action in ('change','missing','extra','policy','ignored-ignore-file'):
     p=root/('source.txt' if action in ('change','missing') else 'extra.txt' if action=='extra' else '.semgrepignore' if action=='ignored-ignore-file' else 'docs/phase-9/security-advisory-exceptions.json');before=p.read_bytes() if p.exists() else None
     if action=='missing':p.unlink()
     else:p.write_text('unreviewed')
     if action=='ignored-ignore-file':
      with self.assertRaisesRegex(c.Rejected,'UNREVIEWED_SCAN_IGNORE'):c.source(root,policy)
     else:
      with self.assertRaises(c.Rejected):c.source(root,policy)
     if before is None:p.unlink()
     else:p.write_bytes(before)
   finally:c.HERE=saved
 def test_owner_receipt_requires_exact_binding_signature_and_time(self):
  # Ephemeral TEST key only, held in memory; no private bytes enter reports.
  script="const c=require('node:crypto'),k=c.generateKeyPairSync('ed25519');process.stdout.write(JSON.stringify({pub:k.publicKey.export({format:'pem',type:'spki'}),priv:k.privateKey.export({format:'pem',type:'pkcs8'})}))"
  keys=json.loads(subprocess.check_output(['node','-e',script]));clock=c.utc('2026-10-18T20:00:00Z')
  payload={'schema':1,'proposalSha256':c.SHA(c.CANON(self.policy)),'sourceTree':'a'*40,'evidenceSha256':'b'*64,'decision':'ACCEPT_EXACT_G97_SOURCE_MITIGATIONS_ONLY','notBefore':'2026-10-18T19:00:00Z','notAfter':'2026-10-19T19:00:00Z','reviewer':'independent-test-owner','reviewReference':'SYNTHETIC UNIT TEST ONLY; NO ACTUAL APPROVAL'}
  def signed(p):
   code="const c=require('node:crypto');let b='';process.stdin.on('data',s=>b+=s);process.stdin.on('end',()=>{const x=JSON.parse(b);process.stdout.write(c.sign(null,Buffer.from(x.body,'base64'),x.key).toString('base64'))})"
   return {'payload':p,'signature':subprocess.check_output(['node','-e',code],input=c.CANON({'key':keys['priv'],'body':base64.b64encode(c.CANON(p)).decode()})).decode()}
  receipt=signed(payload);c.approval(receipt,keys['pub'],self.policy,'a'*40,'b'*64,clock)
  for field,value in [('schema',True),('sourceTree','c'*40),('evidenceSha256','c'*64),('proposalSha256','c'*64),('notAfter','2026-10-22T00:00:00Z'),('notAfter','2026-10-18T19:59:59Z'),('decision','ACCEPT_ALL_SECURITY')]:
   p={**payload,field:value}
   with self.subTest(field=field,value=value):
    with self.assertRaises(c.Rejected):c.approval(signed(p),keys['pub'],self.policy,'a'*40,'b'*64,clock)
  bad=copy.deepcopy(receipt);bad['signature']=base64.b64encode(bytes(64)).decode()
  with self.assertRaisesRegex(c.Rejected,'SIGNATURE'):c.approval(bad,keys['pub'],self.policy,'a'*40,'b'*64,clock)
  with self.assertRaises(c.Rejected):c.approval({},keys['pub'],self.policy,'a'*40,'b'*64,clock)

if __name__=='__main__':unittest.main(verbosity=2)
