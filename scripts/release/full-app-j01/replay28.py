"""Release28 independent historical runner. Original Release24/25/26 scripts are never modified."""
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
PINNED28 = (
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
    {'release': 27, 'head': '517b50413b136639413b783cf3e899a6bc6c19ed', 'tree': '497f248472f775cef2a9922475fa9f3f62b75060', 'branch': 'stage/m1-first-value-safety-ci27', 'checkerSHA256': '2f2c7e97d133c2f693505f37d756a7d688ae1209c660d3b2730851c90ea72bb0', 'checkerBlob': 'b9abc419ef818395abeab33a99d74feae7a1fdcd', 'consumerSHA256': '305f56b9a1bc2a3d29c8ccedd013024cb82cacc7fda823b8083f6a54eee7daec', 'consumerBlob': '45451e433dab7085538d1c81e4cf37cd7320e22f', 'positiveControls': 26, 'refusals': 198, 'qualification': 'SYNTHETIC_GIT_AND_SCHEMA_CONTROLS_NOT_INDEPENDENT_FULL_CHECKOUT_OR_APP_PRIVACY_PROOF'},
)

LOCK28_SHA256='1485297ffa6cc20367a5f2fda35bc33e12dc11ef422c813f5f28a4e339cb3b95'
POSTINSTALL28_SHA256='7b8b165ce0323bb0336e62052d1c55dab2a951880b8fce2678769fc7f423946a'
NATIVE28_PINS_SHA256='e966c32522ae67e20e7bd1f64cb4e8eb1928e518c81a8879e384a3050c51e2ae'


def require28(value, code):
    if not value: raise ValueError(code)


def same28(left, right):
    fields = tuple(name for name in dir(left) if name.startswith('st_') and name not in ('st_atime', 'st_atime_ns'))
    return fields == tuple(name for name in dir(right) if name.startswith('st_') and name not in ('st_atime', 'st_atime_ns')) and all(
        getattr(left, name) == getattr(right, name) for name in fields)


def cross28(path, named, opened):
    fields = ('st_dev', 'st_ino', 'st_nlink', 'st_size', 'st_mtime_ns', 'st_uid', 'st_gid')
    if not all(getattr(named, field) == getattr(opened, field) for field in fields): return False
    if os.name == 'nt':
        execute = 0o111 if Path(path).suffix.lower() in ('.exe', '.com', '.bat', '.cmd') else 0
        if opened.st_mode & 0o111 or named.st_mode != opened.st_mode | execute: return False
    elif named.st_mode != opened.st_mode: return False
    for field in ('st_file_attributes', 'st_reparse_tag', 'st_birthtime_ns'):
        if hasattr(named, field) and hasattr(opened, field) and getattr(named, field) != getattr(opened, field): return False
    # All ctime mutation checks remain within the pathname or handle API domain.
    return True


def regular28(info, bound):
    require28(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and not getattr(info, 'st_file_attributes', 0) & 1024 and
        not info.st_mode & (stat.S_ISUID | stat.S_ISGID | stat.S_ISVTX) and 0 <= info.st_size <= bound, 'R28_REPLAY_REGULAR')


