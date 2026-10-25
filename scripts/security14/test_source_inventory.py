"""Synthetic adversarial inventory tests; no original manifest is changed."""
import gzip
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
import source_inventory as inv

class InventoryTests(unittest.TestCase):
    def test_manifest_and_coverage_reject_replacement_duplicate_offroot_and_omission(self):
        good=[dict(path='src/a.py',sha256='a'*64)]
        raw=inv.canonical(good)
        self.assertEqual(inv.manifest_rows(raw,inv.sha(raw)), {'src/a.py':'a'*64})
        with self.assertRaises(ValueError): inv.manifest_rows(raw,'0'*64)
        for value in [good+good, [dict(path='../escape',sha256='a'*64)],
                      [dict(path='/absolute',sha256='a'*64)],
                      [good[0],dict(path='src/Ａ.py',sha256='a'*64),dict(path='src/a.PY',sha256='b'*64)]]:
            body=inv.canonical(value)
            with self.assertRaises(ValueError): inv.manifest_rows(body,inv.sha(body))
        for body in [b'[{"path":"x","path":"y","sha256":"'+b'a'*64+b'"}]', raw[:-1], b'NaN']:
            with self.assertRaises((ValueError,TypeError)): inv.manifest_rows(body,inv.sha(body))
        data=dict(schema=1,targets=[dict(path='src/a.py',kind='required',reason='source-text-or-generic-input')],exclusions=[],explicitTargets=[])
        body=gzip.compress(inv.canonical(data),mtime=0)
        self.assertEqual(set(inv.coverage_rows(body,inv.sha(body),{'src/a.py'})), {'src/a.py'})
        for mutate in [lambda d:d['targets'].append(d['targets'][0]),lambda d:d['targets'].clear(),
                       lambda d:d['targets'][0].update(path='../escape'),lambda d:d['targets'][0].update(kind='excluded',reason='all-docs')]:
            d=json.loads(json.dumps(data)); mutate(d); b=gzip.compress(inv.canonical(d),mtime=0)
            with self.assertRaises(ValueError): inv.coverage_rows(b,inv.sha(b),{'src/a.py'})
        with self.assertRaises((ValueError,EOFError,OSError)): inv.coverage_rows(body[:-5],inv.sha(body[:-5]),{'src/a.py'})

    def test_real_git_modes_renames_and_bounded_nul(self):
        with tempfile.TemporaryDirectory(prefix='security14-inventory-') as tmp:
            root=Path(tmp)
            def git(*args,data=None):
                return subprocess.check_output(['git',*args],cwd=root,input=data,stderr=subprocess.PIPE)
            git('init','--quiet')
            oid=git('hash-object','-w','--stdin',data=b'original\n').decode().strip()
            git('update-index','--add','--cacheinfo','100644',oid,'src/old.py')
            tree=git('write-tree').decode().strip()
            commit=git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit-tree',tree,data=b'fixture\n').decode().strip()
            old=inv.snapshot(root,commit)
            self.assertEqual(old['src/old.py']['sha256'],inv.sha(b'original\n'))
            now={'src/new.py':dict(old['src/old.py']), 'src/mode.py':dict(old['src/old.py'],mode='100755')}
            before=dict(old,**{'src/mode.py':old['src/old.py']})
            changes,renames=inv.reconcile({n:r['sha256'] for n,r in before.items()},before,now,{})
            self.assertEqual({r['status'] for r in changes},{'added','removed','changed'})
            self.assertTrue(next(r for r in changes if r['path']=='src/mode.py')['mode_changed'])
            self.assertEqual(len(renames),1)
            for body in [b'x', b'100644 blob '+oid.encode()+b'\t../escape\0',
                         b'120000 blob '+oid.encode()+b'\tsrc/link\0',
                         (b'100644 blob '+oid.encode()+b'\tsrc/A\0')+(b'100644 blob '+oid.encode()+b'\tsrc/a\0')]:
                with self.assertRaises((ValueError,UnicodeError)): inv.tree_entries(body)
            with self.assertRaises(ValueError): inv.git(root,'ls-files','-z',limit=1)
            with self.assertRaises(ValueError): inv.git(root,'not-a-command')
            f=root/'regular';f.write_bytes(b'safe')
            self.assertEqual(inv.regular(f),b'safe')
            with self.assertRaises(ValueError):inv.regular(f,limit=2)
            # Git's symlink mode is tested on every host, including Windows.
            git('update-index','--add','--cacheinfo','120000',oid,'src/link')
            with self.assertRaises(ValueError):inv.tree_entries(git('ls-files','--stage','-z'))

if __name__=='__main__':
    unittest.main()
