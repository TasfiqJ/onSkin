"""Real commit-backed issuance boundaries; synthetic receipts grant nothing."""
import pathlib
import subprocess
import sys
import unittest

import brain
import m103_profile as p
import test_brain
import test_m1_report_cli as common

sys.path.insert(0,str(brain.ROOT/'scripts/security_readiness/m103'))
from history_custody import fixture_history


class SourceClosure(unittest.TestCase):
    save=test_brain.InstalledControls.save
    command=common.M1ReportCLI.command
    commit=common.M1ReportCLI.commit
    add_execution=common.M1ReportCLI.add_execution
    checkpoint=p.SC_INPUT.rsplit('/',1)[0]+'/'
    name=checkpoint+'synthetic-report.json'

    def setUp(self):
        test_brain.InstalledControls.setUp(self)
        self.command('init','-q','-b',p.BRANCH)
        self.objects=fixture_history(self.root,brain.ROOT,brain.git(brain.ROOT,'rev-parse','HEAD'))
        names=subprocess.check_output(['git','-C',str(self.root),'ls-files','-z'])
        subprocess.run(['git','-C',str(self.root),'update-index','--skip-worktree','-z','--stdin'],input=names,check=True)
        indexed=set(names.decode().strip('\0').split('\0'))
        present=[f.relative_to(self.root).as_posix() for f in (self.root/'docs').rglob('*') if f.is_file() and f.relative_to(self.root).as_posix() in indexed]
        subprocess.run(['git','-C',str(self.root),'update-index','--no-skip-worktree','-z','--stdin'],input=('\0'.join(present)+'\0').encode(),check=True)
        self.measured=dict(commit=brain.git(self.root,'rev-parse','HEAD'),tree=brain.git(self.root,'rev-parse','HEAD^{tree}'))
        self.value=dict(schema_version=3,task_id='M1-03',iteration='SOURCE-CLOSURE-01',branch=p.BRANCH,
            status='SUBMITTED_REVIEW_REQUIRED',measured=self.measured,delivery_ref='refs/heads/'+p.BRANCH,
            executions=[],artifacts=[],scope_matrix=[dict(id=n,status='NOT_RUN',evidence=[]) for n in p.SC_SCOPE],ci=[],
            axes=dict.fromkeys(['source','integration','surface','physical_device','live_provider','qualified_review','clinical','commercial','release'],'NOT_RUN'),
            blockers=['Synthetic fixture only'],context_health=dict(level='LOW'))
        self.add_execution('source','PASS',0)
        self.save(self.name,self.value)
        self.commit()

    def test_bound_report_authority_immutable_inputs_and_ref(self):
        p.report(self.root,self.name)
        alternate=(self.root/'.git/objects/info/alternates').read_bytes()
        self.assertNotIn(b'\r',alternate)
        original=pathlib.Path(brain.git(brain.ROOT,'rev-parse','--path-format=absolute','--git-common-dir'))/'objects'
        self.assertNotEqual(self.objects.resolve(),original.resolve())
        self.assertFalse((self.objects/'info/alternates').exists())
        current=brain.load(self.root,p.SC_ACTIVE)
        for patch in [dict(base_commit='0'*40),dict(base_tree='0'*40),dict(branch='main'),
                      dict(input_manifest_sha256='0'*64),dict(active_writers=True),dict(incremental_spend_usd=False),
                      dict(protected_source_go=True),dict(main_promotion_authorized=True),dict(submission_status='ACCEPTED'),
                      dict(accepted_tasks=current['accepted_tasks']+['M1-03']),dict(proposal_expires_utc='2026-10-22T00:00:00Z')]:
            self.save(p.SC_ACTIVE,{**current,**patch})
            with self.subTest(patch=patch),self.assertRaises(ValueError):p.validate_source_closure01(self.root)
        self.save(p.SC_ACTIVE,current)
        for name in [p.SC_INPUT+'/TASK_MANIFEST.json',p.SC_INPUT+'/TASK.md',p.SC_REVIEW+'/SOURCE_EDIT_AUTHORIZATION.json']:
            target=self.root/name;raw=target.read_bytes();target.write_bytes(raw+b'\n')
            with self.assertRaises(ValueError):p.validate_source_closure01(self.root)
            target.write_bytes(raw)
        self.command('branch','-m','main')
        with self.assertRaises(ValueError):p.validate_source_closure01(self.root)

    def test_intermediate_out_of_scope_and_old_interval_refuse(self):
        p.validate_source_closure01(self.root)
        with self.assertRaises(ValueError):p.validate_security_harden01(self.root)
        name=self.root/'unauthorized.py';name.write_text('inert\n');self.commit();name.unlink();self.commit()
        with self.assertRaisesRegex(ValueError,'outside exact'):p.validate_source_closure01(self.root)

    def test_unmeasured_source_and_mismatched_preimage_refuse(self):
        name='scripts/security_readiness/m103/sandbox.py';target=self.root/name
        target.parent.mkdir(parents=True,exist_ok=True)
        original=subprocess.check_output(['git','-C',str(self.root),'show',p.SC_BASE+':'+name])
        self.assertEqual(brain.digest(original),'fe2c5580115c7f4b791edc7f7a72851044c0677e464bc53c467a42d9ce508b15')
        target.write_bytes(original+b'\n');self.command('update-index','--no-skip-worktree',name)
        with self.assertRaisesRegex(ValueError,'Implementation differs'):p.report(self.root,self.name)
        target.unlink();self.command('update-index','--skip-worktree',name)
        name='scripts/brain/test_m103_overnight01_profile.py';target=self.root/name
        target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(b'inert\n')
        self.command('update-index','--no-skip-worktree',name)
        with self.assertRaisesRegex(ValueError,'preimage mismatch'):p.validate_source_closure01(self.root)


if __name__=='__main__':unittest.main()
