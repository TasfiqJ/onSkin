"""Synthetic real-Git histories and fabricated unit receipts, never scan evidence."""
import copy, datetime, io, json, os, pathlib, subprocess, tarfile, tempfile, unittest
from unittest import mock
import secret_scan as s

def synthetic_proof(scope, run_id='123987', history_results=None):
    """Unit data only; these tool paths are never acquired or executed."""
    now = s.stamp(); tools = {}
    for name, pin in s.PINS.items():
        path = '/synthetic/tools/' + name
        version = dict(argv=[path, 'version' if name == 'gitleaks' else '--version'], exit=0,
            stdout='8.24.3\n' if name == 'gitleaks' else 'trufflehog 3.99.3\n', stderr='')
        tools[name] = dict(**pin, path=path, version_result=version)
    proof = dict(schema=1, purpose='ORIGINAL_SECRET_DIAGNOSTIC_NOT_G97_ACCEPTANCE',
        source=scope, source_ref=scope['refs'][0].split()[0], run_id=run_id,
        started=now, finished=now, tools=tools, commands={}, mirror='/synthetic/history.git',
        snapshot='/synthetic/current', sarif='/synthetic/evidence/gitleaks-results.sarif',
        current_report='/synthetic/current-gitleaks.json')
    sarif = dict(version='2.1.0', **{'$schema': 'https://json.schemastore.org/sarif-2.1.0.json'},
        runs=[dict(tool=dict(driver=dict(name='gitleaks', semanticVersion='v8.0.0')), results=history_results or [])])
    proof['sarif_sha256'] = s.sha(s.canon(sarif))
    for name, argv in s.commands(tools, proof['mirror'], proof['snapshot'], proof['sarif'], proof['current_report']).items():
        findings = len(history_results or []) if name == 'gitleaks-history' else 0
        stderr = (str(len(scope['patch_commits'])) + ' commits scanned.\nscanned ~123 bytes (0.00 MB) in 1s\n' +
                  ('leaks found: '+str(findings) if findings else 'no leaks found')+'\n') if name.startswith('gitleaks') else '{"msg":"finished scanning","trufflehog_version":"3.99.3","chunks":1,"bytes":1,"verified_secrets":0,"unverified_secrets":0}\n'
        proof['commands'][name] = dict(argv=argv, cwd='/synthetic', started=now, finished=now,
            exit=2 if name == 'gitleaks-history' and history_results else 0,
            stdout='', stderr=stderr, stdout_sha256=s.sha(b''), stderr_sha256=s.sha(stderr.encode()))
    proof['commands']['gitleaks-current']['report'] = []
    return proof, sarif

class SecretScanTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='onskin-secret-unit-'); self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name) / 'source'; self.root.mkdir()
        self.out = pathlib.Path(self.temp.name) / 'evidence'; self.out.mkdir()
        self.git('init', '-q', '-b', 'synthetic-history')
        self.git('config', 'user.name', 'Synthetic Fixture'); self.git('config', 'user.email', 'fixture@example.invalid')
        for i in range(36):
            (self.root / 'sentinel.txt').write_text('Newest non-secret sentinel36\n' if i == 35 else 'Non-secret synthetic revision' + str(i) + '\n')
            self.git('add', '.'); self.git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'Synthetic revision' + str(i))
        self.scope = s.git_scope(self.root)
        self.proof, self.sarif = synthetic_proof(self.scope)
        self.save()
    def git(self, *args): return s.git(self.root, *args)
    def save(self):
        (self.out / s.PROOF).write_bytes(s.canon(self.proof))
        (self.out / 'gitleaks-results.sarif').write_bytes(s.canon(self.sarif))
    def validate(self): return s.validate_proof(self.out, self.root, self.scope['head'], '123987')
    def test_actual_history_reproduces_first30_cutoff_and_newest_scope(self):
        first30 = self.git('rev-list', '--reverse', 'HEAD').decode().splitlines()[:30]
        self.assertEqual(len(first30), 30); self.assertNotIn(self.scope['head'], first30)
        old = self.git('log', '-p', first30[-1]).decode()
        corrected = self.git('log', '--all', '--full-history', '-p').decode()
        self.assertNotIn('Newest non-secret sentinel36', old)
        self.assertIn('Newest non-secret sentinel36', corrected)
        self.assertEqual(len(self.scope['commits']), 36); self.validate()
        self.assertIn('--log-opts=--all --full-history --diff-merges=first-parent', self.proof['commands']['gitleaks-history']['argv'])
        blob = self.git('cat-file', 'blob', self.scope['snapshot'][0]['object'])
        self.assertEqual(blob, b'Newest non-secret sentinel36\n')
    def test_omitted_newest_ref_source_run_or_snapshot_substitution_rejects(self):
        original = copy.deepcopy(self.proof)
        for change in [lambda p: p['source']['commits'].remove(self.scope['head']),
            lambda p: p['source']['refs'].clear(), lambda p: p['source'].update(head='0'*40),
            lambda p: p['source'].update(tree='0'*40), lambda p: p.update(run_id='999'),
            lambda p: p['source']['snapshot'][0].update(sha256='0'*64),
            lambda p: p.update(source_ref='refs/heads/missing')]:
            self.proof = copy.deepcopy(original); change(self.proof); self.save()
            with self.assertRaises(ValueError): self.validate()
    def test_missing_truncated_stale_output_and_forged_range_rejects(self):
        original = copy.deepcopy(self.proof)
        changes = [lambda p: p['commands'].pop('trufflehog-current'),
            lambda p: p['commands']['gitleaks-history']['argv'].append('--since-commit=stale'),
            lambda p: p['commands']['trufflehog-current'].update(stdout='substitution'),
            lambda p: p['commands']['gitleaks-history'].update(exit=127),
            lambda p: p.update(started='2020-01-01T00:00:00+00:00')]
        for change in changes:
            self.proof = copy.deepcopy(original); change(self.proof); self.save()
            with self.assertRaises(ValueError): self.validate()
        for stderr in ['', 'scan completed\n', '30 commits scanned\nscan completed\n', '36 commits scanned\n']:
            self.proof = copy.deepcopy(original); row = self.proof['commands']['gitleaks-history']
            row.update(stderr=stderr, stderr_sha256=s.sha(stderr.encode())); self.save()
            with self.assertRaises(ValueError): self.validate()
        (self.out / s.PROOF).unlink()
        with self.assertRaises(FileNotFoundError): self.validate()
    def test_exact_tool_asset_executable_and_version_mismatches_reject(self):
        original = copy.deepcopy(self.proof)
        for name in s.PINS:
            for key, value in [('version','3.99.2'), ('asset','0'*64), ('binary','0'*64), ('url','https://example.invalid/latest')]:
                self.proof=copy.deepcopy(original); self.proof['tools'][name][key]=value; self.save()
                with self.assertRaises(ValueError): self.validate()
            self.proof=copy.deepcopy(original); self.proof['tools'][name]['version_result']['stdout']='forged\n'; self.save()
            with self.assertRaises(ValueError): self.validate()
    def test_raw_reports_findings_and_exits_remain_independent(self):
        self.proof['commands']['gitleaks-current'].update(exit=2,report=[{'synthetic': 'finding'}]); self.save()
        with self.assertRaisesRegex(ValueError,'CURRENT_SOURCE_FINDINGS'):self.validate()
        self.proof, self.sarif = synthetic_proof(self.scope); self.sarif['runs'][0]['results']=[{}]; self.save()
        with self.assertRaisesRegex(ValueError,'SARIF_SUBSTITUTION'):self.validate()
        self.proof['sarif_sha256']=s.sha(s.canon(self.sarif));self.save()
        with self.assertRaisesRegex(ValueError,'EXIT_REPORT_DRIFT'):self.validate()
    def test_ref_drift_or_new_commit_invalidates_prior_receipt(self):
        self.git('tag','new-ref')
        with self.assertRaisesRegex(ValueError,'SOURCE_OR_RUN_DRIFT'):self.validate()
    def test_merge_only_content_is_part_of_the_required_patch_scope(self):
        self.git('checkout','-qb','synthetic-side','HEAD~1')
        (self.root/'side.txt').write_text('Non-secret side content\n');self.git('add','.');self.git('-c','commit.gpgsign=false','commit','-qm','Synthetic side')
        self.git('checkout','-q','synthetic-history');self.git('merge','--no-ff','--no-commit','synthetic-side')
        (self.root/'merge-only.txt').write_text('Non-secret newest merge sentinel\n');self.git('add','.');self.git('-c','commit.gpgsign=false','commit','-qm','Synthetic merge')
        scope=s.git_scope(self.root)
        self.assertIn(scope['head'],scope['patch_commits'])
        self.assertIn('Non-secret newest merge sentinel',self.git('log','--all','--full-history','--diff-merges=first-parent','-p').decode())
    def test_binary_and_deletion_commits_remain_in_reachable_history(self):
        (self.root/'binary.dat').write_bytes(b'\0non-secret-binary')
        self.git('add','.');self.git('-c','commit.gpgsign=false','commit','-qm','Synthetic binary only')
        binary=self.git('rev-parse','HEAD').decode().strip()
        self.git('rm','-q','sentinel.txt');self.git('-c','commit.gpgsign=false','commit','-qm','Synthetic deletion only')
        scope=s.git_scope(self.root)
        self.assertIn(binary,scope['commits']);self.assertIn(scope['head'],scope['commits'])
        self.assertNotIn(binary,scope['patch_commits']);self.assertNotIn(scope['head'],scope['patch_commits'])
        self.assertTrue(any(r['path']=='binary.dat' for r in scope['snapshot']))
    def test_safe_archive_and_byte_substitution_refuse_before_execution(self):
        def archive(name,kind=tarfile.REGTYPE):
            out=io.BytesIO()
            with tarfile.open(fileobj=out,mode='w:gz') as tar:
                item=tarfile.TarInfo(name);item.type=kind;item.size=3;item.linkname='../outside';tar.addfile(item,io.BytesIO(b'abc'))
            return out.getvalue()
        self.assertEqual(s.extract(archive('gitleaks'),'gitleaks'),b'abc')
        for name,kind in [('../gitleaks',tarfile.REGTYPE),('/gitleaks',tarfile.REGTYPE),('gitleaks',tarfile.SYMTYPE),('gitleaks',tarfile.LNKTYPE)]:
            with self.assertRaises(ValueError):s.extract(archive(name,kind),'gitleaks')
        with mock.patch.object(s.platform,'machine',return_value='x86_64'), mock.patch.object(s.sys,'platform','linux'), mock.patch.object(s.urllib.request,'urlopen') as download:
            download.return_value.__enter__.return_value.geturl.return_value='https://example.invalid/exact'
            download.return_value.__enter__.return_value.read.return_value=archive('gitleaks')
            with mock.patch.object(s.subprocess,'run') as execute, self.assertRaisesRegex(ValueError,'ASSET_BYTES'):
                s.acquire(pathlib.Path(self.temp.name)/'new-tools')
            execute.assert_not_called()

if __name__ == '__main__': unittest.main()
