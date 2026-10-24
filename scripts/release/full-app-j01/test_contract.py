"""Authentic current/tampered/restored CLI tests. Small bundle fixtures, not fresh-checkout proof."""
import copy
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
BUNDLE = ROOT/'docs/release/full-app-j01'
FILES = ['contract.v1.json', 'matrix.v1.json', 'precedence.v1.json',
         'roadmap.v1.json', 'history-crosswalk.v1.json']


def main():
    original = {f: json.loads((BUNDLE/f).read_text(encoding='utf-8')) for f in FILES}
    cases = []
    def add(name, file, change, expected):
        cases.append((name, file, change, expected))

    for key in ['required_f','required_c','required_p','korean_candidates','deferred_f','deferred_j']:
        add('omit-'+key, FILES[0], lambda x,k=key:x[k].pop(), 'FINITE_IDS:')
        add('duplicate-'+key, FILES[0], lambda x,k=key:x[k].append(x[k][0]), 'FINITE_IDS:')
    for ident in ['F01','F18','V2-C12','P06','J01','J05','J27']:
        add('matrix-omit-'+ident, FILES[1], lambda x,i=ident:x['rows'].__setitem__(slice(None),[r for r in x['rows'] if r['id']!=i]), 'MATRIX65_IDENTITIES')
    add('matrix-duplicate',FILES[1],lambda x:x['rows'].__setitem__(0,copy.deepcopy(x['rows'][1])),'MATRIX65_IDENTITIES')
    add('matrix-unknown-id',FILES[1],lambda x:x['rows'][0].__setitem__('id','F99'),'MATRIX65_IDENTITIES')
    def row(x,i): return next(r for r in x['rows'] if r['id']==i)
    for ident in ['F04','F11','F14','F16','F17','F19','F20','V2-C10','P01','P06','J01']:
        add('stub-complete-'+ident,FILES[1],lambda x,i=ident:row(x,i).__setitem__('complete',True),'NO_STUB_GREEN:')
    for ident in ['J01']+[f'J{i:02}' for i in range(2,28)]:
        add('korean-positive-'+ident,FILES[1],lambda x,i=ident:row(x,i).__setitem__('positive_output_enabled',True),'NO_STUB_GREEN:')
    for ident in ['F18','J05']:
        add('undefer-'+ident,FILES[1],lambda x,i=ident:row(x,i).__setitem__('disposition','REQUIRED'),'ROW_STATUS:')
    for key in ['integration','device','qualified_review','provider','public_release']:
        add('fake-axis-'+key,FILES[1],lambda x,k=key:row(x,'F11')['evidence_axes'].__setitem__(k,'PASS'),'ROW_EVIDENCE:')
    add('fake-provider-receipt',FILES[1],lambda x:row(x,'F14')['evidence_receipts'].append('mock-provider-pass'),'SCHEMA_MAX_ITEMS:')
    for ident,gate in [('F17','MODERATION'),('F04','RIGHTS'),('F11','PAYMENT'),('F19','DEVICE'),('P01','PROVIDER'),('F05','CLINICAL')]:
        add('drop-owner-gate-'+ident,FILES[1],lambda x,i=ident,g=gate:row(x,i)['gates'].remove(g),'ROW_REQUIRED_GATE:')
    add('owner-role-erased',FILES[1],lambda x:row(x,'F05')['owner_roles'].pop(),'ROW_QUALIFIED_OWNERS:')
    for gate in original[FILES[0]]['gates']:
        add('forge-gate-'+gate['id'],FILES[0],lambda x,i=gate['id']:next(g for g in x['gates'] if g['id']==i).__setitem__('admitted',True),'GATE_CLOSED:')
    for admission in original[FILES[0]]['admissions']:
        add('forge-admission-'+admission,FILES[0],lambda x,k=admission:x['admissions'].__setitem__(k,True),'NO_ADMISSION')
    add('erase-G4',FILES[0],lambda x:x['j01']['change_requires'].remove('G4'),'J01_G4_CHANGE_GATE')
    for gate in ['G1','G2','G3','G5']:
        add('erase-single-'+gate,FILES[0],lambda x,g=gate:x['j01']['single_scan_requires'].remove(g),'J01_SINGLE_SCAN_GATES')
    add('pretend-research-intake',FILES[0],lambda x:x['j01'].__setitem__('intake','SUPPLIED'),'J01_INTAKE')
    add('skincare-article-as-imaging',FILES[0],lambda x:x['j01']['authenticated_research'].append('Skincare Routine for Pores and Scars'),'SCHEMA_MAX_ITEMS:')
    for claim in original[FILES[0]]['j01']['claims']:
        add('forged-j01-'+claim,FILES[0],lambda x,k=claim:x['j01']['claims'].__setitem__(k,True),'J01_NO_CLAIMS')
    add('erase-F09-history',FILES[0],lambda x:x['diary'].__setitem__('history',False),'F09_NOT_F18')
    add('erase-F09-compare',FILES[0],lambda x:x['diary'].__setitem__('manual_comparison',False),'F09_NOT_F18')
    add('enable-F18-trend',FILES[0],lambda x:x['diary'].__setitem__('automated_trend',True),'F09_NOT_F18')
    add('unsafe-reverse-grant',FILES[0],lambda x:x['offer'].__setitem__('unsafe_custom_reverse_grant',True),'SAFE_OFFER')
    add('public-territory-forged',FILES[0],lambda x:x['release'].__setitem__('public_territory_status','CLEARED'),'PLATFORM_TERRITORY')
    add('spend-one-dollar',FILES[0],lambda x:x.__setitem__('spend_usd',1),'ZERO_SPEND')
    add('self-accept',FILES[0],lambda x:x.__setitem__('proposal_status','ACCEPTED'),'NO_SELF_ACCEPTANCE')
    add('fake-ci-wiring',FILES[2],lambda x:x['cutover'].__setitem__('ci_wired',True),'NO_FAKE_CUTOVER')
    add('fake-runtime-cutover',FILES[2],lambda x:x['cutover'].__setitem__('status','DONE'),'NO_FAKE_CUTOVER')
    add('omit-legacy-consumer',FILES[2],lambda x:x['cutover']['consumers'].pop(),'LEGACY_CONSUMERS')
    add('forged-protected-hash',FILES[2],lambda x:x['protected_witnesses'][0].__setitem__('sha256','0'*64),'SOURCE_SHA256:')
    add('source-path-traversal',FILES[1],lambda x:row(x,'F01')['source_refs'][0].__setitem__('path','../escape'),'SOURCE_PATH')
    add('source-path-fake',FILES[1],lambda x:row(x,'F01')['source_refs'][0].__setitem__('path','apps/no-such-file.ts'),'SOURCE_ABSENT:')
    add('false-pro-alias',FILES[1],lambda x:row(x,'P01').__setitem__('legacy_ids',['V2-P02']),'P_ALIAS:')
    for key in ['task_rows','adr_rows']:
        add('omit-history-'+key,FILES[4],lambda x,k=key:x[k].pop(),'HISTORICAL_IDENTITIES:')
        add('accept-history-'+key,FILES[4],lambda x,k=key:x[k][-1].__setitem__('original_status','ACCEPTED'),'HISTORICAL_STATUS:')
        add('forge-history-'+key,FILES[4],lambda x,k=key:x[k][-1].__setitem__('live_record_sha256','0'*64),'HISTORICAL_RECORD:')
    add('erase-M103-prerequisite',FILES[3],lambda x:x['protected_dependencies'].__setitem__('M2-01',[]),'M103_TO_M2')
    add('authorize-M2-node',FILES[3],lambda x:next(n for n in x['nodes'] if n['id']=='R08-LEDGER').__setitem__('implementation_authorized',True),'DAG_NOT_ISSUANCE:')
    add('remove-ledger-custody',FILES[3],lambda x:next(n for n in x['nodes'] if n['id']=='R08-LEDGER')['depends_on'].clear(),'LEDGER_CUSTODY')
    add('DAG-cycle',FILES[3],lambda x:next(n for n in x['nodes'] if n['id']=='R08-GOV')['depends_on'].append('R08-APPLE'),'DAG_CYCLE:')
    add('DAG-duplicate-ownership',FILES[3],lambda x:next(n for n in x['nodes'] if n['id']=='R08-LEDGER')['owns'].append('F02'),'DAG38_EXACT_OWNERS')
    add('J05-priority-as-admission',FILES[3],lambda x:x.__setitem__('j05_measurement_enabled',True),'PRIORITY_NOT_J05_ADMISSION')

    with tempfile.TemporaryDirectory(prefix='onskin-release08-') as temporary:
        fixture = Path(temporary)/'bundle'
        shutil.copytree(BUNDLE, fixture)
        def run(name, expected_exit, expected_error=None):
            command = [sys.executable, '-B', str(HERE/'check.py'), '--bundle-dir', str(fixture)]
            result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
            message = json.loads(result.stdout)
            print(json.dumps(dict(case=name,argv=command,cwd=str(ROOT),exit=result.returncode,
                                  expected_exit=expected_exit,result=message)), flush=True)
            assert result.returncode == expected_exit, (name,result.stdout,result.stderr)
            if expected_error:
                # Structure may reject a mutation earlier than the semantic guard.
                # Accept only its own structural rejection, never an unrelated source failure.
                assert expected_error in message['error'] or message['error'].startswith('SCHEMA_'), (name,message)
        run('authentic-current',0)
        for name,file,mutate,expected in cases:
            changed = copy.deepcopy(original[file]); mutate(changed)
            (fixture/file).write_bytes((json.dumps(changed,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
            run(name,1,expected)
            (fixture/file).write_bytes((BUNDLE/file).read_bytes())
        # Parser refuses unknown keys, duplicate JSON names and NaN, with exit1.
        for name,raw in [('unknown-key', (fixture/FILES[0]).read_text(encoding='utf-8').replace('"schema_version": 1,','"schema_version": 1, "surprise_admitted": true,',1)),
                         ('duplicate-json-key','{"schema_version":1,"schema_version":1}'),
                         ('nonfinite-json','{"schema_version":NaN}')]:
            (fixture/FILES[0]).write_bytes(raw.encode('utf-8'));run(name,1)
            (fixture/FILES[0]).write_bytes((BUNDLE/FILES[0]).read_bytes())
        snapshot=fixture/'historical/roadmap_47.json';raw=snapshot.read_bytes()
        snapshot.write_bytes(raw+b'\n');run('authentic-history-byte-tamper',1,'AUTHENTIC_HISTORY:');snapshot.write_bytes(raw)
        run('authentic-restored',0)
    print(json.dumps(dict(passed=True,negative_cases=len(cases)+4,current_exit=0,
                         tampered_exits=1,restored_exit=0,qualification='BUNDLE_FIXTURES_ONLY_NOT_INDEPENDENT_CHECKOUT')))


if __name__ == '__main__':
    main()
