"""Disposable continuation controls; synthetic receipts grant no acceptance."""
import copy, pathlib, shutil, subprocess, sys, unittest
import brain
import m103_profile as p
import test_brain
import test_m1_report_cli as common
sys.path.insert(0, str(brain.ROOT/'scripts/security_readiness/m103'))
from history_custody import fixture_history

class M103Continuation(unittest.TestCase):
    save = test_brain.InstalledControls.save
    command = common.M1ReportCLI.command
    commit = common.M1ReportCLI.commit
    add_execution = common.M1ReportCLI.add_execution
    checkpoint = 'docs/brain/checkpoints/M1-03/CONT-01/'
    name = checkpoint + 'synthetic-report.json'
    def setUp(self):
        test_brain.InstalledControls.setUp(self)
        self.command('init','-q','-b',p.BRANCH)
        fixture_history(self.root, brain.ROOT, p.ON_BASE)
        # Sparse disposable Git fixture: absent runtime files are intentionally
        # skip-worktree, while the real governance copies remain measurable.
        names=subprocess.check_output(['git','-C',str(self.root),'ls-files','-z'])
        result=subprocess.run(['git','-C',str(self.root),'update-index','--skip-worktree','-z','--stdin'],input=names,capture_output=True)
        self.assertEqual(result.returncode,0,result.stderr)
        indexed=set(names.decode().strip('\0').split('\0'))
        present=[str(f.relative_to(self.root)).replace('\\','/') for f in (self.root/'docs').rglob('*') if f.is_file() and str(f.relative_to(self.root)).replace('\\','/') in indexed]
        result=subprocess.run(['git','-C',str(self.root),'update-index','--no-skip-worktree','-z','--stdin'],input=('\0'.join(present)+'\0').encode(),capture_output=True)
        self.assertEqual(result.returncode,0,result.stderr)
        self.command('add','.')
        self.command('-c','user.name=Synthetic Fixture','-c','user.email=fixture@example.invalid',
                     '-c','commit.gpgsign=false','commit','--allow-empty','-qm','Synthetic historical fixture only')
        measured=dict(commit=brain.git(self.root,'rev-parse','HEAD'),tree=brain.git(self.root,'rev-parse','HEAD^{tree}'))
        self.measured=measured
        self.value=dict(schema_version=3,task_id='M1-03',iteration='CONT-01',branch=p.BRANCH,
            status='SUBMITTED_REVIEW_REQUIRED',measured=measured,delivery_ref='refs/heads/'+p.BRANCH,
            executions=[],artifacts=[],scope_matrix=[dict(id=n,status='NOT_RUN',evidence=[]) for n in p.CONT_SCOPE],
            ci=[],axes=dict.fromkeys(['source','integration','surface','physical_device','live_provider','qualified_review','clinical','commercial','release'],'NOT_RUN'),
            blockers=['Synthetic fixture only'],context_health=dict(level='LOW'))
        self.add_execution('source','PASS',0)
    def test_positive_report_and_wrong_base_tree_branch_digest_authority(self):
        self.save(self.name,self.value);p.report(self.root,self.name)
        original=brain.load(self.root,p.CONT_ACTIVE)
        for patch in [dict(base_commit='0'*40),dict(base_tree='0'*40),dict(branch='main'),dict(input_manifest_sha256='0'*64),
            dict(protected_source_go=True),dict(main_promotion_authorized=True),dict(submission_status='ACCEPTED'),
            dict(accepted_tasks=['M1-03']),dict(proposal_expires_utc='2026-10-22T00:00:00Z'),dict(extra_authority=True)]:
            self.save(p.CONT_ACTIVE,{**original,**patch})
            with self.subTest(patch=patch),self.assertRaises(ValueError):p.validate_cont01(self.root)
        self.save(p.CONT_ACTIVE,original)
        for name in [p.CONT_INPUT+'/TASK_MANIFEST.json',p.CONT_INPUT+'/TASK.md',p.CONT_REVIEW+'/SOURCE_EDIT_AUTHORIZATION.json']:
            path=self.root/name;raw=path.read_bytes();path.write_bytes(raw+b'\n')
            with self.assertRaises(ValueError):p.validate_cont01(self.root)
            path.write_bytes(raw)
        self.command('branch','-m','main')
        with self.assertRaises(ValueError):p.validate_cont01(self.root)
    def test_extra_source_and_unmeasured_allowed_source_and_false_acceptance(self):
        self.save(self.name,self.value)
        path=self.root/'extra-source.py';path.write_text('synthetic only\n')
        with self.assertRaisesRegex(ValueError,'outside exact'):p.validate_cont01(self.root)
        path.unlink()
        path=self.root/'scripts/brain/m103_profile.py';path.parent.mkdir(parents=True,exist_ok=True);path.write_text('unmeasured synthetic source\n')
        self.command('update-index','--no-skip-worktree','scripts/brain/m103_profile.py')
        with self.assertRaisesRegex(ValueError,'Implementation differs'):p.report(self.root,self.name)
        path.unlink();self.command('update-index','--skip-worktree','scripts/brain/m103_profile.py')
        for patch in [dict(status='ACCEPTED'),dict(iteration='CONT-02'),dict(measured=dict(commit=p.BASE,tree=p.TREE))]:
            value={**self.value,**patch};self.save(self.name,value)
            with self.assertRaises(ValueError):p.report(self.root,self.name)

if __name__=='__main__':unittest.main()
