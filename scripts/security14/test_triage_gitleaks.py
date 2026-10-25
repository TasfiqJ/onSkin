"""Synthetic adversarial fixtures only; all positive outcomes stay UNREVIEWED."""
import copy
import contextlib
import io
import json
from pathlib import Path
import stat
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import zipfile
import triage_gitleaks as tri

def record():
    return dict(RuleID='generic-api-key',File='/synthetic/current-source/src/example.py',
                StartLine=1,EndLine=1,Fingerprint='synthetic-only',
                Match='SYNTHETIC_DO_NOT_EMIT',Secret='SYNTHETIC_DO_NOT_EMIT')

def command(argv,stderr,report=None):
    value=dict(argv=argv,cwd='/synthetic',started='2026-10-25T00:00:00+00:00',
               finished='2026-10-25T00:00:01+00:00',exit=2 if argv[0]=='/tools/gitleaks' else 0,
               stdout='',stderr=stderr,stdout_sha256=tri.inv.sha(b''),stderr_sha256=tri.inv.sha(stderr.encode()))
    if report is not None:value['report']=report
    return value

def fixture():
    tools={}
    for name,(version,asset,binary) in tri.TOOLS.items():
        path='/tools/'+name
        tools[name]=dict(version=version,asset=asset,binary=binary,path=path,
            url='https://github.com/'+('gitleaks/gitleaks' if name=='gitleaks' else 'trufflesecurity/trufflehog')+
                '/releases/download/v'+version+'/'+name+'_'+version+('_linux_x64.tar.gz' if name=='gitleaks' else '_linux_amd64.tar.gz'),
            version_result=dict(argv=[path,'version' if name=='gitleaks' else '--version'],exit=0,
                stdout='8.24.3\n' if name=='gitleaks' else 'trufflehog 3.99.3\n',stderr=''))
    gl='/tools/gitleaks';th='/tools/trufflehog'; common=['--redact=100','--exit-code=2','--log-level=info']
    finish=json.dumps(dict(msg='finished scanning',trufflehog_version='3.99.3',chunks=1,bytes=1,verified_secrets=0,unverified_secrets=0))+'\n'
    proof=dict(schema=1,purpose='ORIGINAL_SECRET_DIAGNOSTIC_NOT_G97_ACCEPTANCE',
        context=dict(kind='ORIGINAL_SECRET_GITHUB_ACTIONS',repository='TasfiqJ/onSkin',workflow='Security',job='secret-scan',attempt='1'),
        source=dict(patch_commits=['a'*40],snapshot=[],refs=[],commits=[]),
        source_ref='refs/pull/999/merge',run_id='999',started='2026-10-25T00:00:00+00:00',finished='2026-10-25T00:00:02+00:00',
        tools=tools,mirror='/synthetic/history.git',snapshot='/synthetic/current-source',sarif='/output/gitleaks-results.sarif',current_report='/synthetic/current.json')
    proof['commands']={
        'gitleaks-history':command([gl,'detect','--source='+proof['mirror'],'--log-opts=--all --full-history --diff-merges=first-parent',*common,'--report-format=sarif','--report-path='+proof['sarif']], '1 commits scanned\nscanned ~1 bytes fixture in 1s\nleaks found: 1\n'),
        'gitleaks-current':command([gl,'detect','--no-git','--source='+proof['snapshot'],*common,'--report-format=json','--report-path='+proof['current_report']], 'scanned ~1 bytes fixture in 1s\nleaks found: 1\n',[record()]),
        'trufflehog-history':command([th,'git','file://'+proof['mirror'],'--bare','--fail','--no-update','--json','--only-verified','--concurrency=1'],finish),
        'trufflehog-current':command([th,'filesystem',proof['snapshot'],'--fail','--no-update','--json','--only-verified','--concurrency=1'],finish),
    }
    report=dict(version='2.1.0',runs=[dict(tool=dict(driver=dict(name='gitleaks')),results=[dict(ruleId='generic-api-key',message=dict(text='SYNTHETIC_DO_NOT_EMIT'),locations=[dict(physicalLocation=dict(artifactLocation=dict(uri='src/example.py'),region=dict(startLine=1)))])])])
    return proof,report

