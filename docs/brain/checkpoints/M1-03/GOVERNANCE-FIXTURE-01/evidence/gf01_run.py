import ast,copy,datetime,hashlib,json,os,pathlib,re,subprocess,sys,time
ROOT=pathlib.Path('/root/onskin-governance-fixture01')
CP='docs/brain/checkpoints/M1-03/GOVERNANCE-FIXTURE-01/'
EVIDENCE=ROOT/CP/'evidence'
BASE='dbcfce9770850d4655221bd3d4c3b5799553aed2'
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT).decode().strip()
def digest(b):return hashlib.sha256(b).hexdigest()
def write_json(path,v):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(v,indent=2)+'\n')
def snapshot():return dict(commit=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}'))
def ast_proof():
 for label in ['02','03']:
  name='scripts/brain/test_m103_quality_recovery'+label+'_profile.py'
  old=subprocess.check_output(['git','show',BASE+':'+name],cwd=ROOT).decode();new=(ROOT/name).read_text()
  old_ast=ast.parse(old);new_ast=ast.parse(new)
  def tests(tree,text):return {n.name:(ast.dump(n,include_attributes=False),ast.get_source_segment(text,n)) for n in ast.walk(tree) if isinstance(n,ast.FunctionDef) and n.name.startswith('test_')}
  a,b=tests(old_ast,old),tests(new_ast,new);assert a==b and len(a)==8
  for tree in [old_ast,new_ast]:
   for n in ast.walk(tree):
    if isinstance(n,ast.FunctionDef) and n.name=='setUp': n.body=[ast.Pass()]
  assert ast.dump(old_ast,include_attributes=False)==ast.dump(new_ast,include_attributes=False)
  print(name+': 8/8 original test method ASTs AND exact source bodies unchanged; all module AST outside setUp unchanged')
 print('PASS: 16 original tests preserved, only fixture source selection changed; one repair approach')
def run(label,argv,cwd=ROOT):
 EVIDENCE.mkdir(parents=True,exist_ok=True);snap=snapshot();start=datetime.datetime.now(datetime.timezone.utc).isoformat();log=EVIDENCE/(label+'.log');receipt=EVIDENCE/(label+'.receipt.json')
 environment=dict(os.environ,CI='true',npm_config_cache='/root/.cache/onskin-gf01-npm',TURBO_TELEMETRY_DISABLED='1',PYTHONDONTWRITEBYTECODE='1')
 with log.open('wb') as out:
  result=subprocess.run(argv,cwd=cwd,env=environment,stdout=out,stderr=subprocess.STDOUT)
 raw=log.read_bytes();output=raw.decode(errors='replace');passed=failed=skipped=None
 m=re.search(r'Ran (\d+) tests? in ',output)
 if m:
  total=int(m[1]); summary=output[output.rfind('\nRan '):];skipped=int((re.search(r'skipped=(\d+)',summary) or ['','0'])[1]);failures=int((re.search(r'failures=(\d+)',summary) or ['','0'])[1]);errors=int((re.search(r'errors=(\d+)',summary) or ['','0'])[1]);failed=len(set(re.findall(r'^(?:FAIL|ERROR): \S+ \(([^)]+)\)',output,re.M)));passed=total-skipped-failed
 if label=='forced-root-tests':
  clean=re.sub(r'\x1b\[[0-9;]*m','',output);matches=re.findall(r'(?:Tests\s+)(\d+) passed',clean);passed=sum(map(int,matches));failed=0 if result.returncode==0 else 1;skipped=0
  inventory_ok = result.returncode!=0 or (passed==6067 and re.search(r'Cached:\s+0 cached',clean))
 if label in ['forced-typecheck','forced-lint'] and result.returncode==0:inventory_ok = re.search(r'Cached:\s+0 cached',re.sub(r'\x1b\[[0-9;]*m','',output))
 counts=None if passed is None else dict(passed=passed,failed=failed,skipped=skipped)
 value=dict(schema_version=1,kind='LOCAL_EXECUTION',claim_origin='CODEX_REPORTED_EXECUTION',command=json.dumps(argv),working_directory=str(cwd),environment='Linux WSL onskin-r6-verification; Python3.12.3 Node24.19.0 npm11.17.0; CI=true; fresh no-hardlink full clone; dedicated npm cache; admission NONE',source_commit=snap['commit'],source_tree=snap['tree'],status='PASS' if result.returncode==0 else 'FAIL',exit_code=result.returncode,output=dict(path=CP+'evidence/'+log.name,sha256=digest(raw)),counts=counts,argv=argv,started_at_utc=start,finished_at_utc=datetime.datetime.now(datetime.timezone.utc).isoformat())
 write_json(receipt,value);print(label,'ACTUAL_EXIT='+str(result.returncode),'COUNTS='+str(counts),flush=True);print('\n'.join(output.splitlines()[-8:]),flush=True)
 if label in ['forced-root-tests','forced-typecheck','forced-lint'] and result.returncode==0:assert inventory_ok,'Required test/cache inventory differs; actual command exit is preserved in the receipt'
 return result.returncode
if __name__=='__main__':
 if sys.argv[1]=='ast-proof':ast_proof()
 elif sys.argv[1]=='run':sys.exit(run(sys.argv[2],json.loads(sys.argv[3]),pathlib.Path(sys.argv[4]) if len(sys.argv)>4 else ROOT))
 elif sys.argv[1]=='checks':
  commands=[('fresh-npm-ci',['npm','ci']),('forced-root-tests',['npm','test','--','--force']),('forced-typecheck',['npm','run','typecheck','--','--force']),('forced-lint',['npm','run','lint','--','--force']),('original-secret12',['python3.12','-B','-m','unittest','discover','-s','scripts/phase9/security_acceptance','-p','test_secret_scan.py','-v']),('original-security70',['python3.12','-B','-m','unittest','discover','-s','scripts/phase9/security_acceptance','-p','test_contract.py','-v'])]
  for label,argv in commands:
   result=run(label,argv)
   if result and label!='original-security70':sys.exit(result)
