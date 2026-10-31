"""Independent real-object and disposable raw-byte controls; no owner admission."""
import hashlib
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('integration34',Path(__file__).with_name('main_integration34.py'))
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class SourceControls(unittest.TestCase):
    def test_actual_pr36_plan_and_exact_twenty_two_path_grant(self):
        m.authenticate_parent()
        plan=(m.ROOT/m.PLAN).read_bytes()
        self.assertEqual(m.digest(plan),m.PLAN_SHA)
        granted={line.split('`')[1] for line in plan.decode().splitlines() if line[:1].isdigit() and '. `' in line}
        self.assertEqual(granted,m.GRANT)
        self.assertEqual(len(granted),22)
        self.assertEqual(len(m.SOURCE),13)

    def test_parent_tree_history_and_plan_substitutions_refuse_then_restore(self):
        original=m.git
        for target,forged in [(('rev-parse',m.BASE+'^{tree}'),b'0'*40),
            (('show',m.PLAN_COMMIT+':'+m.PLAN),b'substituted plan'),
            (('rev-list','--reverse',m.parent().BASE+'..'+m.BASE),m.BASE.encode())]:
            def port(*args):
                return forged if args==target else original(*args)
            with self.subTest(command=target), patch.object(m,'git',side_effect=port), self.assertRaises(ValueError):
                m.authenticate_parent()
        m.authenticate_parent()

    def test_only_first_quality_governance_step_changes(self):
        before=m.git('show',m.BASE+':.github/workflows/quality.yml')
        actual=(m.ROOT/'.github/workflows/quality.yml').read_bytes()
        m.quality_guard(actual,before)
        for forged in [actual.replace(b'contents: read',b'contents: write'),
            actual.replace(b'run: npm test',b'run: true'),
            actual.replace(b'node scripts/launch/candidate-scope34.mjs --mode verification',b'true'),
            actual.replace(b'      - name: Typecheck',b'      - name: Typecheck\n        continue-on-error: true'),
            actual.replace(b'persist-credentials: false',b'persist-credentials: true')]:
            with self.assertRaisesRegex(ValueError,'R34_QUALITY_ONLY_FIRST_GOVERNANCE_STEP'):
                m.quality_guard(forged,before)

    def test_protected_history_source_and_unused_consumers_unchanged(self):
        paths=[m.DOCS+x for x in ['contract.v1.json','contract.v2.json','matrix.v1.json','matrix.v2.json',
            'precedence.v2.json','history-crosswalk.v1.json','owner-ledger33.v1.json','roadmap.v2.json']]
        paths += [m.PREFIX+x for x in ['check.py','main_integration32.py','main_integration32.test.py',
            'source_consumer32.test.py','main_integration33.py','main_integration33.test.py','source_consumer33.test.py']]
        paths += ['scripts/launch/full-app-contract33.mjs','scripts/launch/full-app-contract33.test.mjs',
            'scripts/launch/check-contract.mjs','scripts/launch/governed-evidence-chain.mjs',
            'scripts/launch/governed-evidence-chain.test.mjs','scripts/launch/contract-smoke.mjs',
            'scripts/launch/build-execution-baseline.mjs','scripts/launch/validate-execution-baseline.mjs',
            'scripts/brain/brain.py','scripts/brain/test_brain.py','apps/mobile/app.config.js',
            '.github/workflows/security.yml','.github/workflows/security-candidate22.yml',
            'docs/hugeToDo/launch-contract.json','docs/hugeToDo/execution-status.json',
            'docs/hugeToDo/task-graph.json','package.json','package-lock.json',
            'scripts/phase4/build-source-worklist.mjs']
        for name in paths:
            with self.subTest(path=name):
                self.assertEqual(m.digest((m.ROOT/name).read_bytes()),m.digest(m.git('show',m.BASE+':'+name)))

    def test_git_substitution_environment_and_replace_refs_refused(self):
        with patch.dict(os.environ,{'GIT_REPLACE_REF_BASE':'refs/synthetic'}), self.assertRaisesRegex(ValueError,'R23_GIT_ENV'):
            m.git('rev-parse','HEAD')
        check=m.parent().parent().helpers()
        namespace=check.full29_store.__globals__
        original=namespace['git23']
        def port(*args):
            if args==('for-each-ref','--format=%(refname)','refs/replace'):
                return b'refs/replace/'+b'0'*40+b'\n'
            return original(*args)
        with patch.dict(namespace,{'git23':port}), self.assertRaisesRegex(ValueError,'R29_HISTORY_SUBSTITUTION'):
            check.full29_store()

    def test_actual_disposable_bytes_hardlink_and_exact_restoration(self):
        check=m.parent().parent().helpers()
        namespace=check.working29_guard.__globals__
        with tempfile.TemporaryDirectory(prefix='source34-reader-') as directory:
            root=Path(directory).resolve()
            path=root/'matrix.v2.json'
            raw=b'{"complete":false}\n'
            path.write_bytes(raw)
            oid=hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
            index={'matrix.v2.json':('100644',oid)}
            with patch.dict(namespace,{'ROOT':root}):
                self.assertEqual(check.working29_guard(index),1)
                path.write_bytes(raw.replace(b'false',b'true '))
                with self.assertRaisesRegex(ValueError,'R29_WORKING_BLOB'):
                    check.working29_guard(index)
                path.write_bytes(raw)
                self.assertEqual(check.working29_guard(index),1)
                link=root/'hardlink.json'
                os.link(path,link)
                with self.assertRaisesRegex(ValueError,'R29_WORKING_REGULAR'):
                    check.working29_guard(index)
                link.unlink()
                self.assertEqual(check.working29_guard(index),1)
                self.assertEqual(path.read_bytes(),raw)


if __name__ == '__main__':
    unittest.main()
