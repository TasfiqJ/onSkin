"""Release27 independent historical runner. Original Release24/25/26 scripts are never modified."""
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
PINNED27 = (
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
    dict(release=26,head='8c02a02afd7f2e9775dcc512c800d4f71f733234',tree='ff0f76d11fa7775e27732f54ce7fdfbd51c8c676',
        branch='stage/m1-first-value-recovery26',checkerSHA256='23b5e760944ee7c8163aee79a5132c1b329ec126b3e20f3c8e1fd96dab6807a3',
        checkerBlob='d7dd3c559572fbcdaa5ce42e3a7d70bcfe046c5d',consumerSHA256='8429fbd1f200b6d63064d524675c81d021f77228cfb232e8168df49ea88ff678',
        consumerBlob='4562a277aceade31a0e52aef560e0eaa58dbd293',positiveControls=26,refusals=198,
        qualification='SYNTHETIC_GIT_AND_SCHEMA_CONTROLS_NOT_INDEPENDENT_FULL_CHECKOUT_OR_APP_PRIVACY_PROOF'),
)

LOCK27_SHA256='1485297ffa6cc20367a5f2fda35bc33e12dc11ef422c813f5f28a4e339cb3b95'
POSTINSTALL27_SHA256='7b8b165ce0323bb0336e62052d1c55dab2a951880b8fce2678769fc7f423946a'
NATIVE27_PINS_SHA256='e966c32522ae67e20e7bd1f64cb4e8eb1928e518c81a8879e384a3050c51e2ae'


def require27(value, code):
    if not value: raise ValueError(code)


def same27(left, right):
    fields = tuple(name for name in dir(left) if name.startswith('st_') and name not in ('st_atime', 'st_atime_ns'))
    return fields == tuple(name for name in dir(right) if name.startswith('st_') and name not in ('st_atime', 'st_atime_ns')) and all(
        getattr(left, name) == getattr(right, name) for name in fields)


def cross27(path, named, opened):
    fields = ('st_dev', 'st_ino', 'st_nlink', 'st_size', 'st_mtime_ns', 'st_uid', 'st_gid')
    if not all(getattr(named, field) == getattr(opened, field) for field in fields): return False
    if os.name != 'nt': return named.st_mode == opened.st_mode and named.st_ctime_ns == opened.st_ctime_ns
    # Windows infers pathname execute bits from suffix; a descriptor has no suffix.
    execute = 0o111 if Path(path).suffix.lower() in ('.exe', '.com', '.bat', '.cmd') else 0
    if opened.st_mode & 0o111 or named.st_mode != opened.st_mode | execute: return False
    for field in ('st_file_attributes', 'st_reparse_tag'):
        if hasattr(named, field) != hasattr(opened, field): return False
        if hasattr(named, field) and getattr(named, field) != getattr(opened, field): return False
    if hasattr(named, 'st_birthtime_ns') != hasattr(opened, 'st_birthtime_ns'): return False
    field = 'st_birthtime_ns' if hasattr(named, 'st_birthtime_ns') else 'st_ctime_ns'
    return getattr(named, field) == getattr(opened, field)


def regular27(info, bound):
    require27(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and not getattr(info, 'st_file_attributes', 0) & 1024 and
        not info.st_mode & (stat.S_ISUID | stat.S_ISGID | stat.S_ISVTX) and 0 <= info.st_size <= bound, 'R27_REPLAY_REGULAR')


