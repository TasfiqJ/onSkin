"""Real CLI/Git adversarial fixtures. Synthetic claims never authorize a task."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import unittest

import brain
import m1_profile
import test_brain


class M1ReportCLI(unittest.TestCase):
    save = test_brain.InstalledControls.save
    name = 'docs/brain/checkpoints/M1-01/CONT-01/synthetic-report.json'

    def setUp(self):
        test_brain.InstalledControls.setUp(self)
        self.command('init', '-q', '-b', m1_profile.BRANCH)
        common = Path(brain.git(brain.ROOT, 'rev-parse', '--path-format=absolute', '--git-common-dir')) / 'objects'
        alternate = self.root / '.git/objects/info/alternates'
        alternate.parent.mkdir(parents=True, exist_ok=True)
        alternate.write_bytes((common.as_posix() + '\n').encode('utf-8'))
        self.command('update-ref', 'HEAD', m1_profile.CONT02_BASE)
        self.runtime = self.root / 'apps/mobile/src/synthetic.ts'
        self.runtime.parent.mkdir(parents=True, exist_ok=True)
        self.runtime.write_text('export const fixture = 1;\n', encoding='utf-8')
        self.commit()
        self.measured = {'commit': brain.git(self.root, 'rev-parse', 'HEAD'),
                         'tree': brain.git(self.root, 'rev-parse', 'HEAD^{tree}')}
        self.value = {'schema_version': 2, 'task_id': 'M1-01', 'branch': m1_profile.BRANCH,
                      'status': 'PARTIAL', 'measured': self.measured, 'delivery_ref': 'refs/heads/' + m1_profile.BRANCH,
                      'executions': [], 'artifacts': [], 'scope_matrix': [], 'ci': [],
                      'axes': dict.fromkeys(['source', 'integration', 'surface', 'physical_device', 'live_provider',
                                            'qualified_review', 'clinical', 'commercial', 'release'], 'NOT_RUN'),
                      'blockers': ['Synthetic fixture only'], 'context_health': {'level': 'LOW'}}
        self.add_execution('source', 'PASS', 0)
        self.value['axes']['source'] = 'PASS'

    def command(self, *args):
        result = subprocess.run(['git', '-C', str(self.root), *args], capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr.decode('utf-8', errors='replace'))
        return result

    def commit(self):
        self.command('add', '.')
        self.command('-c', 'user.name=Synthetic Fixture', '-c', 'user.email=fixture@example.invalid',
                     '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Synthetic M1 validator fixture only')

    def add_execution(self, axis, status, exit_code):
        prefix = 'docs/brain/checkpoints/M1-01/CONT-01/' + axis
        output = prefix + '.txt'
        (self.root / output).write_text('Synthetic fixture only; not a real execution claim.\n', encoding='utf-8')
        receipt = dict(schema_version=1, kind='LOCAL_EXECUTION', claim_origin='CODEX_REPORTED_EXECUTION',
                       command='synthetic fixture', working_directory='synthetic', environment='synthetic',
                       source_commit=self.measured['commit'], source_tree=self.measured['tree'],
                       status=status, exit_code=exit_code,
                       output={'path': output, 'sha256': brain.digest(brain.read(self.root, output))},
                       counts={'passed': int(status == 'PASS'), 'failed': int(status == 'FAIL'), 'skipped': 0})
        path = prefix + '.receipt.json'
        self.save(path, receipt)
        self.value['executions'].append({**{k: receipt[k] for k in ['command', 'working_directory', 'environment', 'source_commit', 'source_tree', 'status', 'exit_code']},
            'id': axis, 'axis': axis, 'admission': 'NONE', 'evidence_class': 'INDEPENDENTLY_REPRODUCED',
            'artifact': path, 'sha256': brain.digest(brain.read(self.root, path))})
        for name in [output, path]:
            self.value['artifacts'].append({'path': name, 'sha256': brain.digest(brain.read(self.root, name))})

    def cli(self, value):
        self.save(self.name, value)
        return subprocess.run([sys.executable, '-B', str(brain.ROOT / 'scripts/brain/brain.py'),
            '--root', str(self.root), '--profile', 'M1-01', 'report', self.name], capture_output=True, text=True, encoding='utf-8')

    def test_positive_partial_and_failure_then_evidence_and_type_attacks(self):
        result = self.cli(self.value)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.add_execution('surface', 'FAIL', 1)
        self.value['axes']['surface'] = 'FAIL'
        self.assertEqual(self.cli(self.value).returncode, 0)
        mutations = [
            lambda v: v.update(executions=[], artifacts=[]),
            lambda v: v['artifacts'].pop(),
            lambda v: v['artifacts'].pop(0),
            lambda v: v['executions'][0].update(exit_code=True),
            lambda v: v['axes'].update(surface='PASS'),
            lambda v: v['axes'].update(integration='PASS'),
            lambda v: v['axes'].update(source='probably good'),
            lambda v: v['executions'].append(copy.deepcopy(v['executions'][0])),
            lambda v: v['artifacts'].append(copy.deepcopy(v['artifacts'][0])),
            lambda v: v['scope_matrix'].append({'status': 'PASS', 'evidence': []}),
        ]
        for mutate in mutations:
            value = copy.deepcopy(self.value)
            mutate(value)
            with self.subTest(mutation=mutate):
                self.assertNotEqual(self.cli(value).returncode, 0)
        output = self.root / self.value['artifacts'][0]['path']
        output.write_bytes(output.read_bytes() + b'DRIFT')
        self.assertNotEqual(self.cli(self.value).returncode, 0)

    def test_cont02_report_binds_iteration_location_and_reviewed_base(self):
        self.name = 'docs/brain/checkpoints/M1-01/CONT-02/synthetic-report.json'
        self.value.update(schema_version=3, iteration='CONT-02')
        result = self.cli(self.value)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.value['iteration'] = 'CONT-03'
        self.assertNotEqual(self.cli(self.value).returncode, 0)
        self.value['iteration'] = 'CONT-02'
        self.name = 'docs/brain/checkpoints/M1-01/CONT-01/synthetic-report.json'
        self.assertNotEqual(self.cli(self.value).returncode, 0)

    def test_cont03_report_binds_exact_issued_base_and_location(self):
        # Move only this disposable fixture to the independently issued base.
        self.command('update-ref', 'HEAD', m1_profile.CONT03_BASE)
        self.commit()
        self.measured = {'commit': brain.git(self.root, 'rev-parse', 'HEAD'),
                         'tree': brain.git(self.root, 'rev-parse', 'HEAD^{tree}')}
        self.value.update(schema_version=3, iteration='CONT-03', measured=self.measured)
        self.value.update(executions=[], artifacts=[])
        self.add_execution('source', 'PASS', 0)
        self.name = 'docs/brain/checkpoints/M1-01/CONT-03/synthetic-report.json'
        result = self.cli(self.value)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.name = 'docs/brain/checkpoints/M1-01/CONT-02/synthetic-report.json'
        self.assertNotEqual(self.cli(self.value).returncode, 0)
        self.name = 'docs/brain/checkpoints/M1-01/CONT-03/synthetic-report.json'
        self.value['measured'] = {'commit': m1_profile.CONT02_BASE,
                                 'tree': brain.git(self.root, 'rev-parse', m1_profile.CONT02_BASE + '^{tree}')}
        self.assertNotEqual(self.cli(self.value).returncode, 0)

    def test_future_execution_and_dirty_untracked_committed_runtime_drift(self):
        self.assertEqual(self.cli(self.value).returncode, 0)
        self.runtime.write_text('export const fixture = 2;\n', encoding='utf-8')
        self.assertNotEqual(self.cli(self.value).returncode, 0)
        self.commit()
        self.assertNotEqual(self.cli(self.value).returncode, 0)
        # Evidence measured at the older source cannot contain a newer test run.
        newer = copy.deepcopy(self.value)
        newer['measured'] = {'commit': m1_profile.BASE, 'tree': m1_profile.TREE}
        result = self.cli(newer)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('execution -> measured', result.stderr)
        self.value['measured'] = {'commit': brain.git(self.root, 'rev-parse', 'HEAD'),
                                  'tree': brain.git(self.root, 'rev-parse', 'HEAD^{tree}')}
        self.value['axes']['source'] = 'PARTIAL_TESTED_NOT_COMPLETE'
        self.assertEqual(self.cli(self.value).returncode, 0)
        (self.runtime.parent / 'untracked.ts').write_text('unmeasured', encoding='utf-8')
        self.assertNotEqual(self.cli(self.value).returncode, 0)

    def test_ci_exact_head_run_workflow_and_pending_semantics(self):
        path = 'docs/brain/checkpoints/M1-01/CONT-01/synthetic-ci.json'
        row = dict(repository='TasfiqJ/onSkin', head_commit=self.measured['commit'], name='Synthetic workflow',
                   workflow_id=123, run_id=456, status='in_progress', conclusion='pending', artifact=path)
        observation = dict(schema_version=1, kind='CI_OBSERVATION', evidence_class='INDEPENDENTLY_OBSERVED',
            claim_origin='CODEX_OBSERVED_PROVIDER_METADATA', recorded_at_utc='2026-10-20T15:00:00Z',
            repository='TasfiqJ/onSkin', runs=[{k: v for k, v in row.items() if k not in ['repository', 'artifact']}])
        self.save(path, observation)
        self.value['artifacts'].append({'path': path, 'sha256': brain.digest(brain.read(self.root, path))})
        self.value['ci'] = [row]
        self.assertEqual(self.cli(self.value).returncode, 0)
        for patch in [dict(conclusion='success'), dict(run_id=457), dict(workflow_id=124), dict(head_commit=m1_profile.BASE)]:
            value = copy.deepcopy(self.value)
            value['ci'][0].update(patch)
            self.assertNotEqual(self.cli(value).returncode, 0)


if __name__ == '__main__':
    unittest.main()
