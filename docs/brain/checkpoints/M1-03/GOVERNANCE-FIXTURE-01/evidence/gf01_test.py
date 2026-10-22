"""GF01 exact disjoint custody attacks; every repository and claim is disposable."""
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


class GovernanceFixture01(unittest.TestCase):
    save = test_brain.InstalledControls.save
    command = common.M1ReportCLI.command
    commit = common.M1ReportCLI.commit
    add_execution = common.M1ReportCLI.add_execution
    checkpoint = p.GF01_INPUT.rsplit('/', 1)[0] + '/'
    name = checkpoint + 'synthetic-report.json'

    def setUp(self):
        test_brain.InstalledControls.setUp(self)
        self.command('init', '-q', '-b', p.BRANCH)
        fixture_history(self.root, brain.ROOT, p.GF01_BASE)
        authority = brain.load(brain.ROOT, p.GF01_INPUT + '/SOURCE_EDIT_AUTHORIZATION.json')
        paths = brain.git(self.root, 'diff', '--name-only', p.SC03_BASE, p.GF01_BASE).splitlines()
        paths += [row['path'] for key in ['allowed_existing_files', 'protected_unchanged'] for row in authority[key]]
        paths += ['docs/phase-9/apple-ios-privacy-baseline.json']
        for name in set(paths):
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(subprocess.check_output(['git', '-C', str(self.root), 'show', p.GF01_BASE + ':' + name]))
        for name in [p.GF01_INPUT, p.GF01_REVIEW]:
            shutil.copytree(brain.ROOT / name, self.root / name)
        for name in [p.GF01_ACTIVE, '.gitattributes', 'scripts/brain/m103_profile.py',
                'scripts/brain/test_m103_quality_recovery02_profile.py',
                'scripts/brain/test_m103_quality_recovery03_profile.py',
                'scripts/brain/test_m103_governance_fixture01_profile.py']:
            shutil.copyfile(brain.ROOT / name, self.root / name)
        names = subprocess.check_output(['git', '-C', str(self.root), 'ls-files', '-z'])
        subprocess.run(['git', '-C', str(self.root), 'update-index', '--skip-worktree', '-z', '--stdin'], input=names, check=True)
        indexed = set(names.decode().strip('\0').split('\0'))
        present = [f.relative_to(self.root).as_posix() for f in self.root.rglob('*')
                   if f.is_file() and '.git' not in f.parts and f.relative_to(self.root).as_posix() in indexed]
        subprocess.run(['git', '-C', str(self.root), 'update-index', '--no-skip-worktree', '-z', '--stdin'],
                       input=('\0'.join(present) + '\0').encode(), check=True)
        self.commit()
        self.measured = dict(commit=brain.git(self.root, 'rev-parse', 'HEAD'), tree=brain.git(self.root, 'rev-parse', 'HEAD^{tree}'))
        self.value = dict(schema_version=3, task_id='M1-03', iteration='GOVERNANCE-FIXTURE-01', branch=p.BRANCH,
            status='BLOCKED', measured=self.measured, delivery_ref='refs/heads/' + p.BRANCH, executions=[], artifacts=[],
            scope_matrix=[dict(id=n, status='NOT_RUN', evidence=[]) for n in p.GF01_SCOPE], ci=[],
            axes=dict.fromkeys(['source', 'integration', 'surface', 'physical_device', 'live_provider',
                'qualified_review', 'clinical', 'commercial', 'release'], 'NOT_RUN'),
            blockers=['Synthetic fixture only'], context_health=dict(level='LOW'))
        self.add_execution('source', 'PASS', 0)
        self.save(self.name, self.value)
        self.commit()

    def test_exact_report_and_predecessor_default_refusals(self):
        p.report(self.root, self.name)
        for validator in [p.validate_quality_recovery03, p.validate_quality_recovery02,
                p.validate_quality_recovery01, p.validate_source_closure03]:
            with self.subTest(validator=validator.__name__), self.assertRaises(ValueError):
                validator(self.root)

    def test_false_go_expiry_extra_task_and_typed_authority_refuse(self):
        current = brain.load(self.root, p.GF01_ACTIVE)
        for patch in [dict(branch='main'), dict(base_commit=p.QR03_BASE), dict(base_tree='0'*40),
                dict(input_manifest_sha256=p.QR03_DIGEST), dict(active_writers=2), dict(active_writers=True),
                dict(protected_source_go=True), dict(main_promotion_authorized=True), dict(hosted_replay_authorized=True),
                dict(clinical_research_or_release_authorized=True), dict(source_edit_union_permitted=True),
                dict(protected_security_and_db_admission='GO'), dict(prior_reviews_mutable=True),
                dict(original_security_proposal_expires_utc='2027-01-01T00:00:00Z'),
                dict(accepted_tasks=current['accepted_tasks']+['M1-03']), dict(next_task='M2-01'),
                dict(submission_status='ACCEPTED'), dict(incremental_spend_usd=False),
                dict(roadmap_tasks_count=48), dict(module_identities_count=28), dict(prior_adr_count=52)]:
            self.save(p.GF01_ACTIVE, {**current, **patch})
            with self.subTest(patch=patch), self.assertRaisesRegex(ValueError, 'GF01'):
                p.validate_governance_fixture01(self.root)
        self.save(p.GF01_ACTIVE, current)

    def test_wrong_actual_branch_and_preissuance_head_refuse(self):
        self.command('branch', '-m', 'main')
        with self.assertRaisesRegex(ValueError, 'GF01 branch'): p.validate_governance_fixture01(self.root)
        self.command('branch', '-m', p.BRANCH)
        self.command('update-ref', 'HEAD', p.QR03_BASE)
        with self.assertRaisesRegex(ValueError, 'GF01 base -> head'): p.validate_governance_fixture01(self.root)

    def test_immutable_issuance_and_review_tampering_refuse(self):
        for folder in [p.GF01_INPUT, p.GF01_REVIEW]:
            for file in ['TASK_MANIFEST.json', 'SOURCE_EDIT_AUTHORIZATION.json', 'FROZEN_FIXTURE_WITNESSES.json', '01_BRAIN_REVIEW.md']:
                target = self.root / folder / file
                raw = target.read_bytes(); target.write_bytes(raw + b'tampered')
                with self.subTest(folder=folder, file=file), self.assertRaisesRegex(ValueError, 'GF01'):
                    p.validate_governance_fixture01(self.root)
                target.write_bytes(raw)

    def test_tampered_and_missing_authentic_historical_objects_refuse(self):
        original = subprocess.check_output
        for label, (commit, _, rows) in p.GF01_FROZEN.items():
            for path, _, _, _ in rows:
                def tamper(argv, *args, **kwargs):
                    raw = original(argv, *args, **kwargs)
                    return raw + b'tampered' if argv[-2:] == ['show', commit + ':' + path] else raw
                with self.subTest(label=label, path=path), mock.patch.object(subprocess, 'check_output', side_effect=tamper):
                    with self.assertRaisesRegex(ValueError, 'historical fixture bytes differ'):
                        p.gf01_frozen_bytes(self.root, label, path)
        def missing(argv, *args, **kwargs):
            if argv[-2:] == ['show', p.GF01_BASE + ':scripts/brain/m103_profile.py']:
                raise subprocess.CalledProcessError(128, argv, stderr=b'missing historical object')
            return original(argv, *args, **kwargs)
        with mock.patch.object(subprocess, 'check_output', side_effect=missing):
            with self.assertRaises(subprocess.CalledProcessError):
                p.gf01_frozen_bytes(self.root, 'QR03', 'scripts/brain/m103_profile.py')

    def test_later_qr03_marker_contamination_refuses_qr02_fixture(self):
        later = p.gf01_frozen_bytes(self.root, 'QR03', '.gitattributes')
        self.assertIn(b'QUALITY-RECOVERY-03', later)
        self.assertNotIn(b'QUALITY-RECOVERY-03', p.gf01_frozen_bytes(self.root, 'QR02', '.gitattributes'))
        original = subprocess.check_output
        def contaminate(argv, *args, **kwargs):
            if argv[-2:] == ['show', p.QR03_BASE + ':.gitattributes']: return later
            return original(argv, *args, **kwargs)
        with mock.patch.object(subprocess, 'check_output', side_effect=contaminate):
            with self.assertRaisesRegex(ValueError, 'QR02 historical fixture bytes differ'):
                p.gf01_frozen_bytes(self.root, 'QR02', '.gitattributes')

    def test_out_of_scope_intermediate_and_reverted_commit_refuse(self):
        target = self.root / 'scripts/brain/unissued-gf01.py'
        target.write_bytes(b'# synthetic unauthorized change\n'); self.commit()
        with self.assertRaisesRegex(ValueError, 'outside exact'): p.validate_governance_fixture01(self.root)
        target.unlink(); self.commit()
        with self.assertRaisesRegex(ValueError, 'outside exact|deletion'): p.validate_governance_fixture01(self.root)

    def test_original_test_body_and_fixture_endpoint_drift_refuse(self):
        for label in ['02', '03']:
            target = self.root / ('scripts/brain/test_m103_quality_recovery' + label + '_profile.py')
            raw = target.read_bytes()
            for old, new in [(b"dict(status='ACCEPTED')", b"dict(status='BLOCKED')"),
                    (b"        frozen = '", b"        frozen = '0")]:
                self.assertIn(old, raw); target.write_bytes(raw.replace(old, new, 1))
                with self.subTest(label=label, old=old), self.assertRaisesRegex(ValueError, 'setUp-only'):
                    p.validate_governance_fixture01(self.root)
                target.write_bytes(raw)
        target.write_bytes(raw.replace(b"dict(status='ACCEPTED')", b"dict(status='BLOCKED')", 1)); self.commit()
        with self.assertRaisesRegex(ValueError, 'setUp-only|intermediate restricted'):
            p.validate_governance_fixture01(self.root)
        target.write_bytes(raw); self.commit()
        with self.assertRaisesRegex(ValueError, 'intermediate restricted'):
            p.validate_governance_fixture01(self.root)

    def test_protected_source_and_historical_governance_prefix_drift_refuse(self):
        for path in ['package.json', p.QR03_ACTIVE, 'scripts/brain/m103_profile.py']:
            target = self.root / path; raw = target.read_bytes()
            target.write_bytes(b'# unissued historical edit\n' + raw)
            with self.subTest(path=path), self.assertRaisesRegex(ValueError, 'GF01'):
                p.validate_governance_fixture01(self.root)
            target.write_bytes(raw)

    def test_report_forgery_missing_checks_and_artifact_tamper_refuse(self):
        for patch in [dict(status='ACCEPTED'), dict(iteration='QUALITY-RECOVERY-03'),
                dict(axes={**self.value['axes'], 'clinical':'PASS'}), dict(status='SUBMITTED_REVIEW_REQUIRED')]:
            self.save(self.name, {**self.value, **patch})
            with self.subTest(patch=patch), self.assertRaises(ValueError): p.report(self.root, self.name)
        self.save(self.name, self.value)
        target = self.root / self.value['artifacts'][0]['path']; raw = target.read_bytes()
        target.write_bytes(raw + b'tampered')
        with self.assertRaises(ValueError): p.report(self.root, self.name)


if __name__ == '__main__': unittest.main()