def bytes27(path, bound=128*1024*1024):
    path = Path(os.path.abspath(path))
    parents = {}
    for parent in path.parents:
        info = parent.lstat()
        require27(stat.S_ISDIR(info.st_mode) and not getattr(info, 'st_file_attributes', 0) & 1024, 'R27_REPLAY_PARENT')
        parents[parent] = (info.st_dev, info.st_ino, info.st_mode)
    before = path.lstat(); regular27(before, bound)
    descriptor = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_BINARY', 0))
    try:
        opened = os.fstat(descriptor); regular27(opened, bound)
        require27(cross27(path, before, opened), 'R27_REPLAY_CROSS_IDENTITY')
        blocks = []; total = 0
        while True:
            block = os.read(descriptor, min(1024*1024, before.st_size-total+1))
            if not block: break
            total += len(block)
            require27(total <= before.st_size, 'R27_REPLAY_READ_SIZE')
            blocks.append(block)
        finished = os.fstat(descriptor); regular27(finished, bound)
        after = path.lstat(); regular27(after, bound)
        require27(total == before.st_size and same27(opened, finished) and same27(before, after) and
            cross27(path, after, finished), 'R27_REPLAY_CHANGED')
        raw = b''.join(blocks)
        # Metadata can alias a mutation to bytes already consumed. Independently
        # reread this descriptor, bounded by the original size, before returning.
        os.lseek(descriptor, 0, os.SEEK_SET)
        verified = 0
        while True:
            block = os.read(descriptor, min(1024*1024, before.st_size-verified+1))
            if not block: break
            require27(verified+len(block) <= before.st_size and
                block == raw[verified:verified+len(block)], 'R27_REPLAY_CHANGED')
            verified += len(block)
        finished = os.fstat(descriptor); regular27(finished, bound)
        after = path.lstat(); regular27(after, bound)
        require27(verified == before.st_size and same27(opened, finished) and same27(before, after) and
            cross27(path, after, finished), 'R27_REPLAY_CHANGED')
    finally: os.close(descriptor)
    for parent, expected in parents.items():
        info = parent.lstat()
        require27((info.st_dev, info.st_ino, info.st_mode) == expected and not getattr(info, 'st_file_attributes', 0) & 1024,
            'R27_REPLAY_PARENT')
    return raw


def tool27(path):
    raw=bytes27(Path(path).resolve(strict=True),128*1024*1024)
    return dict(executableSHA256=hashlib.sha256(raw).hexdigest(),bytes=len(raw))


def tools27(root):
    require27(sys.flags.optimize==0,'R27_ASSERTIONS_REQUIRED')
    # The entire root was reconciled to authenticated Git bytes before this
    # existing protected toolchain code can execute. Its npm installation model
    # inventories every file/link against the separately pinned 11.20 profile.
    loader="import sys,json;from pathlib import Path;sys.path.insert(0,str(Path.cwd()/'scripts/security22'));from toolchain import identity;print(json.dumps(identity(Path.cwd()),sort_keys=True))"
    environment={key:value for key,value in os.environ.items() if not key.upper().startswith(('GIT_','NPM_','PYTHON')) and
        key.upper() not in ('NODE_OPTIONS','NODE_PATH','NODE_AUTH_TOKEN')}
    raw=child27([str(Path(sys.executable).resolve()),'-I','-B','-c',loader],root,environment,180)
    identity=json.loads(raw);tools=identity.get('tools') if type(identity) is dict else None
    require27(type(tools) is dict and set(tools)=={'git','python','node','npm'} and tools['npm'].get('version')=='11.20.0' and
        tools['npm'].get('installationModelSHA256')=='c1d3e494bb27b0ae253a41f06bd2621786f0d215dff2679e9005b25f6c3ca0b9' and
        tools['python'].get('executableSHA256')==tool27(sys.executable)['executableSHA256'],'R27_REPLAY_TOOLCHAIN_IDENTITY')
    tools['python']['assertionsEnabled']=True
    return tools


