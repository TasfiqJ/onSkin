"""Small deterministic refusal controls; synthetic fixtures never stand for scans."""
import csv, io, json, pathlib, subprocess, tempfile, unittest, zipfile
import candidate as c
import reconcile as r
import source_scan as s


def wheel(files):
    files=dict(files);record='semgrep-1.181.0.dist-info/RECORD';rows=[]
    import base64,hashlib
    for name,data in files.items():rows.append([name,'sha256='+base64.urlsafe_b64encode(hashlib.sha256(data).digest()).decode().rstrip('='),str(len(data))])
    rows.append([record,'','']);out=io.StringIO(newline='');csv.writer(out,lineterminator='\n').writerows(rows);files[record]=out.getvalue().encode()
    out=io.BytesIO()
    with zipfile.ZipFile(out,'w') as z:
        for name,data in files.items():z.writestr(name,data)
    return out.getvalue()


class CandidateTests(unittest.TestCase):
    def test_typed_complete_results_timeout_missing_duplicate_stale_and_rule_drift(self):
        import copy
        row=dict(bundle='typescript',expected_sha256='a'*64,raw_exit=0,status='EXECUTED',coverage_complete=True,
                 errors=[],unscanned_targets=[],skipped_rules=[])
        good=dict(admission='NONE',source_commit='b'*40,runs=[row]);pins={'typescript':'a'*64}
        s.validate_outcomes(good,'b'*40,pins)
        for mutate in [lambda v:v['runs'].clear(),lambda v:v['runs'].append(copy.deepcopy(row)),
                       lambda v:v['runs'][0].update(raw_exit=True),lambda v:v.update(source_commit='c'*40),
                       lambda v:v['runs'][0].update(expected_sha256='d'*64),
                       lambda v:v['runs'][0].update(unscanned_targets=['missing.py']),
                       lambda v:v['runs'][0].update(status='TIMEOUT',raw_exit=None),
                       lambda v:v['runs'][0].update(errors=[{'type':'ParseError'}]),
                       lambda v:v['runs'][0].update(skipped_rules=['missing-rule'])]:
            value=copy.deepcopy(good);mutate(value)
            with self.assertRaises(ValueError):s.validate_outcomes(value,'b'*40,pins)
    def test_exact_deterministic_metadata_record_derivative_and_unchanged_core(self):
        raw=wheel({'semgrep-1.181.0.dist-info/METADATA':b'Name: semgrep\nVersion: 1.181.0\nRequires-Dist: mcp==1.29.0\n',
                   'semgrep/bin/semgrep-core':b'synthetic-core','semgrep/LICENSE':b'synthetic-license'})
        first,proof=c.derive(raw);second,_=c.derive(raw)
        self.assertEqual(first,second);self.assertEqual(len(proof['changed_members']),2)
        self.assertEqual(c.wheel_members(first)['semgrep/bin/semgrep-core'],b'synthetic-core')
        with self.assertRaisesRegex(ValueError,'EXACT_MCP'):c.derive(first)
        for member in ['../escape.py','/absolute.py','a\\b.py','sitecustomize.py','evil.pth']:
            with self.subTest(member=member),self.assertRaises(ValueError):c.wheel_members(wheel({member:b'inert'}))
        with self.assertRaises(ValueError):c.wheel_members(wheel({'semgrep-1.181.0.dist-info/RECORD':b'broken'}))
        out=io.BytesIO()
        with zipfile.ZipFile(out,'w') as z:
            info=zipfile.ZipInfo('link');info.create_system=3;info.external_attr=0o120777<<16;z.writestr(info,'target')
        with self.assertRaisesRegex(ValueError,'LINK'):c.wheel_members(out.getvalue())
        with tempfile.TemporaryDirectory() as t:
            path=pathlib.Path(t);(path/'entry').write_text('original')
            baseline=c.installed_tree(path);(path/'entry').write_text('drift')
            self.assertNotEqual(c.installed_tree(path),baseline)

    def test_complete_object_partition_wrong_blob_missing_duplicate_and_digest_lookalike(self):
        with tempfile.TemporaryDirectory() as t:
            p=pathlib.Path(t);repo=p/'repo';repo.mkdir()
            def git(*args):return subprocess.check_output(['git','-C',str(repo),*args],stderr=subprocess.DEVNULL)
            git('init','-q');(repo/'input.json').write_bytes(b'{"synthetic":true}\n')
            digest=c.SHA((repo/'input.json').read_bytes());(repo/'proof.txt').write_text(digest+'\n')
            (repo/'code.py').write_text('value=1\n');(repo/'binary.bin').write_bytes(b'\0\xff')
            git('add','.');git('-c','user.name=Synthetic','-c','user.email=synthetic@example.invalid','-c','commit.gpgsign=false','commit','-qm','synthetic only')
            head=git('rev-parse','HEAD').decode().strip();inventory=s.snapshot(repo,head,p/'snapshot')
            s.validate_inventory(inventory,repo);self.assertEqual(len(inventory['paths']),4)
            for mode in ['omit','duplicate','blob']:
                value=json.loads(json.dumps(inventory))
                if mode=='omit':value['paths'].pop()
                if mode=='duplicate':value['paths'].append(value['paths'][0])
                if mode=='blob':value['paths'][0]['git_blob']='0'*40
                with self.subTest(mode=mode),self.assertRaises(ValueError):s.validate_inventory(value,repo)
            proposal=r.propose_digest(repo,head,'proof.txt',1,1,'input.json');self.assertEqual(proposal['admission'],'NONE')
            for start,end,input_path in [(True,1,'input.json'),(2,3,'input.json'),(1,1,'code.py')]:
                with self.assertRaises(ValueError):r.propose_digest(repo,head,'proof.txt',start,end,input_path)
            (repo/'code.py').write_text('ignored local drift\n')
            _,raw=r.blob(repo,head,'code.py');self.assertEqual(raw,b'value=1\n')


if __name__=='__main__':unittest.main()
