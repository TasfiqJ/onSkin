"""Bounded LOCAL ONLY artifact triage; emits category counts, never finding data.

Supply an externally pinned, independently fetched GitHub metadata envelope.
An intact report remains UNREVIEWED (exit 1); missing/corrupt evidence is
INCOMPLETE (exit 2). No network, secret verification, waiver or owner decision.
"""
import argparse
from collections import Counter
import datetime
import io
import json
from pathlib import Path
import re
import stat
import zipfile
import source_inventory as inv

LIMIT = 64 * 1024**2
MEMBERS = {'secret-scan-proof.json', 'gitleaks-results.sarif', 'gitleaks-tool.json', 'secret-scan-outcomes.json'}
TOOLS = {
    'gitleaks': ('8.24.3', '9991e0b2903da4c8f6122b5c3186448b927a5da4deef1fe45271c3793f4ee29c', 'e18325d568268b6efb6cd0cc721f8bea5667f4cd1c8d03618ab61987f41269ad'),
    'trufflehog': ('3.99.3', '029b182e0ed35fd5b02cd1eadc2a94bd457ab14ad22a9380b6e5d9652261d28d', 'f315489f12691f669fd16bafeaf983168dcdd22c0652b541ff7e41dc7da9aa61'),
}
# Public rule identifiers only. Unknown input never becomes user-visible text.
RULES = {'generic-api-key', 'sentry-access-token', 'private-key', 'jwt', 'vault-service-token',
         'slack-bot-token', 'stripe-access-token', 'aws-access-token'}
CATEGORIES = {r: ('generic-pattern-requires-content-review' if r=='generic-api-key' else
                  'private-key-material-requires-owner-review' if r=='private-key' else
                  'service-token-pattern-requires-owner-review') for r in RULES}
need = inv.need

def archive(raw):
    need(len(raw) <= LIMIT, 'ARCHIVE_BOUND')
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        seen=set(); total=0
        for entry in z.infolist():
            key=inv.path_key(entry.filename)
            need(key not in seen, 'ARCHIVE_COLLISION'); seen.add(key)
            need(stat.S_IFMT(entry.external_attr>>16) in (0,stat.S_IFREG) and
                 not entry.external_attr&1024 and not entry.flag_bits&1, 'ARCHIVE_MODE')
            total+=entry.file_size
            need(entry.file_size<=LIMIT and total<=2*LIMIT, 'ARCHIVE_BOUND')
        need({e.filename for e in z.infolist()} == MEMBERS, 'ARTIFACT_INVENTORY')
        # Reading every bounded member verifies its CRC. No files are extracted.
        return {name:z.read(name) for name in MEMBERS}

def provenance(envelope, raw, expected_head, expected_scan, expected_tree):
    need(envelope['schema']==1 and envelope['repository']=='TasfiqJ/onSkin' and
         envelope['head_sha']==expected_head and envelope['scan_sha']==expected_scan and
         envelope['tree']==expected_tree, 'PROVENANCE_SOURCE')
    for value,size in [(expected_head,40),(expected_scan,40),(expected_tree,40)]:
        need(isinstance(value,str) and re.fullmatch('[0-9a-f]{'+str(size)+'}',value),'PROVENANCE_SHA')
    a=envelope['artifact']; run=envelope['run']; job=envelope['job']
    need(type(envelope['run_id']) is int and envelope['run_id']>0 and
         type(envelope['attempt']) is int and envelope['attempt']>0, 'PROVENANCE_RUN')
    need(a['expired'] is False and a['digest']=='sha256:'+inv.sha(raw) and
         a['size_in_bytes']==len(raw) and type(a['id']) is int and a['id']>0 and
         a['name']=='secret-scanner-evidence-'+str(envelope['run_id']) and
         a['workflow_run']['id']==envelope['run_id'] and
         a['workflow_run']['head_sha']==expected_head and
         a['workflow_run']['repository_id']==1267954179 and
         a['workflow_run']['head_repository_id']==1267954179, 'ARTIFACT_PROVENANCE')
    need(run['id']==envelope['run_id'] and run['head_sha']==expected_head and
         run['event']=='pull_request' and run['path']=='.github/workflows/security.yml' and
         run['name']=='Security' and run['run_attempt']==envelope['attempt'] and
         run['status']=='completed' and run['conclusion'] in ('success','failure') and
         job['run_id']==run['id'] and job['name']=='Secret scanning' and
         job['status']=='completed' and job['conclusion'] in ('success','failure'), 'WORKFLOW_PROVENANCE')
    return a