def installation27(root,pin,check,environment,tools):
    require27(not (root/'node_modules').exists() and not any(p.exists() for area in ('apps','packages') for p in (root/area).glob('*/node_modules')),'R27_REPLAY_FRESH_INSTALL')
    lock=bytes27(root/'package-lock.json');require27(hashlib.sha256(lock).hexdigest()==LOCK27_SHA256,'R27_REPLAY_LOCK_IDENTITY')
    require27(hashlib.sha256(bytes27(root/'scripts/postinstall.mjs')).hexdigest()==POSTINSTALL27_SHA256,'R27_REPLAY_HOOK_IDENTITY')
    node=Path(shutil.which('node')).resolve()
    npm=node.parent/'node_modules/npm' if os.name=='nt' else node.parent.parent/'lib/node_modules/npm'
    require27(tool27(node)['executableSHA256']==tools['node']['executableSHA256'] and
        hashlib.sha256(bytes27(npm/'bin/npm-cli.js')).hexdigest()==tools['npm']['cliSHA256'],'R27_REPLAY_TOOLCHAIN_IDENTITY')
    cache=root.parent/('npm-cache-release'+str(pin['release']))
    require27(not cache.exists(),'R27_REPLAY_FRESH_INSTALL_CACHE');cache.mkdir()
    empty_config=cache/'empty-global.npmrc'
    with empty_config.open('xb') as stream:stream.write(b'')
    install_environment={**environment,'npm_config_userconfig':os.devnull,'npm_config_globalconfig':str(empty_config)}
    child27([str(node),str(npm/'bin/npm-cli.js'),'ci','--ignore-scripts=false','--cache',str(cache),'--no-audit','--no-fund'],root,install_environment,900)
    after=json.loads(child27([str(node),'scripts/postinstall.mjs','--check'],root,install_environment,180))
    require27(type(after) is dict and after.get('check') is True and bytes27(root/'package-lock.json')==lock,'R27_REPLAY_MANDATORY_HOOKS')
    previous=check.ROOT;check.ROOT=root
    try:
        # dependency13_guard is deliberately a whole historical-lock assertion.
        # Its unmodified caller supplies an older authenticated lock adapter;
        # this setup check independently authenticates only its original mapping
        # and installed pins against the actual current PR28/29 lock above.
        manifest_raw=bytes27(root/check.RELEASE13_MANIFEST)
        require27(hashlib.sha256(manifest_raw).hexdigest()==check.RELEASE13_MANIFEST_SHA256,'R27_REPLAY_NATIVE_MANIFEST')
        manifest=json.loads(manifest_raw)
        mapping_raw=bytes27(root/manifest['originalMapping']['path'])
        require27(hashlib.sha256(mapping_raw).hexdigest()==manifest['originalMapping']['sha256'] and
            mapping_raw==check.git23('show',check.RELEASE13_BASE+':'+manifest['originalMapping']['path']),'R27_REPLAY_NATIVE_MAPPING')
        mapping=json.loads(mapping_raw)
        pins=[]
        for row in mapping['mappings']:
            for witness in row['notes']['sourcePins']:
                raw=bytes27(root/witness['path'])
                require27(hashlib.sha256(raw).hexdigest()==witness['sha256'],'R27_REPLAY_NATIVE_PIN')
                pins.append(dict(path=witness['path'],sha256=witness['sha256']))
        digest=hashlib.sha256(json.dumps(sorted(pins,key=lambda item:item['path']),sort_keys=True,separators=(',',':')).encode()).hexdigest()
        require27(len(pins)==10 and digest==NATIVE27_PINS_SHA256,'R27_REPLAY_NATIVE_PIN_INVENTORY')
    finally:check.ROOT=previous
    return dict(qualification='ACTUAL_NPM_CI_MANDATORY_HOOKS_AND_PINNED_NATIVE_SOURCE_ONLY',npmCiExit=0,
        mandatoryHooks=True,postinstallCheckExit=0,lockSHA256=LOCK27_SHA256,nativePinsCount=10,nativePinsSHA256=NATIVE27_PINS_SHA256,
        cacheMode='FRESH_EMPTY_EXTERNAL_NPM_CACHE',nativeDeviceOrSignedBuild='NOT_RUN')


