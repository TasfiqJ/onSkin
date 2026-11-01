"""Independent real Git/raw-source and real Chrome DOM controls; no synthetic CI execution."""
import ast, hashlib, importlib.util, json, os, re, subprocess, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('source37',Path(__file__).with_name('main_integration37.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class SourceControls(unittest.TestCase):
    def test_real_parent_plan_and_all_22_baseline_identities(self):
        m.authenticate_parent()
        raw=(m.ROOT/m.PLAN).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(),m.PLAN_SHA)
        self.assertEqual(set(re.findall(r'^\d+\. `([^`]+)`$',raw.decode(),re.MULTILINE)),m.GRANT)
        self.assertEqual((len(m.GRANT),len(m.SOURCE)),(22,11))
        self.assertEqual(m.parents(m.PLAN_COMMIT),[m.PLAN_COMMIT,m.BASE])

    def test_whole_parent_delta_and_all_conditional_app_paths_remain_unchanged(self):
        m.primitives().delta(m.git('diff','--raw','--no-abbrev','--no-renames','-z',m.BASE),m.SOURCE|m.WORKLIST|{m.PLAN})
        self.assertEqual(m.git('diff','--raw',m.BASE,'--','apps/mobile','package.json','package-lock.json',
            'scripts/e2e/retained-safety-assertions.mjs','scripts/e2e/retained-safety-assertions.test.mjs'),b'')
        for name,sha in m.PROGRAMS.items():
            self.assertEqual(m.digest((m.ROOT/m.PREFIX/name).read_bytes()),sha)

    def test_workflow_only_first_governance_step_and_no_weakened_later_jobs(self):
        before=m.git('show',m.BASE+':.github/workflows/quality.yml')
        current=(m.ROOT/'.github/workflows/quality.yml').read_bytes();m.quality_guard(current,before)
        for bad in (current.replace(b'contents: read',b'contents: write'),current.replace(b'run: npm test',b'run: true'),
            current.replace(b'      - name: Typecheck',b'      - name: Typecheck\n        continue-on-error: true'),
            current.replace(b'postgres:15-alpine',b'postgres:17-alpine'),
            current.replace(b'main_integration37.py --historical',b'main_integration37.py --scope full-app-j01-v2')):
            self.assertNotEqual(current,bad)
            with self.assertRaisesRegex(ValueError,'R37_QUALITY_ONLY_FIRST_STEP'):m.quality_guard(bad,before)

    def test_exact_parent_plan_program_and_baseline_substitutions_refuse(self):
        actual=m.git
        for target,raw in [(('rev-parse',m.BASE+'^{tree}'),b'0'*40),
            (('show',m.PLAN_COMMIT+':'+m.PLAN),b'fake plan'),
            (('rev-list','--reverse',m.PINS[38][0]+'..'+m.BASE),m.BASE.encode())]:
            def read(*args):return raw if args==target else actual(*args)
            with self.subTest(target=target),patch.object(m,'git',side_effect=read),self.assertRaises(ValueError):m.authenticate_parent()
        with patch.object(m,'BASELINES',m.BASELINES[:-1]),self.assertRaises(ValueError):m.authenticate_parent()

    def test_real_chrome_selector_occlusion_scroll_and_touch_controls(self):
        # Invoke the exported production driver expressions in independent real
        # Chrome documents. No source-string-only simulation of DOM hit testing.
        result=subprocess.run(['node','--test','scripts/e2e/compact-shelf-target37.test.mjs'],cwd=m.ROOT,capture_output=True,timeout=120)
        self.assertEqual(result.returncode,0,result.stdout.decode(errors='replace')+result.stderr.decode(errors='replace'))
        m.test_summary(result.stdout,16,16,0)

    def test_current_source_entrypoints_never_execute_old_current_approvals(self):
        functions={n.name:n for n in ast.parse((m.ROOT/m.PREFIX/'main_integration37.py').read_bytes()).body if isinstance(n,ast.FunctionDef)}
        for name in ('verify','authenticate_parent','scope','snapshot'):
            calls=[n for n in ast.walk(functions[name]) if isinstance(n,ast.Call)]
            self.assertFalse(any(isinstance(c.func,ast.Attribute) and c.func.attr in ('verify','historical') for c in calls))
        source=(m.ROOT/'scripts/e2e/onboarding-first-session.mjs').read_text()
        self.assertNotIn("clickByText(client, 'Mineral SPF 50'",source)
        self.assertNotIn("scrollTextIntoView(client, 'Mineral SPF 50'",source)
        start=source.index('export async function tapOwnedShelfProduct37(')
        stop=source.index('async function observeFirstSession35(',start)
        self.assertNotRegex(source[start:stop],r'router\.push|\.click\(|Page\.navigate')

    def test_changed_original36_reader_and_hardlink_refuse_with_exact_restoration(self):
        with tempfile.TemporaryDirectory(prefix='source37-reader-') as directory:
            root=Path(directory).resolve();target=root/m.PREFIX/'main_integration36.py';target.parent.mkdir(parents=True)
            raw=(m.ROOT/m.PREFIX/'main_integration36.py').read_bytes();target.write_bytes(raw+b'\n# forged reader\n')
            with patch.object(m,'ROOT',root),self.assertRaisesRegex(ValueError,'R37_ORIGINAL36_IDENTITY'):m.original36_reader()
            target.write_bytes(raw)
            with patch.object(m,'ROOT',root):self.assertTrue(callable(m.original36_reader().historical_result))
            link=root/'link.py';os.link(target,link)
            with patch.object(m,'ROOT',root),self.assertRaisesRegex(ValueError,'R37_REGULAR_FILE'):m.original36_reader()
            link.unlink();self.assertEqual(target.read_bytes(),raw)

    def test_historical_python_in_original_scrubbed_environment_creates_no_cwd_cache(self):
            with tempfile.TemporaryDirectory(prefix='source37-python-') as directory:
                root=Path(directory).resolve()
                result=subprocess.run([m.historical_python(),'-I','-B','-c',
                    'import json,sys;print(json.dumps(list(sys.version_info[:3])))'],
                    cwd=root,env=m.primitives().clean_environment(),capture_output=True)
                self.assertEqual(result.returncode,0,result.stderr)
                self.assertGreaterEqual(tuple(m.document(result.stdout)),(3,9,0))
                self.assertEqual(list(root.iterdir()),[],'Historical runtime contaminated its source cwd')

    def test_actual_git_source_seal_and_postseal_extension_phases(self):
            with tempfile.TemporaryDirectory(prefix='source37-history-') as directory:
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
            with tempfile.TemporaryDirectory(prefix='source37-snapshot-') as directory:
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
                    with self.assertRaisesRegex(ValueError,'R37_INDEX'):m.snapshot(head)
                    g('update-index','--chmod=-x','source.txt')
                    for flag,restore in (('--assume-unchanged','--no-assume-unchanged'),('--skip-worktree','--no-skip-worktree')):
                        g('update-index',flag,'source.txt')
                        with self.assertRaisesRegex(ValueError,'R37_INDEX_FLAGS'):m.snapshot(head)
                        g('update-index',restore,'source.txt')
                    link=root/'hardlink.txt';os.link(path,link)
                    with self.assertRaisesRegex(ValueError,'R29_WORKING_REGULAR'):check.working29_guard(check.tree29(head))
                    link.unlink();self.assertEqual(m.snapshot(head),original);self.assertEqual(path.read_bytes(),raw)

    def test_real_object_store_substitutions_refuse_in_disposable_git(self):
            check=m.primitives().helpers()
            with tempfile.TemporaryDirectory(prefix='source37-objects-') as directory:
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


if __name__=='__main__':unittest.main()
