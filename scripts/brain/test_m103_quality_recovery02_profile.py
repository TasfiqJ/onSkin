"""Exact QR02 grant attacks in disposable Git fixtures; admission NONE."""
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


class QualityRecovery02(unittest.TestCase):
    save = test_brain.InstalledControls.save
    command = common.M1ReportCLI.command
    commit = common.M1ReportCLI.commit
    add_execution = common.M1ReportCLI.add_execution
    checkpoint = p.QR02_INPUT.rsplit('/', 1)[0] + '/'
    name = checkpoint + 'synthetic-report.json'

    def setUp(self):
        test_brain.InstalledControls.setUp(self)
        self.command('init', '-q', '-b', p.BRANCH)
        fixture_history(self.root, brain.ROOT, p.QR02_BASE)
        paths = brain.git(self.root, 'diff', '--name-only', p.SC03_BASE, p.QR02_BASE).splitlines()
        paths += [r['path'] for r in brain.load(brain.ROOT, p.QR02_INPUT + '/SOURCE_EDIT_AUTHORIZATION.json')['allowed_existing_files']]
        paths += ['docs/phase-9/apple-ios-privacy-baseline.json']
        for name in set(paths):
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(subprocess.check_output(['git', '-C', str(self.root), 'show', p.QR02_BASE + ':' + name]))
        for name in [self.checkpoint.rstrip('/'), p.QR02_REVIEW]:
            shutil.copytree(brain.ROOT / name, self.root / name)
        frozen = '3dcaf50633024ec652fe7b14a5c9072eac92642e'
        brain.git_snapshot(brain.ROOT, dict(commit=frozen, tree='fd98eedb0cef6644d8e1538047aacbe44f10d837'), 'QR02 frozen fixture')
        for name, oid, sha256, size in [('docs/brain/m103-quality-recovery02-active.json', 'b3627c612b0ec20ff83daccf8d70a5d29903269e', '9449aa72f422ceab9f228d072630457f068dc65655e597b93e97b4723c5b5040', 1047), ('.gitattributes', '4df6bf56c6e79c84899654e20287919562e55fec', '58cc1493e2dd014812689be2685973a3a9150242b2bd1b45f50a174ea10e4c7b', 2129), ('scripts/brain/m103_profile.py', 'eed208833fb9fe672b6691233c4a8ef9f22003da', 'c9732ec5567dd610f0a39a43b3e9b3cb6774ae9de02b4678de2b8d3dba678c58', 54251)]:
            raw = subprocess.check_output(['git', '-C', str(brain.ROOT), 'show', frozen + ':' + name])
            brain.require(brain.git(brain.ROOT, 'rev-parse', frozen + ':' + name) == oid and
                brain.digest(raw) == sha256 and len(raw) == size, 'QR02 historical fixture bytes differ')
            (self.root / name).write_bytes(raw)
        names = subprocess.check_output(['git', '-C', str(self.root), 'ls-files', '-z'])
        subprocess.run(['git', '-C', str(self.root), 'update-index', '--skip-worktree', '-z', '--stdin'], input=names, check=True)
        indexed = set(names.decode().strip('\0').split('\0'))
        present = [f.relative_to(self.root).as_posix() for f in self.root.rglob('*')
                   if f.is_file() and '.git' not in f.parts and f.relative_to(self.root).as_posix() in indexed]
        subprocess.run(['git', '-C', str(self.root), 'update-index', '--no-skip-worktree', '-z', '--stdin'],
                       input=('\0'.join(present) + '\0').encode(), check=True)
        self.commit()
        self.measured = dict(commit=brain.git(self.root, 'rev-parse', 'HEAD'), tree=brain.git(self.root, 'rev-parse', 'HEAD^{tree}'))
        self.value = dict(schema_version=3, task_id='M1-03', iteration='QUALITY-RECOVERY-02', branch=p.BRANCH,
            status='BLOCKED', measured=self.measured, delivery_ref='refs/heads/' + p.BRANCH, executions=[], artifacts=[],
            scope_matrix=[dict(id=n, status='NOT_RUN', evidence=[]) for n in p.QR02_SCOPE], ci=[],
            axes=dict.fromkeys(['source', 'integration', 'surface', 'physical_device', 'live_provider',
                'qualified_review', 'clinical', 'commercial', 'release'], 'NOT_RUN'),
            blockers=['Synthetic fixture only'], context_health=dict(level='LOW'))
        self.add_execution('source', 'PASS', 0)
        self.save(self.name, self.value)
        self.commit()

    def test_exact_report_and_false_authority_refusals(self):
        p.report(self.root, self.name)
        current = brain.load(self.root, p.QR02_ACTIVE)
        for patch in [dict(branch='main'), dict(base_commit=p.QR_BASE), dict(base_tree='0'*40),
            dict(input_manifest_sha256=p.QR_DIGEST), dict(revision='ORIGINAL'),
            dict(protected_source_go=True), dict(main_promotion_authorized=True), dict(hosted_replay_authorized=True),
            dict(protected_security_db_admission='GO'), dict(active_writers=2), dict(active_writers=True),
            dict(proposal_expires_utc='2027-01-01T00:00:00Z'), dict(submission_status='ACCEPTED'),
            dict(accepted_tasks=current['accepted_tasks']+['M1-03']), dict(incremental_spend_usd=False)]:
            self.save(p.QR02_ACTIVE, {**current, **patch})
            with self.subTest(patch=patch), self.assertRaisesRegex(ValueError, 'QR02'):
                p.validate_quality_recovery02(self.root)
        self.save(p.QR02_ACTIVE, current)

    def test_wrong_actual_branch_and_old_head_refuse(self):
        self.command('branch', '-m', 'main')
        with self.assertRaises(ValueError): p.validate_quality_recovery02(self.root)
        self.command('branch', '-m', p.BRANCH)
        self.command('update-ref', 'HEAD', p.QR_BASE)
        with self.assertRaises(ValueError): p.validate_quality_recovery02(self.root)

    def test_old_interval_cannot_admit_new_paths(self):
        with self.assertRaises(ValueError): p.validate_quality_recovery01(self.root)
        with self.assertRaises(ValueError): p.validate_source_closure03(self.root)

    def test_input_review_and_stale_preimage_refuse(self):
        for name in [p.QR02_INPUT+'/SOURCE_EDIT_AUTHORIZATION.json', p.QR02_REVIEW+'/01_BRAIN_AUDIT.md']:
            target=self.root/name;raw=target.read_bytes();target.write_bytes(raw+b'tampered')
            with self.subTest(name=name), self.assertRaises(ValueError): p.validate_quality_recovery02(self.root)
            target.write_bytes(raw)
        original=subprocess.check_output
        def stale(argv,*args,**kwargs):
            data=original(argv,*args,**kwargs)
            return data+b'tampered' if argv[-1]==p.QR02_BASE+':package-lock.json' else data
        with mock.patch.object(subprocess,'check_output',side_effect=stale):
            with self.assertRaisesRegex(ValueError,'QR02 preimage'): p.validate_quality_recovery02(self.root)

    def test_unauthorized_source_and_intermediate_revert_refuse(self):
        name='apps/mobile/src/qr02-unauthorized.ts';target=self.root/name
        target.parent.mkdir(parents=True,exist_ok=True);target.write_text('synthetic attack\n');self.commit()
        with self.assertRaisesRegex(ValueError,'outside exact'): p.validate_quality_recovery02(self.root)
        target.unlink();self.commit()
        with self.assertRaisesRegex(ValueError,'outside exact|deletion'): p.validate_quality_recovery02(self.root)

    def test_widget_guard_hash_and_payload_path_changes_refuse(self):
        name='scripts/phase5/patch-expo-widgets-lifecycle.mjs';target=self.root/name;raw=target.read_bytes()
        for old,new in [(b'57.0.26',b'57.0.99'),(b'f9c61057350a4f42',b'0000000000000000'),
                        (b'MAX_SOURCE_BYTES = 256',b'MAX_SOURCE_BYTES = 999')]:
            target.write_bytes(raw.replace(old,new))
            with self.subTest(old=old), self.assertRaisesRegex(ValueError,'QR02 widget'): p.validate_quality_recovery02(self.root)
        target.write_bytes(raw)

    def test_fake_mapping_mobile_and_lock_changes_refuse(self):
        for name,old,new in [('docs/phase-9/ios-sdk-package-mapping.json',b'source_candidate',b'archive_verified'),
            ('apps/mobile/package.json',b'"react-native": "0.86.3"',b'"react-native": "0.99.0"'),
            ('package-lock.json',b'"name": "layerwell"',b'"name": "unissued"')]:
            target=self.root/name;raw=target.read_bytes();self.assertIn(old,raw);target.write_bytes(raw.replace(old,new))
            with self.subTest(name=name), self.assertRaisesRegex(ValueError,'QR02'): p.validate_quality_recovery02(self.root)
            target.write_bytes(raw)

    def test_report_false_go_and_artifact_tamper_refuse(self):
        for patch in [dict(status='ACCEPTED'),dict(iteration='QUALITY-RECOVERY-01'),
                      dict(axes={**self.value['axes'],'live_provider':'PASS'})]:
            self.save(self.name,{**self.value,**patch})
            with self.assertRaises(ValueError): p.report(self.root,self.name)
        self.save(self.name,self.value)
        target=self.root/self.value['artifacts'][0]['path'];target.write_bytes(target.read_bytes()+b'tampered')
        with self.assertRaises(ValueError): p.report(self.root,self.name)


if __name__ == '__main__': unittest.main()
