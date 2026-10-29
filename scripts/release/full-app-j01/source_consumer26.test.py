"""Release26 refusal controls. Synthetic controls remain separate from authenticated full-checkout historical replay."""
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


# These pins identify original immutable sources, not the current appendix.
PINNED26 = (
    dict(release=24,head='d0ccef65bcbe0c90483e6c0f691ed95f92228c6c',tree='22f91455d651a81296ab8724f9db7cfead65af08',
        branch='stage/m1-security-dependency-db24',checkerSHA256='855977dc4fc5ecc57f13b810cac6c63654b72b04bf867412d8c4510efe221145',
        checkerBlob='1dce93e4085d0fd26202b780c39fb7b65b11a8dd',consumerSHA256='715920a4dff3757adef2916015a244babef9babf92fea5725b1d2e96abf1c7d1',
        consumerBlob='e4fd92709607f40adde3fe4bd038c7f0cbd090b6',positiveControls=23,refusals=127,
        qualification='SYNTHETIC_GIT_AND_PUBLIC_INPUT_CONTROLS_NOT_FULL_CHECKOUT_OR_SCANNER'),
    dict(release=25,head='52a3d01ebb36a6845d0ac21935ad35520732633f',tree='ef49a81ca814f3d82b8a868e0308b6dda09c9cca',
        branch='stage/m1-real-first-value25',checkerSHA256='bcb0235eb05d653b27b0871c52f72f6300513c68f2de46a3e959194fb5cbc838',
        checkerBlob='cc5ea944b02c76c19181aefca44007ad941af486',consumerSHA256='cfe4ff3959d8cfba1939711a86cc9ee961c8c66a762425684ac7cd002dacb28d',
        consumerBlob='241b88540aecd3fc5ccc3597c926204d3c4d5d74',positiveControls=16,refusals=122,
        qualification='SYNTHETIC_GIT_AND_SCHEMA_CONTROLS_NOT_INDEPENDENT_FULL_CHECKOUT_OR_APP_PRIVACY_PROOF'),
)
LOCK26_SHA256='1485297ffa6cc20367a5f2fda35bc33e12dc11ef422c813f5f28a4e339cb3b95'
POSTINSTALL26_SHA256='7b8b165ce0323bb0336e62052d1c55dab2a951880b8fce2678769fc7f423946a'
NATIVE26_PINS_SHA256='e966c32522ae67e20e7bd1f64cb4e8eb1928e518c81a8879e384a3050c51e2ae'


def require26(value, code):
    if not value: raise ValueError(code)


