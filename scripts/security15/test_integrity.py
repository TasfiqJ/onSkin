"""Parser, original scope and private-output integrity controls. No credential data."""
import copy
import gzip
import io
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch
import source_bindings as b
import verify_candidate as verify


class Integrity(unittest.TestCase):
    def test_nul_and_tree_failures(self):
        oid='1'*40
        good=('100644 blob '+oid+'\tx.py\0').encode()
        self.assertIn('x.py',b.inv.tree_entries(good))
        for raw in [good[:-1],b'\0',good+good,good.replace(b'100644',b'120000'),
                    good.replace(b'100644',b'160000'),good.replace(b'x.py',b'../x.py'),
                    good.replace(b'x.py',b'\xff.py'),good.replace(b'blob',b'commit')]:
            with self.subTest(raw_length=len(raw)),self.assertRaises((ValueError,UnicodeError)):
                b.inv.tree_entries(raw)
        for names in [('a.py','A.py'),('caf\u00e9.py','cafe\u0301.py'),
                      ('Foo/a.py','foo/b.py'),('x.py','\uff58.py')]:
            # NFKC catches canonical composed/decomposed and width aliases.
            with self.subTest(names=names),self.assertRaises(ValueError):b.paths(names)

    def test_duplicate_json_and_gzip(self):
        for raw in [b'{"a":1,"a":2}',b'{"a":NaN}',b'{"a":']:
            with self.assertRaises(ValueError):b.parse(raw)
        good=gzip.compress(b'{"a":1}',mtime=0)
        self.assertEqual(b.strict_gzip(good),b'{"a":1}')
        for raw in [good[:-1],good+b'junk',good+good,b'broken-gzip',gzip.compress(b'x'*100)]:
            with self.subTest(length=len(raw)),self.assertRaises((ValueError,Exception)):
                b.strict_gzip(raw,50)

    def test_archive_integrity(self):
        def archive(names):
            out=io.BytesIO()
            with zipfile.ZipFile(out,'w') as z:
                for n in names:z.writestr(n,b'synthetic')
            return out.getvalue()
        raw=archive(['a.json'])
        self.assertEqual(verify.archive(raw),{'a.json':b'synthetic'})
        for value in [raw[:-12],b'bad zip',archive(['a','A']),archive(['../a']),archive(['/a'])]:
            with self.assertRaises(Exception):verify.archive(value)
        out=io.BytesIO()
        with zipfile.ZipFile(out,'w') as z:
            info=zipfile.ZipInfo('link');info.external_attr=0o120777<<16;z.writestr(info,b'a')
        with self.assertRaises(ValueError):verify.archive(out.getvalue())

    def test_original_target_addition_and_deletion_separately(self):
        raw=b.regular(b.ROOT/(b.inv.PREFIX+'scan-targets.json.gz'))
        scope=b.parse(b.strict_gzip(raw))
        original=b.inv.manifest_rows(b.regular(b.ROOT/(b.inv.PREFIX+'source-manifest.json')),
                                     b.inv.PINS['source-manifest.json'])
        original.update({b.inv.PREFIX+n:b.inv.PINS[n] for n in ('source-manifest.json','proposal.json')})
        b.inv.coverage_rows(raw,b.inv.PINS['scan-targets.json.gz'],original)
        for addition in (False,True):
            changed=copy.deepcopy(scope)
            if addition:
                row=copy.deepcopy(changed['targets'][0]);row['path']='unreviewed-extra-source.py';changed['targets'].append(row)
            else:changed['targets'].pop()
            data=gzip.compress(b.canonical(changed),mtime=0)
            with self.assertRaises(ValueError):b.inv.coverage_rows(data,b.sha(data),original)
        for leaf in ('source-manifest.json','scan-targets.json.gz','proposal.json','contract.py',
                     'secret_scan.py','gitleaks.toml','workflow_contract.mjs'):
            path=b.ROOT/(b.inv.PREFIX+leaf)
            authentic=b.regular(path)
            with self.assertRaises(ValueError):
                b.need(b.sha(authentic+b'changed')==b.inv.PINS[leaf],'ORIGINAL_WITNESS_IDENTITY')

    def test_original_classifier_no_new_ignored_source(self):
        c=b.classifier(b.ROOT)
        self.assertEqual(c('new.py',b'print(1)'),('required','source-text-or-generic-input'))
        self.assertEqual(c('retained/checkpoint.json',b'{}'),('required','source-text-or-generic-input'))
        with self.assertRaises(ValueError):c('retained/new.gz',b'\x1f\x8bother')
        with self.assertRaises(ValueError):c('large.py',b'x'*(4*1024**2+1))

    def test_policy_forgery(self):
        b.policy(b.ROOT)
        with patch.dict(b.os.environ,{'GIT_INDEX_FILE':'synthetic-cloned-index'}):
            with self.assertRaises(ValueError):b.policy(b.ROOT)
        for key,value in [('acceptanceGranted',True),('status','ACCEPTED'),('newPaths','ignored')]:
            obj=copy.deepcopy(b.POLICY_VALUE);obj[key]=value
            with patch.object(b,'regular',return_value=b.canonical(obj)):
                with self.assertRaises(ValueError):b.policy(b.ROOT)

    def test_replaced_commit_tree_cannot_forge_snapshot(self):
        with patch.object(b.inv,'snapshot',return_value={'a.py':dict(mode='100644',blob='1'*40)}),\
             patch.object(b,'entries',return_value={'b.py':dict(mode='100644',blob='1'*40)}):
            with self.assertRaises(ValueError):b.snapshot(b.ROOT,'0'*40)


if __name__=='__main__':unittest.main()
