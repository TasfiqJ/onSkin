"""Negative controls for C46 technical source checker, never admission evidence."""
import copy
import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('source46', Path(__file__).with_name('source_completion46.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


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


if __name__ == '__main__':
    unittest.main()
