"""Adversarial C47 scope/phase checks; existing C46 source controls remain separate."""
import copy
import hashlib
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('source_completion47', Path(__file__).with_name('source_completion47.py'))
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)


class Source47Tests(unittest.TestCase):
    def test_continuation02_scope_is_exact_and_historical_swift_stays_protected(self):
        repair = {'scripts/phase5/expo-widgets-57.0.26/AppIntent.swift',
                  'scripts/phase5/expo-widgets-57.0.26/LayerwellWidgetLifecycleStore.swift',
                  'scripts/phase5/patch-expo-widgets-lifecycle.mjs',
                  'scripts/release/full-app-j01/swift_behavior47.py'}
        c.check_scope(repair, c.PATHS)
        for path in ['scripts/phase5/expo-widgets-57.0.9/AppIntent.swift',
                     'scripts/phase5/expo-widgets-56.0.23/LayerwellWidgetLifecycleStore.swift',
                     'scripts/phase9/ios-privacy-lock-succession46.mjs',
                     'docs/phase-9/ios-sdk-lock-succession46.v1.json']:
            with self.subTest(path=path), self.assertRaisesRegex(ValueError, 'UNDECLARED_CHANGED_PATH'):
                c.check_scope({path}, c.PATHS | {path})

    def ledger(self):
        raw = b'accepted original progress bytes'
        value = {'schema': 1, 'campaign': 47, 'authorization': c.AUTH, 'base': c.BASE,
                 'base_tree': c.TREE, 'first_plan_commit': c.PLAN_COMMIT,
                 'frozen_plan_sha256': c.PLAN_SHA256, 'inventory_state': 'FROZEN',
                 'paths': [{'path': path, 'preimage_state': 'PRESENT' if path == 'PROGRESS.md' else 'ABSENT',
                            'preimage_sha256': c.sha(raw) if path == 'PROGRESS.md' else None,
                            'preimage_bytes': len(raw) if path == 'PROGRESS.md' else None,
                            'causal_need': 'A specific reason', 'invariant': 'A specific invariant',
                            'validation': 'A concrete check'} for path in sorted(c.PATHS)]}
        return value, lambda path: raw if path == 'PROGRESS.md' else None

    def test_original_verifier_primitives_are_reused_and_historical_paths_protected(self):
        self.assertEqual(c.accepted.verify_tracked_source.__name__, 'verify_tracked_source')
        self.assertEqual(c.accepted.check_git_metadata.__name__, 'check_git_metadata')
        for path in ['scripts/release/full-app-j01/source_completion46.py',
                     'scripts/release/full-app-j01/source_completion46.test.py',
                     '.github/workflows/security.yml', '.github/workflows/security-candidate22.yml',
                     'package.json', 'package-lock.json', 'apps/mobile/package.json',
                     'apps/mobile/src/lib/storage/privateKV.ts']:
            with self.subTest(path=path), self.assertRaisesRegex(ValueError, 'UNDECLARED_CHANGED_PATH'):
                c.check_scope({path}, c.PATHS | {path})

    def test_every_current_declared_preimage_and_absence_is_checked(self):
        ledger, preimage = self.ledger()
        self.assertEqual(c.check_ledger(ledger, preimage, c.PATHS, 'SOURCE_FROZEN'), c.PATHS)
        for key, bad in [('preimage_sha256', '0' * 64), ('preimage_bytes', 1), ('preimage_state', 'ABSENT')]:
            changed = copy.deepcopy(ledger)
            next(row for row in changed['paths'] if row['path'] == 'PROGRESS.md')[key] = bad
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, 'PREIMAGE'):
                c.check_ledger(changed, preimage, c.PATHS, 'SOURCE_FROZEN')
        with self.assertRaisesRegex(ValueError, 'PREIMAGE'):
            c.check_ledger(ledger, lambda path: b'unexpected existing file', c.PATHS, 'SOURCE_FROZEN')

    def test_ledger_cannot_self_authorize_path_omission_duplicate_or_wildcard(self):
        ledger, preimage = self.ledger()
        for mutate in [lambda value: value['paths'].pop(),
                       lambda value: value['paths'].append(copy.deepcopy(value['paths'][0])),
                       lambda value: value['paths'][0].update(path='scripts/**')]:
            changed = copy.deepcopy(ledger)
            mutate(changed)
            with self.assertRaises(ValueError):
                c.check_ledger(changed, preimage, c.PATHS, 'SOURCE_FROZEN')

    def test_frozen_phase_requires_frozen_inventory_and_exact_two_file_seal(self):
        ledger, preimage = self.ledger()
        ledger['inventory_state'] = 'EXPLICIT_PREDECLARED_NOT_FINAL_FROZEN'
        c.check_ledger(ledger, preimage, c.PATHS, 'SOURCE_PENDING')
        with self.assertRaisesRegex(ValueError, 'INVENTORY_NOT_FROZEN'):
            c.check_ledger(ledger, preimage, c.PATHS, 'SOURCE_FROZEN')
        c.check_phase('SOURCE_FROZEN', c.WORKLISTS)
        c.check_phase('SOURCE_PENDING', {'PROGRESS.md'})
        for delta in [set(), {'PROGRESS.md'}, c.WORKLISTS | {'PROGRESS.md'}, {next(iter(c.WORKLISTS))}]:
            with self.assertRaisesRegex(ValueError, 'LAST_SEAL_ONLY'):
                c.check_phase('SOURCE_FROZEN', delta)
        with self.assertRaisesRegex(ValueError, 'PHASE'):
            c.check_phase('ADMITTED', c.WORKLISTS)

    def test_plan_identity_and_original_bytes_cannot_be_replaced(self):
        plan_path = c.ROOT / c.PLAN
        if not plan_path.is_file():
            plan_path = Path(__file__).parent.parents[1] / 'onSkin' / c.PLAN
        original = plan_path.read_bytes()
        c.check_plan(c.PLAN_COMMIT, {c.PLAN}, original, original)
        for args in [('0' * 40, {c.PLAN}, original, original),
                     (c.PLAN_COMMIT, {c.PLAN, 'PROGRESS.md'}, original, original),
                     (c.PLAN_COMMIT, {c.PLAN}, b'changed plan', b'changed plan'),
                     (c.PLAN_COMMIT, {c.PLAN}, original, original + b'changed')]:
            with self.assertRaises(ValueError):
                c.check_plan(*args)

    def test_ledger_requires_campaign_authority_plan_pin_and_nonempty_provenance(self):
        ledger, preimage = self.ledger()
        for key, bad in [('schema', True), ('campaign', 46), ('authorization', 'self-authorized'),
                         ('base', '0' * 40), ('first_plan_commit', '0' * 40),
                         ('frozen_plan_sha256', '0' * 64)]:
            invalid = dict(ledger, **{key: bad})
            with self.subTest(key=key), self.assertRaises(ValueError):
                c.check_ledger(invalid, preimage, c.PATHS, 'SOURCE_FROZEN')
        invalid = copy.deepcopy(ledger)
        invalid['paths'][0]['causal_need'] = ' '
        with self.assertRaisesRegex(ValueError, 'PATH_PROVENANCE'):
            c.check_ledger(invalid, preimage, c.PATHS, 'SOURCE_FROZEN')

    def test_commit_parser_hashes_actual_object_and_rejects_wrong_identity(self):
        raw = ('tree ' + c.TREE + '\nparent ' + c.BASE + '\nauthor A <a@example.invalid> 1 +0000\n\nmessage\n').encode()
        oid = hashlib.sha1(b'commit ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
        self.assertEqual(c.commit(lambda *args: raw, oid), (c.TREE, [c.BASE]))
        with self.assertRaisesRegex(ValueError, 'COMMIT_OBJECT_HASH'):
            c.commit(lambda *args: raw + b'changed', oid)
        with self.assertRaisesRegex(ValueError, 'COMMIT_REFERENCE'):
            c.commit(lambda *args: raw, '../HEAD')


if __name__ == '__main__':
    unittest.main()
