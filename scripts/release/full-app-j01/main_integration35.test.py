"""Synthetic35 event/history/hash controls; these are not browser or hosted CI evidence."""
import copy
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('integration35', Path(__file__).with_name('main_integration35.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class Controls(unittest.TestCase):
    def setUp(self):
        self.head, self.tree, self.merge = 'a'*40, 'b'*40, 'c'*40
        self.env = dict(GITHUB_ACTIONS='true', GITHUB_REPOSITORY='TasfiqJ/onSkin',
            GITHUB_EVENT_NAME='pull_request', GITHUB_REF='refs/pull/38/merge', GITHUB_SHA=self.merge)
        self.pr = dict(number=38, state='open', draft=True, merged=False, merged_at=None, closed_at=None,
            maintainer_can_modify=False, auto_merge=None, base=dict(sha=m.BASE, ref=m.PARENT_BRANCH),
            head=dict(sha=self.head, ref=m.BRANCH, repo=dict(full_name='TasfiqJ/onSkin')))
        self.event = dict(number=38, repository=dict(full_name='TasfiqJ/onSkin'), pull_request=copy.deepcopy(self.pr))

    def ci(self, **overrides):
        args = dict(env=self.env, event=self.event, checkout=self.head, tree=self.tree,
            merge=[self.merge,m.BASE,self.head], merge_tree=self.tree,
            live=dict(main=m.MAIN,parent=m.BASE,ancestor=m.parent().BASE,source=self.head), live_pr=self.pr)
        return m.ci_guard(**{**args,**overrides})

    def task(self, paths=None):
        paths = m.REQUIRED_SOURCE if paths is None else paths
        return dict(schema=1, authority=m.AUTHORITY, base=m.BASE, baseTree=m.BASE_TREE,
            planCommit=m.PLAN_COMMIT, sourceHashes={name:m.digest(b'synthetic') for name in paths-{m.TASK}},
            acceptanceGranted=False, admissions=dict.fromkeys(m.ADMISSIONS,False), release='NO_GO',
            qualification='SOURCE_INTEGRITY_NOT_QUALIFIED_ACCEPTANCE',
            validation=[dict(command='node --test synthetic.test.mjs',exit=0,scope='SOURCE_CONTROL_ONLY')],
            sourceSnapshots=dict(parentHead=m.BASE,parentTree=m.BASE_TREE,planCommit=m.PLAN_COMMIT))

    def parent_prs(self):
        rows=[]
        for number,head,branch in [(37,m.BASE,m.PARENT_BRANCH),
                                  (36,m.parent().BASE,m.parent().PARENT_BRANCH)]:
            rows.append(dict(number=number,state='open',draft=True,merged=False,merged_at=None,closed_at=None,
                head=dict(sha=head,ref=branch,repo=dict(full_name='TasfiqJ/onSkin'))))
        rows[0]['base']=dict(sha=m.parent().BASE,ref=m.parent().PARENT_BRANCH)
        return rows

    def history(self, paths=None):
        source,seal='a'*40,'b'*40
        paths=m.REQUIRED_SOURCE if paths is None else paths
        return [m.PLAN_COMMIT,source,seal], source, seal, paths

    def nested(self):
        p=m.parent()
        old=p.parent().parent()
        release29=dict(status='PASS', historicalCheckerExit=0, historicalHead=old.PR33,
            historicalTree=old.PR33_TREE, checkerSHA256=old.CHECKER_SHA, acceptanceGranted=False, release='NO_GO',
            originalCurrentRefusal=dict(valid=False,error='R29_AFTER_EVIDENCE_TAIL',release='NO_GO'),
            qualification='INDEPENDENT_PINNED_CLONE_NORMAL_HOOKS_NO_HISTORICAL_CI_CLAIM')
        replay33=dict(status='PASS',historicalParentHead=p.parent().BASE,
            historicalParentTree=p.parent().BASE_TREE,parentCheckerSHA256=p.parent().PARENT_SHA,
            acceptanceGranted=False,release='NO_GO',current33Proof='SEPARATE_VERIFY_REQUIRED',
            originalCurrent32Refusal=dict(valid=False,error='R32_HISTORY_PHASES',acceptanceGranted=False,release='NO_GO'),
            release29=release29,qualification='SUPPLIER_PINNED_HISTORICAL_CLONES_NOT_CURRENT33_OR_OWNER_ADMISSION')
        return dict(status='PASS',historicalHead=p.BASE,historicalTree=p.BASE_TREE,checkerSHA256=p.PARENT_SHA,
            acceptanceGranted=False,release='NO_GO',admissions=dict.fromkeys(m.ADMISSIONS,False),
            qualification='SUPPLIER_PINNED33_32_29_REPLAY_NOT_CURRENT34_OR_OWNER_ACCEPTANCE',
            original33=dict(valid=True,head=p.BASE,tree=p.BASE_TREE,acceptanceGranted=False,
                release='NO_GO',admissions=dict.fromkeys(m.ADMISSIONS,False)),
            original33CurrentRefusal=dict(valid=False,error='R33_HISTORY_PHASES',acceptanceGranted=False,release='NO_GO'),
            original32And29=replay33)

    def transcript(self, value):
        return b'R34_HISTORICAL_WORKSPACE /synthetic-only\nR34_EXACT_PR36_FULL_CLONE_AUTHENTICATED\nR34_PR36_NORMAL_INSTALL_AND_HOOKS_PASS\n'+m.json.dumps(value).encode()+b'\n'

    def test_pr_event_and_explicit_local_classification(self):
        self.assertEqual(self.ci(),'EXACT_EVENT_LIVE_PR_PARENT_MAIN_SOURCE_AND_TEST_MERGE')
        self.assertEqual(self.ci(env={}),'LOCAL_EXACT_CHECKOUT_NOT_CI')
        with self.assertRaisesRegex(ValueError,'R35_LOCAL_CONTEXT'):
            self.ci(env={'GITHUB_SHA':self.head})

    def test_push_dispatch_other_repository_and_wrong_ref_refused(self):
        for key,bad in [('GITHUB_EVENT_NAME','push'),('GITHUB_EVENT_NAME','workflow_dispatch'),
                        ('GITHUB_REPOSITORY','other/repo'),('GITHUB_REF','refs/heads/main')]:
            with self.subTest(key=key,bad=bad),self.assertRaises(ValueError):
                self.ci(env={**self.env,key:bad})
        event=copy.deepcopy(self.event)
        event['repository']['full_name']='other/repo'
        with self.assertRaisesRegex(ValueError,'R35_CI_REPOSITORY'):
            self.ci(event=event)

    def test_event_and_live_pr_require_exact_draft_custody(self):
        for key,bad in [('number',True),('number',37),('draft',False),('state','closed'),
            ('merged',True),('merged_at','time'),('closed_at','time'),('maintainer_can_modify',True),('auto_merge',{})]:
            for area in ['event','live']:
                event,live=copy.deepcopy(self.event),copy.deepcopy(self.pr)
                (event['pull_request'] if area=='event' else live)[key]=bad
                with self.subTest(key=key,area=area),self.assertRaises(ValueError):
                    self.ci(event=event,live_pr=live)
        with self.assertRaisesRegex(ValueError,'R35_LIVE_PR'):
            self.ci(live_pr=None)

    def test_wrong_parent_owner_branch_head_and_test_merge_refused(self):
        for area,key,bad in [('base','sha','0'*40),('base','ref','main'),
            ('head','sha','0'*40),('head','ref',m.PARENT_BRANCH),('head','repo',dict(full_name='other/repo'))]:
            event=copy.deepcopy(self.event)
            event['pull_request'][area][key]=bad
            with self.subTest(area=area,key=key),self.assertRaisesRegex(ValueError,'R35_CI_EVENT'):
                self.ci(event=event)
        for merge in [[self.merge,self.head,m.BASE],[self.merge,m.BASE,'0'*40],[self.merge,self.head]]:
            with self.assertRaisesRegex(ValueError,'R35_CI_TEST_MERGE'):
                self.ci(merge=merge)
        with self.assertRaisesRegex(ValueError,'R35_CI_TEST_MERGE'):
            self.ci(merge_tree='0'*40)
        for key in ['main','parent','ancestor','source']:
            live=dict(main=m.MAIN,parent=m.BASE,ancestor=m.parent().BASE,source=self.head)
            live[key]='0'*40
            with self.subTest(ref=key),self.assertRaisesRegex(ValueError,'R35_STALE_HEAD_OR_PARENT'):
                self.ci(live=live)

    def test_both_live_parent_prs_must_remain_exact(self):
        good=self.parent_prs()
        m.parent_pr_guard(*good)
        for row in [0,1]:
            for key,bad in [('draft',False),('state','closed'),('merged',True),('number',True),('merged_at','time')]:
                values=copy.deepcopy(good)
                values[row][key]=bad
                with self.subTest(row=row,key=key),self.assertRaisesRegex(ValueError,'R35_LIVE_PARENT_SOURCE_DRIFT'):
                    m.parent_pr_guard(*values)
            values=copy.deepcopy(good)
            values[row]['head']['sha']='0'*40
            with self.assertRaisesRegex(ValueError,'R35_LIVE_PARENT_SOURCE_DRIFT'):
                m.parent_pr_guard(*values)

    def test_task_actual_required_and_optional_source_inventory(self):
        for paths in [m.REQUIRED_SOURCE,m.REQUIRED_SOURCE|{'scripts/e2e/retained-daily-loop.mjs'}]:
            m.task_guard(self.task(paths),lambda _:b'synthetic',paths)
        for bad in [m.REQUIRED_SOURCE-{m.TASK},m.REQUIRED_SOURCE|{'package.json'}]:
            with self.assertRaisesRegex(ValueError,'R35_HASH_INVENTORY'):
                m.task_guard(self.task(bad),lambda _:b'synthetic',bad)
        value=self.task()
        value['sourceHashes']['apps/mobile/app.config.js']=m.digest(b'synthetic')
        with self.assertRaisesRegex(ValueError,'R35_HASH_INVENTORY'):
            m.task_guard(value,lambda _:b'synthetic',m.REQUIRED_SOURCE)
        with self.assertRaisesRegex(ValueError,'R35_FROZEN_SOURCE'):
            m.task_guard(self.task(),lambda _:b'late source edit',m.REQUIRED_SOURCE)

    def test_task_cannot_claim_owner_release_or_changed_authority(self):
        good=self.task()
        for key,bad in [('schema',True),('authority','invented'),('base','0'*40),('baseTree','0'*40),
            ('planCommit','0'*40),('acceptanceGranted',True),('release','GO')]:
            with self.subTest(key=key),self.assertRaisesRegex(ValueError,'R35_NO_ADMISSION'):
                m.task_guard({**good,key:bad},lambda _:b'synthetic',m.REQUIRED_SOURCE)
        for gate in m.ADMISSIONS:
            value=copy.deepcopy(good)
            value['admissions'][gate]=True
            with self.subTest(gate=gate),self.assertRaisesRegex(ValueError,'R35_NO_ADMISSION'):
                m.task_guard(value,lambda _:b'synthetic',m.REQUIRED_SOURCE)
        with self.assertRaisesRegex(ValueError,'R35_TASK_SCHEMA'):
            m.task_guard({**good,'approval':True},lambda _:b'synthetic',m.REQUIRED_SOURCE)

    def test_task_snapshots_and_honest_validation_records(self):
        good=self.task()
        not_run=copy.deepcopy(good)
        not_run['validation'][0].update(exit=None,scope='NOT_RUN_DEVICE_UNAVAILABLE')
        m.task_guard(not_run,lambda _:b'synthetic',m.REQUIRED_SOURCE)
        for bad in [[],[dict(command='x',exit=True,scope='x')],[dict(command='x',exit=0,scope='x',passAll=True)]]:
            with self.assertRaisesRegex(ValueError,'R35_VALIDATION_RECORD'):
                m.task_guard({**good,'validation':bad},lambda _:b'synthetic',m.REQUIRED_SOURCE)
        with self.assertRaisesRegex(ValueError,'R35_SOURCE_SNAPSHOTS'):
            m.task_guard({**good,'sourceSnapshots':{}},lambda _:b'synthetic',m.REQUIRED_SOURCE)

    def test_linear_plan_source_and_sole_worklist_seal(self):
        commits,source,seal,paths=self.history()
        with patch.object(m,'parents',side_effect=lambda c:[c,m.PLAN_COMMIT if c==source else source]), \
             patch.object(m,'changed',side_effect=lambda b,a,allowed:paths if a==source else m.WORKLIST):
            self.assertEqual(m.phase_guard(commits),(source,seal,paths))
            for bad in [commits[:2],['0'*40,source,seal],[m.PLAN_COMMIT,source,source,seal]]:
                with self.assertRaisesRegex(ValueError,'R35_HISTORY_PHASES'):
                    m.phase_guard(bad)
            with patch.object(m,'parents',return_value=[source,'0'*40]),self.assertRaisesRegex(ValueError,'R35_LINEAR_HISTORY'):
                m.phase_guard(commits)
            for bad in [m.WORKLIST|{'PROGRESS.md'},set(),{'docs/phase-4/generated/source-worklist.json'}]:
                with patch.object(m,'changed',side_effect=lambda b,a,allowed:paths if a==source else bad), \
                     self.assertRaisesRegex(ValueError,'R35_SOURCE_THEN_SEAL'):
                    m.phase_guard(commits)

    def test_optional_paths_do_not_relax_required_source_or_grant(self):
        commits,source,seal,paths=self.history()
        for changed in [paths-{m.TASK},paths|{'package.json'}]:
            with patch.object(m,'parents',side_effect=lambda c:[c,m.PLAN_COMMIT if c==source else source]), \
                 patch.object(m,'changed',side_effect=lambda b,a,allowed:changed if a==source else m.WORKLIST), \
                 self.assertRaisesRegex(ValueError,'R35_SOURCE_THEN_SEAL'):
                m.phase_guard(commits)

    def test_post_seal_source_edit_and_protected_modes_refused(self):
        commits,source,seal,paths=self.history()
        after='d'*40
        def raw(path,mode='100644',status='M'):
            return (':100644 '+mode+' '+'1'*40+' '+'2'*40+' '+status+'\0'+path+'\0').encode()
        with patch.object(m,'parents',side_effect=lambda c:[c,{source:m.PLAN_COMMIT,seal:source,after:seal}[c]]), \
             patch.object(m,'changed',side_effect=lambda b,a,allowed:m.old().delta(
                 raw('docs/phase-4/generated/source-worklist.json' if a==seal else 'PROGRESS.md'),allowed)), \
             self.assertRaises(ValueError):
            m.phase_guard(commits+[after])
        for path in ['package.json','.github/workflows/security.yml',m.PREFIX+'main_integration34.py',m.PLAN,
                     'apps/mobile/app.config.js','scripts/launch/candidate-scope34.mjs']:
            with self.subTest(path=path),self.assertRaises(ValueError):
                m.old().delta(raw(path),m.SOURCE_GRANT)
        for mode,status in [('120000','M'),('160000','M'),('100755','M'),('000000','D'),('100644','R100')]:
            with self.subTest(mode=mode),self.assertRaises(ValueError):
                m.old().delta(raw('PROGRESS.md',mode,status),m.SOURCE_GRANT)

    def test_real_nested_result_shape_and_explicit_progress(self):
        value=self.nested()
        self.assertEqual(m.historical_result(self.transcript(value)),value)
        for raw in [m.json.dumps(value).encode(),b'fake progress\n'+self.transcript(value),self.transcript(value).replace(
            b'R34_PR36_NORMAL_INSTALL_AND_HOOKS_PASS',b'R34_PR36_SKIPPED')]:
            with self.assertRaisesRegex(ValueError,'R35_HISTORICAL34_TRANSCRIPT'):
                m.historical_result(raw)
        for key,bad in [('historicalHead','0'*40),('checkerSHA256','0'*64),('acceptanceGranted',True),('release','GO')]:
            with self.subTest(key=key),self.assertRaisesRegex(ValueError,'R35_HISTORICAL34_RESULT'):
                m.historical_result(self.transcript({**value,key:bad}))
        forged=copy.deepcopy(value)
        forged['original33']['head']='0'*40
        with self.assertRaisesRegex(ValueError,'R35_HISTORICAL33_SOURCE'):
            m.historical_result(self.transcript(forged))
        forged=copy.deepcopy(value)
        forged['original33CurrentRefusal']['valid']=True
        with self.assertRaisesRegex(ValueError,'R35_HISTORICAL33_REFUSAL'):
            m.historical_result(self.transcript(forged))
        forged=copy.deepcopy(value)
        forged['original32And29']['release29']['acceptanceGranted']=True
        with self.assertRaises(ValueError):
            m.historical_result(self.transcript(forged))

    def test_current_original34_refusal_is_context_specific_and_never_success(self):
        for in_ci,error in [(False,'R34_WRONG_BRANCH'),(True,'R32_FINITE_SCOPE')]:
            value=dict(valid=False,error=error,acceptanceGranted=False,release='NO_GO')
            self.assertEqual(m.current34_refusal(m.json.dumps(value).encode(),in_ci),value)
            for key,bad in [('valid',True),('error','R34_EXECUTION_INCOMPLETE'),
                            ('error','R34_HISTORY_PHASES'),('release','GO')]:
                with self.subTest(in_ci=in_ci,key=key),self.assertRaisesRegex(ValueError,'R35_ORIGINAL34_REFUSAL'):
                    m.current34_refusal(m.json.dumps({**value,key:bad}).encode(),in_ci)

    def test_duplicate_nonfinite_json_refused(self):
        for raw in [b'{"a":0,"a":1}',b'{"a":NaN}',b'{"a":Infinity}']:
            with self.assertRaises(ValueError):
                m.document(raw)


if __name__ == '__main__':
    unittest.main()