def receipt27_guard(raw, nonce, context, tools):
    require27(type(raw) is bytes and len(raw)<=1024*1024,'R27_RECEIPT_BOUND')
    def pairs27(pairs):
        result={}
        for key,value in pairs:
            require27(key not in result,'R27_RECEIPT_DUPLICATE');result[key]=value
        return result
    value=json.loads(raw,object_pairs_hook=pairs27,parse_constant=lambda _:require27(False,'R27_RECEIPT_NONFINITE'))
    same=lambda left,right:json.dumps(left,sort_keys=True,separators=(',',':'),allow_nan=False)==json.dumps(right,sort_keys=True,separators=(',',':'),allow_nan=False)
    require27(type(value) is dict and set(value)=={'schema','status','qualification','acceptanceGranted','release',
        'nonce','context','tools','records'} and type(value['schema']) is int and value['schema']==1 and
        value['status']=='PASS' and value['qualification']=='AUTHENTIC_PINNED_HISTORICAL_SOURCE_REPLAY_NOT_SECURITY_ACCEPTANCE' and
        value['acceptanceGranted'] is False and value['release']=='NO_GO' and
        type(nonce) is str and re.fullmatch('[0-9a-f]{64}',nonce) and value['nonce']==nonce and
        same(value['context'],context) and same(value['tools'],tools),'R27_RECEIPT_IDENTITY')
    records=value['records'];require27(type(records) is list and len(records)==3,'R27_RECEIPT_RECORDS')
    for record,pin in zip(records,PINNED27):
        require27(type(record) is dict and set(record)=={'release','head','tree','checker','consumer','consumerResult','sourceResult',
            'checkoutBefore','checkoutAfter','toolIdentityBefore','toolIdentityAfter','installation'},'R27_RECEIPT_RECORDS')
        require27(type(record['release']) is int and record['release']==pin['release'] and record['head']==pin['head'] and
            record['tree']==pin['tree'] and record['checker']==dict(mode='100644',blob=pin['checkerBlob'],sha256=pin['checkerSHA256']) and
            record['consumer']==dict(mode='100644',blob=pin['consumerBlob'],sha256=pin['consumerSHA256']) and
            same(record['toolIdentityBefore'],tools) and same(record['toolIdentityAfter'],tools),'R27_RECEIPT_PIN')
        snapshot=record['checkoutBefore']
        require27(type(snapshot) is dict and set(snapshot)=={'head','tree','trackedBlobs','indexSHA256','treeMetadataSHA256'} and
            snapshot['head']==pin['head'] and snapshot['tree']==pin['tree'] and type(snapshot['trackedBlobs']) is int and
            snapshot['trackedBlobs']>20000 and all(type(snapshot[k]) is str and re.fullmatch('[0-9a-f]{64}',snapshot[k])
                for k in ('indexSHA256','treeMetadataSHA256')) and same(snapshot,record['checkoutAfter']),'R27_RECEIPT_SNAPSHOT')
        result=record['consumerResult']
        require27(type(result) is dict and set(result)=={'exit','status','positiveControls','refusals','qualification','acceptanceGranted','release'} and
            type(result['exit']) is int and result['exit']==0 and result['status']=='PASS' and result['qualification']==pin['qualification'] and
            result['acceptanceGranted'] is False and result['release']=='NO_GO' and type(result['positiveControls']) is int and
            type(result['refusals']) is int and result['positiveControls']>0 and result['refusals']>100 and
            (pin['positiveControls'] is None or result['positiveControls']==pin['positiveControls']) and
            (pin['refusals'] is None or result['refusals']==pin['refusals']),'R27_RECEIPT_RESULT')
        require27(same(record['sourceResult'],dict(exit=0,valid=True,release='NO_GO',acceptanceGranted=False,
            sourceAcceptance='SUBMITTED_REVIEW_REQUIRED',governance='RELEASE'+str(pin['release'])+'_FINITE_SCOPE_ONLY',
            qualification='INDEPENDENT_EXACT_HEAD_CHECKOUT_NO_CI_EVENT_CLAIM')),'R27_RECEIPT_SOURCE_RESULT')
        require27(same(record['installation'],dict(qualification='ACTUAL_NPM_CI_MANDATORY_HOOKS_AND_PINNED_NATIVE_SOURCE_ONLY',npmCiExit=0,
            mandatoryHooks=True,postinstallCheckExit=0,lockSHA256=LOCK27_SHA256,nativePinsCount=10,nativePinsSHA256=NATIVE27_PINS_SHA256,
            cacheMode='FRESH_EMPTY_EXTERNAL_NPM_CACHE',nativeDeviceOrSignedBuild='NOT_RUN')),'R27_RECEIPT_INSTALLATION')
    return value


