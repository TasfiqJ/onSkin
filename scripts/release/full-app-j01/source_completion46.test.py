"""Negative controls for C46 technical source checker, never admission evidence."""
import copy
from contextlib import contextmanager
import importlib.util
import json
import os
import stat
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

spec = importlib.util.spec_from_file_location('source46', Path(__file__).with_name('source_completion46.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


@contextmanager
def real_source_fixture():
    with tempfile.TemporaryDirectory(prefix='c46-source-working-') as name:
        root = Path(name) / 'source'
        root.mkdir()
        g = lambda *args: m.git(*args, root=root)
        g('init', '-q')
        g('config', 'user.email', 'synthetic46@example.invalid')
        g('config', 'user.name', 'Synthetic working-source control')
        g('config', 'core.autocrlf', 'false')
        files = {'main.txt': b'canonical source\n', 'nested/leaf.txt': b'canonical nested\n', 'empty.txt': b''}
        for path, raw in files.items():
            target = root / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(raw)
        g('add', '.')
        g('commit', '-qm', 'synthetic exact source')
        yield root, g, g('rev-parse', 'HEAD').decode().strip(), files


class Controls(unittest.TestCase):
    def test_required_names_counts_gates_and_acceptance(self):
        baseline = json.loads((m.ROOT / 'docs/release/full-app-j01/matrix.v2.json').read_text())
        contract = json.loads((m.ROOT / 'docs/release/full-app-j01/contract.v2.json').read_text())
        rows = [dict(id=r['id'], name=r['name'], acceptanceGranted=False, source_paths=[],
                     entrypoints=[], tests=[], gaps=[], dependencies=[], next_action='review',
                     evidence_axes={'release': {'status': 'NO_GO', 'accepted': False}})
                for r in baseline['rows'] if r['disposition'] == 'REQUIRED']
        value = {'required_rows': rows, 'owner_gates': [{'id': g['id'], 'admitted': False} for g in contract['gates']]}
        m.check_map(value, baseline, contract)
        mutations = [lambda v: v['required_rows'].pop(),
                     lambda v: v['required_rows'].reverse(),
                     lambda v: v['required_rows'][0].update(name='Renamed requirement'),
                     lambda v: v['required_rows'][0].update(acceptanceGranted=True),
                     lambda v: v['required_rows'][0]['evidence_axes']['release'].update(status='GO'),
                     lambda v: v['required_rows'][0].pop('next_action'),
                     lambda v: v['owner_gates'].pop(),
                     lambda v: v['owner_gates'][0].update(admitted=True)]
        for mutate in mutations:
            changed = copy.deepcopy(value)
            mutate(changed)
            with self.assertRaises((ValueError, KeyError)):
                m.check_map(changed, baseline, contract)

    def test_finite_preimages_with_real_git_objects(self):
        with tempfile.TemporaryDirectory(prefix='c46-source-controls-') as name:
            root = Path(name)
            def git(*args):
                return subprocess.check_output(['git', *args], cwd=root, stderr=subprocess.DEVNULL)
            git('init', '-q')
            git('config', 'user.email', 'synthetic46@example.invalid')
            git('config', 'user.name', 'Synthetic C46 control')
            git('config', 'core.autocrlf', 'false')
            path = next(iter(sorted(m.PATHS)))
            target = root / path
            target.parent.mkdir(parents=True)
            raw = b'synthetic exact preimage\n'
            target.write_bytes(raw)
            git('add', path)
            git('commit', '-qm', 'synthetic base')
            base = git('rev-parse', 'HEAD').decode().strip()
            old_base = m.BASE
            try:
                m.BASE = base
                base_tree = git('rev-parse', 'HEAD^{tree}').decode().strip()
                target.write_bytes(b'synthetic source successor\n')
                git('add', path)
                git('commit', '-qm', 'synthetic source')
                child = git('rev-parse', 'HEAD').decode().strip()
                tree = git('rev-parse', 'HEAD^{tree}').decode().strip()
                merge = git('commit-tree', tree, '-p', base, '-p', child, '-m', 'synthetic provider merge').decode().strip()
                git('checkout', '--detach', merge)
                self.assertEqual(m.source_head(git), child)
                wrong_tree = git('commit-tree', base_tree, '-p', base, '-p', child, '-m', 'unrelated merge bytes').decode().strip()
                git('checkout', '--detach', wrong_tree)
                with self.assertRaisesRegex(ValueError, 'MERGE_TREE_DRIFT'):
                    m.source_head(git)
            finally:
                m.BASE = old_base
            def preimage(p):
                try:
                    return git('show', base + ':' + p)
                except subprocess.CalledProcessError:
                    return None
            rows = [{'path': p, 'preimage_sha256': m.sha(raw) if p == path else None,
                     'need': 'control', 'invariant': 'control',
                     'authority': 'BRAIN-M1X-APP-COMPLETION46-AUTONOMOUS-01',
                     'planned_validation': 'native Git objects'} for p in sorted(m.PATHS)]
            value = {'base': m.BASE, 'base_tree': m.TREE, 'inventory_frozen': True, 'paths': rows}
            m.check_ledger(value, preimage)
            for mutate in [lambda v: v['paths'].pop(),
                           lambda v: v['paths'].append(v['paths'][0]),
                           lambda v: v.update(inventory_frozen=False),
                           lambda v: v.update(base='0' * 40),
                           lambda v: v['paths'][0].update(preimage_sha256='0' * 64),
                           lambda v: v['paths'][0].update(authority='SELF_APPROVED'),
                           lambda v: v['paths'][0].update(path='../escape')]:
                changed = copy.deepcopy(value)
                mutate(changed)
                with self.assertRaises(ValueError):
                    m.check_ledger(changed, preimage)

    def test_duplicate_json_fields_refuse(self):
        with self.assertRaisesRegex(ValueError, 'DUPLICATE_FIELD'):
            m.document(b'{"acceptance":false,"acceptance":true}')

    def test_closure_exact_preimages_authority_and_finite_inventory(self):
        with tempfile.TemporaryDirectory(prefix='c46-closure-preimages-') as name:
            root = Path(name)
            def git(*args):
                return subprocess.check_output(['git', *args], cwd=root, stderr=subprocess.DEVNULL)
            git('init', '-q')
            git('config', 'user.email', 'synthetic46@example.invalid')
            git('config', 'user.name', 'Synthetic C46 closure')
            git('config', 'core.autocrlf', 'false')
            path = sorted(m.CLOSURE_PATHS)[0]
            target = root / path
            target.parent.mkdir(parents=True)
            raw = b'exact synthetic submitted preimage\n'
            target.write_bytes(raw)
            git('add', path)
            git('commit', '-qm', 'synthetic submitted')
            submitted = git('rev-parse', 'HEAD').decode().strip()
            def preimage(p):
                try:
                    return git('show', submitted + ':' + p)
                except subprocess.CalledProcessError:
                    return None
            rows = [{'path': p, 'preimage_ref': m.SUBMITTED,
                     'preimage_sha256': m.sha(raw) if p == path else None,
                     'bytes': len(raw) if p == path else None,
                     'need': 'exact control', 'invariant': 'exact control',
                     'authority': m.CLOSURE_AUTH, 'planned_validation': 'real Git objects'}
                    for p in sorted(m.CLOSURE_PATHS)]
            value = {'authorization': m.CLOSURE_AUTH, 'predecessor_source': m.SUBMITTED,
                     'predecessor_tree': m.SUBMITTED_TREE, 'inventory_frozen': True, 'paths': rows}
            m.check_closure_ledger(value, preimage)
            for mutate in [
                lambda v: v.update(authorization='SELF_APPROVAL'),
                lambda v: v.update(predecessor_source='0' * 40),
                lambda v: v.update(predecessor_tree='0' * 40),
                lambda v: v.update(inventory_frozen=False),
                lambda v: v['paths'].pop(),
                lambda v: v['paths'].append(v['paths'][0]),
                lambda v: v['paths'][0].update(path='../escape'),
                lambda v: v['paths'][0].update(preimage_ref=m.BASE),
                lambda v: v['paths'][0].update(preimage_sha256='0' * 64),
                lambda v: v['paths'][0].update(bytes=len(raw) + 1),
                lambda v: v['paths'][0].update(authority='SELF_APPROVAL'),
                lambda v: v['paths'][0].update(invariant=''),
            ]:
                changed = copy.deepcopy(value)
                mutate(changed)
                with self.assertRaises(ValueError):
                    m.check_closure_ledger(changed, preimage)

    def test_real_git_graft_replace_and_alternate_metadata_refuse(self):
        with tempfile.TemporaryDirectory(prefix='c46-git-metadata-') as name:
            root = Path(name)
            def git(*args):
                return subprocess.check_output(['git', '--no-replace-objects', *args],
                                               cwd=root, stderr=subprocess.DEVNULL)
            git('init', '-q')
            git('config', 'user.email', 'synthetic46@example.invalid')
            git('config', 'user.name', 'Synthetic metadata control')
            (root / 'source.txt').write_bytes(b'exact synthetic source\n')
            git('add', '.')
            git('commit', '-qm', 'synthetic source')
            head = git('rev-parse', 'HEAD').decode().strip()
            m.check_git_metadata(git, root)
            for name in ['info/grafts', 'objects/info/alternates']:
                p = root / '.git' / name
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_bytes(b'')
                try:
                    with self.assertRaisesRegex(ValueError, 'GIT_METADATA'):
                        m.check_git_metadata(git, root)
                finally:
                    p.unlink()
            git('update-ref', 'refs/replace/' + head, head)
            with self.assertRaisesRegex(ValueError, 'REPLACE_REFS'):
                m.check_git_metadata(git, root)
            git('update-ref', '-d', 'refs/replace/' + head)
            m.check_git_metadata(git, root)

    def test_real_git_append_only_seal_lineage_and_refusals(self):
        with tempfile.TemporaryDirectory(prefix='c46-reseal-controls-') as name:
            root = Path(name)
            def git(*args, input=None):
                return subprocess.check_output(['git', *args], input=input, cwd=root,
                                               stderr=subprocess.DEVNULL).decode().strip()
            git('init', '-q')
            git('config', 'user.email', 'synthetic46@example.invalid')
            git('config', 'user.name', 'Synthetic C46 seal controls')
            git('config', 'core.autocrlf', 'false')
            def commit(message, paths):
                for p, body in paths.items():
                    target = root / p
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(body)
                git('add', '--all')
                git('commit', '-qm', message)
                return git('rev-parse', 'HEAD')
            base = commit('synthetic base', {'app.txt': b'base\n'})
            plan = commit('synthetic plan', {'plan.txt': b'frozen\n'})
            tested0 = commit('synthetic tested source', {'app.txt': b'source0\n'})
            seal0 = commit('synthetic original seal', {p: b'worklist0\n' for p in m.WORKLISTS})
            repair1 = commit('synthetic append-only source1', {'app.txt': b'source1\n'})
            seal1 = commit('synthetic reseal1', {p: b'worklist1\n' for p in m.WORKLISTS})
            repair2 = commit('synthetic append-only source2', {'app.txt': b'source2\n'})
            seal2 = commit('synthetic final reseal', {p: b'worklist2\n' for p in m.WORKLISTS})
            parent = lambda c: git('rev-parse', c + '^')
            tree = lambda c: git('rev-parse', c + '^{tree}')
            changed = lambda a, b: set(git('diff', '--name-only', a, b).splitlines())
            row = lambda c: {'commit': c, 'tested_source': parent(c), 'tree': tree(c)}
            old = m.SUBMITTED, m.SUBMITTED_TREE, m.ORIGINAL_COMMITS
            try:
                m.SUBMITTED, m.SUBMITTED_TREE = seal0, tree(seal0)
                m.ORIGINAL_COMMITS = [plan, tested0, seal0]
                first = [plan, tested0, seal0, repair1]
                m.check_seal_lineage('PENDING', first, changed, parent, tree, [row(seal0)])
                m.check_seal_lineage('SOURCE_FROZEN', first + [seal1], changed, parent, tree,
                                     [row(seal0)])
                all_commits = first + [seal1, repair2, seal2]
                m.check_seal_lineage('SOURCE_FROZEN', all_commits, changed, parent, tree,
                                     [row(seal0), row(seal1)])
                for phase, commits, records in [
                    ('SOURCE_FROZEN', [plan, tested0, seal0], [row(seal0)]),
                    ('SOURCE_FROZEN', first, [row(seal0)]),
                    ('PENDING', first + [seal1], [row(seal0)]),
                    ('SOURCE_FROZEN', all_commits, [row(seal0)]),
                    ('SOURCE_FROZEN', all_commits, [row(seal1)]),
                    ('SOURCE_FROZEN', all_commits, [row(seal0), row(seal0), row(seal1)]),
                    ('SOURCE_FROZEN', all_commits,
                     [dict(row(seal0), tested_source=base), row(seal1)]),
                    ('SOURCE_FROZEN', all_commits,
                     [row(seal0), dict(row(seal1), tree=tree(base))]),
                ]:
                    with self.assertRaises(ValueError):
                        m.check_seal_lineage(phase, commits, changed, parent, tree, records)
                # Real distinct Git trees for partial and mixed seals, without
                # resetting any working file or rewriting an existing commit.
                git('read-tree', repair2)
                p = sorted(m.WORKLISTS)[0]
                blob = git('hash-object', '-w', '--stdin', input=b'partial worklist\n')
                git('update-index', '--add', '--cacheinfo', '100644', blob, p)
                partial_tree = git('write-tree')
                partial = git('commit-tree', partial_tree, '-p', repair2, '-m', 'partial seal')
                blob = git('hash-object', '-w', '--stdin', input=b'changed app with worklist\n')
                git('update-index', '--cacheinfo', '100644', blob, 'app.txt')
                mixed = git('commit-tree', git('write-tree'), '-p', repair2, '-m', 'mixed seal')
                for bad in [partial, mixed]:
                    with self.assertRaisesRegex(ValueError, 'MIXED_OR_PARTIAL_SEAL'):
                        m.check_seal_lineage('SOURCE_FROZEN', all_commits[:-1] + [bad],
                                             changed, parent, tree, [row(seal0), row(seal1)])
            finally:
                m.SUBMITTED, m.SUBMITTED_TREE, m.ORIGINAL_COMMITS = old


class WorkingSourceControls(unittest.TestCase):
    def test_git_environment_is_stripped_and_reported_worktree_is_bound(self):
        with real_source_fixture() as (root, g, head, _), real_source_fixture() as (decoy, decoy_g, _, _):
            decoy_g('commit', '--allow-empty', '-qm', 'distinct synthetic alternate Git view')
            actual_call = subprocess.check_output
            observed = []
            def real_call(*args, **kwargs):
                observed.append(kwargs['env'])
                self.assertEqual({k: v for k, v in kwargs['env'].items()
                                  if k.upper().startswith('GIT_')}, {'GIT_OPTIONAL_LOCKS': '0'})
                return actual_call(*args, **kwargs)
            with patch.dict(os.environ, {'GIT_DIR': str(decoy / '.git'), 'GIT_WORK_TREE': str(decoy),
                                        'GIT_INDEX_FILE': str(decoy / '.git/index'),
                                        'GiT_SYNTHETIC_SOURCE46': 'must not reach Git'}), \
                    patch.object(m.subprocess, 'check_output', side_effect=real_call):
                self.assertEqual(g('rev-parse', 'HEAD').decode().strip(), head)
                m.check_git_metadata(g, root)
                with self.assertRaisesRegex(ValueError, 'GIT_WORKTREE_ROOT'):
                    m.check_git_metadata(g, decoy)
            self.assertTrue(observed)

    def test_hidden_index_flags_refuse_even_when_real_git_status_is_empty(self):
        with real_source_fixture() as (root, g, head, files):
            target = root / 'main.txt'
            for enable, disable in [('--assume-unchanged', '--no-assume-unchanged'),
                                    ('--skip-worktree', '--no-skip-worktree')]:
                g('update-index', enable, '--', 'main.txt')
                target.write_bytes(b'hidden uncommitted source\n')
                self.assertEqual(g('status', '--porcelain'), b'')
                with self.assertRaisesRegex(ValueError, 'HIDDEN_INDEX_FLAGS'):
                    m.verify_tracked_source(root, head, g)
                target.write_bytes(files['main.txt'])
                g('update-index', disable, '--', 'main.txt')
            self.assertEqual(m.verify_tracked_source(root, head, g)['files'], len(files))

    def test_full_actual_bytes_missing_files_and_staged_index_drift_refuse(self):
        with real_source_fixture() as (root, g, head, files):
            target = root / 'main.txt'
            positive = m.verify_tracked_source(root, head, g)
            self.assertEqual(positive['files'], len(files))
            self.assertEqual(positive['bytes'], sum(map(len, files.values())))
            target.write_bytes(b'noncanonical body\n')
            with self.assertRaisesRegex(ValueError, 'SOURCE_BLOB_DRIFT'):
                m.verify_tracked_source(root, head, g)
            target.unlink()
            with self.assertRaises(FileNotFoundError):
                m.verify_tracked_source(root, head, g)
            target.write_bytes(files['main.txt'])
            (root / 'extra.txt').write_bytes(b'extra staged source\n')
            g('add', 'extra.txt')
            with self.assertRaisesRegex(ValueError, 'SOURCE_INDEX_DRIFT'):
                m.verify_tracked_source(root, head, g)
            g('reset', '-q', 'HEAD', '--', 'extra.txt')
            (root / 'extra.txt').unlink()
            self.assertEqual(m.verify_tracked_source(root, head, g), positive)

    def test_streaming_zero_byte_files_and_count_byte_bounds(self):
        with real_source_fixture() as (root, g, head, files):
            with patch.object(m, 'SOURCE_CHUNK_BYTES', 2):
                result = m.verify_tracked_source(root, head, g)
            self.assertEqual(result['bytes'], sum(map(len, files.values())))
            with patch.object(m, 'MAX_SOURCE_FILES', 1):
                with self.assertRaisesRegex(ValueError, 'SOURCE_FILE_COUNT'):
                    m.verify_tracked_source(root, head, g)
            with patch.object(m, 'MAX_SOURCE_BYTES', 1):
                with self.assertRaisesRegex(ValueError, 'SOURCE_REGULAR_FILE'):
                    m.verify_tracked_source(root, head, g)

    def test_real_hardlinked_source_refuses(self):
        with real_source_fixture() as (root, g, head, _):
            linked = root.parent / 'linked-source.txt'
            os.link(root / 'main.txt', linked)
            with self.assertRaisesRegex(ValueError, 'SOURCE_REGULAR_FILE'):
                m.verify_tracked_source(root, head, g)
            linked.unlink()
            self.assertEqual(m.verify_tracked_source(root, head, g)['files'], 3)

    def test_real_directory_link_and_lexical_root_alias_refuse(self):
        with real_source_fixture() as (root, g, head, files):
            actual = root / 'nested'
            saved = root / 'nested-original'
            outside = root.parent / 'redirected'
            outside.mkdir()
            (outside / 'leaf.txt').write_bytes(files['nested/leaf.txt'])
            def link(target, alias):
                if os.name == 'nt':
                    result = subprocess.run(['cmd', '/c', 'mklink', '/J', str(alias), str(target)],
                                            capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW)
                    self.assertEqual(result.returncode, 0, result.stderr)
                else:
                    os.symlink(target, alias, target_is_directory=True)
            def unlink(alias):
                os.rmdir(alias) if os.name == 'nt' else alias.unlink()
            actual.rename(saved)
            link(outside, actual)
            try:
                with self.assertRaisesRegex(ValueError, 'SOURCE_DIRECTORY'):
                    m.verify_tracked_source(root, head, g)
            finally:
                unlink(actual)
                saved.rename(actual)
            alias = root.parent / 'root-alias'
            link(root, alias)
            try:
                with self.assertRaisesRegex(ValueError, 'SOURCE_DIRECTORY'):
                    m.check_git_metadata(g, alias)
            finally:
                unlink(alias)

    def test_real_directory_substitution_between_lstat_and_open_refuses(self):
        with real_source_fixture() as (root, g, head, files):
            original_open = os.open
            changed = False
            def substitute(path, flags, *args, **kwargs):
                nonlocal changed
                if Path(path) == root / 'nested/leaf.txt' and not changed:
                    changed = True
                    (root / 'nested').rename(root / 'nested-before-swap')
                    (root / 'nested').mkdir()
                    (root / 'nested/leaf.txt').write_bytes(files['nested/leaf.txt'])
                return original_open(path, flags, *args, **kwargs)
            with patch.object(m.os, 'open', side_effect=substitute):
                with self.assertRaisesRegex(ValueError, 'SOURCE_OPEN_RACE'):
                    m.verify_tracked_source(root, head, g)
            self.assertTrue(changed)

    def test_unrelated_ancestor_sibling_churn_is_not_a_source_race(self):
        with real_source_fixture() as (root, g, head, _):
            original_open = os.open
            changed = False
            def sibling(path, flags, *args, **kwargs):
                nonlocal changed
                if Path(path) == root / 'main.txt' and not changed:
                    changed = True
                    (root.parent / 'unrelated-sibling').mkdir()
                return original_open(path, flags, *args, **kwargs)
            with patch.object(m.os, 'open', side_effect=sibling):
                self.assertEqual(m.verify_tracked_source(root, head, g)['files'], 3)
            self.assertTrue(changed)

    def test_real_file_mutation_during_stream_and_head_change_refuse(self):
        for change_head in [False, True]:
            with real_source_fixture() as (root, g, head, _):
                target = root / 'main.txt'
                inode = target.stat().st_ino
                original_read = os.read
                changed = False
                def mutate(descriptor, size):
                    nonlocal changed
                    chunk = original_read(descriptor, size)
                    info = os.fstat(descriptor)
                    if stat.S_ISREG(info.st_mode) and info.st_ino == inode and not changed:
                        changed = True
                        if change_head:
                            g('commit', '--allow-empty', '-qm', 'synthetic concurrent head change')
                        else:
                            target.write_bytes(target.read_bytes() + b'growth')
                    return chunk
                with patch.object(m.os, 'read', side_effect=mutate):
                    with self.assertRaisesRegex(ValueError, 'SOURCE_HEAD_RACE' if change_head else 'SOURCE_READ_'):
                        m.verify_tracked_source(root, head, g)
                self.assertTrue(changed)

    def test_every_original_ledger_field_and_row_is_preserved(self):
        original = m.document(m.git('show', m.SUBMITTED + ':' + m.DOC + 'CHANGE_LEDGER.json', root=m.ROOT))
        current = copy.deepcopy(original)
        current['closure02'] = {'authorization': m.CLOSURE_AUTH}
        m.check_original_ledger(current, original)
        for key in original:
            changed = copy.deepcopy(current)
            changed[key] = None
            with self.assertRaisesRegex(ValueError, 'ORIGINAL_LEDGER_DRIFT'):
                m.check_original_ledger(changed, original)
        for mutate in [lambda v: v['paths'][0].update(invariant='Different nonempty invariant'),
                       lambda v: v['paths'].reverse(), lambda v: v.update(undeclared_top_level=True)]:
            changed = copy.deepcopy(current)
            mutate(changed)
            with self.assertRaisesRegex(ValueError, 'ORIGINAL_LEDGER_DRIFT'):
                m.check_original_ledger(changed, original)


if __name__ == '__main__':
    unittest.main()
