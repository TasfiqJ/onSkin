"""Release28 refusal controls. Synthetic controls remain separate from authenticated full-checkout historical replay."""
import argparse
import ast
import copy
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import stat
import struct
import subprocess
import tempfile
from unittest.mock import patch
import zipfile
import re
import secrets
import sys
import time


def require28(value, code):
    if not value: raise ValueError(code)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--source-root',type=Path,default=Path(__file__).resolve().parents[3])
    parser.add_argument('--checker',type=Path)
    parser.add_argument('--historical-replay',action='store_true')
    parser.add_argument('--receipt',type=Path)
    args=parser.parse_args()
    source=args.source_root.resolve()
    require28(source==Path(__file__).resolve().parents[3],'R28_CURRENT_CHECKOUT_ARGUMENT')
    require28(args.checker is None,'R28_CURRENT_CHECKER_ARGUMENT')
    actual=source/'scripts/release/full-app-j01/check.py'
    raw=actual.read_bytes()
    namespace={'__name__':'release28_consumer','__file__':str(actual)}
    exec(compile(raw,str(actual),'exec'),namespace)
    class Module: pass
    check=Module();check.__dict__=namespace
    runner=source/'scripts/release/full-app-j01/replay28.py'
    runner_raw=runner.read_bytes()
    assert hashlib.sha256(runner_raw).hexdigest()==check.RELEASE28_REPLAY_SHA256
    replay_namespace={'__name__':'release28_controls','__file__':str(runner)}
    exec(compile(runner_raw,str(runner),'exec'),replay_namespace)
    for name in ('require28','PINNED28','LOCK28_SHA256','NATIVE28_PINS_SHA256','receipt28_guard',
        'consumer_result28','child28','replay28','installation28','checkout28'):
        globals()[name]=replay_namespace[name]
    require28(not args.historical_replay,'R28_SEPARATE_REPLAY_COMMAND')
    require28(args.receipt is None,'R28_RECEIPT_ARGUMENT')
    require28(sys.flags.optimize == 0,'R28_ASSERTIONS_REQUIRED')
    encoded=lambda value:(json.dumps(value,sort_keys=True)+'\n').encode()
    positive=refused=0
    def expect(name,action,code=None,success=False):
        nonlocal positive,refused
        try: action()
        except (ValueError,KeyError,TypeError,OSError,subprocess.SubprocessError) as error:
            assert not success and (code is None or code in str(error)),(name,type(error).__name__,str(error))
            refused+=1;print(json.dumps(dict(case=name,exit=1,expectedExit=1,code=code)),flush=True)
        else:
            assert success,name+' unexpectedly admitted'
            positive+=1;print(json.dumps(dict(case=name,exit=0,expectedExit=0)),flush=True)
    candidate=dict(schema=1,authority=check.RELEASE28_AUTHORITY,status='SUBMITTED_REVIEW_REQUIRED',base=check.RELEASE28_BASE,
        tree=check.RELEASE28_TREE,scopeCommit=check.RELEASE28_PLAN_COMMIT,scopePlanSHA256=check.RELEASE28_PLAN_SHA256,
        inputManifestSHA256=check.RELEASE28_INPUT,acceptanceGranted=False,
        admissions=dict(G97=False,DB=False,M103=False,M2=False,J01=False,PUBLIC=False),pr=None)
    plan=(source/check.RELEASE28_PLAN).read_bytes()
    expect('exact-committed-plan',lambda:check.scope28_guard(plan),success=True)
    expect('exact-nonadmitting-contract',lambda:check.candidate28_guard(encoded(candidate)),success=True)
    for key,value in [('schema',True),('schema',1.0),('pr',True),('pr',0),('pr',-1),('pr',29.0),
        ('acceptanceGranted',0),('acceptanceGranted',None),('status','ACCEPTED'),('base','0'*40),
        ('tree','0'*40),('scopeCommit','0'*40),('scopePlanSHA256','0'*64),('inputManifestSHA256','0'*64),('authority','UNISSUED')]:
        changed=copy.deepcopy(candidate);changed[key]=value
        expect('contract-type-or-authority:'+key+':'+repr(value),lambda v=changed:check.candidate28_guard(encoded(v)),'R28_NO_ADMISSION')
    for key in candidate['admissions']:
        for value in (True,0,None,'false'):
            changed=copy.deepcopy(candidate);changed['admissions'][key]=value
            expect('closed-admission:'+key+':'+repr(value),lambda v=changed:check.candidate28_guard(encoded(v)),'R28_NO_ADMISSION')
    for body in (b'[]',b'{}',encoded(candidate).replace(b'"schema": 1',b'"schema": 1,"schema": 1'),
        encoded(candidate).replace(b'"pr": null',b'"pr": NaN'),b' '*(65537)):
        expect('malformed-contract',lambda b=body:check.candidate28_guard(b))
    for changed in (plan+b'\n',plan.replace(b'five',b'four'),plan.replace(b'5/25',b'6/25')):
        if changed!=plan:expect('changed-plan-refused',lambda b=changed:check.scope28_guard(b),'R28_PLAN_IDENTITY')
    for path in ('../escape','/absolute','C:/drive','a\\b','A//b','A/../b','A/file.','NUL.txt','Ａ/file','a\x00b'):
        expect('unsafe-or-Unicode-path:'+repr(path),lambda p=path:check.name28(p,{}),'R28_PATH')
    for paths in [('A/file','a/other'),('a','a/child')]:
        def collision(paths=paths):
            identities={}
            for path in paths:check.name28(path,identities)
        expect('implicit-parent-alias-or-kind',collision,'R28_PATH_ALIAS')
    expect('authentic-append-only-checker',lambda:check.validate28_checker(raw),success=True)
    terminal=b"if __name__ == '__main__':\n    sys.exit(main())\n"
    before=check.git23('show',check.RELEASE28_BASE+':scripts/release/full-app-j01/check.py')
    old=[ast.dump(n,include_attributes=False) for n in ast.parse(before).body if isinstance(n,ast.FunctionDef)]
    new=[ast.dump(n,include_attributes=False) for n in ast.parse(raw).body if isinstance(n,ast.FunctionDef)]
    assert new[:len(old)]==old
    for addition,code in [(b'validate = validate28\n','R28_DUPLICATE_ASSIGNMENT'),
        (b'import socket\n','R28_MODULE_SCOPE'),(b'RELEASE28_SIDE_EFFECT = globals().clear()\n','R28_GLOBAL_SIDE_EFFECT'),
        (b'def arbitrary_injection(): pass\n','R28_FUNCTION_SCOPE')]:
        expect('module-injection:'+code,lambda b=addition:check.validate28_checker(raw[:-len(terminal)]+b+terminal),code)
    for a,b,code in [(b"'FAIL/NO_GO'",b"'PASS'",'R28_INHERITED_BYTES'),
        (b'source_guard = source28_guard\n',b'source_guard = source24_guard\n','R28_DISPATCH'),
        (b'validate = validate28\n',b'','R28_DISPATCH_REQUIRED'),
        (b"RELEASE28_EXISTING_APP = {",b"RELEASE28_EXISTING_APP = {'.github/workflows/security.yml',",'R28_AUTHENTIC_FINITE_GRANT')]:
        expect('checker-mutation:'+code,lambda a=a,b=b:check.validate28_checker(raw.replace(a,b,1)),code)
    body=next(n for n in ast.parse(raw).body if isinstance(n,ast.FunctionDef) and n.name=='source28_guard')
    segment=ast.get_source_segment(raw.decode('utf-8'),body).encode()
    bypass=raw.replace(segment,b'def source28_guard():\n    return {}\n',1)
    expect('source-guard-body-cannot-be-replaced',lambda:check.validate28_checker(bypass),'R28_APPENDIX_BYTES')
    for error in (RuntimeError('SYNTHETIC_CANARY'),OSError('SYNTHETIC_CANARY'),ValueError('SYNTHETIC_CANARY')):
        with patch.object(check,'validate28_checker',return_value=None),patch.object(check,'source28_guard',side_effect=error):
            expect('unknown-error-no-disclosure',check.validate28,'R28_EXECUTION_INCOMPLETE')
    with patch.object(check,'validate28_checker',return_value=None),patch.object(check,'source28_guard',return_value={}),patch.object(check,'historical21_validate',side_effect=ValueError('FINITE_IDS:SYNTHETIC_CANARY')):
        try:check.validate28()
        except ValueError as error:assert error.args==('FINITE_IDS:',)
        else:raise AssertionError('legacy refusal accepted')
        refused+=1
    with patch.object(check,'validate28_checker',return_value=None),patch.object(check,'source28_guard',return_value={'phase':'SOURCE'}),patch.object(check,'historical21_validate',return_value={'valid':True}):
        result=check.validate28();assert result['valid'] is True and result['release']=='NO_GO' and result['acceptanceGranted'] is False
        assert all(v is False for v in result['admissions'].values());positive+=1
    with patch.object(check,'validate27',return_value={'qualification':'UNCHANGED_HISTORICAL_ROUTE'}) as route:
        with tempfile.TemporaryDirectory(prefix='release28-external-bundle-') as directory:
            assert check.validate28(Path(directory))['qualification']=='UNCHANGED_HISTORICAL_ROUTE';route.assert_called_once();positive+=1
    with patch.dict(os.environ,{'GIT_DIR':'/synthetic/redirect'}):
        expect('Git-environment-before-endpoint',check.source28_endpoint,'R23_GIT_ENV')
        expect('Git-environment-before-store',check.full28_store,'R23_GIT_ENV')
    # Receipt/parser cases use explicit synthetic observations, never substitutes
    # for the separate --historical-replay command and its complete remote clones.
    nonce='a'*64;context={'synthetic':True};tools={'synthetic':True}
    records=[]
    for pin in PINNED28:
        snapshot=dict(head=pin['head'],tree=pin['tree'],trackedBlobs=23501,indexSHA256='b'*64,treeMetadataSHA256='c'*64)
        records.append(dict(release=pin['release'],head=pin['head'],tree=pin['tree'],
            checker=dict(mode='100644',blob=pin['checkerBlob'],sha256=pin['checkerSHA256']),
            consumer=dict(mode='100644',blob=pin['consumerBlob'],sha256=pin['consumerSHA256']),
            consumerResult=dict(exit=0,status='PASS',positiveControls=pin['positiveControls'] or 10,refusals=pin['refusals'] or 150,
                qualification=pin['qualification'],acceptanceGranted=False,release='NO_GO'),
            sourceResult=dict(exit=0,valid=True,release='NO_GO',acceptanceGranted=False,sourceAcceptance='SUBMITTED_REVIEW_REQUIRED',
                governance='RELEASE'+str(pin['release'])+'_FINITE_SCOPE_ONLY',qualification='INDEPENDENT_EXACT_HEAD_CHECKOUT_NO_CI_EVENT_CLAIM'),
            checkoutBefore=snapshot,checkoutAfter=snapshot,toolIdentityBefore=tools,toolIdentityAfter=tools,
            installation=dict(qualification='ACTUAL_NPM_CI_MANDATORY_HOOKS_AND_PINNED_NATIVE_SOURCE_ONLY',npmCiExit=0,
                mandatoryHooks=True,postinstallCheckExit=0,lockSHA256=LOCK28_SHA256,nativePinsCount=10,
                nativePinsSHA256=NATIVE28_PINS_SHA256,cacheMode='FRESH_EMPTY_EXTERNAL_NPM_CACHE',nativeDeviceOrSignedBuild='NOT_RUN')))
    receipt=dict(schema=1,status='PASS',qualification='AUTHENTIC_PINNED_HISTORICAL_SOURCE_REPLAY_NOT_SECURITY_ACCEPTANCE',
        acceptanceGranted=False,release='NO_GO',nonce=nonce,context=context,tools=tools,records=records)
    expect('synthetic-receipt-schema-positive',lambda:receipt28_guard(encoded(receipt),nonce,context,tools),success=True)
    for key,value in [('schema',True),('status','SKIPPED'),('acceptanceGranted',True),('release','GO'),('nonce','0'*64),
        ('context',{'stale':True}),('tools',{'swapped':True}),('tools',{'synthetic':1}),('records',[]),('records',records[::-1])]:
        changed=copy.deepcopy(receipt);changed[key]=value
        expect('synthetic-receipt-false-or-stale:'+key,lambda v=changed:receipt28_guard(encoded(v),nonce,context,tools))
    for body in (b'{}',b'[]',b'{',encoded(receipt).replace(b'"schema": 1',b'"schema": 1,"schema": 1'),
        encoded(receipt)+b'garbage',b' '*1048577):
        expect('synthetic-receipt-malformed-or-missing',lambda b=body:receipt28_guard(b,nonce,context,tools))
    for key,value in [('head','0'*40),('tree','0'*40),('checker',records[1]['checker']),('consumer',records[1]['consumer']),
        ('consumerResult',{**records[0]['consumerResult'],'exit':1}),('consumerResult',{**records[0]['consumerResult'],'status':'SKIPPED'}),
        ('checkoutAfter',{**records[0]['checkoutAfter'],'indexSHA256':'0'*64}),('toolIdentityAfter',{'swapped':True})]:
        changed=copy.deepcopy(receipt);changed['records'][0][key]=value
        expect('synthetic-replay-wrong-checkout-script-result:'+key,lambda v=changed:receipt28_guard(encoded(v),nonce,context,tools))
    for key,value in [('mode','100755'),('blob','0'*40),('sha256','0'*64)]:
        changed=copy.deepcopy(receipt);changed['records'][0]['consumer'][key]=value
        expect('synthetic-replay-consumer-identity:'+key,lambda v=changed:receipt28_guard(encoded(v),nonce,context,tools))
    missing=copy.deepcopy(receipt);del missing['records'][0]['sourceResult']
    expect('synthetic-replay-missing-component',lambda:receipt28_guard(encoded(missing),nonce,context,tools))
    for key,value in [('exit',False),('valid',1),('acceptanceGranted',0)]:
        changed=copy.deepcopy(receipt);changed['records'][0]['sourceResult'][key]=value
        expect('synthetic-replay-source-result-strict-type:'+key,lambda v=changed:receipt28_guard(encoded(v),nonce,context,tools))
    for key,value in [('npmCiExit',1),('npmCiExit',False),('mandatoryHooks',False),('mandatoryHooks',1),('postinstallCheckExit',1),
        ('nativePinsCount',9),('nativePinsSHA256','0'*64),('lockSHA256','0'*64),('cacheMode','REUSED'),('nativeDeviceOrSignedBuild','PASS')]:
        changed=copy.deepcopy(receipt);changed['records'][0]['installation'][key]=value
        expect('synthetic-historical-install-missing-skipped-or-false:'+key,lambda v=changed:receipt28_guard(encoded(v),nonce,context,tools))
    expect('synthetic-replay-raw-byte-corruption',lambda:receipt28_guard(encoded(receipt).replace(b'NO_GO',b'GO',1),nonce,context,tools))
    expect('synthetic-receipt-exact-restoration',lambda:receipt28_guard(encoded(receipt),nonce,context,tools),success=True)
    pin=PINNED28[0]
    terminal=dict(status='PASS',positiveControls=pin['positiveControls'],refusals=pin['refusals'],inheritedFunctions=10,
        qualification=pin['qualification'],acceptanceGranted=False,release='NO_GO')
    expect('synthetic-pinned-terminal-positive',lambda:consumer_result28(encoded(terminal),pin),success=True)
    for key,value in [('status','SKIPPED'),('positiveControls',0),('positiveControls',24),('refusals',126),
        ('acceptanceGranted',True),('qualification','CURRENT_SOURCE'),('inheritedFunctions',0)]:
        changed=copy.deepcopy(terminal);changed[key]=value
        expect('synthetic-pinned-terminal-reject:'+key,lambda v=changed:consumer_result28(encoded(v),pin))
    for body in (b'{}',b'{',encoded(terminal).replace(b'"refusals": 127',b'"refusals": 127,"refusals": 127'),
        encoded(terminal).replace(b'"positiveControls": 23',b'"positiveControls": NaN')):
        expect('synthetic-pinned-terminal-malformed',lambda b=body:consumer_result28(b,pin))
    expect('synthetic-failed-child-cannot-be-pass',lambda:child28([sys.executable,'-I','-B','-c','raise SystemExit(1)'],source,os.environ.copy()),
        'R28_REPLAY_CHILD_FAILURE')
    for path in (None,Path('relative.json')):
        expect('synthetic-historical-missing-or-relative-receipt',lambda p=path:replay28(source,check,p),'R28_RECEIPT_FRESH_PATH')
    with tempfile.TemporaryDirectory(prefix='release28-receipt-control-') as temp:
        existing=Path(temp)/'old.json';existing.write_bytes(encoded(receipt))
        expect('synthetic-reused-receipt-path',lambda:replay28(source,check,existing),'R28_RECEIPT_FRESH_PATH')
        counterfeit=Path(temp)/'wrong-checker.py';counterfeit.write_bytes(b'raise SystemExit(0)\n')
        script=str(source/'scripts/release/full-app-j01/source_consumer28.test.py')
        expect('actual-CLI-swapped-checker-refused-before-execution',lambda:child28([sys.executable,'-I','-B',script,
            '--checker',str(counterfeit)],source,os.environ.copy()),'R28_REPLAY_CHILD_FAILURE')
        expect('actual-CLI-wrong-source-root-refused-before-execution',lambda:child28([sys.executable,'-I','-B',script,
            '--source-root',temp],source,os.environ.copy()),'R28_REPLAY_CHILD_FAILURE')
        fixture=Path(temp)/'source';fixture.mkdir();(fixture/'node_modules').mkdir()
        expect('synthetic-reused-node-modules-refused-before-install',lambda:installation28(fixture,pin,check,{},tools),'R28_REPLAY_FRESH_INSTALL')
        (fixture/'node_modules').rmdir();(fixture/'package-lock.json').write_bytes(b'{}')
        expect('synthetic-wrong-lock-refused-before-install',lambda:installation28(fixture,pin,check,{},tools),'R28_REPLAY_LOCK_IDENTITY')
    with patch.object(check,'full28_store',side_effect=ValueError('R28_ALTERNATES')):
        expect('synthetic-historical-alternates-refused-before-scripts',lambda:checkout28(source,pin,check),'R28_ALTERNATES')
    with patch.object(check,'full28_store',return_value=None),patch.object(check,'git23',return_value=b'0'*40):
        expect('synthetic-historical-wrong-checkout-refused-before-scripts',lambda:checkout28(source,pin,check),'R28_REPLAY_SOURCE')
    with patch.object(check,'full28_store',return_value=None),patch.object(check,'git23',side_effect=[pin['head'].encode(),pin['tree'].encode(),b'0'*40]):
        expect('synthetic-historical-mutated-ref-refused-before-scripts',lambda:checkout28(source,pin,check),'R28_REPLAY_REF')
    require28(hashlib.sha256((source/'.github/workflows/security-candidate22.yml').read_bytes()).hexdigest()==check.RELEASE28_WORKFLOW_SHA256,
        'R28_TEST_WORKFLOW_IDENTITY')
    workflow=(source/'.github/workflows/security-candidate22.yml').read_text(encoding='utf-8')
    assert 'source_consumer24.test.py |' not in workflow and 'replay28.py --receipt ' in workflow
    assert 'matrix:\n        os: [ubuntu-latest, windows-latest]' in workflow and 'permissions:\n  contents: read' in workflow
    assert 'python -B scripts/security22/run.py --output-dir ' in workflow and 'set -o pipefail' in workflow
    positive+=1
    for prior in check.RELEASE28_PREVIOUS_GOVERNANCE.values():
        prior_raw=check.git23('diff','--raw','--no-abbrev','--no-renames','-z',prior['parent'],prior['commit'])
        old_read=lambda path:check.git23('show',prior['commit']+':'+path)
        expect('authentic-published-prior-transition-only',lambda:check.validate28_diff(prior_raw,old_read,prior['parent'],at_commit=prior['commit']),success=True)
        cumulative=check.git23('diff','--raw','--no-abbrev','--no-renames','-z',check.RELEASE28_BASE,prior['commit'])
        expect('authentic-published-prior-cumulative-only',lambda:check.validate28_diff(cumulative,old_read,at_commit=prior['commit']),success=True)
        expect('prior-transition-cannot-be-working',lambda:check.validate28_diff(prior_raw,old_read,prior['parent'],working=True,at_commit=prior['commit']),'R28_PRIOR_CONTEXT')
        expect('prior-transition-wrong-parent',lambda:check.validate28_diff(prior_raw,old_read,'0'*40,at_commit=prior['commit']),'R28_PRIOR_CONTEXT')
        expect('prior-transition-raw-byte-corruption',lambda:check.validate28_diff(prior_raw+b'\0',old_read,prior['parent'],at_commit=prior['commit']),'R28_PRIOR_TRANSITION')
        with patch.dict(prior,{'tree':'0'*40}):
            expect('prior-tree-identity-refuted',lambda:check.validate28_diff(prior_raw,old_read,prior['parent'],at_commit=prior['commit']),'R28_PRIOR_IDENTITY')

    # Exercise the actual new current readers with a real file and descriptor.
    # Synthetic stat observations challenge metadata domains; bytes are real.
    with tempfile.TemporaryDirectory(prefix='release28-working-metadata-') as temp:
        metadata_root=Path(temp);target=metadata_root/'fixture.txt';body=b'actual complete tracked bytes\n';target.write_bytes(body)
        oid=hashlib.sha1(('blob '+str(len(body))+'\0').encode()+body).hexdigest()
        index={'fixture.txt':('100644',oid)}
        def info28(info, **changed):
            result=Module();result.__dict__={name:getattr(info,name) for name in dir(info) if name.startswith('st_')}
            result.__dict__.update(changed);return result
        real_os=check.os
        with patch.object(check,'ROOT',metadata_root):
            expect('actual-working-complete-read-positive',lambda:check.working28_guard(index),success=True)
            for field in ('st_uid','st_gid','st_mode','st_nlink','st_size','st_mtime_ns','st_ctime_ns','st_file_attributes','st_reparse_tag','st_birthtime_ns','st_added_numeric_canary'):
                calls=[0]
                def changed_handle(descriptor,field=field):
                    info=real_os.fstat(descriptor);calls[0]+=1
                    return info28(info,**{field:getattr(info,field,0)+1}) if calls[0]==2 else info
                proxy=Module();proxy.__dict__={**real_os.__dict__,'fstat':changed_handle}
                with patch.object(check,'os',proxy):
                    expect('same-domain-handle-metadata-mutation:'+field,lambda:check.working28_guard(index),'R28_WORKING_CHANGED')
            calls=[0]
            def accessed_handle(descriptor):
                info=real_os.fstat(descriptor);calls[0]+=1
                return info28(info,st_atime=info.st_atime+1,st_atime_ns=info.st_atime_ns+1) if calls[0]==2 else info
            proxy=Module();proxy.__dict__={**real_os.__dict__,'fstat':accessed_handle}
            with patch.object(check,'os',proxy):
                expect('only-read-induced-access-time-change-admitted',lambda:check.working28_guard(index),success=True)
            def different_ctime_domain(descriptor):
                info=real_os.fstat(descriptor);result=info28(info,st_ctime=info.st_ctime+100,st_ctime_ns=info.st_ctime_ns+100000000000)
                for field in ('st_birthtime','st_birthtime_ns'):result.__dict__.pop(field,None)
                return result
            proxy=Module();proxy.__dict__={**real_os.__dict__,'name':'nt','fstat':different_ctime_domain}
            with patch.object(check,'os',proxy):
                expect('Windows-distinct-ctime-domains-without-birthtime-admitted',lambda:check.working28_guard(index),success=True)
            proxy=Module();proxy.__dict__={**real_os.__dict__,'read':lambda *_:b''}
            with patch.object(check,'os',proxy):
                expect('actual-working-incomplete-read-refused',lambda:check.working28_guard(index),'R28_WORKING_CHANGED')
            expect('actual-regular-complete-read-positive',lambda:check.require(check.regular28(target)==body,'R23_PUBLIC_CHANGED'),success=True)
            for field in ('st_uid','st_gid','st_mode','st_nlink','st_size','st_mtime_ns','st_ctime_ns','st_file_attributes','st_reparse_tag','st_birthtime_ns','st_added_numeric_canary'):
                calls=[0]
                def changed_regular_handle(descriptor,field=field):
                    info=real_os.fstat(descriptor);calls[0]+=1
                    return info28(info,**{field:getattr(info,field,0)+1}) if calls[0]==2 else info
                proxy=Module();proxy.__dict__={**real_os.__dict__,'fstat':changed_regular_handle}
                with patch.object(check,'os',proxy):
                    expect('regular-same-domain-handle-metadata-mutation:'+field,lambda:check.regular28(target),'R23_PUBLIC_CHANGED')
            calls=[0]
            proxy=Module();proxy.__dict__={**real_os.__dict__,'fstat':accessed_handle}
            with patch.object(check,'os',proxy):
                expect('regular-access-time-only-admitted',lambda:check.require(check.regular28(target)==body,'R23_PUBLIC_CHANGED'),success=True)
            proxy=Module();proxy.__dict__={**real_os.__dict__,'name':'nt','fstat':different_ctime_domain}
            with patch.object(check,'os',proxy):
                expect('regular-Windows-ctime-domains-without-birthtime-admitted',lambda:check.require(check.regular28(target)==body,'R23_PUBLIC_CHANGED'),success=True)
            proxy=Module();proxy.__dict__={**real_os.__dict__,'read':lambda *_:b''}
            with patch.object(check,'os',proxy):
                expect('actual-regular-incomplete-read-refused',lambda:check.regular28(target),'R23_PUBLIC_CHANGED')

    common=Path(check.git23('rev-parse','--git-common-dir').decode().strip())
    common=common if common.is_absolute() else source/common
    temporary_parent=Path(tempfile.gettempdir()).resolve()
    root=Path(tempfile.mkdtemp(prefix='release28-synthetic-',dir=temporary_parent)).resolve()
    assert root.parent==temporary_parent and root.name.startswith('release28-synthetic-')
    def git(*args,data=None):
        child=subprocess.run(['git','--no-replace-objects','-c','core.longpaths=true','-c','core.autocrlf=false',
            '-c','core.hooksPath=',*args],cwd=root,input=data,capture_output=True,timeout=120)
        if child.returncode:raise subprocess.CalledProcessError(child.returncode,args,child.stdout,child.stderr)
        return child.stdout
    old_root=check.ROOT
    original_env={k:v for k,v in os.environ.items() if k.startswith('GITHUB_')}
    try:
        for key in original_env:os.environ.pop(key)
        git('init','--quiet');git('config','core.autocrlf','false')
        (root/'.git/objects/info/alternates').write_bytes(((common/'objects').resolve().as_posix()+'\n').encode())
        git('read-tree',check.RELEASE28_PLAN_COMMIT)
        def put(path,body=b'synthetic public fixture\n',mode='100644'):
            oid=git('hash-object','-w','--stdin',data=body).decode().strip()
            git('update-index','--add','--cacheinfo',mode,oid,path)
        def commit(parent):
            return git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit-tree',
                git('write-tree').decode().strip(),'-p',parent,data=b'Synthetic Release28 control, not real source proof\n').decode().strip()
        def head(value):git('update-ref','HEAD',value)
        def delta():
            return check.validate28_diff(git('diff','--cached','--raw','--no-abbrev','--no-renames','-z',check.RELEASE28_BASE),
                lambda p:git('show',':'+p))
        def restore_index():git('read-tree',authentic_tree);head(authentic)
        put('scripts/release/full-app-j01/check.py',raw);put(check.RELEASE28_CANDIDATE,encoded(candidate))
        put('scripts/release/full-app-j01/source_consumer28.test.py',(source/'scripts/release/full-app-j01/source_consumer28.test.py').read_bytes())
        put('.github/workflows/security-candidate22.yml',(source/'.github/workflows/security-candidate22.yml').read_bytes())
        for script in ('replay28.py','replay28.test.py'):
            put('scripts/release/full-app-j01/'+script,(source/'scripts/release/full-app-j01'/script).read_bytes())
        authentic_tree=git('write-tree').decode().strip();authentic=commit(check.RELEASE28_PLAN_COMMIT);head(authentic)
        git('checkout-index','--all')
        check.ROOT=root
        expect('synthetic-finite-delta',delta,success=True)
        expect('synthetic-plan-first-history',check.source28_history,success=True)
        expect('synthetic-shared-object-store-refused-as-independent',check.full28_store,'R28_ALTERNATES')
        for path in ('.github/workflows/security.yml','supabase/config.toml','apps/mobile/src/features/healthConsent/lifecycleStore.ts',
            'apps/mobile/src/features/photos/store.ts','scripts/phase2/canonical-postgres-mirror24.mjs'):
            put(path);expect('protected-staged-edit',delta,'R28_FINITE_SCOPE');restore_index()
            git('update-index','--force-remove',path);expect('protected-delete',delta,'R28_FINITE_SCOPE');restore_index()
        for mode in ('100755','120000'):
            put(next(iter(check.RELEASE28_NEW_APP)),mode=mode)
            expect('new-mode-or-link-refused',delta,'R28_MODE_OR_DELETION');restore_index()
        put('.github/workflows/security.yml');tampered=commit(authentic)
        git('read-tree',authentic_tree);restored=commit(tampered);head(restored)
        expect('intermediate-protected-change-then-restoration',check.source28_history,'R28_FINITE_SCOPE');restore_index()
        weakened=copy.deepcopy(candidate);weakened['admissions']['G97']=True
        put(check.RELEASE28_CANDIDATE,encoded(weakened));changed=commit(authentic)
        git('read-tree',authentic_tree);restored=commit(changed);head(restored)
        expect('intermediate-policy-weakened-then-restored',check.source28_history,'R28_NO_ADMISSION');restore_index()
        git('update-index','--force-remove','.github/workflows/security.yml');deleted=commit(authentic)
        git('read-tree',authentic_tree);readded=commit(deleted);head(readded)
        expect('protected-deletion-readdition-history',check.source28_history,'R28_FINITE_SCOPE');restore_index()
        put(check.RELEASE28_PLAN,plan+b'\n');changed=commit(authentic);head(changed)
        expect('plan-later-modification',check.source28_history,'R28_PLAN_IDENTITY');restore_index()
        contract=root/check.RELEASE28_CANDIDATE;original_contract=contract.read_bytes()
        ci=copy.deepcopy(candidate);ci['pr']=29;contract.write_bytes(encoded(ci))
        event=dict(number=29,repository=dict(full_name='TasfiqJ/onSkin'),pull_request=dict(number=29,
            base=dict(sha=check.RELEASE28_BASE,ref='stage/m1-first-value-safety-ci27'),
            head=dict(sha=authentic,ref='stage/m1-destructive-commit-core05-28',repo=dict(full_name='TasfiqJ/onSkin')),
            draft=True,maintainer_can_modify=False,auto_merge=None))
        event_path=root/'.git/release28-event.json';event_path.write_bytes(encoded(event))
        env=dict(GITHUB_ACTIONS='true',GITHUB_EVENT_NAME='pull_request',GITHUB_REPOSITORY='TasfiqJ/onSkin',
            GITHUB_REF='refs/pull/29/merge',GITHUB_SHA=authentic,GITHUB_EVENT_PATH=str(event_path))
        with patch.dict(os.environ,env):
            expect('CI-exact-pinned-base-and-policy',check.source28_endpoint,success=True)
            for group,key,value in [('base','sha','0'*40),('base','ref','main'),('head','ref','stage/unissued'),
                ('head','sha','0'*40)]:
                changed=copy.deepcopy(event);changed['pull_request'][group][key]=value;event_path.write_bytes(encoded(changed))
                expect('CI-forged-source-identity',check.source28_endpoint,'R28_CI_EVENT')
            for key,value in [('draft',False),('draft',1),('maintainer_can_modify',True),('maintainer_can_modify',0),
                ('auto_merge',False),('number',True)]:
                changed=copy.deepcopy(event);changed['pull_request'][key]=value;event_path.write_bytes(encoded(changed))
                expect('CI-policy-type-refusal',check.source28_endpoint,'R28_CI_EVENT')
            event_path.write_bytes(encoded(event))
            merge=git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit-tree',authentic_tree,
                '-p',check.RELEASE28_BASE,'-p',authentic,data=b'Synthetic CI merge, not merged PR\n').decode().strip();head(merge)
            with patch.dict(os.environ,{'GITHUB_SHA':merge}):
                expect('CI-tree-equal-two-parent-checkout',check.source28_endpoint,success=True)
            head(authentic)
            test_merge_event=copy.deepcopy(event);test_merge_event['pull_request']['merge_commit_sha']=merge
            event_path.write_bytes(encoded(test_merge_event))
            with patch.dict(os.environ,{'GITHUB_SHA':merge}):
                expect('CI-exact-head-with-separate-authenticated-test-merge',check.source28_endpoint,success=True)
                for snapshot in (None, check.RELEASE28_BASE):
                    test_merge_event['pull_request']['merge_commit_sha']=snapshot;event_path.write_bytes(encoded(test_merge_event))
                    expect('CI-stale-or-pending-advisory-merge-snapshot',check.source28_endpoint,success=True)
                test_merge_event['pull_request']['merge_commit_sha']=1;event_path.write_bytes(encoded(test_merge_event))
                expect('CI-malformed-advisory-merge-snapshot',check.source28_endpoint,'R28_CI_MERGE_SNAPSHOT_SCHEMA')
            event_path.write_bytes(encoded(event))
            for wrong_parent,wrong_head,wrong_tree in [(check.RELEASE28_PLAN_COMMIT,authentic,authentic_tree),
                (check.RELEASE28_BASE,check.RELEASE28_PLAN_COMMIT,authentic_tree),(check.RELEASE28_BASE,authentic,check.RELEASE28_TREE)]:
                wrong_object=git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit-tree',wrong_tree,
                    '-p',wrong_parent,'-p',wrong_head,data=b'Synthetic wrong CI object, never a real source checkout\n').decode().strip()
                with patch.dict(os.environ,{'GITHUB_SHA':wrong_object}):
                    expect('CI-wrong-actual-test-object-parents-or-tree',check.source28_endpoint,'R28_CI_TEST_MERGE_IDENTITY')
            with patch.dict(os.environ,{'GITHUB_SHA':'0'*40}):
                expect('CI-missing-actual-test-object',check.source28_endpoint)
            event_path.write_bytes(encoded(event))
            badmerge=git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit-tree',check.RELEASE28_TREE,
                '-p',check.RELEASE28_BASE,'-p',authentic,data=b'Synthetic unequal CI merge\n').decode().strip();head(badmerge)
            with patch.dict(os.environ,{'GITHUB_SHA':badmerge}):
                expect('CI-unequal-merge-tree',check.source28_endpoint,'R28_CI_MERGE_TREE')
            head(authentic)
            event_path.write_bytes(encoded(event)+b' '*(1024*1024))
            expect('CI-event-read-bound',check.source28_endpoint,'R23_PUBLIC_BOUND')
        contract.write_bytes(original_contract)
        # Qualify the next checks explicitly: full28_store is skipped only because
        # this synthetic fixture intentionally shares immutable baseline objects.
        with patch.object(check,'full28_store',return_value=None):
            expect('synthetic-mounted-source-guard-current',check.source28_guard,success=True)
            for flag,undo in [('--assume-unchanged','--no-assume-unchanged'),('--skip-worktree','--no-skip-worktree')]:
                git('update-index',flag,'docs/PRODUCT_REQUIREMENTS.md')
                expect('hidden-index-flag:'+flag,check.source28_guard,'R28_INDEX_FLAGS')
                git('update-index',undo,'docs/PRODUCT_REQUIREMENTS.md')
            hidden=root/'.campaign27-hidden';hidden.write_bytes(b'synthetic untracked\n')
            try:expect('hidden-untracked-source',check.source28_guard,'R28_UNTRACKED_SCOPE')
            finally:hidden.unlink()
            hidden=root/'apps/mobile/src/features/shelf/.env.synthetic';hidden.write_bytes(b'PUBLIC_SYNTHETIC_NOT_SECRET\n')
            try:expect('ignored-untracked-app-source-name-only',check.source28_guard,'R28_IGNORED_SOURCE')
            finally:hidden.unlink()
            put('.github/workflows/security.yml')
            expect('hidden-staged-protected-file',check.source28_guard,'R28_FINITE_SCOPE');restore_index()
            protected=root/'docs/PRODUCT_REQUIREMENTS.md';original=protected.read_bytes();info=protected.stat()
            git('config','core.trustctime','false');git('status','--porcelain=v1')
            changed=bytes([original[0]^1])+original[1:];protected.write_bytes(changed)
            os.utime(protected,ns=(info.st_atime_ns,info.st_mtime_ns))
            assert len(changed)==len(original) and protected.read_bytes()!=original
            try:
                expect('same-size-protected-bytes-with-restored-mtime',check.source28_guard,'R28_WORKING_BLOB')
            finally:
                protected.write_bytes(original);os.utime(protected,ns=(info.st_atime_ns,info.st_mtime_ns))
                git('config','--unset','core.trustctime');git('update-index','--refresh')
            app=next(iter(check.RELEASE28_NEW_APP));(root/app).parent.mkdir(parents=True,exist_ok=True);(root/app).write_bytes(b'synthetic new test\n')
            expect('finite-pending-new-test-before-freeze',check.source28_guard,success=True)
            (root/app).unlink()
        put('ONSKIN_BRAIN_HANDOFF.txt');early=commit(authentic);head(early)
        expect('handoff-before-evidence',check.source28_history,'R28_EVIDENCE_TAIL_SCOPE');restore_index()
        put(next(iter(check.RELEASE28_WORKLIST)));partial=commit(authentic);head(partial)
        expect('partial-worklist-freeze',check.source28_history,'R28_WORKLIST_ONLY_FREEZE');restore_index()
        for path in check.RELEASE28_WORKLIST:put(path)
        frozen_tree=git('write-tree').decode().strip();frozen=commit(authentic);head(frozen)
        expect('sole-worklist-child',check.source28_history,success=True)
        put(next(iter(check.RELEASE28_NEW_APP)));after=commit(frozen);head(after)
        expect('source-after-freeze',check.source28_history,'R28_SOURCE_AFTER_FREEZE')
        git('read-tree',frozen_tree);head(frozen)
        checkpoint=root/check.RELEASE28_CHECKPOINT;checkpoint.mkdir(parents=True)
        payload_body=b'synthetic receipt, never acceptance\n'
        archive=io.BytesIO()
        with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED) as target:
            info=zipfile.ZipInfo('receipts/synthetic.txt');info.create_system=3;info.compress_type=zipfile.ZIP_DEFLATED
            info.external_attr=(stat.S_IFREG|0o644)<<16
            target.writestr(info,payload_body)
        files={}
        for name,body in [('README.md',b'Synthetic checkpoint NO_GO\n'),('REPORT.md',b'Synthetic source-only report NO_GO\n'),
            ('payload.zip',archive.getvalue()),('verify28.py',b'# synthetic envelope input, not executed\n')]:
            (checkpoint/name).write_bytes(body);put(check.RELEASE28_CHECKPOINT+name,body)
            files[name]=dict(bytes=len(body),sha256=hashlib.sha256(body).hexdigest())
        manifest=dict(schema=1,authority=check.RELEASE28_AUTHORITY,status='SUBMITTED_REVIEW_REQUIRED',acceptanceGranted=False,
            release='NO_GO',inputManifestSHA256=check.RELEASE28_INPUT,
            source=dict(base=check.RELEASE28_BASE,baseTree=check.RELEASE28_TREE,runtimeHead=authentic,runtimeTree=authentic_tree,
                sourceHead=frozen,sourceTree=frozen_tree),files=files,
            payload=dict(schema=1,qualification='SANITIZED_TECHNICAL_EVIDENCE_NOT_ACCEPTANCE',
                files={'receipts/synthetic.txt':dict(bytes=len(payload_body),sha256=hashlib.sha256(payload_body).hexdigest())}))
        manifest_raw=encoded(manifest);(checkpoint/'manifest.json').write_bytes(manifest_raw)
        put(check.RELEASE28_CHECKPOINT+'manifest.json',manifest_raw)
        put('ONSKIN_BRAIN_HANDOFF.txt',b'Synthetic factual handoff NO_GO\n')
        tail_tree=git('write-tree').decode().strip();tail=commit(frozen);head(tail)
        history=check.source28_history()
        expect('synthetic-sole-evidence-tail-history',check.source28_history,success=True)
        expect('synthetic-envelope-current',lambda:check.evidence28_guard(history),success=True)
        report=checkpoint/'REPORT.md';body=report.read_bytes();report.write_bytes(body+b'tampered')
        expect('synthetic-envelope-corruption',lambda:check.evidence28_guard(history),'R28_EVIDENCE_HASH')
        forged=copy.deepcopy(manifest);forged['files']['REPORT.md']=dict(bytes=len(body)+8,sha256=hashlib.sha256(body+b'tampered').hexdigest())
        (checkpoint/'manifest.json').write_bytes(encoded(forged))
        expect('rehashing-cannot-forge-committed-copy',lambda:check.evidence28_guard(history),'R28_EVIDENCE_COMMITTED_BYTES')
        report.write_bytes(body);(checkpoint/'manifest.json').write_bytes(manifest_raw)
        expect('synthetic-envelope-restored',lambda:check.evidence28_guard(history),success=True)
        payload_file=checkpoint/'payload.zip';original_payload=payload_file.read_bytes()
        prefix=b'UNACCOUNTED_PREFIX'
        prefixed=bytearray(original_payload)
        end=prefixed.rfind(b'PK\x05\x06');central=struct.unpack_from('<I',prefixed,end+16)[0]
        cursor=central
        while cursor<end:
            old_offset=struct.unpack_from('<I',prefixed,cursor+42)[0]
            struct.pack_into('<I',prefixed,cursor+42,old_offset+len(prefix))
            cursor+=46+sum(struct.unpack_from('<HHH',prefixed,cursor+28))
        struct.pack_into('<I',prefixed,end+16,central+len(prefix))
        malformed_payloads=[prefix+bytes(prefixed),original_payload+b'TRAILING']
        local_name=bytearray(original_payload);local_name[30]^=1;malformed_payloads.append(bytes(local_name))
        for malformed in malformed_payloads:
            changed=copy.deepcopy(manifest)
            changed['files']['payload.zip']=dict(bytes=len(malformed),sha256=hashlib.sha256(malformed).hexdigest())
            payload_file.write_bytes(malformed);(checkpoint/'manifest.json').write_bytes(encoded(changed))
            git('read-tree',frozen_tree)
            for name in check.RELEASE28_CHECKPOINT_FILES:put(check.RELEASE28_CHECKPOINT+name,(checkpoint/name).read_bytes())
            put('ONSKIN_BRAIN_HANDOFF.txt',b'Synthetic factual handoff NO_GO\n')
            malformed_tail=commit(frozen);head(malformed_tail)
            expect('rehashed-committed-payload-framing-refused',lambda:check.evidence28_guard(check.source28_history()),'R28_PAYLOAD_FRAME')
        payload_file.write_bytes(original_payload);(checkpoint/'manifest.json').write_bytes(manifest_raw)
        git('read-tree',tail_tree);head(tail)
        for field,value in [('acceptanceGranted',True),('acceptanceGranted',0),('schema',True),('release','GO')]:
            changed=copy.deepcopy(manifest);changed[field]=value;(checkpoint/'manifest.json').write_bytes(encoded(changed))
            expect('evidence-cannot-admit',lambda:check.evidence28_guard(history),'R28_EVIDENCE_NO_ADMISSION')
        (checkpoint/'manifest.json').write_bytes(manifest_raw)
        extra=checkpoint/'unexpected';extra.mkdir()
        try:expect('evidence-extra-directory',lambda:check.evidence28_guard(history))
        finally:extra.rmdir()
        link=checkpoint/'linked-report';os.link(report,link)
        try:expect('evidence-hardlink',lambda:check.evidence28_guard(history),'R23_PUBLIC_FILE')
        finally:link.unlink()
        put(next(iter(check.RELEASE28_NEW_APP)));second=commit(tail);head(second)
        expect('source-or-second-tail-after-evidence',check.source28_history,'R28_AFTER_EVIDENCE_TAIL')
        git('read-tree',tail_tree);head(tail)
        expect('synthetic-exact-final-restoration',lambda:check.evidence28_guard(check.source28_history()),success=True)
    finally:
        check.ROOT=old_root
        for key in original_env:os.environ[key]=original_env[key]
        assert root.parent==temporary_parent and root.name.startswith('release28-synthetic-')
        def writable_remove(function,path,error):
            os.chmod(path,stat.S_IWRITE|stat.S_IREAD)
            function(path)
        shutil.rmtree(root,onerror=writable_remove)
    print(json.dumps(dict(status='PASS',positiveControls=positive,refusals=refused,inheritedFunctions=len(old),
        qualification='SYNTHETIC_GIT_AND_SCHEMA_CONTROLS_NOT_INDEPENDENT_FULL_CHECKOUT_OR_APP_PRIVACY_PROOF',
        acceptanceGranted=False,release='NO_GO')),flush=True)


if __name__=='__main__':
    main()
