"""G97 exact-source technical evidence. Raw scanner failures remain visible.

Only the original Security workflow adapter may grant automated source-only
acceptance after validating its complete same-run original artifact set.
No independent human approval, signature, integration, DB replay or release
clearance is represented by these checks.
"""
import argparse,base64,datetime,difflib,gzip,hashlib,io,json,os,pathlib,re,stat,subprocess,sys,tarfile
sys.dont_write_bytecode=True

HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[2]
SHA=lambda b:hashlib.sha256(b).hexdigest()
CANON=lambda v:json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=True).encode()
class Rejected(ValueError):pass
def require(ok,code):
 if not ok:raise Rejected(code)
def physical(root):
 p=pathlib.Path(root).resolve();return pathlib.Path('\\\\?\\'+str(p)) if os.name=='nt' and not str(p).startswith('\\\\?\\') else p
def safe(root,name,limit=64*1024**2,allow_empty=False):
 require(isinstance(name,str) and name and not any(p in ('','.','..') for p in name.split('/')) and not any(c in name for c in ('\\',':','\0')),'UNSAFE_PATH')
 p=physical(root)
 for part in name.split('/'):
  p=p/part;s=p.lstat();require(not stat.S_ISLNK(s.st_mode) and not getattr(s,'st_file_attributes',0)&0x400,'LINKED_INPUT')
 s=p.stat();require(stat.S_ISREG(s.st_mode) and s.st_nlink==1 and (allow_empty or s.st_size>0) and s.st_size<=limit,'NONREGULAR_INPUT')
 b=p.read_bytes();a=p.stat();require((s.st_dev,s.st_ino,s.st_size,s.st_mtime_ns)==(a.st_dev,a.st_ino,a.st_size,a.st_mtime_ns) and len(b)==s.st_size,'INPUT_RACE');return b
def parse_json(b):
 def pairs(items):
  out={}
  for k,v in items:
   require(k not in out,'DUPLICATE_JSON_FIELD');out[k]=v
  return out
 return json.loads(b,object_pairs_hook=pairs,parse_constant=lambda v:require(False,'NONFINITE_JSON'))
def load(root,name):
 b=safe(root,name);return parse_json(gzip.decompress(b) if name.endswith('.gz') else b)
def git(root,*args):
 p=subprocess.run(['git','-c','core.fsmonitor=false','-c','core.longpaths=true',*args],cwd=root,capture_output=True,timeout=90)
 require(p.returncode==0,'GIT_EVIDENCE_UNAVAILABLE');return p.stdout
