"""Actual issued Git objects; deliberately incomplete private pools, no old-commit fabrication."""
import gzip
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zlib

import hydrate_history

SOURCE = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(SOURCE / 'scripts/brain'))
import m1_profile, m102_profile, m103_profile  # real endpoint constants

ENV = dict(os.environ, GIT_NO_LAZY_FETCH='1')
HISTORY = 'scripts/phase9/security_acceptance/history.json.gz'


def git(repo, *args, **kwargs):
    return subprocess.check_output(['git', '-C', str(repo), *args], env=ENV,
                                   stderr=subprocess.PIPE, **kwargs)


class CloudHistory(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.storage = tempfile.TemporaryDirectory(prefix='sc03-real-history-')
        cls.base = Path(cls.storage.name)
        cls.rows = json.loads(gzip.decompress((SOURCE / HISTORY).read_bytes()))
        cls.head = git(SOURCE, 'rev-parse', 'HEAD').decode().strip()
        row = cls.rows[0]
        cls.missing = {row['source_blob'], row['commit'],
                       git(SOURCE, 'rev-parse', row['commit'] + '^{tree}').decode().strip()}
        objects = set(git(SOURCE, 'rev-list', '--objects', '--no-object-names', '--all').decode().splitlines())
        cls.pack = cls.base / 'incomplete.pack'
        with cls.pack.open('wb') as output:
            subprocess.run(['git', '-C', str(SOURCE), 'pack-objects', '--stdout'],
                           input=('\n'.join(sorted(objects - cls.missing)) + '\n').encode(),
                           stdout=output, env=ENV, check=True)

    @classmethod
    def tearDownClass(cls):
        cls.storage.cleanup()

    def setUp(self):
        self.private = tempfile.TemporaryDirectory(dir=self.base)
        self.addCleanup(self.private.cleanup)
        self.root = Path(self.private.name)
        self.repo = self.root / 'repo'
        self.repo.mkdir()
        git(self.repo, 'init', '-q', '-b', m103_profile.BRANCH)
        with self.pack.open('rb') as source:
            subprocess.run(['git', '-C', str(self.repo), 'index-pack', '--stdin'],
                           stdin=source, stdout=subprocess.DEVNULL, env=ENV, check=True)
        git(self.repo, 'update-ref', 'HEAD', self.head)
        target = self.repo / HISTORY
        target.parent.mkdir(parents=True)
        target.write_bytes((SOURCE / HISTORY).read_bytes())
        self.refs = git(self.repo, 'show-ref')
        self.output = self.root / 'complete.pack'
        self.receipt = self.root / 'receipt.json'

    def hydrate(self, **kwargs):
        hydrate_history.hydrate(self.repo, self.output, self.receipt, **kwargs)

    def test_acquires_missing_commit_tree_blob_before_witnesses_and_roundtrips(self):
        for oid in self.missing:
            with self.assertRaises(subprocess.CalledProcessError): git(self.repo, 'cat-file', '-t', oid)
        self.hydrate(object_source=SOURCE)
        value = json.loads(self.receipt.read_bytes())
        self.assertEqual(value['witnesses'], 3265)
        self.assertEqual(len(value['references']), 112)
        self.assertEqual({r['oid'] for r in value['acquired_objects']}, self.missing)
        for row in value['acquired_objects']:
            raw = git(SOURCE, 'cat-file', row['kind'], row['oid'])
            self.assertEqual(hashlib.sha256(raw).hexdigest(), row['sha256'])
            self.assertEqual(hashlib.sha1(row['kind'].encode()+b' '+str(len(raw)).encode()+b'\0'+raw).hexdigest(), row['oid'])
        fresh = self.root / 'fresh'
        fresh.mkdir(); git(fresh, 'init', '-q', '-b', m103_profile.BRANCH)
        # A real ref awaiting import, not a replacement commit or alternate.
        ref = fresh / '.git/refs/heads' / m103_profile.BRANCH
        ref.parent.mkdir(parents=True, exist_ok=True); ref.write_text(self.head+'\n')
        path = fresh / HISTORY; path.parent.mkdir(parents=True); path.write_bytes((SOURCE / HISTORY).read_bytes())
        imported = self.root / 'imported.json'
        hydrate_history.hydrate(fresh, self.output, imported, importing=True)
        after = json.loads(imported.read_bytes())
        self.assertEqual(value['references'], after['references'])
        self.assertEqual(value['endpoints'], after['endpoints'])
        self.assertFalse((fresh / '.git/objects/info/alternates').exists())
        self.assertFalse((self.repo / '.git/objects/info/alternates').exists())
        self.assertEqual(git(self.repo, 'show-ref'), self.refs)
        self.assertEqual(git(fresh, 'show-ref'), self.refs)

    def test_missing_history_without_explicit_source_refuses(self):
        with self.assertRaises(subprocess.CalledProcessError): self.hydrate()
        self.assertFalse(self.receipt.exists())

    def test_unavailable_source_refuses_without_receipt_or_ref_mutation(self):
        with self.assertRaises(subprocess.CalledProcessError): self.hydrate(object_source=self.root/'absent')
        self.assertFalse(self.receipt.exists())
        self.assertEqual(git(self.repo, 'show-ref'), self.refs)

    def test_wrong_sha256_refuses_after_real_acquisition(self):
        rows = [dict(r) for r in self.rows]
        for r in rows:
            if r['commit']==rows[0]['commit'] and r['path']==rows[0]['path']: r['source_sha256']='0'*64
        (self.repo/HISTORY).write_bytes(gzip.compress(json.dumps(rows).encode()))
        with self.assertRaisesRegex(AssertionError, 'SHA256 disagreement'): self.hydrate(object_source=SOURCE)
        self.assertFalse(self.receipt.exists())

    def test_wrong_blob_oid_refuses_after_real_acquisition(self):
        rows = [dict(r) for r in self.rows]
        for r in rows:
            if r['commit']==rows[0]['commit'] and r['path']==rows[0]['path']: r['source_blob']='0'*40
        (self.repo/HISTORY).write_bytes(gzip.compress(json.dumps(rows).encode()))
        with self.assertRaisesRegex(AssertionError, 'blob disagreement'): self.hydrate(object_source=SOURCE)

    def test_tree_instead_of_blob_witness_refuses(self):
        row = dict(self.rows[0], path='docs', source_blob=git(SOURCE,'rev-parse',self.rows[0]['commit']+':docs').decode().strip())
        (self.repo/HISTORY).write_bytes(gzip.compress(json.dumps([row]).encode()))
        with self.assertRaisesRegex(AssertionError, 'not a blob'): self.hydrate(object_source=SOURCE)

    def test_corrupt_source_object_cannot_be_rebound_to_requested_oid(self):
        source = self.root/'corrupt.git'
        source.mkdir(); git(source, 'init', '--bare', '-q')
        with self.pack.open('rb') as stream:
            subprocess.run(['git','-C',str(source),'index-pack','--stdin'],stdin=stream,
                           stdout=subprocess.DEVNULL,env=ENV,check=True)
        for missing in self.missing-{self.rows[0]['source_blob']}:
            kind=git(SOURCE,'cat-file','-t',missing).decode().strip()
            git(source,'hash-object','-w','-t',kind,'--stdin',input=git(SOURCE,'cat-file',kind,missing))
        oid=self.rows[0]['source_blob']; path=source/'objects'/oid[:2]/oid[2:]
        path.parent.mkdir(exist_ok=True); path.write_bytes(zlib.compress(b'blob 5\0wrong'))
        self.assertEqual(git(source,'cat-file','blob',oid),b'wrong')
        with self.assertRaises((AssertionError, subprocess.CalledProcessError)): self.hydrate(object_source=source)
        self.assertFalse(self.receipt.exists())

    def test_corrupt_pack_import_refuses(self):
        self.output.write_bytes(self.pack.read_bytes()[:-20]+b'X'*20)
        with self.assertRaises(subprocess.CalledProcessError): self.hydrate(importing=True)
        self.assertFalse(self.receipt.exists())


if __name__ == '__main__': unittest.main()