def bytes28(path, bound=128*1024*1024):
    path = Path(os.path.abspath(path))
    parents = {}
    for parent in path.parents:
        info = parent.lstat()
        require28(stat.S_ISDIR(info.st_mode) and not getattr(info, 'st_file_attributes', 0) & 1024, 'R28_REPLAY_PARENT')
        parents[parent] = (info.st_dev, info.st_ino, info.st_mode)
    before = path.lstat(); regular28(before, bound)
    descriptor = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_BINARY', 0))
    try:
        opened = os.fstat(descriptor); regular28(opened, bound)
        require28(cross28(path, before, opened), 'R28_REPLAY_CROSS_IDENTITY')
        blocks = []; total = 0
        while True:
            block = os.read(descriptor, min(1024*1024, before.st_size-total+1))
            if not block: break
            total += len(block)
            require28(total <= before.st_size, 'R28_REPLAY_READ_SIZE')
            blocks.append(block)
        finished = os.fstat(descriptor); regular28(finished, bound)
        after = path.lstat(); regular28(after, bound)
        require28(total == before.st_size and same28(opened, finished) and same28(before, after) and
            cross28(path, after, finished), 'R28_REPLAY_CHANGED')
        raw = b''.join(blocks)
        # Metadata can alias a mutation to bytes already consumed. Independently
        # reread this descriptor, bounded by the original size, before returning.
        os.lseek(descriptor, 0, os.SEEK_SET)
        verified = 0
        while True:
            block = os.read(descriptor, min(1024*1024, before.st_size-verified+1))
            if not block: break
            require28(verified+len(block) <= before.st_size and
                block == raw[verified:verified+len(block)], 'R28_REPLAY_CHANGED')
            verified += len(block)
        finished = os.fstat(descriptor); regular28(finished, bound)
        after = path.lstat(); regular28(after, bound)
        require28(verified == before.st_size and same28(opened, finished) and same28(before, after) and
            cross28(path, after, finished), 'R28_REPLAY_CHANGED')
    finally: os.close(descriptor)
    for parent, expected in parents.items():
        info = parent.lstat()
        require28((info.st_dev, info.st_ino, info.st_mode) == expected and not getattr(info, 'st_file_attributes', 0) & 1024,
            'R28_REPLAY_PARENT')
    return raw


def tool28(path):
    raw=bytes28(Path(path).resolve(strict=True),128*1024*1024)
    return dict(executableSHA256=hashlib.sha256(raw).hexdigest(),bytes=len(raw))


def tools28(root):
    require28(sys.flags.optimize==0,'R28_ASSERTIONS_REQUIRED')
    # The entire root was reconciled to authenticated Git bytes before this
    # existing protected toolchain code can execute. Its npm installation model
    # inventories every file/link against the separately pinned 11.20 profile.
    loader="import sys,json;from pathlib import Path;sys.path.insert(0,str(Path.cwd()/'scripts/security22'));from toolchain import identity;print(json.dumps(identity(Path.cwd()),sort_keys=True))"
    environment={key:value for key,value in os.environ.items() if not key.upper().startswith(('GIT_','NPM_','PYTHON')) and
        key.upper() not in ('NODE_OPTIONS','NODE_PATH','NODE_AUTH_TOKEN')}
    raw=child28([str(Path(sys.executable).resolve()),'-I','-B','-c',loader],root,environment,180)
    identity=json.loads(raw);tools=identity.get('tools') if type(identity) is dict else None
    require28(type(tools) is dict and set(tools)=={'git','python','node','npm'} and tools['npm'].get('version')=='11.20.0' and
        tools['npm'].get('installationModelSHA256')=='c1d3e494bb27b0ae253a41f06bd2621786f0d215dff2679e9005b25f6c3ca0b9' and
        tools['python'].get('executableSHA256')==tool28(sys.executable)['executableSHA256'],'R28_REPLAY_TOOLCHAIN_IDENTITY')
    tools['python']['assertionsEnabled']=True
    return tools


