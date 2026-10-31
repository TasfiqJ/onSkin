"""Real pinned-object and disposable reader controls; no owner acceptance."""
import hashlib
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('integration33',Path(__file__).with_name('main_integration33.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)


class SourceControls(unittest.TestCase):
    def test_actual_parent_plan_and_finite_scope(self):
        m.authenticate_parent()
        plan=(m.ROOT/m.PLAN).read_bytes()
        self.assertEqual(m.digest(plan),m.PLAN_SHA)
        granted={line.split('`')[1] for line in plan.decode().splitlines() if line[:1].isdigit() and '. `' in line}
        self.assertEqual(len(granted),33)
        self.assertTrue(m.SOURCE|m.WORKLIST|{m.PLAN} <= granted)

    def test_pinned_parent_tree_and_plan_substitution_refused_then_restored(self):
        original=m.git
        for target,forged in [(('rev-parse',m.BASE+'^{tree}'),b'0'*40),
            (('show',m.PLAN_COMMIT+':'+m.PLAN),b'substituted plan')]:
            def port(*args):return forged if args==target else original(*args)
            with self.subTest(command=target),patch.object(m,'git',side_effect=port),self.assertRaises(ValueError):
                m.authenticate_parent()
        m.authenticate_parent()

    def test_only_first_quality_step_can_change(self):
        before=m.git('show',m.BASE+':.github/workflows/quality.yml')
        actual=(m.ROOT/'.github/workflows/quality.yml').read_bytes()
        m.quality_guard(actual,before)
        for forged in [actual.replace(b'contents: read',b'contents: write'),
            actual.replace(b'run: npm test',b'run: true'),
            actual.replace(b'node scripts/launch/check-contract.mjs --scope full-app-j01-v2',b'true'),
            actual.replace(b'      - name: Typecheck',b'      - name: Typecheck\n        continue-on-error: true')]:
            with self.assertRaisesRegex(ValueError,'R33_QUALITY_ONLY_FIRST_GOVERNANCE_STEP'):m.quality_guard(forged,before)

    def test_original_validators_and_security_workflows_unchanged(self):
        paths=[m.DOCS+x for x in ['contract.v1.json','matrix.v1.json','roadmap.v1.json','precedence.v1.json','history-crosswalk.v1.json']]
        paths += [m.PREFIX+x for x in ['check.py','main_integration32.py','main_integration32.test.py','source_consumer32.test.py']]
        paths += ['.github/workflows/security.yml','.github/workflows/security-candidate22.yml',
                  'docs/hugeToDo/launch-contract.json','scripts/launch/contract.mjs','apps/mobile/app.config.js']
        for name in paths:
            with self.subTest(path=name):self.assertEqual(m.digest((m.ROOT/name).read_bytes()),m.digest(m.git('show',m.BASE+':'+name)))

    def test_git_substitution_environment_refusal(self):
        with patch.dict(os.environ,{'GIT_REPLACE_REF_BASE':'refs/synthetic'}),self.assertRaisesRegex(ValueError,'R23_GIT_ENV'):
            m.git('rev-parse','HEAD')

    def test_real_disposable_byte_tamper_hardlink_and_restoration(self):
        check=m.parent().helpers();ns=check.working29_guard.__globals__
        with tempfile.TemporaryDirectory(prefix='source33-reader-') as directory:
            root=Path(directory).resolve();path=root/'matrix.v2.json';raw=b'{"complete":false}\n';path.write_bytes(raw)
            oid=hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
            index={'matrix.v2.json':('100644',oid)}
            with patch.dict(ns,{'ROOT':root}):
                self.assertEqual(check.working29_guard(index),1)
                path.write_bytes(raw.replace(b'false',b'true '))
                with self.assertRaisesRegex(ValueError,'R29_WORKING_BLOB'):check.working29_guard(index)
                path.write_bytes(raw);self.assertEqual(check.working29_guard(index),1)
                link=root/'hardlink.json';os.link(path,link)
                with self.assertRaisesRegex(ValueError,'R29_WORKING_REGULAR'):check.working29_guard(index)
                link.unlink();self.assertEqual(check.working29_guard(index),1)


if __name__ == '__main__':
    unittest.main()
