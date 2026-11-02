"""Independent current39 boundary controls. Synthetic events are pure fixtures only."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('current39', Path(__file__).with_name('main_integration39.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class AdmissionControls(unittest.TestCase):
    def test_builtin_read_token_only_in_hosted_context_and_never_forwarded_to_history(self):
        token='ghs_synthetic_fixture_not_a_real_credential'
        self.assertNotIn('Authorization',m.github_headers({'GH_TOKEN':token}))
        self.assertEqual(m.github_headers({'GITHUB_ACTIONS':'true','GH_TOKEN':token})['Authorization'],
                         'Bearer '+token)
        for bad in ('','short',token+'\n',token+' ',True):
            with self.subTest(tokenKind=type(bad).__name__),self.assertRaisesRegex(ValueError,'R39_CI_READ_TOKEN'):
                m.github_headers({'GITHUB_ACTIONS':'true','GH_TOKEN':bad})
        with patch.dict(m.os.environ,{'GH_TOKEN':token}):
            self.assertNotIn('GH_TOKEN',m.primitives().clean_environment())

    def setUp(self):
        self.bodies = {p: ('public synthetic fixture '+p).encode() for p in m.SOURCE-{m.TASK}}
        self.task = dict(schema=1, authority=m.AUTHORITY, base=m.BASE, baseTree=m.BASE_TREE,
            planCommit=m.PLAN_COMMIT, sourceHashes={p:m.digest(b) for p,b in self.bodies.items()},
            commands=[dict(command=['node','--version'],exit=0,qualification='SYNTHETIC_TEST_ONLY',logSha256=None)],
            acceptanceGranted=False, admissions=dict.fromkeys(m.ADMISSIONS,False), release='NO_GO',
            qualification='SOURCE_INTEGRITY_NOT_QUALIFIED_ACCEPTANCE')
        self.head, self.tree, self.merge = 'a'*40, 'b'*40, 'c'*40
        repo = dict(full_name='TasfiqJ/onSkin')
        self.pr = dict(number=42,state='open',draft=True,merged=False,merged_at=None,closed_at=None,
            merge_commit_sha=self.merge,
            maintainer_can_modify=False,auto_merge=None,head=dict(sha=self.head,ref=m.BRANCH,repo=repo),
            base=dict(sha=m.BASE,ref=m.PARENT_BRANCH,repo=repo))
        self.env = dict(GITHUB_ACTIONS='true',GITHUB_EVENT_NAME='pull_request',GITHUB_REPOSITORY='TasfiqJ/onSkin',
            GITHUB_REF='refs/pull/42/merge',GITHUB_SHA=self.merge)
        self.event = dict(number=42,repository=repo,pull_request=copy.deepcopy(self.pr))
        self.live = dict(main=m.MAIN,source=self.head,**{'pr'+str(n):p[0] for n,p in m.PINS.items()})

    def ci(self, **overrides):
        args = dict(env=self.env,event=self.event,head=self.head,tree=self.tree,
            merge=[self.merge,m.BASE,self.head],merge_tree=self.tree,live=self.live,live_pr=self.pr)
        args.update(overrides)
        return m.ci_guard(**args)

    def test_exact_task_and_no_self_hash_cycle(self):
        m.task_guard(self.task,self.bodies.__getitem__)
        self.assertEqual(len(m.SOURCE),9)
        self.assertEqual(len(m.GRANT),12)
        self.assertNotIn(m.TASK,self.task['sourceHashes'])

    def test_fabricated_approval_release_authority_and_parent_refuse(self):
        for key,bad in [('acceptanceGranted',True),('release','GO'),('authority','new grant'),
            ('base','0'*40),('baseTree','0'*40),('planCommit','0'*40),('schema',True),
            ('qualification','ACCEPTED')]:
            value=copy.deepcopy(self.task);value[key]=bad
            with self.subTest(key=key),self.assertRaises(ValueError):m.task_guard(value,self.bodies.__getitem__)
        for gate in m.ADMISSIONS:
            value=copy.deepcopy(self.task);value['admissions'][gate]=True
            with self.subTest(gate=gate),self.assertRaises(ValueError):m.task_guard(value,self.bodies.__getitem__)

    def test_omitted_extra_malformed_source_hashes_and_changed_bytes_refuse(self):
        path=next(iter(m.ESSENTIAL-{m.TASK}))
        values=[]
        for edit in ('omit','extra','malformed','fake'):
            value=copy.deepcopy(self.task)
            if edit=='omit':del value['sourceHashes'][path]
            elif edit=='extra':value['sourceHashes']['out-of-grant.txt']='0'*64
            else:value['sourceHashes'][path]='not a hash' if edit=='malformed' else '0'*64
            values.append(value)
        for value in values:
            with self.assertRaises(ValueError):m.task_guard(value,self.bodies.__getitem__)
        with self.assertRaisesRegex(ValueError,'R39_SOURCE_HASH'):
            m.task_guard(self.task,lambda p:self.bodies[p]+b' changed')

    def test_duplicate_nonfinite_unknown_task_document_refuses(self):
        for raw in (b'{"schema":1,"schema":1}',b'{"schema":NaN}',b'{"schema":Infinity}'):
            with self.assertRaises(ValueError):m.document(raw)
        for key in ('approval','finalFiles','grantExpansion'):
            with self.assertRaisesRegex(ValueError,'R39_TASK_SCHEMA'):
                m.task_guard(dict(self.task,**{key:True}),self.bodies.__getitem__)

    def test_local_evidence_has_explicit_non_ci_qualification(self):
        live={k:v for k,v in self.live.items() if k!='source'}
        self.assertEqual(self.ci(env={},live=live),'LOCAL_EXACT_CHECKOUT_NOT_HOSTED_CI')
        for env in ({'GITHUB_SHA':self.head},{'GITHUB_ACTIONS':'false'},{'GITHUB_EVENT_NAME':'pull_request'}):
            with self.assertRaises(ValueError):self.ci(env=env,live=live)
        self.assertEqual(self.ci(),'GENUINE_EVENT_LIVE_PR_REFS_SERVICE_TEST_MERGE')

    def test_wrong_event_repository_branch_and_unqualified_pr_refuse(self):
        for key,bad in [('GITHUB_EVENT_NAME','push'),('GITHUB_EVENT_NAME','workflow_dispatch'),
            ('GITHUB_REPOSITORY','other/repo'),('GITHUB_REF','refs/heads/main'),('GITHUB_SHA','not-an-object')]:
            with self.subTest(key=key,bad=bad),self.assertRaises(ValueError):self.ci(env=dict(self.env,**{key:bad}))
        for location in ('event','live'):
            for key,bad in [('draft',False),('state','closed'),('merged',True),('merged_at','now'),
                ('closed_at','now'),('maintainer_can_modify',True),('auto_merge',{}),('number',True),('number',40)]:
                event,live=copy.deepcopy(self.event),copy.deepcopy(self.pr)
                (event['pull_request'] if location=='event' else live)[key]=bad
                with self.subTest(location=location,key=key),self.assertRaises(ValueError):self.ci(event=event,live_pr=live)
        for location,key,bad in [('head','sha','0'*40),('head','ref',m.PARENT_BRANCH),('head','repo',dict(full_name='other/repo')),
            ('base','sha','0'*40),('base','ref','main'),('base','repo',dict(full_name='other/repo'))]:
            event=copy.deepcopy(self.event);event['pull_request'][location][key]=bad
            with self.subTest(location=location,key=key),self.assertRaises(ValueError):self.ci(event=event)

    def test_stale_main_parents_source_and_invalid_service_merge_refuse(self):
        for key in self.live:
            with self.subTest(ref=key),self.assertRaisesRegex(ValueError,'R39_STALE_REFS'):
                self.ci(live=dict(self.live,**{key:'0'*40}))
        for merge in ([self.merge,self.head,m.BASE],[self.merge,m.BASE,'0'*40],
            [self.merge,m.BASE,self.head,'d'*40],[self.head,m.BASE,self.head]):
            with self.assertRaisesRegex(ValueError,'R39_SERVICE_TEST_MERGE'):self.ci(merge=merge)
        with self.assertRaisesRegex(ValueError,'R39_SERVICE_TEST_MERGE'):self.ci(merge_tree='0'*40)
        for sha in (None, '0'*40, self.head):
            bad=copy.deepcopy(self.pr);bad['merge_commit_sha']=sha
            with self.subTest(liveMerge=sha),self.assertRaisesRegex(ValueError,'R39_SERVICE_TEST_MERGE'):
                self.ci(live_pr=bad)

    def test_service_merge_requires_the_exact_live_github_merge_ref(self):
        ref='refs/pull/42/merge'
        raw=(self.merge+'\t'+ref+'\n').encode()
        m.service_merge_ref_guard(raw,ref,self.merge)
        for bad in (b'',raw+raw,raw.replace(self.merge.encode(),self.head.encode()),
                    raw.replace(b'/merge',b'/head'),raw+b'forged trailing data\n'):
            with self.assertRaisesRegex(ValueError,'R39_SERVICE_MERGE_REF'):
                m.service_merge_ref_guard(bad,ref,self.merge)

    def test_parent_pr_custody_checks_base_and_exact_open_draft_source(self):
        for n,pin in m.PINS.items():
            prior=m.PINS[n-1] if n>35 else (m.MAIN,'','main')
            pr=copy.deepcopy(self.pr);pr.update(number=n)
            pr['head'].update(sha=pin[0],ref=pin[2]);pr['base'].update(sha=prior[0],ref=prior[2])
            m.pr_guard(pr,n,pin[0],pin[2],prior[0],prior[2])
            for key in ('head','base'):
                bad=copy.deepcopy(pr);bad[key]['sha']='0'*40
                with self.assertRaises(ValueError):m.pr_guard(bad,n,pin[0],pin[2],prior[0],prior[2])

    def test_terminal_test_interval_cannot_be_extended_truncated_skipped_or_faked(self):
        raw=b'1..31\n# tests 31\n# pass 2\n# fail 29\n# cancelled 0\n# skipped 0\n# todo 0\n'
        m.test_summary(raw,31,2,29)
        for bad in (raw.replace(b'tests 31',b'tests 32'),raw.replace(b'fail 29',b'fail 0'),
            raw.replace(b'skipped 0',b'skipped 29'),raw+b'# pass 2\n',raw.replace(b'# todo 0\n',b'')):
            with self.assertRaisesRegex(ValueError,'R39_TEST_INTERVAL'):m.test_summary(bad,31,2,29)

    def test_fabricated_historical_success_without_authentic_execution_details_refuses(self):
        prefix=b'R35_HISTORICAL_WORKSPACE /synthetic-unit-fixture\nR35_EXACT_PR39_FULL_CLONE_AUTHENTICATED\nR35_PR39_NORMAL_INSTALL_AND_HOOKS_PASS\n'
        for value in ({'status':'PASS'},dict(self.task,status='PASS'),
            dict(self.task,status='PASS',historicalHead=m.BASE,historicalTree=m.BASE_TREE),
            dict(self.task,status='PASS',historicalHead=m.PINS[37][0],historicalTree=m.PINS[37][1],
                 checkerSHA256=m.PROGRAMS['main_integration34.py'],receipts=[])):
            with self.assertRaises(ValueError):m.historical_result(prefix+json.dumps(value).encode())
        with self.assertRaises(ValueError):m.historical_result(json.dumps({'status':'PASS'}).encode())

    def test_historical38_stale_inventory_failure_remains_exact_failure(self):
        raw=(b'Execution baseline validation failed (1):\n'
            b'- docs/hugeToDo/feature-inventory.json is stale. Run node scripts/launch/build-execution-baseline.mjs and review the diff.\n')
        value=m.stale_inventory_refusal(raw)
        self.assertEqual(value['exit'],1)
        self.assertTrue(value['onlyStaleFeatureInventory'])
        self.assertFalse(value['acceptanceGranted'])
        self.assertEqual(value['release'],'NO_GO')
        for bad in (b'',raw.replace(b'failed (1)',b'valid'),raw.replace(b'feature-inventory',b'task-graph'),
            raw+b'ignored failure\n',raw.replace(b'failed (1)',b'failed (2)')):
            with self.subTest(raw=bad),self.assertRaises(ValueError):m.stale_inventory_refusal(bad)

    def test_frozen_scope_rejects_fabricated_completion_missing_or_duplicate_rows(self):
        names=('contract.v2.json','matrix.v2.json','precedence.v2.json','roadmap.v2.json','owner-ledger33.v1.json')
        bundle={n:m.document(m.git('show',m.BASE+':'+m.DOCS+n)) for n in names}
        value=m.scope_guard(bundle)
        self.assertEqual((value['requiredRows'],len(value['unadmittedGates'])),(38,18))
        for key in ('complete','positive_output_enabled','owner_admitted'):
            bad=copy.deepcopy(bundle);bad['matrix.v2.json']['rows'][0][key]=True
            with self.assertRaises(ValueError):m.scope_guard(bad)
        for change in ('omit','duplicate','gate','release'):
            bad=copy.deepcopy(bundle)
            if change=='omit':bad['matrix.v2.json']['rows'].pop()
            elif change=='duplicate':bad['matrix.v2.json']['rows'][-1]=copy.deepcopy(bad['matrix.v2.json']['rows'][0])
            elif change=='gate':bad['owner-ledger33.v1.json']['gates'][0]['admitted']=True
            else:bad['contract.v2.json']['release_status']='GO'
            with self.assertRaises(ValueError):m.scope_guard(bad)


    def test_command_ledger_refuses_missing_malformed_and_boolean_exits(self):
        for commands in ([], None, [{}], [dict(command=[],exit=0,qualification='fixture',logSha256=None)],
                         [dict(command=['test'],exit=True,qualification='fixture',logSha256=None)],
                         [dict(command=['test'],exit=0,qualification='fixture',logSha256='0'*63)]):
            value=copy.deepcopy(self.task); value['commands']=commands
            with self.subTest(commands=commands),self.assertRaisesRegex(ValueError,'R39_COMMAND_LEDGER'):
                m.task_guard(value,self.bodies.__getitem__)

    def test_every_source_member_is_required(self):
        for path in m.SOURCE-{m.TASK}:
            value=copy.deepcopy(self.task)
            del value['sourceHashes'][path]
            with self.subTest(path=path), self.assertRaisesRegex(ValueError,'R39_HASH_INVENTORY'):
                m.task_guard(value,self.bodies.__getitem__)



class InventoryControls(unittest.TestCase):
    def setUp(self):
        self.path='docs/hugeToDo/feature-inventory.json'
        self.before=m.git('show',m.BASE+':'+self.path)
        self.after=(m.ROOT/self.path).read_bytes()
        self.value=m.document(self.after)
        self.route='route:shelf/formula-history.tsx'

    def check(self,raw):
        return m.inventory_guard(raw,self.before)

    def test_exact_current_bytes_and_old_stale_bytes_are_distinct(self):
        self.check(self.after)
        self.assertEqual(m.digest(self.before),'620d798e86c2fd0f8adb810cac1b11eaa3a1d9551f14db474454bb49f6148178')
        self.assertEqual(m.digest(self.after),'166193bb73f389565aa141848546ee56e6f76967c0fdee3086dcc935772cf8a3')
        with self.assertRaises(ValueError):self.check(self.before)
        with self.assertRaises(ValueError):m.inventory_guard(self.after,self.after)

    def test_route_presence_mapping_source_count_and_readiness_upgrades_refuse(self):
        route=next(i for i,r in enumerate(self.value['items']) if r['id']==self.route)
        mutations=[('missing',lambda v:v['items'].pop(route)),
            ('duplicate',lambda v:v['items'].append(copy.deepcopy(v['items'][route])))]
        for ids in (['F-18'],['J05'],['F-03'],['F-04'],['F-04','F-03'],['F-03','F-04','F-18']):
            mutations.append(('mapping '+repr(ids),lambda v,ids=ids:v['items'][route].update(featureIds=ids)))
        for readiness in ('implemented','admitted','launch-blocked'):
            mutations.append(('readiness '+readiness,lambda v,r=readiness:v['items'][route].update(readiness=r)))
        mutations.extend([('wrong source',lambda v:v['items'][route].update(source='apps/mobile/src/app/shelf/history.tsx')),
            ('owner approval',lambda v:v['items'][route].update(ownerAdmitted=True))])
        for count in (93,95,True,'94',94.5):
            mutations.append(('count '+repr(count),lambda v,c=count:v['categoryCounts'].update(route=c)))
        for label,mutate in mutations:
            changed=copy.deepcopy(self.value);mutate(changed)
            with self.subTest(mutation=label),self.assertRaises(ValueError):self.check(json.dumps(changed).encode())

    def test_every_unrelated_scalar_and_member_is_frozen(self):
        def leaves(value,path=()):
            if isinstance(value,dict):
                return [p for k,v in value.items() for p in leaves(v,path+(k,))]
            if isinstance(value,list):
                return [p for i,v in enumerate(value) for p in leaves(v,path+(i,))]
            return [path]
        checked=0
        for path in leaves(self.value):
            if path==('categoryCounts','route'):continue
            if path[0]=='items' and self.value['items'][path[1]]['id']==self.route:continue
            changed=copy.deepcopy(self.value);target=changed
            for key in path[:-1]:target=target[key]
            key=path[-1];old=target[key]
            target[key]=not old if type(old) is bool else old+1 if type(old) is int else str(old)+'-tampered'
            with self.subTest(path=path),self.assertRaises(ValueError):self.check(json.dumps(changed).encode())
            checked+=1
        self.assertGreater(checked,2000)
        for key in self.value:
            changed=copy.deepcopy(self.value);del changed[key]
            with self.subTest(omitted=key),self.assertRaises(ValueError):self.check(json.dumps(changed).encode())
        changed=copy.deepcopy(self.value);changed['unauthorized']=True
        with self.assertRaises(ValueError):self.check(json.dumps(changed).encode())

    def test_noncanonical_bytes_or_order_cannot_be_sealed(self):
        for changed in (self.after+b'\n',json.dumps(self.value,sort_keys=True).encode()):
            with self.assertRaises(ValueError):self.check(changed)
        changed=copy.deepcopy(self.value);changed['items'].reverse()
        with self.assertRaises(ValueError):self.check(json.dumps(changed).encode())


if __name__ == '__main__':
    unittest.main()
