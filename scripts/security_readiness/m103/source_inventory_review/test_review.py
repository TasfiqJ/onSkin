"""Adversarial checks use synthetic vectors; no fixture grants Security acceptance."""
import copy
import gzip
import importlib.util
import pathlib
import subprocess
import tempfile
import unittest

import review as r

ROOT = pathlib.Path(__file__).resolve().parents[4]


class ReviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.c = r.contract(ROOT, r.BASE)
        cls.old, cls.policy, cls.scope = r.frozen(ROOT, cls.c)
        # Full real-source generation is exercised separately in two clean clones.
        names = cls.scope['explicitTargets'] + ['x.py']
        cls.entries = [dict(path=n, mode='100644', git_blob='1'*40) for n in sorted(names)]
        rows = [dict(path=e['path'],current=dict(e,bytes=1,sha256='2'*64),frozen=None,
                     old_target=None,relation='added',disposition='required',reason='source-text-or-generic-input',
                     original_classifier='required',accepted=False) for e in cls.entries]
        cls.vector = dict(paths=rows,explicit_sql=[x for x in rows if x['path'].endswith('.sql')],
                          original_pins=r.PINS,tracked_regular_paths=len(rows),
                          relations=dict(added=len(rows),changed=0,missing=0,unchanged=0),
                          dispositions={'required':len(rows)},**r.FLAGS)

    def check_refused_and_restored(self, mutate, code):
        bad=copy.deepcopy(self.vector);mutate(bad)
        with self.assertRaisesRegex(r.Refused,code): r.validate(bad,self.entries)
        r.validate(self.vector,self.entries)

    def test_duplicate_source_and_restore(self):
        self.check_refused_and_restored(lambda v:v['paths'].append(v['paths'][-1]),'DUPLICATE')

    def test_omitted_source_and_restore(self):
        self.check_refused_and_restored(lambda v:v['paths'].pop(),'SOURCE_OMISSION')

    def test_changed_git_blob_and_restore(self):
        self.check_refused_and_restored(lambda v:v['paths'][-1]['current'].update(git_blob='3'*40),'CHANGED_GIT_BLOB')

    def test_noncanonical_order_and_restore(self):
        self.check_refused_and_restored(lambda v:v['paths'].reverse(),'NONCANONICAL')

    def test_missing_sql_and_restore(self):
        self.check_refused_and_restored(lambda v:v['explicit_sql'].pop(),'MISSING_SQL')

    def test_forged_go_all_claim_fields(self):
        for key in r.FLAGS:
            with self.subTest(key=key):
                bad=copy.deepcopy(self.vector);bad[key]=True
                with self.assertRaisesRegex(r.Refused,'FORGED_SECURITY_GO'):r.validate(bad,self.entries)

    def test_forged_row_acceptance(self):
        self.check_refused_and_restored(lambda v:v['paths'][-1].update(accepted=True),'ROW_ADMISSION')

    def test_original_rule_hash_pin_and_restore(self):
        with tempfile.TemporaryDirectory() as temp:
            folder=pathlib.Path(temp);f=folder/'owasp-top-ten.yaml';f.write_bytes(b'rules: []\n')
            with self.assertRaisesRegex(r.Refused,'RULE_HASH_MISMATCH'):
                r.verify_rules(folder,{'owasp-top-ten':self.policy['rules']['owasp-top-ten']})
            # Authentic rule checks, even synthetic ones, cannot yield all-four GO.
            self.assertFalse(r.verify_rules(folder,{'owasp-top-ten':r.sha(f.read_bytes())})['all_four_rule_claim'])

    def test_malformed_scope(self):
        for mutate in (lambda s:s.update(schema=True),lambda s:s.update(extra=[]),
                       lambda s:s['targets'].pop(),lambda s:s['targets'].append(s['targets'][0]),
                       lambda s:s['explicitTargets'].pop()):
            s=copy.deepcopy(self.scope);mutate(s)
            with self.assertRaises(r.Refused):r.validate_scope(s,self.old)
        r.validate_scope(self.scope,self.old)

    def test_path_traversal_and_windows_alias(self):
        for name in ('../a','/a','C:/a','a\\b','a//b','a/./b','a\0b','a\nb','a/CON','a/x.','a/x '):
            with self.subTest(path=repr(name)),self.assertRaises(r.Refused):r.path_ok(name)

    def test_output_traversal_cannot_bypass_external_source_guard(self):
        with self.assertRaisesRegex(r.Refused,'OUTPUT_PATH_TRAVERSAL'):
            r.external_output(ROOT,ROOT.parent/'external'/'..'/ROOT.name/'new')
        with self.assertRaisesRegex(r.Refused,'OUTPUT_INSIDE_MEASURED_SOURCE'):
            r.external_output(ROOT,ROOT/'new')

    def test_symlink_git_mode_refused_without_windows_privilege(self):
        with tempfile.TemporaryDirectory() as temp:
            folder=pathlib.Path(temp)
            subprocess.run(['git','init','-q',str(folder)],check=True)
            p=subprocess.run(['git','-C',str(folder),'hash-object','-w','--stdin'],input=b'../outside',capture_output=True,check=True)
            oid=p.stdout.decode().strip()
            subprocess.run(['git','-C',str(folder),'update-index','--add','--cacheinfo','120000,'+oid+',link'],check=True)
            tree=r.git(folder,'write-tree').decode().strip()
            with self.assertRaisesRegex(r.Refused,'NONREGULAR_GIT_OBJECT'):r.tree_entries(folder,tree)

    def test_git_object_byte_tamper_and_restore(self):
        b=b'authentic';oid=__import__('hashlib').sha1(b'blob 9\0'+b).hexdigest()
        with self.assertRaisesRegex(r.Refused,'GIT_BLOB_DRIFT'):r.verify_blob(b+b'x',oid)
        r.verify_blob(b,oid)

    def test_unreviewed_gzip_never_excluded(self):
        for name in ('docs/brain/checkpoints/new.json.gz','new.gz'):
            got=r.classification(self.c,name,gzip.compress(b'{}',mtime=0))
            self.assertEqual(got['disposition'],'REFUSED')
            self.assertIn('UNREVIEWED_COMPRESSED_SOURCE',got['reason'])

    def test_tampered_pinned_gzip_crc_and_truncation(self):
        b=gzip.compress(b'{}',mtime=0);name=r.SECURITY+'history.json.gz'
        self.assertEqual(r.classification(self.c,name,b)['disposition'],'excluded')
        for bad in (b[:-3],b[:-8]+b'xxxxxxxx',b'not gzip'):
            self.assertEqual(r.classification(self.c,name,bad)['disposition'],'REFUSED')
        self.assertEqual(r.inflate(b),b'{}')

    def test_decompression_bomb_is_bounded(self):
        b=gzip.compress(b'x'*8192,mtime=0)
        with self.assertRaisesRegex(r.Refused,'GZIP_INFLATION_LIMIT'):r.inflate(b,limit=1024)

    def test_oversized_required_source_stays_refused(self):
        b=b'x'*(4*1024**2+1)
        self.assertEqual(r.classification(self.c,'evidence.json',b)['disposition'],'REFUSED')
        self.assertEqual(r.classification(self.c,'evidence.json',b[:-1])['disposition'],'required')

    def test_duplicate_json_key_original_parser(self):
        with self.assertRaisesRegex(self.c.Rejected,'DUPLICATE_JSON'):self.c.parse_json(b'{"x":1,"x":2}')

    def test_denominator_cannot_be_resigned(self):
        self.check_refused_and_restored(lambda v:v.update(tracked_regular_paths=0),'DENOMINATOR')

    def test_live_proposal_cycle_refuses_two_successive_rebindings(self):
        proposal_path=r.SECURITY+'proposal.json';manifest_path=r.SECURITY+'source-manifest.json'
        proposal={'sourceManifest':'0'*64}
        p0=r.canonical(proposal)
        m0=[dict(path=proposal_path,sha256=r.sha(p0))]
        proposal['sourceManifest']=r.sha(r.canonical(m0));p1=r.canonical(proposal)
        self.assertNotEqual(p0,p1)
        self.assertNotEqual(m0[0]['sha256'],r.sha(p1))
        m1=[dict(path=proposal_path,sha256=r.sha(p1))]
        self.assertNotEqual(r.sha(r.canonical(m0)),r.sha(r.canonical(m1)))
        with self.assertRaisesRegex(r.Refused,'LIVE_PROPOSAL_CUSTODY_CYCLE'):
            r.live_candidate(m1,manifest_path,r.canonical(m1),proposal,proposal_path,p1)
        with self.assertRaisesRegex(r.Refused,'SELF_REFERENTIAL_MANIFEST'):
            r.live_candidate([dict(path=manifest_path)],manifest_path,b'',proposal,proposal_path,p1)

    def test_added_evidence_tail_and_removal(self):
        spec=importlib.util.spec_from_file_location('original_scan',ROOT/r.M103/'source_scan.py')
        import sys
        sys.path.insert(0,str(ROOT/r.M103))
        source_scan=importlib.util.module_from_spec(spec);spec.loader.exec_module(source_scan)
        # Reuse authentic original non-admission outcome validation.
        with self.assertRaisesRegex(ValueError,'STALE_SOURCE_OR_ADMISSION'):
            source_scan.validate_outcomes(dict(source_commit=r.BASE,admission='GO',runs=[]),r.BASE,{})
        with tempfile.TemporaryDirectory() as temp:
            folder=pathlib.Path(temp)
            subprocess.run(['git','init','-q',str(folder)],check=True)
            p=subprocess.run(['git','-C',str(folder),'hash-object','-w','--stdin'],input=b'x',capture_output=True,check=True)
            oid=p.stdout.decode().strip()
            subprocess.run(['git','-C',str(folder),'update-index','--add','--cacheinfo','100644,'+oid+',a'],check=True)
            tree=r.git(folder,'write-tree').decode().strip()
            # No need to create an artificial source commit or fake a source GO.
            entries=r.tree_entries(folder,tree)
            self.assertEqual(len(entries),1)
            subprocess.run(['git','-C',str(folder),'update-index','--add','--cacheinfo','100644,'+oid+',tail'],check=True)
            grown=r.tree_entries(folder,r.git(folder,'write-tree').decode().strip())
            with self.assertRaisesRegex(r.Refused,'SOURCE_OMISSION_OR_EXTRA'):r.validate(self.vector,grown)

    def test_nonignored_tail_refuses_ignored_regular_files_are_accounted(self):
        with tempfile.TemporaryDirectory() as temp:
            folder=pathlib.Path(temp)
            subprocess.run(['git','init','-q',str(folder)],check=True)
            (folder/'a').write_bytes(b'x');(folder/'.gitignore').write_bytes(b'cache\n')
            r.git(folder,'add','a','.gitignore')
            r.git(folder,'-c','user.name=Synthetic fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixture')
            head=r.git(folder,'rev-parse','HEAD').decode().strip();entries=r.tree_entries(folder,head)
            (folder/'cache').write_bytes(b'ignored')
            got=r.workspace(folder,head,self.c,entries)
            self.assertEqual(got['ignored'][0]['sha256'],r.sha(b'ignored'))
            (folder/'tail').write_bytes(b'new evidence')
            with self.assertRaisesRegex(r.Refused,'UNTRACKED_EVIDENCE_TAIL'):r.workspace(folder,head,self.c,entries)
            (folder/'tail').unlink()
            r.workspace(folder,head,self.c,entries)


if __name__=='__main__':unittest.main()
