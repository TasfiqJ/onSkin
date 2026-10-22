"""Real Git adverse controls. Synthetic evidence grants no acceptance."""
import copy, pathlib, shutil, subprocess, sys, unittest
import brain, m103_profile as p, test_brain
import test_m1_report_cli as common
sys.path.insert(0, str(brain.ROOT/'scripts/security_readiness/m103'))
from history_custody import fixture_history


class Overnight(unittest.TestCase):
    save=test_brain.InstalledControls.save
    command=common.M1ReportCLI.command
    commit=common.M1ReportCLI.commit
    add_execution=common.M1ReportCLI.add_execution
    checkpoint='docs/brain/checkpoints/M1-03/OVERNIGHT-01/'
    name=checkpoint+'synthetic-report.json'

    def setUp(self):
        test_brain.InstalledControls.setUp(self)
        self.command('init','-q','-b',p.BRANCH)
        # Exact final OVERNIGHT docs, before the hardening successor issuance.
        fixture_history(self.root, brain.ROOT, p.SH_BASE)
        names=subprocess.check_output(['git','-C',str(self.root),'ls-files','-z'])
        subprocess.run(['git','-C',str(self.root),'update-index','--skip-worktree','-z','--stdin'],input=names,check=True)
        indexed=set(names.decode().strip('\0').split('\0'))
        present=[f.relative_to(self.root).as_posix() for f in (self.root/'docs').rglob('*') if f.is_file() and f.relative_to(self.root).as_posix() in indexed]
        subprocess.run(['git','-C',str(self.root),'update-index','--no-skip-worktree','-z','--stdin'],input=('\0'.join(present)+'\0').encode(),check=True)
        self.measured=dict(commit=brain.git(self.root,'rev-parse','HEAD'),tree=brain.git(self.root,'rev-parse','HEAD^{tree}'))
        self.value=dict(schema_version=3,task_id='M1-03',iteration='OVERNIGHT-01',branch=p.BRANCH,
            status='SUBMITTED_REVIEW_REQUIRED',measured=self.measured,delivery_ref='refs/heads/'+p.BRANCH,
            executions=[],artifacts=[],scope_matrix=[dict(id=n,status='NOT_RUN',evidence=[]) for n in p.ON_SCOPE],ci=[],
            axes=dict.fromkeys(['source','integration','surface','physical_device','live_provider','qualified_review','clinical','commercial','release'],'NOT_RUN'),
            blockers=['Synthetic only'],context_health=dict(level='LOW'))
        self.add_execution('source','PASS',0)
        self.save(self.name,self.value)

    def test_committed_regular_artifacts_and_identical_local_only_refusal(self):
        with self.assertRaisesRegex(ValueError,'committed regular'):p.report(self.root,self.name)
        self.commit();p.report(self.root,self.name)
        name=self.value['artifacts'][0]['path'];raw=(self.root/name).read_bytes()
        (self.root/'.git/info/exclude').write_text(name+'\n')
        self.command('rm','--cached',name);self.commit()
        (self.root/name).write_bytes(raw)
        with self.assertRaisesRegex(ValueError,'committed regular'):p.report(self.root,self.name)
        self.command('add','-f',name);self.commit();p.report(self.root,self.name)
        (self.root/name).write_bytes(raw+b'changed')
        with self.assertRaisesRegex(ValueError,'Committed artifact differs'):
            p.committed_artifacts(self.root,[dict(path=name,sha256=brain.digest(raw+b'changed'))])
        with self.assertRaises(ValueError):p.report(self.root,self.name)

    def test_anchors_authority_types_and_separate_intervals(self):
        original=brain.load(self.root,p.ON_ACTIVE)
        for patch in [dict(base_commit=p.CONT_BASE),dict(base_tree='0'*40),dict(branch='main'),dict(input_manifest_sha256='0'*64),
                      dict(protected_source_go=True),dict(main_promotion_authorized=True),dict(submission_status='ACCEPTED'),
                      dict(active_writers=True),dict(incremental_spend_usd=False),dict(proposal_expires_utc='2026-10-22T00:00:00Z')]:
            self.save(p.ON_ACTIVE,{**original,**patch})
            with self.subTest(patch=patch),self.assertRaises(ValueError):p.validate_overnight01(self.root)
        self.save(p.ON_ACTIVE,original)
        for name in [p.ON_INPUT+'/TASK_MANIFEST.json',p.ON_INPUT+'/TASK.md',p.ON_REVIEW+'/SOURCE_EDIT_AUTHORIZATION.json']:
            path=self.root/name;raw=path.read_bytes();path.write_bytes(raw+b'\n')
            with self.assertRaises(ValueError):p.validate_overnight01(self.root)
            path.write_bytes(raw)
        self.assertIsNotNone(p._validate_cont01(self.root,fixed=True))
        # Old permissions cannot absorb a newly introduced diagnostic namespace.
        with self.assertRaisesRegex(ValueError,'outside exact'):p.validate_cont01(self.root)
        name=self.root/'scripts/security_readiness/m103/tool.bin';name.parent.mkdir(parents=True);name.write_bytes(b'inert')
        with self.assertRaisesRegex(ValueError,'extension refused'):p.validate_overnight01(self.root)
        name.unlink()
        name=self.root/'unauthorized.py';name.write_text('inert\n');self.commit();name.unlink();self.commit()
        with self.assertRaisesRegex(ValueError,'outside exact'):p.validate_overnight01(self.root)


if __name__=='__main__':unittest.main()