def installation28(root,pin,check,environment,tools):
    require28(not (root/'node_modules').exists() and not any(p.exists() for area in ('apps','packages') for p in (root/area).glob('*/node_modules')),'R28_REPLAY_FRESH_INSTALL')
    lock=bytes28(root/'package-lock.json');require28(hashlib.sha256(lock).hexdigest()==LOCK28_SHA256,'R28_REPLAY_LOCK_IDENTITY')
    require28(hashlib.sha256(bytes28(root/'scripts/postinstall.mjs')).hexdigest()==POSTINSTALL28_SHA256,'R28_REPLAY_HOOK_IDENTITY')
    node=Path(shutil.which('node')).resolve()
    npm=node.parent/'node_modules/npm' if os.name=='nt' else node.parent.parent/'lib/node_modules/npm'
    require28(tool28(node)['executableSHA256']==tools['node']['executableSHA256'] and
        hashlib.sha256(bytes28(npm/'bin/npm-cli.js')).hexdigest()==tools['npm']['cliSHA256'],'R28_REPLAY_TOOLCHAIN_IDENTITY')
    cache=root.parent/('npm-cache-release'+str(pin['release']))
    require28(not cache.exists(),'R28_REPLAY_FRESH_INSTALL_CACHE');cache.mkdir()
    empty_config=cache/'empty-global.npmrc'
    with empty_config.open('xb') as stream:stream.write(b'')
    install_environment={**environment,'npm_config_userconfig':os.devnull,'npm_config_globalconfig':str(empty_config)}
    child28([str(node),str(npm/'bin/npm-cli.js'),'ci','--ignore-scripts=false','--cache',str(cache),'--no-audit','--no-fund'],root,install_environment,900)
    after=json.loads(child28([str(node),'scripts/postinstall.mjs','--check'],root,install_environment,180))
    require28(type(after) is dict and after.get('check') is True and bytes28(root/'package-lock.json')==lock,'R28_REPLAY_MANDATORY_HOOKS')
    previous=check.ROOT;check.ROOT=root
    try:
        # dependency13_guard is deliberately a whole historical-lock assertion.
        # Its unmodified caller supplies an older authenticated lock adapter;
        # this setup check independently authenticates only its original mapping
        # and installed pins against the actual current PR28/29 lock above.
        manifest_raw=bytes28(root/check.RELEASE13_MANIFEST)
        require28(hashlib.sha256(manifest_raw).hexdigest()==check.RELEASE13_MANIFEST_SHA256,'R28_REPLAY_NATIVE_MANIFEST')
        manifest=json.loads(manifest_raw)
        mapping_raw=bytes28(root/manifest['originalMapping']['path'])
        require28(hashlib.sha256(mapping_raw).hexdigest()==manifest['originalMapping']['sha256'] and
            mapping_raw==check.git23('show',check.RELEASE13_BASE+':'+manifest['originalMapping']['path']),'R28_REPLAY_NATIVE_MAPPING')
        mapping=json.loads(mapping_raw)
        pins=[]
        for row in mapping['mappings']:
            for witness in row['notes']['sourcePins']:
                raw=bytes28(root/witness['path'])
                require28(hashlib.sha256(raw).hexdigest()==witness['sha256'],'R28_REPLAY_NATIVE_PIN')
                pins.append(dict(path=witness['path'],sha256=witness['sha256']))
        digest=hashlib.sha256(json.dumps(sorted(pins,key=lambda item:item['path']),sort_keys=True,separators=(',',':')).encode()).hexdigest()
        require28(len(pins)==10 and digest==NATIVE28_PINS_SHA256,'R28_REPLAY_NATIVE_PIN_INVENTORY')
    finally:check.ROOT=previous
    return dict(qualification='ACTUAL_NPM_CI_MANDATORY_HOOKS_AND_PINNED_NATIVE_SOURCE_ONLY',npmCiExit=0,
        mandatoryHooks=True,postinstallCheckExit=0,lockSHA256=LOCK28_SHA256,nativePinsCount=10,nativePinsSHA256=NATIVE28_PINS_SHA256,
        cacheMode='FRESH_EMPTY_EXTERNAL_NPM_CACHE',nativeDeviceOrSignedBuild='NOT_RUN')


