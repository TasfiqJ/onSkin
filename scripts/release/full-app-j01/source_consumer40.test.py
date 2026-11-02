"""Real Git/index/raw-byte negatives in disposable repositories; no original checker patching."""
import ast, hashlib, importlib.util, os, subprocess, tempfile, unittest
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('source40',Path(__file__).with_name('main_integration40.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)


@contextmanager
def repository(prefix):
    """Instantiate byte-identical neutral helpers with their real fixture paths."""
    originals={name:m.regular(m.ROOT/m.PREFIX/name) for name in ('main_integration32.py','check.py')}
    with tempfile.TemporaryDirectory(prefix=prefix) as directory:
        root=Path(directory).resolve()
        def git(*args):
            return subprocess.check_output(['git','--no-replace-objects','-c','core.hooksPath=',*args],
                                           cwd=root,stderr=subprocess.PIPE)
        git('init','--quiet');git('config','user.name','Synthetic Campaign40 source fixture')
        git('config','user.email','fixture@example.invalid');git('config','core.autocrlf','false')
        for name,raw in originals.items():
            path=root/m.PREFIX/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw)
            if m.digest(raw)!=m.PROGRAMS[name]:raise ValueError('Fixture neutral helper identity mismatch')
        git('add','--',*[m.PREFIX+name for name in originals])
        git('commit','--quiet','-m','Synthetic byte-authenticated neutral helpers only')
        with patch.object(m,'ROOT',root),patch.object(m,'H',None):
            yield root,git


class SourceControls(unittest.TestCase):
    def test_real_parent_plan_and_all_twelve_preimages(self):
        m.authenticate_parent()
        raw=(m.ROOT/m.PLAN).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(),m.PLAN_SHA)
        self.assertEqual({row['path'] for row in m.plan_baselines(raw)},m.GRANT)
        self.assertEqual((len(m.GRANT),len(m.SOURCE)),(12,9))
        self.assertEqual(m.parents(m.PLAN_COMMIT),[m.PLAN_COMMIT,m.BASE])

    def test_whole_parent_diff_is_finite_and_every_original_program_is_pinned(self):
        m.primitives().delta(m.git('diff','--raw','--no-abbrev','--no-renames','-z',m.BASE),m.GRANT)
        for name,sha in m.PROGRAMS.items():
            self.assertEqual(m.digest(m.regular(m.ROOT/m.PREFIX/name)),sha)
        paths=('package.json','package-lock.json','supabase/migrations','scripts/launch',
               'scripts/brain','apps/mobile','apps/operator','scripts/phase4/build-source-worklist.mjs',
               'docs/hugeToDo/launch-contract.json','docs/hugeToDo/feature-inventory.json',
               'docs/hugeToDo/execution-status.json','docs/hugeToDo/task-graph.json',
               'docs/hugeToDo/credential-inventory.json','docs/hugeToDo/evidence-governance.json',
               'docs/hugeToDo/worktree-boundary.json','.github/workflows/security.yml',
               '.github/workflows/security-candidate22.yml','.github/workflows/ios-launch-contract.yml')
        self.assertEqual(m.git('diff','--raw',m.BASE,'--',*paths),b'')
        self.assertEqual(m.git('show',m.BASE+':'+m.SQL),m.git('show',m.PINS[41][0]+':'+m.SQL))

    def test_quality_only_first_step_no_database_exports_or_other_step_mutations(self):
        before=m.git('show',m.BASE+':.github/workflows/quality.yml')
        current=(m.ROOT/'.github/workflows/quality.yml').read_bytes()
        m.quality_guard(current,before)
        for bad in (current.replace(b'contents: read',b'contents: write'),
                    current.replace(b'run: npm test',b'run: true'),
                    current.replace(b'      - name: Typecheck',b'      - name: Typecheck\n        continue-on-error: true'),
                    current.replace(b'postgres:15-alpine',b'postgres:17-alpine'),
                    current.replace(b'main_integration40.py --historical',b'main_integration39.py --historical'),
                    current.replace(b'npm run phase2:db-local-verify',b'true')):
            self.assertNotEqual(current,bad)
            with self.assertRaisesRegex(ValueError,'R40_QUALITY_ONLY_FIRST_STEP'):m.quality_guard(bad,before)

    def test_parent_tree_plan_history_and_baseline_substitutions_refuse(self):
        actual=m.git
        for target,raw in [(('rev-parse',m.BASE+'^{tree}'),b'0'*40),
                           (('show',m.PLAN_COMMIT+':'+m.PLAN),b'fake plan'),
                           (('rev-list','--reverse',m.PINS[41][0]+'..'+m.BASE),m.BASE.encode())]:
            def read(*args):return raw if args==target else actual(*args)
            with self.subTest(target=target),patch.object(m,'git',side_effect=read),self.assertRaises(ValueError):
                m.authenticate_parent()
        with patch.object(m,'BASELINES',m.BASELINES[:-1]),self.assertRaises(ValueError):m.authenticate_parent()

    def test_current_source_functions_never_dispatch_historical_current_approvals(self):
        functions={node.name:node for node in ast.parse((m.ROOT/m.PREFIX/'main_integration40.py').read_bytes()).body
                   if isinstance(node,ast.FunctionDef)}
        for name in ('verify','authenticate_parent','scope','snapshot'):
            calls=[node for node in ast.walk(functions[name]) if isinstance(node,ast.Call)]
            self.assertFalse(any(isinstance(call.func,ast.Attribute) and call.func.attr in ('verify','historical')
                                 for call in calls))
            self.assertFalse(any(isinstance(node,ast.Constant) and node.value==m.PREFIX+'main_integration39.py'
                                 for node in ast.walk(functions[name])))
        self.assertIn('fresh exact named PR42',m.historical.__doc__)

    def test_normal_historical_python_in_original_scrub_creates_no_source_cache(self):
        with tempfile.TemporaryDirectory(prefix='source40-python-') as directory:
            root=Path(directory).resolve()
            result=subprocess.run([m.historical_python(),'-I','-B','-c',
                'import json,sys;print(json.dumps(list(sys.version_info[:3])))'],
                cwd=root,env=m.primitives().clean_environment(),capture_output=True)
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertGreaterEqual(tuple(m.document(result.stdout)),(3,9,0))
            self.assertEqual(list(root.iterdir()),[])

    def test_original39_neutral_transcript_reader_identity_and_hardlink_refusals(self):
        raw=(m.ROOT/m.PREFIX/'main_integration39.py').read_bytes()
        with tempfile.TemporaryDirectory(prefix='source40-reader-') as directory:
            root=Path(directory).resolve();target=root/m.PREFIX/'main_integration39.py'
            target.parent.mkdir(parents=True);target.write_bytes(raw+b'\n# forged historical parser\n')
            with patch.object(m,'ROOT',root),self.assertRaisesRegex(ValueError,'R40_ORIGINAL39_IDENTITY'):
                m.original39_reader()
            target.write_bytes(raw)
            with patch.object(m,'ROOT',root):self.assertTrue(callable(m.original39_reader().historical_result))
            link=root/'hardlink.py';os.link(target,link)
            with patch.object(m,'ROOT',root),self.assertRaisesRegex(ValueError,'R40_REGULAR_FILE'):
                m.original39_reader()
            link.unlink();self.assertEqual(target.read_bytes(),raw)

    def test_actual_git_source_then_exact_sole_seal_and_postseal_refusal(self):
        with repository('source40-history-') as (root,git):
            def commit(files):
                for path,body in files.items():(root/path).write_bytes(body)
                git('add','--',*files);git('commit','--quiet','-m','Synthetic history fixture')
                return git('rev-parse','HEAD').decode().strip()
            base=commit({'base.txt':b'base\n'});plan=commit({'plan.md':b'plan\n'})
            source=commit({'a.txt':b'source\n','b.txt':b'source\n'})
            seal=commit({'w.json':b'{}\n','w.md':b'seal\n'})
            extended=commit({'a.txt':b'post-seal mutation\n'})
            with patch.object(m,'BASE',base),patch.object(m,'PLAN_COMMIT',plan),patch.object(m,'PLAN','plan.md'),\
                 patch.object(m,'SOURCE',{'a.txt','b.txt'}),patch.object(m,'WORKLIST',{'w.json','w.md'}):
                self.assertEqual(m.phase_guard([plan,source],'SOURCE_PENDING'),(source,None))
                self.assertEqual(m.phase_guard([plan,source,seal],'SOURCE_FROZEN'),(source,seal))
                for history,phase in [([plan,source,seal],'SOURCE_PENDING'),([plan,source],'SOURCE_FROZEN'),
                    ([plan,source,seal,extended],'SOURCE_FROZEN'),([plan,source,source],'SOURCE_PENDING'),
                    ([source,seal],'SOURCE_FROZEN')]:
                    with self.subTest(phase=phase,history=history),self.assertRaises(ValueError):
                        m.phase_guard(history,phase)

    def test_actual_index_modes_flags_bytes_links_and_exact_restore(self):
        with repository('source40-snapshot-') as (root,git):
            path=root/'source.txt';raw=b'synthetic source; acceptanceGranted=false\n';path.write_bytes(raw)
            git('add','--','source.txt');git('commit','--quiet','-m','Synthetic source body')
            head=git('rev-parse','HEAD').decode().strip();original=m.snapshot(head)
            self.assertEqual(original[1],3)
            path.write_bytes(raw.replace(b'false',b'true '))
            with self.assertRaises(ValueError):m.snapshot(head)
            path.write_bytes(raw);self.assertEqual(m.snapshot(head),original)
            path.write_bytes(raw+b'dirty staged content\n');git('add','--','source.txt')
            with self.assertRaisesRegex(ValueError,'R40_INDEX'):m.snapshot(head)
            path.write_bytes(raw);git('add','--','source.txt');self.assertEqual(m.snapshot(head),original)
            git('update-index','--chmod=+x','source.txt')
            with self.assertRaisesRegex(ValueError,'R40_INDEX'):m.snapshot(head)
            git('update-index','--chmod=-x','source.txt')
            for flag,restore in (('--assume-unchanged','--no-assume-unchanged'),('--skip-worktree','--no-skip-worktree')):
                git('update-index',flag,'source.txt')
                with self.assertRaisesRegex(ValueError,'R40_INDEX_FLAGS'):m.snapshot(head)
                git('update-index',restore,'source.txt')
            link=root/'hardlink.txt';os.link(path,link)
            with self.assertRaisesRegex(ValueError,'R29_WORKING_REGULAR'):
                m.primitives().helpers().working29_guard(m.primitives().helpers().tree29(head))
            link.unlink();self.assertEqual(m.snapshot(head),original);self.assertEqual(path.read_bytes(),raw)

    def test_actual_full_object_store_rejects_alternates_grafts_replaces_and_shallow(self):
        with repository('source40-objects-') as (root,git):
            check=m.primitives().helpers();check.full29_store()
            head=git('rev-parse','HEAD').decode().strip()
            for name,reason in (('objects/info/alternates','R29_ALTERNATES'),('info/grafts','R29_HISTORY_SUBSTITUTION')):
                path=root/'.git'/name;path.write_bytes(b'')
                with self.assertRaisesRegex(ValueError,reason):check.full29_store()
                path.unlink()
            git('replace',head,head)
            with self.assertRaisesRegex(ValueError,'R29_HISTORY_SUBSTITUTION'):check.full29_store()
            git('replace','-d',head)
            (root/'.git/shallow').write_text(head+'\n',encoding='ascii')
            with self.assertRaisesRegex(ValueError,'R29_FULL_HISTORY'):check.full29_store()
            (root/'.git/shallow').unlink();check.full29_store()

    def test_scope_keeps_all_thirtyeight_obligations_and_eighteen_gates_unaccepted(self):
        projection=m.scope()
        self.assertFalse(projection['assessmentRenewed']);self.assertFalse(projection['externalReady'])
        self.assertEqual((projection['requiredRows'],len(projection['unadmittedGates'])),(38,18))
        for row in projection['changedHistoricalReferences']:
            self.assertNotEqual(row['assessedSHA256'],row['currentSHA256'])
        original=m.regular
        def read(path,*args):
            raw=original(path,*args)
            return raw+b'forged' if str(path).replace('\\','/').endswith('features/shelf/store.ts') else raw
        with patch.object(m,'regular',side_effect=read),self.assertRaises(ValueError):m.scope()

    def test_protected_sources_fail_finite_diff_in_disposable_actual_git(self):
        paths=('scripts/launch/build-execution-baseline.mjs','scripts/launch/validate-execution-baseline.mjs',
               'scripts/launch/contract.mjs','docs/hugeToDo/launch-contract.json',
               'docs/hugeToDo/execution-status.json','docs/hugeToDo/task-graph.json',
               'docs/hugeToDo/credential-inventory.json','docs/hugeToDo/evidence-governance.json',
               'docs/hugeToDo/worktree-boundary.json',m.PREFIX+'main_integration39.py',
               m.PREFIX+'main_integration38.py','.github/workflows/security.yml',
               '.github/workflows/security-candidate22.yml','.github/workflows/ios-launch-contract.yml')
        originals={name:m.regular(m.ROOT/name) for name in paths}
        with repository('source40-protected-') as (root,git):
            for name,raw in originals.items():
                path=root/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw)
            git('add','--',*paths);git('commit','--quiet','-m','Synthetic protected preimages')
            base=git('rev-parse','HEAD').decode().strip()
            for name,raw in originals.items():
                path=root/name;path.write_bytes(raw+b'\n# fabricated approval or source\n')
                git('add','--',name);git('commit','--quiet','-m','Synthetic forbidden mutation')
                changed=git('rev-parse','HEAD').decode().strip()
                with self.subTest(path=name),self.assertRaises(ValueError):m.changed(base,changed,m.GRANT)
                path.write_bytes(raw);git('add','--',name);git('commit','--quiet','-m','Exact synthetic restoration')
                self.assertEqual(path.read_bytes(),raw);self.assertEqual(git('diff','--raw',base),b'')
            self.assertEqual(git('status','--porcelain=v1','--untracked-files=all'),b'')


if __name__=='__main__':unittest.main()
