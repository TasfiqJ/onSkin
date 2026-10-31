"""Independent actual-Git and disposable-byte35 controls; no clinical or owner acceptance."""
import hashlib
import importlib.util
import os
from pathlib import Path
import re
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('integration35',Path(__file__).with_name('main_integration35.py'))
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class SourceControls(unittest.TestCase):
    def test_actual_parent_plan_and_exact_twenty_three_path_grant(self):
        m.authenticate_parent()
        plan=(m.ROOT/m.PLAN).read_bytes()
        self.assertEqual(m.digest(plan),m.PLAN_SHA)
        granted=set(re.findall(r'^\| `([^`]+)` \|',plan.decode(),re.MULTILINE))
        self.assertEqual(granted,m.GRANT)
        self.assertEqual(len(granted),23)
        self.assertEqual(len(m.REQUIRED_SOURCE),10)
        self.assertEqual(m.digest((m.ROOT/m.PREFIX/'main_integration34.py').read_bytes()),m.PARENT_SHA)

    def test_actual_parent_tree_history_plan_substitutions_refuse_and_restore(self):
        original=m.git
        for target,forged in [(('rev-parse',m.BASE+'^{tree}'),b'0'*40),
            (('show',m.PLAN_COMMIT+':'+m.PLAN),b'substituted plan'),
            (('rev-list','--reverse',m.parent().BASE+'..'+m.BASE),m.BASE.encode())]:
            def port(*args):
                return forged if args==target else original(*args)
            with self.subTest(command=target),patch.object(m,'git',side_effect=port),self.assertRaises(ValueError):
                m.authenticate_parent()
        m.authenticate_parent()

    def test_actual_original34_current35_history_refuses_its_interior_worklist_seal(self):
        # This invokes the authentic pinned34 phase logic on real local Git objects.
        # It does not fabricate a GitHub event or claim a hosted-CI execution.
        p=m.parent()
        commits=m.text('rev-list','--reverse',p.BASE+'..HEAD').splitlines()
        self.assertEqual(commits[0],p.PLAN_COMMIT)
        self.assertIn(m.BASE,commits[1:-1])
        with self.assertRaisesRegex(ValueError,'^R32_FINITE_SCOPE$'):
            p.phase_guard(commits)

    def test_actual_quality_all_bytes_outside_first_step_are_protected(self):
        before=m.git('show',m.BASE+':.github/workflows/quality.yml')
        actual=(m.ROOT/'.github/workflows/quality.yml').read_bytes()
        m.quality_guard(actual,before)
        for forged in [actual.replace(b'contents: read',b'contents: write'),
            actual.replace(b'run: npm test',b'run: true'),
            actual.replace(b'python3 -I -B scripts/release/full-app-j01/main_integration35.py --historical',b'true'),
            actual.replace(b'      - name: Typecheck',b'      - name: Typecheck\n        continue-on-error: true'),
            actual.replace(b'persist-credentials: false',b'persist-credentials: true')]:
            with self.assertRaisesRegex(ValueError,'R35_QUALITY_ONLY_FIRST_GOVERNANCE_STEP'):
                m.quality_guard(forged,before)

    def test_original_checkers_contracts_security_dependencies_and_producer_unchanged(self):
        paths=[m.PREFIX+x for x in ['check.py','main_integration32.py','main_integration32.test.py',
            'source_consumer32.test.py','main_integration33.py','main_integration33.test.py','source_consumer33.test.py',
            'main_integration34.py','main_integration34.test.py','source_consumer34.test.py']]
        paths += [m.DOCS+x for x in ['contract.v1.json','contract.v2.json','matrix.v1.json','matrix.v2.json',
            'precedence.v2.json','roadmap.v2.json','owner-ledger33.v1.json']]
        paths += ['scripts/launch/candidate-scope34.mjs','scripts/launch/candidate-scope34.test.mjs',
            'scripts/launch/consumer-entry34.test.mjs','scripts/launch/full-app-contract33.mjs',
            'scripts/launch/check-contract.mjs','scripts/brain/brain.py','scripts/brain/test_brain.py',
            'apps/mobile/app.config.js','.github/workflows/security.yml','.github/workflows/security-candidate22.yml',
            'package.json','package-lock.json','scripts/phase4/build-source-worklist.mjs',
            'docs/hugeToDo/launch-contract.json']
        for name in paths:
            with self.subTest(path=name):
                self.assertEqual((m.ROOT/name).read_bytes(),m.git('show',m.BASE+':'+name))

    def test_git_substitution_environment_and_replace_refs_refused(self):
        with patch.dict(os.environ,{'GIT_REPLACE_REF_BASE':'refs/synthetic'}),self.assertRaisesRegex(ValueError,'R23_GIT_ENV'):
            m.git('rev-parse','HEAD')
        check=m.old().helpers()
        namespace=check.full29_store.__globals__
        original=namespace['git23']
        def port(*args):
            if args==('for-each-ref','--format=%(refname)','refs/replace'):
                return b'refs/replace/'+b'0'*40+b'\n'
            return original(*args)
        with patch.dict(namespace,{'git23':port}),self.assertRaisesRegex(ValueError,'R29_HISTORY_SUBSTITUTION'):
            check.full29_store()

    def test_disposable_raw_bytes_hardlink_and_exact_restoration(self):
        check=m.old().helpers()
        namespace=check.working29_guard.__globals__
        with tempfile.TemporaryDirectory(prefix='source35-reader-') as directory:
            root=Path(directory).resolve()
            path=root/'source.txt'
            raw=b'synthetic source; acceptanceGranted=false\n'
            path.write_bytes(raw)
            oid=hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
            index={'source.txt':('100644',oid)}
            with patch.dict(namespace,{'ROOT':root}):
                self.assertEqual(check.working29_guard(index),1)
                path.write_bytes(raw.replace(b'false',b'true '))
                with self.assertRaisesRegex(ValueError,'R29_WORKING_BLOB'):
                    check.working29_guard(index)
                path.write_bytes(raw)
                self.assertEqual(check.working29_guard(index),1)
                link=root/'hardlink.txt'
                os.link(path,link)
                with self.assertRaisesRegex(ValueError,'R29_WORKING_REGULAR'):
                    check.working29_guard(index)
                link.unlink()
                self.assertEqual(check.working29_guard(index),1)
                self.assertEqual(path.read_bytes(),raw)


if __name__ == '__main__':
    unittest.main()

