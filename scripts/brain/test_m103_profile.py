"""Disposable CLI/Git refusal fixtures; never a real approval or execution."""
import copy
import subprocess
import sys
import unittest

import brain
import m103_profile as profile
import test_brain
import test_m1_report_cli


class M103Report(unittest.TestCase):
    save = test_brain.InstalledControls.save
    command = test_m1_report_cli.M1ReportCLI.command
    commit = test_m1_report_cli.M1ReportCLI.commit
    add_execution = test_m1_report_cli.M1ReportCLI.add_execution
    checkpoint = 'docs/brain/checkpoints/M1-03/'
    name = checkpoint + 'synthetic-report.json'
    base = profile.BASE

    def setUp(self):
        test_m1_report_cli.M1ReportCLI.setUp(self)
        self.value['task_id'] = 'M1-03'
        self.value['scope_matrix'] = [dict(id=name, status='NOT_RUN', evidence=[])
                                      for name in profile.SCOPE]

    def cli(self, value):
        self.save(self.name, value)
        return subprocess.run([sys.executable, '-B', str(brain.ROOT / 'scripts/brain/brain.py'),
            '--root', str(self.root), '--profile', 'M1-03', 'report', self.name],
            capture_output=True, text=True, encoding='utf-8')

    def test_valid_and_false_evidence_refusals(self):
        result = self.cli(self.value)
        self.assertEqual(result.returncode, 0, result.stderr)
        for mutate in [
            lambda v: v.update(task_id='M1-04'),
            lambda v: v.update(branch='main'),
            lambda v: v.update(status='ACCEPTED'),
            lambda v: v.update(executions=[]),
            lambda v: v['axes'].update(physical_device='PASS'),
            lambda v: v['scope_matrix'][0].update(status='PASS'),
            lambda v: v['executions'][0].update(exit_code=True),
            lambda v: v['measured'].update(commit='0' * 40),
        ]:
            value = copy.deepcopy(self.value)
            mutate(value)
            with self.subTest(value=value):
                self.assertNotEqual(self.cli(value).returncode, 0)
        output = self.root / (self.checkpoint + 'source.txt')
        output.write_bytes(b'Forged output')
        self.assertNotEqual(self.cli(self.value).returncode, 0)

    def test_independent_inputs_and_authority_refusals(self):
        for name in [profile.INPUT + '/TASK_MANIFEST.json', profile.INPUT + '/TASK.md',
                     profile.REVIEW + '/brain_state.json']:
            path = self.root / name
            original = path.read_bytes()
            path.write_bytes(original + b'\n')
            self.assertNotEqual(self.cli(self.value).returncode, 0)
            path.write_bytes(original)
        original = brain.load(self.root, profile.ACTIVE)
        for patch in [dict(task_id='M2-01'), dict(base_commit='0' * 40),
                      dict(submission_status='ACCEPTED'), dict(main_promotion_authorized=True),
                      dict(protected_source_go=True), dict(active_writers=2),
                      dict(incremental_spend_usd=1), dict(accepted_tasks=['M1-03']),
                      dict(proposal_expires_utc='2026-10-22T00:00:00Z')]:
            self.save(profile.ACTIVE, {**original, **patch})
            with self.subTest(patch=patch):
                self.assertNotEqual(self.cli(self.value).returncode, 0)

    def test_wrong_branch_old_base_and_unmeasured_source(self):
        self.command('branch', '-m', 'main')
        self.assertNotEqual(self.cli(self.value).returncode, 0)
        self.command('branch', '-m', profile.BRANCH)
        value = copy.deepcopy(self.value)
        value['measured'] = dict(commit='31307694ebb9895ed8cfb77fa6ac532b789d2810',
                                tree='c52f49d6f3dfa8cdee98d4a26c707ad8747576d0')
        self.assertNotEqual(self.cli(value).returncode, 0)
        self.runtime.write_bytes(b'Unmeasured implementation')
        self.assertNotEqual(self.cli(self.value).returncode, 0)
