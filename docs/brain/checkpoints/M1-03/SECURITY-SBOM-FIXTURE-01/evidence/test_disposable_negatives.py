"""Two extra disposable negatives; synthetic data grants no scanner acceptance."""
import pathlib
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, str(pathlib.Path.cwd() / 'scripts/phase9/security_acceptance'))
import test_contract
import contract as c

class DisposableNegatives(unittest.TestCase):
    def fixture(self):
        case = test_contract.ContractTests()
        case.setUpClass()
        self.addCleanup(case.doCleanups)
        result = case.workflow_fixture()
        w, root, needs, commit, run_id, fresh = result
        positive = w.original_jobs(root, needs, commit, run_id, fresh)
        self.assertNotIn('acceptanceGranted', positive)
        return result

    def test_current_package_inventory_path_tamper_is_refused(self):
        w, root, needs, commit, run_id, fresh = self.fixture()
        path = root / 'code/dependency-inventory.json'
        original = path.read_bytes()
        for changed_path in ('node_modules/../tampered-current-package', 'node_modules/unknown-current-package'):
            value = c.parse_json(original)
            value['packages'][0]['path'] = changed_path
            path.write_bytes(c.CANON(value))
            with self.subTest(path=changed_path), self.assertRaisesRegex(c.Rejected, 'WORKFLOW_SBOM_UNRELATED_FAILURE_OR_DRIFT'):
                w.original_jobs(root, needs, commit, run_id, fresh)
        path.write_bytes(original)
        w.original_jobs(root, needs, commit, run_id, fresh)

    def test_unknown_primary_sbom_audit_advisory_is_refused(self):
        w, root, needs, commit, run_id, fresh = self.fixture()
        path = root / 'code/dependency-sbom-audit.json'
        original = path.read_bytes()
        value = c.parse_json(original)
        primary = next(via for row in value['vulnerabilities'].values() for via in row['via'] if isinstance(via, dict))
        primary['url'] = 'https://github.com/advisories/GHSA-zzzz-zzzz-zzzz'
        path.write_bytes(c.CANON(value))
        with self.assertRaisesRegex(c.Rejected, 'INITIAL_AUDIT_RECORD_DRIFT'):
            w.original_jobs(root, needs, commit, run_id, fresh)
        path.write_bytes(original)
        w.original_jobs(root, needs, commit, run_id, fresh)

if __name__ == '__main__':
    unittest.main(verbosity=2)