def receipt28_guard(raw, nonce, context, tools):
    require28(type(raw) is bytes and len(raw)<=1024*1024,'R28_RECEIPT_BOUND')
    def pairs27(pairs):
        result={}
        for key,value in pairs:
            require28(key not in result,'R28_RECEIPT_DUPLICATE');result[key]=value
        return result
    value=json.loads(raw,object_pairs_hook=pairs27,parse_constant=lambda _:require28(False,'R28_RECEIPT_NONFINITE'))
    same=lambda left,right:json.dumps(left,sort_keys=True,separators=(',',':'),allow_nan=False)==json.dumps(right,sort_keys=True,separators=(',',':'),allow_nan=False)
    require28(type(value) is dict and set(value)=={'schema','status','qualification','acceptanceGranted','release',
        'nonce','context','tools','records'} and type(value['schema']) is int and value['schema']==1 and
        value['status']=='PASS' and value['qualification']=='AUTHENTIC_PINNED_HISTORICAL_SOURCE_REPLAY_NOT_SECURITY_ACCEPTANCE' and
        value['acceptanceGranted'] is False and value['release']=='NO_GO' and
        type(nonce) is str and re.fullmatch('[0-9a-f]{64}',nonce) and value['nonce']==nonce and
        same(value['context'],context) and same(value['tools'],tools),'R28_RECEIPT_IDENTITY')
    records=value['records'];require28(type(records) is list and len(records)==4,'R28_RECEIPT_RECORDS')
    for record,pin in zip(records,PINNED28):
        require28(type(record) is dict and set(record)=={'release','head','tree','checker','consumer','consumerResult','sourceResult',
            'checkoutBefore','checkoutAfter','toolIdentityBefore','toolIdentityAfter','installation'},'R28_RECEIPT_RECORDS')
        require28(type(record['release']) is int and record['release']==pin['release'] and record['head']==pin['head'] and
            record['tree']==pin['tree'] and record['checker']==dict(mode='100644',blob=pin['checkerBlob'],sha256=pin['checkerSHA256']) and
            record['consumer']==dict(mode='100644',blob=pin['consumerBlob'],sha256=pin['consumerSHA256']) and
            same(record['toolIdentityBefore'],tools) and same(record['toolIdentityAfter'],tools),'R28_RECEIPT_PIN')
        snapshot=record['checkoutBefore']
        require28(type(snapshot) is dict and set(snapshot)=={'head','tree','trackedBlobs','indexSHA256','treeMetadataSHA256'} and
            snapshot['head']==pin['head'] and snapshot['tree']==pin['tree'] and type(snapshot['trackedBlobs']) is int and
            snapshot['trackedBlobs']>20000 and all(type(snapshot[k]) is str and re.fullmatch('[0-9a-f]{64}',snapshot[k])
                for k in ('indexSHA256','treeMetadataSHA256')) and same(snapshot,record['checkoutAfter']),'R28_RECEIPT_SNAPSHOT')
        result=record['consumerResult']
        require28(type(result) is dict and set(result)=={'exit','status','positiveControls','refusals','qualification','acceptanceGranted','release'} and
            type(result['exit']) is int and result['exit']==0 and result['status']=='PASS' and result['qualification']==pin['qualification'] and
            result['acceptanceGranted'] is False and result['release']=='NO_GO' and type(result['positiveControls']) is int and
            type(result['refusals']) is int and result['positiveControls']>0 and result['refusals']>100 and
            (pin['positiveControls'] is None or result['positiveControls']==pin['positiveControls']) and
            (pin['refusals'] is None or result['refusals']==pin['refusals']),'R28_RECEIPT_RESULT')
        require28(same(record['sourceResult'],dict(exit=0,valid=True,release='NO_GO',acceptanceGranted=False,
            sourceAcceptance='SUBMITTED_REVIEW_REQUIRED',governance='RELEASE'+str(pin['release'])+'_FINITE_SCOPE_ONLY',
            qualification='INDEPENDENT_EXACT_HEAD_CHECKOUT_NO_CI_EVENT_CLAIM')),'R28_RECEIPT_SOURCE_RESULT')
        require28(same(record['installation'],dict(qualification='ACTUAL_NPM_CI_MANDATORY_HOOKS_AND_PINNED_NATIVE_SOURCE_ONLY',npmCiExit=0,
            mandatoryHooks=True,postinstallCheckExit=0,lockSHA256=LOCK28_SHA256,nativePinsCount=10,nativePinsSHA256=NATIVE28_PINS_SHA256,
            cacheMode='FRESH_EMPTY_EXTERNAL_NPM_CACHE',nativeDeviceOrSignedBuild='NOT_RUN')),'R28_RECEIPT_INSTALLATION')
    return value


