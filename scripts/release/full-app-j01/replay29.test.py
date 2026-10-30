"""Synthetic historical29 receipt/terminal refusals; not actual historical execution."""
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from unittest.mock import patch


def main():
    if sys.flags.optimize or len(sys.argv) != 1: raise ValueError('R29_ARGUMENT_SCHEMA')
    source=Path(__file__).resolve().parents[3]
    actual=source/'scripts/release/full-app-j01/check.py'
    namespace={'__name__':'release29_runner_controls','__file__':str(actual)}
    exec(compile(actual.read_bytes(),'<release29-checker>','exec'),namespace)
    class Module: pass
    check=Module();check.__dict__=namespace
    runner=source/'scripts/release/full-app-j01/replay29.py'
    runner_namespace={'__name__':'release29_receipt_controls','__file__':str(runner)}
    exec(compile(runner.read_bytes(),'<release29-runner>','exec'),runner_namespace)
    for name in ('require29','PINNED29','LOCK29_SHA256','NATIVE29_PINS_SHA256','receipt29_guard','consumer_result29','child29','replay29','installation29','checkout29'):
        globals()[name]=runner_namespace[name]
    assert [p['release'] for p in PINNED29]==[24,25,26,27,28]
    assert PINNED29[-2]['head']=='517b50413b136639413b783cf3e899a6bc6c19ed'
    assert PINNED29[-1]['head']=='bace116586d58ed955f0a024ca96ae9f4ad9286d'
    positive=refused=0
    encoded=lambda value:(json.dumps(value,sort_keys=True)+'\n').encode()
    def expect(label,action,code=None,success=False):
        nonlocal positive,refused
        try: action()
        except (ValueError,KeyError,TypeError,OSError,subprocess.SubprocessError) as error:
            assert not success and (code is None or error.args==(code,)),label
            refused+=1
        else:
            assert success,label
            positive+=1
        print(json.dumps(dict(case=label,exit=0 if success else 1,expectedExit=0 if success else 1)),flush=True)
    # Receipt/parser cases use explicit synthetic observations, never substitutes
    # for the separate --historical-replay command and its complete remote clones.
    nonce='a'*64;context={'synthetic':True};tools={'synthetic':True}
    records=[]
    for pin in PINNED29:
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
                mandatoryHooks=True,postinstallCheckExit=0,lockSHA256=LOCK29_SHA256,nativePinsCount=10,
                nativePinsSHA256=NATIVE29_PINS_SHA256,cacheMode='FRESH_EMPTY_EXTERNAL_NPM_CACHE',nativeDeviceOrSignedBuild='NOT_RUN')))
    receipt=dict(schema=1,status='PASS',qualification='AUTHENTIC_PINNED_HISTORICAL_SOURCE_REPLAY_NOT_SECURITY_ACCEPTANCE',
        acceptanceGranted=False,release='NO_GO',nonce=nonce,context=context,tools=tools,records=records)
    expect('synthetic-receipt-schema-positive',lambda:receipt29_guard(encoded(receipt),nonce,context,tools),success=True)
    for key,value in [('schema',True),('status','SKIPPED'),('acceptanceGranted',True),('release','GO'),('nonce','0'*64),
        ('context',{'stale':True}),('tools',{'swapped':True}),('tools',{'synthetic':1}),('records',[]),('records',records[::-1])]:
        changed=copy.deepcopy(receipt);changed[key]=value
        expect('synthetic-receipt-false-or-stale:'+key,lambda v=changed:receipt29_guard(encoded(v),nonce,context,tools))
    for body in (b'{}',b'[]',b'{',encoded(receipt).replace(b'"schema": 1',b'"schema": 1,"schema": 1'),
        encoded(receipt)+b'garbage',b' '*1048577):
        expect('synthetic-receipt-malformed-or-missing',lambda b=body:receipt29_guard(b,nonce,context,tools))
    for key,value in [('head','0'*40),('tree','0'*40),('checker',records[1]['checker']),('consumer',records[1]['consumer']),
        ('consumerResult',{**records[0]['consumerResult'],'exit':1}),('consumerResult',{**records[0]['consumerResult'],'status':'SKIPPED'}),
        ('checkoutAfter',{**records[0]['checkoutAfter'],'indexSHA256':'0'*64}),('toolIdentityAfter',{'swapped':True})]:
        changed=copy.deepcopy(receipt);changed['records'][0][key]=value
        expect('synthetic-replay-wrong-checkout-script-result:'+key,lambda v=changed:receipt29_guard(encoded(v),nonce,context,tools))
    for key,value in [('mode','100755'),('blob','0'*40),('sha256','0'*64)]:
        changed=copy.deepcopy(receipt);changed['records'][0]['consumer'][key]=value
        expect('synthetic-replay-consumer-identity:'+key,lambda v=changed:receipt29_guard(encoded(v),nonce,context,tools))
    missing=copy.deepcopy(receipt);del missing['records'][0]['sourceResult']
    expect('synthetic-replay-missing-component',lambda:receipt29_guard(encoded(missing),nonce,context,tools))
    for key,value in [('exit',False),('valid',1),('acceptanceGranted',0)]:
        changed=copy.deepcopy(receipt);changed['records'][0]['sourceResult'][key]=value
        expect('synthetic-replay-source-result-strict-type:'+key,lambda v=changed:receipt29_guard(encoded(v),nonce,context,tools))
    for key,value in [('npmCiExit',1),('npmCiExit',False),('mandatoryHooks',False),('mandatoryHooks',1),('postinstallCheckExit',1),
        ('nativePinsCount',9),('nativePinsSHA256','0'*64),('lockSHA256','0'*64),('cacheMode','REUSED'),('nativeDeviceOrSignedBuild','PASS')]:
        changed=copy.deepcopy(receipt);changed['records'][0]['installation'][key]=value
        expect('synthetic-historical-install-missing-skipped-or-false:'+key,lambda v=changed:receipt29_guard(encoded(v),nonce,context,tools))
    expect('synthetic-replay-raw-byte-corruption',lambda:receipt29_guard(encoded(receipt).replace(b'NO_GO',b'GO',1),nonce,context,tools))
    expect('synthetic-receipt-exact-restoration',lambda:receipt29_guard(encoded(receipt),nonce,context,tools),success=True)
    pin=PINNED29[0]
    terminal=dict(status='PASS',positiveControls=pin['positiveControls'],refusals=pin['refusals'],inheritedFunctions=10,
        qualification=pin['qualification'],acceptanceGranted=False,release='NO_GO')
    expect('synthetic-pinned-terminal-positive',lambda:consumer_result29(encoded(terminal),pin),success=True)
    for key,value in [('status','SKIPPED'),('positiveControls',0),('positiveControls',24),('refusals',126),
        ('acceptanceGranted',True),('qualification','CURRENT_SOURCE'),('inheritedFunctions',0)]:
        changed=copy.deepcopy(terminal);changed[key]=value
        expect('synthetic-pinned-terminal-reject:'+key,lambda v=changed:consumer_result29(encoded(v),pin))
    for body in (b'{}',b'{',encoded(terminal).replace(b'"refusals": 127',b'"refusals": 127,"refusals": 127'),
        encoded(terminal).replace(b'"positiveControls": 23',b'"positiveControls": NaN')):
        expect('synthetic-pinned-terminal-malformed',lambda b=body:consumer_result29(b,pin))
    expect('synthetic-failed-child-cannot-be-pass',lambda:child29([sys.executable,'-I','-B','-c','raise SystemExit(1)'],source,os.environ.copy()),
        'R29_REPLAY_CHILD_FAILURE')
    for path in (None,Path('relative.json')):
        expect('synthetic-historical-missing-or-relative-receipt',lambda p=path:replay29(source,check,p),'R29_RECEIPT_FRESH_PATH')
    with tempfile.TemporaryDirectory(prefix='release29-receipt-control-') as temp:
        existing=Path(temp)/'old.json';existing.write_bytes(encoded(receipt))
        expect('synthetic-reused-receipt-path',lambda:replay29(source,check,existing),'R29_RECEIPT_FRESH_PATH')
        counterfeit=Path(temp)/'wrong-checker.py';counterfeit.write_bytes(b'raise SystemExit(0)\n')
        script=str(source/'scripts/release/full-app-j01/source_consumer29.test.py')
        expect('actual-CLI-swapped-checker-refused-before-execution',lambda:child29([sys.executable,'-I','-B',script,
            '--checker',str(counterfeit)],source,os.environ.copy()),'R29_REPLAY_CHILD_FAILURE')
        expect('actual-CLI-wrong-source-root-refused-before-execution',lambda:child29([sys.executable,'-I','-B',script,
            '--source-root',temp],source,os.environ.copy()),'R29_REPLAY_CHILD_FAILURE')
        fixture=Path(temp)/'source';fixture.mkdir();(fixture/'node_modules').mkdir()
        expect('synthetic-reused-node-modules-refused-before-install',lambda:installation29(fixture,pin,check,{},tools),'R29_REPLAY_FRESH_INSTALL')
        (fixture/'node_modules').rmdir();(fixture/'package-lock.json').write_bytes(b'{}')
        expect('synthetic-wrong-lock-refused-before-install',lambda:installation29(fixture,pin,check,{},tools),'R29_REPLAY_LOCK_IDENTITY')
    with patch.object(check,'full29_store',side_effect=ValueError('R29_ALTERNATES')):
        expect('synthetic-historical-alternates-refused-before-scripts',lambda:checkout29(source,pin,check),'R29_ALTERNATES')
    with patch.object(check,'full29_store',return_value=None),patch.object(check,'git23',return_value=b'0'*40):
        expect('synthetic-historical-wrong-checkout-refused-before-scripts',lambda:checkout29(source,pin,check),'R29_REPLAY_SOURCE')
    with patch.object(check,'full29_store',return_value=None),patch.object(check,'git23',side_effect=[pin['head'].encode(),pin['tree'].encode(),b'0'*40]):
        expect('synthetic-historical-mutated-ref-refused-before-scripts',lambda:checkout29(source,pin,check),'R29_REPLAY_REF')
    require29(hashlib.sha256((source/'.github/workflows/security-candidate22.yml').read_bytes()).hexdigest()==check.RELEASE29_WORKFLOW_SHA256,
        'R29_TEST_WORKFLOW_IDENTITY')
    print(json.dumps(dict(status='PASS',positiveControls=positive,refusals=refused,
        qualification='SYNTHETIC_PINNED_HISTORICAL_RECEIPT_CONTROLS_NOT_ACTUAL_REPLAY',
        acceptanceGranted=False,release='NO_GO')),flush=True)


if __name__=='__main__':
    try:main()
    except Exception:
        print(json.dumps(dict(status='FAIL',code='R29_REPLAY_CONTROL_FAILED',acceptanceGranted=False,release='NO_GO')),flush=True)
        raise SystemExit(1) from None
