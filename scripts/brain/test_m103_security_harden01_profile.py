"""Bound issuance, disjoint intervals and real-Git adverse authorizations."""
import pathlib,subprocess,sys,unittest
import brain,m103_profile as p,test_brain
import test_m1_report_cli as common
sys.path.insert(0, str(brain.ROOT/'scripts/security_readiness/m103'))
from history_custody import fixture_history


class Hardening(unittest.TestCase):
    save=test_brain.InstalledControls.save
    command=common.M1ReportCLI.command
    commit=common.M1ReportCLI.commit

    def setUp(self):
        test_brain.InstalledControls.setUp(self)
        self.command('init','-q','-b',p.BRANCH)
        fixture_history(self.root, brain.ROOT, '49a39b7f5b194d5c356a21c690e3f1bdb09edfa1')
        names=subprocess.check_output(['git','-C',str(self.root),'ls-files','-z'])
        subprocess.run(['git','-C',str(self.root),'update-index','--skip-worktree','-z','--stdin'],input=names,check=True)
        indexed=set(names.decode().strip('\0').split('\0'))
        present=[f.relative_to(self.root).as_posix() for f in (self.root/'docs').rglob('*') if f.is_file() and f.relative_to(self.root).as_posix() in indexed]
        subprocess.run(['git','-C',str(self.root),'update-index','--no-skip-worktree','-z','--stdin'],input=('\0'.join(present)+'\0').encode(),check=True)
        self.command('add','.')
        self.command('-c','user.name=Synthetic Fixture','-c','user.email=fixture@example.invalid',
                     '-c','commit.gpgsign=false','commit','--allow-empty','-qm','Synthetic historical fixture only')

    def test_exact_issuance_prior_interval_and_gate_types(self):
        p.validate_security_harden01(self.root)
        current=brain.load(self.root,p.SH_ACTIVE)
        for patch in [dict(input_manifest_sha256='0'*64),dict(protected_source_go=True),dict(main_promotion_authorized=True),
            dict(active_writers=True),dict(incremental_spend_usd=False),dict(submission_status='ACCEPTED'),
            dict(proposal_expires_utc='2026-10-22T00:00:00Z'),dict(accepted_tasks=current['accepted_tasks']+['M1-03'])]:
            self.save(p.SH_ACTIVE,{**current,**patch})
            with self.subTest(patch=patch),self.assertRaises(ValueError):p.validate_security_harden01(self.root)
        self.save(p.SH_ACTIVE,current)
        for name in [p.SH_INPUT+'/TASK_MANIFEST.json',p.SH_INPUT+'/TASK.md',p.SH_REVIEW+'/SOURCE_EDIT_AUTHORIZATION.json']:
            target=self.root/name;raw=target.read_bytes();target.write_bytes(raw+b'\n')
            with self.assertRaises(ValueError):p.validate_security_harden01(self.root)
            target.write_bytes(raw)
        p.validate_overnight01(self.root,fixed=True)
        with self.assertRaises(ValueError):p.validate_overnight01(self.root)

    def test_intermediate_unauthorized_commit_and_malformed_preimage_refuse(self):
        target=self.root/'unauthorized.py';target.write_text('synthetic\n');self.commit();target.unlink();self.commit()
        with self.assertRaisesRegex(ValueError,'outside exact'):p.validate_security_harden01(self.root)

    def test_sandbox_digest_discrepancy_is_not_permission_to_edit(self):
        target=self.root/'scripts/security_readiness/m103/sandbox.py';target.parent.mkdir(parents=True,exist_ok=True)
        raw=subprocess.check_output(['git','-C',str(self.root),'show',p.SH_BASE+':scripts/security_readiness/m103/sandbox.py'])
        target.write_bytes(raw+b'\n');self.command('update-index','--no-skip-worktree','scripts/security_readiness/m103/sandbox.py')
        with self.assertRaisesRegex(ValueError,'preimage mismatch'):p.validate_security_harden01(self.root)


if __name__=='__main__':unittest.main()