def bytes26(path, bound=128*1024*1024):
    path=Path(path);before=path.lstat()
    require26(stat.S_ISREG(before.st_mode) and before.st_nlink==1 and not stat.S_ISLNK(before.st_mode) and
        not getattr(before,'st_file_attributes',0)&1024 and before.st_size<=bound,'R26_REPLAY_REGULAR')
    with path.open('rb') as stream:
        opened=os.fstat(stream.fileno());raw=stream.read(bound+1);after=os.fstat(stream.fileno())
    stamp=lambda s:(s.st_dev,s.st_ino,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
    require26(len(raw)==before.st_size and stamp(before)==stamp(opened)==stamp(after)==stamp(path.lstat()),'R26_REPLAY_CHANGED')
    return raw


def tool26(path):
    path=Path(path).resolve(strict=True);before=path.stat();digest=hashlib.sha256()
    require26(stat.S_ISREG(before.st_mode) and before.st_size<=128*1024*1024,'R26_REPLAY_TOOL')
    with path.open('rb') as stream:
        while True:
            block=stream.read(1024*1024)
            if not block:break
            digest.update(block)
    after=path.stat()
    require26((before.st_dev,before.st_ino,before.st_size,before.st_mtime_ns)==
        (after.st_dev,after.st_ino,after.st_size,after.st_mtime_ns),'R26_REPLAY_TOOL_CHANGED')
    return dict(executableSHA256=digest.hexdigest(),bytes=before.st_size)


def tools26(root):
    require26(sys.flags.optimize==0,'R26_ASSERTIONS_REQUIRED')
    # The entire root was reconciled to authenticated Git bytes before this
    # existing protected toolchain code can execute. Its npm installation model
    # inventories every file/link against the separately pinned 11.20 profile.
    loader="import sys,json;from pathlib import Path;sys.path.insert(0,str(Path.cwd()/'scripts/security22'));from toolchain import identity;print(json.dumps(identity(Path.cwd()),sort_keys=True))"
    environment={key:value for key,value in os.environ.items() if not key.upper().startswith(('GIT_','NPM_','PYTHON')) and
        key.upper() not in ('NODE_OPTIONS','NODE_PATH','NODE_AUTH_TOKEN')}
    raw=child26([str(Path(sys.executable).resolve()),'-I','-B','-c',loader],root,environment,180)
    identity=json.loads(raw);tools=identity.get('tools') if type(identity) is dict else None
    require26(type(tools) is dict and set(tools)=={'git','python','node','npm'} and tools['npm'].get('version')=='11.20.0' and
        tools['npm'].get('installationModelSHA256')=='c1d3e494bb27b0ae253a41f06bd2621786f0d215dff2679e9005b25f6c3ca0b9' and
        tools['python'].get('executableSHA256')==tool26(sys.executable)['executableSHA256'],'R26_REPLAY_TOOLCHAIN_IDENTITY')
    tools['python']['assertionsEnabled']=True
    return tools


def installation26(root,pin,check,environment,tools):
    require26(not (root/'node_modules').exists() and not any((root/'apps').glob('*/node_modules')),'R26_REPLAY_FRESH_INSTALL')
    lock=bytes26(root/'package-lock.json');require26(hashlib.sha256(lock).hexdigest()==LOCK26_SHA256,'R26_REPLAY_LOCK_IDENTITY')
    require26(hashlib.sha256(bytes26(root/'scripts/postinstall.mjs')).hexdigest()==POSTINSTALL26_SHA256,'R26_REPLAY_HOOK_IDENTITY')
    node=Path(shutil.which('node')).resolve()
    npm=node.parent/'node_modules/npm' if os.name=='nt' else node.parent.parent/'lib/node_modules/npm'
    require26(tool26(node)['executableSHA256']==tools['node']['executableSHA256'] and
        hashlib.sha256(bytes26(npm/'bin/npm-cli.js')).hexdigest()==tools['npm']['cliSHA256'],'R26_REPLAY_TOOLCHAIN_IDENTITY')
    cache=root.parent/('npm-cache-release'+str(pin['release']))
    require26(not cache.exists(),'R26_REPLAY_FRESH_INSTALL_CACHE');cache.mkdir()
    empty_config=cache/'empty-global.npmrc'
    with empty_config.open('xb') as stream:stream.write(b'')
    install_environment={**environment,'npm_config_userconfig':os.devnull,'npm_config_globalconfig':str(empty_config)}
    child26([str(node),str(npm/'bin/npm-cli.js'),'ci','--ignore-scripts=false','--cache',str(cache),'--no-audit','--no-fund'],root,install_environment,900)
    after=json.loads(child26([str(node),'scripts/postinstall.mjs','--check'],root,install_environment,180))
    require26(type(after) is dict and after.get('check') is True and bytes26(root/'package-lock.json')==lock,'R26_REPLAY_MANDATORY_HOOKS')
    previous=check.ROOT;check.ROOT=root
    try:
        # dependency13_guard is deliberately a whole historical-lock assertion.
        # Its unmodified caller supplies an older authenticated lock adapter;
        # this setup check independently authenticates only its original mapping
        # and installed pins against the actual current PR28/29 lock above.
        manifest_raw=bytes26(root/check.RELEASE13_MANIFEST)
        require26(hashlib.sha256(manifest_raw).hexdigest()==check.RELEASE13_MANIFEST_SHA256,'R26_REPLAY_NATIVE_MANIFEST')
        manifest=json.loads(manifest_raw)
        mapping_raw=bytes26(root/manifest['originalMapping']['path'])
        require26(hashlib.sha256(mapping_raw).hexdigest()==manifest['originalMapping']['sha256'] and
            mapping_raw==check.git23('show',check.RELEASE13_BASE+':'+manifest['originalMapping']['path']),'R26_REPLAY_NATIVE_MAPPING')
        mapping=json.loads(mapping_raw)
        pins=[]
        for row in mapping['mappings']:
            for witness in row['notes']['sourcePins']:
                raw=bytes26(root/witness['path'])
                require26(hashlib.sha256(raw).hexdigest()==witness['sha256'],'R26_REPLAY_NATIVE_PIN')
                pins.append(dict(path=witness['path'],sha256=witness['sha256']))
        digest=hashlib.sha256(json.dumps(sorted(pins,key=lambda item:item['path']),sort_keys=True,separators=(',',':')).encode()).hexdigest()
        require26(len(pins)==10 and digest==NATIVE26_PINS_SHA256,'R26_REPLAY_NATIVE_PIN_INVENTORY')
    finally:check.ROOT=previous
    return dict(qualification='ACTUAL_NPM_CI_MANDATORY_HOOKS_AND_PINNED_NATIVE_SOURCE_ONLY',npmCiExit=0,
        mandatoryHooks=True,postinstallCheckExit=0,lockSHA256=LOCK26_SHA256,nativePinsCount=10,nativePinsSHA256=NATIVE26_PINS_SHA256,
        cacheMode='FRESH_EMPTY_EXTERNAL_NPM_CACHE',nativeDeviceOrSignedBuild='NOT_RUN')


def receipt26_guard(raw, nonce, context, tools):
    require26(type(raw) is bytes and len(raw)<=1024*1024,'R26_RECEIPT_BOUND')
    def pairs26(pairs):
        result={}
        for key,value in pairs:
            require26(key not in result,'R26_RECEIPT_DUPLICATE');result[key]=value
        return result
    value=json.loads(raw,object_pairs_hook=pairs26,parse_constant=lambda _:require26(False,'R26_RECEIPT_NONFINITE'))
    same=lambda left,right:json.dumps(left,sort_keys=True,separators=(',',':'),allow_nan=False)==json.dumps(right,sort_keys=True,separators=(',',':'),allow_nan=False)
    require26(type(value) is dict and set(value)=={'schema','status','qualification','acceptanceGranted','release',
        'nonce','context','tools','records'} and type(value['schema']) is int and value['schema']==1 and
        value['status']=='PASS' and value['qualification']=='AUTHENTIC_PINNED_HISTORICAL_SOURCE_REPLAY_NOT_SECURITY_ACCEPTANCE' and
        value['acceptanceGranted'] is False and value['release']=='NO_GO' and
        type(nonce) is str and re.fullmatch('[0-9a-f]{64}',nonce) and value['nonce']==nonce and
        same(value['context'],context) and same(value['tools'],tools),'R26_RECEIPT_IDENTITY')
    records=value['records'];require26(type(records) is list and len(records)==2,'R26_RECEIPT_RECORDS')
    for record,pin in zip(records,PINNED26):
        require26(type(record) is dict and set(record)=={'release','head','tree','checker','consumer','consumerResult','sourceResult',
            'checkoutBefore','checkoutAfter','toolIdentityBefore','toolIdentityAfter','installation'},'R26_RECEIPT_RECORDS')
        require26(type(record['release']) is int and record['release']==pin['release'] and record['head']==pin['head'] and
            record['tree']==pin['tree'] and record['checker']==dict(mode='100644',blob=pin['checkerBlob'],sha256=pin['checkerSHA256']) and
            record['consumer']==dict(mode='100644',blob=pin['consumerBlob'],sha256=pin['consumerSHA256']) and
            same(record['toolIdentityBefore'],tools) and same(record['toolIdentityAfter'],tools),'R26_RECEIPT_PIN')
        snapshot=record['checkoutBefore']
        require26(type(snapshot) is dict and set(snapshot)=={'head','tree','trackedBlobs','indexSHA256','treeMetadataSHA256'} and
            snapshot['head']==pin['head'] and snapshot['tree']==pin['tree'] and type(snapshot['trackedBlobs']) is int and
            snapshot['trackedBlobs']>20000 and all(type(snapshot[k]) is str and re.fullmatch('[0-9a-f]{64}',snapshot[k])
                for k in ('indexSHA256','treeMetadataSHA256')) and same(snapshot,record['checkoutAfter']),'R26_RECEIPT_SNAPSHOT')
        result=record['consumerResult']
        require26(type(result) is dict and set(result)=={'exit','status','positiveControls','refusals','qualification','acceptanceGranted','release'} and
            type(result['exit']) is int and result['exit']==0 and result['status']=='PASS' and result['qualification']==pin['qualification'] and
            result['acceptanceGranted'] is False and result['release']=='NO_GO' and type(result['positiveControls']) is int and
            type(result['refusals']) is int and result['positiveControls']>0 and result['refusals']>100 and
            (pin['positiveControls'] is None or result['positiveControls']==pin['positiveControls']) and
            (pin['refusals'] is None or result['refusals']==pin['refusals']),'R26_RECEIPT_RESULT')
        require26(same(record['sourceResult'],dict(exit=0,valid=True,release='NO_GO',acceptanceGranted=False,
            sourceAcceptance='SUBMITTED_REVIEW_REQUIRED',governance='RELEASE'+str(pin['release'])+'_FINITE_SCOPE_ONLY',
            qualification='INDEPENDENT_EXACT_HEAD_CHECKOUT_NO_CI_EVENT_CLAIM')),'R26_RECEIPT_SOURCE_RESULT')
        require26(same(record['installation'],dict(qualification='ACTUAL_NPM_CI_MANDATORY_HOOKS_AND_PINNED_NATIVE_SOURCE_ONLY',npmCiExit=0,
            mandatoryHooks=True,postinstallCheckExit=0,lockSHA256=LOCK26_SHA256,nativePinsCount=10,nativePinsSHA256=NATIVE26_PINS_SHA256,
            cacheMode='FRESH_EMPTY_EXTERNAL_NPM_CACHE',nativeDeviceOrSignedBuild='NOT_RUN')),'R26_RECEIPT_INSTALLATION')
    return value


def checkout26(root,pin,check):
    previous=check.ROOT;check.ROOT=root
    try:
        check.full26_store()
        require26(check.git23('rev-parse','HEAD').decode().strip()==pin['head'] and
            check.git23('rev-parse','HEAD^{tree}').decode().strip()==pin['tree'],'R26_REPLAY_SOURCE')
        require26(check.git23('rev-parse','refs/remotes/origin/'+pin['branch']).decode().strip()==pin['head'],'R26_REPLAY_REF')
        require26(not check.git23('status','--porcelain=v1','--untracked-files=all','-z'),'R26_REPLAY_DIRTY')
        tree=check.tree26('HEAD');index_raw=check.git23('ls-files','--stage','-z');index={}
        for row in index_raw.split(b'\0'):
            if not row:continue
            metadata,name=row.split(b'\t',1);mode,oid,stage=metadata.decode('ascii').split();path=name.decode('utf-8')
            require26(stage=='0' and path not in index,'R26_REPLAY_INDEX');index[path]=(mode,oid)
        require26(index==tree and all(row.startswith(b'H ') for row in check.git23('ls-files','-v','-z').split(b'\0') if row),
            'R26_REPLAY_INDEX')
        for kind in ('checker','consumer'):
            path='scripts/release/full-app-j01/'+('check.py' if kind=='checker' else 'source_consumer'+str(pin['release'])+'.test.py')
            require26(tree[path]==('100644',pin[kind+'Blob']) and hashlib.sha256(bytes26(root/path)).hexdigest()==pin[kind+'SHA256'],
                'R26_REPLAY_SCRIPT')
        count=check.working26_guard(index)
        require26(check.git23('rev-parse','HEAD').decode().strip()==pin['head'] and check.git23('ls-files','--stage','-z')==index_raw and
            not check.git23('status','--porcelain=v1','--untracked-files=all','-z'),'R26_REPLAY_CHANGED')
        return dict(head=pin['head'],tree=pin['tree'],trackedBlobs=count,indexSHA256=hashlib.sha256(index_raw).hexdigest(),
            treeMetadataSHA256=hashlib.sha256(check.git23('ls-tree','-r','-z','HEAD')).hexdigest())
    finally:check.ROOT=previous


def child26(arguments,root,environment,timeout=900):
    child=subprocess.run(arguments,cwd=root,env=environment,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=timeout)
    require26(len(child.stdout)<=8*1024*1024 and len(child.stderr)<=1024*1024,'R26_REPLAY_OUTPUT_BOUND')
    require26(child.returncode==0,'R26_REPLAY_CHILD_FAILURE')
    return child.stdout


def consumer_result26(raw,pin):
    require26(type(raw) is bytes and 0<len(raw)<=8*1024*1024,'R26_REPLAY_OUTPUT_BOUND')
    def pairs26(pairs):
        value={}
        for key,item in pairs:
            require26(key not in value,'R26_REPLAY_OUTPUT_DUPLICATE');value[key]=item
        return value
    rows=[json.loads(line,object_pairs_hook=pairs26,parse_constant=lambda _:require26(False,'R26_REPLAY_OUTPUT_NONFINITE'))
        for line in raw.decode('utf-8-sig').splitlines() if line]
    require26(rows and all(type(row) is dict for row in rows),'R26_REPLAY_OUTPUT')
    last=rows[-1]
    require26(set(last)=={'status','positiveControls','refusals','inheritedFunctions','qualification','acceptanceGranted','release'} and
        last['status']=='PASS' and last['qualification']==pin['qualification'] and last['acceptanceGranted'] is False and
        last['release']=='NO_GO' and type(last['inheritedFunctions']) is int and last['inheritedFunctions']>0 and
        type(last['positiveControls']) is int and last['positiveControls']>0 and type(last['refusals']) is int and last['refusals']>100,
        'R26_REPLAY_TERMINAL')
    require26((pin['positiveControls'] is None or last['positiveControls']==pin['positiveControls']) and
        (pin['refusals'] is None or last['refusals']==pin['refusals']),'R26_REPLAY_COUNTERS')
    for row in rows[:-1]:
        require26(type(row.get('exit')) is int and row['exit'] in (0,1) and
            (row.get('expectedExit')==row['exit'] or (row['exit']==0 and row.get('case')=='all-original-function-ASTs-preserved')),
            'R26_REPLAY_CASE')
    return {key:last[key] for key in ('status','positiveControls','refusals','qualification','acceptanceGranted','release')} | {'exit':0}


def replay26(source,check,receipt):
    require26(receipt is not None and receipt.is_absolute() and not receipt.exists(),'R26_RECEIPT_FRESH_PATH')
    receipt=receipt.resolve();require26(not receipt.is_relative_to(source) and receipt.parent.is_dir(),'R26_RECEIPT_OUTSIDE_SOURCE')
    require26(hashlib.sha256(bytes26(source/'scripts/release/full-app-j01/source_consumer26.test.py')).hexdigest()==
        check.RELEASE26_CONSUMER_SHA256,'R26_REPLAY_CONSUMER_IDENTITY')
    proof=check.source26_guard()
    if os.environ.get('GITHUB_ACTIONS')=='true':require26(proof['phase']=='TAIL','R26_REPLAY_FINAL_SOURCE_REQUIRED')
    environment={key:value for key,value in os.environ.items() if not key.upper().startswith(('GITHUB_','GIT_','PYTHON','NPM_')) and
        key.upper() not in ('NODE_OPTIONS','NODE_PATH','NODE_AUTH_TOKEN')}
    environment['GIT_TERMINAL_PROMPT']='0'
    environment.update(npm_config_userconfig=os.devnull,npm_config_registry='https://registry.npmjs.org')
    tools=tools26(source);nonce=secrets.token_hex(32)
    context=dict(head=proof['endpoint'],tree=proof['tree'],runId=os.environ.get('GITHUB_RUN_ID','LOCAL'),
        runAttempt=os.environ.get('GITHUB_RUN_ATTEMPT','LOCAL'),job=os.environ.get('GITHUB_JOB','LOCAL'),platform=sys.platform,
        currentConsumerSHA256=check.RELEASE26_CONSUMER_SHA256,qualification='CURRENT_EXACT_SOURCE_WITH_SEPARATE_HISTORICAL_CHILDREN')
    parent=Path(os.environ.get('RUNNER_TEMP',tempfile.gettempdir())).resolve()
    require26(parent.is_dir() and not parent.is_relative_to(source),'R26_REPLAY_OUTSIDE_SOURCE')
    workspace=Path(tempfile.mkdtemp(prefix='release26-historical-',dir=parent)).resolve()
    require26(workspace.parent==parent,'R26_REPLAY_FRESH_WORKSPACE')
    records=[];git=str(Path(shutil.which('git')).resolve());python=str(Path(sys.executable).resolve())
    for pin in PINNED26:
        root=workspace/('release'+str(pin['release']))
        require26(not root.exists(),'R26_REPLAY_FRESH_WORKSPACE')
        child26([git,'-c','core.hooksPath=','-c','core.autocrlf=false','-c','core.longpaths=true',
            'clone','--no-checkout','--no-hardlinks','-c','core.autocrlf=false','-c','core.longpaths=true',
            'https://github.com/TasfiqJ/onSkin.git',str(root)],workspace,environment,600)
        child26([git,'-c','core.hooksPath=','-c','core.autocrlf=false','-c','core.longpaths=true',
            'checkout','--detach',pin['head']],root,environment,300)
        before=checkout26(root,pin,check);before_tools=tools26(root)
        installed=installation26(root,pin,check,environment,tools)
        consumer='scripts/release/full-app-j01/source_consumer'+str(pin['release'])+'.test.py'
        output=child26([python,'-I','-B',consumer],root,environment)
        controls=consumer_result26(output,pin)
        checker_raw=child26([python,'-I','-B','scripts/release/full-app-j01/check.py'],root,environment)
        result=json.loads(checker_raw)
        require26(type(result) is dict and result.get('valid') is True and result.get('release')=='NO_GO' and
            result.get('acceptanceGranted') is False and result.get('source_acceptance')=='SUBMITTED_REVIEW_REQUIRED' and
            result.get('current_source_governance')=='RELEASE'+str(pin['release'])+'_FINITE_SCOPE_ONLY' and
            type(result.get('admissions')) is dict and all(value is False for value in result['admissions'].values()),'R26_REPLAY_SOURCE_RESULT')
        after=checkout26(root,pin,check);after_tools=tools26(root)
        require26(before==after and before_tools==tools==after_tools,'R26_REPLAY_CHANGED')
        records.append(dict(release=pin['release'],head=pin['head'],tree=pin['tree'],
            checker=dict(mode='100644',blob=pin['checkerBlob'],sha256=pin['checkerSHA256']),
            consumer=dict(mode='100644',blob=pin['consumerBlob'],sha256=pin['consumerSHA256']),consumerResult=controls,
            sourceResult=dict(exit=0,valid=True,release='NO_GO',acceptanceGranted=False,sourceAcceptance='SUBMITTED_REVIEW_REQUIRED',
                governance='RELEASE'+str(pin['release'])+'_FINITE_SCOPE_ONLY',qualification='INDEPENDENT_EXACT_HEAD_CHECKOUT_NO_CI_EVENT_CLAIM'),
            checkoutBefore=before,checkoutAfter=after,toolIdentityBefore=before_tools,toolIdentityAfter=after_tools,installation=installed))
    require26(check.source26_guard()==proof and tools26(source)==tools,'R26_REPLAY_CURRENT_SOURCE_CHANGED')
    value=dict(schema=1,status='PASS',qualification='AUTHENTIC_PINNED_HISTORICAL_SOURCE_REPLAY_NOT_SECURITY_ACCEPTANCE',
        acceptanceGranted=False,release='NO_GO',nonce=nonce,context=context,tools=tools,records=records)
    raw=(json.dumps(value,sort_keys=True)+'\n').encode();receipt26_guard(raw,nonce,context,tools)
    with receipt.open('xb') as stream:stream.write(raw)
    require26(bytes26(receipt,1024*1024)==raw,'R26_RECEIPT_CHANGED')
    receipt26_guard(bytes26(receipt,1024*1024),nonce,context,tools)
    print(json.dumps(value,sort_keys=True),flush=True)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--source-root',type=Path,default=Path(__file__).resolve().parents[3])
    parser.add_argument('--checker',type=Path)
    parser.add_argument('--historical-replay',action='store_true')
    parser.add_argument('--receipt',type=Path)
    args=parser.parse_args()
    source=args.source_root.resolve()
    require26(source==Path(__file__).resolve().parents[3],'R26_CURRENT_CHECKOUT_ARGUMENT')
    require26(args.checker is None,'R26_CURRENT_CHECKER_ARGUMENT')
    actual=source/'scripts/release/full-app-j01/check.py'
    raw=actual.read_bytes()
    namespace={'__name__':'release26_consumer','__file__':str(actual)}
    exec(compile(raw,str(actual),'exec'),namespace)
    class Module: pass
    check=Module();check.__dict__=namespace
    if args.historical_replay:
        replay26(source,check,args.receipt)
        return
    require26(args.receipt is None,'R26_RECEIPT_ARGUMENT')
    require26(sys.flags.optimize == 0,'R26_ASSERTIONS_REQUIRED')
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
    candidate=dict(schema=1,authority=check.RELEASE26_AUTHORITY,status='SUBMITTED_REVIEW_REQUIRED',base=check.RELEASE26_BASE,
        tree=check.RELEASE26_TREE,scopeCommit=check.RELEASE26_PLAN_COMMIT,scopePlanSHA256=check.RELEASE26_PLAN_SHA256,
        inputManifestSHA256=check.RELEASE26_INPUT,acceptanceGranted=False,
        admissions=dict(G97=False,DB=False,M103=False,M2=False,J01=False,PUBLIC=False),pr=None)
    plan=(source/check.RELEASE26_PLAN).read_bytes()
    expect('exact-committed-plan',lambda:check.scope26_guard(plan),success=True)
    expect('exact-nonadmitting-contract',lambda:check.candidate26_guard(encoded(candidate)),success=True)
    for key,value in [('schema',True),('schema',1.0),('pr',True),('pr',0),('pr',-1),('pr',29.0),
        ('acceptanceGranted',0),('acceptanceGranted',None),('status','ACCEPTED'),('base','0'*40),
        ('tree','0'*40),('scopeCommit','0'*40),('scopePlanSHA256','0'*64),('inputManifestSHA256','0'*64),('authority','UNISSUED')]:
        changed=copy.deepcopy(candidate);changed[key]=value
        expect('contract-type-or-authority:'+key+':'+repr(value),lambda v=changed:check.candidate26_guard(encoded(v)),'R26_NO_ADMISSION')
    for key in candidate['admissions']:
        for value in (True,0,None,'false'):
            changed=copy.deepcopy(candidate);changed['admissions'][key]=value
            expect('closed-admission:'+key+':'+repr(value),lambda v=changed:check.candidate26_guard(encoded(v)),'R26_NO_ADMISSION')
    for body in (b'[]',b'{}',encoded(candidate).replace(b'"schema": 1',b'"schema": 1,"schema": 1'),
        encoded(candidate).replace(b'"pr": null',b'"pr": NaN'),b' '*(65537)):
        expect('malformed-contract',lambda b=body:check.candidate26_guard(b))
    for changed in (plan+b'\n',plan.replace(b'five',b'four'),plan.replace(b'5/25',b'6/25')):
        if changed!=plan:expect('changed-plan-refused',lambda b=changed:check.scope26_guard(b),'R26_PLAN_IDENTITY')
    for path in ('../escape','/absolute','C:/drive','a\\b','A//b','A/../b','A/file.','NUL.txt','Ａ/file','a\x00b'):
        expect('unsafe-or-Unicode-path:'+repr(path),lambda p=path:check.name26(p,{}),'R26_PATH')
    for paths in [('A/file','a/other'),('a','a/child')]:
        def collision(paths=paths):
            identities={}
            for path in paths:check.name26(path,identities)
        expect('implicit-parent-alias-or-kind',collision,'R26_PATH_ALIAS')
    expect('authentic-append-only-checker',lambda:check.validate26_checker(raw),success=True)
    terminal=b"if __name__ == '__main__':\n    sys.exit(main())\n"
    before=check.git23('show',check.RELEASE26_BASE+':scripts/release/full-app-j01/check.py')
    old=[ast.dump(n,include_attributes=False) for n in ast.parse(before).body if isinstance(n,ast.FunctionDef)]
    new=[ast.dump(n,include_attributes=False) for n in ast.parse(raw).body if isinstance(n,ast.FunctionDef)]
    assert new[:len(old)]==old
    for addition,code in [(b'validate = validate26\n','R26_DUPLICATE_ASSIGNMENT'),
        (b'import socket\n','R26_MODULE_SCOPE'),(b'RELEASE26_SIDE_EFFECT = globals().clear()\n','R26_GLOBAL_SIDE_EFFECT'),
        (b'def arbitrary_injection(): pass\n','R26_FUNCTION_SCOPE')]:
        expect('module-injection:'+code,lambda b=addition:check.validate26_checker(raw[:-len(terminal)]+b+terminal),code)
    for a,b,code in [(b"'FAIL/NO_GO'",b"'PASS'",'R26_INHERITED_BYTES'),
        (b'source_guard = source26_guard\n',b'source_guard = source24_guard\n','R26_DISPATCH'),
        (b'validate = validate26\n',b'','R26_DISPATCH_REQUIRED'),
        (b"RELEASE26_EXISTING_APP = {",b"RELEASE26_EXISTING_APP = {'.github/workflows/security.yml',",'R26_AUTHENTIC_FINITE_GRANT')]:
        expect('checker-mutation:'+code,lambda a=a,b=b:check.validate26_checker(raw.replace(a,b,1)),code)
    body=next(n for n in ast.parse(raw).body if isinstance(n,ast.FunctionDef) and n.name=='source26_guard')
    segment=ast.get_source_segment(raw.decode('utf-8'),body).encode()
    bypass=raw.replace(segment,b'def source26_guard():\n    return {}\n',1)
    expect('source-guard-body-cannot-be-replaced',lambda:check.validate26_checker(bypass),'R26_APPENDIX_BYTES')
    for error in (RuntimeError('SYNTHETIC_CANARY'),OSError('SYNTHETIC_CANARY'),ValueError('SYNTHETIC_CANARY')):
        with patch.object(check,'validate26_checker',return_value=None),patch.object(check,'source26_guard',side_effect=error):
            expect('unknown-error-no-disclosure',check.validate26,'R26_EXECUTION_INCOMPLETE')
    with patch.object(check,'validate26_checker',return_value=None),patch.object(check,'source26_guard',return_value={}),patch.object(check,'historical21_validate',side_effect=ValueError('FINITE_IDS:SYNTHETIC_CANARY')):
        try:check.validate26()
        except ValueError as error:assert error.args==('FINITE_IDS:',)
        else:raise AssertionError('legacy refusal accepted')
        refused+=1
    with patch.object(check,'validate26_checker',return_value=None),patch.object(check,'source26_guard',return_value={'phase':'SOURCE'}),patch.object(check,'historical21_validate',return_value={'valid':True}):
        result=check.validate26();assert result['valid'] is True and result['release']=='NO_GO' and result['acceptanceGranted'] is False
        assert all(v is False for v in result['admissions'].values());positive+=1
    with patch.object(check,'validate25',return_value={'qualification':'UNCHANGED_HISTORICAL_ROUTE'}) as route:
        with tempfile.TemporaryDirectory(prefix='release26-external-bundle-') as directory:
            assert check.validate26(Path(directory))['qualification']=='UNCHANGED_HISTORICAL_ROUTE';route.assert_called_once();positive+=1
    with patch.dict(os.environ,{'GIT_DIR':'/synthetic/redirect'}):
        expect('Git-environment-before-endpoint',check.source26_endpoint,'R23_GIT_ENV')
        expect('Git-environment-before-store',check.full26_store,'R23_GIT_ENV')
    # Receipt/parser cases use explicit synthetic observations, never substitutes
    # for the separate --historical-replay command and its complete remote clones.
    nonce='a'*64;context={'synthetic':True};tools={'synthetic':True}
    records=[]
    for pin in PINNED26:
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
                mandatoryHooks=True,postinstallCheckExit=0,lockSHA256=LOCK26_SHA256,nativePinsCount=10,
                nativePinsSHA256=NATIVE26_PINS_SHA256,cacheMode='FRESH_EMPTY_EXTERNAL_NPM_CACHE',nativeDeviceOrSignedBuild='NOT_RUN')))
    receipt=dict(schema=1,status='PASS',qualification='AUTHENTIC_PINNED_HISTORICAL_SOURCE_REPLAY_NOT_SECURITY_ACCEPTANCE',
        acceptanceGranted=False,release='NO_GO',nonce=nonce,context=context,tools=tools,records=records)
    expect('synthetic-receipt-schema-positive',lambda:receipt26_guard(encoded(receipt),nonce,context,tools),success=True)
    for key,value in [('schema',True),('status','SKIPPED'),('acceptanceGranted',True),('release','GO'),('nonce','0'*64),
        ('context',{'stale':True}),('tools',{'swapped':True}),('tools',{'synthetic':1}),('records',[]),('records',records[::-1])]:
        changed=copy.deepcopy(receipt);changed[key]=value
        expect('synthetic-receipt-false-or-stale:'+key,lambda v=changed:receipt26_guard(encoded(v),nonce,context,tools))
    for body in (b'{}',b'[]',b'{',encoded(receipt).replace(b'"schema": 1',b'"schema": 1,"schema": 1'),
        encoded(receipt)+b'garbage',b' '*1048577):
        expect('synthetic-receipt-malformed-or-missing',lambda b=body:receipt26_guard(b,nonce,context,tools))
    for key,value in [('head','0'*40),('tree','0'*40),('checker',records[1]['checker']),('consumer',records[1]['consumer']),
        ('consumerResult',{**records[0]['consumerResult'],'exit':1}),('consumerResult',{**records[0]['consumerResult'],'status':'SKIPPED'}),
        ('checkoutAfter',{**records[0]['checkoutAfter'],'indexSHA256':'0'*64}),('toolIdentityAfter',{'swapped':True})]:
        changed=copy.deepcopy(receipt);changed['records'][0][key]=value
        expect('synthetic-replay-wrong-checkout-script-result:'+key,lambda v=changed:receipt26_guard(encoded(v),nonce,context,tools))
    for key,value in [('mode','100755'),('blob','0'*40),('sha256','0'*64)]:
        changed=copy.deepcopy(receipt);changed['records'][0]['consumer'][key]=value
        expect('synthetic-replay-consumer-identity:'+key,lambda v=changed:receipt26_guard(encoded(v),nonce,context,tools))
    missing=copy.deepcopy(receipt);del missing['records'][0]['sourceResult']
    expect('synthetic-replay-missing-component',lambda:receipt26_guard(encoded(missing),nonce,context,tools))
    for key,value in [('exit',False),('valid',1),('acceptanceGranted',0)]:
        changed=copy.deepcopy(receipt);changed['records'][0]['sourceResult'][key]=value
        expect('synthetic-replay-source-result-strict-type:'+key,lambda v=changed:receipt26_guard(encoded(v),nonce,context,tools))
    for key,value in [('npmCiExit',1),('npmCiExit',False),('mandatoryHooks',False),('mandatoryHooks',1),('postinstallCheckExit',1),
        ('nativePinsCount',9),('nativePinsSHA256','0'*64),('lockSHA256','0'*64),('cacheMode','REUSED'),('nativeDeviceOrSignedBuild','PASS')]:
        changed=copy.deepcopy(receipt);changed['records'][0]['installation'][key]=value
        expect('synthetic-historical-install-missing-skipped-or-false:'+key,lambda v=changed:receipt26_guard(encoded(v),nonce,context,tools))
    expect('synthetic-replay-raw-byte-corruption',lambda:receipt26_guard(encoded(receipt).replace(b'NO_GO',b'GO',1),nonce,context,tools))
    expect('synthetic-receipt-exact-restoration',lambda:receipt26_guard(encoded(receipt),nonce,context,tools),success=True)
    pin=PINNED26[0]
    terminal=dict(status='PASS',positiveControls=pin['positiveControls'],refusals=pin['refusals'],inheritedFunctions=10,
        qualification=pin['qualification'],acceptanceGranted=False,release='NO_GO')
    expect('synthetic-pinned-terminal-positive',lambda:consumer_result26(encoded(terminal),pin),success=True)
    for key,value in [('status','SKIPPED'),('positiveControls',0),('positiveControls',24),('refusals',126),
        ('acceptanceGranted',True),('qualification','CURRENT_SOURCE'),('inheritedFunctions',0)]:
        changed=copy.deepcopy(terminal);changed[key]=value
        expect('synthetic-pinned-terminal-reject:'+key,lambda v=changed:consumer_result26(encoded(v),pin))
    for body in (b'{}',b'{',encoded(terminal).replace(b'"refusals": 127',b'"refusals": 127,"refusals": 127'),
        encoded(terminal).replace(b'"positiveControls": 23',b'"positiveControls": NaN')):
        expect('synthetic-pinned-terminal-malformed',lambda b=body:consumer_result26(b,pin))
    expect('synthetic-failed-child-cannot-be-pass',lambda:child26([sys.executable,'-I','-B','-c','raise SystemExit(1)'],source,os.environ.copy()),
        'R26_REPLAY_CHILD_FAILURE')
    for path in (None,Path('relative.json')):
        expect('synthetic-historical-missing-or-relative-receipt',lambda p=path:replay26(source,check,p),'R26_RECEIPT_FRESH_PATH')
    with tempfile.TemporaryDirectory(prefix='release26-receipt-control-') as temp:
        existing=Path(temp)/'old.json';existing.write_bytes(encoded(receipt))
        expect('synthetic-reused-receipt-path',lambda:replay26(source,check,existing),'R26_RECEIPT_FRESH_PATH')
        counterfeit=Path(temp)/'wrong-checker.py';counterfeit.write_bytes(b'raise SystemExit(0)\n')
        script=str(source/'scripts/release/full-app-j01/source_consumer26.test.py')
        expect('actual-CLI-swapped-checker-refused-before-execution',lambda:child26([sys.executable,'-I','-B',script,
            '--checker',str(counterfeit)],source,os.environ.copy()),'R26_REPLAY_CHILD_FAILURE')
        expect('actual-CLI-wrong-source-root-refused-before-execution',lambda:child26([sys.executable,'-I','-B',script,
            '--source-root',temp],source,os.environ.copy()),'R26_REPLAY_CHILD_FAILURE')
        fixture=Path(temp)/'source';fixture.mkdir();(fixture/'node_modules').mkdir()
        expect('synthetic-reused-node-modules-refused-before-install',lambda:installation26(fixture,pin,check,{},tools),'R26_REPLAY_FRESH_INSTALL')
        (fixture/'node_modules').rmdir();(fixture/'package-lock.json').write_bytes(b'{}')
        expect('synthetic-wrong-lock-refused-before-install',lambda:installation26(fixture,pin,check,{},tools),'R26_REPLAY_LOCK_IDENTITY')
    with patch.object(check,'full26_store',side_effect=ValueError('R26_ALTERNATES')):
        expect('synthetic-historical-alternates-refused-before-scripts',lambda:checkout26(source,pin,check),'R26_ALTERNATES')
    with patch.object(check,'full26_store',return_value=None),patch.object(check,'git23',return_value=b'0'*40):
        expect('synthetic-historical-wrong-checkout-refused-before-scripts',lambda:checkout26(source,pin,check),'R26_REPLAY_SOURCE')
    with patch.object(check,'full26_store',return_value=None),patch.object(check,'git23',side_effect=[pin['head'].encode(),pin['tree'].encode(),b'0'*40]):
        expect('synthetic-historical-mutated-ref-refused-before-scripts',lambda:checkout26(source,pin,check),'R26_REPLAY_REF')
    require26(hashlib.sha256((source/'.github/workflows/security-candidate22.yml').read_bytes()).hexdigest()==check.RELEASE26_WORKFLOW_SHA256,
        'R26_TEST_WORKFLOW_IDENTITY')
    workflow=(source/'.github/workflows/security-candidate22.yml').read_text(encoding='utf-8')
    assert 'source_consumer24.test.py |' not in workflow and 'source_consumer26.test.py --historical-replay --receipt ' in workflow
    assert 'matrix:\n        os: [ubuntu-latest, windows-latest]' in workflow and 'permissions:\n  contents: read' in workflow
    assert 'python -B scripts/security22/run.py --output-dir ' in workflow and 'set -o pipefail' in workflow
    positive+=1

    common=Path(check.git23('rev-parse','--git-common-dir').decode().strip())
    common=common if common.is_absolute() else source/common
    temporary_parent=Path(tempfile.gettempdir()).resolve()
    root=Path(tempfile.mkdtemp(prefix='release26-synthetic-',dir=temporary_parent)).resolve()
    assert root.parent==temporary_parent and root.name.startswith('release26-synthetic-')
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
        git('read-tree',check.RELEASE26_PLAN_COMMIT)
        def put(path,body=b'synthetic public fixture\n',mode='100644'):
            oid=git('hash-object','-w','--stdin',data=body).decode().strip()
            git('update-index','--add','--cacheinfo',mode,oid,path)
        def commit(parent):
            return git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit-tree',
                git('write-tree').decode().strip(),'-p',parent,data=b'Synthetic Release26 control, not real source proof\n').decode().strip()
        def head(value):git('update-ref','HEAD',value)
        def delta():
            return check.validate26_diff(git('diff','--cached','--raw','--no-abbrev','--no-renames','-z',check.RELEASE26_BASE),
                lambda p:git('show',':'+p))
        def restore_index():git('read-tree',authentic_tree);head(authentic)
        put('scripts/release/full-app-j01/check.py',raw);put(check.RELEASE26_CANDIDATE,encoded(candidate))
        put('scripts/release/full-app-j01/source_consumer26.test.py',(source/'scripts/release/full-app-j01/source_consumer26.test.py').read_bytes())
        put('.github/workflows/security-candidate22.yml',(source/'.github/workflows/security-candidate22.yml').read_bytes())
        authentic_tree=git('write-tree').decode().strip();authentic=commit(check.RELEASE26_PLAN_COMMIT);head(authentic)
        git('checkout-index','--all')
        check.ROOT=root
        expect('synthetic-finite-delta',delta,success=True)
        expect('synthetic-plan-first-history',check.source26_history,success=True)
        expect('synthetic-shared-object-store-refused-as-independent',check.full26_store,'R26_ALTERNATES')
        for path in ('.github/workflows/security.yml','supabase/config.toml','apps/mobile/src/features/healthConsent/lifecycleStore.ts',
            'apps/mobile/src/features/photos/store.ts','scripts/phase2/canonical-postgres-mirror24.mjs'):
            put(path);expect('protected-staged-edit',delta,'R26_FINITE_SCOPE');restore_index()
            git('update-index','--force-remove',path);expect('protected-delete',delta,'R26_FINITE_SCOPE');restore_index()
        for mode in ('100755','120000'):
            put(next(iter(check.RELEASE26_NEW_APP)),mode=mode)
            expect('new-mode-or-link-refused',delta,'R26_MODE_OR_DELETION');restore_index()
        put('.github/workflows/security.yml');tampered=commit(authentic)
        git('read-tree',authentic_tree);restored=commit(tampered);head(restored)
        expect('intermediate-protected-change-then-restoration',check.source26_history,'R26_FINITE_SCOPE');restore_index()
        put(check.RELEASE26_PLAN,plan+b'\n');changed=commit(authentic);head(changed)
        expect('plan-later-modification',check.source26_history,'R26_PLAN_IDENTITY');restore_index()
        contract=root/check.RELEASE26_CANDIDATE;original_contract=contract.read_bytes()
        ci=copy.deepcopy(candidate);ci['pr']=29;contract.write_bytes(encoded(ci))
        event=dict(number=29,repository=dict(full_name='TasfiqJ/onSkin'),pull_request=dict(number=29,
            base=dict(sha=check.RELEASE26_BASE,ref='stage/m1-real-first-value25'),
            head=dict(sha=authentic,ref='stage/m1-first-value-recovery26',repo=dict(full_name='TasfiqJ/onSkin')),
            draft=True,maintainer_can_modify=False,auto_merge=None))
        event_path=root/'.git/release26-event.json';event_path.write_bytes(encoded(event))
        env=dict(GITHUB_ACTIONS='true',GITHUB_EVENT_NAME='pull_request',GITHUB_REPOSITORY='TasfiqJ/onSkin',
            GITHUB_REF='refs/pull/29/merge',GITHUB_SHA=authentic,GITHUB_EVENT_PATH=str(event_path))
        with patch.dict(os.environ,env):
            expect('CI-exact-pinned-base-and-policy',check.source26_endpoint,success=True)
            for group,key,value in [('base','sha','0'*40),('base','ref','main'),('head','ref','stage/unissued'),
                ('head','sha','0'*40)]:
                changed=copy.deepcopy(event);changed['pull_request'][group][key]=value;event_path.write_bytes(encoded(changed))
                expect('CI-forged-source-identity',check.source26_endpoint,'R26_CI_EVENT')
            for key,value in [('draft',False),('draft',1),('maintainer_can_modify',True),('maintainer_can_modify',0),
                ('auto_merge',False),('number',True)]:
                changed=copy.deepcopy(event);changed['pull_request'][key]=value;event_path.write_bytes(encoded(changed))
                expect('CI-policy-type-refusal',check.source26_endpoint,'R26_CI_EVENT')
            event_path.write_bytes(encoded(event))
            merge=git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit-tree',authentic_tree,
                '-p',check.RELEASE26_BASE,'-p',authentic,data=b'Synthetic CI merge, not merged PR\n').decode().strip();head(merge)
            with patch.dict(os.environ,{'GITHUB_SHA':merge}):
                expect('CI-tree-equal-two-parent-checkout',check.source26_endpoint,success=True)
            head(authentic)
            test_merge_event=copy.deepcopy(event);test_merge_event['pull_request']['merge_commit_sha']=merge
            event_path.write_bytes(encoded(test_merge_event))
            with patch.dict(os.environ,{'GITHUB_SHA':merge}):
                expect('CI-exact-head-with-separate-authenticated-test-merge',check.source26_endpoint,success=True)
                test_merge_event['pull_request']['merge_commit_sha']='0'*40;event_path.write_bytes(encoded(test_merge_event))
                expect('CI-swapped-test-merge-identity',check.source26_endpoint,'R26_CI_TEST_MERGE_IDENTITY')
            event_path.write_bytes(encoded(event))
            badmerge=git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit-tree',check.RELEASE26_TREE,
                '-p',check.RELEASE26_BASE,'-p',authentic,data=b'Synthetic unequal CI merge\n').decode().strip();head(badmerge)
            with patch.dict(os.environ,{'GITHUB_SHA':badmerge}):
                expect('CI-unequal-merge-tree',check.source26_endpoint,'R26_CI_MERGE_TREE')
            head(authentic)
            event_path.write_bytes(encoded(event)+b' '*(1024*1024))
            expect('CI-event-read-bound',check.source26_endpoint,'R23_PUBLIC_BOUND')
        contract.write_bytes(original_contract)
        # Qualify the next checks explicitly: full26_store is skipped only because
        # this synthetic fixture intentionally shares immutable baseline objects.
        with patch.object(check,'full26_store',return_value=None):
            expect('synthetic-mounted-source-guard-current',check.source26_guard,success=True)
            for flag,undo in [('--assume-unchanged','--no-assume-unchanged'),('--skip-worktree','--no-skip-worktree')]:
                git('update-index',flag,'docs/PRODUCT_REQUIREMENTS.md')
                expect('hidden-index-flag:'+flag,check.source26_guard,'R26_INDEX_FLAGS')
                git('update-index',undo,'docs/PRODUCT_REQUIREMENTS.md')
            hidden=root/'.campaign26-hidden';hidden.write_bytes(b'synthetic untracked\n')
            try:expect('hidden-untracked-source',check.source26_guard,'R26_UNTRACKED_SCOPE')
            finally:hidden.unlink()
            hidden=root/'apps/mobile/src/features/shelf/.env.synthetic';hidden.write_bytes(b'PUBLIC_SYNTHETIC_NOT_SECRET\n')
            try:expect('ignored-untracked-app-source-name-only',check.source26_guard,'R26_IGNORED_SOURCE')
            finally:hidden.unlink()
            put('.github/workflows/security.yml')
            expect('hidden-staged-protected-file',check.source26_guard,'R26_FINITE_SCOPE');restore_index()
            protected=root/'docs/PRODUCT_REQUIREMENTS.md';original=protected.read_bytes();info=protected.stat()
            git('config','core.trustctime','false');git('status','--porcelain=v1')
            changed=bytes([original[0]^1])+original[1:];protected.write_bytes(changed)
            os.utime(protected,ns=(info.st_atime_ns,info.st_mtime_ns))
            assert len(changed)==len(original) and protected.read_bytes()!=original
            try:
                expect('same-size-protected-bytes-with-restored-mtime',check.source26_guard,'R26_WORKING_BLOB')
            finally:
                protected.write_bytes(original);os.utime(protected,ns=(info.st_atime_ns,info.st_mtime_ns))
                git('config','--unset','core.trustctime');git('update-index','--refresh')
            app=next(iter(check.RELEASE26_NEW_APP));(root/app).parent.mkdir(parents=True,exist_ok=True);(root/app).write_bytes(b'synthetic new test\n')
            expect('finite-pending-new-test-before-freeze',check.source26_guard,success=True)
            (root/app).unlink()
        put('ONSKIN_BRAIN_HANDOFF.txt');early=commit(authentic);head(early)
        expect('handoff-before-evidence',check.source26_history,'R26_EVIDENCE_TAIL_SCOPE');restore_index()
        put(next(iter(check.RELEASE26_WORKLIST)));partial=commit(authentic);head(partial)
        expect('partial-worklist-freeze',check.source26_history,'R26_WORKLIST_ONLY_FREEZE');restore_index()
        for path in check.RELEASE26_WORKLIST:put(path)
        frozen_tree=git('write-tree').decode().strip();frozen=commit(authentic);head(frozen)
        expect('sole-worklist-child',check.source26_history,success=True)
        put(next(iter(check.RELEASE26_NEW_APP)));after=commit(frozen);head(after)
        expect('source-after-freeze',check.source26_history,'R26_SOURCE_AFTER_FREEZE')
        git('read-tree',frozen_tree);head(frozen)
        checkpoint=root/check.RELEASE26_CHECKPOINT;checkpoint.mkdir(parents=True)
        payload_body=b'synthetic receipt, never acceptance\n'
        archive=io.BytesIO()
        with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED) as target:
            info=zipfile.ZipInfo('receipts/synthetic.txt');info.create_system=3;info.compress_type=zipfile.ZIP_DEFLATED
            info.external_attr=(stat.S_IFREG|0o644)<<16
            target.writestr(info,payload_body)
        files={}
        for name,body in [('README.md',b'Synthetic checkpoint NO_GO\n'),('REPORT.md',b'Synthetic source-only report NO_GO\n'),
            ('payload.zip',archive.getvalue()),('verify26.py',b'# synthetic envelope input, not executed\n')]:
            (checkpoint/name).write_bytes(body);put(check.RELEASE26_CHECKPOINT+name,body)
            files[name]=dict(bytes=len(body),sha256=hashlib.sha256(body).hexdigest())
        manifest=dict(schema=1,authority=check.RELEASE26_AUTHORITY,status='SUBMITTED_REVIEW_REQUIRED',acceptanceGranted=False,
            release='NO_GO',inputManifestSHA256=check.RELEASE26_INPUT,
            source=dict(base=check.RELEASE26_BASE,baseTree=check.RELEASE26_TREE,runtimeHead=authentic,runtimeTree=authentic_tree,
                sourceHead=frozen,sourceTree=frozen_tree),files=files,
            payload=dict(schema=1,qualification='SANITIZED_TECHNICAL_EVIDENCE_NOT_ACCEPTANCE',
                files={'receipts/synthetic.txt':dict(bytes=len(payload_body),sha256=hashlib.sha256(payload_body).hexdigest())}))
        manifest_raw=encoded(manifest);(checkpoint/'manifest.json').write_bytes(manifest_raw)
        put(check.RELEASE26_CHECKPOINT+'manifest.json',manifest_raw)
        put('ONSKIN_BRAIN_HANDOFF.txt',b'Synthetic factual handoff NO_GO\n')
        tail_tree=git('write-tree').decode().strip();tail=commit(frozen);head(tail)
        history=check.source26_history()
        expect('synthetic-sole-evidence-tail-history',check.source26_history,success=True)
        expect('synthetic-envelope-current',lambda:check.evidence26_guard(history),success=True)
        report=checkpoint/'REPORT.md';body=report.read_bytes();report.write_bytes(body+b'tampered')
        expect('synthetic-envelope-corruption',lambda:check.evidence26_guard(history),'R26_EVIDENCE_HASH')
        forged=copy.deepcopy(manifest);forged['files']['REPORT.md']=dict(bytes=len(body)+8,sha256=hashlib.sha256(body+b'tampered').hexdigest())
        (checkpoint/'manifest.json').write_bytes(encoded(forged))
        expect('rehashing-cannot-forge-committed-copy',lambda:check.evidence26_guard(history),'R26_EVIDENCE_COMMITTED_BYTES')
        report.write_bytes(body);(checkpoint/'manifest.json').write_bytes(manifest_raw)
        expect('synthetic-envelope-restored',lambda:check.evidence26_guard(history),success=True)
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
            for name in check.RELEASE26_CHECKPOINT_FILES:put(check.RELEASE26_CHECKPOINT+name,(checkpoint/name).read_bytes())
            put('ONSKIN_BRAIN_HANDOFF.txt',b'Synthetic factual handoff NO_GO\n')
            malformed_tail=commit(frozen);head(malformed_tail)
            expect('rehashed-committed-payload-framing-refused',lambda:check.evidence26_guard(check.source26_history()),'R26_PAYLOAD_FRAME')
        payload_file.write_bytes(original_payload);(checkpoint/'manifest.json').write_bytes(manifest_raw)
        git('read-tree',tail_tree);head(tail)
        for field,value in [('acceptanceGranted',True),('acceptanceGranted',0),('schema',True),('release','GO')]:
            changed=copy.deepcopy(manifest);changed[field]=value;(checkpoint/'manifest.json').write_bytes(encoded(changed))
            expect('evidence-cannot-admit',lambda:check.evidence26_guard(history),'R26_EVIDENCE_NO_ADMISSION')
        (checkpoint/'manifest.json').write_bytes(manifest_raw)
        extra=checkpoint/'unexpected';extra.mkdir()
        try:expect('evidence-extra-directory',lambda:check.evidence26_guard(history))
        finally:extra.rmdir()
        link=checkpoint/'linked-report';os.link(report,link)
        try:expect('evidence-hardlink',lambda:check.evidence26_guard(history),'R23_PUBLIC_FILE')
        finally:link.unlink()
        put(next(iter(check.RELEASE26_NEW_APP)));second=commit(tail);head(second)
        expect('source-or-second-tail-after-evidence',check.source26_history,'R26_AFTER_EVIDENCE_TAIL')
        git('read-tree',tail_tree);head(tail)
        expect('synthetic-exact-final-restoration',lambda:check.evidence26_guard(check.source26_history()),success=True)
    finally:
        check.ROOT=old_root
        for key in original_env:os.environ[key]=original_env[key]
        assert root.parent==temporary_parent and root.name.startswith('release26-synthetic-')
        def writable_remove(function,path,error):
            os.chmod(path,stat.S_IWRITE|stat.S_IREAD)
            function(path)
        shutil.rmtree(root,onerror=writable_remove)
    print(json.dumps(dict(status='PASS',positiveControls=positive,refusals=refused,inheritedFunctions=len(old),
        qualification='SYNTHETIC_GIT_AND_SCHEMA_CONTROLS_NOT_INDEPENDENT_FULL_CHECKOUT_OR_APP_PRIVACY_PROOF',
        acceptanceGranted=False,release='NO_GO')),flush=True)


if __name__=='__main__':
    main()
