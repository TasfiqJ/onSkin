"""Real synthetic Git index/history falsification. No acceptance or independent-checkout claim."""
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
from unittest.mock import patch

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('check20',HERE/'check.py')
check=importlib.util.module_from_spec(spec);spec.loader.exec_module(check)

def main():
    root=check.ROOT; rejected=0; positives=0
    # A fixture-only PR number is used until the real draft allocation is bound.
    if check.RELEASE20_PR is None: check.RELEASE20_PR = 1
    def expect(name,action,code=None,expected=1):
        nonlocal rejected,positives
        try:action();actual,error=0,None
        except (ValueError,KeyError,TypeError,OSError,subprocess.SubprocessError) as exc:actual,error=1,str(exc)
        assert actual==expected and (not code or code in (error or '')),(name,actual,error)
        rejected+=actual;positives+=not actual
        print(json.dumps(dict(case=name,exit=actual,expected_exit=expected,error=error)),flush=True)
    def current_guard():
        # This unit suite targets the new finite segment. The real, complete
        # historical CLI and all original Release18 negatives run separately.
        with patch.object(check, 'source19_historical_guard', return_value={}):
            return check.source20_guard()
    checker=(HERE/'check.py').read_bytes()
    expect('preserved-original-AST',lambda:check.validate20_checker(checker),expected=0)
    for old,new in [(b"'FAIL/NO_GO'",b"'PASS'"),(b"'NOT_AUTHORIZED'",b"'AUTHORIZED'"),
                    (b"'BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED'",b"'ACCEPTED'"),
                    (b"'J01_G4_CHANGE_GATE'",b"'IGNORED_GATE'"),
                    (b"'9821",b"'ffff")]:
        if old not in checker:continue
        expect('old-semantics:'+old.decode(),lambda a=old,b=new:check.validate20_checker(checker.replace(a,b,1)),code='R20_INHERITED_')
    expect('old-source-guard',lambda:check.validate20_checker(checker.replace(b'    source09_guard()',b'    pass # source09_guard()',1)),code='R20_')
    expect('new-global-side-effect', lambda:check.validate20_checker(b"RELEASE20_SIDE_EFFECT = globals().clear()\nif __name__ == '__main__':".join(checker.rsplit(b"if __name__ == '__main__':", 1))), code='R20_GLOBAL_SIDE_EFFECT')
    expect('new-function-outside-segment', lambda:check.validate20_checker(b"def arbitrary_new_function(): pass\nif __name__ == '__main__':".join(checker.rsplit(b"if __name__ == '__main__':", 1))), code='R20_FUNCTION_SCOPE')
    protected=['AGENTS.md','package.json','package-lock.json','apps/mobile/package.json','apps/mobile/app.config.ts',
        '.github/workflows/quality.yml','.github/workflows/security.yml',
        'scripts/launch/governed-evidence-chain.mjs','scripts/launch/governed-evidence-chain.test.mjs',
        'scripts/security14/source_inventory.py','scripts/security14/triage_gitleaks.py',
        'scripts/phase9/security_acceptance/contract.py','scripts/phase9/security_acceptance/secret_scan.py',
        'scripts/phase9/security_acceptance/gitleaks.toml','scripts/phase9/security_acceptance/bootstrap_tools.py','scripts/phase4/build-source-worklist.mjs',
        'scripts/phase9/security_acceptance/source-manifest.json','scripts/phase9/security_acceptance/scan-targets.json.gz',
        'scripts/phase9/security_acceptance/proposal.json','docs/phase-9/security-advisory-exceptions.json',
        'docs/phase-9/ios-sdk-package-mapping.json','docs/phase-9/ios-sdk-lock-succession13.v1.json',
        'scripts/phase9/ios-privacy-contract.mjs','scripts/release/full-app-j01/test_contract.py',
        'docs/brain/state/brain_state.json','docs/release/full-app-j01/contract.v1.json','supabase/config.toml',
        'docs/brain/checkpoints/M1-03/IOS-PRIVACY-LOCK-13/README.md',
        'scripts/security15/build_candidate.py', 'scripts/security15/verify_candidate.py',
        'scripts/release/full-app-j01/source_consumer16.test.py',
        'scripts/release/full-app-j01/source_consumer18.test.py', 'scripts/release/full-app-j01/source_consumer19.test.py',
        'apps/mobile/src/features/photos/PhotoStorageGate.tsx', 'apps/mobile/src/features/photos/PhotoTimelineLockGate.tsx',
        'apps/mobile/src/features/photos/usePhotos.ts', 'apps/mobile/src/features/photos/store.ts',
        'apps/mobile/src/features/photos/PhotoImage.tsx', 'apps/mobile/src/features/photos/encryptedStorage.ts',
        'scripts/m1/onboarding_recovery16_browser.mjs',
        'docs/brain/checkpoints/M1-02/ONBOARDING-RECOVERY-16/README.md',
        'scripts/release/full-app-j01/source_consumer15.test.py',
        'scripts/release/full-app-j01/source_consumer17.test.py',
        'apps/mobile/src/features/onboarding/OnboardingContext.test.ts',
        'apps/mobile/src/features/onboarding/quizNavigation16.test.ts',
        'apps/mobile/src/features/onboarding/productsFooter16.test.ts',
        'apps/mobile/src/features/onboarding/onboardingRoutes.test.ts',
        'apps/mobile/src/features/healthConsent/healthLifecycleRoutes.test.ts',
        'apps/mobile/src/features/shelf/coreJourney.campaign06.test.ts',
        'apps/mobile/src/lib/consent/healthProcessingEpoch.ts',
        'apps/mobile/src/features/onboarding/quiz.ts', 'apps/mobile/src/features/onboarding/quizContract.ts',
        'apps/mobile/src/lib/consent/healthDataWriteAdmission.ts',
        'apps/mobile/src/lib/storage/privateKV.ts', 'apps/mobile/src/features/notifications/store.ts',
        'apps/mobile/src/features/notifications/deliver.ts',
        'apps/mobile/src/features/notifications/applyPreferences.ts',
        'apps/mobile/src/features/notifications/applyPreferences.test.ts',
        'apps/mobile/src/features/notifications/onboarding.test.ts',
        'docs/brain/checkpoints/M1-03/G97-COVERAGE-CANDIDATE-15/README.md']
    for name in ['../escape','/absolute','C:/drive','docs\\escape',
        *[p+x for p in check.RELEASE20_PREFIXES for x in ['../escape','.git/config','.hidden','CON.md','alias.','ÃƒÂ¯Ã‚Â¼Ã‚Â¡.md','x//y']]]:
        expect('unsafe:'+name,lambda p=name:check.require(check.allowed20(p),'R20_SCOPE'),code='R20_SCOPE')
    common=Path(check.git('rev-parse','--git-common-dir').decode().strip())
    if not common.is_absolute():common=(root/common).resolve()
    tree=check.git('write-tree').decode().strip()
    protected = [p for p in protected if p not in check.RELEASE20_EXISTING and p not in check.RELEASE20_NEW]
    with tempfile.TemporaryDirectory(prefix='onskin-source20-') as tmp:
        fixture=Path(tmp).resolve()
        def git(*args,data=None):
            r=subprocess.run(['git','-c','core.longpaths=true','-c','core.autocrlf=false',*args],cwd=fixture,input=data,capture_output=True)
            if r.returncode:raise subprocess.CalledProcessError(r.returncode,args,r.stdout,r.stderr)
            return r.stdout
        git('init','--quiet');git('config','core.autocrlf','false');git('config','core.longpaths','true');(fixture/'.git/objects/info/alternates').write_bytes(((common/'objects').as_posix()+'\n').encode())
        git('read-tree',tree)
        def put(name,data=b'synthetic bounded mutation\n',mode='100644'):
            oid=git('hash-object','-w','--stdin',data=data).decode().strip()
            git('update-index','--add','--cacheinfo',mode,oid,name)
        def commit(*parents):
            return git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit-tree',
                git('write-tree').decode().strip(),*sum((['-p',p] for p in parents),[]),data=b'source20 synthetic\n').decode().strip()
        def delta():check.validate20_diff(git('diff','--cached','--raw','--no-abbrev','--no-renames','-z',check.RELEASE20_BASE),lambda p:git('show',':'+p))
        authentic=commit(check.RELEASE20_BASE);git('update-ref','HEAD',authentic)
        check.ROOT=fixture
        try:
            expect('authentic-index',delta,expected=0)
            expect('authentic-history',check.source20_history,expected=0)
            for name in protected:
                put(name);expect('protected:'+name,delta,code='R20_SCOPE');git('read-tree',tree)
            tracked={n.decode('utf-8') for n in git('ls-files','-z').split(b'\0') if n}
            for name in protected:
                if name not in tracked:continue
                git('update-index','--force-remove',name)
                expect('protected-deletion:'+name,delta,code='R20_SCOPE');git('read-tree',tree)
            old='docs/brain/checkpoints/M1-03/G97-SOURCE-TRIAGE-14/README.md'
            data=git('show',':'+old);git('update-index','--force-remove',old)
            put(check.RELEASE20_PREFIXES[0]+'disguised-rename.md',data)
            expect('disguised-legacy-rename',delta,code='R20_SCOPE');git('read-tree',tree)
            for mode in ['120000','100755','160000']:
                put('ONSKIN_BRAIN_HANDOFF.txt',mode=mode);expect('mode:'+mode,delta,code='R20_');git('read-tree',tree)
            git('update-index','--force-remove','ONSKIN_BRAIN_HANDOFF.txt');expect('deleted',delta,code='R20_SCOPE');git('read-tree',tree)
            for names in [('Case.md','case.md')]:
                for name in names:put(check.RELEASE20_PREFIXES[0]+name)
                expect('casefold-collision',delta,code='R20_COLLISION');git('read-tree',tree)
            expect('truncated-diff',lambda:check.validate20_diff(b'bad',lambda p:b''),code='R20_DIFF_SHAPE')
            zero='0'*40;blob=git('rev-parse',':ONSKIN_BRAIN_HANDOFF.txt').decode().strip()
            for path,meta in [('ONSKIN_BRAIN_HANDOFF.txt',f':000000 100644 {zero} {blob} A'),
                              ('apps/mobile/src/features/photos/manualCompare20.test.ts',f':100644 100644 {blob} {blob} M')]:
                expect('create-vs-edit:'+path,lambda p=path,m=meta:check.validate20_diff(m.encode()+b'\0'+p.encode()+b'\0',lambda p:b''),code='R20_CREATE_EDIT')
            put('.github/workflows/quality.yml');malicious=commit(authentic);git('update-ref','HEAD',malicious)
            expect('malicious-intermediate',check.source20_history,code='R20_SCOPE')
            git('read-tree',tree);restored=commit(malicious);git('update-ref','HEAD',restored)
            expect('hidden-malicious-intermediate',check.source20_history,code='R20_SCOPE')
            git('update-ref','HEAD',authentic)
            integration=commit(check.RELEASE20_BASE,authentic);git('update-ref','HEAD',integration)
            expect('ordinary-merge',check.source20_history,code='R20_CI_')
            event=dict(number=check.RELEASE20_PR,repository=dict(full_name='TasfiqJ/onSkin'),
                pull_request=dict(number=check.RELEASE20_PR,draft=True,maintainer_can_modify=False,auto_merge=None,base=dict(sha=check.RELEASE20_BASE,ref='stage/m1-onboarding-compatibility19'),
                head=dict(sha=authentic,ref='stage/m1-f09-manual-photo-compare20',repo=dict(full_name='TasfiqJ/onSkin'))))
            event_path=fixture/'.git/event20.json'
            def write_event():event_path.write_bytes(json.dumps(event).encode())
            write_event()
            env=dict(GITHUB_EVENT_NAME='pull_request',GITHUB_REPOSITORY='TasfiqJ/onSkin',GITHUB_REF='refs/pull/'+str(check.RELEASE20_PR)+'/merge',GITHUB_SHA=integration,GITHUB_EVENT_PATH=str(event_path))
            with patch.dict(check.os.environ,env):
                expect('allocated-PR-only-integration',check.source20_history,expected=0)
                for key,value in [('GITHUB_EVENT_NAME','push'),('GITHUB_REF','refs/pull/999999/merge'),('GITHUB_REPOSITORY','foreign/repo'),('GITHUB_SHA',authentic)]:
                    with patch.dict(check.os.environ,{key:value}):expect('wrong-context:'+key,check.source20_history,code='R20_CI_')
                for section,key,value in [('base','sha',check.RELEASE13_BASE),('base','ref','main'),('head','sha',check.RELEASE20_BASE),('head','ref','foreign')]:
                    original=event['pull_request'][section][key];event['pull_request'][section][key]=value;write_event()
                    expect('wrong-event:'+section+key,check.source20_history,code='R20_CI_')
                    event['pull_request'][section][key]=original;write_event()
                event['number']=999999;write_event();expect('wrong-number',check.source20_history,code='R20_CI_')
                event['number']=check.RELEASE20_PR;write_event()
                put('ONSKIN_BRAIN_HANDOFF.txt');altered=commit(check.RELEASE20_BASE,authentic);git('update-ref','HEAD',altered)
                with patch.dict(check.os.environ,{'GITHUB_SHA':altered}):expect('wrong-merge-tree',check.source20_history,code='R20_CI_TREE')
            git('read-tree',tree);git('update-ref','HEAD',authentic)
            with patch.object(check,'RELEASE20_TREE','0'*40):expect('wrong-base-tree',check.source20_history,code='R20_BASE_TREE')
            foreign=commit(check.RELEASE13_BASE);git('update-ref','HEAD',foreign);expect('wrong-ancestry',check.source20_history)
            git('update-ref','HEAD',authentic);git('read-tree',tree);git('checkout-index','--all','--force')
            mapping=json.loads((root/check.RELEASE13_MANIFEST).read_bytes())
            for row in mapping['unchangedNativeMappings']:
                for pin in row['notes']['sourcePins']:
                    target=fixture/pin['path'];target.parent.mkdir(parents=True,exist_ok=True)
                    target.write_bytes((root/pin['path']).read_bytes())
            expect('materialized-source-segment',current_guard,expected=0)
            protected_path='.github/workflows/quality.yml'
            put(protected_path,git('show',':'+protected_path)+b'\n# hidden stage\n')
            expect('staged-hidden-by-worktree',current_guard,code='R20_SCOPE');git('read-tree',tree)
            for flag,undo in [('--assume-unchanged','--no-assume-unchanged'),('--skip-worktree','--no-skip-worktree')]:
                git('update-index',flag,protected_path)
                expect('hidden-index-flag:'+flag,current_guard,code='R20_INDEX_FLAGS')
                git('update-index',undo,protected_path)
            hidden=fixture/'docs/brain/contracts/M1X-20/.hidden';hidden.write_bytes(b'synthetic\n')
            expect('untracked-hidden-intermediate',current_guard,code='R20_UNTRACKED_SCOPE');hidden.unlink()
            witness=fixture/'docs/phase-9/ios-sdk-package-mapping.json';before=witness.read_bytes()
            witness.write_bytes(before+b'\n')
            expect('changed-old-source-witness',current_guard,code='R13_ORIGINAL_MAPPING');witness.write_bytes(before)
            owner=fixture/'docs/brain/contracts/M1X-20/candidate.json'
            original_owner=owner.read_bytes();value=json.loads(original_owner)
            for field,new in [('acceptanceGranted',True),('status','ACCEPTED'),('base','0'*40)]:
                changed=copy.deepcopy(value);changed[field]=new
                expect('forged-owner:'+field,lambda v=changed:check.candidate20_guard(json.dumps(v).encode()),code='R20_')
            for gate in value['admissions']:
                changed=copy.deepcopy(value); changed['admissions'][gate]=True
                expect('forged-admission:'+gate,lambda v=changed:check.candidate20_guard(json.dumps(v).encode()),code='R20_NO_ADMISSION')
            changed=copy.deepcopy(value); changed['newSecurityAcceptance']=True
            expect('unknown-admission',lambda:check.candidate20_guard(json.dumps(changed).encode()),code='R20_NO_ADMISSION')
            extra=fixture/'apps/mobile/src/features/photos/unapproved20.ts';extra.write_bytes(b'synthetic untracked source\n')
            expect('untracked-outside-finite-source',current_guard,code='R20_UNTRACKED_SCOPE');extra.unlink()
            owner.unlink()
            expect('missing-candidate', current_guard)
            owner.write_bytes(original_owner)
            git('update-index', '--force-remove', 'docs/brain/contracts/M1X-20/candidate.json')
            expect('missing-index-candidate', current_guard)
            git('read-tree', tree)
            missing = 'f'*40
            actual_git = check.git
            def missing_commit(*args):
                if args == ('rev-list', '--reverse', check.RELEASE20_BASE+'..'+authentic): return (missing+'\n').encode()
                return actual_git(*args)
            with patch.object(check, 'git', missing_commit): expect('missing-history-object', check.source20_history)
            path = 'ONSKIN_BRAIN_HANDOFF.txt'
            oldblob = git('rev-parse', check.RELEASE20_BASE+':'+path).decode().strip()
            raw = (f':100644 100644 {oldblob} '+('e'*40)+' M').encode()+b'\0'+path.encode()+b'\0'
            expect('forged-after-source-blob', lambda: check.validate20_diff(raw, lambda p: b'forged'), code='R20_AFTER_BLOB')
            raw = (f':100644 100644 '+('e'*40)+' '+oldblob+' M').encode()+b'\0'+path.encode()+b'\0'
            expect('forged-base-source-blob', lambda: check.validate20_diff(raw, lambda p: b'forged'), code='R20_BASE_BLOB')
            runner = check.subprocess.run
            def failed_consumer(args, **kwargs):
                if args[-1] == 'scripts/release/full-app-j01/source_consumer20.test.py': return subprocess.CompletedProcess(args, 1, b'synthetic false-success check', b'')
                return runner(args, **kwargs)
            with patch.object(check, '__name__', '__main__'), patch.object(check.subprocess, 'run', failed_consumer), patch.dict(check.os.environ, {'GITHUB_ACTIONS': 'true'}):
                expect('refused-consumer-cannot-report-success', current_guard, code='R20_SOURCE_TESTS_FAILED')
            expect('restored-source-segment',current_guard,expected=0)
        finally:check.ROOT=root
    print(json.dumps(dict(passed=True,refusals=rejected,positive_controls=positives,pr=check.RELEASE20_PR,
        qualification='SYNTHETIC_CURRENT_SEGMENT_ONLY; COMPLETE_CLI_VERIFIED_SEPARATELY',release='NO_GO')))

if __name__=='__main__':main()
