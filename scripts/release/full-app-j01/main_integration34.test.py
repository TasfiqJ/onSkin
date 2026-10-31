"""Hostile event, source-phase and manifest controls; never real CI evidence."""
import copy
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('integration34', Path(__file__).with_name('main_integration34.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class Controls(unittest.TestCase):
    def setUp(self):
        self.head = 'a'*40
        self.tree = 'b'*40
        self.merge = 'c'*40
        self.env = dict(GITHUB_ACTIONS='true', GITHUB_REPOSITORY='TasfiqJ/onSkin', GITHUB_EVENT_NAME='pull_request',
                        GITHUB_REF='refs/pull/37/merge', GITHUB_SHA=self.merge)
        self.pr = dict(number=37, state='open', draft=True, merged=False, closed_at=None, merged_at=None,
            maintainer_can_modify=False, auto_merge=None, base=dict(sha=m.BASE, ref=m.PARENT_BRANCH),
            head=dict(sha=self.head, ref=m.BRANCH, repo=dict(full_name='TasfiqJ/onSkin')))
        self.event = dict(number=37, repository=dict(full_name='TasfiqJ/onSkin'), pull_request=copy.deepcopy(self.pr))

    def ci(self, **overrides):
        args = dict(env=self.env, event=self.event, checkout=self.head, tree=self.tree,
            merge=[self.merge,m.BASE,self.head], merge_tree=self.tree,
            live=dict(main=m.MAIN,parent=m.BASE,source=self.head), live_pr=self.pr)
        return m.ci_guard(**{**args, **overrides})

    def task(self):
        return dict(schema=1, authority=m.AUTHORITY, base=m.BASE, baseTree=m.BASE_TREE, planCommit=m.PLAN_COMMIT,
            sourceHashes={path:m.digest(b'synthetic') for path in m.SOURCE-{m.TASK}}, acceptanceGranted=False,
            admissions=dict.fromkeys(m.ADMISSIONS,False), release='NO_GO', qualification='SOURCE_INTEGRITY_NOT_QUALIFIED_ACCEPTANCE')

    def candidate(self):
        rows, provenance=m.pinned_projection()
        return dict(valid=True, scope='full-app-j01-v2', schemaVersion=2, mode='verification',
            contract='onskin-full-app-j01-campaign33-v2', requiredRows=38, deferredRows=27,
            totalRows=65, requiredIds=list(m.REQUIRED), deferredIds=list(m.DEFERRED), unadmittedGates=list(m.GATES),
            obligations=rows, provenance=provenance,
            externalReady=False, candidateReady=False, acceptanceGranted=False, release='NO_GO')

    def test_realistic_draft_event_and_honest_local_classification(self):
        self.assertEqual(self.ci(), 'EXACT_EVENT_LIVE_PR_PARENT_MAIN_SOURCE_AND_TEST_MERGE')
        self.assertEqual(self.ci(env={}), 'LOCAL_EXACT_CHECKOUT_NOT_CI')
        with self.assertRaisesRegex(ValueError,'R34_LOCAL_CONTEXT'):
            self.ci(env={'GITHUB_SHA':self.head})

    def test_wrong_event_repository_and_merge_ref(self):
        for key,value in [('GITHUB_EVENT_NAME','push'),('GITHUB_EVENT_NAME','workflow_dispatch'),
                          ('GITHUB_REPOSITORY','other/repo'),('GITHUB_REF','refs/heads/main')]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.ci(env={**self.env,key:value})
        event=copy.deepcopy(self.event)
        event['repository']['full_name']='other/repo'
        with self.assertRaisesRegex(ValueError,'R34_CI_REPOSITORY'):
            self.ci(event=event)

    def test_event_and_live_draft_custody_must_both_match(self):
        for key,value in [('number',True),('draft',False),('state','closed'),('closed_at','date'),
            ('merged_at','date'),('merged',True),('maintainer_can_modify',True),('auto_merge',{})]:
            event=copy.deepcopy(self.event)
            event['pull_request'][key]=value
            with self.subTest(key=key,area='event'), self.assertRaisesRegex(ValueError,'R34_CI_EVENT'):
                self.ci(event=event)
            live=copy.deepcopy(self.pr)
            live[key]=value
            with self.subTest(key=key,area='live'), self.assertRaisesRegex(ValueError,'R34_LIVE_PR'):
                self.ci(live_pr=live)
        with self.assertRaisesRegex(ValueError,'R34_LIVE_PR'):
            self.ci(live_pr=None)

    def test_wrong_branch_parent_or_source_identity(self):
        for area,key,value in [('base','sha','0'*40),('base','ref','main'),('head','sha','0'*40),
                               ('head','ref',m.PARENT_BRANCH)]:
            event=copy.deepcopy(self.event)
            event['pull_request'][area][key]=value
            with self.subTest(area=area,key=key), self.assertRaisesRegex(ValueError,'R34_CI_EVENT'):
                self.ci(event=event)
        for key in ['main','parent','source']:
            live=dict(main=m.MAIN,parent=m.BASE,source=self.head)
            live[key]='0'*40
            with self.subTest(ref=key), self.assertRaisesRegex(ValueError,'R34_STALE_HEAD_OR_PARENT'):
                self.ci(live=live)

    def test_forged_test_merge_and_mismatched_tree(self):
        for merge in [[self.merge,self.head,m.BASE],[self.merge,m.BASE,'0'*40],[self.merge,self.head]]:
            with self.assertRaisesRegex(ValueError,'R34_CI_TEST_MERGE'):
                self.ci(merge=merge)
        with self.assertRaisesRegex(ValueError,'R34_CI_TEST_MERGE'):
            self.ci(merge_tree='0'*40)

    def test_strict_task_and_closed_owner_gates(self):
        value=self.task()
        m.task_guard(value,lambda _:b'synthetic')
        for key,bad in [('schema',True),('release','GO'),('acceptanceGranted',True),('base','0'*40),
                        ('baseTree','0'*40),('planCommit','0'*40),('authority','invented')]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                m.task_guard({**value,key:bad},lambda _:b'synthetic')
        for gate in m.ADMISSIONS:
            forged=copy.deepcopy(value)
            forged['admissions'][gate]=True
            with self.subTest(gate=gate), self.assertRaisesRegex(ValueError,'R34_NO_ADMISSION'):
                m.task_guard(forged,lambda _:b'synthetic')
        with self.assertRaisesRegex(ValueError,'R34_TASK_SCHEMA'):
            m.task_guard({**value,'approval':True},lambda _:b'synthetic')

    def test_frozen_source_and_complete_inventory(self):
        value=self.task()
        for hashes in [{}, {**value['sourceHashes'],'apps/mobile/app.config.js':m.digest(b'synthetic')}]:
            with self.assertRaisesRegex(ValueError,'R34_HASH_INVENTORY'):
                m.task_guard({**value,'sourceHashes':hashes},lambda _:b'synthetic')
        with self.assertRaisesRegex(ValueError,'R34_FROZEN_SOURCE'):
            m.task_guard(value,lambda _:b'late change after freeze')

    def test_plan_source_then_only_one_seal(self):
        source='a'*40
        seal='b'*40
        commits=[m.PLAN_COMMIT,source,seal]
        parent=lambda c:[c,m.PLAN_COMMIT if c==source else source]
        delta=lambda before,after,allowed:m.SOURCE if after==source else m.WORKLIST
        with patch.object(m,'parents',side_effect=parent), patch.object(m,'changed',side_effect=delta):
            self.assertEqual(m.phase_guard(commits),(source,seal))
            for bad in [commits[:2],['0'*40,source,seal],[m.PLAN_COMMIT,source,source,seal]]:
                with self.assertRaisesRegex(ValueError,'R34_HISTORY_PHASES'):
                    m.phase_guard(bad)
            with patch.object(m,'parents',return_value=[source,'0'*40]), self.assertRaisesRegex(ValueError,'R34_LINEAR_HISTORY'):
                m.phase_guard(commits)
            for paths in [m.WORKLIST|{'PROGRESS.md'}, {'docs/phase-4/generated/source-worklist.json'}, m.SOURCE]:
                def bad_delta(before,after,allowed):
                    return m.SOURCE if after==source else paths
                with patch.object(m,'changed',side_effect=bad_delta), self.assertRaisesRegex(ValueError,'R34_SOURCE_THEN_SEAL'):
                    m.phase_guard(commits)
        # A post-seal source commit forces the former seal into a SOURCE-only phase and refuses.
        after='d'*40
        with patch.object(m,'parents',side_effect=lambda c:[c,{source:m.PLAN_COMMIT,seal:source,after:seal}[c]]):
            with patch.object(m,'changed',side_effect=lambda b,a,allowed: m.parent().parent().delta(
                (':100644 100644 '+'1'*40+' '+'2'*40+' M\0'+
                 ('docs/phase-4/generated/source-worklist.json' if a==seal else 'PROGRESS.md')+'\0').encode(),allowed)):
                with self.assertRaises(ValueError):
                    m.phase_guard([m.PLAN_COMMIT,source,seal,after])

    def test_finite_diff_protects_unused_grant_and_rejects_bad_modes(self):
        def raw(path,mode='100644',status='M'):
            return (':100644 '+mode+' '+'1'*40+' '+'2'*40+' '+status+'\0'+path+'\0').encode()
        delta=m.parent().parent().delta
        self.assertEqual(delta(raw('PROGRESS.md'),m.SOURCE),{'PROGRESS.md'})
        for name in ['apps/mobile/app.config.js','scripts/brain/brain.py','.github/workflows/security.yml',m.PLAN,
                     m.PREFIX+'main_integration33.py',m.PREFIX+'check.py','package.json']:
            with self.subTest(path=name), self.assertRaises(ValueError):
                delta(raw(name),m.SOURCE)
        for mode,status in [('120000','M'),('160000','M'),('100755','M'),('000000','D'),('100644','R100')]:
            with self.subTest(mode=mode,status=status), self.assertRaises(ValueError):
                delta(raw('PROGRESS.md',mode,status),m.SOURCE)

    def test_forged_candidate_success_identity_and_gate_counts_refused(self):
        value=self.candidate()
        m.scope_guard(value)
        for key,bad in [('valid',1),('scope','lean-v1'),('schemaVersion',True),('requiredRows',37),
            ('deferredRows',26),('totalRows',True),('unadmittedGates',m.GATES[:-1]),('externalReady',True),
            ('candidateReady',True),('acceptanceGranted',True),('release','GO'),
            ('requiredIds',m.REQUIRED[:-1]+['J05']),('deferredIds',m.DEFERRED[:-1]+['J01'])]:
            with self.subTest(key=key), self.assertRaisesRegex(ValueError,'R34_CANDIDATE_NO_ADMISSION'):
                m.scope_guard({**value,key:bad})

    def test_fake_obligation_completion_admission_action_and_provenance_refused(self):
        value=self.candidate()
        for key,bad in [('complete',True),('ownerAdmitted',True),('positiveOutputEnabled',True),
                        ('action','FULFILLED'),('gates',['INVENTED_OWNER_APPROVAL'])]:
            forged=copy.deepcopy(value)
            forged['obligations'][0][key]=bad
            with self.subTest(key=key), self.assertRaisesRegex(ValueError,'R34_OBLIGATION_NO_ADMISSION'):
                m.scope_guard(forged)

    def test_missing_gates_and_any_provenance_pin_ref_or_anchor_refused(self):
        value=self.candidate()
        for bad in [[],value['obligations'][0]['gates'][1:]]:
            forged=copy.deepcopy(value)
            forged['obligations'][0]['gates']=bad
            with self.assertRaisesRegex(ValueError,'R34_OBLIGATION_PINNED_GATES'):
                m.scope_guard(forged)
        for key in ['documentPins','checkedCurrentSourceRefs','historicalAnchors']:
            for attack in ['remove_one','empty','omit','extra','changed']:
                forged=copy.deepcopy(value)
                refs=forged['provenance'][key]
                if attack=='remove_one':
                    forged['provenance'][key]=refs[:-1]
                elif attack=='empty':
                    forged['provenance'][key]=[]
                elif attack=='omit':
                    del forged['provenance'][key]
                elif attack=='extra':
                    refs.append(copy.deepcopy(refs[0]))
                else:
                    refs[0]['sha256']='0'*64
                with self.subTest(key=key,attack=attack), self.assertRaisesRegex(ValueError,'R34_CANDIDATE_PROVENANCE'):
                    m.scope_guard(forged)
        forged=copy.deepcopy(value)
        forged['provenance']['ownerApproval']=True
        with self.assertRaisesRegex(ValueError,'R34_CANDIDATE_PROVENANCE'):
            m.scope_guard(forged)
        for area in ['requiredIds','deferredIds','obligations']:
            forged=copy.deepcopy(value)
            forged[area]=forged[area][:-1]+[forged[area][0]]
            with self.subTest(area=area), self.assertRaises(ValueError):
                m.scope_guard(forged)
        for key,bad in [('assessedHead','0'*40),('integrationBase','0'*40),('assessmentRenewed',True),
                        ('readerPlan','0'*40)]:
            forged=copy.deepcopy(value)
            forged['provenance'][key]=bad
            with self.subTest(key=key), self.assertRaisesRegex(ValueError,'R34_CANDIDATE_PROVENANCE'):
                m.scope_guard(forged)

    def test_false_or_wrong_original_historical_results_refused(self):
        p=m.parent()
        old=p.parent()
        release29=dict(status='PASS', historicalCheckerExit=0, historicalHead=old.PR33, historicalTree=old.PR33_TREE,
            checkerSHA256=old.CHECKER_SHA, acceptanceGranted=False, release='NO_GO',
            originalCurrentRefusal=dict(valid=False,error='R29_AFTER_EVIDENCE_TAIL',release='NO_GO'),
            qualification='INDEPENDENT_PINNED_CLONE_NORMAL_HOOKS_NO_HISTORICAL_CI_CLAIM')
        value=dict(status='PASS',historicalParentHead=p.BASE,historicalParentTree=p.BASE_TREE,
            parentCheckerSHA256=p.PARENT_SHA,acceptanceGranted=False,release='NO_GO',current33Proof='SEPARATE_VERIFY_REQUIRED',
            originalCurrent32Refusal=dict(valid=False,error='R32_HISTORY_PHASES',acceptanceGranted=False,release='NO_GO'),
            release29=release29,qualification='SUPPLIER_PINNED_HISTORICAL_CLONES_NOT_CURRENT33_OR_OWNER_ADMISSION')
        self.assertEqual(m.historical_result(m.json.dumps(value).encode()),value)
        for key,bad in [('acceptanceGranted',True),('release','GO'),('historicalParentHead','0'*40)]:
            with self.assertRaisesRegex(ValueError,'R34_HISTORICAL33_RESULT'):
                m.historical_result(m.json.dumps({**value,key:bad}).encode())
        forged=copy.deepcopy(value)
        forged['release29']['acceptanceGranted']=True
        with self.assertRaisesRegex(ValueError,'R33_HISTORICAL_RESULT'):
            m.historical_result(m.json.dumps(forged).encode())

    def test_duplicate_and_nonfinite_json_refused(self):
        for raw in [b'{"a":0,"a":1}',b'{"a":NaN}',b'{"a":Infinity}']:
            with self.assertRaises(ValueError):
                m.document(raw)


if __name__ == '__main__':
    unittest.main()
