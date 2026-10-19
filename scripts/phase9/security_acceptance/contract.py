"""G97 source-mitigation proposal. Raw scanner failures are never rewritten.

Only `accept` can grant the narrow status below; it requires fresh complete
evidence and an Ed25519 receipt signed by an independently provisioned owner key.
The key is a TRUSTED CALLER input, never taken from source or scanner artifacts.
No release, DB replay, integration or generic Security clearance is granted.
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
 rows=[]
 for item in obj['results']:
  p=item['source']['path'].replace('\\','/');require(p.endswith('/package-lock.json'),'OSV_SOURCE_DRIFT')
  require(item['source']['type']=='lockfile','OSV_SOURCE_DRIFT')
  rows.append(item['packages'])
 return rows
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
def bind_raw_report(name,report,data):
 if name=='trufflehog':require(not data.strip() and report==[],'RAW_REPORT_DRIFT:'+name)
 else:require(parse_json(data)==report,'RAW_REPORT_DRIFT:'+name)
def bind_regression(result,data,actual_exit,minimum):
 require(set(result)=={'exit','tests','pass','fail','cancelled','skipped','todo','transcript','file'},'REGRESSION_SCHEMA')
 require(type(actual_exit) is int and all(type(result[k]) is int for k in ('exit','tests','pass','fail','cancelled','skipped','todo')),'REGRESSION_NUMBER_TYPES')
 require(result['exit']==actual_exit==0 and SHA(data)==result['transcript'],'REGRESSION_PROCESS_BINDING')
 require(all(result[k]==0 for k in ('fail','skipped','cancelled','todo')) and result['pass']==result['tests'] and result['tests']>=minimum,'REGRESSION_INCOMPLETE')
 for k in ('tests','pass','fail','cancelled','skipped','todo'):
  values=re.findall(rb'^# '+k.encode()+rb' (\d+)\r?$',data,re.M)
  require(len(values)==1 and int(values[0])==result[k],'REGRESSION_SUMMARY_DRIFT')
def coverage_kind(path,body):
 if body.startswith(b'\x89PNG\r\n\x1a\n') and path.endswith('.png'):return 'excluded','binary-png'
 if body.startswith(b'\xff\xd8\xff'):
  if path.endswith('.jpg'):return 'excluded','binary-jpeg'
  if path.endswith('.png'):return 'auxiliary','opaque-jpeg-selected-by-generic-rules'
 if body.startswith(b'\x1f\x8b') and path.endswith('.gz'):return 'excluded','gzip-source-witness'
 require(len(body)<=4*1024**2,'REQUIRED_SOURCE_EXCEEDS_SCANNER_LIMIT:'+path)
 return 'required','source-text-or-generic-input'

def scan_coverage(policy,root=None):
 raw=safe(HERE,'scan-targets.json.gz');require(SHA(raw)==policy['scanCoverageManifest'],'COVERAGE_MANIFEST_DRIFT')
 scope=parse_json(gzip.decompress(raw));require(set(scope)=={'schema','targets','exclusions','explicitTargets'} and type(scope['schema']) is int and scope['schema']==1,'COVERAGE_SCHEMA')
 require(SHA(safe(HERE,'source-manifest.json'))==policy['sourceManifest'],'COVERAGE_SOURCE_MANIFEST_DRIFT')
 rows=load(HERE,'source-manifest.json');identities={r['path']:r['sha256'] for r in rows};require(len(rows)==len(identities),'COVERAGE_DUPLICATE_SOURCE')
 identities.update({'scripts/phase9/security_acceptance/source-manifest.json':policy['sourceManifest'],'scripts/phase9/security_acceptance/proposal.json':SHA(safe(HERE,'proposal.json'))})
 seen=set();targets=set();required=set()
 reasons={'binary-png','binary-jpeg','gzip-source-witness'}
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
    elif item['reason']=='gzip-source-witness':require(name.endswith('.gz'),'INVALID_BINARY_EXCLUSION')
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
 npm={'npm-installed':['audit','--audit-level=high','--json'],'npm-lock':['audit','--package-lock-only','--audit-level=high','--json'],'graph':['ls','--all','--json','--long'],'sbom':['sbom','--sbom-format=cyclonedx']}
 if name in npm:ok=len(args)==len(npm[name])+2 and args[0]=='node' and normal(args[1]).endswith('/npm/bin/npm-cli.js') and args[2:]==npm[name]
 elif name=='gitleaks':ok=len(args)==9 and args[1]=='detect' and normal(args[2]).endswith('/scripts/phase9/security_acceptance/gitleaks.toml') and args[2].startswith('--config=') and args[3:6]==['--redact=100','--exit-code=2','--report-format=json'] and args[6].startswith('--report-path=') and normal(args[6]).endswith('/gitleaks-raw.json') and args[7:]==['--log-opts=--all --full-history','--log-level=info']
 elif name=='osv':ok=len(args)==7 and args[1:5]==['scan','source','--recursive','--format=json'] and args[5].startswith('--output=') and normal(args[5]).endswith('/osv-raw.json') and args[6:]==['.']
 elif name=='trufflehog':ok=len(args)==9 and args[1]=='git' and args[2].startswith('file://') and args[3:]==['--bare','--fail','--no-update','--json','--only-verified','--concurrency=1']
 elif name=='semgrep':
  forced=scan_coverage(load(HERE,'proposal.json'))['explicitTargets']
  ok=len(args)==26+len(forced) and args[1:3]==['-B','-X'] and args[3].startswith('pycache_prefix=') and args[4]=='-c' and args[5]==SEMGREP_ENTRY and args[7:17]==['scan','--error','--strict','--metrics=off','--jobs=1','--max-memory=768','--timeout=30','--max-target-bytes=4194304','--json',args[16]] and args[16].startswith('--output=') and normal(args[16]).endswith('/semgrep-raw.json')
  if ok:
   out=normal(args[16])[len('--output='):].rsplit('/',1)[0]
   ok=[normal(v) for v in args[17:]]==[item for r in ('owasp-top-ten','typescript','react','secrets') for item in ('--config',out+'/rules/'+r+'.yaml')]+['.',*forced]
 else:ok=False
 require(ok,'SCANNER_SCOPE_DRIFT:'+name)
SEMGREP_ENTRY="import site,sys;site.addsitedir(sys.argv[1]);sys.path.insert(0,sys.argv.pop(1));from semgrep.console_scripts.pysemgrep import main;main()"
def records(raw,policy):
 require(set(raw)==set(policy['scannerReports']),'SCANNER_OMISSION_OR_EXTRA')
 for name,profile in policy['scannerReports'].items():
  value=raw[name];require(set(value)=={'report','exit'} and type(value['exit']) is int and value['exit']==profile['exit'],'SCANNER_EXIT:'+name)
  obj=value['report']
  if name.startswith('npm-'):obj=audit_projection(obj)
  elif name=='osv':obj=osv_projection(obj)
  elif name=='sbom':obj=sbom_projection(obj)
  elif name=='graph':obj=graph_projection(obj)
  elif name=='gitleaks':
   require(isinstance(obj,list) and len(obj)==3264 and len({x['Fingerprint'] for x in obj})==3264,'HISTORY_CARDINALITY')
   require(all(x['Secret']=='REDACTED' for x in obj),'UNREDACTED_FINDING')
   obj=sorted(obj,key=lambda x:x['Fingerprint'])
  elif name=='semgrep':
   paths=obj.get('paths',{}).get('scanned',[])
   require(obj.get('version')=='1.177.0' and obj.get('results')==[] and obj.get('errors')==[] and not obj.get('time',{}).get('fixpoint_timeouts'),'SEMGREP_INCOMPLETE_OR_FINDINGS')
   require(isinstance(paths,list) and all(isinstance(p,str) for p in paths),'SEMGREP_TARGET_SCHEMA')
   normalized=[p.replace('\\','/') for p in paths]
   require(len(normalized)==len(set(normalized)) and set(normalized)==scan_coverage(policy)['targets'],'SEMGREP_TARGET_IDENTITY_DRIFT')
   # Exact all-four rules/configuration coverage is checked against the collector
   # receipt as well as the pinned ruleset bytes, never inferred from zero results.
   continue
  elif name=='trufflehog':require(obj==[],'VERIFIED_EXPOSURE');continue
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

def history(root,raw):
 from history import verify_history
 return verify_history(root,raw,load(HERE,'history.json.gz'),safe(HERE,'gitleaks.toml').decode())

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
 require(pathlib.Path(directory).resolve()!=pathlib.Path(root).resolve(),'EVIDENCE_INSIDE_SOURCE')
 manifest=load(directory,'receipt.json');require(set(manifest)=={'schema','started','finished','sourceManifest','scannerCommands','files','regressions'},'RECEIPT_SCHEMA')
 require(type(manifest['schema']) is int and manifest['schema']==1 and manifest['sourceManifest']==policy['sourceManifest'],'RECEIPT_SOURCE_DRIFT')
 begin,end=utc(manifest['started']),utc(manifest['finished']);require(begin<=end<=now() and now()-begin<=datetime.timedelta(hours=6),'STALE_OR_FUTURE_EVIDENCE')
 require(manifest['scannerCommands']==policy['scannerCommands'],'SCANNER_SCOPE_DRIFT')
 names=set(manifest['files']);required={v['file'] for v in policy['scannerReports'].values()}|{'upstream/braces.tgz','upstream/node-forge.tgz'}|{'rules/'+r+'.yaml' for r in policy['rules']}|{'tests/'+n+'.tap' for n in policy['minimumTests']}|{'osv-raw.json','gitleaks-raw.json','semgrep-raw.json'}
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
 norm=lambda value:value.replace('\\','/').removeprefix('//?/').rstrip('/').casefold()
 execution=intents['gitleaks']['cwd'];installation=intents['npm-installed']['cwd']
 require(all(norm(intents[n]['cwd'])==norm(execution) for n in ('osv','semgrep')),'SCANNER_SOURCE_ROOT_DRIFT')
 require(all(norm(intents[n]['cwd'])==norm(installation) for n in ('npm-lock','graph','sbom','npm-version',*policy['minimumTests'])),'INSTALLED_EXECUTION_ROOT_DRIFT')
 require(norm(intents['trufflehog']['cwd'])==norm(execution).rsplit('/',1)[0] and intents['trufflehog']['args'][2]=='file://'+execution.replace('\\','/').rstrip('/').rsplit('/',1)[1],'HISTORY_SOURCE_ROOT_DRIFT')
 require(norm(intents['gitleaks']['args'][2].removeprefix('--config='))==norm(execution+'/scripts/phase9/security_acceptance/gitleaks.toml'),'HISTORY_CONFIG_SOURCE_DRIFT')
 raw={name:{'report':load(directory,p['file']),'exit':p['exit']} for name,p in policy['scannerReports'].items()}
 # Actual exits are in a separately hashed output envelope; never take the
 # expected exit from policy as evidence of process completion.
 for name in raw:
  envelope=raw[name]['report'];require(set(envelope)=={'exit','report'},'RAW_ENVELOPE');raw[name]=envelope
  actual=load(directory,'commands/'+name+'/result.json');require(type(actual.get('exit')) is int and actual['exit']==envelope['exit'],'RAW_EXIT_DRIFT')
  scanner_scope(name,load(directory,'commands/'+name+'/intent.json')['args'])
  if name in ('osv','gitleaks','semgrep'):rawfile=name+'-raw.json'
  else:rawfile='commands/'+name+'/stdout'
  bind_raw_report(name,envelope['report'],safe(directory,rawfile,allow_empty=name=='trufflehog'))
 records(raw,policy)
 h=history(root,raw['gitleaks']['report']);coupled_source(root,installed_root);p=packages(root,installed_root,policy,directory)
 required_tests={'backport-and-installer','native-source-and-archive','expired-exceptions'}
 require(set(manifest['regressions'])==required_tests,'REGRESSION_OMISSION')
 for name,result in manifest['regressions'].items():
  require(result.get('file')=='tests/'+name+'.tap','REGRESSION_PATH_DRIFT')
  tap=safe(directory,result['file']);require(tap==safe(directory,'commands/'+name+'/stdout'),'REGRESSION_TRANSCRIPT_DRIFT')
  bind_regression(result,tap,load(directory,'commands/'+name+'/result.json')['exit'],policy['minimumTests'][name])
 return {'status':'TECHNICAL_EVIDENCE_VALID; INACTIVE_OWNER_ACCEPTANCE_REQUIRED','history':h,'packages':p,'evidenceSha256':SHA(CANON(manifest)),'executionRoot':execution,'installedExecutionRoot':installation,'rawScannerPass':False}

def load_approval(path):
 p=pathlib.Path(path)
 return parse_json(safe(p.parent,p.name,limit=65536))

def approval(receipt,key,policy,tree,evidence_sha,clock=None):
 clock=clock or now();require(isinstance(receipt,dict) and set(receipt)=={'payload','signature'},'OWNER_APPROVAL_ABSENT')
 p=receipt['payload'];fields={'schema','proposalSha256','sourceTree','evidenceSha256','decision','notBefore','notAfter','reviewer','reviewReference'}
 require(isinstance(p,dict) and set(p)==fields and type(p['schema']) is int and p['schema']==1,'OWNER_RECEIPT_SCHEMA')
 require(p['proposalSha256']==SHA(CANON(policy)) and p['sourceTree']==tree and p['evidenceSha256']==evidence_sha,'OWNER_RECEIPT_BINDING')
 require(p['decision']=='ACCEPT_EXACT_G97_SOURCE_MITIGATIONS_ONLY' and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9-]{0,38}',p['reviewer']) and isinstance(p['reviewReference'],str) and len(p['reviewReference'])>=16,'OWNER_RECEIPT_SCOPE')
 begin,end=utc(p['notBefore']),utc(p['notAfter']);require(utc(policy['notBefore'])<=begin<=clock<end<=utc(policy['notAfter']) and end-begin<=datetime.timedelta(hours=72),'OWNER_RECEIPT_EXPIRED_OR_EXTENDED')
 try:sig=base64.b64decode(receipt['signature'],validate=True)
 except Exception:raise Rejected('OWNER_SIGNATURE_INVALID')
 require(len(sig)==64 and isinstance(key,str) and len(key)<1024,'OWNER_SIGNATURE_INVALID')
 script="const c=require('node:crypto');let s='';process.stdin.on('data',b=>s+=b);process.stdin.on('end',()=>{try{const x=JSON.parse(s),k=c.createPublicKey(x.key);if(k.asymmetricKeyType!=='ed25519'||!c.verify(null,Buffer.from(x.payload,'base64'),k,Buffer.from(x.signature,'base64')))process.exit(1)}catch{process.exit(1)}})"
 r=subprocess.run(['node','-e',script],input=CANON({'key':key,'payload':base64.b64encode(CANON(p)).decode(),'signature':receipt['signature']}),capture_output=True,timeout=10)
 require(r.returncode==0,'OWNER_SIGNATURE_INVALID');return p

def main():
 p=argparse.ArgumentParser();p.add_argument('mode',choices=['source','check','accept']);p.add_argument('--root',default=str(ROOT));p.add_argument('--installed-root');p.add_argument('--evidence');p.add_argument('--approval');a=p.parse_args()
 try:
  root=pathlib.Path(a.root).resolve();policy=load(HERE,'proposal.json');result=source(root,policy)
  require(policy['state']=='INACTIVE_PROPOSAL' and utc(policy['notBefore'])<=now()<utc(policy['notAfter']),'PROPOSAL_EXPIRED_OR_CHANGED')
  if a.mode!='source':
   require(a.evidence,'EVIDENCE_REQUIRED');scan_coverage(policy,root);installed=pathlib.Path(a.installed_root or root).resolve();result=evidence(root,pathlib.Path(a.evidence),policy,installed)
  if a.mode=='accept':
   require(installed==root,'ACTIVE_EXTERNAL_INSTALL_FORBIDDEN')
   norm=lambda value:value.replace('\\','/').removeprefix('//?/').rstrip('/').casefold()
   require(norm(result['executionRoot'])==norm(str(root))==norm(result['installedExecutionRoot']),'ACTIVE_EXTERNAL_SCAN_FORBIDDEN')
   require(a.approval and os.environ.get('G97_TRUSTED_OWNER_PUBLIC_KEY'),'INDEPENDENT_OWNER_ACCEPTANCE_REQUIRED')
   receipt=load_approval(a.approval);head=git(root,'rev-parse','HEAD').decode().strip();tree=git(root,'rev-parse','HEAD^{tree}').decode().strip()
   require(not git(root,'status','--porcelain','--untracked-files=all').strip(),'ACTIVE_SOURCE_NOT_COMMITTED_CLEAN')
   approval(receipt,os.environ['G97_TRUSTED_OWNER_PUBLIC_KEY'],policy,tree,result['evidenceSha256'])
   result.update(status='EXACT_SOURCE_MITIGATIONS_ACCEPTED_UNTIL_OWNER_RECEIPT_EXPIRY',sourceCommit=head,sourceTree=tree,rawScannerPass=False,releaseAuthority=False,databaseReplayAuthority=False)
  print(json.dumps(result,sort_keys=True));return 0
 except (ValueError,KeyError,OSError,TypeError,subprocess.SubprocessError) as e:
  print(json.dumps({'status':'REJECTED','code':str(e) if isinstance(e,Rejected) else type(e).__name__,'rawScannerPass':False,'acceptanceGranted':False}));return 1
if __name__=='__main__':sys.exit(main())