def checkout28(root,pin,check):
    previous=check.ROOT;check.ROOT=root
    try:
        check.full28_store()
        require28(check.git23('rev-parse','HEAD').decode().strip()==pin['head'] and
            check.git23('rev-parse','HEAD^{tree}').decode().strip()==pin['tree'],'R28_REPLAY_SOURCE')
        require28(check.git23('rev-parse','refs/remotes/origin/'+pin['branch']).decode().strip()==pin['head'],'R28_REPLAY_REF')
        require28(not check.git23('status','--porcelain=v1','--untracked-files=all','-z'),'R28_REPLAY_DIRTY')
        ignored=check.git23('ls-files','--others','--ignored','--exclude-standard','--directory','--no-empty-directory','-z').decode('utf-8').split('\0')
        identities={}
        for path in ignored:
            if not path:continue
            check.name28(path.rstrip('/'),identities)
            require28(re.fullmatch(r'(?:node_modules/|(?:apps|packages)/[^/]+/node_modules/|'
                r'\.turbo/|(?:apps|packages)/[^/]+/\.turbo/|\.expo/|apps/mobile/\.expo/|\.tmp/|'
                r'apps/mobile/(?:ios|android)/|apps/mobile/expo-env\.d\.ts|'
                r'(?:[^/]+|(?:apps|packages)/[^/]+/[^/]+)\.tsbuildinfo)',path) is not None,'R28_REPLAY_IGNORED_SOURCE')
        tree=check.tree28('HEAD');index_raw=check.git23('ls-files','--stage','-z');index={}
        for row in index_raw.split(b'\0'):
            if not row:continue
            metadata,name=row.split(b'\t',1);mode,oid,stage=metadata.decode('ascii').split();path=name.decode('utf-8')
            require28(stage=='0' and path not in index,'R28_REPLAY_INDEX');index[path]=(mode,oid)
        require28(index==tree and all(row.startswith(b'H ') for row in check.git23('ls-files','-v','-z').split(b'\0') if row),
            'R28_REPLAY_INDEX')
        for kind in ('checker','consumer'):
            path='scripts/release/full-app-j01/'+('check.py' if kind=='checker' else 'source_consumer'+str(pin['release'])+'.test.py')
            require28(tree[path]==('100644',pin[kind+'Blob']) and hashlib.sha256(bytes28(root/path)).hexdigest()==pin[kind+'SHA256'],
                'R28_REPLAY_SCRIPT')
        count=check.working28_guard(index)
        for path, (mode, oid) in index.items():
            data=bytes28(root/path)
            require28(hashlib.sha1(('blob '+str(len(data))+'\0').encode()+data).hexdigest()==oid,'R28_REPLAY_BLOB')
            if os.name!='nt':require28(bool((root/path).lstat().st_mode&0o111)==(mode=='100755'),'R28_REPLAY_MODE')
        require28(check.git23('rev-parse','HEAD').decode().strip()==pin['head'] and check.git23('ls-files','--stage','-z')==index_raw and
            not check.git23('status','--porcelain=v1','--untracked-files=all','-z'),'R28_REPLAY_CHANGED')
        return dict(head=pin['head'],tree=pin['tree'],trackedBlobs=count,indexSHA256=hashlib.sha256(index_raw).hexdigest(),
            treeMetadataSHA256=hashlib.sha256(check.git23('ls-tree','-r','-z','HEAD')).hexdigest())
    finally:check.ROOT=previous


def child28(arguments,root,environment,timeout=900):
    child=subprocess.run(arguments,cwd=root,env=environment,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=timeout)
    require28(len(child.stdout)<=8*1024*1024 and len(child.stderr)<=1024*1024,'R28_REPLAY_OUTPUT_BOUND')
    require28(child.returncode==0,'R28_REPLAY_CHILD_FAILURE')
    return child.stdout