def source_binding(proof, envelope, root):
    source=proof['source']
    need(source['head']==envelope['scan_sha'] and source['tree']==envelope['tree'] and
         proof['run_id']==str(envelope['run_id']) and
         proof['context']==dict(kind='ORIGINAL_SECRET_GITHUB_ACTIONS', repository='TasfiqJ/onSkin',
             workflow='Security',job='secret-scan',attempt=str(envelope['attempt'])), 'PROOF_BINDING')
    need(source['parents']==[inv.git(root,'rev-parse',envelope['scan_sha']+'^1').decode().strip(),envelope['head_sha']] and
         inv.git(root,'rev-parse',envelope['scan_sha']+'^{tree}').decode().strip()==envelope['tree'] and
         inv.git(root,'rev-parse',envelope['head_sha']+'^{tree}').decode().strip()==envelope['tree'], 'MERGE_SOURCE_BINDING')
    refs={}
    for row in source['refs']:
        ref,oid=row.split()
        need(ref.startswith('refs/') and ref not in refs and re.fullmatch('[0-9a-f]{40}',oid),'SOURCE_REFS')
        refs[ref]=oid
    need(refs.get(proof['source_ref'])==envelope['scan_sha'] and len(refs)<=10000,'SOURCE_REF_BINDING')
    commits=inv.git(root,'rev-list',*sorted(set(refs.values())),envelope['scan_sha']).decode().splitlines()
    need(source['commits']==sorted(set(commits)) and source['patch_commits']==sorted(set(source['patch_commits'])) and
         set(source['patch_commits'])<=set(commits),'HISTORY_COVERAGE')
    patch_commits=set(); current_commit=None
    history=inv.git(root,'log','--full-history','--diff-merges=first-parent','--format=COMMIT%H',
                    '--numstat','--diff-filter=d',*sorted(set(refs.values())),envelope['scan_sha'])
    for line in history.decode('utf-8').splitlines():
        if line.startswith('COMMIT'):current_commit=line[6:]
        elif re.match(r'^\d+\t\d+\t',line):patch_commits.add(current_commit)
    need(source['patch_commits']==sorted(patch_commits),'HISTORY_PATCH_COVERAGE')
    current=inv.snapshot(root,envelope['head_sha'])
    rows=[dict(path=n,mode=r['mode'],object=r['blob'],bytes=r['bytes'],sha256=r['sha256']) for n,r in current.items()]
    need(source['snapshot']==rows and source['snapshot_sha256']==inv.sha(inv.canonical(rows)),'SNAPSHOT_COVERAGE')
    # Authenticate original scanner/rule/workflow sources, never rebind them.
    for leaf,digest in inv.PINS.items():
        need(inv.sha(inv.regular(Path(root)/(inv.PREFIX+leaf)))==digest,'ADAPTER_SOURCE_DRIFT')

