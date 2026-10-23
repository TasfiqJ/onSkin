"""Checkpoint-only verifier for the single externally anchored VP01 issuance."""
import argparse
import hashlib
import json
import pathlib
import subprocess

ANCHOR = 'cf3719c07e41699088bc25e9b3903610f49c1885c25417a8649a99238b290e24'
BASE = 'd2ce5e95cd24edb2ab4d833dee945bdbc59da9fe'
BASE_TREE = '604976823a08700009f8129273f3d0c3d7e34104'
SOURCE = '39390947063092ff67ac503cd0b86992eb65b941'
SOURCE_TREE = '0c4a1ceb61fa3d145f348a410284a78a82b144fd'
PREFIX = 'docs/brain/checkpoints/M1-03/SECURITY-VITEST-PATCH-01/'
LOCK_SHA = '6557c859298af02363aeb9c1efb37240de0bddfd3f4f4bffa93d34a85b9e8242'
POSTIMAGES = {
    'apps/mobile/package.json': 'ee2adeb11eda8ff8ee7fd4a36f69c29817883e7825d0ea62e43de358862e5361',
    'apps/catalog-operator-console/package.json': '10fce1f7fc5ab515f3ddb8825c0b223c51cb4fe404b32b39b009e4055a128903',
    'package-lock.json': LOCK_SHA,
    'docs/phase-9/ios-sdk-package-mapping.json': '40abcddf562853d8d2312ace7ea31c9d97d69903b59594bddc5a78a82f479fcd',
    'docs/phase-9/generated/ios-privacy-source-audit.json': 'b92d7c23744b9700cd5c15036b76f42dc3d95708c9665395bc483da91208bcfd',
    'docs/phase-9/generated/ios-privacy-source-audit.md': '1ff659c00353fbfac38f7bf47d058cdef0249119d9f8c6c271895aa5cd949ed2',
}
WORKLIST_HASHES = {'docs/phase-4/generated/source-worklist.json': '32bc072fccf212e79e06c3a7018e9c74efd6bd231a877f06f38773d4cb6e2c6e', 'docs/phase-4/generated/source-worklist.md': '66d30fd8140d1b3c98b0df3ba831d011efdbd30cc95ada5d661f6c6ecaa78915'}  # Filled from original producer output, never from hand edits.
FALSE_GATES = {'protected_source_go', 'hosted_replay_authorized', 'main_promotion_authorized', 'database_go', 'm2_authorized', 'release_authorized', 'archive_signoff', 'device_signoff', 'native_privacy_signoff'}
REPORT_KEYS = {'schema_version','authorization_id','iteration','status','source','delivery','context','scope','dependency_remediation','ios_source_provenance','checks','ci','blockers','boundaries','context_health','independent_brain_review_required'}

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def need(ok, code):
    if not ok:
        raise ValueError(code)

def verify_paths(changes, allowed, base_paths):
    for path, status in changes:
        need(status in {'A','M'}, 'DELETION_RENAME_OR_TYPE_CHANGE:'+path)
        if path in base_paths:
            need(path in allowed, 'UNAUTHORIZED_EXISTING_PATH:'+path)
        else:
            need(path.startswith(PREFIX), 'UNAUTHORIZED_NEW_PATH:'+path)

