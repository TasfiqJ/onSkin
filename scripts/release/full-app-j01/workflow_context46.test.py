"""Exact-byte, typed-substitution and filesystem refusal tests; no commands run."""
import importlib.util
import json
import os
import pathlib
import tempfile
import unittest
from unittest import mock

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('workflow_context46', HERE / 'workflow_context46.py')
w = importlib.util.module_from_spec(spec)
spec.loader.exec_module(w)
ROOT = HERE.parents[2]
HEAD = 'deafce53190f8437867a4c969cb85b0ec8e183d5'


class ContextTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='c46-context-unit-')
        self.addCleanup(self.temp.cleanup)
        self.parent = pathlib.Path(self.temp.name).resolve()
        self.root = self.parent / 'source'
        self.root.mkdir()
        self.source = self.root / w.WORKFLOW
        self.source.parent.mkdir(parents=True)
        self.original = (ROOT / w.WORKFLOW).read_bytes()
        self.source.write_bytes(self.original)
        (self.root / '.git').mkdir()
        (self.root / '.git/HEAD').write_text(HEAD + '\n', encoding='ascii')
        self.out = self.parent / 'context-output'

    def run_context(self, **kwargs):
        return w.materialize_context(self.root, self.out,
                                     kwargs.get('head', HEAD), kwargs.get('pr', 47))

    def test_complete_original_preserved_with_only_three_public_typed_substitutions(self):
        before = self.source.read_bytes()
        receipt = self.run_context()
        output = (self.out / 'candidate22-context.yml').read_bytes()
        self.assertEqual(receipt['sourceSHA256'], w.SOURCE_SHA256)
        self.assertEqual(len(receipt['substitutions']), 3)
        self.assertEqual([r['field'] for r in receipt['substitutions']], ['head', 'head', 'pr'])
        restored = output
        for row in reversed(receipt['substitutions']):
            self.assertEqual(restored[row['outputStart']:row['outputEnd']],
                             row['publicValue'].encode('ascii'))
            restored = (restored[:row['outputStart']] + row['sourceToken'].encode('ascii')
                        + restored[row['outputEnd']:])
        self.assertEqual(restored, before)
        for row in receipt['unchangedRanges']:
            raw = before[row['sourceStart']:row['sourceEnd']]
            self.assertEqual(w.digest(raw), row['sha256'])
            self.assertEqual(output[row['outputStart']:row['outputStart'] + len(raw)], raw)
        self.assertEqual(self.source.read_bytes(), before)
        self.assertIn(b'$' + b'{{ matrix.os }}', output)
        self.assertIn(b'$' + b'{{ !cancelled()', output)
        self.assertFalse(receipt['acceptanceGranted'])
        self.assertTrue(receipt['originalPartialParseWarningRetained'])
        self.assertEqual(json.loads((self.out / 'context-receipt.json').read_text()), receipt)

    def test_real_clone_head_and_entire_frozen_workflow_are_authenticated(self):
        with tempfile.TemporaryDirectory(prefix='c46-real-context-') as parent:
            receipt = w.materialize_context(ROOT, pathlib.Path(parent) / 'output',
                                            w.observed_head(ROOT), 47)
            self.assertEqual(receipt['sourceSHA256'], w.SOURCE_SHA256)

    def test_wrong_head_and_unsafe_head_refuse_before_output(self):
        for value in ['a' * 40, '0' * 40, HEAD.upper(), HEAD + ';whoami', '../head']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.run_context(head=value)
            self.assertFalse(self.out.exists())

    def test_wrong_pr_or_type_refuses_without_output(self):
        for value in [46, 48, '47', True]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.run_context(pr=value)
            self.assertFalse(self.out.exists())

    def test_changed_source_or_omitted_scope_refuses(self):
        for raw in [self.original + b'\n', self.original.split(b'jobs:')[0],
                    self.original.replace(w.TOKENS[0][0], b'OMITTED', 1)]:
            self.source.write_bytes(raw)
            with self.assertRaises(ValueError):
                self.run_context()
            self.assertFalse(self.out.exists())

    def test_missing_source_refuses(self):
        self.source.unlink()
        with self.assertRaises(OSError):
            self.run_context()
        self.assertFalse(self.out.exists())

    def test_hardlinked_source_refuses(self):
        link = self.parent / 'original-link'
        os.link(self.source, link)
        with self.assertRaises(ValueError):
            self.run_context()
        self.assertFalse(self.out.exists())

    def test_existing_output_or_output_in_source_refuses_without_overwrite(self):
        self.out.mkdir()
        sentinel = self.out / 'keep'
        sentinel.write_bytes(b'PRESERVE')
        with self.assertRaises(ValueError):
            self.run_context()
        self.assertEqual(sentinel.read_bytes(), b'PRESERVE')
        with self.assertRaises(ValueError):
            w.materialize_context(self.root, self.root / 'output', HEAD, 47)

    def test_changed_source_between_reads_refuses(self):
        original_read = w._read_regular
        mutated = False

        def racing_read(path, *args, **kwargs):
            nonlocal mutated
            raw = original_read(path, *args, **kwargs)
            if pathlib.Path(path) == self.source and not mutated:
                mutated = True
                self.source.write_bytes(raw + b'\n')
            return raw

        with mock.patch.object(w, '_read_regular', side_effect=racing_read):
            with self.assertRaisesRegex(ValueError, 'CONTEXT_INPUT_CHANGED'):
                self.run_context()
        self.assertFalse(self.out.exists())

    def test_branch_and_packed_ref_head_are_read_without_git_execution(self):
        (self.root / '.git/HEAD').write_text('ref: refs/heads/stage/test\n')
        refs = self.root / '.git/refs/heads/stage'
        refs.mkdir(parents=True)
        (refs / 'test').write_text(HEAD + '\n')
        self.assertEqual(w.observed_head(self.root), HEAD)
        (refs / 'test').unlink()
        (self.root / '.git/packed-refs').write_text('# pack-refs with: peeled\n' + HEAD + ' refs/heads/stage/test\n')
        self.assertEqual(w.observed_head(self.root), HEAD)
        (self.root / '.git/HEAD').write_text('ref: refs/heads/../../outside\n')
        with self.assertRaises(ValueError):
            w.observed_head(self.root)


if __name__ == '__main__':
    unittest.main(verbosity=2)

