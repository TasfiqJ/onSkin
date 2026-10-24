import hashlib,json,pathlib,re,subprocess
ROOT=pathlib.Path(r'C:\Users\jasim\Desktop\WeddingCards\work\m102-retained-resilience')
BASE='8ac97c32901272d97d1bff05f2abc294811055a6'
def git(*a):return subprocess.check_output(['git',*a],cwd=ROOT)
paths=git('ls-tree','-r','--name-only',BASE,'--','scripts','apps','.github').decode().splitlines()
texts={}
for p in paths:
 if pathlib.Path(p).suffix in ('.mjs','.js','.ts','.tsx','.py','.json','.yml','.yaml'):
  try:texts[p]=(git('show',BASE+':'+p).decode('utf-8') if p=='scripts/release/full-app-j01/check.py' else (ROOT/p).read_text(encoding='utf-8'))
  except (UnicodeError,OSError):pass
pattern=re.compile(r'launch/contract|launch-contract\.json|ios-lean-v1|lean-v1')
direct={p for p,t in texts.items() if pattern.search(t)}
imports=[]
for p,t in texts.items():
 if pathlib.Path(p).suffix not in ('.mjs','.js','.ts','.tsx'):continue
 for m in re.finditer(r'''(?:from\s*|import\s*\(|require\s*\()\s*['"](\.[^'"]+)['"]''',t):
  target=pathlib.Path(pathlib.os.path.normpath(str(pathlib.PurePosixPath(p).parent/m[1]))).as_posix()
  if target in texts:imports.append({'from':p,'to':target})
relevant=set(direct)|{'scripts/phase4/build-source-worklist.mjs','scripts/launch/governed-publication-coverage.mjs'}
while True:
 add={e['from'] for e in imports if e['to'] in relevant}
 if add<=relevant:break
 relevant|=add
scripts=json.loads((ROOT/'package.json').read_text())['scripts']
commands={k:re.findall(r'\bnpm run ([A-Za-z0-9:_-]+)',v) for k,v in scripts.items()}
def leaves(k,seen=None):
 seen=set() if seen is None else seen
 if k in seen:return set()
 seen.add(k)
 return {p for p in relevant if p in scripts.get(k,'')}|set().union(*(leaves(c,seen) for c in commands.get(k,[])))
script_paths={k:sorted(leaves(k)) for k in scripts}
workflows=[]
for p,t in texts.items():
 if not p.startswith('.github/') or not p.endswith(('.yml','.yaml')):continue
 runs=[{'line':n,'script':m[1],'consumers':script_paths.get(m[1],[])} for n,l in enumerate(t.splitlines(),1)
       for m in [re.search(r'\bnpm run ([A-Za-z0-9:_-]+)',l)] if m and script_paths.get(m[1])]
 if runs:workflows.append({'path':p,'runs':runs})
rows=[]
for p in sorted(relevant):
 raw=git('show',BASE+':'+p)
 tests=sorted(q for q in texts if pathlib.PurePosixPath(q).parent==pathlib.PurePosixPath(p).parent and
              (q.endswith('.test.mjs') or 'smoke' in q or q.endswith('.test.py')))
 rows.append({'path':p,'source_commit':BASE,'sha256':hashlib.sha256(raw).hexdigest(),
  'binding_lines':[{'line':n,'text':l.strip()[:220]} for n,l in enumerate(texts[p].splitlines(),1) if pattern.search(l)][:6],
  'role':('candidate_governance_guard_not_runtime_cutover' if '/release/full-app-j01/' in p else
          'historical_custody_preserve' if '/brain/' in p or 'security_acceptance' in p else
          'legacy_contract_authority' if p=='scripts/launch/contract.mjs' else
          'transitive_consumer' if p not in direct else 'direct_legacy_consumer'),
  'migration':'UNAPPLIED_REQUIRES_EXACT_OWNER_GRANT','colocated_regression_paths':tests,
  'package_commands':[k for k,v in script_paths.items() if p in v]})
