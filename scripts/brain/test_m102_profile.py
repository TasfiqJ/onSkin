"""Synthetic M1-02 refusal tests; no fixture issues or accepts real work."""
import copy
import subprocess
import sys
import unittest

import brain
import m102_profile as profile
import test_brain
import test_m1_report_cli


class M102Report(unittest.TestCase):
    save = test_brain.InstalledControls.save
    command = test_m1_report_cli.M1ReportCLI.command
    commit = test_m1_report_cli.M1ReportCLI.commit
    add_execution = test_m1_report_cli.M1ReportCLI.add_execution
    checkpoint = 'docs/brain/checkpoints/M1-02/'
    name = checkpoint + 'synthetic-report.json'
    base = profile.BASE

    def setUp(self):
        test_m1_report_cli.M1ReportCLI.setUp(self)
        self.value['task_id'] = 'M1-02'
        self.value['scope_matrix'] = [dict(id=name, status='NOT_RUN', evidence=[]) for name in
            ['M102-TODAY', 'M102-CYCLE', 'M102-REPLAY', 'M102-DIARY', 'M102-REMIND',
             'M102-BOUNDARY', 'M102-CLAIMS-MONEY', 'M102-EVIDENCE']]

    def cli(self, value):
        self.save(self.name, value)
        return subprocess.run([sys.executable, '-B', str(brain.ROOT / 'scripts/brain/brain.py'),
            '--root', str(self.root), '--profile', 'M1-02', 'report', self.name],
            capture_output=True, text=True, encoding='utf-8')

    def test_valid_and_all_axis_evidence_refusals(self):
        result = self.cli(self.value)
        self.assertEqual(result.returncode, 0, result.stderr)
        for mutate in [
            lambda v: v.update(task_id='M1-03'),
            lambda v: v.update(branch='main'),
            lambda v: v.update(status='ACCEPTED'),
            lambda v: v.update(executions=[]),
            lambda v: v['axes'].update(physical_device='PASS'),
            lambda v: v['axes'].update(surface='PASS'),
            lambda v: v['scope_matrix'].append({'status': 'PASS', 'evidence': []}),
            lambda v: v['executions'][0].update(exit_code=True),
            lambda v: v['artifacts'][0].update(path='../outside.txt'),
        ]:
            value = copy.deepcopy(self.value)
            mutate(value)
            with self.subTest(value=value):
                self.assertNotEqual(self.cli(value).returncode, 0)
        (self.root / self.value['artifacts'][0]['path']).write_bytes(b'DRIFT')
        self.assertNotEqual(self.cli(self.value).returncode, 0)

    def test_immutable_issuance_successor_and_no_self_acceptance(self):
        for name in [profile.INPUT + '/TASK_MANIFEST.json',
                     profile.INPUT + '/TASK.md', profile.REVIEW + '/brain_state.json']:
            path = self.root / name
            original = path.read_bytes()
            path.write_bytes(original + b'\n')
            with self.subTest(name=name):
                self.assertNotEqual(self.cli(self.value).returncode, 0)
            path.write_bytes(original)
        original = brain.load(self.root, profile.ACTIVE)
        for patch in [dict(task_id='M1-03'), dict(submission_status='ACCEPTED'),
                      dict(main_promotion_authorized=True), dict(protected_source_go=True),
                      dict(accepted_tasks=['M0-01', 'M0-02', 'M1-01', 'M1-02']),
                      dict(active_writers=2), dict(incremental_spend_usd=1),
                      dict(proposal_expires_utc='2026-10-22T00:00:00Z')]:
            self.save(profile.ACTIVE, {**original, **patch})
            with self.subTest(patch=patch):
                self.assertNotEqual(self.cli(self.value).returncode, 0)
        self.save(profile.ACTIVE, original)
        self.runtime.write_bytes(b'Unmeasured implementation')
        self.assertNotEqual(self.cli(self.value).returncode, 0)

    def test_old_base_wrong_branch_and_evidence_tail(self):
        self.command('branch', '-m', 'main')
        self.assertNotEqual(self.cli(self.value).returncode, 0)
        self.command('branch', '-m', profile.BRANCH)
        self.value['measured'] = {'commit': '6aa01995f6dcb94fd28d358badc9f8d1e0273d39',
                                  'tree': '3a75ea56f12f9422affc6e09936993ffa9252c05'}
        self.assertNotEqual(self.cli(self.value).returncode, 0)
