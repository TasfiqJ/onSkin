"""Exact Quality grant attacks in disposable repositories; admission is NONE."""
import copy
import shutil
import subprocess
import sys
import unittest
from unittest import mock

import brain
import m103_profile as p
import test_brain
import test_m1_report_cli as common

sys.path.insert(0, str(brain.ROOT / 'scripts/security_readiness/m103'))
from history_custody import fixture_history


class QualityRecovery(unittest.TestCase):
    save = test_brain.InstalledControls.save
    command = common.M1ReportCLI.command
    commit = common.M1ReportCLI.commit
    add_execution = common.M1ReportCLI.add_execution
    checkpoint = p.QR_INPUT.rsplit('/', 1)[0] + '/'
    name = checkpoint + 'synthetic-report.json'

    def setUp(self):
        test_brain.InstalledControls.setUp(self)
        self.command('init', '-q', '-b', p.BRANCH)
        fixture_history(self.root, brain.ROOT, p.QR_BASE)
        # The fixed SC03 interval is nonempty and validates regular source files.
        # Materialize its authentic endpoint bytes without inventing history.
        for name in brain.git(self.root, 'diff', '--name-only', p.SC03_BASE, p.QR_BASE).splitlines():
            target = self.root / name
            if not target.exists():
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(subprocess.check_output(['git', '-C', str(self.root),
                                   'show', p.QR_BASE + ':' + name]))
        for name in [self.checkpoint.rstrip('/'), p.QR_REVIEW]:
            shutil.copytree(brain.ROOT / name, self.root / name)
        shutil.copyfile(brain.ROOT / p.QR_ACTIVE, self.root / p.QR_ACTIVE)
        names = subprocess.check_output(['git', '-C', str(self.root), 'ls-files', '-z'])
        subprocess.run(['git', '-C', str(self.root), 'update-index', '--skip-worktree', '-z', '--stdin'],
                       input=names, check=True)
        indexed = set(names.decode().strip('\0').split('\0'))
        present = [f.relative_to(self.root).as_posix() for f in (self.root / 'docs').rglob('*')
                   if f.is_file() and f.relative_to(self.root).as_posix() in indexed]
        subprocess.run(['git', '-C', str(self.root), 'update-index', '--no-skip-worktree', '-z', '--stdin'],
                       input=('\0'.join(present) + '\0').encode(), check=True)
        self.commit()
        self.measured = dict(commit=brain.git(self.root, 'rev-parse', 'HEAD'),
                             tree=brain.git(self.root, 'rev-parse', 'HEAD^{tree}'))
        self.value = dict(schema_version=3, task_id='M1-03', iteration='QUALITY-RECOVERY-01',
            branch=p.BRANCH, status='BLOCKED', measured=self.measured, delivery_ref='refs/heads/' + p.BRANCH,
            executions=[], artifacts=[], scope_matrix=[dict(id=n, status='NOT_RUN', evidence=[]) for n in p.QR_SCOPE],
            ci=[], axes=dict.fromkeys(['source', 'integration', 'surface', 'physical_device', 'live_provider',
            'qualified_review', 'clinical', 'commercial', 'release'], 'NOT_RUN'),
            blockers=['Synthetic fixture only'], context_health=dict(level='LOW'))
        self.add_execution('source', 'PASS', 0)
        self.save(self.name, self.value)
        self.commit()

    def test_exact_report_and_authority_refusals(self):
        p.report(self.root, self.name)
        current = brain.load(self.root, p.QR_ACTIVE)
        for patch in [dict(branch='main'), dict(base_commit='0' * 40), dict(base_tree='0' * 40),
            dict(authorization_id='M103-SC03-CLOUD-RUNTIME-RECOVERY-01'), dict(input_manifest_sha256='0' * 64),
            dict(accepted_tasks=current['accepted_tasks'] + ['M1-03']), dict(submission_status='ACCEPTED'),
            dict(protected_source_go=True), dict(protected_security_db_admission='GO'),
            dict(hosted_replay_authorized=True), dict(main_promotion_authorized=True),
            dict(release_or_m2_authorized=True), dict(proposal_expires_utc='2026-11-01T00:00:00Z'),
            dict(active_writers=True), dict(incremental_spend_usd=False), dict(source_edit_union_permitted=True)]:
            self.save(p.QR_ACTIVE, {**current, **patch})
            with self.subTest(patch=patch), self.assertRaisesRegex(ValueError, 'Quality'):
                p.validate_quality_recovery01(self.root)
        self.save(p.QR_ACTIVE, current)

    def test_immutable_input_review_and_preimage_tampering(self):
        for name in [p.QR_INPUT + '/SOURCE_EDIT_AUTHORIZATION.json', p.QR_INPUT + '/TASK_MANIFEST.json',
                     p.QR_REVIEW + '/01_BRAIN_AUDIT.md', p.QR_REVIEW + '/external-digest-proof.json']:
            target = self.root / name
            raw = target.read_bytes()
            target.write_bytes(raw + b'tampered')
            with self.subTest(name=name), self.assertRaises(ValueError):
                p.validate_quality_recovery01(self.root)
            target.write_bytes(raw)
        original = subprocess.check_output
        def wrong_preimage(argv, *args, **kw):
            data = original(argv, *args, **kw)
            return data + b'tampered' if argv[-1] == p.QR_BASE + ':package.json' else data
        with mock.patch.object(subprocess, 'check_output', side_effect=wrong_preimage):
            with self.assertRaisesRegex(ValueError, 'Quality preimage mismatch'):
                p.validate_quality_recovery01(self.root)

    def test_wrong_actual_branch_and_head(self):
        self.command('branch', '-m', 'main')
        with self.assertRaises(ValueError):
            p.validate_quality_recovery01(self.root)
        self.command('branch', '-m', p.BRANCH)
        self.command('update-ref', 'HEAD', p.SC03_BASE)
        with self.assertRaises(ValueError):
            p.validate_quality_recovery01(self.root)

    def test_prior_grants_extra_edits_and_intermediate_revert_refuse(self):
        with self.assertRaises(ValueError):
            p.validate_source_closure03(self.root)
        target = self.root / 'scripts/security_readiness/m103/unauthorized.py'
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text('inert synthetic attack\n')
        self.commit()
        with self.assertRaisesRegex(ValueError, 'outside exact'):
            p.validate_quality_recovery01(self.root)
        target.unlink()
        self.commit()
        with self.assertRaisesRegex(ValueError, 'outside exact|deletion refused'):
            p.validate_quality_recovery01(self.root)

    def test_mobile_edit_scope_and_global_newline_changes_refuse(self):
        for name in ['apps/mobile/package.json', '.gitattributes']:
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            raw = subprocess.check_output(['git', '-C', str(self.root), 'show', p.QR_BASE + ':' + name])
            target.write_bytes(raw)
            self.command('update-index', '--no-skip-worktree', name)
            if name.endswith('package.json'):
                value = brain.decode(raw)
                value['dependencies']['react-native'] = '999.0.0'
                self.save(name, value)
            else:
                target.write_bytes(raw.replace(b'eol=lf', b'eol=crlf'))
            with self.assertRaisesRegex(ValueError, 'Quality mobile|Quality attributes'):
                p.validate_quality_recovery01(self.root)
            target.unlink()
            self.command('update-index', '--skip-worktree', name)

    def test_false_report_and_uncommitted_evidence_refuse(self):
        for patch in [dict(status='ACCEPTED'), dict(iteration='SOURCE-CLOSURE-03'),
                      dict(axes={**self.value['axes'], 'live_provider': 'PASS'})]:
            self.save(self.name, {**self.value, **patch})
            with self.assertRaises(ValueError):
                p.report(self.root, self.name)
        self.save(self.name, self.value)
        value = copy.deepcopy(self.value)
        value['executions'][0]['exit_code'] = True
        self.save(self.name, value)
        with self.assertRaises(ValueError):
            p.report(self.root, self.name)
        self.save(self.name, self.value)
        target = self.root / self.value['artifacts'][0]['path']
        target.write_bytes(target.read_bytes() + b'altered evidence')
        with self.assertRaises(ValueError):
            p.report(self.root, self.name)


if __name__ == '__main__':
    unittest.main()