def verify_source(read, original, pins=None):
    for path in ('apps/mobile/package.json','apps/catalog-operator-console/package.json'):
        before = original(path)
        need(before.count(b'"vitest": "^4.1.11"') == 1, 'BASE_MANIFEST')
        need(read(path) == before.replace(b'"vitest": "^4.1.11"', b'"vitest": "^4.1.12"'), 'MANIFEST_SCOPE:'+path)
    lock_raw = read('package-lock.json')
    lock = json.loads(lock_raw)
    old_lock = json.loads(original('package-lock.json'))
    need(set(lock['packages']) == set(old_lock['packages']), 'PACKAGE_SET_DRIFT')
    for name, sri in {
        'vitest':'sha512-5eWdz2yb3ajxWF3C8C4TjkXl7FGm3n2E/VlazALrQHzK7nYMSGFnCZto0bbPNl77AwkOZVLk0YnBAejUu0NiWA==',
        '@vitest/mocker':'sha512-fKShNpKZzupWZuY0z7egydvL0sqW4INEZBEExMBMAa6izlENEVHwoXgdaTCaBZ5fwlr4xf2o1wXC83n9RpO+NA==',
    }.items():
        item=lock['packages']['node_modules/'+name]
        need(item['version']=='4.1.12' and item['integrity']==sri, 'TARGET_INTEGRITY:'+name)
    need(digest(lock_raw)==LOCK_SHA, 'REVIEWED_NPM_LOCK_BYTES')
    old_mapping_raw=original('docs/phase-9/ios-sdk-package-mapping.json')
    mapping_raw=read('docs/phase-9/ios-sdk-package-mapping.json')
    need(mapping_raw==old_mapping_raw.replace(digest(original('package-lock.json')).encode(),LOCK_SHA.encode()), 'MAPPING_SCOPE_OR_FORGED_APPROVAL')
    mapping=json.loads(mapping_raw)
    entries=0; count=0
    for item in mapping['mappings']:
        need(item['archiveRequired'] is True and item['notes']['evidenceLevel']=='source_candidate', 'ARCHIVE_CLAIM')
        for entry in item['lockIntegrity']['entries']:
            need(old_lock['packages'][entry['path']]==lock['packages'][entry['path']], 'MAPPED_IDENTITY_DRIFT')
            entries+=1
        for pin in item['notes']['sourcePins']:
            count+=1
            if pins is not None:
                try: actual=pins(pin['path'])
                except OSError as exc: raise ValueError('MISSING_INSTALLED_PIN:'+pin['path']) from exc
                need(digest(actual)==pin['sha256'], 'FAKE_INSTALLED_PIN:'+pin['path'])
    need((entries,count)==(4,10), 'MAPPED_PIN_COUNT')
    for path, expected in POSTIMAGES.items():
        need(digest(read(path))==expected, 'POSTIMAGE_DRIFT:'+path)

def verify_npm_provenance(receipt):
    need(receipt['npm_version']=='11.20.0', 'FOREIGN_NPM_VERSION')
    need(receipt['lock_sha256']==LOCK_SHA, 'FOREIGN_NPM_LOCK')
    need(receipt['regeneration_command']==['npm','install','--package-lock-only','--ignore-scripts','--no-audit','--no-fund'], 'FOREIGN_NPM_COMMAND')
    need(receipt['tarball_url']=='https://registry.npmjs.org/npm/-/npm-11.20.0.tgz', 'FOREIGN_NPM_TARBALL')
    need(receipt['tarball_sha256']==NPM_TARBALL_SHA, 'FOREIGN_NPM_TARBALL_BYTES')

HANDOFF_SHA = 'b17073927468758c19508b96889ae582cd1d550afbd77f14369e147b928301e6'

NPM_TARBALL_SHA = 'd1a92f40e6c407b84c3a00c3cf978a10b24fd42f153c527e2016cef7bb34a483'

def verify_report(report):
    need(set(report)==REPORT_KEYS and report['schema_version']==1, 'REPORT_SCHEMA')
    need(report['authorization_id']=='M103-SECURITY-VITEST-PATCH01-SOURCE-EDIT-01' and report['iteration']=='SECURITY-VITEST-PATCH-01', 'REPORT_AUTHORITY')
    need(report['status']=='SUBMITTED_REVIEW_REQUIRED' and report['independent_brain_review_required'] is True, 'SELF_ACCEPTANCE')
    need(report['source']=={'implementation_sha':SOURCE,'implementation_tree':SOURCE_TREE,'clean_measured_sha':SOURCE,'clean_measured_tree':SOURCE_TREE}, 'SOURCE_BINDING')
    need(report['context']['external_manifest_sha256']==ANCHOR and report['context']['preimages_verified']==36, 'CONTEXT_BINDING')
    boundaries=report['boundaries']
    need(set(boundaries)==FALSE_GATES|{'accepted_tasks','incremental_spend_usd','security_admission','original_security_expiry_utc'}, 'BOUNDARY_SCHEMA_OR_WAIVER')
    need(all(boundaries[k] is False for k in FALSE_GATES), 'FORGED_GO')
    need(boundaries['accepted_tasks']==['M0-01','M0-02','M1-01','M1-02'], 'FALSE_TASK_ACCEPTANCE')
    need(boundaries['incremental_spend_usd']==0 and boundaries['security_admission']=='CLOSED', 'FALSE_ADMISSION_OR_SPEND')
    need(boundaries['original_security_expiry_utc']=='2026-10-21T00:00:00Z', 'EXPIRED_SECURITY_WAIVER')
    need(report['dependency_remediation']['lock_sha256']==LOCK_SHA, 'REPORT_LOCK_BINDING')
    need(isinstance(report['checks'],list) and bool(report['checks']), 'MISSING_CHECKS')
    for row in report['checks']:
        need(set(row)=={'name','exit_code','result','details','receipt','transcript'}, 'CHECK_SCHEMA')
        need(type(row['exit_code']) is int, 'INVENTED_EXIT')
        need(row['result'] in {'PASS','FAIL','BLOCKED'}, 'CHECK_RESULT')
        need(row['result']!='PASS' or row['exit_code']==0, 'FAILED_CHECK_CALLED_PASS')
    need(report['delivery']['final_sha_in_this_tree'] is None, 'FUTURE_SELF_HASH')