def consumer_result28(raw,pin):
    require28(type(raw) is bytes and 0<len(raw)<=8*1024*1024,'R28_REPLAY_OUTPUT_BOUND')
    def pairs27(pairs):
        value={}
        for key,item in pairs:
            require28(key not in value,'R28_REPLAY_OUTPUT_DUPLICATE');value[key]=item
        return value
    rows=[json.loads(line,object_pairs_hook=pairs27,parse_constant=lambda _:require28(False,'R28_REPLAY_OUTPUT_NONFINITE'))
        for line in raw.decode('utf-8-sig').splitlines() if line]
    require28(rows and all(type(row) is dict for row in rows),'R28_REPLAY_OUTPUT')
    last=rows[-1]
    require28(set(last)=={'status','positiveControls','refusals','inheritedFunctions','qualification','acceptanceGranted','release'} and
        last['status']=='PASS' and last['qualification']==pin['qualification'] and last['acceptanceGranted'] is False and
        last['release']=='NO_GO' and type(last['inheritedFunctions']) is int and last['inheritedFunctions']>0 and
        type(last['positiveControls']) is int and last['positiveControls']>0 and type(last['refusals']) is int and last['refusals']>100,
        'R28_REPLAY_TERMINAL')
    require28((pin['positiveControls'] is None or last['positiveControls']==pin['positiveControls']) and
        (pin['refusals'] is None or last['refusals']==pin['refusals']),'R28_REPLAY_COUNTERS')
    for row in rows[:-1]:
        require28(type(row.get('exit')) is int and row['exit'] in (0,1) and
            (row.get('expectedExit')==row['exit'] or (row['exit']==0 and row.get('case')=='all-original-function-ASTs-preserved')),
            'R28_REPLAY_CASE')
    return {key:last[key] for key in ('status','positiveControls','refusals','qualification','acceptanceGranted','release')} | {'exit':0}