def commands(proof):
    need(all(isinstance(proof[n],str) and proof[n].startswith('/') and '\0' not in proof[n]
             for n in ['mirror','snapshot','sarif','current_report']), 'COMMAND_PATH_SCHEMA')
    tools=proof['tools'];need(set(tools)==set(TOOLS),'TOOL_INVENTORY')
    for name,(version,asset,binary) in TOOLS.items():
        t=tools[name]; vr=t['version_result']
        need(t['version']==version and t['asset']==asset and t['binary']==binary and
             t['url']=='https://github.com/'+('gitleaks/gitleaks' if name=='gitleaks' else 'trufflesecurity/trufflehog')+
             '/releases/download/v'+version+'/'+name+'_'+version+('_linux_x64.tar.gz' if name=='gitleaks' else '_linux_amd64.tar.gz') and
             vr['exit']==0 and vr['argv']==[t['path'],'version' if name=='gitleaks' else '--version'] and
             vr['stdout']+vr['stderr']==('8.24.3\n' if name=='gitleaks' else 'trufflehog 3.99.3\n'), 'OFFICIAL_TOOL_PIN')
    gl=tools['gitleaks']['path']; th=tools['trufflehog']['path']; common=['--redact=100','--exit-code=2','--log-level=info']
    expected={
        'gitleaks-history':[gl,'detect','--source='+proof['mirror'],'--log-opts=--all --full-history --diff-merges=first-parent',*common,'--report-format=sarif','--report-path='+proof['sarif']],
        'gitleaks-current':[gl,'detect','--no-git','--source='+proof['snapshot'],*common,'--report-format=json','--report-path='+proof['current_report']],
        'trufflehog-history':[th,'git','file://'+proof['mirror'],'--bare','--fail','--no-update','--json','--only-verified','--concurrency=1'],
        'trufflehog-current':[th,'filesystem',proof['snapshot'],'--fail','--no-update','--json','--only-verified','--concurrency=1'],
    }
    need(set(proof['commands'])==set(expected),'COMMAND_INVENTORY')
    start,end=[datetime.datetime.fromisoformat(proof[k]) for k in ('started','finished')]
    need(start.tzinfo is not None and end.tzinfo is not None and start<=end,'PROOF_TIME')
    for name,argv in expected.items():
        row=proof['commands'][name]
        need(row['argv']==argv and row['cwd']==proof['mirror'].rsplit('/',1)[0],'COMMAND_SCOPE')
        need(start<=datetime.datetime.fromisoformat(row['started'])<=datetime.datetime.fromisoformat(row['finished'])<=end,'COMMAND_TIME')
        need(type(row['exit']) is int and row['exit'] in ((0,2) if name.startswith('gitleaks') else (0,183)),'SCANNER_ERROR')
        for stream in ('stdout','stderr'):
            need(isinstance(row[stream],str) and inv.sha(row[stream].encode())==row[stream+'_sha256'],'SCANNER_OUTPUT_CORRUPT')
        if name.startswith('gitleaks'):
            clean=re.sub(r'\x1b\[[0-9;]*m','',row['stderr'])
            need(re.search(r'scanned ~\d+ bytes .* in ',clean) and re.search(r'(?:no leaks found|leaks found: \d+)\s*$',clean),'SCANNER_OUTPUT_TRUNCATED')
            if name.endswith('history'):
                counts=re.findall(r'(\d+) commits scanned',clean)
                need(len(counts)==1 and int(counts[0])==len(proof['source']['patch_commits']),'HISTORY_COUNT')
        else:
            events=[inv.parse(line.encode()) for line in row['stderr'].splitlines() if line.strip()]
            need(bool(events) and all(isinstance(e,dict) for e in events),'VERIFIED_ONLY_INCOMPLETE')
            finish=[e for e in events if e.get('msg')=='finished scanning']
            need(row['exit']==0 and not row['stdout'].strip() and len(finish)==1 and events[-1]==finish[0] and
                 finish[0].get('trufflehog_version')=='3.99.3' and finish[0].get('chunks',0)>0 and
                 finish[0].get('bytes',0)>0 and finish[0].get('verified_secrets')==0 and
                 finish[0].get('unverified_secrets')==0 and not any(e.get('level')=='error' or 'error' in e for e in events),'VERIFIED_ONLY_INCOMPLETE')

def aggregate(records, command, current, snapshot_prefix=''):
    need(isinstance(records,list) and len(records)<=1000000,'REPORT_SCHEMA')
    clean=re.sub(r'\x1b\[[0-9;]*m','',command['stderr'])
    counts=re.findall(r'leaks found: (\d+)\s*$',clean)
    need((command['exit']==2 and len(counts)==1 and int(counts[0])==len(records) and bool(records)) or
         (command['exit']==0 and not records and re.search(r'no leaks found\s*$',clean)), 'FULL_COUNT_INCONSISTENT')
    seen=set(); fingerprints=[]; rules=Counter()
    for record in records:
        need(isinstance(record,dict),'RECORD_SCHEMA')
        digest=inv.sha(inv.canonical(record)); need(digest not in seen,'DUPLICATE_RECORD'); seen.add(digest)
        rule=record['RuleID' if current else 'ruleId']; need(rule in RULES,'UNKNOWN_RULE')
        if current:
            name=record['File'];need(isinstance(name,str) and name.startswith(snapshot_prefix+'/'),'OFF_SNAPSHOT_FINDING')
            inv.path_key(name[len(snapshot_prefix)+1:])
            need(type(record['StartLine']) is int and type(record['EndLine']) is int and
                 1<=record['StartLine']<=record['EndLine'] and isinstance(record['Fingerprint'],str) and
                 bool(record['Fingerprint']),'RECORD_LOCATION')
            fingerprints.append(record['Fingerprint'])
        else:
            need(len(record['locations'])>=1,'RECORD_LOCATION')
            for location in record['locations']:
                physical=location['physicalLocation'];uri=physical['artifactLocation']['uri']
                inv.path_key(uri[2:] if uri.startswith('./') else uri)
                need(type(physical['region']['startLine']) is int and physical['region']['startLine']>=1,'RECORD_LOCATION')
        rules[rule]+=1
    return dict(total=len(records),categories=[dict(rule=r,category=CATEGORIES[r],count=n) for r,n in sorted(rules.items())],
                fingerprint_collision_count=len(fingerprints)-len(set(fingerprints)), disposition='UNREVIEWED')

