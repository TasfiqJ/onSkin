"""Synthetic event/manifest/phase refusals, separate from actual checkout proof."""
import copy
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('integration33', Path(__file__).with_name('main_integration33.py'))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)


class Controls(unittest.TestCase):
    def setUp(self):
        self.head = 'a'*40; self.tree = 'b'*40; self.merge = 'c'*40
        self.env = dict(GITHUB_ACTIONS='true', GITHUB_REPOSITORY='TasfiqJ/onSkin', GITHUB_EVENT_NAME='pull_request',
                        GITHUB_REF='refs/pull/36/merge', GITHUB_SHA=self.merge)
        self.event = dict(number=36, repository=dict(full_name='TasfiqJ/onSkin'), pull_request=dict(number=36,
            state='open', draft=True, merged=False, closed_at=None, merged_at=None,
            maintainer_can_modify=False, auto_merge=None,
            base=dict(sha=m.BASE, ref=m.PARENT_BRANCH),
            head=dict(sha=self.head, ref=m.BRANCH, repo=dict(full_name='TasfiqJ/onSkin'))))

    def ci(self, env=None, event=None, merge=None, tree=None, live=None):
        return m.ci_guard(self.env if env is None else env, self.event if event is None else event,
            self.head, self.tree, [self.merge,m.BASE,self.head] if merge is None else merge,
            self.tree if tree is None else tree,
            dict(main=m.MAIN,parent=m.BASE,source=self.head) if live is None else live)

    def test_exact_draft_pr_and_honest_local(self):
        self.assertEqual(self.ci(), 'EXACT_EVENT_LIVE_PARENT_AND_SOURCE')
        self.assertEqual(self.ci(env={}), 'LOCAL_EXACT_CHECKOUT_NOT_CI')
        with self.assertRaisesRegex(ValueError,'R33_LOCAL_CONTEXT'): self.ci(env={'GITHUB_SHA':self.head})

    def test_wrong_events_and_repository(self):
        for key,value in [('GITHUB_EVENT_NAME','push'),('GITHUB_EVENT_NAME','workflow_dispatch'),
                          ('GITHUB_REPOSITORY','other/repo'),('GITHUB_REF','refs/heads/main')]:
            with self.subTest(key=key,value=value),self.assertRaises(ValueError):self.ci(env={**self.env,key:value})

    def test_custody_and_wrong_base_head(self):
        for key,value in [('draft',False),('maintainer_can_modify',True),('auto_merge',{}),('merged',True),
                          ('state','closed'),('closed_at','date'),('merged_at','date'),('number',True)]:
            event=copy.deepcopy(self.event);event['pull_request'][key]=value
            with self.subTest(key=key),self.assertRaisesRegex(ValueError,'R33_CI_EVENT'):self.ci(event=event)
        for area,key,value in [('base','sha','0'*40),('base','ref','main'),('head','sha','0'*40),('head','ref',m.PARENT_BRANCH)]:
            event=copy.deepcopy(self.event);event['pull_request'][area][key]=value
            with self.assertRaisesRegex(ValueError,'R33_CI_EVENT'):self.ci(event=event)

    def test_stale_live_refs_and_fake_merge(self):
        for key in ['main','parent','source']:
            live=dict(main=m.MAIN,parent=m.BASE,source=self.head);live[key]='0'*40
            with self.assertRaisesRegex(ValueError,'R33_STALE_HEAD_OR_PARENT'):self.ci(live=live)
        for merge in [[self.merge,self.head,m.BASE],[self.merge,m.BASE,'0'*40],[self.merge,self.head]]:
            with self.assertRaisesRegex(ValueError,'R33_CI_TEST_MERGE'):self.ci(merge=merge)
        with self.assertRaisesRegex(ValueError,'R33_CI_TEST_MERGE'):self.ci(tree='0'*40)

    def test_manifest_false_admission_and_hash_inventory(self):
        value=dict(schema=1,authority=m.AUTHORITY,base=m.BASE,baseTree=m.BASE_TREE,planCommit=m.PLAN_COMMIT,
            sourceHashes={p:m.digest(b'synthetic') for p in m.SOURCE-{m.TASK}},acceptanceGranted=False,
            admissions=dict.fromkeys(m.ADMISSIONS,False),release='NO_GO',qualification='SOURCE_INTEGRITY_NOT_QUALIFIED_ACCEPTANCE')
        m.task_guard(value,lambda _:b'synthetic')
        for key,bad in [('schema',True),('release','GO'),('acceptanceGranted',True),('base','0'*40),('planCommit','0'*40)]:
            with self.assertRaises(ValueError):m.task_guard({**value,key:bad},lambda _:b'synthetic')
        for gate in m.ADMISSIONS:
            forged=copy.deepcopy(value);forged['admissions'][gate]=True
            with self.assertRaisesRegex(ValueError,'R33_NO_ADMISSION'):m.task_guard(forged,lambda _:b'synthetic')
        with self.assertRaisesRegex(ValueError,'R33_HASH_INVENTORY'):m.task_guard({**value,'sourceHashes':{}},lambda _:b'synthetic')
        with self.assertRaisesRegex(ValueError,'R33_FROZEN_SOURCE'):m.task_guard(value,lambda _:b'changed')

    def test_linear_source_then_only_worklist_seal(self):
        source='a'*40;seal='b'*40;commits=[m.PLAN_COMMIT,source,seal]
        parent=lambda c:[c,m.PLAN_COMMIT if c==source else source]
        delta=lambda before,after,allowed:m.SOURCE if after==source else m.WORKLIST
        with patch.object(m,'parents',side_effect=parent),patch.object(m,'changed',side_effect=delta):
            self.assertEqual(m.phase_guard(commits),(source,seal))
            for bad in [commits[:2],['0'*40,source,seal],[m.PLAN_COMMIT,source,source,seal]]:
                with self.assertRaisesRegex(ValueError,'R33_HISTORY_PHASES'):m.phase_guard(bad)
            with patch.object(m,'parents',return_value=[source,'0'*40]),self.assertRaisesRegex(ValueError,'R33_LINEAR_HISTORY'):
                m.phase_guard(commits)
            with patch.object(m,'changed',return_value=m.SOURCE|m.WORKLIST),self.assertRaisesRegex(ValueError,'R33_SOURCE_THEN_SEAL'):
                m.phase_guard(commits)

    def test_finite_delta_refuses_protected_files_modes_and_renames(self):
        def raw(path,mode='100644',status='M'):
            return (':100644 '+mode+' '+'1'*40+' '+'2'*40+' '+status+'\0'+path+'\0').encode()
        delta=m.parent().delta
        self.assertEqual(delta(raw('PROGRESS.md'),m.SOURCE),{'PROGRESS.md'})
        for name in ['apps/mobile/app.config.js','.github/workflows/security.yml',m.PREFIX+'check.py',m.PLAN]:
            with self.assertRaises(ValueError):delta(raw(name),m.SOURCE)
        for mode,status in [('120000','M'),('100755','M'),('000000','D'),('100644','R100')]:
            with self.assertRaises(ValueError):delta(raw('PROGRESS.md',mode,status),m.SOURCE)

    def test_json_duplicate_and_nonfinite_refusal(self):
        for raw in [b'{"a":0,"a":1}',b'{"a":NaN}']:
            with self.assertRaises(ValueError):m.document(raw)


if __name__ == '__main__':
    unittest.main()
