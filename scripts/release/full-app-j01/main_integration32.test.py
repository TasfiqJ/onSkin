"""Finite synthetic event/diff controls; actual checkout proof is a separate run."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('integration32', Path(__file__).with_name('main_integration32.py'))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)


class Controls(unittest.TestCase):
    def setUp(self):
        self.head = 'a'*40; self.tree = 'b'*40; self.merge = 'c'*40
        self.env = dict(GITHUB_ACTIONS='true', GITHUB_REPOSITORY='TasfiqJ/onSkin', GITHUB_EVENT_NAME='pull_request',
                        GITHUB_REF='refs/pull/35/merge', GITHUB_SHA=self.merge)
        self.event = dict(number=35, repository=dict(full_name='TasfiqJ/onSkin'), pull_request=dict(number=35,
            base=dict(sha=m.BASE, ref='main'), head=dict(sha=self.head, ref=m.BRANCH, repo=dict(full_name='TasfiqJ/onSkin')),
            draft=True, maintainer_can_modify=False, auto_merge=None))

    def ci(self, env=None, event=None, head=None, parents=None, tree=None, live=None):
        return m.ci_guard(self.env if env is None else env, self.event if event is None else event,
            self.head if head is None else head, self.tree,
            [self.merge, m.BASE, self.head] if parents is None else parents,
            self.tree if tree is None else tree, dict(main=m.BASE, source=self.head) if live is None else live)

    def test_exact_pr_and_explicit_local(self):
        self.assertEqual(self.ci(), 'EXACT_EVENT_AND_LIVE_REFS')
        self.assertEqual(self.ci(env={}), 'LOCAL_EXACT_CHECKOUT_NOT_CI')

    def test_wrong_contexts(self):
        for key, value in [('GITHUB_EVENT_NAME', 'workflow_dispatch'), ('GITHUB_REPOSITORY', 'other/repo'),
                           ('GITHUB_REF', 'refs/heads/main')]:
            with self.subTest(key=key), self.assertRaises(ValueError): self.ci(env={**self.env, key:value})
        with self.assertRaisesRegex(ValueError, 'R32_LOCAL_CONTEXT'): self.ci(env={'GITHUB_SHA':self.head})

    def test_wrong_pr_custody_and_approval(self):
        for key, value in [('draft', False), ('maintainer_can_modify', True), ('auto_merge', {})]:
            e = copy.deepcopy(self.event); e['pull_request'][key] = value
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, 'R32_CI_EVENT'): self.ci(event=e)
        for area, key, value in [('base','sha','0'*40), ('base','ref','other'), ('head','sha','0'*40), ('head','ref','main')]:
            e = copy.deepcopy(self.event); e['pull_request'][area][key] = value
            with self.subTest(area=area,key=key), self.assertRaisesRegex(ValueError, 'R32_CI_EVENT'): self.ci(event=e)

    def test_stale_head_and_main(self):
        for live in [dict(main=m.BASE,source='0'*40), dict(main='0'*40,source=self.head), {}]:
            with self.assertRaisesRegex(ValueError, 'R32_STALE_HEAD'): self.ci(live=live)
        with self.assertRaisesRegex(ValueError, 'R32_CI_EVENT'): self.ci(head='0'*40)

    def test_fabricated_service_merge(self):
        for parents in [[self.merge,self.head,m.BASE], [self.merge,m.BASE,'0'*40], [self.merge,self.head]]:
            with self.assertRaisesRegex(ValueError, 'R32_CI_TEST_MERGE'): self.ci(parents=parents)
        with self.assertRaisesRegex(ValueError, 'R32_CI_TEST_MERGE'): self.ci(tree='0'*40)

    def test_push_main_is_distinct(self):
        env = {**self.env, 'GITHUB_EVENT_NAME':'push', 'GITHUB_SHA':self.head, 'GITHUB_REF':'refs/heads/main'}
        event = dict(repository=dict(full_name='TasfiqJ/onSkin'), ref='refs/heads/main', after=self.head)
        self.assertEqual(self.ci(env=env,event=event,live=dict(main=self.head)), 'EXACT_EVENT_AND_LIVE_REFS')
        with self.assertRaisesRegex(ValueError, 'R32_CI_PUSH'): self.ci(env=env,event=event,live=dict(main='0'*40))

    def test_finite_diff(self):
        def raw(path, mode='100644', status='M'):
            return (':100644 '+mode+' '+'1'*40+' '+'2'*40+' '+status+'\0'+path+'\0').encode()
        path = '.github/workflows/quality.yml'
        self.assertEqual(m.delta(raw(path),m.SOURCE),{path})
        for p in ['apps/mobile/package.json', '.github/workflows/security.yml', 'package-lock.json', m.PREFIX+'check.py']:
            with self.assertRaisesRegex(ValueError,'R32_FINITE_SCOPE'): m.delta(raw(p),m.SOURCE)
        for mode,status in [('100755','M'),('120000','M'),('000000','D'),('100644','R100')]:
            with self.assertRaisesRegex(ValueError,'R32_DIFF'): m.delta(raw(path,mode,status),m.SOURCE)
        with self.assertRaises(ValueError): m.delta(raw(path)+raw(path),m.SOURCE)

    def test_manifest_rejects_fabricated_acceptance_and_changed_code(self):
        value = dict(schema=1,authority='USER_CAMPAIGN32_MAIN_QUALITY_RECOVERY',base=m.BASE,baseTree=m.BASE_TREE,
                     planCommit=m.PLAN_COMMIT,sourceHashes={p:m.digest(b'synthetic') for p in m.SOURCE-{m.TASK}},
                     acceptanceGranted=False,admissions=dict.fromkeys(['G97','DB','M103','M2','NATIVE','J01','CLINICAL','PROVIDER','APPLE','PUBLIC'],False),
                     release='NO_GO',qualification='SOURCE_INTEGRITY_NOT_QUALIFIED_ACCEPTANCE')
        m.task_guard(value,lambda _:b'synthetic')
        for key,item in [('acceptanceGranted',True),('release','GO'),('base','0'*40),('schema',True)]:
            with self.assertRaises(ValueError): m.task_guard({**value,key:item},lambda _:b'synthetic')
        v=copy.deepcopy(value);v['admissions']['G97']=True
        with self.assertRaises(ValueError): m.task_guard(v,lambda _:b'synthetic')
        with self.assertRaisesRegex(ValueError,'R32_FROZEN_SOURCE'): m.task_guard(value,lambda _:b'changed')
        with self.assertRaisesRegex(ValueError,'R32_HASH_INVENTORY'): m.task_guard({**value,'sourceHashes':{}},lambda _:b'synthetic')

    def test_json_refuses_duplicates_and_nonfinite(self):
        for raw in [b'{"a":0,"a":1}',b'{"a":NaN}']:
            with self.assertRaises(ValueError): m.document(raw)

    def test_phase_machine_rejects_extra_source_and_post_seal_changes(self):
        source='a'*40; seal='b'*40; commits=[m.PLAN_COMMIT,source,seal]
        parent=lambda c:[c,m.PLAN_COMMIT if c==source else source]
        changes=lambda a,b,_allowed:m.SOURCE if b==source else m.WORKLIST
        with patch.object(m,'parents',side_effect=parent),patch.object(m,'changed',side_effect=changes):
            self.assertEqual(m.phase_guard(commits),(source,seal))
            for invalid in [commits+[self.head],commits[:2],['0'*40,source,seal]]:
                with self.assertRaisesRegex(ValueError,'R32_HISTORY_PHASES'):m.phase_guard(invalid)
            with patch.object(m,'parents',return_value=[source,'0'*40]),self.assertRaisesRegex(ValueError,'R32_LINEAR_HISTORY'):
                m.phase_guard(commits)
            with patch.object(m,'changed',return_value=m.SOURCE|m.WORKLIST),self.assertRaisesRegex(ValueError,'R32_SOURCE_THEN_SEAL'):
                m.phase_guard(commits)

    def test_stale_or_forged_worklist(self):
        value=dict(gitSha=self.head,gitStatus='',strict=True,blockers=[])
        m.worklist_guard(value,self.head)
        for key,bad in [('gitSha','0'*40),('gitStatus','dirty'),('strict',False),('blockers',['open'])]:
            with self.assertRaisesRegex(ValueError,'R32_WORKLIST_SOURCE'):m.worklist_guard({**value,key:bad},self.head)

    def test_filter_commands_are_neutralized_not_executed(self):
        from types import SimpleNamespace
        with patch.object(m.subprocess,'run',return_value=SimpleNamespace(returncode=0,stdout=b'filter.lfs.clean\0filter.lfs.process\0')):
            result=m.filter_overrides()
            self.assertIn('filter.lfs.clean=',result);self.assertIn('filter.lfs.process=',result)
            self.assertIn('filter.lfs.required=false',result)
        for raw in [b'filter.bad;command.clean\0',b'x'*65537]:
            with patch.object(m.subprocess,'run',return_value=SimpleNamespace(returncode=0,stdout=raw)),self.assertRaises(ValueError):
                m.filter_overrides()


if __name__ == '__main__':
    unittest.main()