def verify(root, head='HEAD', check_worktree=True):
    checkpoint=pathlib.Path(__file__).resolve().parent
    context=checkpoint/'inputs'
    need(digest((context/'TASK_MANIFEST.json').read_bytes())==ANCHOR, 'EXTERNAL_ANCHOR')
    subprocess.run(['python3','-B',str(context/'verify_context.py'),'--expected-manifest-sha256',ANCHOR],cwd=context,check=True)
    auth=json.loads((context/'SOURCE_EDIT_AUTHORIZATION.json').read_bytes())
    def command(*args): return subprocess.check_output(['git','-C',str(root),*args])
    def value(*args): return command(*args).decode().strip()
    def read_at(revision,path): return command('show',revision+':'+path)
    need(value('rev-parse',BASE+'^{tree}')==BASE_TREE, 'BASE_TREE')
    need(value('rev-parse',SOURCE+'^{tree}')==SOURCE_TREE, 'MEASURED_SOURCE_TREE')
    need(value('branch','--show-current')==auth['branch'], 'WRONG_BRANCH')
    need(subprocess.run(['git','-C',str(root),'merge-base','--is-ancestor',BASE,head]).returncode==0, 'NON_DESCENDANT')
    for item in auth['allowed_existing_files']+auth['protected_unchanged']:
        raw=read_at(BASE,item['path'])
        need((len(raw),digest(raw),value('rev-parse',BASE+':'+item['path']))==(item['bytes'],item['sha256'],item['git_blob']), 'PREIMAGE:'+item['path'])
    base_paths=set(value('ls-tree','-r','--name-only',BASE).splitlines())
    allowed={item['path'] for item in auth['allowed_existing_files']}
    history=value('rev-list','--reverse',BASE+'..'+head).splitlines()
    previous=BASE
    for commit in history:
        need(value('rev-list','--parents','-n','1',commit).split()==[commit,previous], 'NONLINEAR_OR_UNAUTHORIZED_INTERMEDIATE_COMMIT')
        changes=[]
        for line in value('diff-tree','--no-commit-id','--name-status','-r','--no-renames',commit).splitlines():
            status,path=line.split('\t');changes.append((path,status))
        verify_paths(changes,allowed,base_paths)
        verify_source(lambda p:read_at(commit,p),lambda p:read_at(BASE,p))
        for path,expected in WORKLIST_HASHES.items():
            need(digest(read_at(commit,path)) in {expected,digest(read_at(BASE,path))}, 'NONCANONICAL_INTERMEDIATE_WORKLIST')
        need(digest(read_at(commit,'ONSKIN_BRAIN_HANDOFF.txt')) in {HANDOFF_SHA,digest(read_at(BASE,'ONSKIN_BRAIN_HANDOFF.txt'))}, 'UNTRUTHFUL_HANDOFF_BYTES')
        previous=commit
    for line in value('ls-tree','-r',head).splitlines():
        meta,path=line.split('\t')
        if path.startswith(PREFIX): need(meta.split()[0]=='100644' and meta.split()[1]=='blob', 'NONREGULAR_CHECKPOINT_ARTIFACT')
    if check_worktree:
        need(not command('status','--porcelain=v1').strip(), 'DIRTY_DELIVERY')
        verify_source(lambda p:(root/p).read_bytes(),lambda p:read_at(BASE,p),lambda p:(root/p).read_bytes())
    verify_npm_provenance(json.loads((checkpoint/'evidence/npm-regeneration-provenance.json').read_bytes()))
    verify_report(json.loads((checkpoint/'completion-report.json').read_bytes()))
    print('VP01 EXACT SCOPE PASS:',len(history),'normal commits; 36 preimages; exact six code postimages; four package identities; ten installed source pins; protected files unchanged through every commit')

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--repo',type=pathlib.Path,required=True)
    parser.add_argument('--head',default='HEAD')
    args=parser.parse_args()
    verify(args.repo,args.head)