def checkout27(root,pin,check):
    previous=check.ROOT;check.ROOT=root
    try:
        check.full27_store()
        require27(check.git23('rev-parse','HEAD').decode().strip()==pin['head'] and
            check.git23('rev-parse','HEAD^{tree}').decode().strip()==pin['tree'],'R27_REPLAY_SOURCE')
        require27(check.git23('rev-parse','refs/remotes/origin/'+pin['branch']).decode().strip()==pin['head'],'R27_REPLAY_REF')
        require27(not check.git23('status','--porcelain=v1','--untracked-files=all','-z'),'R27_REPLAY_DIRTY')
        ignored=check.git23('ls-files','--others','--ignored','--exclude-standard','--directory','--no-empty-directory','-z').decode('utf-8').split('\0')
        identities={}
        for path in ignored:
            if not path:continue
            check.name27(path.rstrip('/'),identities)
            require27(re.fullmatch(r'(?:node_modules/|(?:apps|packages)/[^/]+/node_modules/|'
                r'\.turbo/|(?:apps|packages)/[^/]+/\.turbo/|\.expo/|apps/mobile/\.expo/|\.tmp/|'
                r'apps/mobile/(?:ios|android)/|apps/mobile/expo-env\.d\.ts|'
                r'(?:[^/]+|(?:apps|packages)/[^/]+/[^/]+)\.tsbuildinfo)',path) is not None,'R27_REPLAY_IGNORED_SOURCE')
        tree=check.tree27('HEAD');index_raw=check.git23('ls-files','--stage','-z');index={}
        for row in index_raw.split(b'\0'):
            if not row:continue
            metadata,name=row.split(b'\t',1);mode,oid,stage=metadata.decode('ascii').split();path=name.decode('utf-8')
            require27(stage=='0' and path not in index,'R27_REPLAY_INDEX');index[path]=(mode,oid)
        require27(index==tree and all(row.startswith(b'H ') for row in check.git23('ls-files','-v','-z').split(b'\0') if row),
            'R27_REPLAY_INDEX')
        for kind in ('checker','consumer'):
            path='scripts/release/full-app-j01/'+('check.py' if kind=='checker' else 'source_consumer'+str(pin['release'])+'.test.py')
            require27(tree[path]==('100644',pin[kind+'Blob']) and hashlib.sha256(bytes27(root/path)).hexdigest()==pin[kind+'SHA256'],
                'R27_REPLAY_SCRIPT')
        count=check.working27_guard(index)
        for path, (mode, oid) in index.items():
            data=bytes27(root/path)
            require27(hashlib.sha1(('blob '+str(len(data))+'\0').encode()+data).hexdigest()==oid,'R27_REPLAY_BLOB')
            if os.name!='nt':require27(bool((root/path).lstat().st_mode&0o111)==(mode=='100755'),'R27_REPLAY_MODE')
        require27(check.git23('rev-parse','HEAD').decode().strip()==pin['head'] and check.git23('ls-files','--stage','-z')==index_raw and
            not check.git23('status','--porcelain=v1','--untracked-files=all','-z'),'R27_REPLAY_CHANGED')
        return dict(head=pin['head'],tree=pin['tree'],trackedBlobs=count,indexSHA256=hashlib.sha256(index_raw).hexdigest(),
            treeMetadataSHA256=hashlib.sha256(check.git23('ls-tree','-r','-z','HEAD')).hexdigest())
    finally:check.ROOT=previous


def child27(arguments,root,environment,timeout=900):
    child=subprocess.run(arguments,cwd=root,env=environment,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=timeout)
    require27(len(child.stdout)<=8*1024*1024 and len(child.stderr)<=1024*1024,'R27_REPLAY_OUTPUT_BOUND')
    require27(child.returncode==0,'R27_REPLAY_CHILD_FAILURE')
    return child.stdout


