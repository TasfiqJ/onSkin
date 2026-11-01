"""Independent actual-Git/raw-byte36 controls; no fabricated hosted event execution."""
import hashlib
import importlib.util
import os
from pathlib import Path
import re
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('source36',Path(__file__).with_name('main_integration36.py'))
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class SourceControls(unittest.TestCase):
    def test_historical_python_in_original_scrubbed_environment_creates_no_cwd_cache(self):
        with tempfile.TemporaryDirectory(prefix='source36-python-') as directory:
            root=Path(directory).resolve()
            result=subprocess.run([m.historical_python(),'-I','-B','-c',
                'import json,sys;print(json.dumps(list(sys.version_info[:3])))'],
                cwd=root,env=m.primitives().clean_environment(),capture_output=True)
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertGreaterEqual(tuple(m.document(result.stdout)),(3,9,0))
            self.assertEqual(list(root.iterdir()),[],'Historical runtime contaminated its source cwd')

    def test_real_parent_phases_exact_plan_and_ten_path_grant(self):
        m.authenticate_parent()
        raw=(m.ROOT/m.PLAN).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(),m.PLAN_SHA)
        self.assertEqual(set(re.findall(r'^\d+\. `([^`]+)`$',raw.decode(),re.MULTILINE)),m.GRANT)
        self.assertEqual(len(m.GRANT),10)
        self.assertEqual(m.parents(m.PLAN_COMMIT),[m.PLAN_COMMIT,m.BASE])

    def test_real_parent_tree_ledger_plan_and_program_substitutions_refuse(self):
        actual=m.git
        for target,raw in [(('rev-parse',m.BASE+'^{tree}'),b'0'*40),
            (('show',m.C35_SOURCE+':docs/brain/task-specs/M1X-35/TASK.md'),b'{}'),
            (('show',m.PLAN_COMMIT+':'+m.PLAN),b'fake plan'),
            (('rev-list','--reverse',m.PINS[37][0]+'..'+m.BASE),m.BASE.encode())]:
            def read(*args):return raw if args==target else actual(*args)
            with self.subTest(target=target),patch.object(m,'git',side_effect=read),self.assertRaises(ValueError):
                m.authenticate_parent()
        m.authenticate_parent()

    def test_protected_originals_harness_policy_dependencies_and_all_other_parent_bytes_unchanged(self):
        # Diff all parent paths, not a handpicked success list. New files are checked separately.
        changed=m.primitives().delta(m.git('diff','--raw','--no-abbrev','--no-renames','-z',m.BASE),m.GRANT)
        self.assertLessEqual(changed,m.GRANT)
        names=[m.PREFIX+n for n in m.PROGRAMS]
        names += ['scripts/e2e/onboarding-first-session.mjs','scripts/e2e/onboarding-first-session35.test.mjs',
            'scripts/e2e/retained-safety-assertions.mjs','scripts/e2e/retained-safety-assertions.test.mjs',
            'scripts/launch/candidate-scope34.mjs','scripts/launch/candidate-scope34.test.mjs',
            'scripts/launch/consumer-entry34.test.mjs','scripts/phase4/build-source-worklist.mjs',
            '.github/workflows/security.yml','.github/workflows/security-candidate22.yml','package.json','package-lock.json']
        for name in names:
            with self.subTest(path=name):self.assertEqual((m.ROOT/name).read_bytes(),m.git('show',m.BASE+':'+name))

    def test_workflow_later_jobs_steps_permissions_and_failure_semantics_remain_exact(self):
        before=m.git('show',m.BASE+':.github/workflows/quality.yml')
        current=(m.ROOT/'.github/workflows/quality.yml').read_bytes()
        m.quality_guard(current,before)
        for bad in (current.replace(b'contents: read',b'contents: write'),
            current.replace(b'run: npm test',b'run: true'),
            current.replace(b'      - name: Typecheck',b'      - name: Typecheck\n        continue-on-error: true'),
            current.replace(b'postgres:15-alpine',b'postgres:17-alpine'),
            current.replace(b'python3 -I -B scripts/release/full-app-j01/main_integration36.py --historical',b'true')):
            self.assertNotEqual(bad,current)
            with self.assertRaisesRegex(ValueError,'R36_QUALITY_ONLY_FIRST_STEP'):m.quality_guard(bad,before)

    def test_fake_scope_document_and_changed_original34_program_refuse_without_touching_checkout(self):
        neutral=m.primitives()
        with tempfile.TemporaryDirectory(prefix='source36-bodies-') as directory:
            root=Path(directory).resolve()
            for name in m.PROGRAMS:
                target=root/m.PREFIX/name;target.parent.mkdir(parents=True,exist_ok=True)
                target.write_bytes((m.ROOT/m.PREFIX/name).read_bytes())
            program=root/m.PREFIX/'main_integration34.py'
            program.write_bytes(program.read_bytes()+b'\n# altered sealed verifier\n')
            with patch.object(m,'ROOT',root),patch.object(m,'primitives',return_value=neutral),self.assertRaisesRegex(ValueError,'R36_ORIGINAL_PROGRAM'):
                m.authenticate_parent()
            target=root/m.DOCS/'contract.v2.json';target.parent.mkdir(parents=True,exist_ok=True)
            target.write_bytes(b'{"acceptanceGranted":true,"release_status":"GO"}')
            with patch.object(m,'ROOT',root),patch.object(m,'primitives',return_value=neutral),self.assertRaisesRegex(ValueError,'R36_SCOPE_DOCUMENT'):
                m.scope()

    def test_current_path_never_dispatches_original_positive_admissions(self):
        import ast
        tree=ast.parse((m.ROOT/m.PREFIX/'main_integration36.py').read_bytes())
        functions={n.name:n for n in tree.body if isinstance(n,ast.FunctionDef)}
        for name in ('verify','authenticate_parent','scope','snapshot'):
            strings=[n.value for n in ast.walk(functions[name]) if isinstance(n,ast.Constant) and isinstance(n.value,str)]
            self.assertNotIn('candidate-scope34.mjs',strings)
            self.assertNotIn('--historical',strings)
        # The exact current entry point is exercised separately in full pre-seal preflight.
        self.assertNotIn('main_integration35.py\n',m.NEW_STEP)

    def test_actual_git_source_seal_and_postseal_extension_phases(self):
        with tempfile.TemporaryDirectory(prefix='source36-history-') as directory:
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
        with tempfile.TemporaryDirectory(prefix='source36-snapshot-') as directory:
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
                g('update-index','--chmod=+x','source.txt')
                with self.assertRaisesRegex(ValueError,'R36_INDEX'):m.snapshot(head)
                g('update-index','--chmod=-x','source.txt')
                for flag,restore in (('--assume-unchanged','--no-assume-unchanged'),('--skip-worktree','--no-skip-worktree')):
                    g('update-index',flag,'source.txt')
                    with self.assertRaisesRegex(ValueError,'R36_INDEX_FLAGS'):m.snapshot(head)
                    g('update-index',restore,'source.txt')
                link=root/'hardlink.txt';os.link(path,link)
                with self.assertRaisesRegex(ValueError,'R29_WORKING_REGULAR'):check.working29_guard(check.tree29(head))
                link.unlink();self.assertEqual(m.snapshot(head),original);self.assertEqual(path.read_bytes(),raw)

    def test_real_object_store_substitutions_refuse_in_disposable_git(self):
        check=m.primitives().helpers()
        with tempfile.TemporaryDirectory(prefix='source36-objects-') as directory:
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


if __name__ == '__main__':
    unittest.main()
