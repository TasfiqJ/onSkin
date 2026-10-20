"""Synthetic successor-profile tests; none of these tests issue or accept work."""
import copy
import unittest
from unittest import mock

import brain
import m1_profile
import test_brain


class M1Profile(unittest.TestCase):
    save = test_brain.InstalledControls.save

    def setUp(self):
        test_brain.InstalledControls.setUp(self)
        for name in ['git_snapshot', 'ancestor']:
            self.addCleanup(mock.patch.stopall)
            mock.patch.object(brain, name).start()
        self.git = mock.patch.object(brain, 'git', return_value=m1_profile.BRANCH).start()

    def test_explicit_successor_and_historical_profile_both_validate(self):
        old = brain.read(self.root, 'docs/brain/current.json')
        self.assertEqual(m1_profile.validate(self.root)['task_id'], 'M1-01')
        self.assertEqual(brain.validate_state(self.root)['task_id'], 'M0-02')
        self.assertEqual(brain.read(self.root, 'docs/brain/current.json'), old)

    def test_refuses_self_acceptance_extra_task_writer_and_expiry_extension(self):
        current = brain.load(self.root, 'docs/brain/active.json')
        for patch in [dict(submission_status='ACCEPTED'), dict(accepted_tasks=['M0-01', 'M0-02', 'M1-01']),
                      dict(next_task='M1-02'), dict(active_writers=2), dict(main_promotion_authorized=True),
                      dict(proposal_expires_utc='2026-10-22T00:00:00Z')]:
            value = copy.deepcopy(current)
            value.update(patch)
            self.save('docs/brain/active.json', value)
            with self.subTest(patch=patch), self.assertRaises(ValueError):
                m1_profile.validate(self.root)

    def test_refuses_mutable_spec_and_replacement_manifest(self):
        spec = brain.load(self.root, 'docs/brain/task-specs/M1-01.json')
        path = self.root / m1_profile.INPUT / 'TASK_MANIFEST.json'
        path.write_bytes(path.read_bytes() + b'\n')
        spec['approval']['sha256'] = brain.digest(path.read_bytes())
        self.save('docs/brain/task-specs/M1-01.json', spec)
        with self.assertRaisesRegex(ValueError, 'anchored issuance'):
            m1_profile.validate(self.root)

    def test_refuses_changed_successor_review(self):
        path = self.root / m1_profile.REVIEW / 'brain_state.json'
        path.write_bytes(path.read_bytes() + b'\n')
        with self.assertRaisesRegex(ValueError, 'Successor review changed'):
            m1_profile.validate(self.root)

    def test_refuses_wrong_branch(self):
        self.git.return_value = 'main'
        with self.assertRaisesRegex(ValueError, 'Wrong M1 branch'):
            m1_profile.validate(self.root)