def consumer_result27(raw,pin):
    require27(type(raw) is bytes and 0<len(raw)<=8*1024*1024,'R27_REPLAY_OUTPUT_BOUND')
    def pairs27(pairs):
        value={}
        for key,item in pairs:
            require27(key not in value,'R27_REPLAY_OUTPUT_DUPLICATE');value[key]=item
        return value
    rows=[json.loads(line,object_pairs_hook=pairs27,parse_constant=lambda _:require27(False,'R27_REPLAY_OUTPUT_NONFINITE'))
        for line in raw.decode('utf-8-sig').splitlines() if line]
    require27(rows and all(type(row) is dict for row in rows),'R27_REPLAY_OUTPUT')
    last=rows[-1]
    require27(set(last)=={'status','positiveControls','refusals','inheritedFunctions','qualification','acceptanceGranted','release'} and
        last['status']=='PASS' and last['qualification']==pin['qualification'] and last['acceptanceGranted'] is False and
        last['release']=='NO_GO' and type(last['inheritedFunctions']) is int and last['inheritedFunctions']>0 and
        type(last['positiveControls']) is int and last['positiveControls']>0 and type(last['refusals']) is int and last['refusals']>100,
        'R27_REPLAY_TERMINAL')
    require27((pin['positiveControls'] is None or last['positiveControls']==pin['positiveControls']) and
        (pin['refusals'] is None or last['refusals']==pin['refusals']),'R27_REPLAY_COUNTERS')
    for row in rows[:-1]:
        require27(type(row.get('exit')) is int and row['exit'] in (0,1) and
            (row.get('expectedExit')==row['exit'] or (row['exit']==0 and row.get('case')=='all-original-function-ASTs-preserved')),
            'R27_REPLAY_CASE')
    return {key:last[key] for key in ('status','positiveControls','refusals','qualification','acceptanceGranted','release')} | {'exit':0}


