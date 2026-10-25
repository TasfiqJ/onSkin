"""Actual private Git history/index and complete materialized fixture CLI 0/1/0.

Read-only alternate objects are not an independently complete checkout qualification.
"""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from unittest.mock import patch

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('source12_check',HERE/'check.py')
check=importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)


def main():
    root=check.ROOT
    check.validate11_checker((HERE/'check.py').read_bytes())
    for name in ('test_contract.py','source_consumer09.test.py','source_consumer10.test.py',
                 'source_consumer11.test.py','dependency_guard11.test.py'):
        assert (HERE/name).read_bytes()==check.git('show',check.RELEASE12_BASE+':scripts/release/full-app-j01/'+name)
    rejected=0
    def expect(name,action,expected=1,code=None):
        nonlocal rejected
        try:
            action();actual,error=0,None
        except (ValueError,subprocess.SubprocessError,OSError) as exc:
            actual,error=1,str(exc)
        print(json.dumps(dict(case=name,exit=actual,expected_exit=expected,error=error)),flush=True)
        assert actual==expected and (code is None or code in (error or '')),(name,error)
        rejected+=actual
    for path in ('../escape','/absolute','C:/drive','docs\\escape',
        'docs/brain/contracts/SECURITY-12/../escape','docs/brain/contracts/SECURITY-12//x',
        'docs/brain/contracts/SECURITY-12/.git/config','docs/brain/contracts/SECURITY-12/.GIT/config',
        'docs/brain/contracts/SECURITY-12/.gitattributes','docs/brain/contracts/SECURITY-12/CON.md',
        'docs/brain/contracts/SECURITY-12/alias.','docs/brain/contracts/SECURITY-12/\uff58',
        '.github/security/rules.yml','.github/workflows/quality.yml','package.json','apps/mobile/package.json',
        'supabase/config.toml','docs/brain/state/manifest.json','docs/release/full-app-j01/precedence.v1.json',
        'scripts/release/full-app-j01/test_contract.py','scripts/phase4/build-source-worklist.mjs',
        'scripts/phase9/security_acceptance/proposal.json',
        'docs/brain/checkpoints/M1-03/SECURITY-SOURCE-11/manifest.json'):
        expect('unissued:'+path,lambda p=path:check.require(check.allowed12(p),'R12_SCOPE'))
    common=Path(check.git('rev-parse','--git-common-dir').decode().strip())
    if not common.is_absolute():common=(root/common).resolve()
    source_tree=check.git('write-tree').decode().strip()
    with tempfile.TemporaryDirectory(prefix='onskin-source12-') as temporary:
        fixture=Path(temporary).resolve()
        def git(*args,data=None):
            r=subprocess.run(['git','-c','core.autocrlf=false','-c','core.longpaths=true',*args],
                cwd=fixture,input=data,capture_output=True)
            if r.returncode:raise subprocess.CalledProcessError(r.returncode,args,r.stdout,r.stderr)
            return r.stdout
        git('init','--quiet')
        (fixture/'.git/objects/info/alternates').write_bytes(((common/'objects').as_posix()+'\n').encode())
        git('read-tree',source_tree)
        def put(path,data=b'bounded mutation\n',mode='100644'):
            blob=git('hash-object','-w','--stdin',data=data).decode().strip()
            git('update-index','--add','--cacheinfo',mode,blob,path)
        def commit(parent,*others):
            return git('-c','user.name=Release12 fixture','-c','user.email=fixture@example.invalid',
                'commit-tree',git('write-tree').decode().strip(),'-p',parent,
                *sum((['-p',x] for x in others),[]),data=b'bounded source12 control\n').decode().strip()
        def delta():
            check.validate12_diff(git('diff','--cached','--raw','--no-abbrev','--no-renames','-z',check.RELEASE12_BASE),lambda p:git('show',':'+p))
        authentic=commit(check.RELEASE12_BASE)
        git('update-ref','HEAD',authentic)
        try:
            check.ROOT=fixture
            expect('authentic-current-index',delta,0)
            expect('authentic-current-history',check.source12_history,0)
            for path in ('.github/workflows/quality.yml','package.json','apps/mobile/package.json',
                'docs/release/full-app-j01/precedence.v1.json','scripts/phase9/security_acceptance/proposal.json'):
                put(path);expect('protected:'+path,delta,code='R12_');git('read-tree',source_tree)
            for mode in ('100755','120000'):
                put('ONSKIN_BRAIN_HANDOFF.txt',mode=mode)
                expect('mode-or-symlink:'+mode,delta,code='R12_');git('read-tree',source_tree)
            git('update-index','--force-remove','ONSKIN_BRAIN_HANDOFF.txt')
            expect('removed-path',delta,code='R12_SCOPE');git('read-tree',source_tree)
            put('docs/brain/contracts/SECURITY-12/Case.md');put('docs/brain/contracts/SECURITY-12/case.md')
            expect('casefold-collision',delta,code='R12_COLLISION');git('read-tree',source_tree)
            expect('malformed-diff',lambda:check.validate12_diff(b'bad',lambda p:b''),code='R12_DIFF_SHAPE')
            put('.github/workflows/quality.yml');malicious=commit(authentic)
            git('update-ref','HEAD',malicious)
            expect('malicious-intermediate',check.source12_history,code='R12_SCOPE')
            git('read-tree',source_tree);restored=commit(malicious);git('update-ref','HEAD',restored)
            expect('hidden-malicious-intermediate',check.source12_history,code='R12_SCOPE')
            git('update-ref','HEAD',authentic)
            integration=commit(check.RELEASE12_BASE,authentic);git('update-ref','HEAD',integration)
            expect('ordinary-merge-refused',check.source12_history,code='R12_CI_')
            event=dict(number=check.RELEASE12_PR,repository=dict(full_name='TasfiqJ/onSkin'),
                pull_request=dict(number=check.RELEASE12_PR,
                    base=dict(sha=check.RELEASE12_BASE,ref='stage/m103-security-source-recovery11'),
                    head=dict(sha=authentic,ref='stage/m103-dependency-witness12',repo=dict(full_name='TasfiqJ/onSkin'))))
            event_path=fixture/'.git/event12.json'
            def write_event():event_path.write_bytes(json.dumps(event).encode())
            write_event()
            env=dict(GITHUB_EVENT_NAME='pull_request',GITHUB_REPOSITORY='TasfiqJ/onSkin',
                GITHUB_REF='refs/pull/'+str(check.RELEASE12_PR)+'/merge',GITHUB_SHA=integration,GITHUB_EVENT_PATH=str(event_path))
            with patch.dict(check.os.environ,env):
                expect('actual-allocated-PR-merge',check.source12_history,0)
                for key,value in (('GITHUB_EVENT_NAME','push'),('GITHUB_REF','refs/pull/15/merge'),
                    ('GITHUB_REPOSITORY','other/repo'),('GITHUB_SHA',authentic)):
                    with patch.dict(check.os.environ,{key:value}):
                        expect('wrong-context:'+key,check.source12_history,code='R12_CI_')
                for section,key,value in (('base','sha',check.RELEASE11_BASE),('base','ref','main'),
                    ('head','sha',check.RELEASE12_BASE),('head','ref','other')):
                    previous=event['pull_request'][section][key];event['pull_request'][section][key]=value;write_event()
                    expect('wrong-PR-base-head:'+section+':'+key,check.source12_history,code='R12_CI_')
                    event['pull_request'][section][key]=previous;write_event()
                event['number']=15;write_event()
                expect('wrong-PR-number',check.source12_history,code='R12_CI_');event['number']=check.RELEASE12_PR;write_event()
                put('ONSKIN_BRAIN_HANDOFF.txt');altered=commit(check.RELEASE12_BASE,authentic);git('update-ref','HEAD',altered)
                with patch.dict(check.os.environ,{'GITHUB_SHA':altered}):
                    expect('wrong-merge-tree',check.source12_history,code='R12_CI_MERGE_TREE')
            git('read-tree',source_tree);git('update-ref','HEAD',authentic)
            with patch.object(check,'RELEASE12_TREE','0'*40):
                expect('wrong-base-tree',check.source12_history,code='R12_BASE_TREE')
            foreign=commit(check.RELEASE11_BASE);git('update-ref','HEAD',foreign)
            expect('wrong-ancestry',check.source12_history)
            git('update-ref','HEAD',authentic);git('checkout-index','--all','--force')
            expect('complete-materialized-fixture-current',check.source12_guard,0)
            protected='.github/workflows/quality.yml';original=(fixture/protected).read_bytes()
            put(protected,original+b'\n# hidden staged\n')
            expect('staged-hidden-by-restored-worktree',check.source12_guard,code='R12_SCOPE');git('read-tree',source_tree)
            for flag,undo in (('--assume-unchanged','--no-assume-unchanged'),('--skip-worktree','--no-skip-worktree')):
                git('update-index',flag,protected)
                expect('index-flag:'+flag,check.source12_guard,code='R12_INDEX_FLAGS');git('update-index',undo,protected)
            path=fixture/'apps/mobile/src/forbidden12.ts';path.write_bytes(b'export const unsafe=true;\n')
            expect('untracked-runtime',check.source12_guard,code='R12_UNTRACKED_SCOPE');path.unlink()
            def cli(expected):
                result=subprocess.run([sys.executable,'-B',str(fixture/'scripts/release/full-app-j01/check.py')],cwd=fixture,capture_output=True)
                print(json.dumps(dict(case='full-fixture-CLI',exit=result.returncode,expected_exit=expected,stdout=result.stdout.decode())),flush=True)
                assert result.returncode==expected,result.stderr.decode()
            cli(0)
            lock=fixture/'package-lock.json';raw=lock.read_bytes();lock.write_bytes(raw+b' ')
            cli(1);lock.write_bytes(raw);cli(0)
            expect('authentic-restored',check.source12_guard,0)
        finally:
            check.ROOT=root
    print(json.dumps(dict(passed=True,rejected=rejected,pr=check.RELEASE12_PR,qualification='DISPOSABLE_GIT_AND_MATERIALIZED_FIXTURE; NOT_INDEPENDENT_COMPLETE_CHECKOUT',release='NO_GO')))


if __name__=='__main__':
    main()
