"""Independent real Git/raw-source controls. Tampering occurs only in disposable fixtures."""
import ast, hashlib, importlib.util, json, os, re, subprocess, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('source39',Path(__file__).with_name('main_integration39.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class SourceControls(unittest.TestCase):
    def test_real_parent_plan_and_all_12_baseline_identities(self):
        m.authenticate_parent()
        raw=(m.ROOT/m.PLAN).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(),m.PLAN_SHA)
        self.assertEqual({r['path'] for r in m.plan_baselines(raw)},m.GRANT)
        self.assertEqual((len(m.GRANT),len(m.SOURCE)),(12,9))
        self.assertEqual(m.parents(m.PLAN_COMMIT),[m.PLAN_COMMIT,m.BASE])

    def test_whole_parent_delta_and_all_protected_paths_remain_unchanged(self):
        m.primitives().delta(m.git('diff','--raw','--no-abbrev','--no-renames','-z',m.BASE),m.SOURCE|m.WORKLIST|{m.PLAN})
        self.assertEqual(m.git('diff','--raw',m.BASE,'--','package.json','package-lock.json','supabase',
            'scripts/brain','scripts/launch/contract.mjs','scripts/launch/candidate-scope34.mjs',
            'scripts/launch/execution-baseline.mjs','scripts/launch/build-execution-baseline.mjs',
            'scripts/launch/validate-execution-baseline.mjs','scripts/launch/execution-baseline-smoke.mjs',
            'docs/hugeToDo/launch-contract.json','docs/hugeToDo/execution-status.json',
            'docs/hugeToDo/task-graph.json','docs/hugeToDo/credential-inventory.json',
            'docs/hugeToDo/evidence-governance.json','docs/hugeToDo/worktree-boundary.json',
            'apps/mobile','apps/operator',
            'scripts/phase4/build-source-worklist.mjs','scripts/e2e/retained-safety-assertions.mjs',
            'scripts/e2e/retained-safety-assertions.test.mjs','apps/mobile/src/app/(tabs)/shelf.tsx',
            '.github/workflows/security.yml','.github/workflows/security-candidate22.yml',
            '.github/workflows/ios-launch-contract.yml'),b'')
        for name,sha in m.PROGRAMS.items():
            self.assertEqual(m.digest((m.ROOT/m.PREFIX/name).read_bytes()),sha)

    def test_workflow_only_first_governance_step_and_no_weakened_later_jobs(self):
        before=m.git('show',m.BASE+':.github/workflows/quality.yml')
        current=(m.ROOT/'.github/workflows/quality.yml').read_bytes();m.quality_guard(current,before)
        for bad in (current.replace(b'contents: read',b'contents: write'),current.replace(b'run: npm test',b'run: true'),
            current.replace(b'      - name: Typecheck',b'      - name: Typecheck\n        continue-on-error: true'),
            current.replace(b'postgres:15-alpine',b'postgres:17-alpine'),
            current.replace(b'main_integration39.py --historical',b'main_integration38.py --historical')):
            self.assertNotEqual(current,bad)
            with self.assertRaisesRegex(ValueError,'R39_QUALITY_ONLY_FIRST_STEP'):m.quality_guard(bad,before)

    def test_exact_parent_plan_program_and_baseline_substitutions_refuse(self):
        actual=m.git
        for target,raw in [(('rev-parse',m.BASE+'^{tree}'),b'0'*40),
            (('show',m.PLAN_COMMIT+':'+m.PLAN),b'fake plan'),
            (('rev-list','--reverse',m.PINS[40][0]+'..'+m.BASE),m.BASE.encode())]:
            def read(*args):return raw if args==target else actual(*args)
            with self.subTest(target=target),patch.object(m,'git',side_effect=read),self.assertRaises(ValueError):m.authenticate_parent()
        with patch.object(m,'BASELINES',m.BASELINES[:-1]),self.assertRaises(ValueError):m.authenticate_parent()


    def test_current_source_entrypoints_never_execute_old_current_approvals(self):
        functions={n.name:n for n in ast.parse((m.ROOT/m.PREFIX/'main_integration39.py').read_bytes()).body if isinstance(n,ast.FunctionDef)}
        for name in ('verify','authenticate_parent','scope','snapshot'):
            calls=[n for n in ast.walk(functions[name]) if isinstance(n,ast.Call)]
            self.assertFalse(any(isinstance(c.func,ast.Attribute) and c.func.attr in ('verify','historical') for c in calls))


    def test_historical_python_in_original_scrubbed_environment_creates_no_cwd_cache(self):
            with tempfile.TemporaryDirectory(prefix='source39-python-') as directory:
                root=Path(directory).resolve()
                result=subprocess.run([m.historical_python(),'-I','-B','-c',
                    'import json,sys;print(json.dumps(list(sys.version_info[:3])))'],
                    cwd=root,env=m.primitives().clean_environment(),capture_output=True)
                self.assertEqual(result.returncode,0,result.stderr)
                self.assertGreaterEqual(tuple(m.document(result.stdout)),(3,9,0))
                self.assertEqual(list(root.iterdir()),[],'Historical runtime contaminated its source cwd')

    def test_original38_reader_tamper_and_hardlink_refuse_then_exact_restore(self):
        with tempfile.TemporaryDirectory(prefix='source39-reader-') as directory:
            root=Path(directory).resolve();target=root/m.PREFIX/'main_integration38.py';target.parent.mkdir(parents=True)
            raw=(m.ROOT/m.PREFIX/'main_integration38.py').read_bytes()
            target.write_bytes(raw+b'\n# forged historic reader\n')
            with patch.object(m,'ROOT',root),self.assertRaisesRegex(ValueError,'R39_ORIGINAL38_IDENTITY'):
                m.original38_reader()
            target.write_bytes(raw)
            with patch.object(m,'ROOT',root):self.assertTrue(callable(m.original38_reader().historical_result))
            link=root/'link.py';os.link(target,link)
            with patch.object(m,'ROOT',root),self.assertRaisesRegex(ValueError,'R39_REGULAR_FILE'):
                m.original38_reader()
            link.unlink();self.assertEqual(target.read_bytes(),raw)

    def test_actual_git_source_seal_and_postseal_extension_phases(self):
            with tempfile.TemporaryDirectory(prefix='source39-history-') as directory:
                root=Path(directory).resolve()
                def g(*args):return subprocess.check_output(['git','--no-replace-objects','-c','core.hooksPath=',*args],cwd=root,stderr=subprocess.PIPE)
                g('init','--quiet');g('config','user.name','Synthetic source control');g('config','user.email','fixture@example.invalid')
                def commit(files):
                    for path,body in files.items():(root/path).write_bytes(body)
                    g('add','--',*files);g('commit','--quiet','-m','Synthetic fixture only')
                    return g('rev-parse','HEAD').decode().strip()
                base=commit({'base.txt':b'base\n'})
                plan=commit({'plan.md':b'plan\n'})
                source=commit({'a.txt':b'source\n','b.txt':b'source\n'})
                seal=commit({'w.json':b'{}\n','w.md':b'seal\n'})
                extended=commit({'a.txt':b'post-seal mutation\n'})
                with patch.object(m,'git',side_effect=g),patch.object(m,'BASE',base),patch.object(m,'PLAN_COMMIT',plan),\
                     patch.object(m,'PLAN','plan.md'),patch.object(m,'SOURCE',{'a.txt','b.txt'}),patch.object(m,'WORKLIST',{'w.json','w.md'}):
                    self.assertEqual(m.phase_guard([plan,source],'SOURCE_PENDING'),(source,None))
                    self.assertEqual(m.phase_guard([plan,source,seal],'SOURCE_FROZEN'),(source,seal))
                    for history,phase in [([plan,source,seal],'SOURCE_PENDING'),([plan,source],'SOURCE_FROZEN'),
                        ([plan,source,seal,extended],'SOURCE_FROZEN'),([plan,source,source],'SOURCE_PENDING'),
                        ([source,seal],'SOURCE_FROZEN')]:
                        with self.subTest(phase=phase,history=history),self.assertRaises(ValueError):m.phase_guard(history,phase)

    def test_actual_git_index_modes_flags_raw_tamper_and_exact_restoration(self):
            check=m.primitives().helpers()
            with tempfile.TemporaryDirectory(prefix='source39-snapshot-') as directory:
                root=Path(directory).resolve()
                def g(*args):return subprocess.check_output(['git','--no-replace-objects','-c','core.hooksPath=',*args],cwd=root,stderr=subprocess.PIPE)
                g('init','--quiet');g('config','user.name','Synthetic source control');g('config','user.email','fixture@example.invalid');g('config','core.autocrlf','false')
                path=root/'source.txt';raw=b'synthetic source; acceptanceGranted=false\n';path.write_bytes(raw)
                g('add','source.txt');g('commit','--quiet','-m','Synthetic fixture only');head=g('rev-parse','HEAD').decode().strip()
                with patch.object(m,'git',side_effect=g),patch.dict(check.working29_guard.__globals__,{'ROOT':root}):
                    original=m.snapshot(head);self.assertEqual(original[1],1)
                    path.write_bytes(raw.replace(b'false',b'true '))
                    with self.assertRaises(ValueError):m.snapshot(head)
                    with self.assertRaisesRegex(ValueError,'R29_WORKING_BLOB'):check.working29_guard(check.tree29(head))
                    path.write_bytes(raw);self.assertEqual(m.snapshot(head),original)
                    path.write_bytes(raw+b'dirty staged content\n');g('add','--','source.txt')
                    with self.assertRaisesRegex(ValueError,'R39_INDEX'):m.snapshot(head)
                    path.write_bytes(raw);g('add','--','source.txt');self.assertEqual(m.snapshot(head),original)
                    g('update-index','--chmod=+x','source.txt')
                    with self.assertRaisesRegex(ValueError,'R39_INDEX'):m.snapshot(head)
                    g('update-index','--chmod=-x','source.txt')
                    for flag,restore in (('--assume-unchanged','--no-assume-unchanged'),('--skip-worktree','--no-skip-worktree')):
                        g('update-index',flag,'source.txt')
                        with self.assertRaisesRegex(ValueError,'R39_INDEX_FLAGS'):m.snapshot(head)
                        g('update-index',restore,'source.txt')
                    link=root/'hardlink.txt';os.link(path,link)
                    with self.assertRaisesRegex(ValueError,'R29_WORKING_REGULAR'):check.working29_guard(check.tree29(head))
                    link.unlink();self.assertEqual(m.snapshot(head),original);self.assertEqual(path.read_bytes(),raw)

    def test_real_object_store_substitutions_refuse_in_disposable_git(self):
            check=m.primitives().helpers()
            with tempfile.TemporaryDirectory(prefix='source39-objects-') as directory:
                root=Path(directory).resolve()
                def g(*args):return subprocess.check_output(['git','--no-replace-objects','-c','core.hooksPath=',*args],cwd=root,stderr=subprocess.PIPE)
                g('init','--quiet');g('config','user.name','Synthetic source control');g('config','user.email','fixture@example.invalid')
                (root/'source.txt').write_bytes(b'synthetic\n');g('add','source.txt');g('commit','--quiet','-m','Synthetic fixture only')
                head=g('rev-parse','HEAD').decode().strip()
                with patch.dict(check.full29_store.__globals__,{'ROOT':root}):
                    check.full29_store()
                    for name,reason in [('objects/info/alternates','R29_ALTERNATES'),('info/grafts','R29_HISTORY_SUBSTITUTION')]:
                        path=root/'.git'/name;path.write_bytes(b'')
                        with self.assertRaisesRegex(ValueError,reason):check.full29_store()
                        path.unlink()
                    g('replace',head,head)
                    with self.assertRaisesRegex(ValueError,'R29_HISTORY_SUBSTITUTION'):check.full29_store()
                    g('replace','-d',head)
                    (root/'.git/shallow').write_text(head+'\n',encoding='ascii')
                    with self.assertRaisesRegex(ValueError,'R29_FULL_HISTORY'):check.full29_store()
                    (root/'.git/shallow').unlink();check.full29_store()




    def test_inherited_scope_references_are_frozen_to_pr41_without_renewal(self):
        projection=m.scope()
        self.assertFalse(projection['assessmentRenewed'])
        self.assertFalse(projection['externalReady'])
        self.assertEqual((projection['requiredRows'],len(projection['unadmittedGates'])),(38,18))
        for row in projection['changedHistoricalReferences']:
            self.assertNotEqual(row['assessedSHA256'],row['currentSHA256'])
        original=m.regular
        def changed(path,*args):
            raw=original(path,*args)
            return raw+b' changed' if str(path).replace('\\','/').endswith('features/shelf/store.ts') else raw
        with patch.object(m,'regular',side_effect=changed),self.assertRaises(ValueError):m.scope()

    def test_protected_original_programs_and_docs_refuse_actual_tamper_with_exact_restore(self):
        # Read original bytes from real source, then exercise actual Git identities in an
        # isolated tiny repository. No protected source file is ever opened for write.
        protected=['scripts/launch/build-execution-baseline.mjs',
            'scripts/launch/validate-execution-baseline.mjs','scripts/launch/contract.mjs',
            'docs/hugeToDo/launch-contract.json','docs/hugeToDo/execution-status.json',
            'docs/hugeToDo/task-graph.json','docs/hugeToDo/credential-inventory.json',
            'docs/hugeToDo/evidence-governance.json','docs/hugeToDo/worktree-boundary.json',
            m.PREFIX+'main_integration38.py',m.PREFIX+'main_integration37.py',
            '.github/workflows/security.yml','.github/workflows/security-candidate22.yml',
            '.github/workflows/ios-launch-contract.yml']
        original={p:(m.ROOT/p).read_bytes() for p in protected}
        with tempfile.TemporaryDirectory(prefix='source39-protected-') as directory:
            root=Path(directory).resolve()
            def g(*args):return subprocess.check_output(['git','--no-replace-objects','-c','core.hooksPath=',*args],cwd=root,stderr=subprocess.PIPE)
            g('init','--quiet');g('config','user.name','Synthetic integrity fixture');g('config','user.email','fixture@example.invalid');g('config','core.autocrlf','false')
            for name,raw in original.items():
                path=root/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw)
            g('add','--',*protected);g('commit','--quiet','-m','Synthetic protected baseline')
            base=g('rev-parse','HEAD').decode().strip()
            for name,raw in original.items():
                path=root/name
                path.write_bytes(raw+b'\n# forged source or admission\n')
                g('add','--',name);g('commit','--quiet','-m','Synthetic hostile protected mutation')
                changed=g('rev-parse','HEAD').decode().strip()
                with patch.object(m,'git',side_effect=g),self.subTest(path=name),self.assertRaises(ValueError):
                    m.changed(base,changed,m.GRANT)
                path.write_bytes(raw)
                g('add','--',name);g('commit','--quiet','-m','Exact synthetic restoration')
                self.assertEqual(path.read_bytes(),raw)
                self.assertEqual(g('diff','--raw',base),b'')
            self.assertEqual(g('status','--porcelain=v1','--untracked-files=all'),b'')

    def test_current39_does_not_relabel_old38_refusal_as_current_success(self):
        result=subprocess.run([m.historical_python(),'-I','-B',m.PREFIX+'main_integration38.py'],
            cwd=m.ROOT,env=m.primitives().clean_environment(),capture_output=True,timeout=180)
        self.assertEqual(result.returncode,1,result.stdout+result.stderr)
        value=m.document(result.stdout)
        self.assertFalse(value['valid'])
        self.assertTrue(value['error'].startswith('R38_'))
        self.assertFalse(value['acceptanceGranted'])
        self.assertEqual(value['release'],'NO_GO')


if __name__=='__main__':unittest.main()