def replay27(source,check,receipt):
    require27(receipt is not None and receipt.is_absolute() and not receipt.exists(),'R27_RECEIPT_FRESH_PATH')
    receipt=receipt.resolve();require27(not receipt.is_relative_to(source) and receipt.parent.is_dir(),'R27_RECEIPT_OUTSIDE_SOURCE')
    require27(hashlib.sha256(bytes27(source/'scripts/release/full-app-j01/replay27.py')).hexdigest()==
        check.RELEASE27_REPLAY_SHA256,'R27_REPLAY_CONSUMER_IDENTITY')
    proof=check.source27_guard()
    require27(not check.git23('status','--porcelain=v1','--untracked-files=all','-z'),'R27_REPLAY_CURRENT_DIRTY')
    check.working27_guard(check.tree27('HEAD'))
    require27(proof['phase'] in ('SOURCE','FROZEN','TAIL'),'R27_REPLAY_SOURCE_PHASE')
    environment={key:value for key,value in os.environ.items() if not key.upper().startswith(('GITHUB_','GIT_','PYTHON','NPM_')) and
        key.upper() not in ('NODE_OPTIONS','NODE_PATH','NODE_AUTH_TOKEN')}
    environment['GIT_TERMINAL_PROMPT']='0'
    environment.update(npm_config_userconfig=os.devnull,npm_config_registry='https://registry.npmjs.org')
    tools=tools27(source);nonce=secrets.token_hex(32)
    context=dict(head=proof['endpoint'],tree=proof['tree'],sourcePhase=proof['phase'],runId=os.environ.get('GITHUB_RUN_ID','LOCAL'),
        runAttempt=os.environ.get('GITHUB_RUN_ATTEMPT','LOCAL'),job=os.environ.get('GITHUB_JOB','LOCAL'),platform=sys.platform,
        currentReplaySHA256=check.RELEASE27_REPLAY_SHA256,qualification='CURRENT_EXACT_SOURCE_WITH_SEPARATE_HISTORICAL_CHILDREN')
    parent=Path(os.environ.get('RUNNER_TEMP',tempfile.gettempdir())).resolve()
    require27(parent.is_dir() and not parent.is_relative_to(source),'R27_REPLAY_OUTSIDE_SOURCE')
    workspace=Path(tempfile.mkdtemp(prefix='release27-historical-',dir=parent)).resolve()
    require27(workspace.parent==parent,'R27_REPLAY_FRESH_WORKSPACE')
    records=[];git=str(Path(shutil.which('git')).resolve());python=str(Path(sys.executable).resolve())
    for pin in PINNED27:
        root=workspace/('release'+str(pin['release']))
        require27(not root.exists(),'R27_REPLAY_FRESH_WORKSPACE')
        child27([git,'-c','core.hooksPath=','-c','core.autocrlf=false','-c','core.longpaths=true',
            'clone','--no-checkout','--no-hardlinks','-c','core.autocrlf=false','-c','core.longpaths=true',
            'https://github.com/TasfiqJ/onSkin.git',str(root)],workspace,environment,600)
        child27([git,'-c','core.hooksPath=','-c','core.autocrlf=false','-c','core.longpaths=true',
            'checkout','--detach',pin['head']],root,environment,300)
        before=checkout27(root,pin,check);before_tools=tools27(root)
        installed=installation27(root,pin,check,environment,tools)
        consumer='scripts/release/full-app-j01/source_consumer'+str(pin['release'])+'.test.py'
        output=child27([python,'-I','-B',consumer],root,environment)
        controls=consumer_result27(output,pin)
        checker_raw=child27([python,'-I','-B','scripts/release/full-app-j01/check.py'],root,environment)
        result=json.loads(checker_raw)
        require27(type(result) is dict and result.get('valid') is True and result.get('release')=='NO_GO' and
            result.get('acceptanceGranted') is False and result.get('source_acceptance')=='SUBMITTED_REVIEW_REQUIRED' and
            result.get('current_source_governance')=='RELEASE'+str(pin['release'])+'_FINITE_SCOPE_ONLY' and
            type(result.get('admissions')) is dict and all(value is False for value in result['admissions'].values()),'R27_REPLAY_SOURCE_RESULT')
        after=checkout27(root,pin,check);after_tools=tools27(root)
        require27(before==after and before_tools==tools==after_tools,'R27_REPLAY_CHANGED')
        records.append(dict(release=pin['release'],head=pin['head'],tree=pin['tree'],
            checker=dict(mode='100644',blob=pin['checkerBlob'],sha256=pin['checkerSHA256']),
            consumer=dict(mode='100644',blob=pin['consumerBlob'],sha256=pin['consumerSHA256']),consumerResult=controls,
            sourceResult=dict(exit=0,valid=True,release='NO_GO',acceptanceGranted=False,sourceAcceptance='SUBMITTED_REVIEW_REQUIRED',
                governance='RELEASE'+str(pin['release'])+'_FINITE_SCOPE_ONLY',qualification='INDEPENDENT_EXACT_HEAD_CHECKOUT_NO_CI_EVENT_CLAIM'),
            checkoutBefore=before,checkoutAfter=after,toolIdentityBefore=before_tools,toolIdentityAfter=after_tools,installation=installed))
    require27(check.source27_guard()==proof and tools27(source)==tools and
        not check.git23('status','--porcelain=v1','--untracked-files=all','-z'),'R27_REPLAY_CURRENT_SOURCE_CHANGED')
    check.working27_guard(check.tree27('HEAD'))
    value=dict(schema=1,status='PASS',qualification='AUTHENTIC_PINNED_HISTORICAL_SOURCE_REPLAY_NOT_SECURITY_ACCEPTANCE',
        acceptanceGranted=False,release='NO_GO',nonce=nonce,context=context,tools=tools,records=records)
    raw=(json.dumps(value,sort_keys=True)+'\n').encode();receipt27_guard(raw,nonce,context,tools)
    with receipt.open('xb') as stream:stream.write(raw)
    require27(bytes27(receipt,1024*1024)==raw,'R27_RECEIPT_CHANGED')
    receipt27_guard(bytes27(receipt,1024*1024),nonce,context,tools)
    print(json.dumps(value,sort_keys=True),flush=True)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--receipt',type=Path,required=True)
    args=parser.parse_args()
    source=Path(__file__).resolve().parents[3]
    actual=source/'scripts/release/full-app-j01/check.py'
    namespace={'__name__':'release27_runner','__file__':str(actual)}
    exec(compile(bytes27(actual),str(actual),'exec'),namespace)
    class Module: pass
    check=Module();check.__dict__=namespace
    replay27(source,check,args.receipt)


