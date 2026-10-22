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
from unittest import mock
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
        # Claims from the real working session are not executions in a disposable fixture.
        current = brain.load(self.root, 'docs/brain/current.json')
        current['observations'] = []
        self.save('docs/brain/current.json', current)

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
        common = Path(brain.git(brain.ROOT, 'rev-parse', '--path-format=absolute', '--git-common-dir')) / 'objects'
        alternate = self.root / '.git/objects/info/alternates'
        alternate.parent.mkdir(parents=True, exist_ok=True)
        alternate.write_bytes((common.as_posix() + '\n').encode('utf-8'))
        # Read actual immutable base objects, but create the fixture commit only in its own Git store.
        subprocess.run(['git', '-C', str(self.root), 'update-ref', 'HEAD', brain.REPAIR_BASE], check=True)
        subprocess.run(['git', '-C', str(self.root), 'add', '.'], check=True, capture_output=True)
        subprocess.run(['git', '-C', str(self.root), '-c', 'user.name=Synthetic Fixture',
                        '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Synthetic fixture only'], check=True)
        sha = brain.git(self.root, 'rev-parse', 'HEAD')
        tree = brain.git(self.root, 'rev-parse', 'HEAD^{tree}')
        snapshot = {'commit': sha, 'tree': tree}
        log = 'docs/brain/checkpoints/M0-02/synthetic.log'
        (self.root / log).parent.mkdir(parents=True, exist_ok=True)
        (self.root / log).write_bytes(b'SYNTHETIC TEST FIXTURE ONLY\n')
        receipt_path = 'docs/brain/checkpoints/M0-02/synthetic-execution.json'
        receipt = {'schema_version': 1, 'kind': 'LOCAL_EXECUTION', 'claim_origin': 'CODEX_REPORTED_EXECUTION',
                   'command': 'synthetic', 'working_directory': 'synthetic', 'environment': 'fixture',
                   'source_commit': sha, 'source_tree': tree, 'status': 'PASS', 'exit_code': 0,
                   'output': {'path': log, 'sha256': brain.digest((self.root / log).read_bytes())},
                   'counts': {'passed': 1, 'failed': 0, 'skipped': 0}}
        self.save(receipt_path, receipt)
        report = {'schema_version': 3, 'task_id': 'M0-02', 'branch': 'stage/m0-baseline',
                  'iteration': 'FIX-01', 'last_brain_verdict': 'FIX_REQUIRED',
                  'repair_base': {'commit': brain.REPAIR_BASE, 'tree': brain.git(self.root, 'rev-parse', brain.REPAIR_BASE + '^{tree}')},
                  'base_commit': brain.snapshot(self.root, 'TASK_MANIFEST.json')['base_commit'],
                  'original_stage_base': brain.ORIGINAL_BASE,
                  'observed_main': {'commit': brain.ORIGINAL_BASE, 'tree': brain.git(self.root, 'rev-parse', brain.ORIGINAL_BASE + '^{tree}')},
                  'implementation_snapshot': snapshot,
                  'delivery': {'ref': 'refs/heads/stage/m0-baseline', 'resolve_via': 'git ls-remote origin refs/heads/stage/m0-baseline',
                               'last_observed_pushed_snapshot': snapshot, 'status': 'PUSH_BLOCKED'},
                  'submission_status': 'SUBMITTED_REVIEW_REQUIRED', 'accepted_by_brain': False, 'admission': 'NONE',
                  'summary': 'Synthetic validator fixture, never a real approval.', 'decisions': ['Fixture only'],
                  'tests': [{'command': 'synthetic', 'working_directory': 'synthetic', 'environment': 'fixture',
                             'snapshot_commit': sha, 'snapshot_tree': tree, 'status': 'PASS', 'exit_code': 0,
                             'evidence_class': 'INDEPENDENTLY_REPRODUCED', 'axis': 'source', 'count': 1,
                             'artifact': receipt_path, 'limitations': 'Synthetic contract test'}],
                  'ci': [], 'evidence_artifacts': [{'path': n, 'sha256': brain.digest((self.root / n).read_bytes()), 'scope': 'synthetic'} for n in [log, receipt_path]],
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
        target = self.root / 'docs/brain/contracts/completion-report.v3.schema.json'
        target.write_bytes(target.read_bytes() + b' ')
        with self.assertRaisesRegex(ValueError, 'Implementation differs'):
            brain.validate_report(self.root, path)

    def cli(self, *args):
        return subprocess.run([sys.executable, '-B', str(brain.ROOT / 'scripts/brain/brain.py'),
                               '--root', str(self.root), *args], capture_output=True, text=True, encoding='utf-8')

    def test_f1_observation_cli_positive_and_bound_negative_cases(self):
        report = self.report_fixture()
        test = report['tests'][0]
        path = 'docs/brain/current.json'
        current = brain.load(self.root, path)
        execution = dict(test, id='SYNTHETIC-F1', source_commit=test['snapshot_commit'],
                         source_tree=test['snapshot_tree'], admission='NONE',
                         sha256=brain.digest(brain.read(self.root, test['artifact'])))
        current['observations'] = [execution]
        self.save(path, current)
        result = self.cli('validate')
        self.assertEqual(result.returncode, 0, result.stderr)
        variants = [({'id': 'A1', 'status': 'PASS', 'evidence_class': 'INDEPENDENTLY_REPRODUCED', 'axis': 'source',
                      'exit_code': 0, 'admission': 'NONE'}, 'Missing bound execution'),
                    (dict(execution, exit_code=False), 'exit must be an integer'),
                    (dict(execution, exit_code='0'), 'exit must be an integer'),
                    (dict(execution, sha256='0' * 64), 'receipt hash'),
                    (dict(execution, command='changed-command'), 'receipt binding'),
                    (dict(execution, source_tree='0' * 40), 'commit/tree mismatch'),
                    (dict(execution, exit_code=1), 'outcome/exit mismatch'),
                    (dict(execution, status='NOT_RUN'), 'Invalid execution classification')]
        for entry, reason in variants:
            self.save(path, dict(current, observations=[entry]))
            result = self.cli('validate')
            with self.subTest(reason=reason):
                self.assertEqual(result.returncode, 1, result.stdout)
                self.assertIn(reason, result.stderr)
        # A hash-matched receipt cannot disguise failed/skipped output or a boolean exit.
        self.save(path, current)
        receipt_path = execution['artifact']
        original = brain.load(self.root, receipt_path)
        for update, reason in [(dict(exit_code=False), 'receipt binding'),
                               (dict(counts={'passed': 0, 'failed': 0, 'skipped': 1}), 'cannot establish PASS'),
                               (dict(output={'path': original['output']['path'], 'sha256': '0' * 64}), 'output hash')]:
            self.save(receipt_path, dict(original, **update))
            entry = dict(execution, sha256=brain.digest(brain.read(self.root, receipt_path)))
            self.save(path, dict(current, observations=[entry]))
            result = self.cli('validate')
            with self.subTest(update=update):
                self.assertEqual(result.returncode, 1)
                self.assertIn(reason, result.stderr)

    def ci_fixture(self, report):
        row = {'head_commit': report['implementation_snapshot']['commit'], 'repository': 'TasfiqJ/onSkin',
               'name': 'SYNTHETIC CI ONLY', 'workflow_id': 123, 'run_id': 101, 'status': 'completed',
               'conclusion': 'failure', 'scope': 'SYNTHETIC OFFLINE CONSISTENCY, NOT PROVIDER AUTHENTICITY',
               'evidence_class': 'INDEPENDENTLY_OBSERVED', 'artifact': 'docs/brain/checkpoints/M0-02/synthetic-ci.json'}
        report['ci'] = [row]
        observation = {'schema_version': 1, 'kind': 'CI_OBSERVATION', 'claim_origin': 'CODEX_OBSERVED_PROVIDER_METADATA',
                       'repository': 'TasfiqJ/onSkin', 'evidence_class': 'INDEPENDENTLY_OBSERVED',
                       'recorded_at_utc': '2026-10-20T00:00:00Z', 'runs': [dict(row)]}
        self.save(row['artifact'], observation)
        report['evidence_artifacts'].append({'path': row['artifact'], 'sha256': brain.digest(brain.read(self.root, row['artifact'])), 'scope': 'synthetic'})
        return observation

    def test_f2_report_cli_ci_relationships_and_git_identities(self):
        report = self.report_fixture()
        observation = self.ci_fixture(report)
        path = 'docs/brain/checkpoints/M0-02/synthetic-v3.json'

        def run(value, record=None):
            if record is not None:
                self.save(report['ci'][0]['artifact'], record)
                for a in value['evidence_artifacts']:
                    if a['path'] == report['ci'][0]['artifact']:
                        a['sha256'] = brain.digest(brain.read(self.root, a['path']))
            self.save(path, value)
            return self.cli('report', path)

        result = run(copy.deepcopy(report), observation)
        self.assertEqual(result.returncode, 0, result.stderr)
        # Valid pending, skipped and cancelled observations remain available without green conclusions.
        for status, conclusion in [('in_progress', 'pending'), ('pending', 'pending'), ('completed', 'skipped'), ('completed', 'cancelled')]:
            value, record = copy.deepcopy(report), copy.deepcopy(observation)
            value['ci'][0].update(status=status, conclusion=conclusion)
            record['runs'][0].update(status=status, conclusion=conclusion)
            result = run(value, record)
            self.assertEqual(result.returncode, 0, result.stderr)
        for status, conclusion, reason in [('in_progress', 'success', 'Unfinished CI'), ('queued', 'failure', 'Unfinished CI'),
                                            ('completed', 'pending', 'Completed CI')]:
            value, record = copy.deepcopy(report), copy.deepcopy(observation)
            value['ci'][0].update(status=status, conclusion=conclusion)
            record['runs'][0].update(status=status, conclusion=conclusion)
            result = run(value, record)
            self.assertEqual(result.returncode, 1)
            self.assertIn(reason, result.stderr)
        for field, bad in [('head_commit', '0' * 40), ('run_id', 102), ('workflow_id', 124), ('name', 'different')]:
            value = copy.deepcopy(report)
            value['ci'][0][field] = bad
            result = run(value, observation)
            self.assertEqual(result.returncode, 1)
            self.assertTrue('binding mismatch' in result.stderr or 'Missing/duplicate CI' in result.stderr, result.stderr)
        value = copy.deepcopy(report)
        value['ci'][0]['artifact'] = 'nonexistent.json'
        result = run(value, observation)
        self.assertEqual(result.returncode, 1)
        self.assertIn('CI artifact is not declared', result.stderr)
        value = copy.deepcopy(report)
        result = run(value, {})
        self.assertEqual(result.returncode, 1)
        self.assertIn('Invalid structured CI observation', result.stderr)
        value, record = copy.deepcopy(report), copy.deepcopy(observation)
        value['ci'][0]['head_commit'] = record['runs'][0]['head_commit'] = '0' * 40
        result = run(value, record)
        self.assertEqual(result.returncode, 1)
        self.assertIn('Missing Git CI head', result.stderr)
        for key, bad, reason in [('observed_main', {'commit': '0' * 40, 'tree': '0' * 40}, 'Missing Git observed_main'),
                                 ('observed_main', dict(report['observed_main'], tree='0' * 40), 'commit/tree mismatch'),
                                 ('original_stage_base', '0' * 40, 'Declared original/task/repair'),
                                 ('base_commit', '0' * 40, 'Report task/base mismatch'),
                                 ('repair_base', dict(report['repair_base'], tree='0' * 40), 'commit/tree mismatch')]:
            value = copy.deepcopy(report)
            value[key] = bad
            result = run(value, observation)
            with self.subTest(key=key, bad=bad):
                self.assertEqual(result.returncode, 1)
                self.assertIn(reason, result.stderr)
        # A real existing commit with no parent is still not a valid measured stage descendant.
        tree = report['implementation_snapshot']['tree']
        unrelated = subprocess.check_output(['git', '-C', str(self.root), '-c', 'user.name=Synthetic Fixture',
                                             '-c', 'user.email=fixture@example.invalid', 'commit-tree', tree],
                                            input=b'Synthetic unrelated history\n').decode().strip()
        value = copy.deepcopy(report)
        value['implementation_snapshot'] = {'commit': unrelated, 'tree': tree}
        result = run(value, observation)
        self.assertEqual(result.returncode, 1)
        self.assertIn('Invalid ancestry: repair -> measured', result.stderr)
        value = copy.deepcopy(report)
        value['delivery']['last_observed_pushed_snapshot'] = report['repair_base']
        result = run(value, observation)
        self.assertEqual(result.returncode, 1)
        self.assertIn('Invalid ancestry: measured -> past pushed', result.stderr)
        value = copy.deepcopy(report)
        value['delivery']['last_observed_pushed_snapshot'] = {'commit': '0' * 40, 'tree': '0' * 40}
        result = run(value, observation)
        self.assertEqual(result.returncode, 1)
        self.assertIn('Missing Git Past pushed snapshot', result.stderr)

    def test_f3_pack_cli_cannot_repoint_its_own_issuance(self):
        output = Path(self.temp.name) / 'approved.zip'
        result = self.cli('pack', '--task', 'M0-02', '--output', str(output))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(brain.digest(output.read_bytes()), 'b73353d64eb93a28dafd8d319c06055440e4e0363243c12ae016b5f6291f5547')
        prefix = 'docs/brain/synthetic-unapproved'
        folder = self.root / prefix
        folder.mkdir(parents=True)
        data = b'SYNTHETIC UNAPPROVED CONTENT. Not a Brain-issued task.\n'
        (folder / 'UNAPPROVED.txt').write_bytes(data)
        issue = {'task_id': 'M0-02', 'issued_by': 'onSkin Brain', 'max_input_bytes': 8192, 'synthetic_fixture': True,
                 'files': [{'path': 'UNAPPROVED.txt', 'bytes': len(data), 'sha256': brain.digest(data)}]}
        raw = brain.encoded(issue)
        (folder / 'TASK_MANIFEST.json').write_bytes(raw)
        rows = issue['files'] + [{'path': 'TASK_MANIFEST.json', 'bytes': len(raw), 'sha256': brain.digest(raw)}]
        spec = brain.load(self.root, 'docs/brain/task-specs/M0-02.json')
        spec.update(input_prefix=prefix, approval={'path': prefix + '/TASK_MANIFEST.json', 'sha256': brain.digest(raw)},
                    max_input_bytes=8192, max_files=10,
                    files=[{'source': prefix + '/' + r['path'], 'archive': r['path'], 'bytes': r['bytes'],
                            'sha256': r['sha256'], 'code_reviewed': False} for r in rows])
        self.save('docs/brain/task-specs/M0-02.json', spec)
        output = Path(self.temp.name) / 'unapproved.zip'
        result = self.cli('pack', '--task', 'M0-02', '--output', str(output))
        self.assertEqual(result.returncode, 1)
        self.assertIn('Spec cannot repoint anchored issuance', result.stderr)
        self.assertFalse(output.exists())

    def test_f4_real_dangling_mirror_file_and_existing_symlink_no_side_effects(self):
        target = self.root / brain.GENERATED / 'compatibility.json'
        before = target.read_bytes()
        target.unlink()
        outside = Path(self.temp.name) / 'outside.json'
        try:
            target.symlink_to(outside)
        except OSError as exc:
            self.skipTest('Real symbolic links unavailable: ' + str(exc))
        result = self.cli('mirrors')
        self.assertEqual(result.returncode, 1)
        self.assertIn('Linked mirror/output', result.stderr)
        self.assertFalse(outside.exists())
        outside.write_bytes(before)
        result = self.cli('mirrors')
        self.assertEqual(result.returncode, 1)
        self.assertEqual(outside.read_bytes(), before)

    def test_f4_hardlinked_mirror_rejected_without_modification(self):
        target = self.root / brain.GENERATED / 'modules.csv'
        outside = Path(self.temp.name) / 'hardlink.json'
        os.link(target, outside)
        before = outside.read_bytes()
        earlier = self.root / brain.GENERATED / 'compatibility.json'
        earlier.write_bytes(b'Preserve earlier destination on a later unsafe target\n')
        result = self.cli('mirrors')
        self.assertEqual(result.returncode, 1)
        self.assertIn('hard-linked mirror', result.stderr)
        self.assertEqual(outside.read_bytes(), before)
        self.assertEqual(earlier.read_bytes(), b'Preserve earlier destination on a later unsafe target\n')

    @unittest.skipUnless(os.name == 'nt', 'Windows junction test only')
    def test_f4_dangling_and_existing_directory_junctions_do_not_create_targets(self):
        mirrors = self.root / brain.GENERATED
        backup = self.root / 'saved-mirrors'
        mirrors.rename(backup)
        outside = Path(self.temp.name) / 'outside-directory'
        result = subprocess.run(['cmd', '/c', 'mklink', '/J', str(mirrors), str(outside)], capture_output=True)
        if result.returncode:
            self.skipTest('Dangling junction creation unavailable')
        self.addCleanup(lambda: os.rmdir(mirrors) if mirrors.lstat().st_file_attributes & 0x400 else None)
        result = self.cli('mirrors')
        self.assertEqual(result.returncode, 1)
        self.assertIn('Linked mirror/output', result.stderr)
        self.assertFalse(outside.exists())
        outside.mkdir()
        sentinel = outside / 'sentinel.txt'
        sentinel.write_bytes(b'unchanged')
        result = self.cli('mirrors')
        self.assertEqual(result.returncode, 1)
        self.assertEqual(list(outside.iterdir()), [sentinel])
        self.assertEqual(sentinel.read_bytes(), b'unchanged')


class SyntheticPackaging(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='onskin-synthetic-issue-')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base / 'source'
        self.files = {'TASK.md': b'SYNTHETIC TEST ONLY. No real task approval.\n',
                      'sample.ts': b'// Synthetic reviewed text code\nexport const example = 1;\n'}
        # Test-only fixed-code authority injection. The production CLI never loads this from a spec.
        patch = mock.patch.dict(brain.ISSUANCES, {}, clear=True)
        patch.start()
        self.addCleanup(patch.stop)
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
        brain.ISSUANCES['TEST-01'] = {'path': 'inputs/TASK_MANIFEST.json', 'sha256': brain.digest(raw), 'input_prefix': 'inputs'}
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
        with self.assertRaisesRegex(ValueError, 'anchored task issuance'):
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

    def test_allowlist_and_bound_booleans_cannot_stand_in_for_integers(self):
        self.issue({'a.txt': b'a'})
        self.spec(lambda d: d['files'][0].update(bytes=True))
        with self.assertRaisesRegex(ValueError, 'Invalid allowlist field types'):
            brain.package_data(self.root, 'TEST-01')
        self.issue({'a.txt': b'a'})
        self.spec(lambda d: d['files'][0].update(code_reviewed=0))
        with self.assertRaisesRegex(ValueError, 'Invalid allowlist field types'):
            brain.package_data(self.root, 'TEST-01')
        self.issue({'a.txt': b'a'})
        self.spec(lambda d: d.update(max_files=True))
        with self.assertRaisesRegex(ValueError, 'Context bounds must be integers'):
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
    def test_git_reads_disable_lazy_fetch_and_fsmonitor(self):
        with mock.patch.dict(os.environ, {'GIT_NO_LAZY_FETCH': '0'}), mock.patch.object(brain.subprocess, 'check_output', return_value='commit\n') as call:
            self.assertEqual(brain.git(brain.ROOT, 'cat-file', '-t', brain.REPAIR_BASE), 'commit')
            self.assertEqual(call.call_args.kwargs['env']['GIT_NO_LAZY_FETCH'], '1')
            self.assertIn('core.fsmonitor=false', call.call_args.args[0])
        with mock.patch.object(brain.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0)) as call:
            brain.ancestor(brain.ROOT, brain.TASK_BASE, brain.REPAIR_BASE, 'synthetic')
            self.assertEqual(call.call_args.kwargs['env']['GIT_NO_LAZY_FETCH'], '1')

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
        schema = brain.load(brain.ROOT, 'docs/brain/contracts/completion-report.v3.schema.json')
        with self.assertRaises(ValueError):
            brain.schema_check({'head_commit': 'a' * 40, 'head_tree': 'b' * 40}, schema)
        with self.assertRaises(ValueError):
            brain.schema_check(True, schema['properties']['accepted_by_brain'])
        with self.assertRaises(ValueError):
            brain.schema_check('PASS', schema['properties']['submission_status'])


if __name__ == '__main__':
    unittest.main()