def replay28(source,check,receipt):
    require28(receipt is not None and receipt.is_absolute() and not receipt.exists(),'R28_RECEIPT_FRESH_PATH')
    receipt=receipt.resolve();require28(not receipt.is_relative_to(source) and receipt.parent.is_dir(),'R28_RECEIPT_OUTSIDE_SOURCE')
    require28(hashlib.sha256(bytes28(source/'scripts/release/full-app-j01/replay28.py')).hexdigest()==
        check.RELEASE28_REPLAY_SHA256,'R28_REPLAY_CONSUMER_IDENTITY')
    proof=check.source28_guard()
    require28(not check.git23('status','--porcelain=v1','--untracked-files=all','-z'),'R28_REPLAY_CURRENT_DIRTY')
    check.working28_guard(check.tree28('HEAD'))
    require28(proof['phase'] in ('SOURCE','FROZEN','TAIL'),'R28_REPLAY_SOURCE_PHASE')
    environment={key:value for key,value in os.environ.items() if not key.upper().startswith(('GITHUB_','GIT_','PYTHON','NPM_')) and
        key.upper() not in ('NODE_OPTIONS','NODE_PATH','NODE_AUTH_TOKEN')}
    environment['GIT_TERMINAL_PROMPT']='0'
    environment.update(npm_config_userconfig=os.devnull,npm_config_registry='https://registry.npmjs.org')
    tools=tools28(source);nonce=secrets.token_hex(32)
    context=dict(head=proof['endpoint'],tree=proof['tree'],sourcePhase=proof['phase'],runId=os.environ.get('GITHUB_RUN_ID','LOCAL'),
        runAttempt=os.environ.get('GITHUB_RUN_ATTEMPT','LOCAL'),job=os.environ.get('GITHUB_JOB','LOCAL'),platform=sys.platform,
        currentReplaySHA256=check.RELEASE28_REPLAY_SHA256,qualification='CURRENT_EXACT_SOURCE_WITH_SEPARATE_HISTORICAL_CHILDREN')
    parent=Path(os.environ.get('RUNNER_TEMP',tempfile.gettempdir())).resolve()
    require28(parent.is_dir() and not parent.is_relative_to(source),'R28_REPLAY_OUTSIDE_SOURCE')
    workspace=Path(tempfile.mkdtemp(prefix='release28-historical-',dir=parent)).resolve()
    require28(workspace.parent==parent,'R28_REPLAY_FRESH_WORKSPACE')
    records=[];git=str(Path(shutil.which('git')).resolve());python=str(Path(sys.executable).resolve())
    for pin in PINNED28:
        root=workspace/('release'+str(pin['release']))
        require28(not root.exists(),'R28_REPLAY_FRESH_WORKSPACE')
        child28([git,'-c','core.hooksPath=','-c','core.autocrlf=false','-c','core.longpaths=true',
            'clone','--no-checkout','--no-hardlinks','-c','core.autocrlf=false','-c','core.longpaths=true',
            'https://github.com/TasfiqJ/onSkin.git',str(root)],workspace,environment,600)
        child28([git,'-c','core.hooksPath=','-c','core.autocrlf=false','-c','core.longpaths=true',
            'checkout','--detach',pin['head']],root,environment,300)
        before=checkout28(root,pin,check);before_tools=tools28(root)
        installed=installation28(root,pin,check,environment,tools)
        consumer='scripts/release/full-app-j01/source_consumer'+str(pin['release'])+'.test.py'
        output=child28([python,'-I','-B',consumer],root,environment)
        controls=consumer_result28(output,pin)
        checker_raw=child28([python,'-I','-B','scripts/release/full-app-j01/check.py'],root,environment)
        result=json.loads(checker_raw)
        require28(type(result) is dict and result.get('valid') is True and result.get('release')=='NO_GO' and
            result.get('acceptanceGranted') is False and result.get('source_acceptance')=='SUBMITTED_REVIEW_REQUIRED' and
            result.get('current_source_governance')=='RELEASE'+str(pin['release'])+'_FINITE_SCOPE_ONLY' and
            type(result.get('admissions')) is dict and all(value is False for value in result['admissions'].values()),'R28_REPLAY_SOURCE_RESULT')
        after=checkout28(root,pin,check);after_tools=tools28(root)
        require28(before==after and before_tools==tools==after_tools,'R28_REPLAY_CHANGED')
        records.append(dict(release=pin['release'],head=pin['head'],tree=pin['tree'],
            checker=dict(mode='100644',blob=pin['checkerBlob'],sha256=pin['checkerSHA256']),
            consumer=dict(mode='100644',blob=pin['consumerBlob'],sha256=pin['consumerSHA256']),consumerResult=controls,
            sourceResult=dict(exit=0,valid=True,release='NO_GO',acceptanceGranted=False,sourceAcceptance='SUBMITTED_REVIEW_REQUIRED',
                governance='RELEASE'+str(pin['release'])+'_FINITE_SCOPE_ONLY',qualification='INDEPENDENT_EXACT_HEAD_CHECKOUT_NO_CI_EVENT_CLAIM'),
            checkoutBefore=before,checkoutAfter=after,toolIdentityBefore=before_tools,toolIdentityAfter=after_tools,installation=installed))
    require28(check.source28_guard()==proof and tools28(source)==tools and
        not check.git23('status','--porcelain=v1','--untracked-files=all','-z'),'R28_REPLAY_CURRENT_SOURCE_CHANGED')
    check.working28_guard(check.tree28('HEAD'))
    value=dict(schema=1,status='PASS',qualification='AUTHENTIC_PINNED_HISTORICAL_SOURCE_REPLAY_NOT_SECURITY_ACCEPTANCE',
        acceptanceGranted=False,release='NO_GO',nonce=nonce,context=context,tools=tools,records=records)
    raw=(json.dumps(value,sort_keys=True)+'\n').encode();receipt28_guard(raw,nonce,context,tools)
    with receipt.open('xb') as stream:stream.write(raw)
    require28(bytes28(receipt,1024*1024)==raw,'R28_RECEIPT_CHANGED')
    receipt28_guard(bytes28(receipt,1024*1024),nonce,context,tools)
    print(json.dumps(value,sort_keys=True),flush=True)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--receipt',type=Path,required=True)
    args=parser.parse_args()
    source=Path(__file__).resolve().parents[3]
    actual=source/'scripts/release/full-app-j01/check.py'
    namespace={'__name__':'release28_runner','__file__':str(actual)}
    exec(compile(bytes28(actual),str(actual),'exec'),namespace)
    class Module: pass
    check=Module();check.__dict__=namespace
    replay28(source,check,args.receipt)