def triage(raw, envelope_raw, envelope_sha, head, scan, tree, root):
    need(inv.sha(envelope_raw)==envelope_sha,'EXTERNAL_PROVENANCE_ANCHOR')
    envelope=inv.parse(envelope_raw);a=provenance(envelope,raw,head,scan,tree)
    files=archive(raw);proof=inv.parse(files['secret-scan-proof.json'])
    need(set(proof)=={'schema','purpose','context','source','source_ref','run_id','started','finished','tools','commands','mirror','snapshot','sarif','current_report','sarif_sha256'} and
         proof['schema']==1 and proof['purpose']=='ORIGINAL_SECRET_DIAGNOSTIC_NOT_G97_ACCEPTANCE','PROOF_SCHEMA')
    source_binding(proof,envelope,root);commands(proof)
    report=inv.parse(files['gitleaks-results.sarif'])
    need(inv.sha(files['gitleaks-results.sarif'])==proof['sarif_sha256'] and report['version']=='2.1.0' and
         len(report['runs'])==1 and report['runs'][0]['tool']['driver']['name']=='gitleaks','SARIF_PROVENANCE')
    need(inv.parse(files['gitleaks-tool.json'])==dict(version='8.24.3',sha256=TOOLS['gitleaks'][2],exit=0),'TOOL_RECEIPT')
    outcomes=inv.parse(files['secret-scan-outcomes.json'])
    need(outcomes==dict(job='secret-scan',sha=scan,run_id=str(envelope['run_id']),gitleaks='failure',gitleaks_exit='2',trufflehog='success'),'JOB_OUTCOMES')
    current=aggregate(proof['commands']['gitleaks-current']['report'],proof['commands']['gitleaks-current'],True,proof['snapshot'])
    history=aggregate(report['runs'][0]['results'],proof['commands']['gitleaks-history'],False)
    return dict(schema=1,status='UNREVIEWED',acceptanceGranted=False,head=head,scanned_commit=scan,tree=tree,
                artifact=dict(id=a['id'],sha256=inv.sha(raw),bytes=len(raw),run_id=envelope['run_id'],job_id=envelope['job']['id']),
                provenance_sha256=envelope_sha,member_receipts=[dict(member=n,bytes=len(b),sha256=inv.sha(b)) for n,b in sorted(files.items())],
                current=current,history=history,scope_counts={k:len(proof['source'][k]) for k in ['snapshot','refs','commits','patch_commits']},
                scanner=dict(version='8.24.3',official_asset_sha256=TOOLS['gitleaks'][1],binary_sha256=TOOLS['gitleaks'][2],current_exit=2,history_exit=2),
                verified_only_trufflehog='EXIT0_IS_NOT_GITLEAKS_CLEARANCE',
                limitation='COUNTS_AND_BYTE_PROVENANCE_ONLY_NO_CREDENTIAL_LIVENESS_OR_FALSE_POSITIVE_DISPOSITION')

def main():
    p=argparse.ArgumentParser(description=__doc__)
    for name in ['artifact','provenance','repo']:p.add_argument('--'+name,type=Path,required=True)
    for name in ['expected-provenance-sha256','head','scan','tree']:p.add_argument('--'+name,required=True)
    a=p.parse_args()
    try:
        result=triage(inv.regular(a.artifact),inv.regular(a.provenance),a.expected_provenance_sha256,a.head,a.scan,a.tree,a.repo)
        print(json.dumps(result,sort_keys=True));return 1
    except Exception:
        # Never include an exception string: parsers may quote raw sensitive input.
        # Every ordinary malformed-input/parser/I/O failure is INCOMPLETE. Process
        # cancellation remains outside Exception and is never reported as triage.
        print('{"status":"INCOMPLETE","acceptanceGranted":false}');return 2

if __name__=='__main__':
    raise SystemExit(main())
