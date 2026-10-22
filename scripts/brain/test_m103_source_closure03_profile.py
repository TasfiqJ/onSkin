"""SC03 exact grant, real historical endpoints, and synthetic authority attacks."""
import pathlib
import shutil
import subprocess
import sys
import unittest

import brain
import m103_profile as p
import test_brain
import test_m1_report_cli as common

sys.path.insert(0,str(brain.ROOT/'scripts/security_readiness/m103'))
from history_custody import fixture_history


class CloudSourceClosure(unittest.TestCase):
    save=test_brain.InstalledControls.save
    command=common.M1ReportCLI.command
    commit=common.M1ReportCLI.commit
    add_execution=common.M1ReportCLI.add_execution
    checkpoint=p.SC03_INPUT.rsplit('/',1)[0]+'/'
    name=checkpoint+'synthetic-report.json'

    def setUp(self):
        test_brain.InstalledControls.setUp(self)
        self.command('init','-q','-b',p.BRANCH)
        fixture_history(self.root,brain.ROOT,p.SC03_BASE)
        for name in [self.checkpoint.rstrip('/'),p.SC03_REVIEW]:
            shutil.copytree(brain.ROOT/name,self.root/name)
        shutil.copyfile(brain.ROOT/p.SC03_ACTIVE,self.root/p.SC03_ACTIVE)
        names=subprocess.check_output(['git','-C',str(self.root),'ls-files','-z'])
        subprocess.run(['git','-C',str(self.root),'update-index','--skip-worktree','-z','--stdin'],input=names,check=True)
        indexed=set(names.decode().strip('\0').split('\0'))
        present=[f.relative_to(self.root).as_posix() for f in (self.root/'docs').rglob('*') if f.is_file() and f.relative_to(self.root).as_posix() in indexed]
        subprocess.run(['git','-C',str(self.root),'update-index','--no-skip-worktree','-z','--stdin'],input=('\0'.join(present)+'\0').encode(),check=True)
        self.commit()
        self.measured=dict(commit=brain.git(self.root,'rev-parse','HEAD'),tree=brain.git(self.root,'rev-parse','HEAD^{tree}'))
        self.value=dict(schema_version=3,task_id='M1-03',iteration='SOURCE-CLOSURE-03',branch=p.BRANCH,
            status='SUBMITTED_REVIEW_REQUIRED',measured=self.measured,delivery_ref='refs/heads/'+p.BRANCH,
            executions=[],artifacts=[],scope_matrix=[dict(id=n,status='NOT_RUN',evidence=[]) for n in p.SC03_SCOPE],ci=[],
            axes=dict.fromkeys(['source','integration','surface','physical_device','live_provider','qualified_review','clinical','commercial','release'],'NOT_RUN'),
            blockers=['Synthetic fixture only; admission NONE'],context_health=dict(level='LOW'))
        self.add_execution('source','PASS',0);self.save(self.name,self.value);self.commit()

    def test_exact_packet_report_and_false_authority_refusals(self):
        p.report(self.root,self.name)
        current=brain.load(self.root,p.SC03_ACTIVE)
        for patch in [dict(base_commit='0'*40),dict(base_tree='0'*40),dict(branch='main'),
                      dict(input_manifest_sha256='0'*64),dict(authorization_id='old-grant'),
                      dict(active_writers=True),dict(incremental_spend_usd=False),dict(protected_source_go=True),
                      dict(main_promotion_authorized=True),dict(submission_status='ACCEPTED'),
                      dict(accepted_tasks=current['accepted_tasks']+['M1-03'])]:
            self.save(p.SC03_ACTIVE,{**current,**patch})
            with self.subTest(patch=patch),self.assertRaises(ValueError):p.validate_source_closure03(self.root)
        self.save(p.SC03_ACTIVE,current)
        for name in [p.SC03_INPUT+'/runtime-recovery/PACKET_MANIFEST.json',
                     p.SC03_INPUT+'/original-context/03_TASK.md',
                     p.SC03_REVIEW+'/runtime-recovery/04_REISSUED_SOURCE_EDIT_AUTHORIZATION.json']:
            target=self.root/name;raw=target.read_bytes();target.write_bytes(raw+b'\n')
            with self.assertRaises(ValueError):p.validate_source_closure03(self.root)
            target.write_bytes(raw)
        self.command('branch','-m','main')
        with self.assertRaises(ValueError):p.validate_source_closure03(self.root)

    def test_old_intervals_and_intermediate_unauthorized_commits_refuse(self):
        p.validate_source_closure03(self.root)
        for validator in [p.validate_source_closure01,p.validate_security_harden01,p.validate_overnight01]:
            with self.subTest(validator=validator.__name__),self.assertRaises(ValueError):validator(self.root)
        target=self.root/'unauthorized.py';target.write_text('inert\n');self.commit()
        with self.assertRaisesRegex(ValueError,'outside exact'):p.validate_source_closure03(self.root)
        target.unlink();self.commit()
        with self.assertRaisesRegex(ValueError,'outside exact|deletion refused'):p.validate_source_closure03(self.root)

    def test_protected_source_and_unmeasured_allowed_source_refuse(self):
        name='scripts/security_readiness/m103/hydrate_history.py';target=self.root/name
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_bytes(subprocess.check_output(['git','-C',str(self.root),'show',p.SC03_BASE+':'+name])+b'\n')
        self.command('update-index','--no-skip-worktree',name)
        with self.assertRaisesRegex(ValueError,'Implementation differs'):p.report(self.root,self.name)
        target.unlink();self.command('update-index','--skip-worktree',name)
        target=self.root/'.github/unauthorized.yml';target.parent.mkdir();target.write_text('inert\n')
        with self.assertRaisesRegex(ValueError,'outside exact'):p.validate_source_closure03(self.root)


if __name__=='__main__':unittest.main()
