"""Synthetic disclosure/omission/bounds controls; never substituted for a real scan."""
import bz2
import copy
import hashlib
import evaluate
import warnings
import contextlib
import gzip
import io
import json
import lzma
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import tarfile
import time
import unittest
from unittest.mock import patch
import zipfile

from collect import execute
from evaluate import count, summary
from inventory import archives, remember, safe
from redact import Refusal, canonical, diagnostic, loads

POLICY = dict(maxFileBytes=1048576, maxExpandedBytes=2097152, maxArchiveMembers=100,
              maxArchiveDepth=4, maxRatio=10)


def archive(entries):
    stream = io.BytesIO()
    with warnings.catch_warnings():
      warnings.simplefilter('ignore', UserWarning)
      return archive_quiet(entries, stream)


def archive_quiet(entries, stream):
    with zipfile.ZipFile(stream, 'w', compression=zipfile.ZIP_DEFLATED) as handle:
        for name, raw, mode in entries:
            item = zipfile.ZipInfo(name)
            item.external_attr = mode << 16
            item.compress_type = zipfile.ZIP_DEFLATED
            handle.writestr(item, raw)
    return stream.getvalue()


def inspect(raw, name='fixture.zip'):
    totals = dict(containers=0, members=0, expandedBytes=0, binaryLeaves=0, textLeaves=0, custodyMembers=0)
    archives(name, raw, POLICY, totals)
    return totals


