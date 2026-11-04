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


if __name__ == '__main__':
    unittest.main()
