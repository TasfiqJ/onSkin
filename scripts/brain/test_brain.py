"""Positive/adversarial control-plane tests; every invented issue record is temporary/synthetic."""
import copy
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile

import brain


class InstalledControls(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='onskin-brain-tests-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'repo'
        for folder in ['docs/v2', 'docs/brain', 'docs/hugeToDo']:
            # Only governance inputs, selected source documents, and sanitized evidence; no runtime tree.
            src = brain.ROOT / folder
            if folder == 'docs/hugeToDo':
                for row in json.loads((brain.ROOT / 'docs/v2/mirrors/source-reconciliation.json').read_text(encoding='utf-8'))['sources']:
                    p = brain.ROOT / row['path']
                    dest = self.root / row['path']
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(p, dest)
                continue
            shutil.copytree(src, self.root / folder)

    def save(self, name, data):
        (self.root / name).write_bytes(brain.encoded(data))

    def test_installed_positive_and_nonwriting_check(self):
        brain.verify_inputs(self.root)
        brain.validate_state(self.root)
        before = {p.name: p.read_bytes() for p in (self.root / brain.GENERATED).iterdir()}
        brain.mirrors(self.root)
        self.assertEqual(before, {p.name: p.read_bytes() for p in (self.root / brain.GENERATED).iterdir()})

    def test_preserves_every_supplied_field_and_original_field(self):
        data = brain.generated_views(self.root)
        view = brain.decode(data['compatibility.json'])
        self.assertEqual([len(view[k]) for k in ['features', 'legacy_dispositions', 'active_gates', 'v1_v2_features']], [408, 202, 25, 38])
        self.assertEqual(sum(x['supplied_row']['source_collection'] == 'items' for x in view['features']), 376)
        for entry in view['features'] + view['legacy_dispositions']:
            for key, value in entry['observed_repository_row'].items():
                self.assertEqual(entry['supplied_row'][key], value)
        self.assertTrue(all(e['exact_v2_task'] is None for e in view['features']))
        modules = brain.decode(data['modules.json'])['modules']
        self.assertTrue(all(m['publication_admitted'] is False for m in modules))
        self.assertEqual(modules[0]['engineering_start_phase'], 'P3')

    def test_missing_duplicate_substitution_and_extra_id(self):
        good = [{'id': 'a'}, {'id': 'b'}]
        brain.identities(good, ['a', 'b'])
        for rows in [[{'id': 'a'}, {'id': 'a'}], [{'id': 'a'}], good + [{'id': 'c'}]]:
            with self.subTest(rows=rows), self.assertRaises(ValueError):
                brain.identities(rows, ['a', 'b'])

    def test_unknown_parent_cycles_and_order(self):
        for rows in [[{'id': 'a', 'depends_on': ['a']}],
                     [{'id': 'a', 'depends_on': ['b']}, {'id': 'b', 'depends_on': ['a']}],
                     [{'id': 'a', 'depends_on': ['missing']}]]:
            with self.subTest(rows=rows), self.assertRaises(ValueError):
                brain.graph(rows)
        with self.assertRaises(ValueError):
            brain.identities([{'id': 'b'}, {'id': 'a'}], ['a', 'b'], ordered=True)

    def test_snapshot_hash_and_manifest_anchor(self):
        p = self.root / brain.INPUT / 'source_pack/04_Clinical/module_registry.json'
        p.write_bytes(p.read_bytes() + b' ')
        with self.assertRaisesRegex(ValueError, 'Input hash'):
            brain.verify_inputs(self.root)
        manifest = self.root / brain.INPUT / 'TASK_MANIFEST.json'
        manifest.write_bytes(manifest.read_bytes() + b' ')
        with self.assertRaisesRegex(ValueError, 'manifest hash'):
            brain.verify_inputs(self.root)

    def test_approved_state_and_audit_are_immutable(self):
        for name in ['docs/brain/state/brain_state.json', 'docs/brain/checkpoints/M0-01/BRAIN_AUDIT_M0-01.md']:
            p = self.root / name
            original = p.read_bytes()
            p.write_bytes(original + b'\n')
            with self.subTest(name=name), self.assertRaises(ValueError):
                brain.verify_inputs(self.root)
            p.write_bytes(original)

    def test_generated_false_gate_upgrade_and_mirror_drift(self):
        p = self.root / brain.GENERATED / 'compatibility.json'
        data = brain.decode(p.read_bytes())
        data['active_gates'][0]['supplied_status']['status'] = 'complete'
        p.write_bytes(brain.encoded(data))
        with self.assertRaisesRegex(ValueError, 'mirror'):
            brain.mirrors(self.root)
        brain.mirrors(self.root, check=False)
        p = self.root / brain.GENERATED / 'modules.csv'
        p.write_bytes(p.read_bytes().replace(b'False', b'True', 1))
        with self.assertRaisesRegex(ValueError, 'mirror'):
            brain.mirrors(self.root)

    def test_closed_axes_admissions_scope_and_skipped_pass(self):
        original = brain.load(self.root, 'docs/brain/current.json')
        changes = [dict(protected_source_go=True), dict(incremental_spend_usd=1),
                   dict(accepted_tasks=['M0-01', 'M0-02']), dict(submission_status='ACCEPTED'),
                   dict(next_task='M1-01'), dict(active_writers=2), dict(open_blocker_ids=[]),
                   dict(research_requests=['J05']), dict(proposal_expires_utc='2026-10-22T00:00:00Z')]
        changed_axes = copy.deepcopy(original['axes'])
        changed_axes['public_release'] = 'PASS'
        changes += [dict(axes=changed_axes), dict(observations=[{'id': 'bad', 'evidence_class': 'SOURCE_REPORTED',
                      'axis': 'source', 'status': 'PASS', 'exit_code': None, 'admission': 'NONE'}])]
        for change in changes:
            self.save('docs/brain/current.json', dict(original, **change))
            with self.subTest(change=change), self.assertRaises(ValueError):
                brain.validate_state(self.root)

    def test_live_closed_launch_contract_cannot_upgrade(self):
        name = 'docs/hugeToDo/launch-contract.json'
        data = brain.load(self.root, name)
        data['trendInsightAdmission']['trendInsightAdmitted'] = True
        self.save(name, data)
        with self.assertRaisesRegex(ValueError, 'launch contract'):
            brain.validate_state(self.root)

    def test_duplicate_json_keys_and_csv_identity_substitution(self):
        with self.assertRaises(ValueError):
            brain.decode(b'{"id":"a","id":"b"}')
        with self.assertRaises(ValueError):
            brain.rows_csv(b'id,id\na,b\n')
        with self.assertRaises(ValueError):
            brain.rows_csv(b'id,status\na\n')

    def test_selection_does_not_issue_followup(self):
        result = brain.ready(self.root)
        self.assertEqual(result['active_task'], 'M0-02')
        self.assertIsNone(result['next_issued_task'])
        self.assertFalse(result['automatic_issue'])
        self.assertTrue(all(not c['authorized_to_execute'] for c in result['candidates'] if c['id'] != 'M0-02'))

    def test_unknown_task_cli_nonzero(self):
        result = subprocess.run([sys.executable, '-B', str(brain.ROOT / 'scripts/brain/brain.py'), '--root', str(self.root),
                                 'pack', '--task', 'M1-01', '--output', str(Path(self.temp.name) / 'unknown.zip')], capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b'REJECTED', result.stderr)
        self.assertFalse((Path(self.temp.name) / 'unknown.zip').exists())

    def report_fixture(self):
        subprocess.run(['git', 'init', '-q', str(self.root)], check=True)
        subprocess.run(['git', '-C', str(self.root), 'add', '.'], check=True, capture_output=True)
        subprocess.run(['git', '-C', str(self.root), '-c', 'user.name=Synthetic Fixture',
                        '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Synthetic fixture only'], check=True)
        sha = brain.git(self.root, 'rev-parse', 'HEAD')
        tree = brain.git(self.root, 'rev-parse', 'HEAD^{tree}')
        snapshot = {'commit': sha, 'tree': tree}
        log = 'docs/brain/checkpoints/M0-02/synthetic.log'
        (self.root / log).parent.mkdir(parents=True, exist_ok=True)
        (self.root / log).write_bytes(b'SYNTHETIC TEST FIXTURE ONLY\n')
        report = {'schema_version': 2, 'task_id': 'M0-02', 'branch': 'stage/m0-baseline',
                  'base_commit': brain.snapshot(self.root, 'TASK_MANIFEST.json')['base_commit'],
                  'original_stage_base': 'b' * 40, 'observed_main': snapshot, 'implementation_snapshot': snapshot,
                  'delivery': {'ref': 'refs/heads/stage/m0-baseline', 'resolve_via': 'git ls-remote origin refs/heads/stage/m0-baseline',
                               'last_observed_pushed_snapshot': snapshot, 'status': 'PUSH_BLOCKED'},
                  'submission_status': 'SUBMITTED_REVIEW_REQUIRED', 'accepted_by_brain': False, 'admission': 'NONE',
                  'summary': 'Synthetic validator fixture, never a real approval.', 'decisions': ['Fixture only'],
                  'tests': [{'command': 'synthetic', 'working_directory': 'synthetic', 'environment': 'fixture',
                             'snapshot_commit': sha, 'snapshot_tree': tree, 'status': 'PASS', 'exit_code': 0,
                             'evidence_class': 'INDEPENDENTLY_REPRODUCED', 'axis': 'source', 'count': 1,
                             'artifact': log, 'limitations': 'Synthetic contract test'}],
                  'ci': [], 'evidence_artifacts': [{'path': log, 'sha256': brain.digest((self.root / log).read_bytes()), 'scope': 'synthetic'}],
                  'blockers': ['Synthetic only'], 'rollback': 'Disposable test fixture',
                  'context_health': {'estimate': 'unknown', 'compaction_observed': False, 'accepted_tasks_in_instance': 0,
                                     'handoff_needed': False, 'notes': 'Fixture only'}, 'handoff_file': 'ONSKIN_BRAIN_HANDOFF.txt'}
        return report

    def test_report_positive_schema_hash_git_binding_and_adversarial_payloads(self):
        report = self.report_fixture()
        path = 'docs/brain/checkpoints/M0-02/synthetic-report.json'
        self.save(path, report)
        brain.validate_report(self.root, path)
        for key, value in [('exit_code', None), ('snapshot_tree', '0' * 40), ('artifact', 'missing.log'),
                           ('evidence_class', 'SOURCE_REPORTED')]:
            changed = copy.deepcopy(report)
            changed['tests'][0][key] = value
            self.save(path, changed)
            with self.subTest(key=key), self.assertRaises(ValueError):
                brain.validate_report(self.root, path)
        changed = copy.deepcopy(report)
        changed['evidence_artifacts'][0]['sha256'] = '0' * 64
        self.save(path, changed)
        with self.assertRaisesRegex(ValueError, 'artifact hash'):
            brain.validate_report(self.root, path)
        self.save(path, report)
        target = self.root / 'docs/brain/contracts/completion-report.v2.schema.json'
        target.write_bytes(target.read_bytes() + b' ')
        with self.assertRaisesRegex(ValueError, 'Implementation differs'):
            brain.validate_report(self.root, path)


class SyntheticPackaging(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='onskin-synthetic-issue-')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base / 'source'
        self.files = {'TASK.md': b'SYNTHETIC TEST ONLY. No real task approval.\n',
                      'sample.ts': b'// Synthetic reviewed text code\nexport const example = 1;\n'}
        self.issue()

    def issue(self, files=None):
        if files is not None:
            self.files = files
        self.root.mkdir(parents=True, exist_ok=True)
        records = []
        for name, data in self.files.items():
            target = self.root / 'inputs' / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            records.append({'path': name, 'bytes': len(data), 'sha256': brain.digest(data), 'code_reviewed': Path(name).suffix == '.ts'})
        issue = {'task_id': 'TEST-01', 'issued_by': 'onSkin Brain', 'files': records, 'max_input_bytes': 8192,
                 'synthetic_fixture': True}
        raw = brain.encoded(issue)
        target = self.root / 'inputs/TASK_MANIFEST.json'
        target.write_bytes(raw)
        records += [{'path': 'TASK_MANIFEST.json', 'bytes': len(raw), 'sha256': brain.digest(raw)}]
        spec = {'task_id': 'TEST-01', 'issued': True, 'issued_by': 'onSkin Brain', 'input_prefix': 'inputs',
                'approval': {'path': 'inputs/TASK_MANIFEST.json', 'sha256': brain.digest(raw)},
                'max_input_bytes': 8192, 'max_files': 10,
                'files': [{'source': 'inputs/' + r['path'], 'archive': r['path'], 'bytes': r['bytes'], 'sha256': r['sha256'],
                           'code_reviewed': r.get('code_reviewed', False)} for r in records]}
        for name, data in [('docs/brain/task-specs/TEST-01.json', spec),
                           ('docs/brain/current.json', {'task_id': 'TEST-01', 'active_writers': 1, 'next_task': None})]:
            p = self.root / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(brain.encoded(data))
        return spec

    def spec(self, change):
        name = self.root / 'docs/brain/task-specs/TEST-01.json'
        data = brain.decode(name.read_bytes())
        change(data)
        name.write_bytes(brain.encoded(data))

    def test_positive_roundtrip_determinism_crc_all_hashes(self):
        a, b = self.base / 'a.zip', self.base / 'b.zip'
        first = brain.build_pack(self.root, 'TEST-01', a)
        second = brain.build_pack(self.root, 'TEST-01', b)
        self.assertEqual(first, second)
        self.assertEqual(a.read_bytes(), b.read_bytes())
        self.assertEqual(brain.verify_pack(self.root, 'TEST-01', a), first)
        with zipfile.ZipFile(a) as z:
            self.assertIsNone(z.testzip())
            manifest = brain.decode(z.read('CONTEXT_MANIFEST.json'))
            for row in manifest['files']:
                self.assertEqual(brain.digest(z.read(row['path'])), row['sha256'])

    def test_traversal_absolute_drive_unc_ads_alias_and_backslash(self):
        for name in ['../escape.md', '/escape.md', 'C:/escape.md', 'C:escape.md', '//server/share.md',
                     '\\\\server\\share.md', 'a\\b.md', 'a/../b.md', './a.md', 'a//b.md', 'a.md:stream',
                     'CON.txt', 'x/NUL.md', 'a./x.md', 'a /x.md', 'a\x00.md']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                brain.relative_name(name)

    def test_unissued_unknown_and_writer_conflict(self):
        self.spec(lambda d: d.update(issued=False))
        with self.assertRaises(ValueError):
            brain.package_data(self.root, 'TEST-01')
        self.issue()
        (self.root / 'docs/brain/current.json').write_bytes(brain.encoded({'task_id': 'OTHER-01', 'active_writers': 1, 'next_task': None}))
        with self.assertRaises(ValueError):
            brain.package_data(self.root, 'TEST-01')
        with self.assertRaises(OSError):
            brain.package_data(self.root, 'UNKNOWN-01')

    def test_hash_length_approval_and_allowlist_tampering(self):
        target = self.root / 'inputs/TASK.md'
        target.write_bytes(target.read_bytes().replace(b'TEST', b'FAIL'))
        with self.assertRaises(ValueError):
            brain.package_data(self.root, 'TEST-01')
        self.issue()
        self.spec(lambda d: d['approval'].update(sha256='0' * 64))
        with self.assertRaises(ValueError):
            brain.package_data(self.root, 'TEST-01')
        self.issue()
        self.spec(lambda d: d['files'].append(d['files'][0]))
        with self.assertRaises(ValueError):
            brain.package_data(self.root, 'TEST-01')

    def test_case_collision_reserved_manifest_and_duplicate_paths(self):
        for files in [{'a.md': b'a', 'A.md': b'b'}, {'CONTEXT_MANIFEST.json': b'{}'}, {'a.md': b'a', 'a.md/child.txt': b'b'}]:
            # The final file/directory conflict is itself rejected by the filesystem.
            try:
                self.issue(files)
                with self.assertRaises(ValueError):
                    brain.package_data(self.root, 'TEST-01')
            except (FileExistsError, NotADirectoryError):
                pass

    def test_private_binary_archives_nontext_and_secret_material(self):
        for name, data in [('private/report.md', b'x'), ('patient-report.txt', b'x'), ('source_research/a.md', b'x'),
                           ('history/a.md', b'x'), ('photos.txt', b'x'), ('.env.production', b'x'),
                           ('a.zip', b'PK\x03\x04'), ('a.md', b'%PDF-1.4'), ('a.txt', b'\x00binary'),
                           ('a.csv', b'\xff\xfe'), ('credentials.json', b'{}'),
                           ('a.md', b'-----BEGIN PRIVATE KEY-----\nSYNTHETIC\n')]:
            self.issue({name: data})
            with self.subTest(name=name, data=data), self.assertRaises((ValueError, UnicodeError)):
                brain.package_data(self.root, 'TEST-01')

    def test_code_requires_explicit_issue_review(self):
        with self.assertRaises(ValueError):
            brain.allowed_text('a.ts', b'export const a = 1;', False)
        brain.allowed_text('a.ts', b'export const a = 1;', True)

    def test_total_context_and_file_bounds(self):
        self.spec(lambda d: d.update(max_input_bytes=1))
        with self.assertRaises(ValueError):
            brain.package_data(self.root, 'TEST-01')
        self.issue()
        self.spec(lambda d: d.update(max_files=1))
        with self.assertRaises(ValueError):
            brain.package_data(self.root, 'TEST-01')
        self.issue({'a.txt': b'a' * (brain.HARD_BYTES + 1)})
        with self.assertRaises(ValueError):
            brain.package_data(self.root, 'TEST-01')

    def test_output_inside_input_and_overwrite_rejected(self):
        with self.assertRaises(ValueError):
            brain.build_pack(self.root, 'TEST-01', self.root / 'out.zip')
        output = self.base / 'existing.zip'
        output.write_bytes(b'preserve this')
        with self.assertRaises(ValueError):
            brain.build_pack(self.root, 'TEST-01', output)
        self.assertEqual(output.read_bytes(), b'preserve this')

    def test_crc_corruption_and_trailing_bytes_rejected(self):
        output = self.base / 'a.zip'
        brain.build_pack(self.root, 'TEST-01', output)
        original = output.read_bytes()
        corrupted = bytearray(original)
        location = original.index(self.files['TASK.md'])
        corrupted[location] ^= 1
        output.write_bytes(corrupted)
        with self.assertRaises((ValueError, zipfile.BadZipFile)):
            brain.verify_pack(self.root, 'TEST-01', output)
        output.write_bytes(original + b'trailing')
        with self.assertRaises(ValueError):
            brain.verify_pack(self.root, 'TEST-01', output)

    def test_symlink_escape_and_inside_link_rejected(self):
        target = self.root / 'inputs/TASK.md'
        target.unlink()
        outside = self.base / 'outside.md'
        outside.write_bytes(self.files['TASK.md'])
        try:
            target.symlink_to(outside)
        except OSError as exc:
            self.skipTest('Symlink creation unavailable: ' + str(exc))
        with self.assertRaisesRegex(ValueError, 'Link/reparse'):
            brain.package_data(self.root, 'TEST-01')
        target.unlink()
        target.symlink_to(self.root / 'inputs/sample.ts')
        with self.assertRaisesRegex(ValueError, 'Link/reparse'):
            brain.package_data(self.root, 'TEST-01')

    @unittest.skipUnless(os.name == 'nt', 'Windows junction test only')
    def test_windows_junction_input_and_output_rejected(self):
        outside = self.base / 'junction-target'
        shutil.copytree(self.root / 'inputs', outside)
        original = self.root / 'inputs'
        shutil.rmtree(original)
        result = subprocess.run(['cmd', '/c', 'mklink', '/J', str(original), str(outside)], capture_output=True)
        if result.returncode:
            self.skipTest('Junction creation unavailable: ' + result.stderr.decode(errors='replace'))
        self.addCleanup(lambda: os.rmdir(original) if original.exists() and original.lstat().st_file_attributes & 0x400 else None)
        with self.assertRaisesRegex(ValueError, 'Link/reparse'):
            brain.package_data(self.root, 'TEST-01')
        os.rmdir(original)
        shutil.copytree(outside, original)
        link = self.base / 'output-link'
        result = subprocess.run(['cmd', '/c', 'mklink', '/J', str(link), str(outside)], capture_output=True)
        self.assertEqual(result.returncode, 0)
        self.addCleanup(lambda: os.rmdir(link) if link.exists() else None)
        with self.assertRaisesRegex(ValueError, 'Linked'):
            brain.build_pack(self.root, 'TEST-01', link / 'pack.zip')
        self.assertFalse((outside / 'pack.zip').exists())

    def test_hardlink_rejected(self):
        original = self.root / 'inputs/TASK.md'
        try:
            os.link(original, self.base / 'alias.md')
        except OSError as exc:
            self.skipTest('Hard links unavailable: ' + str(exc))
        with self.assertRaisesRegex(ValueError, 'Hard-linked'):
            brain.package_data(self.root, 'TEST-01')


class ReportContracts(unittest.TestCase):
    def test_schema_types_required_extra_unsupported_and_bounds(self):
        schema = {'type': 'object', 'additionalProperties': False, 'required': ['exit'],
                  'properties': {'exit': {'type': ['integer', 'null'], 'minimum': 0}}}
        brain.schema_check({'exit': 0}, schema)
        brain.schema_check({'exit': None}, schema)
        for value in [{}, {'exit': True}, {'exit': -1}, {'exit': '0'}, {'exit': 0, 'extra': True}]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                brain.schema_check(value, schema)
        with self.assertRaises(ValueError):
            brain.schema_check({}, {'allOf': []})

    def test_versioned_report_rejects_legacy_shape_and_self_acceptance(self):
        schema = brain.load(brain.ROOT, 'docs/brain/contracts/completion-report.v2.schema.json')
        with self.assertRaises(ValueError):
            brain.schema_check({'head_commit': 'a' * 40, 'head_tree': 'b' * 40}, schema)
        with self.assertRaises(ValueError):
            brain.schema_check(True, schema['properties']['accepted_by_brain'])
        with self.assertRaises(ValueError):
            brain.schema_check('PASS', schema['properties']['submission_status'])


if __name__ == '__main__':
    unittest.main()