def utc(v):
 require(isinstance(v,str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z',v),'INVALID_UTC')
 return datetime.datetime.strptime(v,'%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=datetime.timezone.utc)
def now():return datetime.datetime.now(datetime.timezone.utc)
def tool_tree(root,python_site=False):
 root=physical(root);rows=[]
 for current,dirs,files in os.walk(root,followlinks=False):
  dirs[:]=sorted(d for d in dirs if d!='__pycache__')
  if python_site and pathlib.Path(current)==root:dirs[:]=[d for d in dirs if d not in ('bin','Scripts')]
  for name in dirs:
   p=pathlib.Path(current)/name;s=p.lstat();require(not p.is_symlink() and not getattr(s,'st_file_attributes',0)&0x400,'LINKED_SCANNER_CODE')
   if python_site:rows.append(['@directory/'+p.relative_to(root).as_posix(),'directory'])
  for name in sorted(files):
   if name.endswith(('.pyc','.pyo')):
    require(not python_site,'UNEXPECTED_LEGACY_SCANNER_BYTECODE');continue
   if python_site and name=='RECORD' and pathlib.Path(current).name.endswith('.dist-info'):continue
   p=pathlib.Path(current)/name;rel=p.relative_to(root).as_posix();rows.append([rel,SHA(safe(root,rel,limit=512*1024**2,allow_empty=True))])
 require(rows,'EMPTY_SCANNER_INSTALLATION');return SHA(CANON(sorted(rows)))

def source(root,policy):
 require(safe(root,'scripts/phase9/security_acceptance/proposal.json')==safe(HERE,'proposal.json') and safe(root,'scripts/phase9/security_acceptance/source-manifest.json')==safe(HERE,'source-manifest.json'),'CONTRACT_DOCUMENT_DRIFT')
 rows=load(HERE,'source-manifest.json');require(SHA(safe(HERE,'source-manifest.json'))==policy['sourceManifest'],'MANIFEST_DRIFT')
 tracked=set(filter(None,git(root,'ls-files','-z').decode().split('\0')))
 # Untracked proposal paths are admitted only when their exact bytes are listed;
 # ignored caches/node_modules never enter the source contract.
 untracked=set(filter(None,git(root,'ls-files','--others','--exclude-standard','-z').decode().split('\0')))
 expected={r['path'] for r in rows}|{'scripts/phase9/security_acceptance/proposal.json','scripts/phase9/security_acceptance/source-manifest.json'}
 require(tracked|untracked==expected,'SOURCE_INVENTORY_DRIFT')
 for r in rows:require(SHA(safe(root,r['path'],allow_empty=True))==r['sha256'],'SOURCE_DRIFT:'+r['path'])
 # Git may hide a newly added ignore file from its untracked inventory. Check
 # every reviewed source directory explicitly, including ignored ignore files.
 directories={''}
 for name in expected:
  parts=name.split('/')[:-1]
  directories.update('/'.join(parts[:i]) for i in range(1,len(parts)+1))
 for directory in directories:
  require(not os.path.lexists(physical(root)/directory/'.gitleaksignore'),'UNREVIEWED_SCAN_IGNORE:'+((directory+'/') if directory else '')+'.gitleaksignore')
  for leaf in ('.gitignore','.semgrepignore'):
   name=(directory+'/' if directory else '')+leaf
   require(name in expected or not os.path.lexists(physical(root)/name),'UNREVIEWED_SCAN_IGNORE:'+name)
 require(SHA(safe(root,'docs/phase-9/security-advisory-exceptions.json'))==policy['expiredPolicy'],'EXPIRED_POLICY_CHANGED')
 return {'files':len(rows),'manifest':policy['sourceManifest']}
def coupled_source(root,installed):
 if pathlib.Path(root).resolve()==pathlib.Path(installed).resolve():return
 for r in load(HERE,'source-manifest.json'):
  if r['path'].startswith('scripts/phase9/security_acceptance/') or r['path']=='.github/workflows/g97-security-acceptance.yml':continue
  require(SHA(safe(installed,r['path'],allow_empty=True))==r['sha256'],'COUPLED_SOURCE_DRIFT:'+r['path'])

def graph_projection(obj):
 require(isinstance(obj,dict) and not obj.get('problems') and not obj.get('invalid') and not obj.get('extraneous') and not obj.get('missing'),'BROKEN_DEPENDENCY_GRAPH')
 return {'name':obj.get('name'),'version':obj.get('version'),'dependencies':{k:graph_projection(v) for k,v in sorted(obj.get('dependencies',{}).items())}}
def sbom_projection(obj):
 require(obj.get('bomFormat')=='CycloneDX' and obj.get('specVersion')=='1.5' and obj.get('components') and obj.get('dependencies'),'SBOM_INCOMPLETE')
 require(obj.get('metadata',{}).get('tools')==[{'vendor':'npm','name':'cli','version':'11.20.0'}],'SBOM_TOOL_DRIFT')
 return {'components':sorted(obj['components'],key=lambda x:x['bom-ref']),'dependencies':sorted(obj['dependencies'],key=lambda x:x['ref'])}
def osv_projection(obj):
 require(set(obj)=={'results','experimental_config'} and obj['experimental_config']=={'licenses':{'summary':False,'allowlist':None}} and isinstance(obj['results'],list) and obj['results'],'OSV_INCOMPLETE')
 rows=[];seen=set()
 allowed=('package-lock.json','scripts/phase9/security_acceptance/semgrep-requirements-linux-py312.txt')
 for item in obj['results']:
  p=item['source']['path'].replace('\\','/');labels=[name for name in allowed if p.endswith('/'+name)]
  require(len(labels)==1 and labels[0] not in seen and item['source']['type']=='lockfile','OSV_SOURCE_DRIFT')
  seen.add(labels[0]);rows.append({'source':labels[0],'packages':item['packages']})
 require(seen==set(allowed),'OSV_SOURCE_OMISSION')
 return sorted(rows,key=lambda row:row['source'])
def audit_projection(obj):
 require(obj.get('auditReportVersion')==2 and isinstance(obj.get('vulnerabilities'),dict) and obj['vulnerabilities'],'AUDIT_INCOMPLETE')
 records=obj['vulnerabilities'];normalized={};links={};roots={}
 for name,r in records.items():
  require(set(r)=={'name','severity','isDirect','via','effects','range','nodes','fixAvailable'} and r['name']==name and type(r['isDirect']) is bool,'AUDIT_RECORD_SCHEMA')
  require(isinstance(r['nodes'],list) and r['nodes'] and all(isinstance(p,str) for p in r['nodes']) and len(r['nodes'])==len(set(r['nodes'])),'AUDIT_PATH_OMISSION')
  require(isinstance(r['via'],list) and isinstance(r['effects'],list) and isinstance(r['range'],str) and (type(r['fixAvailable']) is bool or isinstance(r['fixAvailable'],dict)),'AUDIT_RECORD_SCHEMA')
  refs=[v for v in r['via'] if isinstance(v,str)];advisories=[v for v in r['via'] if isinstance(v,dict)]
  require(len(refs)+len(advisories)==len(r['via']) and all(v in records for v in refs) and len(refs)==len(set(refs)),'UNVERIFIED_AUDIT_REFERENCE')
  require(all(isinstance(v,str) for v in r['effects']) and len(advisories)==len({CANON(v) for v in advisories}),'AUDIT_RECORD_SCHEMA')
  links[name]=refs;roots[name]={SHA(CANON(v)) for v in advisories}
  normalized[name]={'name':name,'severity':r['severity'],'isDirect':r['isDirect'],'nodes':sorted(r['nodes']),'primaryAdvisories':sorted(advisories,key=CANON)}
 # npm's outer ranges, fixAvailable suggestions, effects and non-advisory via
 # edges depend on registry packument/cache calculations. Preserve them raw;
 # never use an upgrade suggestion as security clearance. Every affected record
 # and installed path remains exact, full primary advisories remain exact, all
 # reported records must trace to a primary advisory, and the independent full
 # installed dependency graph/lock binds the actual dependency paths.
 for _ in range(len(records)):
  updated={name:roots[name]|set().union(*(roots[ref] for ref in links[name])) for name in records}
  if updated==roots:break
  roots=updated
 require(all(roots.values()),'UNROOTED_AUDIT_RECORD')
 return {'records':normalized,'counts':obj['metadata']['vulnerabilities']}
def initial_audit_subset(obj,final):
 # Cold-cache metavulnerability expansion is not a stable report identity.
 # Every initial record must match the final full audit and retain both roots.
 initial=audit_projection(obj);complete=audit_projection(final)
 require(set(initial['records']) <= set(complete['records']) and all(record==complete['records'][name] for name,record in initial['records'].items()),'INITIAL_AUDIT_RECORD_DRIFT')
 roots=lambda rows:{name for name,record in rows.items() if record['primaryAdvisories']}
 require(roots(initial['records'])==roots(complete['records']) and roots(initial['records']),'INITIAL_AUDIT_PRIMARY_OMISSION')
 counts=initial['counts'];levels=('info','low','moderate','high','critical')
 require(set(counts)==set(levels)|{'total'} and all(type(counts[name]) is int and counts[name]>=0 for name in counts),'INITIAL_AUDIT_COUNT_TYPES')
 require(all(counts[level]==sum(record['severity']==level for record in initial['records'].values()) for level in levels) and counts['total']==len(initial['records']),'INITIAL_AUDIT_COUNT_DRIFT')
 return initial
def bind_raw_report(name,report,data):
 if name in ('trufflehog','trufflehog-current'):require(not data.strip() and report==[],'RAW_REPORT_DRIFT:'+name)
 else:require(parse_json(data)==report,'RAW_REPORT_DRIFT:'+name)
def bind_regression(result,data,actual_exit,minimum):
 require(set(result)=={'exit','tests','pass','fail','cancelled','skipped','todo','transcript','file'},'REGRESSION_SCHEMA')
 require(type(actual_exit) is int and all(type(result[k]) is int for k in ('exit','tests','pass','fail','cancelled','skipped','todo')),'REGRESSION_NUMBER_TYPES')
 require(result['exit']==actual_exit==0 and SHA(data)==result['transcript'],'REGRESSION_PROCESS_BINDING')
 require(all(result[k]==0 for k in ('fail','skipped','cancelled','todo')) and result['pass']==result['tests'] and result['tests']>=minimum,'REGRESSION_INCOMPLETE')
 for k in ('tests','pass','fail','cancelled','skipped','todo'):
  values=re.findall(rb'^# '+k.encode()+rb' (\d+)\r?$',data,re.M)
  require(len(values)==1 and int(values[0])==result[k],'REGRESSION_SUMMARY_DRIFT')
COMPRESSED_WITNESSES={'scripts/phase9/security_acceptance/'+name for name in ('history.json.gz','scan-targets.json.gz','test-fixtures.json.gz','legacy-sbom-fixture.json.gz')}|{'scripts/phase9/tooling-security-backports/originals.json.gz'}
ENGINE_SOURCE_ARCHIVE='scripts/phase9/security_acceptance/semgrep-engine-linux-x86_64.tar.gz'

def coverage_kind(path,body):
 if body.startswith(b'\x89PNG\r\n\x1a\n') and path.endswith('.png'):return 'excluded','binary-png'
 if body.startswith(b'\xff\xd8\xff'):
  if path.endswith('.jpg'):return 'excluded','binary-jpeg'
  if path.endswith('.png'):return 'auxiliary','opaque-jpeg-selected-by-generic-rules'
 if body.startswith(b'\x1f\x8b') and path.endswith('.gz'):
  if path==ENGINE_SOURCE_ARCHIVE:return 'excluded','reviewed-scanner-engine-artifact'
  require(path in COMPRESSED_WITNESSES,'UNREVIEWED_COMPRESSED_SOURCE:'+path)
  return 'excluded','gzip-source-witness'
 require(len(body)<=4*1024**2,'REQUIRED_SOURCE_EXCEEDS_SCANNER_LIMIT:'+path)
 return 'required','source-text-or-generic-input'

def scan_coverage(policy,root=None):
 raw=safe(HERE,'scan-targets.json.gz');require(SHA(raw)==policy['scanCoverageManifest'],'COVERAGE_MANIFEST_DRIFT')
 scope=parse_json(gzip.decompress(raw));require(set(scope)=={'schema','targets','exclusions','explicitTargets'} and type(scope['schema']) is int and scope['schema']==1,'COVERAGE_SCHEMA')
 require(SHA(safe(HERE,'source-manifest.json'))==policy['sourceManifest'],'COVERAGE_SOURCE_MANIFEST_DRIFT')
 rows=load(HERE,'source-manifest.json');identities={r['path']:r['sha256'] for r in rows};require(len(rows)==len(identities),'COVERAGE_DUPLICATE_SOURCE')
 identities.update({'scripts/phase9/security_acceptance/source-manifest.json':policy['sourceManifest'],'scripts/phase9/security_acceptance/proposal.json':SHA(safe(HERE,'proposal.json'))})
 seen=set();targets=set();required=set()
 reasons={'binary-png','binary-jpeg','gzip-source-witness','reviewed-scanner-engine-artifact'}
 for group in ('targets','exclusions'):
  require(isinstance(scope[group],list),'COVERAGE_SCHEMA')
  for item in scope[group]:
   require(isinstance(item,dict) and set(item)=={'path','kind','reason'},'COVERAGE_ROW_SCHEMA');name=item['path']
   require(isinstance(name,str) and not any(c in name for c in ('\\',':','\0')) and all(p not in ('','.','..') for p in name.split('/')),'COVERAGE_UNSAFE_PATH')
   require(name in identities and name not in seen,'COVERAGE_SOURCE_INVENTORY_DRIFT');seen.add(name)
   if group=='exclusions':
    require(item['kind']=='excluded' and item['reason'] in reasons,'UNREVIEWED_COVERAGE_EXCLUSION')
    if item['reason']=='binary-png':require(name.endswith('.png'),'INVALID_BINARY_EXCLUSION')
    elif item['reason']=='binary-jpeg':require(name.endswith('.jpg'),'INVALID_BINARY_EXCLUSION')
    elif item['reason']=='gzip-source-witness':require(name in COMPRESSED_WITNESSES,'INVALID_BINARY_EXCLUSION')
    else:require(name==ENGINE_SOURCE_ARCHIVE,'INVALID_ENGINE_ARTIFACT_EXCLUSION')
   else:
    require((item['kind'],item['reason']) in (('required','source-text-or-generic-input'),('auxiliary','opaque-jpeg-selected-by-generic-rules')),'COVERAGE_TARGET_KIND')
    targets.add(name)
    if item['kind']=='required':required.add(name)
   if root is not None:
    body=safe(root,name,allow_empty=True);require(SHA(body)==identities[name],'COVERAGE_SOURCE_DRIFT:'+name)
    require(coverage_kind(name,body)==(item['kind'],item['reason']),'COVERAGE_CLASSIFICATION_DRIFT:'+name)
 require(seen==set(identities),'COVERAGE_SOURCE_OMISSION')
 explicit=sorted(p for p in required if p.startswith('supabase/tests/') and p.endswith('.sql'))
 require(scope['explicitTargets']==explicit,'REQUIRED_SQL_TARGET_OMISSION')
 return {'targets':targets,'required':required,'explicitTargets':explicit,'sourceIdentities':identities}

def scanner_scope(name,args):
 require(isinstance(args,list) and all(isinstance(s,str) for s in args),'SCANNER_INTENT_SCHEMA')
 normal=lambda s:s.replace('\\','/')
 npm={'npm-initial':['audit','--audit-level=high','--json'],'npm-installed':['audit','--audit-level=high','--json'],'npm-lock':['audit','--package-lock-only','--audit-level=high','--json'],'graph':['ls','--all','--json','--long'],'sbom':['sbom','--sbom-format=cyclonedx']}
 if name in npm:ok=len(args)==len(npm[name])+2 and args[0]=='node' and normal(args[1]).endswith('/npm/bin/npm-cli.js') and args[2:]==npm[name]
 elif name=='gitleaks':ok=len(args)==9 and args[1]=='detect' and normal(args[2]).endswith('/scripts/phase9/security_acceptance/gitleaks.toml') and args[2].startswith('--config=') and args[3:6]==['--redact=100','--exit-code=2','--report-format=json'] and args[6].startswith('--report-path=') and normal(args[6]).endswith('/gitleaks-raw.json') and args[7:]==['--log-opts=--all --full-history','--log-level=info']
 elif name=='osv':ok=len(args)==7 and args[1:5]==['scan','source','--recursive','--format=json'] and args[5].startswith('--output=') and normal(args[5]).endswith('/osv-raw.json') and args[6:]==['.']
 elif name=='trufflehog':ok=len(args)==9 and args[1]=='git' and args[2].startswith('file://') and args[3:]==['--bare','--fail','--no-update','--json','--only-verified','--concurrency=1']
 elif name=='gitleaks-current':ok=len(args)==10 and args[1:3]==['detect','--no-git'] and args[3].startswith('--source=') and normal(args[3]).endswith('/current-source') and normal(args[4]).endswith('/scripts/phase9/security_acceptance/gitleaks.toml') and args[4].startswith('--config=') and args[5:8]==['--redact=100','--exit-code=2','--report-format=json'] and args[8].startswith('--report-path=') and normal(args[8]).endswith('/gitleaks-current-raw.json') and args[9]=='--log-level=info'
 elif name=='trufflehog-current':ok=len(args)==8 and args[1]=='filesystem' and normal(args[2]).endswith('/current-source') and args[3:]==['--fail','--no-update','--json','--only-verified','--concurrency=1']
 elif name=='semgrep':
  forced=scan_coverage(load(HERE,'proposal.json'))['explicitTargets']
  ok=len(args)==29+len(forced) and args[1:5]==['-I','-S','-B','-X'] and args[5].startswith('pycache_prefix=') and args[6]=='-c' and args[7]==SEMGREP_ENTRY and args[9:20]==['scan','--error','--strict','--oss-only','--metrics=off','--jobs=1','--max-memory=768','--timeout=30','--max-target-bytes=4194304','--json',args[19]] and args[19].startswith('--output=') and normal(args[19]).endswith('/semgrep-raw.json')
  if ok:
   out=normal(args[19])[len('--output='):].rsplit('/',1)[0]
   ok=[normal(v) for v in args[20:]]==[item for r in ('owasp-top-ten','typescript','react','secrets') for item in ('--config',out+'/rules/'+r+'.yaml')]+['.',*forced]
 else:ok=False
 require(ok,'SCANNER_SCOPE_DRIFT:'+name)
SCANNER_BIND_GUARD="""import sys,socket
# This scanner is a CLI. Refuse Internet listener binds, including the vulnerable
# MCP stateful HTTP transport. Unix-domain engine communication remains allowed.
def g97_scanner_audit(event,args):
 if event == 'socket.bind' and args[0].family in (socket.AF_INET,socket.AF_INET6):
  raise PermissionError('G97_SCANNER_INTERNET_LISTENER_FORBIDDEN')
sys.addaudithook(g97_scanner_audit)
"""
SEMGREP_ENTRY=SCANNER_BIND_GUARD+"import site;site.addsitedir(sys.argv[1]);sys.path.insert(0,sys.argv.pop(1));from semgrep.console_scripts.pysemgrep import main;main()"
def current_leak_projection(obj,prefix=None):
 require(isinstance(obj,list) and obj and isinstance(obj[0],dict),'CURRENT_SOURCE_REPORT_EMPTY_OR_INVALID')
 if prefix is None:
  file=obj[0].get('File','');require(isinstance(file,str) and '/current-source/' in file,'CURRENT_SOURCE_PREFIX_INVALID')
  prefix=file.split('/current-source/',1)[0]+'/current-source'
 require(isinstance(prefix,str) and pathlib.Path(prefix).is_absolute() and pathlib.Path(prefix).name=='current-source','CURRENT_SOURCE_PREFIX_INVALID')
 rows=[];seen=set()
 for item in obj:
  require(isinstance(item,dict) and item.get('Secret')=='REDACTED' and item.get('Commit')=='','CURRENT_SOURCE_RECORD_INVALID')
  file=item.get('File');require(isinstance(file,str) and file.startswith(prefix+'/'),'CURRENT_SOURCE_FILE_SUBSTITUTION')
  path=file[len(prefix)+1:]
  require(path and all(part not in ('','.','..') for part in path.split('/')) and not any(char in path for char in ('\\',':','\0')),'CURRENT_SOURCE_PATH_INVALID')
  require(type(item.get('StartLine')) is int and type(item.get('EndLine')) is int and 0<item['StartLine']<=item['EndLine'] and isinstance(item.get('RuleID'),str),'CURRENT_SOURCE_RANGE_INVALID')
  fingerprint=f"{file}:{item['RuleID']}:{item['StartLine']}"
  require(item.get('Fingerprint')==fingerprint and fingerprint not in seen,'CURRENT_SOURCE_DUPLICATE_OR_FINGERPRINT_DRIFT');seen.add(fingerprint)
  rows.append({**item,'File':path,'Fingerprint':f"{path}:{item['RuleID']}:{item['StartLine']}"})
 return sorted(rows,key=lambda item:item['Fingerprint'])

def current_evidence(root,directory,policy,intents,raw):
 from history import verify_current
 snapshot=load(directory,'current-source-manifest.json')
 require(isinstance(snapshot,dict) and set(snapshot)=={'schema','sourceCommit','snapshotRoot','files'} and type(snapshot['schema']) is int and snapshot['schema']==1,'CURRENT_SOURCE_MANIFEST_SCHEMA')
 commit=git(root,'rev-parse','HEAD').decode().strip();prefix=snapshot['snapshotRoot']
 require(snapshot['sourceCommit']==commit,'CURRENT_SOURCE_COMMIT_DRIFT')
 names={row['path'] for row in load(HERE,'source-manifest.json')}|{'scripts/phase9/security_acceptance/proposal.json','scripts/phase9/security_acceptance/source-manifest.json'}
 expected=[{'path':name,'sha256':SHA(safe(root,name,allow_empty=True))} for name in sorted(names)]
 require(snapshot['files']==expected,'CURRENT_SOURCE_SNAPSHOT_DRIFT')
 require(intents['gitleaks-current']['args'][3]=='--source='+prefix and intents['trufflehog-current']['args'][2]==prefix,'CURRENT_SOURCE_INTENT_SUBSTITUTION')
 require(intents['gitleaks-current']['args'][4]==intents['gitleaks']['args'][2],'CURRENT_SOURCE_RULE_CONFIG_SUBSTITUTION')
 current_leak_projection(raw['gitleaks-current']['report'],prefix)
 result,refs,witnesses=verify_current(root,raw['gitleaks-current']['report'],prefix,commit,load(HERE,'history.json.gz'),safe(HERE,'gitleaks.toml').decode(),{name:SHA(safe(directory,'rules/'+name+'.yaml')) for name in policy['rules']})
 proof={'summary':result,'references':refs,'witnesses':witnesses}
 require(load(directory,'current-source-proof.json.gz')==proof,'CURRENT_SOURCE_PROOF_DRIFT')
 return result

def records(raw,policy):
 require(set(raw)==set(policy['scannerReports']),'SCANNER_OMISSION_OR_EXTRA')
 # The preparatory cold report depends on the exact final audit authority.
 for name in sorted(policy['scannerReports'],key=lambda name:(name=='npm-initial',name)):
  profile=policy['scannerReports'][name]
  value=raw[name];require(set(value)=={'report','exit'} and type(value['exit']) is int and value['exit']==profile['exit'],'SCANNER_EXIT:'+name)
  obj=value['report']
  if name=='npm-initial':
   require(profile.get('validation')=='EXACT_SUBSET_OF_FINAL_AUDIT_WITH_ALL_PRIMARY_ROOTS','INITIAL_AUDIT_POLICY_DRIFT')
   initial_audit_subset(obj,raw['npm-installed']['report']);continue
  if name.startswith('npm-'):obj=audit_projection(obj)
  elif name=='osv':obj=osv_projection(obj)
  elif name=='sbom':obj=sbom_projection(obj)
  elif name=='graph':obj=graph_projection(obj)
  elif name=='gitleaks-current':
   require(isinstance(obj,list) and len(obj)==policy['currentHistoryRecordCount'],'CURRENT_SOURCE_CARDINALITY')
   obj=current_leak_projection(obj)
  elif name=='gitleaks':
   require(isinstance(obj,list) and len(obj)==policy['historyRecordCount'] and len({x['Fingerprint'] for x in obj})==policy['historyRecordCount'],'HISTORY_CARDINALITY')
   require(all(x['Secret']=='REDACTED' for x in obj),'UNREDACTED_FINDING')
   obj=history_projection(obj)
  elif name=='semgrep':
   paths=obj.get('paths',{}).get('scanned',[])
   require(obj.get('version')==policy['semgrepVersion'] and obj.get('engine_requested')=='OSS' and obj.get('skipped_rules')==[] and obj.get('results')==[] and obj.get('errors')==[] and not obj.get('time',{}).get('fixpoint_timeouts'),'SEMGREP_INCOMPLETE_OR_FINDINGS')
   require(isinstance(paths,list) and all(isinstance(p,str) for p in paths),'SEMGREP_TARGET_SCHEMA')
   normalized=[p.replace('\\','/') for p in paths]
   require(len(normalized)==len(set(normalized)) and set(normalized)==scan_coverage(policy)['targets'],'SEMGREP_TARGET_IDENTITY_DRIFT')
   # Exact all-four rules/configuration coverage is checked against the collector
   # receipt as well as the pinned ruleset bytes, never inferred from zero results.
   continue
  elif name in ('trufflehog','trufflehog-current'):require(obj==[],'VERIFIED_EXPOSURE');continue
  require(SHA(CANON(obj))==profile['projection'],'SCANNER_RECORD_DRIFT:'+name)

def packages(source_root,installed_root,policy,evidence):
 installed_root=physical(installed_root)
 lock=load(source_root,'package-lock.json');require(safe(source_root,'package-lock.json')==safe(installed_root,'package-lock.json'),'INSTALL_LOCK_DRIFT')
 require(SHA(safe(source_root,'scripts/phase9/patch-tooling-security.mjs'))==policy['patchInstaller'],'PATCH_INSTALLER_DRIFT')
 profiles=load(HERE,'packages.json');observed=[]
 roots=sorted({p.split('node_modules/',1)[0]+'node_modules' for p in lock['packages'] if 'node_modules/' in p})
 physical_copies=[]
 for rel in roots:
  top=pathlib.Path(installed_root)/rel;require(top.is_dir() and not top.is_symlink() and not getattr(top.lstat(),'st_file_attributes',0)&0x400,'INSTALL_ROOT_UNAVAILABLE')
  for current,dirs,files in os.walk(top,followlinks=False):
   current=pathlib.Path(current)
   for name in list(dirs):
    p=current/name;s=p.lstat()
    if stat.S_ISLNK(s.st_mode) or getattr(s,'st_file_attributes',0)&0x400:
     # npm workspace links are permitted only at exact declared lock paths and
     # only to the exact in-repository workspace, never to a package backport.
     relp=p.relative_to(installed_root).as_posix();entry=lock['packages'].get(relp,{})
     require(entry.get('link') is True and p.resolve()==(pathlib.Path(installed_root)/entry['resolved']).resolve() and p.resolve().is_relative_to(pathlib.Path(installed_root).resolve()),'UNREVIEWED_INSTALL_LINK')
     dirs.remove(name)
   if current.parent.name=='node_modules' and current.name in ('braces','node-forge'):physical_copies.append(current.relative_to(installed_root).as_posix())
 for profile in profiles:
  paths=[p for p in lock['packages'] if p=='node_modules/'+profile['name'] or p.endswith('/node_modules/'+profile['name'])]
  require(paths,'PATCHED_PACKAGE_MISSING')
  archive=safe(evidence,'upstream/'+profile['name']+'.tgz')
  require('sha512-'+base64.b64encode(hashlib.sha512(archive).digest()).decode()==profile['integrity'],'REGISTRY_SRI_DRIFT')
  with tarfile.open(fileobj=io.BytesIO(archive),mode='r:gz') as t:
   originals={}
   for m in t.getmembers():
    require(m.isfile() or m.isdir(),'REGISTRY_LINK')
    if m.isfile():
     require(m.name.startswith('package/') and '..' not in m.name.split('/'),'REGISTRY_PATH')
     name=m.name[8:];require(name not in originals,'REGISTRY_DUPLICATE');originals[name]=t.extractfile(m).read()
  patched={f['path']:f for f in profile['files']}
  for f in patched.values():
   require(SHA(originals[f['path']])==f['original'],'ORIGINAL_FILE_DRIFT')
   require(SHA(safe(source_root,f['payload']))==f['patched'],'PAYLOAD_DRIFT')
  delta=''
  for f in profile['files']:
   delta+=''.join(difflib.unified_diff(originals[f['path']].decode().splitlines(keepends=True),safe(source_root,f['payload']).decode().splitlines(keepends=True),fromfile='a/'+f['path'],tofile='b/'+f['path']))
  delta=re.sub(r'(?m)^ $','',delta)
  require(delta.encode()==safe(HERE,profile['patchFile']) and SHA(delta.encode())==profile['patchFileSha256'],'PATCH_FILE_DRIFT')
  # The patch digest binds a deterministic original/new file-hash delta, in
  # addition to the full original registry SRI and every resulting package byte.
  require(SHA(CANON(profile['files']))==profile['patchSha256'],'PATCH_DIGEST_DRIFT')
  for rel in paths:
   entry=lock['packages'][rel]
   require(all(entry.get(k)==profile[k] for k in ('version','resolved','integrity')) and not entry.get('link'),'PACKAGE_IDENTITY_DRIFT')
   pkg=load(installed_root,rel+'/package.json');require((pkg.get('name'),pkg.get('version'))==(profile['name'],profile['version']),'INSTALLED_IDENTITY_DRIFT')
   actual=set()
   for current,dirs,files in os.walk(pathlib.Path(installed_root)/rel,followlinks=False):
    for d in dirs:require(not (pathlib.Path(current)/d).is_symlink(),'PACKAGE_LINK')
    for name in files:
     full=pathlib.Path(current)/name;path=full.relative_to(pathlib.Path(installed_root)/rel).as_posix();actual.add(path)
     require(path in originals,'EXTRA_PACKAGE_FILE')
     expected=patched[path]['patched'] if path in patched else SHA(originals[path])
     require(SHA(safe(installed_root,rel+'/'+path))==expected,'UNPATCHED_OR_CHANGED_PACKAGE:'+rel+'/'+path)
   require(actual==set(originals),'PACKAGE_FILE_OMISSION')
   observed.append({'path':rel,'name':profile['name'],'version':profile['version'],'SRI':profile['integrity'],'patchSha256':profile['patchSha256'],'files':len(actual)})
 require(sorted(physical_copies)==sorted(x['path'] for x in observed),'UNLISTED_PATCHED_PACKAGE_COPY')
 return observed

def history(root,raw,rule_hashes=None):
 from history import verify_history
 policy=load(HERE,'proposal.json');witnesses=load(HERE,'history.json.gz')
 require(len(witnesses)==policy['historyRecordCount'],'HISTORY_WITNESS_COUNT_DRIFT')
 return verify_history(root,raw,witnesses,safe(HERE,'gitleaks.toml').decode(),rule_hashes or policy['rules'])

def verify_artifact_inventory(root,expected):
 observed=set()
 for current,dirs,files in os.walk(root,followlinks=False):
  for name in dirs:
   p=pathlib.Path(current)/name;s=p.lstat()
   require(not stat.S_ISLNK(s.st_mode) and not getattr(s,'st_file_attributes',0)&0x400,'LINKED_EVIDENCE_DIRECTORY')
  for name in files:
   p=pathlib.Path(current)/name;s=p.lstat()
   require(stat.S_ISREG(s.st_mode) and s.st_nlink==1 and not getattr(s,'st_file_attributes',0)&0x400,'NONREGULAR_EVIDENCE_FILE')
   observed.add(p.relative_to(root).as_posix())
 require(observed==set(expected),'PHYSICAL_EVIDENCE_INVENTORY_DRIFT')

def evidence(root,directory,policy,installed_root):
 require(not pathlib.Path(directory).resolve().is_relative_to(pathlib.Path(root).resolve()),'EVIDENCE_INSIDE_SOURCE')
 manifest=load(directory,'receipt.json');require(set(manifest)=={'schema','started','finished','sourceManifest','scannerCommands','files','regressions'},'RECEIPT_SCHEMA')
 require(type(manifest['schema']) is int and manifest['schema']==1 and manifest['sourceManifest']==policy['sourceManifest'],'RECEIPT_SOURCE_DRIFT')
 begin,end=utc(manifest['started']),utc(manifest['finished']);require(begin<=end<=now() and now()-begin<=datetime.timedelta(hours=6),'STALE_OR_FUTURE_EVIDENCE')
 require(manifest['scannerCommands']==policy['scannerCommands'],'SCANNER_SCOPE_DRIFT')
 names=set(manifest['files']);required={v['file'] for v in policy['scannerReports'].values()}|{'upstream/braces.tgz','upstream/node-forge.tgz'}|{'rules/'+r+'.yaml' for r in policy['rules']}|{'tests/'+n+'.tap' for n in policy['minimumTests']}|{'osv-raw.json','gitleaks-raw.json','gitleaks-current-raw.json','semgrep-raw.json','current-source-manifest.json','current-source-proof.json.gz'}
 for name in set(policy['scannerReports'])|set(policy['minimumTests'])|{'npm-version'}:
  required|={'commands/'+name+'/'+leaf for leaf in ('stdout','stderr','intent.json','result.json')}
 require(names==required,'EVIDENCE_INVENTORY_DRIFT')
 verify_artifact_inventory(pathlib.Path(directory),names|{'receipt.json'})
 for name,h in manifest['files'].items():require(SHA(safe(directory,name,allow_empty=name.endswith(('/stdout','/stderr'))))==h,'EVIDENCE_TAMPER')
 for name,h in policy['rules'].items():require(manifest['files']['rules/'+name+'.yaml']==h,'SEMGREP_RULESET_DRIFT')
 intents={}
 for name in set(policy['scannerReports'])|set(policy['minimumTests'])|{'npm-version'}:
  intent=load(directory,'commands/'+name+'/intent.json');actual=load(directory,'commands/'+name+'/result.json');intents[name]=intent
  require(begin<=utc(intent['started'])<=utc(actual['finished'])<=end,'COMMAND_FRESHNESS_DRIFT:'+name)
  for leaf in ('stdout','stderr'):require(actual[leaf]==manifest['files']['commands/'+name+'/'+leaf],'RAW_STREAM_BINDING_DRIFT')
 caches=[intents[name].get('environment') for name in ('npm-initial','npm-installed','npm-lock')]
 require(all(isinstance(value,dict) and set(value)=={'npm_config_cache'} for value in caches),'AUDIT_CACHE_SCOPE_DRIFT')
 cache=caches[0]['npm_config_cache']
 require(isinstance(cache,str) and pathlib.Path(cache).is_absolute() and pathlib.Path(cache).name.startswith('g97-audit-cache-') and all(value['npm_config_cache']==cache for value in caches),'AUDIT_CACHE_SCOPE_DRIFT')
 norm=lambda value:value.replace('\\','/').removeprefix('//?/').rstrip('/').casefold()
 execution=intents['gitleaks']['cwd'];installation=intents['npm-installed']['cwd']
 require(all(norm(intents[n]['cwd'])==norm(execution) for n in ('osv','semgrep','gitleaks-current','trufflehog-current')),'SCANNER_SOURCE_ROOT_DRIFT')
 require(all(norm(intents[n]['cwd'])==norm(installation) for n in ('npm-initial','npm-lock','graph','sbom','npm-version',*policy['minimumTests'])),'INSTALLED_EXECUTION_ROOT_DRIFT')
 require(norm(intents['trufflehog']['cwd'])==norm(execution).rsplit('/',1)[0] and intents['trufflehog']['args'][2]=='file://'+execution.replace('\\','/').rstrip('/').rsplit('/',1)[1],'HISTORY_SOURCE_ROOT_DRIFT')
 require(norm(intents['gitleaks']['args'][2].removeprefix('--config='))==norm(execution+'/scripts/phase9/security_acceptance/gitleaks.toml'),'HISTORY_CONFIG_SOURCE_DRIFT')
 raw={name:{'report':load(directory,p['file']),'exit':p['exit']} for name,p in policy['scannerReports'].items()}
 # Actual exits are in a separately hashed output envelope; never take the
 # expected exit from policy as evidence of process completion.
 for name in raw:
  envelope=raw[name]['report'];require(set(envelope)=={'exit','report'},'RAW_ENVELOPE');raw[name]=envelope
  actual=load(directory,'commands/'+name+'/result.json');require(type(actual.get('exit')) is int and actual['exit']==envelope['exit'],'RAW_EXIT_DRIFT')
  scanner_scope(name,load(directory,'commands/'+name+'/intent.json')['args'])
  if name in ('osv','gitleaks','gitleaks-current','semgrep'):rawfile=name+'-raw.json'
  else:rawfile='commands/'+name+'/stdout'
  bind_raw_report(name,envelope['report'],safe(directory,rawfile,allow_empty=name in ('trufflehog','trufflehog-current')))
 records(raw,policy)
 h=history(root,raw['gitleaks']['report'],{name:SHA(safe(directory,'rules/'+name+'.yaml')) for name in policy['rules']});current=current_evidence(root,directory,policy,intents,raw);coupled_source(root,installed_root);p=packages(root,installed_root,policy,directory)
 required_tests={'backport-and-installer','native-source-and-archive','expired-exceptions'}
 require(set(manifest['regressions'])==required_tests,'REGRESSION_OMISSION')
 for name,result in manifest['regressions'].items():
  require(result.get('file')=='tests/'+name+'.tap','REGRESSION_PATH_DRIFT')
  tap=safe(directory,result['file']);require(tap==safe(directory,'commands/'+name+'/stdout'),'REGRESSION_TRANSCRIPT_DRIFT')
  bind_regression(result,tap,load(directory,'commands/'+name+'/result.json')['exit'],policy['minimumTests'][name])
 return {'status':'TECHNICAL_EVIDENCE_VALID; ORIGINAL_SECURITY_AUTOMATED_ACCEPTANCE_REQUIRED','history':h,'currentSource':current,'packages':p,'evidenceSha256':SHA(CANON(manifest)),'executionRoot':execution,'installedExecutionRoot':installation,'rawScannerPass':False}

AUTOMATED_SCOPE={'schema': 1, 'mode': 'SINGLE_OWNER_AUTOMATED_SOURCE_ONLY', 'independentHumanApproval': False, 'externalSignatureRequired': False, 'releaseAuthority': False, 'databaseReplayAuthority': False, 'integrationAuthority': False}
def validate_policy(policy,clock=None):
 clock=clock or now()
 require(policy.get('id')=='G97-SINGLE-OWNER-SOURCE-MITIGATION-R1'
         and CANON(policy.get('acceptance'))==CANON(AUTOMATED_SCOPE),'AUTOMATED_ACCEPTANCE_SCOPE_DRIFT')
 # This dated proposal does not renew itself, even if an input date is edited.
 require(policy.get('state')=='INACTIVE_PROPOSAL'
         and policy.get('notBefore')=='2026-10-18T00:00:00Z'
         and policy.get('notAfter')=='2026-10-21T00:00:00Z'
         and utc(policy['notBefore'])<=clock<utc(policy['notAfter']),
         'PROPOSAL_EXPIRED_OR_CHANGED')
 return dict(AUTOMATED_SCOPE)

def main():
 p=argparse.ArgumentParser();p.add_argument('mode',choices=['source','check']);p.add_argument('--root',default=str(ROOT));p.add_argument('--installed-root');p.add_argument('--evidence');a=p.parse_args()
 try:
  root=pathlib.Path(a.root).resolve();policy=load(HERE,'proposal.json');result=source(root,policy)
  validate_policy(policy)
  if a.mode!='source':
   require(a.evidence,'EVIDENCE_REQUIRED');scan_coverage(policy,root);installed=pathlib.Path(a.installed_root or root).resolve();result=evidence(root,pathlib.Path(a.evidence),policy,installed)
  print(json.dumps(result,sort_keys=True));return 0
 except (ValueError,KeyError,OSError,TypeError,subprocess.SubprocessError) as e:
  print(json.dumps({'status':'REJECTED','code':str(e) if isinstance(e,Rejected) else type(e).__name__,'rawScannerPass':False,'acceptanceGranted':False}));return 1

def history_projection(rows):
 # Optional presentation links grant no finding authority. Every remaining field
 # still participates in the exact reviewed projection and Git-source proof.
 projected=[]
 for row in rows:
  if 'Link' in row:
   require(isinstance(row['Link'],str) and isinstance(row.get('Commit'),str)
           and isinstance(row.get('File'),str) and type(row.get('StartLine')) is int
           and type(row.get('EndLine')) is int and 0<row['StartLine']<=row['EndLine'],
           'HISTORY_LINK_SOURCE_DRIFT')
   source='https://github.com/TasfiqJ/onSkin/blob/'+row['Commit']+'/'+row['File']
   lines='#L'+str(row['StartLine'])+('-L'+str(row['EndLine']) if row['EndLine']!=row['StartLine'] else '')
   allowed={source+lines}
   if row['File'].endswith('.md'):allowed.add(source+'?plain=1'+lines)
   require(row['Link'] in allowed,'HISTORY_LINK_DRIFT')
  projected.append({key:value for key,value in row.items() if key!='Link'})
 return sorted(projected,key=lambda row:row['Fingerprint'])

if __name__=='__main__':sys.exit(main())
