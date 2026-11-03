"""Current45 pure boundary tests. All event/approval objects below are synthetic fixtures."""
import copy
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('current45',Path(__file__).with_name('main_integration45.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class PriorSealControls(unittest.TestCase):
    def test_previous_seal_identity_and_delta_are_both_required(self):
        seal, parent, tree = m.PREVIOUS_SEALS[0]
        with patch.object(m, 'text', return_value=tree), patch.object(m, 'parents', return_value=[seal,parent]), \
             patch.object(m, 'changed', return_value=m.WORKLIST) as delta:
            m.previous_seal_guard(seal,parent,tree)
            delta.assert_called_once_with(parent,seal,m.WORKLIST)
        for actual_tree, actual_parents, actual_delta in (
            ('0'*40,[seal,parent],m.WORKLIST), (tree,[seal,m.BASE],m.WORKLIST),
            (tree,[seal,parent],set()), (tree,[seal,parent],m.WORKLIST|{'source.ts'})):
            with self.subTest(tree=actual_tree,parents=actual_parents,delta=actual_delta), \
                 patch.object(m,'text',return_value=actual_tree),patch.object(m,'parents',return_value=actual_parents), \
                 patch.object(m,'changed',return_value=actual_delta),self.assertRaises(ValueError):
                m.previous_seal_guard(seal,parent,tree)

    def test_policy_and_32_commit_cap_refuse_before_any_git_admission(self):
        row=m.PREVIOUS_SEALS[0]
        for policy in ([row], (row,row), ((row[0],row[1],'not-a-tree'),), ((row[0],),)):
            with self.subTest(policy=policy),patch.object(m,'PREVIOUS_SEALS',policy), \
                 patch.object(m,'parents',side_effect=AssertionError('invalid policy must not query ancestry')), \
                 self.assertRaisesRegex(ValueError,'R45_PREVIOUS_SEAL_POLICY'):
                m.phase_guard([m.PLAN_COMMIT,'f'*40],'SOURCE_PENDING',m.SOURCE)
        history=[m.PLAN_COMMIT]+[format(value,'040x') for value in range(1,33)]
        with patch.object(m,'parents',side_effect=AssertionError('cap must precede ancestry')), \
             self.assertRaisesRegex(ValueError,'R45_HISTORY_PHASES'):
            m.phase_guard(history,'SOURCE_PENDING',m.SOURCE)

    def test_known_seal_is_excluded_only_from_source_union_and_new_last_seal_is_mandatory(self):
        base,plan,source,older,repair,final,tree=[value*40 for value in '1234567']
        allowed={'a.ts','b.ts'};worklist={'w.json','w.md'}
        ancestry={source:[source,plan],older:[older,source],repair:[repair,older],final:[final,repair]}
        deltas={(plan,source):allowed,(source,older):worklist,(older,repair):{'a.ts'},
                (repair,final):worklist,(base,repair):allowed|{'plan.md'}|worklist}
        calls=[]
        def changed(before,after,permitted):
            result=deltas[(before,after)]
            m.need(result<=permitted,'SYNTHETIC_FINITE_DELTA')
            calls.append((before,after,permitted));return result
        with patch.object(m,'BASE',base),patch.object(m,'PLAN_COMMIT',plan),patch.object(m,'PLAN','plan.md'), \
             patch.object(m,'SOURCE',allowed),patch.object(m,'ESSENTIAL',allowed),patch.object(m,'WORKLIST',worklist), \
             patch.object(m,'PREVIOUS_SEALS',((older,source,tree),)),patch.object(m,'text',return_value=tree), \
             patch.object(m,'parents',side_effect=ancestry.__getitem__),patch.object(m,'changed',side_effect=changed):
            self.assertEqual(m.phase_guard([plan,source,older,repair],'SOURCE_PENDING',allowed),(repair,None))
            self.assertEqual(m.phase_guard([plan,source,older,repair,final],'SOURCE_FROZEN',allowed),(repair,final))
            self.assertIn((base,repair,allowed|{'plan.md'}|worklist),calls)
            for history,phase in (([plan,source,older],'SOURCE_PENDING'),
                                  ([plan,source,older],'SOURCE_FROZEN'),
                                  ([plan,source,older,repair,final],'SOURCE_PENDING')):
                with self.subTest(history=history,phase=phase),self.assertRaises(ValueError):
                    m.phase_guard(history,phase,allowed)


class AdmissionControls(unittest.TestCase):
    def test_builtin_read_token_only_in_hosted_context_and_never_forwarded_to_history(self):
        token='ghs_synthetic_fixture_not_a_real_credential'
        self.assertNotIn('Authorization',m.original44().github_headers({'GH_TOKEN':token}))
        self.assertEqual(m.original44().github_headers({'GITHUB_ACTIONS':'true','GH_TOKEN':token})['Authorization'],
                         'Bearer '+token)
        for bad in ('','short',token+'\n',token+' ',True):
            with self.subTest(tokenKind=type(bad).__name__),self.assertRaisesRegex(ValueError,'R44_CI_READ_TOKEN'):
                m.original44().github_headers({'GITHUB_ACTIONS':'true','GH_TOKEN':bad})
        with patch.dict(m.os.environ,{'GH_TOKEN':token}):
            self.assertNotIn('GH_TOKEN',m.primitives().clean_environment())


    def setUp(self):
        self.bodies = {p: ('public synthetic fixture '+p).encode() for p in m.SOURCE-{m.TASK}}
        self.task = dict(schema=1, authority=m.AUTHORITY, additionalAuthorization=m.REPAIR_AUTHORITY,
            closureAuthorization=m.CLOSURE_AUTHORITY, base=m.BASE, baseTree=m.BASE_TREE,
            planCommit=m.PLAN_COMMIT, sourceHashes={p:m.digest(b) for p,b in self.bodies.items()},
            commands=[dict(command=['node','--version'],exit=0,qualification='SYNTHETIC_TEST_ONLY',logSha256=None)],
            acceptanceGranted=False, admissions=dict.fromkeys(m.ADMISSIONS,False), release='NO_GO',
            qualification='SOURCE_INTEGRITY_NOT_QUALIFIED_ACCEPTANCE')
        self.head, self.tree, self.merge = 'a'*40, 'b'*40, 'c'*40
        repo = dict(full_name='TasfiqJ/onSkin')
        self.pr = dict(number=46,state='open',draft=True,merged=False,merged_at=None,closed_at=None,
            merge_commit_sha=self.merge,
            maintainer_can_modify=False,auto_merge=None,head=dict(sha=self.head,ref=m.BRANCH,repo=repo),
            base=dict(sha=m.BASE,ref=m.PARENT_BRANCH,repo=repo))
        self.env = dict(GITHUB_ACTIONS='true',GITHUB_EVENT_NAME='pull_request',GITHUB_REPOSITORY='TasfiqJ/onSkin',
            GITHUB_REF='refs/pull/46/merge',GITHUB_SHA=self.merge)
        self.event = dict(number=46,repository=repo,pull_request=copy.deepcopy(self.pr))
        self.live = dict(main=m.MAIN,source=self.head,**{'pr'+str(n):p[0] for n,p in m.pins().items()})


    def ci(self, **overrides):
        args = dict(env=self.env,event=self.event,head=self.head,tree=self.tree,
            merge=[self.merge,m.BASE,self.head],merge_tree=self.tree,live=self.live,live_pr=self.pr)
        args.update(overrides)
        return m.ci_guard(**args)


    def test_exact_task_and_no_self_hash_cycle(self):
        m.task_guard(self.task,self.bodies.__getitem__)
        self.assertEqual(len(m.SOURCE),43)
        self.assertEqual(len(m.GRANT),46)
        self.assertEqual(len(m.CLOSURE_PATHS),5)
        self.assertNotIn(m.TASK,self.task['sourceHashes'])





    def test_fabricated_approval_release_authority_and_parent_refuse(self):
        for key,bad in [('acceptanceGranted',True),('release','GO'),('authority','new grant'),
            ('additionalAuthorization','unissued extension'),
            ('closureAuthorization','unissued task mandate'),
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
        with self.assertRaisesRegex(ValueError,'R45_SOURCE_HASH'):
            m.task_guard(self.task,lambda p:self.bodies[p]+b' changed')


    def test_duplicate_nonfinite_unknown_task_document_refuses(self):
        for raw in (b'{"schema":1,"schema":1}',b'{"schema":NaN}',b'{"schema":Infinity}'):
            with self.assertRaises(ValueError):m.document(raw)
        for key in ('approval','finalFiles','grantExpansion'):
            with self.assertRaisesRegex(ValueError,'R45_TASK_SCHEMA'):
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
            with self.subTest(ref=key),self.assertRaisesRegex(ValueError,'R45_STALE_REFS'):
                self.ci(live=dict(self.live,**{key:'0'*40}))
        for merge in ([self.merge,self.head,m.BASE],[self.merge,m.BASE,'0'*40],
            [self.merge,m.BASE,self.head,'d'*40],[self.head,m.BASE,self.head]):
            with self.assertRaisesRegex(ValueError,'R45_SERVICE_TEST_MERGE'):self.ci(merge=merge)
        with self.assertRaisesRegex(ValueError,'R45_SERVICE_TEST_MERGE'):self.ci(merge_tree='0'*40)
        for sha in (None, '0'*40, self.head):
            bad=copy.deepcopy(self.pr);bad['merge_commit_sha']=sha
            with self.subTest(liveMerge=sha),self.assertRaisesRegex(ValueError,'R45_SERVICE_TEST_MERGE'):
                self.ci(live_pr=bad)


    def test_service_merge_requires_the_exact_live_github_merge_ref(self):
        ref='refs/pull/46/merge'
        raw=(self.merge+'\t'+ref+'\n').encode()
        m.original44().original41().service_merge_ref_guard(raw,ref,self.merge)
        for bad in (b'',raw+raw,raw.replace(self.merge.encode(),self.head.encode()),
                    raw.replace(b'/merge',b'/head'),raw+b'forged trailing data\n'):
            with self.assertRaisesRegex(ValueError,'R41_SERVICE_MERGE_REF'):
                m.original44().original41().service_merge_ref_guard(bad,ref,self.merge)


    def test_parent_pr_custody_checks_base_and_exact_open_draft_source(self):
        for n,pin in m.pins().items():
            prior=m.pins()[n-1] if n>35 else (m.MAIN,'','main')
            pr=copy.deepcopy(self.pr);pr.update(number=n)
            pr['head'].update(sha=pin[0],ref=pin[2]);pr['base'].update(sha=prior[0],ref=prior[2])
            m.original44().original41().pr_guard(pr,n,pin[0],pin[2],prior[0],prior[2])
            for key in ('head','base'):
                bad=copy.deepcopy(pr);bad[key]['sha']='0'*40
                with self.assertRaises(ValueError):m.original44().original41().pr_guard(bad,n,pin[0],pin[2],prior[0],prior[2])


    def test_terminal_test_interval_cannot_be_extended_truncated_skipped_or_faked(self):
        raw=b'1..31\n# tests 31\n# pass 2\n# fail 29\n# cancelled 0\n# skipped 0\n# todo 0\n'
        m.original44().original41().test_summary(raw,31,2,29)
        for bad in (raw.replace(b'tests 31',b'tests 32'),raw.replace(b'fail 29',b'fail 0'),
            raw.replace(b'skipped 0',b'skipped 29'),raw+b'# pass 2\n',raw.replace(b'# todo 0\n',b'')):
            with self.assertRaisesRegex(ValueError,'R41_TEST_INTERVAL'):m.original44().original41().test_summary(bad,31,2,29)


    def test_fabricated_historical_success_without_authentic_execution_details_refuses(self):
        prefix=b'R35_HISTORICAL_WORKSPACE /synthetic-unit-fixture\nR35_EXACT_PR45_FULL_CLONE_AUTHENTICATED\nR35_PR45_NORMAL_INSTALL_AND_HOOKS_PASS\n'
        for value in ({'status':'PASS'},dict(self.task,status='PASS'),
            dict(self.task,status='PASS',historicalHead=m.BASE,historicalTree=m.BASE_TREE),
            dict(self.task,status='PASS',historicalHead=m.pins()[37][0],historicalTree=m.pins()[37][1],
                 checkerSHA256=m.original44().original41().PROGRAMS['main_integration34.py'],receipts=[])):
            with self.assertRaises(ValueError):m.historical_result(prefix+json.dumps(value).encode())
        with self.assertRaises(ValueError):m.historical_result(json.dumps({'status':'PASS'}).encode())


    def test_frozen_scope_rejects_fabricated_completion_missing_or_duplicate_rows(self):
        names=('contract.v2.json','matrix.v2.json','precedence.v2.json','roadmap.v2.json','owner-ledger33.v1.json')
        bundle={n:m.document(m.git('show',m.BASE+':'+m.DOCS+n)) for n in names}
        value=m.original44().original41().scope_guard(bundle)
        self.assertEqual((value['requiredRows'],len(value['unadmittedGates'])),(38,18))
        for key in ('complete','positive_output_enabled','owner_admitted'):
            bad=copy.deepcopy(bundle);bad['matrix.v2.json']['rows'][0][key]=True
            with self.assertRaises(ValueError):m.original44().original41().scope_guard(bad)
        for change in ('omit','duplicate','gate','release'):
            bad=copy.deepcopy(bundle)
            if change=='omit':bad['matrix.v2.json']['rows'].pop()
            elif change=='duplicate':bad['matrix.v2.json']['rows'][-1]=copy.deepcopy(bad['matrix.v2.json']['rows'][0])
            elif change=='gate':bad['owner-ledger33.v1.json']['gates'][0]['admitted']=True
            else:bad['contract.v2.json']['release_status']='GO'
            with self.assertRaises(ValueError):m.original44().original41().scope_guard(bad)


    def test_command_ledger_refuses_missing_malformed_and_boolean_exits(self):
        for commands in ([], None, [{}], [dict(command=[],exit=0,qualification='fixture',logSha256=None)],
                         [dict(command=['test'],exit=True,qualification='fixture',logSha256=None)],
                         [dict(command=['test'],exit=0,qualification='fixture',logSha256='0'*63)]):
            value=copy.deepcopy(self.task); value['commands']=commands
            with self.subTest(commands=commands),self.assertRaisesRegex(ValueError,'R45_COMMAND_LEDGER'):
                m.task_guard(value,self.bodies.__getitem__)


    def test_every_source_member_is_required(self):
        for path in m.ESSENTIAL-{m.TASK}:
            value=copy.deepcopy(self.task)
            del value['sourceHashes'][path]
            with self.subTest(path=path), self.assertRaisesRegex(ValueError,'R45_HASH_INVENTORY'):
                m.task_guard(value,self.bodies.__getitem__)


    def test_optional_unchanged_grant_paths_are_not_mandatory(self):
        value=copy.deepcopy(self.task)
        value['sourceHashes']={p:sha for p,sha in value['sourceHashes'].items() if p in m.ESSENTIAL}
        self.assertEqual(m.task_guard(value,self.bodies.__getitem__),m.ESSENTIAL)

    def test_current_and_original_programs_are_not_interchangeable(self):
        for body in (b'',b'{"status":"PASS"}',b'R40_HISTORICAL_WORKSPACE /synthetic\n{"status":"PASS"}'):
            with self.assertRaises(ValueError):m.historical_result(body)

    def test_historical_receipts_bind_real_log_bytes_exact_commands_pins_and_integer_exits(self):
        with tempfile.TemporaryDirectory(prefix='current45-receipts-') as directory:
            root=Path(directory).resolve();(root/'logs').mkdir()
            raw=b'public synthetic boundary fixture only\n';path=root/'logs'/'control.log';path.write_bytes(raw)
            commands=[('control',['node','--version'],0)]
            row=dict(name='control',command=['node','--version'],exit=0,expectedExit=0,timedOut=False,
                historicalHead=m.BASE,historicalTree=m.BASE_TREE,log=str(path),bytes=len(raw),sha256=m.digest(raw))
            self.assertEqual(m.validate_receipts(dict(receipts=[row]),root,commands),{'control':raw})
            for key,bad in [('command',['node','--eval','forged']),('exit',True),('expectedExit',2),
                ('timedOut',True),('historicalHead','0'*40),('historicalTree','0'*40),
                ('log',str(root/'elsewhere.log')),('bytes',len(raw)+1),('sha256','0'*64)]:
                changed=dict(row,**{key:bad})
                with self.subTest(key=key),self.assertRaises(ValueError):
                    m.validate_receipts(dict(receipts=[changed]),root,commands)
            for rows in ([],[row,row]):
                with self.assertRaises(ValueError):m.validate_receipts(dict(receipts=rows),root,commands)
            path.write_bytes(raw+b'forged suffix')
            with self.assertRaisesRegex(ValueError,'R45_HISTORICAL_LOG_HASH'):
                m.validate_receipts(dict(receipts=[row]),root,commands)

    def test_historical_commands_cannot_run_original44_current_on_successor(self):
        root=Path(tempfile.gettempdir()).resolve()/'synthetic-history-fixture'
        commands=m.historical_commands(root,str(root/'node'),str(root/'npm-cli.js'),str(root/'python'))
        self.assertEqual(commands[0][0],'clone-pr45')
        self.assertIn(m.PARENT_BRANCH,commands[0][1])
        self.assertNotIn('--depth',commands[0][1]);self.assertIn('--no-hardlinks',commands[0][1])
        self.assertEqual(commands[-1],('original44-authentic-historical',
            [str(root/'python'),'-I','-B',m.PREFIX+'main_integration44.py','--historical'],0))
        self.assertEqual([row[2] for row in commands].count(2),1)
        self.assertFalse(any('--behavioral' in row[1] for row in commands))
        self.assertIn('catalog-operator-cat08-cleanup40.test.mjs --behavioral',m.new_step())
        self.assertIn('PlanHistoryPanel45.test.tsx',m.new_step())
        self.assertIn('planHistory45Encrypted.test.ts',m.new_step())
        self.assertIn('ownedBottleVersion38.test.ts',m.new_step())
        self.assertIn('historicalReplay45.test.py',m.new_step())

class CompositeHistoricalControls(unittest.TestCase):
    """Synthetic unit boundaries; these receipts confer no historical acceptance."""
    def test_explicit_resume_pair_is_local_only_and_requires_historical_mode(self):
        root=Path(tempfile.gettempdir()).resolve()
        m.historical_options(True,root/'fixture',root/'result.json',{})
        m.historical_options(True,None,None,{'GITHUB_ACTIONS':'true'})
        for mode,fixture,result,env in (
            (True,root/'fixture',None,{}),(True,None,root/'result.json',{}),
            (False,root/'fixture',root/'result.json',{}),
            (True,root/'fixture',root/'result.json',{'GITHUB_ACTIONS':'true'}),
            (True,root/'fixture',root/'result.json',{'GITHUB_SHA':'a'*40}),
            (True,Path('relative'),root/'result.json',{})):
            with self.subTest(mode=mode,fixture=fixture,env=env),self.assertRaises(ValueError):
                m.historical_options(mode,fixture,result,env)

    def test_evidence_path_is_historical_only_and_creates_only_a_new_external_workspace(self):
        with tempfile.TemporaryDirectory(prefix='c45-evidence-path-') as directory:
            root=Path(directory).resolve();target=root/'new-owned-workspace'
            m.historical_options(True,None,None,{},target)
            for mode,path in ((False,target),(True,Path('relative'))):
                with self.subTest(mode=mode,path=path),self.assertRaisesRegex(ValueError,'R45_HISTORICAL_EVIDENCE_PATH'):
                    m.historical_options(mode,None,None,{},path)
            self.assertEqual(m.historical_workspace(target),target)
            self.assertEqual(list(target.iterdir()),[])
            with self.assertRaisesRegex(ValueError,'R45_HISTORICAL_EVIDENCE_NEW'):
                m.historical_workspace(target)
            fixture=root/'source';fixture.mkdir()
            with patch.object(m,'ROOT',fixture),self.assertRaisesRegex(ValueError,'R45_EXTERNAL_CLONE'):
                m.historical_workspace(fixture/'must-not-be-created')
            self.assertFalse((fixture/'must-not-be-created').exists())
            with self.assertRaisesRegex(ValueError,'R45_EXTERNAL_CLONE'):
                m.historical_workspace(fixture/'must-stay-read-only',(fixture,))
            self.assertFalse((fixture/'must-stay-read-only').exists())
            with patch.object(m.tempfile,'gettempdir',return_value=str(fixture)), \
                 patch.object(m.tempfile,'mkdtemp') as create, self.assertRaisesRegex(ValueError,'R45_EXTERNAL_CLONE'):
                m.historical_workspace(forbidden_roots=(fixture,))
            create.assert_not_called()
            parent_file=root/'not-a-directory';parent_file.write_bytes(b'unchanged')
            with self.assertRaises((OSError,ValueError)):
                m.historical_workspace(parent_file/'child')
            self.assertEqual(parent_file.read_bytes(),b'unchanged')

    def test_cli_evidence_dispatch_and_refusal_never_write_to_a_rejected_existing_path(self):
        with tempfile.TemporaryDirectory(prefix='c45-cli-evidence-') as directory:
            target=Path(directory).resolve();sentinel=target/'sentinel';sentinel.write_bytes(b'keep')
            for mode in (False,True):
                args=['main45']+(['--historical'] if mode else [])+['--historical-evidence-dir',str(target)]
                output=io.StringIO()
                with patch.dict(m.os.environ,{},clear=True),patch.object(m.sys,'argv',args), \
                     patch.object(m,'historical',side_effect=ValueError('R45_HISTORICAL_EVIDENCE_NEW')) as history, \
                     patch.object(m,'verify') as current,patch.object(m.sys,'stderr',io.StringIO()),redirect_stdout(output):
                    self.assertEqual(m.main(),1)
                    current.assert_not_called()
                    if mode:history.assert_called_once_with(None,None,target)
                    else:history.assert_not_called()
                self.assertFalse(json.loads(output.getvalue())['valid'])
                self.assertEqual(list(target.iterdir()),[sentinel]);self.assertEqual(sentinel.read_bytes(),b'keep')

    def test_incomplete_normal_result_is_retained_and_reported_without_changing_its_refusal(self):
        helper=m.historical_helper()
        for reporting_error in (False,True):
            with self.subTest(reportingError=reporting_error),tempfile.TemporaryDirectory(prefix='c45-incomplete-routing-') as directory:
                workspace=Path(directory).resolve()/'owned';checkpoint=dict(node='synthetic-node',npm='synthetic-npm-cli.js')
                incomplete=dict(status='INCOMPLETE_REQUIRES_RESUME_OR_REPAIR',attempts=[],stopReason=None,
                    qualification='SYNTHETIC_UNIT_ROUTING_ONLY_NOT_HISTORICAL_EVIDENCE',acceptanceGranted=False,release='NO_GO')
                identity=dict(head='a'*40,tree='b'*40,indexBytes=0,indexSHA256=m.digest(b''),trackedBlobs=0)
                def clone(args,cwd,env,path,expected,timeout):
                    path.write_bytes(b'synthetic clone routing fixture only\n')
                    return dict(command=args,cwd=str(cwd),exit=0,expectedExit=0,timedOut=False,
                        log=str(path),bytes=path.stat().st_size,sha256=m.digest(path.read_bytes()))
                def report(value,evidence,stream):
                    self.assertEqual(value,incomplete)
                    self.assertEqual(evidence,workspace/'full-normal-original44')
                    if reporting_error:raise ValueError('C45H_SYNTHETIC_REPORT_FAILURE')
                    print('SYNTHETIC_INCOMPLETE_ROUTING_REPORT',file=stream)
                error=io.StringIO()
                with patch.dict(m.os.environ,{},clear=True),patch.object(m,'authenticate_parent'), \
                     patch.object(m,'source_identity',return_value=identity),patch.object(m,'historical_helper',return_value=helper), \
                     patch.object(helper,'prepare',return_value=(None,{},checkpoint)), \
                     patch.object(helper,'git',return_value=(m.PARENT_BRANCH+'\n').encode()), \
                     patch.object(helper,'run_command',side_effect=clone),patch.object(helper,'replay',return_value=incomplete), \
                     patch.object(helper,'report_replay_failure',side_effect=report,create=True) as reported, \
                     patch.object(m,'run_historical_control',return_value={}),patch.object(m.sys,'stderr',error), \
                     self.assertRaisesRegex(ValueError,'R45_FULL_NORMAL_INVOCATION_INCOMPLETE'):
                    m.historical(evidence_directory=workspace)
                reported.assert_called_once()
                self.assertEqual(json.loads((workspace/'logs/original44-replay-result.json').read_bytes()),incomplete)
                retained=json.loads((workspace/'cli-failure.json').read_bytes())
                self.assertEqual(retained['error'],'R45_FULL_NORMAL_INVOCATION_INCOMPLETE')
                self.assertFalse(retained['acceptanceGranted']);self.assertEqual(retained['release'],'NO_GO')
                self.assertIn('C45H_SYNTHETIC_REPORT_FAILURE' if reporting_error else
                    'SYNTHETIC_INCOMPLETE_ROUTING_REPORT',error.getvalue())

    def test_retained_artifact_keeps_all_existing_commands_and_fixed_bounded_evidence_paths(self):
        step=m.new_step()
        self.assertIn('main_integration45.py --historical --historical-evidence-dir "$RUNNER_TEMP/c45-history"',step)
        self.assertIn('if: always()',step);self.assertNotIn('continue-on-error',step)
        for member in ('logs/**','full-normal-original44/**','diagnostics/**','cli-failure.json'):
            self.assertIn('${{ runner.temp }}/c45-history/'+member,step)
        self.assertIn('actions/upload-artifact@v4',step)
        self.assertIn('retention-days: 7',step)
        self.assertIn('compact-shelf-target37.test.mjs',step)
        self.assertIn('owned-bottle-formula38.test.mjs',step)

    def test_composite_controls_keep_original_counts_and_refusal_literal_commands(self):
        root=Path(tempfile.gettempdir()).resolve()/'named-fixture-is-not-required-to-be-pr45-directory'
        checkpoint=dict(node=str(root/'node'),npm=str(root/'npm-cli.js'))
        rows=m.historical_controls(root,checkpoint,str(root/'python'))
        self.assertEqual([row[0] for row in rows],[row[0] for row in
            m.historical_commands(root.parent,checkpoint['node'],checkpoint['npm'],str(root/'python'))[6:12]])
        self.assertEqual(len(rows),6)
        self.assertEqual(rows[-1][2],2)
        self.assertEqual(rows[-1][1], [str(root/'python'),'-I','-B',m.PREFIX+'main_integration44.py',
            '--scope','full-app-j01-v2','--external-readiness'])
        self.assertIn(str(root/'node_modules/vitest/vitest.mjs'),rows[2][1])
        self.assertNotIn('--historical', [arg for _,command,_ in rows for arg in command])

    def test_cli_reuse_requires_both_arguments_and_never_runs_current_or_history_on_refusal(self):
        root=Path(tempfile.gettempdir()).resolve()
        fixture,result=root/'fixture',root/'result.json'
        with patch.dict(m.os.environ,{},clear=True),patch.object(m.sys,'argv',
            ['main45','--historical','--historical-fixture',str(fixture),'--historical-result',str(result)]), \
            patch.object(m,'historical',return_value={'status':'SYNTHETIC_UNIT_ONLY'}) as history, \
            patch.object(m,'verify') as current,redirect_stdout(io.StringIO()):
            self.assertEqual(m.main(),0)
            history.assert_called_once_with(fixture,result);current.assert_not_called()
        for args,env in ((['--historical','--historical-fixture',str(fixture)],{}),
            (['--historical-fixture',str(fixture),'--historical-result',str(result)],{}),
            (['--historical','--historical-fixture',str(fixture),'--historical-result',str(result)],
                {'GITHUB_ACTIONS':'true'})):
            output=io.StringIO()
            with patch.dict(m.os.environ,env,clear=True),patch.object(m.sys,'argv',['main45',*args]), \
                patch.object(m,'historical') as history,patch.object(m,'verify') as current, \
                patch.object(m.sys,'stderr',io.StringIO()),redirect_stdout(output):
                self.assertEqual(m.main(),1)
                history.assert_not_called();current.assert_not_called()
                self.assertEqual(json.loads(output.getvalue())['release'],'NO_GO')

    def test_historical_exceptions_retain_actual_diagnostics_and_never_report_pass(self):
        for exception,code in ((RuntimeError('synthetic operational exception'),'R45_EXECUTION_INCOMPLETE'),
                               (ValueError('C45H_SETUP_EXIT'),'C45H_SETUP_EXIT')):
            output,error=io.StringIO(),io.StringIO()
            with self.subTest(kind=type(exception).__name__),patch.dict(m.os.environ,{},clear=True), \
                patch.object(m.sys,'argv',['main45','--historical']), \
                patch.object(m,'historical',side_effect=exception),patch.object(m.sys,'stderr',error),redirect_stdout(output):
                self.assertEqual(m.main(),1)
            value=json.loads(output.getvalue())
            self.assertFalse(value['valid']);self.assertEqual(value['error'],code)
            self.assertEqual(value['release'],'NO_GO');self.assertFalse(value['acceptanceGranted'])
            self.assertIn(type(exception).__name__+': '+str(exception),error.getvalue())

    def test_explicit_completed_proof_reuse_does_not_execute_another_full_chain(self):
        helper=m.historical_helper()
        with tempfile.TemporaryDirectory(prefix='current45-routing-unit-') as directory:
            root=Path(directory).resolve();fixture=root/'pr45';proofdir=root/'original-full';proofdir.mkdir()
            workspace=root/'composite';workspace.mkdir()
            checkpoint=dict(node=str(root/'node'),npm=str(root/'npm-cli.js'))
            completed=dict(status='COMPLETE_ORIGINAL44_FULL_INVOCATION',checkpointDirectory=str(proofdir),
                original44Historical={'status':'SYNTHETIC_UNIT_ONLY'})
            proof=proofdir/'result.json';helper.write_json(proof,completed)
            outputs={'original44-exact-source':b'{"valid":true}',
                'original44-fullapp-scope':b'{"scope":"SYNTHETIC_UNIT_ONLY"}'}
            identity=dict(head='a'*40,tree='b'*40,indexBytes=0,indexSHA256=m.digest(b''),trackedBlobs=0)
            def parse(raw):return json.loads(raw.splitlines()[-1])
            with patch.dict(m.os.environ,{},clear=True),patch.object(m,'authenticate_parent'), \
                patch.object(m,'source_identity',return_value=identity),patch.object(m,'historical_helper',return_value=helper), \
                patch.object(helper,'verify_result',return_value=completed) as revalidate, \
                patch.object(helper,'prepare',return_value=(None,{},checkpoint)), \
                patch.object(helper,'git',return_value=(m.PARENT_BRANCH+'\n').encode()), \
                patch.object(helper,'replay') as replay,patch.object(m,'run_historical_control',return_value={}) as controls, \
                patch.object(m,'control_receipts',return_value=outputs),patch.object(m,'historical_result',side_effect=parse), \
                patch.object(m.tempfile,'mkdtemp',return_value=str(workspace)), \
                patch.object(m.sys,'stderr',io.StringIO()):
                value=m.historical(fixture,proof)
                replay.assert_not_called();self.assertEqual(controls.call_count,6)
                self.assertEqual(revalidate.call_count,2)
                self.assertEqual(value['mode'],'EXPLICIT_LOCAL_COMPLETED_PROOF_REUSE')
                self.assertIn('COMPOSITE_',value['qualification'])
                self.assertEqual(value['completedNormalInvocation']['path'],str(proof))
                self.assertEqual(value['original44Historical'],completed['original44Historical'])
                self.assertFalse(value['acceptanceGranted']);self.assertEqual(value['release'],'NO_GO')

    def test_default_hosted_path_creates_fresh_https_fixture_and_executes_normal_full_replay(self):
        helper=m.historical_helper()
        with tempfile.TemporaryDirectory(prefix='current45-fresh-routing-unit-') as directory:
            workspace=Path(directory).resolve()
            checkpoint=dict(node=str(workspace/'node'),npm=str(workspace/'npm-cli.js'))
            completed=dict(status='COMPLETE_ORIGINAL44_FULL_INVOCATION',
                original44Historical={'status':'SYNTHETIC_UNIT_ONLY'})
            identity=dict(head='a'*40,tree='b'*40,indexBytes=0,indexSHA256=m.digest(b''),trackedBlobs=0)
            commands=[]
            def command(args,cwd,env,path,expected,timeout):
                commands.append(args);path.write_bytes(b'synthetic clone or checkout only')
                return dict(command=args,cwd=str(cwd),exit=0,expectedExit=0,timedOut=False,
                    log=str(path),bytes=32,sha256=m.digest(path.read_bytes()))
            def replay(fixture,evidence):
                evidence.mkdir();helper.write_json(evidence/'result.json',completed)
                return completed
            with patch.dict(m.os.environ,{'GITHUB_ACTIONS':'true'},clear=True),patch.object(m,'authenticate_parent'), \
                patch.object(m,'source_identity',return_value=identity),patch.object(m,'historical_helper',return_value=helper), \
                patch.object(helper,'prepare',return_value=(None,{},checkpoint)), \
                patch.object(helper,'git',return_value=(m.PARENT_BRANCH+'\n').encode()), \
                patch.object(helper,'run_command',side_effect=command),patch.object(helper,'replay',side_effect=replay) as normal, \
                patch.object(m,'run_historical_control',return_value={}) as controls, \
                patch.object(m,'control_receipts',return_value={'original44-exact-source':b'{}',
                    'original44-fullapp-scope':b'{}'}), \
                patch.object(m,'historical_result',side_effect=lambda raw:json.loads(raw.splitlines()[-1])), \
                patch.object(m.tempfile,'mkdtemp',return_value=str(workspace)),patch.object(m.sys,'stderr',io.StringIO()):
                value=m.historical()
                normal.assert_called_once_with(workspace/'pr45',workspace/'full-normal-original44')
                self.assertEqual(controls.call_count,6)
                self.assertEqual(value['mode'],'FRESH_NAMED_PR45')
                self.assertEqual(len(value['cloneReceipts']),2)
                self.assertIn('https://github.com/TasfiqJ/onSkin.git',commands[0])
                self.assertIn('--no-hardlinks',commands[0]);self.assertIn(m.PARENT_BRANCH,commands[0])
                self.assertEqual(commands[1],['git','checkout',m.PARENT_BRANCH])

    def test_fresh_control_receipts_bind_actual_logs_cwd_commands_and_refusal_exit(self):
        helper=m.historical_helper()
        with tempfile.TemporaryDirectory(prefix='current45-composite-unit-') as directory:
            workspace=Path(directory).resolve();(workspace/'logs').mkdir();fixture=workspace/'pr45'
            commands=[('original44-external-readiness-refusal',['python','original44','--external-readiness'],2)]
            raw=b'public synthetic refusal fixture only\n'
            path=workspace/'logs'/'original44-external-readiness-refusal-attempt-1.log';path.write_bytes(raw)
            row=dict(command=commands[0][1],cwd=str(fixture),exit=2,expectedExit=2,timedOut=False,
                historicalHead=m.BASE,historicalTree=m.BASE_TREE,log=str(path),bytes=len(raw),sha256=m.digest(raw))
            control=dict(name=commands[0][0],attempts=[row])
            self.assertEqual(m.control_receipts(dict(controls=[control]),workspace,fixture,commands,helper),
                {commands[0][0]:raw})
            for field,bad in (('command',['python','forged']),('cwd',str(workspace)),('exit',0),
                ('exit',True),('expectedExit',0),('timedOut',True),('historicalHead','0'*40),
                ('historicalTree','0'*40),('log',str(workspace/'elsewhere.log')),('sha256','0'*64),('bytes',True)):
                changed=dict(control,attempts=[dict(row,**{field:bad})])
                with self.subTest(field=field,bad=bad),self.assertRaises(ValueError):
                    m.control_receipts(dict(controls=[changed]),workspace,fixture,commands,helper)
            for controls in ([],[control,control],[dict(control,attempts=[])],[dict(control,attempts=[row]*4)]):
                with self.assertRaises(ValueError):m.control_receipts(dict(controls=controls),workspace,fixture,commands,helper)
            path.write_bytes(raw+b'changed')
            with self.assertRaisesRegex(ValueError,'C45H_LOG_CHANGED'):
                m.control_receipts(dict(controls=[control]),workspace,fixture,commands,helper)

    def test_normal_failure_diagnostic_success_is_never_returned_as_control_success(self):
        helper=m.historical_helper()
        with tempfile.TemporaryDirectory(prefix='current45-retry-unit-') as directory:
            workspace=Path(directory).resolve();(workspace/'logs').mkdir();fixture=workspace/'pr45'
            calls=[]
            def run(command,cwd,env,path,expected,timeout):
                calls.append(command)
                raw=b'public synthetic original NORMAL failure\n';path.write_bytes(raw)
                return dict(command=command,cwd=str(cwd),exit=1,expectedExit=expected,timedOut=False,
                    log=str(path),bytes=len(raw),sha256=m.digest(raw))
            def diagnose(stage,root,evidence,env):
                value=dict(classification='DIAGNOSTIC_RECOVERED_CAUSE_UNPROVEN',originalStage=stage,
                    normalOriginalCommandStillRequired=True)
                helper.write_json(evidence/'diagnosis.json',value)
                return value
            with patch.object(helper,'run_command',side_effect=run),patch.object(helper,'diagnose',side_effect=diagnose):
                with self.assertRaisesRegex(ValueError,'R45_HISTORICAL_CONTROL_FAILED'):
                    m.run_historical_control(helper,'original44-exact-source',['python','original44'],0,
                        fixture,workspace,{})
            self.assertEqual(calls,[['python','original44']]*3)
            attempts=helper.document((workspace/'logs'/'original44-exact-source-attempts.json').read_bytes())
            self.assertEqual([row['exit'] for row in attempts],[1,1,1])
            self.assertTrue(all(Path(row['log']).is_file() for row in attempts))
            self.assertTrue(all('diagnosis' in row for row in attempts[:2]))

    def test_semantic_control_failure_is_not_automatically_retried(self):
        helper=m.historical_helper()
        with tempfile.TemporaryDirectory(prefix='current45-semantic-unit-') as directory:
            workspace=Path(directory).resolve();(workspace/'logs').mkdir()
            def run(command,cwd,env,path,expected,timeout):
                path.write_bytes(b'synthetic refusal')
                return dict(command=command,cwd=str(cwd),exit=1,expectedExit=expected,timedOut=False,
                    log=str(path),bytes=17,sha256=m.digest(b'synthetic refusal'))
            def diagnose(stage,root,evidence,env):
                value=dict(classification='SEMANTIC_OR_UNCLASSIFIED_NO_AUTOMATIC_RETRY',originalStage=stage,
                    normalOriginalCommandStillRequired=True)
                helper.write_json(evidence/'diagnosis.json',value)
                return value
            with patch.object(helper,'run_command',side_effect=run) as execute, \
                 patch.object(helper,'diagnose',side_effect=diagnose):
                with self.assertRaisesRegex(ValueError,'R45_HISTORICAL_CONTROL_FAILED'):
                    m.run_historical_control(helper,'original44-fullapp-scope',['python','original44'],0,
                        workspace/'pr45',workspace,{})
                self.assertEqual(execute.call_count,1)

    def test_original_custody_refusal_stops_before_diagnostic_even_if_a_diagnostic_could_recover(self):
        helper=m.historical_helper()
        with tempfile.TemporaryDirectory(prefix='current45-custody-refusal-unit-') as directory:
            workspace=Path(directory).resolve();(workspace/'logs').mkdir()
            def run(command,cwd,env,path,expected,timeout):
                raw=b'{"valid":false,"error":"R44_PR_CUSTODY","acceptanceGranted":false,"release":"NO_GO"}\n'
                path.write_bytes(raw)
                return dict(command=command,cwd=str(cwd),exit=1,expectedExit=expected,timedOut=False,
                    log=str(path),bytes=len(raw),sha256=m.digest(raw))
            with patch.object(helper,'run_command',side_effect=run) as execute,patch.object(helper,'diagnose') as diagnostic:
                with self.assertRaisesRegex(ValueError,'R45_HISTORICAL_CONTROL_FAILED'):
                    m.run_historical_control(helper,'original44-exact-source',['python','original44'],0,
                        workspace/'pr45',workspace,{})
                self.assertEqual(execute.call_count,1);diagnostic.assert_not_called()

    def test_control_retry_reader_binds_diagnostic_command_source_and_raw_exception_events(self):
        helper=m.historical_helper()
        with tempfile.TemporaryDirectory(prefix='current45-diagnostic-reader-unit-') as directory:
            workspace=Path(directory).resolve();(workspace/'logs').mkdir();fixture=workspace/'pr45'
            name='original44-exact-source';relative=m.PREFIX+'main_integration44.py'
            command=[m.sys.executable,'-I','-B',relative]
            def receipt(args,cwd,path,raw,exit):
                path.write_bytes(raw)
                return dict(command=args,cwd=str(cwd),exit=exit,expectedExit=0,timedOut=False,
                    historicalHead=m.BASE,historicalTree=m.BASE_TREE,
                    log=str(path),bytes=len(raw),sha256=m.digest(raw))
            failed=receipt(command,fixture,workspace/'logs'/(name+'-attempt-1.log'),b'synthetic failed normal',1)
            passed=receipt(command,fixture,workspace/'logs'/(name+'-attempt-2.log'),b'synthetic passed normal',0)
            diagdir=workspace/'diagnostics'/(name+'-attempt-1');diagdir.mkdir(parents=True)
            events=dict(diagnosticOnly=True,exit=0,events=[],originalSourceSHA256=m.PROGRAMS['main_integration44.py'])
            output=diagdir/'exception-events.json';helper.write_json(output,events)
            payload=[str(fixture),relative,m.PROGRAMS['main_integration44.py'],[],str(output)]
            args=[m.sys.executable,'-I','-B','-c',helper.TRACE_CODE,json.dumps(payload)]
            diagnostic=receipt(args,fixture,diagdir/'diagnostic.log',b'synthetic diagnostic only',0)
            diagnosis=dict(classification='DIAGNOSTIC_RECOVERED_CAUSE_UNPROVEN',
                originalStage=dict(root=str(fixture),row=dict(failed)),diagnostic=diagnostic,exceptionEvents=events,
                selectedSource=dict(root=str(fixture),head=m.BASE,tree=m.BASE_TREE),normalOriginalCommandStillRequired=True)
            def bind():
                path=diagdir/'diagnosis.json';helper.write_json(path,diagnosis);raw=path.read_bytes()
                failed['diagnosis']=dict(path=str(path),bytes=len(raw),sha256=m.digest(raw))
            bind()
            value=dict(controls=[dict(name=name,attempts=[failed,passed])]);commands=[(name,command,0)]
            self.assertEqual(m.control_receipts(value,workspace,fixture,commands,helper)[name],b'synthetic passed normal')
            diagnosis['diagnostic']['command']=['python','fabricated-diagnostic'];bind()
            with self.assertRaisesRegex(ValueError,'C45H_COMMAND_CHANGED'):
                m.control_receipts(value,workspace,fixture,commands,helper)
            diagnosis['diagnostic']['command']=args;bind();output.write_bytes(b'{}')
            with self.assertRaisesRegex(ValueError,'R45_HISTORICAL_DIAGNOSIS_TRANSCRIPT'):
                m.control_receipts(value,workspace,fixture,commands,helper)
            raw=b'{"valid":false,"error":"R44_PR_CUSTODY"}\n';Path(failed['log']).write_bytes(raw)
            failed.update(bytes=len(raw),sha256=m.digest(raw))
            with self.assertRaisesRegex(ValueError,'R45_HISTORICAL_RETRY'):
                m.control_receipts(value,workspace,fixture,commands,helper)

    def test_scope_and_readiness_equal_body_and_all_original_gates_stay_closed(self):
        names=('contract.v2.json','matrix.v2.json','precedence.v2.json','roadmap.v2.json','owner-ledger33.v1.json')
        frozen=m.original44().original41().scope_guard({name:m.document(m.git('show',m.BASE+':'+m.DOCS+name))
            for name in names})
        exact=dict(valid=True,head=m.BASE,tree=m.BASE_TREE,governance='CURRENT44_FINITE_SOURCE_ONLY',
            qualification='LOCAL_EXACT_CHECKOUT_NOT_HOSTED_CI',productScope=frozen,
            acceptanceGranted=False,release='NO_GO',admissions=dict.fromkeys(m.ADMISSIONS,False))
        scoped=dict(frozen,head=m.BASE,tree=m.BASE_TREE,phase='SOURCE_FROZEN',sourceQualification=exact['qualification'])
        logs={'original44-main_integration44.test.py':b'Ran 22 tests in 1.0s\n\nOK\n',
            'original44-source_consumer44.test.py':b'Ran 13 tests in 1.0s\n\nOK\n',
            'original44-source-regressions':b'Test Files 3 passed (3)\nTests 94 passed (94)\n',
            'original44-exact-source':json.dumps(exact).encode(),
            'original44-fullapp-scope':json.dumps(scoped).encode(),
            'original44-external-readiness-refusal':json.dumps(scoped).encode()}
        value=dict(original44=exact,original44Scope=scoped)
        m.original44_control_results(logs,value)
        for name,bad in (('original44-main_integration44.test.py',b'Ran 21 tests in 1s\nOK'),
            ('original44-source_consumer44.test.py',b'Ran 12 tests in 1s\nOK'),
            ('original44-source-regressions',b'Test Files 3 passed (3)\nTests 93 passed (93)'),
            ('original44-external-readiness-refusal',json.dumps(dict(scoped,externalReady=True)).encode())):
            with self.subTest(name=name),self.assertRaises(ValueError):m.original44_control_results(dict(logs,**{name:bad}),value)
        for edit in ('required','owner','obligation','different-id'):
            changed=copy.deepcopy(scoped)
            if edit=='required':changed['requiredRows']=37
            elif edit=='owner':changed['unadmittedGates'].pop()
            elif edit=='obligation':changed['obligations'][0]['ownerAdmitted']=True
            else:changed['obligations'][0]['id']='invented'
            altered=copy.deepcopy(exact);altered['productScope']={k:v for k,v in changed.items() if k in frozen}
            changed_logs=dict(logs,**{'original44-exact-source':json.dumps(altered).encode(),
                'original44-fullapp-scope':json.dumps(changed).encode(),
                'original44-external-readiness-refusal':json.dumps(changed).encode()})
            with self.subTest(edit=edit),self.assertRaises(ValueError):
                m.original44_control_results(changed_logs,dict(original44=altered,original44Scope=changed))

if __name__=='__main__':unittest.main()
