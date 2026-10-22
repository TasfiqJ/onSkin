"""Real filesystem/process negatives. Synthetic content never grants admission."""
import copy,io,json,os,pathlib,subprocess,sys,tempfile,unittest
from unittest import mock
import candidate as c
import source_scan as s
from integrity import MutationGuard,regular,tree


class IntegrityTests(unittest.TestCase):
    def test_bytecode_cache_and_launcher_inputs_are_not_ignored(self):
        with tempfile.TemporaryDirectory() as t:
            root=pathlib.Path(t);(root/'__pycache__').mkdir()
            (root/'example.py').write_text('value=1\n');cache=root/'__pycache__/example.cpython-312.pyc'
            cache.write_bytes(b'compiled-one');before=c.installed_tree(root)
            cache.write_bytes(b'compiled-two');self.assertNotEqual(before,c.installed_tree(root))
            cache.unlink();self.assertNotEqual(before,c.installed_tree(root))
            (root/'entry').write_text('entry');before=c.installed_tree(root)
            (root/'entry').chmod(0o700);self.assertNotEqual(before,c.installed_tree(root))

    @unittest.skipUnless(os.name=='posix','Linux links and inotify')
    def test_installed_links_hardlinks_fifo_and_transient_process_mutation_refuse(self):
        with tempfile.TemporaryDirectory() as t:
            root=pathlib.Path(t);p=root/'input';p.write_bytes(b'original')
            for kind in ['symlink','hardlink','fifo']:
                other=root/'other'
                if kind=='symlink':other.symlink_to(p)
                elif kind=='hardlink':os.link(p,other)
                else:os.mkfifo(other)
                with self.subTest(kind=kind),self.assertRaises(ValueError):c.installed_tree(root)
                other.unlink()
            with MutationGuard([root]) as guard:
                code="import pathlib,sys; p=pathlib.Path(sys.argv[1]); b=p.read_bytes();p.write_bytes(b'changed');p.write_bytes(b)"
                subprocess.run([sys.executable,'-I','-B','-c',code,str(p)],check=True)
                self.assertEqual(p.read_bytes(),b'original')
                with self.assertRaisesRegex(ValueError,'MUTATION'):guard.check()

    def fixture(self,root,code='value=1\n'):
        repo=root/'repo';repo.mkdir()
        def git(*args):return subprocess.check_output(['git','-C',str(repo),'-c','gc.auto=0','-c','maintenance.auto=false',*args],stderr=subprocess.PIPE)
        git('init','-q');(repo/'code.py').write_text(code);(repo/'benign.py').write_text('value=int(input())\n');git('add','.')
        git('-c','user.name=Synthetic','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','-qm','synthetic')
        head=git('rev-parse','HEAD').decode().strip()
        return repo,s.snapshot(repo,head,root/'snapshot')

    @unittest.skipUnless(os.name=='posix','Linux link/rename/mutation regressions')
    def test_export_modification_rename_links_and_added_paths_refuse(self):
        for kind in ['write','rename','symlink','hardlink','directory-link','addition','restored-write']:
            with self.subTest(kind=kind),tempfile.TemporaryDirectory() as t:
                root=pathlib.Path(t);repo,inventory=self.fixture(root);p=root/'snapshot/code.py'
                s.validate_inventory(inventory,repo);raw=p.read_bytes()
                if kind=='write':p.write_bytes(b'value=2\n')
                if kind=='rename':p.rename(root/'saved');p.write_bytes(raw)
                if kind=='symlink':p.unlink();p.symlink_to(repo/'code.py')
                if kind=='hardlink':p.unlink();os.link(repo/'code.py',p)
                if kind=='directory-link':(p.parent/'directory').symlink_to(repo,target_is_directory=True)
                if kind=='addition':(p.parent/'new.py').write_text('new\n')
                if kind=='restored-write':p.write_bytes(b'drift');p.write_bytes(raw)
                with self.assertRaises((ValueError,OSError)):s.validate_inventory(inventory,repo)

    @unittest.skipUnless(os.environ.get('ONSKIN_TEST_CANDIDATE'),'Requires actual private candidate; set ONSKIN_TEST_CANDIDATE')
    def test_real_capsule_readonly_source_tool_and_network_and_post_scan_rewrite(self):
        candidate=pathlib.Path(os.environ['ONSKIN_TEST_CANDIDATE']);tool=c.verify(candidate)
        with tempfile.TemporaryDirectory() as t:
            root=pathlib.Path(t);repo,inventory=self.fixture(root);(root/'rules').mkdir();rule=root/'rules/rule.yaml';rule.write_text('synthetic inert\n')
            path=pathlib.Path(inventory['materialized_root'])/'code.py'
            code="""import errno,pathlib,socket,sys
for name in sys.argv[1:]:
    try:pathlib.Path(name).write_bytes(b'drift')
    except OSError as e:assert e.errno in (errno.EROFS,errno.EACCES,errno.EPERM),e
    else:raise AssertionError('mutable scan input')
for family in (socket.AF_INET,socket.AF_INET6):
    try:socket.socket(family,socket.SOCK_STREAM)
    except PermissionError:pass
    else:raise AssertionError('network socket accepted')
print('IMMUTABLE_AND_NETWORK_DENIED')
"""
            command=[str(candidate/'venv/bin/python'),'-I','-B','-c',code,str(path),str(candidate/'venv/pyvenv.cfg')]
            with (root/'out').open('wb') as out,(root/'err').open('wb') as err:
                exit=s.sealed_run(candidate,tool,inventory,repo,root,rule,c.SHA(rule.read_bytes()),command,out,err,120)
            self.assertEqual(exit,0,(root/'err').read_text()[-1800:]);self.assertIn('IMMUTABLE',(root/'out').read_text())
            # A rewrite after engine completion is always rejected by the final
            # host rehash (no fake scanner result can turn it into coverage).
            import source_scan
            original=source_scan.verify
            calls=0
            def final_rewrite(*args,**kwargs):
                nonlocal calls
                calls+=1
                if calls==2:path.write_bytes(b'changed-after-child\n')
                return original(*args,**kwargs)
            with mock.patch.object(source_scan,'verify',side_effect=final_rewrite), (root/'out2').open('wb') as out,(root/'err2').open('wb') as err:
                with self.assertRaisesRegex(ValueError,'MUTATION'):
                    s.sealed_run(candidate,tool,inventory,repo,root,rule,c.SHA(rule.read_bytes()),command,out,err,120)

    @unittest.skipUnless(os.environ.get('ONSKIN_TEST_CANDIDATE'),'Requires actual private candidate')
    def test_actual_official_core_positive_and_benign_in_capsule(self):
        candidate=pathlib.Path(os.environ['ONSKIN_TEST_CANDIDATE']);tool=c.verify(candidate)
        with tempfile.TemporaryDirectory() as t:
            root=pathlib.Path(t);repo,inventory=self.fixture(root,'value=eval(input())\n');(root/'rules').mkdir();rule=root/'rules/eval.yaml'
            rule.write_text('rules:\n- id: synthetic-eval\n  languages: [python]\n  severity: ERROR\n  message: synthetic\n  pattern: eval(...)\n')
            command=[str(candidate/'venv/bin/python'),'-I','-B',str(candidate/'venv/bin/semgrep'),'scan','--oss-only','--metrics=off','--disable-version-check','--config',str(rule),'--json','--no-git-ignore','.']
            with (root/'out').open('wb') as out,(root/'err').open('wb') as err:
                exit=s.sealed_run(candidate,tool,inventory,repo,root,rule,c.SHA(rule.read_bytes()),command,out,err,120)
            self.assertEqual(exit,0,(root/'err').read_text()[:4000]);result=json.loads((root/'out').read_bytes())
            self.assertEqual(result['errors'],[]);self.assertEqual(len(result['results']),1)
            self.assertTrue(result['results'][0]['path'].endswith('code.py'))

    @unittest.skipUnless(os.environ.get('ONSKIN_TEST_CANDIDATE'),'Requires actual private candidate')
    def test_host_change_and_restore_while_child_executes_refuses(self):
        import signal
        candidate=pathlib.Path(os.environ['ONSKIN_TEST_CANDIDATE']);tool=c.verify(candidate)
        with tempfile.TemporaryDirectory() as t:
            root=pathlib.Path(t);repo,inventory=self.fixture(root);(root/'rules').mkdir();rule=root/'rules/inert.yaml';rule.write_text('inert\n')
            path=pathlib.Path(inventory['materialized_root'])/'code.py';raw=path.read_bytes()
            command=[str(candidate/'venv/bin/python'),'-I','-B','-c',"import signal; print('READY',flush=True); signal.pause()"]
            original=subprocess.Popen
            def child(*args,**kwargs):
                if args[0][0]!='/usr/bin/bwrap':return original(*args,**kwargs)
                process=original(*args,**kwargs);wait=process.wait;changed=False
                def synchronized_wait(*a,**kw):
                    nonlocal changed
                    if not changed:
                        changed=True;self.assertEqual(process.stdout.readline().strip(),b'READY')
                        path.write_bytes(b'drift');path.write_bytes(raw)
                        os.killpg(process.pid,signal.SIGTERM)
                    return wait(*a,**kw)
                process.wait=synchronized_wait
                return process
            with mock.patch.object(s.subprocess,'Popen',side_effect=child),(root/'err').open('wb') as err:
                with self.assertRaisesRegex(ValueError,'EXPORTED_RENAME_OR_REWRITE|MUTATION'):
                    s.sealed_run(candidate,tool,inventory,repo,root,rule,c.SHA(rule.read_bytes()),command,subprocess.PIPE,err,120)


if __name__=='__main__':unittest.main()
