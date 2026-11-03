"""Actual Git, raw-byte, finite-grant and historical-reader negatives; disposable fixtures only."""
import ast
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import unittest
from contextlib import contextmanager
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('source45', Path(__file__).with_name('main_integration45.py'))
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
        git('config', 'user.name', 'Synthetic Campaign45 source fixture')
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
        with patch.object(m, 'ROOT', root), patch.object(m, 'H', None), patch.object(m, 'O44', None):
            yield root, git


class SourceControls45(unittest.TestCase):
    def test_exact_task_amendment_ledger_and_checkpoint_preimages(self):
        value = m.document(m.regular(m.ROOT/m.LEDGER))
        def before(path):
            return m.git('show', m.DIAGNOSTIC_COMMITS[-1]+':'+path) if \
                m.git('ls-tree', m.DIAGNOSTIC_COMMITS[-1], '--', path) else None
        self.assertEqual(m.ledger_guard(value, before), m.CLOSURE_PATHS)
        for field, bad in (('authority', 'unissued'), ('frozenPlanSha256', '0'*64),
                           ('preservedRepair03Tree', '0'*40), ('scopePolicy', 'apps/mobile/src/**')):
            changed = copy.deepcopy(value);changed[field] = bad
            with self.subTest(field=field), self.assertRaises(ValueError):m.ledger_guard(changed, before)
        for edit in ('omit', 'extra', 'duplicate', 'hash', 'not-recorded', 'wildcard', 'no-reason'):
            changed = copy.deepcopy(value)
            row = next(r for r in changed['additionalPaths'] if r['preimageSha256'] is not None)
            if edit == 'omit':changed['additionalPaths'].pop()
            elif edit == 'extra':changed['additionalPaths'].append(copy.deepcopy(row))
            elif edit == 'duplicate':changed['additionalPaths'][0] = copy.deepcopy(row)
            elif edit == 'hash':row['preimageSha256'] = '0'*64
            elif edit == 'not-recorded':row['recordedBeforeFirstEdit'] = False
            elif edit == 'wildcard':row['path'] = 'apps/mobile/src/**'
            else:row['causalNecessity'] = ''
            with self.subTest(edit=edit), self.assertRaises(ValueError):m.ledger_guard(changed, before)

    def test_exact_parent_immutable_original_plan_and_all_finite_preimages(self):
        m.authenticate_parent()
        self.assertEqual(hashlib.sha256((m.ROOT/m.PLAN).read_bytes()).hexdigest(), m.PLAN_SHA)
        self.assertEqual(set(m.BASELINES), m.GRANT)
        self.assertEqual((len(m.GRANT), len(m.SOURCE), len(m.CLOSURE_PATHS)), (46, 43, 5))
        self.assertEqual(m.GRANT-m.ORIGINAL_GRANT, m.REPAIR_PATHS|m.CLOSURE_PATHS)
        self.assertEqual(m.REPAIR_AUTHORITY, 'BRAIN-C45-MARKER-OWNERSHIP-REPAIR-03')
        self.assertEqual(m.CLOSURE_AUTHORITY, 'BRAIN-C45-AUTONOMOUS-CLOSURE-04')
        self.assertEqual(m.parents(m.PLAN_COMMIT), [m.PLAN_COMMIT, m.BASE])
        plan = m.git('show', m.PLAN_COMMIT+':'+m.PLAN).decode()
        self.assertEqual(set(re.findall(r'^- `([^`]+)` — (?:ABSENT|SHA256)', plan, re.M)), m.ORIGINAL_GRANT)

    def test_current_diff_finite_and_all_protected_bytes_and_programs_unchanged(self):
        m.primitives().delta(m.git('diff', '--raw', '--no-abbrev', '--no-renames', '-z', m.BASE), m.GRANT)
        untracked = {p.decode() for p in m.git('ls-files', '--others', '--exclude-standard', '-z').split(b'\0') if p}
        self.assertLessEqual(untracked, m.GRANT)
        for name, sha in m.PROGRAMS.items():
            self.assertEqual(m.digest(m.regular(m.ROOT/m.PREFIX/name)), sha)
        paths = ('package.json', 'package-lock.json', 'supabase', 'scripts/launch', 'scripts/brain',
                 'apps/mobile/src/lib/auth/localAccountIsolation.test.ts',
                 'apps/mobile/src/lib/auth/sessionOwner.test.ts',
                 'apps/mobile/src/lib/consent/healthProcessingEpoch.ts',
                 'scripts/core04', 'scripts/core06', m.PREFIX+'main_integration44.py',
                 m.PREFIX+'main_integration44.test.py', m.PREFIX+'source_consumer44.test.py',
                 'scripts/phase4/build-source-worklist.mjs', 'docs/hugeToDo',
                 '.github/workflows/security.yml', '.github/workflows/security-candidate22.yml',
                 '.github/workflows/ios-launch-contract.yml', '.github/workflows/ios-simulator-compile.yml')
        # No F09 source or test is granted in Campaign45.
        photo_paths=tuple(path for path in m.text('ls-tree','-r','--name-only',m.BASE,'--',
            'apps/mobile/src/features/photos').splitlines() if path not in m.GRANT)
        paths += photo_paths
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
            (b'main_integration45.py --historical', b'main_integration41.py --historical'),
            (b'npm run phase2:db-local-verify', b'true'),
            (b'--passWithNoTests=false', b'--passWithNoTests=true'),
            (b'privateKVSourceFence44.test.ts', b'Missing.test.ts'),
            (b'localPrivateDataFence44.test.ts', b'Missing.test.ts'),
            (b'planSourceFence44.test.ts', b'Missing.test.ts'),
            (b'planHistory45.test.ts', b'Missing.test.ts'),
            (b'planHistory45Encrypted.test.ts', b'Missing.test.ts'),
            (b'ownedBottleVersion38.test.ts', b'Missing.test.ts'),
            (b'historicalReplay45.test.py', b'Missing.test.py'),
            (b'PlanHistoryPanel45.test.tsx', b'Missing.test.tsx'),
            (b'localPrivateDataKeys.test.ts', b'Missing.test.ts'),
            (b'localDeviceExport.test.ts', b'Missing.test.ts'),
            (b'sessionOwner.test.ts', b'Missing.test.ts'),
            (b'localAccountIsolation.test.ts', b'Missing.test.ts'),
            (b'accountGeneration.test.ts', b'Missing.test.ts'),
            (b'encryptedStorage.test.ts', b'Missing.test.ts'),
            (b'OptionalChangePanel41.test.tsx', b'Missing.test.tsx'),
            (b'            unlinkSync(config);', b'            // omitted cleanup'),
            (b'            rmdirSync(directory);', b'            // omitted cleanup'),
            (b'--historical-evidence-dir "$RUNNER_TEMP/c45-history"', b'--historical-evidence-dir "$GITHUB_WORKSPACE/history"'),
            (b'        if: always()', b'        if: false'),
            (b'${{ runner.temp }}/c45-history/full-normal-original44/**', b'${{ runner.temp }}/c45-history/omitted/**'),
            (b'          retention-days: 7', b'          retention-days: 0'),
        ):
            bad = current.replace(old, new)
            self.assertNotEqual(current, bad)
            with self.subTest(mutation=old), self.assertRaisesRegex(ValueError, 'R45_QUALITY_ONLY_FIRST_STEP'):
                m.quality_guard(bad, before)

    def test_parent_tree_plan_history_and_preimage_substitutions_refuse(self):
        actual = m.git
        for target, raw in (
            (('rev-parse', m.BASE+'^{tree}'), b'0'*40),
            (('show', m.PLAN_COMMIT+':'+m.PLAN), b'fake plan'),
            (('rev-list', '--reverse', m.original44().BASE+'..'+m.BASE), m.BASE.encode()),
            (('ls-tree', m.BASE, '--', 'apps/mobile/src/lib/storage/privateKV.ts'), b''),
        ):
            def read(*args):
                return raw if args == target else actual(*args)
            with self.subTest(target=target), patch.object(m, 'git', side_effect=read), self.assertRaises(ValueError):
                m.authenticate_parent()
        with patch.object(m, 'BASELINES', dict(list(m.BASELINES.items())[:-1])), self.assertRaises(ValueError):
            m.authenticate_parent()

    def test_current_source_never_calls_old_current_source_verifiers(self):
        functions = {node.name: node for node in ast.parse((m.ROOT/m.PREFIX/'main_integration45.py').read_bytes()).body
                     if isinstance(node, ast.FunctionDef)}
        for name in ('verify', 'authenticate_parent', 'scope', 'snapshot'):
            for node in ast.walk(functions[name]):
                if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
                    self.assertNotIn(node.func.attr, ('verify', 'historical'))
                if isinstance(node, ast.Constant):
                    self.assertNotEqual(node.value, m.PREFIX+'main_integration44.py')
        self.assertIn('fresh exact named PR45', m.historical.__doc__)

    def test_historical_reader_rejects_altered_code_and_hardlinks(self):
        raw = (m.ROOT/m.PREFIX/'main_integration44.py').read_bytes()
        with tempfile.TemporaryDirectory(prefix='source45-reader-') as directory:
            root = Path(directory).resolve()
            path = root/m.PREFIX/'main_integration44.py'
            path.parent.mkdir(parents=True)
            path.write_bytes(raw+b'\n# forged parser\n')
            with patch.object(m, 'ROOT', root), patch.object(m, 'O44', None), self.assertRaisesRegex(ValueError, 'R45_ORIGINAL44_IDENTITY'):
                m.original44()
            path.write_bytes(raw)
            with patch.object(m, 'ROOT', root), patch.object(m, 'O44', None):
                self.assertTrue(callable(m.original44().historical_result))
            link = root/'hardlink.py'
            os.link(path, link)
            with patch.object(m, 'ROOT', root), self.assertRaisesRegex(ValueError, 'R45_REGULAR_FILE'):
                m.original44()
            link.unlink()

    def test_composite_reader_requires_hashed_complete_normal_invocation_not_diagnostic_or_staged_success(self):
        # Actual helper reader and actual raw files. These are rejection fixtures,
        # never substitutes for the complete original invocation.
        with tempfile.TemporaryDirectory(prefix='source45-composite-refusal-') as directory:
            workspace=Path(directory).resolve();proof=workspace/'result.json'
            value=dict(schema=2,status='PASS',mode='EXPLICIT_LOCAL_COMPLETED_PROOF_REUSE',
                workspace=str(workspace),fixture=str(workspace/'pr45'),historicalHead=m.BASE,
                historicalTree=m.BASE_TREE,
                qualification='COMPOSITE_PR45_CONTROLS_AND_COMPLETE_NORMAL_ORIGINAL44_INVOCATION_NOT_OWNER_ACCEPTANCE',
                helperSHA256=m.digest(m.regular(m.ROOT/m.PREFIX/'historicalReplay45.py')),
                acceptanceGranted=False,admissions=dict.fromkeys(m.ADMISSIONS,False),release='NO_GO')
            def transcript(v):return ('R45_HISTORICAL_WORKSPACE '+str(workspace)+'\n'+json.dumps(v)).encode()
            for status in ('PASS','STAGED_SUCCESS','INCOMPLETE_REQUIRES_RESUME_OR_REPAIR','DIAGNOSTIC_SUCCESS'):
                raw=(json.dumps(dict(status=status,acceptanceGranted=False,release='NO_GO'))+'\n').encode()
                proof.write_bytes(raw)
                current=dict(value,completedNormalInvocation=dict(path=str(proof),bytes=len(raw),sha256=m.digest(raw)))
                with self.subTest(status=status),self.assertRaisesRegex(ValueError,'C45H_RESULT_NOT_COMPLETE'):
                    m.historical_result(transcript(current))
            current=dict(value,completedNormalInvocation=dict(path=str(proof),bytes=len(raw),sha256='0'*64))
            with self.assertRaisesRegex(ValueError,'R45_HISTORICAL_FULL_PROOF_HASH'):
                m.historical_result(transcript(current))
            current['helperSHA256']='0'*64
            with self.assertRaisesRegex(ValueError,'R45_HISTORICAL_HELPER_CHANGED'):
                m.historical_result(transcript(current))

    def test_new_execution_helper_obeys_regular_file_and_hardlink_boundary(self):
        raw=m.regular(m.ROOT/m.PREFIX/'historicalReplay45.py')
        with tempfile.TemporaryDirectory(prefix='source45-helper-boundary-') as directory:
            root=Path(directory).resolve();path=root/m.PREFIX/'historicalReplay45.py'
            path.parent.mkdir(parents=True);path.write_bytes(raw)
            with patch.object(m,'ROOT',root):
                self.assertTrue(callable(m.historical_helper().verify_result))
                link=root/'linked.py';os.link(path,link)
                with self.assertRaisesRegex(ValueError,'R45_REGULAR_FILE'):m.historical_helper()
                link.unlink()

    def test_actual_git_source_and_sole_final_seal_reject_postseal_edits(self):
        with repository('source45-history-') as (root, git):
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
                 patch.object(m, 'SOURCE', {'a.txt', 'b.txt'}), patch.object(m, 'ESSENTIAL', {'a.txt','b.txt'}), \
                 patch.object(m, 'WORKLIST', {'w.json', 'w.md'}), patch.object(m, 'PREVIOUS_SEALS', ()):
                self.assertEqual(m.phase_guard([plan, source], 'SOURCE_PENDING', {'a.txt','b.txt'}), (source, None))
                self.assertEqual(m.phase_guard([plan, source, seal], 'SOURCE_FROZEN', {'a.txt','b.txt'}), (source, seal))
                for history, phase in (([plan, source, seal], 'SOURCE_PENDING'), ([plan, source], 'SOURCE_FROZEN'),
                    ([plan, source, seal, extended], 'SOURCE_FROZEN'), ([plan, source, source], 'SOURCE_PENDING'),
                    ([source, seal], 'SOURCE_FROZEN')):
                    with self.subTest(phase=phase, history=history), self.assertRaises(ValueError):
                        m.phase_guard(history, phase, {'a.txt','b.txt'})

    def test_actual_index_modes_flags_working_bytes_and_exact_restore(self):
        with repository('source45-snapshot-') as (root, git):
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
            with self.assertRaisesRegex(ValueError, 'R45_INDEX'):
                m.snapshot(head)
            path.write_bytes(raw)
            git('add', '--', 'source.txt')
            git('update-index', '--chmod=+x', 'source.txt')
            with self.assertRaisesRegex(ValueError, 'R45_INDEX'):
                m.snapshot(head)
            git('update-index', '--chmod=-x', 'source.txt')
            for flag, restore in (('--assume-unchanged', '--no-assume-unchanged'), ('--skip-worktree', '--no-skip-worktree')):
                git('update-index', flag, 'source.txt')
                with self.assertRaisesRegex(ValueError, 'R45_INDEX_FLAGS'):
                    m.snapshot(head)
                git('update-index', restore, 'source.txt')
            link = root/'hardlink.txt'
            os.link(path, link)
            with self.assertRaisesRegex(ValueError, 'R29_WORKING_REGULAR'):
                m.primitives().helpers().working29_guard(m.primitives().helpers().tree29(head))
            link.unlink()
            self.assertEqual(m.snapshot(head), original)

    def test_declared_prior_seals_allow_only_verified_repair_and_a_new_final_seal(self):
        with repository('source45-reseal-') as (root, git):
            def commit(files):
                for path, body in files.items():
                    (root/path).write_bytes(body)
                git('add', '--', *files)
                git('commit', '--quiet', '-m', 'Synthetic finite reseal fixture only')
                return git('rev-parse', 'HEAD').decode().strip()
            base = commit({'base.txt': b'base\n'})
            plan = commit({'plan.md': b'plan\n'})
            source = commit({'a.txt': b'source\n', 'b.txt': b'source\n'})
            older = commit({'w.json': b'old1\n', 'w.md': b'old1\n'})
            repair = commit({'a.txt': b'first genuine source repair\n'})
            second = commit({'w.json': b'old2\n', 'w.md': b'old2\n'})
            last_source = commit({'b.txt': b'second genuine source repair\n'})
            final = commit({'w.json': b'current\n', 'w.md': b'current\n'})
            postseal = commit({'a.txt': b'undeclared postseal edit\n'})
            declared = ((older, source, git('rev-parse', older+'^{tree}').decode().strip()),
                        (second, repair, git('rev-parse', second+'^{tree}').decode().strip()))
            pending = [plan, source, older, repair, second, last_source]
            with patch.object(m, 'BASE', base), patch.object(m, 'PLAN_COMMIT', plan), patch.object(m, 'PLAN', 'plan.md'), \
                 patch.object(m, 'SOURCE', {'a.txt', 'b.txt'}), patch.object(m, 'ESSENTIAL', {'a.txt', 'b.txt'}), \
                 patch.object(m, 'WORKLIST', {'w.json', 'w.md'}), patch.object(m, 'PREVIOUS_SEALS', declared, create=True):
                self.assertEqual(m.phase_guard(pending, 'SOURCE_PENDING', {'a.txt','b.txt'}), (last_source, None))
                self.assertEqual(m.phase_guard(pending+[final], 'SOURCE_FROZEN', {'a.txt','b.txt'}), (last_source, final))
                for history, phase in (
                    ([plan, source, repair, second, last_source], 'SOURCE_PENDING'),
                    ([plan, source, second, repair, older, last_source], 'SOURCE_PENDING'),
                    (pending[:3], 'SOURCE_PENDING'), (pending[:-1], 'SOURCE_FROZEN'),
                    (pending+[final], 'SOURCE_PENDING'), (pending+[final, postseal], 'SOURCE_FROZEN')):
                    with self.subTest(history=history, phase=phase), self.assertRaises(ValueError):
                        m.phase_guard(history, phase, {'a.txt','b.txt'})
                for wrong in (declared[::-1], declared[:1], declared+(declared[0],),
                              ((older, source, '0'*40), declared[1]),
                              ((older, base, declared[0][2]), declared[1])):
                    with patch.object(m, 'PREVIOUS_SEALS', wrong), self.subTest(policy=wrong), self.assertRaises(ValueError):
                        m.phase_guard(pending+[final], 'SOURCE_FROZEN', {'a.txt','b.txt'})
                git('checkout', '--detach', last_source)
                mixed = commit({'w.json': b'mixed\n', 'w.md': b'mixed\n', 'a.txt': b'forbidden seal source\n'})
                with self.assertRaises(ValueError):
                    m.phase_guard(pending+[mixed], 'SOURCE_FROZEN', {'a.txt','b.txt'})
                after_mixed = commit({'b.txt': b'new source after a mixed seal\n'})
                with patch.object(m, 'PREVIOUS_SEALS', declared+((mixed, last_source, git('rev-parse', mixed+'^{tree}').decode().strip()),)):
                    with self.assertRaises(ValueError):
                        m.phase_guard(pending+[mixed, after_mixed], 'SOURCE_PENDING', {'a.txt','b.txt'})

    def test_published_prior_seal_pin_has_actual_exact_tree_parent_and_two_file_delta(self):
        expected = (('812a4208154cef9b3d0f3078dd0a56329caedb3d',
                     'a140cf67b78b61dc12f6c53bd4ec684f8b687b9c',
                     '118a9d345109cb1fef03ffbaefa65afe847749a1'),
                    ('007aff70c652303890e03336ddc9a7ac0afb18ee',
                     'b6f0f57efebfc531ecded46fc3f9233489713d61',
                     '2090720900a2e892672a835d79bee4b0b73789a3'))
        self.assertEqual(m.PREVIOUS_SEALS, expected)
        for seal, parent, tree in expected:
            m.previous_seal_guard(seal, parent, tree)
            self.assertEqual(m.parents(seal), [seal, parent])
            self.assertEqual(m.text('rev-parse', seal+'^{tree}'), tree)
            self.assertEqual(m.changed(parent, seal, m.WORKLIST), m.WORKLIST)
            for bad_parent, bad_tree in ((m.BASE, tree), (parent, '0'*40)):
                with self.subTest(parent=bad_parent, tree=bad_tree), self.assertRaisesRegex(ValueError, 'R45_PREVIOUS_SEAL_IDENTITY'):
                    m.previous_seal_guard(seal, bad_parent, bad_tree)
    def test_actual_object_store_rejects_alternates_grafts_replaces_and_shallow(self):
        with repository('source45-objects-') as (root, git):
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

    def test_standalone_historical_source_identity_checks_actual_caller_object_store(self):
        with repository('source45-historical-caller-store-') as (root, git):
            baseline=m.source_identity()
            self.assertEqual(baseline['head'],git('rev-parse','HEAD').decode().strip())
            self.assertEqual(baseline['trackedBlobs'],2)
            for name,reason in (('objects/info/alternates','R29_ALTERNATES'),('info/grafts','R29_HISTORY_SUBSTITUTION')):
                path=root/'.git'/name;path.write_bytes(b'')
                with self.subTest(store=name),self.assertRaisesRegex(ValueError,reason):m.source_identity()
                path.unlink()
            git('replace',baseline['head'],baseline['head'])
            with self.assertRaisesRegex(ValueError,'R29_HISTORY_SUBSTITUTION'):m.source_identity()
            git('replace','-d',baseline['head'])
            shallow=root/'.git/shallow';shallow.write_bytes((baseline['head']+'\n').encode())
            with self.assertRaisesRegex(ValueError,'R29_FULL_HISTORY'):m.source_identity()
            shallow.unlink()
            self.assertEqual(m.source_identity(),baseline)

    def test_thirtyeight_obligations_and_eighteen_owner_gates_remain_unaccepted(self):
        projection = m.scope(m.SOURCE)
        self.assertFalse(projection['assessmentRenewed'])
        self.assertFalse(projection['externalReady'])
        self.assertEqual((projection['requiredRows'], len(projection['unadmittedGates'])), (38, 18))
        self.assertTrue(all(row['complete'] is False and row['ownerAdmitted'] is False and
                            row['positiveOutputEnabled'] is False for row in projection['obligations']))

    def test_protected_sources_refuse_finite_diff_in_actual_disposable_git(self):
        paths = ('scripts/launch/build-execution-baseline.mjs', 'scripts/launch/validate-execution-baseline.mjs',
                 'docs/hugeToDo/launch-contract.json', m.PREFIX+'main_integration44.py',
                 'apps/mobile/src/lib/consent/healthProcessingEpoch.ts',
                 '.github/workflows/security.yml', '.github/workflows/security-candidate22.yml')
        originals = {name: m.regular(m.ROOT/name) for name in paths}
        with repository('source45-protected-') as (root, git):
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

    def test_unchanged_original44_current_reader_refuses_current45_successor(self):
        path = m.ROOT/m.PREFIX/'main_integration44.py'
        before = path.read_bytes()
        # This negative reader must not inherit the current PR's hosted event
        # or read token; it is a separate historical-source refusal check.
        result = subprocess.run([m.original44().original41().historical_python(), '-I', '-B', str(path)],
            cwd=m.ROOT, env=m.primitives().clean_environment(), capture_output=True)
        self.assertEqual(result.returncode, 1, result.stdout+result.stderr)
        value = m.document(result.stdout)
        self.assertFalse(value['valid'])
        self.assertFalse(value['acceptanceGranted'])
        self.assertEqual(value['release'], 'NO_GO')
        self.assertTrue(value['error'].startswith('R44_'))
        self.assertEqual(path.read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
