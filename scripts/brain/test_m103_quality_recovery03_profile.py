"""QR03 exact-source and report attacks in disposable repositories; no admission."""
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


class QualityRecovery03(unittest.TestCase):
    save = test_brain.InstalledControls.save
    command = common.M1ReportCLI.command
    commit = common.M1ReportCLI.commit
    add_execution = common.M1ReportCLI.add_execution
    checkpoint = p.QR03_INPUT.rsplit('/', 1)[0] + '/'
    name = checkpoint + 'synthetic-report.json'

    def setUp(self):
        test_brain.InstalledControls.setUp(self)
        self.command('init', '-q', '-b', p.BRANCH)
        fixture_history(self.root, brain.ROOT, p.QR03_BASE)
        paths = brain.git(self.root, 'diff', '--name-only', p.SC03_BASE, p.QR03_BASE).splitlines()
        paths += [r['path'] for r in brain.load(brain.ROOT, p.QR03_INPUT + '/SOURCE_EDIT_AUTHORIZATION.json')['allowed_existing_files']]
        paths += ['docs/phase-9/apple-ios-privacy-baseline.json']
        for name in set(paths):
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(subprocess.check_output(['git', '-C', str(self.root), 'show', p.QR03_BASE + ':' + name]))
        for name in [self.checkpoint.rstrip('/'), p.QR03_REVIEW]:
            shutil.copytree(brain.ROOT / name, self.root / name)
        frozen = 'dbcfce9770850d4655221bd3d4c3b5799553aed2'
        brain.git_snapshot(brain.ROOT, dict(commit=frozen, tree='93d9a5789c1ce443cf0bcd86696fff044ff2fd64'), 'QR03 frozen fixture')
        for name, oid, sha256, size in [('docs/brain/m103-quality-recovery03-active.json', '1bfeaad1a9b32a472d77e11a52981d5ed6480f99', '7b10de99c1472a9cbd9260b915e3432ba10bec8d36c9fdaacf9475a764491413', 961), ('.gitattributes', 'c06492f174db13630da9f8deb043a890d8d313f0', '0989b8860a3146dafc0821f6ffd18caa27c87c53bd25dbbd3819ca78991d52be', 2313), ('scripts/brain/m103_profile.py', '7024ccaf09c0c64362fa4b185f59ff29c24aa878', '8661c05110c04503154eca169be6a99f9c15d1ba0e0b4686d5263f674b4acf0c', 67627)]:
            raw = subprocess.check_output(['git', '-C', str(brain.ROOT), 'show', frozen + ':' + name])
            brain.require(brain.git(brain.ROOT, 'rev-parse', frozen + ':' + name) == oid and
                brain.digest(raw) == sha256 and len(raw) == size, 'QR03 historical fixture bytes differ')
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
        self.value = dict(schema_version=3, task_id='M1-03', iteration='QUALITY-RECOVERY-03', branch=p.BRANCH,
            status='BLOCKED', measured=self.measured, delivery_ref='refs/heads/' + p.BRANCH, executions=[], artifacts=[],
            scope_matrix=[dict(id=n, status='NOT_RUN', evidence=[]) for n in p.QR03_SCOPE], ci=[],
            axes=dict.fromkeys(['source', 'integration', 'surface', 'physical_device', 'live_provider',
                'qualified_review', 'clinical', 'commercial', 'release'], 'NOT_RUN'),
            blockers=['Synthetic fixture only'], context_health=dict(level='LOW'))
        self.add_execution('source', 'PASS', 0)
        self.save(self.name, self.value)
        self.commit()

    def test_exact_report_and_false_authority_refusals(self):
        p.report(self.root, self.name)
        current = brain.load(self.root, p.QR03_ACTIVE)
        for patch in [dict(branch='main'), dict(base_commit=p.QR02_BASE), dict(base_tree='0'*40),
            dict(input_manifest_sha256=p.QR02_DIGEST), dict(authorization_id='M103-QUALITY-RECOVERY02-SOURCE-EDIT-01'),
            dict(protected_source_go=True), dict(main_promotion_authorized=True), dict(hosted_replay_authorized=True),
            dict(protected_security_and_db_admission='GO'), dict(active_writers=2), dict(active_writers=True),
            dict(original_security_proposal_expires_utc='2027-01-01T00:00:00Z'), dict(submission_status='ACCEPTED'),
            dict(accepted_tasks=current['accepted_tasks']+['M1-03']), dict(incremental_spend_usd=False)]:
            self.save(p.QR03_ACTIVE, {**current, **patch})
            with self.subTest(patch=patch), self.assertRaisesRegex(ValueError, 'QR03'):
                p.validate_quality_recovery03(self.root)
        self.save(p.QR03_ACTIVE, current)

    def test_wrong_actual_branch_and_old_head_refuse(self):
        self.command('branch', '-m', 'main')
        with self.assertRaises(ValueError): p.validate_quality_recovery03(self.root)
        self.command('branch', '-m', p.BRANCH)
        self.command('update-ref', 'HEAD', p.QR02_BASE)
        with self.assertRaises(ValueError): p.validate_quality_recovery03(self.root)

    def test_old_intervals_cannot_admit_qr03(self):
        with self.assertRaises(ValueError): p.validate_quality_recovery02(self.root)
        with self.assertRaises(ValueError): p.validate_quality_recovery01(self.root)

    def test_input_review_and_stale_preimage_refuse(self):
        for name in [p.QR03_INPUT+'/SOURCE_EDIT_AUTHORIZATION.json', p.QR03_REVIEW+'/01_BRAIN_AUDIT.md']:
            target=self.root/name;raw=target.read_bytes();target.write_bytes(raw+b'tampered')
            with self.subTest(name=name), self.assertRaises(ValueError): p.validate_quality_recovery03(self.root)
            target.write_bytes(raw)
        original=subprocess.check_output
        def stale(argv,*args,**kwargs):
            data=original(argv,*args,**kwargs)
            return data+b'tampered' if argv[-1]==p.QR03_BASE+':package-lock.json' else data
        with mock.patch.object(subprocess,'check_output',side_effect=stale):
            with self.assertRaisesRegex(ValueError,'QR03 preimage'): p.validate_quality_recovery03(self.root)

    def test_unauthorized_source_and_intermediate_revert_refuse(self):
        name='apps/mobile/src/qr03-unauthorized.ts';target=self.root/name
        target.parent.mkdir(parents=True,exist_ok=True);target.write_text('synthetic attack\n');self.commit()
        with self.assertRaisesRegex(ValueError,'outside exact'): p.validate_quality_recovery03(self.root)
        target.unlink();self.commit()
        with self.assertRaisesRegex(ValueError,'outside exact|deletion'): p.validate_quality_recovery03(self.root)

    def test_protected_widget_root_and_old_active_changes_refuse(self):
        for name in ['scripts/phase5/patch-expo-widgets-lifecycle.mjs','package.json',p.QR02_ACTIVE]:
            target=self.root/name
            target.parent.mkdir(parents=True,exist_ok=True)
            if not target.exists(): target.write_bytes(subprocess.check_output(['git','-C',str(self.root),'show',p.QR03_BASE+':'+name]));self.command('update-index','--no-skip-worktree',name)
            raw=target.read_bytes();target.write_bytes(raw+b'\nUNISSUED_CHANGE\n')
            with self.subTest(name=name),self.assertRaises(ValueError):p.validate_quality_recovery03(self.root)
            target.write_bytes(raw)

    def test_mapping_other_package_and_lock_mutations_refuse(self):
        for name,old,new in [('docs/phase-9/ios-sdk-package-mapping.json',b'source_candidate',b'archive_verified'),
            ('apps/mobile/package.json',b'"expo": "~57.0.31"',b'"expo": "~57.0.32"'),
            ('package-lock.json',b'"name": "layerwell"',b'"name": "unissued"')]:
            target=self.root/name;raw=target.read_bytes();self.assertIn(old,raw);target.write_bytes(raw.replace(old,new))
            with self.subTest(name=name),self.assertRaisesRegex(ValueError,'QR03'):p.validate_quality_recovery03(self.root)
            target.write_bytes(raw)

    def test_report_forged_acceptance_external_go_and_artifact_tamper_refuse(self):
        for patch in [dict(status='ACCEPTED'),dict(iteration='QUALITY-RECOVERY-02'),
                      dict(axes={**self.value['axes'],'live_provider':'PASS'})]:
            self.save(self.name,{**self.value,**patch})
            with self.assertRaises(ValueError):p.report(self.root,self.name)
        self.save(self.name,self.value)
        target=self.root/self.value['artifacts'][0]['path'];target.write_bytes(target.read_bytes()+b'tampered')
        with self.assertRaises(ValueError):p.report(self.root,self.name)


if __name__=='__main__':unittest.main()
