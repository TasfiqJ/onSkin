# Reproducers and CI anchors

Run in a clean independent Linux checkout at exact source SHA/tree, pin reviewed Node/npm/Python; do not borrow node_modules or pass tests from prior heads. Commands below are representative, adjust to actual repository instructions and record entire argv/exit:

```bash
python -B verify_context.py --expected-manifest-sha256 <EXTERNAL_MANIFEST_SHA>
git rev-parse HEAD
git rev-parse HEAD^{tree}
git status --porcelain=v1
git cat-file -p <each-existing-preimage-at-b74c>
npm ci --no-audit --no-fund
npm run postinstall:check
npm run phase5:expo-widgets-lifecycle:test
npm run phase5:ios-extension-contract:smoke
npm run phase9:ios-privacy-source-audit:check
npm run phase9:ios-privacy-source-audit:test
# In apps/mobile: CI=1 npx --no-install expo install --check
# Expo Doctor, using the installed and independently pinned executable only
npm test -- --force
npm run typecheck -- --force
npm run lint -- --force
python -B -m unittest discover -s scripts/brain -p 'test_*.py' -v
python -B -m unittest discover -s scripts/phase9/security_acceptance -p 'test_secret_scan.py' -v
python -B -m unittest discover -s scripts/phase9/security_acceptance -p 'test_contract.py' -v
npm run phase4:source-worklist:check
python -B scripts/brain/brain.py --profile M1-03 validate
```

Base final-head PR9 Quality39723353598/job119641729371 failed at installed iOS source audit's three lock-only `MAPPING_LOCK_DRIFT` rows; DB119641729444 has canonical ECR `Data limit exceeded`. Original Security39723353606 failed including `WORKFLOW_SBOM_UNRELATED_FAILURE_OR_DRIFT`, current-source secret findings and unreviewed npm/OSV. iOS39723353624 passed source-only. No older CI result may be borrowed for new exact head. Read `01_BRAIN_AUDIT.md` for latest verified source state and `09_DELIVERY_PROTOCOL.md` for final evidence. GitHub CI may checkout a distinct merge SHA; compare *tree* to stage before asserting equivalence.
