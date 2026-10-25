"""Real synthetic Git index/history falsification. No acceptance or independent-checkout claim."""
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
from unittest.mock import patch

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('check15',HERE/'check.py')
check=importlib.util.module_from_spec(spec);spec.loader.exec_module(check)

def main():
    root=check.ROOT; rejected=0; positives=0
    def expect(name,action,code=None,expected=1):
        nonlocal rejected,positives
        try:action();actual,error=0,None
        except (ValueError,KeyError,TypeError,OSError,subprocess.SubprocessError) as exc:actual,error=1,str(exc)
        assert actual==expected and (not code or code in (error or '')),(name,actual,error)
        rejected+=actual;positives+=not actual
        print(json.dumps(dict(case=name,exit=actual,expected_exit=expected,error=error)),flush=True)
    checker=(HERE/'check.py').read_bytes()
    expect('preserved-original-AST',lambda:check.validate15_checker(checker),expected=0)
    for old,new in [(b"'FAIL/NO_GO'",b"'PASS'"),(b"'NOT_AUTHORIZED'",b"'AUTHORIZED'"),
                    (b"'BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED'",b"'ACCEPTED'"),
                    (b"'J01_G4_CHANGE_GATE'",b"'IGNORED_GATE'"),
                    (b"'9821",b"'ffff")]:
        if old not in checker:continue
        expect('old-semantics:'+old.decode(),lambda a=old,b=new:check.validate15_checker(checker.replace(a,b,1)),code='R15_INHERITED_')
    expect('old-source-guard',lambda:check.validate15_checker(checker.replace(b'    source09_guard()',b'    pass # source09_guard()',1)),code='R15_')
    protected=['package.json','package-lock.json','apps/mobile/package.json','apps/mobile/app.config.ts',
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
        'docs/brain/checkpoints/M1-03/IOS-PRIVACY-LOCK-13/README.md']
    for name in ['../escape','/absolute','C:/drive','docs\\escape',
        *[p+x for p in check.RELEASE15_PREFIXES for x in ['../escape','.git/config','.hidden','CON.md','alias.','ÃƒÂ¯Ã‚Â¼Ã‚Â¡.md','x//y']]]:
        expect('unsafe:'+name,lambda p=name:check.require(check.allowed15(p),'R15_SCOPE'),code='R15_SCOPE')
    common=Path(check.git('rev-parse','--git-common-dir').decode().strip())
    if not common.is_absolute():common=(root/common).resolve()
    tree=check.git('write-tree').decode().strip()
    with tempfile.TemporaryDirectory(prefix='onskin-source15-') as tmp:
        fixture=Path(tmp).resolve()
        def git(*args,data=None):
            r=subprocess.run(['git','-c','core.longpaths=true','-c','core.autocrlf=false',*args],cwd=fixture,input=data,capture_output=True)
            if r.returncode:raise subprocess.CalledProcessError(r.returncode,args,r.stdout,r.stderr)
            return r.stdout
        git('init','--quiet');(fixture/'.git/objects/info/alternates').write_bytes(((common/'objects').as_posix()+'\n').encode())
        git('read-tree',tree)
        def put(name,data=b'synthetic bounded mutation\n',mode='100644'):
            oid=git('hash-object','-w','--stdin',data=data).decode().strip()
            git('update-index','--add','--cacheinfo',mode,oid,name)
        def commit(*parents):
            return git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit-tree',
                git('write-tree').decode().strip(),*sum((['-p',p] for p in parents),[]),data=b'source15 synthetic\n').decode().strip()
        def delta():check.validate15_diff(git('diff','--cached','--raw','--no-abbrev','--no-renames','-z',check.RELEASE15_BASE),lambda p:git('show',':'+p))
        authentic=commit(check.RELEASE15_BASE);git('update-ref','HEAD',authentic)
        check.ROOT=fixture
        try:
            expect('authentic-index',delta,expected=0)
            expect('authentic-history',check.source15_history,expected=0)
            for name in protected:
                put(name);expect('protected:'+name,delta,code='R15_SCOPE');git('read-tree',tree)
            tracked={n.decode('utf-8') for n in git('ls-files','-z').split(b'\0') if n}
            for name in protected:
                if name not in tracked:continue
                git('update-index','--force-remove',name)
                expect('protected-deletion:'+name,delta,code='R15_SCOPE');git('read-tree',tree)
            old='docs/brain/checkpoints/M1-03/G97-SOURCE-TRIAGE-14/README.md'
            data=git('show',':'+old);git('update-index','--force-remove',old)
            put(check.RELEASE15_PREFIXES[0]+'disguised-rename.md',data)
            expect('disguised-legacy-rename',delta,code='R15_SCOPE');git('read-tree',tree)
            for mode in ['120000','100755','160000']:
                put('ONSKIN_BRAIN_HANDOFF.txt',mode=mode);expect('mode:'+mode,delta,code='R15_');git('read-tree',tree)
            git('update-index','--force-remove','ONSKIN_BRAIN_HANDOFF.txt');expect('deleted',delta,code='R15_SCOPE');git('read-tree',tree)
            for names in [('Case.md','case.md')]:
                for name in names:put(check.RELEASE15_PREFIXES[0]+name)
                expect('casefold-collision',delta,code='R15_COLLISION');git('read-tree',tree)
            expect('truncated-diff',lambda:check.validate15_diff(b'bad',lambda p:b''),code='R15_DIFF_SHAPE')
            zero='0'*40;blob=git('rev-parse',':ONSKIN_BRAIN_HANDOFF.txt').decode().strip()
            for path,meta in [('ONSKIN_BRAIN_HANDOFF.txt',f':000000 100644 {zero} {blob} A'),
                              ('scripts/security15/build_candidate.py',f':100644 100644 {blob} {blob} M')]:
                expect('create-vs-edit:'+path,lambda p=path,m=meta:check.validate15_diff(m.encode()+b'\0'+p.encode()+b'\0',lambda p:b''),code='R15_CREATE_EDIT')
            put('.github/workflows/quality.yml');malicious=commit(authentic);git('update-ref','HEAD',malicious)
            expect('malicious-intermediate',check.source15_history,code='R15_SCOPE')
            git('read-tree',tree);restored=commit(malicious);git('update-ref','HEAD',restored)
            expect('hidden-malicious-intermediate',check.source15_history,code='R15_SCOPE')
            git('update-ref','HEAD',authentic)
            integration=commit(check.RELEASE15_BASE,authentic);git('update-ref','HEAD',integration)
            expect('ordinary-merge',check.source15_history,code='R15_CI_')
            event=dict(number=check.RELEASE15_PR,repository=dict(full_name='TasfiqJ/onSkin'),
                pull_request=dict(number=check.RELEASE15_PR,base=dict(sha=check.RELEASE15_BASE,ref='stage/m103-g97-provenance-triage14'),
                head=dict(sha=authentic,ref='stage/m103-g97-coverage-candidate15',repo=dict(full_name='TasfiqJ/onSkin'))))
            event_path=fixture/'.git/event15.json'
            def write_event():event_path.write_bytes(json.dumps(event).encode())
            write_event()
            env=dict(GITHUB_EVENT_NAME='pull_request',GITHUB_REPOSITORY='TasfiqJ/onSkin',GITHUB_REF='refs/pull/'+str(check.RELEASE15_PR)+'/merge',GITHUB_SHA=integration,GITHUB_EVENT_PATH=str(event_path))
            with patch.dict(check.os.environ,env):
                expect('allocated-PR-only-integration',check.source15_history,expected=0)
                for key,value in [('GITHUB_EVENT_NAME','push'),('GITHUB_REF','refs/pull/999999/merge'),('GITHUB_REPOSITORY','foreign/repo'),('GITHUB_SHA',authentic)]:
                    with patch.dict(check.os.environ,{key:value}):expect('wrong-context:'+key,check.source15_history,code='R15_CI_')
                for section,key,value in [('base','sha',check.RELEASE13_BASE),('base','ref','main'),('head','sha',check.RELEASE15_BASE),('head','ref','foreign')]:
                    original=event['pull_request'][section][key];event['pull_request'][section][key]=value;write_event()
                    expect('wrong-event:'+section+key,check.source15_history,code='R15_CI_')
                    event['pull_request'][section][key]=original;write_event()
                event['number']=999999;write_event();expect('wrong-number',check.source15_history,code='R15_CI_')
                event['number']=check.RELEASE15_PR;write_event()
                put('ONSKIN_BRAIN_HANDOFF.txt');altered=commit(check.RELEASE15_BASE,authentic);git('update-ref','HEAD',altered)
                with patch.dict(check.os.environ,{'GITHUB_SHA':altered}):expect('wrong-merge-tree',check.source15_history,code='R15_CI_MERGE_TREE')
            git('read-tree',tree);git('update-ref','HEAD',authentic)
            with patch.object(check,'RELEASE15_TREE','0'*40):expect('wrong-base-tree',check.source15_history,code='R15_BASE_TREE')
            foreign=commit(check.RELEASE13_BASE);git('update-ref','HEAD',foreign);expect('wrong-ancestry',check.source15_history)
            git('update-ref','HEAD',authentic);git('read-tree',tree);git('checkout-index','--all','--force')
            mapping=json.loads((root/check.RELEASE13_MANIFEST).read_bytes())
            for row in mapping['unchangedNativeMappings']:
                for pin in row['notes']['sourcePins']:
                    target=fixture/pin['path'];target.parent.mkdir(parents=True,exist_ok=True)
                    target.write_bytes((root/pin['path']).read_bytes())
            expect('materialized-source-segment',check.source15_guard,expected=0)
            protected_path='.github/workflows/quality.yml'
            put(protected_path,git('show',':'+protected_path)+b'\n# hidden stage\n')
            expect('staged-hidden-by-worktree',check.source15_guard,code='R15_SCOPE');git('read-tree',tree)
            for flag,undo in [('--assume-unchanged','--no-assume-unchanged'),('--skip-worktree','--no-skip-worktree')]:
                git('update-index',flag,protected_path)
                expect('hidden-index-flag:'+flag,check.source15_guard,code='R15_INDEX_FLAGS')
                git('update-index',undo,protected_path)
            hidden=fixture/'scripts/security15/.hidden';hidden.write_bytes(b'synthetic\n')
            expect('untracked-hidden-intermediate',check.source15_guard,code='R15_UNTRACKED_SCOPE');hidden.unlink()
            witness=fixture/'docs/phase-9/ios-sdk-package-mapping.json';before=witness.read_bytes()
            witness.write_bytes(before+b'\n')
            expect('changed-old-source-witness',check.source15_guard,code='R13_');witness.write_bytes(before)
            owner=fixture/'docs/release/full-app-j01/g97-source-coverage15.unapplied.json'
            original_owner=owner.read_bytes();value=json.loads(original_owner)
            for field,new in [('acceptanceGranted',True),('status','ACCEPTED'),('stop','CONTINUE')]:
                changed=copy.deepcopy(value);changed[field]=new
                expect('forged-owner:'+field,lambda v=changed:check.candidate15_guard(json.dumps(v).encode()),code='R15_')
            expect('restored-source-segment',check.source15_guard,expected=0)
        finally:check.ROOT=root
    print(json.dumps(dict(passed=True,refusals=rejected,positive_controls=positives,pr=check.RELEASE15_PR,
        qualification='SYNTHETIC_GIT_NOT_INDEPENDENT_COMPLETE_CHECKOUT',release='NO_GO')))

if __name__=='__main__':main()
