"""Run complete scanners and coupled tests, preserving raw streams and exits.

Caller provides verified installed CLI locations. No network credentials or live
database harness is used. This creates evidence; it never approves the proposal.
"""
import argparse,datetime,gzip,json,os,pathlib,platform,re,subprocess,sys,tempfile,urllib.request
sys.dont_write_bytecode=True
from contract import HERE,ROOT,SHA,CANON,load,safe,require,source,tool_tree,SEMGREP_ENTRY,scanner_scope,coupled_source,scan_coverage,git

RULES=('owasp-top-ten','typescript','react','secrets')
def stamp():return datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
def write(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(CANON(v)+b'\n')
def verify_semgrep(site,policy):
 require(tool_tree(site,python_site=True)==policy['semgrepPackageTree'],'SEMGREP_IMPLEMENTATION_DRIFT')
def verify_tool_sources(tools,policy):
 require(policy.get('toolPlatform')=='linux-x86_64-py312' and sys.platform=='linux' and platform.machine().lower() in ('x86_64','amd64') and sys.version_info[:2]==(3,12),'REVIEWED_TOOL_PLATFORM_REQUIRED')
 verify_semgrep(pathlib.Path(tools['semgrep']),policy)
 for name in ('gitleaks','osv','trufflehog'):
  require(SHA(pathlib.Path(tools[name]).read_bytes()) in policy['toolBytes'][name],'SCANNER_BINARY_DRIFT:'+name)
 require(tool_tree(pathlib.Path(tools['npm']).resolve().parents[1])==policy['npmToolTree'],'NPM_IMPLEMENTATION_DRIFT')
def collect(root,installed,out,tools,policy,only=None):
 require(not out.resolve().is_relative_to(root.resolve()),'EVIDENCE_INSIDE_REVIEWED_SOURCE')
 require(not out.exists(),'NEW_EVIDENCE_DIRECTORY_REQUIRED');out.mkdir(parents=True)
 started=stamp();files={};regressions={};scope={}
 def run(name,args,cwd=root,timeout=600,environment=None):
  if name in policy['scannerReports']:scanner_scope(name,list(map(str,args)))
  d=out/'commands'/name;d.mkdir(parents=True)
  write(d/'intent.json',{'args':list(map(str,args)),'cwd':str(cwd),'started':stamp(),'timeout':timeout,'environment':environment or {}})
  with (d/'stdout').open('wb') as o,(d/'stderr').open('wb') as e:
   try:p=subprocess.run(list(map(str,args)),cwd=cwd,stdout=o,stderr=e,timeout=timeout,env={**os.environ,**(environment or {})});exit=p.returncode
   except subprocess.TimeoutExpired:exit=124
  write(d/'result.json',{'exit':exit,'finished':stamp(),'stdout':SHA((d/'stdout').read_bytes()),'stderr':SHA((d/'stderr').read_bytes())})
  return exit,(d/'stdout').read_bytes()
 def save(name,exit,obj):
  rel=policy['scannerReports'][name]['file'];p=out/rel;p.parent.mkdir(parents=True,exist_ok=True);b=CANON({'exit':exit,'report':obj})
  if rel.endswith('.gz'):b=gzip.compress(b,mtime=0)
  p.write_bytes(b);files[rel]=SHA(b)
 def fetch(rel,url):
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Semgrep/'+policy['semgrepVersion']}),timeout=60) as response:b=response.read()
  p=out/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b);files[rel]=SHA(b);return b
 source(root,policy)
 coverage=scan_coverage(policy,root)
 coupled_source(root,installed)
 require(os.environ.get('NODE_OPTIONS','') in ('','--max-old-space-size=768') and not os.environ.get('NODE_PATH'),'UNREVIEWED_NODE_PRELOAD_OR_OPTIONS')
 # A scanner executable is admitted by its independently recorded release byte
 # identity, not by a version string printed by arbitrary caller-supplied code.
 verify_tool_sources(tools,policy)
 require(not git(root,'status','--porcelain','--untracked-files=all').strip(),'CURRENT_SCAN_CLEAN_COMMIT_REQUIRED')
 npm=tools['npm']
 code,data=run('npm-version',['node',npm,'--version'],installed,30);require(code==0 and data.strip()==b'11.20.0','NPM_VERSION_DRIFT')
 # npm's cold-cache metavulnerability projection is incomplete until its
 # metadata cache is populated. Preserve one initial raw audit, then perform
 # the installed and lock-only audits against that same new private cache.
 # All three exact report projections are mandatory; no finding is discarded.
 audit_cache=pathlib.Path(tempfile.mkdtemp(prefix='g97-audit-cache-'))
 for name,args in [('npm-initial',['audit','--audit-level=high','--json']),('npm-installed',['audit','--audit-level=high','--json']),('npm-lock',['audit','--package-lock-only','--audit-level=high','--json']),('graph',['ls','--all','--json','--long']),('sbom',['sbom','--sbom-format=cyclonedx'])]:
  environment={'npm_config_cache':str(audit_cache)} if name.startswith('npm-') else None
  code,data=run(name,['node',npm,*args],installed,300,environment);save(name,code,json.loads(data))
 for profile in load(HERE,'packages.json'):fetch('upstream/'+profile['name']+'.tgz',profile['resolved'])
 path=out/'osv-raw.json';code,_=run('osv',[tools['osv'],'scan','source','--recursive','--format=json','--output='+str(path),'.']);save('osv',code,json.loads(path.read_bytes()))
 path=out/'gitleaks-raw.json';code,_=run('gitleaks',[tools['gitleaks'],'detect','--config='+str(HERE/'gitleaks.toml'),'--redact=100','--exit-code=2','--report-format=json','--report-path='+str(path),'--log-opts=--all --full-history','--log-level=info']);save('gitleaks',code,json.loads(path.read_bytes()))
 # Relative file URL avoids the duplicated drive component in the Windows Git
 # transport. All refs are scanned by the bare protective clone, never just HEAD.
 code,data=run('trufflehog',[tools['trufflehog'],'git','file://'+root.name,'--bare','--fail','--no-update','--json','--only-verified','--concurrency=1'],root.parent,900)
 save('trufflehog',code,[json.loads(line) for line in data.splitlines() if line.strip()])
 # Copy precisely the committed source, never node_modules or implicit ignores,
 # into one new native tree for the required current-source secret scans.
 snapshot=pathlib.Path(tempfile.mkdtemp(prefix='g97-current-snapshot-'))/'current-source';snapshot.mkdir()
 names={row['path'] for row in load(HERE,'source-manifest.json')}|{'scripts/phase9/security_acceptance/proposal.json','scripts/phase9/security_acceptance/source-manifest.json'}
 snapshot_rows=[]
 for name in sorted(names):
  data=safe(root,name,allow_empty=True);target=snapshot/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
  snapshot_rows.append({'path':name,'sha256':SHA(data)})
 commit=git(root,'rev-parse','HEAD').decode().strip()
 write(out/'current-source-manifest.json',{'schema':1,'sourceCommit':commit,'snapshotRoot':str(snapshot),'files':snapshot_rows})
 path=out/'gitleaks-current-raw.json'
 code,_=run('gitleaks-current',[tools['gitleaks'],'detect','--no-git','--source='+str(snapshot),'--config='+str(HERE/'gitleaks.toml'),'--redact=100','--exit-code=2','--report-format=json','--report-path='+str(path),'--log-level=info'])
 current=json.loads(path.read_bytes());save('gitleaks-current',code,current)
 code,data=run('trufflehog-current',[tools['trufflehog'],'filesystem',str(snapshot),'--fail','--no-update','--json','--only-verified','--concurrency=1'],root,900)
 save('trufflehog-current',code,[json.loads(line) for line in data.splitlines() if line.strip()])
 require(all(SHA(safe(snapshot,row['path'],allow_empty=True))==row['sha256'] for row in snapshot_rows),'CURRENT_SOURCE_SNAPSHOT_CHANGED')
 from history import verify_current
 result,refs,witnesses=verify_current(root,current,str(snapshot),commit,load(HERE,'history.json.gz'),safe(HERE,'gitleaks.toml').decode(),policy['rules'])
 (out/'current-source-proof.json.gz').write_bytes(gzip.compress(CANON({'summary':result,'references':refs,'witnesses':witnesses}),mtime=0))
 config_args=[]
 for name in RULES:
  rel='rules/'+name+'.yaml';b=fetch(rel,'https://semgrep.dev/c/p/'+name)
  require(SHA(b)==policy['rules'][name],'SEMGREP_CONFIG_CHANGED:'+name);config_args+=['--config',str(out/rel)]
 path=out/'semgrep-raw.json'
 # Load the verified package directly; caller-supplied CLI wrappers and old
 # bytecode caches cannot substitute a different scanner implementation.
 entry=SEMGREP_ENTRY
 with tempfile.TemporaryDirectory(prefix='g97-sast-') as cache:
  code,_=run('semgrep',[sys.executable,'-I','-S','-B','-X','pycache_prefix='+cache,'-c',entry,str(pathlib.Path(tools['semgrep']).resolve()),'scan','--error','--strict','--oss-only','--metrics=off','--jobs=1','--max-memory=768','--timeout=30','--max-target-bytes=4194304','--json','--output='+str(path),*config_args,'.',*coverage['explicitTargets']],root,1200)
 save('semgrep',code,json.loads(path.read_bytes()) if path.exists() else {'scannerExecutionFailed':True})
 suites={
 'backport-and-installer':['scripts/phase9/security_acceptance/workflow_contract.test.mjs','scripts/phase9/patch-tooling-security.test.mjs','scripts/phase9/tooling-security-vulnerabilities.test.mjs'],
 'native-source-and-archive':['scripts/phase9/ios-archive-privacy-evidence.test.mjs','scripts/phase9/ios-privacy-source-audit.test.mjs','scripts/phase9/patch-react-native-view-shot-privacy.test.mjs','scripts/phase9/dependency-sbom-contract.test.mjs'],
 'expired-exceptions':['scripts/phase9/security-advisory-exceptions.test.mjs']}
 for name,paths in suites.items():
  code,data=run(name,['node','--test','--test-concurrency=1',*paths],installed,600)
  # Preserve the complete TAP; count only the Node runner's final summary.
  rel='tests/'+name+'.tap';(out/'tests').mkdir(exist_ok=True);(out/rel).write_bytes(data);files[rel]=SHA(data)
  fields={k:int(re.findall(rb'^# '+k.encode()+rb' (\d+)\r?$',data,re.M)[-1]) for k in ('tests','pass','fail','cancelled','skipped','todo')}
  regressions[name]={'exit':code,**fields,'transcript':SHA(data),'file':rel}
 source(root,policy)
 scan_coverage(policy,root)
 coupled_source(root,installed)
 verify_tool_sources(tools,policy)
 files={p.relative_to(out).as_posix():SHA(p.read_bytes()) for p in out.rglob('*') if p.is_file()}
 receipt={'schema':1,'started':started,'finished':stamp(),'sourceManifest':policy['sourceManifest'],'scannerCommands':policy['scannerCommands'],'files':files,'regressions':regressions}
 write(out/'receipt.json',receipt)
 print(json.dumps({'evidence':str(out),'raw_scans_preserved':True,'acceptance_granted':False,'native_skips':regressions['native-source-and-archive']['skipped']}))
 return receipt
def main():
 p=argparse.ArgumentParser();p.add_argument('--root',default=str(ROOT));p.add_argument('--installed-root');p.add_argument('--output',required=True)
 for name in ('npm','gitleaks','osv','trufflehog','semgrep'):p.add_argument('--'+name,required=True)
 a=p.parse_args();policy=load(HERE,'proposal.json');root=pathlib.Path(a.root).resolve();installed=pathlib.Path(a.installed_root or root).resolve()
 collect(root,installed,pathlib.Path(a.output).resolve(),{n:getattr(a,n) for n in ('npm','gitleaks','osv','trufflehog','semgrep')},policy)
if __name__=='__main__':main()
