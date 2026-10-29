"""Release25 refusal controls. Synthetic Git tests never count as full-checkout proof."""
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


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--source-root',type=Path,default=Path(__file__).resolve().parents[3])
    parser.add_argument('--checker',type=Path)
    args=parser.parse_args()
    source=args.source_root.resolve(); actual=source/'scripts/release/full-app-j01/check.py'
    raw=(args.checker or actual).read_bytes()
    namespace={'__name__':'release25_consumer','__file__':str(actual)}
    exec(compile(raw,str(actual),'exec'),namespace)
    class Module: pass
    check=Module();check.__dict__=namespace
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
    candidate=dict(schema=1,authority=check.RELEASE25_AUTHORITY,status='SUBMITTED_REVIEW_REQUIRED',base=check.RELEASE25_BASE,
        tree=check.RELEASE25_TREE,scopeCommit=check.RELEASE25_PLAN_COMMIT,scopePlanSHA256=check.RELEASE25_PLAN_SHA256,
        inputManifestSHA256=check.RELEASE25_INPUT,acceptanceGranted=False,
        admissions=dict(G97=False,DB=False,M103=False,M2=False,J01=False,PUBLIC=False),pr=None)
    plan=(source/check.RELEASE25_PLAN).read_bytes()
    expect('exact-committed-plan',lambda:check.scope25_guard(plan),success=True)
    expect('exact-nonadmitting-contract',lambda:check.candidate25_guard(encoded(candidate)),success=True)
    for key,value in [('schema',True),('schema',1.0),('pr',True),('pr',0),('pr',-1),('pr',29.0),
        ('acceptanceGranted',0),('acceptanceGranted',None),('status','ACCEPTED'),('base','0'*40),
        ('tree','0'*40),('scopeCommit','0'*40),('scopePlanSHA256','0'*64),('inputManifestSHA256','0'*64),('authority','UNISSUED')]:
        changed=copy.deepcopy(candidate);changed[key]=value
        expect('contract-type-or-authority:'+key+':'+repr(value),lambda v=changed:check.candidate25_guard(encoded(v)),'R25_NO_ADMISSION')
    for key in candidate['admissions']:
        for value in (True,0,None,'false'):
            changed=copy.deepcopy(candidate);changed['admissions'][key]=value
            expect('closed-admission:'+key+':'+repr(value),lambda v=changed:check.candidate25_guard(encoded(v)),'R25_NO_ADMISSION')
    for body in (b'[]',b'{}',encoded(candidate).replace(b'"schema": 1',b'"schema": 1,"schema": 1'),
        encoded(candidate).replace(b'"pr": null',b'"pr": NaN'),b' '*(65537)):
        expect('malformed-contract',lambda b=body:check.candidate25_guard(b))
    for changed in (plan+b'\n',plan.replace(b'five',b'four'),plan.replace(b'5/25',b'6/25')):
        if changed!=plan:expect('changed-plan-refused',lambda b=changed:check.scope25_guard(b),'R25_PLAN_IDENTITY')
    for path in ('../escape','/absolute','C:/drive','a\\b','A//b','A/../b','A/file.','NUL.txt','Ａ/file','a\x00b'):
        expect('unsafe-or-Unicode-path:'+repr(path),lambda p=path:check.name25(p,{}),'R25_PATH')
    for paths in [('A/file','a/other'),('a','a/child')]:
        def collision(paths=paths):
            identities={}
            for path in paths:check.name25(path,identities)
        expect('implicit-parent-alias-or-kind',collision,'R25_PATH_ALIAS')
    expect('authentic-append-only-checker',lambda:check.validate25_checker(raw),success=True)
    terminal=b"if __name__ == '__main__':\n    sys.exit(main())\n"
    before=check.git23('show',check.RELEASE25_BASE+':scripts/release/full-app-j01/check.py')
    old=[ast.dump(n,include_attributes=False) for n in ast.parse(before).body if isinstance(n,ast.FunctionDef)]
    new=[ast.dump(n,include_attributes=False) for n in ast.parse(raw).body if isinstance(n,ast.FunctionDef)]
    assert new[:len(old)]==old
    for addition,code in [(b'validate = validate25\n','R25_DUPLICATE_ASSIGNMENT'),
        (b'import socket\n','R25_MODULE_SCOPE'),(b'RELEASE25_SIDE_EFFECT = globals().clear()\n','R25_GLOBAL_SIDE_EFFECT'),
        (b'def arbitrary_injection(): pass\n','R25_FUNCTION_SCOPE')]:
        expect('module-injection:'+code,lambda b=addition:check.validate25_checker(raw[:-len(terminal)]+b+terminal),code)
    for a,b,code in [(b"'FAIL/NO_GO'",b"'PASS'",'R25_INHERITED_BYTES'),
        (b'source_guard = source25_guard\n',b'source_guard = source24_guard\n','R25_DISPATCH'),
        (b'validate = validate25\n',b'','R25_DISPATCH_REQUIRED'),
        (b"'apps/mobile/src/app/shelf/opened.tsx',",b"'.github/workflows/security.yml',",'R25_AUTHENTIC_FINITE_GRANT')]:
        expect('checker-mutation:'+code,lambda a=a,b=b:check.validate25_checker(raw.replace(a,b,1)),code)
    body=next(n for n in ast.parse(raw).body if isinstance(n,ast.FunctionDef) and n.name=='source25_guard')
    segment=ast.get_source_segment(raw.decode('utf-8'),body).encode()
    bypass=raw.replace(segment,b'def source25_guard():\n    return {}\n',1)
    expect('source-guard-body-cannot-be-replaced',lambda:check.validate25_checker(bypass),'R25_APPENDIX_BYTES')
    for error in (RuntimeError('SYNTHETIC_CANARY'),OSError('SYNTHETIC_CANARY'),ValueError('SYNTHETIC_CANARY')):
        with patch.object(check,'validate25_checker',return_value=None),patch.object(check,'source25_guard',side_effect=error):
            expect('unknown-error-no-disclosure',check.validate25,'R25_EXECUTION_INCOMPLETE')
    with patch.object(check,'validate25_checker',return_value=None),patch.object(check,'source25_guard',return_value={}),patch.object(check,'historical21_validate',side_effect=ValueError('FINITE_IDS:SYNTHETIC_CANARY')):
        try:check.validate25()
        except ValueError as error:assert error.args==('FINITE_IDS:',)
        else:raise AssertionError('legacy refusal accepted')
        refused+=1
    with patch.object(check,'validate25_checker',return_value=None),patch.object(check,'source25_guard',return_value={'phase':'SOURCE'}),patch.object(check,'historical21_validate',return_value={'valid':True}):
        result=check.validate25();assert result['valid'] is True and result['release']=='NO_GO' and result['acceptanceGranted'] is False
        assert all(v is False for v in result['admissions'].values());positive+=1
    with patch.object(check,'validate24',return_value={'qualification':'UNCHANGED_HISTORICAL_ROUTE'}) as route:
        with tempfile.TemporaryDirectory(prefix='release25-external-bundle-') as directory:
            assert check.validate25(Path(directory))['qualification']=='UNCHANGED_HISTORICAL_ROUTE';route.assert_called_once();positive+=1
    with patch.dict(os.environ,{'GIT_DIR':'/synthetic/redirect'}):
        expect('Git-environment-before-endpoint',check.source25_endpoint,'R23_GIT_ENV')
        expect('Git-environment-before-store',check.full25_store,'R23_GIT_ENV')
    common=Path(check.git23('rev-parse','--git-common-dir').decode().strip())
    common=common if common.is_absolute() else source/common
    temporary_parent=Path(tempfile.gettempdir()).resolve()
    root=Path(tempfile.mkdtemp(prefix='release25-synthetic-',dir=temporary_parent)).resolve()
    assert root.parent==temporary_parent and root.name.startswith('release25-synthetic-')
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
        git('read-tree',check.RELEASE25_PLAN_COMMIT)
        def put(path,body=b'synthetic public fixture\n',mode='100644'):
            oid=git('hash-object','-w','--stdin',data=body).decode().strip()
            git('update-index','--add','--cacheinfo',mode,oid,path)
        def commit(parent):
            return git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit-tree',
                git('write-tree').decode().strip(),'-p',parent,data=b'Synthetic Release25 control, not real source proof\n').decode().strip()
        def head(value):git('update-ref','HEAD',value)
        def delta():
            return check.validate25_diff(git('diff','--cached','--raw','--no-abbrev','--no-renames','-z',check.RELEASE25_BASE),
                lambda p:git('show',':'+p))
        def restore_index():git('read-tree',authentic_tree);head(authentic)
        put('scripts/release/full-app-j01/check.py',raw);put(check.RELEASE25_CANDIDATE,encoded(candidate))
        authentic_tree=git('write-tree').decode().strip();authentic=commit(check.RELEASE25_PLAN_COMMIT);head(authentic)
        git('checkout-index','--all')
        check.ROOT=root
        expect('synthetic-finite-delta',delta,success=True)
        expect('synthetic-plan-first-history',check.source25_history,success=True)
        expect('synthetic-shared-object-store-refused-as-independent',check.full25_store,'R25_ALTERNATES')
        for path in ('.github/workflows/security.yml','supabase/config.toml','apps/mobile/src/features/healthConsent/lifecycleStore.ts',
            'apps/mobile/src/features/photos/store.ts','scripts/phase2/canonical-postgres-mirror24.mjs'):
            put(path);expect('protected-staged-edit',delta,'R25_FINITE_SCOPE');restore_index()
            git('update-index','--force-remove',path);expect('protected-delete',delta,'R25_FINITE_SCOPE');restore_index()
        for mode in ('100755','120000'):
            put(next(iter(check.RELEASE25_NEW_APP)),mode=mode)
            expect('new-mode-or-link-refused',delta,'R25_MODE_OR_DELETION');restore_index()
        put('.github/workflows/security.yml');tampered=commit(authentic)
        git('read-tree',authentic_tree);restored=commit(tampered);head(restored)
        expect('intermediate-protected-change-then-restoration',check.source25_history,'R25_FINITE_SCOPE');restore_index()
        put(check.RELEASE25_PLAN,plan+b'\n');changed=commit(authentic);head(changed)
        expect('plan-later-modification',check.source25_history,'R25_PLAN_IDENTITY');restore_index()
        contract=root/check.RELEASE25_CANDIDATE;original_contract=contract.read_bytes()
        ci=copy.deepcopy(candidate);ci['pr']=29;contract.write_bytes(encoded(ci))
        event=dict(number=29,repository=dict(full_name='TasfiqJ/onSkin'),pull_request=dict(number=29,
            base=dict(sha=check.RELEASE25_BASE,ref='stage/m1-security-dependency-db24'),
            head=dict(sha=authentic,ref='stage/m1-real-first-value25',repo=dict(full_name='TasfiqJ/onSkin')),
            draft=True,maintainer_can_modify=False,auto_merge=None))
        event_path=root/'.git/release25-event.json';event_path.write_bytes(encoded(event))
        env=dict(GITHUB_ACTIONS='true',GITHUB_EVENT_NAME='pull_request',GITHUB_REPOSITORY='TasfiqJ/onSkin',
            GITHUB_REF='refs/pull/29/merge',GITHUB_SHA=authentic,GITHUB_EVENT_PATH=str(event_path))
        with patch.dict(os.environ,env):
            expect('CI-exact-pinned-base-and-policy',check.source25_endpoint,success=True)
            for group,key,value in [('base','sha','0'*40),('base','ref','main'),('head','ref','stage/unissued'),
                ('head','sha','0'*40)]:
                changed=copy.deepcopy(event);changed['pull_request'][group][key]=value;event_path.write_bytes(encoded(changed))
                expect('CI-forged-source-identity',check.source25_endpoint,'R25_CI_EVENT')
            for key,value in [('draft',False),('draft',1),('maintainer_can_modify',True),('maintainer_can_modify',0),
                ('auto_merge',False),('number',True)]:
                changed=copy.deepcopy(event);changed['pull_request'][key]=value;event_path.write_bytes(encoded(changed))
                expect('CI-policy-type-refusal',check.source25_endpoint,'R25_CI_EVENT')
            event_path.write_bytes(encoded(event))
            merge=git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit-tree',authentic_tree,
                '-p',check.RELEASE25_BASE,'-p',authentic,data=b'Synthetic CI merge, not merged PR\n').decode().strip();head(merge)
            with patch.dict(os.environ,{'GITHUB_SHA':merge}):
                expect('CI-tree-equal-two-parent-checkout',check.source25_endpoint,success=True)
            badmerge=git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit-tree',check.RELEASE25_TREE,
                '-p',check.RELEASE25_BASE,'-p',authentic,data=b'Synthetic unequal CI merge\n').decode().strip();head(badmerge)
            with patch.dict(os.environ,{'GITHUB_SHA':badmerge}):
                expect('CI-unequal-merge-tree',check.source25_endpoint,'R25_CI_MERGE_TREE')
            head(authentic)
            event_path.write_bytes(encoded(event)+b' '*(1024*1024))
            expect('CI-event-read-bound',check.source25_endpoint,'R23_PUBLIC_BOUND')
        contract.write_bytes(original_contract)
        # Qualify the next checks explicitly: full25_store is skipped only because
        # this synthetic fixture intentionally shares immutable baseline objects.
        with patch.object(check,'full25_store',return_value=None):
            expect('synthetic-mounted-source-guard-current',check.source25_guard,success=True)
            for flag,undo in [('--assume-unchanged','--no-assume-unchanged'),('--skip-worktree','--no-skip-worktree')]:
                git('update-index',flag,'docs/PRODUCT_REQUIREMENTS.md')
                expect('hidden-index-flag:'+flag,check.source25_guard,'R25_INDEX_FLAGS')
                git('update-index',undo,'docs/PRODUCT_REQUIREMENTS.md')
            hidden=root/'.campaign25-hidden';hidden.write_bytes(b'synthetic untracked\n')
            try:expect('hidden-untracked-source',check.source25_guard,'R25_UNTRACKED_SCOPE')
            finally:hidden.unlink()
            hidden=root/'apps/mobile/src/features/shelf/.env.synthetic';hidden.write_bytes(b'PUBLIC_SYNTHETIC_NOT_SECRET\n')
            try:expect('ignored-untracked-app-source-name-only',check.source25_guard,'R25_IGNORED_SOURCE')
            finally:hidden.unlink()
            put('.github/workflows/security.yml')
            expect('hidden-staged-protected-file',check.source25_guard,'R25_FINITE_SCOPE');restore_index()
            protected=root/'docs/PRODUCT_REQUIREMENTS.md';original=protected.read_bytes();info=protected.stat()
            git('config','core.trustctime','false');git('status','--porcelain=v1')
            changed=bytes([original[0]^1])+original[1:];protected.write_bytes(changed)
            os.utime(protected,ns=(info.st_atime_ns,info.st_mtime_ns))
            assert len(changed)==len(original) and protected.read_bytes()!=original
            try:
                expect('same-size-protected-bytes-with-restored-mtime',check.source25_guard,'R25_WORKING_BLOB')
            finally:
                protected.write_bytes(original);os.utime(protected,ns=(info.st_atime_ns,info.st_mtime_ns))
                git('config','--unset','core.trustctime');git('update-index','--refresh')
            app=next(iter(check.RELEASE25_NEW_APP));(root/app).parent.mkdir(parents=True,exist_ok=True);(root/app).write_bytes(b'synthetic new test\n')
            expect('finite-pending-new-test-before-freeze',check.source25_guard,success=True)
            (root/app).unlink()
        put('ONSKIN_BRAIN_HANDOFF.txt');early=commit(authentic);head(early)
        expect('handoff-before-evidence',check.source25_history,'R25_EVIDENCE_TAIL_SCOPE');restore_index()
        put(next(iter(check.RELEASE25_WORKLIST)));partial=commit(authentic);head(partial)
        expect('partial-worklist-freeze',check.source25_history,'R25_WORKLIST_ONLY_FREEZE');restore_index()
        for path in check.RELEASE25_WORKLIST:put(path)
        frozen_tree=git('write-tree').decode().strip();frozen=commit(authentic);head(frozen)
        expect('sole-worklist-child',check.source25_history,success=True)
        put(next(iter(check.RELEASE25_NEW_APP)));after=commit(frozen);head(after)
        expect('source-after-freeze',check.source25_history,'R25_SOURCE_AFTER_FREEZE')
        git('read-tree',frozen_tree);head(frozen)
        checkpoint=root/check.RELEASE25_CHECKPOINT;checkpoint.mkdir(parents=True)
        payload_body=b'synthetic receipt, never acceptance\n'
        archive=io.BytesIO()
        with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED) as target:
            info=zipfile.ZipInfo('receipts/synthetic.txt');info.create_system=3;info.compress_type=zipfile.ZIP_DEFLATED
            info.external_attr=(stat.S_IFREG|0o644)<<16
            target.writestr(info,payload_body)
        files={}
        for name,body in [('README.md',b'Synthetic checkpoint NO_GO\n'),('REPORT.md',b'Synthetic source-only report NO_GO\n'),
            ('payload.zip',archive.getvalue()),('verify25.py',b'# synthetic envelope input, not executed\n')]:
            (checkpoint/name).write_bytes(body);put(check.RELEASE25_CHECKPOINT+name,body)
            files[name]=dict(bytes=len(body),sha256=hashlib.sha256(body).hexdigest())
        manifest=dict(schema=1,authority=check.RELEASE25_AUTHORITY,status='SUBMITTED_REVIEW_REQUIRED',acceptanceGranted=False,
            release='NO_GO',inputManifestSHA256=check.RELEASE25_INPUT,
            source=dict(base=check.RELEASE25_BASE,baseTree=check.RELEASE25_TREE,runtimeHead=authentic,runtimeTree=authentic_tree,
                sourceHead=frozen,sourceTree=frozen_tree),files=files,
            payload=dict(schema=1,qualification='SANITIZED_TECHNICAL_EVIDENCE_NOT_ACCEPTANCE',
                files={'receipts/synthetic.txt':dict(bytes=len(payload_body),sha256=hashlib.sha256(payload_body).hexdigest())}))
        manifest_raw=encoded(manifest);(checkpoint/'manifest.json').write_bytes(manifest_raw)
        put(check.RELEASE25_CHECKPOINT+'manifest.json',manifest_raw)
        put('ONSKIN_BRAIN_HANDOFF.txt',b'Synthetic factual handoff NO_GO\n')
        tail_tree=git('write-tree').decode().strip();tail=commit(frozen);head(tail)
        history=check.source25_history()
        expect('synthetic-sole-evidence-tail-history',check.source25_history,success=True)
        expect('synthetic-envelope-current',lambda:check.evidence25_guard(history),success=True)
        report=checkpoint/'REPORT.md';body=report.read_bytes();report.write_bytes(body+b'tampered')
        expect('synthetic-envelope-corruption',lambda:check.evidence25_guard(history),'R25_EVIDENCE_HASH')
        forged=copy.deepcopy(manifest);forged['files']['REPORT.md']=dict(bytes=len(body)+8,sha256=hashlib.sha256(body+b'tampered').hexdigest())
        (checkpoint/'manifest.json').write_bytes(encoded(forged))
        expect('rehashing-cannot-forge-committed-copy',lambda:check.evidence25_guard(history),'R25_EVIDENCE_COMMITTED_BYTES')
        report.write_bytes(body);(checkpoint/'manifest.json').write_bytes(manifest_raw)
        expect('synthetic-envelope-restored',lambda:check.evidence25_guard(history),success=True)
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
            for name in check.RELEASE25_CHECKPOINT_FILES:put(check.RELEASE25_CHECKPOINT+name,(checkpoint/name).read_bytes())
            put('ONSKIN_BRAIN_HANDOFF.txt',b'Synthetic factual handoff NO_GO\n')
            malformed_tail=commit(frozen);head(malformed_tail)
            expect('rehashed-committed-payload-framing-refused',lambda:check.evidence25_guard(check.source25_history()),'R25_PAYLOAD_FRAME')
        payload_file.write_bytes(original_payload);(checkpoint/'manifest.json').write_bytes(manifest_raw)
        git('read-tree',tail_tree);head(tail)
        for field,value in [('acceptanceGranted',True),('acceptanceGranted',0),('schema',True),('release','GO')]:
            changed=copy.deepcopy(manifest);changed[field]=value;(checkpoint/'manifest.json').write_bytes(encoded(changed))
            expect('evidence-cannot-admit',lambda:check.evidence25_guard(history),'R25_EVIDENCE_NO_ADMISSION')
        (checkpoint/'manifest.json').write_bytes(manifest_raw)
        extra=checkpoint/'unexpected';extra.mkdir()
        try:expect('evidence-extra-directory',lambda:check.evidence25_guard(history))
        finally:extra.rmdir()
        link=checkpoint/'linked-report';os.link(report,link)
        try:expect('evidence-hardlink',lambda:check.evidence25_guard(history),'R23_PUBLIC_FILE')
        finally:link.unlink()
        put(next(iter(check.RELEASE25_NEW_APP)));second=commit(tail);head(second)
        expect('source-or-second-tail-after-evidence',check.source25_history,'R25_AFTER_EVIDENCE_TAIL')
        git('read-tree',tail_tree);head(tail)
        expect('synthetic-exact-final-restoration',lambda:check.evidence25_guard(check.source25_history()),success=True)
    finally:
        check.ROOT=old_root
        for key in original_env:os.environ[key]=original_env[key]
        assert root.parent==temporary_parent and root.name.startswith('release25-synthetic-')
        def writable_remove(function,path,error):
            os.chmod(path,stat.S_IWRITE|stat.S_IREAD)
            function(path)
        shutil.rmtree(root,onerror=writable_remove)
    print(json.dumps(dict(status='PASS',positiveControls=positive,refusals=refused,inheritedFunctions=len(old),
        qualification='SYNTHETIC_GIT_AND_SCHEMA_CONTROLS_NOT_INDEPENDENT_FULL_CHECKOUT_OR_APP_PRIVACY_PROOF',
        acceptanceGranted=False,release='NO_GO')),flush=True)


if __name__=='__main__':
    main()
