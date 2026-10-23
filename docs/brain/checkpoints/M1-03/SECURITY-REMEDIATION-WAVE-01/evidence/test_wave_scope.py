"""Explicit adverse cases for the narrow diagnostic delivery, never source admission."""
import copy, json, pathlib, sys, unittest
sys.path.insert(0,str(pathlib.Path(__file__).parent))
import verify_delivery as v
class Refusals(unittest.TestCase):
    def test_forged_wheel(self):
        with self.assertRaisesRegex(ValueError,'FORGED_WHEEL'):v.verified_wheel(b'forged',v.sha(b'official'))
    def test_requirements_and_package_tree_edit(self):
        for path in ['scripts/phase9/security_acceptance/semgrep-requirements-linux-py312.txt','scripts/phase9/security_acceptance/proposal.json']:
            with self.assertRaisesRegex(ValueError,'OUTSIDE'):v.scope([path])
    def test_unexpected_dependency_drift(self):
        for path in ['package-lock.json','package.json','apps/mobile/package.json']:
            with self.assertRaisesRegex(ValueError,'OUTSIDE'):v.scope([path])
    def test_owner_and_expiry(self):
        for field in ['notAfter','owner','semgrepPackageTree']:
            original={'notAfter':'2026-10-21T00:00:00Z','owner':'original','semgrepPackageTree':'original'}; candidate=copy.deepcopy(original);candidate[field]='forged'
            with self.assertRaisesRegex(ValueError,'PROTECTED_PROPOSAL'):v.unchanged_proposal(original,candidate)
    def test_false_go(self):
        for field in ['protected_source_go','accepted_by_brain']:
            report={'protected_source_go':False,'accepted_by_brain':False,'admission':'NONE'};report[field]=True
            with self.assertRaisesRegex(ValueError,'FALSE_GO'):v.no_go(report)
    def test_wrong_source(self):
        with self.assertRaisesRegex(ValueError,'WRONG'):v.identity(v.BRANCH,'0'*40,v.TREE)
        with self.assertRaisesRegex(ValueError,'WRONG'):v.identity('main',v.BASE,v.TREE)
    def test_source_manifest_and_rule_edits(self):
        for path in ['scripts/phase9/security_acceptance/source-manifest.json','.github/workflows/security.yml','scripts/phase9/security_acceptance/scan-targets.json.gz']:
            with self.assertRaisesRegex(ValueError,'OUTSIDE'):v.scope([path])
    def test_positive_diagnostic_scope(self):
        v.scope([v.PREFIX+'README.md','ONSKIN_BRAIN_HANDOFF.txt']);v.identity(v.BRANCH,v.BASE,v.TREE)
if __name__=='__main__':unittest.main(verbosity=2)