w=json.loads((ROOT/'docs/phase-4/generated/source-worklist.json').read_text())
worklist_paths=sorted({s['path'] for r in w['items'] for s in r['sourcePaths']})
diagnosis=json.loads((pathlib.Path(__file__).parent/'readiness-diagnosis.json').read_text())
nodes=[
 dict(id='C10-AUTHORITY',depends_on=[],owner='Independent Brain',files=['docs/release/full-app-j01/contract.v1.json','docs/release/full-app-j01/precedence.v1.json'],acceptance=['Independent exact source acceptance and separate finite successor grant; no self-acceptance']),
 dict(id='C10-BASELINE',depends_on=['C10-AUTHORITY'],owner='Security / DB custodians',files=['scripts/phase9/security_acceptance/source-manifest.json'],acceptance=['Original G97 FAIL/NO_GO and H01_SQL_PROBE_FAILED remain blocking until independently resolved; M1-03 accepted before M2 issuance']),
 dict(id='C10-CONTRACT',depends_on=['C10-AUTHORITY'],owner='Release contract engineering + Brain',files=['scripts/launch/contract.mjs','scripts/launch/check-contract.mjs','scripts/launch/contract-smoke.mjs','docs/hugeToDo/launch-contract.json'],acceptance=['Version successor without overwriting Sep27 history','19 F + 12 C + 6 P + only J01; F09 required, F18/J02-J27 deferred','Planning requirement never sets admission true; old negatives plus wrong-ID/missing-scope/false-GO negatives']),
 dict(id='C10-CONSUMERS',depends_on=['C10-CONTRACT'],owner='App/native and each phase owner',files=sorted(relevant-{'scripts/release/full-app-j01/check.py'}),acceptance=['Per-consumer exact mapped tests','No catalog/clinical/provider/payment/community/native stub marked complete','All literal-zero safety gates retained; separate qualified owner evidence required']),
 dict(id='C10-CI',depends_on=['C10-CONSUMERS'],owner='CI owner',files=sorted({x['path'] for x in workflows}),acceptance=['Preserve actions/pins/job graph and original Security/DB jobs','Candidate09 is already wired; wire successor consumer tests only after separate grant','Verify branch HEAD and GitHub synthetic merge-ref identities separately']),
 dict(id='C10-PROVENANCE',depends_on=['C10-CONSUMERS','C10-CI'],owner='Release provenance / readiness owners',files=['scripts/docs/readiness-status-audit.mjs','scripts/docs/readiness-status-audit.test.mjs','LAUNCH_READINESS.md','BLOCKERS.md','docs/TESTING_STRATEGY.md','docs/e2e/generated/human-e2e-manifest.json','docs/e2e/generated/human-e2e-manifest.md','docs/phase-9/release-candidates/README.md'],acceptance=['Repair actual documented baselines and CAT07 evidence under separate authority','Real non-template RC ledger, S then direct E, exact allowed tail through R then readiness-only F','Retain owner/provenance/atomic/snapshot controls and original 33 negatives','Exact required generated publication DAG and source inventories; no arbitrary current-head hash rotation']),
 dict(id='C10-INTEGRATION',depends_on=['C10-BASELINE','C10-PROVENANCE'],owner='Independent Brain + qualified gate owners',files=[],acceptance=['Current/tampered/restored producer checks, all semantic negatives, forced root tests/lint/typecheck','Final-head CI reported per job; no release GO from source tests','J01 intake missing until authenticated; G1/G2/G3/G5 independently qualified, G4 for change; zero positive counts/sizes/scores/percentages/accuracy claims'])]
plan=dict(schema_version=1,plan_id='onskin-legacy-consumer-cutover10-unapplied-v1',status='UNAPPLIED',implementation_authorized=False,
 authorization='BRAIN-RELEASE10-QUALITY-PROJECTIONS-CONSUMERS-CANDIDATE-01',observed_source=BASE,
 observed_tree='a59fc7ea1cc57901f6d848ff5009734f446bdff2',
 discovery={'method':'tracked scripts/apps/.github literal references plus reverse relative-static-import closure and recursive npm run workflow consumers','direct_count':len(direct),'mapped_count':len(rows),'limitation':'Static source map; colocated tests are concrete candidates, not a claim all were executed. Dynamic/generated dependencies need owner review.'},
 existing_candidate_ci={'path':'.github/workflows/quality.yml','step':'Check Release09 candidate full-app J01 governance','already_wired':True,'runtime_contract_migrated':False,'historical_precedence_ci_wired_false':'Immutable Release08 observation, not overwritten'},
 product={'required_f':[f'F{i:02}' for i in range(1,21) if i!=18],'required_c':[f'V2-C{i:02}' for i in range(1,13)],'required_p':[f'P{i:02}' for i in range(1,7)],'korean_candidates':['J01'],'deferred':['F18']+[f'J{i:02}' for i in range(2,28)],'f09':'private local history/manual comparison required','all_admissions':False},
 consumers=rows,relative_import_edges=[e for e in imports if e['from'] in relevant and e['to'] in relevant],workflow_consumers=workflows,
 worklist={'producer':'scripts/phase4/build-source-worklist.mjs','outputs':['docs/phase-4/generated/source-worklist.json','docs/phase-4/generated/source-worklist.md'],'source_occurrences':420,'unique_source_paths':worklist_paths,'consumers':['package.json:phase4:source-worklist:check','package.json:release:governed-packets:check','.github/workflows/quality.yml','scripts/launch/governed-publication-coverage.mjs','scripts/launch/governed-evidence-chain.mjs'],'self_binding':'No output pair in own 250 unique input paths; gitSha ignored by original freshness normalization, source bytes/status/counters are compared'},
 readiness={'status':'BLOCKED_OUTSIDE_SCOPE','diagnosis':diagnosis,'outputs_unchanged':True,'script_unchanged':True,'required_missing_ledger_path_pattern':'docs/phase-9/release-candidates/rc-<reviewed-id>/evidence-chain.json','additional_protected_paths':['LAUNCH_READINESS.md','BLOCKERS.md','docs/TESTING_STRATEGY.md','docs/e2e/generated/human-e2e-manifest.json','docs/e2e/generated/human-e2e-manifest.md','scripts/launch/governed-evidence-chain.mjs','scripts/launch/governed-publication-coverage.mjs','scripts/phase9/build-evidence-chain-ledger.mjs'],'owner':'Readiness, release provenance, CAT07 evidence owners; independent Brain grant required','not_a_bug':'Snapshot errors empty, inventory stable; unavailable governed chain and missing recorded head are expected fail-closed defenses'},
 dependency_dag=nodes,gates={'G97':'FAIL/NO_GO','DB':'H01_SQL_PROBE_FAILED','M1-03':'BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED','M2':'NOT_AUTHORIZED','J01_INTAKE':'MISSING','PUBLIC':'NOT_AUTHORIZED','spend_usd':0})
out=ROOT/'docs/release/full-app-j01/legacy-consumer-cutover10.unapplied.json'
out.write_bytes((json.dumps(plan,indent=2,ensure_ascii=False)+'\n').encode())
print(json.dumps({'direct':len(direct),'mapped':len(rows),'workflow_files':len(workflows),'import_edges':len(plan['relative_import_edges']),'plan_bytes':out.stat().st_size}))
