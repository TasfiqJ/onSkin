# Verification obligations

Use a clean, isolated, no-hardlink clone/worktree. Capture exact commit/tree and source SHA256s from Git objects. Preserve original cases, real exit codes, and sanitized log hashes.

Mandatory source-side tests when feasible: original 70 Security contract tests, original 12 secret fixtures, the targeted valid-known-artifacts SBOM test, non-mutating original fixture `workflow_contract.mjs` checks, and the current canonical image source-contract. Run no more than two bounded causal approaches. If original tools require historical Git objects, restore only verified authentic objects from remote (never invent blobs/history). Never disable `GIT_NO_LAZY_FETCH` custody rules or trust a non-verified partial clone.

New proof must include one exact causal trace of the SBOM wrapper's hidden error or explicit evidence why the underlying condition cannot be inspected safely. Candidate patches are OFFLINE / NON-ADMITTING. If a candidate passes, show the original fail-closed negatives still reject.

Run Quality source and existing unit checks only as necessary for any candidate; do not repeat 6,067 root tests for a read-only checkpoint unless code under test was actually changed in the disposable clone. Record absence of a run as NOT_RUN, not PASS. Avoid logging raw secrets/patient data or hosted credentials.

Required checkpoint:
- `README.md` (executive findings, what Codex actually did)
- `RESULTS.md` (nonsecret command table with real raw exits)
- `BLOCKERS.md` (real original gates and required actions)
- `SECURITY_CAUSAL_PROOF.md` (first underlying predicate and candidate regression demonstration)
- `ECR_CUSTODY.md` (pinned image, original failure, exact custodian need)
- `NEXT_EDIT_PROPOSAL.md` (one narrow feasible assignment, exact source file/preimage scope)
- `evidence/**` (sanitized receipts/logs, optional candidate patch(es), Git SHA256 manifest)
- root `ONSKIN_BRAIN_HANDOFF.txt` (truthful stage/partial status).

Evidence-only checkpoint may be pushed normally to the existing stage branch. If there is no meaningful new causal evidence, record `NO_NEW_CAUSAL_PROOF` with blockers; do not claim a fixed gate or invent a code patch.