if __name__=='__main__':
    try:
        main()
    except Exception as error:
        code=error.args[0] if type(error) is ValueError and len(error.args)==1 else None
        # Never report arbitrary exception data, source paths or subprocess logs.
        allowed=('R27_ASSERTIONS_REQUIRED', 'R27_RECEIPT_BOUND', 'R27_RECEIPT_CHANGED', 'R27_RECEIPT_DUPLICATE', 'R27_RECEIPT_FRESH_PATH', 'R27_RECEIPT_IDENTITY', 'R27_RECEIPT_INSTALLATION', 'R27_RECEIPT_NONFINITE', 'R27_RECEIPT_OUTSIDE_SOURCE', 'R27_RECEIPT_PIN', 'R27_RECEIPT_RECORDS', 'R27_RECEIPT_RESULT', 'R27_RECEIPT_SNAPSHOT', 'R27_RECEIPT_SOURCE_RESULT', 'R27_REPLAY_BLOB', 'R27_REPLAY_CASE', 'R27_REPLAY_CHANGED', 'R27_REPLAY_CHILD_FAILURE', 'R27_REPLAY_CONSUMER_IDENTITY', 'R27_REPLAY_COUNTERS', 'R27_REPLAY_CROSS_IDENTITY', 'R27_REPLAY_CURRENT_DIRTY', 'R27_REPLAY_CURRENT_SOURCE_CHANGED', 'R27_REPLAY_DIRTY', 'R27_REPLAY_FRESH_INSTALL', 'R27_REPLAY_FRESH_INSTALL_CACHE', 'R27_REPLAY_FRESH_WORKSPACE', 'R27_REPLAY_HOOK_IDENTITY', 'R27_REPLAY_IGNORED_SOURCE', 'R27_REPLAY_INCOMPLETE', 'R27_REPLAY_INDEX', 'R27_REPLAY_LOCK_IDENTITY', 'R27_REPLAY_MANDATORY_HOOKS', 'R27_REPLAY_MODE', 'R27_REPLAY_NATIVE_MANIFEST', 'R27_REPLAY_NATIVE_MAPPING', 'R27_REPLAY_NATIVE_PIN', 'R27_REPLAY_NATIVE_PIN_INVENTORY', 'R27_REPLAY_OUTPUT', 'R27_REPLAY_OUTPUT_BOUND', 'R27_REPLAY_OUTPUT_DUPLICATE', 'R27_REPLAY_OUTPUT_NONFINITE', 'R27_REPLAY_OUTSIDE_SOURCE', 'R27_REPLAY_PARENT', 'R27_REPLAY_READ_SIZE', 'R27_REPLAY_REF', 'R27_REPLAY_REGULAR', 'R27_REPLAY_SCRIPT', 'R27_REPLAY_SOURCE', 'R27_REPLAY_SOURCE_PHASE', 'R27_REPLAY_SOURCE_RESULT', 'R27_REPLAY_TERMINAL', 'R27_REPLAY_TOOLCHAIN_IDENTITY')
        print(json.dumps(dict(status='REFUSED',code=code if type(code) is str and code in allowed else 'R27_REPLAY_INCOMPLETE',
            acceptanceGranted=False,release='NO_GO')),flush=True)
        raise SystemExit(1) from None
