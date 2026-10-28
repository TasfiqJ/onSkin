"""Release24 adversarial controls; synthetic Git cases are explicitly qualified."""
import ast
import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('release24_check', HERE/'check.py')
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)


def main():
    refused = positive = 0
    def expect(name, action, error=None, success=False):
        nonlocal refused, positive
        try:
            action()
        except (ValueError, KeyError, TypeError, OSError, subprocess.SubprocessError) as actual:
            assert not success and (error is None or error in str(actual)), (name, str(actual))
            refused += 1
            print(json.dumps(dict(case=name, exit=1, expectedExit=1, code=error)), flush=True)
        else:
            assert success, name+' unexpectedly admitted'
            positive += 1
            print(json.dumps(dict(case=name, exit=0, expectedExit=0)), flush=True)
    encode = lambda value: (json.dumps(value, sort_keys=True)+'\n').encode()
    candidate = json.loads((check.ROOT/check.RELEASE24_CANDIDATE).read_bytes())
    check.candidate24_guard(encode(candidate))
    candidate['pr'] = None  # Synthetic fixtures do not assume the eventual live PR number.
    raw = (HERE/'check.py').read_bytes()
    terminal = b"if __name__ == '__main__':\n    sys.exit(main())\n"
    expect('authentic-context-candidate', lambda: check.candidate24_guard(encode(candidate)), success=True)
    for key, value in [('schema', True), ('schema', 1.0), ('acceptanceGranted', 0), ('pr', True),
        ('pr', -1), ('pr', 0), ('pr', 28.0), ('base', '0'*40), ('tree', '0'*40),
        ('authority', 'UNISSUED'), ('status', 'ACCEPTED'), ('inputManifestSHA256', '0'*64), ('scopeSHA256', '0'*64)]:
        changed = copy.deepcopy(candidate); changed[key] = value
        expect('candidate-authority-or-type:'+key+':'+repr(value),
            lambda value=changed: check.candidate24_guard(encode(value)), 'R24_NO_ADMISSION')
    for key in candidate['admissions']:
        for value in (True, 0, None, 'false'):
            changed = copy.deepcopy(candidate); changed['admissions'][key] = value
            expect('technical-completion-never-admits:'+key+':'+repr(value),
                lambda value=changed: check.candidate24_guard(encode(value)), 'R24_NO_ADMISSION')
    for body, code in [(b'[]', 'R24_NO_ADMISSION'),
        (encode(candidate).replace(b'"schema": 1', b'"schema": 1,"schema": 1'), 'JSON_DUPLICATE_KEY'),
        (encode(candidate).replace(b'"pr": null', b'"pr": NaN'), 'R24_NONFINITE_JSON')]:
        expect('malformed-candidate', lambda b=body: check.candidate24_guard(b), code)
    expect('authentic-finite-grant', lambda: check.scope24_guard(check.RELEASE24_EXISTING, check.RELEASE24_NEW), success=True)
    for existing, new in [(check.RELEASE24_EXISTING | {'.github/workflows/security.yml'}, check.RELEASE24_NEW),
        (check.RELEASE24_EXISTING-{'scripts/postinstall.mjs'}, check.RELEASE24_NEW),
        (check.RELEASE24_EXISTING, check.RELEASE24_NEW | {'scripts/security24/unissued.py'})]:
        expect('forged-or-omitted-grant', lambda e=existing,n=new: check.scope24_guard(e,n), 'R24_AUTHENTIC_FINITE_GRANT')
    for path in ['../escape','/absolute','C:/drive','scripts/security24/../escape',
        'scripts/security24/Case.py','scripts/security24/patch-tooling.mjs/child',
        'scripts/security24/ＰＡＴＣＨ.py','.github/workflows/security.yml','supabase/config.toml',
        'scripts/phase9/security_acceptance/source-manifest.json','docs/phase-9/security-advisory-exceptions.json',
        'apps/mobile/src/features/photos/store.ts','scripts/phase2/unrelated.mjs']:
        expect('out-of-grant-path:'+path, lambda p=path: check.require(check.allowed24(p),'R24_FINITE_SCOPE'), 'R24_FINITE_SCOPE')
    for a,b in [('A/file','a/other'),('Ａ/file','A/other')]:
        def alias():
            seen = {}; check.remember21(a,seen); check.remember21(b,seen)
        expect('implicit-parent-Unicode-alias', alias, 'R21_')
    expect('inherited-full-prefix-exact', lambda: check.validate24_checker(raw), success=True)
    inherited = check.git23('show',check.RELEASE24_BASE+':scripts/release/full-app-j01/check.py')
    assert raw.startswith(inherited[:-len(terminal)])
    old_ast = ast.parse(inherited); new_ast = ast.parse(raw)
    old_defs = [ast.dump(n,include_attributes=False) for n in old_ast.body if isinstance(n,ast.FunctionDef)]
    new_defs = [ast.dump(n,include_attributes=False) for n in new_ast.body if isinstance(n,ast.FunctionDef)]
    assert new_defs[:len(old_defs)] == old_defs
    namespaces = {n.name:n for n in new_ast.body if isinstance(n,ast.FunctionDef)}
    legacy23 = next(n for n in ast.walk(namespaces['validate23']) if isinstance(n,ast.Assign) and
        isinstance(n.targets[0],ast.Name) and n.targets[0].id == 'legacy')
    legacy24 = next(n for n in ast.walk(namespaces['validate24']) if isinstance(n,ast.Assign) and
        isinstance(n.targets[0],ast.Name) and n.targets[0].id == 'legacy')
    assert ast.dump(legacy23.value,include_attributes=False) == ast.dump(legacy24.value,include_attributes=False)
    positive += 1
    print(json.dumps(dict(case='all-original-function-ASTs-preserved',exit=0,count=len(old_defs))),flush=True)
    for old,new,code in [(b"'FAIL/NO_GO'",b"'PASS'",'R24_INHERITED_BYTES'),
        (b"'BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED'",b"'ACCEPTED'",'R24_INHERITED_BYTES'),
        (b'source_guard = source24_guard\n',b'source_guard = source23_guard\n','R24_DISPATCH'),
        (b'validate = validate24\n',b'','R24_DISPATCH_REQUIRED')]:
        expect('checker-mutation:'+code,lambda a=old,b=new:check.validate24_checker(raw.replace(a,b,1)),code)
    for addition, code in [(b'validate = validate24\n','R24_DUPLICATE_ASSIGNMENT'),
        (b'def arbitrary_injection(): pass\n','R24_FUNCTION_SCOPE'),
        (b'RELEASE24_SIDE_EFFECT = globals().clear()\n','R24_GLOBAL_SIDE_EFFECT'),
        (b'import socket\n','R24_MODULE_SCOPE')]:
        expect('checker-injected-module-code',lambda b=addition:check.validate24_checker(raw[:-len(terminal)]+b+terminal),code)
    original = check.git23('show',check.RELEASE24_BASE+':scripts/postinstall.mjs')
    upgraded = original.replace(
        b"import { patchToolingSecurity22 } from './security22/patch-tooling.mjs';\n",
        b"import { patchToolingSecurity22 } from './security22/patch-tooling.mjs';\n"
        b"import { patchToolingSecurity24 } from './security24/patch-tooling.mjs';\n").replace(
        b'const toolingSecurity22 = patchToolingSecurity22({ root, check });\n',
        b'const toolingSecurity22 = patchToolingSecurity22({ root, check });\n'
        b'const toolingSecurity24 = patchToolingSecurity24({ root, check });\n')
    for body in (original,upgraded):
        expect('mandatory-postinstall-preserved',lambda b=body:check.package24_guard('scripts/postinstall.mjs',b),success=True)
    for body in [b'process.exit(0);\n'+upgraded,upgraded.replace(b'const viewShot = patchReactNativeViewShotPrivacy({ root, check });\n',b''),
        upgraded.replace(b'const toolingSecurity22 = patchToolingSecurity22({ root, check });\n',b''),
        upgraded.replace(b'patchToolingSecurity24({ root, check })',b'patchToolingSecurity24({ root, check: false })')]:
        expect('postinstall-bypass-refused',lambda b=body:check.package24_guard('scripts/postinstall.mjs',b),'R24_POSTINSTALL_PRESERVATION')
    quality = check.git23('show',check.RELEASE24_BASE+':.github/workflows/quality.yml')
    addition=(b'      - name: Verify canonical postgres mirror24 bootstrap controls\n'
        b'        run: node --test scripts/phase2/canonical-postgres-mirror24.test.mjs\n\n')
    anchor=b'      - name: Check local-only database contract\n'
    expect('quality-original',lambda:check.quality24_guard(quality),success=True)
    upgraded_quality=quality.replace(anchor,addition+anchor)
    expect('quality-additive-mandatory-bootstrap-test',lambda:check.quality24_guard(upgraded_quality),success=True)
    for body in [b'# altered\n'+upgraded_quality,upgraded_quality.replace(b'run: npm run phase2:db-local-verify',b'run: echo success'),
        upgraded_quality.replace(anchor,anchor+b'        if: false\n'),
        upgraded_quality.replace(anchor,anchor+b'        continue-on-error: true\n')]:
        expect('quality-no-skipped-or-green-wrapper',lambda b=body:check.quality24_guard(b),'R24_QUALITY_GATE_PRESERVATION')
    for path in ('package.json','apps/mobile/package.json','apps/catalog-operator-console/package.json'):
        body=check.git23('show',check.RELEASE24_BASE+':'+path)
        expect('package-purpose-preserved',lambda p=path,b=body:check.package24_guard(p,b),success=True)
        changed=json.loads(body);changed['name']='UNAUTHORIZED'
        expect('package-purpose-change',lambda p=path,v=changed:check.package24_guard(p,encode(v)),'R24_PACKAGE_PURPOSE')
    package=json.loads(check.git23('show',check.RELEASE24_BASE+':package.json'))
    package['scripts']['test']='echo success'
    expect('mandatory-tests-cannot-disable',lambda:check.package24_guard('package.json',encode(package)),'R24_COMMAND_PRESERVATION')
    package=json.loads(check.git23('show',check.RELEASE24_BASE+':package.json'))
    package['devDependencies']['react-native']='999.0.0'
    expect('framework-cannot-upgrade',lambda:check.package24_guard('package.json',encode(package)),'R24_FRAMEWORK_VERSION')
    for error in [ValueError('SYNTHETIC_EXCEPTION_CANARY'),OSError('/SYNTHETIC_PATH_CANARY'),ValueError(12)]:
        with patch.object(check,'source24_guard',side_effect=error):
            expect('unknown-current-errors-fixed-disclosure',check.validate24,'R24_EXECUTION_INCOMPLETE')
    for code in ('R24_NO_ADMISSION','R24_FINITE_SCOPE','R24_SOURCE_AFTER_FREEZE'):
        with patch.object(check,'source24_guard',side_effect=ValueError(code)):
            expect('known-current-refusals-retained',check.validate24,code)
    for suffix, expected in [('FINITE_IDS:SYNTHETIC_SUFFIX_CANARY','FINITE_IDS:'),
        ('SCHEMA_TYPE:/SYNTHETIC_PATH_CANARY','SCHEMA_TYPE:'),('NO_ADMISSION','NO_ADMISSION')]:
        with patch.object(check,'source24_guard',return_value={}),patch.object(check,'historical21_validate',side_effect=ValueError(suffix)):
            try: check.validate24()
            except ValueError as error: assert error.args==(expected,)
            else: raise AssertionError('legacy semantic refusal accepted')
            refused += 1
    with patch.object(check,'source24_guard',return_value={}),patch.object(check,'historical21_validate',return_value=dict(valid=True)):
        result=check.validate24()
        assert result['valid'] is True and result['current_source_governance']=='RELEASE24_FINITE_SCOPE_ONLY'
        assert result['release']=='NO_GO' and result['acceptanceGranted'] is False
        assert all(v is False for v in result['admissions'].values())
        positive += 1
    with patch.object(check,'validate23',return_value={'qualification':'UNCHANGED_HISTORICAL_FIXTURE_ROUTE'}) as route:
        with tempfile.TemporaryDirectory(prefix='release24-external-fixture-') as temporary:
            result=check.validate24(Path(temporary));assert result['qualification']=='UNCHANGED_HISTORICAL_FIXTURE_ROUTE'
            route.assert_called_once()
            positive += 1
    with patch.dict(os.environ,{'GIT_DIR':'/synthetic/redirect'}):
        expect('Git-env-before-endpoint',check.source24_endpoint,'R23_GIT_ENV')
        expect('Git-env-before-history',check.source24_history,'R23_GIT_ENV')
    common=Path(check.git23('rev-parse','--git-common-dir').decode().strip())
    if not common.is_absolute():common=(check.ROOT/common).resolve()
    old_root=check.ROOT
    with tempfile.TemporaryDirectory(prefix='release24-synthetic-git-') as temporary:
        root=Path(temporary)
        def git(*args,data=None):
            child=subprocess.run(['git','-c','core.longpaths=true','-c','core.autocrlf=false',*args],cwd=root,input=data,capture_output=True,timeout=60)
            if child.returncode:raise subprocess.CalledProcessError(child.returncode,args,child.stdout,child.stderr)
            return child.stdout
        git('init','--quiet');(root/'.git/objects/info/alternates').write_bytes(((common/'objects').as_posix()+'\n').encode())
        git('read-tree',check.RELEASE24_BASE)
        def put(path,body=b'synthetic public input\n',mode='100644'):
            oid=git('hash-object','-w','--stdin',data=body).decode().strip()
            git('update-index','--add','--cacheinfo',mode,oid,path)
        def commit(parent):
            return git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit-tree',
                git('write-tree').decode().strip(),'-p',parent,data=b'Synthetic Release24 fixture\n').decode().strip()
        def delta():
            check.validate24_diff(git('diff','--cached','--raw','--no-abbrev','--no-renames','-z',check.RELEASE24_BASE),lambda p:git('show',':'+p))
        put('scripts/release/full-app-j01/check.py',raw);put(check.RELEASE24_CANDIDATE,encode(candidate))
        authentic_tree=git('write-tree').decode().strip();authentic=commit(check.RELEASE24_BASE);git('update-ref','HEAD',authentic)
        check.ROOT=root
        actions=os.environ.pop('GITHUB_ACTIONS',None)
        try:
            expect('synthetic-authentic-delta',delta,success=True)
            expect('synthetic-authentic-history',check.source24_history,success=True)
            exact_lock=git('show',check.RELEASE24_BASE+':package-lock.json')
            lock=json.loads(exact_lock)
            mutations=[]
            changed=copy.deepcopy(lock);changed['packages']['node_modules/zod']['version']='0.0.0-review'
            mutations.append(('nonframework-version',encode(changed)))
            changed=copy.deepcopy(lock);changed['packages']['node_modules/hermes-compiler']['version']='0.0.0-review'
            mutations.append(('native-transitive-version',encode(changed)))
            changed=copy.deepcopy(lock);del changed['packages']['node_modules/deepmerge']
            mutations.append(('omitted-package-node',encode(changed)))
            changed=copy.deepcopy(lock);changed['packages']['node_modules/deepmerge']['reviewMutation']=True
            mutations.append(('arbitrary-nonversion-field',encode(changed)))
            mutations.extend([('malformed-JSON',b'{'),('same-semantics-newline',exact_lock+b'\n')])
            for label,body in mutations:
                put('package-lock.json',body)
                expect('lock-without-native-successor:'+label,delta,'R24_LOCK_SUCCESSOR_REQUIRED')
                git('read-tree',authentic_tree)
            put('package-lock.json',exact_lock)
            expect('exact-PR27-lock-retains-current-positive',delta,success=True)
            for path in ('.github/workflows/security.yml','supabase/config.toml','apps/mobile/src/features/photos/store.ts'):
                put(path);expect('protected-edit-refused',delta,'R24_FINITE_SCOPE');git('read-tree',authentic_tree)
                git('update-index','--force-remove',path);expect('protected-delete-refused',delta,'R24_FINITE_SCOPE');git('read-tree',authentic_tree)
            for mode in ('100755','120000'):
                put('scripts/security24/probe.mjs',mode=mode)
                expect('new-special-mode-refused',delta,'R24_MODE_OR_DELETION');git('read-tree',authentic_tree)
            put('.github/workflows/security.yml');tampered=commit(authentic)
            git('read-tree',authentic_tree);restored=commit(tampered);git('update-ref','HEAD',restored)
            expect('intermediate-protected-tamper-restored-history-refused',check.source24_history,'R24_FINITE_SCOPE')
            git('read-tree',authentic_tree);git('update-ref','HEAD',authentic)
            put('ONSKIN_BRAIN_HANDOFF.txt');early=commit(authentic);git('update-ref','HEAD',early)
            expect('early-handoff-refused',check.source24_history,'R24_HANDOFF_BEFORE_TAIL')
            git('read-tree',authentic_tree);git('update-ref','HEAD',authentic)
            for path in check.RELEASE24_WORKLIST:put(path)
            frozen_tree=git('write-tree').decode().strip();frozen=commit(authentic);git('update-ref','HEAD',frozen)
            expect('sole-worklist-child',check.source24_history,success=True)
            put('scripts/security24/probe.mjs');after=commit(frozen);git('update-ref','HEAD',after)
            expect('source-after-worklist-freeze-refused',check.source24_history,'R24_SOURCE_AFTER_FREEZE')
            git('read-tree',authentic_tree);git('update-ref','HEAD',authentic)
            put(next(iter(check.RELEASE24_WORKLIST)))
            mixed=commit(authentic);git('update-ref','HEAD',mixed)
            expect('partial-worklist-freeze-refused',check.source24_history,'R24_WORKLIST_ONLY_FREEZE')
            git('read-tree',authentic_tree);git('update-ref','HEAD',authentic)
            (root/'.git/info/grafts').write_bytes(b'synthetic graft\n')
            try:expect('history-graft-refused',check.source24_history,'R24_HISTORY_SUBSTITUTION')
            finally:(root/'.git/info/grafts').unlink()
            ci=copy.deepcopy(candidate);ci['pr']=28
            path=root/check.RELEASE24_CANDIDATE;path.parent.mkdir(parents=True);path.write_bytes(encode(ci))
            event=dict(number=28,repository=dict(full_name='TasfiqJ/onSkin'),pull_request=dict(number=28,
                base=dict(sha=check.RELEASE24_BASE,ref='stage/m1-security-integration23'),
                head=dict(sha=authentic,ref='stage/m1-security-dependency-db24',repo=dict(full_name='TasfiqJ/onSkin')),
                draft=True,maintainer_can_modify=False,auto_merge=None))
            event_path=root/'event.json';event_path.write_bytes(encode(event))
            env=dict(GITHUB_ACTIONS='true',GITHUB_EVENT_NAME='pull_request',GITHUB_REPOSITORY='TasfiqJ/onSkin',
                GITHUB_REF='refs/pull/28/merge',GITHUB_SHA=authentic,GITHUB_EVENT_PATH=str(event_path))
            with patch.dict(os.environ,env):
                expect('exact-pinned-PR27-CI-event',check.source24_endpoint,success=True)
                for group,key,value in [('base','sha','0'*40),('base','ref','main'),('head','ref','stage/unissued')]:
                    changed=copy.deepcopy(event);changed['pull_request'][group][key]=value;event_path.write_bytes(encode(changed))
                    expect('forged-CI-parent-or-branch',check.source24_endpoint,'R24_CI_EVENT')
                for key,value in [('draft',False),('maintainer_can_modify',True),('maintainer_can_modify',0),('auto_merge',False),('number',True)]:
                    changed=copy.deepcopy(event);changed['pull_request'][key]=value;event_path.write_bytes(encode(changed))
                    expect('CI-policy-and-type-refusals',check.source24_endpoint,'R24_CI_EVENT')
                event_path.write_bytes(encode(event)+b' '*(1024*1024))
                expect('CI-event-size-bounded',check.source24_endpoint,'R24_CI_EVENT_SIZE')
                event_path.write_bytes(b'{"SYNTHETIC_CANARY":1,"SYNTHETIC_CANARY":2}')
                expect('CI-event-duplicate-no-disclosure',check.source24_endpoint,'R24_CI_EVENT_JSON')
                event_path.write_bytes(encode(event))
                expect('CI-event-exact-restoration',check.source24_endpoint,success=True)
            git('read-tree',frozen_tree);git('update-ref','HEAD',frozen)
            checkpoint=root/check.RELEASE24_CHECKPOINT;checkpoint.mkdir(parents=True)
            files={}
            for name in ('README.md','FINAL_REPORT.md','payload.zip','verify24.py'):
                body=('synthetic envelope '+name+'\n').encode();(checkpoint/name).write_bytes(body)
                files[name]=dict(bytes=len(body),sha256=check.sha(body));put(check.RELEASE24_CHECKPOINT+name,body)
            source=dict(base=check.RELEASE24_BASE,baseTree=check.RELEASE24_TREE,runtimeHead=authentic,
                runtimeTree=authentic_tree,sourceHead=frozen,sourceTree=frozen_tree)
            manifest=dict(schema=1,authority=check.RELEASE24_AUTHORITY,status='SUBMITTED_REVIEW_REQUIRED',
                acceptanceGranted=False,release='NO_GO',inputManifestSHA256=candidate['inputManifestSHA256'],
                source=source,files=files,payload={})
            manifest_raw=encode(manifest);(checkpoint/'manifest.json').write_bytes(manifest_raw)
            put(check.RELEASE24_CHECKPOINT+'manifest.json',manifest_raw)
            (root/'ONSKIN_BRAIN_HANDOFF.txt').write_bytes(b'synthetic factual handoff\n')
            put('ONSKIN_BRAIN_HANDOFF.txt',b'synthetic factual handoff\n')
            tail=commit(frozen);tail_tree=git('write-tree').decode().strip();git('update-ref','HEAD',tail)
            expect('synthetic-envelope-current-exit0',lambda:check.evidence24_guard(tail),success=True)
            expect('synthetic-complete-one-tail-history',check.source24_history,success=True)
            report=checkpoint/'FINAL_REPORT.md';body=report.read_bytes();report.write_bytes(body+b'changed')
            expect('synthetic-envelope-corrupted-exit1',lambda:check.evidence24_guard(tail),'R24_EVIDENCE_HASH')
            forged=copy.deepcopy(manifest);forged['files']['FINAL_REPORT.md']=dict(bytes=len(body)+7,sha256=check.sha(body+b'changed'))
            (checkpoint/'manifest.json').write_bytes(encode(forged))
            expect('artifact-rehash-does-not-forge-committed-proof',lambda:check.evidence24_guard(tail),'R24_EVIDENCE_COMMITTED_BYTES')
            report.write_bytes(body);(checkpoint/'manifest.json').write_bytes(manifest_raw)
            expect('synthetic-envelope-exact-restored-exit0',lambda:check.evidence24_guard(tail),success=True)
            for field,value in [('acceptanceGranted',True),('release','GO'),('schema',True)]:
                changed=copy.deepcopy(manifest);changed[field]=value;(checkpoint/'manifest.json').write_bytes(encode(changed))
                expect('evidence-cannot-self-admit',lambda:check.evidence24_guard(tail),'R24_EVIDENCE_NO_ADMISSION')
            (checkpoint/'manifest.json').write_bytes(manifest_raw)
            extra=checkpoint/'unexpected';extra.mkdir()
            try:expect('evidence-undeclared-directory-refused',lambda:check.evidence24_guard(tail),'R24_EVIDENCE_REGULAR')
            finally:extra.rmdir()
            alias=checkpoint/'public-hardlink';os.link(report,alias)
            try:expect('evidence-hardlink-refused',lambda:check.evidence24_guard(tail),'R24_EVIDENCE_REGULAR')
            finally:alias.unlink()
            put('scripts/security24/probe.mjs');second=commit(tail);git('update-ref','HEAD',second)
            expect('second-tail-refused',check.source24_history,'R24_AFTER_EVIDENCE_TAIL')
            git('read-tree',tail_tree);git('update-ref','HEAD',tail)
            expect('synthetic-envelope-final-exact-restoration',lambda:check.evidence24_guard(tail),success=True)
        finally:
            check.ROOT=old_root
            if actions is not None:os.environ['GITHUB_ACTIONS']=actions
    print(json.dumps(dict(status='PASS',refusals=refused,positiveControls=positive,
        inheritedFunctions=len(old_defs),qualification='SYNTHETIC_GIT_AND_PUBLIC_INPUT_CONTROLS_NOT_FULL_CHECKOUT_OR_SCANNER',
        acceptanceGranted=False,release='NO_GO')),flush=True)


if __name__=='__main__':
    main()