class Controls(unittest.TestCase):
    def test_path_escapes(self):
        for name in ('/absolute', '../escape', 'a/../b', 'a\\b', 'C:/drive', 'a:stream', 'CON',
                     'a/PRN.txt', 'a.', 'a ', 'a//b', './a', '\x00', 'a\nb',
                     'a<b', 'a>b', 'a|b', 'a?b', 'a*b', 'a"b'):
            with self.subTest(case=name), self.assertRaises(Refusal):
                safe(name)

    def test_parent_aliases_and_collisions(self):
        for first, second in [('Folder/a', 'folder/b'), ('\u00e9/a', 'e\u0301/b'), ('\uff21/a', 'A/b'), ('a', 'a/b')]:
            with self.subTest(case=first):
                aliases, explicit = {}, set(); remember(first, 'file', aliases, explicit)
                with self.assertRaises(Refusal):
                    remember(second, 'file', aliases, explicit)

    def test_duplicate_file(self):
        aliases, explicit = {}, set(); remember('a', 'file', aliases, explicit)
        with self.assertRaises(Refusal):
            remember('a', 'file', aliases, explicit)

    def test_archive_positive(self):
        result = inspect(archive([('dir/a.txt', b'public fixture', stat.S_IFREG | 0o644)]))
        self.assertEqual((result['containers'], result['members'], result['textLeaves']), (1, 1, 1))

    def test_archive_traversal_aliases(self):
        for entries in [[('../escape', b'x', 0)], [('A/a', b'x', 0), ('a/b', b'x', 0)],
                        [('a', b'x', 0), ('a', b'y', 0)], [('a', b'x', 0), ('a/b', b'y', 0)]]:
            with self.subTest(case=len(entries)), self.assertRaises(Refusal):
                inspect(archive(entries))

    def test_archive_nonregular(self):
        for mode in (stat.S_IFLNK | 0o777, stat.S_IFIFO | 0o644, stat.S_IFREG | stat.S_ISUID | 0o644):
            with self.subTest(mode=mode), self.assertRaises(Refusal):
                inspect(archive([('member', b'x', mode)]))

    def test_directory_payload_refused(self):
        with self.assertRaises(Refusal):
            inspect(archive([('dir/', b'omitted bytes', stat.S_IFDIR | 0o755)]))

    def test_archive_expansion(self):
        with self.assertRaises(Refusal):
            inspect(archive([('bomb', b'x' * 1100000, 0)]))

    def test_disguised_compression(self):
        for raw in (lzma.compress(b'x'), bz2.compress(b'x')):
            with self.subTest(size=len(raw)), self.assertRaises(Refusal):
                inspect(raw, 'disguised.bin')

    def test_archive_depth(self):
        raw = b'leaf'
        for _ in range(8):
            raw = archive([('nested.zip', raw, 0)])
        with self.assertRaises(Refusal):
            inspect(raw)

    def test_truncated_archive(self):
        with self.assertRaises((Refusal, zipfile.BadZipFile)):
            inspect(archive([('a', b'x', 0)])[:-12])

    def test_duplicate_nonfinite_json(self):
        for raw in ('{"a":1,"a":1}', '{"a":NaN}', '{"a":Infinity}'):
            with self.subTest(size=len(raw)), self.assertRaises((Refusal, ValueError)):
                loads(raw)

    def test_false_integer(self):
        for value in (True, False, 0.0, -1, '0', 2**54):
            with self.subTest(kind=type(value).__name__), self.assertRaises(Refusal):
                count(value)

    def test_no_self_admission(self):
        result = summary({'technical': {'state': 'PASS'}, 'qualified_custody': {'state': 'BLOCKED_EXTERNAL_CUSTODY'}})
        self.assertFalse(result['candidateReady']); self.assertFalse(result['acceptanceGranted'])
        self.assertEqual(result['G97'], 'FAIL/NO_GO')
        for state in ('PASS', 'NOT_RUN', True):
            with self.subTest(state=state), self.assertRaises(Refusal):
                summary({'qualified_custody': {'state': state}})

    def test_disclosure_errors(self):
        for value in ('SYNTHETIC_CANARY_DO_NOT_PUBLISH', 'C:/synthetic/private/canary', 'eyJsynthetic.invalid.signature'):
            for error in (OSError(value), ValueError(value), Refusal(value)):
                self.assertNotIn(value, canonical({'error': diagnostic(error)}).decode())

    def test_real_nonzero_exit(self):
        code, out, err = execute([sys.executable, '-I', '-c', 'import sys; sys.exit(7)'], Path.cwd(), 10)
        self.assertEqual((code, out, err), (7, b'', b''))

    def test_clear_git_environment(self):
        controls = {'GIT_DIR': 'synthetic', 'GIT_WORK_TREE': 'synthetic', 'GIT_INDEX_FILE': 'synthetic',
                    'GIT_CONFIG_PARAMETERS': 'synthetic', 'GIT_OBJECT_DIRECTORY': 'synthetic'}
        with patch.dict(os.environ, controls):
            code, out, _ = execute([sys.executable, '-I', '-c',
                'import os,json; print(json.dumps(sorted(k for k in os.environ if k.startswith("GIT_") and k != "GIT_TERMINAL_PROMPT")))'], Path.cwd(), 10)
        self.assertEqual((code, json.loads(out)), (0, []))

    def test_output_bounds(self):
        for channel in ('stdout', 'stderr'):
            with self.subTest(channel=channel), self.assertRaises(Refusal):
                execute([sys.executable, '-I', '-c', f'import sys; sys.{channel}.write("x"*100000)'], Path.cwd(), 10, 4096)

    def test_lifetime_bound(self):
        with self.assertRaises(Refusal):
            execute([sys.executable, '-I', '-c', 'import time; time.sleep(30)'], Path.cwd(), .2)

    def test_retire_detached_stdio_descendant(self):
        with tempfile.TemporaryDirectory(prefix='security22-synthetic-') as directory:
            target = Path(directory)/'should-not-exist'
            inner = 'import time,pathlib; time.sleep(1); pathlib.Path('+repr(str(target))+').write_text("synthetic")'
            outer = 'import subprocess,sys; subprocess.Popen([sys.executable,"-I","-c",'+repr(inner)+'],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)'
            code, _, _ = execute([sys.executable, '-I', '-c', outer], Path.cwd(), 10)
            self.assertEqual(code, 0)
            time.sleep(1.2)
            self.assertFalse(target.exists())


    def test_evaluator_envelope_attacks(self):
        H = 'a'*64
        ID = 'GHSA-grv7-fg5c-xmjg'
        TOKEN = 'SYNTHETIC_PRIVATE_SENTINEL_EVALUATOR_7ac2'
        LOCK = {'lockfileVersion':3,'packages':{'':{'name':'synthetic-root','version':'1.0.0'},'node_modules/braces':{'version':'3.0.3','integrity':'sha512-YQ==','resolved':'https://registry.npmjs.org/braces/-/braces-3.0.3.tgz'}}}
        KW = dict(lock_document=LOCK,npm_cli_sha256=H,node_version='v22.21.0')
        def rehash(v):
         v['installedSourceSHA256']=hashlib.sha256(json.dumps([v['installed']['records'],v['installed']['generated']],ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
        def fixture():
         v={'schema':1,'component':'dependency22','qualification':'PUBLIC_DEPENDENCY_TECHNICAL_ONLY','lockSHA256':H,'installedSourceSHA256':H,'nodeVersion':'v22.21.0','npmVersion':'11.20.0','npmCliSHA256':H,'coverage':{'lockEntries':2,'registryEntries':1,'workspaceEntries':1,'workspaceLinks':0,'uniqueNpmCoordinates':1},'installed':{'state':'PASS','expected':2,'accounted':2,'installed':2,'platformOptionalAbsent':0,'otherOptionalAbsent':0,'workspaceLinks':0,'files':1,'bytes':20,'records':[{'path':'','kind':'workspace','name':'synthetic-root','version':'1.0.0','state':'INSTALLED_VERIFIED','packageJSONSHA256':H,'files':1,'bytes':10,'sourceSHA256':H},{'path':'node_modules/braces','kind':'registry','name':'braces','version':'3.0.3','state':'INSTALLED_VERIFIED','packageJSONSHA256':H,'files':1,'bytes':20,'sourceSHA256':H}],'generated':[],'errors':[]},'npm':{'state':'FINDINGS','exit':1,'counts':{'info':0,'low':0,'moderate':0,'high':1,'critical':0,'total':1},'findings':[{'name':'braces','severity':'high','direct':False,'installedPaths':1,'ids':[ID],'propagatesFrom':[]}]},'osv':{'state':'FINDINGS','expected':1,'queried':1,'batches':1,'findings':[{'name':'braces','version':'3.0.3','ids':[ID]}]},'disagreements':{'npmOnly':[],'osvOnly':[]},'state':'FINDINGS','admission':'NOT_GRANTED'}
         rehash(v);return v
        results=[]
        def run(label,mutate,refuse=True,exit=1):
         v=fixture();mutate(v)
         try:
          out=evaluate.dependency(v,exit,H,**KW)
          assert not refuse, label+' accepted'
          assert TOKEN not in json.dumps(out)
          results.append({'case':label,'exit':0,'result':'VALIDATED'})
         except Refusal as error:
          assert refuse, str(error)
          assert TOKEN not in str(error)
          results.append({'case':label,'exit':1,'reason':str(error)})
        run('valid-current-findings',lambda v:None,False)
        run('sensitive-npm-hash',lambda v:v.update(npmCliSHA256=TOKEN))
        run('wrong-approved-npm-hash',lambda v:v.update(npmCliSHA256='b'*64))
        run('records-string',lambda v:v['installed'].update(records='xx'))
        run('errors-object',lambda v:v['installed'].update(errors={}))
        run('severity-count-mismatch',lambda v:v['npm']['counts'].update(high=0,critical=1))
        def duplicate_npm(v):
         v['npm']['findings']*=2;v['npm']['counts'].update(high=2,total=2)
        run('duplicate-npm-row',duplicate_npm)
        run('duplicate-npm-advisory',lambda v:v['npm']['findings'][0]['ids'].append(ID))
        run('duplicate-osv-coordinate',lambda v:v['osv']['findings'].append(copy.deepcopy(v['osv']['findings'][0])))
        run('duplicate-osv-advisory',lambda v:v['osv']['findings'][0]['ids'].append(ID))
        run('duplicate-propagation',lambda v:v['npm']['findings'][0].update(propagatesFrom=['braces','braces']))
        run('unknown-propagation',lambda v:v['npm']['findings'][0].update(propagatesFrom=[TOKEN]))
        run('unknown-package',lambda v:v['npm']['findings'][0].update(name=TOKEN))
        run('wrong-osv-version',lambda v:v['osv']['findings'][0].update(version='9.9.9'))
        run('wrong-npm-version',lambda v:v.update(npmVersion='11.19.0'))
        run('wrong-node-version',lambda v:v.update(nodeVersion='v20.1.0'))
        run('missing-public-field',lambda v:v.pop('npmVersion'))
        run('extra-sensitive-public-field',lambda v:v.update(private=TOKEN))
        run('false-count-boolean',lambda v:v['installed'].update(files=True))
        run('forged-source-hash',lambda v:v.update(installedSourceSHA256='b'*64))
        run('wrong-installed-version',lambda v:(v['installed']['records'][1].update(version='9.9.9'),rehash(v)))
        run('unknown-installed-path',lambda v:(v['installed']['records'][1].update(path='node_modules/'+TOKEN),rehash(v)))
        run('missing-installed-field',lambda v:(v['installed']['records'][1].pop('sourceSHA256'),rehash(v)))
        run('duplicate-installed-path',lambda v:(v['installed']['records'].append(copy.deepcopy(v['installed']['records'][1])),rehash(v)))
        run('generated-sensitive-field',lambda v:(v['installed']['generated'].append({'kind':'npm-bin-shims','files':1,'sha256':H,'path':TOKEN}),rehash(v)))
        run('unknown-error-enum',lambda v:v['installed']['errors'].append({'path':'node_modules/braces','reason':TOKEN}))
        run('osv-false-batch-count',lambda v:v['osv'].update(batches=0))
        run('omitted-osv-coordinate',lambda v:v['osv'].update(queried=0,batches=0))
        run('discarded-disagreement',lambda v:(v['osv']['findings'][0].update(ids=['GHSA-vfj7-8cjw-p6xm'])))
        def clean(v):
         v.update(state='PASS');v['npm'].update(state='PASS',exit=0,findings=[],counts={k:0 for k in v['npm']['counts']});v['osv'].update(state='PASS',findings=[])
        run('actual-complete-technical-pass',clean,False,0)
        run('fabricated-clean-wrong-actual-exit',clean,True,1)
        def partial(v):
         v.update(state='INCOMPLETE');v['osv'].update(state='INCOMPLETE',queried=0,batches=0,reason='OSV_QUERY_INCOMPLETE')
        run('truthful-osv-partial-findings',partial,False,2)
        def missing_tool(v):
         v.update(state='INCOMPLETE',npmCliSHA256=None,npmVersion=None);v['npm']={'state':'INCOMPLETE','exit':None,'reason':'NPM_NOT_EXECUTED'};v['disagreements']['osvOnly']=[ID]
        run('truthful-npm-not-executed',missing_tool,False,2)
        v=fixture();v['osv']['findings'][0]['ids']=['GHSA-vfj7-8cjw-p6xm'];v['disagreements']={'npmOnly':[ID],'osvOnly':['GHSA-vfj7-8cjw-p6xm']};o=evaluate.dependency(v,1,H,**KW);assert o['disagreements']==v['disagreements'];results.append({'case':'preserved-full-disagreement','exit':0,'result':'VALIDATED'})
        self.assertEqual(len(results), 34)

    def test_reader_failure_refuses_without_disclosure(self):
        class Broken:
            def read(self, _):
                raise OSError('SYNTHETIC_RUNTIME_READER_CANARY')
            def close(self):
                pass
        class Child:
            stdout = Broken()
            stderr = io.BytesIO()
            stdin = io.BytesIO()
            def poll(self): return 0
            def wait(self, **_): return 0
        leaked = io.StringIO()
        with patch('collect.subprocess.Popen', return_value=Child()), patch('collect.windows_job', return_value=lambda: None), patch('collect.stop'), contextlib.redirect_stderr(leaked):
            with self.assertRaises(Refusal):
                execute([sys.executable, '-I', '-c', 'pass'], Path.cwd(), 1)
        self.assertNotIn('SYNTHETIC_RUNTIME_READER_CANARY', leaked.getvalue())

    def test_tar_trailing_content_and_gzip_members(self):
        buffer = io.BytesIO()
        with tarfile.open(fileobj=buffer, mode='w') as handle:
            item = tarfile.TarInfo('ordinary'); item.size = 3
            handle.addfile(item, io.BytesIO(b'abc'))
        raw = buffer.getvalue()
        inspect(raw, 'ordinary.tar')
        for changed in (raw + raw, raw + b'not padding'):
            with self.assertRaises(Refusal):
                inspect(changed, 'trailing.tar')
        single = inspect(gzip.compress(b'one'), 'one.gz')
        joined = inspect(gzip.compress(b'one') + gzip.compress(b'two'), 'joined.gz')
        self.assertEqual((single['gzipMembers'], joined['gzipMembers']), (1, 2))
        nested = gzip.compress(b'one') + gzip.compress(archive([('../escape', b'x', 0)]))
        with self.assertRaises(Refusal):
            inspect(nested, 'nested.gz')

    def test_cli_errors_do_not_publish_arguments(self):
        import run
        output, error = io.StringIO(), io.StringIO()
        with patch.object(sys, 'argv', ['run.py', '--SYNTHETIC_ARGUMENT_CANARY']), contextlib.redirect_stdout(output), contextlib.redirect_stderr(error):
            code = run.main()
        self.assertEqual(code, 2)
        self.assertNotIn('SYNTHETIC_ARGUMENT_CANARY', output.getvalue() + error.getvalue())

    def test_disclosure_gate_rejects_false_schema(self):
        from run import disclosure_gate
        value = dict(errors=0, failures=0, passed=True, qualification='SYNTHETIC_DISCLOSURE_AND_BOUNDS_ONLY', skipped=0, testsRun=26)
        disclosure_gate(value, 0)
        for key, replacement in [('passed', 1), ('errors', False), ('testsRun', 26.0)]:
            changed = {**value, key: replacement}
            with self.subTest(key=key), self.assertRaises(Refusal):
                disclosure_gate(changed, 0)

    def test_separate_component_publication_is_exclusive_and_bound(self):
        import run
        components = {'technical': {'state': 'PASS'}, 'qualified_custody': {'state': 'BLOCKED_EXTERNAL_CUSTODY'}}
        result = dict(components=components, source={'head': 'a'*40, 'tree': 'b'*40},
                      toolchain={'identitySHA256': 'c'*64}, qualification='SYNTHETIC_PUBLICATION_ONLY')
        with tempfile.TemporaryDirectory(prefix='security22-publication-') as temporary:
            target = Path(temporary)/'new'
            run.publish_components(target, result)
            index = loads((target/'index.json').read_bytes())
            self.assertFalse(index['candidateReady']); self.assertEqual(index['G97'], 'FAIL/NO_GO')
            for name, witness in index['files'].items():
                raw = (target/name).read_bytes()
                self.assertEqual((len(raw), hashlib.sha256(raw).hexdigest()), (witness['bytes'], witness['sha256']))
                self.assertEqual(loads(raw)['head'], 'a'*40)
            with self.assertRaises(FileExistsError):
                run.publish_components(target, result)
        with self.assertRaises(Refusal):
            run.publish_components(run.ROOT/'must-not-be-created', result)


def main():
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(Controls)
    # Raw exception messages are not diagnostic artifacts, including synthetic ones.
    result = unittest.TextTestRunner(stream=io.StringIO()).run(suite)
    print(json.dumps(dict(qualification='SYNTHETIC_DISCLOSURE_AND_BOUNDS_ONLY', testsRun=result.testsRun,
                         failures=len(result.failures), errors=len(result.errors), skipped=len(result.skipped),
                         passed=result.wasSuccessful()), sort_keys=True))
    return 0 if result.wasSuccessful() and not result.skipped else 1


if __name__ == '__main__':
    sys.exit(main())