if __name__=='__main__':
    try:
        main()
    except Exception as error:
        code=error.args[0] if type(error) is ValueError and len(error.args)==1 else None
        # Never report arbitrary exception data, source paths or subprocess logs.
        allowed=('R28_ASSERTIONS_REQUIRED', 'R28_RECEIPT_BOUND', 'R28_RECEIPT_CHANGED', 'R28_RECEIPT_DUPLICATE', 'R28_RECEIPT_FRESH_PATH', 'R28_RECEIPT_IDENTITY', 'R28_RECEIPT_INSTALLATION', 'R28_RECEIPT_NONFINITE', 'R28_RECEIPT_OUTSIDE_SOURCE', 'R28_RECEIPT_PIN', 'R28_RECEIPT_RECORDS', 'R28_RECEIPT_RESULT', 'R28_RECEIPT_SNAPSHOT', 'R28_RECEIPT_SOURCE_RESULT', 'R28_REPLAY_BLOB', 'R28_REPLAY_CASE', 'R28_REPLAY_CHANGED', 'R28_REPLAY_CHILD_FAILURE', 'R28_REPLAY_CONSUMER_IDENTITY', 'R28_REPLAY_COUNTERS', 'R28_REPLAY_CROSS_IDENTITY', 'R28_REPLAY_CURRENT_DIRTY', 'R28_REPLAY_CURRENT_SOURCE_CHANGED', 'R28_REPLAY_DIRTY', 'R28_REPLAY_FRESH_INSTALL', 'R28_REPLAY_FRESH_INSTALL_CACHE', 'R28_REPLAY_FRESH_WORKSPACE', 'R28_REPLAY_HOOK_IDENTITY', 'R28_REPLAY_IGNORED_SOURCE', 'R28_REPLAY_INCOMPLETE', 'R28_REPLAY_INDEX', 'R28_REPLAY_LOCK_IDENTITY', 'R28_REPLAY_MANDATORY_HOOKS', 'R28_REPLAY_MODE', 'R28_REPLAY_NATIVE_MANIFEST', 'R28_REPLAY_NATIVE_MAPPING', 'R28_REPLAY_NATIVE_PIN', 'R28_REPLAY_NATIVE_PIN_INVENTORY', 'R28_REPLAY_OUTPUT', 'R28_REPLAY_OUTPUT_BOUND', 'R28_REPLAY_OUTPUT_DUPLICATE', 'R28_REPLAY_OUTPUT_NONFINITE', 'R28_REPLAY_OUTSIDE_SOURCE', 'R28_REPLAY_PARENT', 'R28_REPLAY_READ_SIZE', 'R28_REPLAY_REF', 'R28_REPLAY_REGULAR', 'R28_REPLAY_SCRIPT', 'R28_REPLAY_SOURCE', 'R28_REPLAY_SOURCE_PHASE', 'R28_REPLAY_SOURCE_RESULT', 'R28_REPLAY_TERMINAL', 'R28_REPLAY_TOOLCHAIN_IDENTITY')
        print(json.dumps(dict(status='REFUSED',code=code if type(code) is str and code in allowed else 'R28_REPLAY_INCOMPLETE',
            acceptanceGranted=False,release='NO_GO')),flush=True)
        raise SystemExit(1) from None
