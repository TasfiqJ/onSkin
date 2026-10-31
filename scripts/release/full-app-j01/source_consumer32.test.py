"""Independent source/history substitution controls on real authenticated objects.

Only the named Git port result is injected; repository files/refs are not mutated.
The actual complete source guard runs separately, without these injections.
"""
import importlib.util
from pathlib import Path
from unittest.mock import patch
import unittest

spec = importlib.util.spec_from_file_location('integration32', Path(__file__).with_name('main_integration32.py'))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)


class SourceControls(unittest.TestCase):
    def test_actual_pinned_chain_and_historical_helper(self):
        m.authenticate_chain()
        self.assertEqual(m.digest((m.ROOT/m.PREFIX/'check.py').read_bytes()), m.CHECKER_SHA)

    def test_integrated_parent_tree_and_history_substitutions(self):
        original = m.git
        controls = [
            (('rev-parse',m.BASE+'^{tree}'),b'0'*40),
            (('rev-list','--reverse',m.PR33+'..'+m.BASE), (m.CHAIN[2]+'\n').encode()),
            (('rev-list','--parents','-n','1',m.CHAIN[2]), (m.CHAIN[2]+' '+'0'*40).encode()),
            (('show',m.PLAN_COMMIT+':'+m.PLAN), b'substituted plan'),
        ]
        for target, forged in controls:
            def port(*args):
                return forged if args == target else original(*args)
            with self.subTest(command=target), patch.object(m,'git',side_effect=port), self.assertRaises(ValueError):
                m.authenticate_chain()

    def test_real_git_replacement_and_environment_refusals(self):
        check = m.helpers(); namespace = check.full29_store.__globals__; original = namespace['git23']
        def port(*args):
            if args == ('for-each-ref','--format=%(refname)','refs/replace'):
                return b'refs/replace/'+b'0'*40+b'\n'
            return original(*args)
        with patch.dict(namespace,{'git23':port}), self.assertRaisesRegex(ValueError,'R29_HISTORY_SUBSTITUTION'):
            check.full29_store()
        with patch.dict(m.os.environ,{'GIT_REPLACE_REF_BASE':'refs/synthetic'}), self.assertRaisesRegex(ValueError,'R23_GIT_ENV'):
            m.git('rev-parse','HEAD')

    def test_unchanged_working_byte_guard_rejects_a_changed_byte(self):
        import tempfile
        with tempfile.TemporaryDirectory(prefix='source32-control-') as directory:
            root=Path(directory).resolve();path=root/'synthetic.txt';path.write_bytes(b'original')
            check=m.helpers();ns=check.working29_guard.__globals__
            oid=m.hashlib.sha1(b'blob 8\0original').hexdigest();index={'synthetic.txt':('100644',oid)}
            with patch.dict(ns,{'ROOT':root}):
                self.assertEqual(check.working29_guard(index),1)
                path.write_bytes(b'mutated!')
                with self.assertRaisesRegex(ValueError,'R29_WORKING_BLOB'): check.working29_guard(index)


if __name__ == '__main__':
    unittest.main()
