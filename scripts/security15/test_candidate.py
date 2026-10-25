"""Falsify the actual complete frozen source snapshot, never a small substitute."""
import copy
import gzip
import io
import json
import unittest
from pathlib import Path
import source_bindings as b
import build_candidate as build
import verify_candidate as verify


def encode(header,rows):
    output=io.BytesIO()
    with gzip.GzipFile(filename='',fileobj=output,mode='wb',mtime=0) as z:
        z.write(b.canonical(header)+b'\n')
        for row in rows:z.write(b.canonical(row)+b'\n')
    return output.getvalue()


class CompleteSnapshot(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source=b.git(b.ROOT,'rev-parse','HEAD').decode().strip()
        cls.tree=b.git(b.ROOT,'rev-parse','HEAD^{tree}').decode().strip()
        cls.expected=build.candidate(b.ROOT,cls.source,cls.tree)
        cls.raw=encode(*cls.expected)
        print(json.dumps(dict(evidence='ACTUAL_COMPLETE_GIT_SNAPSHOT',
              source=cls.source,tree=cls.tree,current=cls.expected[0]['current_files'])),flush=True)

    def check(self,h,rows,source=None,tree=None):
        raw=encode(h,rows)
        return verify.compare_snapshot(raw,b.sha(raw),source or self.source,tree or self.tree,self.expected)

    def test_actual_current_malicious_restored(self):
        h,rows=self.expected
        verify.verify_snapshot(b.ROOT,self.raw,b.sha(self.raw),self.source,self.tree)
        mutations=[]
        removed=copy.deepcopy(rows);removed.pop();mutations.append(('dropped-path',removed))
        extra=copy.deepcopy(rows);row=copy.deepcopy(extra[-1]);row['path']='zzz-extra-malicious-source.py';extra.append(row)
        mutations.append(('extra-source',extra))
        for field,value in [('blob','0'*40),('sha256','0'*64),('mode','100755'),('bytes',123)]:
            changed=copy.deepcopy(rows);r=next(x for x in changed if x['after']);r['after'][field]=value
            mutations.append((field,changed))
        changed=copy.deepcopy(rows);r=next(x for x in changed if x['after']);r['path']='disguised-rename.py'
        mutations.append(('disguised-rename',changed))
        for name,changed in mutations:
            with self.subTest(name=name),self.assertRaises(ValueError):self.check(h,changed)
        self.check(h,rows)
        print('ACTUAL_SNAPSHOT_CURRENT_TAMPERED_RESTORED 0/1/0',flush=True)

    def test_forged_source_tree_and_no_acceptance(self):
        h,rows=self.expected
        for field,value in [('source','0'*40),('tree','0'*40),('acceptanceGranted',True),
                            ('status','ACCEPTED'),('current_files',0),('protected_absences',[])]:
            changed=copy.deepcopy(h);changed[field]=value
            with self.subTest(field=field),self.assertRaises(ValueError):self.check(changed,rows)
        with self.assertRaises(ValueError):verify.compare_snapshot(self.raw,'0'*64,self.source,self.tree,self.expected)

    def test_coverage_cannot_drop_legacy_or_new(self):
        h,rows=self.expected
        self.assertEqual({r['path'] for r in rows if r['after']},set(b.entries(b.ROOT,self.source)))
        original,_coverage,_witness=b.witnesses(b.ROOT,self.source)
        self.assertEqual({r['path'] for r in rows if r['before']},set(original))
        for predicate in [lambda r:r['before'] is not None,lambda r:r['before'] is None]:
            changed=copy.deepcopy(rows);target=next(r for r in changed if predicate(r))
            changed.remove(target)
            with self.assertRaises(ValueError):self.check(h,changed)
        self.assertFalse(h['acceptanceGranted'])


if __name__=='__main__':unittest.main()
