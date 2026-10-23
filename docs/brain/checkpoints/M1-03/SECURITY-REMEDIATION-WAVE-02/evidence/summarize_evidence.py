import hashlib,json,pathlib,re,sys
base=pathlib.Path(__file__).resolve().parent
p=base/'source-checks/npm-audit.log'
if p.exists():
    raw=p.read_bytes();data=json.loads(raw)
    rows=[]
    for name,r in data['vulnerabilities'].items():
        rows.append(dict(package=name,severity=r['severity'],isDirect=r.get('isDirect'),range=r.get('range'),nodes=r.get('nodes'),effects=r.get('effects'),fixAvailable=r.get('fixAvailable'),via=[dict(name=x.get('name'),source=x.get('source'),url=x.get('url'),severity=x.get('severity'),range=x.get('range')) if isinstance(x,dict) else x for x in r['via']]))
    (base/'fresh-npm-summary.json').write_text(json.dumps(dict(exit=1,raw_sha256=hashlib.sha256(raw).hexdigest(),counts=data['metadata']['vulnerabilities'],rows=rows,raw_payload_exported=False),indent=2)+'\n')
receipts=[]
for folder in ('source-checks','after-install','bridge','bridge2','bridge-runtime','final-candidate-checks','extra-check','integration','integration2','integration3','npm-candidate'):
    for p in sorted((base/folder).glob('*.receipt.json')):
        row=json.loads(p.read_bytes());log=base/folder/(p.name.replace('.receipt.json','.log'))
        if log.exists():assert hashlib.sha256(log.read_bytes()).hexdigest()==row['log_sha256']
        receipts.append(dict(path=p.relative_to(base).as_posix(),exit=row['exit'],seconds=row.get('seconds'),argv=row.get('argv'),log_sha256=row.get('log_sha256')))
faults=[dict(command='intake.py first invocation',exit=1,reason='Driver ancestor off by one; no Git repository found. Corrected before independent fingerprint proof.'),
 dict(command='WSL runtime probe',exit=1,reason='Wsl/Service/CreateInstance/E_FAIL; distro failed to start, failure step 2. No repair/restart attempted; isolated Docker used.'),
 dict(command='linux_setup.py first invocation',exit=1,reason='Archive path guard rejected the harmless top-level Node directory. Exact archive hash passed. Guard corrected to permit that directory.'),
 dict(command='bridge_trial.py bridge',exit=1,reason='NON_METADATA_DISTINFO_DRIFT: invalid comparison of target/venv generated RECORD layouts. Independent original package-tree proof passed.'),
 dict(command='bridge_trial.py bridge2',exit=1,reason='UNRELATED_INSTALLED_FILE_DRIFT: cross-layout launcher/RECORD paths. Full delta retained; final original canonical tree proof and same-install dist-info proof pass.'),
 dict(command='sast_fixtures.py first revision',exit=1,reason='Both scanners exited 0 with zero findings; fixture lacked actual original rule taint source. Rule-specific second revision produces two matching findings with exit 1 by --error, intentionally.')]
result=dict(measured_source_head='0ecfa2a646ce9b30e717f6995097515f884cfdaf',measured_source_tree='b6b5ec635dd12e327a34904ebbd1e1252715bcd4',receipts=receipts,orchestration_failures=faults,
 governance='INCOMPLETE_TIMEOUT_124_NO_103_SUITE_PASS',root_6067_typecheck_lint='NOT_RUN_DIAGNOSTIC_ONLY_SOURCE_UNCHANGED',stage_technical_edit_eligible=False)
(base/'execution-index.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(dict(receipts=len(receipts),nonzero_receipts=sum(r['exit']!=0 for r in receipts),orchestration_failures=len(faults))))
