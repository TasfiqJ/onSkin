"""Actual Git, raw-byte, finite-grant and historical-reader negatives; disposable fixtures only."""
import ast
import hashlib
import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from contextlib import contextmanager
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('source44', Path(__file__).with_name('main_integration44.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


@contextmanager
def repository(prefix):
    originals = {name: m.regular(m.ROOT/m.PREFIX/name) for name in ('main_integration32.py', 'check.py')}
    with tempfile.TemporaryDirectory(prefix=prefix) as directory:
        root = Path(directory).resolve()
        def git(*args):
            return subprocess.check_output(['git', '--no-replace-objects', '-c', 'core.hooksPath=', *args],
                                           cwd=root, stderr=subprocess.PIPE)
        git('init', '--quiet')
        git('config', 'user.name', 'Synthetic Campaign44 source fixture')
        git('config', 'user.email', 'fixture@example.invalid')
        git('config', 'core.autocrlf', 'false')
        for name, raw in originals.items():
            path = root/m.PREFIX/name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
            if m.digest(raw) != m.PROGRAMS[name]:
                raise ValueError('Fixture neutral helper identity mismatch')
        git('add', '--', *[m.PREFIX+name for name in originals])
        git('commit', '--quiet', '-m', 'Synthetic authenticated neutral helpers only')
        with patch.object(m, 'ROOT', root), patch.object(m, 'H', None), patch.object(m, 'O41', None):
            yield root, git


class SourceControls(unittest.TestCase):
    def test_exact_parent_immutable_plan_and_all_thirtysix_preimages(self):
        m.authenticate_parent()
        self.assertEqual(hashlib.sha256((m.ROOT/m.PLAN).read_bytes()).hexdigest(), m.PLAN_SHA)
        self.assertEqual(set(m.BASELINES), m.GRANT)
        self.assertEqual((len(m.GRANT), len(m.SOURCE)), (36, 33))
        self.assertEqual(m.parents(m.PLAN_COMMIT), [m.PLAN_COMMIT, m.BASE])

    def test_current_diff_finite_and_all_protected_bytes_and_programs_unchanged(self):
        m.primitives().delta(m.git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', m.BASE), m.GRANT)
        untracked = {p.decode() for p in m.git('ls-files', '--others', '--exclude-standard', '-z').split(b'\0') if p}
        self.assertLessEqual(untracked, m.GRANT)
        for name, sha in m.PROGRAMS.items():
            self.assertEqual(m.digest(m.regular(m.ROOT/m.PREFIX/name)), sha)
        paths = ('package.json', 'package-lock.json', 'supabase', 'scripts/launch', 'scripts/brain',
                 'apps/mobile/src/lib/auth/localAccountIsolation.ts',
                 'apps/mobile/src/lib/auth/accountGeneration.ts',
                 'apps/mobile/src/lib/consent/healthDataWriteAdmission.ts',
                 'apps/mobile/src/lib/consent/healthProcessingEpoch.ts',
                 'apps/mobile/src/features/settings/localPrivateDataKeys.ts',
                 'apps/mobile/src/features/photos',
                 'scripts/core04', 'scripts/core06',
                 'scripts/phase4/build-source-worklist.mjs', 'docs/hugeToDo',
                 '.github/workflows/security.yml', '.github/workflows/security-candidate22.yml',
                 '.github/workflows/ios-launch-contract.yml', '.github/workflows/ios-simulator-compile.yml')
        self.assertEqual(m.git('diff', '--raw', m.BASE, '--', *paths), b'')
        for name in paths:
            path = m.ROOT/name
            if path.is_file():
                self.assertEqual(m.regular(path), m.git('show', m.BASE+':'+name))

    def test_quality_changes_only_first_block_and_requires_actual_suites_and_history(self):
        before = m.git('show', m.BASE+':.github/workflows/quality.yml')
        current = (m.ROOT/'.github/workflows/quality.yml').read_bytes()
        m.quality_guard(current, before)
        for old, new in (
            (b'contents: read', b'contents: write'), (b'run: npm test', b'run: true'),
            (b'      - name: Typecheck', b'      - name: Typecheck\n        continue-on-error: true'),
            (b'postgres:15-alpine', b'postgres:17-alpine'),
            (b'main_integration44.py --historical', b'main_integration41.py --historical'),
            (b'npm run phase2:db-local-verify', b'true'),
            (b'--passWithNoTests=false', b'--passWithNoTests=true'),
            (b'privateKVSourceFence44.test.ts', b'Missing.test.ts'),
            (b'localPrivateDataFence44.test.ts', b'Missing.test.ts'),
            (b'planSourceFence44.test.ts', b'Missing.test.ts'),
            (b'OptionalChangePanel41.test.tsx', b'Missing.test.tsx'),
            (b'            unlinkSync(config);', b'            // omitted cleanup'),
            (b'            rmdirSync(directory);', b'            // omitted cleanup'),
        ):
            bad = current.replace(old, new)
            self.assertNotEqual(current, bad)
            with self.subTest(mutation=old), self.assertRaisesRegex(ValueError, 'R44_QUALITY_ONLY_FIRST_STEP'):
                m.quality_guard(bad, before)

    def test_parent_tree_plan_history_and_preimage_substitutions_refuse(self):
        actual = m.git
        for target, raw in (
            (('rev-parse', m.BASE+'^{tree}'), b'0'*40),
            (('show', m.PLAN_COMMIT+':'+m.PLAN), b'fake plan'),
            (('rev-list', '--reverse', m.original41().BASE+'..'+m.BASE), m.BASE.encode()),
            (('ls-tree', m.BASE, '--', 'apps/mobile/src/lib/storage/privateKV.ts'), b''),
        ):
            def read(*args):
                return raw if args == target else actual(*args)
            with self.subTest(target=target), patch.object(m, 'git', side_effect=read), self.assertRaises(ValueError):
                m.authenticate_parent()
        with patch.object(m, 'BASELINES', dict(list(m.BASELINES.items())[:-1])), self.assertRaises(ValueError):
            m.authenticate_parent()

    def test_current_source_never_calls_old_current_source_verifiers(self):
        functions = {node.name: node for node in ast.parse((m.ROOT/m.PREFIX/'main_integration44.py').read_bytes()).body
                     if isinstance(node, ast.FunctionDef)}
        for name in ('verify', 'authenticate_parent', 'scope', 'snapshot'):
            for node in ast.walk(functions[name]):
                if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
                    self.assertNotIn(node.func.attr, ('verify', 'historical'))
                if isinstance(node, ast.Constant):
                    self.assertNotEqual(node.value, m.PREFIX+'main_integration41.py')
        self.assertIn('fresh exact named PR44', m.historical.__doc__)

    def test_historical_reader_rejects_altered_code_and_hardlinks(self):
        raw = (m.ROOT/m.PREFIX/'main_integration41.py').read_bytes()
        with tempfile.TemporaryDirectory(prefix='source44-reader-') as directory:
            root = Path(directory).resolve()
            path = root/m.PREFIX/'main_integration41.py'
            path.parent.mkdir(parents=True)
            path.write_bytes(raw+b'\n# forged parser\n')
            with patch.object(m, 'ROOT', root), patch.object(m, 'O41', None), self.assertRaisesRegex(ValueError, 'R44_ORIGINAL41_IDENTITY'):
                m.original41()
            path.write_bytes(raw)
            with patch.object(m, 'ROOT', root), patch.object(m, 'O41', None):
                self.assertTrue(callable(m.original41().historical_result))
            link = root/'hardlink.py'
            os.link(path, link)
            with patch.object(m, 'ROOT', root), self.assertRaisesRegex(ValueError, 'R44_REGULAR_FILE'):
                m.original41()
            link.unlink()

    def test_actual_git_source_and_sole_final_seal_reject_postseal_edits(self):
        with repository('source44-history-') as (root, git):
            def commit(files):
                for path, body in files.items():
                    (root/path).write_bytes(body)
                git('add', '--', *files)
                git('commit', '--quiet', '-m', 'Synthetic history fixture')
                return git('rev-parse', 'HEAD').decode().strip()
            base = commit({'base.txt': b'base\n'})
            plan = commit({'plan.md': b'plan\n'})
            source = commit({'a.txt': b'source\n', 'b.txt': b'source\n'})
            seal = commit({'w.json': b'{}\n', 'w.md': b'seal\n'})
            extended = commit({'a.txt': b'post-seal mutation\n'})
            with patch.object(m, 'BASE', base), patch.object(m, 'PLAN_COMMIT', plan), patch.object(m, 'PLAN', 'plan.md'), \
                 patch.object(m, 'SOURCE', {'a.txt', 'b.txt'}), patch.object(m, 'WORKLIST', {'w.json', 'w.md'}):
                self.assertEqual(m.phase_guard([plan, source], 'SOURCE_PENDING'), (source, None))
                self.assertEqual(m.phase_guard([plan, source, seal], 'SOURCE_FROZEN'), (source, seal))
                for history, phase in (([plan, source, seal], 'SOURCE_PENDING'), ([plan, source], 'SOURCE_FROZEN'),
                    ([plan, source, seal, extended], 'SOURCE_FROZEN'), ([plan, source, source], 'SOURCE_PENDING'),
                    ([source, seal], 'SOURCE_FROZEN')):
                    with self.subTest(phase=phase, history=history), self.assertRaises(ValueError):
                        m.phase_guard(history, phase)

    def test_actual_index_modes_flags_working_bytes_and_exact_restore(self):
        with repository('source44-snapshot-') as (root, git):
            path = root/'source.txt'
            raw = b'synthetic source; acceptanceGranted=false\n'
            path.write_bytes(raw)
            git('add', '--', 'source.txt')
            git('commit', '--quiet', '-m', 'Synthetic source body')
            head = git('rev-parse', 'HEAD').decode().strip()
            original = m.snapshot(head)
            self.assertEqual(original[1], 3)
            path.write_bytes(raw.replace(b'false', b'true '))
            with self.assertRaises(ValueError):
                m.snapshot(head)
            path.write_bytes(raw)
            self.assertEqual(m.snapshot(head), original)
            path.write_bytes(raw+b'dirty staged content\n')
            git('add', '--', 'source.txt')
            with self.assertRaisesRegex(ValueError, 'R44_INDEX'):
                m.snapshot(head)
            path.write_bytes(raw)
            git('add', '--', 'source.txt')
            git('update-index', '--chmod=+x', 'source.txt')
            with self.assertRaisesRegex(ValueError, 'R44_INDEX'):
                m.snapshot(head)
            git('update-index', '--chmod=-x', 'source.txt')
            for flag, restore in (('--assume-unchanged', '--no-assume-unchanged'), ('--skip-worktree', '--no-skip-worktree')):
                git('update-index', flag, 'source.txt')
                with self.assertRaisesRegex(ValueError, 'R44_INDEX_FLAGS'):
                    m.snapshot(head)
                git('update-index', restore, 'source.txt')
            link = root/'hardlink.txt'
            os.link(path, link)
            with self.assertRaisesRegex(ValueError, 'R29_WORKING_REGULAR'):
                m.primitives().helpers().working29_guard(m.primitives().helpers().tree29(head))
            link.unlink()
            self.assertEqual(m.snapshot(head), original)

    def test_actual_object_store_rejects_alternates_grafts_replaces_and_shallow(self):
        with repository('source44-objects-') as (root, git):
            check = m.primitives().helpers()
            check.full29_store()
            head = git('rev-parse', 'HEAD').decode().strip()
            for name, reason in (('objects/info/alternates', 'R29_ALTERNATES'), ('info/grafts', 'R29_HISTORY_SUBSTITUTION')):
                path = root/'.git'/name
                path.write_bytes(b'')
                with self.assertRaisesRegex(ValueError, reason):
                    check.full29_store()
                path.unlink()
            git('replace', head, head)
            with self.assertRaisesRegex(ValueError, 'R29_HISTORY_SUBSTITUTION'):
                check.full29_store()
            git('replace', '-d', head)
            (root/'.git/shallow').write_bytes((head+'\n').encode())
            with self.assertRaisesRegex(ValueError, 'R29_FULL_HISTORY'):
                check.full29_store()
            (root/'.git/shallow').unlink()
            check.full29_store()

    def test_thirtyeight_obligations_and_eighteen_owner_gates_remain_unaccepted(self):
        projection = m.scope(m.SOURCE)
        self.assertFalse(projection['assessmentRenewed'])
        self.assertFalse(projection['externalReady'])
        self.assertEqual((projection['requiredRows'], len(projection['unadmittedGates'])), (38, 18))
        self.assertTrue(all(row['complete'] is False and row['ownerAdmitted'] is False and
                            row['positiveOutputEnabled'] is False for row in projection['obligations']))

    def test_protected_sources_refuse_finite_diff_in_actual_disposable_git(self):
        paths = ('scripts/launch/build-execution-baseline.mjs', 'scripts/launch/validate-execution-baseline.mjs',
                 'docs/hugeToDo/launch-contract.json', m.PREFIX+'main_integration41.py',
                 'apps/mobile/src/lib/auth/localAccountIsolation.ts',
                 'apps/mobile/src/lib/consent/healthDataWriteAdmission.ts',
                 'apps/mobile/src/features/settings/localPrivateDataKeys.ts',
                 '.github/workflows/security.yml', '.github/workflows/security-candidate22.yml')
        originals = {name: m.regular(m.ROOT/name) for name in paths}
        with repository('source44-protected-') as (root, git):
            for name, raw in originals.items():
                path = root/name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(raw)
            git('add', '--', *paths)
            git('commit', '--quiet', '-m', 'Synthetic protected preimages')
            base = git('rev-parse', 'HEAD').decode().strip()
            for name, raw in originals.items():
                path = root/name
                path.write_bytes(raw+b'\n# fabricated authority\n')
                git('add', '--', name)
                git('commit', '--quiet', '-m', 'Synthetic forbidden mutation')
                changed = git('rev-parse', 'HEAD').decode().strip()
                with self.subTest(path=name), self.assertRaises(ValueError):
                    m.changed(base, changed, m.GRANT)
                path.write_bytes(raw)
                git('add', '--', name)
                git('commit', '--quiet', '-m', 'Exact synthetic restoration')
                self.assertEqual(git('diff', '--raw', base), b'')

    def test_unchanged_original41_current_reader_refuses_current44_successor(self):
        path = m.ROOT/m.PREFIX/'main_integration41.py'
        before = path.read_bytes()
        result = subprocess.run([m.original41().historical_python(), '-I', '-B', str(path)], cwd=m.ROOT, capture_output=True)
        self.assertEqual(result.returncode, 1, result.stdout+result.stderr)
        value = m.document(result.stdout)
        self.assertFalse(value['valid'])
        self.assertFalse(value['acceptanceGranted'])
        self.assertEqual(value['release'], 'NO_GO')
        self.assertTrue(value['error'].startswith('R41_'))
        self.assertEqual(path.read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