class TriageTests(unittest.TestCase):
    def test_counts_duplicates_corruption_scope_and_privacy(self):
        proof,report=fixture();tri.commands(proof)
        row=proof['commands']['gitleaks-current']
        result=tri.aggregate(row['report'],row,True,proof['snapshot'])
        self.assertEqual(result['total'],1)
        self.assertNotIn('SYNTHETIC_DO_NOT_EMIT',json.dumps(result))
        for mutate in [lambda r:r['report'].append(r['report'][0]),
                       lambda r:r.update(exit=0), lambda r:r.update(stderr='leaks found: 2\n'),
                       lambda r:r['report'][0].update(File='/outside/src/example.py'),
                       lambda r:r['report'][0].update(File=proof['snapshot']+'/../escape'),
                       lambda r:r['report'][0].update(RuleID='SYNTHETIC_DO_NOT_EMIT')]:
            changed=copy.deepcopy(row);mutate(changed)
            with self.assertRaises(ValueError):tri.aggregate(changed['report'],changed,True,proof['snapshot'])
        # Two distinct records with a coarse repeated scanner fingerprint are
        # retained, counted, and UNREVIEWED; nothing is deduplicated or dismissed.
        changed=copy.deepcopy(row);changed['report'].append(dict(record(),StartLine=2,EndLine=2));changed['stderr']='leaks found: 2\n'
        self.assertEqual(tri.aggregate(changed['report'],changed,True,proof['snapshot'])['fingerprint_collision_count'],1)
        for mutate in [lambda p:p['commands']['gitleaks-history']['argv'].remove('--log-opts=--all --full-history --diff-merges=first-parent'),
                       lambda p:p['commands']['gitleaks-current'].update(exit=124),
                       lambda p:p['tools']['gitleaks'].update(binary='0'*64),
                       lambda p:p['commands']['gitleaks-current'].update(stderr='truncated'),
                       lambda p:p['commands']['trufflehog-history'].update(stdout='SYNTHETIC_DO_NOT_EMIT')]:
            changed=copy.deepcopy(proof);mutate(changed)
            with self.assertRaises(ValueError):tri.commands(changed)
        for bad in ['null\n','[]\n','123\n','"SYNTHETIC_DO_NOT_EMIT"\n']:
            changed=copy.deepcopy(proof);row=changed['commands']['trufflehog-current']
            row.update(stderr=bad,stderr_sha256=tri.inv.sha(bad.encode()))
            with self.assertRaises(ValueError):tri.commands(changed)
        changed=copy.deepcopy(proof);changed['mirror']=[]
        with self.assertRaises(ValueError):tri.commands(changed)
        duplicate=report['runs'][0]['results']*2
        with self.assertRaises(ValueError):tri.aggregate(duplicate,dict(row,stderr='leaks found: 2\n'),False)

    def test_zip_bound_modes_traversal_collisions_and_json(self):
        def zipped(names):
            out=io.BytesIO()
            with zipfile.ZipFile(out,'w') as z:
                for name,mode in names:
                    info=zipfile.ZipInfo(name);info.create_system=3;info.external_attr=mode<<16
                    z.writestr(info,b'{}')
            return out.getvalue()
        good=[(n,stat.S_IFREG|0o644) for n in tri.MEMBERS]
        self.assertEqual(set(tri.archive(zipped(good))),tri.MEMBERS)
        for bad in [good[:-1],good+[('../escape',stat.S_IFREG|0o644)],good+[('/absolute',stat.S_IFREG|0o644)],
                    good+[(good[0][0].upper(),stat.S_IFREG|0o644)],[(good[0][0],stat.S_IFLNK|0o777),*good[1:]]]:
            with self.assertRaises(ValueError):tri.archive(zipped(bad))
        with self.assertRaises(zipfile.BadZipFile):tri.archive(zipped(good)[:-22])
        for bad in [b'{"a":1,"a":2}',b'NaN',b'{']:
            with self.assertRaises(ValueError):tri.inv.parse(bad)

    def test_cli_never_exposes_unexpected_parser_errors(self):
        import sys
        argv=['triage','--artifact','synthetic.zip','--provenance','synthetic.json','--repo','.',
              '--expected-provenance-sha256','0'*64,'--head','0'*40,'--scan','0'*40,'--tree','0'*40]
        for error in [AttributeError('SYNTHETIC_DO_NOT_EMIT'),ValueError('SYNTHETIC_DO_NOT_EMIT'),
                      zipfile.BadZipFile('SYNTHETIC_DO_NOT_EMIT')]:
            out=io.StringIO()
            with patch.object(sys,'argv',argv),patch.object(tri.inv,'regular',return_value=b'{}'), \
                 patch.object(tri,'triage',side_effect=error),contextlib.redirect_stdout(out):
                self.assertEqual(tri.main(),2)
            self.assertEqual(json.loads(out.getvalue()),dict(status='INCOMPLETE',acceptanceGranted=False))
            self.assertNotIn('SYNTHETIC_DO_NOT_EMIT',out.getvalue())

    def test_actual_synthetic_git_source_binding_and_unapplied_result(self):
        proof,report=fixture()
        with tempfile.TemporaryDirectory(prefix='security14-triage-') as tmp:
            root=Path(tmp)
            def git(*args,data=None):return subprocess.check_output(['git',*args],cwd=root,input=data,stderr=subprocess.PIPE)
            git('init','--quiet');source=root/tri.inv.PREFIX;source.mkdir(parents=True)
            (source/'adapter.py').write_bytes(b'synthetic adapter\n')
            git('add','--all');tree=git('write-tree').decode().strip()
            def commit(*parents):
                return git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit-tree',tree,*sum((['-p',p] for p in parents),[]),data=b'synthetic\n').decode().strip()
            base=commit();head=commit(base);scan=commit(base,head)
            snapshot=tri.inv.snapshot(root,head)
            rows=[dict(path=n,mode=r['mode'],object=r['blob'],bytes=r['bytes'],sha256=r['sha256']) for n,r in snapshot.items()]
            proof['source']=dict(head=scan,tree=tree,parents=[base,head],refs=['refs/pull/999/merge '+scan],commits=sorted([base,head,scan]),patch_commits=[base],snapshot=rows,snapshot_sha256=tri.inv.sha(tri.inv.canonical(rows)))
            sarif=tri.inv.canonical(report);proof['sarif_sha256']=tri.inv.sha(sarif)
            out=io.BytesIO()
            with zipfile.ZipFile(out,'w') as z:
                for name,value in [('secret-scan-proof.json',proof),('gitleaks-results.sarif',report),('gitleaks-tool.json',dict(version='8.24.3',sha256=tri.TOOLS['gitleaks'][2],exit=0)),('secret-scan-outcomes.json',dict(job='secret-scan',sha=scan,run_id='999',gitleaks='failure',gitleaks_exit='2',trufflehog='success'))]:z.writestr(name,tri.inv.canonical(value))
            raw=out.getvalue()
            env=dict(schema=1,repository='TasfiqJ/onSkin',head_sha=head,scan_sha=scan,tree=tree,run_id=999,attempt=1,
                artifact=dict(id=1,name='secret-scanner-evidence-999',digest='sha256:'+tri.inv.sha(raw),size_in_bytes=len(raw),expired=False,workflow_run=dict(id=999,head_sha=head,repository_id=1267954179,head_repository_id=1267954179)),
                run=dict(id=999,head_sha=head,event='pull_request',path='.github/workflows/security.yml',name='Security',run_attempt=1,status='completed',conclusion='failure'),
                job=dict(id=2,run_id=999,name='Secret scanning',status='completed',conclusion='failure'))
            with patch.dict(tri.inv.PINS,{'adapter.py':tri.inv.sha(b'synthetic adapter\n')},clear=True):
                envelope=tri.inv.canonical(env)
                result=tri.triage(raw,envelope,tri.inv.sha(envelope),head,scan,tree,root)
                self.assertEqual(result['status'],'UNREVIEWED');self.assertFalse(result['acceptanceGranted'])
                self.assertNotIn('SYNTHETIC_DO_NOT_EMIT',json.dumps(result))
                for key,value in [('head_sha','0'*40),('tree','0'*40),('run_id',998)]:
                    changed=copy.deepcopy(env);changed[key]=value;b=tri.inv.canonical(changed)
                    with self.assertRaises(ValueError):tri.triage(raw,b,tri.inv.sha(b),head,scan,tree,root)
                with self.assertRaises(ValueError):tri.triage(raw,envelope,'0'*64,head,scan,tree,root)
                for key in ['snapshot','commits','refs']:
                    changed=copy.deepcopy(proof);changed['source'][key]=[]
                    with self.assertRaises(ValueError):tri.source_binding(changed,env,root)
            f=root/'artifact.zip';f.write_bytes(raw)
            # The CLI fails closed without printing parser errors or input values.
            bad=root/'bad.json';bad.write_bytes(b'{"SYNTHETIC_DO_NOT_EMIT":')
            result=subprocess.run([__import__('sys').executable,'-B',str(Path(tri.__file__)),'--artifact',str(f),'--provenance',str(bad),'--repo',str(root),'--expected-provenance-sha256',tri.inv.sha(bad.read_bytes()),'--head',head,'--scan',scan,'--tree',tree],capture_output=True)
            self.assertEqual(result.returncode,2);self.assertEqual(json.loads(result.stdout)['status'],'INCOMPLETE')
            self.assertNotIn(b'SYNTHETIC_DO_NOT_EMIT',result.stdout+result.stderr)

if __name__=='__main__':unittest.main()
