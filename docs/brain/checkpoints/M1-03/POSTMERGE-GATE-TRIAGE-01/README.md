# POSTMERGE-GATE-TRIAGE-01

status=PARTIAL_DIAGNOSTIC; admission=NONE. Authorization M103-POSTMERGE-GATE-TRIAGE01-READONLY-CANDIDATE-01.

Measured source: `d9912f4c8b30358593569c5b9b4e84773c6f463e`, tree `389c2a09b62e78a225a2b41c8a1965a1b0e1ab80`. Both live branches matched before work and again before delivery preparation. All 18 externally issued preimages independently matched byte count, Git blob ID and SHA256. No stale issuance. A new clean remote clone is the sole stage writer; a separate full no-hardlink Linux clone held the experiment. Its Git object check passed, with no shallow boundary, promisor packs or alternates. Windows checkout line endings are normalized by Git; source byte witnesses use Git objects and the Linux checkout.

The hidden original unit-test error is `assert.deepEqual(packet.packages, packages)` at workflow_contract.mjs:129, caused by a stale synthetic SBOM inventory after lock changes. The original 70 tests reproduce 23 failures and 2 errors. One fixture-only candidate invokes the unchanged producer against the current lock in temporary storage, replaying only the historical synthetic audit. Candidate: 70/70 pass; selected adverse tests pass; reversing the patch restores the targeted failure. The patch is stored under candidates/ and was never applied to stage or main.

The real CI SBOM has a different refusal at workflow_contract.mjs:117: four blockers include two new moderate @vitest/mocker advisories, while the validator permits only the original two expired-policy blockers. The unchanged validator still rejects the real provider artifact. No policy renewal, receipt creation, scanner acceptance or source GO follows from the unit result.

Original Security remains failure (code, static, secret, admission). Original Quality remains failure at canonical ECR acquisition. iOS source-contract success remains source-only. Provider archives were downloaded read-only and checked against GitHub's raw ZIP SHA256s; only sanitized projections and location hashes are published. See SECURITY_CAUSAL_PROOF.md, BLOCKERS.md, ECR_CUSTODY.md and NEXT_EDIT_PROPOSAL.md.

Accepted tasks remain M0-01/M0-02/M1-01/M1-02. Whole M1-03, Security GO, database GO, main promotion, release and M2 remain blocked/false. Incremental costs $0. Context health: healthy; no compaction or continuation needed. Stop after the safe stage push and live delivery observation. Founder relay: Codex is done.
